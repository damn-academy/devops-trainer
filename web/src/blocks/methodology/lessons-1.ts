// Lessons 1–5: why a business needs development and operations together, the
// value stream, the board and pull, work in progress and time, Little's law
// and the cumulative flow diagram (07 §4: MT0–MT2).

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { R, S } from './sources';

export const business: Lesson = {
  id: 'methodology.business',
  block: 'methodology',
  title: bi('Зачем бизнесу разработка и эксплуатация', 'Why a business needs development and operations'),
  summary: bi('Продукт, ценность и изменения; две стороны одного результата; рабочее определение DevOps.', 'Product, value and change; two sides of one result; a working definition of DevOps.'),
  introduces: ['method.value', 'method.dev-ops', 'method.outage', 'method.devops'],
  uses: [],
  tier: 'core',
  minutes: 25,
  sources: { en: [S.devopsHandbook, S.doraCapabilities], ru: [R.devops, R.lean] },
  sections: [
    {
      id: 'course',
      kind: 'callout',
      tone: 'note',
      step: 'hook',
      levels: ['beginner'],
      title: bi('Как устроен этот курс', 'How this course works'),
      body: bi(
        'Здесь мы часто будем просить вспомнить и предсказать, а не перечитать. Это кажется медленнее, но через неделю помнится заметно больше. Ошибки в предсказаниях — часть работы: они никуда не идут в оценку, очков и рейтингов здесь нет.',
        'We will often ask you to recall and to predict rather than to reread. It feels slower, but a week later you remember noticeably more. Wrong predictions are part of the work: they do not count against you, and there are no points or rankings here.',
      ),
    },
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Небольшой интернет-магазин чая зарабатывает, пока выполняются два условия: сайт работает, и в нём есть то, что нужно покупателям. Каждый час работы приносит в среднем 12 000 рублей. Через полчаса вы сможете объяснить, почему этими двумя условиями обычно заняты два разных отдела, почему они спорят — и что с этим делают.',
        'A small online tea shop earns money as long as two things hold: the site works, and it has what the customers need. Every hour of work brings about $150. In half an hour you will be able to explain why these two conditions are usually owned by two different departments, why they argue, and what is done about it.',
      ),
    },
    {
      id: 'product',
      kind: 'text',
      step: 'explain',
      title: bi('Продукт и ценность', 'Product and value'),
      body: bi(
        'Продукт магазина — его сайт вместе со всем, что за ним стоит. [[method.value|Ценность]] — то, за что покупатель готов платить: найти нужный чай, оплатить его и получить вовремя.\n\nЛюбую правку продукта будем называть **изменением**. Изменение бывает двух видов: **функция** — новая возможность для покупателя («оплата картой»), и **дефект** — изменение, которое работает не так, как задумано («цена в корзине считается неверно»). Важная мысль, на которой стоит весь блок: изменение приносит ценность только тогда, когда дошло до покупателя. Функция, которая готова, но лежит у разработчика, денег не зарабатывает.',
        'The shop’s product is its site together with everything behind it. [[method.value|Value]] is what the customer is ready to pay for: finding the right tea, paying for it and getting it on time.\n\nAny edit to the product we will call a **change**. A change comes in two kinds: a **feature** is a new possibility for the customer (“card payments”), and a **defect** is a change that does not work as intended (“the cart total is wrong”). The idea this whole block rests on: a change brings value only when it reaches the customer. A feature that is ready but sits with a developer earns nothing.',
      ),
    },
    {
      id: 'sides',
      kind: 'text',
      step: 'explain',
      title: bi('Две стороны', 'Two sides'),
      body: bi(
        'Изменения делает **разработка**: программисты, тестировщики, аналитики. За тем, чтобы сайт работал, следит [[method.dev-ops|эксплуатация]]: она выкладывает изменения на **прод** (production — рабочую версию сайта, которой пользуются покупатели), следит за серверами и чинит то, что сломалось.\n\nКогда прод работает плохо или не работает — покупатели не могут оплатить заказ, страница открывается минуту, сайт недоступен, — это [[method.outage|сбой]]. Другое слово для того же — инцидент. Сбой стоит денег напрямую: минута недоступности магазина — минута без продаж.',
        'Changes are made by **development**: programmers, testers, analysts. Keeping the site running is the job of [[method.dev-ops|operations]]: it deploys changes to **production** (the working site the customers use), watches the servers and fixes what broke.\n\nWhen production works badly or not at all — customers cannot pay, a page takes a minute to open, the site is unreachable — that is an [[method.outage|outage]]. Another word for it is incident. An outage costs money directly: a minute of a shop being down is a minute without sales.',
      ),
    },
    {
      id: 'conflict',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Почему они спорят', 'Why they argue'),
      body: bi(
        'Разработку традиционно оценивают по тому, сколько функций она выпустила, а эксплуатацию — по тому, сколько дней прошло без сбоев. Но каждое изменение — это риск для стабильности: чем чаще и больше выкладывают, тем больше поводов для сбоя. Поэтому эксплуатации выгодно выкладывать реже и крупнее, а разработке — чаще. Цели противоположны, хотя результат у них общий: покупатель, который получил нужное на работающем сайте. Авторы «Руководства по DevOps» называют этот конфликт главной причиной того, что изменения доходят до покупателей медленно и всё равно ломают прод.',
        'Development has traditionally been judged by how many features it shipped, and operations by how many days passed without an outage. But every change is a risk to stability: the more often and the bigger the deployments, the more chances for an outage. So operations gains from deploying less often and in bigger pieces, and development from deploying more often. Their goals pull in opposite directions, although their result is one: a customer who got what they needed on a working site. The authors of “The DevOps Handbook” call this conflict the main reason why changes reach customers slowly and still break production.',
      ),
    },
    {
      id: 'devops',
      kind: 'text',
      step: 'explain',
      title: bi('Рабочее определение', 'A working definition'),
      body: bi(
        '[[method.devops|DevOps]] (от development и operations) — способ работы, при котором разработка и эксплуатация отвечают за общий результат: изменения доходят до покупателей быстро и при этом не ломают сайт. Это не должность и не программа, а договорённость о цели и набор практик, которые делают её достижимой.\n\nПока это определение рабочее. В следующих главах мы разберём, из чего оно складывается: путь изменения от идеи до покупателя, поток работы на доске, автоматические проверки и выкладки, цели надёжности, разбор сбоев. В конце блока вернёмся к определению и дополним его.',
        '[[method.devops|DevOps]] (from development and operations) is a way of working in which development and operations own one result together: changes reach the customers fast and do not break the site. It is not a job title and not a program; it is an agreement about the goal and a set of practices that make the goal reachable.\n\nFor now this definition is a working one. The next chapters take it apart: the path of a change from an idea to the customer, the flow of work on a board, automated checks and deployments, reliability targets, reviews of outages. At the end of the block we will come back to the definition and complete it.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.outage-kind', 'method.q.conflict', 'method.q.value-delivered'] },
  ],
};

