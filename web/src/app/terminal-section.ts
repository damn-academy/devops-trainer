// A lab: terminal on a simulated machine with goals checked by state after
// every command (09 §2.5). Hints follow the documentation ladder: DL1–2 full
// command chips and a page fragment as H3, DL3 only the page link and the
// command name, DL4 nothing but "where have you looked?".

import { evaluateCheck } from '../core/check';
import { clear, h, icon, toast } from '../core/dom';
import { bi, t, UI, type Bi } from '../core/i18n';
import { renderInline } from '../core/markdown';
import { store } from '../core/store';
import type { BlockId, DocStep, Facts, HintLevel, Level, Mounted, Task, TerminalSetup } from '../core/types';
import { refLabel, sourceOf } from '../engine/docs/corpus';
import { effectiveStep, hintPolicy, shouldRecord, STEP_NAMES } from '../engine/docs/ladder';
import { docChip, docFragment, openDoc } from '../engine/docs/viewer';
import { createSimMachine, type SimMachine } from '../engine/terminal/shell';
import { mountTerminal, type TerminalHandle } from '../engine/terminal/widget';
import { prose } from './common';
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

  const goals = h('ol.lab-goals');
  const termBox = h('div.lab-term-box');
  const status = h('div.lab-status', { 'aria-live': 'polite' });
  const resetBtn = h('button.btn.ghost.small', { type: 'button' }, icon('repeat'), t(UI.reset));
  const el = h(
    'div.lab',
    { 'data-exam': o.exam ? 'true' : undefined },
    h('div.lab-left', {}, o.intro ? prose(o.intro) : null, h('h4.lab-h', {}, t(UI.goals)), goals, status),
    h('div.lab-right', {}, h('div.lab-bar', {}, h('span.lab-env', {}, icon('term'), t(TL.sim)), resetBtn), termBox),
  );
  clear(root);
  root.append(el);

  const stepFor = (task: Task): DocStep => {
    const source = task.docRef ? sourceOf(task.docRef) : 'man';
    const stored = store.state.docLadder[source];
    const base = { level: o.level, block: o.block ?? '', index: o.index, count: o.count, stored, exam: o.exam };
    // The schedule moves the learner's step for the source; a task's own docStep (forcing) applies to that task only.
    const scheduled = effectiveStep(base);
    if (!o.exam && o.block && scheduled < 5 && shouldRecord(scheduled, stored, o.block)) store.record({ kind: 'doc.step', source, step: scheduled, block: o.block });
    return effectiveStep({ ...base, override: task.docStep });
  };

  const renderGoals = () => {
    clear(goals);
    const current = o.tasks.find((x) => !passed.has(x.id));
    for (const task of o.tasks) {
      const done = passed.has(task.id);
      const step = stepFor(task);
      const pol = hintPolicy(step);
      const li = h('li.goal', { class: [done ? 'done' : '', task === current ? 'current' : ''].filter(Boolean).join(' '), 'data-task': task.id });
      li.append(h('span.goal-mark', { 'aria-hidden': 'true' }, done ? '✓' : ''), h('div.goal-body', {}, prose(task.prompt, 'goal-text')));
      const body = li.querySelector('.goal-body')!;
      if (done) {
        body.append(h('span.sr-only', {}, t(TL.passed)));
        goals.append(li);
        continue;
      }
      const meta = h('div.goal-meta');
      if (!o.exam) meta.append(h('span.dl-tag', { title: `DL${step}` }, `DL${step} · ${t(STEP_NAMES[step])}`));
      if (task.docRef && pol.docref) meta.append(docChip(task.docRef));
      if (task.docRef && step === 3) meta.append(h('button.docref', { type: 'button', onclick: () => openDoc({ page: task.docRef!.page, url: task.docRef!.url }, { mode: 'page', via: 'docref' }) }, icon('doc'), h('span', {}, `${t(TL.page)}: ${refLabel({ page: task.docRef.page, url: task.docRef.url })}`)));
      body.append(meta);
      if (task.chips && pol.chips !== 'none' && !o.exam) {
        const words = pol.chips === 'name' ? [task.chips.split(/\s+/)[0]] : task.chips.split(/\s+/);
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
      if (hl === 'H3' && task.docRef && pol.h3 === 'fragment') return docFragment(task.docRef) ?? prose(task.hints?.H3 ?? bi('', ''));
      if (hl === 'H3' && task.docRef && pol.h3 === 'link')
        return h('p', {}, t(bi('Ответ — на этой странице: ', 'The answer is on this page: ')), docChip({ page: task.docRef.page, url: task.docRef.url, label: refLabel({ page: task.docRef.page, url: task.docRef.url }) }));
      return prose(task.hints![hl]!);
    };
    available.slice(0, shown).forEach((hl) => box.append(h('div.hint', {}, h('span.hint-tag', {}, hl), renderHint(hl))));
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
          `${t(TL.nextHint)} ${shown + 1}/${available.length}`,
        ),
      );
    }
    if (!available.length && step >= 4) box.append(h('p.muted.small', {}, t(TL.noHints)));
    if (pol.mentor !== 'off') box.append(askBox({ mode: pol.mentor === 'docs' ? 'docs' : 'practice', level: o.level, lessonId: o.lessonId, task: { id: taskKey(task), prompt: t(task.prompt), solutionTokens: task.solutionTokens } }));
    return box;
  };

  const docOpenedFor = (task: Task) => {
    const page = task.docRef?.page ?? task.docRef?.url;
    return !!page && store.state.docTrail.some((d) => d.page === page && d.at >= mountedAt);
  };

  const check = async () => {
    if (!machine) return;
    const facts = await machine.facts();
    let changed = false;
    let failSay: string | null = null;
    for (const task of o.tasks) {
      if (passed.has(task.id)) continue;
      const r = evaluateCheck(task.check, facts, startFacts);
      if (r.pass) {
        passed.add(task.id);
        changed = true;
        const step = stepFor(task);
        const hl = hintsOpened.get(task.id) ?? 0;
        store.record({ kind: 'task.pass', task: taskKey(task), lesson: o.lessonId, hintLevel: hl, docStep: step, docOpened: docOpenedFor(task), concepts: task.concepts ?? [], source: task.docRef ? sourceOf(task.docRef) : undefined });
        o.onTaskPass?.(task);
      } else if (!failSay && r.say && task === o.tasks.find((x) => !passed.has(x.id))) failSay = t(r.say);
    }
    clear(status);
    if (failSay && !o.exam) status.append(h('p.lab-fail', {}, h('span.st-icon.warn', { 'aria-hidden': 'true' }, '!'), h('span', {}, ...renderInline(failSay))));
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
    const saved = o.exam ? undefined : await store.loadSnapshot<unknown>(o.key);
    if (saved) {
      try {
        await fresh.restore(saved);
      } catch {
        await fresh.restore(startSnap);
      }
    }
    if (disposed) return;
    machine = fresh;
    clear(termBox);
    term = await mountTerminal(termBox, {
      machine,
      rows: 14,
      onCommand: () => {
        void machine!.snapshot().then((sn) => !o.exam && store.saveSnapshot(o.key, sn));
        void check();
      },
      onDoc: (ref) => openDoc(ref, { mode: 'page', via: 'terminal', keepFocus: true }),
    });
    if (passed.size === o.tasks.length && o.tasks.length) o.onAllDone?.();
    void check();
  };

  resetBtn.addEventListener('click', async () => {
    if (!machine || !startSnap) return;
    await machine.restore(startSnap);
    store.saveSnapshot(o.key, startSnap, 0);
    term?.reset();
    toast(t(TL.resetDone));
  });

  renderGoals();
  void start();

  return {
    dispose() {
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
