// Smaller pages: an explainer on its own, the review queue, a block exam.

import { clear, h, icon } from '../core/dom';
import { bi, t, UI } from '../core/i18n';
import { dueConcepts } from '../core/progress';
import { registry } from '../core/registry';
import { href } from '../core/router';
import { store } from '../core/store';
import type { Mounted, QuizItem } from '../core/types';
import { openDoc } from '../engine/docs/viewer';
import { mountQuiz } from '../engine/quiz/render';
import { conceptLink, emptyState, levelFor, prose, setTitle, type Page } from './common';
import { mountLab } from './terminal-section';

export function explainerPage(id: string): Page {
  const reg = registry.explainers.get(id);
  if (!reg) return { el: emptyState(UI.notFound, undefined, { label: UI.backHome, href: href({ name: 'home' }) }) };
  setTitle(t(reg.title));
  const block = registry.blocks.get(reg.block);
  const host = h('div.ex-host');
  const mounted = reg.mount(host, { level: levelFor(reg.block), onComplete: () => {}, record: (e) => store.record(e), openDoc: (r) => openDoc(r) });
  const el = h(
    'div.explainer-page',
    {},
    h('nav.crumbs', {}, h('a', { href: href({ name: 'home' }) }, t(UI.map)), block ? [' › ', h('a', { href: href({ name: 'block', id: block.id }) }, t(block.title))] : null),
    host,
    reg.concepts?.length ? h('p.small', {}, h('span.k', {}, t(bi('Понятия', 'Concepts'))), ' ', ...reg.concepts.flatMap((c, i) => [i ? ', ' : '', conceptLink(c)])) : null,
  );
  return { el, dispose: () => mounted.dispose() };
}

export function reviewPage(): Page {
  setTitle(t(UI.review));
  const due = dueConcepts(store.state);
  const items: QuizItem[] = [];
  const bank = [...registry.quiz.values()];
  for (const c of due) {
    const answered = (q: QuizItem) => store.state.quiz[q.id]?.lastAt ?? '';
    const pick = bank.filter((q) => q.concepts?.includes(c) && !items.includes(q)).sort((a, b) => (answered(a) < answered(b) ? -1 : 1))[0];
    if (pick) items.push(pick);
    if (items.length >= 10) break;
  }
  const mounts: Mounted[] = [];
  const list = h('div.review-list');
  for (const q of items) {
    const host = h('div.quiz-host');
    list.append(host);
    mounts.push(mountQuiz(host, q, { context: 'review' }));
  }
  const cal = store.state.calibration;
  const sure = cal[3];
  const el = h(
    'div.review',
    {},
    h('h1', {}, t(UI.review)),
    h('p.lede', {}, t(bi('Понятия возвращаются через растущие промежутки. Ошибка с пометкой «знаю» вернётся сегодня же и завтра.', 'Concepts come back at growing intervals. A mistake marked “I know” returns today and tomorrow.'))),
    sure.n >= 5 ? h('p.calibration', {}, t(bi(`Когда ты отвечал «знаю», ты был прав в ${Math.round((sure.right / sure.n) * 100)}% случаев.`, `When you said “I know”, you were right ${Math.round((sure.right / sure.n) * 100)}% of the time.`))) : null,
    due.length ? h('p.small', {}, h('span.k', {}, t(bi('К повторению', 'Due'))), ' ', ...due.slice(0, 20).flatMap((c, i) => [i ? ', ' : '', conceptLink(c)])) : null,
    items.length ? list : emptyState(bi('Сегодня повторять нечего', 'Nothing to review today'), bi('Пройденные уроки добавят сюда свои понятия.', 'Finished lessons add their concepts here.'), { label: UI.backHome, href: href({ name: 'home' }) }),
  );
  return { el, dispose: () => mounts.forEach((m) => m.dispose()) };
}

