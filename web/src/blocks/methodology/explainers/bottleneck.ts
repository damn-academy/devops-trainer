// X4 "Where the flow gets stuck" (07 §5.6): four stages, queues between them,
// ten days. The output of the system is the capacity of its slowest stage; a
// limit on work in progress keeps the queue in front of it short; swarming
// and focus raise the bottleneck itself.
//
// Reading order: the picture is built from zero. First the morning queue of
// new tasks, then development, review and testing appear one by one, each
// saying in a callout how many tasks a day it can finish. Then the ten days
// run: on each day the stage with the longest queue in front of it is
// highlighted and says what it did, and the finished tasks travel to the
// customers as a card with their number.

import { defineModel } from '../../../core/define';
import type { Step } from '../../../core/types';
import { t } from '../../../core/i18n';
import { b, card, edge, fmtn, hiddenExcept, lastMetrics, node, nWord, ruNum, STEP_CHARS, type Bi } from './kit';

type P = { arrivals: number; dev: number; test: number; limit: boolean; focus: boolean; swarm: boolean };

const GOAL = { url: 'https://en.wikipedia.org/wiki/Theory_of_constraints', label: 'Wikipedia › Theory of constraints' };

export const DAYS = 10;
export const REVIEW_CAP = 4;
export const LIMIT = 8;
/** Cycle time is measured on the tasks that reached the customers in this many last days. */
export const RECENT = 3;

export interface FlowDay {
  ready: number;
  dev: number;
  qReview: number;
  qTest: number;
  done: number;
  wip: number;
  out: number;
  outDev: number;
  outReview: number;
  /** Average cycle time of the tasks finished in the last RECENT days, or null when none finished. */
  cycle: number | null;
}

export interface FlowRun {
  days: FlowDay[];
  done: number;
  wipAvg: number;
  throughput: number;
  cycle: number | null;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * A deterministic ten-day flow of whole tasks. Each stage does what its
 * capacity allows, but no more than lies in front of it, and the tasks keep
 * their order, so every finished task knows the day it was started: the cycle
 * time is counted on real finished tasks, not derived by Little's law (which
 * does not hold while the work in progress keeps growing).
 */
export function simulate(p: P, testRemoved = false): FlowRun {
  let ready = 0;
  // Each task is the day it was started.
  const dev: number[] = [];
  const qReview: number[] = [];
  const qTest: number[] = [];
  const finished: { day: number; cycle: number }[] = [];
  // A fractional capacity (2.4 tasks a day) accumulates: 2, 2, 3, 2, 3…
  let credit = 0;
  const days: FlowDay[] = [];
  for (let d = 1; d <= DAYS; d++) {
    ready += p.arrivals;
    // Test: capacity of the tester, +20% without switching, + half of the free developer capacity when swarming.
    let testCap = testRemoved ? 0 : p.test * (p.focus ? 1.2 : 1);
    const devFree = Math.max(0, p.dev - dev.length);
    if (p.swarm && !testRemoved) testCap += 0.5 * devFree;
    credit += testCap;
    const can = Math.floor(credit + 1e-9);
    credit -= can;
    const tested = qTest.splice(0, Math.min(can, qTest.length));
    for (const start of tested) finished.push({ day: d, cycle: d - start + 1 });
    const reviewed = qReview.splice(0, Math.min(REVIEW_CAP, qReview.length));
    qTest.push(...reviewed);
    const coded = dev.splice(0, Math.min(p.dev, dev.length));
    qReview.push(...coded);
    const inSystem = dev.length + qReview.length + qTest.length;
    const room = p.limit ? Math.max(0, LIMIT - inSystem) : Infinity;
    const pulled = Math.min(ready, p.dev - dev.length, room);
    ready -= pulled;
    for (let i = 0; i < pulled; i++) dev.push(d);
    const recent = finished.filter((f) => f.day > d - RECENT);
    days.push({
      ready,
      dev: dev.length,
      qReview: qReview.length,
      qTest: qTest.length,
      done: finished.length,
      wip: dev.length + qReview.length + qTest.length,
      out: tested.length,
      outDev: coded.length,
      outReview: reviewed.length,
      cycle: recent.length ? r1(recent.reduce((a, f) => a + f.cycle, 0) / recent.length) : null,
    });
  }
  const last = days[DAYS - 1];
  return { days, done: last.done, wipAvg: r1(days.reduce((a, x) => a + x.wip, 0) / DAYS), throughput: r1(last.done / DAYS), cycle: last.cycle };
}

type Stage = 'arrivals' | 'dev' | 'review' | 'test';
/** The stage that limits the flow: the smallest capacity, the flow of new tasks included. Ties go to the later stage. */
export function bottleneckOf(p: P, testRemoved = false): Stage {
  const caps: [Stage, number][] = [
    ['arrivals', p.arrivals],
    ['dev', p.dev],
    ['review', REVIEW_CAP],
    ['test', testRemoved ? 0 : p.test * (p.focus ? 1.2 : 1)],
  ];
  return caps.reduce((best, x) => (x[1] <= best[1] ? x : best))[0];
}
const STAGE_NAME: Record<Stage, Bi> = {
  arrivals: b('поток новых задач', 'the flow of new tasks'),
  dev: b('разработка', 'development'),
  review: b('ревью', 'review'),
  test: b('проверка', 'testing'),
};

