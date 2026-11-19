// X2 «What happens when you press Enter»: words, PATH lookup, fork, the
// redirection done by the child, exec, wait, $? (02 §6.6 X2). The form of the
// command (a program, cd, exec, &) and the PATH are knobs; breaks remove the
// x bit, deny the redirection target and make the parent forget to wait.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';

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

export const execModel = defineModel<P>({
  id: 'linux.exec',
  block: 'linux',
  title: bi('Что происходит, когда вы нажимаете Enter', 'What happens when you press Enter'),
  summary: bi(
    'Оболочка делит строку на слова, ищет программу по PATH, создаёт копию себя (fork), копия перенаправляет вывод и превращается в программу (exec), а оболочка ждёт кода завершения.',
    'The shell splits the line into words, looks the program up in PATH, makes a copy of itself (fork); the copy redirects its output and turns into the program (exec), and the shell waits for the exit code.',
  ),
  concepts: ['linux.fork-exec', 'linux.path-var', 'linux.exit-code'],
  diagram: {
    width: 960,
    height: 480,
    nodes: [
      {
        id: 'line',
        label: bi('набранная строка', 'the typed line'),
        sub: 'ls · -l · /etc · > list.txt',
        family: 'user',
        shape: 'pill',
        x: 24,
        y: 24,
        w: 300,
        h: 56,
        card: {
          what: bi('Строка, которую вы напечатали. Оболочка делит её на слова по пробелам: имя команды, аргументы, и отдельно — перенаправление `> list.txt`, которое программа даже не увидит.', 'The line you typed. The shell splits it into words at the spaces: the command name, the arguments, and apart from them the redirection `> list.txt`, which the program never even sees.'),
          who: bi('Вы, в терминале.', 'You, in the terminal.'),
          see: 'history 1',
          doc: { page: 'man/bash.1', anchor: 'REDIRECTION' },
        },
      },
      {
        id: 'bash',
        label: 'bash',
        sub: 'PID 2210',
        family: 'process',
        x: 24,
        y: 170,
        w: 200,
        h: 64,
        card: {
          what: bi('Оболочка: читает строку, раскрывает `~`, `$VAR` и `*`, ищет программу и запускает её. Встроенные команды (`cd`, `export`) выполняет сама, без нового процесса.', 'The shell: reads the line, expands `~`, `$VAR` and `*`, finds the program and starts it. Built-in commands (`cd`, `export`) it runs itself, without a new process.'),
          who: bi('Запускается при входе в систему.', 'Started when you log in.'),
          see: 'echo $$',
          doc: { page: 'man/bash.1', anchor: 'DESCRIPTION' },
        },
      },
      {
        id: 'path',
        label: 'PATH',
        sub: '/usr/local/bin:/usr/bin:/bin',
        family: 'neutral',
        shape: 'doc',
        x: 380,
        y: 24,
        w: 330,
        h: 64,
        card: {
          what: bi('Переменная со списком каталогов через двоеточие. Оболочка проверяет их по очереди, есть ли там файл с таким именем и правом на запуск; первый найденный выигрывает. Текущего каталога в списке нет — поэтому программу рядом запускают как `./prog`.', 'A variable with a colon-separated list of directories. The shell checks them in order for a file with that name that may be executed; the first one found wins. The current directory is not on the list — that is why a program next to you is started as `./prog`.'),
          who: bi('Задаётся при входе (/etc/profile, ~/.profile), меняется через `export PATH=…`.', 'Set at login (/etc/profile, ~/.profile), changed with `export PATH=…`.'),
          see: 'echo $PATH; type -a ls',
          doc: { page: 'man/bash.1', anchor: 'DESCRIPTION' },
        },
      },
      {
        id: 'child',
        label: bi('копия bash', 'a copy of bash'),
        sub: 'PID 2231',
        family: 'process',
        x: 380,
        y: 170,
        w: 220,
        h: 64,
        card: {
          what: bi('Новый процесс: точная копия оболочки, с теми же переменными окружения и теми же открытыми файлами 0, 1, 2. Сначала он настраивает перенаправления, потом загружает в себя программу — номер процесса при этом не меняется.', 'A new process: an exact copy of the shell, with the same environment variables and the same open files 0, 1, 2. It first sets up the redirections, then loads the program into itself — the process number does not change.'),
          who: bi('Ядро, по системному вызову clone() (fork) от оболочки.', 'The kernel, on the clone() (fork) system call of the shell.'),
          see: 'ps -o pid,ppid,comm',
          doc: man('fork', 2),
        },
      },
      {
        id: 'file',
        label: 'list.txt',
        sub: '0 B',
        family: 'store',
        shape: 'doc',
        x: 740,
        y: 170,
        w: 196,
        h: 64,
        card: {
          what: bi('Файл, куда пойдёт вывод. Его открывает (и обнуляет) копия оболочки до запуска программы, поэтому `ls` пишет в него, думая, что пишет на экран.', 'The file the output goes to. The copy of the shell opens (and truncates) it before the program starts, so `ls` writes into it thinking it writes to the screen.'),
          who: bi('Создаётся перенаправлением `>`; если файл был — он перезаписывается.', 'Created by the `>` redirection; if it existed, it is overwritten.'),
          see: 'ls -l list.txt',
        },
      },
      {
        id: 'tty',
        label: bi('терминал', 'terminal'),
        sub: '/dev/pts/0',
        family: 'user',
        x: 740,
        y: 24,
        w: 196,
        h: 64,
        card: {
          what: bi('Куда по умолчанию смотрят дескрипторы 0, 1 и 2 оболочки и всех её копий: ввод с клавиатуры и вывод на экран.', 'Where descriptors 0, 1 and 2 of the shell and of all its copies point by default: input from the keyboard, output to the screen.'),
          who: bi('Создаётся при открытии терминала или входе по SSH.', 'Created when a terminal opens or an SSH login starts.'),
          see: 'tty; ls -l /proc/$$/fd',
        },
      },
      {
        id: 'kernel',
        label: bi('ядро Linux', 'Linux kernel'),
        family: 'kernel',
        shape: 'bar',
        x: 16,
        y: 380,
        w: 928,
        h: 84,
        card: {
          what: bi('Всё, что видно на схеме, делает ядро по просьбам процессов — системным вызовам: `clone` создаёт процесс, `execve` загружает программу, `wait4` отдаёт родителю код завершения.', 'Everything on the diagram is done by the kernel on the requests of processes — system calls: `clone` creates a process, `execve` loads a program, `wait4` hands the exit code to the parent.'),
          who: bi('Загружается при старте машины, одно на всю машину.', 'Loaded when the machine boots; one for the whole machine.'),
          see: 'uname -r',
          doc: man('syscalls', 2),
        },
      },
    ],
    edges: [
      { id: 'e-words', from: 'line', to: 'bash', label: bi('делит на слова', 'splits into words'), card: { what: bi('Оболочка разбирает строку: слова, кавычки, переменные, шаблоны, перенаправления. Шаблоны вроде `*.log` раскрывает она, а не команда.', 'The shell parses the line: words, quotes, variables, patterns, redirections. Patterns like `*.log` are expanded by it, not by the command.'), who: bi('bash', 'bash'), doc: { page: 'man/bash.1', anchor: 'DESCRIPTION' } } },
      { id: 'e-lookup', from: 'bash', to: 'path', via: [[300, 202], [300, 56]], label: bi('ищет по PATH', 'looks up PATH'), labelAt: 0.45, card: { what: bi('Для имени без `/` оболочка перебирает каталоги PATH. Нашла — запоминает полный путь; не нашла — `command not found` и код 127, процесс даже не создаётся.', 'For a name without `/` the shell goes through the PATH directories. Found — it remembers the full path; not found — `command not found` and code 127, no process is even created.'), who: bi('bash', 'bash'), see: 'type ls' } },
      { id: 'e-fork', from: 'bash', to: 'child', label: 'fork', card: { what: bi('Копия оболочки: новый процесс с новым номером, родитель — оболочка (PPID 2210).', 'A copy of the shell: a new process with a new number, its parent is the shell (PPID 2210).'), who: bi('Ядро, вызов clone().', 'The kernel, the clone() call.'), doc: man('fork', 2) } },
      { id: 'e-redirect', from: 'child', to: 'file', label: 'fd 1 → list.txt', card: { what: bi('Копия закрывает свой дескриптор 1 (он смотрел в терминал) и открывает на его месте файл. Это делается до exec, поэтому программа получает уже готовый поток.', 'The copy closes its descriptor 1 (it pointed to the terminal) and opens the file in its place. This happens before exec, so the program receives a ready stream.'), who: bi('Копия оболочки: open() и dup2().', 'The copy of the shell: open() and dup2().'), doc: { page: 'man/bash.1', anchor: 'REDIRECTION' } } },
      { id: 'e-exec', from: 'child', to: 'kernel', via: [[490, 330]], label: 'execve(/usr/bin/ls)', labelAt: 0.6, card: { what: bi('Копия просит ядро заменить свою программу на `/usr/bin/ls`. Память копии стирается, загружается новая программа, но номер процесса и открытые файлы остаются.', 'The copy asks the kernel to replace its program with `/usr/bin/ls`. The memory of the copy is wiped and the new program is loaded, but the process number and the open files stay.'), who: bi('Ядро, вызов execve().', 'The kernel, the execve() call.'), doc: man('execve', 2) } },
      { id: 'e-wait', from: 'child', to: 'bash', via: [[490, 290], [124, 290]], label: bi('код завершения → $?', 'exit code → $?'), labelAt: 0.5, dashed: true, card: { what: bi('Программа выходит с числом: 0 — успех. Родитель забирает это число вызовом wait4 и кладёт в `$?`. Пока родитель не забрал код, завершившийся процесс висит в таблице как зомби (Z).', 'The program exits with a number: 0 means success. The parent collects it with wait4 and puts it into `$?`. Until the parent collects it, the finished process stays in the table as a zombie (Z).'), who: bi('Ядро хранит код, оболочка забирает.', 'The kernel keeps the code, the shell collects it.'), see: 'echo $?', doc: man('wait', 2) } },
      { id: 'e-prompt', from: 'bash', to: 'tty', via: [[124, 120], [838, 120]], label: bi('приглашение', 'prompt'), labelAt: 0.75, card: { what: bi('Когда код получен, оболочка снова печатает приглашение и ждёт следующую строку.', 'Once the code is collected, the shell prints the prompt again and waits for the next line.'), who: bi('bash', 'bash'), see: 'echo $PS1' } },
    ],
  },
  params: [
    {
      id: 'form',
      label: bi('Что набрано', 'What is typed'),
      kind: 'choice',
      default: 'ls',
      options: [
        { id: 'ls', label: bi('ls -l /etc > list.txt', 'ls -l /etc > list.txt') },
        { id: 'cd', label: bi('cd /tmp', 'cd /tmp') },
        { id: 'exec', label: bi('exec ls -l /etc > list.txt', 'exec ls -l /etc > list.txt') },
        { id: 'bg', label: bi('ls -l /etc > list.txt &', 'ls -l /etc > list.txt &') },
      ],
      near: 'line',
      predict: {
        prompt: bi('Для `cd /tmp` оболочка тоже создаст копию себя?', 'For `cd /tmp`, will the shell also make a copy of itself?'),
        options: [
          { id: 'yes', text: bi('Да, как для любой команды', 'Yes, as for any command') },
          { id: 'no', text: bi('Нет, cd она выполнит сама', 'No, it runs cd itself') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.forks ?? 0) > 0 ? 'yes' : 'no'),
      },
    },
    {
      id: 'path',
      label: bi('PATH', 'PATH'),
      kind: 'choice',
      default: 'default',
      options: [
        { id: 'default', label: bi('/usr/local/bin:/usr/bin:/bin', '/usr/local/bin:/usr/bin:/bin') },
        { id: 'mine', label: bi('~/bin в начале, там свой ls', '~/bin first, with its own ls') },
        { id: 'broken', label: bi('PATH=/opt/tools/bin', 'PATH=/opt/tools/bin') },
      ],
      near: 'path',
      predict: {
        prompt: bi('PATH заменили на `/opt/tools/bin`. Что будет с `ls`?', 'PATH was replaced with `/opt/tools/bin`. What happens to `ls`?'),
        options: [
          { id: 'works', text: bi('Запустится как обычно', 'It runs as usual') },
          { id: 'notfound', text: bi('command not found, процесс не создаётся', 'command not found, no process is created') },
          { id: 'denied', text: bi('Permission denied', 'Permission denied') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.status ?? 0) === 127 ? 'notfound' : 'works'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-x',
      label: bi('Снять бит x у программы', 'Remove the x bit from the program'),
      remove: ['e-exec'],
      boundary: 'process',
      predict: {
        prompt: bi('У /usr/bin/ls сняли право на запуск. Где остановится процесс?', 'The execute bit of /usr/bin/ls was removed. Where does the process stop?'),
        options: [
          { id: 'lookup', text: bi('На поиске по PATH', 'At the PATH lookup') },
          { id: 'exec', text: bi('На exec: Permission denied, код 126', 'At exec: Permission denied, code 126') },
          { id: 'none', text: bi('Нигде, root всё равно запустит', 'Nowhere, it runs anyway') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'e-exec') ? 'exec' : 'lookup'),
      },
    },
    {
      id: 'redirect',
      label: bi('Писать вывод в /root/list.txt от обычного пользователя', 'Write the output to /root/list.txt as an ordinary user'),
      remove: ['e-redirect'],
      boundary: 'io',
      predict: {
        prompt: bi('Каталог /root закрыт для вас. Запустится ли ls?', 'The /root directory is closed to you. Will ls start at all?'),
        options: [
          { id: 'no', text: bi('Нет: ошибка случится раньше, на перенаправлении', 'No: the error happens earlier, at the redirection') },
          { id: 'yes', text: bi('Да, ls запустится и сам сообщит об ошибке', 'Yes, ls starts and reports the error itself') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.execs ?? 0) > 0 ? 'yes' : 'no'),
      },
    },
    {
      id: 'no-wait',
      label: bi('Родитель не забирает код завершения', 'The parent does not collect the exit code'),
      remove: ['e-wait'],
      boundary: 'process',
      predict: {
        prompt: bi('Программа закончила, а родитель не вызвал wait. Что покажет `ps`?', 'The program finished, but the parent did not call wait. What does `ps` show?'),
        options: [
          { id: 'zombie', text: bi('Процесс в состоянии Z (зомби)', 'A process in state Z (zombie)') },
          { id: 'gone', text: bi('Ничего: процесс исчез', 'Nothing: the process is gone') },
        ],
        resolve: () => 'zombie',
      },
    },
  ],
  metrics: [
    { id: 'checked', label: bi('каталогов PATH проверено', 'PATH directories checked') },
    { id: 'forks', label: bi('fork', 'fork') },
    { id: 'execs', label: bi('exec', 'exec') },
    { id: 'status', label: bi('$?', '$?') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const path = PATHS[p.path] ?? PATHS.default;
    const n = execNumbers(p, broken);
    const line = p.form === 'cd' ? 'cd /tmp' : p.form === 'exec' ? 'exec ls -l /etc > list.txt' : p.form === 'bg' ? 'ls -l /etc > list.txt &' : 'ls -l /etc > list.txt';
    steps.push({
      id: 'words',
      label: bi('слова', 'words'),
      caption: p.form === 'cd' ? bi('Оболочка читает строку `cd /tmp`: имя команды и один аргумент.', 'The shell reads `cd /tmp`: the command name and one argument.') : bi('Оболочка делит строку на слова: `ls`, `-l`, `/etc` — и отдельно перенаправление `> list.txt`.', 'The shell splits the line into words: `ls`, `-l`, `/etc` — and, apart from them, the redirection `> list.txt`.'),
      focus: ['line', 'e-words', 'bash'],
      tokens: [{ edge: 'e-words', label: p.form === 'cd' ? 'cd' : 'ls' }],
      values: { line: line.split(' ').join(' · '), path: path.dirs.join(':') },
      states: { child: 'off', file: 'off', bash: 'on' },
      metrics: { checked: 0, forks: 0, execs: 0, status: 0 },
    });
    if (p.form === 'cd') {
      steps.push({
        id: 'builtin',
        label: 'builtin',
        caption: bi('`cd` — встроенная команда: оболочка меняет свой собственный текущий каталог. Копия здесь бесполезна — она сменила бы каталог себе и умерла.', '`cd` is a built-in: the shell changes its own current directory. A copy would be useless here — it would change its own directory and die.'),
        focus: ['bash'],
        values: { bash: 'PID 2210 · cwd /tmp' },
        metrics: { checked: 0, forks: 0, execs: 0, status: 0 },
      });
      steps.push({ id: 'prompt', label: '$?', caption: bi('Никакого нового процесса не было. `$?` = 0, приглашение показывает `/tmp`.', 'No new process at all. `$?` = 0 and the prompt shows `/tmp`.'), focus: ['e-prompt', 'tty'], tokens: [{ edge: 'e-prompt' }], metrics: { checked: 0, forks: 0, execs: 0, status: 0 } });
      return steps;
    }
    const lookup: Step = {
      id: 'lookup',
      label: 'PATH',
      caption: path.found
        ? fmt(bi('Имя без `/` — оболочка ищет его по PATH: проверено каталогов — {n}, найден `{f}`. Первый найденный выигрывает.', 'A name without `/` — the shell looks it up in PATH: {n} directories checked, `{f}` found. The first one found wins.'), { n: n.checked, f: path.found })
        : bi('Оболочка проверила единственный каталог PATH — `/opt/tools/bin`: там нет `ls`.', 'The shell checked the only PATH directory, `/opt/tools/bin`: there is no `ls` there.'),
      focus: ['e-lookup', 'path'],
      tokens: [{ edge: 'e-lookup', label: path.found ?? '?' }],
      values: { path: path.dirs.join(':') },
      states: { path: path.found ? 'ok' : 'err' },
      metrics: { checked: n.checked, forks: 0, execs: 0, status: 0 },
    };
    steps.push(lookup);
    if (!path.found) {
      steps.push({
        id: 'notfound',
        label: '127',
        caption: bi('Не найдено ни в одном каталоге: ни fork, ни exec не случились. Код 127.', 'Not found in any directory: neither fork nor exec happened. Code 127.'),
        focus: ['bash'],
        states: { bash: 'err' },
        metrics: { checked: n.checked, forks: 0, execs: 0, status: 127 },
        broken: { at: 'path', message: 'bash: ls: command not found', caption: bi('PATH заменили целиком, и `/usr/bin` выпал из списка; добавлять каталог надо так: `PATH="$PATH:/opt/tools/bin"`.', 'PATH was replaced as a whole and `/usr/bin` dropped out; add a directory like this: `PATH="$PATH:/opt/tools/bin"`.') },
      });
      return steps;
    }
    if (p.form === 'exec') {
      steps.push({
        id: 'noexec-fork',
        label: bi('без fork', 'no fork'),
        caption: bi('`exec` — копии не будет: оболочка сама станет программой. Её номер 2210 останется у `ls`.', '`exec` — there will be no copy: the shell itself becomes the program. Its number 2210 stays with `ls`.'),
        focus: ['bash'],
        values: { child: 'PID 2210', bash: 'PID 2210' },
        metrics: { checked: n.checked, forks: 0, execs: 0, status: 0 },
      });
    } else {
      steps.push({
        id: 'fork',
        label: 'fork',
        caption: bi('Оболочка просит ядро сделать её копию. У копии новый номер 2231, родитель — 2210, и те же открытые файлы: 1 смотрит в терминал.', 'The shell asks the kernel for a copy of itself. The copy gets a new number, 2231, its parent is 2210, and it has the same open files: 1 points to the terminal.'),
        focus: ['e-fork', 'child', 'kernel'],
        tokens: [{ edge: 'e-fork', label: 'clone()' }],
        states: { child: 'on' },
        values: { child: 'PID 2231 · bash' },
        metrics: { checked: n.checked, forks: 1, execs: 0, status: 0 },
      });
    }
    if (broken.has('redirect')) {
      steps.push({
        id: 'redir-fail',
        label: '>',
        caption: bi('Копия пытается открыть `/root/list.txt` — и получает отказ. До запуска ls дело не дошло.', 'The copy tries to open `/root/list.txt` and is refused. Things never got as far as starting ls.'),
        focus: ['e-redirect', 'child'],
        states: { child: 'err', 'e-redirect': 'err' },
        values: { file: '/root/list.txt' },
        metrics: { checked: n.checked, forks: n.forks, execs: 0, status: 1 },
        broken: { at: 'e-redirect', message: 'bash: /root/list.txt: Permission denied', caption: bi('перенаправление делает оболочка до запуска программы: ошибка пишется от имени bash, и `ls` не запускается вовсе.', 'the redirection is done by the shell before the program starts: the error is reported by bash, and `ls` never starts.') },
      });
      return steps;
    }
    steps.push({
      id: 'redirect',
      label: '> file',
      caption: bi('Копия открывает `list.txt` (обнуляя его) и ставит на место дескриптора 1. Теперь всё, что программа «печатает», уйдёт в файл.', 'The copy opens `list.txt` (truncating it) and puts it in place of descriptor 1. From now on everything the program “prints” goes into the file.'),
      focus: ['e-redirect', 'file'],
      tokens: [{ edge: 'e-redirect', label: 'fd 1' }],
      states: { file: 'on' },
      metrics: { checked: n.checked, forks: n.forks, execs: 0, status: 0 },
    });
    if (broken.has('no-x')) {
      steps.push({
        id: 'exec-fail',
        label: 'execve',
        caption: bi('Копия просит ядро загрузить `/usr/bin/ls`, но у файла нет бита x: ядро отказывает. Код 126 — «найдено, но нельзя запустить».', 'The copy asks the kernel to load `/usr/bin/ls`, but the file has no x bit: the kernel refuses. Code 126 — “found but cannot be run”.'),
        focus: ['e-exec', 'kernel'],
        states: { 'e-exec': 'err', child: 'err' },
        metrics: { checked: n.checked, forks: n.forks, execs: 0, status: 126 },
        broken: { at: 'e-exec', message: 'bash: /usr/bin/ls: Permission denied', caption: bi('право на запуск проверяется в момент exec; поиск по PATH пропускает такие файлы, но здесь путь уже был выбран.', 'the right to run is checked at exec; the PATH lookup skips such files, but here the path was already chosen.') },
      });
      return steps;
    }
    steps.push({
      id: 'exec',
      label: 'execve',
      caption: fmt(bi('Копия просит ядро заменить свою программу на `{f}`. Память стёрта, программа новая — номер тот же, и дескриптор 1 по-прежнему смотрит в файл.', 'The copy asks the kernel to replace its program with `{f}`. The memory is wiped, the program is new — the number is the same, and descriptor 1 still points to the file.'), { f: path.found }),
      focus: ['e-exec', 'child', 'kernel'],
      tokens: [{ edge: 'e-exec', label: 'execve' }],
      values: { child: `PID ${p.form === 'exec' ? 2210 : 2231} · ls` },
      metrics: { checked: n.checked, forks: n.forks, execs: 1, status: 0 },
    });
    steps.push({
      id: 'write',
      label: 'write',
      caption: bi('`ls` пишет список в дескриптор 1 — в файл. На экран ничего не попадает.', '`ls` writes the listing to descriptor 1 — into the file. Nothing reaches the screen.'),
      focus: ['e-redirect', 'file'],
      tokens: [{ edge: 'e-redirect', label: '2 KiB' }],
      values: { file: '2.1 KiB' },
      metrics: { checked: n.checked, forks: n.forks, execs: 1, status: 0 },
    });
    if (p.form === 'exec') {
      steps.push({
        id: 'gone',
        label: 'exit',
        caption: bi('`ls` закончил — а оболочки больше нет: она сама была этим процессом. Терминал закрывается, некому печатать приглашение.', '`ls` finished — and there is no shell any more: it was this very process. The terminal closes; nobody is left to print the prompt.'),
        focus: ['child', 'tty'],
        states: { bash: 'off', child: 'off', tty: 'off' },
        metrics: { checked: n.checked, forks: 0, execs: 1, status: 0 },
      });
      return steps;
    }
    if (p.form === 'bg') {
      steps.push({
        id: 'nowait',
        label: '&',
        caption: bi('С `&` оболочка не ждёт: сразу печатает `[1] 2231` и приглашение, а `ls` работает рядом. О завершении она скажет позже: `[1]+ Done`.', 'With `&` the shell does not wait: it prints `[1] 2231` and the prompt right away while `ls` runs alongside. It reports the end later: `[1]+ Done`.'),
        focus: ['e-prompt', 'tty'],
        tokens: [{ edge: 'e-prompt' }],
        metrics: { checked: n.checked, forks: 1, execs: 1, status: 0 },
      });
      return steps;
    }
    if (broken.has('no-wait')) {
      steps.push({
        id: 'zombie',
        label: 'Z',
        caption: bi('`ls` вышел, но родитель не вызвал wait: от процесса осталась строка в таблице с кодом завершения — зомби. Память уже свободна, номер — нет.', '`ls` exited, but the parent did not call wait: what is left of the process is a line in the table with its exit code — a zombie. The memory is free, the number is not.'),
        focus: ['child'],
        states: { child: 'warn', 'e-wait': 'err' },
        values: { child: 'PID 2231 · <defunct>' },
        metrics: { checked: n.checked, forks: 1, execs: 1, status: 0 },
        broken: { at: 'e-wait', message: '2231  2210 Z    [ls] <defunct>', caption: bi('зомби убирает не сигнал, а родитель: он должен забрать код (wait) или завершиться сам — тогда зомби заберёт первый процесс системы.', 'a zombie is removed not by a signal but by the parent: it must collect the code (wait) or exit itself — then the first process of the system collects it.') },
      });
      return steps;
    }
    steps.push({
      id: 'wait',
      label: 'wait',
      caption: bi('`ls` выходит с кодом 0. Оболочка всё это время ждала и теперь забирает код вызовом wait4; процесс 2231 исчезает из таблицы.', '`ls` exits with code 0. The shell was waiting all this time and now collects the code with wait4; process 2231 disappears from the table.'),
      focus: ['e-wait', 'bash'],
      tokens: [{ edge: 'e-wait', label: '0' }],
      states: { child: 'off' },
      metrics: { checked: n.checked, forks: 1, execs: 1, status: 0 },
    });
    steps.push({
      id: 'prompt',
      label: '$?',
      caption: bi('Код — в `$?`, на экране снова приглашение. Вся работа заняла миллисекунды.', 'The code is in `$?` and the prompt is back on screen. All of it took milliseconds.'),
      focus: ['e-prompt', 'tty'],
      tokens: [{ edge: 'e-prompt' }],
      metrics: { checked: n.checked, forks: 1, execs: 1, status: 0 },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const st = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: команда снова проходит путь до конца.', 'The break is removed: the command goes all the way again.');
      if (change.id === 'no-x') return bi('Без бита x ядро отказывает на exec: процесс уже создан, перенаправление сделано, но программа не загружена — код 126.', 'Without the x bit the kernel refuses at exec: the process exists and the redirection is done, but the program is not loaded — code 126.');
      if (change.id === 'redirect') return bi('Ошибка перенаправления случается в копии оболочки до exec — поэтому сообщение от bash, а не от ls.', 'The redirection error happens in the copy of the shell before exec — that is why the message comes from bash, not from ls.');
      return bi('Родитель не забрал код: от процесса остаётся зомби, строка в таблице процессов.', 'The parent did not collect the code: a zombie is left, a line in the process table.');
    }
    if (change.id === 'form') {
      const f = b.form;
      if (f === 'cd') return bi('`cd` выполняет сама оболочка: шаги поиска, fork и exec исчезли — изменить каталог копии было бы бесполезно.', '`cd` is run by the shell itself: the lookup, fork and exec steps are gone — changing the directory of a copy would be useless.');
      if (f === 'exec') return bi('`exec` пропускает fork: программой становится сама оболочка, и после её выхода терминал закрывается.', '`exec` skips the fork: the shell itself becomes the program, and when it exits the terminal closes.');
      if (f === 'bg') return bi('С `&` пропал шаг ожидания: приглашение появляется сразу, а код завершения оболочка узнает позже.', 'With `&` the waiting step is gone: the prompt comes back at once, and the shell learns the exit code later.');
      return fmt(bi('Обычная команда: fork {a} → {b}, exec — один раз, оболочка ждёт.', 'An ordinary command: fork {a} → {b}, one exec, the shell waits.'), { a: st(prev).forks ?? 0, b: st(next).forks ?? 0 });
    }
    if (change.id === 'path') {
      if (b.path === 'broken') return bi('PATH=/opt/tools/bin: оболочка не нашла `ls` ни в одном каталоге и не создала процесс — код 127.', 'PATH=/opt/tools/bin: the shell found `ls` in no directory and created no process — code 127.');
      if (b.path === 'mine') return bi('`~/bin` стоит первым — выигрывает ваш `ls`, хотя `/usr/bin/ls` никуда не делся: решает порядок каталогов.', '`~/bin` comes first — your `ls` wins although `/usr/bin/ls` is still there: the order of the directories decides.');
      return fmt(bi('Обычный PATH: `ls` найден во втором каталоге из трёх ({a} → {b} проверок).', 'The usual PATH: `ls` is found in the second of three directories ({a} → {b} checks).'), { a: st(prev).checked ?? 0, b: st(next).checked ?? 0 });
    }
    void a;
    return bi('Параметр изменился — процесс пересчитан.', 'The parameter changed — the process was recomputed.');
  },
});
