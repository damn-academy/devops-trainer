// E-ENV (03 §7.2): nested envelopes. An HTTP request gets a TCP header, an
// IPv4 header and an Ethernet header, step by step; every field is a real
// field with its real value and bytes, and explains itself on click; the hex
// dump highlights the bytes of the selected field. Switches: OSI (7) or
// TCP/IP (4) names; the device on the path (switch, router, NAT) and what it
// rewrites; the payload size against the MTU with and without DF.
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
  id: 'eth' | 'ip' | 'tcp' | 'http';
  osi: number;
  tcpip: number;
  name: Bi;
  family: 'l2' | 'l3' | 'l4' | 'l7';
  bytes: number[];
  fields: Field[];
  /** Trailer bytes (the Ethernet FCS). */
  trailer?: number[];
}

export type Device = 'none' | 'switch' | 'router' | 'nat';

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

/** Build the four layers of one HTTP-over-TCP-over-IPv4-over-Ethernet packet with real bytes and checksums. */
export function buildPacket(s: PacketSpec, changed: Set<string> = new Set()): Layer[] {
  const data = [...new TextEncoder().encode(s.data)];
  const seq = 1105024978;
  const ack = 3311402215;
  // TCP header without checksum, then the checksum over the pseudo-header (RFC 9293 §3.1).
  const tcpNoSum = [...u16(s.sport), ...u16(s.dport), ...u32(seq), ...u32(ack), 0x50, 0x18, ...u16(502), 0, 0, 0, 0];
  const pseudo = [...ipBytes(s.src), ...ipBytes(s.dst), 0, 6, ...u16(20 + data.length)];
  const tcpSum = inetChecksum([...pseudo, ...tcpNoSum, ...data]);
  const tcp = [...tcpNoSum.slice(0, 16), ...u16(tcpSum), 0, 0];
  const total = 20 + tcp.length + data.length;
  const ipNoSum = [0x45, 0x00, ...u16(total), ...u16(0x3c1d), 0x40, 0x00, s.ttl, 6, 0, 0, ...ipBytes(s.src), ...ipBytes(s.dst)];
  const ipSum = inetChecksum(ipNoSum);
  const ip = [...ipNoSum.slice(0, 10), ...u16(ipSum), ...ipNoSum.slice(12)];
  const eth = [...macBytes(s.dstMac), ...macBytes(s.srcMac), 0x08, 0x00];
  const c = (id: string) => changed.has(id);
  return [
    {
      id: 'eth',
      osi: 2,
      tcpip: 1,
      name: bi('Ethernet', 'Ethernet'),
      family: 'l2',
      bytes: eth,
      trailer: [0x5e, 0x2a, 0x91, 0x0c],
      fields: [
        { id: 'eth.dst', name: 'Destination MAC', off: 0, len: 6, value: s.dstMac, changed: c('eth.dst'), what: bi('MAC-адрес получателя кадра — следующего устройства на этом участке. Пакет едет на другой край интернета, но кадр адресован шлюзу: дальше его переложат в новый кадр.', 'The MAC address of the frame’s receiver — the next device on this segment. The packet travels to the other side of the internet, but the frame is addressed to the gateway: it will be repacked into a new frame there.'), from: bi('ARP-кэш: ядро нашло MAC шлюза (ip neigh).', 'The ARP cache: the kernel found the gateway’s MAC (ip neigh).') },
        { id: 'eth.src', name: 'Source MAC', off: 6, len: 6, value: s.srcMac, changed: c('eth.src'), what: bi('MAC-адрес сетевой карты, которая отправила кадр.', 'The MAC address of the network card that sent the frame.'), from: bi('Записан в карте (ip link show eth0).', 'Stored in the card (ip link show eth0).') },
        { id: 'eth.type', name: 'EtherType', off: 12, len: 2, value: '0x0800 (IPv4)', what: bi('Что лежит внутри кадра: 0x0800 — IPv4, 0x0806 — ARP, 0x86DD — IPv6. По этому числу получатель знает, кому отдать содержимое.', 'What is inside the frame: 0x0800 is IPv4, 0x0806 is ARP, 0x86DD is IPv6. By this number the receiver knows whom to hand the contents to.'), from: bi('Ядро, по типу пакета.', 'The kernel, by the packet type.') },
      ],
    },
    {
      id: 'ip',
      osi: 3,
      tcpip: 2,
      name: bi('IPv4', 'IPv4'),
      family: 'l3',
      bytes: ip,
      fields: [
        { id: 'ip.vihl', name: 'Version · IHL', off: 0, len: 1, value: '4 · 5 (20 bytes)', what: bi('Версия протокола (4) и длина заголовка в 32-битных словах: 5 слов = 20 байт без опций.', 'The protocol version (4) and the header length in 32-bit words: 5 words = 20 bytes, no options.'), from: bi('Ядро.', 'The kernel.') },
        { id: 'ip.len', name: 'Total Length', off: 2, len: 2, value: `${total}`, what: bi('Длина всего IP-пакета: заголовок IP + заголовок TCP + данные. Если она больше MTU канала (1500), пакет придётся резать или он будет отвергнут.', 'The length of the whole IP packet: the IP header + the TCP header + the data. If it exceeds the link’s MTU (1500), the packet has to be fragmented or it is rejected.'), from: bi('Ядро, по размеру данных.', 'The kernel, from the data size.') },
        { id: 'ip.flags', name: 'Flags · DF', off: 6, len: 2, value: 'DF (Don’t Fragment)', what: bi('Флаг DF: «не дробить». Маршрутизатор, которому пакет не пролезает, не режет его, а возвращает ICMP «Fragmentation Needed» с допустимым размером. Так работает поиск MTU пути.', 'The DF flag: “do not fragment”. A router the packet does not fit through does not cut it but returns ICMP “Fragmentation Needed” with the allowed size. That is how path MTU discovery works.'), from: bi('Ядро Linux ставит его для TCP по умолчанию.', 'The Linux kernel sets it for TCP by default.') },
        { id: 'ip.ttl', name: 'TTL', off: 8, len: 1, value: String(s.ttl), changed: c('ip.ttl'), what: bi('Время жизни: каждый маршрутизатор уменьшает его на 1, на нуле пакет выбрасывается. Защита от петель — и основа traceroute.', 'Time to live: every router decrements it by 1; at zero the packet is dropped. Protection against loops — and the basis of traceroute.'), from: bi('Ядро: net.ipv4.ip_default_ttl = 64.', 'The kernel: net.ipv4.ip_default_ttl = 64.') },
        { id: 'ip.proto', name: 'Protocol', off: 9, len: 1, value: '6 (TCP)', what: bi('Что внутри IP-пакета: 6 — TCP, 17 — UDP, 1 — ICMP.', 'What is inside the IP packet: 6 is TCP, 17 is UDP, 1 is ICMP.'), from: bi('Ядро, по типу сокета.', 'The kernel, from the socket type.') },
        { id: 'ip.sum', name: 'Header Checksum', off: 10, len: 2, value: `0x${ipSum.toString(16).padStart(4, '0')}`, changed: c('ip.sum'), what: bi('Контрольная сумма заголовка IP. Её пересчитывает каждый маршрутизатор — ведь он поменял TTL.', 'The IP header checksum. Every router recomputes it — it changed the TTL, after all.'), from: bi('Ядро (часто сетевая карта).', 'The kernel (often the network card).') },
        { id: 'ip.src', name: 'Source Address', off: 12, len: 4, value: s.src, changed: c('ip.src'), what: bi('Адрес отправителя. Обычный маршрутизатор его не трогает; NAT подменяет.', 'The sender’s address. An ordinary router leaves it alone; NAT replaces it.'), from: bi('Ядро выбрало адрес исходящего интерфейса (ip route get).', 'The kernel picked the address of the outgoing interface (ip route get).') },
        { id: 'ip.dst', name: 'Destination Address', off: 16, len: 4, value: s.dst, what: bi('Адрес получателя — от начала до конца пути тот же (без NAT). По нему каждый маршрутизатор выбирает строку своей таблицы.', 'The receiver’s address — the same from the start of the path to the end (without NAT). Every router picks a line of its table by it.'), from: bi('Ответ DNS.', 'The DNS answer.') },
      ],
    },
    {
      id: 'tcp',
      osi: 4,
      tcpip: 3,
      name: bi('TCP', 'TCP'),
      family: 'l4',
      bytes: tcp,
      fields: [
        { id: 'tcp.sport', name: 'Source Port', off: 0, len: 2, value: String(s.sport), changed: c('tcp.sport'), what: bi('Порт отправителя — эфемерный: ядро выдало свободный из 32768–60999 при connect(). По нему ответ находит нужную программу.', 'The sender’s port — ephemeral: the kernel gave a free one from 32768–60999 at connect(). The answer finds the right program by it.'), from: bi('Ядро (net.ipv4.ip_local_port_range).', 'The kernel (net.ipv4.ip_local_port_range).') },
        { id: 'tcp.dport', name: 'Destination Port', off: 2, len: 2, value: `${s.dport} (http)`, what: bi('Порт получателя: какую программу на сервере мы зовём. 80 — HTTP, 443 — HTTPS, 22 — SSH.', 'The receiver’s port: which program on the server we are calling. 80 is HTTP, 443 is HTTPS, 22 is SSH.'), from: bi('Схема URL: http:// значит 80.', 'The URL scheme: http:// means 80.') },
        { id: 'tcp.seq', name: 'Sequence Number', off: 4, len: 4, value: String(seq), what: bi('Номер первого байта данных в этом сегменте. Так получатель собирает поток в правильном порядке и видит дыры.', 'The number of the first data byte in this segment. This is how the receiver reassembles the stream in order and notices holes.'), from: bi('Ядро: случайный начальный номер при рукопожатии плюс отправленные байты.', 'The kernel: a random initial number at the handshake plus the bytes sent.') },
        { id: 'tcp.ack', name: 'Acknowledgment Number', off: 8, len: 4, value: String(ack), what: bi('Следующий байт, который мы ждём от собеседника: подтверждение всего полученного до него.', 'The next byte we expect from the peer: an acknowledgement of everything received before it.'), from: bi('Ядро.', 'The kernel.') },
        { id: 'tcp.flags', name: 'Flags', off: 13, len: 1, value: 'PSH, ACK', what: bi('Флаги сегмента: SYN — начать, ACK — подтверждаю, PSH — отдай приложению сразу, FIN — закончил, RST — сброс.', 'The segment’s flags: SYN — start, ACK — acknowledging, PSH — hand to the application now, FIN — done, RST — reset.'), from: bi('Ядро.', 'The kernel.') },
        { id: 'tcp.win', name: 'Window', off: 14, len: 2, value: '502 (× 128 = 64256 bytes)', what: bi('Сколько байт отправитель этого сегмента готов принять, не дожидаясь подтверждений. Число умножается на масштаб из рукопожатия (wscale 7 = ×128).', 'How many bytes the sender of this segment is ready to receive without waiting for acknowledgements. The number is multiplied by the scale from the handshake (wscale 7 = ×128).'), from: bi('Ядро, по свободному месту в буфере сокета.', 'The kernel, from the free room in the socket buffer.') },
        { id: 'tcp.sum', name: 'Checksum', off: 16, len: 2, value: `0x${tcpSum.toString(16).padStart(4, '0')}`, changed: c('tcp.sum'), what: bi('Контрольная сумма TCP считается вместе с псевдозаголовком, где есть IP-адреса. Поэтому NAT, меняя адрес, пересчитывает и её.', 'The TCP checksum covers a pseudo-header that includes the IP addresses. That is why NAT, changing an address, recomputes it too.'), from: bi('Ядро (или сетевая карта).', 'The kernel (or the network card).') },
      ],
    },
    {
      id: 'http',
      osi: 7,
      tcpip: 4,
      name: bi('HTTP', 'HTTP'),
      family: 'l7',
      bytes: data,
      fields: [
        { id: 'http.line', name: 'request-line', off: 0, len: 23, value: 'GET /catalog HTTP/1.1', what: bi('Строка запроса: метод, путь, версия протокола. Это то, что программа хотела сказать; всё остальное — конверты вокруг.', 'The request line: the method, the path, the protocol version. This is what the program wanted to say; everything else is envelopes around it.'), from: bi('curl или браузер.', 'curl or the browser.') },
        { id: 'http.host', name: 'Host', off: 23, len: 20, value: 'Host: shop.example', what: bi('Имя сайта. На одном IP-адресе могут жить сотни сайтов — сервер выбирает нужный по этому заголовку.', 'The site’s name. Hundreds of sites may live on one IP address — the server picks the right one by this header.'), from: bi('URL.', 'The URL.') },
        { id: 'http.end', name: 'CRLF', off: 43, len: 2, value: '\\r\\n', what: bi('Пустая строка: заголовки кончились. У GET тела нет.', 'An empty line: the headers are over. A GET has no body.'), from: bi('curl.', 'curl.') },
      ],
    },
  ];
}

