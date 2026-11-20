// @vitest-environment jsdom
import { beforeAll, expect, it, vi } from 'vitest';
import { CompressionStream, DecompressionStream } from 'node:stream/web';
import { Blob } from 'node:buffer';
import { encodeTransfer, decodeTransfer, TRANSFER_TTL } from './progress-transfer';
import { createSimMachine, stripAnsi } from '../engine/terminal/shell';
import { registry } from './registry';
import { MemoryBackend, store } from './store';
import { setLang } from './i18n';
import { askBox } from '../app/mentor';
import { placementDisposition } from '../app/status';
import { goalConditions } from '../engine/flowlab/goals';
import { createState } from '../engine/flowlab/sim';
import { scenario } from '../engine/flowlab/scenarios';
import { mountDebrief } from '../engine/flowlab/debrief';
import { metrics } from '../engine/flowlab/metrics';
import { deadline } from '../engine/v86/deadline';
import { wrapPagerText } from '../engine/terminal/widget';

beforeAll(async () => { await store.init(new MemoryBackend()); setLang('ru'); });
it('expands unquoted assignment tildes after equals and colons, preserving quoted and variable text', async () => {
  const m = await createSimMachine({ user: 'root' });
  await m.exec('export PATH=~/bin:~/tools:$PATH');
  expect(stripAnsi((await m.exec('echo "$PATH"')).out)).toMatch(/^\/root\/bin:\/root\/tools:/);
  await m.exec("X='~/literal'; export Y=~:$X:\"~\":~/bin");
  expect(stripAnsi((await m.exec('echo "$Y"')).out)).toBe('/root:~/literal:~:/root/bin\n');
});
it('preserves symlinks for cp -P and recursive copies', async () => {
  const m = await createSimMachine({ user: 'root' });
  await m.exec('mkdir /tmp/tree; echo hello > /tmp/tree/file; ln -s file /tmp/tree/link');
  expect((await m.exec('cp -r /tmp/tree /tmp/copy')).exit).toBe(0);
  expect(stripAnsi((await m.exec('readlink /tmp/copy/link')).out)).toBe('file\n');
  expect((await m.exec('cp -P /tmp/tree/link /tmp/link')).exit).toBe(0);
  expect(stripAnsi((await m.exec('readlink /tmp/link')).out)).toBe('file\n');
});
it('keeps dropped capabilities in an interactive capsh until exit', async () => {
  const m = await createSimMachine({ user: 'root' });
  await m.exec('mkdir -p /mnt');
  expect((await m.exec('capsh --drop=cap_sys_admin --')).exit).toBe(0);
  const denied = await m.exec('mount -t tmpfs tmpfs /mnt');
  expect(denied.exit).not.toBe(0);
  expect(stripAnsi(denied.out)).toContain('mount: /mnt: permission denied.');
  await m.exec('exit');
  expect((await m.exec('mount -t tmpfs tmpfs /mnt')).exit).toBe(0);
});
it('reports oversized ping packets accurately', async () => {
  const m = await createSimMachine({ user: 'root', ext: { net: { preset: 'home' } } });
  expect(stripAnsi((await m.exec('ping -s 70000 127.0.0.1')).out)).toContain('packet size 70000 is too large. Maximum is 65507');
});
it('round trips compressed progress and rejects expiration and malformed input', async () => {
  vi.stubGlobal('Blob', Blob); vi.stubGlobal('CompressionStream', CompressionStream); vi.stubGlobal('DecompressionStream', DecompressionStream);
  try {
    const json = JSON.stringify({ text: 'Прогресс '.repeat(1000) });
    const payload = await encodeTransfer(json, 1000);
    expect(payload.length).toBeLessThan(json.length / 10);
    expect(await decodeTransfer(payload, 1001)).toBe(json);
    await expect(decodeTransfer(payload, 1000 + TRANSFER_TTL)).rejects.toThrow();
    await expect(decodeTransfer('invalid!')).rejects.toThrow();
  } finally { vi.unstubAllGlobals(); }
});
it('uses lesson minutes for every delivered block and level', () => {
  for (const block of registry.blocks.values()) {
    const hours = [...registry.lessons.values()].filter(l => l.block === block.id).reduce((sum, l) => sum + (l.minutes ?? 0), 0) / 60;
    expect(block.hours).toEqual({ beginner: hours, intermediate: hours, experienced: hours });
  }
});
it('offers a direct document pointer without an AI mentor', () => {
  const box = askBox({ mode: 'docs', level: 'beginner', task: { id: 'x', prompt: 'x', docRef: { page: 'man/ps.1', anchor: 'OPTIONS', line: '-o' } } });
  box.querySelector('button')!.click();
  expect(box.textContent).toContain('нужному разделу и строке');
  expect(box.textContent).toContain('ps');
});
it('requires lessons introducing a placement gap, not every core or dependent lesson', () => {
  const original = store.state.placement.linux;
  const level = store.state.levels.linux;
  store.state.levels.linux = 'experienced';
  store.state.placement.linux = [{ claimed: 'experienced', passed: false, gaps: ['gap'] } as never];
  try {
    const base = { ...registry.lessons.get('linux.terminal')!, introduces: [], uses: ['gap'] };
    expect(placementDisposition(base)).toBe('optional');
    expect(placementDisposition({ ...base, introduces: ['gap'] })).toBe('required');
  } finally { store.state.placement.linux = original; store.state.levels.linux = level; }
});
it('prints each sale goal verdict and exposes sale downtime and spending', () => {
  const sc = scenario('s2'); const s = createState(sc, sc.defaultSeed); s.money.extra = -123;
  expect(metrics(s, sc).extraSpending).toBe(123);
  expect(goalConditions(sc, s)).toHaveLength(3);
  const root = document.createElement('div');
  const mounted = mountDebrief(root, sc, s, { back() {}, again() {}, record() {} });
  expect(root.querySelectorAll('.fl-goal-results li')).toHaveLength(3);
  expect(root.textContent).toContain('Простой во время распродажи');
  expect(root.textContent).toContain('Дополнительные расходы');
  mounted.dispose();
});
it('bounds stalled preparation and preserves word boundaries in phone man pages', async () => {
  await expect(deadline(new Promise(() => {}), 5, 'timed out')).rejects.toThrow('timed out');
  expect(wrapPagerText('one two three four five six seven', 12)).toEqual(['one two', 'three four', 'five six', 'seven']);
});
it('edits a Kubernetes object through the interactive editor and applies it only on save', async () => {
  const m = await createSimMachine({ ext: { k8s: { nodes: ['cp-1'] } } });
  await m.exec('kubectl create configmap demo --from-literal=a=old');
  const opened = await m.exec('kubectl edit configmap demo');
  expect(opened.exit).toBe(0);
  const lines = stripAnsi(opened.out).split('\n');
  const match = lines.find(l => /a: old/.test(l))?.match(/^(\d+)\t/);
  expect(match).toBeTruthy();
  await m.exec(`:${match![1]}  a: new`);
  expect((await m.exec(':wq')).exit).toBe(0);
  expect((await m.exec('kubectl get configmap demo -o yaml')).out).toContain('a: new');
});

