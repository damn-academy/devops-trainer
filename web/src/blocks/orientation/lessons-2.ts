// Orientation, lessons 6–10: the cloud, source code and versions,
// environments and configuration, working on code together, and the roles
// of an IT team (01 §6.2: F08–F12, plus the cloud and the roles).

import { bi, pluralRu } from '../../core/i18n';
import { ROUTE } from '../../core/route';
import type { Facts, Lesson, Level, QuizItem } from '../../core/types';
import { APP_SH, EN, man, project, RU, settings, sources, twoCopies } from './shared';

// ── 6. The cloud ───────────────────────────────────────────────────────────

export const rentQuiz: QuizItem[] = [
  {
    id: 'orient.q.cloud-is',
    kind: 'mcq',
    key: true,
    concepts: ['orient.cloud'],
    prompt: bi('Что на самом деле стоит за словами «запустим это в облаке»?', 'What really stands behind the words “let us run it in the cloud”?'),
    options: [
      { id: 'rent', text: bi('Чужие серверы в чужом дата-центре, которые берут напрокат и оплачивают по часам', 'Somebody else’s servers in somebody else’s data centre, hired and paid for by the hour'), correct: true },
      { id: 'air', text: bi('Программы, которые работают в интернете сами по себе, без всяких компьютеров', 'Programs that run without any computers, right in the internet'), why: bi('Любая программа работает на чьём-то компьютере. В облаке этот компьютер не ваш и стоит не у вас.', 'Every program runs on someone’s computer. In the cloud it is simply not yours and stands somewhere else.') },
      { id: 'disk', text: bi('Только хранилище для фотографий', 'Only a store for photos'), why: bi('Хранилище составляет лишь одну из услуг облака. Главная его услуга состоит в том, что провайдер сдаёт напрокат машины, на которых можно запустить что угодно.', 'Storage is only one of the cloud’s services. Its main service is that the provider hires out machines that can run anything.') },
    ],
    explain: bi('Облако устроено как аренда. Провайдер покупает железо, строит здание и следит за ним, а вы платите за небольшую часть этого хозяйства и только за то время, пока она вам нужна.', 'The cloud is renting: the provider buys the hardware, puts up the building and looks after it, and you pay for a slice and only for as long as you need it.'),
    refs: { explainer: 'orient.rent' },
  },
  {
    id: 'orient.q.idle-bill',
    kind: 'mcq',
    concepts: ['orient.cloud'],
    prompt: bi('Машина в облаке включена, но ничего не делает, потому что проект закончился неделю назад. Что происходит со счётом?', 'A cloud machine is on but does nothing, because the project ended a week ago. What happens to the bill?'),
    options: [
      { id: 'ticks', text: bi('Счёт растёт, потому что платят за то, что машина существует, а не за пользу от неё', 'The bill grows, because you pay for the machine existing, not for the use you get from it'), correct: true },
      { id: 'zero', text: bi('Счёт не растёт, потому что машина простаивает', 'It does not grow: the machine is idle'), why: bi('Провайдер держит для вас процессор и память, даже когда вы ими не пользуетесь, и берёт за это деньги.', 'The provider keeps a processor and memory for you even when you do not use them, and charges for it.') },
    ],
    explain: bi('Поэтому в этом курсе каждый урок с облачными машинами заканчивается шагом «Уборка», на котором всё созданное удаляют.', 'That is why every lesson with cloud machines in this course has a “Cleanup” step: everything created is deleted at the end.'),
    refs: { explainer: 'orient.rent' },
  },
  {
    id: 'orient.q.cloud-why',
    kind: 'multi',
    concepts: ['orient.cloud'],
    prompt: bi('Почему компании берут машины в облаке, а не покупают свои?', 'Why do companies take machines in the cloud rather than buy their own?'),
    options: [
      { id: 'fast', text: bi('Машину можно получить за минуту, а не ждать поставки неделями', 'A machine can be had in a minute instead of waiting weeks for delivery'), correct: true },
      { id: 'short', text: bi('Машину можно взять на три дня распродажи и вернуть', 'You can take it for a three-day sale and give it back'), correct: true },
      { id: 'hw', text: bi('Железо, электричество и охрану берёт на себя провайдер', 'The provider takes care of the hardware, electricity and security'), correct: true },
      { id: 'free', text: bi('Облако всегда дешевле своих серверов', 'It is always cheaper than own servers'), why: bi('Облако дешевле не всегда. Машина, которая нужна круглый год на полной мощности, за несколько лет аренды обходится дороже собственной. Облако выигрывает скоростью и гибкостью, а не ценой.', 'Not always: a machine needed at full power all year round costs more to rent over several years than to own. The cloud wins on speed and flexibility.') },
    ],
    explain: bi('Облако продаёт гибкость, то есть возможность взять столько машин, сколько нужно, и тогда, когда нужно. За эту гибкость платят, поэтому за счётом следят.', 'The cloud sells flexibility: take as much as needed when needed. That flexibility is paid for, so people watch the bill.'),
  },
  {
    id: 'orient.q.fire',
    kind: 'mcq',
    concepts: ['orient.cloud'],
    prompt: bi('Ночью в дата-центре сгорел сервер, на котором работала ваша облачная машина. Чья это забота?', 'At night the server holding your cloud machine burnt out in the data centre. Whose worry is it?'),
    options: [
      { id: 'split', text: bi('Железо чинит провайдер, а за копии важных данных отвечаете вы', 'The provider fixes the hardware, and you answer for copies of important data'), correct: true },
      { id: 'prov', text: bi('Это целиком забота провайдера, и он вернёт и машину, и все данные', 'It is entirely the provider’s worry, and it will return both the machine and all the data'), why: bi('Провайдер запустит машину на другом сервере, но то, что хранилось только на ней, может пропасть. Копии данных делает их владелец.', 'The provider brings the machine up on another server, but whatever lay only on it may be lost. Copies are made by the owner of the data.') },
      { id: 'mine', text: bi('Это целиком ваша забота, и вам придётся ехать в дата-центр и менять железо', 'It is entirely your worry, and you will have to go to the data centre and replace the hardware'), why: bi('В чужой дата-центр вас не пустят, да и ехать туда незачем, потому что железом занимается провайдер.', 'You would not be let into someone else’s data centre, nor is there any need: hardware is the provider’s job.') },
    ],
    refs: { explainer: 'orient.rent' },
  },
];

export const rentLesson: Lesson = {
  id: 'orient.rent',
  block: 'orient',
  title: bi('Облако как прокат чужих серверов', 'The cloud as hiring somebody else’s servers'),
  summary: bi('Что значит «запустить в облаке», за что платят и почему ненужную машину удаляют сразу.', 'What “in the cloud” means, what exactly is paid for and why an unneeded machine is deleted at once.'),
  introduces: ['orient.cloud'],
  uses: ['orient.server', 'orient.network', 'orient.internet'],
  tier: 'core',
  minutes: 20,
  sources: sources([EN.nist, EN.cloud], [RU.cloud]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Через месяц у чайного магазина большая распродажа, и одного сервера на неё не хватит. Купить ещё три значит заплатить сразу, несколько недель ждать поставки, найти серверам место, электричество и охлаждение, а после распродажи оставить их пылиться. Но есть другой путь, при котором три сервера берут напрокат на четыре дня, а потом возвращают. Этот путь и называют облаком.',
        'In a month the tea shop has a big sale, and one server will not be enough. Buying three more means paying up front, waiting weeks for delivery, finding them room, electricity and cooling, and after the sale leaving them to gather dust. There is another way: hire three servers for four days and give them back. It is called the cloud.',
      ),
    },
    {
      id: 'cloud',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое облако', 'What the cloud is'),
      body: bi(
        '[[orient.cloud|Облаком]] называют чужие серверы, которые берут напрокат. Провайдер, обычно большая компания, строит дата-центры, ставит в них тысячи серверов и сдаёт их по частям. Вы открываете его сайт, выбираете размер машины, например «2 процессора и 4 гигабайта памяти», операционную систему и город, нажимаете «Создать», и через минуту у вас есть сервер со своим адресом в интернете. С ним разговаривают командами по сети, как с любым другим сервером.\n\nНикакого волшебства за этим словом нет. Ваша машина занимает часть настоящего большого сервера, потому что провайдер делит каждый сервер на несколько отдельных машин для разных клиентов, и соседей по серверу вы не видите. Как устроено такое деление, подробно разберёт один из следующих блоков, а здесь важнее понять, **за что вы платите**.\n\nПлатят за время, пока машина существует, обычно по часам или даже по секундам. Машина, которая месяц простояла без дела, стоит столько же, сколько машина, которая весь месяц работала. Поэтому главное правило облака требует удалять ненужную машину сразу. Чаще всего деньги в облаке уходят впустую не на дорогую машину, а на забытую.\n\nВзамен вы получаете скорость и гибкость. Сервер появляется за минуту, а не за месяц, и его можно взять на три дня распродажи. Железо, электричество, охрану и замену сгоревших деталей берёт на себя провайдер. А вот копии ваших данных остаются вашей заботой: если сервер, на котором работала ваша машина, сгорит, провайдер запустит машину в другом месте, но то, что хранилось только на ней, может пропасть.',
        'The [[orient.cloud|cloud]] is somebody else’s servers for hire. A provider, a big company, puts up data centres, puts thousands of servers in them and rents them out in slices. You open its site, choose the size of the machine (“2 processors, 4 gigabytes of memory”), the operating system and the city, press “Create”, and a minute later you have a server with its own address on the internet. You talk to it with commands over the network, like any other.\n\nThere is no magic in the word. Your machine is a slice of a real big server: the provider divides each one into several separate machines for different customers, and you do not see your neighbours. How such division works is taken apart in one of the later blocks; what matters here is **what you pay for**.\n\nYou pay for the time the machine exists, usually by the hour or even by the second. A machine that stood idle for a month costs as much as one that worked all month. Hence the main rule of the cloud: what is not needed is deleted at once. The most common wasted spend in the cloud is not an expensive machine but a forgotten one.\n\nIn return you get speed and flexibility. A server appears in a minute, not a month. It can be taken for the three days of a sale. The hardware, electricity, security and replacing burnt-out parts are the provider’s job. Copies of your data, however, are still your worry: if the server under your machine burns out, the provider brings it up elsewhere, but whatever lay only on it may be lost.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как машину берут напрокат и как растёт счёт', 'How a machine is hired and how the bill grows'),
      body: bi(
        'Схема ниже проводит вас через всю аренду: от заказа в панели провайдера до удаления машины, когда проект закончен. Сначала на схеме только вы и панель облака, то есть сайт провайдера, на котором заказывают машины. Потом появляются дата-центр провайдера, обведённый пунктиром, стойка с серверами, ваша машина на одном из них и счёт. Под машиной написано, какого она размера, под счётом — сколько вы уже заплатили, а полоска в счёте показывает, какую часть месяца машина уже оплачена.',
        'The diagram below takes you through a whole rental: from the order in the provider’s panel to deleting the machine when the project is over. At first it shows only you and the cloud panel. Then the provider’s data centre appears, outlined with a dashed line, with a rack of servers, your machine on one of them, and the bill. Under the machine you see its size, under the bill what you have paid, and the bar shows how much of a month is paid.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.rent', howto: bi('Схема листается так же, как в первом уроке. Карточка на линии здесь несёт сначала заказ, потом ваши команды, потом оплаченные часы. Под схемой стоят два счётчика: первый показывает сумму счёта в долларах, а второй — число оплаченных машино-часов, то есть часов работы всех машин вместе.\n\nКогда дойдёте до удаления машины, откройте «Параметры». Возьмите машину побольше или несколько машин, поменяйте число часов и следите за суммой. Потом включите в блоке «Сломать» забытую машину и посмотрите, во что обходится месяц её простоя. Последней включите сгоревшую стойку и обратите внимание, кто чинит железо и что при этом пропадает.', 'The diagram is stepped through as in the first lesson. The card on the line here carries first the order, then your commands, then the billed hours. Under the diagram are two counters: the first shows the bill in dollars, the second the number of machine-hours paid, that is, the hours of all the machines together.\n\nWhen you reach the deletion of the machine, open “Parameters”. Take a bigger machine or several machines, change the number of hours and watch the sum. Then switch on the forgotten machine in “Break it” and see what a month of it standing idle costs. Last, switch on the burnt rack and note who repairs the hardware and what is lost on the way.'), caption: bi('Цены на схеме взяты у недорогих провайдеров и округлены. Сколько стоят машины в жизни и как не платить за забытые, рассказывает следующий раздел, а настоящие облачные машины вы будете заказывать в следующих блоках курса.', 'The prices are those of inexpensive providers, rounded. What machines cost in real life and how not to pay for forgotten ones is next; you will order real cloud machines in later blocks.') },
    {
      id: 'cost',
      kind: 'callout',
      tone: 'cost',
      step: 'explain',
      title: bi('Сколько это стоит', 'What it costs'),
      body: bi(
        'Небольшая машина с двумя процессорами и 2 ГБ памяти стоит у недорогих провайдеров около двух центов в час, то есть примерно 15 долларов, если оставить её на целый месяц. Машина в восемь раз мощнее стоит примерно в восемь раз дороже. Дальше по курсу, когда вы будете заказывать настоящие машины, каждый такой урок будет начинаться с экрана, на котором посчитана стоимость, и заканчиваться уборкой.',
        'A small machine (2 processors, 2 GB of memory) costs about two cents an hour at inexpensive providers, roughly 15 dollars if left on for a month. A machine eight times more powerful costs about eight times more. Later in the course, when you order real machines, every such lesson starts with a cost screen and ends with a cleanup.',
      ),
    },
    {
      id: 'programmer',
      kind: 'callout',
      tone: 'note',
      levels: ['experienced'],
      title: bi('Если вы программист', 'If you are a programmer'),
      body: bi(
        'Если вы выкладывали проекты на Vercel или Heroku, вы уже пользовались облаком, только этажом выше. Такие платформы сами запускают ваше приложение на арендованных машинах, берут плату за запросы и минуты работы, а сами машины прячут. Этот курс спускается на этаж ниже, к машинам, потому что инженер, к которому ведёт курс, строит такие платформы для своей компании. Против забытых машин есть простой рецепт: при создании в описание машины записывают владельца и дату, после которой её можно удалять, а раз в неделю список машин в панели провайдера сверяют с этими записями. На собеседовании часто спрашивают, как снизить счёт за облако, и первым ответом ждут поиск забытых и слишком больших машин.',
        'If you have deployed projects to Vercel or Heroku, you have already used the cloud, only one floor up. Such platforms start your app on hired machines themselves, charge for requests and minutes of work, and hide the machines. This course goes one floor down, to the machines, because the engineer it leads to creates such platforms for their company. There is a simple recipe against forgotten machines: when a machine is created, its owner and the date after which it may be deleted are written into its description, and once a week the list of machines in the provider’s panel is checked against these notes. An interview often asks how to cut a cloud bill, and the first answer expected is finding forgotten and oversized machines.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: rentQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Облаком называют чужие серверы напрокат. Машину в облаке получают за минуту и платят за всё время, пока она существует. За железо отвечает провайдер, а за данные отвечаете вы. Ненужную машину удаляют сразу.',
        'The cloud is somebody else’s servers for hire: a machine in a minute, paid for as long as it exists. Hardware is the provider’s worry, data is yours. What is not needed is deleted at once.',
      ),
    },
  ],
};

