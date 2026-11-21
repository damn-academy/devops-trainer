// Lessons 1–5: why a business needs development and operations together, the
// value stream, the board and pull, work in progress and time, Little's law
// and the cumulative flow diagram (07 §4: MT0–MT2).

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { R, S } from './sources';

const CHECK = bi('Проверьте себя', 'Check yourself');
const P5 = { ext: { flow: { scenario: 'p5' } } };

export const business: Lesson = {
  id: 'methodology.business',
  block: 'methodology',
  title: bi('Зачем бизнесу разработка и эксплуатация', 'Why a business needs development and operations'),
  summary: bi('Что такое продукт, ценность и изменение, почему у разработки и эксплуатации общий результат, но разные цели, и что называют словом DevOps.', 'Product, value and change; two sides of one result; a working definition of DevOps.'),
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
        'В этом курсе мы часто будем просить вас вспомнить и предсказать, а не перечитать. Так учиться медленнее, зато через неделю вы запомните заметно больше. Ошибаться в предсказаниях нормально, это часть работы, и ошибки ни на что не влияют, потому что оценок за ответы и рейтингов в курсе нет.',
        'We will often ask you to recall and to predict rather than to reread. It feels slower, but a week later you remember noticeably more. Wrong predictions are part of the work: they do not count against you, and there are no marks for answers or rankings here.',
      ),
    },
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Небольшой интернет-магазин чая зарабатывает деньги, пока выполняются два условия: сайт работает, и на нём есть то, что нужно покупателям. Каждый час работы сайта приносит магазину в среднем 12 000 рублей. За полчаса этого урока вы разберётесь, почему за эти два условия обычно отвечают два разных отдела, почему эти отделы спорят друг с другом и что с этим спором делают.',
        'A small online tea shop earns money as long as two things hold: the site works, and it has what the customers need. Every hour of work brings about $150. In half an hour you will be able to explain why these two conditions are usually owned by two different departments, why they argue, and what is done about it.',
      ),
    },
    {
      id: 'product',
      kind: 'text',
      step: 'explain',
      levels: ['beginner', 'intermediate'],
      title: bi('Продукт и ценность', 'Product and value'),
      body: bi(
        'Продукт магазина составляют его сайт и всё, что за этим сайтом стоит. [[method.value|Ценностью]] называют то, за что покупатель готов платить: найти нужный чай, оплатить его и вовремя получить.\n\nЛюбую правку продукта мы будем называть **изменением**. Изменения бывают двух видов. **Функция** даёт покупателю новую возможность, например оплату картой, а **исправление дефекта** чинит то, что работает не так, как задумано, например цену в корзине, которая считается неверно. На одной мысли держится весь этот блок: изменение приносит ценность только тогда, когда оно дошло до покупателя. Функция, которая уже готова, но лежит у разработчика, денег не зарабатывает.',
        'The shop’s product is its site together with everything behind it. [[method.value|Value]] is what the customer is ready to pay for: finding the right tea, paying for it and getting it on time.\n\nAny edit to the product we will call a **change**. A change comes in two kinds: a **feature** is a new possibility for the customer (“card payments”), and a **defect fix** repairs something that does not work as intended (“the cart total is wrong”). The idea this whole block rests on: a change brings value only when it reaches the customer. A feature that is ready but sits with a developer earns nothing.',
      ),
    },
    {
      id: 'sides',
      kind: 'text',
      step: 'explain',
      levels: ['beginner', 'intermediate'],
      title: bi('Две стороны одного результата', 'Two sides'),
      body: bi(
        'Изменения делает **разработка**: программисты, тестировщики и аналитики. За тем, чтобы сайт работал, следит [[method.dev-ops|эксплуатация]]. Она выкладывает изменения на **рабочий сайт**, то есть на ту версию сайта, которой пользуются покупатели (по-английски её называют production), следит за серверами и чинит то, что сломалось.\n\nКогда рабочий сайт работает плохо или не работает совсем, это называют [[method.outage|сбоем]]: покупатели не могут оплатить заказ, страница открывается целую минуту или сайт вовсе недоступен. Сбой ещё называют инцидентом. Сбой напрямую стоит магазину денег, ведь каждую минуту, пока сайт недоступен, магазин ничего не продаёт.',
        'Changes are made by **development**: programmers, testers, analysts. Keeping the site running is the job of [[method.dev-ops|operations]]: it deploys changes to **production** (the working site the customers use), watches the servers and fixes what broke.\n\nWhen production works badly or not at all — customers cannot pay, a page takes a minute to open, the site is unreachable — that is an [[method.outage|outage]]. Another word for it is incident. An outage costs money directly: a minute of a shop being down is a minute without sales.',
      ),
    },
    {
      id: 'brief',
      kind: 'text',
      step: 'explain',
      levels: ['experienced'],
      title: bi('Что этот блок даст разработчику', 'What this block gives a developer'),
      body: bi(
        'Если вы уже работаете в разработке, слова этого урока вам знакомы. [[method.value|Ценностью]] здесь называют то, за что платит покупатель, изменением называют новую функцию или исправление дефекта, рабочим сайтом называют production, за которым следит [[method.dev-ops|эксплуатация]], а [[method.outage|сбоем]] называют инцидент на рабочем сайте. Важна одна мысль, на которой держится весь блок: изменение приносит ценность только тогда, когда оно дошло до покупателя.\n\nНовое для разработчика начинается дальше. Урок о том, как связаны объём начатой работы и сроки, и урок о самом медленном этапе дают числовую модель потока работы, по которой на вопрос «когда будет готово» отвечают сроком с уверенностью, а не словом «скоро». Урок о том, как машина собирает, проверяет и выкладывает изменения, даёт точные определения трёх практик, которые часто путают. Следующие два урока дают метрики доставки изменений, цель надёжности и правила, по которым будят дежурного, а урок об инцидентах даёт порядок действий дежурного ночью. Обо всём этом спрашивают на собеседовании на эту должность. Уроки о доске задач, о работе, которую начали, но не закончили, и о гибких методах разработки можно пройти быстро: если вопросы в их конце не вызывают у вас сомнений, переходите к следующему уроку.',
        'If you already work in development, the words of this lesson are familiar. [[method.value|Value]] here is what the customer pays for, a change is a new feature or a defect fix, the working site is production, looked after by [[method.dev-ops|operations]], and an [[method.outage|outage]] is an incident in production. One idea holds the whole block together: a change brings value only once it has reached the customer.\n\nWhat is new for a developer starts later. The lesson on how the amount of started work is linked to dates and the lesson on the slowest stage give a numeric model of the flow of work, so that “when will it be ready” gets a date with a confidence instead of “soon”. The lesson on how a machine builds, checks and deploys changes gives precise definitions of three practices that are often confused. The next two lessons give the delivery metrics, the reliability target and the rules by which the on-call engineer is woken, and the lesson on incidents gives the on-call engineer’s order of actions at night. All of this comes up at interviews for this job. The lessons on the task board, on work that was started but not finished and on flexible development methods can be done quickly: if the questions at their end raise no doubts, move on to the next lesson.',
      ),
    },
    {
      id: 'conflict',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Почему разработка и эксплуатация спорят', 'Why they argue'),
      body: bi(
        'Разработку традиционно оценивают по тому, сколько функций она выпустила, а эксплуатацию по тому, сколько дней сайт проработал без сбоев. Но каждое изменение несёт риск для стабильности: чем чаще и крупнее выкладки, тем больше поводов для сбоя. Поэтому эксплуатации выгодно выкладывать изменения реже и крупными порциями, а разработке выгодно выкладывать чаще. Их цели тянут в разные стороны, хотя результат у них общий, и состоит он в том, что покупатель получил нужное ему на работающем сайте. Авторы «Руководства по DevOps» считают этот конфликт главной причиной того, что изменения доходят до покупателей медленно и при этом всё равно ломают рабочий сайт.',
        'Development has traditionally been judged by how many features it shipped, and operations by how many days passed without an outage. But every change is a risk to stability: the more often and the bigger the deployments, the more chances for an outage. So operations gains from deploying less often and in bigger pieces, and development from deploying more often. Their goals pull in opposite directions, although their result is one: a customer who got what they needed on a working site. The authors of “The DevOps Handbook” call this conflict the main reason why changes reach customers slowly and still break production.',
      ),
    },
    {
      id: 'devops',
      kind: 'text',
      step: 'explain',
      title: bi('Рабочее определение DevOps', 'A working definition'),
      body: bi(
        '[[method.devops|DevOps]] (от английских слов development и operations, то есть разработка и эксплуатация) называют способ работы, при котором разработка и эксплуатация вместе отвечают за общий результат: изменения доходят до покупателей быстро и при этом не ломают сайт. DevOps не должность и не программа. Это договорённость о цели и набор практик, которые помогают этой цели достичь.\n\nПока это определение рабочее. В следующих уроках блока мы разберём, из чего оно складывается: как изменение проходит путь от идеи до покупателя, как работа движется по доске, как проверки и выкладки берёт на себя машина, как ставят цели надёжности и как разбирают сбои. В конце блока мы вернёмся к этому определению и дополним его.',
        '[[method.devops|DevOps]] (from development and operations) is a way of working in which development and operations own one result together: changes reach the customers fast and do not break the site. It is not a job title and not a program; it is an agreement about the goal and a set of practices that make the goal reachable.\n\nFor now this definition is a working one. The next lessons of the block take it apart: the path of a change from an idea to the customer, the flow of work on a board, automated checks and deployments, reliability targets, reviews of outages. At the end of the block we will come back to the definition and complete it.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', levels: ['beginner', 'intermediate'], title: CHECK, items: ['method.q.outage-kind', 'method.q.conflict', 'method.q.value-delivered'] },
    { id: 'exit-exp', kind: 'quiz', step: 'exit', levels: ['experienced'], title: CHECK, items: ['method.q.conflict', 'method.q.value-delivered'] },
  ],
};

