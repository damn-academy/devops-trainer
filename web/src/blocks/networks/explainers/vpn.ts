// E-VPN: a laptop at home reaches a server in the office network through a
// WireGuard tunnel. The kernel picks the wg0 route by the longest prefix,
// WireGuard encrypts the whole packet and puts it into a UDP datagram to the
// office gateway, the home router rewrites only the outer header, and the
// gateway takes the inner packet out and routes it on. The knob switches
// between a split tunnel and a tunnel for all traffic; the breaks are a
// network that drops UDP, a gateway that does not know the laptop's key and a
// server without a route back.
//
// Reading order: at the first step only the laptop and wg0 are on the
// diagram; the router, the internet, the gateway and the server appear when
// the packet reaches them.

import { defineModel } from '../../../core/define';
import type { ElementState, Step } from '../../../core/types';
import { b, brokenAt, card, edge, last, node } from './kit';

type P = { mode: string };

const ALL = ['router', 'net', 'gw', 'srv', 'out', 'wan1', 'wan2', 'lan', 'direct'];
const hide = (): Record<string, ElementState> => Object.fromEntries(ALL.map((id) => [id, 'hidden' as ElementState]));

const WG_DOC = { url: 'https://www.wireguard.com/#conceptual-overview', label: 'WireGuard · conceptual overview' };
const PING_LOST = '$ ping -c 2 10.20.3.7\nPING 10.20.3.7 (10.20.3.7) 56(84) bytes of data.\n\n--- 10.20.3.7 ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss, time 1001ms';

