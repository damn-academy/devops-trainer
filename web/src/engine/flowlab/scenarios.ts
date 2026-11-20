// Scenarios of the MVP (07 §9): S0 "One desk", S1 "Traffic jam" (WIP
// limits), S2 "Black Friday" (incidents, routine and unplanned work), and the
// two short placement runs (5 and 10 days). Terms appear only after their
// lesson: S0 has no limits, S1 has no deployments, S2 has everything.

import { bi } from '../../core/i18n';
import type { Caps, CardSpec, Features, Person, Policies, Scenario } from './types';

const NONE: Features = { wipLimits: false, cfd: false, cycle: false, throughput: false, dora: false, budget: false, stations: false, pullOrder: false, deployPolicy: false };
const ALL: Features = { wipLimits: true, cfd: true, cycle: true, throughput: true, dora: true, budget: true, stations: true, pullOrder: true, deployPolicy: true };

const CAPS0: Caps = { testAutomation: 0, ci: false, autoDeploy: false, rollback: false, monitoring: 'none', runbooks: false, toilAutomation: 0 };
const POL0: Policies = { wip: {}, strictWip: false, pullOrder: 'fifo', deploy: { mode: 'train', every: 5 }, auto: false };

const D6 = [1, 2, 3, 4, 5, 6];

function person(role: string, ru: string, en: string, home: Person['home'], die: number[], skills: Person['skills'] = [home]): Person {
  return { role, label: bi(ru, en), skills, die, station: home, home };
}

const PO = (die = D6) => person('PO', 'Владелец продукта', 'Product owner', 'analysis', die);
const DEV1 = (die = D6) => person('DEV-1', 'Разработчик 1', 'Developer 1', 'dev', die, ['dev', 'analysis']);
const DEV2 = (die = D6) => person('DEV-2', 'Разработчик 2', 'Developer 2', 'dev', die, ['dev', 'analysis']);
const QA = (die = D6) => person('QA', 'Тестировщик', 'Tester', 'test', die);
const OPS = (die = [2, 3, 4, 5]) => person('OPS', 'Эксплуатация', 'Operations', 'ops', die);

const f = (ru: string, en: string, work: CardSpec['work'], codDaily: number, extra: Partial<CardSpec> = {}): CardSpec => ({ title: bi(ru, en), type: 'feature', work, codDaily, ...extra });

// ── S0 «Один стол» ──

const s0Cards: CardSpec[] = [
  f('Оплата картой', 'Card payment', { dev: 3 }, 0, { tags: ['s0'] }),
  f('Фильтр по сортам', 'Filter by tea type', { dev: 3 }, 0, { tags: ['s0'] }),
  f('Отзывы на странице товара', 'Product reviews', { dev: 3 }, 0, { tags: ['s0'] }),
  f('Подарочная упаковка', 'Gift wrapping', { dev: 3 }, 0, { tags: ['s0'] }),
  f('Поиск по названию', 'Search by name', { dev: 3 }, 0, { tags: ['s0'] }),
  f('Рассылка о новинках', 'New-arrivals newsletter', { dev: 3 }, 0, { tags: ['s0'] }),
];
const s0More: CardSpec[] = [
  f('Бонусные баллы', 'Loyalty points', { dev: 3 }, 0, { id: 'N1', tags: ['s0'] }),
  f('Карта чайных регионов', 'Tea-region map', { dev: 3 }, 0, { id: 'N2', tags: ['s0'] }),
  f('Сравнение сортов', 'Compare teas', { dev: 3 }, 0, { id: 'N3', tags: ['s0'] }),
  f('Наборы пробников', 'Sample packs', { dev: 3 }, 0, { id: 'N4', tags: ['s0'] }),
  f('Страница статуса заказа', 'Order status page', { dev: 3 }, 0, { id: 'N5', tags: ['s0'] }),
  f('Калькулятор заварки', 'Brewing calculator', { dev: 3 }, 0, { id: 'N6', tags: ['s0'] }),
];

