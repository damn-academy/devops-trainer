// О-4 "Why this question came back today" (10 §5.2): spaced review on FSRS,
// computed with the same scheduler the review page uses. Knobs: the target
// recall, today's outcome, how many good reviews came before, a confident
// mistake. Break: reviewing in the same format every time.
//
// Reading order: the explainer is opened from the review screen without a
// lesson around it, so the summary and the intro carry the whole context. At
// the start only your answer and the date of the next review are on the
// picture; the grading, the scheduler, the stability of memory, the day's
// queue and the next question's format appear one by one. Each acting block
// says in a callout what it does, and its result travels along the line.

import { defineModel } from '../../../core/define';
import { bi, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { createEmptyCard } from 'ts-fsrs';
import { Rating, RATING_NAMES, scheduler, type Grade } from '../../../engine/quiz/fsrs';
import { fmtb, nouned, startWith, tr } from './util';

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

/** "12 d" / "10 min" for node values. */
const days = (x: number) => {
  const min = Math.max(1, Math.round(x * 24 * 60));
  return x < 1 ? tr(`${min} мин`, `${min} min`) : tr(`${Math.round(x)} дн.`, `${Math.round(x)} d`);
};
/** «через 12 дней», «через 10 минут» as words. */
const span = (x: number): Bi => (x < 1 ? nouned(Math.max(1, Math.round(x * 24 * 60)), ['минуту', 'минуты', 'минут'], ['minute', 'minutes']) : nouned(Math.round(x), ['день', 'дня', 'дней'], ['day', 'days']));
const card = (whatRu: string, whatEn: string, whoRu: string, whoEn: string) => ({ what: bi(whatRu, whatEn), who: bi(whoRu, whoEn) });
const ratingName = (o: string): Bi => {
  const r = RATING_NAMES[GRADES[o] ?? Rating.Good];
  return bi(`«${r.ru}»`, `“${r.en}”`);
};

const ALL = ['answer', 'rating', 'fsrs', 'stab', 'due', 'queue', 'miss', 'format', 'e-r', 'e-f', 'e-s', 'e-d', 'e-q', 'e-m', 'e-fmt', 'e-ans'];

const OUTCOME: Record<string, Bi> = {
  again: bi('Вы ответили на вопрос неверно.', 'You answered wrong.'),
  hard: bi('Вы ответили верно, но наугад или заметно дольше обычного.', 'You answered right, but by guessing or slowly.'),
  good: bi('Вы ответили верно и уложились в обычное время.', 'You answered right within the usual time.'),
  easy: bi('Вы ответили верно, быстро и с отметкой «знаю».', 'You answered right, fast and marked “I know”.'),
};

export const fsrsModel = defineModel<P>({
  id: 'career.fsrs',
  frame: 'visible',
  block: 'career',
  title: bi('Почему этот вопрос вернулся сегодня', 'Why this question came back today'),
  summary: bi(
    'Курс возвращает каждое понятие на повторение не по расписанию, а тогда, когда вероятность, что вы его вспомните, падает до заданной цели, обычно до 90 %. Этот день вычисляет планировщик FSRS по истории ваших ответов. Схема показывает, что происходит с одним вопросом после сегодняшнего ответа, и считает тем же планировщиком, что и экран повторения.',
    'The course brings each concept back not on a fixed schedule but when the chance that you recall it falls to the target, usually 90%. The FSRS scheduler computes that day from your answer history. The diagram follows one question after today’s answer, with the same scheduler as the review screen.',
  ),
  intro: bi(
    'Схема собирается по шагам, и сейчас на ней только ваш ответ и срок следующего повторения. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что этот блок делает, а карточка на линии показывает, что он передаёт дальше. Под схемой видны три числа: через сколько дней вопрос вернётся, насколько устойчива память и сколько раз за месяц вопрос появится снова.\n\nПосле первого прохода выберите в «Параметрах», как вы ответили сегодня, или повысьте цель вспоминания и посмотрите, как изменятся эти числа.',
    'The diagram builds itself step by step, and now it shows only your answer and the date of the next review. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted block says what that block does, and the card on the line shows what it hands on. Under the diagram you see three numbers: in how many days the question returns, how stable the memory is and how many times a month the question appears again.\n\nAfter the first pass choose in “Parameters” how you answered today, or raise the target, and watch the numbers.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('то, что передаётся дальше, то есть оценка или число дней', 'what is handed on, that is, the rating or the number of days') },
    { mark: 'icon:user', text: bi('ваш ответ', 'your answer') },
    { mark: 'icon:process', text: bi('расчёт, который делает курс', 'the course’s computation') },
    { mark: 'icon:folder', text: bi('очередь вопросов', 'a queue of questions') },
    { mark: 'icon:file', text: bi('вопрос и его вид', 'the question and its kind') },
    { mark: 'ok', text: bi('ответ верный', 'a right answer') },
    { mark: 'err', text: bi('ответ неверный', 'a wrong answer') },
    { mark: 'warn', text: bi('понятие застряло и не считается освоенным', 'the concept is stuck, not mastered') },
  ],
  stopLabel: bi('Понятие не освоено', 'The concept is not mastered'),
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      { id: 'answer', label: bi('Ваш ответ', 'Your answer'), icon: 'user', sub: '—', family: 'user', x: 16, y: 40, w: 192, h: 64, card: card('Курс записывает три признака ответа: верный он или нет, насколько вы были уверены и за сколько секунд ответили.', 'Right or not, how sure you were and how many seconds it took.', 'Отвечаете вы на экране повторения.', 'You, on the review screen.') },
      { id: 'rating', label: bi('Оценка ответа', 'Rating'), icon: 'process', work: 'spin', sub: 'good', family: 'gauge', x: 312, y: 40, w: 192, h: 64, card: card('Курс переводит ответ в одну из четырёх оценок. Ошибка получает оценку «снова». Верный ответ наугад, с подсказкой или вдвое медленнее обычного получает оценку «с трудом», верный ответ в обычное время — «вспомнил», а быстрый верный ответ с отметкой «знаю» — «легко».', 'A mistake is “again”; right but guessed, hinted or twice as slow is “hard”; right within the norm is “good”; fast with “I know” is “easy”.', 'Оценку выставляет курс по этому правилу.', 'The course, by the rule of the review chapter.') },
      { id: 'fsrs', label: bi('Планировщик FSRS', 'FSRS scheduler'), icon: 'process', work: 'spin', sub: 'retention 0.90', family: 'process', shape: 'hex', x: 608, y: 40, w: 208, h: 64, card: card('Планировщик повторений. По истории ваших ответов он оценивает, как быстро вы забываете это понятие, и выбирает день, когда вероятность вспомнить его упадёт до цели.', 'From your answer history it estimates how fast you forget this concept and picks the day the chance of recall falls to the target.', 'Это библиотека ts-fsrs, которая работает у вас в браузере.', 'The ts-fsrs library in your browser.') },
      { id: 'stab', label: bi('Устойчивость памяти', 'Stability'), icon: 'process', sub: '—', family: 'gauge', x: 608, y: 200, w: 208, h: 64, card: card('Число дней, в течение которых вероятность вспомнить понятие остаётся не ниже цели. С каждым верным ответом, данным вовремя, это число растёт, а после ошибки сильно падает.', 'How many days the memory stays at the target. It grows with every right answer on time and drops after a mistake.', 'Число вычисляет FSRS.', 'FSRS.') },
      { id: 'due', label: bi('Следующее повторение', 'Next review'), icon: 'file', sub: '—', family: 'flow', x: 608, y: 352, w: 208, h: 64, card: card('Срок, через который вопрос по этому понятию вернётся. После ошибки это несколько минут, а после верного ответа несколько дней.', 'When the question on this concept comes back. After a mistake it is a few minutes, and after a right answer a few days.', 'Срок назначает FSRS.', 'FSRS.') },
      { id: 'queue', label: bi('Очередь на день', 'The day’s queue'), icon: 'folder', sub: { ru: '≤ 15 мин', en: '≤ 15 min' }, family: 'neutral', shape: 'buffer', x: 312, y: 352, w: 192, h: 64, card: card('Здесь собираются вопросы, срок которых наступил, вперемешку из разных блоков курса. В одной сессии повторения не больше 15 минут или 30 вопросов.', 'Questions whose day has come, mixed across blocks, up to 15 minutes or 30 cards.', 'Очередь собирает экран повторения.', 'The review screen.') },
      { id: 'miss', label: bi('Уверенные ошибки', 'Confident mistakes'), icon: 'folder', sub: '0', family: 'neutral', shape: 'buffer', x: 312, y: 200, w: 192, h: 64, card: card('В эту отдельную очередь попадают ошибки, сделанные с отметкой «знаю». Такой вопрос возвращается в другом виде в конце той же сессии и ещё раз на следующий день, потому что уверенную ошибку легче всего исправить, пока она свежа.', 'A mistake marked “I know” comes back in another form at the end of the same session and the next day.', 'Очередь ведёт экран повторения.', 'The review screen.') },
      { id: 'format', label: bi('Вид следующего вопроса', 'Next question’s kind'), icon: 'file', sub: 'mcq → order', family: 'obj', x: 16, y: 200, w: 192, h: 64, card: card('Каждый раз курс задаёт вопрос по понятию в другом виде: выбор ответа, порядок шагов, команда, задание в песочнице. Если вопрос всегда один и тот же, запоминается ответ, а не понятие.', 'Each time another kind of question: a choice, an order, a command, a sandbox task. Otherwise you remember the answer, not the concept.', 'Вид выбирает курс.', 'The course.') },
    ],
    edges: [
      { id: 'e-r', from: 'answer', to: 'rating', label: bi('три признака', 'three signs'), card: card('Верность, уверенность и время ответа складываются в одну оценку.', 'Three signs add up to one rating.', 'Оценку складывает курс.', 'The course.') },
      { id: 'e-f', from: 'rating', to: 'fsrs', label: bi('оценка', 'rating'), card: card('Оценка передаётся планировщику.', 'The rating goes to the scheduler.', 'Оценку передаёт курс.', 'The course.') },
      { id: 'e-s', from: 'fsrs', to: 'stab', label: bi('новая устойчивость', 'new stability'), card: card('Верный ответ вовремя делает память устойчивее, ошибка снижает устойчивость.', 'A right answer on time makes memory more stable; a mistake lowers it.', 'Устойчивость пересчитывает FSRS.', 'FSRS.') },
      { id: 'e-d', from: 'stab', to: 'due', label: bi('интервал', 'interval'), card: card('Из устойчивости памяти и цели получается интервал до следующего раза.', 'Stability and the target give the interval.', 'Интервал вычисляет FSRS.', 'FSRS.') },
      { id: 'e-q', from: 'due', to: 'queue', label: bi('в день срока', 'on the due day'), card: card('В день срока вопрос попадает в очередь повторения.', 'On the due day the question joins the queue.', 'Вопрос в очередь ставит экран повторения.', 'The review screen.') },
      { id: 'e-m', from: 'rating', to: 'miss', label: bi('«знаю», но ошибка', '“I know” but wrong'), card: card('Сюда попадает только ошибка, сделанная с отметкой «знаю».', 'Only a confident mistake goes here.', 'Такую ошибку отбирает курс.', 'The course.') },
      { id: 'e-fmt', from: 'queue', to: 'format', label: bi('другой вид', 'another kind'), via: [[112, 384]], labelAt: 0.4, card: card('Из очереди вопрос по понятию выходит уже в другом виде.', 'The question leaves the queue in another kind.', 'Новый вид вопроса выбирает курс.', 'The course.') },
      { id: 'e-ans', from: 'format', to: 'answer', label: bi('новый вопрос', 'new question'), card: card('Новый вопрос того же понятия снова ждёт вашего ответа.', 'A new question on the same concept waits for your answer.', 'Вопрос задаёт курс, а отвечаете вы.', 'The course.') },
    ],
  },
  params: [
    {
      id: 'outcome',
      label: bi('Как вы ответили сегодня', 'How you answered today'),
      kind: 'choice',
      default: 'good',
      near: 'rating',
      group: bi('Ваш ответ', 'Your answer'),
      options: [
        { id: 'again', label: bi('ошиблись', 'wrong') },
        { id: 'hard', label: bi('ответили верно, но наугад или медленно', 'right, but guessed or slow') },
        { id: 'good', label: bi('ответили верно за обычное время', 'right within the usual time') },
        { id: 'easy', label: bi('ответили верно, быстро и уверенно', 'right, fast and sure') },
      ],
    },
    {
      id: 'confident',
      label: bi('Отметили «знаю», а ответили неверно', 'Marked “I know” and were wrong'),
      kind: 'toggle',
      default: false,
      near: 'miss',
      group: bi('Ваш ответ', 'Your answer'),
      predict: {
        prompt: bi('Вы отметили «знаю», но ответили неверно. Когда этот вопрос вернётся?', 'You marked “I know” but were wrong. When does the question come back?'),
        options: [
          { id: 'session', text: bi('В конце этой же сессии и ещё раз завтра', 'At the end of this session, and tomorrow') },
          { id: 'week', text: bi('Через несколько дней, как после обычной ошибки', 'In a few days, as after an ordinary mistake') },
        ],
        resolve: () => 'session',
      },
    },
    { id: 'before', label: bi('Сколько раз до сегодня вы уже ответили верно', 'Right answers before today'), kind: 'range', min: 0, max: 6, step: 1, default: 2, near: 'stab', group: bi('Ваш ответ', 'Your answer') },
    {
      id: 'retention',
      label: bi('С какой вероятностью вы должны вспомнить понятие (цель)', 'Target chance of recall'),
      kind: 'range',
      min: 0.8,
      max: 0.95,
      step: 0.01,
      default: 0.9,
      near: 'fsrs',
      group: bi('Настройка повторения', 'Review settings'),
      predict: {
        prompt: bi('Вы меняете цель, то есть вероятность, с которой вы должны вспомнить понятие к следующему повторению. Как число повторений за месяц связано с целью?', 'You change the target chance of recall. How does the number of reviews a month follow the target?'),
        options: [
          { id: 'more', text: bi('Чем выше цель, тем больше повторений за месяц или столько же', 'The higher the target, the more reviews a month, or as many') },
          { id: 'fewer', text: bi('Чем выше цель, тем меньше повторений за месяц', 'The higher the target, the fewer reviews a month') },
        ],
        resolve: (prev, next) => {
          const month = (s: Step[]) => s[s.length - 1]?.metrics?.month ?? 0;
          const target = (s: Step[]) => Number(String(s.find((x) => x.id === 'fsrs')?.values?.fsrs ?? '').replace('retention ', '')) || 0;
          const dm = month(next) - month(prev);
          const dt = target(next) - target(prev);
          return dm === 0 || dt === 0 || Math.sign(dm) === Math.sign(dt) ? 'more' : 'fewer';
        },
      },
    },
  ],
  breaks: [
    {
      id: 'same-format',
      label: bi('Задавать вопрос по понятию всегда в одном и том же виде', 'Always ask in the same kind'),
      remove: ['format', 'e-fmt', 'e-ans'],
      predict: {
        prompt: bi('На каждом повторении вам задают один и тот же вопрос с выбором ответа, и вы каждый раз отвечаете верно. Будет ли понятие считаться освоенным?', 'Every review is the same multiple-choice question, and you answer it right every time. Is the concept mastered?'),
        options: [
          { id: 'stuck', text: bi('Нет, потому что вы запомнили ответ на этот вопрос, а понятие курс не проверил', 'No, because you remember the answer to this question, while the course has not checked the concept') },
          { id: 'faster', text: bi('Да, и даже быстрее, ведь одинаковый вопрос легче вспомнить', 'Yes, and even faster, because the same question is easier to recall') },
        ],
        resolve: () => 'stuck',
      },
    },
  ],
  metrics: [
    { id: 'next', label: bi('дней до следующего повторения', 'days to the next review') },
    { id: 'stab', label: bi('устойчивость памяти, дней', 'stability, days') },
    { id: 'month', label: bi('повторений за месяц', 'reviews in a month') },
  ],
  run(p, broken): Step[] {
    const r = fsrsRun(p);
    const outcome = p.confident ? 'again' : p.outcome;
    const wrong = outcome === 'again';
    const m = { next: Math.round(r.interval * 10) / 10, stab: Math.round(r.stability * 10) / 10, month: r.perMonth };
    const steps: Step[] = [
      {
        id: 'answer',
        label: bi('ответ', 'answer'),
        caption: p.confident ? bi('Вы отметили «знаю», но ответили неверно. Для курса это особый случай: уверенная ошибка говорит, что вы держите в памяти неправильную картину.', 'You marked “I know” but were wrong: a confident mistake means a wrong picture is held in memory.') : OUTCOME[outcome] ?? OUTCOME.good,
        focus: ['answer'],
        say: { answer: p.confident ? bi('Вы отметили «знаю» и ошиблись.', 'You marked “I know” and were wrong.') : OUTCOME[outcome] ?? OUTCOME.good },
        states: { ...startWith(ALL, 'answer', 'due'), answer: wrong ? 'err' : 'ok' },
        values: { answer: p.confident ? tr('ошибка · «знаю»', 'wrong · I know') : t(ratingName(outcome)), queue: tr('до 15 минут', '≤ 15 min'), format: tr('выбор → порядок', 'mcq → order'), rating: t(ratingName('good')), fsrs: tr('цель 90 %', 'retention 0.90') },
        metrics: { next: 0, stab: 0, month: 0 },
      },
      {
        id: 'rating',
        label: bi('оценка', 'rating'),
        caption: fmtb(bi('Курс переводит ваш ответ в оценку {r}. Оценка учитывает не только верность, но и уверенность и время, потому что угаданный ответ не считается знанием.', 'The course turns your answer into the rating {r}: correctness, confidence and time count, and a lucky guess is not knowledge.'), { r: ratingName(outcome) }),
        focus: ['rating', 'e-r'],
        reveal: ['rating', 'e-r'],
        tokens: [{ edge: 'e-r', label: wrong ? bi('неверно', 'wrong') : bi('верно', 'right') }],
        say: { rating: fmtb(bi('Курс ставит ответу оценку {r}.', 'The course rates the answer {r}.'), { r: ratingName(outcome) }) },
        values: { rating: t(ratingName(outcome)) },
        metrics: { next: 0, stab: 0, month: 0 },
      },
    ];
    if (p.confident)
      steps.push({
        id: 'miss',
        label: bi('уверенная ошибка', 'confident miss'),
        caption: bi('Уверенная ошибка попадает ещё и в отдельную очередь. Вопрос по этому понятию, но другого вида вернётся в конце этой же сессии и ещё раз завтра, пока неправильная картина не закрепилась.', 'A confident mistake also goes to a separate queue: a question of another kind comes back at the end of this session and again tomorrow.'),
        focus: ['miss', 'e-m'],
        reveal: ['miss', 'e-m'],
        tokens: [{ edge: 'e-m', label: bi('«знаю», но ошибка', '“I know” but wrong') }],
        say: { miss: bi('Вопрос вернётся в конце этой сессии и ещё раз завтра.', 'It returns at the end of the session and tomorrow.') },
        values: { miss: '1' },
        fill: { miss: 0.5 },
        metrics: { next: 0, stab: 0, month: 0 },
      });
    steps.push(
      {
        id: 'fsrs',
        label: 'FSRS',
        caption: fmtb(bi('Планировщик FSRS получает оценку {r} и пересчитывает, как быстро вы забываете это понятие. Цель сейчас {t} %, поэтому следующее повторение нужно назначить на день, когда вероятность вспомнить понятие опустится до этого уровня.', 'FSRS gets the rating {r} and recomputes how fast you forget this concept, at a {t}% target.'), { r: ratingName(outcome), t: Math.round(p.retention * 100) }),
        focus: ['fsrs', 'e-f'],
        reveal: ['fsrs', 'e-f'],
        tokens: [{ edge: 'e-f', label: ratingName(outcome) }],
        say: { fsrs: fmtb(bi('FSRS пересчитывает память о понятии при цели {t} %.', 'FSRS recomputes the memory at a {t}% target.'), { t: Math.round(p.retention * 100) }) },
        values: { fsrs: tr(`цель ${Math.round(p.retention * 100)} %`, `retention ${p.retention.toFixed(2)}`) },
        metrics: { next: 0, stab: 0, month: 0 },
      },
      {
        id: 'stab',
        label: bi('устойчивость', 'stability'),
        caption: p.before === 0
          ? fmtb(bi('Устойчивость памяти теперь {s}, то есть столько времени вероятность вспомнить понятие остаётся не ниже цели. Верных ответов до сегодняшнего ещё не было, поэтому устойчивость пока невелика.', 'Stability is now {s}. There were no right answers before today, so it is still small.'), { s: span(r.stability) })
          : fmtb(bi('Устойчивость памяти теперь {s}, то есть столько времени вероятность вспомнить понятие остаётся не ниже цели. До сегодняшнего ответа вы {b} отвечали верно, и каждый такой ответ увеличивал устойчивость.', 'Stability is now {s}: that long the chance of recall stays at the target. You answered right {b} before today, and each time it grew.'), { s: span(r.stability), b: nouned(p.before, ['раз', 'раза', 'раз'], ['time', 'times']) }),
        focus: ['stab', 'e-s'],
        reveal: ['stab', 'e-s'],
        tokens: [{ edge: 'e-s', label: days(r.stability) }],
        say: { stab: fmtb(bi('Память о понятии держится около {s}.', 'The memory holds for about {s}.'), { s: span(r.stability) }) },
        values: { stab: days(r.stability) },
        metrics: { next: 0, stab: m.stab, month: 0 },
      },
      {
        id: 'due',
        label: bi('срок', 'due'),
        caption: r.perMonth > 0
          ? fmtb(bi('Из устойчивости памяти и цели получается срок, и вопрос вернётся через {d}. Если и дальше отвечать верно, за ближайший месяц он появится {n}.', 'The next review is in {d}. Answering right from now on, it returns {n} in the next month.'), { d: span(r.interval), n: nouned(r.perMonth, ['раз', 'раза', 'раз'], ['time', 'times']) })
          : fmtb(bi('Из устойчивости памяти и цели получается срок, и вопрос вернётся через {d}, так что в ближайший месяц вы его не увидите.', 'The next review is in {d}, so you will not see it in the next month.'), { d: span(r.interval) }),
        focus: ['due', 'e-d'],
        reveal: ['e-d'],
        tokens: [{ edge: 'e-d', label: days(r.interval) }],
        say: { due: fmtb(bi('Следующее повторение будет через {d}.', 'Next review in {d}.'), { d: span(r.interval) }) },
        values: { due: days(r.interval) },
        metrics: m,
      },
      {
        id: 'queue',
        label: bi('очередь', 'queue'),
        caption: bi('В день срока вопрос попадает в очередь повторения. Там он стоит вперемешку с вопросами из других блоков, и вся сессия занимает не больше 15 минут.', 'On the due day the question joins the queue, mixed with other blocks, in a session of at most 15 minutes.'),
        focus: ['queue', 'e-q'],
        reveal: ['queue', 'e-q'],
        tokens: [{ edge: 'e-q', label: bi('вопрос', 'question') }],
        say: { queue: bi('В день срока вопрос встаёт в очередь повторения.', 'On the due day the question joins the queue.') },
        fill: { queue: Math.min(1, r.perMonth / 10) },
        metrics: m,
      },
    );
    if (broken.has('same-format')) {
      steps.push({
        id: 'stuck',
        label: bi('застряло', 'stuck'),
        caption: bi('Все повторения приходят в одном и том же виде, и все ответы верные. Но курс видит, что вы ни разу не применили понятие в другом виде, поэтому понятие так и остаётся в состоянии «в практике» и не переходит в «освоено».', 'Every review comes in the same kind and every answer is right, but the concept was never applied another way, so it stays “practicing”.'),
        focus: ['answer'],
        say: { answer: bi('Вы снова узнаёте знакомый вопрос и отвечаете верно.', 'You recognise the familiar question again.') },
        states: { answer: 'warn' },
        metrics: m,
        broken: { at: 'answer', message: 'right answers: 6 · formats: [mcq] · state: practicing', caption: bi('на ваших ответах. Вы запомнили ответ на один вопрос, а умение применить понятие курс так и не проверил. В жизни это узнают по тому, что знакомый тест вы проходите, а та же задача в терминале ставит вас в тупик.', 'at your answers: the answer was remembered, the concept never checked another way.') },
      });
    } else
      steps.push({
        id: 'format',
        label: bi('другой вид', 'another kind'),
        caption: bi('Из очереди вопрос выходит уже в другом виде, и если сегодня был выбор ответа, в следующий раз будет порядок шагов или команда. Так курс проверяет понятие, а не память на один ответ.', 'The question leaves the queue in another kind: a choice today, an order or a command next time.'),
        focus: ['format', 'e-fmt'],
        reveal: ['format', 'e-fmt', 'e-ans'],
        tokens: [{ edge: 'e-fmt', label: bi('выбор → порядок шагов', 'choice → order') }],
        say: { format: bi('Следующий вопрос будет другого вида.', 'The next question will be of another kind.') },
        metrics: m,
      });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const m = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    if (change.kind === 'break')
      return change.on
        ? bi('Вопрос всегда задаётся в одном и том же виде. Ответы верные, но понятие застревает и не считается освоенным.', 'Always the same kind: right answers, but the concept is stuck.')
        : bi('Вид вопроса снова меняется от раза к разу.', 'The kind of question changes again.');
    if (change.id === 'retention')
      return fmtb(bi('Цель изменилась с {a} до {b} %, интервал до следующего повторения изменился с {i0} на {i1}, и повторений за месяц теперь {n1} вместо {n0}. Чем выше цель, тем чаще приходится повторять.', 'Target {a}% → {b}%: interval {i0} → {i1}, reviews a month {n0} → {n1}. A higher target means more frequent reviews.'), { a: Math.round(Number(a.retention) * 100), b: Math.round(Number(b.retention) * 100), i0: span(m(prev).next ?? 0), i1: span(m(next).next ?? 0), n0: m(prev).month ?? 0, n1: m(next).month ?? 0 });
    if (change.id === 'confident')
      return b.confident
        ? bi('Ошибка с отметкой «знаю» сжимает интервал до минут, и вопрос попадает в отдельную очередь уверенных ошибок.', 'A confident mistake shrinks the interval to minutes and adds a separate queue.')
        : bi('Уверенной ошибки больше нет, и вопрос возвращается через обычный интервал.', 'No confident mistake: the usual interval.');
    return fmtb(bi('Теперь вопрос вернётся через {i}. Чем увереннее и чаще вы отвечаете верно, тем реже он возвращается.', 'The question now returns in {i}: the surer and more often right, the rarer it comes.'), { i: span(m(next).next ?? 0) });
  },
});
