// The quiz bank of the Networks block (03 §16). Every distractor is a
// recorded misconception with its own explanation. Items are grouped by the
// lesson that uses them; their wording respects the concept order.

import { bi } from '../../core/i18n';
import type { QuizItem, TerminalSetup } from '../../core/types';

const home: TerminalSetup = { user: 'root', hostname: 'laptop', ext: { net: { preset: 'home' } } };
const tcpLab: TerminalSetup = { user: 'root', hostname: 'client', ext: { net: { preset: 'tcp' } } };

export const quiz: QuizItem[] = [
  // ── the internet ──
  {
    id: 'net.q.internet.order',
    kind: 'order',
    concepts: ['net.as', 'net.ixp'],
    prompt: bi('Расставьте участки пути от ноутбука до сайта в другой стране.', 'Put the parts of the path from a laptop to a site in another country in order.'),
    steps: [
      { id: 'wifi', text: bi('Wi-Fi до домашнего роутера', 'Wi-Fi to the home router') },
      { id: 'isp', text: bi('сеть провайдера (AS 64500)', 'the provider’s network (AS 64500)') },
      { id: 'ixp', text: bi('точка обмена трафиком', 'an internet exchange point'), why: bi('Точка обмена соединяет сети провайдеров — она между провайдером и чужой сетью, а не дома.', 'The exchange point joins providers’ networks — it sits between the provider and another network, not at home.') },
      { id: 'cable', text: bi('подводный кабель', 'a submarine cable') },
      { id: 'dc', text: bi('ЦОД с сервером сайта', 'the data centre with the site’s server') },
    ],
    explain: bi('Каждый участок принадлежит своему хозяину: вы, провайдер, точка обмена, оператор кабеля, хостинг.', 'Each part has its own owner: you, the provider, the exchange point, the cable operator, the hosting company.'),
    refs: { explainer: 'net.map' },
  },
  {
    id: 'net.q.internet.latency',
    kind: 'mcq',
    concepts: ['net.latency', 'net.rtt'],
    prompt: bi('Почему ping из Москвы до сервера в Нью-Йорке (около 7 500 км) не может показать 5 мс?', 'Why can a ping from Moscow to a server in New York (about 7,500 km) never show 5 ms?'),
    options: [
      { id: 'light', text: bi('Свет в оптоволокне идёт около 5 мкс на километр: только в одну сторону ≈ 37 мс, туда-обратно ≈ 75 мс', 'Light in fibre travels about 5 µs per kilometre: ≈ 37 ms one way, ≈ 75 ms round trip'), correct: true },
      { id: 'slow', text: bi('Потому что у провайдера медленный тариф', 'Because the provider’s plan is slow'), why: bi('Скорость тарифа — это сколько данных в секунду, а не сколько едет один пакет. Задержку она почти не меняет.', 'A plan’s speed is how much data per second, not how long one packet travels. It barely changes delay.') },
      { id: 'servers', text: bi('Из-за медленных серверов в Нью-Йорке', 'Because the servers in New York are slow'), why: bi('Даже мгновенный сервер не ответит быстрее, чем свет пройдёт путь туда и обратно.', 'Even an instant server cannot answer faster than light covers the path there and back.') },
    ],
    explain: bi('Задержку распространения не ускорить — можно только сократить путь. Поэтому копии сайтов ставят ближе к пользователям.', 'Propagation delay cannot be sped up — only the path can be shortened. That is why copies of sites are placed nearer to users.'),
    refs: { explainer: 'net.map' },
  },
  {
    id: 'net.q.internet.match',
    kind: 'match',
    concepts: ['net.as', 'net.bgp', 'net.ixp'],
    prompt: bi('Сопоставьте понятие и что это такое.', 'Match the term with what it is.'),
    pairs: [
      { id: 'as', left: bi('автономная система', 'autonomous system'), right: bi('сеть под одним управлением со своим номером', 'a network under one administration with its own number') },
      { id: 'bgp', left: 'BGP', right: bi('как сети сообщают соседям, какие адреса у них', 'how networks tell neighbours which addresses they have') },
      { id: 'ixp', left: 'IXP', right: bi('место, где сети обмениваются трафиком напрямую', 'a place where networks exchange traffic directly') },
      { id: 'cable', left: bi('подводный кабель', 'submarine cable'), right: bi('физический путь между континентами', 'the physical path between continents') },
    ],
    refs: { explainer: 'net.map' },
  },
  {
    id: 'net.q.internet.ixp',
    kind: 'mcq',
    concepts: ['net.ixp'],
    prompt: bi('Два провайдера одного города перестали обмениваться трафиком через точку обмена. Что станет с задержкой между их абонентами?', 'Two providers in one city stopped exchanging traffic through the exchange point. What happens to the delay between their customers?'),
    options: [
      { id: 'up', text: bi('Вырастет: трафик пойдёт через транзитного оператора, иногда через другую страну', 'It grows: traffic goes through a transit carrier, sometimes through another country'), correct: true },
      { id: 'down', text: bi('Упадёт: стало на одно устройство меньше', 'It falls: there is one device fewer'), why: bi('Устройство выпало, но путь стал длиннее: вместо соседнего коммутатора — чужая сеть далеко.', 'A device dropped out, but the path got longer: instead of a nearby switch, a distant foreign network.') },
      { id: 'same', text: bi('Не изменится: адреса те же', 'Nothing: the addresses are the same'), why: bi('Адреса те же, а дорога другая — задержку определяет дорога.', 'The addresses are the same, but the road differs — the road decides the delay.') },
    ],
    refs: { explainer: 'net.map' },
  },

  // ── frames ──
  {
    id: 'net.q.frames.flood',
    kind: 'mcq',
    concepts: ['net.switch', 'net.mac'],
    prompt: bi('Коммутатор только что включили, его таблица пуста. A отправляет кадр B. Куда уйдёт кадр?', 'The switch has just been switched on; its table is empty. A sends a frame to B. Where does the frame go?'),
    options: [
      { id: 'all', text: bi('Во все порты, кроме того, откуда пришёл', 'Out of every port except the one it came in on'), correct: true },
      { id: 'b', text: bi('Только к B', 'Only to B'), why: bi('Откуда коммутатору знать, где B? Он узнает, только когда B что-нибудь отправит.', 'How would the switch know where B is? It learns that only once B sends something.') },
      { id: 'drop', text: bi('Никуда: неизвестный адрес выбрасывается', 'Nowhere: an unknown address is dropped'), why: bi('Коммутатор не выбрасывает кадры к неизвестным MAC — он рассылает их всем.', 'A switch does not drop frames to unknown MACs — it floods them to everyone.') },
    ],
    refs: { explainer: 'net.switch' },
  },
  {
    id: 'net.q.frames.scope',
    kind: 'mcq',
    concepts: ['net.mac', 'net.frame'],
    prompt: bi('Ноутбук открывает сайт в другом городе. Чей MAC-адрес стоит получателем в кадре, который ушёл с ноутбука?', 'A laptop opens a site in another city. Whose MAC address is the receiver in the frame leaving the laptop?'),
    options: [
      { id: 'router', text: bi('Домашнего роутера', 'The home router’s'), correct: true },
      { id: 'server', text: bi('Сервера сайта', 'The site server’s'), why: bi('MAC действует только в своей локальной сети. Сервер в другом городе — не сосед, кадр до него не дойдёт.', 'A MAC means something only in its own local network. A server in another city is not a neighbour; a frame never reaches it.') },
      { id: 'bcast', text: bi('ff:ff:ff:ff:ff:ff', 'ff:ff:ff:ff:ff:ff'), why: bi('Это адрес «всем в комнате», он не уводит пакет наружу.', 'That is the “everyone in the room” address; it does not take the packet outside.') },
    ],
    explain: bi('Кадр живёт один участок: до следующего устройства. Дальше пакет перекладывают в новый кадр с другими MAC.', 'A frame lives for one segment: to the next device. Further on the packet is put into a new frame with other MACs.'),
  },
  {
    id: 'net.q.frames.label',
    kind: 'label',
    concepts: ['net.frame', 'net.mac'],
    prompt: bi('Подпишите поля кадра Ethernet в том порядке, в каком они идут в проводе.', 'Label the fields of an Ethernet frame in the order they travel on the wire.'),
    diagram: {
      width: 720,
      height: 120,
      slots: [
        { id: 's1', x: 10, y: 32, w: 130, h: 56, answer: 'dst', family: 'l2' },
        { id: 's2', x: 148, y: 32, w: 130, h: 56, answer: 'src', family: 'l2' },
        { id: 's3', x: 286, y: 32, w: 110, h: 56, answer: 'type', family: 'l2' },
        { id: 's4', x: 404, y: 32, w: 200, h: 56, answer: 'data', family: 'l3' },
        { id: 's5', x: 612, y: 32, w: 98, h: 56, answer: 'fcs', family: 'l2' },
      ],
    },
    labels: [
      { id: 'dst', text: bi('MAC получателя', 'Destination MAC') },
      { id: 'src', text: bi('MAC отправителя', 'Source MAC') },
      { id: 'type', text: 'EtherType' },
      { id: 'data', text: bi('данные', 'data') },
      { id: 'fcs', text: bi('контрольная сумма', 'checksum (FCS)') },
      { id: 'ip', text: bi('IP-адрес получателя', 'destination IP address'), why: bi('IP-адрес лежит внутри данных кадра — в заголовке кадра его нет.', 'The IP address is inside the frame’s data — the frame header has none.') },
    ],
    explain: bi('Сначала адрес получателя: коммутатор принимает решение, ещё не дочитав кадр.', 'The receiver’s address comes first: a switch decides before it has read the whole frame.'),
  },

  // ── subnets ──
  {
    id: 'net.q.sub.hosts',
    kind: 'mcq',
    concepts: ['net.cidr', 'net.subnet'],
    prompt: bi('Сколько адресов для хостов в подсети 192.168.10.0/26?', 'How many host addresses are in subnet 192.168.10.0/26?'),
    options: [
      { id: '62', text: '62', correct: true },
      { id: '64', text: '64', why: bi('64 — все адреса подсети. Первый — адрес сети, последний — broadcast; хостам их не выдают.', '64 is every address of the subnet. The first is the network address and the last the broadcast; hosts do not get them.') },
      { id: '26', text: '26', why: bi('26 — длина сетевой части в битах, а не число адресов. Хостам остаётся 32 − 26 = 6 бит.', '26 is the length of the network part in bits, not a number of addresses. Hosts get 32 − 26 = 6 bits.') },
      { id: '254', text: '254', why: bi('254 — у /24. Чем длиннее префикс, тем меньше хостов.', '254 belongs to /24. The longer the prefix, the fewer the hosts.') },
    ],
    explain: bi('2^(32 − 26) = 64 адреса, минус адрес сети и broadcast = 62.', '2^(32 − 26) = 64 addresses, minus the network and broadcast addresses = 62.'),
    key: true,
  },
  {
    id: 'net.q.sub.private',
    kind: 'multi',
    concepts: ['net.private'],
    prompt: bi('Какие адреса — частные (RFC 1918)?', 'Which addresses are private (RFC 1918)?'),
    options: [
      { id: 'a', text: '10.12.0.5', correct: true },
      { id: 'b', text: '172.32.1.1', why: bi('172.16.0.0/12 — это 172.16.0.0…172.31.255.255. 172.32.x.x уже за границей.', '172.16.0.0/12 is 172.16.0.0…172.31.255.255. 172.32.x.x is past the border.') },
      { id: 'c', text: '192.168.100.200', correct: true },
      { id: 'd', text: '100.64.3.3', why: bi('100.64.0.0/10 — общий адрес провайдеров (CGNAT, RFC 6598), не RFC 1918.', '100.64.0.0/10 is the providers’ shared range (CGNAT, RFC 6598), not RFC 1918.') },
      { id: 'e', text: '172.20.0.1', correct: true },
    ],
    explain: bi('Частные диапазоны: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.', 'The private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.'),
  },
  {
    id: 'net.q.sub.same',
    kind: 'mcq',
    concepts: ['net.subnet'],
    prompt: bi('У хоста 10.0.1.10/24. Кто из этих адресов — в его подсети и достижим напрямую?', 'A host has 10.0.1.10/24. Which of these addresses is in its subnet and reachable directly?'),
    options: [
      { id: 'a', text: '10.0.1.200', correct: true },
      { id: 'b', text: '10.0.2.10', why: bi('Третье число другое: при /24 сеть — это первые три числа, 10.0.2.x — соседняя подсеть.', 'The third number differs: with /24 the network is the first three numbers; 10.0.2.x is the next subnet.') },
      { id: 'c', text: '10.1.1.10', why: bi('Отличается второе число — это совсем другая сеть.', 'The second number differs — a different network altogether.') },
    ],
  },
  {
    id: 'net.q.sub.mask',
    kind: 'mcq',
    concepts: ['net.cidr'],
    prompt: bi('Какая маска у префикса /20?', 'What mask does prefix /20 have?'),
    options: [
      { id: 'a', text: '255.255.240.0', correct: true },
      { id: 'b', text: '255.255.255.240', why: bi('Это /28: 28 единиц. У /20 единиц 20 — 8 + 8 + 4.', 'That is /28: 28 ones. /20 has 20 ones — 8 + 8 + 4.') },
      { id: 'c', text: '255.255.20.0', why: bi('Маска — это не число 20 в третьем октете, а 20 единиц слева: 11110000 в третьем октете = 240.', 'The mask is not the number 20 in the third octet but 20 ones from the left: 11110000 in the third octet = 240.') },
    ],
  },

  // ── ARP ──
  {
    id: 'net.q.arp.who',
    kind: 'mcq',
    concepts: ['net.arp'],
    prompt: bi('Хост спрашивает по ARP: «у кого 192.168.1.20?». Кто отвечает?', 'A host asks over ARP: “who has 192.168.1.20?”. Who answers?'),
    options: [
      { id: 'owner', text: bi('Только машина с этим адресом, своим MAC', 'Only the machine with that address, with its MAC'), correct: true },
      { id: 'switch', text: bi('Коммутатор, у него же таблица MAC', 'The switch, since it has a MAC table'), why: bi('Таблица коммутатора — «MAC → порт», IP-адресов он не знает и в ARP не участвует.', 'The switch table is “MAC → port”; it knows no IP addresses and takes no part in ARP.') },
      { id: 'all', text: bi('Все в локальной сети', 'Everyone on the local network'), why: bi('Вопрос слышат все, отвечает один — тот, чей адрес спросили.', 'Everyone hears the question; only the one whose address was asked answers.') },
    ],
    refs: { explainer: 'net.arp' },
  },
  {
    id: 'net.q.arp.unreach',
    kind: 'mcq',
    concepts: ['net.arp', 'net.arp-cache'],
    prompt: bi('ping печатает `From 192.168.1.10 icmp_seq=1 Destination Host Unreachable`, а 192.168.1.10 — это вы сами. Что это значит?', 'ping prints `From 192.168.1.10 icmp_seq=1 Destination Host Unreachable`, and 192.168.1.10 is you. What does it mean?'),
    options: [
      { id: 'arp', text: bi('Сосед не ответил на ARP: пакет даже не ушёл', 'The neighbour did not answer ARP: the packet never left'), correct: true },
      { id: 'fw', text: bi('Сосед получил пакет и отказал', 'The neighbour received the packet and refused it'), why: bi('Тогда ошибка пришла бы от соседа, с его адресом. Здесь её пишет ваше же ядро.', 'Then the error would come from the neighbour, with its address. Here your own kernel writes it.') },
      { id: 'dns', text: bi('Неправильный DNS', 'Wrong DNS'), why: bi('Адрес уже числовой — имя тут не участвует.', 'The address is already a number — no name is involved.') },
    ],
    explain: bi('ip neigh покажет для соседа состояние FAILED.', 'ip neigh shows the neighbour as FAILED.'),
  },
  {
    id: 'net.q.arp.order',
    kind: 'order',
    concepts: ['net.arp', 'net.arp-cache'],
    prompt: bi('Что происходит перед первым пакетом к соседу, если ARP-кэш пуст?', 'What happens before the first packet to a neighbour when the ARP cache is empty?'),
    steps: [
      { id: 'miss', text: bi('ядро не находит MAC в ARP-кэше', 'the kernel finds no MAC in the ARP cache') },
      { id: 'ask', text: bi('широковещательный вопрос who-has', 'a broadcast who-has question') },
      { id: 'reply', text: bi('сосед отвечает is-at своим MAC', 'the neighbour answers is-at with its MAC') },
      { id: 'store', text: bi('ответ записан в ARP-кэш', 'the answer is stored in the ARP cache') },
      { id: 'send', text: bi('уходит кадр с пакетом', 'the frame with the packet leaves') },
    ],
  },

  // ── routing ──
  {
    id: 'net.q.route.lpm',
    kind: 'mcq',
    concepts: ['net.lpm', 'net.route-table'],
    prompt: bi('На хосте два маршрута: 10.0.0.0/8 via 10.1.1.1 и 10.20.0.0/16 via 10.1.1.2. Куда уйдёт пакет на 10.20.5.5?', 'A host has two routes: 10.0.0.0/8 via 10.1.1.1 and 10.20.0.0/16 via 10.1.1.2. Where does a packet to 10.20.5.5 go?'),
    options: [
      { id: 'b', text: bi('через 10.1.1.2: /16 длиннее /8', 'via 10.1.1.2: /16 is longer than /8'), correct: true },
      { id: 'a', text: bi('через 10.1.1.1: эта строка выше', 'via 10.1.1.1: that line comes first'), why: bi('Порядок строк не важен: выигрывает самый длинный подходящий префикс.', 'The order of lines does not matter: the longest matching prefix wins.') },
      { id: 'both', text: bi('по очереди через оба', 'alternately through both'), why: bi('Это не балансировка: для одного адреса выбирается одна, самая точная строка.', 'This is not load balancing: for one address one line, the most specific, is chosen.') },
    ],
    key: true,
    refs: { explainer: 'net.route' },
  },
  {
    id: 'net.q.route.changes',
    kind: 'multi',
    concepts: ['net.router', 'net.ttl'],
    prompt: bi('Что обычный маршрутизатор (без NAT) меняет в пересылаемом пакете?', 'What does an ordinary router (without NAT) change in a forwarded packet?'),
    options: [
      { id: 'mac', text: bi('MAC-адреса кадра', 'the frame’s MAC addresses'), correct: true },
      { id: 'ttl', text: 'TTL', correct: true },
      { id: 'sum', text: bi('контрольную сумму IP-заголовка', 'the IP header checksum'), correct: true },
      { id: 'dst', text: bi('IP-адрес получателя', 'the destination IP address'), why: bi('Адрес получателя от начала до конца пути один — по нему и выбирают маршрут.', 'The destination address is the same along the whole path — routes are chosen by it.') },
      { id: 'port', text: bi('порт TCP', 'the TCP port'), why: bi('Маршрутизатор не открывает конверт TCP.', 'A router does not open the TCP envelope.') },
    ],
    refs: { explainer: 'net.route' },
  },
  {
    id: 'net.q.route.trace',
    kind: 'mcq',
    concepts: ['net.icmp', 'net.ttl'],
    prompt: bi('traceroute -n 10.20.0.5 печатает: 1 192.168.1.1, 2 10.0.0.1, 3 * * *, 4 * * *. Где сломалось?', 'traceroute -n 10.20.0.5 prints: 1 192.168.1.1, 2 10.0.0.1, 3 * * *, 4 * * *. Where is it broken?'),
    options: [
      { id: 'after', text: bi('За 10.0.0.1: дальше пакеты не доходят или ответы не возвращаются', 'Beyond 10.0.0.1: packets do not get further or answers do not come back'), correct: true },
      { id: 'at', text: bi('Сломан сам 10.0.0.1', '10.0.0.1 itself is broken'), why: bi('10.0.0.1 ответил — значит, он жив и принял пакет. Смотреть надо на следующий узел и маршрут обратно.', '10.0.0.1 answered — so it is alive and took the packet. Look at the next node and the route back.') },
      { id: 'dns', text: bi('Проблема с DNS', 'A DNS problem'), why: bi('С -n traceroute вообще не обращается к DNS.', 'With -n traceroute does not use DNS at all.') },
    ],
    key: true,
  },
  {
    id: 'net.q.route.oneway',
    kind: 'mcq',
    concepts: ['net.route-table', 'net.gateway'],
    prompt: bi('Ping с A до B не проходит, а захват на B показывает пришедшие эхо-запросы. Самая вероятная причина?', 'A ping from A to B fails, but a capture on B shows the echo requests arriving. The most likely cause?'),
    options: [
      { id: 'back', text: bi('У B нет маршрута обратно к сети A', 'B has no route back to A’s network'), correct: true },
      { id: 'a', text: bi('У A нет маршрута к B', 'A has no route to B'), why: bi('Тогда запросы не дошли бы до B.', 'Then the requests would not reach B.') },
      { id: 'mac', text: bi('У B неправильный MAC', 'B has the wrong MAC'), why: bi('Запросы пришли — кадры до B доходят.', 'The requests arrived — frames do reach B.') },
    ],
  },

  // ── transport ──
  {
    id: 'net.q.tcp.order',
    kind: 'order',
    concepts: ['net.handshake', 'net.tcp'],
    prompt: bi('Расставьте сообщения одного короткого TCP-соединения.', 'Put the messages of one short TCP connection in order.'),
    steps: [
      { id: 'syn', text: 'SYN' },
      { id: 'synack', text: 'SYN-ACK' },
      { id: 'ack', text: 'ACK' },
      { id: 'data', text: bi('данные и подтверждения', 'data and acknowledgements') },
      { id: 'fin', text: 'FIN' },
    ],
    refs: { explainer: 'net.tcp' },
  },
  {
    id: 'net.q.tcp.refused',
    kind: 'mcq',
    concepts: ['net.tcp', 'net.port'],
    prompt: bi('curl к закрытому порту одного сервера отвечает мгновенно, к другому — висит до таймаута. В чём разница?', 'curl to a closed port answers instantly on one server and hangs until a timeout on another. What is the difference?'),
    options: [
      { id: 'rst', text: bi('Первый ответил RST (порт никто не слушает); у второго пакеты молча выбрасывает фильтр или они не доходят', 'The first answered RST (nobody listens); on the second a filter silently drops the packets or they never arrive'), correct: true },
      { id: 'load', text: bi('Второй сервер перегружен', 'The second server is overloaded'), why: bi('Перегруженный сервер всё равно ответил бы на SYN ядром. Полная тишина — это DROP или недоступность.', 'An overloaded server would still answer the SYN from its kernel. Total silence means a DROP or unreachability.') },
      { id: 'dns', text: bi('У второго медленный DNS', 'The second has slow DNS'), why: bi('Зависание наступает после того, как адрес уже известен: на этапе подключения.', 'The hang comes after the address is known: at the connection stage.') },
    ],
    key: true,
    refs: { explainer: 'net.tcp' },
  },
  {
    id: 'net.q.tcp.ports',
    kind: 'match',
    concepts: ['net.port', 'net.udp', 'net.tcp'],
    prompt: bi('Сопоставьте службу и её транспорт и порт по умолчанию.', 'Match the service with its default transport and port.'),
    pairs: [
      { id: 'ssh', left: 'SSH', right: 'TCP 22' },
      { id: 'dns', left: bi('запрос DNS', 'a DNS query'), right: 'UDP 53' },
      { id: 'http', left: 'HTTP', right: 'TCP 80' },
      { id: 'https', left: 'HTTPS', right: 'TCP 443' },
    ],
  },
  {
    id: 'net.q.tcp.ephemeral',
    kind: 'mcq',
    concepts: ['net.ephemeral'],
    prompt: bi('В выводе ss у клиента: 10.0.0.1:51234 → 10.0.0.2:8080. Откуда взялось 51234?', 'In ss on the client: 10.0.0.1:51234 → 10.0.0.2:8080. Where did 51234 come from?'),
    options: [
      { id: 'kernel', text: bi('Ядро клиента выбрало свободный эфемерный порт', 'The client’s kernel picked a free ephemeral port'), correct: true },
      { id: 'server', text: bi('Его назначил сервер', 'The server assigned it'), why: bi('Сервер знает только свой порт 8080; порт клиента приходит в первом же SYN.', 'The server knows only its own port 8080; the client’s port arrives in the very first SYN.') },
      { id: 'cfg', text: bi('Он прописан в настройках curl', 'It is set in curl’s settings'), why: bi('curl не выбирает порт источника: это делает ядро при connect().', 'curl does not choose the source port: the kernel does at connect().') },
    ],
  },

  // ── envelopes ──
  {
    id: 'net.q.env.order',
    kind: 'order',
    concepts: ['net.encapsulation'],
    prompt: bi('Соберите эхо-запрос ping из конвертов: от внешнего к внутреннему.', 'Assemble a ping echo request from envelopes: from the outermost to the innermost.'),
    steps: [
      { id: 'eth', text: bi('кадр Ethernet', 'Ethernet frame') },
      { id: 'ip', text: bi('пакет IP', 'IP packet') },
      { id: 'icmp', text: bi('сообщение ICMP echo', 'ICMP echo message') },
      { id: 'data', text: bi('56 байт данных', '56 bytes of data') },
    ],
    explain: bi('У ping нет TCP и UDP: ICMP лежит прямо в IP.', 'ping has no TCP or UDP: ICMP sits directly inside IP.'),
    refs: { explainer: 'net.envelopes' },
  },
  {
    id: 'net.q.env.layer',
    kind: 'match',
    concepts: ['net.osi'],
    prompt: bi('Какой это уровень? Сопоставьте симптом и слой.', 'Which layer is it? Match the symptom with the layer.'),
    pairs: [
      { id: 'l2', left: bi('ARP без ответа, ip neigh: FAILED', 'ARP without an answer, ip neigh: FAILED'), right: 'L2' },
      { id: 'l3', left: 'connect: Network is unreachable', right: 'L3' },
      { id: 'l4', left: 'Connection refused', right: 'L4' },
      { id: 'l7', left: '404 Not Found', right: 'L7' },
    ],
    refs: { explainer: 'net.envelopes' },
  },
  {
    id: 'net.q.env.mss',
    kind: 'mcq',
    concepts: ['net.mtu', 'net.encapsulation'],
    prompt: bi('MTU канала 1500 байт. Сколько данных TCP влезает в один сегмент без опций (MSS)?', 'The link MTU is 1500 bytes. How much TCP data fits into one segment without options (MSS)?'),
    options: [
      { id: '1460', text: '1460', correct: true },
      { id: '1500', text: '1500', why: bi('1500 — весь IP-пакет, вместе с 20 байтами IP и 20 байтами TCP.', '1500 is the whole IP packet, including 20 bytes of IP and 20 bytes of TCP.') },
      { id: '1486', text: '1486', why: bi('Заголовок Ethernet (14 байт) в MTU не входит: MTU считается от начала IP-пакета.', 'The Ethernet header (14 bytes) is not part of the MTU: MTU counts from the start of the IP packet.') },
    ],
    explain: bi('1500 − 20 (IP) − 20 (TCP) = 1460.', '1500 − 20 (IP) − 20 (TCP) = 1460.'),
  },
  {
    id: 'net.q.env.dstmac',
    kind: 'predict-output',
    concepts: ['net.encapsulation', 'net.mac'],
    prompt: bi('Ноутбук пингует сайт в другой сети, затем tcpdump -e показывает первый кадр. Какой MAC будет стоять получателем (после знака >)?', 'The laptop pings a site on another network, then tcpdump -e shows the first frame. Which MAC is the receiver (after the > sign)?'),
    command: 'ping -c 1 shop.example > /dev/null; tcpdump -n -e -c 1 icmp',
    setup: home,
    options: [
      { id: 'gw', text: bi('a0:63:91:00:00:01 — MAC домашнего роутера', 'a0:63:91:00:00:01 — the home router’s MAC'), correct: true },
      { id: 'srv', text: bi('MAC сервера сайта', 'the site server’s MAC'), why: bi('Сервер не в вашей локальной сети: его MAC вашему кадру не нужен и не известен.', 'The server is not on your local network: your frame neither needs nor knows its MAC.') },
      { id: 'bc', text: 'ff:ff:ff:ff:ff:ff', why: bi('Широковещательно уходят вопросы ARP, а не сами пакеты.', 'ARP questions go out as broadcasts, not the packets themselves.') },
    ],
    explain: bi('a0:63:91:00:00:01 — MAC домашнего роутера, шлюза по умолчанию.', 'a0:63:91:00:00:01 is the home router’s MAC, the default gateway.'),
  },

  // ── DNS ──
  {
    id: 'net.q.dns.order',
    kind: 'order',
    concepts: ['net.resolver', 'net.authoritative'],
    prompt: bi('Кэши пусты. Расставьте вопросы, которые породит curl https://shop.example/.', 'The caches are empty. Order the questions that curl https://shop.example/ causes.'),
    steps: [
      { id: 'hosts', text: bi('stub-резолвер смотрит /etc/hosts', 'the stub resolver looks at /etc/hosts') },
      { id: 'res', text: bi('вопрос рекурсивному резолверу из /etc/resolv.conf', 'a question to the recursive resolver from /etc/resolv.conf') },
      { id: 'root', text: bi('резолвер спрашивает корень', 'the resolver asks the root') },
      { id: 'tld', text: bi('резолвер спрашивает сервер зоны example.', 'the resolver asks the example. zone server') },
      { id: 'auth', text: bi('резолвер спрашивает авторитативный сервер shop.example', 'the resolver asks the authoritative server of shop.example') },
    ],
    refs: { explainer: 'net.dns' },
  },
  {
    id: 'net.q.dns.nx',
    kind: 'mcq',
    concepts: ['net.resolver', 'net.authoritative'],
    prompt: bi('Пользователь набрал shop.exmaple (опечатка в зоне первого уровня). Кто ответит NXDOMAIN?', 'A user typed shop.exmaple (a typo in the top-level zone). Who answers NXDOMAIN?'),
    options: [
      { id: 'root', text: bi('Корневой сервер: зоны exmaple. не существует', 'A root server: the zone exmaple. does not exist'), correct: true },
      { id: 'auth', text: bi('Авторитативный сервер магазина', 'The shop’s authoritative server'), why: bi('До него вопрос не дойдёт: корень не знает, кому передать exmaple.', 'The question never reaches it: the root does not know whom to hand exmaple. to.') },
      { id: 'stub', text: bi('Сам ноутбук', 'The laptop itself'), why: bi('Stub-резолвер не знает, какие имена существуют: он спрашивает сервер.', 'The stub resolver does not know which names exist: it asks a server.') },
    ],
    refs: { explainer: 'net.dns' },
  },
  {
    id: 'net.q.dns.servfail',
    kind: 'mcq',
    concepts: ['net.resolver'],
    prompt: bi('dig shop.example показывает status: SERVFAIL. Что это значит?', 'dig shop.example shows status: SERVFAIL. What does it mean?'),
    options: [
      { id: 'cant', text: bi('Резолвер не смог получить ответ — например, авторитативный сервер не отвечает', 'The resolver could not get an answer — for example, the authoritative server does not respond'), correct: true },
      { id: 'nx', text: bi('Такого имени нет', 'There is no such name'), why: bi('Это NXDOMAIN. SERVFAIL — «не знаю», а не «нет».', 'That is NXDOMAIN. SERVFAIL means “I don’t know”, not “no”.') },
      { id: 'srv', text: bi('Упал веб-сервер сайта', 'The site’s web server crashed'), why: bi('DNS ничего не знает о веб-сервере: он отвечает только про записи.', 'DNS knows nothing about the web server: it answers only about records.') },
    ],
  },
  {
    id: 'net.q.dns.hosts',
    kind: 'mcq',
    concepts: ['net.resolver'],
    prompt: bi('В /etc/hosts записано «10.0.0.9 shop.example». Что покажет dig +short shop.example?', '/etc/hosts has “10.0.0.9 shop.example”. What will dig +short shop.example show?'),
    options: [
      { id: 'dns', text: bi('Адрес из DNS: dig не читает /etc/hosts', 'The address from DNS: dig does not read /etc/hosts'), correct: true },
      { id: 'file', text: '10.0.0.9', why: bi('Так ответит getent hosts или curl — они идут через /etc/nsswitch.conf. dig всегда спрашивает DNS-сервер напрямую.', 'That is what getent hosts or curl return — they go through /etc/nsswitch.conf. dig always asks a DNS server directly.') },
    ],
  },
  {
    id: 'net.q.dns.ttl',
    kind: 'mcq',
    concepts: ['net.ttl', 'net.resolver'],
    prompt: bi('У записи shop.example был TTL 86400. Сайт переехал на новый адрес. Почему у части пользователей он ещё сутки «не открывается»?', 'The record for shop.example had a TTL of 86400. The site moved to a new address. Why does it “not open” for some users for another day?'),
    options: [
      { id: 'cache', text: bi('Резолверы хранят старый ответ до конца TTL — сутки', 'Resolvers keep the old answer until the TTL ends — a day'), correct: true },
      { id: 'prop', text: bi('DNS «распространяется» по интернету сутки', 'DNS “propagates” through the internet for a day'), why: bi('Никакого распространения нет: каждый резолвер просто держит свой кэш до истечения TTL.', 'There is no propagation: each resolver simply keeps its cache until the TTL runs out.') },
      { id: 'browser', text: bi('Браузер кэширует страницу', 'The browser caches the page'), why: bi('Даже без кэша страницы браузер пойдёт на старый адрес, который дал резолвер.', 'Even without a cached page the browser goes to the old address the resolver gave it.') },
    ],
    explain: bi('Перед переездом TTL заранее снижают до минут — и ждут старый TTL.', 'Before a move the TTL is lowered to minutes in advance — and the old TTL is waited out.'),
  },

  // ── DHCP ──
  {
    id: 'net.q.dhcp.order',
    kind: 'order',
    concepts: ['net.dhcp'],
    prompt: bi('Расставьте сообщения DHCP по порядку.', 'Put the DHCP messages in order.'),
    steps: [
      { id: 'd', text: 'Discover' },
      { id: 'o', text: 'Offer' },
      { id: 'r', text: 'Request' },
      { id: 'a', text: 'Ack' },
    ],
    key: true,
    refs: { explainer: 'net.dhcp' },
  },
  {
    id: 'net.q.dhcp.ll',
    kind: 'mcq',
    concepts: ['net.link-local', 'net.dhcp'],
    prompt: bi('У ноутбука адрес 169.254.23.141/16. Что произошло?', 'A laptop has the address 169.254.23.141/16. What happened?'),
    options: [
      { id: 'nodhcp', text: bi('DHCP-сервер не ответил, и машина назначила себе link-local', 'The DHCP server did not answer and the machine assigned itself a link-local address'), correct: true },
      { id: 'isp', text: bi('Провайдер выдал публичный адрес', 'The provider gave out a public address'), why: bi('169.254.0.0/16 не маршрутизируется и выдаётся не сервером, а самой машиной.', '169.254.0.0/16 is not routed and is not given by a server but by the machine itself.') },
      { id: 'switch', text: bi('Сломался коммутатор', 'The switch broke'), why: bi('Коммутатор не выдаёт адресов: 169.254.x.x машина придумала сама, потому что никто не ответил.', 'A switch hands out no addresses: the machine made up 169.254.x.x itself because nobody answered.') },
    ],
  },
  {
    id: 'net.q.dhcp.opts',
    kind: 'match',
    concepts: ['net.dhcp', 'net.lease'],
    prompt: bi('Сопоставьте номер опции DHCP и что она сообщает.', 'Match the DHCP option number with what it tells.'),
    pairs: [
      { id: '1', left: bi('опция 1', 'option 1'), right: bi('маска подсети', 'subnet mask') },
      { id: '3', left: bi('опция 3', 'option 3'), right: bi('шлюз (router)', 'gateway (router)') },
      { id: '6', left: bi('опция 6', 'option 6'), right: bi('DNS-сервер', 'DNS server') },
      { id: '51', left: bi('опция 51', 'option 51'), right: bi('срок аренды', 'lease time') },
    ],
  },

  // ── NAT ──
  {
    id: 'net.q.nat.inbound',
    kind: 'mcq',
    concepts: ['net.nat', 'net.conntrack'],
    prompt: bi('Почему снаружи нельзя подключиться к ноутбуку за домашним роутером без настройки?', 'Why can nobody outside connect to a laptop behind a home router without configuration?'),
    options: [
      { id: 'ct', text: bi('У роутера нет записи, кому из домашних машин отдать новое входящее соединение', 'The router has no record of which home machine should get a new incoming connection'), correct: true },
      { id: 'fw', text: bi('Потому что в ноутбуке включён антивирус', 'Because the laptop runs an antivirus'), why: bi('Пакет не дойдёт даже до ноутбука: он остановится на роутере.', 'The packet will not even reach the laptop: it stops at the router.') },
      { id: 'priv', text: bi('Частный адрес нельзя использовать в TCP', 'A private address cannot be used with TCP'), why: bi('Можно — внутри сети. Снаружи он просто не адресуем.', 'It can — inside the network. From outside it simply cannot be addressed.') },
    ],
    refs: { explainer: 'net.nat' },
  },
  {
    id: 'net.q.nat.hooks',
    kind: 'order',
    concepts: ['net.netfilter'],
    prompt: bi('Пакет проходит через маршрутизатор насквозь. Расставьте цепочки netfilter, через которые он идёт.', 'A packet passes straight through a router. Order the netfilter chains it goes through.'),
    steps: [
      { id: 'pre', text: 'PREROUTING' },
      { id: 'fwd', text: 'FORWARD' },
      { id: 'post', text: 'POSTROUTING' },
    ],
    explain: bi('INPUT и OUTPUT — для пакетов к самому хосту и от него.', 'INPUT and OUTPUT are for packets to and from the host itself.'),
  },
  {
    id: 'net.q.nat.reject',
    kind: 'mcq',
    concepts: ['net.netfilter'],
    prompt: bi('Чем для клиента отличается правило -j REJECT от -j DROP?', 'How does a -j REJECT rule differ from -j DROP for the client?'),
    options: [
      { id: 'fast', text: bi('REJECT отвечает ошибкой — клиент сразу получает отказ; DROP молчит — клиент ждёт до таймаута', 'REJECT answers with an error — the client is refused at once; DROP is silent — the client waits for a timeout'), correct: true },
      { id: 'same', text: bi('Ничем, оба блокируют', 'No difference, both block'), why: bi('Оба блокируют, но симптомы разные — и по симптому вы на дежурстве узнаёте, что случилось.', 'Both block, but the symptoms differ — and on call the symptom tells you what happened.') },
      { id: 'log', text: bi('REJECT записывает в журнал, DROP — нет', 'REJECT logs, DROP does not'), why: bi('Журналирование — это отдельная цель LOG.', 'Logging is a separate target, LOG.') },
    ],
  },
  {
    id: 'net.q.nat.est',
    kind: 'mcq',
    concepts: ['net.conntrack', 'net.netfilter'],
    prompt: bi('Политика INPUT — DROP, есть правило «-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT». Почему ответы на ваши исходящие соединения проходят?', 'The INPUT policy is DROP and there is a rule “-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT”. Why do replies to your outgoing connections get through?'),
    options: [
      { id: 'ct', text: bi('conntrack знает, что это ответ на соединение, которое открыли вы', 'conntrack knows it is a reply to a connection you opened'), correct: true },
      { id: 'port', text: bi('Ответы приходят на разрешённый порт', 'Replies arrive on an allowed port'), why: bi('Ответ приходит на ваш эфемерный порт — правила для него нет. Пропускает состояние соединения.', 'The reply arrives on your ephemeral port — there is no rule for it. The connection state lets it in.') },
      { id: 'out', text: bi('Исходящие пакеты не фильтруются', 'Outgoing packets are not filtered'), why: bi('Речь о входящих ответах — они идут через INPUT.', 'This is about incoming replies — they go through INPUT.') },
    ],
  },

  // ── HTTP ──
  {
    id: 'net.q.http.codes',
    kind: 'match',
    concepts: ['net.status'],
    prompt: bi('Сопоставьте код ответа и его смысл.', 'Match the status code with its meaning.'),
    pairs: [
      { id: '200', left: '200', right: bi('всё в порядке', 'everything is fine') },
      { id: '301', left: '301', right: bi('ресурс переехал, адрес — в Location', 'the resource moved; the address is in Location') },
      { id: '404', left: '404', right: bi('такого пути на сервере нет', 'no such path on the server') },
      { id: '500', left: '500', right: bi('ошибка в самом приложении', 'an error in the application itself') },
    ],
  },
  {
    id: 'net.q.http.host',
    kind: 'mcq',
    concepts: ['net.host-header'],
    prompt: bi('На одном IP-адресе живут shop.example и blog.example. Как сервер понимает, какой сайт отдать?', 'shop.example and blog.example live on one IP address. How does the server know which site to serve?'),
    options: [
      { id: 'host', text: bi('По заголовку Host в запросе', 'By the Host header in the request'), correct: true },
      { id: 'port', text: bi('По порту', 'By the port'), why: bi('Оба сайта на 80 и 443 — порт одинаковый.', 'Both sites are on 80 and 443 — the port is the same.') },
      { id: 'dns', text: bi('DNS сообщает серверу имя', 'DNS tells the server the name'), why: bi('DNS отвечает клиенту, сервер о вопросе не знает. Имя он узнаёт из запроса.', 'DNS answers the client; the server knows nothing of the question. It learns the name from the request.') },
    ],
  },
  {
    id: 'net.q.http.redirect',
    kind: 'mcq',
    concepts: ['net.status'],
    prompt: bi('Пользователь вводит http://shop.example, а открывается https://shop.example. Почему?', 'A user types http://shop.example, and https://shop.example opens. Why?'),
    options: [
      { id: '301', text: bi('Сервер ответил 301 (или 308) с Location: https://…', 'The server answered 301 (or 308) with Location: https://…'), correct: true },
      { id: 'dns', text: bi('Так ответил DNS-сервер', 'The DNS server answered that way'), why: bi('DNS возвращает адреса, о схеме http/https он ничего не знает.', 'DNS returns addresses; it knows nothing about the http/https scheme.') },
      { id: 'nat', text: bi('NAT на роутере', 'NAT on the router'), why: bi('NAT меняет адреса и порты пакетов, а не URL.', 'NAT rewrites packet addresses and ports, not URLs.') },
    ],
    key: true,
  },
  {
    id: 'net.q.http.bug',
    kind: 'bugfind',
    concepts: ['net.http', 'net.host-header'],
    prompt: bi('Этот запрос, отправленный через nc, сервер отвергает с 400. Какая строка неверна?', 'The server rejects this request, sent through nc, with 400. Which line is wrong?'),
    code: 'GET HTTP/1.1 /catalog\nHost: shop.example\nAccept: */*\n',
    bug: [1],
    why: {
      1: bi('Порядок в строке запроса: метод, путь, версия — GET /catalog HTTP/1.1.', 'The order in the request line is method, path, version — GET /catalog HTTP/1.1.'),
      2: bi('Заголовок Host верен — без него HTTP/1.1-сервер ответил бы 400.', 'The Host header is right — without it an HTTP/1.1 server would answer 400.'),
      3: bi('Accept — обычный необязательный заголовок.', 'Accept is an ordinary optional header.'),
    },
  },

  // ── TLS ──
  {
    id: 'net.q.tls.sees',
    kind: 'multi',
    concepts: ['net.tls', 'net.sni'],
    prompt: bi('Вы открываете https://shop.example/catalog в кафе. Что видят провайдер и соседи по Wi-Fi?', 'You open https://shop.example/catalog in a café. What do the provider and the Wi-Fi neighbours see?'),
    options: [
      { id: 'ip', text: bi('IP-адрес сервера', 'the server’s IP address'), correct: true },
      { id: 'sni', text: bi('имя сайта в SNI', 'the site name in SNI'), correct: true },
      { id: 'port', text: bi('порт 443', 'port 443'), correct: true },
      { id: 'path', text: bi('путь /catalog', 'the path /catalog'), why: bi('Путь — часть HTTP-запроса, а он целиком внутри шифрования.', 'The path is part of the HTTP request, which is entirely inside the encryption.') },
      { id: 'cookie', text: bi('cookie', 'cookies'), why: bi('Заголовки HTTP зашифрованы вместе с запросом.', 'HTTP headers are encrypted along with the request.') },
    ],
    refs: { explainer: 'net.tls' },
  },
  {
    id: 'net.q.tls.rtt',
    kind: 'mcq',
    concepts: ['net.tls', 'net.handshake'],
    prompt: bi('Новое соединение по HTTPS с TLS 1.3. Сколько кругов RTT пройдёт до первого байта ответа?', 'A new HTTPS connection with TLS 1.3. How many round trips pass before the first byte of the answer?'),
    options: [
      { id: '3', text: bi('Три: TCP, TLS, запрос', 'Three: TCP, TLS, the request'), correct: true },
      { id: '1', text: bi('Один', 'One'), why: bi('Один — только при уже открытом соединении (keep-alive).', 'One only with an already open connection (keep-alive).') },
      { id: '4', text: bi('Четыре', 'Four'), why: bi('Четыре — у TLS 1.2: у него рукопожатие на круг длиннее.', 'Four is TLS 1.2: its handshake has one more round.') },
    ],
    refs: { explainer: 'net.tls' },
  },
  {
    id: 'net.q.tls.errors',
    kind: 'match',
    concepts: ['net.cert', 'net.ca'],
    prompt: bi('Сопоставьте ошибку curl и её причину.', 'Match the curl error with its cause.'),
    pairs: [
      { id: 'exp', left: 'certificate has expired', right: bi('вышел срок сертификата', 'the certificate’s validity ended') },
      { id: 'name', left: 'no alternative certificate subject name matches', right: bi('сертификат выписан на другое имя', 'the certificate is for another name') },
      { id: 'chain', left: 'unable to get local issuer certificate', right: bi('неполная цепочка до доверенного центра', 'an incomplete chain to a trusted authority') },
    ],
    refs: { explainer: 'net.tls' },
  },
  {
    id: 'net.q.tls.ssh',
    kind: 'mcq',
    concepts: ['net.cert'],
    prompt: bi('ssh пишет «Host key verification failed». Что это по смыслу?', 'ssh prints “Host key verification failed”. What does it mean?'),
    options: [
      { id: 'key', text: bi('Ключ сервера не совпал с записанным в known_hosts — как ошибка сертификата в TLS', 'The server key does not match the one in known_hosts — like a certificate error in TLS'), correct: true },
      { id: 'pw', text: bi('Неверный пароль', 'A wrong password'), why: bi('До пароля дело не дошло: проверка ключа сервера идёт раньше входа.', 'It never got to the password: the server key check comes before login.') },
      { id: 'net', text: bi('Сервер недоступен', 'The server is unreachable'), why: bi('Сервер ответил и предъявил ключ — просто не тот.', 'The server answered and presented a key — just not the expected one.') },
    ],
  },

  // ── proxies ──
  {
    id: 'net.q.proxy.who',
    kind: 'mcq',
    concepts: ['net.reverse-proxy', 'net.upstream'],
    prompt: bi('Пользователь получил 504 с заголовком Server: nginx. Что это доказывает?', 'A user got a 504 with the header Server: nginx. What does it prove?'),
    options: [
      { id: 'nginx', text: bi('Сеть до nginx работает; nginx не дождался ответа от upstream', 'The network up to nginx works; nginx did not get an answer from the upstream in time'), correct: true },
      { id: 'net', text: bi('У пользователя проблемы с интернетом', 'The user’s internet is broken'), why: bi('Код ответа пришёл — значит, DNS, TCP и TLS до nginx в порядке.', 'A status code arrived — so DNS, TCP and TLS up to nginx are fine.') },
      { id: 'app', text: bi('Приложение вернуло 504', 'The application returned 504'), why: bi('Приложение почти никогда не пишет 504: это код прокси, не дождавшегося ответа.', 'An application almost never writes 504: it is the code of a proxy that did not get an answer.') },
    ],
    refs: { explainer: 'net.proxy504' },
  },
  {
    id: 'net.q.proxy.lines',
    kind: 'mcq',
    concepts: ['net.upstream'],
    prompt: bi('Один запрос /report — и две строки «upstream timed out … while reading response header» с разными upstream. Почему две?', 'One request to /report — and two lines “upstream timed out … while reading response header” with different upstreams. Why two?'),
    options: [
      { id: 'retry', text: bi('nginx повторил запрос на втором сервере группы (proxy_next_upstream error timeout)', 'nginx retried the request on the second server of the group (proxy_next_upstream error timeout)'), correct: true },
      { id: 'twice', text: bi('Пользователь дважды нажал F5', 'The user pressed F5 twice'), why: bi('Тогда в access.log было бы два запроса. Здесь один запрос и две попытки.', 'Then access.log would show two requests. Here it is one request and two attempts.') },
      { id: 'bug', text: bi('Ошибка записи журнала', 'A logging bug'), why: bi('nginx пишет строку на каждую неудачную попытку — так и задумано.', 'nginx writes a line for every failed attempt — by design.') },
    ],
    refs: { explainer: 'net.proxy504' },
  },
  {
    id: 'net.q.proxy.connecting',
    kind: 'mcq',
    concepts: ['net.upstream'],
    prompt: bi('Чем «while connecting to upstream» отличается от «while reading response header from upstream»?', 'How does “while connecting to upstream” differ from “while reading response header from upstream”?'),
    options: [
      { id: 'stage', text: bi('В первом случае не удалось подключиться (сеть, фильтр, процесс), во втором подключились, но приложение не ответило вовремя', 'In the first the connection failed (network, filter, process); in the second it connected but the application did not answer in time'), correct: true },
      { id: 'same', text: bi('Это одно и то же', 'They are the same'), why: bi('Это разные этапы — и разные места, где искать причину.', 'They are different stages — and different places to look for the cause.') },
    ],
  },
  {
    id: 'net.q.proxy.500',
    kind: 'mcq',
    concepts: ['net.upstream', 'net.status'],
    prompt: bi('app2 жив, но сам отвечает 500. Повторит ли nginx запрос на app1 при настройках по умолчанию?', 'app2 is alive but answers 500 itself. Will nginx retry the request on app1 with default settings?'),
    options: [
      { id: 'no', text: bi('Нет: 500 — это ответ, а не ошибка upstream; по умолчанию proxy_next_upstream только error timeout', 'No: 500 is an answer, not an upstream error; by default proxy_next_upstream is only error timeout'), correct: true },
      { id: 'yes', text: bi('Да, nginx всегда ищет рабочий сервер', 'Yes, nginx always looks for a working server'), why: bi('Только при ошибке соединения или таймауте. Для 500 нужно явно добавить http_500.', 'Only on a connection error or a timeout. For 500 you must add http_500 explicitly.') },
    ],
    refs: { explainer: 'net.proxy504' },
  },

  // ── troubleshooting ──
  {
    id: 'net.q.ts.layer',
    kind: 'match',
    concepts: ['net.layers-method'],
    prompt: bi('Какой уровень сломался? Сопоставьте сообщение и слой.', 'Which layer broke? Match the message with the layer.'),
    pairs: [
      { id: 'dns', left: 'curl: (6) Could not resolve host', right: 'DNS (L7)' },
      { id: 'l3', left: 'ping: connect: Network is unreachable', right: 'L3' },
      { id: 'l4', left: "curl: (7) … Couldn't connect to server", right: 'L4' },
      { id: 'tls', left: 'curl: (60) SSL certificate problem', right: 'TLS' },
      { id: 'l7', left: 'HTTP/1.1 504 Gateway Time-out', right: bi('L7 (прокси)', 'L7 (proxy)') },
    ],
    refs: { explainer: 'net.url' },
  },
  {
    id: 'net.q.ts.first',
    kind: 'mcq',
    concepts: ['net.layers-method'],
    prompt: bi('Тикет: «сайт не открывается». С чего начать?', 'The ticket: “the site does not open”. Where do you start?'),
    options: [
      { id: 'layer', text: bi('Воспроизвести и по симптому назвать слой — затем проверить его одной командой', 'Reproduce it, name the layer from the symptom, then check that layer with one command'), correct: true },
      { id: 'restart', text: bi('Перезапустить nginx', 'Restart nginx'), why: bi('Перезапуск без гипотезы стирает улики и может навредить, если причина не в nginx.', 'A restart without a hypothesis destroys evidence and may do harm if nginx is not the cause.') },
      { id: 'flush', text: bi('Очистить правила iptables', 'Flush the iptables rules'), why: bi('Это опасное действие: можно открыть всё или отрезать себя. Сначала докажите, что проблема на этом уровне.', 'That is dangerous: you may open everything or cut yourself off. First prove the problem is at that layer.') },
    ],
  },
  {
    id: 'net.q.ts.revisit',
    kind: 'order',
    concepts: ['net.layers-method', 'net.keepalive'],
    prompt: bi('Повторный заход на https://shop.example через минуту, соединение уже закрыто, ответ DNS в кэше ОС. Что останется из этапов?', 'A second visit to https://shop.example a minute later; the connection is closed, the DNS answer is in the OS cache. Which stages remain?'),
    steps: [
      { id: 'tcp', text: bi('рукопожатие TCP', 'the TCP handshake') },
      { id: 'tls', text: bi('рукопожатие TLS', 'the TLS handshake') },
      { id: 'req', text: bi('HTTP-запрос', 'the HTTP request') },
      { id: 'resp', text: bi('ответ и отрисовка', 'the answer and rendering') },
    ],
    explain: bi('Обхода DNS нет — адрес в кэше. А TCP и TLS заново: соединение закрыто.', 'There is no DNS walk — the address is cached. But TCP and TLS happen again: the connection is closed.'),
    refs: { explainer: 'net.url' },
  },

  // ── catalogue ──
  {
    id: 'net.q.proto.transport',
    kind: 'match',
    concepts: ['net.udp', 'net.tcp'],
    prompt: bi('Сопоставьте протокол и то, поверх чего он работает.', 'Match the protocol with what it runs on top of.'),
    pairs: [
      { id: 'dhcp', left: 'DHCP', right: bi('UDP 67/68, широковещательно', 'UDP 67/68, broadcast') },
      { id: 'quic', left: 'HTTP/3', right: 'QUIC / UDP 443' },
      { id: 'bgp', left: 'BGP', right: 'TCP 179' },
      { id: 'vxlan', left: 'VXLAN', right: bi('кадр Ethernet в UDP 4789', 'an Ethernet frame in UDP 4789') },
      { id: 'arp', left: 'ARP', right: bi('прямо в кадре Ethernet', 'directly in an Ethernet frame') },
    ],
  },
  {
    id: 'net.q.proto.ntp',
    kind: 'mcq',
    concepts: ['net.tls', 'net.cert'],
    prompt: bi('На сервере часы ушли на два месяца назад. Какой протокол «сломается» первым и почему?', 'A server’s clock went two months back. Which protocol “breaks” first, and why?'),
    options: [
      { id: 'tls', text: bi('TLS: сертификаты станут «ещё не действительными»', 'TLS: certificates become “not yet valid”'), correct: true },
      { id: 'arp', text: 'ARP', why: bi('ARP не использует время.', 'ARP does not use time.') },
      { id: 'tcp', text: 'TCP', why: bi('Отметки времени TCP относительные: настенные часы ему не важны.', 'TCP timestamps are relative: wall-clock time does not matter to it.') },
    ],
    explain: bi('Поэтому NTP (chrony) — обязательная служба на любом сервере.', 'That is why NTP (chrony) is a mandatory service on any server.'),
  },
];

export { tcpLab };
