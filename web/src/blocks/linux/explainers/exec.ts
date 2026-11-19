// X2 «What happens when you press Enter»: words, PATH lookup, fork, the
// redirection done by the child, exec, wait, $? (02 §6.6 X2). The form of the
// command (a program, cd, exec, &) and the PATH are knobs; breaks remove the
// x bit, deny the redirection target and make the parent forget to wait.
//
// Reading order: at the start there are only the typed line and the shell.
// PATH, the copy of the shell, the file and the terminal appear when the run
// reaches them, and every acting block says in a callout what it is doing.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementState, Step } from '../../../core/types';

type P = { form: string; path: string };

const man = (name: string, sec: number) => ({ url: `https://man7.org/linux/man-pages/man${sec}/${name}.${sec}.html`, label: `${name}(${sec})` });

const PATHS: Record<string, { dirs: string[]; found: string | null }> = {
  default: { dirs: ['/usr/local/bin', '/usr/bin', '/bin'], found: '/usr/bin/ls' },
  mine: { dirs: ['/home/anna/bin', '/usr/local/bin', '/usr/bin'], found: '/home/anna/bin/ls' },
  broken: { dirs: ['/opt/tools/bin'], found: null },
};

export interface ExecRun {
  forks: number;
  execs: number;
  status: number;
  checked: number;
}

/** The arithmetic of the run, for tests: how many directories were checked, what happened. */
export function execNumbers(p: P, broken: ReadonlySet<string>): ExecRun {
  if (p.form === 'cd') return { forks: 0, execs: 0, status: 0, checked: 0 };
  const path = PATHS[p.path] ?? PATHS.default;
  const checked = path.found ? path.dirs.findIndex((d) => path.found!.startsWith(d + '/')) + 1 : path.dirs.length;
  if (!path.found) return { forks: 0, execs: 0, status: 127, checked };
  const forks = p.form === 'exec' ? 0 : 1;
  if (broken.has('redirect')) return { forks, execs: 0, status: 1, checked };
  if (broken.has('no-x')) return { forks, execs: 0, status: 126, checked };
  return { forks, execs: 1, status: 0, checked };
}

