// E-ENV (03 §7.2): nested envelopes. A message gets a transport header (or
// none), an IPv4 header and an Ethernet header, step by step; every field is a
// real field with its real value and bytes, and explains itself on click; the
// hex dump highlights the bytes of the selected field. Three messages show
// three shapes of the stack: an HTTP request over TCP, a DNS question over UDP
// and a ping, which has no transport layer at all. The ladder of layers above
// the stack is the vocabulary of the two models: every rung opens what "a
// problem on this layer" means, which tool sees it and which device works
// there. Switches: OSI (7) or TCP/IP (4) names; the device on the path
// (switch, router, NAT) and what it rewrites; the payload size against the MTU
// with and without DF, and a "break it" switch that filters ICMP on the path
// (the MTU black hole), with a prediction before it is first turned on.
//
// This is a custom explainer (not a ProcessModel): the picture is a stack of
// boxes and a byte grid, not a graph.

import { clear, h } from '../../../core/dom';
import { bi, fmt, onLangChange, t, type Bi } from '../../../core/i18n';
import type { ExplainerCtx, ExplainerReg, Mounted } from '../../../core/types';
import { parseIp } from '../../../engine/sim-net/ip';

export interface Field {
  id: string;
  name: string;
  /** Offset and length in bytes inside the layer header (or the payload). */
  off: number;
  len: number;
  /** Shown value. */
  value: string;
  what: Bi;
  from: Bi;
  /** Changed by the device on the path (highlighted in "before / after"). */
  changed?: boolean;
}

export interface Layer {
  id: 'eth' | 'ip' | 'tcp' | 'udp' | 'icmp' | 'http' | 'dns';
  osi: number;
  tcpip: number;
  name: Bi;
  family: 'l2' | 'l3' | 'l4' | 'l7';
  bytes: number[];
  fields: Field[];
  /** Trailer bytes (the Ethernet FCS). */
  trailer?: number[];
  /** The innermost layer: the data the program hands to the kernel. */
  payload?: boolean;
}

export type Device = 'none' | 'switch' | 'router' | 'nat';
export type Message = 'http' | 'dns' | 'ping';

const PAYLOAD = 'GET /catalog HTTP/1.1\r\nHost: shop.example\r\n\r\n';

function u16(n: number): number[] {
  return [(n >> 8) & 255, n & 255];
}
function u32(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}
function ipBytes(s: string): number[] {
  return u32(parseIp(s));
}
function macBytes(m: string): number[] {
  return m.split(':').map((x) => parseInt(x, 16));
}
function hex(b: number[]): string {
  return b.map((x) => x.toString(16).padStart(2, '0')).join(' ');
}
const hex4 = (n: number) => `0x${n.toString(16).padStart(4, '0')}`;

/** The Internet checksum (RFC 1071): one's complement sum of 16-bit words. */
export function inetChecksum(bytes: number[]): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) sum += (bytes[i] << 8) + (bytes[i + 1] ?? 0);
  while (sum > 0xffff) sum = (sum & 0xffff) + (sum >>> 16);
  return ~sum & 0xffff;
}

export interface PacketSpec {
  srcMac: string;
  dstMac: string;
  src: string;
  dst: string;
  sport: number;
  dport: number;
  ttl: number;
  data: string;
}

const PROTO: Record<'tcp' | 'udp' | 'icmp', [number, string]> = { tcp: [6, 'TCP'], udp: [17, 'UDP'], icmp: [1, 'ICMP'] };

function ethLayer(s: PacketSpec, c: (id: string) => boolean): Layer {
  return {
    id: 'eth',
    osi: 2,
    tcpip: 1,
    name: bi('Ethernet', 'Ethernet'),
    family: 'l2',
    bytes: [...macBytes(s.dstMac), ...macBytes(s.srcMac), 0x08, 0x00],
    trailer: [0, 0, 0, 0], // filled by withFcs once the whole frame is known
    fields: [
      { id: 'eth.dst', name: 'Destination MAC', off: 0, len: 6, value: s.dstMac, changed: c('eth.dst'), what: bi('MAC-адрес получателя кадра, то есть следующего устройства на этом участке. Пакет направляется на другой край интернета, но кадр адресован шлюзу, и там пакет переложат в новый кадр.', 'The MAC address of the frame’s receiver — the next device on this segment. The packet travels to the other side of the internet, but the frame is addressed to the gateway: it will be repacked into a new frame there.'), from: bi('Значение взято из ARP-кэша, в котором ядро нашло MAC-адрес шлюза; этот кэш показывает ip neigh.', 'The ARP cache: the kernel found the gateway’s MAC (ip neigh).') },
      { id: 'eth.src', name: 'Source MAC', off: 6, len: 6, value: s.srcMac, changed: c('eth.src'), what: bi('MAC-адрес сетевой карты, которая отправила кадр.', 'The MAC address of the network card that sent the frame.'), from: bi('Адрес записан в самой сетевой карте, и его показывает ip link show eth0.', 'Stored in the card (ip link show eth0).') },
      { id: 'eth.type', name: 'EtherType', off: 12, len: 2, value: '0x0800 (IPv4)', what: bi('Число говорит, что лежит внутри кадра: 0x0800 означает IPv4, 0x0806 означает ARP, а 0x86DD означает IPv6. По этому числу получатель знает, кому отдать содержимое кадра.', 'What is inside the frame: 0x0800 is IPv4, 0x0806 is ARP, 0x86DD is IPv6. By this number the receiver knows whom to hand the contents to.'), from: bi('Значение ставит ядро по типу пакета.', 'The kernel, by the packet type.') },
    ],
  };
}