export const S0: Scenario = {
  id: 's0',
  title: bi('Один стол', 'One desk'),
  brief: bi(
    'Один разработчик, двенадцать одинаковых задач по 3 очка работы, мощность ровно 3 очка в день, случайностей нет. Вы решаете, сколько задач у него в работе одновременно.',
    'One developer, twelve equal tasks of 3 points of work each, a capacity of exactly 3 points a day, no randomness. You decide how many tasks they have in progress at once.',
  ),
  goal: bi('Цель: к концу 8-го дня у покупателей не меньше 6 готовых задач.', 'Goal: by the end of day 8, at least 6 finished tasks are with the customers.'),
  days: 8,
  defaultSeed: 1,
  columns: ['backlog', 'dev', 'done'],
  columnNames: { backlog: bi('Готово к работе', 'Ready'), dev: bi('В работе', 'In progress') },
  hasOps: false,
  people: [person('DEV-1', 'Разработчик 1', 'Developer 1', 'dev', [3])],
  backlog: s0Cards,
  policies: { ...POL0 },
  caps: { ...CAPS0 },
  deterministic: true,
  refWip: { dev: 1 },
  dilemmas: [
    {
      id: 's0-all',
      day: 2,
      text: bi('Владелец продукта положил ещё шесть задач и предлагает: «Начните всё сразу, так быстрее».', 'The product owner added six more tasks and suggests: “Start everything at once, it will be faster.”'),
      options: [
        {
          id: 'all',
          label: bi('Начать все задачи сразу', 'Start all the tasks at once'),
          baseline: true,
          explain: bi('Двенадцать задач в работе у одного человека: из каждого часа полезна четверть, на каждую задачу приходится 0,06 очка в день. За восемь дней не закончится ни одна.', 'Twelve tasks in progress for one person: a quarter of each hour is useful, each task gets 0.06 points a day. Not one finishes in eight days.'),
          effects: [{ addCards: s0More }, { start: ['tag:s0'] }],
          why: 'switching',
        },
        {
          id: 'one',
          label: bi('Положить их в очередь и брать по одной', 'Queue them and take one at a time'),
          reference: true,
          explain: bi('Одна задача в работе — вся мощность на ней: каждый день одна готовая задача.', 'One task in progress gets all the capacity: one finished task every day.'),
          effects: [{ addCards: s0More }],
          why: 'pull',
        },
      ],
    },
  ],
  revenuePerMin: 200,
  features: { ...NONE },
  theory: ['pull', 'switching'],
  explain: {
    prompt: bi('Объясните своими словами: почему одна задача за раз оказалась быстрее, хотя человек и его мощность не изменились?', 'Explain in your own words: why was one task at a time faster, although the person and their capacity did not change?'),
    keys: [
      { label: bi('переключение съедает время', 'switching eats time'), ru: ['переключ', 'многозадач'], en: ['switch', 'multitask'] },
      { label: bi('закончить, а потом начать', 'finish before starting'), ru: ['законч', 'доделат', 'готов'], en: ['finish', 'complete', 'done'] },
      { label: bi('мощность делится между задачами', 'capacity is split between tasks'), ru: ['дел', 'мощност', 'очк'], en: ['split', 'divid', 'capacity', 'point'] },
    ],
    model: bi(
      'Мощность одна и та же — 3 очка в день, но у человека с несколькими задачами часть времени уходит на переключение: при двух задачах полезно 80%, при пяти и больше — 25%. Остаток к тому же делится между задачами, и каждая движется медленно. Когда задача одна, она получает всю мощность и заканчивается за день; новую берём, когда освободилось место.',
      'The capacity is the same 3 points a day, but a person with several tasks loses part of the time on switching: with two tasks 80% is useful, with five or more 25%. What is left is also split between the tasks, so each moves slowly. With one task it gets all the capacity and is finished in a day; a new one is taken when there is room.',
    ),
  },
};

// ── S1 «Пробка» ──

