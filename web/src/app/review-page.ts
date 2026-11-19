// The daily review (01 §12, 10 §3.4): FSRS cards per concept, mixed blocks,
// up to 15 minutes or 30 cards, one card at a time. Each card takes another
// format than last time; every third review of a concept with a practical
// side is a 30–90 s sandbox micro-task (skipped on a phone). A mistake made
// with "I know" comes back at the end of the same session in another format.

import { clear, put, h, icon } from '../core/dom';
import { bi, fmt, lang, t, UI, type Bi } from '../core/i18n';
import { registry } from '../core/registry';
import { href } from '../core/router';
import { store } from '../core/store';
import type { ConceptId, Confidence, Mounted, QuizItem, Task, TerminalSetup } from '../core/types';
import { buildCards, buildQueue, DAILY_MINUTES, FORMAT_SECONDS, forecast, queueMinutes, ratingFor, RATING_NAMES, recall, REVIEW_EVENT, type Candidate, type ConceptCard, type QueueEntry } from '../engine/quiz/fsrs';
import { mountQuiz } from '../engine/quiz/render';
import { conceptLink, emptyState, levelFor, prose, setTitle, type Page } from './common';
import { mountLab } from './terminal-section';
import './review-page.css';

type Source = { kind: 'quiz'; item: QuizItem } | { kind: 'task'; task: Task; setup: TerminalSetup; lesson: string };

/** Everything in the build that can review a concept: bank items, lesson quiz items, lesson sandbox tasks. */
export function reviewSources(): Map<string, Source & { concepts: ConceptId[] }> {
  const out = new Map<string, Source & { concepts: ConceptId[] }>();
  for (const q of registry.quiz.values()) if (q.concepts?.length) out.set(q.id, { kind: 'quiz', item: q, concepts: q.concepts });
  for (const l of registry.lessons.values()) {
    for (const s of l.sections) {
      if (s.kind === 'quiz') for (const it of s.items) if (typeof it !== 'string' && it.concepts?.length && !out.has(it.id)) out.set(it.id, { kind: 'quiz', item: it, concepts: it.concepts });
      if (s.kind === 'terminal')
        for (const task of s.tasks) if (task.concepts?.length && !task.beyond) out.set(`task:${l.id}/${s.id}/${task.id}`, { kind: 'task', task, setup: s.setup, lesson: l.id, concepts: task.concepts });
    }
  }
  return out;
}

function blockOfConcept(c: ConceptId): string | undefined {
  const lesson = registry.concepts.get(c)?.introducedIn;
  return lesson ? registry.blockOf(lesson)?.id : c.split('.')[0];
}

const R = {
  lede: bi(
    'Каждое понятие возвращается тогда, когда вы вот-вот его забудете: планировщик FSRS держит вероятность вспомнить около 90%. Сегодня — смесь блоков и каждый раз другой формат вопроса.',
    'Each concept comes back just before you would forget it: the FSRS scheduler keeps the chance of recall near 90%. Today is a mix of blocks, and each time the question takes another form.',
  ),
  why: bi('Почему этот вопрос вернулся сегодня?', 'Why did this question come back today?'),
  start: bi('Начать повторение', 'Start the review'),
  next: bi('Следующая карточка', 'Next card'),
  skipTask: bi('Не получилось — дальше', 'Could not do it — next'),
  done: bi('На сегодня всё', 'That is all for today'),
  budget: bi('Пятнадцать минут прошли. Мозгу полезнее остановиться и вернуться завтра; остаток подождёт.', 'Fifteen minutes are up. Your memory gains more from stopping and coming back tomorrow; the rest will wait.'),
  more: bi('Ещё немного', 'A little more'),
  nextIn: bi('Вернётся через', 'Comes back in'),
  days: bi('дн.', 'd'),
  minutes: bi('мин', 'min'),
  confident: bi('Вы ответили «знаю» и ошиблись. Такие ошибки исправляются лучше всего, поэтому вопрос вернётся в конце этой сессии в другом виде и завтра.', 'You said “I know” and got it wrong. Such mistakes are the easiest to fix, so the question returns at the end of this session in another form, and tomorrow.'),
  reasonDue: bi('Пора: вероятность вспомнить упала до {p}%.', 'It is time: the chance of recall has dropped to {p}%.'),
  reasonNew: bi('Первое повторение после урока.', 'The first review after the lesson.'),
  reasonMiss: bi('Вчера здесь была уверенная ошибка.', 'Last time this was a confident mistake.'),
  reasonLapsed: bi('Понятие подзабылось: повторяем чаще, пока не закрепится.', 'The concept slipped: it comes more often until it settles.'),
  sandbox: bi('Микрозадание в песочнице: 30–90 секунд.', 'A sandbox micro-task: 30–90 seconds.'),
  nothing: bi('Сегодня повторять нечего', 'Nothing to review today'),
  nothingBody: bi('Пройденные уроки добавляют сюда свои понятия; первое повторение — на следующий день.', 'Finished lessons add their concepts here; the first review comes the next day.'),
  upcoming: bi('Ближайшие повторения', 'Coming up'),
  of: bi('из', 'of'),
  summary: bi('Повторено понятий: {n}. Следующее повторение — {d}.', 'Concepts reviewed: {n}. The next review is {d}.'),
};

