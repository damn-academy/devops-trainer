// E-ROUTE (03 §7.4, screens 1–3): a packet leaves its subnet through a
// router. The host chooses a route, finds the gateway's MAC with ARP, the
// router decrements TTL, picks the longest matching prefix and puts the packet
// into a new frame. IP addresses stay, MAC addresses change at every hop.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { ttl: number; forward: boolean; back: boolean };

const M = { h1: '02:00:00:00:01:10', r1a: '02:00:00:00:01:01', r1b: '02:00:00:00:02:01', h2: '02:00:00:00:02:10' };

export const routeModel = defineModel<P>({
  id: 'net.route',
  block: 'networks',
  title: b('Пакет через маршрутизатор', 'A packet through a router'),
  summary: b('h1 (10.0.1.10) пингует h2 (10.0.2.10) в соседней подсети. Между ними — маршрутизатор r1.', 'h1 (10.0.1.10) pings h2 (10.0.2.10) in the next subnet. Router r1 stands between them.'),
  diagram: {
    width: 960,
    height: 420,
    nodes: [
      node('h1', 'h1', 'user', [24, 64, 168, 64], card(['Хост в подсети 10.0.1.0/24. Своей подсети он достигает напрямую, всего остального — через шлюз.', 'A host in subnet 10.0.1.0/24. It reaches its own subnet directly and everything else through the gateway.'], ['—', '—'], 'ip -br a'), { sub: '10.0.1.10' }),
      node('r1', 'r1', 'l3', [396, 56, 168, 80], card(['Маршрутизатор — обычный Linux с двумя интерфейсами и включённой пересылкой (net.ipv4.ip_forward=1). Он принимает пакеты, адресованные не ему, и отправляет их дальше по своей таблице маршрутов.', 'A router is an ordinary Linux machine with two interfaces and forwarding on (net.ipv4.ip_forward=1). It accepts packets not addressed to it and sends them on by its routing table.'], ['Администратор сети.', 'The network administrator.'], 'sysctl net.ipv4.ip_forward'), { sub: '10.0.1.1 | 10.0.2.1' }),
      node('h2', 'h2', 'user', [768, 64, 168, 64], card(['Хост в подсети 10.0.2.0/24. Чтобы ответить, ему тоже нужен маршрут — обратно.', 'A host in subnet 10.0.2.0/24. To answer, it also needs a route — back.'], ['—', '—'], 'ip r'), { sub: '10.0.2.10' }),
      node('t1', b('маршруты h1', 'routes of h1'), 'obj', [24, 232, 280, 96], card(['Таблица маршрутов h1. Ядро выбирает строку, чей префикс содержит адрес получателя; из нескольких — самую длинную (longest prefix match). «default» — это 0.0.0.0/0: подходит всем, но длина ноль.', 'The routing table of h1. The kernel picks the line whose prefix contains the destination; of several, the longest (longest prefix match). “default” is 0.0.0.0/0: it matches everything, with length zero.'], ['Ядро (подсеть интерфейса), администратор или DHCP (шлюз).', 'The kernel (the interface’s subnet), the administrator or DHCP (the gateway).'], 'ip route', DOC.ipRoute), { shape: 'doc', sub: 'default via 10.0.1.1' }),
      node('t2', b('маршруты r1', 'routes of r1'), 'obj', [340, 232, 280, 96], card(['У r1 обе подсети подключены напрямую: строки «proto kernel scope link» ядро добавило само, когда на интерфейсы назначили адреса.', 'On r1 both subnets are connected directly: the “proto kernel scope link” lines were added by the kernel when the interfaces got their addresses.'], ['Ядро.', 'The kernel.'], 'ip route', DOC.ipRoute), { shape: 'doc', sub: '10.0.2.0/24 dev eth1' }),
      node('t3', b('маршруты h2', 'routes of h2'), 'obj', [656, 232, 280, 96], card(['Без маршрута к 10.0.1.0/24 (или маршрута по умолчанию) h2 получит запрос, но ответ отправить не сможет.', 'Without a route to 10.0.1.0/24 (or a default route) h2 receives the request but cannot send the answer.'], ['Администратор или DHCP.', 'The administrator or DHCP.'], 'ip route get 10.0.1.10'), { shape: 'doc', sub: 'default via 10.0.2.1' }),
    ],
    edges: [
      edge('l1', 'h1', 'r1', '10.0.1.0/24', card(['Первая подсеть. Кадр на этом участке: MAC отправителя — h1, MAC получателя — r1 (не h2!).', 'The first subnet. The frame on this segment: sender MAC is h1, receiver MAC is r1 (not h2!).'], ['—', '—'], 'tcpdump -n -e -i eth0')),
      edge('l2', 'r1', 'h2', '10.0.2.0/24', card(['Вторая подсеть. Здесь кадр уже другой: MAC r1 → MAC h2. IP-адреса внутри — те же.', 'The second subnet. The frame here is different: r1’s MAC → h2’s MAC. The IP addresses inside are the same.'], ['—', '—'], 'tcpdump -n -e -i eth1')),
    ],
  },
  params: [
    {
      id: 'ttl',
      label: b('TTL отправленного пакета', 'TTL of the sent packet'),
      kind: 'range',
      min: 1,
      max: 64,
      step: 1,
      default: 64,
      near: 'l1',
      predict: {
        prompt: b('Пакет уходит с TTL = 1. Дойдёт ли он до h2?', 'The packet leaves with TTL = 1. Will it reach h2?'),
        options: [
          { id: 'no', text: b('Нет: r1 уменьшит TTL до нуля, выбросит пакет и сообщит об этом', 'No: r1 decrements TTL to zero, drops the packet and reports it') },
          { id: 'yes', text: b('Да: один маршрутизатор — не помеха', 'Yes: one router is no obstacle') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'deliver') ? 'yes' : 'no'),
      },
    },
    {
      id: 'back',
      label: b('У h2 есть маршрут обратно', 'h2 has a route back'),
      kind: 'toggle',
      default: true,
      near: 't3',
      predict: {
        prompt: b('У h2 убрали маршрут по умолчанию. Что произойдёт с пингом?', 'h2 lost its default route. What happens to the ping?'),
        options: [
          { id: 'oneway', text: b('Запрос дойдёт до h2, ответ — нет', 'The request reaches h2, the reply does not') },
          { id: 'nothing', text: b('Запрос не дойдёт до h2', 'The request does not reach h2') },
          { id: 'ok', text: b('Всё работает: h2 ответит тому, кто спросил', 'Everything works: h2 answers whoever asked') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'deliver') ? (next.some((s) => s.id === 'back') ? 'ok' : 'oneway') : 'nothing'),
      },
    },
    { id: 'forward', label: b('Пересылка на r1 (ip_forward)', 'Forwarding on r1 (ip_forward)'), kind: 'toggle', default: true, near: 'r1', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'no-default',
      label: b('Удалить маршрут по умолчанию на h1', 'Delete the default route on h1'),
      remove: ['t1'],
      layer: 'L3',
      predict: {
        prompt: b('У h1 нет маршрута по умолчанию. Где остановится пакет к 10.0.2.10?', 'h1 has no default route. Where does the packet to 10.0.2.10 stop?'),
        options: [
          { id: 'born', text: b('Нигде: он даже не будет создан', 'Nowhere: it will not even be created') },
          { id: 'r1', text: b('На r1', 'At r1') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'h1' ? 'born' : 'r1'),
      },
    },
    {
      id: 'r1-off',
      label: b('Выключить r1', 'Power off r1'),
      remove: ['r1'],
      layer: 'L2',
      predict: {
        prompt: b('Маршрутизатор выключен. Что напишет ping на h1?', 'The router is off. What will ping on h1 print?'),
        options: [
          { id: 'host', text: b('From 10.0.1.10 … Destination Host Unreachable', 'From 10.0.1.10 … Destination Host Unreachable') },
          { id: 'net', text: b('connect: Network is unreachable', 'connect: Network is unreachable') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'r1' ? 'host' : 'net'),
      },
    },
  ],
  metrics: [
    { id: 'ttl', label: b('TTL у получателя', 'TTL at the receiver') },
    { id: 'routers', label: b('маршрутизаторов на пути', 'routers on the way') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    steps.push({
      id: 'decide',
      label: b('маршрут', 'route'),
      caption: broken.has('no-default')
        ? b('h1 ищет в таблице маршрутов строку для 10.0.2.10. Есть только своя подсеть 10.0.1.0/24 — она не подходит. Маршрута нет.', 'h1 looks for a routing line for 10.0.2.10. There is only its own subnet 10.0.1.0/24 — it does not match. There is no route.')
        : b('h1 ищет в таблице маршрутов строку для 10.0.2.10. Своя подсеть 10.0.1.0/24 не подходит, подходит default: «через шлюз 10.0.1.1».', 'h1 looks for a routing line for 10.0.2.10. Its own subnet 10.0.1.0/24 does not match; default does: “via gateway 10.0.1.1”.'),
      focus: ['h1', 't1'],
      states: { h1: 'on', t1: broken.has('no-default') ? 'err' : 'on' },
      values: { t1: broken.has('no-default') ? '10.0.1.0/24 dev eth0 only' : 'default via 10.0.1.1' },
      metrics: { routers: 0 },
      ...(broken.has('no-default')
        ? { broken: { at: 'h1', message: '$ ping -c 1 10.0.2.10\nping: connect: Network is unreachable', caption: b('пакет не родился: ядро не знает, в какой интерфейс его отдать. Ошибка мгновенная и локальная.', 'the packet was never born: the kernel does not know which interface to give it to. The error is instant and local.') } }
        : {}),
    });
    if (broken.has('no-default')) return steps;
    steps.push({
      id: 'arp',
      label: 'ARP',
      caption: b('Пакет пойдёт к шлюзу, значит, кадру нужен MAC шлюза, а не h2. h1 спрашивает ARP: «у кого 10.0.1.1?» — вот разгадка загадки из урока про ARP.', 'The packet goes to the gateway, so the frame needs the gateway’s MAC, not h2’s. h1 asks over ARP: “who has 10.0.1.1?” — this solves the riddle of the ARP lesson.'),
      focus: ['l1'],
      tokens: [{ edge: 'l1', label: 'who-has 10.0.1.1' }],
      metrics: { routers: 0 },
    });
    if (broken.has('r1-off')) {
      steps.push({
        id: 'no-gw',
        label: b('нет шлюза', 'no gateway'),
        caption: b('Шлюз не отвечает на ARP: кадр не собрать. h1 трижды повторяет вопрос и сдаётся.', 'The gateway does not answer ARP: the frame cannot be built. h1 repeats the question three times and gives up.'),
        focus: ['h1', 'l1'],
        states: { r1: 'off', h1: 'err' },
        metrics: { routers: 0 },
        broken: { at: 'r1', message: '$ ping -c 2 10.0.2.10\nFrom 10.0.1.10 icmp_seq=1 Destination Host Unreachable\nFrom 10.0.1.10 icmp_seq=2 Destination Host Unreachable', caption: b('маршрут есть, а соседа-шлюза в сети нет: ошибку пишет сам h1.', 'the route exists, but the gateway neighbour is not on the network: h1 itself reports the error.') },
      });
      return steps;
    }
    steps.push({
      id: 'to-r1',
      label: b('кадр 1', 'frame 1'),
      caption: fmt(b('Кадр: MAC {a} → MAC {r}. Внутри IP-пакет 10.0.1.10 → 10.0.2.10, TTL {t}.', 'Frame: MAC {a} → MAC {r}. Inside, an IP packet 10.0.1.10 → 10.0.2.10, TTL {t}.'), { a: M.h1, r: M.r1a, t: p.ttl }),
      focus: ['l1', 'r1'],
      tokens: [{ edge: 'l1', label: `TTL ${p.ttl}` }],
      metrics: { routers: 0 },
    });
    if (!p.forward) {
      steps.push({
        id: 'eaten',
        label: b('поглощён', 'swallowed'),
        caption: b('Пересылка на r1 выключена (ip_forward=0): пакет адресован не r1, и r1 его просто выбрасывает. Ни ответа, ни ошибки.', 'Forwarding on r1 is off (ip_forward=0): the packet is not addressed to r1, so r1 simply drops it. No answer, no error.'),
        focus: ['r1'],
        states: { r1: 'err' },
        metrics: { routers: 1 },
        broken: { at: 'r1', message: '$ ping -c 2 10.0.2.10\n\n--- 10.0.2.10 ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss, time 1001ms', caption: b('машина с двумя сетевыми картами — ещё не маршрутизатор: пересылку надо включить.', 'a machine with two network cards is not yet a router: forwarding has to be switched on.') },
      });
      return steps;
    }
    if (p.ttl <= 1) {
      steps.push({
        id: 'ttl0',
        label: 'TTL 0',
        caption: b('r1 уменьшает TTL: 1 → 0. Пакет с нулевым TTL дальше не идёт. r1 выбрасывает его и отправляет h1 сообщение ICMP «Time to live exceeded» со своего адреса.', 'r1 decrements TTL: 1 → 0. A packet with zero TTL goes no further. r1 drops it and sends h1 an ICMP “Time to live exceeded” message from its own address.'),
        focus: ['r1', 'l1'],
        tokens: [{ edge: 'l1', reverse: true, label: 'ICMP time exceeded' }],
        states: { r1: 'warn' },
        metrics: { routers: 1 },
        broken: { at: 'r1', message: '$ ping -c 1 -t 1 10.0.2.10\nPING 10.0.2.10 (10.0.2.10) 56(84) bytes of data.\nFrom 10.0.1.1 icmp_seq=1 Time to live exceeded', caption: b('так работает traceroute: TTL 1, 2, 3… — и каждый маршрутизатор на пути называет себя.', 'this is how traceroute works: TTL 1, 2, 3… — and every router on the way names itself.') },
      });
      return steps;
    }
    steps.push({
      id: 'at-r1',
      label: b('на r1', 'at r1'),
      caption: fmt(b('r1 снимает кадр, читает IP получателя, уменьшает TTL {a} → {b} и пересчитывает контрольную сумму заголовка. В его таблице самая длинная подходящая строка — 10.0.2.0/24 dev eth1.', 'r1 strips the frame, reads the destination IP, decrements TTL {a} → {b} and recomputes the header checksum. The longest matching line in its table is 10.0.2.0/24 dev eth1.'), { a: p.ttl, b: p.ttl - 1 }),
      focus: ['r1', 't2'],
      states: { r1: 'on', t2: 'on' },
      metrics: { routers: 1 },
    });
    steps.push({
      id: 'deliver',
      label: b('кадр 2', 'frame 2'),
      caption: fmt(b('Новый кадр: MAC {r} → MAC {h}. IP-адреса не изменились, TTL теперь {t}. h2 получает эхо-запрос.', 'A new frame: MAC {r} → MAC {h}. The IP addresses did not change; TTL is now {t}. h2 receives the echo request.'), { r: M.r1b, h: M.h2, t: p.ttl - 1 }),
      focus: ['l2', 'h2'],
      tokens: [{ edge: 'l2', label: `TTL ${p.ttl - 1}` }],
      states: { h2: 'on' },
      metrics: { ttl: p.ttl - 1, routers: 1 },
    });
    if (!p.back) {
      steps.push({
        id: 'no-back',
        label: b('нет пути', 'no way'),
        caption: b('h2 хочет ответить на 10.0.1.10, но в его таблице подходит только своя подсеть. Ответ не отправить — пинг «в одну сторону».', 'h2 wants to answer 10.0.1.10, but only its own subnet matches in its table. The answer cannot be sent — a “one-way” ping.'),
        focus: ['h2', 't3'],
        states: { t3: 'err', h2: 'err' },
        values: { t3: '10.0.2.0/24 dev eth0 only' },
        metrics: { ttl: p.ttl - 1, routers: 1 },
        broken: { at: 't3', message: '$ ping -c 2 10.0.2.10\n\n--- 10.0.2.10 ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss, time 1001ms\n\n# on h2: tcpdump -n icmp\nIP 10.0.1.10 > 10.0.2.10: ICMP echo request, id 7, seq 1, length 64', caption: b('запрос пришёл — его видно в захвате на h2, — а ответа нет. Смотрите маршрут обратно: ip route get 10.0.1.10 на h2.', 'the request arrived — it is visible in a capture on h2 — but there is no reply. Check the way back: ip route get 10.0.1.10 on h2.') },
      });
      return steps;
    }
    steps.push({
      id: 'back',
      label: b('ответ', 'reply'),
      caption: b('h2 отвечает через свой шлюз 10.0.2.1, r1 пересылает ответ в первую подсеть. Каждый участок — свой кадр со своими MAC, IP-адреса от начала до конца те же.', 'h2 answers through its gateway 10.0.2.1, and r1 forwards the reply into the first subnet. Each segment has its own frame with its own MACs; the IP addresses are the same end to end.'),
      focus: ['l2', 'l1', 'h1'],
      tokens: [{ edge: 'l2', reverse: true, label: 'echo reply' }, { edge: 'l1', reverse: true, label: 'echo reply' }],
      states: { h1: 'ok', h2: 'ok' },
      metrics: { ttl: p.ttl - 1, routers: 1 },
    });
    return steps;
  },
  explainDelta(_prev, next, change, a, bb) {
    if (change.kind === 'break') {
      if (!change.on) return b('Поломка убрана: пинг снова проходит в обе стороны.', 'The break is removed: the ping works both ways again.');
      return change.id === 'no-default' ? b('Без маршрута пакет не создаётся: «Network is unreachable» сразу, без единого кадра в сети.', 'Without a route the packet is not created: “Network is unreachable” at once, without a single frame on the wire.') : b('Шлюз не отвечает на ARP: h1 сам сообщает «Destination Host Unreachable».', 'The gateway does not answer ARP: h1 itself reports “Destination Host Unreachable”.');
    }
    if (change.id === 'ttl') {
      const t = bb.ttl as number;
      return t <= 1 ? b('TTL 1: на r1 он становится нулём — пакет выброшен, r1 сообщает «Time to live exceeded».', 'TTL 1: on r1 it becomes zero — the packet is dropped and r1 reports “Time to live exceeded”.') : fmt(b('TTL {a} → {b}: у h2 пакет окажется с TTL {c} — по этому числу видно, сколько маршрутизаторов прошёл пакет.', 'TTL {a} → {b}: at h2 the packet arrives with TTL {c} — that number tells how many routers it passed.'), { a: a.ttl as number, b: t, c: lastMetric(next, 'ttl') ?? t - 1 });
    }
    if (change.id === 'back') return bb.back ? b('Маршрут обратно вернулся: ответ находит дорогу.', 'The route back is restored: the reply finds its way.') : b('Запрос доходит, ответ — нет: маршруты нужны в обе стороны.', 'The request arrives, the reply does not: routes are needed in both directions.');
    return bb.forward ? b('Пересылка включена: r1 снова маршрутизатор.', 'Forwarding on: r1 is a router again.') : b('ip_forward=0: r1 выбрасывает чужие пакеты молча.', 'ip_forward=0: r1 silently drops packets that are not for it.');
  },
});