// ── 7. Source code, build and version ──────────────────────────────────────

export const releaseQuiz: QuizItem[] = [
  {
    id: 'orient.q.source-vs-program',
    kind: 'mcq',
    key: true,
    concepts: ['orient.source-build'],
    prompt: bi('Чем исходный код отличается от программы, которую запускают?', 'How does source code differ from the program that is run?'),
    options: [
      { id: 'ok', text: bi('Исходный код написан для людей, а сборка превращает его в то, что запускает машина', 'Source code is text for people; the build turns it into what the machine runs'), correct: true },
      { id: 'same', text: bi('Ничем, это два названия одного и того же файла', 'Nothing, these are two names for one file'), why: bi('У скриптовых языков код и программа почти совпадают, но и там сборка добавляет всё, что нужно программе для работы. А у компилируемых языков сборка даёт другой файл, составленный из инструкций процессора.', 'For scripting languages they are indeed close, but even there the build adds everything the program needs, and for compiled languages the result is a quite different file of processor instructions.') },
      { id: 'secret', text: bi('Исходный код представляет собой зашифрованную программу', 'Source code is an encrypted program'), why: bi('Никакого шифра здесь нет, потому что исходный код пишут люди, чтобы его читали люди.', 'There is no cipher here, because source code is written by people for people to read.') },
    ],
    explain: bi('Исходный код читают и правят, а запускают результат сборки. Между ними всегда есть шаг, и на этом шаге ловят часть ошибок.', 'Source code is read and edited, the build output is run. There is always a step between them, and some errors are caught at it.'),
    refs: { explainer: 'orient.release' },
  },
  {
    id: 'orient.q.semver',
    kind: 'match',
    concepts: ['orient.version'],
    prompt: bi('У программы была версия 2.3.1. Сопоставьте изменение и новый номер.', 'The program was at version 2.3.1. Match the change with the new number.'),
    pairs: [
      { id: 'fix', left: bi('исправили ошибку', 'fixed a bug'), right: '2.3.2' },
      { id: 'feat', left: bi('добавили новую возможность, а всё старое работает как прежде', 'added a feature, the old works as before'), right: '2.4.0' },
      { id: 'break', left: bi('изменили программу так, что старые настройки к ней больше не подходят', 'changed things so that old settings no longer fit'), right: '3.0.0' },
    ],
    explain: bi('Так устроены правила семантического версионирования: последнее число растёт при исправлениях, среднее — при новых возможностях, которые ничего не ломают, а первое — при несовместимых изменениях. По номеру пользователь понимает, можно ли обновиться, не читая подробностей.', 'These are the rules of semantic versioning: the last digit is fixes, the middle one new things without breakage, the first one incompatible changes. From the number a user understands whether it is safe to upgrade without looking.'),
    refs: { explainer: 'orient.release' },
  },
  {
    id: 'orient.q.why-numbers',
    kind: 'mcq',
    concepts: ['orient.version'],
    prompt: bi('Пользователь пишет: «В новой версии сломалась корзина». Чем здесь поможет номер версии?', 'A user writes: “The cart broke in the new version.” How does the version number help?'),
    options: [
      { id: 'find', text: bi('По номеру найдут, что изменилось с прошлого выпуска, а если нужно, вернут прежний выпуск', 'By the number one finds what changed since the previous release and brings the previous one back if needed'), correct: true },
      { id: 'none', text: bi('Ничем не поможет, потому что номер нужен только для красоты', 'It will not help at all, because the number is only decoration'), why: bi('Без номера неизвестно, о каком выпуске идёт речь и к какому возвращаться.', 'Without a number nobody knows which release is meant or which to go back to.') },
    ],
    refs: { explainer: 'orient.release' },
  },
  {
    id: 'orient.q.typo-where',
    kind: 'mcq',
    concepts: ['orient.source-build'],
    prompt: bi('В программе на Python опечатка в имени функции, в редко используемой части кода. Когда её заметят, если тестов нет?', 'A Python program has a typo in a function name, in a rarely used branch. When will it be noticed if there are no tests?'),
    options: [
      { id: 'users', text: bi('Когда пользователь дойдёт до этого места программы', 'When a user reaches that spot'), correct: true },
      { id: 'build', text: bi('На сборке, как это было бы с программой на Go', 'At the build, as in Go'), why: bi('Сборка программы на Python упаковывает код, но не проверяет каждое имя. Сборка программы на Go проверила бы.', 'The build of a scripting language packs the code but does not check every name. The Go compiler would.') },
    ],
    explain: bi('Поэтому код проверяют до выпуска тестами, которые машина запускает при каждой правке. Подробно о тестах рассказывает блок методологии.', 'That is why code is checked before release by tests, which a machine runs on every edit. More on this in the methodology block.'),
    refs: { explainer: 'orient.release' },
  },
];

