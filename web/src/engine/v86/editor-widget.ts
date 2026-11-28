// The widget `v86.editor`: one real machine of the lab-editors image with a
// terminal fit for a fullscreen editor, and goals judged by the editor's
// state (editor-facts.ts). Opt-in: existing labs and profiles do not change.
//
//   { kind: 'widget', id: 'vim-lab', widget: 'v86.editor', props: {
//       editors: ['vim'], tasks: [{ id, prompt, check: { when: "vim.reg.a ~ 'x'" } }] } }
//
// What it adds to the plain real-machine lab:
//   - checks also run on `editor.change` (the machine polls the agents'
//     stamps while a command runs), not only at the shell prompt;
//   - a key panel over the terminal for keys the browser keeps (Esc, C-w,
//     C-n, C-t, C-v, C-[, M-x, C-g);
//   - fullscreen with Keyboard Lock where the browser has it, and an honest
//     line where it does not;
//   - the mode, a macro recording and the kill ring head from the facts;
//   - a confirmation before leaving the page while an editor is open;
//   - on macOS, Option as Meta (switchable: it costs typing symbols with Option).

import { evaluateCheck } from '../../core/check';
import { clear, h, icon, toast } from '../../core/dom';
import { bi, fmt, t, type Bi } from '../../core/i18n';
import { renderInline } from '../../core/markdown';
import { prose } from '../../app/common';
import { store } from '../../core/store';
import type { Facts, Mounted, Task, WidgetCtx } from '../../core/types';
import { formatMB, labDownloadBytes, loadLabManifest } from './assets';
import { shouldAutostart } from './component';
import type { ConsoleHandle } from './console';
import { editorScopesOf, type EditorArea, type EditorKind } from './editor-facts';
import { editorOnly, isMac, keyboardLockSupport, PANEL_KEYS, panelsFor, predicates, statusLine, type EditorLabProps } from './editor-keys';

export type { EditorLabProps };
import type { BootPhase, V86Machine } from './machine';
import { PROFILES } from './profiles';
import './v86.css';
import './editor.css';


