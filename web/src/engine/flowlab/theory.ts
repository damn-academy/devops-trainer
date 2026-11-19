// "Why?" cards: the theory behind each decision of the simulator, short and
// with the formula the model uses. Each card points to the lesson where the
// idea is explained in full; the simulator only links back to the textbook.

import { bi, type Bi } from '../../core/i18n';

export interface TheoryCard {
  id: string;
  title: Bi;
  body: Bi;
  /** The formula or rule, in mono. */
  formula?: string;
  lesson: string;
  source?: { title: string; url: string };
}

export const THEORY: Record<string, TheoryCard> = {
  pull: {
    id: 'pull',
    title: bi('Вытягивание', 'Pull'),
    body: bi(
      'Новую работу берут, когда для неё освободилось место, а не когда её выдали. Тогда работа не копится там, где её не успевают сделать, и каждый видит, что начато и что ждёт.',
      'New work is taken when there is room for it, not when it is handed out. Then work does not pile up where nobody has time for it, and everyone sees what is started and what waits.',
    ),
    lesson: 'methodology.board',
    source: { title: 'The Kanban Guide', url: 'https://kanbanguides.org/english/' },
  },
  switching: {
    id: 'switching',
    title: bi('Переключение между задачами', 'Task switching'),
    body: bi(
      'Человек с несколькими задачами теряет время на переключение: вспомнить, где остановился, собрать контекст. По оценке Джеральда Вайнберга, полезная доля времени падает с числом задач, а остаток ещё и делится между ними.',
      'A person with several tasks loses time switching: remembering where they stopped, rebuilding the context. By Gerald Weinberg’s estimate, the useful share of time falls with the number of tasks, and what remains is split between them.',
    ),
    formula: 'k = 1 2 3 4 5+\nuseful = 100% 80% 60% 40% 25%',
    lesson: 'methodology.board',
  },
  wip: {
    id: 'wip',
    title: bi('Лимит незавершённой работы', 'WIP limit'),
    body: bi(
      'Лимит — сколько карточек может быть в колонке одновременно. Он не ускоряет людей, он не даёт начинать новое, пока старое не закончено: меньше переключений и очередей, короче время цикла. Хорошее начало — число людей на этапе плюс один.',
      'A limit is how many cards a column may hold at once. It does not make people faster; it stops new work from starting until old work is finished: fewer switches and queues, shorter cycle time. A good start is the number of people on the stage plus one.',
    ),
    formula: 'limit(stage) ≈ people(stage) + 1',
    lesson: 'methodology.flow',
    source: { title: 'The Kanban Guide — Flow Metrics', url: 'https://kanbanguides.org/english/' },
  },
  cycle: {
    id: 'cycle',
    title: bi('Время цикла и пропускная способность', 'Cycle time and throughput'),
    body: bi(
      'Время цикла — от начала работы над карточкой до её готовности. Пропускная способность — сколько карточек заканчивается за день. 85-й процентиль времени цикла — срок, в который укладываются 85% карточек: его можно обещать.',
      'Cycle time runs from the start of work on a card to the moment it is done. Throughput is how many cards are finished per day. The 85th percentile of cycle time is the time 85% of the cards fit into: you can promise it.',
    ),
    formula: 'cycle = finished − started + 1 (days)',
    lesson: 'methodology.flow',
  },
  little: {
    id: 'little',
    title: bi('Закон Литтла', 'Little’s law'),
    body: bi(
      'В стабильной системе среднее число начатых карточек равно пропускной способности, умноженной на среднее время цикла. При той же пропускной способности вдвое больше начатого — вдвое дольше каждая карточка. Условия: всё начатое заканчивается, а незавершённой работы в начале и в конце периода примерно поровну.',
      'In a stable system the average number of started cards equals throughput times average cycle time. With the same throughput, twice as much started work means twice as long for each card. Conditions: everything started gets finished, and work in progress is about the same at the start and the end of the period.',
    ),
    formula: 'WIP = throughput × cycle time\ncycle time = WIP / throughput',
    lesson: 'methodology.flow',
    source: { title: 'Little, J.D.C. (1961). A Proof for the Queuing Formula: L = λW', url: 'https://doi.org/10.1287/opre.9.3.383' },
  },
  bottleneck: {
    id: 'bottleneck',
    title: bi('Узкое место', 'Bottleneck'),
    body: bi(
      'Поток идёт со скоростью самого медленного этапа. Ускорять другие этапы бесполезно: работа только быстрее упрётся в очередь перед узким местом. Пять шагов теории ограничений: найти, использовать полностью, подчинить ему остальных, расширить, начать сначала.',
      'The flow moves at the speed of its slowest stage. Speeding up the other stages is useless: work just reaches the queue in front of the bottleneck sooner. The five focusing steps of the Theory of Constraints: identify, exploit, subordinate the rest, elevate, repeat.',
    ),
    formula: 'output ≈ min(capacity of each stage)\nhelp outside own stage = 50%',
    lesson: 'methodology.bottleneck',
  },
  batch: {
    id: 'batch',
    title: bi('Размер партии', 'Batch size'),
    body: bi(
      'Чем больше изменений в одной выкладке, тем выше риск, что она сломает сайт, и тем дольше искать, какое именно изменение виновато. Маленькие частые выкладки реже ломаются и быстрее чинятся. Это иллюстративная модель тренажёра, а не данные исследования; само направление вывода подтверждает DORA.',
      'The more changes one deployment carries, the higher the risk that it breaks the site, and the longer it takes to find which change is to blame. Small frequent deployments break less often and are fixed faster. This is the trainer’s illustrative model, not research data; the direction of the conclusion is what DORA reports.',
    ),
    formula: "r'ᵢ = rᵢ × (1 − automation) × (1 + 0.05 × (b − 1))\np_fail = 1 − 0.98 × Π(1 − r'ᵢ)\ndiagnose = 30 × (1 + 0.25 × (b − 1)) min",
    lesson: 'methodology.bottleneck',
  },
  cod: {
    id: 'cod',
    title: bi('Стоимость задержки', 'Cost of delay'),
    body: bi(
      'Стоимость задержки — сколько денег магазин теряет за каждый день, пока функция не у покупателей. Если брать сначала карточки с наибольшей стоимостью задержки на единицу работы (CD3), при той же мощности теряется меньше.',
      'Cost of delay is how much money the shop loses for each day a feature is not with the customers. Taking first the cards with the highest cost of delay per unit of work (CD3) loses less with the same capacity.',
    ),
    formula: 'CD3 = cost of delay / duration',
    lesson: 'methodology.bottleneck',
    source: { title: 'Black Swan Farming — Cost of Delay', url: 'https://blackswanfarming.com/cost-of-delay/' },
  },
  toil: {
    id: 'toil',
    title: bi('Рутина', 'Toil'),
    body: bi(
      'Рутина — ручная повторяющаяся работа, которая растёт вместе с сервисом и не оставляет долгой пользы: выдать доступ, перезапустить, выгрузить. Если она занимает больше половины времени эксплуатации, на улучшения времени не остаётся, и рутины становится ещё больше.',
      'Toil is manual, repetitive work that grows with the service and leaves no lasting value: grant access, restart, export. When it takes more than half of operations time, nothing is left for improvements, and the toil grows further.',
    ),
    formula: 'requests/day = base + day / grow × (1 − automation)',
    lesson: 'methodology.work-types',
    source: { title: 'Site Reliability Engineering, ch. 5 “Eliminating Toil”', url: 'https://sre.google/sre-book/eliminating-toil/' },
  },
  automation: {
    id: 'automation',
    title: bi('Автоматизация вместо тушения пожаров', 'Automation instead of firefighting'),
    body: bi(
      'Улучшение стоит времени сейчас и отдаёт его каждый день потом. Скрипт выдачи доступов, выкладка кнопкой с откатом, автотесты, оповещения — каждое меняет работу команды навсегда. Пока улучшений нет, команда тушит пожары и на улучшения у неё снова нет времени.',
      'An improvement costs time now and gives it back every day after. An access script, one-click deploy with rollback, automated tests, alerts: each changes the team’s work for good. Without them the team fights fires and again has no time for improvements.',
    ),
    lesson: 'methodology.work-types',
  },
  dora: {
    id: 'dora',
    title: bi('Метрики DORA', 'DORA metrics'),
    body: bi(
      'Частота развёртываний и время внесения изменения говорят о скорости, доля неудачных изменений и время восстановления — о стабильности. Исследования DORA показывают, что у большинства команд они улучшаются вместе: частые маленькие изменения проще выкладывать и откатывать.',
      'Deployment frequency and lead time for changes describe speed; change failure rate and recovery time describe stability. DORA research shows that for most teams they improve together: small frequent changes are easier to deploy and to roll back.',
    ),
    formula: 'CFR = failed deployments / all deployments\nlead time = deployed − committed',
    lesson: 'methodology.dora',
    source: { title: 'DORA’s software delivery performance metrics', url: 'https://dora.dev/guides/dora-metrics/' },
  },
  'error-budget': {
    id: 'error-budget',
    title: bi('Бюджет ошибок', 'Error budget'),
    body: bi(
      'Бюджет ошибок — сколько плохой работы допускает цель надёжности: при 99,5% за 30 дней это 216 минут. Минута, когда не проходит 10% запросов, стоит десятую часть минуты полного простоя. Когда бюджет за окно превышен, по образцу политики из SRE Workbook выкладки останавливают до возвращения в цель.',
      'The error budget is how much bad service a reliability target allows: at 99.5% over 30 days it is 216 minutes. A minute in which 10% of requests fail costs a tenth of a minute of full downtime. When the budget for the window is exceeded, the example policy of the SRE Workbook stops releases until the service is back within target.',
    ),
    formula: 'budget = (1 − SLO) × window\nbad minutes = Σ minutes × failing share × traffic',
    lesson: 'methodology.sre',
    source: { title: 'The Site Reliability Workbook — Error Budget Policy', url: 'https://sre.google/workbook/error-budget-policy/' },
  },
  blameless: {
    id: 'blameless',
    title: bi('Разбор без поиска виноватых', 'Blameless postmortem'),
    body: bi(
      'После сбоя ищут условия, которые сделали ошибку возможной, а не человека. Если за ошибки наказывают, люди перестают рассказывать, что видели, и следующий сбой разбирать дольше: в модели поиск причины удваивается.',
      'After an outage the team looks for the conditions that made the mistake possible, not for a person. When mistakes are punished, people stop telling what they saw, and the next outage takes longer to understand: in the model, diagnosis doubles.',
    ),
    lesson: 'methodology.incident',
    source: { title: 'Site Reliability Engineering, ch. 15 “Postmortem Culture”', url: 'https://sre.google/sre-book/postmortem-culture/' },
  },
  'three-ways': {
    id: 'three-ways',
    title: bi('Три пути', 'The Three Ways'),
    body: bi(
      'Первый путь — поток слева направо: маленькие партии, лимиты, видимая работа. Второй — обратная связь справа налево: автотесты, оповещения, быстрый откат. Третий — непрерывное обучение: разборы без поиска виноватых и время на улучшения.',
      'The First Way is flow from left to right: small batches, limits, visible work. The Second is feedback from right to left: automated tests, alerts, fast rollback. The Third is continual learning: blameless reviews and time for improvement.',
    ),
    lesson: 'methodology.culture',
  },
  calms: {
    id: 'calms',
    title: bi('CALMS', 'CALMS'),
    body: bi(
      'Пять опор DevOps: культура (общая ответственность), автоматизация, бережливость (поток и малые партии), измерение (поток, DORA, бюджет ошибок) и обмен знаниями (инструкции, работа в паре, разборы).',
      'Five pillars of DevOps: Culture (shared responsibility), Automation, Lean (flow and small batches), Measurement (flow, DORA, error budget) and Sharing (runbooks, pairing, reviews).',
    ),
    lesson: 'methodology.culture',
  },
};
