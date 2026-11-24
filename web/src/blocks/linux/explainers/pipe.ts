// X3 «A pipeline: processes and kernel buffers» (02 §6.6 X3, layer 2 of M8,
// shown in the processes lesson as a review of the streams lesson). The pipeline
//   grep ' 500 ' access.log | cut -d' ' -f1 | sort | uniq -c
// runs on a log generated from the knobs, so every number on the screen is
// computed, not drawn: lines in, lines that pass grep, distinct addresses,
// and what uniq -c prints with and without sort in front of it.
//
// Reading order: at the start there are the log and the four processes; each
// pipe appears when data first goes into it, and every acting process says in
// a callout what it is doing with the lines.

import { defineModel } from '../../../core/define';
import { bi, count, fmt as fill, pluralRu, type Bi } from '../../../core/i18n';
import type { DiagramNode, ElementState, Step } from '../../../core/types';
import { fmtb } from './util';

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
  /** Bytes the program before the last one writes into the last pipe (one address and a newline per matched line). */
  tailBytes: number;
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
  const tailBytes = matched.reduce((sum, ip) => sum + ip.length + 1, 0);
  return { lines: log.length, matched: matched.length, distinct: new Set(matched).size, printed: runs.length, top: best?.ip ?? '-', topCount: best?.n ?? 0, tailBytes };
}

/** A pipe holds 64 KiB: a writer whose whole output fits finishes before the reader leaves and gets no SIGPIPE. */
export const PIPE_BYTES = 65536;
export function getsSigpipe(n: PipeNumbers): boolean {
  return n.tailBytes > PIPE_BYTES;
}

const doc = {
  pipe7: { url: 'https://man7.org/linux/man-pages/man7/pipe.7.html', label: 'pipe(7)' },
  bash: { page: 'man/bash.1', anchor: 'PIPELINES' },
};

const proc = (id: string, label: string, x: number, what: Bi, see: string, page: string): DiagramNode => ({
  id,
  label,
  icon: 'process',
  work: 'pulse',
  sub: '',
  family: 'process',
  x,
  y: 126,
  w: 176,
  h: 64,
  card: { what, who: bi('Процесс запускает оболочка. Для каждой команды конвейера она создаёт копию себя и загружает в неё программу, и все четыре процесса запускаются одновременно.', 'The shell starts the process. For every command of the pipeline it makes a copy of itself and loads the program into it, and all four processes start at once.'), see, doc: { page, anchor: 'DESCRIPTION' } },
});

const buf = (id: string, x: number, between: Bi): DiagramNode => ({
  id,
  label: bi('Труба', 'Pipe'),
  sub: { ru: '0 / 64 КиБ', en: '0 / 64 KiB' },
  family: 'kernel',
  shape: 'buffer',
  x,
  y: 370,
  w: 150,
  h: 60,
  card: {
    what: fmtb2(bi('Буфер в памяти ядра между командами {b}. У буфера два конца: левая команда пишет в него свой вывод через поток 1, а правая читает из него свой ввод через поток 0. Когда буфер заполнен, ядро приостанавливает пишущую команду, а когда он пуст, приостанавливает читающую.', 'A buffer in kernel memory between the commands {b}. It has two ends: the command on the left writes its output into it through stream 1, and the one on the right reads its input from it through stream 0. When the buffer is full, the kernel pauses the writer, and when it is empty, it pauses the reader.'), between),
    who: bi('Трубу создаёт ядро по просьбе оболочки, ещё до того, как команды запустятся.', 'The kernel creates the pipe at the shell’s request, before the commands start.'),
    see: 'ls -l /proc/$$/fd',
    doc: doc.pipe7,
  },
});

/** Russian numerals agree with their noun: «3 строки», «21 адрес», «1 ошибка», «из 1 строки». */
const NOUNS: Record<string, [string, string, string, string]> = {
  строк: ['строка', 'строку', 'строки', 'строк'],
  адресов: ['адрес', 'адрес', 'адреса', 'адресов'],
  ошибок: ['ошибка', 'ошибку', 'ошибки', 'ошибок'],
};
const ACCUSATIVE = /(пропускает|оставляет|получает|печатает|держит|собирает|все)\s$/;
export function agreeRu(text: string): string {
  return text.replace(/(^|.)(\d+) (строк|адресов|ошибок)(?![а-яё])/g, (_m: string, pre: string, num: string, noun: string, at: number) => {
    const before = text.slice(0, at + pre.length);
    const forms = NOUNS[noun];
    if (/из\s$/.test(before)) return `${pre}${num} ${pluralRu(Number(num), [forms[2], forms[3], forms[3]])}`;
    const one = ACCUSATIVE.test(before) ? forms[1] : forms[0];
    return `${pre}${num} ${pluralRu(Number(num), [one, forms[2], forms[3]])}`;
  });
}
const fmt = (b: Bi, vars: Record<string, string | number>): Bi => {
  const r = fill(b, vars);
  return { ru: agreeRu(r.ru), en: r.en };
};
const lines = (n: number) => count(n, ['строка', 'строки', 'строк'], ['line', 'lines']);

function fmtb2(b: Bi, between: Bi): Bi {
  return { ru: b.ru.replace('{b}', between.ru), en: b.en.replace('{b}', between.en) };
}