export const releaseLesson: Lesson = {
  id: 'orient.release',
  block: 'orient',
  title: bi('Исходный код, сборка и версия', 'Source code, build and version'),
  summary: bi('Как люди пишут текст программы, как сборка делает из него программу для машины и как по номеру выпуска видно, что изменилось.', 'How people write a program’s text, how the build turns it into a program for the machine, and how a release number shows what changed.'),
  introduces: ['orient.source-build', 'orient.version'],
  uses: ['orient.program', 'orient.file', 'orient.command'],
  tier: 'core',
  minutes: 30,
  sources: sources([EN.source, EN.build, EN.semver, EN.versioning], [RU.source, RU.compiler, RU.semver]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Покупатель жалуется: «После обновления не работает корзина». За этот месяц магазин выпустил четыре обновления, и разработчик спрашивает в ответ: «А какое обновление стоит у вас?» Покупатель не знает. Чтобы такой разговор мог к чему-то привести, программа должна пройти путь от текста, который пишет человек, до выпуска с номером, который ставят пользователи.',
        'A customer complains: “After the update the cart does not work.” The shop has had four updates this month, and the developer asks in reply: “Which one do you have?” The customer does not know. For such a conversation to be possible at all, a program has to travel from the text a person writes to a numbered release that users install.',
      ),
    },
    {
      id: 'source',
      kind: 'text',
      step: 'explain',
      title: bi('Исходный код и сборка', 'Source code and build'),
      body: bi(
        'Программы пишут не инструкциями процессора, на это ушло бы невыносимо много времени, а на языках программирования: Go, Python, Java, JavaScript. Текст программы на таком языке называется **исходным кодом**. Его пишут и читают люди, он хранится в обычных файлах, и в большом проекте его десятки тысяч строк.\n\nПроцессор выполнить исходный код не может. Нужен шаг, который превратит текст в то, что запускает машина, и этот шаг называется [[orient.source-build|сборкой]].\n\nКак устроена сборка, зависит от языка. Для **компилируемых** языков вроде Go сборщик переводит весь текст в инструкции процессора и записывает их в один файл программы. По дороге он проверяет каждое имя, поэтому опечатка останавливает сборку, и ошибку ловят прежде, чем она дойдёт до людей.\n\n**Скриптовые** языки вроде Python переводят в инструкции уже во время работы программы, поэтому сборка у них короче и только складывает код и всё, что ему нужно, в один архив. Каждое имя такая сборка не проверяет, и опечатку в редко используемой строке может первым найти пользователь. Поэтому код ещё проверяют тестами, но это уже тема блока методологии.\n\nСамое главное здесь то, что правят исходный код, а запускают результат сборки. Между ними всегда есть шаг, и чем меньше в этом шаге ручной работы, тем он надёжнее.',
        'Programs are not written in processor instructions, which would take unbearably long, but in a programming language: Go, Python, Java, JavaScript. Such text is called **source code**. People write and read it, it lies in ordinary files, and a big project has tens of thousands of lines of it.\n\nThe processor cannot carry out source code. A step is needed that turns the text into what the machine runs: the [[orient.source-build|build]].\n\nHow the build goes depends on the language. For **compiled** languages like Go the builder translates all the text into processor instructions and writes them into one program file. On the way it checks every name, and a typo stops the build: the error is caught before it reaches people.\n\nFor **scripting** languages like Python the translation happens while the program runs, and the build is shorter: it packs the code and everything it needs into one archive. It does not check every name, and a typo in a rare line may be found first by a user. That is why code is also checked by tests, but that is a topic for methodology.\n\nRemember one thing: source code is what you edit, and the build output is what you run. There is always a step between them, and the less manual work in it, the more reliable it is.',
      ),
    },
    {
      id: 'version',
      kind: 'text',
      step: 'explain',
      title: bi('Выпуск и его номер', 'A release and its number'),
      body: bi(
        'Собранную программу, которую отдают пользователям, называют выпуском, и каждый выпуск получает номер, который называют [[orient.version|версией]]. Самое распространённое правило нумерации, семантическое версионирование, записывает номер тремя числами через точку: `1.4.2`. Последнее число растёт, когда исправили ошибку. Среднее растёт, когда добавили новую возможность, а всё старое работает как прежде; последнее число при этом обнуляется, и получается `1.5.0`. Первое число растёт, когда программу изменили так, что старое к ней больше не подходит, и тогда получается `2.0.0`.\n\nНомер нужен не для красоты. По нему пользователь понимает, можно ли обновиться, не читая подробностей. По нему команда находит, что изменилось между выпусками, а если новый выпуск подвёл, возвращает предыдущий. Выпуск с номером после выхода никогда не меняют, и он остаётся на полке рядом с прежними. А покупатель из начала урока, назвав версию, сразу сузил бы поиск с четырёх обновлений до одного.',
        'A built program handed to users is called a release, and every release gets a number, a [[orient.version|version]]. The most common numbering rule, semantic versioning, writes three numbers separated by dots: `1.4.2`. The last one grows when a bug is fixed. The middle one when a new feature is added and everything old works as before; the last one is then reset: `1.5.0`. The first one when something was changed so that the old no longer fits: `2.0.0`.\n\nThe number is no decoration. From it a user understands whether it is safe to upgrade without looking. With it the team finds what changed between releases, and if a new one fails, brings back the previous one: a numbered release is never changed after it is out; it lies on the shelf next to the earlier ones. And the customer from the start of the lesson, by naming the version, would at once have narrowed the search from four updates to one.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Путь правки от программиста до пользователей', 'The path of an edit from programmer to users'),
      body: bi(
        'Схема ниже показывает, как одна правка программиста превращается в выпуск с номером. Сейчас у пользователей магазина версия 1.4.2. Сначала на схеме только программист и исходный код. Потом появляются сборка, готовый файл программы, полка выпусков, на которой лежат все прежние версии, и пользователи. Под каждым участником написано, что у него сейчас: какие файлы с кодом, какой файл получился после сборки, какие номера лежат на полке и на какой версии работают пользователи.',
        'The diagram below shows how one edit becomes a numbered release. The users now run 1.4.2. At first it shows only the programmer and the source code. Then the build appears, the program file, the shelf with all earlier versions, and the users. Under each one you see what it holds now.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.release', howto: bi('Схема листается так же, как в первом уроке. Карточка на линии здесь несёт сначала правку, потом файл программы, потом номер нового выпуска.\n\nКогда пройдёте выпуск до конца, откройте «Параметры» и выберите другой вид изменения: новую возможность или несовместимое изменение. Перед этим схема спросит, какой номер получит выпуск. Потом включите в блоке «Сломать» опечатку в коде и пройдите путь дважды, сначала для программы на Go, потом для программы на Python, и сравните, где опечатку поймают. Последняя поломка показывает, что бывает, когда программу выпускают без номеров.', 'The diagram is stepped through as in the first lesson. The card on the line here carries first the edit, then the program file, then the number of the new release.\n\nWhen you have walked the release to the end, open “Parameters” and choose another kind of change: a new feature or an incompatible change. Before that the diagram asks what number the release will get. Then switch on the typo in the code in “Break it” and walk the path twice, first for a program in Go, then for a program in Python, and compare where the typo is caught. The last break shows what happens when a program is released without numbers.'), caption: bi('В заданиях ниже вы пройдёте тот же путь руками: прочитаете исходный код, соберёте программу скриптом сборки, запустите то, что получилось, и выпустите исправление с правильным номером. Прежний выпуск при этом останется на месте, как на полке на схеме.', 'Below you walk the same path by hand: read the source, build with the build script, run the result and release a fix with the right number. The previous release stays, like on the shelf in the diagram.') },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: project(),
      intro: bi('Перед вами маленький проект магазина. В папке `src` лежит исходный код, в файле `VERSION` записан номер версии, а скрипт `build.sh` выполняет сборку. Программа здесь скриптовая, поэтому сборка только копирует код в папку `dist` под именем, в которое входит номер версии.', 'A small shop project: the folder `src` holds the source code, the file `VERSION` the version number, and `build.sh` is the build. The program here is a script, so the build only copies the code into the folder `dist` under a name with the number.'),
      tasks: [
        {
          id: 'read',
          prompt: bi('Посмотрите на исходный код командой `cat src/greet.sh`. Он состоит из одной строчки, понятной человеку.', 'Look at the source code: `cat src/greet.sh`. It is one line a person can understand.'),
          check: { stdout: /Hello from the tea shop/ },
          chips: 'cat src/greet.sh',
          concepts: ['orient.source-build'],
          hints: { H1: bi('Напечатайте `cat` и путь к файлу.', '`cat` and the path to the file.') },
        },
        {
          id: 'build',
          prompt: bi('Соберите программу командой `bash build.sh`. Сборка прочитает номер из файла `VERSION` и положит результат в папку `dist`.', 'Build the program: `bash build.sh`. The build reads the number from `VERSION` and puts the result into `dist`.'),
          check: { when: "files['/home/learner/shop/dist/greet-1.4.2.sh'].type=f" },
          chips: 'bash build.sh',
          docRef: man('bash.1', 'INVOCATION'),
          concepts: ['orient.source-build', 'orient.version'],
          hints: { H1: bi('Напечатайте `bash` и через пробел имя файла сборки. Так запускают команды, которые записаны в файл.', 'Type `bash` and, after a space, the name of the build file. This is how commands written in a file are run.') },
        },
        {
          id: 'run',
          prompt: bi('Запустите то, что получилось, командой `bash dist/greet-1.4.2.sh`.', 'Run what came out with the command `bash dist/greet-1.4.2.sh`.'),
          check: { stdout: /Hello from the tea shop/, when: "files['/home/learner/shop/dist/greet-1.4.2.sh'].type=f" },
          chips: 'bash dist/greet-1.4.2.sh',
          concepts: ['orient.source-build'],
          hints: { H1: bi('Путь к собранному файлу начинается с `dist/`.', 'The path to the built file starts with `dist/`.') },
        },
        {
          id: 'bump',
          prompt: bi('Допустим, вы исправили ошибку. Увеличьте номер версии, то есть запишите в файл `VERSION` новый номер по правилам урока, и соберите программу снова. Прежний выпуск должен остаться на месте.', 'You fixed a bug. Raise the version: write the new number into `VERSION` by the rules of the lesson and build again. The previous release must stay where it is.'),
          check: {
            when: "files['/home/learner/shop/dist/greet-1.4.3.sh'].type=f && files['/home/learner/shop/dist/greet-1.4.2.sh'].type=f",
            fail: [
              { if: "files['/home/learner/shop/dist/greet-1.5.0.sh'].type=f", say: bi('Номер 1.5.0 означает новую возможность, а при исправлении ошибки растёт только последнее число.', '1.5.0 means a new feature. For a fix the last digit grows.') },
              { if: "files['/home/learner/shop/dist/greet-2.0.0.sh'].type=f", say: bi('Номер 2.0.0 означает несовместимое изменение, а исправление ошибки меняет только последнее число.', '2.0.0 is an incompatible change. A bug fix changes only the last digit.') },
            ],
          },
          chips: 'echo 1.4.3 > VERSION',
          concepts: ['orient.version'],
          hints: { H1: bi('Знак `>` заменит содержимое файла `VERSION` целиком.', 'The `>` sign replaces the contents of `VERSION`.'), H2: bi('После этого снова выполните `bash build.sh`.', 'Then `bash build.sh` again.') },
        },
      ],
    },
    {
      id: 'programmer',
      kind: 'callout',
      tone: 'note',
      levels: ['experienced'],
      title: bi('Если вы программист', 'If you are a programmer'),
      body: bi(
        'Правило этого урока в индустрии формулируют так: собрать один раз и выкладывать много раз. Собранный файл получает номер и больше не меняется, а на каждую машину, от тестовой до той, с которой работают покупатели, попадает один и тот же файл. Для проекта на Laravel или Node сборка означает установку зависимостей строго по файлу с закреплёнными версиями (`composer.lock`, `package-lock.json`), сборку клиентской части и упаковку результата в один архив с номером версии. Если же на рабочем сервере выполняют `git pull` и `composer install`, каждый сервер собирает программу сам. Тогда на рабочей машине нужны инструменты сборки и доступ к репозиторию, сборка может прерваться посреди выкладки и оставить на диске наполовину обновлённый код, а покупатели получают не тот файл, который проверили на стенде, а новую сборку из другого места. Возврат к прошлой версии при этом тоже превращается в новую сборку, хотя мог бы быть возвратом прошлого архива. Вопрос «почему не стоит выкладывать обновление через `git pull` на сервере» на собеседовании задают часто, и ответ на него вытекает из этого урока.',
        'In the industry the rule of this lesson is put this way: build once, deploy many times. The built file gets a number and never changes again, and every machine, from the test one to the one the customers use, gets one and the same file. For a Laravel or Node project the build means installing dependencies strictly from the file of locked versions (`composer.lock`, `package-lock.json`), building the front end and packing the result into one archive with the version number. If instead `git pull` and `composer install` are run on the live server, every server builds the program itself. Then the live machine needs build tools and access to the repository, a build can break off in the middle of a deployment and leave half-updated code on the disk, and the customers get not the file that was checked on the stand but a new build made somewhere else. Going back to the previous version, too, becomes a new build, though it could have been a return to the previous archive. The question “why not deploy an update with `git pull` on the server” is often asked at interviews, and its answer follows from this lesson.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: releaseQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Исходным кодом называют текст программы, который пишут и читают люди. Сборка превращает его в то, что запускает машина, а у компилируемых языков заодно ловит опечатки. Каждый выпуск получает номер: исправление увеличивает последнее число, новая возможность — среднее, а несовместимое изменение — первое. Выпуск с номером не меняют, и к нему всегда можно вернуться.',
        'Source code is the program’s text for people; the build turns it into what the machine runs and, for compiled languages, also catches typos. A release gets a number: a fix bumps the last digit, a new feature the middle one, an incompatible change the first. A numbered release is never changed; you can go back to it.',
      ),
    },
  ],
};

// ── 8. Environments and configuration ──────────────────────────────────────

export const placesQuiz: QuizItem[] = [
  {
    id: 'orient.q.three-envs',
    kind: 'order',
    key: true,
    concepts: ['orient.environments'],
    prompt: bi('Расставьте окружения в том порядке, в каком через них проходит новая версия.', 'Put the environments in the order a new version passes through them.'),
    steps: [
      { id: 'dev', text: bi('ноутбук разработчика', 'the developer’s laptop') },
      { id: 'test', text: bi('тестовый стенд', 'the test stand') },
      { id: 'prod', text: bi('рабочее окружение, которым пользуются покупатели', 'production') },
    ],
    explain: bi('Сначала программу пишут и пробуют у себя, потом проверяют на стенде, похожем на рабочее окружение, и только после этого выкладывают туда, где её ждут покупатели.', 'First the program is written and tried locally, then checked on a stand that resembles production, and only then deployed where the customers are.'),
    refs: { explainer: 'orient.places' },
  },
  {
    id: 'orient.q.config-why',
    kind: 'mcq',
    concepts: ['orient.config'],
    prompt: bi('Почему адрес платёжной системы и пароль к ней держат в файле настроек, а не в исходном коде?', 'Why are the payment system’s address and password kept in a settings file rather than in the source code?'),
    options: [
      { id: 'one', text: bi('Одна и та же сборка должна работать во всех окружениях, а различаться должны только настройки', 'The same build must work in every environment and differ only in settings'), correct: true },
      { id: 'speed', text: bi('Так программа работает быстрее', 'The program runs faster that way'), why: bi('На скорость это не влияет. Дело в том, что при настройках, записанных в код, на каждое окружение пришлось бы собирать отдельную программу.', 'It does not affect speed. The point is that with settings in the code a separate program would have to be built for each environment.') },
      { id: 'pretty', text: bi('Так красивее', 'It looks nicer'), why: bi('Причина здесь практическая, ведь в рабочее окружение должна попасть та самая сборка, которую проверили на стенде.', 'The reason here is practical, since production must get the very build that was checked on the stand.') },
    ],
    explain: bi('Есть и ещё одна причина. Пароль в исходном коде увидит каждый, кто может читать код, а файл настроек рабочего окружения видят только те, кому это нужно для работы.', 'And one more reason: a password in source code is seen by everyone who can read the code. The production settings file is seen only by those who need it.'),
    refs: { explainer: 'orient.places' },
  },
  {
    id: 'orient.q.wrong-conf',
    kind: 'mcq',
    concepts: ['orient.config', 'orient.environments'],
    prompt: bi('Сайт работает, заказы идут, но деньги на счёт магазина не приходят. Что проверить первым?', 'The site works and orders come in, but no money reaches the shop’s account. What should be checked first?'),
    options: [
      { id: 'conf', text: bi('Какой файл настроек прочитала программа в рабочем окружении', 'Which settings file the program in production has read'), correct: true },
      { id: 'code', text: bi('Исходный код корзины', 'The source code of the cart'), why: bi('На стенде та же сборка работала правильно, значит, отличается не код, а то, что лежит рядом с ним.', 'On the stand the same build worked correctly, so it is not the code that differs but what is next to it.') },
      { id: 'disk', text: bi('Хватает ли места на диске', 'Whether there is enough disk space'), why: bi('Тогда сайт не принимал бы заказы. Здесь всё работает, только платежи уходят не туда.', 'Then the site would not take orders. Here everything works, the payments just go to the wrong place.') },
    ],
    refs: { explainer: 'orient.places' },
  },
  {
    id: 'orient.q.prod-is',
    kind: 'mcq',
    concepts: ['orient.environments'],
    prompt: bi('Что в IT-командах называют продом?', 'What is production?'),
    options: [
      { id: 'live', text: bi('Окружение, которым пользуются настоящие покупатели', 'The environment real customers use'), correct: true },
      { id: 'fast', text: bi('Самый мощный сервер компании', 'The company’s most powerful server'), why: bi('Мощность здесь ни при чём, потому что рабочее окружение может работать и на маленьких машинах. Рабочим его делает то, кто им пользуется.', 'Power has nothing to do with it: production can run on small machines. It is defined by who uses it.') },
      { id: 'dev', text: bi('Ноутбук ведущего разработчика', 'The lead developer’s laptop'), why: bi('Ноутбук разработчика служит окружением разработки, и это окружение дальше всех от рабочего.', 'A developer’s laptop is the development environment, the furthest from production.') },
    ],
    explain: bi('Слово «прод» сокращено от английского production, а по-русски это окружение называют рабочим. Ошибка в рабочем окружении стоит денег, а ошибка на стенде — только времени.', 'The word is short for production. A mistake in production costs money, a mistake on the stand only time.'),
  },
];

