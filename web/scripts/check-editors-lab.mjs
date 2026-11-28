// End-to-end check of the editors platform on the real lab-editors image, in
// headless Chromium (run it on a build host, not on a laptop):
//
//   node scripts/check-editors-lab.mjs [--memory 256] [--fixtures DIR] [--cold]
//
// Boots the machine (from the published boot snapshot unless --cold), drives
// Vim, Neovim and Emacs through the learner's serial terminal, waits for the
// `editor.change` events of the editor watch and judges the three demo goals
// (engine/v86/editor-demo.ts) on the facts. Prints one JSON line with timings,
// sizes and results; --fixtures saves raw service-channel output for unit tests.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
};
const memoryMB = Number(arg('--memory', '256'));
const fixtures = arg('--fixtures', '');
const cold = process.argv.includes('--cold');
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(e));
  // Progress of the steps, as they happen (stderr, so stdout stays one JSON line).
  page.on('console', (msg) => { if (msg.text().startsWith('dt-step ')) console.error(msg.text().slice(8)); });
  await page.goto(server.resolvedUrls.local[0]);
  const result = await page.evaluate(async ({ memoryMB, cold }) => {
    const { V86Machine, defaultAssets } = await import('/src/engine/v86/machine.ts');
    const { editorStateScript, editorProbeScript } = await import('/src/engine/v86/editor-facts.ts');
    const { EDITOR_DEMO_TASKS } = await import('/src/engine/v86/editor-demo.ts');
    const { evaluateCheck } = await import('/src/core/check.ts');
    const assets = cold ? { ...(await defaultAssets('lab-editors')), bootSnapshots: undefined } : undefined;
    const m = new V86Machine({ profile: 'lab-editors', memoryMB, editorWatch: true, bootCache: !cold, assets });
    // A real xterm on the serial line: full-screen programs (Neovim's TUI) query the terminal and wait for its answers.
    const { mountConsole } = await import('/src/engine/v86/console.ts');
    const box = document.createElement('div');
    box.style.cssText = 'width:900px;height:600px';
    document.body.append(box);
    const con = await mountConsole(box, m, { rows: 30 });
    const preds = EDITOR_DEMO_TASKS.flatMap((t) => [t.check.when, ...(t.check.fail ?? []).map((f) => f.if)]).filter((x) => typeof x === 'string');
    m.watchPredicates(preds);
    const events = [];
    m.on((ev) => { if (ev.t === 'editor.change') events.push({ at: performance.now(), editors: ev.editors.map((e) => `${e.kind}:${e.instrumented ? 'i' : '-'}`).join(','), probeMs: ev.probeMs }); });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const raw = {};
    const out = { memoryMB, cold, steps: [] };
    const step = (name, data) => { out.steps.push({ name, ...data }); console.log(`dt-step ${JSON.stringify({ name, ...data, matched: undefined })}`); };
    // Wait until the editor watch reports a state for which `ok(area)` holds.
    const waitArea = async (ok, timeout = 60000) => {
      const t0 = performance.now();
      while (performance.now() - t0 < timeout) {
        const area = await m.editorFacts();
        if (ok(area)) return { area, ms: Math.round(performance.now() - t0) };
        await sleep(300);
      }
      throw new Error('timeout waiting for the editor state');
    };
    const waitEvent = async (since, timeout = 60000) => {
      const t0 = performance.now();
      while (performance.now() - t0 < timeout) {
        const e = events.find((x) => x.at > since);
        if (e) return Math.round(e.at - since);
        await sleep(20);
      }
      return null;
    };
    const judge = async (id) => {
      const t0 = performance.now();
      const facts = await m.facts();
      const factsMs = Math.round(performance.now() - t0);
      const task = EDITOR_DEMO_TASKS.find((t) => t.id === id);
      const r = evaluateCheck(task.check, facts);
      return { pass: r.pass, say: r.say?.en, factsMs, matched: r.matched };
    };
    const keys = async (s, wait = 400) => { m.write(s); await sleep(wait); };
    const t0 = performance.now();
    const boot = await m.start();
    out.boot = { ...boot, readyMs: Math.round(performance.now() - t0) };
    out.guest = (await m.exec('free -m | sed -n 2p; cat /etc/dt/image')).out.trim();
    out.vimVersion = (await m.exec('vim --version | grep -o "[+-]clientserver\\|[+-]socketserver" | tr "\\n" " "')).out.trim();
    // Probe cost with nothing running.
    let s = performance.now();
    await m.exec(editorProbeScript());
    out.idleProbeMs = Math.round(performance.now() - s);

    // (a) Vim: change a word and save, stay in the editor.
    let since = performance.now();
    await keys('vim /srv/train/app.conf\r', 0);
    const vimStart = await waitArea((a) => a.vim.instrumented && a.vim.source === 'socket');
    step('vim.start', { firstEventMs: await waitEvent(since), readyMs: Math.round(performance.now() - since), fetched: await m.rootFetched() });
    raw.vimOpen = (await m.exec(editorStateScript())).out;
    s = performance.now();
    await m.editorFacts();
    step('vim.stateQuery', { ms: Math.round(performance.now() - s), stateMs: m.editorTiming.stateMs, probeMs: m.editorTiming.probeMs });
    since = performance.now();
    await keys('/debug\rcwrelease\x1b', 200);
    const changeLatency = await waitEvent(since);
    await keys(':w\r', 800);
    step('vim.word', { changeEventMs: changeLatency, ...(await judge('vim-word')) });
    raw.vimSaved = (await m.exec(editorStateScript())).out;

    // (b) Vim: a macro into register a.
    await keys(':e /srv/train/list.txt\r', 800);
    since = performance.now();
    await keys('qaA;\x1bjq', 300);
    step('vim.recorded', { eventMs: await waitEvent(since) });
    await keys('3@a', 800);
    await waitArea((a) => (a.vim.buf?.text ?? '').split(';').length > 4, 10000).catch(() => null);
    step('vim.macro', await judge('vim-macro'));
    raw.vimMacro = (await m.exec(editorStateScript())).out;
    // A behaviour probe: the macro of register a on a hidden file, in a fresh batch Vim.
    {
      const { probeScript, parseProbe } = await import('/src/engine/v86/editor-probes.ts');
      const spec = { id: 'macro-a', editor: 'vim', input: 'one\ntwo\nthree\nfour\nfive\n', run: { macro: 'a' } };
      const facts = await m.facts();
      const ps = performance.now();
      const r = parseProbe((await m.exec(probeScript(spec, facts))).out);
      step('vim.probe', { ms: Math.round(performance.now() - ps), ok: r.ok, text: r.text, error: r.error });
    }
    await keys(':qa!\r', 1500);
    // Honesty: Vim without plugins.
    await keys('vim -u NONE /srv/train/app.conf\r', 0);
    const bare = await waitArea((a) => a.vim.running);
    step('vim.noplugins', { instrumented: bare.area.vim.instrumented, source: bare.area.vim.source, say: (await judge('vim-word')).say });
    raw.vimBare = (await m.exec(editorStateScript())).out;
    await keys(':qa!\r', 1500);

    // Neovim: start and state.
    since = performance.now();
    await keys('nvim /srv/train/list.txt\r', 0);
    const nv = await waitArea((a) => a.nvim.instrumented && a.nvim.source === 'socket', 90000).catch((e) => ({ error: e.message }));
    step('nvim.start', { readyMs: Math.round(performance.now() - since), firstEventMs: await waitEvent(since), mode: nv.area?.nvim.mode, version: nv.area?.nvim.version, fetched: await m.rootFetched() });
    s = performance.now();
    await m.editorFacts();
    step('nvim.stateQuery', { ms: Math.round(performance.now() - s) });
    raw.nvimOpen = (await m.exec(editorStateScript())).out;
    await keys('\x1b:qa!\r', 2000);

    // (c) Emacs: kill a line and yank it twice.
    since = performance.now();
    await keys('emacs /srv/train/notes.txt\r', 0);
    const em = await waitArea((a) => a.emacs.instrumented && a.emacs.source === 'socket', 120000).catch((e) => ({ error: e.message }));
    step('emacs.start', { readyMs: Math.round(performance.now() - since), firstEventMs: await waitEvent(since), major: em.area?.emacs.major, fetched: await m.rootFetched() });
    s = performance.now();
    await m.editorFacts();
    step('emacs.stateQuery', { ms: Math.round(performance.now() - s) });
    // C-n, C-a, C-k C-k, M->, C-y C-y
    await keys('\x0e\x01\x0b\x0b', 1200);
    await keys('\x1b>\x19\x19', 1500);
    await waitArea((a) => (a.emacs.buf?.text ?? '').endsWith('beta\nbeta\n'), 15000).catch(() => null);
    step('emacs.yank', await judge('emacs-yank'));
    raw.emacsYank = (await m.exec(editorStateScript())).out;
    await keys('\x18\x03', 1000);
    await keys('n', 300);
    await keys('yes\r', 2000);
    await keys('emacs -Q /srv/train/notes.txt\r', 0);
    const eq = await waitArea((a) => a.emacs.running, 120000).catch((e) => ({ error: e.message }));
    step('emacs.Q', { instrumented: eq.area?.emacs.instrumented, say: (await judge('emacs-yank')).say });
    await keys('\x18\x03', 1500);
    out.events = events.length;
    out.guestAfter = (await m.exec('free -m | sed -n 2p')).out.trim();
    out.fetched = await m.rootFetched();
    out.keyboard = { lock: typeof navigator.keyboard?.lock === 'function', fullscreenEnabled: document.fullscreenEnabled };
    try { await document.documentElement.requestFullscreen(); await navigator.keyboard.lock(); out.keyboard.lockedInFullscreen = true; } catch (e) { out.keyboard.lockError = String(e.message ?? e); }
    out.heapMB = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : undefined;
    out.screen = Array.from({ length: con.terminal.buffer.active.length }, (_, i) => con.terminal.buffer.active.getLine(i)?.translateToString(true) ?? '').filter(Boolean).slice(-12).join('\n');
    con.dispose();
    m.dispose();
    return { out, raw };
  }, { memoryMB, cold });
  console.log(JSON.stringify(result.out));
  if (fixtures) {
    mkdirSync(fixtures, { recursive: true });
    for (const [name, text] of Object.entries(result.raw)) writeFileSync(`${fixtures}/${name}.txt`, text);
  }
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
