// Lessons 6–10: the bottleneck and the five focusing steps, batch size and
// cost of delay, Agile/Scrum/Kanban, types of work and toil, the deployment
// pipeline (07 §4: MT3–MT7).

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { R, S } from './sources';

const P10 = { ext: { flow: { scenario: 'p10' } } };

export const bottleneck: Lesson = {
  id: 'methodology.bottleneck',
  block: 'methodology',
  title: bi('Узкое место', 'The bottleneck'),
  summary: bi('Почему поток идёт со скоростью самого медленного этапа, пять шагов фокусирования и роение.', 'Why the flow moves at the speed of its slowest stage, the five focusing steps and swarming.'),
  introduces: ['method.bottleneck', 'method.five-steps', 'method.swarming'],
  uses: ['method.wip', 'method.throughput', 'method.cfd', 'method.little'],
  tier: 'core',
  minutes: 35,
  sources: { en: [S.tocWiki, S.devopsHandbook, S.kanbanGuide], ru: [R.toc, R.lean] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Магазину нужно больше функций. Владелец нанял третьего разработчика, и разработка теперь пишет в полтора раза больше кода. Через месяц до покупателей доходит ровно столько же задач, сколько раньше, только ждать их стали дольше. Деньги потрачены — куда делась скорость?',
        'The shop needs more features. The owner hired a third developer, and development now writes one and a half times more code. A month later exactly as many tasks reach the customers as before, only they take longer. The money is spent; where did the speed go?',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'method.x.bottleneck', caption: bi('Подвигайте мощности этапов и посмотрите, при каком изменении растёт «готово». Включите лимит, затем «использовать» и «подчинить».', 'Move the stage capacities and see which change makes “done” grow. Turn on the limit, then “exploit” and “subordinate”.') },
    {
      id: 'constraint',
      kind: 'text',
      step: 'explain',
      title: bi('Узкое место', 'The bottleneck'),
      body: bi(
        'Этапы потока зависят друг от друга: проверка не может проверить больше, чем к ней пришло, а покупатели не получат больше, чем успела проверка. Поэтому выход всей системы не больше мощности самого медленного этапа. Этот этап называют [[method.bottleneck|узким местом]] (в теории ограничений Голдратта — ограничением).\n\nВторое следствие менее очевидно. Колебания — плохой день у тестировщика, неожиданно большая задача — на узком месте не отыгрываются: если оно простояло час, этот час потерян для всей системы навсегда. Если же простояла разработка перед узким местом, ничего не потеряно — проверка всё равно не успела бы больше. Ускорять этапы до узкого места бесполезно: работа только быстрее упрётся в очередь перед ним. Именно это случилось с третьим разработчиком.\n\nНайти узкое место помогает накопительная диаграмма потока: полоса перед ним расширяется, а полосы после него тонкие — там ждут работы.',
        'The stages of a flow depend on each other: testing cannot test more than reached it, and customers cannot get more than testing passed. So the output of the whole system is no more than the capacity of its slowest stage. That stage is called the [[method.bottleneck|bottleneck]] (in Goldratt’s Theory of Constraints, the constraint).\n\nThe second consequence is less obvious. Fluctuations — a bad day for the tester, an unexpectedly big task — are never made up at the bottleneck: if it stood idle for an hour, that hour is lost for the whole system for good. If development before the bottleneck stood idle, nothing is lost: testing could not have done more anyway. Speeding up the stages before the bottleneck is useless: work just reaches the queue in front of it sooner. That is exactly what happened with the third developer.\n\nThe cumulative flow diagram helps to find the bottleneck: the band in front of it widens, and the bands after it are thin, because they are waiting for work.',
      ),
    },
    {
      id: 'steps',
      kind: 'text',
      step: 'explain',
      title: bi('Пять шагов', 'Five steps'),
      body: bi(
        'Элияху Голдратт в книге «Цель» предложил порядок работы с ограничением — [[method.five-steps|пять шагов фокусирования]]:\n\n1. **Найти** узкое место: где растёт очередь и где простаивают после неё.\n2. **Использовать** его полностью: тестировщик не отвлекается на совещания и чужие задачи, у него всегда есть следующая проверенная ревью карточка.\n3. **Подчинить** ему всё остальное: не начинать новое быстрее, чем узкое место успевает (это и делает лимит WIP), а свободные люди помогают ему.\n4. **Расширить**: только теперь — второй тестировщик, автоматические проверки, чек-лист с подготовленными данными.\n5. **Повторить**: после расширения узким местом становится другой этап, и всё начинается сначала.\n\nПорядок важен. Нанять людей (шаг 4) — дорого и медленно, а шаги 2 и 3 почти бесплатны и часто дают больше. Ловушка — пытаться «загрузить всех на 100%»: занятые разработчики, которые начинают всё новые задачи, только растят очередь перед проверкой и время цикла.',
        'In “The Goal” Eliyahu Goldratt proposed an order of work with a constraint, the [[method.five-steps|five focusing steps]]:\n\n1. **Identify** the bottleneck: where the queue grows and where people sit idle after it.\n2. **Exploit** it fully: the tester is not pulled into meetings and other people’s tasks, and always has the next reviewed card waiting.\n3. **Subordinate** everything else to it: do not start new work faster than the bottleneck can take it (that is what a WIP limit does), and let free people help it.\n4. **Elevate** it: only now a second tester, automated checks, a checklist with prepared test data.\n5. **Repeat**: after the elevation another stage becomes the bottleneck, and it all starts again.\n\nThe order matters. Hiring (step 4) is expensive and slow, while steps 2 and 3 are almost free and often give more. The trap is trying to “keep everyone 100% busy”: busy developers who keep starting new tasks only grow the queue before testing and the cycle time.',
      ),
    },
    {
      id: 'swarm',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Роение', 'Swarming'),
      body: bi(
        'Когда разработчики свободны, а проверка не успевает, лучший ход — не новая функция, а помощь проверке. Это называют [[method.swarming|роением]]: люди собираются вокруг застрявшей работы. Разработчик проверяет медленнее тестировщика — в тренажёрах этого блока вдвое, — но каждая его проверенная карточка уходит к покупателям, а новая функция ушла бы в очередь.',
        'When developers are free and testing cannot keep up, the best move is not a new feature but help for testing. This is called [[method.swarming|swarming]]: people gather around the stuck work. A developer tests slower than a tester — half as fast in this block’s trainers — but every card they test goes to the customers, while a new feature would go into the queue.',
      ),
    },
    {
      id: 'find',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate'],
      mode: 'find',
      prompt: bi(
        'Доска на 10 дней, один этап медленнее остальных. Найдите его по команде `flow status` и в `man flow` — как переставить человека в другую колонку. Цель — закончить за 10 дней не меньше задач, чем проходная линия (`flow goal`).',
        'A 10-day board with one stage slower than the others. Find it with `flow status`, and find in `man flow` how to move a person to another column. The goal: finish at least as many tasks in 10 days as the pass line (`flow goal`).',
      ),
      ref: { page: 'man/flow.1', anchor: 'OPTIONS', line: 'station ROLE COLUMN' },
      terminal: {
        setup: P10,
        task: {
          id: 'swarm',
          prompt: bi('За 10 дней закончите не меньше задач, чем проходная линия.', 'In 10 days finish at least as many tasks as the pass line.'),
          check: { when: 'flow.daysDone>=10 && flow.pass.done=1', fail: [{ if: 'flow.daysDone>=10', say: bi('Десять дней прошли, а задач меньше проходной линии. Где растёт очередь? Кто там может помочь?', 'Ten days passed with fewer tasks than the pass line. Where does the queue grow? Who could help there?') }] },
          docStep: 3,
          chips: 'flow station DEV-2 test',
          concepts: ['method.bottleneck', 'method.swarming'],
          hints: { H1: bi('Посмотрите, перед какой колонкой копятся карточки «готово».', 'See in front of which column the “done” cards pile up.'), H2: bi('Подсказка — в разделе OPTIONS: station.', 'The answer is in OPTIONS: station.'), H3: bi('Начните сначала (`flow reset`), переставьте одного разработчика в test и прогоните дни (`flow next 10`).', 'Start again (`flow reset`), move one developer to test and run the days (`flow next 10`).') },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['experienced'],
      mode: 'find',
      prompt: bi(
        'Та же доска на 10 дней. Как переставить людей, в уроке не сказано — это есть только в документации команды. Цель — закончить за 10 дней не меньше задач, чем проходная линия.',
        'The same 10-day board. How to move people is not in the lesson; it is only in the command’s documentation. The goal: finish at least as many tasks in 10 days as the pass line.',
      ),
      ref: { page: 'man/flow.1' },
      terminal: {
        setup: P10,
        task: {
          id: 'swarm-forcing',
          prompt: bi('Закончите за 10 дней не меньше задач, чем проходная линия.', 'Finish at least as many tasks in 10 days as the pass line.'),
          check: { when: 'flow.daysDone>=10 && flow.pass.done=1' },
          docStep: 4,
          beyond: true,
          solutionTokens: ['flow station', 'station DEV-1 test', 'station DEV-2 test'],
          concepts: ['method.bottleneck', 'method.swarming'],
        },
      },
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.five-steps', 'method.q.faster-dev', 'method.q.tester-dilemma'] },
  ],
};

export const batch: Lesson = {
  id: 'methodology.batch',
  block: 'methodology',
  title: bi('Партии и стоимость задержки', 'Batches and cost of delay'),
  summary: bi('Почему маленькие партии дают ценность раньше и ломаются реже; как выбирать порядок работы по стоимости задержки.', 'Why small batches deliver value sooner and break less often; how to choose the order of work by cost of delay.'),
  introduces: ['method.batch', 'method.cod'],
  uses: ['method.value-stream', 'method.wip', 'method.cycle-time', 'method.outage'],
  tier: 'core',
  minutes: 30,
  sources: { en: [S.cod, S.devopsHandbook, S.doraCapabilities], ru: [R.lean, R.kanban] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Известная тренинговая игра: двадцать монет, четыре человека в ряд. Каждый переворачивает монеты и передаёт дальше. В первом раунде дальше передают только все двадцать сразу, во втором — по пять, в третьем — по одной. Во сколько раз быстрее покупатель получит первую монету в третьем раунде, чем в первом?',
        'A well-known training game: twenty coins, four people in a row. Each flips the coins and passes them on. In the first round coins are passed on only all twenty at once, in the second five at a time, in the third one at a time. How many times sooner does the customer get the first coin in the third round than in the first?',
      ),
    },
    {
      id: 'batch',
      kind: 'text',
      step: 'explain',
      title: bi('Размер партии', 'Batch size'),
      body: bi(
        'Пусть один переворот занимает время t. При партии 20 первая монета доходит до покупателя через 80t — вместе с последней. При партии 5 первая доходит через 20t, последняя — через 35t. При партии 1 первая — через 4t, последняя — через 23t: время до первой ценности сократилось в 20 раз, а всё время — в три с половиной, хотя люди работали с той же скоростью.\n\n[[method.batch|Размер партии]] — сколько изменений уходит дальше за раз. Для изменений сайта у маленькой партии есть ещё два выигрыша. Риск: каждое изменение несёт свою вероятность сломать прод, и в большой партии они к тому же взаимодействуют. В модели наших тренажёров выкладка одного изменения ломает сайт в 7% случаев, а выкладка десяти — в 54%. Поиск причины: если сбой после выкладки одного изменения, виновато оно; если после выкладки десяти — сначала надо понять, какое из десяти. Обратная связь тоже приходит быстрее: о проблеме в изменении узнают, пока его автор ещё помнит, что делал.',
        'Let one flip take time t. With a batch of 20 the first coin reaches the customer after 80t, together with the last one. With a batch of 5 the first arrives after 20t and the last after 35t. With a batch of 1 the first comes after 4t and the last after 23t: the time to the first value is twenty times shorter, and the total three and a half times shorter, although people worked at the same speed.\n\n[[method.batch|Batch size]] is how many changes move on at once. For changes to a site a small batch has two more benefits. Risk: each change carries its own chance of breaking production, and in a big batch the changes also interact. In the model of our trainers a deployment of one change breaks the site 7% of the time, and a deployment of ten 54% of the time. Finding the cause: if the outage follows a deployment of one change, that change is to blame; after a deployment of ten, you first have to work out which of the ten. Feedback also comes sooner: a problem in a change is found while its author still remembers what they did.',
      ),
    },
    {
      id: 'cod',
      kind: 'text',
      step: 'explain',
      title: bi('Стоимость задержки', 'Cost of delay'),
      body: bi(
        'Если работы больше, чем мощности, вопрос «что делать первым» решает деньги. [[method.cod|Стоимость задержки]] — сколько магазин теряет за каждый день, пока изменение не у покупателей: функция «оплата картой» может приносить 4 000 ₽ в день, «тёмная тема сайта» — почти ничего.\n\nДон Рейнертсен и Джошуа Арнольд предлагают сравнивать задачи по CD3 (cost of delay divided by duration) — стоимости задержки, делённой на длительность работы. Функция A стоит 10 000 ₽ в неделю и требует двух недель: CD3 = 5 000. Функция B — 6 000 ₽ в неделю и одна неделя: CD3 = 6 000. Сначала B: пока делают B, A теряет 10 000, а если бы сначала делали A, B потеряла бы 12 000.\n\nНекоторым карточкам нужны особые правила — **классы обслуживания**. Сбой оплаты не ждёт своей очереди: для него держат **срочную дорожку** с лимитом в одну карточку. Задача с жёстким сроком (отчёт для налоговой к пятнице) получает приоритет по мере приближения срока.',
        'When there is more work than capacity, the question “what first” is a question of money. [[method.cod|Cost of delay]] is how much the shop loses for each day a change is not with the customers: “card payments” might bring 4,000 ₽ a day, a “dark theme for the site” almost nothing.\n\nDon Reinertsen and Joshua Arnold suggest comparing tasks by CD3 (cost of delay divided by duration). Feature A is worth 10,000 ₽ a week and takes two weeks: CD3 = 5,000. Feature B is worth 6,000 ₽ a week and takes one week: CD3 = 6,000. B goes first: while B is being built, A loses 10,000; had A gone first, B would have lost 12,000.\n\nSome cards need special rules: **classes of service**. A broken checkout does not wait in line: an **expedite lane** with a limit of one card is kept for it. A task with a fixed date (a report for the tax office by Friday) gains priority as the date approaches.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.cd3', 'method.q.batch-why', 'method.q.batch-first'] },
  ],
};

