import { lessonGoalSources } from '../engine/terminal/goal-sources';
import { registerFeedbackSnapshot } from '../engine/feedback/data';
import { snapshotForFeedback } from '../engine/terminal/feedback';
// A lab: terminal on a simulated machine with goals checked by state after
// every command (09 §2.5). Hints follow the documentation ladder: DL1–2 full
// command chips and a page fragment as H3, DL3 only the page link and the
// command name, DL4 nothing but "where have you looked?".

import { evaluateCheck } from '../core/check';
import { clear, h, icon, toast } from '../core/dom';
import { bi, fmt, t, UI, type Bi } from '../core/i18n';
import { renderInline } from '../core/markdown';
import { store } from '../core/store';
import type { BlockId, DocStep, Facts, HintLevel, Level, Mounted, Task, TerminalSetup } from '../core/types';
import { refLabel, sourceOf } from '../engine/docs/corpus';
import { effectiveStep, hintPolicy, shouldRecord } from '../engine/docs/ladder';
import { docChip, docFragment, openDoc } from '../engine/docs/viewer';
import { createSimMachine, type SimMachine } from '../engine/terminal/shell';
import { mountTerminal, type TerminalHandle } from '../engine/terminal/widget';
import { prose } from './common';
import { externalButton } from '../engine/ai/external-panel';
import { askBox } from './mentor';

export interface LabOptions {
  /** Storage key of this lab: lesson id + section id. */
  key: string;
  setup: TerminalSetup;
  tasks: Task[];
  intro?: Bi;
  level: Level;
  block?: BlockId;
  lessonId?: string;
  /** Position of the lesson in its block, for the ladder schedule. */
  index: number;
  count: number;
  /** Exam mode: DL5, no hints, no mentor. */
  exam?: boolean;
  lessonStep?: DocStep;
  /** Show how the terminal's goals are checked (default); an exam shows it above its first terminal only. */
  guide?: boolean;
  /** Keep goals hidden until checked (placement). */
  quietGoals?: boolean;
  onAllDone?(): void;
  onTaskPass?(task: Task): void;
}

const TL = {
  sim: bi('в симуляторе', 'in the simulator'),
  passed: bi('Готово', 'Done'),
  nextHint: bi('Подсказка', 'Hint'),
  noHints: bi('На этой ступени подсказок нет: ищите в документации.', 'No hints on this step: look it up in the documentation.'),
  page: bi('Страница', 'Page'),
  step: bi('Документация', 'Documentation'),
  resetDone: bi('Машина возвращена к началу экрана', 'The machine is back at the start of this screen'),
  loading: bi('Запускаю машину…', 'Starting the machine…'),
  chips: bi('Команда', 'Command'),
};

