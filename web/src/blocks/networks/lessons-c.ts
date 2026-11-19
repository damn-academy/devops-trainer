// Lessons 10–15 of the Networks block: NAT and netfilter, HTTP, TLS and SSH,
// proxies and the 504, layer-by-layer troubleshooting with the URL explainer,
// and the protocol catalogue (03 §5.3, net.m09–m13, m16; §13).

import { bi } from '../../core/i18n';
import type { Facts, Lesson } from '../../core/types';
import { PROXY_CONF_SINGLE } from '../../engine/sim-net/presets';
import { lab } from './lessons-a';
import { EN, RU, src } from './sources';

// ── 10. NAT and netfilter ──────────────────────────────────────────────────

export const nat: Lesson = {
  id: 'networks.nat',
  block: 'networks',
  title: bi('NAT и netfilter', 'NAT and netfilter'),
  summary: bi('Как миллионы квартир с одинаковыми адресами выходят в интернет, почему снаружи к вам не подключиться и где в ядре живут правила.', 'How millions of flats with the same addresses get onto the internet, why nobody outside can connect to you, and where in the kernel the rules live.'),
  introduces: ['net.nat', 'net.conntrack', 'net.netfilter', 'net.dnat'],
  uses: ['net.private', 'net.router', 'net.port', 'net.tcp', 'net.route-table', 'net.gateway', 'net.ephemeral'],
  tier: 'core',
  minutes: 45,
  sources: src([EN.rfc3022, EN.rfc1918, EN.rfc6598, EN.iptables, EN.netfilter], [RU.nat, RU.iptables, RU.netfilter]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'У вас дома ноутбук 192.168.1.23. У соседа — тоже 192.168.1.23. И у миллиона других квартир. Частные адреса в интернете не маршрутизируются, так что сайт никак не может ответить «192.168.1.23» — а страница всё-таки открывается. Кто-то по дороге подменил адрес.',
        'At home your laptop is 192.168.1.23. Your neighbour’s is 192.168.1.23 too. And a million other flats’. Private addresses are not routed on the internet, so a site cannot possibly answer “192.168.1.23” — and yet the page opens. Someone on the way replaced the address.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.nat', caption: bi('Добавьте устройств, попробуйте подключиться снаружи, уберите правило NAT.', 'Add devices, try to connect from outside, remove the NAT rule.') },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Подмена адреса и таблица соединений', 'Address rewriting and the connection table'),
      body: bi(
        'Подменяет домашний роутер. На выходе в интернет он меняет в пакете адрес источника на свой публичный, а порт — на свободный свой: `192.168.1.23:51234` превращается в `203.0.113.7:40001`. Это [[net.nat|NAT]], а точнее SNAT, в Linux его частный случай называют MASQUERADE — «взять адрес того интерфейса, через который пакет уходит».\n\nЧтобы ответ вернулся к нужной машине, роутер записывает соответствие в [[net.conntrack|conntrack]] — таблицу соединений ядра: «192.168.1.23:51234 к 198.51.100.20:443 выходит как :40001». Ответ приходит на `203.0.113.7:40001`, роутер находит строку и переписывает получателя обратно. Ноутбук ничего не заметил. Дома двадцать устройств — двадцать и больше строк, и различает их только внешний порт.\n\nОтсюда следствие: снаружи к ноутбуку не подключиться. Новый пакет на `203.0.113.7:27015` приходит, а строки для него в conntrack нет — роутер не знает, кому из домашних машин его отдать. Чтобы пустить соединение внутрь, нужен [[net.dnat|проброс порта]] (DNAT): правило «всё, что пришло на :80, — к 10.0.2.20:8080». А если провайдер сам выдал роутеру адрес из `100.64.0.0/10` (CGNAT), то вы за двумя NAT — и проброс на своём роутере не поможет. Есть и обратная сторона: у облачного NAT-шлюза при тысячах соединений к одному адресу кончаются внешние порты, и новые соединения начинают отказывать.',
        'The home router does it. On the way to the internet it changes the packet’s source address to its own public one and the port to a free one of its own: `192.168.1.23:51234` becomes `203.0.113.7:40001`. This is [[net.nat|NAT]], more precisely SNAT; in Linux a special case of it is called MASQUERADE — “take the address of the interface the packet leaves through”.\n\nFor the answer to find its way back to the right machine, the router records the mapping in [[net.conntrack|conntrack]] — the kernel’s connection table: “192.168.1.23:51234 to 198.51.100.20:443 goes out as :40001”. The answer arrives at `203.0.113.7:40001`, the router finds the line and rewrites the destination back. The laptop noticed nothing. Twenty devices at home mean twenty or more lines, and only the outside port tells them apart.\n\nOne consequence: nobody outside can connect to the laptop. A new packet arrives at `203.0.113.7:27015`, and conntrack has no line for it — the router does not know which home machine to give it to. To let a connection in you need [[net.dnat|port forwarding]] (DNAT): a rule “everything that arrives on :80 goes to 10.0.2.20:8080”. And if the provider itself gave the router an address from `100.64.0.0/10` (CGNAT), you are behind two NATs — and forwarding on your own router will not help. There is a flip side too: a cloud NAT gateway runs out of outside ports with thousands of connections to one address, and new connections start failing.',
      ),
    },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Где живут правила: netfilter', 'Where the rules live: netfilter'),
      body: bi(
        'И NAT, и фильтр, который в уроке про TCP молча выбрасывал пакеты, — это [[net.netfilter|netfilter]], подсистема ядра Linux, через которую проходит каждый пакет. Правила сгруппированы в таблицы: `filter` решает судьбу пакета (пропустить или выбросить), `nat` меняет адреса. Внутри таблиц — цепочки, привязанные к точкам пути пакета через ядро:\n\n- `PREROUTING` — сразу как пакет пришёл, до решения, куда его деть (здесь DNAT);\n- `INPUT` — пакет адресован самой машине;\n- `FORWARD` — пакет идёт сквозь машину, как через маршрутизатор;\n- `OUTPUT` — пакет создан на этой машине;\n- `POSTROUTING` — перед самым уходом в провод (здесь SNAT и MASQUERADE).\n\nПравила в цепочке проверяются сверху вниз до первого совпадения с вердиктом: `ACCEPT` — пропустить, `DROP` — молча выбросить (клиент ждёт до таймаута), `REJECT` — выбросить и сообщить отправителю (клиент сразу получает отказ). Если ни одно не совпало, действует политика цепочки. Правило `-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT` пропускает ответы на соединения, которые машина открыла сама: здесь conntrack работает уже как память фильтра.\n\nУправляют всем этим командой `iptables` (`iptables -t nat -L -n -v` показывает таблицу nat со счётчиками) или её современной заменой `nft`; в новых дистрибутивах `iptables` часто работает поверх nftables. И одно условие без правил: чтобы машина пересылала пакеты между интерфейсами, нужно `net.ipv4.ip_forward = 1`. Ровно такие же правила через несколько блоков вы увидите у Docker и у Kubernetes.',
        'Both NAT and the filter that silently dropped packets in the TCP lesson are [[net.netfilter|netfilter]], the Linux kernel subsystem every packet passes through. Rules are grouped into tables: `filter` decides a packet’s fate (pass or drop), `nat` rewrites addresses. Inside the tables are chains, tied to points on the packet’s path through the kernel:\n\n- `PREROUTING` — as soon as the packet arrives, before deciding where it goes (DNAT is here);\n- `INPUT` — the packet is addressed to the machine itself;\n- `FORWARD` — the packet passes through the machine, as through a router;\n- `OUTPUT` — the packet was created on this machine;\n- `POSTROUTING` — just before it goes onto the wire (SNAT and MASQUERADE are here).\n\nRules in a chain are checked top to bottom until the first match with a verdict: `ACCEPT` — let it through, `DROP` — silently drop it (the client waits for a timeout), `REJECT` — drop it and tell the sender (the client is refused at once). If none matches, the chain’s policy applies. The rule `-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT` lets through replies to connections the machine opened itself: here conntrack already works as the filter’s memory.\n\nAll of this is managed with `iptables` (`iptables -t nat -L -n -v` shows the nat table with counters) or its modern replacement `nft`; on new distributions `iptables` often works on top of nftables. And one condition that is not a rule: for a machine to forward packets between interfaces you need `net.ipv4.ip_forward = 1`. A few blocks from now you will see exactly these rules in Docker and in Kubernetes.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('gw', 'nat', {}, [
        { id: 'out', kind: 'http', from: 'app', to: 'http://203.0.113.50/' },
        { id: 'in', kind: 'http', from: 'ext', to: 'http://203.0.113.10/' },
      ]),
      intro: bi('Вы на шлюзе офиса gw: eth0 смотрит в офисную сеть 10.0.2.0/24 (там сервер app 10.0.2.20 с приложением на 8080), eth1 — в интернет, адрес 203.0.113.10. Внешний сайт — 203.0.113.50.', 'You are on the office gateway gw: eth0 faces the office network 10.0.2.0/24 (with server app 10.0.2.20 running an application on 8080), eth1 faces the internet with address 203.0.113.10. An outside site is 203.0.113.50.'),
      tasks: [
        {
          id: 'forward',
          prompt: bi('Включите на gw пересылку пакетов между интерфейсами.', 'Turn on packet forwarding between interfaces on gw.'),
          check: { when: "net.sysctl['net.ipv4.ip_forward']=1" },
          chips: 'sysctl -w net.ipv4.ip_forward=1',
          docRef: { page: 'man/sysctl.8', anchor: 'EXAMPLES', line: 'net.ipv4.ip_forward=1' },
          hints: { H1: bi('Это параметр ядра net.ipv4.ip_forward.', 'It is the kernel parameter net.ipv4.ip_forward.'), H2: bi('sysctl -w ключ=значение', 'sysctl -w key=value') },
        },
        {
          id: 'masq',
          prompt: bi('Дайте офисной сети выход в интернет: app должен открыть http://203.0.113.50/.', 'Give the office network a way out to the internet: app must be able to open http://203.0.113.50/.'),
          check: {
            when: 'reach.out.status=200',
            fail: [
              { if: "net.sysctl['net.ipv4.ip_forward']=0", say: bi('Пересылка выключена: gw не передаёт пакеты из eth0 в eth1.', 'Forwarding is off: gw does not pass packets from eth0 to eth1.') },
              { if: "!(net.iptables.nat~'MASQUERADE') && !(net.iptables.nat~'SNAT')", say: bi('Пакеты уходят с частным адресом 10.0.2.20 — ответ на него в интернете не найдёт дороги. Нужна подмена источника в POSTROUTING.', 'Packets leave with the private address 10.0.2.20 — an answer to it cannot find its way on the internet. You need source rewriting in POSTROUTING.') },
            ],
          },
          chips: 'iptables -t nat -A POSTROUTING -s 10.0.2.0/24 -o eth1 -j MASQUERADE',
          docRef: { page: 'man/iptables.8', anchor: 'EXAMPLES', line: 'MASQUERADE' },
          concepts: ['net.nat', 'net.conntrack'],
          hints: {
            H1: bi('Ответ должен вернуться на публичный адрес gw — значит, адрес источника надо подменить на выходе.', 'The answer must come back to gw’s public address — so the source address must be rewritten on the way out.'),
            H2: bi('Таблица nat, цепочка POSTROUTING, цель MASQUERADE, интерфейс eth1.', 'Table nat, chain POSTROUTING, target MASQUERADE, interface eth1.'),
            H3: bi('iptables -t nat -A POSTROUTING -s 10.0.2.0/24 -o eth1 -j MASQUERADE', 'iptables -t nat -A POSTROUTING -s 10.0.2.0/24 -o eth1 -j MASQUERADE'),
          },
        },
        {
          id: 'dnat',
          prompt: bi('Пробросьте порт: соединения из интернета на 203.0.113.10:80 должны попадать в приложение 10.0.2.20:8080.', 'Forward a port: connections from the internet to 203.0.113.10:80 must reach the application at 10.0.2.20:8080.'),
          check: {
            when: "reach.in.status=200 && net.iptables.nat~'DNAT'",
            fail: [{ if: "net.iptables.nat~'-A POSTROUTING.*DNAT'", say: bi('DNAT работает в PREROUTING: адрес назначения надо подменить до решения о маршруте.', 'DNAT works in PREROUTING: the destination must be rewritten before the routing decision.') }],
          },
          chips: 'iptables -t nat -A PREROUTING -i eth1 -p tcp --dport 80 -j DNAT --to-destination 10.0.2.20:8080',
          docRef: { page: 'man/iptables.8', anchor: 'EXAMPLES', line: 'DNAT' },
          concepts: ['net.dnat'],
          hints: {
            H1: bi('Подменить нужно адрес и порт назначения — сразу как пакет пришёл.', 'You must rewrite the destination address and port — as soon as the packet arrives.'),
            H2: bi('Таблица nat, цепочка PREROUTING, -p tcp --dport 80, цель DNAT --to-destination.', 'Table nat, chain PREROUTING, -p tcp --dport 80, target DNAT --to-destination.'),
          },
        },
        {
          id: 'counters',
          prompt: bi('Посмотрите таблицу nat со счётчиками пакетов: правила, через которые прошли соединения, уже не нулевые.', 'Look at the nat table with packet counters: the rules the connections went through are no longer zero.'),
          check: { stdout: /Chain POSTROUTING \(policy ACCEPT/ },
          chips: 'iptables -t nat -L -n -v',
          hints: { H1: bi('-L — список, -n — без имён, -v — со счётчиками.', '-L lists, -n skips names, -v adds counters.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('В iptables(8) есть раздел, где перечислены таблицы filter и nat и их встроенные цепочки. Нажмите на него.', 'iptables(8) has a section listing the filter and nat tables and their built-in chains. Click it.'),
      ref: { page: 'man/iptables.8' },
      answer: 'TABLES',
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi(
        'Правила цепочки проверяются по порядку, сверху вниз, и чтобы вставить правило перед другим или удалить одно, не трогая соседей, нужно знать его номер. Найдите в iptables(8), как напечатать номера строк, и выведите так таблицу nat.',
        'The rules of a chain are checked in order, top to bottom, and to insert a rule before another or delete one without touching its neighbours you need its number. Find in iptables(8) how to print the line numbers, and list the nat table that way.',
      ),
      ref: { page: 'man/iptables.8', anchor: 'OPTIONS', line: '--line-numbers' },
      terminal: {
        setup: lab('gw', 'nat', { configured: true }),
        task: {
          id: 'lines',
          prompt: bi('Таблица nat с номерами правил.', 'The nat table with rule numbers.'),
          check: { stdout: /^num\s+target[\s\S]*MASQUERADE/m },
          docStep: 3,
          chips: 'iptables -t nat -L -n --line-numbers',
          hints: { H1: bi('Номера появляются только при выводе списка, то есть вместе с -L.', 'The numbers appear only when listing, that is, together with -L.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.nat.inbound', 'net.q.nat.hooks', 'net.q.nat.reject', 'net.q.nat.est'] },
  ],
};

// ── 11. HTTP ───────────────────────────────────────────────────────────────

export const http: Lesson = {
  id: 'networks.http',
  block: 'networks',
  title: bi('HTTP', 'HTTP'),
  summary: bi('Текст поверх TCP: строка запроса, заголовки, коды ответа. Разобрать curl -v построчно и поговорить с сервером руками.', 'Text over TCP: the request line, headers, status codes. Take curl -v apart line by line and talk to a server by hand.'),
  introduces: ['net.http', 'net.status', 'net.host-header', 'net.keepalive'],
  uses: ['net.tcp', 'net.port', 'net.dns', 'net.handshake', 'net.rtt'],
  tier: 'core',
  minutes: 35,
  sources: src([EN.mdnHttp, EN.mdnStatus, EN.rfc9110, EN.rfc9112, EN.curl], [RU.http, RU.mdnHttp, RU.mdnStatus, RU.codes]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В блоке Linux `curl` возвращал страницу, а `curl -v` — ещё и строки со знаками `>` и `<`. Это не шум: это весь разговор клиента с сервером, слово в слово. HTTP — текстовый протокол, и его можно прочитать глазами.',
        'In the Linux block `curl` returned a page and `curl -v` also printed lines with `>` and `<`. That is not noise: it is the whole conversation between client and server, word for word. HTTP is a text protocol, and you can read it with your eyes.',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Запрос и ответ', 'Request and answer'),
      body: bi(
        '[[net.http|HTTP]] работает поверх TCP: клиент открывает соединение на порт 80 и пишет в него текст.\n\n```\nGET /catalog HTTP/1.1\nHost: shop.example\nUser-Agent: curl/8.14.1\nAccept: */*\n\n```\n\nПервая строка — строка запроса: метод (`GET` — получить, `POST` — отправить данные, ещё `PUT`, `DELETE`, `HEAD`), путь и версия протокола. Дальше заголовки «имя: значение», а пустая строка говорит «заголовки кончились»; после неё может идти тело. Сервер отвечает так же: строка статуса `HTTP/1.1 200 OK`, заголовки (`Content-Type`, `Content-Length`, `Server`), пустая строка, тело.\n\nСамый важный заголовок запроса — [[net.host-header|заголовок Host]]. На одном IP-адресе живут десятки и сотни сайтов: DNS у них разный, а адрес общий. Сервер узнаёт, какой сайт вы просите, только по Host. Без него сервер HTTP/1.1 ответит 400.\n\nТри цифры в строке статуса — [[net.status|код статуса]]. Первая цифра говорит, чья это ответственность:\n\n- `2xx` — успех: 200 OK, 201 Created, 204 No Content;\n- `3xx` — «иди туда»: 301 и 308 — переехал навсегда, 302 — временно, адрес в заголовке `Location`; 304 — «у вас уже свежая копия»;\n- `4xx` — ошибка клиента: 400 — запрос испорчен, 401 — нужна аутентификация, 403 — нельзя, 404 — нет такого пути, 429 — слишком часто;\n- `5xx` — ошибка сервера: 500 — сломалось приложение, 502 и 504 — прокси не получил ответа от того, кто за ним (об этом — через урок), 503 — сервис временно недоступен.\n\nНабрали `http://shop.example` — а открылся `https://`? Сервер ответил 301 с `Location: https://shop.example/`, и браузер пошёл по новому адресу. Это обычный способ «перевести» сайт на HTTPS.\n\nЧтобы не платить рукопожатием за каждый запрос, соединение держат открытым: [[net.keepalive|keep-alive]]. Браузер получил HTML и по тому же соединению просит стили, скрипты и картинки.',
        '[[net.http|HTTP]] runs over TCP: the client opens a connection to port 80 and writes text into it.\n\n```\nGET /catalog HTTP/1.1\nHost: shop.example\nUser-Agent: curl/8.14.1\nAccept: */*\n\n```\n\nThe first line is the request line: the method (`GET` to fetch, `POST` to send data, also `PUT`, `DELETE`, `HEAD`), the path and the protocol version. Then headers “name: value”, and an empty line says “the headers are over”; a body may follow it. The server answers the same way: a status line `HTTP/1.1 200 OK`, headers (`Content-Type`, `Content-Length`, `Server`), an empty line, the body.\n\nThe most important request header is the [[net.host-header|Host header]]. Dozens or hundreds of sites live on one IP address: their DNS names differ, their address is shared. The server learns which site you want only from Host. Without it an HTTP/1.1 server answers 400.\n\nThe three digits in the status line are the [[net.status|status code]]. The first digit tells whose responsibility it is:\n\n- `2xx` — success: 200 OK, 201 Created, 204 No Content;\n- `3xx` — “go there”: 301 and 308 moved for good, 302 temporarily, the address is in the `Location` header; 304 — “your copy is still fresh”;\n- `4xx` — a client error: 400 a broken request, 401 authentication needed, 403 not allowed, 404 no such path, 429 too often;\n- `5xx` — a server error: 500 the application broke, 502 and 504 a proxy got no answer from whoever is behind it (that is two lessons on), 503 the service is temporarily unavailable.\n\nTyped `http://shop.example` and got `https://`? The server answered 301 with `Location: https://shop.example/`, and the browser followed the new address. This is the usual way to “move” a site to HTTPS.\n\nTo avoid paying a handshake for every request, the connection is kept open: [[net.keepalive|keep-alive]]. The browser gets the HTML and asks for styles, scripts and images over the same connection.',
      ),
    },
    {
      id: 'h2',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('HTTP/2 и HTTP/3', 'HTTP/2 and HTTP/3'),
      body: bi(
        'Смысл запросов тот же, меняется упаковка. HTTP/2 — бинарные кадры HEADERS и DATA, заголовки `:method`, `:path`, `:authority` вместо строки запроса и Host, и много параллельных потоков в одном соединении. HTTP/3 переносит всё это на QUIC поверх UDP 443: транспорт и шифрование договариваются за один обмен. Потрогать их можно в каталоге протоколов в конце блока.',
        'The meaning of requests stays the same; the packaging changes. HTTP/2 uses binary HEADERS and DATA frames, the headers `:method`, `:path`, `:authority` instead of a request line and Host, and many parallel streams on one connection. HTTP/3 moves all of this to QUIC over UDP 443: transport and encryption are negotiated in one exchange. You can explore them in the protocol catalogue at the end of the block.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('client', 'tcp'),
      intro: bi('Клиент и сервер srv (10.0.0.2), на его порту 8080 — небольшое веб-приложение.', 'A client and server srv (10.0.0.2) with a small web application on port 8080.'),
      tasks: [
        {
          id: 'verbose',
          prompt: bi('Запросите http://10.0.0.2:8080/ так, чтобы увидеть и запрос, и заголовки ответа.', 'Request http://10.0.0.2:8080/ so that you see both the request and the answer headers.'),
          check: { stdout: /< HTTP\/1\.1 200 OK/ },
          chips: 'curl -v http://10.0.0.2:8080/',
          docRef: { page: 'man/curl.1', anchor: 'OPTIONS', line: '-v, --verbose' },
          hints: { H1: bi('Строки «>» — то, что отправил curl, «<» — что ответил сервер.', '“>” lines are what curl sent, “<” what the server answered.') },
        },
        {
          id: 'byhand',
          prompt: bi('Поговорите с сервером руками: отправьте через nc строку запроса и заголовок Host и получите ответ 200.', 'Talk to the server by hand: send a request line and a Host header through nc and get a 200 answer.'),
          check: { stdout: /^HTTP\/1\.1 200 OK/m, fail: [{ if: "term['main'][last].out~'400 Bad Request'", say: bi('Сервер ответил 400: проверьте порядок в строке запроса (метод, путь, версия) и заголовок Host.', 'The server answered 400: check the order in the request line (method, path, version) and the Host header.') }] },
          chips: 'echo -e "GET / HTTP/1.1\\r\\nHost: srv\\r\\n\\r\\n" | nc 10.0.0.2 8080',
          hints: {
            H1: bi('nc отправит на сервер всё, что получит на вход.', 'nc sends the server everything it gets on its input.'),
            H2: bi('Строки HTTP разделяются \\r\\n, а заголовки кончаются пустой строкой. echo -e понимает такие последовательности.', 'HTTP lines are separated by \\r\\n, and the headers end with an empty line. echo -e understands such sequences.'),
          },
        },
        {
          id: 'missing',
          prompt: bi('Запросите несуществующий путь http://10.0.0.2:8080/nope с заголовками ответа и посмотрите на код.', 'Request a path that does not exist, http://10.0.0.2:8080/nope, with the answer headers, and look at the code.'),
          check: { stdout: /HTTP\/1\.1 404 Not Found/ },
          chips: 'curl -i http://10.0.0.2:8080/nope',
          hints: { H1: bi('-i добавляет заголовки ответа к выводу.', '-i adds the answer headers to the output.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('curl завершился с кодом 7, а в другой раз — с 28. В каком разделе curl(1) объяснено, что значат эти числа? Нажмите на раздел.', 'curl ended with code 7 once and with 28 another time. Which section of curl(1) explains what these numbers mean? Click the section.'),
      ref: { page: 'man/curl.1' },
      answer: 'EXIT STATUS',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Скрипту мониторинга нужен только код ответа: одна строка, три цифры, без тела страницы. Получите так код для http://10.0.0.2:8080/nope.', 'A monitoring script needs only the status code: one line, three digits, no page body. Get the code for http://10.0.0.2:8080/nope that way.'),
      ref: { page: 'man/curl.1' },
      terminal: {
        setup: lab('client', 'tcp'),
        task: {
          id: 'code',
          prompt: bi('Только код ответа — 404.', 'Only the status code — 404.'),
          check: { stdout: /^404\n?$/ },
          docStep: 4,
          beyond: true,
          solutionTokens: ['-w', '--write-out', 'http_code', '%{http_code}'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.http.codes', 'net.q.http.host', 'net.q.http.redirect', 'net.q.http.bug'] },
  ],
};

// ── 12. TLS, HTTPS and SSH ─────────────────────────────────────────────────

export const tls: Lesson = {
  id: 'networks.tls',
  block: 'networks',
  title: bi('TLS, HTTPS и SSH', 'TLS, HTTPS and SSH'),
  summary: bi('Шифрование и подлинность: сертификат, цепочка до корня, рукопожатие TLS 1.3, что видно постороннему, и SSH как второй шифрованный канал.', 'Encryption and authenticity: the certificate, the chain to a root, the TLS 1.3 handshake, what an outsider sees, and SSH as the second encrypted channel.'),
  introduces: ['net.tls', 'net.cert', 'net.ca', 'net.sni'],
  uses: ['net.tcp', 'net.handshake', 'net.http', 'net.rtt', 'net.keepalive', 'net.dns'],
  tier: 'core',
  minutes: 40,
  sources: src([EN.rfc8446, EN.tls13, EN.tlsHandshake, EN.sslcerts], [RU.tls, RU.cert, RU.ssh]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В кафе с открытым Wi-Fi любой сосед по сети может видеть ваши кадры. Если сайт открыт по `http://`, он прочитает и запрос, и пароль из формы, и ответ — текстом, как вы читали их в прошлом уроке. Даже хуже: он может подменить ответ. Нужны две вещи сразу: чтобы никто не прочитал, и чтобы на том конце был именно тот сервер.',
        'In a café with open Wi-Fi any neighbour on the network can see your frames. If a site is opened over `http://`, they read the request, the password from the form and the answer — as plain text, the way you read them last lesson. Worse: they can replace the answer. Two things are needed at once: that nobody can read it, and that the server at the other end is the right one.',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Сертификат и цепочка доверия', 'The certificate and the chain of trust'),
      body: bi(
        'Обе задачи решает [[net.tls|TLS]]. HTTPS — это тот же HTTP, только внутри TLS, на порту 443. Шифрование устроено на паре ключей: что зашифровано открытым ключом, расшифрует только закрытый, и подпись закрытым ключом проверяется открытым. Клиент и сервер обмениваются открытыми частями и получают общий секрет, которого не видел никто на пути.\n\nНо как убедиться, что открытый ключ пришёл от shop.example, а не от соседа по Wi-Fi? Для этого есть [[net.cert|сертификат]]: открытый ключ сервера вместе с его именем (поле subjectAltName) и сроком действия, подписанные тем, кому доверяет ваша система. Подписывает [[net.ca|удостоверяющий центр]] — обычно не сам, а через промежуточный сертификат. Клиент проверяет цепочку: сертификат сайта подписан промежуточным, промежуточный — корневым, а корневой лежит в системе заранее, в `/etc/ssl/certs`.\n\nПроверок три, и у каждой своя ошибка `curl` с кодом 60: срок (`certificate has expired`; неверные часы на клиенте дают ту же картину), имя (`no alternative certificate subject name matches target host name` — сертификат выписан на www, а заходят без www) и цепочка (`unable to get local issuer certificate` — сервер забыл прислать промежуточный сертификат). Все три — слой TLS: сеть и сервер в порядке, не прошла проверка подлинности.',
        '[[net.tls|TLS]] solves both. HTTPS is the same HTTP, only inside TLS, on port 443. Encryption is built on a key pair: what is encrypted with the public key only the private key can decrypt, and a signature made with the private key is checked with the public one. Client and server exchange public parts and arrive at a shared secret nobody on the path has seen.\n\nBut how do you know the public key came from shop.example and not from your Wi-Fi neighbour? That is what a [[net.cert|certificate]] is for: the server’s public key together with its name (the subjectAltName field) and validity dates, signed by someone your system trusts. It is signed by a [[net.ca|certificate authority]] — usually not directly but through an intermediate certificate. The client checks the chain: the site’s certificate is signed by the intermediate, the intermediate by a root, and the root is already on the system, in `/etc/ssl/certs`.\n\nThere are three checks, each with its own `curl` error, code 60: the dates (`certificate has expired`; a wrong clock on the client looks the same), the name (`no alternative certificate subject name matches target host name` — the certificate is for www and people come without www) and the chain (`unable to get local issuer certificate` — the server forgot to send the intermediate certificate). All three are the TLS layer: the network and the server are fine, the authenticity check failed.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.tls', caption: bi('Растяните RTT, переключите TLS 1.2 и HTTP/3, откройте соединение заранее, сломайте сертификат.', 'Stretch the RTT, switch to TLS 1.2 and HTTP/3, open the connection in advance, break the certificate.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Рукопожатие TLS 1.3 и что видно снаружи', 'The TLS 1.3 handshake and what is visible outside'),
      body: bi(
        'После TCP-рукопожатия клиент шлёт ClientHello — ещё открытым текстом. В нём версии TLS, которые клиент умеет, имя сайта ([[net.sni|SNI]], Server Name Indication: по нему сервер выбирает, какой сертификат предъявить), список протоколов поверх (ALPN: h2, http/1.1) и половина обмена ключами (key_share; современный клиент предлагает гибридный `X25519MLKEM768` вместе с `x25519`). Сервер отвечает ServerHello со своей половиной ключа — и всё дальнейшее уже зашифровано: сертификат, подпись, Finished. Клиент проверяет сертификат, шлёт свой Finished и сразу зашифрованный HTTP-запрос. TLS 1.3 тратит на это один круг RTT, поэтому до первого байта ответа новое HTTPS-соединение проходит три круга: TCP, TLS, запрос. Старый TLS 1.2 — четыре. С keep-alive второй запрос — один.\n\nЧто видит сосед по Wi-Fi или провайдер? Адреса и порты, размеры и время пакетов — и SNI, имя сайта: оно в открытой части ClientHello. Путь, заголовки, cookies, тело — нет. (Расширение ECH скрывает и SNI, но пока встречается редко.)\n\nТа же логика у SSH, с которым вы входили на машины в блоке Linux. Обмен ключами — и проверка ключа сервера. Только вместо цепочки до удостоверяющего центра SSH сверяет отпечаток ключа с тем, что запомнил при первом входе, в `~/.ssh/known_hosts`. Сообщение `Host key verification failed` — прямой аналог ошибки сертификата: «на том конце не тот, кого я знаю». Либо сервер переустановили, либо вас перехватывают — и прежде чем удалять строку из known_hosts, стоит выяснить, что из двух.',
        'After the TCP handshake the client sends ClientHello — still in clear text. It carries the TLS versions the client speaks, the site name ([[net.sni|SNI]], Server Name Indication: by it the server chooses which certificate to present), the list of protocols on top (ALPN: h2, http/1.1) and half of the key exchange (key_share; a modern client offers the hybrid `X25519MLKEM768` together with `x25519`). The server answers ServerHello with its half of the key — and everything after that is encrypted: the certificate, the signature, Finished. The client checks the certificate, sends its own Finished and right away the encrypted HTTP request. TLS 1.3 spends one RTT on this, so a new HTTPS connection takes three round trips to the first byte of the answer: TCP, TLS, the request. The old TLS 1.2 takes four. With keep-alive a second request takes one.\n\nWhat does a Wi-Fi neighbour or the provider see? Addresses and ports, sizes and timings of packets — and the SNI, the site name: it is in the clear part of ClientHello. Not the path, the headers, the cookies or the body. (The ECH extension hides the SNI too, but it is still rare.)\n\nThe same logic holds for SSH, which you used to log in to machines in the Linux block. A key exchange — and a check of the server’s key. Only instead of a chain to a certificate authority SSH compares the key’s fingerprint with what it remembered on the first login, in `~/.ssh/known_hosts`. The message `Host key verification failed` is a direct analogue of a certificate error: “the other end is not the one I know”. Either the server was reinstalled or you are being intercepted — and before deleting the line from known_hosts it is worth finding out which.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home'),
      intro: bi('Ноутбук в домашней сети. На хостинге четыре сайта: shop.example, expired.example, wrong.example и chain.example. С сертификатом в порядке только у одного.', 'A laptop on a home network. The hosting has four sites: shop.example, expired.example, wrong.example and chain.example. Only one has a certificate in order.'),
      tasks: [
        {
          id: 'expire',
          prompt: bi('Узнайте, до какого числа действует сертификат shop.example, и запишите дату (как её печатает curl) в ~/expire.txt.', 'Find out until what date the certificate of shop.example is valid and write the date (as curl prints it) into ~/expire.txt.'),
          check: { when: "files['/root/expire.txt'].text~'Dec 30'", fail: [{ if: "files['/root/expire.txt'].text~'Sep'", say: bi('Сентябрь — это start date, начало срока. Нужна expire date.', 'September is the start date. You need the expire date.') }] },
          chips: 'curl -vI https://shop.example/',
          hints: { H1: bi('curl -v печатает раздел «Server certificate».', 'curl -v prints a “Server certificate” section.'), H2: bi('Строка «expire date:».', 'The “expire date:” line.') },
        },
        {
          id: 'name',
          prompt: bi('У одного из трёх сайтов — expired.example, wrong.example, chain.example — сертификат выписан на другое имя. Найдите его и запишите имя сайта в ~/mismatch.txt.', 'One of the three sites — expired.example, wrong.example, chain.example — has a certificate issued for another name. Find it and write the site’s name into ~/mismatch.txt.'),
          check: {
            when: "files['/root/mismatch.txt'].text~'wrong.example' && !(files['/root/mismatch.txt'].text~'expired') && !(files['/root/mismatch.txt'].text~'chain')",
            fail: [
              { if: "files['/root/mismatch.txt'].text~'expired'", say: bi('У expired.example с именем всё в порядке — у него вышел срок.', 'expired.example has the right name — its validity ended.') },
              { if: "files['/root/mismatch.txt'].text~'chain'", say: bi('У chain.example неполная цепочка: «unable to get local issuer certificate».', 'chain.example has an incomplete chain: “unable to get local issuer certificate”.') },
            ],
          },
          chips: 'curl https://wrong.example/',
          concepts: ['net.cert'],
          hints: { H1: bi('Откройте каждый сайт curl и сравните ошибки: у каждой проверки своя.', 'Open each site with curl and compare the errors: each check has its own.') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите в curl(1) флаг, который пропускает проверку сертификата, и откройте https://chain.example/. (На проде так не делают — это способ убедиться, что дело именно в цепочке.)', 'Find the curl(1) flag that skips the certificate check, and open https://chain.example/. (Nobody does this in production — it is a way to confirm the problem is the chain.)'),
      ref: { page: 'man/curl.1', anchor: 'OPTIONS', line: '-k, --insecure' },
      terminal: {
        setup: lab('laptop', 'home'),
        task: {
          id: 'k',
          prompt: bi('Откройте https://chain.example/ без проверки сертификата.', 'Open https://chain.example/ without checking the certificate.'),
          check: { stdout: /^chain$/m },
          docStep: 3,
          chips: 'curl -k https://chain.example/',
          hints: { H1: bi('Ищите в OPTIONS слово «insecure».', 'Look for the word “insecure” in OPTIONS.') },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi(
        'Сайт shop.example собираются перевести на новый сервер с адресом `198.51.100.30`. Прежде чем менять DNS, нужно проверить с ноутбука, отдаст ли этот сервер годный сертификат, когда браузер придёт к нему с именем shop.example. Ни DNS, ни `/etc/hosts` трогать нельзя: пусть curl сам подключится к этому адресу под этим именем.',
        'shop.example is about to move to a new server at `198.51.100.30`. Before DNS is changed, check from the laptop whether that server presents a valid certificate when a browser comes to it with the name shop.example. Neither DNS nor `/etc/hosts` may be touched: make curl itself connect to that address under that name.',
      ),
      ref: { page: 'man/curl.1' },
      terminal: {
        setup: lab('laptop', 'home'),
        task: {
          id: 'resolve',
          prompt: bi('Запрос к https://shop.example/, который уходит на 198.51.100.30, — и вывод, по которому видно, готов ли сервер.', 'A request to https://shop.example/ that goes to 198.51.100.30 — and output that shows whether the server is ready.'),
          check: {
            stdout: /no alternative certificate subject name matches target host name 'shop\.example'/,
            when: (f, start) => !start || (f.files as Record<string, { text?: string }>)['/etc/hosts']?.text === (start.files as Record<string, { text?: string }>)['/etc/hosts']?.text,
          },
          docStep: 4,
          beyond: true,
          solutionTokens: ['--resolve', '--connect-to'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.tls.sees', 'net.q.tls.rtt', 'net.q.tls.errors', 'net.q.tls.ssh'] },
  ],
};

// ── 13. Proxies, load balancers, CDN — where 504 comes from ────────────────

const reload: (f: Facts) => boolean = (f) => {
  const files = f.files as Record<string, { text?: string }>;
  const conf = files['/etc/nginx/conf.d/shop.conf']?.text ?? '';
  const r = (f.reach as Record<string, { status?: number }> | undefined)?.r;
  return /proxy_read_timeout\s+(9\d|[1-9]\d{2,})s?\s*;/.test(conf) && r?.status !== 200;
};

export const proxy: Lesson = {
  id: 'networks.proxy',
  block: 'networks',
  title: bi('Прокси, балансировщики, CDN — откуда берётся 504', 'Proxies, load balancers, CDNs — where 504 comes from'),
  summary: bi('nginx перед бэкендами: proxy_pass, upstream, таймауты по умолчанию, повторы на следующем сервере. Код ответа говорит, кто его написал.', 'nginx in front of backends: proxy_pass, upstream, the default timeouts, retries on the next server. The status code tells who wrote it.'),
  introduces: ['net.reverse-proxy', 'net.upstream', 'net.lb', 'net.cdn'],
  uses: ['net.http', 'net.status', 'net.tcp', 'net.handshake', 'net.tls', 'net.osi'],
  tier: 'core',
  minutes: 45,
  sources: src([EN.nginxProxy, EN.nginxUpstream, EN.cdn, EN.mdnStatus], [RU.proxy, RU.nginx, RU.lb, RU.cdn]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Тикет в 9:02: «Страница /report открывается две минуты и падает с ошибкой 504. Остальные страницы работают». Две минуты — подозрительно круглое число. А 504 — код, который приложение почти никогда не пишет само. Кто же его написал?',
        'A ticket at 9:02: “The /report page takes two minutes to open and fails with a 504. The other pages work.” Two minutes is a suspiciously round number. And 504 is a code an application almost never writes itself. So who wrote it?',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Обратный прокси и балансировка', 'The reverse proxy and load balancing'),
      body: bi(
        'Перед приложениями почти всегда стоит [[net.reverse-proxy|обратный прокси]] — чаще всего nginx. Клиент подключается к нему, а он передаёт запрос дальше, приложению, и возвращает ответ. (Прямой прокси — наоборот, стоит у клиента и ходит в интернет от его имени.) Тот, кому прокси передаёт запрос, называется [[net.upstream|upstream]], а в nginx группа таких серверов описывается блоком `upstream`:\n\n```\nupstream backend {\n    server 10.0.2.21:8080;\n    server 10.0.2.22:8080;\n}\nserver {\n    listen 80;\n    location / {\n        proxy_pass http://backend;\n    }\n}\n```\n\nПрокси, раскладывающий запросы по нескольким серверам, — [[net.lb|балансировщик нагрузки]]. Бывает L4-балансировщик: он видит только адреса и порты (HAProxy в режиме `mode tcp`, TCP-балансировщик облака). И L7: он видит HTTP целиком и может отправлять /api в одно место, а /static в другое. nginx по умолчанию раскладывает запросы по очереди (round robin). К бэкенду он добавляет заголовок `X-Forwarded-For` — иначе приложение увидело бы адрес прокси вместо адреса клиента.\n\n[[net.cdn|CDN]] — те самые копии сайта поблизости из первого урока. Это сеть прокси, расставленных по городам: DNS-имя сайта указывает на ближайший узел, тот отдаёт страницу из своего кэша (HIT), а если её нет или она устарела по `Cache-Control` — идёт к основному серверу, origin (MISS).\n\nУ прокси есть таймеры. У nginx `proxy_connect_timeout` — сколько ждать подключения к upstream, `proxy_read_timeout` — сколько ждать ответа. Оба по умолчанию 60 секунд.',
        'In front of applications there is almost always a [[net.reverse-proxy|reverse proxy]] — most often nginx. The client connects to it, and it passes the request on to the application and returns the answer. (A forward proxy is the opposite: it sits by the client and goes to the internet on its behalf.) Whatever the proxy passes the request to is called the [[net.upstream|upstream]], and in nginx a group of such servers is described by an `upstream` block:\n\n```\nupstream backend {\n    server 10.0.2.21:8080;\n    server 10.0.2.22:8080;\n}\nserver {\n    listen 80;\n    location / {\n        proxy_pass http://backend;\n    }\n}\n```\n\nA proxy that spreads requests over several servers is a [[net.lb|load balancer]]. There are L4 load balancers: they see only addresses and ports (HAProxy in `mode tcp`, a cloud’s TCP load balancer). And L7 ones: they see all of HTTP and can send /api to one place and /static to another. By default nginx hands out requests in turn (round robin). It adds an `X-Forwarded-For` header for the backend — otherwise the application would see the proxy’s address instead of the client’s.\n\nA [[net.cdn|CDN]] is the copies of the site nearby from the first lesson. It is a network of proxies placed in cities: the site’s DNS name points to the nearest node, which serves the page from its cache (HIT), and if it is missing or stale by `Cache-Control`, goes to the main server, the origin (MISS).\n\nProxies have timers. nginx has `proxy_connect_timeout` — how long to wait for a connection to the upstream — and `proxy_read_timeout` — how long to wait for the answer. Both default to 60 seconds.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.proxy504', caption: bi('Двигайте время ответа приложения и таймаут, оставьте один бэкенд, отключите повторы, смените метод на POST; ломайте бэкенды по-разному.', 'Move the application time and the timeout, keep one backend, turn retries off, switch the method to POST; break the backends in different ways.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Что делает nginx, когда бэкенд не ответил', 'What nginx does when a backend does not answer'),
      body: bi(
        'Главное правило: **код ответа говорит, кто его написал**. 504 Gateway Time-out — прокси не дождался ответа от upstream. 502 Bad Gateway — прокси не смог его получить: соединение отвергнуто, оборвано или ответ испорчен. 500 — почти всегда само приложение; прокси тут только курьер. А раз код вообще пришёл, сеть до прокси в порядке: DNS, TCP и TLS проверять не нужно.\n\nКогда попытка не удалась, nginx пишет строку в `error.log` и — по умолчанию — повторяет запрос на следующем сервере группы. Это `proxy_next_upstream error timeout`: повтор при ошибке соединения или таймауте. Отсюда две минуты из тикета: приложение строит отчёт 75 секунд; nginx подождал 60 секунд первый бэкенд, сдался, повторил на втором, подождал ещё 60 — и ответил 504. В логе две строки, по одной на каждый upstream.\n\nТекст строки подсказывает этап. `while connecting to upstream` — подключиться не удалось: процесс не слушает порт (`111: Connection refused`, тогда клиент обычно получает 502), фильтр молча выбрасывает пакеты или машина выключена (`110: Connection timed out`). `while reading response header from upstream` — подключились, запрос отправили, а ответа не дождались: медленное приложение.\n\nЕщё три тонкости. Ответ 500 от бэкенда для nginx не ошибка upstream: он уйдёт клиенту без повтора. Запрос с неидемпотентным методом (POST, PATCH), уже отправленный бэкенду, nginx на другой сервер не повторит — иначе можно оформить заказ дважды. И неудачный сервер nginx на 10 секунд исключает из группы (`max_fails=1`, `fail_timeout=10s`) — это пассивная проверка здоровья: пользователи ошибок не видят, а в логе раз в 10 секунд появляется новая строка.\n\nИ как чинить случай из тикета. Не «поднять таймаут до 600 и забыть»: сначала измерить, сколько отвечает upstream напрямую, и найти, почему отчёт строится 75 секунд. Если долгий ответ законен, таймаут поднимают только для этого `location`.',
        'The main rule: **the status code tells who wrote it**. 504 Gateway Time-out — the proxy did not get an answer from the upstream in time. 502 Bad Gateway — the proxy could not get one: the connection was refused or broken, or the answer was garbage. 500 is almost always the application itself; the proxy is just the courier. And since a code arrived at all, the network up to the proxy is fine: no need to check DNS, TCP or TLS.\n\nWhen an attempt fails, nginx writes a line to `error.log` and — by default — retries the request on the next server of the group. This is `proxy_next_upstream error timeout`: a retry on a connection error or a timeout. Hence the two minutes of the ticket: the application builds the report in 75 seconds; nginx waited 60 seconds for the first backend, gave up, retried on the second, waited another 60 — and answered 504. The log has two lines, one per upstream.\n\nThe text of the line points to the stage. `while connecting to upstream` — the connection failed: the process does not listen on the port (`111: Connection refused`, and the client usually gets 502), a filter silently drops packets or the machine is off (`110: Connection timed out`). `while reading response header from upstream` — it connected and sent the request but the answer never came: a slow application.\n\nThree more subtleties. A 500 answer from a backend is not an upstream error for nginx: it goes to the client without a retry. A request with a non-idempotent method (POST, PATCH) already sent to a backend is not retried on another server — otherwise an order could be placed twice. And nginx excludes a failed server from the group for 10 seconds (`max_fails=1`, `fail_timeout=10s`) — a passive health check: users see no errors, while a new line appears in the log every 10 seconds.\n\nAnd how to fix the ticket’s case. Not “raise the timeout to 600 and forget”: first measure how long the upstream takes directly and find out why the report takes 75 seconds. If a long answer is legitimate, raise the timeout for that `location` only.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('lb', 'proxy', {}, [{ id: 'r', kind: 'http', from: 'client', to: 'http://10.0.0.1/report' }]),
      intro: bi('Вы на балансировщике lb: nginx (конфигурация — /etc/nginx/conf.d/shop.conf) перед бэкендами app1 (10.0.2.21:8080) и app2 (10.0.2.22:8080). Имя shop.lab на этой машине указывает на неё саму.', 'You are on the load balancer lb: nginx (configuration in /etc/nginx/conf.d/shop.conf) in front of backends app1 (10.0.2.21:8080) and app2 (10.0.2.22:8080). On this machine the name shop.lab points to itself.'),
      tasks: [
        {
          id: 'layer',
          prompt: bi('Первым делом — слой. Пользователь получил ответ с кодом 504. На каком уровне проблема: L3, L4 или L7? Запишите ответ в ~/layer.txt.', 'Layer first. The user got an answer with code 504. At which level is the problem: L3, L4 or L7? Write the answer into ~/layer.txt.'),
          check: { when: "files['/root/layer.txt'].text~'L7'", fail: [{ if: "files['/root/layer.txt'].text~'L3' || files['/root/layer.txt'].text~'L4'", say: bi('Ответ пришёл — значит, адреса, маршруты и соединение до nginx работают. 504 — сообщение прокси на уровне HTTP.', 'An answer arrived — so addresses, routes and the connection to nginx work. 504 is the proxy’s message at the HTTP level.') }] },
          chips: 'echo L7 > ~/layer.txt',
          hints: { H1: bi('Если пришёл код HTTP, всё ниже HTTP уже сработало.', 'If an HTTP code arrived, everything below HTTP has already worked.') },
        },
        {
          id: 'repro',
          prompt: bi('Воспроизведите: запросите http://shop.lab/report и посмотрите на код и заголовок Server.', 'Reproduce it: request http://shop.lab/report and look at the code and the Server header.'),
          check: { stdout: /504 Gateway Time-out/ },
          chips: 'curl -sv http://shop.lab/report',
          hints: { H1: bi('curl -sv: без индикатора, но с заголовками.', 'curl -sv: no progress meter, but with headers.') },
        },
        {
          id: 'log',
          prompt: bi('Прочитайте error.log nginx. Сколько в нём строк про этот запрос и с какими upstream? Затем измерьте, за сколько секунд app1 отвечает напрямую, и запишите число секунд в ~/direct.txt.', 'Read nginx’s error.log. How many lines about this request does it have, and with which upstreams? Then measure how many seconds app1 takes to answer directly and write the number of seconds into ~/direct.txt.'),
          check: { when: "files['/root/direct.txt'].text~'75'" },
          chips: "cat /var/log/nginx/error.log; curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.2.21:8080/report",
          hints: {
            H1: bi('Две строки «while reading response header» — по одной на upstream: nginx повторил запрос.', 'Two “while reading response header” lines — one per upstream: nginx retried.'),
            H2: bi('curl умеет печатать время запроса: -w с переменной time_total.', 'curl can print the request time: -w with the time_total variable.'),
          },
        },
        {
          id: 'fix',
          prompt: bi('Отчёт законно строится 75 секунд. Поднимите proxy_read_timeout до 90 секунд, проверьте конфигурацию и перечитайте её — /report должен отвечать 200.', 'The report legitimately takes 75 seconds. Raise proxy_read_timeout to 90 seconds, test the configuration and reload it — /report must answer 200.'),
          check: {
            when: 'reach.r.status=200',
            fail: [{ if: reload, say: bi('Файл исправлен, но работающий nginx держит старую конфигурацию. Её надо перечитать: nginx -s reload.', 'The file is fixed, but the running nginx keeps the old configuration. It must be reloaded: nginx -s reload.') }],
          },
          chips: "echo 'proxy_read_timeout 90s;' >> /etc/nginx/conf.d/shop.conf && nginx -t && nginx -s reload",
          docRef: { page: 'web/nginx.org/proxy_read_timeout', anchor: 'CONTEXT' },
          hints: {
            H1: bi('Директиву можно добавить в конец файла: он подключается внутри блока http, и настройка достанется всем location.', 'The directive can be appended to the end of the file: it is included inside the http block, and every location inherits the setting.'),
            H2: bi('После правки: nginx -t (проверка), затем nginx -s reload.', 'After editing: nginx -t (the test), then nginx -s reload.'),
          },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Документация nginx описывает каждую директиву тремя строками: синтаксис, значение по умолчанию, где её можно писать. Нажмите на строку, где указано значение proxy_read_timeout по умолчанию.', 'The nginx documentation describes every directive with three lines: the syntax, the default, where it may be written. Click the line that gives the default of proxy_read_timeout.'),
      ref: { page: 'web/nginx.org/proxy_read_timeout' },
      answer: 'DEFAULT',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi(
        'Отчёт `/report` строится 75 секунд и тяжело нагружает базу. Пока разработчики его ускоряют, выяснилось неприятное: когда первый бэкенд не укладывается в таймаут, nginx повторяет запрос на втором, и база строит один и тот же отчёт дважды. Запретите nginx передавать неудавшийся запрос следующему серверу группы. Таймауты не меняйте.',
        'The `/report` takes 75 seconds to build and loads the database heavily. While the developers speed it up, an unpleasant detail came out: when the first backend does not fit into the timeout, nginx retries the request on the second, and the database builds the same report twice. Forbid nginx to pass a failed request to the next server of the group. Do not change the timeouts.',
      ),
      ref: { page: 'web/nginx.org/proxy_next_upstream' },
      terminal: {
        setup: lab('lb', 'proxy', {}, [{ id: 'r', kind: 'http', from: 'client', to: 'http://10.0.0.1/report' }]),
        task: {
          id: 'next',
          prompt: bi('Одна попытка на запрос: `/report` отвечает 504 через одну минуту, а не через две.', 'One attempt per request: `/report` answers 504 after one minute, not two.'),
          check: {
            when: (f) => {
              const conf = (f.files as Record<string, { text?: string }>)['/etc/nginx/conf.d/shop.conf']?.text ?? '';
              const r = (f.reach as Record<string, { status?: number; ms?: number }> | undefined)?.r;
              return /proxy_next_upstream\s+off\s*;/.test(conf) && !/proxy_(read|connect)_timeout/.test(conf) && r?.status === 504 && (r.ms ?? 0) < 90000;
            },
            fail: [
              { if: (f) => /proxy_(read|connect)_timeout/.test((f.files as Record<string, { text?: string }>)['/etc/nginx/conf.d/shop.conf']?.text ?? ''), say: bi('Таймаут просили не трогать: повтор останется, просто случится позже или раньше.', 'The timeouts were not to be touched: the retry stays, it just happens later or sooner.') },
              { if: (f) => /proxy_next_upstream\s+off/.test((f.files as Record<string, { text?: string }>)['/etc/nginx/conf.d/shop.conf']?.text ?? ''), say: bi('В файле правка есть, а nginx работает со старой конфигурацией: проверьте и перечитайте её.', 'The file has the change, but nginx runs the old configuration: test it and reload.') },
            ],
          },
          docStep: 4,
          beyond: true,
          solutionTokens: ['proxy_next_upstream', 'off'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.proxy.who', 'net.q.proxy.lines', 'net.q.proxy.connecting', 'net.q.proxy.500'] },
  ],
};

// ── 14. Troubleshooting by layer — the whole URL ───────────────────────────

const FIXED_CONF = PROXY_CONF_SINGLE.replace('10.0.2.21:8080', '10.0.2.21:8081');

export const troubleshooting: Lesson = {
  id: 'networks.troubleshooting',
  block: 'networks',
  title: bi('Поиск неисправности по уровням и весь путь запроса к сайту', 'Troubleshooting by layer, and the whole URL'),
  summary: bi('Как по сообщению об ошибке понять, на каком уровне сломалась загрузка сайта, что происходит между нажатием Enter и готовой страницей и как найти причину двух настоящих сбоев на учебных машинах.','The “layer first” method, the table of symptoms, the end-to-end “what happens when you type a URL” explainer and two incidents.'),
  introduces: ['net.layers-method'],
  uses: ['net.osi', 'net.dns', 'net.tcp', 'net.tls', 'net.http', 'net.status', 'net.reverse-proxy', 'net.upstream', 'net.nat', 'net.arp', 'net.cdn', 'net.keepalive', 'net.handshake'],
  tier: 'core',
  minutes: 50,
  sources: src([EN.whatHappens, EN.curl, EN.mdnHttp, EN.nginxProxy], [RU.osi, RU.http, RU.dns]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Три часа ночи, и вам приходит сообщение: «сайт не работает». Можно начать с того, чтобы перезапустить всё подряд, но так вы сотрёте следы, по которым обычно находят причину. Можно поступить иначе: сначала выяснить, на каком уровне сломалась загрузка сайта, и доказать это одной командой. Этот урок учит второму способу. Сначала вы разберёте, по каким сообщениям узнают уровень поломки, потом увидите на схеме весь путь запроса от браузера до базы данных, а в конце сами найдёте причину двух сбоев на учебных машинах.',
        'Three in the morning, a message: “the site is down”. You could start by restarting everything in sight — and wipe out the evidence. Or you could ask one question: at which level did it break? And prove the answer with one command.',
      ),
    },
    {
      id: 'method',
      kind: 'text',
      step: 'explain',
      title: bi('Порядок поиска неисправности', 'The method'),
      body: bi(
        '[[net.layers-method|Поиск неисправности по уровням]] задаёт порядок, в котором вы рассуждаете. Сначала вы сами воспроизводите симптом и читаете сообщение об ошибке целиком, до последнего слова. Затем по этому сообщению определяете уровень, на котором загрузка остановилась. Потом подтверждаете свою догадку командой, которая проверяет именно этот уровень. И всё это время меняете только одну вещь за раз, потому что после двух правок сразу вы не узнаете, какая из них помогла.\n\nИдти можно снизу вверх, от подключения к сети через адрес, маршрут и порт к DNS, TLS и HTTP, а можно сверху вниз, от симптома. Сообщения инструментов почти всегда сами называют уровень, нужно только знать, как их читать:\n\n- `ping: connect: Network is unreachable` означает, что у ядра нет маршрута в нужную сеть и пакет даже не был отправлен. Это уровень L3, и смотреть нужно вывод `ip route`.\n- `From <свой адрес> … Destination Host Unreachable` означает, что соседняя машина или шлюз не отвечает на запросы ARP. Это уровень L2, и смотреть нужно вывод `ip neigh`.\n- `curl: (6) Could not resolve host` означает, что имя не превратилось в адрес. Это DNS, и проверять нужно файл `/etc/resolv.conf` и ответ команды `dig`.\n- `curl: (7) … Couldn\'t connect to server` с пометкой `Connection refused` в выводе `curl -v` означает, что машина работает, но нужный порт на ней закрыт. Это уровень L4, и на сервере нужно посмотреть вывод `ss -ltnp`.\n- `curl: (28) … Timeout was reached` означает, что ответа не пришло вовсе: пакеты отбрасывает фильтр, до машины нет маршрута или машина выключена. Это уровни L3 и L4, и разобраться помогут `traceroute` и `tcpdump`.\n- `curl: (60) SSL certificate problem` означает, что сертификат TLS не прошёл проверку: у него истёк срок, не совпало имя или неполна цепочка подписей.\n- Код `502` означает, что прокси не получил ответа от приложения, а код `504` означает, что прокси не дождался ответа. Это уровень L7, и причину прокси записывает в свой `error.log`.\n\nОсталось правило безопасности. Опасные действия, такие как перезапуск рабочего сервиса без проверенной догадки, команда `iptables -F` на роутере или правка двух параметров сразу, выполняют только тогда, когда догадка доказана и вы понимаете, что сломаете, если ошиблись.',
        '[[net.layers-method|Layer-by-layer troubleshooting]] is an order of thinking. First reproduce the symptom with your own hands and read the whole message. Then name the layer from the message. Then confirm the hypothesis with a command that checks exactly that layer. And change one thing at a time: two edits at once, and you will not know which one helped.\n\nYou can go bottom up — link, address, route, port, DNS, TLS, HTTP — or top down, from the symptom. Tool messages almost always name the layer themselves:\n\n- `ping: connect: Network is unreachable` — the kernel has no route, the packet was never born: L3, look at `ip route`;\n- `From <your own address> … Destination Host Unreachable` — a neighbour or the gateway does not answer ARP: L2, `ip neigh`;\n- `curl: (6) Could not resolve host` — DNS: `cat /etc/resolv.conf`, `dig`;\n- `curl: (7) … Couldn\'t connect to server`, with `Connection refused` in `-v` — the host is alive, the port is closed: L4, `ss -ltnp` on the server;\n- `curl: (28) … Timeout was reached` — no answer at all: a filter, no route, the host is off: L3/L4, `traceroute`, `tcpdump`;\n- `curl: (60) SSL certificate problem` — TLS: dates, name, chain;\n- `502` — the proxy got no answer from the upstream; `504` — it did not wait long enough: L7, `error.log`.\n\nAnd a safety rule. Dangerous actions — restarting a production service without a hypothesis, `iptables -F` on a router, editing two parameters at once — are done only when the hypothesis is proven and you understand what you will break if you are wrong.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Путь страницы от нажатия Enter до экрана', 'The path of a page from Enter to the screen'),
      body: bi(
        'Чтобы узнавать поломку по сообщению, полезно один раз увидеть, как страница загружается, когда всё исправно. Схема ниже показывает, что происходит после того, как пользователь набрал в браузере адрес https://shop.example/catalog и нажал Enter. Сначала на ней только браузер. Остальные участники появляются, когда до них доходит загрузка: слева домашний роутер, внизу резолвер провайдера и три сервера DNS, которые вместе превращают имя shop.example в адрес, справа узел CDN, то есть ближайший к пользователю сервер с копиями страниц сайта, а за ним nginx, приложение и база данных в дата-центре сайта.',
        'To recognise a failure by its message, it helps to see once how a page loads when everything works. The diagram below shows what happens after the user types https://shop.example/catalog and presses Enter. At first it shows only the browser. The other participants appear when the load reaches them: on the left the home router, at the bottom the provider’s resolver and three DNS servers, which together turn the name shop.example into an address, on the right the CDN edge, the server nearest to the user that keeps copies of the site’s pages, and behind it nginx, the application and the database in the site’s data centre.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.url', howto: bi('Нажмите «Начать: шаг вперёд», а дальше листайте кнопкой «Шаг вперёд» или нажмите «Проиграть» над схемой. На каждом шаге подсвечен один участник, тот, который работает сейчас, и облачко рядом с ним говорит, что он делает: «Резолвер ищет адрес shop.example». По линии едет карточка с тем, что участник передаёт следующему: вопрос `A? shop.example`, пакет `SYN`, запрос `GET /catalog`, ответ `200 OK`. Подпись под схемой объясняет, почему загрузка идёт дальше, а под подписью растёт водопад, в котором каждому шагу, занявшему время, соответствует своя полоса, как во вкладке Network в DevTools. Значки и рамки объяснены в легенде под схемой.\n\nКогда пройдёте исправную загрузку до конца, включайте по одной поломке в блоке «Сломать» над схемой. Перед каждой поломкой схема спросит, на каком шаге, по-вашему, остановится загрузка. Ответьте, а потом посмотрите, где загрузка остановилась на самом деле и какое сообщение напечатали бы браузер и `curl`. Эти сообщения стоит запомнить, потому что в инцидентах ниже вы встретите их снова.', 'Press “Start: step forward”, then go on with “Step forward” or press “Play” above the diagram. At every step one participant is highlighted, the one working now, and the callout next to it says what it does. A card travels along the line with what it hands on: the question `A? shop.example`, the `SYN` packet, the request `GET /catalog`, the answer `200 OK`. The caption under the diagram explains why the load goes on, and under it a waterfall grows, one bar for every step that took time, as in the Network tab of DevTools. The legend under the diagram explains the pictograms and outlines.\n\nOnce you have walked through a healthy load, switch on the breaks in the “Break it” block one at a time. Before each break the diagram asks at which step you think the load will stop. Answer, then see where it really stopped and what the browser and `curl` would print. Remember these messages: you will meet them again in the incidents below.'), caption: bi('Сообщения, которые вы видели при поломках, понадобятся сразу. В первом инциденте ниже пользователь жалуется, что страница долго грузится и потом показывает ошибку. Вспомните, какая из поломок на схеме вела себя так же, и подтвердите свою догадку командой.', 'The messages you saw with the breaks are needed right away. In the first incident below the user complains that the page loads for ages and then shows an error. Recall which break in the diagram behaved the same way, and confirm your guess with a command.') },
    {
      id: 'url',
      kind: 'text',
      step: 'explain',
      title: bi('Что происходит, когда вы вводите адрес сайта', 'What happens when you type a URL'),
      body: bi(
        'Этот вопрос задают почти на каждом собеседовании, и теперь у вас есть все слова, чтобы на него ответить. Сначала браузер разбирает адрес на схему, имя, порт и путь и проверяет свой кэш: если там лежит свежая копия страницы, в сеть не уходит ничего. Если ноутбук ещё не знает MAC-адрес шлюза, он узнаёт его по ARP. Затем имя сайта превращается в адрес. Система ноутбука ищет адрес в своём кэше и в файле `/etc/hosts`, а потом спрашивает рекурсивный резолвер провайдера. Если в кэше резолвера ответа нет, резолвер по очереди спрашивает корневой сервер, сервер зоны первого уровня и авторитативный сервер сайта.\n\nПервый пакет соединения уходит через домашний роутер, и NAT заменяет в нём адрес отправителя. Рукопожатие TCP с ближайшим узлом CDN занимает один путь до узла и обратно, а рукопожатие TLS 1.3, в котором браузер называет имя сайта и проверяет сертификат, занимает ещё один. После этого браузер отправляет зашифрованный запрос `GET /catalog`. Узел CDN отдаёт страницу из своего кэша или запрашивает её у сервера сайта. Там запрос проходит через nginx, который добавляет заголовок `X-Forwarded-For`, к приложению, а приложение берёт данные из базы. Ответ возвращается тем же путём, и роутер по своей таблице NAT передаёт его ноутбуку. Наконец браузер разбирает HTML и по тому же соединению запрашивает стили и картинки.\n\nНа каждом из этих шагов загрузка может сломаться, и у каждой поломки своё сообщение; четыре такие поломки вы включали сами на схеме выше. Хороший ответ на собеседовании проходит этот путь по порядку и на каждом шаге говорит, что здесь может сломаться и какой командой это проверить.',
        'This is the most common interview question, and now you have every word for the answer. The browser splits the address into scheme, name, port and path and checks its cache: a fresh copy, and nothing goes to the network. If the ARP cache is empty, the laptop learns the gateway’s MAC. The name becomes an address: the OS cache, `/etc/hosts`, the recursive resolver, and, with an empty cache, its walk through the root, the TLD and the authoritative server. The packet leaves through the home router, and NAT rewrites the source address. The TCP handshake with the nearest CDN node is one round trip; TLS 1.3 with SNI and the certificate check is another. An encrypted `GET /catalog`. The CDN node serves the page from cache or goes to the origin: the load balancer, nginx with `X-Forwarded-For`, the application, the database. The answer comes back the same way, through the reverse NAT. The browser parses the HTML and asks for styles and images over the same connection.\n\nEvery step has its own failure and its own message — you saw them in the explainer above. A good interview answer walks this path and at every step names what can break and how to check it.',
      ),
    },
    {
      id: 'incident1',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home', { drop443: true }),
      intro: bi('Первый инцидент. Пользователь пишет: «shop.example не открывается, страница долго грузится, а потом показывает ошибку». Вы работаете на ноутбуке этого пользователя.','Incident 1. “shop.example will not open; the page loads for ages and fails.” You are on the user’s laptop.'),
      tasks: [
        {
          id: 'layer',
          prompt: bi('Воспроизведите ошибку и определите, на каком уровне остановилась загрузка. Запишите ответ в файл ~/layer.txt, выбрав один из вариантов: L3, L4, DNS, TLS или L7.', 'Reproduce it and name the layer: write one of L3, L4, DNS, TLS, L7 into ~/layer.txt.'),
          check: {
            when: "files['/root/layer.txt'].text~'L4'",
            fail: [
              { if: "files['/root/layer.txt'].text~'DNS'", say: bi('Имя превращается в адрес: команда dig shop.example отвечает адресом. Поломка находится дальше по пути.', 'The name resolves: dig shop.example answers with an address. The problem is further on.') },
              { if: "files['/root/layer.txt'].text~'L3'", say: bi('Команда ping до shop.example проходит, значит, адреса и маршруты в порядке. Не отвечает только порт 443.', 'ping to shop.example works — addresses and routes are fine. It is port 443 in particular that does not answer.') },
            ],
          },
          chips: 'curl --connect-timeout 5 https://shop.example/; ping -c 2 shop.example',
          hints: {
            H1: bi('Проверяйте снизу вверх: сначала превращается ли имя в адрес, потом отвечает ли машина на ping и в конце подключается ли curl к порту.', 'Check bottom up: name → address, ping, the connection to the port.'),
            H2: bi('Ping проходит, а подключение к порту 443 зависает и не получает отказа. Значит, молчит один определённый порт.', 'Ping works, but the connection to 443 hangs without a refusal — silence on one port.'),
          },
        },
        {
          id: 'prove',
          prompt: bi('Докажите свою догадку: покажите, что подключение к порту 443 не получает отказа, а молчит до тех пор, пока не истечёт пятисекундный срок ожидания.', 'Prove the hypothesis: show that the connection to port 443 is not refused but stays silent until a 5-second timeout.'),
          check: { stdout: /curl: \(28\) Failed to connect to shop\.example port 443 after 5\d{3} ms: Timeout was reached/ },
          chips: 'curl --connect-timeout 5 https://shop.example/',
          hints: { H1: bi('Код 28 означает, что у curl истёк срок ожидания. Если бы соединение отклонили, curl вернул бы код 7.','curl code 28 means time ran out; refused would be code 7.') },
        },
      ],
    },
    {
      id: 'incident2',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('lb', 'proxy', { wrongPort: true }, [{ id: 'r', kind: 'http', from: 'client', to: 'http://10.0.0.1/' }]),
      intro: bi('Второй инцидент. После выкладки новой версии все страницы сайта отвечают ошибкой 502. Вы работаете на балансировщике lb, а приложение запущено на единственном сервере app1 с адресом 10.0.2.21.', 'Incident 2. “After the deploy — 502 on every page.” You are on the load balancer lb; there is one backend, app1 (10.0.2.21).'),
      tasks: [
        {
          id: 'port',
          prompt: bi('Выясните, на каком порту приложение на app1 принимает соединения на самом деле, и запишите номер этого порта в файл ~/port.txt.', 'Find out which port the application on app1 really listens on and write the number into ~/port.txt.'),
          check: { when: "files['/root/port.txt'].text~'8081'", fail: [{ if: "files['/root/port.txt'].text~'8080'", say: bi('На порту 8080 приложение отвечает отказом Connection refused, то есть приложения на этом порту нет.', 'On 8080 the application answers with a refusal — Connection refused. It is not there.') }] },
          chips: 'tail /var/log/nginx/error.log; nc -zv 10.0.2.21 8081',
          hints: {
            H1: bi('В файл error.log nginx записывает, к какому адресу и порту он обращается и что получает в ответ.', 'The error.log line tells where nginx knocks and what it gets.'),
            H2: bi('Проверяйте соседние порты командой nc -zv. Отказ приходит мгновенно, поэтому перебор займёт секунды.', 'Check neighbouring ports with nc -zv: a refusal is instant, so trying is quick.'),
          },
        },
        {
          id: 'fix',
          prompt: bi('Исправьте порт в блоке upstream файла /etc/nginx/conf.d/shop.conf, проверьте конфигурацию и заставьте nginx перечитать её.', 'Fix the upstream in /etc/nginx/conf.d/shop.conf to the right port, test and reload the configuration.'),
          check: { when: 'reach.r.status=200' },
          chips: "sed -i 's/8080/8081/' /etc/nginx/conf.d/shop.conf && nginx -t && nginx -s reload",
          hints: {
            H1: bi('В блоке upstream адрес сервера записан как 10.0.2.21:8080.', 'In the upstream block the server address is written as 10.0.2.21:8080.'),
            H2: bi('Замените порт командой sed -i или перепишите файл, а затем выполните nginx -t и nginx -s reload.', 'Replace the port (sed -i, or rewrite the file), then nginx -t and nginx -s reload.'),
            H3: bi(`Если команды sed на машине нет, перепишите файл целиком: echo -e '${FIXED_CONF.replace(/\n/g, '\\n')}' > /etc/nginx/conf.d/shop.conf`, `If sed is not available, rewrite the whole file: echo -e '${FIXED_CONF.replace(/\n/g, '\\n')}' > /etc/nginx/conf.d/shop.conf`),
          },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.ts.layer', 'net.q.ts.first', 'net.q.ts.revisit'] },
  ],
};

// ── 15. The protocol catalogue ─────────────────────────────────────────────

export const protocols: Lesson = {
  id: 'networks.protocols',
  block: 'networks',
  title: bi('Каталог протоколов', 'The protocol catalogue'),
  summary: bi('Справочник одинаковых карточек: зачем, на каком слое, как идёт обмен, как наблюдать, как ломается.', 'A reference of uniform cards: why, which layer, how the exchange goes, how to observe it, how it breaks.'),
  introduces: [],
  uses: ['net.arp', 'net.dhcp', 'net.icmp', 'net.tcp', 'net.udp', 'net.dns', 'net.http', 'net.tls', 'net.nat', 'net.bgp', 'net.osi'],
  tier: 'plus',
  minutes: 30,
  sources: src([EN.rfc9293, EN.rfc1034, EN.rfc8446, EN.rfc4271], [RU.tcp, RU.dns, RU.tls, RU.bgp]),
  sections: [
    {
      id: 'intro',
      kind: 'text',
      step: 'look',
      body: bi(
        'Каталог не заменяет уроки, а собирает их в одно место и добирает то, что в уроки не вошло. Каждая карточка устроена одинаково: зачем протокол нужен, на каком он слое и поверх чего работает, как идёт обмен (диаграмма, время сверху вниз), какими командами его наблюдать и как он ломается — с ответом на главный вопрос «какой уровень?». Карточки для новичка собраны из уроков блока; карточки среднего и опытного уровня — короткие самостоятельные уроки: VLAN, HTTP/2 и HTTP/3, WebSocket, gRPC, BGP, VXLAN, WireGuard, mTLS.',
        'The catalogue does not replace the lessons; it gathers them in one place and adds what did not fit. Every card has the same structure: why the protocol exists, which layer it is at and what it runs on, how the exchange goes (a diagram, time running downwards), which commands let you observe it and how it breaks — with an answer to the main question, “which layer?”. The beginner cards are put together from the block’s lessons; the intermediate and experienced cards are short lessons of their own: VLAN, HTTP/2 and HTTP/3, WebSocket, gRPC, BGP, VXLAN, WireGuard, mTLS.',
      ),
    },
    { id: 'catalogue', kind: 'widget', step: 'explain', widget: 'net.protocols' },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.proto.transport', 'net.q.proto.ntp'] },
  ],
};