/** The production settings say colour=green as the last colour line, and the greeting survived; app.sh is untouched. */
function prodGreen(f: Facts): boolean {
  const conf = f.files['/home/learner/shop/config/prod.conf']?.text ?? '';
  const colors = conf.split('\n').filter((l) => l.startsWith('color='));
  return colors[colors.length - 1] === 'color=green' && /greeting=Welcome to the tea shop/.test(conf) && f.files['/home/learner/shop/app.sh']?.text === APP_SH;
}

export const placesLesson: Lesson = {
  id: 'orient.places',
  block: 'orient',
  title: bi('Где работает программа и откуда она берёт настройки', 'Where a program runs: environments and settings'),
  summary: bi('Через какие три окружения проходит программа, почему сборка у них одна на всех и зачем каждому окружению свой файл настроек.', 'The developer’s laptop, the test stand and production; one build for all and a settings file for each.'),
  introduces: ['orient.environments', 'orient.config'],
  uses: ['orient.server', 'orient.source-build', 'orient.version', 'orient.file'],
  tier: 'core',
  minutes: 30,
  sources: sources([EN.envs, EN.config12, EN.parity12], [RU.config12, RU.parity12]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Новая версия магазина прошла все проверки на тестовом стенде. Её выложили для покупателей, заказы идут, а денег на счёте магазина нет. Программа та же, что на стенде, байт в байт, значит, отличается что-то рядом с ней. Чтобы найти отличие, нужно знать, в скольких местах работает одна и та же программа и чем эти места различаются.',
        'The new version of the shop passed every check on the test stand. It was deployed for the customers, orders are coming in, but there is no money in the account. The program is the same as on the stand, byte for byte. So something next to it differs. To understand what, you need to know in how many places one program runs and how those places differ.',
      ),
    },
    {
      id: 'envs',
      kind: 'text',
      step: 'explain',
      title: bi('Три окружения', 'Three environments'),
      body: bi(
        'Место, где работает программа, вместе со всем, что её окружает, то есть с машиной, операционной системой, базой данных и соседними программами, называют [[orient.environments|окружением]]. Обычно окружений три.\n\n**Окружением разработки** служит ноутбук программиста. Здесь программу пишут и запускают по десять раз на дню, сломать её тут не страшно, а данные ненастоящие.\n\n**Тестовое окружение**, которое ещё называют стендом, состоит из отдельных серверов, устроенных как можно ближе к рабочим: та же операционная система, те же версии программ, похожие данные. Только покупатели здесь ненастоящие, а платёжная система учебная. На стенде новую версию проверяют, прежде чем показать людям.\n\n**Рабочим окружением** пользуются настоящие покупатели с настоящими деньгами. В командах его называют продом, от английского production. Ошибка на стенде стоит времени, а ошибка в рабочем окружении — денег и доверия покупателей.\n\nГлавный принцип состоит в том, что через все три окружения проходит **одна и та же сборка**. Если в рабочее окружение попадает не та программа, которая прошла стенд, проверка на стенде ничего не доказывает. Второй принцип требует, чтобы стенд был похож на рабочее окружение. Если система на стенде отстаёт на одну версию, проверки пройдут, а у покупателей программа встретит то, чего никогда не видела.',
        'The place where a program runs, together with everything around it (the machine, the system, the database, neighbouring programs), is called an [[orient.environments|environment]]. Usually there are three.\n\n**Development.** The programmer’s laptop. Here the program is written and run ten times a day; breaking it is harmless, and the data are not real.\n\n**Test** (also called the stand or staging). Separate servers built as close to the working ones as possible: the same system, the same program versions, similar data, except the customers are fake and the payments are pretend. Here a new version is checked before people see it.\n\n**Production.** The environment real customers with real money use. A mistake on the stand costs time; a mistake in production costs money and trust.\n\nThe main principle: **one and the same build** goes through all three environments. If production gets a different program from the one that passed the stand, the check on the stand proves nothing. And a second principle: the stand must resemble production. If the stand’s system is a version behind, the tests pass, and in production the program meets what it has never seen.',
      ),
    },
    {
      id: 'config',
      kind: 'text',
      step: 'explain',
      title: bi('Настройки отдельно от кода', 'Settings apart from the code'),
      body: bi(
        'Но если программа везде одна и та же, откуда она знает, что на стенде платить нужно в учебную систему, а у покупателей — в настоящую? Это она узнаёт из [[orient.config|конфигурации]], то есть из файла настроек, который лежит рядом с ней в каждом окружении. В этом файле записано всё, что меняется от места к месту: адреса базы данных и платёжной системы, пароли, имя сайта, включённые возможности.\n\n```\n# prod.conf\npay=https://pay.example/real\ngreeting=Welcome to the tea shop\n```\n\nПри запуске программа читает свой файл и ведёт себя так, как в нём написано. Поэтому одна сборка работает везде, и в рабочее окружение попадает та самая сборка, которую проверили. Если же записать настройки в сам код, на каждое окружение придётся собирать отдельную программу, и к покупателям попадёт сборка, которую никто не проверял. Есть и третья причина: пароль, записанный в исходный код, видит каждый, кто читает код, а файл настроек рабочего окружения видят только те, кому это положено.\n\nТеперь история из начала урока объясняется сама собой. Программа в рабочем окружении прочитала не тот файл, тестовый, и исправно отправляла платежи в учебную систему. Сама программа не сломалась. Окружение ей задаёт файл настроек, поэтому перепутанный файл перепутал и окружения.',
        'But if the program is the same everywhere, how does it know that on the stand it must pay into the pretend system and in production into the real one? From its [[orient.config|configuration]], a settings file that lies next to it in every environment. It holds what changes from place to place: the addresses of the database and the payment system, passwords, the site’s name, switched-on features.\n\n```\n# prod.conf\npay=https://pay.example/real\ngreeting=Welcome to the tea shop\n```\n\nAt start the program reads its file and behaves accordingly. That is why one build works everywhere and exactly what was checked goes to production. If the settings are baked into the code, a separate program has to be built for each environment, and production gets the one nobody checked. There is a third reason too: a password written into source code is seen by everyone who reads the code, while the production settings file is seen only by those meant to.\n\nNow the story from the start of the lesson tells itself. The program in production read the wrong file, the test one, and faithfully sent payments to the pretend system. Nothing broke: the environment is set by the settings file, and a mixed-up file mixed up the environments.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как одна сборка проходит три окружения', 'How one build passes three environments'),
      body: bi(
        'Схема ниже прослеживает одну сборку магазина, версию 1.5.0, от ноутбука разработчика до покупателей. Сначала на схеме только сама сборка. Потом в среднем ряду одно за другим появляются три окружения: ноутбук разработчика, тестовый стенд и рабочее окружение, а справа покупатели. Над каждым окружением появляется его файл настроек: dev.conf, test.conf и prod.conf. Под именем файла написана главная строка из него, которая говорит, платить ли в учебную систему (`pay=sandbox`) или в настоящую (`pay=real`).',
        'The diagram below follows one build, 1.5.0, from the developer’s laptop to the customers. At first it shows only the build. Then the three environments appear in the middle row, the customers on the right, and above each environment its settings file with its main line: pay into the sandbox (`pay=sandbox`) or for real (`pay=real`).',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.places', howto: bi('Схема листается так же, как в первом уроке. Карточка на линии здесь движется в две стороны: снизу вверх идёт сама сборка, а сверху вниз строка из файла настроек. Зелёная рамка означает, что проверка пройдена, жёлтая предупреждает о риске, а красная показывает, где всё сломалось. Под схемой стоят два счётчика: первый показывает, сколько сборок понадобилось на один выпуск, а второй — получили ли покупатели ту сборку, которую проверили.\n\nКогда дойдёте до покупателей, откройте «Параметры» и запишите адрес оплаты в сам код, а потом посмотрите на число сборок. Затем верните настройки на место и поставьте на стенд предыдущую версию системы. Напоследок включите в блоке «Сломать» поломку, при которой в рабочее окружение положили test.conf, и сравните то, что увидят покупатели, с историей из начала урока.', 'The diagram is stepped through as in the first lesson. The card on the line here moves both ways: the build itself goes up from below, and a line from the settings file comes down from above. A green frame means a check passed, a yellow one warns of a risk, and a red one shows where everything broke. Under the diagram are two counters: the first shows how many builds one release needed, the second whether the customers got the build that was checked.\n\nWhen you reach the customers, open “Parameters” and write the payment address into the code itself, then look at the number of builds. Then put the settings back and give the stand the previous version of the system. Finally switch on the break in “Break it” where test.conf was put into production, and compare what the customers see with the story from the start of the lesson.'), caption: bi('В заданиях ниже вы сделаете то же самое руками: запустите одну и ту же программу с файлами настроек стенда и рабочего окружения, а потом поменяете настройку рабочего окружения, не трогая код.', 'Below you do the same by hand: run one program with the stand’s and production settings, then change a production setting without touching the code.') },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: settings(),
      intro: bi('Перед вами программа магазина `app.sh` и папка `config` с тремя файлами настроек. Программа одна, а запустить её можно с любым из этих файлов.', 'The shop program `app.sh` and the folder `config` with three settings files. There is one program, and it can be started with any of them.'),
      tasks: [
        {
          id: 'test',
          prompt: bi('Запустите программу так, как она работает на тестовом стенде, командой `bash app.sh config/test.conf`.', 'Start the program as it works on the test stand, with the command `bash app.sh config/test.conf`.'),
          check: { stdout: /Hi, tester/ },
          chips: 'bash app.sh config/test.conf',
          concepts: ['orient.environments', 'orient.config'],
          hints: { H1: bi('Последнее слово в строке задаёт путь к файлу настроек.', 'The last word of the line is the path to the settings file.') },
        },
        {
          id: 'prod',
          prompt: bi('Теперь запустите ту же программу так, как она работает в рабочем окружении, то есть с файлом `config/prod.conf`. Код не менялся. Что изменилось в ответе?', 'The same program in production: start it with `config/prod.conf`. The code did not change; what changed in the answer?'),
          check: { stdout: /Welcome to the tea shop/ },
          chips: 'bash app.sh config/prod.conf',
          concepts: ['orient.environments', 'orient.config'],
          hints: { H1: bi('Сделайте то же, что в прошлом задании, только с другим файлом.', 'As in the last task, just another file.') },
        },
        {
          id: 'green',
          prompt: bi('Отдел маркетинга просит сделать страницу в рабочем окружении зелёной. Не трогая `app.sh`, поменяйте цвет в `config/prod.conf` на `green` и снова запустите программу с prod.conf. Учтите, что знак `>>` дописывает строку в конец файла, а программа берёт последнюю строку, которая начинается с `color=`.', 'Marketing asks for the production page to be green. Without touching `app.sh`, change the colour in `config/prod.conf` to `green` and start the program with prod.conf again. A hint: `>>` appends a line to the end of a file, and the program takes the last line with `color=`.'),
          check: {
            when: prodGreen,
            fail: [
              { if: (f) => f.files['/home/learner/shop/app.sh']?.text !== APP_SH, say: bi('Код трогать не нужно, потому что цвет относится к настройкам, а настройки меняют в файле конфигурации.', 'There is no need to touch the code, because the colour is a setting, and settings are changed in the configuration file.') },
              { if: (f) => !/greeting=/.test(f.files['/home/learner/shop/config/prod.conf']?.text ?? ''), say: bi('Знак `>` заменил весь файл, и приветствие пропало, поэтому программа и печатает пустое приветствие перед восклицательным знаком. Нажмите «Сбросить экран» над терминалом: машина вернётся в исходное состояние, и файл снова будет целым. Потом допишите строку знаком `>>`, который добавляет её в конец файла и ничего не стирает.', 'The `>` sign replaced the whole file and the greeting is gone, which is why the program prints an empty greeting before the exclamation mark. Press “Reset this screen” above the terminal: the machine returns to its starting state and the file is whole again. Then append the line with `>>`, which adds it to the end of the file and erases nothing.') },
              { if: (f) => /^green\s*$/m.test(f.files['/home/learner/shop/config/prod.conf']?.text ?? ''), say: bi('Строка дописалась, но программа ищет строку, которая начинается с `color=`, а в вашей строке только слово green. Допишите строку целиком: `color=green`.', 'The line was appended, but the program looks for a line that starts with `color=`, and your line holds only the word green. Append the whole line: `color=green`.') },
            ],
          },
          chips: 'echo color=green >> config/prod.conf',
          concepts: ['orient.config'],
          hints: { H1: bi('В конце файла должна появиться строка `color=green`. Один знак `>` заменяет файл целиком, а два знака `>>` дописывают строку в его конец.', 'The line `color=green` must appear at the end of the file. A single `>` replaces the whole file, while a double `>>` appends a line to its end.'), H2: bi('Наберите `echo color=green >> config/prod.conf`, а потом снова `bash app.sh config/prod.conf`.', '`echo color=green >> config/prod.conf`, then `bash app.sh config/prod.conf` again.') },
        },
      ],
    },
    {
      id: 'programmer',
      kind: 'callout',
      tone: 'note',
      levels: ['experienced'],
      title: bi('Если вы программист', 'If you are a programmer'),
      body: bi(
        'Этот урок вам знаком под другими именами. Файл `.env` в Laravel, `process.env` в Node и переменные проекта на Vercel служат тем же файлом настроек, а принцип «одна сборка, разные настройки» записан в методике Twelve-Factor App, на которую ссылаются источники урока: третий пункт (Config) требует держать настройки отдельно от кода, а пятый (Build, release, run) соединять одну сборку с настройками каждого окружения. Десятый пункт той же методики (Dev/prod parity) требует держать окружения похожими друг на друга.\n\nКогда на стенде всё работает, а в рабочем окружении нет, сначала сравните настройки двух окружений построчно, командой вроде `diff config/test.conf config/prod.conf`, потом сравните номера версий системы и программ, и только после этого читайте код. Пароли не кладут в репозиторий даже в отдельном файле. В рабочем окружении программа получает их при запуске из хранилища паролей или из параметров запуска, которые задаёт система выкладки, и доступ к ним есть только у тех, кому он нужен. Вопрос «где вы храните пароли и ключи от рабочего окружения» задают на собеседованиях часто.',
        'You know this lesson under other names. The `.env` file in Laravel, `process.env` in Node and the project variables on Vercel serve as the same settings file, and the principle “one build, different settings” is written down in the Twelve-Factor App method that the lesson’s sources refer to: the third point (Config) requires keeping settings apart from the code, and the fifth (Build, release, run) joining one build with the settings of each environment. The tenth point of the same method (Dev/prod parity) requires keeping the environments alike.\n\nWhen everything works on the stand and not in production, first compare the settings of the two environments line by line, with a command like `diff config/test.conf config/prod.conf`, then compare the version numbers of the system and the programs, and only after that read the code. Passwords are not put into the repository, not even in a separate file. In production the program gets them at start from a secrets store or from start-up parameters set by the deployment system, and only those who need them can reach them. The question “where do you keep the passwords and keys of production” is asked at interviews often.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: placesQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Окружением называют место, где работает программа, и таких мест обычно три: окружение разработки, тестовый стенд и рабочее окружение. Через все три проходит одна и та же сборка, а то, чем окружения различаются, то есть адреса, пароли и имена, лежит рядом со сборкой в файле настроек. Стенд держат похожим на рабочее окружение, а перепутанный файл настроек перепутывает окружения.',
        'An environment is a place where the program runs: development, the test stand, production. One build goes through all three, and the differences (addresses, passwords, names) live in a settings file next to it. The stand is kept like production, and a mixed-up settings file mixes up environments.',
      ),
    },
  ],
};

