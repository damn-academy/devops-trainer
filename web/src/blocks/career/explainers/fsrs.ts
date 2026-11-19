// О-4 "Why this question came back today" (10 §5.2): spaced review on FSRS,
// computed with the same scheduler the review page uses. Knobs: the target
// recall, today's outcome, how many good reviews came before, a confident
// mistake. Break: reviewing in the same format every time.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { createEmptyCard } from 'ts-fsrs';
import { Rating, scheduler, type Grade } from '../../../engine/quiz/fsrs';

type P = { retention: number; outcome: string; before: number; confident: boolean };

const DAY = 86400000;
const GRADES: Record<string, Grade> = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };

export interface FsrsRun {
  /** Days until the next review after today's answer. */
  interval: number;
  stability: number;
  /** Reviews of this concept over the next 30 days at the same outcome. */
  perMonth: number;
}

/** Replay a card: first review a day after the lesson, `before` good reviews on time, then today's outcome. */
export function fsrsRun(p: P): FsrsRun {
  const f = scheduler(p.retention);
  const t0 = new Date('2026-01-01T09:00:00.000Z');
  let card = createEmptyCard(t0);
  let now = new Date(t0.getTime() + DAY);
  for (let i = 0; i < p.before; i++) {
    card = f.next(card, now, Rating.Good).card;
    now = new Date(Math.max(card.due.getTime(), now.getTime() + DAY));
  }
  const grade = p.confident ? Rating.Again : GRADES[p.outcome] ?? Rating.Good;
  const rec = f.next(card, now, grade).card;
  const interval = (rec.due.getTime() - now.getTime()) / DAY;
  // Reviews in the next 30 days if every later answer is "good".
  let c = rec;
  let at = rec.due;
  let perMonth = 0;
  const end = now.getTime() + 30 * DAY;
  while (at.getTime() <= end && perMonth < 60) {
    perMonth++;
    c = f.next(c, at, Rating.Good).card;
    at = c.due;
  }
  return { interval, stability: rec.stability, perMonth };
}

const days = (x: number) => (x < 1 ? `${Math.max(1, Math.round(x * 24 * 60))} min` : `${Math.round(x)} d`);
const card = (whatRu: string, whatEn: string, whoRu: string, whoEn: string) => ({ what: bi(whatRu, whatEn), who: bi(whoRu, whoEn) });

