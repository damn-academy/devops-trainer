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
    prompt: bi('Расставьте участки пути от ноутбука до сайта в другой стране в том порядке, в каком их проходит запрос.', 'Put the parts of the path from a laptop to a site in another country in order.'),
    steps: [
      { id: 'wifi', text: bi('Wi-Fi до домашнего роутера', 'Wi-Fi to the home router') },
      { id: 'isp', text: bi('сеть провайдера (AS 64500)', 'the provider’s network (AS 64500)') },
      { id: 'ixp', text: bi('точка обмена трафиком', 'an internet exchange point'), why: bi('Точка обмена соединяет сети разных провайдеров, поэтому она стоит между сетью вашего провайдера и чужой сетью, а не у вас дома.', 'The exchange point joins providers’ networks — it sits between the provider and another network, not at home.') },
      { id: 'cable', text: bi('подводный кабель', 'a submarine cable') },
      { id: 'dc', text: bi('дата-центр с сервером сайта', 'the data centre with the site’s server') },
    ],
    explain: bi('У каждого участка свой хозяин. Wi-Fi принадлежит вам, следующий участок принадлежит провайдеру, дальше идут точка обмена трафиком, оператор кабеля и хостинг.', 'Each part has its own owner: you, the provider, the exchange point, the cable operator, the hosting company.'),
    refs: { explainer: 'net.map' },
  },
  {
    id: 'net.q.internet.latency',
    kind: 'mcq',
    concepts: ['net.latency', 'net.rtt'],
    prompt: bi('Почему ping из Москвы до сервера в Нью-Йорке, до которого около 7 500 км, не может показать 5 мс?', 'Why can a ping from Moscow to a server in New York (about 7,500 km) never show 5 ms?'),
    options: [
      { id: 'light', text: bi('Потому что свет в оптоволокне тратит около 5 мкс на километр, и только в одну сторону это около 37 мс, а туда и обратно около 75 мс', 'Light in fibre travels about 5 µs per kilometre: ≈ 37 ms one way, ≈ 75 ms round trip'), correct: true },
      { id: 'slow', text: bi('Потому что у провайдера медленный тариф', 'Because the provider’s plan is slow'), why: bi('Скорость тарифа говорит, сколько данных проходит за секунду, а не сколько времени идёт один пакет, поэтому на задержку она почти не влияет.', 'A plan’s speed is how much data per second, not how long one packet travels. It barely changes delay.') },
      { id: 'servers', text: bi('Потому что серверы в Нью-Йорке работают медленно', 'Because the servers in New York are slow'), why: bi('Даже сервер, который отвечает мгновенно, не ответит быстрее, чем свет пройдёт путь туда и обратно.', 'Even an instant server cannot answer faster than light covers the path there and back.') },
    ],
    explain: bi('Задержку распространения нельзя уменьшить, можно только сократить путь. Поэтому копии сайтов ставят ближе к пользователям.', 'Propagation delay cannot be sped up — only the path can be shortened. That is why copies of sites are placed nearer to users.'),
    refs: { explainer: 'net.map' },
  },
  {
    id: 'net.q.internet.match',
    kind: 'match',
    concepts: ['net.as', 'net.bgp', 'net.ixp'],
    prompt: bi('Сопоставьте каждое понятие с его описанием.', 'Match the term with what it is.'),
    pairs: [
      { id: 'as', left: bi('автономная система', 'autonomous system'), right: bi('сеть под одним управлением со своим номером', 'a network under one administration with its own number') },
      { id: 'bgp', left: 'BGP', right: bi('способ, которым сети сообщают соседям, какие адреса находятся у них', 'how networks tell neighbours which addresses they have') },
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
      { id: 'up', text: bi('Задержка вырастет, потому что трафик пойдёт через транзитного оператора, иногда через другую страну', 'It grows: traffic goes through a transit carrier, sometimes through another country'), correct: true },
      { id: 'down', text: bi('Задержка уменьшится, потому что на пути станет на одно устройство меньше', 'It falls: there is one device fewer'), why: bi('Одно устройство действительно выпало, но путь стал длиннее: вместо соседнего коммутатора трафик идёт через далёкую чужую сеть.', 'A device dropped out, but the path got longer: instead of a nearby switch, a distant foreign network.') },
      { id: 'same', text: bi('Задержка не изменится, потому что адреса остались прежними', 'Nothing: the addresses are the same'), why: bi('Адреса остались теми же, но пакеты пошли другой дорогой, а задержка зависит от длины дороги, а не от адресов.', 'The addresses are the same, but the road differs — the road decides the delay.') },
    ],
    refs: { explainer: 'net.map' },
  },

  // ── frames ──
  {
    id: 'net.q.frames.flood',
    kind: 'mcq',
    concepts: ['net.switch', 'net.mac'],
    prompt: bi('Коммутатор только что включили, и его таблица пуста. Компьютер A отправляет кадр компьютеру B. Куда уйдёт этот кадр?', 'The switch has just been switched on; its table is empty. A sends a frame to B. Where does the frame go?'),
    options: [
      { id: 'all', text: bi('Во все порты, кроме того, через который кадр пришёл', 'Out of every port except the one it came in on'), correct: true },
      { id: 'b', text: bi('Только к компьютеру B', 'Only to B'), why: bi('Коммутатор пока не знает, где находится B, и узнает это только тогда, когда B что-нибудь отправит.', 'How would the switch know where B is? It learns that only once B sends something.') },
      { id: 'drop', text: bi('Никуда, потому что кадр на неизвестный адрес выбрасывается', 'Nowhere: an unknown address is dropped'), why: bi('Коммутатор не выбрасывает кадры к неизвестным MAC-адресам, а рассылает их во все порты.', 'A switch does not drop frames to unknown MACs — it floods them to everyone.') },
    ],
    refs: { explainer: 'net.switch' },
  },
  {
    id: 'net.q.frames.scope',
    kind: 'mcq',
    concepts: ['net.mac', 'net.frame'],
    prompt: bi('Ноутбук открывает сайт в другом городе. Чей MAC-адрес указан получателем в кадре, который ушёл с ноутбука?', 'A laptop opens a site in another city. Whose MAC address is the receiver in the frame leaving the laptop?'),
    options: [
      { id: 'router', text: bi('MAC-адрес домашнего роутера', 'The home router’s'), correct: true },
      { id: 'server', text: bi('MAC-адрес сервера сайта', 'The site server’s'), why: bi('MAC-адрес действует только в своей локальной сети. Сервер в другом городе ноутбуку не сосед, и кадр до него не дойдёт.', 'A MAC means something only in its own local network. A server in another city is not a neighbour; a frame never reaches it.') },
      { id: 'bcast', text: bi('ff:ff:ff:ff:ff:ff', 'ff:ff:ff:ff:ff:ff'), why: bi('Этот адрес означает «всем в локальной сети» и не выводит пакет за её пределы.', 'That is the “everyone in the room” address; it does not take the packet outside.') },
    ],
    explain: bi('Кадр проходит только один участок, до следующего устройства. Там пакет перекладывают в новый кадр с другими MAC-адресами.', 'A frame lives for one segment: to the next device. Further on the packet is put into a new frame with other MACs.'),
  },
  {
    id: 'net.q.frames.label',
    kind: 'label',
    concepts: ['net.frame', 'net.mac'],
    prompt: bi('Подпишите поля кадра Ethernet в том порядке, в каком они идут по проводу.', 'Label the fields of an Ethernet frame in the order they travel on the wire.'),
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
      { id: 'dst', text: bi('MAC-адрес получателя', 'Destination MAC') },
      { id: 'src', text: bi('MAC-адрес отправителя', 'Source MAC') },
      { id: 'type', text: 'EtherType' },
      { id: 'data', text: bi('данные', 'data') },
      { id: 'fcs', text: bi('контрольная сумма', 'checksum (FCS)') },
      { id: 'ip', text: bi('IP-адрес получателя', 'destination IP address'), why: bi('IP-адрес лежит внутри данных кадра, а в заголовке самого кадра его нет.', 'The IP address is inside the frame’s data — the frame header has none.') },
    ],
    explain: bi('Адрес получателя стоит первым, потому что коммутатор принимает решение, ещё не дочитав кадр до конца.', 'The receiver’s address comes first: a switch decides before it has read the whole frame.'),
  },

  // ── subnets ──
  {
    id: 'net.q.sub.hosts',
    kind: 'mcq',
    concepts: ['net.cidr', 'net.subnet'],
    prompt: bi('Сколько адресов можно выдать машинам в подсети 192.168.10.0/26?', 'How many host addresses are in subnet 192.168.10.0/26?'),
    options: [
      { id: '62', text: '62', correct: true },
      { id: '64', text: '64', why: bi('Число 64 означает все адреса подсети. Но первый из них служит адресом сети, а последний широковещательным адресом, и машинам их не выдают.', '64 is every address of the subnet. The first is the network address and the last the broadcast; hosts do not get them.') },
      { id: '26', text: '26', why: bi('Число 26 означает длину сетевой части в битах, а не количество адресов. На номера машин остаётся 32 − 26 = 6 бит.', '26 is the length of the network part in bits, not a number of addresses. Hosts get 32 − 26 = 6 bits.') },
      { id: '254', text: '254', why: bi('254 адреса бывает в подсети /24. Чем длиннее префикс, тем меньше адресов для машин.', '254 belongs to /24. The longer the prefix, the fewer the hosts.') },
    ],
    explain: bi('В подсети 2^(32 − 26) = 64 адреса, и если вычесть адрес сети и широковещательный адрес, остаётся 62.', '2^(32 − 26) = 64 addresses, minus the network and broadcast addresses = 62.'),
    key: true,
  },
  {
    id: 'net.q.sub.private',
    kind: 'multi',
    concepts: ['net.private'],
    prompt: bi('Какие из этих адресов частные, то есть относятся к диапазонам RFC 1918?', 'Which addresses are private (RFC 1918)?'),
    options: [
      { id: 'a', text: '10.12.0.5', correct: true },
      { id: 'b', text: '172.32.1.1', why: bi('Диапазон 172.16.0.0/12 включает адреса от 172.16.0.0 до 172.31.255.255, поэтому адрес 172.32.x.x уже лежит за его границей.', '172.16.0.0/12 is 172.16.0.0…172.31.255.255. 172.32.x.x is past the border.') },
      { id: 'c', text: '192.168.100.200', correct: true },
      { id: 'd', text: '100.64.3.3', why: bi('Диапазон 100.64.0.0/10 отведён под общие адреса провайдеров (CGNAT, RFC 6598) и к RFC 1918 не относится.', '100.64.0.0/10 is the providers’ shared range (CGNAT, RFC 6598), not RFC 1918.') },
      { id: 'e', text: '172.20.0.1', correct: true },
    ],
    explain: bi('Частными считаются диапазоны 10.0.0.0/8, 172.16.0.0/12 и 192.168.0.0/16.', 'The private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.'),
  },
  {
    id: 'net.q.sub.same',
    kind: 'mcq',
    concepts: ['net.subnet'],
    prompt: bi('У машины адрес 10.0.1.10/24. Какие из этих адресов находятся в её подсети и доступны напрямую?', 'A host has 10.0.1.10/24. Which of these addresses is in its subnet and reachable directly?'),
    options: [
      { id: 'a', text: '10.0.1.200', correct: true },
      { id: 'b', text: '10.0.2.10', why: bi('Здесь отличается третье число. При префиксе /24 сеть задают первые три числа, поэтому 10.0.2.x относится к соседней подсети.', 'The third number differs: with /24 the network is the first three numbers; 10.0.2.x is the next subnet.') },
      { id: 'c', text: '10.1.1.10', why: bi('Здесь отличается второе число, а значит, это совсем другая сеть.', 'The second number differs — a different network altogether.') },
    ],
  },
  {
    id: 'net.q.sub.mask',
    kind: 'mcq',
    concepts: ['net.cidr'],
    prompt: bi('Какая маска соответствует префиксу /20?', 'What mask does prefix /20 have?'),
    options: [
      { id: 'a', text: '255.255.240.0', correct: true },
      { id: 'b', text: '255.255.255.240', why: bi('Это маска /28, в которой 28 единиц. У маски /20 единиц двадцать: 8 + 8 + 4.', 'That is /28: 28 ones. /20 has 20 ones — 8 + 8 + 4.') },
      { id: 'c', text: '255.255.20.0', why: bi('Маска означает не число 20 в третьем октете, а 20 единиц слева. В третьем октете получается 11110000, то есть 240.', 'The mask is not the number 20 in the third octet but 20 ones from the left: 11110000 in the third octet = 240.') },
    ],
  },

  // ── ARP ──
  {
    id: 'net.q.arp.who',
    kind: 'mcq',
    concepts: ['net.arp'],
    prompt: bi('Машина спрашивает по ARP, у кого адрес 192.168.1.20. Кто ответит?', 'A host asks over ARP: “who has 192.168.1.20?”. Who answers?'),
    options: [
      { id: 'owner', text: bi('Только машина с этим адресом, и ответит она своим MAC-адресом', 'Only the machine with that address, with its MAC'), correct: true },
      { id: 'switch', text: bi('Коммутатор, потому что у него есть таблица MAC-адресов', 'The switch, since it has a MAC table'), why: bi('В таблице коммутатора записано, за каким портом какой MAC-адрес, а IP-адресов коммутатор не знает и в ARP не участвует.', 'The switch table is “MAC → port”; it knows no IP addresses and takes no part in ARP.') },
      { id: 'all', text: bi('Все машины локальной сети', 'Everyone on the local network'), why: bi('Вопрос слышат все, а отвечает одна машина, та, чей адрес спросили.', 'Everyone hears the question; only the one whose address was asked answers.') },
    ],
    refs: { explainer: 'net.arp' },
  },
  {
    id: 'net.q.arp.unreach',
    kind: 'mcq',
    concepts: ['net.arp', 'net.arp-cache'],
    prompt: bi('Команда ping печатает `From 192.168.1.10 icmp_seq=1 Destination Host Unreachable`, а адрес 192.168.1.10 принадлежит вам самим. Что это значит?', 'ping prints `From 192.168.1.10 icmp_seq=1 Destination Host Unreachable`, and 192.168.1.10 is you. What does it mean?'),
    options: [
      { id: 'arp', text: bi('Сосед не ответил на вопрос ARP, и пакет даже не ушёл в сеть', 'The neighbour did not answer ARP: the packet never left'), correct: true },
      { id: 'fw', text: bi('Сосед получил пакет и отказал', 'The neighbour received the packet and refused it'), why: bi('Тогда ошибка пришла бы от соседа, с его адресом, а здесь её пишет ваше собственное ядро.', 'Then the error would come from the neighbour, with its address. Here your own kernel writes it.') },
      { id: 'dns', text: bi('Неправильно настроен DNS', 'Wrong DNS'), why: bi('Адрес уже задан числом, и имена здесь не участвуют.', 'The address is already a number — no name is involved.') },
    ],
    explain: bi('Команда ip neigh покажет у этого соседа состояние FAILED.', 'ip neigh shows the neighbour as FAILED.'),
  },
  {
    id: 'net.q.arp.order',
    kind: 'order',
    concepts: ['net.arp', 'net.arp-cache'],
    prompt: bi('В каком порядке происходят события перед первым пакетом к соседу, если ARP-кэш пуст?', 'What happens before the first packet to a neighbour when the ARP cache is empty?'),
    steps: [
      { id: 'miss', text: bi('ядро не находит MAC-адрес в ARP-кэше', 'the kernel finds no MAC in the ARP cache') },
      { id: 'ask', text: bi('ядро рассылает широковещательный вопрос who-has', 'a broadcast who-has question') },
      { id: 'reply', text: bi('сосед отвечает is-at со своим MAC-адресом', 'the neighbour answers is-at with its MAC') },
      { id: 'store', text: bi('ответ записывается в ARP-кэш', 'the answer is stored in the ARP cache') },
      { id: 'send', text: bi('уходит кадр с пакетом', 'the frame with the packet leaves') },
    ],
  },

  // ── routing ──
  {
    id: 'net.q.route.lpm',
    kind: 'mcq',
    concepts: ['net.lpm', 'net.route-table'],
    prompt: bi('На машине два маршрута: 10.0.0.0/8 via 10.1.1.1 и 10.20.0.0/16 via 10.1.1.2. Куда уйдёт пакет на адрес 10.20.5.5?', 'A host has two routes: 10.0.0.0/8 via 10.1.1.1 and 10.20.0.0/16 via 10.1.1.2. Where does a packet to 10.20.5.5 go?'),
    options: [
      { id: 'b', text: bi('Через 10.1.1.2, потому что префикс /16 длиннее, чем /8', 'via 10.1.1.2: /16 is longer than /8'), correct: true },
      { id: 'a', text: bi('Через 10.1.1.1, потому что эта строка стоит выше', 'via 10.1.1.1: that line comes first'), why: bi('Порядок строк не важен, а выигрывает самый длинный подходящий префикс.', 'The order of lines does not matter: the longest matching prefix wins.') },
      { id: 'both', text: bi('По очереди через оба маршрута', 'alternately through both'), why: bi('Это не балансировка, потому что для одного адреса выбирается одна строка, самая точная.', 'This is not load balancing: for one address one line, the most specific, is chosen.') },
    ],
    key: true,
    refs: { explainer: 'net.route' },
  },
  {
    id: 'net.q.route.changes',
    kind: 'multi',
    concepts: ['net.router', 'net.ttl'],
    prompt: bi('Что обычный маршрутизатор без NAT меняет в пакете, который пересылает?', 'What does an ordinary router (without NAT) change in a forwarded packet?'),
    options: [
      { id: 'mac', text: bi('MAC-адреса кадра', 'the frame’s MAC addresses'), correct: true },
      { id: 'ttl', text: 'TTL', correct: true },
      { id: 'sum', text: bi('контрольную сумму IP-заголовка', 'the IP header checksum'), correct: true },
      { id: 'dst', text: bi('IP-адрес получателя', 'the destination IP address'), why: bi('Адрес получателя остаётся одним и тем же от начала до конца пути, и по нему выбирают маршрут.', 'The destination address is the same along the whole path — routes are chosen by it.') },
      { id: 'port', text: bi('порт TCP', 'the TCP port'), why: bi('Маршрутизатор не открывает конверт TCP.', 'A router does not open the TCP envelope.') },
    ],
    explain: bi('Маршрутизатор меняет три вещи. Пакет он перекладывает в новый кадр, где отправителем стоит его собственный MAC-адрес, а получателем MAC-адрес следующего устройства. В IP-заголовке он уменьшает TTL на единицу, а раз поле TTL изменилось, ему приходится заново посчитать и контрольную сумму заголовка, по которой следующий маршрутизатор проверяет, не испортился ли заголовок в пути.', 'A router changes three things. It puts the packet into a new frame with its own MAC as the sender and the next device’s MAC as the receiver. In the IP header it lowers the TTL by one, and since the TTL field changed, it must recompute the header checksum, by which the next router checks that the header was not damaged on the way.'),
    refs: { explainer: 'net.route' },
  },
  {
    id: 'net.q.route.trace',
    kind: 'mcq',
    concepts: ['net.icmp', 'net.ttl'],
    prompt: bi('Команда `traceroute -n 10.20.0.5` печатает четыре строки: `1 192.168.1.1`, `2 10.0.0.1`, `3 * * *` и `4 * * *`. Где сломался путь?', '`traceroute -n 10.20.0.5` prints four lines: `1 192.168.1.1`, `2 10.0.0.1`, `3 * * *` and `4 * * *`. Where is it broken?'),
    options: [
      { id: 'after', text: bi('За узлом 10.0.0.1: дальше пакеты не доходят или ответы от следующих узлов не возвращаются', 'Beyond 10.0.0.1: packets do not get further or answers do not come back'), correct: true },
      { id: 'at', text: bi('Сломан сам узел 10.0.0.1', '10.0.0.1 itself is broken'), why: bi('Узел 10.0.0.1 ответил, значит, он работает и принял пакет. Проверять нужно следующий узел и маршрут в обратную сторону.', '10.0.0.1 answered — so it is alive and took the packet. Look at the next node and the route back.') },
      { id: 'dns', text: bi('Сломан DNS', 'A DNS problem'), why: bi('С флагом -n команда traceroute вообще не обращается к DNS.', 'With -n traceroute does not use DNS at all.') },
    ],
    key: true,
  },
  {
    id: 'net.q.route.oneway',
    kind: 'mcq',
    concepts: ['net.route-table', 'net.gateway'],
    prompt: bi('Ping с машины A до машины B не проходит, а захват на B показывает пришедшие эхо-запросы. Какая причина самая вероятная?', 'A ping from A to B fails, but a capture on B shows the echo requests arriving. The most likely cause?'),
    options: [
      { id: 'back', text: bi('У машины B нет маршрута обратно в сеть машины A', 'B has no route back to A’s network'), correct: true },
      { id: 'a', text: bi('У машины A нет маршрута к машине B', 'A has no route to B'), why: bi('В этом случае запросы не дошли бы до машины B.', 'Then the requests would not reach B.') },
      { id: 'mac', text: bi('У машины B неправильный MAC-адрес', 'B has the wrong MAC'), why: bi('Запросы пришли, значит, кадры до машины B доходят.', 'The requests arrived — frames do reach B.') },
    ],
  },

  // ── transport ──
  {
    id: 'net.q.tcp.order',
    kind: 'order',
    concepts: ['net.handshake', 'net.tcp'],
    prompt: bi('Расставьте сообщения одного короткого соединения TCP в том порядке, в каком они идут.', 'Put the messages of one short TCP connection in order.'),
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
    prompt: bi('Команда curl к закрытому порту одного сервера получает ответ мгновенно, а к закрытому порту другого сервера висит до конца срока ожидания. Чем отличаются эти два случая?', 'curl to a closed port answers instantly on one server and hangs until a timeout on another. What is the difference?'),
    options: [
      { id: 'rst', text: bi('Первый сервер ответил RST, потому что порт никто не слушает, а у второго пакеты молча выбрасывает фильтр или они вообще не доходят', 'The first answered RST (nobody listens); on the second a filter silently drops the packets or they never arrive'), correct: true },
      { id: 'load', text: bi('Второй сервер перегружен', 'The second server is overloaded'), why: bi('Даже перегруженный сервер ответил бы на SYN силами ядра. Полная тишина означает, что пакеты выбрасывает правило DROP или сервер недоступен.', 'An overloaded server would still answer the SYN from its kernel. Total silence means a DROP or unreachability.') },
      { id: 'dns', text: bi('У второго сервера медленный DNS', 'The second has slow DNS'), why: bi('Зависание наступает, когда адрес уже известен, то есть на этапе подключения.', 'The hang comes after the address is known: at the connection stage.') },
    ],
    key: true,
    refs: { explainer: 'net.tcp' },
  },
  {
    id: 'net.q.tcp.ports',
    kind: 'match',
    concepts: ['net.port', 'net.udp', 'net.tcp'],
    prompt: bi('Сопоставьте каждую службу с её транспортом и портом по умолчанию.', 'Match the service with its default transport and port.'),
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
    prompt: bi('В выводе ss на клиенте видно соединение 10.0.0.1:51234 → 10.0.0.2:8080. Откуда взялся порт 51234?', 'In ss on the client: 10.0.0.1:51234 → 10.0.0.2:8080. Where did 51234 come from?'),
    options: [
      { id: 'kernel', text: bi('Ядро клиента выбрало свободный эфемерный порт', 'The client’s kernel picked a free ephemeral port'), correct: true },
      { id: 'server', text: bi('Этот порт назначил сервер', 'The server assigned it'), why: bi('Сервер знает только свой порт 8080, а порт клиента узнаёт из первого же пакета SYN.', 'The server knows only its own port 8080; the client’s port arrives in the very first SYN.') },
      { id: 'cfg', text: bi('Этот порт прописан в настройках curl', 'It is set in curl’s settings'), why: bi('curl не выбирает порт отправителя, это делает ядро при вызове connect().', 'curl does not choose the source port: the kernel does at connect().') },
    ],
  },

  // ── envelopes ──
  {
    id: 'net.q.env.order',
    kind: 'order',
    concepts: ['net.encapsulation'],
    prompt: bi('Соберите эхо-запрос ping из конвертов, начиная с внешнего и заканчивая внутренним.', 'Assemble a ping echo request from envelopes: from the outermost to the innermost.'),
    steps: [
      { id: 'eth', text: bi('кадр Ethernet', 'Ethernet frame') },
      { id: 'ip', text: bi('пакет IP', 'IP packet') },
      { id: 'icmp', text: bi('сообщение ICMP echo', 'ICMP echo message') },
      { id: 'data', text: bi('56 байт данных', '56 bytes of data') },
    ],
    explain: bi('У ping нет ни TCP, ни UDP: сообщение ICMP лежит прямо в пакете IP.', 'ping has no TCP or UDP: ICMP sits directly inside IP.'),
    refs: { explainer: 'net.envelopes' },
  },
  {
    id: 'net.q.env.layer',
    kind: 'match',
    concepts: ['net.osi'],
    prompt: bi('На каком уровне находится проблема? Сопоставьте каждый симптом с уровнем.', 'Which layer is it? Match the symptom with the layer.'),
    pairs: [
      { id: 'l2', left: bi('на вопрос ARP никто не отвечает, ip neigh показывает FAILED', 'ARP without an answer, ip neigh: FAILED'), right: 'L2' },
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
    prompt: bi('MTU канала равен 1500 байт. Сколько данных TCP помещается в один сегмент без опций, то есть чему равен MSS?', 'The link MTU is 1500 bytes. How much TCP data fits into one segment without options (MSS)?'),
    options: [
      { id: '1460', text: '1460', correct: true },
      { id: '1500', text: '1500', why: bi('Число 1500 относится ко всему IP-пакету, в котором ещё есть 20 байт заголовка IP и 20 байт заголовка TCP.', '1500 is the whole IP packet, including 20 bytes of IP and 20 bytes of TCP.') },
      { id: '1486', text: '1486', why: bi('Заголовок Ethernet размером 14 байт в MTU не входит, потому что MTU считают от начала IP-пакета.', 'The Ethernet header (14 bytes) is not part of the MTU: MTU counts from the start of the IP packet.') },
    ],
    explain: bi('1500 − 20 (IP) − 20 (TCP) = 1460.', '1500 − 20 (IP) − 20 (TCP) = 1460.'),
  },
  {
    id: 'net.q.env.dstmac',
    kind: 'predict-output',
    concepts: ['net.encapsulation', 'net.mac'],
    prompt: bi('Ноутбук отправляет ping сайту в другой сети, и tcpdump -e показывает первый кадр. Какой MAC-адрес будет указан получателем после знака >?', 'The laptop pings a site on another network, then tcpdump -e shows the first frame. Which MAC is the receiver (after the > sign)?'),
    command: 'ping -c 1 shop.example > /dev/null; tcpdump -n -e -c 1 icmp',
    setup: home,
    options: [
      { id: 'gw', text: bi('Адрес a0:63:91:00:00:01, то есть MAC-адрес домашнего роутера', 'a0:63:91:00:00:01 — the home router’s MAC'), correct: true },
      { id: 'srv', text: bi('MAC-адрес сервера сайта', 'the site server’s MAC'), why: bi('Сервер находится не в вашей локальной сети, поэтому его MAC-адрес вашему кадру не нужен, да и неизвестен.', 'The server is not on your local network: your frame neither needs nor knows its MAC.') },
      { id: 'bc', text: 'ff:ff:ff:ff:ff:ff', why: bi('Широковещательно отправляются вопросы ARP, а не сами пакеты.', 'ARP questions go out as broadcasts, not the packets themselves.') },
    ],
    explain: bi('Получателем указан адрес a0:63:91:00:00:01, то есть MAC-адрес домашнего роутера, который служит шлюзом по умолчанию.', 'a0:63:91:00:00:01 is the home router’s MAC, the default gateway.'),
  },

  // ── DNS ──
  {
    id: 'net.q.dns.order',
    kind: 'order',
    concepts: ['net.resolver', 'net.authoritative'],
    prompt: bi('Все кэши пусты. Расставьте вопросы, которые породит команда curl https://shop.example/, в том порядке, в каком их задают.', 'The caches are empty. Order the questions that curl https://shop.example/ causes.'),
    steps: [
      { id: 'hosts', text: bi('системная библиотека проверяет /etc/hosts', 'the stub resolver looks at /etc/hosts') },
      { id: 'res', text: bi('вопрос уходит рекурсивному резолверу из /etc/resolv.conf', 'a question to the recursive resolver from /etc/resolv.conf') },
      { id: 'root', text: bi('резолвер спрашивает корневой сервер', 'the resolver asks the root') },
      { id: 'tld', text: bi('резолвер спрашивает сервер зоны example.', 'the resolver asks the example. zone server') },
      { id: 'auth', text: bi('резолвер спрашивает авторитативный сервер shop.example', 'the resolver asks the authoritative server of shop.example') },
    ],
    refs: { explainer: 'net.dns' },
  },
  {
    id: 'net.q.dns.nx',
    kind: 'mcq',
    concepts: ['net.resolver', 'net.authoritative'],
    prompt: bi('Пользователь набрал shop.exmaple с опечаткой в зоне первого уровня. Кто ответит NXDOMAIN?', 'A user typed shop.exmaple (a typo in the top-level zone). Who answers NXDOMAIN?'),
    options: [
      { id: 'root', text: bi('Корневой сервер, потому что зоны exmaple. не существует', 'A root server: the zone exmaple. does not exist'), correct: true },
      { id: 'auth', text: bi('Авторитативный сервер магазина', 'The shop’s authoritative server'), why: bi('До него вопрос не дойдёт, потому что корневой сервер не знает, кому передать зону exmaple.', 'The question never reaches it: the root does not know whom to hand exmaple. to.') },
      { id: 'stub', text: bi('Сам ноутбук', 'The laptop itself'), why: bi('Системная библиотека не знает, какие имена существуют, и поэтому спрашивает сервер.', 'The stub resolver does not know which names exist: it asks a server.') },
    ],
    refs: { explainer: 'net.dns' },
  },
  {
    id: 'net.q.dns.servfail',
    kind: 'mcq',
    concepts: ['net.resolver'],
    prompt: bi('Команда dig shop.example показывает status: SERVFAIL. Что это значит?', 'dig shop.example shows status: SERVFAIL. What does it mean?'),
    options: [
      { id: 'cant', text: bi('Резолвер не смог получить ответ, например потому, что авторитативный сервер не отвечает', 'The resolver could not get an answer — for example, the authoritative server does not respond'), correct: true },
      { id: 'nx', text: bi('Такого имени не существует', 'There is no such name'), why: bi('Такой ответ называется NXDOMAIN: сервер сообщает, что такого имени не существует. SERVFAIL означает другое: сервер не смог получить ответ и не знает, существует ли имя.', 'That is NXDOMAIN. SERVFAIL means “I don’t know”, not “no”.') },
      { id: 'srv', text: bi('Веб-сервер сайта аварийно завершил работу', 'The site’s web server crashed'), why: bi('DNS ничего не знает о веб-сервере и отвечает только о своих записях.', 'DNS knows nothing about the web server: it answers only about records.') },
    ],
  },
  {
    id: 'net.q.dns.hosts',
    kind: 'mcq',
    concepts: ['net.resolver'],
    prompt: bi('В /etc/hosts записана строка «10.0.0.9 shop.example». Что покажет команда dig +short shop.example?', '/etc/hosts has “10.0.0.9 shop.example”. What will dig +short shop.example show?'),
    options: [
      { id: 'dns', text: bi('Адрес из DNS, потому что dig не читает /etc/hosts', 'The address from DNS: dig does not read /etc/hosts'), correct: true },
      { id: 'file', text: '10.0.0.9', why: bi('Такой адрес покажут getent hosts или curl, потому что они ищут имена через /etc/nsswitch.conf, а dig всегда спрашивает сервер DNS напрямую.', 'That is what getent hosts or curl return — they go through /etc/nsswitch.conf. dig always asks a DNS server directly.') },
    ],
  },
  {
    id: 'net.q.dns.ttl',
    kind: 'mcq',
    concepts: ['net.ttl', 'net.resolver'],
    prompt: bi('У записи shop.example был TTL 86400 секунд, то есть сутки. Сайт переехал на новый адрес. Почему у части пользователей он ещё сутки не открывается?', 'The record for shop.example had a TTL of 86400. The site moved to a new address. Why does it “not open” for some users for another day?'),
    options: [
      { id: 'cache', text: bi('Резолверы хранят старый ответ до конца TTL, то есть сутки', 'Resolvers keep the old answer until the TTL ends — a day'), correct: true },
      { id: 'prop', text: bi('Изменения DNS сутки распространяются по интернету', 'DNS “propagates” through the internet for a day'), why: bi('Записи DNS никуда не распространяются. Каждый резолвер хранит старый ответ в кэше, пока не истечёт его TTL, и только потом спрашивает заново.', 'There is no propagation: each resolver simply keeps its cache until the TTL runs out.') },
      { id: 'browser', text: bi('Браузер хранит страницу в кэше', 'The browser caches the page'), why: bi('Даже без кэша страницы браузер пойдёт на старый адрес, который ему дал резолвер.', 'Even without a cached page the browser goes to the old address the resolver gave it.') },
    ],
    explain: bi('Поэтому перед переездом TTL заранее снижают до нескольких минут и ждут, пока истечёт старый TTL.', 'Before a move the TTL is lowered to minutes in advance — and the old TTL is waited out.'),
  },

  // ── DHCP ──
  {
    id: 'net.q.dhcp.order',
    kind: 'order',
    concepts: ['net.dhcp'],
    prompt: bi('Расставьте сообщения DHCP в том порядке, в каком они идут.', 'Put the DHCP messages in order.'),
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
      { id: 'nodhcp', text: bi('Сервер DHCP не ответил, и машина назначила себе адрес link-local', 'The DHCP server did not answer and the machine assigned itself a link-local address'), correct: true },
      { id: 'isp', text: bi('Провайдер выдал ноутбуку публичный адрес', 'The provider gave out a public address'), why: bi('Адреса из 169.254.0.0/16 не маршрутизируются, и выдаёт их не сервер, а сама машина.', '169.254.0.0/16 is not routed and is not given by a server but by the machine itself.') },
      { id: 'switch', text: bi('Сломался коммутатор', 'The switch broke'), why: bi('Коммутатор адресов не выдаёт. Адрес 169.254.x.x машина придумала сама, потому что ей никто не ответил.', 'A switch hands out no addresses: the machine made up 169.254.x.x itself because nobody answered.') },
    ],
  },
  {
    id: 'net.q.dhcp.opts',
    kind: 'match',
    concepts: ['net.dhcp', 'net.lease'],
    prompt: bi('Сопоставьте номер опции DHCP с тем, что она сообщает.', 'Match the DHCP option number with what it tells.'),
    pairs: [
      { id: '1', left: bi('опция 1', 'option 1'), right: bi('маска подсети', 'subnet mask') },
      { id: '3', left: bi('опция 3', 'option 3'), right: bi('шлюз (router)', 'gateway (router)') },
      { id: '6', left: bi('опция 6', 'option 6'), right: bi('сервер DNS', 'DNS server') },
      { id: '51', left: bi('опция 51', 'option 51'), right: bi('срок аренды', 'lease time') },
    ],
  },

  // ── NAT ──
  {
    id: 'net.q.nat.inbound',
    kind: 'mcq',
    concepts: ['net.nat', 'net.conntrack'],
    prompt: bi('Почему к ноутбуку за домашним роутером нельзя подключиться снаружи без дополнительной настройки?', 'Why can nobody outside connect to a laptop behind a home router without configuration?'),
    options: [
      { id: 'ct', text: bi('У роутера нет записи о том, какой из домашних машин отдать новое входящее соединение', 'The router has no record of which home machine should get a new incoming connection'), correct: true },
      { id: 'fw', text: bi('Потому что на ноутбуке включён антивирус', 'Because the laptop runs an antivirus'), why: bi('Пакет не дойдёт даже до ноутбука, потому что остановится на роутере.', 'The packet will not even reach the laptop: it stops at the router.') },
      { id: 'priv', text: bi('Потому что частный адрес нельзя использовать в TCP', 'A private address cannot be used with TCP'), why: bi('Внутри сети частный адрес использовать можно, а снаружи по нему нельзя обратиться.', 'It can — inside the network. From outside it simply cannot be addressed.') },
    ],
    refs: { explainer: 'net.nat' },
  },
  {
    id: 'net.q.nat.hooks',
    kind: 'order',
    concepts: ['net.netfilter'],
    prompt: bi('Пакет проходит через маршрутизатор насквозь. Расставьте цепочки netfilter, через которые он идёт, по порядку.', 'A packet passes straight through a router. Order the netfilter chains it goes through.'),
    steps: [
      { id: 'pre', text: 'PREROUTING' },
      { id: 'fwd', text: 'FORWARD' },
      { id: 'post', text: 'POSTROUTING' },
    ],
    explain: bi('Цепочки INPUT и OUTPUT предназначены для пакетов, адресованных самой машине или отправленных ею.', 'INPUT and OUTPUT are for packets to and from the host itself.'),
  },
  {
    id: 'net.q.nat.reject',
    kind: 'mcq',
    concepts: ['net.netfilter'],
    prompt: bi('Чем для клиента правило -j REJECT отличается от правила -j DROP?', 'How does a -j REJECT rule differ from -j DROP for the client?'),
    options: [
      { id: 'fast', text: bi('REJECT отвечает ошибкой, и клиент сразу получает отказ, а DROP молчит, и клиент ждёт до конца срока ожидания', 'REJECT answers with an error — the client is refused at once; DROP is silent — the client waits for a timeout'), correct: true },
      { id: 'same', text: bi('Ничем не отличается, потому что оба правила блокируют пакеты', 'No difference, both block'), why: bi('Оба правила блокируют пакеты, но симптомы у них разные, и по симптому на дежурстве вы узнаёте, что случилось.', 'Both block, but the symptoms differ — and on call the symptom tells you what happened.') },
      { id: 'log', text: bi('REJECT записывает событие в журнал, а DROP нет', 'REJECT logs, DROP does not'), why: bi('Записью в журнал занимается отдельная цель LOG.', 'Logging is a separate target, LOG.') },
    ],
  },
  {
    id: 'net.q.nat.est',
    kind: 'mcq',
    concepts: ['net.conntrack', 'net.netfilter'],
    prompt: bi('Политика цепочки INPUT равна DROP, и в ней есть правило «-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT». Почему ответы на ваши исходящие соединения проходят?', 'The INPUT policy is DROP and there is a rule “-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT”. Why do replies to your outgoing connections get through?'),
    options: [
      { id: 'ct', text: bi('conntrack знает, что это ответ на соединение, которое открыли вы', 'conntrack knows it is a reply to a connection you opened'), correct: true },
      { id: 'port', text: bi('Ответы приходят на разрешённый порт', 'Replies arrive on an allowed port'), why: bi('Ответ приходит на ваш эфемерный порт, и отдельного правила для этого порта нет. Пакет пропускает правило, которое смотрит на состояние соединения.', 'The reply arrives on your ephemeral port — there is no rule for it. The connection state lets it in.') },
      { id: 'out', text: bi('Исходящие пакеты не фильтруются', 'Outgoing packets are not filtered'), why: bi('Вопрос касается входящих ответов, а они проходят через цепочку INPUT.', 'This is about incoming replies — they go through INPUT.') },
    ],
  },

  // ── the network by hand on real Linux ──
  {
    id: 'net.q.lab.vlan-trunk',
    kind: 'mcq',
    concepts: ['net.vlan'],
    prompt: bi('Машина, подключённая к порту доступа VLAN 10, отправляет широковещательный запрос ARP. Кто его получит?', 'A machine on a VLAN 10 access port sends a broadcast ARP request. Who receives it?'),
    options: [
      { id: 'vlan', text: bi('Все порты VLAN 10 и транки, по которым передаётся VLAN 10, причём на транки кадр уйдёт с меткой 10', 'Every VLAN 10 port and the trunks that carry VLAN 10 (tagged 10 there)'), correct: true },
      { id: 'all', text: bi('Все порты коммутатора, потому что широковещательный кадр получают все', 'Every port of the switch: everyone receives a broadcast frame'), why: bi('Слово «все» означает всех в своей сети второго уровня, а VLAN и есть отдельная сеть, поэтому в чужие VLAN кадр не попадает.', '“Everyone” means everyone in its own layer-2 network. A VLAN is exactly a separate network: the frame never reaches other VLANs.') },
      { id: 'trunk', text: bi('Только транковые порты', 'Only the trunk ports'), why: bi('Порты доступа того же VLAN тоже получат кадр, только без метки.', 'Access ports of the same VLAN receive it too, just without a tag.') },
    ],
    explain: bi('Коммутатор рассылает кадр во все порты того же VLAN. На порт доступа кадр уходит без метки, а на транк с меткой 802.1Q, чтобы на другом конце было ясно, из какой он сети.', 'The switch floods the frame to every port of the same VLAN. It leaves an access port untagged and a trunk with an 802.1Q tag, so that the other end knows which network it came from.'),
  },
  {
    id: 'net.q.lab.bridge',
    kind: 'mcq',
    concepts: ['net.bridge', 'net.vlan'],
    prompt: bi('На машине с Linux, к которой подходит транк, интерфейсы `eth0.10` и `eth0.20` подключили портами к одному мосту `br0`. Что теперь происходит с VLAN 10 и VLAN 20?', 'On a Linux machine with a trunk, the interfaces `eth0.10` and `eth0.20` became ports of one bridge `br0`. What about VLANs 10 and 20 now?'),
    options: [
      { id: 'one', text: bi('Они стали одной сетью второго уровня, и кадры, включая ARP, ходят между ними через мост', 'They became one layer-2 network: frames and ARP pass between them through the bridge'), correct: true },
      { id: 'routed', text: bi('Между ними работает маршрутизация, но ARP по-прежнему не проходит', 'Routing works between them, but ARP still does not pass'), why: bi('Мост работает на втором уровне и пересылает любые кадры, включая ARP. Маршрутизация относится к третьему уровню и соединяет разные подсети.', 'A bridge works at layer 2 and forwards frames, ARP included. Routing is layer 3 and different subnets.') },
      { id: 'nothing', text: bi('Ничего не изменилось, потому что VLAN разделяет коммутатор, а не Linux', 'Nothing: the switch separates VLANs, not Linux'), why: bi('Коммутатор действительно разделяет VLAN, но кадры обоих VLAN приходят к мосту по транку, и мост пересылает их из одного VLAN в другой.', 'The switch separates them, but frames of both VLANs reach the bridge over the trunk, and the bridge forwards them from one to the other.') },
    ],
  },
  {
    id: 'net.q.lab.veth',
    kind: 'mcq',
    concepts: ['net.veth', 'linux.namespaces'],
    prompt: bi('Вы создали пространство имён `blue` и больше ничего не делали. Что в нём есть из сети?', 'You created the namespace `blue` and did nothing else. What network does it have?'),
    options: [
      { id: 'lo', text: bi('Только выключенный `lo`, а интерфейсов, адресов и маршрутов нет', 'Only `lo`, and it is down: no interfaces, no addresses, no routes'), correct: true },
      { id: 'copy', text: bi('Копия интерфейсов машины с теми же адресами', 'A copy of the machine’s interfaces with the same addresses'), why: bi('Пространство имён не копирует сеть машины, а начинает с пустой. Поэтому ему и нужна пара veth.', 'A namespace does not copy the network, it starts empty. That is why it needs a veth pair.') },
      { id: 'eth0', text: bi('Общий с машиной интерфейс `eth0`', 'The machine’s `eth0`, shared'), why: bi('Интерфейс принадлежит только одному пространству имён: его можно перенести в другое, но нельзя разделить между двумя.', 'An interface belongs to exactly one namespace; it can be moved, not shared.') },
    ],
  },
  {
    id: 'net.q.lab.netns-order',
    kind: 'order',
    concepts: ['net.veth', 'net.nat', 'linux.namespaces'],
    prompt: bi('Расставьте по порядку шаги, которые выпускают пространство имён `blue` в сеть так, как это делает Docker.', 'Put in order the steps that let the namespace `blue` out to the network the way Docker does it.'),
    steps: [
      { id: 'ns', text: bi('`ip netns add blue`', '`ip netns add blue`') },
      { id: 'veth', text: bi('создать пару veth и положить один её конец в `blue`', 'a veth pair, one end into `blue`') },
      { id: 'addr', text: bi('назначить адреса обоим концам и включить их командой `up`', 'addresses on both ends and `up`') },
      { id: 'route', text: bi('добавить маршрут по умолчанию внутри `blue`', 'a default route inside `blue`') },
      { id: 'nat', text: bi('включить пересылку и MASQUERADE на машине', 'forwarding and MASQUERADE on the machine') },
    ],
    explain: bi('Сначала создают то, чего ещё нет (пространство имён и кабель), потом настраивают созданное (адреса и маршрут), а последним открывают выход наружу. Последний шаг можно сделать и раньше, но без маршрута внутри он всё равно ничего не даст.', 'First what must be created (the namespace, the cable), then what is set on it (addresses, the route), and last the way out. The last step could come earlier: without the route inside it gives nothing anyway.'),
  },
  {
    id: 'net.q.lab.nft-order',
    kind: 'mcq',
    concepts: ['net.netfilter'],
    prompt: bi('Вы работаете на сервере по SSH и закрываете его с помощью nftables. Что нужно сделать первым?', 'You work on a server over SSH and lock it down with nftables. What do you do first?'),
    options: [
      { id: 'allow', text: bi('Разрешить `ct state established,related` и SSH, и только после этого поставить политику `drop`', 'Allow `ct state established,related` and SSH, and only then set the policy to `drop`'), correct: true },
      { id: 'policy', text: bi('Поставить политику `drop`, а потом добавить разрешения', 'Set the `drop` policy, then add the allow rules'), why: bi('Если поставить политику `drop` без разрешений, первым же пакетом будет отрезана ваша собственная сессия SSH, и добавлять правила станет некуда.', 'With a `drop` policy and no allow rules, your own SSH session is cut with the next packet, and there is nowhere left to add rules from.') },
      { id: 'flush', text: bi('Выполнить `nft flush ruleset`, чтобы начать с чистого листа', '`nft flush ruleset` to start from a clean slate'), why: bi('Сброс удаляет и те правила, которые уже защищают сервер. Начинать с чистого листа удобно на машине, к которой есть консоль, а не только SSH.', 'Flushing also removes what already protects the server. A clean slate is fine on a machine with a console, not only SSH.') },
    ],
  },
  {
    id: 'net.q.lab.dnsmasq',
    kind: 'multi',
    concepts: ['net.dhcp', 'net.dns', 'net.lease'],
    prompt: bi('В `/etc/dnsmasq.conf` записана одна строка: `dhcp-range=10.0.0.100,10.0.0.199,1h`. Что получит клиент, который попросил адрес?', '`/etc/dnsmasq.conf` has one line: `dhcp-range=10.0.0.100,10.0.0.199,1h`. What does a client asking for an address get?'),
    options: [
      { id: 'addr', text: bi('Адрес из диапазона от 10.0.0.100 до 10.0.0.199 на один час', 'An address from 10.0.0.100–10.0.0.199 for an hour'), correct: true },
      { id: 'gw', text: bi('Адрес самого dnsmasq в качестве шлюза', 'dnsmasq’s own address as the gateway'), correct: true },
      { id: 'dns', text: bi('Адрес самого dnsmasq в качестве сервера DNS', 'dnsmasq’s own address as the DNS server'), correct: true },
      { id: 'forever', text: bi('Адрес навсегда, пока клиент включён', 'An address forever, while the client is on'), why: bi('Третье поле задаёт срок аренды. Клиент продлевает аренду заранее, но если он пропадёт, адрес вернётся в пул.', 'The third field is the lease time. The client renews it in advance, but if it disappears, the address returns to the pool.') },
    ],
    explain: bi('В качестве шлюза и сервера DNS dnsmasq по умолчанию сообщает свой адрес, поэтому маленькой сети хватает одной строки.', 'By default dnsmasq offers itself as the gateway and the DNS server, so one line is enough for a small network.'),
  },

  // ── HTTP ──
  {
    id: 'net.q.http.codes',
    kind: 'match',
    concepts: ['net.status'],
    prompt: bi('Сопоставьте каждый код ответа с его смыслом.', 'Match the status code with its meaning.'),
    pairs: [
      { id: '200', left: '200', right: bi('всё в порядке', 'everything is fine') },
      { id: '301', left: '301', right: bi('ресурс переехал, а новый адрес указан в заголовке Location', 'the resource moved; the address is in Location') },
      { id: '404', left: '404', right: bi('такого пути на сервере нет', 'no such path on the server') },
      { id: '500', left: '500', right: bi('ошибка в самом приложении', 'an error in the application itself') },
    ],
  },
  {
    id: 'net.q.http.host',
    kind: 'mcq',
    concepts: ['net.host-header'],
    prompt: bi('На одном IP-адресе работают shop.example и blog.example. Как сервер понимает, какой сайт отдать?', 'shop.example and blog.example live on one IP address. How does the server know which site to serve?'),
    options: [
      { id: 'host', text: bi('По заголовку Host в запросе', 'By the Host header in the request'), correct: true },
      { id: 'port', text: bi('По номеру порта', 'By the port'), why: bi('Оба сайта работают на портах 80 и 443, так что порт у них одинаковый.', 'Both sites are on 80 and 443 — the port is the same.') },
      { id: 'dns', text: bi('Имя серверу сообщает DNS', 'DNS tells the server the name'), why: bi('DNS отвечает клиенту, и сервер о его вопросе ничего не знает. Имя сайта сервер узнаёт из самого запроса.', 'DNS answers the client; the server knows nothing of the question. It learns the name from the request.') },
    ],
  },
  {
    id: 'net.q.http.redirect',
    kind: 'mcq',
    concepts: ['net.status'],
    prompt: bi('Пользователь вводит http://shop.example, а открывается https://shop.example. Почему так происходит?', 'A user types http://shop.example, and https://shop.example opens. Why?'),
    options: [
      { id: '301', text: bi('Сервер ответил кодом 301 или 308 с заголовком Location: https://…', 'The server answered 301 (or 308) with Location: https://…'), correct: true },
      { id: 'dns', text: bi('Так ответил сервер DNS', 'The DNS server answered that way'), why: bi('DNS возвращает адреса и ничего не знает о том, какую схему, http или https, выбрал пользователь.', 'DNS returns addresses; it knows nothing about the http/https scheme.') },
      { id: 'nat', text: bi('Так сработал NAT на роутере', 'NAT on the router'), why: bi('NAT меняет адреса и порты пакетов, а не адреса страниц.', 'NAT rewrites packet addresses and ports, not URLs.') },
    ],
    key: true,
  },
  {
    id: 'net.q.http.bug',
    kind: 'bugfind',
    concepts: ['net.http', 'net.host-header'],
    prompt: bi('Сервер отвергает этот запрос, отправленный через nc, с кодом 400. Какая строка в нём неверна?', 'The server rejects this request, sent through nc, with 400. Which line is wrong?'),
    code: 'GET HTTP/1.1 /catalog\nHost: shop.example\nAccept: */*\n',
    bug: [1],
    why: {
      1: bi('В строке запроса части должны идти в порядке «метод, путь, версия», то есть GET /catalog HTTP/1.1.', 'The order in the request line is method, path, version — GET /catalog HTTP/1.1.'),
      2: bi('Заголовок Host записан верно, а без него сервер HTTP/1.1 ответил бы кодом 400.', 'The Host header is right — without it an HTTP/1.1 server would answer 400.'),
      3: bi('Заголовок Accept обычный и необязательный.', 'Accept is an ordinary optional header.'),
    },
  },

  // ── TLS ──
  {
    id: 'net.q.tls.sees',
    kind: 'multi',
    concepts: ['net.tls', 'net.sni'],
    prompt: bi('Вы открываете https://shop.example/catalog в кафе. Что могут увидеть провайдер и соседи по Wi-Fi?', 'You open https://shop.example/catalog in a café. What do the provider and the Wi-Fi neighbours see?'),
    options: [
      { id: 'ip', text: bi('IP-адрес сервера', 'the server’s IP address'), correct: true },
      { id: 'sni', text: bi('имя сайта в SNI', 'the site name in SNI'), correct: true },
      { id: 'port', text: bi('порт 443', 'port 443'), correct: true },
      { id: 'path', text: bi('путь /catalog', 'the path /catalog'), why: bi('Путь входит в запрос HTTP, а запрос целиком передаётся внутри шифрования.', 'The path is part of the HTTP request, which is entirely inside the encryption.') },
      { id: 'cookie', text: bi('cookie', 'cookies'), why: bi('Заголовки HTTP зашифрованы вместе с запросом.', 'HTTP headers are encrypted along with the request.') },
    ],
    refs: { explainer: 'net.tls' },
  },
  {
    id: 'net.q.tls.rtt',
    kind: 'mcq',
    concepts: ['net.tls', 'net.handshake'],
    prompt: bi('Открывается новое соединение HTTPS с TLS 1.3. Сколько раз сообщения успеют сходить до сервера и обратно, прежде чем придёт первый байт ответа?', 'A new HTTPS connection with TLS 1.3. How many round trips pass before the first byte of the answer?'),
    options: [
      { id: '3', text: bi('Три раза, по одному на TCP, на TLS и на сам запрос', 'Three: TCP, TLS, the request'), correct: true },
      { id: '1', text: bi('Один раз, потому что TLS 1.3 договаривается о ключах вместе с рукопожатием TCP', 'Once, because TLS 1.3 agrees on keys together with the TCP handshake'), why: bi('Один обмен остаётся только тогда, когда соединение уже открыто прошлым запросом (keep-alive).', 'One only with an already open connection (keep-alive).') },
      { id: '4', text: bi('Четыре раза, по одному на TCP и на запрос и ещё два на TLS', 'Four: one for TCP, one for the request and two for TLS'), why: bi('Четыре обмена нужны с TLS 1.2, потому что его рукопожатие на один обмен длиннее.', 'Four is TLS 1.2: its handshake has one more round.') },
    ],
    refs: { explainer: 'net.tls' },
  },
  {
    id: 'net.q.tls.errors',
    kind: 'match',
    concepts: ['net.cert', 'net.ca'],
    prompt: bi('Сопоставьте каждую ошибку curl с её причиной.', 'Match the curl error with its cause.'),
    pairs: [
      { id: 'exp', left: 'certificate has expired', right: bi('истёк срок действия сертификата', 'the certificate’s validity ended') },
      { id: 'name', left: 'no alternative certificate subject name matches', right: bi('сертификат выписан на другое имя', 'the certificate is for another name') },
      { id: 'chain', left: 'unable to get local issuer certificate', right: bi('цепочка подписей до доверенного центра неполная', 'an incomplete chain to a trusted authority') },
    ],
    refs: { explainer: 'net.tls' },
  },
  {
    id: 'net.q.tls.ssh',
    kind: 'mcq',
    concepts: ['net.cert'],
    prompt: bi('ssh пишет «Host key verification failed». Что означает это сообщение?', 'ssh prints “Host key verification failed”. What does it mean?'),
    options: [
      { id: 'key', text: bi('Ключ сервера не совпал с тем, что записан в known_hosts, и это аналог ошибки сертификата в TLS', 'The server key does not match the one in known_hosts — like a certificate error in TLS'), correct: true },
      { id: 'pw', text: bi('Пароль введён неверно', 'A wrong password'), why: bi('До пароля дело не дошло, потому что ключ сервера проверяется раньше входа.', 'It never got to the password: the server key check comes before login.') },
      { id: 'net', text: bi('Сервер недоступен', 'The server is unreachable'), why: bi('Сервер ответил и показал свой ключ, но этот ключ оказался не тем.', 'The server answered and presented a key — just not the expected one.') },
    ],
  },

  // ── proxies ──
  {
    id: 'net.q.proxy.who',
    kind: 'mcq',
    concepts: ['net.reverse-proxy', 'net.upstream'],
    prompt: bi('Пользователь получил ответ 504 с заголовком Server: nginx. Что из этого следует?', 'A user got a 504 with the header Server: nginx. What does it prove?'),
    options: [
      { id: 'nginx', text: bi('Сеть до nginx работает, а сам nginx не дождался ответа от сервера upstream', 'The network up to nginx works; nginx did not get an answer from the upstream in time'), correct: true },
      { id: 'net', text: bi('У пользователя проблемы с интернетом', 'The user’s internet is broken'), why: bi('Код ответа пришёл, значит, DNS, TCP и TLS до nginx в порядке.', 'A status code arrived — so DNS, TCP and TLS up to nginx are fine.') },
      { id: 'app', text: bi('Код 504 вернуло приложение', 'The application returned 504'), why: bi('Приложение почти никогда не пишет код 504, потому что этот код пишет прокси, который не дождался ответа.', 'An application almost never writes 504: it is the code of a proxy that did not get an answer.') },
    ],
    refs: { explainer: 'net.proxy504' },
  },
  {
    id: 'net.q.proxy.lines',
    kind: 'mcq',
    concepts: ['net.upstream'],
    prompt: bi('На один запрос к /report в журнале появились две строки «upstream timed out … while reading response header» с разными серверами upstream. Почему строк две?', 'One request to /report — and two lines “upstream timed out … while reading response header” with different upstreams. Why two?'),
    options: [
      { id: 'retry', text: bi('nginx повторил запрос на втором сервере группы из-за настройки proxy_next_upstream error timeout', 'nginx retried the request on the second server of the group (proxy_next_upstream error timeout)'), correct: true },
      { id: 'twice', text: bi('Пользователь дважды нажал F5', 'The user pressed F5 twice'), why: bi('Тогда в access.log было бы два запроса, а здесь один запрос и две попытки его выполнить.', 'Then access.log would show two requests. Here it is one request and two attempts.') },
      { id: 'bug', text: bi('Журнал записывается с ошибкой', 'A logging bug'), why: bi('nginx пишет по строке на каждую неудачную попытку, и так задумано.', 'nginx writes a line for every failed attempt — by design.') },
    ],
    refs: { explainer: 'net.proxy504' },
  },
  {
    id: 'net.q.proxy.connecting',
    kind: 'mcq',
    concepts: ['net.upstream'],
    prompt: bi('Чем строка «while connecting to upstream» отличается от строки «while reading response header from upstream»?', 'How does “while connecting to upstream” differ from “while reading response header from upstream”?'),
    options: [
      { id: 'stage', text: bi('В первом случае подключиться не удалось из-за сети, фильтра или процесса, а во втором подключение удалось, но приложение не ответило вовремя', 'In the first the connection failed (network, filter, process); in the second it connected but the application did not answer in time'), correct: true },
      { id: 'same', text: bi('Эти строки означают одно и то же', 'They are the same'), why: bi('Это разные этапы, и причину в каждом случае нужно искать в разных местах.', 'They are different stages — and different places to look for the cause.') },
    ],
  },
  {
    id: 'net.q.proxy.500',
    kind: 'mcq',
    concepts: ['net.upstream', 'net.status'],
    prompt: bi('Приложение на app2 работает, но само отвечает кодом 500. Повторит ли nginx запрос на app1 при настройках по умолчанию?', 'app2 is alive but answers 500 itself. Will nginx retry the request on app1 with default settings?'),
    options: [
      { id: 'no', text: bi('Нет, потому что код 500 считается ответом, а не ошибкой upstream, а по умолчанию proxy_next_upstream срабатывает только на error и timeout', 'No: 500 is an answer, not an upstream error; by default proxy_next_upstream is only error timeout'), correct: true },
      { id: 'yes', text: bi('Да, потому что nginx всегда ищет работающий сервер', 'Yes, nginx always looks for a working server'), why: bi('nginx повторяет запрос только при ошибке соединения или истёкшем сроке ожидания. Чтобы повторять и при коде 500, нужно явно добавить http_500.', 'Only on a connection error or a timeout. For 500 you must add http_500 explicitly.') },
    ],
    refs: { explainer: 'net.proxy504' },
  },

  // ── troubleshooting ──
  {
    id: 'net.q.ts.layer',
    kind: 'match',
    concepts: ['net.layers-method'],
    prompt: bi('На каком уровне сломалась работа? Сопоставьте каждое сообщение с уровнем.', 'Which layer broke? Match the message with the layer.'),
    pairs: [
      { id: 'dns', left: 'curl: (6) Could not resolve host', right: 'DNS (L7)' },
      { id: 'l3', left: 'ping: connect: Network is unreachable', right: 'L3' },
      { id: 'l4', left: "curl: (7) … Couldn't connect to server", right: 'L4' },
      { id: 'tls', left: 'curl: (60) SSL certificate problem', right: 'TLS' },
      { id: 'l7', left: 'HTTP/1.1 504 Gateway Time-out', right: bi('L7, на прокси', 'L7 (proxy)') },
    ],
    refs: { explainer: 'net.url' },
  },
  {
    id: 'net.q.ts.first',
    kind: 'mcq',
    concepts: ['net.layers-method'],
    prompt: bi('Пришла заявка: «сайт не открывается». С чего начать?', 'The ticket: “the site does not open”. Where do you start?'),
    options: [
      { id: 'layer', text: bi('Воспроизвести ошибку, по симптому определить уровень, а затем проверить его одной командой', 'Reproduce it, name the layer from the symptom, then check that layer with one command'), correct: true },
      { id: 'restart', text: bi('Перезапустить nginx', 'Restart nginx'), why: bi('Перезапуск без проверенной догадки стирает следы, по которым находят причину, и может навредить, если причина не в nginx.', 'A restart without a hypothesis destroys evidence and may do harm if nginx is not the cause.') },
      { id: 'flush', text: bi('Очистить правила iptables', 'Flush the iptables rules'), why: bi('Это опасное действие, потому что так можно открыть всё или отрезать себе доступ. Сначала докажите, что проблема находится на этом уровне.', 'That is dangerous: you may open everything or cut yourself off. First prove the problem is at that layer.') },
    ],
  },
  {
    id: 'net.q.ts.revisit',
    kind: 'order',
    concepts: ['net.layers-method', 'net.keepalive'],
    prompt: bi('Вы снова открываете https://shop.example через минуту. Соединение уже закрыто, а ответ DNS лежит в кэше системы. Какие этапы загрузки останутся?', 'A second visit to https://shop.example a minute later; the connection is closed, the DNS answer is in the OS cache. Which stages remain?'),
    steps: [
      { id: 'tcp', text: bi('рукопожатие TCP', 'the TCP handshake') },
      { id: 'tls', text: bi('рукопожатие TLS', 'the TLS handshake') },
      { id: 'req', text: bi('запрос HTTP', 'the HTTP request') },
      { id: 'resp', text: bi('ответ и отрисовка страницы', 'the answer and rendering') },
    ],
    explain: bi('Обходить серверы DNS не нужно, потому что адрес лежит в кэше. А рукопожатия TCP и TLS придётся пройти заново, потому что соединение закрыто.', 'There is no DNS walk — the address is cached. But TCP and TLS happen again: the connection is closed.'),
    refs: { explainer: 'net.url' },
  },

  // ── catalogue ──
  {
    id: 'net.q.proto.transport',
    kind: 'match',
    concepts: ['net.udp', 'net.tcp'],
    prompt: bi('Сопоставьте каждый протокол с тем, поверх чего он работает.', 'Match the protocol with what it runs on top of.'),
    pairs: [
      { id: 'dhcp', left: 'DHCP', right: bi('UDP-порты 67 и 68, широковещательно', 'UDP 67/68, broadcast') },
      { id: 'quic', left: 'HTTP/3', right: 'QUIC / UDP 443' },
      { id: 'bgp', left: 'BGP', right: 'TCP 179' },
      { id: 'vxlan', left: 'VXLAN', right: bi('кадр Ethernet внутри UDP на порту 4789', 'an Ethernet frame in UDP 4789') },
      { id: 'arp', left: 'ARP', right: bi('прямо внутри кадра Ethernet', 'directly in an Ethernet frame') },
    ],
  },
  {
    id: 'net.q.proto.ntp',
    kind: 'mcq',
    concepts: ['net.tls', 'net.cert'],
    prompt: bi('На сервере часы ушли на два месяца назад. Какой протокол перестанет работать первым и почему?', 'A server’s clock went two months back. Which protocol “breaks” first, and why?'),
    options: [
      { id: 'tls', text: bi('TLS, потому что сертификаты окажутся ещё не действительными', 'TLS: certificates become “not yet valid”'), correct: true },
      { id: 'arp', text: 'ARP', why: bi('Протоколу ARP показания часов не нужны, поэтому он продолжит работать.', 'ARP does not use time.') },
      { id: 'tcp', text: 'TCP', why: bi('Отметки времени в TCP относительные, и настенные часы для него не важны.', 'TCP timestamps are relative: wall-clock time does not matter to it.') },
    ],
    explain: bi('Поэтому служба точного времени NTP (например, chrony) обязательна на любом сервере.', 'That is why NTP (chrony) is a mandatory service on any server.'),
  },
];

export { tcpLab };