export const valueStream: Lesson = {
  id: 'methodology.value-stream',
  block: 'methodology',
  title: bi('Путь задачи от идеи до покупателя', 'The path of a task from an idea to the customer'),
  summary: bi('Через какие этапы проходит задача, где она ждёт между ними и как посчитать, какую долю пути над ней на самом деле работали.', 'Stages, handoffs and waits; the value stream and flow efficiency.'),
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
        'В понедельник покупатели попросили магазин принимать оплату картой, а заработала оплата только через две с половиной недели. Как вы думаете, сколько из этих дней кто-нибудь на самом деле работал над оплатой картой: десять, пять или два? Запомните свой ответ и пройдите путь этой задачи шаг за шагом на схеме ниже.',
        'Customers asked for card payments on a Monday. It works for them two and a half weeks later. How many of those days do you think someone actually worked on card payments: ten, five, two? Remember your answer and walk the path of this task step by step on the diagram below.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как задача идёт от идеи до покупателя', 'How a task goes from an idea to the customer'),
      body: bi(
        'Схема ниже показывает путь карточки «Оплата картой» от просьбы покупателей до работающей функции на сайте. Сначала на ней только идея в левом верхнем углу и покупатели в левом нижнем. Этапы появляются по мере того, как до них доходит карточка: в верхнем ряду отбор и разработка, справа ревью, то есть проверка кода коллегой, и проверка работающей функции тестировщиком, а в нижнем ряду выкладка. Между этапами стоят стрелки, и на каждой стрелке карточка ждёт, пока следующий этап до неё доберётся. Под схемой копятся часы работы, часы ожидания и доля работы во всём пути. Эту долю называют [[method.flow-efficiency|эффективностью потока]], и в разделе после схемы вы научитесь считать её по формуле.',
        'The diagram below shows the path of the card “Card payments” from the customers’ request to a working feature on the site. At first it shows only the idea in the top left corner and the customers in the bottom left. The stages appear as the card reaches them: selection and development in the top row, review and testing on the right, deployment in the bottom row. Between the stages there are arrows, and on each arrow the card waits until the next stage gets to it. Under the diagram the hours of work, the hours of waiting and the share of work in the whole path add up. That share is called [[method.flow-efficiency|flow efficiency]], and in the section after the diagram you will learn a formula for it.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'method.x.value-stream', howto: bi('Сначала пройдите путь карточки до покупателей кнопкой «Шаг вперёд» и сравните итог под схемой со своим ответом из начала урока. Потом проделайте три опыта:\n\n1. Сократите в «Параметрах» ожидание дня выкладки, например с 24 до 4 часов, и посмотрите, на сколько станет короче путь.\n2. Увеличьте число карточек, которые команда ведёт одновременно, и посмотрите, что станет с очередями к ревьюеру и тестировщику.\n3. Включите в блоке «Сломать» поломку, которая убирает этап проверки, и посмотрите, чем заканчивается путь без неё.', 'First walk the card’s path to the customers with “Step forward” and compare the result under the diagram with your answer from the start of the lesson. Then try three experiments:\n\n1. Shorten the wait for the deployment day in “Parameters”, for example from 24 to 4 hours, and see how much shorter the path gets.\n2. Increase the number of cards the team runs at once and see what happens to the queues to the reviewer and the tester.\n3. Switch on the break in “Break it” that removes the test stage, and see how the path ends without it.'),
      caption: bi(
        'Запомните, сколько часов из всего пути заняла работа и где карточка ждала дольше всего. В следующем разделе этот путь получит название, эффективность потока вы научитесь считать по формуле, а в вопросах в конце урока посчитаете её сами и выберете, какое ожидание сокращать первым.',
        'Remember how many hours of the whole path were work and where the card waited longest. In the next section this path gets a name, you will learn a formula for flow efficiency, and in the questions at the end of the lesson you will compute it yourself and choose which wait to cut first.',
      ),
    },
    {
      id: 'stream',
      kind: 'text',
      step: 'explain',
      title: bi('Поток ценности', 'The value stream'),
      body: bi(
        'Путь, который вы только что прошли, называют [[method.value-stream|потоком ценности]]. В него входят все шаги от идеи до покупателя вместе с ожиданиями между ними. В нашем магазине это отбор, разработка, ревью кода, проверка и выкладка. На каждой границе между этапами задача переходит из рук в руки. Такой переход называют **передачей**, и почти на каждой передаче задача ждёт: исполнитель занят другим, выкладывают только по четвергам, а тестировщик один на двух разработчиков.\n\nЕсли сложить часы, станет видно главное: работы на всём этом пути полтора дня, а остальное время задача ждёт. Ожидание никто не планирует и почти никто не замечает, потому что в отчёте каждого отдела всё хорошо и каждый был занят делом.',
        'The path you just walked is called the [[method.value-stream|value stream]]: all the steps from an idea to the customer together with the waits between them. In our shop these are selection, development, review (a colleague checking the code), testing, deployment. At each border between stages the task changes hands; that is a **handoff**, and at almost every handoff the task waits: the person is busy with something else, deployments happen on Thursdays, one tester serves two developers.\n\nAdd up the hours and the main thing becomes visible: there is a day and a half of work on this path, and everything else is waiting. Nobody plans the waiting and almost nobody sees it: in each department’s report all is well, everybody was busy.',
      ),
    },
    {
      id: 'efficiency',
      kind: 'text',
      step: 'explain',
      title: bi('Эффективность потока', 'Flow efficiency'),
      body: bi(
        '[[method.flow-efficiency|Эффективность потока]], то есть долю работы во всём пути, считают так:\n\n```text\nэффективность потока = время работы / (время работы + время ожидания)\n```\n\nНа нашем пути работа заняла 12 часов из 96, то есть 12,5 %. Отсюда практическое правило, которым пользуются, когда улучшают процесс: чтобы задачи доходили до покупателей быстрее, сначала ищут самое долгое ожидание, а не заставляют людей работать быстрее. Если сократить ожидание дня выкладки с суток до часа, каждая задача дойдёт до покупателей почти на три рабочих дня раньше, и никому не придётся работать ни часом больше.',
        '[[method.flow-efficiency|Flow efficiency]], the share of work in the whole path, is computed like this:\n\n```text\nflow efficiency = work time / (work time + waiting time)\n```\n\nOn our path that is 12 hours out of 96, or 12.5%. Hence a practical rule used when improving a process: to get tasks to customers faster, first look for the longest wait instead of making people work faster. Shortening the deployment window from a day to an hour takes almost three working days off every task without a single extra hour of work.',
      ),
    },
    {
      id: 'note',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      body: bi(
        'На схеме выкладка занимает один шаг, и эксплуатация делает её руками. Позже, в уроке о том, как машина собирает, проверяет и выкладывает изменения, тот же путь станет короче, потому что часть ожиданий исчезнет, когда сборку, проверки и выкладку возьмёт на себя машина.',
        'On the diagram, deployment is one step done by hand by operations. Later, in the lesson on how a machine builds, checks and deploys changes, the same path gets shorter: some of the waits disappear when a machine takes over the build, the checks and the deployment.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.flow-efficiency', 'method.q.longest-wait', 'method.q.path-order'] },
  ],
};

