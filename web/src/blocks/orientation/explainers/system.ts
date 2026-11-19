// The operating system as the go-between: programs never touch the hardware
// themselves; the system keeps the files, hands out memory and shares the
// processor in turns (F04, F03).
//
// Reading order: at the start there are only the editor and the disk it wants
// to save to. The system appears when the editor turns to it, then the disk
// takes the blocks, the browser asks for memory and the processor appears
// last, with the queue of programs. The break removes the go-between and shows
// two programs writing into the same block of the disk.

import { defineModel } from '../../../core/define';
import { bi, pluralRu, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { card, fmtb, startWith } from './kit';

type P = { programs: number; cores: string };

const SLICE_MS = 10;

export function share(p: P): { share: number; switches: number } {
  const cores = p.cores === '4' ? 4 : 1;
  const sharePct = Math.round(Math.min(1, cores / Math.max(1, p.programs)) * 100);
  const switches = p.programs > cores ? Math.round((1000 / SLICE_MS) * cores) : 0;
  return { share: sharePct, switches };
}

const ALL = ['editor', 'browser', 'os', 'disk', 'memory', 'cpu', 'e-save', 'e-write', 'e-mem', 'e-alloc', 'e-turns', 'e-rawA', 'e-rawB'];
/** Dative: «нужен 3 программам». */
const progsDat = (n: number) => `${n} ${pluralRu(n, ['программе', 'программам', 'программам'])}`;
const cores = (n: number) => `${n} ${pluralRu(n, ['ядро', 'ядра', 'ядер'])}`;

export const systemModel = defineModel<P>({
  id: 'orient.system',
  block: 'orient',
  title: bi('Операционная система между программами и железом', 'The operating system between programs and hardware'),
  summary: bi(
    'Программы не пишут на диск сами и не берут себе память и процессор, а просят об этом операционную систему. Схема показывает три такие просьбы подряд: редактор сохраняет файл, браузер просит память для новой вкладки, а несколько программ делят одно ядро процессора.',
    'Programs neither write to the disk themselves nor take memory and the processor: they ask the operating system. The diagram shows three such requests: the editor saves a file, the browser asks for memory for a new tab, and several programs share one processor core.',
  ),
  intro: bi(
    'Сейчас на схеме только редактор, в котором вы нажали «Сохранить», и диск. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен тот, кто работает сейчас, облачко говорит, что он делает, а карточка на линии показывает, с какой просьбой или с каким результатом одна часть обращается к другой.\n\nКогда дойдёте до процессора, поменяйте в «Параметрах» число программ и ядер. Напоследок включите в блоке «Сломать» поломку, при которой программы пишут на диск сами, без системы.',
    'Now the diagram shows only the editor where you pressed “Save” and the disk. Press “Start from the first step”, then go on with “Step forward” above the diagram. The one working now is highlighted, the callout says what it does, and the card on the line shows the request or result passed on.\n\nOnce you reach the processor, change the number of programs and cores in “Parameters”. Finally switch on the break in “Break it” where programs write to the disk themselves.',
  ),
  legend: [
    { mark: 'active', text: bi('часть, которая работает сейчас', 'the part working now') },
    { mark: 'say', text: bi('что она делает', 'what it does') },
    { mark: 'token', text: bi('просьба программы или ответ системы', 'a program’s request or the system’s answer') },
    { mark: 'icon:lock', text: bi('операционная система распоряжается железом', 'the operating system: in charge of the hardware') },
    { mark: 'icon:file', text: bi('редактор текста', 'the text editor') },
    { mark: 'icon:browser', text: bi('браузер', 'the browser') },
    { mark: 'icon:disk', text: bi('диск', 'the disk') },
    { mark: 'icon:switch', text: bi('память', 'memory') },
    { mark: 'icon:process', text: bi('процессор', 'the processor') },
    { mark: 'warn', text: bi('процессора на всех не хватает', 'not enough processor for everyone') },
    { mark: 'err', text: bi('данные испорчены', 'the data is spoilt') },
  ],
  stopLabel: bi('Запись испорчена', 'The write is spoilt'),
  concepts: ['orient.os', 'orient.file'],
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      {
        id: 'editor',
        label: bi('Редактор', 'Editor'),
        icon: 'file',
        work: 'dots',
        sub: 'notes.txt',
        family: 'process',
        x: 40,
        y: 32,
        w: 220,
        h: 64,
        card: card(
          bi('Редактором называют программу, в которой вы пишете текст. Он хочет сохранить файл, но не знает, где на диске свободное место, потому что это знает только операционная система.', 'The program you write text in. It wants to save a file but does not know where the disk has free room; only the system knows.'),
          bi('Редактор запустили вы, щёлкнув по его значку.', 'You started it with a click.'),
        ),
      },
      {
        id: 'browser',
        label: bi('Браузер', 'Browser'),
        icon: 'browser',
        work: 'dots',
        sub: '12 tabs',
        family: 'process',
        x: 370,
        y: 32,
        w: 220,
        h: 64,
        card: card(
          bi('Браузер тоже работает как обычная программа. Под каждую вкладку браузеру нужна память, а чтобы рисовать страницы, ему нужен процессор.', 'Another program. It needs memory for its tabs and the processor to draw pages.'),
          bi('Браузер тоже запустили вы.', 'You started it too.'),
        ),
      },
      {
        id: 'os',
        label: bi('Операционная система', 'Operating system'),
        icon: 'lock',
        work: 'spin',
        sub: 'Linux · Windows · macOS',
        family: 'kernel',
        shape: 'bar',
        x: 16,
        y: 168,
        w: 928,
        h: 64,
        card: card(
          bi('Операционную систему называют главной программой компьютера. Она запускает остальные программы, по очереди даёт им процессор, раздаёт память, ведёт учёт файлов и папок на диске и управляет устройствами. Программы обращаются к железу только через неё.', 'The main program of the computer. It starts the others, gives them the processor in turns, hands out memory, keeps track of files and talks to the devices.'),
          bi('Система загружается первой при включении компьютера и работает до самого выключения.', 'Loads first at power-on and runs until power-off.'),
          { see: 'uname -a', doc: { page: 'man/uname.1', anchor: 'DESCRIPTION' } },
        ),
      },
      {
        id: 'disk',
        label: bi('Диск', 'Disk'),
        icon: 'disk',
        sub: '/home/learner',
        family: 'store',
        x: 40,
        y: 304,
        w: 220,
        h: 64,
        card: card(
          bi('На самом диске нет ни файлов, ни папок, только миллиарды пронумерованных блоков. Какие блоки свободны и какие из них принадлежат файлу notes.txt, помнит операционная система.', 'A disk has no files, only numbered blocks. Which are free and which belong to notes.txt the system remembers.'),
          bi('Диск стоит внутри компьютера и подключён к его главной плате.', 'The disk sits inside the computer and is connected to its main board.'),
          { see: 'df -h' },
        ),
      },
      {
        id: 'memory',
        label: bi('Память', 'Memory'),
        icon: 'switch',
        sub: '8 GB',
        family: 'neutral',
        x: 370,
        y: 304,
        w: 220,
        h: 64,
        card: card(
          bi('Система выдаёт каждой программе отдельный участок памяти и следит, чтобы программа не залезла в чужой участок.', 'The system gives each program its own piece of memory and keeps it out of the others’.'),
          bi('Память вставлена в главную плату компьютера.', 'Memory is plugged into the computer’s main board.'),
          { see: 'free -h' },
        ),
      },
      {
        id: 'cpu',
        label: bi('Процессор', 'Processor'),
        icon: 'process',
        sub: '1 core',
        family: 'neutral',
        x: 700,
        y: 304,
        w: 220,
        h: 64,
        card: card(
          bi('В каждый момент одно ядро процессора выполняет одну программу. Если ядер несколько, столько же программ работают одновременно, а остальные ждут своей очереди.', 'One core runs one program at any moment; several cores run several at once.'),
          bi('Процессор стоит на главной плате компьютера.', 'The processor sits on the computer’s main board.'),
          { see: 'nproc' },
        ),
      },
    ],
    edges: [
      { id: 'e-save', from: 'editor', to: 'os', via: [[150, 168]], label: bi('сохрани notes.txt', 'save notes.txt'), card: card(bi('Редактор просит систему: «запиши вот этот текст в файл notes.txt в папке notes».', 'The editor’s request: “write this text into notes.txt”.'), bi('Просьбу отправляет редактор, когда вы нажимаете «Сохранить».', 'The editor, when you press “Save”.')) },
      { id: 'e-write', from: 'os', to: 'disk', via: [[150, 232]], label: bi('блоки файла', 'file blocks'), card: card(bi('Система находит на диске свободные блоки, записывает туда текст и запоминает, что эти блоки теперь принадлежат файлу notes.txt.', 'The system finds free blocks, writes the text and remembers they are notes.txt.'), bi('Блоки записывает операционная система.', 'The operating system.'), { see: 'ls -l notes' }) },
      { id: 'e-mem', from: 'browser', to: 'os', via: [[480, 168]], label: bi('дай памяти', 'give me memory'), card: card(bi('Каждая новая вкладка означает, что браузер снова просит систему выделить ему ещё немного памяти.', 'Every new tab means the browser again asks the system for a little more memory.'), bi('Память просит браузер.', 'The browser.')) },
      { id: 'e-alloc', from: 'os', to: 'memory', via: [[480, 232]], label: bi('свой участок', 'its own piece'), card: card(bi('Система выделяет программе отдельный участок памяти. Залезть в чужой участок программа не сможет, потому что система этого не позволит.', 'The system gives the program its own piece of memory and keeps it out of others’.'), bi('Участок выделяет операционная система.', 'The operating system.')) },
      { id: 'e-turns', from: 'os', to: 'cpu', via: [[810, 232]], label: bi('программы по очереди', 'programs in turns'), card: card(bi('Система даёт процессор каждой программе на несколько миллисекунд и переключает его на следующую. Переключения так часты, что программы кажутся работающими одновременно.', 'The system gives the processor to each program for a few milliseconds and moves on.'), bi('Очередь ведёт операционная система.', 'The operating system.')) },
      { id: 'e-rawA', from: 'editor', to: 'disk', dashed: true, labelAt: 0.25, label: bi('редактор пишет сам', 'writes itself'), card: card(bi('Без операционной системы редактор сам выбирал бы блоки диска и писал бы в них, ни у кого не спросив.', 'Without the system: the editor picks disk blocks itself.'), bi('Так пишет редактор, когда посредника нет.', 'The editor, with no go-between.')) },
      { id: 'e-rawB', from: 'browser', to: 'disk', dashed: true, via: [[480, 280]], labelAt: 0.3, label: bi('браузер тоже пишет сам', 'writes itself too'), card: card(bi('Браузер без посредника тоже сам выбирает блоки диска и не знает, что редактор уже занял некоторые из них.', 'Without the system the browser picks blocks too, unaware of the editor.'), bi('Так пишет браузер, когда посредника нет.', 'The browser, with no go-between.')) },
    ],
  },
  params: [
    {
      id: 'programs',
      label: bi('Сколько программ одновременно хотят процессор', 'Programs that want the processor'),
      group: bi('Программы', 'Programs'),
      kind: 'range',
      min: 1,
      max: 8,
      step: 1,
      default: 3,
      near: 'cpu',
      predict: {
        prompt: bi('Вы изменили число программ, которым нужен процессор, а число ядер осталось прежним. Как эти программы будут работать?', 'You changed the number of programs that need the processor; the cores stay the same. How will the programs run?'),
        options: [
          { id: 'turns', text: bi('По очереди, но так быстро, что это похоже на одновременную работу', 'In turns, so fast it seems simultaneous') },
          { id: 'wait', text: bi('Одна будет работать, а остальные ждать, пока она закончит', 'One runs, the others wait until it finishes') },
          { id: 'own', text: bi('Каждой программе достанется своё ядро, и очереди не будет', 'Each gets a core of its own, no queue') },
        ],
        resolve: (_prev, next) => ((next[next.length - 1]?.metrics?.switches ?? 0) > 0 ? 'turns' : 'own'),
      },
    },
    {
      id: 'cores',
      label: bi('Сколько ядер у процессора', 'Processor cores'),
      group: bi('Процессор', 'The processor'),
      kind: 'choice',
      default: '1',
      near: 'cpu',
      options: [
        { id: '1', label: bi('одно ядро, как у старого ноутбука', 'one core, like an old laptop') },
        { id: '4', label: bi('четыре ядра', 'four cores') },
      ],
    },
  ],
  breaks: [
    {
      id: 'no-os',
      label: bi('Программы пишут на диск сами, не спрашивая систему', 'Programs write to the disk themselves'),
      remove: ['os', 'e-write'],
      boundary: 'storage',
      predict: {
        prompt: bi('Редактор и браузер пишут на диск сами, не спрашивая систему, и каждый из них ищет свободное место самостоятельно. Что станет с файлом notes.txt?', 'The editor and the browser write to the disk themselves, each looking for free room on its own. What becomes of notes.txt?'),
        options: [
          { id: 'clash', text: bi('Браузер запишет свои данные поверх текста, и файл испортится', 'The browser writes over the text and the file is spoilt') },
          { id: 'fine', text: bi('Файл сохранится, только запись пойдёт быстрее', 'The file is saved, only faster') },
        ],
        resolve: (_prev, next) => (next.some((s) => s.broken) ? 'clash' : 'fine'),
      },
    },
  ],
  metrics: [
    { id: 'share', label: bi('доля процессора у каждой программы', 'processor share each'), unit: '%' },
    { id: 'switches', label: bi('сколько раз в секунду переключается процессор', 'switches per second') },
  ],
  run(p, broken): Step[] {
    const n = share(p);
    const metrics = { share: n.share, switches: n.switches };
    const c = p.cores === '4' ? 4 : 1;
    const steps: Step[] = [
      {
        id: 'press',
        label: bi('«Сохранить»', '“Save”'),
        caption: bi(
          'Вы нажали «Сохранить» в редакторе. Чтобы текст пережил выключение, его нужно записать на диск, но редактор не знает, какие места на диске свободны, а какие заняты другими файлами. Этот учёт ведёт операционная система, поэтому редактор не пишет на диск сам, а обращается к ней.',
          'You pressed “Save”. The text must go to the disk, but the editor does not know which places there are free; the operating system keeps that account, so the editor asks it.',
        ),
        focus: ['editor'],
        say: { editor: bi('Редактору нужно записать файл notes.txt на диск.', 'The editor needs to write notes.txt to the disk.') },
        states: { ...startWith(ALL, 'editor', 'disk'), editor: 'on' },
        values: { cpu: c === 4 ? '4 cores' : '1 core' },
        metrics,
      },
    ];
    if (broken.has('no-os')) {
      steps.push(
        {
          id: 'rawA',
          label: bi('редактор пишет', 'editor writes'),
          caption: bi('Посредника нет, и редактор сам ищет на диске свободное место. Он решает, что блок 4711 никем не занят, и записывает туда ваш текст.', 'There is no go-between: the editor itself decides block 4711 is free and writes your text there.'),
          focus: ['e-rawA', 'disk'],
          reveal: ['e-rawA', 'os'],
          tokens: [{ edge: 'e-rawA', label: 'notes.txt → 4711' }],
          say: { disk: bi('Редактор сам записал текст в блок 4711, решив, что этот блок свободен.', 'The editor wrote the text into block 4711.') },
          states: { os: 'off' },
          values: { disk: 'notes.txt · 4711' },
          metrics,
        },
        {
          id: 'rawB',
          label: bi('браузер пишет', 'browser writes'),
          caption: bi('Браузер тоже ищет место сам. Он не знает, что редактор только что занял блок 4711, считает этот блок свободным и записывает туда свои временные файлы. Половина вашего текста стёрта.', 'The browser also decides block 4711 is free and writes its cache there. Half of your text is gone.'),
          focus: ['e-rawB', 'disk'],
          reveal: ['browser', 'e-rawB'],
          tokens: [{ edge: 'e-rawB', label: 'cache → 4711' }],
          say: { disk: bi('Браузер записал свои данные в тот же блок 4711, поверх текста.', 'The browser wrote into the same block 4711.') },
          states: { disk: 'err', browser: 'on' },
          values: { disk: 'notes.txt · 4711 (!)' },
          metrics,
          broken: { at: 'disk', message: 'cat: notes.txt: Input/output error', caption: bi('на диске. Учёт места на диске должен вести кто-то один, иначе программы пишут друг поверх друга. Эту работу и выполняет операционная система.', 'on the disk: one party must keep track of disk space; that is the system’s job.') },
        },
      );
      return steps;
    }
    const turns = n.switches > 0;
    steps.push(
      {
        id: 'ask',
        label: bi('просьба', 'request'),
        caption: bi('Редактор просит систему записать текст в файл notes.txt в папке notes. Сам редактор при этом ждёт ответа.', 'The editor hands the system a request: write the text into notes.txt. It waits for the answer.'),
        focus: ['e-save', 'os'],
        reveal: ['os', 'e-save'],
        tokens: [{ edge: 'e-save', label: bi('сохрани notes.txt', 'save notes.txt') }],
        say: { os: bi('Система принимает просьбу редактора сохранить файл notes.txt.', 'The system takes the editor’s request to save notes.txt.') },
        states: { os: 'on' },
        metrics,
      },
      {
        id: 'write',
        label: bi('запись', 'write'),
        caption: bi('Система находит на диске свободные блоки 4711–4713, записывает в них текст и отмечает у себя, что эти блоки принадлежат файлу notes.txt. Никакая другая программа их теперь не получит.', 'The system finds free blocks 4711–4713, writes the text and notes they belong to notes.txt.'),
        focus: ['e-write', 'disk'],
        reveal: ['e-write'],
        tokens: [{ edge: 'e-write', label: bi('блоки 4711–4713', 'blocks 4711–4713') }],
        say: { disk: bi('Диск записывает текст в блоки 4711–4713, которые система нашла свободными.', 'The disk writes the text into the free blocks 4711–4713.') },
        states: { disk: 'ok' },
        values: { disk: 'notes.txt · 4711–4713' },
        metrics,
      },
      {
        id: 'done',
        label: bi('готово', 'done'),
        caption: bi('Система сообщает редактору, что файл записан. Редактор показывает вам, что всё сохранено, и вы продолжаете печатать.', 'The system tells the editor the file is written.'),
        focus: ['e-save', 'editor'],
        tokens: [{ edge: 'e-save', label: bi('готово', 'done'), reverse: true }],
        say: { editor: bi('Редактор получил от системы ответ, что файл сохранён.', 'The editor hears back from the system that the file is saved.') },
        states: { editor: 'ok' },
        metrics,
      },
      {
        id: 'tab',
        label: bi('вкладка', 'tab'),
        caption: bi('Тем временем вы открыли в браузере новую вкладку. Странице нужна память, и браузер тоже не берёт её сам, а просит у системы.', 'Meanwhile you opened a new tab. The page needs memory, and the browser asks the system for it.'),
        focus: ['browser', 'e-mem'],
        reveal: ['browser', 'e-mem'],
        tokens: [{ edge: 'e-mem', label: bi('нужно 300 МБ', 'need 300 MB') }],
        say: { browser: bi('Браузер открывает вкладку и просит у системы 300 МБ памяти.', 'The browser asks for 300 MB for a new tab.') },
        states: { browser: 'on' },
        metrics,
      },
      {
        id: 'alloc',
        label: bi('память', 'memory'),
        caption: bi('Система выделяет браузеру отдельный участок памяти. Участок редактора остаётся нетронутым, а если браузер попытается залезть в чужую память, система его остановит.', 'The system gives the browser a separate piece of memory; the editor’s piece stays untouched.'),
        focus: ['e-alloc', 'memory'],
        reveal: ['memory', 'e-alloc'],
        tokens: [{ edge: 'e-alloc', label: bi('+300 МБ браузеру', '+300 MB for the browser') }],
        say: { memory: bi('У браузера появился свой участок памяти, отдельный от участка редактора.', 'The browser has its own piece, apart from the editor’s.') },
        states: { memory: 'on' },
        metrics,
      },
      {
        id: 'turns',
        label: bi('по очереди', 'in turns'),
        caption: turns
          ? fmtb(
              bi(
                'Процессор сейчас нужен {n}, а у него {c}. Поэтому система даёт каждой программе по {s} мс и переключает процессор на следующую, {w} раз в секунду. Каждой достаётся {sh}% времени процессора, но перерывы так коротки, что музыка не прерывается, а буквы появляются сразу.',
                '{n} want the processor and it has {c}. The system gives each {s} ms and moves on, {w} times a second; each gets {sh}%.',
              ),
              { n: bi(progsDat(p.programs), `${p.programs} programs`), c: bi(cores(c), `${c} core(s)`), s: SLICE_MS, w: n.switches, sh: n.share },
            )
          : fmtb(bi('Процессор нужен {n}, а у него {c}. Каждой программе досталось своё ядро, поэтому очереди нет, и никому не приходится ждать.', '{n} programs, {c} cores: each has a core of its own, there is no queue.'), { n: bi(progsDat(p.programs), `${p.programs}`), c: bi(cores(c), `${c}`) }),
        focus: ['e-turns', 'cpu'],
        reveal: ['cpu', 'e-turns'],
        tokens: [{ edge: 'e-turns', label: turns ? bi(`по ${SLICE_MS} мс каждой`, `${SLICE_MS} ms each`) : bi('по ядру каждой', 'a core each') }],
        say: {
          cpu: turns
            ? fmtb(bi('Ядро выполняет программы по очереди и переключается между ними {w} раз в секунду.', 'The core runs the programs in turns and switches between them {w} times a second.'), { w: n.switches })
            : bi('У каждой программы своё ядро, и ждать очереди не нужно.', 'Each program has its own core.'),
        },
        states: { cpu: n.share < 30 ? 'warn' : 'on' },
        values: { cpu: `${c === 4 ? '4 cores' : '1 core'} · ${n.share}% each` },
        metrics,
      },
    );
    return steps;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    const m = next[next.length - 1]?.metrics ?? {};
    if (change.kind === 'break') {
      return change.on
        ? bi('Без системы учёт диска никто не ведёт, поэтому две программы записали данные в один и тот же блок, и файл испорчен.', 'Without the system nobody keeps track of the disk: two programs wrote into the same block.')
        : bi('Операционная система снова стоит посредником, поэтому программы просят её о месте на диске, и она раздаёт его так, что записи не сталкиваются.', 'The operating system is the go-between again, so programs ask it for disk space, and it hands the space out so that writes do not collide.');
    }
    if (change.id === 'programs')
      return fmtb(bi('Процессор теперь нужен не {a}, а {b}. Каждой программе достаётся {s}% его времени, поэтому работают все, но каждая медленнее.', '{a} → {b} programs: each gets {s}% of the processor.'), { a: bi(progsDat(a.programs as number), String(a.programs)), b: bi(progsDat(b.programs as number), String(b.programs)), s: m.share ?? 0 });
    return fmtb(bi('Теперь у процессора {c}. Одновременно работают до {n} программ, и каждой достаётся {s}% времени процессора.', 'Now {c}: up to {n} programs at once, {s}% each.'), { c: bi(cores(Number(b.cores)), `${b.cores} cores`), n: Number(b.cores), s: m.share ?? 0 });
  },
});
