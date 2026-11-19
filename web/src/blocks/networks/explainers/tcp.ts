// E-TCP and E-TLS (03 §7.5): sequence diagrams of the TCP handshake and of
// TLS 1.3 on top of it. Time runs downwards; arrows are labelled with the
// fields that travel. Two models: TCP alone (m05) and TCP + TLS + HTTP (m12).

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { DiagramEdge, ElementCard, QText, Step } from '../../../core/types';
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

const clientNode = (sub: string) => node('client', b('Клиент', 'Client'), 'process', [40, 24, 200, 56], card(['Программа, которая подключается: curl, браузер, nginx к бэкенду. Ядро выбрало ей эфемерный порт.', 'The program that connects: curl, a browser, nginx to a backend. The kernel picked an ephemeral port for it.'], ['Вы запустили её.', 'You started it.'], 'ss -tn'), { sub });
const serverNode = (sub: string) => node('server', b('Сервер', 'Server'), 'process', [720, 24, 200, 56], card(['Программа, которая слушает порт: ядро принимает соединения от её имени и кладёт их в очередь.', 'The program listening on a port: the kernel accepts connections on its behalf and queues them.'], ['Служба, запущенная администратором.', 'A service the administrator started.'], 'ss -ltnp', DOC.ssMan), { sub });

// ── TCP ────────────────────────────────────────────────────────────────────

type TP = { port: string; rtt: number };