export const fsrsModel = defineModel<P>({
  id: 'career.fsrs',
  block: 'career',
  title: bi('Почему этот вопрос вернулся сегодня', 'Why this question came back today'),
  summary: bi('Повторение по FSRS: каждое понятие возвращается тогда, когда вероятность вспомнить падает до цели. Тот же планировщик, что на экране повторения.', 'Review with FSRS: each concept returns when the chance of recall falls to the target. The same scheduler as on the review screen.'),
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      { id: 'answer', label: bi('Ваш ответ', 'Your answer'), sub: '—', family: 'user', x: 16, y: 40, w: 176, h: 64, card: card('Верно или нет, с какой уверенностью и за сколько секунд.', 'Right or not, how sure you were and how many seconds it took.', 'Вы, на экране повторения.', 'You, on the review screen.') },
      { id: 'rating', label: bi('Рейтинг', 'Rating'), sub: 'good', family: 'gauge', x: 312, y: 40, w: 176, h: 64, card: card('Ошибка — «снова»; верно, но наугад или медленно — «с трудом»; верно в норму — «вспомнил»; быстро и с «знаю» — «легко».', 'A mistake is “again”; right but guessed or slow is “hard”; right within the norm is “good”; fast with “I know” is “easy”.', 'Курс по правилу из главы о повторении.', 'The course, by the rule of the review chapter.') },
      { id: 'fsrs', label: 'FSRS', sub: 'retention 0.90', family: 'process', shape: 'hex', x: 608, y: 40, w: 176, h: 64, card: card('Планировщик: по истории ответов оценивает, как быстро вы забываете это понятие, и выбирает день, когда вероятность вспомнить упадёт до цели.', 'The scheduler: from the answer history it estimates how fast you forget this concept and picks the day the chance of recall falls to the target.', 'Библиотека ts-fsrs у вас в браузере.', 'The ts-fsrs library in your browser.') },
      { id: 'stab', label: bi('Стабильность', 'Stability'), sub: '—', family: 'gauge', x: 608, y: 200, w: 176, h: 64, card: card('Сколько дней память держится на уровне цели. Растёт с каждым верным ответом в срок.', 'How many days the memory stays at the target level. It grows with every right answer on time.', 'FSRS.', 'FSRS.') },
      { id: 'due', label: bi('Следующее повторение', 'Next review'), sub: '—', family: 'flow', x: 608, y: 352, w: 176, h: 64, card: card('Через сколько вернётся понятие.', 'When the concept comes back.', 'FSRS.', 'FSRS.') },
      { id: 'queue', label: bi('Очередь на день', 'The day’s queue'), sub: '≤ 15 min', family: 'neutral', shape: 'buffer', x: 312, y: 352, w: 176, h: 64, card: card('Понятия, чей срок наступил, вперемешку из разных блоков, до 15 минут или 30 карточек.', 'Concepts whose time has come, mixed across blocks, up to 15 minutes or 30 cards.', 'Экран повторения.', 'The review screen.') },
      { id: 'miss', label: bi('Уверенные ошибки', 'Confident mistakes'), sub: '0', family: 'neutral', shape: 'buffer', x: 312, y: 200, w: 176, h: 64, card: card('Ошибка с пометкой «знаю» возвращается в конце той же сессии в другом формате и на следующий день: такие ошибки исправляются лучше всего.', 'A mistake marked “I know” comes back at the end of the same session in another format, and the next day: such mistakes are the easiest to fix.', 'Экран повторения.', 'The review screen.') },
      { id: 'format', label: bi('Формат вопроса', 'Question format'), sub: 'mcq → order', family: 'obj', x: 16, y: 200, w: 176, h: 64, card: card('Каждый раз — другой вид вопроса: выбор, порядок, команда, задание в песочнице. Иначе запоминается ответ, а не понятие.', 'Each time another kind of question: a choice, an order, a command, a sandbox task. Otherwise you remember the answer, not the concept.', 'Курс.', 'The course.') },
    ],
    edges: [
      { id: 'e-r', from: 'answer', to: 'rating', label: bi('3 признака', '3 signs'), card: card('Три признака ответа складываются в один рейтинг.', 'Three signs of the answer add up to one rating.', 'Курс.', 'The course.') },
      { id: 'e-f', from: 'rating', to: 'fsrs', label: bi('рейтинг', 'rating'), card: card('Рейтинг уходит в планировщик.', 'The rating goes to the scheduler.', 'Курс.', 'The course.') },
      { id: 'e-s', from: 'fsrs', to: 'stab', label: bi('новая стабильность', 'new stability'), card: card('Верный ответ в срок делает память устойчивее; ошибка — сбрасывает.', 'A right answer on time makes memory more stable; a mistake resets it.', 'FSRS.', 'FSRS.') },
      { id: 'e-d', from: 'stab', to: 'due', label: bi('интервал', 'interval'), card: card('Из стабильности и цели получается интервал до следующего раза.', 'Stability and the target give the interval to the next time.', 'FSRS.', 'FSRS.') },
      { id: 'e-q', from: 'due', to: 'queue', label: bi('в день срока', 'on the due day'), card: card('В день срока понятие попадает в очередь.', 'On the due day the concept joins the queue.', 'Экран повторения.', 'The review screen.') },
      { id: 'e-m', from: 'rating', to: 'miss', label: bi('«знаю», но ошибка', '“I know” but wrong'), card: card('Только уверенная ошибка идёт сюда.', 'Only a confident mistake goes here.', 'Курс.', 'The course.') },
      { id: 'e-fmt', from: 'format', to: 'answer', label: bi('другой вид', 'another kind'), card: card('Следующий вопрос по понятию будет другого вида.', 'The next question on the concept will be of another kind.', 'Курс.', 'The course.') },
    ],
  },
  params: [
    {
      id: 'retention',
      label: bi('Целевое вспоминание', 'Target recall'),
      kind: 'range',
      min: 0.8,
      max: 0.95,
      step: 0.01,
      default: 0.9,
      near: 'fsrs',
      predict: {
        prompt: bi('Цель — 95% вместо 90%. Повторений в месяц станет больше или меньше?', 'The target is 95% instead of 90%. Will there be more or fewer reviews a month?'),
        options: [
          { id: 'more', text: bi('Больше', 'More') },
          { id: 'fewer', text: bi('Меньше', 'Fewer') },
        ],
        resolve: (prev, next) => ((next[next.length - 1]?.metrics?.month ?? 0) >= (prev[prev.length - 1]?.metrics?.month ?? 0) ? 'more' : 'fewer'),
      },
    },
    {
      id: 'outcome',
      label: bi('Как ответил сегодня', 'How you answered today'),
      kind: 'choice',
      default: 'good',
      near: 'rating',
      options: [
        { id: 'again', label: bi('ошибся', 'wrong') },
        { id: 'hard', label: bi('верно, но наугад или медленно', 'right, but guessed or slow') },
        { id: 'good', label: bi('верно', 'right') },
        { id: 'easy', label: bi('быстро и уверенно', 'fast and sure') },
      ],
    },
    { id: 'before', label: bi('Верных повторений до сегодня', 'Good reviews before today'), kind: 'range', min: 0, max: 6, step: 1, default: 2, near: 'stab' },
    {
      id: 'confident',
      label: bi('Ответил «знаю» — и ошибся', 'Said “I know” — and was wrong'),
      kind: 'toggle',
      default: false,
      near: 'miss',
      predict: {
        prompt: bi('Вы ответили «знаю» и ошиблись. Когда вопрос вернётся?', 'You said “I know” and were wrong. When does the question come back?'),
        options: [
          { id: 'session', text: bi('В этой же сессии и завтра', 'In this same session, and tomorrow') },
          { id: 'week', text: bi('Через неделю, как обычно', 'In a week, as usual') },
        ],
        resolve: () => 'session',
      },
    },
  ],
  breaks: [
    {
      id: 'same-format',
      label: bi('Повторять всегда одним форматом', 'Always review in the same format'),
      remove: ['format', 'e-fmt'],
      predict: {
        prompt: bi('Все повторения — один и тот же вопрос. Что будет с понятием?', 'Every review is the same question. What happens to the concept?'),
        options: [
          { id: 'stuck', text: bi('Застрянет перед «освоено»: запомнился ответ, а не понятие', 'It gets stuck before “mastered”: you remember the answer, not the concept') },
          { id: 'faster', text: bi('Освоится быстрее', 'It is mastered faster') },
        ],
        resolve: () => 'stuck',
      },
    },
  ],
  metrics: [
    { id: 'next', label: bi('до следующего, дней', 'days to the next'), unit: 'd' },
    { id: 'stab', label: bi('стабильность, дней', 'stability, days'), unit: 'd' },
    { id: 'month', label: bi('повторений за месяц', 'reviews in a month') },
  ],
  run(p, broken): Step[] {
    const r = fsrsRun(p);
    const outcome = p.confident ? 'again' : p.outcome;
    const m = { next: Math.round(r.interval * 10) / 10, stab: Math.round(r.stability * 10) / 10, month: r.perMonth };
    const steps: Step[] = [
      { id: 'answer', label: bi('ответ', 'answer'), caption: p.confident ? bi('Вы ответили «знаю», но ошиблись.', 'You said “I know” but were wrong.') : outcome === 'again' ? bi('Вы ошиблись.', 'You were wrong.') : bi('Вы ответили верно.', 'You answered right.'), focus: ['answer'], values: { answer: p.confident ? 'wrong · I know' : outcome }, states: { answer: outcome === 'again' ? 'err' : 'ok' } },
      { id: 'rating', label: bi('рейтинг', 'rating'), caption: fmt(bi('Рейтинг: {r}.', 'Rating: {r}.'), { r: outcome }), focus: ['e-r', 'rating'], tokens: [{ edge: 'e-r' }], values: { rating: outcome } },
    ];
    if (p.confident) steps.push({ id: 'miss', label: bi('уверенная ошибка', 'confident miss'), caption: bi('Уверенная ошибка: вопрос другого вида вернётся в конце этой сессии и ещё раз завтра.', 'A confident mistake: a question of another kind comes back at the end of this session and again tomorrow.'), focus: ['e-m', 'miss'], tokens: [{ edge: 'e-m' }], values: { miss: '1' }, fill: { miss: 0.5 } });
    steps.push(
      { id: 'fsrs', label: 'FSRS', caption: fmt(bi('Планировщик пересчитывает память при цели {t}%.', 'The scheduler recomputes the memory at a {t}% target.'), { t: Math.round(p.retention * 100) }), focus: ['e-f', 'fsrs'], tokens: [{ edge: 'e-f' }], values: { fsrs: `retention ${p.retention.toFixed(2)}` } },
      { id: 'stab', label: bi('стабильность', 'stability'), caption: fmt(bi('Стабильность — {s}: столько дней память держится у цели.', 'Stability is {s}: that is how many days memory stays at the target.'), { s: days(r.stability) }), focus: ['e-s', 'stab'], tokens: [{ edge: 'e-s' }], values: { stab: days(r.stability) } },
      { id: 'due', label: bi('интервал', 'interval'), caption: fmt(bi('Следующее повторение — через {d}. За месяц понятие вернётся {n} раз.', 'The next review is in {d}. Over a month the concept returns {n} times.'), { d: days(r.interval), n: r.perMonth }), focus: ['e-d', 'due', 'e-q', 'queue'], tokens: [{ edge: 'e-d' }, { edge: 'e-q' }], values: { due: days(r.interval) }, fill: { queue: Math.min(1, r.perMonth / 10) }, metrics: m },
    );
    if (broken.has('same-format')) {
      steps.push({
        id: 'stuck',
        label: bi('застряло', 'stuck'),
        caption: bi('Все верные ответы — в одном формате: понятие не переходит в «освоено».', 'All the right answers are in one format: the concept does not become “mastered”.'),
        focus: ['answer'],
        states: { answer: 'warn' },
        metrics: m,
        broken: { at: 'answer', message: 'right answers: 6 · formats: [mcq] · state: practicing', caption: bi('запомнили ответ, а не понятие: перенос не подтверждён.', 'the answer was remembered, not the concept: transfer is not confirmed.') },
      });
    } else steps.push({ id: 'format', label: bi('формат', 'format'), caption: bi('В следующий раз — другой вид вопроса: так проверяется понятие, а не память на один ответ.', 'Next time it is another kind of question: that checks the concept, not memory for one answer.'), focus: ['e-fmt', 'format'], tokens: [{ edge: 'e-fmt' }], metrics: m });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const m = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    if (change.kind === 'break') return change.on ? bi('Один формат на все повторения: ответы верны, но понятие застревает перед «освоено».', 'One format for every review: the answers are right, but the concept is stuck before “mastered”.') : bi('Формат снова меняется от раза к разу.', 'The format changes from time to time again.');
    if (change.id === 'retention') return fmt(bi('Цель {a} → {b}: интервал {i0} → {i1} дн., повторений за месяц {n0} → {n1}. Выше цель — чаще повторения.', 'Target {a} → {b}: interval {i0} → {i1} d, reviews a month {n0} → {n1}. A higher target means more frequent reviews.'), { a: Number(a.retention).toFixed(2), b: Number(b.retention).toFixed(2), i0: m(prev).next ?? 0, i1: m(next).next ?? 0, n0: m(prev).month ?? 0, n1: m(next).month ?? 0 });
    if (change.id === 'confident') return b.confident ? bi('Уверенная ошибка: интервал сжимается до минут, и понятие идёт в отдельную очередь.', 'A confident mistake: the interval shrinks to minutes and the concept goes to a separate queue.') : bi('Без уверенной ошибки обычный интервал.', 'Without the confident mistake, the usual interval.');
    return fmt(bi('Интервал теперь {i} дн.: чем увереннее и чаще верно, тем реже вопрос возвращается.', 'The interval is now {i} d: the surer and more often right, the less often the question returns.'), { i: m(next).next ?? 0 });
  },
});
