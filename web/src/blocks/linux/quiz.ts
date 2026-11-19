// The quiz bank of the Linux block (02 §8.1, 10 §2). Every distractor is a
// recorded misconception with its explanation; items are tagged with the
// concepts they check and are used only in or after the lesson that
// introduces those concepts.

import { bi } from '../../core/i18n';
import type { QuizItem } from '../../core/types';

const W = (ru: string, en: string) => bi(ru, en);

export const QUIZ: QuizItem[] = [
  // ── terminal ──
  {
    id: 'linux.q.words',
    kind: 'mcq',
    concepts: ['linux.argument'],
    prompt: W('Сколько аргументов получит `echo` в строке `echo hello     world`?', 'How many arguments does `echo` get in the line `echo hello     world`?'),
    options: [
      { id: '2', text: '2', correct: true },
      { id: '6', text: '6', why: W('Пробелы не аргументы: они только разделяют слова, сколько бы их ни было.', 'Spaces are not arguments: they only separate words, however many there are.') },
      { id: '1', text: '1', why: W('Одним аргументом фраза станет, только если взять её в кавычки.', 'The phrase becomes one argument only if you put it in quotes.') },
      { id: '3', text: '3', why: W('Имя команды — не аргумент: аргументы — слова после него.', 'The command name is not an argument: arguments are the words after it.') },
    ],
    explain: W('Оболочка делит строку на слова: `echo`, `hello`, `world`. Первое — команда, остальные два — аргументы.', 'The shell splits the line into words: `echo`, `hello`, `world`. The first is the command, the other two are arguments.'),
    refs: { lesson: 'linux.terminal' },
  },
  {
    id: 'linux.q.prompt',
    kind: 'match',
    concepts: ['linux.shell', 'linux.terminal'],
    prompt: W('Разберите приглашение `anna@web-1:/var/log$` на части.', 'Take the prompt `anna@web-1:/var/log$` apart.'),
    pairs: [
      { id: 'user', left: 'anna', right: W('пользователь', 'the user') },
      { id: 'host', left: 'web-1', right: W('имя машины', 'the machine name') },
      { id: 'dir', left: '/var/log', right: W('где вы сейчас', 'where you are now') },
      { id: 'sign', left: '$', right: W('ждёт команду, вы не администратор', 'waiting for a command, you are not the administrator') },
    ],
    explain: W('Если вместо `$` стоит `#`, вы работаете как администратор: машина выполнит что угодно.', 'If you see `#` instead of `$`, you are working as the administrator: the machine will do anything.'),
  },
  // ── paths ──
  {
    id: 'linux.q.relpath',
    kind: 'mcq',
    concepts: ['linux.abs-path'],
    prompt: W('Вы в `/var/log`. Какой путь ведёт в `/var/lib`?', 'You are in `/var/log`. Which path leads to `/var/lib`?'),
    options: [
      { id: 'up', text: '../lib', correct: true },
      { id: 'lib', text: 'lib', why: W('`lib` — каталог внутри текущего, то есть `/var/log/lib`.', '`lib` is a directory inside the current one, that is `/var/log/lib`.') },
      { id: 'root', text: '/lib', why: W('Путь с `/` в начале отсчитывается от корня: это `/lib`, совсем другой каталог.', 'A path starting with `/` is counted from the root: that is `/lib`, a different directory.') },
      { id: 'dot', text: './lib', why: W('`.` — текущий каталог; `./lib` — то же, что `lib`.', '`.` is the current directory; `./lib` is the same as `lib`.') },
    ],
    explain: W('`..` — каталог на уровень выше: из `/var/log` это `/var`, а дальше вниз в `lib`.', '`..` is the directory one level up: from `/var/log` that is `/var`, then down into `lib`.'),
  },
  {
    id: 'linux.q.abs-rel',
    kind: 'match',
    concepts: ['linux.abs-path', 'linux.home'],
    prompt: W('Сопоставьте путь и то, от чего он отсчитывается.', 'Match each path with what it is counted from.'),
    pairs: [
      { id: 'abs', left: '/etc/hosts', right: W('от корня', 'from the root') },
      { id: 'rel', left: 'notes/todo.txt', right: W('от текущего каталога', 'from the current directory') },
      { id: 'home', left: '~/notes', right: W('от домашнего каталога', 'from the home directory') },
      { id: 'up', left: '../app.log', right: W('от каталога над текущим', 'from the directory above the current one') },
    ],
  },
  // ── files ──
  {
    id: 'linux.q.mv',
    kind: 'mcq',
    concepts: ['linux.archive'],
    prompt: W('Что останется после `mv a.txt b.txt`, если `b.txt` уже был?', 'What is left after `mv a.txt b.txt` if `b.txt` already existed?'),
    options: [
      { id: 'b', text: W('Только b.txt — с содержимым бывшего a.txt', 'Only b.txt — with the contents of the former a.txt'), correct: true },
      { id: 'both', text: W('Оба файла, b.txt не тронут', 'Both files, b.txt untouched'), why: W('mv без флагов не спрашивает: существующий файл заменяется.', 'mv without flags does not ask: the existing file is replaced.') },
      { id: 'err', text: W('Ошибка: файл существует', 'An error: the file exists'), why: W('Так ведёт себя `ln` без `-f`, а `mv` молча перезаписывает. `mv -n` не перезаписал бы.', 'That is how `ln` without `-f` behaves; `mv` silently overwrites. `mv -n` would not overwrite.') },
      { id: 'trash', text: W('Старый b.txt уйдёт в корзину', 'The old b.txt goes to the trash'), why: W('Корзины нет: старое содержимое b.txt потеряно.', 'There is no trash: the old contents of b.txt are lost.') },
    ],
  },
  {
    id: 'linux.q.glob',
    kind: 'mcq',
    concepts: ['linux.glob'],
    prompt: W('Кто превращает `*.log` в список имён в команде `rm *.log`?', 'Who turns `*.log` into a list of names in the command `rm *.log`?'),
    options: [
      { id: 'shell', text: W('Оболочка, до запуска rm', 'The shell, before rm starts'), correct: true },
      { id: 'rm', text: W('Сама команда rm', 'The rm command itself'), why: W('rm получает уже готовые имена, как если бы вы их напечатали; поэтому шаблоны одинаково работают у всех команд.', 'rm receives ready names as if you had typed them; that is why patterns work the same for every command.') },
      { id: 'fs', text: W('Файловая система', 'The file system'), why: W('Файловая система хранит имена, а подбирает их по шаблону оболочка.', 'The file system stores names; matching them against a pattern is the shell’s job.') },
    ],
    explain: W('Если ни одно имя не подошло, шаблон передаётся как есть — и команда ищет файл с именем `*.log`.', 'If no name matches, the pattern is passed as it is — and the command looks for a file named `*.log`.'),
  },
  {
    id: 'linux.q.tar-c',
    kind: 'mcq',
    concepts: ['linux.archive'],
    prompt: W('Чем `tar -xzf site.tgz -C /srv/site` отличается от `cd /srv/site && tar -xzf ~/site.tgz`?', 'How does `tar -xzf site.tgz -C /srv/site` differ from `cd /srv/site && tar -xzf ~/site.tgz`?'),
    options: [
      { id: 'same', text: W('Ничем по результату: -C переходит в каталог перед распаковкой', 'No difference in the result: -C changes into the directory before extracting'), correct: true },
      { id: 'sub', text: W('-C создаёт подкаталог с именем архива', '-C creates a subdirectory named after the archive'), why: W('Подкаталоги появятся, только если они записаны в самом архиве — посмотрите `tar -t`.', 'Subdirectories appear only if they are recorded in the archive itself — look with `tar -t`.') },
      { id: 'over', text: W('-C перезаписывает каталог целиком', '-C overwrites the whole directory'), why: W('tar добавляет и заменяет файлы из архива, остальное в каталоге не трогает.', 'tar adds and replaces the files from the archive and leaves the rest of the directory alone.') },
    ],
  },
  // ── manual ──
  {
    id: 'linux.q.synopsis',
    kind: 'mcq',
    concepts: ['linux.man-page'],
    prompt: W('В SYNOPSIS написано `cp [OPTION]... SOURCE... DIRECTORY`. Можно ли скопировать два файла в каталог одной командой?', 'The SYNOPSIS says `cp [OPTION]... SOURCE... DIRECTORY`. Can you copy two files into a directory with one command?'),
    options: [
      { id: 'yes', text: W('Да: SOURCE... можно повторить', 'Yes: SOURCE... may repeat'), correct: true },
      { id: 'no', text: W('Нет: SOURCE один', 'No: there is one SOURCE'), why: W('Многоточие после слова значит «можно повторить».', 'An ellipsis after a word means “may repeat”.') },
      { id: 'flag', text: W('Только с флагом -r', 'Only with the -r flag'), why: W('-r нужен для каталогов-источников, а не для числа файлов.', '-r is needed for source directories, not for the number of files.') },
    ],
  },
  {
    id: 'linux.q.builtin',
    kind: 'mcq',
    concepts: ['linux.builtin'],
    prompt: W('Где описан `cd`?', 'Where is `cd` described?'),
    options: [
      { id: 'help', text: 'help cd', correct: true },
      { id: 'man', text: 'man 1 cd', why: W('Страница найдётся, но общая: `cd` — встроенная команда, её точное поведение в этой оболочке описывает `help`.', 'A page shows up, but a generic one: `cd` is a builtin, and its exact behaviour in this shell is described by `help`.') },
      { id: 'which', text: 'which cd', why: W('which ищет файлы программ в PATH, а встроенная команда — не файл.', 'which looks for program files in PATH, and a builtin is not a file.') },
    ],
    explain: W('`type cd` скажет «cd is a shell builtin».', '`type cd` says “cd is a shell builtin”.'),
  },
  {
    id: 'linux.q.man-sections',
    kind: 'match',
    concepts: ['linux.man-page'],
    prompt: W('Сопоставьте том руководства и что в нём.', 'Match each manual section with what it holds.'),
    pairs: [
      { id: '1', left: 'man 1', right: W('команды пользователя', 'user commands') },
      { id: '5', left: 'man 5', right: W('форматы файлов', 'file formats') },
      { id: '7', left: 'man 7', right: W('обзоры и соглашения', 'overviews and conventions') },
      { id: '8', left: 'man 8', right: W('команды администратора', 'administration commands') },
    ],
    explain: W('`man crontab` и `man 5 crontab` — разные страницы: про команду и про формат файла.', '`man crontab` and `man 5 crontab` are different pages: about the command and about the file format.'),
  },
  // ── users ──
  {
    id: 'linux.q.passwd-x',
    kind: 'mcq',
    concepts: ['linux.user'],
    prompt: W('В `/etc/passwd` строка `anna:x:1001:1001::/home/anna:/bin/bash`. Где пароль anna?', 'In `/etc/passwd` there is the line `anna:x:1001:1001::/home/anna:/bin/bash`. Where is anna’s password?'),
    options: [
      { id: 'shadow', text: W('В зашифрованном виде в /etc/shadow, который читает только root', 'Encrypted in /etc/shadow, which only root can read'), correct: true },
      { id: 'x', text: W('Пароль — x', 'The password is x'), why: W('`x` — заглушка: «пароль хранится в другом месте».', '`x` is a placeholder: “the password is kept elsewhere”.') },
      { id: 'none', text: W('Пароля нет', 'There is no password'), why: W('Пустое поле значило бы «без пароля»; здесь стоит x.', 'An empty field would mean “no password”; here it is x.') },
    ],
  },
  {
    id: 'linux.q.uid',
    kind: 'mcq',
    concepts: ['linux.user'],
    prompt: W('Пользователя переименовали с `anna` в `anya`, UID оставили. Что стало с её файлами?', 'The user was renamed from `anna` to `anya`, the UID was kept. What happened to her files?'),
    options: [
      { id: 'same', text: W('Остались её: ls покажет новое имя', 'They are still hers: ls shows the new name'), correct: true },
      { id: 'orphan', text: W('Стали ничьими', 'They belong to nobody now'), why: W('Файл хранит номер владельца, а не имя: имя ls подставляет по /etc/passwd.', 'A file stores the owner’s number, not the name: ls looks the name up in /etc/passwd.') },
      { id: 'root', text: W('Перешли к root', 'They went to root'), why: W('Владельца никто не менял: UID тот же.', 'Nobody changed the owner: the UID is the same.') },
    ],
  },
  // ── permissions ──
  {
    id: 'linux.q.octal',
    kind: 'fill-command',
    concepts: ['linux.mode'],
    prompt: W('Каким числом задать режим `rwxr-x---`?', 'Which number sets the mode `rwxr-x---`?'),
    template: 'chmod ___ report.sh',
    answers: ['chmod 750 report.sh', 'chmod 0750 report.sh'],
    misconceptions: [{ match: '^chmod 0?570', why: W('Первая цифра — владелец: rwx = 4+2+1 = 7.', 'The first digit is the owner: rwx = 4+2+1 = 7.') }, { match: '^chmod 0?755', why: W('755 даёт остальным r-x, а нужно ничего: последняя цифра 0.', '755 gives others r-x, but they must get nothing: the last digit is 0.') }],
    explain: W('r = 4, w = 2, x = 1: rwx = 7, r-x = 5, --- = 0.', 'r = 4, w = 2, x = 1: rwx = 7, r-x = 5, --- = 0.'),
  },
  {
    id: 'linux.q.dir-x',
    kind: 'multi',
    concepts: ['linux.mode'],
    prompt: W('Каталог `drwxr-xr--`. Что получится у пользователя из «остальных»? Отметьте всё верное.', 'A directory `drwxr-xr--`. What can a user from “others” do? Mark everything that is true.'),
    options: [
      { id: 'ls', text: W('`ls dir` покажет имена', '`ls dir` shows the names'), correct: true },
      { id: 'cd', text: W('`cd dir` получится', '`cd dir` works'), why: W('Для входа нужен x, а у остальных только r.', 'Entering needs x, and others have only r.') },
      { id: 'cat', text: W('`cat dir/file` прочитает файл, если сам файл читаемый', '`cat dir/file` reads the file if the file itself is readable'), why: W('До файла не дойти: проход через каталог требует x.', 'You cannot reach the file: passing through the directory needs x.') },
      { id: 'rm', text: W('`rm dir/file` удалит файл', '`rm dir/file` deletes the file'), why: W('Удаление — это изменение каталога: нужны w и x.', 'Deleting changes the directory: it needs w and x.') },
    ],
  },
  {
    id: 'linux.q.umask',
    kind: 'mcq',
    concepts: ['linux.mode'],
    prompt: W('Какой режим получит новый файл при `umask 027`?', 'Which mode does a new file get with `umask 027`?'),
    options: [
      { id: '640', text: '640', correct: true },
      { id: '750', text: '750', why: W('750 получит новый каталог (777 − 027); у файла исходно нет x: 666 − 027 = 640.', '750 is what a new directory gets (777 − 027); a file starts without x: 666 − 027 = 640.') },
      { id: '027', text: '027', why: W('umask — то, что убирается, а не то, что остаётся.', 'The umask is what is taken away, not what remains.') },
    ],
  },
  {
    id: 'linux.q.sudo-redirect',
    kind: 'bugfind',
    concepts: ['linux.sudo', 'linux.root'],
    prompt: W('Вторая строка падает с `Permission denied`, хотя есть sudo. Почему?', 'The second line fails with `Permission denied` even though sudo is there. Why?'),
    code: 'sudo mkdir -p /etc/app\nsudo echo "listen 8080" > /etc/app/app.conf\necho "workers 4" | sudo tee -a /etc/app/app.conf',
    bug: [2],
    why: {
      1: W('Здесь всё делает mkdir от root — верно.', 'Here mkdir does the work as root — fine.'),
      2: W('`>` выполняет ваша оболочка, от вашего имени, до запуска sudo: от root работает только echo.', '`>` is done by your shell, as you, before sudo starts: only echo runs as root.'),
      3: W('Правильный приём: файл открывает tee, запущенный от root.', 'The right trick: the file is opened by tee, which runs as root.'),
    },
  },
  // ── streams ──
  {
    id: 'linux.q.redirect-order',
    kind: 'mcq',
    concepts: ['linux.redirect', 'linux.stream'],
    prompt: W('Чем отличаются `cmd > out 2>&1` и `cmd 2>&1 > out`?', 'How do `cmd > out 2>&1` and `cmd 2>&1 > out` differ?'),
    options: [
      { id: 'right', text: W('В первом оба потока в файле, во втором ошибки на экране', 'In the first both streams go to the file, in the second the errors stay on screen'), correct: true },
      { id: 'same', text: W('Ничем', 'No difference'), why: W('Перенаправления выполняются по порядку: 2>&1 копирует то, куда поток 1 смотрит в этот момент.', 'Redirections run in order: 2>&1 copies where stream 1 points at that moment.') },
      { id: 'reverse', text: W('Наоборот: во втором оба в файле', 'The other way round: in the second both go to the file'), why: W('Во втором поток 2 скопировал направление на терминал, и только потом поток 1 ушёл в файл.', 'In the second stream 2 copied the direction to the terminal, and only then did stream 1 go to the file.') },
    ],
  },
  {
    id: 'linux.q.uniq',
    kind: 'predict-output',
    concepts: ['linux.pipe'],
    prompt: W('Что напечатает эта строка?', 'What does this line print?'),
    command: "printf 'b\\na\\nb\\n' | uniq | wc -l",
    options: [
      { id: '3', text: '3', correct: true },
      { id: '2', text: '2', why: W('uniq убирает только соседние повторы, а два b не рядом.', 'uniq removes only adjacent repeats, and the two b are not next to each other.') },
      { id: '1', text: '1', why: W('Три строки: b, a, b — ни одна не удалена.', 'Three lines: b, a, b — none was removed.') },
    ],
    explain: W('Поэтому перед `uniq` почти всегда ставят `sort`.', 'That is why `sort` almost always comes before `uniq`.'),
  },
  {
    id: 'linux.q.regex',
    kind: 'match',
    concepts: ['linux.regex'],
    prompt: W('Сопоставьте регулярное выражение и строки, которые оно найдёт.', 'Match each regular expression with the lines it finds.'),
    pairs: [
      { id: 'start', left: '^ERROR', right: W('строки, которые начинаются с ERROR', 'lines that start with ERROR') },
      { id: 'end', left: '500$', right: W('строки, которые кончаются на 500', 'lines that end with 500') },
      { id: 'digit', left: '[0-9][0-9]*', right: W('строки, где есть хотя бы одна цифра', 'lines that contain at least one digit') },
      { id: 'dot', left: 'a.c', right: W('a, любой символ, c: abc, a-c, a c', 'a, any character, c: abc, a-c, a c') },
    ],
  },
  {
    id: 'linux.q.pipe-bug',
    kind: 'bugfind',
    concepts: ['linux.pipe', 'linux.redirect'],
    prompt: W('Скрипт должен показать строки с error из журнала, но не показывает ничего. Где ошибка?', 'The commands should show the lines with error from a log but show nothing. Where is the bug?'),
    code: 'cd /var/log/app\ncat app.log > grep error\necho done',
    bug: [2],
    why: {
      1: W('Переход в каталог — верно.', 'Changing into the directory — fine.'),
      2: W('`>` вместо `|`: вывод cat ушёл в файл с именем grep, а error стал вторым файлом для cat.', '`>` instead of `|`: cat’s output went into a file named grep, and error became a second file for cat.'),
      3: W('Строка верная.', 'This line is fine.'),
    },
  },
  // ── env ──
  {
    id: 'linux.q.export',
    kind: 'mcq',
    concepts: ['linux.env', 'linux.variable'],
    prompt: W("Почему `VAR=1; bash -c 'echo $VAR'` печатает пустую строку?", "Why does `VAR=1; bash -c 'echo $VAR'` print an empty line?"),
    options: [
      { id: 'export', text: W('Переменная не экспортирована: запущенная программа её не получает', 'The variable is not exported: the started program does not get it'), correct: true },
      { id: 'quotes', text: W('Одинарные кавычки запрещают подстановку', 'Single quotes forbid substitution'), why: W('Кавычки здесь как раз нужны: они не дают вашей оболочке подставить VAR, и подставлять будет новая — у которой VAR нет.', 'The quotes are needed here: they keep your shell from substituting VAR, so the new shell does it — and it has no VAR.') },
      { id: 'semicolon', text: W('`;` сбрасывает переменные', '`;` resets variables'), why: W('Переменная жива: `echo $VAR` в вашей оболочке напечатает 1.', 'The variable is alive: `echo $VAR` in your shell prints 1.') },
    ],
  },
  {
    id: 'linux.q.path-replace',
    kind: 'mcq',
    concepts: ['linux.path-var'],
    prompt: W('После `export PATH=/opt/tools/bin` команда `ls` пишет `command not found`. Почему?', 'After `export PATH=/opt/tools/bin` the `ls` command says `command not found`. Why?'),
    options: [
      { id: 'replaced', text: W('Список каталогов заменён целиком, /usr/bin выпал', 'The list of directories was replaced as a whole; /usr/bin dropped out'), correct: true },
      { id: 'deleted', text: W('ls удалён', 'ls was deleted'), why: W('Файл /usr/bin/ls на месте: `/usr/bin/ls` по полному пути работает.', 'The file /usr/bin/ls is there: `/usr/bin/ls` by its full path works.') },
      { id: 'restart', text: W('Нужно перезагрузить машину', 'The machine must be rebooted'), why: W('PATH действует сразу и только в этой оболочке.', 'PATH takes effect at once and only in this shell.') },
    ],
    explain: W('Добавлять каталог нужно так: `PATH="/opt/tools/bin:$PATH"`.', 'Add a directory like this: `PATH="/opt/tools/bin:$PATH"`.'),
  },
  {
    id: 'linux.q.quotes',
    kind: 'predict-output',
    concepts: ['linux.variable'],
    prompt: W('Что напечатает последняя команда?', 'What does the last command print?'),
    command: "CITY=Almaty; echo \"$CITY\" '$CITY'",
    options: [
      { id: 'mixed', text: 'Almaty $CITY', correct: true },
      { id: 'both', text: 'Almaty Almaty', why: W('В одинарных кавычках ничего не подставляется.', 'Nothing is substituted inside single quotes.') },
      { id: 'none', text: '$CITY $CITY', why: W('В двойных кавычках переменные подставляются.', 'Inside double quotes variables are substituted.') },
    ],
  },
  // ── processes ──
  {
    id: 'linux.q.signals',
    kind: 'match',
    concepts: ['linux.signal'],
    prompt: W('Сопоставьте сигнал и то, что с ним происходит.', 'Match each signal with what happens with it.'),
    pairs: [
      { id: 'term', left: 'TERM (kill PID)', right: W('просьба завершиться; процесс может поймать и проигнорировать', 'a request to finish; the process may catch and ignore it') },
      { id: 'kill', left: 'KILL (kill -9)', right: W('завершает ядро; поймать нельзя', 'the kernel ends the process; it cannot be caught') },
      { id: 'int', left: 'INT (Ctrl+C)', right: W('прерывание с клавиатуры', 'an interrupt from the keyboard') },
      { id: 'tstp', left: 'TSTP (Ctrl+Z)', right: W('остановить; процесс в состоянии T, fg продолжит', 'stop; the process is in state T, fg resumes it') },
    ],
  },
  {
    id: 'linux.q.zombie',
    kind: 'mcq',
    concepts: ['linux.process', 'linux.exit-code'],
    prompt: W('Процесс в состоянии `Z`. Какой сигнал его уберёт?', 'A process is in state `Z`. Which signal removes it?'),
    options: [
      { id: 'none', text: W('Никакой: родитель должен забрать код завершения или сам завершиться', 'None: the parent must collect the exit code or end itself'), correct: true },
      { id: 'kill', text: 'kill -9', why: W('Зомби уже завершился — убивать нечего, осталась только запись с кодом.', 'A zombie has already ended — there is nothing to kill, only a record with the code.') },
      { id: 'term', text: 'kill -TERM', why: W('Сигналы доставляются работающим процессам, а этот не работает.', 'Signals are delivered to running processes, and this one is not running.') },
    ],
  },
  {
    id: 'linux.q.fork-order',
    kind: 'order',
    concepts: ['linux.fork-exec'],
    prompt: W('Расставьте по порядку, что происходит после Enter в строке `ls > list.txt`.', 'Put in order what happens after Enter in the line `ls > list.txt`.'),
    steps: [
      { id: 'words', text: W('Оболочка делит строку на слова', 'The shell splits the line into words') },
      { id: 'path', text: W('Оболочка находит /usr/bin/ls по PATH', 'The shell finds /usr/bin/ls in PATH') },
      { id: 'fork', text: W('fork: копия оболочки', 'fork: a copy of the shell') },
      { id: 'redir', text: W('Копия открывает list.txt вместо вывода на экран', 'The copy opens list.txt instead of the screen'), why: W('Перенаправление делается до exec, иначе программа уже писала бы на экран.', 'The redirection is done before exec; otherwise the program would already be writing to the screen.') },
      { id: 'exec', text: W('exec: копия становится ls', 'exec: the copy becomes ls') },
      { id: 'wait', text: W('Оболочка ждёт и кладёт код в $?', 'The shell waits and puts the code into $?') },
    ],
  },
  {
    id: 'linux.q.exit-128',
    kind: 'mcq',
    concepts: ['linux.exit-code', 'linux.signal'],
    prompt: W('Служба завершилась с кодом 137. Что это значит?', 'A program ended with code 137. What does that mean?'),
    options: [
      { id: 'kill', text: W('Её убили сигналом 9, KILL: 128 + 9', 'It was killed by signal 9, KILL: 128 + 9'), correct: true },
      { id: 'own', text: W('Программа сама выбрала код 137', 'The program chose code 137 itself'), why: W('Может и так, но коды выше 128 по соглашению значат «убит сигналом N − 128».', 'It might, but codes above 128 by convention mean “killed by signal N − 128”.') },
      { id: 'notfound', text: W('Команда не найдена', 'Command not found'), why: W('Это 127.', 'That is 127.') },
    ],
  },
  {
    id: 'linux.q.pipe-label',
    kind: 'label',
    concepts: ['linux.pipe', 'linux.kernel'],
    prompt: W('Подпишите части конвейера `ls | grep conf`.', 'Label the parts of the pipeline `ls | grep conf`.'),
    diagram: {
      width: 600,
      height: 140,
      slots: [
        { id: 's1', x: 20, y: 40, w: 150, h: 56, answer: 'writer', family: 'process' },
        { id: 's2', x: 225, y: 40, w: 150, h: 56, answer: 'pipe', family: 'kernel' },
        { id: 's3', x: 430, y: 40, w: 150, h: 56, answer: 'reader', family: 'process' },
      ],
      edges: [
        { from: 's1', to: 's2' },
        { from: 's2', to: 's3' },
      ],
    },
    labels: [
      { id: 'writer', text: W('процесс ls: пишет в поток 1', 'the ls process: writes to stream 1') },
      { id: 'pipe', text: W('буфер в памяти ядра', 'a buffer in kernel memory') },
      { id: 'reader', text: W('процесс grep: читает поток 0', 'the grep process: reads stream 0') },
      { id: 'file', text: W('временный файл на диске', 'a temporary file on disk'), why: W('Между командами нет файла: только буфер ядра, поэтому конвейер работает и на заполненном диске.', 'There is no file between the commands: only a kernel buffer, which is why a pipeline works even on a full disk.') },
    ],
  },
  // ── scripts ──
  {
    id: 'linux.q.args',
    kind: 'mcq',
    concepts: ['linux.script'],
    prompt: W('Скрипт запустили как `./s.sh "a b" c`. Чему равно `$#`?', 'The script was run as `./s.sh "a b" c`. What is `$#`?'),
    options: [
      { id: '2', text: '2', correct: true },
      { id: '3', text: '3', why: W('Кавычки сделали `a b` одним аргументом.', 'The quotes made `a b` a single argument.') },
      { id: '1', text: '1', why: W('Аргументов два: «a b» и «c».', 'There are two arguments: “a b” and “c”.') },
    ],
    explain: W('`"$@"` передаст их дальше так же — двумя словами; `$*` без кавычек развалил бы первое на два.', '`"$@"` passes them on the same way — as two words; `$*` without quotes would split the first into two.'),
  },
  {
    id: 'linux.q.test-spaces',
    kind: 'bugfind',
    concepts: ['linux.script'],
    prompt: W('Скрипт пишет `[-f: command not found`. Какая строка виновата?', 'The script says `[-f: command not found`. Which line is to blame?'),
    code: '#!/bin/bash\nf=/etc/app.conf\nif [-f "$f"]; then\n  echo found\nfi',
    bug: [3],
    why: {
      1: W('Shebang верный.', 'The shebang is right.'),
      2: W('Присваивание без пробелов вокруг = — верно.', 'An assignment without spaces around = — correct.'),
      3: W('`[` — команда, ей нужны пробелы: `[ -f "$f" ]`. Иначе оболочка ищет программу `[-f`.', '`[` is a command and needs spaces: `[ -f "$f" ]`. Otherwise the shell looks for a program called `[-f`.'),
      4: W('Ветка верная.', 'The branch is fine.'),
    },
  },
  {
    id: 'linux.q.script-bug',
    kind: 'bugfind',
    concepts: ['linux.shebang', 'linux.script'],
    prompt: W('`./deploy.sh` отвечает `bad interpreter: No such file or directory`. Где ошибка?', '`./deploy.sh` answers `bad interpreter: No such file or directory`. Where is the bug?'),
    code: '#!/bin/bsh\nset -e\necho deploying',
    bug: [1],
    why: {
      1: W('Опечатка в shebang: ядро ищет программу /bin/bsh, а её нет.', 'A typo in the shebang: the kernel looks for the program /bin/bsh, which does not exist.'),
      2: W('`set -e` верен и полезен.', '`set -e` is right and useful.'),
      3: W('Обычная команда.', 'An ordinary command.'),
    },
  },
  {
    id: 'linux.q.pipefail',
    kind: 'mcq',
    concepts: ['linux.script', 'linux.exit-code'],
    prompt: W('В скрипте `set -euo pipefail`, затем `grep foo missing.txt | wc -l`. Что будет?', 'A script has `set -euo pipefail`, then `grep foo missing.txt | wc -l`. What happens?'),
    options: [
      { id: 'stop', text: W('Код конвейера 2 (из-за pipefail), и -e остановит скрипт', 'The pipeline’s code is 2 (because of pipefail), and -e stops the script'), correct: true },
      { id: 'zero', text: W('wc напечатает 0, скрипт пойдёт дальше', 'wc prints 0 and the script goes on'), why: W('Так было бы без pipefail: код конвейера — код последней команды, wc, то есть 0.', 'That would be without pipefail: the pipeline’s code is the last command’s, wc’s, that is 0.') },
      { id: 'u', text: W('Ошибка из-за -u', 'An error because of -u'), why: W('-u — про незаданные переменные, здесь их нет.', '-u is about unset variables, and there are none here.') },
    ],
  },
  // ── packages ──
  {
    id: 'linux.q.apt-update',
    kind: 'mcq',
    concepts: ['linux.repo', 'linux.package'],
    prompt: W('На свежей машине `sudo apt install nginx` пишет `Unable to locate package nginx`. Почему?', 'On a fresh machine `sudo apt install nginx` says `Unable to locate package nginx`. Why?'),
    options: [
      { id: 'update', text: W('Список пакетов ещё не скачан: нужен apt update', 'The package list has not been downloaded yet: apt update is needed'), correct: true },
      { id: 'name', text: W('Пакет называется иначе', 'The package has another name'), why: W('nginx называется nginx; машина просто не знает ни одного пакета.', 'nginx is called nginx; the machine just does not know any package yet.') },
      { id: 'sudo', text: W('Не хватает прав', 'Not enough rights'), why: W('С правами была бы ошибка про lock-файл, а не «пакет не найден».', 'A permission problem would be an error about the lock file, not “package not found”.') },
    ],
  },
  {
    id: 'linux.q.dpkg-S',
    kind: 'fill-command',
    concepts: ['linux.package'],
    prompt: W('Узнайте, какому пакету принадлежит файл `/usr/bin/tree`.', 'Find out which package the file `/usr/bin/tree` belongs to.'),
    template: 'dpkg ___ /usr/bin/tree',
    check: { stdout: /^tree: \/usr\/bin\/tree/ },
    misconceptions: [{ match: '-L', why: W('-L — наоборот: файлы пакета. Владельца файла ищет -S.', '-L is the other way round: the files of a package. -S finds a file’s owner.') }],
  },
  // ── services ──
  {
    id: 'linux.q.enable',
    kind: 'multi',
    concepts: ['linux.systemd', 'linux.unit'],
    prompt: W('Что делает `systemctl enable web`? Отметьте всё верное.', 'What does `systemctl enable web` do? Mark everything that is true.'),
    options: [
      { id: 'boot', text: W('Служба будет запускаться при загрузке', 'The service will start at boot'), correct: true },
      { id: 'link', text: W('Создаёт ссылку в multi-user.target.wants/', 'It creates a link in multi-user.target.wants/'), correct: true },
      { id: 'now', text: W('Запускает службу сейчас', 'It starts the service now'), why: W('Сейчас — только с `--now` или отдельным `start`.', 'Now — only with `--now` or a separate `start`.') },
      { id: 'reload', text: W('Перечитывает unit-файл', 'It re-reads the unit file'), why: W('Перечитывает `daemon-reload`.', '`daemon-reload` does that.') },
    ],
  },
  {
    id: 'linux.q.journal-echo',
    kind: 'mcq',
    concepts: ['linux.journal', 'linux.daemon'],
    prompt: W('Служба печатает строку командой `echo`. Где её искать?', 'A service prints a line with `echo`. Where do you look for it?'),
    options: [
      { id: 'journal', text: W('В журнале: journalctl -u <служба>', 'In the journal: journalctl -u <service>'), correct: true },
      { id: 'tty', text: W('В терминале, откуда запускали systemctl start', 'In the terminal you ran systemctl start from'), why: W('У службы нет терминала: её вывод собирает systemd.', 'A service has no terminal: systemd collects its output.') },
      { id: 'lost', text: W('Нигде: вывод служб теряется', 'Nowhere: services’ output is lost'), why: W('По умолчанию StandardOutput=journal — всё попадает в журнал.', 'By default StandardOutput=journal — everything goes into the journal.') },
    ],
  },
  {
    id: 'linux.q.cron-when',
    kind: 'mcq',
    concepts: ['linux.cron'],
    prompt: W('Когда выполнится строка crontab `*/15 9-18 * * 1-5 /usr/local/bin/check`?', 'When does the crontab line `*/15 9-18 * * 1-5 /usr/local/bin/check` run?'),
    options: [
      { id: 'right', text: W('Каждые 15 минут с 9:00 до 18:45 в будни', 'Every 15 minutes from 9:00 to 18:45 on weekdays'), correct: true },
      { id: 'once', text: W('Один раз в 9:15', 'Once at 9:15'), why: W('`*/15` в поле минут — каждые 15 минут, а не «в 15 минут».', '`*/15` in the minute field is every 15 minutes, not “at minute 15”.') },
      { id: 'days', text: W('Каждый день с 1 по 5 число месяца', 'Every day from the 1st to the 5th of the month'), why: W('1-5 стоит в пятом поле — это дни недели, понедельник–пятница.', '1-5 is in the fifth field — days of the week, Monday to Friday.') },
    ],
  },
  {
    id: 'linux.q.unit-bug',
    kind: 'bugfind',
    concepts: ['linux.unit'],
    prompt: W('Служба падает, в журнале: `python3: can\'t open file \'/app.py\': [Errno 2] No such file or directory`. Какая строка виновата?', 'The service dies; the journal says: `python3: can\'t open file \'/app.py\': [Errno 2] No such file or directory`. Which line is to blame?'),
    code: '[Unit]\nDescription=Orders API\n\n[Service]\nExecStart=/usr/bin/python3 app.py\nUser=orders\n\n[Install]\nWantedBy=multi-user.target',
    lang: 'ini',
    bug: [5],
    why: {
      2: W('Описание ни на что не влияет.', 'The description affects nothing.'),
      5: W('Относительный путь: systemd запускает службу из `/`, а не из каталога приложения. Нужен полный путь к app.py или WorkingDirectory=.', 'A relative path: systemd starts the service in `/`, not in the app’s directory. You need the full path to app.py, or WorkingDirectory=.'),
      6: W('Пользователь верный — ошибка не про права.', 'The user is fine — the error is not about permissions.'),
      9: W('WantedBy отвечает за запуск при загрузке, а не за путь.', 'WantedBy is about starting at boot, not about the path.'),
    },
  },
  {
    id: 'linux.q.restart-abnormal',
    kind: 'mcq',
    concepts: ['linux.systemd'],
    prompt: W('У службы `Restart=on-abnormal`. Программа выходит с кодом 1. Перезапустит ли systemd?', 'A service has `Restart=on-abnormal`. The program exits with code 1. Will systemd restart it?'),
    options: [
      { id: 'no', text: W('Нет: для on-abnormal выход с кодом — обычное завершение', 'No: for on-abnormal an exit with a code is an ordinary end'), correct: true },
      { id: 'yes', text: W('Да: код не 0 — значит сбой', 'Yes: a non-zero code means a failure'), why: W('Так поступил бы on-failure. on-abnormal реагирует только на сигналы, таймауты и watchdog.', 'That is on-failure. on-abnormal reacts only to signals, timeouts and the watchdog.') },
    ],
    refs: { explainer: 'linux.restart' },
  },
  // ── disks ──
  {
    id: 'linux.q.uuid',
    kind: 'mcq',
    concepts: ['linux.mount', 'linux.block-device'],
    prompt: W('Почему в `/etc/fstab` лучше `UUID=…`, а не `/dev/sdb1`?', 'Why is `UUID=…` better than `/dev/sdb1` in `/etc/fstab`?'),
    options: [
      { id: 'names', text: W('Имена устройств меняются при подключении другого диска; UUID принадлежит файловой системе', 'Device names change when another disk is attached; the UUID belongs to the file system'), correct: true },
      { id: 'faster', text: W('Так быстрее монтируется', 'It mounts faster'), why: W('Скорость та же; дело в надёжности.', 'The speed is the same; it is about reliability.') },
      { id: 'required', text: W('Имена устройств fstab не понимает', 'fstab does not understand device names'), why: W('Понимает, но имя может однажды указать на другой диск.', 'It does, but one day the name may point to another disk.') },
    ],
  },
  {
    id: 'linux.q.mount-hide',
    kind: 'mcq',
    concepts: ['linux.mount'],
    prompt: W('В `/data` лежали файлы, потом туда смонтировали новый диск. Где старые файлы?', '`/data` had files, then a new disk was mounted there. Where are the old files?'),
    options: [
      { id: 'hidden', text: W('Скрыты под новой файловой системой; после umount снова видны', 'Hidden under the new file system; visible again after umount'), correct: true },
      { id: 'deleted', text: W('Удалены', 'Deleted'), why: W('Монтирование ничего не удаляет, оно перекрывает.', 'Mounting deletes nothing; it covers.') },
      { id: 'moved', text: W('Перенесены на новый диск', 'Moved to the new disk'), why: W('Никто их не копирует: новый диск пустой.', 'Nobody copies them: the new disk is empty.') },
    ],
  },
  {
    id: 'linux.q.df-du',
    kind: 'mcq',
    concepts: ['linux.inode'],
    prompt: W('`df -h` показывает `/` на 100%, а `du -sh /*` в сумме намного меньше. В чём дело чаще всего?', '`df -h` shows `/` at 100%, while `du -sh /*` adds up to much less. What is usually the cause?'),
    options: [
      { id: 'open', text: W('Удалённый файл ещё открыт каким-то процессом', 'A deleted file is still held open by some process'), correct: true },
      { id: 'bug', text: W('df ошибается', 'df is wrong'), why: W('df считает занятые блоки, du — имена; удалённый открытый файл имени не имеет, а блоки занимает.', 'df counts used blocks, du counts names; a deleted open file has no name but still uses blocks.') },
      { id: 'hidden', text: W('Скрытые файлы с точкой', 'Hidden dot files'), why: W('du их считает: он обходит все имена, в том числе с точкой.', 'du counts them: it walks every name, dot files included.') },
    ],
    explain: W('Найти виновника помогает `lsof +L1`; освобождает место перезапуск процесса.', '`lsof +L1` finds the culprit; restarting the process frees the space.'),
  },
  {
    id: 'linux.q.links',
    kind: 'match',
    concepts: ['linux.inode'],
    prompt: W('Удалили исходный файл `a`. Что стало со ссылками на него?', 'The original file `a` was deleted. What happened to the links to it?'),
    pairs: [
      { id: 'hard', left: W('жёсткая ссылка b', 'hard link b'), right: W('работает: это второе имя того же inode', 'works: it is a second name of the same inode') },
      { id: 'soft', left: W('символическая ссылка c', 'symbolic link c'), right: W('ведёт в никуда: в ней записан путь к a', 'leads nowhere: it holds the path to a') },
    ],
  },
  // ── threads ──
  {
    id: 'linux.q.thread-task',
    kind: 'mcq',
    concepts: ['linux.thread', 'linux.procfs'],
    prompt: W('В `/proc/4120/task/` семь каталогов. Сколько потоков у процесса 4120?', '`/proc/4120/task/` has seven directories. How many threads does process 4120 have?'),
    options: [
      { id: '7', text: W('Семь, включая главный', 'Seven, the main one included'), correct: true },
      { id: '6', text: W('Шесть: главный не считается', 'Six: the main one does not count'), why: W('Главный поток — тоже поток, у него каталог с номером самого процесса.', 'The main thread is a thread too; its directory has the number of the process itself.') },
      { id: '1', text: W('Один процесс — один поток', 'One process — one thread'), why: W('Процесс может держать много потоков: они делят его память.', 'A process can hold many threads: they share its memory.') },
    ],
  },
  {
    id: 'linux.q.ps-proc',
    kind: 'mcq',
    concepts: ['linux.procfs'],
    prompt: W('Откуда `ps` берёт список процессов?', 'Where does `ps` get the list of processes from?'),
    options: [
      { id: 'proc', text: W('Из /proc', 'From /proc'), correct: true },
      { id: 'log', text: W('Из журнала systemd', 'From the systemd journal'), why: W('Журнал хранит сообщения, а не текущие процессы.', 'The journal keeps messages, not the current processes.') },
      { id: 'file', text: W('Из файла /var/run/processes', 'From the file /var/run/processes'), why: W('Такого файла нет: каталоги процессов в /proc ядро создаёт на лету.', 'There is no such file: the kernel makes the process directories in /proc on the fly.') },
    ],
  },
  // ── namespaces ──
  {
    id: 'linux.q.ns-number',
    kind: 'mcq',
    concepts: ['linux.namespace'],
    prompt: W('`readlink /proc/412/ns/pid` даёт `pid:[4026532201]`, а `readlink /proc/1/ns/pid` — `pid:[4026531836]`. О чём это говорит?', '`readlink /proc/412/ns/pid` gives `pid:[4026532201]`, and `readlink /proc/1/ns/pid` gives `pid:[4026531836]`. What does it tell you?'),
    options: [
      { id: 'other', text: W('Процесс 412 в другом пространстве имён PID', 'Process 412 is in another PID namespace'), correct: true },
      { id: 'pid', text: W('Это номера процессов внутри', 'These are process numbers inside'), why: W('Число в скобках — номер самого пространства (inode), а не процесса.', 'The number in brackets is the number of the namespace itself (an inode), not of a process.') },
      { id: 'nothing', text: W('Ничего: номера всегда разные', 'Nothing: the numbers always differ'), why: W('У процессов одного пространства номер одинаковый.', 'Processes in the same namespace have the same number.') },
    ],
  },
  {
    id: 'linux.q.mount-proc',
    kind: 'mcq',
    concepts: ['linux.namespace', 'linux.procfs'],
    prompt: W('Почему `ps` после `sudo unshare --pid --fork bash` (без `--mount-proc`) показывает все процессы машины?', 'Why does `ps` after `sudo unshare --pid --fork bash` (without `--mount-proc`) show every process of the machine?'),
    options: [
      { id: 'proc', text: W('ps читает /proc, а смонтирован прежний /proc машины', 'ps reads /proc, and the machine’s old /proc is still mounted'), correct: true },
      { id: 'broken', text: W('Пространство не создалось', 'The namespace was not created'), why: W('Создалось: `echo $$` внутри напечатает 1.', 'It was: `echo $$` inside prints 1.') },
      { id: 'root', text: W('root видит всё', 'root sees everything'), why: W('Видимость процессов — свойство пространства, а не прав.', 'Which processes are visible is a property of the namespace, not of rights.') },
    ],
  },
  {
    id: 'linux.q.pid1-term',
    kind: 'mcq',
    concepts: ['linux.pid1', 'linux.signal'],
    prompt: W('`sleep 1000` стал PID 1 в новом пространстве PID. Почему `kill -TERM` с хоста его не останавливает, а `kill -KILL` останавливает?', '`sleep 1000` became PID 1 in a new PID namespace. Why does `kill -TERM` from the host not stop it, while `kill -KILL` does?'),
    options: [
      { id: 'right', text: W('Первому процессу пространства доставляются только сигналы с обработчиком, а KILL и STOP от предков — принудительно', 'The first process of a namespace gets only the signals it has a handler for, and KILL and STOP from ancestors are forced'), correct: true },
      { id: 'root', text: W('У sleep права root', 'sleep has root rights'), why: W('Права здесь ни при чём: дело в особых правилах для PID 1.', 'Rights have nothing to do with it: it is the special rules for PID 1.') },
      { id: 'busy', text: W('sleep занят и не слышит', 'sleep is busy and does not hear'), why: W('Занятость процесса на доставку сигнала не влияет.', 'Being busy does not affect signal delivery.') },
    ],
    explain: W('Поэтому в роли первого процесса запускают маленькие программы-посредники, которые умеют передавать TERM дальше.', 'That is why small go-between programs that forward TERM are run as the first process.'),
  },
  // ── cgroups ──
  {
    id: 'linux.q.oom-events',
    kind: 'mcq',
    concepts: ['linux.cgroup', 'linux.oom'],
    prompt: W('В `memory.events` группы строка `oom_kill 3`. Что произошло?', 'A group’s `memory.events` has the line `oom_kill 3`. What happened?'),
    options: [
      { id: 'right', text: W('Ядро трижды убивало процесс группы, когда она упиралась в memory.max', 'The kernel killed a process of the group three times when it hit memory.max'), correct: true },
      { id: 'limit', text: W('Лимит памяти — 3', 'The memory limit is 3'), why: W('Лимит — в memory.max; events — счётчики событий.', 'The limit is in memory.max; events are counters of events.') },
      { id: 'machine', text: W('Машине трижды не хватило памяти', 'The machine ran out of memory three times'), why: W('Это счётчик группы: остальная машина могла и не заметить.', 'It is the group’s counter: the rest of the machine may not have noticed.') },
    ],
  },
  {
    id: 'linux.q.oom-137',
    kind: 'predict-output',
    concepts: ['linux.oom', 'linux.cgroup'],
    prompt: W('Оболочка — в группе с `memory.max = 16M`. Что выведет `echo $?` после `memhog 64`?', 'The shell is in a group with `memory.max = 16M`. What does `echo $?` print after `memhog 64`?'),
    setup: { script: ['mkdir /sys/fs/cgroup/q', 'echo 16M > /sys/fs/cgroup/q/memory.max'] },
    command: 'echo $$ | sudo tee /sys/fs/cgroup/q/cgroup.procs > /dev/null; memhog 64 > /dev/null 2>&1; echo $?',
    options: [
      { id: '137', text: '137', correct: true },
      { id: '1', text: '1', why: W('memhog не завершился сам: его убили сигналом KILL, а это 128 + 9.', 'memhog did not exit by itself: it was killed with KILL, which is 128 + 9.') },
      { id: '0', text: '0', why: W('64 МиБ не помещаются в 16: ядро не даст столько памяти.', '64 MiB do not fit into 16: the kernel will not give that much memory.') },
    ],
  },
  {
    id: 'linux.q.cpu-max',
    kind: 'mcq',
    concepts: ['linux.cgroup'],
    prompt: W('Что значит `cpu.max = 50000 100000`?', 'What does `cpu.max = 50000 100000` mean?'),
    options: [
      { id: 'half', text: W('Группе — 50 мс процессора из каждых 100 мс, то есть половина', 'The group gets 50 ms of CPU out of every 100 ms, that is half'), correct: true },
      { id: 'kill', text: W('Процесс убьют, если он займёт больше половины', 'The process is killed if it takes more than half'), why: W('Лимит процессора не убивает, а притормаживает.', 'A CPU limit does not kill; it slows down.') },
      { id: 'mhz', text: W('Частота процессора — 50 МГц', 'The CPU runs at 50 MHz'), why: W('Числа — микросекунды квоты и периода, а не частота.', 'The numbers are microseconds of quota and period, not a frequency.') },
    ],
  },
  {
    id: 'linux.q.global-oom',
    kind: 'mcq',
    concepts: ['linux.oom'],
    prompt: W('Лимитов нет, отчёт съел всю память машины. Кого убьёт ядро?', 'There are no limits, and a report ate all of the machine’s memory. Whom does the kernel kill?'),
    options: [
      { id: 'biggest', text: W('Самый большой процесс машины — это может быть и база данных', 'The biggest process of the machine — which may well be the database'), correct: true },
      { id: 'culprit', text: W('Обязательно отчёт', 'The report, of course'), why: W('Ядро не знает, кто виноват: оно выбирает по размеру.', 'The kernel does not know who is at fault: it chooses by size.') },
      { id: 'newest', text: W('Самый новый процесс', 'The newest process'), why: W('Возраст не важен, важен размер.', 'Age does not matter; size does.') },
    ],
  },
  // ── capabilities ──
  {
    id: 'linux.q.dac',
    kind: 'mcq',
    concepts: ['linux.capability'],
    prompt: W('Почему root читает чужой файл с режимом `600`?', 'Why can root read someone else’s file with mode `600`?'),
    options: [
      { id: 'cap', text: W('У процесса root есть CAP_DAC_OVERRIDE и CAP_DAC_READ_SEARCH: проверка прав пропускается', 'The root process has CAP_DAC_OVERRIDE and CAP_DAC_READ_SEARCH: the permission check is skipped'), correct: true },
      { id: 'owner', text: W('root владеет всеми файлами', 'root owns every file'), why: W('Владелец этого файла — другой пользователь; root пропускает проверку, а не становится владельцем.', 'The file’s owner is another user; root skips the check rather than becoming the owner.') },
      { id: 'group', text: W('root состоит во всех группах', 'root is in every group'), why: W('Группы здесь ни при чём.', 'Groups have nothing to do with it.') },
    ],
  },
  {
    id: 'linux.q.seccomp',
    kind: 'mcq',
    concepts: ['linux.seccomp'],
    prompt: W('В `/proc/PID/status` строка `Seccomp: 2`. Что это значит?', '`/proc/PID/status` has the line `Seccomp: 2`. What does it mean?'),
    options: [
      { id: 'filter', text: W('Процесс работает с фильтром системных вызовов', 'The process runs with a system call filter'), correct: true },
      { id: 'two', text: W('Процессу разрешены два вызова', 'The process is allowed two calls'), why: W('2 — это режим «фильтр», а не число вызовов.', '2 is the “filter” mode, not a number of calls.') },
      { id: 'level', text: W('Уровень безопасности 2 из 10', 'Security level 2 out of 10'), why: W('Шкалы нет: 0 — фильтра нет, 2 — фильтр включён.', 'There is no scale: 0 means no filter, 2 means the filter is on.') },
    ],
  },
  {
    id: 'linux.q.setcap-copy',
    kind: 'mcq',
    concepts: ['linux.capability'],
    prompt: W('Программе дали `setcap cap_net_bind_service=+ep`, потом скопировали её командой `cp`. У копии есть эта привилегия?', 'A program was given `setcap cap_net_bind_service=+ep` and then copied with `cp`. Does the copy have the capability?'),
    options: [
      { id: 'no', text: W('Нет: привилегия записана на тот файл, у копии другой inode', 'No: the capability is written on that file, and the copy has another inode'), correct: true },
      { id: 'yes', text: W('Да: cp копирует всё', 'Yes: cp copies everything'), why: W('Обычный cp атрибуты файла не переносит; setcap придётся сделать заново.', 'A plain cp does not carry the file’s attributes; setcap has to be done again.') },
    ],
  },
  // ── rootfs ──
  {
    id: 'linux.q.chroot',
    kind: 'multi',
    concepts: ['linux.chroot'],
    prompt: W('Что изолирует chroot? Отметьте всё верное.', 'What does chroot isolate? Mark everything that is true.'),
    options: [
      { id: 'files', text: W('Видимый корень файлов', 'The visible root of files'), correct: true },
      { id: 'procs', text: W('Процессы', 'Processes'), why: W('Процессы общие: смонтируйте /proc внутри, и ps покажет всю машину.', 'Processes are shared: mount /proc inside and ps shows the whole machine.') },
      { id: 'net', text: W('Сеть', 'The network'), why: W('Сеть та же: для своей нужно пространство net.', 'The network is the same: you need a net namespace for your own.') },
      { id: 'host', text: W('Имя машины', 'The host name'), why: W('Имя общее: для своего нужно пространство uts.', 'The name is shared: you need a uts namespace for your own.') },
    ],
  },
  {
    id: 'linux.q.whiteout',
    kind: 'mcq',
    concepts: ['linux.overlay'],
    prompt: W('Файл удалили в merged. Что лежит в upperdir?', 'A file was deleted in merged. What is in upperdir?'),
    options: [
      { id: 'whiteout', text: W('Символьное устройство 0, 0 с тем же именем — whiteout; в нижнем слое файл остался', 'A character device 0, 0 with the same name — a whiteout; the file stays in the lower layer'), correct: true },
      { id: 'nothing', text: W('Ничего: файл удалён из нижнего слоя', 'Nothing: the file was deleted from the lower layer'), why: W('Нижние слои только для чтения и никогда не меняются.', 'The lower layers are read-only and never change.') },
      { id: 'copy', text: W('Копия файла', 'A copy of the file'), why: W('Копия появляется при изменении (copy-up), а при удалении — метка.', 'A copy appears on change (copy-up); a deletion leaves a mark.') },
    ],
  },
  {
    id: 'linux.q.copyup',
    kind: 'order',
    concepts: ['linux.overlay'],
    prompt: W('Расставьте по порядку, что происходит при первой записи в файл из нижнего слоя.', 'Put in order what happens at the first write to a file from a lower layer.'),
    steps: [
      { id: 'find', text: W('Файл найден в нижнем слое', 'The file is found in a lower layer') },
      { id: 'copy', text: W('Файл целиком копируется в upper (copy-up)', 'The whole file is copied into upper (copy-up)') },
      { id: 'write', text: W('Запись идёт в копию в upper', 'The write goes into the copy in upper') },
      { id: 'see', text: W('merged показывает версию из upper', 'merged shows the version from upper') },
    ],
  },
  // ── ssh ──
  {
    id: 'linux.q.pubkey',
    kind: 'mcq',
    concepts: ['linux.ssh-key'],
    prompt: W('Какой файл вы копируете на сервер: `id_ed25519` или `id_ed25519.pub`?', 'Which file do you copy to the server: `id_ed25519` or `id_ed25519.pub`?'),
    options: [
      { id: 'pub', text: 'id_ed25519.pub', correct: true },
      { id: 'priv', text: 'id_ed25519', why: W('Это закрытый ключ: он не покидает вашу машину. Тот, у кого он есть, может войти вместо вас.', 'That is the private key: it never leaves your machine. Whoever has it can log in as you.') },
      { id: 'both', text: W('Оба', 'Both'), why: W('Серверу нужен только открытый — он проверяет подпись, сделанную закрытым.', 'The server needs only the public one — it checks a signature made with the private one.') },
    ],
  },
  {
    id: 'linux.q.strictmodes',
    kind: 'mcq',
    concepts: ['linux.ssh-key', 'linux.mode'],
    prompt: W('Ключ правильный, а sshd пишет в журнал `Authentication refused: bad ownership or modes for file /home/deploy/.ssh/authorized_keys`. Что исправить?', 'The key is right, but sshd logs `Authentication refused: bad ownership or modes for file /home/deploy/.ssh/authorized_keys`. What do you fix?'),
    options: [
      { id: 'mode', text: W('Права и владельца: файл 600 и каталог 700, оба принадлежат deploy', 'The mode and owner: the file 600 and the directory 700, both owned by deploy'), correct: true },
      { id: 'key', text: W('Сгенерировать новый ключ', 'Generate a new key'), why: W('Ключ в порядке: sshd не доверяет файлу, который могут изменить другие.', 'The key is fine: sshd does not trust a file that others can change.') },
      { id: 'open', text: W('Сделать authorized_keys доступным всем (666)', 'Make authorized_keys accessible to everyone (666)'), why: W('Наоборот: именно запись для других и есть причина отказа.', 'The opposite: write access for others is exactly the reason for the refusal.') },
    ],
  },
];
