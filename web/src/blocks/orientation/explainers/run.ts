// What happens when you start a program: disk → memory → processor → screen,
// and why unsaved work disappears when the power goes (01 §9.2, F01–F02).
//
// Reading order: the picture is built from zero. At the start there are only
// you and the disk with the program on it; memory, the processor and the
// screen appear when the start reaches them. Every acting part says in a
// callout what it does now, and what it hands on travels along the line as a
// card. The word "operating system" is not used: the next lesson introduces it.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { card, compare, fmtb, lastMetric, ruNum, startWith } from './kit';

type P = { size: number; disk: string; open: number };

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
const ALL = ['you', 'cpu', 'screen', 'disk', 'memory', 'e-input', 'e-load', 'e-fetch', 'e-draw', 'e-save'];
const DISK_NAME: Record<string, Bi> = { ssd: bi('быстрый диск SSD', 'a fast SSD'), hdd: bi('старый вращающийся диск HDD', 'an old spinning HDD') };

export const runModel = defineModel<P>({
  id: 'orient.run',
  block: 'orient',
  title: bi('Что происходит, когда вы запускаете программу', 'What happens when you start a program'),
  summary: bi(
    'Вы дважды щёлкаете по значку программы «Заметки». Программа лежит на диске, поэтому её сначала копируют в память, потом процессор выполняет её инструкции, и на экране появляется окно. Письмо, которое вы напечатаете в этом окне, хранится только в памяти, пока вы не нажмёте «Сохранить».',
    'You double-click the icon of the “Notes” program. The program lies on the disk, so it is first copied into memory, then the processor carries out its instructions and a window appears. The letter you type in that window lives only in memory until you press “Save”.',
  ),
  intro: bi(
    'Схема соберётся у вас на глазах: сейчас на ней только вы и диск, на котором лежит программа. Нажмите «Начать: шаг вперёд», а дальше листайте кнопкой «Шаг вперёд» под схемой. На каждом шаге подсвечена та часть компьютера, которая работает, облачко рядом с ней говорит, что она делает, а карточка на линии показывает, что передаётся дальше.\n\nКогда дойдёте до сохранения письма, откройте «Параметры», сделайте программу больше или поставьте медленный диск и пройдите запуск ещё раз, следя за временем под схемой.',
    'The diagram builds itself as you go: now it shows only you and the disk the program lies on. Press “Start: step forward”, then go on with “Step forward” under the diagram. At every step the part that works is highlighted, the callout next to it says what it does, and the card on the line shows what is handed on.\n\nOnce you reach the save, open “Parameters”, make the program bigger or choose a slow disk and walk through the start again, watching the time under the diagram.',
  ),
  legend: [
    { mark: 'active', text: bi('часть компьютера, которая работает сейчас', 'the part working now') },
    { mark: 'say', text: bi('что эта часть делает', 'what that part does') },
    { mark: 'token', text: bi('что передаётся дальше: копия программы, инструкции, буквы, файл', 'what is handed on: the program, instructions, letters, a file') },
    { mark: 'icon:user', text: bi('вы за компьютером', 'you at the computer') },
    { mark: 'icon:disk', text: bi('диск хранит файлы и после выключения', 'the disk: keeps files after power-off') },
    { mark: 'icon:switch', text: bi('память работает быстро, но пустеет без питания', 'memory: fast, but empty without power') },
    { mark: 'icon:process', text: bi('процессор выполняет инструкции', 'the processor: carries out instructions') },
    { mark: 'icon:browser', text: bi('экран с окном программы', 'the screen with the program’s window') },
    { mark: 'warn', text: bi('памяти не хватает, всё замедляется', 'memory runs short, everything slows down') },
    { mark: 'err', text: bi('здесь запуск или письмо пропали', 'here the start or the letter was lost') },
  ],
  stopLabel: bi('Работа остановилась', 'The work stopped'),
  concepts: ['orient.computer', 'orient.program'],
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      {
        id: 'you',
        label: bi('Вы', 'You'),
        icon: 'user',
        work: 'dots',
        family: 'user',
        x: 24,
        y: 56,
        w: 200,
        h: 64,
        card: card(
          bi('Вы сидите за компьютером, и каждый ваш щелчок мышью и каждая нажатая клавиша превращаются в сигнал, который получает процессор.', 'The person at the computer. Every click and every key press becomes a signal the processor receives.'),
          bi('Мышь и клавиатуру подключают к компьютеру проводом или по радио.', 'The mouse and keyboard are connected by wire or radio.'),
        ),
      },
      {
        id: 'cpu',
        label: bi('Процессор', 'Processor'),
        icon: 'process',
        sub: '3 GHz',
        family: 'process',
        x: 380,
        y: 56,
        w: 208,
        h: 64,
        card: card(
          bi('Процессор выполняет инструкции: складывает два числа, сравнивает их, переходит к другой инструкции. Он делает это миллиарды раз в секунду, но берёт инструкции и данные только из памяти, а с диском напрямую не работает.', 'Carries out instructions: add two numbers, compare, jump to another instruction. It does so billions of times a second, but takes instructions and data only from memory.'),
          bi('Процессор — это микросхема на главной плате компьютера. В ноутбуке её не видно под системой охлаждения.', 'A chip on the main board; in a laptop it hides under the cooling system.'),
          { see: 'nproc', doc: { page: 'man/nproc.1', anchor: 'DESCRIPTION' } },
        ),
      },
      {
        id: 'screen',
        label: bi('Экран', 'Screen'),
        icon: 'browser',
        family: 'user',
        x: 744,
        y: 56,
        w: 192,
        h: 64,
        card: card(
          bi('Экран показывает картинку, которую программа нарисовала в памяти. Сам экран ничего не хранит: стоит выключить компьютер, и картинка исчезнет.', 'Shows the picture the program drew in memory. The screen itself keeps nothing.'),
          bi('Картинку на экран шестьдесят раз в секунду выводит видеокарта.', 'The graphics card puts it on the screen sixty times a second.'),
        ),
      },
      {
        id: 'disk',
        label: bi('Диск', 'Disk'),
        icon: 'disk',
        sub: 'notes · 300 MB',
        family: 'store',
        x: 24,
        y: 224,
        w: 200,
        h: 72,
        card: card(
          bi('Диск хранит программы и документы долго, годами, и не забывает их при выключении. Зато он в десятки и сотни раз медленнее памяти, поэтому процессор с ним напрямую не работает.', 'Long-term storage: programs and documents survive a power-off here. Tens to hundreds of times slower than memory.'),
          bi('Диски бывают двух видов: старые жёсткие (HDD) с вращающимися пластинами и новые твердотельные (SSD), собранные из микросхем.', 'A hard disk (HDD) with spinning platters or a solid-state one (SSD) made of chips.'),
          { see: 'df -h', doc: { page: 'man/df.1', anchor: 'DESCRIPTION' } },
        ),
      },
      {
        id: 'memory',
        label: bi('Память', 'Memory'),
        icon: 'switch',
        sub: gb(1.8),
        family: 'gauge',
        shape: 'buffer',
        x: 380,
        y: 224,
        w: 208,
        h: 72,
        card: card(
          bi('Оперативная память работает быстро, но всё, что в ней хранится, пропадает, когда компьютер выключают. Здесь находятся запущенные программы и то, с чем они работают прямо сейчас, в том числе ваш несохранённый текст. Полоска внизу показывает, сколько памяти занято.', 'Main memory is fast, but everything in it is lost at power-off. Running programs live here with what they work on now, including your unsaved text. The bar shows how much is in use.'),
          bi('Память — это планки с микросхемами на главной плате компьютера.', 'Memory modules on the main board.'),
          { see: 'free -h', doc: { page: 'man/free.1', anchor: 'DESCRIPTION' } },
        ),
      },
    ],
    edges: [
      { id: 'e-input', from: 'you', to: 'cpu', label: bi('щелчки и буквы', 'clicks and letters'), card: card(bi('Каждое действие мышью и каждая нажатая клавиша приходят процессору сигналом: «нажата буква Д».', 'Every mouse action and key press reaches the processor as a signal.'), bi('Сигналы посылают мышь и клавиатура.', 'The mouse and keyboard.')) },
      { id: 'e-load', from: 'disk', to: 'memory', label: bi('копия программы', 'copy of the program'), card: card(bi('Запуск начинается с копирования: файл программы читают с диска и кладут в память. Чем больше программа и чем медленнее диск, тем дольше вы ждёте окно.', 'Starting begins with copying: the program is read from the disk into memory. The bigger the program and the slower the disk, the longer you wait.'), bi('Копированием занимается главная программа компьютера, о которой рассказывает следующий урок.', 'The main program of the computer; the next lesson is about it.')) },
      { id: 'e-fetch', from: 'memory', to: 'cpu', label: bi('инструкции и данные', 'instructions and data'), card: card(bi('Процессор берёт из памяти очередную инструкцию, выполняет её и берёт следующую. Данные, например буквы вашего письма, ходят между процессором и памятью тем же путём.', 'The processor takes the next instruction from memory, carries it out, takes the next one. Data travels the same way.'), bi('Инструкции забирает процессор.', 'The processor.')) },
      { id: 'e-draw', from: 'cpu', to: 'screen', label: bi('картинка окна', 'the window’s picture'), card: card(bi('Программа рисует своё окно, и видеокарта показывает его на экране.', 'The program draws its window, and the graphics card shows it on the screen.'), bi('Картинку выводит видеокарта.', 'The graphics card.')) },
      {
        id: 'e-save',
        from: 'memory',
        to: 'disk',
        via: [
          [484, 360],
          [124, 360],
        ],
        labelAt: 0.5,
        label: bi('сохранить на диск', 'save to the disk'),
        card: card(bi('Кнопка «Сохранить» копирует текст из памяти в файл на диске. До этого момента текст существует только в памяти.', 'The “Save” button copies the text from memory into a file on the disk. Until then it exists only in memory.'), bi('Текст сохраняет сама программа, когда вы нажимаете кнопку «Сохранить».', 'The program, on your command.')),
      },
    ],
  },
  params: [
    {
      id: 'size',
      label: bi('Размер файла программы на диске', 'Size of the program file'),
      group: bi('Программа и диск', 'The program and the disk'),
      kind: 'range',
      min: 10,
      max: 4000,
      step: 10,
      unit: 'MB',
      default: 300,
      near: 'disk',
      predict: {
        prompt: bi('Вы изменили размер программы, а диск и число открытых программ остались прежними. Как изменится время от щелчка до появления окна?', 'You changed the program’s size; the disk and the open programs stay the same. How does the time from click to window change?'),
        options: [
          { id: 'up', text: bi('Вырастет', 'It grows') },
          { id: 'down', text: bi('Сократится', 'It shrinks') },
          { id: 'same', text: bi('Не изменится', 'It stays the same') },
        ],
        resolve: (prev, next) => compare(lastMetric(prev, 'ms'), lastMetric(next, 'ms')),
      },
    },
    {
      id: 'disk',
      label: bi('Какой диск стоит в компьютере', 'Which disk the computer has'),
      group: bi('Программа и диск', 'The program and the disk'),
      kind: 'choice',
      default: 'ssd',
      near: 'disk',
      options: [
        { id: 'ssd', label: bi('SSD, читает около 2000 МБ в секунду', 'SSD, about 2000 MB a second') },
        { id: 'hdd', label: bi('HDD, читает около 150 МБ в секунду', 'HDD, about 150 MB a second') },
      ],
    },
    {
      id: 'open',
      label: bi('Сколько других программ уже открыто', 'Other programs already open'),
      group: bi('Что уже занимает память', 'What already takes memory'),
      kind: 'range',
      min: 0,
      max: 12,
      step: 1,
      default: 2,
      near: 'memory',
      predict: {
        prompt: bi('Вы изменили число открытых программ, а сама программа «Заметки» и диск остались прежними. Как изменится время её запуска?', 'You changed the number of open programs; “Notes” and the disk stay the same. How does its start time change?'),
        options: [
          { id: 'up', text: bi('Вырастет', 'It grows') },
          { id: 'down', text: bi('Сократится', 'It shrinks') },
          { id: 'same', text: bi('Не изменится', 'It stays the same') },
        ],
        resolve: (prev, next) => compare(lastMetric(prev, 'ms'), lastMetric(next, 'ms')),
      },
    },
  ],
  breaks: [
    {
      id: 'power',
      label: bi('Отключить питание, пока письмо не сохранено', 'Cut the power before “Save”'),
      remove: ['memory', 'e-save'],
      boundary: 'storage',
      predict: {
        prompt: bi('Вы напечатали письмо, но не нажали «Сохранить», и в этот момент отключилось питание. Что вы найдёте, когда снова включите компьютер?', 'You typed a letter but did not press “Save”, and the power went. What will you find after switching on?'),
        options: [
          { id: 'all', text: bi('И программу, и письмо', 'Both the program and the letter') },
          { id: 'disk', text: bi('Программу, но не письмо', 'The program, but not the letter') },
          { id: 'nothing', text: bi('Ни программы, ни письма', 'Neither the program nor the letter') },
        ],
        resolve: () => 'disk',
      },
    },
    {
      id: 'no-disk',
      label: bi('Удалить файл программы с диска, оставив значок', 'Delete the program file, keep the icon'),
      remove: ['disk', 'e-load'],
      boundary: 'storage',
      predict: {
        prompt: bi('Значок «Заметок» на рабочем столе остался, а файл программы с диска удалили. Что произойдёт, когда вы дважды щёлкнете по значку?', 'The icon is still there, but the program file was deleted. What happens on a double click?'),
        options: [
          { id: 'error', text: bi('Появится ошибка: копировать в память нечего', 'An error: there is nothing to copy into memory') },
          { id: 'runs', text: bi('Программа запустится: значок и есть программа', 'It starts: the icon is the program') },
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
    const before = Math.round(Math.min(p.open * PER_PROGRAM_GB, RAM_GB) * 10) / 10;
    const disk = DISK_NAME[p.disk] ?? DISK_NAME.ssd;
    const steps: Step[] = [
      {
        id: 'click',
        label: bi('щелчок', 'click'),
        caption: fmtb(
          bi(
            'Вы дважды щёлкаете по значку «Заметки». Значок только указывает, где лежит программа, а сама программа хранится на диске в файле размером {s} МБ. Пока её не запустили, это такие же данные, как фотография.',
            'You double-click the “Notes” icon. The icon only points to where the program lies; the program itself is a {s} MB file on the disk. Until it is started, it is data like a photo.',
          ),
          { s: p.size },
        ),
        focus: ['you'],
        say: { you: bi('Вы дважды щёлкаете по значку программы «Заметки».', 'You double-click the “Notes” icon.') },
        states: { ...startWith(ALL, 'you', 'disk'), you: 'on' },
        values: { disk: `notes · ${p.size} MB`, memory: gb(before) },
        fill: { memory: before / RAM_GB },
        metrics: { ms: 0, used: before },
      },
    ];
    if (broken.has('no-disk')) {
      steps.push({
        id: 'missing',
        label: bi('файла нет', 'no file'),
        caption: bi('Компьютер идёт на диск за файлом программы и не находит его: файл удалили, а значок остался. Копировать в память нечего, поэтому программа не запустится, сколько бы вы ни щёлкали.', 'The computer goes to the disk for the program file and does not find it. There is nothing to copy into memory, so the program will not start.'),
        focus: ['disk'],
        say: { disk: bi('Файла «Заметок» на диске больше нет, и копировать в память нечего.', 'The “Notes” file is gone; there is nothing to copy.') },
        states: { disk: 'err' },
        values: { disk: 'notes · ?' },
        metrics: { ms: 5, used: before },
        broken: { at: 'disk', message: 'The item “Notes” can’t be found.', caption: bi('на диске. Значок — это ярлык, а не программа: без файла на диске запускать нечего.', 'on the disk: a shortcut is not the program; without the file there is nothing to start.') },
      });
      return steps;
    }
    steps.push(
      {
        id: 'load',
        label: bi('копия в память', 'copy to memory'),
        caption: n.swap
          ? fmtb(
              bi(
                'Программу копируют с диска в память, но память уже почти занята другими программами. Компьютеру приходится выгружать их части обратно на диск, чтобы освободить место, и запуск растягивается до {ms} мс.',
                'The program is copied into memory, but memory is almost full: pieces of other programs have to be pushed out to the disk, and the start stretches to {ms} ms.',
              ),
              { ms: n.ms },
            )
          : fmtb(
              bi(
                'Процессор не умеет выполнять программу с диска напрямую, поэтому её сначала копируют в память. Файл весит {s} МБ, и {d} читает его примерно за {ms} мс.',
                'The processor cannot run a program from the disk, so it is first copied into memory. The file is {s} MB, and {d} reads it in about {ms} ms.',
              ),
              { s: p.size, d: disk, ms: n.ms },
            ),
        focus: ['e-load', 'memory'],
        reveal: ['memory', 'e-load'],
        tokens: [{ edge: 'e-load', label: bi(`Заметки · ${p.size} МБ`, `Notes · ${p.size} MB`) }],
        say: {
          memory: n.swap
            ? bi('Память переполнена: части других программ уходят обратно на диск.', 'Memory is full: pieces of other programs go back to the disk.')
            : fmtb(bi('В память легла копия «Заметок». Теперь занято {u} из {r} ГБ.', 'A copy of “Notes” is in memory: {u} of {r} GB used.'), { u: ruNum(n.used), r: RAM_GB }),
        },
        states: { memory: n.swap ? 'warn' : 'on', disk: 'on' },
        values: { memory: gb(n.used) },
        fill: { memory: n.used / RAM_GB },
        metrics: { ms: n.ms, used: n.used },
      },
      {
        id: 'execute',
        label: bi('выполнение', 'execution'),
        caption: bi('Теперь процессор берёт из памяти инструкции программы одну за другой и выполняет их, миллиарды в секунду. Программа начинает работать.', 'Now the processor takes the program’s instructions from memory one after another and carries them out, billions a second.'),
        focus: ['e-fetch', 'cpu'],
        reveal: ['cpu', 'e-fetch'],
        tokens: [{ edge: 'e-fetch', label: bi('инструкции', 'instructions') }],
        say: { cpu: bi('Процессор выполняет инструкции «Заметок» одну за другой.', 'The processor carries out the instructions of “Notes”.') },
        states: { cpu: 'on' },
        metrics: { ms: n.ms, used: n.used },
      },
      {
        id: 'window',
        label: bi('окно', 'window'),
        caption: fmtb(bi('Программа нарисовала своё окно, и оно появилось на экране. Для вас запуск закончился: от щелчка до окна прошло {t} мс.', 'The program has drawn its window, and it appears on the screen. For you the start is over: {t} ms from click to window.'), { t: n.ms + 16 }),
        focus: ['e-draw', 'screen'],
        reveal: ['screen', 'e-draw'],
        tokens: [{ edge: 'e-draw', label: bi('окно «Заметки»', 'the “Notes” window') }],
        say: { screen: bi('На экране появилось окно «Заметок», и в нём можно печатать.', 'The “Notes” window is on the screen.') },
        states: { screen: 'on' },
        metrics: { ms: n.ms + 16, used: n.used },
      },
      {
        id: 'type',
        label: bi('набор письма', 'typing'),
        caption: bi('Вы печатаете письмо. Каждая нажатая клавиша приходит процессору сигналом, и программа добавляет букву к тексту.', 'You type a letter. Every key press reaches the processor as a signal, and the program adds the letter to the text.'),
        focus: ['e-input', 'cpu'],
        reveal: ['e-input'],
        tokens: [{ edge: 'e-input', label: bi('«Дорогая Анна…»', '“Dear Anna…”') }],
        say: { cpu: bi('Процессор получает от клавиатуры каждую букву письма.', 'The processor gets every letter from the keyboard.') },
        metrics: { ms: n.ms + 16, used: n.used },
      },
      {
        id: 'keep',
        label: bi('письмо в памяти', 'letter in memory'),
        caption: bi('Программа кладёт текст письма в свою часть памяти, и только туда. На диске письма пока нет, поэтому до нажатия «Сохранить» оно существует, лишь пока у компьютера есть питание.', 'The program keeps the letter in its part of memory, and only there. The disk does not have it yet.'),
        focus: ['e-fetch', 'memory'],
        tokens: [{ edge: 'e-fetch', label: bi('письмо', 'letter'), reverse: true }],
        say: { memory: bi('Текст письма хранится только в памяти, на диске его пока нет.', 'The letter lives only in memory for now.') },
        values: { memory: `${gb(n.used)} · letter` },
        metrics: { ms: n.ms + 16, used: n.used },
      },
    );
    if (broken.has('power')) {
      steps.push({
        id: 'blackout',
        label: bi('свет погас', 'power cut'),
        caption: bi('Питание пропало, и память за доли секунды опустела вместе с письмом. Диск ничего не заметил: файл программы на нём цел, поэтому после включения «Заметки» запустятся, но письма в них не будет.', 'The power is gone and memory empties in a fraction of a second, letter and all. The disk noticed nothing: the program is intact, the letter is not.'),
        focus: ['memory'],
        say: { memory: bi('Питание пропало, и память стёрла всё, что в ней было, вместе с письмом.', 'No power: memory loses everything, the letter included.') },
        states: { memory: 'err', cpu: 'off', screen: 'off', disk: 'ok' },
        values: { memory: gb(0) },
        fill: { memory: 0 },
        metrics: { ms: n.ms + 16, used: 0 },
        broken: { at: 'memory', message: 'Notes quit unexpectedly. Unsaved changes are lost.', caption: bi('в памяти. Память хранит данные, только пока есть питание, а выключение переживает лишь то, что сохранено на диск.', 'in memory: it keeps data only while powered; only what was saved to the disk survives.') },
      });
      return steps;
    }
    steps.push({
      id: 'save',
      label: bi('сохранить', 'save'),
      caption: bi('Вы нажимаете «Сохранить», и программа копирует письмо из памяти в файл letter.txt на диске. Теперь компьютер можно выключить: письмо никуда не денется.', 'You press “Save”: the letter is copied from memory into letter.txt on the disk. Now switching off is safe.'),
      focus: ['e-save', 'disk'],
      reveal: ['e-save'],
      tokens: [{ edge: 'e-save', label: 'letter.txt' }],
      say: { disk: bi('Диск записывает письмо в файл letter.txt, и выключение ему больше не страшно.', 'The disk writes the letter into letter.txt.') },
      states: { disk: 'ok' },
      values: { disk: `notes · ${p.size} MB · letter.txt` },
      metrics: { ms: n.ms + 16, used: n.used },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const ms = (s: Step[]) => lastMetric(s, 'ms');
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали: программа снова запускается, и письмо сохраняется на диск.', 'The break is removed: the program starts again and the letter is saved.');
      return change.id === 'power'
        ? bi('Без питания память пустеет за доли секунды. Письмо хранилось только там и пропало, а программа лежала на диске и уцелела.', 'Without power memory empties: the letter was only there and is lost, while the program on the disk survives.')
        : bi('Значок — это ярлык, а программа — это файл на диске. Файл удалили, и копировать в память стало нечего.', 'The icon is a shortcut and the program is a file. Delete the file and there is nothing to copy.');
    }
    switch (change.id) {
      case 'size':
        return fmtb(bi('Размер программы изменился с {a} до {b} МБ. Копировать её с диска в память теперь нужно {d}, и от щелчка до окна проходит {t} мс.', '{a} → {b} MB: copying takes {d}; from click to window is now {t} ms.'), {
          a: a.size,
          b: b.size,
          d: b.size > a.size ? bi('дольше', 'longer') : bi('меньше времени', 'less time'),
          t: ms(next),
        });
      case 'disk':
        return fmtb(
          bi('Теперь в компьютере {d}. Файл программы читается с него {w}, и запуск длится не {t0}, а {t1} мс.', 'Now the computer has {d}: the start goes {t0} → {t1} ms.'),
          { d: DISK_NAME[b.disk] ?? DISK_NAME.ssd, w: b.disk === 'hdd' ? bi('примерно в тринадцать раз медленнее', 'about thirteen times slower') : bi('примерно в тринадцать раз быстрее', 'about thirteen times faster'), t0: ms(prev), t1: ms(next) },
        );
      case 'open': {
        const swap = next.some((s) => s.states?.memory === 'warn');
        return swap
          ? fmtb(bi('Открыто {n} других программ, и вместе с «Заметками» они не помещаются в {r} ГБ памяти. Компьютер выгружает их части на диск, поэтому запуск растягивается до {t} мс.', '{n} open programs do not fit into {r} GB with “Notes”: pieces go out to the disk and the start stretches to {t} ms.'), { n: b.open, r: RAM_GB, t: ms(next) })
          : fmtb(bi('Открыто {n} других программ. Памяти пока хватает всем, поэтому запуск «Заметок» длится по-прежнему {t} мс.', '{n} programs open: there is still enough memory, the start takes {t} ms.'), { n: b.open, t: ms(next) });
      }
    }
    return bi('Схема пересчитана для новых параметров.', 'The diagram is recomputed.');
  },
});
