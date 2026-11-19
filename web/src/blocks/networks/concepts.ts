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
  trouble: 'networks.troubleshooting',
};

export const concepts: Concept[] = [
  // ── the internet ──
  C('net.as', L.internet, ['автономная система', 'autonomous system'], ['Сеть под одним управлением со своим номером (ASN) и своими блоками адресов. Интернет — тысячи таких сетей, договорившихся между собой.', 'A network under one administration with its own number (ASN) and its own address blocks. The internet is tens of thousands of such networks that have agreed with each other.'], {
    forms: { ru: ['автономной системы', 'автономные системы', 'автономных систем', 'автономную систему', 'автономной системе', 'автономными системами', 'автономным системам'], en: ['autonomous systems'] },
    docRef: { url: 'https://www.cloudflare.com/learning/network-layer/what-is-an-autonomous-system/', label: 'Cloudflare Learning · What is an AS' },
  }),
  C('net.bgp', L.internet, ['BGP', 'BGP'], ['Протокол, по которому автономные системы сообщают соседям, какие адреса доступны через них. Из этих анонсов складываются маршруты интернета.', 'The protocol by which autonomous systems tell their neighbours which addresses are reachable through them. The routes of the internet are made of these announcements.'], { docRef: { url: 'https://www.rfc-editor.org/rfc/rfc4271', label: 'RFC 4271' } }),
  C('net.ixp', L.internet, ['точка обмена трафиком', 'internet exchange point'], ['Место (по сути большой коммутатор), где десятки сетей подключаются друг к другу и обмениваются трафиком напрямую.', 'A place (in essence a large switch) where dozens of networks connect to one another and exchange traffic directly.'], {
    forms: { ru: ['точки обмена трафиком', 'точку обмена трафиком', 'точках обмена трафиком', 'IXP'], en: ['internet exchange points', 'IXP'] },
  }),
  C('net.latency', L.internet, ['задержка распространения', 'propagation delay'], ['Время, за которое сигнал проходит расстояние: в оптоволокне около 5 мкс на километр. Её нельзя уменьшить, только сократить путь.', 'The time a signal needs to cover a distance: about 5 µs per kilometre in fibre. It cannot be reduced, only the path can be shortened.'], {
    forms: { ru: ['задержки распространения', 'задержку распространения', 'задержкой распространения'], en: [] },
  }),
  C('net.rtt', L.internet, ['RTT', 'RTT'], ['Round-trip time: время «туда и обратно» — от отправки пакета до прихода ответа.', 'Round-trip time: the time from sending a packet until the answer arrives.']),

  // ── frames and MAC ──
  C('net.nic', L.frames, ['сетевая карта', 'network card'], ['Устройство (или виртуальное устройство), через которое машина отправляет и принимает кадры. В Linux — интерфейс eth0, wlan0.', 'The device (or virtual device) through which a machine sends and receives frames. In Linux, an interface such as eth0 or wlan0.'], { scan: false }),
  C('net.mac', L.frames, ['MAC-адрес', 'MAC address'], ['48-битный адрес сетевой карты (02:42:ac:11:00:0a). Действует только внутри одной локальной сети.', 'The 48-bit address of a network card (02:42:ac:11:00:0a). It is meaningful only inside one local network.'], { scan: false, docRef: { page: 'man/ip.8', anchor: 'EXAMPLES' } }),
  C('net.frame', L.frames, ['кадр', 'frame'], ['Порция данных в локальной сети: MAC получателя, MAC отправителя, тип содержимого, данные, контрольная сумма.', 'A piece of data on a local network: the receiver’s MAC, the sender’s MAC, the content type, the data, a checksum.'], { scan: false }),
  C('net.switch', L.frames, ['коммутатор', 'switch'], ['Устройство, соединяющее кабели одной локальной сети. Запоминает, за каким портом какой MAC, и пересылает кадры по адресу; неизвестное рассылает во все порты.', 'A device that joins the cables of one local network. It remembers which MAC is behind which port and forwards frames to it; anything unknown goes out of every port.'], { scan: false }),
  C('net.broadcast', L.frames, ['широковещательный кадр', 'broadcast frame'], ['Кадр на адрес ff:ff:ff:ff:ff:ff — его получают все в локальной сети.', 'A frame to the address ff:ff:ff:ff:ff:ff — everyone on the local network receives it.'], {
    forms: { ru: ['широковещательного кадра', 'широковещательные кадры', 'широковещательный', 'широковещательно', 'широковещательная'], en: ['broadcast frames'] },
  }),

  // ── IP and subnets ──
  C('net.ip', L.subnets, ['IP-адрес', 'IP address'], ['Адрес машины по месту в сети: 32 бита, записанные четырьмя числами (192.168.1.10). Часть «сеть» говорит, где машина, часть «хост» — какая она там.', 'A machine’s address by its place in the network: 32 bits written as four numbers (192.168.1.10). The “network” part says where the machine is, the “host” part which one it is there.'], { scan: false }),
  C('net.cidr', L.subnets, ['префикс CIDR', 'CIDR prefix'], ['Запись «/24» после адреса: сколько старших бит адреса — номер сети. То же, что маска 255.255.255.0.', 'The “/24” after an address: how many leading bits of the address are the network number. The same as the mask 255.255.255.0.'], {
    forms: { ru: ['CIDR', 'префикса CIDR'], en: ['CIDR'] },
    docRef: { url: 'https://www.rfc-editor.org/rfc/rfc4632', label: 'RFC 4632' },
  }),
  C('net.subnet', L.subnets, ['подсеть', 'subnet'], ['Все адреса с одинаковой сетевой частью: 192.168.1.0/24 — это 192.168.1.0…192.168.1.255. Внутри подсети машины говорят напрямую.', 'All addresses with the same network part: 192.168.1.0/24 is 192.168.1.0…192.168.1.255. Inside a subnet machines talk directly.'], {
    forms: { ru: ['подсети', 'подсетей', 'подсетью', 'подсетях', 'подсетям'], en: ['subnets', 'subnetting'] },
  }),
  C('net.private', L.subnets, ['частный адрес', 'private address'], ['Адрес из 10.0.0.0/8, 172.16.0.0/12 или 192.168.0.0/16 (RFC 1918). Используется внутри сетей и в интернете не маршрутизируется.', 'An address from 10.0.0.0/8, 172.16.0.0/12 or 192.168.0.0/16 (RFC 1918). Used inside networks and not routed on the internet.'], {
    forms: { ru: ['частные адреса', 'частного адреса', 'частных адресов', 'частным адресом'], en: ['private addresses'] },
  }),

  // ── ARP ──
  C('net.arp', L.arp, ['ARP', 'ARP'], ['Протокол «у кого этот IP-адрес?»: широковещательный вопрос в локальной сети, ответ одного — его MAC.', 'The “who has this IP address?” protocol: a broadcast question on the local network, an answer from one — its MAC.'], { docRef: { url: 'https://www.rfc-editor.org/rfc/rfc826', label: 'RFC 826' } }),
  C('net.arp-cache', L.arp, ['ARP-кэш', 'ARP cache'], ['Таблица «IP → MAC» в ядре, команда ip neigh. Записи живут, пока ими пользуются.', 'The “IP → MAC” table in the kernel, shown by ip neigh. Entries live while they are used.'], { docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip neigh' } }),

  // ── routing and ICMP ──
  C('net.router', L.routing, ['маршрутизатор', 'router'], ['Машина, которая принимает пакеты, адресованные не ей, и пересылает их дальше по своей таблице маршрутов. В мире DevOps это обычно Linux с ip_forward=1.', 'A machine that accepts packets not addressed to it and forwards them by its routing table. In DevOps this is usually Linux with ip_forward=1.'], { scan: false }),
  C('net.route-table', L.routing, ['таблица маршрутов', 'routing table'], ['Список «куда — через кого — через какой интерфейс», по которому ядро решает судьбу каждого пакета. Команда ip route.', 'A list of “where to — via whom — through which interface” by which the kernel decides every packet’s fate. Shown by ip route.'], {
    forms: { ru: ['таблицы маршрутов', 'таблице маршрутов', 'таблицу маршрутов', 'таблицей маршрутов'], en: ['routing tables'] },
    docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip route' },
  }),
  C('net.gateway', L.routing, ['шлюз по умолчанию', 'default gateway'], ['Маршрутизатор, которому хост отдаёт всё, для чего нет более точного маршрута (строка default).', 'The router a host hands everything to for which there is no more specific route (the default line).'], { scan: false }),
  C('net.lpm', L.routing, ['самый длинный префикс', 'longest prefix match'], ['Правило выбора маршрута: из подходящих строк побеждает та, чей префикс длиннее (/24 точнее /16, default — /0).', 'The rule for choosing a route: of the matching lines the one with the longest prefix wins (/24 is more specific than /16; default is /0).'], {
    forms: { ru: ['самого длинного префикса', 'самому длинному префиксу', 'longest prefix match'], en: [] },
  }),
  C('net.ttl', L.routing, ['TTL', 'TTL'], ['Time to live: счётчик в IP-заголовке. Каждый маршрутизатор уменьшает его на 1; на нуле пакет выбрасывается. В DNS так же называется срок хранения записи в кэше.', 'Time to live: a counter in the IP header. Every router decrements it by 1; at zero the packet is dropped. In DNS the same name means how long a record may be cached.']),
  C('net.icmp', L.routing, ['ICMP', 'ICMP'], ['Служебный протокол сети: эхо-запрос и ответ (ping), «время жизни истекло» (traceroute), «недостижимо».', 'The network’s service protocol: echo request and reply (ping), “time exceeded” (traceroute), “unreachable”.'], { docRef: { url: 'https://www.rfc-editor.org/rfc/rfc792', label: 'RFC 792' } }),

  // ── transport ──
  C('net.port', L.transport, ['порт', 'port'], ['Номер 0–65535 в заголовке TCP или UDP, по которому ядро выбирает программу на машине: 22 — SSH, 443 — HTTPS.', 'A number 0–65535 in the TCP or UDP header by which the kernel picks the program on a machine: 22 is SSH, 443 is HTTPS.'], { scan: false }),
  C('net.udp', L.transport, ['UDP', 'UDP'], ['Транспорт «отправил и забыл»: датаграммы без соединения, подтверждений и повторов. DNS, DHCP, видео, QUIC.', 'A “send and forget” transport: datagrams with no connection, acknowledgements or retransmission. DNS, DHCP, video, QUIC.'], { scan: false }),
  C('net.tcp', L.transport, ['TCP', 'TCP'], ['Транспорт с соединением: нумерует байты, подтверждает принятое, повторяет потерянное, отдаёт поток по порядку.', 'A connection transport: it numbers bytes, acknowledges what arrived, retransmits what was lost and delivers the stream in order.'], { scan: false }),
  C('net.handshake', L.transport, ['тройное рукопожатие', 'three-way handshake'], ['Начало TCP-соединения: SYN, SYN-ACK, ACK — один круг туда-обратно.', 'The start of a TCP connection: SYN, SYN-ACK, ACK — one round trip.'], {
    forms: { ru: ['рукопожатие', 'рукопожатия', 'рукопожатием', 'рукопожатии', 'рукопожатий'], en: ['handshake', 'handshakes'] },
  }),
  C('net.ephemeral', L.transport, ['эфемерный порт', 'ephemeral port'], ['Временный порт клиента, который ядро выбирает само при подключении (в Linux 32768–60999).', 'A client’s temporary port the kernel picks by itself when connecting (32768–60999 in Linux).'], {
    forms: { ru: ['эфемерного порта', 'эфемерные порты', 'эфемерных портов'], en: ['ephemeral ports'] },
  }),

  // ── envelopes ──
  C('net.encapsulation', L.envelopes, ['инкапсуляция', 'encapsulation'], ['Каждый слой кладёт данные верхнего в свой «конверт» с заголовком: HTTP в TCP, TCP в IP, IP в кадр Ethernet.', 'Each layer puts the data of the one above into its own “envelope” with a header: HTTP into TCP, TCP into IP, IP into an Ethernet frame.'], {
    forms: { ru: ['инкапсуляции', 'инкапсуляцию', 'инкапсулирует'], en: ['encapsulates', 'encapsulated'] },
  }),
  C('net.mtu', L.envelopes, ['MTU', 'MTU'], ['Наибольший размер пакета, который пропускает канал: в Ethernet 1500 байт. Больше — режут на фрагменты или отвергают.', 'The largest packet a link carries: 1500 bytes on Ethernet. Larger ones are fragmented or rejected.'], { scan: false }),
  C('net.osi', L.envelopes, ['модель OSI', 'OSI model'], ['Семь уровней (L1–L7) как словарь: «проблема на L3» — адреса и маршруты, «L7-балансировщик» видит HTTP. Модель TCP/IP — те же слои в четырёх.', 'Seven layers (L1–L7) as a vocabulary: “an L3 problem” means addresses and routes, “an L7 load balancer” sees HTTP. The TCP/IP model is the same layers in four.'], {
    forms: { ru: ['OSI', 'модели OSI'], en: ['OSI'] },
  }),

  // ── DNS ──
  C('net.dns', L.dns, ['DNS', 'DNS'], ['Распределённая система имён: превращает имена в адреса и другие записи. Иерархия зон от корня вниз.', 'The distributed naming system: it turns names into addresses and other records. A hierarchy of zones from the root down.'], { scan: false }),
  C('net.resolver', L.dns, ['рекурсивный резолвер', 'recursive resolver'], ['Сервер, который ищет ответ за клиента: обходит иерархию от корня и кэширует ответы (резолвер провайдера, 1.1.1.1).', 'A server that finds the answer for the client: it walks the hierarchy from the root and caches the answers (the provider’s resolver, 1.1.1.1).'], {
    forms: { ru: ['рекурсивного резолвера', 'рекурсивный', 'рекурсивному резолверу', 'рекурсивные резолверы'], en: ['recursive resolvers', 'recursive'] },
  }),
  C('net.authoritative', L.dns, ['авторитативный сервер', 'authoritative server'], ['Сервер, у которого лежит сама зона и чьему ответу верят (флаг aa).', 'The server that holds the zone itself and whose answer is trusted (the aa flag).'], {
    forms: { ru: ['авторитативного сервера', 'авторитативный', 'авторитативному', 'авторитативные', 'авторитативным'], en: ['authoritative servers', 'authoritative'] },
  }),
  C('net.rr', L.dns, ['ресурсная запись', 'resource record'], ['Строка зоны: имя, TTL, тип (A, AAAA, CNAME, MX, NS, TXT) и значение.', 'A line of a zone: name, TTL, type (A, AAAA, CNAME, MX, NS, TXT) and value.'], {
    forms: { ru: ['ресурсные записи', 'ресурсной записи'], en: ['resource records'] },
  }),
  C('net.anycast', L.dns, ['anycast', 'anycast'], ['Один адрес объявлен из многих мест сразу, и BGP приводит каждого к ближайшему экземпляру. Так работают корневые DNS-серверы и CDN.', 'One address is announced from many places at once and BGP brings everyone to the nearest instance. This is how root DNS servers and CDNs work.']),

  // ── DHCP ──
  C('net.dhcp', L.dhcp, ['DHCP', 'DHCP'], ['Протокол выдачи адреса, маски, шлюза и DNS-сервера подключившейся машине: Discover, Offer, Request, Ack.', 'The protocol that gives a joining machine an address, a mask, a gateway and a DNS server: Discover, Offer, Request, Ack.'], { scan: false, docRef: { url: 'https://www.rfc-editor.org/rfc/rfc2131', label: 'RFC 2131' } }),
  C('net.lease', L.dhcp, ['аренда адреса', 'address lease'], ['Срок, на который DHCP-сервер выдал адрес; клиент продлевает его на половине срока.', 'The time for which the DHCP server gave out the address; the client renews it at half that time.'], {
    forms: { ru: ['аренды адреса', 'аренду адреса'], en: ['address leases'] },
  }),
  C('net.link-local', L.dhcp, ['link-local', 'link-local'], ['Адрес 169.254.x.x, который машина назначает себе сама, когда DHCP-сервер не ответил. Работает только с соседями по кабелю.', 'A 169.254.x.x address a machine assigns itself when the DHCP server did not answer. It works only with neighbours on the same cable.']),

  // ── NAT ──
  C('net.nat', L.nat, ['NAT', 'NAT'], ['Подмена адресов в пакетах на маршрутизаторе: источника на выходе (SNAT, MASQUERADE) или назначения на входе (DNAT).', 'Rewriting addresses in packets on a router: the source on the way out (SNAT, MASQUERADE) or the destination on the way in (DNAT).'], { scan: false, docRef: { page: 'man/iptables.8', anchor: 'TABLES' } }),
  C('net.conntrack', L.nat, ['conntrack', 'conntrack'], ['Таблица соединений в ядре Linux: по ней NAT переписывает ответы обратно, а фильтр отличает новое соединение от ответа на своё.', 'The connection table in the Linux kernel: NAT rewrites replies back through it, and the filter tells a new connection from a reply to one of ours.']),
  C('net.netfilter', L.nat, ['netfilter', 'netfilter'], ['Подсистема ядра Linux, через которую проходит каждый пакет: таблицы filter и nat, цепочки INPUT, FORWARD, OUTPUT, PREROUTING, POSTROUTING. Команда iptables (или nft).', 'The Linux kernel subsystem every packet passes through: the filter and nat tables, the INPUT, FORWARD, OUTPUT, PREROUTING and POSTROUTING chains. The iptables (or nft) command.'], { docRef: { page: 'man/iptables.8', anchor: 'TABLES' } }),
  C('net.dnat', L.nat, ['проброс порта', 'port forwarding'], ['DNAT: роутер переписывает адрес назначения входящих соединений на внутренний сервер (203.0.113.10:80 → 10.0.2.20:8080).', 'DNAT: the router rewrites the destination of incoming connections to an inside server (203.0.113.10:80 → 10.0.2.20:8080).'], {
    forms: { ru: ['проброса порта', 'пробросом порта', 'проброс портов', 'DNAT'], en: ['DNAT'] },
  }),

  // ── HTTP ──
  C('net.http', L.http, ['HTTP', 'HTTP'], ['Текстовый протокол веба поверх TCP: строка запроса, заголовки, пустая строка, тело; в ответ — строка статуса, заголовки, тело.', 'The web’s text protocol over TCP: a request line, headers, an empty line, a body; the answer is a status line, headers, a body.'], { scan: false }),
  C('net.status', L.http, ['код статуса', 'status code'], ['Три цифры в первой строке ответа: 2xx — успех, 3xx — иди туда, 4xx — ошибка клиента, 5xx — ошибка сервера.', 'Three digits in the first line of the answer: 2xx success, 3xx go there, 4xx a client error, 5xx a server error.'], {
    forms: { ru: ['кода статуса', 'коды статуса', 'кодом статуса'], en: ['status codes'] },
  }),
  C('net.host-header', L.http, ['заголовок Host', 'Host header'], ['Имя сайта в запросе. На одном IP-адресе живут сотни сайтов — сервер выбирает нужный по Host.', 'The site name in the request. Hundreds of sites live on one IP address — the server picks the right one by Host.'], {
    forms: { ru: ['заголовка Host', 'заголовку Host', 'заголовком Host'], en: [] },
  }),
  C('net.keepalive', L.http, ['keep-alive', 'keep-alive'], ['Повторное использование одного TCP-соединения для нескольких запросов: без нового рукопожатия.', 'Reusing one TCP connection for several requests: without a new handshake.']),

  // ── TLS ──
  C('net.tls', L.tls, ['TLS', 'TLS'], ['Протокол шифрования и проверки подлинности поверх TCP; HTTPS — это HTTP внутри TLS.', 'The encryption and authentication protocol over TCP; HTTPS is HTTP inside TLS.'], { scan: false, docRef: { url: 'https://www.rfc-editor.org/rfc/rfc8446', label: 'RFC 8446' } }),
  C('net.cert', L.tls, ['сертификат', 'certificate'], ['Открытый ключ сервера вместе с его именем и сроком, подписанные тем, кому доверяет клиент.', 'The server’s public key together with its name and validity dates, signed by someone the client trusts.'], { scan: false }),
  C('net.ca', L.tls, ['удостоверяющий центр', 'certificate authority'], ['Организация, подписывающая сертификаты. Её корневой сертификат заранее лежит в системе (/etc/ssl/certs).', 'An organisation that signs certificates. Its root certificate is already on the system (/etc/ssl/certs).'], {
    forms: { ru: ['удостоверяющего центра', 'удостоверяющим центром', 'удостоверяющие центры', 'удостоверяющему центру'], en: ['certificate authorities'] },
  }),
  C('net.sni', L.tls, ['SNI', 'SNI'], ['Server Name Indication: имя сайта в открытой части ClientHello. По нему сервер выбирает сертификат — и его видит любой на пути.', 'Server Name Indication: the site name in the clear part of ClientHello. The server picks the certificate by it — and anyone on the path can see it.']),

  // ── proxies ──
  C('net.reverse-proxy', L.proxy, ['обратный прокси', 'reverse proxy'], ['Сервер перед приложениями (nginx), который принимает запросы клиентов и пересылает их бэкендам.', 'A server in front of applications (nginx) that accepts client requests and passes them to backends.'], {
    forms: { ru: ['обратного прокси', 'обратным прокси', 'обратному прокси', 'обратные прокси'], en: ['reverse proxies'] },
  }),
  C('net.upstream', L.proxy, ['upstream', 'upstream'], ['Бэкенд, к которому прокси пересылает запрос; в nginx — группа серверов в блоке upstream.', 'The backend a proxy passes a request to; in nginx, a group of servers in an upstream block.'], { scan: false }),
  C('net.lb', L.proxy, ['балансировщик нагрузки', 'load balancer'], ['Прокси, который распределяет запросы между несколькими бэкендами: L4 видит адреса и порты, L7 — HTTP.', 'A proxy that spreads requests across several backends: L4 sees addresses and ports, L7 sees HTTP.'], { scan: false }),
  C('net.cdn', L.proxy, ['CDN', 'CDN'], ['Сеть доставки контента: копии страниц и файлов на серверах рядом с пользователями.', 'A content delivery network: copies of pages and files on servers near the users.']),

  // ── troubleshooting ──
  C('net.layers-method', L.trouble, ['траблшутинг по уровням', 'layer-by-layer troubleshooting'], ['Методика: первый вопрос при сбое — какой уровень сломался; каждый шаг подтверждается командой, меняется одно за раз.', 'The method: the first question in a failure is which layer broke; every step is confirmed with a command, one change at a time.'], {
    forms: { ru: ['траблшутинга по уровням'], en: [] },
  }),
];
