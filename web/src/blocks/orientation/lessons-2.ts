// Orientation, lessons 6–10: the cloud, source code and versions,
// environments and configuration, working on code together, and the roles
// of an IT team (01 §6.2: F08–F12, plus the cloud and the roles).

import { bi } from '../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../core/types';
import { APP_SH, EN, man, project, RU, settings, sources, twoCopies } from './shared';

// ── 6. The cloud ───────────────────────────────────────────────────────────

export const rentQuiz: QuizItem[] = [
  {
    id: 'orient.q.cloud-is',
    kind: 'mcq',
    key: true,
    concepts: ['orient.cloud'],
    prompt: bi('Что на самом деле стоит за словами «запустим в облаке»?', 'What really stands behind the words “let us run it in the cloud”?'),
    options: [
      { id: 'rent', text: bi('Чужие серверы в чужом дата-центре, которые берут напрокат и оплачивают по часам', 'Somebody else’s servers in somebody else’s data centre, hired and paid for by the hour'), correct: true },
      { id: 'air', text: bi('Программы, которые работают без всяких компьютеров, прямо в интернете', 'Programs that run without any computers, right in the internet'), why: bi('Любая программа работает на чьём-то компьютере. В облаке он просто не ваш и стоит не у вас.', 'Every program runs on someone’s computer. In the cloud it is simply not yours and stands somewhere else.') },
      { id: 'disk', text: bi('Только хранилище для фотографий', 'Only a store for photos'), why: bi('Хранилище — одна из услуг облака. Главная — машины напрокат, на которых работает что угодно.', 'Storage is one of the cloud’s services. The main one is machines for hire that can run anything.') },
    ],
    explain: bi('Облако — это аренда: провайдер покупает железо, строит здание и следит за ним, а вы платите за кусочек и только за то время, пока он вам нужен.', 'The cloud is renting: the provider buys the hardware, puts up the building and looks after it, and you pay for a slice and only for as long as you need it.'),
    refs: { explainer: 'orient.rent' },
  },
  {
    id: 'orient.q.idle-bill',
    kind: 'mcq',
    concepts: ['orient.cloud'],
    prompt: bi('Машина в облаке включена, но ничего не делает: проект закончился неделю назад. Что со счётом?', 'A cloud machine is on but does nothing: the project ended a week ago. What about the bill?'),
    options: [
      { id: 'ticks', text: bi('Растёт: платят за то, что машина существует, а не за пользу', 'It grows: you pay for the machine existing, not for usefulness'), correct: true },
      { id: 'zero', text: bi('Не растёт: машина простаивает', 'It does not grow: the machine is idle'), why: bi('Провайдер держит для вас процессор и память, даже когда вы ими не пользуетесь, и берёт за это деньги.', 'The provider keeps a processor and memory for you even when you do not use them, and charges for it.') },
    ],
    explain: bi('Поэтому в этом курсе у каждого урока с облачными машинами есть шаг «Уборка»: всё, что создали, удаляют в конце.', 'That is why every lesson with cloud machines in this course has a “Cleanup” step: everything created is deleted at the end.'),
    refs: { explainer: 'orient.rent' },
  },
  {
    id: 'orient.q.cloud-why',
    kind: 'multi',
    concepts: ['orient.cloud'],
    prompt: bi('Почему компании берут машины в облаке, а не покупают свои?', 'Why do companies take machines in the cloud rather than buy their own?'),
    options: [
      { id: 'fast', text: bi('Машину можно получить за минуту, а не ждать поставки неделями', 'A machine can be had in a minute instead of waiting weeks for delivery'), correct: true },
      { id: 'short', text: bi('Можно взять на три дня распродажи и вернуть', 'You can take it for a three-day sale and give it back'), correct: true },
      { id: 'hw', text: bi('Железо, электричество и охрану берёт на себя провайдер', 'The provider takes care of the hardware, electricity and security'), correct: true },
      { id: 'free', text: bi('Это всегда дешевле своих серверов', 'It is always cheaper than own servers'), why: bi('Не всегда: машина, которая нужна круглый год на полную мощность, за несколько лет аренды обходится дороже собственной. Облако выигрывает скоростью и гибкостью.', 'Not always: a machine needed at full power all year round costs more to rent over several years than to own. The cloud wins on speed and flexibility.') },
    ],
    explain: bi('Облако продаёт гибкость: взять сколько нужно и когда нужно. За эту гибкость платят, поэтому за счётом следят.', 'The cloud sells flexibility: take as much as needed when needed. That flexibility is paid for, so people watch the bill.'),
  },
  {
    id: 'orient.q.fire',
    kind: 'mcq',
    concepts: ['orient.cloud'],
    prompt: bi('Ночью в дата-центре сгорел сервер, на котором была ваша облачная машина. Чья это забота?', 'At night the server holding your cloud machine burnt out in the data centre. Whose worry is it?'),
    options: [
      { id: 'split', text: bi('Железо чинит провайдер, а копии важных данных — ваша забота', 'The provider fixes the hardware; copies of important data are your worry'), correct: true },
      { id: 'prov', text: bi('Целиком провайдера: он вернёт и машину, и все данные', 'Entirely the provider’s: it returns both the machine and all the data'), why: bi('Машину провайдер поднимет на другом сервере, но то, что лежало только на ней, может пропасть. Копии делает владелец данных.', 'The provider brings the machine up on another server, but whatever lay only on it may be lost. Copies are made by the owner of the data.') },
      { id: 'mine', text: bi('Целиком ваша: придётся ехать и менять железо', 'Entirely yours: you will have to go and replace the hardware'), why: bi('В чужой дата-центр вас не пустят, да и не нужно: железо — работа провайдера.', 'You would not be let into someone else’s data centre, nor is there any need: hardware is the provider’s job.') },
    ],
    refs: { explainer: 'orient.rent' },
  },
];

