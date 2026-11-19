// X3 «A pipeline: processes and kernel buffers» (02 §6.6 X3, layer 2 of M8,
// first shown in the streams lesson as layer 1). The pipeline
//   grep ' 500 ' access.log | cut -d' ' -f1 | sort | uniq -c
// runs on a log generated from the knobs, so every number on the screen is
// computed, not drawn: lines in, lines that pass grep, distinct addresses,
// and what uniq -c prints with and without sort in front of it.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';

type P = { lines: number; errors: number; sorted: boolean; stderr: string };

const POOL = ['10.0.0.7', '10.0.0.3', '10.0.0.12', '10.0.0.5', '10.0.0.9'];

/** A deterministic log: every k-th line is a 500, the clients repeat in a fixed pattern. */
export function makeLog(lines: number, errorsPct: number): string[] {
  const out: string[] = [];
  const every = errorsPct <= 0 ? Infinity : Math.max(1, Math.round(100 / errorsPct));
  for (let i = 0; i < lines; i++) {
    const ip = POOL[(i * 7 + (i % 3)) % POOL.length];
    const status = (i + 1) % every === 0 ? 500 : 200;
    out.push(`${ip} GET /orders/${i % 40} ${status}`);
  }
  return out;
}

export interface PipeNumbers {
  lines: number;
  matched: number;
  distinct: number;
  /** Lines uniq -c prints (with sort: one per address; without: one per run). */
  printed: number;
  top: string;
  topCount: number;
}

export function pipeNumbers(p: P): PipeNumbers {
  const log = makeLog(p.lines, p.errors);
  const matched = log.filter((l) => l.endsWith(' 500')).map((l) => l.split(' ')[0]);
  const input = p.sorted ? [...matched].sort() : matched;
  const runs: { ip: string; n: number }[] = [];
  for (const ip of input) {
    const last = runs[runs.length - 1];
    if (last && last.ip === ip) last.n++;
    else runs.push({ ip, n: 1 });
  }
  const best = [...runs].sort((a, b) => b.n - a.n)[0];
  return { lines: log.length, matched: matched.length, distinct: new Set(matched).size, printed: runs.length, top: best?.ip ?? '-', topCount: best?.n ?? 0 };
}

const doc = {
  pipe7: { url: 'https://man7.org/linux/man-pages/man7/pipe.7.html', label: 'pipe(7)' },
  bash: { page: 'man/bash.1', anchor: 'PIPELINES' },
};

const proc = (id: string, label: string, x: number, what: Bi, see: string, page: string) => ({
  id,
  label,
  sub: '',
  family: 'process' as const,
  x,
  y: 56,
  w: 176,
  h: 64,
  card: { what, who: bi('Оболочка: fork + exec для каждой команды конвейера, все запускаются одновременно.', 'The shell: fork + exec for every command of the pipeline; all of them start at once.'), see, doc: { page, anchor: 'DESCRIPTION' } },
});

const buf = (id: string, x: number) => ({
  id,
  label: bi('труба', 'pipe'),
  sub: '0 / 64 KiB',
  family: 'kernel' as const,
  shape: 'buffer' as const,
  x,
  y: 300,
  w: 150,
  h: 60,
  card: {
    what: bi('Буфер в памяти ядра с двумя концами: левая команда пишет в него свой вывод (дескриптор 1), правая читает свой ввод (дескриптор 0). Полный буфер усыпляет писателя, пустой — читателя.', 'A buffer in kernel memory with two ends: the command on the left writes its output into it (descriptor 1), the one on the right reads its input from it (descriptor 0). A full buffer puts the writer to sleep, an empty one the reader.'),
    who: bi('Ядро, по вызову pipe2() оболочки — до запуска команд.', 'The kernel, on the shell’s pipe2() call — before the commands start.'),
    see: 'ls -l /proc/$$/fd',
    doc: doc.pipe7,
  },
});