function ipLayer(s: PacketSpec, proto: 'tcp' | 'udp' | 'icmp', inner: number, c: (id: string) => boolean): Layer {
  const total = 20 + inner;
  const df = proto === 'udp' ? 0x00 : 0x40;
  const ipNoSum = [0x45, 0x00, ...u16(total), ...u16(0x3c1d), df, 0x00, s.ttl, PROTO[proto][0], 0, 0, ...ipBytes(s.src), ...ipBytes(s.dst)];
  const ipSum = inetChecksum(ipNoSum);
  return {
    id: 'ip',
    osi: 3,
    tcpip: 2,
    name: bi('IPv4', 'IPv4'),
    family: 'l3',
    bytes: [...ipNoSum.slice(0, 10), ...u16(ipSum), ...ipNoSum.slice(12)],
    fields: [
      { id: 'ip.vihl', name: 'Version · IHL', off: 0, len: 1, value: t(bi('4 · 5 (20 байт)', '4 · 5 (20 bytes)')), what: bi('Версия протокола (4) и длина заголовка в 32-битных словах. Пять слов дают 20 байт, то есть заголовок без опций.', 'The protocol version (4) and the header length in 32-bit words: 5 words = 20 bytes, no options.'), from: bi('Значение ставит ядро.', 'The kernel.') },
      { id: 'ip.len', name: 'Total Length', off: 2, len: 2, value: `${total}`, what: bi('Длина всего IP-пакета, то есть заголовка IP вместе со всем, что лежит внутри. Если она больше MTU канала (1500 байт), пакет придётся разрезать на части, а если резать его запрещено, пакет выбросят.', 'The length of the whole IP packet: the IP header plus everything inside. If it exceeds the link’s MTU (1500), the packet has to be fragmented or it is rejected.'), from: bi('Значение ставит ядро по размеру данных.', 'The kernel, from the data size.') },
      df
        ? { id: 'ip.flags', name: 'Flags · DF', off: 6, len: 2, value: 'DF (Don’t Fragment)', what: bi('Флаг DF означает «не дробить». Маршрутизатор, через который пакет не проходит по размеру, не режет его, а возвращает сообщение ICMP «Fragmentation Needed» с допустимым размером. На этом построен поиск MTU пути.', 'The DF flag: “do not fragment”. A router the packet does not fit through does not cut it but returns ICMP “Fragmentation Needed” with the allowed size. That is how path MTU discovery works.'), from: bi('Ядро Linux ставит этот флаг для TCP и ping по умолчанию.', 'The Linux kernel sets it for TCP and ping by default.') }
        : { id: 'ip.flags', name: 'Flags', off: 6, len: 2, value: '0 (may fragment)', what: bi('Флаг DF снят, поэтому если датаграмма не пройдёт по размеру, маршрутизатор разрежет её на фрагменты. Маленькому вопросу DNS это не грозит, а большим ответам DNS грозит, поэтому их стараются держать меньше 1232 байт.', 'DF is clear: if the datagram does not fit, a router will cut it into fragments. A small DNS question is safe, large DNS answers are not, which is why they are kept under 1232 bytes.'), from: bi('Для небольших датаграмм UDP ядро флаг DF не ставит.', 'The kernel: DF is not set for small UDP datagrams.') },
      { id: 'ip.ttl', name: 'TTL', off: 8, len: 1, value: String(s.ttl), changed: c('ip.ttl'), what: bi('Это время жизни пакета. Каждый маршрутизатор уменьшает его на 1, а пакет с нулевым значением выбрасывается. Это защищает сеть от пакетов, бегающих по кругу, и на этом же построен traceroute.', 'Time to live: every router decrements it by 1; at zero the packet is dropped. Protection against loops — and the basis of traceroute.'), from: bi('Значение ставит ядро по параметру net.ipv4.ip_default_ttl = 64.', 'The kernel: net.ipv4.ip_default_ttl = 64.') },
      { id: 'ip.proto', name: 'Protocol', off: 9, len: 1, value: `${PROTO[proto][0]} (${PROTO[proto][1]})`, what: bi('Число говорит, что лежит внутри IP-пакета: 6 означает TCP, 17 означает UDP, а 1 означает ICMP. По этому числу ядро получателя решает, кому отдать содержимое.', 'What is inside the IP packet: 6 is TCP, 17 is UDP, 1 is ICMP. By this number the receiving kernel decides whom to hand the contents to.'), from: bi('Значение ставит ядро по типу сокета.', 'The kernel, from the socket type.') },
      { id: 'ip.sum', name: 'Header Checksum', off: 10, len: 2, value: hex4(ipSum), changed: c('ip.sum'), what: bi('Контрольная сумма заголовка IP. Её пересчитывает каждый маршрутизатор, потому что он меняет TTL.', 'The IP header checksum. Every router recomputes it — it changed the TTL, after all.'), from: bi('Сумму считает ядро, а часто сама сетевая карта.', 'The kernel (often the network card).') },
      { id: 'ip.src', name: 'Source Address', off: 12, len: 4, value: s.src, changed: c('ip.src'), what: bi('Адрес отправителя. Обычный маршрутизатор его не трогает, а роутер с NAT подменяет.', 'The sender’s address. An ordinary router leaves it alone; NAT replaces it.'), from: bi('Ядро выбрало адрес исходящего интерфейса, а какой адрес выбран, показывает ip route get.', 'The kernel picked the address of the outgoing interface (ip route get).') },
      { id: 'ip.dst', name: 'Destination Address', off: 16, len: 4, value: s.dst, what: bi('Адрес получателя. Если на пути нет NAT, он остаётся тем же от начала до конца, и по нему каждый маршрутизатор выбирает строку своей таблицы.', 'The receiver’s address — the same from the start of the path to the end (without NAT). Every router picks a line of its table by it.'), from: proto === 'udp' ? bi('Адрес резолвера взят из /etc/resolv.conf.', '/etc/resolv.conf: the resolver’s address.') : bi('Адрес взят из ответа DNS.', 'The DNS answer.') },
    ],
  };
}

/** Build the four layers of one HTTP-over-TCP-over-IPv4-over-Ethernet packet with real bytes and checksums. */
export function buildPacket(s: PacketSpec, changed: Set<string> = new Set()): Layer[] {
  const c = (id: string) => changed.has(id);
  const data = [...new TextEncoder().encode(s.data)];
  const seq = 1105024978;
  const ack = 3311402215;
  // TCP header without checksum, then the checksum over the pseudo-header (RFC 9293 §3.1).
  const tcpNoSum = [...u16(s.sport), ...u16(s.dport), ...u32(seq), ...u32(ack), 0x50, 0x18, ...u16(502), 0, 0, 0, 0];
  const pseudo = [...ipBytes(s.src), ...ipBytes(s.dst), 0, 6, ...u16(20 + data.length)];
  const tcpSum = inetChecksum([...pseudo, ...tcpNoSum, ...data]);
  const tcp = [...tcpNoSum.slice(0, 16), ...u16(tcpSum), 0, 0];
  return withFcs([
    ethLayer(s, c),
    ipLayer(s, 'tcp', tcp.length + data.length, c),
    {
      id: 'tcp',
      osi: 4,
      tcpip: 3,
      name: bi('TCP', 'TCP'),
      family: 'l4',
      bytes: tcp,
      fields: [
        { id: 'tcp.sport', name: 'Source Port', off: 0, len: 2, value: String(s.sport), changed: c('tcp.sport'), what: bi('Порт отправителя. Он временный (эфемерный): ядро выдало свободный порт из диапазона 32768–60999, когда программа вызвала connect(). По этому порту ответ находит нужную программу.', 'The sender’s port — ephemeral: the kernel gave a free one from 32768–60999 at connect(). The answer finds the right program by it.'), from: bi('Порт выбирает ядро из диапазона net.ipv4.ip_local_port_range.', 'The kernel (net.ipv4.ip_local_port_range).') },
        { id: 'tcp.dport', name: 'Destination Port', off: 2, len: 2, value: `${s.dport} (http)`, what: bi('Порт получателя говорит, к какой программе на сервере мы обращаемся: 80 означает HTTP, 443 означает HTTPS, а 22 означает SSH.', 'The receiver’s port: which program on the server we are calling. 80 is HTTP, 443 is HTTPS, 22 is SSH.'), from: bi('Порт задан схемой адреса: http:// означает порт 80.', 'The URL scheme: http:// means 80.') },
        { id: 'tcp.seq', name: 'Sequence Number', off: 4, len: 4, value: String(seq), what: bi('Номер первого байта данных в этом сегменте. По номерам получатель собирает поток в правильном порядке и замечает пропуски.', 'The number of the first data byte in this segment. This is how the receiver reassembles the stream in order and notices holes.'), from: bi('Номер ведёт ядро: это случайный начальный номер из рукопожатия плюс число уже отправленных байтов.', 'The kernel: a random initial number at the handshake plus the bytes sent.') },
        { id: 'tcp.ack', name: 'Acknowledgment Number', off: 8, len: 4, value: String(ack), what: bi('Номер следующего байта, который мы ждём от собеседника. Он подтверждает всё, что было получено до этого байта.', 'The next byte we expect from the peer: an acknowledgement of everything received before it.'), from: bi('Значение ставит ядро.', 'The kernel.') },
        { id: 'tcp.flags', name: 'Flags', off: 13, len: 1, value: 'PSH, ACK', what: bi('Флаги сегмента: SYN просит начать соединение, ACK подтверждает полученное, PSH просит сразу отдать данные программе, FIN сообщает, что отправитель закончил, а RST сбрасывает соединение.', 'The segment’s flags: SYN — start, ACK — acknowledging, PSH — hand to the application now, FIN — done, RST — reset.'), from: bi('Флаги ставит ядро.', 'The kernel.') },
        { id: 'tcp.win', name: 'Window', off: 14, len: 2, value: t(bi('502 (× 128 = 64 256 байт)', '502 (× 128 = 64256 bytes)')), what: bi('Сколько байтов отправитель этого сегмента готов принять, не дожидаясь подтверждений. Число умножается на масштаб, о котором договорились при рукопожатии (wscale 7 означает умножение на 128).', 'How many bytes the sender of this segment is ready to receive without waiting for acknowledgements. The number is multiplied by the scale from the handshake (wscale 7 = ×128).'), from: bi('Значение ставит ядро по свободному месту в буфере сокета.', 'The kernel, from the free room in the socket buffer.') },
        { id: 'tcp.sum', name: 'Checksum', off: 16, len: 2, value: hex4(tcpSum), changed: c('tcp.sum'), what: bi('Контрольная сумма TCP считается вместе с псевдозаголовком, в котором есть IP-адреса. Поэтому NAT, когда меняет адрес, пересчитывает и её.', 'The TCP checksum covers a pseudo-header that includes the IP addresses. That is why NAT, changing an address, recomputes it too.'), from: bi('Сумму считает ядро или сетевая карта.', 'The kernel (or the network card).') },
      ],
    },
    {
      id: 'http',
      osi: 7,
      tcpip: 4,
      name: bi('HTTP', 'HTTP'),
      family: 'l7',
      bytes: data,
      payload: true,
      fields: [
        { id: 'http.line', name: 'request-line', off: 0, len: 23, value: 'GET /catalog HTTP/1.1', what: bi('Строка запроса состоит из метода, пути и версии протокола. Это и есть то, что программа хотела сказать, а всё остальное составляют конверты вокруг неё.', 'The request line: the method, the path, the protocol version. This is what the program wanted to say; everything else is envelopes around it.'), from: bi('Строку пишет curl или браузер.', 'curl or the browser.') },
        { id: 'http.host', name: 'Host', off: 23, len: 20, value: 'Host: shop.example', what: bi('Заголовок Host называет имя сайта. На одном IP-адресе могут работать сотни сайтов, и сервер выбирает нужный по этому заголовку.', 'The site’s name. Hundreds of sites may live on one IP address — the server picks the right one by this header.'), from: bi('URL.', 'The URL.') },
        { id: 'http.end', name: 'CRLF', off: 43, len: 2, value: '\\r\\n', what: bi('Пустая строка означает, что заголовки закончились. Тела у запроса GET нет.', 'An empty line: the headers are over. A GET has no body.'), from: bi('curl.', 'curl.') },
      ],
    },
  ]);
}

