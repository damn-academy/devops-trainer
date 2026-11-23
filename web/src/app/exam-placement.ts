// "Show what you already know" — the placement check of a block (01 §4.1,
// 10 §3.5). The learner claims a level; for that level the block's
// placement tasks run one at a time: quiz items without feedback and
// sandbox tasks checked by the state of the machine. No hints, no mentor.
// Pass = 80% (rounded up) and every key task; a right answer marked
// "guessing" does not count. Failed tasks become gaps, never a silent
// downgrade; a retake opens in 72 hours with another variant.

import { mountRealCard, mountRealLab } from './real/panel';
import { referenceAnswer } from '../engine/quiz/review';
import { readDraft, writeDraft, clearDraft } from '../core/draft';
import { renderInline } from '../core/markdown';
import { clear, put, h, icon } from '../core/dom';
import { bi, count, fmt, lang, t, UI } from '../core/i18n';
import { registry } from '../core/registry';
import { href, navigate } from '../core/router';
import { store } from '../core/store';
import { LEVELS, type Confidence, type Level, type Mounted, type PlacementTask } from '../core/types';
import { nextVariant, retakeState, scorePlacement, tasksOf, type PlacementAnswer } from '../engine/quiz/placement';
import { mountQuiz } from '../engine/quiz/render';
import { conceptLink, emptyState, prose, setTitle, type Page } from './common';
import { mountLab } from './terminal-section';
import './exam.css';
import { crumbProfession } from './common';

