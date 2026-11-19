// The real-Linux network labs of the Networks block (design 00 §6.13, 03 §8):
// Alpine machines of the lab image on the page's switch. Each lab is one
// widget section (`net.reallab`, props `{ lab: <id> }`). Goals are judged by
// the machines' state and by probes between them, never by typed commands.
//
// Addresses follow the course plan: the lab network is 10.0.0.0/24, VLAN 10
// is an office segment 192.168.10.0/24, namespaces use 172.16.0.0/24.

import { bi } from '../../../core/i18n';
import type { NetLabSpec, NetLabTask } from './spec';
import { addrOn, dnsOf, fileSize, fileText, hasAddr, hasMasquerade, inputDrop, ip4, link, listen, net, on, reach, svc, sw } from './spec';

const T = (o: Omit<NetLabTask, 'prompt' | 'hints'> & { prompt: [string, string]; hints?: Partial<Record<'H1' | 'H2' | 'H3', [string, string]>> }): NetLabTask => ({
  ...o,
  prompt: bi(o.prompt[0], o.prompt[1]),
  hints: o.hints ? Object.fromEntries(Object.entries(o.hints).map(([k, v]) => [k, bi(v![0], v![1])])) : undefined,
});
const say = (ru: string, en: string) => bi(ru, en);

/** nginx that answers every request with the address it came from: who did the network show it? */
export const ECHO_NGINX = `cat > /etc/nginx/http.d/default.conf <<'DT_EOF'
server {
    listen 80 default_server;
    location / { default_type text/plain; return 200 "$remote_addr"; }
}
DT_EOF
rc-service nginx start >/dev/null 2>&1`;

/** nginx serving one static page (the package's own configuration has no server block). */
const page = (text: string) => `mkdir -p /srv/www && echo '${text}' > /srv/www/index.html && cat > /etc/nginx/http.d/default.conf <<'DT_EOF'
server {
    listen 80 default_server;
    root /srv/www;
    index index.html;
}
DT_EOF
rc-service nginx start >/dev/null 2>&1`;

// ── 1. The switch tap: frames, capture, a bad cable ──────────────────────

export const captureLab: NetLabSpec = {
  id: 'capture',
  title: bi('Что идёт по проводу', 'What goes over the wire'),
  intro: bi(
    'Две машины, `a` (10.0.0.51) и `b` (10.0.0.52), в одной локальной сети. Коммутатор лаборатории умеет записывать каждый кадр, который через него проходит, и портить кабель: терять кадры и задерживать их. Запись сохраняется в файл `.pcap`, который открывают Wireshark и `tcpdump -r`.',
    'Two machines, `a` (10.0.0.51) and `b` (10.0.0.52), on one local network. The lab switch can record every frame that passes through it and spoil a cable: lose frames and delay them. The recording is saved as a `.pcap` file that Wireshark and `tcpdump -r` open.',
  ),
  machines: [
    { name: 'a', ip: '10.0.0.51/24', role: bi('машина, с которой вы пингуете', 'the machine you ping from') },
    { name: 'b', ip: '10.0.0.52/24', role: bi('соседняя машина', 'the neighbour') },
  ],
  capture: true,
  line: true,
  files: { a: ['/root/icmp.pcap', '/root/loss.txt', '/root/rtt.txt'] },
  probes: [],
  tasks: [
    T({
      id: 'arp',
      prompt: [
        'Включите запись на коммутаторе (кнопка «Записывать» под терминалом). Затем на `a` очистите ARP-кэш и пингуйте `b` один раз. В записи коммутатора должен появиться ARP-запрос «у кого 10.0.0.52?» от `a`.',
        'Turn the switch recording on (the “Record” button under the terminal). Then on `a` clear the ARP cache and ping `b` once. The switch recording must show an ARP request “who has 10.0.0.52?” from `a`.',
      ],
      check: {
        when: (f) => !!sw(f)?.arp.some((x) => x.op === 'request' && x.from === '10.0.0.51' && x.ask === '10.0.0.52'),
        fail: [{ if: (f) => !sw(f)?.capturing, say: say('Запись на коммутаторе выключена: он не сохраняет кадры, пока вы не нажмёте «Записывать».', 'The switch recording is off: it keeps no frames until you press “Record”.') }],
      },
      chips: 'ip neigh flush all && ping -c 1 b',
      docRef: { page: 'man/ip.8', anchor: 'OBJECTS', line: 'neigh' },
      concepts: ['net.arp', 'net.broadcast'],
      hints: {
        H1: ['Если MAC соседа уже в кэше, ARP-запроса не будет: машина спросит, только когда забудет.', 'If the neighbour’s MAC is already cached, there is no ARP request: the machine asks only once it forgets.'],
        H2: ['Кэш соседей показывает и чистит `ip neigh`.', '`ip neigh` shows and clears the neighbour cache.'],
        H3: ['`ip neigh flush all`, затем `ping -c 1 b`.', '`ip neigh flush all`, then `ping -c 1 b`.'],
      },
    }),
    T({
      id: 'tcpdump',
      on: 'a',
      prompt: [
        'Теперь запишите трафик изнутри машины: на `a` сохраните четыре ICMP-пакета в `/root/icmp.pcap` с помощью `tcpdump`, пока `a` пингует `b`.',
        'Now record the traffic from inside the machine: on `a`, save four ICMP packets to `/root/icmp.pcap` with `tcpdump` while `a` pings `b`.',
      ],
      check: { when: (f) => fileSize(f, '/root/icmp.pcap') > 24 + 16 * 2 },
      chips: 'tcpdump -i eth0 -n -c 4 -w /root/icmp.pcap icmp & sleep 1; ping -c 2 b',
      docRef: { page: 'man/tcpdump.8', anchor: 'OPTIONS', line: '-w' },
      hints: {
        H1: ['`tcpdump` пишет в файл с ключом `-w`, а `-c` останавливает его после стольких-то пакетов.', '`tcpdump` writes to a file with `-w`, and `-c` stops it after so many packets.'],
        H2: ['Запустите `tcpdump` в фоне (`&`), потом пингуйте: в одном терминале иначе не получится.', 'Start `tcpdump` in the background (`&`), then ping: in one terminal there is no other way.'],
        H3: ['`tcpdump -i eth0 -n -c 4 -w /root/icmp.pcap icmp & sleep 1; ping -c 2 b`, затем `tcpdump -n -r /root/icmp.pcap`.', '`tcpdump -i eth0 -n -c 4 -w /root/icmp.pcap icmp & sleep 1; ping -c 2 b`, then `tcpdump -n -r /root/icmp.pcap`.'],
      },
    }),
    T({
      id: 'loss',
      prompt: [
        'Испортите кабель `b`: в «Линии» под терминалом поставьте порту `b` потерю 30%. С `a` отправьте двадцать пингов и сохраните вывод в `/root/loss.txt`. В итоговой строке должна быть ненулевая потеря.',
        'Spoil `b`’s cable: under “Line” below the terminal give port `b` 30% loss. From `a` send twenty pings and save the output to `/root/loss.txt`. The summary line must show non-zero loss.',
      ],
      check: {
        when: (f) => (sw(f)?.lines.b?.lossPct ?? 0) > 0 && /\b([1-9]\d*(\.\d+)?)% packet loss/.test(fileText(on(f, 'a'), '/root/loss.txt')),
        fail: [{ if: (f) => !(sw(f)?.lines.b?.lossPct ?? 0), say: say('У порта `b` нет потерь: задайте их в «Линии».', 'Port `b` has no loss: set it under “Line”.') }],
      },
      scopes: {},
      chips: 'ping -c 20 -i 0.2 b > /root/loss.txt; tail -2 /root/loss.txt',
      docRef: { page: 'man/ping.8', anchor: 'OPTIONS', line: '-c count' },
      hints: {
        H1: ['Потеря видна в последних строках `ping`: «N packets transmitted, M received, X% packet loss».', 'The loss shows in `ping`’s last lines: “N packets transmitted, M received, X% packet loss”.'],
        H2: ['Вывод команды в файл — `>`; `-c 20` — двадцать пингов, `-i 0.2` — пять в секунду.', 'Output to a file is `>`; `-c 20` means twenty pings, `-i 0.2` five a second.'],
      },
    }),
    T({
      id: 'delay',
      prompt: [
        'Уберите потерю и дайте порту `b` задержку 150 мс. Отправьте с `a` три пинга, вывод — в `/root/rtt.txt`. Среднее время ответа должно стать не меньше 150 мс: задержка в одну сторону, и ответ `b` её ждёт.',
        'Remove the loss and give port `b` a delay of 150 ms. Send three pings from `a`, output to `/root/rtt.txt`. The average round trip must become at least 150 ms: the delay is one-way, and `b`’s reply waits for it.',
      ],
      check: {
        when: (f) => {
          const m = /= [\d.]+\/([\d.]+)\//.exec(fileText(on(f, 'a'), '/root/rtt.txt'));
          return (sw(f)?.lines.b?.delayMs ?? 0) >= 100 && !!m && Number(m[1]) >= 140;
        },
      },
      chips: 'ping -c 3 b > /root/rtt.txt; tail -1 /root/rtt.txt',
      docRef: { page: 'man/ping.8', anchor: 'OPTIONS', line: '-c count' },
      concepts: ['net.rtt', 'net.latency'],
      hints: { H1: ['Строка `rtt min/avg/max/mdev` в конце вывода: второе число — среднее.', 'The `rtt min/avg/max/mdev` line at the end: the second number is the average.'] },
    }),
  ],
};