export function examPage(id: string): Page {
  const exam = registry.exams.get(id);
  if (!exam) return { el: emptyState(UI.notFound, undefined, { label: UI.backHome, href: href({ name: 'home' }) }) };
  setTitle(t(exam.title));
  const root = h('div.exam');
  const mounts: Mounted[] = [];
  const intro = () => {
    clear(root);
    root.append(
      h('h1', {}, t(exam.title)),
      prose(exam.intro),
      h(
        'p.small.muted',
        {},
        t(bi('Режим «экзамен»: только встроенная документация, наставник выключен, блок закрывается. Режим «тренировка»: любые помощники, полный разбор, блок не закрывается.', 'Exam mode: only the built-in documentation, no mentor, closes the block. Training mode: any helpers, a full review, does not close the block.')),
      ),
      h('div.row', {}, h('button.btn.primary', { type: 'button', onclick: () => run('exam') }, t(bi('Экзамен', 'Exam'))), h('button.btn.ghost', { type: 'button', onclick: () => run('training') }, t(bi('Тренировка', 'Training')))),
    );
  };
  const run = (mode: 'exam' | 'training') => {
    clear(root);
    const started = Date.now();
    const results = new Map<string, boolean>(exam.tasks.map((x) => [x.id, false]));
    const timer = h('span.exam-timer', { 'aria-live': 'off' });
    const tick = window.setInterval(() => {
      const m = Math.floor((Date.now() - started) / 60000);
      timer.textContent = exam.minutes ? `${m} / ${exam.minutes} ${t(bi('мин', 'min'))}` : `${m} ${t(bi('мин', 'min'))}`;
      timer.classList.toggle('over', !!exam.minutes && m >= exam.minutes);
    }, 1000);
    mounts.push({ dispose: () => clearInterval(tick) });
    const docsBtn = h('button.btn.ghost.small', { type: 'button', onclick: () => openDoc({}, { mode: 'exam', allowed: exam.allowedDocs }) }, icon('doc'), t(bi('Документация', 'Documentation')));
    const list = h('ol.exam-tasks');
    for (const task of exam.tasks) {
      const host = h('div');
      list.append(h('li', {}, h('p.small.muted', {}, `${task.weight} ${t(bi('балл.', 'pts'))}${task.critical ? ' · ' + t(bi('критическое', 'critical')) : ''}${task.beyond ? ' · ' + t(bi('вне курса', 'beyond the course')) : ''}`), host));
      if (task.kind === 'quiz') mounts.push(mountQuiz(host, task.item, { context: 'exam', feedback: mode === 'training', onAnswered: (g) => results.set(task.id, g.correct) }));
      else
        mounts.push(
          mountLab(host, { key: `exam/${exam.id}/${task.id}`, setup: task.setup, tasks: [task.task], level: levelFor(exam.block), block: exam.block, index: 0, count: 1, exam: mode === 'exam', onTaskPass: () => results.set(task.id, true) }),
        );
    }
    const finish = h('button.btn.primary', { type: 'button' }, t(bi('Сдать', 'Submit')));
    finish.addEventListener('click', () => {
      const total = exam.tasks.reduce((s, x) => s + x.weight, 0);
      const got = exam.tasks.reduce((s, x) => s + (results.get(x.id) ? x.weight : 0), 0);
      const score = total ? got / total : 0;
      const critical = exam.tasks.every((x) => !x.critical || results.get(x.id));
      const passed = score >= exam.pass && critical;
      store.record({ kind: 'exam.result', exam: exam.id, mode, score, passed });
      mounts.splice(0).forEach((m) => m.dispose());
      clear(root);
      root.append(
        h('h1', {}, passed ? t(bi('Экзамен сдан', 'Exam passed')) : t(bi('Экзамен не сдан', 'Exam not passed'))),
        h('p.lede', {}, `${Math.round(score * 100)}% · ${t(bi('порог', 'threshold'))} ${Math.round(exam.pass * 100)}%${critical ? '' : ' · ' + t(bi('не все критические задания', 'not every critical task'))}`),
        h('ul.placement-results', {}, ...exam.tasks.map((x) => h('li', { class: results.get(x.id) ? 'ok' : 'err' }, h('span.st-icon', { 'aria-hidden': 'true' }, results.get(x.id) ? '✓' : '⨯'), x.kind === 'quiz' ? t(x.item.prompt) : t(x.task.prompt)))),
        h('a.btn', { href: href({ name: 'block', id: exam.block }) }, t(UI.continue)),
      );
    });
    root.append(h('header.exam-head', {}, h('h1', {}, t(exam.title)), timer, docsBtn), list, finish);
  };
  intro();
  return { el: root, dispose: () => mounts.forEach((m) => m.dispose()) };
}
