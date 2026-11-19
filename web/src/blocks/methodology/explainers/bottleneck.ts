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
import { b, card, edge, fmtn, hiddenExcept, lastMetrics, node, nWord, ruNum, type Bi } from './kit';

type P = { arrivals: number; dev: number; test: number; limit: boolean; focus: boolean; swarm: boolean };

const GOAL = { url: 'https://en.wikipedia.org/wiki/Theory_of_constraints', label: 'Wikipedia › Theory of constraints' };

export const DAYS = 10;
export const REVIEW_CAP = 4;
export const LIMIT = 6;

export interface FlowRun {
  days: { ready: number; dev: number; qReview: number; qTest: number; done: number; wip: number; out: number; outDev: number; outReview: number; testCap: number }[];
  done: number;
  wipAvg: number;
  throughput: number;
  cycle: number;
}

/** A deterministic ten-day flow: each stage does what its capacity allows, but no more than lies in front of it. */
export function simulate(p: P, testRemoved = false): FlowRun {
  let ready = 0;
  let dev = 0;
  let qReview = 0;
  let qTest = 0;
  let done = 0;
  const days: FlowRun['days'] = [];
  for (let d = 1; d <= DAYS; d++) {
    ready += p.arrivals;
    // Test: capacity of the tester, +20% without switching, + half of the free developer capacity when swarming.
    let testCap = testRemoved ? 0 : p.test * (p.focus ? 1.2 : 1);
    const devFree = Math.max(0, p.dev - dev);
    if (p.swarm && !testRemoved) testCap += 0.5 * Math.min(devFree, p.dev);
    const outT = Math.min(testCap, qTest);
    qTest -= outT;
    done += outT;
    const outR = Math.min(REVIEW_CAP, qReview);
    qReview -= outR;
    qTest += outR;
    const outD = Math.min(p.dev, dev);
    dev -= outD;
    qReview += outD;
    const inSystem = dev + qReview + qTest;
    const room = p.limit ? Math.max(0, LIMIT - inSystem) : Infinity;
    const pulled = Math.min(ready, p.dev, room);
    ready -= pulled;
    dev += pulled;
    const wip = dev + qReview + qTest;
    days.push({ ready, dev, qReview, qTest, done, wip, out: outT, outDev: outD, outReview: outR, testCap });
  }
  const r = (x: number) => Math.round(x * 10) / 10;
  const wipAvg = days.reduce((a, x) => a + x.wip, 0) / DAYS;
  const throughput = done / DAYS;
  return { days, done: r(done), wipAvg: r(wipAvg), throughput: r(throughput), cycle: throughput ? r(wipAvg / throughput) : 99 };
}