// ── 2. VLANs and a Linux bridge ───────────────────────────────────────────

export const vlanLab: NetLabSpec = {
  id: 'vlan',
  title: bi('Два VLAN и мост между ними', 'Two VLANs and a bridge between them'),
  intro: bi(
    'Машины `a` (10.0.0.21) и `b` (10.0.0.22) в одной подсети, но коммутатор держит их в разных VLAN: порт `a` — VLAN 10, порт `b` — VLAN 20. Поэтому `a` не видит `b`, даже ARP-запрос не доходит. Третья машина, `sw`, подключена транковым портом: к ней приходят кадры обоих VLAN с метками 802.1Q. Из неё вы сделаете мост, который соединит два VLAN в одну сеть.',
    'Machines `a` (10.0.0.21) and `b` (10.0.0.22) are in one subnet, but the switch keeps them in different VLANs: `a`’s port is VLAN 10, `b`’s port is VLAN 20. So `a` cannot see `b`; not even an ARP request gets through. A third machine, `sw`, is on a trunk port: frames of both VLANs reach it with 802.1Q tags. You will turn it into a bridge that joins the two VLANs into one network.',
  ),
  machines: [
    { name: 'a', ip: '10.0.0.21/24', port: { mode: 'access', vlan: 10 }, role: bi('порт VLAN 10', 'a VLAN 10 port') },
    { name: 'b', ip: '10.0.0.22/24', port: { mode: 'access', vlan: 20 }, role: bi('порт VLAN 20', 'a VLAN 20 port') },
    { name: 'sw', ip: '10.0.0.23/24', port: { mode: 'trunk', vlan: 1, vlans: [10, 20] }, role: bi('транк: VLAN 10 и 20 с метками', 'a trunk: VLANs 10 and 20 tagged') },
  ],
  capture: true,
  probes: [{ id: 'ab', kind: 'ping', from: 'a', to: '10.0.0.22' }],
  tasks: [
    T({
      id: 'vifs',
      on: 'sw',
      prompt: [
        'На `sw` создайте поверх `eth0` два VLAN-интерфейса: `eth0.10` для VLAN 10 и `eth0.20` для VLAN 20, и включите их.',
        'On `sw` create two VLAN interfaces on top of `eth0`: `eth0.10` for VLAN 10 and `eth0.20` for VLAN 20, and bring them up.',
      ],
      scopes: { sw: ['net'] },
      check: {
        when: (f) => link(f, 'eth0.10')?.vlan === 10 && link(f, 'eth0.20')?.vlan === 20 && !!link(f, 'eth0.10')?.up && !!link(f, 'eth0.20')?.up,
        fail: [{ if: (f) => !!link(f, 'eth0.10') && !link(f, 'eth0.10')?.up, say: say('`eth0.10` есть, но выключен: новые интерфейсы создаются в состоянии DOWN.', '`eth0.10` exists but is down: new interfaces are created DOWN.') }],
      },
      chips: 'ip link add link eth0 name eth0.10 type vlan id 10',
      docRef: { page: 'man/ip-link.8', anchor: 'VLAN', line: 'type vlan id' },
      concepts: ['net.vlan'],
      hints: {
        H1: ['VLAN-интерфейс — это `ip link add` с типом `vlan` и номером: он снимает метку с входящих кадров и ставит на исходящие.', 'A VLAN interface is `ip link add` with type `vlan` and a number: it strips the tag from incoming frames and adds it to outgoing ones.'],
        H2: ['`ip link add link eth0 name eth0.10 type vlan id 10`, затем `ip link set eth0.10 up`; то же для 20.', '`ip link add link eth0 name eth0.10 type vlan id 10`, then `ip link set eth0.10 up`; the same for 20.'],
      },
    }),
    T({
      id: 'bridge',
      on: 'sw',
      prompt: ['Создайте мост `br0`, сделайте `eth0.10` и `eth0.20` его портами и включите мост.', 'Create the bridge `br0`, make `eth0.10` and `eth0.20` its ports and bring the bridge up.'],
      scopes: { sw: ['net'] },
      check: {
        when: (f) => link(f, 'br0')?.kind === 'bridge' && !!link(f, 'br0')?.up && link(f, 'eth0.10')?.master === 'br0' && link(f, 'eth0.20')?.master === 'br0',
        fail: [{ if: (f) => link(f, 'br0')?.kind === 'bridge' && link(f, 'eth0.10')?.master !== 'br0', say: say('Мост есть, но `eth0.10` не его порт: у порта моста `master br0`.', 'The bridge exists, but `eth0.10` is not its port: a bridge port has `master br0`.') }],
      },
      chips: 'ip link add br0 type bridge && ip link set eth0.10 master br0',
      docRef: { page: 'man/ip-link.8', anchor: 'BRIDGE', line: 'master DEVICE' },
      concepts: ['net.bridge'],
      hints: {
        H1: ['Мост — тоже интерфейс, `ip link add` с типом `bridge`. Порт подключают к мосту, назначая ему хозяина: `master`.', 'A bridge is an interface too: `ip link add` with type `bridge`. A port joins a bridge by getting a master: `master`.'],
        H2: ['`ip link add br0 type bridge`, `ip link set eth0.10 master br0`, `ip link set eth0.20 master br0`, `ip link set br0 up`.', '`ip link add br0 type bridge`, `ip link set eth0.10 master br0`, `ip link set eth0.20 master br0`, `ip link set br0 up`.'],
      },
    }),
    T({
      id: 'ping',
      prompt: ['Проверьте: `a` пингует `b`. Кадры идут из VLAN 10 в `sw`, через мост и обратно в коммутатор уже в VLAN 20.', 'Check: `a` pings `b`. Frames go from VLAN 10 into `sw`, through the bridge and back into the switch in VLAN 20.'],
      probes: ['ab'],
      scopes: { sw: ['net'] },
      check: {
        when: (f) => !!reach(on(f, 'a'), 'ab')?.ok,
        fail: [{ if: (f) => link(on(f, 'sw'), 'br0')?.kind !== 'bridge', say: say('Моста ещё нет, и VLAN 10 и 20 разделены коммутатором.', 'There is no bridge yet, and the switch keeps VLANs 10 and 20 apart.') }],
      },
      concepts: ['net.vlan', 'net.bridge'],
      hints: { H1: ['Если не пингуется, посмотрите на `sw` команду `bridge link`: оба порта должны быть в состоянии forwarding.', 'If ping fails, look at `bridge link` on `sw`: both ports must be in the forwarding state.'] },
    }),
    T({
      id: 'fdb',
      on: 'sw',
      levels: ['intermediate', 'experienced'],
      prompt: [
        'Мост учится так же, как коммутатор. Покажите на `sw` его таблицу MAC-адресов: в ней должен быть MAC `a` (02:64:74:00:00:01) за портом `eth0.10`.',
        'A bridge learns just like a switch. Show its MAC table on `sw`: it must have `a`’s MAC (02:64:74:00:00:01) behind port `eth0.10`.',
      ],
      check: { stdout: /02:64:74:00:00:01 dev eth0\.10/ },
      chips: 'bridge fdb show br br0',
      docRef: { page: 'man/bridge.8', anchor: 'FDB', line: 'bridge fdb show' },
      hints: { H1: ['Таблицу пересылки моста показывает команда `bridge`, объект `fdb`.', 'The bridge’s forwarding table is shown by the `bridge` command, object `fdb`.'] },
    }),
  ],
};

