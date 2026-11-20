// A hidden showcase block owned by the platform core: one lesson that uses
// every section kind, every quiz type, the doc ladder and the demo pipeline
// explainer. It is not on the route map (hidden: true) and lives at the end of
// the route order, so it never interferes with the concept order of real
// blocks. Open it at #/block/demo. The Linux block may delete this folder once
// it has its own pipeline lesson.

import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Block, Concept, Lesson, QuizItem, Sources, TerminalSetup } from '../../core/types';
import { fromModel } from '../../engine/explainer/render';
import { pipeModel } from './pipe';

const sources: Sources = {
  en: [
    { title: 'Bash Reference Manual — Pipelines', url: 'https://www.gnu.org/software/bash/manual/html_node/Pipelines.html' },
    { title: 'pipe(7) — Linux manual page', url: 'https://man7.org/linux/man-pages/man7/pipe.7.html' },
  ],
  ru: [
    { title: 'Конвейер (Unix) — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9A%D0%BE%D0%BD%D0%B2%D0%B5%D0%B9%D0%B5%D1%80_(Unix)' },
    { title: 'Стандартные потоки — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%A1%D1%82%D0%B0%D0%BD%D0%B4%D0%B0%D1%80%D1%82%D0%BD%D1%8B%D0%B5_%D0%BF%D0%BE%D1%82%D0%BE%D0%BA%D0%B8' },
  ],
};

const lab: TerminalSetup = {
  files: [
    { path: '/srv/demo/alpha.conf', content: 'listen 80;\n', owner: 'root', mode: '0644' },
    { path: '/srv/demo/beta.txt', content: 'notes\n', owner: 'root', mode: '0644' },
    { path: '/srv/demo/gamma.conf', content: 'listen 443;\n', owner: 'root', mode: '0644' },
  ],
};

const concepts: Concept[] = [
  {
    id: 'demo.pipe',
    term: bi('конвейер', 'pipeline'),
    short: bi('Цепочка программ, где вывод одной через буфер ядра становится входом следующей: `ls | grep conf`.', 'A chain of programs where the output of one becomes the input of the next through a kernel buffer: `ls | grep conf`.'),
    introducedIn: 'demo.pipeline',
    scan: false,
    docRef: { url: 'https://www.gnu.org/software/bash/manual/html_node/Pipelines.html', label: 'Bash manual › Pipelines' },
  },
  {
    id: 'demo.exit-code',
    term: bi('код завершения', 'exit code'),
    short: bi('Число, которое программа возвращает при выходе: 0 — успех, остальное — причина неудачи. Оболочка кладёт его в $?.', 'The number a program returns when it exits: 0 means success, anything else a reason for failure. The shell puts it into $?.'),
    introducedIn: 'demo.pipeline',
    scan: false,
  },
];

