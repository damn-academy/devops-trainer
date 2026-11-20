// E-SW (03 §5.3 net.m01): a learning switch. Frames carry MAC addresses;
// the switch remembers behind which port each source MAC is connected and
// floods what it does not know yet.
//
// Reading order: at the first step computer A is working and the switch waits;
// computers B, C and D are pale until a frame reaches them. The block that
// acts says in a callout what it does, the frame travels along the cable as a
// card with its receiver, and the switch table grows under the switch.

import { defineModel } from '../../../core/define';
import { fmt, t } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { b, brokenAt, card, edge, lastMetric, node } from './kit';

type P = { table: string; broadcast: boolean };

const MAC = { a: '02:42:ac:11:00:0a', b: '02:42:ac:11:00:14', c: '02:42:ac:11:00:1e', d: '02:42:ac:11:00:28' };
const NAME = { a: 'A', b: 'B', c: 'C', d: 'D' } as const;
const swCard = card(
  [
    'Коммутатор соединяет кабели одной локальной сети. В каждом кадре он читает только MAC-адреса: адрес отправителя записывает в свою таблицу вместе с номером порта, через который кадр пришёл, а по адресу получателя решает, в какой порт кадр отдать. Под названием коммутатора показана его таблица, а пустые скобки означают, что в таблице пока нет ни одной записи.',
    'A switch joins the cables of one local network. In every frame it reads only the MAC addresses: it writes the sender’s address into its table with the number of the port the frame came in on, and uses the receiver’s address to decide which port gets the frame. The table is shown under the switch’s name; empty brackets mean it has no entries yet.',
  ],
  ['Коммутатор стоит в шкафу офиса или встроен в домашний роутер, а настраивать его не нужно, потому что таблицу он заполняет сам. В Linux ту же работу выполняет мост (bridge).', 'It sits in an office rack or inside a home router and needs no configuration: it fills the table itself. In Linux a bridge does the same job.'],
  'bridge fdb show',
);
const host = (id: 'a' | 'b' | 'c' | 'd', x: number, y: number) =>
  node(
    id,
    b(`Компьютер ${NAME[id]}`, `Computer ${NAME[id]}`),
    'user',
    [x, y, 176, 56],
    card(
      [`Компьютер с сетевой картой. MAC-адрес этой карты, ${MAC[id]}, записал в неё производитель, а у виртуальной машины его назначает система виртуализации.`, `A computer with a network card. Its MAC address ${MAC[id]} was set by the manufacturer, or by the virtualisation system for a virtual machine.`],
      ['MAC-адрес карты задаёт её производитель, а у виртуальной машины его задаёт гипервизор.', 'The card’s manufacturer; for virtual machines, the hypervisor.'],
      'ip link show eth0',
    ),
    { sub: MAC[id], icon: 'terminal' },
  );
// The cable is two-way, but its arrow shows the main direction of the story: A sends to the switch, the switch sends on to the others.
const port = (id: string, host: string, n: number, via?: [number, number][]) =>
  edge(
    id,
    host === 'a' ? 'a' : 'switch',
    host === 'a' ? 'switch' : host,
    b(`порт ${n}`, `port ${n}`),
    card([`Кабель, который соединяет компьютер с портом ${n} коммутатора. По этому кабелю кадры идут в обе стороны.`, `The cable from the computer to port ${n} of the switch. Frames travel both ways along it.`], ['Кабель подключает тот, кто собирает сеть.', 'Whoever builds the network plugs in the cable.']),
    { via, labelAt: 0.6 },
  );