// ── 3. A Linux router: router on a stick, forwarding, NAT ─────────────────

export const routerLab: NetLabSpec = {
  id: 'router',
  title: bi('Маршрутизатор из Linux', 'A router made of Linux'),
  intro: bi(
    'Офисный компьютер `pc` (192.168.10.10) сидит в VLAN 10, где нет ни шлюза, ни выхода наружу. Сервер `srv` (10.0.0.20) — в основной сети; он отвечает на любой запрос адресом, с которого запрос пришёл. Машина `gw` подключена транком: её `eth0` (10.0.0.1) — в основной сети, а VLAN 10 приходит к ней с меткой. Из `gw` вы сделаете маршрутизатор для офиса.',
    'The office computer `pc` (192.168.10.10) sits in VLAN 10, which has neither a gateway nor a way out. The server `srv` (10.0.0.20) is on the main network; it answers any request with the address the request came from. The machine `gw` is on a trunk: its `eth0` (10.0.0.1) is on the main network, and VLAN 10 reaches it tagged. You will make `gw` the office’s router.',
  ),
  machines: [
    { name: 'pc', ip: '192.168.10.10/24', port: { mode: 'access', vlan: 10 }, role: bi('офис, VLAN 10', 'the office, VLAN 10') },
    { name: 'gw', ip: '10.0.0.1/24', port: { mode: 'trunk', vlan: 1, vlans: [10] }, role: bi('будущий маршрутизатор', 'the router to be') },
    { name: 'srv', ip: '10.0.0.20/24', role: bi('сервер, отвечает адресом клиента', 'a server that answers with the client’s address'), setup: [ECHO_NGINX] },
  ],
  capture: true,
  probes: [
    { id: 'gw', kind: 'ping', from: 'pc', to: '192.168.10.1' },
    { id: 'web', kind: 'http', from: 'pc', to: 'http://10.0.0.20/' },
  ],
  tasks: [
    T({
      id: 'vif',
      on: 'gw',
      prompt: ['Дайте `gw` ногу в офисной сети: интерфейс VLAN 10 поверх `eth0` с адресом 192.168.10.1/24, включённый.', 'Give `gw` a leg in the office network: a VLAN 10 interface on top of `eth0` with the address 192.168.10.1/24, up.'],
      scopes: { gw: ['net'] },
      check: { when: (f) => net(f).addrs.some((a) => a.cidr === '192.168.10.1/24' && net(f).links.find((l) => l.name === a.dev)?.vlan === 10 && !!net(f).links.find((l) => l.name === a.dev)?.up) },
      chips: 'ip link add link eth0 name eth0.10 type vlan id 10',
      docRef: { page: 'man/ip-link.8', anchor: 'VLAN', line: 'type vlan id' },
      concepts: ['net.vlan', 'net.router'],
      hints: {
        H1: ['Маршрутизатор — это машина с ногой в каждой сети. Ногу в VLAN 10 даёт VLAN-интерфейс.', 'A router is a machine with a leg in every network. A VLAN interface gives the leg in VLAN 10.'],
        H2: ['`ip link add link eth0 name eth0.10 type vlan id 10`, `ip addr add 192.168.10.1/24 dev eth0.10`, `ip link set eth0.10 up`.', '`ip link add link eth0 name eth0.10 type vlan id 10`, `ip addr add 192.168.10.1/24 dev eth0.10`, `ip link set eth0.10 up`.'],
      },
    }),
    T({
      id: 'route',
      on: 'pc',
      prompt: ['На `pc` сделайте `gw` шлюзом по умолчанию и убедитесь, что `pc` пингует 192.168.10.1.', 'On `pc` make `gw` the default gateway and make sure `pc` pings 192.168.10.1.'],
      scopes: { pc: ['net'] },
      probes: ['gw'],
      check: { when: (f) => net(f).routes.some((r) => r.dst === 'default' && r.via === '192.168.10.1') && !!reach(f, 'gw')?.ok },
      chips: 'ip route add default via 192.168.10.1',
      docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip route' },
      concepts: ['net.gateway', 'net.route-table'],
      hints: { H1: ['Шлюз по умолчанию — маршрут `default` через адрес соседа в своей подсети.', 'The default gateway is a `default` route via a neighbour’s address in your own subnet.'] },
    }),
    T({
      id: 'forward',
      on: 'gw',
      prompt: ['Включите на `gw` пересылку пакетов между интерфейсами.', 'Turn on packet forwarding between interfaces on `gw`.'],
      scopes: { gw: ['net'] },
      check: { when: 'net.forward=1' },
      chips: 'sysctl -w net.ipv4.ip_forward=1',
      docRef: { page: 'man/sysctl.8', anchor: 'EXAMPLES', line: 'net.ipv4.ip_forward=1' },
      hints: { H1: ['Это параметр ядра `net.ipv4.ip_forward`; пока он 0, Linux выбрасывает чужие пакеты.', 'It is the kernel parameter `net.ipv4.ip_forward`; while it is 0, Linux drops packets addressed to others.'] },
    }),
    T({
      id: 'nat',
      prompt: [
        'Откройте с `pc` страницу `http://10.0.0.20/`. Сейчас запрос, скорее всего, повиснет: `srv` получает пакет от 192.168.10.10 и не знает дороги в эту сеть. Сделайте так, чтобы `srv` видел адрес `gw` — 10.0.0.1.',
        'Open `http://10.0.0.20/` from `pc`. Right now the request most likely hangs: `srv` gets a packet from 192.168.10.10 and does not know the way to that network. Make `srv` see `gw`’s address — 10.0.0.1.',
      ],
      probes: ['web'],
      scopes: { gw: ['net', 'fw'] },
      check: {
        when: (f) => reach(on(f, 'pc'), 'web')?.status === 200 && (reach(on(f, 'pc'), 'web')?.body ?? '').trim() === '10.0.0.1',
        fail: [
          { if: (f) => net(on(f, 'gw')).forward !== 1, say: say('Пересылка на `gw` выключена.', 'Forwarding on `gw` is off.') },
          { if: (f) => !hasMasquerade(on(f, 'gw')), say: say('Пакет доходит до `srv` с адресом 192.168.10.10, а ответ уходит в никуда: у `srv` нет маршрута в офис. Подмените на `gw` адрес источника на выходе через `eth0`.', 'The packet reaches `srv` from 192.168.10.10, and the reply goes nowhere: `srv` has no route to the office. On `gw`, rewrite the source address on the way out through `eth0`.') },
        ],
      },
      chips: 'iptables -t nat -A POSTROUTING -s 192.168.10.0/24 -o eth0 -j MASQUERADE',
      docRef: { page: 'man/nft.8', anchor: 'NAT', line: 'masquerade' },
      concepts: ['net.nat', 'net.netfilter'],
      hints: {
        H1: ['Адрес источника меняют на выходе, в POSTROUTING, и только для офисной сети.', 'The source address is rewritten on the way out, in POSTROUTING, and only for the office network.'],
        H2: ['С iptables: `-t nat -A POSTROUTING -s 192.168.10.0/24 -o eth0 -j MASQUERADE`. С nft: таблица `ip nat`, цепочка с `hook postrouting`, правило `oifname "eth0" masquerade`.', 'With iptables: `-t nat -A POSTROUTING -s 192.168.10.0/24 -o eth0 -j MASQUERADE`. With nft: a table `ip nat`, a chain with `hook postrouting`, the rule `oifname "eth0" masquerade`.'],
      },
    }),
    T({
      id: 'route-back',
      levels: ['intermediate', 'experienced'],
      prompt: [
        'NAT прячет офис, а иногда серверу нужно видеть настоящий адрес клиента. Уберите подмену на `gw` и вместо неё научите `srv` дороге в 192.168.10.0/24. Теперь `srv` должен отвечать `pc` адресом 192.168.10.10.',
        'NAT hides the office, and sometimes a server needs to see the client’s real address. Remove the rewrite on `gw` and teach `srv` the way to 192.168.10.0/24 instead. Now `srv` must answer `pc` with 192.168.10.10.',
      ],
      probes: ['web'],
      scopes: { srv: ['net'], gw: ['fw'] },
      check: {
        when: (f) => (reach(on(f, 'pc'), 'web')?.body ?? '').trim() === '192.168.10.10' && net(on(f, 'srv')).routes.some((r) => r.dst === '192.168.10.0/24' && r.via === '10.0.0.1'),
        fail: [{ if: (f) => hasMasquerade(on(f, 'gw')), say: say('Подмена на `gw` ещё работает: `srv` видит 10.0.0.1. Удалите правило (`iptables -t nat -F POSTROUTING` или `nft delete table ip nat`).', 'The rewrite on `gw` still works: `srv` sees 10.0.0.1. Delete the rule (`iptables -t nat -F POSTROUTING` or `nft delete table ip nat`).') }],
      },
      concepts: ['net.route-table'],
      hints: { H1: ['Маршрут в конкретную сеть: `ip route add 192.168.10.0/24 via 10.0.0.1` на `srv`.', 'A route to a specific network: `ip route add 192.168.10.0/24 via 10.0.0.1` on `srv`.'] },
    }),
  ],
};