/** A DNS question "A? shop.example" over UDP: 12 bytes of header, the name as labels, type and class. */
function dnsQuestion(): number[] {
  const name = ['shop', 'example'].flatMap((l) => [l.length, ...new TextEncoder().encode(l)]);
  return [...u16(0x3f2a), ...u16(0x0100), ...u16(1), 0, 0, 0, 0, 0, 0, ...name, 0, ...u16(1), ...u16(1)];
}

function buildDns(s: PacketSpec, changed: Set<string>): Layer[] {
  const c = (id: string) => changed.has(id);
  const data = dnsQuestion();
  const len = 8 + data.length;
  const pseudo = [...ipBytes(s.src), ...ipBytes(s.dst), 0, 17, ...u16(len)];
  const udpNoSum = [...u16(s.sport), ...u16(53), ...u16(len), 0, 0];
  const sum = inetChecksum([...pseudo, ...udpNoSum, ...data]) || 0xffff;
  const udp = [...udpNoSum.slice(0, 6), ...u16(sum)];
  return [
    ethLayer(s, c),
    ipLayer(s, 'udp', len, c),
    {
      id: 'udp',
      osi: 4,
      tcpip: 3,
      name: bi('UDP', 'UDP'),
      family: 'l4',
      bytes: udp,
      fields: [
        { id: 'udp.sport', name: 'Source Port', off: 0, len: 2, value: String(s.sport), changed: c('udp.sport'), what: bi('Временный порт резолвера на ноутбуке, на который придёт ответ. Соединения нет, и порт ждёт одну датаграмму.', 'The ephemeral port of the resolver on the laptop: the answer comes back to it. There is no connection — the port simply waits for a datagram.'), from: bi('Порт выбирает ядро, когда программа отправляет данные с несвязанного сокета.', 'The kernel, when sending from an unbound socket.') },
        { id: 'udp.dport', name: 'Destination Port', off: 2, len: 2, value: '53 (domain)', what: bi('Порт 53 принадлежит DNS. У TCP есть такой же номер 53, но порты UDP и TCP образуют разные пространства и друг другу не мешают.', '53 is the DNS port. The same number as TCP 53, but a separate port space: UDP and TCP do not interfere.'), from: bi('Номер порта задан стандартом DNS.', 'The DNS standard.') },
        { id: 'udp.len', name: 'Length', off: 4, len: 2, value: `${len}`, what: bi('Длина датаграммы вместе с заголовком: 8 байт заголовка и 30 байт вопроса. Весь заголовок UDP состоит из четырёх полей по два байта, и больше ему ничего не нужно, потому что UDP ничего не обещает.', 'The length of the datagram with its header: 8 + 30. The whole UDP header is four two-byte fields: it needs nothing more because it promises nothing.'), from: bi('Значение ставит ядро.', 'The kernel.') },
        { id: 'udp.sum', name: 'Checksum', off: 6, len: 2, value: hex4(sum), changed: c('udp.sum'), what: bi('Как и у TCP, сумма считается вместе с псевдозаголовком, где лежат IP-адреса. Номеров, подтверждений и окна здесь нет: если датаграмма потеряется, резолвер сам спросит ещё раз.', 'As with TCP, the sum covers a pseudo-header with the IP addresses. There are no numbers, acknowledgements or window: if the datagram is lost, the resolver asks again by itself.'), from: bi('Сумму считает ядро.', 'The kernel.') },
      ],
    },
    {
      id: 'dns',
      osi: 7,
      tcpip: 4,
      name: bi('DNS', 'DNS'),
      family: 'l7',
      bytes: data,
      payload: true,
      fields: [
        { id: 'dns.id', name: 'ID', off: 0, len: 2, value: '0x3f2a', what: bi('Номер вопроса. Ответ придёт с тем же номером, и так резолвер сопоставляет ответы с вопросами, ведь соединения у UDP нет.', 'The question’s number. The answer comes back with the same number: that is how the resolver matches answers to questions, since UDP has no connection.'), from: bi('Резолвер выбирает номер случайно, и это защищает от поддельных ответов.', 'The resolver picks it at random — a defence against forged answers.') },
        { id: 'dns.flags', name: 'Flags · RD', off: 2, len: 2, value: '0x0100 (RD=1)', what: bi('Флаг RD (recursion desired) означает просьбу «найди ответ за меня и сам обойди серверы». Так спрашивает каждый ноутбук, а сами резолверы спрашивают авторитативные серверы без этого флага.', 'RD — recursion desired: “find the answer for me, walk the hierarchy yourself”. Every laptop asks like this; resolvers themselves ask authoritative servers without RD.'), from: bi('Флаг ставит библиотека резолвера в glibc.', 'The resolver library (glibc).') },
        { id: 'dns.counts', name: 'QD · AN · NS · AR', off: 4, len: 8, value: '1 · 0 · 0 · 0', what: bi('Эти счётчики говорят, сколько записей лежит в каждой секции сообщения. Здесь один вопрос и пока ни одного ответа. В ответе сервер заполнит секцию ANSWER.', 'How many records each section holds: one question, no answers yet. In the reply the server fills the ANSWER section.'), from: bi('Значения ставит резолвер.', 'The resolver.') },
        { id: 'dns.qname', name: 'QNAME', off: 12, len: 14, value: '4 shop 7 example 0', what: bi('Имя записано метками: длина и буквы, снова длина и буквы, а ноль в конце обозначает корень. Точек в самом пакете нет.', 'The name is written as labels: a length and letters, a length and letters, a zero at the end — the root. There are no dots in the packet.'), from: bi('Имя взято из адреса, который набрал пользователь.', 'The name from the URL.') },
        { id: 'dns.qtype', name: 'QTYPE · QCLASS', off: 26, len: 4, value: 'A · IN', what: bi('Тип записи A означает адрес IPv4 (AAAA означает IPv6, а MX почтовый сервер). Класс IN означает интернет.', 'The record type: A is an IPv4 address (AAAA is IPv6, MX is mail). Class IN is the internet.'), from: bi('Тип A выбран потому, что программа попросила адрес IPv4.', 'The program asked for an IPv4 address.') },
      ],
    },
  ];
}

