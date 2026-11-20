// The concepts of the Networks block in the order the lessons introduce them
// (03 §3). Terms that are specialised jargon are scanned by the concept-order
// linter; words that earlier blocks may use in their everyday sense (IP
// address, port, DNS, HTTP, certificate…) set scan: false and are guarded by
// introduces/uses and [[links]] instead.

import { bi } from '../../core/i18n';
import type { Concept } from '../../core/types';

const C = (id: string, introducedIn: string, term: [string, string], short: [string, string], o: Partial<Concept> = {}): Concept => ({
  id,
  introducedIn,
  term: bi(term[0], term[1]),
  short: bi(short[0], short[1]),
  ...o,
});

const L = {
  internet: 'networks.internet',
  frames: 'networks.frames',
  subnets: 'networks.subnets',
  arp: 'networks.arp',
  routing: 'networks.routing',
  transport: 'networks.transport',
  envelopes: 'networks.envelopes',
  dns: 'networks.dns',
  dhcp: 'networks.dhcp',
  nat: 'networks.nat',
  http: 'networks.http',
  tls: 'networks.tls',
  proxy: 'networks.proxy',
  vpn: 'networks.vpn',
  trouble: 'networks.troubleshooting',
  linuxLab: 'networks.linux-lab',
};

export const concepts: Concept[] = [
  // ── the internet ──
  C('net.as', L.internet, ['автономная система', 'autonomous system'], ['Сеть, которой управляет одна организация и у которой есть свой номер (ASN) и свои блоки адресов. Интернет состоит из десятков тысяч таких сетей, которые договорились между собой.', 'A network under one administration with its own number (ASN) and its own address blocks. The internet is tens of thousands of such networks that have agreed with each other.'], {
    forms: { ru: ['автономной системы', 'автономные системы', 'автономных систем', 'автономную систему', 'автономной системе', 'автономными системами', 'автономным системам'], en: ['autonomous systems'] },
    docRef: { url: 'https://www.cloudflare.com/learning/network-layer/what-is-an-autonomous-system/', label: 'Cloudflare Learning · What is an AS' },
  }),
  C('net.bgp', L.internet, ['BGP', 'BGP'], ['Протокол, по которому автономные системы сообщают соседям, какие адреса доступны через них. Из этих объявлений складываются маршруты интернета.', 'The protocol by which autonomous systems tell their neighbours which addresses are reachable through them. The routes of the internet are made of these announcements.'], { docRef: { url: 'https://www.rfc-editor.org/rfc/rfc4271', label: 'RFC 4271' } }),
  C('net.ixp', L.internet, ['точка обмена трафиком', 'internet exchange point'], ['Место, где десятки сетей подключаются к одному большому коммутатору и обмениваются трафиком напрямую.', 'A place (in essence a large switch) where dozens of networks connect to one another and exchange traffic directly.'], {
    forms: { ru: ['точки обмена трафиком', 'точку обмена трафиком', 'точках обмена трафиком', 'IXP'], en: ['internet exchange points', 'IXP'] },
  }),
  C('net.latency', L.internet, ['задержка распространения', 'propagation delay'], ['Время, за которое сигнал проходит расстояние; в оптоволокне на каждый километр уходит около 5 микросекунд. Уменьшить эту задержку нельзя, можно только сократить путь.', 'The time a signal needs to cover a distance: about 5 µs per kilometre in fibre. It cannot be reduced, only the path can be shortened.'], {
    forms: { ru: ['задержки распространения', 'задержку распространения', 'задержкой распространения'], en: [] },
  }),
  C('net.rtt', L.internet, ['RTT', 'RTT'], ['Round-trip time, то есть время пути туда и обратно: от отправки пакета до прихода ответа на него.', 'Round-trip time: the time from sending a packet until the answer arrives.']),

  // ── frames and MAC ──
  C('net.nic', L.frames, ['сетевая карта', 'network card'], ['Устройство, физическое или виртуальное, через которое машина отправляет и принимает кадры. В Linux оно видно как интерфейс, например eth0 или wlan0.', 'The device (or virtual device) through which a machine sends and receives frames. In Linux, an interface such as eth0 or wlan0.'], { scan: false }),
  C('net.mac', L.frames, ['MAC-адрес', 'MAC address'], ['Адрес сетевой карты длиной 48 бит, например 02:42:ac:11:00:0a. Он действует только внутри одной локальной сети.', 'The 48-bit address of a network card (02:42:ac:11:00:0a). It is meaningful only inside one local network.'], { scan: false, docRef: { page: 'man/ip.8', anchor: 'EXAMPLES' } }),
  C('net.frame', L.frames, ['кадр', 'frame'], ['Порция данных в локальной сети. Кадр содержит MAC-адрес получателя, MAC-адрес отправителя, тип содержимого, сами данные и контрольную сумму.', 'A piece of data on a local network: the receiver’s MAC, the sender’s MAC, the content type, the data, a checksum.'], { scan: false }),
  C('net.switch', L.frames, ['коммутатор', 'switch'], ['Устройство, которое соединяет кабели одной локальной сети. Оно запоминает, за каким портом находится какой MAC-адрес, и пересылает кадры только в нужный порт, а кадры для неизвестных адресов рассылает во все порты.', 'A device that joins the cables of one local network. It remembers which MAC is behind which port and forwards frames to it; anything unknown goes out of every port.'], { scan: false }),
  C('net.broadcast', L.frames, ['широковещательный кадр', 'broadcast frame'], ['Кадр на адрес ff:ff:ff:ff:ff:ff, который получают все машины локальной сети.', 'A frame to the address ff:ff:ff:ff:ff:ff — everyone on the local network receives it.'], {
    forms: { ru: ['широковещательного кадра', 'широковещательные кадры', 'широковещательный', 'широковещательно', 'широковещательная'], en: ['broadcast frames'] },
  }),

  // ── IP and subnets ──
  C('net.ip', L.subnets, ['IP-адрес', 'IP address'], ['Адрес, который указывает место машины в сети. Он занимает 32 бита и записывается четырьмя числами, например 192.168.1.10. Сетевая часть адреса говорит, в какой сети находится машина, а часть хоста говорит, какая это машина в этой сети.', 'A machine’s address by its place in the network: 32 bits written as four numbers (192.168.1.10). The “network” part says where the machine is, the “host” part which one it is there.'], { scan: false }),
  C('net.cidr', L.subnets, ['префикс CIDR', 'CIDR prefix'], ['Запись вида «/24» после адреса, которая говорит, сколько старших бит адреса занимает номер сети. Запись /24 означает то же, что маска 255.255.255.0.', 'The “/24” after an address: how many leading bits of the address are the network number. The same as the mask 255.255.255.0.'], {
    forms: { ru: ['CIDR', 'префикса CIDR'], en: ['CIDR'] },
    docRef: { url: 'https://www.rfc-editor.org/rfc/rfc4632', label: 'RFC 4632' },
  }),
  C('net.subnet', L.subnets, ['подсеть', 'subnet'], ['Все адреса с одинаковой сетевой частью; например, 192.168.1.0/24 включает адреса от 192.168.1.0 до 192.168.1.255. Внутри подсети машины обмениваются пакетами напрямую.', 'All addresses with the same network part: 192.168.1.0/24 is 192.168.1.0…192.168.1.255. Inside a subnet machines talk directly.'], {
    forms: { ru: ['подсети', 'подсетей', 'подсетью', 'подсетях', 'подсетям'], en: ['subnets', 'subnetting'] },
  }),
  C('net.private', L.subnets, ['частный адрес', 'private address'], ['Адрес из диапазонов 10.0.0.0/8, 172.16.0.0/12 или 192.168.0.0/16, описанных в RFC 1918. Такие адреса используют внутри сетей, а в интернете они не маршрутизируются.', 'An address from 10.0.0.0/8, 172.16.0.0/12 or 192.168.0.0/16 (RFC 1918). Used inside networks and not routed on the internet.'], {
    forms: { ru: ['частные адреса', 'частного адреса', 'частных адресов', 'частным адресом'], en: ['private addresses'] },
  }),

  // ── ARP ──
  C('net.arp', L.arp, ['ARP', 'ARP'], ['Протокол, которым машина спрашивает, у кого какой IP-адрес. Вопрос рассылается широковещательно по локальной сети, а отвечает одна машина, сообщая свой MAC-адрес.', 'The “who has this IP address?” protocol: a broadcast question on the local network, an answer from one — its MAC.'], { docRef: { url: 'https://www.rfc-editor.org/rfc/rfc826', label: 'RFC 826' } }),
  C('net.arp-cache', L.arp, ['ARP-кэш', 'ARP cache'], ['Таблица соответствия IP-адресов и MAC-адресов в ядре, которую показывает команда ip neigh. Записи хранятся, пока ими пользуются.', 'The “IP → MAC” table in the kernel, shown by ip neigh. Entries live while they are used.'], { docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip neigh' } }),

  // ── routing and ICMP ──
  C('net.router', L.routing, ['маршрутизатор', 'router'], ['Машина, которая принимает пакеты, адресованные не ей, и пересылает их дальше по своей таблице маршрутов. В работе DevOps-инженера это обычно машина с Linux и параметром ip_forward=1.', 'A machine that accepts packets not addressed to it and forwards them by its routing table. In DevOps this is usually Linux with ip_forward=1.'], { scan: false }),
  C('net.route-table', L.routing, ['таблица маршрутов', 'routing table'], ['Список правил, в каждом из которых сказано, куда направлять пакеты, через кого и через какой интерфейс. По этому списку ядро решает судьбу каждого пакета, а показывает его команда ip route.', 'A list of “where to — via whom — through which interface” by which the kernel decides every packet’s fate. Shown by ip route.'], {
    forms: { ru: ['таблицы маршрутов', 'таблице маршрутов', 'таблицу маршрутов', 'таблицей маршрутов'], en: ['routing tables'] },
    docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip route' },
  }),
  C('net.gateway', L.routing, ['шлюз по умолчанию', 'default gateway'], ['Маршрутизатор, которому машина отдаёт все пакеты, для которых нет более точного маршрута; в таблице маршрутов он записан строкой default.', 'The router a host hands everything to for which there is no more specific route (the default line).'], { scan: false }),
  C('net.lpm', L.routing, ['самый длинный префикс', 'longest prefix match'], ['Правило выбора маршрута: из подходящих строк побеждает та, у которой префикс длиннее. Префикс /24 точнее префикса /16, а строка default соответствует префиксу /0.', 'The rule for choosing a route: of the matching lines the one with the longest prefix wins (/24 is more specific than /16; default is /0).'], {
    forms: { ru: ['самого длинного префикса', 'самому длинному префиксу', 'longest prefix match'], en: [] },
  }),
  C('net.ttl', L.routing, ['TTL', 'TTL'], ['Time to live, то есть счётчик в IP-заголовке. Каждый маршрутизатор уменьшает его на 1, а когда он доходит до нуля, пакет выбрасывается. В DNS так же называется срок, на который запись можно сохранить в кэше.', 'Time to live: a counter in the IP header. Every router decrements it by 1; at zero the packet is dropped. In DNS the same name means how long a record may be cached.']),
  C('net.icmp', L.routing, ['ICMP', 'ICMP'], ['Служебный протокол сети. Им передаются эхо-запрос и эхо-ответ для ping, сообщение «время жизни истекло» для traceroute и сообщения о недостижимости.', 'The network’s service protocol: echo request and reply (ping), “time exceeded” (traceroute), “unreachable”.'], { docRef: { url: 'https://www.rfc-editor.org/rfc/rfc792', label: 'RFC 792' } }),

  // ── transport ──
  C('net.port', L.transport, ['порт', 'port'], ['Число от 0 до 65535 в заголовке TCP или UDP, по которому ядро выбирает программу на машине; например, порт 22 занимает SSH, а 443 занимает HTTPS.', 'A number 0–65535 in the TCP or UDP header by which the kernel picks the program on a machine: 22 is SSH, 443 is HTTPS.'], { scan: false }),
  C('net.udp', L.transport, ['UDP', 'UDP'], ['Транспорт по принципу «отправил и забыл»: датаграммы передаются без соединения, подтверждений и повторов. По UDP работают DNS, DHCP, видео и QUIC.', 'A “send and forget” transport: datagrams with no connection, acknowledgements or retransmission. DNS, DHCP, video, QUIC.'], { scan: false }),
  C('net.tcp', L.transport, ['TCP', 'TCP'], ['Транспорт с соединением, который нумерует байты, подтверждает принятое, повторяет потерянное и отдаёт программе поток данных по порядку.', 'A connection transport: it numbers bytes, acknowledges what arrived, retransmits what was lost and delivers the stream in order.'], { scan: false }),
  C('net.handshake', L.transport, ['тройное рукопожатие', 'three-way handshake'], ['Начало соединения TCP из трёх пакетов, SYN, SYN-ACK и ACK, на которое уходит один путь туда и обратно.', 'The start of a TCP connection: SYN, SYN-ACK, ACK — one round trip.'], {
    forms: { ru: ['рукопожатие', 'рукопожатия', 'рукопожатием', 'рукопожатии', 'рукопожатий'], en: ['handshake', 'handshakes'] },
  }),
  C('net.ephemeral', L.transport, ['эфемерный порт', 'ephemeral port'], ['Временный порт клиента, который ядро выбирает само при подключении; в Linux он берётся из диапазона 32768–60999.', 'A client’s temporary port the kernel picks by itself when connecting (32768–60999 in Linux).'], {
    forms: { ru: ['эфемерного порта', 'эфемерные порты', 'эфемерных портов'], en: ['ephemeral ports'] },
  }),

  // ── envelopes ──
  C('net.encapsulation', L.envelopes, ['инкапсуляция', 'encapsulation'], ['Каждый слой кладёт данные верхнего слоя в свой конверт с заголовком: HTTP вкладывается в TCP, TCP в IP, а IP в кадр Ethernet.', 'Each layer puts the data of the one above into its own “envelope” with a header: HTTP into TCP, TCP into IP, IP into an Ethernet frame.'], {
    forms: { ru: ['инкапсуляции', 'инкапсуляцию', 'инкапсулирует'], en: ['encapsulates', 'encapsulated'] },
  }),
  C('net.mtu', L.envelopes, ['MTU', 'MTU'], ['Наибольший размер пакета, который пропускает канал; в Ethernet он равен 1500 байт. Пакет большего размера режут на фрагменты или отвергают.', 'The largest packet a link carries: 1500 bytes on Ethernet. Larger ones are fragmented or rejected.'], { scan: false }),
  C('net.osi', L.envelopes, ['модель OSI', 'OSI model'], ['Семь уровней, от L1 до L7, которыми пользуются как словарём: «проблема на L3» означает проблему с адресами и маршрутами, а балансировщик L7 читает HTTP. Модель TCP/IP описывает те же слои четырьмя уровнями.', 'Seven layers (L1–L7) as a vocabulary: “an L3 problem” means addresses and routes, “an L7 load balancer” sees HTTP. The TCP/IP model is the same layers in four.'], {
    forms: { ru: ['OSI', 'модели OSI'], en: ['OSI'] },
  }),

  // ── DNS ──
  C('net.dns', L.dns, ['DNS', 'DNS'], ['Распределённая система имён, которая превращает имена в адреса и другие записи. Она устроена как иерархия зон, спускающаяся от корня.', 'The distributed naming system: it turns names into addresses and other records. A hierarchy of zones from the root down.'], { scan: false }),
  C('net.resolver', L.dns, ['рекурсивный резолвер', 'recursive resolver'], ['Сервер, который ищет ответ за клиента: он обходит иерархию DNS от корня и кэширует ответы. Таким сервером работает, например, резолвер провайдера или 1.1.1.1.', 'A server that finds the answer for the client: it walks the hierarchy from the root and caches the answers (the provider’s resolver, 1.1.1.1).'], {
    forms: { ru: ['рекурсивного резолвера', 'рекурсивный', 'рекурсивному резолверу', 'рекурсивные резолверы'], en: ['recursive resolvers', 'recursive'] },
  }),
  C('net.authoritative', L.dns, ['авторитативный сервер', 'authoritative server'], ['Сервер, на котором хранится сама зона и ответу которого верят; в его ответе стоит флаг aa.', 'The server that holds the zone itself and whose answer is trusted (the aa flag).'], {
    forms: { ru: ['авторитативного сервера', 'авторитативный', 'авторитативному', 'авторитативные', 'авторитативным'], en: ['authoritative servers', 'authoritative'] },
  }),
  C('net.rr', L.dns, ['ресурсная запись', 'resource record'], ['Строка зоны DNS, в которой записаны имя, TTL, тип записи (A, AAAA, CNAME, MX, NS, TXT) и значение.', 'A line of a zone: name, TTL, type (A, AAAA, CNAME, MX, NS, TXT) and value.'], {
    forms: { ru: ['ресурсные записи', 'ресурсной записи'], en: ['resource records'] },
  }),
  C('net.anycast', L.dns, ['anycast', 'anycast'], ['Один и тот же адрес объявлен из многих мест сразу, и BGP приводит каждого клиента к ближайшему экземпляру сервера. Так работают корневые серверы DNS и CDN.', 'One address is announced from many places at once and BGP brings everyone to the nearest instance. This is how root DNS servers and CDNs work.']),

  // ── DHCP ──
  C('net.dhcp', L.dhcp, ['DHCP', 'DHCP'], ['Протокол, по которому подключившаяся машина получает адрес, маску, шлюз и сервер DNS. Обмен состоит из четырёх сообщений: Discover, Offer, Request и Ack.', 'The protocol that gives a joining machine an address, a mask, a gateway and a DNS server: Discover, Offer, Request, Ack.'], { scan: false, docRef: { url: 'https://www.rfc-editor.org/rfc/rfc2131', label: 'RFC 2131' } }),
  C('net.lease', L.dhcp, ['аренда адреса', 'address lease'], ['Срок, на который сервер DHCP выдал адрес. Клиент просит продлить аренду, когда проходит половина срока.', 'The time for which the DHCP server gave out the address; the client renews it at half that time.'], {
    forms: { ru: ['аренды адреса', 'аренду адреса'], en: ['address leases'] },
  }),
  C('net.link-local', L.dhcp, ['link-local', 'link-local'], ['Адрес вида 169.254.x.x, который машина назначает себе сама, когда сервер DHCP не ответил. С таким адресом можно обмениваться пакетами только с соседями по кабелю.', 'A 169.254.x.x address a machine assigns itself when the DHCP server did not answer. It works only with neighbours on the same cable.']),

  // ── NAT ──
  C('net.nat', L.nat, ['NAT', 'NAT'], ['Подмена адресов в пакетах на маршрутизаторе: адреса отправителя на выходе (SNAT, MASQUERADE) или адреса назначения на входе (DNAT).', 'Rewriting addresses in packets on a router: the source on the way out (SNAT, MASQUERADE) or the destination on the way in (DNAT).'], { scan: false, docRef: { page: 'man/iptables.8', anchor: 'TABLES' } }),
  C('net.conntrack', L.nat, ['conntrack', 'conntrack'], ['Таблица соединений в ядре Linux. По ней NAT возвращает ответы нужной машине, а фильтр отличает новое соединение от ответа на соединение, которое машина открыла сама.', 'The connection table in the Linux kernel: NAT rewrites replies back through it, and the filter tells a new connection from a reply to one of ours.']),
  C('net.netfilter', L.nat, ['netfilter', 'netfilter'], ['Подсистема ядра Linux, через которую проходит каждый пакет. В ней есть таблицы filter и nat и цепочки INPUT, FORWARD, OUTPUT, PREROUTING и POSTROUTING, а управляют ею командой iptables или nft.', 'The Linux kernel subsystem every packet passes through: the filter and nat tables, the INPUT, FORWARD, OUTPUT, PREROUTING and POSTROUTING chains. The iptables (or nft) command.'], { docRef: { page: 'man/iptables.8', anchor: 'TABLES' } }),
  C('net.dnat', L.nat, ['проброс порта', 'port forwarding'], ['Правило DNAT, по которому роутер заменяет адрес назначения входящих соединений адресом внутреннего сервера, например 203.0.113.10:80 на 10.0.2.20:8080.', 'DNAT: the router rewrites the destination of incoming connections to an inside server (203.0.113.10:80 → 10.0.2.20:8080).'], {
    forms: { ru: ['проброса порта', 'пробросом порта', 'проброс портов', 'DNAT'], en: ['DNAT'] },
  }),

  // ── the network by hand on real Linux ──
  C('net.vlan', L.linuxLab, ['VLAN', 'VLAN'], ['Виртуальная локальная сеть: коммутатор делит порты на группы, и кадры из одной группы в другую не попадают. На транке кадры несут метку 802.1Q с номером VLAN.', 'A virtual local network: the switch divides its ports into groups, and frames from one group never reach another. On a trunk, frames carry an 802.1Q tag with the VLAN number.'], {
    forms: { ru: ['VLAN-интерфейс', 'VLAN-интерфейсы', 'VLAN-интерфейса'], en: ['VLANs'] },
    docRef: { page: 'man/ip-link.8', anchor: 'VLAN' },
  }),
  C('net.bridge', L.linuxLab, ['мост', 'bridge'], ['Программный коммутатор внутри ядра Linux. Его порты, то есть подключённые к нему интерфейсы, образуют одну сеть второго уровня, и он запоминает MAC-адреса так же, как настоящий коммутатор.', 'A software switch inside the Linux kernel: its ports (interfaces) form one layer-2 network, and it learns MAC addresses like a hardware switch.'], { scan: false, docRef: { page: 'man/bridge.8', anchor: 'FDB' } }),
  C('net.veth', L.linuxLab, ['пара veth', 'veth pair'], ['Виртуальный кабель из двух интерфейсов: всё, что вошло в один конец, выходит из другого. С его помощью пространство имён подключают к сети машины.', 'A virtual cable of two interfaces: what goes into one end comes out of the other. This is how a namespace is connected to the machine’s network.'], {
    forms: { ru: ['пары veth', 'парой veth', 'пару veth'], en: ['veth pairs'] },
    docRef: { page: 'man/ip-link.8', anchor: 'VETH' },
  }),

  // ── HTTP ──
  C('net.http', L.http, ['HTTP', 'HTTP'], ['Текстовый протокол веба поверх TCP. Запрос состоит из строки запроса, заголовков, пустой строки и тела, а ответ из строки статуса, заголовков и тела.', 'The web’s text protocol over TCP: a request line, headers, an empty line, a body; the answer is a status line, headers, a body.'], { scan: false }),
  C('net.status', L.http, ['код статуса', 'status code'], ['Три цифры в первой строке ответа. Коды 2xx означают успех, 3xx отправляют по другому адресу, 4xx сообщают об ошибке клиента, а 5xx об ошибке сервера.', 'Three digits in the first line of the answer: 2xx success, 3xx go there, 4xx a client error, 5xx a server error.'], {
    forms: { ru: ['кода статуса', 'коды статуса', 'кодом статуса'], en: ['status codes'] },
  }),
  C('net.host-header', L.http, ['заголовок Host', 'Host header'], ['Заголовок запроса с именем сайта. На одном IP-адресе работают сотни сайтов, и сервер выбирает нужный по этому заголовку.', 'The site name in the request. Hundreds of sites live on one IP address — the server picks the right one by Host.'], {
    forms: { ru: ['заголовка Host', 'заголовку Host', 'заголовком Host'], en: [] },
  }),
  C('net.keepalive', L.http, ['keep-alive', 'keep-alive'], ['Повторное использование одного соединения TCP для нескольких запросов, при котором не нужно новое рукопожатие.', 'Reusing one TCP connection for several requests: without a new handshake.']),

  // ── TLS ──
  C('net.tls', L.tls, ['TLS', 'TLS'], ['Протокол шифрования и проверки подлинности поверх TCP. HTTPS устроен как обычный HTTP, который передаётся внутри TLS.', 'The encryption and authentication protocol over TCP; HTTPS is HTTP inside TLS.'], { scan: false, docRef: { url: 'https://www.rfc-editor.org/rfc/rfc8446', label: 'RFC 8446' } }),
  C('net.cert', L.tls, ['сертификат', 'certificate'], ['Открытый ключ сервера вместе с его именем и сроком действия, подписанные тем, кому доверяет клиент.', 'The server’s public key together with its name and validity dates, signed by someone the client trusts.'], { scan: false }),
  C('net.ca', L.tls, ['удостоверяющий центр', 'certificate authority'], ['Организация, которая подписывает сертификаты. Её корневой сертификат заранее лежит в системе, в каталоге /etc/ssl/certs.', 'An organisation that signs certificates. Its root certificate is already on the system (/etc/ssl/certs).'], {
    forms: { ru: ['удостоверяющего центра', 'удостоверяющим центром', 'удостоверяющие центры', 'удостоверяющему центру'], en: ['certificate authorities'] },
  }),
  C('net.sni', L.tls, ['SNI', 'SNI'], ['Server Name Indication, то есть имя сайта в открытой части приветствия ClientHello. По нему сервер выбирает сертификат, и это имя видит любой на пути.', 'Server Name Indication: the site name in the clear part of ClientHello. The server picks the certificate by it — and anyone on the path can see it.']),

  // ── proxies ──
  C('net.reverse-proxy', L.proxy, ['обратный прокси', 'reverse proxy'], ['Сервер перед приложениями, обычно nginx, который принимает запросы клиентов и пересылает их серверам приложения.', 'A server in front of applications (nginx) that accepts client requests and passes them to backends.'], {
    forms: { ru: ['обратного прокси', 'обратным прокси', 'обратному прокси', 'обратные прокси'], en: ['reverse proxies'] },
  }),
  C('net.upstream', L.proxy, ['upstream', 'upstream'], ['Сервер приложения, которому прокси пересылает запрос; в nginx группа таких серверов описывается блоком upstream.', 'The backend a proxy passes a request to; in nginx, a group of servers in an upstream block.'], { scan: false }),
  C('net.lb', L.proxy, ['балансировщик нагрузки', 'load balancer'], ['Прокси, который распределяет запросы между несколькими серверами приложения. Балансировщик L4 видит адреса и порты, а балансировщик L7 читает HTTP.', 'A proxy that spreads requests across several backends: L4 sees addresses and ports, L7 sees HTTP.'], { scan: false }),
  C('net.cdn', L.proxy, ['CDN', 'CDN'], ['Сеть доставки контента, то есть копии страниц и файлов на серверах рядом с пользователями.', 'A content delivery network: copies of pages and files on servers near the users.']),

  // ── VPN ──
  C('net.vpn', L.vpn, ['VPN', 'VPN'], ['Виртуальная частная сеть: шифрованный туннель, в котором пакеты одной сети целиком вкладываются в пакеты, идущие через интернет, так что удалённая машина становится частью этой сети.', 'A virtual private network: an encrypted tunnel in which the packets of one network are put whole into packets that cross the internet, so that a remote machine becomes part of that network.'], {
    scan: false,
    docRef: { url: 'https://www.wireguard.com/#conceptual-overview', label: 'WireGuard · conceptual overview' },
  }),

  // ── troubleshooting ──
  C('net.layers-method', L.trouble, ['поиск неисправности по уровням', 'layer-by-layer troubleshooting'], ['Порядок поиска неисправности, в котором первым делом выясняют, на каком уровне сломалась работа. Каждый шаг подтверждают командой и меняют только одну вещь за раз.', 'The method: the first question in a failure is which layer broke; every step is confirmed with a command, one change at a time.'], {
    forms: { ru: ['поиска неисправности по уровням'], en: [] },
  }),
];