const quiz: QuizItem[] = [
  {
    id: 'demo.q.where',
    kind: 'mcq',
    concepts: ['demo.pipe'],
    prompt: bi('Где лежат данные, которые ls уже написал в трубу, а grep ещё не прочитал?', 'Where is the data that ls has written into the pipe but grep has not read yet?'),
    options: [
      { id: 'kernel', text: bi('В буфере в памяти ядра', 'In a buffer in kernel memory'), correct: true, why: bi('Труба — объект ядра: буфер и два конца.', 'A pipe is a kernel object: a buffer and two ends.') },
      { id: 'disk', text: bi('Во временном файле на диске', 'In a temporary file on disk'), why: bi('На диск ничего не пишется: поэтому конвейер работает и на машине без свободного места.', 'Nothing goes to disk: that is why a pipeline works even on a machine with a full disk.') },
      { id: 'ls', text: bi('В памяти процесса ls', 'In the memory of the ls process'), why: bi('После write() данные уже у ядра: ls может даже завершиться, а grep всё равно их прочитает.', 'After write() the data belongs to the kernel: ls may even exit and grep still reads it.') },
      { id: 'tty', text: bi('В терминале', 'In the terminal'), why: bi('В терминал пишет только grep — и только найденные строки.', 'Only grep writes to the terminal, and only the matching lines.') },
    ],
    explain: bi('Полный буфер усыпляет писателя, пустой — читателя; так две программы сами подстраиваются друг под друга.', 'A full buffer puts the writer to sleep, an empty one the reader; that is how two programs pace each other.'),
    refs: { explainer: 'demo.pipe' },
  },
  {
    id: 'demo.q.shell',
    kind: 'multi',
    concepts: ['demo.pipe'],
    prompt: bi('Что делает оболочка, когда видит в строке `|`? Отметьте всё верное.', 'What does the shell do when it sees `|` in a line? Mark everything that is true.'),
    options: [
      { id: 'pipe', text: bi('Просит ядро создать трубу', 'Asks the kernel to create a pipe'), correct: true },
      { id: 'both', text: bi('Запускает обе программы одновременно', 'Starts both programs at the same time'), correct: true },
      { id: 'seq', text: bi('Ждёт, пока закончится ls, и только потом запускает grep', 'Waits for ls to finish and only then starts grep'), why: bi('Программы работают одновременно: grep начинает читать, пока ls ещё пишет.', 'The programs run at the same time: grep starts reading while ls is still writing.') },
      { id: 'tmp', text: bi('Сохраняет вывод ls во временный файл', 'Saves the output of ls to a temporary file'), why: bi('Временного файла нет — есть буфер в ядре.', 'There is no temporary file — there is a buffer in the kernel.') },
    ],
  },
  {
    id: 'demo.q.order',
    kind: 'order',
    concepts: ['demo.pipe'],
    prompt: bi('Расставьте шаги конвейера `ls | grep conf` по порядку.', 'Put the steps of the pipeline `ls | grep conf` in order.'),
    steps: [
      { id: 'parse', text: bi('Оболочка разбирает строку и находит |', 'The shell parses the line and finds |') },
      { id: 'pipe', text: bi('Оболочка создаёт трубу (pipe2)', 'The shell creates a pipe (pipe2)'), why: bi('Трубу нужно создать до запуска программ: обе должны получить её концы при fork.', 'The pipe must exist before the programs start: both inherit its ends at fork.') },
      { id: 'fork', text: bi('Запускаются ls и grep', 'ls and grep start') },
      { id: 'flow', text: bi('ls пишет, grep читает', 'ls writes, grep reads') },
      { id: 'eof', text: bi('ls выходит, grep получает конец данных', 'ls exits, grep gets end of data'), why: bi('grep узнаёт, что данных больше не будет, только когда закрыт последний конец для записи.', 'grep learns there will be no more data only when the last write end is closed.') },
      { id: 'wait', text: bi('Оболочка ждёт обе программы и ставит $?', 'The shell waits for both programs and sets $?') },
    ],
  },
  {
    id: 'demo.q.fds',
    kind: 'match',
    concepts: ['demo.pipe'],
    prompt: bi('Сопоставьте номер дескриптора и его имя.', 'Match the descriptor number with its name.'),
    pairs: [
      { id: 'fd0', left: 'fd 0', right: 'stdin', why: bi('0 — вход: отсюда читает grep в конвейере.', '0 is input: grep reads from it in a pipeline.') },
      { id: 'fd1', left: 'fd 1', right: 'stdout', why: bi('1 — обычный вывод: его оболочка подключает к трубе.', '1 is normal output: the shell connects it to the pipe.') },
      { id: 'fd2', left: 'fd 2', right: 'stderr', why: bi('2 — ошибки: в трубу по умолчанию не идут, поэтому видны в терминале.', '2 is errors: by default they do not go into the pipe, so you see them in the terminal.') },
    ],
  },
  {
    id: 'demo.q.fill',
    kind: 'fill-command',
    concepts: ['demo.pipe'],
    prompt: bi('Допишите символ, чтобы увидеть только имена с «conf».', 'Fill in the character to see only the names with “conf”.'),
    template: 'ls /srv/demo ___ grep conf',
    setup: lab,
    check: { stdout: /^alpha\.conf\ngamma\.conf\n?$/ },
    misconceptions: [{ match: 'ls /srv/demo > grep', why: bi('`>` пишет вывод в файл с именем grep, а не передаёт его программе.', '`>` writes the output into a file named grep instead of passing it to the program.') }],
  },
  {
    id: 'demo.q.predict',
    kind: 'predict-output',
    concepts: ['demo.pipe'],
    prompt: bi('Что напечатает эта строка?', 'What will this line print?'),
    command: 'echo one two three | grep -c two',
    explain: bi('echo печатает одну строку; `grep -c` считает строки с совпадением, а не слова.', 'echo prints one line; `grep -c` counts matching lines, not words.'),
  },
  {
    id: 'demo.q.bug',
    kind: 'bugfind',
    concepts: ['demo.pipe'],
    prompt: bi('Скрипт должен показать строки с error из журнала, но не показывает ничего. Где ошибка?', 'The script should show the lines with error from a log but shows nothing. Where is the bug?'),
    code: '#!/bin/bash\ncat /var/log/app.log > grep error\necho "done: $?"',
    bug: [2],
    why: {
      1: bi('Это нормальная первая строка скрипта: какой интерпретатор его запускает.', 'That is a normal first line of a script: which interpreter runs it.'),
      2: bi('`>` вместо `|`: вывод cat ушёл в файл с именем grep, а слово error стало ещё одним файлом для cat.', '`>` instead of `|`: the output of cat went into a file named grep, and the word error became another file for cat.'),
      3: bi('Строка верная: $? покажет код предыдущей команды.', 'This line is fine: $? shows the code of the previous command.'),
    },
  },
  {
    id: 'demo.q.label',
    kind: 'label',
    concepts: ['demo.pipe'],
    prompt: bi('Подпишите части конвейера.', 'Label the parts of the pipeline.'),
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
      { id: 'writer', text: bi('ls — писатель', 'ls — the writer') },
      { id: 'pipe', text: bi('буфер в ядре', 'kernel buffer') },
      { id: 'reader', text: bi('grep — читатель', 'grep — the reader') },
      { id: 'file', text: bi('файл на диске', 'a file on disk'), why: bi('Между программами нет файла: только буфер в памяти ядра.', 'There is no file between the programs: only a buffer in kernel memory.') },
    ],
  },
];

