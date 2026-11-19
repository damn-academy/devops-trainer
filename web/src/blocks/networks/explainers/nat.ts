// E-NAT (03 §7.4, screens 4–6): the home router rewrites the source address
// of outgoing packets to its public one, writes the mapping into conntrack and
// rewrites answers back. Without the mapping an answer has nowhere to go.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { devices: number; inbound: boolean };

export const natModel = defineModel<P>({
  id: 'net.nat',
  block: 'networks',
  title: b('NAT: один публичный адрес на всю квартиру', 'NAT: one public address for the whole flat'),
  summary: b('Ноутбук 192.168.1.23 открывает сайт 198.51.100.20. Частный адрес в интернете не маршрутизируется — роутер подменяет его своим.', 'Laptop 192.168.1.23 opens site 198.51.100.20. A private address is not routed on the internet — the router replaces it with its own.'),
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      node('laptop', b('Ноутбук', 'Laptop'), 'user', [24, 72, 168, 64], card(['Частный адрес из 192.168.0.0/16 (RFC 1918). Такие адреса есть в миллионах квартир одновременно — поэтому в интернете они ничего не значат.', 'A private address from 192.168.0.0/16 (RFC 1918). Millions of flats use such addresses at once — that is why they mean nothing on the internet.'], ['DHCP-сервер роутера.', 'The router’s DHCP server.'], 'ip -br a', DOC.rfc1918), { sub: '192.168.1.23' }),
      node('router', b('Роутер с NAT', 'Router with NAT'), 'l3', [392, 64, 176, 80], card(['На выходе в интернет роутер меняет адрес источника на свой публичный (SNAT, в Linux — MASQUERADE) и порт — на свободный свой. Правило: iptables -t nat -A POSTROUTING -o wan0 -j MASQUERADE.', 'On the way to the internet the router changes the source address to its public one (SNAT; in Linux, MASQUERADE) and the port to a free one of its own. The rule: iptables -t nat -A POSTROUTING -o wan0 -j MASQUERADE.'], ['Прошивка роутера (на Linux — netfilter).', 'The router’s firmware (on Linux, netfilter).'], 'iptables -t nat -L -n -v', DOC.iptMan), { sub: '192.168.1.1 | 203.0.113.7' }),
      node('server', b('Сайт', 'Site'), 'node', [768, 72, 168, 64], card(['Сервер видит соединение от 203.0.113.7 — адреса роутера. О ноутбуке он не знает ничего.', 'The server sees a connection from 203.0.113.7 — the router’s address. It knows nothing about the laptop.'], ['—', '—']), { sub: '198.51.100.20' }),
      node('ct', 'conntrack', 'obj', [312, 232, 336, 120], card(['Таблица соединений в ядре роутера. Каждая строка — «кто, к кому, через какой порт подменён». По ней ответ находит дорогу назад. Записи стареют: TCP — дни, UDP — 30–180 секунд.', 'The connection table in the router’s kernel. Each line is “who, to whom, rewritten through which port”. The reply finds its way back through it. Entries age: TCP for days, UDP for 30–180 seconds.'], ['Ядро (модуль nf_conntrack) — само, для каждого нового соединения.', 'The kernel (the nf_conntrack module) — by itself, for every new connection.'], 'conntrack -L'), { shape: 'doc', sub: '0 entries' }),
    ],
    edges: [
      edge('lan', 'laptop', 'router', '192.168.1.0/24', card(['Домашняя сеть. Здесь пакет ещё с частным адресом источника.', 'The home network. Here the packet still has the private source address.'], ['—', '—'], 'tcpdump -n -i eth0')),
      edge('wan', 'router', 'server', b('интернет', 'internet'), card(['Снаружи. Здесь у пакета уже адрес роутера: 203.0.113.7:40001.', 'Outside. Here the packet already carries the router’s address: 203.0.113.7:40001.'], ['—', '—'], 'tcpdump -n -i wan0')),
      edge('rec', 'router', 'ct', b('запись', 'record'), card(['При первом пакете соединения ядро записывает соответствие «внутренний адрес и порт ↔ внешний порт».', 'On the first packet of a connection the kernel records the mapping “inside address and port ↔ outside port”.'], ['Ядро.', 'The kernel.'])),
    ],
  },
  params: [
    {
      id: 'devices',
      label: b('Устройств дома', 'Devices at home'),
      kind: 'range',
      min: 1,
      max: 50,
      step: 1,
      default: 1,
      near: 'ct',
      predict: {
        prompt: b('Дома 20 устройств, у роутера один публичный адрес. Как сайт отличит их ответы?', 'There are 20 devices at home and the router has one public address. How are their answers told apart?'),
        options: [
          { id: 'port', text: b('По внешнему порту: у каждого соединения свой', 'By the outside port: every connection gets its own') },
          { id: 'mac', text: b('По MAC-адресам устройств', 'By the devices’ MAC addresses') },
        ],
        resolve: () => 'port',
      },
    },
    {
      id: 'inbound',
      label: b('Кто-то снаружи подключается к ноутбуку', 'Someone outside connects to the laptop'),
      kind: 'toggle',
      default: false,
      near: 'wan',
      predict: {
        prompt: b('Друг пытается подключиться к игровому серверу на ноутбуке по адресу 203.0.113.7. Что будет?', 'A friend tries to connect to a game server on the laptop at 203.0.113.7. What happens?'),
        options: [
          { id: 'stop', text: b('Пакет остановится на роутере: для него нет записи в conntrack', 'The packet stops at the router: there is no conntrack entry for it') },
          { id: 'pass', text: b('Роутер передаст пакет ноутбуку', 'The router passes it to the laptop') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'router' ? 'stop' : 'pass'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-nat',
      label: b('Убрать MASQUERADE', 'Remove MASQUERADE'),
      remove: ['rec', 'ct'],
      layer: 'L3',
      predict: {
        prompt: b('Правило NAT удалили. Дойдёт ли до ноутбука ответ сайта?', 'The NAT rule is deleted. Will the site’s answer reach the laptop?'),
        options: [
          { id: 'lost', text: b('Нет: сайт ответит на 192.168.1.23, а такой адрес в интернете не ведёт никуда', 'No: the site answers 192.168.1.23, and that address leads nowhere on the internet') },
          { id: 'ok', text: b('Да, просто медленнее', 'Yes, just slower') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'wan' ? 'lost' : 'ok'),
      },
    },
  ],
  metrics: [{ id: 'entries', label: b('строк в conntrack', 'conntrack entries') }],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const n = p.devices;
    if (p.inbound) {
      steps.push({ id: 'in', label: b('снаружи', 'from outside'), caption: b('Пакет из интернета приходит на 203.0.113.7:27015. Роутер ищет его в conntrack — такого соединения никто изнутри не открывал.', 'A packet from the internet arrives at 203.0.113.7:27015. The router looks it up in conntrack — nobody inside opened such a connection.'), focus: ['wan', 'router', 'ct'], tokens: [{ edge: 'wan', reverse: true, label: '→ :27015' }], states: { router: 'on' }, metrics: { entries: 0 } });
      steps.push({
        id: 'stop',
        label: b('некуда', 'nowhere'),
        caption: b('Записи нет — роутер не знает, кому из домашних устройств отдать пакет. Пакет адресован самому роутеру, и там его никто не ждёт. Чтобы пустить его внутрь, нужен проброс порта (DNAT).', 'There is no entry — the router does not know which home device should get the packet. It is addressed to the router itself, and nothing waits for it there. To let it in you need port forwarding (DNAT).'),
        focus: ['router'],
        states: { router: 'err', laptop: 'off' },
        metrics: { entries: 0 },
        broken: { at: 'router', message: "$ nc -zv -w 3 203.0.113.7 27015\nnc: connect to 203.0.113.7 port 27015 (tcp) failed: Connection refused", caption: b('NAT пропускает «изнутри наружу» и ответы на это. Новое соединение снаружи без DNAT не пройдёт — а с CGNAT провайдера не пройдёт и с ним.', 'NAT lets through “inside to outside” and the replies to it. A new connection from outside will not pass without DNAT — and behind the provider’s CGNAT not even with it.') },
      });
      return steps;
    }
    steps.push({ id: 'out', label: b('наружу', 'outbound'), caption: b('Ноутбук отправляет SYN: 192.168.1.23:51234 → 198.51.100.20:443. Кадр идёт к роутеру — это шлюз по умолчанию.', 'The laptop sends a SYN: 192.168.1.23:51234 → 198.51.100.20:443. The frame goes to the router — the default gateway.'), focus: ['lan'], tokens: [{ edge: 'lan', label: '192.168.1.23:51234' }], states: { laptop: 'on' }, metrics: { entries: 0 } });
    if (broken.has('no-nat')) {
      steps.push({ id: 'fwd', label: b('без подмены', 'unchanged'), caption: b('Правила NAT нет: роутер пересылает пакет как есть, с частным адресом источника. Сайт его получит.', 'There is no NAT rule: the router forwards the packet as it is, with the private source address. The site receives it.'), focus: ['wan', 'server'], tokens: [{ edge: 'wan', label: '192.168.1.23:51234' }], states: { server: 'on' }, metrics: { entries: 0 } });
      steps.push({
        id: 'lost',
        label: b('ответ', 'reply'),
        caption: b('Сайт отвечает на 192.168.1.23 — а это частный адрес. Ни один маршрутизатор интернета не знает, куда его везти: ответ теряется у провайдера.', 'The site answers 192.168.1.23 — a private address. No internet router knows where to carry it: the answer is lost at the provider.'),
        focus: ['wan'],
        states: { wan: 'err', laptop: 'err' },
        metrics: { entries: 0 },
        broken: { at: 'wan', message: "$ curl --connect-timeout 10 https://shop.example/\ncurl: (28) Failed to connect to shop.example port 443 after 10002 ms: Timeout was reached", caption: b('частные адреса RFC 1918 в интернете не маршрутизируются — без NAT из домашней сети наружу не выйти.', 'private RFC 1918 addresses are not routed on the internet — without NAT the home network cannot get out.') },
      });
      return steps;
    }
    steps.push({ id: 'snat', label: 'SNAT', caption: b('POSTROUTING: правило MASQUERADE. Роутер подменяет источник на 203.0.113.7:40001 и пишет в conntrack: «192.168.1.23:51234 ↔ :40001 ↔ 198.51.100.20:443».', 'POSTROUTING: the MASQUERADE rule. The router replaces the source with 203.0.113.7:40001 and writes to conntrack: “192.168.1.23:51234 ↔ :40001 ↔ 198.51.100.20:443”.'), focus: ['router', 'rec', 'ct'], tokens: [{ edge: 'rec', label: ':51234 ↔ :40001' }], states: { router: 'on', ct: 'on' }, values: { ct: `${n} ${n === 1 ? 'entry' : 'entries'}` }, metrics: { entries: n } });
    steps.push({ id: 'wire', label: b('в интернете', 'on the internet'), caption: b('По интернету пакет едет с публичным адресом роутера. Сайт видит соединение от 203.0.113.7 — так же, как от любой другой квартиры с NAT.', 'On the internet the packet travels with the router’s public address. The site sees a connection from 203.0.113.7 — like from any other flat with NAT.'), focus: ['wan', 'server'], tokens: [{ edge: 'wan', label: '203.0.113.7:40001' }], states: { server: 'on' }, metrics: { entries: n } });
    steps.push({ id: 'reply', label: b('обратно', 'back'), caption: b('Ответ приходит на 203.0.113.7:40001. Роутер находит строку в conntrack и переписывает получателя обратно: 192.168.1.23:51234. Ноутбук ничего не заметил.', 'The answer arrives at 203.0.113.7:40001. The router finds the line in conntrack and rewrites the destination back: 192.168.1.23:51234. The laptop noticed nothing.'), focus: ['wan', 'ct', 'lan'], tokens: [{ edge: 'wan', reverse: true, label: '→ :40001' }, { edge: 'lan', reverse: true, label: '→ .23:51234' }], states: { laptop: 'ok' }, metrics: { entries: n } });
    if (n > 1) steps.push({ id: 'many', label: b('много', 'many'), caption: fmt(b('Дома {n} устройств — и у всех один внешний адрес. Различает их только внешний порт: у каждого соединения свой. Портов 65 535 на адрес — у облачного NAT-шлюза при тысячах соединений к одному сайту они кончаются.', 'There are {n} devices at home — all with one outside address. Only the outside port tells them apart: every connection has its own. There are 65,535 ports per address — a cloud NAT gateway runs out of them with thousands of connections to one site.'), { n }), focus: ['ct'], values: { ct: `${n} entries` }, metrics: { entries: n } });
    return steps;
  },
  explainDelta(prev, next, change, _a, bb) {
    if (change.kind === 'break') return change.on ? b('Без MASQUERADE пакет уходит с частным адресом — и ответ на него не находит дороги.', 'Without MASQUERADE the packet leaves with a private address — and the answer cannot find its way.') : b('NAT вернулся: ответы снова приходят домой.', 'NAT is back: answers come home again.');
    if (change.id === 'inbound') return bb.inbound ? b('Снаружи внутрь без записи в conntrack не пройти: NAT сам по себе работает как фильтр входящих.', 'Without a conntrack entry nothing gets in from outside: NAT works as a filter of incoming connections by itself.') : b('Снова исходящее соединение: его NAT пропускает.', 'An outgoing connection again: NAT lets it through.');
    return fmt(b('Устройств {a} → {b}: строк в conntrack {b}, у каждой свой внешний порт.', 'Devices {a} → {b}: {b} conntrack lines, each with its own outside port.'), { a: lastMetric(prev, 'entries') ?? 0, b: lastMetric(next, 'entries') ?? (bb.devices as number) });
  },
});
