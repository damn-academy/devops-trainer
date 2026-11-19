// X1 "From an idea to production" (07 §5.3, screens 1–4): one card walks the
// path; work is short, waiting is long. Knobs change the waits and the number
// of cards in progress at once; "break it" removes the test stage.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';

type P = { waitReview: number; waitDeploy: number; inProgress: number };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
const DEVOPS_HANDBOOK = { url: 'https://itrevolution.com/product/the-devops-handbook-second-edition/', label: 'The DevOps Handbook, ch. 7' };

/** Work hours at each stage (an 8-hour working day). */
export const WORK = { select: 2, dev: 6, review: 1, test: 2, deploy: 1 };
/** Base waits on the arrows, hours. */
export const WAIT = { idea: 24, dev: 16, review: 8, test: 12, deploy: 24 };
const DEFECT_SHARE = 0.2;

export interface PathNumbers {
  work: number;
  wait: number;
  days: number;
  efficiency: number;
  waits: Record<keyof typeof WAIT, number>;
}

/** The arithmetic of the path, separate from the steps so tests can check it. */
export function pathNumbers(p: P, noTest: boolean): PathNumbers {
  const waits = {
    idea: WAIT.idea,
    dev: WAIT.dev,
    // Every extra card in progress at once adds half a working day of queue before review.
    review: p.waitReview + (p.inProgress - 1) * 4,
    test: noTest ? 0 : WAIT.test + (p.inProgress - 1) * 2,
    deploy: p.waitDeploy,
  };
  const work = WORK.select + WORK.dev + WORK.review + (noTest ? 0 : WORK.test) + WORK.deploy;
  const wait = Object.values(waits).reduce((a, b) => a + b, 0);
  const days = Math.round(((work + wait) / 8) * 10) / 10;
  return { work, wait, days, efficiency: Math.round((work / (work + wait)) * 1000) / 10, waits };
}