const T = {
  env: bi('Настоящий Linux с редакторами · v86', 'Real Linux with editors · v86'),
  what: bi(
    'Это настоящая машина с Alpine Linux, Vim, Neovim и Emacs. Её выполняет эмулятор процессора прямо в этой вкладке, и выйти в интернет она не может.',
    'This is a real machine with Alpine Linux, Vim, Neovim and Emacs. A processor emulator runs it right in this tab, and it cannot reach the internet.',
  ),
  start: bi('Запустить машину', 'Start the machine'),
  cost: bi('Один раз загрузится около {mb} МБ, вкладка займёт около {ram} МБ памяти', '≈ {mb} MB to download once, ≈ {ram} MB of tab memory'),
  missing: bi('В этой сборке нет образа машины с редакторами. Его собирает `npm run build:lab-image`.', 'This build has no image of the editors machine. `npm run build:lab-image` builds it.'),
  phase: {
    download: bi('Скачиваю эмулятор и систему…', 'Downloading the emulator and the system…'),
    boot: bi('Ядро загружается', 'The kernel is booting'),
    setup: bi('Готовлю терминал…', 'Preparing the terminal…'),
    ready: bi('Машина работает', 'The machine is running'),
    error: bi('Машина не запустилась', 'The machine did not start'),
  } as Record<BootPhase, Bi>,
  booted: bi('запуск занял {s} с', 'started in {s} s'),
  goals: bi('Цели', 'Goals'),
  allDone: bi('Все цели выполнены в настоящем редакторе.', 'All goals are done in a real editor.'),
  hint: bi('Подсказка', 'Hint'),
  reset: bi('Сбросить машину', 'Reset the machine'),
  resetDone: bi('Машина возвращена к началу упражнения', 'The machine is back at the start of the exercise'),
  check: bi('Проверить', 'Check'),
  keys: bi('Клавиши, которые браузер может не пропустить', 'Keys the browser may keep for itself'),
  full: bi('На весь экран с захватом клавиатуры', 'Fullscreen with keyboard capture'),
  fullNoLock: bi('На весь экран', 'Fullscreen'),
  locked: bi('Клавиатура захвачена: Ctrl-W, Ctrl-N и Ctrl-T уходят в редактор. Чтобы выйти из полноэкранного режима, удерживайте Esc две секунды.', 'The keyboard is captured: Ctrl-W, Ctrl-N and Ctrl-T go to the editor. To leave fullscreen, hold Esc for two seconds.'),
  noLock: bi(
    'Этот браузер не умеет захватывать клавиатуру, поэтому Ctrl-W закроет вкладку, а Ctrl-N и Ctrl-T откроют новое окно или вкладку. Нажимайте эти клавиши на панели над терминалом. Захват клавиатуры есть в Chrome и Edge, а ещё можно установить сайт как приложение.',
    'This browser cannot capture the keyboard, so Ctrl-W closes the tab, and Ctrl-N and Ctrl-T open a new window or tab. Use the panel above the terminal for these keys. Chrome and Edge can capture the keyboard; installing the site as an app also helps.',
  ),
  lockFailed: bi('Браузер не разрешил захват клавиатуры, поэтому сочетания вроде Ctrl-W нажимайте на панели над терминалом.', 'The browser did not allow keyboard capture, so press combinations like Ctrl-W on the panel above the terminal.'),
  meta: bi('Option работает как Meta', 'Option acts as Meta'),
  metaWhy: bi('Нужно для команд Emacs вроде `M-x`. Пока переключатель включён, символы, которые набираются с Option, не вводятся.', 'Needed for Emacs commands like `M-x`. While it is on, characters typed with Option are not entered.'),
  leave: bi('Редактор ещё открыт, и несохранённые изменения пропадут.', 'An editor is still open; unsaved changes will be lost.'),
  exitHow: bi('Выйти из Vim: Esc, затем `:q!` и Enter. Выйти из Emacs: `C-x C-c`.', 'To leave Vim: Esc, then `:q!` and Enter. To leave Emacs: `C-x C-c`.'),
};

const sec = (ms: number) => (ms / 1000).toFixed(1).replace('.', t(bi(',', '.')));

