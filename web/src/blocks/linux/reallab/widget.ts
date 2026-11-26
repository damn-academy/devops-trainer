// The widget `linux.lab`: a lesson or a training exam on several real Alpine
// machines in this tab (engine/v86 V86Lab on dt-switch). One terminal per
// machine behind tabs, goals judged by state on the facts of the machine they
// name (plus the lab's probes), hints and command chips by the documentation
// ladder, the learner's machines saved in OPFS so a return continues the work.
// In exam mode there are no hints or chips, a soft timer runs and "Finish"
// gives the weighted score.
//
// Loaded on first mount only (index.ts wraps it in lazyWidget).

import { deadline } from '../../../engine/v86/deadline';
import { evaluateCheck } from '../../../core/check';
import { clear, h, icon, toast } from '../../../core/dom';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import { renderInline } from '../../../core/markdown';
import { prose } from '../../../app/common';
import { store } from '../../../core/store';
import type { Facts, Mounted, WidgetCtx } from '../../../core/types';
import { formatMB, labDownloadBytes, loadLabManifest } from '../../../engine/v86/assets';
import { shouldAutostart } from '../../../engine/v86/component';
import type { ConsoleHandle } from '../../../engine/v86/console';
import { labCapacity, type V86Lab } from '../../../engine/v86/lab';
import type { V86Machine } from '../../../engine/v86/machine';
import '../../../engine/v86/v86.css';
import './reallab.css';
import { goalFacts, goalMachine, goalPredicates, labMemoryMB, labScore, probeOnly, type LabGoal, type RealLabProps } from './spec';

const T = {
  env: bi('Настоящий Alpine Linux в этой вкладке', 'Real Alpine Linux in this tab'),
  what: bi(
    'Здесь работают несколько настоящих машин с Alpine Linux, и у каждой из них своё ядро, свой диск и свой адрес в общей сети `10.0.0.0/24`. Машины выполняет эмулятор процессора в самой вкладке браузера, и выйти наружу они не могут.',
    'Here are several real machines with Alpine Linux: each has its own kernel, its own disk and its own address in the shared network `10.0.0.0/24`. A processor emulator runs them right in the tab; they have no way out.',
  ),
  start: bi('Запустить машины', 'Start the machines'),
  cost: bi('Один раз загрузится около {mb} МБ, а вкладка займёт около {ram} МБ памяти', '≈ {mb} MB to download once, ≈ {ram} MB of tab memory'),
  tight: bi(
    'Этому устройству может не хватить памяти: машин в лаборатории {n}, а памяти, по оценке браузера, хватает на {cap}. Запустить их можно, но вкладка может закрыться, а на ноутбуке с 8 ГБ памяти всё работает без затруднений.',
    'This device is tight: there are {n} machines, and the browser’s estimate of memory is enough for {cap}. You can start them, but the tab may close; on a laptop with 8 GB everything runs calmly.',
  ),
  missing: bi('Файл с системой для машин недоступен, поэтому лаборатория не запустилась. Перезагрузите страницу, чтобы повторить загрузку. Если вы открыли курс без интернета через `dtlab serve`, машинам во вкладке нужен отдельный пакет: выполните `dtlab course install v86` (около 325 МБ) и перезагрузите страницу. В остальных случаях, если сообщение осталось, нажмите «Сообщить о проблеме». Подготовить машины на своём компьютере можно по [инструкции по установке dtlab](#/local-lab).', 'The machine system image is unavailable, so the lab has not started. Reload this page to retry. If you opened the course offline with `dtlab serve`, the in-tab machines need a separate package: run `dtlab course install v86` (about 325 MB) and reload the page. Otherwise, if the message remains, press “Report a problem”. To prepare machines on your computer, follow [the dtlab setup guide](#/local-lab).'),
  booting: bi('Машина {name} загружается…', '{name}: booting…'),
  setup: bi('Машины готовятся к работе…', 'The machines are getting ready…'),
  ready: bi('Работают машины {list}', 'The machines are running: {list}'),
  cold: bi('первая загрузка заняла {s} с', 'the first boot took {s} s'),
  restored: bi('запуск из снимка занял {s} с', 'starting from a snapshot took {s} s'),
  error: bi('Машины не запустились', 'The machines did not start'),
  goals: bi('Цели упражнения', 'Goals of the exercise'),
  on: bi('на машине {m}', 'on machine {m}'),
  hint: bi('Подсказка', 'Hint'),
  noHints: bi('Подсказок здесь нет, поэтому ищите ответ в документации машины, то есть в `man` и `--help`.', 'There are no hints here, so look for the answer in the machine’s documentation, that is, in `man` and `--help`.'),
  allDone: bi('Все цели выполнены, и выполнены они на настоящих машинах.', 'All goals are done, and done on real machines.'),
  check: bi('Проверить', 'Check'),
  reset: bi('Сбросить машины', 'Reset the machines'),
  resetDone: bi('Машины возвращены к началу упражнения', 'The machines are back at the start of the exercise'),
  resetDisk: bi(
    'Машина {m} уже загрузилась со своего диска, и вернуть её прежнее состояние нельзя. Чтобы начать установку заново, удалите сохранённые машины в настройках.',
    'Machine {m} has already booted from its own disk: it has no earlier state to go back to. To start the installation again, delete the saved machines in the settings.',
  ),
  timer: bi('Прошло {m} мин из {total} мин', '{m} of {total} min passed'),
  finish: bi('Завершить и посчитать результат', 'Finish and score'),
  result: bi('Результат составляет {p} %. {verdict}', 'Result: {p}%. {verdict}'),
  passed: bi('Проходной порог достигнут.', 'The pass mark is reached.'),
  failed: bi('Проходной порог не достигнут.', 'The pass mark is not reached.'),
  criticalMissed: bi('Обязательная цель не выполнена, поэтому экзамен не засчитан, каким бы ни был счёт.', 'A required goal is not done, so the exam does not count, whatever the score.'),
  critical: bi('обязательная цель', 'required goal'),
};

