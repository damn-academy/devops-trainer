// E-DHCP (03 §7.7): how a laptop gets an address knowing neither its address
// nor the server's — Discover, Offer, Request, Ack (DORA) — and what breaks
// when the server is gone or there are two of them.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { lease: number };

const fmtTime = (s: number) => (s >= 3600 ? `${Math.round((s / 3600) * 10) / 10} h` : s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);

export const dhcpModel = defineModel<P>({
  id: 'net.dhcp',
  block: 'networks',
  title: b('Как ноутбук получает адрес', 'How a laptop gets an address'),
  summary: b('Ноутбук подключился к домашней сети. У него нет ни адреса, ни шлюза, ни DNS-сервера — всё это он сейчас попросит.', 'The laptop has joined the home network. It has no address, no gateway, no DNS server — it is about to ask for all of them.'),
  diagram: {
    width: 960,
    height: 380,
    nodes: [
      node('laptop', b('Ноутбук', 'Laptop'), 'user', [24, 144, 176, 72], card(['Клиент DHCP. Пока у него адрес 0.0.0.0: отправлять с него можно, отвечать на него нельзя — поэтому ответы идут широковещательно или на MAC.', 'The DHCP client. For now its address is 0.0.0.0: it can send from it but nobody can answer it — so answers go by broadcast or to its MAC.'], ['Клиент dhcpcd (Debian), systemd-networkd или NetworkManager.', 'The dhcpcd client (Debian), systemd-networkd or NetworkManager.'], 'dhcpcd -T eth0', DOC.dhcpcdMan), { sub: '0.0.0.0' }),
      node('router', b('Роутер: DHCP-сервер', 'Router: DHCP server'), 'l7', [760, 64, 176, 72], card(['Сервер раздаёт адреса из пула 192.168.1.100–199 и вместе с адресом сообщает опции: 1 — маска, 3 — шлюз, 6 — DNS-сервер, 51 — срок аренды.', 'The server hands out addresses from the pool 192.168.1.100–199 and with each address sends options: 1 — mask, 3 — gateway, 6 — DNS server, 51 — lease time.'], ['dnsmasq в домашнем роутере.', 'dnsmasq in the home router.'], undefined, DOC.rfc2132), { sub: '192.168.1.1' }),
      node('rogue', b('Старый роутер', 'Old router'), 'l7', [760, 232, 176, 72], card(['Второй DHCP-сервер в той же сети: кто-то принёс старый роутер и включил его кабелем в коммутатор. Клиент берёт первое предложение.', 'A second DHCP server on the same network: someone brought an old router and plugged it into the switch. The client takes the first offer.'], ['Неаккуратный сосед по офису.', 'A careless office mate.']), { sub: '192.168.1.250' }),
    ],
    edges: [
      edge('bcast', 'laptop', 'router', '0.0.0.0:68 → 255.255.255.255:67', card(['Широковещательная UDP-датаграмма: ноутбук не знает, где сервер, поэтому кричит всем в своей сети. Дальше роутера такой пакет не уходит.', 'A broadcast UDP datagram: the laptop does not know where the server is, so it shouts to everyone on its network. Such a packet never goes beyond the router.'], ['dhcpcd.', 'dhcpcd.'], 'tcpdump -n port 67 or port 68', DOC.rfc2131), { via: [[480, 180], [480, 100]], labelAt: 0.25 }),
      edge('bcast2', 'laptop', 'rogue', b('его слышат все', 'everyone hears it'), card(['Тот же Discover доходит до каждого устройства сети, в том числе до второго сервера.', 'The same Discover reaches every device on the network, the second server included.'], ['—', '—']), { via: [[480, 180], [480, 268]], labelAt: 0.7 }),
    ],
    groups: [{ id: 'lan', label: b('широковещательная зона 192.168.1.0/24', 'broadcast domain 192.168.1.0/24'), around: ['laptop', 'router', 'rogue'], family: 'l2', dash: 'dash', pad: 16, card: card(['Все, кто получает кадры на ff:ff:ff:ff:ff:ff: одна локальная сеть за одним коммутатором. Роутер — её граница.', 'Everyone who receives frames to ff:ff:ff:ff:ff:ff: one local network behind one switch. The router is its border.'], ['Тот, кто соединил кабели.', 'Whoever wired the cables.'])}],
  },
  params: [
    {
      id: 'lease',
      label: b('Срок аренды (опция 51)', 'Lease time (option 51)'),
      kind: 'range',
      min: 60,
      max: 86400,
      step: 60,
      unit: 's',
      default: 86400,
      near: 'router',
      predict: {
        prompt: b('Аренда на час. Когда клиент впервые попросит её продлить?', 'The lease is for one hour. When will the client first ask to renew it?'),
        options: [
          { id: 'half', text: b('Через 30 минут — на половине срока', 'After 30 minutes — at half the lease') },
          { id: 'end', text: b('Через час, когда аренда кончится', 'After an hour, when the lease ends') },
        ],
        resolve: () => 'half',
      },
    },
  ],
  breaks: [
    {
      id: 'off',
      label: b('DHCP-сервер выключен', 'The DHCP server is off'),
      remove: ['router'],
      layer: 'L7',
      predict: {
        prompt: b('Сервер не отвечает. Какой адрес окажется у ноутбука?', 'The server does not answer. What address will the laptop end up with?'),
        options: [
          { id: 'll', text: b('169.254.x.x — придумает сам, интернета не будет', '169.254.x.x — it makes one up; there will be no internet') },
          { id: 'none', text: b('Никакого', 'None at all') },
          { id: 'old', text: b('Прошлый адрес', 'The previous address') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'router' ? 'll' : 'none'),
      },
    },
    {
      id: 'rogue',
      label: b('В сети второй DHCP-сервер', 'A second DHCP server on the network'),
      remove: [],
      layer: 'L7',
      predict: {
        prompt: b('Старый роутер ответил быстрее. Что не так у ноутбука?', 'The old router answered faster. What is wrong on the laptop?'),
        options: [
          { id: 'gw', text: b('Шлюз и DNS-сервер — чужие: интернета нет', 'The gateway and the DNS server are wrong: no internet') },
          { id: 'fine', text: b('Всё в порядке, адрес ведь получен', 'Everything is fine, it got an address') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'rogue' ? 'gw' : 'fine'),
      },
    },
  ],
  metrics: [
    { id: 'msgs', label: b('сообщений DHCP', 'DHCP messages') },
    { id: 't1', label: b('T1', 'T1'), unit: 's' },
    { id: 't2', label: b('T2', 'T2'), unit: 's' },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const rogue = broken.has('rogue');
    steps.push({ id: 'discover', label: 'Discover', caption: b('Ноутбук без адреса шлёт DHCP Discover с 0.0.0.0:68 на 255.255.255.255:67: «Есть тут сервер?» Его слышат все в локальной сети.', 'The laptop without an address sends a DHCP Discover from 0.0.0.0:68 to 255.255.255.255:67: “Is there a server here?” Everyone on the local network hears it.'), focus: ['bcast', 'bcast2', 'lan'], tokens: [{ edge: 'bcast', label: 'Discover' }, { edge: 'bcast2', label: 'Discover' }], states: { laptop: 'wait', rogue: rogue ? 'on' : 'off' }, metrics: { msgs: 1 } });
    if (broken.has('off') && !rogue) {
      steps.push({ id: 'retry', label: b('тишина', 'silence'), caption: b('Ответа нет. Клиент повторяет Discover с растущими паузами.', 'No answer. The client repeats the Discover with growing pauses.'), focus: ['bcast'], tokens: [{ edge: 'bcast', label: 'Discover' }], states: { router: 'off' }, metrics: { msgs: 3 } });
      steps.push({
        id: 'll',
        label: '169.254',
        caption: b('Сервер так и не ответил. dhcpcd выбирает себе адрес из 169.254.0.0/16 (link-local) — с ним можно говорить с соседями по кабелю, но шлюза и интернета нет.', 'The server never answered. dhcpcd picks an address from 169.254.0.0/16 (link-local) — enough to talk to neighbours on the cable, but there is no gateway and no internet.'),
        focus: ['laptop'],
        states: { laptop: 'err' },
        values: { laptop: '169.254.23.141' },
        metrics: { msgs: 3 },
        broken: { at: 'router', message: 'eth0: soliciting a DHCP lease\neth0: probing for an IPv4LL address\neth0: using IPv4LL address 169.254.23.141\neth0: adding route to 169.254.0.0/16\ntimed out', caption: b('адрес 169.254.x.x на интерфейсе — верный признак: DHCP-сервер не ответил.', 'a 169.254.x.x address on an interface is a sure sign: the DHCP server did not answer.') },
      });
      return steps;
    }
    const from = rogue ? 'rogue' : 'router';
    const edgeId = rogue ? 'bcast2' : 'bcast';
    const offer = rogue ? '192.168.1.23' : '192.168.1.103';
    steps.push({ id: 'offer', label: 'Offer', caption: rogue ? b('Отвечают оба, но старый роутер — быстрее: Offer 192.168.1.23, шлюз 192.168.1.250, DNS 192.168.1.250. Клиент берёт первое предложение.', 'Both answer, but the old router is faster: Offer 192.168.1.23, gateway 192.168.1.250, DNS 192.168.1.250. The client takes the first offer.') : b('Сервер предлагает: «Бери 192.168.1.103. Маска /24 (опция 1), шлюз 192.168.1.1 (опция 3), DNS 192.168.1.1 (опция 6), срок — опция 51».', 'The server offers: “Take 192.168.1.103. Mask /24 (option 1), gateway 192.168.1.1 (option 3), DNS 192.168.1.1 (option 6), lease time — option 51.”'), focus: [edgeId, from], tokens: [{ edge: edgeId, reverse: true, label: `Offer ${offer}` }], states: { [from]: 'on' }, metrics: { msgs: 2 } });
    steps.push({ id: 'request', label: 'Request', caption: b('Клиент снова широковещательно: «Беру этот адрес у этого сервера». Так узнают и другие серверы, что их предложение отклонено.', 'The client broadcasts again: “I take this address from this server.” This also tells other servers their offers were declined.'), focus: [edgeId], tokens: [{ edge: edgeId, label: 'Request' }], metrics: { msgs: 3 } });
    const t1 = Math.round(p.lease * 0.5);
    const t2 = Math.round(p.lease * 0.875);
    steps.push({
      id: 'ack',
      label: 'Ack',
      caption: fmt(b('Сервер подтверждает: адрес {a} ваш на {l}. Клиент настраивает интерфейс, маршрут по умолчанию через шлюз и записывает DNS-сервер в /etc/resolv.conf.', 'The server confirms: {a} is yours for {l}. The client configures the interface, a default route via the gateway and writes the DNS server into /etc/resolv.conf.'), { a: offer, l: fmtTime(rogue ? 3600 : p.lease) }),
      focus: [edgeId, 'laptop'],
      tokens: [{ edge: edgeId, reverse: true, label: 'Ack' }],
      states: { laptop: rogue ? 'warn' : 'ok' },
      values: { laptop: offer },
      metrics: { msgs: 4, t1, t2 },
    });
    if (rogue) {
      steps.push({
        id: 'wrong',
        label: b('чужой шлюз', 'wrong gateway'),
        caption: b('Адрес есть, а интернета нет: шлюзом назначен старый роутер, у которого нет выхода наружу. Причина на уровне DHCP, симптом — на уровне маршрутов.', 'There is an address but no internet: the old router became the gateway, and it has no way out. The cause is in DHCP, the symptom is in the routes.'),
        focus: ['rogue', 'laptop'],
        states: { rogue: 'err', laptop: 'err' },
        metrics: { msgs: 4, t1, t2 },
        broken: { at: 'rogue', message: '$ ip r\ndefault via 192.168.1.250 dev eth0 proto dhcp metric 1002\n$ ping -c 2 1.1.1.1\n--- 1.1.1.1 ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss', caption: b('захват покажет два Offer от разных серверов — вот и доказательство.', 'a capture shows two Offers from different servers — that is the proof.') },
      });
      return steps;
    }
    steps.push({ id: 'renew', label: 'T1', caption: fmt(b('Аренда не вечна. На половине срока (T1 = {t1} с) клиент просит продления прямо у своего сервера; если тот молчит, на 87,5 % (T2 = {t2} с) спрашивает любого.', 'A lease is not forever. At half its time (T1 = {t1} s) the client asks its own server to renew; if that one is silent, at 87.5 % (T2 = {t2} s) it asks anyone.'), { t1, t2 }), focus: ['laptop', 'router'], metrics: { msgs: 4, t1, t2 } });
    return steps;
  },
  explainDelta(_prev, next, change) {
    if (change.kind === 'break') return change.on ? (change.id === 'off' ? b('Без сервера клиент назначает себе 169.254.x.x: соседи по кабелю видны, интернета нет.', 'Without a server the client assigns itself 169.254.x.x: neighbours on the cable are visible, the internet is not.') : b('Два сервера: первым ответил чужой — у ноутбука чужой шлюз и чужой DNS.', 'Two servers: the wrong one answered first — the laptop gets the wrong gateway and the wrong DNS.')) : b('Сервер снова один, и он отвечает.', 'There is one server again, and it answers.');
    return fmt(b('Продление на {t1} с, повторная попытка у любого сервера на {t2} с.', 'Renewal at {t1} s, a retry with any server at {t2} s.'), { t1: lastMetric(next, 't1') ?? 0, t2: lastMetric(next, 't2') ?? 0 });
  },
});
