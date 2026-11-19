// E-URL (03 §7.10): "what happens when you type a URL" — the spine of the
// block. Every layer the learner met works together here: browser cache, ARP,
// DNS with caches, NAT, TCP, TLS, HTTP, the CDN, the reverse proxy and the
// application. Knobs change caches and the scheme; breaks stop the load where
// it would really stop and show what the browser and the tools would print.
//
// Reading order: at the first step only the browser is on the diagram; every
// other participant appears when the load reaches it, so the path is built in
// front of the learner. The participant that works says in a callout what it
// does, and what it hands to the next one travels along the line as a card. A beginner gets three knobs (cache, scheme, CDN cache);
// the DNS caches, HTTP versions, the open connection and the RTT open from the
// intermediate level up.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { ElementState, Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { cache: boolean; dns: string; scheme: string; version: string; cdnHit: boolean; keepalive: boolean; rtt: number };

export interface Waterfall {
  dns: number;
  connect: number;
  tls: number;
  ttfb: number;
  total: number;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Everyone except the browser is off the picture until the load reaches them. */
const HIDDEN: Record<string, ElementState> = Object.fromEntries(
  ['router', 'resolver', 'root', 'tld', 'auth', 'cdn', 'lb', 'app', 'db', 'e-wifi', 'e-dns', 'e-root', 'e-tld', 'e-auth', 'e-edge', 'e-origin', 'e-app', 'e-db'].map((id) => [id, 'hidden' as ElementState]),
);
const ADVANCED = ['intermediate', 'experienced'] as const;

export const urlModel = defineModel<P>({
  id: 'net.url',
  block: 'networks',
  title: b('Что происходит, когда вы вводите адрес сайта', 'What happens when you type a URL'),
  summary: b(
    'Что происходит после того, как пользователь набрал в браузере https://shop.example/catalog и нажал Enter: браузер узнаёт адрес сайта у серверов DNS, открывает соединение с ближайшим узлом CDN, получает страницу и рисует её. Под схемой копится водопад времени, как во вкладке Network в DevTools.',
    'What happens after the user types https://shop.example/catalog and presses Enter: the browser learns the site’s address from DNS servers, opens a connection to the nearest CDN edge, gets the page and draws it. The waterfall under the diagram grows as in the Network tab of DevTools.',
  ),
  intro: b(
    'Схема соберётся по шагам: сейчас на ней только браузер. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» или нажмите «Проиграть» над схемой. Новый участник появляется, когда до него доходит загрузка. Облачко у подсвеченного участника говорит, что он делает, а карточка на линии показывает, что он передаёт следующему.\n\nПосле первого прохода включайте по одной поломке в блоке «Сломать» и смотрите, на каком шаге загрузка остановится.',
    'The diagram builds itself step by step: now it shows only the browser. Press “Start from the first step”, then go on with “Step forward” or press “Play” above the diagram. A participant appears when the load reaches it. The callout at the highlighted participant says what it does; the card on the line shows what it hands on.\n\nAfter the first pass switch on the breaks in “Break it” one at a time and see at which step the load stops.',
  ),
  legend: [
    { mark: 'active', text: b('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: b('что он делает', 'what it does') },
    { mark: 'token', text: b('что он передаёт следующему: вопрос, ответ, пакет', 'what it hands on: a question, an answer, a packet') },
    { mark: 'icon:browser', text: b('браузер', 'browser') },
    { mark: 'icon:router', text: b('домашний роутер', 'home router') },
    { mark: 'icon:dns', text: b('серверы DNS', 'DNS servers') },
    { mark: 'icon:cloud', text: b('узел CDN', 'CDN edge') },
    { mark: 'icon:server', text: b('сервер сайта', 'the site’s server') },
    { mark: 'ok', text: b('участник отработал успешно', 'done successfully') },
    { mark: 'err', text: b('здесь загрузка остановилась', 'the load stopped here') },
  ],
  stopLabel: b('Загрузка остановилась', 'The load stopped'),
  diagram: {
    width: 960,
    height: 480,
    nodes: [
      node('browser', b('Браузер', 'Browser'), 'user', [16, 200, 136, 64], card(['Браузер разбирает адрес на части: схему (https), имя сайта (shop.example), порт (для https по умолчанию 443) и путь (/catalog). Потом он проверяет, нет ли страницы в его кэше и не открыто ли уже соединение с этим сайтом.', 'Splits the URL into the scheme (https), the name (shop.example), the port (443 by default) and the path (/catalog), checks its cache and open connections.'], ['Браузер запускаете вы.', 'You.'], 'curl -v https://shop.example/catalog', DOC.curlMan), { sub: '192.168.1.23', icon: 'browser', work: 'dots' }),
      node('router', b('Роутер с NAT', 'Router, NAT'), 'l3', [184, 200, 128, 64], card(['Шлюз по умолчанию, через который ноутбук выходит в интернет. Перед первым пакетом ноутбук узнаёт MAC-адрес роутера с помощью ARP, а сам роутер на выходе заменяет в пакетах адрес отправителя своим внешним адресом. Эта замена и называется NAT.', 'The default gateway. Before the first packet the laptop learns its MAC with ARP; on the way out the router rewrites the source address (NAT).'], ['Роутер настраивает провайдер или вы сами.', 'The provider or you.'], 'ip neigh', DOC.ipNeigh), { sub: '203.0.113.7', icon: 'router' }),
      node('resolver', b('Резолвер DNS', 'Resolver'), 'l7', [184, 352, 128, 56], card(['Рекурсивный DNS-резолвер провайдера. Он сам обходит серверы DNS от корневого до сервера сайта и запоминает каждый ответ на то время, которое указано в поле TTL этого ответа.', 'The provider’s recursive DNS resolver: it walks the hierarchy and caches answers for their TTL.'], ['Резолвер держит провайдер.', 'The provider.'], 'dig shop.example', DOC.digMan), { sub: '203.0.113.53', icon: 'dns', work: 'spin' }),
      node('root', b('Корневой сервер', 'root .'), 'l7', [420, 296, 168, 48], card(['Корневой сервер DNS. Адреса shop.example он не знает, но подсказывает, какие серверы отвечают за зону example.', 'A root server: refers to the servers of the example. zone.'], ['Корневые серверы держат несколько организаций-операторов.', 'The root operators.'], 'dig +trace shop.example'), { icon: 'dns' }),
      node('tld', b('Сервер зоны example.', 'example. zone'), 'l7', [420, 356, 168, 48], card(['Сервер зоны первого уровня example. Адреса он тоже не знает, но подсказывает, какой сервер хранит записи зоны shop.example.', 'The top-level zone server: refers to the authoritative server of shop.example.'], ['Сервер держит регистратура зоны.', 'The registry.']), { icon: 'dns' }),
      node('auth', 'ns1.hosting', 'l7', [420, 416, 168, 48], card(['Авторитативный сервер зоны shop.example, то есть сервер, который хранит её записи. Он отвечает A-записью с адресом сайта и сроком, в течение которого ответ можно хранить (TTL).', 'The authoritative server of zone shop.example: answers with the A record and its TTL.'], ['Сервер держит хостинг сайта.', 'The site’s hosting.']), { icon: 'dns' }),
      node('cdn', b('Узел CDN', 'CDN edge'), 'l7', [496, 200, 144, 64], card(['Ближайший к пользователю сервер сети доставки контента (CDN). Имя сайта в DNS указывает именно на него, поэтому соединение TCP и шифрование TLS браузер устанавливает с ним. Если страница есть в его кэше (HIT), узел отдаёт её сам, а если её нет (MISS), запрашивает страницу у сервера сайта.', 'The CDN server nearest to the user. The site’s DNS name points here; the user’s TCP and TLS end here. It serves from cache (HIT) or goes to the origin (MISS).'], ['Узел держит компания, которая продаёт услуги CDN.', 'The CDN company.'], 'curl -sI https://shop.example/catalog', DOC.cfCdn), { sub: '198.51.100.20', icon: 'cloud' }),
      node('lb', 'nginx', 'l7', [672, 200, 128, 64], card(['Обратный прокси nginx перед приложением в дата-центре сайта. Вместе с приложением его называют origin, то есть источником страницы. nginx добавляет к запросу заголовок X-Forwarded-For с адресом пользователя и передаёт запрос приложению.', 'The reverse proxy in front of the application in the data centre (the origin). Adds X-Forwarded-For and passes the request to a backend.'], ['nginx настраивает администратор сайта.', 'The administrator.'], 'tail /var/log/nginx/access.log', DOC.nginxProxy), { sub: 'origin', icon: 'server' }),
      node('app', b('Приложение', 'Application'), 'process', [824, 120, 120, 56], card(['Приложение, которое собирает страницу каталога.', 'Builds the catalogue page.'], ['Приложение пишут разработчики сайта.', 'The developers.']), { icon: 'process' }),
      node('db', b('База данных', 'Database'), 'store', [824, 288, 120, 56], card(['База данных, в которой хранится каталог товаров.', 'The catalogue data.'], ['Базу обслуживает администратор баз данных.', 'The DBA.']), { icon: 'database' }),
    ],
    edges: [
      edge('e-wifi', 'browser', 'router', 'Wi-Fi', card(['Первый участок пути, от ноутбука до роутера. Кадры на этом участке адресованы MAC-адресу роутера.', 'The first segment of the path. Frames are addressed to the router’s MAC.'], ['—', '—'], 'tcpdump -n -e')),
      edge('e-dns', 'browser', 'resolver', 'UDP 53', card(['Вопрос, который система ноутбука задаёт резолверу провайдера: какой адрес у имени shop.example (запись A)?', 'The stub resolver’s question to the recursive one: A? shop.example.'], ['Вопрос задаёт библиотека glibc в системе ноутбука.', 'glibc.'], 'tcpdump -n port 53'), { via: [[84, 380]], labelAt: 0.6 }),
      edge('e-root', 'resolver', 'root', b('перенаправление', 'referral'), card(['Ответ корневого сервера: «спросите серверы зоны example., например a.nic.example».', '“ask a.nic.example”.'], ['—', '—']), { via: [[344, 320]], labelAt: 0.7 }),
      edge('e-tld', 'resolver', 'tld', b('перенаправление', 'referral'), card(['Ответ сервера зоны example.: «спросите сервер ns1.hosting.example».', '“ask ns1.hosting.example”.'], ['—', '—'])),
      edge('e-auth', 'resolver', 'auth', 'A 198.51.100.20', card(['Окончательный ответ. Флаг aa показывает, что ответил сервер, который хранит записи зоны, а TTL 300 разрешает хранить ответ пять минут.', 'The answer with the aa flag and TTL 300.'], ['—', '—']), { via: [[344, 440]], labelAt: 0.7 }),
      edge('e-edge', 'router', 'cdn', 'TCP 443 · TLS', card(['Соединение браузера с узлом CDN. Сначала идёт рукопожатие TCP из пакетов SYN, SYN-ACK и ACK, затем сообщение ClientHello, в котором браузер называет имя сайта (поле SNI, shop.example).', 'The user’s connection to the CDN edge: SYN, SYN-ACK, ACK, then ClientHello with SNI shop.example.'], ['Соединение устанавливают ядро системы и библиотека TLS браузера.', 'The kernel and the browser’s TLS library.'], 'curl -v https://shop.example/', DOC.rfc8446)),
      edge('e-origin', 'cdn', 'lb', 'origin', card(['Если страницы нет в кэше, узел CDN сам запрашивает её у сервера сайта по своему соединению, которое обычно открыто заранее.', 'On a cache miss the CDN goes to the origin itself — over its own connection, usually opened in advance.'], ['Запрос отправляет CDN.', 'The CDN.'])),
      edge('e-app', 'lb', 'app', 'proxy_pass', card(['nginx передаёт запрос приложению.', 'nginx passes the request to a backend.'], ['—', '—'], undefined, DOC.nginxNext), { via: [[736, 148]] }),
      edge('e-db', 'app', 'db', 'SQL', card(['Приложение запрашивает данные у базы.', 'A database query.'], ['—', '—'])),
    ],
  },
  params: [
    {
      id: 'scheme',
      group: b('Что набрал пользователь', 'What the user typed'), 
      label: b('Что пользователь набрал в начале адреса', 'The user typed'),
      kind: 'choice',
      default: 'https',
      options: [
        { id: 'https', label: b('https://', 'https://') },
        { id: 'http', label: b('http://', 'http://') },
      ],
      near: 'browser',
      predict: {
        prompt: b('Пользователь набрал адрес http://shop.example, без буквы s. Что ответит сервер?', 'The user typed http://shop.example. What does the server do?'),
        options: [
          { id: 'redirect', text: b('Ответит кодом 301 с заголовком Location: https://…, и браузер начнёт загрузку заново по HTTPS', 'Answer 301 with Location: https://…, and the browser starts over on HTTPS') },
          { id: 'plain', text: b('Отдаст страницу без шифрования', 'Serve the page unencrypted') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'redirect') ? 'redirect' : 'plain'),
      },
    },
    {
      id: 'cache',
      group: b('Что уже лежит в кэшах', 'What is already cached'), 
      label: b('Свежая копия страницы уже лежит в кэше браузера', 'The page is in the browser cache'),
      kind: 'toggle',
      default: false,
      near: 'browser',
      predict: {
        prompt: b('Свежая копия страницы лежит в кэше браузера, и срок, заданный заголовком Cache-Control, ещё не истёк. Сколько пакетов браузер отправит в сеть?', 'The page is in the browser cache and still fresh (Cache-Control). How many packets go to the network?'),
        options: [
          { id: 'none', text: b('Ни одного', 'None') },
          { id: 'dns', text: b('Только запрос к DNS', 'Only a DNS query') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'total') ?? 1) === 0 ? 'none' : 'dns'),
      },
    },
    { id: 'cdnHit', group: b('Что уже лежит в кэшах', 'What is already cached'), label: b('Страница уже лежит в кэше CDN', 'The page is in the CDN cache'), kind: 'toggle', default: false, near: 'cdn' },
    {
      id: 'dns',
      group: b('Что уже лежит в кэшах', 'What is already cached'), 
      label: b('Где уже записан адрес shop.example', 'Where the DNS answer is'),
      kind: 'choice',
      default: 'cold',
      options: [
        { id: 'cold', label: b('нигде, все кэши пусты', 'nowhere (caches empty)') },
        { id: 'resolver', label: b('в кэше резолвера провайдера', 'in the resolver cache') },
        { id: 'os', label: b('в кэше системы ноутбука', 'in the OS cache') },
      ],
      near: 'resolver',
      levels: [...ADVANCED],
    },
    {
      id: 'version',
      group: b('Соединение с узлом CDN', 'The connection to the CDN edge'), 
      label: b('Версия протокола HTTP', 'HTTP version'),
      kind: 'choice',
      default: '1.1',
      near: 'e-edge',
      levels: [...ADVANCED],
      options: [
        { id: '1.1', label: b('HTTP/1.1', 'HTTP/1.1') },
        { id: 'h2', label: b('HTTP/2', 'HTTP/2') },
        { id: 'h3', label: b('HTTP/3 (QUIC)', 'HTTP/3 (QUIC)') },
      ],
      predict: {
        prompt: b('Браузер уже знает, что узел CDN поддерживает HTTP/3. Сколько раз пакеты успеют сходить до узла и обратно, прежде чем браузер отправит сам запрос страницы?', 'The browser already knows the edge speaks HTTP/3. How many round trips to the edge pass before the request itself leaves?'),
        options: [
          { id: 'one', text: b('Один раз: QUIC договаривается о транспорте и шифровании одновременно', 'One: QUIC agrees on the transport and TLS at once') },
          { id: 'two', text: b('Два раза, как TCP и TLS по отдельности', 'Two, as with TCP and TLS') },
          { id: 'zero', text: b('Ни разу, потому что протоколу UDP рукопожатие не нужно', 'None: UDP needs no handshake') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'quic') ? 'one' : 'two'),
      },
    },
    { id: 'keepalive', group: b('Соединение с узлом CDN', 'The connection to the CDN edge'), label: b('Соединение с узлом CDN уже открыто прошлым запросом', 'The connection is already open'), kind: 'toggle', default: false, near: 'e-edge', levels: [...ADVANCED] },
    { id: 'rtt', group: b('Соединение с узлом CDN', 'The connection to the CDN edge'), label: b('Время пути до узла CDN и обратно (RTT)', 'RTT to the CDN edge'), kind: 'range', min: 4, max: 200, step: 2, unit: 'ms', default: 20, near: 'cdn', levels: [...ADVANCED] },
  ],
  breaks: [
    {
      id: 'dns-down',
      label: b('Сервер DNS, который хранит записи сайта, не отвечает', 'The authoritative DNS is down'),
      remove: ['auth', 'e-auth'],
      layer: 'L7',
      predict: {
        prompt: b('Сервер, который хранит записи зоны shop.example, не отвечает, а в кэшах адреса нет. На каком шаге остановится загрузка страницы?', 'The zone’s server for shop.example is not answering and the caches are empty. Where does the load stop?'),
        options: [
          { id: 'dns', text: b('На DNS: браузер не узнает адрес и даже не попытается открыть соединение', 'At DNS: it never gets to TCP') },
          { id: 'tcp', text: b('На установке соединения TCP', 'At TCP') },
          { id: 'http', text: b('Сервер вернёт ошибку с кодом 5xx', 'The server returns a 5xx') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'auth' ? 'dns' : brokenAt(next) === 'cdn' ? 'tcp' : 'http'),
      },
    },
    {
      id: 'fw443',
      label: b('Межсетевой экран молча отбрасывает пакеты на порт 443', 'A firewall drops port 443'),
      remove: ['e-edge'],
      layer: 'L4',
      predict: {
        prompt: b('Межсетевой экран перед CDN молча отбрасывает все пакеты, которые идут на порт 443. Что увидит пользователь?', 'A firewall in front of the CDN silently drops port 443. What does the user see?'),
        options: [
          { id: 'timeout', text: b('Браузер долго ждёт, а потом показывает ERR_CONNECTION_TIMED_OUT', 'A long wait and ERR_CONNECTION_TIMED_OUT') },
          { id: 'refused', text: b('Браузер сразу показывает ERR_CONNECTION_REFUSED', 'ERR_CONNECTION_REFUSED at once') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'total') ?? 0) > 5000 ? 'timeout' : 'refused'),
      },
    },
    {
      id: 'origin-off',
      label: b('Сервер сайта (origin) выключен', 'The origin machine is off'),
      remove: ['lb', 'e-origin'],
      layer: 'L7',
      predict: {
        prompt: b('Сервер сайта выключен, а копии страницы в кэше CDN нет. Какой код ответа получит пользователь и кто этот ответ напишет?', 'The origin is off and the page is not in the CDN cache. Which code does the user get, and from whom?'),
        options: [
          { id: '504', text: b('Код 504, и напишет его узел CDN, который не дождался сервера сайта', '504 from the CDN: it did not wait long enough for the origin') },
          { id: '404', text: b('Код 404, и напишет его сам сайт', '404 from the site') },
          { id: 'none', text: b('Никакого, потому что браузер не сможет подключиться', 'None: the browser cannot connect') },
        ],
        resolve: (_p, next) => (lastMetric(next, 'code') === 504 ? '504' : lastMetric(next, 'code') === 200 ? 'none' : 'none'),
      },
    },
    {
      id: 'cert-expired',
      label: b('Срок сертификата на узле CDN истёк', 'The edge’s certificate has expired'),
      remove: [],
      layer: 'TLS',
      predict: {
        prompt: b('Срок действия сертификата на узле CDN закончился вчера. На каком шаге остановится загрузка?', 'The certificate on the CDN edge expired yesterday. Where does the load stop?'),
        options: [
          { id: 'tls', text: b('На TLS: соединение установится, но браузер не поверит, что говорит с настоящим shop.example', 'At TLS: there is a connection, but the browser will not trust the server') },
          { id: 'tcp', text: b('На TCP: узел не примет соединение', 'At TCP: the edge will not accept the connection') },
          { id: 'none', text: b('Нигде, потому что просроченный сертификат по-прежнему шифрует соединение', 'Nowhere: an expired certificate still encrypts the connection') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'e-edge' ? 'tls' : brokenAt(next) === 'cdn' ? 'tcp' : 'none'),
      },
    },
  ],
  metrics: [
    { id: 'dns', label: b('DNS', 'DNS'), unit: 'ms' },
    { id: 'connect', label: b('TCP', 'TCP'), unit: 'ms' },
    { id: 'tls', label: b('TLS', 'TLS'), unit: 'ms' },
    { id: 'ttfb', label: b('до первого байта', 'first byte'), unit: 'ms' },
    { id: 'total', label: b('всего', 'total'), unit: 'ms' },
    { id: 'code', label: b('код ответа', 'status') },
  ],
  waterfall: 'total',
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const rtt = p.rtt;
    const m = { dns: 0, connect: 0, tls: 0, ttfb: 0, total: 0 };
    const snap = (extra: Record<string, number> = {}) => ({ dns: r1(m.dns), connect: r1(m.connect), tls: r1(m.tls), ttfb: r1(m.ttfb), total: r1(Math.max(m.total, m.dns)), ...extra });
    steps.push({
      id: 'parse',
      label: 'URL',
      caption: p.scheme === 'https' ? b('Вы нажали Enter, и браузер разбирает адрес на части: схема https, имя shop.example, порт 443 (его подразумевает схема https) и путь /catalog.', 'The browser splits the address: scheme https, name shop.example, port 443 (the default for https), path /catalog.') : b('Вы нажали Enter, и браузер разбирает адрес на части: схема http, имя shop.example, порт 80 (его подразумевает схема http) и путь /catalog.', 'Scheme http, name shop.example, port 80, path /catalog.'),
      focus: ['browser'],
      say: { browser: p.scheme === 'https' ? b('Браузер разбирает адрес на части и находит в нём протокол https, имя сайта shop.example, порт 443 и путь /catalog.', 'The browser splits the address: https, shop.example, port 443, /catalog.') : b('Браузер разбирает адрес на части и находит в нём протокол http, имя сайта shop.example, порт 80 и путь /catalog.', 'The browser splits the address: http, shop.example, port 80, /catalog.') },
      states: { ...HIDDEN, browser: 'on' },
      metrics: snap(),
    });
    if (p.cache) {
      steps.push({ id: 'disk', label: b('кэш', 'cache'), caption: b('В кэше браузера лежит свежая копия страницы: срок, заданный заголовком Cache-Control, ещё не истёк. Поэтому браузер не отправляет в сеть ни одного пакета, а в DevTools напротив запроса будет написано «(disk cache)». Быстрее загрузить страницу нельзя.', 'The browser cache has a fresh copy of the page (its Cache-Control has not expired). The request does not go to the network at all: DevTools shows “(disk cache)”. The fastest request is the one that never leaves.'), focus: ['browser'], say: { browser: b('Браузер берёт свежую копию страницы из своего кэша и ничего не отправляет в сеть.', 'The browser takes the fresh copy from its cache and sends nothing.') }, states: { browser: 'ok' }, metrics: snap({ code: 200 }) });
      return steps;
    }
    if (!p.keepalive) steps.push({ id: 'arp', label: 'ARP', caption: b('Чтобы отправить первый пакет, ноутбуку нужен MAC-адрес роутера. Если ноутбук его ещё не знает, он спрашивает всю домашнюю сеть по протоколу ARP: «у кого адрес 192.168.1.1? Ответьте 192.168.1.23».', 'Before the first packet, if the ARP cache is empty, the laptop learns the gateway’s MAC: “who-has 192.168.1.1 tell 192.168.1.23”.'), focus: ['e-wifi', 'router'], tokens: [{ edge: 'e-wifi', label: 'who-has 192.168.1.1' }], say: { router: b('Роутер слышит вопрос ARP и отвечает ноутбуку своим MAC-адресом.', 'The router hears the ARP question and answers with its MAC.') }, states: { router: 'on', 'e-wifi': 'on' }, metrics: snap() });
    if (p.dns === 'os') {
      steps.push({ id: 'dns', label: 'DNS', caption: b('Адрес shop.example уже записан в кэше системы ноутбука (его хранит служба systemd-resolved или nscd), поэтому вопрос в сеть не уходит.', 'The address is in the OS cache (systemd-resolved or nscd): the question goes nowhere.'), focus: ['browser'], say: { browser: b('Система ноутбука находит адрес shop.example в своём кэше, поэтому спрашивать никого не нужно.', 'The laptop finds the address of shop.example in its own cache.') }, values: { browser: '→ 198.51.100.20' }, metrics: snap() });
    } else {
      m.dns += 10;
      steps.push({
        id: 'dns',
        label: 'DNS',
        caption: p.dns === 'resolver' ? b('Система ноутбука спрашивает резолвер провайдера, какой адрес у shop.example. Резолвер недавно уже отвечал на этот вопрос и берёт ответ из своего кэша, на что уходит 10 мс.', 'The stub resolver asks the provider’s resolver; the answer is in its cache: 10 ms.') : b('Система ноутбука спрашивает резолвер провайдера, какой адрес у shop.example. В кэше резолвера ответа нет, поэтому резолвер начинает искать адрес сам.', 'The stub resolver asks the provider’s resolver: A? shop.example. The resolver’s cache is empty.'),
        focus: ['e-dns', 'resolver'],
        tokens: [{ edge: 'e-dns', label: 'A? shop.example' }],
        say: { resolver: p.dns === 'resolver' ? b('Резолвер находит ответ в своём кэше и сразу сообщает браузеру адрес 198.51.100.20.', 'The resolver finds the answer in its cache: 198.51.100.20.') : b('Резолвер ищет адрес shop.example. В его кэше ответа нет, и он идёт спрашивать сам.', 'The resolver looks for shop.example. Its cache is empty, so it asks around.') },
        states: { resolver: 'on', 'e-dns': 'on' },
        values: p.dns === 'resolver' ? { resolver: '→ 198.51.100.20' } : undefined,
        metrics: snap(),
      });
      if (p.dns === 'cold') {
        m.dns += 20;
        steps.push({ id: 'root', label: b('корень', 'root'), caption: b('Резолвер спрашивает корневой сервер. Адреса сайта корневой сервер не знает, но отвечает, какие серверы отвечают за зону example.', 'The resolver asks the root and gets a referral to the example. servers.'), focus: ['e-root', 'root'], tokens: [{ edge: 'e-root', label: 'A? shop.example' }], say: { root: b('Корневой сервер адреса не знает, но подсказывает резолверу, что спрашивать нужно серверы зоны example.', 'The root does not know and answers: “ask the example. servers”.') }, states: { root: 'on', 'e-root': 'on' }, metrics: snap() });
        m.dns += 30;
        steps.push({ id: 'tld', label: 'TLD', caption: b('Резолвер спрашивает сервер зоны example. Этот сервер тоже не знает адреса, но называет сервер, который хранит записи shop.example: ns1.hosting.example.', 'The example. zone server refers to ns1.hosting.example.'), focus: ['e-tld', 'tld'], tokens: [{ edge: 'e-tld', label: 'A? shop.example' }], say: { tld: b('Сервер зоны example отвечает, что записи о shop.example хранит сервер ns1.hosting.', 'The example. server answers: “ns1.hosting keeps shop.example”.') }, states: { tld: 'on', 'e-tld': 'on' }, metrics: snap() });
        if (broken.has('dns-down')) {
          m.dns += 4000;
          m.total = m.dns;
          steps.push({ id: 'servfail', label: 'SERVFAIL', caption: b('Сервер ns1.hosting.example не отвечает. Резолвер ждёт, повторяет вопрос и в конце концов возвращает ошибку SERVFAIL. Адреса сайта у браузера нет, поэтому открывать соединение ему не с кем.', 'The authoritative server is silent. The resolver waits, retries and returns SERVFAIL. The browser has nothing to open: it never got as far as TCP.'), focus: ['resolver', 'e-dns'], tokens: [{ edge: 'e-dns', reverse: true, label: 'SERVFAIL' }], say: { resolver: b('Резолвер так и не дождался ответа от ns1.hosting и возвращает браузеру ошибку SERVFAIL.', 'The resolver got no answer from ns1.hosting and returns SERVFAIL.') }, states: { auth: 'err', resolver: 'warn', browser: 'err', 'e-auth': 'err' }, metrics: snap(), broken: { at: 'auth', message: '$ dig shop.example\n;; ->>HEADER<<- opcode: QUERY, status: SERVFAIL\n\n$ curl https://shop.example/catalog\ncurl: (6) Could not resolve host: shop.example', caption: b('Загрузка остановилась на шаге DNS, потому что браузер так и не узнал адрес сайта. Пользователь увидит сообщение «Не удаётся получить доступ к сайту», а Chrome добавит к нему код ERR_NAME_NOT_RESOLVED.', 'the DNS layer. The browser says “This site can’t be reached” (in Chrome, ERR_NAME_NOT_RESOLVED).') } });
          return steps;
        }
        m.dns += 40;
        steps.push({ id: 'auth', label: 'A', caption: b('Сервер ns1.hosting.example отвечает, что у shop.example адрес 198.51.100.20 и что этот ответ можно хранить 300 секунд, то есть пять минут. Этот адрес принадлежит узлу CDN, а не серверу, на котором работает сайт.', 'The authoritative server answers: A 198.51.100.20, TTL 300 (five minutes). This is the CDN edge’s address, not the site’s own server.'), focus: ['e-auth', 'auth'], tokens: [{ edge: 'e-auth', label: 'A 198.51.100.20', reverse: true }], say: { auth: b('Сервер ns1.hosting хранит записи о shop.example и сообщает резолверу его адрес 198.51.100.20.', 'ns1.hosting knows: shop.example is 198.51.100.20.') }, states: { auth: 'ok', 'e-auth': 'on' }, metrics: snap() });
        steps.push({ id: 'answer', label: b('ответ', 'answer'), caption: b('Резолвер запоминает ответ на пять минут и передаёт адрес браузеру. Теперь браузер знает, куда открывать соединение.', 'The resolver caches the answer for five minutes and hands the address to the browser, which now knows where to connect.'), focus: ['e-dns', 'resolver'], tokens: [{ edge: 'e-dns', label: '198.51.100.20', reverse: true }], say: { resolver: b('Резолвер запоминает ответ и передаёт адрес браузеру.', 'The resolver caches the answer and hands it to the browser.') }, states: { resolver: 'ok' }, values: { resolver: '→ 198.51.100.20' }, metrics: snap() });
      }
    }
    m.total = m.dns;
    const connect = (scheme: string) => {
      steps.push({ id: `nat-${scheme}`, label: 'NAT', caption: b('Первый пакет соединения уходит через роутер. Роутер заменяет в нём адрес отправителя 192.168.1.23:51234 своим внешним адресом 203.0.113.7:40001 и записывает это соответствие в таблицу conntrack, чтобы потом вернуть ответ ноутбуку.', 'The packet leaves through the router: source 192.168.1.23:51234 becomes 203.0.113.7:40001, the mapping is written to conntrack.'), focus: ['router', 'e-wifi'], tokens: [{ edge: 'e-wifi', label: 'SYN' }], say: { router: b('Роутер ставит на пакет свой внешний адрес 203.0.113.7 и запоминает замену, чтобы вернуть ответ ноутбуку.', 'The router puts its public address 203.0.113.7 on the packet and remembers the swap.') }, states: { router: 'on', 'e-wifi': 'on' }, metrics: snap() });
      if (broken.has('fw443') && scheme === 'https') {
        if (p.version === 'h3') {
          m.connect += 3000;
          m.total += 3000;
          steps.push({ id: 'quic-drop', label: 'QUIC…', caption: b('Браузер отправляет на UDP-порт 443 первый пакет QUIC и не получает ответа. Подождав, браузер переходит на TCP, но тот же межсетевой экран отбрасывает и пакеты TCP на порт 443.', 'The Initial packet on UDP 443 leaves and gets no answer. The browser waits and falls back to TCP, but the same firewall drops TCP 443 too.'), focus: ['e-edge', 'browser'], tokens: [{ edge: 'e-edge', label: 'Initial' }], say: { browser: b('Браузер ждёт ответа на пакет QUIC, не дожидается и пробует TCP.', 'The browser waits for a QUIC answer in vain and tries TCP.') }, states: { 'e-edge': 'on', cdn: 'off' }, metrics: snap() });
        }
        m.connect += 127000;
        m.total += 127000;
        steps.push({ id: 'syn-drop', label: 'SYN…', caption: b('Пакет SYN, с которого начинается соединение TCP, уходит на порт 443 и пропадает, потому что межсетевой экран молча его отбрасывает. Система ноутбука повторяет SYN через 1, 2, 4, 8 секунд и дальше, а браузер всё это время показывает индикатор загрузки.', 'The SYN to port 443 leaves and vanishes: the firewall drops it silently. The kernel resends the SYN after 1, 2, 4, 8… seconds. The browser spins for a long time.'), focus: ['e-edge', 'browser'], tokens: [{ edge: 'e-edge', label: 'SYN' }], say: { browser: b('Браузер ждёт ответа на пакет SYN, система ноутбука повторяет этот пакет снова и снова, но ответа так и нет.', 'The browser waits; the laptop resends the SYN again and again. No answer.') }, states: { 'e-edge': 'err', browser: 'err', cdn: 'off' }, metrics: snap(), broken: { at: 'cdn', message: "$ curl --connect-timeout 10 https://shop.example/catalog\ncurl: (28) Failed to connect to shop.example port 443 after 10002 ms: Timeout was reached", caption: b('Загрузка остановилась на шаге TCP. Адрес сайта браузер узнал, но соединение так и не установилось. Когда вместо отказа приходит тишина, пакеты почти всегда отбрасывает межсетевой экран, а Chrome покажет ошибку ERR_CONNECTION_TIMED_OUT.', 'layer L4: the name resolves, the address exists, there is no connection. Silence instead of a refusal is the mark of a filter. Chrome shows ERR_CONNECTION_TIMED_OUT.') } });
        return false;
      }
      if (scheme === 'https' && p.version === 'h3') {
        m.connect += rtt;
        m.total += rtt;
        steps.push({ id: 'quic', label: 'QUIC', caption: fmt(b('Браузер говорит с узлом по протоколу QUIC поверх UDP-порта 443. Уже в первом пакете лежит приветствие TLS с именем сайта, а в ответе узел присылает свой сертификат. Транспорт и шифрование TLS 1.3 договорились за один путь до узла и обратно, за {r} мс, и отдельное рукопожатие TCP не понадобилось.', 'QUIC over UDP 443: the very first Initial packet carries the ClientHello with SNI shop.example, the answer carries the certificate. The transport and TLS 1.3 agree in one round trip, {r} ms: there is no separate TCP handshake.'), { r: rtt }), focus: ['e-edge', 'cdn'], tokens: [{ edge: 'e-edge', label: 'Initial' }, { edge: 'e-edge', reverse: true, label: 'Initial+Handshake' }], say: { cdn: b('Узел CDN отвечает на приветствие QUIC и сразу присылает свой сертификат.', 'The CDN edge answers the QUIC hello and sends its certificate at once.') }, states: { cdn: 'on', 'e-edge': 'on' }, metrics: snap() });
        return certOk();
      }
      m.connect += rtt;
      m.total += rtt;
      steps.push({ id: `tcp-${scheme}`, label: 'TCP', caption: fmt(b('Браузер устанавливает соединение TCP с узлом CDN. Пакеты SYN, SYN-ACK и ACK укладываются в один путь до узла и обратно, это {r} мс.', 'The TCP handshake with the CDN edge: SYN, SYN-ACK, ACK, one round trip, {r} ms.'), { r: rtt }), focus: ['e-edge', 'cdn'], tokens: [{ edge: 'e-edge', label: 'SYN' }, { edge: 'e-edge', reverse: true, label: 'SYN-ACK' }], say: { cdn: b('Узел CDN принимает соединение и отвечает на пакет SYN браузера пакетом SYN-ACK.', 'The CDN edge accepts: it answers the browser’s SYN with SYN-ACK.') }, states: { cdn: 'on', 'e-edge': 'on' }, metrics: snap() });
      if (scheme === 'https') {
        m.tls += rtt;
        m.total += rtt;
        steps.push({ id: 'tls', label: 'TLS 1.3', caption: fmt(b('Теперь браузер и узел договариваются о шифровании по протоколу TLS 1.3. Браузер отправляет приветствие ClientHello с именем сайта, узел отвечает сертификатом, и браузер проверяет в сертификате имя, срок действия и цепочку подписей. На это уходит ещё один путь до узла и обратно, {r} мс. С этого момента провайдер видит только адрес, порт и имя сайта из приветствия.', 'TLS 1.3: ClientHello with SNI shop.example, the server’s answer with the certificate. The browser checks the name, the dates and the chain. One more round trip: {r} ms. The provider sees only the address, the port and the SNI.'), { r: rtt }), focus: ['e-edge', 'browser'], tokens: [{ edge: 'e-edge', label: 'ClientHello' }, { edge: 'e-edge', reverse: true, label: 'Certificate' }], say: { browser: b('Браузер проверяет, выдан ли сертификат узла на имя shop.example, не истёк ли его срок и можно ли доверять подписи.', 'The browser checks the edge’s certificate: the name, the dates, the signatures.') }, metrics: snap() });
        if (p.version === 'h2') steps.push({ id: 'alpn', label: 'ALPN h2', caption: b('В том же обмене браузер и узел выбрали протокол. Браузер предложил в расширении ALPN варианты «h2, http/1.1», а узел выбрал h2. Дальше запросы пойдут двоичными кадрами, и по одному соединению можно будет вести много запросов сразу.', 'In the same exchange the sides chose the protocol: the browser offered “h2, http/1.1” in ALPN, the edge answered “h2”. From now on requests go as binary frames, many streams over one connection.'), focus: ['e-edge', 'cdn'], say: { cdn: b('Узел CDN выбирает HTTP/2 из того, что предложил браузер.', 'The CDN edge picks HTTP/2 from the browser’s offer.') }, metrics: snap() });
        return certOk();
      }
      return true;
    };
    const certOk = () => {
      if (!broken.has('cert-expired')) return true;
      steps.push({ id: 'cert-bad', label: b('сертификат', 'certificate'), caption: b('В сертификате узла дата окончания (поле notAfter) вчерашняя. Браузер отправляет предупреждение TLS и закрывает соединение. Соединение TCP работало и узел отвечал, но доказать, что он и есть shop.example, узел больше не может.', 'The certificate’s notAfter is yesterday. The browser sends a TLS alert and closes the connection: TCP works and the server answers, but it can no longer prove it is shop.example.'), focus: ['e-edge', 'browser'], say: { browser: b('Браузер видит, что срок сертификата истёк вчера, и обрывает соединение.', 'The browser sees the certificate expired yesterday and drops the connection.') }, states: { 'e-edge': 'err', browser: 'err' }, metrics: snap(), broken: { at: 'e-edge', message: '$ curl https://shop.example/catalog\ncurl: (60) SSL certificate problem: certificate has expired', caption: b('Загрузка остановилась на шаге TLS. Адрес найден и соединение открыто, но сертификат узла не прошёл проверку, и Chrome покажет ошибку NET::ERR_CERT_DATE_INVALID.', 'layer TLS: the name, the address and the connection are fine; the certificate check failed. Chrome shows NET::ERR_CERT_DATE_INVALID.') } });
      return false;
    };
    if (p.scheme === 'http') {
      if (!p.keepalive && !connect('http')) return steps;
      m.total += rtt;
      steps.push({ id: 'redirect', label: '301', caption: b('Браузер запрашивает /catalog по порту 80, без шифрования, а сервер отвечает кодом 301 Moved Permanently и заголовком Location: https://shop.example/catalog. Браузер начинает загрузку заново по HTTPS. Если бы сайт включил HSTS, браузер сразу пошёл бы по HTTPS и не тратил время на этот лишний путь до узла и обратно.', 'GET /catalog on port 80: the server answers 301 Moved Permanently, Location: https://shop.example/catalog. The browser starts over on HTTPS (with HSTS it would do that itself, without this extra round trip).'), focus: ['e-edge', 'cdn'], tokens: [{ edge: 'e-edge', label: 'GET :80' }, { edge: 'e-edge', reverse: true, label: '301' }], say: { cdn: b('Узел отвечает кодом 301 и сообщает, что страница переехала на адрес https://shop.example/catalog.', 'The edge answers: “moved to https://shop.example/catalog” (301).') }, states: { cdn: 'on', 'e-edge': 'on' }, metrics: snap() });
    }
    if (!p.keepalive || p.scheme === 'http') {
      if (!connect('https')) return steps;
    } else steps.push({ id: 'reuse', label: b('открыто', 'open'), caption: b('С этим узлом уже открыто соединение, и шифрование для него уже согласовано, поэтому ни ARP, ни TCP, ни TLS повторять не нужно.', 'There is already a connection to this edge with a ready TLS session: no ARP, no TCP, no TLS needed.'), focus: ['e-edge', 'browser'], say: { browser: b('Браузер берёт уже открытое и зашифрованное соединение с узлом CDN.', 'The browser reuses the open, encrypted connection to the edge.') }, states: { router: 'on', cdn: 'on', 'e-wifi': 'on', 'e-edge': 'on' }, metrics: snap() });
    m.total += rtt / 2;
    const reqCaption =
      p.version === 'h2'
        ? b('Браузер отправляет зашифрованный кадр HEADERS в потоке 1: метод GET, путь /catalog, сайт shop.example. Стили и картинки позже пойдут в потоках 3, 5 и 7 по тому же соединению и не будут ждать друг друга.', 'An encrypted HEADERS frame on stream 1: :method GET, :path /catalog, :authority shop.example. Styles and images will later go as streams 3, 5, 7 over the same connection without waiting for each other.')
        : p.version === 'h3'
          ? b('Запрос уходит кадром HEADERS в потоке QUIC внутри зашифрованных пакетов UDP. Если один пакет потеряется, повтора будет ждать только его поток, а остальные запросы продолжат загружаться.', 'The request is a HEADERS frame on a QUIC stream inside encrypted UDP datagrams. If a datagram is lost, only its stream waits, not the whole connection.')
          : b('Браузер отправляет зашифрованный запрос GET /catalog HTTP/1.1 с заголовком Host: shop.example. Провайдер видит только поток зашифрованных данных TLS и не знает, какую страницу вы запросили.', 'The encrypted request: GET /catalog HTTP/1.1, Host: shop.example. To the provider it is just TLS Application Data.');
    steps.push({ id: 'request', label: p.version === '1.1' ? 'GET' : 'HEADERS', caption: reqCaption, focus: ['e-edge', 'browser'], tokens: [{ edge: 'e-edge', label: p.version === '1.1' ? 'GET /catalog' : 'HEADERS /catalog' }], say: { browser: b('Браузер отправляет узлу зашифрованный запрос страницы /catalog.', 'The browser sends the encrypted request for /catalog.') }, metrics: snap() });
    let code = 200;
    if (p.cdnHit) {
      m.total += 1;
      steps.push({ id: 'hit', label: 'HIT', caption: b('Страница есть в кэше CDN, и в ответе будут заголовок X-Cache: HIT и заголовок Age с возрастом копии. Узел отвечает сразу, а сервер сайта даже не узнаёт о запросе.', 'The page is in the CDN cache (X-Cache: HIT; the Age header shows how old it is). The edge answers at once; the origin never hears about the request.'), focus: ['cdn'], say: { cdn: b('Узел CDN находит страницу в своём кэше и отвечает сам, не беспокоя сервер сайта.', 'The edge finds the page in its cache and answers itself.') }, states: { cdn: 'ok' }, metrics: snap() });
    } else {
      steps.push({ id: 'miss', label: 'MISS', caption: b('Страницы в кэше CDN нет (MISS), поэтому узел сам запрашивает её у сервера сайта, то есть у nginx в дата-центре.', 'The page is not in the CDN cache (MISS): the edge goes to the origin itself, to nginx in the data centre.'), focus: ['e-origin', 'cdn'], tokens: [{ edge: 'e-origin', label: 'GET /catalog' }], say: { cdn: b('Страницы в кэше нет, и узел CDN сам просит её у сервера сайта.', 'Not in the cache: the edge asks the site’s server itself.') }, states: { lb: 'on', 'e-origin': 'on' }, metrics: snap() });
      if (broken.has('origin-off')) {
        m.total += 60000;
        code = 504;
        m.ttfb = m.total;
        steps.push({ id: 'origin-dead', label: '504', caption: b('Сервер сайта выключен. Узел CDN отправляет ему SYN и ждёт ответа, а когда истекает его собственный срок ожидания, сдаётся и отвечает пользователю кодом 504. Этот код написал CDN, а сеть пользователя здесь в порядке.', 'The origin is off: the CDN sends a SYN and waits. After its connect timeout the CDN gives up and answers the user 504. The CDN wrote the code; the user’s network is fine.'), focus: ['cdn', 'e-edge'], tokens: [{ edge: 'e-edge', reverse: true, label: '504 Gateway Time-out' }], say: { cdn: b('Узел CDN не дождался сервера сайта и сам пишет браузеру ответ 504.', 'The edge gave up waiting for the origin and writes 504 itself.') }, states: { lb: 'err', cdn: 'warn', browser: 'err', 'e-origin': 'err' }, metrics: snap({ code }), broken: { at: 'lb', message: "$ curl -sI https://shop.example/catalog\nHTTP/1.1 504 Gateway Time-out\nServer: cdn-edge", caption: b('Ошибку браузер получил в ответе HTTP, хотя причина лежит гораздо ниже: сервер сайта не отвечает даже на попытку соединения. Заголовок Server в ответе показывает, кто этот ответ написал, и смотреть на него нужно в первую очередь.', 'layer L7, cause on L3: the origin does not answer. The Server header shows who wrote the answer: the first thing to look at.') } });
        return steps;
      }
      m.total += 20;
      steps.push({ id: 'app', label: b('приложение', 'app'), caption: b('nginx добавляет к запросу заголовок X-Forwarded-For с адресом пользователя и передаёт запрос приложению.', 'nginx adds X-Forwarded-For with the client’s address and passes the request to the application.'), focus: ['lb', 'e-app'], tokens: [{ edge: 'e-app', label: 'GET /catalog' }], say: { lb: b('nginx добавляет адрес пользователя в заголовок X-Forwarded-For и передаёт запрос приложению.', 'nginx adds the user’s address in X-Forwarded-For and passes the request on.') }, states: { app: 'on', 'e-app': 'on' }, metrics: snap() });
      m.total += 100;
      steps.push({ id: 'db', label: 'SQL', caption: b('Приложение запрашивает у базы данных товары каталога и собирает из них страницу. Это самая долгая часть работы сервера.', 'The application asks the database for the catalogue and builds the page: the longest part of the server’s work.'), focus: ['app', 'e-db'], tokens: [{ edge: 'e-db', label: 'SELECT …' }], say: { app: b('Приложение берёт товары из базы данных и собирает страницу каталога.', 'The application takes the goods from the database and builds the page.') }, states: { db: 'on', 'e-db': 'on' }, metrics: snap() });
      steps.push({ id: 'back', label: b('назад', 'back'), caption: b('Готовая страница возвращается от nginx на узел CDN. Узел кладёт её копию в свой кэш, чтобы следующему пользователю ответить сразу, и отправляет страницу браузеру.', 'The page goes back from nginx to the CDN edge, which keeps a copy in its cache for the next user and sends the page to the browser.'), focus: ['e-origin', 'cdn'], tokens: [{ edge: 'e-origin', reverse: true, label: '200 OK' }], say: { cdn: b('Узел CDN получает страницу, кладёт копию в кэш и отправляет её браузеру.', 'The edge gets the page, keeps a copy and sends it on.') }, states: { lb: 'ok', app: 'ok', db: 'ok' }, metrics: snap() });
    }
    m.total += rtt / 2;
    m.ttfb = m.total;
    steps.push({ id: 'response', label: '200', caption: p.version === '1.1' ? b('Ответ HTTP/1.1 200 OK идёт обратно тем же путём. Он приходит от узла CDN на роутер, роутер по таблице conntrack заменяет адрес получателя 203.0.113.7:40001 обратно на 192.168.1.23:51234, и ответ попадает в браузер.', 'The answer HTTP/1.1 200 OK travels back: CDN → router (reverse NAT: 203.0.113.7:40001 → 192.168.1.23:51234 through conntrack) → browser.') : b('Ответ идёт обратно тем же путём. Кадр HEADERS с кодом 200 и кадры DATA с самой страницей приходят от узла CDN на роутер, роутер по таблице conntrack возвращает их ноутбуку, и они попадают в браузер.', 'The answer, a HEADERS frame with :status 200 and DATA frames with the body, travels back: CDN → router (reverse NAT through conntrack) → browser.'), focus: ['e-edge', 'router'], tokens: [{ edge: 'e-edge', reverse: true, label: '200 OK' }], say: { router: b('Роутер по своей таблице находит, что ответ предназначен ноутбуку 192.168.1.23, и передаёт его.', 'The router looks up its table: the answer is for 192.168.1.23.') }, states: { cdn: p.cdnHit ? 'ok' : 'on' }, metrics: snap({ code }) });
    m.total += rtt;
    steps.push({ id: 'render', label: b('отрисовка', 'render'), caption: b('Браузер разбирает HTML, находит в нём стили, скрипты и картинки и запрашивает их по тому же соединению, уже без DNS, TCP и TLS. Страница готова.', 'The browser parses the HTML, finds the CSS, scripts and images and requests them over the same connection, with no DNS, TCP or TLS. The page is ready.'), focus: ['browser', 'e-edge'], tokens: [{ edge: 'e-edge', label: 'GET /app.css' }], say: { browser: b('Браузер рисует страницу и тут же просит у узла стили и картинки по тому же соединению.', 'The browser draws the page and asks for styles and images over the same connection.') }, states: { browser: 'ok' }, metrics: snap({ code }) });
    return steps;
  },
  explainDelta(prev, next, change) {
    const t0 = lastMetric(prev, 'total') ?? 0;
    const t1 = lastMetric(next, 'total') ?? 0;
    if (change.kind === 'break') {
      if (!change.on) return fmt(b('Поломку убрали, и страница снова загружается, всего за {t} мс.', 'The break is removed: the page loads again, {t} ms in total.'), { t: t1 });
      const at = brokenAt(next);
      if (at === 'e-edge') return b('Загрузка остановилась на TLS: соединение установлено, но сертификат просрочен, и браузер прервал рукопожатие.', 'The load stopped at TLS: the connection is up, but the certificate has expired and the browser aborted the handshake.');
      return at === 'auth'
        ? b('Загрузка остановилась на DNS: браузер не узнал адрес сайта, поэтому до соединения TCP дело не дошло.', 'The load stopped at DNS: the name did not become an address — it never got to TCP.')
        : at === 'cdn'
          ? b('Загрузка остановилась на TCP: на пакет SYN никто не ответил, и браузер ждал до конца срока ожидания.', 'The load stopped at TCP: a SYN with no answer, a wait until the timeout.')
          : at === 'lb'
            ? b('Узел CDN не дождался ответа от сервера сайта и вернул пользователю код 504. Сеть пользователя здесь ни при чём.', 'The CDN did not get an answer from the origin and replied 504 — the user’s network has nothing to do with it.')
            : b('Страница пришла из кэша CDN, поэтому пользователь даже не заметил, что сервер сайта выключен.', 'The page came from the CDN cache: the user did not even notice the origin was off.');
    }
    if (change.kind === 'param' && change.id === 'version') {
      if (change.to === 'h3') return fmt(b('С HTTP/3 протокол QUIC объединил рукопожатие транспорта и шифрования в один путь до узла и обратно, и полное время изменилось с {a} до {b} мс.', 'HTTP/3: QUIC merged the transport and TLS handshakes into one round trip — total time {a} → {b} ms.'), { a: t0, b: t1 });
      if (change.to === 'h2') return fmt(b('С HTTP/2 рукопожатия остались теми же, что у HTTP/1.1, но запросы теперь идут кадрами в разных потоках одного соединения. Полное время изменилось с {a} до {b} мс.', 'HTTP/2: the same handshakes as HTTP/1.1, but requests go as frames on the streams of one connection — {a} → {b} ms.'), { a: t0, b: t1 });
      return fmt(b('С HTTP/1.1 рукопожатия TCP и TLS идут по отдельности, а по соединению проходит только один запрос за раз. Полное время изменилось с {a} до {b} мс.', 'HTTP/1.1: separate TCP and TLS handshakes, one request at a time per connection — {a} → {b} ms.'), { a: t0, b: t1 });
    }
    return fmt(b('Полное время загрузки изменилось с {a} до {b} мс. Из них на DNS ушло {d} мс, на соединение TCP {c} мс, на шифрование TLS {s} мс.', 'Total time {a} → {b} ms. DNS {d} ms, TCP {c} ms, TLS {s} ms.'), { a: t0, b: t1, d: lastMetric(next, 'dns') ?? 0, c: lastMetric(next, 'connect') ?? 0, s: lastMetric(next, 'tls') ?? 0 });
  },
});