// ── 4. A network namespace: a container's network by hand ─────────────────

export const netnsLab: NetLabSpec = {
  id: 'netns',
  title: bi('Сеть в пространстве имён', 'A network in a namespace'),
  intro: bi(
    'На машине `host` (10.0.0.31) вы соберёте вторую, отдельную сеть ядра: пространство имён `blue` со своими интерфейсами, адресами и маршрутами. Связывает его с `host` пара veth — виртуальный кабель с двумя концами. Соседняя машина `peer` (10.0.0.32) отвечает на запрос адресом, с которого он пришёл. Ровно так Docker подключает к сети запущенные приложения.',
    'On the machine `host` (10.0.0.31) you will build a second, separate kernel network: the namespace `blue` with its own interfaces, addresses and routes. A veth pair — a virtual cable with two ends — links it to `host`. The neighbouring machine `peer` (10.0.0.32) answers a request with the address it came from. This is exactly how Docker connects the applications it runs to the network.',
  ),
  machines: [
    { name: 'host', ip: '10.0.0.31/24', role: bi('машина с пространством имён', 'the machine with the namespace') },
    { name: 'peer', ip: '10.0.0.32/24', role: bi('сосед, отвечает адресом клиента', 'a neighbour that answers with the client’s address'), setup: [ECHO_NGINX] },
  ],
  probes: [
    { id: 'nsaddr', kind: 'cmd', from: 'host', cmd: 'ip -n blue -br addr' },
    { id: 'nsping', kind: 'ping', from: 'host', ns: 'blue', to: '172.16.0.1' },
    { id: 'nsweb', kind: 'http', from: 'host', ns: 'blue', to: 'http://10.0.0.32/' },
  ],
  tasks: [
    T({
      id: 'ns',
      on: 'host',
      prompt: ['Создайте на `host` сетевое пространство имён `blue`.', 'Create the network namespace `blue` on `host`.'],
      scopes: { host: ['net'] },
      check: { when: 'net.netns has blue' },
      chips: 'ip netns add blue',
      docRef: { page: 'man/ip-netns.8', anchor: 'DESCRIPTION', line: 'ip netns add' },
      concepts: ['linux.namespace'],
      hints: { H1: ['Именованные пространства имён ведёт `ip netns`.', '`ip netns` manages named namespaces.'] },
    }),
    T({
      id: 'veth',
      on: 'host',
      prompt: [
        'Соедините `blue` с `host` парой veth: конец `veth-host` остаётся на `host` с адресом 172.16.0.1/24, конец `veth-blue` уходит в `blue` с адресом 172.16.0.2/24. Оба конца включены, и изнутри `blue` пингуется 172.16.0.1.',
        'Link `blue` to `host` with a veth pair: the end `veth-host` stays on `host` with 172.16.0.1/24, the end `veth-blue` goes into `blue` with 172.16.0.2/24. Both ends are up, and 172.16.0.1 answers ping from inside `blue`.',
      ],
      scopes: { host: ['net'] },
      probes: ['nsaddr', 'nsping'],
      check: {
        when: (f) => addrOn(f, 'veth-host', '172.16.0.1/24') && !!reach(f, 'nsping')?.ok,
        fail: [
          { if: (f) => !/172\.16\.0\.2\/24/.test(reach(f, 'nsaddr')?.out ?? ''), say: say('Внутри `blue` нет адреса 172.16.0.2/24. Команды для пространства имён — `ip -n blue …` или `ip netns exec blue …`.', 'There is no 172.16.0.2/24 inside `blue`. Commands for the namespace are `ip -n blue …` or `ip netns exec blue …`.') },
          { if: (f) => /veth-blue[^\n]*DOWN/.test(reach(f, 'nsaddr')?.out ?? ''), say: say('`veth-blue` внутри `blue` выключен.', '`veth-blue` inside `blue` is down.') },
        ],
      },
      chips: 'ip link add veth-host type veth peer name veth-blue netns blue',
      docRef: { page: 'man/ip-link.8', anchor: 'VETH', line: 'type veth peer name' },
      concepts: ['net.veth'],
      hints: {
        H1: ['Пара veth создаётся одной командой; второй конец можно сразу отправить в пространство имён.', 'A veth pair is created with one command; the second end can go into the namespace right away.'],
        H2: ['`ip link add veth-host type veth peer name veth-blue netns blue`, потом адреса и `up` для обоих концов: внутри — через `ip -n blue`.', '`ip link add veth-host type veth peer name veth-blue netns blue`, then the addresses and `up` for both ends: inside, through `ip -n blue`.'],
      },
    }),
    T({
      id: 'out',
      prompt: [
        'Выпустите `blue` наружу: изнутри `blue` откройте `http://10.0.0.32/`, и `peer` должен ответить адресом `host` — 10.0.0.31. Ровно это Docker делает для каждого приложения, которое запускает: маршрут по умолчанию внутри, пересылка и подмена адреса снаружи.',
        'Let `blue` out: from inside `blue` open `http://10.0.0.32/`, and `peer` must answer with `host`’s address — 10.0.0.31. This is exactly what Docker does for every application it runs: a default route inside, forwarding and address rewriting outside.',
      ],
      scopes: { host: ['net', 'fw'] },
      probes: ['nsweb', 'nsaddr'],
      check: {
        when: (f) => (reach(on(f, 'host'), 'nsweb')?.body ?? '').trim() === '10.0.0.31',
        fail: [
          { if: (f) => /unreachable/.test(reach(on(f, 'host'), 'nsweb')?.error ?? '') || /Network is unreachable/.test(reach(on(f, 'host'), 'nsweb')?.error ?? ''), say: say('Внутри `blue` нет маршрута по умолчанию.', 'There is no default route inside `blue`.') },
          { if: (f) => net(on(f, 'host')).forward !== 1, say: say('`host` не пересылает пакеты: `net.ipv4.ip_forward` равен 0.', '`host` does not forward packets: `net.ipv4.ip_forward` is 0.') },
          { if: (f) => !hasMasquerade(on(f, 'host')), say: say('Пакет уходит к `peer` с адресом 172.16.0.2, и ответ не находит дороги назад. Нужна подмена источника для 172.16.0.0/24 на выходе через `eth0`.', 'The packet leaves for `peer` from 172.16.0.2, and the reply finds no way back. You need a source rewrite for 172.16.0.0/24 on the way out through `eth0`.') },
        ],
      },
      chips: 'ip -n blue route add default via 172.16.0.1',
      docRef: { page: 'man/ip-netns.8', anchor: 'EXAMPLES', line: 'ip netns exec' },
      concepts: ['net.nat', 'net.gateway'],
      hints: {
        H1: ['Три части: маршрут по умолчанию внутри `blue` через 172.16.0.1, пересылка на `host`, подмена адреса 172.16.0.0/24 на `eth0`.', 'Three parts: a default route inside `blue` via 172.16.0.1, forwarding on `host`, rewriting 172.16.0.0/24 on `eth0`.'],
        H2: ['`ip -n blue route add default via 172.16.0.1`; `sysctl -w net.ipv4.ip_forward=1`; `iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -o eth0 -j MASQUERADE`.', '`ip -n blue route add default via 172.16.0.1`; `sysctl -w net.ipv4.ip_forward=1`; `iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -o eth0 -j MASQUERADE`.'],
      },
    }),
  ],
};