// ── 9. Working on code together ────────────────────────────────────────────

export const togetherQuiz: QuizItem[] = [
  {
    id: 'orient.q.email',
    kind: 'mcq',
    key: true,
    concepts: ['orient.collaboration'],
    prompt: bi('Анна и Борис правят один файл и пересылают его друг другу почтой. Что рано или поздно случится?', 'Anna and Boris edit one file and send it to each other by email. What will happen sooner or later?'),
    options: [
      { id: 'lost', text: bi('Чья-то правка молча пропадёт, потому что тот, кто сохранит файл последним, затрёт правки остальных', 'Someone’s edit will silently vanish: whoever saved last overwrites the others'), correct: true },
      { id: 'merge', text: bi('Почта сама соединит их правки', 'The email will join their edits by itself'), why: bi('Почта пересылает файл целиком. Соединять правки умеют только программы для совместной работы.', 'Email forwards the whole file. Only collaboration programs can join edits.') },
      { id: 'ok', text: bi('Ничего, если они вежливые', 'Nothing, if they are polite'), why: bi('Вежливость не мешает двум людям открыть файл в одно и то же утро.', 'Politeness does not stop two people opening the file on the same morning.') },
    ],
    explain: bi('Поэтому код хранят в программе, которая помнит историю и соединяет правки. Чаще всего такой программой служит Git, и работать с ним вы начнёте сразу после блока Linux.', 'That is why code is kept in a program that remembers history and joins edits, most often Git. You will work with it right after the Linux block.'),
    refs: { explainer: 'orient.together' },
  },
  {
    id: 'orient.q.same-line',
    kind: 'mcq',
    concepts: ['orient.collaboration'],
    prompt: bi('Анна и Борис по-разному изменили одну и ту же строчку. Что сделает программа совместной работы?', 'Anna and Boris changed the same line in different ways. What does the collaboration program do?'),
    options: [
      { id: 'ask', text: bi('Покажет обе версии строчки и попросит человека решить', 'It shows both versions and asks a person to decide'), correct: true },
      { id: 'last', text: bi('Оставит ту правку, которая пришла позже', 'It keeps the one that came later'), why: bi('Тогда чья-то правка пропала бы молча, а такие программы как раз от этого и защищают.', 'Then someone’s edit would vanish silently, exactly what such programs protect against.') },
      { id: 'both', text: bi('Оставит обе строчки, одну под другой', 'It keeps both lines one under the other'), why: bi('Тогда в меню появились бы две цены одного чая. Программа не знает, какая из них правильная, поэтому решает человек.', 'The menu would then have two prices for one tea. The machine does not know which is right; a person decides.') },
    ],
    refs: { explainer: 'orient.together' },
  },
  {
    id: 'orient.q.small-edits',
    kind: 'mcq',
    concepts: ['orient.collaboration'],
    prompt: bi('Почему в командах стараются делать правки маленькими и соединять их часто?', 'Why do teams try to keep edits small and join them often?'),
    options: [
      { id: 'easy', text: bi('Маленькую правку легко прочитать, проверить и соединить, а большие правки чаще сталкиваются с чужими', 'A small edit is easy to read, check and join; big ones collide more often'), correct: true },
      { id: 'rule', text: bi('Так требует закон', 'The law says so'), why: bi('Такого закона нет, а есть опыт команд, который говорит, что чем дольше копию правят отдельно от общей, тем труднее её потом соединить.', 'There is no law; there is teams’ experience: the longer a separate copy lives, the more painful it is to join.') },
    ],
    explain: bi('Эта мысль, маленькие частые изменения вместо больших и редких, станет одной из главных в блоке методологии.', 'This idea, small frequent changes instead of big rare ones, becomes one of the main ones in the methodology block.'),
  },
];