const ALL = ['ready', 'dev', 'q-review', 'review', 'q-test', 'test', 'done', 'e-pull', 'e-code', 'e-rev', 'e-revd', 'e-test', 'e-done'];
/** "3 задачи" / "3 tasks". */
const T = (n: number) => nWord(r1(n), ['задача', 'задачи', 'задач'], ['task', 'tasks']);
/** The same in the genitive, after "до": "до 3 задач". */
const TG = (n: number) => nWord(r1(n), ['задачи', 'задач', 'задач'], ['task', 'tasks'], 'задачи');
/** The same in the accusative, after a verb: "заканчивает 1 задачу". */
const TA = (n: number) => nWord(r1(n), ['задачу', 'задачи', 'задач'], ['task', 'tasks']);
const Td = (n: number) => nWord(r1(n), ['день', 'дня', 'дней'], ['day', 'days']);
const QUEUE: [string, string] = ['Очередь никто не заводит нарочно. Задачи лежат в ней, пока следующий этап занят другой работой.', 'Nobody sets up a queue on purpose. The tasks lie in it while the next stage is busy with other work.'];
const SUBORDINATE = b('Шаги Голдратта для узкого места', 'Goldratt’s steps for the bottleneck');

export const bottleneckModel = defineModel<P>({
  id: 'method.x.bottleneck',
  frame: 'visible',
  block: 'methodology',
  title: b('Где застревает поток', 'Where the flow gets stuck'),
  summary: b(
    'Десять рабочих дней команды из двух разработчиков, ревьюера и тестировщика. Каждое утро приходят новые задачи, и каждый этап за день заканчивает столько задач, сколько позволяет его мощность, но не больше, чем лежит перед ним. Под схемой видно, сколько задач уже дошло до покупателей, сколько задач сейчас в работе и сколько дней в среднем провели в работе задачи, которые дошли до покупателей за последние три дня.',
    'Ten working days of a team of two developers, a reviewer and a tester. New tasks arrive every morning, and each stage finishes as many tasks a day as its capacity allows, but no more than lies in front of it. Under the diagram you see how many tasks have reached the customers, how many are in progress now, and how many days on average the tasks that reached the customers in the last three days spent in progress.',
  ),
  intro: b(
    'Схема собирается по шагам, и сейчас на ней видны только утренняя очередь новых задач и покупатели. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Сначала по одному появятся этапы, и каждый скажет, сколько задач в день он успевает, а потом пойдут десять рабочих дней. В каждый день подсвечен этап, перед которым скопилась самая длинная очередь, а полоска в очереди показывает, сколько задач в ней ждёт.\n\nПосле первого прохода меняйте «Параметры» и включайте поломки в блоке «Сломать», а схема объяснит, что изменилось и почему.',
    'The diagram builds up step by step, and for now it shows only the morning queue of new tasks and the customers. Press “Start from the first step”, then go on with “Step forward” above the diagram. First the stages appear one by one, each saying how many tasks a day it can finish, and then ten working days run. On each day the stage with the longest queue in front of it is highlighted, and the bar in the queue shows how many tasks wait there.\n\nAfter the first pass change the “Parameters” and switch on the breaks in “Break it”, and the diagram explains what changed and why.',
  ),
  legend: [
    { mark: 'active', text: b('этап, на который стоит смотреть сейчас', 'the stage to look at now') },
    { mark: 'say', text: b('что этот этап сделал', 'what that stage did') },
    { mark: 'token', text: b('сколько задач прошло по линии за день', 'how many tasks went along the line in a day') },
    { mark: 'warn', text: b('очередь длиннее шести задач', 'a queue longer than six tasks') },
    { mark: 'icon:file', text: b('очередь задач', 'a queue of tasks') },
    { mark: 'icon:user', text: b('люди на этапе', 'the people at a stage') },
    { mark: 'icon:browser', text: b('задачи у покупателей', 'tasks with the customers') },
    { mark: 'pale', text: b('этап, на котором сейчас ничего не меняется', 'a stage where nothing changes now') },
  ],
  stopLabel: b('Поток остановился', 'The flow stopped'),
  concepts: ['method.bottleneck', 'method.five-steps', 'method.swarming'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      node('ready', b('Новые задачи', 'New tasks'), 'neutral', [16, 48, 150, 64], card(['Очередь отобранных задач, которые ещё никто не начал. Каждое утро сюда приходят новые.', 'The queue of selected tasks nobody has started yet. New ones arrive every morning.'], ['Задачи отбирает владелец продукта.', 'The product owner selects them.']), { icon: 'file', shape: 'buffer', sub: '0' }),
      node('dev', b('Разработка', 'Development'), 'ci-build', [232, 48, 160, 64], card(['На этапе разработки работают два разработчика. Мощность этапа показывает, сколько задач в день они вместе могут закончить.', 'Two developers work at the development stage. The stage’s capacity is how many tasks a day they can finish together.'], ['Здесь работают разработчики.', 'The developers work here.']), { icon: 'terminal' }),
      node('q-review', b('Ждут ревью', 'Waiting for review'), 'gauge', [312, 232, 160, 56], card(['Задачи, код которых готов, но ревьюер их ещё не взял. На доске это часть «готово» в колонке разработки.', 'Tasks whose code is ready but not yet taken by the reviewer. On a board it is the “done” part of the development column.'], QUEUE), { icon: 'file', shape: 'buffer', sub: '0' }),
      node('review', b('Ревью', 'Review'), 'ci-build', [472, 48, 160, 64], card(['Коллега читает код и ищет ошибки. Этот этап успевает четыре задачи в день.', 'A colleague reads the code and looks for mistakes. This stage manages four tasks a day.'], ['Ревью делает ревьюер, опытный разработчик команды.', 'The reviewer, an experienced developer of the team, does it.']), { icon: 'user' }),
      node('q-test', b('Ждут проверки', 'Waiting for testing'), 'gauge', [552, 232, 160, 56], card(['Задачи, которые прошли ревью и ждут тестировщика. Если эта очередь растёт день за днём, проверка не успевает за остальными.', 'Tasks that passed review and wait for the tester. When this queue grows day after day, testing cannot keep up with the rest.'], QUEUE), { icon: 'file', shape: 'buffer', sub: '0' }),
      node('test', b('Проверка', 'Testing'), 'ci-test', [744, 48, 160, 64], card(['На этапе проверки работает один тестировщик. Мощность этого этапа ниже, чем у остальных, поэтому скорость всей команды задаёт проверка.', 'One tester works at the test stage. Its capacity is lower than that of the other stages, which is why testing sets the speed of the whole team.'], ['Проверяет тестировщик.', 'The tester does it.'], GOAL), { icon: 'process' }),
      node('done', b('У покупателей', 'With the customers'), 'user', [744, 344, 160, 64], card(['Здесь собираются задачи, которые дошли до покупателей. Число задач, которое прибавляется здесь за день, и есть пропускная способность всей команды.', 'Here the tasks that reached the customers gather. The number added here per day is the throughput of the whole team.'], ['Покупатели приходят на сайт магазина сами и пользуются только тем, что уже выложено.', 'The customers come to the shop’s site themselves and use only what is already deployed.']), { icon: 'browser', sub: '0' }),
    ],
    edges: [
      edge('e-pull', 'ready', 'dev', b('берут в работу', 'started'), card(['По этой линии задачи переходят из очереди в разработку. Каждое утро разработчики берут столько новых задач, сколько успевают сделать за день. С лимитом незавершённой работы новую задачу берут, только если в работе меньше восьми задач.', 'Along this line tasks go from the queue into development. Every morning the developers take as many new tasks as they can finish in a day. With a WIP limit a new task is taken only while fewer than eight are in progress.'], ['Задачи берут разработчики.', 'The developers take them.'])),
      edge('e-code', 'dev', 'q-review', b('код готов', 'code done'), card(['Разработчик закончил код, и задача встаёт в очередь к ревьюеру.', 'A developer finished the code, and the task joins the queue to the reviewer.'], ['Задачу передают разработчики.', 'The developers hand it on.'])),
      edge('e-rev', 'q-review', 'review', b('на ревью', 'to review'), card(['Ревьюер берёт следующую задачу из очереди.', 'The reviewer takes the next task from the queue.'], ['Задачу берёт ревьюер.', 'The reviewer takes it.'])),
      edge('e-revd', 'review', 'q-test', b('ревью пройдено', 'reviewed'), card(['Задача прошла ревью и встаёт в очередь к тестировщику.', 'The task passed review and joins the queue to the tester.'], ['Задачу передаёт ревьюер.', 'The reviewer hands it on.'])),
      edge('e-test', 'q-test', 'test', b('на проверку', 'to testing'), card(['Тестировщик берёт следующую задачу из очереди.', 'The tester takes the next task from the queue.'], ['Задачу берёт тестировщик.', 'The tester takes it.'])),
      edge('e-done', 'test', 'done', b('проверено', 'tested'), card(['Проверенная задача уходит к покупателям.', 'A tested task goes to the customers.'], ['Задачу передаёт тестировщик.', 'The tester hands it on.'])),
    ],
  },
  params: [
    { id: 'arrivals', group: b('Сколько работы приходит', 'How much work arrives'), label: b('Сколько новых задач приходит каждое утро', 'New tasks arriving every morning'), kind: 'range', min: 1, max: 5, step: 1, default: 4, near: 'ready', levels: ['intermediate', 'experienced'] },
    {
      id: 'dev',
      group: b('Мощность этапов', 'The capacity of the stages'),
      label: b('Сколько задач в день заканчивает разработка', 'Tasks development finishes a day'),
      kind: 'range',
      min: 1,
      max: 6,
      step: 1,
      default: 3,
      near: 'dev',
      predict: {
        prompt: b('Вы меняете мощность разработки, а тестировщик по-прежнему проверяет две задачи в день. Как изменится число задач, которые дойдут до покупателей за 10 дней?', 'You change the capacity of development, while the tester still tests two tasks a day. How does the number of tasks that reach the customers in 10 days change?'),
        options: [
          { id: 'same', text: b('Почти не изменится, пока разработка быстрее проверки', 'It barely changes as long as development is faster than testing') },
          { id: 'scale', text: b('Изменится примерно во столько же раз, во сколько изменилась мощность разработки', 'It changes about as many times as the capacity of development did') },
        ],
        resolve: (prev, next) => {
          const x = lastMetrics(prev).done ?? 0;
          const y = lastMetrics(next).done ?? 0;
          return Math.abs(y - x) <= Math.max(1, x * 0.15) ? 'same' : 'scale';
        },
      },
    },
    { id: 'test', group: b('Мощность этапов', 'The capacity of the stages'), label: b('Сколько задач в день проверяет тестировщик', 'Tasks the tester tests a day'), kind: 'range', min: 1, max: 6, step: 1, default: 2, near: 'test' },
    { id: 'focus', group: SUBORDINATE, label: b('Тестировщика не отвлекают на совещания и чужие задачи (шаг «использовать»)', 'The tester is not pulled into meetings and other tasks (the “exploit” step)'), kind: 'toggle', default: false, near: 'test' },
    {
      id: 'limit',
      group: SUBORDINATE,
      label: b(`Не брать новую задачу, пока в работе ${LIMIT} задач (шаг «подчинить»)`, `Start no new task while ${LIMIT} are in progress (the “subordinate” step)`),
      kind: 'toggle',
      default: false,
      near: 'q-test',
      predict: {
        prompt: b('Вы включаете или выключаете лимит, при котором новую задачу не берут, пока в работе восемь задач. Как изменится время цикла, то есть сколько дней одна задача проводит в работе?', 'You switch the limit on or off: no new task is started while eight are in progress. How does the cycle time change, that is, how many days one task spends in progress?'),
        options: [
          { id: 'shorter', text: b('С лимитом время цикла станет короче', 'With the limit the cycle time gets shorter') },
          { id: 'same', text: b('Время цикла останется прежним', 'The cycle time stays the same') },
          { id: 'longer', text: b('С лимитом время цикла станет длиннее', 'With the limit the cycle time gets longer') },
        ],
        resolve: (prev, next) => {
          const a = lastMetrics(prev).cycle ?? 0;
          const c = lastMetrics(next).cycle ?? 0;
          const limited = next.some((s) => s.id === 'limit-on');
          if (a === c) return 'same';
          return (limited ? c < a : c > a) ? 'shorter' : 'longer';
        },
      },
    },
    { id: 'swarm', group: SUBORDINATE, label: b('Свободные разработчики помогают проверять (тоже шаг «подчинить»)', 'Free developers help with testing (also the “subordinate” step)'), kind: 'toggle', default: false, near: 'test' },
  ],
  breaks: [
    {
      id: 'no-test',
      label: b('Тестировщик ушёл в отпуск на две недели, и проверять задачи некому', 'The tester is on leave for two weeks, and nobody can test'),
      remove: ['test', 'e-test', 'e-done'],
      boundary: 'process',
      predict: {
        prompt: b('Тестировщика нет, а разработчики и ревьюер работают как обычно. Что произойдёт за десять дней?', 'The tester is away, while the developers and the reviewer work as usual. What happens in ten days?'),
        options: [
          { id: 'pile', text: b('До покупателей не дойдёт ни одной задачи', 'Not a single task reaches the customers') },
          { id: 'some', text: b('До покупателей дойдёт меньше задач, чем обычно', 'Fewer tasks than usual reach the customers') },
          { id: 'same', text: b('До покупателей дойдёт столько же задач, сколько обычно', 'As many tasks as usual reach the customers') },
        ],
        resolve: (prev, next) => {
          const d = lastMetrics(next).done ?? 0;
          return d === 0 ? 'pile' : d < (lastMetrics(prev).done ?? 0) ? 'some' : 'same';
        },
      },
    },
  ],
  metrics: [
    { id: 'done', label: b('задач у покупателей', 'tasks with the customers') },
    { id: 'wip', label: b('задач в работе сейчас', 'tasks in progress now') },
    { id: 'th', label: b('готово в день, в среднем с первого дня', 'done a day, average since day 1') },
    { id: 'cycle', label: b('время цикла задач, готовых за последние три дня, дней', 'cycle time of the tasks done in the last three days, days') },
  ],
  run(p, broken): Step[] {
    const removed = broken.has('no-test');
    const r = simulate(p, removed);
    const steps: Step[] = [];
    const testCap0 = removed ? 0 : r1(p.test * (p.focus ? 1.2 : 1));
    const bn = bottleneckOf(p, removed);
    const slowest = Math.min(p.arrivals, p.dev, REVIEW_CAP, testCap0);
    const zero = { done: 0, wip: 0, th: 0 };
    steps.push({
      id: 'arrive',
      label: b('утро', 'morning'),
      caption: fmtn(b('Каждое утро в очередь новых задач приходит {a}. Справа внизу стоят покупатели, и сделанной считается только та задача, которая дошла до них.', 'Every morning {a} arrive in the queue of new tasks. Bottom right are the customers: as many tasks as reach them in ten days, that is how much the team has done.'), { a: T(p.arrivals) }),
      focus: ['ready'],
      say: { ready: fmtn(b('Каждое утро сюда приходит {a}.', 'Every morning {a} arrive here.'), { a: T(p.arrivals) }) },
      states: hiddenExcept(ALL, 'ready', 'done'),
      values: { ready: '0', 'q-review': '0', 'q-test': '0', done: '0' },
      fill: { ready: 0, 'q-review': 0, 'q-test': 0 },
      metrics: zero,
    });
    steps.push({
      id: 'cap-dev',
      label: b('разработка', 'dev'),
      caption: fmtn(b('Первым идёт этап разработки. Два разработчика вместе заканчивают до {d} в день, и столько же новых задач они могут взять утром.', 'The first stage is development. Together the two developers finish up to {d} a day, and they can take as many new tasks in the morning.'), { d: TG(p.dev) }),
      focus: ['dev', 'e-pull'],
      say: { dev: fmtn(b('Разработчики успевают {d} в день.', 'The developers manage {d} a day.'), { d: TA(p.dev) }) },
      reveal: ['dev', 'e-pull'],
      metrics: zero,
    });
    steps.push({
      id: 'cap-review',
      label: b('ревью', 'review'),
      caption: b('Готовый код встаёт в очередь к ревьюеру. Ревью успевает четыре задачи в день, то есть больше, чем разработка.', 'Finished code joins the queue to the reviewer. Review manages four tasks a day, more than development does.'),
      focus: ['review', 'q-review'],
      say: { review: b('Ревью успевает 4 задачи в день.', 'Review manages 4 tasks a day.') },
      reveal: ['q-review', 'review', 'e-code', 'e-rev'],
      metrics: zero,
    });
    steps.push(
      removed
        ? {
            id: 'cap-test',
            label: b('проверка', 'test'),
            caption: b('После ревью задачи встают в очередь к тестировщику, но тестировщик в отпуске, и проверять их некому.', 'After review the tasks join the queue to the tester, but the tester is on leave, and nobody can test them.'),
            focus: ['q-test'],
            say: { 'q-test': b('Тестировщика нет, поэтому задачи сюда приходят, а дальше им идти некуда.', 'There is no tester, so tasks come here and have nowhere to go on.') },
            reveal: ['q-test', 'e-revd'],
            states: { test: 'off', 'e-test': 'off', 'e-done': 'off' },
            metrics: zero,
          }
        : {
            id: 'cap-test',
            label: b('проверка', 'test'),
            caption: fmtn(b('После ревью задачи встают в очередь к тестировщику. Он проверяет {t} в день.', 'After review the tasks join the queue to the tester. The tester tests {t} a day.'), { t: TA(testCap0) }),
            focus: ['test', 'q-test'],
            say: { test: fmtn(b('Тестировщик успевает {t} в день.', 'The tester manages {t} a day.'), { t: TA(testCap0) }) },
            reveal: ['q-test', 'test', 'e-revd', 'e-test'],
            metrics: zero,
          },
    );
    const limitNote = p.limit ? b('Включён лимит, поэтому новую задачу не берут, пока в работе восемь задач.', 'The limit is on: no new task is started while eight are in progress.') : b('Лимита нет, поэтому разработчики берут новые задачи каждое утро.', 'There is no limit: the developers take new tasks every morning.');
    steps.push({
      id: p.limit ? 'limit-on' : 'slowest',
      label: b('предел', 'limit'),
      caption: removed
        ? b('Самым медленным этапом сейчас стала проверка, и её мощность равна нулю. Посмотрим, что это значит для десяти дней работы.', 'The slowest stage now is testing, and its capacity is zero. Let us see what that means for ten days of work.')
        : bn === 'arrivals'
          ? fmtn(b('Новых задач приходит {s} в день, меньше, чем успевает любой этап. Поэтому команду сейчас сдерживают не её этапы, а поток новых задач. {l}', 'New tasks arrive at {s} a day, fewer than any stage manages. So the team is held back now not by its stages but by the flow of new tasks. {l}'), { s: T(slowest), l: limitNote })
          : fmtn(b('Самый медленный этап здесь {n}, и этот этап успевает {s} в день. Как бы быстро ни работали остальные этапы, больше задач в день до покупателей не дойдёт. {l}', 'The slowest stage here is {n}, and it manages {s} a day. However fast the other stages work, no more tasks a day will reach the customers. {l}'), { n: STAGE_NAME[bn], s: TA(slowest), l: limitNote }),
      focus: ['done', 'e-done'],
      say: { done: removed ? b('Сюда не дойдёт ничего, пока проверять некому.', 'Nothing will get here while nobody can test.') : fmtn(b('Сюда будет доходить не больше {s} в день.', 'No more than {s} a day will get here.'), { s: TG(slowest) }) },
      reveal: ['done', 'e-done'],
      states: removed ? { 'e-done': 'off' } : {},
      metrics: zero,
    });
    const full = (n: number) => Math.min(1, n / 12);
    let warned = false;
    let blocked = false;
    r.days.forEach((d, i) => {
      const day = i + 1;
      const y = r.days[i - 1];
      const th = r1(d.done / day);
      const worst = removed || d.qTest >= d.qReview ? 'q-test' : 'q-review';
      const actor = worst === 'q-test' ? (removed ? 'q-test' : 'test') : 'review';
      const say =
        actor === 'test'
          ? fmtn(b('Тестировщик проверил {o}, а в очереди к нему остаётся {q}.', 'The tester tested {o}, and {q} remain in the queue.'), { o: TA(d.out), q: T(d.qTest) })
          : actor === 'review'
            ? fmtn(b('Ревью закончило {o} и передало их дальше, а в очереди к нему остаётся {q}.', 'Review finished {o} and passed them on, and {q} remain in the queue.'), { o: TA(d.outReview), q: T(d.qReview) })
            : fmtn(b('В очереди к проверке уже {q}, и ни одна задача не ушла дальше.', 'There are already {q} in the queue to testing, and none moved on.'), { q: T(d.qTest) });
      // The caption tells only what is new on this day: the first output of a stage, the queue in front of testing, the limit at work.
      const parts: Bi[] = [];
      if (day === 1) parts.push(fmtn(b('В первый день разработчики берут в работу первые {p}, а ревью и проверке пока нечего делать, потому что до них ещё ничего не дошло.', 'On day 1 the developers start their first {p}, while review and testing have nothing to do yet, because nothing has reached them.'), { p: TA(Math.min(p.arrivals, p.dev)) }));
      else {
        if (d.outDev && !y.qReview && !r.days.slice(0, i).some((x) => x.outDev)) parts.push(fmtn(b('Разработка закончила первые {n}, и они встали в очередь к ревью.', 'Development finished its first {n}, and they joined the queue to review.'), { n: TA(d.outDev) }));
        if (d.outReview && !r.days.slice(0, i).some((x) => x.outReview))
          parts.push(removed ? fmtn(b('Ревью закончило первые {n} и передало их в очередь к проверке, но проверять их некому.', 'Review finished its first {n} and passed them to the queue to testing, but nobody can test them.'), { n: TA(d.outReview) }) : fmtn(b('Ревью закончило первые {n} и передало их в очередь к проверке.', 'Review finished its first {n} and passed them to the queue to testing.'), { n: TA(d.outReview) }));
        else if (removed && d.qTest) parts.push(fmtn(b('В очереди к проверке уже {q}, и ни одна задача не ушла дальше.', 'There are already {q} in the queue to testing, and none has moved on.'), { q: T(d.qTest) }));
        if (!removed && d.out) {
          parts.push(y.done ? fmtn(b('Проверка передала покупателям {o}, и всего у них теперь {x}.', 'Testing passed {o} to the customers, and they now have {x} in all.'), { o: TA(d.out), x: T(d.done) }) : fmtn(b('Тестировщик проверил первые {o}, и они дошли до покупателей.', 'The tester tested the first {o}, and they reached the customers.'), { o: TA(d.out) }));
          if (y.qTest && d.qTest !== y.qTest)
            parts.push(d.qTest > y.qTest ? fmtn(b('Очередь к проверке выросла до {q}, потому что ревью отдаёт больше, чем успевает тестировщик.', 'The queue to testing grew to {q}, because review hands on more than the tester manages.'), { q: TG(d.qTest) }) : fmtn(b('Очередь к проверке сократилась до {q}.', 'The queue to testing shrank to {q}.'), { q: TG(d.qTest) }));
          else if (y.qTest) parts.push(fmtn(b('В очереди к проверке по-прежнему {q}.', 'The queue to testing still holds {q}.'), { q: T(d.qTest) }));
        }
        if (d.qTest > 6 && !warned) {
          warned = true;
          parts.push(b('Очередь к проверке стала длиннее шести задач, поэтому её рамка пожелтела.', 'The queue to testing is now longer than six tasks, so its outline turned yellow.'));
        }
        if (p.limit && d.wip >= LIMIT && d.ready > 0 && !blocked) {
          blocked = true;
          parts.push(b('Утром разработчики не взяли новых задач, хотя они ждут в очереди, потому что в работе уже восемь задач и лимит исчерпан.', 'In the morning the developers took no new tasks, although some wait in the queue, because eight tasks are already in progress and the limit is used up.'));
        }
        if (!parts.length) parts.push(fmtn(b('До покупателей пока не дошло ни одной задачи, а в работе уже {w}.', 'No task has reached the customers yet, and {w} are already in progress.'), { w: T(d.wip) }));
      }
      // One idea per step: when the news of a day do not fit one step, the rest goes to a second step of the same day.
      const fits = (xs: Bi[]) => { const c = join(...xs); return Math.max(c.ru.length + say.ru.length, c.en.length + say.en.length) <= STEP_CHARS - 12; };
      let head = parts.length;
      while (head > 1 && !fits(parts.slice(0, head))) head--;
      const caption = day === 1 ? parts[0] : prefixDay(day, parts.slice(0, head));
      const st: Step = {
        id: `d${day}`,
        label: `${day}`,
        caption,
        focus: [worst, actor],
        say: { [actor]: say },
        tokens: removed ? [{ edge: 'e-revd', label: `+${ruNum(d.outReview)}` }] : [{ edge: 'e-done', label: `+${ruNum(d.out)}` }],
        values: { ready: ruNum(d.ready), 'q-review': ruNum(d.qReview), 'q-test': ruNum(d.qTest), done: ruNum(d.done) },
        fill: { ready: full(d.ready), 'q-review': full(d.qReview), 'q-test': full(d.qTest) },
        states: { 'q-test': d.qTest > 6 ? 'warn' : 'on', 'q-review': d.qReview > 6 ? 'warn' : 'on', done: d.done > 0 ? 'ok' : 'on' },
        metrics: metricsOf(d, th),
      };
      if (removed && day === DAYS) st.broken = { at: 'q-test', message: t(b(`в очереди к проверке: ${nWord(d.qTest, ['задача', 'задачи', 'задач'], ['task', 'tasks']).ru}\nу покупателей: 0`, `queue before testing: ${nWord(d.qTest, ['задача', 'задачи', 'задач'], ['task', 'tasks']).en}\ndone: 0`)), caption: b('без проверки поток стоит, и всё, что сделала разработка, копится в очереди и не приносит покупателям никакой пользы.', 'without testing the flow stands still, and everything development made piles up in the queue and gives the customers nothing.') };
      steps.push(st);
      if (head < parts.length) {
        // The continuation repeats the picture of the day without the callout and the moving card; a break, if any, stops the day on its last step.
        const { say: _say, tokens: _tokens, ...rest } = st;
        delete st.broken;
        steps.push({ ...rest, id: `d${day}-more`, label: b('очередь', 'queue'), caption: prefixDay(day, parts.slice(head)), focus: [worst] });
      }
    });
    const last = r.days[DAYS - 1];
    const mid = r.days[4];
    const recentOut = r1(r.days.slice(-4).reduce((a, x) => a + x.out, 0) / 4);
    const stability =
      last.wip > mid.wip
        ? fmtn(b('Незавершённая работа росла с {w5} на пятый день до {w10} к концу. Такая система нестабильна, закон Литтла к ней не применяют, и каждая новая задача будет ждать дольше предыдущей.', 'The work in progress grew from {w5} on day 5 to {w10} at the end. Such a system is unstable, Little’s law does not apply to it, and each new task will wait longer than the one before.'), { w5: TG(mid.wip), w10: TG(last.wip) })
        : fmtn(b('Незавершённая работа перестала расти и держится на {w}, поэтому и время цикла дальше расти не будет.', 'The work in progress stopped growing and stays at {w}, so the cycle time will not grow further either.'), { w: TA(last.wip) });
    const cycleNote = r.cycle !== null ? fmtn(b('Задачи, которые дошли до покупателей за последние три дня, провели в работе в среднем {c}.', 'The tasks that reached the customers in the last three days spent {c} in progress on average.'), { c: Td(r.cycle) }) : b('', '');
    steps.push({
      id: 'sum',
      label: b('итог', 'total'),
      caption: removed
        ? b('За десять дней до покупателей не дошло ни одной задачи. Поток идёт со скоростью самого медленного этапа, а скорость проверки здесь равна нулю.', 'In ten days not a single task reached the customers. The flow moves at the speed of its slowest stage, and the speed of testing here is zero.')
        : bn === 'arrivals'
          ? fmtn(b('За {n} дней до покупателей дошло {x}. Новых задач приходит меньше, чем успевает даже самый медленный этап, поэтому команду сейчас ограничивают не этапы, а поток новых задач.', 'In {n} days {x} reached the customers. Fewer new tasks arrive than even the slowest stage manages, so the team is now limited not by its stages but by the flow of new tasks.'), { n: DAYS, x: T(r.done) })
          : fmtn(b('За {n} дней до покупателей дошло {x}. В последние дни до них доходило в среднем по {o} в день, то есть примерно столько, сколько успевает самый медленный этап, {s}, а первые дни ушли на то, чтобы задачи до него добрались.', 'In {n} days {x} reached the customers. In the last days about {o} a day reached them, roughly what the slowest stage, {s}, manages, and the first days went on the tasks getting that far.'), { n: DAYS, x: T(r.done), o: TA(recentOut), s: STAGE_NAME[bn] }),
      focus: removed ? ['q-test'] : ['done'],
      say: removed ? { 'q-test': fmtn(b('Здесь скопилось {q}, а до покупателей не дошло ни одной задачи.', '{q} piled up here, and the customers have zero.'), { q: T(last.qTest) }) } : { done: fmtn(b('За десять дней сюда дошло {x}.', 'In ten days {x} got here.'), { x: T(r.done) }) },
      states: removed ? { done: 'off' } : { done: 'ok' },
      metrics: metricsOf(last, r.throughput),
    });
    // The second half of the total: how long the tasks took and whether the system is stable.
    if (!removed)
      steps.push({
        id: 'sum-wip',
        label: b('устойчивость', 'stability'),
        caption: join(cycleNote, stability),
        focus: ['q-test', 'q-review'],
        states: { done: 'ok' },
        metrics: metricsOf(last, r.throughput),
      });
    return steps;
  },
  explainDelta(_prev, next, change, a, c): Bi {
    if (change.kind === 'break')
      return change.on
        ? b('Тестировщика нет, и до покупателей не дошло ничего, хотя разработка работает в полную силу. Всё, что она сделала, лежит в очереди к проверке.', 'The tester is away, and nothing reached the customers although development works at full speed. Everything it made lies in the queue to testing.')
        : b('Тестировщик вернулся, и задачи снова доходят до покупателей.', 'The tester is back, and tasks reach the customers again.');
    const removed = next.some((s) => !!s.broken);
    const r0 = simulate(a, removed);
    const rr = simulate(c, removed);
    const bn = bottleneckOf(c, removed);
    const same = r0.done === rr.done;
    const nothing = same && r0.days[DAYS - 1].wip === rr.days[DAYS - 1].wip && r0.cycle === rr.cycle;
    const doneS = same
      ? fmtn(b('Число задач, которые дошли до покупателей за десять дней, не изменилось и равно {d}.', 'The number of tasks that reached the customers in ten days did not change: {d}.'), { d: rr.done })
      : fmtn(b('Число задач, которые дошли до покупателей за десять дней, теперь {d1} вместо {d0}.', 'The number of tasks that reached the customers in ten days is now {d1} instead of {d0}.'), { d1: rr.done, d0: r0.done });
    const w0 = r0.days[DAYS - 1].wip;
    const w1 = rr.days[DAYS - 1].wip;
    const wipS = w0 === w1 ? fmtn(b('К концу десятого дня в работе по-прежнему {w}.', 'At the end of day 10 there are still {w} in progress.'), { w: T(w1) }) : fmtn(b('К концу десятого дня в работе {w1} вместо {w0}.', 'At the end of day 10 there are {w1} in progress instead of {w0}.'), { w1: T(w1), w0: w0 });
    const cycS =
      r0.cycle === null || rr.cycle === null
        ? b('', '')
        : r0.cycle === rr.cycle
          ? fmtn(b('Время цикла последних готовых задач не изменилось и равно {c}.', 'The cycle time of the last finished tasks did not change: {c}.'), { c: Td(rr.cycle) })
          : fmtn(b('Последние готовые задачи провели в работе в среднем {c1} вместо {c0}.', 'The last finished tasks spent {c1} in progress on average instead of {c0}.'), { c1: Td(rr.cycle), c0: r0.cycle });
    const why = fmtn(b('Сейчас поток сдерживает {s}.', 'What holds the flow now is {s}.'), { s: STAGE_NAME[bn] });
    switch (change.id) {
      case 'dev': {
        const head = fmtn(b('Разработка теперь может заканчивать {y} в день вместо {x}.', 'Development can now finish {y} a day instead of {x}.'), { x: a.dev as number, y: TA(c.dev as number) });
        if (nothing)
          return (a.dev as number) >= c.arrivals && (c.dev as number) >= c.arrivals
            ? join(head, fmtn(b('Но новых задач каждое утро приходит только {n}, поэтому брать в работу ей больше нечего, и ничего не изменилось.', 'But only {n} new tasks arrive every morning, so there is nothing more to start, and nothing changed.'), { n: T(c.arrivals as number) }))
            : join(head, b('Но ничего не изменилось.', 'But nothing changed.'), why);
        if (bn === 'dev') return join(head, b('Теперь разработка сама стала самым медленным этапом.', 'Development itself is now the slowest stage.'), doneS, wipS);
        return join(head, doneS, fmtn(b('Число задач, которые доходят до покупателей, задаёт самый медленный этап, а здесь это {s}.', 'The number of tasks that reach the customers is set by the slowest stage, here {s}.'), { s: STAGE_NAME[bn] }), w1 > w0 ? b('Лишняя мощность перед ним только быстрее наполняет очередь.', 'Extra capacity in front of it only fills the queue faster.') : b('', ''), wipS, cycS);
      }
      case 'test': {
        const head = fmtn(b('Тестировщик теперь проверяет {y} в день вместо {x}.', 'The tester now tests {y} a day instead of {x}.'), { x: a.test as number, y: TA(c.test as number) });
        if (same) return join(head, fmtn(b('Но число задач, которые дошли до покупателей за десять дней, не изменилось и равно {d}, потому что проверка больше не самый медленный этап.', 'But the number of tasks that reached the customers in ten days did not change, {d}, because testing is no longer the slowest stage.'), { d: rr.done }), why, cycS);
        if (rr.done < r0.done) return join(head, doneS, b('Проверка стала медленнее, а вся команда работает со скоростью самого медленного этапа.', 'Testing got slower, and the whole team works at the speed of its slowest stage.'), wipS);
        return bn === 'test'
          ? join(head, doneS, b('Проверка по-прежнему узкое место, и, когда его ускоряют, ускоряется вся команда.', 'Testing is still the bottleneck, and when it speeds up, the whole team speeds up.'), wipS, cycS)
          : join(head, doneS, fmtn(b('Проверка перестала быть узким местом, и теперь поток сдерживает {s}, поэтому дальше ускорять проверку бесполезно.', 'Testing is no longer the bottleneck; now {s} holds the flow, so speeding up testing further is no use.'), { s: STAGE_NAME[bn] }), cycS);
      }
      case 'limit':
        return c.limit
          ? join(b('С лимитом разработчики не берут новую задачу, пока в работе восемь задач, и очередь перед проверкой перестаёт расти.', 'With the limit the developers start no new task while eight are in progress, and the queue before testing stops growing.'), wipS, cycS, doneS)
          : join(b('Без лимита разработчики каждое утро берут в работу всё, что успевают.', 'Without the limit the developers start everything they can every morning.'), wipS, cycS, doneS);
      case 'focus':
        if (c.focus)
          return same
            ? join(b('Тестировщик больше не переключается на другие дела и может проверять на 20 % больше.', 'The tester no longer switches to other things and can test 20% more.'), doneS, why)
            : join(b('Тестировщик больше не переключается на другие дела и проверяет на 20 % больше.', 'The tester no longer switches to other things and tests 20% more.'), doneS, b('Так выглядит шаг «использовать», на котором команда берёт от узкого места всё, на что оно способно.', 'This is the “exploit” step, at which the team gets everything the bottleneck can give.'));
        return join(b('Тестировщика снова отвлекают на совещания и чужие задачи.', 'The tester is pulled into meetings and other tasks again.'), doneS);
      case 'swarm':
        if (c.swarm) {
          if (same && !c.limit) return b('Помогать проверке некому: без лимита разработчики каждое утро берут новые задачи и заняты своими. Поэтому результат не изменился. Включите лимит, и у разработчиков появится свободное время.', 'Nobody is free to help with testing: without the limit the developers take new tasks every morning and are busy with their own. So the result did not change. Switch on the limit, and the developers get free time.');
          if (same) return join(b('Свободные разработчики готовы помогать проверке, но результат не изменился.', 'Free developers are ready to help with testing, but the result did not change.'), why);
          return join(b('Свободные разработчики помогают проверять, хоть и вдвое медленнее тестировщика.', 'Free developers help with testing, if half as fast as the tester.'), doneS, b('Так выглядит шаг «подчинить», на котором остальные работают на узкое место, а не начинают новые задачи.', 'This is the “subordinate” step, at which the others work for the bottleneck instead of starting new tasks.'));
        }
        return join(b('Разработчики больше не помогают проверке.', 'The developers no longer help with testing.'), doneS);
      default:
        return join(
          fmtn(b('Каждое утро в очередь теперь приходит {y} вместо {x}.', 'There are now {y} new tasks every morning instead of {x}.'), { x: a.arrivals as number, y: T(c.arrivals as number) }),
          doneS,
          wipS,
          (c.arrivals as number) > Math.min(c.dev as number, REVIEW_CAP, (c.test as number) * (c.focus ? 1.2 : 1)) && !c.limit ? b('Если задач приходит больше, чем уходит, и лимита нет, очередь растёт без предела.', 'When more comes in than goes out and there is no limit, the queue grows without bound.') : b('', ''),
        );
    }
  },
});

/** The metrics of one day; the cycle time only once some tasks are finished. */
function metricsOf(d: FlowDay, th: number): Record<string, number> {
  return { done: d.done, wip: d.wip, th, ...(d.cycle !== null ? { cycle: d.cycle } : {}) };
}

/** Sentences joined with spaces, empty ones dropped. */
function join(...parts: Bi[]): Bi {
  const ok = parts.filter((x) => x.ru || x.en);
  return { ru: ok.map((x) => x.ru).filter(Boolean).join(' '), en: ok.map((x) => x.en).filter(Boolean).join(' ') };
}

/** "На 5-й день разработка…" / "On day 5, development…": the day goes in front of the first sentence. */
function prefixDay(day: number, parts: Bi[]): Bi {
  const s = join(...parts);
  const low = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
  return { ru: `На ${day}-й день ${low(s.ru)}`, en: `On day ${day}, ${low(s.en)}` };
}