const ALL = ['grep', 'cut', 'sort', 'uniq', 'log', 'tty', 'p1', 'p2', 'p3', 'kernel', 'e-read', 'e-w1', 'e-r1', 'e-w2', 'e-r2', 'e-w3', 'e-r3', 'e-out', 'e-err'];
const startWith = (...shown: string[]): Record<string, ElementState> => Object.fromEntries(ALL.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

export const pipeModel = defineModel<P>({
  id: 'linux.pipe',
  frame: 'visible',
  block: 'linux',
  title: bi('Как конвейер передаёт вывод одной команды на вход следующей', 'How a pipeline hands the output of one command to the next'),
  summary: bi(
    'Конвейер `grep \' 500 \' access.log | cut -d\' \' -f1 | sort | uniq -c` считает, сколько ошибок 500 получил каждый адрес. Четыре программы работают одновременно, каждая в своём процессе, а между ними стоят трубы, то есть буферы в памяти ядра. Все числа на схеме вычисляются по журналу, который вы описываете в «Параметрах» над схемой.',
    'The pipeline `grep \' 500 \' access.log | cut -d\' \' -f1 | sort | uniq -c` counts how many 500 errors each address got. Four programs run at once, each in its own process, with pipes, that is, kernel memory buffers, between them. Every number in the diagram is computed from the log you set with the knobs.',
  ),
  intro: bi(
    'Сейчас на схеме журнал и четыре процесса конвейера, а трубы между ними появятся, когда по ним пойдут данные. А дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко рядом с подсвеченным процессом говорит, что он делает со строками, а карточка на линии показывает, сколько строк передаётся дальше.\n\nКогда дойдёте до экрана, выключите в «Параметрах» команду sort и посмотрите, сколько строк напечатает uniq.',
    'Now the diagram shows the log and the four processes of the pipeline; the pipes between them appear when data goes into them. Then go on with “Step forward” above the diagram. The callout next to the highlighted process says what it does with the lines, and the card on the line shows how many lines are handed on.\n\nOnce you reach the screen, switch off sort in “Parameters” and see how many lines uniq prints.',
  ),
  legend: [
    { mark: 'active', text: bi('процесс, который работает сейчас', 'the process working now') },
    { mark: 'say', text: bi('что этот процесс делает со строками', 'what that process does with the lines') },
    { mark: 'token', text: bi('сколько строк передаётся дальше', 'how many lines are handed on') },
    { mark: 'icon:process', text: bi('процесс одной команды конвейера', 'the process of one command of the pipeline') },
    { mark: 'dashed', text: bi('поток ошибок, который идёт мимо труб', 'the error stream, which bypasses the pipes') },
    { mark: 'pale', text: bi('процесс уже завершился', 'the process has finished') },
    { mark: 'err', text: bi('здесь конвейер остановился', 'the pipeline stopped here') },
  ],
  stopLabel: bi('Конвейер остановился', 'The pipeline stopped'),
  concepts: ['linux.pipe', 'linux.stream'],
  diagram: {
    width: 960,
    height: 540,
    nodes: [
      proc('grep', "grep ' 500 '", 16, bi('Программа grep оставляет только строки, в которых есть ` 500 `, то есть ответы с ошибкой сервера. Остальные строки дальше не идут.', 'grep keeps only the lines with ` 500 `, the answers with a server error. Other lines go no further.'), "grep -c ' 500 ' access.log", 'man/grep.1'),
      proc('cut', "cut -d' ' -f1", 260, bi('Программа cut берёт из каждой строки первое поле, если поля разделены пробелом. В журнале первым полем стоит адрес клиента.', 'cut takes the first field of every line when the fields are separated by a space. In the log the first field is the client address.'), "cut -d' ' -f1 access.log | less", 'man/cut.1'),
      proc('sort', 'sort', 504, bi('Программа sort упорядочивает строки. Прежде чем напечатать первую строку, она должна прочитать весь ввод до конца, поэтому её вывод появляется весь сразу.', 'sort puts the lines in order. Before it can print the first line it must read the whole input, which is why its output appears all at once.'), 'sort --help', 'man/sort.1'),
      proc('uniq', 'uniq -c', 748, bi('Программа uniq -c склеивает одинаковые строки, которые стоят подряд, и пишет, сколько их было. Склеивает она только соседние строки, поэтому перед ней нужна команда sort.', 'uniq -c merges identical lines that come in a row and writes how many there were. It merges only adjacent lines, which is why it needs sort in front of it.'), 'uniq --help', 'man/uniq.1'),
      {
        id: 'log',
        label: 'access.log',
        icon: 'file',
        sub: 'wc -l: 0',
        family: 'store',
        x: 16,
        y: 250,
        w: 176,
        h: 56,
        card: { what: bi('Журнал веб-сервера, в котором на каждый запрос приходится одна строка: адрес клиента, метод, путь и код ответа.', 'A web server log with one line per request: the client address, the method, the path and the response code.'), who: bi('Журнал пишет веб-сервер, а grep открывает этот файл сам, по имени, которое получил аргументом.', 'The web server writes the log, and grep opens the file itself, by the name it got as an argument.'), see: 'less access.log' },
      },
      {
        id: 'tty',
        label: bi('Терминал', 'The terminal'),
        icon: 'terminal',
        sub: '',
        family: 'user',
        x: 790,
        y: 250,
        w: 154,
        h: 56,
        card: { what: bi('Сюда попадает вывод последней команды конвейера. Сюда же попадают ошибки всех команд, потому что поток 2 в трубы не подключён.', 'The output of the last command of the pipeline ends up here. So do the errors of all commands, because stream 2 is not connected to the pipes.'), who: bi('Подключение к терминалу все команды получают в наследство от оболочки.', 'All commands inherit their connection to the terminal from the shell.'), see: 'tty' },
      },
      buf('p1', 138, bi('grep и cut', 'grep and cut')),
      buf('p2', 382, bi('cut и sort', 'cut and sort')),
      buf('p3', 600, bi('sort и uniq', 'sort and uniq')),
      {
        id: 'kernel',
        label: bi('Ядро Linux', 'The Linux kernel'),
        family: 'kernel',
        shape: 'bar',
        x: 16,
        y: 350,
        w: 928,
        h: 176,
        card: { what: bi('Трубы принадлежат ядру. Команды друг о друге не знают: каждая читает свой поток 0 и пишет в свой поток 1, а соединяет их ядро.', 'The pipes belong to the kernel. The commands know nothing of each other: each reads its stream 0 and writes to its stream 1, and the kernel connects them.'), who: bi('Ядро на машине одно, и все процессы работают с ним.', 'There is one kernel per machine, and all processes work with it.'), see: 'uname -r' },
      },
    ],
    edges: [
      { id: 'e-read', from: 'log', to: 'grep', label: bi('чтение журнала', 'reading the log'), card: { what: bi('Программа grep открывает журнал по имени, потому что получила его аргументом, а не через стандартный ввод.', 'grep opens the log by name, because it got it as an argument, not through standard input.'), who: bi('Файл открывает сама программа grep.', 'grep opens the file itself.') } },
      { id: 'e-w1', from: 'grep', to: 'p1', via: [[226, 158]], label: bi('вывод grep', 'grep’s output'), labelAt: 0.5, card: { what: bi('Вывод grep идёт не на экран, а в первую трубу.', 'grep’s output goes not to the screen but into the first pipe.'), who: bi('Поток 1 программы grep подключила к трубе оболочка, ещё до запуска программы.', 'The shell connected grep’s stream 1 to the pipe before the program started.'), doc: doc.bash } },
      { id: 'e-r1', from: 'p1', to: 'cut', via: [[348, 400]], label: bi('ввод cut', 'cut’s input'), labelAt: 0.65, card: { what: bi('Программа cut читает свой ввод из первой трубы.', 'cut reads its input from the first pipe.'), who: bi('Поток 0 программы cut подключила к трубе оболочка.', 'The shell connected cut’s stream 0 to the pipe.'), doc: doc.bash } },
      { id: 'e-w2', from: 'cut', to: 'p2', via: [[348, 400]], label: bi('вывод cut', 'cut’s output'), labelAt: 0.35, card: { what: bi('Адреса клиентов cut пишет во вторую трубу.', 'cut writes the client addresses into the second pipe.'), who: bi('Поток 1 программы cut подключила к трубе оболочка.', 'The shell connected cut’s stream 1 to the pipe.') } },
      { id: 'e-r2', from: 'p2', to: 'sort', via: [[592, 400]], label: bi('ввод sort', 'sort’s input'), labelAt: 0.46, card: { what: bi('Программа sort собирает у себя всё, что приходит из трубы, пока данные не кончатся.', 'sort collects everything that comes from the pipe until the data ends.'), who: bi('Поток 0 программы sort подключила к трубе оболочка.', 'The shell connected sort’s stream 0 to the pipe.') } },
      { id: 'e-w3', from: 'sort', to: 'p3', via: [[592, 400]], label: bi('вывод sort', 'sort’s output'), labelAt: 0.67, card: { what: bi('Упорядоченные адреса программа sort пишет в третью трубу все сразу, одним куском.', 'sort writes the ordered addresses into the third pipe, all at once.'), who: bi('Поток 1 программы sort подключила к трубе оболочка.', 'The shell connected sort’s stream 1 to the pipe.') } },
      { id: 'e-r3', from: 'p3', to: 'uniq', via: [[766, 400], [766, 210]], label: bi('ввод uniq', 'uniq’s input'), labelAt: 0.36, card: { what: bi('Программа uniq -c считает одинаковые строки, которые идут подряд.', 'uniq -c counts identical lines that come in a row.'), who: bi('Поток 0 программы uniq подключила к трубе оболочка.', 'The shell connected uniq’s stream 0 to the pipe.') } },
      { id: 'e-out', from: 'uniq', to: 'tty', label: bi('вывод на экран', 'output to the screen'), card: { what: bi('Последняя команда пишет в терминал, потому что её поток 1 оболочка не трогала.', 'The last command writes to the terminal, because the shell left its stream 1 alone.'), who: bi('Поток 1 последняя команда получила по наследству от оболочки.', 'The last command inherited its stream 1 from the shell.') } },
      { id: 'e-err', from: 'grep', to: 'tty', via: [[104, 22], [952, 22], [952, 278]], label: bi('ошибки grep на экран', 'grep’s errors to the screen'), labelAt: 0.5, dashed: true, card: { what: bi('Поток ошибок с номером 2 к трубе не подключён, поэтому сообщения об ошибках видны на экране, даже когда вывод идёт дальше по конвейеру. Запись `2>&1` перед `|` отправила бы их в трубу.', 'The error stream, number 2, is not connected to the pipe, so error messages show on the screen even while the output goes down the pipeline. `2>&1` before `|` would send them into the pipe.'), who: bi('Поток 2 программа grep получила по наследству от оболочки.', 'grep inherited its stream 2 from the shell.'), doc: { page: 'man/bash.1', anchor: 'REDIRECTION' } } },
    ],
  },
  params: [
    { id: 'lines', label: bi('Сколько строк в журнале', 'How many lines the log has'), kind: 'range', min: 20, max: 20000, step: 20, default: 400, near: 'log', group: bi('Какой журнал читает конвейер', 'Which log the pipeline reads') },
    {
      id: 'errors',
      label: bi('Какая доля запросов закончилась ошибкой 500', 'What share of requests ended with a 500 error'),
      kind: 'range',
      min: 0,
      max: 50,
      step: 5,
      default: 10,
      unit: '%',
      near: 'grep',
      group: bi('Какой журнал читает конвейер', 'Which log the pipeline reads'),
      predict: {
        prompt: bi('Вы ставите долю ошибок 500 на ноль, то есть в журнале не останется ни одной строки с кодом 500. Что напечатает конвейер?', 'You set the share of 500 errors to zero, so the log has no line with code 500. What does the pipeline print?'),
        options: [
          { id: 'empty', text: bi('Ничего, потому что до uniq не дойдёт ни одной строки', 'Nothing, because not a single line reaches uniq') },
          { id: 'error', text: bi('Сообщение об ошибке, потому что grep ничего не нашёл', 'An error message, because grep found nothing') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.matched ?? 0) === 0 ? 'empty' : 'error'),
      },
    },
    {
      id: 'sorted',
      label: bi('Перед uniq стоит команда sort', 'sort comes before uniq'),
      kind: 'toggle',
      default: true,
      near: 'sort',
      group: bi('Какие команды стоят в конвейере', 'Which commands the pipeline has'),
      predict: {
        prompt: bi('Вы убираете из конвейера команду sort, а журнал остаётся прежним. Сколько строк напечатает uniq -c?', 'You remove sort from the pipeline while the log stays the same. How many lines does uniq -c print?'),
        options: [
          { id: 'same', text: bi('Столько же, по одной строке на каждый адрес', 'The same, one line per address') },
          { id: 'more', text: bi('Больше, потому что один адрес попадёт в несколько строк', 'More, because one address shows up on several lines') },
        ],
        resolve: (prev, next) => ((next[next.length - 1]?.metrics?.printed ?? 0) > (prev[prev.length - 1]?.metrics?.printed ?? 0) ? 'more' : 'same'),
      },
    },
    {
      id: 'stderr',
      label: bi('Куда идут сообщения об ошибках grep', 'Where grep’s error messages go'),
      kind: 'choice',
      default: 'tty',
      options: [
        { id: 'tty', label: bi('на экран, как обычно', 'to the screen, as usual') },
        { id: 'pipe', label: bi('в трубу вместе с данными (grep … 2>&1 | …)', 'into the pipe with the data (grep … 2>&1 | …)') },
      ],
      near: 'e-err',
      group: bi('Какие команды стоят в конвейере', 'Which commands the pipeline has'),
      levels: ['intermediate', 'experienced'],
    },
  ],
  breaks: [
    {
      id: 'no-file',
      label: bi('Файла access.log в каталоге нет', 'There is no access.log in the directory'),
      remove: ['log', 'e-read'],
      boundary: 'io',
      predict: {
        prompt: bi('Файла access.log нет, а поток ошибок grep, как обычно, идёт на экран. Что вы увидите?', 'There is no access.log, and grep’s error stream goes to the screen as usual. What do you see?'),
        options: [
          { id: 'msg', text: bi('Сообщение grep об ошибке, а сам вывод конвейера будет пустым', 'grep’s error message, and the pipeline’s output itself is empty') },
          { id: 'nothing', text: bi('Ничего не увидите, потому что сообщение об ошибке ушло в трубу', 'You will see nothing, because the error message went into the pipe') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'log') ? 'msg' : 'nothing'),
      },
    },
    {
      id: 'early-exit',
      label: bi('Последняя команда читает одну строку и завершается', 'The last command reads one line and exits'),
      remove: ['e-r3'],
      boundary: 'process',
      predict: {
        prompt: bi('Вместо uniq в конце стоит команда `head -1`, которая прочитала одну строку и завершилась. Труба между sort и этой командой вмещает 64 КиБ, а sort пишет в неё по адресу на каждую строку, прошедшую через grep. Учтите, сколько строк прошло через grep при нынешних параметрах. Что будет с sort?', 'Instead of uniq the last command is `head -1`, which read one line and exited. The pipe between sort and that command holds 64 KiB, and sort writes one address into it for every line that passed grep. Take into account how many lines pass grep with the current parameters. What happens to sort?'),
        options: [
          { id: 'fits', text: bi('Весь вывод sort поместится в трубу, и sort завершится с кодом 0', 'All of sort’s output fits into the pipe, and sort ends with code 0') },
          { id: 'sigpipe', text: bi('Вывод в трубу не поместится, ядро пошлёт sort сигнал SIGPIPE, и она завершится с кодом 141', 'The output does not fit, the kernel sends sort SIGPIPE, and it ends with code 141') },
          { id: 'wait', text: bi('Программа sort будет ждать читателя бесконечно', 'sort waits for a reader forever') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'sigpipe') ? 'sigpipe' : 'fits'),
      },
    },
  ],
  metrics: [
    { id: 'lines', label: bi('строк в журнале', 'lines in the log') },
    { id: 'matched', label: bi('строк прошло через grep', 'lines passed grep') },
    { id: 'distinct', label: bi('разных адресов', 'distinct addresses') },
    { id: 'printed', label: bi('строк напечатала uniq', 'lines uniq printed') },
  ],
  run(p, broken): Step[] {
    const n = pipeNumbers(p);
    const steps: Step[] = [];
    const kib = (lines: number, bytes: number) => `${Math.min(64, Math.ceil((lines * bytes) / 1024))} / 64 KiB`;
    const fillOf = (lines: number, bytes: number) => Math.min(1, (lines * bytes) / 65536) + (lines ? 0.05 : 0);
    steps.push({
      id: 'start',
      label: bi('запуск', 'start'),
      caption: bi('Оболочка запустила четыре программы одновременно, каждую в отдельном процессе. Друг о друге эти программы не знают, потому что каждая читает свой поток 0 и пишет в свой поток 1, а соединяют их трубы от ядра.', 'The shell started four programs at once, each in its own process. The programs know nothing of each other, because each reads its stream 0 and writes to its stream 1, and pipes from the kernel connect them.'),
      focus: ['grep', 'cut', 'sort', 'uniq'],
      say: { grep: bi('Все четыре процесса уже запущены и ждут, когда к ним придут данные.', 'All four processes are already running and wait for data to arrive.') },
      states: startWith('log', 'grep', 'cut', 'sort', 'uniq'),
      values: { log: lines(n.lines), grep: 'PID 3101', cut: 'PID 3102', sort: 'PID 3103', uniq: 'PID 3104' },
      fill: { p1: 0, p2: 0, p3: 0 },
      metrics: { lines: n.lines, matched: 0, distinct: 0, printed: 0 },
    });
    if (broken.has('no-file')) {
      steps.push({
        id: 'nofile',
        label: bi('нет файла', 'no file'),
        caption: bi('Программа grep не может открыть файл access.log и пишет сообщение об этом в поток 2. Этот поток идёт прямо на экран, мимо трубы, поэтому в трубу не попадает ни одной строки.', 'grep cannot open access.log and writes a message about it to stream 2. That stream goes straight to the screen, past the pipe, so not a single line goes into the pipe.'),
        focus: ['e-err', 'tty'],
        reveal: ['e-err', 'tty'],
        tokens: [{ edge: 'e-err', label: 'No such file' }],
        say: { grep: bi('Программа grep не нашла файл access.log и пишет об ошибке в поток 2.', 'grep did not find access.log and writes the error to stream 2.') },
        states: { grep: 'err', tty: 'on' },
        metrics: { lines: 0, matched: 0, distinct: 0, printed: 0 },
        broken: { at: 'log', message: 'grep: access.log: No such file or directory', caption: bi('Сообщение об ошибке видно, а вывод конвейера пустой. Остальные команды получили конец данных и, как им и положено, ничего не напечатали. Код завершения всего конвейера равен коду последней команды, то есть нулю, поэтому узнают такую поломку только по сообщению на экране.', 'The error message is visible, and the pipeline’s output is empty. The other commands got the end of data and, as they should, printed nothing. The exit code of the whole pipeline is the code of the last command, zero, so you recognise this break only by the message on the screen.') },
      });
      return steps;
    }
    steps.push({
      id: 'grep',
      label: 'grep',
      caption: fmt(bi('Программа grep читает журнал из {l} строк и оставляет {m} строк, в которых есть код 500 между пробелами. Эти строки она отправляет в первую трубу, буфер в памяти ядра между grep и cut, а все остальные отбрасывает.', 'grep reads the log of {l} lines and lets {m} lines with ` 500 ` through. The other lines go no further, and the ones let through go into the first pipe, the kernel buffer between grep and cut.'), { l: n.lines, m: n.matched }),
      focus: ['grep', 'e-w1', 'p1'],
      reveal: ['e-read', 'e-w1', 'p1', 'kernel'],
      tokens: [{ edge: 'e-read', label: fmt(bi('{l} строк', '{l} lines'), { l: n.lines }) }, { edge: 'e-w1', label: fmt(bi('{m} строк', '{m} lines'), { m: n.matched }) }],
      say: { grep: fmt(bi('Программа grep оставляет только строки с кодом 500, и таких строк {m}.', 'grep keeps only the lines with code 500, and there are {m} of them.'), { m: n.matched }) },
      values: { p1: kib(n.matched, 30) },
      fill: { p1: fillOf(n.matched, 30) },
      metrics: { lines: n.lines, matched: n.matched, distinct: 0, printed: 0 },
    });
    steps.push({
      id: 'cut',
      label: 'cut',
      caption: fmt(bi('Программа cut читает строки из первой трубы и оставляет из каждой только адрес клиента. Во вторую трубу уходят {m} строк, и в каждой стоит один адрес.', 'cut reads the lines from the first pipe and keeps only the client address of each. {m} lines go into the second pipe, with one address on each.'), { m: n.matched }),
      focus: ['cut', 'e-w2', 'p2'],
      reveal: ['e-r1', 'e-w2', 'p2'],
      tokens: [{ edge: 'e-w2', label: fmt(bi('{m} адресов', '{m} addresses'), { m: n.matched }) }],
      say: { cut: bi('Программа cut отрезает от каждой строки всё, кроме первого поля, то есть адреса.', 'cut cuts away everything but the first field, the address.') },
      values: { p1: '0 / 64 KiB', p2: kib(n.matched, 10) },
      fill: { p1: 0, p2: fillOf(n.matched, 10) },
      metrics: { lines: n.lines, matched: n.matched, distinct: 0, printed: 0 },
    });
    if (p.sorted) {
      steps.push({
        id: 'sort-wait',
        label: 'sort',
        caption: fmt(bi('Программа sort собирает у себя все {m} адресов и пока ничего не печатает. Пока данные не кончились, она не может знать, какая строка окажется первой.', 'sort collects all {m} addresses and prints nothing yet. Until the data ends, it cannot know which line will come first.'), { m: n.matched }),
        focus: ['sort', 'e-r2'],
        reveal: ['e-r2'],
        tokens: [{ edge: 'e-r2', label: fmt(bi('{m} адресов', '{m} addresses'), { m: n.matched }) }],
        say: { sort: fmt(bi('Программа sort держит у себя {m} адресов и ждёт конца данных.', 'sort holds {m} addresses and waits for the end of data.'), { m: n.matched }) },
        values: { p2: '0 / 64 KiB', sort: lines(n.matched) },
        fill: { p2: 0 },
        metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: 0 },
      });
      steps.push({
        id: 'eof',
        label: bi('конец данных', 'end of data'),
        caption: bi('Программы grep и cut завершились, и их концы труб закрылись. Для sort это означает конец данных, поэтому она сразу печатает в третью трубу все адреса по порядку, и одинаковые адреса теперь стоят рядом.', 'grep and cut finished and exited, and their pipe ends closed. For sort this means the end of data, so it at once prints all the addresses in order into the third pipe, and identical addresses now stand next to each other.'),
        focus: ['sort', 'e-w3', 'p3'],
        reveal: ['e-w3', 'p3'],
        tokens: [{ edge: 'e-w3', label: fmt(bi('{m} адресов по порядку', '{m} addresses in order'), { m: n.matched }) }],
        say: { sort: bi('Данные кончились, и программа sort печатает все адреса сразу, по порядку.', 'The data ended, and sort prints all the addresses at once, in order.') },
        states: { grep: 'off', cut: 'off' },
        values: { p3: kib(n.matched, 10) },
        fill: { p3: fillOf(n.matched, 10) },
        metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: 0 },
      });
    }
    if (broken.has('early-exit')) {
      steps.push({
        id: 'head',
        label: bi('одна строка', 'one line'),
        caption: bi('Последняя команда прочитала одну строку и завершилась, поэтому читать из третьей трубы больше некому.', 'The last command read one line and exited, so nobody is left to read the third pipe.'),
        focus: ['uniq', 'p3'],
        reveal: p.sorted ? [] : ['p3', 'e-w3'],
        say: { uniq: bi('Команда `head -1` прочитала первую строку, напечатала её и завершилась.', '`head -1` read the first line, printed it and exited.') },
        states: { uniq: 'off', 'e-r3': 'off' },
        metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: n.matched ? 1 : 0 },
      });
      const writer = p.sorted ? 'sort' : 'cut';
      const kibOut = Math.ceil(n.tailBytes / 1024);
      const line = p.sorted ? "grep ' 500 ' access.log | cut -d' ' -f1 | sort | head -1" : "grep ' 500 ' access.log | cut -d' ' -f1 | head -1";
      if (!getsSigpipe(n)) {
        steps.push({
          id: 'fits',
          label: bi('всё в трубе', 'all in the pipe'),
          caption: fill(bi('Программа {w} пишет в трубу около {k} КиБ, а труба вмещает 64 КиБ. Поэтому весь вывод поместился в трубу ещё до того, как `head` завершилась, и {w} закончила работу с кодом 0.', '{w} writes about {k} KiB into the pipe, and the pipe holds 64 KiB. So the whole output fitted into the pipe before `head` exited, and {w} finished with code 0.'), { w: writer, k: kibOut }),
          focus: [writer, 'p3'],
          say: { [writer]: fill(bi('Программа {w} записала в трубу всё, что у неё было, и спокойно завершилась.', '{w} wrote everything it had into the pipe and finished normally.'), { w: writer }) },
          states: { [writer]: 'ok' },
          values: { p3: `${Math.min(64, kibOut)} / 64 KiB` },
          fill: { p3: Math.min(1, n.tailBytes / PIPE_BYTES) },
          metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: n.matched ? 1 : 0 },
        });
        steps.push({
          id: 'no-sigpipe',
          label: bi('без SIGPIPE', 'no SIGPIPE'),
          caption: fill(bi('Сигнала SIGPIPE программа {w} не получила, потому что ядро посылает его, только когда читатель ушёл, а пишущей программе ещё есть что записать. Увеличьте число строк в журнале и долю ошибок, и вывод перестанет помещаться в трубу.', '{w} got no SIGPIPE, because the kernel sends it only when the reader has left while the writer still has data to write. Raise the number of log lines and the share of errors, and the output will no longer fit into the pipe.'), { w: writer }),
          focus: ['p3'],
          say: { p3: bi('Труба приняла весь вывод, хотя читать из неё уже некому.', 'The pipe took the whole output, though no one reads it now.') },
          metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: n.matched ? 1 : 0 },
        });
        return steps;
      }
      steps.push({
        id: 'sigpipe',
        label: 'SIGPIPE',
        caption: fill(bi('Программе {w} нужно записать около {k} КиБ, а труба вмещает только 64 КиБ. Когда труба заполнилась, читателя у неё уже не было, и следующая попытка записи приносит пишущей программе сигнал SIGPIPE. Она завершается с кодом 141, то есть 128 плюс номер сигнала 13. Ошибкой такое завершение не считается, потому что благодаря ему конвейер не тратит силы на данные, которые никто не прочитает.', '{w} has about {k} KiB to write, and the pipe holds only 64 KiB. When the pipe filled up, it no longer had a reader, and the next attempt to write brings the writer SIGPIPE. It ends with code 141, that is, 128 plus the signal number 13. This ending does not count as a fault, because it keeps the pipeline from wasting work on data nobody will read.'), { w: writer, k: kibOut }),
        focus: [writer, 'p3'],
        say: { [writer]: bi('Ядро посылает программе сигнал SIGPIPE, потому что из трубы больше никто не читает.', 'The kernel sends the program SIGPIPE, because nobody reads from the pipe any more.') },
        states: { [writer]: 'err' },
        values: { p3: '64 / 64 KiB' },
        fill: { p3: 1 },
        metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: n.matched ? 1 : 0 },
        broken: { at: writer, message: `$ ${line}; echo "\${PIPESTATUS[@]}"\n10.0.0.12\n${p.sorted ? '0 0 141 0' : '0 141 0'}`, caption: bi('Код 141 складывается из 128 и номера сигнала 13, то есть процесс завершился по сигналу SIGPIPE. Узнают это по числу 141 в переменной PIPESTATUS, где оболочка хранит коды всех команд конвейера. На маленьком выводе, который целиком помещается в трубу, сигнала не будет, и там же окажется 0.', 'Code 141 is 128 plus signal number 13, so the process ended because of SIGPIPE. You recognise it by 141 in PIPESTATUS, where the shell keeps the codes of all the commands of the pipeline. With a small output that fits into the pipe whole there is no signal, and the same place holds 0.') },
      });
      return steps;
    }
    steps.push({
      id: 'uniq',
      label: 'uniq -c',
      caption: p.sorted
        ? fmt(bi('Программа uniq -c склеивает одинаковые адреса, которые стоят рядом, и получает {d} строк, по одной на каждый адрес. Чаще всех встречается адрес {t}, у которого {c} ошибок.', 'uniq -c merges identical adjacent addresses and gets {d} lines, one per address. The most frequent address is {t}, with {c} errors.'), { d: n.printed, t: n.top, c: n.topCount })
        : fmt(bi('Без sort одинаковые адреса идут вперемешку, а uniq склеивает только соседние. Поэтому она печатает {p} строк вместо {d}, и один адрес попадает сразу в несколько строк.', 'Without sort identical addresses come mixed up, and uniq merges only adjacent ones. So it prints {p} lines instead of {d}, and one address shows up on several lines.'), { p: n.printed, d: n.distinct }),
      focus: p.sorted ? ['e-r3', 'uniq'] : ['e-r2', 'uniq'],
      reveal: p.sorted ? ['e-r3'] : ['e-r2'],
      tokens: [{ edge: p.sorted ? 'e-r3' : 'e-r2', label: fmt(bi('{m} адресов', '{m} addresses'), { m: n.matched }) }],
      say: { uniq: p.sorted ? fmt(bi('Программа uniq склеивает соседние одинаковые адреса и получает {d} строк.', 'uniq merges adjacent identical addresses and gets {d} lines.'), { d: n.printed }) : fmt(bi('Программа uniq видит адреса вперемешку и склеивает только те, что идут подряд, поэтому строк получается {p}.', 'uniq sees the addresses mixed up and merges only those in a row, so it gets {p} lines.'), { p: n.printed }) },
      states: p.sorted ? { sort: 'off' } : { sort: 'off', grep: 'off', cut: 'off' },
      values: { p3: '0 / 64 KiB' },
      fill: { p3: 0 },
      metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: n.printed },
    });
    steps.push({
      id: 'out',
      label: bi('экран', 'screen'),
      caption:
        p.stderr === 'pipe'
          ? bi('Вывод uniq попадает на экран. Если бы grep сообщила об ошибке, из-за записи `2>&1` это сообщение тоже ушло бы в трубу, и cut разрезала бы его так же, как строки журнала.', 'uniq’s output reaches the screen. If grep reported an error, `2>&1` would send that message into the pipe too, and cut would cut it like a log line.')
          : bi('Вывод uniq попадает на экран, потому что поток 1 последней команды оболочка оставила подключённым к терминалу.', 'uniq’s output reaches the screen, because the shell left the last command’s stream 1 connected to the terminal.'),
      focus: ['e-out', 'tty'],
      reveal: ['e-out', 'tty', ...(p.stderr === 'pipe' ? [] : ['e-err'])],
      tokens: [{ edge: 'e-out', label: n.printed ? `${n.topCount} ${n.top}` : bi('пусто', 'empty') }],
      say: { tty: n.printed ? fmt(bi('На экране {p} строк, и в каждой стоит число ошибок и адрес.', 'The screen shows {p} lines, each with a count of errors and an address.'), { p: n.printed }) : bi('На экране ничего не появилось, потому что до uniq не дошло ни одной строки.', 'Nothing appeared on the screen, because not a single line reached uniq.') },
      states: { uniq: 'off', tty: 'on' },
      values: { tty: n.printed ? lines(n.printed) : '' },
      metrics: { lines: n.lines, matched: n.matched, distinct: n.distinct, printed: n.printed },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const m = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и конвейер снова доходит до конца.', 'The break is removed, and the pipeline runs to the end again.');
      if (change.id === 'no-file') return bi('Программа grep не открыла файл и написала об этом в поток 2, то есть на экран, а по трубам дальше не прошло ни одной строки.', 'grep could not open the file and wrote about it to stream 2, the screen, and not a single line went down the pipes.');
      return bi('Читающая команда завершилась раньше времени. Следующая попытка записать в трубу без читателя приносит пишущей программе сигнал SIGPIPE и код завершения 141.', 'The reading command exited early. The next attempt to write into a pipe without a reader brings the writer SIGPIPE and exit code 141.');
    }
    switch (change.id) {
      case 'lines':
      {
        const d0 = m(prev).distinct ?? 0;
        const d1 = m(next).distinct ?? 0;
        const tail = d0 === d1
          ? fmt(bi('а разных адресов по-прежнему {d}, потому что в журнале их всего пять', 'and there are still {d} distinct addresses, because the log has only five'), { d: d1 })
          : fmt(bi('а разных адресов стало {d} вместо {d0}, потому что в {b} строк попадает другая часть из пяти адресов журнала', 'and there are now {d} distinct addresses instead of {d0}, because {b} lines take in a different part of the log’s five addresses'), { d: d1, d0, b: b.lines as number });
        const whole = fmtb(bi('В журнале было {a} строк, а стало {b}. Через grep прошло {m} строк, {t}.', 'The log had {a} lines and now has {b}. {m} passed grep, {t}.'), { a: a.lines as number, b: b.lines as number, m: m(next).matched ?? 0, t: tail });
        return { ru: agreeRu(whole.ru), en: whole.en };
      }
      case 'errors':
        return (m(next).matched ?? 0) === 0
          ? bi('В журнале не осталось ни одной строки с кодом 500. Программа grep ничего не пропустила, остальные получили пустой ввод и ничего не напечатали. Поломки здесь нет, и результат пуст только потому, что в журнале больше нет нужных строк.', 'The log has no line with code 500 left. grep let nothing through, the others got empty input and printed nothing. This is not a fault: the result is empty because the log no longer has the lines you look for.')
          : fmt(bi('Теперь ошибкой 500 заканчиваются {e}% запросов, и через grep проходит {m} строк из {l}.', 'Now {e}% of requests end with a 500 error, and {m} of {l} lines pass grep.'), { e: b.errors as number, m: m(next).matched ?? 0, l: m(next).lines ?? 0 });
      case 'sorted':
        return b.sorted
          ? fmt(bi('С командой sort одинаковые адреса стоят рядом, и uniq печатает по строке на адрес, всего {p}.', 'With sort identical addresses stand together, and uniq prints one line per address, {p} in all.'), { p: m(next).printed ?? 0 })
          : fmt(bi('Без sort программа uniq видит адреса вперемешку и считает только идущие подряд, поэтому печатает {p} строк вместо {d}.', 'Without sort, uniq sees the addresses mixed up and counts only those in a row, so it prints {p} lines instead of {d}.'), { p: m(next).printed ?? 0, d: m(next).distinct ?? 0 });
      case 'stderr':
        return b.stderr === 'pipe' ? bi('Запись `2>&1` перед `|` отправляет сообщения об ошибках grep в трубу вместе с данными, и cut будет разрезать их так же, как строки журнала.', '`2>&1` before `|` sends grep’s error messages into the pipe together with the data, and cut will cut them like log lines.') : bi('Сообщения об ошибках снова идут на экран, мимо трубы.', 'Error messages go to the screen again, past the pipe.');
    }
    void prev;
    return bi('Параметр изменился, и конвейер пересчитан заново.', 'The parameter changed, and the pipeline was recomputed.');
  },
});
