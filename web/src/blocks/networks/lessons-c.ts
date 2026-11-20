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
  summary: bi('Как миллионы квартир с одинаковыми адресами выходят в интернет, почему снаружи к вашему ноутбуку нельзя подключиться и где в ядре хранятся правила, которые за это отвечают.', 'How millions of flats with the same addresses get onto the internet, why nobody outside can connect to you, and where in the kernel the rules live.'),
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
        'У вас дома ноутбук с адресом 192.168.1.23. У соседа ноутбук с тем же адресом 192.168.1.23, и так же устроены сети в миллионе других квартир. Частные адреса в интернете не маршрутизируются, так что сайт никак не может отправить ответ на адрес 192.168.1.23, а страница всё-таки открывается. Значит, кто-то по дороге подменил адрес.',
        'At home your laptop is 192.168.1.23. Your neighbour’s is 192.168.1.23 too. And a million other flats’. Private addresses are not routed on the internet, so a site cannot possibly answer “192.168.1.23” — and yet the page opens. Someone on the way replaced the address.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как роутер подменяет адрес', 'How the router swaps the address'),
      body: bi(
        'Схема ниже показывает, что происходит с пакетом, когда ноутбук с частным адресом 192.168.1.23 открывает сайт с адресом 198.51.100.20. Слева ноутбук, в центре домашний роутер с двумя адресами, внутренним 192.168.1.1 и внешним 203.0.113.7, а справа сайт. Под роутером появится таблица conntrack, в которую роутер записывает каждую подмену. Карточка на линии показывает, с каким адресом отправителя пакет идёт по этому участку пути.',
        'The diagram below shows what happens to a packet when a laptop with the private address 192.168.1.23 opens a site at 198.51.100.20. On the left is the laptop, in the middle the home router with two addresses, 192.168.1.1 inside and 203.0.113.7 outside, and on the right the site. Under the router the conntrack table appears, where the router records every swap. The card on the line shows the source address the packet carries on that part of the path.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.nat', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен блок, который работает сейчас, и облачко рядом с ним говорит, что он делает: «Роутер ставит на пакет свой адрес 203.0.113.7:40001 и записывает замену в conntrack». Сравните адрес отправителя на карточке до роутера и после него. Под таблицей conntrack растёт число записей, а значки и рамки объяснены в легенде под схемой.\n\nПосле первого прохода увеличьте над схемой число устройств в квартире и посмотрите, чем различаются их записи. Потом включите подключение снаружи и проследите, где остановится пакет. Напоследок удалите правило MASQUERADE в блоке «Сломать» и выясните, на каком шаге пропадает ответ сайта.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the block working now is highlighted, and the callout next to it says what it does. Compare the source address on the card before the router and after it. The entry count grows under the conntrack table; the legend under the diagram explains the marks.\n\nAfter the first pass raise the number of devices at home above the diagram and see what tells their entries apart. Then switch on the connection from outside and watch where the packet stops. Finally remove the MASQUERADE rule in “Break it” and find the step where the site’s answer is lost.'), caption: bi('На схеме роутер подменял адрес отправителя и записывал каждую подмену в таблицу conntrack. В следующем разделе разберём, как устроена эта подмена и почему из-за неё к вам нельзя подключиться снаружи.', 'In the diagram the router swapped the source address and wrote every swap into the conntrack table. The next section explains how the swap works and why it keeps others from connecting to you from outside.') },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Подмена адреса и таблица соединений', 'Address rewriting and the connection table'),
      body: bi(
        'Адрес подменяет домашний роутер. Когда пакет уходит в интернет, роутер заменяет в нём адрес отправителя своим публичным адресом, а порт отправителя свободным портом роутера, так что `192.168.1.23:51234` превращается в `203.0.113.7:40001`. Такая замена называется [[net.nat|NAT]], а точнее SNAT, и в Linux её частный случай называют MASQUERADE, что означает «взять адрес того интерфейса, через который пакет уходит».\n\nЧтобы ответ вернулся к нужной машине, роутер записывает соответствие в [[net.conntrack|conntrack]], таблицу соединений ядра: соединение 192.168.1.23:51234 с сайтом 198.51.100.20:443 выходит наружу через порт 40001. Ответ приходит на `203.0.113.7:40001`, роутер находит эту строку и заменяет получателя обратно, так что ноутбук ничего не замечает. Если дома двадцать устройств, строк в таблице двадцать и больше, и различает их только внешний порт.\n\nИз этого следует, что снаружи к ноутбуку подключиться нельзя. Новый пакет на `203.0.113.7:27015` приходит на роутер, но строки для него в conntrack нет, и роутер не знает, какой из домашних машин этот пакет отдать. Чтобы пустить соединение внутрь, нужен [[net.dnat|проброс порта]] (DNAT), то есть правило вроде «всё, что пришло на порт 80, отправлять на 10.0.2.20:8080». А если провайдер сам выдал роутеру адрес из диапазона `100.64.0.0/10` (это называется CGNAT), то вы находитесь за двумя NAT сразу, и проброс на своём роутере не поможет. У NAT есть и обратная сторона. Облачный шлюз NAT, через который идут тысячи соединений к одному адресу, может исчерпать внешние порты, и тогда новые соединения начинают получать отказ.',
        'The home router does it. On the way to the internet it changes the packet’s source address to its own public one and the port to a free one of its own: `192.168.1.23:51234` becomes `203.0.113.7:40001`. This is [[net.nat|NAT]], more precisely SNAT; in Linux a special case of it is called MASQUERADE — “take the address of the interface the packet leaves through”.\n\nFor the answer to find its way back to the right machine, the router records the mapping in [[net.conntrack|conntrack]] — the kernel’s connection table: “192.168.1.23:51234 to 198.51.100.20:443 goes out as :40001”. The answer arrives at `203.0.113.7:40001`, the router finds the line and rewrites the destination back. The laptop noticed nothing. Twenty devices at home mean twenty or more lines, and only the outside port tells them apart.\n\nOne consequence: nobody outside can connect to the laptop. A new packet arrives at `203.0.113.7:27015`, and conntrack has no line for it — the router does not know which home machine to give it to. To let a connection in you need [[net.dnat|port forwarding]] (DNAT): a rule “everything that arrives on :80 goes to 10.0.2.20:8080”. And if the provider itself gave the router an address from `100.64.0.0/10` (CGNAT), you are behind two NATs — and forwarding on your own router will not help. There is a flip side too: a cloud NAT gateway runs out of outside ports with thousands of connections to one address, and new connections start failing.',
      ),
    },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Где хранятся правила: netfilter', 'Where the rules live: netfilter'),
      body: bi(
        'В уроке про TCP фильтр на сервере молча выбрасывал пакеты на закрытый порт, и клиент ждал до конца срока ожидания, не получая отказа. И NAT, и этот фильтр работают в [[net.netfilter|netfilter]], подсистеме ядра Linux, через которую проходит каждый пакет. Правила сгруппированы в таблицы: таблица `filter` решает судьбу пакета, то есть пропустить его или выбросить, а таблица `nat` меняет адреса. Внутри таблиц правила собраны в цепочки, и каждая цепочка привязана к определённой точке на пути пакета через ядро:\n\n- `PREROUTING` срабатывает сразу, как только пакет пришёл, до решения о том, куда его направить, и здесь работает DNAT;\n- `INPUT` срабатывает для пакетов, адресованных самой машине;\n- `FORWARD` срабатывает для пакетов, которые проходят сквозь машину, как через маршрутизатор;\n- `OUTPUT` срабатывает для пакетов, созданных на этой машине;\n- `POSTROUTING` срабатывает перед самой отправкой в провод, и здесь работают SNAT и MASQUERADE.\n\nПравила в цепочке проверяются сверху вниз до первого совпадения, и совпавшее правило выносит решение: `ACCEPT` пропускает пакет, `DROP` молча выбрасывает его, и клиент ждёт до конца срока ожидания, а `REJECT` выбрасывает пакет и сообщает об этом отправителю, и клиент сразу получает отказ. Если ни одно правило не совпало, действует политика цепочки. Правило `-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT` пропускает ответы на соединения, которые машина открыла сама, и здесь conntrack служит памятью фильтра.\n\nУправляют всем этим командой `iptables` (например, `iptables -t nat -L -n -v` показывает таблицу nat со счётчиками) или её современной заменой `nft`; в новых дистрибутивах `iptables` часто работает поверх nftables. Есть и условие, которое задаётся не правилом: чтобы машина пересылала пакеты между интерфейсами, параметр `net.ipv4.ip_forward` должен быть равен 1. Такие же правила через несколько блоков вы увидите в Docker и в Kubernetes.',
        'In the TCP lesson a filter on the server silently dropped packets to a closed port, and the client waited until the timeout without getting a refusal. Both NAT and that filter are [[net.netfilter|netfilter]], the Linux kernel subsystem every packet passes through. Rules are grouped into tables: `filter` decides a packet’s fate (pass or drop), `nat` rewrites addresses. Inside the tables are chains, tied to points on the packet’s path through the kernel:\n\n- `PREROUTING` — as soon as the packet arrives, before deciding where it goes (DNAT is here);\n- `INPUT` — the packet is addressed to the machine itself;\n- `FORWARD` — the packet passes through the machine, as through a router;\n- `OUTPUT` — the packet was created on this machine;\n- `POSTROUTING` — just before it goes onto the wire (SNAT and MASQUERADE are here).\n\nRules in a chain are checked top to bottom until the first match with a verdict: `ACCEPT` — let it through, `DROP` — silently drop it (the client waits for a timeout), `REJECT` — drop it and tell the sender (the client is refused at once). If none matches, the chain’s policy applies. The rule `-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT` lets through replies to connections the machine opened itself: here conntrack already works as the filter’s memory.\n\nAll of this is managed with `iptables` (`iptables -t nat -L -n -v` shows the nat table with counters) or its modern replacement `nft`; on new distributions `iptables` often works on top of nftables. And one condition that is not a rule: for a machine to forward packets between interfaces you need `net.ipv4.ip_forward = 1`. A few blocks from now you will see exactly these rules in Docker and in Kubernetes.',
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
      intro: bi('Вы работаете на шлюзе офиса gw. Его интерфейс eth0 подключён к офисной сети 10.0.2.0/24, где стоит сервер app с адресом 10.0.2.20 и приложением на порту 8080, а интерфейс eth1 подключён к интернету и имеет адрес 203.0.113.10. Внешний сайт находится по адресу 203.0.113.50.', 'You are on the office gateway gw: eth0 faces the office network 10.0.2.0/24 (with server app 10.0.2.20 running an application on 8080), eth1 faces the internet with address 203.0.113.10. An outside site is 203.0.113.50.'),
      tasks: [
        {
          id: 'forward',
          prompt: bi('Включите на gw пересылку пакетов между интерфейсами.', 'Turn on packet forwarding between interfaces on gw.'),
          check: { when: "net.sysctl['net.ipv4.ip_forward']=1" },
          chips: 'sysctl -w net.ipv4.ip_forward=1',
          docRef: { page: 'man/sysctl.8', anchor: 'EXAMPLES', line: 'net.ipv4.ip_forward=1' },
          hints: { H1: bi('За это отвечает параметр ядра net.ipv4.ip_forward.', 'It is the kernel parameter net.ipv4.ip_forward.'), H2: bi('Команда выглядит так: sysctl -w ключ=значение.', 'sysctl -w key=value') },
        },
        {
          id: 'masq',
          prompt: bi('Дайте офисной сети выход в интернет, чтобы сервер app открыл http://203.0.113.50/.', 'Give the office network a way out to the internet: app must be able to open http://203.0.113.50/.'),
          check: {
            when: 'reach.out.status=200',
            fail: [
              { if: "net.sysctl['net.ipv4.ip_forward']=0", say: bi('Пересылка выключена, и gw не передаёт пакеты из eth0 в eth1.', 'Forwarding is off: gw does not pass packets from eth0 to eth1.') },
              { if: "!(net.iptables.nat~'MASQUERADE') && !(net.iptables.nat~'SNAT')", say: bi('Пакеты уходят с частным адресом 10.0.2.20, и ответ на такой адрес в интернете не найдёт дороги. Нужна подмена адреса отправителя в цепочке POSTROUTING.', 'Packets leave with the private address 10.0.2.20 — an answer to it cannot find its way on the internet. You need source rewriting in POSTROUTING.') },
            ],
          },
          chips: 'iptables -t nat -A POSTROUTING -s 10.0.2.0/24 -o eth1 -j MASQUERADE',
          docRef: { page: 'man/iptables.8', anchor: 'EXAMPLES', line: 'MASQUERADE' },
          concepts: ['net.nat', 'net.conntrack'],
          hints: {
            H1: bi('Ответ должен вернуться на публичный адрес gw, значит, адрес отправителя нужно подменить на выходе.', 'The answer must come back to gw’s public address — so the source address must be rewritten on the way out.'),
            H2: bi('Вам нужна таблица nat, цепочка POSTROUTING, цель MASQUERADE и интерфейс eth1.', 'Table nat, chain POSTROUTING, target MASQUERADE, interface eth1.'),
            H3: bi('iptables -t nat -A POSTROUTING -s 10.0.2.0/24 -o eth1 -j MASQUERADE', 'iptables -t nat -A POSTROUTING -s 10.0.2.0/24 -o eth1 -j MASQUERADE'),
          },
        },
        {
          id: 'dnat',
          prompt: bi('Пробросьте порт так, чтобы соединения из интернета на 203.0.113.10:80 попадали в приложение на 10.0.2.20:8080.', 'Forward a port: connections from the internet to 203.0.113.10:80 must reach the application at 10.0.2.20:8080.'),
          check: {
            when: "reach.in.status=200 && net.iptables.nat~'DNAT'",
            fail: [{ if: "net.iptables.nat~'-A POSTROUTING.*DNAT'", say: bi('DNAT работает в цепочке PREROUTING, потому что адрес назначения нужно подменить до решения о маршруте.', 'DNAT works in PREROUTING: the destination must be rewritten before the routing decision.') }],
          },
          chips: 'iptables -t nat -A PREROUTING -i eth1 -p tcp --dport 80 -j DNAT --to-destination 10.0.2.20:8080',
          docRef: { page: 'man/iptables.8', anchor: 'EXAMPLES', line: 'DNAT' },
          concepts: ['net.dnat'],
          hints: {
            H1: bi('Подменить нужно адрес и порт назначения, причём сразу, как только пакет пришёл.', 'You must rewrite the destination address and port — as soon as the packet arrives.'),
            H2: bi('Вам нужна таблица nat, цепочка PREROUTING, условие -p tcp --dport 80 и цель DNAT --to-destination.', 'Table nat, chain PREROUTING, -p tcp --dport 80, target DNAT --to-destination.'),
          },
        },
        {
          id: 'counters',
          prompt: bi('Посмотрите таблицу nat вместе со счётчиками пакетов. В первых двух столбцах у каждого правила стоит, сколько пакетов и байтов через него прошло, и по ним видно, срабатывает ли правило вообще. Задание выполнено, когда в выводе появится цепочка POSTROUTING.', 'Look at the nat table together with the packet counters. The first two columns of each rule show how many packets and bytes went through it, which tells you whether the rule fires at all. The task is done when the POSTROUTING chain appears in the output.'),
          check: { stdout: /Chain POSTROUTING \(policy ACCEPT/ },
          chips: 'iptables -t nat -L -n -v',
          hints: { H1: bi('Флаг -L выводит список правил, -n отключает поиск имён, а -v добавляет счётчики.', '-L lists, -n skips names, -v adds counters.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('На странице iptables(8) есть раздел, где перечислены таблицы filter и nat и их встроенные цепочки. Нажмите на этот раздел.', 'iptables(8) has a section listing the filter and nat tables and their built-in chains. Click it.'),
      ref: { page: 'man/iptables.8' },
      answer: 'TABLES',
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi(
        'Правила цепочки проверяются по порядку, сверху вниз, и чтобы вставить правило перед другим или удалить одно правило, не трогая соседних, нужно знать его номер. Найдите на странице iptables(8), как напечатать номера строк, и выведите так таблицу nat.',
        'The rules of a chain are checked in order, top to bottom, and to insert a rule before another or delete one without touching its neighbours you need its number. Find in iptables(8) how to print the line numbers, and list the nat table that way.',
      ),
      ref: { page: 'man/iptables.8', anchor: 'OPTIONS', line: '--line-numbers' },
      terminal: {
        setup: lab('gw', 'nat', { configured: true }),
        task: {
          id: 'lines',
          prompt: bi('Выведите таблицу nat с номерами правил.', 'The nat table with rule numbers.'),
          check: { stdout: /^num\s+target[\s\S]*MASQUERADE/m },
          docStep: 3,
          chips: 'iptables -t nat -L -n --line-numbers',
          hints: { H1: bi('Номера печатаются только вместе со списком правил, то есть вместе с флагом -L.', 'The numbers appear only when listing, that is, together with -L.') },
        },
      },
    },
    { id: 'summary', kind: 'text', step: 'exit', title: bi('Что вы теперь умеете', 'What you can do now'), body: bi('Теперь вы умеете включить пересылку пакетов, выпустить внутреннюю сеть в интернет правилом MASQUERADE, пробросить порт правилом DNAT и прочитать таблицу nat со счётчиками. Вы знаете, в какой цепочке netfilter работает каждое из этих правил.', 'You can now turn on packet forwarding, let an internal network out to the internet with a MASQUERADE rule, forward a port with a DNAT rule and read the nat table with its counters. You know which netfilter chain each of these rules works in.') },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.nat.inbound', 'net.q.nat.hooks', 'net.q.nat.reject', 'net.q.nat.est', 'net.q.nat.http'] },
  ],
};

// ── 11. HTTP ───────────────────────────────────────────────────────────────

export const http: Lesson = {
  id: 'networks.http',
  block: 'networks',
  title: bi('HTTP', 'HTTP'),
  summary: bi('HTTP передаёт текст поверх TCP: строку запроса, заголовки и коды ответа. В уроке вы построчно разберёте вывод curl -v и сами поговорите с сервером, набрав запрос вручную.', 'Text over TCP: the request line, headers, status codes. Take curl -v apart line by line and talk to a server by hand.'),
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
        'В блоке Linux команда `curl` возвращала страницу, а `curl -v` вдобавок печатала строки со знаками `>` и `<`. Это не служебный шум, а весь разговор клиента с сервером, слово в слово. HTTP устроен как текстовый протокол, и его можно прочитать глазами.',
        'In the Linux block `curl` returned a page and `curl -v` also printed lines with `>` and `<`. That is not noise: it is the whole conversation between client and server, word for word. HTTP is a text protocol, and you can read it with your eyes.',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Запрос и ответ', 'Request and answer'),
      body: bi(
        '[[net.http|HTTP]] работает поверх TCP: клиент открывает соединение с портом 80 и пишет в него текст.\n\n```\nGET /catalog HTTP/1.1\nHost: shop.example\nUser-Agent: curl/8.14.1\nAccept: */*\n\n```\n\nПервая строка называется строкой запроса. В ней стоят метод (`GET` получает данные, `POST` отправляет их, а ещё бывают `PUT`, `DELETE` и `HEAD`), путь и версия протокола. Дальше идут заголовки вида «имя: значение», а пустая строка сообщает, что заголовки закончились; после неё может идти тело запроса. Сервер отвечает в том же порядке: строка статуса вроде `HTTP/1.1 200 OK`, заголовки (`Content-Type`, `Content-Length`, `Server`), пустая строка и тело.\n\nСамый важный заголовок запроса называется [[net.host-header|Host]]. На одном IP-адресе работают десятки и сотни сайтов: имена в DNS у них разные, а адрес общий. Какой сайт вы просите, сервер узнаёт только по заголовку Host, и без этого заголовка сервер HTTP/1.1 ответит кодом 400.\n\nТри цифры в строке статуса называются [[net.status|кодом статуса]], и первая цифра говорит, на чьей стороне ответственность:\n\n- `2xx` означает успех: 200 OK, 201 Created, 204 No Content;\n- `3xx` означает «идите по другому адресу»: 301 и 308 сообщают, что страница переехала навсегда, 302 сообщает о временном переезде, новый адрес стоит в заголовке `Location`, а 304 сообщает, что у клиента уже есть свежая копия;\n- `4xx` означает ошибку клиента: 400 говорит об испорченном запросе, 401 о том, что нужна аутентификация, 403 о том, что доступ запрещён, 404 о том, что такого пути нет, а 429 о слишком частых запросах;\n- `5xx` означает ошибку сервера: 500 говорит, что сломалось приложение, 502 и 504 говорят, что прокси не получил ответа от сервера за ним (подробно о них рассказано в уроке про прокси), а 503 говорит, что сервис временно недоступен.\n\nВы набрали `http://shop.example`, а открылся `https://`? Это значит, что сервер ответил кодом 301 с заголовком `Location: https://shop.example/`, и браузер перешёл по новому адресу. Так обычно переводят сайт на HTTPS.\n\nЧтобы не тратить время на рукопожатие перед каждым запросом, соединение держат открытым, и это называется [[net.keepalive|keep-alive]]. Браузер получил HTML и по тому же соединению запрашивает стили, скрипты и картинки.',
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
        'Смысл запросов в новых версиях остаётся тем же, а меняется упаковка. HTTP/2 передаёт данные двоичными кадрами HEADERS и DATA, вместо строки запроса и заголовка Host использует заголовки `:method`, `:path` и `:authority` и ведёт много параллельных потоков в одном соединении. HTTP/3 переносит всё это на протокол QUIC поверх UDP-порта 443, где транспорт и шифрование договариваются за один обмен. Попробовать обе версии можно в каталоге протоколов в конце блока.',
        'The meaning of requests stays the same; the packaging changes. HTTP/2 uses binary HEADERS and DATA frames, the headers `:method`, `:path`, `:authority` instead of a request line and Host, and many parallel streams on one connection. HTTP/3 moves all of this to QUIC over UDP 443: transport and encryption are negotiated in one exchange. You can explore them in the protocol catalogue at the end of the block.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('client', 'tcp'),
      intro: bi('Вы работаете на клиенте, а рядом стоит сервер srv с адресом 10.0.0.2, и на его порту 8080 работает небольшое веб-приложение.', 'A client and server srv (10.0.0.2) with a small web application on port 8080.'),
      tasks: [
        {
          id: 'verbose',
          prompt: bi('Запросите http://10.0.0.2:8080/ так, чтобы увидеть и сам запрос, и заголовки ответа.', 'Request http://10.0.0.2:8080/ so that you see both the request and the answer headers.'),
          check: { stdout: /< HTTP\/1\.1 200 OK/ },
          chips: 'curl -v http://10.0.0.2:8080/',
          docRef: { page: 'man/curl.1', anchor: 'OPTIONS', line: '-v, --verbose' },
          hints: {
            H1: bi('Строки со знаком «>» показывают, что отправил curl, а строки со знаком «<» показывают, что ответил сервер.', '“>” lines are what curl sent, “<” what the server answered.'),
            H2: bi('Нужный флаг описан в разделе OPTIONS страницы curl(1) первым, а его описание начинается словами «Makes curl verbose», то есть «делает вывод curl подробным». Если найти флаг не получается, наберите команду `curl -v http://10.0.0.2:8080/`.', 'The flag is the first one in the OPTIONS section of curl(1); its description starts with “Makes curl verbose”. If you cannot find the flag, type `curl -v http://10.0.0.2:8080/`.'),
          },
        },
        {
          id: 'byhand',
          prompt: bi('Поговорите с сервером вручную: отправьте через nc строку запроса и заголовок Host и получите ответ 200.', 'Talk to the server by hand: send a request line and a Host header through nc and get a 200 answer.'),
          check: { stdout: /^HTTP\/1\.1 200 OK/m, fail: [{ if: "term['main'][last].out~'400 Bad Request'", say: bi('Сервер ответил кодом 400. Проверьте порядок частей в строке запроса (метод, путь, версия) и заголовок Host.', 'The server answered 400: check the order in the request line (method, path, version) and the Host header.') }] },
          chips: 'echo -e "GET / HTTP/1.1\\r\\nHost: srv\\r\\n\\r\\n" | nc 10.0.0.2 8080',
          hints: {
            H1: bi('Команда nc отправит на сервер всё, что получит на вход.', 'nc sends the server everything it gets on its input.'),
            H2: bi('Строки HTTP разделяются символами \\r\\n, а заголовки заканчиваются пустой строкой. Команда printf понимает такие последовательности, и запрос целиком выглядит так: `printf \'GET / HTTP/1.1\\r\\nHost: 10.0.0.2\\r\\n\\r\\n\' | nc 10.0.0.2 8080`.', 'HTTP lines are separated by \\r\\n, and the headers end with an empty line. printf understands such sequences, and the whole request is `printf \'GET / HTTP/1.1\\r\\nHost: 10.0.0.2\\r\\n\\r\\n\' | nc 10.0.0.2 8080`.'),
          },
        },
        {
          id: 'missing',
          prompt: bi('Запросите несуществующий путь http://10.0.0.2:8080/nope вместе с заголовками ответа и посмотрите на код.', 'Request a path that does not exist, http://10.0.0.2:8080/nope, with the answer headers, and look at the code.'),
          check: { stdout: /HTTP\/1\.1 404 Not Found/ },
          chips: 'curl -i http://10.0.0.2:8080/nope',
          hints: { H1: bi('Флаг -i добавляет к выводу заголовки ответа.', '-i adds the answer headers to the output.'), H2: bi('Если флаг не вспоминается, наберите команду `curl -i http://10.0.0.2:8080/nope`.', 'If the flag does not come to mind, type `curl -i http://10.0.0.2:8080/nope`.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Однажды curl завершился с кодом 7, а в другой раз с кодом 28. Найдите раздел curl(1), в котором объяснено, что означают эти числа, и нажмите на него.', 'curl ended with code 7 once and with 28 another time. Which section of curl(1) explains what these numbers mean? Click the section.'),
      ref: { page: 'man/curl.1' },
      answer: 'EXIT STATUS',
    },
    {
      id: 'forcing-guided',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      levels: ['beginner'],
      prompt: bi('Скрипту мониторинга нужен только код ответа: одна строка из трёх цифр без тела страницы. Получите так код для http://10.0.0.2:8080/nope. Нужная опция описана на странице справки curl(1), в разделе OPTIONS. Справка написана по-английски, поэтому ищите на ней слова write-out, то есть «вывести после запроса», и http_code, то есть «код ответа HTTP».', 'A monitoring script needs only the status code: one line of three digits without the page body. Get the code for http://10.0.0.2:8080/nope that way. The option is described on the curl(1) help page, in the OPTIONS section. The help is in English, so look on it for the words write-out and http_code.'),
      ref: { page: 'man/curl.1', anchor: 'OPTIONS', line: '-w, --write-out' },
      terminal: {
        setup: lab('client', 'tcp'),
        task: {
          id: 'code',
          prompt: bi('Выведите только код ответа, то есть 404. Задание выполнено, когда curl напечатает одну строку с числом 404 и больше ничего.', 'Print only the status code, 404. The task is done when curl prints one line with the number 404 and nothing else.'),
          check: { stdout: /^404\n?$/ },
          docStep: 3,
          docRef: { page: 'man/curl.1', anchor: 'OPTIONS', line: '-w, --write-out' },
          chips: "curl -s -o /dev/null -w '%{http_code}\\n' http://10.0.0.2:8080/nope",
          hints: {
            H1: bi('Здесь нужны три опции. Первая, `-s`, убирает строку о ходе загрузки, вторая, `-o /dev/null`, отправляет тело страницы в особый файл, который всё выбрасывает, а третья печатает после запроса то, что вы попросите. Третью и нужно найти в справке: в её описании есть слова «display information on stdout after a completed transfer», то есть «вывести сведения после завершённого запроса».', 'Three options are needed here. The first, `-s`, removes the progress line, the second, `-o /dev/null`, sends the page body to a special file that throws everything away, and the third prints after the request whatever you ask for. The third is the one to find in the help: its description says “display information on stdout after a completed transfer”.'),
            H2: bi("После опции `-w` в кавычках пишут, что вывести, а код ответа обозначается словом `%{http_code}`. Команда целиком выглядит так: `curl -s -o /dev/null -w '%{http_code}\\n' http://10.0.0.2:8080/nope`. Знаки `\\n` в конце переводят строку, чтобы приглашение оболочки не прилипло к числу.", "After the `-w` option you write in quotes what to print, and the status code is written as `%{http_code}`. The whole command is `curl -s -o /dev/null -w '%{http_code}\\n' http://10.0.0.2:8080/nope`. The `\\n` at the end breaks the line so that the shell prompt does not stick to the number."),
          },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      levels: ['intermediate', 'experienced'],
      prompt: bi('Скрипту мониторинга нужен только код ответа: одна строка из трёх цифр без тела страницы. Получите так код для http://10.0.0.2:8080/nope.', 'A monitoring script needs only the status code: one line, three digits, no page body. Get the code for http://10.0.0.2:8080/nope that way.'),
      ref: { page: 'man/curl.1' },
      terminal: {
        setup: lab('client', 'tcp'),
        task: {
          id: 'code',
          prompt: bi('Выведите только код ответа, то есть 404.', 'Only the status code — 404.'),
          check: { stdout: /^404\n?$/ },
          docStep: 4,
          beyond: true,
          solutionTokens: ['-w', '--write-out', 'http_code', '%{http_code}'],
        },
      },
    },
    { id: 'summary', kind: 'text', step: 'exit', title: bi('Что вы теперь умеете', 'What you can do now'), body: bi('Теперь вы умеете прочитать вывод `curl -v` строка за строкой, отправить запрос HTTP вручную через `nc` и по первой цифре кода ответа понять, на чьей стороне ошибка.', 'You can now read the output of `curl -v` line by line, send an HTTP request by hand through `nc` and tell from the first digit of the status code whose side the error is on.') },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.http.codes', 'net.q.http.host', 'net.q.http.redirect', 'net.q.http.bug'] },
  ],
};

// ── 12. TLS, HTTPS and SSH ─────────────────────────────────────────────────

export const tls: Lesson = {
  id: 'networks.tls',
  block: 'networks',
  title: bi('TLS, HTTPS и SSH', 'TLS, HTTPS and SSH'),
  summary: bi('Шифрование и проверка подлинности: сертификат, цепочка подписей до корневого центра, рукопожатие TLS 1.3, то, что видно постороннему, и SSH как второй шифрованный канал.', 'Encryption and authenticity: the certificate, the chain to a root, the TLS 1.3 handshake, what an outsider sees, and SSH as the second encrypted channel.'),
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
        'В кафе с открытым Wi-Fi любой сосед по сети может видеть ваши кадры. Если сайт открыт по `http://`, сосед прочитает и запрос, и пароль из формы, и ответ сервера обычным текстом, так же, как в уроке про HTTP вы читали в выводе `curl -v` весь разговор клиента с сервером. Хуже того, он может подменить ответ. Поэтому нужны две вещи сразу: чтобы никто не мог прочитать переписку и чтобы на том конце был тот самый сервер, к которому вы обращаетесь.',
        'In a café with open Wi-Fi any neighbour on the network can see your frames. If a site is opened over `http://`, they read the request, the password from the form and the answer — as plain text, the way you read the whole client–server conversation in the output of `curl -v` in the HTTP lesson. Worse: they can replace the answer. Two things are needed at once: that nobody can read it, and that the server at the other end is the right one.',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Сертификат и цепочка доверия', 'The certificate and the chain of trust'),
      body: bi(
        'Обе задачи решает [[net.tls|TLS]], а HTTPS устроен как тот же HTTP, который передаётся внутри TLS на порту 443. Шифрование построено на паре ключей: то, что зашифровано открытым ключом, расшифрует только закрытый, а подпись, сделанную закрытым ключом, можно проверить открытым. Клиент и сервер обмениваются открытыми частями ключей и получают общий секрет, которого не видел никто на пути.\n\nНо как убедиться, что открытый ключ пришёл от shop.example, а не от соседа по Wi-Fi? Для этого существует [[net.cert|сертификат]], то есть открытый ключ сервера вместе с его именем (поле subjectAltName) и сроком действия, подписанные тем, кому доверяет ваша система. Подписывает сертификат [[net.ca|удостоверяющий центр]], причём обычно не напрямую, а через промежуточный сертификат. Клиент проверяет всю цепочку: сертификат сайта подписан промежуточным, промежуточный подписан корневым, а корневой заранее лежит в системе, в каталоге `/etc/ssl/certs`.\n\nКлиент проводит три проверки, и код ошибки `curl` у всех трёх один и тот же, 60, но сообщение у каждой проверки своё. Проверка срока даёт `certificate has expired`, причём неверные часы на клиенте приводят к той же ошибке. Проверка имени даёт `no alternative certificate subject name matches target host name`, например если сертификат выписан на имя с www, а заходят без www. Проверка цепочки даёт `unable to get local issuer certificate`, когда сервер забыл прислать промежуточный сертификат. Все три ошибки относятся к TLS: сеть и сервер в порядке, но проверка подлинности не прошла.\n\nЕсть и четвёртое сообщение, `self-signed certificate`. Оно означает, что сертификат подписал сам сервер, например администратор выпустил его командой `openssl` за минуту. Шифрует такой сертификат не хуже выданного удостоверяющим центром, но подпись не ведёт ни к одному корню из `/etc/ssl/certs`, и клиент не может убедиться, что на том конце нужный сервер. Поэтому браузер показывает предупреждение, а curl отказывается подключаться. Доверие проверяет клиент, и смотрит он в хранилище на своей машине, так что добавить сертификат в хранилище сервера бесполезно: самоподписанный сертификат годится только там, где вы сами разложили его по машинам клиентов, например во внутренней сети компании.',
        '[[net.tls|TLS]] solves both. HTTPS is the same HTTP, only inside TLS, on port 443. Encryption is built on a key pair: what is encrypted with the public key only the private key can decrypt, and a signature made with the private key is checked with the public one. Client and server exchange public parts and arrive at a shared secret nobody on the path has seen.\n\nBut how do you know the public key came from shop.example and not from your Wi-Fi neighbour? That is what a [[net.cert|certificate]] is for: the server’s public key together with its name (the subjectAltName field) and validity dates, signed by someone your system trusts. It is signed by a [[net.ca|certificate authority]] — usually not directly but through an intermediate certificate. The client checks the chain: the site’s certificate is signed by the intermediate, the intermediate by a root, and the root is already on the system, in `/etc/ssl/certs`.\n\nThere are three checks; `curl` exits with code 60 for all of them, but each has its own message: the dates (`certificate has expired`; a wrong clock on the client looks the same), the name (`no alternative certificate subject name matches target host name` — the certificate is for www and people come without www) and the chain (`unable to get local issuer certificate` — the server forgot to send the intermediate certificate). All three are the TLS layer: the network and the server are fine, the authenticity check failed.\n\nThere is a fourth message, `self-signed certificate`. It means the server signed the certificate itself, say an administrator made it with `openssl` in a minute. Such a certificate encrypts as well as one issued by an authority, but its signature leads to no root in `/etc/ssl/certs`, and the client cannot make sure the other end is the right server. So the browser shows a warning and curl refuses to connect. Trust is checked by the client, in the store on its own machine, so adding the certificate to the server’s store is useless: a self-signed certificate only works where you have put it on the clients’ machines yourself, for example inside a company network.',
      ),
    },
    {
      id: 'nginx-tls',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Что проверить в nginx, если сертификат выпущен, а HTTPS не работает', 'The certificate is issued but HTTPS does not work: what to check in nginx'),
      body: bi(
        'Выпустить сертификат мало, его ещё должен отдавать сервер. В nginx за это отвечают три строки в блоке `server`:\n\n```\nserver {\n    listen 443 ssl;\n    server_name shop.example;\n    ssl_certificate     /etc/letsencrypt/live/shop.example/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/shop.example/privkey.pem;\n}\n```\n\nЧаще всего ломается одно из трёх. Если строки `listen 443 ssl` нет, порт 443 никто не слушает, и curl пишет ошибку с кодом 7, а не 60. Если в `ssl_certificate` указан файл `cert.pem` вместо `fullchain.pem`, сервер не присылает промежуточный сертификат, и клиенты пишут `unable to get local issuer certificate`. Если конфигурацию не перечитали командой `nginx -s reload`, сервер продолжает отдавать старый сертификат. Какой сертификат сервер отдаёт на самом деле, показывает команда `openssl s_client -connect shop.example:443 -servername shop.example`.',
        'Issuing a certificate is not enough; the server also has to present it. In nginx three lines of the `server` block do that:\n\n```\nserver {\n    listen 443 ssl;\n    server_name shop.example;\n    ssl_certificate     /etc/letsencrypt/live/shop.example/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/shop.example/privkey.pem;\n}\n```\n\nOne of three things usually breaks. Without `listen 443 ssl` nobody listens on port 443, and curl fails with code 7, not 60. If `ssl_certificate` points to `cert.pem` instead of `fullchain.pem`, the server does not send the intermediate certificate, and clients print `unable to get local issuer certificate`. If the configuration was not reloaded with `nginx -s reload`, the server keeps presenting the old certificate. `openssl s_client -connect shop.example:443 -servername shop.example` shows which certificate the server really presents.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Сколько обменов нужно, чтобы открыть страницу по HTTPS', 'How many exchanges it takes to open a page over HTTPS'),
      body: bi(
        'Схема ниже показывает, какие сообщения проходят между curl и сервером shop.example, когда вы выполняете `curl https://shop.example/`. Как и на схеме из урока про TCP, клиент нарисован слева, сервер справа, а время идёт сверху вниз. Сначала идёт рукопожатие TCP, потом рукопожатие TLS, и только после него зашифрованный запрос HTTP. Подписи в фигурных скобках означают зашифрованные сообщения, а под схемой копятся счётчики: сколько раз сообщения успели сходить до сервера и обратно и сколько миллисекунд прошло до первого байта ответа.',
        'The diagram below shows the messages between curl and the server shop.example when you run `curl https://shop.example/`. As in the TCP lesson, the client is on the left, the server on the right, and time runs downwards. First comes the TCP handshake, then the TLS handshake, and only then the encrypted HTTP request. Labels in curly braces are encrypted messages, and the counters under the diagram show how many round trips passed and how many milliseconds went by before the first byte of the answer.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.tls', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждое сообщение появляется на схеме, когда его отправляют, и по стрелке движется карточка с его названием: `SYN`, `SNI shop.example`, `{Certificate}`, `{GET /}`. Облачко у подсвеченной стороны говорит, что она делает. Значки и рамки объяснены в легенде под схемой.\n\nПосле первого прохода растяните над схемой время пути до сервера и посмотрите, как растёт время до первого байта. Потом включите соединение, уже открытое прошлым запросом, и посчитайте, сколько обменов осталось. На среднем и опытном уровне переключите версию протокола на TLS 1.2 и на HTTP/3. Напоследок включите в блоке «Сломать» по очереди истёкший сертификат и сертификат на другое имя и прочитайте, что напишет curl.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. Each message appears when it is sent, and a card with its name travels along the arrow: `SYN`, `SNI shop.example`, `{Certificate}`, `{GET /}`. The callout at the highlighted side says what it does. The legend under the diagram explains the marks.\n\nAfter the first pass stretch the RTT above the diagram and watch the time to the first byte grow. Then switch on the connection already opened by an earlier request and count the exchanges that remain. At the intermediate and experienced levels switch the protocol to TLS 1.2 and to HTTP/3. Finally switch on the expired certificate and then the certificate for another name in “Break it” and read what curl prints.'), caption: bi('На схеме до первого байта ответа сообщения сходили до сервера и обратно три раза, а с открытым соединением только один раз. В следующем разделе разберём, что происходит в каждом из этих обменов и что из них видно постороннему.', 'In the diagram three round trips passed before the first byte of the answer, and with an open connection only one. The next section looks at what happens in each of these exchanges and what an outsider can see of them.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Рукопожатие TLS 1.3 и то, что видно снаружи', 'The TLS 1.3 handshake and what is visible outside'),
      body: bi(
        'После рукопожатия TCP клиент отправляет приветствие ClientHello, ещё открытым текстом. В нём перечислены версии TLS, которые умеет клиент, имя сайта ([[net.sni|SNI]], Server Name Indication, по которому сервер выбирает, какой сертификат показать), список протоколов, которые пойдут поверх TLS (ALPN: h2, http/1.1), и половина обмена ключами (key_share; современный клиент предлагает гибридный вариант `X25519MLKEM768` вместе с `x25519`). Сервер отвечает приветствием ServerHello со своей половиной ключа, и всё, что идёт дальше, уже зашифровано: сертификат, подпись и Finished. Клиент проверяет сертификат, отправляет свой Finished и сразу за ним зашифрованный запрос HTTP. TLS 1.3 тратит на это один путь до сервера и обратно, поэтому до первого байта ответа новое соединение HTTPS проходит три таких пути: на TCP, на TLS и на сам запрос. Старый TLS 1.2 требует четыре пути, а второй запрос по уже открытому соединению требует одного.\n\nЧто при этом видит сосед по Wi-Fi или провайдер? Он видит адреса и порты, размеры и время пакетов, а ещё SNI, то есть имя сайта, потому что оно лежит в открытой части ClientHello. Путь страницы, заголовки, cookies и тело запроса он не видит. Расширение ECH скрывает и SNI, но пока встречается редко.\n\nПо той же логике работает SSH, через который вы входили на машины в блоке Linux: стороны обмениваются ключами, и клиент проверяет ключ сервера. Только вместо цепочки подписей до удостоверяющего центра SSH сверяет отпечаток ключа с тем, который запомнил при первом входе в файле `~/.ssh/known_hosts`. Сообщение `Host key verification failed` соответствует ошибке сертификата в TLS и означает, что на том конце не тот сервер, который клиент знает. Либо сервер переустановили, либо соединение перехватывают, и прежде чем удалять строку из known_hosts, стоит выяснить, какой из двух случаев ваш.',
        'After the TCP handshake the client sends ClientHello — still in clear text. It carries the TLS versions the client speaks, the site name ([[net.sni|SNI]], Server Name Indication: by it the server chooses which certificate to present), the list of protocols on top (ALPN: h2, http/1.1) and half of the key exchange (key_share; a modern client offers the hybrid `X25519MLKEM768` together with `x25519`). The server answers ServerHello with its half of the key — and everything after that is encrypted: the certificate, the signature, Finished. The client checks the certificate, sends its own Finished and right away the encrypted HTTP request. TLS 1.3 spends one RTT on this, so a new HTTPS connection takes three round trips to the first byte of the answer: TCP, TLS, the request. The old TLS 1.2 takes four. With keep-alive a second request takes one.\n\nWhat does a Wi-Fi neighbour or the provider see? Addresses and ports, sizes and timings of packets — and the SNI, the site name: it is in the clear part of ClientHello. Not the path, the headers, the cookies or the body. (The ECH extension hides the SNI too, but it is still rare.)\n\nThe same logic holds for SSH, which you used to log in to machines in the Linux block. A key exchange — and a check of the server’s key. Only instead of a chain to a certificate authority SSH compares the key’s fingerprint with what it remembered on the first login, in `~/.ssh/known_hosts`. The message `Host key verification failed` is a direct analogue of a certificate error: “the other end is not the one I know”. Either the server was reinstalled or you are being intercepted — and before deleting the line from known_hosts it is worth finding out which.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home'),
      intro: bi('Вы работаете на ноутбуке в домашней сети. На хостинге открыты четыре сайта: shop.example, expired.example, wrong.example и chain.example, и сертификат в порядке только у одного из них.', 'A laptop on a home network. The hosting has four sites: shop.example, expired.example, wrong.example and chain.example. Only one has a certificate in order.'),
      tasks: [
        {
          id: 'expire',
          prompt: bi('Узнайте, до какого числа действует сертификат shop.example, и запишите дату в том виде, в каком её печатает curl, в файл ~/expire.txt.', 'Find out until what date the certificate of shop.example is valid and write the date (as curl prints it) into ~/expire.txt.'),
          check: { when: "files['/root/expire.txt'].text~'Dec 30'", fail: [{ if: "files['/root/expire.txt'].text~'Sep'", say: bi('Сентябрьская дата стоит в поле start date, то есть означает начало срока. Вам нужна дата из поля expire date.', 'September is the start date. You need the expire date.') }] },
          chips: 'curl -vI https://shop.example/',
          hints: { H1: bi('Команда curl -v печатает раздел «Server certificate».', 'curl -v prints a “Server certificate” section.'), H2: bi('Ищите строку «expire date:».', 'The “expire date:” line.') },
        },
        {
          id: 'name',
          prompt: bi('У одного из трёх сайтов, expired.example, wrong.example или chain.example, сертификат выписан на другое имя. Найдите этот сайт и запишите его имя в файл ~/mismatch.txt.', 'One of the three sites — expired.example, wrong.example, chain.example — has a certificate issued for another name. Find it and write the site’s name into ~/mismatch.txt.'),
          check: {
            when: "files['/root/mismatch.txt'].text~'wrong.example' && !(files['/root/mismatch.txt'].text~'expired') && !(files['/root/mismatch.txt'].text~'chain')",
            fail: [
              { if: "files['/root/mismatch.txt'].text~'expired'", say: bi('У expired.example с именем всё в порядке, а вот срок сертификата истёк.', 'expired.example has the right name — its validity ended.') },
              { if: "files['/root/mismatch.txt'].text~'chain'", say: bi('У chain.example неполная цепочка подписей, и curl пишет «unable to get local issuer certificate».', 'chain.example has an incomplete chain: “unable to get local issuer certificate”.') },
            ],
          },
          chips: 'curl https://wrong.example/',
          concepts: ['net.cert'],
          hints: { H1: bi('Откройте каждый сайт командой curl и сравните ошибки, потому что у каждой проверки она своя.', 'Open each site with curl and compare the errors: each check has its own.') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите на странице curl(1) флаг, который пропускает проверку сертификата, и откройте с ним https://chain.example/. На рабочих серверах так не делают; это только способ убедиться, что дело в цепочке подписей.', 'Find the curl(1) flag that skips the certificate check, and open https://chain.example/. (Nobody does this in production — it is a way to confirm the problem is the chain.)'),
      ref: { page: 'man/curl.1', anchor: 'OPTIONS', line: '-k, --insecure' },
      terminal: {
        setup: lab('laptop', 'home'),
        task: {
          id: 'k',
          prompt: bi('Откройте https://chain.example/ без проверки сертификата.', 'Open https://chain.example/ without checking the certificate.'),
          check: { stdout: /^chain$/m },
          docStep: 3,
          chips: 'curl -k https://chain.example/',
          hints: { H1: bi('Ищите в разделе OPTIONS слово «insecure».', 'Look for the word “insecure” in OPTIONS.') },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi(
        'Сайт shop.example собираются перенести на новый сервер с адресом `198.51.100.30`. Прежде чем менять DNS, нужно проверить с ноутбука, покажет ли этот сервер годный сертификат, когда браузер придёт к нему с именем shop.example. Ни DNS, ни `/etc/hosts` трогать нельзя: пусть curl сам подключится к этому адресу под этим именем.',
        'shop.example is about to move to a new server at `198.51.100.30`. Before DNS is changed, check from the laptop whether that server presents a valid certificate when a browser comes to it with the name shop.example. Neither DNS nor `/etc/hosts` may be touched: make curl itself connect to that address under that name.',
      ),
      ref: { page: 'man/curl.1' },
      terminal: {
        setup: lab('laptop', 'home'),
        task: {
          id: 'resolve',
          prompt: bi('Отправьте запрос к https://shop.example/, который уйдёт на адрес 198.51.100.30, и покажите вывод, по которому видно, готов ли сервер.', 'A request to https://shop.example/ that goes to 198.51.100.30 — and output that shows whether the server is ready.'),
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
    { id: 'summary', kind: 'text', step: 'exit', title: bi('Что вы теперь умеете', 'What you can do now'), body: bi('Теперь вы умеете узнать срок действия сертификата, различить три ошибки curl с кодом 60 и самоподписанный сертификат и объяснить, что посторонний видит в соединении HTTPS, а что нет.', 'You can now find a certificate’s validity, tell apart the three curl errors with code 60 and a self-signed certificate, and explain what an outsider sees of an HTTPS connection and what not.') },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.tls.sees', 'net.q.tls.rtt', 'net.q.tls.errors', 'net.q.tls.ssh', 'net.q.tls.self'] },
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
  title: bi('Прокси, балансировщики и CDN: откуда берётся ошибка 504', 'Proxies, load balancers, CDNs — where 504 comes from'),
  summary: bi('Как nginx стоит перед серверами приложения и передаёт им запросы, какие сроки ожидания у него заданы по умолчанию и когда он повторяет запрос на другом сервере. В уроке разберём, как по коду ответа понять, кто его написал.', 'nginx in front of backends: proxy_pass, upstream, the default timeouts, retries on the next server. The status code tells who wrote it.'),
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
        'В 9:02 приходит заявка: «Страница /report открывается две минуты и потом выдаёт ошибку 504. Остальные страницы работают». Две минуты выглядят подозрительно круглым числом, а код 504 приложение почти никогда не пишет само. Кто же его написал?',
        'A ticket at 9:02: “The /report page takes two minutes to open and fails with a 504. The other pages work.” Two minutes is a suspiciously round number. And 504 is a code an application almost never writes itself. So who wrote it?',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Обратный прокси и балансировка', 'The reverse proxy and load balancing'),
      body: bi(
        'Перед приложениями почти всегда стоит [[net.reverse-proxy|обратный прокси]], чаще всего nginx. Клиент подключается к прокси, а прокси передаёт запрос дальше, приложению, и возвращает клиенту ответ. Прямой прокси устроен наоборот: он стоит на стороне клиента и ходит в интернет от его имени. Слово «обратный» относится не к направлению трафика, ведь у обоих запрос идёт от клиента к серверу, а к тому, кого прокси представляет. Прямой прокси работает на клиентов своей сети и выступает от их имени перед интернетом, а обратный работает на серверы сайта и выступает от их имени перед клиентами, поэтому их ещё называют прокси клиента и прокси сервера. Сервер, которому прокси передаёт запрос, называется [[net.upstream|upstream]], а в nginx группа таких серверов описывается блоком `upstream`:\n\n```\nupstream backend {\n    server 10.0.2.21:8080;\n    server 10.0.2.22:8080;\n}\nserver {\n    listen 80;\n    location / {\n        proxy_pass http://backend;\n    }\n}\n```\n\nПрокси, который распределяет запросы по нескольким серверам, называют [[net.lb|балансировщиком нагрузки]]. Номера уровней здесь взяты из модели OSI, которую вы разбирали в уроке «Конверты». Балансировщик уровня L4, то есть транспортного, видит только адреса и порты, а балансировщик уровня L7, то есть уровня приложений, видит HTTP целиком и может, например, отправлять запросы к /api в одно место, а к /static в другое. По умолчанию nginx раздаёт запросы серверам по очереди. Поскольку к приложению подключается прокси, а не клиент, приложение видит адрес прокси. Поэтому прокси сообщает приложению адрес настоящего клиента в отдельном заголовке запроса, `X-Forwarded-For`.\n\nСеть доставки контента, [[net.cdn|CDN]], хранит те самые копии сайта поблизости, о которых шла речь в первом уроке. Она состоит из прокси, расставленных по городам: имя сайта в DNS указывает на ближайший узел, и узел отдаёт страницу из своего кэша. Такой случай называют попаданием (HIT). Если страницы в кэше нет или она устарела согласно заголовку `Cache-Control`, узел запрашивает её у основного сервера сайта, который называют origin, и такой случай называют промахом (MISS).\n\nУ прокси есть таймеры. У nginx параметр `proxy_connect_timeout` задаёт, сколько ждать подключения к серверу upstream, а `proxy_read_timeout` задаёт, сколько ждать его ответа. Оба по умолчанию равны 60 секундам.',
        'In front of applications there is almost always a [[net.reverse-proxy|reverse proxy]] — most often nginx. The client connects to it, and it passes the request on to the application and returns the answer. (A forward proxy is the opposite: it sits by the client and goes to the internet on its behalf.) “Reverse” is not about the direction of traffic, since with both the request goes from the client to the server, but about whom the proxy stands for. A forward proxy works for the clients of its network and acts on their behalf towards the internet; a reverse proxy works for the site’s servers and acts on their behalf towards the clients. That is why they are also called the client’s proxy and the server’s proxy. Whatever the proxy passes the request to is called the [[net.upstream|upstream]], and in nginx a group of such servers is described by an `upstream` block:\n\n```\nupstream backend {\n    server 10.0.2.21:8080;\n    server 10.0.2.22:8080;\n}\nserver {\n    listen 80;\n    location / {\n        proxy_pass http://backend;\n    }\n}\n```\n\nA proxy that spreads requests over several servers is a [[net.lb|load balancer]]. An L4 load balancer sees only addresses and ports, while an L7 one sees all of HTTP and can, for example, send /api to one place and /static to another. By default nginx hands out requests in turn. Since it is the proxy, not the client, that connects to the application, the application sees the proxy’s address. So the proxy reports the real client’s address to the application in a separate request header, `X-Forwarded-For`.\n\nA [[net.cdn|CDN]] is the copies of the site nearby from the first lesson. It is a network of proxies placed in cities: the site’s DNS name points to the nearest node, which serves the page from its cache (HIT), and if it is missing or stale by `Cache-Control`, goes to the main server, the origin (MISS).\n\nProxies have timers. nginx has `proxy_connect_timeout` — how long to wait for a connection to the upstream — and `proxy_read_timeout` — how long to wait for the answer. Both default to 60 seconds.',
      ),
    },
    {
      id: 'lb-config',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Балансировщики L4 и L7 и заголовок X-Forwarded-For в конфигурации', 'L4 and L7 balancers and X-Forwarded-For in the configuration'),
      body: bi(
        'Балансировщиком уровня L4 работает, например, HAProxy в режиме `mode tcp` и TCP-балансировщик облака, а nginx с `proxy_pass` работает на уровне L7. Раздачу запросов по очереди называют round robin, и в блоке `upstream` её можно заменить директивами `least_conn` или `ip_hash`. Заголовок с адресом клиента nginx добавляет такой строкой в блоке `location`:\n\n```\nproxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n```\n\nПеременная `$proxy_add_x_forwarded_for` дописывает адрес клиента к тому заголовку, который уже пришёл, поэтому за цепочкой из нескольких прокси приложение видит весь путь запроса.',
        'An L4 balancer is, for example, HAProxy in `mode tcp` or a cloud’s TCP load balancer, while nginx with `proxy_pass` works at L7. Handing out requests in turn is called round robin; in the `upstream` block it can be replaced with `least_conn` or `ip_hash`. nginx adds the client address header with this line in the `location` block:\n\n```\nproxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n```\n\nThe `$proxy_add_x_forwarded_for` variable appends the client address to the header that already came in, so behind a chain of several proxies the application sees the whole path of the request.',
      ),
    },
    {
      id: 'fastcgi',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      levels: ['experienced'],
      title: bi('Если за nginx стоит PHP-FPM', 'When PHP-FPM sits behind nginx'),
      body: bi(
        'Всё, что в этом уроке сказано про `proxy_pass`, относится и к связке nginx с PHP-FPM, только директивы там называются по-другому. Запрос передаёт `fastcgi_pass`, срок ожидания ответа задаёт `fastcgi_read_timeout`, а срок подключения `fastcgi_connect_timeout`, и оба по умолчанию тоже равны 60 секундам. Поэтому долгий скрипт PHP даёт ту же ошибку 504 и ту же строку `upstream timed out … while reading response header`, и увеличение `proxy_read_timeout` ему не поможет. Строка `connect() to unix:/run/php/php-fpm.sock failed (2: No such file or directory)` или `(111: Connection refused)` и ошибка 502 означают, что процесс PHP-FPM не запущен или слушает другой сокет. У PHP-FPM есть и собственный предел, `request_terminate_timeout` в настройках пула: если он короче, чем срок ожидания nginx, FPM сам прерывает скрипт, и клиент получает 502, а не 504.',
        'Everything below about `proxy_pass` also holds for nginx with PHP-FPM, only the directives have other names there. `fastcgi_pass` passes the request, `fastcgi_read_timeout` sets how long to wait for the answer and `fastcgi_connect_timeout` how long to wait for the connection; both also default to 60 seconds. So a slow PHP script gives the same 504 and the same `upstream timed out … while reading response header` line, and raising `proxy_read_timeout` does not help it. The line `connect() to unix:/run/php/php-fpm.sock failed (2: No such file or directory)` or `(111: Connection refused)` with a 502 means the PHP-FPM process is not running or listens on another socket. PHP-FPM also has a limit of its own, `request_terminate_timeout` in the pool settings: if it is shorter than nginx’s timeout, FPM aborts the script itself, and the client gets a 502, not a 504.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Кто пишет клиенту ошибку 504', 'Who writes the 504 to the client'),
      body: bi(
        'Схема ниже показывает путь запроса к странице /report через nginx. Слева клиент, в центре nginx, справа два сервера приложения, app1 и app2, которые берут данные из общей базы. Под nginx появится его журнал ошибок error.log с числом записанных строк. Сначала на схеме только клиент и nginx, а серверы приложения, база и журнал появляются, когда до них доходит запрос. Сейчас приложение строит отчёт 75 секунд, а nginx ждёт ответа 60 секунд.',
        'The diagram below shows the path of a request for /report through nginx. On the left is the client, in the middle nginx, and on the right two backends, app1 and app2, which take data from a shared database. Under nginx its error.log appears with the number of lines written. At first only the client and nginx are shown; the backends, the database and the log appear when the request reaches them. Right now the application builds the report in 75 seconds, and nginx waits 60 seconds for an answer.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.proxy504', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен блок, который работает сейчас, и облачко рядом с ним говорит, что он делает: «nginx не дождался ответа от app1 за 60 с и записывает это в error.log». По линиям движутся карточки с запросом `GET /report`, запросом к базе `SELECT …` и кодом ответа. Жёлтая рамка отмечает блок, который написал клиенту ошибку, а под схемой видны код ответа, время ожидания клиента и число строк в журнале. Остальные значки объяснены в легенде под схемой.\n\nПосле первого прохода уменьшите над схемой время ответа приложения ниже 60 секунд, а потом верните его и увеличьте срок ожидания nginx. Оставьте один сервер приложения и сравните, сколько ждёт клиент. На среднем и опытном уровне выключите повторы и смените метод на POST. Напоследок ломайте серверы приложения по-разному в блоке «Сломать»: завершившийся процесс, выключенная машина и приложение, которое само отвечает кодом 500, дают клиенту разные коды и разные строки в журнале.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the block working now is highlighted, and the callout next to it says what it does. Cards travel along the lines with the request `GET /report`, the database query `SELECT …` and the status code. A yellow outline marks the block that wrote the error to the client, and under the diagram you see the status code, the client’s waiting time and the number of log lines. The legend under the diagram explains the other marks.\n\nAfter the first pass lower the application time above the diagram below 60 seconds, then restore it and raise nginx’s timeout. Keep one backend and compare how long the client waits. At the intermediate and experienced levels turn retries off and switch the method to POST. Finally break the backends in different ways in “Break it”: a crashed process, a machine that is off and an application that answers 500 itself give the client different codes and different log lines.'), caption: bi('На схеме код ответа клиенту писал то nginx, то само приложение, а клиент ждал то одну минуту, то две. В следующем разделе разберём правила, по которым nginx выбирает код, повторяет запрос и пишет журнал ошибок.', 'In the diagram the status code was written sometimes by nginx and sometimes by the application, and the client waited one minute or two. The next section explains the rules by which nginx picks the code, retries the request and writes the error log.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Что делает nginx, когда сервер приложения не ответил', 'What nginx does when a backend does not answer'),
      body: bi(
        'Главное правило звучит так: **код ответа говорит, кто его написал**. Код 504 Gateway Time-out означает, что прокси не дождался ответа от сервера upstream. Код 502 Bad Gateway означает, что прокси не получил ответа, потому что соединение отвергнуто, оборвано или ответ испорчен. Код 500 почти всегда пишет само приложение, а прокси только передаёт его клиенту. И раз код вообще пришёл, значит, сеть до прокси в порядке, и проверять DNS, TCP и TLS не нужно.\n\nКогда попытка не удалась, nginx пишет строку в `error.log` и по умолчанию повторяет запрос на следующем сервере группы. За это отвечает настройка `proxy_next_upstream error timeout`, то есть повтор при ошибке соединения или истёкшем сроке ожидания. Отсюда и две минуты из заявки: приложение строит отчёт 75 секунд, nginx ждал первый сервер 60 секунд, прекратил ожидание, повторил запрос на втором сервере, подождал ещё 60 секунд и ответил кодом 504. В журнале при этом две строки, по одной на каждый сервер.\n\nТекст строки подсказывает, на каком этапе случилась ошибка. Слова `while connecting to upstream` означают, что подключиться не удалось: либо процесс не слушает порт (`111: Connection refused`, и тогда клиент обычно получает 502), либо фильтр молча выбрасывает пакеты или машина выключена (`110: Connection timed out`). Слова `while reading response header from upstream` означают, что подключение удалось и запрос отправлен, но ответа nginx не дождался, то есть приложение работает медленно.\n\nЕсть ещё три тонкости. Ответ 500 от сервера приложения nginx не считает ошибкой upstream и передаёт его клиенту без повтора. Запрос с неидемпотентным методом, например POST или PATCH, который уже ушёл на сервер приложения, nginx на другой сервер не повторит, иначе заказ мог бы оформиться дважды. А сервер, на котором попытка не удалась, nginx на 10 секунд исключает из группы (`max_fails=1`, `fail_timeout=10s`); это пассивная проверка состояния сервера, при которой пользователи ошибок не видят, а в журнале раз в 10 секунд появляется новая строка.\n\nОсталось понять, как исправить неисправность из заявки. Увеличить срок ожидания до 600 секунд и забыть о проблеме будет неправильно. Сначала нужно измерить, за сколько сервер upstream отвечает напрямую, и выяснить, почему отчёт строится 75 секунд. Если долгий ответ действительно оправдан, срок ожидания увеличивают только для этого `location`.',
        'The main rule: **the status code tells who wrote it**. 504 Gateway Time-out — the proxy did not get an answer from the upstream in time. 502 Bad Gateway — the proxy could not get one: the connection was refused or broken, or the answer was garbage. 500 is almost always the application itself; the proxy is just the courier. And since a code arrived at all, the network up to the proxy is fine: no need to check DNS, TCP or TLS.\n\nWhen an attempt fails, nginx writes a line to `error.log` and — by default — retries the request on the next server of the group. This is `proxy_next_upstream error timeout`: a retry on a connection error or a timeout. Hence the two minutes of the ticket: the application builds the report in 75 seconds; nginx waited 60 seconds for the first backend, gave up, retried on the second, waited another 60 — and answered 504. The log has two lines, one per upstream.\n\nThe text of the line points to the stage. `while connecting to upstream` — the connection failed: the process does not listen on the port (`111: Connection refused`, and the client usually gets 502), a filter silently drops packets or the machine is off (`110: Connection timed out`). `while reading response header from upstream` — it connected and sent the request but the answer never came: a slow application.\n\nThree more subtleties. A 500 answer from a backend is not an upstream error for nginx: it goes to the client without a retry. A request with a non-idempotent method (POST, PATCH) already sent to a backend is not retried on another server — otherwise an order could be placed twice. And nginx excludes a failed server from the group for 10 seconds (`max_fails=1`, `fail_timeout=10s`) — a passive health check: users see no errors, while a new line appears in the log every 10 seconds.\n\nAnd how to fix the ticket’s case. Not “raise the timeout to 600 and forget”: first measure how long the upstream takes directly and find out why the report takes 75 seconds. If a long answer is legitimate, raise the timeout for that `location` only.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('lb', 'proxy', {}, [{ id: 'r', kind: 'http', from: 'client', to: 'http://10.0.0.1/report' }]),
      intro: bi('Вы работаете на балансировщике lb, где nginx с конфигурацией /etc/nginx/conf.d/shop.conf стоит перед серверами приложения app1 (10.0.2.21:8080) и app2 (10.0.2.22:8080). Имя shop.lab на этой машине указывает на неё саму.', 'You are on the load balancer lb: nginx (configuration in /etc/nginx/conf.d/shop.conf) in front of backends app1 (10.0.2.21:8080) and app2 (10.0.2.22:8080). On this machine the name shop.lab points to itself.'),
      tasks: [
        {
          id: 'layer',
          prompt: bi('Сначала определите уровень. Пользователь получил ответ с кодом 504. На каком уровне находится проблема: L3, L4 или L7? Запишите ответ в файл ~/layer.txt.', 'Layer first. The user got an answer with code 504. At which level is the problem: L3, L4 or L7? Write the answer into ~/layer.txt.'),
          check: { when: "files['/root/layer.txt'].text~'L7'", fail: [{ if: "files['/root/layer.txt'].text~'L3' || files['/root/layer.txt'].text~'L4'", say: bi('Ответ пришёл, значит, адреса, маршруты и соединение до nginx работают. Код 504 пишет прокси, и это сообщение уровня HTTP.', 'An answer arrived — so addresses, routes and the connection to nginx work. 504 is the proxy’s message at the HTTP level.') }] },
          chips: 'echo L7 > ~/layer.txt',
          hints: { H1: bi('Если пришёл код HTTP, значит, всё, что ниже HTTP, уже сработало.', 'If an HTTP code arrived, everything below HTTP has already worked.') },
        },
        {
          id: 'repro',
          prompt: bi('Воспроизведите ошибку, запросив http://shop.lab/report, и посмотрите на код ответа и заголовок Server.', 'Reproduce it: request http://shop.lab/report and look at the code and the Server header.'),
          check: { stdout: /504 Gateway Time-out/ },
          chips: 'curl -sv http://shop.lab/report',
          hints: { H1: bi('Команда curl -sv работает без индикатора загрузки, но показывает заголовки.', 'curl -sv: no progress meter, but with headers.') },
        },
        {
          id: 'log',
          prompt: bi('Прочитайте error.log nginx и посчитайте, сколько в нём строк про этот запрос и к каким серверам upstream они относятся. Затем измерьте, за сколько секунд app1 отвечает напрямую, минуя nginx, и запишите число секунд в файл ~/direct.txt. Время запроса умеет печатать сам curl, флагом `-w`.', 'Read nginx’s error.log. How many lines about this request does it have, and with which upstreams? Then measure how many seconds app1 takes to answer directly, bypassing nginx, and write the number of seconds into ~/direct.txt. curl itself can print the request time, with the `-w` flag.'),
          check: { when: "files['/root/direct.txt'].text~'75'" },
          chips: "cat /var/log/nginx/error.log; curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://10.0.2.21:8080/report",
          hints: {
            H1: bi('В журнале две строки «while reading response header», по одной на каждый сервер, потому что nginx повторил запрос.', 'Two “while reading response header” lines — one per upstream: nginx retried.'),
            H2: bi('curl умеет печатать время запроса, если передать флагу -w переменную time_total.', 'curl can print the request time: -w with the time_total variable.'),
          },
        },
        {
          id: 'fix',
          prompt: bi('Вы измерили, что отчёт строится дольше минуты, и разработчики подтвердили, что так и должно быть. Увеличьте proxy_read_timeout до 90 секунд, проверьте конфигурацию и заставьте nginx перечитать её. После этого /report должен отвечать кодом 200.', 'You measured that the report takes more than a minute, and the developers confirmed that this is expected. Raise proxy_read_timeout to 90 seconds, test the configuration and reload it — /report must answer 200.'),
          check: {
            when: 'reach.r.status=200',
            fail: [{ if: reload, say: bi('Файл исправлен, но работающий nginx держит старую конфигурацию. Её нужно перечитать командой nginx -s reload.', 'The file is fixed, but the running nginx keeps the old configuration. It must be reloaded: nginx -s reload.') }],
          },
          chips: "echo 'proxy_read_timeout 90s;' >> /etc/nginx/conf.d/shop.conf && nginx -t && nginx -s reload",
          docRef: { page: 'web/nginx.org/proxy_read_timeout', anchor: 'CONTEXT' },
          hints: {
            H1: bi('В учебной лаборатории директиву проще всего дописать в конец файла: файл подключается внутри блока http, и настройка подействует на все location. На рабочем сервере её ставят внутрь `location /report`, чтобы долгий срок ожидания не достался остальным страницам.', 'In the lab the directive is easiest to append to the end of the file: the file is included inside the http block, and the setting applies to every location. On a production server it goes inside `location /report`, so that the other pages do not inherit the long timeout.'),
            H2: bi('Строку проще всего дописать в конец файла командой echo с двумя знаками «>», а потом проверить конфигурацию и перечитать её: `echo \'proxy_read_timeout 90s;\' >> /etc/nginx/conf.d/shop.conf && nginx -t && nginx -s reload`.', 'The easiest way is to append the line with echo and two “>” signs, then test and reload the configuration: `echo \'proxy_read_timeout 90s;\' >> /etc/nginx/conf.d/shop.conf && nginx -t && nginx -s reload`.'),
          },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Документация nginx описывает каждую директиву тремя строками: синтаксис, значение по умолчанию и место, где директиву можно писать. Нажмите на строку, где указано значение proxy_read_timeout по умолчанию.', 'The nginx documentation describes every directive with three lines: the syntax, the default, where it may be written. Click the line that gives the default of proxy_read_timeout.'),
      ref: { page: 'web/nginx.org/proxy_read_timeout' },
      answer: 'DEFAULT',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi(
        'Отчёт `/report` строится 75 секунд и сильно нагружает базу данных. Пока разработчики его ускоряют, выяснилась неприятная подробность: когда первый сервер не укладывается в срок ожидания, nginx повторяет запрос на втором, и база строит один и тот же отчёт дважды. Запретите nginx передавать неудавшийся запрос следующему серверу группы, а сроки ожидания не меняйте.',
        'The `/report` takes 75 seconds to build and loads the database heavily. While the developers speed it up, an unpleasant detail came out: when the first backend does not fit into the timeout, nginx retries the request on the second, and the database builds the same report twice. Forbid nginx to pass a failed request to the next server of the group. Do not change the timeouts.',
      ),
      ref: { page: 'web/nginx.org/proxy_next_upstream' },
      terminal: {
        setup: lab('lb', 'proxy', {}, [{ id: 'r', kind: 'http', from: 'client', to: 'http://10.0.0.1/report' }]),
        task: {
          id: 'next',
          prompt: bi('Каждый запрос получает одну попытку: `/report` отвечает кодом 504 через одну минуту, а не через две.', 'One attempt per request: `/report` answers 504 after one minute, not two.'),
          check: {
            when: (f) => {
              const conf = (f.files as Record<string, { text?: string }>)['/etc/nginx/conf.d/shop.conf']?.text ?? '';
              const r = (f.reach as Record<string, { status?: number; ms?: number }> | undefined)?.r;
              return /proxy_next_upstream\s+off\s*;/.test(conf) && !/proxy_(read|connect)_timeout/.test(conf) && r?.status === 504 && (r.ms ?? 0) < 90000;
            },
            fail: [
              { if: (f) => /proxy_(read|connect)_timeout/.test((f.files as Record<string, { text?: string }>)['/etc/nginx/conf.d/shop.conf']?.text ?? ''), say: bi('Срок ожидания просили не менять, и к тому же повтор от этого не исчезнет, а только случится раньше или позже.', 'The timeouts were not to be touched: the retry stays, it just happens later or sooner.') },
              { if: (f) => /proxy_next_upstream\s+off/.test((f.files as Record<string, { text?: string }>)['/etc/nginx/conf.d/shop.conf']?.text ?? ''), say: bi('Правка в файле есть, но nginx работает со старой конфигурацией. Проверьте конфигурацию и заставьте nginx перечитать её.', 'The file has the change, but nginx runs the old configuration: test it and reload.') },
            ],
          },
          docStep: 4,
          beyond: true,
          solutionTokens: ['proxy_next_upstream', 'off'],
        },
      },
    },
    { id: 'summary', kind: 'text', step: 'exit', title: bi('Что вы теперь умеете', 'What you can do now'), body: bi('Теперь вы умеете по коду ответа понять, кто его написал, прочитать строки `error.log` nginx, измерить время ответа сервера приложения напрямую и изменить срок ожидания так, чтобы nginx применил новую конфигурацию.', 'You can now tell from a status code who wrote it, read the lines of nginx’s `error.log`, measure the backend’s answer time directly and change a timeout so that nginx applies the new configuration.') },
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
        'Уровни сети в этом уроке называются коротко, по номерам из [[net.osi|модели OSI]], которую вы разбирали в уроке «Конверты». Напомним, что стоит за номерами. L2 отвечает за доставку кадра внутри одной сети по MAC-адресам, и там же работает ARP. L3 отвечает за IP-адреса и маршруты между сетями. L4 отвечает за порты и соединения TCP и UDP. L7 означает сами прикладные протоколы, например HTTP. Отдельно мы будем называть DNS и TLS, потому что у каждого из них свои характерные ошибки.\n\n[[net.layers-method|Поиск неисправности по уровням]] задаёт порядок, в котором вы рассуждаете. Сначала вы сами воспроизводите симптом и читаете сообщение об ошибке целиком, до последнего слова. Затем по этому сообщению определяете уровень, на котором загрузка остановилась. Потом подтверждаете свою догадку командой, которая проверяет этот уровень, и только его. И всё это время меняете только одну вещь за раз, потому что после двух правок сразу вы не узнаете, какая из них помогла.\n\nИдти можно снизу вверх, от подключения к сети через адрес, маршрут и порт к DNS, TLS и HTTP, а можно сверху вниз, от симптома. Сообщения инструментов почти всегда сами называют уровень, нужно только знать, как их читать:\n\n- `ping: connect: Network is unreachable` означает, что у ядра нет маршрута в нужную сеть и пакет даже не был отправлен. Это уровень L3, и смотреть нужно вывод `ip route`.\n- `From <свой адрес> … Destination Host Unreachable` означает, что соседняя машина или шлюз не отвечает на запросы ARP. Это уровень L2, и смотреть нужно вывод `ip neigh`.\n- `curl: (6) Could not resolve host` означает, что имя не превратилось в адрес. Это DNS, и проверять нужно файл `/etc/resolv.conf` и ответ команды `dig`.\n- `curl: (7) … Couldn\'t connect to server` с пометкой `Connection refused` в выводе `curl -v` означает, что машина работает, но нужный порт на ней закрыт. Это уровень L4, и на сервере нужно посмотреть вывод `ss -ltnp`.\n- `curl: (28) … Timeout was reached` означает, что ответа не пришло вовсе: пакеты отбрасывает фильтр, до машины нет маршрута или машина выключена. Это уровни L3 и L4, и разобраться помогут `traceroute` и `tcpdump`.\n- `curl: (60) SSL certificate problem` означает, что сертификат TLS не прошёл проверку: у него истёк срок, не совпало имя или неполна цепочка подписей.\n- Код `502` означает, что прокси не получил ответа от приложения, а код `504` означает, что прокси не дождался ответа. Это уровень L7, и причину прокси записывает в свой `error.log`.\n\nОсталось правило безопасности. Опасные действия, такие как перезапуск службы на рабочем сервере без проверенной догадки, команда `iptables -F` на роутере или правка двух параметров сразу, выполняют только тогда, когда догадка доказана и вы понимаете, что сломаете, если ошиблись.',
        'In this lesson network layers are named briefly, by their numbers in the [[net.osi|OSI model]] you met in the lesson “Envelopes”. A reminder of what the numbers stand for: L2 delivers a frame within one network by MAC address, and ARP works there; L3 is IP addresses and routes between networks; L4 is ports and TCP and UDP connections; L7 is the application protocols themselves, such as HTTP. We name DNS and TLS separately, because each has its own typical errors.\n\n[[net.layers-method|Layer-by-layer troubleshooting]] is an order of thinking. First reproduce the symptom with your own hands and read the whole message. Then name the layer from the message. Then confirm the hypothesis with a command that checks exactly that layer. And change one thing at a time: two edits at once, and you will not know which one helped.\n\nYou can go bottom up — link, address, route, port, DNS, TLS, HTTP — or top down, from the symptom. Tool messages almost always name the layer themselves:\n\n- `ping: connect: Network is unreachable` — the kernel has no route, the packet was never born: L3, look at `ip route`;\n- `From <your own address> … Destination Host Unreachable` — a neighbour or the gateway does not answer ARP: L2, `ip neigh`;\n- `curl: (6) Could not resolve host` — DNS: `cat /etc/resolv.conf`, `dig`;\n- `curl: (7) … Couldn\'t connect to server`, with `Connection refused` in `-v` — the host is alive, the port is closed: L4, `ss -ltnp` on the server;\n- `curl: (28) … Timeout was reached` — no answer at all: a filter, no route, the host is off: L3/L4, `traceroute`, `tcpdump`;\n- `curl: (60) SSL certificate problem` — TLS: dates, name, chain;\n- `502` — the proxy got no answer from the upstream; `504` — it did not wait long enough: L7, `error.log`.\n\nAnd a safety rule. Dangerous actions — restarting a production service without a hypothesis, `iptables -F` on a router, editing two parameters at once — are done only when the hypothesis is proven and you understand what you will break if you are wrong.',
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
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.url', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» или нажмите «Проиграть» над схемой. На каждом шаге подсвечен один участник, тот, который работает сейчас, и облачко рядом с ним говорит, что он делает: «Резолвер ищет адрес shop.example». По линии движется карточка с тем, что участник передаёт следующему: вопрос `A? shop.example`, пакет `SYN`, запрос `GET /catalog`, ответ `200 OK`. Подпись под схемой объясняет, почему загрузка идёт дальше, а под подписью растёт водопад, в котором каждому шагу, занявшему время, соответствует своя полоса, как во вкладке Network в DevTools. Значки и рамки объяснены в легенде под схемой.\n\nКогда пройдёте исправную загрузку до конца, включайте по одной поломке в блоке «Сломать» над схемой. Перед каждой поломкой схема спросит, на каком шаге, по-вашему, остановится загрузка. Ответьте, а потом посмотрите, где загрузка остановилась на самом деле и какое сообщение напечатали бы браузер и `curl`. Эти сообщения стоит запомнить, потому что в инцидентах ниже вы встретите их снова.', 'Press “Start from the first step”, then go on with “Step forward” or press “Play” above the diagram. At every step one participant is highlighted, the one working now, and the callout next to it says what it does. A card travels along the line with what it hands on: the question `A? shop.example`, the `SYN` packet, the request `GET /catalog`, the answer `200 OK`. The caption under the diagram explains why the load goes on, and under it a waterfall grows, one bar for every step that took time, as in the Network tab of DevTools. The legend under the diagram explains the pictograms and outlines.\n\nOnce you have walked through a healthy load, switch on the breaks in the “Break it” block one at a time. Before each break the diagram asks at which step you think the load will stop. Answer, then see where it really stopped and what the browser and `curl` would print. Remember these messages: you will meet them again in the incidents below.'), caption: bi('Сообщения, которые вы видели при поломках, понадобятся сразу. В первом инциденте ниже пользователь жалуется, что страница долго грузится и потом показывает ошибку. Вспомните, какая из поломок на схеме вела себя так же, и подтвердите свою догадку командой.', 'The messages you saw with the breaks are needed right away. In the first incident below the user complains that the page loads for ages and then shows an error. Recall which break in the diagram behaved the same way, and confirm your guess with a command.') },
    {
      id: 'url',
      kind: 'text',
      step: 'explain',
      title: bi('Что происходит, когда вы вводите адрес сайта', 'What happens when you type a URL'),
      body: bi(
        'Этот вопрос задают почти на каждом собеседовании, и теперь у вас есть все слова, чтобы на него ответить. Сначала браузер разбирает адрес на схему, имя, порт и путь и проверяет свой кэш: если там лежит свежая копия страницы, в сеть не уходит ничего. Если ноутбук ещё не знает MAC-адрес шлюза, он узнаёт его по ARP. Затем имя сайта превращается в адрес. Система ноутбука ищет адрес в своём кэше и в файле `/etc/hosts`, а потом спрашивает рекурсивный резолвер провайдера. Если в кэше резолвера ответа нет, резолвер по очереди спрашивает корневой сервер, сервер домена верхнего уровня и авторитативный сервер сайта.\n\nПервый пакет соединения уходит через домашний роутер, и NAT заменяет в нём адрес отправителя. Рукопожатие TCP с ближайшим узлом CDN занимает один путь до узла и обратно, а рукопожатие TLS 1.3, в котором браузер называет имя сайта и проверяет сертификат, занимает ещё один. После этого браузер отправляет зашифрованный запрос `GET /catalog`. Узел CDN отдаёт страницу из своего кэша или запрашивает её у сервера сайта. Там запрос проходит через nginx, который передаёт адрес клиента в заголовке `X-Forwarded-For`, к приложению, а приложение берёт данные из базы. Ответ возвращается тем же путём, и роутер по своей таблице NAT передаёт его ноутбуку. Наконец браузер разбирает HTML и по тому же соединению запрашивает стили и картинки.\n\nНа каждом из этих шагов загрузка может сломаться, и у каждой поломки своё сообщение; четыре такие поломки вы включали сами на схеме выше. Хороший ответ на собеседовании проходит этот путь по порядку и на каждом шаге говорит, что здесь может сломаться и какой командой это проверить.',
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
              { if: "files['/root/layer.txt'].text~'DNS'", say: bi('Имя превращается в адрес, потому что команда dig shop.example отвечает адресом. Поломка находится дальше по пути.', 'The name resolves: dig shop.example answers with an address. The problem is further on.') },
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
          check: { stdout: /curl: \(28\) (Failed to connect to shop\.example port 443 after 5\d{3} ms: Timeout was reached|Connection timed out after 5\d{3} milliseconds)|nc: connect to [\d.]+ port 443 \(tcp\) timed out/ },
          chips: 'curl --connect-timeout 5 https://shop.example/',
          hints: { H1: bi('Код 28 означает, что у curl истёк срок ожидания. Если бы соединение отклонили, curl вернул бы код 7. Подойдёт и `curl -m 5`, и `nc -zv -w 5 shop.example 443`.','curl code 28 means time ran out; refused would be code 7. `curl -m 5` and `nc -zv -w 5 shop.example 443` work too.') },
        },
      ],
    },
    {
      id: 'incident2',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('lb', 'proxy', { wrongPort: true }, [{ id: 'r', kind: 'http', from: 'client', to: 'http://10.0.0.1/' }]),
      intro: bi('Второй инцидент. После выкладки новой версии все страницы сайта отвечают ошибкой 502. Вы работаете на балансировщике lb, а приложение запущено на единственном сервере app1 с адресом 10.0.2.21. Войти на app1 отсюда нельзя, потому что сервер SSH на нём не запущен, поэтому порт приложения придётся искать снаружи: по журналу ошибок nginx и проверкой портов командой nc.', 'Incident 2. “After the deploy — 502 on every page.” You are on the load balancer lb; there is one backend, app1 (10.0.2.21). You cannot log in to app1 from here, because no SSH server runs on it, so the application’s port has to be found from outside: from the nginx error log and by checking ports with nc.'),
      tasks: [
        {
          id: 'port',
          prompt: bi('Выясните, на каком порту приложение на app1 принимает соединения на самом деле, и запишите номер этого порта в файл ~/port.txt.', 'Find out which port the application on app1 really listens on and write the number into ~/port.txt.'),
          check: { when: "files['/root/port.txt'].text~'8081'", fail: [{ if: "files['/root/port.txt'].text~'8080'", say: bi('На порту 8080 приложение отвечает отказом Connection refused, то есть приложения на этом порту нет.', 'On 8080 the application answers with a refusal — Connection refused. It is not there.') }] },
          chips: 'curl -sI http://localhost/; tail /var/log/nginx/error.log; nc -zv 10.0.2.21 8079-8090',
          hints: {
            H1: bi('В файл /var/log/nginx/error.log nginx записывает, к какому адресу и порту он обращается и что получает в ответ. Если журнал пока пуст, повторите запрос пользователя сами командой `curl -sI http://localhost/`: nginx ответит кодом 502 и запишет в журнал строку о неудачном подключении.', 'nginx writes into /var/log/nginx/error.log which address and port it connects to and what it gets back. If the log is still empty, repeat the user’s request yourself with `curl -sI http://localhost/`: nginx answers 502 and writes a line about the failed connection into the log.'),
            H2: bi('Проверьте соседние порты командой nc -zv. Ей можно передать сразу диапазон портов через дефис, например `nc -zv 10.0.2.21 8079-8090`, и она проверит их по очереди. Отказ приходит мгновенно, поэтому перебор займёт секунды, а нужный порт отмечен в выводе словом succeeded.', 'Check the neighbouring ports with nc -zv. It accepts a whole range of ports with a hyphen, for example `nc -zv 10.0.2.21 8079-8090`, and checks them one by one. A refusal is instant, so the search takes seconds, and the right port is marked in the output with the word succeeded.'),
          },
        },
        {
          id: 'fix',
          prompt: bi('Исправьте порт в блоке upstream файла /etc/nginx/conf.d/shop.conf, проверьте конфигурацию и заставьте nginx перечитать её. Текстового редактора на этой машине нет, но файл можно поправить командой `sed -i \'s/старое/новое/\' файл`: она находит в файле первое вхождение старого текста в каждой строке и заменяет его новым прямо на месте. Задание выполнено, когда сайт снова отвечает кодом 200.', 'Fix the upstream in /etc/nginx/conf.d/shop.conf to the right port, test and reload the configuration. There is no text editor on this machine, but the file can be fixed with `sed -i \'s/old/new/\' file`: it finds the old text in each line and replaces it with the new one in place. The task is done when the site answers 200 again.'),
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
    { id: 'summary', kind: 'text', step: 'exit', title: bi('Что вы теперь умеете', 'What you can do now'), body: bi('Теперь вы умеете по сообщению об ошибке определить уровень, на котором остановилась загрузка сайта, подтвердить догадку одной командой и рассказать на собеседовании, что происходит между нажатием Enter и готовой страницей.', 'You can now tell from an error message at which layer a site’s loading stopped, confirm the guess with one command and tell an interviewer what happens between pressing Enter and the finished page.') },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.ts.layer', 'net.q.ts.first', 'net.q.ts.revisit', 'net.q.ts.ping'] },
  ],
};

// ── 15. The protocol catalogue ─────────────────────────────────────────────

export const protocols: Lesson = {
  id: 'networks.protocols',
  block: 'networks',
  title: bi('Каталог протоколов', 'The protocol catalogue'),
  summary: bi('В этом справочнике каждый протокол описан карточкой одного и того же вида: зачем протокол нужен, на каком он слое, как идёт обмен, как за ним наблюдать и как он ломается.', 'A reference of uniform cards: why, which layer, how the exchange goes, how to observe it, how it breaks.'),
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
        'Каталог не заменяет уроки, а собирает их в одном месте и дополняет тем, что в уроки не вошло. Все карточки устроены одинаково: зачем нужен протокол, на каком он слое и поверх чего работает, как идёт обмен сообщениями (на диаграмме время идёт сверху вниз), какими командами за ним наблюдать и как он ломается, с ответом на главный вопрос о том, на каком уровне произошла поломка. Карточки для начинающих собраны из уроков блока, а карточки среднего и опытного уровня написаны как короткие самостоятельные уроки о VLAN, HTTP/2 и HTTP/3, WebSocket, gRPC, BGP, VXLAN, WireGuard и mTLS.',
        'The catalogue does not replace the lessons; it gathers them in one place and adds what did not fit. Every card has the same structure: why the protocol exists, which layer it is at and what it runs on, how the exchange goes (a diagram, time running downwards), which commands let you observe it and how it breaks — with an answer to the main question, “which layer?”. The beginner cards are put together from the block’s lessons; the intermediate and experienced cards are short lessons of their own: VLAN, HTTP/2 and HTTP/3, WebSocket, gRPC, BGP, VXLAN, WireGuard, mTLS.',
      ),
    },
    { id: 'catalogue', kind: 'widget', step: 'explain', widget: 'net.protocols' },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.proto.ntp'] },
    { id: 'quiz-deep', kind: 'quiz', step: 'exit', levels: ['intermediate', 'experienced'], title: bi('Проверьте, поверх чего работают протоколы', 'Check what the protocols run on'), items: ['net.q.proto.transport'] },
  ],
};