const P = {
  lede: bi(
    'Выберите уровень, который хотите подтвердить. Задания идут по одному, и первое из них самое простое. Подсказок и наставника на проверке нет.',
    'Choose the level you want to confirm. Tasks come one at a time, and the first is the easiest. There are no hints and no mentor during the check.',
  ),
  rules: bi(
    'Зачёт — 80% заданий и все ключевые. Практика проверяется по состоянию машины, любой путь к нужному состоянию засчитывается. Время сохраняется, но на результат не влияет.',
    'To pass: 80% of the tasks and every key one. Practice is checked by the state of the machine: any way to the right state counts. Time is recorded but never fails the check.',
  ),
  beginner: bi('Новичку проверка не нужна: блок начинается с первого урока.', 'Beginners need no check: the block starts from the first lesson.'),
  confirmed: bi('подтверждён', 'confirmed'),
  opens: bi('повтор откроется {d}', 'retake opens {d}'),
  modules: bi('две попытки использованы: дальше — по модулям', 'both attempts used: go module by module'),
  tasks: bi('заданий', 'tasks'),
  key: bi('ключевое', 'key'),
  practice: bi('практика в песочнице', 'sandbox practice'),
  next: bi('Дальше', 'Next'),
  skip: bi('Пропустить', 'Skip'),
  finish: bi('Завершить проверку', 'Finish the check'),
  passed: bi('Уровень подтверждён', 'Level confirmed'),
  passedGaps: bi('Зачтено, кроме нескольких тем', 'Confirmed, except a few topics'),
  notYet: bi('Эти темы пройдём вместе', 'We will go through these topics together'),
  gapsLine: bi('Темы, уроки по которым откроются и на вашем уровне:', 'Topics whose lessons open even at your level:'),
  details: bi('Подробности', 'Details'),
  guessedLine: bi('Верно, но с пометкой «угадываю» — не засчитано:', 'Right but marked “guessing” — not counted:'),
  choose: bi('Уровень не понижается сам. Выберите, как идти дальше:', 'Your level is never lowered for you. Choose how to go on:'),
  lower: bi('Блок на уровне «{l}»', 'The block at “{l}”'),
  stay: bi('Остаться на уровне «{l}» с обязательными уроками по этим темам', 'Stay at “{l}” with the lessons on these topics required'),
  retake72: bi('Повторить проверку другим вариантом можно через 72 часа.', 'You can retake the check with another variant in 72 hours.'),
  moduleRoute: bi('Это была вторая попытка. Дальше проверка идёт по модулям: перед каждым уроком можно сдать его итоговую проверку и пропустить урок, если она сдана.', 'That was the second attempt. From here the check goes module by module: before each lesson you can take its exit check and skip the lesson if you pass.'),
  time: bi('время', 'Time'),
  variant: bi('вариант', 'variant'),
  ofN: bi('из', 'of'),
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function taskPrompt(p: PlacementTask): string {
  return p.kind === 'quiz' ? t(p.item.prompt) : t(p.task.prompt);
}

export function placementPage(id: string): Page {
  const b = registry.blocks.get(id);
  if (!b || !b.placement.length) return { el: emptyState(UI.notFound, undefined, { label: UI.backHome, href: href({ name: 'home' }) }) };
  setTitle(t(UI.checkLevel), t(b.title));
  const root = h('div.placement.pl');
  const mounts: Mounted[] = [];
  const disposeAll = () => mounts.splice(0).forEach((m) => m.dispose());
  const history = () => (store.state.placement[b.id] ?? []).map((r) => ({ claimed: r.claimed, passed: r.passed, at: r.at }));
  const claimable = LEVELS.filter((l) => b.placement.some((p) => p.level === l));

  const choose = () => {
    disposeAll();
    clear(root);
    const now = new Date();
    put(root, 
      h('nav.crumbs', {}, crumbProfession(), ' › ', h('a', { href: href({ name: 'block', id: b.id }) }, t(b.title))),
      h('h1', {}, t(UI.checkLevel)),
      h('p.lede', {}, t(P.lede)),
      h('p.small.muted', {}, t(P.rules)),
      !claimable.includes('beginner') ? h('p.small', {}, t(P.beginner)) : null,
      h(
        'div.level-chooser',
        { role: 'list' },
        ...claimable.map((l) => {
          const st = retakeState(history(), l, now);
          const v = nextVariant(b.placement, l, history());
          const n = tasksOf(b.placement, l, v).length;
          const note = st.confirmed ? `✓ ${t(P.confirmed)}` : st.moduleByModule ? t(P.modules) : st.opensAt ? t(fmt(P.opens, { d: fmtDate(st.opensAt) })) : count(n, ['задание', 'задания', 'заданий'], ['task', 'tasks']);
          return h(
            'button.level-card',
            { type: 'button', role: 'listitem', disabled: !st.allowed, onclick: () => run(l, v) },
            h('span.level-name', {}, t(UI.levels[l])),
            h('span.level-desc', {}, t(b.levels[l])),
            h('span.hours', {}, note),
          );
        }),
      ),
    );
  };

  const run = (claimed: Level, variant: number) => {
    disposeAll();
    const tasks = tasksOf(b.placement, claimed, variant);
    const key = `placement/${b.id}`;
    const saved = readDraft<{ claimed: Level; variant: number; started: number; index: number; answers: PlacementAnswer[] }>(key);
    const draft = saved?.claimed === claimed && saved.variant === variant ? saved : undefined;
    const answers = new Map<string, PlacementAnswer>((draft?.answers ?? []).map(a => [a.id, a]));
    const started = draft?.started ?? Date.now();
    let i = draft?.index ?? 0;
    const save = () => writeDraft(key, { claimed, variant, started, index: i, answers: [...answers.values()] });

    const step = () => {
      save();
      disposeAll();
      clear(root);
      if (i >= tasks.length) return done(claimed, tasks, [...answers.values()], Date.now() - started);
      const p = tasks[i];
      const host = h('div.pl-host');
      const nextBtn = h('button.btn.primary', { type: 'button', onclick: () => { if (p.kind === 'task' && !answers.has(p.id)) answers.set(p.id, { id: p.id, right: false, guessed: false }); i++; step(); } }, i === tasks.length - 1 ? t(P.finish) : t(P.next), icon('next')) as HTMLButtonElement;
      const skipBtn = h('button.btn.ghost', { type: 'button', onclick: () => (answers.set(p.id, { id: p.id, right: false }), i++, step()) }, t(P.skip));
      if (p.kind === 'quiz') {
        nextBtn.disabled = true;
        mounts.push(
          mountQuiz(host, p.item, {
            context: 'placement',
            feedback: false,
            md: (x) => prose(x),
            onAnswered: (g) => {
              const conf = (store.state.quiz[p.item.id]?.confidence.slice(-1)[0] ?? 1) as Confidence;
              answers.set(p.id, { id: p.id, right: g.correct, guessed: conf === 1 });
              save();
              nextBtn.disabled = false;
              save();
              skipBtn.remove();
            },
          }),
        );
      } else if (p.realEvidence) {
        const exam = registry.exams.get(p.realEvidence.exam);
        const task = exam?.tasks.find(t => t.id === p.realEvidence!.task);
        if (exam?.real && task?.kind === 'real') {
          const card = mountRealCard(task.real, { feedback: false, onScore: score => {
            if (score < 1) return;
            answers.set(p.id, { id: p.id, right: true }); save(); skipBtn.remove();
          } });
          const lab = mountRealLab({ ...exam, id: `placement.${b.id}`, real: {
            ...exam.real,
            prepare: [],
            order: bi('Для этой проверки достаточно управляющего узла cp-1 в вашем кластере kubeadm, в том числе в локальной лаборатории dtlab; рабочие узлы не требуются. Выполните на cp-1 показанную ниже команду и вставьте полученный блок данных.', 'This check only needs the cp-1 control-plane node of your kubeadm cluster, including a local dtlab cluster; worker nodes are not required. Run the command below on cp-1 and paste the resulting facts block.'),
          } }, `${claimed}/${started}`, facts => card.update(facts));
          host.append(prose(p.task.prompt), lab.el, card.el);
          mounts.push(lab);
        }
      } else {

        mounts.push(
          mountLab(host, {
            key: `placement/${b.id}/${claimed}/${p.id}/${started}`,
            setup: p.setup,
            tasks: [p.task],
            level: claimed,
            block: b.id,
            index: 0,
            count: 1,
            exam: true,
            onTaskPass: () => {
              answers.set(p.id, { id: p.id, right: true });
              save();
              skipBtn.remove();
            },
          }),
        );
      }
      put(root, 
        h(
          'header.pl-bar',
          {},
          h('span.pl-count', {}, `${i + 1} ${t(P.ofN)} ${tasks.length}`),
          h('div.rv-progress', {}, h('span', { style: `width:${(i / tasks.length) * 100}%` })),
          h('span.small.muted', {}, `${t(UI.levels[claimed])} · ${t(P.variant)} ${variant}`),
        ),
        h('div.pl-tags', {}, p.key ? h('span.badge.key', {}, t(P.key)) : null, p.kind === 'task' ? h('span.badge', {}, icon('term'), ' ', t(P.practice)) : null),
        host,
        h('div.pl-actions', {}, skipBtn, nextBtn),
      );
    };
    step();
  };

  const done = (claimed: Level, tasks: PlacementTask[], answers: PlacementAnswer[], ms: number, replay = false) => {
    disposeAll();
    clearDraft(`placement/${b.id}`);
    if (!answers.some(a => a.right || a.guessed !== undefined)) { choose(); return; }
    const r = scorePlacement(tasks, answers);
    const prior = history().filter((x) => x.claimed === claimed && !x.passed).length;
    if (!replay) {
      store.record({ kind: 'placement.result', block: b.id, claimed, passed: r.passed, score: r.score, failed: r.failed, concepts: r.concepts, gaps: r.gaps });
      if (r.passed) store.record({ kind: 'level.set', block: b.id, level: claimed, via: 'placement' });
      writeDraft(`placement-result/${b.id}`, { claimed, ids: tasks.map(t => t.id), answers, ms });
    }
    clear(root);
    const lower = LEVELS[Math.max(0, LEVELS.indexOf(claimed) - 1)];
    const gapLinks = r.gaps.length ? h('p', {}, t(P.gapsLine), ' ', ...r.gaps.flatMap((c, k) => [k ? ', ' : '', registry.concepts.has(c) ? conceptLink(c) : c])) : null;
    const details = h(
      'details.pl-details',
      {},
      h('summary', {}, t(P.details)),
      h('button.btn.ghost.small', { type: 'button', onclick: choose }, t(bi('Выбрать новую проверку', 'Choose a new check'))),
      h('p.small', {}, `${r.counted} / ${r.total} (${Math.round(r.score * 100)}%), ${t(bi('нужно', 'needed'))} ${r.needed}; ${r.keysOk ? t(bi('все ключевые выполнены', 'every key task done')) : t(bi('не все ключевые выполнены', 'not every key task done'))}; ${t(P.time)} ${Math.max(1, Math.round(ms / 60000))} ${t(bi('мин', 'min'))}`),
      r.guessed.length ? h('p.small', {}, t(P.guessedLine), ' ', r.guessed.map((x) => taskPrompt(tasks.find((y) => y.id === x)!)).join('; ')) : null,
      h('ul.placement-results', {}, ...tasks.map((x) => h('li', { class: r.failed.includes(x.id) ? 'err' : 'ok' }, h('span.st-icon', { 'aria-hidden': 'true' }, r.failed.includes(x.id) ? '·' : '✓'), h('div', {}, ...renderInline(taskPrompt(x)), x.kind === 'quiz' ? referenceAnswer(x.item) : null)))),
    );
    if (r.passed) {
      put(root, 
        h('h1', {}, t(r.gaps.length ? P.passedGaps : P.passed)),
        h('p.lede', {}, t(UI.levels[claimed])),
        gapLinks,
        details,
        h('a.btn.primary', { href: href({ name: 'block', id: b.id }) }, t(UI.continue), icon('next')),
      );
      return;
    }
    const second = prior + 1 >= 2;
    put(root, 
      h('h1', {}, t(P.notYet)),
      gapLinks,
      h(
        'div.placement-choice',
        {},
        h('p', {}, t(P.choose)),
        lower !== claimed
          ? h('button.btn', { type: 'button', onclick: () => (store.record({ kind: 'level.set', block: b.id, level: lower, via: 'choice' }), navigate({ name: 'block', id: b.id })) }, t(fmt(P.lower, { l: t(UI.levels[lower]) })))
          : null,
        h('button.btn.ghost', { type: 'button', onclick: () => (store.record({ kind: 'level.set', block: b.id, level: claimed, via: 'choice' }), navigate({ name: 'block', id: b.id })) }, t(fmt(P.stay, { l: t(UI.levels[claimed]) }))),
        h('p.small.muted', {}, t(second ? P.moduleRoute : P.retake72)),
      ),
      details,
    );
  };

  const saved = readDraft<{ claimed: Level; variant: number }>(`placement/${b.id}`);
  if (saved && claimable.includes(saved.claimed)) run(saved.claimed, saved.variant);
  else {
    const result = readDraft<{ claimed: Level; ids: string[]; answers: PlacementAnswer[]; ms: number }>(`placement-result/${b.id}`);
    const tasks = result?.ids.map(id => b.placement.find(t => t.id === id));
    if (result && tasks?.length && tasks.every((t): t is PlacementTask => !!t)) done(result.claimed, tasks, result.answers, result.ms, true);
    else choose();
  }
  return { el: root, dispose: disposeAll };
}
