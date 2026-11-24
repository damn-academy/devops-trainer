// E-DNS (03 §7.3): how a name becomes an address. The application asks the
// stub resolver, which asks a recursive resolver, which walks the hierarchy
// root → TLD → authoritative and caches the answer for its TTL.
//
// Reading order: at the first step only curl and the system library are on
// the diagram; the resolver and the three servers appear when the question
// reaches them. The acting block says in a callout what it does, and every
// question and answer travels along the line as a card.

import { defineModel } from '../../../core/define';
import { bi, fmt, t } from '../../../core/i18n';
import type { ElementState, Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { second: number; ttl: number; hosts: boolean; qmin: boolean };

const HIDDEN: Record<string, ElementState> = Object.fromEntries(['res', 'root', 'tld', 'auth', 'q-res', 'q-root', 'q-tld', 'q-auth'].map((id) => [id, 'hidden' as ElementState]));
const cacheLeft = (s: number) => bi(`в кэше ещё ${s} с`, `${s} s left in cache`);

export const dnsModel = defineModel<P>({
  id: 'net.dns',
  frame: 'visible',
  block: 'networks',
  title: b('Как имя сайта превращается в адрес', 'How a name becomes an address'),
  summary: b(
    'Вы выполняете curl https://shop.example/, и программе curl нужен адрес сервера. Схема показывает первый запрос, когда все кэши пусты, и второй запрос того же имени через заданное время. Под названием резолвера показано, сколько ещё секунд он будет хранить ответ.',
    'You run curl https://shop.example/, and curl needs the server’s address. The diagram shows the first request with all caches empty and a second request for the same name after a set time. Under the resolver’s name you see how many more seconds it keeps the answer.',
  ),
  intro: b(
    'Схема соберётся по шагам: сейчас на ней только curl, системная библиотека и файл /etc/hosts. А дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что он делает, а карточка на линии показывает вопрос или ответ.\n\nПосле первого прохода подвиньте время второго запроса и TTL записи, запишите имя в /etc/hosts, а потом попробуйте обе поломки в блоке «Сломать».',
    'The diagram builds itself step by step: now it shows only curl, the system library and /etc/hosts. Then go on with “Step forward” above the diagram. The callout at the highlighted block says what it does; the card on the line shows a question or an answer.\n\nAfter the first pass move the time of the second request and the record’s TTL, put the name into /etc/hosts, then try both breaks in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: b('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: b('что этот блок делает', 'what it does') },
    { mark: 'token', text: b('вопрос или ответ DNS на линии', 'a DNS question or answer on the line') },
    { mark: 'icon:process', text: b('программа и системная библиотека', 'program and system library') },
    { mark: 'icon:dns', text: b('сервер DNS', 'DNS server') },
    { mark: 'icon:file', text: b('файл /etc/hosts', 'the /etc/hosts file') },
    { mark: 'ok', text: b('здесь нашёлся ответ', 'the answer was found here') },
    { mark: 'warn', text: b('резолвер не получил ответа', 'the resolver got no answer') },
    { mark: 'err', text: b('здесь поиск остановился', 'the search stopped here') },
  ],
  stopLabel: b('Поиск адреса остановился', 'The search stopped'),
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      node('app', 'curl', 'process', [24, 40, 144, 56], card(['Программа, которой нужен адрес сервера. Она вызывает системную функцию getaddrinfo() и ждёт ответа.', 'The program that needs an address. It calls getaddrinfo() and waits.'], ['Команду curl запускаете вы.', 'You.']), { icon: 'process' }),
      node('stub', b('Библиотека имён', 'Stub resolver'), 'process', [24, 192, 144, 72], card(['Системная библиотека работает внутри самой программы, а не на отдельном сервере, и её называют stub-резолвером. Она читает /etc/nsswitch.conf, затем файл /etc/hosts и только потом спрашивает сервер, записанный в /etc/resolv.conf.', 'A library inside the program, not a separate server. It reads /etc/nsswitch.conf, then /etc/hosts, then asks the server from /etc/resolv.conf.'], ['Эта библиотека входит в glibc или musl.', 'glibc (or musl).'], 'cat /etc/resolv.conf'), { icon: 'process' }),
      node('res', b('Рекурсивный резолвер', 'Recursive resolver'), 'l7', [272, 192, 176, 72], card(['Рекурсивный резолвер ищет ответ за вас. Он обходит серверы DNS сверху вниз и хранит найденные ответы в кэше. Это может быть резолвер провайдера, публичный 1.1.1.1 или 8.8.8.8 или ваш собственный, например unbound. Под названием резолвера показано, сколько секунд он ещё будет хранить ответ, а знак ∅ означает, что кэш пуст.', 'A server that finds the answer for you: it walks the hierarchy and keeps a cache. Your provider’s resolver, 1.1.1.1, 8.8.8.8 or your own (unbound).'], ['Резолвер держит провайдер, публичный сервис или вы сами.', 'The provider, a public service or you.'], 'dig shop.example', DOC.rfc1034), { sub: ' ', icon: 'dns', work: 'spin' }),
      node('root', b('Корневой сервер', 'Root server'), 'l7', [560, 24, 200, 56], card(['Корневой сервер знает только, какие серверы отвечают за зоны первого уровня. На вопрос о shop.example корневой сервер отвечает не адресом, а подсказкой, какой сервер спросить дальше, например a.nic.example.', 'The root server knows only which servers answer for the top-level zones. Asked about shop.example, the root server answers not with an address but with a referral saying which server to ask next, for example a.nic.example.'], ['Корневые серверы держат 12 организаций-операторов.', '12 root server operators.'], 'dig @198.41.0.4 example. NS', DOC.rootServers), { sub: '198.41.0.4', icon: 'dns' }),
      node('tld', b('Сервер зоны example.', 'TLD example.'), 'l7', [560, 140, 200, 56], card(['Сервер зоны первого уровня. Он хранит делегирования, то есть знает, какие серверы отвечают за shop.example (записи NS) и какие у них адреса (записи glue).', 'The top-level zone server. It holds delegations: which servers answer for shop.example (NS records) and their addresses (glue).'], ['Сервер держит регистратура зоны.', 'The registry of the zone.'], 'dig @192.0.2.53 shop.example NS'), { sub: '192.0.2.53', icon: 'dns' }),
      node('auth', b('Авторитативный сервер', 'Authoritative server'), 'l7', [560, 256, 200, 56], card(['Сервер, на котором хранится сама зона shop.example. В его ответе стоит флаг aa (authoritative answer) и TTL, то есть срок хранения, который выбрал владелец домена.', 'The server that holds the zone shop.example itself. Its answer carries the aa flag (authoritative answer) and the TTL the owner chose.'], ['Сервер держит владелец домена или его хостинг.', 'The domain owner or their hosting.'], 'dig @198.51.100.53 shop.example'), { sub: '198.51.100.53', icon: 'dns' }),
      node('hosts', '/etc/hosts', 'obj', [24, 344, 144, 56], card(['Файл, в котором каждой строке соответствуют адрес и имена. Его читают раньше DNS, а порядок задаёт /etc/nsswitch.conf. Команда getent hosts этот файл учитывает, а dig нет.', 'A file of “address — names”. It is read before DNS (/etc/nsswitch.conf sets the order). getent hosts honours it, dig does not.'], ['Файл правит администратор машины.', 'The machine’s administrator.'], 'getent hosts shop.example'), { shape: 'doc', icon: 'file' }),
    ],
    edges: [
      edge('q-app', 'app', 'stub', 'getaddrinfo()', card(['По этой линии программа вызывает функцию библиотеки, и в сеть при этом ничего не уходит.', 'A function call inside the process, not a network request.'], ['Функцию вызывает curl.', 'curl.'])),
      edge('q-hosts', 'stub', 'hosts', b('сначала файл', 'file first'), card(['Если имя записано в /etc/hosts, поиск на этом заканчивается, и в сеть ничего не уходит.', 'If the name is in /etc/hosts, that is it: nothing goes to the network.'], ['Порядок задаёт строка hosts: files dns в /etc/nsswitch.conf.', 'glibc, by /etc/nsswitch.conf (hosts: files dns).'])),
      edge('q-res', 'stub', 'res', 'A? shop.example', card(['Библиотека отправляет датаграмму UDP на порт 53 сервера, записанного в resolv.conf. Флаг RD (recursion desired) означает просьбу «найди ответ за меня».', 'A UDP datagram to port 53 of the server from resolv.conf. The RD flag (recursion desired): “find it for me”.'], ['Вопрос отправляет системная библиотека.', 'The stub resolver.'], 'tcpdump -n port 53')),
      edge('q-root', 'res', 'root', 'NS? example.', card(['С минимизацией QNAME (RFC 9156) резолвер спрашивает корневой сервер только о зоне example. и не раскрывает полное имя. Корневой сервер отвечает делегированием.', 'With QNAME minimisation (RFC 9156) the resolver asks the root only about example., without revealing the full name. The root answers with a delegation.'], ['Вопрос задаёт рекурсивный резолвер.', 'The recursive resolver.'], 'dig +trace shop.example', DOC.rfc9156), { via: [[360, 52]], labelAt: 0.55 }),
      edge('q-tld', 'res', 'tld', 'NS? shop.example.', card(['Сервер зоны example. отвечает, что за shop.example отвечает ns1.hosting.example с адресом 198.51.100.53.', 'The TLD answers: “ns1.hosting.example answers for shop.example; its address is 198.51.100.53”.'], ['Вопрос задаёт рекурсивный резолвер.', 'The recursive resolver.']), { via: [[480, 168]], labelAt: 0.6 }),
      edge('q-auth', 'res', 'auth', 'A? shop.example.', card(['По этой линии резолвер спрашивает авторитативный сервер, и тот отвечает записью A 198.51.100.20 с TTL 300, то есть ответ можно хранить 300 секунд.', 'The question to the authoritative server. The answer: A 198.51.100.20, TTL 300 — the number of seconds the answer may be kept.'], ['Вопрос задаёт рекурсивный резолвер.', 'The recursive resolver.']), { via: [[480, 284]], labelAt: 0.9 }),
    ],
  },
  params: [
    {
      id: 'second',
      group: b('Когда приходит второй запрос', 'When the second request comes'),
      label: b('Через сколько секунд curl снова спрашивает адрес shop.example', 'Second request after'),
      kind: 'range',
      min: 0,
      max: 600,
      step: 10,
      unit: { ru: 'с', en: 's' },
      default: 120,
      near: 'res',
      predict: {
        prompt: b('Сравните время второго запроса, которое вы только что выставили, со сроком хранения записи A (по умолчанию он равен 300 секундам). Записи о том, какие серверы отвечают за зоны, хранятся сутки и дольше. Сколько вопросов другим серверам задаст резолвер при втором запросе?', 'Compare the time of the second request you have just set with the lifetime of the A record (300 seconds by default). The records naming the servers for each zone are kept for a day and longer. How many questions to other servers will the resolver ask on the second request?'),
        options: [
          { id: 'zero', text: b('Ни одного, потому что запись A ещё лежит в кэше', 'None: the A record is still cached') },
          { id: 'one', text: b('Один вопрос серверу магазина, потому что устарела только запись A', 'One question to the shop’s server: only the A record has expired') },
          { id: 'full', text: b('Снова три вопроса, потому что резолвер начинает поиск с корня', 'Three again: the resolver starts from the root') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'upstream') ?? 0) > 3 ? 'one' : 'zero'),
      },
    },
    { id: 'ttl', group: b('Что записал владелец домена', 'What the domain owner set'), label: b('Сколько секунд можно хранить запись A (TTL)', 'TTL of the A record'), kind: 'range', min: 30, max: 86400, step: 30, unit: { ru: 'с', en: 's' }, default: 300, near: 'auth' },
    {
      id: 'hosts',
      group: b('Что записано на вашей машине', 'What is on your machine'),
      label: b('Имя shop.example записано в /etc/hosts', 'The name is in /etc/hosts'),
      kind: 'toggle',
      default: false,
      near: 'hosts',
      predict: {
        prompt: b('Имя shop.example записано в /etc/hosts с адресом 10.0.0.9, а в DNS у него адрес 198.51.100.20. Какой адрес покажет команда dig shop.example?', 'shop.example is in /etc/hosts. What will dig shop.example answer?'),
        options: [
          { id: 'dns', text: b('Адрес из DNS, потому что dig не читает /etc/hosts', 'The address from DNS: dig does not read /etc/hosts') },
          { id: 'file', text: b('Адрес из /etc/hosts, потому что файл читается первым', 'The address from /etc/hosts') },
        ],
        resolve: () => 'dns',
      },
    },
    { id: 'qmin', group: b('Как работает резолвер', 'How the resolver works'), label: b('Резолвер сообщает серверам только нужную им часть имени (минимизация QNAME)', 'QNAME minimisation'), kind: 'toggle', default: true, near: 'root', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'auth-down',
      label: b('Авторитативный сервер зоны shop.example не отвечает', 'The authoritative server does not answer'),
      remove: ['auth', 'q-auth'],
      layer: 'L7',
      predict: {
        prompt: b('Сервер, на котором хранится зона shop.example, не отвечает, а в кэше резолвера ответа нет. Что резолвер вернёт программе?', 'The server of zone shop.example is down. What does the resolver return?'),
        options: [
          { id: 'servfail', text: b('SERVFAIL, то есть «не удалось выяснить»', 'SERVFAIL: “could not find out”') },
          { id: 'nxdomain', text: b('NXDOMAIN, то есть «такого имени нет»', 'NXDOMAIN: “no such name”') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'auth' ? 'servfail' : 'nxdomain'),
      },
    },
    {
      id: 'typo',
      label: b('Пользователь ошибся в имени и набрал shop.exmaple', 'A typo in the zone: shop.exmaple'),
      remove: ['q-tld', 'q-auth'],
      layer: 'L7',
      predict: {
        prompt: b('Пользователь набрал shop.exmaple, а зоны первого уровня exmaple не существует. Какой сервер ответит, что такого имени нет?', 'The user typed shop.exmaple. Who answers that there is no such name?'),
        options: [
          { id: 'root', text: b('Корневой сервер, потому что он знает все зоны первого уровня', 'The root server: there is no such top-level zone') },
          { id: 'auth', text: b('Авторитативный сервер магазина', 'The shop’s authoritative server') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'root' ? 'root' : 'auth'),
      },
    },
  ],
  metrics: [
    { id: 'upstream', label: b('вопросов резолвера другим серверам', 'resolver questions') },
    { id: 'ms', label: b('время ответа', 'answer time'), unit: { ru: 'мс', en: 'ms' } },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    if (p.hosts) {
      steps.push({ id: 'ask', label: 'getaddrinfo', values: { res: t(b('кэш пуст', 'cache empty')) }, caption: b('Программа curl просит у системной библиотеки адрес имени shop.example.', 'curl asks the stub resolver for the address of shop.example.'), focus: ['app', 'q-app'], tokens: [{ edge: 'q-app', label: 'shop.example?' }], say: { app: b('Программа curl спрашивает адрес shop.example.', 'curl asks for the address of shop.example.') }, states: { ...HIDDEN, app: 'on', stub: 'on' }, metrics: { upstream: 0, ms: 0 } });
      steps.push({ id: 'file', label: '/etc/hosts', caption: b('Имя нашлось в /etc/hosts, ответ готов, и в сеть ничего не ушло. Но dig этот файл не читает: он спросит DNS и может показать другой адрес.', 'The name is in /etc/hosts — the answer is ready, nothing went to the network. But dig does not read this file: it asks DNS and may show a different address.'), focus: ['stub', 'q-hosts', 'hosts'], tokens: [{ edge: 'q-hosts', label: '10.0.0.9', reverse: true }], say: { stub: b('Библиотека находит имя в /etc/hosts и сразу отдаёт адрес 10.0.0.9.', 'The library finds the name in /etc/hosts and returns 10.0.0.9 at once.') }, states: { hosts: 'ok' }, metrics: { upstream: 0, ms: 0 } });
      return steps;
    }
    const typo = broken.has('typo');
    const name = typo ? 'shop.exmaple' : 'shop.example';
    steps.push({
      id: 'ask',
      label: 'getaddrinfo',
      values: { res: t(b('кэш пуст', 'cache empty')) },
      caption: fmt(b('Программа curl просит адрес имени {n}. В /etc/hosts такого имени нет, поэтому системная библиотека берёт адрес резолвера из /etc/resolv.conf.', 'curl asks for the address of {n}. The name is not in /etc/hosts; the stub resolver takes the server from /etc/resolv.conf.'), { n: name }),
      focus: ['app', 'q-app', 'stub'],
      tokens: [{ edge: 'q-app', label: `${name}?` }],
      say: { stub: b('Библиотека не находит имя в /etc/hosts и готовит вопрос резолверу.', 'The library does not find the name in /etc/hosts and prepares a question for the resolver.') },
      states: { ...HIDDEN, app: 'on', stub: 'on', hosts: 'off' },
      metrics: { upstream: 0, ms: 0 },
    });
    steps.push({
      id: 'to-res',
      label: 'A?',
      caption: b('Библиотека отправляет резолверу вопрос в датаграмме UDP на порт 53 и просит найти ответ за неё. Кэш резолвера пока пуст, поэтому резолвер будет искать адрес сам.', 'The stub sends the resolver a UDP question to port 53 and asks it to find the answer. The resolver’s cache is empty, so it will search itself.'),
      focus: ['q-res', 'res'],
      tokens: [{ edge: 'q-res', label: `A? ${name}` }],
      say: { res: b('Резолвер не находит имя в своём кэше и начинает искать сам.', 'The resolver does not find the name in its cache and starts searching.') },
      states: { res: 'on', 'q-res': 'on' },
      metrics: { upstream: 0, ms: 1 },
    });
    steps.push({
      id: 'root',
      label: b('корень', 'root'),
      caption: typo
        ? b('Резолвер спрашивает корневой сервер о зоне exmaple., а такой зоны первого уровня не существует. Корневой сервер отвечает NXDOMAIN, и поиск заканчивается на первом же шаге.', 'The resolver asks the root about exmaple. — and there is no such top-level zone. The root answers NXDOMAIN, and the question ends at the very first step.')
        : p.qmin
          ? b('Резолвер спрашивает корневой сервер только о том, кто отвечает за зону example., потому что полное имя магазина корню знать незачем. Корневой сервер отвечает подсказкой, что спрашивать нужно сервер a.nic.example, и называет его адрес.', 'The resolver asks the root server only who answers for the example. zone, because the root has no need for the shop’s full name. The root server answers with a referral to the server a.nic.example and gives its address.')
          : b('Без минимизации резолвер сообщает корневому серверу полное имя shop.example. Ответ всё равно содержит только подсказку, что спрашивать нужно сервер a.nic.example.', 'Without minimisation the resolver sends the full name shop.example to the root server. The answer is still only a referral to the server a.nic.example.'),
      focus: ['q-root', 'root'],
      tokens: [{ edge: 'q-root', label: typo ? 'NS? exmaple.' : p.qmin ? 'NS? example.' : 'A? shop.example.' }],
      say: { root: typo ? b('Корневой сервер отвечает, что зоны exmaple не существует.', 'The root answers that there is no zone exmaple.') : b('Корневой сервер присылает подсказку вместо адреса.', 'The root server sends a referral instead of an address.') },
      states: { root: typo ? 'err' : 'on', 'q-root': 'on' },
      metrics: { upstream: 1, ms: 20 },
      ...(typo
        ? { broken: { at: 'root', message: '$ dig shop.exmaple\n;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 1125\n;; AUTHORITY SECTION:\n.   3600  IN  SOA  a.root-servers.net. …', caption: b('NXDOMAIN означает окончательное «такого имени нет». Резолвер запомнит и этот ответ на срок, указанный в записи SOA; это называется отрицательным кэшированием.', 'NXDOMAIN is a final “no such name”. The resolver caches that too (negative caching) for the time in the SOA record.') } }
        : {}),
    });
    if (typo) return steps;
    steps.push({
      id: 'tld',
      label: b('зона example.', 'TLD'),
      caption: b('Сервер зоны example. знает, кому передана зона магазина, и отвечает, что за shop.example отвечает сервер ns1.hosting.example с адресом 198.51.100.53.', 'The example. zone server knows whom the shop’s zone was handed to and answers that ns1.hosting.example, at 198.51.100.53, answers for shop.example.'),
      focus: ['q-tld', 'tld'],
      tokens: [{ edge: 'q-tld', label: p.qmin ? 'NS? shop.example.' : 'A? shop.example.' }],
      say: { tld: b('Сервер зоны example. отвечает, что записи shop.example хранит ns1.hosting.example.', 'The example. server answers that ns1.hosting.example keeps shop.example.') },
      states: { tld: 'on', 'q-tld': 'on' },
      metrics: { upstream: 2, ms: 40 },
    });
    if (broken.has('auth-down')) {
      steps.push({
        id: 'timeout',
        label: 'SERVFAIL',
        caption: b('Авторитативный сервер молчит. Резолвер ждёт, повторяет вопрос и в конце концов возвращает программе код SERVFAIL, то есть «не удалось выяснить».', 'The authoritative server is silent. The resolver waits, tries again and gives up: it returns SERVFAIL to the client — “could not find out”.'),
        focus: ['res', 'q-res'],
        tokens: [{ edge: 'q-res', reverse: true, label: 'SERVFAIL' }],
        say: { res: b('Резолвер не дождался ответа от авторитативного сервера и возвращает SERVFAIL.', 'The resolver got no answer from the authoritative server and returns SERVFAIL.') },
        states: { auth: 'err', res: 'warn' },
        metrics: { upstream: 4, ms: 4040 },
        broken: { at: 'auth', message: '$ dig shop.example\n;; ->>HEADER<<- opcode: QUERY, status: SERVFAIL, id: 4242\n\n$ curl https://shop.example/\ncurl: (6) Could not resolve host: shop.example', caption: b('SERVFAIL означает не «такого имени нет», а «не удалось дозваться сервера, который знает ответ». Поломка находится в DNS, а её причину нужно искать на сервере зоны.', 'SERVFAIL is not “no such name” but “could not reach whoever knows”. The DNS layer; the cause is at the zone’s server.') },
      });
      return steps;
    }
    steps.push({
      id: 'auth',
      label: b('ответ', 'AA'),
      caption: fmt(b('Авторитативный сервер отвечает, что у shop.example адрес 198.51.100.20, а хранить ответ можно {t} с. Резолвер кладёт ответ в кэш на это время, запоминает заодно подсказки корня и зоны example. и передаёт адрес библиотеке.', 'The authoritative server answers that shop.example is at 198.51.100.20 and that it may be kept for {t} s. The resolver caches it for that time along with the root and example. zone referrals and hands the address to the library.'), { t: p.ttl }),
      focus: ['q-auth', 'auth', 'q-res'],
      tokens: [{ edge: 'q-auth', label: 'A 198.51.100.20', reverse: true }, { edge: 'q-res', reverse: true, label: '198.51.100.20' }],
      say: { auth: b('Авторитативный сервер сообщает адрес и срок его хранения.', 'The authoritative server gives the address and its lifetime.') },
      states: { auth: 'ok', 'q-auth': 'on' },
      values: { res: t(cacheLeft(p.ttl)) },
      metrics: { upstream: 3, ms: 62 },
    });
    const hit = p.second < p.ttl;
    steps.push({
      id: 'again',
      label: fmt(b('через {s} с', 'after {s} s'), { s: p.second }),
      caption: hit
        ? fmt(b('Второй запрос приходит через {s} с, а запись в кэше ещё действует, и до её истечения осталось {l} с. Резолвер отвечает из кэша за миллисекунду, и авторитативный сервер об этом запросе не узнаёт.', 'The second request comes after {s} s, and the cached record is still valid for {l} s more. The resolver answers from its cache in a millisecond, and the authoritative server never learns about this request.'), { s: p.second, l: p.ttl - p.second })
        : fmt(b('Второй запрос приходит через {s} с, а срок хранения записи A, {t} с, уже истёк, и резолвер её выбросил. Подсказки корня и зоны example. хранятся сутки и ещё лежат в кэше, поэтому резолвер сразу задаёт один вопрос авторитативному серверу.', 'The second request comes after {s} s, the A record’s {t} s lifetime has run out, and the resolver dropped it. The root and example. zone referrals last a day and are still cached, so the resolver asks the authoritative server only once.'), { s: p.second, t: p.ttl }),
      focus: hit ? ['q-res', 'res'] : ['res', 'q-auth', 'auth'],
      tokens: hit
        ? [{ edge: 'q-res', reverse: true, label: b('из кэша', 'from cache') }]
        : [{ edge: 'q-auth', label: 'A? shop.example.' }],
      say: { res: hit ? b('Резолвер отвечает из кэша, ни о чём не спрашивая другие серверы.', 'The resolver answers from its cache without asking anyone.') : b('Резолвер снова спрашивает авторитативный сервер.', 'The resolver asks the authoritative server again.') },
      values: { res: hit ? t(cacheLeft(p.ttl - p.second)) : t(cacheLeft(p.ttl)) },
      metrics: { upstream: hit ? 3 : 4, ms: hit ? 1 : 22 },
    });
    return steps;
  },
  explainDelta(prev, next, change, _a, bb) {
    if (change.kind === 'break') {
      if (!change.on) return b('Поломку убрали, и резолвер снова получает ответ.', 'The break is removed: the resolver reaches the answer again.');
      return change.id === 'typo'
        ? b('Из-за опечатки в зоне первого уровня ответ NXDOMAIN даёт сам корневой сервер, и дальше вопрос не идёт.', 'A typo in the top-level zone: the root itself answers NXDOMAIN; the question goes no further.')
        : b('Сервер зоны молчит, поэтому резолвер возвращает SERVFAIL, а curl пишет «Could not resolve host».', 'The zone’s server is silent: the resolver returns SERVFAIL, curl — “Could not resolve host”.');
    }
    const u0 = lastMetric(prev, 'upstream') ?? 0;
    const u1 = lastMetric(next, 'upstream') ?? 0;
    if (change.id === 'second' || change.id === 'ttl') {
      const hit = (bb.second as number) < (bb.ttl as number);
      return fmt(
        hit
          ? b('Второй запрос через {s} с при сроке хранения {t} с получает ответ из кэша. Число вопросов к серверам изменилось с {u0} до {u1}.', 'Second request after {s} s with a TTL of {t} s comes from the cache. Questions to servers: {u0} → {u1}.')
          : b('Второй запрос через {s} с при сроке хранения {t} с не застаёт запись A в кэше, и резолверу приходится снова спросить сервер магазина, поэтому число вопросов изменилось с {u0} до {u1}. Чем дольше разрешено хранить запись, тем реже резолвер задаёт вопросы, но после смены адреса старый адрес так же долго остаётся в кэшах.', 'Second request after {s} s with a TTL of {t} s no longer finds the A record cached, so the resolver asks the shop’s server again. Questions: {u0} → {u1}. A long TTL saves queries, but after an address change the old one is kept just as long.'),
        { s: bb.second as number, t: bb.ttl as number, u0, u1 },
      );
    }
    if (change.id === 'hosts')
      return bb.hosts
        ? b('Имя записано в /etc/hosts, поэтому библиотека отвечает сама и DNS не спрашивает. Команда dig при этом покажет ответ DNS, и отсюда берётся ситуация «у меня работает, а dig показывает другое».', 'The name is in /etc/hosts: the stub answers itself and DNS is not asked. dig still shows the DNS answer — hence “it works for me, but dig says otherwise”.')
        : b('Имени больше нет в файле, и адрес снова ищется через DNS.', 'The file no longer has the name: DNS again.');
    return bb.qmin
      ? b('Минимизация включена, и корневой сервер и сервер зоны example. узнают только нужную им часть имени.', 'Minimisation on: the root and the TLD learn only the part of the name they need.')
      : b('Минимизация выключена, и полное имя получают и корневой сервер, и сервер зоны example.', 'Minimisation off: the full name goes to the root and to the TLD.');
  },
});