const lesson: Lesson = {
  id: 'demo.pipeline',
  block: 'demo',
  title: bi('Конвейер: вывод одной программы — вход другой', 'Pipelines: the output of one program is the input of another'),
  summary: bi('Витрина движка: все виды экранов урока на одном примере.', 'A showcase of the engine: every kind of lesson screen on one example.'),
  introduces: ['demo.pipe', 'demo.exit-code'],
  uses: [],
  tier: 'core',
  minutes: 25,
  sources,
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Тимлид пишет в чат: «Гляньте, какие конфиги лежат в `/srv/demo`, только без лишнего». В каталоге сотня файлов, а нужны три. Можно листать глазами — а можно попросить одну программу перечислить имена, а другую — оставить только нужные.',
        'Your team lead writes in the chat: “Check which configs are in `/srv/demo`, nothing else.” The directory holds a hundred files and you need three. You could scroll through them — or ask one program to list the names and another to keep only the ones you need.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'demo.pipe', caption: bi('Пройдите шаги стрелками или пробелом; нажмите на любой элемент.', 'Step through with the arrow keys or space; click any element.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Что произошло', 'What happened'),
      body: bi(
        'Символ `|` превращает две команды в [[demo.pipe|конвейер]]. Оболочка просит ядро создать трубу — буфер с двумя концами — и запускает обе программы одновременно: у `ls` дескриптор 1 смотрит в конец для записи, у `grep` дескриптор 0 — в конец для чтения. Ни одна из программ об этом не знает: `ls` просто печатает, `grep` просто читает.\n\nКогда буфер полон, ядро усыпляет писателя; когда пуст — читателя. Поэтому быстрый `ls` и медленный `grep` сами подстраиваются друг под друга, и память не кончается, сколько бы имён ни было.\n\nВ конце оболочка ждёт обе программы и кладёт в `$?` [[demo.exit-code|код завершения]] последней. Если `grep` ничего не нашёл, `$?` будет 1, хотя `ls` отработал успешно.',
        'The `|` character turns two commands into a [[demo.pipe|pipeline]]. The shell asks the kernel for a pipe — a buffer with two ends — and starts both programs at once: descriptor 1 of `ls` points to the write end, descriptor 0 of `grep` to the read end. Neither program knows: `ls` just prints, `grep` just reads.\n\nWhen the buffer is full, the kernel puts the writer to sleep; when it is empty, the reader. So a fast `ls` and a slow `grep` pace each other, and memory never runs out however many names there are.\n\nAt the end the shell waits for both programs and puts the [[demo.exit-code|exit code]] of the last one into `$?`. If `grep` found nothing, `$?` is 1 even though `ls` succeeded.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab,
      intro: bi('Машина в симуляторе: можно ломать, «Сбросить машину» вернёт её к началу.', 'A machine in the simulator: break it freely, “Reset this screen” brings it back.'),
      tasks: [
        {
          id: 'mkdir',
          prompt: bi('Создайте каталог `~/logs` и пустой файл `~/logs/app.log`.', 'Create the directory `~/logs` and an empty file `~/logs/app.log`.'),
          check: {
            when: "files['/home/learner/logs/app.log'].type=f",
            fail: [{ if: "files['/home/learner/logs'].type=d && !files['/home/learner/logs/app.log']", say: bi('Каталог уже есть, а файла в нём нет: его создаёт `touch`.', 'The directory exists, but the file is not there yet: `touch` creates it.') }],
          },
          chips: 'mkdir -p ~/logs && touch ~/logs/app.log',
          docRef: { page: 'man/mkdir.1', anchor: 'OPTIONS', line: '--parents' },
          hints: {
            H1: bi('Здесь две вещи: каталог и файл. Их создают разные команды.', 'There are two things here: a directory and a file. Different commands create them.'),
            H2: bi('Каталог — `mkdir`, пустой файл — `touch`. Их можно соединить `&&`.', 'A directory is `mkdir`, an empty file is `touch`. You can join them with `&&`.'),
            H3: bi('`mkdir ~/logs`, затем `touch ~/logs/app.log`.', '`mkdir ~/logs`, then `touch ~/logs/app.log`.'),
          },
        },
        {
          id: 'filter',
          prompt: bi('Покажите из `/srv/demo` только имена, в которых есть `conf`.', 'Show only the names in `/srv/demo` that contain `conf`.'),
          check: {
            when: "term['main'][last].exit=0",
            stdout: /^alpha\.conf\ngamma\.conf\n?$/,
            fail: [{ if: "term['main'][last].out~'beta.txt'", say: bi('В выводе остался `beta.txt`: имена нужно пропустить через фильтр.', '`beta.txt` is still in the output: the names have to go through a filter.') }],
          },
          chips: 'ls /srv/demo | grep conf',
          concepts: ['demo.pipe'],
          docRef: { page: 'man/grep.1', anchor: 'DESCRIPTION', line: 'prints each line' },
          hints: { H1: bi('Одна программа перечисляет имена, другая оставляет нужные.', 'One program lists the names, another keeps the ones you need.'), H2: bi('Соедините `ls` и `grep` символом `|`.', 'Join `ls` and `grep` with `|`.') },
        },
        {
          id: 'status',
          prompt: bi('Запустите конвейер, в котором `grep` ничего не найдёт, — так, чтобы его код завершения был 1.', 'Run a pipeline in which `grep` finds nothing, so that its exit code is 1.'),
          check: { when: "term['main'][last].exit=1 && term['main'][last].out=''" },
          chips: 'ls /srv/demo | grep nothing',
          concepts: ['demo.exit-code'],
          docRef: { page: 'man/grep.1', anchor: 'EXIT STATUS', line: '1 if no lines' },
          hints: { H1: bi('Ищите то, чего в именах точно нет.', 'Search for something that is certainly not in the names.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Страница руководства делится на разделы. В каком разделе `ls(1)` перечислены флаги? Нажмите на него.', 'A manual page is divided into sections. In which section of `ls(1)` are the flags listed? Click it.'),
      ref: { page: 'man/ls.1' },
      answer: 'OPTIONS',
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите в `ls(1)` флаг, который показывает номер inode, и выведите номер inode файла `/srv/demo/alpha.conf`.', 'Find the `ls(1)` flag that shows the inode number and print the inode number of `/srv/demo/alpha.conf`.'),
      ref: { page: 'man/ls.1', anchor: 'OPTIONS', line: '--inode' },
      terminal: {
        setup: lab,
        task: {
          id: 'inode',
          prompt: bi('Выведите номер inode файла `/srv/demo/alpha.conf`.', 'Print the inode number of `/srv/demo/alpha.conf`.'),
          check: { stdout: /\b\d+ (\/srv\/demo\/)?alpha\.conf\b/ },
          docStep: 3,
          chips: 'ls -i /srv/demo/alpha.conf',
          hints: { H1: bi('Номер inode — это свойство, которое показывает `ls` с нужным флагом.', 'The inode number is something `ls` shows with the right flag.'), H2: bi('Откройте раздел OPTIONS и ищите слово inode.', 'Open the OPTIONS section and look for the word inode.') },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Посчитайте одной строкой, сколько имён в `/srv/demo` содержат `conf`: на экран должно попасть одно число.', 'With one line, count how many names in `/srv/demo` contain `conf`: a single number must reach the screen.'),
      ref: { page: 'man/grep.1' },
      terminal: {
        setup: lab,
        task: {
          id: 'count',
          prompt: bi('Выведите только число имён с `conf`.', 'Print only the number of names with `conf`.'),
          check: { stdout: /^2\n?$/ },
          docStep: 4,
          beyond: true,
          solutionTokens: ['-c', '--count', 'wc'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: quiz.map((q) => q.id) },
    {
      id: 'note',
      kind: 'callout',
      tone: 'note',
      step: 'review',
      body: bi('Ошибки (`stderr`, дескриптор 2) в трубу по умолчанию не попадают — поэтому сообщение об ошибке видно, даже когда вывод отфильтрован.', 'Errors (`stderr`, descriptor 2) do not go into the pipe by default — that is why you see an error message even when the output is filtered.'),
    },
  ],
};

const block: Block = {
  id: 'demo',
  order: 900,
  hidden: true,
  title: bi('Витрина движка', 'Engine showcase'),
  summary: bi('Скрытый блок ядра платформы: один урок со всеми видами экранов. Для разработчиков и проверки.', 'A hidden block of the platform core: one lesson with every kind of screen. For builders and QA.'),
  checklistStep: null,
  levels: {
    beginner: bi('Терминал видите впервые', 'First time in a terminal'),
    intermediate: bi('Запускал команды по инструкции', 'Has run commands from instructions'),
    experienced: bi('Пишет конвейеры не задумываясь', 'Writes pipelines without thinking'),
  },
  hours: { beginner: 1, intermediate: 0.5, experienced: 0.3 },
  lessons: ['demo.pipeline'],
  sources,
  docSources: ['man', 'help'],
  placement: [
    { id: 'demo.place.1', level: 'intermediate', key: true, concepts: ['demo.pipe'], kind: 'quiz', item: { ...(quiz[0] as QuizItem), id: 'demo.place.q1' } },
    {
      id: 'demo.place.2',
      level: 'intermediate',
      key: true,
      concepts: ['demo.pipe'],
      kind: 'task',
      setup: lab,
      task: { id: 'p2', prompt: bi('Покажите из `/srv/demo` только имена с `conf`.', 'Show only the names in `/srv/demo` with `conf`.'), check: { stdout: /^alpha\.conf\ngamma\.conf\n?$/ } },
    },
  ],
};

export default defineModule({
  blocks: [block],
  lessons: [lesson],
  concepts,
  quiz,
  explainers: [fromModel(pipeModel)],
});
