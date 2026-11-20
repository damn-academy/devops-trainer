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
    prompt: W('В строке `echo hello world` между словами hello и world поставили не один, а пять пробелов подряд. Сколько аргументов получит команда `echo`?', 'In the line `echo hello world` five spaces in a row were put between hello and world instead of one. How many arguments does `echo` get?'),
    options: [
      { id: '2', text: '2', correct: true },
      { id: '6', text: '6', why: W('Пробелы оболочка аргументами не считает. Сколько бы их ни стояло подряд, они только отделяют одно слово от другого.', 'Spaces are not arguments: they only separate words, however many there are.') },
      { id: '1', text: '1', why: W('Одним аргументом фраза стала бы только в том случае, если бы её взяли в кавычки.', 'The phrase becomes one argument only if you put it in quotes.') },
      { id: '3', text: '3', why: W('Имя команды в число аргументов не входит. Аргументами называются только слова, которые идут после него.', 'The command name is not an argument: arguments are the words after it.') },
    ],
    explain: W('Оболочка делит строку на три слова: `echo`, `hello` и `world`. Первое слово она считает именем команды, а два остальных передаёт этой команде как аргументы.', 'The shell splits the line into words: `echo`, `hello`, `world`. The first is the command, the other two are arguments.'),
    refs: { lesson: 'linux.terminal' },
  },
  {
    id: 'linux.q.prompt',
    kind: 'match',
    concepts: ['linux.shell', 'linux.terminal'],
    prompt: W('Разберите приглашение `anna@web-1:/var/log$` на части: сопоставьте каждый кусок строки с тем, что он сообщает.', 'Take the prompt `anna@web-1:/var/log$` apart.'),
    pairs: [
      { id: 'user', left: 'anna', right: W('имя пользователя, от которого вы работаете', 'the user') },
      { id: 'host', left: 'web-1', right: W('имя машины', 'the machine name') },
      { id: 'dir', left: '/var/log', right: W('место в системе, где вы сейчас находитесь', 'where you are now') },
      { id: 'sign', left: '$', right: W('оболочка ждёт команду от обычного пользователя', 'waiting for a command, you are not the administrator') },
    ],
    explain: W('Знак `$` в конце приглашения означает, что вы работаете как обычный пользователь. Если вместо него стоит `#`, вы работаете как администратор, и машина выполнит любую команду, даже разрушительную.', 'If you see `#` instead of `$`, you are working as the administrator: the machine will do anything.'),
  },
  // ── paths ──
  {
    id: 'linux.q.relpath',
    kind: 'mcq',
    concepts: ['linux.abs-path'],
    prompt: W('Вы находитесь в каталоге `/var/log`. Какой путь ведёт в `/var/lib`?', 'You are in `/var/log`. Which path leads to `/var/lib`?'),
    options: [
      { id: 'up', text: '../lib', correct: true },
      { id: 'lib', text: 'lib', why: W('Нет, путь `lib` ведёт в каталог внутри текущего, то есть в `/var/log/lib`.', 'No, the path `lib` leads to a directory inside the current one, that is, `/var/log/lib`.') },
      { id: 'root', text: '/lib', why: W('Нет, путь с `/` в начале отсчитывается от корня, и такой путь ведёт в `/lib`, а это другой каталог.', 'No, a path starting with `/` is counted from the root, and that is `/lib`, a different directory altogether.') },
      { id: 'dot', text: './lib', why: W('Нет, точка обозначает текущий каталог, поэтому `./lib` ведёт туда же, куда и `lib`.', 'No, a dot means the current directory, so `./lib` leads where `lib` does.') },
    ],
    explain: W('Две точки `..` обозначают каталог на уровень выше, и из `/var/log` это `/var`. Оттуда путь спускается в каталог `lib`.', 'Two dots `..` mean the directory one level up, and from `/var/log` that is `/var`. From there the path goes down into `lib`.'),
  },
  {
    id: 'linux.q.abs-rel',
    kind: 'match',
    concepts: ['linux.abs-path', 'linux.home'],
    prompt: W('Сопоставьте каждый путь с тем местом, от которого он отсчитывается.', 'Match each path with the place it is counted from.'),
    pairs: [
      { id: 'abs', left: '/etc/hosts', right: W('путь отсчитывается от корня', 'the path is counted from the root') },
      { id: 'rel', left: 'notes/todo.txt', right: W('путь ведёт вглубь от текущего каталога', 'the path goes down from the current directory') },
      { id: 'home', left: '~/notes', right: W('путь отсчитывается от домашнего каталога', 'the path is counted from the home directory') },
      { id: 'up', left: '../app.log', right: W('путь начинается с подъёма на каталог выше текущего', 'the path starts by going up to the directory above the current one') },
    ],
  },
  // ── files ──
  {
    id: 'linux.q.mv',
    kind: 'mcq',
    concepts: ['linux.archive'],
    prompt: W('Файл `b.txt` уже существовал, и вы выполнили `mv a.txt b.txt`. Что останется в каталоге?', 'The file `b.txt` already existed, and you ran `mv a.txt b.txt`. What is left in the directory?'),
    options: [
      { id: 'b', text: W('Останется только b.txt, в котором будет содержимое бывшего a.txt', 'Only b.txt remains, holding the contents of the former a.txt'), correct: true },
      { id: 'both', text: W('Останутся оба файла, а b.txt никто не тронет', 'Both files remain, and nobody touches b.txt'), why: W('Нет, команда mv без флагов ничего не спрашивает и заменяет существующий файл.', 'No, mv without flags asks nothing and replaces the existing file.') },
      { id: 'err', text: W('Команда сообщит об ошибке, потому что файл уже существует', 'The command reports an error, because the file already exists'), why: W('Нет, `mv` ничего не спрашивает и молча заменяет существующий файл. Чтобы этого не случилось, у команды есть флаг `-n`: с ним `mv -n a.txt b.txt` оставит b.txt нетронутым.', 'No, `mv` asks nothing and silently replaces the existing file. To prevent that, the command has the `-n` flag: with it `mv -n a.txt b.txt` leaves b.txt untouched.') },
      { id: 'trash', text: W('Старый b.txt попадёт в корзину', 'The old b.txt goes to the trash'), why: W('Нет, корзины в Linux нет, и прежнее содержимое b.txt потеряно безвозвратно.', 'No, Linux has no trash, and the old contents of b.txt are gone for good.') },
    ],
  },
  {
    id: 'linux.q.glob',
    kind: 'mcq',
    concepts: ['linux.glob'],
    prompt: W('Кто превращает шаблон `*.log` в список имён, когда вы набираете `rm *.log`?', 'Who turns the pattern `*.log` into a list of names when you type `rm *.log`?'),
    options: [
      { id: 'shell', text: W('Оболочка, ещё до запуска rm', 'The shell, before rm starts'), correct: true },
      { id: 'rm', text: W('Сама команда rm', 'The rm command itself'), why: W('Нет, rm получает уже готовые имена, как если бы вы напечатали их сами, и поэтому шаблоны одинаково работают у всех команд.', 'No, rm receives ready names, as if you had typed them yourself, which is why patterns work the same for every command.') },
      { id: 'fs', text: W('Файловая система', 'The file system'), why: W('Нет, файловая система хранит имена, а подбирает их по шаблону оболочка.', 'No, the file system stores the names, and the shell picks them by the pattern.') },
    ],
    explain: W('Если ни одно имя к шаблону не подошло, оболочка передаёт шаблон как есть, и команда ищет файл, который так и называется: `*.log`.', 'If no name matches the pattern, the shell passes it as it is, and the command looks for a file literally called `*.log`.'),
  },
  {
    id: 'linux.q.tar-c',
    kind: 'mcq',
    concepts: ['linux.archive'],
    prompt: W('Чем команда `tar -xzf ~/site.tgz -C /srv/site` отличается от `cd /srv/site && tar -xzf ~/site.tgz`?', 'How does `tar -xzf ~/site.tgz -C /srv/site` differ from `cd /srv/site && tar -xzf ~/site.tgz`?'),
    options: [
      { id: 'same', text: W('Результат одинаковый, потому что -C переходит в каталог перед распаковкой', 'The result is the same, because -C changes to the directory before unpacking'), correct: true },
      { id: 'sub', text: W('Флаг -C создаёт подкаталог с именем архива', 'The -C flag creates a subdirectory named after the archive'), why: W('Нет, подкаталоги появятся, только если они записаны в самом архиве, а увидеть это можно командой `tar -t`.', 'No, subdirectories appear only if they are recorded in the archive itself, which `tar -t` shows.') },
      { id: 'over', text: W('Флаг -C перезаписывает каталог целиком', 'The -C flag overwrites the whole directory'), why: W('Нет, tar добавляет и заменяет только те файлы, которые есть в архиве, а остальные файлы каталога не трогает.', 'No, tar adds and replaces only the files in the archive and leaves the rest of the directory alone.') },
    ],
  },
  {
    id: 'linux.q.vim-exit',
    kind: 'mcq',
    prompt: W('Вы открыли файл настроек в `vim`, что-то напечатали, и на экране творится непонятное. Как выйти из редактора, ничего не записав в файл?', 'You opened a settings file in `vim`, typed something, and the screen shows something strange. How do you leave the editor without writing anything to the file?'),
    options: [
      { id: 'q', text: W('Нажать Esc, набрать `:q!` и нажать Enter', 'Press Esc, type `:q!` and press Enter'), correct: true },
      { id: 'ctrlc', text: W('Нажать Ctrl+C', 'Press Ctrl+C'), why: W('Нет, в `vim` сочетание Ctrl+C только прерывает текущую команду редактора и оставляет файл открытым. Выход без записи делает набор `:q!` в режиме команд, куда возвращает клавиша Esc.', 'No, in `vim` Ctrl+C only interrupts the current editor command and leaves the file open. Leaving without writing is `:q!` in command mode, to which Esc brings you back.') },
      { id: 'ctrlx', text: W('Нажать Ctrl+X', 'Press Ctrl+X'), why: W('Так закрывается редактор `nano`. В `vim` сочетание Ctrl+X ничего не закрывает, а выход без записи делает набор `:q!` после клавиши Esc.', 'That is how `nano` closes. In `vim` Ctrl+X closes nothing, and leaving without writing is `:q!` after Esc.') },
      { id: 'close', text: W('Закрыть окно терминала', 'Close the terminal window'), why: W('Файл останется прежним, но `vim` оставит рядом служебный файл с окончанием `.swp` и при следующем открытии начнёт спрашивать о нём, а на сервере вы ещё и потеряете сеанс. Чище выйти набором `:q!` после клавиши Esc.', 'The file stays as it was, but `vim` leaves a helper file ending in `.swp` next to it and asks about it the next time, and on a server you also lose the session. It is cleaner to leave with `:q!` after Esc.') },
    ],
    refs: { lesson: 'linux.files' },
  },
  // ── manual ──
  {
    id: 'linux.q.synopsis',
    kind: 'mcq',
    concepts: ['linux.man-page'],
    prompt: W('В разделе SYNOPSIS страницы cp написано `cp [OPTION]... SOURCE... DIRECTORY`. Можно ли скопировать два файла в каталог одной командой?', 'The SYNOPSIS of the cp page says `cp [OPTION]... SOURCE... DIRECTORY`. Can you copy two files into a directory with one command?'),
    options: [
      { id: 'yes', text: W('Да, потому что многоточие после SOURCE разрешает повторить источник', 'Yes, because the ellipsis after SOURCE lets the source repeat'), correct: true },
      { id: 'no', text: W('Нет, потому что источник SOURCE может быть только один', 'No, because there can be only one SOURCE'), why: W('Многоточие после слова в SYNOPSIS означает, что эту часть можно повторить, поэтому источников может быть несколько.', 'An ellipsis after a word in SYNOPSIS means the part may repeat, so there may be several sources.') },
      { id: 'flag', text: W('Можно, но только с флагом -r', 'You can, but only with the -r flag'), why: W('Нет, флаг -r нужен, когда источником служит каталог, а на число файлов он не влияет.', 'No, -r is needed when a source is a directory, and it has nothing to do with the number of files.') },
    ],
  },
  {
    id: 'linux.q.builtin',
    kind: 'mcq',
    concepts: ['linux.builtin'],
    prompt: W('Где подробнее всего описано поведение команды `cd`?', 'Where is the behaviour of `cd` described in the most detail?'),
    options: [
      { id: 'help', text: 'help cd', correct: true },
      { id: 'man', text: 'man 1 cd', why: W('Страница найдётся, но общая, потому что `cd` встроена в оболочку, и точное её поведение в этой оболочке описывает `help`.', 'A page shows up, but a generic one, because `cd` is built into the shell, and `help` describes its exact behaviour in this shell.') },
      { id: 'which', text: 'which cd', why: W('Нет, which ищет файлы программ в каталогах PATH, а у встроенной команды файла нет.', 'No, which looks for program files in the PATH directories, and a builtin is not a file.') },
    ],
    explain: W('Команда `type cd` ответит «cd is a shell builtin», то есть «cd встроена в оболочку».', '`type cd` answers “cd is a shell builtin”.'),
  },
  {
    id: 'linux.q.man-sections',
    kind: 'match',
    concepts: ['linux.man-page'],
    prompt: W('Сопоставьте каждый том руководства с тем, что в нём описано.', 'Match each section of the manual with what it describes.'),
    pairs: [
      { id: '1', left: 'man 1', right: W('в нём описаны команды пользователя', 'it describes user commands') },
      { id: '5', left: 'man 5', right: W('в нём описаны форматы файлов', 'it describes file formats') },
      { id: '7', left: 'man 7', right: W('в нём собраны обзоры и соглашения', 'it collects overviews and conventions') },
      { id: '8', left: 'man 8', right: W('в нём описаны команды администратора', 'it describes administration commands') },
    ],
    explain: W('Поэтому `man crontab` и `man 5 crontab` открывают разные страницы: первая рассказывает о команде, а вторая о формате файла с тем же именем.', 'So `man crontab` and `man 5 crontab` open different pages: the first is about the command, the second about the format of the file with the same name.'),
  },
  // ── users ──
  {
    id: 'linux.q.passwd-x',
    kind: 'mcq',
    concepts: ['linux.user'],
    prompt: W('В файле `/etc/passwd` есть строка `anna:x:1001:1001::/home/anna:/bin/bash`. Где хранится пароль anna?', '`/etc/passwd` has the line `anna:x:1001:1001::/home/anna:/bin/bash`. Where is anna’s password kept?'),
    options: [
      { id: 'shadow', text: W('Там хранится не пароль, а его хэш, в файле /etc/shadow, который обычный пользователь прочитать не может', 'Not the password but its hash is kept, in /etc/shadow, which an ordinary user cannot read'), correct: true },
      { id: 'x', text: W('Её пароль и есть буква x', 'Her password is the letter x'), why: W('Нет, буква `x` служит заглушкой и означает, что пароль хранится в другом месте.', 'No, the `x` is a placeholder meaning the password is kept elsewhere.') },
      { id: 'none', text: W('Пароля у anna нет', 'anna has no password'), why: W('Нет, без пароля поле было бы пустым, а здесь в нём стоит x.', 'No, without a password the field would be empty, and here it holds x.') },
    ],
  },
  {
    id: 'linux.q.uid',
    kind: 'mcq',
    concepts: ['linux.user'],
    prompt: W('Пользователя переименовали из `anna` в `anya`, а номер UID оставили прежним. Что стало с её файлами?', 'The user was renamed from `anna` to `anya`, and the UID was kept. What happened to her files?'),
    options: [
      { id: 'same', text: W('Файлы остались её, и ls покажет новое имя владельца', 'The files stay hers, and ls shows the new owner name'), correct: true },
      { id: 'orphan', text: W('Файлы стали ничьими', 'The files belong to nobody now'), why: W('Нет, файл хранит номер владельца, а не имя, и имя команда ls подставляет по файлу /etc/passwd.', 'No, a file keeps its owner’s number, not the name, and ls fills in the name from /etc/passwd.') },
      { id: 'root', text: W('Файлы перешли к root', 'The files went to root'), why: W('Нет, владельца никто не менял, потому что номер UID остался тем же.', 'No, nobody changed the owner, because the UID stayed the same.') },
    ],
  },
  {
    id: 'linux.q.uid-other-machine',
    kind: 'mcq',
    concepts: ['linux.user'],
    prompt: W('Вы перенесли архив с файлами anna со старого сервера на новый и распаковали его от имени root. На новом сервере anna тоже есть, но `ls -l` показывает владельцем файлов не её имя, а число `1001`, и anna не может их изменить. Почему?', 'You moved an archive of anna’s files from the old server to a new one and unpacked it as root. anna exists on the new server too, but `ls -l` shows not her name but the number `1001` as the owner, and anna cannot change the files. Why?'),
    options: [
      { id: 'uid', text: W('На новом сервере у anna другой номер UID, а файлы хранят номер 1001, под которым она была на старом', 'On the new server anna has another UID, while the files keep the number 1001 she had on the old one'), correct: true },
      { id: 'tar', text: W('Архив испортился при переносе', 'The archive got damaged on the way'), why: W('Нет, испорченный архив не распаковался бы, а здесь файлы на месте. Архив сохранил владельца как номер, и этот номер на новой машине никому не принадлежит или принадлежит другому человеку.', 'No, a damaged archive would not unpack, and here the files are in place. The archive kept the owner as a number, and on the new machine that number belongs to nobody or to someone else.') },
      { id: 'root', text: W('Файлы принадлежат root, потому что их распаковал root', 'The files belong to root, because root unpacked them'), why: W('Нет, root при распаковке сохраняет владельцев, записанных в архиве, и поэтому файлы получили номер 1001. Будь владельцем root, `ls -l` показал бы имя root.', 'No, when root unpacks it keeps the owners recorded in the archive, which is why the files got the number 1001. If root were the owner, `ls -l` would show the name root.') },
    ],
    explain: W('Система хранит владельца файла номером, а имя подставляет по файлу `/etc/passwd` той машины, на которой вы смотрите. Команда `ls -n` показывает номера вместо имён, а `id anna` показывает, какой номер у anna здесь. Владельца файлов меняет команда `chown`, о которой рассказывает урок о правах. Та же история случается, когда каталог машины подключают к программе, которая работает под другим номером пользователя: имена совпадают, а номера нет.', 'The system keeps a file’s owner as a number and fills in the name from `/etc/passwd` of the machine you are looking from. `ls -n` shows numbers instead of names, and `id anna` shows which number anna has here. The owner of files is changed with `chown`, covered in the lesson on permissions. The same story happens when a directory of the machine is given to a program that runs under another user number: the names match, the numbers do not.'),
    refs: { lesson: 'linux.users' },
  },
  // ── permissions ──
  {
    id: 'linux.q.octal',
    kind: 'fill-command',
    concepts: ['linux.mode'],
    prompt: W('Каким числом записывается режим `rwxr-x---`?', 'Which number writes the mode `rwxr-x---`?'),
    template: 'chmod ___ report.sh',
    answers: ['chmod 750 report.sh', 'chmod 0750 report.sh'],
    misconceptions: [{ match: '^chmod 0?570', why: W('Нет, первая цифра относится к владельцу, а тройка rwx даёт 4 + 2 + 1, то есть 7.', 'No, the first digit is the owner’s, and rwx gives 4 + 2 + 1, that is, 7.') }, { match: '^chmod 0?755', why: W('Нет, режим 755 даёт остальным права r-x, а им не нужно ничего, поэтому последняя цифра должна быть 0.', 'No, 755 gives others r-x, while they should get nothing, so the last digit must be 0.') }],
    explain: W('r = 4, w = 2, x = 1: rwx = 7, r-x = 5, --- = 0.', 'r = 4, w = 2, x = 1: rwx = 7, r-x = 5, --- = 0.'),
  },
  {
    id: 'linux.q.dir-x',
    kind: 'multi',
    concepts: ['linux.mode'],
    prompt: W('У каталога режим `drwxr-xr--`. Что сможет сделать с ним пользователь, который относится к «остальным»? Отметьте все верные ответы.', 'A directory has the mode `drwxr-xr--`. What can a user who falls under “others” do with it? Tick every right answer.'),
    options: [
      { id: 'ls', text: W('Команда `ls dir` покажет имена файлов', '`ls dir` shows the file names'), correct: true },
      { id: 'cd', text: W('Команда `cd dir` сработает', '`cd dir` works'), why: W('Нет, чтобы войти в каталог, нужен бит x, а у остальных есть только r.', 'No, entering a directory needs the x bit, and others have only r.') },
      { id: 'cat', text: W('Команда `cat dir/file` прочитает файл, если сам файл доступен для чтения', '`cat dir/file` reads the file if the file itself is readable'), why: W('Нет, до файла не добраться, потому что пройти через каталог можно только с битом x.', 'No, you cannot get to the file, because passing through a directory needs the x bit.') },
      { id: 'rm', text: W('Команда `rm dir/file` удалит файл', '`rm dir/file` deletes the file'), why: W('Нет, удаление файла меняет каталог, и для этого нужны биты w и x.', 'No, deleting a file changes the directory, and that needs the w and x bits.') },
    ],
  },
  {
    id: 'linux.q.umask',
    kind: 'mcq',
    concepts: ['linux.mode'],
    prompt: W('Какой режим получит новый файл, если маска равна `umask 027`?', 'Which mode does a new file get with `umask 027`?'),
    options: [
      { id: '640', text: '640', correct: true },
      { id: '750', text: '750', why: W('Нет, режим 750 получит новый каталог: его создают с режимом 777, и маска 027 снимает в нём бит w у группы и все биты у остальных. Новый файл создают с режимом 666, бита x у него нет с самого начала, поэтому та же маска оставляет ему 640.', 'No, 750 is what a new directory gets: it is created with 777, and the mask 027 clears w for the group and every bit for others. A new file is created with 666 and has no x bit to begin with, so the same mask leaves it 640.') },
      { id: '027', text: '027', why: W('Нет, маска umask задаёт то, что убирается из прав, а не то, что в них остаётся.', 'No, umask sets what is removed from the rights, not what remains.') },
    ],
  },
  {
    id: 'linux.q.sudo-redirect',
    kind: 'bugfind',
    concepts: ['linux.sudo', 'linux.root'],
    prompt: W('Одна из строк скрипта завершается ошибкой `Permission denied`, хотя в ней есть sudo. Нажмите на эту строку.', 'One line of the script fails with `Permission denied` although it has sudo. Click that line.'),
    code: 'sudo mkdir -p /etc/app\nsudo echo "listen 8080" > /etc/app/app.conf\necho "workers 4" | sudo tee -a /etc/app/app.conf',
    bug: [2],
    why: {
      1: W('В этой строке всю работу выполняет mkdir от имени root, и строка верна.', 'In this line mkdir does all the work as root, and the line is right.'),
      2: W('Запись `>` выполняет ваша оболочка от вашего имени ещё до запуска sudo, а от имени root работает только echo.', 'The `>` is done by your shell, as you, before sudo even starts, and only echo runs as root.'),
      3: W('Это правильный приём, потому что файл открывает команда tee, которая запущена от имени root.', 'This is the right trick, because the file is opened by tee, which runs as root.'),
    },
  },
  {
    id: 'linux.q.sudo-cd',
    kind: 'mcq',
    concepts: ['linux.sudo', 'linux.builtin'],
    prompt: W('Пользователь хочет зайти в домашний каталог администратора и набирает `sudo cd /root`, а получает ответ `sudo: cd: command not found`. Почему так вышло?', 'A user wants to enter the administrator’s home directory and types `sudo cd /root`, but gets `sudo: cd: command not found`. Why?'),
    options: [
      { id: 'builtin', text: W('Команда `cd` встроена в оболочку, а sudo умеет запускать только отдельные программы', '`cd` is built into the shell, and sudo can start only separate programs'), correct: true },
      { id: 'nosudo', text: W('Пользователю не разрешено пользоваться sudo', 'The user is not allowed to use sudo'), why: W('Тогда sudo ответил бы, что пользователя нет в файле sudoers. Здесь sudo запустился и не нашёл программу с именем cd, потому что такой программы нет, а есть встроенная команда оболочки.', 'Then sudo would say that the user is not in the sudoers file. Here sudo started and found no program called cd, because there is none, only a shell builtin.') },
      { id: 'dirx', text: W('У каталога `/root` нет бита x для остальных', '`/root` has no x bit for others'), why: W('Бит x у `/root` для остальных снят, но root эти биты не проверяет. Мешает другое: sudo запускает программу, а каталог оболочки может сменить только сама оболочка.', 'The x bit of `/root` is indeed cleared for others, but root does not check those bits. The obstacle is different: sudo starts a program, and only the shell itself can change the shell’s directory.') },
    ],
    explain: W('Даже если бы sudo нашёл программу `cd`, а в некоторых системах, например в RHEL, файл `/usr/bin/cd` есть, она сменила бы каталог только себе и сразу завершилась, а ваша оболочка осталась бы на месте. Посмотреть, что лежит в `/root`, можно командой `sudo ls /root`, а работать там удобнее в оболочке root, которую открывает `sudo -i`.', 'Even if sudo found a `cd` program, and some systems, such as RHEL, really have `/usr/bin/cd`, it would change only its own directory and exit at once, and your shell would stay where it was. To see what is in `/root`, use `sudo ls /root`, and to work there, open a root shell with `sudo -i`.'),
    refs: { lesson: 'linux.permissions' },
  },
  {
    id: 'linux.q.root-denied',
    kind: 'mcq',
    concepts: ['linux.root', 'linux.mode'],
    prompt: W('Администратор работает под root и пытается удалить старый файл, а система ему отказывает:\n\n```\n# rm /etc/app/license.key\nrm: cannot remove \'/etc/app/license.key\': Operation not permitted\n# ls -l /etc/app/license.key\n-rw-r--r-- 1 root root 64 Nov 18 09:00 /etc/app/license.key\n```\n\nФайл принадлежит root, а каталог и биты прав в порядке. В чём, скорее всего, причина?', 'The administrator works as root and tries to delete an old file, but the system refuses:\n\n```\n# rm /etc/app/license.key\nrm: cannot remove \'/etc/app/license.key\': Operation not permitted\n# ls -l /etc/app/license.key\n-rw-r--r-- 1 root root 64 Nov 18 09:00 /etc/app/license.key\n```\n\nThe file belongs to root, and the directory and the mode bits are fine. What is the most likely cause?'),
    options: [
      { id: 'immutable', text: W('На файле стоит пометка «неизменяемый», которую показывает команда `lsattr`', 'The file carries the “immutable” mark that `lsattr` shows'), correct: true },
      { id: 'sudo', text: W('Команду нужно было запустить через sudo', 'The command should have been run with sudo'), why: W('Знак `#` в приглашении показывает, что оболочка уже работает от имени root, и sudo ничего не добавит. Мешает не нехватка прав, а пометка, которую ставит `chattr +i` и снимает `chattr -i`.', 'The `#` in the prompt shows that the shell already runs as root, and sudo adds nothing. The obstacle is not a lack of rights but the mark that `chattr +i` sets and `chattr -i` removes.') },
      { id: 'write', text: W('У файла нет бита w у группы и у остальных', 'The file has no w bit for the group and others'), why: W('Для удаления биты самого файла не важны, решает бит w у каталога, а root не проверяет и его. Отказ при удалении собственного файла у root чаще всего означает пометку «неизменяемый» от `chattr +i`.', 'The file’s own bits do not matter for deletion, the w bit of the directory decides, and root does not check even that. A refusal to delete root’s own file most often means the “immutable” mark set by `chattr +i`.') },
    ],
    explain: W('Биты rwx root обходит, но пометки файловой системы, диск, подключённый только для чтения, модули безопасности вроде SELinux и отнятые привилегии действуют и на него. Сначала посмотрите `lsattr /etc/app/license.key`: буква `i` в выводе означает, что файл неизменяемый, и снять пометку можно командой `chattr -i`.', 'root bypasses the rwx bits, but file system marks, a disk attached read-only, security modules such as SELinux and removed privileges apply to it too. Look at `lsattr /etc/app/license.key` first: the letter `i` in the output means the file is immutable, and `chattr -i` removes the mark.'),
    refs: { lesson: 'linux.permissions' },
  },
  // ── streams ──
  {
    id: 'linux.q.redirect-order',
    kind: 'mcq',
    concepts: ['linux.redirect', 'linux.stream'],
    prompt: W('Чем отличаются команды `cmd > out 2>&1` и `cmd 2>&1 > out`?', 'How do `cmd > out 2>&1` and `cmd 2>&1 > out` differ?'),
    options: [
      { id: 'right', text: W('В первой оба потока попадают в файл, а во второй ошибки остаются на экране', 'In the first both streams end up in the file, and in the second the errors stay on screen'), correct: true },
      { id: 'same', text: W('Ничем не отличаются', 'They do not differ'), why: W('Нет, перенаправления выполняются по порядку, а `2>&1` копирует то направление, которое поток 1 имеет в этот момент.', 'No, redirections run in order, and `2>&1` copies whatever direction stream 1 has at that moment.') },
      { id: 'reverse', text: W('Всё наоборот, и оба потока попадают в файл во второй команде', 'It is the other way round, and both streams end up in the file in the second command'), why: W('Нет, во второй команде поток 2 сначала скопировал направление на терминал, и только потом поток 1 направили в файл.', 'No, in the second command stream 2 first copied the direction to the terminal, and only then was stream 1 sent to the file.') },
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
      { id: '2', text: '2', why: W('Нет, uniq убирает только повторы, которые стоят рядом, а две строки b рядом не стоят.', 'No, uniq removes only repeats that stand next to each other, and the two b lines are not adjacent.') },
      { id: '1', text: '1', why: W('Нет, строк будет три: b, a и b, потому что ни одна из них не удалена.', 'No, there are three lines, b, a and b, because none of them is removed.') },
    ],
    explain: W('Поэтому перед `uniq` почти всегда ставят `sort`, чтобы одинаковые строки оказались рядом.', 'That is why `sort` almost always comes before `uniq`, so that identical lines end up together.'),
  },
  {
    id: 'linux.q.regex',
    kind: 'match',
    concepts: ['linux.regex'],
    prompt: W('Сопоставьте каждое регулярное выражение со строками, которые оно найдёт.', 'Match each regular expression with the lines it finds.'),
    pairs: [
      { id: 'start', left: '^ERROR', right: W('строки, которые начинаются с ERROR', 'lines that start with ERROR') },
      { id: 'end', left: '500$', right: W('строки, которые оканчиваются на 500', 'lines that end with 500') },
      { id: 'digit', left: '[0-9][0-9]*', right: W('строки, в которых есть хотя бы одна цифра', 'lines that contain at least one digit') },
      { id: 'dot', left: 'a.c', right: W('строки, в которых за a идёт любой символ, а за ним c, например abc, a-c или a c', 'lines where a is followed by any character and then c, such as abc, a-c or a c') },
    ],
  },
  {
    id: 'linux.q.pipe-bug',
    kind: 'bugfind',
    concepts: ['linux.pipe', 'linux.redirect'],
    prompt: W('Скрипт должен показать строки со словом error из журнала, но ничего не показывает. В какой строке ошибка?', 'The script must show the lines with error from the log, but shows nothing. Which line has the bug?'),
    code: 'cd /var/log/app\ncat app.log > grep error\necho done',
    bug: [2],
    why: {
      1: W('Переход в каталог записан верно.', 'The change of directory is written correctly.'),
      2: W('Здесь стоит `>` вместо `|`, поэтому вывод cat ушёл в файл с именем grep, а слово error стало вторым файлом для cat.', 'Here `>` stands instead of `|`, so cat’s output went into a file called grep, and the word error became a second file for cat.'),
      3: W('Эта строка записана верно.', 'This line is written correctly.'),
    },
  },
  // ── env ──
  {
    id: 'linux.q.export',
    kind: 'mcq',
    concepts: ['linux.env', 'linux.variable'],
    prompt: W("Почему строка `VAR=1; bash -c 'echo $VAR'` печатает пустую строку?", "Why does `VAR=1; bash -c 'echo $VAR'` print an empty line?"),
    options: [
      { id: 'export', text: W('Переменная не экспортирована, поэтому запущенная программа её не получает', 'The variable is not exported, so the started program does not receive it'), correct: true },
      { id: 'quotes', text: W('Одинарные кавычки запрещают подстановку', 'Single quotes forbid substitution'), why: W('Кавычки здесь как раз нужны, потому что не дают вашей оболочке подставить VAR. Подставлять будет новая оболочка, а у неё переменной VAR нет.', 'The quotes are needed here, because they stop your shell from substituting VAR. The new shell will substitute it, and it has no VAR.') },
      { id: 'semicolon', text: W('Точка с запятой сбрасывает переменные', 'A semicolon resets the variables'), why: W('Нет, переменная никуда не делась, и `echo $VAR` в вашей оболочке напечатает 1.', 'No, the variable is still there, and `echo $VAR` in your shell prints 1.') },
    ],
  },
  {
    id: 'linux.q.path-replace',
    kind: 'mcq',
    concepts: ['linux.path-var'],
    prompt: W('После команды `export PATH=/opt/tools/bin` команда `ls` отвечает `command not found`. Почему?', 'After `export PATH=/opt/tools/bin`, `ls` answers `command not found`. Why?'),
    options: [
      { id: 'replaced', text: W('Список каталогов заменили целиком, и каталог /usr/bin из него выпал', 'The list of directories was replaced as a whole, and /usr/bin dropped out of it'), correct: true },
      { id: 'deleted', text: W('Программу ls удалили', 'The program ls was deleted'), why: W('Нет, файл /usr/bin/ls на месте, и если набрать полный путь `/usr/bin/ls`, он запустится.', 'No, /usr/bin/ls is in place, and if you type the full path `/usr/bin/ls`, it runs.') },
      { id: 'restart', text: W('Нужно перезагрузить машину', 'The machine must be rebooted'), why: W('Нет, новое значение PATH действует сразу и только в этой оболочке.', 'No, the new PATH applies at once and only in this shell.') },
    ],
    explain: W('Каталог нужно добавлять к списку, например так: `PATH="/opt/tools/bin:$PATH"`.', 'A directory must be added to the list, for example: `PATH="/opt/tools/bin:$PATH"`.'),
  },
  {
    id: 'linux.q.quotes',
    kind: 'predict-output',
    concepts: ['linux.variable'],
    prompt: W('Что напечатает последняя команда?', 'What does the last command print?'),
    command: "CITY=Almaty; echo \"$CITY\" '$CITY'",
    options: [
      { id: 'mixed', text: 'Almaty $CITY', correct: true },
      { id: 'both', text: 'Almaty Almaty', why: W('Нет, в одинарных кавычках оболочка ничего не подставляет.', 'No, inside single quotes the shell substitutes nothing.') },
      { id: 'none', text: '$CITY $CITY', why: W('Нет, в двойных кавычках оболочка подставляет значения переменных.', 'No, inside double quotes the shell substitutes variable values.') },
    ],
  },
  {
    id: 'linux.q.inline-var',
    kind: 'mcq',
    concepts: ['linux.env', 'linux.variable'],
    prompt: W('Вы выполнили строку `LANG=C ls /nosuch`, а следующей командой `echo $LANG`. Что напечатает `echo`, если до этого переменная LANG в оболочке была равна `ru_RU.UTF-8`?', 'You ran the line `LANG=C ls /nosuch` and then `echo $LANG`. What does `echo` print if LANG in the shell was `ru_RU.UTF-8` before?'),
    options: [
      { id: 'old', text: W('`ru_RU.UTF-8`, потому что значение `C` получила только команда `ls`', '`ru_RU.UTF-8`, because only `ls` got the value `C`'), correct: true },
      { id: 'c', text: W('`C`, потому что переменная задана в начале строки', '`C`, because the variable was set at the start of the line'), why: W('Нет, запись `ИМЯ=значение команда` кладёт переменную только в окружение этой одной команды, а в самой оболочке значение не меняется. Значение `C` осталось бы в оболочке, если бы между присваиванием и командой стояла точка с запятой.', 'No, `NAME=value command` puts the variable only into the environment of that one command, and the value in the shell itself does not change. `C` would have stayed in the shell if there had been a semicolon between the assignment and the command.') },
      { id: 'empty', text: W('Пустую строку, потому что команда `ls` завершилась ошибкой', 'An empty line, because `ls` failed'), why: W('Нет, ошибка команды не трогает переменные оболочки. Оболочка не меняла LANG, она только передала `ls` окружение со значением `C`.', 'No, a command’s failure does not touch the shell’s variables. The shell did not change LANG at all; it only handed `ls` an environment with the value `C`.') },
    ],
    explain: W('Запись `ИМЯ=значение команда` удобна, когда настройка нужна одной программе: `TZ=UTC date` показывает время по UTC, а `LANG=C` заставляет программу писать сообщения по-английски, и оболочка после этого остаётся прежней.', '`NAME=value command` is handy when one program needs a setting: `TZ=UTC date` shows the time in UTC, and `LANG=C` makes a program write in English, while the shell stays as it was.'),
    refs: { lesson: 'linux.env' },
  },
  // ── processes ──
  {
    id: 'linux.q.signals',
    kind: 'match',
    concepts: ['linux.signal'],
    prompt: W('Сопоставьте каждый сигнал с тем, что с ним происходит.', 'Match each signal with what happens to it.'),
    pairs: [
      { id: 'term', left: 'TERM (kill PID)', right: W('просит процесс завершиться, и процесс может перехватить сигнал и проигнорировать его', 'asks the process to finish, and the process may catch the signal and ignore it') },
      { id: 'kill', left: 'KILL (kill -9)', right: W('процесс завершает ядро, и перехватить сигнал нельзя', 'the kernel ends the process, and the signal cannot be caught') },
      { id: 'int', left: 'INT (Ctrl+C)', right: W('прерывает процесс по нажатию Ctrl+C на клавиатуре', 'interrupts the process when Ctrl+C is pressed') },
      { id: 'tstp', left: 'TSTP (Ctrl+Z)', right: W('приостанавливает процесс, он переходит в состояние T, а команда fg продолжит его работу', 'pauses the process, which goes into state T, and fg resumes it') },
    ],
  },
  {
    id: 'linux.q.zombie',
    kind: 'mcq',
    concepts: ['linux.process', 'linux.exit-code'],
    prompt: W('Процесс находится в состоянии `Z`. Какой сигнал уберёт его из таблицы?', 'A process is in state `Z`. Which signal removes it from the table?'),
    options: [
      { id: 'none', text: W('Никакой, потому что родитель должен забрать код завершения или завершиться сам', 'None, because the parent must collect the exit code or exit itself'), correct: true },
      { id: 'kill', text: 'kill -9', why: W('Нет, зомби уже завершился, завершать в нём нечего, и от него осталась только запись с кодом завершения.', 'No, a zombie has already finished, there is nothing left to end, and only a record with its exit code remains.') },
      { id: 'term', text: 'kill -TERM', why: W('Нет, сигналы доставляются работающим процессам, а этот процесс уже не работает.', 'No, signals are delivered to running processes, and this process no longer runs.') },
    ],
  },
  {
    id: 'linux.q.fork-order',
    kind: 'order',
    concepts: ['linux.fork-exec'],
    prompt: W('Расставьте по порядку, что происходит после нажатия Enter в строке `ls > list.txt`.', 'Put in order what happens after you press Enter on the line `ls > list.txt`.'),
    steps: [
      { id: 'words', text: W('Оболочка делит строку на слова', 'The shell splits the line into words') },
      { id: 'path', text: W('Оболочка находит /usr/bin/ls по списку PATH', 'The shell finds /usr/bin/ls through PATH') },
      { id: 'fork', text: W('Оболочка создаёт свою копию (fork)', 'The shell makes a copy of itself (fork)') },
      { id: 'redir', text: W('Копия открывает list.txt и подключает его вместо вывода на экран', 'The copy opens list.txt and connects it in place of the screen output'), why: W('Перенаправление выполняется до exec, иначе программа уже писала бы на экран.', 'The redirection happens before exec, otherwise the program would already be writing to the screen.') },
      { id: 'exec', text: W('Копия превращается в программу ls (exec)', 'The copy turns into the program ls (exec)') },
      { id: 'wait', text: W('Оболочка ждёт завершения и кладёт код в $?', 'The shell waits for the end and puts the code into $?') },
    ],
  },
  {
    id: 'linux.q.exit-128',
    kind: 'mcq',
    concepts: ['linux.exit-code', 'linux.signal'],
    prompt: W('Служба завершилась с кодом 137. Что это значит?', 'A program ended with code 137. What does that mean?'),
    options: [
      { id: 'kill', text: W('Её завершили сигналом KILL с номером 9, потому что 128 + 9 = 137', 'It was ended with KILL, number 9, because 128 + 9 = 137'), correct: true },
      { id: 'own', text: W('Программа сама выбрала код 137', 'The program chose code 137 itself'), why: W('Такое возможно, но по соглашению код выше 128 означает, что процесс завершён сигналом с номером N − 128.', 'That is possible, but by convention a code above 128 means the process was ended by signal number N − 128.') },
      { id: 'notfound', text: W('Команда не найдена', 'Command not found'), why: W('Нет, команде, которую не нашли, оболочка ставит код 127.', 'No, the shell gives a command that was not found code 127.') },
    ],
  },
  {
    id: 'linux.q.pipe-label',
    kind: 'label',
    concepts: ['linux.pipe', 'linux.kernel'],
    prompt: W('Подпишите каждую часть конвейера `ls | grep conf`.', 'Label each part of the pipeline `ls | grep conf`.'),
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
      { id: 'writer', text: W('процесс ls, который пишет в поток 1', 'the ls process, which writes to stream 1') },
      { id: 'pipe', text: W('буфер в памяти ядра', 'a buffer in kernel memory') },
      { id: 'reader', text: W('процесс grep, который читает поток 0', 'the grep process, which reads stream 0') },
      { id: 'file', text: W('временный файл на диске', 'a temporary file on disk'), why: W('Нет, между командами нет файла, а есть только буфер ядра, поэтому конвейер работает даже на заполненном диске.', 'No, there is no file between the commands, only a kernel buffer, which is why a pipeline works even on a full disk.') },
    ],
  },
  {
    id: 'linux.q.loadavg',
    kind: 'mcq',
    concepts: ['linux.process'],
    prompt: W('Команда `uptime` на сервере показывает `load average: 4.02, 3.95, 3.90`, а команда `nproc` печатает 4. Что это значит?', '`uptime` on a server shows `load average: 4.02, 3.95, 3.90`, and `nproc` prints 4. What does it mean?'),
    options: [
      { id: 'busy', text: W('Все четыре ядра заняты, но очереди к процессору почти нет, и нагрузка почти не меняется', 'All four cores are busy, but there is almost no queue for the CPU, and the load is steady'), correct: true },
      { id: 'crash', text: W('Сервер перегружен в четыре раза, и нужно срочно останавливать программы', 'The server is four times overloaded, and programs must be stopped at once'), why: W('Нет, load average сравнивают с числом ядер. При четырёх ядрах нагрузка 4 означает, что каждое ядро работает, а ждать почти никому не приходится. Перегрузкой было бы число заметно больше четырёх, например 12.', 'No, the load average is compared with the number of cores. With four cores a load of 4 means every core works and almost nobody has to wait. An overload would be a number well above four, such as 12.') },
      { id: 'percent', text: W('Процессор загружен на 4 %', 'The CPU is 4 % busy'), why: W('Нет, load average считает не проценты, а среднее число задач, которые работают на процессоре или ждут его и диска. Проценты показывает колонка `%CPU` в `top`.', 'No, the load average counts not percent but the average number of tasks running on the CPU or waiting for it and for the disk. Percent is shown by the `%CPU` column in `top`.') },
    ],
    explain: W('Три числа показывают среднюю нагрузку за одну, пять и пятнадцать минут. Если они близки друг к другу, нагрузка ровная, а если первое заметно больше третьего, она растёт. В Linux в это число входят и процессы в состоянии `D`, которые ждут диска, поэтому при большой нагрузке смотрят в `top`, кто стоит в очереди.', 'The three numbers are the average load over one, five and fifteen minutes. When they are close, the load is steady, and when the first is clearly bigger than the third, it is growing. In Linux the number also includes processes in state `D` waiting for the disk, so with a high load you look in `top` at who is in the queue.'),
    refs: { lesson: 'linux.processes' },
  },
  // ── scripts ──
  {
    id: 'linux.q.args',
    kind: 'mcq',
    concepts: ['linux.script'],
    prompt: W('Скрипт запустили командой `./s.sh "a b" c`. Чему равно `$#`?', 'The script was started with `./s.sh "a b" c`. What does `$#` equal?'),
    options: [
      { id: '2', text: '2', correct: true },
      { id: '3', text: '3', why: W('Нет, кавычки сделали `a b` одним аргументом.', 'No, the quotes made `a b` one argument.') },
      { id: '1', text: '1', why: W('Нет, аргументов два: «a b» и «c».', 'No, there are two arguments: “a b” and “c”.') },
    ],
    explain: W('Запись `"$@"` передаст эти аргументы дальше так же, двумя словами, а `$*` без кавычек разбил бы первый аргумент на два.', '`"$@"` passes the arguments on the same way, as two words, while `$*` without quotes would split the first one in two.'),
  },
  {
    id: 'linux.q.test-spaces',
    kind: 'bugfind',
    concepts: ['linux.script'],
    prompt: W('Скрипт пишет `[-f: command not found`. Какая строка виновата?', 'The script says `[-f: command not found`. Which line is to blame?'),
    code: '#!/bin/bash\nf=/etc/app.conf\nif [-f "$f"]; then\n  echo found\nfi',
    bug: [3],
    why: {
      1: W('Строка shebang записана верно.', 'The shebang line is written correctly.'),
      2: W('Присваивание записано верно, без пробелов вокруг знака =.', 'The assignment is written correctly, without spaces around =.'),
      3: W('Квадратная скобка `[` сама работает как команда, и ей нужны пробелы: `[ -f "$f" ]`. Без пробела оболочка ищет программу с именем `[-f`.', '`[` is itself a command and needs spaces: `[ -f "$f" ]`. Without the space the shell looks for a program called `[-f`.'),
      4: W('Эта ветка записана верно.', 'This branch is written correctly.'),
    },
  },
  {
    id: 'linux.q.script-bug',
    kind: 'bugfind',
    concepts: ['linux.shebang', 'linux.script'],
    prompt: W('Команда `./deploy.sh` отвечает `bad interpreter: No such file or directory`. В какой строке ошибка?', '`./deploy.sh` answers `bad interpreter: No such file or directory`. Which line has the bug?'),
    code: '#!/bin/bsh\nset -e\necho deploying',
    bug: [1],
    why: {
      1: W('В строке shebang опечатка, и ядро ищет программу /bin/bsh, которой нет.', 'The shebang line has a typo, and the kernel looks for /bin/bsh, which does not exist.'),
      2: W('Строка `set -e` записана верно и полезна.', '`set -e` is written correctly and is useful.'),
      3: W('Это обычная команда, и она записана верно.', 'This is an ordinary command, written correctly.'),
    },
  },
  {
    id: 'linux.q.pipefail',
    kind: 'mcq',
    concepts: ['linux.script', 'linux.exit-code'],
    prompt: W('В скрипте стоит `set -euo pipefail`, а за ним `grep foo missing.txt | wc -l`, и файла missing.txt нет. Что произойдёт?', 'A script has `set -euo pipefail` and then `grep foo missing.txt | wc -l`, and missing.txt does not exist. What happens?'),
    options: [
      { id: 'stop', text: W('Из-за pipefail конвейер вернёт код 2, и флаг -e остановит скрипт', 'Because of pipefail the pipeline returns code 2, and -e stops the script'), correct: true },
      { id: 'zero', text: W('Команда wc напечатает 0, и скрипт пойдёт дальше', 'wc prints 0, and the script goes on'), why: W('Так было бы без pipefail, потому что тогда код конвейера равен коду последней команды wc, то есть нулю.', 'That would be so without pipefail, because then the pipeline’s code is that of the last command, wc, which is zero.') },
      { id: 'u', text: W('Скрипт остановится с ошибкой из-за флага -u', 'The script stops with an error because of -u'), why: W('Нет, флаг -u касается незаданных переменных, а здесь их нет.', 'No, -u is about unset variables, and there are none here.') },
    ],
  },
  // ── packages ──
  {
    id: 'linux.q.apt-update',
    kind: 'mcq',
    concepts: ['linux.repo', 'linux.package'],
    prompt: W('На только что созданной машине команда `sudo apt install jq` отвечает `Unable to locate package jq`. Почему?', 'On a freshly created machine `sudo apt install jq` answers `Unable to locate package jq`. Why?'),
    options: [
      { id: 'update', text: W('Список пакетов ещё не скачан, и сначала нужно выполнить apt update', 'The package list has not been downloaded yet, and apt update must run first'), correct: true },
      { id: 'name', text: W('Пакет называется иначе', 'The package has another name'), why: W('Нет, пакет так и называется jq, но машина пока не знает ни одного пакета.', 'No, the package is called jq, but the machine does not know any package yet.') },
      { id: 'sudo', text: W('У пользователя не хватает прав', 'The user lacks permissions'), why: W('Нет, при нехватке прав apt сообщил бы о файле блокировки, а не о том, что пакет не найден.', 'No, with missing permissions apt would report a lock file, not a missing package.') },
    ],
  },
  {
    id: 'linux.q.dpkg-S',
    kind: 'fill-command',
    concepts: ['linux.package'],
    prompt: W('Узнайте, какому пакету принадлежит файл `/usr/bin/tree`.', 'Find out which package the file `/usr/bin/tree` belongs to.'),
    template: 'dpkg ___ /usr/bin/tree',
    check: { stdout: /^tree: \/usr\/bin\/tree/ },
    misconceptions: [{ match: '-L', why: W('Нет, флаг -L делает обратное и перечисляет файлы пакета, а владельца файла ищет флаг -S.', 'No, -L does the opposite and lists a package’s files, while -S finds a file’s owner.') }],
  },
  // ── services ──
  {
    id: 'linux.q.enable',
    kind: 'multi',
    concepts: ['linux.systemd', 'linux.unit'],
    prompt: W('Что делает команда `systemctl enable web`? Отметьте все верные ответы.', 'What does `systemctl enable web` do? Tick every right answer.'),
    options: [
      { id: 'boot', text: W('Включает запуск службы при загрузке', 'It enables the service at boot'), correct: true },
      { id: 'link', text: W('Создаёт ссылку в каталоге multi-user.target.wants/', 'It creates a link in multi-user.target.wants/'), correct: true },
      { id: 'now', text: W('Запускает службу сейчас', 'It starts the service now'), why: W('Нет, сейчас служба запустится только с флагом `--now` или после отдельной команды `start`.', 'No, the service starts now only with `--now` or after a separate `start`.') },
      { id: 'reload', text: W('Перечитывает unit-файл', 'It rereads the unit file'), why: W('Нет, unit-файлы перечитывает команда `daemon-reload`.', 'No, `daemon-reload` rereads the unit files.') },
    ],
  },
  {
    id: 'linux.q.journal-echo',
    kind: 'mcq',
    concepts: ['linux.journal', 'linux.daemon'],
    prompt: W('Служба печатает строку командой `echo`. Где искать эту строку?', 'A service prints a line with `echo`. Where do you look for that line?'),
    options: [
      { id: 'journal', text: W('В журнале, командой journalctl -u <служба>', 'In the journal, with journalctl -u <service>'), correct: true },
      { id: 'tty', text: W('В терминале, из которого запускали systemctl start', 'In the terminal where systemctl start was run'), why: W('Нет, у службы нет терминала, и её вывод собирает systemd.', 'No, a service has no terminal, and systemd collects its output.') },
      { id: 'lost', text: W('Нигде, потому что вывод служб пропадает', 'Nowhere, because the output of services is lost'), why: W('Нет, по умолчанию стоит StandardOutput=journal, и весь вывод службы попадает в журнал.', 'No, the default is StandardOutput=journal, and all of a service’s output goes to the journal.') },
    ],
  },
  {
    id: 'linux.q.cron-when',
    kind: 'mcq',
    concepts: ['linux.cron'],
    prompt: W('Когда будет выполняться строка crontab `*/15 9-18 * * 1-5 /usr/local/bin/check`?', 'When does the crontab line `*/15 9-18 * * 1-5 /usr/local/bin/check` run?'),
    options: [
      { id: 'right', text: W('Каждые 15 минут с 9:00 до 18:45 по будним дням', 'Every 15 minutes from 9:00 to 18:45 on weekdays'), correct: true },
      { id: 'once', text: W('Один раз в день в 9:15', 'Once a day at 9:15'), why: W('Нет, запись `*/15` в поле минут означает «каждые 15 минут», а не «в 15 минут».', 'No, `*/15` in the minutes field means “every 15 minutes”, not “at minute 15”.') },
      { id: 'days', text: W('Каждый день с 1 по 5 число месяца', 'Every day from the 1st to the 5th of the month'), why: W('Нет, числа 1-5 стоят в пятом поле, которое задаёт дни недели, то есть с понедельника по пятницу.', 'No, 1-5 is in the fifth field, which sets the days of the week, Monday to Friday.') },
    ],
  },
  {
    id: 'linux.q.unit-bug',
    kind: 'bugfind',
    concepts: ['linux.unit'],
    prompt: W('Служба завершается с ошибкой, и в журнале написано `python3: can\'t open file \'/app.py\': [Errno 2] No such file or directory`. Какая строка unit-файла виновата?', 'The service fails, and the journal says `python3: can\'t open file \'/app.py\': [Errno 2] No such file or directory`. Which line of the unit file is to blame?'),
    code: '[Unit]\nDescription=Orders API\n\n[Service]\nExecStart=/usr/bin/python3 app.py\nUser=orders\n\n[Install]\nWantedBy=multi-user.target',
    lang: 'ini',
    bug: [5],
    why: {
      2: W('Описание службы ни на что не влияет.', 'The description affects nothing.'),
      5: W('Путь к файлу относительный, а systemd запускает службу из каталога `/`, а не из каталога приложения. Нужно указать полный путь к app.py или задать строку WorkingDirectory=.', 'The file path is relative, and systemd starts the service from `/`, not from the application’s directory. Give the full path to app.py or set WorkingDirectory=.'),
      6: W('Пользователь указан верно, и ошибка не связана с правами.', 'The user is right, and the error is not about permissions.'),
      9: W('Строка WantedBy отвечает за запуск при загрузке, а не за путь к файлу.', 'WantedBy is about starting at boot, not about the file path.'),
    },
  },
  {
    id: 'linux.q.restart-abnormal',
    kind: 'mcq',
    concepts: ['linux.systemd'],
    prompt: W('У службы стоит `Restart=on-abnormal`, а программа завершается с кодом 1. Перезапустит ли её systemd?', 'A service has `Restart=on-abnormal`, and the program exits with code 1. Will systemd restart it?'),
    options: [
      { id: 'no', text: W('Нет, потому что для on-abnormal выход с кодом считается обычным завершением', 'No, because for on-abnormal an exit with a code is an ordinary end'), correct: true },
      { id: 'yes', text: W('Да, потому что код не равен нулю и это сбой', 'Yes, because the code is not zero and that is a failure'), why: W('Так поступил бы on-failure, а on-abnormal реагирует только на сигналы, таймауты и срабатывание watchdog.', 'on-failure would do that, while on-abnormal reacts only to signals, timeouts and the watchdog.') },
    ],
    refs: { explainer: 'linux.restart' },
  },
  // ── disks ──
  {
    id: 'linux.q.uuid',
    kind: 'mcq',
    concepts: ['linux.mount', 'linux.block-device'],
    prompt: W('Почему в файле `/etc/fstab` диск лучше записывать как `UUID=…`, а не как `/dev/sdb1`?', 'Why is it better to write a disk in `/etc/fstab` as `UUID=…` rather than `/dev/sdb1`?'),
    options: [
      { id: 'names', text: W('Имена устройств меняются, когда подключают другой диск, а UUID принадлежит самой файловой системе', 'Device names change when another disk is attached, while a UUID belongs to the file system itself'), correct: true },
      { id: 'faster', text: W('Диск по UUID монтируется быстрее', 'A disk mounts faster by UUID'), why: W('Нет, скорость монтирования одинакова, а дело в надёжности.', 'No, mounting is equally fast; the point is reliability.') },
      { id: 'required', text: W('Файл fstab не понимает имён устройств', 'fstab does not understand device names'), why: W('Нет, fstab их понимает, но однажды такое имя может указать на другой диск.', 'No, fstab understands them, but one day such a name may point to another disk.') },
    ],
  },
  {
    id: 'linux.q.mount-hide',
    kind: 'mcq',
    concepts: ['linux.mount'],
    prompt: W('В каталоге `/data` лежали файлы, а потом туда смонтировали новый диск. Где теперь старые файлы?', '`/data` held files, and then a new disk was mounted there. Where are the old files now?'),
    options: [
      { id: 'hidden', text: W('Они скрыты под новой файловой системой и снова станут видны после umount', 'They are hidden under the new file system and become visible again after umount'), correct: true },
      { id: 'deleted', text: W('Они удалены', 'They are deleted'), why: W('Нет, монтирование ничего не удаляет, а только перекрывает содержимое каталога.', 'No, mounting deletes nothing; it only covers the directory’s contents.') },
      { id: 'moved', text: W('Они перенесены на новый диск', 'They were moved to the new disk'), why: W('Нет, никто их не копирует, и новый диск остаётся пустым.', 'No, nobody copies them, and the new disk stays empty.') },
    ],
  },
  {
    id: 'linux.q.df-du',
    kind: 'mcq',
    concepts: ['linux.inode'],
    prompt: W('Команда `df -h` показывает, что `/` заполнен на 100%, а `du -sh /*` в сумме насчитывает намного меньше. Чем это чаще всего объясняется?', '`df -h` shows `/` at 100%, while `du -sh /*` adds up to far less. What explains this most often?'),
    options: [
      { id: 'open', text: W('Удалённый файл всё ещё держит открытым какой-то процесс', 'Some process still holds a deleted file open'), correct: true },
      { id: 'bug', text: W('Команда df ошибается', 'df is wrong'), why: W('Нет, df считает занятые блоки, а du считает имена, и у удалённого открытого файла имени нет, а блоки он занимает.', 'No, df counts used blocks and du counts names, and a deleted open file has no name but still takes blocks.') },
      { id: 'hidden', text: W('Это скрытые файлы, имена которых начинаются с точки', 'These are hidden files whose names start with a dot'), why: W('Нет, du их считает, потому что обходит все имена, в том числе с точкой в начале.', 'No, du counts them, because it walks all names, those starting with a dot included.') },
    ],
    explain: W('Найти виновника помогает команда `lsof +L1`, а освобождает место перезапуск процесса.', '`lsof +L1` helps find the culprit, and restarting the process frees the space.'),
  },
  {
    id: 'linux.q.links',
    kind: 'match',
    concepts: ['linux.inode'],
    prompt: W('Исходный файл `a` удалили. Что стало со ссылками на него?', 'The original file `a` was deleted. What happened to the links to it?'),
    pairs: [
      { id: 'hard', left: W('жёсткая ссылка b', 'hard link b'), right: W('продолжает работать, потому что это второе имя того же inode', 'keeps working, because it is a second name of the same inode') },
      { id: 'soft', left: W('символическая ссылка c', 'symbolic link c'), right: W('ведёт в никуда, потому что в ней записан путь к a', 'leads nowhere, because it holds the path to a') },
    ],
  },
  // ── threads ──
  {
    id: 'linux.q.thread-task',
    kind: 'mcq',
    concepts: ['linux.thread', 'linux.procfs'],
    prompt: W('В каталоге `/proc/4120/task/` семь подкаталогов. Сколько потоков у процесса 4120?', '`/proc/4120/task/` has seven subdirectories. How many threads does process 4120 have?'),
    options: [
      { id: '7', text: W('Семь, считая главный поток', 'Seven, counting the main thread'), correct: true },
      { id: '6', text: W('Шесть, потому что главный поток не считается', 'Six, because the main thread does not count'), why: W('Нет, главный поток тоже считается потоком, и у него есть каталог с номером самого процесса.', 'No, the main thread counts as a thread too, and it has a directory with the process’s own number.') },
      { id: '1', text: W('Один, потому что у одного процесса один поток', 'One, because one process has one thread'), why: W('Нет, у процесса может быть много потоков, и все они делят его память.', 'No, a process can have many threads, and they all share its memory.') },
    ],
  },
  {
    id: 'linux.q.ps-proc',
    kind: 'mcq',
    concepts: ['linux.procfs'],
    prompt: W('Откуда команда `ps` берёт список процессов?', 'Where does `ps` get the list of processes?'),
    options: [
      { id: 'proc', text: W('Из каталога /proc', 'From the /proc directory'), correct: true },
      { id: 'log', text: W('Из журнала systemd', 'From the systemd journal'), why: W('Нет, журнал хранит сообщения о том, что происходило, а не текущий список процессов.', 'No, the journal keeps messages about what happened, not the current list of processes.') },
      { id: 'file', text: W('Из файла /var/run/processes', 'From the file /var/run/processes'), why: W('Нет, такого файла нет, а каталоги процессов в /proc ядро создаёт в тот момент, когда их читают.', 'No, there is no such file, and the kernel creates the process directories in /proc at the moment they are read.') },
    ],
  },
  // ── namespaces ──
  {
    id: 'linux.q.ns-number',
    kind: 'mcq',
    concepts: ['linux.namespace'],
    prompt: W('Команда `readlink /proc/412/ns/pid` выдаёт `pid:[4026532201]`, а `readlink /proc/1/ns/pid` выдаёт `pid:[4026531836]`. О чём это говорит?', '`readlink /proc/412/ns/pid` gives `pid:[4026532201]`, and `readlink /proc/1/ns/pid` gives `pid:[4026531836]`. What does that tell you?'),
    options: [
      { id: 'other', text: W('Процесс 412 находится в другом пространстве имён PID', 'Process 412 is in another PID namespace'), correct: true },
      { id: 'pid', text: W('Это номера процессов внутри пространства', 'These are the process numbers inside the namespace'), why: W('Нет, число в скобках означает номер самого пространства, то есть его inode, а не номер процесса.', 'No, the number in brackets is the number of the namespace itself, its inode, not a process number.') },
      { id: 'nothing', text: W('Ни о чём, потому что эти номера всегда разные', 'Nothing, because these numbers always differ'), why: W('Нет, у процессов одного пространства этот номер одинаковый.', 'No, processes of one namespace have the same number here.') },
    ],
  },
  {
    id: 'linux.q.mount-proc',
    kind: 'mcq',
    concepts: ['linux.namespace', 'linux.procfs'],
    prompt: W('Почему `ps` после `sudo unshare --pid --fork bash` без флага `--mount-proc` показывает все процессы машины?', 'Why does `ps` after `sudo unshare --pid --fork bash` without `--mount-proc` show every process of the machine?'),
    options: [
      { id: 'proc', text: W('Команда ps читает /proc, а смонтирован по-прежнему старый /proc машины', 'ps reads /proc, and the machine’s old /proc is still mounted'), correct: true },
      { id: 'broken', text: W('Пространство имён не создалось', 'The namespace was not created'), why: W('Нет, пространство создалось, и `echo $$` внутри напечатает 1.', 'No, it was created, and `echo $$` inside prints 1.') },
      { id: 'root', text: W('Пользователь root видит всё', 'root sees everything'), why: W('Нет, какие процессы видны, решает пространство имён, а не права пользователя.', 'No, which processes are visible is decided by the namespace, not by the user’s rights.') },
    ],
  },
  {
    id: 'linux.q.pid1-term',
    kind: 'mcq',
    concepts: ['linux.pid1', 'linux.signal'],
    prompt: W('Процесс `sleep 1000` стал первым процессом нового пространства PID. Почему `kill -TERM` с хоста его не останавливает, а `kill -KILL` останавливает?', '`sleep 1000` became the first process of a new PID namespace. Why does `kill -TERM` from the host not stop it, while `kill -KILL` does?'),
    options: [
      { id: 'right', text: W('Первому процессу пространства доставляются только сигналы, для которых есть обработчик, а KILL и STOP от процессов снаружи доставляются принудительно', 'The first process of a namespace receives only signals it has a handler for, while KILL and STOP from processes outside are delivered by force'), correct: true },
      { id: 'root', text: W('У программы sleep права root', 'sleep has root rights'), why: W('Нет, права здесь ни при чём, и дело в особых правилах для первого процесса.', 'No, rights have nothing to do with it; the point is the special rules for the first process.') },
      { id: 'busy', text: W('Программа sleep занята и не слышит сигнала', 'sleep is busy and does not hear the signal'), why: W('Нет, занятость процесса на доставку сигнала не влияет.', 'No, being busy does not affect signal delivery.') },
    ],
    explain: W('Поэтому первым процессом пространства запускают маленькие программы-посредники, которые передают сигнал TERM настоящей программе и забирают коды завершения её дочерних процессов. Самые известные из них называются `tini` и `dumb-init`. Другой путь состоит в том, чтобы сама программа обрабатывала TERM, например в Node.js строкой `process.on(\'SIGTERM\', …)`.', 'That is why small go-between programs are run as the first process of a namespace: they pass TERM on to the real program and collect the exit codes of its children. The best known are `tini` and `dumb-init`. The other way is to make the program handle TERM itself, for example in Node.js with `process.on(\'SIGTERM\', …)`.'),
  },
  // ── cgroups ──
  {
    id: 'linux.q.oom-events',
    kind: 'mcq',
    concepts: ['linux.cgroup', 'linux.oom'],
    prompt: W('В файле `memory.events` группы есть строка `oom_kill 3`. Что произошло?', 'A group’s `memory.events` has the line `oom_kill 3`. What happened?'),
    options: [
      { id: 'right', text: W('Ядро трижды завершало процесс группы, когда группа упиралась в лимит memory.max', 'The kernel three times ended a process of the group when the group hit memory.max'), correct: true },
      { id: 'limit', text: W('Лимит памяти группы равен трём', 'The group’s memory limit is three'), why: W('Нет, лимит хранится в файле memory.max, а в memory.events записаны счётчики событий.', 'No, the limit is in memory.max, while memory.events holds event counters.') },
      { id: 'machine', text: W('Машине трижды не хватило памяти', 'The machine ran out of memory three times'), why: W('Нет, это счётчик группы, и остальная машина могла ничего не заметить.', 'No, this is the group’s counter, and the rest of the machine may have noticed nothing.') },
    ],
  },
  {
    id: 'linux.q.oom-137',
    kind: 'predict-output',
    concepts: ['linux.oom', 'linux.cgroup'],
    prompt: W('Оболочка находится в группе с лимитом `memory.max = 16M`. Что выведет `echo $?` после команды `memhog 64`?', 'The shell is in a group with `memory.max = 16M`. What does `echo $?` print after `memhog 64`?'),
    setup: { script: ['mkdir /sys/fs/cgroup/q', 'echo 16M > /sys/fs/cgroup/q/memory.max'] },
    command: 'echo $$ | sudo tee /sys/fs/cgroup/q/cgroup.procs > /dev/null; memhog 64 > /dev/null 2>&1; echo $?',
    options: [
      { id: '137', text: '137', correct: true },
      { id: '1', text: '1', why: W('Нет, memhog не завершился сам: его завершили сигналом KILL, а это код 128 + 9.', 'No, memhog did not exit by itself: it was ended with KILL, which is code 128 + 9.') },
      { id: '0', text: '0', why: W('Нет, 64 МиБ не помещаются в 16, и ядро не даст процессу столько памяти.', 'No, 64 MiB do not fit into 16, and the kernel will not give the process that much memory.') },
    ],
  },
  {
    id: 'linux.q.cpu-max',
    kind: 'mcq',
    concepts: ['linux.cgroup'],
    prompt: W('Что означает запись `cpu.max = 50000 100000`?', 'What does `cpu.max = 50000 100000` mean?'),
    options: [
      { id: 'half', text: W('Группе достаётся 50 мс работы процессора из каждых 100 мс, то есть половина процессора', 'The group gets 50 ms of CPU out of every 100 ms, that is, half a CPU'), correct: true },
      { id: 'kill', text: W('Процесс завершат, если он займёт больше половины процессора', 'The process is ended if it takes more than half a CPU'), why: W('Нет, лимит процессора процесс не завершает, а только притормаживает.', 'No, a CPU limit does not end the process but only slows it down.') },
      { id: 'mhz', text: W('Частота процессора ограничена 50 МГц', 'The CPU frequency is limited to 50 MHz'), why: W('Нет, эти числа означают квоту и период в микросекундах, а не частоту.', 'No, these numbers are the quota and the period in microseconds, not a frequency.') },
    ],
  },
  {
    id: 'linux.q.global-oom',
    kind: 'mcq',
    concepts: ['linux.oom'],
    prompt: W('Лимитов нет, и ночной отчёт занял всю память машины. Какой процесс завершит ядро?', 'There are no limits, and the nightly report took all of the machine’s memory. Which process does the kernel end?'),
    options: [
      { id: 'biggest', text: W('Самый большой процесс машины, и им может оказаться база данных', 'The biggest process of the machine, which may be the database'), correct: true },
      { id: 'culprit', text: W('Обязательно процесс отчёта', 'The report process for sure'), why: W('Нет, ядро не знает, кто виноват, и выбирает процесс по размеру.', 'No, the kernel does not know who is to blame and picks a process by size.') },
      { id: 'newest', text: W('Самый новый процесс', 'The newest process'), why: W('Нет, возраст процесса не важен, а важен его размер.', 'No, a process’s age does not matter; its size does.') },
    ],
  },
  // ── capabilities ──
  {
    id: 'linux.q.dac',
    kind: 'mcq',
    concepts: ['linux.capability'],
    prompt: W('Почему root может прочитать чужой файл с режимом `600`?', 'Why can root read someone else’s file with mode `600`?'),
    options: [
      { id: 'cap', text: W('У процесса root есть привилегии CAP_DAC_OVERRIDE и CAP_DAC_READ_SEARCH, поэтому проверка прав для него пропускается', 'root’s process has CAP_DAC_OVERRIDE and CAP_DAC_READ_SEARCH, so the permission check is skipped for it'), correct: true },
      { id: 'owner', text: W('root владеет всеми файлами', 'root owns all files'), why: W('Нет, этот файл принадлежит другому пользователю, а root не становится владельцем, а только пропускает проверку.', 'No, the file belongs to another user, and root does not become the owner but only skips the check.') },
      { id: 'group', text: W('root состоит во всех группах', 'root is in every group'), why: W('Нет, группы здесь ни при чём, потому что режим 600 не даёт группе файла никаких прав.', 'No, groups have nothing to do with it, because mode 600 gives the file’s group no rights at all.') },
    ],
  },
  {
    id: 'linux.q.seccomp',
    kind: 'mcq',
    concepts: ['linux.seccomp'],
    prompt: W('В файле `/proc/PID/status` есть строка `Seccomp: 2`. Что это значит?', '`/proc/PID/status` has the line `Seccomp: 2`. What does it mean?'),
    options: [
      { id: 'filter', text: W('Процесс работает с включённым фильтром системных вызовов', 'The process runs with a system call filter switched on'), correct: true },
      { id: 'two', text: W('Процессу разрешены два системных вызова', 'The process is allowed two system calls'), why: W('Нет, число 2 обозначает режим «фильтр», а не число вызовов.', 'No, 2 is the “filter” mode, not a number of calls.') },
      { id: 'level', text: W('Это уровень безопасности 2 из 10', 'It is security level 2 of 10'), why: W('Нет, шкалы здесь нет: 0 означает, что фильтра нет, а 2 означает, что фильтр включён.', 'No, there is no scale: 0 means no filter, and 2 means the filter is on.') },
    ],
  },
  {
    id: 'linux.q.setcap-copy',
    kind: 'mcq',
    concepts: ['linux.capability'],
    prompt: W('Программе выдали привилегию командой `setcap cap_net_bind_service=+ep`, а потом скопировали её командой `cp`. Есть ли эта привилегия у копии?', 'A program was given a capability with `setcap cap_net_bind_service=+ep` and then copied with `cp`. Does the copy have the capability?'),
    options: [
      { id: 'no', text: W('Нет, потому что привилегия записана на исходный файл, а у копии другой inode', 'No, because the capability is written on the original file, and the copy has another inode'), correct: true },
      { id: 'yes', text: W('Есть, потому что cp копирует всё', 'It does, because cp copies everything'), why: W('Нет, обычный cp не переносит атрибуты файла, и setcap придётся выполнить заново.', 'No, a plain cp does not carry the file’s attributes over, and setcap has to be run again.') },
    ],
  },
  // ── rootfs ──
  {
    id: 'linux.q.chroot',
    kind: 'multi',
    concepts: ['linux.chroot'],
    prompt: W('Что изолирует chroot? Отметьте все верные ответы.', 'What does chroot isolate? Tick every right answer.'),
    options: [
      { id: 'files', text: W('Видимый корень дерева файлов', 'The visible root of the tree of files'), correct: true },
      { id: 'procs', text: W('Список процессов', 'The list of processes'), why: W('Нет, процессы остаются общими, и если смонтировать внутри /proc, ps покажет всю машину.', 'No, processes stay shared, and if you mount /proc inside, ps shows the whole machine.') },
      { id: 'net', text: W('Сеть', 'The network'), why: W('Нет, сеть остаётся той же, а для своей сети нужно пространство net.', 'No, the network stays the same, and an own network needs a net namespace.') },
      { id: 'host', text: W('Имя машины', 'The host name'), why: W('Нет, имя машины остаётся общим, а для своего имени нужно пространство uts.', 'No, the host name stays shared, and an own name needs a uts namespace.') },
    ],
  },
  {
    id: 'linux.q.whiteout',
    kind: 'mcq',
    concepts: ['linux.overlay'],
    prompt: W('В каталоге merged удалили файл, который лежал в нижнем слое. Что теперь лежит в upperdir?', 'A file from the lower layer was deleted in merged. What is in upperdir now?'),
    options: [
      { id: 'whiteout', text: W('Символьное устройство 0, 0 с тем же именем, которое называется whiteout, а в нижнем слое файл остался', 'A character device 0, 0 with the same name, called a whiteout, while the file stays in the lower layer'), correct: true },
      { id: 'nothing', text: W('Ничего, потому что файл удалён из нижнего слоя', 'Nothing, because the file was deleted from the lower layer'), why: W('Нет, нижние слои доступны только для чтения и никогда не меняются.', 'No, the lower layers are read-only and never change.') },
      { id: 'copy', text: W('Копия удалённого файла', 'A copy of the deleted file'), why: W('Нет, копия появляется при изменении файла (copy-up), а при удалении в верхнем слое остаётся метка.', 'No, a copy appears when the file is changed (copy-up), and on deletion a mark stays in the upper layer.') },
    ],
  },
  {
    id: 'linux.q.copyup',
    kind: 'order',
    concepts: ['linux.overlay'],
    prompt: W('Расставьте по порядку, что происходит при первой записи в файл из нижнего слоя.', 'Put in order what happens at the first write to a file from a lower layer.'),
    steps: [
      { id: 'find', text: W('Ядро находит файл в нижнем слое', 'The kernel finds the file in the lower layer') },
      { id: 'copy', text: W('Файл целиком копируется в верхний слой (copy-up)', 'The file is copied whole into the upper layer (copy-up)') },
      { id: 'write', text: W('Запись идёт в копию в верхнем слое', 'The write goes into the copy in the upper layer') },
      { id: 'see', text: W('Каталог merged показывает версию из верхнего слоя', 'merged shows the version from the upper layer') },
    ],
  },
  // ── ssh ──
  {
    id: 'linux.q.pubkey',
    kind: 'mcq',
    concepts: ['linux.ssh-key'],
    prompt: W('Какой файл вы копируете на сервер, `id_ed25519` или `id_ed25519.pub`?', 'Which file do you copy to the server, `id_ed25519` or `id_ed25519.pub`?'),
    options: [
      { id: 'pub', text: 'id_ed25519.pub', correct: true },
      { id: 'priv', text: 'id_ed25519', why: W('Нет, это закрытый ключ, и он никогда не покидает вашу машину, потому что тот, у кого он есть, может войти вместо вас.', 'No, this is the private key, and it never leaves your machine, because whoever has it can log in as you.') },
      { id: 'both', text: W('Оба файла', 'Both files'), why: W('Нет, серверу нужен только открытый ключ, которым он проверяет подпись, сделанную закрытым.', 'No, the server needs only the public key, with which it checks the signature made by the private one.') },
    ],
  },
  {
    id: 'linux.q.strictmodes',
    kind: 'mcq',
    concepts: ['linux.ssh-key', 'linux.mode'],
    prompt: W('Ключ правильный, а sshd пишет в журнал `Authentication refused: bad ownership or modes for file /home/deploy/.ssh/authorized_keys`. Что нужно исправить?', 'The key is right, but sshd logs `Authentication refused: bad ownership or modes for file /home/deploy/.ssh/authorized_keys`. What must be fixed?'),
    options: [
      { id: 'mode', text: W('Права и владельца: у файла должен быть режим 600, у каталога 700, и оба должны принадлежать deploy', 'The permissions and the owner: the file needs mode 600, the directory 700, and both must belong to deploy'), correct: true },
      { id: 'key', text: W('Создать новый ключ', 'Create a new key'), why: W('Нет, ключ в порядке, а sshd не доверяет файлу, который могут изменить другие пользователи.', 'No, the key is fine, and sshd does not trust a file other users can change.') },
      { id: 'open', text: W('Сделать authorized_keys доступным всем (режим 666)', 'Make authorized_keys open to everyone (mode 666)'), why: W('Нет, всё наоборот, потому что право записи для других пользователей и есть причина отказа.', 'No, it is the other way round: write access for other users is exactly the reason for the refusal.') },
    ],
  },
];
