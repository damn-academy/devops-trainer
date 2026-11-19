// E-TCP and E-TLS (03 §7.5): sequence diagrams of the TCP handshake and of
// TLS 1.3 on top of it. Time runs downwards; arrows are labelled with the
// fields that travel. Two models: TCP alone (m05) and TCP + TLS + HTTP (m12).
//
// Reading order: at the first step only the client, the server and the first
// message are on the diagram; every further message appears when it is sent,
// so the exchange is written down in front of the learner from top to bottom.
// The side that acts says in a callout what it does, and the socket state is
// shown under each side's name.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { DiagramEdge, ElementCard, ElementState, QText, Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

const XC = 140;
const XS = 820;
const Y0 = 112;
const DY = 38;

/** A message arrow of a sequence diagram in slot i (0-based), from client or from server. */
function msg(id: string, dir: 'cs' | 'sc', slot: number, label: QText, c: ElementCard): DiagramEdge {
  const y = Y0 + slot * DY;
  return dir === 'cs' ? edge(id, 'client', 'server', label, c, { via: [[XC, y], [XS, y + 18]], labelAt: 0.5 }) : edge(id, 'server', 'client', label, c, { via: [[XS, y], [XC, y + 18]], labelAt: 0.5 });
}

const hide = (ids: string[]): Record<string, ElementState> => Object.fromEntries(ids.map((id) => [id, 'hidden' as ElementState]));

const clientNode = (sub: string) =>
  node('client', b('Клиент', 'Client'), 'process', [40, 24, 200, 56], card(['Программа, которая подключается к серверу: curl, браузер или nginx, который обращается к приложению. Ядро выбрало для неё временный (эфемерный) порт.', 'The program that connects: curl, a browser, nginx to a backend. The kernel picked an ephemeral port for it.'], ['Программу запустили вы.', 'You started it.'], 'ss -tn'), { sub, icon: 'process' });
const serverNode = (sub: string) =>
  node('server', b('Сервер', 'Server'), 'process', [720, 24, 200, 56], card(['Программа, которая слушает порт. Соединения от её имени принимает ядро и складывает их в очередь, откуда программа их забирает.', 'The program listening on a port: the kernel accepts connections on its behalf and queues them.'], ['Службу запустил администратор.', 'A service the administrator started.'], 'ss -ltnp', DOC.ssMan), { sub, icon: 'server' });

const seqLegend = [
  { mark: 'active' as const, text: b('сторона, которая работает сейчас', 'the side working now') },
  { mark: 'say' as const, text: b('что она делает', 'what it does') },
  { mark: 'token' as const, text: b('сообщение, которое идёт по сети', 'a message on the wire') },
  { mark: 'line' as const, text: b('стрелка сообщения; чем ниже стрелка, тем позже отправлено сообщение', 'a message arrow; lower means later') },
  { mark: 'icon:process' as const, text: b('клиент', 'client') },
  { mark: 'icon:server' as const, text: b('сервер', 'server') },
  { mark: 'ok' as const, text: b('обмен прошёл успешно', 'the exchange succeeded') },
  { mark: 'err' as const, text: b('здесь обмен остановился', 'the exchange stopped here') },
];

// ── TCP ────────────────────────────────────────────────────────────────────

type TP = { port: string; rtt: number };

