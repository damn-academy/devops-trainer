// E-URL (03 §7.10): "what happens when you type a URL" — the spine of the
// block. Every layer the learner met works together here: browser cache, ARP,
// DNS with caches, NAT, TCP, TLS, HTTP, the CDN, the reverse proxy and the
// application. Knobs change caches and the scheme; breaks stop the load where
// it would really stop and show what the browser and the tools would print.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { cache: boolean; dns: string; scheme: string; cdnHit: boolean; keepalive: boolean; rtt: number };

export interface Waterfall {
  dns: number;
  connect: number;
  tls: number;
  ttfb: number;
  total: number;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export const urlModel = defineModel<P>({
  id: 'net.url',
  block: 'networks',
  title: b('Что происходит, когда вводишь URL', 'What happens when you type a URL'),
  summary: b('https://shop.example/catalog — от нажатия Enter до готовой страницы. Под схемой растёт водопад, как в DevTools. Меняй кэши, схему, CDN; ломай DNS, порт 443 и origin.', 'https://shop.example/catalog — from pressing Enter to a rendered page. The waterfall under the diagram grows as in DevTools. Change the caches, the scheme, the CDN; break DNS, port 443 and the origin.'),
  diagram: {
    width: 960,
    height: 480,
    nodes: [
      node('browser', b('Браузер', 'Browser'), 'user', [16, 200, 136, 64], card(['Разбирает URL на схему (https), имя (shop.example), порт (443 по умолчанию) и путь (/catalog), проверяет свой кэш и открытые соединения.', 'Splits the URL into the scheme (https), the name (shop.example), the port (443 by default) and the path (/catalog), checks its cache and open connections.'], ['Вы.', 'You.'], 'curl -v https://shop.example/catalog', DOC.curlMan), { sub: '192.168.1.23' }),
      node('router', b('Роутер, NAT', 'Router, NAT'), 'l3', [184, 200, 128, 64], card(['Шлюз по умолчанию. Перед первым пакетом ноутбук узнаёт его MAC по ARP; на выходе роутер подменяет адрес источника (NAT).', 'The default gateway. Before the first packet the laptop learns its MAC with ARP; on the way out the router rewrites the source address (NAT).'], ['Провайдер или вы.', 'The provider or you.'], 'ip neigh', DOC.ipNeigh), { sub: '203.0.113.7' }),
      node('resolver', b('Резолвер', 'Resolver'), 'l7', [184, 352, 128, 56], card(['Рекурсивный DNS-резолвер провайдера: обходит иерархию и кэширует ответы на их TTL.', 'The provider’s recursive DNS resolver: it walks the hierarchy and caches answers for their TTL.'], ['Провайдер.', 'The provider.'], 'dig shop.example', DOC.digMan), { sub: '203.0.113.53' }),
      node('root', b('корень .', 'root .'), 'l7', [432, 296, 120, 44], card(['Корневой сервер: направляет к серверам зоны example.', 'A root server: refers to the servers of the example. zone.'], ['Операторы корня.', 'The root operators.'], 'dig +trace shop.example')),
      node('tld', 'example.', 'l7', [432, 358, 120, 44], card(['Сервер зоны первого уровня: направляет к авторитативному серверу shop.example.', 'The top-level zone server: refers to the authoritative server of shop.example.'], ['Регистратура.', 'The registry.'])),
      node('auth', 'ns1.hosting', 'l7', [432, 420, 120, 44], card(['Авторитативный сервер зоны shop.example: отвечает A-записью с TTL.', 'The authoritative server of zone shop.example: answers with the A record and its TTL.'], ['Хостинг сайта.', 'The site’s hosting.'])),
      node('cdn', b('Узел CDN', 'CDN edge'), 'l7', [496, 200, 144, 64], card(['Ближайший к пользователю сервер CDN. Сюда указывает DNS-имя сайта; здесь заканчиваются TCP и TLS пользователя. Отдаёт из кэша (HIT) или идёт к origin (MISS).', 'The CDN server nearest to the user. The site’s DNS name points here; the user’s TCP and TLS end here. It serves from cache (HIT) or goes to the origin (MISS).'], ['Компания CDN.', 'The CDN company.'], 'curl -sI https://shop.example/catalog', DOC.cfCdn), { sub: '198.51.100.20' }),
      node('lb', 'nginx', 'l7', [672, 200, 128, 64], card(['Обратный прокси перед приложением в ЦОДе (origin). Добавляет X-Forwarded-For и отдаёт запрос бэкенду.', 'The reverse proxy in front of the application in the data centre (the origin). Adds X-Forwarded-For and passes the request to a backend.'], ['Администратор.', 'The administrator.'], 'tail /var/log/nginx/access.log', DOC.nginxProxy), { sub: 'origin' }),
      node('app', b('Приложение', 'Application'), 'process', [824, 120, 120, 56], card(['Собирает страницу каталога.', 'Builds the catalogue page.'], ['Разработчики.', 'The developers.'])),
      node('db', b('База', 'Database'), 'store', [824, 288, 120, 56], card(['Данные каталога.', 'The catalogue data.'], ['Администратор БД.', 'The DBA.'])),
    ],
    edges: [
      edge('e-wifi', 'browser', 'router', 'Wi-Fi', card(['Первый участок пути. Кадры адресованы MAC роутера.', 'The first segment of the path. Frames are addressed to the router’s MAC.'], ['—', '—'], 'tcpdump -n -e')),
      edge('e-dns', 'browser', 'resolver', 'UDP 53', card(['Вопрос stub-резолвера к рекурсивному: A? shop.example.', 'The stub resolver’s question to the recursive one: A? shop.example.'], ['glibc.', 'glibc.'], 'tcpdump -n port 53'), { via: [[84, 380]], labelAt: 0.6 }),
      edge('e-root', 'resolver', 'root', b('направление', 'referral'), card(['«спроси a.nic.example».', '“ask a.nic.example”.'], ['—', '—']), { via: [[344, 318]], labelAt: 0.7 }),
      edge('e-tld', 'resolver', 'tld', b('направление', 'referral'), card(['«спроси ns1.hosting.example».', '“ask ns1.hosting.example”.'], ['—', '—'])),
      edge('e-auth', 'resolver', 'auth', 'A 198.51.100.20', card(['Ответ с флагом aa и TTL 300.', 'The answer with the aa flag and TTL 300.'], ['—', '—']), { via: [[344, 442]], labelAt: 0.7 }),
      edge('e-edge', 'router', 'cdn', 'TCP 443 · TLS', card(['Соединение пользователя с узлом CDN: SYN, SYN-ACK, ACK, затем ClientHello с SNI shop.example.', 'The user’s connection to the CDN edge: SYN, SYN-ACK, ACK, then ClientHello with SNI shop.example.'], ['Ядро и библиотека TLS браузера.', 'The kernel and the browser’s TLS library.'], 'curl -v https://shop.example/', DOC.rfc8446)),
      edge('e-origin', 'cdn', 'lb', 'origin', card(['При промахе кэша CDN сам идёт к origin — своим соединением, обычно уже открытым заранее.', 'On a cache miss the CDN goes to the origin itself — over its own connection, usually opened in advance.'], ['CDN.', 'The CDN.'])),
      edge('e-app', 'lb', 'app', 'proxy_pass', card(['nginx передаёт запрос бэкенду.', 'nginx passes the request to a backend.'], ['—', '—'], undefined, DOC.nginxNext), { via: [[736, 148]] }),
      edge('e-db', 'app', 'db', 'SQL', card(['Запрос к базе.', 'A database query.'], ['—', '—'])),
    ],
  },
  params: [
    {
      id: 'cache',
      label: b('Страница в кэше браузера', 'The page is in the browser cache'),
      kind: 'toggle',
      default: false,
      near: 'browser',
      predict: {
        prompt: b('Страница есть в кэше браузера и ещё свежая (Cache-Control). Сколько пакетов уйдёт в сеть?', 'The page is in the browser cache and still fresh (Cache-Control). How many packets go to the network?'),
        options: [
          { id: 'none', text: b('Ни одного', 'None') },
          { id: 'dns', text: b('Только DNS-запрос', 'Only a DNS query') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'total') ?? 1) === 0 ? 'none' : 'dns'),
      },
    },
    {
      id: 'dns',
      label: b('Где есть ответ DNS', 'Where the DNS answer is'),
      kind: 'choice',
      default: 'cold',
      options: [
        { id: 'cold', label: b('нигде (кэши пусты)', 'nowhere (caches empty)') },
        { id: 'resolver', label: b('в кэше резолвера', 'in the resolver cache') },
        { id: 'os', label: b('в кэше ОС', 'in the OS cache') },
      ],
      near: 'resolver',
    },
    {
      id: 'scheme',
      label: b('Пользователь набрал', 'The user typed'),
      kind: 'choice',
      default: 'https',
      options: [
        { id: 'https', label: b('https://', 'https://') },
        { id: 'http', label: b('http://', 'http://') },
      ],
      near: 'browser',
      predict: {
        prompt: b('Набрали http://shop.example. Что сделает сервер?', 'The user typed http://shop.example. What does the server do?'),
        options: [
          { id: 'redirect', text: b('Ответит 301 с Location: https://…, и браузер начнёт заново по HTTPS', 'Answer 301 with Location: https://…, and the browser starts over on HTTPS') },
          { id: 'plain', text: b('Отдаст страницу без шифрования', 'Serve the page unencrypted') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'redirect') ? 'redirect' : 'plain'),
      },
    },
    { id: 'cdnHit', label: b('Страница в кэше CDN', 'The page is in the CDN cache'), kind: 'toggle', default: false, near: 'cdn' },
    { id: 'keepalive', label: b('Соединение уже открыто', 'The connection is already open'), kind: 'toggle', default: false, near: 'e-edge', levels: ['intermediate', 'experienced'] },
    { id: 'rtt', label: b('RTT до узла CDN', 'RTT to the CDN edge'), kind: 'range', min: 4, max: 200, step: 2, unit: 'ms', default: 20, near: 'cdn' },
  ],
  breaks: [
    {
      id: 'dns-down',
      label: b('Авторитативный DNS лежит', 'The authoritative DNS is down'),
      remove: ['auth', 'e-auth'],
      layer: 'L7',
      predict: {
        prompt: b('Сервер зоны shop.example не отвечает, кэши пусты. Где остановится загрузка?', 'The zone’s server for shop.example is not answering and the caches are empty. Where does the load stop?'),
        options: [
          { id: 'dns', text: b('На DNS: до TCP дело не дойдёт', 'At DNS: it never gets to TCP') },
          { id: 'tcp', text: b('На TCP', 'At TCP') },
          { id: 'http', text: b('Сервер вернёт 5xx', 'The server returns a 5xx') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'auth' ? 'dns' : brokenAt(next) === 'cdn' ? 'tcp' : 'http'),
      },
    },
    {
      id: 'fw443',
      label: b('Межсетевой экран выбрасывает TCP 443', 'A firewall drops TCP 443'),
      remove: ['e-edge'],
      layer: 'L4',
      predict: {
        prompt: b('Межсетевой экран перед CDN молча выбрасывает порт 443. Что увидит пользователь?', 'A firewall in front of the CDN silently drops port 443. What does the user see?'),
        options: [
          { id: 'timeout', text: b('Долгое ожидание и ERR_CONNECTION_TIMED_OUT', 'A long wait and ERR_CONNECTION_TIMED_OUT') },
          { id: 'refused', text: b('Мгновенно ERR_CONNECTION_REFUSED', 'ERR_CONNECTION_REFUSED at once') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'total') ?? 0) > 5000 ? 'timeout' : 'refused'),
      },
    },
    {
      id: 'origin-off',
      label: b('Машина origin выключена', 'The origin machine is off'),
      remove: ['lb', 'e-origin'],
      layer: 'L7',
      predict: {
        prompt: b('Origin выключен, а страницы нет в кэше CDN. Какой код получит пользователь и от кого?', 'The origin is off and the page is not in the CDN cache. Which code does the user get, and from whom?'),
        options: [
          { id: '504', text: b('504 от CDN: он не дождался origin', '504 from the CDN: it did not wait long enough for the origin') },
          { id: '404', text: b('404 от сайта', '404 from the site') },
          { id: 'none', text: b('Никакого: браузер не подключится', 'None: the browser cannot connect') },
        ],
        resolve: (_p, next) => (lastMetric(next, 'code') === 504 ? '504' : lastMetric(next, 'code') === 200 ? 'none' : 'none'),
      },
    },
  ],
  metrics: [
    { id: 'dns', label: b('DNS', 'DNS'), unit: 'ms' },
    { id: 'connect', label: b('TCP', 'TCP'), unit: 'ms' },
    { id: 'tls', label: b('TLS', 'TLS'), unit: 'ms' },
    { id: 'ttfb', label: b('первый байт', 'first byte'), unit: 'ms' },
    { id: 'total', label: b('всего', 'total'), unit: 'ms' },
    { id: 'code', label: b('код', 'status') },
  ],
  waterfall: 'total',
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const rtt = p.rtt;
    const m = { dns: 0, connect: 0, tls: 0, ttfb: 0, total: 0 };
    const snap = (extra: Record<string, number> = {}) => ({ dns: r1(m.dns), connect: r1(m.connect), tls: r1(m.tls), ttfb: r1(m.ttfb), total: r1(Math.max(m.total, m.dns)), ...extra });
    steps.push({ id: 'parse', label: 'URL', caption: p.scheme === 'https' ? b('Браузер разбирает адрес: схема https, имя shop.example, порт 443 (по умолчанию для https), путь /catalog.', 'The browser splits the address: scheme https, name shop.example, port 443 (the default for https), path /catalog.') : b('Схема http, имя shop.example, порт 80, путь /catalog.', 'Scheme http, name shop.example, port 80, path /catalog.'), focus: ['browser'], states: { browser: 'on' }, metrics: snap() });
    if (p.cache) {
      steps.push({ id: 'disk', label: b('кэш', 'cache'), caption: b('В кэше браузера свежая копия страницы (её Cache-Control ещё не истёк). Запрос не уходит в сеть вовсе — в DevTools это «(disk cache)». Самый быстрый запрос — тот, что не ушёл в сеть.', 'The browser cache has a fresh copy of the page (its Cache-Control has not expired). The request does not go to the network at all — DevTools shows “(disk cache)”. The fastest request is the one that never leaves.'), focus: ['browser'], states: { browser: 'ok', router: 'off', resolver: 'off', cdn: 'off', lb: 'off' }, metrics: snap({ code: 200 }) });
      return steps;
    }
    if (!p.keepalive) steps.push({ id: 'arp', label: 'ARP', caption: b('Ещё до первого пакета, если ARP-кэш пуст, ноутбук узнаёт MAC шлюза: «who-has 192.168.1.1 tell 192.168.1.23».', 'Before the first packet, if the ARP cache is empty, the laptop learns the gateway’s MAC: “who-has 192.168.1.1 tell 192.168.1.23”.'), focus: ['e-wifi', 'router'], tokens: [{ edge: 'e-wifi', label: 'who-has .1' }], metrics: snap() });
    if (p.dns === 'os') {
      steps.push({ id: 'dns', label: 'DNS', caption: b('Адрес есть в кэше ОС (systemd-resolved или nscd): вопрос никуда не уходит.', 'The address is in the OS cache (systemd-resolved or nscd): the question goes nowhere.'), focus: ['browser'], metrics: snap() });
    } else {
      m.dns += 10;
      steps.push({ id: 'dns', label: 'DNS', caption: p.dns === 'resolver' ? b('Stub-резолвер спрашивает резолвер провайдера; ответ у того в кэше — 10 мс.', 'The stub resolver asks the provider’s resolver; the answer is in its cache — 10 ms.') : b('Stub-резолвер спрашивает резолвер провайдера: A? shop.example. Кэш резолвера пуст.', 'The stub resolver asks the provider’s resolver: A? shop.example. The resolver’s cache is empty.'), focus: ['e-dns', 'resolver'], tokens: [{ edge: 'e-dns', label: 'A? shop.example' }], states: { resolver: 'on' }, metrics: snap() });
      if (p.dns === 'cold') {
        m.dns += 20;
        steps.push({ id: 'root', label: b('корень', 'root'), caption: b('Резолвер спрашивает корень и получает направление к серверам example.', 'The resolver asks the root and gets a referral to the example. servers.'), focus: ['e-root', 'root'], tokens: [{ edge: 'e-root', label: 'NS? example.' }], states: { root: 'on' }, metrics: snap() });
        m.dns += 30;
        steps.push({ id: 'tld', label: 'TLD', caption: b('Сервер зоны example. направляет к ns1.hosting.example.', 'The example. zone server refers to ns1.hosting.example.'), focus: ['e-tld', 'tld'], tokens: [{ edge: 'e-tld' }], states: { tld: 'on' }, metrics: snap() });
        if (broken.has('dns-down')) {
          m.dns += 4000;
          m.total = m.dns;
          steps.push({ id: 'servfail', label: 'SERVFAIL', caption: b('Авторитативный сервер молчит. Резолвер выжидает, повторяет и возвращает SERVFAIL. Браузеру нечего открывать: до TCP дело не дошло.', 'The authoritative server is silent. The resolver waits, retries and returns SERVFAIL. The browser has nothing to open: it never got as far as TCP.'), focus: ['auth', 'resolver'], states: { auth: 'err', resolver: 'warn', browser: 'err' }, metrics: snap(), broken: { at: 'auth', message: '$ dig shop.example\n;; ->>HEADER<<- opcode: QUERY, status: SERVFAIL\n\n$ curl https://shop.example/catalog\ncurl: (6) Could not resolve host: shop.example', caption: b('слой DNS. Браузер напишет «Не удаётся получить доступ к сайту» (в Chrome — ERR_NAME_NOT_RESOLVED).', 'the DNS layer. The browser says “This site can’t be reached” (in Chrome, ERR_NAME_NOT_RESOLVED).') } });
          return steps;
        }
        m.dns += 40;
        steps.push({ id: 'auth', label: 'A', caption: b('Авторитативный сервер отвечает: A 198.51.100.20, TTL 300. Резолвер кэширует ответ и отдаёт его браузеру. Это адрес узла CDN, а не самого сервера сайта.', 'The authoritative server answers: A 198.51.100.20, TTL 300. The resolver caches it and hands it to the browser. This is the CDN edge’s address, not the site’s own server.'), focus: ['e-auth', 'auth', 'e-dns'], tokens: [{ edge: 'e-auth', label: 'A 198.51.100.20' }, { edge: 'e-dns', reverse: true }], states: { auth: 'ok' }, metrics: snap() });
      }
    }
    m.total = m.dns;
    const connect = (scheme: string) => {
      steps.push({ id: `nat-${scheme}`, label: 'NAT', caption: b('Пакет уходит через роутер: источник 192.168.1.23:51234 превращается в 203.0.113.7:40001, соответствие записано в conntrack.', 'The packet leaves through the router: source 192.168.1.23:51234 becomes 203.0.113.7:40001, the mapping is written to conntrack.'), focus: ['router', 'e-wifi'], tokens: [{ edge: 'e-wifi', label: 'SYN' }], states: { router: 'on' }, metrics: snap() });
      if (broken.has('fw443') && scheme === 'https') {
        m.connect += 127000;
        m.total += 127000;
        steps.push({ id: 'syn-drop', label: 'SYN…', caption: b('SYN на порт 443 уходит — и пропадает: межсетевой экран выбрасывает его молча. Ядро повторяет SYN через 1, 2, 4, 8… секунд. Браузер долго крутит индикатор.', 'The SYN to port 443 leaves — and vanishes: the firewall drops it silently. The kernel resends the SYN after 1, 2, 4, 8… seconds. The browser spins for a long time.'), focus: ['e-edge'], tokens: [{ edge: 'e-edge', label: 'SYN' }], states: { 'e-edge': 'err', browser: 'err' }, metrics: snap(), broken: { at: 'cdn', message: "$ curl --connect-timeout 10 https://shop.example/catalog\ncurl: (28) Failed to connect to shop.example port 443 after 10002 ms: Timeout was reached", caption: b('слой L4: имя есть, адрес есть, соединения нет. Тишина вместо отказа — признак фильтра. Chrome напишет ERR_CONNECTION_TIMED_OUT.', 'layer L4: the name resolves, the address exists, there is no connection. Silence instead of a refusal is the mark of a filter. Chrome shows ERR_CONNECTION_TIMED_OUT.') } });
        return false;
      }
      m.connect += rtt;
      m.total += rtt;
      steps.push({ id: `tcp-${scheme}`, label: 'TCP', caption: fmt(b('Рукопожатие TCP с узлом CDN: SYN, SYN-ACK, ACK — один круг, {r} мс.', 'The TCP handshake with the CDN edge: SYN, SYN-ACK, ACK — one round trip, {r} ms.'), { r: rtt }), focus: ['e-edge', 'cdn'], tokens: [{ edge: 'e-edge', label: 'SYN' }, { edge: 'e-edge', reverse: true, label: 'SYN-ACK' }], states: { cdn: 'on' }, metrics: snap() });
      if (scheme === 'https') {
        m.tls += rtt;
        m.total += rtt;
        steps.push({ id: 'tls', label: 'TLS 1.3', caption: fmt(b('TLS 1.3: ClientHello с SNI shop.example, ответ сервера с сертификатом. Браузер проверяет имя, срок и цепочку. Ещё один круг — {r} мс. Провайдер видит только адрес, порт и SNI.', 'TLS 1.3: ClientHello with SNI shop.example, the server’s answer with the certificate. The browser checks the name, the dates and the chain. One more round trip — {r} ms. The provider sees only the address, the port and the SNI.'), { r: rtt }), focus: ['e-edge'], tokens: [{ edge: 'e-edge', label: 'ClientHello' }, { edge: 'e-edge', reverse: true, label: '{Certificate}' }], metrics: snap() });
      }
      return true;
    };
    if (p.scheme === 'http') {
      if (!p.keepalive && !connect('http')) return steps;
      m.total += rtt;
      steps.push({ id: 'redirect', label: '301', caption: b('GET /catalog по порту 80 — сервер отвечает 301 Moved Permanently, Location: https://shop.example/catalog. Браузер начинает заново по HTTPS (с HSTS он сделал бы это сам, без этого лишнего круга).', 'GET /catalog on port 80 — the server answers 301 Moved Permanently, Location: https://shop.example/catalog. The browser starts over on HTTPS (with HSTS it would do that itself, without this extra round trip).'), focus: ['e-edge', 'cdn'], tokens: [{ edge: 'e-edge', label: 'GET :80' }, { edge: 'e-edge', reverse: true, label: '301' }], metrics: snap() });
    }
    if (!p.keepalive || p.scheme === 'http') {
      if (!connect('https')) return steps;
    } else steps.push({ id: 'reuse', label: b('открыто', 'open'), caption: b('С этим узлом уже есть соединение с готовым TLS-сеансом: ни ARP, ни TCP, ни TLS не нужны.', 'There is already a connection to this edge with a ready TLS session: no ARP, no TCP, no TLS needed.'), focus: ['e-edge'], metrics: snap() });
    m.total += rtt / 2;
    steps.push({ id: 'request', label: 'GET', caption: b('Зашифрованный запрос: GET /catalog HTTP/1.1, Host: shop.example. Для провайдера это просто TLS Application Data.', 'The encrypted request: GET /catalog HTTP/1.1, Host: shop.example. To the provider it is just TLS Application Data.'), focus: ['e-edge', 'cdn'], tokens: [{ edge: 'e-edge', label: '{GET /catalog}' }], metrics: snap() });
    let code = 200;
    if (p.cdnHit) {
      m.total += 1;
      steps.push({ id: 'hit', label: 'HIT', caption: b('Страница в кэше CDN (X-Cache: HIT, заголовок Age показывает её возраст). Узел отвечает сразу, origin о запросе не узнал.', 'The page is in the CDN cache (X-Cache: HIT; the Age header shows how old it is). The edge answers at once; the origin never hears about the request.'), focus: ['cdn'], states: { cdn: 'ok', lb: 'off', app: 'off', db: 'off' }, metrics: snap() });
    } else {
      steps.push({ id: 'miss', label: 'MISS', caption: b('В кэше CDN страницы нет (MISS): узел сам идёт к origin — к nginx в ЦОДе.', 'The page is not in the CDN cache (MISS): the edge goes to the origin itself — to nginx in the data centre.'), focus: ['e-origin', 'lb'], tokens: [{ edge: 'e-origin', label: 'GET /catalog' }], states: { lb: 'on' }, metrics: snap() });
      if (broken.has('origin-off')) {
        m.total += 60000;
        code = 504;
        m.ttfb = m.total;
        steps.push({ id: 'origin-dead', label: '504', caption: b('Origin выключен: CDN шлёт SYN и ждёт. Через свой таймаут подключения CDN сдаётся и отвечает пользователю 504. Код написал CDN — сеть пользователя в порядке.', 'The origin is off: the CDN sends a SYN and waits. After its connect timeout the CDN gives up and answers the user 504. The CDN wrote the code — the user’s network is fine.'), focus: ['cdn', 'e-origin'], states: { lb: 'err', cdn: 'warn', browser: 'err' }, metrics: snap({ code }), broken: { at: 'lb', message: "$ curl -sI https://shop.example/catalog\nHTTP/1.1 504 Gateway Time-out\nServer: cdn-edge", caption: b('слой L7, причина на L3: origin не отвечает. Заголовок Server показывает, кто написал ответ — это первое, на что смотрят.', 'layer L7, cause on L3: the origin does not answer. The Server header shows who wrote the answer — the first thing to look at.') } });
        return steps;
      }
      m.total += 60 + 40 + 20;
      steps.push({ id: 'app', label: b('приложение', 'app'), caption: b('nginx добавляет X-Forwarded-For с адресом клиента и передаёт запрос приложению; приложение спрашивает базу и собирает страницу.', 'nginx adds X-Forwarded-For with the client’s address and passes the request to the application; the application queries the database and builds the page.'), focus: ['e-app', 'app', 'e-db', 'db'], tokens: [{ edge: 'e-app', label: 'GET /catalog' }, { edge: 'e-db', label: 'SELECT' }], states: { app: 'on', db: 'on' }, metrics: snap() });
    }
    m.total += rtt / 2;
    m.ttfb = m.total;
    steps.push({ id: 'response', label: '200', caption: b('Ответ HTTP/1.1 200 OK едет обратно: CDN → роутер (обратный NAT: 203.0.113.7:40001 → 192.168.1.23:51234 по conntrack) → браузер.', 'The answer HTTP/1.1 200 OK travels back: CDN → router (reverse NAT: 203.0.113.7:40001 → 192.168.1.23:51234 through conntrack) → browser.'), focus: ['e-edge', 'e-wifi', 'browser'], tokens: [{ edge: 'e-edge', reverse: true, label: '{200 OK}' }, { edge: 'e-wifi', reverse: true }], states: { browser: 'on' }, metrics: snap({ code }) });
    m.total += rtt;
    steps.push({ id: 'render', label: b('отрисовка', 'render'), caption: b('Браузер разбирает HTML, находит CSS, скрипты и картинки и запрашивает их по тому же соединению — без DNS, TCP и TLS. Страница готова.', 'The browser parses the HTML, finds the CSS, scripts and images and requests them over the same connection — no DNS, TCP or TLS. The page is ready.'), focus: ['browser', 'e-edge'], tokens: [{ edge: 'e-edge', label: 'app.css' }], states: { browser: 'ok' }, metrics: snap({ code }) });
    return steps;
  },
  explainDelta(prev, next, change) {
    const t0 = lastMetric(prev, 'total') ?? 0;
    const t1 = lastMetric(next, 'total') ?? 0;
    if (change.kind === 'break') {
      if (!change.on) return fmt(b('Поломка убрана: страница снова загружается, всего {t} мс.', 'The break is removed: the page loads again, {t} ms in total.'), { t: t1 });
      const at = brokenAt(next);
      return at === 'auth' ? b('Загрузка остановилась на DNS: имя не превратилось в адрес — до TCP не дошло.', 'The load stopped at DNS: the name did not become an address — it never got to TCP.') : at === 'cdn' ? b('Загрузка остановилась на TCP: SYN без ответа, ожидание до таймаута.', 'The load stopped at TCP: a SYN with no answer, a wait until the timeout.') : at === 'lb' ? b('CDN не дождался origin и ответил 504 — сеть пользователя тут ни при чём.', 'The CDN did not get an answer from the origin and replied 504 — the user’s network has nothing to do with it.') : b('Страница пришла из кэша CDN: выключенный origin пользователь даже не заметил.', 'The page came from the CDN cache: the user did not even notice the origin was off.');
    }
    return fmt(b('Полное время {a} → {b} мс. DNS {d} мс, TCP {c} мс, TLS {s} мс.', 'Total time {a} → {b} ms. DNS {d} ms, TCP {c} ms, TLS {s} ms.'), { a: t0, b: t1, d: lastMetric(next, 'dns') ?? 0, c: lastMetric(next, 'connect') ?? 0, s: lastMetric(next, 'tls') ?? 0 });
  },
});
