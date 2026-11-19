// What happens when you start a program: disk → memory → processor → screen,
// and why unsaved work disappears when the power goes (01 §9.2, F01–F02).

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';

type P = { size: number; disk: string; open: number };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
const RAM_GB = 8;
const PER_PROGRAM_GB = 0.9;
const SPEED = { hdd: 150, ssd: 2000 } as Record<string, number>; // MB per second, sequential read

export interface RunNumbers {
  /** Milliseconds from the click to the window. */
  ms: number;
  /** Memory in use after the start, GB. */
  used: number;
  /** Memory ran out: the system moves pages to the disk and everything slows down. */
  swap: boolean;
}

export function runNumbers(p: P): RunNumbers {
  const used = Math.round((p.open * PER_PROGRAM_GB + p.size / 1024) * 10) / 10;
  const swap = used > RAM_GB;
  const read = (p.size / (SPEED[p.disk] ?? SPEED.ssd)) * 1000;
  const ms = Math.round((read + 40) * (swap ? 4 : 1));
  return { ms, used: Math.min(used, RAM_GB), swap };
}

const gb = (x: number) => `${x.toFixed(1)} / ${RAM_GB} GB`;

export const runModel = defineModel<P>({
  id: 'orient.run',
  block: 'orient',
  title: bi('Что происходит, когда вы запускаете программу', 'What happens when you start a program'),
  summary: bi(
    'Программа лежит на диске, работает из памяти, а выполняет её процессор. Поменяйте размер программы и тип диска, откройте лишние программы, выключите питание.',
    'A program lives on the disk, works from memory and is carried out by the processor. Change the size of the program and the type of disk, open too many programs, cut the power.',
  ),
  concepts: ['orient.computer', 'orient.program'],
  diagram: {
    width: 960,
    height: 368,
    nodes: [
      {
        id: 'you',
        label: bi('Вы', 'You'),
        sub: 'mouse, keyboard',
        family: 'user',
        x: 24,
        y: 40,
        w: 168,
        h: 56,
        card: card(bi('Вы говорите с компьютером мышью и клавиатурой. Каждый щелчок и каждая буква становятся сигналом, который получает процессор.', 'You talk to the computer with the mouse and keyboard. Every click and every letter becomes a signal the processor receives.'), bi('Человек за компьютером.', 'The person at the computer.')),
      },
      {
        id: 'cpu',
        label: bi('Процессор', 'Processor'),
        sub: '3 GHz',
        family: 'process',
        x: 384,
        y: 40,
        w: 208,
        h: 56,
        card: card(bi('Выполняет инструкции: сложить два числа, сравнить, перейти к другой инструкции. Делает это миллиарды раз в секунду, но работает только с тем, что лежит в памяти.', 'Carries out instructions: add two numbers, compare, jump to another instruction. It does so billions of times a second, but works only with what lies in memory.'), bi('Микросхема на главной плате компьютера; в ноутбуке её не видно под системой охлаждения.', 'A chip on the main board of the computer; in a laptop it hides under the cooling system.'), { see: 'nproc', doc: { page: 'man/nproc.1', anchor: 'DESCRIPTION' } }),
      },
      {
        id: 'screen',
        label: bi('Экран', 'Screen'),
        family: 'user',
        x: 776,
        y: 40,
        w: 160,
        h: 56,
        card: card(bi('Показывает картинку, которую программа нарисовала в памяти. Сам экран ничего не хранит.', 'Shows the picture the program drew in memory. The screen itself keeps nothing.'), bi('Монитор или экран ноутбука.', 'A monitor or the laptop’s screen.')),
      },
      {
        id: 'disk',
        label: bi('Диск', 'Disk'),
        sub: 'notes · 300 MB',
        family: 'store',
        x: 24,
        y: 200,
        w: 200,
        h: 72,
        card: card(bi('Долговременное хранилище: программы и ваши документы лежат здесь и переживают выключение. Медленнее памяти в десятки и сотни раз.', 'Long-term storage: programs and your documents live here and survive a power-off. Tens to hundreds of times slower than memory.'), bi('Жёсткий диск (HDD) с вращающимися пластинами или твердотельный (SSD) из микросхем.', 'A hard disk (HDD) with spinning platters or a solid-state one (SSD) made of chips.'), { see: 'df -h', doc: { page: 'man/df.1', anchor: 'DESCRIPTION' } }),
      },
      {
        id: 'memory',
        label: bi('Память', 'Memory'),
        sub: gb(1.8),
        family: 'gauge',
        shape: 'buffer',
        x: 384,
        y: 200,
        w: 208,
        h: 72,
        card: card(bi('Оперативная память: быстрая, но забывает всё при выключении. Здесь лежат запущенные программы и то, с чем они работают прямо сейчас, — в том числе ваш несохранённый текст.', 'Main memory: fast, but it forgets everything at power-off. Running programs live here together with what they are working on right now, including your unsaved text.'), bi('Планки памяти на главной плате.', 'Memory modules on the main board.'), { see: 'free -h', doc: { page: 'man/free.1', anchor: 'DESCRIPTION' } }),
      },
    ],
    edges: [
      { id: 'e-input', from: 'you', to: 'cpu', label: bi('щелчок, буквы', 'clicks, letters'), card: card(bi('Каждое действие мыши и клавиатуры — сигнал процессору: «случилось вот это».', 'Every action of the mouse and keyboard is a signal to the processor: “this has happened”.'), bi('Мышь и клавиатура.', 'The mouse and keyboard.')) },
      { id: 'e-load', from: 'disk', to: 'memory', label: bi('копия программы', 'copy of the program'), card: card(bi('Запуск начинается с копирования: программу читают с диска и кладут в память. Чем больше программа и медленнее диск, тем дольше вы ждёте окно.', 'Starting begins with copying: the program is read from the disk and put into memory. The bigger the program and the slower the disk, the longer you wait for the window.'), bi('Главная программа компьютера, о ней следующий урок.', 'The main program of the computer; the next lesson is about it.')) },
      { id: 'e-fetch', from: 'memory', to: 'cpu', label: bi('инструкции', 'instructions'), card: card(bi('Процессор берёт из памяти очередную инструкцию, выполняет её, берёт следующую. Данные идут тем же путём.', 'The processor takes the next instruction from memory, carries it out, takes the next one. Data travels the same way.'), bi('Процессор.', 'The processor.')) },
      { id: 'e-draw', from: 'cpu', to: 'screen', label: bi('картинка', 'picture'), card: card(bi('Программа рисует окно в памяти, и видеокарта шестьдесят раз в секунду показывает его на экране.', 'The program draws its window in memory, and the graphics card shows it on the screen sixty times a second.'), bi('Видеокарта.', 'The graphics card.')) },
      {
        id: 'e-save',
        from: 'memory',
        to: 'disk',
        via: [
          [488, 328],
          [124, 328],
        ],
        label: bi('сохранить', 'save'),
        card: card(bi('Кнопка «Сохранить» копирует текст из памяти на диск. До этого момента он существует только в памяти.', 'The “Save” button copies the text from memory to the disk. Until then it exists only in memory.'), bi('Программа, по вашей команде.', 'The program, on your command.')),
      },
    ],
  },
  params: [
    {
      id: 'size',
      label: bi('Размер программы', 'Size of the program'),
      kind: 'range',
      min: 10,
      max: 4000,
      step: 10,
      unit: 'MB',
      default: 300,
      near: 'disk',
      predict: {
        prompt: bi('Программа стала в десять раз больше. Что будет с запуском?', 'The program is now ten times bigger. What happens to the start?'),
        options: [
          { id: 'slower', text: bi('Окно появится позже: копировать дольше', 'The window appears later: copying takes longer') },
          { id: 'same', text: bi('Ничего: процессор быстрый', 'Nothing: the processor is fast') },
        ],
        resolve: (prev, next) => ((next[next.length - 1]?.metrics?.ms ?? 0) > (prev[prev.length - 1]?.metrics?.ms ?? 0) ? 'slower' : 'same'),
      },
    },
    {
      id: 'disk',
      label: bi('Тип диска', 'Type of disk'),
      kind: 'choice',
      default: 'ssd',
      near: 'disk',
      options: [
        { id: 'ssd', label: bi('SSD', 'SSD') },
        { id: 'hdd', label: bi('HDD', 'HDD') },
      ],
    },
    {
      id: 'open',
      label: bi('Сколько программ уже открыто', 'Programs already open'),
      kind: 'range',
      min: 0,
      max: 12,
      step: 1,
      default: 2,
      near: 'memory',
      predict: {
        prompt: bi('Откроем ещё десяток программ. Что станет с нашей?', 'Let us open a dozen more programs. What happens to ours?'),
        options: [
          { id: 'slow', text: bi('Запустится, но всё начнёт тормозить', 'It starts, but everything slows down') },
          { id: 'same', text: bi('Ничего не изменится', 'Nothing changes') },
        ],
        resolve: (_prev, next) => (next.some((s) => s.states?.memory === 'warn') ? 'slow' : 'same'),
      },
    },
  ],
  breaks: [
    {
      id: 'power',
      label: bi('Выключить питание до «Сохранить»', 'Cut the power before “Save”'),
      remove: ['memory', 'e-save'],
      boundary: 'storage',
      predict: {
        prompt: bi('Вы напечатали письмо и не сохранили его. Свет погас. Что останется после включения?', 'You typed a letter and did not save it. The power went. What is left after switching on?'),
        options: [
          { id: 'all', text: bi('Всё: и программа, и письмо', 'Everything: the program and the letter') },
          { id: 'disk', text: bi('Программа на месте, письма нет', 'The program is there, the letter is gone') },
          { id: 'nothing', text: bi('Ничего: пропадёт и программа', 'Nothing: the program is gone too') },
        ],
        resolve: () => 'disk',
      },
    },
    {
      id: 'no-disk',
      label: bi('Программу удалили с диска', 'The program was deleted from the disk'),
      remove: ['disk', 'e-load'],
      boundary: 'storage',
      predict: {
        prompt: bi('Значок на рабочем столе остался, а сама программа с диска удалена. Что будет при щелчке?', 'The icon on the desktop is still there, but the program itself was deleted from the disk. What happens on a click?'),
        options: [
          { id: 'error', text: bi('Ошибка: копировать в память нечего', 'An error: there is nothing to copy into memory') },
          { id: 'runs', text: bi('Запустится: значок и есть программа', 'It starts: the icon is the program') },
        ],
        resolve: (_prev, next) => (next.some((s) => s.broken) ? 'error' : 'runs'),
      },
    },
  ],
  metrics: [
    { id: 'ms', label: bi('от щелчка до окна', 'from click to window'), unit: 'ms' },
    { id: 'used', label: bi('занято памяти', 'memory in use'), unit: 'GB' },
  ],
  run(p, broken): Step[] {
    const n = runNumbers(p);
    const before = Math.min(p.open * PER_PROGRAM_GB, RAM_GB);
    const steps: Step[] = [
      {
        id: 'click',
        label: bi('щелчок', 'click'),
        caption: bi('Вы дважды щёлкаете по значку «Заметки». Значок — только ярлык: сама программа лежит на диске.', 'You double-click the “Notes” icon. The icon is only a shortcut: the program itself lies on the disk.'),
        focus: ['you', 'e-input', 'cpu'],
        tokens: [{ edge: 'e-input', label: '2×click' }],
        states: { you: 'on', cpu: 'on' },
        values: { disk: `notes · ${p.size} MB`, memory: gb(before) },
        fill: { memory: before / RAM_GB },
        metrics: { ms: 0, used: Math.round(before * 10) / 10 },
      },
    ];
    if (broken.has('no-disk')) {
      steps.push({
        id: 'missing',
        label: bi('не найдено', 'not found'),
        caption: bi('Копировать в память нечего: файла программы на диске больше нет. Значок указывает в пустоту.', 'There is nothing to copy into memory: the program file is no longer on the disk. The icon points at nothing.'),
        focus: ['disk', 'e-load'],
        states: { disk: 'err', 'e-load': 'err' },
        metrics: { ms: 5, used: Math.round(before * 10) / 10 },
        broken: { at: 'disk', message: 'The item “Notes” can’t be found.', caption: bi('ярлык — не программа: без файла на диске запускать нечего.', 'a shortcut is not the program: without the file on the disk there is nothing to start.') },
      });
      return steps;
    }
    steps.push(
      {
        id: 'load',
        label: bi('копия в память', 'copy to memory'),
        caption: n.swap
          ? fmt(bi('Программа копируется с диска в память, но память уже почти занята: системе приходится выгружать на диск куски других программ. Запуск — {ms} мс вместо обычных.', 'The program is copied from the disk into memory, but memory is almost full: the system has to push pieces of other programs out to the disk. The start takes {ms} ms instead of the usual.'), { ms: n.ms })
          : fmt(bi('Программа на {s} МБ копируется с диска в память. С {d} это занимает около {ms} мс.', 'The {s} MB program is copied from the disk into memory. From an {d} this takes about {ms} ms.'), { s: p.size, d: p.disk === 'hdd' ? 'HDD' : 'SSD', ms: n.ms }),
        focus: ['disk', 'e-load', 'memory'],
        tokens: [{ edge: 'e-load', label: `${p.size} MB` }],
        states: { memory: n.swap ? 'warn' : 'on', disk: 'on' },
        values: { memory: gb(n.used) },
        fill: { memory: n.used / RAM_GB },
        metrics: { ms: n.ms, used: n.used },
      },
      {
        id: 'execute',
        label: bi('выполнение', 'execution'),
        caption: bi('Процессор берёт из памяти инструкции программы одну за другой и выполняет их — миллиарды в секунду.', 'The processor takes the program’s instructions from memory one after another and carries them out, billions a second.'),
        focus: ['memory', 'e-fetch', 'cpu'],
        tokens: [{ edge: 'e-fetch', label: 'add, compare, jump' }],
        states: { cpu: 'on' },
        metrics: { ms: n.ms, used: n.used },
      },
      {
        id: 'window',
        label: bi('окно', 'window'),
        caption: bi('Программа нарисовала своё окно, и оно появилось на экране. Для вас запуск закончился.', 'The program has drawn its window, and it appears on the screen. For you the start is over.'),
        focus: ['e-draw', 'screen'],
        tokens: [{ edge: 'e-draw' }],
        states: { screen: 'on' },
        metrics: { ms: n.ms + 16, used: n.used },
      },
      {
        id: 'type',
        label: bi('печатаете', 'typing'),
        caption: bi('Вы печатаете письмо. Буквы попадают в память программы — и только туда.', 'You type a letter. The letters go into the program’s memory, and only there.'),
        focus: ['you', 'e-input', 'memory'],
        tokens: [{ edge: 'e-input', label: 'Dear…' }],
        values: { memory: gb(n.used) + ' · letter' },
        metrics: { ms: n.ms + 16, used: n.used },
      },
    );
    if (broken.has('power')) {
      steps.push({
        id: 'blackout',
        label: bi('свет погас', 'power cut'),
        caption: bi('Питание пропало. Память обнулилась вместе с письмом; диск ничего не заметил — программа на нём цела.', 'The power is gone. Memory is wiped together with the letter; the disk noticed nothing: the program on it is intact.'),
        focus: ['memory', 'disk'],
        states: { memory: 'err', cpu: 'off', screen: 'off', disk: 'ok' },
        values: { memory: gb(0) },
        fill: { memory: 0 },
        metrics: { ms: n.ms + 16, used: 0 },
        broken: { at: 'memory', message: 'Notes quit unexpectedly. Unsaved changes are lost.', caption: bi('память живёт, пока есть питание; переживает выключение только то, что сохранено на диск.', 'memory lives only while there is power; only what was saved to the disk survives a power-off.') },
      });
      return steps;
    }
    steps.push({
      id: 'save',
      label: bi('сохранить', 'save'),
      caption: bi('Вы нажимаете «Сохранить»: письмо копируется из памяти на диск. Теперь его не страшно выключить.', 'You press “Save”: the letter is copied from memory to the disk. Now switching off is safe.'),
      focus: ['memory', 'e-save', 'disk'],
      tokens: [{ edge: 'e-save', label: 'letter.txt' }],
      states: { disk: 'ok' },
      values: { disk: `notes · ${p.size} MB · letter.txt` },
      metrics: { ms: n.ms + 16, used: n.used },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const ms = (s: Step[]) => s[s.length - 1]?.metrics?.ms ?? 0;
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: программа снова запускается и письмо сохраняется.', 'The break is removed: the program starts again and the letter is saved.');
      return change.id === 'power'
        ? bi('Без питания память пустеет за доли секунды: письмо было только там, поэтому пропало, а программа на диске уцелела.', 'Without power memory empties in a fraction of a second: the letter was only there, so it is lost, while the program on the disk survives.')
        : bi('Значок — ярлык, а программа — файл на диске. Удалили файл, и копировать в память стало нечего.', 'The icon is a shortcut and the program is a file on the disk. Delete the file and there is nothing to copy into memory.');
    }
    switch (change.id) {
      case 'size':
        return fmt(bi('{a} → {b} МБ: копировать с диска дольше, от щелчка до окна теперь {t} мс.', '{a} → {b} MB: copying from the disk takes longer; from click to window is now {t} ms.'), { a: a.size, b: b.size, t: ms(next) });
      case 'disk':
        return b.disk === 'hdd'
          ? fmt(bi('HDD читает около 150 МБ в секунду против 2000 у SSD: запуск {t0} → {t1} мс.', 'An HDD reads about 150 MB a second against 2000 for an SSD: the start goes {t0} → {t1} ms.'), { t0: ms(prev), t1: ms(next) })
          : fmt(bi('SSD читает в десяток раз быстрее HDD: запуск {t0} → {t1} мс.', 'An SSD reads about ten times faster than an HDD: the start goes {t0} → {t1} ms.'), { t0: ms(prev), t1: ms(next) });
      case 'open': {
        const swap = next.some((s) => s.states?.memory === 'warn');
        return swap
          ? fmt(bi('{n} открытых программ не помещаются в {r} ГБ: система выгружает их куски на диск, и запуск растягивается до {t} мс.', '{n} open programs do not fit into {r} GB: the system pushes pieces of them out to the disk, and the start stretches to {t} ms.'), { n: b.open as number, r: RAM_GB, t: ms(next) })
          : fmt(bi('Открыто {n} программ: памяти ещё хватает, на скорость запуска это не влияет.', '{n} programs open: there is still enough memory, the start is not affected.'), { n: b.open as number });
      }
    }
    return bi('Процесс пересчитан.', 'The process is recomputed.');
  },
});