export const agile: Lesson = {
  id: 'methodology.agile',
  block: 'methodology',
  title: bi('Agile, Scrum и Kanban', 'Agile, Scrum and Kanban'),
  summary: bi('Agile-манифест, устройство Scrum по Scrum Guide, Kanban-метод по Kanban Guide — и почему они совместимы.', 'The Agile Manifesto, how Scrum works by the Scrum Guide, the Kanban method by the Kanban Guide, and why they are compatible.'),
  introduces: ['method.agile', 'method.scrum', 'method.kanban'],
  uses: ['method.wip', 'method.cycle-time', 'method.throughput', 'method.percentile', 'method.batch', 'method.pull'],
  tier: 'core',
  minutes: 40,
  sources: { en: [S.manifesto, S.principles, S.scrumGuide, S.kanbanGuide], ru: [R.manifesto, R.principles, R.scrumGuide, R.scrumWiki, R.kanban] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        '«У нас Agile» говорят и команды, которые выпускают маленькие изменения каждый день, и команды, которые раз в квартал выкатывают огромный релиз, но проводят ежедневные созвоны. На собеседовании вас спросят, чем Scrum отличается от Kanban. Ответ «в Scrum спринты» — правда, но не главная.',
        '“We are Agile,” say teams that ship small changes every day, and teams that roll out a huge release once a quarter but hold daily calls. At an interview you will be asked how Scrum differs from Kanban. “Scrum has sprints” is true, but not the main point.',
      ),
    },
    {
      id: 'manifesto',
      kind: 'text',
      step: 'explain',
      title: bi('Манифест', 'The manifesto'),
      body: bi(
        'В 2001 году семнадцать разработчиков записали [[method.agile|Agile-манифест]] — четыре ценности гибкой разработки:\n\n> Люди и взаимодействие важнее процессов и инструментов.\n> Работающий продукт важнее исчерпывающей документации.\n> Сотрудничество с заказчиком важнее согласования условий контракта.\n> Готовность к изменениям важнее следования первоначальному плану.\n\nИ важная оговорка: «не отрицая важности того, что справа, мы всё-таки больше ценим то, что слева». К ценностям прилагаются двенадцать принципов. Почти каждый вы уже видели в механике этого блока: «работающий продукт — основной показатель прогресса» — это критерий готовности и ценность у покупателя; «частая поставка работающего продукта» — маленькие партии; «постоянный темп» — работа без переработок, которую держит лимит.',
        'In 2001 seventeen developers wrote down the [[method.agile|Agile Manifesto]], four values of agile software development:\n\n> Individuals and interactions over processes and tools.\n> Working software over comprehensive documentation.\n> Customer collaboration over contract negotiation.\n> Responding to change over following a plan.\n\nAnd an important note: “while there is value in the items on the right, we value the items on the left more.” Twelve principles come with the values. You have already met almost each of them in the mechanics of this block: “working software is the primary measure of progress” is the definition of done and value at the customer; “deliver working software frequently” is small batches; “a constant pace indefinitely” is work without overtime, which a limit protects.',
      ),
    },
    {
      id: 'scrum',
      kind: 'text',
      step: 'explain',
      title: bi('Scrum', 'Scrum'),
      body: bi(
        '[[method.scrum|Scrum]] по Scrum Guide 2020 — «легковесный фреймворк, который помогает людям, командам и организациям создавать ценность через адаптивные решения сложных проблем». Его части:\n\n- **Scrum-команда** — обычно до 10 человек, без подкоманд и иерархий. В ней три **ответственности** (Scrum Guide нарочно не называет их ролями): **владелец продукта** отвечает за максимальную ценность продукта; **Scrum-мастер** — за то, чтобы Scrum работал так, как описан в руководстве; **разработчики** — за создание пригодного к использованию инкремента в каждом спринте.\n- **События.** **Спринт** — отрезок фиксированной длины, не больше месяца; он вмещает все остальные события: **планирование спринта**, **ежедневный Scrum** (15 минут для разработчиков), **обзор спринта** и **ретроспективу**.\n- **Артефакты и обязательства.** У **бэклога продукта** — цель продукта, у **бэклога спринта** — цель спринта, у **инкремента** — критерии готовности (Definition of Done).\n\nСпринт — тоже ограничение незавершённой работы, только по времени: в спринт берут столько, сколько команда рассчитывает закончить.',
        '[[method.scrum|Scrum]], by the 2020 Scrum Guide, is “a lightweight framework that helps people, teams and organizations generate value through adaptive solutions for complex problems.” Its parts:\n\n- **The Scrum Team**, typically 10 or fewer people, with no sub-teams or hierarchies. It has three **accountabilities** (the Scrum Guide deliberately does not call them roles): the **Product Owner** is accountable for maximizing the value of the product; the **Scrum Master** for establishing Scrum as the Guide defines it; the **Developers** for creating a usable Increment each Sprint.\n- **Events.** The **Sprint** is a fixed-length event of one month or less; it contains all the other events: **Sprint Planning**, the **Daily Scrum** (15 minutes for the Developers), the **Sprint Review** and the **Sprint Retrospective**.\n- **Artifacts and commitments.** The **Product Backlog** has the Product Goal, the **Sprint Backlog** the Sprint Goal, the **Increment** the Definition of Done.\n\nA Sprint is also a limit on work in progress, only by time: a Sprint takes as much as the team expects to finish.',
      ),
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi(
        'Откройте Scrum Guide. В каком разделе сказано, какое обязательство у бэклога спринта? Нажмите на раздел.',
        'Open the Scrum Guide. Which section says what the commitment of the Sprint Backlog is? Click the section.',
      ),
      ref: { page: 'web/scrumguides.org/scrum-guide' },
      answer: 'ARTIFACTS',
    },
    {
      id: 'kanban',
      kind: 'text',
      step: 'explain',
      title: bi('Kanban-метод', 'The Kanban method'),
      body: bi(
        'Kanban Guide определяет [[method.kanban|Kanban-метод]] как «стратегию оптимизации потока ценности через процесс, использующий визуальную систему вытягивания». Практик три: определить и визуализировать поток; активно управлять элементами в потоке; улучшать поток. Обязательных метрик четыре, и все вы уже знаете: WIP, пропускная способность, возраст элемента и время цикла.\n\nПоток описывают явно — это **определение потока** (Definition of Workflow): что считается единицей работы, где она начинается и заканчивается, через какие состояния идёт, как ограничивается WIP, какие правила движения действуют, и **ожидание уровня обслуживания** (service level expectation, SLE) — прогноз вида «85% карточек проходят путь за 8 дней или быстрее», взятый из истории времени цикла. В тренажёре «Пробка» вы уже давали такое обещание; теперь у него есть имя.\n\nЗаметьте: в Kanban Guide нет «времени выполнения». Метод мерит время цикла между явно заданными точками начала и конца, а «время выполнения» в разных командах значит разное. В нашем курсе это время от появления в очереди до готовности — и это часть определения потока наших досок.',
        'The Kanban Guide defines the [[method.kanban|Kanban method]] as “a strategy for optimizing the flow of value through a process that uses a visual, pull-based system.” There are three practices: defining and visualizing a workflow; actively managing items in a workflow; improving the workflow. There are four mandatory measures, and you know them all: WIP, throughput, work item age and cycle time.\n\nThe flow is described explicitly in a **Definition of Workflow**: what counts as a unit of work, where it starts and finishes, which states it goes through, how WIP is controlled, which explicit policies apply, and a **service level expectation** (SLE), a forecast such as “85% of the cards get through in 8 days or less”, taken from the history of cycle times. In the “Traffic jam” trainer you already made such a promise; now it has a name.\n\nNote that the Kanban Guide has no “lead time”. The method measures cycle time between explicitly defined start and finish points, while “lead time” means different things in different teams. In our course it runs from entering the queue to done, and that is part of the Definition of Workflow of our boards.',
      ),
    },
    {
      id: 'both',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Не «или», а «и»', 'Not “or” but “and”'),
      body: bi(
        'Scrum задаёт ритм, ответственности и цели; Kanban — то, как работа течёт внутри этого ритма. Их совместимость авторы руководств описали отдельно, в Kanban Guide for Scrum Teams: Scrum-команда может ограничивать WIP внутри спринта, смотреть на время цикла и обещать сроки по SLE. Ответ на собеседовании: Scrum — фреймворк с событиями и ответственностями, Kanban — стратегия управления потоком; одно не исключает другое.',
        'Scrum sets the rhythm, the accountabilities and the goals; Kanban sets how work flows inside that rhythm. The authors of the guides described their compatibility separately, in the Kanban Guide for Scrum Teams: a Scrum Team may limit WIP inside a Sprint, watch cycle time and promise dates by an SLE. The interview answer: Scrum is a framework of events and accountabilities, Kanban is a strategy for managing flow; one does not exclude the other.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.scrum-commitments', 'method.q.scrum-master', 'method.q.scrum-wip', 'method.q.sle'] },
  ],
};