const s1Backlog: CardSpec[] = [
  f('Оплата картой', 'Card payment', { analysis: 1, dev: 4, test: 2 }, 3000),
  f('Подписка на чай', 'Tea subscription', { analysis: 2, dev: 5, test: 2 }, 2500),
  f('Фильтр по сортам', 'Filter by tea type', { analysis: 1, dev: 2, test: 1 }, 1000),
  f('Отзывы на странице товара', 'Product reviews', { analysis: 1, dev: 3, test: 2 }, 1500),
  f('Доставка в пункт выдачи', 'Pickup-point delivery', { analysis: 2, dev: 4, test: 2 }, 3500),
  f('Поиск по названию', 'Search by name', { analysis: 1, dev: 3, test: 1 }, 2000),
  f('Корзина на телефоне', 'Mobile cart', { analysis: 1, dev: 4, test: 2 }, 4000),
  f('Скидка на второй пакет', 'Second-pack discount', { analysis: 1, dev: 2, test: 1 }, 1500),
];

const promo = (n: number, due: number): CardSpec[] =>
  [
    f('Промо: баннер распродажи', 'Promo: sale banner', { analysis: 1, dev: 2, test: 1 }, 3000),
    f('Промо: промокоды', 'Promo: discount codes', { analysis: 1, dev: 4, test: 2 }, 6000),
    f('Промо: таймер акции', 'Promo: countdown timer', { analysis: 1, dev: 2, test: 1 }, 2000),
    f('Промо: подарок к заказу', 'Promo: gift with order', { analysis: 1, dev: 3, test: 2 }, 5000),
    f('Промо: страница акции', 'Promo: campaign page', { analysis: 2, dev: 3, test: 1 }, 4000),
  ]
    .slice(0, n)
    .map((c, i) => ({ ...c, id: `P${i + 1}`, tags: ['promo'], dueDay: due }));