export const rentLesson: Lesson = {
  id: 'orient.rent',
  block: 'orient',
  title: bi('Облако: чужие серверы напрокат', 'The cloud: somebody else’s servers for hire'),
  summary: bi('Что значит «в облаке», за что именно платят и почему ненужную машину удаляют сразу.', 'What “in the cloud” means, what exactly is paid for and why an unneeded machine is deleted at once.'),
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
        'Через месяц у чайного магазина большая распродажа, и одного сервера не хватит. Купить ещё три — значит заплатить сразу, ждать поставки несколько недель, найти им место, электричество и охлаждение, а после распродажи оставить их пылиться. Есть другой путь: взять три сервера напрокат на четыре дня и вернуть. Его называют облаком.',
        'In a month the tea shop has a big sale, and one server will not be enough. Buying three more means paying up front, waiting weeks for delivery, finding them room, electricity and cooling, and after the sale leaving them to gather dust. There is another way: hire three servers for four days and give them back. It is called the cloud.',
      ),
    },
    {
      id: 'cloud',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое облако', 'What the cloud is'),
      body: bi(
        '[[orient.cloud|Облако]] — это чужие серверы, которые берут напрокат. Провайдер — большая компания — строит дата-центры, ставит в них тысячи серверов и сдаёт их по кусочку. Вы открываете его сайт, выбираете размер машины («2 процессора, 4 гигабайта памяти»), операционную систему и город, нажимаете «Создать» — и через минуту у вас есть сервер со своим адресом в интернете. С ним говорят командами по сети, как с любым другим.\n\nНикакого волшебства в слове нет. Ваша машина — это кусок настоящего большого сервера: провайдер делит каждый на несколько отдельных машин для разных клиентов, и соседей вы не видите. Как такое деление устроено, подробно разберёт один из следующих блоков; здесь важно другое — **за что платят**.\n\nПлатят за время, пока машина существует, обычно по часам или даже по секундам. Машина, которая простояла месяц без дела, стоит столько же, сколько машина, которая весь месяц работала. Отсюда главное правило облака: ненужное удаляют сразу. Самая частая лишняя трата в облаке — не дорогая машина, а забытая.\n\nВзамен вы получаете скорость и гибкость. Сервер появляется за минуту, а не за месяц. Его можно взять на три дня распродажи. Железо, электричество, охрану и замену сгоревших деталей берёт на себя провайдер. А вот копии ваших данных — по-прежнему ваша забота: если сервер под вашей машиной сгорит, провайдер поднимет её в другом месте, но то, что лежало только на ней, может пропасть.',
        'The [[orient.cloud|cloud]] is somebody else’s servers for hire. A provider, a big company, puts up data centres, puts thousands of servers in them and rents them out in slices. You open its site, choose the size of the machine (“2 processors, 4 gigabytes of memory”), the operating system and the city, press “Create”, and a minute later you have a server with its own address on the internet. You talk to it with commands over the network, like any other.\n\nThere is no magic in the word. Your machine is a slice of a real big server: the provider divides each one into several separate machines for different customers, and you do not see your neighbours. How such division works is taken apart in one of the later blocks; what matters here is **what you pay for**.\n\nYou pay for the time the machine exists, usually by the hour or even by the second. A machine that stood idle for a month costs as much as one that worked all month. Hence the main rule of the cloud: what is not needed is deleted at once. The most common wasted spend in the cloud is not an expensive machine but a forgotten one.\n\nIn return you get speed and flexibility. A server appears in a minute, not a month. It can be taken for the three days of a sale. The hardware, electricity, security and replacing burnt-out parts are the provider’s job. Copies of your data, however, are still your worry: if the server under your machine burns out, the provider brings it up elsewhere, but whatever lay only on it may be lost.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.rent', caption: bi('Поменяйте размер и число машин, посмотрите на счёт. Потом «забудьте» удалить машину — и сожгите стойку.', 'Change the size and number of machines and watch the bill. Then “forget” to delete the machine, and burn the rack.') },
    {
      id: 'cost',
      kind: 'callout',
      tone: 'cost',
      step: 'explain',
      title: bi('Сколько это стоит', 'What it costs'),
      body: bi(
        'Небольшая машина (2 процессора, 2 ГБ памяти) у недорогих провайдеров стоит около двух центов в час — примерно 15 долларов, если оставить её на месяц. Машина в восемь раз мощнее стоит примерно в восемь раз дороже. Дальше по курсу, когда вы будете заказывать настоящие машины, каждый такой урок начнётся с экрана стоимости и закончится уборкой.',
        'A small machine (2 processors, 2 GB of memory) costs about two cents an hour at inexpensive providers, roughly 15 dollars if left on for a month. A machine eight times more powerful costs about eight times more. Later in the course, when you order real machines, every such lesson starts with a cost screen and ends with a cleanup.',
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
        'Облако — чужие серверы напрокат: машина за минуту, оплата за время, пока она существует. Железо — забота провайдера, данные — ваша. Ненужное удаляют сразу.',
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
      { id: 'ok', text: bi('Исходный код — текст для людей; сборка превращает его в то, что запускает машина', 'Source code is text for people; the build turns it into what the machine runs'), correct: true },
      { id: 'same', text: bi('Ничем, это два названия одного файла', 'Nothing, these are two names for one file'), why: bi('Для скриптовых языков они действительно похожи, но и там сборка добавляет всё, что нужно программе, а для компилируемых языков результат — совсем другой файл, из инструкций процессора.', 'For scripting languages they are indeed close, but even there the build adds everything the program needs, and for compiled languages the result is a quite different file of processor instructions.') },
      { id: 'secret', text: bi('Исходный код — зашифрованная программа', 'Source code is an encrypted program'), why: bi('Шифра нет: исходный код написан людьми, чтобы его читали люди.', 'There is no cipher: source code is written by people for people to read.') },
    ],
    explain: bi('Исходный код читают и правят, сборку запускают. Между ними всегда есть шаг, и на нём ловят часть ошибок.', 'Source code is read and edited, the build output is run. There is always a step between them, and some errors are caught at it.'),
    refs: { explainer: 'orient.release' },
  },
  {
    id: 'orient.q.semver',
    kind: 'match',
    concepts: ['orient.version'],
    prompt: bi('Программа была версии 2.3.1. Сопоставьте изменение и новый номер.', 'The program was at version 2.3.1. Match the change with the new number.'),
    pairs: [
      { id: 'fix', left: bi('исправили ошибку', 'fixed a bug'), right: '2.3.2' },
      { id: 'feat', left: bi('добавили функцию, старое работает как прежде', 'added a feature, the old works as before'), right: '2.4.0' },
      { id: 'break', left: bi('изменили так, что старые настройки больше не подходят', 'changed things so that old settings no longer fit'), right: '3.0.0' },
    ],
    explain: bi('Это правила семантического версионирования: последняя цифра — исправления, средняя — новое без поломок, первая — несовместимые изменения. По номеру пользователь понимает, можно ли обновиться не глядя.', 'These are the rules of semantic versioning: the last digit is fixes, the middle one new things without breakage, the first one incompatible changes. From the number a user understands whether it is safe to upgrade without looking.'),
    refs: { explainer: 'orient.release' },
  },
  {
    id: 'orient.q.why-numbers',
    kind: 'mcq',
    concepts: ['orient.version'],
    prompt: bi('Пользователь пишет: «В новой версии сломалась корзина». Чем поможет номер версии?', 'A user writes: “The cart broke in the new version.” How does the version number help?'),
    options: [
      { id: 'find', text: bi('По номеру найдут, что изменилось с прошлого выпуска, и при нужде вернут прежний', 'By the number one finds what changed since the previous release and brings the previous one back if needed'), correct: true },
      { id: 'none', text: bi('Ничем: номер — просто украшение', 'Not at all: the number is just decoration'), why: bi('Без номера неизвестно, о каком выпуске речь и к какому возвращаться.', 'Without a number nobody knows which release is meant or which to go back to.') },
    ],
    refs: { explainer: 'orient.release' },
  },
  {
    id: 'orient.q.typo-where',
    kind: 'mcq',
    concepts: ['orient.source-build'],
    prompt: bi('В коде на Python опечатка в имени функции, в редко используемой ветке. Когда её заметят, если тестов нет?', 'A Python program has a typo in a function name, in a rarely used branch. When will it be noticed if there are no tests?'),
    options: [
      { id: 'users', text: bi('Когда пользователь дойдёт до этого места', 'When a user reaches that spot'), correct: true },
      { id: 'build', text: bi('На сборке, как в Go', 'At the build, as in Go'), why: bi('Сборка скриптового языка упаковывает код, но не проверяет каждое имя. Компилятор Go проверил бы.', 'The build of a scripting language packs the code but does not check every name. The Go compiler would.') },
    ],
    explain: bi('Поэтому код проверяют до выпуска тестами — их запускает машина при каждой правке. Об этом подробно в блоке методологии.', 'That is why code is checked before release by tests, which a machine runs on every edit. More on this in the methodology block.'),
    refs: { explainer: 'orient.release' },
  },
];