export const valueStreamModel = defineModel<P>({
  id: 'method.x.value-stream',
  block: 'methodology',
  title: bi('Задача от идеи до покупателя', 'A task from an idea to the customer'),
  summary: bi(
    'Одна карточка проходит путь. Сплошные шаги — работа, стрелки — ожидание. Меняйте ожидания и число карточек в работе; уберите проверку и посмотрите, что будет.',
    'One card walks the path. Boxes are work, arrows are waiting. Change the waits and the number of cards in progress; remove the test stage and see what happens.',
  ),
  concepts: ['method.value-stream', 'method.flow-efficiency'],
  diagram: {
    width: 960,
    height: 360,
    nodes: [
      { id: 'idea', label: bi('Идея', 'Idea'), sub: '', family: 'neutral', x: 24, y: 40, w: 150, h: 56, card: card(bi('Просьба покупателей или мысль владельца бизнеса: «хотим оплату картой».', 'A customer request or the owner’s idea: “we want card payments”.'), bi('Покупатели, поддержка, владелец бизнеса.', 'Customers, support, the business owner.')) },
      { id: 'select', label: bi('Отбор', 'Selection'), sub: '', family: 'ci-source', x: 284, y: 40, w: 150, h: 56, card: card(bi('Решают, браться ли за идею и что значит «готово». Работы — пара часов.', 'Deciding whether to take the idea and what “done” means. A couple of hours of work.'), bi('Владелец продукта.', 'The product owner.')) },
      { id: 'dev', label: bi('Разработка', 'Development'), sub: '', family: 'ci-build', x: 544, y: 40, w: 150, h: 56, card: card(bi('Пишут код изменения. Самый заметный этап, но не самый долгий по календарю.', 'Writing the code of the change. The most visible stage, but not the longest on the calendar.'), bi('Разработчики.', 'Developers.')) },
      { id: 'review', label: bi('Ревью', 'Review'), sub: '', family: 'ci-build', x: 786, y: 40, w: 150, h: 56, card: card(bi('Коллега читает изменение и ищет ошибки до того, как их найдут покупатели.', 'A colleague reads the change and looks for mistakes before customers find them.'), bi('Другой разработчик.', 'Another developer.')) },
      { id: 'test', label: bi('Проверка', 'Testing'), sub: '', family: 'ci-test', x: 786, y: 256, w: 150, h: 56, card: card(bi('Проверяют, что изменение работает и ничего не сломало рядом.', 'Checking that the change works and broke nothing next to it.'), bi('Тестировщик.', 'The tester.')) },
      { id: 'deploy', label: bi('Выкладка', 'Deployment'), sub: '', family: 'ci-deploy', x: 414, y: 256, w: 150, h: 56, card: card(bi('Изменение ставят на прод — рабочую версию сайта, которой пользуются покупатели.', 'The change is put into production — the working site the customers use.'), bi('Эксплуатация.', 'Operations.')) },
      { id: 'customers', label: bi('Покупатели', 'Customers'), sub: '', family: 'user', x: 24, y: 256, w: 150, h: 56, card: card(bi('Конец пути: только здесь изменение начинает приносить деньги.', 'The end of the path: only here does the change start to earn money.'), bi('Покупатели магазина.', 'The shop’s customers.')) },
    ],
    edges: [
      { id: 'w-idea', from: 'idea', to: 'select', label: bi('ждёт в списке идей', 'waits in the idea list'), card: card(bi('Идей больше, чем рук: новая ждёт, пока до неё дойдёт очередь.', 'There are more ideas than hands: a new one waits for its turn.'), bi('Никто: это очередь.', 'Nobody: it is a queue.'), { doc: DEVOPS_HANDBOOK }) },
      { id: 'w-dev', from: 'select', to: 'dev', label: bi('ждёт разработчика', 'waits for a developer'), card: card(bi('Разработчики заняты начатым; новая карточка ждёт свободного человека.', 'The developers are busy with what they started; the new card waits for a free person.'), bi('Никто: это очередь.', 'Nobody: it is a queue.')) },
      { id: 'w-review', from: 'dev', to: 'review', label: bi('ждёт ревьюера', 'waits for a reviewer'), card: card(bi('Ревьюер занят своими задачами. Чем больше карточек в работе одновременно, тем длиннее эта очередь.', 'The reviewer is busy with their own tasks. The more cards are in progress at once, the longer this queue.'), bi('Никто: это очередь.', 'Nobody: it is a queue.')) },
      { id: 'w-test', from: 'review', to: 'test', label: bi('ждёт тестировщика', 'waits for the tester'), labelAt: 0.5, card: card(bi('Тестировщик один, а изменения приходят от двух разработчиков.', 'There is one tester, and changes come from two developers.'), bi('Никто: это очередь.', 'Nobody: it is a queue.')) },
      { id: 'w-deploy', from: 'test', to: 'deploy', label: bi('ждёт окна выкладки', 'waits for the deployment window'), card: card(bi('Выкладывают раз в неделю по четвергам: проверенное во вторник лежит до четверга.', 'Deployments happen once a week on Thursday: what was tested on Tuesday lies there until Thursday.'), bi('Правило команды.', 'A team rule.')) },
      { id: 'w-live', from: 'deploy', to: 'customers', label: bi('у покупателей', 'with the customers'), card: card(bi('После выкладки изменение сразу доступно всем покупателям.', 'After the deployment the change is available to every customer at once.'), bi('Сайт.', 'The site.')) },
      { id: 'defect', from: 'customers', to: 'idea', label: bi('дефект у покупателя', 'a defect at the customer'), dashed: true, card: card(bi('Ошибка, которую не поймали до выкладки: карточка проходит путь второй раз.', 'A mistake nobody caught before the deployment: the card walks the path a second time.'), bi('Покупатели и поддержка.', 'Customers and support.')) },
    ],
  },
  params: [
    {
      id: 'waitDeploy',
      label: bi('Ожидание окна выкладки, ч', 'Wait for the deployment window, h'),
      kind: 'range',
      min: 0,
      max: 72,
      step: 4,
      unit: 'h',
      default: WAIT.deploy,
      near: 'w-deploy',
      predict: {
        prompt: bi('Ожидание окна выкладки сокращаем. Что изменится сильнее всего?', 'We shorten the wait for the deployment window. What changes most?'),
        options: [
          { id: 'path', text: bi('Путь карточки станет короче на столько же', 'The card’s path gets shorter by the same amount') },
          { id: 'work', text: bi('Над карточкой будут меньше работать', 'Less work will be done on the card') },
          { id: 'none', text: bi('Ничего: ожидание не работа', 'Nothing: waiting is not work') },
        ],
        resolve: () => 'path',
      },
    },
    { id: 'waitReview', label: bi('Ожидание ревью, ч', 'Wait for review, h'), kind: 'range', min: 0, max: 40, step: 4, unit: 'h', default: WAIT.review, near: 'w-review' },
    {
      id: 'inProgress',
      label: bi('Карточек в работе одновременно', 'Cards in progress at once'),
      kind: 'range',
      min: 1,
      max: 10,
      step: 1,
      default: 1,
      near: 'review',
      predict: {
        prompt: bi('Команда начинает шесть карточек сразу вместо одной. Что станет с путём каждой?', 'The team starts six cards at once instead of one. What happens to the path of each?'),
        options: [
          { id: 'longer', text: bi('Станет длиннее: больше ожидания в очередях', 'Longer: more waiting in queues') },
          { id: 'same', text: bi('Не изменится: работы столько же', 'Unchanged: the work is the same') },
          { id: 'shorter', text: bi('Станет короче: все заняты', 'Shorter: everyone is busy') },
        ],
        resolve: (prev, next) => ((next[next.length - 1].metrics?.days ?? 0) > (prev[prev.length - 1].metrics?.days ?? 0) ? 'longer' : 'same'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-test',
      label: bi('Убрать проверку', 'Remove the test stage'),
      remove: ['test', 'w-test'],
      predict: {
        prompt: bi('Проверку убрали, чтобы ускориться. Что будет?', 'The test stage is removed to go faster. What happens?'),
        options: [
          { id: 'return', text: bi('Путь короче, но часть карточек вернётся с дефектом', 'The path is shorter, but some cards come back with a defect') },
          { id: 'faster', text: bi('Всё станет быстрее, и только', 'Everything gets faster, that is all') },
          { id: 'stop', text: bi('Карточка не сможет дойти до покупателей', 'The card cannot reach the customers') },
        ],
        resolve: () => 'return',
      },
    },
  ],
  metrics: [
    { id: 'work', label: bi('работа', 'work'), unit: 'h' },
    { id: 'wait', label: bi('ожидание', 'waiting'), unit: 'h' },
    { id: 'days', label: bi('путь', 'path'), unit: 'd' },
    { id: 'eff', label: bi('эффективность потока', 'flow efficiency'), unit: '%' },
  ],
  run(p, broken): Step[] {
    const noTest = broken.has('no-test');
    const n = pathNumbers(p, noTest);
    const steps: Step[] = [];
    let work = 0;
    let wait = 0;
    const m = () => ({ work, wait, days: Math.round(((work + wait) / 8) * 10) / 10, eff: work + wait ? Math.round((work / (work + wait)) * 1000) / 10 : 0 });
    const stage = (id: string, hours: number, cap: Bi, label: Bi) => {
      work += hours;
      steps.push({ id: `work-${id}`, label, caption: cap, focus: [id], states: { [id]: 'on' }, values: { [id]: `${hours}:00` }, tokens: [], metrics: m() });
    };
    const queue = (edge: string, hours: number, cap: Bi) => {
      wait += hours;
      steps.push({ id: `wait-${edge}`, label: `${hours}:00`, caption: cap, focus: [edge], tokens: [{ edge, label: `${hours}:00` }], states: { [edge]: hours > 24 ? 'warn' : 'wait' }, metrics: m() });
    };
    steps.push({ id: 'start', label: bi('идея', 'idea'), caption: bi('Покупатели просят оплату картой. Карточка появилась — дальше считаем часы работы и часы ожидания.', 'Customers ask for card payments. The card appears; from here we count hours of work and hours of waiting.'), focus: ['idea'], states: { idea: 'on', defect: 'off', ...(noTest ? { test: 'off', 'w-test': 'off' } : {}) }, metrics: m() });
    queue('w-idea', n.waits.idea, fmt(bi('{h} ч карточка лежит в списке идей: до неё не дошли руки.', 'For {h} h the card lies in the idea list: nobody has got to it yet.'), { h: n.waits.idea }));
    stage('select', WORK.select, bi('Владелец продукта решает, что значит «готово»: «покупатель может оплатить картой». Два часа работы.', 'The product owner decides what “done” means: “a customer can pay by card”. Two hours of work.'), bi('отбор', 'select'));
    queue('w-dev', n.waits.dev, fmt(bi('{h} ч ждёт свободного разработчика.', '{h} h waiting for a free developer.'), { h: n.waits.dev }));
    stage('dev', WORK.dev, bi('Разработчик пишет код: шесть часов — меньше одного рабочего дня.', 'A developer writes the code: six hours, less than one working day.'), bi('код', 'code'));
    queue('w-review', n.waits.review, p.inProgress > 1 ? fmt(bi('{h} ч ждёт ревьюера: у него ещё {k} карточек от коллег.', '{h} h waiting for a reviewer: they have {k} more cards from colleagues.'), { h: n.waits.review, k: p.inProgress - 1 }) : fmt(bi('{h} ч ждёт ревьюера: он занят своей задачей.', '{h} h waiting for a reviewer: they are busy with their own task.'), { h: n.waits.review }));
    stage('review', WORK.review, bi('Ревью — час работы.', 'Review: one hour of work.'), bi('ревью', 'review'));
    if (!noTest) {
      queue('w-test', n.waits.test, fmt(bi('{h} ч в очереди к тестировщику.', '{h} h in the queue to the tester.'), { h: n.waits.test }));
      stage('test', WORK.test, bi('Проверка — два часа.', 'Testing: two hours.'), bi('проверка', 'test'));
    }
    queue('w-deploy', n.waits.deploy, fmt(bi('{h} ч проверенное изменение ждёт окна выкладки.', 'For {h} h the tested change waits for the deployment window.'), { h: n.waits.deploy }));
    stage('deploy', WORK.deploy, bi('Выкладка — час работы эксплуатации.', 'Deployment: one hour of operations work.'), bi('выкладка', 'deploy'));
    steps.push({
      id: 'done',
      label: bi('итог', 'total'),
      caption: fmt(bi('Карточка у покупателей. Путь — {d} рабочих дн., из них работы {w} ч. Эффективность потока {e}%: остальное время карточка ждала.', 'The card is with the customers. The path took {d} working days, {w} h of them work. Flow efficiency is {e}%: the rest of the time the card waited.'), { d: n.days, w: n.work, e: n.efficiency }),
      focus: ['customers', 'w-live'],
      tokens: [{ edge: 'w-live' }],
      states: { customers: 'ok' },
      metrics: { work: n.work, wait: n.wait, days: n.days, eff: n.efficiency },
    });
    if (noTest) {
      steps.push({
        id: 'defect',
        label: bi('дефект', 'defect'),
        caption: fmt(bi('Без проверки путь короче, но каждая пятая карточка ({p}%) возвращается от покупателей с дефектом и проходит его ещё раз.', 'Without testing the path is shorter, but one card in five ({p}%) comes back from the customers with a defect and walks it again.'), { p: DEFECT_SHARE * 100 }),
        focus: ['defect', 'customers'],
        tokens: [{ edge: 'defect' }],
        states: { defect: 'err', customers: 'err' },
        metrics: { work: n.work, wait: n.wait, days: n.days, eff: n.efficiency },
        broken: { at: 'customers', message: 'Support ticket #4821: "Paid by card, the order is not confirmed."', caption: bi('ошибку нашёл покупатель, а не проверка: исправление идёт через весь путь заново.', 'a customer found the mistake, not the test stage: the fix goes through the whole path again.') },
      });
    }
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    const d0 = last(prev).days ?? 0;
    const d1 = last(next).days ?? 0;
    const e1 = last(next).eff ?? 0;
    if (change.kind === 'break') {
      return change.on
        ? fmt(bi('Без проверки путь {a} → {b} дн., но каждая пятая карточка проходит его дважды: в среднем выигрыша почти нет, а дефект увидел покупатель.', 'Without testing the path goes {a} → {b} d, but one card in five walks it twice: on average there is almost no gain, and the customer saw the defect.'), { a: d0, b: d1 })
        : bi('Проверка вернулась: дефекты ловят до покупателей.', 'Testing is back: defects are caught before the customers see them.');
    }
    if (change.id === 'inProgress')
      return fmt(bi('{x} → {y} карточек в работе одновременно: очереди перед ревью и проверкой выросли, путь {a} → {b} дн. Работы столько же, эффективность {e}%.', '{x} → {y} cards in progress at once: the queues before review and testing grew, the path went {a} → {b} d. The same work; flow efficiency {e}%.'), { x: a.inProgress as number, y: b.inProgress as number, a: d0, b: d1, e: e1 });
    if (change.id === 'waitDeploy')
      return fmt(bi('Окно выкладки {x} → {y} ч: путь {a} → {b} дн., эффективность {e}%. Работы не прибавилось и не убавилось — изменилось только ожидание.', 'Deployment window {x} → {y} h: the path went {a} → {b} d, flow efficiency {e}%. Not one hour of work was added or removed: only the waiting changed.'), { x: a.waitDeploy as number, y: b.waitDeploy as number, a: d0, b: d1, e: e1 });
    return fmt(bi('Ожидание ревью {x} → {y} ч: путь {a} → {b} дн., эффективность {e}%.', 'Wait for review {x} → {y} h: the path went {a} → {b} d, flow efficiency {e}%.'), { x: a.waitReview as number, y: b.waitReview as number, a: d0, b: d1, e: e1 });
  },
});