export const tcpModel = defineModel<TP>({
  id: 'net.tcp',
  block: 'networks',
  title: b('Рукопожатие TCP', 'The TCP handshake'),
  summary: b('Клиент 10.0.0.1 подключается к порту 8080 сервера 10.0.0.2. Время идёт сверху вниз; расстояние по вертикали — задержка.', 'Client 10.0.0.1 connects to port 8080 on server 10.0.0.2. Time runs downwards; vertical distance is delay.'),
  diagram: {
    width: 960,
    height: 440,
    nodes: [clientNode('10.0.0.1:51234'), serverNode('10.0.0.2:8080')],
    edges: [
      msg('syn', 'cs', 0, 'SYN seq=1000', card(['«Хочу соединиться». Номер последовательности клиента 1000 (на деле случайный) и опции: mss 1460, sackOK, TS, wscale 7.', '“I want to connect.” The client’s sequence number 1000 (random in reality) and options: mss 1460, sackOK, TS, wscale 7.'], ['Ядро клиента по вызову connect().', 'The client’s kernel, on connect().'], "tcpdump -n 'tcp[tcpflags] & tcp-syn != 0'", DOC.rfc9293)),
      msg('synack', 'sc', 1, 'SYN-ACK seq=5000 ack=1001', card(['«Согласен, и вот мой номер». ack=1001 подтверждает SYN клиента: следующий ожидаемый байт.', '“Agreed, and here is my number.” ack=1001 confirms the client’s SYN: the next byte expected.'], ['Ядро сервера, если порт кто-то слушает.', 'The server’s kernel, if someone listens on the port.'], undefined, DOC.rfc9293)),
      msg('ack', 'cs', 2, 'ACK ack=5001', card(['Третье сообщение. После него соединение установлено (ESTAB) с обеих сторон.', 'The third message. After it the connection is established (ESTAB) on both sides.'], ['Ядро клиента.', 'The client’s kernel.'], 'ss -tn state established')),
      msg('data', 'cs', 3, 'PSH data (78 B)', card(['Данные приложения, например HTTP-запрос. Каждый байт пронумерован: получатель знает, чего не хватает.', 'Application data, for example an HTTP request. Every byte is numbered: the receiver knows what is missing.'], ['Приложение пишет в сокет, ядро режет на сегменты.', 'The application writes to the socket; the kernel cuts it into segments.'])),
      msg('dack', 'sc', 4, 'ACK + reply', card(['Подтверждение и ответ сервера. Пока подтверждения нет, отправитель хранит копию и повторит её по таймеру.', 'An acknowledgement and the server’s answer. Until it is acknowledged, the sender keeps a copy and retransmits it on a timer.'], ['Ядро и приложение сервера.', 'The server’s kernel and application.'])),
      msg('fin', 'cs', 5, 'FIN / FIN / ACK', card(['Вежливое закрытие: каждая сторона говорит «я всё». Закрывший первым держит сокет в TIME-WAIT 60 секунд.', 'A polite close: each side says “I am done”. The side that closed first keeps the socket in TIME-WAIT for 60 seconds.'], ['Ядро, по close().', 'The kernel, on close().'], 'ss -tan state time-wait')),
      msg('rst', 'sc', 6, 'RST', card(['«Здесь никого нет»: порт никто не слушает. Клиент сразу получает отказ — Connection refused.', '“Nobody here”: no one listens on the port. The client gets a refusal at once — Connection refused.'], ['Ядро сервера.', 'The server’s kernel.'])),
    ],
  },
  params: [
    {
      id: 'port',
      label: b('Порт на сервере', 'The port on the server'),
      kind: 'choice',
      default: 'open',
      options: [
        { id: 'open', label: b('слушают', 'listening') },
        { id: 'closed', label: b('никто не слушает', 'nobody listens') },
      ],
      near: 'server',
      predict: {
        prompt: b('Порт никто не слушает. Как быстро клиент узнает об этом?', 'Nobody listens on the port. How fast does the client learn about it?'),
        options: [
          { id: 'rtt', text: b('Через один RTT: придёт RST', 'After one RTT: an RST arrives') },
          { id: 'long', text: b('Через пару минут ожидания', 'After a couple of minutes of waiting') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'ms') ?? 0) < 10000 ? 'rtt' : 'long'),
      },
    },
    { id: 'rtt', label: b('RTT между машинами', 'RTT between the machines'), kind: 'range', min: 1, max: 300, step: 1, unit: 'ms', default: 40, near: 'synack' },
  ],
  breaks: [
    {
      id: 'filter',
      label: b('Фильтр на сервере молча выбрасывает пакеты', 'A filter on the server silently drops packets'),
      remove: ['synack', 'rst'],
      layer: 'L4',
      predict: {
        prompt: b('На сервере включён фильтр, который молча выбрасывает пакеты на этот порт (как он устроен — в уроке про NAT). Что увидит клиент?', 'A filter on the server silently drops packets to this port (how it works is the NAT lesson). What does the client see?'),
        options: [
          { id: 'timeout', text: b('Долгое ожидание и таймаут', 'A long wait and a timeout') },
          { id: 'refused', text: b('Мгновенный отказ', 'An instant refusal') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'ms') ?? 0) > 10000 ? 'timeout' : 'refused'),
      },
    },
  ],
  metrics: [
    { id: 'ms', label: b('прошло', 'elapsed'), unit: 'ms' },
    { id: 'rtts', label: b('кругов RTT', 'round trips') },
  ],
  run(p, broken): Step[] {
    const r = p.rtt;
    const steps: Step[] = [];
    const off = { synack: 'off', ack: 'off', data: 'off', dack: 'off', fin: 'off', rst: 'off' } as const;
    steps.push({ id: 'syn', label: 'SYN', caption: b('Клиент вызывает connect(). Ядро отправляет SYN со своим начальным номером и состоянием сокета SYN-SENT.', 'The client calls connect(). The kernel sends a SYN with its initial number and puts the socket into SYN-SENT.'), focus: ['syn'], tokens: [{ edge: 'syn', label: 'SYN' }], states: { ...off, client: 'wait' }, values: { client: 'SYN-SENT' }, metrics: { ms: r / 2, rtts: 0 } });
    if (broken.has('filter')) {
      let t = 0;
      for (const gap of [1000, 2000, 4000, 8000]) {
        t += gap;
        steps.push({ id: `re${t}`, label: `+${t / 1000}s`, caption: fmt(b('Ответа нет. Через {g} с ядро повторяет SYN: интервал каждый раз удваивается.', 'No answer. After {g} s the kernel resends the SYN: the interval doubles every time.'), { g: gap / 1000 }), focus: ['syn'], tokens: [{ edge: 'syn', label: 'SYN again' }], metrics: { ms: t, rtts: 0 } });
      }
      steps.push({
        id: 'giveup',
        label: '127 s',
        caption: b('После шести повторов (net.ipv4.tcp_syn_retries = 6) — 1, 2, 4, 8, 16, 32 секунды и ещё 64 секунды ожидания — ядро сдаётся. Всё это время клиент висит в SYN-SENT.', 'After six retries (net.ipv4.tcp_syn_retries = 6) — 1, 2, 4, 8, 16, 32 seconds and another 64 seconds of waiting — the kernel gives up. All that time the client hangs in SYN-SENT.'),
        focus: ['client'],
        states: { client: 'err' },
        metrics: { ms: 127000, rtts: 0 },
        broken: { at: 'server', message: "$ curl --connect-timeout 10 http://10.0.0.2:8080/\ncurl: (28) Failed to connect to 10.0.0.2 port 8080 after 10002 ms: Timeout was reached", caption: b('тишина вместо отказа: молчание — признак фильтра (или выключенной машины), а не закрытого порта.', 'silence instead of a refusal: silence means a filter (or a machine that is off), not a closed port.') },
      });
      return steps;
    }
    if (p.port === 'closed') {
      steps.push({
        id: 'rst',
        label: 'RST',
        caption: b('Порт 8080 никто не слушает. Ядро сервера отвечает RST: «здесь никого нет». Ответ пришёл через один RTT.', 'Nobody listens on port 8080. The server’s kernel answers RST: “nobody here”. The answer arrives after one RTT.'),
        focus: ['rst'],
        tokens: [{ edge: 'rst', label: 'RST' }],
        states: { rst: 'on', client: 'err' },
        values: { client: 'CLOSED' },
        metrics: { ms: r, rtts: 1 },
        broken: { at: 'server', message: "$ curl http://10.0.0.2:8080/\ncurl: (7) Failed to connect to 10.0.0.2 port 8080 after 1 ms: Couldn't connect to server", caption: b('отказ мгновенный: машина жива, сеть работает, просто на этом порту никого нет.', 'the refusal is instant: the machine is alive, the network works, there is just nobody on this port.') },
      });
      return steps;
    }
    steps.push({ id: 'synack', label: 'SYN-ACK', caption: b('Порт слушают. Сервер отвечает SYN-ACK: подтверждает номер клиента (ack = 1001) и сообщает свой.', 'Someone listens. The server answers SYN-ACK: it confirms the client’s number (ack = 1001) and sends its own.'), focus: ['synack'], tokens: [{ edge: 'synack', label: 'SYN-ACK' }], states: { synack: 'on', server: 'on' }, values: { server: 'SYN-RECV' }, metrics: { ms: r, rtts: 1 } });
    steps.push({ id: 'ack', label: 'ACK', caption: fmt(b('Клиент подтверждает номер сервера. Соединение установлено: на это ушёл один круг туда-обратно — {r} мс.', 'The client confirms the server’s number. The connection is established: it took one round trip — {r} ms.'), { r }), focus: ['ack'], tokens: [{ edge: 'ack', label: 'ACK' }], states: { ack: 'on', client: 'ok', server: 'ok' }, values: { client: 'ESTAB', server: 'ESTAB' }, metrics: { ms: r * 1.5, rtts: 1 } });
    steps.push({ id: 'data', label: b('данные', 'data'), caption: b('Теперь можно слать данные. Каждый сегмент несёт номера байтов, получатель подтверждает принятое — потерянное отправитель повторит.', 'Now data can flow. Every segment carries byte numbers, the receiver confirms what it got — the sender retransmits whatever was lost.'), focus: ['data', 'dack'], tokens: [{ edge: 'data', label: 'GET /' }, { edge: 'dack', label: '200 OK' }], states: { data: 'on', dack: 'on' }, metrics: { ms: r * 2.5, rtts: 2 } });
    steps.push({ id: 'fin', label: 'FIN', caption: b('Закрытие: FIN с каждой стороны и подтверждения. Закрывший первым держит сокет в TIME-WAIT ещё 60 секунд, чтобы опоздавшие сегменты не попали в новое соединение.', 'Closing: a FIN from each side and acknowledgements. The side that closed first keeps the socket in TIME-WAIT for 60 more seconds, so that late segments do not land in a new connection.'), focus: ['fin'], tokens: [{ edge: 'fin', label: 'FIN' }], states: { fin: 'on' }, values: { client: 'TIME-WAIT', server: 'CLOSED' }, metrics: { ms: r * 3, rtts: 3 } });
    return steps;
  },
  explainDelta(prev, next, change, a, bb) {
    const m0 = lastMetric(prev, 'ms') ?? 0;
    const m1 = lastMetric(next, 'ms') ?? 0;
    if (change.kind === 'break') return change.on ? b('Фильтр молчит: клиент шлёт SYN снова и снова и через ~127 секунд сдаётся. Таймаут — это не «закрыто», это «никто не ответил».', 'The filter is silent: the client sends SYN again and again and gives up after ~127 seconds. A timeout is not “closed”, it is “nobody answered”.') : b('Фильтр снят: снова либо SYN-ACK, либо RST.', 'The filter is gone: again either SYN-ACK or RST.');
    if (change.id === 'port') return bb.port === 'closed' ? fmt(b('Порт закрыт: RST через {t} мс. Отказ мгновенный — значит, хост жив и до него есть путь.', 'The port is closed: RST after {t} ms. An instant refusal means the host is alive and reachable.'), { t: m1 }) : b('Порт снова слушают: три сообщения — и соединение готово.', 'The port is listened on again: three messages and the connection is ready.');
    return fmt(b('RTT {a} → {b} мс: всё сообщение растягивается, полный обмен {m0} → {m1} мс. Рукопожатие стоит ровно один круг.', 'RTT {a} → {b} ms: the whole exchange stretches, {m0} → {m1} ms. The handshake costs exactly one round trip.'), { a: a.rtt as number, b: bb.rtt as number, m0, m1 });
  },
});