export const S1: Scenario = {
  id: 's1',
  title: bi('Пробка', 'Traffic jam'),
  brief: bi(
    'Команда из четырёх человек: владелец продукта разбирает задачи, двое разработчиков пишут код, тестировщик проверяет. Каждое утро приходят две новые задачи. Мощность каждого — бросок кубика 1–6. Пятнадцать дней.',
    'A team of four: the product owner analyses the tasks, two developers write the code, a tester checks it. Two new tasks arrive every morning. Everyone’s capacity is a roll of a 1–6 die. Fifteen days.',
  ),
  goal: bi('За 20 дней снизьте 85-й процентиль времени цикла и потери от задержки ниже результатов команды без методологии; численные пороги показаны ниже.', 'In 20 days, reduce cycle time p85 and cost of delay below the baseline; numeric thresholds are shown below.'),
  days: 15,
  defaultSeed: 7,
  columns: ['backlog', 'analysis', 'dev', 'test', 'done'],
  columnNames: { backlog: bi('Готово к работе', 'Ready') },
  hasOps: false,
  people: [PO(), DEV1(), DEV2(), QA()],
  backlog: s1Backlog,
  arrivals: { perDay: 2, pool: 'features', work: { analysis: [1, 2], dev: [2, 5], test: [1, 3] }, cod: [500, 4000] },
  policies: { ...POL0 },
  caps: { ...CAPS0 },
  dilemmas: [
    {
      id: 's1-promo',
      day: 3,
      text: bi('Владелец бизнеса просит: акция через полторы недели, начните сразу все пять промо-задач, они все срочные.', 'The business owner asks: the promo starts in a week and a half, start all five promo tasks now, they are all urgent.'),
      options: [
        { id: 'all', label: bi('Начать все пять сразу', 'Start all five now'), baseline: true, explain: bi('Пять задач разом поднимают незавершённую работу: каждая идёт медленнее, к акции готовы одна-две.', 'Five tasks at once raise the work in progress: each goes slower, one or two are ready for the promo.'), effects: [{ addCards: promo(5, 12) }, { start: ['tag:promo'] }], why: 'wip' },
        { id: 'top', label: bi('Поставить в очередь по стоимости задержки и начать с самой дорогой', 'Queue them by cost of delay and start with the most expensive one'), reference: true, explain: bi('Самая дорогая промо-задача начата сразу, остальные ждут места: к акции готовы самые ценные.', 'The most expensive promo task starts at once, the rest wait for room: the most valuable ones are ready for the promo.'), effects: [{ addCards: promo(5, 12) }, { startTop: { tag: 'promo', n: 1 } }], why: 'cod' },
        { id: 'refuse', label: bi('Отказать: команда и так загружена', 'Refuse: the team is busy already'), explain: bi('Отказ без данных: акция прошла без новых функций, магазин недополучил выручку.', 'A refusal without data: the promo ran without new features, the shop lost revenue.'), effects: [{ money: -40000 }], why: 'wip' },
      ],
    },
  ],
  revenuePerMin: 200,
  features: { ...NONE, wipLimits: true, cfd: true, cycle: true, throughput: true },
  theory: ['wip', 'little', 'cycle', 'pull', 'switching', 'cod'],
  explain: {
    prompt: bi('Объясните, почему лимит незавершённой работы ускоряет команду, хотя людей не прибавилось.', 'Explain why a limit on work in progress speeds the team up although nobody was added.'),
    keys: [
      { label: bi('лимит', 'limit'), ru: ['лимит', 'огранич'], en: ['limit'] },
      { label: bi('очередь и ожидание', 'queue and waiting'), ru: ['очеред', 'жд', 'ожидан'], en: ['queue', 'wait'] },
      { label: bi('переключение', 'switching'), ru: ['переключ', 'многозадач'], en: ['switch', 'multitask'] },
      { label: bi('закон Литтла', 'Little’s law'), ru: ['литтл'], en: ['little'] },
    ],
    model: bi(
      'По закону Литтла среднее время цикла равно незавершённой работе, делённой на пропускную способность. Пропускную способность задаёт мощность команды, и лимит её почти не меняет; зато он не даёт копиться очередям и переключениям, поэтому незавершённой работы меньше — и каждая задача проходит путь быстрее. Новую задачу берут, когда освободилось место.',
      'By Little’s law, average cycle time equals work in progress divided by throughput. Throughput is set by the team’s capacity, and a limit barely changes it; but it stops queues and switching from piling up, so there is less work in progress, and each task gets through faster. A new task is taken when there is room.',
    ),
  },
};

// ── S2 «Чёрная пятница» ──

const imp = (id: string, ru: string, en: string, work: CardSpec['work'], effect: CardSpec['effect']): CardSpec => ({ id, title: bi(ru, en), type: 'improvement', work, codDaily: 0, effect, risk: 0.03 });

const s2Backlog: CardSpec[] = [
  ...promo(3, 14),
  f('Оплата картой', 'Card payment', { analysis: 1, dev: 3, test: 2 }, 2500),
  f('Доставка в пункт выдачи', 'Pickup-point delivery', { analysis: 1, dev: 3, test: 1 }, 2000),
  f('Корзина на телефоне', 'Mobile cart', { analysis: 1, dev: 4, test: 2 }, 3000),
  f('Поиск по названию', 'Search by name', { analysis: 1, dev: 2, test: 1 }, 1000),
  imp('IMP-SCRIPT', 'Скрипт выдачи доступов', 'Access-request script', { dev: 3, test: 1 }, { toilAutomation: 0.8 }),
  imp('IMP-DEPLOY', 'Выкладка кнопкой и откат', 'One-click deploy and rollback', { dev: 4, test: 1 }, { ci: true, autoDeploy: true, rollback: true }),
  imp('IMP-TESTS', 'Автотесты основных сценариев', 'Automated tests of the key journeys', { dev: 4, test: 2 }, { testAutomation: 0.5 }),
  imp('IMP-ALERTS', 'Оповещения по скорости сжигания бюджета', 'Burn-rate alerts', { dev: 2, test: 1 }, { monitoring: 'slo-alerts' }),
  imp('IMP-RUNBOOK', 'Инструкция для дежурного', 'Runbook for the on-call engineer', { analysis: 1, dev: 1 }, { runbooks: true }),
];

