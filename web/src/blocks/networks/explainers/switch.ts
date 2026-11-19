// E-SW (03 §5.3 net.m01): a learning switch. Frames carry MAC addresses;
// the switch remembers behind which port each source MAC lives and floods
// what it does not know yet.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { b, brokenAt, card, edge, lastMetric, node } from './kit';

type P = { table: string; broadcast: boolean };

const MAC = { a: '02:42:ac:11:00:0a', b: '02:42:ac:11:00:14', c: '02:42:ac:11:00:1e', d: '02:42:ac:11:00:28' };
const swCard = card(
  ['Коммутатор (switch) соединяет кабели одной локальной сети. Он читает в кадре только MAC-адреса: адрес отправителя запоминает в таблице «MAC → порт», по адресу получателя решает, в какой порт отдать кадр.', 'A switch joins the cables of one local network. It reads only the MAC addresses in a frame: it stores the sender’s address in a “MAC → port” table and uses the receiver’s address to decide which port gets the frame.'],
  ['Стоит в шкафу офиса или внутри домашнего роутера. В Linux его роль играет мост (bridge).', 'It sits in an office rack or inside a home router. In Linux a bridge plays its role.'],
  'bridge fdb show',
);
const host = (id: 'a' | 'b' | 'c' | 'd', x: number, y: number) =>
  node(id, `host-${id}`, 'user', [x, y, 160, 56], card([`Компьютер с сетевой картой. Её MAC-адрес ${MAC[id]} записан производителем (или выдан системой виртуализации).`, `A computer with a network card. Its MAC address ${MAC[id]} was set by the manufacturer (or by the virtualisation system).`], ['Производитель карты; у виртуальных машин — гипервизор.', 'The card’s manufacturer; for virtual machines, the hypervisor.'], 'ip link show eth0'), { sub: MAC[id] });
const port = (id: string, from: string, n: number, via?: [number, number][]) =>
  edge(id, 'switch', from, `port ${n}`, card([`Порт ${n} коммутатора и кабель к компьютеру. По кабелю кадры идут в обе стороны.`, `Port ${n} of the switch and the cable to the computer. Frames travel both ways along it.`], ['Тот, кто воткнул кабель.', 'Whoever plugged in the cable.']), { via, labelAt: 0.78 });