export const board: Lesson = {
  id: 'methodology.board',
  block: 'methodology',
  title: bi('Как карточка и доска делают работу видимой', 'How the card and the board make work visible'),
  summary: bi('Карточка с критерием готовности, доска с колонками по этапам, вытягивание вместо раздачи задач и цена переключения между задачами.', 'A card with a definition of done, a board by stages, pull and the price of switching between tasks.'),
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
        'Задачи команды магазина разбросаны по общему чату: «сделай скидку», «а что с оплатой?», «напомни, мы начали фильтр?». Чтобы узнать, что уже начато, что ждёт и что готово, приходится перечитывать сотню сообщений. Поэтому первый шаг любого метода управления потоком работы состоит в том, чтобы сделать эту работу видимой.',
        'The shop team’s tasks are scattered over a group chat: “do the discount”, “what about payments?”, “remind me, did we start the filter?”. To find out what is started, what waits and what is done, you have to reread a hundred messages. That is why the first step of any flow method is to make the work visible.',
      ),
    },
    {
      id: 'board',
      kind: 'text',
      step: 'explain',
      title: bi('Карточка и доска', 'The card and the board'),
      body: bi(
        'Каждая задача становится **карточкой**. У карточки есть название и критерий готовности, то есть проверяемое условие, по которому все поймут, что задача закончена: «готово, когда покупатель может оплатить заказ картой». Карточки висят на [[method.board|доске]], а колонки доски соответствуют этапам пути из прошлого урока: «готово к работе», «разработка», «проверка» и «готово». Колонка этапа делится на две части, «в работе» и «готово». Благодаря этому видно не только то, над чем сейчас работают, но и то, что уже сделано и ждёт следующего этапа.\n\nСама по себе доска ничего не ускоряет. Зато она отвечает на вопрос, на который чат ответить не может: где сейчас каждая задача и где задачи скапливаются.',
        'Each task becomes a **card**: it has a name and a definition of done, a checkable condition for when the task is finished (“done when a customer can pay by card”). Cards hang on a [[method.board|board]]. The board’s columns are the stages of the path from the previous lesson: ready, development, testing, done. A stage column is split into two parts, “doing” and “done”, so you see not only what is being worked on but also what is finished and waits for the next stage.\n\nA board does not speed anything up by itself. It answers the question a chat cannot answer: where each task is right now, and where tasks pile up.',
      ),
    },
    {
      id: 'pull',
      kind: 'text',
      step: 'explain',
      title: bi('Вытягивание', 'Pull'),
      body: bi(
        'Работу людям можно давать двумя способами. При **выталкивании** задачу отдают исполнителю, как только она появилась: «вот ещё одна, начни, пожалуйста». При [[method.pull|вытягивании]] новую задачу берут тогда, когда для неё освободилось место: закончил одну задачу и взял следующую из колонки слева.\n\nВытягивание кажется медленнее, ведь задача ждёт. Но она ждёт в очереди, где ничего не стоит, а не в работе, где отнимает у человека внимание. К тому же вытягивание делает очереди видимыми: если перед проверкой скопились карточки, это видно на доске, а не только по усталости тестировщика.',
        'There are two ways to give people work. With **push**, a task is handed over as soon as it appears: “here is one more, please start it”. With a [[method.pull|pull system]], a new task is taken when there is room for it: you finished one, you take the next from the column on the left.\n\nPull looks slower, since the task waits. But it waits in a queue, where it costs nothing, not in progress, where it takes up attention. Pull makes queues visible: when cards gather in front of testing, you see it on the board, not only in the tester’s tiredness.',
      ),
    },
    {
      id: 'switch',
      kind: 'text',
      step: 'explain',
      title: bi('Цена переключения между задачами', 'The price of switching'),
      body: bi(
        'Если у человека начато несколько задач, часть его времени уходит на [[method.switching|переключение между задачами]]: нужно вспомнить, где остановился, и заново собрать в голове всю картину. Джеральд Вайнберг в книге «Quality Software Management» оценил, сколько времени при этом остаётся на полезную работу:\n\n- при одной задаче 100 %;\n- при двух 80 %;\n- при трёх 60 %;\n- при четырёх 40 %;\n- при пяти и больше 25 %.\n\nОставшееся время к тому же делится между задачами. Объём работы в тренажёре меряют очками, и это мера работы, а не оценка за ваши решения. Допустим, у разработчика шесть задач, а за день он может сделать работу на 3 очка. Тогда на каждую задачу в день приходится 3 × 0,25 / 6 = 0,125 очка, и задача размером в 3 очка будет готова через 24 дня. Если бы он делал задачи по одной, каждая была бы готова за день. Цифры Вайнберга — оценка, полученная из практики, а не закон природы, но в тренажёре ниже они служат правилом модели.',
        'A person with several started tasks loses part of the time on [[method.switching|context switching]]: remembering where they stopped, rebuilding the whole context in their mind. In “Quality Software Management” Gerald Weinberg estimated how much time is left for useful work:\n\n- one task: 100%;\n- two: 80%;\n- three: 60%;\n- four: 40%;\n- five or more: 25%.\n\nWhat is left is also split between the tasks. The trainer measures work in points, a measure of work rather than a score for your decisions. If a developer has six tasks and a capacity of 3 points of work a day, each gets 3 × 0.25 / 6 = 0.125 points. A 3-point task will be ready in 24 days, while one at a time each would be ready in a day. Weinberg’s figures are an estimate from practice, not a law of nature; in the trainer below they are a rule of the model.',
      ),
    },
    {
      id: 'practice-howto',
      kind: 'text',
      role: 'howto',
      step: 'practice',
      title: bi('Как работать с тренажёром', 'How to use the trainer'),
      body: bi(
        'В тренажёре у вас один разработчик, на доске он подписан DEV-1. Сейчас перед ним шесть задач, а на второй день владелец продукта пришлёт служебную записку и добавит ещё шесть. Мощность разработчика каждый день одна и та же, 3 очка, и случайностей в этом прогоне нет. Карточку в работу вытягивают перетаскиванием в следующую колонку или нажимают на неё и потом на стрелку, а кнопка «Закончить день» переводит доску на следующий день. Цель выполнена, если к концу восьмого дня у покупателей не меньше шести готовых задач. Деньги, которые магазин недополучает, пока задача ждёт, в этом прогоне не считают, поэтому счётчик потерь от задержки остаётся на нуле, а деньги появятся в тренажёрах следующих уроков.',
        'The trainer has one developer, marked DEV-1 on the board. There are six tasks in front of them now, and on day 2 the product owner sends a memo and adds six more. The developer’s capacity is the same every day, 3 points, and there is no randomness in this run. A card is pulled into work by dragging it into the next column or by pressing it and then its arrow, and the “End the day” button moves the board to the next day. The goal is met if at least six finished tasks are with the customers by the end of day 8. The money the shop misses while a task waits is not counted in this run, so the cost-of-delay counter stays at zero; money comes in the trainers of the next lessons.',
      ),
    },
    {
      id: 'practice',
      kind: 'widget',
      step: 'practice',
      widget: 'flowlab.board',
      props: { scenario: 's0' },
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.pull-why', 'method.q.weinberg', 'method.q.board-visible'] },
  ],
};