export const workTypes: Lesson = {
  id: 'methodology.work-types',
  block: 'methodology',
  title: bi('Что съедает время: типы работ и рутина', 'What eats the time: types of work and toil'),
  summary: bi('Четыре типа работ, незапланированная работа и рутина; единственный знающий; автоматизация как ответ.', 'Four types of work, unplanned work and toil; the single expert; automation as the answer.'),
  introduces: ['method.work-types', 'method.toil', 'method.automation', 'method.runbook'],
  uses: ['method.outage', 'method.dev-ops', 'method.bottleneck', 'method.board'],
  tier: 'core',
  minutes: 30,
  sources: { en: [S.sreToil, S.devopsHandbook], ru: [R.devops, R.itil] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Инженер эксплуатации магазина — один. Каждый день ему пишут: «выдай доступ», «сбрось пароль», «выгрузи отчёт». Это 70% его дня, и с ростом магазина заявок всё больше. На выкладки и сбои времени не остаётся, и владелец бизнеса предлагает нанять второго такого же инженера. Хорошее ли это решение?',
        'The shop has one operations engineer. Every day people write to them: “grant access”, “reset a password”, “export a report”. That is 70% of their day, and as the shop grows there are more requests. No time is left for deployments and outages, and the owner suggests hiring a second engineer just like them. Is that a good decision?',
      ),
    },
    {
      id: 'types',
      kind: 'text',
      step: 'explain',
      title: bi('Четыре типа работ', 'Four types of work'),
      body: bi(
        'В романе «Проект “Феникс”» Джин Ким, Кевин Бер и Джордж Спаффорд делят работу IT-команды на четыре типа:\n\n- **бизнес-проекты** — то, что нужно покупателям и бизнесу: новая страница скидок, способ оплаты;\n- **внутренние проекты** — то, что команда делает для себя: переезд на новый сервер, улучшение процесса;\n- **изменения** — плановая текущая работа: продлить договор хостинга, обновить библиотеку;\n- [[method.work-types|незапланированная работа]] — сбои и срочные просьбы, которых никто не ждал: сайт не открывается, «срочно выгрузить отчёт для налоговой».\n\nНезапланированная работа разрушительнее всего: её не видно в планах, она приходит без очереди и забирает время именно тех, кто нужен для остальных трёх типов.',
        'In the novel “The Phoenix Project” Gene Kim, Kevin Behr and George Spafford divide an IT team’s work into four types:\n\n- **business projects**: what customers and the business need, such as a new discount page or a payment method;\n- **internal projects**: what the team does for itself, such as moving to a new server or improving the process;\n- **changes**: planned routine work, such as renewing the hosting contract or upgrading a library;\n- [[method.work-types|unplanned work]]: outages and urgent requests nobody expected, such as “the site does not open” or “export a report for the tax office right now”.\n\nUnplanned work is the most destructive: it is invisible in plans, it jumps the queue, and it takes the time of exactly the people needed for the other three types.',
      ),
    },
    {
      id: 'toil',
      kind: 'text',
      step: 'explain',
      title: bi('Рутина', 'Toil'),
      body: bi(
        'Заявки из зацепки — [[method.toil|рутина]] (toil). В книге Google «Site Reliability Engineering» её признаки перечислены точно: работа ручная, повторяющаяся, её можно автоматизировать, она реактивная, не оставляет долговременной пользы и растёт вместе с сервисом — вдвое больше покупателей, вдвое больше заявок. В той же книге описано правило Google: на такую работу у инженеров эксплуатации должно уходить не больше половины времени, остальное — на инженерные улучшения.\n\nТеперь видно, почему второй инженер — слабое решение. Рутина растёт с сервисом, и через полгода заявок хватит на двоих. Сильное решение — [[method.automation|автоматизация]]: скрипт выдачи доступов, который пишется за несколько дней и навсегда забирает восемь заявок из десяти. Улучшение стоит времени сейчас и возвращает его каждый день потом.',
        'The requests in the hook are [[method.toil|toil]]. Google’s book “Site Reliability Engineering” lists its signs precisely: the work is manual, repetitive, automatable, reactive, leaves no enduring value, and grows with the service — twice the customers, twice the requests. The same book describes Google’s rule: operations engineers should spend no more than half of their time on such work, the rest on engineering improvements.\n\nNow you can see why a second engineer is a weak decision. Toil grows with the service, and in half a year there will be enough requests for two. The strong decision is [[method.automation|automation]]: an access script, written in a few days, that takes eight requests out of ten off the queue for good. An improvement costs time now and gives it back every day after.',
      ),
    },
    {
      id: 'hero',
      kind: 'text',
      step: 'explain',
      title: bi('Один человек на всё', 'One person for everything'),
      body: bi(
        'Есть и вторая ловушка. Если только один человек знает, как устроен прод, через него идут все сбои, все выкладки и вся рутина. Он — узкое место команды, и, когда он в отпуске, простой сбой длится сутки. Ответ — передать знание: записать [[method.runbook|инструкцию для дежурного]] (runbook) — порядок действий при типовом сбое, — и работать в паре, чтобы второй человек сделал то же самое руками хотя бы раз. Знание, которое хранится только в одной голове, — такой же риск, как единственный сервер.',
        'There is a second trap. If only one person knows how production works, every outage, every deployment and all the toil go through them. They are the team’s bottleneck, and when they are on leave a simple outage lasts a day. The answer is to pass the knowledge on: write a [[method.runbook|runbook]], the procedure for a typical outage, and work in pairs so that a second person does the same by hand at least once. Knowledge that lives in one person’s memory is as much of a risk as a single server.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.work-sort', 'method.q.toil-signs', 'method.q.hire-vs-automate'] },
  ],
};