const sec = (ms: number) => (ms / 1000).toFixed(1).replace('.', t(bi(',', '.')));

export function mountRealLab(root: HTMLElement, raw: unknown, ctx?: WidgetCtx): Mounted {
  const props = raw as RealLabProps;
  const exam = props.mode === 'exam';
  const tasks = props.tasks;
  const key = ctx?.lessonId ? `${ctx.lessonId}/${ctx.sectionId ?? 'lab'}` : `page/${props.examId ?? props.machines.map((m) => m.name).join('-')}`;
  const passed = new Set(exam ? [] : tasks.filter((x) => store.state.tasks[`${key}/${x.id}`]).map((x) => x.id));
  const hintsShown = new Map<string, number>();
  const consoles = new Map<string, ConsoleHandle>();
  const boxes = new Map<string, HTMLElement>();
  const tabs = new Map<string, HTMLElement>();
  const startSnaps = new Map<string, Awaited<ReturnType<V86Machine['snapshot']>>>();
  const startFacts = new Map<string, Facts>();
  let lab: V86Lab | null = null;
  let ready = false;
  let disposed = false;
  let finished = false;
  let checkTimer = 0;
  let checking = false;
  let again = false;
  let active = props.machines[0].name;
  const t0 = Date.now();

  const status = h('div.v86-status', { 'aria-live': 'polite' });
  const bootLine = h('span.v86-boot.muted.small');
  const resetBtn = h('button.btn.ghost.small', { type: 'button', disabled: true }, icon('repeat'), t(T.reset));
  const checkBtn = h('button.btn.ghost.small', { type: 'button', disabled: true }, icon('check'), t(T.check));
  const tabBar = h('div.rl-tabs', { role: 'tablist' });
  const termArea = h('div.rl-terms');
  const goals = h('ol.lab-goals');
  const checkLine = h('div.lab-status', { 'aria-live': 'polite' });
  const timerLine = h('p.small.muted.rl-timer');
  const finishBtn = h('button.btn.primary.small', { type: 'button', disabled: true }, icon('check'), t(T.finish));
  const left = h(
    'div.lab-left',
    {},
    props.intro ? prose(props.intro) : null,
    prose(bi('Запустите лабораторию кнопкой под терминалом. После подготовки выберите вкладку машины, указанной в цели, и вводите команды в её терминале на этой странице. Проверка состояния идёт автоматически; кнопка «Проверить» запускает её ещё раз. Зелёная галочка у цели означает, что цель выполнена.', 'Start the lab using the button below the terminal. Once setup finishes, select the machine named in the goal and enter commands in its terminal on this page. State checks run automatically; “Check” runs them again. A green check mark means the goal is complete.'), 'task-guide'),
    h('h4.lab-h', {}, t(T.goals)),
    goals,
    checkLine,
    exam ? h('div.rl-exam', {}, timerLine, finishBtn) : null,
  );
  const right = h('div.lab-right', {}, h('div.lab-bar', {}, h('span.lab-env.v86-env', {}, icon('bolt'), t(T.env), bootLine), h('span.rl-actions', {}, checkBtn, resetBtn)), tabBar, termArea, status);
  root.replaceChildren(h('div.lab.v86-lab.rl-lab', {}, left, right));

  for (const m of props.machines) {
    const box = h('div.lab-term-box.v86-term.rl-term', { 'data-machine': m.name, hidden: m.name !== active });
    boxes.set(m.name, box);
    termArea.append(box);
    const tab = h('button.rl-tab', { type: 'button', role: 'tab', 'aria-selected': String(m.name === active), onclick: () => show(m.name) }, h('code', {}, m.name), h('span.small.muted', {}, ` · ${t(m.role)}`));
    tabs.set(m.name, tab);
    tabBar.append(tab);
  }

  function show(name: string) {
    active = name;
    for (const [n, b] of boxes) b.hidden = n !== name;
    for (const [n, tb] of tabs) tb.setAttribute('aria-selected', String(n === name));
    consoles.get(name)?.focus();
  }

  const renderGoals = () => {
    clear(goals);
    const current = tasks.find((x) => !passed.has(x.id));
    for (const task of tasks) {
      const done = passed.has(task.id);
      const on = goalMachine(props, task);
      const li = h('li.goal', { class: [done ? 'done' : '', task === current && !exam ? 'current' : ''].filter(Boolean).join(' '), 'data-task': task.id });
      const tag = h('span.rl-on.small', {}, t(fmt(T.on, { m: on })), task.critical && exam ? h('span.rl-crit', {}, ` · ${t(T.critical)}`) : null);
      const body = h('div.goal-body', {}, tag, prose(task.prompt, 'goal-text'));
      li.append(h('span.goal-mark', { 'aria-hidden': 'true' }, done ? '✓' : ''), body);
      if (!exam && !done && task.chips && !task.beyond) {
        body.append(h('div.chips', {}, h('button.chip.cmd', { type: 'button', onclick: () => (show(on), consoles.get(on)?.type(task.chips!)) }, task.chips)));
      }
      if (!exam && !done && task.docRef && ctx) {
        const label = task.docRef.label ?? [task.docRef.page?.replace(/^man\//, ''), task.docRef.anchor].filter(Boolean).join(' · ');
        if (label) body.append(h('button.chip.doc', { type: 'button', onclick: () => ctx.openDoc(task.docRef!) }, icon('book'), label));
      }
      if (!exam && !done && task === current) {
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

  const factsOf = (name: string, pending: LabGoal[]) => goalFacts(props, name, lab!.machine(name), pending);

  const check = async () => {
    if (!lab || !ready || finished) return;
    if (checking) return void (again = true);
    checking = true;
    try {
      // A lesson judges the current goal and the later ones that need only probes: the machine's
      // general facts cost seconds in emulation, so other goals wait until they are current.
      const open = tasks.filter((x) => !passed.has(x.id));
      const pending = exam ? open : open.filter((g, i) => i === 0 || probeOnly(props, g));
      if (!pending.length) return;
      const byMachine = new Map<string, LabGoal[]>();
      for (const g of pending) byMachine.set(goalMachine(props, g), [...(byMachine.get(goalMachine(props, g)) ?? []), g]);
      let changed = false;
      let say: string | null = null;
      const current = pending[0];
      for (const [name, gs] of byMachine) {
        const facts = await factsOf(name, gs);
        for (const task of gs) {
          const r = evaluateCheck(task.check, facts, startFacts.get(name));
          if (r.pass) {
            passed.add(task.id);
            changed = true;
            if (!exam) ctx?.record({ kind: 'task.pass', task: `${key}/${task.id}`, lesson: ctx.lessonId, hintLevel: hintsShown.get(task.id) ?? 0, docStep: task.docStep ?? 2, docOpened: false, concepts: task.concepts ?? [] });
          } else if (!exam && !say && r.say && task === current) say = t(r.say);
        }
      }
      clear(checkLine);
      if (say) checkLine.append(h('p.lab-fail', {}, h('span.st-icon.warn', { 'aria-hidden': 'true' }, '!'), h('span', {}, ...renderInline(say))));
      if (changed) {
        renderGoals();
        void lab.persist();
        if (passed.size === tasks.length && !exam) {
          checkLine.append(h('p.lab-ok', {}, h('span.st-icon.ok', { 'aria-hidden': 'true' }, '✓'), t(T.allDone)));
          ctx?.complete();
        }
      }
    } catch {
      /* a machine went away mid-check (reboot): the next event checks again */
    } finally {
      checking = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  };

  const schedule = (ms = 250) => {
    clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => void check(), ms);
  };

  const finish = () => {
    if (finished) return;
    void check().then(() => {
      finished = true;
      const r = labScore(tasks, passed, props.pass ?? 0.7);
      const verdict = !r.critical ? T.criticalMissed : r.passed ? T.passed : T.failed;
      clear(checkLine);
      checkLine.append(h(r.passed ? 'p.lab-ok' : 'p.lab-fail', {}, t(fmt(T.result, { p: Math.round(r.score * 100), verdict: t(verdict) }))));
      ctx?.record({ kind: 'x.linux.lab-exam', exam: props.examId ?? key, score: r.score, passed: r.passed, minutes: Math.round((Date.now() - t0) / 60000) });
      finishBtn.setAttribute('disabled', '');
      ctx?.complete();
    });
  };
  finishBtn.addEventListener('click', finish);
  if (exam && props.minutes) {
    const tick = () => {
      if (disposed) return;
      timerLine.textContent = t(fmt(T.timer, { m: Math.floor((Date.now() - t0) / 60000), total: props.minutes! }));
      setTimeout(tick, 15_000);
    };
    tick();
  }

  const start = async () => {
    clear(status);
    status.append(h('p.v86-phase', {}, h('span.v86-spinner', { 'aria-hidden': 'true' }), h('span', {}, t(fmt(T.booting, { name: props.machines[0].name })))));
    const [{ V86Lab }, { mountConsole }] = await Promise.all([import('../../../engine/v86/lab'), import('../../../engine/v86/console')]);
    if (disposed) return;
    const l = new V86Lab({
      nodes: props.machines.map((m, i) => ({
        name: m.name,
        profile: m.profile ?? 'lab-node',
        ip: m.ip ?? `10.0.0.${11 + i}/24`,
        memoryMB: m.memoryMB,
        disks: m.disks,
        stateKey: exam ? undefined : `lab-${key}-${m.name}`,
      })),
    });
    lab = l;
    // Attach a console as soon as each machine exists, so its kernel log shows while it boots.
    const attach = async (name: string) => {
      if (consoles.has(name) || !l.nodes.has(name)) return;
      const m = l.machine(name);
      consoles.set(name, null as unknown as ConsoleHandle);
      m.watchPredicates(tasks.filter((g) => goalMachine(props, g) === name).flatMap(goalPredicates));
      for (const g of tasks) if (goalMachine(props, g) === name) m.watchPaths((props.watch?.[g.id] ?? []).filter((w) => w.startsWith('/')));
      m.on((ev) => {
        if (ev.t === 'cmd.done' || ev.t === 'machine.reboot') schedule(ev.t === 'machine.reboot' ? 3000 : exam ? 1500 : 250);
      });
      m.onOutput((text) => {
        if (/login:\s*$/.test(text) && m.bootFrom === 'disk') schedule(500);
      });
      consoles.set(name, await mountConsole(boxes.get(name)!, m, { rows: props.rows ?? 18, inputReady: () => ready }));
    };
    const poll = window.setInterval(() => props.machines.forEach((m) => void attach(m.name)), 80);
    try {
      const boots = await deadline(l.start((name) => {
        void attach(name);
        const next = props.machines[props.machines.findIndex((m) => m.name === name) + 1];
        if (next) {
          clear(status);
          status.append(h('p.v86-phase', {}, h('span.v86-spinner', { 'aria-hidden': 'true' }), h('span', {}, t(fmt(T.booting, { name: next.name })))));
        }
      }), 180_000, t(bi('Машины не загрузились за три минуты. Перезагрузите страницу и повторите запуск.', 'The machines did not boot within three minutes. Reload the page and try again.')));
      window.clearInterval(poll);
      await Promise.all(props.machines.map((m) => attach(m.name)));
      if (disposed) return l.dispose();
      clear(status);
      status.append(h('p.v86-phase', {}, h('span.v86-spinner', { 'aria-hidden': 'true' }), h('span', {}, t(T.setup))));
      status.append(h('p', {}, t(bi('Терминалы начнут принимать команды, когда подготовка всех машин завершится.', 'Terminals will accept commands once all machines are prepared.'))));
      await Promise.all(props.machines.map(async m => {
        const progress = h('p', { 'data-machine': m.name });
        status.append(progress);
        const mm = l.machine(m.name);
        const bounded = <T>(operation: Promise<T>) => deadline(operation, 90_000, t(bi(`Подготовка машины ${m.name} заняла больше 90 секунд. Перезагрузите страницу и повторите запуск.`, `Preparing ${m.name} exceeded 90 seconds. Reload and try again.`)));
        if (!mm.resumed) for (const [i, cmd] of (m.setup ?? []).entries()) {
          progress.textContent = t(bi(`Машина ${m.name} выполняет команду подготовки ${i + 1} из ${m.setup!.length}.`, `${m.name} is running setup command ${i + 1} of ${m.setup!.length}.`));
          await bounded(l.exec(m.name, cmd));
        }
        if (mm.bootFrom === 'image') {
          progress.textContent = t(bi(`Для машины ${m.name} сохраняется начальное состояние.`, `Saving the initial state of ${m.name}.`));
          startSnaps.set(m.name, await bounded(mm.snapshot()));
          startFacts.set(m.name, await bounded(mm.facts()));
        }
        progress.textContent = t(bi(`Машина ${m.name} готова к работе.`, `${m.name} is ready.`));
      }));
      const first = boots[props.machines[0].name];
      clear(status);
      bootLine.textContent = first ? ` · ${t(fmt(first.kind === 'cold' ? T.cold : T.restored, { s: sec(first.ms) }))}` : '';
      status.append(h('p.small.muted', {}, t(fmt(T.ready, { list: props.machines.map((m) => `${m.name} ${m.ip ?? `10.0.0.${11 + props.machines.indexOf(m)}`}`.replace(/\/\d+$/, '')).join(', ') }))));
      ready = true;
      resetBtn.removeAttribute('disabled');
      checkBtn.removeAttribute('disabled');
      finishBtn.removeAttribute('disabled');
      ctx?.record({ kind: 'x.v86.lab', machines: props.machines.length, boot: first?.kind, ms: first?.ms });
      consoles.get(active)?.focus();
      schedule(0);
    } catch (e) {
      ready = false;
      l.dispose();
      window.clearInterval(poll);
      clear(status);
      status.append(h('p.v86-phase', { 'data-phase': 'error' }, h('span.st-icon.err', { 'aria-hidden': 'true' }, '⨯'), h('span', {}, t(T.error))), h('p.small.err', {}, (e as Error).message));
    }
  };

  checkBtn.addEventListener('click', () => schedule(0));
  resetBtn.addEventListener('click', async () => {
    if (!lab) return;
    resetBtn.setAttribute('disabled', '');
    for (const m of props.machines) {
      const mm = lab.machine(m.name);
      const snap = startSnaps.get(m.name);
      if (mm.bootFrom === 'disk' || !snap) toast(t(fmt(T.resetDisk, { m: m.name })));
      else await mm.restore(snap);
    }
    void lab.persist();
    resetBtn.removeAttribute('disabled');
    toast(t(T.resetDone));
  });

  const offer = async () => {
    const manifest = await loadLabManifest();
    if (disposed) return;
    const box = boxes.get(active)!;
    const card = h('div.v86-offer', {}, prose(T.what));
    if (!manifest) card.append(prose(T.missing, 'muted small'));
    else {
      const profiles = [...new Set(props.machines.map((m) => m.profile ?? 'lab-node'))];
      const mb = formatMB(profiles.reduce((n, p) => n + labDownloadBytes(manifest, p), 0));
      const btn = h('button.btn.primary', { type: 'button' }, icon('play'), t(T.start));
      btn.addEventListener('click', () => {
        card.remove();
        void start();
      });
      card.append(h('div.v86-offer-row', {}, btn, h('span.small.muted', {}, t(fmt(T.cost, { mb, ram: labMemoryMB(props) })))));
      const cap = labCapacity((navigator as Navigator & { deviceMemory?: number }).deviceMemory);
      if (cap < props.machines.length) card.append(prose(fmt(T.tight, { n: props.machines.length, cap }), 'small muted'));
      else if (shouldAutostart(props.autostart)) return void start();
    }
    box.append(card);
  };

  renderGoals();
  void offer();

  return {
    dispose() {
      disposed = true;
      clearTimeout(checkTimer);
      for (const c of consoles.values()) c?.dispose();
      const l = lab;
      if (l) void l.persist().finally(() => l.dispose());
    },
    describe: () => {
      const current = tasks.find((x) => !passed.has(x.id));
      return `${t(T.env)}: ${ready ? 'ready' : 'idle'}, ${passed.size}/${tasks.length}${current ? ` — ${t(current.prompt)} (${goalMachine(props, current)})` : ''}`;
    },
  };
}

export type { Bi };
