// Renting a machine in the cloud: order in a panel, the provider places it on
// a rack in its data centre, you connect over the network, the bill counts
// hours (orient.cloud). Prices are typical list prices of small public clouds
// in November 2026, rounded.
//
// Reading order: at the start there are only you and the provider's panel.
// The data centre with its rack appears when the order reaches it, then your
// machine, then the bill. The second rack appears only when the first one
// burns, to show who restarts the machine and what is lost.

import { defineModel } from '../../../core/define';
import { bi, pluralRu, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { card, compare, fmtb, lastMetric, startWith, tr } from './kit';

type P = { size: string; count: number; hours: number };

const NIST = { url: 'https://csrc.nist.gov/pubs/sp/800/145/final', label: 'NIST SP 800-145' };
const MONTH_H = 720;

export const SIZES: Record<string, { cpu: number; ram: number; perHour: number }> = {
  small: { cpu: 2, ram: 2, perHour: 0.02 },
  medium: { cpu: 4, ram: 8, perHour: 0.08 },
  large: { cpu: 16, ram: 64, perHour: 0.6 },
};

/** Dollars for `hours` of `count` machines of `size`, rounded to cents. */
export function bill(size: string, count: number, hours: number): number {
  return Math.round((SIZES[size] ?? SIZES.small).perHour * count * hours * 100) / 100;
}

const money = (x: number) => tr(`$${x.toFixed(2).replace('.', ',')}`, `$${x.toFixed(2)}`);
const ALL = ['you', 'panel', 'rackA', 'rackB', 'vm', 'bill', 'dc', 'e-order', 'e-place', 'e-boot', 'e-connect', 'e-meter', 'e-move'];
const machines = (n: number) => `${n} ${pluralRu(n, ['машина', 'машины', 'машин'])}`;
/** Accusative: «взять одну машину», «взять 3 машины». */
const machinesAcc = (n: number) => (n === 1 ? 'одну машину' : `${n} ${pluralRu(n, ['машину', 'машины', 'машин'])}`);
const cpus = (n: number) => `${n} ${pluralRu(n, ['процессор', 'процессора', 'процессоров'])}`;
const hoursRu = (n: number) => `${n} ${pluralRu(n, ['час', 'часа', 'часов'])}`;

export const rentModel = defineModel<P>({
  id: 'orient.rent',
  frame: 'visible',
  block: 'orient',
  title: bi('Как взять машину напрокат в облаке', 'How to hire a machine in the cloud'),
  summary: bi(
    'Вы заказываете сервер в панели облачного провайдера, провайдер выделяет его на своей стойке в дата-центре, вы работаете с машиной по сети, а счёт растёт с каждым часом, пока машина существует. Под схемой видно, сколько вы заплатите.',
    'You order a server in a cloud provider’s panel, the provider places it on a rack in its data centre, you work with it over the network, and the bill grows every hour the machine exists.',
  ),
  intro: bi(
    'Сейчас на схеме только вы и панель облака, то есть сайт провайдера, на котором заказывают машины. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен тот, кто работает, облачко говорит, что он делает, а карточка на линии показывает, что передаётся: заказ, команды или оплаченные часы.\n\nКогда дойдёте до счёта, поменяйте в «Параметрах» размер и число машин и посмотрите на сумму под схемой. Потом включите в блоке «Сломать» забытую машину и сгоревшую стойку.',
    'Now the diagram shows only you and the cloud panel. Press “Start from the first step”, then go on with “Step forward” above the diagram. The one working is highlighted, the callout says what it does, the card on the line shows the order, commands or billed hours.\n\nAt the bill, change the size and number of machines in “Parameters”. Then switch on the forgotten machine and the burnt rack in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: bi('тот, кто работает сейчас', 'the one working now') },
    { mark: 'say', text: bi('что он делает', 'what it does') },
    { mark: 'token', text: bi('заказ, команды или оплаченные часы', 'the order, commands or billed hours') },
    { mark: 'icon:user', text: bi('вы', 'you') },
    { mark: 'icon:browser', text: bi('панель облака, то есть сайт провайдера', 'the cloud panel, that is, the provider’s site') },
    { mark: 'icon:server', text: bi('стойка с серверами провайдера', 'a rack of the provider’s servers') },
    { mark: 'icon:cloud', text: bi('ваша машина в облаке', 'your machine in the cloud') },
    { mark: 'icon:file', text: bi('счёт', 'the bill') },
    { mark: 'err', text: bi('здесь случилась беда, например пожар или лишние траты', 'trouble happened here, such as a fire or wasted money') },
  ],
  stopLabel: bi('Беда случилась', 'Trouble'),
  concepts: ['orient.cloud'],
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      { id: 'you', label: bi('Вы', 'You'), icon: 'user', work: 'dots', sub: { ru: 'ноутбук', en: 'laptop' }, family: 'user', x: 24, y: 72, w: 184, h: 64, card: card(bi('Вам нужен сервер на время проекта. Своего железа у вас нет, и покупать его ради нескольких недель работы незачем.', 'You need a server for a project; buying hardware for a few weeks makes no sense.'), bi('Заказываете машину вы сами.', 'You.')) },
      { id: 'panel', label: bi('Панель облака', 'Cloud panel'), icon: 'browser', sub: { ru: 'веб-страница', en: 'web page' }, family: 'l7', x: 264, y: 72, w: 200, h: 64, card: card(bi('Панелью облака называют сайт провайдера, на котором машину заказывают несколькими щелчками: выбирают размер, операционную систему и город. То же самое можно сделать командой или программой.', 'The provider’s site where a machine is ordered in a few clicks.'), bi('Панель держит облачный провайдер.', 'The cloud provider.'), { doc: NIST }) },
      { id: 'rackA', label: bi('Стойка A', 'Rack A'), icon: 'server', sub: { ru: '40 серверов', en: '40 servers' }, family: 'node', shape: 'rack', x: 560, y: 68, w: 168, h: 72, card: card(bi('Стойкой называют шкаф, в котором стоят десятки серверов. Каждый сервер провайдер делит на несколько отдельных машин для разных клиентов, и соседей по серверу вы не видите.', 'A cabinet of servers; each is split into machines for different customers.'), bi('Стойку купил, поставил и обслуживает провайдер.', 'The provider bought and maintains it.')) },
      { id: 'rackB', label: bi('Стойка B', 'Rack B'), icon: 'server', sub: { ru: '40 серверов', en: '40 servers' }, family: 'node', shape: 'rack', x: 768, y: 68, w: 168, h: 72, card: card(bi('Стойка B служит запасным местом. Если на стойке A сломается сервер, провайдер перезапустит машины клиентов здесь.', 'Spare room: if rack A breaks, the machines move here.'), bi('Стойку обслуживает провайдер.', 'The provider.')) },
      { id: 'vm', label: bi('Ваша машина', 'Your machine'), icon: 'cloud', sub: { ru: '2 CPU · 2 ГБ', en: '2 CPU · 2 GB' }, family: 'process', x: 560, y: 240, w: 168, h: 64, card: card(bi('Ваша машина занимает часть большого сервера и ведёт себя как отдельный компьютер: у неё своя операционная система, свой адрес в интернете и свой пароль.', 'Your machine takes up a slice of a big server and behaves like a separate computer, with its own operating system, internet address and password.'), bi('Машину создал провайдер по вашему заказу.', 'The provider created it on your order.')) },
      { id: 'bill', label: bi('Счёт', 'Bill'), icon: 'file', sub: '$0.00', family: 'gauge', shape: 'buffer', x: 264, y: 240, w: 200, h: 64, card: card(bi('Облако берёт деньги за каждый час, пока машина существует, даже если она ничего не делает. Как только машину удаляют, счёт останавливается. Полоска внизу показывает, какую часть месяца машина уже оплачена.', 'The cloud charges for every hour the machine exists, even if idle.'), bi('Счёт ведёт провайдер.', 'The provider.')) },
    ],
    groups: [{ id: 'dc', label: bi('Дата-центр провайдера', 'The provider’s data centre'), around: ['rackA', 'rackB', 'vm'], family: 'node', dash: 'dash', pad: 16, card: card(bi('Дата-центр представляет собой здание с охраной, резервным питанием, охлаждением и мощным подключением к интернету. Его строит и содержит провайдер, а вы платите за маленькую часть этого хозяйства.', 'A building with guards, backup power and cooling; you pay for a slice.'), bi('Дата-центр принадлежит облачному провайдеру.', 'The cloud provider.')) }],
    edges: [
      { id: 'e-order', from: 'you', to: 'panel', label: bi('заказ', 'order'), card: card(bi('Вы выбираете размер машины и нажимаете «Создать». Через минуту машина готова.', 'You choose the size and press “Create”.'), bi('Заказ делаете вы.', 'You.')) },
      { id: 'e-place', from: 'panel', to: 'rackA', label: bi('выделить место', 'place it'), card: card(bi('Провайдер находит сервер со свободным местом и создаёт на нём вашу машину.', 'The provider finds a server with free room.'), bi('Место выбирают программы провайдера.', 'The provider’s programs.')) },
      { id: 'e-boot', from: 'rackA', to: 'vm', label: bi('включить', 'start'), card: card(bi('Машина включается и загружает операционную систему, как обычный компьютер.', 'The machine starts and loads its system.'), bi('Машину включает провайдер.', 'The provider.')) },
      { id: 'e-connect', from: 'you', to: 'vm', via: [[116, 364], [644, 364]], labelAt: 0.3, label: bi('команды по сети', 'commands over the network'), card: card(bi('Вы работаете с машиной через интернет: печатаете команды у себя, а выполняются они в дата-центре.', 'You type commands; they run in the data centre.'), bi('Подключаетесь к машине вы сами.', 'You.')) },
      { id: 'e-meter', from: 'vm', to: 'bill', label: bi('часы работы', 'hours running'), card: card(bi('Каждый час, пока машина существует, добавляется к счёту.', 'Every hour the machine exists is added to the bill.'), bi('Часы считает провайдер.', 'The provider.')) },
      { id: 'e-move', from: 'rackA', to: 'rackB', dashed: true, label: bi('перезапуск', 'restart'), card: card(bi('Если сервер сломался, провайдер сам перезапускает машины клиентов на другой стойке.', 'If a server breaks, the provider restarts the machines elsewhere.'), bi('Машины перезапускает провайдер.', 'The provider.')) },
    ],
  },
  params: [
    {
      id: 'size',
      label: bi('Размер каждой машины', 'Size of each machine'),
      group: bi('Какие машины вы заказали', 'What you ordered'),
      kind: 'choice',
      default: 'small',
      near: 'vm',
      options: [
        { id: 'small', label: bi('2 процессора и 2 ГБ памяти, $0,02 в час', '2 CPU · 2 GB, $0.02 an hour') },
        { id: 'medium', label: bi('4 процессора и 8 ГБ памяти, $0,08 в час', '4 CPU · 8 GB, $0.08 an hour') },
        { id: 'large', label: bi('16 процессоров и 64 ГБ памяти, $0,60 в час', '16 CPU · 64 GB, $0.60 an hour') },
      ],
      predict: {
        prompt: bi('Вы выбрали другой размер машины, а число машин и часы работы остались прежними. Что станет со счётом?', 'You chose another size; the count and hours stay the same. What happens to the bill?'),
        options: [
          { id: 'up', text: bi('Счёт вырастет', 'The bill grows') },
          { id: 'down', text: bi('Счёт уменьшится', 'The bill shrinks') },
          { id: 'same', text: bi('Счёт не изменится, потому что платят за время, а не за размер', 'The bill stays the same, because you pay for time, not size') },
        ],
        resolve: (prev, next) => compare(lastMetric(prev, 'cost'), lastMetric(next, 'cost')),
      },
    },
    { id: 'count', label: bi('Сколько машин', 'How many machines'), group: bi('Какие машины вы заказали', 'What you ordered'), kind: 'range', min: 1, max: 5, step: 1, default: 1, near: 'rackA' },
    { id: 'hours', label: bi('Сколько часов машины нужны проекту', 'Hours the project needs'), group: bi('Как долго нужны машины', 'How long they are needed'), kind: 'range', min: 1, max: 720, step: 1, default: 60, near: 'bill' },
  ],
  breaks: [
    {
      id: 'forget',
      label: bi('Машину забыли удалить, когда проект закончился', 'The machine was not deleted when the project ended'),
      remove: ['e-meter'],
      predict: {
        prompt: bi('Проект закончился, вы закрыли ноутбук, но машину в облаке не удалили, и ею никто не пользуется. Что будет со счётом к концу месяца?', 'The project is over, the machine was not deleted and nobody uses it. What happens to the bill by the end of the month?'),
        options: [
          { id: 'grows', text: bi('Будет расти весь месяц, пока машина существует', 'It grows all month while the machine exists') },
          { id: 'stops', text: bi('Остановится, потому что машиной не пользуются', 'It stops, since nobody uses the machine') },
        ],
        resolve: (prev, next) => (lastMetric(next, 'cost') > lastMetric(prev, 'cost') ? 'grows' : 'stops'),
      },
    },
    {
      id: 'fire',
      label: bi('Сервер в стойке A сгорел ночью', 'A server in rack A burnt out at night'),
      remove: ['rackA', 'e-boot'],
      boundary: 'storage',
      predict: {
        prompt: bi('Ночью в дата-центре сгорел сервер, на котором работала ваша машина. Кто и что будет делать?', 'At night the server with your machine burnt out. Who does what?'),
        options: [
          { id: 'provider', text: bi('Провайдер перезапустит машину на другой стойке, но данные, которые хранились только на ней, могут пропасть', 'The provider restarts it on another rack; data kept only on it may be lost') },
          { id: 'you', text: bi('Вам придётся ехать в дата-центр и менять сгоревшее железо самому', 'You have to go and replace the hardware') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'move') ? 'provider' : 'you'),
      },
    },
  ],
  metrics: [
    { id: 'cost', label: bi('сумма счёта', 'bill'), unit: '$' },
    { id: 'hours', label: bi('сколько машино-часов оплачено', 'machine-hours billed') },
  ],
  run(p, broken): Step[] {
    const s = SIZES[p.size] ?? SIZES.small;
    const sub = tr(`${s.cpu} CPU · ${s.ram} ГБ${p.count > 1 ? ` · ×${p.count}` : ''}`, `${s.cpu} CPU · ${s.ram} GB${p.count > 1 ? ` · ×${p.count}` : ''}`);
    const work = bill(p.size, p.count, p.hours);
    const steps: Step[] = [
      {
        id: 'choose',
        label: bi('решение', 'decision'),
        caption: fmtb(bi('Проекту нужны серверы на {h}. Покупать для этого своё железо, ждать поставки и искать ему место незачем, поэтому вы открываете панель облачного провайдера.', 'The project needs servers for {h} h; you open a cloud provider’s panel instead of buying hardware.'), { h: bi(hoursRu(p.hours), String(p.hours)) }),
        focus: ['you'],
        say: { you: fmtb(bi('Вы решаете взять напрокат {n} на {h} и открываете панель облака.', 'You need {n} for {h} h.'), { n: bi(machinesAcc(p.count), String(p.count)), h: bi(hoursRu(p.hours), String(p.hours)) }) },
        states: { ...startWith(ALL, 'you', 'panel'), you: 'on' },
        values: { vm: sub, bill: money(0), you: tr('ноутбук', 'laptop'), panel: tr('сайт провайдера', 'web page'), rackA: tr('40 серверов', '40 servers'), rackB: tr('40 серверов', '40 servers') },
        fill: { bill: 0 },
        metrics: { cost: 0, hours: 0 },
      },
      {
        id: 'order',
        label: bi('заказ', 'order'),
        caption: fmtb(bi('Вы заказываете в панели {n}, {each} {cpu} и {ram} ГБ памяти, а час работы {cost} ${h}. Потом вы нажимаете «Создать». Ни договора на год, ни оплаты вперёд не нужно.', 'You order {n} × {cpu} CPU and {ram} GB at ${h} an hour each. No contract, no payment up front.'), { n: bi(machinesAcc(p.count), String(p.count)), each: p.count > 1 ? bi('и у каждой из них будет', '') : bi('и у неё будет', ''), cost: p.count > 1 ? bi('каждой стоит', '') : bi('стоит', ''), cpu: bi(cpus(s.cpu), String(s.cpu)), ram: s.ram, h: bi(s.perHour.toFixed(2).replace('.', ','), s.perHour.toFixed(2)) }),
        focus: ['e-order', 'panel'],
        reveal: ['e-order'],
        tokens: [{ edge: 'e-order', label: bi(`${p.count} × ${s.cpu} CPU · ${s.ram} ГБ`, `${p.count} × ${s.cpu} CPU · ${s.ram} GB`) }],
        say: { panel: bi('Панель принимает заказ и передаёт его в дата-центр.', 'The panel takes the order to the data centre.') },
        states: { panel: 'on' },
        metrics: { cost: 0, hours: 0 },
      },
      {
        id: 'place',
        label: bi('место', 'placement'),
        caption: bi('Провайдер находит в стойке A сервер со свободным местом и выделяет на нём вашу машину. Какой это сервер, вы не знаете, и знать это вам не нужно, потому что за железо отвечает провайдер.', 'The provider finds a server with room in rack A. Which one you need not know: hardware is the provider’s job.'),
        focus: ['e-place', 'rackA'],
        reveal: ['dc', 'rackA', 'e-place'],
        tokens: [{ edge: 'e-place', label: sub }],
        say: { rackA: bi('Провайдер выделяет вашу машину на сервере в стойке A.', 'The provider places your machine in rack A.') },
        states: { rackA: 'on' },
        metrics: { cost: 0, hours: 0 },
      },
    ];
    if (broken.has('fire')) {
      steps.push(
        {
          id: 'fire',
          label: bi('пожар', 'fire'),
          caption: bi('Ночью сервер в стойке A сгорел, и ваша машина остановилась вместе с ним. Ехать в дата-центр вам не нужно, да вас туда и не пустят, потому что сгоревшим сервером занимается провайдер.', 'At night the server in rack A burnt out, and your machine stopped with it. This is the provider’s worry.'),
          focus: ['rackA'],
          say: { rackA: bi('Сервер в стойке A сгорел вместе с вашей машиной.', 'The server in rack A burnt out with your machine.') },
          states: { rackA: 'err' },
          metrics: { cost: 0, hours: 0 },
        },
        {
          id: 'move',
          label: bi('перезапуск', 'restart'),
          caption: bi('Провайдер сам перезапускает вашу машину на стойке B, и через несколько минут она снова работает. Но всё, что хранилось только на её диске, пропало, потому что копии своих данных делает их владелец, то есть вы.', 'The provider restarts your machine on rack B. But whatever lay only on its disk is gone: copies are the owner’s job.'),
          focus: ['e-move', 'rackB'],
          reveal: ['rackB', 'e-move'],
          tokens: [{ edge: 'e-move', label: bi('ваша машина', 'your machine') }],
          say: { rackB: bi('Провайдер запустил вашу машину заново здесь, но её диск пуст.', 'The provider restarted it here, with an empty disk.') },
          states: { rackB: 'warn' },
          metrics: { cost: 0, hours: 0 },
          broken: { at: 'rackA', message: 'Instance my-server was restarted on another host due to a hardware failure.', caption: bi('на стойке A. За железо отвечает провайдер, а за копии важных данных отвечаете вы.', 'at rack A: the hardware is the provider’s worry; copies of important data are yours.') },
        },
      );
      return steps;
    }
    steps.push(
      {
        id: 'boot',
        label: bi('запуск', 'start'),
        caption: bi('Через минуту машина включается, и у неё есть своя операционная система и свой адрес в интернете. Для вас она выглядит как обычный сервер.', 'A minute later the machine is on, with its own system and address.'),
        focus: ['e-boot', 'vm'],
        reveal: ['vm', 'e-boot'],
        tokens: [{ edge: 'e-boot', label: bi('включить', 'start') }],
        say: { vm: bi('Машина включилась и получила свой адрес в интернете.', 'The machine is on, with its own address.') },
        states: { vm: 'on' },
        metrics: { cost: 0, hours: 0 },
      },
      {
        id: 'work',
        label: bi('работа', 'work'),
        caption: fmtb(bi('Вы подключаетесь к машине по сети и работаете с ней {h}. Вы печатаете команды у себя, а выполняются они в дата-центре.', 'You connect over the network and work for {h} h.'), { h: bi(hoursRu(p.hours), String(p.hours)) }),
        focus: ['e-connect', 'vm'],
        reveal: ['e-connect'],
        tokens: [{ edge: 'e-connect', label: bi('команды', 'commands') }],
        say: { vm: bi('Машина выполняет команды, которые вы присылаете по сети.', 'The machine runs the commands you send.') },
        metrics: { cost: 0, hours: 0 },
      },
      {
        id: 'meter',
        label: bi('счёт', 'bill'),
        caption: fmtb(bi('Пока машина существует, провайдер прибавляет к счёту каждый час. За {h} работы {n} в счёте набралось {c}.', 'Every hour the machine exists is billed: {c} for {h} h.'), { h: bi(hoursRu(p.hours), String(p.hours)), n: p.count > 1 ? bi(`${p.count} машин`, '') : bi('одной машины', ''), c: money(work) }),
        focus: ['e-meter', 'bill'],
        reveal: ['bill', 'e-meter'],
        tokens: [{ edge: 'e-meter', label: bi(`${p.hours} ч × ${p.count}`, `${p.hours} h × ${p.count}`) }],
        say: { bill: fmtb(bi('Счёт растёт с каждым часом, и сейчас в нём {c}.', 'The bill grows every hour, and it now holds {c}.'), { c: money(work) }) },
        states: { bill: 'on' },
        values: { bill: money(work) },
        fill: { bill: Math.min(1, p.hours / MONTH_H) },
        metrics: { cost: work, hours: p.hours * p.count },
      },
    );
    if (broken.has('forget')) {
      const month = bill(p.size, p.count, MONTH_H);
      steps.push({
        id: 'forgotten',
        label: bi('забыли', 'forgotten'),
        caption: fmtb(bi('Проект закончился, а машину не удалили. Она никому не нужна, но существует, и провайдер продолжает считать часы. К концу месяца в счёте {c} вместо {w}.', 'The project ended but the machine stayed: by the end of the month the bill is {c} instead of {w}.'), { c: money(month), w: money(work) }),
        focus: ['bill'],
        say: { bill: fmtb(bi('Машиной не пользуются, а счёт за месяц дорос до {c}.', 'Nobody uses it, and the bill reached {c}.'), { c: money(month) }) },
        states: { bill: 'err', vm: 'warn' },
        values: { bill: money(month) },
        fill: { bill: 1 },
        metrics: { cost: month, hours: MONTH_H * p.count },
        broken: { at: 'bill', message: `Invoice: ${p.count} × ${p.size}, ${MONTH_H} h — ${money(month)}`, caption: bi('в счёте. В облаке платят за то, что машина существует, а не за пользу от неё, поэтому ненужную машину удаляют сразу.', 'in the bill: the cloud is paid for a machine existing, not for being useful; delete what is not needed at once.') },
      });
      return steps;
    }
    steps.push({
      id: 'delete',
      label: bi('удаление', 'delete'),
      caption: fmtb(bi('Проект закончен, вы удаляете {m}, и счёт останавливается на {c}. Покупка такого сервера обошлась бы в сотни раз дороже.', 'You delete the machine and the bill stops at {c}. Buying such a server would cost hundreds of times more.'), { c: money(work), m: p.count > 1 ? bi('машины', 'machines') : bi('машину', 'machine') }),
      focus: ['bill'],
      say: { bill: fmtb(bi('{m}, и счёт остановился на {c}.', 'The machine is deleted; the bill stops at {c}.'), { c: money(work), m: p.count > 1 ? bi('Машины удалили', '') : bi('Машину удалили', '') }) },
      states: { vm: 'off', bill: 'ok', rackA: 'off' },
      metrics: { cost: work, hours: p.hours * p.count },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const cost = (s: Step[]) => lastMetric(s, 'cost');
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку выключили, поэтому машину снова удаляют вовремя, а стойка цела.', 'The break is off, so the machine is deleted on time again and the rack is intact.');
      return change.id === 'forget'
        ? fmtb(bi('Машина простояла месяц без дела, и счёт вырос с {a} до {b}. Чаще всего деньги в облаке уходят впустую на забытые машины.', 'The machine sat idle for a month, and the bill grew from {a} to {b}. Most money wasted in the cloud goes on forgotten machines.'), { a: money(cost(prev)), b: money(cost(next)) })
        : bi('Сгоревшее железо заменяет провайдер, а вашу машину перезапускают на другой стойке. Пропадает только то, у чего не было копии.', 'The provider replaces the hardware and restarts the machine; only what had no copy is lost.');
    }
    switch (change.id) {
      case 'size': {
        const sz = SIZES[b.size as string] ?? SIZES.small;
        return fmtb(bi('Теперь у каждой машины {cpu} и {ram} ГБ памяти, и час её работы стоит ${h}. Счёт изменился с {c0} до {c1}.', 'Now {cpu} CPU and {ram} GB at ${h} an hour: {c0} → {c1}.'), { cpu: bi(cpus(sz.cpu), String(sz.cpu)), ram: sz.ram, h: bi(sz.perHour.toFixed(2).replace('.', ','), sz.perHour.toFixed(2)), c0: money(cost(prev)), c1: money(cost(next)) });
      }
      case 'count':
        return fmtb(bi('Теперь вы арендуете {n}, и счёт меняется во столько же раз и составляет {c}.', '{n} machines: the bill changes as many times, {c}.'), { n: bi(machines(b.count as number), String(b.count)), c: money(cost(next)) });
      case 'hours':
        return fmtb(bi('Машины нужны не {a}, а {b}, и счёт теперь составляет {c}, потому что вы платите за всё время, пока машины существуют.', '{a} → {b} h: the bill is {c}.'), { a: bi(hoursRu(a.hours as number), String(a.hours)), b: bi(hoursRu(b.hours as number), String(b.hours)), c: money(cost(next)) });
    }
    return bi('Схема пересчитана для новых параметров.', 'The diagram is recomputed.');
  },
});