// ── 5. A firewall with nftables ───────────────────────────────────────────

export const firewallLab: NetLabSpec = {
  id: 'firewall',
  title: bi('Межсетевой экран на nftables', 'A firewall with nftables'),
  intro: bi(
    'На сервере `srv` (10.0.0.41) работают сайт на порту 80, SSH и служебные метрики на порту 9100, и всё это открыто всем. Машина `admin` (10.0.0.42) — рабочее место администратора, `client` (10.0.0.43) — обычный пользователь. Закройте сервер так, чтобы каждый видел только своё.',
    'The server `srv` (10.0.0.41) runs a site on port 80, SSH and internal metrics on port 9100, and all of it is open to everyone. The machine `admin` (10.0.0.42) is the administrator’s workstation, `client` (10.0.0.43) an ordinary user. Lock the server down so that everyone sees only what is theirs.',
  ),
  machines: [
    { name: 'srv', ip: '10.0.0.41/24', role: bi('сервер: 80, 22 и 9100', 'the server: 80, 22 and 9100'), setup: [page('srv'), 'setsid socat TCP-LISTEN:9100,fork,reuseaddr SYSTEM:"echo dt_up 1" </dev/null >/dev/null 2>&1 &'] },
    { name: 'admin', ip: '10.0.0.42/24', role: bi('администратор', 'the administrator') },
    { name: 'client', ip: '10.0.0.43/24', role: bi('пользователь', 'a user') },
  ],
  files: { srv: ['/etc/nftables.nft'] },
  probes: [
    { id: 'web', kind: 'http', from: 'client', to: 'http://10.0.0.41/' },
    { id: 'ssh', kind: 'tcp', from: 'client', to: '10.0.0.41', port: 22 },
    { id: 'metrics', kind: 'tcp', from: 'client', to: '10.0.0.41', port: 9100 },
    { id: 'ping', kind: 'ping', from: 'client', to: '10.0.0.41' },
    { id: 'ssh', kind: 'tcp', from: 'admin', to: '10.0.0.41', port: 22 },
  ],
  tasks: [
    T({
      id: 'drop',
      prompt: [
        'Сделайте на `srv` таблицу `inet filter` с цепочкой `input` на хуке input и политикой `drop`. Сайт должен по-прежнему открываться у `client`: пропустите ответы на уже открытые соединения, петлю `lo` и порт 80.',
        'On `srv` make a table `inet filter` with an `input` chain on the input hook and a `drop` policy. The site must still open for `client`: let through replies to open connections, the loopback `lo` and port 80.',
      ],
      scopes: { srv: ['fw'] },
      probes: ['web'],
      check: {
        when: (f) => inputDrop(on(f, 'srv')) && reach(on(f, 'client'), 'web')?.status === 200,
        fail: [{ if: (f) => inputDrop(on(f, 'srv')) && reach(on(f, 'client'), 'web')?.error === 'timeout', say: say('Политика `drop` съела и сайт: правило `tcp dport 80 accept` должно стоять в цепочке `input`.', 'The `drop` policy ate the site too: the rule `tcp dport 80 accept` must be in the `input` chain.') }],
      },
      chips: "nft add chain inet filter input '{ type filter hook input priority 0; policy drop; }'",
      docRef: { page: 'man/nft.8', anchor: 'CHAINS', line: 'policy' },
      concepts: ['net.netfilter', 'net.conntrack'],
      hints: {
        H1: ['Порядок важен: сначала разрешающие правила, потом политика. Иначе первым отвалится то, чем вы работаете.', 'Order matters: allow rules first, then the policy. Otherwise the first thing to go is what you are working with.'],
        H2: ['`nft add table inet filter`; цепочка с `type filter hook input priority 0; policy drop;`; правила `ct state established,related accept`, `iif lo accept`, `tcp dport 80 accept`.', '`nft add table inet filter`; a chain with `type filter hook input priority 0; policy drop;`; the rules `ct state established,related accept`, `iif lo accept`, `tcp dport 80 accept`.'],
      },
    }),
    T({
      id: 'ssh',
      prompt: ['SSH на `srv` должен открываться только с `admin`: у `admin` соединение устанавливается, у `client` — тишина.', 'SSH on `srv` must open only from `admin`: `admin` connects, `client` gets silence.'],
      scopes: { srv: ['fw'] },
      probes: ['ssh'],
      check: {
        when: (f) => !!reach(on(f, 'admin'), 'ssh')?.connected && reach(on(f, 'client'), 'ssh')?.error === 'timeout',
        fail: [
          { if: (f) => !!reach(on(f, 'client'), 'ssh')?.connected, say: say('SSH открыт всем: в правиле нет условия на адрес источника.', 'SSH is open to everyone: the rule has no condition on the source address.') },
          { if: (f) => !reach(on(f, 'admin'), 'ssh')?.connected, say: say('`admin` не может подключиться: правило для порта 22 с его адреса не сработало.', '`admin` cannot connect: the rule for port 22 from its address did not match.') },
        ],
      },
      chips: 'nft add rule inet filter input ip saddr 10.0.0.42 tcp dport 22 accept',
      docRef: { page: 'man/nft.8', anchor: 'MATCHES', line: 'ip saddr' },
      concepts: ['net.port'],
      hints: { H1: ['Условие на источник в nft — `ip saddr`.', 'In nft, the condition on the source is `ip saddr`.'] },
    }),
    T({
      id: 'quiet',
      prompt: [
        'Метрики на порту 9100 для `client` закрыты молча: соединение висит до таймаута, а не получает отказ. При этом `client` по-прежнему пингует `srv`: без ICMP перестают работать и `ping`, и сообщения о недоступности.',
        'The metrics on port 9100 are closed to `client` silently: the connection hangs until a timeout instead of being refused. And `client` still pings `srv`: without ICMP, both `ping` and the unreachable messages stop working.',
      ],
      scopes: { srv: ['fw'] },
      probes: ['metrics', 'ping'],
      check: {
        when: (f) => reach(on(f, 'client'), 'metrics')?.error === 'timeout' && !!reach(on(f, 'client'), 'ping')?.ok,
        fail: [
          { if: (f) => reach(on(f, 'client'), 'metrics')?.error === 'refused', say: say('Порт отвечает отказом: где-то стоит `reject`. Отказ сообщает, что машина есть и порт закрыт; тишина не сообщает ничего.', 'The port refuses: there is a `reject` somewhere. A refusal says that the machine exists and the port is closed; silence says nothing.') },
          { if: (f) => !reach(on(f, 'client'), 'ping')?.ok, say: say('ICMP закрыт: добавьте `ip protocol icmp accept` (или `meta l4proto icmp accept`).', 'ICMP is closed: add `ip protocol icmp accept` (or `meta l4proto icmp accept`).') },
        ],
      },
      docRef: { page: 'man/nft.8', anchor: 'STATEMENTS', line: 'drop' },
      hints: { H1: ['Политика `drop` уже делает порт молчаливым. Осталось пропустить ICMP.', 'The `drop` policy already makes the port silent. What is left is letting ICMP through.'] },
    }),
    T({
      id: 'persist',
      on: 'srv',
      levels: ['intermediate', 'experienced'],
      prompt: [
        'Правила nft живут в памяти ядра и пропадут при перезагрузке. Сохраните набор в `/etc/nftables.nft` и включите службу `nftables` в уровень запуска `default`, чтобы OpenRC загружал его при старте.',
        'nft rules live in the kernel’s memory and vanish at reboot. Save the ruleset to `/etc/nftables.nft` and add the `nftables` service to the `default` runlevel so that OpenRC loads it at boot.',
      ],
      scopes: { srv: ['svc'] },
      check: { when: (f) => /10\.0\.0\.42/.test(fileText(f, '/etc/nftables.nft')) && /policy drop/.test(fileText(f, '/etc/nftables.nft')) && svc(f).some((s) => s.name === 'nftables' && s.runlevels.includes('default')) },
      chips: 'nft list ruleset > /etc/nftables.nft && rc-update add nftables default',
      docRef: { page: 'man/nft.8', anchor: 'RULESET', line: 'list ruleset' },
      hints: { H1: ['`nft list ruleset` печатает набор в том же синтаксисе, который `nft -f` читает обратно.', '`nft list ruleset` prints the ruleset in the same syntax `nft -f` reads back.'] },
    }),
  ],
};