export const valueStream: Lesson = {
  id: 'methodology.value-stream',
  block: 'methodology',
  title: bi('Путь задачи от идеи до покупателя', 'The path of a task from an idea to the customer'),
  summary: bi('Этапы, передачи и ожидания; поток ценности и эффективность потока.', 'Stages, handoffs and waits; the value stream and flow efficiency.'),
  introduces: ['method.value-stream', 'method.flow-efficiency'],
  uses: ['method.value', 'method.dev-ops'],
  tier: 'core',
  minutes: 25,
  sources: { en: [S.devopsHandbook, S.doraCapabilities], ru: [R.lean, R.devops] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Покупатели попросили оплату картой в понедельник. Работает она у них через две с половиной недели. Как вы думаете, сколько из этих дней кто-то действительно работал над оплатой картой — десять, пять, два? Запомните свой ответ и пройдите путь этой задачи шаг за шагом.',
        'Customers asked for card payments on a Monday. It works for them two and a half weeks later. How many of those days do you think someone actually worked on card payments: ten, five, two? Remember your answer and walk the path of this task step by step.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'method.x.value-stream', caption: bi('Шаги — стрелками или пробелом. Нажмите на любой блок или стрелку: карточка расскажет, что это и почему здесь ждут.', 'Step with the arrow keys or space. Click any box or arrow: the card tells what it is and why things wait there.') },
    {
      id: 'stream',
      kind: 'text',
      step: 'explain',
      title: bi('Поток ценности', 'The value stream'),
      body: bi(
        'Путь, который вы только что прошли, называют [[method.value-stream|потоком ценности]]: все шаги от идеи до покупателя вместе с ожиданиями между ними. В нашем магазине это отбор, разработка, ревью (проверка кода коллегой), проверка, выкладка. На каждой границе между этапами задача переходит из рук в руки — это **передача**, и почти на каждой передаче задача ждёт: исполнитель занят другим, выкладка бывает по четвергам, тестировщик один на двоих разработчиков.\n\nЕсли сложить часы, станет видно главное: работы на этом пути — полтора дня, всё остальное — ожидание. Ожидание никто не планирует и почти никто не видит: в отчёте каждого отдела всё хорошо, каждый был занят.',
        'The path you just walked is called the [[method.value-stream|value stream]]: all the steps from an idea to the customer together with the waits between them. In our shop these are selection, development, review (a colleague checking the code), testing, deployment. At each border between stages the task changes hands; that is a **handoff**, and at almost every handoff the task waits: the person is busy with something else, deployments happen on Thursdays, one tester serves two developers.\n\nAdd up the hours and the main thing becomes visible: there is a day and a half of work on this path, and everything else is waiting. Nobody plans the waiting and almost nobody sees it: in each department’s report all is well, everybody was busy.',
      ),
    },
    {
      id: 'efficiency',
      kind: 'text',
      step: 'explain',
      title: bi('Эффективность потока', 'Flow efficiency'),
      body: bi(
        'Отношение работы ко всему пути называют [[method.flow-efficiency|эффективностью потока]]:\n\n```text\nэффективность потока = время работы / (время работы + время ожидания)\n```\n\nНа нашем пути это 12 часов из 96, то есть 12,5%. Отсюда практический вывод, которым пользуются при улучшении процесса: чтобы задачи доходили до покупателей быстрее, сначала ищут самое долгое ожидание, а не заставляют людей работать быстрее. Сократить окно выкладки с суток до часа — это минус почти три рабочих дня для каждой задачи без единого лишнего часа работы.',
        'The ratio of work to the whole path is called [[method.flow-efficiency|flow efficiency]]:\n\n```text\nflow efficiency = work time / (work time + waiting time)\n```\n\nOn our path that is 12 hours out of 96, or 12.5%. Hence a practical rule used when improving a process: to get tasks to customers faster, first look for the longest wait instead of making people work faster. Shortening the deployment window from a day to an hour takes almost three working days off every task without a single extra hour of work.',
      ),
    },
    {
      id: 'note',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      body: bi(
        'На схеме выкладка — один шаг, и эксплуатация делает её руками. Позже, в главе об автоматической выкладке, тот же путь станет короче: часть ожиданий исчезнет, когда сборку, проверки и выкладку возьмёт на себя машина.',
        'On the diagram, deployment is one step done by hand by operations. Later, in the chapter on automated deployment, the same path gets shorter: some of the waits disappear when a machine takes over the build, the checks and the deployment.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.flow-efficiency', 'method.q.longest-wait', 'method.q.path-order'] },
  ],
};

