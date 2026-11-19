// E-DHCP (03 §7.7): how a laptop gets an address knowing neither its address
// nor the server's — Discover, Offer, Request, Ack (DORA) — and what breaks
// when the server is gone or there are two of them.
//
// Reading order: at the start only the laptop and the home router are on the
// diagram; the old router appears only when the break that brings it is on.
// The acting block says in a callout what it does, and every DHCP message
// travels along the line as a card with its name.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { lease: number };

/** A lease time in words, in both languages. */
const fmtTime = (s: number): Bi =>
  s >= 3600
    ? bi(`${Math.round((s / 3600) * 10) / 10} ч`, `${Math.round((s / 3600) * 10) / 10} h`)
    : s >= 60
      ? bi(`${Math.round(s / 60)} мин`, `${Math.round(s / 60)} min`)
      : bi(`${s} с`, `${s} s`);

export const dhcpModel = defineModel<P>({
  id: 'net.dhcp',
  block: 'networks',
  title: b('Как ноутбук получает адрес в сети', 'How a laptop gets an address'),
  summary: b(
    'Ноутбук только что подключился к домашней сети. У него нет ни адреса, ни шлюза, ни сервера DNS, и всё это он получит от сервера DHCP в домашнем роутере за четыре сообщения: Discover, Offer, Request и Ack. Под названием ноутбука показан его текущий адрес.',
    'The laptop has just joined the home network. It has no address, no gateway, no DNS server; it gets all of them from the DHCP server in the home router in four messages: Discover, Offer, Request and Ack. The laptop’s current address is shown under its name.',
  ),
  intro: b(
    'Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что он делает, а карточка на линии показывает, какое сообщение DHCP передаётся.\n\nПосле первого прохода подвиньте срок аренды, а потом по очереди включите в блоке «Сломать» выключенный сервер и второй сервер в сети.',
    'Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted block says what it does; the card on the line shows which DHCP message is passing.\n\nAfter the first pass move the lease time, then switch on, one at a time, the server that is off and the second server on the network in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: b('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: b('что этот блок делает', 'what it does') },
    { mark: 'token', text: b('сообщение DHCP на линии', 'a DHCP message on the line') },
    { mark: 'icon:terminal', text: b('ноутбук', 'laptop') },
    { mark: 'icon:router', text: b('роутер с сервером DHCP', 'router with a DHCP server') },
    { mark: 'dashed', text: b('граница локальной сети, внутри которой слышны широковещательные сообщения', 'the local network where broadcasts are heard') },
    { mark: 'wait', text: b('ноутбук ждёт адрес', 'the laptop waits for an address') },
    { mark: 'ok', text: b('адрес получен и настроен', 'the address is set up') },
    { mark: 'err', text: b('здесь настройка сети не удалась', 'setup failed here') },
  ],
  stopLabel: b('Ноутбук остался без нужного адреса', 'The laptop has no proper address'),
  diagram: {
    width: 960,
    height: 380,
    nodes: [
      node('laptop', b('Ноутбук', 'Laptop'), 'user', [24, 144, 176, 72], card(['Клиент DHCP. Пока у него адрес 0.0.0.0: с такого адреса можно отправлять сообщения, но ответить на него нельзя, поэтому ответы приходят широковещательно или прямо на MAC-адрес ноутбука.', 'The DHCP client. For now its address is 0.0.0.0: it can send from it but nobody can answer it — so answers go by broadcast or to its MAC.'], ['Клиентом DHCP работает программа dhcpcd в Debian, systemd-networkd или NetworkManager.', 'The dhcpcd client (Debian), systemd-networkd or NetworkManager.'], 'dhcpcd -T eth0', DOC.dhcpcdMan), { sub: '0.0.0.0', icon: 'terminal', work: 'spin' }),
      node('router', b('Роутер с сервером DHCP', 'Router: DHCP server'), 'l7', [744, 64, 192, 72], card(['Сервер DHCP раздаёт адреса из пула от 192.168.1.100 до 192.168.1.199 и вместе с адресом сообщает настройки, которые называются опциями: опция 1 задаёт маску, опция 3 шлюз, опция 6 сервер DNS, а опция 51 срок аренды.', 'The server hands out addresses from the pool 192.168.1.100–199 and with each address sends options: 1 — mask, 3 — gateway, 6 — DNS server, 51 — lease time.'], ['В домашнем роутере сервером DHCP обычно работает программа dnsmasq.', 'dnsmasq in the home router.'], undefined, DOC.rfc2132), { sub: '192.168.1.1', icon: 'router' }),
      node('rogue', b('Старый роутер', 'Old router'), 'l7', [744, 232, 192, 72], card(['Второй сервер DHCP в той же сети: кто-то принёс старый роутер и подключил его кабелем к коммутатору. Клиент берёт то предложение, которое пришло первым.', 'A second DHCP server on the same network: someone brought an old router and plugged it into the switch. The client takes the first offer.'], ['Роутер подключил неаккуратный сосед по офису.', 'A careless office mate.']), { sub: '192.168.1.250', icon: 'router' }),
    ],
    edges: [
      edge('bcast', 'laptop', 'router', '0.0.0.0:68 → 255.255.255.255:67', card(['Широковещательная датаграмма UDP. Ноутбук не знает, где сервер, поэтому обращается ко всем в своей сети, а дальше роутера такой пакет не уходит.', 'A broadcast UDP datagram: the laptop does not know where the server is, so it shouts to everyone on its network. Such a packet never goes beyond the router.'], ['Сообщение отправляет клиент dhcpcd.', 'dhcpcd.'], 'tcpdump -n port 67 or port 68', DOC.rfc2131), { via: [[480, 180], [480, 100]], labelAt: 0.25 }),
      edge('bcast2', 'laptop', 'rogue', b('рассылка всем', 'everyone hears it'), card(['То же сообщение Discover доходит до каждого устройства сети, в том числе до второго сервера.', 'The same Discover reaches every device on the network, the second server included.'], ['Сообщение отправляет клиент dhcpcd.', 'dhcpcd.']), { via: [[480, 180], [480, 268]], labelAt: 0.7 }),
    ],
    groups: [{ id: 'lan', label: b('локальная сеть 192.168.1.0/24', 'local network 192.168.1.0/24'), around: ['laptop', 'router', 'rogue'], family: 'l2', dash: 'dash', pad: 16, card: card(['Сюда входят все устройства, которые получают кадры на адрес ff:ff:ff:ff:ff:ff, то есть одна локальная сеть за одним коммутатором. Роутер служит границей этой сети.', 'Everyone who receives frames to ff:ff:ff:ff:ff:ff: one local network behind one switch. The router is its border.'], ['Границу сети задаёт тот, кто соединил кабели.', 'Whoever wired the cables.'])}],
  },
  params: [
    {
      id: 'lease',
      group: b('Что сообщает сервер', 'What the server says'),
      label: b('На какой срок сервер выдаёт адрес (опция 51)', 'Lease time (option 51)'),
      kind: 'range',
      min: 60,
      max: 86400,
      step: 60,
      unit: 's',
      default: 86400,
      near: 'router',
      predict: {
        prompt: b('Сервер выдал адрес на один час. Когда клиент впервые попросит продлить аренду?', 'The lease is for one hour. When will the client first ask to renew it?'),
        options: [
          { id: 'half', text: b('Через 30 минут, когда пройдёт половина срока', 'After 30 minutes — at half the lease') },
          { id: 'end', text: b('Через час, когда аренда закончится', 'After an hour, when the lease ends') },
        ],
        resolve: () => 'half',
      },
    },
  ],
  breaks: [
    {
      id: 'off',
      label: b('Сервер DHCP в роутере выключен', 'The DHCP server is off'),
      remove: ['router'],
      layer: 'L7',
      predict: {
        prompt: b('Сервер DHCP не отвечает, и других серверов в сети нет. Какой адрес окажется у ноутбука?', 'The server does not answer. What address will the laptop end up with?'),
        options: [
          { id: 'll', text: b('Адрес вида 169.254.x.x, который ноутбук придумает сам, но интернета с ним не будет', '169.254.x.x — it makes one up; there will be no internet') },
          { id: 'none', text: b('Никакого адреса у ноутбука не будет', 'None at all') },
          { id: 'old', text: b('Ноутбук возьмёт адрес, который был у него в прошлый раз', 'The previous address') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'router' ? 'll' : 'none'),
      },
    },
    {
      id: 'rogue',
      label: b('В сеть подключили второй сервер DHCP', 'A second DHCP server on the network'),
      remove: [],
      layer: 'L7',
      predict: {
        prompt: b('Старый роутер ответил на Discover быстрее настоящего сервера. Что будет не так у ноутбука?', 'The old router answered faster. What is wrong on the laptop?'),
        options: [
          { id: 'gw', text: b('Шлюз и сервер DNS окажутся чужими, и интернета не будет', 'The gateway and the DNS server are wrong: no internet') },
          { id: 'fine', text: b('Всё будет в порядке, потому что адрес ноутбук получил', 'Everything is fine, it got an address') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'rogue' ? 'gw' : 'fine'),
      },
    },
  ],
  metrics: [
    { id: 'msgs', label: b('сообщений DHCP', 'DHCP messages') },
    { id: 't1', label: b('продление у своего сервера (T1)', 'renewal with its server (T1)'), unit: 's' },
    { id: 't2', label: b('продление у любого сервера (T2)', 'renewal with any server (T2)'), unit: 's' },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const rogue = broken.has('rogue');
    steps.push({
      id: 'discover',
      label: 'Discover',
      caption: b('Ноутбук без адреса отправляет сообщение DHCP Discover с адреса 0.0.0.0, порт 68, на широковещательный адрес 255.255.255.255, порт 67. Смысл сообщения такой: «Есть здесь сервер DHCP?», и его слышат все устройства локальной сети.', 'The laptop without an address sends a DHCP Discover from 0.0.0.0:68 to 255.255.255.255:67: “Is there a server here?” Everyone on the local network hears it.'),
      focus: ['laptop', 'bcast', 'bcast2'],
      tokens: [{ edge: 'bcast', label: 'Discover' }, ...(rogue ? [{ edge: 'bcast2', label: 'Discover' }] : [])],
      say: { laptop: b('Ноутбук спрашивает всю сеть, есть ли в ней сервер DHCP.', 'The laptop asks the whole network whether there is a DHCP server.') },
      states: { laptop: 'wait', router: 'on', rogue: rogue ? 'on' : 'hidden', bcast2: rogue ? 'on' : 'hidden' },
      metrics: { msgs: 1 },
    });
    if (broken.has('off') && !rogue) {
      steps.push({
        id: 'retry',
        label: b('тишина', 'silence'),
        caption: b('Сервер не отвечает, и клиент повторяет Discover, каждый раз выжидая всё дольше.', 'No answer. The client repeats the Discover with growing pauses.'),
        focus: ['laptop', 'bcast'],
        tokens: [{ edge: 'bcast', label: 'Discover' }],
        say: { laptop: b('Ноутбук не получил ответа и снова отправляет Discover.', 'The laptop got no answer and sends Discover again.') },
        states: { router: 'off' },
        metrics: { msgs: 3 },
      });
      steps.push({
        id: 'll',
        label: '169.254',
        caption: b('Сервер так и не ответил. Тогда dhcpcd выбирает себе адрес из диапазона 169.254.0.0/16, который называют link-local. С таким адресом можно обмениваться пакетами с соседями по кабелю, но шлюза и выхода в интернет нет.', 'The server never answered. dhcpcd picks an address from 169.254.0.0/16 (link-local) — enough to talk to neighbours on the cable, but there is no gateway and no internet.'),
        focus: ['laptop'],
        say: { laptop: b('Ноутбук сам назначает себе адрес 169.254.23.141.', 'The laptop assigns itself 169.254.23.141.') },
        states: { laptop: 'err' },
        values: { laptop: '169.254.23.141' },
        metrics: { msgs: 3 },
        broken: { at: 'router', message: 'eth0: soliciting a DHCP lease\neth0: probing for an IPv4LL address\neth0: using IPv4LL address 169.254.23.141\neth0: adding route to 169.254.0.0/16\ntimed out', caption: b('Если на интерфейсе стоит адрес вида 169.254.x.x, это верный признак того, что сервер DHCP не ответил.', 'a 169.254.x.x address on an interface is a sure sign: the DHCP server did not answer.') },
      });
      return steps;
    }
    const from = rogue ? 'rogue' : 'router';
    const edgeId = rogue ? 'bcast2' : 'bcast';
    const offer = rogue ? '192.168.1.23' : '192.168.1.103';
    steps.push({
      id: 'offer',
      label: 'Offer',
      caption: rogue
        ? b('Отвечают оба сервера, но старый роутер отвечает быстрее. Он предлагает адрес 192.168.1.23, а шлюзом и сервером DNS называет себя, 192.168.1.250. Клиент берёт первое предложение.', 'Both answer, but the old router is faster: Offer 192.168.1.23, gateway 192.168.1.250, DNS 192.168.1.250. The client takes the first offer.')
        : b('Сервер предлагает ноутбуку адрес 192.168.1.103 и вместе с ним настройки: маску /24 в опции 1, шлюз 192.168.1.1 в опции 3, сервер DNS 192.168.1.1 в опции 6 и срок аренды в опции 51.', 'The server offers: “Take 192.168.1.103. Mask /24 (option 1), gateway 192.168.1.1 (option 3), DNS 192.168.1.1 (option 6), lease time — option 51.”'),
      focus: [from, edgeId],
      tokens: [{ edge: edgeId, reverse: true, label: `Offer ${offer}` }],
      say: { [from]: rogue ? b('Старый роутер первым предлагает адрес и называет шлюзом себя.', 'The old router offers an address first and names itself the gateway.') : b('Сервер DHCP предлагает ноутбуку адрес 192.168.1.103 и настройки сети.', 'The DHCP server offers 192.168.1.103 and the network settings.') },
      states: { [from]: 'on' },
      metrics: { msgs: 2 },
    });
    steps.push({
      id: 'request',
      label: 'Request',
      caption: b('Клиент снова отправляет сообщение всем: «Беру этот адрес у этого сервера». Так остальные серверы узнают, что их предложения отклонены.', 'The client broadcasts again: “I take this address from this server.” This also tells other servers their offers were declined.'),
      focus: ['laptop', edgeId],
      tokens: [{ edge: edgeId, label: 'Request' }],
      say: { laptop: b('Ноутбук объявляет всем, чьё предложение он принимает.', 'The laptop announces to all whose offer it takes.') },
      metrics: { msgs: 3 },
    });
    const t1 = Math.round(p.lease * 0.5);
    const t2 = Math.round(p.lease * 0.875);
    const lt = fmtTime(rogue ? 3600 : p.lease);
    steps.push({
      id: 'ack',
      label: 'Ack',
      caption: bi(
        `Сервер подтверждает, что адрес ${offer} закреплён за ноутбуком на ${lt.ru}. Клиент назначает адрес интерфейсу, добавляет маршрут по умолчанию через шлюз и записывает сервер DNS в файл /etc/resolv.conf.`,
        `The server confirms: ${offer} is yours for ${lt.en}. The client configures the interface, a default route via the gateway and writes the DNS server into /etc/resolv.conf.`,
      ),
      focus: [from, edgeId, 'laptop'],
      tokens: [{ edge: edgeId, reverse: true, label: 'Ack' }],
      say: { laptop: fmt(b('Ноутбук настраивает у себя адрес {a}, шлюз и сервер DNS.', 'The laptop sets up {a}, the gateway and the DNS server.'), { a: offer }) },
      states: { laptop: rogue ? 'warn' : 'ok' },
      values: { laptop: offer },
      metrics: { msgs: 4, t1, t2 },
    });
    if (rogue) {
      steps.push({
        id: 'wrong',
        label: b('чужой шлюз', 'wrong gateway'),
        caption: b('Адрес у ноутбука есть, а интернета нет, потому что шлюзом назначен старый роутер, у которого нет выхода наружу. Причина поломки лежит в DHCP, а проявляется она в таблице маршрутов.', 'There is an address but no internet: the old router became the gateway, and it has no way out. The cause is in DHCP, the symptom is in the routes.'),
        focus: ['rogue', 'laptop'],
        say: { rogue: b('Старый роутер получает пакеты ноутбука, но передать их в интернет ему некуда.', 'The old router gets the laptop’s packets but has nowhere to send them.') },
        states: { rogue: 'err', laptop: 'err' },
        metrics: { msgs: 4, t1, t2 },
        broken: { at: 'rogue', message: '$ ip r\ndefault via 192.168.1.250 dev eth0 proto dhcp metric 1002\n$ ping -c 2 1.1.1.1\n--- 1.1.1.1 ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss', caption: b('Запись трафика командой tcpdump покажет два сообщения Offer от разных серверов, и это будет доказательством того, что в сети два сервера DHCP.', 'a capture shows two Offers from different servers — that is the proof.') },
      });
      return steps;
    }
    steps.push({
      id: 'renew',
      label: 'T1',
      caption: fmt(b('Адрес выдан не навсегда. Когда пройдёт половина срока аренды (T1, через {t1} с), клиент попросит продлить её у своего сервера, а если тот промолчит, то по прошествии 87,5 % срока (T2, через {t2} с) спросит любой сервер в сети.', 'A lease is not forever. At half its time (T1 = {t1} s) the client asks its own server to renew; if that one is silent, at 87.5 % (T2 = {t2} s) it asks anyone.'), { t1, t2 }),
      focus: ['laptop', 'router'],
      say: { laptop: b('Ноутбук запоминает, когда нужно будет продлить аренду адреса.', 'The laptop notes when to renew the lease.') },
      metrics: { msgs: 4, t1, t2 },
    });
    return steps;
  },
  explainDelta(_prev, next, change) {
    if (change.kind === 'break')
      return change.on
        ? change.id === 'off'
          ? b('Без сервера клиент сам назначает себе адрес 169.254.x.x. С этим адресом соседей по кабелю видно, а выхода в интернет нет.', 'Without a server the client assigns itself 169.254.x.x: neighbours on the cable are visible, the internet is not.')
          : b('В сети два сервера, и первым ответил чужой, поэтому у ноутбука оказались чужой шлюз и чужой сервер DNS.', 'Two servers: the wrong one answered first — the laptop gets the wrong gateway and the wrong DNS.')
        : b('В сети снова один сервер, и он отвечает.', 'There is one server again, and it answers.');
    return fmt(b('Клиент попросит продлить аренду через {t1} с, а у любого сервера спросит через {t2} с.', 'Renewal at {t1} s, a retry with any server at {t2} s.'), { t1: lastMetric(next, 't1') ?? 0, t2: lastMetric(next, 't2') ?? 0 });
  },
});