const ALL = ['ready', 'dev', 'q-review', 'review', 'q-test', 'test', 'done', 'e-pull', 'e-code', 'e-rev', 'e-revd', 'e-test', 'e-done'];
const r1 = (x: number) => Math.round(x * 10) / 10;
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
  block: 'methodology',
  title: b('Где застревает поток', 'Where the flow gets stuck'),
  summary: b(
    'Десять рабочих дней команды из двух разработчиков, ревьюера и тестировщика. Каждое утро приходят новые задачи, и каждый этап за день заканчивает столько задач, сколько позволяет его мощность, но не больше, чем лежит перед ним. Под схемой копятся число готовых задач, незавершённая работа и время цикла.',
    'Ten working days of a team of two developers, a reviewer and a tester. New tasks arrive every morning, and each stage finishes as many tasks a day as its capacity allows, but no more than lies in front of it. Under the diagram the number of finished tasks, the work in progress and the cycle time add up.',
  ),
  intro: b(
    'Схема собирается по шагам, и сейчас на ней видны только утренняя очередь новых задач и покупатели. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Сначала по одному появятся этапы, и каждый скажет, сколько задач в день он успевает, а потом пойдут десять рабочих дней. В каждый день подсвечен этап, перед которым скопилась самая длинная очередь, а полоска в очереди показывает, сколько задач в ней ждёт.\n\nПосле первого прохода ускорьте в «Параметрах» разработку и проверьте, изменится ли число готовых задач. Затем верните её и по очереди включите шаги Голдратта.',
    'The diagram builds up step by step, and for now it shows only the morning queue of new tasks and the customers. Press “Start from the first step”, then go on with “Step forward” above the diagram. First the stages appear one by one, each saying how many tasks a day it can finish, and then ten working days run. On each day the stage with the longest queue in front of it is highlighted, and the bar in the queue shows how many tasks wait there.\n\nAfter the first pass, speed up development in “Parameters” and check whether the number of finished tasks changes. Then set it back and switch on Goldratt’s steps one at a time.',
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
      edge('e-pull', 'ready', 'dev', b('берут в работу', 'started'), card(['По этой линии задачи переходят из очереди в разработку. Каждое утро разработчики берут столько новых задач, сколько успевают сделать за день. С лимитом незавершённой работы новую задачу берут, только если в работе меньше шести задач.', 'Along this line tasks go from the queue into development. Every morning the developers take as many new tasks as they can finish in a day. With a WIP limit a new task is taken only while fewer than six are in progress.'], ['Задачи берут разработчики.', 'The developers take them.'])),
      edge('e-code', 'dev', 'q-review', b('код готов', 'code done'), card(['Разработчик закончил код, и задача встаёт в очередь к ревьюеру.', 'A developer finished the code, and the task joins the queue to the reviewer.'], ['Задачу передают разработчики.', 'The developers hand it on.'])),
      edge('e-rev', 'q-review', 'review', b('на ревью', 'to review'), card(['Ревьюер берёт следующую задачу из очереди.', 'The reviewer takes the next task from the queue.'], ['Задачу берёт ревьюер.', 'The reviewer takes it.'])),
      edge('e-revd', 'review', 'q-test', b('ревью пройдено', 'reviewed'), card(['Задача прошла ревью и встаёт в очередь к тестировщику.', 'The task passed review and joins the queue to the tester.'], ['Задачу передаёт ревьюер.', 'The reviewer hands it on.'])),
      edge('e-test', 'q-test', 'test', b('на проверку', 'to testing'), card(['Тестировщик берёт следующую задачу из очереди.', 'The tester takes the next task from the queue.'], ['Задачу берёт тестировщик.', 'The tester takes it.'])),
      edge('e-done', 'test', 'done', b('проверено', 'tested'), card(['Проверенная задача уходит к покупателям.', 'A tested task goes to the customers.'], ['Задачу передаёт тестировщик.', 'The tester hands it on.'])),
    ],
  },
  params: [
    { id: 'arrivals', group: b('Сколько работы приходит', 'How much work arrives'), label: b('Сколько новых задач приходит каждое утро', 'New tasks arriving every morning'), kind: 'range', min: 1, max: 5, step: 1, default: 3, near: 'ready', levels: ['intermediate', 'experienced'] },
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
        prompt: b('Вы включаете или выключаете лимит: новую задачу не берут, пока в работе шесть задач. Как изменится время цикла, то есть сколько дней одна задача проводит в работе?', 'You switch the limit on or off: no new task is started while six are in progress. How does the cycle time change, that is, how many days one task spends in progress?'),
        options: [
          { id: 'shorter', text: b('С лимитом время цикла короче, потому что задачи меньше ждут в очередях', 'With the limit the cycle time is shorter, because tasks wait less in queues') },
          { id: 'same', text: b('Время цикла не зависит от лимита', 'The cycle time does not depend on the limit') },
          { id: 'longer', text: b('С лимитом время цикла длиннее, потому что разработчики простаивают', 'With the limit the cycle time is longer, because the developers stand idle') },
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
          { id: 'pile', text: b('Задачи будут копиться в очереди к проверке, и до покупателей не дойдёт ни одна', 'Tasks pile up in the queue to testing, and none reaches the customers') },
          { id: 'faster', text: b('Остальные успеют больше, потому что их никто не задерживает', 'The others get more done, because nobody holds them up') },
        ],
        resolve: (_p, next) => ((lastMetrics(next).done ?? 0) === 0 ? 'pile' : 'faster'),
      },
    },
  ],
  metrics: [
    { id: 'done', label: b('готово задач', 'tasks done') },
    { id: 'wip', label: b('задач в работе', 'tasks in progress') },
    { id: 'th', label: b('готово в день', 'done a day') },
    { id: 'cycle', label: b('время цикла, дней', 'cycle time, days') },
  ],
  run(p, broken): Step[] {
    const removed = broken.has('no-test');
    const r = simulate(p, removed);
    const steps: Step[] = [];
    const testCap0 = removed ? 0 : r1(p.test * (p.focus ? 1.2 : 1));
    const slowest = Math.min(p.dev, REVIEW_CAP, testCap0);
    const zero = { done: 0, wip: 0, th: 0, cycle: 0 };
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
            caption: fmtn(b('После ревью задачи встают в очередь к тестировщику. Он проверяет {t} в день, меньше, чем любой другой этап.', 'After review the tasks join the queue to the tester. The tester tests {t} a day, fewer than any other stage.'), { t: TA(testCap0) }),
            focus: ['test', 'q-test'],
            say: { test: fmtn(b('Тестировщик успевает только {t} в день.', 'The tester manages only {t} a day.'), { t: TA(testCap0) }) },
            reveal: ['q-test', 'test', 'e-revd', 'e-test'],
            metrics: zero,
          },
    );
    steps.push({
      id: p.limit ? 'limit-on' : 'slowest',
      label: b('предел', 'limit'),
      caption: removed
        ? b('Самым медленным этапом сейчас стала проверка, и её мощность равна нулю. Посмотрим, что это значит для десяти дней работы.', 'The slowest stage now is testing, and its capacity is zero. Let us see what that means for ten days of work.')
        : fmtn(b('Самый медленный этап успевает {s} в день. Как бы быстро ни работали остальные, до покупателей каждый день будет доходить не больше задач, чем успевает он. {l}', 'The slowest stage manages {s} a day. However fast the others work, no more than that will reach the customers per day. {l}'), {
            s: TA(slowest),
            l: p.limit ? b('Включён лимит, поэтому новую задачу не берут, пока в работе шесть задач.', 'The limit is on: no new task is started while six are in progress.') : b('Лимита нет, поэтому разработчики берут новые задачи каждое утро.', 'There is no limit: the developers take new tasks every morning.'),
          }),
      focus: ['done', 'e-done'],
      say: { done: removed ? b('Сюда не дойдёт ничего, пока проверять некому.', 'Nothing will get here while nobody can test.') : b('Сюда каждый день будет приходить не больше задач, чем успевает самый медленный этап.', 'No more tasks a day will come here than the slowest stage manages.') },
      reveal: ['done', 'e-done'],
      states: removed ? { 'e-done': 'off' } : {},
      metrics: zero,
    });
    const full = (n: number) => Math.min(1, n / 12);
    r.days.forEach((d, i) => {
      const day = i + 1;
      const doneSoFar = r1(d.done);
      const th = r1(d.done / day);
      const cyc = th ? r1(r.days.slice(0, day).reduce((a, x) => a + x.wip, 0) / day / th) : 0;
      const worst = removed || d.qTest >= d.qReview ? 'q-test' : 'q-review';
      const actor = worst === 'q-test' ? (removed ? 'q-test' : 'test') : 'review';
      const say =
        actor === 'test'
          ? fmtn(b('Тестировщик проверил {o}, а в очереди к нему остаётся {q}.', 'The tester tested {o}, and {q} remain in the queue.'), { o: TA(d.out), q: T(d.qTest) })
          : actor === 'review'
            ? fmtn(b('Ревью пропустило {o}, а в очереди к нему остаётся {q}.', 'Review passed {o}, and {q} remain in the queue.'), { o: TA(d.outReview), q: T(d.qReview) })
            : fmtn(b('В очереди к проверке уже {q}, и ни одна задача не ушла дальше.', 'There are already {q} in the queue to testing, and none moved on.'), { q: T(d.qTest) });
      const st: Step = {
        id: `d${day}`,
        label: `${day}`,
        caption: day === 1
          ? fmtn(b('В первый день разработчики берут в работу первые {p}, а ревью и проверке пока нечего делать, потому что до них ещё ничего не дошло.', 'Day 1. The developers start their first {p}, while review and testing have nothing to do yet, because nothing has reached them.'), { p: TA(Math.min(p.arrivals, p.dev)) })
          : fmtn(b('На {n}-й день разработка закончила {dv}, ревью пропустило {rv}, проверка выпустила к покупателям {ov}. Всего готово {x}, в очереди к ревью остаётся {qr}, в очереди к проверке остаётся {qt}.', 'Day {n}. Development finished {dv}, review passed {rv}, testing released {ov} to the customers. {x} done in all; {qr} wait for review, {qt} wait for testing.'), {
          n: day,
          dv: TA(d.outDev),
          rv: TA(d.outReview),
          ov: TA(d.out),
          x: T(doneSoFar),
          qr: T(d.qReview),
          qt: T(d.qTest),
        }),
        focus: [worst, actor],
        say: { [actor]: say },
        tokens: removed ? [{ edge: 'e-revd', label: `+${ruNum(r1(d.outReview))}` }] : [{ edge: 'e-done', label: `+${ruNum(r1(d.out))}` }],
        values: { ready: ruNum(r1(d.ready)), 'q-review': ruNum(r1(d.qReview)), 'q-test': ruNum(r1(d.qTest)), done: ruNum(doneSoFar) },
        fill: { ready: full(d.ready), 'q-review': full(d.qReview), 'q-test': full(d.qTest) },
        states: { 'q-test': d.qTest > 6 ? 'warn' : 'on', 'q-review': d.qReview > 6 ? 'warn' : 'on', done: doneSoFar > 0 ? 'ok' : 'on' },
        metrics: { done: doneSoFar, wip: r1(d.wip), th, cycle: cyc },
      };
      if (removed && day === DAYS) st.broken = { at: 'q-test', message: `queue before testing: ${r1(d.qTest)} tasks\ndone: 0`, caption: b('без проверки поток стоит, и всё, что сделала разработка, копится в очереди и не приносит покупателям никакой пользы.', 'without testing the flow stands still, and everything development made piles up in the queue and gives the customers nothing.') };
      steps.push(st);
    });
    steps.push({
      id: 'sum',
      label: b('итог', 'total'),
      caption: removed
        ? b('За десять дней до покупателей не дошло ни одной задачи. Поток идёт со скоростью самого медленного этапа, а скорость проверки здесь равна нулю.', 'In ten days not a single task reached the customers. The flow moves at the speed of its slowest stage, and the speed of testing here is zero.')
        : p.arrivals < slowest
          ? fmtn(b('За {n} дней готово {x}. Новых задач приходит меньше, чем успевает даже самый медленный этап, поэтому команду сейчас ограничивают не этапы, а поток новых задач. По закону Литтла время цикла получается около {c}.', 'In {n} days {x} are done. Fewer new tasks arrive than even the slowest stage manages, so the team is now limited not by its stages but by the flow of new tasks. Cycle time by Little’s law is about {c}.'), { n: DAYS, x: T(r.done), c: Td(r.cycle) })
          : fmtn(b('За {n} дней готово {x}. В последние дни до покупателей доходило по {o} в день, то есть столько, сколько успевает самый медленный этап, а первые дни ушли на то, чтобы задачи до него добрались. По закону Литтла время цикла получается около {c}.', 'In {n} days {x} are done. In the last days {o} a day reached the customers, as many as the slowest stage manages, and the first days went on the tasks getting that far. Cycle time by Little’s law is about {c}.'), { n: DAYS, x: T(r.done), o: T(r.days[DAYS - 1].out), c: Td(r.cycle) }),
      focus: removed ? ['q-test'] : ['done'],
      say: removed ? { 'q-test': fmtn(b('Здесь скопилось {q}, а до покупателей не дошло ни одной задачи.', '{q} piled up here, and the customers have zero.'), { q: T(r.days[DAYS - 1].qTest) }) } : { done: fmtn(b('За десять дней сюда дошло {x}.', 'In ten days {x} got here.'), { x: T(r.done) }) },
      states: removed ? { done: 'off' } : { done: 'ok' },
      metrics: { done: r.done, wip: r.wipAvg, th: r.throughput, cycle: r.cycle },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, c): Bi {
    const m0 = lastMetrics(prev);
    const m1 = lastMetrics(next);
    const v = { d0: T(m0.done ?? 0), d1: T(m1.done ?? 0), c0: m0.cycle ?? 0, c1: Td(m1.cycle ?? 0), w0: m0.wip ?? 0, w1: T(m1.wip ?? 0) };
    if (change.kind === 'break')
      return change.on
        ? b('Тестировщика нет, и до покупателей не дошло ничего, хотя разработка работает в полную силу. Всё, что она сделала, лежит в очереди к проверке.', 'The tester is away, and nothing reached the customers although development works at full speed. Everything it made lies in the queue to testing.')
        : b('Тестировщик вернулся, и задачи снова доходят до покупателей.', 'The tester is back, and tasks reach the customers again.');
    switch (change.id) {
      case 'dev':
        return fmtn(b('Разработка теперь заканчивает {y} в день вместо {x}. За десять дней готово {d1} вместо {d0}, потому что число задач, которые доходят до покупателей, задаёт самый медленный этап. Лишняя мощность перед ним только быстрее наполняет очередь, и в работе теперь в среднем {w1} вместо {w0}.', 'Development now finishes {y} a day instead of {x}. In ten days {d1} are done instead of {d0}, because the slowest stage sets how many tasks reach the customers. Extra capacity before it only fills the queue faster, and on average {w1} are now in progress instead of {w0}.'), { x: a.dev as number, y: TA(c.dev as number), ...v });
      case 'test':
        return fmtn(b('Тестировщик теперь проверяет {y} в день вместо {x}. Готово {d1} вместо {d0}, а время цикла равно {c1} вместо {c0}. Если ускорить узкое место, ускоряется вся система.', 'The tester now tests {y} a day instead of {x}. {d1} are done instead of {d0}, and the cycle time is {c1} instead of {c0}. When the bottleneck speeds up, the whole system speeds up.'), { x: a.test as number, y: TA(c.test as number), ...v });
      case 'limit':
        return c.limit
          ? fmtn(b('С лимитом очередь перед проверкой перестала расти. В работе теперь в среднем {w1} вместо {w0}, время цикла равно {c1} вместо {c0}, а готово столько же задач, {d1}.', 'With the limit the queue before testing stopped growing. On average {w1} are now in progress instead of {w0}, the cycle time is {c1} instead of {c0}, and just as many tasks are done, {d1}.'), v)
          : fmtn(b('Без лимита разработчики берут в работу всё подряд, поэтому в работе теперь в среднем {w1} вместо {w0}, время цикла равно {c1} вместо {c0}, а готово столько же задач.', 'Without the limit the developers start everything, so on average {w1} are now in progress instead of {w0}, the cycle time is {c1} instead of {c0}, and the same number of tasks is done.'), v);
      case 'focus':
        return c.focus
          ? fmtn(b('Тестировщик больше не переключается на другие дела и проверяет на 20 % больше, поэтому готово {d1} вместо {d0}. Так выглядит шаг «использовать», на котором команда берёт от узкого места всё, на что оно способно.', 'The tester no longer switches to other things and tests 20% more, so {d1} are done instead of {d0}. This is the “exploit” step, at which the team gets everything the bottleneck can give.'), v)
          : fmtn(b('Тестировщика снова отвлекают на совещания и чужие задачи, и готово теперь {d1} вместо {d0}.', 'The tester is pulled into meetings and other tasks again, and {d1} are now done instead of {d0}.'), v);
      case 'swarm':
        return c.swarm
          ? fmtn(b('Свободные разработчики помогают проверять, хоть и вдвое медленнее тестировщика, и готово теперь {d1} вместо {d0}. Так выглядит шаг «подчинить», на котором остальные работают на узкое место, а не начинают новые задачи.', 'Free developers help with testing, if half as fast as the tester, and {d1} are now done instead of {d0}. This is the “subordinate” step, at which the others work for the bottleneck instead of starting new tasks.'), v)
          : fmtn(b('Разработчики больше не помогают проверке, и готово теперь {d1} вместо {d0}.', 'The developers no longer help with testing, and {d1} are now done instead of {d0}.'), v);
      default:
        return fmtn(b('Новых задач каждое утро теперь {y} вместо {x}. Готово {d1} вместо {d0}, в работе в среднем {w1} вместо {w0}. Если задач приходит больше, чем уходит, очередь растёт без предела.', 'There are now {y} new tasks every morning instead of {x}. {d1} done instead of {d0}, on average {w1} in progress instead of {w0}. When more comes in than goes out, the queue grows without bound.'), { x: a.arrivals as number, y: c.arrivals as number, ...v });
    }
  },
});
