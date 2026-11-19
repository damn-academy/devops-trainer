// Demo process explainer: the pipeline `ls /etc | grep conf` (08 §7.2.2).
// It proves the explainer primitive end to end: knobs that recompute the
// process, breaks that stop it at the break, predictions, cards. The Linux
// block may replace it with its own `linux.pipe` model.

import { defineModel } from '../../core/define';
import { bi, fmt, type Bi } from '../../core/i18n';
import type { Step } from '../../core/types';

type P = { names: number; buffer: string; reader: string; match: boolean };

const BYTES_PER_NAME = 14; // average file name plus the newline
const STDIO = 4096; // ls writes through a 4 KiB stdio buffer when its output is not a terminal

const doc = {
  pipe7: { url: 'https://man7.org/linux/man-pages/man7/pipe.7.html', label: 'pipe(7)' },
  fork2: { url: 'https://man7.org/linux/man-pages/man2/fork.2.html', label: 'fork(2)' },
  write2: { url: 'https://man7.org/linux/man-pages/man2/write.2.html', label: 'write(2)' },
  read2: { url: 'https://man7.org/linux/man-pages/man2/read.2.html', label: 'read(2)' },
  bash: { url: 'https://www.gnu.org/software/bash/manual/html_node/Pipelines.html', label: 'Bash manual › Pipelines' },
  tty: { url: 'https://man7.org/linux/man-pages/man4/pts.4.html', label: 'pts(4)' },
  signal7: { url: 'https://man7.org/linux/man-pages/man7/signal.7.html', label: 'signal(7)' },
};

