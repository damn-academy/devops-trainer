// Lessons 6–10: the bottleneck and the five focusing steps, batch size and
// cost of delay, Agile/Scrum/Kanban, types of work and toil, the deployment
// pipeline (07 §4: MT3–MT7).

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { R, S } from './sources';

const P10 = { ext: { flow: { scenario: 'p10' } } };
const CHECK = bi('Проверьте себя', 'Check yourself');

export const bottleneck: Lesson = {
  id: 'methodology.bottleneck',
  block: 'methodology',
  title: bi('Узкое место', 'The bottleneck'),
  summary: bi('Почему поток работы движется со скоростью самого медленного этапа, в каком порядке с таким этапом работают по Голдратту и зачем свободным людям помогать тому, кто не успевает.', 'Why the flow moves at the speed of its slowest stage, the five focusing steps and swarming.'),
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
        'Магазину нужно больше функций. Владелец нанял третьего разработчика, и разработка теперь пишет в полтора раза больше кода. Через месяц до покупателей доходит столько же задач, сколько и раньше, только ждать каждую из них стали дольше. Деньги потрачены, но куда делась скорость?',
        'The shop needs more features. The owner hired a third developer, and development now writes one and a half times more code. A month later as many tasks reach the customers as before, only each of them takes longer. The money is spent; where did the speed go?',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Где застревает поток работы', 'Where the flow of work gets stuck'),
      body: bi(
        'Схема ниже показывает десять рабочих дней такой команды, в которой работают два разработчика, ревьюер и тестировщик. Сначала на ней только утренняя очередь новых задач слева и покупатели справа внизу. Потом появляются этапы: разработка, ревью и проверка, а ниже, между ними, очереди, в которых задачи ждут следующего этапа. Каждый этап говорит в облачке, сколько задач в день он может закончить. Этап, который успевает меньше всех и потому задерживает всю команду, называют [[method.bottleneck|узким местом]].',
        'The diagram below shows ten working days of such a team: two developers, a reviewer and a tester. At first it shows only the morning queue of new tasks on the left and the customers at the bottom right. Then the stages appear: development, review and testing, and below them, in between, the queues where tasks wait for the next stage. Each stage says in a callout how many tasks a day it can finish. The stage that manages the fewest and so holds up the whole team is called the [[method.bottleneck|bottleneck]].',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'method.x.bottleneck', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Когда этапы появятся, начнутся десять рабочих дней. В каждый день подсвечен этап, перед которым скопилась самая длинная очередь, облачко говорит, что этот этап сделал за день, а по стрелке к покупателям движется карточка с числом задач, которые до них дошли. Полоска внутри очереди показывает, сколько задач в ней ждёт, а жёлтая рамка означает, что их больше шести. Под схемой видно, сколько задач уже дошло до покупателей, сколько задач сейчас в работе и сколько дней провели в работе задачи, которые дошли до покупателей за последние три дня.\n\nПосле первого прохода сделайте то же, что сделал владелец магазина: увеличьте в «Параметрах» мощность разработки и проверьте, изменится ли число готовых задач. Потом верните её обратно и по одному включайте переключатели в группе «Шаги Голдратта для узкого места»: тестировщика перестают отвлекать, новые задачи перестают брать сверх лимита, свободные разработчики помогают проверке. Напоследок включите в блоке «Сломать» отпуск тестировщика.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. Once the stages are in place, ten working days begin. On each day the stage with the longest queue in front of it is highlighted, the callout says what that stage did in the day, and a card with the number of tasks that reached the customers moves along the arrow to them. The bar inside a queue shows how many tasks wait in it, and a yellow outline means there are more than six. Under the diagram you see how many tasks have reached the customers, how many are in progress now, and how many days the tasks that reached the customers in the last three days spent in progress.\n\nAfter the first pass do what the shop owner did: increase the capacity of development in “Parameters” and check whether the number of finished tasks changes. Then set it back and switch on the toggles in the group “Goldratt’s steps for the bottleneck” one at a time: the tester is no longer distracted, no new tasks are started beyond the limit, free developers help with testing. Finally switch on the tester’s leave in “Break it”.'),
      caption: bi(
        'Схема показала то, что случилось с третьим разработчиком: пока проверка успевает две задачи в день, больше двух задач в день до покупателей не дойдёт, как бы быстро ни писали код. В разделах ниже это наблюдение получит точное объяснение и порядок действий, а в практике в конце урока вы сами найдёте такой этап на доске в терминале и переставите к нему людей.',
        'The diagram showed what happened with the third developer: while testing manages two tasks a day, no more than two tasks a day will reach the customers, however fast the code is written. The sections below explain this precisely and give an order of actions, and in the practice at the end of the lesson you will find such a stage on a board in the terminal yourself and move people to it.',
      ),
    },
    {
      id: 'constraint',
      kind: 'text',
      step: 'explain',
      title: bi('Почему поток идёт со скоростью самого медленного этапа', 'The bottleneck'),
      body: bi(
        'Этапы потока зависят друг от друга: проверка не может проверить больше, чем к ней пришло, а покупатели не получат больше, чем успела проверка. Поэтому вся система выдаёт не больше, чем успевает её самый медленный этап. Этот этап и называют [[method.bottleneck|узким местом]], а в теории ограничений Элияху Голдратта его называют ограничением.\n\nВторое следствие не так очевидно. Колебания на узком месте не отыгрываются: если у тестировщика был плохой день или ему досталась неожиданно большая задача и он простоял час, этот час потерян для всей системы навсегда. Если же простояла разработка перед узким местом, ничего не потеряно, потому что проверка всё равно не успела бы больше. Ускорять этапы до узкого места бесполезно: работа лишь быстрее упрётся в очередь перед ним. Так и случилось с третьим разработчиком.\n\nНайти узкое место помогает накопительная диаграмма потока: полоса перед ним расширяется, а полосы после него остаются тонкими, потому что там ждут работы.',
        'The stages of a flow depend on each other: testing cannot test more than reached it, and customers cannot get more than testing passed. So the output of the whole system is no more than the capacity of its slowest stage. That stage is called the [[method.bottleneck|bottleneck]] (in Eliyahu Goldratt’s Theory of Constraints, the constraint).\n\nThe second consequence is less obvious. Fluctuations at the bottleneck are never made up: if the tester had a bad day or an unexpectedly big task and stood idle for an hour, that hour is lost for the whole system for good. If development before the bottleneck stood idle, nothing is lost: testing could not have done more anyway. Speeding up the stages before the bottleneck is useless: work just reaches the queue in front of it sooner. That is exactly what happened with the third developer.\n\nThe cumulative flow diagram helps to find the bottleneck: the band in front of it widens, and the bands after it are thin, because they are waiting for work.',
      ),
    },
    {
      id: 'steps',
      kind: 'text',
      step: 'explain',
      title: bi('Пять шагов фокусирования', 'Five steps'),
      body: bi(
        'Элияху Голдратт в книге «Цель» предложил порядок работы с ограничением, который называют [[method.five-steps|пятью шагами фокусирования]]:\n\n1. **Найти** узкое место, то есть посмотреть, где растёт очередь и где после неё люди простаивают.\n2. **Использовать** его полностью. Это значит, что тестировщика не отвлекают на совещания и чужие задачи, и у него всегда есть следующая карточка, уже прошедшая ревью.\n3. **Подчинить** ему всё остальное, то есть не начинать новое быстрее, чем узкое место успевает его принять (это и делает лимит WIP), а свободным людям помогать узкому месту.\n4. **Расширить** узкое место. Только на этом шаге нанимают второго тестировщика, пишут автоматические проверки, готовят чек-лист с тестовыми данными.\n5. **Повторить** всё сначала, потому что после расширения узким местом становится другой этап.\n\nПорядок шагов важен. Нанять людей, то есть сделать четвёртый шаг, дорого и долго, а второй и третий шаги почти бесплатны и часто дают больше. Опасно пытаться загрузить всех на сто процентов, потому что занятые разработчики, которые начинают всё новые задачи, только удлиняют очередь перед проверкой и время цикла.',
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
        'Когда разработчики свободны, а проверка не успевает, лучший ход состоит не в том, чтобы начать новую функцию, а в том, чтобы помочь проверке. Такой приём называют [[method.swarming|роением]], потому что люди собираются вокруг застрявшей работы. Разработчик проверяет медленнее тестировщика (в тренажёрах этого блока вдвое медленнее), но каждая проверенная им карточка уходит к покупателям, а новая функция ушла бы в очередь.',
        'When developers are free and testing cannot keep up, the best move is not a new feature but help for testing. This is called [[method.swarming|swarming]]: people gather around the stuck work. A developer tests slower than a tester — half as fast in this block’s trainers — but every card they test goes to the customers, while a new feature would go into the queue.',
      ),
    },
    {
      id: 'find',
      kind: 'docs',
      step: 'practice',
      levels: ['beginner', 'intermediate'],
      mode: 'find',
      prompt: bi(
        'Перед вами доска на 10 дней, и один этап на ней медленнее остальных. В первый день очередей на доске ещё нет, поэтому сначала прогоните три дня командой `flow next 3` и посмотрите на доску командой `flow status`: медленный этап тот, перед которым копятся карточки. Потом начните заново командой `flow reset`. Как переставить человека в другую колонку, найдите в странице `man flow`. Лимиты незавершённой работы из прошлых уроков тоже понадобятся, потому что без них автопилот затягивает в работу все карточки сразу. Задача выполнена, когда за 10 дней закончено не меньше задач, чем требует проходная линия, а её показывает команда `flow goal`. Доска учебная, и сломать её нельзя: команда `flow reset` в любой момент вернёт её к первому дню.',
        'A 10-day board with one stage slower than the others. On day 1 there are no queues yet, so first run three days with `flow next 3` and look at the board with `flow status`: the slow stage is the one cards pile up in front of. Then start again with `flow reset`. Find in `man flow` how to move a person to another column. The WIP limits from the previous lessons are needed too, because without them the autopilot pulls every card into progress at once. The task is done when in 10 days at least as many tasks are finished as the pass line, which `flow goal` shows. This is a training board and cannot be broken: `flow reset` takes it back to day 1 at any moment.',
      ),
      ref: { page: 'man/flow.1', anchor: 'OPTIONS', line: 'station ROLE COLUMN' },
      terminal: {
        setup: P10,
        task: {
          id: 'swarm',
          prompt: bi('Закончите за 10 дней не меньше задач, чем требует проходная линия.', 'In 10 days finish at least as many tasks as the pass line.'),
          check: { when: 'flow.daysDone>=10 && flow.pass.done=1', fail: [{ if: 'flow.daysDone>=10', say: bi('Десять дней прошли, а готовых задач меньше, чем требует проходная линия. Посмотрите командой `flow status`, перед какой колонкой выросла очередь и есть ли у колонок лимиты, а потом начните заново командой `flow reset`.', 'Ten days passed with fewer tasks than the pass line. Use `flow status` to see in front of which column the queue grew and whether the columns have limits, then start again with `flow reset`.') }] },
          docStep: 3,
          chips: 'flow station DEV-2 test',
          concepts: ['method.bottleneck', 'method.swarming'],
          hints: {
            H1: bi('Посмотрите, перед какой колонкой копятся карточки в части «готово».', 'See in front of which column the “done” cards pile up.'),
            H2: bi('Как переставить человека, сказано в разделе OPTIONS, в описании команды station. Лимит колонке ставит команда `flow wip`, как в уроке о незавершённой работе.', 'How to move a person is in OPTIONS, under station. A column limit is set with `flow wip`, as in the lesson on work in progress.'),
            H3: bi('Начните сначала командой `flow reset`. Поставьте лимиты командами `flow wip analysis 2`, `flow wip dev 3` и `flow wip test 2`, переставьте одного разработчика к проверке командой `flow station DEV-2 test` и прогоните десять дней командой `flow next 10`.', 'Start again (`flow reset`). Set the limits with `flow wip analysis 2`, `flow wip dev 3` and `flow wip test 2`, move one developer to testing with `flow station DEV-2 test`, and run ten days with `flow next 10`.'),
          },
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
        'Перед вами доска на 10 дней, и один этап на ней медленнее остальных. Подсказок в этом задании нет. Как переставить человека в другую колонку, найдите в странице `man flow`. Одной перестановки мало: автопилот без лимитов незавершённой работы затягивает в работу все карточки сразу, поэтому лимиты колонкам тоже понадобятся. Задача выполнена, когда за 10 дней закончено не меньше задач, чем требует проходная линия, а её показывает команда `flow goal`.',
        'A 10-day board with one stage slower than the others. This task has no hints. Find in `man flow` how to move a person to another column. One move is not enough: without WIP limits the autopilot pulls every card into progress at once, so the columns need limits too. The task is done when in 10 days at least as many tasks are finished as the pass line, which `flow goal` shows.',
      ),
      ref: { page: 'man/flow.1' },
      terminal: {
        setup: P10,
        task: {
          id: 'swarm-forcing',
          prompt: bi('Закончите за 10 дней не меньше задач, чем требует проходная линия.', 'Finish at least as many tasks in 10 days as the pass line.'),
          check: { when: 'flow.daysDone>=10 && flow.pass.done=1', fail: [{ if: 'flow.daysDone>=10', say: bi('Десять дней прошли, а готовых задач меньше, чем требует проходная линия. Проверьте командой `flow status`, есть ли у колонок лимиты, и начните заново командой `flow reset`.', 'Ten days passed with fewer tasks than the pass line. Check with `flow status` whether the columns have limits, and start again with `flow reset`.') }] },
          docStep: 4,
          beyond: true,
          solutionTokens: ['flow station', 'station DEV-1 test', 'station DEV-2 test'],
          concepts: ['method.bottleneck', 'method.swarming'],
        },
      },
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.five-steps', 'method.q.faster-dev', 'method.q.tester-dilemma'] },
  ],
};

export const batch: Lesson = {
  id: 'methodology.batch',
  block: 'methodology',
  title: bi('Партии и стоимость задержки', 'Batches and cost of delay'),
  summary: bi('Почему маленькие партии приносят ценность раньше и реже ломают сайт и как выбирать, что делать первым, по стоимости задержки.', 'Why small batches deliver value sooner and break less often; how to choose the order of work by cost of delay.'),
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
        'Есть известная тренинговая игра. Четыре человека сидят в ряд, перед первым лежат двадцать монет. Каждый переворачивает монеты и передаёт их дальше. В первом раунде монеты передают только все двадцать сразу, во втором по пять, в третьем по одной. Во сколько раз раньше покупатель получит первую монету в третьем раунде, чем в первом?',
        'A well-known training game: twenty coins, four people in a row. Each flips the coins and passes them on. In the first round coins are passed on only all twenty at once, in the second five at a time, in the third one at a time. How many times sooner does the customer get the first coin in the third round than in the first?',
      ),
    },
    {
      id: 'batch',
      kind: 'text',
      step: 'explain',
      title: bi('Размер партии', 'Batch size'),
      body: bi(
        'Пусть один переворот монеты занимает время t. Если монеты передают по двадцать, первая монета доходит до покупателя через 80t, вместе с последней. Если по пять, первая доходит через 20t, а последняя через 35t. Если по одной, первая доходит уже через 4t, а последняя через 23t. Время до первой ценности сократилось в 20 раз, а всё время игры в три с половиной раза, хотя люди работали с той же скоростью.\n\n[[method.batch|Размером партии]] называют число изменений, которые уходят дальше за один раз. Для изменений сайта у маленькой партии есть ещё два выигрыша. Первый выигрыш касается риска. Каждое изменение может сломать рабочий сайт, а в большой партии изменения к тому же влияют друг на друга. В модели наших тренажёров выкладка одного изменения ломает сайт в 7 % случаев, а выкладка десяти изменений в 54 % случаев. Второй выигрыш касается поиска причины. Если сайт сломался после выкладки одного изменения, виновато это изменение, а после выкладки десяти сначала нужно понять, какое из десяти. Кроме того, быстрее приходит обратная связь: о проблеме в изменении узнают, пока его автор ещё помнит, что делал.',
        'Let one flip take time t. With a batch of 20 the first coin reaches the customer after 80t, together with the last one. With a batch of 5 the first arrives after 20t and the last after 35t. With a batch of 1 the first comes after 4t and the last after 23t: the time to the first value is twenty times shorter, and the total three and a half times shorter, although people worked at the same speed.\n\n[[method.batch|Batch size]] is how many changes move on at once. For changes to a site a small batch has two more benefits. Risk: each change carries its own chance of breaking production, and in a big batch the changes also interact. In the model of our trainers a deployment of one change breaks the site 7% of the time, and a deployment of ten 54% of the time. Finding the cause: if the outage follows a deployment of one change, that change is to blame; after a deployment of ten, you first have to work out which of the ten. Feedback also comes sooner: a problem in a change is found while its author still remembers what they did.',
      ),
    },
    {
      id: 'cod',
      kind: 'text',
      step: 'explain',
      title: bi('Стоимость задержки', 'Cost of delay'),
      body: bi(
        'Когда работы больше, чем людей, вопрос о том, что делать первым, превращается в вопрос о деньгах. [[method.cod|Стоимостью задержки]] называют сумму, которую магазин недополучает за каждый день, пока изменение не дошло до покупателей. Оплата картой может приносить магазину 4 000 рублей в день, а тёмная тема оформления сайта почти ничего.\n\nДон Рейнертсен и Джошуа Арнольд предлагают сравнивать задачи по CD3 (от английского cost of delay divided by duration), то есть по стоимости задержки, делённой на длительность работы. Функция A стоит 10 000 рублей в неделю и требует двух недель работы, поэтому её CD3 равен 5 000. Функция B стоит 6 000 рублей в неделю и требует одной недели, и её CD3 равен 6 000. Значит, первой делают B. Пока делают B, магазин недополучает от функции A 10 000 рублей, а если бы первой делали A, он недополучил бы от функции B за две недели 12 000.\n\nНекоторым карточкам нужны особые правила, которые называют **классами обслуживания**. Сломанная оплата не ждёт своей очереди, и для таких случаев держат **срочную дорожку** с лимитом в одну карточку. Задача с жёстким сроком, например отчёт для налоговой к пятнице, продвигается в очереди тем выше, чем ближе этот срок.',
        'When there is more work than capacity, the question “what first” is a question of money. [[method.cod|Cost of delay]] is how much the shop loses for each day a change is not with the customers: “card payments” might bring 4,000 ₽ a day, a “dark theme for the site” almost nothing.\n\nDon Reinertsen and Joshua Arnold suggest comparing tasks by CD3 (cost of delay divided by duration). Feature A is worth 10,000 ₽ a week and takes two weeks: CD3 = 5,000. Feature B is worth 6,000 ₽ a week and takes one week: CD3 = 6,000. B goes first: while B is being built, A loses 10,000; had A gone first, B would have lost 12,000 over the two weeks.\n\nSome cards need special rules: **classes of service**. A broken checkout does not wait in line: an **expedite lane** with a limit of one card is kept for it. A task with a fixed date (a report for the tax office by Friday) rises in the queue the closer the date gets.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.cd3', 'method.q.batch-why', 'method.q.batch-first'] },
  ],
};

