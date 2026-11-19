// "Real Linux in the browser": a mountable lab with one v86 machine, goals
// checked by state after every command (09 §2.5), and honest lines about what
// this machine is and is not. Lessons use it as a widget section:
//
//   { kind: 'widget', id: 'real', widget: 'v86.linux', props: { tasks: [...] } }
//
// The emulator and the images load only when this component starts a machine.

import { evaluateCheck } from '../../core/check';
import { clear, h, icon, toast } from '../../core/dom';
import { bi, fmt, t, type Bi } from '../../core/i18n';
import { prose } from '../../app/common';
import { store } from '../../core/store';
import type { Facts, Mounted, Task, WidgetCtx } from '../../core/types';
import { downloadBytes, formatMB, loadManifest } from './assets';
import type { ConsoleHandle } from './console';
import type { BootPhase, V86Machine } from './machine';
import './v86.css';

export interface RealLinuxProps {
  hostname?: string;
  memoryMB?: number;
  intro?: Bi;
  /** Goals checked on the real machine's facts. */
  tasks?: Task[];
  /** Extra paths to collect facts for (paths in string predicates are found automatically). */
  watch?: string[];
  /** Commands run as root on the service channel before the learner gets the prompt. */
  setup?: string[];
  /** Start without asking. Default: only when the device reports ≥ 4 GB of memory (09 §1.4.7). */
  autostart?: boolean;
  rows?: number;
}

export const T = {
  env: bi('Настоящий Linux · v86', 'Real Linux · v86'),
  what: bi(
    'Это настоящее ядро Linux. Его выполняет эмулятор процессора x86 прямо в этой вкладке: браузер ничего не отправляет на сервер, а машина работает и без сети.',
    'This is a real Linux kernel. An x86 processor emulator runs it right in this tab: the browser sends nothing to a server, and the machine keeps working offline.',
  ),
  noNet: bi(
    'У машины нет выхода в интернет: она видит только сеть лаборатории. Поэтому упражнения работают одинаково у всех.',
    'The machine has no way out to the internet: it sees only the lab network. That is why the exercises behave the same for everyone.',
  ),
  start: bi('Запустить машину', 'Start the machine'),
  cost: bi('≈ {mb} МБ загрузки один раз, ≈ {ram} МБ памяти вкладки', '≈ {mb} MB to download once, ≈ {ram} MB of tab memory'),
  missing: bi(
    'В этой сборке нет файлов настоящей машины. Их скачивает `npm run fetch:v86`.',
    'This build has no files for the real machine. `npm run fetch:v86` downloads them.',
  ),
  phase: {
    download: bi('Скачиваю эмулятор и ядро…', 'Downloading the emulator and the kernel…'),
    boot: bi('Ядро загружается — это его настоящие сообщения', 'The kernel is booting — these are its real messages'),
    setup: bi('Готовлю терминал…', 'Preparing the terminal…'),
    ready: bi('Машина работает', 'The machine is running'),
    error: bi('Машина не запустилась', 'The machine did not start'),
  } as Record<BootPhase, Bi>,
  cold: bi('ядро загрузилось за {s} с', 'the kernel booted in {s} s'),
  restored: bi('восстановлена из сохранённого состояния за {s} с', 'restored from a saved state in {s} s'),
  resumed: bi('продолжаем с того места, где вы остановились ({s} с)', 'continuing where you left off ({s} s)'),
  readyLine: bi('выше — сообщения загрузки ядра; дальше терминал ваш', 'above are the kernel boot messages; from here on the terminal is yours'),
  reset: bi('Сбросить машину', 'Reset the machine'),
  resetDone: bi('Машина возвращена к началу упражнения', 'The machine is back at the start of the exercise'),
  goals: bi('Цели', 'Goals'),
  allDone: bi('Все цели выполнены — на настоящем ядре.', 'All goals are done — on a real kernel.'),
  hint: bi('Подсказка', 'Hint'),
  noHints: bi('Здесь подсказок нет: ищите в документации — `man`, `--help`.', 'No hints here: look it up in the documentation — `man`, `--help`.'),
  checking: bi('Проверяю состояние машины…', 'Checking the state of the machine…'),
};

/** Tab memory to expect: guest RAM plus the emulator, JIT caches and xterm (measured ≈ 3× guest + 60 MB). */
export const tabMemoryMB = (guestMB: number, machines = 1) => machines * (guestMB * 3 + 60);

export function shouldAutostart(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof dm === 'number' && dm >= 4;
}