export const togetherLesson: Lesson = {
  id: 'orient.together',
  block: 'orient',
  title: bi('Как несколько человек работают над одним кодом', 'Working on code together'),
  summary: bi('Каждый правит свою копию, программа соединяет правки и помнит историю, а спорную строчку решает человек.', 'Everyone edits their own copy, a machine joins the edits and remembers the history; a disputed line is decided by a person.'),
  introduces: ['orient.collaboration'],
  uses: ['orient.source-build', 'orient.version', 'orient.file', 'orient.command'],
  tier: 'core',
  minutes: 25,
  sources: sources([EN.gitAbout, EN.merge], [RU.gitAbout, RU.vcs]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В понедельник Анна повысила в меню магазина цену улуна, а Борис — цену чёрного чая. Оба правили файл `menu.txt`, и оба разослали его коллегам по почте. К обеду на сайте висела версия Бориса, в которой чёрный чай подорожал, а улун снова стоил по-старому. Правка Анны пропала молча, без единого предупреждения, и никто этого не заметил. В команде из двадцати программистов, которые правят тысячи файлов, так пропадало бы что-нибудь каждый день.',
        'On Monday Anna raised the oolong price in the shop’s menu, and Boris the black tea price. Both worked on the file `menu.txt`, both emailed it to the team. By lunchtime the site showed Boris’s version: black tea had gone up, and oolong cost the old price again. Anna’s edit did not vanish with a bang; it quietly disappeared. In a team of twenty programmers editing thousands of files, this would happen every day.',
      ),
    },
    {
      id: 'together',
      kind: 'text',
      step: 'explain',
      title: bi('Копии, слияние и история', 'Copies, merging, history'),
      body: bi(
        'Команды решают эту задачу не дисциплиной, а программой. [[orient.collaboration|Совместная работа над кодом]] устроена так.\n\nЕсть **общая копия** кода, главная версия, с которой все начинают. Напрямую её никто не правит. Каждый берёт себе **свою копию** и работает в ней, никому не мешая. Закончив, он отдаёт свою правку на **слияние**: программа сравнивает его копию и копию коллеги с общей строчку за строчкой. Правки в разных строчках она соединяет сама, и в меню оказываются обе новые цены. А если два человека по-разному изменили одну и ту же строчку, программа не пытается угадать, а останавливается и показывает обе версии человеку, и тот решает, какая из них верна.\n\nКаждое слияние записывается в **историю**, где видно, кто, что и когда изменил. По истории находят, какая правка принесла ошибку, и возвращают любую прошлую версию. Программа, которая всё это делает, чаще всего называется Git, и работать с ней руками вы начнёте сразу после блока Linux.\n\nИз такого устройства вытекает правило, которое пригодится в блоке методологии: правки лучше делать маленькими и соединять часто. Маленькую правку легко прочитать, проверить и соединить, а копия, которую неделю правили отдельно от общей, сталкивается с правками коллег сразу во многих местах.',
        'Teams solve this not with discipline but with a machine. [[orient.collaboration|Working on code together]] goes like this.\n\nThere is a **shared copy** of the code, the main version everyone starts from. Nobody edits it directly. Each person takes **a copy of their own** and works in it without getting in anyone’s way. When done, they hand the edit over to the **merge**: a program compares their copy and a colleague’s with the original line by line. Edits on different lines it joins by itself, and the menu ends up with both new prices. But if two people changed the same line differently, the program does not guess: it stops and shows both versions to a person, who decides.\n\nEvery merge is written into the **history**: who changed what and when. With it one finds which edit brought an error and brings back any past version. The program that does all this is most often called Git; you will work with it by hand right after the Linux block.\n\nFrom this scheme follows a rule that will be useful in methodology: edits are best kept small and joined often. A small edit is easy to read, check and join; a copy that lived its own life for a week collides with colleagues’ edits in many places at once.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как программа соединяет правки двух людей', 'How a program joins two people’s edits'),
      body: bi(
        'Схема ниже повторяет историю из начала урока, только на этот раз Анна и Борис работают с программой совместной работы. Сначала на схеме только общая копия меню. Потом слева и справа появляются копии Анны и Бориса, посередине программа слияния, а внизу история правок. Под каждой копией написана строчка меню, которую правит её хозяин, а под общей копией — номер её версии.',
        'The diagram below replays the story from the start of the lesson, this time with a collaboration program. At first it shows only the shared menu. Then Anna’s and Boris’s copies appear left and right, the merge in the middle and the history below. Under each copy you see the line its owner edits, under the shared copy its version.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.together', howto: bi('Схема листается так же, как в первом уроке. Карточка на линии здесь несёт копию меню, правку или новую версию. Жёлтая рамка означает, что программе нужно решение человека, а красная — что чья-то правка пропала. Под схемой стоят два счётчика: первый показывает, сколько строчек людям придётся проверить глазами, а второй — сколько правок пропало.\n\nКогда дойдёте до истории, откройте «Параметры» и выберите, что Анна и Борис правят одну и ту же строчку, а потом сделайте правки большими и сравните счётчики. Напоследок включите в блоке «Сломать» пересылку файла почтой, и вы увидите, как в понедельник пропала правка Анны.', 'The diagram is stepped through as in the first lesson. The card on the line here carries a copy of the menu, an edit or a new version. A yellow frame means the program needs a person’s decision, a red one that someone’s edit was lost. Under the diagram are two counters: the first shows how many lines people will have to check by eye, the second how many edits were lost.\n\nWhen you reach the history, open “Parameters” and choose that Anna and Boris edit the same line, then make the edits big and compare the counters. Finally switch on sending the file by email in “Break it”, and you will see how Anna’s edit was lost on Monday.'), caption: bi('В заданиях ниже вы найдёте разницу между копиями Анны и Бориса тем же способом, каким это делает программа слияния, то есть построчным сравнением, а потом сделаете из них общую копию.', 'Below you find the difference between Anna’s and Boris’s copies the way the merge program does, line by line, and then make the shared copy.') },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: twoCopies(),
      intro: bi('В папке `menu` лежат две копии меню, Анны и Бориса. Найдём, чем они различаются, тем же способом, каким это делает программа слияния.', 'The folder `menu` holds two copies of the menu, Anna’s and Boris’s. Let us find how they differ, the same way a merge program does.'),
      tasks: [
        {
          id: 'diff',
          prompt: bi('Сравните копии строчку за строчкой командой `diff menu-anna.txt menu-boris.txt`. Строчка со знаком `<` взята из первого файла, а строчка со знаком `>` — из второго.', 'Compare the copies line by line: `diff menu-anna.txt menu-boris.txt`. A line with `<` is from the first file, with `>` from the second.'),
          check: { stdout: /Black tea — 280/ },
          chips: 'diff menu-anna.txt menu-boris.txt',
          docRef: man('diff.1'),
          concepts: ['orient.collaboration'],
          hints: { H1: bi('Напечатайте `diff`, пробел и два имени файлов через пробел.', '`diff`, a space and two file names separated by a space.') },
        },
        {
          id: 'agree',
          prompt: bi('В этих копиях случай другой, чем в истории урока: Анна цену чёрного чая не трогала, а Борис поднял её с 250 до 280, поэтому копии различаются одной строчкой. Анна согласна с новой ценой. Сделайте общую копию `menu.txt` из файла Бориса командой `cp menu-boris.txt menu.txt`.', 'These copies show a different case from the lesson’s story: Anna did not touch the black tea price, while Boris raised it from 250 to 280, so the copies differ in one line. Anna agrees with the new price. Make the shared copy `menu.txt` from Boris’s file with the command `cp menu-boris.txt menu.txt`.'),
          check: { when: "files['/home/learner/menu/menu.txt'].text~'Black tea — 280'" },
          chips: 'cp menu-boris.txt menu.txt',
          docRef: man('cp.1'),
          concepts: ['orient.collaboration'],
          hints: { H1: bi('Команда `cp` копирует файлы, и после неё сначала пишут, что копировать, а потом куда.', '`cp` is copy: first what to copy, then where to.') },
        },
      ],
    },
    {
      id: 'find',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Программы совместной работы показывают правки в особом, «объединённом» виде, который по-английски называется unified: вокруг изменённой строчки видны соседние строчки, а сами изменения отмечены знаками `-` и `+`. У команды `diff` есть опция, которая включает такой вид. Найдите её в справке по слову unified и сравните копии Анны и Бориса в этом виде.', 'Collaboration programs show edits in a special “unified” form (that is the English word to look for), with lines around the change and the signs `-` and `+`. `diff` has an option for this form. Find it in the help by the word unified and compare Anna’s and Boris’s copies that way.'),
      ref: man('diff.1', 'OPTIONS', 'unified'),
      terminal: {
        setup: twoCopies(),
        task: {
          id: 'unified',
          prompt: bi('Покажите разницу между `menu-anna.txt` и `menu-boris.txt` в объединённом виде.', 'Show the difference between `menu-anna.txt` and `menu-boris.txt` in unified form.'),
          check: { stdout: /@@ -1,4 \+1,4 @@/ },
          docRef: man('diff.1', 'OPTIONS', 'unified'),
          docStep: 2,
          concepts: ['orient.collaboration'],
          hints: { H1: bi('Поищите в разделе OPTIONS слово unified.', 'Look for the word “unified” in the OPTIONS section.') },
        },
      },
    },
    {
      id: 'programmer',
      kind: 'callout',
      tone: 'note',
      levels: ['experienced'],
      title: bi('Если вы программист', 'If you are a programmer'),
      body: bi(
        'Слияние на схеме устроено так же, как трёхстороннее слияние в `git merge`. Программа сравнивает обе копии не друг с другом, а с их общей исходной версией, поэтому знает, кто из двоих менял строчку, и соединяет правки в разных строчках без вопросов. Строчку, которую оба изменили по-разному, Git оставляет в файле в двух вариантах между метками `<<<<<<<`, `=======` и `>>>>>>>` и ждёт решения человека. Совет из итога урока держать правки маленькими и соединять их часто в Git означает ветки, которые сливают в общую копию через день-два после того, как их создали.',
        'The merge in the diagram works the same way as the three-way merge in `git merge`. The program compares both copies not with each other but with their common original version, so it knows which of the two changed a line and joins edits on different lines without questions. A line both changed differently Git leaves in the file in two variants between the markers `<<<<<<<`, `=======` and `>>>>>>>` and waits for a person to decide. The advice in the lesson’s summary to keep edits small and join them often means, in Git, branches merged into the shared copy a day or two after they were created.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: togetherQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Каждый правит свою копию. Программа слияния сама соединяет правки в разных строчках, а строчку, которую два человека изменили по-разному, отдаёт решать человеку. История помнит, кто, что и когда изменил. Без такой программы побеждает тот, кто сохранил файл последним. Чтобы правки реже сталкивались, их держат маленькими и соединяют часто.',
        'Everyone edits their own copy; the merge program joins edits on different lines by itself and hands a line with two edits to a person. The history remembers who changed what and when. Without such a program, whoever saved last wins. Edits are kept small and joined often.',
      ),
    },
  ],
};

// The whole-block review asks the same ideas under new conditions, so a learner
// who answered the lesson quizzes yesterday does not meet the same questions.
export const reviewQuiz: QuizItem[] = [
  {
    id: 'orient.q.r.saved-then',
    kind: 'mcq',
    concepts: ['orient.computer'],
    prompt: bi('Утром вы сохранили документ, а потом дописали к нему абзац и сохранить не успели. Батареи в ноутбуке нет, и он выключился, когда в доме пропал свет. Что вы найдёте, когда включите его снова?', 'In the morning you saved a document, then added a paragraph to it and did not save again. The laptop has no battery, and it switched off when the power went in the house. What will you find after switching it on?'),
    options: [
      { id: 'morning', text: bi('Документ в утреннем виде, без нового абзаца', 'The document as it was in the morning, without the new paragraph'), correct: true },
      { id: 'all', text: bi('Документ вместе с новым абзацем', 'The document together with the new paragraph'), why: bi('Новый абзац был только в памяти, а память пустеет, как только пропадает питание. На диске осталось то, что вы сохранили утром.', 'The new paragraph was only in memory, and memory empties as soon as the power goes. The disk holds what you saved in the morning.') },
      { id: 'none', text: bi('Ничего, потому что документ испортился целиком', 'Nothing, because the whole document is spoilt'), why: bi('Утренняя копия была записана на диск, а диску выключение не страшно.', 'The morning copy was written to the disk, and the disk does not mind a power-off.') },
    ],
    explain: bi('Кнопка «Сохранить» копирует текст из памяти на диск. Всё, что вы изменили после последнего сохранения, хранится только в памяти и пропадает вместе с питанием.', 'The “Save” button copies the text from memory to the disk. Everything changed after the last save is held only in memory and vanishes with the power.'),
  },
  {
    id: 'orient.q.r.four-programs',
    kind: 'mcq',
    concepts: ['orient.os'],
    prompt: bi('У процессора одно ядро, и четыре программы одновременно хотят считать без перерыва. Какую долю времени процессора получит каждая из них?', 'The processor has one core, and four programs all want to compute without a break. What share of the processor’s time will each of them get?'),
    options: [
      { id: 'quarter', text: bi('Около четверти, потому что система по очереди даёт процессор каждой программе', 'About a quarter, because the system gives the processor to each program in turn'), correct: true },
      { id: 'full', text: bi('Каждая получит всё время процессора', 'Each will get all of the processor’s time'), why: bi('В каждый момент одно ядро выполняет одну программу, поэтому время ядра делится между четырьмя программами.', 'At any moment one core runs one program, so the core’s time is divided among the four programs.') },
      { id: 'first', text: bi('Первая программа получит всё, а остальные будут ждать, пока она закончит', 'The first program will get everything, and the others will wait until it finishes'), why: bi('Тогда при одном ядре музыка не играла бы, пока вы пишете письмо. Система переключает процессор между программами каждые несколько миллисекунд.', 'Then, with one core, music would not play while you write a letter. The system switches the processor between programs every few milliseconds.') },
    ],
    explain: bi('Операционная система делит время ядра на короткие отрезки и раздаёт их по очереди. Четыре программы на одном ядре работают каждая примерно вчетверо медленнее, чем работала бы одна.', 'The operating system cuts the core’s time into short slices and hands them out in turn. Four programs on one core each run about four times slower than one alone would.'),
    refs: { explainer: 'orient.system' },
  },
  {
    id: 'orient.q.r.no-host',
    kind: 'mcq',
    concepts: ['orient.client-request', 'orient.network'],
    prompt: bi('Команда `curl https://shop.example/` печатает `Could not resolve host: shop.example`. На каком звене искать неисправность?', 'The command `curl https://shop.example/` prints `Could not resolve host: shop.example`. At which link should the fault be looked for?'),
    options: [
      { id: 'name', text: bi('Имя не превратилось в адрес, поэтому запрос даже не ушёл к серверу', 'The name did not turn into an address, so the request did not even leave for the server'), correct: true },
      { id: 'stopped', text: bi('Программа магазина на сервере остановлена', 'The shop program on the server is stopped'), why: bi('Тогда `curl` сразу получил бы отказ в соединении, Connection refused. Для отказа запрос должен дойти до машины, а здесь клиент даже не узнал её адреса.', 'Then `curl` would at once get a refusal, Connection refused. For a refusal the request has to reach the machine, and here the client did not even learn its address.') },
      { id: 'busy', text: bi('Сервер перегружен покупателями', 'The server is overloaded with shoppers'), why: bi('Перегруженный сервер отвечает числом 503, но для этого запрос тоже должен до него дойти.', 'An overloaded server answers with 503, but for that, too, the request has to reach it.') },
    ],
    explain: bi('Каждое из трёх сообщений указывает на своё звено. Ненайденное имя означает, что запрос не ушёл, отказ означает, что машина на связи, а программа нет, а 503 означает, что запрос дошёл, но сервер не справляется.', 'Each of the three messages points to its own link. An unresolved name means the request never left, a refusal means the machine is reachable and the program is not, and 503 means the request arrived but the server cannot cope.'),
  },
  {
    id: 'orient.q.r.sale-bill',
    kind: 'mcq',
    concepts: ['orient.cloud'],
    prompt: bi('Машину за два цента в час арендовали на трёхдневную распродажу, а удалить забыли, и она простояла ещё месяц. Во сколько раз счёт оказался больше, чем был бы при удалении сразу после распродажи?', 'A machine at two cents an hour was taken for a three-day sale and then forgotten, so it stood for another month. How many times bigger is the bill than it would have been had the machine been deleted right after the sale?'),
    options: [
      { id: 'eleven', text: bi('Примерно в одиннадцать раз', 'About eleven times'), correct: true, why: bi('Три дня распродажи составляют 72 часа, то есть 1,44 доллара. С забытым месяцем набирается 72 + 720 = 792 часа, то есть 15,84 доллара, а это в одиннадцать раз больше.', 'The three days of the sale are 72 hours, or $1.44. With the forgotten month there are 72 + 720 = 792 hours, or $15.84, that is, eleven times more.') },
      { id: 'same', text: bi('Счёт не изменился, потому что после распродажи машина простаивала', 'The bill did not change, because after the sale the machine stood idle'), why: bi('В облаке платят за то, что машина существует, а не за работу, которую она делает.', 'In the cloud you pay for the machine existing, not for the work it does.') },
      { id: 'twice', text: bi('Примерно вдвое', 'About twice'), why: bi('Месяц длится 720 часов, а распродажа шла 72 часа, поэтому забытый месяц стоит вдесятеро больше самой распродажи.', 'A month lasts 720 hours and the sale ran for 72, so the forgotten month costs ten times as much as the sale itself.') },
    ],
    refs: { explainer: 'orient.rent' },
  },
  {
    id: 'orient.q.r.semver-ten',
    kind: 'mcq',
    concepts: ['orient.version'],
    prompt: bi('У программы версия 2.9.9. В неё добавили новую возможность, а всё старое работает как прежде. Какой номер получит выпуск?', 'A program is at version 2.9.9. A new feature was added, and everything old works as before. What number will the release get?'),
    options: [
      { id: 'ten', text: '2.10.0', correct: true },
      { id: 'major', text: '3.0.0', why: bi('Числа в номере версии не переносятся, как разряды в обычной записи числа. Первое число растёт только при несовместимом изменении, а здесь всё старое работает.', 'The numbers in a version do not carry over like the digits of an ordinary number. The first one grows only with an incompatible change, and here everything old still works.') },
      { id: 'patch', text: '2.9.10', why: bi('Последнее число растёт при исправлении ошибки, а новая возможность увеличивает среднее и обнуляет последнее.', 'The last number grows for a bug fix, while a new feature raises the middle one and resets the last.') },
    ],
    explain: bi('Каждое из трёх чисел считают отдельно, и после девяти идёт десять. Номер 2.10.0 больше, чем 2.9.9, хотя если сравнивать номера как слова, знак за знаком слева направо, он кажется меньшим.', 'Each of the three numbers is counted separately, and ten follows nine. The number 2.10.0 is greater than 2.9.9, although compared as strings of text it looks smaller.'),
  },
  {
    id: 'orient.q.r.prod-only',
    kind: 'mcq',
    concepts: ['orient.config', 'orient.environments'],
    prompt: bi('На тестовом стенде программа запускается, а в рабочем окружении сразу печатает ошибку и останавливается. Сборка в обоих окружениях одна и та же. С чего разумно начать?', 'On the test stand the program starts, but in production it prints an error at once and stops. The build is one and the same in both environments. Where is it sensible to start?'),
    options: [
      { id: 'diff', text: bi('Сравнить построчно файлы настроек двух окружений, а потом версии системы и программ на обеих машинах', 'Compare line by line the settings files of the two environments, then the versions of the system and programs on both machines'), correct: true },
      { id: 'rebuild', text: bi('Собрать отдельную программу специально для рабочего окружения', 'Build a separate program specially for production'), why: bi('Тогда к покупателям попадёт сборка, которую на стенде никто не проверял. Сборка одна и та же, значит, причина в том, что лежит рядом с ней.', 'Then the customers would get a build nobody checked on the stand. The build is the same, so the cause lies in what is next to it.') },
      { id: 'code', text: bi('Читать исходный код в поисках ошибки', 'Read the source code looking for the bug'), why: bi('Этот же код работает на стенде. Читать его стоит после того, как вы убедились, что настройки и окружения не различаются.', 'This same code works on the stand. It is worth reading after you have made sure that the settings and the environments do not differ.') },
    ],
    refs: { explainer: 'orient.places' },
  },
  {
    id: 'orient.q.r.two-lines',
    kind: 'mcq',
    concepts: ['orient.collaboration'],
    prompt: bi('Анна поменяла в меню цену улуна, а Борис в тот же день поменял цену чёрного чая, то есть другую строчку. Что сделает программа слияния?', 'Anna changed the oolong price in the menu, and Boris on the same day changed the black tea price, that is, another line. What will the merge program do?'),
    options: [
      { id: 'join', text: bi('Сама соединит обе правки, и в общей копии окажутся обе новые цены', 'Join both edits by itself, and the shared copy will have both new prices'), correct: true },
      { id: 'ask', text: bi('Попросит человека выбрать одну из правок', 'Ask a person to choose one of the edits'), why: bi('Человека зовут, только когда одну и ту же строчку изменили по-разному. Правки в разных строчках друг другу не мешают.', 'A person is called only when one and the same line was changed in different ways. Edits on different lines do not get in each other’s way.') },
      { id: 'last', text: bi('Оставит правку того, кто прислал её последним', 'Keep the edit of whoever sent it last'), why: bi('Так ведёт себя пересылка файла почтой, от которой программа слияния и защищает.', 'That is how sending the file by email behaves, which is exactly what the merge program protects against.') },
    ],
    refs: { explainer: 'orient.together' },
  },
];