function buildPing(s: PacketSpec, changed: Set<string>): Layer[] {
  const c = (id: string) => changed.has(id);
  const ident = s.sport;
  const data = [0x41, 0x2b, 0x3c, 0x67, 0, 0, 0, 0, ...Array.from({ length: 48 }, (_, i) => 0x10 + i)];
  const noSum = [8, 0, 0, 0, ...u16(ident), ...u16(1)];
  // The ICMP checksum covers the ICMP message only: unlike TCP and UDP there is no pseudo-header.
  const sum = inetChecksum([...noSum, ...data]);
  const icmp = [8, 0, ...u16(sum), ...u16(ident), ...u16(1), ...data];
  return [
    ethLayer(s, c),
    ipLayer(s, 'icmp', icmp.length, c),
    {
      id: 'icmp',
      osi: 3,
      tcpip: 2,
      name: bi('ICMP', 'ICMP'),
      family: 'l3',
      bytes: icmp,
      payload: true,
      fields: [
        { id: 'icmp.type', name: 'Type · Code', off: 0, len: 2, value: '8 · 0 (echo request)', what: bi('Число задаёт тип сообщения: 8 означает эхо-запрос, 0 эхо-ответ, 3 сообщение «недостижимо», а 11 сообщение «время жизни истекло», на котором построен traceroute.', 'The message type: 8 is an echo request, 0 an echo reply, 3 “unreachable”, 11 “time exceeded” (traceroute is built on it).'), from: bi('ping.', 'ping.') },
        { id: 'icmp.sum', name: 'Checksum', off: 2, len: 2, value: hex4(sum), changed: c('icmp.sum'), what: bi('Сумма считается только по сообщению ICMP, без IP-адресов. NAT пересчитывает её не из-за адреса, а потому, что подменяет идентификатор.', 'The sum over the ICMP message only, without the IP addresses. NAT recomputes it not because of the address but because it replaces the identifier.'), from: bi('Сумму считает ядро.', 'The kernel.') },
        { id: 'icmp.id', name: 'Identifier', off: 4, len: 2, value: String(ident), changed: c('icmp.id'), what: bi('По этому номеру ответ находит ту программу ping, которая отправила запрос. Портов у ICMP нет, поэтому NAT пользуется этим полем вместо порта.', 'The number by which answers find their ping. ICMP has no ports, so NAT uses this field in place of a port.'), from: bi('Номер выбирает ядро для сокета ping.', 'The kernel, for the ping socket.') },
        { id: 'icmp.seq', name: 'Sequence', off: 6, len: 2, value: '1', what: bi('Номер запроса, который ping печатает как icmp_seq=1, 2, 3. Пропуск в номерах означает потерянный пакет.', 'The request number: icmp_seq=1, 2, 3 in ping’s output. A gap in the numbers is a lost packet.'), from: bi('ping.', 'ping.') },
        { id: 'icmp.data', name: 'Data', off: 8, len: 56, value: t(bi('56 байт', '56 bytes')), what: bi('Данные занимают 56 байт и содержат время отправки и заполнитель. Получатель возвращает их без изменений, и ping вычисляет задержку по времени отправки.', '56 bytes of data: the send time and filler. The receiver returns them as they are, and ping computes the delay from the timestamp.'), from: bi('Данные кладёт ping, а их размер задаёт флаг -s.', 'ping; -s sets the size.') },
      ],
    },
  ];
}

/** Build the layers of one of the three messages. */
/** CRC-32 of IEEE 802.3 (the zlib one), as the Ethernet FCS is computed. */
export function crc32(bytes: number[]): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Puts the real frame checksum into the Ethernet trailer: CRC-32 over the frame, least significant byte first on the wire. */
function withFcs(layers: Layer[]): Layer[] {
  const eth = layers.find((l) => l.id === 'eth');
  if (!eth) return layers;
  const crc = crc32(layers.flatMap((l) => l.bytes));
  eth.trailer = [crc & 255, (crc >>> 8) & 255, (crc >>> 16) & 255, crc >>> 24];
  return layers;
}

export function buildMessage(msg: Message, s: PacketSpec, changed: Set<string> = new Set()): Layer[] {
  if (msg === 'dns') return withFcs(buildDns(s, changed));
  if (msg === 'ping') return withFcs(buildPing(s, changed));
  return buildPacket(s, changed);
}

const DEVICE_LABEL: Record<Device, Bi> = {
  none: bi('никакое, потому что пакет только что вышел из ноутбука', 'none: the packet leaving the laptop'),
  switch: bi('коммутатор', 'a switch'),
  router: bi('маршрутизатор', 'a router'),
  nat: bi('роутер с NAT', 'a router with NAT'),
};

const MESSAGE_LABEL: Record<Message, Bi> = {
  http: bi('HTTP поверх TCP', 'HTTP over TCP'),
  dns: bi('DNS поверх UDP', 'DNS over UDP'),
  ping: bi('ping (ICMP)', 'ping (ICMP)'),
};

const OSI_NAMES: Record<number, Bi> = {
  1: bi('L1 физический', 'L1 physical'),
  2: bi('L2 канальный', 'L2 data link'),
  3: bi('L3 сетевой', 'L3 network'),
  4: bi('L4 транспортный', 'L4 transport'),
  5: bi('L5 сеансовый', 'L5 session'),
  6: bi('L6 представления', 'L6 presentation'),
  7: bi('L7 прикладной', 'L7 application'),
};
const TCPIP_NAMES: Record<number, Bi> = { 1: bi('канальный', 'link'), 2: bi('межсетевой', 'internet'), 3: bi('транспортный', 'transport'), 4: bi('прикладной', 'application') };
/** Which OSI layers each TCP/IP layer covers. */
const TCPIP_OF_OSI: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 4, 7: 4 };