export const agile: Lesson = {
  id: 'methodology.agile',
  block: 'methodology',
  title: bi('Agile, Scrum и Kanban', 'Agile, Scrum and Kanban'),
  summary: bi('Что записано в Agile-манифесте, как устроен Scrum по Scrum Guide и Kanban-метод по Kanban Guide и почему одно не исключает другого.', 'The Agile Manifesto, how Scrum works by the Scrum Guide, the Kanban method by the Kanban Guide, and why they are compatible.'),
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
        'Фразу «у нас Agile» говорят и команды, которые выпускают маленькие изменения каждый день, и команды, которые раз в квартал выкладывают огромный выпуск, зато каждый день созваниваются. На собеседовании вас спросят, чем Scrum отличается от Kanban. Ответ «в Scrum есть спринты» верен, но главного он не называет.',
        '“We are Agile,” say teams that ship small changes every day, and teams that roll out a huge release once a quarter but hold daily calls. At an interview you will be asked how Scrum differs from Kanban. “Scrum has sprints” is true, but not the main point.',
      ),
    },
    {
      id: 'manifesto',
      kind: 'text',
      step: 'explain',
      title: bi('Agile-манифест', 'The manifesto'),
      body: bi(
        'В 2001 году семнадцать разработчиков записали [[method.agile|Agile-манифест]], то есть четыре ценности гибкой разработки:\n\n> Люди и взаимодействие важнее процессов и инструментов.\n> Работающий продукт важнее исчерпывающей документации.\n> Сотрудничество с заказчиком важнее согласования условий контракта.\n> Готовность к изменениям важнее следования первоначальному плану.\n\nК этим строкам авторы сделали важную оговорку: «не отрицая важности того, что справа, мы всё-таки больше ценим то, что слева». К ценностям прилагаются двенадцать принципов, и почти каждый из них вы уже видели в механике этого блока. Принцип «работающий продукт — основной показатель прогресса» соответствует критерию готовности и ценности, которая дошла до покупателя. Принцип «частая поставка работающего продукта» соответствует маленьким партиям. Принцип «постоянный темп» означает работу без переработок, и этот темп держит лимит незавершённой работы.',
        'In 2001 seventeen developers wrote down the [[method.agile|Agile Manifesto]], four values of agile software development:\n\n> Individuals and interactions over processes and tools.\n> Working software over comprehensive documentation.\n> Customer collaboration over contract negotiation.\n> Responding to change over following a plan.\n\nAnd an important note: “while there is value in the items on the right, we value the items on the left more.” Twelve principles come with the values. You have already met almost each of them in the mechanics of this block: “working software is the primary measure of progress” is the definition of done and value at the customer; “deliver working software frequently” is small batches; “a constant pace indefinitely” is work without overtime, which a limit protects.',
      ),
    },
    {
      id: 'scrum-beginner',
      kind: 'text',
      step: 'explain',
      levels: ['beginner'],
      title: bi('Как устроен Scrum', 'Scrum'),
      body: bi(
        'Scrum Guide 2020 года, официальное руководство авторов метода, называет [[method.scrum|Scrum]] «лёгким фреймворком», то есть небольшим набором правил. Эти правила помогают команде создавать ценность, когда задача сложная и всё продумать заранее нельзя. Касаются они трёх вещей: кто в команде за что отвечает, какие встречи команда проводит и с какими рабочими списками работает.\n\nРабота в Scrum идёт **спринтами**. Спринтом называют отрезок времени постоянной длины, не больше месяца, а чаще всего две недели. В начале спринта команда решает, что успеет сделать, а к концу показывает готовый результат.\n\nВ Scrum-команде обычно до десяти человек, и начальников внутри неё нет. Scrum Guide описывает три **ответственности** и нарочно не называет их ролями, потому что важна не должность, а то, за что человек отвечает. **Владелец продукта** решает, какая работа принесёт продукту больше ценности, и выстраивает задачи по порядку. **Scrum-мастер** следит, чтобы команда работала по правилам Scrum, и помогает ей убирать помехи. **Разработчики** к концу каждого спринта делают работающую часть продукта.\n\nВнутри спринта проходят четыре **события**, то есть обязательные встречи. На **планировании спринта** команда выбирает работу на спринт. **Ежедневным Scrum** называют пятнадцатиминутную встречу разработчиков, на которой они сверяют, как идут дела. На **обзоре спринта** команда показывает сделанное владельцу продукта и заказчикам. На **ретроспективе** команда разбирает, как она работала, и решает, что изменить в следующем спринте.\n\nРабочие списки и результат работы Scrum Guide называет **артефактами**, и их три. **Бэклогом продукта** называют общий список задач продукта, выстроенный по важности. **Бэклог спринта** составляют задачи, которые команда взяла на текущий спринт. **Инкрементом** называют работающую часть продукта, готовую к концу спринта. У каждого артефакта есть ориентир, который руководство называет обязательством. У бэклога продукта это цель продукта, у бэклога спринта цель спринта, а у инкремента **определение готовности** (Definition of Done), то есть общий для команды список требований, без которых работа не считается сделанной, например «код прошёл ревью и автотесты». Не путайте его с критерием готовности на карточке из урока о доске: критерий говорит, когда закончена одна задача, а определение готовности действует для всей работы команды.\n\nСпринт тоже ограничивает незавершённую работу, только не числом карточек, а временем: в спринт берут столько, сколько команда рассчитывает закончить.',
        'The 2020 Scrum Guide, the official guide by the authors of the method, calls [[method.scrum|Scrum]] a “lightweight framework”, that is, a small set of rules. The rules help a team create value when the problem is complex and cannot all be thought through in advance. They cover three things: who in the team is accountable for what, which meetings the team holds and which working lists it works with.\n\nWork in Scrum goes in **Sprints**. A Sprint is a period of fixed length, one month or less, most often two weeks. At the start of a Sprint the team decides what it will get done, and by the end it shows a finished result.\n\nA Scrum Team usually has up to ten people and no bosses inside it. The Scrum Guide describes three **accountabilities** and deliberately does not call them roles, because what matters is not the job title but what a person is accountable for. The **Product Owner** decides which work brings the product more value and puts the tasks in order. The **Scrum Master** makes sure the team works by the rules of Scrum and helps it remove obstacles. The **Developers** make a working piece of the product by the end of every Sprint.\n\nFour **events**, that is, mandatory meetings, happen inside a Sprint. At **Sprint Planning** the team chooses the work for the Sprint. The **Daily Scrum** is a fifteen-minute meeting of the Developers where they check how things are going. At the **Sprint Review** the team shows what it made to the Product Owner and the stakeholders. At the **Sprint Retrospective** the team looks at how it worked and decides what to change in the next Sprint.\n\nThe Scrum Guide calls the working lists and the result of the work **artifacts**, and there are three of them. The **Product Backlog** is the common list of the product’s tasks, ordered by importance. The **Sprint Backlog** is the tasks the team took for the current Sprint. The **Increment** is a working piece of the product, ready by the end of the Sprint. Each artifact has a point of reference the guide calls a commitment. For the Product Backlog it is the Product Goal, for the Sprint Backlog the Sprint Goal, and for the Increment the **Definition of Done**, a list of requirements common to the team without which work does not count as done, such as “the code passed review and the automated tests”. Do not confuse it with the definition of done on a card from the lesson on the board: that one says when a single task is finished, while the Definition of Done applies to all of the team’s work.\n\nA Sprint is also a limit on work in progress, only by time rather than by the number of cards: a Sprint takes as much as the team expects to finish.',
      ),
    },
    {
      id: 'scrum',
      kind: 'text',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Как устроен Scrum', 'Scrum'),
      body: bi(
        'Scrum Guide 2020 года определяет [[method.scrum|Scrum]] как «лёгкий фреймворк, который помогает людям, командам и организациям создавать ценность через адаптивные решения сложных проблем». Scrum состоит из команды, событий и артефактов:\n\n- **Scrum-команда** обычно насчитывает до 10 человек, и в ней нет ни подкоманд, ни иерархии. В команде три **ответственности** (Scrum Guide нарочно не называет их ролями). **Владелец продукта** отвечает за то, чтобы продукт приносил как можно больше ценности. **Scrum-мастер** отвечает за то, чтобы Scrum работал так, как описано в руководстве. **Разработчики** отвечают за то, чтобы в каждом спринте получался пригодный к использованию инкремент.\n- **События** Scrum проходят внутри **спринта**. Спринт длится фиксированное время, не больше месяца, и вмещает все остальные события: **планирование спринта**, **ежедневный Scrum** (пятнадцатиминутную встречу разработчиков), **обзор спринта** и **ретроспективу**.\n- **Артефактов** три, и у каждого есть своё обязательство. У **бэклога продукта** обязательством служит цель продукта, у **бэклога спринта** цель спринта, у **инкремента** определение готовности (Definition of Done). Определение готовности действует для всей работы команды, и этим оно отличается от критерия готовности на одной карточке.\n\nСпринт тоже ограничивает незавершённую работу, только не числом карточек, а временем: в спринт берут столько, сколько команда рассчитывает закончить.',
        '[[method.scrum|Scrum]], by the 2020 Scrum Guide, is “a lightweight framework that helps people, teams and organizations generate value through adaptive solutions for complex problems.” Its parts:\n\n- **The Scrum Team**, typically 10 or fewer people, with no sub-teams or hierarchies. It has three **accountabilities** (the Scrum Guide deliberately does not call them roles): the **Product Owner** is accountable for maximizing the value of the product; the **Scrum Master** for establishing Scrum as the Guide defines it; the **Developers** for creating a usable Increment each Sprint.\n- **Events.** The **Sprint** is a fixed-length event of one month or less; it contains all the other events: **Sprint Planning**, the **Daily Scrum** (15 minutes for the Developers), the **Sprint Review** and the **Sprint Retrospective**.\n- **Artifacts and commitments.** The **Product Backlog** has the Product Goal, the **Sprint Backlog** the Sprint Goal, the **Increment** the Definition of Done. The Definition of Done applies to all of the team’s work, which is what sets it apart from the definition of done on a single card.\n\nA Sprint is also a limit on work in progress, only by time rather than by the number of cards: a Sprint takes as much as the team expects to finish.',
      ),
    },
    {
      id: 'scrum-guide-help',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      levels: ['beginner'],
      title: bi('Как читать английское руководство', 'How to read the English guide'),
      body: bi(
        'Scrum Guide написан по-английски, поэтому вот перевод названий его разделов. Scrum Definition означает «что такое Scrum», Scrum Team означает «Scrum-команда», Scrum Events означает «события Scrum», а Scrum Artifacts означает «артефакты Scrum». Обязательство по-английски называется commitment, и по этому слову легко найти нужное место.',
        'The Scrum Guide is written in English, so here is what its section titles mean. Scrum Definition is what Scrum is, Scrum Team is the Scrum Team, Scrum Events are the events of Scrum, and Scrum Artifacts are the artifacts of Scrum. The word for a commitment is “commitment”, and it makes the right place easy to find.',
      ),
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi(
        'Откройте Scrum Guide и найдите раздел, в котором сказано, какое обязательство у бэклога спринта. Нажмите на этот раздел.',
        'Open the Scrum Guide and find the section that says what the commitment of the Sprint Backlog is. Click that section.',
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
        'Kanban Guide определяет [[method.kanban|Kanban-метод]] как «стратегию оптимизации потока ценности через процесс, который использует визуальную систему вытягивания». Практик у метода три: определить и показать поток, активно управлять работой в потоке и улучшать поток. Обязательных метрик четыре, и все они вам уже знакомы: WIP, пропускная способность, возраст карточки и время цикла.\n\nПоток в Kanban описывают явно, и такое описание называют **определением потока** (Definition of Workflow). В нём сказано, что считается единицей работы, где эта работа начинается и заканчивается, через какие состояния она проходит, как ограничивается WIP и какие правила движения действуют. Туда же входит **ожидание уровня обслуживания** (service level expectation, SLE). Это прогноз вида «85 % карточек проходят путь за 8 дней или быстрее», и строят его по истории времени цикла. В тренажёре урока о законе Литтла вы уже давали такое обещание, а теперь у него появилось название.\n\nОбратите внимание, что в Kanban Guide нет времени выполнения. Метод измеряет время цикла между явно заданными точками начала и конца, а словами «время выполнения» в разных командах называют разное. В нашем курсе время выполнения считают от появления карточки в очереди до её готовности, и это часть определения потока наших досок.',
        'The Kanban Guide defines the [[method.kanban|Kanban method]] as “a strategy for optimizing the flow of value through a process that uses a visual, pull-based system.” There are three practices: defining and visualizing a workflow; actively managing items in a workflow; improving the workflow. There are four mandatory measures, and you know them all: WIP, throughput, work item age and cycle time.\n\nThe flow is described explicitly in a **Definition of Workflow**: what counts as a unit of work, where it starts and finishes, which states it goes through, how WIP is controlled, which explicit policies apply, and a **service level expectation** (SLE), a forecast such as “85% of the cards get through in 8 days or less”, taken from the history of cycle times. In the trainer of the lesson on Little’s law you already made such a promise; now it has a name.\n\nNote that the Kanban Guide has no “lead time”. The method measures cycle time between explicitly defined start and finish points, while “lead time” means different things in different teams. In our course it runs from entering the queue to done, and that is part of the Definition of Workflow of our boards.',
      ),
    },
    {
      id: 'both',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Scrum и Kanban вместе', 'Not “or” but “and”'),
      body: bi(
        'Scrum задаёт ритм работы, ответственности и цели, а Kanban описывает, как работа движется внутри этого ритма. Авторы руководств отдельно объяснили, как их совмещать, в документе Kanban Guide for Scrum Teams. В нём сказано, что Scrum-команда может ограничивать WIP внутри спринта, следить за временем цикла и обещать сроки по SLE. Поэтому на собеседовании объясняйте, что Scrum служит набором правил с событиями и ответственностями, Kanban служит стратегией управления потоком и одно не исключает другого.',
        'Scrum sets the rhythm, the accountabilities and the goals; Kanban sets how work flows inside that rhythm. The authors of the guides described their compatibility separately, in the Kanban Guide for Scrum Teams: a Scrum Team may limit WIP inside a Sprint, watch cycle time and promise dates by an SLE. The interview answer: Scrum is a framework of events and accountabilities, Kanban is a strategy for managing flow; one does not exclude the other.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.scrum-commitments', 'method.q.scrum-master', 'method.q.scrum-wip', 'method.q.sle'] },
  ],
};