export const switchModel = defineModel<P>({
  id: 'net.switch',
  block: 'networks',
  title: b('Коммутатор учит MAC-адреса', 'A switch learns MAC addresses'),
  summary: b('Компьютер A отправляет кадр компьютеру B. Смотри, как заполняется таблица коммутатора и когда кадр уходит во все порты.', 'Computer A sends a frame to computer B. Watch the switch table fill up and see when a frame goes out of every port.'),
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      host('a', 24, 40),
      host('b', 776, 40),
      host('c', 24, 304),
      host('d', 776, 304),
      node('switch', b('Коммутатор', 'Switch'), 'l2', [376, 160, 208, 80], swCard, { sub: '—' }),
    ],
    edges: [port('p1', 'a', 1, [[104, 200]]), port('p2', 'b', 2, [[856, 200]]), port('p3', 'c', 3, [[104, 200]]), port('p4', 'd', 4, [[856, 200]])],
  },
  params: [
    {
      id: 'table',
      label: b('Таблица MAC в начале', 'MAC table at the start'),
      kind: 'choice',
      default: 'empty',
      options: [
        { id: 'empty', label: b('пустая (только включили)', 'empty (just powered on)') },
        { id: 'warm', label: b('уже знает A и B', 'already knows A and B') },
      ],
      near: 'switch',
      predict: {
        prompt: b('Коммутатор уже знает, за каким портом B. Куда уйдёт кадр от A к B?', 'The switch already knows which port B is behind. Where does a frame from A to B go?'),
        options: [
          { id: 'one', text: b('Только в порт 2', 'Only to port 2') },
          { id: 'all', text: b('Во все порты, кроме порта 1', 'To every port except port 1') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'flooded') ?? 0) > 0 ? 'all' : 'one'),
      },
    },
    {
      id: 'broadcast',
      label: b('Кадр на ff:ff:ff:ff:ff:ff (всем)', 'Frame to ff:ff:ff:ff:ff:ff (everyone)'),
      kind: 'toggle',
      default: false,
      near: 'switch',
      predict: {
        prompt: b('A отправляет кадр на широковещательный адрес. Поможет ли заполненная таблица?', 'A sends a frame to the broadcast address. Will a full table help?'),
        options: [
          { id: 'no', text: b('Нет: такой кадр всегда уходит во все порты', 'No: such a frame always goes out of every port') },
          { id: 'yes', text: b('Да: уйдёт только в порт 2', 'Yes: it goes to port 2 only') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'flooded') ?? 0) > 0 ? 'no' : 'yes'),
      },
    },
  ],
  breaks: [
    {
      id: 'unplug',
      label: b('Выдернуть кабель B', 'Unplug B’s cable'),
      remove: ['p2', 'b'],
      layer: 'L1',
      predict: {
        prompt: b('Кабель компьютера B выдернут. Что получит A в ответ?', 'B’s cable is unplugged. What does A get back?'),
        options: [
          { id: 'none', text: b('Ничего: кадр уходит в пустоту, ответа нет', 'Nothing: the frame goes nowhere, no answer') },
          { id: 'error', text: b('Сообщение коммутатора об ошибке', 'An error message from the switch') },
        ],
        resolve: (_p, next) => (brokenAt(next) ? 'none' : 'error'),
      },
    },
  ],
  metrics: [
    { id: 'flooded', label: b('копий кадра разослано', 'frame copies flooded') },
    { id: 'entries', label: b('строк в таблице', 'table entries') },
  ],
  run(p, broken): Step[] {
    const warm = p.table === 'warm';
    const table = (rows: string[]) => (rows.length ? rows.join(' · ') : '—');
    const known = warm ? ['A→1', 'B→2'] : [];
    const steps: Step[] = [];
    const dst = p.broadcast ? 'ff:ff:ff:ff:ff:ff' : MAC.b;
    steps.push({
      id: 'send',
      label: b('кадр', 'frame'),
      caption: fmt(b('A собирает кадр: MAC получателя {d}, MAC отправителя {s}, затем данные. Кадр уходит в порт 1.', 'A builds a frame: receiver MAC {d}, sender MAC {s}, then the data. The frame enters port 1.'), { d: dst, s: MAC.a }),
      focus: ['a', 'p1'],
      tokens: [{ edge: 'p1', label: `→ ${p.broadcast ? 'ff:ff…' : 'B'}`, reverse: true }],
      states: { a: 'on' },
      values: { switch: table(known) },
      metrics: { flooded: 0, entries: known.length },
    });
    const learned = warm ? known : ['A→1'];
    steps.push({
      id: 'learn',
      label: b('запомнил', 'learn'),
      caption: warm
        ? b('Коммутатор смотрит на MAC отправителя: A уже есть в таблице за портом 1, обновляет таймер.', 'The switch looks at the sender MAC: A is already in the table behind port 1; it refreshes the timer.')
        : b('Коммутатор смотрит на MAC отправителя и записывает: «A — за портом 1». Так он учится сам, без настройки.', 'The switch looks at the sender MAC and writes: “A is behind port 1”. That is how it learns, with no configuration.'),
      focus: ['switch'],
      states: { switch: 'on' },
      values: { switch: table(learned) },
      metrics: { flooded: 0, entries: learned.length },
    });
    const flood = p.broadcast || !warm;
    if (flood) {
      steps.push({
        id: 'flood',
        label: b('всем', 'flood'),
        caption: p.broadcast
          ? b('Адрес ff:ff:ff:ff:ff:ff значит «всем»: коммутатор копирует кадр во все порты, кроме того, откуда он пришёл. Таблица тут не помогает.', 'The address ff:ff:ff:ff:ff:ff means “everyone”: the switch copies the frame to every port except the one it came from. The table does not help here.')
          : b('Где B, коммутатор ещё не знает. Он рассылает копии кадра во все остальные порты: B возьмёт кадр себе, C и D увидят чужой MAC получателя и выбросят.', 'The switch does not know where B is yet. It floods copies to every other port: B takes the frame, C and D see someone else’s receiver MAC and drop it.'),
        focus: ['p2', 'p3', 'p4'],
        tokens: [{ edge: 'p2' }, { edge: 'p3' }, { edge: 'p4' }],
        states: { c: p.broadcast ? 'on' : 'off', d: p.broadcast ? 'on' : 'off' },
        metrics: { flooded: 3, entries: learned.length },
      });
    } else {
      steps.push({
        id: 'forward',
        label: b('в порт 2', 'port 2'),
        caption: b('В таблице есть «B — за портом 2». Кадр уходит только туда; C и D его не видят.', 'The table says “B is behind port 2”. The frame goes there only; C and D never see it.'),
        focus: ['p2'],
        tokens: [{ edge: 'p2' }],
        metrics: { flooded: 0, entries: learned.length },
      });
    }
    if (broken.has('unplug')) {
      steps.push({
        id: 'silence',
        label: b('тишина', 'silence'),
        caption: b('Компьютер B не подключён: кадр, отправленный в порт 2, никто не принял. Коммутатор не сообщает об ошибках — A просто не дождётся ответа.', 'Computer B is not connected: the frame sent to port 2 reached nobody. A switch reports no errors — A simply never gets an answer.'),
        focus: ['p2', 'b'],
        states: { b: 'err', p2: 'err' },
        metrics: { flooded: flood ? 3 : 0, entries: learned.length },
        broken: { at: 'b', message: '$ ping -c 2 192.168.1.20\nFrom 192.168.1.10 icmp_seq=1 Destination Host Unreachable\nFrom 192.168.1.10 icmp_seq=2 Destination Host Unreachable', caption: b('на этом уровне нет «отказа» — есть только отсутствие ответа.', 'at this level there is no “refusal” — only no answer.') },
      });
      return steps;
    }
    const after = learned.includes('B→2') ? learned : [...learned, 'B→2'];
    steps.push({
      id: 'reply',
      label: b('ответ', 'reply'),
      caption: b('B отвечает кадром на MAC A. Коммутатор записывает «B — за портом 2» и, раз A уже в таблице, отдаёт ответ только в порт 1.', 'B answers with a frame to A’s MAC. The switch writes “B is behind port 2” and, since A is in the table, delivers the answer to port 1 only.'),
      focus: ['p2', 'p1', 'switch'],
      tokens: [{ edge: 'p2', reverse: true, label: '→ A' }, { edge: 'p1', label: '→ A' }],
      states: { b: 'on', c: 'off', d: 'off' },
      values: { switch: table(after) },
      metrics: { flooded: flood ? 3 : 0, entries: after.length },
    });
    steps.push({
      id: 'again',
      label: b('дальше', 'from now'),
      caption: b('Теперь коммутатор знает обоих. Все следующие кадры между A и B идут точно по адресу. Запись живёт 300 секунд с последнего кадра от этого MAC.', 'Now the switch knows both. Every further frame between A and B goes exactly where it should. An entry lives 300 seconds after the last frame from that MAC.'),
      focus: ['p1', 'p2'],
      tokens: [{ edge: 'p1', reverse: true }, { edge: 'p2' }],
      states: { a: 'ok', b: 'ok' },
      metrics: { flooded: flood ? 3 : 0, entries: after.length },
    });
    return steps;
  },
  explainDelta(prev, next, change, _a, bb) {
    if (change.kind === 'break') return change.on ? b('Без B кадр уходит в порт 2 и пропадает: коммутатор об этом не сообщает.', 'Without B the frame goes to port 2 and vanishes: the switch does not report it.') : b('Кабель снова на месте: B отвечает.', 'The cable is back: B answers.');
    const f0 = lastMetric(prev, 'flooded') ?? 0;
    const f1 = lastMetric(next, 'flooded') ?? 0;
    if (change.id === 'table')
      return bb.table === 'warm' ? fmt(b('Таблица уже знает B: копий во все порты {a} → {b}.', 'The table already knows B: flooded copies {a} → {b}.'), { a: f0, b: f1 }) : fmt(b('Пустая таблица: первый кадр к неизвестному MAC уходит во все порты ({b} копии).', 'An empty table: the first frame to an unknown MAC goes out of every port ({b} copies).'), { b: f1 });
    return bb.broadcast ? b('Широковещательный кадр всегда рассылается во все порты, сколько бы коммутатор ни знал.', 'A broadcast frame is always flooded to every port, however much the switch knows.') : b('Кадр снова адресован одному B.', 'The frame is addressed to B alone again.');
  },
});