export const tcpModel = defineModel<TP>({
  id: 'net.tcp',
  block: 'networks',
  title: b('Как клиент и сервер устанавливают соединение TCP', 'The TCP handshake'),
  summary: b(
    'Клиент с адресом 10.0.0.1 подключается к порту 8080 сервера 10.0.0.2. Время на схеме идёт сверху вниз: каждое следующее сообщение рисуется ниже предыдущего, а наклон стрелки показывает, что сообщению нужно время, чтобы дойти. Под названием каждой стороны показано состояние её сокета.',
    'Client 10.0.0.1 connects to port 8080 on server 10.0.0.2. Time runs downwards: every next message is drawn lower, and the slope of an arrow shows that a message takes time to arrive. Under each side’s name you see its socket state.',
  ),
  intro: b(
    'Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждое сообщение появляется на схеме в тот момент, когда его отправляют, а облачко у подсвеченной стороны говорит, что она делает.\n\nПосле первого прохода закройте порт на сервере, растяните время пути между машинами и включите фильтр в блоке «Сломать».',
    'Press “Start from the first step”, then go on with “Step forward” above the diagram. Each message appears when it is sent, and the callout at the highlighted side says what it does.\n\nAfter the first pass close the port on the server, stretch the round-trip time and switch on the filter in “Break it”.',
  ),
  legend: seqLegend,
  stopLabel: b('Соединение не установлено', 'No connection'),
  diagram: {
    width: 960,
    height: 440,
    nodes: [clientNode('10.0.0.1:51234'), serverNode('10.0.0.2:8080')],
    edges: [
      msg('syn', 'cs', 0, 'SYN seq=1000', card(['Сообщение «хочу соединиться». В нём записаны начальный номер последовательности клиента (здесь 1000, а в жизни случайное число) и параметры соединения: mss 1460, sackOK, TS, wscale 7.', '“I want to connect.” The client’s sequence number 1000 (random in reality) and options: mss 1460, sackOK, TS, wscale 7.'], ['Пакет отправляет ядро клиента, когда программа вызывает connect().', 'The client’s kernel, on connect().'], "tcpdump -n 'tcp[tcpflags] & tcp-syn != 0'", DOC.rfc9293)),
      msg('synack', 'sc', 1, 'SYN-ACK seq=5000 ack=1001', card(['Ответ «согласен, и вот мой номер». Поле ack=1001 подтверждает SYN клиента и называет следующий байт, который сервер ждёт.', '“Agreed, and here is my number.” ack=1001 confirms the client’s SYN: the next byte expected.'], ['Ответ отправляет ядро сервера, если порт кто-то слушает.', 'The server’s kernel, if someone listens on the port.'], undefined, DOC.rfc9293)),
      msg('ack', 'cs', 2, 'ACK ack=5001', card(['Третье сообщение рукопожатия. После него соединение установлено, и обе стороны переходят в состояние ESTAB.', 'The third message. After it the connection is established (ESTAB) on both sides.'], ['Пакет отправляет ядро клиента.', 'The client’s kernel.'], 'ss -tn state established')),
      msg('data', 'cs', 3, b('PSH, данные (78 байт)', 'PSH data (78 B)'), card(['Данные программы, например запрос к веб-серверу. Каждый байт пронумерован, поэтому получатель знает, каких байтов не хватает.', 'Application data, for example an HTTP request. Every byte is numbered: the receiver knows what is missing.'], ['Программа пишет данные в сокет, а ядро режет их на сегменты.', 'The application writes to the socket; the kernel cuts it into segments.'])),
      msg('dack', 'sc', 4, b('ACK и ответ', 'ACK + reply'), card(['Подтверждение и ответ сервера. Пока данные не подтверждены, отправитель хранит их копию и повторит отправку по таймеру.', 'An acknowledgement and the server’s answer. Until it is acknowledged, the sender keeps a copy and retransmits it on a timer.'], ['Подтверждение отправляет ядро сервера, а ответ пишет программа.', 'The server’s kernel and application.'])),
      msg('fin', 'cs', 5, 'FIN / FIN / ACK', card(['При аккуратном закрытии соединения каждая сторона сообщает, что больше ничего не отправит. Сторона, закрывшая соединение первой, держит сокет в состоянии TIME-WAIT ещё 60 секунд.', 'A polite close: each side says “I am done”. The side that closed first keeps the socket in TIME-WAIT for 60 seconds.'], ['Пакеты отправляет ядро, когда программа вызывает close().', 'The kernel, on close().'], 'ss -tan state time-wait')),
      msg('rst', 'sc', 6, 'RST', card(['Этим ответом ядро сервера сообщает, что порт никто не слушает. Клиент сразу получает отказ, и curl пишет «Connection refused».', '“Nobody here”: no one listens on the port. The client gets a refusal at once — Connection refused.'], ['Ответ отправляет ядро сервера.', 'The server’s kernel.'])),
    ],
  },
  params: [
    {
      id: 'port',
      group: b('Что происходит на сервере', 'What happens on the server'),
      label: b('Слушает ли программа порт 8080 на сервере', 'The port on the server'),
      kind: 'choice',
      default: 'open',
      options: [
        { id: 'open', label: b('порт слушает служба', 'a service listens') },
        { id: 'closed', label: b('порт никто не слушает', 'nobody listens') },
      ],
      near: 'server',
      predict: {
        prompt: b('Порт 8080 на сервере никто не слушает, а сеть между машинами в порядке. Как быстро клиент узнает об этом?', 'Nobody listens on the port. How fast does the client learn about it?'),
        options: [
          { id: 'rtt', text: b('Через время одного пути туда и обратно, когда придёт ответ RST', 'After one RTT: an RST arrives') },
          { id: 'long', text: b('Через пару минут ожидания', 'After a couple of minutes of waiting') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'ms') ?? 0) < 10000 ? 'rtt' : 'long'),
      },
    },
    { id: 'rtt', group: b('Что происходит в сети', 'What happens on the network'), label: b('Время пути от клиента до сервера и обратно (RTT)', 'RTT between the machines'), kind: 'range', min: 1, max: 300, step: 1, unit: 'ms', default: 40, near: 'synack' },
  ],
  breaks: [
    {
      id: 'filter',
      label: b('Фильтр на сервере молча отбрасывает пакеты на порт 8080', 'A filter on the server silently drops packets'),
      remove: ['synack', 'rst'],
      layer: 'L4',
      predict: {
        prompt: b('На сервере включён фильтр, который молча отбрасывает все пакеты на порт 8080; как такие фильтры устроены, вы узнаете в уроке про NAT. Что увидит клиент?', 'A filter on the server silently drops packets to this port (how it works is the NAT lesson). What does the client see?'),
        options: [
          { id: 'timeout', text: b('Клиент будет долго ждать, пока не истечёт срок ожидания', 'A long wait and a timeout') },
          { id: 'refused', text: b('Клиент сразу получит отказ', 'An instant refusal') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'ms') ?? 0) > 10000 ? 'timeout' : 'refused'),
      },
    },
  ],
  metrics: [
    { id: 'ms', label: b('прошло времени', 'elapsed'), unit: 'ms' },
    { id: 'rtts', label: b('путей туда и обратно', 'round trips') },
  ],
  run(p, broken): Step[] {
    const r = p.rtt;
    const steps: Step[] = [];
    steps.push({
      id: 'syn',
      label: 'SYN',
      caption: b('Программа-клиент вызывает connect(). Ядро клиента отправляет пакет SYN со своим начальным номером и переводит сокет в состояние SYN-SENT, то есть «SYN отправлен».', 'The client calls connect(). The kernel sends a SYN with its initial number and puts the socket into SYN-SENT.'),
      focus: ['client', 'syn'],
      tokens: [{ edge: 'syn', label: 'SYN' }],
      say: { client: b('Клиент отправляет SYN и ждёт ответа сервера.', 'The client sends a SYN and waits for the server.') },
      states: { ...hide(['synack', 'ack', 'data', 'dack', 'fin', 'rst']), client: 'wait' },
      values: { client: 'SYN-SENT' },
      metrics: { ms: r / 2, rtts: 0 },
    });
    if (broken.has('filter')) {
      let t = 0;
      for (const gap of [1000, 2000, 4000, 8000]) {
        t += gap;
        steps.push({
          id: `re${t}`,
          label: `+${t / 1000}s`,
          caption: fmt(b('Ответа всё нет, поэтому через {g} с ядро повторяет SYN, и каждый раз пауза перед повтором удваивается.', 'No answer. After {g} s the kernel resends the SYN: the interval doubles every time.'), { g: gap / 1000 }),
          focus: ['client', 'syn'],
          tokens: [{ edge: 'syn', label: b('повтор SYN', 'SYN again') }],
          say: { client: fmt(b('Клиент не дождался ответа и через {g} с снова отправляет SYN.', 'No answer: the client resends the SYN after {g} s.'), { g: gap / 1000 }) },
          metrics: { ms: t, rtts: 0 },
        });
      }
      steps.push({
        id: 'giveup',
        label: '127 s',
        caption: b('После шести повторов, которые задаёт параметр net.ipv4.tcp_syn_retries = 6, с паузами 1, 2, 4, 8, 16 и 32 секунды и ещё 64 секундами ожидания, ядро прекращает попытки. Всё это время клиент остаётся в состоянии SYN-SENT.', 'After six retries (net.ipv4.tcp_syn_retries = 6) — 1, 2, 4, 8, 16, 32 seconds and another 64 seconds of waiting — the kernel gives up. All that time the client hangs in SYN-SENT.'),
        focus: ['client'],
        say: { client: b('Клиент прекращает попытки и сообщает программе, что срок ожидания истёк.', 'The client gives up and reports a timeout.') },
        states: { client: 'err' },
        metrics: { ms: 127000, rtts: 0 },
        broken: { at: 'server', message: "$ curl --connect-timeout 10 http://10.0.0.2:8080/\ncurl: (28) Failed to connect to 10.0.0.2 port 8080 after 10002 ms: Timeout was reached", caption: b('Вместо отказа клиент получил тишину. Молчание означает, что пакеты отбрасывает фильтр или что машина выключена, а не что порт закрыт.', 'silence instead of a refusal: silence means a filter (or a machine that is off), not a closed port.') },
      });
      return steps;
    }
    if (p.port === 'closed') {
      steps.push({
        id: 'rst',
        label: 'RST',
        caption: b('Порт 8080 никто не слушает, и ядро сервера отвечает пакетом RST, то есть «здесь никого нет». Ответ пришёл за время одного пути туда и обратно.', 'Nobody listens on port 8080. The server’s kernel answers RST: “nobody here”. The answer arrives after one RTT.'),
        focus: ['server', 'rst'],
        tokens: [{ edge: 'rst', label: 'RST' }],
        say: { server: b('Ядро сервера видит, что порт 8080 никто не слушает, и отвечает RST.', 'The server kernel sees nobody on port 8080 and answers RST.') },
        states: { rst: 'on', client: 'err' },
        values: { client: 'CLOSED' },
        metrics: { ms: r, rtts: 1 },
        broken: { at: 'server', message: "$ curl http://10.0.0.2:8080/\ncurl: (7) Failed to connect to 10.0.0.2 port 8080 after 1 ms: Couldn't connect to server", caption: b('Отказ пришёл мгновенно. Значит, машина работает и сеть до неё в порядке, но на этом порту никто не принимает соединения.', 'the refusal is instant: the machine is alive, the network works, there is just nobody on this port.') },
      });
      return steps;
    }
    steps.push({
      id: 'synack',
      label: 'SYN-ACK',
      caption: b('Порт слушает служба, поэтому сервер отвечает пакетом SYN-ACK. В нём он подтверждает номер клиента (ack = 1001) и сообщает свой начальный номер.', 'Someone listens. The server answers SYN-ACK: it confirms the client’s number (ack = 1001) and sends its own.'),
      focus: ['server', 'synack'],
      tokens: [{ edge: 'synack', label: 'SYN-ACK' }],
      say: { server: b('Сервер соглашается на соединение и отвечает SYN-ACK.', 'The server agrees and answers SYN-ACK.') },
      states: { synack: 'on', server: 'on' },
      values: { server: 'SYN-RECV' },
      metrics: { ms: r, rtts: 1 },
    });
    steps.push({
      id: 'ack',
      label: 'ACK',
      caption: fmt(b('Клиент подтверждает номер сервера, и соединение установлено. На рукопожатие ушёл один путь туда и обратно, {r} мс.', 'The client confirms the server’s number. The connection is established: it took one round trip — {r} ms.'), { r }),
      focus: ['client', 'ack'],
      tokens: [{ edge: 'ack', label: 'ACK' }],
      say: { client: b('Клиент подтверждает номер сервера, и обе стороны считают соединение установленным.', 'The client confirms the server’s number; both sides consider the connection established.') },
      states: { ack: 'on', client: 'ok', server: 'ok' },
      values: { client: 'ESTAB', server: 'ESTAB' },
      metrics: { ms: r * 1.5, rtts: 1 },
    });
    steps.push({
      id: 'data',
      label: b('данные', 'data'),
      caption: b('Теперь стороны обмениваются данными. Каждый сегмент несёт номера своих байтов, получатель подтверждает то, что принял, а потерянное отправитель отправит снова.', 'Now data can flow. Every segment carries byte numbers, the receiver confirms what it got — the sender retransmits whatever was lost.'),
      focus: ['data', 'dack', 'server'],
      tokens: [{ edge: 'data', label: 'GET /' }, { edge: 'dack', label: '200 OK' }],
      say: { server: b('Сервер подтверждает полученные байты и отправляет ответ.', 'The server acknowledges the bytes and sends its answer.') },
      states: { data: 'on', dack: 'on' },
      metrics: { ms: r * 2.5, rtts: 2 },
    });
    steps.push({
      id: 'fin',
      label: 'FIN',
      caption: b('Чтобы закрыть соединение, каждая сторона отправляет FIN, а другая его подтверждает. Тот, кто закрыл соединение первым, держит сокет в состоянии TIME-WAIT ещё 60 секунд, чтобы опоздавшие сегменты не попали в новое соединение.', 'Closing: a FIN from each side and acknowledgements. The side that closed first keeps the socket in TIME-WAIT for 60 more seconds, so that late segments do not land in a new connection.'),
      focus: ['client', 'fin'],
      tokens: [{ edge: 'fin', label: 'FIN' }],
      say: { client: b('Клиент закрывает соединение и ещё минуту держит сокет в TIME-WAIT.', 'The client closes and keeps the socket in TIME-WAIT for a minute.') },
      states: { fin: 'on' },
      values: { client: 'TIME-WAIT', server: 'CLOSED' },
      metrics: { ms: r * 3, rtts: 3 },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, bb) {
    const m0 = lastMetric(prev, 'ms') ?? 0;
    const m1 = lastMetric(next, 'ms') ?? 0;
    if (change.kind === 'break')
      return change.on
        ? b('Фильтр молчит, поэтому клиент отправляет SYN снова и снова и примерно через 127 секунд сдаётся. Истёкший срок ожидания означает не «порт закрыт», а «никто не ответил».', 'The filter is silent: the client sends SYN again and again and gives up after ~127 seconds. A timeout is not “closed”, it is “nobody answered”.')
        : b('Фильтр сняли, и сервер снова отвечает либо SYN-ACK, либо RST.', 'The filter is gone: again either SYN-ACK or RST.');
    if (change.id === 'port')
      return bb.port === 'closed'
        ? fmt(b('Порт закрыт, и пакет RST пришёл через {t} мс. Мгновенный отказ означает, что машина работает и путь до неё есть.', 'The port is closed: RST after {t} ms. An instant refusal means the host is alive and reachable.'), { t: m1 })
        : b('Порт снова слушает служба, и после трёх сообщений соединение готово.', 'The port is listened on again: three messages and the connection is ready.');
    return fmt(b('Время пути туда и обратно изменилось с {a} до {b} мс, и весь обмен растянулся с {m0} до {m1} мс. Рукопожатие всегда стоит одного пути туда и обратно.', 'RTT {a} → {b} ms: the whole exchange stretches, {m0} → {m1} ms. The handshake costs exactly one round trip.'), { a: a.rtt as number, b: bb.rtt as number, m0, m1 });
  },
});