// ── 6. DHCP and DNS with dnsmasq ──────────────────────────────────────────

export const dnsmasqLab: NetLabSpec = {
  id: 'dnsmasq',
  title: bi('DHCP и DNS на dnsmasq', 'DHCP and DNS with dnsmasq'),
  intro: bi(
    'В сети 10.0.0.0/24 есть шлюз `gw` (10.0.0.1) и веб-сервер `web` (10.0.0.20). Новый компьютер `pc` просит адрес по DHCP, но никто не отвечает. Поднимите на `gw` dnsmasq: он раздаст адреса и будет отвечать на имена в зоне `corp.lab`.',
    'The network 10.0.0.0/24 has a gateway `gw` (10.0.0.1) and a web server `web` (10.0.0.20). A new computer `pc` asks for an address over DHCP, but nobody answers. Run dnsmasq on `gw`: it will hand out addresses and answer names in the `corp.lab` zone.',
  ),
  machines: [
    { name: 'gw', ip: '10.0.0.1/24', role: bi('шлюз, будущий DHCP и DNS', 'the gateway, the DHCP and DNS server to be') },
    { name: 'web', ip: '10.0.0.20/24', role: bi('веб-сервер', 'a web server'), setup: [page('web.corp.lab')] },
    { name: 'pc', dhcp: true, mac: '02:64:74:00:00:63', role: bi('просит адрес по DHCP', 'asks for an address over DHCP') },
  ],
  files: { gw: ['/var/lib/misc/dnsmasq.leases'] },
  probes: [
    { id: 'name', kind: 'dns', from: 'pc', to: 'web.corp.lab', server: '10.0.0.1' },
    { id: 'site', kind: 'http', from: 'pc', to: 'http://web.corp.lab/' },
  ],
  tasks: [
    T({
      id: 'serve',
      on: 'gw',
      prompt: [
        'Настройте и запустите dnsmasq на `gw`: раздавать адреса 10.0.0.100–10.0.0.199 на час и отвечать на DNS. dnsmasq должен слушать DHCP (UDP 67) и DNS (порт 53).',
        'Configure and start dnsmasq on `gw`: hand out 10.0.0.100–10.0.0.199 for an hour and answer DNS. dnsmasq must listen on DHCP (UDP 67) and DNS (port 53).',
      ],
      scopes: { gw: ['listen'] },
      check: {
        when: (f) => listen(f).some((l) => l.port === 67 && l.proc === 'dnsmasq') && listen(f).some((l) => l.port === 53 && l.proc === 'dnsmasq'),
        fail: [{ if: (f) => listen(f).some((l) => l.port === 53 && l.proc === 'dnsmasq'), say: say('dnsmasq отвечает на DNS, но не раздаёт адреса: в конфигурации нет `dhcp-range`.', 'dnsmasq answers DNS but hands out no addresses: the configuration has no `dhcp-range`.') }],
      },
      chips: 'echo dhcp-range=10.0.0.100,10.0.0.199,1h >> /etc/dnsmasq.conf && rc-service dnsmasq start',
      docRef: { page: 'man/dnsmasq.8', anchor: 'OPTIONS', line: '--dhcp-range' },
      concepts: ['net.dhcp', 'net.lease'],
      hints: {
        H1: ['dnsmasq читает `/etc/dnsmasq.conf`: каждый ключ из `man dnsmasq` пишется там без двух дефисов.', 'dnsmasq reads `/etc/dnsmasq.conf`: every option from `man dnsmasq` is written there without the two dashes.'],
        H2: ['Строка `dhcp-range=10.0.0.100,10.0.0.199,1h`, затем `rc-service dnsmasq start`; ошибки — в `logread`.', 'The line `dhcp-range=10.0.0.100,10.0.0.199,1h`, then `rc-service dnsmasq start`; errors are in `logread`.'],
      },
    }),
    T({
      id: 'lease',
      on: 'pc',
      prompt: [
        'Пусть `pc` получит аренду: адрес из диапазона на `eth0`, а в `/etc/resolv.conf` — `gw` как DNS-сервер. Клиент DHCP на `pc` повторяет попытки сам, но можно и попросить его сразу: `udhcpc -i eth0`.',
        'Let `pc` get a lease: an address from the range on `eth0`, and `gw` as the DNS server in `/etc/resolv.conf`. The DHCP client on `pc` retries by itself, but you can also ask it at once: `udhcpc -i eth0`.',
      ],
      scopes: { pc: ['net', 'dns'] },
      check: {
        when: (f) => net(f).addrs.some((a) => a.dev === 'eth0' && ip4(a.addr) >= ip4('10.0.0.100') && ip4(a.addr) <= ip4('10.0.0.199')) && dnsOf(f).nameservers.includes('10.0.0.1'),
        fail: [{ if: (f) => !net(f).addrs.some((a) => a.dev === 'eth0' && a.family === 'inet'), say: say('Аренды нет. Запустите `udhcpc -i eth0` на `pc` и посмотрите на `gw` журнал: `logread | grep dnsmasq`.', 'No lease. Run `udhcpc -i eth0` on `pc` and look at the log on `gw`: `logread | grep dnsmasq`.') }],
      },
      chips: 'udhcpc -i eth0',
      docRef: { page: 'man/dnsmasq.8', anchor: 'OPTIONS', line: '--dhcp-option' },
      concepts: ['net.lease', 'net.resolver'],
      hints: { H1: ['Шлюз и DNS-сервер dnsmasq по умолчанию сообщает свой собственный адрес — отдельно настраивать их не нужно.', 'By default dnsmasq offers its own address as the gateway and the DNS server — no separate setting is needed.'] },
    }),
    T({
      id: 'name',
      prompt: ['Сделайте, чтобы имя `web.corp.lab` указывало на 10.0.0.20 и `pc` открывал `http://web.corp.lab/`.', 'Make the name `web.corp.lab` point to 10.0.0.20 so that `pc` opens `http://web.corp.lab/`.'],
      probes: ['name', 'site'],
      check: {
        when: (f) => (reach(on(f, 'pc'), 'name')?.answers ?? []).includes('10.0.0.20') && reach(on(f, 'pc'), 'site')?.status === 200,
        fail: [{ if: (f) => (reach(on(f, 'pc'), 'name')?.answers ?? []).includes('10.0.0.20'), say: say('`gw` уже отвечает на имя, а `pc` спрашивает не его: проверьте `/etc/resolv.conf` на `pc`.', '`gw` already answers the name, but `pc` asks somebody else: check `/etc/resolv.conf` on `pc`.') }],
      },
      chips: 'echo address=/web.corp.lab/10.0.0.20 >> /etc/dnsmasq.conf && rc-service dnsmasq restart',
      docRef: { page: 'man/dnsmasq.8', anchor: 'OPTIONS', line: '--address' },
      concepts: ['net.dns', 'net.rr'],
      hints: {
        H1: ['dnsmasq отвечает именами из своего `/etc/hosts` и из ключей `address` и `host-record`.', 'dnsmasq answers with names from its `/etc/hosts` and from the `address` and `host-record` options.'],
        H2: ['`address=/web.corp.lab/10.0.0.20` в `/etc/dnsmasq.conf` и перезапуск; проверка — `dig @10.0.0.1 web.corp.lab` на `pc`.', '`address=/web.corp.lab/10.0.0.20` in `/etc/dnsmasq.conf` and a restart; check with `dig @10.0.0.1 web.corp.lab` on `pc`.'],
      },
    }),
    T({
      id: 'fixed',
      on: 'pc',
      levels: ['intermediate', 'experienced'],
      prompt: [
        'Принтерам и серверам удобнее постоянный адрес. Закрепите за MAC-адресом `pc` (02:64:74:00:00:63) адрес 10.0.0.50 и обновите аренду на `pc`.',
        'Printers and servers prefer a permanent address. Bind 10.0.0.50 to `pc`’s MAC address (02:64:74:00:00:63) and renew the lease on `pc`.',
      ],
      scopes: { pc: ['net'] },
      check: { when: (f) => hasAddr(f, '10.0.0.50/24') },
      docRef: { page: 'man/dnsmasq.8', anchor: 'OPTIONS', line: '--dhcp-host' },
      hints: {
        H1: ['Постоянную аренду по MAC задаёт ключ `dhcp-host`.', 'The `dhcp-host` option sets a permanent lease by MAC.'],
        H2: ['На `pc` старый адрес держится до конца аренды: сбросьте его (`ip addr flush dev eth0`) и спросите заново `udhcpc -i eth0`.', 'On `pc` the old address holds until the lease ends: flush it (`ip addr flush dev eth0`) and ask again with `udhcpc -i eth0`.'],
      },
    }),
  ],
};

export const LABS: Record<string, NetLabSpec> = Object.fromEntries([captureLab, vlanLab, routerLab, netnsLab, firewallLab, dnsmasqLab].map((l) => [l.id, l]));