export const board: Lesson = {
  id: 'methodology.board',
  block: 'methodology',
  title: bi('Работа становится видна: карточка и доска', 'Making work visible: the card and the board'),
  summary: bi('Карточка с критерием готовности, доска по этапам, вытягивание и цена переключения между задачами.', 'A card with a definition of done, a board by stages, pull and the price of switching between tasks.'),
  introduces: ['method.board', 'method.pull', 'method.switching'],
  uses: ['method.value-stream'],
  tier: 'core',
  minutes: 30,
  sources: { en: [S.kanbanGuide, S.multitasking], ru: [R.kanbanToyota, R.lean] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Задачи команды магазина живут в общем чате: «сделай скидку», «а что с оплатой?», «напомни, мы начали фильтр?». Чтобы узнать, что начато, что ждёт и что уже готово, нужно перечитать сотню сообщений. Знакомо? Первый шаг любой методологии потока — сделать работу видимой.',
        'The shop team’s tasks live in a group chat: “do the discount”, “what about payments?”, “remind me, did we start the filter?”. To find out what is started, what waits and what is done, you have to reread a hundred messages. Sounds familiar? The first step of any flow method is to make the work visible.',
      ),
    },
    {
      id: 'board',
      kind: 'text',
      step: 'explain',
      title: bi('Карточка и доска', 'The card and the board'),
      body: bi(
        'Каждая задача становится **карточкой**: у неё есть название и критерий готовности — проверяемое условие, когда задача закончена («готово, когда покупатель может оплатить заказ картой»). Карточки висят на [[method.board|доске]]. Колонки доски — этапы пути из прошлого урока: готово к работе, разработка, проверка, готово. Колонка этапа делится на две части: «в работе» и «готово» — так видно не только, что делают, но и что уже сделано и ждёт следующего этапа.\n\nДоска ничего не ускоряет сама по себе. Она отвечает на вопрос, на который чат не отвечает: где сейчас каждая задача и где они скапливаются.',
        'Each task becomes a **card**: it has a name and a definition of done, a checkable condition for when the task is finished (“done when a customer can pay by card”). Cards hang on a [[method.board|board]]. The board’s columns are the stages of the path from the previous lesson: ready, development, testing, done. A stage column is split into two parts, “doing” and “done”, so you see not only what is being worked on but also what is finished and waits for the next stage.\n\nA board does not speed anything up by itself. It answers the question a chat cannot answer: where each task is right now, and where tasks pile up.',
      ),
    },
    {
      id: 'pull',
      kind: 'text',
      step: 'explain',
      title: bi('Вытягивание', 'Pull'),
      body: bi(
        'Есть два способа давать людям работу. При **выталкивании** задачу отдают, как только она появилась: «вот ещё одна, начни, пожалуйста». При [[method.pull|вытягивании]] новую задачу берут, когда для неё освободилось место: закончил одну — взял следующую из колонки слева.\n\nВытягивание кажется медленнее — ведь задача ждёт. Но она ждёт в очереди, где ничего не стоит, а не в работе, где отнимает внимание. Вытягивание делает очереди видимыми: если перед проверкой собрались карточки, это видно на доске, а не только в усталости тестировщика.',
        'There are two ways to give people work. With **push**, a task is handed over as soon as it appears: “here is one more, please start it”. With a [[method.pull|pull system]], a new task is taken when there is room for it: you finished one, you take the next from the column on the left.\n\nPull looks slower, since the task waits. But it waits in a queue, where it costs nothing, not in progress, where it takes up attention. Pull makes queues visible: when cards gather in front of testing, you see it on the board, not only in the tester’s tiredness.',
      ),
    },
    {
      id: 'switch',
      kind: 'text',
      step: 'explain',
      title: bi('Цена переключения', 'The price of switching'),
      body: bi(
        'У человека с несколькими начатыми задачами часть времени уходит на [[method.switching|переключение между задачами]]: вспомнить, где остановился, заново собрать в голове контекст. Джеральд Вайнберг в книге «Quality Software Management» оценил, сколько времени при этом остаётся на полезную работу:\n\n- одна задача — 100%;\n- две — 80%;\n- три — 60%;\n- четыре — 40%;\n- пять и больше — 25%.\n\nОстаток ещё и делится между задачами. Если у разработчика шесть задач и мощность 3 очка работы в день, на каждую приходится 3 × 0,25 / 6 = 0,125 очка. Задача на 3 очка будет готова через 24 дня — а по одной за раз каждая была бы готова за день. Цифры Вайнберга — оценка из практики, а не закон природы; в тренажёре ниже они — правило модели.',
        'A person with several started tasks loses part of the time on [[method.switching|context switching]]: remembering where they stopped, rebuilding the whole context in their mind. In “Quality Software Management” Gerald Weinberg estimated how much time is left for useful work:\n\n- one task: 100%;\n- two: 80%;\n- three: 60%;\n- four: 40%;\n- five or more: 25%.\n\nWhat is left is also split between the tasks. If a developer has six tasks and a capacity of 3 points of work a day, each gets 3 × 0.25 / 6 = 0.125 points. A 3-point task will be ready in 24 days, while one at a time each would be ready in a day. Weinberg’s figures are an estimate from practice, not a law of nature; in the trainer below they are a rule of the model.',
      ),
    },
    {
      id: 'practice',
      kind: 'widget',
      step: 'practice',
      widget: 'flowlab.board',
      props: { scenario: 's0' },
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.pull-why', 'method.q.weinberg', 'method.q.board-visible'] },
  ],
};

