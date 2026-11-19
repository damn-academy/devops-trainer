// The operating system as the go-between: programs never touch the hardware
// themselves; the system shares the processor in turns, hands out memory and
// keeps the files (F04, F03).

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';

type P = { programs: number; cores: string };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
const SLICE_MS = 10;

export function share(p: P): { share: number; switches: number } {
  const cores = p.cores === '4' ? 4 : 1;
  const sharePct = Math.round(Math.min(1, cores / Math.max(1, p.programs)) * 100);
  const switches = p.programs > cores ? Math.round((1000 / SLICE_MS) * cores) : 0;
  return { share: sharePct, switches };
}

export const systemModel = defineModel<P>({
  id: 'orient.system',
  block: 'orient',
  title: bi('Операционная система между программами и железом', 'The operating system between programs and hardware'),
  summary: bi(
    'Программы не трогают диск и процессор сами: они просят систему. Добавьте программ, поменяйте число ядер, уберите посредника.',
    'Programs do not touch the disk and the processor themselves: they ask the system. Add programs, change the number of cores, remove the go-between.',
  ),
  concepts: ['orient.os', 'orient.file'],
  diagram: {
    width: 960,
    height: 392,
    nodes: [
      { id: 'editor', label: bi('Редактор', 'Editor'), sub: 'notes.txt', family: 'process', x: 40, y: 32, w: 200, h: 56, card: card(bi('Программа, в которой вы пишете текст. Хочет сохранить файл, но не знает, где на диске свободное место, — это знает только система.', 'The program you write text in. It wants to save a file but does not know where the disk has free room; only the system knows that.'), bi('Вы запустили её щелчком.', 'You started it with a click.')) },
      { id: 'browser', label: bi('Браузер', 'Browser'), sub: '12 tabs', family: 'process', x: 380, y: 32, w: 200, h: 56, card: card(bi('Ещё одна программа. Ей нужны память под вкладки и процессор, чтобы рисовать страницы.', 'Another program. It needs memory for its tabs and the processor to draw pages.'), bi('Вы запустили её щелчком.', 'You started it with a click.')) },
      { id: 'player', label: bi('Плеер', 'Player'), sub: 'music', family: 'process', x: 720, y: 32, w: 200, h: 56, card: card(bi('Третья программа: играет музыку и не должна прерываться, пока вы пишете.', 'A third program: it plays music and must not stop while you write.'), bi('Вы запустили её щелчком.', 'You started it with a click.')) },
      { id: 'os', label: bi('Операционная система', 'Operating system'), sub: 'Linux · Windows · macOS', family: 'kernel', shape: 'bar', x: 16, y: 160, w: 928, h: 72, card: card(bi('Главная программа компьютера. Запускает остальные, по очереди даёт им процессор, раздаёт память, ведёт учёт файлов и папок и говорит с устройствами. Программы обращаются к железу только через неё.', 'The main program of the computer. It starts the others, gives them the processor in turns, hands out memory, keeps track of files and folders and talks to the devices. Programs reach the hardware only through it.'), bi('Загружается первой при включении компьютера и работает до выключения.', 'Loads first when the computer is switched on and runs until it is switched off.'), { see: 'uname -a', doc: { page: 'man/uname.1', anchor: 'DESCRIPTION' } }) },
      { id: 'cpu', label: bi('Процессор', 'Processor'), sub: '1 core', family: 'neutral', x: 40, y: 304, w: 200, h: 56, card: card(bi('Одно ядро процессора в каждый момент выполняет одну программу. Несколько ядер — несколько программ сразу.', 'One processor core runs one program at any moment. Several cores run several programs at once.'), bi('Железо.', 'Hardware.'), { see: 'nproc' }) },
      { id: 'memory', label: bi('Память', 'Memory'), sub: '8 GB', family: 'neutral', x: 380, y: 304, w: 200, h: 56, card: card(bi('Система выдаёт каждой программе свой участок памяти и не пускает её в чужой.', 'The system gives each program its own piece of memory and keeps it out of the others’.'), bi('Железо.', 'Hardware.'), { see: 'free -h' }) },
      { id: 'disk', label: bi('Диск', 'Disk'), sub: '/home/learner', family: 'store', x: 720, y: 304, w: 200, h: 56, card: card(bi('На диске нет «файлов» — только пронумерованные блоки. Имена, папки и то, какие блоки чьи, помнит система.', 'A disk has no “files”, only numbered blocks. Names, folders and which blocks belong to what are remembered by the system.'), bi('Железо.', 'Hardware.'), { see: 'df -h' }) },
    ],
    edges: [
      { id: 'e-save', from: 'editor', to: 'os', label: bi('сохрани файл', 'save the file'), card: card(bi('Просьба программы к системе: «запиши вот эти байты в файл notes.txt в папке notes».', 'The program’s request to the system: “write these bytes into the file notes.txt in the folder notes”.'), bi('Редактор, когда вы нажали «Сохранить».', 'The editor, when you pressed “Save”.')) },
      { id: 'e-mem', from: 'browser', to: 'os', label: bi('дай память', 'give me memory'), card: card(bi('Новая вкладка — новая просьба выделить память.', 'A new tab is a new request for memory.'), bi('Браузер.', 'The browser.')) },
      { id: 'e-play', from: 'player', to: 'os', label: bi('мне процессор', 'processor, please'), card: card(bi('Каждой программе нужен процессор; система решает, кому и на сколько.', 'Every program needs the processor; the system decides who gets it and for how long.'), bi('Плеер.', 'The player.')) },
      { id: 'e-turns', from: 'os', to: 'cpu', label: bi('по очереди', 'in turns'), card: card(bi('Система даёт процессор каждой программе на несколько миллисекунд и переключает дальше. Переключения так часты, что программы кажутся работающими одновременно.', 'The system gives the processor to each program for a few milliseconds and moves on. The switches are so frequent that the programs seem to run at the same time.'), bi('Операционная система.', 'The operating system.')) },
      { id: 'e-alloc', from: 'os', to: 'memory', label: bi('участки', 'pieces'), card: card(bi('Каждая программа получает свой участок памяти. Залезть в чужой система не позволит.', 'Every program gets its own piece of memory. The system will not let it into another’s.'), bi('Операционная система.', 'The operating system.')) },
      { id: 'e-write', from: 'os', to: 'disk', label: bi('блоки файла', 'file blocks'), card: card(bi('Система находит свободные блоки, записывает туда данные и запоминает, что это файл notes.txt.', 'The system finds free blocks, writes the data there and remembers that this is the file notes.txt.'), bi('Операционная система.', 'The operating system.'), { see: 'ls -l notes' }) },
    ],
  },
  params: [
    {
      id: 'programs',
      label: bi('Сколько программ хотят процессор', 'Programs that want the processor'),
      kind: 'range',
      min: 1,
      max: 8,
      step: 1,
      default: 3,
      near: 'cpu',
      predict: {
        prompt: bi('Восемь программ и одно ядро. Как они будут работать?', 'Eight programs and one core. How will they run?'),
        options: [
          { id: 'turns', text: bi('По очереди, так быстро, что кажется — одновременно', 'In turns, so fast that it seems simultaneous') },
          { id: 'wait', text: bi('Одна работает, остальные ждут, пока она закончит', 'One runs, the others wait until it finishes') },
        ],
        resolve: (_prev, next) => ((next[next.length - 1]?.metrics?.switches ?? 0) > 0 ? 'turns' : 'wait'),
      },
    },
    {
      id: 'cores',
      label: bi('Ядер в процессоре', 'Processor cores'),
      kind: 'choice',
      default: '1',
      near: 'cpu',
      options: [
        { id: '1', label: bi('1', '1') },
        { id: '4', label: bi('4', '4') },
      ],
    },
  ],
  breaks: [
    {
      id: 'no-os',
      label: bi('Программы пишут на диск сами, без системы', 'Programs write to the disk themselves, without the system'),
      remove: ['os', 'e-write'],
      boundary: 'storage',
      predict: {
        prompt: bi('Редактор и браузер одновременно пишут на диск сами, не спросив систему. Что будет?', 'The editor and the browser both write to the disk themselves without asking the system. What happens?'),
        options: [
          { id: 'clash', text: bi('Они запишут в одни и те же блоки и испортят друг другу данные', 'They write into the same blocks and spoil each other’s data') },
          { id: 'fine', text: bi('Ничего страшного, зато быстрее', 'Nothing bad, just faster') },
        ],
        resolve: () => 'clash',
      },
    },
  ],
  metrics: [
    { id: 'share', label: bi('доля процессора у каждой', 'processor share each'), unit: '%' },
    { id: 'switches', label: bi('переключений в секунду', 'switches per second') },
  ],
  run(p, broken): Step[] {
    const n = share(p);
    const metrics = { share: n.share, switches: n.switches };
    const cores = p.cores === '4' ? 4 : 1;
    const steps: Step[] = [
      {
        id: 'ask',
        label: bi('просьба', 'request'),
        caption: bi('Вы нажали «Сохранить». Редактор не пишет на диск сам — он просит систему: «сохрани notes.txt».', 'You pressed “Save”. The editor does not write to the disk itself; it asks the system: “save notes.txt”.'),
        focus: ['editor', 'e-save', 'os'],
        tokens: [{ edge: 'e-save', label: 'notes.txt' }],
        states: { editor: 'on', os: 'on' },
        values: { cpu: `${cores} core${cores > 1 ? 's' : ''}` },
        metrics,
      },
    ];
    if (broken.has('no-os')) {
      steps.push(
        {
          id: 'both',
          label: bi('без посредника', 'no go-between'),
          caption: bi('Посредника нет. Редактор и браузер сами ищут на диске свободное место — и каждый решает, что блок 4711 свободен.', 'There is no go-between. The editor and the browser look for free room on the disk themselves, and each decides that block 4711 is free.'),
          focus: ['editor', 'browser', 'disk'],
          states: { os: 'off', editor: 'warn', browser: 'warn' },
          metrics,
        },
        {
          id: 'clash',
          label: bi('порча', 'corruption'),
          caption: bi('Браузер записал свой кэш поверх половины вашего текста. Файл notes.txt испорчен.', 'The browser wrote its cache over half of your text. The file notes.txt is spoilt.'),
          focus: ['disk'],
          states: { disk: 'err' },
          metrics,
          broken: { at: 'disk', message: "cat: notes.txt: Input/output error", caption: bi('кто-то должен один вести учёт места на диске; это и есть работа системы.', 'someone has to be the only one who keeps track of disk space; that is the system’s job.') },
        },
      );
      return steps;
    }
    steps.push(
      {
        id: 'write',
        label: bi('запись', 'write'),
        caption: bi('Система находит свободные блоки, пишет туда текст и отмечает: это файл notes.txt в папке notes. Редактор получает ответ «готово».', 'The system finds free blocks, writes the text there and notes: this is the file notes.txt in the folder notes. The editor gets the answer “done”.'),
        focus: ['os', 'e-write', 'disk'],
        tokens: [{ edge: 'e-write', label: 'blocks 4711–4713' }],
        states: { disk: 'ok' },
        metrics,
      },
      {
        id: 'memory',
        label: bi('память', 'memory'),
        caption: bi('Тем временем браузер открыл вкладку и попросил памяти. Система выделила ему отдельный участок, в чужой он не залезет.', 'Meanwhile the browser opened a tab and asked for memory. The system gave it a separate piece; it cannot reach into anyone else’s.'),
        focus: ['browser', 'e-mem', 'os', 'e-alloc', 'memory'],
        tokens: [{ edge: 'e-mem' }, { edge: 'e-alloc', label: '+300 MB' }],
        states: { browser: 'on', memory: 'on' },
        metrics,
      },
      {
        id: 'turns',
        label: bi('по очереди', 'in turns'),
        caption:
          n.switches > 0
            ? fmt(bi('Процессор хотят {n} программ, а ядер {c}. Система даёт каждой по {s} мс и переключает дальше — {w} раз в секунду. Музыка не прерывается.', '{n} programs want the processor and there are {c} cores. The system gives each {s} ms and moves on, {w} times a second. The music does not stop.'), { n: p.programs, c: cores, s: SLICE_MS, w: n.switches })
            : fmt(bi('Программ {n}, ядер {c}: каждой досталось своё ядро, очереди нет.', '{n} programs, {c} cores: each has a core of its own, there is no queue.'), { n: p.programs, c: cores }),
        focus: ['player', 'e-play', 'os', 'e-turns', 'cpu'],
        tokens: [{ edge: 'e-play' }, { edge: 'e-turns', label: `${SLICE_MS} ms` }],
        states: { player: 'on', cpu: n.share < 30 ? 'warn' : 'on' },
        values: { cpu: `${cores} core${cores > 1 ? 's' : ''} · ${n.share}% each` },
        metrics,
      },
    );
    return steps;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    const m = next[next.length - 1]?.metrics ?? {};
    if (change.kind === 'break') {
      return change.on
        ? bi('Без системы никто не ведёт учёт диска: две программы записали данные в одно место, и файл испорчен.', 'Without the system nobody keeps track of the disk: two programs wrote into the same place, and the file is spoilt.')
        : bi('Посредник вернулся: программы снова просят систему, и та раздаёт место без столкновений.', 'The go-between is back: programs ask the system again, and it hands out room without collisions.');
    }
    if (change.id === 'programs') return fmt(bi('{a} → {b} программ: каждой достаётся {s}% процессора. Медленнее, но работают все.', '{a} → {b} programs: each gets {s}% of the processor. Slower, but they all run.'), { a: a.programs as number, b: b.programs as number, s: m.share ?? 0 });
    return fmt(bi('Ядер стало {c}: одновременно работают до {c} программ, у каждой {s}% процессора.', 'There are now {c} cores: up to {c} programs run at the same moment, each with {s}% of the processor.'), { c: b.cores as string, s: m.share ?? 0 });
  },
});