const DEVICE_LABEL: Record<Device, Bi> = {
  none: bi('нет: пакет на выходе из ноутбука', 'none: the packet leaving the laptop'),
  switch: bi('коммутатор', 'a switch'),
  router: bi('маршрутизатор', 'a router'),
  nat: bi('роутер с NAT', 'a router with NAT'),
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

export function specFor(device: Device): { spec: PacketSpec; changed: Set<string> } {
  const base: PacketSpec = { srcMac: '3c:22:fb:12:34:56', dstMac: 'a0:63:91:00:00:01', src: '192.168.1.23', dst: '198.51.100.20', sport: 51234, dport: 80, ttl: 64, data: PAYLOAD };
  if (device === 'router') return { spec: { ...base, srcMac: 'a0:63:91:00:00:02', dstMac: '00:1b:21:3a:4f:01', ttl: 63 }, changed: new Set(['eth.src', 'eth.dst', 'ip.ttl', 'ip.sum']) };
  if (device === 'nat') return { spec: { ...base, srcMac: 'a0:63:91:00:00:02', dstMac: '00:1b:21:3a:4f:01', ttl: 63, src: '203.0.113.7', sport: 40001 }, changed: new Set(['eth.src', 'eth.dst', 'ip.ttl', 'ip.sum', 'ip.src', 'tcp.sport', 'tcp.sum']) };
  return { spec: base, changed: new Set() };
}

/** MTU arithmetic of the last screen: fragments with DF=0, an ICMP error with DF=1. */
export function mtuOutcome(dataBytes: number, df: boolean, mtu = 1500): { total: number; fits: boolean; fragments: number; icmp: boolean } {
  const total = 20 + 20 + dataBytes;
  if (total <= mtu) return { total, fits: true, fragments: 1, icmp: false };
  if (df) return { total, fits: false, fragments: 0, icmp: true };
  const perFrag = Math.floor((mtu - 20) / 8) * 8;
  return { total, fits: false, fragments: Math.ceil((total - 20) / perFrag), icmp: false };
}

const STEPS = 6; // data, +TCP, +IP, +Ethernet, wire, device

const L = {
  step: [
    bi('Программа хочет сказать вот это: строку HTTP-запроса. Это данные — всё, что ниже, конверты вокруг них.', 'The program wants to say this: an HTTP request line. This is the data — everything below is envelopes around it.'),
    bi('Ядро кладёт данные в конверт TCP: порты, номера байтов, флаги. Порт получателя 80 решает, какая программа на сервере их получит.', 'The kernel puts the data in a TCP envelope: ports, byte numbers, flags. Destination port 80 decides which program on the server gets them.'),
    bi('Конверт TCP кладётся в конверт IP: адреса отправителя и получателя, TTL, длина. По адресу получателя пакет найдёт дорогу через маршрутизаторы.', 'The TCP envelope goes into an IP envelope: the source and destination addresses, TTL, length. The destination address lets the packet find its way through routers.'),
    bi('Пакет IP кладётся в кадр Ethernet: MAC шлюза и свой. В хвост добавляется контрольная сумма кадра (FCS).', 'The IP packet goes into an Ethernet frame: the gateway’s MAC and its own. A frame checksum (FCS) is added at the end.'),
    bi('В провод уходят биты: 14 + 20 + 20 байт заголовков и 45 байт данных. Получатель снимает конверты в обратном порядке.', 'Bits go onto the wire: 14 + 20 + 20 bytes of headers and 45 bytes of data. The receiver removes the envelopes in reverse order.'),
    bi('Что с пакетом делают устройства на пути. Выбери устройство: изменённые поля подсвечены.', 'What devices on the path do to the packet. Choose a device: the changed fields are highlighted.'),
  ],
  model: bi('Названия слоёв', 'Layer names'),
  device: bi('Устройство на пути', 'Device on the path'),
  size: bi('Размер данных', 'Data size'),
  df: bi('DF: не дробить', 'DF: do not fragment'),
  prev: bi('Назад', 'Back'),
  next: bi('Дальше', 'Next'),
  from: bi('Откуда значение', 'Where the value comes from'),
  bytes: bi('Байты', 'Bytes'),
  pick: bi('Нажми на любое поле конверта — оно объяснит себя, а в дампе ниже подсветятся его байты.', 'Click any field of an envelope — it explains itself, and its bytes light up in the dump.'),
  counter: bi('данных {d} байт · заголовков {h} байт ({parts})', 'data {d} bytes · headers {h} bytes ({parts})'),
  counterData: bi('данных {d} байт, заголовков пока нет', 'data {d} bytes, no headers yet'),
  fits: bi('Пакет {t} байт ≤ MTU 1500: проходит целиком.', 'Packet {t} bytes ≤ MTU 1500: it passes whole.'),
  frag: bi('Пакет {t} байт > MTU 1500, DF снят: маршрутизатор режет его на {n} фрагмента, получатель соберёт.', 'Packet {t} bytes > MTU 1500 with DF clear: the router cuts it into {n} fragments; the receiver reassembles them.'),
  icmp: bi('Пакет {t} байт > MTU 1500 и DF стоит: маршрутизатор выбрасывает его и отвечает ICMP «Fragmentation Needed, mtu 1500». Отправитель уменьшит размер. Если этот ICMP кто-то отфильтрует — большие пакеты будут исчезать без следа.', 'Packet {t} bytes > MTU 1500 with DF set: the router drops it and replies ICMP “Fragmentation Needed, mtu 1500”. The sender shrinks its packets. If someone filters that ICMP, large packets vanish without a trace.'),
  osi: bi('OSI (7)', 'OSI (7)'),
  tcpip: bi('TCP/IP (4)', 'TCP/IP (4)'),
  osiNote: bi('В OSI ещё есть L5 (сеанс) и L6 (представление). В интернете отдельных конвертов для них нет: эту работу делают само приложение и TLS. Модель — словарь: «проблема на L3» значит «адреса и маршруты», «L7-балансировщик» — «видит HTTP».', 'OSI also has L5 (session) and L6 (presentation). On the internet they have no envelopes of their own: the application and TLS do that work. The model is a vocabulary: “an L3 problem” means “addresses and routes”, “an L7 load balancer” means “it sees HTTP”.'),
  devNote: {
    none: bi('Пакет, каким его отправил ноутбук.', 'The packet as the laptop sent it.'),
    switch: bi('Коммутатор открывает только кадр и смотрит на MAC получателя. В пакете не меняется ничего.', 'A switch opens only the frame and looks at the destination MAC. Nothing in the packet changes.'),
    router: bi('Маршрутизатор снимает кадр, уменьшает TTL 64 → 63, пересчитывает контрольную сумму IP и надевает новый кадр с другими MAC. TCP и данные он не открывает.', 'A router removes the frame, decrements TTL 64 → 63, recomputes the IP checksum and puts on a new frame with different MACs. It does not open TCP or the data.'),
    nat: bi('Роутер с NAT делает то же, что маршрутизатор, и ещё подменяет адрес и порт источника: 192.168.1.23:51234 → 203.0.113.7:40001. Пересчитывает обе контрольные суммы, IP и TCP, и записывает соответствие в conntrack.', 'A router with NAT does what a router does and also replaces the source address and port: 192.168.1.23:51234 → 203.0.113.7:40001. It recomputes both checksums, IP and TCP, and writes the mapping into conntrack.'),
  } as Record<Device, Bi>,
};

function mount(root: HTMLElement, ctx: ExplainerCtx): Mounted {
  let step = 0;
  let seen = 0;
  let model: 'osi' | 'tcpip' = 'tcpip';
  let device: Device = 'none';
  let size = 45;
  let df = true;
  let sel: string | null = null;
  let done = false;

  const wrap = h('section.explainer.env', { tabindex: 0, 'aria-label': t(bi('Конверты OSI и TCP/IP', 'OSI and TCP/IP envelopes')) });
  root.append(wrap);

  const render = () => {
    clear(wrap);
    const { spec, changed } = specFor(step >= 5 ? device : 'none');
    const layers = buildPacket({ ...spec, data: PAYLOAD }, changed);
    const visible = layers.filter((l) => (l.id === 'http' ? true : l.id === 'tcp' ? step >= 1 : l.id === 'ip' ? step >= 2 : step >= 3));
    const head = h('header.ex-head', {}, h('h3', {}, t(bi('Конверты: что на самом деле уходит в провод', 'Envelopes: what really goes onto the wire'))), h('p.ex-summary', {}, t(bi('HTTP-запрос без TLS (http://), чтобы был виден текст. Шаг за шагом вокруг него появляются заголовки; каждое поле — настоящее, со своими байтами.', 'An HTTP request without TLS (http://), so the text is visible. Step by step the headers appear around it; every field is real, with its own bytes.'))));
    const segBtn = (cur: string, opts: [string, Bi][], on: (v: string) => void) =>
      h('div.segmented', { role: 'radiogroup' }, ...opts.map(([id, label]) => h('button.env-seg', { type: 'button', 'aria-pressed': String(cur === id), onclick: () => on(id) }, t(label))));
    const controls = h(
      'div.env-controls',
      {},
      h('div.env-ctl', {}, h('span.env-ctl-label', {}, t(L.model)), segBtn(model, [['tcpip', L.tcpip], ['osi', L.osi]], (v) => { model = v as 'osi' | 'tcpip'; render(); })),
      step >= 5 ? h('div.env-ctl', {}, h('span.env-ctl-label', {}, t(L.device)), segBtn(device, (['none', 'switch', 'router', 'nat'] as Device[]).map((d) => [d, DEVICE_LABEL[d]] as [string, Bi]), (v) => { device = v as Device; render(); })) : null,
    );
    // The stack of envelopes: the outermost first.
    const stack = h('div.env-stack');
    let inner: HTMLElement | null = null;
    for (const l of [...visible].reverse()) {
      const layerName = model === 'osi' ? t(OSI_NAMES[l.osi]) : t(TCPIP_NAMES[l.tcpip]);
      const box = h(
        `div.env-layer.fam-${l.family}`,
        {},
        h('div.env-bar', {}, h('span.env-layer-name', {}, t(l.name)), h('span.env-layer-tag', {}, layerName), h('span.env-layer-size', {}, `${l.bytes.length} B`)),
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
    const order = [...visible].sort((a, b) => a.osi - b.osi);
    const dump = h('div.env-dump', { 'aria-label': t(L.bytes) });
    let off = 0;
    for (const l of order) {
      const f = l.fields.find((x) => x.id === sel);
      l.bytes.forEach((byte, i) => {
        const on = f && i >= f.off && i < f.off + f.len;
        dump.append(h(`span.env-byte.fam-${l.family}`, { class: on ? 'on' : undefined, title: `${l.id} +${i}` }, byte.toString(16).padStart(2, '0')));
        off++;
      });
    }
    const eth = order.find((l) => l.id === 'eth');
    if (eth?.trailer) for (const byte of eth.trailer) dump.append(h('span.env-byte.fam-l2.trailer', {}, byte.toString(16).padStart(2, '0')));
    void off;

    const field = layers.flatMap((l) => l.fields).find((f) => f.id === sel);
    const side = h(
      'aside.env-card',
      { 'aria-live': 'polite' },
      field
        ? [h('h4', {}, field.name), h('p.env-card-val', {}, field.value), h('p', {}, t(field.what)), h('p.env-card-from', {}, h('strong', {}, `${t(L.from)}: `), t(field.from))]
        : h('p.ex-hint', {}, t(L.pick)),
    );
    const hdr = visible.filter((l) => l.id !== 'http').reduce((s, l) => s + l.bytes.length, 0);
    const parts = visible.filter((l) => l.id !== 'http').sort((a, b) => a.osi - b.osi).map((l) => l.bytes.length).join(' + ') || '0';
    const counter = h('p.env-counter', {}, hdr ? t(fmt(L.counter, { d: 45, h: hdr, parts })) : t(fmt(L.counterData, { d: 45 })));
    const caption = h('p.ex-caption', {}, t(L.step[step]), step >= 5 ? ` ${t(L.devNote[device])}` : '');

    let mtuBox: HTMLElement | null = null;
    if (step >= 5) {
      const o = mtuOutcome(size, df);
      const line = o.fits ? fmt(L.fits, { t: o.total }) : o.icmp ? fmt(L.icmp, { t: o.total }) : fmt(L.frag, { t: o.total, n: o.fragments });
      const range = h('input', { type: 'range', min: 45, max: 3000, step: 1, value: size, 'aria-label': t(L.size), oninput: (e: Event) => { size = Number((e.target as HTMLInputElement).value); render(); } });
      mtuBox = h(
        'div.env-mtu',
        {},
        h('label.env-ctl', {}, h('span.env-ctl-label', {}, `${t(L.size)}: ${size} B`), range),
        h('label.env-check', {}, h('input', { type: 'checkbox', checked: df, onchange: (e: Event) => { df = (e.target as HTMLInputElement).checked; render(); } }), ` ${t(L.df)}`),
        h(`p.env-mtu-line${o.fits ? '' : o.icmp ? '.err' : '.warn'}`, {}, t(line)),
      );
    }
    const nav = h(
      'div.env-nav',
      {},
      h('button.btn', { type: 'button', disabled: step === 0, onclick: () => go(step - 1) }, t(L.prev)),
      h('span.ex-counter', {}, `${step + 1} / ${STEPS}`),
      h('button.btn', { type: 'button', disabled: step === STEPS - 1, onclick: () => go(step + 1) }, t(L.next)),
    );
    wrap.append(head, controls, caption, h('div.env-stage', {}, h('div.env-main', {}, stack, counter, h('div.env-dumpwrap', {}, h('h4', {}, t(L.bytes)), dump)), side), mtuBox ?? '', nav);
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
    describe: () => `${t(L.step[step])} ${sel ?? ''}`,
  };
}

export const envelopesExplainer: ExplainerReg = {
  id: 'net.envelopes',
  title: bi('Конверты: модели OSI и TCP/IP', 'Envelopes: the OSI and TCP/IP models'),
  block: 'networks',
  summary: bi('Каждый слой добавляет свой заголовок. Нажимай на поля, переключай модель и устройство на пути, увеличивай пакет сверх MTU.', 'Each layer adds its own header. Click the fields, switch the model and the device on the path, grow the packet past the MTU.'),
  mount,
};