// ── 10. Who does what in an IT team ────────────────────────────────────────

export const teamQuiz: QuizItem[] = [
  {
    id: 'orient.q.path-order',
    kind: 'order',
    key: true,
    concepts: ['orient.roles', 'orient.environments', 'orient.source-build'],
    prompt: bi('Расставьте по порядку путь изменения от идеи до покупателя.', 'Put in order the path of a change from an idea to the customer.'),
    steps: [
      { id: 'idea', text: bi('аналитик описывает, что нужно покупателям', 'an analyst describes what the customers need') },
      { id: 'code', text: bi('программист правит исходный код в своей копии', 'a programmer edits the source code in their copy') },
      { id: 'merge', text: bi('правку соединяют с общей копией', 'the edit is joined with the shared copy') },
      { id: 'build', text: bi('программу собирают и дают выпуску номер версии', 'the build and a version number') },
      { id: 'test', text: bi('выпуск проверяют на тестовом стенде', 'checking on the test stand') },
      { id: 'prod', text: bi('выпуск выкладывают в рабочее окружение', 'deploying to production') },
    ],
    explain: bi('В этом ряду собрана вся цепочка из этого блока. Каждое звено можно выполнять руками или поручить машине, и от этого зависит, сколько времени изменение идёт до покупателя и как часто оно что-нибудь ломает.', 'The whole block in one chain. Each link can be done by hand or handed to a machine, and that decides how long a change takes to reach the customer and how often it breaks.'),
  },
  {
    id: 'orient.q.roles',
    kind: 'match',
    concepts: ['orient.roles'],
    prompt: bi('Кто в команде чем занят? Сопоставьте роль и работу.', 'Who in the team does what? Match them.'),
    pairs: [
      { id: 'dev', left: bi('Разработчик', 'Developer'), right: bi('пишет и правит исходный код', 'writes and edits source code') },
      { id: 'qa', left: bi('Тестировщик', 'Tester'), right: bi('ищет ошибки до того, как их найдут покупатели', 'looks for errors before customers find them') },
      { id: 'ops', left: bi('Инженер эксплуатации', 'Operations engineer'), right: bi('следит, чтобы серверы и программы на них работали', 'makes sure the servers and their programs keep working') },
      { id: 'path', left: bi('Инженер, к которому ведёт этот курс', 'The engineer this course leads to'), right: bi('делает путь от правки до рабочего окружения быстрым, надёжным и повторяемым', 'makes the path from an edit to production fast, reliable and repeatable') },
    ],
    explain: bi('Последняя роль и есть та, к которой вы идёте. Как она называется и почему она появилась, рассказывает следующий блок.', 'The last role is the one you are heading for. What it is called and why it appeared is told in the next block.'),
  },
  {
    id: 'orient.q.night-call',
    kind: 'multi',
    concepts: ['orient.roles', 'orient.server', 'orient.config'],
    prompt: bi('В два часа ночи сайт магазина перестал открываться. С каких вопросов разумно начать?', 'At two in the morning the shop’s site stopped opening. Which questions are sensible to start with?'),
    options: [
      { id: 'on', text: bi('Включена ли машина и запущена ли на ней программа?', 'Is the machine on, and is the program running on it?'), correct: true },
      { id: 'net', text: bi('Доходят ли до неё запросы по сети?', 'Do requests reach it over the network?'), correct: true },
      { id: 'what', text: bi('Что меняли последним, версию или настройки?', 'What was changed last: the version, the settings?'), correct: true },
      { id: 'who', text: bi('Кто из программистов виноват?', 'Which programmer is to blame?'), why: bi('Ночью важно только то, как вернуть сайт. Почему это случилось, разбирают потом, и ищут при этом не виноватого, а причину.', 'At night there is one question: how to bring the site back. Why it happened is examined later, and what is sought is the cause, not a culprit.') },
    ],
    explain: bi('Каждый из трёх вопросов вы уже умеете задать по существу. Про машину и программу рассказывал урок о серверах, про сеть — урок о сети, а про последние изменения — уроки о версиях и настройках.', 'Each of the three questions you can already ask properly: the machine and program from the lesson on servers, the network from the lesson on networks, the latest changes from the lessons on versions and settings.'),
  },
];

/** Hours of the whole route for a level, rounded to tens, and months at a weekly pace. */
const routeHours = (lv: Level): number => Math.round(ROUTE.reduce((a, r) => a + r.hours[lv], 0) / 10) * 10;
const monthsAt = (lv: Level, perWeek: number): number => Math.round(routeHours(lv) / ((perWeek * 52) / 12));
const monthsRu = (n: number): string => `${n} ${pluralRu(n, ['месяц', 'месяца', 'месяцев'])}`;
const ORIENT_HOURS = ROUTE.find((r) => r.id === 'orient')!.hours.beginner;