export const flow: Lesson = {
  id: 'methodology.flow',
  block: 'methodology',
  title: bi('Незавершённая работа и время', 'Work in progress and time'),
  summary: bi('Что такое незавершённая работа и зачем её ограничивать, чем время цикла отличается от времени выполнения, что показывают пропускная способность и возраст карточки.', 'Work in progress and its limit; cycle time and lead time; throughput and work item age.'),
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
        'Владелец бизнеса задаёт команде два вопроса: «Когда будет готово?» и «Сколько вы успеваете сделать?». На первый вопрос обычно отвечают «скоро», на второй отвечают «много». В этом уроке вы узнаете три величины, которые превращают такие ответы в числа.',
        'The business owner asks the team two questions: “When will it be ready?” and “How much do you get done?”. The usual answers are “soon” and “a lot”. This lesson gives three quantities that turn those answers into numbers.',
      ),
    },
    {
      id: 'wip',
      kind: 'text',
      step: 'explain',
      title: bi('Незавершённая работа и её лимит', 'Work in progress'),
      body: bi(
        '[[method.wip|Незавершённой работой]] (по-английски work in progress, сокращённо WIP) называют карточки, которые уже начаты, но ещё не закончены. На доске это всё, что стоит между колонкой «готово к работе» и колонкой «готово».\n\n**Лимит WIP** говорит, сколько карточек может одновременно находиться в колонке, считая обе её части, «в работе» и «готово». Если лимит исчерпан, новую карточку в колонку не вытягивают, пока одна из тех, что уже стоят в ней, не уйдёт дальше. Быстрее люди от лимита работать не станут. Лимит лишь не даёт начинать новое, пока не закончено старое, поэтому переключений становится меньше, очереди короче, и каждая карточка проходит путь быстрее. Для начала лимит обычно ставят равным числу людей на этапе плюс один.',
        '[[method.wip|Work in progress]] (WIP) is the cards that are started but not finished yet. On the board it is everything between the “ready” column and the “done” column.\n\nA **WIP limit** is how many cards a column may hold at once, counting both its parts, “doing” and “done”. When the limit is used up, no new card is pulled into the column until one of those in it moves on. A limit does not make people faster. It stops new work from starting until old work is finished: fewer switches, shorter queues, and so each card gets through faster. A good starting point is the number of people on the stage plus one.',
      ),
    },
    {
      id: 'time',
      kind: 'text',
      step: 'explain',
      title: bi('Время цикла, время выполнения и пропускная способность', 'Time and output'),
      body: bi(
        '[[method.cycle-time|Временем цикла]] называют время от начала работы над карточкой до её готовности. Если карточку начали в понедельник и закончили в среду, её время цикла равно трём дням, потому что дни считают включительно. **Время выполнения** (lead time) шире: его считают с того момента, когда карточка появилась в очереди «готово к работе», и до её готовности. Покупатель ощущает на себе время выполнения, а команда управляет временем цикла.\n\n[[method.throughput|Пропускная способность]] показывает, сколько карточек система заканчивает за единицу времени, например полторы карточки в день. **Возраст карточки** показывает, сколько дней начатая, но ещё не законченная карточка находится в работе. Возраст важен потому, что время цикла становится известно только в конце, а возраст виден каждый день. Если карточка уже старше, чем обычно бывают карточки этой команды, вмешиваться нужно сейчас, не дожидаясь конца.',
        '[[method.cycle-time|Cycle time]] is the time from the start of work on a card to the moment it is done. A card started on Monday and finished on Wednesday has a cycle time of three days (counting the days inclusively). **Lead time** is wider: from the moment the card appeared in the “ready” queue until it is done. The customer feels lead time; the team manages cycle time.\n\n[[method.throughput|Throughput]] is how many cards the system finishes per unit of time, for example 1.5 a day. **Work item age** is how many days a started but unfinished card has been in progress. Age matters because cycle time is known only at the end, while age is visible every day: a card already older than usual is a signal to step in now.',
      ),
    },
    {
      id: 'kanban-guide-help',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      levels: ['beginner'],
      title: bi('Как читать английское руководство', 'How to read the English guide'),
      body: bi(
        'Kanban Guide написан по-английски, поэтому вот перевод названий его разделов. Definition of Kanban означает «что такое Kanban», Definition of Workflow означает «определение потока», а Flow Measures означает «метрики потока». Фраза «four mandatory flow measures», которую вы встретите в одном из разделов, переводится как «четыре обязательные метрики потока».',
        'The Kanban Guide is written in English, so here is what its section titles mean. Definition of Kanban is what Kanban is, Definition of Workflow is the definition of the flow, and Flow Measures are the measures of the flow. The phrase “four mandatory flow measures”, which you will meet in one of the sections, means the four measures every Kanban team must track.',
      ),
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi(
        'Эти определения взяты из Kanban Guide, короткого руководства, которое написали авторы метода. Откройте его и найдите раздел, где перечислены четыре обязательные метрики потока. Нажмите на этот раздел.',
        'These definitions come from the Kanban Guide, a short guide by the authors of the method. Open it and find the section that lists the four mandatory flow measures. Click that section.',
      ),
      ref: { page: 'web/kanbanguides.org/kanban-guide' },
      answer: 'MEASURES',
    },
    {
      id: 'find',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi(
        'В терминале запущена маленькая доска, с ней работает команда `flow`. Найдите в странице руководства этой команды (`man flow`), как поставить лимит WIP, и поставьте колонке «Анализ» (analysis) лимит 2. Доска учебная, и сломать её нельзя: если ошибётесь, введите команду ещё раз с другим числом.',
        'A small board runs in the terminal: the `flow` command. Find in its manual page (`man flow`) how to set a WIP limit, and give the Analysis column a limit of 2. This is a training board and cannot be broken: if you make a mistake, enter the command again with another number.',
      ),
      ref: { page: 'man/flow.1', anchor: 'OPTIONS', line: 'wip COLUMN N' },
      terminal: {
        setup: { ext: { flow: { scenario: 'p5' } } },
        task: {
          id: 'wip2',
          prompt: bi('Поставьте колонке analysis лимит WIP, равный 2.', 'Give the analysis column a WIP limit of 2.'),
          check: { when: 'flow.policies.wip.analysis=2', fail: [{ if: 'flow.policies.wip.analysis>2', say: bi('Лимит поставлен, но он больше двух.', 'A limit is set, but it is higher than two.') }] },
          docStep: 3,
          chips: 'flow wip analysis 2',
          concepts: ['method.wip'],
          hints: { H1: bi('Команда, которая ставит лимит, начинается со слова `flow` и названия настройки.', 'The command for a limit starts with `flow` and the name of the setting.'), H2: bi('Нужное описание есть в разделе OPTIONS страницы `man flow`, в строке, которая начинается со слова wip.', 'The OPTIONS section of `man flow`, the line that starts with wip.'), H3: bi('Наберите `flow wip analysis 2` и нажмите Enter.', 'Type `flow wip analysis 2` and press Enter.') },
        },
      },
    },
    {
      id: 'practice-wip',
      kind: 'terminal',
      step: 'practice',
      levels: ['beginner', 'intermediate'],
      machine: 'sim',
      setup: P5,
      intro: bi(
        'Ниже та же учебная доска на пять дней, что и в задании выше: четыре человека, четырнадцать одинаковых задач, и каждое утро автопилот сам вытягивает карточки в работу, пока в колонке есть место. Мощность у людей каждый день одна и та же, поэтому результат прогона зависит только от лимитов. За несколько минут вы прогоните доску дважды, без лимитов и с лимитами, и сравните итог.\n\nДоска отвечает по-английски. В выводе команды `flow metrics` строка `done (delivered)` показывает, сколько задач готово, строка `wip average` показывает, сколько карточек в среднем было в работе одновременно, а строка `cycle time p50 (d)` показывает время цикла: половина готовых карточек прошла путь от начала работы до готовности не дольше этого числа дней. Если команда ответит сообщением об ошибке, ничего не сломалось: доска не приняла решение и написала, почему.',
        'Below is the same five-day training board as in the task above: four people, fourteen equal tasks, and every morning the autopilot pulls cards into work by itself while a column has room. People’s capacity is the same every day, so the result of the run depends only on the limits. In a few minutes you will run the board twice, without limits and with them, and compare the result.\n\nThe board answers in English. In the output of `flow metrics` the line `done (delivered)` shows how many tasks are done, `wip average` shows how many cards were in progress at once on average, and `cycle time p50 (d)` shows cycle time: half of the finished cards went from the start of work to done in no more than this number of days. If a command answers with an error message, nothing is broken: the board did not accept the decision and wrote why.',
      ),
      tasks: [
        {
          id: 'jam',
          prompt: bi('Прогоните пять дней без лимитов командой `flow next 5`, а потом посмотрите на итог командой `flow metrics`. Запомните, сколько задач готово и сколько карточек в среднем было в работе.', 'Run five days without limits with `flow next 5`, then look at the result with `flow metrics`. Remember how many tasks are done and how many cards were in progress on average.'),
          check: {
            when: 'flow.daysDone>=5 && flow.done.count=0',
            stdout: 'done (delivered)',
            fail: [
              { if: 'flow.daysDone>=5 && flow.done.count>0', say: bi('Вы прогнали дни уже с лимитами, поэтому пробки не увидели. Наберите `flow reset`: доска вернётся к первому дню без лимитов. Потом прогоните пять дней ещё раз.', 'You ran the days with limits already, so you did not see the jam. Type `flow reset`: the board goes back to day 1 without limits. Then run five days again.') },
              { if: 'flow.daysDone>=5', say: bi('Пять дней прошли, и теперь осталось посмотреть на итог командой `flow metrics`.', 'Five days are over. Now look at the result with `flow metrics`.') },
            ],
          },
          chips: 'flow next 5',
          concepts: ['method.wip'],
          hints: {
            H1: bi('Команда `flow next` заканчивает рабочий день, а число после неё говорит, сколько дней закончить подряд.', '`flow next` ends the working day, and the number after it says how many days to end in a row.'),
            H2: bi('Когда пять дней пройдут, найдите в выводе `flow metrics` строки `done (delivered)` и `wip average`.', 'When the five days are over, find the lines `done (delivered)` and `wip average` in the output of `flow metrics`.'),
            H3: bi('Наберите `flow next 5`, а потом `flow metrics`.', 'Type `flow next 5`, then `flow metrics`.'),
          },
        },
        {
          id: 'limits',
          prompt: bi('Верните доску к первому дню командой `flow reset` и поставьте всем трём колонкам лимиты по правилу из урока: число людей на этапе плюс один. В колонке `analysis` работает один человек, в колонке `dev` двое, в колонке `test` один. Лимит ставит команда вида `flow wip dev 3`.', 'Take the board back to day 1 with `flow reset` and give all three columns limits by the rule of the lesson: the number of people on the stage plus one. One person works in `analysis`, two in `dev`, one in `test`. A limit is set with a command like `flow wip dev 3`.'),
          check: {
            when: 'flow.policies.wip.analysis>=1 && flow.policies.wip.dev>=1 && flow.policies.wip.test>=1',
            fail: [{ if: 'flow.policies.wip.analysis>=1 || flow.policies.wip.dev>=1 || flow.policies.wip.test>=1', say: bi('Лимит стоит не у всех колонок. Наберите `flow status`: у колонки с лимитом рядом с числом карточек написано, например, `0/2`, а у колонки без лимита дроби нет.', 'Not every column has a limit. Type `flow status`: a column with a limit shows, for example, `0/2` next to its card count, and a column without one has no fraction.') }],
          },
          chips: 'flow wip analysis 2',
          concepts: ['method.wip'],
          hints: {
            H1: bi('Людей на этапе видно в квадратных скобках в выводе `flow status`: `[PO]` в analysis, `[DEV-1,DEV-2]` в dev, `[QA]` в test.', 'The people on a stage are shown in square brackets in `flow status`: `[PO]` in analysis, `[DEV-1,DEV-2]` in dev, `[QA]` in test.'),
            H2: bi('По правилу «люди плюс один» получается 2 для analysis, 3 для dev и 2 для test.', 'By the rule “people plus one” that is 2 for analysis, 3 for dev and 2 for test.'),
            H3: bi('Наберите по очереди `flow reset`, `flow wip analysis 2`, `flow wip dev 3` и `flow wip test 2`.', 'Type in turn `flow reset`, `flow wip analysis 2`, `flow wip dev 3` and `flow wip test 2`.'),
          },
        },
        {
          id: 'flow',
          prompt: bi('Прогоните пять дней с лимитами и снова посмотрите `flow metrics`. Цель выполнена, если готово не меньше шести задач. Сравните три строки с первым прогоном.', 'Run five days with the limits and look at `flow metrics` again. The goal is met if at least six tasks are done. Compare the three lines with the first run.'),
          check: {
            when: 'flow.daysDone>=5 && flow.done.count>=6',
            stdout: 'done (delivered)',
            fail: [
              { if: 'flow.daysDone>=5 && flow.done.count=0 && flow.policies.wip.analysis>=1', say: bi('Лимиты стоят, но ни одна задача не готова. Так бывает, если поставить лимиты, когда автопилот уже затянул в работу все карточки: лимит не возвращает начатые карточки назад, он только не даёт начинать новые. Начните заново командой `flow reset`, сначала поставьте лимиты, а потом прогоните дни.', 'The limits are set, but no task is done. This happens when the limits come after the autopilot has already pulled every card into work: a limit does not send started cards back, it only stops new ones from starting. Start again with `flow reset`, set the limits first, then run the days.') },
              { if: 'flow.daysDone>=5 && flow.done.count<6 && (flow.policies.wip.analysis>2 || flow.policies.wip.dev>3 || flow.policies.wip.test>2)', say: bi('Готовых задач больше, чем без лимитов, но меньше шести. Лимиты великоваты: у одного человека оказалось несколько карточек сразу, и часть его времени ушла на переключение между ними. Начните заново командой `flow reset` и поставьте лимиты по правилу «люди плюс один».', 'More tasks are done than without limits, but fewer than six. The limits are too big: one person got several cards at once and lost part of the time switching between them. Start again with `flow reset` and set the limits by the rule “people plus one”.') },
              { if: 'flow.daysDone>=5 && flow.done.count<6 && (flow.policies.wip.analysis<2 || flow.policies.wip.dev<2 || flow.policies.wip.test<2)', say: bi('Готовых задач меньше шести, потому что лимиты слишком малы. Законченная карточка занимает место в колонке, пока её не заберёт следующий этап, поэтому при лимите, равном числу людей, человеку некуда взять новую карточку. Для этого к числу людей и прибавляют единицу. Начните заново командой `flow reset` и поставьте лимиты по правилу «люди плюс один».', 'Fewer than six tasks are done because the limits are too small. A finished card takes up room in the column until the next stage takes it, so with a limit equal to the number of people a person has nowhere to take a new card. That is why one is added to the number of people. Start again with `flow reset` and set the limits by the rule “people plus one”.') },
              { if: 'flow.daysDone>=5 && flow.done.count<6 && (flow.policies.wip.analysis>=1 || flow.policies.wip.dev>=1 || flow.policies.wip.test>=1)', say: bi('Готовых задач меньше шести. Проверьте командой `flow status`, какие лимиты стоят у колонок, потом начните заново командой `flow reset` и поставьте лимиты по правилу «люди плюс один» до того, как закончите первый день.', 'Fewer than six tasks are done. Check the column limits with `flow status`, then start again with `flow reset` and set the limits by the rule “people plus one” before you end the first day.') },
              { if: 'flow.daysDone>=5 && flow.done.count>=6', say: bi('Шесть задач готовы, и осталось посмотреть на итог командой `flow metrics`, чтобы сравнить его с первым прогоном.', 'Six tasks are done. Look at the result with `flow metrics` and compare it with the first run.') },
            ],
          },
          chips: 'flow next 5',
          concepts: ['method.wip', 'method.cycle-time', 'method.throughput'],
          hints: {
            H1: bi('Лимиты уже стоят, и осталось закончить пять дней.', 'The limits are set; what is left is to end five days.'),
            H2: bi('Если готово меньше шести задач, проверьте командой `flow status`, какие лимиты стоят у колонок.', 'If fewer than six tasks are done, check the column limits with `flow status`.'),
            H3: bi('Наберите `flow next 5`, а потом `flow metrics`.', 'Type `flow next 5`, then `flow metrics`.'),
          },
        },
      ],
    },
    { id: 'exit-practice', kind: 'quiz', step: 'exit', levels: ['beginner', 'intermediate'], title: bi('Что показала доска', 'What the board showed'), items: ['method.q.practice-wip'] },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.cycle-vs-lead', 'method.q.wip-limit-count', 'method.q.age'] },
  ],
};