/** The vocabulary of each OSI layer: what lives there, how a problem there sounds, how to see it, which device works there. */
export const LAYER_DICT: Record<number, { what: Bi; sounds: Bi; tool: string; device: Bi }> = {
  7: { what: bi('Здесь идут разговоры самих программ по протоколам HTTP, DNS, SSH, SMTP. К этому уровню относятся адреса страниц, заголовки, коды ответа и имена.', 'The programs’ conversations themselves: HTTP, DNS, SSH, SMTP. URLs, headers, status codes and names live here.'), sounds: bi('«404», «502 Bad Gateway», «504», NXDOMAIN, «Permission denied (publickey)».', '“404”, “502 Bad Gateway”, “504”, NXDOMAIN, “Permission denied (publickey)”.'), tool: 'curl -v · dig · ssh -v', device: bi('Здесь работают балансировщик уровня L7, обратный прокси и CDN, потому что они читают HTTP.', 'An L7 load balancer, a reverse proxy, a CDN: they read HTTP.') },
  6: { what: bi('Уровень представления отвечает за шифрование, сжатие и кодировки. Отдельного конверта для этого уровня в интернете нет, и эту работу делают TLS, gzip и само приложение.', 'The presentation of data: encryption, compression, encodings. On the internet there is no envelope of its own — this is the work of TLS, gzip and the application itself.'), sounds: bi('Сообщение «certificate has expired», нечитаемые символы вместо букв или испорченный архив gzip.', '“certificate has expired”, garbled characters instead of letters, a broken gzip.'), tool: 'openssl s_client · curl -v', device: bi('Отдельного устройства у этого уровня нет: TLS завершается на балансировщике или на сервере.', 'No device of its own: TLS ends at the load balancer or the server.') },
  5: { what: bi('Уровень сеанса отвечает за то, чтобы начать разговор, продолжить его и возобновить. Своего конверта у этого уровня тоже нет, и его работу выполняют сессии TLS, повторное использование соединения в HTTP и вход в приложение.', 'The session: start a conversation, continue it, resume it. No envelope of its own either — this is TLS sessions, HTTP keep-alive, logging in to an application.'), sounds: bi('Жалоба «каждый раз заново прошу войти» или соединение, которое рвётся после минуты простоя.', '“logs me out every time”, a connection drops after a minute of silence.'), tool: 'curl -v (Re-using existing connection)', device: bi('Отдельного устройства у этого уровня нет.', 'No device of its own.') },
  4: { what: bi('Порты и доставка данных между программами. TCP нумерует байты и подтверждает их, а UDP этого не делает.', 'Ports and delivery between programs: TCP with numbers and acknowledgements, UDP without them.'), sounds: bi('Сообщение «Connection refused» означает, что порт закрыт, а «Timeout» означает, что пакеты молча выбрасывают.', '“Connection refused” — the port is closed; “Timeout” — packets are silently dropped.'), tool: 'ss -tlnp · nc -zv', device: bi('Здесь работают межсетевой экран и балансировщик уровня L4: они видят адреса и порты, но не HTTP.', 'A firewall, an L4 load balancer: they see addresses and ports but not HTTP.') },
  3: { what: bi('IP-адреса, маршруты между сетями, TTL и служебные сообщения ICMP.', 'IP addresses and routes between networks, TTL, the ICMP service messages.'), sounds: bi('Сообщение «Network is unreachable», жалоба «запросы доходят, а ответы нет» или вывод traceroute, который обрывается звёздочками.', '“Network is unreachable”, “requests arrive, replies do not”, traceroute ends in asterisks.'), tool: 'ip route · ping · traceroute', device: bi('Здесь работает маршрутизатор, который снимает кадр, читает IP-заголовок и уменьшает TTL.', 'A router: strips the frame, reads IP, changes the TTL.') },
  2: { what: bi('Кадры и MAC-адреса внутри одного участка сети, VLAN и ARP.', 'Frames and MAC addresses within one segment, VLANs, ARP.'), sounds: bi('Сообщение «Destination Host Unreachable» от вашего же адреса, состояние FAILED в выводе ip neigh или жалоба «машина не в том VLAN».', '“Destination Host Unreachable” from your own address, FAILED in ip neigh, “the wrong VLAN”.'), tool: 'ip neigh · tcpdump -e', device: bi('Здесь работает коммутатор, который смотрит только на MAC-адрес получателя.', 'A switch: looks only at the destination MAC.') },
  1: { what: bi('Биты передаются светом в оптоволокне, напряжением в медном кабеле и радиоволнами Wi-Fi.', 'Bits in a medium: light in fibre, voltage in copper, Wi-Fi radio.'), sounds: bi('Состояние NO-CARRIER, жалоба «кабель не подключён», растущее число ошибок CRC или слабый сигнал.', '“NO-CARRIER”, “the cable is unplugged”, CRC errors grow, a weak signal.'), tool: 'ip link · ip -s link', device: bi('Здесь работают кабель, трансивер и радиочасть точки доступа.', 'A cable, a transceiver, the radio of an access point.') },
};

const BASE: PacketSpec = { srcMac: '3c:22:fb:12:34:56', dstMac: 'a0:63:91:00:00:01', src: '192.168.1.23', dst: '198.51.100.20', sport: 51234, dport: 80, ttl: 64, data: PAYLOAD };

export function specFor(device: Device, msg: Message = 'http'): { spec: PacketSpec; changed: Set<string> } {
  const base: PacketSpec = { ...BASE, dst: msg === 'dns' ? '1.1.1.1' : BASE.dst, sport: msg === 'ping' ? 7169 : BASE.sport };
  const l4 = msg === 'http' ? 'tcp' : msg === 'dns' ? 'udp' : 'icmp';
  const routed = ['eth.src', 'eth.dst', 'ip.ttl', 'ip.sum'];
  if (device === 'router') return { spec: { ...base, srcMac: 'a0:63:91:00:00:02', dstMac: '00:1b:21:3a:4f:01', ttl: 63 }, changed: new Set(routed) };
  if (device === 'nat') {
    const port = l4 === 'icmp' ? ['icmp.id', 'icmp.sum'] : [`${l4}.sport`, `${l4}.sum`];
    return { spec: { ...base, srcMac: 'a0:63:91:00:00:02', dstMac: '00:1b:21:3a:4f:01', ttl: 63, src: '203.0.113.7', sport: 40001 }, changed: new Set([...routed, 'ip.src', ...port]) };
  }
  return { spec: base, changed: new Set() };
}

/** MTU arithmetic of the last screen: fragments with DF=0, an ICMP error with DF=1, silence when ICMP is filtered. */
export function mtuOutcome(dataBytes: number, df: boolean, mtu = 1500, icmpFiltered = false): { total: number; fits: boolean; fragments: number; icmp: boolean; blackhole: boolean } {
  const total = 20 + 20 + dataBytes;
  if (total <= mtu) return { total, fits: true, fragments: 1, icmp: false, blackhole: false };
  if (df) return { total, fits: false, fragments: 0, icmp: !icmpFiltered, blackhole: icmpFiltered };
  const perFrag = Math.floor((mtu - 20) / 8) * 8;
  return { total, fits: false, fragments: Math.ceil((total - 20) / perFrag), icmp: false, blackhole: false };
}

const STEPS = 6; // data, +L4, +IP, +Ethernet, wire, device