export function mountLab(root: HTMLElement, o: LabOptions): Mounted {
  let machine: SimMachine | null = null;
  let term: TerminalHandle | null = null;
  let startSnap: unknown = null;
  let startFacts: Facts | undefined;
  const mountedAt = new Date().toISOString();
  const taskKey = (task: Task) => `${o.key}/${task.id}`;
  const passed = new Set(o.tasks.filter((x) => store.state.tasks[taskKey(x)]).map((x) => x.id));
  const hintsOpened = new Map<string, number>();
  let disposed = false;
  const sourceKey = typeof o.setup.ext?.goalSource === 'string' ? o.setup.ext.goalSource : undefined;
  let unregisterSource: (() => void) | undefined;
  let unsubscribeSource: (() => void) | undefined;

  const goals = h('ol.lab-goals');
  // Why number 1 is lit and 2 is not: tasks run in order, the caption says which one is now.
  const progress = h('p.small.muted.lab-progress', { 'aria-live': 'polite' });
  const termBox = h('div.lab-term-box');
  const status = h('div.lab-status', { 'aria-live': 'polite' });
  const expandBtn = h('button.btn.ghost.small', { type: 'button', 'aria-pressed': 'false' }, t(bi('Расширить терминал', 'Expand terminal')));
  const resetBtn = h('button.btn.ghost.small', { type: 'button' }, icon('repeat'), t(UI.reset));
  const el = h(
    'div.lab',
    { 'data-exam': o.exam ? 'true' : undefined },
    h('div.lab-left', {}, o.intro ? prose(o.intro) : null, o.guide === false ? null : prose(sourceKey ? bi('Выполняйте цели в связанном терминале этого урока. Проверка получает состояние той машины после каждой команды; выполненная цель отмечается зелёной галочкой.', 'Complete the goals in the linked terminal in this lesson. Its machine state is checked after each command; a completed goal gets a green check mark.') : o.exam
      ? bi('Выполняйте цели в терминале этой задачи: наберите команду и нажмите Enter. После каждой команды тренажёр проверяет состояние машины и отмечает выполненные цели зелёной галочкой.', 'Complete the goals in this task’s terminal: type a command and press Enter. After every command the trainer checks the machine state and marks completed goals with a green check mark.')
      : bi('Выполняйте цели в терминале этого упражнения. Наберите команду и нажмите Enter. После каждой команды тренажёр проверяет состояние машины и отмечает выполненные цели зелёной галочкой. Когда все цели выполнены, появится «Все цели выполнены».', 'Complete the goals in this exercise’s terminal. Type a command and press Enter. After every command the trainer checks the machine state and marks completed goals with a green check mark. When all goals pass, “All goals are done” appears.'), 'task-guide'), h('h4.lab-h', {}, t(UI.goals)), progress, goals, status),
    h('div.lab-right', {}, h('div.lab-bar', {}, h('span.lab-env', {}, icon('term'), t(TL.sim)), expandBtn, resetBtn), termBox),
  );
  clear(root);
  root.append(el);

  el.dataset.feedbackLab = o.key;
  const unregisterFeedback = registerFeedbackSnapshot(el, async () => ({
    key: o.key, level: o.level,
    ...(machine ? await snapshotForFeedback(machine, startSnap) : { unavailable: 'Machine is starting' }),
    goals: o.tasks.map(task => ({ id: task.id, prompt: t(task.prompt), check: task.check,
      result: !sourceKey && machine ? evaluateCheck(task.check, machine.factsSync(), startFacts) : null })),
  }));

  const stepFor = (task: Task): DocStep => {
    const source = task.docRef ? sourceOf(task.docRef) : 'man';
    const stored = store.state.docLadder[source];
    const base = { level: o.level, block: o.block ?? '', index: o.index, count: o.count, stored, exam: o.exam, lessonStep: o.lessonStep };
    // The schedule moves the learner's step for the source; a task's own docStep (forcing) applies to that task only.
    const scheduled = effectiveStep(base);
    if (!o.exam && o.block && scheduled < 5 && shouldRecord(scheduled, stored, o.block)) store.record({ kind: 'doc.step', source, step: scheduled, block: o.block });
    return effectiveStep({ ...base, override: task.docStep });
  };

  const renderGoals = () => {
    clear(goals);
    const current = o.tasks.find((x) => !passed.has(x.id));
    const idx = current ? o.tasks.indexOf(current) + 1 : o.tasks.length;
    // With one task there is no order to tell.
    progress.hidden = o.tasks.length === 1 && !!current;
    progress.textContent = current
      ? t(fmt(bi('Выполняются по очереди сверху вниз: сейчас задание {i} из {n}.', 'They run in order, top to bottom: now task {i} of {n}.'), { i: String(idx), n: String(o.tasks.length) }))
      : t(bi('Все задания выполнены.', 'All tasks are done.'));
    for (const [i, task] of o.tasks.entries()) {
      const done = passed.has(task.id);
      const step = stepFor(task);
      const pol = hintPolicy(step);
      const li = h('li.goal', { class: [done ? 'done' : '', task === current ? 'current' : ''].filter(Boolean).join(' '), 'data-task': task.id, 'data-doc-step': step });
      li.append(h('span.goal-mark', { 'aria-hidden': 'true' }, done ? '✓' : String(i + 1)), h('div.goal-body', {}, prose(task.prompt, 'goal-text')));
      const body = li.querySelector('.goal-body')!;
      if (done) {
        body.append(h('span.sr-only', {}, t(TL.passed)));
        goals.append(li);
        continue;
      }
      const meta = h('div.goal-meta');
      if (task.docRef && pol.docref) meta.append(docChip({ ...task.docRef, gloss: task.docRef.gloss ?? task.hints?.H3 ?? task.hints?.H2 }));
      if (task.docRef && step === 3) meta.append(h('button.docref', { type: 'button', onclick: () => openDoc({ page: task.docRef!.page, url: task.docRef!.url }, { mode: 'page', via: 'docref' }) }, icon('doc'), h('span', {}, `${t(TL.page)}: ${refLabel({ page: task.docRef.page, url: task.docRef.url })}`)));
      body.append(meta);
      if (task.chips && pol.chips !== 'none' && !o.exam) {
        const words = pol.chips === 'name' ? [task.chips.split(/\s+/)[0]] : [task.chips];
        body.append(
          h(
            'div.chips',
            { 'aria-label': t(TL.chips) },
            ...words.map((w) => h('button.chip.cmd', { type: 'button', onclick: () => term?.type(pol.chips === 'name' ? w + ' ' : task.chips!) }, w)),
          ),
        );
      }
      if (task === current && !o.exam) body.append(hintsFor(task, step));
      goals.append(li);
    }
  };

  const hintsFor = (task: Task, step: DocStep): HTMLElement => {
    const pol = hintPolicy(step);
    const box = h('div.hints');
    const shown = hintsOpened.get(task.id) ?? 0;
    const available = pol.allowed.filter((hl) => task.hints?.[hl] || (hl === 'H3' && task.docRef && pol.h3 !== 'text'));
    const renderHint = (hl: HintLevel) => {
      if (hl === 'H3' && task.docRef && pol.h3 === 'fragment') {
        const fragment = docFragment({ ...task.docRef, gloss: task.docRef.gloss ?? task.hints?.H2 });
        return h('div', {}, ...(fragment ? [fragment] : []), ...(task.hints?.H3 ? [prose(task.hints.H3)] : []));
      }
      if (hl === 'H3' && task.docRef && pol.h3 === 'link')
        return h('p', {}, t(bi('Ответ — на этой странице: ', 'The answer is on this page: ')), docChip({ page: task.docRef.page, url: task.docRef.url, label: refLabel({ page: task.docRef.page, url: task.docRef.url }) }));
      return prose(task.hints![hl]!);
    };
    available.slice(0, shown).forEach((hl, i) => box.append(h('div.hint', {}, h('span.hint-tag', {}, t(bi(`Подсказка ${i + 1} из ${available.length}`, `Hint ${i + 1} of ${available.length}`))), renderHint(hl))));
    if (shown < available.length) {
      const next = available[shown];
      box.append(
        h(
          'button.btn.ghost.small',
          {
            type: 'button',
            onclick: () => {
              hintsOpened.set(task.id, shown + 1);
              store.record({ kind: 'hint.open', task: taskKey(task), hint: next });
              renderGoals();
            },
          },
          icon('eye'),
          t(bi(`Подсказка ${shown + 1} из ${available.length}`, `Hint ${shown + 1} of ${available.length}`)),
        ),
      );
    }
    if (!available.length && step >= 4) {
      box.append(h('p.muted.small', {}, t(TL.noHints)));
      if (task.docRef) box.append(docChip({ ...task.docRef, gloss: task.docRef.gloss ?? task.hints?.H3 ?? task.hints?.H2 }));
    }
    if (shown >= available.length && available.length > 0) box.append(externalButton({ lessonId: o.lessonId, level: o.level, task: t(task.prompt) }));
    if (pol.mentor !== 'off') box.append(askBox({ mode: pol.mentor === 'docs' ? 'docs' : 'practice', level: o.level, lessonId: o.lessonId, task: { id: taskKey(task), prompt: t(task.prompt), solutionTokens: task.solutionTokens, docRef: task.docRef } }));
    return box;
  };

  const docOpenedFor = (task: Task) => {
    const page = task.docRef?.page ?? task.docRef?.url;
    return !!page && store.state.docTrail.some((d) => d.page === page && d.at >= mountedAt);
  };

  const check = async (attempted = false) => {
    if (!machine) return;
    const source = sourceKey && o.lessonId ? lessonGoalSources.get(o.lessonId, sourceKey) : undefined;
    if (sourceKey && !source) return;
    const facts = await (source ? source.facts() : machine.facts());
    if (disposed) return;
    const initial = source?.initial ?? startFacts;
    let changed = false;
    const failures: { task: Task; say: string }[] = [];
    for (const task of o.tasks) {
      if (passed.has(task.id)) continue;
      const r = evaluateCheck(task.check, facts, initial);
      if (r.pass) {
        passed.add(task.id);
        changed = true;
        const step = stepFor(task);
        const hl = hintsOpened.get(task.id) ?? 0;
        store.record({ kind: 'task.pass', task: taskKey(task), lesson: o.lessonId, hintLevel: hl, docStep: step, docOpened: docOpenedFor(task), concepts: task.concepts ?? [], source: task.docRef ? sourceOf(task.docRef) : undefined });
        o.onTaskPass?.(task);
      } else if (r.say) failures.push({ task, say: t(r.say) });
    }
    clear(status);
    if (attempted && !o.exam) for (const failure of failures) status.append(h('p.lab-fail', { 'data-task': failure.task.id }, h('strong', {}, t(failure.task.prompt)), ' ', h('span', {}, ...renderInline(failure.say))));
    const pending = o.tasks.find(task => !passed.has(task.id));
    if (attempted || !pending) el.dataset.feedbackFailed = String(!!pending);
    if (pending && attempted && !o.exam) status.append(externalButton({ lessonId: o.lessonId, level: o.level, task: t(pending.prompt) }));
    if (changed) {
      renderGoals();
      if (passed.size === o.tasks.length) {
        status.append(h('p.lab-ok', {}, h('span.st-icon.ok', { 'aria-hidden': 'true' }, '✓'), t(bi('Все цели выполнены.', 'All goals are done.'))));
        o.onAllDone?.();
      }
    }
  };

  const start = async () => {
    termBox.append(h('p.muted.small', {}, t(TL.loading)));
    const fresh = await createSimMachine(o.setup);
    startSnap = await fresh.snapshot();
    startFacts = await fresh.facts();
    const saved = await store.loadSnapshot<unknown>(o.key);
    if (saved) {
      try {
        await fresh.restore(saved);
        if (o.exam) termBox.before(h('p.exam-resumed', { role: 'status' }, t(bi('Состояние машины восстановлено из сохранённой попытки.', 'The machine state has been restored from a saved attempt.'))));
      } catch {
        await fresh.restore(startSnap);
      }
    }
    if (disposed) return;
    machine = fresh;
    if (o.lessonId) unregisterSource = lessonGoalSources.register(o.lessonId, o.key, { facts: () => fresh.facts(), initial: startFacts! });
    clear(termBox);
    term = await mountTerminal(termBox, {
      machine,
      rows: 14,
      onCommand: () => {
        void machine!.snapshot().then((sn) => store.saveSnapshot(o.key, sn));
        void check(true);
        if (o.lessonId) lessonGoalSources.changed(o.lessonId, o.key);
      },
      onDoc: (ref) => openDoc(ref, { mode: 'page', via: 'terminal', keepFocus: true }),
    });
    // A blinking cursor in the box that just appeared answers "where do I type?" before it is asked.
    // Keep hands off when the learner has deliberately focused something else on the page.
    if (!document.activeElement || document.activeElement === document.body) term.focus();
    if (passed.size === o.tasks.length && o.tasks.length) o.onAllDone?.();
    void check();
  };

  expandBtn.addEventListener('click', () => {
    const expanded = el.classList.toggle('lab-expanded');
    expandBtn.setAttribute('aria-pressed', String(expanded));
    expandBtn.textContent = t(expanded ? bi('Вернуть обычную ширину', 'Restore width') : bi('Расширить терминал', 'Expand terminal'));
  });

  resetBtn.addEventListener('click', async () => {
    if (!machine || !startSnap) return;
    if (!window.confirm(t(bi('Вернуть машину к исходному состоянию? Изменения файлов и настроек будут потеряны.', 'Restore the initial machine state? File and configuration changes will be lost.')))) return;
    await machine.restore(startSnap);
    store.saveSnapshot(o.key, startSnap, 0);
    term?.reset();
    if (o.lessonId) lessonGoalSources.changed(o.lessonId, o.key);
    toast(t(TL.resetDone));
  });

  if (sourceKey && o.lessonId) unsubscribeSource = lessonGoalSources.subscribe(o.lessonId, sourceKey, () => { void check(); });
  renderGoals();
  void start();

  return {
    dispose() {
      unregisterFeedback();
      unregisterSource?.();
      unsubscribeSource?.();
      disposed = true;
      term?.dispose();
      machine?.dispose();
    },
    describe: () => {
      const current = o.tasks.find((x) => !passed.has(x.id));
      return `${t(bi('Лаборатория', 'Lab'))}: ${passed.size}/${o.tasks.length}${current ? ` — ${t(current.prompt)}` : ''}`;
    },
  };
}