export const S2: Scenario = {
  id: 's2',
  title: bi('Чёрная пятница', 'Black Friday'),
  brief: bi(
    'Полная доска и эксплуатация. Выкладка раз в пять дней вручную, только силами эксплуатации; рутинных заявок с каждым днём больше; мониторинг видит только падение сервера. С 9-го по 11-й день эксплуатация в отпуске, с 15-го по 17-й — распродажа: трафик и выручка ×4. В бэклоге лежат пять улучшений.',
    'The full board and operations. A manual deployment every five days, done by operations only; more routine requests every day; monitoring only sees the server going down. Operations is on leave on days 9–11; days 15–17 are the sale: traffic and revenue ×4. Five improvements lie in the backlog.',
  ),
  goal: bi('Цель: три промо-функции у покупателей к 14-му дню, простой в дни 15–17 составляет 0 минут, итог по деньгам лучше, чем у команды без методологии.', 'Goal: three promo features with the customers by day 14, downtime on days 15–17 is 0 minutes, and the money result beats a team without the method.'),
  days: 20,
  defaultSeed: 42,
  columns: ['backlog', 'analysis', 'dev', 'test', 'deploy', 'done'],
  hasOps: true,
  people: [PO(), DEV1(), DEV2(), QA(), { ...OPS(), away: [[9, 11]] }],
  backlog: s2Backlog,
  arrivals: { perDay: 1, pool: 'mixed', work: { analysis: [1, 2], dev: [2, 4], test: [1, 2] }, cod: [500, 3000] },
  policies: { ...POL0, deploy: { mode: 'train', every: 5 } },
  caps: { ...CAPS0, monitoring: 'host-check' },
  toil: { base: 1, growEvery: 4, waitCost: 1500 },
  trafficIncidents: { base: 0.03, k: 0.35 },
  sale: { from: 15, to: 17, mult: 4 },
  slo: { target: 0.995 },
  refImprovements: ['IMP-SCRIPT', 'IMP-DEPLOY', 'IMP-ALERTS'],
  dilemmas: [
    {
      id: 's2-toil',
      day: 3,
      text: bi('Эксплуатация тратит больше половины дня на рутинные заявки: доступы, пароли, отчёты. Число заявок растёт вместе с магазином. Что делаем?', 'Operations spends more than half of the day on routine requests: access, passwords, reports. The number of requests grows with the shop. What do we do?'),
      options: [
        { id: 'hire', label: bi('Нанять подрядчика на заявки (60 000 ₽, выйдет с 8-го дня)', 'Hire a contractor for the requests (60,000 ₽, starts on day 8)'), baseline: true, explain: bi('Подрядчик разгребает очередь, но заявок становится больше каждую неделю: рутина растёт вместе с сервисом, а деньги уходят каждый месяц.', 'The contractor clears the queue, but there are more requests every week: routine grows with the service, and the money goes out every month.'), effects: [{ money: -60000 }, { hire: { role: 'OPS-2', label: bi('Подрядчик', 'Contractor'), die: [1, 2, 3], skills: ['ops'], station: 'ops', from: 8 } }], why: 'toil' },
        { id: 'automate', label: bi('Разработчики пишут скрипт выдачи доступов', 'The developers write an access-request script'), reference: true, explain: bi('Три дня разработки сейчас — и восемь заявок из десяти дальше выполняет скрипт. Время эксплуатации освобождается под инциденты и выкладки.', 'Three days of development now, and from then on a script handles eight requests out of ten. Operations time is freed for incidents and deployments.'), effects: [{ prioritize: 'IMP-SCRIPT' }], why: 'automation' },
        { id: 'leave', label: bi('Оставить как есть', 'Leave it as it is'), explain: bi('Очередь заявок растёт, коллеги ждут доступов, эксплуатация не успевает к выкладкам и сбоям.', 'The queue of requests grows, colleagues wait for access, operations has no time for deployments and outages.'), effects: [], why: 'toil' },
      ],
    },
    {
      id: 's2-blame',
      day: 6,
      text: bi('Владелец бизнеса пишет: «Если что-то сломается, сразу скажите, кто виноват, — с ним разберёмся».', 'The business owner writes: “If something breaks, tell me at once who is to blame and we will deal with them.”'),
      options: [
        { id: 'name', label: bi('Договориться называть автора изменения', 'Agree to name the author of the change'), baseline: true, explain: bi('Люди начинают молчать о том, что видели: в следующих сбоях причину ищут вдвое дольше.', 'People stop telling what they saw: in the next outages finding the cause takes twice as long.'), effects: [{ caps: { silence: true } }], why: 'blameless' },
        { id: 'review', label: bi('Предложить разбор без поиска виноватых и писать по итогам задачи на улучшение', 'Propose a blameless review and turn its findings into improvement tasks'), reference: true, explain: bi('Владелец получает факты и задачи вместо имени; в бэклоге появилась инструкция для дежурного с высоким приоритетом.', 'The owner gets facts and tasks instead of a name; a runbook for the on-call engineer went to the top of the backlog.'), effects: [{ prioritize: 'IMP-RUNBOOK' }], why: 'blameless' },
      ],
    },
    {
      id: 's2-release',
      day: 12,
      text: bi('Маркетинг просит: «Выложите к распродаже всё, что готово, одной большой выкладкой прямо сейчас».', 'Marketing asks: “Deploy everything that is ready for the sale in one big deployment right now.”'),
      options: [
        { id: 'big', label: bi('Выложить всё одной партией сегодня', 'Deploy everything in one batch today'), baseline: true, explain: bi('Большая партия — большой риск: если выкладка сломает сайт, причину ищут среди всех изменений сразу.', 'A big batch is a big risk: if the deployment breaks the site, the cause has to be found among all the changes at once.'), effects: [{ deployNow: true }], why: 'batch' },
        { id: 'small', label: bi('Выкладывать по мере готовности небольшими партиями', 'Deploy small batches as things get ready'), reference: true, explain: bi('Маленькая партия реже ломается, а если ломается — понятно, что именно.', 'A small batch breaks less often, and when it does, it is clear what broke.'), effects: [], why: 'batch' },
        { id: 'freeze', label: bi('Заморозить выкладки до конца распродажи', 'Freeze deployments until the sale is over'), explain: bi('Сайт не меняется — но и промо-функции не доходят до покупателей, а стоимость задержки копится.', 'The site does not change — but the promo features do not reach the customers either, and the cost of delay piles up.'), effects: [{ freeze: 6 }], why: 'error-budget' },
      ],
    },
  ],
  revenuePerMin: 200,
  features: { ...ALL },
  theory: ['wip', 'little', 'bottleneck', 'batch', 'toil', 'automation', 'dora', 'error-budget', 'blameless', 'three-ways', 'calms', 'cod'],
  explain: {
    prompt: bi('Что из сделанного сильнее всего помогло (или помешало) пережить распродажу и почему? Назовите механизм и число из прогона.', 'What helped (or hurt) most in getting through the sale, and why? Name the mechanism and a number from your run.'),
    keys: [
      { label: bi('автоматизация', 'automation'), ru: ['автомат', 'скрипт'], en: ['automat', 'script'] },
      { label: bi('размер партии', 'batch size'), ru: ['парти', 'выкладк'], en: ['batch', 'deploy'] },
      { label: bi('рутина и незапланированная работа', 'routine and unplanned work'), ru: ['рутин', 'незаплан', 'заявк'], en: ['toil', 'routine', 'unplanned', 'request'] },
      { label: bi('обнаружение и восстановление', 'detection and recovery'), ru: ['оповещ', 'откат', 'восстанов', 'мониторинг'], en: ['alert', 'rollback', 'restor', 'monitor'] },
    ],
    model: bi(
      'Главное — освободить эксплуатацию от рутины до отпуска и распродажи: скрипт выдачи доступов вернул ей время на выкладки и сбои. Выкладка кнопкой с откатом позволила выкладывать маленькими партиями: риск каждой ниже, а сбой чинится за 10 минут вместо двух часов. Оповещения по скорости сжигания бюджета замечают сбой оплаты, который проверка сервера не видит, — за минуты вместо часов.',
      'The key was freeing operations from routine before the leave and the sale: the access script gave it back time for deployments and outages. One-click deploy with rollback made small batches possible: each is less risky, and an outage is fixed in 10 minutes instead of two hours. Burn-rate alerts catch a broken checkout that the server check cannot see — in minutes instead of hours.',
    ),
  },
};