const L = {
  step: {
    http: [
      bi('Программа хочет передать строку HTTP-запроса. Это данные, а всё, что появится ниже, будет конвертами вокруг них.', 'The program wants to say this: an HTTP request line. This is the data — everything below is envelopes around it.'),
      bi('Ядро кладёт данные в конверт TCP с портами, номерами байтов и флагами. Порт получателя 80 решает, какая программа на сервере эти данные получит.', 'The kernel puts the data in a TCP envelope: ports, byte numbers, flags. Destination port 80 decides which program on the server gets them.'),
    ],
    dns: [
      bi('Резолвер на ноутбуке хочет спросить, какой адрес у shop.example. Вопрос DNS занимает 30 байт: заголовок, имя и тип записи.', 'The resolver on the laptop wants to ask: “what is the address of shop.example?”. This is 30 bytes of a DNS question — a header, the name and the record type.'),
      bi('Ядро кладёт вопрос в датаграмму UDP, заголовок которой занимает 8 байт: порты, длина и контрольная сумма. Ни рукопожатия, ни номеров, ни подтверждений нет, и обмен состоит из одной датаграммы туда и одной обратно.', 'The kernel puts the question into a UDP datagram: just ports, a length and a checksum, 8 bytes. No handshake, no numbers, no acknowledgements: one datagram there, one back.'),
    ],
    ping: [
      bi('Программа ping просит ядро отправить эхо-запрос ICMP: 8 байт заголовка и 56 байт данных. Это служебное сообщение самого протокола IP, программы-получателя у него нет, и ответит ядро получателя.', 'ping asks the kernel to send an ICMP echo request: 8 bytes of header and 56 bytes of data. It is a service message of IP itself — there is no receiving program, the kernel answers.'),
      bi('Транспортного конверта у ping нет, и сообщение ICMP сразу ложится в IP. Поэтому у ping нет порта, и «пропинговать порт» нельзя: для порта нужен TCP или UDP.', 'ping has no transport envelope: the ICMP message goes straight into IP. That is why ping has no port and you cannot “ping a port” — a port needs TCP or UDP.'),
    ],
  } as Record<Message, [Bi, Bi]>,
  ip: bi('Всё это кладётся в конверт IP, где записаны адреса отправителя и получателя, TTL, длина и номер протокола внутри ({p}). По адресу получателя пакет найдёт дорогу через маршрутизаторы.', 'All this goes into an IP envelope: the source and destination addresses, TTL, the length and the number of the protocol inside ({p}). The destination address lets the packet find its way through routers.'),
  eth: bi('Пакет IP кладётся в кадр Ethernet с MAC-адресом шлюза и своим собственным. В конец кадра добавляется его контрольная сумма (FCS).', 'The IP packet goes into an Ethernet frame: the gateway’s MAC and its own. A frame checksum (FCS) is added at the end.'),
  wire: bi('В провод уходят биты: {parts} байт заголовков и {d} байт данных, всего кадр в {f} байт. Получатель снимает конверты в обратном порядке.', 'Bits go onto the wire: {parts} bytes of headers and {d} bytes of data — a frame of {f} bytes. The receiver removes the envelopes in reverse order.'),
  device: bi('Посмотрите, что с пакетом делают устройства на пути. Выберите устройство, и поля, которые оно меняет, будут подсвечены.', 'What devices on the path do to the packet. Choose a device: the changed fields are highlighted.'),
  model: bi('Названия слоёв', 'Layer names'),
  message: bi('Что отправляем', 'What we send'),
  device_: bi('Устройство на пути', 'Device on the path'),
  size: bi('Размер данных', 'Data size'),
  df: bi('DF: не дробить', 'DF: do not fragment'),
  breakIcmp: bi('Маршрутизатор на пути выбрасывает все сообщения ICMP', 'Break it: a router on the path drops ICMP'),
  prev: bi('Назад', 'Back'),
  next: bi('Дальше', 'Next'),
  from: bi('Откуда значение', 'Where the value comes from'),
  bytes: bi('Байты', 'Bytes'),
  pick: bi('Нажмите на любое поле конверта, и появится его объяснение, а в дампе ниже подсветятся его байты. Ступени слоёв над конвертами открывают словарь, который объясняет, что значит «проблема на этом уровне».', 'Click any field of an envelope — it explains itself, and its bytes light up in the dump below. The rungs of layers above the envelopes open the vocabulary: what “a problem on this layer” means.'),
  counter: bi('данных {d} байт, заголовков {h} байт ({parts})', 'data {d} bytes · headers {h} bytes ({parts})'),
  counterData: bi('данных {d} байт, заголовков пока нет', 'data {d} bytes, no headers yet'),
  mtuScene: bi('В этой модели ноутбук стоит в локальной сети, где разрешены большие кадры, а маршрутизатор на пути отправляет пакет дальше в канал с MTU 1500. Если бы узким был канал самого ноутбука, ядро отказалось бы отправлять пакет ещё до маршрутизатора, как в терминале этого урока.', 'In this model the laptop sits on a local network that allows large frames, and a router on the path sends the packet on into a link with an MTU of 1500. If the laptop’s own link were the narrow one, the kernel would refuse to send the packet before any router, as in this lesson’s terminal.'),
  fits: bi('Пакет в {t} байт не больше MTU 1500 и проходит целиком.', 'Packet {t} bytes ≤ MTU 1500: it passes whole.'),
  frag: bi('Пакет в {t} байт больше MTU 1500, а флаг DF снят, поэтому маршрутизатор режет его на {n} фрагмента, и получатель соберёт их обратно.', 'Packet {t} bytes > MTU 1500 with DF clear: the router cuts it into {n} fragments; the receiver reassembles them.'),
  icmp: bi('Пакет в {t} байт больше MTU 1500, а флаг DF стоит, поэтому маршрутизатор выбрасывает пакет и отвечает сообщением ICMP «Fragmentation Needed, mtu 1500». Отправитель уменьшит размер пакетов.', 'Packet {t} bytes > MTU 1500 with DF set: the router drops it and replies ICMP “Fragmentation Needed, mtu 1500”. The sender shrinks its packets.'),
  hole: bi('Получилась чёрная дыра MTU. Пакет в {t} байт выброшен, а сообщение ICMP «Fragmentation Needed», которое должно было предупредить отправителя, выброшено по дороге. Отправитель так и не узнаёт о меньшем MTU и повторяет тот же большой пакет. Маленькие пакеты вроде рукопожатия и коротких запросов проходят, поэтому страница зависает уже после того, как соединение установлено.', 'An MTU black hole. The {t}-byte packet is dropped, and the ICMP “Fragmentation Needed” that should have told the sender is dropped on the way. The sender never learns about the smaller MTU and keeps resending the same large packet. Small packets — the handshake, short requests — pass, which is why the page “hangs” after the connection is up.'),
  predictQ: bi('Маршрутизатор на пути выбрасывает все сообщения ICMP, а пакет больше 1500 байт, и флаг DF в нём стоит. Что станет с этим пакетом?', 'A router on the path drops all ICMP, and the packet is larger than 1500 bytes with DF set. What happens to it?'),
  predict: [
    ['frag', bi('Маршрутизатор разрежет его на фрагменты', 'It will be cut into fragments')],
    ['icmp', bi('Отправитель получит сообщение ICMP и уменьшит пакет', 'The sender gets ICMP and shrinks the packet')],
    ['hole', bi('Пакет пропадёт, а отправитель об этом не узнает', 'It vanishes, and the sender never finds out')],
  ] as [string, Bi][],
  predictOk: bi('Вы ответили верно.', 'Right.'),
  predictNo: bi('Посмотрите, что произошло на самом деле.', 'See what really happened.'),
  osi: bi('OSI (7)', 'OSI (7)'),
  tcpip: bi('TCP/IP (4)', 'TCP/IP (4)'),
  ladder: bi('Слои', 'Layers'),
  noEnv: bi('своего конверта нет', 'no envelope of its own'),
  wireTag: bi('биты в проводе', 'bits on the wire'),
  covers: bi('В модели TCP/IP это слой «{n}», который объединяет уровни OSI {l}.', 'In TCP/IP this is the “{n}” layer: it joins OSI layers {l}.'),
  coversOne: bi('В модели TCP/IP ему соответствует слой «{n}».', 'In TCP/IP it corresponds to the “{n}” layer.'),
  dictWhat: bi('Что относится к этому уровню', 'What lives here'),
  dictSounds: bi('Как звучит жалоба на проблему', 'How a problem sounds'),
  dictTool: bi('Чем посмотреть', 'How to look'),
  dictDevice: bi('Какое устройство тут работает', 'Which device works here'),
  osiNote: bi('В модели OSI есть ещё уровни L5 (сеанс) и L6 (представление). Отдельных конвертов для них в интернете нет, и эту работу выполняют само приложение и TLS. Модель служит словарём: «проблема на L3» означает проблему с адресами и маршрутами, а «балансировщик L7» означает, что балансировщик читает HTTP.', 'OSI also has L5 (session) and L6 (presentation). On the internet they have no envelopes of their own: the application and TLS do that work. The model is a vocabulary: “an L3 problem” means “addresses and routes”, “an L7 load balancer” means “it sees HTTP”.'),
  devNote: {
    none: bi('Сейчас показан пакет в том виде, в каком его отправил ноутбук.', 'The packet as the laptop sent it.'),
    switch: bi('Коммутатор открывает только кадр и смотрит на MAC-адрес получателя. В пакете ничего не меняется.', 'A switch opens only the frame and looks at the destination MAC. Nothing in the packet changes.'),
    router: bi('Маршрутизатор снимает кадр, уменьшает TTL с 64 до 63, пересчитывает контрольную сумму IP и надевает новый кадр с другими MAC-адресами. То, что лежит внутри IP, он не открывает.', 'A router removes the frame, decrements TTL 64 → 63, recomputes the IP checksum and puts on a new frame with different MACs. It does not open what lies inside IP.'),
  } as Record<Exclude<Device, 'nat'>, Bi>,
  natNote: {
    http: bi('Роутер с NAT делает то же, что маршрутизатор, и вдобавок подменяет адрес и порт отправителя: 192.168.1.23:51234 становится 203.0.113.7:40001. Он пересчитывает обе контрольные суммы, IP и TCP, и записывает соответствие в таблицу conntrack.', 'A router with NAT does what a router does and also replaces the source address and port: 192.168.1.23:51234 → 203.0.113.7:40001. It recomputes both checksums, IP and TCP, and writes the mapping into conntrack.'),
    dns: bi('NAT подменяет адрес и порт отправителя и у UDP: 192.168.1.23:51234 становится 203.0.113.7:40001. Соединения у UDP нет, поэтому запись в conntrack хранится по таймеру, около 30 секунд без ответа.', 'NAT replaces the source address and port for UDP too: 192.168.1.23:51234 → 203.0.113.7:40001. UDP has no connection, so the conntrack entry lives on a timer — about 30 seconds without an answer.'),
    ping: bi('У ICMP нет портов, поэтому NAT подменяет адрес отправителя и идентификатор эхо-запроса, а по идентификатору потом вернёт ответ нужному ноутбуку. Сумму ICMP он пересчитывает из-за идентификатора, потому что IP-адресов в ней нет.', 'ICMP has no ports, so NAT replaces the source address and the echo identifier: by it, the answer is returned to the right laptop. It recomputes the ICMP sum because of the identifier — the IP addresses are not in it.'),
  } as Record<Message, Bi>,
};