/** Mount the lab. `ctx` comes from a widget section; without it the lab is standalone. */
export function mountRealLinux(root: HTMLElement, props: RealLinuxProps = {}, ctx?: WidgetCtx): Mounted {
  const tasks = props.tasks ?? [];
  const key = ctx?.lessonId ? `${ctx.lessonId}/${ctx.sectionId ?? 'v86'}` : 'standalone';
  const passed = new Set(tasks.filter((x) => store.state.tasks[`${key}/${x.id}`]).map((x) => x.id));
  const hintsShown = new Map<string, number>();
  let machine: V86Machine | null = null;
  let con: ConsoleHandle | null = null;
  let startSnap: Awaited<ReturnType<V86Machine['snapshot']>> | null = null;
  let startFacts: Facts | undefined;
  let disposed = false;
  let checkTimer = 0;
  let ranCommand = false;

  const status = h('div.v86-status', { 'aria-live': 'polite' });
  const bootLine = h('span.v86-boot.muted.small');
  const resetBtn = h('button.btn.ghost.small', { type: 'button', disabled: true }, icon('repeat'), t(T.reset));
  const termBox = h('div.lab-term-box.v86-term');
  const goals = h('ol.lab-goals');
  const checkLine = h('div.lab-status', { 'aria-live': 'polite' });
  const left = h(
    'div.lab-left',
    {},
    props.intro ? prose(props.intro) : null,
    tasks.length ? h('h4.lab-h', {}, t(T.goals)) : null,
    tasks.length ? goals : null,
    checkLine,
    h('p.v86-honest.small.muted', {}, icon('warn'), h('span', {}, t(T.noNet))),
  );
  const right = h('div.lab-right', {}, h('div.lab-bar', {}, h('span.lab-env.v86-env', {}, icon('bolt'), t(T.env), bootLine), resetBtn), termBox, status);
  const el = h('div.lab.v86-lab', { 'data-tasks': tasks.length ? 'yes' : 'no' }, left, right);
  clear(root);
  root.append(el);

  const renderGoals = () => {
    clear(goals);
    const current = tasks.find((x) => !passed.has(x.id));
    for (const task of tasks) {
      const done = passed.has(task.id);
      const li = h('li.goal', { class: [done ? 'done' : '', task === current ? 'current' : ''].filter(Boolean).join(' ') });
      const body = h('div.goal-body', {}, prose(task.prompt, 'goal-text'));
      li.append(h('span.goal-mark', { 'aria-hidden': 'true' }, done ? '✓' : ''), body);
      if (!done && task.chips && !task.beyond) {
        body.append(h('div.chips', {}, ...task.chips.split(/\s+/).map((w) => h('button.chip.cmd', { type: 'button', onclick: () => con?.type(task.chips!) }, w))));
      }
      if (!done && task === current) {
        const levels = (['H1', 'H2', 'H3', 'H4', 'H5'] as const).filter((hl) => task.hints?.[hl] && !(task.beyond && hl !== 'H1'));
        const shown = hintsShown.get(task.id) ?? 0;
        const box = h('div.hints');
        levels.slice(0, shown).forEach((hl) => box.append(h('div.hint', {}, h('span.hint-tag', {}, hl), prose(task.hints![hl]!))));
        if (shown < levels.length)
          box.append(
            h(
              'button.btn.ghost.small',
              {
                type: 'button',
                onclick: () => {
                  hintsShown.set(task.id, shown + 1);
                  ctx?.record({ kind: 'hint.open', task: `${key}/${task.id}`, hint: levels[shown] });
                  renderGoals();
                },
              },
              icon('eye'),
              `${t(T.hint)} ${shown + 1}/${levels.length}`,
            ),
          );
        else if (!levels.length) box.append(prose(T.noHints, 'muted small'));
        body.append(box);
      }
      goals.append(li);
    }
  };

  const finish = () => ctx?.complete();

  const check = async () => {
    if (!machine || machine.phase !== 'ready') return;
    if (!tasks.length) {
      if (ranCommand) finish();
      return;
    }
    if (passed.size === tasks.length) return;
    const facts = await machine.facts();
    let changed = false;
    let say: string | null = null;
    for (const task of tasks) {
      if (passed.has(task.id)) continue;
      const r = evaluateCheck(task.check, facts, startFacts);
      if (r.pass) {
        passed.add(task.id);
        changed = true;
        ctx?.record({ kind: 'task.pass', task: `${key}/${task.id}`, lesson: ctx.lessonId, hintLevel: hintsShown.get(task.id) ?? 0, docStep: task.docStep ?? 2, docOpened: false, concepts: task.concepts ?? [] });
      } else if (!say && r.say && task === tasks.find((x) => !passed.has(x.id))) say = t(r.say);
    }
    clear(checkLine);
    if (say) checkLine.append(h('p.lab-fail', {}, h('span.st-icon.warn', { 'aria-hidden': 'true' }, '!'), say));
    if (changed) {
      renderGoals();
      void machine.persist();
      if (passed.size === tasks.length) {
        checkLine.append(h('p.lab-ok', {}, h('span.st-icon.ok', { 'aria-hidden': 'true' }, '✓'), t(T.allDone)));
        finish();
      }
    }
  };

  const showPhase = (p: BootPhase, detail?: string) => {
    clear(status);
    if (p === 'ready') return;
    const line = h('p.v86-phase', { 'data-phase': p }, p === 'error' ? h('span.st-icon.err', { 'aria-hidden': 'true' }, '⨯') : h('span.v86-spinner', { 'aria-hidden': 'true' }), h('span', {}, t(T.phase[p])));
    status.append(line);
    if (p === 'download' && detail) {
      const m = /(\d+)\/(\d+)$/.exec(detail);
      if (m && Number(m[2]) > 0) status.append(h('progress.v86-progress', { max: Number(m[2]), value: Number(m[1]) }));
    }
    if (p === 'error' && detail) status.append(h('p.small.err', {}, detail));
  };

  const start = async () => {
    clear(termBox);
    const [{ V86Machine }, { mountConsole }] = await Promise.all([import('./machine'), import('./console')]);
    if (disposed) return;
    const m = new V86Machine({ identity: { hostname: props.hostname ?? 'linux' }, memoryMB: props.memoryMB, stateKey: ctx?.lessonId ? `lab-${key}` : undefined, watch: props.watch, bootBanner: `\r\n\x1b[2m── ${t(T.readyLine)} ──\x1b[0m` });
    machine = m;
    m.watchPredicates(tasks.flatMap((x) => [typeof x.check.when === 'string' ? x.check.when : undefined, ...(x.check.fail ?? []).map((f) => (typeof f.if === 'string' ? f.if : undefined))]));
    m.onPhase(showPhase);
    con = await mountConsole(termBox, m, { rows: props.rows ?? 16 });
    m.on((ev) => {
      if (ev.t !== 'cmd.done') return;
      ranCommand = true;
      clearTimeout(checkTimer);
      checkTimer = window.setTimeout(() => void check(), 150);
    });
    try {
      const boot = await m.start();
      if (disposed) return m.dispose();
      if (!m.resumed) for (const cmd of props.setup ?? []) await m.exec(cmd);
      startSnap = await m.snapshot();
      startFacts = await m.facts();
      const s = (boot.ms / 1000).toFixed(1).replace('.', t(bi(',', '.')));
      bootLine.textContent = ` · ${t(fmt(m.resumed ? T.resumed : boot.kind === 'cold' ? T.cold : T.restored, { s }))}`;
      resetBtn.removeAttribute('disabled');
      ctx?.record({ kind: 'x.v86.boot', boot: boot.kind, ms: boot.ms, resumed: m.resumed });
      con.focus();
      void check();
    } catch {
      /* the phase line shows the error */
    }
  };

  resetBtn.addEventListener('click', async () => {
    if (!machine || !startSnap) return;
    resetBtn.setAttribute('disabled', '');
    await machine.restore(startSnap);
    void machine.persist();
    resetBtn.removeAttribute('disabled');
    toast(t(T.resetDone));
  });

  const offer = async () => {
    const manifest = await loadManifest();
    if (disposed) return;
    clear(termBox);
    const card = h('div.v86-offer', {}, prose(T.what));
    if (!manifest) card.append(prose(T.missing, 'muted small'));
    else {
      const mb = formatMB(downloadBytes(manifest));
      const btn = h('button.btn.primary', { type: 'button' }, icon('play'), t(T.start));
      btn.addEventListener('click', () => void start());
      card.append(h('div.v86-offer-row', {}, btn, h('span.small.muted', {}, t(fmt(T.cost, { mb, ram: tabMemoryMB(props.memoryMB ?? 32) })))));
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
      con?.dispose();
      const m = machine;
      if (m) void m.persist().finally(() => m.dispose());
    },
    describe: () => {
      const current = tasks.find((x) => !passed.has(x.id));
      return `${t(T.env)}: ${machine?.phase ?? 'idle'}${tasks.length ? `, ${passed.size}/${tasks.length}` : ''}${current ? ` — ${t(current.prompt)}` : ''}`;
    },
  };
}