it('does not count paused time and restores elapsed active time', async () => {
  const { ActiveTimer } = await import('./active-timer');
  let now = 0; const timer = new ActiveTimer(10, () => now);
  now = 100; expect(timer.elapsed()).toBe(110);
  timer.toggle(); now = 1000; expect(timer.elapsed()).toBe(110);
  timer.toggle(); now = 1100; expect(timer.elapsed()).toBe(210);
  const resumed = new ActiveTimer(timer.elapsed(), () => now);
  expect(resumed.elapsed()).toBe(210);
});
it('compares counterfactuals to the actual played money, including manual actions', async () => {
  const { runBot, counterfactuals } = await import('../engine/flowlab/bots');
  const sc = scenario('s2'); const played = runBot(sc, sc.defaultSeed, 'reference');
  const before = counterfactuals(sc, played, 100);
  played.money.extra += 1_000_000;
  const after = counterfactuals(sc, played, 100);
  expect(after.length).toBeGreaterThan(0);
  expect(after.some(a => before.some(b => a.day === b.day && a.did.en === b.did.en && a.score > b.score))).toBe(true);
});
it('shows Russian controller guidance outside the English source comments', async () => {
  const { controllerLabWidget } = await import('../engine/kube-lite/ui/controller-lab');
  for (const exercise of ['team-info', 'website']) {
    const root = document.createElement('div');
    const mounted = controllerLabWidget.mount(root, { exercise }, { level: 'beginner', complete() {}, record() {}, openDoc() {} });
    expect(root.querySelector<HTMLTextAreaElement>('.kl-code')!.value).not.toContain('//');
    expect(root.textContent).toContain('Функция получает текущее состояние');
    expect(root.textContent).not.toContain('воркере');
    mounted.dispose();
  }
});
it('adds real control-plane evidence to both Kubernetes stage-2 placement levels', () => {
  const block = registry.blocks.get('k8s-2')!;
  for (const level of ['intermediate', 'experienced']) {
    const task = block.placement.find(t => t.level === level && t.realEvidence);
    expect(task?.key).toBe(true);
    const exam = registry.exams.get(task!.realEvidence!.exam)!;
    const real = exam.tasks.find(t => t.id === task!.realEvidence!.task);
    expect(real?.kind).toBe('real');
    if (real?.kind === 'real') expect(real.real.goals?.length).toBeGreaterThan(0);
  }
});
it('reports invalid OCI bundles without crashing or silently failing', async () => {
  const m = await createSimMachine({ user: 'root' });
  await m.exec('mkdir /tmp/bundle; cd /tmp/bundle; echo null > config.json');
  const result = await m.exec('crun run invalid');
  expect(result.exit).not.toBe(0);
  expect(result.out).toContain('invalid configuration: expected an OCI object');
});
it('judges the introductory bottleneck by the baseline rather than the later exam pass line', async () => {
  const { bots } = await import('../engine/flowlab/bots');
  const sc = scenario('s1'); const s = createState(sc, sc.defaultSeed);
  const baseline = bots(sc, s.seed).baseline;
  const goals = goalConditions(sc, s);
  expect(goals[0].text.en).toContain(`baseline of ${baseline.cycleP85}`);
  expect(goals[1].text.en).toContain(`baseline of ${baseline.codLost}`);
});
