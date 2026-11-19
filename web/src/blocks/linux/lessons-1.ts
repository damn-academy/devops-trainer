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
  title: bi('Компьютер без экрана: терминал и оболочка', 'A computer without a screen: the terminal and the shell'),
  summary: bi('С сервером говорят текстом. Строка, которую вы печатаете, — это имя команды и её аргументы.', 'You talk to a server in text. The line you type is a command name and its arguments.'),
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
        'Тимлид пишет в чат: «Зайдите на сервер и гляньте, сколько там времени и под каким пользователем мы работаем». Вы открываете подключение — и видите не рабочий стол, а одну строку с мигающим курсором. Кнопок нет. Это не урезанная версия привычного компьютера, а главный способ работать с машиной, которая стоит в чужом здании за тысячу километров: ей не нужны монитор и мышь, ей нужен текст.',
        'Your team lead writes in the chat: “Log in to the server and check what time it is there and which user we run as.” You connect — and see not a desktop but a single line with a blinking cursor. There are no buttons. This is not a cut-down version of the computer you know; it is the main way to work with a machine that stands in someone else’s building a thousand kilometres away: it needs no monitor or mouse, it needs text.',
      ),
    },
    {
      id: 'look',
      kind: 'text',
      step: 'look',
      title: bi('Что на экране', 'What is on the screen'),
      body: bi(
        'Окно, в котором вы печатаете и читаете ответы, называется [[linux.terminal|терминалом]]. Сам по себе терминал ничего не понимает: он передаёт ваши буквы программе и показывает то, что она пишет в ответ. Эта программа — [[linux.shell|оболочка]]; на серверах почти всегда это `bash`.\n\nОболочка начинает разговор с приглашения:\n\n```\nlearner@trainer:~$\n```\n\nДо `@` — имя пользователя, под которым вы работаете. После — имя машины. После двоеточия — где вы сейчас находитесь (`~` пока читайте как «у себя»; что это значит точно, разберём в следующем уроке). Знак `$` — оболочка ждёт команду. Если вместо `$` стоит `#`, вы работаете как администратор, и машина послушается любой команды — даже той, что всё сломает.',
        'The window where you type and read the answers is called a [[linux.terminal|terminal]]. By itself the terminal understands nothing: it passes your keystrokes to a program and shows what that program writes back. That program is the [[linux.shell|shell]]; on servers it is almost always `bash`.\n\nThe shell opens the conversation with a prompt:\n\n```\nlearner@trainer:~$\n```\n\nBefore the `@` is the user you are working as. After it is the name of the machine. After the colon is where you are now (read `~` as “at home” for now; the next lesson explains exactly what it means). The `$` sign means the shell is waiting for a command. If you see `#` instead of `$`, you are working as the administrator, and the machine will obey any command — even one that breaks everything.',
      ),
    },
    {
      id: 'words',
      kind: 'text',
      step: 'explain',
      title: bi('Строка — это слова', 'A line is words'),
      body: bi(
        'Нажали Enter — оболочка делит строку на слова по пробелам. Первое слово — имя команды, остальные — её [[linux.argument|аргументы]]: что обработать и как.\n\n```\necho hello server\n```\n\nЗдесь команда `echo` и два аргумента, `hello` и `server`; `echo` печатает их через один пробел. Сколько пробелов вы поставите между словами, не важно — важно, где кончается одно слово и начинается другое. Чтобы фраза с пробелом стала одним аргументом, её берут в кавычки: `echo "hello,   server"` напечатает фразу как есть, со всеми пробелами.\n\nКоманда что-то печатает — это её вывод — и оболочка снова показывает приглашение. Нажмите стрелку вверх: вернётся прошлая строка, её можно поправить и выполнить снова. Команда `history` покажет всё, что вы набирали, а `clear` очистит экран.',
        'When you press Enter, the shell splits the line into words at the spaces. The first word is the command name; the rest are its [[linux.argument|arguments]]: what to work on and how.\n\n```\necho hello server\n```\n\nHere the command is `echo` with two arguments, `hello` and `server`; `echo` prints them with one space between them. How many spaces you put between words does not matter — what matters is where one word ends and the next begins. To make a phrase with spaces a single argument, put it in quotes: `echo "hello,   server"` prints the phrase as it is, with all its spaces.\n\nThe command prints something — its output — and the shell shows the prompt again. Press the up arrow: the previous line comes back, you can fix it and run it again. `history` shows everything you typed, and `clear` clears the screen.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: {},
      intro: bi('Это учебная машина в браузере. Её можно ломать: кнопка «Сбросить» вернёт её в начало.', 'This is a training machine in your browser. You may break it: the “Reset” button brings it back to the start.'),
      tasks: [
        {
          id: 'date',
          prompt: bi('Узнайте, сколько на сервере времени: команда `date`.', 'Find out what time it is on the server: the `date` command.'),
          check: { when: "term['main'][last].exit=0", stdout: /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b.*\b20\d\d\b/ },
          chips: 'date',
          docRef: ref('man/date.1', 'DESCRIPTION'),
          hints: { H1: bi('Имя команды и есть подсказка.', 'The command name is the hint.'), H2: bi('Наберите `date` и нажмите Enter.', 'Type `date` and press Enter.') },
        },
        {
          id: 'whoami',
          prompt: bi('Узнайте, под каким пользователем вы работаете.', 'Find out which user you are working as.'),
          check: { stdout: /^learner\n?$/ },
          chips: 'whoami',
          docRef: ref('man/whoami.1', 'DESCRIPTION'),
          hints: { H1: bi('Имя видно и в приглашении, но попросите машину сказать его словами.', 'The name is in the prompt too, but ask the machine to say it.'), H2: bi('Команда читается как вопрос по-английски: «кто я?».', 'The command reads like the English question “who am I?”.'), H3: bi('`whoami`', '`whoami`') },
        },
        {
          id: 'echo',
          prompt: bi('Напечатайте фразу `hello,   server` ровно так — с тремя пробелами после запятой.', 'Print the phrase `hello,   server` exactly — with three spaces after the comma.'),
          check: {
            stdout: /^hello, {3}server\n$/,
            fail: [{ if: "term['main'][last].out='hello, server\n'", say: bi('Пробелы схлопнулись: без кавычек оболочка видит два отдельных слова и `echo` ставит между ними один пробел.', 'The spaces collapsed: without quotes the shell sees two separate words and `echo` puts one space between them.') }],
          },
          chips: 'echo "hello,   server"',
          docRef: ref('man/echo.1', 'DESCRIPTION'),
          hints: { H1: bi('Сколько аргументов должно быть у echo, чтобы пробелы сохранились?', 'How many arguments must echo get for the spaces to survive?'), H2: bi('Одна фраза — один аргумент: возьмите её в кавычки.', 'One phrase, one argument: put it in quotes.') },
        },
        {
          id: 'os',
          prompt: bi('Выясните, какая операционная система стоит на машине: её описание лежит в файле `/etc/os-release`, покажите его командой `cat`.', 'Find out which operating system the machine runs: its description is in the file `/etc/os-release`; show it with `cat`.'),
          check: { when: "term['main'][last].exit=0", stdout: 'Debian' },
          chips: 'cat /etc/os-release',
          docRef: ref('man/cat.1', 'DESCRIPTION'),
          hints: { H1: bi('`cat` печатает содержимое файла, имя файла — его аргумент.', '`cat` prints the contents of a file; the file name is its argument.') },
        },
      ],
    },
    {
      id: 'docs-note',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      title: bi('Откуда это известно', 'Where this comes from'),
      body: bi(
        'У каждой команды есть встроенное описание. Под заданиями видна строка вида «date(1) · DESCRIPTION» — нажмите на неё, и откроется кусок этого описания. Пока это просто подсказка рядом; через три урока вы научитесь читать такие страницы сами.',
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
  summary: bi('Все файлы машины растут из одного корня `/`. Путь — адрес файла: от корня или от того места, где вы стоите.', 'Every file of the machine grows from one root, `/`. A path is the address of a file: from the root, or from where you stand.'),
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
      body: bi('«Журналы лежат в /var/log — сходите посмотрите, что там с приложением». Где это «в /var/log» и как туда «сходить», если нет ни проводника, ни папок на экране?', '“The logs are in /var/log — go and see what is up with the app.” Where is “in /var/log”, and how do you “go” there with no file manager and no folders on the screen?'),
    },
    {
      id: 'tree',
      kind: 'text',
      step: 'explain',
      title: bi('Одно дерево', 'One tree'),
      body: bi(
        'На вашем ноутбуке, возможно, есть «диск C:» и «диск D:». В Linux дисков с буквами нет: все файлы машины — одно дерево каталогов, и у него одна вершина — [[linux.root-dir|корневой каталог]] `/`. Второй диск, флешка, сетевая папка подключаются не рядом, а внутрь этого дерева, в какой-нибудь каталог.\n\nУ главных каталогов постоянные роли, они одинаковы почти на любом сервере:\n\n- `/etc` — настройки программ и системы;\n- `/var/log` — журналы, то есть записи о том, что происходило;\n- `/home` — каталоги пользователей;\n- `/usr/bin` — программы;\n- `/tmp` — временные файлы, их можно удалять;\n- `/root` — каталог администратора.\n\nСтоит раз запомнить эту карту, и на незнакомом сервере вы будете знать, куда идти.',
        'Your laptop may have a “C: drive” and a “D: drive”. Linux has no lettered drives: all files of the machine form one tree of directories with a single top, the [[linux.root-dir|root directory]] `/`. A second disk, a USB stick, a network share are attached not next to it but inside this tree, in some directory.\n\nThe main directories have fixed roles, the same on almost any server:\n\n- `/etc` — settings of programs and of the system;\n- `/var/log` — logs, that is, records of what happened;\n- `/home` — the users’ directories;\n- `/usr/bin` — programs;\n- `/tmp` — temporary files, safe to delete;\n- `/root` — the administrator’s directory.\n\nLearn this map once, and on an unfamiliar server you will know where to go.',
      ),
    },
    {
      id: 'paths',
      kind: 'text',
      step: 'explain',
      title: bi('Путь — это адрес', 'A path is an address'),
      body: bi(
        'Путь называет файл, перечисляя каталоги через `/`. [[linux.abs-path|Абсолютный путь]] начинается с корня: `/var/log/app/app.log` — с какого бы места его ни набрали, он ведёт к одному и тому же файлу. Относительный путь начинается не с `/` и отсчитывается от текущего каталога — того, где вы сейчас «стоите». Его показывает `pwd`, а меняет `cd`.\n\nДва особых имени есть в каждом каталоге: `.` — сам этот каталог, `..` — тот, что выше. Из `/var/log` путь `../lib` ведёт в `/var/lib`, а `cd ..` поднимает на уровень вверх.\n\nУ каждого пользователя есть свой [[linux.home|домашний каталог]]: у вас — `/home/learner`. Знак `~` в начале пути — его короткое имя: `~/notes` — это `/home/learner/notes`, а `cd` без аргументов возвращает домой. Вот что значил `~` в приглашении.\n\nЕщё одна мелочь, о которую спотыкаются все: файлы, имя которых начинается с точки, `ls` не показывает. Это не секрет, а договорённость — так прячут настройки (`.bashrc`). Увидеть их помогает `ls -a`.',
        'A path names a file by listing directories separated by `/`. An [[linux.abs-path|absolute path]] starts at the root: `/var/log/app/app.log` leads to the same file wherever you type it. A relative path does not start with `/` and is counted from the current directory — where you “stand” now. `pwd` shows it and `cd` changes it.\n\nEvery directory has two special names: `.` is the directory itself, `..` the one above. From `/var/log` the path `../lib` leads to `/var/lib`, and `cd ..` moves one level up.\n\nEvery user has a [[linux.home|home directory]]: yours is `/home/learner`. A `~` at the start of a path is its short name: `~/notes` is `/home/learner/notes`, and `cd` with no arguments takes you home. That is what the `~` in the prompt meant.\n\nOne more detail everyone trips over: `ls` does not show files whose names start with a dot. It is not a secret, just a convention for hiding settings (`.bashrc`). `ls -a` shows them.',
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
          check: { when: "cwd='/var/log/app'", stdout: /^\/var\/log\/app\n$/, fail: [{ if: "cwd='/var/log'", say: bi('Вы в общем каталоге журналов; у приложения внутри свой каталог — посмотрите `ls`.', 'You are in the common log directory; the app has its own directory inside — look with `ls`.') }] },
          chips: 'cd /var/log/app && pwd',
          docRef: ref('man/pwd.1', 'DESCRIPTION'),
          hints: { H1: bi('Сначала дойдите до `/var/log`, посмотрите, что там лежит.', 'First get to `/var/log` and look at what is there.'), H2: bi('`cd` меняет каталог, `pwd` печатает, где вы.', '`cd` changes the directory, `pwd` prints where you are.'), H3: bi('`cd /var/log/app`, затем `pwd`.', '`cd /var/log/app`, then `pwd`.') },
        },
        {
          id: 'relative',
          prompt: bi('Не набирая `/` в начале пути, перейдите отсюда в `/var/lib`.', 'Without typing `/` at the start of the path, get from here to `/var/lib`.'),
          check: { when: "cwd='/var/lib'" },
          chips: 'cd ../../lib',
          hints: { H1: bi('`..` — каталог на уровень выше. Сколько уровней до `/var`?', '`..` is the directory one level up. How many levels to `/var`?'), H2: bi('Из `/var/log/app` до `/var` — два шага вверх, дальше вниз в `lib`.', 'From `/var/log/app` it is two steps up to `/var`, then down into `lib`.') },
        },
        {
          id: 'hidden',
          prompt: bi('Вернитесь домой и найдите там файл, который обычный `ls` не показывает. Выведите список так, чтобы он был виден.', 'Go back home and find a file there that a plain `ls` does not show. List the directory so that it is visible.'),
          check: { when: "cwd='/home/learner'", stdout: '.secret-plan' },
          chips: 'cd && ls -a',
          docRef: ref('man/ls.1', 'OPTIONS', '-a, --all'),
          hints: { H1: bi('`cd` без аргументов ведёт домой.', '`cd` with no arguments takes you home.'), H2: bi('Скрытые файлы начинаются с точки; у `ls` есть флаг «все».', 'Hidden files start with a dot; `ls` has an “all” flag.') },
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
  title: bi('Файлы: создать, скопировать, заглянуть внутрь, упаковать', 'Files: create, copy, look inside, pack'),
  summary: bi('Четыре операции над именами, шаблоны, которые раскрывает оболочка, просмотр текста и архивы tar.', 'Four operations on names, patterns the shell expands, viewing text, and tar archives.'),
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
      body: bi('«Перед тем как править конфиг, сделайте копию» — первое правило любого администратора. Второе: «удалённое не вернуть». В Linux нет корзины, и `rm` удаляет сразу.', '“Before you edit a config, make a copy” — the first rule of any administrator. The second: “what is deleted is gone”. Linux has no trash can, and `rm` deletes at once.'),
    },
    {
      id: 'ops',
      kind: 'text',
      step: 'explain',
      title: bi('Четыре операции', 'Four operations'),
      body: bi(
        'С файлами делают четыре вещи. `touch файл` создаёт пустой файл, `mkdir каталог` — каталог; `mkdir -p a/b/c` создаёт всю цепочку сразу. `cp откуда куда` копирует: `cp app.conf app.conf.bak`. `mv откуда куда` перемещает — или переименовывает, это одно и то же: имя файла просто переезжает. `rm файл` удаляет, а `rm -r каталог` — каталог со всем содержимым.\n\nЕсли последний аргумент `cp` или `mv` — существующий каталог, файлы отправляются внутрь него с прежними именами: `cp a.txt b.txt backup/`.\n\nЧасто нужно обработать сразу много файлов: «все журналы». Для этого есть [[linux.glob|шаблоны имён]]: `*` значит «любые символы», `?` — «один любой символ». `*.log` — все имена, оканчивающиеся на `.log`. Важно, кто раскрывает шаблон: это делает оболочка, ещё до запуска команды. Команда `mv *.log logs/` получает уже готовый список имён, как если бы вы напечатали их сами. Если ни одно имя не подошло, шаблон остаётся как есть — и команда пожалуется, что файла `*.log` нет.\n\nОкончание имени — `.txt`, `.conf`, `.jpg` — часть имени, а не тип. Что внутри на самом деле, скажет `file имя`: она смотрит в содержимое.',
        'There are four things you do with files. `touch file` creates an empty file, `mkdir dir` a directory; `mkdir -p a/b/c` creates the whole chain at once. `cp from to` copies: `cp app.conf app.conf.bak`. `mv from to` moves — or renames, which is the same thing: the name of the file simply moves. `rm file` deletes, and `rm -r dir` deletes a directory with everything inside.\n\nIf the last argument of `cp` or `mv` is an existing directory, the files go inside it under their old names: `cp a.txt b.txt backup/`.\n\nOften you need to handle many files at once: “all the logs”. That is what [[linux.glob|glob patterns]] are for: `*` means “any characters”, `?` “one character”. `*.log` is every name ending in `.log`. It matters who expands the pattern: the shell does, before the command starts. `mv *.log logs/` receives a ready list of names, as if you had typed them yourself. If no name matches, the pattern stays as it is — and the command complains that there is no file called `*.log`.\n\nThe ending of a name — `.txt`, `.conf`, `.jpg` — is part of the name, not its type. What is really inside, `file name` tells you: it looks at the contents.',
      ),
    },
    {
      id: 'look',
      kind: 'text',
      step: 'explain',
      title: bi('Заглянуть внутрь', 'Looking inside'),
      body: bi(
        '`cat файл` печатает файл целиком — удобно для коротких. Длинный журнал читают `less`: пробел листает вперёд, `b` — назад, `/слово` ищет, `q` выходит. `head -n 5 файл` показывает первые пять строк, `tail -n 5` — последние; новые записи в журнал добавляются в конец, поэтому `tail` — самый частый способ посмотреть, что только что случилось.\n\n### Архив\n\nЧтобы перенести каталог на другую машину или сохранить его копию, его склеивают в один файл — [[linux.archive|архив]]. Это делает `tar`, и в архиве сохраняются имена, права и даты. Сжатие — отдельный шаг, `gzip`, но `tar` умеет вызвать его сам:\n\n```\ntar -czf site.tar.gz site/      # c — создать, z — сжать, f — в этот файл\ntar -tzf site.tar.gz            # t — показать, что внутри, ничего не распаковывая\ntar -xzf site.tar.gz -C /tmp    # x — распаковать, -C — в этот каталог\n```\n\nПервое, что стоит сделать с чужим архивом, — `tar -t`: так видно, не высыплется ли он сотней файлов в текущий каталог.',
        '`cat file` prints a file in full — handy for short ones. A long log is read with `less`: space pages forward, `b` back, `/word` searches, `q` quits. `head -n 5 file` shows the first five lines, `tail -n 5` the last five; new log entries are added at the end, so `tail` is the most common way to see what just happened.\n\n### An archive\n\nTo move a directory to another machine or keep a copy of it, you glue it into one file — an [[linux.archive|archive]]. `tar` does that, and the archive keeps names, modes and dates. Compression is a separate step, `gzip`, but `tar` can call it itself:\n\n```\ntar -czf site.tar.gz site/      # c — create, z — compress, f — into this file\ntar -tzf site.tar.gz            # t — list what is inside without unpacking\ntar -xzf site.tar.gz -C /tmp    # x — extract, -C — into this directory\n```\n\nThe first thing to do with someone else’s archive is `tar -t`: you see whether it is going to spill a hundred files into the current directory.',
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
          prompt: bi('Сохраните копию `/etc/app/app.conf` в `~/backup/app.conf.bak`. Каталога `~/backup` пока нет.', 'Save a copy of `/etc/app/app.conf` as `~/backup/app.conf.bak`. The `~/backup` directory does not exist yet.'),
          check: {
            when: "files['/home/learner/backup/app.conf.bak'].text~'workers 4'",
            fail: [{ if: "files['/home/learner/backup'].type=f", say: bi('`~/backup` получился файлом, а не каталогом: cp скопировал конфиг под именем backup. Удалите его и создайте каталог `mkdir`.', '`~/backup` became a file, not a directory: cp copied the config under the name backup. Remove it and create the directory with `mkdir`.') }],
          },
          chips: 'mkdir ~/backup && cp /etc/app/app.conf ~/backup/app.conf.bak',
          docRef: ref('man/cp.1', 'SYNOPSIS'),
          hints: { H1: bi('Две вещи: каталог и копия.', 'Two things: a directory and a copy.'), H2: bi('`mkdir` создаёт каталог, `cp откуда куда` копирует.', '`mkdir` makes a directory, `cp from to` copies.') },
        },
        {
          id: 'move-logs',
          prompt: bi('Переложите все файлы `.log` из `~/inbox` в новый каталог `~/logs` одной командой `mv`, не перечисляя имена.', 'Move all `.log` files from `~/inbox` into a new directory `~/logs` with one `mv` command, without listing the names.'),
          check: {
            when: "files['/home/learner/logs/report-1.log'].type=f && files['/home/learner/logs/report-2.log'].type=f && !files['/home/learner/inbox/report-1.log'] && files['/home/learner/inbox/photo.jpg'].type=f",
            fail: [{ if: "!files['/home/learner/inbox/photo.jpg']", say: bi('Фотография тоже уехала: шаблон должен брать только имена на `.log`.', 'The photo moved too: the pattern must take only names ending in `.log`.') }],
          },
          chips: 'mkdir ~/logs && mv ~/inbox/*.log ~/logs/',
          hints: { H1: bi('Шаблон `*` значит «любые символы».', 'The `*` pattern means “any characters”.'), H2: bi('`mv ~/inbox/*.log ~/logs/` — но каталог должен существовать.', '`mv ~/inbox/*.log ~/logs/` — but the directory must exist.') },
        },
        {
          id: 'tail',
          prompt: bi('Покажите последние две строки `~/logs/report-1.log`.', 'Show the last two lines of `~/logs/report-1.log`.'),
          check: { stdout: /^line 6\nERROR disk full\n$/ },
          chips: 'tail -n 2 ~/logs/report-1.log',
          docRef: ref('man/tail.1', 'OPTIONS', '-n, --lines'),
          hints: { H1: bi('Конец файла показывает `tail`; сколько строк — флагом.', '`tail` shows the end of a file; how many lines — with a flag.') },
        },
        {
          id: 'pack',
          prompt: bi('Упакуйте каталог `~/site` в сжатый архив `~/site.tar.gz`, а затем распакуйте его в `/tmp/restore` — так, чтобы появился `/tmp/restore/site/index.html`.', 'Pack the `~/site` directory into a compressed archive `~/site.tar.gz`, then unpack it into `/tmp/restore` so that `/tmp/restore/site/index.html` appears.'),
          check: {
            when: "files['/home/learner/site.tar.gz'].type=f && files['/tmp/restore/site/index.html'].text~'Edu Cafe'",
            fail: [
              { if: "files['/tmp/restore/home/learner/site/index.html'].type=f", say: bi('В архив попал полный путь `home/learner/site`: упаковывайте из домашнего каталога относительным путём `site/`.', 'The archive got the full path `home/learner/site`: pack from your home directory with the relative path `site/`.') },
              { if: "files['/home/learner/site.tar.gz'].type=f && !files['/tmp/restore']", say: bi('Архив есть. Каталог `/tmp/restore` нужно создать до распаковки.', 'The archive exists. Create `/tmp/restore` before unpacking.') },
            ],
          },
          chips: 'cd ~ && tar -czf site.tar.gz site/ && mkdir /tmp/restore && tar -xzf site.tar.gz -C /tmp/restore',
          docRef: ref('man/tar.1', 'OPTIONS', '-C, --directory'),
          hints: { H1: bi('Сначала создать архив, потом распаковать его в другом месте.', 'First create the archive, then unpack it elsewhere.'), H2: bi('`tar -czf` упаковывает, `tar -xzf … -C каталог` распаковывает в каталог.', '`tar -czf` packs, `tar -xzf … -C dir` unpacks into a directory.') },
        },
      ],
    },
    {
      id: 'rm',
      kind: 'callout',
      tone: 'warn',
      step: 'explain',
      title: bi('Один пробел', 'One space'),
      body: bi('`rm -rf ~/old-project` удаляет старый проект. `rm -rf ~ /old-project` — с лишним пробелом после `~` — получает два аргумента и удаляет весь домашний каталог. Перед `rm -r` перечитайте строку.', '`rm -rf ~/old-project` deletes the old project. `rm -rf ~ /old-project` — with an extra space after `~` — gets two arguments and deletes your whole home directory. Read the line again before `rm -r`.'),
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
  summary: bi('Страница руководства всегда устроена одинаково. Найти флаг по описанию — навык, который нужен каждый день.', 'A manual page is always laid out the same way. Finding a flag by its description is a skill you need every day.'),
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
      body: bi('На собеседовании спросят флаг, которого вы не учили. На работе — тем более: команд сотни, флагов тысячи, и запомнить их нельзя. Можно другое — за минуту найти нужный в описании, которое лежит прямо в системе.', 'At an interview you will be asked about a flag you never learned. At work even more so: there are hundreds of commands and thousands of flags, and nobody remembers them. What you can do is find the right one in a minute, in the description that sits right there in the system.'),
    },
    {
      id: 'anatomy-text',
      kind: 'text',
      step: 'explain',
      title: bi('Анатомия страницы', 'The anatomy of a page'),
      body: bi(
        'У каждой команды есть [[linux.man-page|страница руководства]]: `man ls` открывает её в листалке (пробел — дальше, `/слово` — поиск, `n` — следующее совпадение, `q` — выход). Страницы всегда разбиты на одни и те же разделы:\n\n- **NAME** — имя и одна строка «что делает»;\n- **SYNOPSIS** — грамматика вызова;\n- **DESCRIPTION** — как это работает;\n- **OPTIONS** — флаги, по одному на абзац;\n- **EXIT STATUS** — что значат числа, которыми команда завершается;\n- **EXAMPLES** — примеры (есть не везде);\n- **SEE ALSO** — куда смотреть дальше.\n\nSYNOPSIS читается как формула: `cp [OPTION]... SOURCE... DIRECTORY`. Квадратные скобки — необязательное, многоточие — «можно повторить», заглавные буквы — «подставьте своё». Значит, флагов может не быть или быть несколько, файлов-источников — сколько угодно, а последним идёт каталог.\n\nУ руководства есть разделы-тома: 1 — команды, 5 — форматы файлов, 8 — команды администратора. `man crontab` и `man 5 crontab` — две разные страницы: про команду и про формат файла с тем же именем. Не помните имени команды — `man -k слово` найдёт страницы, в описании которых есть это слово.\n\nКороткая справка есть и без страницы: почти любая команда понимает `--help`.',
        'Every command has a [[linux.man-page|manual page]]: `man ls` opens it in a pager (space — forward, `/word` — search, `n` — next match, `q` — quit). The pages are always split into the same sections:\n\n- **NAME** — the name and one line of what it does;\n- **SYNOPSIS** — the grammar of a call;\n- **DESCRIPTION** — how it works;\n- **OPTIONS** — the flags, one paragraph each;\n- **EXIT STATUS** — what the numbers the command ends with mean;\n- **EXAMPLES** — examples (not everywhere);\n- **SEE ALSO** — where to look next.\n\nSYNOPSIS reads like a formula: `cp [OPTION]... SOURCE... DIRECTORY`. Square brackets are optional, an ellipsis means “may repeat”, capitals mean “put yours here”. So there may be no flags or several, any number of source files, and a directory comes last.\n\nThe manual has volumes, called sections: 1 — commands, 5 — file formats, 8 — administration commands. `man crontab` and `man 5 crontab` are two different pages: about the command, and about the format of the file with the same name. If you do not remember a command’s name, `man -k word` finds the pages whose descriptions contain the word.\n\nA short reference exists even without a page: almost every command understands `--help`.',
      ),
    },
    { id: 'anatomy', kind: 'docs', step: 'try', mode: 'anatomy', prompt: bi('Откройте `ls(1)`: в каком разделе страницы перечислены флаги? Нажмите на него.', 'Open `ls(1)`: in which section of the page are the flags listed? Click it.'), ref: ref('man/ls.1'), answer: 'OPTIONS' },
    { id: 'synopsis', kind: 'docs', step: 'try', mode: 'anatomy', prompt: bi('А в каком разделе страницы `cp(1)` видно, сколько файлов можно скопировать одной командой?', 'And in which section of `cp(1)` can you see how many files one command may copy?'), ref: ref('man/cp.1'), answer: 'SYNOPSIS' },
    {
      id: 'builtins',
      kind: 'text',
      step: 'explain',
      title: bi('Команды, у которых нет страницы', 'Commands without a page'),
      body: bi(
        'Наберите `man cd` — страница найдётся, но короткая и общая. Дело в том, что `cd` — не программа, а [[linux.builtin|встроенная команда]]: её выполняет сама оболочка. Сменить текущий каталог может только тот, чей это каталог, — отдельная программа сменила бы его себе и тут же закончилась. Встроенные команды описывает `help`: `help cd`, `help export`. Отличить одно от другого поможет `type`: `type cd` ответит «cd is a shell builtin», `type ls` — «ls is /usr/bin/ls».',
        'Type `man cd` — a page shows up, but a short and generic one. The reason is that `cd` is not a program but a [[linux.builtin|shell builtin]]: the shell runs it itself. Only the owner of the current directory can change it — a separate program would change its own and finish at once. Builtins are described by `help`: `help cd`, `help export`. `type` tells one from the other: `type cd` answers “cd is a shell builtin”, `type ls` — “ls is /usr/bin/ls”.',
      ),
    },
    {
      id: 'find-size',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите в `ls(1)` флаг, который сортирует по размеру, и выведите `/srv/logs` так, чтобы самый большой файл был первым.', 'Find the `ls(1)` flag that sorts by size and list `/srv/logs` with the biggest file first.'),
      ref: ref('man/ls.1', 'OPTIONS', 'sort by file size'),
      terminal: {
        setup: manSetup,
        task: {
          id: 'sort-size',
          prompt: bi('Выведите `/srv/logs`, самый большой файл первым.', 'List `/srv/logs` with the biggest file first.'),
          check: { stdout: /^big\.log\s+medium\.log\s+small\.log\s*$|total \d+\n.*big\.log\n.*medium\.log\n.*small\.log/ },
          docStep: 2,
          chips: 'ls -S /srv/logs',
          hints: { H1: bi('Флаг называется по-английски словом «размер».', 'The flag is named after the English word “size”.'), H2: bi('Откройте OPTIONS страницы ls и ищите `/size`.', 'Open the OPTIONS of the ls page and search `/size`.') },
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
          prompt: bi('Узнайте, чем является `cd`: программой или встроенной командой.', 'Find out what `cd` is: a program or a shell builtin.'),
          check: { stdout: 'cd is a shell builtin' },
          chips: 'type cd',
          hints: { H1: bi('Команда из трёх букв из этого урока.', 'A four-letter command from this lesson.') },
        },
        {
          id: 'apropos',
          prompt: bi('Не зная имени, найдите команду, которая «копирует файлы»: поищите по описаниям страниц.', 'Without knowing its name, find the command that “copies files”: search the page descriptions.'),
          check: { stdout: /cp \(1\)/ },
          chips: 'man -k copy',
          docRef: ref('man/man.1', 'OPTIONS', '-k, --apropos'),
          hints: { H1: bi('У `man` есть режим поиска по ключевому слову.', '`man` has a keyword search mode.') },
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
  summary: bi('Система различает людей по номерам. Кто вы для неё — показывает `id`, кто вообще есть на машине — `/etc/passwd`.', 'The system tells people apart by numbers. Who you are to it, `id` shows; who exists on the machine at all, `/etc/passwd`.'),
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
      body: bi('Коллега открывает журнал развёртывания и читает его, а у вас — «Permission denied». Файл тот же, машина та же. Разница в том, кто спрашивает.', 'A colleague opens the deployment log and reads it, while you get “Permission denied”. Same file, same machine. The difference is who is asking.'),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Кто вы для системы', 'Who you are to the system'),
      body: bi(
        'Каждая команда выполняется от имени какого-то пользователя, и каждый файл кому-то принадлежит. Система при этом смотрит не на имена, а на номера: [[linux.user|идентификатор пользователя]], UID. Имя `learner` — для людей, для системы вы — 1000. Администратор `root` — это всегда UID 0.\n\nПользователей объединяют в группы, чтобы давать права сразу нескольким: «все разработчики могут читать журналы». У [[linux.group|группы пользователей]] тоже есть номер, GID. У каждого пользователя одна основная группа (обычно с его же именем) и сколько угодно дополнительных.\n\n`id` показывает всё сразу:\n\n```\nuid=1000(learner) gid=1000(learner) groups=1000(learner),4(adm),27(sudo),100(users)\n```\n\nУчётные записи хранятся в обычном текстовом файле `/etc/passwd`, по строке на пользователя, семь полей через двоеточие:\n\n```\nanna:x:1001:1001:anna,,,:/home/anna:/bin/bash\n```\n\nИмя, `x`, UID, GID основной группы, описание, домашний каталог, оболочка. `x` во втором поле значит, что пароль хранится не здесь: в зашифрованном виде он лежит в `/etc/shadow`, а этот файл может читать только root. Группы — в `/etc/group`: имя, `x`, GID и список участников. Подробности — в `man 5 passwd` и `man 5 group`: это страницы про формат файлов, том 5.',
        'Every command runs as some user, and every file belongs to someone. The system looks not at names but at numbers: the [[linux.user|user ID]], UID. The name `learner` is for people; to the system you are 1000. The administrator, `root`, is always UID 0.\n\nUsers are put into groups to give rights to several of them at once: “all developers may read the logs”. A [[linux.group|user group]] has a number too, the GID. Every user has one primary group (usually with the same name) and any number of supplementary ones.\n\n`id` shows it all at once:\n\n```\nuid=1000(learner) gid=1000(learner) groups=1000(learner),4(adm),27(sudo),100(users)\n```\n\nAccounts are kept in an ordinary text file, `/etc/passwd`, one line per user, seven fields separated by colons:\n\n```\nanna:x:1001:1001:anna,,,:/home/anna:/bin/bash\n```\n\nName, `x`, UID, GID of the primary group, description, home directory, shell. The `x` in the second field means the password is not here: it is kept encrypted in `/etc/shadow`, a file only root may read. Groups are in `/etc/group`: name, `x`, GID and the list of members. The details are in `man 5 passwd` and `man 5 group`: pages about file formats, volume 5.',
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
          prompt: bi('Выведите свой UID, GID и все свои группы одной командой.', 'Print your UID, GID and all your groups with one command.'),
          check: { stdout: /uid=1000\(learner\) gid=1000\(learner\) groups=/ },
          chips: 'id',
          docRef: ref('man/id.1', 'DESCRIPTION'),
          hints: { H1: bi('Команда из двух букв.', 'A two-letter command.') },
        },
        {
          id: 'bob',
          prompt: bi('Выясните, в каких группах состоит пользователь `bob`.', 'Find out which groups the user `bob` is in.'),
          check: { stdout: /dev/ },
          chips: 'groups bob',
          docRef: ref('man/groups.1', 'DESCRIPTION'),
          hints: { H1: bi('И `id`, и `groups` принимают имя пользователя аргументом.', 'Both `id` and `groups` take a user name as an argument.') },
        },
        {
          id: 'shell',
          prompt: bi('Найдите в `/etc/passwd` строку пользователя `anna` и узнайте её домашний каталог.', 'Find the line of the user `anna` in `/etc/passwd` and find out her home directory.'),
          check: { stdout: /^anna:x:1001:1001:[^:]*:\/home\/anna:/m },
          chips: 'grep anna /etc/passwd',
          docRef: ref('man/grep.1', 'DESCRIPTION'),
          hints: { H1: bi('Можно вывести весь файл через `cat`, а можно попросить `grep` показать только строки со словом `anna`.', 'You can print the whole file with `cat`, or ask `grep` to show only the lines with the word `anna`.') },
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
  summary: bi('Девять битов rwx в трёх тройках, восьмеричная запись, права на каталоги, root, который проверку пропускает, и sudo.', 'Nine rwx bits in three triads, the octal notation, rights on directories, root who skips the check, and sudo.'),
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
      body: bi('Сайт отдаёт ошибку 403, «доступ запрещён». Файл на месте, содержимое правильное, веб-сервер работает. Причина обычно в девяти символах, которые показывает `ls -l`, — и часто не у самого файла, а у каталога над ним.', 'The site answers 403, “forbidden”. The file is there, its contents are right, the web server runs. The cause is usually in nine characters that `ls -l` shows — and often not on the file itself but on a directory above it.'),
    },
    {
      id: 'bits',
      kind: 'text',
      step: 'explain',
      title: bi('Три тройки', 'Three triads'),
      body: bi(
        '`ls -l` показывает у каждого файла строку вида:\n\n```\n-rwxr-x--- 1 anna dev 1832 Nov 18 09:00 report.sh\n```\n\nПервый символ — тип (`-` файл, `d` каталог, `l` ссылка). Дальше девять символов — [[linux.mode|биты прав]], три тройки: для владельца (`rwx`), для группы файла (`r-x`), для всех остальных (`---`). `r` — читать, `w` — изменять, `x` — запускать; прочерк — нельзя. Потом владелец `anna` и группа `dev`.\n\nКогда кто-то обращается к файлу, система выбирает **ровно одну** тройку: если вы владелец — первую; иначе, если вы в группе файла, — вторую; иначе третью. Тройки не складываются: если у владельца `r--`, а у группы `rw-`, владелец всё равно не сможет писать, даже если он сам в этой группе.\n\nУ каталога те же буквы значат другое: `r` — посмотреть список имён, `w` — создавать и удалять в нём файлы, `x` — входить в каталог и проходить сквозь него к файлам глубже. Отсюда два следствия. Удалить файл можно, если есть `w` у каталога, — права самого файла тут не важны. И чтобы прочитать `/srv/www/index.html`, нужен `x` на каждом каталоге пути: `/srv`, `/srv/www`. Убрать `x` с любого из них — и файл не прочитать при любых его собственных правах. Это и есть тот самый частый 403.',
        '`ls -l` shows a line like this for every file:\n\n```\n-rwxr-x--- 1 anna dev 1832 Nov 18 09:00 report.sh\n```\n\nThe first character is the type (`-` a file, `d` a directory, `l` a link). Then nine characters — the [[linux.mode|permission bits]], three triads: for the owner (`rwx`), for the file’s group (`r-x`), for everyone else (`---`). `r` is read, `w` is change, `x` is run; a dash means no. Then the owner, `anna`, and the group, `dev`.\n\nWhen someone accesses a file, the system picks **exactly one** triad: if you are the owner, the first; otherwise, if you are in the file’s group, the second; otherwise the third. The triads do not add up: if the owner has `r--` and the group `rw-`, the owner still cannot write, even if she is in that group herself.\n\nOn a directory the same letters mean something else: `r` — see the list of names, `w` — create and delete files in it, `x` — enter the directory and pass through it to files deeper down. Two things follow. You can delete a file if you have `w` on the directory — the file’s own mode does not matter. And to read `/srv/www/index.html` you need `x` on every directory of the path: `/srv`, `/srv/www`. Remove `x` from any of them and the file cannot be read whatever its own mode. That is the common 403.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'linux.perm', caption: bi('Выберите режим, кто спрашивает и что он хочет сделать. Попробуйте «сломать» каталог /srv.', 'Choose the mode, who asks and what they want. Try “breaking” the /srv directory.') },
    {
      id: 'chmod',
      kind: 'text',
      step: 'explain',
      title: bi('chmod: числа и буквы', 'chmod: numbers and letters'),
      body: bi(
        'Права меняет владелец файла командой `chmod`, двумя способами. Числом: каждой тройке — одна цифра, где `r` = 4, `w` = 2, `x` = 1, и они складываются. `rwx` = 7, `r-x` = 5, `---` = 0, поэтому `chmod 750 report.sh` даёт `rwxr-x---`. Буквами — когда нужно поменять один бит, не трогая остальных: `chmod u+x deploy.sh` добавляет запуск владельцу, `chmod o-r notes.txt` убирает чтение остальным, `chmod g=rw file` ставит группе ровно `rw-`.\n\nВладельца и группу меняет `chown`: `chown anna:dev report.sh`. Сменить владельца может только root, а сменить группу — и сам владелец, если он в той группе.\n\nНовые файлы получают права не «все», а за вычетом маски `umask`: обычно она `022`, и новый файл получает `644`, новый каталог — `755`.\n\nДля общих каталогов команды есть два особых бита. setgid на каталоге (`chmod g+s`, четвёртая цифра 2) — новые файлы в нём получают группу каталога, а не группу создателя. sticky (`chmod +t`, цифра 1) — удалять файл может только его владелец; он стоит на `/tmp`, иначе любой удалял бы чужие файлы.',
        'The owner of a file changes its rights with `chmod`, in two ways. With a number: one digit per triad, where `r` = 4, `w` = 2, `x` = 1, added up. `rwx` = 7, `r-x` = 5, `---` = 0, so `chmod 750 report.sh` gives `rwxr-x---`. With letters — when you want to change one bit and leave the rest alone: `chmod u+x deploy.sh` adds run for the owner, `chmod o-r notes.txt` takes read away from others, `chmod g=rw file` sets the group to exactly `rw-`.\n\n`chown` changes the owner and the group: `chown anna:dev report.sh`. Only root may change the owner; the owner may change the group, if she is in that group.\n\nNew files do not get “everything” but everything minus the mask `umask`: usually it is `022`, so a new file gets `644` and a new directory `755`.\n\nFor a team’s shared directories there are two special bits. setgid on a directory (`chmod g+s`, a leading digit 2) — new files in it get the directory’s group instead of the creator’s. sticky (`chmod +t`, digit 1) — only a file’s owner may delete it; `/tmp` has it, otherwise anyone could delete anyone’s files.',
      ),
    },
    {
      id: 'root',
      kind: 'text',
      step: 'explain',
      title: bi('root и sudo', 'root and sudo'),
      body: bi(
        '[[linux.root|root]] — пользователь с UID 0, и для него проверка битов прав просто пропускается: он читает и меняет любой файл. Поэтому под root не работают постоянно — одна опечатка, и система послушно сломает себя.\n\nОбычный способ — [[linux.sudo|sudo]]: выполнить одну команду от имени root. `sudo systemctl restart nginx`, `sudo cat /etc/shadow`. sudo разрешён тем, кто перечислен в `/etc/sudoers` (обычно — участникам группы `sudo`), и каждое использование записывается в журнал: видно, кто и что делал.\n\nОдна ловушка встречается у всех. `sudo echo text > /etc/file` не работает: запись в файл делает ваша оболочка, ещё до запуска `sudo`, и делает её от вашего имени. Писать в чужой файл нужно программой, запущенной через sudo: `echo text | sudo tee /etc/file`.',
        '[[linux.root|root]] is the user with UID 0, and the permission bit check is simply skipped for it: root reads and changes any file. That is why nobody works as root all the time — one typo and the system obediently breaks itself.\n\nThe usual way is [[linux.sudo|sudo]]: run one command as root. `sudo systemctl restart nginx`, `sudo cat /etc/shadow`. sudo is allowed to those listed in `/etc/sudoers` (usually the members of the `sudo` group), and every use is recorded in the journal: you can see who did what.\n\nOne trap catches everyone. `sudo echo text > /etc/file` does not work: writing to the file is done by your shell, before `sudo` even starts, and done as you. To write to someone else’s file, use a program started with sudo: `echo text | sudo tee /etc/file`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: permSetup,
      intro: bi('На этой машине участники группы sudo выполняют sudo без пароля.', 'On this machine members of the sudo group use sudo without a password.'),
      tasks: [
        {
          id: 'exec',
          prompt: bi('Программа `~/bin/backup` не запускается: `Permission denied`. Сделайте так, чтобы запускать её мог только её владелец, а читать — все, как сейчас. Затем запустите её по пути `~/bin/backup`.', 'The program `~/bin/backup` will not run: `Permission denied`. Make it runnable for its owner only, while everyone can still read it as now. Then run it by its path, `~/bin/backup`.'),
          check: {
            when: "files['/home/learner/bin/backup'].perm.u=rwx && files['/home/learner/bin/backup'].perm.g='r--' && files['/home/learner/bin/backup'].perm.o='r--' && term['main'][last].exit=0",
            fail: [{ if: "files['/home/learner/bin/backup'].perm.o~'x'", say: bi('Запуск получили и «остальные». Добавьте x только владельцу: `u+x` или `744`.', '“Others” can run it too. Add x for the owner only: `u+x` or `744`.') }],
          },
          chips: 'chmod u+x ~/bin/backup && ~/bin/backup',
          docRef: ref('man/chmod.1', 'DESCRIPTION', 'The letters rwxXst'),
          hints: { H1: bi('Нужен один бит у одной тройки.', 'You need one bit in one triad.'), H2: bi('Буквенная запись: кому (`u`), что сделать (`+`), какой бит (`x`).', 'The letter notation: whom (`u`), what to do (`+`), which bit (`x`).') },
        },
        {
          id: 'team',
          prompt: bi('Сделайте `/srv/team` общим каталогом группы `dev`: её участники создают и читают файлы, новые файлы получают группу `dev`, а остальные не видят в каталоге ничего.', 'Make `/srv/team` a shared directory of the group `dev`: its members create and read files, new files get the group `dev`, and others see nothing inside.'),
          check: {
            when: "files['/srv/team'].group=dev && files['/srv/team'].perm.g=rwx && files['/srv/team'].perm.o='---' && files['/srv/team'].perm.setgid=true",
            fail: [
              { if: "files['/srv/team'].group!=dev", say: bi('Группа каталога всё ещё root: её меняет `chgrp dev` или `chown :dev` — через sudo, каталог принадлежит root.', 'The directory’s group is still root: `chgrp dev` or `chown :dev` changes it — with sudo, the directory belongs to root.') },
              { if: "files['/srv/team'].perm.o!='---'", say: bi('У «остальных» остались права: последняя цифра режима должна быть 0.', '“Others” still have rights: the last digit of the mode must be 0.') },
              { if: "files['/srv/team'].perm.setgid=false", say: bi('Права верные, но новые файлы получат группу создателя: нужен ещё бит setgid (`g+s`, ведущая цифра 2).', 'The rights are right, but new files will get their creator’s group: you also need the setgid bit (`g+s`, a leading 2).') },
            ],
          },
          chips: 'sudo chgrp dev /srv/team && sudo chmod 2770 /srv/team',
          docRef: ref('man/chmod.1', 'SETUID AND SETGID BITS'),
          hints: {
            H1: bi('Три вещи: группа каталога, права в тройках, особый бит для группы новых файлов.', 'Three things: the directory’s group, the rights in the triads, a special bit for the group of new files.'),
            H2: bi('Каталог принадлежит root — нужен sudo. Группу меняет `chgrp`.', 'The directory belongs to root — you need sudo. `chgrp` changes the group.'),
            H3: bi('`rwx` для группы, ничего для остальных и setgid: `2770`.', '`rwx` for the group, nothing for others, and setgid: `2770`.'),
          },
        },
        {
          id: 'shadow',
          prompt: bi('Посмотрите первую строку `/etc/shadow` — файл, который может читать только root.', 'Look at the first line of `/etc/shadow` — a file only root may read.'),
          check: { stdout: /^root:/ },
          chips: 'sudo head -n 1 /etc/shadow',
          docRef: ref('man/sudo.8', 'DESCRIPTION'),
          hints: { H1: bi('Без sudo — Permission denied. С sudo команда выполняется от root.', 'Without sudo — Permission denied. With sudo the command runs as root.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.octal', 'linux.q.dir-x', 'linux.q.umask', 'linux.q.sudo-redirect'] },
  ],
};

export const LESSONS_1: Lesson[] = [terminal, paths, files, manual, users, permissions];