const kib = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(n % 1024 ? 1 : 0)} KiB` : `${n} B`);

export interface PipeRun {
  total: number;
  cap: number;
  waits: number;
  ms: number;
  sigpipe: boolean;
}

/** The arithmetic of the pipeline, separate from the steps so tests can check it. */
export function pipeNumbers(p: P, readerExits: boolean): PipeRun {
  const total = p.names * BYTES_PER_NAME;
  const cap = p.buffer === '4k' ? 4096 : 65536;
  const writer = 1000; // bytes per model millisecond
  const reader = p.reader === 'slow' ? 250 : 1000;
  if (readerExits) {
    // The reader takes one read and leaves. Whatever does not fit in the pipe meets a closed read end.
    return { total, cap, waits: 0, ms: Math.min(total, cap) / writer, sigpipe: total > cap };
  }
  const waits = reader < writer && total > cap ? Math.ceil((total - cap) / STDIO) : 0;
  const ms = total / Math.min(writer, reader);
  return { total, cap, waits, ms: Math.round(ms), sigpipe: false };
}

export const pipeModel = defineModel<P>({
  id: 'demo.pipe',
  block: 'demo',
  title: bi('Конвейер: ls /etc | grep conf', 'A pipeline: ls /etc | grep conf'),
  summary: bi(
    'Оболочка соединяет вывод одной программы со входом другой через буфер в ядре. Двигайте ручки и ломайте — процесс пересчитается.',
    'The shell connects the output of one program to the input of another through a buffer in the kernel. Move the knobs and break things — the process is recomputed.',
  ),
  concepts: ['demo.pipe', 'demo.exit-code'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      {
        id: 'kernel',
        label: bi('Ядро Linux', 'Linux kernel'),
        family: 'kernel',
        shape: 'bar',
        x: 16,
        y: 340,
        w: 928,
        h: 120,
        card: {
          what: bi('Одно ядро на всю машину. Труба — его объект: буфер в памяти ядра, а не файл на диске.', 'One kernel for the whole machine. The pipe is its object: a buffer in kernel memory, not a file on disk.'),
          who: bi('Загружается при старте машины.', 'Loaded when the machine boots.'),
          see: 'uname -r',
        },
      },
      {
        id: 'bash',
        label: 'bash',
        sub: 'PID 4120',
        family: 'process',
        x: 40,
        y: 40,
        w: 200,
        h: 64,
        card: {
          what: bi('Оболочка: читает строку, находит `|`, создаёт трубу и запускает обе программы.', 'The shell: reads the line, finds `|`, creates the pipe and starts both programs.'),
          who: bi('Запускается при входе в систему.', 'Started when you log in.'),
          see: 'echo $$',
          doc: doc.bash,
        },
      },
      {
        id: 'tty',
        label: bi('Терминал', 'Terminal'),
        sub: '/dev/pts/0',
        family: 'user',
        x: 720,
        y: 40,
        w: 200,
        h: 64,
        card: {
          what: bi('Устройство терминала: сюда попадает то, что программа пишет в дескриптор 1, если его не перенаправили.', 'The terminal device: what a program writes to descriptor 1 ends up here unless it was redirected.'),
          who: bi('Создаётся при открытии окна терминала или входе по SSH.', 'Created when a terminal window opens or an SSH login starts.'),
          see: 'tty',
          doc: doc.tty,
        },
      },
      {
        id: 'ls',
        label: 'ls /etc',
        sub: 'PID 4121',
        family: 'process',
        x: 40,
        y: 200,
        w: 200,
        h: 64,
        card: {
          what: bi('Писатель. Не знает, что за его выводом стоит труба: просто пишет в дескриптор 1.', 'The writer. It does not know a pipe is behind its output: it just writes to descriptor 1.'),
          who: bi('Оболочка: fork, затем exec ls с дескриптором 1 на конце трубы для записи.', 'The shell: fork, then exec ls with descriptor 1 on the write end of the pipe.'),
          see: 'ls -l /proc/4121/fd',
          doc: { page: 'man/ls.1', anchor: 'DESCRIPTION' },
        },
      },
      {
        id: 'grep',
        label: 'grep conf',
        sub: 'PID 4122',
        family: 'process',
        x: 720,
        y: 200,
        w: 200,
        h: 64,
        card: {
          what: bi('Читатель. Читает дескриптор 0 и печатает строки, где есть образец.', 'The reader. Reads descriptor 0 and prints the lines that contain the pattern.'),
          who: bi('Оболочка: fork, затем exec grep с дескриптором 0 на конце трубы для чтения.', 'The shell: fork, then exec grep with descriptor 0 on the read end of the pipe.'),
          see: 'grep --help',
          doc: { page: 'man/grep.1', anchor: 'EXIT STATUS' },
        },
      },
      {
        id: 'pipe',
        label: bi('труба', 'pipe'),
        sub: { ru: '0 Б / 64 КиБ', en: '0 B / 64 KiB' },
        family: 'kernel',
        shape: 'buffer',
        x: 360,
        y: 368,
        w: 240,
        h: 72,
        card: {
          what: bi('Буфер ядра с двумя концами: в один пишут, из другого читают. Полный буфер усыпляет писателя, пустой — читателя.', 'A kernel buffer with two ends: one is written, the other is read. A full buffer puts the writer to sleep, an empty one the reader.'),
          who: bi('Ядро по системному вызову pipe2(), который делает оболочка.', 'The kernel, on the pipe2() system call the shell makes.'),
          see: 'ls -l /proc/$$/fd',
          doc: doc.pipe7,
        },
      },
    ],
    edges: [
      {
        id: 'e-fork-ls',
        from: 'bash',
        to: 'ls',
        label: 'fork + exec',
        card: { what: bi('Оболочка копирует себя (fork), и копия превращается в ls (exec).', 'The shell copies itself (fork) and the copy turns into ls (exec).'), who: bi('bash', 'bash'), doc: doc.fork2 },
      },
      {
        id: 'e-fork-grep',
        from: 'bash',
        to: 'grep',
        via: [
          [480, 72],
          [480, 232],
        ],
        label: 'fork + exec',
        labelAt: 0.32,
        card: { what: bi('Вторая копия оболочки становится grep. Обе программы работают одновременно.', 'The second copy of the shell becomes grep. Both programs run at the same time.'), who: bi('bash', 'bash'), doc: doc.fork2 },
      },
      {
        id: 'e-write',
        from: 'ls',
        to: 'pipe',
        via: [[140, 404]],
        label: 'fd 1 → write()',
        labelAt: 0.35,
        card: { what: bi('Дескриптор 1 (stdout) писателя указывает на конец трубы для записи.', 'Descriptor 1 (stdout) of the writer points to the write end of the pipe.'), who: bi('Оболочка переставила дескриптор до exec (dup2).', 'The shell moved the descriptor before exec (dup2).'), see: 'ls -l /proc/4121/fd/1', doc: doc.write2 },
      },
      {
        id: 'e-read',
        from: 'pipe',
        to: 'grep',
        via: [[820, 404]],
        label: 'read() → fd 0',
        labelAt: 0.62,
        card: { what: bi('Дескриптор 0 (stdin) читателя указывает на конец трубы для чтения.', 'Descriptor 0 (stdin) of the reader points to the read end of the pipe.'), who: bi('Оболочка, тем же dup2 до exec.', 'The shell, with the same dup2 before exec.'), see: 'ls -l /proc/4122/fd/0', doc: doc.read2 },
      },
      {
        id: 'e-out',
        from: 'grep',
        to: 'tty',
        label: 'fd 1 → write()',
        card: { what: bi('У grep дескриптор 1 не перенаправлен: найденные строки идут прямо в терминал.', 'grep’s descriptor 1 is not redirected: matching lines go straight to the terminal.'), who: bi('Унаследован от оболочки.', 'Inherited from the shell.'), see: 'ls -l /proc/4122/fd/1', doc: doc.write2 },
      },
    ],
  },
  params: [
    {
      id: 'names',
      label: bi('Сколько имён печатает ls', 'How many names ls prints'),
      kind: 'range',
      min: 10,
      max: 20000,
      step: 10,
      default: 6000,
      near: 'ls',
      predict: {
        prompt: bi('Если имён станет мало, будет ли ls ждать, пока grep освободит буфер?', 'With only a few names, will ls ever wait for grep to free the buffer?'),
        options: [
          { id: 'waits', text: bi('Да, ждёт так же', 'Yes, it waits just the same') },
          { id: 'nowait', text: bi('Нет, всё поместится в буфер сразу', 'No, everything fits in the buffer at once') },
        ],
        resolve: (_prev, next) => ((next[next.length - 1]?.metrics?.waits ?? 0) > 0 ? 'waits' : 'nowait'),
      },
    },
    {
      id: 'buffer',
      label: bi('Ёмкость трубы', 'Pipe capacity'),
      kind: 'choice',
      default: '64k',
      options: [
        { id: '4k', label: bi('4 КиБ', '4 KiB') },
        { id: '64k', label: bi('64 КиБ (по умолчанию)', '64 KiB (default)') },
      ],
      near: 'pipe',
    },
    {
      id: 'reader',
      label: bi('Скорость grep', 'Speed of grep'),
      kind: 'choice',
      default: 'slow',
      options: [
        { id: 'same', label: bi('как у ls', 'same as ls') },
        { id: 'slow', label: bi('в 4 раза медленнее', '4 times slower') },
      ],
      near: 'grep',
      predict: {
        prompt: bi('grep стал таким же быстрым, как ls. Что станет с ожиданием писателя?', 'grep is now as fast as ls. What happens to the writer’s waiting?'),
        options: [
          { id: 'gone', text: bi('Ожидания исчезнут', 'The waiting disappears') },
          { id: 'same', text: bi('Ничего не изменится', 'Nothing changes') },
        ],
        resolve: (_prev, next) => ((next[next.length - 1]?.metrics?.waits ?? 0) === 0 ? 'gone' : 'same'),
      },
    },
    {
      id: 'match',
      label: bi('grep находит совпадения', 'grep finds matches'),
      kind: 'toggle',
      default: true,
      near: 'grep',
      predict: {
        prompt: bi('grep ничего не нашёл. Какой код окажется в $?', 'grep found nothing. What will $? hold?'),
        options: [
          { id: '0', text: bi('0 — ведь ls отработал успешно', '0 — ls succeeded after all') },
          { id: '1', text: bi('1 — код последней команды конвейера', '1 — the code of the last command in the pipeline') },
        ],
        resolve: (_prev, next) => String(next[next.length - 1]?.metrics?.status ?? 0),
      },
    },
  ],
  breaks: [
    {
      id: 'reader-exits',
      label: bi('Читатель уходит раньше (как head -n 3)', 'The reader leaves early (like head -n 3)'),
      remove: ['e-read'],
      boundary: 'process',
      predict: {
        prompt: bi('grep прочитал немного и вышел. Что будет с ls?', 'grep read a little and exited. What happens to ls?'),
        options: [
          { id: 'sigpipe', text: bi('ls получит SIGPIPE и завершится с кодом 141', 'ls gets SIGPIPE and ends with code 141') },
          { id: 'waits', text: bi('ls будет вечно ждать', 'ls waits forever') },
          { id: 'ok', text: bi('ls спокойно допишет и выйдет с кодом 0', 'ls finishes writing and exits with code 0') },
        ],
        resolve: (_prev, next) => (next.some((s) => s.broken) ? 'sigpipe' : 'ok'),
      },
    },
    {
      id: 'no-pipe',
      label: bi('Забыли | : набрали ls /etc grep conf', 'Forgot the | : typed ls /etc grep conf'),
      remove: ['pipe', 'e-write', 'e-read', 'e-fork-grep'],
      boundary: 'io',
      predict: {
        prompt: bi('В строке нет |. Что сделает оболочка?', 'There is no | in the line. What does the shell do?'),
        options: [
          { id: 'args', text: bi('Запустит один ls с тремя аргументами', 'Run a single ls with three arguments') },
          { id: 'guess', text: bi('Догадается и соединит ls и grep', 'Guess and connect ls and grep') },
        ],
        resolve: () => 'args',
      },
    },
  ],
  metrics: [
    { id: 'bytes', label: bi('прошло через трубу', 'through the pipe'), unit: { ru: 'Б', en: 'B' } },
    { id: 'waits', label: bi('раз ls ждал', 'times ls waited') },
    { id: 'ms', label: bi('время модели', 'model time'), unit: { ru: 'мс', en: 'ms' } },
    { id: 'status', label: bi('$?', '$?') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const cap = p.buffer === '4k' ? 4096 : 65536;
    if (broken.has('no-pipe')) {
      steps.push(
        { id: 'parse', label: 'parse', caption: bi('Оболочка читает строку и не находит `|`: это одна команда с тремя аргументами.', 'The shell reads the line and finds no `|`: it is one command with three arguments.'), focus: ['bash'], states: { grep: 'off', pipe: 'off' } },
        { id: 'fork-ls', label: 'fork', caption: bi('Запускается один ls, его вывод идёт прямо в терминал.', 'A single ls starts; its output goes straight to the terminal.'), focus: ['ls', 'e-fork-ls'], tokens: [{ edge: 'e-fork-ls' }], states: { ls: 'on' } },
        {
          id: 'error',
          label: 'error',
          caption: bi('ls ищет файлы «grep» и «conf» в текущем каталоге и не находит.', 'ls looks for files named “grep” and “conf” in the current directory and finds none.'),
          focus: ['ls'],
          states: { ls: 'err' },
          metrics: { bytes: 0, waits: 0, ms: 1, status: 2 },
          broken: { at: 'ls', message: "ls: cannot access 'grep': No such file or directory\nls: cannot access 'conf': No such file or directory", caption: bi('без | оболочка не создаёт трубу: слова после ls — просто его аргументы.', 'without | the shell creates no pipe: the words after ls are just its arguments.') },
        },
      );
      return steps;
    }
    const exits = broken.has('reader-exits');
    const n = pipeNumbers(p, exits);
    steps.push(
      { id: 'parse', label: 'parse', caption: bi('Оболочка читает строку и находит `|`: две программы, вывод первой — вход второй.', 'The shell reads the line and finds `|`: two programs, the output of the first is the input of the second.'), focus: ['bash'], states: { bash: 'on', ls: 'off', grep: 'off' } },
      { id: 'pipe2', label: 'pipe2', caption: fmt(bi('Оболочка просит ядро создать трубу: буфер на {cap} и два дескриптора, для записи и для чтения.', 'The shell asks the kernel for a pipe: a {cap} buffer and two descriptors, one to write and one to read.'), { cap: kib(cap) }), focus: ['pipe', 'kernel'], values: { pipe: `0 B / ${kib(cap)}` }, fill: { pipe: 0 } },
      { id: 'fork-ls', label: 'fork ls', caption: bi('Первая копия оболочки ставит дескриптор 1 на конец для записи и превращается в ls.', 'The first copy of the shell puts descriptor 1 on the write end and turns into ls.'), focus: ['e-fork-ls', 'ls'], tokens: [{ edge: 'e-fork-ls' }], states: { ls: 'on' } },
      { id: 'fork-grep', label: 'fork grep', caption: bi('Вторая копия ставит дескриптор 0 на конец для чтения и превращается в grep.', 'The second copy puts descriptor 0 on the read end and turns into grep.'), focus: ['e-fork-grep', 'grep'], tokens: [{ edge: 'e-fork-grep' }], states: { grep: 'on' } },
    );
    const first = Math.min(n.total, cap);
    steps.push({
      id: 'write',
      label: 'write',
      caption: fmt(bi('ls пишет имена в дескриптор 1, данные копятся в буфере ядра: {b}.', 'ls writes names to descriptor 1; the data piles up in the kernel buffer: {b}.'), { b: kib(first) }),
      focus: ['e-write', 'pipe'],
      tokens: [{ edge: 'e-write', label: kib(Math.min(n.total, STDIO)) }],
      values: { pipe: `${kib(first)} / ${kib(cap)}` },
      fill: { pipe: first / cap },
      metrics: { bytes: first, waits: 0, ms: Math.round(first / 1000) },
    });
    if (exits) {
      steps.push({
        id: 'read-exit',
        label: 'read, exit',
        caption: bi('grep читает одну порцию и выходит. Конец трубы для чтения закрыт — читать больше некому.', 'grep reads one chunk and exits. The read end is closed: nobody will read any more.'),
        focus: ['grep', 'pipe'],
        states: { grep: 'off', 'e-read': 'off' },
        values: { pipe: `0 B / ${kib(cap)}` },
        fill: { pipe: 0 },
      });
      if (n.sigpipe) {
        steps.push({
          id: 'sigpipe',
          label: 'SIGPIPE',
          caption: bi('ls пишет следующую порцию в трубу без читателя: ядро шлёт ему SIGPIPE, и ls умирает.', 'ls writes the next chunk into a pipe with no reader: the kernel sends it SIGPIPE and ls dies.'),
          focus: ['e-write', 'ls'],
          states: { ls: 'err', 'e-write': 'err' },
          metrics: { bytes: first, waits: 0, ms: Math.round(n.ms), status: 0 },
          broken: { at: 'e-write', message: '$ ls /etc | head -n 3; echo "${PIPESTATUS[@]}"\n…\n141 0', caption: bi('код 141 = 128 + 13: процесс убит сигналом 13, SIGPIPE.', 'code 141 = 128 + 13: the process was killed by signal 13, SIGPIPE.') },
        });
        return steps;
      }
      steps.push({
        id: 'done',
        label: 'exit',
        caption: bi('Всё, что ls хотел написать, уже лежало в буфере: он закончил раньше, чем grep ушёл, и вышел с кодом 0.', 'Everything ls wanted to write was already in the buffer: it finished before grep left and exited with code 0.'),
        focus: ['ls', 'bash'],
        states: { ls: 'off', bash: 'on' },
        metrics: { bytes: first, waits: 0, ms: Math.round(n.ms), status: 0 },
      });
      return steps;
    }
    if (n.waits > 0) {
      steps.push(
        {
          id: 'full',
          label: bi('полон', 'full'),
          caption: bi('Буфер полон. Следующий write() усыпляет ls: писатель ждёт, пока читатель освободит место.', 'The buffer is full. The next write() puts ls to sleep: the writer waits until the reader frees some room.'),
          focus: ['pipe', 'ls'],
          states: { ls: 'wait' },
          values: { pipe: `${kib(cap)} / ${kib(cap)}`, ls: 'waits: pipe full' },
          fill: { pipe: 1 },
        },
        {
          id: 'drain',
          label: 'read',
          caption: fmt(bi('grep читает, ls просыпается и дописывает. Так {w} раз: дальше ls работает со скоростью grep.', 'grep reads, ls wakes up and writes more. {w} times over: from here ls runs at grep’s speed.'), { w: n.waits }),
          focus: ['e-read', 'e-write', 'pipe'],
          tokens: [{ edge: 'e-read' }, { edge: 'e-write' }],
          states: { ls: 'on' },
          values: { ls: 'PID 4121' },
          metrics: { bytes: n.total, waits: n.waits, ms: n.ms },
        },
      );
    } else {
      steps.push({
        id: 'read',
        label: 'read',
        caption: n.total <= cap ? bi('grep читает из буфера. Всё поместилось сразу: ls ни разу не ждал.', 'grep reads from the buffer. Everything fitted at once: ls never waited.') : bi('grep читает так же быстро, как ls пишет: буфер не успевает заполниться.', 'grep reads as fast as ls writes: the buffer never fills up.'),
        focus: ['e-read', 'pipe'],
        tokens: [{ edge: 'e-read' }],
        values: { pipe: `0 B / ${kib(cap)}` },
        fill: { pipe: 0.1 },
        metrics: { bytes: n.total, waits: 0, ms: n.ms },
      });
    }
    steps.push(
      {
        id: 'out',
        label: 'print',
        caption: p.match ? bi('Строки с «conf» grep пишет в свой дескриптор 1 — в терминал.', 'grep writes the lines with “conf” to its descriptor 1: the terminal.') : bi('Совпадений нет: grep ничего не пишет в терминал.', 'No matches: grep writes nothing to the terminal.'),
        focus: p.match ? ['e-out', 'tty'] : ['grep'],
        tokens: p.match ? [{ edge: 'e-out', label: 'nginx.conf' }] : [],
        states: p.match ? { tty: 'on' } : {},
      },
      {
        id: 'eof',
        label: 'EOF',
        caption: bi('ls дописал и вышел с кодом 0. Конец для записи закрылся, и следующий read() у grep вернул 0 — конец данных.', 'ls finished and exited with code 0. The write end closed, so grep’s next read() returned 0: end of data.'),
        focus: ['ls', 'e-read'],
        states: { ls: 'off' },
        fill: { pipe: 0 },
        values: { pipe: `0 B / ${kib(cap)}` },
      },
      {
        id: 'wait',
        label: '$?',
        caption: p.match ? bi('grep выходит с кодом 0. Оболочка дождалась обоих; в $? — код последней команды: 0.', 'grep exits with code 0. The shell waited for both; $? holds the code of the last command: 0.') : bi('grep выходит с кодом 1 («не нашёл»). В $? — 1, хотя ls отработал успешно; PIPESTATUS покажет «0 1».', 'grep exits with code 1 (“not found”). $? is 1 even though ls succeeded; PIPESTATUS shows “0 1”.'),
        focus: ['bash', 'grep'],
        states: { grep: 'off', bash: 'on' },
        metrics: { bytes: n.total, waits: n.waits, ms: n.ms, status: p.match ? 0 : 1 },
      },
    );
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    const w0 = last(prev).waits ?? 0;
    const w1 = last(next).waits ?? 0;
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: процесс снова идёт до конца.', 'The break is removed: the process runs to the end again.');
      if (change.id === 'no-pipe') return bi('Без | нет трубы и второго процесса: ls получает «grep» и «conf» как имена файлов и завершается с кодом 2.', 'Without | there is no pipe and no second process: ls gets “grep” and “conf” as file names and ends with code 2.');
      return next.some((s) => s.broken)
        ? bi('Читатель ушёл, а писателю ещё есть что сказать: запись в трубу без читателя — сигнал SIGPIPE, код 141.', 'The reader left while the writer still had data: writing into a pipe with no reader means SIGPIPE, code 141.')
        : bi('Читатель ушёл, но весь вывод ls уже был в буфере: писать больше нечего, SIGPIPE не приходит, код 0.', 'The reader left, but all of ls’s output was already in the buffer: nothing more to write, no SIGPIPE, code 0.');
    }
    switch (change.id) {
      case 'names': {
        const total = (b.names as number) * BYTES_PER_NAME;
        const cap = b.buffer === '4k' ? 4096 : 65536;
        return total > cap
          ? fmt(bi('{a} → {b} имён: {t} не помещаются в трубу на {c}, ls ждёт {w} раз.', '{a} → {b} names: {t} do not fit in a {c} pipe, ls waits {w} times.'), { a: a.names as number, b: b.names as number, t: kib(total), c: kib(cap), w: w1 })
          : fmt(bi('{a} → {b} имён: {t} помещаются в трубу на {c} целиком — ls ни разу не ждёт.', '{a} → {b} names: {t} fit in the {c} pipe whole — ls never waits.'), { a: a.names as number, b: b.names as number, t: kib(total), c: kib(cap) });
      }
      case 'buffer':
        return fmt(bi('Ёмкость трубы {a} → {b}: ls ждёт {w1} раз вместо {w0}. Меньший буфер — чаще засыпает писатель.', 'Pipe capacity {a} → {b}: ls waits {w1} times instead of {w0}. A smaller buffer puts the writer to sleep more often.'), {
          a: a.buffer === '4k' ? '4 KiB' : '64 KiB',
          b: b.buffer === '4k' ? '4 KiB' : '64 KiB',
          w0,
          w1,
        });
      case 'reader':
        return b.reader === 'slow'
          ? fmt(bi('grep в 4 раза медленнее: буфер заполняется, и дальше ls пишет со скоростью grep — {w} ожиданий.', 'grep is 4 times slower: the buffer fills, and from then on ls writes at grep’s speed — {w} waits.'), { w: w1 })
          : bi('grep читает так же быстро, как ls пишет: буфер не заполняется, ожиданий нет.', 'grep reads as fast as ls writes: the buffer never fills, no waits.');
      case 'match':
        return b.match
          ? bi('grep снова находит строки: код 0, вывод в терминале.', 'grep finds lines again: code 0, output in the terminal.')
          : bi('grep ничего не нашёл: код 1. $? показывает код последней команды конвейера, а не первой.', 'grep found nothing: code 1. $? shows the code of the last command of the pipeline, not the first.');
    }
    return bi('Параметр изменился, процесс пересчитан.', 'The parameter changed; the process was recomputed.');
  },
});