export const releaseLesson: Lesson = {
  id: 'orient.release',
  block: 'orient',
  title: bi('Исходный код, сборка и версия', 'Source code, build and version'),
  summary: bi('Текст программы для людей, сборка для машины и номер выпуска, по которому видно, что изменилось.', 'The program’s text for people, the build for the machine, and a release number that tells what changed.'),
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
        'Покупатель жалуется: «После обновления не работает корзина». У магазина за этот месяц вышло четыре обновления, и разработчик спрашивает в ответ: «А у вас какое?» Покупатель не знает. Чтобы такой разговор вообще мог состояться, программа должна пройти путь от текста, который пишет человек, до пронумерованного выпуска, который ставят пользователи.',
        'A customer complains: “After the update the cart does not work.” The shop has had four updates this month, and the developer asks in reply: “Which one do you have?” The customer does not know. For such a conversation to be possible at all, a program has to travel from the text a person writes to a numbered release that users install.',
      ),
    },
    {
      id: 'source',
      kind: 'text',
      step: 'explain',
      title: bi('Исходный код и сборка', 'Source code and build'),
      body: bi(
        'Программу пишут не инструкциями процессора — это было бы невыносимо долго, — а на языке программирования: Go, Python, Java, JavaScript. Такой текст называется **исходным кодом**. Его пишут и читают люди, он лежит в обычных файлах, и в большом проекте его десятки тысяч строк.\n\nПроцессор исходный код выполнить не может. Нужен шаг, который превратит текст в то, что запускает машина, — [[orient.source-build|сборка]]. Для **компилируемых** языков вроде Go сборщик переводит весь текст в инструкции процессора и записывает их в один файл программы. По дороге он проверяет каждое имя, и опечатка останавливает сборку: ошибку ловят прежде, чем она дойдёт до людей. Для **скриптовых** языков вроде Python перевод происходит прямо во время работы, а сборка короче: она складывает код и всё, что ему нужно, в один архив. Каждое имя она не проверяет, и опечатку в редкой строчке может первым найти пользователь. Поэтому код ещё и проверяют тестами — но это тема методологии.\n\nВажно запомнить одно: исходный код правят, а запускают результат сборки. Между ними всегда есть шаг, и чем меньше в нём ручной работы, тем надёжнее.',
        'Programs are not written in processor instructions, which would take unbearably long, but in a programming language: Go, Python, Java, JavaScript. Such text is called **source code**. People write and read it, it lies in ordinary files, and a big project has tens of thousands of lines of it.\n\nThe processor cannot carry out source code. A step is needed that turns the text into what the machine runs: the [[orient.source-build|build]]. For **compiled** languages like Go the builder translates all the text into processor instructions and writes them into one program file. On the way it checks every name, and a typo stops the build: the error is caught before it reaches people. For **scripting** languages like Python the translation happens while the program runs, and the build is shorter: it packs the code and everything it needs into one archive. It does not check every name, and a typo in a rare line may be found first by a user. That is why code is also checked by tests, but that is a topic for methodology.\n\nRemember one thing: source code is what you edit, and the build output is what you run. There is always a step between them, and the less manual work in it, the more reliable it is.',
      ),
    },
    {
      id: 'version',
      kind: 'text',
      step: 'explain',
      title: bi('Выпуск и его номер', 'A release and its number'),
      body: bi(
        'Собранную программу, которую отдают пользователям, называют выпуском, и каждый выпуск получает номер — [[orient.version|версию]]. Самое распространённое правило нумерации, семантическое версионирование, пишет три числа через точку: `1.4.2`. Последнее растёт, когда исправили ошибку. Среднее — когда добавили новую возможность, а всё старое работает как прежде; последнее тогда обнуляется: `1.5.0`. Первое — когда изменили что-то так, что старое больше не подходит: `2.0.0`.\n\nНомер — не украшение. По нему пользователь понимает, можно ли обновиться не глядя. По нему команда находит, что изменилось между выпусками, а если новый подвёл — возвращает предыдущий: выпуск с номером после выхода не меняют никогда, он лежит на полке рядом с прежними. А покупатель из начала урока, назвав версию, сразу сузил бы поиск с четырёх обновлений до одного.',
        'A built program handed to users is called a release, and every release gets a number, a [[orient.version|version]]. The most common numbering rule, semantic versioning, writes three numbers separated by dots: `1.4.2`. The last one grows when a bug is fixed. The middle one when a new feature is added and everything old works as before; the last one is then reset: `1.5.0`. The first one when something was changed so that the old no longer fits: `2.0.0`.\n\nThe number is no decoration. From it a user understands whether it is safe to upgrade without looking. With it the team finds what changed between releases, and if a new one fails, brings back the previous one: a numbered release is never changed after it is out; it lies on the shelf next to the earlier ones. And the customer from the start of the lesson, by naming the version, would at once have narrowed the search from four updates to one.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.release', caption: bi('Выберите вид изменения и предскажите номер. Сделайте опечатку — сначала на Go, потом на Python.', 'Choose the kind of change and predict the number. Make a typo, first in Go, then in Python.') },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: project(),
      intro: bi('Маленький проект магазина: в папке `src` исходный код, в файле `VERSION` номер версии, а `build.sh` — сборка. Здесь программа скриптовая, поэтому сборка только копирует код в папку `dist` под именем с номером.', 'A small shop project: the folder `src` holds the source code, the file `VERSION` the version number, and `build.sh` is the build. The program here is a script, so the build only copies the code into the folder `dist` under a name with the number.'),
      tasks: [
        {
          id: 'read',
          prompt: bi('Посмотрите на исходный код: `cat src/greet.sh`. Это одна строчка, понятная человеку.', 'Look at the source code: `cat src/greet.sh`. It is one line a person can understand.'),
          check: { stdout: /Hello from the tea shop/ },
          chips: 'cat src/greet.sh',
          concepts: ['orient.source-build'],
          hints: { H1: bi('`cat` и путь к файлу.', '`cat` and the path to the file.') },
        },
        {
          id: 'build',
          prompt: bi('Соберите программу: `bash build.sh`. Сборка прочитает номер из `VERSION` и положит результат в `dist`.', 'Build the program: `bash build.sh`. The build reads the number from `VERSION` and puts the result into `dist`.'),
          check: { when: "files['/home/learner/shop/dist/greet-1.4.2.sh'].type=f" },
          chips: 'bash build.sh',
          docRef: man('bash.1', 'INVOCATION'),
          concepts: ['orient.source-build', 'orient.version'],
          hints: { H1: bi('`bash` и имя файла сборки: так запускают записанные в файл команды.', '`bash` and the name of the build file: this is how commands written in a file are run.') },
        },
        {
          id: 'run',
          prompt: bi('Запустите то, что получилось: `bash dist/greet-1.4.2.sh`.', 'Run what came out: `bash dist/greet-1.4.2.sh`.'),
          check: { stdout: /Hello from the tea shop/, when: "files['/home/learner/shop/dist/greet-1.4.2.sh'].type=f" },
          chips: 'bash dist/greet-1.4.2.sh',
          concepts: ['orient.source-build'],
          hints: { H1: bi('Путь к собранному файлу начинается с `dist/`.', 'The path to the built file starts with `dist/`.') },
        },
        {
          id: 'bump',
          prompt: bi('Вы исправили ошибку. Поднимите версию: запишите в `VERSION` новый номер по правилам из урока и соберите снова. Прежний выпуск должен остаться на месте.', 'You fixed a bug. Raise the version: write the new number into `VERSION` by the rules of the lesson and build again. The previous release must stay where it is.'),
          check: {
            when: "files['/home/learner/shop/dist/greet-1.4.3.sh'].type=f && files['/home/learner/shop/dist/greet-1.4.2.sh'].type=f",
            fail: [
              { if: "files['/home/learner/shop/dist/greet-1.5.0.sh'].type=f", say: bi('1.5.0 — это новая функция. Для исправления растёт последняя цифра.', '1.5.0 means a new feature. For a fix the last digit grows.') },
              { if: "files['/home/learner/shop/dist/greet-2.0.0.sh'].type=f", say: bi('2.0.0 — несовместимое изменение. Исправление ошибки меняет только последнюю цифру.', '2.0.0 is an incompatible change. A bug fix changes only the last digit.') },
            ],
          },
          chips: 'echo 1.4.3 > VERSION',
          concepts: ['orient.version'],
          hints: { H1: bi('Знак `>` заменит содержимое `VERSION`.', 'The `>` sign replaces the contents of `VERSION`.'), H2: bi('После этого снова `bash build.sh`.', 'Then `bash build.sh` again.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: releaseQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Исходный код — текст программы для людей; сборка превращает его в то, что запускает машина, и у компилируемых языков заодно ловит опечатки. Выпуск получает номер: исправление — последняя цифра, новая функция — средняя, несовместимое изменение — первая. Выпуск с номером не меняют, к нему можно вернуться.',
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
      { id: 'prod', text: bi('прод', 'production') },
    ],
    explain: bi('Сначала программу пишут и пробуют у себя, потом проверяют на стенде, похожем на прод, и только потом выкладывают туда, где покупатели.', 'First the program is written and tried locally, then checked on a stand that resembles production, and only then deployed where the customers are.'),
    refs: { explainer: 'orient.places' },
  },
  {
    id: 'orient.q.config-why',
    kind: 'mcq',
    concepts: ['orient.config'],
    prompt: bi('Почему адрес платёжной системы и пароль к ней держат в файле настроек, а не в исходном коде?', 'Why are the payment system’s address and password kept in a settings file rather than in the source code?'),
    options: [
      { id: 'one', text: bi('Одна и та же сборка должна работать во всех окружениях, а отличаться только настройками', 'The same build must work in every environment and differ only in settings'), correct: true },
      { id: 'speed', text: bi('Так программа работает быстрее', 'The program runs faster that way'), why: bi('На скорость это не влияет. Дело в том, что с настройками в коде пришлось бы собирать отдельную программу на каждое окружение.', 'It does not affect speed. The point is that with settings in the code a separate program would have to be built for each environment.') },
      { id: 'pretty', text: bi('Так красивее', 'It looks nicer'), why: bi('Причина практическая: на прод должна уехать именно та сборка, которую проверили на стенде.', 'The reason is practical: exactly the build checked on the stand must go to production.') },
    ],
    explain: bi('И ещё одна причина: пароль в исходном коде увидит каждый, кто может читать код. Файл настроек прода видят только те, кому это нужно.', 'And one more reason: a password in source code is seen by everyone who can read the code. The production settings file is seen only by those who need it.'),
    refs: { explainer: 'orient.places' },
  },
  {
    id: 'orient.q.wrong-conf',
    kind: 'mcq',
    concepts: ['orient.config', 'orient.environments'],
    prompt: bi('Сайт работает, заказы идут, но деньги на счёт магазина не приходят. Что проверить первым?', 'The site works and orders come in, but no money reaches the shop’s account. What should be checked first?'),
    options: [
      { id: 'conf', text: bi('Какой файл настроек прочитала программа на проде', 'Which settings file the program in production has read'), correct: true },
      { id: 'code', text: bi('Исходный код корзины', 'The source code of the cart'), why: bi('На стенде та же сборка работала правильно — значит, отличается не код, а то, что рядом с ним.', 'On the stand the same build worked correctly, so it is not the code that differs but what is next to it.') },
      { id: 'disk', text: bi('Хватает ли места на диске', 'Whether there is enough disk space'), why: bi('Тогда сайт не принимал бы заказы. Здесь всё работает, просто платежи уходят не туда.', 'Then the site would not take orders. Here everything works, the payments just go to the wrong place.') },
    ],
    refs: { explainer: 'orient.places' },
  },
  {
    id: 'orient.q.prod-is',
    kind: 'mcq',
    concepts: ['orient.environments'],
    prompt: bi('Что такое прод?', 'What is production?'),
    options: [
      { id: 'live', text: bi('Окружение, которым пользуются настоящие покупатели', 'The environment real customers use'), correct: true },
      { id: 'fast', text: bi('Самый мощный сервер компании', 'The company’s most powerful server'), why: bi('Мощность ни при чём: прод может стоять на маленьких машинах. Его определяет то, кто им пользуется.', 'Power has nothing to do with it: production can run on small machines. It is defined by who uses it.') },
      { id: 'dev', text: bi('Ноутбук ведущего разработчика', 'The lead developer’s laptop'), why: bi('Ноутбук разработчика — окружение разработки, самое далёкое от прода.', 'A developer’s laptop is the development environment, the furthest from production.') },
    ],
    explain: bi('Слово — сокращение английского production. Ошибка на проде стоит денег, ошибка на стенде — только времени.', 'The word is short for production. A mistake in production costs money, a mistake on the stand only time.'),
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
  title: bi('Где живёт программа: окружения и настройки', 'Where a program lives: environments and settings'),
  summary: bi('Ноутбук разработчика, тестовый стенд и прод; одна сборка на всех и свой файл настроек для каждого.', 'The developer’s laptop, the test stand and production; one build for all and a settings file for each.'),
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
        'Новая версия магазина прошла все проверки на тестовом стенде. Её выложили для покупателей, заказы идут — а денег на счету нет. Программа та же, что на стенде, байт в байт. Значит, отличается что-то рядом с ней. Чтобы понять, что именно, нужно знать, в скольких местах живёт одна программа и чем эти места различаются.',
        'The new version of the shop passed every check on the test stand. It was deployed for the customers, orders are coming in, but there is no money in the account. The program is the same as on the stand, byte for byte. So something next to it differs. To understand what, you need to know in how many places one program lives and how those places differ.',
      ),
    },
    {
      id: 'envs',
      kind: 'text',
      step: 'explain',
      title: bi('Три окружения', 'Three environments'),
      body: bi(
        'Место, где работает программа, вместе со всем, что её окружает, — машиной, системой, базой данных, соседними программами, — называют [[orient.environments|окружением]]. Обычно их три.\n\n**Разработка.** Ноутбук программиста. Здесь программу пишут и запускают по десять раз на дню; сломать её тут не страшно, а данные ненастоящие.\n\n**Тест** (его ещё называют стендом). Отдельные серверы, устроенные как можно ближе к рабочим: та же система, те же версии программ, похожие данные — только покупатели ненастоящие, а оплата учебная. Здесь новую версию проверяют, прежде чем показать людям.\n\n**Прод** (от английского production). Окружение, которым пользуются настоящие покупатели с настоящими деньгами. Ошибка на стенде стоит времени, ошибка на проде — денег и доверия.\n\nГлавный принцип: через все три окружения идёт **одна и та же сборка**. Если на прод уезжает не та программа, что прошла стенд, проверка на стенде ничего не доказывает. И второй принцип: стенд должен быть похож на прод. Если на стенде система на версию старше, тесты пройдут, а на проде программа встретит то, чего никогда не видела.',
        'The place where a program runs, together with everything around it (the machine, the system, the database, neighbouring programs), is called an [[orient.environments|environment]]. Usually there are three.\n\n**Development.** The programmer’s laptop. Here the program is written and run ten times a day; breaking it is harmless, and the data are not real.\n\n**Test** (also called the stand or staging). Separate servers built as close to the working ones as possible: the same system, the same program versions, similar data, except the customers are fake and the payments are pretend. Here a new version is checked before people see it.\n\n**Production.** The environment real customers with real money use. A mistake on the stand costs time; a mistake in production costs money and trust.\n\nThe main principle: **one and the same build** goes through all three environments. If production gets a different program from the one that passed the stand, the check on the stand proves nothing. And a second principle: the stand must resemble production. If the stand’s system is a version behind, the tests pass, and in production the program meets what it has never seen.',
      ),
    },
    {
      id: 'config',
      kind: 'text',
      step: 'explain',
      title: bi('Настройки отдельно от кода', 'Settings apart from the code'),
      body: bi(
        'Но если программа везде одна, откуда она знает, что на стенде платить надо в учебную систему, а на проде — в настоящую? Из [[orient.config|конфигурации]] — файла настроек, который лежит рядом с ней в каждом окружении. В нём то, что меняется от места к месту: адреса базы и платёжной системы, пароли, имя сайта, включённые функции.\n\n```\n# prod.conf\npay=https://pay.example/real\ngreeting=Welcome to the tea shop\n```\n\nПрограмма при запуске читает свой файл и ведёт себя соответственно. Поэтому одна сборка работает везде, а на прод уезжает ровно то, что проверили. Если же зашить настройки в код, на каждое окружение придётся собирать свою программу — и на прод поедет та, которую никто не проверял. Есть и третья причина: пароль, записанный в исходный код, видит каждый, кто читает код, а файл настроек прода — только те, кому положено.\n\nТеперь история из начала урока раскрывается сама. Программа на проде прочитала не тот файл — тестовый — и честно отправляла платежи в учебную систему. Ничего не сломалось: просто окружение задаётся файлом настроек, и перепутанный файл перепутал окружения.',
        'But if the program is the same everywhere, how does it know that on the stand it must pay into the pretend system and in production into the real one? From its [[orient.config|configuration]], a settings file that lies next to it in every environment. It holds what changes from place to place: the addresses of the database and the payment system, passwords, the site’s name, switched-on features.\n\n```\n# prod.conf\npay=https://pay.example/real\ngreeting=Welcome to the tea shop\n```\n\nAt start the program reads its file and behaves accordingly. That is why one build works everywhere and exactly what was checked goes to production. If the settings are baked into the code, a separate program has to be built for each environment, and production gets the one nobody checked. There is a third reason too: a password written into source code is seen by everyone who reads the code, while the production settings file is seen only by those meant to.\n\nNow the story from the start of the lesson tells itself. The program in production read the wrong file, the test one, and faithfully sent payments to the pretend system. Nothing broke: the environment is simply set by the settings file, and a mixed-up file mixed up the environments.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.places', caption: bi('Зашейте настройки в код и посмотрите на число сборок. Разведите стенд и прод. Перепутайте файлы.', 'Bake the settings into the code and watch the number of builds. Let the stand fall behind production. Mix up the files.') },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: settings(),
      intro: bi('Программа магазина `app.sh` и папка `config` с тремя файлами настроек. Программа одна, а запускать её можно с любым из них.', 'The shop program `app.sh` and the folder `config` with three settings files. There is one program, and it can be started with any of them.'),
      tasks: [
        {
          id: 'test',
          prompt: bi('Запустите программу как на тестовом стенде: `bash app.sh config/test.conf`.', 'Start the program as on the test stand: `bash app.sh config/test.conf`.'),
          check: { stdout: /Hi, tester/ },
          chips: 'bash app.sh config/test.conf',
          concepts: ['orient.environments', 'orient.config'],
          hints: { H1: bi('Последнее слово строки — путь к файлу настроек.', 'The last word of the line is the path to the settings file.') },
        },
        {
          id: 'prod',
          prompt: bi('Та же программа на проде: запустите её с `config/prod.conf`. Код не менялся — что изменилось в ответе?', 'The same program in production: start it with `config/prod.conf`. The code did not change; what changed in the answer?'),
          check: { stdout: /Welcome to the tea shop/ },
          chips: 'bash app.sh config/prod.conf',
          concepts: ['orient.environments', 'orient.config'],
          hints: { H1: bi('Как в прошлом задании, только другой файл.', 'As in the last task, just another file.') },
        },
        {
          id: 'green',
          prompt: bi('Маркетинг просит сделать страницу на проде зелёной. Не трогая `app.sh`, поменяйте в `config/prod.conf` цвет на `green` и запустите программу с prod.conf ещё раз. Подсказка: `>>` дописывает строку в конец файла, а программа берёт последнюю строку с `color=`.', 'Marketing asks for the production page to be green. Without touching `app.sh`, change the colour in `config/prod.conf` to `green` and start the program with prod.conf again. A hint: `>>` appends a line to the end of a file, and the program takes the last line with `color=`.'),
          check: {
            when: prodGreen,
            fail: [
              { if: (f) => f.files['/home/learner/shop/app.sh']?.text !== APP_SH, say: bi('Код трогать не нужно: цвет — это настройка, её меняют в файле конфигурации.', 'No need to touch the code: the colour is a setting, changed in the configuration file.') },
              { if: (f) => !/greeting=/.test(f.files['/home/learner/shop/config/prod.conf']?.text ?? ''), say: bi('Знак `>` заменил весь файл, и приветствие пропало. Нужен `>>` — он дописывает в конец.', 'The `>` sign replaced the whole file and the greeting is gone. You need `>>`: it appends to the end.') },
            ],
          },
          chips: 'echo color=green >> config/prod.conf',
          concepts: ['orient.config'],
          hints: { H1: bi('Один знак `>` заменит файл целиком, два `>>` — допишут.', 'A single `>` replaces the whole file, a double `>>` appends.'), H2: bi('`echo color=green >> config/prod.conf`, потом снова `bash app.sh config/prod.conf`.', '`echo color=green >> config/prod.conf`, then `bash app.sh config/prod.conf` again.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: placesQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Окружение — место, где работает программа: разработка, тестовый стенд, прод. Через все три идёт одна сборка, а различия — адреса, пароли, имена — лежат в файле настроек рядом с ней. Стенд держат похожим на прод, а перепутанный файл настроек перепутывает окружения.',
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
      { id: 'lost', text: bi('Чья-то правка молча пропадёт: последний сохранивший затрёт остальных', 'Someone’s edit will silently vanish: whoever saved last overwrites the others'), correct: true },
      { id: 'merge', text: bi('Почта сама соединит их правки', 'The email will join their edits by itself'), why: bi('Почта пересылает файл целиком. Соединять правки умеют только программы совместной работы.', 'Email forwards the whole file. Only collaboration programs can join edits.') },
      { id: 'ok', text: bi('Ничего, если они вежливые', 'Nothing, if they are polite'), why: bi('Вежливость не мешает двум людям открыть файл в одно и то же утро.', 'Politeness does not stop two people opening the file on the same morning.') },
    ],
    explain: bi('Поэтому код хранят в программе, которая помнит историю и соединяет правки, — чаще всего это Git. С ним вы будете работать сразу после блока Linux.', 'That is why code is kept in a program that remembers history and joins edits, most often Git. You will work with it right after the Linux block.'),
    refs: { explainer: 'orient.together' },
  },
  {
    id: 'orient.q.same-line',
    kind: 'mcq',
    concepts: ['orient.collaboration'],
    prompt: bi('Анна и Борис по-разному изменили одну и ту же строчку. Что сделает программа совместной работы?', 'Anna and Boris changed the same line in different ways. What does the collaboration program do?'),
    options: [
      { id: 'ask', text: bi('Покажет обе версии и попросит человека решить', 'It shows both versions and asks a person to decide'), correct: true },
      { id: 'last', text: bi('Оставит ту, что пришла позже', 'It keeps the one that came later'), why: bi('Тогда чья-то правка пропала бы молча — ровно от этого такие программы и защищают.', 'Then someone’s edit would vanish silently, exactly what such programs protect against.') },
      { id: 'both', text: bi('Оставит обе строчки одну под другой', 'It keeps both lines one under the other'), why: bi('В меню появились бы две цены одного чая. Машина не знает, какая правильная, — решает человек.', 'The menu would then have two prices for one tea. The machine does not know which is right; a person decides.') },
    ],
    refs: { explainer: 'orient.together' },
  },
  {
    id: 'orient.q.small-edits',
    kind: 'mcq',
    concepts: ['orient.collaboration'],
    prompt: bi('Почему в командах стараются делать правки маленькими и соединять их часто?', 'Why do teams try to keep edits small and join them often?'),
    options: [
      { id: 'easy', text: bi('Маленькую правку легко прочитать, проверить и соединить; большие чаще сталкиваются', 'A small edit is easy to read, check and join; big ones collide more often'), correct: true },
      { id: 'rule', text: bi('Так велит закон', 'The law says so'), why: bi('Закона нет; есть опыт команд: чем дольше живёт отдельная копия, тем больнее её соединять.', 'There is no law; there is teams’ experience: the longer a separate copy lives, the more painful it is to join.') },
    ],
    explain: bi('Эта мысль — маленькие частые изменения вместо больших редких — станет одной из главных в блоке методологии.', 'This idea, small frequent changes instead of big rare ones, becomes one of the main ones in the methodology block.'),
  },
];

export const togetherLesson: Lesson = {
  id: 'orient.together',
  block: 'orient',
  title: bi('Работа над кодом вместе', 'Working on code together'),
  summary: bi('Каждый правит свою копию, машина соединяет правки и помнит историю; спорную строчку решает человек.', 'Everyone edits their own copy, a machine joins the edits and remembers the history; a disputed line is decided by a person.'),
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
        'В понедельник Анна подняла цену улуна в меню магазина, а Борис — цену чёрного чая. Оба работали с файлом `menu.txt`, оба отправили его в общий чат. К обеду на сайте висела версия Бориса: чёрный чай подорожал, а улун снова стоил по-старому. Правка Анны не исчезла с шумом — она просто молча пропала. В команде из двадцати программистов, где правят тысячи файлов, так пропадало бы каждый день.',
        'On Monday Anna raised the oolong price in the shop’s menu, and Boris the black tea price. Both worked on the file `menu.txt`, both sent it to the shared chat. By lunchtime the site showed Boris’s version: black tea had gone up, and oolong cost the old price again. Anna’s edit did not vanish with a bang; it quietly disappeared. In a team of twenty programmers editing thousands of files, this would happen every day.',
      ),
    },
    {
      id: 'together',
      kind: 'text',
      step: 'explain',
      title: bi('Копии, слияние, история', 'Copies, merging, history'),
      body: bi(
        'Команды решают это не дисциплиной, а машиной. [[orient.collaboration|Совместная работа над кодом]] устроена так.\n\nЕсть **общая копия** кода — главная версия, с которой все начинают. Напрямую её не правит никто. Каждый берёт себе **свою копию** и работает в ней, никому не мешая. Закончив, он отдаёт правку на **слияние**: программа сравнивает его копию и копию коллеги с исходной строчка за строчкой. Правки в разных строчках она соединяет сама — и в меню оказываются обе новые цены. А если двое по-разному изменили одну и ту же строчку, программа не угадывает: она останавливается и показывает обе версии человеку, а тот решает.\n\nКаждое слияние записывается в **историю**: кто, что и когда изменил. По ней находят, какая правка принесла ошибку, и возвращают любую прошлую версию. Программа, которая всё это делает, чаще всего называется Git; с ней вы будете работать руками сразу после блока Linux.\n\nИз этой схемы вытекает правило, которое пригодится в методологии: правки лучше делать маленькими и соединять часто. Маленькую правку легко прочитать, проверить и соединить; копия, которая неделю жила своей жизнью, сталкивается с правками коллег во многих местах сразу.',
        'Teams solve this not with discipline but with a machine. [[orient.collaboration|Working on code together]] goes like this.\n\nThere is a **shared copy** of the code, the main version everyone starts from. Nobody edits it directly. Each person takes **a copy of their own** and works in it without getting in anyone’s way. When done, they hand the edit over to the **merge**: a program compares their copy and a colleague’s with the original line by line. Edits on different lines it joins by itself, and the menu ends up with both new prices. But if two people changed the same line differently, the program does not guess: it stops and shows both versions to a person, who decides.\n\nEvery merge is written into the **history**: who changed what and when. With it one finds which edit brought an error and brings back any past version. The program that does all this is most often called Git; you will work with it by hand right after the Linux block.\n\nFrom this scheme follows a rule that will be useful in methodology: edits are best kept small and joined often. A small edit is easy to read, check and join; a copy that lived its own life for a week collides with colleagues’ edits in many places at once.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'orient.together', caption: bi('Сведите правки на одну строчку, сделайте их большими, а потом уберите общую историю и перешлите файл почтой.', 'Bring the edits onto one line, make them big, then remove the shared history and send the file by email.') },
    {
      id: 'try',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: twoCopies(),
      intro: bi('В папке `menu` две копии меню — Анны и Бориса. Найдём, чем они отличаются, тем же способом, каким это делает программа слияния.', 'The folder `menu` holds two copies of the menu, Anna’s and Boris’s. Let us find how they differ, the same way a merge program does.'),
      tasks: [
        {
          id: 'diff',
          prompt: bi('Сравните копии построчно: `diff menu-anna.txt menu-boris.txt`. Строчка со знаком `<` — из первого файла, со знаком `>` — из второго.', 'Compare the copies line by line: `diff menu-anna.txt menu-boris.txt`. A line with `<` is from the first file, with `>` from the second.'),
          check: { stdout: /Black tea — 280/ },
          chips: 'diff menu-anna.txt menu-boris.txt',
          docRef: man('diff.1'),
          concepts: ['orient.collaboration'],
          hints: { H1: bi('`diff`, пробел и два имени файла через пробел.', '`diff`, a space and two file names separated by a space.') },
        },
        {
          id: 'agree',
          prompt: bi('Анна согласилась с ценой Бориса. Сделайте общую копию `menu.txt` из файла Бориса: `cp menu-boris.txt menu.txt`.', 'Anna agreed with Boris’s price. Make the shared copy `menu.txt` from Boris’s file: `cp menu-boris.txt menu.txt`.'),
          check: { when: "files['/home/learner/menu/menu.txt'].text~'Black tea — 280'" },
          chips: 'cp menu-boris.txt menu.txt',
          docRef: man('cp.1'),
          concepts: ['orient.collaboration'],
          hints: { H1: bi('`cp` — copy: сначала что копировать, потом куда.', '`cp` is copy: first what to copy, then where to.') },
        },
      ],
    },
    {
      id: 'find',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Программы совместной работы показывают правки в особом, «объединённом» виде: со строчками вокруг изменения и знаками `-` и `+`. У `diff` есть опция для такого вида. Найдите её в справке и сравните копии Анны и Бориса так.', 'Collaboration programs show edits in a special “unified” form, with lines around the change and the signs `-` and `+`. `diff` has an option for this form. Find it in the help and compare Anna’s and Boris’s copies that way.'),
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
          hints: { H1: bi('Ищите в разделе OPTIONS слово «unified».', 'Look for the word “unified” in the OPTIONS section.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: togetherQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Каждый правит свою копию; программа слияния соединяет правки в разных строчках сама, а одну строчку с двумя правками отдаёт человеку. История помнит, кто, что и когда изменил. Без такой программы побеждает тот, кто сохранил последним. Правки держат маленькими и соединяют часто.',
        'Everyone edits their own copy; the merge program joins edits on different lines by itself and hands a line with two edits to a person. The history remembers who changed what and when. Without such a program, whoever saved last wins. Edits are kept small and joined often.',
      ),
    },
  ],
};

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
      { id: 'build', text: bi('сборка и номер версии', 'the build and a version number') },
      { id: 'test', text: bi('проверка на тестовом стенде', 'checking on the test stand') },
      { id: 'prod', text: bi('выкладка на прод', 'deploying to production') },
    ],
    explain: bi('Весь блок в одной цепочке. Каждое звено можно сделать руками или поручить машине, и от этого зависит, сколько изменение идёт до покупателя и как часто ломается.', 'The whole block in one chain. Each link can be done by hand or handed to a machine, and that decides how long a change takes to reach the customer and how often it breaks.'),
  },
  {
    id: 'orient.q.roles',
    kind: 'match',
    concepts: ['orient.roles'],
    prompt: bi('Кто в команде чем занят? Сопоставьте.', 'Who in the team does what? Match them.'),
    pairs: [
      { id: 'dev', left: bi('Разработчик', 'Developer'), right: bi('пишет и правит исходный код', 'writes and edits source code') },
      { id: 'qa', left: bi('Тестировщик', 'Tester'), right: bi('ищет ошибки до того, как их найдут покупатели', 'looks for errors before customers find them') },
      { id: 'ops', left: bi('Инженер эксплуатации', 'Operations engineer'), right: bi('следит, чтобы серверы и программы на них работали', 'makes sure the servers and their programs keep working') },
      { id: 'path', left: bi('Инженер, к которому ведёт этот курс', 'The engineer this course leads to'), right: bi('делает путь от правки до прода быстрым, надёжным и повторяемым', 'makes the path from an edit to production fast, reliable and repeatable') },
    ],
    explain: bi('Последняя роль — та, к которой вы идёте. Как она называется и почему возникла, рассказывает следующий блок.', 'The last role is the one you are heading for. What it is called and why it appeared is told in the next block.'),
  },
  {
    id: 'orient.q.night-call',
    kind: 'multi',
    concepts: ['orient.roles', 'orient.server', 'orient.config'],
    prompt: bi('В два часа ночи сайт магазина перестал открываться. С каких вопросов разумно начать?', 'At two in the morning the shop’s site stopped opening. Which questions are sensible to start with?'),
    options: [
      { id: 'on', text: bi('Включена ли машина и запущена ли на ней программа?', 'Is the machine on, and is the program running on it?'), correct: true },
      { id: 'net', text: bi('Доходят ли до неё запросы по сети?', 'Do requests reach it over the network?'), correct: true },
      { id: 'what', text: bi('Что меняли последним: версию, настройки?', 'What was changed last: the version, the settings?'), correct: true },
      { id: 'who', text: bi('Кто из программистов виноват?', 'Which programmer is to blame?'), why: bi('Ночью вопрос один — как вернуть сайт. Почему это случилось, разбирают потом, и ищут не виноватого, а причину.', 'At night there is one question: how to bring the site back. Why it happened is examined later, and what is sought is the cause, not a culprit.') },
    ],
    explain: bi('Каждый из трёх вопросов вы уже умеете задать по-настоящему: машина и программа — урок о серверах, сеть — урок о сети, последние изменения — уроки о версиях и настройках.', 'Each of the three questions you can already ask properly: the machine and program from the lesson on servers, the network from the lesson on networks, the latest changes from the lessons on versions and settings.'),
  },
];

export const teamLesson: Lesson = {
  id: 'orient.team',
  block: 'orient',
  title: bi('Кто чем занят в IT-команде', 'Who does what in an IT team'),
  summary: bi('Разработка, тестирование, эксплуатация — и работа, которая связывает их в один путь от правки до покупателя.', 'Development, testing, operations, and the work that ties them into one path from an edit to the customer.'),
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
        'За девять уроков вы прошли путь, который каждый день проделывает любое изменение в любой IT-компании. Кто-то придумал, что покупателям нужна оплата картой. Программист написал код в своей копии, правку соединили с общей, собрали, дали номер, проверили на стенде, выложили на прод с его файлом настроек — на сервер, который, скорее всего, стоит в облаке. Осталось понять, кто из людей за какое звено отвечает и что в этой цепочке будете делать вы.',
        'In nine lessons you have walked the path every change takes every day in any IT company. Someone decided customers need card payments. A programmer wrote the code in their copy, the edit was joined with the shared one, built, given a number, checked on the stand and deployed to production with its settings file, onto a server that most likely stands in the cloud. What remains is to see which people answer for which link and what you will be doing in this chain.',
      ),
    },
    {
      id: 'roles',
      kind: 'text',
      step: 'explain',
      title: bi('Люди на пути изменения', 'The people along a change’s path'),
      body: bi(
        'В небольшой IT-команде у каждого звена свой хозяин, и вместе они образуют привычные [[orient.roles|роли]].\n\n**Аналитик** или продакт-менеджер выясняет, что нужно людям, и описывает задачу. **Разработчик** пишет и правит исходный код. **Тестировщик** ищет ошибки до того, как их найдут покупатели, — руками и тестами, которые запускает машина. **Инженер эксплуатации** (его ещё называют системным администратором) отвечает за то, чтобы серверы работали, программы на них были запущены, места на дисках хватало, а ночью, если что-то упало, кто-то это поднял.\n\nДолгое время между разработкой и эксплуатацией стояла стена. Разработчики хотели выпускать изменения чаще — за них платят покупатели. Эксплуатация хотела менять реже — каждое изменение может уронить прод. Сборку делали руками, на стенд выкладывали раз в месяц, на прод — по выходным, а файлы настроек жили на серверах в единственном экземпляре.\n\nРабота, к которой ведёт этот курс, — разобрать эту стену. Такой инженер строит путь от правки до прода так, чтобы он был быстрым, надёжным и повторяемым: сборка и проверки идут сами при каждой правке, окружения похожи друг на друга, серверы и их настройки описаны текстом и хранятся рядом с кодом, а за работой прода следят приборы, которые зовут человека раньше, чем пожалуются покупатели. Как эта профессия называется, откуда взялась и зачем она бизнесу, рассказывает следующий блок курса. А словарь, без которого его первая же страница звучала бы иностранным языком, у вас теперь есть.',
        'In a small IT team each link has its owner, and together they make up the familiar [[orient.roles|roles]].\n\nAn **analyst** or product manager finds out what people need and describes the task. A **developer** writes and edits source code. A **tester** looks for errors before the customers find them, by hand and with tests a machine runs. An **operations engineer** (also called a system administrator) answers for the servers working, the programs on them running, the disks having room, and someone bringing things back up if something falls over at night.\n\nFor a long time a wall stood between development and operations. Developers wanted to release changes more often: customers pay for them. Operations wanted to change things less often: every change can bring production down. Builds were made by hand, the stand got a deployment once a month, production at weekends, and settings files lived on the servers in a single copy.\n\nThe work this course leads to is taking that wall down. Such an engineer builds the path from an edit to production so that it is fast, reliable and repeatable: the build and the checks run by themselves on every edit, the environments resemble each other, servers and their settings are described in text and kept next to the code, and production is watched by instruments that call a person before the customers complain. What this profession is called, where it came from and why a business needs it is told in the next block of the course. And the vocabulary without which its very first page would sound like a foreign language you now have.',
      ),
    },
    {
      id: 'map',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      title: bi('Куда ведёт маршрут', 'Where the route leads'),
      body: bi(
        'Каждое понятие этого блока станет целой главой дальше. Операционная система и команды — блок Linux. Совместная работа над кодом — блок Git. Сеть, интернет, клиент и сервер — блок «Сети». Сборка, версии и окружения — блоки о запуске программ в изоляции и о пути изменения до прода. Облачные машины — Linux и блок об описании серверов кодом. А как следить за продом — блок мониторинга.',
        'Every idea of this block becomes a whole chapter further on. The operating system and commands: the Linux block. Working on code together: the Git block. Networks, the internet, client and server: the Networks block. Builds, versions and environments: the blocks on running programs in isolation and on the path of a change to production. Cloud machines: Linux and the block on describing servers in code. And how to watch production: the monitoring block.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: teamQuiz.map((q) => q.id) },
    {
      id: 'review',
      kind: 'quiz',
      step: 'review',
      title: bi('Повторим весь блок', 'Review the whole block'),
      items: ['orient.q.power-cut', 'orient.q.os-job', 'orient.q.who-starts', 'orient.q.cloud-is', 'orient.q.semver', 'orient.q.config-why', 'orient.q.same-line'],
    },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi(
        'Разработчик пишет код, тестировщик ищет ошибки, эксплуатация держит серверы на ходу. Инженер, к которому ведёт курс, связывает их работу в один быстрый и надёжный путь от правки до прода. Дальше — методология: зачем это бизнесу и как измерить, что путь стал лучше.',
        'The developer writes code, the tester looks for errors, operations keeps the servers going. The engineer this course leads to ties their work into one fast and reliable path from an edit to production. Next comes methodology: why a business needs it and how to measure that the path got better.',
      ),
    },
  ],
};