export const flow: Lesson = {
  id: 'methodology.flow',
  block: 'methodology',
  title: bi('Незавершённая работа и время', 'Work in progress and time'),
  summary: bi('Незавершённая работа и её лимит; время цикла и время выполнения; пропускная способность и возраст карточки.', 'Work in progress and its limit; cycle time and lead time; throughput and work item age.'),
  introduces: ['method.wip', 'method.cycle-time', 'method.throughput'],
  uses: ['method.board', 'method.pull', 'method.switching'],
  tier: 'core',
  minutes: 30,
  sources: { en: [S.kanbanGuide, S.littleWiki], ru: [R.kanban, R.lean] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Владелец бизнеса задаёт команде два вопроса: «Когда будет готово?» и «Сколько вы успеваете?». На первый обычно отвечают «скоро», на второй — «много». В этом уроке — три величины, которые превращают эти ответы в числа.',
        'The business owner asks the team two questions: “When will it be ready?” and “How much do you get done?”. The usual answers are “soon” and “a lot”. This lesson gives three quantities that turn those answers into numbers.',
      ),
    },
    {
      id: 'wip',
      kind: 'text',
      step: 'explain',
      title: bi('Незавершённая работа', 'Work in progress'),
      body: bi(
        '[[method.wip|Незавершённая работа]] (work in progress, WIP) — это карточки, которые начаты, но ещё не закончены. На доске это всё, что стоит между колонкой «готово к работе» и колонкой «готово».\n\n**Лимит WIP** — сколько карточек может одновременно находиться в колонке, считая обе её части, «в работе» и «готово». Если лимит исчерпан, новую карточку в колонку не вытягивают, пока одна из стоящих там не уйдёт дальше. Лимит не делает людей быстрее. Он не даёт начинать новое, пока старое не закончено: меньше переключений, короче очереди, а значит, каждая карточка проходит путь быстрее. Хорошая отправная точка — число людей на этапе плюс один.',
        '[[method.wip|Work in progress]] (WIP) is the cards that are started but not finished yet. On the board it is everything between the “ready” column and the “done” column.\n\nA **WIP limit** is how many cards a column may hold at once, counting both its parts, “doing” and “done”. When the limit is used up, no new card is pulled into the column until one of those in it moves on. A limit does not make people faster. It stops new work from starting until old work is finished: fewer switches, shorter queues, and so each card gets through faster. A good starting point is the number of people on the stage plus one.',
      ),
    },
    {
      id: 'time',
      kind: 'text',
      step: 'explain',
      title: bi('Время и выход', 'Time and output'),
      body: bi(
        '[[method.cycle-time|Время цикла]] — время от начала работы над карточкой до её готовности. Если карточку начали в понедельник и закончили в среду, её время цикла — три дня (считаем дни включительно). **Время выполнения** (lead time) шире: от момента, когда карточка появилась в очереди «готово к работе», до готовности. Покупатель чувствует время выполнения; команда управляет временем цикла.\n\n[[method.throughput|Пропускная способность]] — сколько карточек система заканчивает за единицу времени, например 1,5 в день. **Возраст карточки** — сколько дней начатая, но ещё не законченная карточка находится в работе. Возраст важен потому, что время цикла узнают только в конце, а возраст виден каждый день: карточка, которая уже старше обычного, — сигнал вмешаться сейчас.',
        '[[method.cycle-time|Cycle time]] is the time from the start of work on a card to the moment it is done. A card started on Monday and finished on Wednesday has a cycle time of three days (counting the days inclusively). **Lead time** is wider: from the moment the card appeared in the “ready” queue until it is done. The customer feels lead time; the team manages cycle time.\n\n[[method.throughput|Throughput]] is how many cards the system finishes per unit of time, for example 1.5 a day. **Work item age** is how many days a started but unfinished card has been in progress. Age matters because cycle time is known only at the end, while age is visible every day: a card already older than usual is a signal to step in now.',
      ),
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi(
        'Эти определения взяты из Kanban Guide — короткого руководства авторов метода. Откройте его: в каком разделе перечислены четыре обязательные метрики потока? Нажмите на раздел.',
        'These definitions come from the Kanban Guide, a short guide by the authors of the method. Open it: which section lists the four mandatory flow measures? Click the section.',
      ),
      ref: { page: 'web/kanbanguides.org/kanban-guide' },
      answer: 'MEASURES',
    },
    {
      id: 'find',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi(
        'В терминале запущена маленькая доска — команда `flow`. Найдите в её странице руководства (`man flow`), как поставить лимит WIP, и поставьте колонке «Анализ» (analysis) лимит 2.',
        'A small board runs in the terminal: the `flow` command. Find in its manual page (`man flow`) how to set a WIP limit, and give the Analysis column a limit of 2.',
      ),
      ref: { page: 'man/flow.1', anchor: 'OPTIONS', line: 'wip COLUMN N' },
      terminal: {
        setup: { ext: { flow: { scenario: 'p5' } } },
        task: {
          id: 'wip2',
          prompt: bi('Поставьте колонке analysis лимит WIP 2.', 'Give the analysis column a WIP limit of 2.'),
          check: { when: 'flow.policies.wip.analysis=2', fail: [{ if: 'flow.policies.wip.analysis>2', say: bi('Лимит поставлен, но больше двух.', 'A limit is set, but it is higher than two.') }] },
          docStep: 3,
          chips: 'flow wip analysis 2',
          concepts: ['method.wip'],
          hints: { H1: bi('Команда для лимита начинается с `flow` и названия настройки.', 'The command for a limit starts with `flow` and the name of the setting.'), H2: bi('Раздел OPTIONS страницы `man flow`.', 'The OPTIONS section of `man flow`.') },
        },
      },
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.cycle-vs-lead', 'method.q.wip-limit-count', 'method.q.age'] },
  ],
};

