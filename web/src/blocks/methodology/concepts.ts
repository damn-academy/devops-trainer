// Concepts of the methodology block in textbook order (07 §3.2, adapted to
// the MVP lessons). A term may not appear in the prose of a lesson before the
// one that introduces it; `forms` give the Russian declensions the linter
// scans for. Everyday words that are also terms have scan: false.

import { bi } from '../../core/i18n';
import type { Concept } from '../../core/types';

const KANBAN_GUIDE = 'https://kanbanguides.org/english/';

export const concepts: Concept[] = [
  // methodology.business
  {
    id: 'method.value',
    term: bi('ценность', 'value'),
    short: bi('То, за что покупатель платит: работающий магазин и нужные ему возможности. Изменение приносит ценность, только когда дошло до покупателя.', 'What the customer pays for: a working shop and the features they need. A change brings value only once it reaches the customer.'),
    introducedIn: 'methodology.business',
    scan: false,
  },
  {
    id: 'method.dev-ops',
    term: bi('эксплуатация', 'operations'),
    short: bi('Разработка делает изменения продукта; эксплуатация держит прод работающим. У них разные цели, а результат — один.', 'Development makes changes to the product; operations keeps production running. Their goals differ, the result is one.'),
    introducedIn: 'methodology.business',
    forms: { ru: ['эксплуатации', 'эксплуатацию', 'эксплуатацией'] },
    scan: false,
  },
  {
    id: 'method.outage',
    term: bi('сбой', 'outage'),
    short: bi('Прод работает плохо или не работает: покупатели не могут сделать то, ради чего пришли. Другое слово — инцидент.', 'Production works badly or not at all: customers cannot do what they came for. Another word for it is incident.'),
    introducedIn: 'methodology.business',
    forms: { ru: ['сбоя', 'сбою', 'сбоем', 'сбое', 'сбои', 'сбоев', 'сбоям', 'инцидент', 'инцидента', 'инциденты', 'инцидентов'], en: ['outages', 'incident', 'incidents'] },
  },
  {
    id: 'method.devops',
    term: bi('DevOps', 'DevOps'),
    short: bi('Способ работы, при котором разработка и эксплуатация отвечают за общий результат: изменения доходят до покупателей быстро и не ломают сайт.', 'A way of working in which development and operations own one result together: changes reach customers fast and do not break the site.'),
    introducedIn: 'methodology.business',
    docRef: { url: 'https://dora.dev/capabilities/', label: 'dora.dev › Capabilities' },
  },
  // methodology.value-stream
  {
    id: 'method.value-stream',
    term: bi('поток ценности', 'value stream'),
    short: bi('Все шаги, которые проходит изменение от идеи до покупателя, вместе с ожиданиями между ними.', 'All the steps a change goes through from an idea to the customer, together with the waits between them.'),
    introducedIn: 'methodology.value-stream',
    forms: { ru: ['потока ценности', 'потоку ценности', 'потоком ценности', 'потоке ценности'], en: ['value streams'] },
  },
  {
    id: 'method.flow-efficiency',
    term: bi('эффективность потока', 'flow efficiency'),
    short: bi('Доля времени, когда над задачей действительно работали, от всего её пути: работа / (работа + ожидание).', 'The share of time a task was actually worked on, out of its whole journey: work / (work + waiting).'),
    introducedIn: 'methodology.value-stream',
    forms: { ru: ['эффективности потока', 'эффективностью потока'] },
  },
  // methodology.board
  {
    id: 'method.board',
    term: bi('доска', 'board'),
    short: bi('Работа, сделанная видимой: колонки — этапы пути, карточки — задачи с критерием готовности.', 'Work made visible: columns are the stages of the path, cards are tasks with a definition of done.'),
    introducedIn: 'methodology.board',
    scan: false,
  },
  {
    id: 'method.pull',
    term: bi('вытягивание', 'pull system'),
    short: bi('Новую работу берут, когда для неё освободилось место, а не когда её выдали (выталкивание).', 'New work is taken when there is room for it, not when it is handed out (push).'),
    introducedIn: 'methodology.board',
    forms: { ru: ['вытягивания', 'вытягиванию', 'вытягиванием', 'вытягивании'], en: ['pull systems'] },
    docRef: { url: KANBAN_GUIDE, label: 'Kanban Guide' },
  },
  {
    id: 'method.switching',
    term: bi('переключение между задачами', 'context switching'),
    short: bi('Потери времени, когда человек ведёт несколько задач сразу: при двух задачах полезно 80% времени, при пяти — 25% (Вайнберг).', 'Time lost when a person juggles several tasks: with two tasks 80% of the time is useful, with five 25% (Weinberg).'),
    introducedIn: 'methodology.board',
    forms: { ru: ['переключения между задачами', 'переключений между задачами'] },
  },
  // methodology.flow
  {
    id: 'method.wip',
    term: bi('незавершённая работа', 'work in progress'),
    short: bi('Карточки, которые начаты, но не закончены (WIP). Лимит WIP — сколько их может быть в колонке одновременно.', 'Cards started but not finished (WIP). A WIP limit is how many of them a column may hold at once.'),
    introducedIn: 'methodology.flow',
    forms: { ru: ['незавершённой работы', 'незавершённую работу', 'незавершённой работой', 'незавершённой работе', 'WIP', 'лимит WIP', 'лимита WIP'], en: ['WIP', 'WIP limit', 'WIP limits'] },
    docRef: { url: KANBAN_GUIDE, label: 'Kanban Guide › Flow Metrics' },
  },
  {
    id: 'method.cycle-time',
    term: bi('время цикла', 'cycle time'),
    short: bi('Время от начала работы над карточкой до её готовности. Время выполнения — от появления в очереди до готовности.', 'Time from the start of work on a card to the moment it is done. Lead time runs from the moment it entered the queue.'),
    introducedIn: 'methodology.flow',
    forms: { ru: ['времени цикла', 'временем цикла', 'время выполнения', 'времени выполнения'], en: ['lead time'] },
    docRef: { url: KANBAN_GUIDE, label: 'Kanban Guide › Cycle Time' },
  },
  {
    id: 'method.throughput',
    term: bi('пропускная способность', 'throughput'),
    short: bi('Сколько карточек система заканчивает за единицу времени. Возраст карточки — сколько дней начатая карточка уже в работе.', 'How many cards the system finishes per unit of time. Work item age is how long a started card has been in progress.'),
    introducedIn: 'methodology.flow',
    forms: { ru: ['пропускной способности', 'пропускную способность', 'пропускной способностью'] },
    docRef: { url: KANBAN_GUIDE, label: 'Kanban Guide › Throughput' },
  },
  // methodology.little
  {
    id: 'method.little',
    term: bi('закон Литтла', 'Little’s law'),
    short: bi('В стабильной системе: среднее WIP = пропускная способность × среднее время цикла.', 'In a stable system: average WIP = throughput × average cycle time.'),
    introducedIn: 'methodology.little',
    forms: { ru: ['закона Литтла', 'законом Литтла', 'законе Литтла', 'закону Литтла'], en: ["Little's law"] },
    docRef: { url: 'https://doi.org/10.1287/opre.9.3.383', label: 'Little (1961)' },
  },
  {
    id: 'method.cfd',
    term: bi('накопительная диаграмма потока', 'cumulative flow diagram'),
    short: bi('Полосы по колонкам по дням: вертикаль — сколько карточек в работе, горизонталь — примерно время цикла. Расширяется полоса — там копится работа.', 'Bands per column per day: the vertical distance is work in progress, the horizontal one is roughly cycle time. A widening band is where work piles up.'),
    introducedIn: 'methodology.little',
    forms: { ru: ['накопительной диаграммы потока', 'накопительную диаграмму потока', 'накопительной диаграмме потока', 'CFD'], en: ['CFD', 'cumulative flow diagrams'] },
  },
  {
    id: 'method.percentile',
    term: bi('85-й процентиль', '85th percentile'),
    short: bi('Срок, в который уложились 85% карточек. Отсортируйте 20 времён цикла: семнадцатое и есть 85-й процентиль.', 'The time 85% of the cards fitted into. Sort 20 cycle times: the seventeenth is the 85th percentile.'),
    introducedIn: 'methodology.little',
    forms: { ru: ['85-го процентиля', 'процентиль', 'процентиля', 'процентили', 'медиана', 'медианы', 'медиану'], en: ['percentile', 'percentiles', 'median'] },
  },
  // methodology.bottleneck
  {
    id: 'method.bottleneck',
    term: bi('узкое место', 'bottleneck'),
    short: bi('Этап, который задаёт скорость всей системы: выход потока не больше мощности самого медленного этапа.', 'The stage that sets the speed of the whole system: the flow cannot deliver more than its slowest stage.'),
    introducedIn: 'methodology.bottleneck',
    forms: { ru: ['узкого места', 'узким местом', 'узкому месту', 'узком месте', 'узкие места', 'узких мест'], en: ['bottlenecks', 'constraint'] },
  },
  {
    id: 'method.five-steps',
    term: bi('пять шагов фокусирования', 'five focusing steps'),
    short: bi('Теория ограничений Голдратта: найти узкое место, использовать его полностью, подчинить ему остальное, расширить, начать сначала.', 'Goldratt’s Theory of Constraints: identify the constraint, exploit it, subordinate everything else, elevate it, repeat.'),
    introducedIn: 'methodology.bottleneck',
    forms: { ru: ['пяти шагов фокусирования', 'теория ограничений', 'теории ограничений'], en: ['Theory of Constraints'] },
  },
  {
    id: 'method.swarming',
    term: bi('роение', 'swarming'),
    short: bi('Свободные люди помогают этапу, который не успевает, вместо того чтобы начинать новое.', 'Free people help the stage that cannot keep up instead of starting something new.'),
    introducedIn: 'methodology.bottleneck',
    forms: { ru: ['роения', 'роением'] },
  },
  // methodology.batch
  {
    id: 'method.batch',
    term: bi('размер партии', 'batch size'),
    short: bi('Сколько изменений уходит дальше за раз. Чем меньше партия, тем раньше первая ценность, ниже риск и проще найти причину сбоя.', 'How many changes move on at once. The smaller the batch, the sooner the first value, the lower the risk and the easier it is to find the cause of an outage.'),
    introducedIn: 'methodology.batch',
    forms: { ru: ['размера партии', 'размером партии', 'партия', 'партии', 'партией', 'партиями', 'партий'], en: ['batch', 'batches'] },
  },
  {
    id: 'method.cod',
    term: bi('стоимость задержки', 'cost of delay'),
    short: bi('Сколько денег теряется за каждый день, пока изменение не у покупателей. CD3 — стоимость задержки, делённая на длительность работы.', 'How much money is lost each day the change is not with the customers. CD3 is the cost of delay divided by the duration of the work.'),
    introducedIn: 'methodology.batch',
    forms: { ru: ['стоимости задержки', 'стоимостью задержки', 'CD3'], en: ['CD3'] },
    docRef: { url: 'https://blackswanfarming.com/cost-of-delay/', label: 'Black Swan Farming › Cost of Delay' },
  },
  // methodology.agile
  {
    id: 'method.agile',
    term: bi('Agile-манифест', 'Agile Manifesto'),
    short: bi('Манифест 2001 года: четыре ценности и двенадцать принципов гибкой разработки — работающий продукт, сотрудничество, готовность к изменениям.', 'The 2001 manifesto: four values and twelve principles of agile software development — working software, collaboration, responding to change.'),
    introducedIn: 'methodology.agile',
    forms: { ru: ['Agile', 'Agile-манифеста', 'гибкая разработка', 'гибкой разработки'], en: ['Agile', 'agile'] },
    docRef: { url: 'https://agilemanifesto.org/', label: 'agilemanifesto.org' },
  },
  {
    id: 'method.scrum',
    term: bi('Scrum', 'Scrum'),
    short: bi('Фреймворк: команда из владельца продукта, Scrum-мастера и разработчиков работает спринтами до месяца; события — планирование, ежедневное событие, обзор, ретроспектива.', 'A framework: a team of a Product Owner, a Scrum Master and Developers works in Sprints of up to a month; the events are planning, the Daily Scrum, review and retrospective.'),
    introducedIn: 'methodology.agile',
    forms: { ru: ['спринт', 'спринта', 'спринты', 'спринтов', 'спринтом', 'бэклог', 'бэклога', 'бэклоге', 'ретроспектива', 'ретроспективы'], en: ['Sprint', 'sprint', 'sprints', 'backlog', 'retrospective'] },
    docRef: { page: 'web/scrumguides.org/scrum-guide', label: 'The Scrum Guide' },
  },
  {
    id: 'method.kanban',
    term: bi('Kanban-метод', 'Kanban method'),
    short: bi('Стратегия оптимизации потока ценности через визуальную систему вытягивания: определить и показать поток, активно управлять работой в нём, улучшать его.', 'A strategy for optimizing the flow of value through a visual, pull-based system: define and visualize the workflow, actively manage items in it, improve it.'),
    introducedIn: 'methodology.agile',
    forms: { ru: ['Kanban-метода', 'Kanban-методу', 'Kanban-методом', 'канбан-метод'], en: ['the Kanban method'] },
    docRef: { page: 'web/kanbanguides.org/kanban-guide', label: 'The Kanban Guide' },
  },
  // methodology.work-types
  {
    id: 'method.work-types',
    term: bi('незапланированная работа', 'unplanned work'),
    short: bi('Четыре типа работ из «Проекта “Феникс”»: бизнес-проекты, внутренние проекты, изменения и незапланированная работа — сбои и срочные просьбы, которые вытесняют всё остальное.', 'Four types of work from “The Phoenix Project”: business projects, internal projects, changes and unplanned work — outages and urgent requests that push everything else aside.'),
    introducedIn: 'methodology.work-types',
    forms: { ru: ['незапланированной работы', 'незапланированную работу', 'внутренний проект', 'внутренние проекты', 'внутренних проектов'], en: ['internal project', 'internal projects'] },
  },
  {
    id: 'method.toil',
    term: bi('рутина', 'toil'),
    short: bi('Ручная, повторяющаяся работа, которая растёт вместе с сервисом и не оставляет долговременной пользы.', 'Manual, repetitive work that grows with the service and leaves no lasting value.'),
    introducedIn: 'methodology.work-types',
    forms: { ru: ['рутины', 'рутину', 'рутиной', 'рутинная', 'рутинной', 'рутинные', 'рутинных'] },
    docRef: { url: 'https://sre.google/sre-book/eliminating-toil/', label: 'SRE book › Eliminating Toil' },
  },
  {
    id: 'method.automation',
    term: bi('автоматизация', 'automation'),
    short: bi('Работа, которую раз и навсегда отдают машине: скрипт, автопроверка, выкладка кнопкой. Главный инструмент против рутины.', 'Work handed to a machine once and for all: a script, an automated check, one-click deployment. The main tool against toil.'),
    introducedIn: 'methodology.work-types',
    forms: { ru: ['автоматизации', 'автоматизацию', 'автоматизацией', 'автоматизировать'] },
  },
  {
    id: 'method.runbook',
    term: bi('инструкция для дежурного', 'runbook'),
    short: bi('Записанный порядок действий при типовом сбое: что проверить, как откатить, кого звать. Знание перестаёт жить в одной голове.', 'A written procedure for a typical outage: what to check, how to restore, whom to call. Knowledge stops living in one head.'),
    introducedIn: 'methodology.work-types',
    forms: { ru: ['инструкции для дежурного', 'инструкцию для дежурного'], en: ['runbooks'] },
  },
  // methodology.pipeline
  {
    id: 'method.ci',
    term: bi('непрерывная интеграция', 'continuous integration'),
    short: bi('Каждый участник часто, хотя бы раз в день, сливает изменения в общую ветку, и каждое слияние автоматически собирается и проверяется. Красную проверку чинят первым делом.', 'Everyone merges their changes into the shared branch often, at least daily, and every merge is built and tested automatically. A red build is fixed first.'),
    introducedIn: 'methodology.pipeline',
    forms: { ru: ['непрерывной интеграции', 'непрерывную интеграцию', 'CI'], en: ['CI'] },
    docRef: { url: 'https://martinfowler.com/articles/continuousIntegration.html', label: 'Fowler › Continuous Integration' },
  },
  {
    id: 'method.cdelivery',
    term: bi('непрерывная доставка', 'continuous delivery'),
    short: bi('Каждое изменение, прошедшее проверки, готово к выкладке в любой момент; на прод его выпускает человек одним действием.', 'Every change that passed the checks is ready to be released at any moment; a person releases it to production with one action.'),
    introducedIn: 'methodology.pipeline',
    forms: { ru: ['непрерывной доставки', 'непрерывную доставку', 'непрерывная поставка', 'непрерывной поставки'], en: ['Continuous Delivery'] },
    docRef: { url: 'https://continuousdelivery.com/', label: 'continuousdelivery.com' },
  },
  {
    id: 'method.cdeployment',
    term: bi('непрерывное развёртывание', 'continuous deployment'),
    short: bi('Каждое изменение, прошедшее проверки, уходит на прод само, без ручного решения.', 'Every change that passed the checks goes to production by itself, without a manual decision.'),
    introducedIn: 'methodology.pipeline',
    forms: { ru: ['непрерывного развёртывания', 'непрерывным развёртыванием'], en: ['Continuous Deployment'] },
  },
  {
    id: 'method.pipeline',
    term: bi('конвейер развёртывания', 'deployment pipeline'),
    short: bi('Автоматическая цепочка от слияния изменения до прода: сборка, проверки, выкладка на стенд, выкладка на прод.', 'The automated chain from a merged change to production: build, checks, deployment to staging, deployment to production.'),
    introducedIn: 'methodology.pipeline',
    forms: { ru: ['конвейера развёртывания', 'конвейер', 'конвейера', 'конвейере', 'конвейером', 'pipeline'], en: ['pipeline', 'pipelines'] },
  },
  {
    id: 'method.rollback',
    term: bi('откат', 'rollback'),
    short: bi('Возврат прода к предыдущей работающей версии. Быстрее хотфикса: чинить можно потом, спокойно.', 'Returning production to the previous working version. Faster than a hotfix: the fix can come later, calmly.'),
    introducedIn: 'methodology.pipeline',
    forms: { ru: ['отката', 'откатом', 'откатить', 'хотфикс', 'хотфикса'], en: ['roll back', 'hotfix'] },
  },
  // methodology.dora
  {
    id: 'method.dora',
    term: bi('метрики DORA', 'DORA metrics'),
    short: bi('Пять метрик доставки: время внесения изменения, частота развёртываний, время восстановления после неудачного развёртывания, доля неудачных изменений, доля внеплановых развёртываний.', 'Five delivery metrics: lead time for changes, deployment frequency, failed deployment recovery time, change failure rate, deployment rework rate.'),
    introducedIn: 'methodology.dora',
    forms: { ru: ['DORA', 'метрик DORA', 'частота развёртываний', 'доля неудачных изменений'], en: ['DORA', 'change failure rate', 'deployment frequency'] },
    docRef: { url: 'https://dora.dev/guides/dora-metrics/', label: 'dora.dev › DORA metrics' },
  },
  {
    id: 'method.goodhart',
    term: bi('закон Гудхарта', 'Goodhart’s law'),
    short: bi('Когда метрика становится целью, она перестаёт быть хорошей метрикой.', 'When a measure becomes a target, it ceases to be a good measure.'),
    introducedIn: 'methodology.dora',
    forms: { ru: ['закона Гудхарта', 'Гудхарт'], en: ["Goodhart's law", 'Goodhart'] },
  },
  // methodology.sre
  {
    id: 'method.sre',
    term: bi('SRE', 'SRE'),
    short: bi('Site Reliability Engineering: эксплуатация как инженерная работа — цели надёжности, бюджет ошибок, борьба с рутиной кодом.', 'Site Reliability Engineering: operations as engineering — reliability targets, error budgets, fighting toil with code.'),
    introducedIn: 'methodology.sre',
    docRef: { url: 'https://sre.google/sre-book/introduction/', label: 'SRE book › Introduction' },
  },
  {
    id: 'method.slo',
    term: bi('SLO', 'SLO'),
    short: bi('SLI — что мерим (доля успешных оформлений заказа); SLO — какую цель ставим (99,5% за 30 дней); SLA — что обещаем по договору и с последствиями.', 'An SLI is what we measure (the share of successful checkouts); an SLO is the target we set (99.5% over 30 days); an SLA is what we promise in a contract, with consequences.'),
    introducedIn: 'methodology.sre',
    forms: { ru: ['SLI', 'SLA'], en: ['SLI', 'SLA', 'SLOs'] },
    docRef: { url: 'https://sre.google/sre-book/service-level-objectives/', label: 'SRE book › Service Level Objectives' },
  },
  {
    id: 'method.error-budget',
    term: bi('бюджет ошибок', 'error budget'),
    short: bi('1 − SLO за окно: при 99,9% за 30 дней — 43,2 минуты. Когда бюджет за четыре недели превышен, выпуски останавливают до возвращения в цель.', '1 − SLO over the window: at 99.9% over 30 days, 43.2 minutes. When the four-week budget is exceeded, releases stop until the service is back within target.'),
    introducedIn: 'methodology.sre',
    forms: { ru: ['бюджета ошибок', 'бюджетом ошибок', 'бюджете ошибок'], en: ['error budgets'] },
    docRef: { url: 'https://sre.google/workbook/error-budget-policy/', label: 'SRE Workbook › Error Budget Policy' },
  },
  {
    id: 'method.burn-rate',
    term: bi('скорость сжигания', 'burn rate'),
    short: bi('Во сколько раз быстрее нормы расходуется бюджет ошибок: доля ошибок / (1 − SLO). 14,4 за час — будить дежурного.', 'How many times faster than normal the error budget is being spent: error ratio / (1 − SLO). 14.4 over an hour means waking the on-call engineer.'),
    introducedIn: 'methodology.sre',
    forms: { ru: ['скорости сжигания', 'скоростью сжигания'] },
    docRef: { url: 'https://sre.google/workbook/alerting-on-slos/', label: 'SRE Workbook › Alerting on SLOs' },
  },
  // methodology.incident
  {
    id: 'method.incident-response',
    term: bi('реагирование на инцидент', 'incident response'),
    short: bi('Обнаружить, сообщить статус, восстановить сервис (смягчить), и только потом искать причину. Дежурный подтверждает оповещение, при нужде эскалирует.', 'Detect, communicate status, restore the service (mitigate), and only then look for the cause. The on-call engineer acknowledges the alert and escalates when needed.'),
    introducedIn: 'methodology.incident',
    forms: { ru: ['реагирования на инцидент', 'эскалация', 'эскалации', 'смягчение'], en: ['escalation', 'mitigation'] },
  },
  {
    id: 'method.postmortem',
    term: bi('разбор без поиска виноватых', 'blameless postmortem'),
    short: bi('Письменный разбор сбоя: хронология, влияние, способствующие факторы и задачи на улучшение — без поиска человека, который виноват.', 'A written review of an outage: timeline, impact, contributing factors and action items — without looking for a person to blame.'),
    introducedIn: 'methodology.incident',
    forms: { ru: ['разбора без поиска виноватых', 'разбор сбоя', 'разбора сбоя', 'постмортем', 'способствующие факторы'], en: ['postmortem', 'postmortems', 'blameless'] },
    docRef: { url: 'https://sre.google/sre-book/postmortem-culture/', label: 'SRE book › Postmortem Culture' },
  },
  // methodology.culture
  {
    id: 'method.three-ways',
    term: bi('три пути', 'the Three Ways'),
    short: bi('Поток слева направо, обратная связь справа налево, непрерывное обучение и эксперименты.', 'Flow from left to right, feedback from right to left, continual learning and experimentation.'),
    introducedIn: 'methodology.culture',
    forms: { ru: ['трёх путей', 'первый путь', 'второй путь', 'третий путь'], en: ['Three Ways', 'First Way', 'Second Way', 'Third Way'] },
  },
  {
    id: 'method.calms',
    term: bi('CALMS', 'CALMS'),
    short: bi('Культура, автоматизация, бережливость, измерение, обмен знаниями: пять опор DevOps.', 'Culture, Automation, Lean, Measurement, Sharing: five pillars of DevOps.'),
    introducedIn: 'methodology.culture',
  },
  {
    id: 'method.westrum',
    term: bi('типология Веструма', 'Westrum typology'),
    short: bi('Три типа организационной культуры по тому, как идёт информация: патологическая (власть), бюрократическая (правила), генеративная (результат).', 'Three types of organizational culture by how information flows: pathological (power), bureaucratic (rules), generative (performance).'),
    introducedIn: 'methodology.culture',
    forms: { ru: ['типологии Веструма', 'Веструм', 'Веструма', 'генеративная', 'генеративной'], en: ['Westrum', 'generative culture'] },
    docRef: { url: 'https://dora.dev/capabilities/generative-organizational-culture/', label: 'dora.dev › Generative culture' },
  },
  {
    id: 'method.devops-engineer',
    term: bi('DevOps-инженер', 'DevOps engineer'),
    short: bi('Человек, который внедряет эту методологию в команде; его главный инструмент — автоматизация.', 'A person who puts this methodology into practice in a team; their main tool is automation.'),
    introducedIn: 'methodology.culture',
    forms: { ru: ['DevOps-инженера', 'DevOps-инженеры', 'DevOps-инженеров', 'DevOps-инженером'], en: ['DevOps engineers'] },
  },
];