function mount(root: HTMLElement, ctx: ExplainerCtx): Mounted {
  let step = 0;
  let seen = 0;
  let model: 'osi' | 'tcpip' = 'tcpip';
  let msg: Message = 'http';
  let device: Device = 'none';
  let size = 45;
  let df = true;
  let icmpBlocked = false;
  let predicting = false;
  let predicted: string | null = null;
  let sel: string | null = null;
  let done = false;

  const wrap = h('section.explainer.env', { tabindex: 0, 'aria-label': t(bi('Конверты моделей OSI и TCP/IP', 'OSI and TCP/IP envelopes')) });
  root.append(wrap);

  const visibleOf = (layers: Layer[]) =>
    layers.filter((l) => {
      if (l.payload) return true;
      if (l.id === 'eth') return step >= 3;
      if (l.id === 'ip') return step >= 2;
      return step >= 1;
    });

  const caption = (layers: Layer[]): Bi => {
    if (step <= 1) return L.step[msg][step];
    if (step === 2) return fmt(L.ip, { p: msg === 'http' ? '6, TCP' : msg === 'dns' ? '17, UDP' : '1, ICMP' });
    if (step === 3) return L.eth;
    if (step === 4) {
      const payload = layers.find((l) => l.payload)!;
      const headers = layers.filter((l) => !l.payload);
      const hdr = headers.reduce((s, l) => s + l.bytes.length, 0);
      return fmt(L.wire, { parts: headers.map((l) => l.bytes.length).join(' + '), d: payload.bytes.length, f: hdr + payload.bytes.length });
    }
    return L.device;
  };

  const dictCard = (osi: number): HTMLElement[] => {
    const d = LAYER_DICT[osi];
    const tc = TCPIP_OF_OSI[osi];
    const members = Object.entries(TCPIP_OF_OSI).filter(([, v]) => v === tc).map(([k]) => k).join(', ');
    return [
      h('h4', {}, t(OSI_NAMES[osi])),
      h('p.env-card-from', {}, t(members.includes(',') ? fmt(L.covers, { n: t(TCPIP_NAMES[tc]), l: members }) : fmt(L.coversOne, { n: t(TCPIP_NAMES[tc]) }))),
      h('p', {}, h('strong', {}, `${t(L.dictWhat)}. `), t(d.what)),
      h('p', {}, h('strong', {}, `${t(L.dictSounds)}. `), t(d.sounds)),
      h('p', {}, h('strong', {}, `${t(L.dictTool)}: `), h('code', {}, d.tool)),
      h('p', {}, h('strong', {}, `${t(L.dictDevice)}. `), t(d.device)),
    ];
  };

  const render = () => {
    clear(wrap);
    const { spec, changed } = specFor(step >= 5 ? device : 'none', msg);
    const layers = buildMessage(msg, { ...spec, data: PAYLOAD }, changed);
    const visible = visibleOf(layers);
    const payload = layers.find((l) => l.payload)!;
    const head = h('header.ex-head', {}, h('h3', {}, t(bi('Какие конверты на самом деле уходят в провод', 'Envelopes: what really goes onto the wire'))), h('p.ex-summary', {}, t(bi('Три сообщения, запрос HTTP без TLS, вопрос DNS и ping, получают три разных набора конвертов. Шаг за шагом вокруг данных появляются заголовки, и каждое поле в них настоящее, со своими байтами.', 'Three messages — an HTTP request without TLS, a DNS question and a ping — and three different sets of envelopes. Step by step the headers appear around the data; every field is real, with its own bytes.'))));
    const segBtn = (cur: string, opts: [string, Bi][], on: (v: string) => void) =>
      h('div.segmented', { role: 'radiogroup' }, ...opts.map(([id, label]) => h('button.env-seg', { type: 'button', 'aria-pressed': String(cur === id), onclick: () => on(id) }, t(label))));
    const controls = h(
      'div.env-controls',
      {},
      h('div.env-ctl', {}, h('span.env-ctl-label', {}, t(L.message)), segBtn(msg, (['http', 'dns', 'ping'] as Message[]).map((m) => [m, MESSAGE_LABEL[m]] as [string, Bi]), (v) => { msg = v as Message; sel = null; ctx.record({ kind: 'x.net.envelopes-message', message: msg }); render(); })),
      h('div.env-ctl', {}, h('span.env-ctl-label', {}, t(L.model)), segBtn(model, [['tcpip', L.tcpip], ['osi', L.osi]], (v) => { model = v as 'osi' | 'tcpip'; render(); })),
      step >= 5 ? h('div.env-ctl', {}, h('span.env-ctl-label', {}, t(L.device_)), segBtn(device, (['none', 'switch', 'router', 'nat'] as Device[]).map((d) => [d, DEVICE_LABEL[d]] as [string, Bi]), (v) => { device = v as Device; render(); })) : null,
    );

    // The ladder: OSI 7..1 (or TCP/IP 4..1); a rung is filled when this packet has an envelope there.
    const present = new Set(visible.map((l) => l.osi));
    const rungs = model === 'osi' ? [7, 6, 5, 4, 3, 2, 1] : [4, 3, 2, 1];
    const ladder = h(
      'div.env-ladder',
      { role: 'group', 'aria-label': t(L.ladder) },
      ...rungs.map((n) => {
        const osiList = model === 'osi' ? [n] : Object.entries(TCPIP_OF_OSI).filter(([, v]) => v === n).map(([k]) => Number(k));
        const has = osiList.some((o) => present.has(o)) || (osiList.includes(1) && step >= 4);
        const fam = osiList.includes(7) ? 'l7' : osiList.includes(4) ? 'l4' : osiList.includes(3) ? 'l3' : osiList.includes(2) || osiList.includes(1) ? 'l2' : 'neutral';
        const target = model === 'osi' ? n : Math.max(...osiList.filter((o) => o !== 1 || osiList.length === 1));
        const note = model === 'osi' && (n === 5 || n === 6) ? t(L.noEnv) : model === 'osi' && n === 1 ? t(L.wireTag) : '';
        return h(
          `button.env-rung.fam-${fam}`,
          { type: 'button', class: has ? 'has' : (model === 'osi' && (n === 5 || n === 6)) ? 'ghost' : undefined, 'aria-pressed': String(sel === `layer:${target}`), onclick: () => { sel = `layer:${target}`; ctx.record({ kind: 'x.net.envelopes-layer', layer: target }); render(); } },
          h('span.env-rung-name', {}, model === 'osi' ? t(OSI_NAMES[n]) : t(TCPIP_NAMES[n])),
          note ? h('span.env-rung-note', {}, note) : null,
        );
      }),
    );

    // The stack of envelopes: the outermost first.
    const stack = h('div.env-stack');
    let inner: HTMLElement | null = null;
    for (const l of [...visible].reverse()) {
      const layerName = model === 'osi' ? t(OSI_NAMES[l.osi]) : t(TCPIP_NAMES[l.tcpip]);
      const box = h(
        `div.env-layer.fam-${l.family}`,
        {},
        h('div.env-bar', {}, h('span.env-layer-name', {}, t(l.name)), h('span.env-layer-tag', {}, layerName), h('span.env-layer-size', {}, t(fmt(bi('{n} байт', '{n} B'), { n: l.bytes.length })))),
        h(
          'div.env-fields',
          {},
          ...l.fields.map((f) =>
            h(
              'button.env-field',
              { type: 'button', 'aria-pressed': String(sel === f.id), class: f.changed ? 'changed' : undefined, onclick: () => { sel = f.id; render(); } },
              h('span.env-fname', {}, f.name),
              h('span.env-fval', {}, f.value),
            ),
          ),
        ),
      );
      if (l.trailer) box.append(h('div.env-trailer', {}, h('span.env-fname', {}, 'FCS'), h('span.env-fval', {}, hex(l.trailer))));
      if (inner) box.querySelector('.env-fields')!.after(inner);
      inner = box;
    }
    if (inner) stack.append(inner);
    if (model === 'osi') stack.append(h('p.env-note', {}, t(L.osiNote)));

    // Bytes on the wire, outermost layer first, with the selected field highlighted.
    const dump = h('div.env-dump', { 'aria-label': t(L.bytes) });
    for (const l of visible) {
      const f = l.fields.find((x) => x.id === sel);
      l.bytes.forEach((byte, i) => {
        const on = f && i >= f.off && i < f.off + f.len;
        dump.append(h(`span.env-byte.fam-${l.family}`, { class: on ? 'on' : undefined, title: `${l.id} +${i}` }, byte.toString(16).padStart(2, '0')));
      });
    }
    const eth = visible.find((l) => l.id === 'eth');
    if (eth?.trailer) for (const byte of eth.trailer) dump.append(h('span.env-byte.fam-l2.trailer', {}, byte.toString(16).padStart(2, '0')));

    const field = layers.flatMap((l) => l.fields).find((f) => f.id === sel);
    const layerSel = sel?.startsWith('layer:') ? Number(sel.slice(6)) : null;
    const side = h(
      'aside.env-card',
      { 'aria-live': 'polite' },
      field
        ? [h('h4', {}, field.name), h('p.env-card-val', {}, field.value), h('p', {}, t(field.what)), h('p.env-card-from', {}, h('strong', {}, `${t(L.from)}: `), t(field.from))]
        : layerSel
          ? dictCard(layerSel)
          : h('p.ex-hint', {}, t(L.pick)),
    );
    const own = msg === 'ping' ? 8 : 0; // the ICMP header sits inside the innermost layer
    const headers = visible.filter((l) => !l.payload);
    const sizes = [...headers.map((l) => l.bytes.length), ...(own ? [own] : [])];
    const hdr = sizes.reduce((s, n) => s + n, 0);
    const parts = sizes.join(' + ') || '0';
    const counter = h('p.env-counter', {}, hdr ? t(fmt(L.counter, { d: payload.bytes.length - own, h: hdr, parts })) : t(fmt(L.counterData, { d: payload.bytes.length - own })));
    const devNote = step >= 5 ? ` ${t(device === 'nat' ? L.natNote[msg] : L.devNote[device])}` : '';
    const cap = h('p.ex-caption', {}, t(caption(layers)), devNote);

    let mtuBox: HTMLElement | null = null;
    if (step >= 5) {
      const o = mtuOutcome(size, df, 1500, icmpBlocked);
      const line = o.fits ? fmt(L.fits, { t: o.total }) : o.blackhole ? fmt(L.hole, { t: o.total }) : o.icmp ? fmt(L.icmp, { t: o.total }) : fmt(L.frag, { t: o.total, n: o.fragments });
      const range = h('input', { type: 'range', min: 45, max: 3000, step: 1, value: size, 'aria-label': t(L.size), oninput: (e: Event) => { size = Number((e.target as HTMLInputElement).value); render(); } });
      const breakBox = h('input', {
        type: 'checkbox',
        checked: icmpBlocked,
        onchange: (e: Event) => {
          const on = (e.target as HTMLInputElement).checked;
          if (on && predicted === null) {
            predicting = true;
            (e.target as HTMLInputElement).checked = false;
          } else icmpBlocked = on;
          render();
        },
      });
      const prediction = predicting
        ? h(
            'div.env-predict',
            { role: 'group', 'aria-label': t(L.predictQ) },
            h('p', {}, h('strong', {}, t(L.predictQ))),
            ...L.predict.map(([id, text]) =>
              h('button.btn', {
                type: 'button',
                onclick: () => {
                  predicted = id;
                  predicting = false;
                  icmpBlocked = true;
                  df = true;
                  size = Math.max(size, 1560);
                  ctx.record({ kind: 'explainer.predict', explainer: 'net.envelopes', about: 'icmp-filtered', choice: id, correct: id === 'hole' });
                  render();
                },
              }, t(text)),
            ),
          )
        : predicted && icmpBlocked
          ? h(`p.env-predict-res${predicted === 'hole' ? '.ok' : ''}`, {}, t(predicted === 'hole' ? L.predictOk : L.predictNo))
          : null;
      mtuBox = h(
        'div.env-mtu',
        {},
        h('label.env-ctl', {}, h('span.env-ctl-label', {}, `${t(L.size)}: ${t(fmt(bi('{n} байт', '{n} B'), { n: size }))}`), range),
        h('label.env-check', {}, h('input', { type: 'checkbox', checked: df, onchange: (e: Event) => { df = (e.target as HTMLInputElement).checked; render(); } }), ` ${t(L.df)}`),
        h('label.env-check.env-break', {}, breakBox, ` ${t(L.breakIcmp)}`),
        prediction,
        h('p.env-mtu-scene', {}, t(L.mtuScene)),
        h(`p.env-mtu-line${o.fits ? '' : o.fragments > 1 ? '.warn' : '.err'}`, {}, t(line)),
      );
    }
    const nav = h(
      'div.env-nav',
      {},
      h('button.btn', { type: 'button', disabled: step === 0, onclick: () => go(step - 1) }, t(L.prev)),
      h('span.ex-counter', {}, `${step + 1} / ${STEPS}`),
      h('button.btn', { type: 'button', disabled: step === STEPS - 1, onclick: () => go(step + 1) }, t(L.next)),
    );
    wrap.append(head, controls, cap, h('div.env-stage', {}, h('div.env-main', {}, ladder, stack, counter, h('div.env-dumpwrap', {}, h('h4', {}, t(L.bytes)), dump)), side), mtuBox ?? '', nav);
  };

  const go = (n: number) => {
    step = Math.max(0, Math.min(STEPS - 1, n));
    seen = Math.max(seen, step);
    ctx.record({ kind: 'explainer.step', explainer: 'net.envelopes', step, total: STEPS });
    if (!done && seen === STEPS - 1) {
      done = true;
      ctx.onComplete();
    }
    render();
  };
  wrap.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') go(step + 1);
    if (e.key === 'ArrowLeft') go(step - 1);
  });
  const off = onLangChange(() => render());
  render();
  return {
    dispose() {
      off();
      wrap.remove();
    },
    describe: () => `${t(caption(buildMessage(msg, specFor('none', msg).spec)))} ${sel ?? ''}`,
  };
}

export const envelopesExplainer: ExplainerReg = {
  id: 'net.envelopes',
  title: bi('Как данные упаковываются в конверты моделей OSI и TCP/IP', 'Envelopes: the OSI and TCP/IP models'),
  block: 'networks',
  summary: bi('Каждый слой добавляет к данным свой заголовок. Сравните HTTP, DNS и ping, нажимайте на поля и ступени слоёв, переключайте модель и устройство на пути, увеличьте пакет сверх MTU и включите поломку, при которой ICMP выбрасывается.', 'Each layer adds its own header. Compare HTTP, DNS and ping, click the fields and the rungs of layers, switch the model and the device on the path, grow the packet past the MTU and break ICMP.'),
  mount,
};
