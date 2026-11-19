// Renting a machine in the cloud: order in a panel, the provider places it on
// a rack in its data centre, you connect over the network, the bill counts
// hours (orient.cloud). Prices are typical list prices of small public clouds
// in November 2026, rounded.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';

type P = { size: string; count: number; hours: number };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
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

const money = (x: number) => `$${x.toFixed(2)}`;

export const rentModel = defineModel<P>({
  id: 'orient.rent',
  block: 'orient',
  title: bi('Машина напрокат: как работает облако', 'A machine for hire: how the cloud works'),
  summary: bi(
    'Вы заказываете сервер в панели, провайдер ставит его на свою стойку, счёт считает часы. Выберите размер и число машин, поменяйте часы, забудьте удалить машину или сожгите стойку.',
    'You order a server in a panel, the provider puts it on its rack, the bill counts hours. Choose the size and number of machines, change the hours, forget to delete the machine or burn the rack.',
  ),
  concepts: ['orient.cloud'],
  diagram: {
    width: 960,
    height: 360,
    nodes: [
      { id: 'you', label: bi('Вы', 'You'), sub: 'laptop', family: 'user', x: 24, y: 48, w: 168, h: 56, card: card(bi('Вам нужен сервер на время проекта. Своего железа нет — и покупать его ради трёх недель незачем.', 'You need a server for the duration of a project. You have no hardware, and buying some for three weeks makes no sense.'), bi('Вы.', 'You.')) },
      { id: 'panel', label: bi('Панель облака', 'Cloud panel'), sub: 'web page', family: 'l7', x: 272, y: 48, w: 184, h: 56, card: card(bi('Сайт провайдера, где машину заказывают несколькими щелчками: размер, система, место. То же можно сделать командой или программой.', 'The provider’s site where a machine is ordered in a few clicks: size, system, location. The same can be done with a command or a program.'), bi('Провайдер облака.', 'The cloud provider.'), { doc: NIST }) },
      { id: 'rackA', label: bi('Стойка A', 'Rack A'), sub: '40 servers', family: 'node', shape: 'rack', x: 560, y: 40, w: 160, h: 72, card: card(bi('Шкаф с десятками серверов. Каждый сервер провайдер делит на несколько машин для разных клиентов.', 'A cabinet with dozens of servers. The provider splits each server into several machines for different customers.'), bi('Провайдер купил, поставил и обслуживает.', 'The provider bought, installed and maintains it.')) },
      { id: 'rackB', label: bi('Стойка B', 'Rack B'), sub: '40 servers', family: 'node', shape: 'rack', x: 776, y: 40, w: 160, h: 72, card: card(bi('Запасное место: если стойка A сломается, провайдер перенесёт машины сюда.', 'Spare room: if rack A breaks, the provider moves the machines here.'), bi('Провайдер.', 'The provider.')) },
      { id: 'vm', label: bi('Ваша машина', 'Your machine'), sub: '2 CPU · 2 GB', family: 'process', x: 560, y: 200, w: 160, h: 56, card: card(bi('Кусок большого сервера, который ведёт себя как отдельный компьютер: своя система, свой адрес в интернете, свой пароль. Соседей по серверу вы не видите.', 'A slice of a big server that behaves like a separate computer: its own system, its own address on the internet, its own password. You do not see your neighbours on the server.'), bi('Провайдер создал по вашему заказу.', 'The provider created it on your order.')) },
      { id: 'bill', label: bi('Счёт', 'Bill'), sub: '$0.00', family: 'gauge', shape: 'buffer', x: 272, y: 200, w: 184, h: 56, card: card(bi('Облако берёт деньги за время, пока машина существует, — даже если она ничего не делает. Удалили — счёт остановился.', 'The cloud charges for the time the machine exists, even if it does nothing. Delete it and the bill stops.'), bi('Провайдер считает каждый час.', 'The provider counts every hour.')) },
    ],
    groups: [{ id: 'dc', label: bi('Дата-центр провайдера', 'The provider’s data centre'), around: ['rackA', 'rackB', 'vm'], family: 'node', dash: 'dash', pad: 16, card: card(bi('Здание с охраной, резервным питанием, охлаждением и толстым подключением к интернету. Его строит и содержит провайдер, а вы платите за кусочек.', 'A building with guards, backup power, cooling and a thick connection to the internet. The provider builds and runs it, and you pay for a slice.'), bi('Провайдер облака.', 'The cloud provider.')) }],
    edges: [
      { id: 'e-order', from: 'you', to: 'panel', label: bi('заказ', 'order'), card: card(bi('Вы выбираете размер машины и нажимаете «Создать». Минута — и она готова.', 'You choose the size of the machine and press “Create”. A minute later it is ready.'), bi('Вы.', 'You.')) },
      { id: 'e-place', from: 'panel', to: 'rackA', label: bi('разместить', 'place'), card: card(bi('Провайдер находит сервер со свободным местом и выделяет на нём вашу машину.', 'The provider finds a server with free room and sets your machine up on it.'), bi('Программы провайдера.', 'The provider’s programs.')) },
      { id: 'e-boot', from: 'rackA', to: 'vm', label: bi('запуск', 'start'), card: card(bi('Машина включается и загружает систему, как обычный компьютер.', 'The machine switches on and loads its system like an ordinary computer.'), bi('Провайдер.', 'The provider.')) },
      {
        id: 'e-connect',
        from: 'you',
        to: 'vm',
        via: [
          [108, 312],
          [640, 312],
        ],
        labelAt: 0.3,
        label: bi('подключение по сети', 'connection over the network'),
        card: card(bi('Вы работаете с машиной через интернет: печатаете команды в окне, а выполняются они в дата-центре.', 'You work with the machine over the internet: you type commands in a window and they run in the data centre.'), bi('Вы.', 'You.')),
      },
      { id: 'e-meter', from: 'vm', to: 'bill', label: bi('часы работы', 'hours running'), card: card(bi('Каждый час существования машины добавляется к счёту.', 'Every hour the machine exists is added to the bill.'), bi('Провайдер.', 'The provider.')) },
    ],
  },
  params: [
    {
      id: 'size',
      label: bi('Размер машины', 'Size of the machine'),
      kind: 'choice',
      default: 'small',
      near: 'vm',
      options: [
        { id: 'small', label: bi('2 CPU · 2 ГБ', '2 CPU · 2 GB') },
        { id: 'medium', label: bi('4 CPU · 8 ГБ', '4 CPU · 8 GB') },
        { id: 'large', label: bi('16 CPU · 64 ГБ', '16 CPU · 64 GB') },
      ],
      predict: {
        prompt: bi('Машина стала мощнее в несколько раз. Что будет со счётом?', 'The machine is now several times more powerful. What happens to the bill?'),
        options: [
          { id: 'up', text: bi('Вырастет примерно во столько же раз', 'It grows by about as many times') },
          { id: 'same', text: bi('Останется тем же: платим за время, а не за размер', 'It stays the same: we pay for time, not size') },
        ],
        resolve: (prev, next) => ((next[next.length - 1]?.metrics?.cost ?? 0) > (prev[prev.length - 1]?.metrics?.cost ?? 0) ? 'up' : 'same'),
      },
    },
    { id: 'count', label: bi('Сколько машин', 'How many machines'), kind: 'range', min: 1, max: 5, step: 1, default: 1, near: 'rackA' },
    { id: 'hours', label: bi('Часов работы для проекта', 'Hours of work for the project'), kind: 'range', min: 1, max: 720, step: 1, unit: 'h', default: 60, near: 'bill' },
  ],
  breaks: [
    {
      id: 'forget',
      label: bi('Забыть удалить машину после проекта', 'Forget to delete the machine after the project'),
      remove: ['e-meter'],
      predict: {
        prompt: bi('Проект закончился, вы закрыли ноутбук, а машину не удалили. Что будет со счётом через месяц?', 'The project is over, you closed the laptop, but did not delete the machine. What happens to the bill in a month?'),
        options: [
          { id: 'grows', text: bi('Будет расти весь месяц: машина существует — значит, тикает', 'It keeps growing all month: the machine exists, so it ticks') },
          { id: 'stops', text: bi('Остановится: машиной ведь никто не пользуется', 'It stops: nobody uses the machine') },
        ],
        resolve: () => 'grows',
      },
    },
    {
      id: 'fire',
      label: bi('Стойка A сгорела', 'Rack A burnt out'),
      remove: ['rackA', 'e-boot'],
      boundary: 'storage',
      predict: {
        prompt: bi('Ночью в дата-центре сгорел сервер с вашей машиной. Кто это чинит?', 'At night the server holding your machine burnt out. Who fixes it?'),
        options: [
          { id: 'provider', text: bi('Провайдер: запустит машину на другой стойке, а данные, которые хранились только на ней, могут пропасть', 'The provider: it restarts the machine on another rack, and data that lived only in it may be lost') },
          { id: 'you', text: bi('Вы: едете в дата-центр менять железо', 'You: you drive to the data centre to replace the hardware') },
        ],
        resolve: () => 'provider',
      },
    },
  ],
  metrics: [
    { id: 'cost', label: bi('счёт', 'bill'), unit: '$' },
    { id: 'hours', label: bi('оплачено часов', 'hours billed'), unit: 'h' },
  ],
  run(p, broken): Step[] {
    const s = SIZES[p.size] ?? SIZES.small;
    const sub = `${s.cpu} CPU · ${s.ram} GB${p.count > 1 ? ` · ×${p.count}` : ''}`;
    const steps: Step[] = [
      {
        id: 'order',
        label: bi('заказ', 'order'),
        caption: fmt(bi('Вы заказываете в панели {n} × {cpu} CPU и {ram} ГБ памяти по {h} $ в час за каждую. Покупать железо и подписывать договор на год не нужно.', 'You order {n} × {cpu} CPU and {ram} GB of memory in the panel at ${h} an hour each. No purchase and no yearly contract.'), { n: p.count, cpu: s.cpu, ram: s.ram, h: s.perHour }),
        focus: ['you', 'e-order', 'panel'],
        tokens: [{ edge: 'e-order', label: `${s.cpu} CPU` }],
        states: { you: 'on', panel: 'on' },
        values: { vm: sub, bill: money(0) },
        fill: { bill: 0 },
        metrics: { cost: 0, hours: 0 },
      },
      {
        id: 'place',
        label: bi('размещение', 'placement'),
        caption: bi('Провайдер находит на стойке A сервер со свободным местом и выделяет там вашу машину. Какой это сервер, вы не знаете и знать не должны.', 'The provider finds a server with free room on rack A and sets up your machine there. Which server it is you do not know and need not know.'),
        focus: ['panel', 'e-place', 'rackA'],
        tokens: [{ edge: 'e-place' }],
        states: { rackA: 'on' },
        metrics: { cost: 0, hours: 0 },
      },
    ];
    if (broken.has('fire')) {
      steps.push({
        id: 'fire',
        label: bi('пожар', 'fire'),
        caption: bi('Сервер на стойке A сгорел. Провайдер сам запускает вашу машину на стойке B, но то, что лежало только на ней, пропало.', 'The server on rack A burnt out. The provider itself brings your machine up on rack B, but whatever lay only on it is gone.'),
        focus: ['rackA', 'rackB', 'vm'],
        states: { rackA: 'err', rackB: 'on', vm: 'warn' },
        metrics: { cost: 0, hours: 0 },
        broken: { at: 'rackA', message: 'Instance my-server was restarted on another host due to a hardware failure.', caption: bi('железо — забота провайдера, а копии важных данных — ваша.', 'the hardware is the provider’s worry; copies of important data are yours.') },
      });
      return steps;
    }
    const work = bill(p.size, p.count, p.hours);
    steps.push(
      {
        id: 'boot',
        label: bi('запуск', 'start'),
        caption: bi('Через минуту машина включена: у неё своя система и свой адрес в интернете.', 'A minute later the machine is on: it has its own system and its own address on the internet.'),
        focus: ['e-boot', 'vm'],
        tokens: [{ edge: 'e-boot' }],
        states: { vm: 'on' },
        metrics: { cost: 0, hours: 0 },
      },
      {
        id: 'work',
        label: bi('работа', 'work'),
        caption: fmt(bi('Вы подключаетесь по сети и работаете {h} ч. Счёт растёт, пока машина существует: {c}.', 'You connect over the network and work for {h} h. The bill grows while the machine exists: {c}.'), { h: p.hours, c: money(work) }),
        focus: ['e-connect', 'vm', 'e-meter', 'bill'],
        tokens: [{ edge: 'e-connect', label: 'commands' }, { edge: 'e-meter', label: `${p.hours} h` }],
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
        caption: fmt(bi('Проект кончился, а машина осталась. Она никому не нужна, но существует — к концу месяца счёт {c} вместо {w}.', 'The project ended but the machine stayed. Nobody needs it, but it exists: by the end of the month the bill is {c} instead of {w}.'), { c: money(month), w: money(work) }),
        focus: ['vm', 'bill'],
        states: { bill: 'err', vm: 'warn' },
        values: { bill: money(month) },
        fill: { bill: 1 },
        metrics: { cost: month, hours: MONTH_H * p.count },
        broken: { at: 'bill', message: `Invoice: ${p.count} × ${p.size}, ${MONTH_H} h — ${money(month)}`, caption: bi('облако платится за существование машины, а не за пользу; ненужное удаляют сразу.', 'the cloud is paid for a machine existing, not for being useful; what is not needed is deleted at once.') },
      });
      return steps;
    }
    steps.push({
      id: 'delete',
      label: bi('удаление', 'delete'),
      caption: fmt(bi('Проект закончен — вы удаляете машину, и счёт останавливается на {c}. Купить такой сервер стоило бы в сотни раз дороже.', 'The project is over: you delete the machine and the bill stops at {c}. Buying such a server would have cost hundreds of times more.'), { c: money(work) }),
      focus: ['vm', 'bill'],
      states: { vm: 'off', bill: 'ok', rackA: 'off' },
      metrics: { cost: work, hours: p.hours * p.count },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const cost = (s: Step[]) => s[s.length - 1]?.metrics?.cost ?? 0;
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана.', 'The break is removed.');
      return change.id === 'forget'
        ? fmt(bi('Машина простояла месяц без дела: счёт {a} → {b}. Это самая частая лишняя трата в облаке.', 'The machine sat idle for a month: the bill goes {a} → {b}. This is the most common wasted spend in the cloud.'), { a: money(cost(prev)), b: money(cost(next)) })
        : bi('Сгоревшее железо заменяет провайдер, а вашу машину запускают на другой стойке. Пропадает только то, у чего не было копии.', 'The provider replaces burnt hardware, and the machine moves to another rack. Only what had no copy is lost.');
    }
    switch (change.id) {
      case 'size':
        return fmt(bi('Размер {a} → {b}: час стоит {h} $, счёт {c0} → {c1}.', 'Size {a} → {b}: an hour costs ${h}, the bill {c0} → {c1}.'), { a: a.size as string, b: b.size as string, h: (SIZES[b.size as string] ?? SIZES.small).perHour, c0: money(cost(prev)), c1: money(cost(next)) });
      case 'count':
        return fmt(bi('Машин {n}: счёт растёт в столько же раз, {c}.', '{n} machines: the bill grows by as many times, {c}.'), { n: b.count as number, c: money(cost(next)) });
      case 'hours':
        return fmt(bi('{a} → {b} ч: счёт {c}. Платите за то время, что машина существует.', '{a} → {b} h: the bill is {c}. You pay exactly for the time the machine exists.'), { a: a.hours as number, b: b.hours as number, c: money(cost(next)) });
    }
    return bi('Процесс пересчитан.', 'The process is recomputed.');
  },
});