export const teamLesson: Lesson = {
  id: 'orient.team',
  block: 'orient',
  title: bi('Кто чем занят в IT-команде', 'Who does what in an IT team'),
  summary: bi('Разработка, тестирование и эксплуатация, а также работа, которая связывает их в один путь от правки до покупателя.', 'Development, testing, operations, and the work that ties them into one path from an edit to the customer.'),
  introduces: ['orient.roles'],
  uses: ['orient.server', 'orient.cloud', 'orient.source-build', 'orient.version', 'orient.environments', 'orient.config', 'orient.collaboration'],
  tier: 'core',
  minutes: 20,
  sources: sources([EN.softwareDev, EN.testing, EN.sysadmin], [RU.softwareDev, RU.testing, RU.sysadmin]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'За девять уроков вы прошли путь, который каждый день проделывает любое изменение в любой IT-компании. Кто-то решил, что покупателям нужна оплата картой. Программист написал код в своей копии, правку соединили с общей копией, программу собрали, дали выпуску номер, проверили его на стенде и выложили в рабочее окружение вместе с его файлом настроек, на сервер, который, скорее всего, стоит в облаке. Осталось понять, кто из людей отвечает за какое звено и что в этой цепочке будете делать вы.',
        'In nine lessons you have walked the path every change takes every day in any IT company. Someone decided customers need card payments. A programmer wrote the code in their copy, the edit was joined with the shared one, built, given a number, checked on the stand and deployed to production with its settings file, onto a server that most likely stands in the cloud. What remains is to see which people answer for which link and what you will be doing in this chain.',
      ),
    },
    {
      id: 'roles',
      kind: 'text',
      step: 'explain',
      title: bi('Люди на пути изменения', 'The people along a change’s path'),
      body: bi(
        'В небольшой IT-команде у каждого звена есть хозяин, и вместе эти хозяева образуют привычные [[orient.roles|роли]].\n\n**Аналитик** или менеджер продукта выясняет, что нужно людям, и описывает задачу. **Разработчик** пишет и правит исходный код. **Тестировщик** ищет ошибки до того, как их найдут покупатели, вручную и с помощью тестов, которые запускает машина. **Инженер эксплуатации**, которого ещё называют системным администратором, отвечает за то, чтобы серверы работали, программы на них были запущены, места на дисках хватало, а если ночью что-то сломалось, работу сайта восстановили.\n\nДолгое время между разработкой и эксплуатацией стояла стена. Разработчики хотели выпускать изменения чаще, потому что покупатели платят за новые возможности. Эксплуатация хотела менять всё как можно реже, потому что любое изменение может вывести рабочее окружение из строя. Программы собирали вручную, на стенд выкладывали раз в месяц, в рабочее окружение — по выходным, а файлы настроек хранились на серверах в единственном экземпляре.\n\nРабота, к которой ведёт этот курс, состоит в том, чтобы эту стену разобрать. Такой инженер строит путь от правки до рабочего окружения так, чтобы он был быстрым, надёжным и повторяемым. Сборка и проверки запускаются сами при каждой правке, окружения похожи друг на друга, серверы и их настройки описаны текстом и хранятся рядом с кодом, а за рабочим окружением следят приборы, которые зовут человека раньше, чем пожалуются покупатели. Как называется эта профессия, откуда она взялась и зачем она бизнесу, рассказывает следующий блок курса. А словарь, без которого его первая же страница звучала бы как иностранный язык, у вас теперь есть.',
        'In a small IT team each link has its owner, and together they make up the familiar [[orient.roles|roles]].\n\nAn **analyst** or product manager finds out what people need and describes the task. A **developer** writes and edits source code. A **tester** looks for errors before the customers find them, by hand and with tests a machine runs. An **operations engineer** (also called a system administrator) answers for the servers working, the programs on them running, the disks having room, and someone bringing things back up if something falls over at night.\n\nFor a long time a wall stood between development and operations. Developers wanted to release changes more often: customers pay for them. Operations wanted to change things less often: every change can bring production down. Builds were made by hand, the stand got a deployment once a month, production at weekends, and settings files lived on the servers in a single copy.\n\nThe work this course leads to is taking that wall down. Such an engineer builds the path from an edit to production so that it is fast, reliable and repeatable: the build and the checks run by themselves on every edit, the environments resemble each other, servers and their settings are described in text and kept next to the code, and production is watched by instruments that call a person before the customers complain. What this profession is called, where it came from and why a business needs it is told in the next block of the course. And the vocabulary without which its very first page would sound like a foreign language you now have.',
      ),
    },
    {
      id: 'chain',
      kind: 'text',
      step: 'explain',
      title: bi('Весь путь изменения одним списком', 'The whole path of a change in one list'),
      body: bi(
        'Ниже весь путь собран в один список, от покупателя к программисту, то есть в том порядке, в каком его проходят, когда ночью что-то сломалось. Для каждого звена сказано, что оно делает, как оно ломается и чем это проверить, а последним пунктом названо облако, на котором стоят все звенья. Эти команды или похожие на них вы уже набирали в уроках этого блока.\n\n- **Имя и адрес.** Клиент сначала узнаёт адрес сервера по его имени. Если имя не нашлось, `curl` печатает `Could not resolve host`, и запрос даже не уходит в сеть. Адрес, который соответствует имени, показывает первая строка ответа команды `ping -c 3 shop.example`.\n- **Сеть.** Сеть доставляет запрос до машины через сети нескольких провайдеров, от одного узла к другому. Если путь оборван, браузер долго ждёт и сообщает, что время вышло, а `ping` не получает ни одного ответа.\n- **Машина и программа.** Программа магазина на сервере принимает запрос и составляет ответ. Если машина включена, а программа остановлена, отказ в соединении приходит сразу, а если покупателей больше, чем успевает сервер, приходит ответ 503. Число в первой строке ответа показывает команда `curl -I https://shop.example/`.\n- **Настройки.** Программа читает файл настроек своего окружения. Если положили не тот файл, программа работает, но делает не то, как в истории с платежами, которые уходили в учебную систему. Файлы двух окружений сравнивают построчно командой `diff`.\n- **Выпуск.** В рабочем окружении работает выпуск с конкретным номером. Если после обновления что-то сломалось, первым делом узнают этот номер и сравнивают его с прошлым выпуском, который остался на полке и к которому можно вернуться. В учебном проекте номер записан в файле `VERSION`, и его показывает команда `cat VERSION`.\n- **Сборка.** Сборка превращает исходный код в то, что выкладывают. Опечатку в программе на Go сборка остановит, а в программе на Python опечатка дойдёт до пользователей, если её не поймают тесты.\n- **Слияние.** Программа совместной работы соединяет правки разных людей и помнит историю. Если файл пересылали почтой, чья-то правка пропадает молча, и найти её помогает команда `diff`, которая сравнивает две копии.\n- **Облако.** Машина из третьего звена стоит в дата-центре провайдера. Сгоревший сервер провайдер заменит сам, но данные, которые хранились только на машине, могут пропасть, а забытая машина ничего не ломает и только увеличивает счёт.\n\nВопрос о ночной поломке в проверке ниже идёт по этому же списку сверху вниз.',
        'Below, the whole path is gathered into one list, from the customer to the programmer, that is, in the order it is walked when something broke at night. For every link it says what the link does, how it breaks and how to check it, and the last item names the cloud all the links stand on. You have already typed these commands, or ones like them, in the lessons of this block.\n\n- **Name and address.** The client first learns the server’s address from its name. If the name is not found, `curl` prints `Could not resolve host`, and the request does not even leave for the network. The address that belongs to the name is shown by the first line of the answer of `ping -c 3 shop.example`.\n- **Network.** The network carries the request to the machine across the networks of several providers, from one node to the next. If the way is cut, the browser waits a long time and reports that the time ran out, and `ping` gets not a single answer.\n- **Machine and program.** The shop program on the server takes the request and puts the answer together. If the machine is on but the program is stopped, a refusal comes at once, and if there are more shoppers than the server manages, the answer is 503. The number in the first line of the answer is shown by `curl -I https://shop.example/`.\n- **Settings.** The program reads the settings file of its environment. If the wrong file was put there, the program works but does the wrong thing, as in the story of the payments that went to the pretend system. The files of two environments are compared line by line with `diff`.\n- **Release.** Production runs a release with a definite number. If something broke after an update, the first thing is to learn that number and compare it with the previous release, which is still on the shelf and can be brought back. In the training project the number is in the file `VERSION`, and `cat VERSION` shows it.\n- **Build.** The build turns source code into what is deployed. A typo in a Go program stops the build, while in a Python program a typo reaches the users unless tests catch it.\n- **Merge.** The collaboration program joins the edits of different people and remembers the history. If the file was sent around by email, someone’s edit vanishes silently, and `diff`, which compares two copies, helps to find it.\n- **Cloud.** The machine of the third link stands in the provider’s data centre. A burnt-out server the provider replaces itself, but data kept only on the machine may be lost, and a forgotten machine breaks nothing and only makes the bill grow.\n\nThe question about the night-time breakdown in the check below goes down this same list from top to bottom.',
      ),
    },
    {
      id: 'map',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      title: bi('Куда ведёт маршрут', 'Where the route leads'),
      body: bi(
        'Каждое понятие этого блока дальше разрастётся в целую главу. Операционную систему и команды подробно разбирает блок Linux, совместную работу над кодом — блок Git, а сеть, интернет, клиента и сервер — блок «Сети». Сборке, версиям и окружениям посвящены блоки о запуске программ в изоляции и о пути изменения до рабочего окружения. С облачными машинами вы будете работать в блоке Linux и в блоке об описании серверов кодом. А как следить за рабочим окружением, расскажет блок мониторинга.',
        'Every idea of this block becomes a whole chapter further on. The operating system and commands: the Linux block. Working on code together: the Git block. Networks, the internet, client and server: the Networks block. Builds, versions and environments: the blocks on running programs in isolation and on the path of a change to production. Cloud machines: Linux and the block on describing servers in code. And how to watch production: the monitoring block.',
      ),
    },
    {
      id: 'interview',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      title: bi('О чём спросят на первом собеседовании', 'What a first interview will ask'),
      body: bi(
        'Прямо о словах этого блока на собеседовании спрашивают редко, зато они спрятаны почти в каждом вопросе посложнее. Вот пять вопросов, которые задают чаще других, и уроки, в которых на них есть ответ.\n\n- «Что происходит, когда вы набираете адрес сайта в браузере и нажимаете Enter?» Ответ начинается в уроках «Сеть и интернет» и «Сервер, клиент и запрос», а целиком его разбирает блок «Сети».\n- «Чем память отличается от диска и почему компьютер работает медленно, когда памяти мало?» Ответ дан в уроке «Что внутри компьютера».\n- «Чем отказ в соединении отличается от истечения времени ожидания?» Ответ дан в уроке «Сервер, клиент и запрос».\n- «Почему настройки и пароли не хранят в коде?» Ответ дан в уроке «Где работает программа и откуда она берёт настройки».\n- «Что означают три числа в номере версии?» Ответ дан в уроке «Исходный код, сборка и версия».\n\nОтвечайте своими словами и с примером. Фраза «на стенде всё работало, а в рабочем окружении нет, потому что программа прочитала не тот файл настроек» убеждает собеседника лучше любого заученного определения.',
        'An interview rarely asks about the words of this block directly, but they are hidden in almost every harder question. Here are the five questions asked most often, and the lessons that answer them.\n\n- “What happens when you type a site’s address in the browser and press Enter?” The answer starts in the lessons “Networks and the internet” and “Server, client and request”, and the Networks block takes it apart in full.\n- “How does memory differ from the disk, and why is a computer slow when memory is short?” The answer is in “What is inside a computer”.\n- “How does a refused connection differ from a timeout?” The answer is in “Server, client and request”.\n- “Why are settings and passwords not kept in the code?” The answer is in “Where a program runs: environments and settings”.\n- “What do the three numbers in a version mean?” The answer is in “Source code, build and version”.\n\nAnswer in your own words and with an example. The sentence “on the stand everything worked and in production it did not, because the program read the wrong settings file” convinces the interviewer better than any definition learnt by heart.',
      ),
    },
    {
      id: 'pace',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Сколько займёт путь и что из него не нужно сразу', 'How long the path takes and what of it is not needed at once'),
      body: bi(
        `Дорожные карты профессии, которые ходят по интернету, перечисляют сотню программ, и при взгляде на них легко решить, что всё это нужно выучить до первой работы. На первой работе от новичка ждут не знакомства с сотней программ, а уверенной базы. Он должен понимать устройство машины, сети и путь изменения настолько, чтобы самому найти, на каком звене цепочки случилась беда. Названия десятка похожих программ эту базу не заменяют, а на собеседовании быстро выясняется, где за названием нет понимания. Поэтому курс идёт вглубь, а не вширь, и из каждой группы похожих программ разбирает одну, самую распространённую.\n\nПо оценке курса весь маршрут занимает около ${routeHours('beginner')} часов на уровне «Новичок», около ${routeHours('intermediate')} часов на уровне «Средний» и около ${routeHours('experienced')} часов на уровне «Опытный». При пяти часах занятий в неделю новичок пройдёт его примерно за ${monthsRu(monthsAt('beginner', 5))}, а при десяти часах примерно за ${monthsRu(monthsAt('beginner', 10))}. Уровень выбирают для каждого блока отдельно, поэтому то, что вы уже знаете, займёт меньше времени. Сам этот блок занимает около ${ORIENT_HOURS} часов, то есть две-три недели вечерних занятий.\n\nЖдать конца маршрута, чтобы откликаться на вакансии, тоже не нужно. В блоке «Карьера» вы будете разбирать настоящие вакансии и познакомитесь с правилом, которым пользуются опытные соискатели: если вы подходите хотя бы на 60 % требований вакансии, откликайтесь, потому что списки требований нарочно составляют с запасом.`,
        `The roadmaps of the profession that circulate on the internet list a hundred programs, and looking at them it is easy to decide that all of it must be learnt before the first job. A first job expects from a newcomer not an acquaintance with a hundred programs but a confident base. The newcomer has to understand the machine, networks and the path of a change well enough to find on your own at which link of the chain the trouble happened. The names of a dozen similar programs do not replace that base, and an interview quickly shows where there is no understanding behind a name. That is why the course goes deep rather than wide and, from every group of similar programs, takes apart one, the most widespread.\n\nBy the course’s estimate the whole route takes about ${routeHours('beginner')} hours at the Beginner level, about ${routeHours('intermediate')} hours at Intermediate and about ${routeHours('experienced')} hours at Experienced. At five hours of study a week a beginner covers it in about ${monthsAt('beginner', 5)} months, and at ten hours in about ${monthsAt('beginner', 10)} months. The level is chosen for every block separately, so what you already know takes less time. This block itself takes about ${ORIENT_HOURS} hours, that is, two or three weeks of evening study.\n\nThere is no need to wait for the end of the route to apply for jobs either. In the Career block you will take real job postings apart and meet the rule experienced applicants use: if you match at least 60% of a posting’s requirements, apply, because the lists of requirements are written with a margin on purpose.`,
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: teamQuiz.map((q) => q.id) },
    {
      id: 'review',
      kind: 'quiz',
      step: 'review',
      title: bi('Повторим весь блок', 'Review the whole block'),
      items: reviewQuiz.map((q) => q.id),
    },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Разработчик пишет код, тестировщик ищет ошибки, а инженеры эксплуатации следят, чтобы серверы работали. Инженер, к которому ведёт курс, связывает их работу в один быстрый и надёжный путь от правки до рабочего окружения. Дальше идёт блок методологии, который объясняет, зачем всё это бизнесу и как измерить, что путь стал лучше.',
        'The developer writes code, the tester looks for errors, operations keeps the servers going. The engineer this course leads to ties their work into one fast and reliable path from an edit to production. Next comes methodology: why a business needs it and how to measure that the path got better.',
      ),
    },
  ],
};