export const little: Lesson = {
  id: 'methodology.little',
  block: 'methodology',
  title: bi('Закон Литтла и накопительная диаграмма', 'Little’s law and the cumulative flow diagram'),
  summary: bi('Как связаны незавершённая работа, выход и время; 85-й процентиль как обещание; как читать накопительную диаграмму потока.', 'How work in progress, output and time are linked; the 85th percentile as a promise; how to read a cumulative flow diagram.'),
  introduces: ['method.little', 'method.cfd', 'method.percentile'],
  uses: ['method.wip', 'method.cycle-time', 'method.throughput'],
  tier: 'core',
  minutes: 40,
  sources: { en: [S.little, S.littleWiki, S.cfdWiki, S.kanbanGuide], ru: [R.little, R.percentile, R.kanban] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В колонках «в работе» у команды в среднем 12 карточек. Заканчивает она в среднем 3 карточки в день. Сколько дней в среднем проходит от начала работы над карточкой до её готовности? Прикиньте ответ, прежде чем читать дальше.',
        'On average the team has 12 cards in its “doing” columns. It finishes 3 cards a day on average. How many days on average pass from the start of work on a card until it is done? Estimate the answer before you read on.',
      ),
    },
    {
      id: 'little',
      kind: 'text',
      step: 'explain',
      title: bi('Закон Литтла', 'Little’s law'),
      body: bi(
        'Ответ — 4 дня, и его даёт [[method.little|закон Литтла]], доказанный Джоном Литтлом в 1961 году для очередей, а для потока работы сформулированный так:\n\n```text\nсреднее WIP = пропускная способность × среднее время цикла\nсреднее время цикла = среднее WIP / пропускная способность\n```\n\n12 / 3 = 4. Отсюда главный вывод: при той же пропускной способности вдвое больше начатой работы — вдвое дольше каждая карточка. Начинать больше не значит заканчивать больше.\n\nУ закона есть условия, и Дэниел Ваканти подчёркивает их для потока работы: всё начатое когда-нибудь заканчивается; незавершённой работы в начале и в конце периода примерно поровну; средний возраст карточек не растёт. Если WIP всё время растёт, равенство не выполняется — система нестабильна, и тогда в первую очередь нужно остановить рост, а не считать.',
        'The answer is 4 days, and it comes from [[method.little|Little’s law]], proved by John Little in 1961 for queues and stated for a flow of work like this:\n\n```text\naverage WIP = throughput × average cycle time\naverage cycle time = average WIP / throughput\n```\n\n12 / 3 = 4. Hence the main conclusion: with the same throughput, twice as much started work means twice as long for every card. Starting more does not mean finishing more.\n\nThe law has conditions, and Daniel Vacanti stresses them for a flow of work: everything started eventually finishes; there is about as much work in progress at the start of the period as at its end; the average age of cards does not grow. If WIP keeps growing, the equality does not hold — the system is unstable, and the first thing to do is to stop the growth, not to calculate.',
      ),
    },
    {
      id: 'percentile',
      kind: 'text',
      step: 'explain',
      title: bi('Обещание с уверенностью', 'A promise with confidence'),
      body: bi(
        'Среднее не годится для обещаний: половина карточек дольше среднего. Поэтому сроки обещают по процентилю. Отсортируйте времена цикла последних 20 карточек по возрастанию: семнадцатое значение и есть [[method.percentile|85-й процентиль]] — 85% карточек были не дольше его. Если оно равно 8 дням, можно честно сказать владельцу бизнеса: «85 из 100 таких задач мы заканчиваем за 8 дней или быстрее». Середину того же ряда называют медианой (50-й процентиль).',
        'An average is no good for promises: half of the cards take longer than average. That is why deadlines are promised by a percentile. Sort the cycle times of the last 20 cards in ascending order: the seventeenth value is the [[method.percentile|85th percentile]] — 85% of the cards took no longer than that. If it equals 8 days, you can honestly tell the business owner: “85 out of 100 such tasks we finish in 8 days or less.” The middle of the same series is called the median (the 50th percentile).',
      ),
    },
    {
      id: 'cfd',
      kind: 'text',
      step: 'explain',
      title: bi('Накопительная диаграмма потока', 'The cumulative flow diagram'),
      body: bi(
        '[[method.cfd|Накопительная диаграмма потока]] (cumulative flow diagram, CFD) показывает каждый день, сколько карточек в какой колонке. Колонки складываются полосами одна над другой: снизу «готово», над ней «проверка», выше «разработка» и так далее. Как её читать:\n\n- **вертикальное расстояние** между нижней границей «готово» и верхней границей колонок в работе — это WIP в этот день;\n- **горизонтальное расстояние** между моментом, когда граница работы достигла какой-то высоты, и моментом, когда до той же высоты дошла граница «готово», — примерно время цикла;\n- **расширяющаяся полоса** — колонка, где работа копится: туда приходит больше, чем уходит;\n- **плоская граница «готово»** — до покупателей ничего не доходит.\n\nВ тренажёре ниже — команда из четырёх человек, которой каждое утро приносят две новые задачи. Сначала пройдите несколько дней без лимитов, потом поставьте их и посмотрите, как меняются полосы и время цикла.',
        'A [[method.cfd|cumulative flow diagram]] (CFD) shows, for each day, how many cards are in which column. The columns stack up as bands, one above another: “done” at the bottom, “testing” above it, “development” higher, and so on. How to read it:\n\n- the **vertical distance** between the bottom edge of “done” and the top edge of the in-progress columns is the WIP on that day;\n- the **horizontal distance** between the moment the work edge reached some height and the moment the “done” edge reached the same height is roughly the cycle time;\n- a **widening band** is a column where work piles up: more comes in than goes out;\n- a **flat “done” edge** means nothing reaches the customers.\n\nIn the trainer below a team of four gets two new tasks every morning. First run a few days without limits, then set them and watch how the bands and the cycle time change.',
      ),
    },
    { id: 'practice', kind: 'widget', step: 'practice', widget: 'flowlab.board', props: { scenario: 's1' } },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.little-calc', 'method.q.little-unstable', 'method.q.cfd-band', 'method.q.percentile'] },
  ],
};