export function mountEditorLab(root: HTMLElement, raw: unknown, ctx?: WidgetCtx): Mounted {
  const props = (raw ?? {}) as EditorLabProps;
  const tasks = props.tasks ?? [];
  const editors = props.editors ?? ['vim'];
  const key = ctx?.lessonId ? `${ctx.lessonId}/${ctx.sectionId ?? 'editor'}` : 'page/editors';
  const passed = new Set(tasks.filter((x) => store.state.tasks[`${key}/${x.id}`]).map((x) => x.id));
  const hintsShown = new Map<string, number>();
  const memoryMB = props.memoryMB ?? PROFILES['lab-editors'].memoryMB;
  let machine: V86Machine | null = null;
  let con: ConsoleHandle | null = null;
  let startSnap: Awaited<ReturnType<V86Machine['snapshot']>> | null = null;
  let startFacts: Facts | undefined;
  let lastFull: Facts | undefined;
  let disposed = false;
  let checking = false;
  let again = false;
  let checkTimer = 0;
  let editorOpen = false;
  let lastArea: EditorArea | null = null;

  const status = h('div.v86-status', { 'aria-live': 'polite' });
  const bootLine = h('span.v86-boot.muted.small');
  const resetBtn = h('button.btn.ghost.small', { type: 'button', disabled: true }, icon('repeat'), t(T.reset));
  const checkBtn = h('button.btn.ghost.small', { type: 'button', disabled: true }, icon('check'), t(T.check));
  const support = keyboardLockSupport(typeof navigator !== 'undefined' ? navigator : undefined, typeof document !== 'undefined' ? document : undefined);
  const fullBtn = h('button.btn.ghost.small', { type: 'button', disabled: !support.fullscreen }, icon('bolt'), t(support.lock ? T.full : T.fullNoLock));
  const mac = isMac(typeof navigator !== 'undefined' ? navigator.platform : '');
  const metaBox = h('input', { type: 'checkbox' }) as HTMLInputElement;
  metaBox.checked = mac && editors.includes('emacs');
  const metaRow = mac ? h('label.ed-meta.small', { title: t(T.metaWhy) }, metaBox, ' ', t(T.meta)) : null;
  const panel = h('div.ed-keys', { role: 'toolbar', 'aria-label': t(T.keys) });
  const mode = h('div.ed-mode.small', { 'aria-live': 'polite' });
  const honest = h('p.ed-honest.small.muted');
  const lockLine = h('p.ed-lock.small.muted', {}, support.lock ? '' : t(T.noLock));
  const termBox = h('div.lab-term-box.v86-term.ed-term');
  const shell = h('div.ed-shell', {}, panel, termBox, mode);
  const goals = h('ol.lab-goals');
  const checkLine = h('div.lab-status', { 'aria-live': 'polite' });
  const left = h('div.lab-left', {}, props.intro ? prose(props.intro) : null, tasks.length ? h('h4.lab-h', {}, t(T.goals)) : null, tasks.length ? goals : null, checkLine, prose(T.exitHow, 'small muted'));
  const right = h('div.lab-right', {}, h('div.lab-bar', {}, h('span.lab-env.v86-env', {}, icon('bolt'), t(T.env), bootLine), h('span.rl-actions', {}, checkBtn, fullBtn, resetBtn)), metaRow, shell, honest, lockLine, status);
  clear(root);
  root.append(h('div.lab.v86-lab.ed-lab', {}, left, right));

  const drawPanel = (active: EditorKind | null) => {
    clear(panel);
    for (const which of panelsFor(editors, active)) {
      const group = h('span.ed-group', {}, h('span.ed-group-name.small.muted', {}, which === 'emacs' ? 'Emacs' : 'Vim'));
      for (const k of PANEL_KEYS[which]) {
        const b = h('button.chip.ed-key', { type: 'button', title: t(k.title), 'aria-label': `${k.label}: ${t(k.title)}` }, k.label);
        // Keep the focus in the terminal: the editor must not lose the keyboard.
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => {
          if (machine?.phase === 'ready') machine.write(k.seq);
          con?.focus();
        });
        group.append(b);
      }
      panel.append(group);
    }
  };
  drawPanel(null);

  const drawMode = (area: EditorArea | null) => {
    lastArea = area;
    const s = statusLine(area);
    mode.textContent = s ? t(s.text) : '';
    honest.textContent = s?.honest ? t(s.honest).replace(/`/g, '') : '';
    editorOpen = !!area?.editor.active;
    drawPanel(area?.editor.active ?? null);
  };

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!editorOpen) return;
    e.preventDefault();
    e.returnValue = t(T.leave);
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  // Fullscreen and Keyboard Lock: the lock works only in fullscreen (Chromium); Esc held for 2 s leaves.
  fullBtn.addEventListener('click', async () => {
    const target = shell as HTMLElement & { requestFullscreen?: () => Promise<void> };
    try {
      await target.requestFullscreen?.();
      const kb = (navigator as Navigator & { keyboard?: { lock?: (keys?: string[]) => Promise<void> } }).keyboard;
      if (kb?.lock) {
        await kb.lock();
        lockLine.textContent = t(T.locked);
      }
    } catch {
      lockLine.textContent = t(support.lock ? T.lockFailed : T.noLock);
    }
    con?.focus();
  });
  const onFullscreen = () => {
    if (document.fullscreenElement) return;
    (navigator as Navigator & { keyboard?: { unlock?: () => void } }).keyboard?.unlock?.();
    lockLine.textContent = support.lock ? '' : t(T.noLock);
  };
  document.addEventListener('fullscreenchange', onFullscreen);

  metaBox.addEventListener('change', () => {
    if (con) con.terminal.options.macOptionIsMeta = metaBox.checked;
    con?.focus();
  });

  const renderGoals = () => {
    clear(goals);
    const current = tasks.find((x) => !passed.has(x.id));
    for (const task of tasks) {
      const done = passed.has(task.id);
      const li = h('li.goal', { class: [done ? 'done' : '', task === current ? 'current' : ''].filter(Boolean).join(' '), 'data-task': task.id });
      const body = h('div.goal-body', {}, prose(task.prompt, 'goal-text'));
      li.append(h('span.goal-mark', { 'aria-hidden': 'true' }, done ? '✓' : ''), body);
      if (!done && task.chips && !task.beyond) body.append(h('div.chips', {}, h('button.chip.cmd', { type: 'button', onclick: () => con?.type(task.chips!) }, task.chips)));
      if (!done && task === current) {
        const levels = (['H1', 'H2', 'H3', 'H4', 'H5'] as const).filter((hl) => task.hints?.[hl]);
        const shown = hintsShown.get(task.id) ?? 0;
        const box = h('div.hints');
        levels.slice(0, shown).forEach((hl) => box.append(h('div.hint', {}, h('span.hint-tag', {}, hl), prose(task.hints![hl]!))));
        if (shown < levels.length)
          box.append(h('button.btn.ghost.small', { type: 'button', onclick: () => { hintsShown.set(task.id, shown + 1); ctx?.record({ kind: 'hint.open', task: `${key}/${task.id}`, hint: levels[shown] }); renderGoals(); } }, icon('eye'), `${t(T.hint)} ${shown + 1}/${levels.length}`));
        body.append(box);
      }
      goals.append(li);
    }
  };

  /** Facts for the open goals: the editor area alone when that is all they read. */
  const factsFor = async (m: V86Machine, open: Task[], light: boolean): Promise<Facts> => {
    if (light && lastFull) {
      const area = await m.editorFacts();
      return { ...lastFull, ...area, env: { ...lastFull.env, at: new Date().toISOString() } } as Facts;
    }
    lastFull = await m.facts(open.length ? undefined : ['editor']);
    return lastFull;
  };

  const check = async (light = false) => {
    const m = machine;
    if (!m || m.phase !== 'ready') return;
    if (checking) return void (again = true);
    checking = true;
    try {
      const open = tasks.filter((x) => !passed.has(x.id));
      const facts = await factsFor(m, open, light && open.every(editorOnly));
      drawMode(facts as unknown as EditorArea);
      let changed = false;
      let say: string | null = null;
      for (const task of open) {
        const r = evaluateCheck(task.check, facts, startFacts);
        if (r.pass) {
          passed.add(task.id);
          changed = true;
          ctx?.record({ kind: 'task.pass', task: `${key}/${task.id}`, lesson: ctx.lessonId, hintLevel: hintsShown.get(task.id) ?? 0, docStep: task.docStep ?? 2, docOpened: false, concepts: task.concepts ?? [] });
        } else if (!say && r.say && task === open[0]) say = t(r.say);
      }
      clear(checkLine);
      if (say) checkLine.append(h('p.lab-fail', {}, h('span.st-icon.warn', { 'aria-hidden': 'true' }, '!'), h('span', {}, ...renderInline(say))));
      if (changed) {
        renderGoals();
        void m.persist();
        if (passed.size === tasks.length) {
          checkLine.append(h('p.lab-ok', {}, h('span.st-icon.ok', { 'aria-hidden': 'true' }, '✓'), t(T.allDone)));
          ctx?.complete();
        }
      }
      root.dispatchEvent(new CustomEvent('dt:editor-check', { detail: { passed: [...passed], area: lastArea && { editor: lastArea.editor } } }));
    } catch {
      /* the machine went away mid-check: the next event checks again */
    } finally {
      checking = false;
      if (again) {
        again = false;
        schedule(150, light);
      }
    }
  };

  const schedule = (ms: number, light = false) => {
    clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => void check(light), ms);
  };

  const showPhase = (p: BootPhase, detail?: string) => {
    clear(status);
    if (p === 'ready') return;
    status.append(h('p.v86-phase', { 'data-phase': p }, p === 'error' ? h('span.st-icon.err', { 'aria-hidden': 'true' }, '⨯') : h('span.v86-spinner', { 'aria-hidden': 'true' }), h('span', {}, t(T.phase[p]))));
    if (p === 'error' && detail) status.append(h('p.small.err', {}, detail));
  };

  const start = async () => {
    clear(termBox);
    const [{ V86Machine }, { mountConsole }] = await Promise.all([import('./machine'), import('./console')]);
    if (disposed) return;
    const m = new V86Machine({ profile: 'lab-editors', memoryMB, stateKey: ctx?.lessonId ? `lab-${key}` : undefined, editorWatch: true });
    machine = m;
    m.watchPredicates(tasks.flatMap(predicates));
    // The mode line reads the editor area even when no goal names it.
    if (!tasks.some((x) => editorScopesOf(predicates(x)).length)) m.watchPredicates(['editor.active']);
    m.onPhase(showPhase);
    con = await mountConsole(termBox, m, { rows: props.rows ?? 20, macOptionIsMeta: metaBox.checked });
    m.on((ev) => {
      if (ev.t === 'cmd.done') schedule(150);
      else if (ev.t === 'editor.change') schedule(50, true);
    });
    try {
      const boot = await m.start();
      if (disposed) return m.dispose();
      if (!m.resumed) for (const cmd of props.setup ?? []) await m.exec(cmd);
      startSnap = await m.snapshot();
      startFacts = await m.facts();
      lastFull = startFacts;
      bootLine.textContent = ` · ${t(fmt(T.booted, { s: sec(boot.ms) }))}`;
      resetBtn.removeAttribute('disabled');
      checkBtn.removeAttribute('disabled');
      ctx?.record({ kind: 'x.v86.editor', boot: boot.kind, ms: boot.ms, resumed: m.resumed });
      con.focus();
      void check();
    } catch {
      /* the phase line shows the error */
    }
  };

  checkBtn.addEventListener('click', () => schedule(0));
  resetBtn.addEventListener('click', async () => {
    if (!machine || !startSnap) return;
    resetBtn.setAttribute('disabled', '');
    await machine.restore(startSnap);
    void machine.persist();
    resetBtn.removeAttribute('disabled');
    toast(t(T.resetDone));
  });

  const offer = async () => {
    const manifest = await loadLabManifest();
    if (disposed) return;
    const card = h('div.v86-offer', {}, prose(T.what));
    if (!manifest?.profiles['lab-editors']) card.append(prose(T.missing, 'muted small'));
    else {
      const btn = h('button.btn.primary', { type: 'button' }, icon('play'), t(T.start));
      btn.addEventListener('click', () => void start());
      card.append(h('div.v86-offer-row', {}, btn, h('span.small.muted', {}, t(fmt(T.cost, { mb: formatMB(labDownloadBytes(manifest, 'lab-editors')), ram: memoryMB + 60 })))));
      if (shouldAutostart(props.autostart)) return void start();
    }
    termBox.append(card);
  };

  renderGoals();
  void offer();

  return {
    dispose() {
      disposed = true;
      clearTimeout(checkTimer);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('fullscreenchange', onFullscreen);
      con?.dispose();
      const m = machine;
      if (m) void m.persist().finally(() => m.dispose());
    },
    describe: () => {
      const current = tasks.find((x) => !passed.has(x.id));
      const s = statusLine(lastArea);
      return `${t(T.env)}: ${machine?.phase ?? 'idle'}, ${passed.size}/${tasks.length}${s ? `; ${t(s.text)}` : ''}${current ? ` — ${t(current.prompt)}` : ''}`;
    },
  };
}
