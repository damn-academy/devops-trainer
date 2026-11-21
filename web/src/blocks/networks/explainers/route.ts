// E-ROUTE (03 §7.4, screens 1–3): a packet leaves its subnet through a
// router. The host chooses a route, finds the gateway's MAC with ARP, the
// router decrements TTL, picks the longest matching prefix and puts the packet
// into a new frame. IP addresses stay, MAC addresses change at every hop.
//
// Reading order: at the first step only h1 and its routing table are on the
// diagram; the router, its table, h2 and the table of h2 appear when the
// packet reaches them. The acting block says in a callout what it does, the
// packet travels along the subnet as a card with its TTL.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { ElementState, Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { ttl: number; forward: boolean; back: boolean };

const M = { h1: '02:00:00:00:01:10', r1a: '02:00:00:00:01:01', r1b: '02:00:00:00:02:01', h2: '02:00:00:00:02:10' };

const HIDDEN: Record<string, ElementState> = Object.fromEntries(['r1', 'h2', 't2', 't3', 'l1', 'l2'].map((id) => [id, 'hidden' as ElementState]));

export const routeModel = defineModel<P>({
  id: 'net.route',
  frame: 'visible',
  block: 'networks',
  title: b('Как пакет проходит через маршрутизатор в соседнюю подсеть', 'How a packet crosses a router into the next subnet'),
  summary: b(
    'Компьютер h1 с адресом 10.0.1.10 отправляет эхо-запрос ping компьютеру h2 с адресом 10.0.2.10 в соседней подсети, а между подсетями стоит маршрутизатор r1. Схема показывает, как каждый участник выбирает строку в своей таблице маршрутов и почему IP-адреса пакета по дороге не меняются, а MAC-адреса кадра меняются на каждом участке.',
    'Computer h1 (10.0.1.10) pings h2 (10.0.2.10) in the next subnet; router r1 stands between the subnets. The diagram shows how each participant picks a line in its routing table and why the packet’s IP addresses stay the same while the frame’s MAC addresses change on every segment.',
  ),
  intro: b(
    'Схема соберётся по шагам: сейчас на ней только компьютер h1 и его таблица маршрутов. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что он делает, а карточка на линии показывает пакет и его TTL.\n\nПосле первого прохода уменьшите TTL до единицы, уберите у h2 маршрут обратно и попробуйте поломки в блоке «Сломать».',
    'The diagram builds itself step by step: now it shows only h1 and its routing table. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted block says what it does; the card on the line shows the packet and its TTL.\n\nAfter the first pass lower the TTL to one, remove h2’s route back and try the breaks in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: b('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: b('что этот блок делает', 'what it does') },
    { mark: 'token', text: b('пакет или вопрос ARP на линии', 'a packet or an ARP question on the line') },
    { mark: 'icon:terminal', text: b('компьютер', 'computer') },
    { mark: 'icon:router', text: b('маршрутизатор', 'router') },
    { mark: 'icon:file', text: b('таблица маршрутов', 'routing table') },
    { mark: 'ok', text: b('пакет и ответ дошли', 'the packet and the reply arrived') },
    { mark: 'warn', text: b('пакет выброшен, но отправителю сообщили об этом', 'the packet was dropped and the sender was told') },
    { mark: 'err', text: b('здесь пакет остановился', 'the packet stopped here') },
  ],
  stopLabel: b('Пакет не дошёл', 'The packet did not arrive'),
  diagram: {
    width: 960,
    height: 420,
    nodes: [
      node('h1', b('Компьютер h1', 'Computer h1'), 'user', [16, 64, 152, 64], card(['Компьютер в подсети 10.0.1.0/24. Машины своей подсети он достигает напрямую, а всё остальное отправляет через шлюз.', 'A host in subnet 10.0.1.0/24. It reaches its own subnet directly and everything else through the gateway.'], ['Адрес компьютеру назначил администратор или сервер DHCP.', 'The administrator or a DHCP server gave it its address.'], 'ip -br a'), { sub: '10.0.1.10', icon: 'terminal' }),
      node('r1', b('Маршрутизатор r1', 'Router r1'), 'l3', [392, 56, 176, 80], card(['Роль маршрутизатора здесь выполняет обычная машина с Linux, у которой два сетевых интерфейса и включена пересылка пакетов (параметр net.ipv4.ip_forward=1). Он принимает пакеты, адресованные не ему, и отправляет их дальше по своей таблице маршрутов.', 'A router is an ordinary Linux machine with two interfaces and forwarding on (net.ipv4.ip_forward=1). It accepts packets not addressed to it and sends them on by its routing table.'], ['Маршрутизатор настраивает администратор сети.', 'The network administrator.'], 'sysctl net.ipv4.ip_forward'), { sub: '10.0.1.1 | 10.0.2.1', icon: 'router', work: 'spin' }),
      node('h2', b('Компьютер h2', 'Computer h2'), 'user', [792, 64, 152, 64], card(['Компьютер в подсети 10.0.2.0/24. Чтобы ответить компьютеру h1, ему тоже нужен маршрут, но уже в обратную сторону.', 'A host in subnet 10.0.2.0/24. To answer, it also needs a route — back.'], ['Адрес компьютеру назначил администратор или сервер DHCP.', 'The administrator or a DHCP server.'], 'ip r'), { sub: '10.0.2.10', icon: 'terminal' }),
      node('t1', b('Маршруты h1', 'Routes of h1'), 'obj', [24, 232, 280, 96], card(['Таблица маршрутов компьютера h1. Ядро выбирает строку, префикс которой содержит адрес получателя, а если подходят несколько строк, берёт самую длинную; это правило называют longest prefix match. Строка default означает 0.0.0.0/0, то есть подходит любому адресу, но длина её префикса равна нулю, поэтому её выбирают последней.', 'The routing table of h1. The kernel picks the line whose prefix contains the destination; of several, the longest (longest prefix match). “default” is 0.0.0.0/0: it matches everything, with length zero.'], ['Строку своей подсети добавляет ядро, а маршрут через шлюз задаёт администратор или сервер DHCP.', 'The kernel (the interface’s subnet), the administrator or DHCP (the gateway).'], 'ip route', DOC.ipRoute), { shape: 'doc', sub: 'default via 10.0.1.1', icon: 'file' }),
      node('t2', b('Маршруты r1', 'Routes of r1'), 'obj', [340, 232, 280, 96], card(['У маршрутизатора r1 обе подсети подключены напрямую. Строки с пометкой «proto kernel scope link» ядро добавило само, когда интерфейсам назначили адреса.', 'On r1 both subnets are connected directly: the “proto kernel scope link” lines were added by the kernel when the interfaces got their addresses.'], ['Эти строки добавило ядро.', 'The kernel.'], 'ip route', DOC.ipRoute), { shape: 'doc', sub: '10.0.2.0/24 dev eth1', icon: 'file' }),
      node('t3', b('Маршруты h2', 'Routes of h2'), 'obj', [656, 232, 280, 96], card(['Если у компьютера h2 нет маршрута к 10.0.1.0/24 или маршрута по умолчанию, он получит запрос, но отправить ответ ему будет некуда.', 'Without a route to 10.0.1.0/24 (or a default route) h2 receives the request but cannot send the answer.'], ['Маршрут задаёт администратор или сервер DHCP.', 'The administrator or DHCP.'], 'ip route get 10.0.1.10'), { shape: 'doc', sub: 'default via 10.0.2.1', icon: 'file' }),
    ],
    edges: [
      edge('l1', 'h1', 'r1', '10.0.1.0/24', card(['Первая подсеть. Кадр на этом участке идёт от MAC-адреса компьютера h1 к MAC-адресу маршрутизатора r1, а не компьютера h2.', 'The first subnet. The frame on this segment: sender MAC is h1, receiver MAC is r1 (not h2!).'], ['Подсеть настроил администратор.', 'The administrator.'], 'tcpdump -n -e -i eth0'), { labelAt: 0.2 }),
      edge('l2', 'r1', 'h2', '10.0.2.0/24', card(['Вторая подсеть. На этом участке кадр уже другой. Он идёт от MAC-адреса r1 к MAC-адресу h2, а IP-адреса внутри остались прежними.', 'The second subnet. The frame here is different: r1’s MAC → h2’s MAC. The IP addresses inside are the same.'], ['Подсеть настроил администратор.', 'The administrator.'], 'tcpdump -n -e -i eth1'), { labelAt: 0.2 }),
    ],
  },
  params: [
    {
      id: 'ttl',
      group: b('Что отправляет h1', 'What h1 sends'),
      label: b('С каким TTL компьютер h1 отправляет пакет', 'The TTL h1 sends the packet with'),
      kind: 'range',
      min: 1,
      max: 255,
      step: 1,
      default: 64,
      near: 'l1',
      predict: {
        prompt: b('Компьютер h1 отправляет пакет с TTL, равным 1, а между ним и h2 стоит один маршрутизатор. Дойдёт ли пакет до h2?', 'The packet leaves with TTL = 1 and there is one router between h1 and h2. Will it reach h2?'),
        options: [
          { id: 'no', text: b('Нет, маршрутизатор уменьшит TTL до нуля, выбросит пакет и сообщит об этом компьютеру h1', 'No: r1 decrements TTL to zero, drops the packet and reports it') },
          { id: 'yes', text: b('Да, потому что одного шага TTL хватает, чтобы пройти один маршрутизатор', 'Yes: one unit of TTL is enough for one router') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'deliver') ? 'yes' : 'no'),
      },
    },
    {
      id: 'back',
      group: b('Как настроены машины', 'How the machines are set up'),
      label: b('У компьютера h2 есть маршрут обратно, в подсеть h1', 'h2 has a route back to h1’s subnet'),
      kind: 'toggle',
      default: true,
      near: 't3',
      predict: {
        prompt: b('У компьютера h2 удалили маршрут по умолчанию, а остальное осталось прежним. Что произойдёт с эхо-запросом от h1?', 'h2 lost its default route. What happens to the ping?'),
        options: [
          { id: 'oneway', text: b('Запрос дойдёт до h2, а ответ обратно не уйдёт', 'The request reaches h2, the reply does not') },
          { id: 'nothing', text: b('Запрос даже не дойдёт до h2', 'The request does not reach h2') },
          { id: 'ok', text: b('Всё будет работать, потому что h2 отвечает тому, кто спросил', 'Everything works: h2 answers whoever asked') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'deliver') ? (next.some((s) => s.id === 'back') ? 'ok' : 'oneway') : 'nothing'),
      },
    },
    { id: 'forward', group: b('Как настроены машины', 'How the machines are set up'), label: b('На маршрутизаторе r1 включена пересылка пакетов (ip_forward)', 'Forwarding is on at r1 (ip_forward)'), kind: 'toggle', default: true, near: 'r1', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'no-default',
      label: b('У компьютера h1 удалён маршрут по умолчанию', 'h1’s default route is deleted'),
      remove: ['t1'],
      predict: {
        prompt: b('У компьютера h1 нет маршрута по умолчанию, а адрес 10.0.2.10 лежит вне его подсети. Где остановится пакет?', 'h1 has no default route. Where does the packet to 10.0.2.10 stop?'),
        options: [
          { id: 'born', text: b('Пакет не покинет h1, потому что ядро даже не создаст его', 'It will not leave h1: the kernel will not even create it') },
          { id: 'r1', text: b('На маршрутизаторе r1, потому что тот не знает, куда его передать', 'At r1, because r1 does not know where to pass it') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'h1' ? 'born' : 'r1'),
      },
    },
    {
      id: 'r1-off',
      label: b('Маршрутизатор r1 выключен', 'Router r1 is off'),
      remove: ['r1'],
      predict: {
        prompt: b('Маршрутизатор r1 выключен, а маршрут через него у h1 остался. Что напечатает ping на компьютере h1?', 'The router is off. What will ping on h1 print?'),
        options: [
          { id: 'host', text: b('Строку «From 10.0.1.10 … Destination Host Unreachable»', '“From 10.0.1.10 … Destination Host Unreachable”') },
          { id: 'net', text: b('Строку «connect: Network is unreachable»', '“connect: Network is unreachable”') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'r1' ? 'host' : 'net'),
      },
    },
  ],
  metrics: [
    { id: 'ttl', label: b('TTL пакета у получателя', 'TTL at the receiver') },
    { id: 'routers', label: b('маршрутизаторов на пути', 'routers on the way') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const noDef = broken.has('no-default');
    steps.push({
      id: 'decide',
      label: b('маршрут', 'route'),
      caption: noDef
        ? b('Компьютер h1 ищет в таблице маршрутов строку для адреса 10.0.2.10. В таблице есть только своя подсеть 10.0.1.0/24, а она этому адресу не подходит, так что маршрута нет.', 'h1 looks for a routing line for 10.0.2.10. There is only its own subnet 10.0.1.0/24 — it does not match. There is no route.')
        : b('Компьютер h1 ищет в таблице маршрутов строку для адреса 10.0.2.10. Своя подсеть 10.0.1.0/24 не подходит, зато подходит строка default, которая велит отправлять такие пакеты через шлюз 10.0.1.1.', 'h1 looks for a routing line for 10.0.2.10. Its own subnet 10.0.1.0/24 does not match; default does: “via gateway 10.0.1.1”.'),
      focus: ['h1', 't1'],
      say: { h1: noDef ? b('Компьютер h1 не находит в таблице ни одной строки для 10.0.2.10.', 'h1 finds no line for 10.0.2.10.') : b('Компьютер h1 выбирает строку default, и пакет пойдёт через шлюз 10.0.1.1.', 'h1 picks the default line: via gateway 10.0.1.1.') },
      states: { ...HIDDEN, h1: 'on', t1: noDef ? 'err' : 'on' },
      values: { t1: noDef ? '10.0.1.0/24 dev eth0' : 'default via 10.0.1.1' },
      metrics: { routers: 0 },
      ...(noDef
        ? { broken: { at: 'h1', message: '$ ping -c 1 10.0.2.10\nping: connect: Network is unreachable', caption: b('Пакет даже не был создан, потому что ядро не знает, в какой интерфейс его отдать. Такая ошибка появляется мгновенно и возникает на самой машине, без единого кадра в сети.', 'the packet was never born: the kernel does not know which interface to give it to. The error is instant and local.') } }
        : {}),
    });
    if (noDef) return steps;
    steps.push({
      id: 'arp',
      label: 'ARP',
      caption: b('Пакет пойдёт к шлюзу, значит, кадру нужен MAC-адрес шлюза, а не компьютера h2. Поэтому h1 спрашивает по ARP, у кого адрес 10.0.1.1. Это и есть ответ на загадку из урока про ARP.', 'The packet goes to the gateway, so the frame needs the gateway’s MAC, not h2’s. h1 asks over ARP: “who has 10.0.1.1?” — this solves the riddle of the ARP lesson.'),
      focus: ['h1', 'l1'],
      tokens: [{ edge: 'l1', label: 'who-has 10.0.1.1' }],
      say: { h1: b('Компьютер h1 спрашивает по ARP MAC-адрес шлюза 10.0.1.1.', 'h1 asks over ARP for the MAC of gateway 10.0.1.1.') },
      states: { l1: 'on', r1: broken.has('r1-off') ? 'off' : 'on' },
      metrics: { routers: 0 },
    });
    if (broken.has('r1-off')) {
      steps.push({
        id: 'no-gw',
        label: b('нет шлюза', 'no gateway'),
        caption: b('Шлюз не отвечает на вопрос ARP, поэтому кадр собрать нельзя. Компьютер h1 трижды повторяет вопрос и прекращает попытки.', 'The gateway does not answer ARP: the frame cannot be built. h1 repeats the question three times and gives up.'),
        focus: ['h1', 'l1'],
        say: { h1: b('Компьютер h1 не дождался ответа от шлюза и сообщает, что тот недоступен.', 'h1 got no answer from the gateway and reports it unreachable.') },
        states: { r1: 'off', h1: 'err' },
        metrics: { routers: 0 },
        broken: { at: 'r1', message: '$ ping -c 2 10.0.2.10\nFrom 10.0.1.10 icmp_seq=1 Destination Host Unreachable\nFrom 10.0.1.10 icmp_seq=2 Destination Host Unreachable', caption: b('Маршрут у h1 есть, но шлюза, через который он идёт, в сети нет, поэтому ошибку пишет сам компьютер h1.', 'the route exists, but the gateway neighbour is not on the network: h1 itself reports the error.') },
      });
      return steps;
    }
    steps.push({
      id: 'to-r1',
      label: b('кадр 1', 'frame 1'),
      caption: fmt(b('Компьютер h1 отправляет кадр от MAC-адреса {a} к MAC-адресу {r}. Внутри кадра лежит IP-пакет от 10.0.1.10 к 10.0.2.10 с TTL, равным {t}.', 'Frame: MAC {a} → MAC {r}. Inside, an IP packet 10.0.1.10 → 10.0.2.10, TTL {t}.'), { a: M.h1, r: M.r1a, t: p.ttl }),
      focus: ['l1', 'r1'],
      tokens: [{ edge: 'l1', label: `MAC …01:10 → …01:01 · IP .1.10 → .2.10 · TTL ${p.ttl}` }],
      say: { h1: b('Компьютер h1 отправляет кадр на MAC-адрес шлюза, а внутри лежит пакет для h2.', 'h1 sends a frame to the gateway’s MAC with a packet for h2 inside.') },
      metrics: { routers: 0 },
    });
    if (!p.forward) {
      steps.push({
        id: 'eaten',
        label: b('выброшен', 'dropped'),
        caption: b('Пересылка на маршрутизаторе r1 выключена (ip_forward=0). Пакет адресован не самому r1, поэтому r1 его выбрасывает и никому ничего не сообщает.', 'Forwarding on r1 is off (ip_forward=0): the packet is not addressed to r1, so r1 simply drops it. No answer, no error.'),
        focus: ['r1'],
        say: { r1: b('Маршрутизатор r1 не пересылает чужие пакеты и молча выбрасывает этот.', 'r1 does not forward packets for others and silently drops this one.') },
        states: { r1: 'err' },
        metrics: { routers: 1 },
        broken: { at: 'r1', message: '$ ping -c 2 10.0.2.10\n\n--- 10.0.2.10 ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss, time 1001ms', caption: b('Машина с двумя сетевыми картами не становится маршрутизатором, пока на ней отдельно не включат пересылку пакетов.', 'a machine with two network cards is not yet a router: forwarding has to be switched on.') },
      });
      return steps;
    }
    if (p.ttl <= 1) {
      steps.push({
        id: 'ttl0',
        label: 'TTL 0',
        caption: b('Маршрутизатор r1 уменьшает TTL с 1 до 0, а пакет с нулевым TTL дальше не идёт. Поэтому r1 выбрасывает пакет и отправляет компьютеру h1 со своего адреса сообщение ICMP «Time to live exceeded», то есть «время жизни истекло».', 'Router r1 decrements the TTL from 1 to 0, and a packet with a zero TTL goes no further. So r1 drops the packet and sends computer h1, from its own address, the ICMP message “Time to live exceeded”.'),
        focus: ['r1', 'l1'],
        tokens: [{ edge: 'l1', reverse: true, label: 'ICMP time exceeded' }],
        say: { r1: b('Маршрутизатор r1 выбрасывает пакет с нулевым TTL.', 'Router r1 drops the packet with a zero TTL.') },
        states: { r1: 'warn' },
        metrics: { routers: 1 },
        broken: { at: 'r1', message: '$ ping -c 1 -t 1 10.0.2.10\nPING 10.0.2.10 (10.0.2.10) 56(84) bytes of data.\nFrom 10.0.1.1 icmp_seq=1 Time to live exceeded', caption: b('На этом правиле построена команда traceroute: она отправляет пакеты с TTL 1, 2, 3 и так далее, и каждый маршрутизатор на пути называет себя в таком сообщении.', 'The traceroute command is built on this rule: it sends packets with TTL 1, 2, 3 and so on, and every router on the way names itself in such a message.') },
      });
      return steps;
    }
    steps.push({
      id: 'at-r1',
      label: b('на r1', 'at r1'),
      caption: fmt(b('Маршрутизатор r1 снимает кадр, читает IP-адрес получателя, уменьшает TTL с {a} до {b} и пересчитывает контрольную сумму заголовка. Самая длинная подходящая строка в его таблице говорит, что сеть 10.0.2.0/24 подключена к интерфейсу eth1.', 'Router r1 strips the frame, reads the destination IP address, decrements the TTL from {a} to {b} and recomputes the header checksum. The longest matching line in its table says that network 10.0.2.0/24 is connected to interface eth1.'), { a: p.ttl, b: p.ttl - 1 }),
      focus: ['r1', 't2'],
      say: { r1: b('Маршрутизатор r1 выбирает интерфейс eth1.', 'Router r1 picks interface eth1.') },
      states: { r1: 'on', t2: 'on' },
      metrics: { routers: 1 },
    });
    steps.push({
      id: 'deliver',
      label: b('кадр 2', 'frame 2'),
      caption: fmt(b('Маршрутизатор r1 собирает новый кадр от MAC-адреса {r} к MAC-адресу {h}. IP-адреса в пакете не изменились, а TTL теперь равен {t}. Компьютер h2 получает эхо-запрос.', 'A new frame: MAC {r} → MAC {h}. The IP addresses did not change; TTL is now {t}. h2 receives the echo request.'), { r: M.r1b, h: M.h2, t: p.ttl - 1 }),
      focus: ['l2', 'h2'],
      tokens: [{ edge: 'l2', label: `MAC …02:01 → …02:10 · IP .1.10 → .2.10 · TTL ${p.ttl - 1}` }],
      say: { h2: b('Компьютер h2 получает эхо-запрос от h1.', 'h2 receives h1’s echo request.') },
      states: { h2: 'on', l2: 'on', t3: 'on' },
      metrics: { ttl: p.ttl - 1, routers: 1 },
    });
    if (!p.back) {
      steps.push({
        id: 'no-back',
        label: b('нет пути', 'no way'),
        caption: b('Компьютер h2 хочет ответить на адрес 10.0.1.10, но в его таблице подходит только своя подсеть. Отправить ответ ему некуда, и ping работает только в одну сторону.', 'h2 wants to answer 10.0.1.10, but only its own subnet matches in its table. The answer cannot be sent — a “one-way” ping.'),
        focus: ['h2', 't3'],
        say: { h2: b('Компьютер h2 не находит маршрута к 10.0.1.10, и ответ отправить некуда.', 'h2 finds no route to 10.0.1.10 and cannot answer.') },
        states: { t3: 'err', h2: 'err' },
        values: { t3: '10.0.2.0/24 dev eth0' },
        metrics: { ttl: p.ttl - 1, routers: 1 },
        broken: { at: 't3', message: '$ ping -c 2 10.0.2.10\n\n--- 10.0.2.10 ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss, time 1001ms\n\n# on h2: tcpdump -n icmp\nIP 10.0.1.10 > 10.0.2.10: ICMP echo request, id 7, seq 1, length 64', caption: b('Запрос пришёл, и его видно в выводе tcpdump на h2, а ответа нет. В таком случае проверяйте маршрут обратно командой ip route get 10.0.1.10 на компьютере h2.', 'the request arrived — it is visible in a capture on h2 — but there is no reply. Check the way back: ip route get 10.0.1.10 on h2.') },
      });
      return steps;
    }
    steps.push({
      id: 'back',
      label: b('ответ', 'reply'),
      caption: b('Компьютер h2 отправляет ответ через свой шлюз 10.0.2.1, и r1 пересылает его в первую подсеть. На каждом участке кадр свой, со своими MAC-адресами, а IP-адреса от начала до конца остаются теми же.', 'h2 answers through its gateway 10.0.2.1, and r1 forwards the reply into the first subnet. Each segment has its own frame with its own MACs; the IP addresses are the same end to end.'),
      focus: ['l2', 'l1', 'h1'],
      tokens: [{ edge: 'l2', reverse: true, label: 'echo reply' }, { edge: 'l1', reverse: true, label: 'echo reply' }],
      say: { h1: b('Компьютер h1 получает ответ на свой эхо-запрос.', 'h1 receives the reply to its echo request.') },
      states: { h1: 'ok', h2: 'ok' },
      metrics: { ttl: p.ttl - 1, routers: 1 },
    });
    return steps;
  },
  explainDelta(_prev, next, change, a, bb) {
    if (change.kind === 'break') {
      if (!change.on) return b('Поломку убрали, и ping снова проходит в обе стороны.', 'The break is removed: the ping works both ways again.');
      return change.id === 'no-default'
        ? b('Без маршрута пакет не создаётся: ping сразу пишет «Network is unreachable», и в сеть не уходит ни одного кадра.', 'Without a route the packet is not created: “Network is unreachable” at once, without a single frame on the wire.')
        : b('Шлюз не отвечает на ARP, поэтому компьютер h1 сам сообщает «Destination Host Unreachable».', 'The gateway does not answer ARP: h1 itself reports “Destination Host Unreachable”.');
    }
    if (change.id === 'ttl') {
      const t = bb.ttl as number;
      return t <= 1
        ? b('С TTL, равным 1, пакет на маршрутизаторе r1 получает TTL 0, поэтому r1 выбрасывает его и сообщает «Time to live exceeded».', 'TTL 1: on r1 it becomes zero — the packet is dropped and r1 reports “Time to live exceeded”.')
        : fmt(b('TTL изменился с {a} до {b}, и до h2 пакет дойдёт с TTL {c}. По этому числу видно, сколько маршрутизаторов пакет прошёл.', 'TTL {a} → {b}: at h2 the packet arrives with TTL {c} — that number tells how many routers it passed.'), { a: a.ttl as number, b: t, c: lastMetric(next, 'ttl') ?? t - 1 });
    }
    if (change.id === 'back')
      return bb.back
        ? b('Маршрут обратно вернулся, и ответ снова находит дорогу к h1.', 'The route back is restored: the reply finds its way.')
        : b('Запрос доходит до h2, а ответ нет, потому что маршруты нужны в обе стороны.', 'The request arrives, the reply does not: routes are needed in both directions.');
    return bb.forward
      ? b('Пересылка включена, и r1 снова работает как маршрутизатор.', 'Forwarding on: r1 is a router again.')
      : b('Пересылка выключена (ip_forward=0), и r1 молча выбрасывает пакеты, адресованные не ему.', 'ip_forward=0: r1 silently drops packets that are not for it.');
  },
});