export const pipeline: Lesson = {
  id: 'methodology.pipeline',
  block: 'methodology',
  title: bi('Конвейер: непрерывная интеграция, доставка и развёртывание', 'The pipeline: continuous integration, delivery and deployment'),
  summary: bi('Точные определения CI, непрерывной доставки и непрерывного развёртывания; конвейер развёртывания и откат.', 'Precise definitions of CI, continuous delivery and continuous deployment; the deployment pipeline and rollback.'),
  introduces: ['method.ci', 'method.cdelivery', 'method.cdeployment', 'method.pipeline', 'method.rollback'],
  uses: ['method.value-stream', 'method.flow-efficiency', 'method.batch', 'method.automation', 'method.outage'],
  tier: 'core',
  minutes: 40,
  sources: { en: [S.fowlerCI, S.fowlerCD, S.cdCom, S.devopsHandbook], ru: [R.ci, R.cd, R.devops] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Три команды говорят: «У нас CI/CD». В первой автоматическая сборка запускается раз в неделю на отдельной ветке перед релизом. Во второй каждое изменение собирается и проверяется, а на прод раз в неделю выкладывает дежурный кнопкой. В третьей всё, что прошло проверки, уходит на прод само в течение часа. У кого из них что на самом деле? К концу урока вы ответите точно — так, как ответили бы на собеседовании.',
        'Three teams say, “We have CI/CD.” In the first, an automated build runs once a week on a separate branch before a release. In the second, every change is built and tested, and once a week the on-call engineer deploys to production with a button. In the third, everything that passed the checks goes to production by itself within an hour. What does each of them really have? By the end of the lesson you will answer precisely, as you would at an interview.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'method.x.pipeline', caption: bi('Переключите сборку на автоматическую, затем последний шаг на «сам». Подвигайте размер партии и долю проверок машиной; уберите откат.', 'Switch the build to automatic, then the last step to “by itself”. Move the batch size and the share of machine checks; remove the rollback.') },
    {
      id: 'ci',
      kind: 'text',
      step: 'explain',
      title: bi('Непрерывная интеграция', 'Continuous integration'),
      body: bi(
        'Мартин Фаулер определяет [[method.ci|непрерывную интеграцию]] (continuous integration, CI) как практику, при которой каждый член команды часто — хотя бы раз в день — сливает свои изменения в общую основную ветку, а каждое слияние автоматически собирается и проверяется автотестами. Две вещи в этом определении обязательны. Первая — частота и общая ветка: если ветка существует три недели, это не CI, сколько бы тестов ни запускалось на каждое её обновление. Вторая — дисциплина: если проверка покраснела, починить её — первое дело команды, и никто не сливает новое поверх красного.\n\nCI заканчивается там, где изменение слито, собрано и проверено машиной. До прода CI не доходит. Поэтому первая команда из зацепки CI не делает: сборка раз в неделю на отдельной ветке — это автоматизация сборки, а не интеграция.',
        'Martin Fowler defines [[method.ci|continuous integration]] (CI) as a practice where each member of a team merges their changes into a shared mainline often, at least daily, and each merge is built and verified by automated tests. Two things in this definition are essential. The first is frequency and the shared branch: if a branch lives for three weeks, it is not CI, however many tests run on each update to it. The second is discipline: if the build goes red, fixing it is the team’s first job, and nobody merges new work on top of red.\n\nCI ends where the change is merged, built and checked by a machine. CI does not reach production. That is why the first team in the hook does not do CI: a weekly build on a separate branch is build automation, not integration.',
      ),
    },
    {
      id: 'cd',
      kind: 'text',
      step: 'explain',
      title: bi('Доставка и развёртывание', 'Delivery and deployment'),
      body: bi(
        'Дальше начинаются две практики, которые часто путают, потому что обе сокращают до CD.\n\n[[method.cdelivery|Непрерывная доставка]] (continuous delivery): каждое изменение, прошедшее проверки, в любой момент готово к выкладке на прод, и выкладка — одно действие человека. Выпустить ли сейчас — решение бизнеса, а не инженерный подвиг. Вторая команда из зацепки делает именно это, если её кнопка действительно выкладывает любое проверенное изменение без ручной подготовки.\n\n[[method.cdeployment|Непрерывное развёртывание]] (continuous deployment): каждое изменение, прошедшее проверки, уходит на прод само, без ручного решения. Это третья команда. Разница между ними — одна стрелка на схеме: последний шаг «кнопка» или «сам».\n\nУ непрерывного развёртывания нет общепринятого собственного сокращения: CD обычно означает доставку. На собеседовании называйте практики полностью — это сразу показывает, что вы различаете их.',
        'Two practices start from here, and they are often confused because both are shortened to CD.\n\n[[method.cdelivery|Continuous delivery]]: every change that passed the checks is ready to be deployed to production at any moment, and the deployment is one action by a person. Whether to release now is a business decision, not an engineering feat. The second team in the hook does exactly this, provided its button really deploys any checked change without manual preparation.\n\n[[method.cdeployment|Continuous deployment]]: every change that passed the checks goes to production by itself, without a manual decision. That is the third team. The difference between the two is one arrow on the diagram: the last step is “a button” or “by itself”.\n\nContinuous deployment has no generally accepted abbreviation of its own: CD usually means delivery. At an interview, name the practices in full; it shows at once that you tell them apart.',
      ),
    },
    {
      id: 'pipeline',
      kind: 'text',
      step: 'explain',
      title: bi('Конвейер и откат', 'The pipeline and rollback'),
      body: bi(
        '[[method.pipeline|Конвейер развёртывания]] (deployment pipeline) — автоматическая цепочка, которая ведёт изменение от слияния до прода: сборка, автотесты, выкладка на **стенд** (копию прода для проверки), проверки на стенде, выкладка на прод. Каждая ступень конвейера убирает одно ожидание из потока ценности: «ждём сборку», «ждём тестировщика», «ждём окна выкладки». Эффективность потока растёт не потому, что люди работают быстрее, а потому, что задача меньше ждёт.\n\nВторая половина конвейера — путь назад. [[method.rollback|Откат]] возвращает прод к предыдущей работающей версии за минуты, и чинить причину можно потом, спокойно. Без отката команда чинит вперёд: пишет **хотфикс** (срочное исправление) и выкладывает его ещё раз — дольше, с новым риском, и это вторая, внеплановая выкладка. Маленькие партии и откат вместе и делают частые выкладки безопасными.',
        'A [[method.pipeline|deployment pipeline]] is the automated chain that takes a change from the merge to production: build, automated tests, deployment to **staging** (a copy of production for checking), checks on staging, deployment to production. Each stage of the pipeline removes one wait from the value stream: “waiting for a build”, “waiting for the tester”, “waiting for the deployment window”. Flow efficiency grows not because people work faster but because the task waits less.\n\nThe second half of the pipeline is the way back. A [[method.rollback|rollback]] returns production to the previous working version in minutes, and the cause can be fixed later, calmly. Without a rollback the team fixes forward: it writes a **hotfix** (an urgent fix) and deploys again, which takes longer, carries a new risk, and is a second, unplanned deployment. Small batches and rollback together are what make frequent deployments safe.',
      ),
    },
    {
      id: 'later',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      body: bi(
        'Здесь конвейер — схема организации работы. Руками вы соберёте его позже, в блоке CI/CD: там та же кнопка «Выпустить» превратится в одну строку описания конвейера, а «сам» — в её отсутствие.',
        'Here the pipeline is a picture of how work is organised. You will build one by hand later, in the CI/CD block: there the same “Release” button becomes one line of the pipeline description, and “by itself” becomes its absence.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.ci-cd-match', 'method.q.release-branch', 'method.q.red-build', 'method.q.pipeline-order'] },
  ],
};
