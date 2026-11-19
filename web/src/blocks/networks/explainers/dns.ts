// E-DNS (03 §7.3): how a name becomes an address. The application asks the
// stub resolver, which asks a recursive resolver, which walks the hierarchy
// root → TLD → authoritative and caches the answer for its TTL.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { second: number; ttl: number; hosts: boolean; qmin: boolean };

export const dnsModel = defineModel<P>({
  id: 'net.dns',
  block: 'networks',
  title: b('Как имя превращается в адрес', 'How a name becomes an address'),
  summary: b('curl https://shop.example/ — первый запрос с пустыми кэшами и второй, через заданное время. Двигайте TTL и время второго запроса.', 'curl https://shop.example/ — the first request with empty caches and a second one after a while. Move the TTL and the time of the second request.'),
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      node('app', 'curl', 'process', [24, 40, 136, 56], card(['Программа, которой нужен адрес. Она вызывает getaddrinfo() и ждёт.', 'The program that needs an address. It calls getaddrinfo() and waits.'], ['Вы.', 'You.'])),
      node('stub', b('stub-резолвер', 'stub resolver'), 'process', [24, 192, 136, 72], card(['Библиотека внутри программы, а не отдельный сервер. Читает /etc/nsswitch.conf, затем /etc/hosts, затем спрашивает сервер из /etc/resolv.conf.', 'A library inside the program, not a separate server. It reads /etc/nsswitch.conf, then /etc/hosts, then asks the server from /etc/resolv.conf.'], ['glibc (или musl).', 'glibc (or musl).'], 'cat /etc/resolv.conf'), { sub: '/etc/hosts' }),
      node('res', b('рекурсивный резолвер', 'recursive resolver'), 'l7', [272, 192, 168, 72], card(['Сервер, который ищет ответ за вас: обходит иерархию и держит кэш. Резолвер провайдера, 1.1.1.1, 8.8.8.8 или свой (unbound).', 'A server that finds the answer for you: it walks the hierarchy and keeps a cache. Your provider’s resolver, 1.1.1.1, 8.8.8.8 or your own (unbound).'], ['Провайдер, публичный сервис или вы.', 'The provider, a public service or you.'], 'dig shop.example', DOC.rfc1034), { sub: 'cache: empty' }),
      node('root', b('корень .', 'root .'), 'l7', [560, 24, 168, 56], card(['Знает только, кто отвечает за зоны первого уровня (TLD). На вопрос про shop.example он отвечает не адресом, а направлением: «спроси a.nic.example».', 'It only knows who answers for the top-level zones (TLDs). Asked about shop.example it replies not with an address but with a referral: “ask a.nic.example”.'], ['12 операторов корневых серверов.', '12 root server operators.'], 'dig @198.41.0.4 example. NS', DOC.rootServers), { sub: '198.41.0.4' }),
      node('tld', b('TLD example.', 'TLD example.'), 'l7', [560, 140, 168, 56], card(['Сервер зоны первого уровня. Хранит делегирования: какие серверы отвечают за shop.example (записи NS) и их адреса (glue).', 'The top-level zone server. It holds delegations: which servers answer for shop.example (NS records) and their addresses (glue).'], ['Регистратура зоны.', 'The registry of the zone.'], 'dig @192.0.2.53 shop.example NS'), { sub: '192.0.2.53' }),
      node('auth', b('авторитативный', 'authoritative'), 'l7', [560, 256, 168, 56], card(['Сервер, у которого лежит сама зона shop.example. Его ответ — с флагом aa (authoritative answer) и TTL, который выбрал владелец.', 'The server that holds the zone shop.example itself. Its answer carries the aa flag (authoritative answer) and the TTL the owner chose.'], ['Владелец домена или его хостинг.', 'The domain owner or their hosting.'], 'dig @198.51.100.53 shop.example'), { sub: '198.51.100.53' }),
      node('hosts', '/etc/hosts', 'obj', [24, 344, 136, 56], card(['Файл «адрес — имена». Читается раньше DNS (порядок задаёт /etc/nsswitch.conf). getent hosts его учитывает, dig — нет.', 'A file of “address — names”. It is read before DNS (/etc/nsswitch.conf sets the order). getent hosts honours it, dig does not.'], ['Администратор машины.', 'The machine’s administrator.'], 'getent hosts shop.example'), { shape: 'doc' }),
    ],
    edges: [
      edge('q-app', 'app', 'stub', 'getaddrinfo()', card(['Вызов функции внутри процесса, не сетевой запрос.', 'A function call inside the process, not a network request.'], ['curl.', 'curl.'])),
      edge('q-hosts', 'stub', 'hosts', b('сначала файл', 'file first'), card(['Если имя есть в /etc/hosts, на этом всё: в сеть ничего не уходит.', 'If the name is in /etc/hosts, that is it: nothing goes to the network.'], ['glibc по /etc/nsswitch.conf (hosts: files dns).', 'glibc, by /etc/nsswitch.conf (hosts: files dns).'])),
      edge('q-res', 'stub', 'res', 'A? shop.example RD', card(['UDP-датаграмма на порт 53 сервера из resolv.conf. Флаг RD (recursion desired): «найди за меня».', 'A UDP datagram to port 53 of the server from resolv.conf. The RD flag (recursion desired): “find it for me”.'], ['Stub-резолвер.', 'The stub resolver.'], 'tcpdump -n port 53')),
      edge('q-root', 'res', 'root', 'NS? example.', card(['С минимизацией QNAME (RFC 9156) резолвер спрашивает корень только про example., не раскрывая полное имя. Корень отвечает делегированием.', 'With QNAME minimisation (RFC 9156) the resolver asks the root only about example., without revealing the full name. The root answers with a delegation.'], ['Рекурсивный резолвер.', 'The recursive resolver.'], 'dig +trace shop.example', DOC.rfc9156), { via: [[356, 52]], labelAt: 0.55 }),
      edge('q-tld', 'res', 'tld', 'NS? shop.example.', card(['TLD отвечает: «за shop.example отвечает ns1.hosting.example, его адрес 198.51.100.53».', 'The TLD answers: “ns1.hosting.example answers for shop.example; its address is 198.51.100.53”.'], ['Рекурсивный резолвер.', 'The recursive resolver.']), { via: [[480, 168]], labelAt: 0.6 }),
      edge('q-auth', 'res', 'auth', 'A? shop.example.', card(['Вопрос авторитативному серверу. Ответ: A 198.51.100.20, TTL 300 — столько секунд ответ можно хранить.', 'The question to the authoritative server. The answer: A 198.51.100.20, TTL 300 — the number of seconds the answer may be kept.'], ['Рекурсивный резолвер.', 'The recursive resolver.']), { via: [[480, 284]], labelAt: 0.6 }),
    ],
  },
  params: [
    {
      id: 'second',
      label: b('Второй запрос через', 'Second request after'),
      kind: 'range',
      min: 0,
      max: 600,
      step: 10,
      unit: 's',
      default: 120,
      near: 'res',
      predict: {
        prompt: b('TTL записи 300 с. Второй запрос — через 400 с. Сколько вопросов задаст резолвер?', 'The record’s TTL is 300 s. The second request comes after 400 s. How many questions will the resolver ask?'),
        options: [
          { id: 'zero', text: b('Ни одного: ответ в кэше', 'None: the answer is cached') },
          { id: 'full', text: b('Снова три: запись в кэше устарела', 'Three again: the cached record has expired') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'upstream') ?? 0) > 3 ? 'full' : 'zero'),
      },
    },
    { id: 'ttl', label: b('TTL записи A', 'TTL of the A record'), kind: 'range', min: 30, max: 86400, step: 30, unit: 's', default: 300, near: 'auth' },
    {
      id: 'hosts',
      label: b('Имя записано в /etc/hosts', 'The name is in /etc/hosts'),
      kind: 'toggle',
      default: false,
      near: 'hosts',
      predict: {
        prompt: b('shop.example записан в /etc/hosts. Что ответит dig shop.example?', 'shop.example is in /etc/hosts. What will dig shop.example answer?'),
        options: [
          { id: 'dns', text: b('Адрес из DNS: dig не читает /etc/hosts', 'The address from DNS: dig does not read /etc/hosts') },
          { id: 'file', text: b('Адрес из /etc/hosts', 'The address from /etc/hosts') },
        ],
        resolve: () => 'dns',
      },
    },
    { id: 'qmin', label: b('Минимизация QNAME', 'QNAME minimisation'), kind: 'toggle', default: true, near: 'root', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'auth-down',
      label: b('Авторитативный сервер не отвечает', 'The authoritative server does not answer'),
      remove: ['auth', 'q-auth'],
      layer: 'L7',
      predict: {
        prompt: b('Сервер зоны shop.example лежит. Что вернёт резолвер?', 'The server of zone shop.example is down. What does the resolver return?'),
        options: [
          { id: 'servfail', text: b('SERVFAIL: «не смог выяснить»', 'SERVFAIL: “could not find out”') },
          { id: 'nxdomain', text: b('NXDOMAIN: «такого имени нет»', 'NXDOMAIN: “no such name”') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'auth' ? 'servfail' : 'nxdomain'),
      },
    },
    {
      id: 'typo',
      label: b('Опечатка в зоне: shop.exmaple', 'A typo in the zone: shop.exmaple'),
      remove: ['q-tld', 'q-auth'],
      layer: 'L7',
      predict: {
        prompt: b('Пользователь набрал shop.exmaple. Кто ответит, что такого имени нет?', 'The user typed shop.exmaple. Who answers that there is no such name?'),
        options: [
          { id: 'root', text: b('Корневой сервер: такой зоны первого уровня нет', 'The root server: there is no such top-level zone') },
          { id: 'auth', text: b('Авторитативный сервер магазина', 'The shop’s authoritative server') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'root' ? 'root' : 'auth'),
      },
    },
  ],
  metrics: [
    { id: 'upstream', label: b('вопросов резолвера', 'resolver questions') },
    { id: 'ms', label: b('время ответа', 'answer time'), unit: 'ms' },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    if (p.hosts) {
      steps.push({ id: 'ask', label: 'getaddrinfo', caption: b('curl просит адрес для shop.example у stub-резолвера.', 'curl asks the stub resolver for the address of shop.example.'), focus: ['app', 'q-app'], tokens: [{ edge: 'q-app' }], states: { app: 'on', stub: 'on' }, metrics: { upstream: 0, ms: 0 } });
      steps.push({ id: 'file', label: '/etc/hosts', caption: b('Имя нашлось в /etc/hosts — ответ готов, в сеть ничего не ушло. Но dig не читает этот файл: он спросит DNS и может показать другой адрес.', 'The name is in /etc/hosts — the answer is ready, nothing went to the network. But dig does not read this file: it asks DNS and may show a different address.'), focus: ['hosts', 'q-hosts'], tokens: [{ edge: 'q-hosts', label: '10.0.0.9' }], states: { hosts: 'ok', res: 'off', root: 'off', tld: 'off', auth: 'off' }, metrics: { upstream: 0, ms: 0 } });
      return steps;
    }
    const typo = broken.has('typo');
    const name = typo ? 'shop.exmaple' : 'shop.example';
    steps.push({ id: 'ask', label: 'getaddrinfo', caption: fmt(b('curl просит адрес для {n}. В /etc/hosts имени нет, stub-резолвер берёт сервер из /etc/resolv.conf.', 'curl asks for the address of {n}. The name is not in /etc/hosts; the stub resolver takes the server from /etc/resolv.conf.'), { n: name }), focus: ['app', 'q-app', 'q-hosts'], tokens: [{ edge: 'q-app' }], states: { app: 'on', stub: 'on', hosts: 'off' }, metrics: { upstream: 0, ms: 0 } });
    steps.push({ id: 'to-res', label: 'A?', caption: b('Stub отправляет резолверу UDP-вопрос на порт 53 с флагом RD: «найди за меня». Кэш резолвера пуст.', 'The stub sends the resolver a UDP question to port 53 with the RD flag: “find it for me”. The resolver’s cache is empty.'), focus: ['q-res', 'res'], tokens: [{ edge: 'q-res', label: `A? ${name}` }], states: { res: 'on' }, metrics: { upstream: 0, ms: 1 } });
    steps.push({
      id: 'root',
      label: b('корень', 'root'),
      caption: typo
        ? b('Резолвер спрашивает корень про exmaple. — а такой зоны первого уровня нет. Корень отвечает NXDOMAIN, и вопрос закончен на первом же шаге.', 'The resolver asks the root about exmaple. — and there is no such top-level zone. The root answers NXDOMAIN, and the question ends at the very first step.')
        : p.qmin
          ? b('Корню резолвер говорит только «NS? example.» — полное имя корню знать незачем (минимизация QNAME). Ответ — направление: «спроси a.nic.example, вот его адрес».', 'To the root the resolver says only “NS? example.” — the root has no need for the full name (QNAME minimisation). The answer is a referral: “ask a.nic.example, here is its address”.')
          : b('Без минимизации резолвер отправляет корню полное имя shop.example. Ответ всё равно только направление: «спроси a.nic.example».', 'Without minimisation the resolver sends the full name shop.example to the root. The answer is still only a referral: “ask a.nic.example”.'),
      focus: ['q-root', 'root'],
      tokens: [{ edge: 'q-root', label: typo ? 'NS? exmaple.' : p.qmin ? 'NS? example.' : 'A? shop.example.' }],
      states: { root: typo ? 'err' : 'on' },
      metrics: { upstream: 1, ms: 20 },
      ...(typo ? { broken: { at: 'root', message: '$ dig shop.exmaple\n;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 1125\n;; AUTHORITY SECTION:\n.   3600  IN  SOA  a.root-servers.net. …', caption: b('NXDOMAIN — окончательное «такого имени нет». Резолвер запомнит и это (отрицательное кэширование) на срок из записи SOA.', 'NXDOMAIN is a final “no such name”. The resolver caches that too (negative caching) for the time in the SOA record.') } } : {}),
    });
    if (typo) return steps;
    steps.push({ id: 'tld', label: 'TLD', caption: b('Сервер зоны example. знает делегирование: «за shop.example отвечает ns1.hosting.example — 198.51.100.53». Это записи NS и glue.', 'The example. zone server knows the delegation: “ns1.hosting.example answers for shop.example — 198.51.100.53”. These are NS and glue records.'), focus: ['q-tld', 'tld'], tokens: [{ edge: 'q-tld', label: p.qmin ? 'NS? shop.example.' : 'A? shop.example.' }], states: { tld: 'on' }, metrics: { upstream: 2, ms: 40 } });
    if (broken.has('auth-down')) {
      steps.push({
        id: 'timeout',
        label: 'SERVFAIL',
        caption: b('Авторитативный сервер молчит. Резолвер ждёт, пробует ещё раз и сдаётся: возвращает клиенту SERVFAIL — «не смог выяснить».', 'The authoritative server is silent. The resolver waits, tries again and gives up: it returns SERVFAIL to the client — “could not find out”.'),
        focus: ['res', 'auth'],
        states: { auth: 'err', res: 'warn' },
        metrics: { upstream: 4, ms: 4040 },
        broken: { at: 'auth', message: '$ dig shop.example\n;; ->>HEADER<<- opcode: QUERY, status: SERVFAIL, id: 4242\n\n$ curl https://shop.example/\ncurl: (6) Could not resolve host: shop.example', caption: b('SERVFAIL — не «нет такого имени», а «не дозвался того, кто знает». Слой DNS, причина — у сервера зоны.', 'SERVFAIL is not “no such name” but “could not reach whoever knows”. The DNS layer; the cause is at the zone’s server.') },
      });
      return steps;
    }
    steps.push({ id: 'auth', label: 'AA', caption: fmt(b('Авторитативный сервер отвечает с флагом aa: A 198.51.100.20, TTL {t}. Резолвер кладёт ответ в кэш на {t} секунд и отдаёт его stub-резолверу.', 'The authoritative server answers with the aa flag: A 198.51.100.20, TTL {t}. The resolver caches it for {t} seconds and hands it to the stub resolver.'), { t: p.ttl }), focus: ['q-auth', 'auth', 'q-res'], tokens: [{ edge: 'q-auth', label: 'A 198.51.100.20' }, { edge: 'q-res', reverse: true, label: '198.51.100.20' }], states: { auth: 'ok' }, values: { res: `cache: ${p.ttl}s` }, metrics: { upstream: 3, ms: 62 } });
    const hit = p.second < p.ttl;
    steps.push({
      id: 'again',
      label: fmt(b('через {s} с', 'after {s} s'), { s: p.second }),
      caption: hit
        ? fmt(b('Второй запрос через {s} с: запись ещё жива (осталось {l} с). Резолвер отвечает из кэша за миллисекунду; авторитативный сервер об этом запросе не узнал.', 'The second request after {s} s: the record is still alive ({l} s left). The resolver answers from its cache in a millisecond; the authoritative server never learns about this request.'), { s: p.second, l: p.ttl - p.second })
        : fmt(b('Второй запрос через {s} с: TTL {t} с истёк, запись выброшена. Резолвер снова проходит весь путь — корень, TLD, авторитативный.', 'The second request after {s} s: the TTL of {t} s has expired and the record is gone. The resolver walks the whole path again — root, TLD, authoritative.'), { s: p.second, t: p.ttl }),
      focus: hit ? ['q-res', 'res'] : ['q-root', 'q-tld', 'q-auth'],
      tokens: hit ? [{ edge: 'q-res', label: 'A?' }, { edge: 'q-res', reverse: true, label: 'cache' }] : [{ edge: 'q-root' }, { edge: 'q-tld' }, { edge: 'q-auth' }],
      values: { res: hit ? `cache: ${p.ttl - p.second}s left` : `cache: ${p.ttl}s` },
      metrics: { upstream: hit ? 3 : 6, ms: hit ? 1 : 62 },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, bb) {
    if (change.kind === 'break') {
      if (!change.on) return b('Поломка убрана: резолвер снова доходит до ответа.', 'The break is removed: the resolver reaches the answer again.');
      return change.id === 'typo' ? b('Опечатка в зоне первого уровня: NXDOMAIN отвечает сам корень, дальше вопрос не идёт.', 'A typo in the top-level zone: the root itself answers NXDOMAIN; the question goes no further.') : b('Сервер зоны молчит: резолвер возвращает SERVFAIL, curl — «Could not resolve host».', 'The zone’s server is silent: the resolver returns SERVFAIL, curl — “Could not resolve host”.');
    }
    const u0 = lastMetric(prev, 'upstream') ?? 0;
    const u1 = lastMetric(next, 'upstream') ?? 0;
    if (change.id === 'second' || change.id === 'ttl') {
      const hit = (bb.second as number) < (bb.ttl as number);
      return fmt(hit ? b('Второй запрос через {s} с при TTL {t} с — из кэша. Вопросов к серверам: {u0} → {u1}.', 'Second request after {s} s with a TTL of {t} s comes from the cache. Questions to servers: {u0} → {u1}.') : b('Второй запрос через {s} с при TTL {t} с — снова полный путь. Вопросов: {u0} → {u1}. Длинный TTL экономит запросы, но после смены адреса старый живёт столько же.', 'Second request after {s} s with a TTL of {t} s walks the whole path again. Questions: {u0} → {u1}. A long TTL saves queries, but after an address change the old one lives just as long.'), { s: bb.second as number, t: bb.ttl as number, u0, u1 });
    }
    if (change.id === 'hosts') return bb.hosts ? b('Имя в /etc/hosts: stub отвечает сам, DNS не спрашивают. dig при этом покажет DNS-ответ — отсюда «у меня работает, а dig говорит другое».', 'The name is in /etc/hosts: the stub answers itself and DNS is not asked. dig still shows the DNS answer — hence “it works for me, but dig says otherwise”.') : b('Файл больше не содержит имени: снова DNS.', 'The file no longer has the name: DNS again.');
    void a;
    return bb.qmin ? b('Минимизация включена: корень и TLD узнают только нужную им часть имени.', 'Minimisation on: the root and the TLD learn only the part of the name they need.') : b('Минимизация выключена: полное имя уходит и корню, и TLD.', 'Minimisation off: the full name goes to the root and to the TLD.');
  },
});