export const little: Lesson = {
  id: 'methodology.little',
  block: 'methodology',
  title: bi('Закон Литтла и накопительная диаграмма', 'Little’s law and the cumulative flow diagram'),
  summary: bi('Как связаны незавершённая работа, пропускная способность и время цикла, почему сроки обещают по 85-му процентилю и как читать накопительную диаграмму потока.', 'How work in progress, output and time are linked; the 85th percentile as a promise; how to read a cumulative flow diagram.'),
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
        'В колонках «в работе» у команды в среднем 12 карточек, а заканчивает она в среднем 3 карточки в день. Сколько дней в среднем проходит от начала работы над карточкой до её готовности? Такую задачу дают и на собеседованиях, потому что по ответу видно, понимает ли человек, откуда берутся сроки. Прикиньте ответ, прежде чем читать дальше.',
        'On average the team has 12 cards in its “doing” columns. It finishes 3 cards a day on average. How many days on average pass from the start of work on a card until it is done? This is also asked at interviews, because the answer shows whether a person understands where deadlines come from. Estimate the answer before you read on.',
      ),
    },
    {
      id: 'little',
      kind: 'text',
      step: 'explain',
      title: bi('Закон Литтла', 'Little’s law'),
      body: bi(
        'Ответ равен четырём дням. Его даёт [[method.little|закон Литтла]]: Джон Литтл доказал его в 1961 году для очередей, а для потока работы закон записывают так:\n\n```text\nсредняя незавершённая работа = пропускная способность × среднее время цикла\nсреднее время цикла = средняя незавершённая работа / пропускная способность\n```\n\nДвенадцать делим на три и получаем четыре. Отсюда главный вывод: если пропускная способность прежняя, а начатой работы вдвое больше, то и каждая карточка идёт вдвое дольше. Начинать больше не значит заканчивать больше.\n\nЗакон работает, пока система стабильна, то есть пока незавершённой работы не становится день ото дня больше. Если она всё время растёт, равенство не выполняется, и тогда сначала останавливают этот рост, а считают уже потом.',
        'The answer is 4 days, and it comes from [[method.little|Little’s law]], proved by John Little in 1961 for queues and stated for a flow of work like this:\n\n```text\naverage WIP = throughput × average cycle time\naverage cycle time = average WIP / throughput\n```\n\n12 / 3 = 4. Hence the main conclusion: with the same throughput, twice as much started work means twice as long for every card. Starting more does not mean finishing more.\n\nThe law holds while the system is stable, that is, while the work in progress does not grow from day to day. If it keeps growing, the equality does not hold, and then the growth is stopped first and the calculation comes later.',
      ),
    },
    {
      id: 'little-conditions',
      kind: 'text',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Условия закона Литтла', 'The conditions of Little’s law'),
      body: bi(
        'Дэниел Ваканти подчёркивает для потока работы три условия закона. Всё начатое когда-нибудь заканчивается, незавершённой работы в начале и в конце периода примерно поровну, а средний возраст карточек не растёт. Если хотя бы одно условие нарушено, время цикла, посчитанное по формуле, расходится с временем цикла законченных карточек, и верить тогда нужно законченным карточкам.',
        'Daniel Vacanti stresses three conditions of the law for a flow of work: everything started eventually finishes; there is about as much work in progress at the start of the period as at its end; the average age of cards does not grow. If any of them is broken, the cycle time from the formula differs from the cycle time of finished cards, and then the finished cards are what to trust.',
      ),
    },
    {
      id: 'percentile',
      kind: 'text',
      step: 'explain',
      title: bi('Как обещать срок с уверенностью', 'A promise with confidence'),
      body: bi(
        'Для обещаний среднее не годится. У времени цикла длинный хвост: несколько очень долгих карточек тянут среднее вверх, и всё равно заметная часть карточек, обычно около трети, идёт дольше среднего. Поэтому сроки обещают по процентилю. Отсортируйте времена цикла последних 20 карточек по возрастанию. Семнадцатое значение в этом ряду и есть [[method.percentile|85-й процентиль]]: 85 % карточек шли не дольше его. Если оно равно 8 дням, владельцу бизнеса можно уверенно сказать: «85 задач из 100 таких мы заканчиваем за 8 дней или быстрее». Середину того же ряда называют медианой, или 50-м процентилем: дольше медианы идёт половина карточек.',
        'An average is no good for promises. Cycle time has a long tail: a few very long cards pull the average up, and still a noticeable share of the cards, usually about a third, take longer than average. That is why deadlines are promised by a percentile. Sort the cycle times of the last 20 cards in ascending order: the seventeenth value is the [[method.percentile|85th percentile]] — 85% of the cards took no longer than that. If it equals 8 days, you can confidently tell the business owner: “85 out of 100 such tasks we finish in 8 days or less.” The middle of the same series is called the median (the 50th percentile): half of the cards take longer than the median.',
      ),
    },
    {
      id: 'cfd-beginner',
      kind: 'text',
      step: 'explain',
      levels: ['beginner'],
      title: bi('Как читать накопительную диаграмму потока', 'How to read the cumulative flow diagram'),
      body: bi(
        'В тренажёре ниже вам встретится [[method.cfd|накопительная диаграмма потока]]. Она показывает, сколько карточек лежало в каждой колонке доски в каждый день. Колонки сложены на ней цветными полосами одна над другой, и внизу лежит полоса «готово». Чтобы понять, что происходит с потоком, достаточно двух признаков. Если какая-то полоса день ото дня становится шире, в этой колонке копится работа, потому что туда приходит больше, чем уходит. Если нижняя граница полосы «готово» перестала подниматься, значит, до покупателей ничего не доходит.',
        'In the trainer below you will meet a [[method.cfd|cumulative flow diagram]]. It shows how many cards were in each column of the board on each day. The columns are stacked on it as coloured bands, one above another, with the “done” band at the bottom. Two signs are enough to understand what is happening to the flow. If a band gets wider day after day, work is piling up in that column, because more comes in than goes out. If the top edge of the “done” band stops rising, nothing is reaching the customers.',
      ),
    },
    {
      id: 'cfd',
      kind: 'text',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Как читать накопительную диаграмму потока', 'The cumulative flow diagram'),
      body: bi(
        '[[method.cfd|Накопительная диаграмма потока]] (cumulative flow diagram, CFD) показывает, сколько карточек лежало в каждой колонке в каждый день. Колонки сложены на ней полосами одна над другой: внизу «готово», над ней «проверка», выше «разработка» и так далее. Читают диаграмму так:\n\n- **расстояние по вертикали** между верхней границей полосы «готово» и верхней границей колонок в работе равно WIP в этот день;\n- **расстояние по горизонтали** между днём, когда верхняя граница колонок в работе поднялась до какой-то высоты, и днём, когда до той же высоты дошла верхняя граница «готово», примерно равно времени цикла;\n- **расширяющаяся полоса** означает колонку, в которой копится работа, потому что туда приходит больше, чем уходит;\n- **горизонтальная граница «готово»** означает, что до покупателей ничего не доходит.',
        'A [[method.cfd|cumulative flow diagram]] (CFD) shows, for each day, how many cards are in which column. The columns stack up as bands, one above another: “done” at the bottom, “testing” above it, “development” higher, and so on. How to read it:\n\n- the **vertical distance** between the top edge of “done” and the top edge of the in-progress columns is the WIP on that day;\n- the **horizontal distance** between the moment the work edge reached some height and the moment the “done” edge reached the same height is roughly the cycle time;\n- a **widening band** is a column where work piles up: more comes in than goes out;\n- a **flat “done” edge** means nothing reaches the customers.',
      ),
    },
    {
      id: 'practice-howto',
      kind: 'text',
      role: 'howto',
      step: 'practice',
      title: bi('Как работать с тренажёром', 'How to use the trainer'),
      body: bi(
        'В тренажёре команда из четырёх человек: владелец продукта (на доске он подписан PO) разбирает задачи, двое разработчиков (DEV-1 и DEV-2) пишут код, тестировщик (QA) проверяет. Каждое утро приходят две новые задачи, а сколько работы каждый успеет за день, решает бросок кубика от 1 до 6. Сначала пройдите несколько дней без лимитов и посмотрите, как растут полосы на диаграмме. Потом нажмите кнопку «сначала», поставьте колонкам лимиты кнопками «−» и «+» и сравните время цикла. Если отметить галочку «строгие лимиты», доска не даст вытянуть карточку в колонку сверх лимита, а без неё лимит только подсвечивает переполнение.\n\nНа карточках написано, сколько рублей в день магазин недополучает, пока задача не дошла до покупателей. Подробно об этих деньгах и о том, как по ним выбирать порядок работы, пойдёт речь через два урока. Тренажёр одновременно проводит на тех же бросках кубика прогон «без методологии», в котором нет лимитов и всё срочное сразу берут в работу. Цель выполнена, если 85-й процентиль времени цикла и потери от задержки у вас ниже, чем в этом прогоне. Разбор в конце покажет рядом ваши числа, числа прогона «без методологии» и числа эталонной команды. Эталонная команда работает по правилам всего блока, в том числе по тем, которые вы пройдёте в следующих уроках, поэтому отставание от неё на этом уроке ожидаемо и на выполнение цели не влияет.',
        'The trainer has a team of four: the product owner (marked PO on the board) analyses the tasks, two developers (DEV-1 and DEV-2) write the code, and a tester (QA) checks it. Two new tasks arrive every morning, and how much work each person gets done in a day is decided by a roll of a die from 1 to 6. First go through a few days without limits and watch the bands on the diagram grow. Then press “restart”, give the columns limits with the “−” and “+” buttons and compare the cycle time. With the “strict limits” box ticked the board will not let you pull a card into a column beyond its limit; without it the limit only highlights the overflow.\n\nThe cards show how many rubles a day the shop loses while the task has not reached the customers. How to choose the order of work by this money is covered in detail two lessons later. On the same dice the trainer also plays a “baseline” run with no limits, where everything urgent goes straight into work. The goal is met if your 85th percentile of cycle time and your losses from delay are lower than in that run. The debrief at the end shows your numbers, the baseline’s and those of a reference team side by side. The reference team works by the rules of the whole block, including those you will learn in the next lessons, so falling behind it in this lesson is expected and does not affect whether the goal is met.',
      ),
    },
    { id: 'practice', kind: 'widget', step: 'practice', widget: 'flowlab.board', props: { scenario: 's1' } },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.little-calc', 'method.q.little-unstable', 'method.q.cfd-band', 'method.q.percentile'] },
  ],
};
