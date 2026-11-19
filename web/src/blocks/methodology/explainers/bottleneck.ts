// X4 "Where the flow gets stuck" (07 §5.6): four stages, queues between them,
// ten days. The output of the system is the capacity of its slowest stage; a
// limit on work in progress keeps the queue in front of it short; swarming
// and focus raise the bottleneck itself.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';

type P = { arrivals: number; dev: number; test: number; limit: boolean; focus: boolean; swarm: boolean };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
const GOAL = { url: 'https://en.wikipedia.org/wiki/Theory_of_constraints', label: 'Wikipedia › Theory of constraints' };

export const DAYS = 10;
export const REVIEW_CAP = 4;
export const LIMIT = 6;

export interface FlowRun {
  days: { ready: number; dev: number; qReview: number; qTest: number; done: number; wip: number; out: number; testCap: number }[];
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
    days.push({ ready, dev, qReview, qTest, done, wip, out: outT, testCap });
  }
  const r = (x: number) => Math.round(x * 10) / 10;
  const wipAvg = days.reduce((a, x) => a + x.wip, 0) / DAYS;
  const throughput = done / DAYS;
  return { days, done: r(done), wipAvg: r(wipAvg), throughput: r(throughput), cycle: throughput ? r(wipAvg / throughput) : 99 };
}