export const workTypes: Lesson = {
  id: 'methodology.work-types',
  block: 'methodology',
  title: bi('На какие типы делится работа и как рутина съедает время', 'What types work falls into and how toil eats the time'),
  summary: bi('Четыре типа работ, незапланированная работа и рутина, опасность единственного человека, который всё знает, и автоматизация как ответ.', 'Four types of work, unplanned work and toil; the single expert; automation as the answer.'),
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
        'В эксплуатации магазина работает один инженер. Каждый день ему пишут: «выдай доступ», «сбрось пароль», «выгрузи отчёт». Такие просьбы занимают 70 % его рабочего дня, и чем больше становится магазин, тем их больше. На выкладки и сбои времени у инженера не остаётся, и владелец бизнеса предлагает нанять второго такого же инженера. Хорошее ли это решение?',
        'The shop has one operations engineer. Every day people write to them: “grant access”, “reset a password”, “export a report”. That is 70% of their day, and as the shop grows there are more requests. No time is left for deployments and outages, and the owner suggests hiring a second engineer just like them. Is that a good decision?',
      ),
    },
    {
      id: 'types',
      kind: 'text',
      step: 'explain',
      title: bi('Четыре типа работ', 'Four types of work'),
      body: bi(
        'В романе «Проект „Феникс“» Джин Ким, Кевин Бер и Джордж Спаффорд делят работу IT-команды на четыре типа:\n\n- **бизнес-проекты** нужны покупателям и бизнесу, например новая страница скидок или новый способ оплаты;\n- **внутренние проекты** команда делает для себя, например переезжает на новый сервер или улучшает процесс;\n- **плановые изменения** составляют текущую работу по расписанию, например продление договора хостинга или обновление библиотеки (в романе этот тип называют изменениями без уточнения, но в нашем курсе изменением называют любую правку продукта, поэтому здесь мы добавляем слово «плановые»);\n- [[method.work-types|незапланированная работа]] складывается из сбоев и срочных просьб, которых никто не ждал: сайт не открывается или нужно срочно выгрузить отчёт для налоговой.\n\nНезапланированная работа разрушительнее всех остальных. Её не видно в планах, она приходит без очереди и забирает время как раз тех людей, которые нужны для работы трёх других типов.',
        'In the novel “The Phoenix Project” Gene Kim, Kevin Behr and George Spafford divide an IT team’s work into four types:\n\n- **business projects**: what customers and the business need, such as a new discount page or a payment method;\n- **internal projects**: what the team does for itself, such as moving to a new server or improving the process;\n- **planned changes**: routine scheduled work, such as renewing the hosting contract or upgrading a library (the novel calls this type changes without qualification, but in our course a change is any edit to the product, so here we add the word “planned”);\n- [[method.work-types|unplanned work]]: outages and urgent requests nobody expected, such as “the site does not open” or “export a report for the tax office right now”.\n\nUnplanned work is the most destructive: it is invisible in plans, it jumps the queue, and it takes the time of exactly the people needed for the other three types.',
      ),
    },
    {
      id: 'toil',
      kind: 'text',
      step: 'explain',
      title: bi('Рутина', 'Toil'),
      body: bi(
        'Просьбы, с которых начался урок, называют [[method.toil|рутиной]] (по-английски toil). В книге Google «Site Reliability Engineering» её признаки перечислены точно: такая работа делается вручную, повторяется, её можно автоматизировать, она возникает в ответ на чью-то просьбу или событие, не оставляет долговременной пользы и растёт вместе с сервисом: вдвое больше покупателей означает вдвое больше просьб. В той же книге описано правило Google: на такую работу у инженеров эксплуатации должно уходить не больше половины времени, а остальное время идёт на инженерные улучшения.\n\nТеперь видно, почему нанять второго инженера было бы слабым решением. Рутина растёт вместе с сервисом, и через полгода просьб хватит на двоих. Сильное решение называется [[method.automation|автоматизацией]]: скрипт выдачи доступов пишется за несколько дней и навсегда снимает самые частые просьбы. Улучшение требует времени сейчас, зато возвращает его каждый день потом.',
        'The requests in the hook are [[method.toil|toil]]. Google’s book “Site Reliability Engineering” lists its signs precisely: the work is manual, repetitive, automatable, reactive, leaves no enduring value, and grows with the service — twice the customers, twice the requests. The same book describes Google’s rule: operations engineers should spend no more than half of their time on such work, the rest on engineering improvements.\n\nNow you can see why a second engineer is a weak decision. Toil grows with the service, and in half a year there will be enough requests for two. The strong decision is [[method.automation|automation]]: an access script, written in a few days, that takes the most frequent requests off the queue for good. An improvement costs time now and gives it back every day after.',
      ),
    },
    {
      id: 'hero',
      kind: 'text',
      step: 'explain',
      title: bi('Один человек, который знает всё', 'One person for everything'),
      body: bi(
        'Есть и вторая ловушка. Если только один человек знает, как устроен рабочий сайт, через него идут все сбои, все выкладки и вся рутина. Этот человек становится узким местом команды, и, пока он в отпуске, простой сбой длится сутки. Выход в том, чтобы передать знание другим. Для этого пишут [[method.runbook|инструкцию для дежурного]] (по-английски runbook), то есть порядок действий при типовом сбое, и работают в паре, чтобы второй человек хотя бы раз сделал всё то же самое своими руками. Знание, которое хранится в голове у одного человека, так же рискованно, как единственный сервер без запасного.',
        'There is a second trap. If only one person knows how production works, every outage, every deployment and all the toil go through them. They are the team’s bottleneck, and when they are on leave a simple outage lasts a day. The answer is to pass the knowledge on: write a [[method.runbook|runbook]], the procedure for a typical outage, and work in pairs so that a second person does the same by hand at least once. Knowledge kept only in one person’s memory is as much of a risk as a single server with no spare.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.work-sort', 'method.q.toil-signs', 'method.q.hire-vs-automate'] },
  ],
};

