// The protocol catalogue (03 §13): uniform cards — why, layer, the exchange as
// a sequence diagram, how to observe it, how it breaks (symptom → layer →
// cause → how to prove it). Beginner, intermediate and experienced sets.

import type { Bi, Level } from '../../../core/types';
import { bi } from '../../../core/i18n';

export type LayerTag = 'L2' | 'L3' | 'L4' | 'TLS' | 'L7';

export interface ProtoCard {
  id: string;
  name: string;
  level: Level;
  layer: LayerTag;
  transport: string;
  why: Bi;
  actors: string[];
  steps: { from: number; to: number; label: string }[];
  observe: string[];
  breaks: { symptom: string; layer: LayerTag; cause: Bi; prove: string }[];
  doc: { label: string; url: string };
}

const c = (x: ProtoCard) => x;

export const PROTOCOLS: ProtoCard[] = [
  c({
    id: 'ethernet', name: 'Ethernet', level: 'beginner', layer: 'L2', transport: 'frame, EtherType, MTU 1500',
    why: bi('Доставить кадр от одной сетевой карты к другой внутри одного сегмента. Дальше своего коммутатора кадр не уходит: на каждом маршрутизаторе пакет перекладывают в новый кадр.', 'Deliver a frame from one network card to another within one segment. A frame never travels beyond its own switch: at every router the packet is moved into a new frame.'),
    actors: ['host', 'switch', 'neighbour'],
    steps: [{ from: 0, to: 1, label: 'dst 02:42:ac:11:00:14, src …:0a, type 0x0800' }, { from: 1, to: 2, label: 'MAC table: port 2' }, { from: 2, to: 1, label: 'reply frame' }, { from: 1, to: 0, label: 'MAC table: port 1' }],
    observe: ['ip link show eth0', 'tcpdump -n -e', 'bridge fdb show'],
    breaks: [
      { symptom: 'state DOWN / NO-CARRIER', layer: 'L2', cause: bi('Интерфейс выключен или кабель не воткнут: кадры не уходят вовсе.', 'The interface is down or the cable is unplugged: no frames leave at all.'), prove: 'ip link show eth0' },
      { symptom: 'RX errors and CRC grow', layer: 'L2', cause: bi('Повреждённый кабель или порт: контрольная сумма кадра (FCS) не сходится, кадр выброшен.', 'A damaged cable or port: the frame checksum (FCS) does not match and the frame is dropped.'), prove: 'ip -s link show eth0' },
    ],
    doc: { label: 'Ethernet frame (IEEE 802.3)', url: 'https://en.wikipedia.org/wiki/Ethernet_frame' },
  }),
  c({
    id: 'ipv4', name: 'IPv4', level: 'beginner', layer: 'L3', transport: 'EtherType 0x0800',
    why: bi('Доставить пакет между сетями по адресу назначения: каждый маршрутизатор выбирает самый длинный подходящий префикс своей таблицы и уменьшает TTL.', 'Deliver a packet between networks by its destination address: every router picks the longest matching prefix in its table and decrements the TTL.'),
    actors: ['host', 'router', 'router', 'server'],
    steps: [{ from: 0, to: 1, label: '10.0.1.10 → 10.20.0.5, TTL 64' }, { from: 1, to: 2, label: 'TTL 63, new frame' }, { from: 2, to: 3, label: 'TTL 62' }, { from: 3, to: 0, label: 'reply, by its own routes' }],
    observe: ['ip addr', 'ip route', 'ip route get 10.20.0.5', 'traceroute -n 10.20.0.5'],
    breaks: [
      { symptom: 'ping: connect: Network is unreachable', layer: 'L3', cause: bi('У отправителя нет маршрута к этой сети: пакет даже не создан.', 'The sender has no route to that network: the packet is not even created.'), prove: 'ip route' },
      { symptom: 'requests arrive, replies do not', layer: 'L3', cause: bi('У получателя нет маршрута обратно: маршрутизация в каждую сторону своя.', 'The receiver has no route back: routing is separate in each direction.'), prove: 'tcpdump on the receiver: requests in, nothing out' },
    ],
    doc: { label: 'RFC 791', url: 'https://www.rfc-editor.org/rfc/rfc791' },
  }),
  c({
    id: 'ipv6', name: 'IPv6', level: 'intermediate', layer: 'L3', transport: 'EtherType 0x86DD',
    why: bi('Тот же межсетевой уровень с адресами в 128 бит: адресов хватает всем без NAT, соседей ищут не ARP, а сообщениями ICMPv6 (Neighbor Discovery), а у каждого интерфейса всегда есть адрес fe80::.', 'The same internetwork layer with 128-bit addresses: there are enough for everyone without NAT, neighbours are found not by ARP but by ICMPv6 messages (Neighbor Discovery), and every interface always has an fe80:: address.'),
    actors: ['host', 'router', 'server'],
    steps: [{ from: 0, to: 1, label: 'Router Solicitation (ICMPv6)' }, { from: 1, to: 0, label: 'Router Advertisement: prefix 2001:db8:1::/64' }, { from: 0, to: 2, label: '2001:db8:1::23 → 2001:db8:5::20' }],
    observe: ['ip -6 addr', 'ip -6 route', 'ip -6 neigh', 'ping -6 2001:db8:5::20'],
    breaks: [
      { symptom: 'site slow, then works (long connect)', layer: 'L3', cause: bi('У машины есть IPv6-адрес, а пути наружу по IPv6 нет: клиент сначала пробует AAAA и ждёт, потом откатывается на IPv4.', 'The machine has an IPv6 address but no IPv6 path out: the client tries the AAAA first and waits, then falls back to IPv4.'), prove: 'curl -6 -v vs curl -4 -v' },
      { symptom: 'only fe80:: on the interface', layer: 'L3', cause: bi('Маршрутизатор не присылает Router Advertisement: глобального адреса и шлюза нет.', 'The router sends no Router Advertisement: no global address and no gateway.'), prove: 'tcpdump -n icmp6' },
    ],
    doc: { label: 'RFC 8200', url: 'https://www.rfc-editor.org/rfc/rfc8200' },
  }),
  c({
    id: 'arp', name: 'ARP', level: 'beginner', layer: 'L2', transport: 'EtherType 0x0806',
    why: bi('По IP-адресу соседа в своей подсети узнать его MAC — без него кадр не собрать.', 'Learn the MAC of a neighbour in your subnet from its IP address — a frame cannot be built without it.'),
    actors: ['host', 'all (ff:ff…)', 'neighbour'],
    steps: [{ from: 0, to: 1, label: 'who-has 192.168.1.20 tell .10' }, { from: 2, to: 0, label: 'is-at 02:42:ac:11:00:14' }],
    observe: ['ip neigh', 'tcpdump -n -e arp'],
    breaks: [
      { symptom: 'From 192.168.1.10 … Destination Host Unreachable', layer: 'L2', cause: bi('Соседа с таким адресом нет или он выключен: ARP без ответа.', 'No neighbour with that address, or it is off: ARP gets no answer.'), prove: 'ip neigh  # FAILED' },
      { symptom: 'ip neigh: lladdr changes back and forth', layer: 'L2', cause: bi('Два хоста с одним IP-адресом: отвечают оба.', 'Two hosts with the same IP address: both answer.'), prove: 'tcpdump -n -e arp' },
    ],
    doc: { label: 'RFC 826', url: 'https://www.rfc-editor.org/rfc/rfc826' },
  }),
  c({
    id: 'dhcp', name: 'DHCP', level: 'beginner', layer: 'L7', transport: 'UDP 67/68, broadcast',
    why: bi('Выдать подключившемуся адрес, маску, шлюз и DNS-сервер, когда он не знает ни себя, ни сервера.', 'Give a newcomer an address, a mask, a gateway and a DNS server when it knows neither itself nor the server.'),
    actors: ['client', 'server'],
    steps: [{ from: 0, to: 1, label: 'Discover (0.0.0.0 → 255.255.255.255)' }, { from: 1, to: 0, label: 'Offer 192.168.1.103, options 1,3,6,51' }, { from: 0, to: 1, label: 'Request' }, { from: 1, to: 0, label: 'Ack' }],
    observe: ['dhcpcd -T eth0', 'tcpdump -n port 67 or port 68'],
    breaks: [
      { symptom: 'inet 169.254.23.141/16', layer: 'L7', cause: bi('Сервер не ответил: клиент назначил себе link-local.', 'The server did not answer: the client assigned itself a link-local address.'), prove: 'tcpdump -n port 67 or port 68' },
      { symptom: 'default via 192.168.1.250 — no internet', layer: 'L3', cause: bi('Второй DHCP-сервер в сети выдал чужой шлюз.', 'A second DHCP server on the network handed out the wrong gateway.'), prove: 'tcpdump: two Offers from different servers' },
    ],
    doc: { label: 'RFC 2131', url: 'https://www.rfc-editor.org/rfc/rfc2131' },
  }),
  c({
    id: 'icmp', name: 'ICMP', level: 'beginner', layer: 'L3', transport: 'IP protocol 1',
    why: bi('Сеть сообщает об ошибках и проверяет связь: эхо (ping), «время жизни истекло» (traceroute), «недостижимо».', 'The network reports errors and checks reachability: echo (ping), “time exceeded” (traceroute), “unreachable”.'),
    actors: ['host', 'router', 'target'],
    steps: [{ from: 0, to: 2, label: 'echo request' }, { from: 2, to: 0, label: 'echo reply' }, { from: 0, to: 1, label: 'TTL=1 …' }, { from: 1, to: 0, label: 'time exceeded' }],
    observe: ['ping -c 3 10.0.2.10', 'traceroute -n 10.20.0.5', 'tcpdump -n icmp'],
    breaks: [
      { symptom: 'large packets vanish, small ones pass', layer: 'L3', cause: bi('ICMP «Fragmentation Needed» отфильтрован: отправитель не узнаёт о меньшем MTU.', 'ICMP “Fragmentation Needed” is filtered: the sender never learns about the smaller MTU.'), prove: 'ping -M do -s 1472 host  vs  -s 1372' },
      { symptom: 'traceroute: * * * after hop 2', layer: 'L3', cause: bi('Дальше нет маршрута обратно или ICMP режется.', 'Beyond it there is no route back, or ICMP is filtered.'), prove: 'ip route get <src> on the next router' },
    ],
    doc: { label: 'RFC 792', url: 'https://www.rfc-editor.org/rfc/rfc792' },
  }),
  c({
    id: 'udp', name: 'UDP', level: 'beginner', layer: 'L4', transport: 'IP protocol 17',
    why: bi('Отправить датаграмму без соединения и подтверждений: DNS, DHCP, NTP, видео, QUIC.', 'Send a datagram without a connection or acknowledgements: DNS, DHCP, NTP, video, QUIC.'),
    actors: ['client', 'server'],
    steps: [{ from: 0, to: 1, label: 'datagram :51234 → :53' }, { from: 1, to: 0, label: 'datagram :53 → :51234' }],
    observe: ['ss -ulnp', 'tcpdump -n udp'],
    breaks: [
      { symptom: ';; connection timed out; no servers could be reached', layer: 'L4', cause: bi('UDP/53 до сервера закрыт или сервер молчит: UDP не сообщает о потере.', 'UDP/53 to the server is blocked or the server is silent: UDP does not report loss.'), prove: 'tcpdump -n port 53' },
      { symptom: 'ICMP … udp port 53 unreachable', layer: 'L4', cause: bi('На порту никто не слушает.', 'Nobody listens on the port.'), prove: 'ss -ulnp on the server' },
    ],
    doc: { label: 'RFC 768', url: 'https://www.rfc-editor.org/rfc/rfc768' },
  }),
  c({
    id: 'tcp', name: 'TCP', level: 'beginner', layer: 'L4', transport: 'IP protocol 6',
    why: bi('Надёжный упорядоченный поток байтов поверх ненадёжной сети: номера, подтверждения, повторы, окно.', 'A reliable ordered byte stream over an unreliable network: numbers, acknowledgements, retransmission, a window.'),
    actors: ['client', 'server'],
    steps: [{ from: 0, to: 1, label: 'SYN' }, { from: 1, to: 0, label: 'SYN-ACK' }, { from: 0, to: 1, label: 'ACK, data' }, { from: 1, to: 0, label: 'ACK, data' }, { from: 0, to: 1, label: 'FIN' }],
    observe: ['ss -tan', "tcpdump -n 'tcp[tcpflags] & tcp-syn != 0'", 'nc -zv host 8080'],
    breaks: [
      { symptom: 'Connection refused (instant)', layer: 'L4', cause: bi('Хост жив, порт никто не слушает: RST.', 'The host is alive, nobody listens on the port: RST.'), prove: 'ss -ltnp on the server' },
      { symptom: 'Timeout, SYN-SENT', layer: 'L4', cause: bi('Пакеты молча выбрасываются (фильтр) или хост недоступен.', 'Packets are silently dropped (a filter) or the host is unreachable.'), prove: 'tcpdump: repeated SYN without an answer' },
    ],
    doc: { label: 'RFC 9293', url: 'https://www.rfc-editor.org/rfc/rfc9293' },
  }),
  c({
    id: 'dns', name: 'DNS', level: 'beginner', layer: 'L7', transport: 'UDP 53, TCP 53; DoT 853; DoH 443',
    why: bi('Превратить имя в адрес и другие записи, чтобы люди и конфиги не держали IP-адреса.', 'Turn a name into an address and other records, so that people and configs do not keep IP addresses.'),
    actors: ['client', 'resolver', 'root', 'TLD', 'auth'],
    steps: [{ from: 0, to: 1, label: 'A? shop.example (RD)' }, { from: 1, to: 2, label: 'NS? example.' }, { from: 1, to: 3, label: 'NS? shop.example.' }, { from: 1, to: 4, label: 'A? shop.example.' }, { from: 4, to: 1, label: 'A 198.51.100.20 TTL 300 (aa)' }, { from: 1, to: 0, label: 'A 198.51.100.20' }],
    observe: ['dig shop.example +trace', 'tcpdump -n port 53'],
    breaks: [
      { symptom: 'status: NXDOMAIN', layer: 'L7', cause: bi('Нет такого имени: опечатка, не та зона.', 'No such name: a typo, the wrong zone.'), prove: 'dig @auth name' },
      { symptom: 'status: SERVFAIL', layer: 'L7', cause: bi('Авторитативный сервер недоступен (или не сошлась подпись DNSSEC).', 'The authoritative server is unreachable (or DNSSEC validation failed).'), prove: 'dig +trace name' },
      { symptom: 'old address after a move', layer: 'L7', cause: bi('Старая запись живёт в кэшах резолверов до конца TTL.', 'The old record lives in resolver caches until its TTL ends.'), prove: 'dig @1.1.1.1 name  vs  dig @auth name' },
    ],
    doc: { label: 'RFC 1034', url: 'https://www.rfc-editor.org/rfc/rfc1034' },
  }),
  c({
    id: 'http', name: 'HTTP/1.1', level: 'beginner', layer: 'L7', transport: 'TCP 80',
    why: bi('Текстовый протокол запросов и ответов веба: метод, путь, заголовки, код статуса, тело.', 'The web’s text protocol of requests and answers: a method, a path, headers, a status code, a body.'),
    actors: ['client', 'server'],
    steps: [{ from: 0, to: 1, label: 'GET /catalog, Host: shop.example' }, { from: 1, to: 0, label: 'HTTP/1.1 200 OK, headers, body' }],
    observe: ['curl -v http://shop.lab/', "printf 'GET / HTTP/1.1\\r\\nHost: srv\\r\\n\\r\\n' | nc srv 8080"],
    breaks: [
      { symptom: '404 Not Found / wrong site', layer: 'L7', cause: bi('Не тот путь или не тот заголовок Host: на одном IP много сайтов.', 'The wrong path or the wrong Host header: many sites share one IP.'), prove: 'curl -v -H "Host: …"' },
      { symptom: '502 / 504 from nginx', layer: 'L7', cause: bi('Прокси не получил ответа от upstream (502) или не дождался его (504).', 'The proxy got no answer from the upstream (502) or did not wait long enough (504).'), prove: 'tail /var/log/nginx/error.log' },
    ],
    doc: { label: 'RFC 9110', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
  }),
  c({
    id: 'tls', name: 'HTTPS / TLS 1.3', level: 'beginner', layer: 'TLS', transport: 'TCP 443',
    why: bi('Зашифровать и подтвердить подлинность соединения: посторонний не читает и не подменяет данные.', 'Encrypt the connection and prove who is on the other end: an outsider can neither read nor alter the data.'),
    actors: ['client', 'server'],
    steps: [{ from: 0, to: 1, label: 'ClientHello: SNI, ALPN, key_share' }, { from: 1, to: 0, label: 'ServerHello + {Certificate, Verify, Finished}' }, { from: 0, to: 1, label: '{Finished} + {GET /}' }, { from: 1, to: 0, label: '{200 OK}' }],
    observe: ['curl -v https://shop.example/', 'openssl s_client -connect shop.example:443 -servername shop.example'],
    breaks: [
      { symptom: 'curl: (60) … certificate has expired', layer: 'TLS', cause: bi('Срок сертификата вышел (или часы клиента неверны).', 'The certificate has expired (or the client’s clock is wrong).'), prove: 'curl -vI … | grep "expire date"' },
      { symptom: 'curl: (60) … no alternative certificate subject name matches', layer: 'TLS', cause: bi('Сертификат выписан на другое имя.', 'The certificate is for another name.'), prove: 'curl -v: subject, subjectAltName' },
      { symptom: 'unable to get local issuer certificate', layer: 'TLS', cause: bi('Сервер не прислал промежуточный сертификат цепочки.', 'The server did not send the intermediate certificate of the chain.'), prove: 'openssl s_client -showcerts' },
    ],
    doc: { label: 'RFC 8446', url: 'https://www.rfc-editor.org/rfc/rfc8446' },
  }),
  c({
    id: 'ssh', name: 'SSH', level: 'beginner', layer: 'L7', transport: 'TCP 22',
    why: bi('Шифрованный вход и команды на удалённой машине. Та же логика, что у TLS, но ключ сервера проверяется по known_hosts, а не по цепочке CA.', 'Encrypted login and commands on a remote machine. The same logic as TLS, but the server key is checked against known_hosts, not a CA chain.'),
    actors: ['client', 'sshd'],
    steps: [{ from: 1, to: 0, label: 'SSH-2.0-OpenSSH_10.0' }, { from: 0, to: 1, label: 'KEXINIT, key exchange' }, { from: 1, to: 0, label: 'host key + signature' }, { from: 0, to: 1, label: 'auth: publickey' }, { from: 1, to: 0, label: 'channel open' }],
    observe: ['ssh -v user@host', 'nc host 22  # the banner'],
    breaks: [
      { symptom: 'Host key verification failed.', layer: 'L7', cause: bi('Ключ сервера не совпал с known_hosts: переустановили сервер — или вас перехватывают.', 'The server key does not match known_hosts: the server was reinstalled — or someone is intercepting you.'), prove: 'ssh-keygen -F host' },
      { symptom: 'Permission denied (publickey).', layer: 'L7', cause: bi('Ключа нет в authorized_keys или права на ~/.ssh слишком широкие.', 'The key is not in authorized_keys, or ~/.ssh permissions are too open.'), prove: 'ssh -v; journalctl -u ssh on the server' },
    ],
    doc: { label: 'RFC 4253', url: 'https://www.rfc-editor.org/rfc/rfc4253' },
  }),
  c({
    id: 'ntp', name: 'NTP', level: 'intermediate', layer: 'L7', transport: 'UDP 123',
    why: bi('Синхронизировать часы: от них зависят сертификаты, журналы, токены, базы данных.', 'Synchronise clocks: certificates, logs, tokens and databases depend on them.'),
    actors: ['client', 'server'],
    steps: [{ from: 0, to: 1, label: 'request (t1)' }, { from: 1, to: 0, label: 'response (t2, t3), received at t4' }],
    observe: ['chronyc tracking', 'timedatectl'],
    breaks: [
      { symptom: 'certificate is not yet valid', layer: 'TLS', cause: bi('Часы клиента отстают: сертификат «из будущего».', 'The client’s clock is behind: the certificate is “from the future”.'), prove: 'date; chronyc tracking' },
      { symptom: 'logs out of order across servers', layer: 'L7', cause: bi('Часы серверов разошлись.', 'The servers’ clocks drifted apart.'), prove: 'chronyc sources' },
    ],
    doc: { label: 'RFC 5905', url: 'https://www.rfc-editor.org/rfc/rfc5905' },
  }),
  c({
    id: 'smtp', name: 'SMTP', level: 'intermediate', layer: 'L7', transport: 'TCP 25, 587, 465',
    why: bi('Доставить почту между серверами; адрес сервера получателя ищется в записи MX.', 'Deliver mail between servers; the receiving server is found through the MX record.'),
    actors: ['sender MTA', 'receiver MX'],
    steps: [{ from: 1, to: 0, label: '220 mail.shop.example ESMTP' }, { from: 0, to: 1, label: 'EHLO, MAIL FROM, RCPT TO' }, { from: 0, to: 1, label: 'DATA …' }, { from: 1, to: 0, label: '250 OK queued' }],
    observe: ['dig shop.example MX', 'nc mail.shop.example 25'],
    breaks: [
      { symptom: 'connection timed out to port 25', layer: 'L4', cause: bi('Облака закрывают исходящий 25 против спама.', 'Clouds block outgoing port 25 against spam.'), prove: 'nc -zv -w 3 mx 25' },
      { symptom: 'mail rejected: SPF fail', layer: 'L7', cause: bi('Нет или неверна TXT-запись SPF.', 'The SPF TXT record is missing or wrong.'), prove: 'dig shop.example TXT' },
    ],
    doc: { label: 'RFC 5321', url: 'https://www.rfc-editor.org/rfc/rfc5321' },
  }),
  c({
    id: 'h2', name: 'HTTP/2', level: 'intermediate', layer: 'L7', transport: 'TLS + ALPN h2',
    why: bi('Те же запросы HTTP, но бинарными кадрами и многими потоками в одном соединении.', 'The same HTTP requests, but as binary frames and many streams over one connection.'),
    actors: ['client', 'server'],
    steps: [{ from: 0, to: 1, label: 'ClientHello ALPN h2' }, { from: 0, to: 1, label: 'HEADERS :method GET :path / (stream 1)' }, { from: 0, to: 1, label: 'HEADERS (stream 3)' }, { from: 1, to: 0, label: 'DATA (1), DATA (3) interleaved' }],
    observe: ['curl --http2 -v https://shop.example/'],
    breaks: [
      { symptom: 'one lost TCP segment stalls every stream', layer: 'L4', cause: bi('Блокировка головы очереди на уровне TCP: потоки разные, соединение одно.', 'Head-of-line blocking at the TCP level: many streams, one connection.'), prove: 'ss -ti: retrans' },
      { symptom: 'proxy speaks HTTP/1.1 to the upstream', layer: 'L7', cause: bi('Мультиплексирование кончается на прокси.', 'Multiplexing ends at the proxy.'), prove: 'nginx: proxy_http_version' },
    ],
    doc: { label: 'RFC 9113', url: 'https://www.rfc-editor.org/rfc/rfc9113' },
  }),
  c({
    id: 'h3', name: 'HTTP/3', level: 'intermediate', layer: 'L7', transport: 'QUIC over UDP 443',
    why: bi('Те же методы, заголовки и коды HTTP, но поверх QUIC: транспорт и TLS 1.3 договариваются за один круг, а потеря пакета тормозит только свой поток. О поддержке браузер узнаёт из заголовка Alt-Svc или DNS-записи HTTPS и в следующий раз идёт по UDP.', 'The same HTTP methods, headers and codes, but over QUIC: the transport and TLS 1.3 agree in one round trip, and a lost packet stalls only its own stream. The browser learns of support from the Alt-Svc header or the HTTPS DNS record and goes over UDP next time.'),
    actors: ['client', 'server'],
    steps: [{ from: 0, to: 1, label: 'Initial (ClientHello)' }, { from: 1, to: 0, label: 'Initial + Handshake' }, { from: 0, to: 1, label: '1-RTT: request' }, { from: 1, to: 0, label: 'response' }],
    observe: ['curl --http3 -v https://…  (if built with HTTP/3)', 'curl -sI … | grep -i alt-svc'],
    breaks: [
      { symptom: 'falls back to h2', layer: 'L4', cause: bi('UDP/443 закрыт по пути: браузер тихо откатывается на TCP.', 'UDP/443 is blocked on the path: the browser quietly falls back to TCP.'), prove: 'tcpdump -n udp port 443' },
      { symptom: 'connection breaks behind NAT after idle', layer: 'L3', cause: bi('Запись UDP в conntrack устарела быстрее, чем живёт сеанс QUIC.', 'The UDP conntrack entry expired sooner than the QUIC session.'), prove: 'conntrack -L -p udp' },
    ],
    doc: { label: 'RFC 9000', url: 'https://www.rfc-editor.org/rfc/rfc9000' },
  }),
  c({
    id: 'quic', name: 'QUIC', level: 'intermediate', layer: 'L4', transport: 'UDP 443',
    why: bi('Транспорт, который делает работу TCP — номера, подтверждения, повторы, управление скоростью — поверх UDP и сразу шифрует всё, кроме пары полей заголовка. Потоки независимы: потеря в одном не останавливает другие. Соединение опознаётся по Connection ID, а не по адресу и порту, поэтому переживает смену сети.', 'A transport that does TCP’s work — numbering, acknowledgements, retransmission, congestion control — over UDP and encrypts everything except a few header fields from the start. Streams are independent: a loss in one does not stop the others. A connection is identified by its Connection ID, not by address and port, so it survives a change of network.'),
    actors: ['client', 'NAT', 'server'],
    steps: [{ from: 0, to: 2, label: 'Initial: CRYPTO(ClientHello), DCID' }, { from: 2, to: 0, label: 'Initial + Handshake: ServerHello, cert' }, { from: 0, to: 2, label: 'Handshake done, 1-RTT data' }, { from: 1, to: 2, label: 'new source port, same Connection ID' }],
    observe: ['tcpdump -n udp port 443', 'ss -uanp', 'conntrack -L -p udp --dport 443'],
    breaks: [
      { symptom: 'QUIC never used, always TCP', layer: 'L4', cause: bi('Сеть по пути пропускает только TCP 443, а UDP 443 режет: клиент тихо остаётся на TCP.', 'The network on the way passes only TCP 443 and drops UDP 443: the client quietly stays on TCP.'), prove: 'tcpdump -n udp port 443: Initial without an answer' },
      { symptom: 'packets lost above ~1200 bytes', layer: 'L3', cause: bi('QUIC требует, чтобы путь пропускал датаграммы не меньше 1200 байт; туннель с маленьким MTU их режет.', 'QUIC requires the path to carry datagrams of at least 1200 bytes; a tunnel with a small MTU cuts them.'), prove: 'ping -M do -s 1172 host' },
    ],
    doc: { label: 'RFC 9000', url: 'https://www.rfc-editor.org/rfc/rfc9000' },
  }),
  c({
    id: 'ws', name: 'WebSocket', level: 'intermediate', layer: 'L7', transport: 'HTTP/1.1 Upgrade',
    why: bi('Двусторонний канал для чатов и событий: начинается как HTTP-запрос и «переключается».', 'A two-way channel for chats and events: it starts as an HTTP request and “switches”.'),
    actors: ['client', 'proxy', 'server'],
    steps: [{ from: 0, to: 2, label: 'GET /ws, Upgrade: websocket' }, { from: 2, to: 0, label: '101 Switching Protocols' }, { from: 0, to: 2, label: 'frames ⇄' }],
    observe: ["curl -i -H 'Connection: Upgrade' -H 'Upgrade: websocket' …"],
    breaks: [
      { symptom: '400 / connection closed at once', layer: 'L7', cause: bi('Прокси не передаёт Upgrade и Connection (в nginx нужны proxy_http_version 1.1 и proxy_set_header).', 'The proxy does not pass Upgrade and Connection (nginx needs proxy_http_version 1.1 and proxy_set_header).'), prove: 'nginx -T | grep -i upgrade' },
      { symptom: 'drops after 60 s of silence', layer: 'L7', cause: bi('proxy_read_timeout закрывает тихий канал.', 'proxy_read_timeout closes a silent channel.'), prove: 'error.log' },
    ],
    doc: { label: 'RFC 6455', url: 'https://www.rfc-editor.org/rfc/rfc6455' },
  }),
  c({
    id: 'grpc', name: 'gRPC', level: 'intermediate', layer: 'L7', transport: 'HTTP/2',
    why: bi('Вызовы между сервисами: каждый вызов — поток HTTP/2 с content-type application/grpc, статус в трейлерах.', 'Calls between services: each call is an HTTP/2 stream with content-type application/grpc; the status is in trailers.'),
    actors: ['client', 'server'],
    steps: [{ from: 0, to: 1, label: 'HEADERS :path /shop.Catalog/List' }, { from: 0, to: 1, label: 'DATA (protobuf)' }, { from: 1, to: 0, label: 'DATA + trailers grpc-status: 0' }],
    observe: ['grpcurl -plaintext host:50051 list'],
    breaks: [
      { symptom: 'all load on one backend', layer: 'L4', cause: bi('L4-балансировщик держит одно долгое h2-соединение: все вызовы в нём.', 'An L4 balancer keeps one long h2 connection: every call rides in it.'), prove: 'per-backend metrics' },
      { symptom: 'grpc-status 14 UNAVAILABLE', layer: 'L4', cause: bi('До сервера не подключиться.', 'The server cannot be reached.'), prove: 'nc -zv host 50051' },
    ],
    doc: { label: 'grpc.io · HTTP/2 protocol', url: 'https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md' },
  }),
  c({
    id: 'vlan', name: 'VLAN 802.1Q', level: 'intermediate', layer: 'L2', transport: '4-byte tag, VID 12 bits',
    why: bi('Разделить один коммутатор на несколько независимых сетей: метка в кадре говорит, к какой он относится.', 'Split one switch into several independent networks: a tag in the frame says which one it belongs to.'),
    actors: ['host', 'switch (access)', 'switch (trunk)'],
    steps: [{ from: 0, to: 1, label: 'frame (untagged)' }, { from: 1, to: 2, label: 'frame + tag VID 10' }],
    observe: ['ip link add link eth0 name eth0.10 type vlan id 10', 'tcpdump -n -e vlan'],
    breaks: [
      { symptom: 'ARP without an answer', layer: 'L2', cause: bi('Не тот VID: хосты в разных VLAN не видят друг друга.', 'The wrong VID: hosts in different VLANs do not see each other.'), prove: 'tcpdump -e: vlan id' },
      { symptom: 'big packets lost on a trunk', layer: 'L2', cause: bi('Метка добавляет 4 байта к кадру.', 'The tag adds 4 bytes to the frame.'), prove: 'ip -d link' },
    ],
    doc: { label: 'IEEE 802.1Q (Wikipedia)', url: 'https://en.wikipedia.org/wiki/IEEE_802.1Q' },
  }),
  c({
    id: 'nat', name: 'NAT / PAT', level: 'intermediate', layer: 'L3', transport: 'L3/L4 rewrite + conntrack',
    why: bi('Выпустить частную сеть в интернет через один публичный адрес (SNAT) или пустить снаружи внутрь (DNAT).', 'Let a private network out through one public address (SNAT) or let the outside in (DNAT).'),
    actors: ['inside host', 'NAT router', 'server'],
    steps: [{ from: 0, to: 1, label: '192.168.1.23:51234 → :443' }, { from: 1, to: 2, label: '203.0.113.7:40001 → :443' }, { from: 2, to: 1, label: '→ 203.0.113.7:40001' }, { from: 1, to: 0, label: '→ 192.168.1.23:51234' }],
    observe: ['conntrack -L', 'iptables -t nat -L -n -v'],
    breaks: [
      { symptom: 'no internet from the inside network', layer: 'L3', cause: bi('Нет MASQUERADE или выключен ip_forward.', 'No MASQUERADE, or ip_forward is off.'), prove: 'sysctl net.ipv4.ip_forward; iptables -t nat -S' },
      { symptom: 'new connections fail under load', layer: 'L4', cause: bi('Кончились порты SNAT на один адрес назначения.', 'SNAT ports to one destination ran out.'), prove: 'conntrack -L | wc -l' },
    ],
    doc: { label: 'RFC 3022', url: 'https://www.rfc-editor.org/rfc/rfc3022' },
  }),
  c({
    id: 'bgp', name: 'BGP', level: 'experienced', layer: 'L7', transport: 'TCP 179, steers L3',
    why: bi('Автономные системы сообщают друг другу, какие префиксы через них доступны; из этого складываются маршруты интернета.', 'Autonomous systems tell each other which prefixes are reachable through them; the routes of the internet are made of that.'),
    actors: ['AS 64500', 'AS 64501'],
    steps: [{ from: 0, to: 1, label: 'OPEN (AS, hold time)' }, { from: 1, to: 0, label: 'UPDATE 198.51.100.0/24, AS_PATH 64501' }, { from: 0, to: 1, label: 'KEEPALIVE …' }],
    observe: ['https://bgp.tools', 'traceroute + whois -h whois.radb.net <ip>'],
    breaks: [
      { symptom: 'traffic goes to the wrong network', layer: 'L3', cause: bi('Утечка или угон маршрута: чужой анонс приняли соседи.', 'A route leak or hijack: neighbours accepted someone else’s announcement.'), prove: 'looking glass: AS_PATH of the prefix' },
      { symptom: 'prefix gone from the internet', layer: 'L3', cause: bi('BGP-сессия упала — анонсы отозваны.', 'The BGP session dropped — the announcements were withdrawn.'), prove: 'bgp.tools prefix page' },
    ],
    doc: { label: 'RFC 4271', url: 'https://www.rfc-editor.org/rfc/rfc4271' },
  }),
  c({
    id: 'vxlan', name: 'VXLAN', level: 'experienced', layer: 'L2', transport: 'L2 in UDP 4789 (Linux default 8472)',
    why: bi('Сделать из машин в разных подсетях один L2-сегмент: кадр целиком едет внутри UDP. Так CNI в туннельном режиме соединяет поды разных узлов.', 'Make machines in different subnets one L2 segment: the whole frame rides inside UDP. This is how a CNI in tunnel mode joins pods on different nodes.'),
    actors: ['node1 vxlan0', 'node2 vxlan0'],
    steps: [{ from: 0, to: 1, label: 'Eth|IP|UDP 4789|VXLAN VNI 42|inner frame' }],
    observe: ['ip -d link show vxlan0', 'tcpdump -ni eth0 udp port 4789'],
    breaks: [
      { symptom: 'overlay silent, nodes ping each other', layer: 'L4', cause: bi('UDP 4789 закрыт между узлами: внешний конверт не проходит.', 'UDP 4789 is blocked between nodes: the outer envelope does not pass.'), prove: 'tcpdump on both nodes' },
      { symptom: 'small packets pass, large vanish', layer: 'L3', cause: bi('MTU: VXLAN поверх IPv4 съедает 50 байт — внутри нужен MTU 1450.', 'MTU: VXLAN over IPv4 eats 50 bytes — 1450 is needed inside.'), prove: 'ping -M do -s 1422 / 1472' },
    ],
    doc: { label: 'RFC 7348', url: 'https://www.rfc-editor.org/rfc/rfc7348' },
  }),
  c({
    id: 'wg', name: 'WireGuard', level: 'experienced', layer: 'L3', transport: 'UDP, 51820 by convention',
    why: bi('Шифрованный туннель: целый IP-пакет внутри UDP. AllowedIPs — одновременно таблица маршрутов и фильтр источника.', 'An encrypted tunnel: a whole IP packet inside UDP. AllowedIPs is both a routing table and a source filter.'),
    actors: ['peer A', 'peer B'],
    steps: [{ from: 0, to: 1, label: 'handshake initiation (type 1)' }, { from: 1, to: 0, label: 'handshake response (type 2)' }, { from: 0, to: 1, label: 'transport data (type 4)' }],
    observe: ['wg show', 'tcpdump -n udp port 51820'],
    breaks: [
      { symptom: 'latest handshake: none', layer: 'L4', cause: bi('UDP до endpoint не доходит или перепутаны ключи.', 'UDP does not reach the endpoint, or the keys are mixed up.'), prove: 'wg show; tcpdump on the endpoint' },
      { symptom: 'clients connected, no internet', layer: 'L3', cause: bi('На сервере нет MASQUERADE или ip_forward=0.', 'No MASQUERADE on the server, or ip_forward=0.'), prove: 'iptables -t nat -L -n -v' },
    ],
    doc: { label: 'WireGuard whitepaper', url: 'https://www.wireguard.com/papers/wireguard.pdf' },
  }),
  c({
    id: 'mtls', name: 'mTLS', level: 'experienced', layer: 'TLS', transport: 'TLS with a client certificate',
    why: bi('Подлинность проверяется в обе стороны: сервер требует сертификат и у клиента. Основа service mesh.', 'Authenticity is checked both ways: the server requires a certificate from the client too. The basis of a service mesh.'),
    actors: ['client', 'server'],
    steps: [{ from: 0, to: 1, label: 'ClientHello' }, { from: 1, to: 0, label: 'ServerHello, {CertificateRequest, Certificate}' }, { from: 0, to: 1, label: '{Certificate, CertificateVerify, Finished}' }],
    observe: ['curl --cert client.crt --key client.key https://…', 'openssl s_client -cert … -key …'],
    breaks: [
      { symptom: 'alert certificate required', layer: 'TLS', cause: bi('Клиент не предъявил сертификат.', 'The client presented no certificate.'), prove: 'curl -v' },
      { symptom: 'alert unknown ca', layer: 'TLS', cause: bi('Сертификат клиента выписан не тем CA.', 'The client certificate was issued by the wrong CA.'), prove: 'openssl x509 -noout -issuer -in client.crt' },
    ],
    doc: { label: 'RFC 8446 §4.3.2', url: 'https://www.rfc-editor.org/rfc/rfc8446#section-4.3.2' },
  }),
];