// ── TLS ────────────────────────────────────────────────────────────────────

type LP = { rtt: number; version: string; reuse: boolean };

export function ttfbRtts(p: LP): number {
  if (p.reuse) return 1;
  if (p.version === 'h3') return 2;
  return p.version === '1.2' ? 4 : 3;
}

export const tlsModel = defineModel<LP>({
  id: 'net.tls',
  block: 'networks',
  title: b('HTTPS: TCP, затем TLS, затем HTTP', 'HTTPS: TCP, then TLS, then HTTP'),
  summary: b('curl https://shop.example/ — сколько кругов туда-обратно проходит до первого байта ответа и что видно постороннему.', 'curl https://shop.example/ — how many round trips pass before the first byte of the answer, and what an outsider sees.'),
  diagram: {
    width: 960,
    height: 440,
    nodes: [clientNode('curl, 192.168.1.23'), serverNode('shop.example:443')],
    edges: [
      msg('tsyn', 'cs', 0, 'SYN', card(['Начало TCP-соединения, как в уроке про TCP.', 'The start of a TCP connection, as in the TCP lesson.'], ['Ядро клиента.', 'The client’s kernel.'])),
      msg('tsynack', 'sc', 1, 'SYN-ACK', card(['Ответ сервера; после ACK клиента соединение готово.', 'The server’s answer; after the client’s ACK the connection is ready.'], ['Ядро сервера.', 'The server’s kernel.'])),
      msg('hello', 'cs', 2, 'ClientHello: SNI, ALPN, key_share', card(['Открытым текстом: версии TLS, имя сайта (SNI = shop.example), желаемые протоколы (ALPN: h2, http/1.1) и половина обмена ключами (key_share: X25519MLKEM768, x25519). SNI видит любой на пути.', 'In clear text: TLS versions, the site name (SNI = shop.example), wanted protocols (ALPN: h2, http/1.1) and half of the key exchange (key_share: X25519MLKEM768, x25519). Anyone on the path sees the SNI.'], ['Библиотека TLS в curl (OpenSSL).', 'The TLS library in curl (OpenSSL).'], 'curl -v https://shop.example/', DOC.rfc8446)),
      msg('shello', 'sc', 3, 'ServerHello + {Certificate, Verify, Finished}', card(['Сервер выбирает параметры и отвечает своей половиной ключа. Дальше всё зашифровано: сертификат (открытый ключ, подписанный удостоверяющим центром), подпись CertificateVerify и Finished.', 'The server picks parameters and replies with its half of the key. Everything after that is encrypted: the certificate (a public key signed by a certificate authority), the CertificateVerify signature and Finished.'], ['nginx и его библиотека TLS.', 'nginx and its TLS library.'], 'openssl s_client -connect shop.example:443 -servername shop.example', DOC.rfc8446)),
      msg('cfin', 'cs', 4, '{Finished} + GET /', card(['Клиент проверил сертификат: имя, срок, цепочку до корня, которому доверяет. Шлёт Finished и сразу — зашифрованный HTTP-запрос.', 'The client checked the certificate: the name, the dates, the chain to a root it trusts. It sends Finished and straight away the encrypted HTTP request.'], ['curl.', 'curl.'])),
      msg('resp', 'sc', 5, '{HTTP/1.1 200 OK}', card(['Ответ, зашифрованный. Постороннему видны только адреса, порты, SNI и размеры.', 'The answer, encrypted. An outsider sees only addresses, ports, SNI and sizes.'], ['Приложение за nginx.', 'The application behind nginx.'])),
      msg('alert', 'cs', 6, 'alert: bad certificate', card(['Если проверка не прошла, клиент закрывает соединение с предупреждением; запрос так и не отправлен.', 'If the check fails, the client closes the connection with an alert; the request is never sent.'], ['curl.', 'curl.'])),
    ],
  },
  params: [
    { id: 'rtt', label: b('RTT до сервера', 'RTT to the server'), kind: 'range', min: 1, max: 300, step: 1, unit: 'ms', default: 40, near: 'hello' },
    {
      id: 'version',
      label: b('Протокол', 'Protocol'),
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
        prompt: b('Сервер умеет только TLS 1.2. Сколько кругов RTT пройдёт до первого байта ответа?', 'The server only speaks TLS 1.2. How many round trips pass before the first byte of the answer?'),
        options: [
          { id: '3', text: b('Три, как и с TLS 1.3', 'Three, same as TLS 1.3') },
          { id: '4', text: b('Четыре: у TLS 1.2 рукопожатие на круг длиннее', 'Four: TLS 1.2 has one more handshake round') },
          { id: '2', text: b('Два', 'Two') },
        ],
        resolve: (_p, next) => String(lastMetric(next, 'rtts') ?? 0),
      },
    },
    {
      id: 'reuse',
      label: b('Соединение уже открыто (keep-alive)', 'The connection is already open (keep-alive)'),
      kind: 'toggle',
      default: false,
      near: 'client',
      predict: {
        prompt: b('Второй запрос идёт по уже открытому соединению. Что останется от рукопожатий?', 'The second request goes over an already open connection. What remains of the handshakes?'),
        options: [
          { id: '1', text: b('Ничего: один круг — запрос и ответ', 'Nothing: one round trip — request and answer') },
          { id: '3', text: b('Всё то же самое', 'All the same') },
        ],
        resolve: (_p, next) => String(lastMetric(next, 'rtts') ?? 0),
      },
    },
  ],
  breaks: [
    {
      id: 'expired',
      label: b('Сертификат истёк', 'The certificate has expired'),
      remove: ['cfin', 'resp'],
      layer: 'TLS',
      predict: {
        prompt: b('Срок сертификата вышел вчера. Где остановится процесс?', 'The certificate expired yesterday. Where does the process stop?'),
        options: [
          { id: 'tls', text: b('На проверке сертификата: запрос не уйдёт', 'At the certificate check: the request never leaves') },
          { id: 'tcp', text: b('На TCP: сервер не ответит', 'At TCP: the server will not answer') },
          { id: 'http', text: b('Сервер вернёт ошибку 4xx', 'The server returns a 4xx error') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'client' ? 'tls' : 'tcp'),
      },
    },
    {
      id: 'name',
      label: b('Сертификат на другое имя', 'The certificate is for another name'),
      remove: ['cfin', 'resp'],
      layer: 'TLS',
      predict: {
        prompt: b('Сертификат выписан на www.shop.example, а заходят на shop.example. Что скажет curl?', 'The certificate is for www.shop.example, but users go to shop.example. What does curl say?'),
        options: [
          { id: 'tls', text: b('Ошибку 60: имя не совпадает', 'Error 60: the name does not match') },
          { id: 'ok', text: b('Ничего: домен ведь тот же', 'Nothing: it is the same domain') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'client' ? 'tls' : 'ok'),
      },
    },
  ],
  metrics: [
    { id: 'rtts', label: b('кругов до первого байта', 'round trips to the first byte') },
    { id: 'ttfb', label: b('первый байт', 'first byte'), unit: 'ms' },
  ],
  run(p, broken): Step[] {
    const r = p.rtt;
    const steps: Step[] = [];
    const n = ttfbRtts(p);
    const off = { tsyn: 'off', tsynack: 'off', hello: 'off', shello: 'off', cfin: 'off', resp: 'off', alert: 'off' } as const;
    if (p.reuse) {
      steps.push({ id: 'req', label: 'GET', caption: b('Соединение и TLS-сеанс уже есть: зашифрованный запрос уходит сразу.', 'The connection and the TLS session already exist: the encrypted request goes straight away.'), focus: ['cfin'], tokens: [{ edge: 'cfin', label: '{GET /}' }], states: { ...off, cfin: 'on', client: 'on', server: 'on' }, metrics: { rtts: 0, ttfb: 0 } });
      steps.push({ id: 'resp', label: '200', caption: fmt(b('Ответ через один круг: {t} мс. Повторное использование соединения — самая дешёвая оптимизация.', 'The answer after one round trip: {t} ms. Reusing a connection is the cheapest optimisation there is.'), { t: r }), focus: ['resp'], tokens: [{ edge: 'resp', label: '{200 OK}' }], states: { resp: 'on', client: 'ok' }, metrics: { rtts: 1, ttfb: r } });
      return steps;
    }
    if (p.version === 'h3') {
      steps.push({ id: 'quic', label: 'QUIC Initial', caption: b('HTTP/3 идёт поверх QUIC по UDP 443: транспорт и TLS 1.3 договариваются в одном обмене. Отдельного TCP-рукопожатия нет.', 'HTTP/3 runs over QUIC on UDP 443: transport and TLS 1.3 are negotiated in one exchange. There is no separate TCP handshake.'), focus: ['hello', 'shello'], tokens: [{ edge: 'hello', label: 'Initial' }, { edge: 'shello', label: 'Initial+Handshake' }], states: { ...off, hello: 'on', shello: 'on' }, metrics: { rtts: 1, ttfb: r } });
      steps.push({ id: 'h3req', label: 'GET', caption: fmt(b('Запрос и ответ — второй круг. До первого байта {n} RTT = {t} мс.', 'The request and the answer are the second round trip. {n} RTT = {t} ms to the first byte.'), { n, t: n * r }), focus: ['cfin', 'resp'], tokens: [{ edge: 'cfin', label: '{GET}' }, { edge: 'resp', label: '{200}' }], states: { cfin: 'on', resp: 'on', client: 'ok' }, metrics: { rtts: n, ttfb: n * r } });
      return steps;
    }
    steps.push({ id: 'tcp', label: 'TCP', caption: b('Сначала TCP: SYN, SYN-ACK, ACK — один круг. Шифрования ещё нет.', 'First TCP: SYN, SYN-ACK, ACK — one round trip. No encryption yet.'), focus: ['tsyn', 'tsynack'], tokens: [{ edge: 'tsyn', label: 'SYN' }, { edge: 'tsynack', label: 'SYN-ACK' }], states: { ...off, tsyn: 'on', tsynack: 'on' }, metrics: { rtts: 1, ttfb: r } });
    steps.push({ id: 'hello', label: 'ClientHello', caption: b('ClientHello открытым текстом: имя сайта (SNI), протоколы (ALPN) и половина обмена ключами. Здесь начинается TLS.', 'ClientHello in clear text: the site name (SNI), protocols (ALPN) and half of the key exchange. TLS starts here.'), focus: ['hello'], tokens: [{ edge: 'hello', label: 'SNI shop.example' }], states: { hello: 'on' }, metrics: { rtts: 1, ttfb: r * 1.5 } });
    steps.push({
      id: 'shello',
      label: 'ServerHello',
      caption: p.version === '1.2'
        ? b('В TLS 1.2 обмен ключами занимает два круга: сначала сервер присылает сертификат и параметры, потом клиент — свою часть ключа и Finished.', 'In TLS 1.2 the key exchange takes two round trips: first the server sends the certificate and parameters, then the client its key part and Finished.')
        : b('Сервер отвечает своей половиной ключа — дальше всё зашифровано: сертификат, подпись, Finished. В TLS 1.3 на это уходит один круг.', 'The server answers with its half of the key; everything after is encrypted: the certificate, the signature, Finished. TLS 1.3 needs one round trip for it.'),
      focus: ['shello'],
      tokens: [{ edge: 'shello', label: '{Certificate}' }],
      states: { shello: 'on' },
      metrics: { rtts: p.version === '1.2' ? 3 : 2, ttfb: r * (p.version === '1.2' ? 3 : 2) },
    });
    const bad = broken.has('expired') ? 'expired' : broken.has('name') ? 'name' : null;
    if (bad) {
      steps.push({
        id: 'check',
        label: b('проверка', 'check'),
        caption: bad === 'expired' ? b('Клиент проверяет сертификат: notAfter в прошлом. Он отправляет предупреждение и закрывает соединение. HTTP-запрос не ушёл.', 'The client checks the certificate: notAfter is in the past. It sends an alert and closes the connection. The HTTP request never left.') : b('Клиент сверяет имя: в сертификате только www.shop.example, а он шёл на shop.example. Соединение закрыто до запроса.', 'The client checks the name: the certificate lists only www.shop.example, and it came for shop.example. The connection closes before the request.'),
        focus: ['client', 'alert'],
        tokens: [{ edge: 'alert', label: 'alert' }],
        states: { alert: 'err', client: 'err' },
        metrics: { rtts: 2, ttfb: 0 },
        broken: {
          at: 'client',
          message: bad === 'expired' ? '$ curl https://shop.example/\ncurl: (60) SSL certificate problem: certificate has expired' : "$ curl https://shop.example/\ncurl: (60) SSL: no alternative certificate subject name matches target host name 'shop.example'",
          caption: b('это слой TLS: сеть и сервер в порядке, не прошла проверка подлинности. Код 60 у curl — всегда про сертификат.', 'this is the TLS layer: the network and the server are fine, the authenticity check failed. curl code 60 is always about the certificate.'),
        },
      });
      return steps;
    }
    steps.push({ id: 'fin', label: 'Finished + GET', caption: b('Сертификат в порядке. Клиент шлёт Finished и сразу зашифрованный запрос — не дожидаясь ещё одного круга.', 'The certificate is fine. The client sends Finished and the encrypted request at once, without waiting for another round trip.'), focus: ['cfin'], tokens: [{ edge: 'cfin', label: '{GET /}' }], states: { cfin: 'on' }, metrics: { rtts: n - 1, ttfb: r * (n - 0.5) } });
    steps.push({ id: 'resp', label: '200', caption: fmt(b('Первый байт ответа через {n} RTT = {t} мс: один на TCP, {k} на TLS, один на запрос.', 'The first byte of the answer after {n} RTT = {t} ms: one for TCP, {k} for TLS, one for the request.'), { n, t: n * r, k: n - 2 }), focus: ['resp'], tokens: [{ edge: 'resp', label: '{200 OK}' }], states: { resp: 'on', client: 'ok', server: 'ok' }, metrics: { rtts: n, ttfb: n * r } });
    return steps;
  },
  explainDelta(prev, next, change, a, bb) {
    const t0 = lastMetric(prev, 'ttfb') ?? 0;
    const t1 = lastMetric(next, 'ttfb') ?? 0;
    if (change.kind === 'break') return change.on ? b('Проверка сертификата не прошла: соединение закрыто до HTTP-запроса — это слой TLS, не HTTP.', 'The certificate check failed: the connection closed before the HTTP request — that is the TLS layer, not HTTP.') : b('Сертификат снова в порядке.', 'The certificate is fine again.');
    if (change.id === 'rtt') return fmt(b('RTT {a} → {b} мс: первый байт {t0} → {t1} мс. Из него {h} мс — только рукопожатия.', 'RTT {a} → {b} ms: first byte {t0} → {t1} ms, of which {h} ms are handshakes alone.'), { a: a.rtt as number, b: bb.rtt as number, t0, t1, h: (ttfbRtts(bb) - 1) * (bb.rtt as number) });
    if (change.id === 'reuse') return bb.reuse ? fmt(b('Соединение открыто: рукопожатий нет, первый байт {t0} → {t1} мс.', 'The connection is open: no handshakes, first byte {t0} → {t1} ms.'), { t0, t1 }) : b('Новое соединение: снова TCP и TLS перед запросом.', 'A new connection: TCP and TLS again before the request.');
    return fmt(b('{v}: до первого байта {n} RTT, {t1} мс.', '{v}: {n} RTT to the first byte, {t1} ms.'), { v: bb.version === 'h3' ? 'HTTP/3' : `TLS ${bb.version}`, n: ttfbRtts(bb), t1 });
  },
});