export const switchModel = defineModel<P>({
  id: 'net.switch',
  block: 'networks',
  title: b('Как коммутатор узнаёт, куда отдать кадр', 'How a switch learns where to send a frame'),
  summary: b(
    'Компьютер A отправляет кадр компьютеру B, а все четыре компьютера подключены к одному коммутатору. Схема показывает, как коммутатор заполняет таблицу MAC-адресов и в каком случае рассылает копии кадра во все порты. Бледные компьютеры кадра не получили.',
    'Computer A sends a frame to computer B; all four computers are plugged into one switch. The diagram shows how the switch fills its MAC table and when it sends copies of a frame out of every port. Pale computers did not receive the frame.',
  ),
  intro: b(
    'Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что он делает, а карточка на кабеле показывает, кому адресован кадр. Таблица коммутатора растёт под его названием.\n\nПосле первого прохода выберите заполненную таблицу, отправьте кадр всем и включите в блоке «Сломать» выдернутый кабель.',
    'Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted block says what it does; the card on the cable shows whom the frame is addressed to. The switch table grows under its name.\n\nAfter the first pass choose a filled table, send the frame to everyone and switch on the unplugged cable in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: b('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: b('что этот блок делает', 'what it does') },
    { mark: 'token', text: b('кадр на кабеле и его получатель', 'a frame on the cable and its receiver') },
    { mark: 'icon:terminal', text: b('компьютер', 'computer') },
    { mark: 'icon:switch', text: b('коммутатор', 'switch') },
    { mark: 'pale', text: b('компьютер, которому кадр не достался', 'a computer the frame did not reach') },
    { mark: 'warn', text: b('компьютер получил чужой кадр и выбросил его', 'a computer got someone else’s frame and dropped it') },
    { mark: 'ok', text: b('кадр доставлен', 'the frame was delivered') },
    { mark: 'err', text: b('здесь кадр пропал', 'the frame vanished here') },
  ],
  stopLabel: b('Кадр не доставлен', 'The frame was not delivered'),
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      host('a', 24, 40),
      host('b', 760, 40),
      host('c', 24, 304),
      host('d', 760, 304),
      node('switch', b('Коммутатор', 'Switch'), 'l2', [376, 160, 208, 80], swCard, { sub: ' ', icon: 'switch', work: 'spin' }),
    ],
    edges: [port('p1', 'a', 1), port('p2', 'b', 2), port('p3', 'c', 3), port('p4', 'd', 4)],
  },
  params: [
    {
      id: 'table',
      group: b('Что знает коммутатор', 'What the switch knows'),
      label: b('Таблица MAC-адресов перед первым кадром', 'The MAC table before the first frame'),
      kind: 'choice',
      default: 'empty',
      options: [
        { id: 'empty', label: b('пустая, коммутатор только что включили', 'empty, the switch was just powered on') },
        { id: 'warm', label: b('в ней уже записаны A и B', 'A and B are already in it') },
      ],
      near: 'switch',
      predict: {
        prompt: b('В таблице коммутатора уже записано, что компьютер B подключён к порту 2. В какие порты уйдёт кадр, который A отправляет компьютеру B?', 'The switch table already says that computer B is on port 2. Which ports does a frame from A to B go out of?'),
        options: [
          { id: 'one', text: b('Только в порт 2, потому что коммутатор знает, где B', 'Only port 2, because the switch knows where B is') },
          { id: 'all', text: b('Во все порты, кроме порта 1, на всякий случай', 'Every port except port 1, just in case') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'flooded') ?? 0) > 0 ? 'all' : 'one'),
      },
    },
    {
      id: 'broadcast',
      group: b('Какой кадр отправляет A', 'What frame A sends'),
      label: b('A отправляет кадр всем, на адрес ff:ff:ff:ff:ff:ff', 'A sends the frame to everyone, to ff:ff:ff:ff:ff:ff'),
      kind: 'toggle',
      default: false,
      near: 'switch',
      predict: {
        prompt: b('Компьютер A отправляет кадр на широковещательный адрес ff:ff:ff:ff:ff:ff, а таблица коммутатора уже заполнена. Сколько компьютеров получат копию кадра?', 'Computer A sends a frame to the broadcast address ff:ff:ff:ff:ff:ff, and the switch table is already full. How many computers get a copy?'),
        options: [
          { id: 'no', text: b('Все три остальных компьютера, потому что такой кадр всегда рассылается во все порты', 'All three other computers: such a frame is always sent out of every port') },
          { id: 'yes', text: b('Только компьютер B, потому что таблица уже знает, где он', 'Only computer B, because the table knows where it is') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'flooded') ?? 0) > 0 ? 'no' : 'yes'),
      },
    },
  ],
  breaks: [
    {
      id: 'unplug',
      label: b('Кабель компьютера B выдернут из порта 2', 'B’s cable is pulled out of port 2'),
      remove: ['p2', 'b'],
      layer: 'L1',
      predict: {
        prompt: b('Кабель компьютера B выдернут из коммутатора, и A отправляет компьютеру B кадр. Что A получит от коммутатора или от компьютера B?', 'B’s cable is pulled out of the switch, and A sends B a frame. What does A get from the switch or from computer B?'),
        options: [
          { id: 'none', text: b('Ничего не получит, потому что кадр пропадёт, а коммутатор об этом не сообщит', 'Nothing: the frame vanishes and the switch says nothing') },
          { id: 'error', text: b('Получит от коммутатора сообщение о том, что B недоступен', 'A message from the switch that B is unreachable') },
        ],
        resolve: (_p, next) => (brokenAt(next) ? 'none' : 'error'),
      },
    },
  ],
  metrics: [
    { id: 'flooded', label: b('копий кадра разослано во все порты', 'copies flooded to every port') },
    { id: 'entries', label: b('записей в таблице коммутатора', 'entries in the switch table') },
  ],
  run(p, broken): Step[] {
    const warm = p.table === 'warm';
    const table = (rows: string[]) => (rows.length ? rows.join(' · ') : t(b('таблица пуста', 'table empty')));
    const known = warm ? ['A → 1', 'B → 2'] : [];
    const steps: Step[] = [];
    const dst = p.broadcast ? 'ff:ff:ff:ff:ff:ff' : MAC.b;
    steps.push({
      id: 'send',
      label: b('кадр', 'frame'),
      caption: fmt(
        b(
          'Компьютер A собирает кадр. Первым в нём стоит MAC-адрес получателя {d}, за ним MAC-адрес отправителя {s}, а дальше идут данные. Кадр уходит по кабелю в порт 1 коммутатора.',
          'Computer A builds a frame: the receiver MAC {d} first, then the sender MAC {s}, then the data. The frame goes along the cable into port 1 of the switch.',
        ),
        { d: dst, s: MAC.a },
      ),
      focus: ['a', 'p1'],
      tokens: [{ edge: 'p1', label: p.broadcast ? b('кадр для всех', 'frame for everyone') : b('кадр → B', 'frame → B') }],
      say: { a: p.broadcast ? b('Компьютер A отправляет кадр на адрес ff:ff:ff:ff:ff:ff, то есть всем компьютерам сети.', 'Computer A sends a frame to ff:ff:ff:ff:ff:ff, to every computer on the network.') : b('Компьютер A отправляет кадр на MAC-адрес компьютера B.', 'Computer A sends a frame to B’s MAC address.') },
      states: { a: 'on', b: 'off', c: 'off', d: 'off', p2: 'off', p3: 'off', p4: 'off' },
      values: { switch: table(known) },
      metrics: { flooded: 0, entries: known.length },
    });
    const learned = warm ? known : ['A → 1'];
    steps.push({
      id: 'learn',
      label: b('запись', 'learn'),
      caption: warm
        ? b('Коммутатор читает MAC-адрес отправителя. Компьютер A уже записан в таблице за портом 1, поэтому коммутатор только продлевает срок этой записи.', 'The switch reads the sender MAC. A is already in the table behind port 1, so the switch only extends that entry.')
        : b('Коммутатор читает MAC-адрес отправителя и записывает в таблицу, что компьютер A подключён к порту 1. Так коммутатор учится сам, и настраивать его для этого не нужно.', 'The switch reads the sender MAC and writes into its table that A is on port 1. That is how it learns by itself, with no configuration.'),
      focus: ['switch'],
      say: { switch: warm ? b('Коммутатор видит, что компьютер A уже записан за портом 1, и продлевает запись.', 'The switch sees A is already recorded on port 1 and extends the entry.') : b('Коммутатор записывает в таблицу, что компьютер A подключён к порту 1.', 'The switch writes down that A is on port 1.') },
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
          ? b('Адрес ff:ff:ff:ff:ff:ff означает «всем», поэтому коммутатор копирует кадр во все порты, кроме порта 1, через который кадр пришёл. Заполненная таблица здесь ничего не меняет.', 'The address ff:ff:ff:ff:ff:ff means “everyone”, so the switch copies the frame to every port except port 1, where it came in. A full table changes nothing here.')
          : b('Где подключён компьютер B, коммутатор ещё не знает. Поэтому он рассылает копии кадра во все остальные порты. Компьютер B возьмёт кадр себе, а компьютеры C и D увидят в нём чужой MAC-адрес получателя и выбросят кадр.', 'The switch does not know yet where B is, so it floods copies to every other port. B takes the frame; C and D see someone else’s receiver MAC and drop it.'),
        focus: ['switch', 'p2', 'p3', 'p4'],
        tokens: [{ edge: 'p2', label: b('копия', 'copy') }, { edge: 'p3', label: b('копия', 'copy') }, { edge: 'p4', label: b('копия', 'copy') }],
        say: { switch: p.broadcast ? b('Коммутатор рассылает копии широковещательного кадра во все порты, кроме порта 1.', 'The switch sends copies of the broadcast frame out of every port except port 1.') : b('Коммутатор не знает, где компьютер B, и рассылает копии кадра во все остальные порты.', 'The switch does not know where B is and floods copies to every other port.') },
        states: { p2: 'on', p3: 'on', p4: 'on', b: 'on', c: p.broadcast ? 'on' : 'warn', d: p.broadcast ? 'on' : 'warn' },
        metrics: { flooded: 3, entries: learned.length },
      });
    } else {
      steps.push({
        id: 'forward',
        label: b('в порт 2', 'port 2'),
        caption: b('В таблице записано, что компьютер B подключён к порту 2. Коммутатор отдаёт кадр только в этот порт, и компьютеры C и D этого кадра не видят.', 'The table says B is on port 2. The switch delivers the frame there only; C and D never see it.'),
        focus: ['switch', 'p2'],
        tokens: [{ edge: 'p2', label: b('кадр → B', 'frame → B') }],
        say: { switch: b('Коммутатор находит в таблице порт компьютера B и отдаёт кадр только в порт 2.', 'The switch finds B’s port in the table and delivers the frame to port 2 only.') },
        states: { p2: 'on', b: 'on' },
        metrics: { flooded: 0, entries: learned.length },
      });
    }
    if (broken.has('unplug')) {
      steps.push({
        id: 'silence',
        label: b('тишина', 'silence'),
        caption: b('Кабель компьютера B выдернут, поэтому кадр, отправленный в порт 2, никто не принял. Коммутатор не сообщает об ошибках, и компьютер A так и не дождётся ответа.', 'B’s cable is out, so the frame sent to port 2 reached nobody. A switch reports no errors, and A never gets an answer.'),
        focus: ['p2', 'b'],
        say: { a: b('Компьютер A ждёт ответа от компьютера B, но ответ так и не приходит.', 'Computer A waits for an answer from B, but none comes.') },
        states: { b: 'err', p2: 'err' },
        metrics: { flooded: flood ? 3 : 0, entries: learned.length },
        broken: {
          at: 'b',
          message: '$ ping -c 2 192.168.1.20\nFrom 192.168.1.10 icmp_seq=1 Destination Host Unreachable\nFrom 192.168.1.10 icmp_seq=2 Destination Host Unreachable',
          caption: b('Кадр пропал на кабеле к компьютеру B. Коммутатор никого не предупредил, потому что на уровне кадров сеть об отказах не сообщает, и кадр либо доходит, либо пропадает молча. Строки «Destination Host Unreachable» в выводе ping печатает не коммутатор, а ядро самого компьютера A: оно спросило сеть, у кого адрес 192.168.1.20, не дождалось ответа и поэтому сообщает, что сосед недоступен. Как устроен этот вопрос, подробно расскажет урок про ARP, а здесь важно, что адрес отправителя в этих строках, 192.168.1.10, принадлежит самому компьютеру A.', 'The frame vanished on the cable to B. The switch warned nobody: at this level of the network there is no refusal, only no answer. The “Destination Host Unreachable” lines in the ping output are printed not by the switch but by the kernel of computer A itself: it asked the network who has 192.168.1.20, got no answer and so reports the neighbour unreachable. The ARP lesson explains that question in detail; what matters here is that the sender address in these lines, 192.168.1.10, belongs to computer A itself.'),
        },
      });
      return steps;
    }
    const after = learned.includes('B → 2') ? learned : [...learned, 'B → 2'];
    steps.push({
      id: 'reply',
      label: b('ответ', 'reply'),
      caption: b('Компьютер B отвечает кадром на MAC-адрес компьютера A. Коммутатор записывает в таблицу, что B подключён к порту 2, а так как A в таблице уже есть, отдаёт ответ только в порт 1.', 'B answers with a frame to A’s MAC. The switch writes that B is on port 2 and, since A is already in the table, delivers the answer to port 1 only.'),
      focus: ['switch', 'p2', 'p1'],
      tokens: [{ edge: 'p2', reverse: true, label: b('ответ → A', 'answer → A') }, { edge: 'p1', reverse: true, label: b('ответ → A', 'answer → A') }],
      say: { switch: b('Коммутатор записывает, что компьютер B подключён к порту 2, и отдаёт ответ только в порт 1.', 'The switch writes that B is on port 2 and delivers the answer to port 1 only.') },
      states: { b: 'ok', c: 'off', d: 'off', p3: 'off', p4: 'off' },
      values: { switch: table(after) },
      metrics: { flooded: flood ? 3 : 0, entries: after.length },
    });
    steps.push({
      id: 'again',
      label: b('дальше', 'from now'),
      caption: b('Теперь коммутатор знает порты обоих компьютеров, и все следующие кадры между A и B идут только по нужным портам. Каждая запись хранится 300 секунд, то есть пять минут, после последнего кадра с этим MAC-адресом.', 'Now the switch knows both, and every further frame between A and B goes only to the right ports. Each entry is kept 300 seconds, five minutes, after the last frame from that MAC.'),
      focus: ['p1', 'p2'],
      tokens: [{ edge: 'p1', label: b('кадр → B', 'frame → B') }, { edge: 'p2', label: b('кадр → B', 'frame → B') }],
      say: { switch: b('Коммутатор знает порты обоих компьютеров и больше не рассылает их кадры во все порты.', 'The switch knows both ports and no longer floods their frames.') },
      states: { a: 'ok', b: 'ok', switch: 'ok' },
      metrics: { flooded: flood ? 3 : 0, entries: after.length },
    });
    return steps;
  },
  explainDelta(prev, next, change, _a, bb) {
    if (change.kind === 'break')
      return change.on
        ? b('Без компьютера B кадр уходит в порт 2 и пропадает, а коммутатор никому об этом не сообщает.', 'Without B the frame goes to port 2 and vanishes, and the switch tells nobody.')
        : b('Кабель снова подключён, и компьютер B отвечает на кадр.', 'The cable is back, and B answers the frame.');
    const f0 = lastMetric(prev, 'flooded') ?? 0;
    const f1 = lastMetric(next, 'flooded') ?? 0;
    if (change.id === 'table')
      return bb.table === 'warm'
        ? fmt(b('В таблице уже записан компьютер B, поэтому число копий, разосланных во все порты, изменилось с {a} до {b}.', 'The table already knows B, so the copies flooded to every port went from {a} to {b}.'), { a: f0, b: f1 })
        : fmt(b('Таблица пуста, поэтому первый кадр к незнакомому MAC-адресу коммутатор разослал во все порты: получилось {b} копии.', 'The table is empty, so the first frame to an unknown MAC went out of every port: {b} copies.'), { b: f1 });
    return bb.broadcast
      ? b('Широковещательный кадр коммутатор рассылает во все порты, сколько бы он ни знал о компьютерах сети.', 'A broadcast frame is sent out of every port, however much the switch knows.')
      : b('Кадр снова адресован одному компьютеру B.', 'The frame is addressed to B alone again.');
  },
});