const ALL = ['line', 'bash', 'path', 'child', 'file', 'tty', 'kernel', 'e-words', 'e-lookup', 'e-fork', 'e-redirect', 'e-exec', 'e-wait', 'e-prompt'];
const startWith = (...shown: string[]): Record<string, ElementState> => Object.fromEntries(ALL.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

export const execModel = defineModel<P>({
  id: 'linux.exec',
  block: 'linux',
  title: bi('Что происходит, когда вы нажимаете Enter', 'What happens when you press Enter'),
  summary: bi(
    'Вы набрали `ls -l /etc > list.txt` и нажали Enter. Оболочка делит строку на слова, ищет программу по списку каталогов PATH и создаёт копию самой себя. Копия направляет вывод в файл и превращается в программу `ls`, а оболочка тем временем ждёт, с каким кодом программа завершится.',
    'You typed `ls -l /etc > list.txt` and pressed Enter. The shell splits the line into words, looks the program up in the PATH directories and makes a copy of itself. The copy sends the output into the file and turns into the program `ls`, while the shell waits for the code the program ends with.',
  ),
  intro: bi(
    'Сейчас на схеме только набранная строка и оболочка, а остальные участники появятся тогда, когда до них дойдёт очередь. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко рядом с подсвеченным блоком говорит, что этот блок делает, а карточка на линии показывает, что он передаёт дальше.\n\nКогда пройдёте до приглашения, выберите в «Параметрах» команду `cd /tmp` или другой PATH и пройдите путь ещё раз.',
    'Now the diagram shows only the typed line and the shell; the others appear when their turn comes. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout next to the highlighted block says what it does, and the card on the line shows what it hands on.\n\nOnce you reach the prompt, choose `cd /tmp` or another PATH in “Parameters” and walk the path again.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('что передаётся дальше: имя программы, системный вызов, код завершения', 'what is handed on: the program name, a system call, the exit code') },
    { mark: 'icon:process', text: bi('процесс, то есть оболочка или её копия', 'a process: the shell or its copy') },
    { mark: 'icon:file', text: bi('файл, в который уходит вывод', 'the file the output goes to') },
    { mark: 'dashed', text: bi('код завершения возвращается оболочке', 'the exit code goes back to the shell') },
    { mark: 'ok', text: bi('этап пройден', 'stage passed') },
    { mark: 'err', text: bi('здесь запуск остановился', 'the start stopped here') },
  ],
  stopLabel: bi('Запуск остановился', 'The start stopped'),
  concepts: ['linux.fork-exec', 'linux.path-var', 'linux.exit-code'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      {
        id: 'line',
        label: bi('Набранная строка', 'The typed line'),
        icon: 'terminal',
        sub: 'ls · -l · /etc · > list.txt',
        family: 'user',
        x: 24,
        y: 24,
        w: 280,
        h: 64,
        card: {
          what: bi('Строка, которую вы напечатали в терминале. Оболочка делит её на слова по пробелам: первое слово становится именем команды, остальные становятся аргументами, а перенаправление `> list.txt` оболочка забирает себе, и программа его даже не увидит.', 'The line you typed in the terminal. The shell splits it into words at the spaces: the first word becomes the command name, the others become arguments, and the redirection `> list.txt` the shell keeps for itself, so the program never sees it.'),
          who: bi('Строку набираете вы, а читает её оболочка, когда вы нажимаете Enter.', 'You type the line, and the shell reads it when you press Enter.'),
          see: 'history 1',
          doc: { page: 'man/bash.1', anchor: 'REDIRECTION' },
        },
      },
      {
        id: 'bash',
        label: bi('Оболочка bash', 'The bash shell'),
        icon: 'process',
        work: 'dots',
        sub: 'PID 2210',
        family: 'process',
        x: 24,
        y: 200,
        w: 220,
        h: 64,
        card: {
          what: bi('Процесс оболочки, в котором вы работаете. Оболочка читает строку, подставляет вместо `~`, `$VAR` и `*` их значения, ищет программу и запускает её. Встроенные команды, например `cd` и `export`, оболочка выполняет сама и нового процесса для них не создаёт.', 'The shell process you work in. It reads the line, replaces `~`, `$VAR` and `*` with their values, finds the program and starts it. Builtins such as `cd` and `export` the shell runs itself, without creating a new process.'),
          who: bi('Оболочку запускает система, когда вы входите на машину или открываете терминал.', 'The system starts the shell when you log in or open a terminal.'),
          see: 'echo $$',
          doc: { page: 'man/bash.1', anchor: 'DESCRIPTION' },
        },
      },
      {
        id: 'path',
        label: bi('Список каталогов PATH', 'The PATH list'),
        icon: 'folder',
        work: 'spin',
        sub: '/usr/local/bin:/usr/bin:/bin',
        family: 'neutral',
        x: 420,
        y: 24,
        w: 290,
        h: 64,
        card: {
          what: bi('Переменная окружения, в которой через двоеточие перечислены каталоги с программами. Оболочка проверяет их по очереди и запускает первую найденную программу с нужным именем. Текущего каталога в этом списке нет, поэтому программу из него запускают как `./prog`.', 'An environment variable that lists program directories separated by colons. The shell checks them in order and runs the first program with the right name it finds. The current directory is not on the list, which is why a program from it is started as `./prog`.'),
          who: bi('Список задаётся при входе в систему в файлах /etc/profile и ~/.profile, а поменять его можно командой `export PATH=…`.', 'The list is set at login in /etc/profile and ~/.profile, and you change it with `export PATH=…`.'),
          see: 'echo $PATH; type -a ls',
          doc: { page: 'man/bash.1', anchor: 'DESCRIPTION' },
        },
      },
      {
        id: 'child',
        label: bi('Копия оболочки', 'The copy of the shell'),
        icon: 'process',
        work: 'pulse',
        sub: 'PID 2231',
        family: 'process',
        x: 380,
        y: 200,
        w: 240,
        h: 64,
        card: {
          what: bi('Новый процесс, который получается точной копией оболочки: у него те же переменные окружения и те же открытые файлы с номерами 0, 1 и 2. Сначала копия настраивает перенаправления, а потом загружает в себя нужную программу, и номер процесса при этом не меняется.', 'A new process that is an exact copy of the shell: it has the same environment variables and the same open files 0, 1 and 2. The copy first sets up the redirections and then loads the right program into itself, and the process number does not change.'),
          who: bi('Копию создаёт ядро, когда оболочка делает системный вызов fork. В современном Linux этот вызов называется clone.', 'The kernel creates the copy when the shell makes the fork system call. In modern Linux that call is named clone.'),
          see: 'ps -o pid,ppid,comm',
          doc: man('fork', 2),
        },
      },
      {
        id: 'file',
        label: 'list.txt',
        icon: 'file',
        sub: '0 B',
        family: 'store',
        x: 740,
        y: 200,
        w: 196,
        h: 64,
        card: {
          what: bi('Файл, в который попадёт вывод программы. Копия оболочки открывает и очищает его ещё до запуска программы, поэтому `ls` пишет в этот файл, хотя сама думает, что пишет на экран.', 'The file the program’s output goes to. The copy of the shell opens and empties it before the program starts, so `ls` writes into the file while it thinks it writes to the screen.'),
          who: bi('Файл создаётся перенаправлением `>`, а если он уже был, его прежнее содержимое стирается.', 'The `>` redirection creates the file, and if it already existed, its old contents are erased.'),
          see: 'ls -l list.txt',
        },
      },
      {
        id: 'tty',
        label: bi('Терминал', 'The terminal'),
        icon: 'terminal',
        sub: '/dev/pts/0',
        family: 'user',
        x: 740,
        y: 24,
        w: 196,
        h: 64,
        card: {
          what: bi('Устройство, к которому по умолчанию подключены потоки 0, 1 и 2 оболочки и всех её копий. Через него вы печатаете команды и читаете ответы на экране.', 'The device that streams 0, 1 and 2 of the shell and all its copies are connected to by default. Through it you type commands and read the answers on the screen.'),
          who: bi('Терминал создаётся, когда вы открываете окно терминала или входите на машину по сети.', 'The terminal is created when you open a terminal window or log in to the machine over the network.'),
          see: 'tty; ls -l /proc/$$/fd',
        },
      },
      {
        id: 'kernel',
        label: bi('Ядро Linux', 'The Linux kernel'),
        family: 'kernel',
        shape: 'bar',
        x: 16,
        y: 410,
        w: 928,
        h: 84,
        card: {
          what: bi('Всё, что вы видите на схеме, ядро выполняет по просьбам процессов, а такие просьбы называются системными вызовами. Вызов `clone` создаёт процесс, `execve` загружает в процесс программу, а `wait4` отдаёт родителю код завершения.', 'The kernel does everything you see in the diagram at the request of processes, and such requests are called system calls. `clone` creates a process, `execve` loads a program into a process, and `wait4` hands the exit code to the parent.'),
          who: bi('Ядро загружается при включении машины, и на машине оно одно.', 'The kernel is loaded when the machine powers on, and there is one per machine.'),
          see: 'uname -r',
          doc: man('syscalls', 2),
        },
      },
    ],
    edges: [
      { id: 'e-words', from: 'line', to: 'bash', label: bi('разбор на слова', 'splitting into words'), labelAt: 0.15, card: { what: bi('Оболочка разбирает строку на слова, кавычки, переменные, шаблоны и перенаправления. Шаблоны вроде `*.log` раскрывает сама оболочка, а не команда.', 'The shell parses the line into words, quotes, variables, patterns and redirections. Patterns like `*.log` are expanded by the shell itself, not by the command.'), who: bi('Разбор выполняет оболочка bash.', 'The bash shell does the parsing.'), doc: { page: 'man/bash.1', anchor: 'DESCRIPTION' } } },
      { id: 'e-lookup', from: 'bash', to: 'path', via: [[352, 232], [352, 56]], label: bi('поиск по PATH', 'PATH lookup'), labelAt: 0.8, card: { what: bi('Для имени без знака `/` оболочка перебирает каталоги PATH. Если программа нашлась, оболочка запоминает её полный путь, а если нет, печатает `command not found`, возвращает код 127 и даже не создаёт процесс.', 'For a name without `/` the shell goes through the PATH directories. If the program is found, the shell remembers its full path; if not, it prints `command not found`, returns code 127 and does not even create a process.'), who: bi('Поиск выполняет оболочка bash.', 'The bash shell does the lookup.'), see: 'type ls' } },
      { id: 'e-fork', from: 'bash', to: 'child', label: bi('создание копии (fork)', 'making a copy (fork)'), card: { what: bi('Ядро создаёт копию оболочки, новый процесс с новым номером, родителем которого становится сама оболочка с номером 2210.', 'The kernel creates a copy of the shell, a new process with a new number whose parent is the shell itself, number 2210.'), who: bi('Копию создаёт ядро по вызову clone.', 'The kernel creates it on the clone call.'), doc: man('fork', 2) } },
      { id: 'e-redirect', from: 'child', to: 'file', label: bi('вывод в файл', 'output to the file'), card: { what: bi('Копия закрывает свой поток 1, который был подключён к терминалу, и открывает на его месте файл. Это происходит до запуска программы, поэтому программа получает уже подключённый к файлу поток.', 'The copy closes its stream 1, which was connected to the terminal, and opens the file in its place. This happens before the program starts, so the program receives a stream already connected to the file.'), who: bi('Перенаправление выполняет копия оболочки вызовами open и dup2.', 'The copy of the shell does the redirection with the open and dup2 calls.'), doc: { page: 'man/bash.1', anchor: 'REDIRECTION' } } },
      { id: 'e-exec', from: 'child', to: 'kernel', via: [[500, 360]], label: bi('загрузка программы (exec)', 'loading the program (exec)'), labelAt: 0.6, card: { what: bi('Копия просит ядро заменить её программу на `/usr/bin/ls`. Ядро стирает память копии и загружает новую программу, но номер процесса и открытые файлы остаются прежними.', 'The copy asks the kernel to replace its program with `/usr/bin/ls`. The kernel wipes the copy’s memory and loads the new program, but the process number and the open files stay the same.'), who: bi('Загрузку выполняет ядро по вызову execve.', 'The kernel does the loading on the execve call.'), doc: man('execve', 2) } },
      { id: 'e-wait', from: 'child', to: 'bash', via: [[500, 320], [134, 320]], label: bi('код завершения в $?', 'exit code into $?'), labelAt: 0.5, dashed: true, card: { what: bi('Программа завершается и сообщает число, где ноль означает успех. Оболочка забирает это число вызовом wait4 и кладёт его в переменную `$?`. Пока родитель не забрал код, завершившийся процесс остаётся в таблице процессов как зомби с буквой Z.', 'The program ends and reports a number, where zero means success. The shell collects it with wait4 and puts it into `$?`. Until the parent collects the code, the finished process stays in the process table as a zombie marked Z.'), who: bi('Код хранит ядро, а забирает его оболочка.', 'The kernel keeps the code and the shell collects it.'), see: 'echo $?', doc: man('wait', 2) } },
      { id: 'e-prompt', from: 'bash', to: 'tty', via: [[134, 134], [725, 134], [725, 56]], label: bi('новое приглашение', 'a new prompt'), labelAt: 0.79, card: { what: bi('Получив код завершения, оболочка снова печатает приглашение и ждёт следующую строку.', 'Having collected the exit code, the shell prints the prompt again and waits for the next line.'), who: bi('Приглашение печатает оболочка bash.', 'The bash shell prints the prompt.'), see: 'echo $PS1' } },
    ],
  },
  params: [
    {
      id: 'form',
      label: bi('Какую строку вы набрали', 'Which line you typed'),
      kind: 'choice',
      default: 'ls',
      options: [
        { id: 'ls', label: bi('ls -l /etc > list.txt', 'ls -l /etc > list.txt') },
        { id: 'cd', label: bi('cd /tmp', 'cd /tmp') },
        { id: 'exec', label: bi('exec ls -l /etc > list.txt', 'exec ls -l /etc > list.txt') },
        { id: 'bg', label: bi('ls -l /etc > list.txt & (в фоне)', 'ls -l /etc > list.txt & (in the background)') },
      ],
      near: 'line',
      group: bi('Что вы набираете', 'What you type'),
      predict: {
        prompt: bi('Вы выбрали `cd /tmp`. Команда `cd` встроена в оболочку. Создаст ли оболочка для неё свою копию?', 'You chose `cd /tmp`. The `cd` command is built into the shell. Will the shell make a copy of itself for it?'),
        options: [
          { id: 'yes', text: bi('Да, оболочка создаёт копию для любой команды', 'Yes, the shell makes a copy for any command') },
          { id: 'no', text: bi('Нет, встроенную команду оболочка выполнит сама', 'No, the shell runs a builtin itself') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.forks ?? 0) > 0 ? 'yes' : 'no'),
      },
    },
    {
      id: 'path',
      label: bi('Какие каталоги перечислены в PATH', 'Which directories PATH lists'),
      kind: 'choice',
      default: 'default',
      options: [
        { id: 'default', label: bi('обычный список /usr/local/bin:/usr/bin:/bin', 'the usual list /usr/local/bin:/usr/bin:/bin') },
        { id: 'mine', label: bi('первым стоит каталог ~/bin с вашей собственной программой ls', 'the directory ~/bin with your own ls program comes first') },
        { id: 'broken', label: bi('список заменили на PATH=/opt/tools/bin', 'the list was replaced with PATH=/opt/tools/bin') },
      ],
      near: 'path',
      group: bi('Где оболочка ищет программы', 'Where the shell looks for programs'),
      predict: {
        prompt: bi('Список PATH заменили одним каталогом `/opt/tools/bin`, в котором программы `ls` нет. Что произойдёт, когда вы наберёте `ls`?', 'PATH was replaced with the single directory `/opt/tools/bin`, which has no `ls`. What happens when you type `ls`?'),
        options: [
          { id: 'works', text: bi('Программа `ls` запустится как обычно', 'The program `ls` runs as usual') },
          { id: 'notfound', text: bi('Оболочка ответит `command not found` и не создаст процесс', 'The shell answers `command not found` and creates no process') },
          { id: 'denied', text: bi('Оболочка ответит `Permission denied`', 'The shell answers `Permission denied`') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.status ?? 0) === 127 ? 'notfound' : 'works'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-x',
      label: bi('У файла /usr/bin/ls снят бит x, разрешающий запуск', 'The x bit that allows running is removed from /usr/bin/ls'),
      remove: ['e-exec'],
      boundary: 'process',
      predict: {
        prompt: bi('Файл `/usr/bin/ls` на месте, но у него сняли бит x, разрешающий запуск. Список PATH обычный. На каком этапе остановится запуск?', 'The file `/usr/bin/ls` is in place, but its x bit, which allows running, was removed. PATH is the usual one. At which stage does the start stop?'),
        options: [
          { id: 'lookup', text: bi('Оболочка не найдёт программу при поиске по PATH', 'The shell will not find the program during the PATH lookup') },
          { id: 'exec', text: bi('Ядро откажет при загрузке программы, и код будет 126', 'The kernel refuses when loading the program, and the code is 126') },
          { id: 'none', text: bi('Программа всё равно запустится, потому что файл на месте', 'The program runs anyway, because the file is in place') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'e-exec') ? 'exec' : 'lookup'),
      },
    },
    {
      id: 'redirect',
      label: bi('Вывод направлен в /root/list.txt, куда обычному пользователю писать нельзя', 'The output goes to /root/list.txt, where an ordinary user may not write'),
      remove: ['e-redirect'],
      boundary: 'io',
      predict: {
        prompt: bi('Вывод направлен в `/root/list.txt`, а в каталог `/root` вам писать нельзя. Запустится ли программа `ls`?', 'The output goes to `/root/list.txt`, and you may not write into `/root`. Will the program `ls` start?'),
        options: [
          { id: 'no', text: bi('Нет, ошибка случится раньше, когда копия оболочки откроет файл', 'No, the error happens earlier, when the copy of the shell opens the file') },
          { id: 'yes', text: bi('Да, `ls` запустится и сама сообщит об ошибке', 'Yes, `ls` starts and reports the error itself') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.execs ?? 0) > 0 ? 'yes' : 'no'),
      },
    },
    {
      id: 'no-wait',
      label: bi('Родительский процесс не забирает код завершения', 'The parent process does not collect the exit code'),
      remove: ['e-wait'],
      boundary: 'process',
      predict: {
        prompt: bi('Программа завершилась, а родитель так и не вызвал wait, чтобы забрать её код. Что покажет `ps`?', 'The program finished, but the parent never called wait to collect its code. What does `ps` show?'),
        options: [
          { id: 'zombie', text: bi('Строку процесса в состоянии Z, то есть зомби', 'The process line in state Z, a zombie') },
          { id: 'gone', text: bi('Ничего, процесс исчезнет из таблицы', 'Nothing, the process disappears from the table') },
        ],
        resolve: () => 'zombie',
      },
    },
  ],
  metrics: [
    { id: 'checked', label: bi('каталогов PATH проверено', 'PATH directories checked') },
    { id: 'forks', label: bi('копий оболочки создано', 'copies of the shell made') },
    { id: 'execs', label: bi('программ загружено', 'programs loaded') },
    { id: 'status', label: bi('код завершения в $?', 'exit code in $?') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const path = PATHS[p.path] ?? PATHS.default;
    const n = execNumbers(p, broken);
    const line = p.form === 'cd' ? 'cd /tmp' : p.form === 'exec' ? 'exec ls -l /etc > list.txt' : p.form === 'bg' ? 'ls -l /etc > list.txt &' : 'ls -l /etc > list.txt';
    const m = (o: Partial<ExecRun>) => ({ checked: 0, forks: 0, execs: 0, status: 0, ...o });
    steps.push({
      id: 'words',
      label: bi('слова', 'words'),
      caption:
        p.form === 'cd'
          ? bi('Вы нажали Enter, и оболочка читает строку `cd /tmp`. В ней два слова: имя команды `cd` и один аргумент `/tmp`.', 'You pressed Enter, and the shell reads `cd /tmp`. It has two words: the command name `cd` and one argument `/tmp`.')
          : bi('Вы нажали Enter, и оболочка делит строку на слова `ls`, `-l` и `/etc`. Перенаправление `> list.txt` она откладывает отдельно, потому что выполнит его сама, а программа о нём не узнает.', 'You pressed Enter, and the shell splits the line into the words `ls`, `-l` and `/etc`. The redirection `> list.txt` it puts aside, because it will do it itself and the program will not know about it.'),
      focus: ['e-words', 'bash'],
      tokens: [{ edge: 'e-words', label: p.form === 'cd' ? 'cd /tmp' : 'ls -l /etc' }],
      say: { bash: p.form === 'cd' ? bi('Оболочка видит, что строка начинается со слова `cd`, а это её собственная встроенная команда.', 'The shell sees that the line starts with the word `cd`, which is its own builtin command.') : bi('Оболочка делит строку на слова и запоминает, что вывод нужно отправить в файл list.txt.', 'The shell splits the line into words and remembers that the output must go into list.txt.') },
      values: { line: line.split(' ').join(' · '), path: path.dirs.join(':') },
      states: startWith('line', 'bash', 'e-words'),
      metrics: m({}),
    });
    if (p.form === 'cd') {
      steps.push({
        id: 'builtin',
        label: 'cd',
        caption: bi('Команда `cd` встроена в оболочку, и оболочка меняет свой собственный текущий каталог. Если бы она запустила для `cd` отдельный процесс, тот сменил бы каталог только себе и сразу завершился, а каталог самой оболочки остался бы прежним.', '`cd` is built into the shell, and the shell changes its own current directory. If it started a separate process for `cd`, that process would change only its own directory and finish at once, while the shell’s directory stayed the same.'),
        focus: ['bash'],
        say: { bash: bi('Оболочка сама меняет свой текущий каталог на /tmp, не создавая нового процесса.', 'The shell changes its own current directory to /tmp without creating a new process.') },
        values: { bash: 'PID 2210 · cwd /tmp' },
        states: { bash: 'ok' },
        metrics: m({}),
      });
      steps.push({
        id: 'prompt',
        label: bi('приглашение', 'prompt'),
        caption: bi('Нового процесса так и не появилось. В переменной `$?` лежит ноль, а приглашение оболочки теперь показывает каталог `/tmp`.', 'No new process appeared at all. `$?` holds zero, and the shell’s prompt now shows `/tmp`.'),
        focus: ['e-prompt', 'tty'],
        reveal: ['e-prompt', 'tty'],
        tokens: [{ edge: 'e-prompt', label: '/tmp$' }],
        say: { tty: bi('Терминал показывает новое приглашение, в котором уже стоит каталог /tmp.', 'The terminal shows a new prompt that already contains /tmp.') },
        metrics: m({}),
      });
      return steps;
    }
    steps.push({
      id: 'lookup',
      label: 'PATH',
      caption: path.found
        ? fmt(bi('В имени `ls` нет знака `/`, поэтому оболочка ищет программу по каталогам PATH. Она проверяет каталоги по порядку, на {n}-м находит `{f}` и дальше не ищет. Оболочка запускает первую найденную программу, даже если дальше по списку есть другая с тем же именем.', 'The name `ls` has no `/`, so the shell looks for the program in the PATH directories. It checks the directories in order, finds `{f}` in directory number {n} and stops looking. The shell runs the first program it finds, even if another one with the same name comes later on the list.'), { n: n.checked, f: path.found })
        : bi('В имени `ls` нет знака `/`, поэтому оболочка ищет программу по PATH. Но в списке остался единственный каталог `/opt/tools/bin`, и программы `ls` в нём нет.', 'The name `ls` has no `/`, so the shell looks for the program in PATH. But the list has only one directory left, `/opt/tools/bin`, and there is no `ls` in it.'),
      focus: ['e-lookup', 'path'],
      reveal: ['path', 'e-lookup'],
      tokens: [{ edge: 'e-lookup', label: 'ls?' }],
      say: { path: path.found ? fmt(bi('Оболочка проверяет каталоги списка по очереди и находит программу {f}.', 'The shell checks the directories in order and finds {f}.'), { f: path.found }) : bi('Оболочка проверяет каталог /opt/tools/bin и не находит в нём программу ls.', 'The shell checks /opt/tools/bin and does not find ls there.') },
      values: { path: path.dirs.join(':') },
      states: { path: path.found ? 'ok' : 'err' },
      metrics: m({ checked: n.checked }),
    });
    if (!path.found) {
      steps.push({
        id: 'notfound',
        label: '127',
        caption: bi('Программа не нашлась ни в одном каталоге, поэтому оболочка не создаёт копию и ничего не загружает. Она печатает сообщение об ошибке и кладёт в `$?` код 127.', 'The program was found in no directory, so the shell creates no copy and loads nothing. It prints an error message and puts code 127 into `$?`.'),
        focus: ['bash'],
        say: { bash: bi('Оболочка печатает «command not found», то есть «команда не найдена», и ставит код 127.', 'The shell prints “command not found” and sets code 127.') },
        states: { bash: 'err' },
        metrics: m({ checked: n.checked, status: 127 }),
        broken: { at: 'path', message: 'bash: ls: command not found', caption: bi('Список PATH заменили целиком, и каталог `/usr/bin` из него выпал. Новый каталог нужно добавлять к списку, например так: `PATH="$PATH:/opt/tools/bin"`. Узнать такую поломку можно по тому, что перестают находиться все обычные команды сразу.', 'PATH was replaced as a whole, and `/usr/bin` dropped out of it. A new directory must be added to the list, for example `PATH="$PATH:/opt/tools/bin"`. You recognise this break because all the usual commands stop being found at once.') },
      });
      return steps;
    }
    if (p.form === 'exec') {
      steps.push({
        id: 'noexec-fork',
        label: bi('без копии', 'no copy'),
        caption: bi('Слово `exec` в начале строки велит оболочке не создавать копию, а самой превратиться в программу. Поэтому номер оболочки 2210 перейдёт к программе `ls`, и когда `ls` завершится, оболочки уже не будет.', 'The word `exec` at the start of the line tells the shell not to make a copy but to turn into the program itself. So the shell’s number 2210 passes to `ls`, and after it ends there will be no shell any more.'),
        focus: ['bash'],
        say: { bash: bi('Оболочка не создаёт копию, потому что сама станет программой ls.', 'The shell makes no copy, because it will become ls itself.') },
        reveal: ['child'],
        values: { child: 'PID 2210', bash: 'PID 2210' },
        metrics: m({ checked: n.checked }),
      });
    } else {
      steps.push({
        id: 'fork',
        label: 'fork',
        caption: bi('Оболочка просит ядро создать её копию. Копия получает новый номер 2231, её родителем становится оболочка с номером 2210, а открытые файлы у неё те же, поэтому её поток 1 пока подключён к терминалу.', 'The shell asks the kernel to make a copy of it. The copy gets a new number, 2231, its parent is the shell, number 2210, and it has the same open files, so its stream 1 is still connected to the terminal.'),
        focus: ['e-fork', 'child'],
        reveal: ['child', 'e-fork', 'kernel'],
        tokens: [{ edge: 'e-fork', label: 'fork' }],
        say: { child: bi('Ядро создало процесс 2231, точную копию оболочки.', 'The kernel made process 2231, an exact copy of the shell.') },
        values: { child: 'PID 2231 · bash' },
        states: { child: 'on' },
        metrics: m({ checked: n.checked, forks: 1 }),
      });
    }
    if (broken.has('redirect')) {
      steps.push({
        id: 'redir-fail',
        label: '>',
        caption: bi('Копия оболочки пытается открыть файл `/root/list.txt` для записи, но система отказывает, потому что писать в `/root` вам нельзя. До загрузки программы `ls` дело так и не дошло.', 'The copy of the shell tries to open `/root/list.txt` for writing, but the system refuses, because you may not write into `/root`. Loading the program `ls` never happened.'),
        focus: ['e-redirect', 'child'],
        reveal: ['file', 'e-redirect'],
        say: { child: bi('Копия оболочки пытается открыть файл /root/list.txt и получает отказ.', 'The copy of the shell tries to open /root/list.txt and is refused.') },
        states: { child: 'err', 'e-redirect': 'err', file: 'err' },
        values: { file: '/root/list.txt' },
        metrics: m({ checked: n.checked, forks: n.forks, status: 1 }),
        broken: { at: 'e-redirect', message: 'bash: /root/list.txt: Permission denied', caption: bi('Перенаправление выполняет копия оболочки до запуска программы. Поэтому сообщение об ошибке начинается со слова bash, а не ls, и по этому признаку такую поломку узнают в жизни: программа даже не запускалась.', 'The copy of the shell does the redirection before the program starts. That is why the error message starts with bash, not ls, and this is how you recognise the break in real life: the program never even started.') },
      });
      return steps;
    }
    steps.push({
      id: 'redirect',
      label: '>',
      caption: bi('Копия открывает файл `list.txt`, стирает его прежнее содержимое и подключает его на место потока 1. С этого момента всё, что программа напечатает, попадёт в файл, а не на экран.', 'The copy opens `list.txt`, erases its old contents and connects it in place of stream 1. From now on everything the program prints goes into the file, not to the screen.'),
      focus: ['e-redirect', 'file'],
      reveal: ['file', 'e-redirect'],
      tokens: [{ edge: 'e-redirect', label: bi('поток 1', 'stream 1') }],
      say: { file: bi('Файл list.txt открыт и очищен, и теперь в него направлен поток вывода копии.', 'list.txt is open and empty, and the copy’s output stream now points to it.') },
      states: { file: 'on' },
      metrics: m({ checked: n.checked, forks: n.forks }),
    });
    if (broken.has('no-x')) {
      steps.push({
        id: 'exec-fail',
        label: 'exec',
        caption: bi('Копия просит ядро загрузить программу `/usr/bin/ls`, но у этого файла нет бита x, и ядро отказывает. Оболочка ставит код 126, который означает, что программа найдена, но запустить её нельзя.', 'The copy asks the kernel to load `/usr/bin/ls`, but the file has no x bit, and the kernel refuses. The shell sets code 126, which means the program was found but cannot be run.'),
        focus: ['e-exec', 'kernel'],
        reveal: ['e-exec'],
        tokens: [{ edge: 'e-exec', label: 'execve /usr/bin/ls' }],
        say: { child: bi('Ядро проверяет права файла /usr/bin/ls, не находит бита x и отказывается загружать программу.', 'The kernel checks the mode of /usr/bin/ls, finds no x bit and refuses to load the program.') },
        states: { 'e-exec': 'err', child: 'err' },
        metrics: m({ checked: n.checked, forks: n.forks, status: 126 }),
        broken: { at: 'e-exec', message: 'bash: /usr/bin/ls: Permission denied', caption: bi('Право на запуск ядро проверяет в момент загрузки программы. Узнают эту поломку по коду 126 и по тому, что в сообщении назван полный путь к программе.', 'The kernel checks the right to run when it loads the program. You recognise this break by code 126 and by the full path of the program in the message.') },
      });
      return steps;
    }
    const pid = p.form === 'exec' ? 2210 : 2231;
    steps.push({
      id: 'exec',
      label: 'exec',
      caption: fmt(bi('Копия просит ядро заменить её программу на `{f}`. Ядро стирает память копии и загружает новую программу, но номер процесса остаётся прежним, и поток 1 по-прежнему подключён к файлу.', 'The copy asks the kernel to replace its program with `{f}`. The kernel wipes the copy’s memory and loads the new program, but the process number stays the same, and stream 1 is still connected to the file.'), { f: path.found }),
      focus: ['e-exec', 'child'],
      reveal: ['e-exec', 'kernel'],
      tokens: [{ edge: 'e-exec', label: `execve ${path.found}` }],
      say: { child: fmt(bi('Теперь в процессе {n} работает ls, а вывод всё так же идёт в файл.', 'Process {n} now runs ls, and its output stream is still connected to the file.'), { n: pid }) },
      values: { child: `PID ${pid} · ls` },
      metrics: m({ checked: n.checked, forks: n.forks, execs: 1 }),
    });
    steps.push({
      id: 'write',
      label: bi('запись', 'write'),
      caption: bi('Программа `ls` печатает список файлов каталога `/etc` в свой поток 1, а он подключён к файлу. Поэтому весь список оказывается в `list.txt`, а на экран не попадает ничего.', '`ls` prints the listing of `/etc` to its stream 1, which is connected to the file. So the whole listing ends up in `list.txt`, and nothing reaches the screen.'),
      focus: ['e-redirect', 'file'],
      tokens: [{ edge: 'e-redirect', label: bi('список /etc', 'listing of /etc') }],
      say: { file: bi('В файл list.txt записан список файлов каталога /etc, около двух килобайт.', 'list.txt now holds the listing of /etc, about two kilobytes.') },
      values: { file: '2.1 KiB' },
      states: { file: 'ok' },
      metrics: m({ checked: n.checked, forks: n.forks, execs: 1 }),
    });
    if (p.form === 'exec') {
      steps.push({
        id: 'gone',
        label: bi('конец', 'end'),
        caption: bi('Программа `ls` завершилась, а оболочки больше нет, потому что оболочка сама и была этим процессом. Печатать приглашение некому, и терминал закрывается.', '`ls` finished, and there is no shell any more, because the shell itself was this process. Nobody is left to print the prompt, and the terminal closes.'),
        focus: ['child', 'tty'],
        reveal: ['tty'],
        say: { tty: bi('Терминал закрывается, потому что процесс оболочки завершился вместе с программой ls.', 'The terminal closes, because the shell process ended together with ls.') },
        states: { bash: 'off', child: 'off', tty: 'off' },
        metrics: m({ checked: n.checked, execs: 1 }),
      });
      return steps;
    }
    if (p.form === 'bg') {
      steps.push({
        id: 'nowait',
        label: '&',
        caption: bi('Знак `&` в конце строки велит оболочке не ждать завершения программы. Оболочка сразу печатает номер задания `[1] 2231` и новое приглашение, а `ls` работает рядом. О том, что задание закончилось, оболочка сообщит позже строкой `[1]+ Done`.', 'The `&` at the end of the line tells the shell not to wait for the program. The shell at once prints the job number `[1] 2231` and a new prompt while `ls` runs alongside. The shell reports later that the job ended with the line `[1]+ Done`.'),
        focus: ['e-prompt', 'tty'],
        reveal: ['e-prompt', 'tty'],
        tokens: [{ edge: 'e-prompt', label: '[1] 2231' }],
        say: { tty: bi('Терминал сразу показывает номер фонового задания и новое приглашение.', 'The terminal at once shows the background job number and a new prompt.') },
        metrics: m({ checked: n.checked, forks: 1, execs: 1 }),
      });
      return steps;
    }
    if (broken.has('no-wait')) {
      steps.push({
        id: 'zombie',
        label: 'Z',
        caption: bi('Программа `ls` завершилась, но родитель не вызвал wait и не забрал её код. От процесса осталась строка в таблице процессов с кодом завершения, и такой процесс называют зомби. Память ядро уже освободило, а номер 2231 остаётся занятым.', '`ls` finished, but the parent did not call wait and did not collect its code. What is left of the process is a line in the process table with the exit code, and such a process is called a zombie. The kernel has already freed the memory, but number 2231 stays taken.'),
        focus: ['child'],
        say: { child: bi('Процесс 2231 завершился, но его код никто не забрал, поэтому он остаётся в таблице как зомби.', 'Process 2231 finished, but nobody collected its code, so it stays in the table as a zombie.') },
        states: { child: 'warn', 'e-wait': 'err' },
        reveal: ['e-wait'],
        values: { child: 'PID 2231 · <defunct>' },
        metrics: m({ checked: n.checked, forks: 1, execs: 1 }),
        broken: { at: 'e-wait', message: '2231  2210 Z    [ls] <defunct>', caption: bi('Зомби нельзя завершить сигналом, его убирает только родитель. Родитель должен забрать код вызовом wait или завершиться сам, и тогда код заберёт первый процесс системы. В выводе `ps` такую поломку узнают по букве Z и слову defunct.', 'A zombie cannot be ended with a signal; only the parent removes it. The parent must collect the code with wait or exit itself, and then the first process of the system collects it. In `ps` you recognise this break by the letter Z and the word defunct.') },
      });
      return steps;
    }
    steps.push({
      id: 'wait',
      label: 'wait',
      caption: bi('Программа `ls` завершается с кодом 0. Оболочка всё это время ждала и теперь забирает код вызовом wait4, после чего процесс 2231 исчезает из таблицы процессов.', '`ls` ends with code 0. The shell was waiting all this time and now collects the code with wait4, after which process 2231 disappears from the process table.'),
      focus: ['e-wait', 'bash'],
      reveal: ['e-wait'],
      tokens: [{ edge: 'e-wait', label: '0' }],
      say: { bash: bi('Оболочка забирает код завершения 0 и кладёт его в переменную $?.', 'The shell collects exit code 0 and puts it into $?.') },
      states: { child: 'off', bash: 'ok' },
      metrics: m({ checked: n.checked, forks: 1, execs: 1 }),
    });
    steps.push({
      id: 'prompt',
      label: bi('приглашение', 'prompt'),
      caption: bi('Код завершения лежит в `$?`, и на экране снова появилось приглашение оболочки. Весь путь от нажатия Enter до этого момента занял несколько миллисекунд.', 'The exit code is in `$?`, and the shell’s prompt is back on the screen. The whole way from pressing Enter to this moment took a few milliseconds.'),
      focus: ['e-prompt', 'tty'],
      reveal: ['e-prompt', 'tty'],
      tokens: [{ edge: 'e-prompt', label: '~$' }],
      say: { tty: bi('Терминал снова показывает приглашение оболочки.', 'The terminal shows the shell’s prompt again.') },
      metrics: m({ checked: n.checked, forks: 1, execs: 1 }),
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const st = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и команда снова проходит весь путь до нового приглашения.', 'The break is removed, and the command again goes all the way to a new prompt.');
      if (change.id === 'no-x') return bi('Без бита x ядро отказывает при загрузке программы. Копия оболочки к этому моменту уже создана и вывод уже направлен в файл, но программа не загружена, и код завершения равен 126.', 'Without the x bit the kernel refuses to load the program. By then the copy of the shell exists and the output already points to the file, but the program is not loaded, and the exit code is 126.');
      if (change.id === 'redirect') return bi('Ошибка перенаправления возникает в копии оболочки до загрузки программы, поэтому сообщение об ошибке пишет bash, а не ls.', 'The redirection error happens in the copy of the shell before the program is loaded, so the error message comes from bash, not from ls.');
      return bi('Родитель не забрал код завершения, и от процесса осталась строка в таблице процессов, которую называют зомби.', 'The parent did not collect the exit code, and a line called a zombie is left of the process in the process table.');
    }
    if (change.id === 'form') {
      const f = b.form;
      if (f === 'cd') return bi('Команду `cd` оболочка выполняет сама, поэтому поиск по PATH, создание копии и загрузка программы исчезли из пути. Сменить каталог в копии было бы бесполезно, потому что каталог самой оболочки остался бы прежним.', 'The shell runs `cd` itself, so the PATH lookup, the copy and the program loading are gone from the path. Changing the directory in a copy would be useless, because the shell’s own directory would stay the same.');
      if (f === 'exec') return bi('Слово `exec` убирает создание копии: программой становится сама оболочка, и когда программа завершится, терминал закроется.', '`exec` removes the copy: the shell itself becomes the program, and when the program ends the terminal closes.');
      if (f === 'bg') return bi('Со знаком `&` из пути пропал шаг ожидания. Приглашение появляется сразу, а код завершения оболочка узнает позже, когда фоновое задание закончится.', 'With `&` the waiting step is gone. The prompt comes back at once, and the shell learns the exit code later, when the background job ends.');
      return fmt(bi('Вы выбрали обычную команду. Число копий оболочки изменилось с {a} на {b}, программа загружается один раз, и оболочка ждёт, пока она завершится.', 'You chose an ordinary command. The number of shell copies changed from {a} to {b}; the program is loaded once, and the shell waits for it to end.'), { a: st(prev).forks ?? 0, b: st(next).forks ?? 0 });
    }
    if (change.id === 'path') {
      if (b.path === 'broken') return bi('В PATH остался один каталог `/opt/tools/bin`. Оболочка не нашла в нём `ls`, не создала процесс и вернула код 127.', 'PATH has a single directory, `/opt/tools/bin`. The shell did not find `ls` there, created no process and returned code 127.');
      if (b.path === 'mine') return bi('Каталог `~/bin` стоит в списке первым, поэтому запускается ваша программа `ls`, хотя `/usr/bin/ls` никуда не делся. Какая программа запустится, решает порядок каталогов в PATH.', '`~/bin` comes first on the list, so your own `ls` runs, although `/usr/bin/ls` is still there. The order of the directories in PATH decides which program runs.');
      return fmt(bi('В обычном PATH программа `ls` находится во втором каталоге из трёх. Число каталогов, которые оболочка проверяет, прежде чем найти программу, изменилось с {a} на {b}.', 'In the usual PATH, `ls` is in the second of three directories. The number of directories the shell checks before it finds the program changed from {a} to {b}.'), { a: st(prev).checked ?? 0, b: st(next).checked ?? 0 });
    }
    void a;
    return bi('Параметр изменился, и путь команды пересчитан заново.', 'The parameter changed, and the command’s path was recomputed.');
  },
});