// ── TLS ────────────────────────────────────────────────────────────────────

type LP = { rtt: number; version: string; reuse: boolean };

export function ttfbRtts(p: LP): number {
  if (p.reuse) return 1;
  if (p.version === 'h3') return 2;
  return p.version === '1.2' ? 4 : 3;
}

const TLS_ALL = ['tsyn', 'tsynack', 'hello', 'shello', 'cfin', 'resp', 'alert'];

export const tlsModel = defineModel<LP>({
  id: 'net.tls',
  block: 'networks',
  title: b('Как открывается страница по HTTPS: сначала TCP, потом TLS, потом HTTP', 'HTTPS: TCP, then TLS, then HTTP'),
  summary: b(
    'Вы выполняете curl https://shop.example/. Схема показывает, сколько раз сообщения успевают сходить до сервера и обратно, прежде чем придёт первый байт ответа, и что при этом может увидеть посторонний на пути. Подписи в фигурных скобках означают зашифрованные сообщения.',
    'You run curl https://shop.example/. The diagram shows how many round trips pass before the first byte of the answer and what an outsider on the path can see. Labels in curly braces are encrypted messages.',
  ),
  intro: b(
    'Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждое сообщение появляется в тот момент, когда его отправляют, а облачко у подсвеченной стороны говорит, что она делает.\n\nПосле первого прохода растяните время пути до сервера, откройте соединение заранее, переключите версию протокола и включите поломки сертификата в блоке «Сломать».',
    'Press “Start from the first step”, then go on with “Step forward” above the diagram. Each message appears when it is sent, and the callout at the highlighted side says what it does.\n\nAfter the first pass stretch the RTT, open the connection in advance, switch the protocol version and switch on the certificate breaks in “Break it”.',
  ),
  legend: seqLegend,
  stopLabel: b('Запрос не отправлен', 'The request was not sent'),
  diagram: {
    width: 960,
    height: 440,
    nodes: [clientNode('curl, 192.168.1.23'), serverNode('shop.example:443')],
    edges: [
      msg('tsyn', 'cs', 0, 'SYN', card(['Начало соединения TCP, такое же, как в уроке про TCP.', 'The start of a TCP connection, as in the TCP lesson.'], ['Пакет отправляет ядро клиента.', 'The client’s kernel.'])),
      msg('tsynack', 'sc', 1, 'SYN-ACK', card(['Ответ сервера. После пакета ACK от клиента соединение готово.', 'The server’s answer; after the client’s ACK the connection is ready.'], ['Ответ отправляет ядро сервера.', 'The server’s kernel.'])),
      msg('hello', 'cs', 2, 'ClientHello: SNI, ALPN, key_share', card(['Приветствие клиента идёт открытым текстом. В нём перечислены версии TLS, имя сайта (поле SNI, shop.example), протоколы, на которых клиент готов говорить (поле ALPN: h2, http/1.1), и половина обмена ключами (поле key_share: X25519MLKEM768, x25519). Имя сайта из SNI видит любой на пути.', 'In clear text: TLS versions, the site name (SNI = shop.example), wanted protocols (ALPN: h2, http/1.1) and half of the key exchange (key_share: X25519MLKEM768, x25519). Anyone on the path sees the SNI.'], ['Приветствие собирает библиотека TLS внутри curl, например OpenSSL.', 'The TLS library in curl (OpenSSL).'], 'curl -v https://shop.example/', DOC.rfc8446)),
      msg('shello', 'sc', 3, 'ServerHello + {Certificate, Verify, Finished}', card(['Сервер выбирает параметры и отвечает своей половиной ключа, а всё, что идёт дальше, уже зашифровано. Дальше идут сертификат, то есть открытый ключ сервера, подписанный удостоверяющим центром, затем подпись CertificateVerify и сообщение Finished.', 'The server picks parameters and replies with its half of the key. Everything after that is encrypted: the certificate (a public key signed by a certificate authority), the CertificateVerify signature and Finished.'], ['Ответ собирает nginx вместе со своей библиотекой TLS.', 'nginx and its TLS library.'], 'openssl s_client -connect shop.example:443 -servername shop.example', DOC.rfc8446)),
      msg('cfin', 'cs', 4, '{Finished} + GET /', card(['Клиент проверил сертификат: имя, срок действия и цепочку подписей до корневого центра, которому он доверяет. Теперь он отправляет Finished и сразу за ним зашифрованный запрос HTTP.', 'The client checked the certificate: the name, the dates, the chain to a root it trusts. It sends Finished and straight away the encrypted HTTP request.'], ['Сообщения отправляет curl.', 'curl.'])),
      msg('resp', 'sc', 5, '{HTTP/1.1 200 OK}', card(['По этой стрелке идёт зашифрованный ответ, и постороннему на пути видны только адреса, порты, имя сайта из SNI и размеры сообщений.', 'The answer, encrypted. An outsider sees only addresses, ports, SNI and sizes.'], ['Ответ пишет приложение за nginx.', 'The application behind nginx.'])),
      msg('alert', 'cs', 6, 'alert: bad certificate', card(['Если проверка сертификата не прошла, клиент отправляет предупреждение и закрывает соединение, так и не отправив запрос.', 'If the check fails, the client closes the connection with an alert; the request is never sent.'], ['Предупреждение отправляет curl.', 'curl.'])),
    ],
  },
  params: [
    { id: 'rtt', group: b('Соединение', 'The connection'), label: b('Время пути до сервера и обратно (RTT)', 'RTT to the server'), kind: 'range', min: 1, max: 300, step: 1, unit: 'ms', default: 40, near: 'hello' },
    {
      id: 'reuse',
      group: b('Соединение', 'The connection'),
      label: b('Соединение с сервером уже открыто прошлым запросом (keep-alive)', 'The connection is already open (keep-alive)'),
      kind: 'toggle',
      default: false,
      near: 'client',
      predict: {
        prompt: b('Второй запрос идёт по соединению, которое уже открыто и для которого шифрование уже согласовано. Сколько раз сообщения сходят до сервера и обратно до первого байта ответа?', 'The second request goes over an already open connection. What remains of the handshakes?'),
        options: [
          { id: '1', text: b('Один раз, потому что уходит только запрос и приходит ответ', 'Once: the request and the answer') },
          { id: '3', text: b('Три раза, как и для нового соединения', 'Three times, as for a new connection') },
        ],
        resolve: (_p, next) => String(lastMetric(next, 'rtts') ?? 0),
      },
    },
    {
      id: 'version',
      group: b('Протокол', 'Protocol'),
      label: b('Какую версию протокола поддерживает сервер', 'Protocol'),
      kind: 'choice',
      default: '1.3',
      options: [
        { id: '1.3', label: b('TLS 1.3', 'TLS 1.3') },
        { id: '1.2', label: b('TLS 1.2', 'TLS 1.2') },
        { id: 'h3', label: b('HTTP/3 (QUIC)', 'HTTP/3 (QUIC)') },
      ],
      near: 'shello',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: b('Сервер поддерживает только TLS 1.2. Сколько раз сообщения успеют сходить до сервера и обратно, прежде чем придёт первый байт ответа?', 'The server only speaks TLS 1.2. How many round trips pass before the first byte of the answer?'),
        options: [
          { id: '3', text: b('Три раза, как и с TLS 1.3', 'Three, same as TLS 1.3') },
          { id: '4', text: b('Четыре раза, потому что рукопожатие TLS 1.2 на один обмен длиннее', 'Four: TLS 1.2 has one more handshake round') },
          { id: '2', text: b('Два раза, потому что TLS 1.2 проще и короче, чем TLS 1.3', 'Two, because TLS 1.2 is simpler and shorter than TLS 1.3') },
        ],
        resolve: (_p, next) => String(lastMetric(next, 'rtts') ?? 0),
      },
    },
  ],
  breaks: [
    {
      id: 'expired',
      label: b('Срок действия сертификата сервера истёк вчера', 'The certificate has expired'),
      remove: ['cfin', 'resp'],
      layer: 'TLS',
      predict: {
        prompt: b('Срок действия сертификата сервера закончился вчера. На каком шаге остановится загрузка?', 'The certificate expired yesterday. Where does the process stop?'),
        options: [
          { id: 'tls', text: b('На проверке сертификата, и запрос HTTP так и не уйдёт', 'At the certificate check: the request never leaves') },
          { id: 'tcp', text: b('На установке соединения TCP, потому что сервер не ответит', 'At TCP: the server will not answer') },
          { id: 'http', text: b('Сервер вернёт ошибку с кодом 4xx', 'The server returns a 4xx error') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'client' ? 'tls' : 'tcp'),
      },
    },
    {
      id: 'name',
      label: b('Сертификат выписан на другое имя', 'The certificate is for another name'),
      remove: ['cfin', 'resp'],
      layer: 'TLS',
      predict: {
        prompt: b('Сертификат выписан на имя www.shop.example, а пользователи заходят на shop.example. Что напишет curl?', 'The certificate is for www.shop.example, but users go to shop.example. What does curl say?'),
        options: [
          { id: 'tls', text: b('Ошибку с кодом 60, потому что имя не совпадает', 'Error 60: the name does not match') },
          { id: 'ok', text: b('Ничего не напишет, потому что домен тот же', 'Nothing: it is the same domain') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'client' ? 'tls' : 'ok'),
      },
    },
  ],
  metrics: [
    { id: 'rtts', label: b('путей туда и обратно до первого байта', 'round trips to the first byte') },
    { id: 'ttfb', label: b('время до первого байта', 'first byte'), unit: 'ms' },
  ],
  run(p, broken): Step[] {
    const r = p.rtt;
    const steps: Step[] = [];
    const n = ttfbRtts(p);
    if (p.reuse) {
      steps.push({ id: 'req', label: 'GET', caption: b('Соединение уже открыто, и шифрование для него уже согласовано, поэтому зашифрованный запрос уходит сразу.', 'The connection and the TLS session already exist: the encrypted request goes straight away.'), focus: ['client', 'cfin'], tokens: [{ edge: 'cfin', label: '{GET /}' }], say: { client: b('Клиент отправляет зашифрованный запрос по уже открытому соединению.', 'The client sends the encrypted request over the open connection.') }, states: { ...hide(TLS_ALL), cfin: 'on', client: 'on', server: 'on' }, metrics: { rtts: 0, ttfb: 0 } });
      steps.push({ id: 'resp', label: '200', caption: fmt(b('Ответ пришёл через один путь туда и обратно, за {t} мс. Повторно использовать соединение выгоднее всего, потому что никакие рукопожатия повторять не нужно.', 'The answer after one round trip: {t} ms. Reusing a connection is the cheapest optimisation there is.'), { t: r }), focus: ['server', 'resp'], tokens: [{ edge: 'resp', label: '{200 OK}' }], say: { server: b('Сервер отвечает по тому же соединению.', 'The server answers over the same connection.') }, states: { resp: 'on', client: 'ok' }, metrics: { rtts: 1, ttfb: r } });
      return steps;
    }
    if (p.version === 'h3') {
      steps.push({ id: 'quic', label: 'QUIC Initial', caption: b('HTTP/3 работает поверх протокола QUIC на UDP-порту 443, а транспорт и шифрование TLS 1.3 согласуются в одном обмене. Отдельного рукопожатия TCP здесь нет.', 'HTTP/3 runs over QUIC on UDP 443: transport and TLS 1.3 are negotiated in one exchange. There is no separate TCP handshake.'), focus: ['hello', 'shello', 'server'], tokens: [{ edge: 'hello', label: 'Initial' }, { edge: 'shello', label: 'Initial+Handshake' }], say: { server: b('Сервер отвечает на приветствие QUIC и сразу присылает сертификат.', 'The server answers the QUIC hello and sends its certificate.') }, states: { ...hide(TLS_ALL), hello: 'on', shello: 'on' }, metrics: { rtts: 1, ttfb: r } });
      steps.push({ id: 'h3req', label: 'GET', caption: fmt(b('Запрос и ответ занимают второй путь туда и обратно. Всего до первого байта проходит {n} таких пути, то есть {t} мс.', 'The request and the answer are the second round trip. {n} RTT = {t} ms to the first byte.'), { n, t: n * r }), focus: ['cfin', 'resp', 'client'], tokens: [{ edge: 'cfin', label: '{GET}' }, { edge: 'resp', label: '{200}' }], say: { client: b('Клиент отправляет запрос и получает зашифрованный ответ.', 'The client sends the request and gets the encrypted answer.') }, states: { cfin: 'on', resp: 'on', client: 'ok' }, metrics: { rtts: n, ttfb: n * r } });
      return steps;
    }
    steps.push({ id: 'tcp', label: 'TCP', caption: b('Сначала устанавливается соединение TCP: пакеты SYN, SYN-ACK и ACK укладываются в один путь туда и обратно. Шифрования пока нет.', 'First TCP: SYN, SYN-ACK, ACK — one round trip. No encryption yet.'), focus: ['tsyn', 'tsynack', 'server'], tokens: [{ edge: 'tsyn', label: 'SYN' }, { edge: 'tsynack', label: 'SYN-ACK' }], say: { server: b('Сервер принимает соединение TCP.', 'The server accepts the TCP connection.') }, states: { ...hide(TLS_ALL), tsyn: 'on', tsynack: 'on' }, metrics: { rtts: 1, ttfb: r } });
    steps.push({ id: 'hello', label: 'ClientHello', caption: b('Клиент отправляет приветствие ClientHello открытым текстом. В нём имя сайта (SNI), протоколы (ALPN) и половина обмена ключами. С этого сообщения начинается TLS.', 'ClientHello in clear text: the site name (SNI), protocols (ALPN) and half of the key exchange. TLS starts here.'), focus: ['client', 'hello'], tokens: [{ edge: 'hello', label: 'SNI shop.example' }], say: { client: b('Клиент называет имя сайта и предлагает половину ключа.', 'The client names the site and offers half of the key.') }, states: { hello: 'on' }, metrics: { rtts: 1, ttfb: r * 1.5 } });
    steps.push({
      id: 'shello',
      label: 'ServerHello',
      caption:
        p.version === '1.2'
          ? b('В TLS 1.2 обмен ключами занимает два пути туда и обратно: сначала сервер присылает сертификат и параметры, потом клиент отправляет свою часть ключа и Finished.', 'In TLS 1.2 the key exchange takes two round trips: first the server sends the certificate and parameters, then the client its key part and Finished.')
          : b('Сервер отвечает своей половиной ключа, и всё, что идёт дальше, уже зашифровано: сертификат, подпись и Finished. В TLS 1.3 на это уходит один путь туда и обратно.', 'The server answers with its half of the key; everything after is encrypted: the certificate, the signature, Finished. TLS 1.3 needs one round trip for it.'),
      focus: ['server', 'shello'],
      tokens: [{ edge: 'shello', label: '{Certificate}' }],
      say: { server: b('Сервер отвечает своей половиной ключа и присылает сертификат.', 'The server answers with its half of the key and its certificate.') },
      states: { shello: 'on' },
      metrics: { rtts: p.version === '1.2' ? 3 : 2, ttfb: r * (p.version === '1.2' ? 3 : 2) },
    });
    const bad = broken.has('expired') ? 'expired' : broken.has('name') ? 'name' : null;
    if (bad) {
      steps.push({
        id: 'check',
        label: b('проверка', 'check'),
        caption:
          bad === 'expired'
            ? b('Клиент проверяет сертификат и видит, что дата окончания (поле notAfter) уже прошла. Он отправляет предупреждение и закрывает соединение, а запрос HTTP так и не уходит.', 'The client checks the certificate: notAfter is in the past. It sends an alert and closes the connection. The HTTP request never left.')
            : b('Клиент сверяет имя и видит, что в сертификате указано только www.shop.example, а сам он пришёл на shop.example. Соединение закрывается раньше, чем уходит запрос.', 'The client checks the name: the certificate lists only www.shop.example, and it came for shop.example. The connection closes before the request.'),
        focus: ['client', 'alert'],
        tokens: [{ edge: 'alert', label: 'alert' }],
        say: { client: bad === 'expired' ? b('Клиент видит, что срок сертификата истёк, и закрывает соединение.', 'The client sees the certificate has expired and closes.') : b('Клиент видит, что сертификат выписан на другое имя, и закрывает соединение.', 'The client sees the certificate is for another name and closes.') },
        states: { alert: 'err', client: 'err' },
        metrics: { rtts: 2, ttfb: 0 },
        broken: {
          at: 'client',
          message: bad === 'expired' ? '$ curl https://shop.example/\ncurl: (60) SSL certificate problem: certificate has expired' : "$ curl https://shop.example/\ncurl: (60) SSL: no alternative certificate subject name matches target host name 'shop.example'",
          caption: b('Поломка находится в TLS: сеть и сервер в порядке, но сервер не прошёл проверку подлинности. Код 60 у curl всегда означает проблему с сертификатом.', 'this is the TLS layer: the network and the server are fine, the authenticity check failed. curl code 60 is always about the certificate.'),
        },
      });
      return steps;
    }
    steps.push({ id: 'fin', label: 'Finished + GET', caption: b('Сертификат прошёл проверку. Клиент отправляет Finished и сразу за ним зашифрованный запрос, не дожидаясь ещё одного ответа сервера.', 'The certificate is fine. The client sends Finished and the encrypted request at once, without waiting for another round trip.'), focus: ['client', 'cfin'], tokens: [{ edge: 'cfin', label: '{GET /}' }], say: { client: b('Клиент проверил сертификат и отправляет зашифрованный запрос.', 'The client has checked the certificate and sends the encrypted request.') }, states: { cfin: 'on' }, metrics: { rtts: n - 1, ttfb: r * (n - 0.5) } });
    steps.push({ id: 'resp', label: '200', caption: fmt(b('Первый байт ответа приходит через {n} пути туда и обратно, за {t} мс: один путь ушёл на TCP, {k} на TLS и один на сам запрос.', 'The first byte of the answer after {n} RTT = {t} ms: one for TCP, {k} for TLS, one for the request.'), { n, t: n * r, k: n - 2 }), focus: ['server', 'resp'], tokens: [{ edge: 'resp', label: '{200 OK}' }], say: { server: b('Сервер отправляет зашифрованный ответ.', 'The server sends the encrypted answer.') }, states: { resp: 'on', client: 'ok', server: 'ok' }, metrics: { rtts: n, ttfb: n * r } });
    return steps;
  },
  explainDelta(prev, next, change, a, bb) {
    const t0 = lastMetric(prev, 'ttfb') ?? 0;
    const t1 = lastMetric(next, 'ttfb') ?? 0;
    if (change.kind === 'break')
      return change.on
        ? b('Проверка сертификата не прошла, и соединение закрылось раньше, чем ушёл запрос HTTP. Значит, поломка находится в TLS, а не в HTTP.', 'The certificate check failed: the connection closed before the HTTP request — that is the TLS layer, not HTTP.')
        : b('Сертификат снова в порядке.', 'The certificate is fine again.');
    if (change.id === 'rtt') return fmt(b('Время пути изменилось с {a} до {b} мс, а время до первого байта с {t0} до {t1} мс. Из них {h} мс уходят только на рукопожатия.', 'RTT {a} → {b} ms: first byte {t0} → {t1} ms, of which {h} ms are handshakes alone.'), { a: a.rtt as number, b: bb.rtt as number, t0, t1, h: (ttfbRtts(bb) - 1) * (bb.rtt as number) });
    if (change.id === 'reuse')
      return bb.reuse
        ? fmt(b('Соединение уже открыто, рукопожатий нет, и время до первого байта изменилось с {t0} до {t1} мс.', 'The connection is open: no handshakes, first byte {t0} → {t1} ms.'), { t0, t1 })
        : b('Соединение новое, поэтому перед запросом снова нужны рукопожатия TCP и TLS.', 'A new connection: TCP and TLS again before the request.');
    return fmt(b('С протоколом {v} до первого байта проходит {n} пути туда и обратно, то есть {t1} мс.', '{v}: {n} RTT to the first byte, {t1} ms.'), { v: bb.version === 'h3' ? 'HTTP/3' : `TLS ${bb.version}`, n: ttfbRtts(bb), t1 });
  },
});