export const pipeModel = defineModel<P>({
  id: 'linux.pipe',
  block: 'linux',
  title: bi('Конвейер: вывод одной команды — вход следующей', 'A pipeline: the output of one command is the input of the next'),
  summary: bi(
    'Четыре программы работают одновременно, а между ними — буферы в памяти ядра. Меняйте журнал и смотрите, как меняется каждая цифра; уберите sort и увидите, почему uniq без него врёт.',
    'Four programs run at the same time with kernel buffers between them. Change the log and watch every number change; remove sort and see why uniq lies without it.',
  ),
  concepts: ['linux.pipe', 'linux.stream'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      proc('grep', "grep ' 500 '", 16, bi('Оставляет только строки, где есть ` 500 ` — ответы с ошибкой сервера. Остальные строки дальше не идут.', 'Keeps only the lines with ` 500 ` — the answers with a server error. Other lines go no further.'), "grep -c ' 500 ' access.log", 'man/grep.1'),
      proc('cut', "cut -d' ' -f1", 260, bi('Из каждой строки берёт первое поле (поля разделены пробелом) — адрес клиента.', 'Takes the first field of every line (the fields are separated by a space) — the client address.'), "cut -d' ' -f1 access.log | head -3", 'man/cut.1'),
      proc('sort', 'sort', 504, bi('Упорядочивает строки. Он обязан прочитать вход до конца, прежде чем напечатать первую строку, — поэтому его вывод появляется весь сразу.', 'Puts the lines in order. It must read the whole input before it can print the first line — that is why its output appears all at once.'), 'sort --help', 'man/sort.1'),
      proc('uniq', 'uniq -c', 748, bi('Склеивает одинаковые соседние строки и пишет, сколько их было. Только соседние: поэтому перед ним нужен sort.', 'Merges identical adjacent lines and prints how many there were. Adjacent only: that is why it needs sort in front of it.'), 'uniq --help', 'man/uniq.1'),
      {
        id: 'log',
        label: 'access.log',
        sub: '0 lines',
        family: 'store',
        shape: 'doc',
        x: 16,
        y: 180,
        w: 176,
        h: 56,
        card: { what: bi('Журнал веб-сервера: строка на запрос — адрес клиента, метод, путь, код ответа.', 'A web server log: one line per request — client address, method, path, response code.'), who: bi('Пишет веб-сервер; grep открывает файл сам, по имени.', 'Written by the web server; grep opens the file itself, by name.'), see: 'head -3 access.log' },
      },
      {
        id: 'tty',
        label: bi('терминал', 'terminal'),
        sub: '',
        family: 'user',
        x: 748,
        y: 180,
        w: 176,
        h: 56,
        card: { what: bi('Сюда попадает вывод последней команды — и ошибки всех команд: поток 2 в трубы не идёт.', 'The output of the last command ends up here — and the errors of all commands: stream 2 does not go into the pipes.'), who: bi('Унаследован всеми командами от оболочки.', 'Inherited by all commands from the shell.'), see: 'tty' },
      },
      buf('p1', 138),
      buf('p2', 382),
      buf('p3', 626),
      {
        id: 'kernel',
        label: bi('ядро Linux', 'Linux kernel'),
        family: 'kernel',
        shape: 'bar',
        x: 16,
        y: 280,
        w: 928,
        h: 176,
        card: { what: bi('Трубы — объекты ядра. Команды не знают друг о друге: каждая просто читает дескриптор 0 и пишет в 1.', 'Pipes are kernel objects. The commands do not know about each other: each just reads descriptor 0 and writes to 1.'), who: bi('Одно на всю машину.', 'One for the whole machine.'), see: 'uname -r' },
      },
    ],
    edges: [
      { id: 'e-read', from: 'log', to: 'grep', label: 'open()', card: { what: bi('grep открывает журнал по имени — это его аргумент, а не стандартный ввод.', 'grep opens the log by name — it is its argument, not its standard input.'), who: bi('grep', 'grep') } },
      { id: 'e-w1', from: 'grep', to: 'p1', via: [[104, 330]], label: 'fd 1', labelAt: 0.35, card: { what: bi('Вывод grep идёт не на экран, а в первую трубу.', 'grep’s output goes not to the screen but into the first pipe.'), who: bi('Оболочка поставила дескриптор 1 на трубу до exec.', 'The shell pointed descriptor 1 at the pipe before exec.'), doc: doc.bash } },
      { id: 'e-r1', from: 'p1', to: 'cut', via: [[348, 330]], label: 'fd 0', labelAt: 0.65, card: { what: bi('cut читает свой ввод из первой трубы.', 'cut reads its input from the first pipe.'), who: bi('Оболочка, до exec.', 'The shell, before exec.'), doc: doc.bash } },
      { id: 'e-w2', from: 'cut', to: 'p2', via: [[348, 330]], label: 'fd 1', labelAt: 0.35, card: { what: bi('Адреса — во вторую трубу.', 'The addresses go into the second pipe.'), who: bi('Оболочка', 'The shell') } },
      { id: 'e-r2', from: 'p2', to: 'sort', via: [[592, 330]], label: 'fd 0', labelAt: 0.65, card: { what: bi('sort копит у себя всё, что приходит, до конца данных.', 'sort keeps everything that arrives until the end of the data.'), who: bi('Оболочка', 'The shell') } },
      { id: 'e-w3', from: 'sort', to: 'p3', via: [[592, 330]], label: 'fd 1', labelAt: 0.35, card: { what: bi('Отсортированные адреса — в третью трубу, все разом.', 'The sorted addresses go into the third pipe, all at once.'), who: bi('Оболочка', 'The shell') } },
      { id: 'e-r3', from: 'p3', to: 'uniq', via: [[836, 330]], label: 'fd 0', labelAt: 0.65, card: { what: bi('uniq -c считает подряд идущие одинаковые строки.', 'uniq -c counts identical lines that come in a row.'), who: bi('Оболочка', 'The shell') } },
      { id: 'e-out', from: 'uniq', to: 'tty', label: 'fd 1', card: { what: bi('Последняя команда пишет в терминал: её дескриптор 1 оболочка не трогала.', 'The last command writes to the terminal: the shell left its descriptor 1 alone.'), who: bi('Унаследован от оболочки.', 'Inherited from the shell.') } },
      { id: 'e-err', from: 'grep', to: 'tty', via: [[104, 22], [836, 22]], label: 'fd 2 → терминал', labelAt: 0.5, dashed: true, card: { what: bi('Поток ошибок (2) в трубу не подключён: сообщения об ошибках видны на экране, даже когда вывод уходит дальше по конвейеру. `2>&1` перед `|` отправил бы их в трубу.', 'The error stream (2) is not connected to the pipe: error messages show up on screen even while the output goes down the pipeline. `2>&1` before `|` would send them into the pipe.'), who: bi('Унаследован от оболочки.', 'Inherited from the shell.'), doc: { page: 'man/bash.1', anchor: 'REDIRECTION' } } },
    ],
  },
  params: [
    { id: 'lines', label: bi('Строк в журнале', 'Lines in the log'), kind: 'range', min: 20, max: 2000, step: 20, default: 400, near: 'log' },
    {
      id: 'errors',
      label: bi('Доля ответов 500', 'Share of 500 answers'),
      kind: 'range',
      min: 0,
      max: 50,
      step: 5,
      default: 10,
      unit: '%',
      near: 'grep',
      predict: {
        prompt: bi('Ответов 500 станет 0%. Что напечатает конвейер?', 'There will be 0% of 500 answers. What will the pipeline print?'),
        options: [
          { id: 'empty', text: bi('Ничего: до uniq не дойдёт ни одной строки', 'Nothing: not a single line reaches uniq') },
          { id: 'error', text: bi('Ошибку: grep ничего не нашёл', 'An error: grep found nothing') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.matched ?? 0) === 0 ? 'empty' : 'error'),
      },
    },
    {
      id: 'sorted',
      label: bi('sort перед uniq', 'sort before uniq'),
      kind: 'toggle',
      default: true,
      near: 'sort',
      predict: {
        prompt: bi('Убираем sort. Сколько строк напечатает uniq -c?', 'We remove sort. How many lines will uniq -c print?'),
        options: [
          { id: 'same', text: bi('Столько же: по строке на адрес', 'The same: one line per address') },
          { id: 'more', text: bi('Больше: один адрес попадёт в несколько строк', 'More: one address will show up on several lines') },
        ],
        resolve: (prev, next) => ((next[next.length - 1]?.metrics?.printed ?? 0) > (prev[prev.length - 1]?.metrics?.printed ?? 0) ? 'more' : 'same'),
      },
    },
    {
      id: 'stderr',
      label: bi('Ошибки grep', 'grep’s errors'),
      kind: 'choice',
      default: 'tty',
      options: [
        { id: 'tty', label: bi('на экран (как обычно)', 'to the screen (as usual)') },
        { id: 'pipe', label: bi("grep … 2>&1 | …: в трубу", "grep … 2>&1 | …: into the pipe") },
      ],
      near: 'e-err',
      levels: ['intermediate', 'experienced'],
    },
  ],
  breaks: [
    {
      id: 'no-file',
      label: bi('Журнал не тот: access.log нет', 'Wrong log: there is no access.log'),
      remove: ['log', 'e-read'],
      boundary: 'io',
      predict: {
        prompt: bi('Файла нет. Что увидите на экране?', 'The file is missing. What do you see on screen?'),
        options: [
          { id: 'msg', text: bi('Сообщение grep об ошибке, а вывод пустой', 'grep’s error message, and empty output') },
          { id: 'nothing', text: bi('Совсем ничего: ошибка ушла в трубу', 'Nothing at all: the error went into the pipe') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'log') ? 'msg' : 'nothing'),
      },
    },
    {
      id: 'early-exit',
      label: bi('Последняя команда уходит раньше: | head -1', 'The last command leaves early: | head -1'),
      remove: ['e-r3'],
      boundary: 'process',
      predict: {
        prompt: bi('Вместо uniq — head -1: прочитал одну строку и вышел. Что будет с sort, если ему ещё есть что писать?', 'Instead of uniq — head -1: it read one line and left. What happens to sort if it still has data to write?'),
        options: [
          { id: 'sigpipe', text: bi('Получит SIGPIPE и завершится', 'It gets SIGPIPE and ends') },
          { id: 'wait', text: bi('Будет вечно ждать', 'It waits forever') },
        ],
        resolve: () => 'sigpipe',
      },
    },
  ],
  metrics: [
    { id: 'lines', label: bi('строк в журнале', 'lines in the log') },
    { id: 'matched', label: bi('прошло grep', 'passed grep') },
    { id: 'distinct', label: bi('разных адресов', 'distinct addresses') },
    { id: 'printed', label: bi('строк напечатал uniq', 'lines uniq printed') },
  ],
  run(p, broken): Step[] {
    const n = pipeNumbers(p);
    const steps: Step[] = [];
    const kib = (lines: number, bytes: number) => `${Math.min(64, Math.ceil((lines * bytes) / 1024))} / 64 KiB`;
    steps.push({
      id: 'start',
      label: bi('старт', 'start'),
      caption: bi('Оболочка создала три трубы и запустила четыре программы одновременно. Каждая просто читает 0 и пишет в 1.', 'The shell created three pipes and started four programs at once. Each just reads 0 and writes 1.'),
      focus: ['grep', 'cut', 'sort', 'uniq', 'p1', 'p2', 'p3'],
      states: { grep: 'on', cut: 'on', sort: 'on', uniq: 'on' },
      values: { log: `${n.lines} lines`, grep: 'PID 3101', cut: 'PID 3102', sort: 'PID 3103', uniq: p.sorted ? 'PID 3104' : 'PID 3104 (no sort)' },
      fill: { p1: 0, p2: 0, p3: 0 },
      metrics: { lines: n.lines, matched: 0, distinct: 0, printed: 0 },
    });
    if (broken.has('no-file')) {
      steps.push({
        id: 'nofile',
        label: 'open',
        caption: bi('grep не может открыть файл. Сообщение идёт в поток 2 — прямо на экран, мимо трубы; в трубу не уходит ни строки.', 'grep cannot open the file. The message goes to stream 2 — straight to the screen, past the pipe; not a single line goes into the pipe.'),
        focus: ['e-err', 'tty'],
        tokens: [{ edge: 'e-err', label: 'error' }],
        states: { grep: 'err', tty: 'on' },
        metrics: { lines: 0, matched: 0, distinct: 0, printed: 0 },
        broken: { at: 'log', message: 'grep: access.log: No such file or directory', caption: bi('ошибка видна, а вывод пустой: остальные команды получили конец данных и честно напечатали ничего; код конвейера — код uniq, 0.', 'the error is visible and the output is empty: the other commands got end of data and honestly printed nothing; the pipeline’s code is uniq’s code, 0.') },
      });
      return steps;
    }
    steps.push({
      id: 'grep',
      label: 'grep',
      caption: fmt(bi('grep читает {l} строк и пропускает {m} — те, где есть ` 500 `. Остальные гаснут у входа.', 'grep reads {l} lines and lets {m} through — the ones with ` 500 `. The rest die at its door.'), { l: n.lines, m: n.matched }),
      focus: ['e-read', 'grep', 'e-w1', 'p1'],
      tokens: [{ edge: 'e-read' }, { edge: 'e-w1', label: String(n.matched) }],
      values: { p1: kib(n.matched, 30) },
      fill: { p1: Math.min(1, (n.matched * 30) / 65536) + (n.matched ? 0.05 : 0) },
      metrics: { lines: n.lines, matched: n.matched, distinct: 0, printed: 0 },
    });
    steps.push({
      id: 'cut',
      label: 'cut',
      caption: fmt(bi('cut оставляет из каждой строки только адрес: {m} строк, по одному адресу.', 'cut keeps only the address of each line: {m} lines, one address each.'), { m: n.matched }),
      focus: ['e-r1', 'cut', 'e-w2', 'p2'],
      tokens: [{ edge: 'e-r1' }, { edge: 'e-w2', label: String(n.matched) }],
      values: { p1: '0 / 64 KiB', p2: kib(n.matched, 10) },
      fill: { p1: 0, p2: Math.min(1, (n.matched * 10) / 65536) + (n.matched ? 0.05 : 0) },
      metrics: { lines: n.lines, matched: n.matched, distinct: 0, printed: 0 },
    });
    if (p.sorted) {
      steps.push({
        id: 'sort-wait',
        label: 'sort',
        caption: fmt(bi('sort копит у себя все {m} адресов и молчит: пока не пришёл конец данных, нельзя знать, какая строка первая.', 'sort keeps all {m} addresses and stays silent: until the end of data arrives it cannot know which line comes first.'), { m: n.matched }),
        focus: ['e-r2', 'sort'],
        tokens: [{ edge: 'e-r2' }],
        values: { p2: '0 / 64 KiB', sort: `${n.matched} lines held` },
        fill: { p2: 0 },
        metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: 0 },
      });
      steps.push({
        id: 'eof',
        label: 'EOF',
        caption: bi('grep и cut закончили и вышли; их концы труб закрылись — sort получил конец данных и выдал всё сразу, одинаковые адреса теперь рядом.', 'grep and cut finished and exited; their pipe ends closed — sort got end of data and printed everything at once, with identical addresses now next to each other.'),
        focus: ['sort', 'e-w3', 'p3'],
        tokens: [{ edge: 'e-w3', label: String(n.matched) }],
        states: { grep: 'off', cut: 'off' },
        values: { p3: kib(n.matched, 10) },
        fill: { p3: Math.min(1, (n.matched * 10) / 65536) + (n.matched ? 0.05 : 0) },
        metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: 0 },
      });
    }
    if (broken.has('early-exit')) {
      steps.push({
        id: 'head',
        label: 'head -1',
        caption: bi('Последняя команда прочитала одну строку и вышла: читать из третьей трубы больше некому.', 'The last command read one line and exited: nobody is left to read the third pipe.'),
        focus: ['uniq', 'p3'],
        states: { uniq: 'off', 'e-r3': 'off' },
        metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: n.matched ? 1 : 0 },
      });
      steps.push({
        id: 'sigpipe',
        label: 'SIGPIPE',
        caption: bi('Следующая запись в трубу без читателя: ядро посылает писателю SIGPIPE, и тот завершается с кодом 141 (128 + 13). Это не ошибка — так конвейер экономит работу.', 'The next write into a pipe with no reader: the kernel sends the writer SIGPIPE and it ends with code 141 (128 + 13). Not a bug — this is how a pipeline saves work.'),
        focus: [p.sorted ? 'sort' : 'cut', 'p3'],
        states: { [p.sorted ? 'sort' : 'cut']: 'err' },
        metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: n.matched ? 1 : 0 },
        broken: { at: p.sorted ? 'sort' : 'cut', message: "$ grep ' 500 ' access.log | cut -d' ' -f1 | sort | head -1; echo \"${PIPESTATUS[@]}\"\n10.0.0.12\n0 0 141 0", caption: bi('код 141 = 128 + 13: процесс убит сигналом 13, SIGPIPE.', 'code 141 = 128 + 13: the process was killed by signal 13, SIGPIPE.') },
      });
      return steps;
    }
    steps.push({
      id: 'uniq',
      label: 'uniq -c',
      caption: p.sorted
        ? fmt(bi('uniq -c склеивает соседние одинаковые адреса: {d} строк, по одной на адрес. Чаще всех — {t} ({c} раз).', 'uniq -c merges identical adjacent addresses: {d} lines, one per address. Most often — {t} ({c} times).'), { d: n.printed, t: n.top, c: n.topCount })
        : fmt(bi('Без sort одинаковые адреса идут вперемешку, и uniq склеивает только соседние: {p} строк вместо {d}, один адрес — в нескольких строках.', 'Without sort identical addresses come mixed up, and uniq merges only adjacent ones: {p} lines instead of {d}, one address on several lines.'), { p: n.printed, d: n.distinct }),
      focus: p.sorted ? ['e-r3', 'uniq'] : ['e-r2', 'uniq'],
      tokens: [{ edge: p.sorted ? 'e-r3' : 'e-r2' }],
      states: p.sorted ? { sort: 'off' } : { sort: 'off', grep: 'off', cut: 'off' },
      values: { p3: '0 / 64 KiB' },
      fill: { p3: 0 },
      metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: n.printed },
    });
    steps.push({
      id: 'out',
      label: bi('экран', 'screen'),
      caption: p.stderr === 'pipe' ? bi('Вывод uniq — на экран. С `2>&1` сообщения grep тоже ушли бы в трубу и стали бы «данными» для cut.', 'uniq’s output goes to the screen. With `2>&1` grep’s messages would also go into the pipe and become “data” for cut.') : bi('Вывод uniq — на экран: последняя команда пишет туда, куда смотрел дескриптор 1 оболочки.', 'uniq’s output reaches the screen: the last command writes where the shell’s descriptor 1 pointed.'),
      focus: ['e-out', 'tty'],
      tokens: [{ edge: 'e-out', label: n.printed ? `${n.topCount} ${n.top}` : '∅' }],
      states: { uniq: 'off', tty: 'on' },
      values: { tty: n.printed ? `${n.printed} lines` : '(empty)' },
      metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: n.printed },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const m = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: конвейер снова доходит до конца.', 'The break is removed: the pipeline runs to the end again.');
      if (change.id === 'no-file') return bi('grep не открыл файл: его сообщение ушло в поток 2 — на экран, а дальше по трубам не прошло ни строки.', 'grep could not open the file: its message went to stream 2 — the screen — and not a single line went down the pipes.');
      return bi('Читатель ушёл раньше: следующая запись в трубу без читателя приносит писателю SIGPIPE, код 141.', 'The reader left early: the next write into a pipe without a reader brings the writer SIGPIPE, code 141.');
    }
    switch (change.id) {
      case 'lines':
        return fmt(bi('{a} → {b} строк: через grep прошло {m}, адресов по-прежнему {d} — их всего пять в журнале.', '{a} → {b} lines: {m} passed grep, still {d} addresses — there are only five in the log.'), { a: a.lines as number, b: b.lines as number, m: m(next).matched ?? 0, d: m(next).distinct ?? 0 });
      case 'errors':
        return (m(next).matched ?? 0) === 0
          ? bi('Ни одной строки с 500: grep ничего не пропустил, остальные получили пустой вход и честно ничего не напечатали. Ошибки нет — просто пусто.', 'Not one line with 500: grep let nothing through, the others got empty input and honestly printed nothing. Not an error — just empty.')
          : fmt(bi('Доля 500 — {e}%: через grep проходит {m} строк из {l}.', 'The share of 500s is {e}%: {m} of {l} lines pass grep.'), { e: b.errors as number, m: m(next).matched ?? 0, l: m(next).lines ?? 0 });
      case 'sorted':
        return b.sorted
          ? fmt(bi('С sort одинаковые адреса стоят рядом, и uniq даёт по строке на адрес: {p}.', 'With sort identical addresses stand together, and uniq gives one line per address: {p}.'), { p: m(next).printed ?? 0 })
          : fmt(bi('Без sort uniq видит адреса вперемешку и считает только подряд идущие: {p} строк вместо {d}.', 'Without sort uniq sees the addresses mixed up and counts only those in a row: {p} lines instead of {d}.'), { p: m(next).printed ?? 0, d: m(next).distinct ?? 0 });
      case 'stderr':
        return b.stderr === 'pipe' ? bi('`2>&1` перед `|`: сообщения об ошибках grep пойдут в трубу вместе с данными, и cut будет резать их как строки журнала.', '`2>&1` before `|`: grep’s error messages go into the pipe together with the data, and cut will cut them like log lines.') : bi('Ошибки снова идут на экран, мимо трубы.', 'Errors go to the screen again, past the pipe.');
    }
    void prev;
    return bi('Параметр изменился — конвейер пересчитан.', 'The parameter changed — the pipeline was recomputed.');
  },
});