// ── placement runs (07 §2.3–2.4) ──

const eq = (n: number): CardSpec[] => Array.from({ length: n }, (_, i) => f(`Задача ${i + 1}`, `Task ${i + 1}`, { analysis: 1, dev: 2, test: 1 }, 1000));

/** Five days, fixed capacity: set the limits so that at least 6 cards are done. */
export const P5: Scenario = {
  id: 'p5',
  title: bi('Пять дней', 'Five days'),
  brief: bi('Четыре человека, четырнадцать одинаковых задач, мощность без случайностей.', 'Four people, fourteen equal tasks, capacity without randomness.'),
  goal: bi('К концу 5-го дня готовых задач не меньше 6.', 'By the end of day 5, at least 6 tasks are done.'),
  days: 5,
  defaultSeed: 5,
  columns: ['backlog', 'analysis', 'dev', 'test', 'done'],
  hasOps: false,
  people: [PO([3]), DEV1([3]), DEV2([3]), QA([3])],
  backlog: eq(14),
  policies: { ...POL0, auto: true },
  caps: { ...CAPS0 },
  deterministic: true,
  refWip: { analysis: 2, dev: 2, test: 2 },
  dilemmas: [],
  revenuePerMin: 200,
  features: { ...NONE, wipLimits: true },
  theory: ['wip', 'switching'],
  explain: S1.explain,
};