function relDays(d: Date, now: Date): string {
  const days = (d.getTime() - now.getTime()) / 86400000;
  if (days < 1 / 24) return lang() === 'ru' ? 'через несколько минут' : 'in a few minutes';
  if (days < 1) return lang() === 'ru' ? `через ${Math.round(days * 24)} ч` : `in ${Math.round(days * 24)} h`;
  const n = Math.round(days);
  return lang() === 'ru' ? `через ${n} дн.` : `in ${n} d`;
}

function reasonLine(e: QueueEntry, card: ConceptCard | undefined, now: Date): Bi {
  if (e.reason === 'confident-miss') return R.reasonMiss;
  if (e.reason === 'lapsed') return R.reasonLapsed;
  if (!card || card.reviews === 0) return R.reasonNew;
  return fmt(R.reasonDue, { p: Math.round(recall(card, now) * 100) });
}

export function reviewPage(): Page {
  setTitle(t(UI.review));
  const root = h('div.review.rv');
  const mounts: Mounted[] = [];
  const sources = reviewSources();
  const byConcept = new Map<ConceptId, Candidate[]>();
  for (const [id, s] of sources) {
    const cand: Candidate = s.kind === 'quiz' ? { id, format: s.item.kind, seconds: FORMAT_SECONDS[s.item.kind] ?? 45 } : { id, format: 'task', seconds: FORMAT_SECONDS.task, desktop: true };
    for (const c of s.concepts) (byConcept.get(c) ?? byConcept.set(c, []).get(c)!).push(cand);
  }
  const phone = typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 720px)').matches;
  const now = new Date();
  let cards = buildCards(store.log);
  let queue = buildQueue(cards, { now, blockOf: blockOfConcept, candidates: (c) => byConcept.get(c) ?? [], phone });
  const startedAt = Date.now();
  let index = 0;
  let extended = false;
  const reviewed = new Set<ConceptId>();
  const requeued = new Set<ConceptId>();

  const head = () =>
    h(
      'header.rv-head',
      {},
      h('h1', {}, t(UI.review)),
      h('p.lede', {}, t(R.lede)),
      h('p.small', {}, h('a', { href: href({ name: 'explainer', id: 'career.fsrs' }) }, icon('eye'), ' ', t(R.why))),
    );

  const calibration = () => {
    const sure = store.state.calibration[3];
    if (sure.n < 5) return null;
    const p = Math.round((sure.right / sure.n) * 100);
    return h('p.calibration', {}, t(bi(`Когда вы отвечали «знаю», вы были правы в ${p}% случаев.`, `When you said “I know”, you were right ${p}% of the time.`)));
  };

  const intro = () => {
    clear(root);
    put(root, head());
    if (!queue.length) {
      const upcoming = [...cards.values()].sort((a, b) => a.card.due.getTime() - b.card.due.getTime()).slice(0, 8);
      put(root, 
        emptyState(R.nothing, R.nothingBody, { label: UI.backHome, href: href({ name: 'home' }) }),
        upcoming.length
          ? h('section.rv-upcoming', {}, h('h2', {}, t(R.upcoming)), h('ul', {}, ...upcoming.map((c) => h('li', {}, conceptLink(c.concept), h('span.muted', {}, ` — ${relDays(c.card.due, now)}`)))))
          : null,
      );
      return;
    }
    const blocks = [...new Set(queue.map((e) => blockOfConcept(e.concept)).filter(Boolean))].map((id) => registry.blocks.get(id!)).filter(Boolean);
    put(root, 
      h(
        'div.rv-plan',
        {},
        h('p', {}, h('strong', {}, `${queue.length}`), ' ', t(bi('карточек', 'cards')), ' · ≈ ', h('strong', {}, `${queueMinutes(queue)}`), ' ', t(R.minutes), blocks.length ? ` · ${blocks.map((b) => t(b!.title)).join(', ')}` : ''),
        calibration(),
        h('button.btn.primary', { type: 'button', onclick: () => showCard() }, icon('play'), t(R.start)),
      ),
    );
  };

  const finish = () => {
    mounts.splice(0).forEach((m) => m.dispose());
    clear(root);
    cards = buildCards(store.log);
    const nextDue = [...cards.values()].map((c) => c.card.due).sort((a, b) => a.getTime() - b.getTime())[0];
    put(root, 
      head(),
      h(
        'div.rv-done',
        {},
        h('h2', {}, t(R.done)),
        h('p', {}, t(fmt(R.summary, { n: reviewed.size, d: nextDue ? relDays(nextDue, new Date()) : '—' }))),
        calibration(),
        h('a.btn', { href: href({ name: 'home' }) }, t(UI.backHome)),
      ),
    );
  };

  const showCard = () => {
    mounts.splice(0).forEach((m) => m.dispose());
    if (index >= queue.length) return finish();
    if (!extended && Date.now() - startedAt > DAILY_MINUTES * 60000) {
      clear(root);
      put(root, head(), h('div.rv-done', {}, h('p', {}, t(R.budget)), h('div.row', {}, h('button.btn.primary', { type: 'button', onclick: finish }, t(UI.dismiss)), h('button.btn.ghost', { type: 'button', onclick: () => ((extended = true), showCard()) }, t(R.more)))));
      return;
    }
    const entry = queue[index];
    const card = cards.get(entry.concept);
    const src = sources.get(entry.candidate.id)!;
    const concept = registry.concepts.get(entry.concept);
    const block = registry.blocks.get(blockOfConcept(entry.concept) ?? '');
    const shownAt = Date.now();
    const host = h('div.rv-item');
    const after = h('div.rv-after', { 'aria-live': 'polite' });
    const nextBtn = h('button.btn.primary', { type: 'button', hidden: true, onclick: () => (index++, showCard()) }, t(R.next), icon('next'));

    const grade = (correct: boolean, confidence: Confidence, hinted = false) => {
      const ms = Date.now() - shownAt;
      const rating = ratingFor({ correct, confidence, ms, normMs: entry.candidate.seconds * 1000, hinted });
      const before = buildCards(store.log).get(entry.concept);
      store.record({ kind: REVIEW_EVENT, concept: entry.concept, item: entry.candidate.id, format: entry.candidate.format, rating, correct, confidence, ms });
      reviewed.add(entry.concept);
      cards = buildCards(store.log);
      const nowCard = cards.get(entry.concept);
      clear(after);
      if (nowCard) {
        const days = before ? forecast(before.card, new Date()) : undefined;
        after.append(
          h(
            'p.rv-interval',
            {},
            h('span.rv-rating', { 'data-rating': String(rating) }, t(RATING_NAMES[rating])),
            ' · ',
            `${t(R.nextIn)} `,
            relDays(nowCard.card.due, new Date()).replace(/^через |^in /, ''),
            days ? h('span.muted.small', {}, ` (${t(bi('если бы «легко»', 'had it been “easy”'))}: ${Math.max(1, Math.round(days.easy))} ${t(R.days)})`) : null,
          ),
        );
      }
      if (!correct && confidence === 3 && !requeued.has(entry.concept)) {
        requeued.add(entry.concept);
        after.append(h('p.rv-note', {}, t(R.confident)));
        const others = (byConcept.get(entry.concept) ?? []).filter((c) => c.format !== entry.candidate.format && !(phone && c.desktop));
        const again = others[0] ?? entry.candidate;
        queue = [...queue, { concept: entry.concept, candidate: again, reason: 'confident-miss' }];
      }
      nextBtn.hidden = false;
      nextBtn.focus();
    };

    if (src.kind === 'quiz') {
      let answered = false;
      mounts.push(
        mountQuiz(host, src.item, {
          context: 'review',
          md: (b) => prose(b),
          onAnswered: (g) => {
            // Only the first answer on this card is graded; "try again" is for learning.
            if (answered) return;
            answered = true;
            const conf = (store.state.quiz[src.item.id]?.confidence.slice(-1)[0] ?? 2) as Confidence;
            grade(g.correct, conf);
          },
        }),
      );
    } else {
      host.append(h('p.small.muted', {}, icon('term'), ' ', t(R.sandbox)));
      const lab = h('div');
      host.append(lab);
      let graded = false;
      mounts.push(
        mountLab(lab, {
          key: `review/${entry.candidate.id}`,
          setup: src.setup,
          tasks: [{ ...src.task, id: `${src.task.id}-r${Date.now().toString(36)}` }],
          level: levelFor(block?.id),
          block: block?.id,
          index: 0,
          count: 1,
          exam: true,
          onTaskPass: () => {
            if (graded) return;
            graded = true;
            grade(true, 2);
          },
        }),
      );
      host.append(
        h('button.btn.ghost.small', {
          type: 'button',
          onclick: (e: Event) => {
            if (graded) return;
            graded = true;
            (e.currentTarget as HTMLButtonElement).disabled = true;
            grade(false, 1);
          },
        }, t(R.skipTask)),
      );
    }

    clear(root);
    put(root, 
      h(
        'header.rv-bar',
        {},
        h('span.rv-count', {}, `${index + 1} ${t(R.of)} ${queue.length}`),
        h('div.rv-progress', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': queue.length, 'aria-valuenow': index }, h('span', { style: `width:${(index / queue.length) * 100}%` })),
        h('a.small', { href: href({ name: 'explainer', id: 'career.fsrs' }) }, t(R.why)),
      ),
      h(
        'article.rv-card',
        {},
        h('div.rv-meta', {}, concept ? conceptLink(concept.id) : h('span', {}, entry.concept), block ? h('span.badge', {}, t(block.title)) : null, h('span.muted.small', {}, t(reasonLine(entry, card, now)))),
        host,
        after,
        h('div.rv-actions', {}, nextBtn),
      ),
    );
  };

  intro();
  return { el: root, dispose: () => mounts.forEach((m) => m.dispose()) };
}