export const vpnModel = defineModel<P>({
  id: 'net.vpn',
  frame: 'visible',
  block: 'networks',
  title: b('Как VPN доставляет пакет из дома во внутреннюю сеть офиса', 'How a VPN carries a packet from home into the office network'),
  summary: b(
    'Ноутбук дома открывает сервер мониторинга с частным адресом 10.20.3.7 во внутренней сети офиса. Интерфейс wg0 на ноутбуке шифрует пакет целиком и вкладывает его в датаграмму UDP к шлюзу офиса, а шлюз достаёт исходный пакет и отправляет его дальше. Карточка на линии показывает, какой пакет идёт по этому участку; фигурные скобки означают, что содержимое зашифровано.',
    'A laptop at home opens a monitoring server with the private address 10.20.3.7 in the office network. The wg0 interface on the laptop encrypts the whole packet and puts it into a UDP datagram to the office gateway, and the gateway takes the original packet out and sends it on. The card on the line shows which packet travels on that segment; curly braces mean the contents are encrypted.',
  ),
  intro: b(
    'Схема соберётся по шагам, и сейчас на ней только ноутбук и его интерфейс wg0. А дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что он делает.\n\nПосле первого прохода переключите над схемой, какой трафик идёт в туннель, а потом включите поломки в блоке «Сломать».',
    'The diagram builds itself step by step: now it shows only the laptop and its wg0 interface. Then go on with “Step forward” above the diagram. The callout at the highlighted block says what it does.\n\nAfter the first pass switch which traffic goes into the tunnel above the diagram, then switch on the breaks in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: b('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: b('что этот блок делает', 'what it does') },
    { mark: 'token', text: b('пакет на этом участке; в фигурных скобках зашифрованное содержимое', 'the packet on this segment; encrypted contents in curly braces') },
    { mark: 'icon:terminal', text: b('ноутбук', 'laptop') },
    { mark: 'icon:lock', text: b('интерфейс VPN и шлюз VPN, которые шифруют и расшифровывают пакеты', 'the VPN interface and the VPN gateway, which encrypt and decrypt packets') },
    { mark: 'icon:router', text: b('роутер сети, к которой подключён ноутбук', 'the router of the network the laptop is on') },
    { mark: 'icon:server', text: b('сервер во внутренней сети офиса', 'a server in the office network') },
    { mark: 'ok', text: b('ответ вернулся к ноутбуку', 'the answer reached the laptop') },
    { mark: 'err', text: b('здесь пакет остановился', 'the packet stopped here') },
  ],
  stopLabel: b('Пакет не дошёл', 'The packet did not arrive'),
  diagram: {
    width: 1040,
    height: 380,
    nodes: [
      node('laptop', b('Ноутбук', 'Laptop'), 'user', [16, 56, 180, 72], card(['Ноутбук дома. У него два интерфейса: обычный eth0 с адресом домашней сети и интерфейс VPN wg0 с адресом 10.20.99.5 из сети офиса. Какой интерфейс получит пакет, ядро решает по таблице маршрутов, как в уроке о маршрутизации.', 'The laptop at home. It has two interfaces: the usual eth0 with a home network address and the VPN interface wg0 with the address 10.20.99.5 from the office network. Which interface gets a packet is decided by the kernel from the routing table, as in the routing lesson.'], ['Интерфейс wg0 создаёт программа wg-quick по файлу настроек, который выдал администратор офиса.', 'The wg0 interface is created by wg-quick from the configuration file the office administrator handed out.'], 'ip route get 10.20.3.7'), { icon: 'terminal', sub: 'eth0 192.168.1.23' }),
      node('wg0', b('Интерфейс wg0', 'Interface wg0'), 'tls', [16, 232, 180, 72], card(['Виртуальный сетевой интерфейс WireGuard. Всё, что ядро отправляет в wg0, WireGuard шифрует ключом собеседника, вкладывает в датаграмму UDP и отправляет на адрес шлюза через обычный интерфейс. Из-за второго заголовка пакет становится на 60 байт длиннее, а при внешнем IPv6 на 80, поэтому у wg0 по умолчанию MTU 1420, то есть 1500 − 80.', 'A virtual WireGuard network interface. Everything the kernel sends into wg0, WireGuard encrypts with the peer’s key, puts into a UDP datagram and sends to the gateway’s address through the ordinary interface. The second header makes the packet 60 bytes longer, or 80 with IPv6 outside, so wg0 has an MTU of 1420 by default, that is 1500 − 80.'], ['Ключи и адрес шлюза записаны в /etc/wireguard/wg0.conf.', 'The keys and the gateway address are in /etc/wireguard/wg0.conf.'], 'wg show wg0', WG_DOC), { icon: 'lock', sub: '10.20.99.5/32' }),
      node('router', b('Домашний роутер', 'Home router'), 'l3', [276, 56, 180, 72], card(['Роутер той сети, к которой подключён ноутбук, будь то квартира, кафе или гостиница. Для него туннель выглядит обычной датаграммой UDP, и он делает с ней то же, что с любым пакетом из квартиры: подменяет адрес отправителя своим публичным адресом.', 'The router of the network the laptop is on, be it a flat, a café or a hotel. To it the tunnel is an ordinary UDP datagram, and it does what it does with any packet from the flat: replaces the source address with its public one.'], ['Роутер принадлежит вам, кафе или гостинице, и о VPN он ничего не знает.', 'The router belongs to you, the café or the hotel, and it knows nothing about the VPN.'], 'conntrack -L -p udp'), { icon: 'router', sub: '203.0.113.7' }),
      node('net', b('Интернет', 'Internet'), 'l3', [516, 56, 180, 72], card(['Сети провайдеров между квартирой и офисом. Всё, что здесь видно постороннему, это внешний заголовок: адрес квартиры, адрес шлюза офиса и порт 51820. Адреса внутренней сети, протокол и содержимое спрятаны внутри зашифрованной части.', 'The providers’ networks between the flat and the office. All an outsider sees here is the outer header: the flat’s address, the office gateway’s address and port 51820. The internal addresses, the protocol and the contents are hidden inside the encrypted part.'], ['Участки принадлежат провайдерам и другим сетям.', 'These segments belong to providers and other networks.']), { icon: 'cloud' }),
      node('gw', b('Шлюз VPN офиса', 'Office VPN gateway'), 'tls', [756, 56, 220, 72], card(['Машина на границе офиса с публичным адресом. Она принимает датаграммы на порт 51820, проверяет, каким ключом они зашифрованы, расшифровывает и отправляет исходный пакет во внутреннюю сеть как обычный маршрутизатор. Пакеты, которые она не может проверить, она молча выбрасывает.', 'A machine at the office border with a public address. It accepts datagrams on port 51820, checks which key they are encrypted with, decrypts them and sends the original packet into the office network like an ordinary router. Packets it cannot verify it drops silently.'], ['Шлюз настраивает администратор офиса и записывает в него открытые ключи всех, кого пускает.', 'The office administrator sets the gateway up and records in it the public keys of everyone allowed in.'], 'wg show', WG_DOC), { icon: 'lock', sub: '203.0.113.40:51820' }),
      node('srv', b('Сервер мониторинга', 'Monitoring server'), 'node', [756, 232, 220, 72], card(['Сервер во внутренней сети офиса с частным адресом. Из интернета до него не добраться, а пакет из туннеля он получает от адреса 10.20.99.5, как от любой машины офиса.', 'A server in the office network with a private address. It cannot be reached from the internet, and it receives the packet from the tunnel from the address 10.20.99.5, as from any office machine.'], ['Сервер обслуживает команда эксплуатации.', 'The operations team runs the server.'], 'ip route'), { icon: 'server', sub: '10.20.3.7' }),
    ],
    edges: [
      edge('route', 'laptop', 'wg0', b('маршрут в wg0', 'route into wg0'), card(['Строка `10.20.0.0/16 dev wg0` в таблице маршрутов ноутбука. Её добавила программа wg-quick из поля AllowedIPs файла настроек. Для адресов офиса она точнее, чем `default`, и выигрывает по правилу самого длинного префикса.', 'The line `10.20.0.0/16 dev wg0` in the laptop’s routing table. wg-quick added it from the AllowedIPs field of the configuration. For office addresses it is more specific than `default` and wins by the longest prefix rule.'], ['Маршрут добавляет wg-quick при подключении.', 'wg-quick adds the route on connect.'], 'ip route')),
      edge('out', 'wg0', 'router', b('UDP к шлюзу', 'UDP to the gateway'), card(['Зашифрованная датаграмма уходит через обычный интерфейс eth0 и маршрут default, как любой другой пакет в интернет.', 'The encrypted datagram leaves through the ordinary eth0 interface and the default route, like any other packet to the internet.'], ['Датаграмму отправляет ядро ноутбука.', 'The laptop’s kernel sends the datagram.'], 'tcpdump -n -i eth0 udp port 51820')),
      edge('wan1', 'router', 'net', b('интернет', 'internet'), card(['Здесь у внешнего заголовка уже адрес роутера, 203.0.113.7.', 'Here the outer header already carries the router’s address, 203.0.113.7.'], ['Участок принадлежит провайдеру.', 'The provider’s segment.'])),
      edge('wan2', 'net', 'gw', b('к шлюзу офиса', 'to the office gateway'), card(['Датаграмма приходит на публичный адрес шлюза и порт 51820.', 'The datagram arrives at the gateway’s public address and port 51820.'], ['Участок принадлежит провайдеру офиса.', 'The office provider’s segment.'])),
      edge('lan', 'gw', 'srv', '10.20.0.0/16', card(['Внутренняя сеть офиса. По ней идёт уже исходный пакет с частными адресами, без шифрования и без второго заголовка.', 'The office network. The original packet with private addresses travels here, without encryption and without the second header.'], ['Сеть обслуживает администратор офиса.', 'The office administrator runs this network.'], 'tcpdump -n -i eth1 host 10.20.99.5')),
      edge('direct', 'laptop', 'router', b('мимо туннеля', 'past the tunnel'), card(['Пакеты, которым не подошёл маршрут в wg0, уходят через eth0 по маршруту default, как будто никакого VPN нет.', 'Packets for which the wg0 route did not match leave through eth0 by the default route, as if there were no VPN.'], ['Маршрут default выдал домашний роутер.', 'The home router handed out the default route.'], 'ip route get 198.51.100.20')),
    ],
  },
  params: [
    {
      id: 'mode',
      group: b('Что идёт через туннель', 'What goes through the tunnel'),
      label: b('Какой трафик ноутбука направлен в туннель', 'Which of the laptop’s traffic goes into the tunnel'),
      kind: 'choice',
      default: 'split',
      options: [
        { id: 'split', label: b('только трафик к сети офиса', 'only traffic to the office network') },
        { id: 'full', label: b('весь трафик ноутбука', 'all of the laptop’s traffic') },
      ],
      near: 'route',
      predict: {
        prompt: b('В туннель направили весь трафик ноутбука, а шлюз офиса подменяет адрес отправителя своим, как домашний роутер. С какого адреса сайт shop.example увидит запрос с ноутбука?', 'All of the laptop’s traffic now goes into the tunnel, and the office gateway replaces the source address with its own, like the home router. From which address will shop.example see the laptop’s request?'),
        options: [
          { id: 'office', text: b('С адреса шлюза офиса 203.0.113.40, потому что в интернет пакет выходит оттуда', 'From the office gateway’s 203.0.113.40, because the packet enters the internet there') },
          { id: 'home', text: b('С адреса домашнего роутера 203.0.113.7, потому что ноутбук стоит дома', 'From the home router’s 203.0.113.7, because the laptop is at home') },
        ],
        resolve: (_p, next) => (last(next).id === 'other' && (last(next).tokens ?? []).some((t) => t.edge === 'wan2') ? 'office' : 'home'),
      },
    },
  ],
  breaks: [
    {
      id: 'udp-blocked',
      label: b('Сеть гостиницы молча выбрасывает датаграммы UDP на порт 51820', 'The hotel network silently drops UDP datagrams to port 51820'),
      remove: ['wan1'],
      layer: 'L4',
      predict: {
        prompt: b('Ноутбук подключён к сети гостиницы, которая пропускает веб-трафик, но молча выбрасывает датаграммы UDP на порт 51820. Что вы увидите, когда отправите ping на 10.20.3.7?', 'The laptop is on a hotel network that lets web traffic through but silently drops UDP datagrams to port 51820. What do you see when you ping 10.20.3.7?'),
        options: [
          { id: 'silent', text: b('Ответов не будет: пакеты уходят в туннель и пропадают, а отказа никто не пришлёт', 'No answers: the packets go into the tunnel and vanish, and nobody sends a refusal') },
          { id: 'refused', text: b('Сразу придёт сообщение, что порт 51820 на шлюзе закрыт', 'A message that port 51820 on the gateway is closed arrives at once') },
          { id: 'direct', text: b('Ping пройдёт мимо туннеля, через обычный интернет', 'The ping goes past the tunnel, through the ordinary internet') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'router' ? 'silent' : 'direct'),
      },
    },
    {
      id: 'no-peer',
      label: b('Администратор удалил открытый ключ ноутбука из настроек шлюза', 'The administrator removed the laptop’s public key from the gateway’s settings'),
      remove: ['lan'],
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: b('Администратор удалил открытый ключ ноутбука из настроек шлюза, а сеть между ними в порядке. Что шлюз ответит на зашифрованные датаграммы ноутбука?', 'The administrator removed the laptop’s public key from the gateway’s settings, and the network between them is fine. What does the gateway answer to the laptop’s encrypted datagrams?'),
        options: [
          { id: 'silent', text: b('Ничего, потому что шлюз молча выбрасывает датаграммы, которые не может проверить', 'Nothing: the gateway silently drops datagrams it cannot verify') },
          { id: 'reject', text: b('Шлюз пришлёт сообщение о том, что ключ не подошёл', 'The gateway sends a message that the key did not fit') },
          { id: 'plain', text: b('Шлюз пропустит пакеты во внутреннюю сеть без проверки', 'The gateway lets the packets into the office network without a check') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'gw' ? 'silent' : 'plain'),
      },
    },
    {
      id: 'no-route-back',
      label: b('У сервера мониторинга нет маршрута обратно к адресам VPN 10.20.99.0/24', 'The monitoring server has no route back to the VPN addresses 10.20.99.0/24'),
      remove: [],
      layer: 'L3',
      predict: {
        prompt: b('У сервера мониторинга нет маршрута к адресам VPN 10.20.99.0/24, и ответы он отправляет своему обычному шлюзу. Дойдёт ли запрос с ноутбука до сервера?', 'The monitoring server has no route to the VPN addresses 10.20.99.0/24 and sends its answers to its ordinary gateway. Will the laptop’s request reach the server?'),
        options: [
          { id: 'oneway', text: b('Запрос дойдёт, а ответ уйдёт не туда, и ping покажет полную потерю', 'The request arrives, the answer goes the wrong way, and ping shows total loss') },
          { id: 'none', text: b('Запрос не дойдёт даже до сервера, его выбросит шлюз', 'The request does not even reach the server; the gateway drops it') },
          { id: 'ok', text: b('Всё сработает, потому что шлюз запомнил, откуда пришёл запрос', 'It all works, because the gateway remembered where the request came from') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'srv' ? 'oneway' : 'ok'),
      },
    },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    steps.push({
      id: 'route',
      label: b('маршрут', 'route'),
      caption: b('Браузер на ноутбуке открывает http://10.20.3.7:3000/, страницу мониторинга в сети офиса. Ядро ищет маршрут: строка 10.20.0.0/16 dev wg0 подходит к адресу точнее, чем default, поэтому пакет уходит не в eth0, а в интерфейс wg0.', 'The browser on the laptop opens http://10.20.3.7:3000/, the monitoring page in the office network. The line 10.20.0.0/16 dev wg0 matches the address more precisely than default, so the kernel sends the packet into wg0, not eth0.'),
      focus: ['laptop', 'route'],
      tokens: [{ edge: 'route', label: '10.20.99.5 → 10.20.3.7' }],
      say: { laptop: b('Ядро выбирает для адреса 10.20.3.7 маршрут через wg0.', 'The kernel routes 10.20.3.7 through wg0.') },
      states: { ...hide(), laptop: 'on', wg0: 'on', route: 'on' },
    });
    steps.push({
      id: 'wrap',
      label: b('шифрование', 'encryption'),
      caption: b('WireGuard шифрует пакет целиком, вместе с его заголовком и частными адресами, и кладёт результат в новую датаграмму UDP, адресованную шлюзу офиса 203.0.113.40 на порт 51820.', 'WireGuard encrypts the whole packet, with its header and private addresses, and puts the result into a new UDP datagram addressed to the office gateway 203.0.113.40, port 51820.'),
      focus: ['wg0', 'out'],
      tokens: [{ edge: 'out', label: 'UDP → 203.0.113.40:51820 {…}' }],
      say: { wg0: b('WireGuard шифрует пакет и вкладывает его в датаграмму UDP к шлюзу.', 'WireGuard encrypts the packet and wraps it into a UDP datagram to the gateway.') },
      states: { out: 'on', router: 'on' },
    });
    steps.push({
      id: 'headers',
      label: b('два заголовка', 'two headers'),
      caption: b('Теперь у пакета два заголовка IP. Внешний заголовок с адресами ноутбука и шлюза видит каждый, кто передаёт датаграмму, а внутренний, с частными адресами офиса, спрятан в зашифрованной части.', 'The packet now has two IP headers. The outer header with the addresses of the laptop and the gateway is visible to everyone who passes the datagram on, and the inner one, with the office’s private addresses, is hidden in the encrypted part.'),
      focus: ['out'],
      tokens: [{ edge: 'out', label: 'UDP → 203.0.113.40:51820 {…}' }],
    });
    if (broken.has('udp-blocked')) {
      steps.push({
        id: 'blocked',
        label: b('фильтр', 'filter'),
        caption: p.mode === 'full'
          ? b('Сеть гостиницы выбрасывает датаграмму и никому об этом не сообщает. Ноутбук не получает ни ответа, ни отказа, поэтому ping к 10.20.3.7 молчит. Обычные сайты тоже не открываются, потому что в режиме «весь трафик ноутбука» запросы к ним идут через тот же туннель.', 'The hotel network drops the datagram and tells nobody. The laptop gets neither an answer nor a refusal, so a ping to 10.20.3.7 stays silent. Ordinary sites do not open either, because with all of the laptop’s traffic in the tunnel their requests go through the same tunnel.')
          : b('Сеть гостиницы выбрасывает датаграмму и никому об этом не сообщает. Ноутбук не получает ни ответа, ни отказа, поэтому ping к 10.20.3.7 молчит, а сайты по HTTPS при этом открываются: они идут мимо туннеля по TCP на порт 443.', 'The hotel network drops the datagram and tells nobody. The laptop gets neither an answer nor a refusal, so a ping to 10.20.3.7 stays silent, while HTTPS sites still open: they go past the tunnel over TCP to port 443.'),
        focus: ['router'],
        say: { router: b('Фильтр сети молча выбрасывает датаграмму UDP на порт 51820.', 'The network’s filter silently drops the UDP datagram to port 51820.') },
        states: { router: 'err' },
        broken: { at: 'router', message: `${PING_LOST}\n$ wg show wg0\ninterface: wg0\n  listening port: 41414\n\npeer: xTIBA5rboUvnH4htodjb6e697QjLERt1NAB4mZqp8Dg=\n  endpoint: 203.0.113.40:51820\n  allowed ips: 10.20.0.0/16\n  transfer: 0 B received, 1.45 KiB sent`, caption: b('Такую поломку узнают по тому, что WireGuard ничего не получил в ответ: в строке transfer вывода wg show принято 0 байт, а строки latest handshake нет совсем, потому что рукопожатие так и не состоялось.', 'This break is recognised by WireGuard having received nothing: in wg show the received byte counter is zero, and there is no latest handshake line at all, because the handshake never happened.') },
      });
      return steps;
    }
    steps.push({
      id: 'nat',
      label: b('NAT', 'NAT'),
      caption: b('Домашний роутер видит обычную датаграмму UDP и, как с любым пакетом из квартиры, подменяет во внешнем заголовке адрес отправителя своим адресом 203.0.113.7. Во внутренний пакет роутер не заглядывает, потому что тот зашифрован.', 'The home router sees an ordinary UDP datagram and, as with any packet from the flat, replaces the source address in the outer header with its own address 203.0.113.7. The router does not look into the inner packet, because it is encrypted.'),
      focus: ['router', 'wan1'],
      tokens: [{ edge: 'wan1', label: '203.0.113.7 → 203.0.113.40 {…}' }],
      say: { router: b('Роутер подменяет адрес во внешнем заголовке.', 'The router swaps the address in the outer header.') },
      states: { wan1: 'on', net: 'on' },
    });
    steps.push({
      id: 'wire',
      label: b('в интернете', 'on the internet'),
      caption: b('По интернету идёт зашифрованная датаграмма. Провайдер и любой на пути видят только внешний заголовок: адрес квартиры, адрес шлюза офиса и порт 51820. К какому серверу внутри офиса вы обращаетесь и что передаёте, им не видно.', 'The encrypted datagram crosses the internet. The provider and anyone on the path see only the outer header, with the flat’s address, the gateway’s address and port 51820. Which office server you talk to and what you send, they cannot see.'),
      focus: ['net', 'wan2'],
      tokens: [{ edge: 'wan2', label: 'UDP 51820 {…}' }],
      say: { net: b('Сети провайдеров передают датаграмму, не видя, что у неё внутри.', 'The providers pass the datagram on unopened.') },
      states: { wan2: 'on', gw: 'on' },
    });
    if (broken.has('no-peer')) {
      steps.push({
        id: 'unknown',
        label: b('чужой ключ', 'unknown key'),
        caption: b('Шлюз не находит среди своих собеседников ключ, которым зашифрована датаграмма, и молча выбрасывает её. WireGuard не отвечает тем, кого не знает, поэтому снаружи шлюз ничем не отличается от выключенной машины.', 'The gateway finds no peer whose key the datagram is encrypted with and silently drops it. WireGuard does not answer those it does not know, so from outside the gateway looks no different from a machine that is off.'),
        focus: ['gw'],
        say: { gw: b('Шлюз не может проверить датаграмму и выбрасывает её без ответа.', 'The gateway cannot verify the datagram and drops it without an answer.') },
        states: { gw: 'err' },
        broken: { at: 'gw', message: `${PING_LOST}\n$ wg show wg0 latest-handshakes\nxTIBA5rboUvnH4htodjb6e697QjLERt1NAB4mZqp8Dg=\t0`, caption: b('С ноутбука эта поломка выглядит так же, как фильтр по дороге: рукопожатия нет, ответа тоже. Различить их можно только на самом шлюзе. Команда tcpdump -n udp port 51820 на шлюзе покажет, что датаграммы ноутбука приходят, а в выводе wg show на шлюзе ключа ноутбука среди собеседников не будет, значит, датаграммы доходят, но шлюз их отвергает.', 'From the laptop this break looks like a filter on the way: no handshake and no answer. Only the gateway itself can tell them apart. tcpdump -n udp port 51820 on the gateway shows the laptop’s datagrams arriving, and wg show on the gateway does not list the laptop’s key among the peers: the datagrams arrive but the gateway rejects them.') },
      });
      return steps;
    }
    steps.push({
      id: 'unwrap',
      label: b('расшифровка', 'decryption'),
      caption: b('Шлюз проверяет, что датаграмма зашифрована ключом ноутбука, расшифровывает её и достаёт исходный пакет 10.20.99.5 → 10.20.3.7. Дальше шлюз работает как обычный маршрутизатор и отправляет этот пакет во внутреннюю сеть офиса.', 'The gateway checks that the datagram is encrypted with the laptop’s key, decrypts it and takes out the original packet 10.20.99.5 → 10.20.3.7. From here the gateway works as an ordinary router and sends it into the office network.'),
      focus: ['gw', 'lan'],
      tokens: [{ edge: 'lan', label: '10.20.99.5 → 10.20.3.7' }],
      say: { gw: b('Шлюз пересылает исходный пакет в сеть офиса.', 'The gateway forwards the packet into the office network.') },
      states: { lan: 'on', srv: 'on' },
    });
    if (broken.has('no-route-back')) {
      steps.push({
        id: 'lost',
        label: b('ответ не туда', 'answer astray'),
        caption: b('Сервер получает запрос и отвечает на адрес 10.20.99.5, но маршрута к этой сети у него нет, и ответ уходит по маршруту default обычному шлюзу офиса, который о VPN ничего не знает.', 'The server gets the request and answers to 10.20.99.5, but it has no route to that network, so the answer leaves by the default route to the office’s ordinary gateway, which knows nothing about the VPN.'),
        focus: ['srv'],
        say: { srv: b('Сервер отправляет ответ по маршруту default, мимо шлюза VPN.', 'The server sends the answer by the default route, past the VPN gateway.') },
        states: { srv: 'err' },
        broken: { at: 'srv', message: `${PING_LOST}\n$ ssh monitor tcpdump -n -c 2 icmp\n10:02:11.400 IP 10.20.99.5 > 10.20.3.7: ICMP echo request, id 7, seq 1, length 64\n10:02:11.400 IP 10.20.3.7 > 10.20.99.5: ICMP echo reply, id 7, seq 1, length 64`, caption: b('Это тот же «пинг в одну сторону», что в уроке о маршрутизации: запрос дошёл, а ответ нет. Захват на сервере показывает и пришедшие запросы, и отправленные ответы, а до ноутбука ответы не доходят. Значит, на пути обратно нет маршрута к адресам VPN: его добавляют на сервере или на обычном шлюзе офиса.', 'It is the same one-way ping as in the routing lesson: the request arrived, the answer did not. A capture on the server shows both the incoming requests and the answers sent, yet the answers never reach the laptop. So the way back has no route to the VPN addresses: it is added on the server or on the office’s ordinary gateway.') },
      });
      return steps;
    }
    steps.push({
      id: 'reply',
      label: b('ответ', 'answer'),
      caption: b('Сервер видит запрос от адреса 10.20.99.5, как от любой машины офиса, и отвечает. Маршрут к сети 10.20.99.0/24 ведёт через шлюз VPN, поэтому ответ уходит к шлюзу.', 'The server sees the request from 10.20.99.5, as from any office machine, and answers. The route to the network 10.20.99.0/24 leads through the VPN gateway, so the answer goes to the gateway.'),
      focus: ['srv', 'lan'],
      tokens: [{ edge: 'lan', reverse: true, label: '10.20.3.7 → 10.20.99.5' }],
      say: { srv: b('Сервер отвечает на адрес 10.20.99.5 через шлюз VPN.', 'The server answers 10.20.99.5 through the VPN gateway.') },
    });
    steps.push({
      id: 'back',
      label: b('обратно', 'back'),
      caption: b('Дальше ответ проходит тот же путь в обратную сторону. Шлюз шифрует его и вкладывает в датаграмму к роутеру квартиры, а интерфейс wg0 на ноутбуке расшифровывает ответ и отдаёт его браузеру.', 'From here the answer takes the same path back. The gateway encrypts it and wraps it into a datagram to the flat’s router, and the wg0 interface on the laptop decrypts the answer and hands it to the browser.'),
      focus: ['gw', 'wg0', 'laptop'],
      tokens: [{ edge: 'wan2', reverse: true, label: 'UDP 51820 {…}' }],
      say: { wg0: b('Интерфейс wg0 расшифровывает ответ сервера.', 'The wg0 interface decrypts the server’s answer.') },
      states: { laptop: 'ok' },
    });
    const full = p.mode === 'full';
    steps.push({
      id: 'other',
      label: b('прочий трафик', 'other traffic'),
      caption: full
        ? b('В туннель направлен весь трафик, потому что маршрут default тоже ведёт в wg0. Поэтому даже запрос к shop.example уходит в туннель и выходит в интернет через шлюз офиса, и сайт видит адрес офиса 203.0.113.40, а не адрес квартиры.', 'All traffic goes into the tunnel, because the default route leads into wg0 as well. So even the request to shop.example goes into the tunnel and enters the internet through the office gateway, and the site sees the office address 203.0.113.40, not the flat’s.')
        : b('Запрос к сайту shop.example под строку 10.20.0.0/16 не подходит, поэтому ядро отправляет его по маршруту default через eth0, мимо туннеля, и сайт видит адрес квартиры. Такой туннель называют разделённым, потому что через офис идёт только трафик к сети офиса.', 'The request to shop.example does not match the line 10.20.0.0/16, so the kernel sends it by the default route through eth0, past the tunnel, and the site sees the flat’s address. Such a tunnel is called split, since only office traffic goes through it.'),
      focus: full ? ['route', 'wg0', 'gw'] : ['direct', 'laptop'],
      tokens: full ? [{ edge: 'route', label: '→ shop.example' }, { edge: 'wan2', label: 'UDP 51820 {…}' }] : [{ edge: 'direct', label: '→ shop.example' }],
      say: full ? { gw: b('Шлюз выпускает запрос в интернет.', 'The gateway lets the request out.') } : { laptop: b('Запрос уходит мимо туннеля.', 'The request bypasses the tunnel.') },
      states: full ? {} : { direct: 'on' },
    });
    return steps;
  },
  explainDelta(_prev, next, change, _a, bb) {
    if (change.kind === 'break') {
      if (!change.on) return b('Поломку убрали, и пакет снова доходит до сервера и обратно.', 'The break is gone, and the packet again reaches the server and comes back.');
      const at = brokenAt(next);
      if (at === 'router') return bb.mode === 'full'
        ? b('Датаграммы туннеля пропадают в сети гостиницы, и ни ответа, ни отказа ноутбук не получает. Весь трафик ноутбука идёт через туннель, поэтому обычные сайты тоже перестают открываться.', 'The tunnel’s datagrams vanish in the hotel network, and the laptop gets neither an answer nor a refusal. All of the laptop’s traffic goes through the tunnel, so ordinary sites stop opening too.')
        : b('Датаграммы туннеля пропадают в сети гостиницы, и ни ответа, ни отказа ноутбук не получает. Обычные сайты при этом открываются, потому что идут мимо туннеля.', 'The tunnel’s datagrams vanish in the hotel network, and the laptop gets neither an answer nor a refusal. Ordinary sites still open, because they go past the tunnel.');
      if (at === 'gw') return b('Шлюз выбрасывает датаграммы с незнакомым ключом и не отвечает на них, поэтому снаружи поломка выглядит как тишина.', 'The gateway drops datagrams with an unknown key and does not answer them, so from outside the break looks like silence.');
      return b('Запрос доходит до сервера, а ответ уходит мимо шлюза VPN, поэтому ping показывает полную потерю, хотя сервер отвечает.', 'The request reaches the server, but the answer goes past the VPN gateway, so ping shows total loss although the server answers.');
    }
    return bb.mode === 'full'
      ? b('Теперь в туннель идёт весь трафик ноутбука, и сайты видят адрес офиса, а не квартиры. Так настраивают VPN, когда весь трафик сотрудников должен проходить через фильтры компании.', 'Now all of the laptop’s traffic goes into the tunnel, and sites see the office address, not the flat’s. A VPN is set up this way when all of the staff’s traffic must pass the company’s filters.')
      : b('Теперь в туннель идёт только трафик к сети офиса, а остальные запросы уходят мимо него.', 'Now only traffic to the office network goes into the tunnel, and other requests go past it.');
  },
});
