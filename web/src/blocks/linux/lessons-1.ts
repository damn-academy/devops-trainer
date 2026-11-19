// Linux lessons 1–6: the terminal, the tree of files, working with files,
// reading the manual, users and groups, permissions and sudo (02 §5.3, М0–М5).
// The prose of a lesson uses only the terms introduced up to that lesson.

import { bi } from '../../core/i18n';
import type { Lesson, TerminalSetup } from '../../core/types';
import { BASH_MANUAL, DEBIAN_HANDBOOK, DEBIAN_HANDBOOK_RU, TLCL, man7, opennet, ref, sources, wiki } from './shared';

// ── 1. The terminal ──

const terminal: Lesson = {
  id: 'linux.terminal',
  block: 'linux',
  title: bi('Терминал и оболочка, через которые работают с сервером без экрана', 'The terminal and the shell, through which you work with a server that has no screen'),
  summary: bi('С сервером разговаривают текстом: вы печатаете строку, а оболочка понимает её как имя команды и список аргументов. В этом уроке вы научитесь читать приглашение оболочки и составлять такие строки сами.','You talk to a server in text. The line you type is a command name and its arguments.'),
  introduces: ['linux.terminal', 'linux.shell', 'linux.argument'],
  uses: [],
  tier: 'core',
  minutes: 20,
  sources: sources([BASH_MANUAL, TLCL, man7('bash', 1)], [wiki('Bash', 'Bash'), opennet('bash', 1)]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Руководитель команды пишет в рабочий чат: «Зайдите на сервер и посмотрите, сколько там сейчас времени и под каким пользователем мы работаем». Вы подключаетесь к серверу и видите не рабочий стол с иконками, а одну строку текста, в конце которой мигает курсор. Ни кнопок, ни меню на экране нет. Перед вами не урезанная версия привычного компьютера, а основной способ работать с машиной, которая стоит в чужом здании за тысячу километров от вас. Монитор и мышь к ней никто не подключал, и все распоряжения она получает в виде текста. Поэтому первое, чему учится каждый, кто обслуживает серверы, — читать эту строку и печатать в ответ команды, которые машина поймёт.',
        'Your team lead writes in the chat: “Log in to the server and check what time it is there and which user we run as.” You connect — and see not a desktop but a single line with a blinking cursor. There are no buttons. This is not a cut-down version of the computer you know; it is the main way to work with a machine that stands in someone else’s building a thousand kilometres away: it needs no monitor or mouse, it needs text.',
      ),
    },
    {
      id: 'look',
      kind: 'text',
      step: 'look',
      title: bi('Что на экране', 'What is on the screen'),
      body: bi(
        'Окно, в котором вы печатаете команды и читаете ответы машины, называется [[linux.terminal|терминалом]]. Сам терминал команд не понимает. Он передаёт напечатанные вами буквы другой программе и показывает на экране всё, что эта программа пишет в ответ. Такая программа называется [[linux.shell|оболочкой]], и на серверах почти всегда работает оболочка `bash`.\n\nКогда оболочка готова принять команду, она печатает приглашение, то есть строку такого вида:\n\n```\nlearner@trainer:~$\n```\n\nПеред знаком `@` стоит имя пользователя, от имени которого вы сейчас работаете, а после него написано имя машины. За двоеточием оболочка показывает, где в системе вы сейчас находитесь. Знак `~` пока читайте как «в вашей личной папке», а подробнее мы разберём его в следующем уроке. Знак `$` в конце сообщает, что оболочка ждёт команду от обычного пользователя. Если вместо него стоит `#`, вы работаете как администратор машины, и она выполнит любую вашу команду, в том числе ту, которая её сломает.',
        'The window where you type and read the answers is called a [[linux.terminal|terminal]]. By itself the terminal understands nothing: it passes your keystrokes to a program and shows what that program writes back. That program is the [[linux.shell|shell]]; on servers it is almost always `bash`.\n\nThe shell opens the conversation with a prompt:\n\n```\nlearner@trainer:~$\n```\n\nBefore the `@` is the user you are working as. After it is the name of the machine. After the colon is where you are now (read `~` as “at home” for now; the next lesson explains exactly what it means). The `$` sign means the shell is waiting for a command. If you see `#` instead of `$`, you are working as the administrator, and the machine will obey any command — even one that breaks everything.',
      ),
    },
    {
      id: 'words',
      kind: 'text',
      step: 'explain',
      title: bi('Как оболочка читает строку', 'A line is words'),
      body: bi(
        'Когда вы нажимаете Enter, оболочка делит напечатанную строку на слова, и границей между словами для неё служит пробел. Первое слово оболочка считает именем команды, а все следующие слова передаёт этой команде как [[linux.argument|аргументы]], то есть как сведения о том, что команде обработать и как это сделать.\n\n```\necho hello server\n```\n\nВ этой строке команда называется `echo`, и аргументов у неё два: `hello` и `server`. Команда `echo` печатает свои аргументы, ставя между ними по одному пробелу. Поэтому неважно, сколько пробелов вы поставите между словами: оболочку интересует только, где кончается одно слово и начинается следующее. Если же фраза с пробелами должна дойти до команды целиком, одним аргументом, её берут в кавычки. Команда `echo "hello,   server"` напечатает фразу в точности так, как вы её набрали, со всеми тремя пробелами.\n\nТо, что команда печатает на экран, называется её выводом. Когда команда заканчивает работу, оболочка снова показывает приглашение и ждёт следующую строку. Набирать прежние команды заново не нужно: клавиша со стрелкой вверх возвращает предыдущую строку, и её можно поправить и выполнить ещё раз. Команда `history` показывает всё, что вы набирали раньше, а команда `clear` очищает экран.',
        'When you press Enter, the shell splits the line into words at the spaces. The first word is the command name; the rest are its [[linux.argument|arguments]]: what to work on and how.\n\n```\necho hello server\n```\n\nHere the command is `echo` with two arguments, `hello` and `server`; `echo` prints them with one space between them. How many spaces you put between words does not matter — what matters is where one word ends and the next begins. To make a phrase with spaces a single argument, put it in quotes: `echo "hello,   server"` prints the phrase as it is, with all its spaces.\n\nThe command prints something — its output — and the shell shows the prompt again. Press the up arrow: the previous line comes back, you can fix it and run it again. `history` shows everything you typed, and `clear` clears the screen.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: {},
      intro: bi('Ниже работает учебная машина. Она запущена в вашем же браузере и устроена так же, как настоящий сервер. Сломать её не страшно, потому что кнопка «Сбросить» возвращает машину в исходное состояние.','This is a training machine in your browser. You may break it: the “Reset” button brings it back to the start.'),
      tasks: [
        {
          id: 'date',
          prompt: bi('Узнайте, какое время сейчас показывают часы сервера. Для этого служит команда `date`.', 'Find out what time it is on the server: the `date` command.'),
          check: { when: "term['main'][last].exit=0", stdout: /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b.*\b20\d\d\b/ },
          chips: 'date',
          docRef: ref('man/date.1', 'DESCRIPTION'),
          hints: { H1: bi('Название команды уже подсказывает ответ: английское слово date означает «дата».','The command name is the hint.'), H2: bi('Наберите `date` и нажмите Enter.', 'Type `date` and press Enter.') },
        },
        {
          id: 'whoami',
          prompt: bi('Узнайте, от имени какого пользователя вы работаете на этой машине.', 'Find out which user you are working as.'),
          check: { stdout: /^learner\n?$/ },
          chips: 'whoami',
          docRef: ref('man/whoami.1', 'DESCRIPTION'),
          hints: { H1: bi('Имя пользователя уже видно в приглашении, но попросите машину назвать его отдельной командой.', 'The name is in the prompt too, but ask the machine to say it.'), H2: bi('Название команды читается как английский вопрос who am I, то есть «кто я?».','The command reads like the English question “who am I?”.'), H3: bi('`whoami`', '`whoami`') },
        },
        {
          id: 'echo',
          prompt: bi('Напечатайте фразу `hello,   server` в точности так, как она записана здесь, с тремя пробелами после запятой.', 'Print the phrase `hello,   server` exactly — with three spaces after the comma.'),
          check: {
            stdout: /^hello, {3}server\n$/,
            fail: [{ if: "term['main'][last].out='hello, server\n'", say: bi('Три пробела превратились в один. Без кавычек оболочка разделила фразу на два слова и передала их команде `echo` по отдельности, а `echo` ставит между своими аргументами один пробел.', 'The spaces collapsed: without quotes the shell sees two separate words and `echo` puts one space between them.') }],
          },
          chips: 'echo "hello,   server"',
          docRef: ref('man/echo.1', 'DESCRIPTION'),
          hints: { H1: bi('Подумайте, сколько аргументов должна получить команда `echo`, чтобы пробелы внутри фразы сохранились.', 'How many arguments must echo get for the spaces to survive?'), H2: bi('Чтобы оболочка передала фразу команде одним аргументом, возьмите фразу в кавычки.','One phrase, one argument: put it in quotes.') },
        },
        {
          id: 'os',
          prompt: bi('Выясните, какая операционная система установлена на машине. Её название и версия записаны в файле `/etc/os-release`, а показать содержимое файла на экране умеет команда `cat`.', 'Find out which operating system the machine runs: its description is in the file `/etc/os-release`; show it with `cat`.'),
          check: { when: "term['main'][last].exit=0", stdout: 'Debian' },
          chips: 'cat /etc/os-release',
          docRef: ref('man/cat.1', 'DESCRIPTION'),
          hints: { H1: bi('Команда `cat` печатает содержимое того файла, имя которого вы передали ей аргументом.','`cat` prints the contents of a file; the file name is its argument.') },
        },
      ],
    },
    {
      id: 'docs-note',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      title: bi('Где команды описаны подробно', 'Where this comes from'),
      body: bi(
        'К каждой команде прилагается подробное описание, которое хранится на самой машине. Под каждым заданием вы видите строку вида «date(1) · DESCRIPTION». Если нажать на неё, откроется тот раздел описания, где рассказано о нужном действии. Пока такая строка служит вам подсказкой, а через три урока вы научитесь находить и читать эти описания самостоятельно.',
        'Every command comes with its own description. Under the tasks you see a line like “date(1) · DESCRIPTION” — click it and a piece of that description opens. For now it is just a hint on the side; in three lessons you will learn to read such pages yourself.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['linux.q.words', 'linux.q.prompt'] },
  ],
};

// ── 2. The tree of files and paths ──

const pathsSetup: TerminalSetup = {
  files: [
    { path: '/var/log/app/app.log', content: 'started\n', owner: 'root' },
    { path: '/var/log/syslog.1', content: 'old\n', owner: 'root' },
    { path: '~/notes/todo.txt', content: 'learn paths\n' },
    { path: '~/.secret-plan', content: 'hidden\n' },
  ],
};

const paths: Lesson = {
  id: 'linux.paths',
  block: 'linux',
  title: bi('Одно дерево файлов и пути в нём', 'One tree of files and the paths in it'),
  summary: bi('Все файлы машины собраны в одно дерево, которое начинается с корневого каталога `/`. Путь служит адресом файла в этом дереве и отсчитывается либо от корня, либо от того каталога, в котором вы сейчас находитесь.', 'Every file of the machine grows from one root, `/`. A path is the address of a file: from the root, or from where you stand.'),
  introduces: ['linux.root-dir', 'linux.abs-path', 'linux.home'],
  uses: ['linux.shell', 'linux.argument'],
  tier: 'core',
  minutes: 25,
  sources: sources([man7('hier', 7), man7('path_resolution', 7), { title: 'Filesystem Hierarchy Standard 3.0', url: 'https://refspecs.linuxfoundation.org/FHS_3.0/fhs/index.html' }], [wiki('FHS', 'FHS'), opennet('hier', 7)]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Коллега пишет вам: «Журналы лежат в /var/log, сходите туда и посмотрите, что случилось с приложением». На экране нет ни проводника, ни значков папок, поэтому непонятно, где находится это «в /var/log» и как туда «сходить». В этом уроке вы узнаете, как устроено дерево файлов на сервере и как перемещаться по нему командами.', 'A colleague writes to you: “The logs are in /var/log, go there and see what happened to the app.” There is no file manager and no folder icons on the screen, so it is unclear where this “in /var/log” is and how to “go” there. In this lesson you learn how the tree of files on a server is arranged and how to move around it with commands.'),
    },
    {
      id: 'tree',
      kind: 'text',
      step: 'explain',
      title: bi('Как устроено дерево каталогов', 'How the tree of directories is arranged'),
      body: bi(
        'На вашем ноутбуке, возможно, есть «диск C:» и «диск D:». В Linux дисков с буквами нет. Все файлы машины собраны в одно дерево каталогов, и у этого дерева одна вершина, [[linux.root-dir|корневой каталог]] `/`. Второй диск, флешку или сетевую папку система подключает не рядом с деревом, а внутрь него, в один из каталогов.\n\nУ главных каталогов постоянные роли, и почти на любом сервере они одинаковы:\n\n- в `/etc` хранятся настройки программ и самой системы;\n- в `/var/log` лежат журналы, то есть записи о том, что происходило на машине;\n- в `/home` находятся каталоги пользователей;\n- в `/usr/bin` установлены программы;\n- в `/tmp` складывают временные файлы, которые можно удалять;\n- `/root` служит домашним каталогом администратора.\n\nЕсли один раз запомнить эту карту, то и на незнакомом сервере вы будете знать, где искать настройки и журналы.',
        'Your laptop may have a “C: drive” and a “D: drive”. Linux has no lettered drives. All files of the machine form one tree of directories with a single top, the [[linux.root-dir|root directory]] `/`. A second disk, a USB stick or a network share is attached not next to the tree but inside it, in one of the directories.\n\nThe main directories have fixed roles, the same on almost any server:\n\n- `/etc` keeps the settings of programs and of the system;\n- `/var/log` holds the logs, that is, records of what happened on the machine;\n- `/home` contains the users’ directories;\n- `/usr/bin` holds the installed programs;\n- `/tmp` is for temporary files that may be deleted;\n- `/root` is the administrator’s home directory.\n\nLearn this map once, and on an unfamiliar server you will know where to look for settings and logs.',
      ),
    },
    {
      id: 'paths',
      kind: 'text',
      step: 'explain',
      title: bi('Как путь указывает на файл', 'How a path points to a file'),
      body: bi(
        'Путь называет файл, перечисляя каталоги, которые нужно пройти, и разделяя их знаком `/`. [[linux.abs-path|Абсолютный путь]] начинается с корня, поэтому путь `/var/log/app/app.log` ведёт к одному и тому же файлу, откуда бы вы его ни набрали. Относительный путь начинается не с `/`, и система отсчитывает его от текущего каталога, то есть от того каталога, в котором вы сейчас находитесь. Текущий каталог печатает команда `pwd`, а меняет команда `cd`.\n\nВ каждом каталоге есть два особых имени. Точка `.` обозначает сам этот каталог, а две точки `..` обозначают каталог на уровень выше. Поэтому из `/var/log` путь `../lib` ведёт в `/var/lib`, а команда `cd ..` переводит вас на уровень выше.\n\nУ каждого пользователя есть свой [[linux.home|домашний каталог]], и у вас это `/home/learner`. Знак `~` в начале пути служит коротким именем домашнего каталога: путь `~/notes` означает то же, что `/home/learner/notes`, а команда `cd` без аргументов возвращает вас домой. Вот что означал знак `~` в приглашении оболочки.\n\nОб одну мелочь спотыкаются почти все. Файлы, имя которых начинается с точки, команда `ls` не показывает. Это не защита, а договорённость: так прячут файлы настроек, например `.bashrc`, чтобы они не мешали в списке. Увидеть их можно командой `ls -a`.',
        'A path names a file by listing the directories to pass, separated by `/`. An [[linux.abs-path|absolute path]] starts at the root, so `/var/log/app/app.log` leads to the same file wherever you type it. A relative path does not start with `/`, and the system counts it from the current directory, the one you are in now. `pwd` prints the current directory and `cd` changes it.\n\nEvery directory has two special names. A dot `.` is the directory itself, and two dots `..` are the directory one level up. So from `/var/log` the path `../lib` leads to `/var/lib`, and `cd ..` takes you one level up.\n\nEvery user has a [[linux.home|home directory]]; yours is `/home/learner`. A `~` at the start of a path is the short name of the home directory: `~/notes` means `/home/learner/notes`, and `cd` with no arguments takes you home. That is what the `~` in the prompt meant.\n\nAlmost everyone trips over one detail. `ls` does not show files whose names start with a dot. This is not protection but a convention: settings files such as `.bashrc` are hidden this way so that they do not clutter the list. `ls -a` shows them.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: pathsSetup,
      tasks: [
        {
          id: 'logs',
          prompt: bi('Перейдите в каталог, где лежат журналы приложения `app`, и выведите путь, где вы оказались.', 'Go to the directory with the logs of the `app` application and print the path where you ended up.'),
          check: { when: "cwd='/var/log/app'", stdout: /^\/var\/log\/app\n$/, fail: [{ if: "cwd='/var/log'", say: bi('Вы оказались в общем каталоге журналов, а у приложения внутри него есть собственный каталог. Посмотрите командой `ls`, как он называется.', 'You are in the common log directory, and the app has its own directory inside it. Look with `ls` to see what it is called.') }] },
          chips: 'cd /var/log/app && pwd',
          docRef: ref('man/pwd.1', 'DESCRIPTION'),
          hints: { H1: bi('Сначала перейдите в `/var/log` и посмотрите, что там лежит.', 'First get to `/var/log` and look at what is there.'), H2: bi('Команда `cd` меняет текущий каталог, а команда `pwd` печатает, где вы находитесь.', '`cd` changes the current directory, and `pwd` prints where you are.'), H3: bi('Наберите `cd /var/log/app`, а затем `pwd`.', '`cd /var/log/app`, then `pwd`.') },
        },
        {
          id: 'relative',
          prompt: bi('Не набирая `/` в начале пути, перейдите отсюда в `/var/lib`.', 'Without typing `/` at the start of the path, get from here to `/var/lib`.'),
          check: { when: "cwd='/var/lib'" },
          chips: 'cd ../../lib',
          hints: { H1: bi('Две точки `..` обозначают каталог на уровень выше. Посчитайте, сколько уровней отделяет вас от `/var`.', 'Two dots `..` mean the directory one level up. Count how many levels separate you from `/var`.'), H2: bi('Из `/var/log/app` до `/var` нужно подняться на два уровня, а потом спуститься в `lib`.', 'From `/var/log/app` you go two levels up to `/var`, then down into `lib`.') },
        },
        {
          id: 'hidden',
          prompt: bi('Вернитесь домой и найдите там файл, который обычный `ls` не показывает. Выведите список так, чтобы он был виден.', 'Go back home and find a file there that a plain `ls` does not show. List the directory so that it is visible.'),
          check: { when: "cwd='/home/learner'", stdout: '.secret-plan' },
          chips: 'cd && ls -a',
          docRef: ref('man/ls.1', 'OPTIONS', '-a, --all'),
          hints: { H1: bi('Команда `cd` без аргументов возвращает вас в домашний каталог.', '`cd` with no arguments takes you home.'), H2: bi('Имена скрытых файлов начинаются с точки, а у команды `ls` есть флаг, который показывает все файлы.', 'Hidden file names start with a dot, and `ls` has a flag that shows all files.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.relpath', 'linux.q.abs-rel'] },
  ],
};

// ── 3. Files: create, copy, look inside, archive ──

const filesSetup: TerminalSetup = {
  files: [
    { path: '/etc/app/app.conf', content: 'listen 8080\nworkers 4\nlog /var/log/app/app.log\n', owner: 'root', mode: '0644' },
    { path: '~/inbox/report-1.log', content: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nERROR disk full\n' },
    { path: '~/inbox/report-2.log', content: 'all good\n' },
    { path: '~/inbox/photo.jpg', content: 'JPEG' },
    { path: '~/site/index.html', content: '<h1>Edu Cafe</h1>\n' },
    { path: '~/site/menu.html', content: '<h1>Menu</h1>\n' },
  ],
};

const files: Lesson = {
  id: 'linux.files',
  block: 'linux',
  title: bi('Как создавать, копировать, просматривать и упаковывать файлы', 'How to create, copy, view and pack files'),
  summary: bi('В этом уроке вы научитесь создавать, копировать, перемещать и удалять файлы, обрабатывать сразу много файлов с помощью шаблонов, которые раскрывает оболочка, просматривать текст и упаковывать каталоги в архивы командой tar.', 'In this lesson you learn to create, copy, move and delete files, handle many files at once with patterns the shell expands, view text, and pack directories into archives with tar.'),
  introduces: ['linux.glob', 'linux.archive'],
  uses: ['linux.abs-path', 'linux.home', 'linux.argument'],
  tier: 'core',
  minutes: 35,
  sources: sources([man7('cp', 1), man7('glob', 7), man7('tar', 1), TLCL], [wiki('Tar', 'Tar'), opennet('cp', 1), opennet('tar', 1)]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('У каждого администратора есть два правила. Первое правило велит перед правкой файла настроек сделать его копию, а второе напоминает, что удалённый файл не вернуть. В Linux нет корзины, и команда `rm` удаляет файл сразу и навсегда, поэтому в этом уроке вы сначала научитесь делать копии, а уже потом удалять.', 'Every administrator has two rules. The first: “Before you edit a settings file, make a copy of it.” The second: “A deleted file is gone.” Linux has no trash can, and `rm` deletes a file at once and for good, so in this lesson you first learn to make copies and only then to delete.'),
    },
    {
      id: 'ops',
      kind: 'text',
      step: 'explain',
      title: bi('Четыре операции над файлами', 'Four operations on files'),
      body: bi(
        'С файлами делают четыре вещи. Команда `touch файл` создаёт пустой файл, а команда `mkdir каталог` создаёт каталог; с флагом `-p`, например `mkdir -p a/b/c`, она создаёт всю цепочку каталогов сразу. Команда `cp откуда куда` копирует файл, например `cp app.conf app.conf.bak`. Команда `mv откуда куда` перемещает файл, а переименование для неё то же самое перемещение: у файла меняется только имя, а содержимое остаётся на месте. Команда `rm файл` удаляет файл, а `rm -r каталог` удаляет каталог вместе со всем, что в нём лежит.\n\nЕсли последним аргументом `cp` или `mv` стоит существующий каталог, файлы попадают внутрь этого каталога под прежними именами. Например, команда `cp a.txt b.txt backup/` кладёт обе копии в каталог `backup`.\n\nЧасто нужно обработать сразу много файлов, например все журналы. Для этого служат [[linux.glob|шаблоны имён]]. Звёздочка `*` означает «любые символы в любом количестве», а вопросительный знак `?` означает «ровно один любой символ». Поэтому шаблон `*.log` подходит ко всем именам, которые оканчиваются на `.log`. Важно понимать, кто раскрывает шаблон: это делает оболочка, и делает ещё до запуска команды. Команда `mv *.log logs/` получает уже готовый список имён, как если бы вы напечатали их сами. Если ни одно имя к шаблону не подошло, оболочка оставляет его как есть, и команда сообщит, что файла с именем `*.log` не существует.\n\nОкончание имени вроде `.txt`, `.conf` или `.jpg` остаётся частью имени и не определяет, что лежит в файле. Что внутри на самом деле, сообщит команда `file имя`, потому что она смотрит на содержимое файла.',
        'There are four things you do with files. `touch file` creates an empty file, and `mkdir dir` creates a directory; with the `-p` flag, as in `mkdir -p a/b/c`, it creates the whole chain at once. `cp from to` copies a file, for example `cp app.conf app.conf.bak`. `mv from to` moves a file, and renaming is the same move for it: only the name changes, the contents stay where they are. `rm file` deletes a file, and `rm -r dir` deletes a directory with everything inside.\n\nIf the last argument of `cp` or `mv` is an existing directory, the files go inside it under their old names. For example, `cp a.txt b.txt backup/` puts both copies into `backup`.\n\nOften you need to handle many files at once, for example all the logs. That is what [[linux.glob|glob patterns]] are for. A star `*` means “any characters, any number of them”, and a question mark `?` means “exactly one character”. So `*.log` matches every name ending in `.log`. It matters who expands the pattern: the shell does, before the command starts. `mv *.log logs/` receives a ready list of names, as if you had typed them yourself. If no name matches, the shell leaves the pattern as it is, and the command reports that there is no file called `*.log`.\n\nAn ending such as `.txt`, `.conf` or `.jpg` is part of the name and does not decide what is in the file. What is really inside, `file name` tells you, because it looks at the contents.',
      ),
    },
    {
      id: 'look',
      kind: 'text',
      step: 'explain',
      title: bi('Как заглянуть внутрь файла', 'How to look inside a file'),
      body: bi(
        'Команда `cat файл` печатает файл целиком, и ею удобно смотреть короткие файлы. Длинный журнал читают командой `less`: пробел листает вперёд, клавиша `b` листает назад, `/слово` ищет слово, а `q` закрывает просмотр. Команда `head -n 5 файл` показывает первые пять строк файла, а `tail -n 5 файл` показывает последние пять. Новые записи программы добавляют в конец журнала, поэтому чаще всего, чтобы узнать, что случилось только что, пользуются командой `tail`.\n\n### Как упаковать каталог в архив\n\nЧтобы перенести каталог на другую машину или сохранить его копию, его собирают в один файл, который называется [[linux.archive|архивом]]. Архив создаёт команда `tar`, и в нём сохраняются имена файлов, их права и даты. Сжатие выполняет отдельная программа `gzip`, но `tar` умеет вызывать её сама:\n\n```\ntar -czf site.tar.gz site/      # c — создать, z — сжать, f — в этот файл\ntar -tzf site.tar.gz            # t — показать, что внутри, ничего не распаковывая\ntar -xzf site.tar.gz -C /tmp    # x — распаковать, -C — в этот каталог\n```\n\nС чужим архивом сначала стоит выполнить `tar -t`. Так вы увидите, что в нём лежит, и заранее узнаете, не высыплет ли он сотню файлов прямо в текущий каталог.',
        '`cat file` prints a file in full, which is handy for short files. A long log is read with `less`: space pages forward, `b` pages back, `/word` searches for a word, and `q` closes the view. `head -n 5 file` shows the first five lines, and `tail -n 5 file` shows the last five. Programs add new entries at the end of a log, so to see what has just happened people use `tail` most often.\n\n### How to pack a directory into an archive\n\nTo move a directory to another machine or keep a copy of it, you gather it into one file called an [[linux.archive|archive]]. `tar` creates it, and the archive keeps the names of the files, their modes and dates. Compression is done by a separate program, `gzip`, but `tar` can call it itself:\n\n```\ntar -czf site.tar.gz site/      # c — create, z — compress, f — into this file\ntar -tzf site.tar.gz            # t — list what is inside without unpacking\ntar -xzf site.tar.gz -C /tmp    # x — extract, -C — into this directory\n```\n\nWith someone else’s archive, run `tar -t` first. You see what is inside and learn in advance whether it is going to spill a hundred files straight into the current directory.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: filesSetup,
      tasks: [
        {
          id: 'backup',
          prompt: bi('Сохраните копию файла `/etc/app/app.conf` под именем `~/backup/app.conf.bak`. Учтите, что каталога `~/backup` пока нет.', 'Save a copy of `/etc/app/app.conf` as `~/backup/app.conf.bak`. The `~/backup` directory does not exist yet.'),
          check: {
            when: "files['/home/learner/backup/app.conf.bak'].text~'workers 4'",
            fail: [{ if: "files['/home/learner/backup'].type=f", say: bi('Вместо каталога `~/backup` получился файл, потому что команда `cp` скопировала настройки под именем backup. Удалите этот файл и создайте каталог командой `mkdir`.', 'Instead of a directory, `~/backup` became a file, because cp copied the settings under the name backup. Remove that file and create the directory with `mkdir`.') }],
          },
          chips: 'mkdir ~/backup && cp /etc/app/app.conf ~/backup/app.conf.bak',
          docRef: ref('man/cp.1', 'SYNOPSIS'),
          hints: { H1: bi('Вам нужно создать каталог и положить в него копию файла.', 'You need two things: create a directory and put a copy into it.'), H2: bi('Команда `mkdir` создаёт каталог, а команда `cp откуда куда` копирует файл.', '`mkdir` creates a directory, and `cp from to` copies a file.') },
        },
        {
          id: 'move-logs',
          prompt: bi('Переложите все файлы с окончанием `.log` из `~/inbox` в новый каталог `~/logs` одной командой `mv`, не перечисляя имена файлов.', 'Move all `.log` files from `~/inbox` into a new directory `~/logs` with one `mv` command, without listing the names.'),
          check: {
            when: "files['/home/learner/logs/report-1.log'].type=f && files['/home/learner/logs/report-2.log'].type=f && !files['/home/learner/inbox/report-1.log'] && files['/home/learner/inbox/photo.jpg'].type=f",
            fail: [{ if: "!files['/home/learner/inbox/photo.jpg']", say: bi('Фотография тоже переместилась в новый каталог. Шаблон должен подходить только к именам, которые оканчиваются на `.log`.', 'The photo moved too. The pattern must match only names ending in `.log`.') }],
          },
          chips: 'mkdir ~/logs && mv ~/inbox/*.log ~/logs/',
          hints: { H1: bi('Звёздочка `*` в шаблоне означает «любые символы».', 'The `*` pattern means “any characters”.'), H2: bi('Подойдёт команда `mv ~/inbox/*.log ~/logs/`, но каталог `~/logs` должен существовать до её запуска.', '`mv ~/inbox/*.log ~/logs/` will do, but `~/logs` must exist before you run it.') },
        },
        {
          id: 'tail',
          prompt: bi('Покажите последние две строки файла `~/logs/report-1.log`.', 'Show the last two lines of `~/logs/report-1.log`.'),
          check: { stdout: /^line 6\nERROR disk full\n$/ },
          chips: 'tail -n 2 ~/logs/report-1.log',
          docRef: ref('man/tail.1', 'OPTIONS', '-n, --lines'),
          hints: { H1: bi('Конец файла показывает команда `tail`, а сколько строк показать, задаёт её флаг.', '`tail` shows the end of a file, and a flag sets how many lines to show.') },
        },
        {
          id: 'pack',
          prompt: bi('Упакуйте каталог `~/site` в сжатый архив `~/site.tar.gz`, а затем распакуйте этот архив в каталог `/tmp/restore` так, чтобы появился файл `/tmp/restore/site/index.html`.', 'Pack the `~/site` directory into a compressed archive `~/site.tar.gz`, then unpack it into `/tmp/restore` so that `/tmp/restore/site/index.html` appears.'),
          check: {
            when: "files['/home/learner/site.tar.gz'].type=f && files['/tmp/restore/site/index.html'].text~'Edu Cafe'",
            fail: [
              { if: "files['/tmp/restore/home/learner/site/index.html'].type=f", say: bi('В архив попал полный путь `home/learner/site`. Упаковывайте каталог из домашнего каталога и указывайте его относительным путём `site/`.', 'The archive got the full path `home/learner/site`. Pack from your home directory and give the directory as the relative path `site/`.') },
              { if: "files['/home/learner/site.tar.gz'].type=f && !files['/tmp/restore']", say: bi('Архив уже создан, но каталог `/tmp/restore` нужно создать до того, как вы распакуете в него архив.', 'The archive is created, but `/tmp/restore` has to be created before you unpack into it.') },
            ],
          },
          chips: 'cd ~ && tar -czf site.tar.gz site/ && mkdir /tmp/restore && tar -xzf site.tar.gz -C /tmp/restore',
          docRef: ref('man/tar.1', 'OPTIONS', '-C, --directory'),
          hints: { H1: bi('Сначала создайте архив, а потом распакуйте его в другом месте.', 'First create the archive, then unpack it elsewhere.'), H2: bi('Команда `tar -czf` упаковывает каталог, а команда `tar -xzf … -C каталог` распаковывает архив в указанный каталог.', '`tar -czf` packs a directory, and `tar -xzf … -C dir` unpacks the archive into the given directory.') },
        },
      ],
    },
    {
      id: 'rm',
      kind: 'callout',
      tone: 'warn',
      step: 'explain',
      title: bi('Как один лишний пробел удаляет домашний каталог', 'How one extra space deletes your home directory'),
      body: bi('Команда `rm -rf ~/old-project` удаляет старый проект. Если же поставить лишний пробел после `~` и набрать `rm -rf ~ /old-project`, команда получит два аргумента и удалит весь ваш домашний каталог. Поэтому перед тем как нажать Enter после `rm -r`, перечитайте строку.', '`rm -rf ~/old-project` deletes the old project. If you put an extra space after `~` and type `rm -rf ~ /old-project`, the command gets two arguments and deletes your whole home directory. So before you press Enter after `rm -r`, read the line again.'),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.mv', 'linux.q.glob', 'linux.q.tar-c'] },
  ],
};

// ── 4. Reading the manual ──

const manSetup: TerminalSetup = {
  files: [
    { path: '/srv/logs/small.log', content: 'x\n', owner: 'root' },
    { path: '/srv/logs/big.log', content: 'x'.repeat(5000) + '\n', owner: 'root' },
    { path: '/srv/logs/medium.log', content: 'x'.repeat(800) + '\n', owner: 'root' },
  ],
};

const manual: Lesson = {
  id: 'linux.manual',
  block: 'linux',
  title: bi('Как читать документацию', 'How to read the documentation'),
  summary: bi('Страница руководства к любой команде устроена одинаково. Умение найти по описанию нужный флаг понадобится вам каждый день, и в этом уроке вы его освоите.', 'A manual page for any command is laid out the same way. Finding the right flag by its description is a skill you will need every day, and in this lesson you learn it.'),
  introduces: ['linux.man-page', 'linux.builtin'],
  uses: ['linux.argument', 'linux.shell'],
  tier: 'core',
  minutes: 30,
  sources: sources([man7('man', 1), man7('man-pages', 7), BASH_MANUAL], [wiki('man', 'Man_(Unix)'), opennet('man', 1)]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('На собеседовании вас наверняка спросят о флаге, которого вы не учили, а на работе такое случается каждый день: команд сотни, флагов тысячи, и запомнить их невозможно. Зато можно научиться за минуту находить нужный флаг в описании, которое хранится на самой машине.', 'At an interview you will surely be asked about a flag you never learned, and at work this happens every day: there are hundreds of commands and thousands of flags, and nobody can remember them. What you can learn is to find the right flag in a minute, in the description stored on the machine itself.'),
    },
    {
      id: 'anatomy-text',
      kind: 'text',
      step: 'explain',
      title: bi('Как устроена страница руководства', 'How a manual page is laid out'),
      body: bi(
        'У каждой команды есть [[linux.man-page|страница руководства]]. Команда `man ls` открывает её в программе просмотра, где пробел листает дальше, `/слово` ищет слово, `n` переходит к следующему совпадению, а `q` закрывает страницу. Страницы всегда разбиты на одни и те же разделы:\n\n- в разделе **NAME** стоит имя команды и одна строка о том, что она делает;\n- раздел **SYNOPSIS** показывает, как правильно записать вызов команды;\n- раздел **DESCRIPTION** объясняет, как команда работает;\n- раздел **OPTIONS** перечисляет флаги, по одному абзацу на каждый;\n- раздел **EXIT STATUS** объясняет, что означают числа, с которыми команда завершается;\n- в разделе **EXAMPLES** собраны примеры, но он есть не у всех команд;\n- раздел **SEE ALSO** подсказывает, какие страницы прочитать дальше.\n\nСтроку SYNOPSIS читают как формулу, например `cp [OPTION]... SOURCE... DIRECTORY`. Квадратные скобки обозначают необязательную часть, многоточие означает, что часть можно повторить, а слово заглавными буквами нужно заменить своим значением. Из этой строки следует, что флагов может не быть или быть несколько, файлов-источников может быть сколько угодно, а последним аргументом стоит каталог.\n\nРуководство разделено на тома, которые называют разделами. В разделе 1 описаны команды, в разделе 5 описаны форматы файлов, а в разделе 8 описаны команды администратора. Поэтому `man crontab` и `man 5 crontab` открывают две разные страницы: первая рассказывает о команде, а вторая о формате файла с тем же именем. Если вы не помните имени команды, команда `man -k слово` найдёт страницы, в описании которых встречается это слово.\n\nКороткую справку можно получить и без страницы руководства, потому что почти любая команда понимает флаг `--help`.',
        'Every command has a [[linux.man-page|manual page]]. `man ls` opens it in a pager, where space pages on, `/word` searches for a word, `n` goes to the next match and `q` closes the page. The pages are always split into the same sections:\n\n- **NAME** gives the command’s name and one line of what it does;\n- **SYNOPSIS** shows how to write a call of the command;\n- **DESCRIPTION** explains how the command works;\n- **OPTIONS** lists the flags, one paragraph each;\n- **EXIT STATUS** explains what the numbers the command ends with mean;\n- **EXAMPLES** collects examples, but not every command has it;\n- **SEE ALSO** suggests which pages to read next.\n\nThe SYNOPSIS line reads like a formula, for example `cp [OPTION]... SOURCE... DIRECTORY`. Square brackets mark an optional part, an ellipsis means the part may repeat, and a word in capitals is to be replaced with your own value. From this line it follows that there may be no flags or several, any number of source files, and a directory as the last argument.\n\nThe manual is split into volumes called sections. Section 1 describes commands, section 5 file formats and section 8 administration commands. So `man crontab` and `man 5 crontab` open two different pages: the first is about the command and the second about the format of the file with the same name. If you do not remember a command’s name, `man -k word` finds the pages whose descriptions contain the word.\n\nA short reference is available even without a manual page, because almost every command understands the `--help` flag.',
      ),
    },
    { id: 'anatomy', kind: 'docs', step: 'try', mode: 'anatomy', prompt: bi('Откройте страницу `ls(1)` и найдите раздел, в котором перечислены флаги. Нажмите на название этого раздела.', 'Open the page `ls(1)` and find the section that lists the flags. Click the name of that section.'), ref: ref('man/ls.1'), answer: 'OPTIONS' },
    { id: 'synopsis', kind: 'docs', step: 'try', mode: 'anatomy', prompt: bi('Теперь откройте страницу `cp(1)`. В каком её разделе видно, сколько файлов можно скопировать одной командой?', 'Now open the page `cp(1)`. In which of its sections can you see how many files one command may copy?'), ref: ref('man/cp.1'), answer: 'SYNOPSIS' },
    {
      id: 'builtins',
      kind: 'text',
      step: 'explain',
      title: bi('Команды, у которых нет страницы', 'Commands without a page'),
      body: bi(
        'Наберите `man cd`, и страница найдётся, но окажется короткой и общей. Дело в том, что `cd` не отдельная программа, а [[linux.builtin|встроенная команда]], которую выполняет сама оболочка. Иначе и быть не может: текущий каталог оболочки может сменить только сама оболочка, а отдельная программа сменила бы каталог только себе и сразу завершилась бы. Встроенные команды описывает команда `help`, например `help cd` или `help export`. Отличить встроенную команду от программы поможет команда `type`: на `type cd` она ответит «cd is a shell builtin», то есть «встроенная команда оболочки», а на `type ls` ответит «ls is /usr/bin/ls».',
        'Type `man cd`, and a page shows up, but a short and generic one. The reason is that `cd` is not a separate program but a [[linux.builtin|shell builtin]] that the shell runs itself. It cannot be otherwise: only the shell can change the shell’s current directory, and a separate program would change only its own directory and finish at once. Builtins are described by `help`, for example `help cd` or `help export`. `type` tells a builtin from a program: to `type cd` it answers “cd is a shell builtin”, and to `type ls` it answers “ls is /usr/bin/ls”.',
      ),
    },
    {
      id: 'find-size',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите на странице `ls(1)` флаг, который сортирует файлы по размеру, и выведите список `/srv/logs` так, чтобы самый большой файл стоял первым.', 'Find the `ls(1)` flag that sorts by size and list `/srv/logs` with the biggest file first.'),
      ref: ref('man/ls.1', 'OPTIONS', 'sort by file size'),
      terminal: {
        setup: manSetup,
        task: {
          id: 'sort-size',
          prompt: bi('Выведите список файлов в `/srv/logs` так, чтобы самый большой файл стоял первым.', 'List `/srv/logs` with the biggest file first.'),
          check: { stdout: /^big\.log\s+medium\.log\s+small\.log\s*$|total \d+\n.*big\.log\n.*medium\.log\n.*small\.log/ },
          docStep: 2,
          chips: 'ls -S /srv/logs',
          hints: { H1: bi('Флаг назван по первой букве английского слова size, то есть «размер».', 'The flag is named after the first letter of the English word “size”.'), H2: bi('Откройте раздел OPTIONS на странице ls и поищите слово `/size`.', 'Open the OPTIONS section of the ls page and search for `/size`.') },
        },
      },
    },
    {
      id: 'find-builtin',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: {},
      tasks: [
        {
          id: 'type',
          prompt: bi('Узнайте, что такое `cd`: отдельная программа или встроенная команда оболочки.', 'Find out what `cd` is: a program or a shell builtin.'),
          check: { stdout: 'cd is a shell builtin' },
          chips: 'type cd',
          hints: { H1: bi('Нужная команда состоит из четырёх букв, и о ней рассказано в этом уроке.', 'The command you need has four letters and is described in this lesson.') },
        },
        {
          id: 'apropos',
          prompt: bi('Найдите команду, которая копирует файлы, не зная её имени. Для этого поищите слово copy в описаниях страниц руководства.', 'Find the command that copies files without knowing its name. Search for the word copy in the descriptions of the manual pages.'),
          check: { stdout: /cp \(1\)/ },
          chips: 'man -k copy',
          docRef: ref('man/man.1', 'OPTIONS', '-k, --apropos'),
          hints: { H1: bi('У команды `man` есть режим поиска по ключевому слову.', '`man` has a keyword search mode.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.synopsis', 'linux.q.builtin', 'linux.q.man-sections'] },
  ],
};

// ── 5. Users and groups ──

const usersSetup: TerminalSetup = {
  users: [
    { name: 'anna', uid: 1001, groups: ['dev'] },
    { name: 'bob', uid: 1002, groups: ['dev'] },
    { name: 'eve', uid: 1003 },
  ],
  files: [{ path: '/var/log/app/deploy.log', content: 'deploy ok\n', owner: 'anna', group: 'dev', mode: '0640' }],
};

const users: Lesson = {
  id: 'linux.users',
  block: 'linux',
  title: bi('Пользователи и группы', 'Users and groups'),
  summary: bi('Система различает людей не по именам, а по номерам. Кем система вас считает, показывает команда `id`, а список всех пользователей машины хранится в файле `/etc/passwd`.', 'The system tells people apart by numbers. Who you are to it, `id` shows; who exists on the machine at all, `/etc/passwd`.'),
  introduces: ['linux.user', 'linux.group'],
  uses: ['linux.abs-path', 'linux.man-page'],
  tier: 'core',
  minutes: 20,
  sources: sources([man7('passwd', 5), man7('group', 5), man7('id', 1)], [opennet('passwd', 5), opennet('group', 5), DEBIAN_HANDBOOK_RU]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Коллега открывает журнал развёртывания и спокойно его читает, а вам на ту же команду машина отвечает «Permission denied». Файл тот же и машина та же, а разница только в том, кто обращается к файлу. В этом уроке вы узнаете, кем вас считает система и как она отличает одного пользователя от другого.', 'A colleague opens the deployment log and reads it without trouble, while the same command gets you “Permission denied”. Same file, same machine; the only difference is who accesses the file. In this lesson you learn who you are to the system and how it tells one user from another.'),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Кто вы для системы', 'Who you are to the system'),
      body: bi(
        'Каждая команда выполняется от имени какого-то пользователя, и каждый файл кому-то принадлежит. Система при этом смотрит не на имена, а на номера, и номер пользователя называется [[linux.user|идентификатором пользователя]], или UID. Имя `learner` нужно людям, а для системы вы пользователь с номером 1000. У администратора `root` номер UID всегда равен нулю.\n\nПользователей объединяют в группы, чтобы выдавать права сразу нескольким людям, например разрешить всем разработчикам читать журналы. У [[linux.group|группы пользователей]] тоже есть номер, который называется GID. У каждого пользователя есть одна основная группа, обычно с тем же именем, что и у него самого, и сколько угодно дополнительных групп.\n\nКоманда `id` показывает всё это сразу:\n\n```\nuid=1000(learner) gid=1000(learner) groups=1000(learner),4(adm),27(sudo),100(users)\n```\n\nУчётные записи пользователей хранятся в обычном текстовом файле `/etc/passwd`. На каждого пользователя в нём приходится одна строка из семи полей, разделённых двоеточиями:\n\n```\nanna:x:1001:1001:anna,,,:/home/anna:/bin/bash\n```\n\nПоля идут в таком порядке: имя, буква `x`, UID, GID основной группы, описание, домашний каталог и оболочка. Буква `x` во втором поле означает, что пароля в этом файле нет. Пароль хранится в зашифрованном виде в файле `/etc/shadow`, а этот файл может читать только root. Группы перечислены в файле `/etc/group`, где для каждой группы указаны имя, буква `x`, GID и список участников. Подробности описаны на страницах `man 5 passwd` и `man 5 group`, то есть в пятом разделе руководства, где рассказано о форматах файлов.',
        'Every command runs as some user, and every file belongs to someone. The system looks not at names but at numbers, and a user’s number is called the [[linux.user|user ID]], UID. The name `learner` is for people; to the system you are user 1000. The administrator, `root`, always has UID 0.\n\nUsers are put into groups to give rights to several people at once, for example to let all developers read the logs. A [[linux.group|user group]] has a number too, called the GID. Every user has one primary group, usually with the same name as the user, and any number of supplementary groups.\n\n`id` shows all of this at once:\n\n```\nuid=1000(learner) gid=1000(learner) groups=1000(learner),4(adm),27(sudo),100(users)\n```\n\nUser accounts are kept in an ordinary text file, `/etc/passwd`. Each user has one line in it, seven fields separated by colons:\n\n```\nanna:x:1001:1001:anna,,,:/home/anna:/bin/bash\n```\n\nThe fields come in this order: name, the letter `x`, UID, GID of the primary group, description, home directory and shell. The `x` in the second field means the password is not in this file. It is kept encrypted in `/etc/shadow`, a file only root may read. Groups are listed in `/etc/group`, which gives for each group its name, the letter `x`, the GID and the list of members. The details are on the pages `man 5 passwd` and `man 5 group`, that is, in section 5 of the manual, which describes file formats.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: usersSetup,
      tasks: [
        {
          id: 'id',
          prompt: bi('Выведите одной командой свой UID, свой GID и список всех групп, в которые вы входите.', 'Print your UID, GID and all your groups with one command.'),
          check: { stdout: /uid=1000\(learner\) gid=1000\(learner\) groups=/ },
          chips: 'id',
          docRef: ref('man/id.1', 'DESCRIPTION'),
          hints: { H1: bi('Название нужной команды состоит из двух букв.', 'The command’s name has two letters.') },
        },
        {
          id: 'bob',
          prompt: bi('Выясните, в каких группах состоит пользователь `bob`.', 'Find out which groups the user `bob` is in.'),
          check: { stdout: /dev/ },
          chips: 'groups bob',
          docRef: ref('man/groups.1', 'DESCRIPTION'),
          hints: { H1: bi('Обе команды, и `id`, и `groups`, принимают имя пользователя в качестве аргумента.', 'Both `id` and `groups` take a user name as an argument.') },
        },
        {
          id: 'shell',
          prompt: bi('Найдите в файле `/etc/passwd` строку пользователя `anna` и узнайте, какой у неё домашний каталог.', 'Find the line of the user `anna` in `/etc/passwd` and find out her home directory.'),
          check: { stdout: /^anna:x:1001:1001:[^:]*:\/home\/anna:/m },
          chips: 'grep anna /etc/passwd',
          docRef: ref('man/grep.1', 'DESCRIPTION'),
          hints: { H1: bi('Можно вывести весь файл командой `cat`, а можно попросить команду `grep` показать только те строки, в которых встречается слово `anna`.', 'You can print the whole file with `cat`, or ask `grep` to show only the lines with the word `anna`.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.passwd-x', 'linux.q.uid'] },
  ],
};

// ── 6. Permissions, root and sudo ──

const permSetup: TerminalSetup = {
  users: [
    { name: 'anna', uid: 1001, groups: ['dev'] },
    { name: 'bob', uid: 1002, groups: ['dev'] },
    { name: 'eve', uid: 1003 },
  ],
  files: [
    { path: '~/bin/backup', content: '#!/usr/bin/sim\n# true: the backup program of the lab\n', mode: '0644' },
    { path: '/srv/team', type: 'd', owner: 'root', mode: '0755' },
  ],
};

const permissions: Lesson = {
  id: 'linux.permissions',
  block: 'linux',
  title: bi('Права, root и sudo', 'Permissions, root and sudo'),
  summary: bi('Как система по девяти битам rwx решает, пустить ли пользователя к файлу, почему права каталога важнее прав файла, как записать права числом и буквами, почему root эту проверку не проходит и как получить его права на одну команду через sudo.','Nine rwx bits in three triads, the octal notation, rights on directories, root who skips the check, and sudo.'),
  introduces: ['linux.mode', 'linux.root', 'linux.sudo'],
  uses: ['linux.user', 'linux.group', 'linux.man-page'],
  tier: 'core',
  minutes: 40,
  sources: sources([man7('chmod', 1), man7('path_resolution', 7), man7('sudo', 8), DEBIAN_HANDBOOK], [wiki('chmod', 'Chmod'), wiki('sudo', 'Sudo'), opennet('chmod', 1)]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Коллега anna подготовила файл `/srv/www/index.html` и попросила вас его проверить. Вы набираете `cat /srv/www/index.html`, а машина вместо содержимого отвечает `Permission denied`, то есть «доступ запрещён». При этом файл на месте и anna его только что открывала. Причина почти всегда прячется в девяти символах, которые команда `ls -l` печатает перед именем файла, и нередко эти символы стоят не у самого файла, а у каталога, в котором он лежит. В этом уроке вы научитесь читать эти символы, увидите, как система по ним решает, пустить ли пользователя к файлу, и сами исправите права так, чтобы вы оба могли работать с файлом.','Your colleague anna has prepared the file `/srv/www/index.html` and asked you to check it. You type `cat /srv/www/index.html`, and instead of the contents the machine answers `Permission denied`. The file is there, and anna has just opened it. The cause is almost always in nine characters that `ls -l` prints before the file name, and often they belong not to the file but to the directory it lives in. In this lesson you learn to read them, see how the system uses them to decide whether to let a user in, and fix the rights yourself.'),
    },
    {
      id: 'bits',
      kind: 'text',
      step: 'explain',
      title: bi('Девять битов прав в трёх тройках', 'Three triads'),
      body: bi(
        'Команда `ls -l` печатает про каждый файл строку такого вида:\n\n```\n-rwxr-x--- 1 anna dev 1832 Nov 18 09:00 report.sh\n```\n\nПервый символ строки сообщает тип: дефис означает обычный файл, буква `d` означает каталог, а буква `l` — ссылку. Следующие девять символов и есть [[linux.mode|биты прав]]. Они делятся на три тройки: первая относится к владельцу файла (здесь это `rwx`), вторая относится к группе файла (`r-x`), а третья — ко всем остальным пользователям (`---`). Буква `r` разрешает читать файл, буква `w` разрешает изменять его, буква `x` разрешает запускать его как программу, а дефис на месте буквы означает, что это действие запрещено. Дальше в строке стоят имя владельца, `anna`, и имя группы, `dev`.\n\nКогда кто-нибудь обращается к файлу, система выбирает для него **ровно одну** тройку. Если он владелец файла, решает первая тройка. Если он не владелец, но входит в группу файла, решает вторая. Если ни то ни другое, решает третья. Возьмём обычный случай. У файла `report.txt` владелец anna, группа dev, а права `rw-r-----`. Сама anna может и читать файл, и изменять его. Её коллега bob состоит в группе dev, поэтому для него действует вторая тройка, и он может только читать. Пользователь eve не владелец и не участник группы, для неё действует третья тройка, в которой нет ни одной буквы, и файл ей недоступен целиком.\n\nСистема берёт первую подходящую тройку и дальше не смотрит, поэтому права из разных троек не складываются. Обычно это незаметно, потому что у владельца прав больше всех. Но владелец может и сам себе запретить запись, например оставить себе `r--`, чтобы случайно не испортить важный файл. Тогда изменить файл он не сможет, даже если входит в группу с правом записи. Зато владелец всегда может вернуть себе это право командой `chmod`, потому что менять права файла разрешено именно владельцу.\n\nУ каталога те же буквы означают другое. Бит `r` разрешает посмотреть список имён в каталоге, бит `w` разрешает создавать и удалять в нём файлы, а бит `x` разрешает войти в каталог и пройти сквозь него к файлам, которые лежат глубже. Из этого следуют два правила. Во-первых, удалить файл можно, если у вас есть бит `w` на каталоге, где этот файл лежит, а права самого файла при этом не проверяются. Во-вторых, чтобы прочитать файл `/srv/www/index.html`, нужен бит `x` на каждом каталоге его пути, то есть и на `/srv`, и на `/srv/www`. Стоит снять `x` с любого из них, и файл не прочитать, какие бы права ни стояли у него самого. Так чаще всего и возникает отказ, с которого начался урок.',
        '`ls -l` shows a line like this for every file:\n\n```\n-rwxr-x--- 1 anna dev 1832 Nov 18 09:00 report.sh\n```\n\nThe first character is the type (`-` a file, `d` a directory, `l` a link). Then nine characters — the [[linux.mode|permission bits]], three triads: for the owner (`rwx`), for the file’s group (`r-x`), for everyone else (`---`). `r` is read, `w` is change, `x` is run; a dash means no. Then the owner, `anna`, and the group, `dev`.\n\nWhen someone accesses a file, the system picks **exactly one** triad: if you are the owner, the first; otherwise, if you are in the file’s group, the second; otherwise the third. Take an ordinary case. The file `report.txt` belongs to anna and the group dev, with the mode `rw-r-----`. anna can read and change it. Her colleague bob is in the group dev, so the second triad applies to him and he can only read. eve is neither the owner nor a group member, so the third triad applies to her; it has no letters, and the file is closed to her.\n\nThe system takes the first triad that fits and looks no further, so triads do not add up. Usually you don’t notice, because the owner has the most rights. But an owner can deny herself writing, for example keep `r--` to avoid spoiling an important file by accident. Then she cannot change the file even if she is in a group that may write. She can always give herself the right back with `chmod`, because changing a file’s mode is the owner’s privilege.\n\nOn a directory the same letters mean something else: `r` — see the list of names, `w` — create and delete files in it, `x` — enter the directory and pass through it to files deeper down. Two things follow. You can delete a file if you have `w` on the directory — the file’s own mode does not matter. And to read `/srv/www/index.html` you need `x` on every directory of the path: `/srv`, `/srv/www`. Remove `x` from any of them and the file cannot be read whatever its own mode. That is the most common cause of the refusal this lesson started with.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как проходит проверка прав', 'How the permission check runs'),
      body: bi(
        'Схема ниже в замедленном виде повторяет то, что система делает за доли секунды, когда пользователь eve набирает `cat /srv/www/index.html`. Сначала на ней только eve и файл. Остальное появляется по ходу проверки: в верхнем ряду каталоги `/srv` и `/srv/www`, через которые система проходит к файлу, ниже три тройки прав файла (владельца, группы и «остальных»), а в самом низу ответ системы. Под каждым каталогом и файлом напечатаны режим, владелец и группа, так же как в выводе `ls -l`.',
        'The diagram below replays in slow motion what the system does in a fraction of a second when eve types `cat /srv/www/index.html`. At first it shows only eve and the file. The rest appears as the check goes: in the top row the directories `/srv` and `/srv/www` the system passes on the way to the file, below them the file’s three triads (owner, group, others), and at the bottom the system’s answer. Under each directory and the file you see its mode, owner and group, as in `ls -l`.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'linux.perm', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен один блок, тот, который работает сейчас, а облачко рядом с ним говорит полным предложением, что он делает: «Система проверяет /srv: для eve здесь действует тройка «остальных» r-x, бит x в ней есть». По линиям движется карточка с тем, что передаётся дальше: сначала команда `cat index.html`, потом номер пользователя, потом выбранная тройка битов и, наконец, ответ `Permission denied`. Зелёная рамка означает, что этап пройден, красная — что на нём система отказала, бледная тройка к этому пользователю не относится. Под схемой собрана легенда со всеми этими знаками.\n\nКогда пройдёте проверку до ответа, откройте над схемой группу «Кто и что делает» и выберите другого пользователя: владельца anna, участника группы bob или администратора root. Потом поменяйте тройки в группе «Права файла index.html» и проверьте, совпадает ли ответ системы с вашим ожиданием. Напоследок включите в блоке «Сломать» поломку, которая снимает бит `x` с каталога `/srv`. Так вы увидите, как отказ возникает ещё до того, как система посмотрела на права самого файла.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step one block is highlighted, the one working now, and the callout next to it says in a full sentence what it does. A card travels along the lines with what is handed on: first the command `cat index.html`, then the user’s number, then the chosen triad, and finally the answer `Permission denied`. A green outline means the stage is passed, a red one that the system refused there, a pale triad does not apply to this user. The legend under the diagram lists all these marks.\n\nOnce you reach the answer, choose another user in “Who does what” above the diagram: the owner anna, the group member bob or the administrator root. Then change the triads in “The rights of index.html” and check whether the answer matches your expectation. Finally, switch on the break in “Break it” that removes `x` from `/srv`: you will see the refusal appear before the system even looks at the file’s own mode.'), caption: bi('Всё, что вы видели на схеме, система проделывает для каждой команды: для `cat`, для `ls` и для любой программы, которая открывает файлы. Поэтому, когда вы встречаете `Permission denied`, пройдите тот же путь сами. Проверьте командой `ls -ld` каждый каталог на пути к файлу, определите, какая тройка к вам относится, и посмотрите, есть ли в ней нужный бит.', 'Everything you saw in the diagram the system does for every command: for `cat`, for `ls` and for any program that opens files. So when you meet `Permission denied`, walk the same path yourself: check every directory on the path with `ls -ld`, find which triad applies to you, and see whether it has the bit you need.') },
    {
      id: 'chmod',
      kind: 'text',
      step: 'explain',
      title: bi('Как изменить права командой chmod', 'chmod: numbers and letters'),
      body: bi(
        'Права файла меняет его владелец командой `chmod`, и записать новые права можно двумя способами. Первый способ записывает права числом. Каждой тройке соответствует одна цифра, которая складывается из весов битов: бит `r` весит 4, бит `w` весит 2, а бит `x` весит 1. Поэтому тройка `rwx` записывается цифрой 7, тройка `r-x` — цифрой 5, тройка `---` — нулём, и команда `chmod 750 report.sh` даёт файлу режим `rwxr-x---`. Второй способ записывает права буквами, и им удобно пользоваться, когда нужно поменять один бит и не трогать остальные. Команда `chmod u+x deploy.sh` добавляет владельцу право запуска, команда `chmod o-r notes.txt` отнимает у остальных право чтения, а команда `chmod g=rw file` ставит группе ровно `rw-`, какие бы права у неё ни были до этого.\n\nВладельца и группу файла меняет команда `chown`, например `chown anna:dev report.sh`. Сменить владельца может только root, а группу может сменить и сам владелец, если он входит в новую группу.\n\nНовый файл получает не все права подряд, а права, из которых вычтена маска `umask`. Обычно маска равна `022`, поэтому новый файл получает режим `644`, а новый каталог — режим `755`.\n\nДля каталогов, в которых команда разработчиков хранит общие файлы, есть два особых бита. Бит setgid на каталоге (команда `chmod g+s`, а в числовой записи ведущая цифра 2) заставляет новые файлы в каталоге получать группу каталога, а не группу того, кто их создал. Бит sticky (команда `chmod +t`, ведущая цифра 1) разрешает удалять файл только его владельцу. Этот бит стоит на каталоге `/tmp`, иначе любой пользователь мог бы удалять там чужие файлы.',
        'The owner of a file changes its rights with `chmod`, in two ways. With a number: one digit per triad, where `r` = 4, `w` = 2, `x` = 1, added up. `rwx` = 7, `r-x` = 5, `---` = 0, so `chmod 750 report.sh` gives `rwxr-x---`. With letters — when you want to change one bit and leave the rest alone: `chmod u+x deploy.sh` adds run for the owner, `chmod o-r notes.txt` takes read away from others, `chmod g=rw file` sets the group to exactly `rw-`.\n\n`chown` changes the owner and the group: `chown anna:dev report.sh`. Only root may change the owner; the owner may change the group, if she is in that group.\n\nNew files do not get “everything” but everything minus the mask `umask`: usually it is `022`, so a new file gets `644` and a new directory `755`.\n\nFor a team’s shared directories there are two special bits. setgid on a directory (`chmod g+s`, a leading digit 2) — new files in it get the directory’s group instead of the creator’s. sticky (`chmod +t`, digit 1) — only a file’s owner may delete it; `/tmp` has it, otherwise anyone could delete anyone’s files.',
      ),
    },
    {
      id: 'root',
      kind: 'text',
      step: 'explain',
      title: bi('root и sudo', 'root and sudo'),
      body: bi(
        'У пользователя [[linux.root|root]] номер UID равен 0, и для него система проверку битов прав не выполняет вовсе: root читает и изменяет любой файл. Поэтому постоянно работать под root не принято. Достаточно одной опечатки в команде, и система послушно сломает сама себя.\n\nОбычно права root получают только на одну команду, и для этого служит команда [[linux.sudo|sudo]]. Например, `sudo useradd bob` заводит нового пользователя, а `sudo cat /etc/shadow` показывает файл, который может читать только root. Пользоваться `sudo` разрешено тем, кто перечислен в файле `/etc/sudoers`, обычно участникам группы `sudo`. Каждый такой запуск попадает в журнал, так что потом видно, кто и какую команду выполнил.\n\nВ одну ловушку с `sudo` попадает почти каждый. Команда `sudo echo text > /etc/file` не сработает, потому что запись в файл выполняет ваша оболочка, причём ещё до запуска `sudo`, и выполняет её от вашего имени. Чтобы записать текст в файл, который принадлежит root, запись должна выполнять программа, запущенная через `sudo`: `echo text | sudo tee /etc/file`.',
        '[[linux.root|root]] is the user with UID 0, and the permission bit check is simply skipped for it: root reads and changes any file. That is why nobody works as root all the time — one typo and the system obediently breaks itself.\n\nThe usual way is [[linux.sudo|sudo]]: run one command as root. `sudo useradd bob`, `sudo cat /etc/shadow`. sudo is allowed to those listed in `/etc/sudoers` (usually the members of the `sudo` group), and every use is recorded in the journal: you can see who did what.\n\nOne trap catches everyone. `sudo echo text > /etc/file` does not work: writing to the file is done by your shell, before `sudo` even starts, and done as you. To write to someone else’s file, use a program started with sudo: `echo text | sudo tee /etc/file`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: permSetup,
      intro: bi('На этой учебной машине участникам группы `sudo` не нужно вводить пароль, когда они запускают команды через `sudo`.','On this machine members of the sudo group use sudo without a password.'),
      tasks: [
        {
          id: 'exec',
          prompt: bi('Когда вы пытаетесь запустить программу `~/bin/backup`, оболочка отвечает `Permission denied`. Сделайте так, чтобы запускать программу мог только её владелец, а читать её, как и сейчас, могли все. Затем запустите программу, указав её путь `~/bin/backup`.','The program `~/bin/backup` will not run: `Permission denied`. Make it runnable for its owner only, while everyone can still read it as now. Then run it by its path, `~/bin/backup`.'),
          check: {
            when: "files['/home/learner/bin/backup'].perm.u=rwx && files['/home/learner/bin/backup'].perm.g='r--' && files['/home/learner/bin/backup'].perm.o='r--' && term['main'][last].exit=0",
            fail: [{ if: "files['/home/learner/bin/backup'].perm.o~'x'", say: bi('Право запуска получили и «остальные». Добавьте бит x только владельцу, например командой `chmod u+x` или числом `744`.','“Others” can run it too. Add x for the owner only: `u+x` or `744`.') }],
          },
          chips: 'chmod u+x ~/bin/backup && ~/bin/backup',
          docRef: ref('man/chmod.1', 'DESCRIPTION', 'The letters rwxXst'),
          hints: { H1: bi('Изменить нужно один бит в одной тройке.', 'You need one bit in one triad.'), H2: bi('В буквенной записи сначала указывают, кому меняют права (`u`), потом, что с ними сделать (`+`), и в конце, какой бит (`x`).','The letter notation: whom (`u`), what to do (`+`), which bit (`x`).') },
        },
        {
          id: 'team',
          prompt: bi('Сделайте каталог `/srv/team` общим для группы `dev`. Участники группы должны создавать в нём файлы и читать их, новые файлы должны получать группу `dev`, а остальные пользователи не должны видеть в каталоге ничего.','Make `/srv/team` a shared directory of the group `dev`: its members create and read files, new files get the group `dev`, and others see nothing inside.'),
          check: {
            when: "files['/srv/team'].group=dev && files['/srv/team'].perm.g=rwx && files['/srv/team'].perm.o='---' && files['/srv/team'].perm.setgid=true",
            fail: [
              { if: "files['/srv/team'].group!=dev", say: bi('Группа каталога всё ещё root. Поменять её можно командой `chgrp dev` или `chown :dev`, и запускать эти команды нужно через sudo, потому что каталог принадлежит root.', 'The directory’s group is still root: `chgrp dev` or `chown :dev` changes it — with sudo, the directory belongs to root.') },
              { if: "files['/srv/team'].perm.o!='---'", say: bi('У «остальных» остались права, а последняя цифра режима должна быть 0.', '“Others” still have rights: the last digit of the mode must be 0.') },
              { if: "files['/srv/team'].perm.setgid=false", say: bi('Права в тройках верные, но новые файлы будут получать группу того, кто их создал. Нужен ещё бит setgid: `g+s` в буквенной записи или ведущая цифра 2 в числовой.','The rights are right, but new files will get their creator’s group: you also need the setgid bit (`g+s`, a leading 2).') },
            ],
          },
          chips: 'sudo chgrp dev /srv/team && sudo chmod 2770 /srv/team',
          docRef: ref('man/chmod.1', 'SETUID AND SETGID BITS'),
          hints: {
            H1: bi('Сделать нужно три вещи: сменить группу каталога, выставить права в тройках и включить особый бит, от которого зависит группа новых файлов.', 'Three things: the directory’s group, the rights in the triads, a special bit for the group of new files.'),
            H2: bi('Каталог принадлежит root, поэтому все команды нужно запускать через sudo. Группу каталога меняет команда `chgrp`.', 'The directory belongs to root — you need sudo. `chgrp` changes the group.'),
            H3: bi('Группе нужны права `rwx`, остальным не нужно ничего, и ещё нужен бит setgid. Вместе это записывается числом `2770`.','`rwx` for the group, nothing for others, and setgid: `2770`.'),
          },
        },
        {
          id: 'shadow',
          prompt: bi('Посмотрите первую строку файла `/etc/shadow`. Читать этот файл может только root.', 'Look at the first line of `/etc/shadow` — a file only root may read.'),
          check: { stdout: /^root:/ },
          chips: 'sudo head -n 1 /etc/shadow',
          docRef: ref('man/sudo.8', 'DESCRIPTION'),
          hints: { H1: bi('Без sudo система ответит Permission denied, а через sudo команда выполнится от имени root.','Without sudo — Permission denied. With sudo the command runs as root.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.octal', 'linux.q.dir-x', 'linux.q.umask', 'linux.q.sudo-redirect'] },
  ],
};

export const LESSONS_1: Lesson[] = [terminal, paths, files, manual, users, permissions];