export const bottleneckModel = defineModel<P>({
  id: 'method.x.bottleneck',
  block: 'methodology',
  title: bi('Где застревает поток', 'Where the flow gets stuck'),
  summary: bi(
    'Десять дней работы команды. Каждый этап делает столько, сколько позволяет его мощность, но не больше, чем лежит перед ним. Найдите узкое место по очередям и попробуйте его расширить.',
    'Ten days of a team’s work. Each stage does as much as its capacity allows, but no more than lies in front of it. Find the bottleneck by the queues and try to elevate it.',
  ),
  concepts: ['method.bottleneck', 'method.five-steps', 'method.swarming'],
  diagram: {
    width: 960,
    height: 300,
    nodes: [
      { id: 'ready', label: bi('Готово к работе', 'Ready'), sub: '0', family: 'neutral', shape: 'buffer', x: 16, y: 40, w: 128, h: 64, card: card(bi('Очередь выбранных задач. Сюда каждое утро приходят новые.', 'The queue of selected tasks. New ones arrive every morning.'), bi('Владелец продукта.', 'The product owner.')) },
      { id: 'dev', label: bi('Разработка', 'Development'), sub: '3/day', family: 'ci-build', x: 224, y: 40, w: 128, h: 64, card: card(bi('Два разработчика: мощность — сколько задач в день они могут закончить.', 'Two developers: the capacity is how many tasks a day they can finish.'), bi('Разработчики.', 'Developers.')) },
      { id: 'q-review', label: bi('ждут ревью', 'wait for review'), sub: '0', family: 'gauge', shape: 'buffer', x: 348, y: 196, w: 120, h: 48, card: card(bi('Очередь перед ревью: «готово» колонки разработки.', 'The queue before review: the “done” part of the development column.'), bi('Никто: это очередь.', 'Nobody: it is a queue.')) },
      { id: 'review', label: bi('Ревью', 'Review'), sub: `${REVIEW_CAP}/day`, family: 'ci-build', x: 464, y: 40, w: 120, h: 64, card: card(bi('Проверка кода коллегой. Мощность — четыре задачи в день.', 'Code review by a colleague. Capacity: four tasks a day.'), bi('Разработчики по очереди.', 'Developers in turn.')) },
      { id: 'q-test', label: bi('ждут проверки', 'wait for testing'), sub: '0', family: 'gauge', shape: 'buffer', x: 580, y: 196, w: 120, h: 48, card: card(bi('Очередь перед проверкой. Если она растёт, проверка не успевает.', 'The queue before testing. When it grows, testing cannot keep up.'), bi('Никто: это очередь.', 'Nobody: it is a queue.')) },
      { id: 'test', label: bi('Проверка', 'Testing'), sub: '2/day', family: 'ci-test', x: 696, y: 40, w: 120, h: 64, card: card(bi('Один тестировщик. Его мощность ниже, чем у остальных этапов.', 'One tester. Their capacity is lower than that of the other stages.'), bi('Тестировщик.', 'The tester.'), { doc: GOAL }) },
      { id: 'done', label: bi('Готово', 'Done'), sub: '0', family: 'user', x: 872, y: 40, w: 80, h: 64, card: card(bi('Задачи у покупателей. Их число за день — пропускная способность системы.', 'Tasks with the customers. Their number per day is the throughput of the system.'), bi('Покупатели.', 'Customers.')) },
    ],
    edges: [
      { id: 'e-pull', from: 'ready', to: 'dev', label: bi('в работу', 'start'), card: card(bi('Сколько задач разработка берёт каждое утро. С лимитом — только если в системе есть место.', 'How many tasks development starts each morning. With a limit, only if there is room in the system.'), bi('Разработчики.', 'Developers.')) },
      { id: 'e-code', from: 'dev', to: 'q-review', label: bi('код готов', 'code done'), card: card(bi('Закончили писать — задача ждёт ревьюера.', 'Coding finished: the task waits for a reviewer.'), bi('Разработчики.', 'Developers.')) },
      { id: 'e-rev', from: 'q-review', to: 'review', label: bi('на ревью', 'to review'), card: card(bi('Ревьюер берёт задачу из очереди.', 'A reviewer takes a task from the queue.'), bi('Ревьюер.', 'The reviewer.')) },
      { id: 'e-revd', from: 'review', to: 'q-test', label: bi('ревью пройдено', 'reviewed'), card: card(bi('Задача прошла ревью и ждёт тестировщика.', 'The task passed review and waits for the tester.'), bi('Ревьюер.', 'The reviewer.')) },
      { id: 'e-test', from: 'q-test', to: 'test', label: bi('на проверку', 'to testing'), card: card(bi('Тестировщик берёт задачу из очереди.', 'The tester takes a task from the queue.'), bi('Тестировщик.', 'The tester.')) },
      { id: 'e-done', from: 'test', to: 'done', label: bi('выход', 'out'), card: card(bi('Задача проверена и уходит покупателям.', 'The task is tested and goes to the customers.'), bi('Тестировщик.', 'The tester.')) },
    ],
  },
  params: [
    { id: 'arrivals', label: bi('Входящих задач в день', 'Incoming tasks per day'), kind: 'range', min: 1, max: 5, step: 1, default: 3, near: 'ready' },
    {
      id: 'dev',
      label: bi('Мощность разработки, задач в день', 'Development capacity, tasks per day'),
      kind: 'range',
      min: 1,
      max: 6,
      step: 1,
      default: 3,
      near: 'dev',
      predict: {
        prompt: bi('Разработку ускоряют вдвое: 3 → 6 задач в день. Что станет с выходом системы?', 'Development gets twice as fast: 3 → 6 tasks a day. What happens to the output of the system?'),
        options: [
          { id: 'same', text: bi('Почти не изменится', 'Almost nothing changes') },
          { id: 'double', text: bi('Вырастет вдвое', 'It doubles') },
          { id: 'down', text: bi('Упадёт', 'It falls') },
        ],
        resolve: (prev, next) => {
          const a = prev[prev.length - 1].metrics?.done ?? 0;
          const b = next[next.length - 1].metrics?.done ?? 0;
          return b > a * 1.5 ? 'double' : b < a * 0.9 ? 'down' : 'same';
        },
      },
    },
    { id: 'test', label: bi('Мощность проверки, задач в день', 'Testing capacity, tasks per day'), kind: 'range', min: 1, max: 6, step: 1, default: 2, near: 'test' },
    {
      id: 'limit',
      label: bi(`Лимит: в работе не больше ${LIMIT} задач`, `Limit: at most ${LIMIT} tasks in progress`),
      kind: 'toggle',
      default: false,
      near: 'q-test',
      predict: {
        prompt: bi('В системе не больше шести задач одновременно. Что станет со временем цикла?', 'At most six tasks in the system at once. What happens to cycle time?'),
        options: [
          { id: 'shorter', text: bi('Станет короче', 'It gets shorter') },
          { id: 'same', text: bi('Не изменится', 'It stays the same') },
          { id: 'longer', text: bi('Станет длиннее: работа простаивает', 'It gets longer: work stands still') },
        ],
        resolve: (prev, next) => ((next[next.length - 1].metrics?.cycle ?? 0) < (prev[prev.length - 1].metrics?.cycle ?? 0) ? 'shorter' : 'same'),
      },
    },
    { id: 'focus', label: bi('Использовать: проверка не отвлекается на другое (+20%)', 'Exploit: testing is not distracted (+20%)'), kind: 'toggle', default: false, near: 'test' },
    { id: 'swarm', label: bi('Подчинить: свободные разработчики помогают проверке', 'Subordinate: free developers help testing'), kind: 'toggle', default: false, near: 'test' },
  ],
  breaks: [
    {
      id: 'no-test',
      label: bi('Тестировщик ушёл на две недели', 'The tester is away for two weeks'),
      remove: ['test', 'e-test', 'e-done'],
      boundary: 'process',
      predict: {
        prompt: bi('Проверять некому. Что будет с работой остальных?', 'Nobody can test. What happens to everyone else’s work?'),
        options: [
          { id: 'pile', text: bi('Она будет копиться перед проверкой, до покупателей не дойдёт ничего', 'It piles up before testing; nothing reaches the customers') },
          { id: 'faster', text: bi('Остальные успеют больше', 'The others get more done') },
        ],
        resolve: () => 'pile',
      },
    },
  ],
  metrics: [
    { id: 'done', label: bi('готово', 'done') },
    { id: 'wip', label: bi('в работе', 'in progress') },
    { id: 'th', label: bi('пропускная способность', 'throughput'), unit: '/d' },
    { id: 'cycle', label: bi('время цикла ≈ WIP / выход', 'cycle time ≈ WIP / output'), unit: 'd' },
  ],
  run(p, broken): Step[] {
    const removed = broken.has('no-test');
    const r = simulate(p, removed);
    const steps: Step[] = [];
    const cap = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
    const testCap0 = removed ? 0 : p.test * (p.focus ? 1.2 : 1);
    const slowest = Math.min(p.dev, REVIEW_CAP, testCap0 || 0);
    steps.push({
      id: 'start',
      label: bi('мощности', 'capacities'),
      caption: fmt(bi('Входит {a} задачи в день. Мощность: разработка {d}, ревью {r}, проверка {t} задачи в день. Самый медленный этап — {s}.', '{a} tasks arrive a day. Capacity: development {d}, review {r}, testing {t} tasks a day. The slowest stage does {s}.'), { a: p.arrivals, d: p.dev, r: REVIEW_CAP, t: cap(testCap0), s: cap(slowest) }),
      focus: ['dev', 'review', 'test'],
      values: { dev: `${p.dev}/day`, test: `${cap(testCap0)}/day`, ready: '0', 'q-review': '0', 'q-test': '0', done: '0' },
      fill: { ready: 0, 'q-review': 0, 'q-test': 0 },
      states: removed ? { test: 'off', 'e-test': 'off', 'e-done': 'off' } : {},
      metrics: { done: 0, wip: 0, th: 0, cycle: 0 },
    });
    const full = (n: number) => Math.min(1, n / 12);
    r.days.forEach((d, i) => {
      const day = i + 1;
      const doneSoFar = Math.round(d.done * 10) / 10;
      const th = Math.round((d.done / day) * 10) / 10;
      const cyc = th ? Math.round((r.days.slice(0, day).reduce((a, x) => a + x.wip, 0) / day / th) * 10) / 10 : 0;
      const worst = d.qTest >= d.qReview ? 'q-test' : 'q-review';
      const caption =
        day === 1
          ? bi('День 1: разработка берёт задачи, очередей ещё нет.', 'Day 1: development starts tasks, there are no queues yet.')
          : fmt(bi('День {n}: готово {x}; в очереди к ревью {qr}, к проверке {qt}.', 'Day {n}: {x} done; {qr} waiting for review, {qt} waiting for testing.'), { n: day, x: cap(doneSoFar), qr: cap(d.qReview), qt: cap(d.qTest) });
      const st: Step = {
        id: `d${day}`,
        label: `${day}`,
        caption,
        focus: day === 1 ? ['e-pull', 'dev'] : [worst, worst === 'q-test' ? 'test' : 'review'],
        tokens: day === 1 ? [{ edge: 'e-pull' }] : removed ? [{ edge: 'e-revd' }] : [{ edge: 'e-done' }],
        values: { ready: cap(d.ready), 'q-review': cap(d.qReview), 'q-test': cap(d.qTest), done: cap(doneSoFar), dev: `${cap(d.dev)} / ${p.dev}` },
        fill: { ready: full(d.ready), 'q-review': full(d.qReview), 'q-test': full(d.qTest) },
        states: { 'q-test': d.qTest > 6 ? 'warn' : 'on', 'q-review': d.qReview > 6 ? 'warn' : 'on' },
        metrics: { done: doneSoFar, wip: Math.round(d.wip * 10) / 10, th, cycle: cyc },
      };
      if (removed && day === DAYS) st.broken = { at: 'q-test', message: `queue before testing: ${cap(d.qTest)} tasks, done: 0`, caption: bi('без проверки поток стоит: всё сделанное разработкой копится в очереди и не приносит ценности.', 'without testing the flow stops: everything development made piles up in the queue and brings no value.') };
      steps.push(st);
    });
    steps.push({
      id: 'sum',
      label: bi('итог', 'total'),
      caption: removed
        ? bi('Итог: ноль у покупателей — поток идёт со скоростью самого медленного этапа, а здесь она ноль.', 'Total: zero with the customers. The flow moves at the speed of its slowest stage, and here it is zero.')
        : fmt(bi('Итог за {n} дней: готово {x}, пропускная способность {t} в день — почти ровно мощность самого медленного этапа ({s}). Время цикла по закону Литтла ≈ {c} дн.', 'Total for {n} days: {x} done, a throughput of {t} a day — almost exactly the capacity of the slowest stage ({s}). Cycle time by Little’s law ≈ {c} d.'), { n: DAYS, x: cap(r.done), t: cap(r.throughput), s: cap(slowest), c: r.cycle }),
      focus: removed ? ['q-test'] : ['done'],
      states: removed ? { done: 'off' } : { done: 'ok' },
      metrics: { done: r.done, wip: r.wipAvg, th: r.throughput, cycle: r.cycle },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const m0 = prev[prev.length - 1].metrics ?? {};
    const m1 = next[next.length - 1].metrics ?? {};
    const v = { d0: m0.done ?? 0, d1: m1.done ?? 0, c0: m0.cycle ?? 0, c1: m1.cycle ?? 0, w0: m0.wip ?? 0, w1: m1.wip ?? 0 };
    if (change.kind === 'break') return change.on ? bi('Проверки нет — выход системы ноль, хотя разработка работает в полную силу. Её работа без проверки не дошла до покупателей.', 'No testing: the system delivers zero although development works at full speed. Its work never reached the customers.') : bi('Тестировщик вернулся — поток снова идёт.', 'The tester is back: the flow moves again.');
    switch (change.id) {
      case 'dev':
        return fmt(bi('Разработка {x} → {y} в день: готово {d0} → {d1}. Выход задаёт самый медленный этап; лишняя мощность до него только быстрее наполняет очередь (в работе {w0} → {w1}).', 'Development {x} → {y} a day: done {d0} → {d1}. The slowest stage sets the output; extra capacity before it only fills the queue faster (in progress {w0} → {w1}).'), { x: a.dev as number, y: b.dev as number, ...v });
      case 'test':
        return fmt(bi('Проверка {x} → {y} в день: готово {d0} → {d1}, время цикла {c0} → {c1} дн. Ускорение узкого места ускоряет всю систему.', 'Testing {x} → {y} a day: done {d0} → {d1}, cycle time {c0} → {c1} d. Speeding up the bottleneck speeds up the whole system.'), { x: a.test as number, y: b.test as number, ...v });
      case 'limit':
        return b.limit
          ? fmt(bi('С лимитом очередь перед проверкой не растёт без конца: в работе {w0} → {w1}, время цикла {c0} → {c1} дн., а готово столько же ({d1}).', 'With the limit the queue before testing stops growing: in progress {w0} → {w1}, cycle time {c0} → {c1} d, and just as much is done ({d1}).'), v)
          : fmt(bi('Без лимита разработка берёт всё подряд: в работе {w0} → {w1}, время цикла {c0} → {c1} дн., выход тот же.', 'Without the limit development starts everything: in progress {w0} → {w1}, cycle time {c0} → {c1} d, the same output.'), v);
      case 'focus':
        return fmt(bi('Проверка без переключений делает на 20% больше: готово {d0} → {d1}. Это шаг «использовать» — выжать из узкого места всё, что есть.', 'Testing without switching does 20% more: done {d0} → {d1}. That is the “exploit” step: get everything out of the bottleneck.'), v);
      case 'swarm':
        return fmt(bi('Свободные разработчики помогают проверке вполсилы: готово {d0} → {d1}. Это шаг «подчинить»: остальные работают на узкое место, а не начинают новое.', 'Free developers help testing at half speed: done {d0} → {d1}. That is the “subordinate” step: the others work for the bottleneck instead of starting new work.'), v);
      default:
        return fmt(bi('Вход {x} → {y} в день: готово {d0} → {d1}, в работе {w0} → {w1}. Если входит больше, чем выходит, очередь растёт без предела.', 'Arrivals {x} → {y} a day: done {d0} → {d1}, in progress {w0} → {w1}. When more comes in than goes out, the queue grows without bound.'), { x: a.arrivals as number, y: b.arrivals as number, ...v });
    }
  },
});