const p10Backlog: CardSpec[] = Array.from({ length: 10 }, (_, i) => f(`Задача ${i + 1}`, `Task ${i + 1}`, { analysis: 1, dev: 2, test: 3 }, 1000));

/** Ten days with a slow stage: find it and move people. */
export const P10: Scenario = {
  id: 'p10',
  title: bi('Десять дней', 'Ten days'),
  brief: bi('Один этап медленнее других. Каждое утро приходит две задачи.', 'One stage is slower than the others. Two tasks arrive every morning.'),
  goal: bi('За 10 дней закончить не меньше задач, чем проходная линия при этом варианте случайных событий.', 'In 10 days, finish at least as many tasks as the pass line on this seed.'),
  days: 10,
  defaultSeed: 11,
  columns: ['backlog', 'analysis', 'dev', 'test', 'done'],
  hasOps: false,
  people: [PO(), DEV1(), DEV2(), person('QA', 'Тестировщик', 'Tester', 'test', [1, 2, 3, 4])],
  backlog: p10Backlog,
  arrivals: { perDay: 2, pool: 'features', work: { analysis: [1, 1], dev: [2, 3], test: [3, 4] }, cod: [500, 3000] },
  policies: { ...POL0, auto: true },
  caps: { ...CAPS0 },
  dilemmas: [],
  revenuePerMin: 200,
  features: { ...NONE, wipLimits: true, stations: true, cfd: true, cycle: true },
  theory: ['bottleneck', 'wip'],
  explain: S1.explain,
};

export const SCENARIOS: Record<string, Scenario> = { s0: S0, s1: S1, s2: S2, p5: P5, p10: P10 };

export function scenario(id: string): Scenario {
  const sc = SCENARIOS[id];
  if (!sc) throw new Error(`unknown flowlab scenario "${id}"`);
  return sc;
}