export const pipeline: Lesson = {
  id: 'methodology.pipeline',
  block: 'methodology',
  title: bi('Как конвейер связывает непрерывную интеграцию, доставку и развёртывание', 'How the pipeline links continuous integration, delivery and deployment'),
  summary: bi('Точные определения непрерывной интеграции, непрерывной доставки и непрерывного развёртывания, конвейер развёртывания и откат.', 'Precise definitions of CI, continuous delivery and continuous deployment; the deployment pipeline and rollback.'),
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
        'Три команды говорят о себе: «У нас CI/CD». В первой автоматическая сборка запускается раз в неделю на отдельной ветке перед выпуском. Во второй каждое изменение собирается и проверяется, а на рабочий сайт раз в неделю его выкладывает дежурный нажатием кнопки. В третьей всё, что прошло проверки, уходит на рабочий сайт само в течение часа. Что на самом деле есть у каждой из них? К концу урока вы ответите на этот вопрос точно, так, как ответили бы на собеседовании.',
        'Three teams say, “We have CI/CD.” In the first, an automated build runs once a week on a separate branch before a release. In the second, every change is built and tested, and once a week the on-call engineer deploys to production with a button. In the third, everything that passed the checks goes to production by itself within an hour. What does each of them really have? By the end of the lesson you will answer precisely, as you would at an interview.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как изменение идёт от слияния до рабочего сайта', 'How a change goes from the merge to the working site'),
      body: bi(
        'Схема ниже показывает путь одного изменения после того, как разработчик слил его в общую ветку, то есть в общий код всей команды. Сначала на ней только само слияние в левом верхнем углу и рабочий сайт в левом нижнем. Шаги появляются по мере того, как до них доходит изменение: в верхнем ряду сборка, автоматические проверки и стенд, то есть копия рабочего сайта для проверки, справа внизу выпуск, а в нижнем ряду партия изменений и выкладка. Пунктирная рамка вокруг первых трёх шагов появится в тот момент, когда изменение их пройдёт: она отмечает, где заканчивается непрерывная интеграция.',
        'The diagram below shows the path of one change after a developer merged it into the shared branch, the common code of the whole team. At first it shows only the merge itself in the top left corner and the working site in the bottom left. The steps appear as the change reaches them: the build, the automated checks and staging (a copy of the working site for checking) in the top row, the release at the bottom right, and the batch of changes and the deployment in the bottom row. The dashed frame around the first three steps appears once the change has passed them: it marks where continuous integration ends.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'method.x.pipeline', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного шага говорит, что этот шаг делает, а карточка на стрелке показывает, сколько изменение ждёт на этом переходе. Жёлтая рамка означает долгое ожидание или высокий риск. Под схемой считается, сколько часов изменение идёт до рабочего сайта, насколько вероятно, что одна выкладка сломает сайт, сколько выкладок бывает в неделю, сколько минут займёт восстановление, если сайт всё же сломается, и сколько минут потом уйдёт на поиск виноватого изменения.\n\nПосле первого прохода переключите в «Параметрах» сборку на «сама после каждого слияния» и посмотрите, как сократится путь. Потом в поле «Кто выпускает проверенное изменение» выберите «конвейер сам», и практика из непрерывной доставки превратится в непрерывное развёртывание. Затем уменьшайте число изменений в одной выкладке и следите за риском, а напоследок включите в блоке «Сломать» поломку, которая убирает откат.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted step says what the step does, and the card on the arrow shows how long the change waits on that transition. A yellow outline means a long wait or a high risk. Under the diagram you see how many hours the change takes to reach the working site, how likely one deployment is to break the site, how many deployments happen a week, how many minutes recovery takes if the site does break, and how many minutes it then takes to find the faulty change.\n\nAfter the first pass switch the build to “by itself after every merge” in “Parameters” and see the path shrink. Then choose “the pipeline by itself” in “Who releases a checked change”, and continuous delivery turns into continuous deployment. After that reduce the number of changes in one deployment and watch the risk, and finally switch on the break in “Break it” that removes the rollback.'),
      caption: bi(
        'Вернитесь к трём командам из начала урока и найдите каждую на схеме: у первой нет даже автоматической сборки после слияния, у второй выпуск идёт по кнопке, у третьей конвейер выпускает изменения сам. Разделы ниже дают этим трём случаям точные названия, а в вопросах в конце урока вы будете различать их по описанию процесса.',
        'Go back to the three teams from the start of the lesson and find each one on the diagram: the first has no automatic build after the merge, the second releases with a button, the third lets the pipeline release changes by itself. The sections below give these three cases precise names, and in the questions at the end of the lesson you will tell them apart from a description of the process.',
      ),
    },
    {
      id: 'ci',
      kind: 'text',
      step: 'explain',
      title: bi('Непрерывная интеграция', 'Continuous integration'),
      body: bi(
        'Мартин Фаулер определяет [[method.ci|непрерывную интеграцию]] (continuous integration, CI) как практику, при которой каждый член команды часто, хотя бы раз в день, сливает свои изменения в общую основную ветку, а каждое слияние автоматически собирается и проверяется автотестами. Две вещи в этом определении обязательны. Первая состоит в частоте и общей ветке: если ветка три недели существует отдельно от общей, это не непрерывная интеграция, сколько бы тестов ни запускалось на каждое её обновление. Вторая состоит в дисциплине: если проверка не прошла, команда первым делом чинит её, и никто не сливает новое поверх сломанной проверки.\n\nНепрерывная интеграция заканчивается там, где изменение слито, собрано и проверено машиной, и до рабочего сайта она не доходит. Поэтому первая команда из начала урока непрерывной интеграцией не занимается: сборка раз в неделю на отдельной ветке — это автоматизация сборки, а не интеграция.',
        'Martin Fowler defines [[method.ci|continuous integration]] (CI) as a practice where each member of a team merges their changes into a shared mainline often, at least daily, and each merge is built and verified by automated tests. Two things in this definition are essential. The first is frequency and the shared branch: if a branch lives apart for three weeks, it is not CI, however many tests run on each update to it. The second is discipline: if the build goes red, fixing it is the team’s first job, and nobody merges new work on top of red.\n\nCI ends where the change is merged, built and checked by a machine. CI does not reach production. That is why the first team in the hook does not do CI: a weekly build on a separate branch is build automation, not integration.',
      ),
    },
    {
      id: 'cd',
      kind: 'text',
      step: 'explain',
      title: bi('Непрерывная доставка и непрерывное развёртывание', 'Delivery and deployment'),
      body: bi(
        'Дальше начинаются две практики, которые часто путают, потому что обе сокращают до букв CD.\n\nПри [[method.cdelivery|непрерывной доставке]] (continuous delivery) каждое изменение, прошедшее проверки, в любой момент готово к выкладке на рабочий сайт, а сама выкладка сводится к одному действию человека. Выпускать ли изменение сейчас, решает бизнес, и инженерного подвига для этого не требуется. Вторая команда из начала урока работает так при одном условии: её кнопка выкладывает любое проверенное изменение без ручной подготовки.\n\nПри [[method.cdeployment|непрерывном развёртывании]] (continuous deployment) каждое изменение, прошедшее проверки, уходит на рабочий сайт само, без решения человека. Так работает третья команда. На схеме разница между этими практиками видна в одном блоке «Выпуск»: проверенное изменение выпускает либо человек кнопкой, либо конвейер сам.\n\nОбщепринятого сокращения у непрерывного развёртывания нет, а буквами CD обычно называют доставку. На собеседовании называйте обе практики полностью, и тогда сразу будет видно, что вы их различаете.',
        'Two practices start from here, and they are often confused because both are shortened to CD.\n\n[[method.cdelivery|Continuous delivery]]: every change that passed the checks is ready to be deployed to production at any moment, and the deployment is one action by a person. Whether to release now is a business decision, not an engineering feat. The second team in the hook does exactly this, provided its button really deploys any checked change without manual preparation.\n\n[[method.cdeployment|Continuous deployment]]: every change that passed the checks goes to production by itself, without a manual decision. That is the third team. On the diagram the difference shows in one block, “Release”: a checked change is released either by a person with a button or by the pipeline itself.\n\nContinuous deployment has no generally accepted abbreviation of its own: CD usually means delivery. At an interview, name the practices in full; it shows at once that you tell them apart.',
      ),
    },
    {
      id: 'pipeline',
      kind: 'text',
      step: 'explain',
      title: bi('Конвейер развёртывания и откат', 'The pipeline and rollback'),
      body: bi(
        '[[method.pipeline|Конвейером развёртывания]] (deployment pipeline) называют автоматическую цепочку, которая ведёт изменение от слияния до рабочего сайта: сборка, автотесты, выкладка на **стенд** (копию рабочего сайта для проверки), проверки на стенде и выкладка на рабочий сайт. Каждый шаг конвейера убирает из потока ценности одно ожидание: ожидание сборки, ожидание тестировщика, ожидание дня выкладки. Эффективность потока растёт не потому, что люди работают быстрее, а потому, что задача меньше ждёт.\n\nВторая половина конвейера ведёт назад. [[method.rollback|Откат]] за минуты возвращает на рабочий сайт предыдущую работающую версию, а причину сбоя можно спокойно исправить потом. Если отката нет, команда чинит сайт новой выкладкой: пишет **хотфикс** (срочное исправление) и выкладывает его. Такой путь дольше, несёт новый риск и добавляет вторую, внеплановую выкладку. Частые выкладки становятся безопасными благодаря маленьким партиям вместе с откатом.',
        'A [[method.pipeline|deployment pipeline]] is the automated chain that takes a change from the merge to production: build, automated tests, deployment to **staging** (a copy of production for checking), checks on staging, deployment to production. Each stage of the pipeline removes one wait from the value stream: “waiting for a build”, “waiting for the tester”, “waiting for the deployment window”. Flow efficiency grows not because people work faster but because the task waits less.\n\nThe second half of the pipeline is the way back. A [[method.rollback|rollback]] returns production to the previous working version in minutes, and the cause can be fixed later, calmly. Without a rollback the team fixes forward: it writes a **hotfix** (an urgent fix) and deploys again, which takes longer, carries a new risk, and is a second, unplanned deployment. Small batches and rollback together are what make frequent deployments safe.',
      ),
    },
    {
      id: 'later',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      body: bi(
        'В этом уроке конвейер служит схемой того, как организована работа. Собрать настоящий конвейер своими руками вы сможете позже, в блоке CI/CD. Там кнопка «Выпустить» превратится в одну строку описания конвейера, а выпуск без кнопки будет означать, что такой строки в описании нет.',
        'Here the pipeline is a picture of how work is organised. You will build one by hand later, in the CI/CD block: there the same “Release” button becomes one line of the pipeline description, and a release without a button means that line is absent.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.ci-cd-match', 'method.q.release-branch', 'method.q.red-build', 'method.q.pipeline-order'] },
  ],
};
