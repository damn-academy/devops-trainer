// E-NAT (03 §7.4, screens 4–6): the home router rewrites the source address
// of outgoing packets to its public one, writes the mapping into conntrack and
// rewrites answers back. Without the mapping an answer has nowhere to go.
//
// Reading order: at the first step only the laptop and the router are on the
// diagram; the site and the conntrack table appear when the packet reaches
// them. The acting block says in a callout what it does, and the packet travels
// along the line as a card with the source address it carries at that moment.

import { defineModel } from '../../../core/define';
import { bi, fmt, t } from '../../../core/i18n';
import type { ElementState, Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { devices: number; inbound: boolean };

const HIDDEN: Record<string, ElementState> = Object.fromEntries(['server', 'ct', 'wan', 'rec'].map((id) => [id, 'hidden' as ElementState]));
const rows = (n: number) => t(bi(`записей: ${n}`, `${n} ${n === 1 ? 'entry' : 'entries'}`));

export const natModel = defineModel<P>({
  id: 'net.nat',
  block: 'networks',
  title: b('Как NAT даёт всей квартире выйти в интернет через один адрес', 'NAT: one public address for the whole flat'),
  summary: b(
    'Ноутбук с адресом 192.168.1.23 открывает сайт с адресом 198.51.100.20. Частные адреса вроде 192.168.1.23 в интернете никуда не ведут, поэтому домашний роутер подменяет адрес отправителя своим публичным адресом и запоминает эту замену в таблице conntrack. Карточка на линии показывает, с каким адресом отправителя пакет идёт по этому участку.',
    'Laptop 192.168.1.23 opens site 198.51.100.20. Private addresses lead nowhere on the internet, so the home router replaces the source address with its public one and records the swap in the conntrack table. The card on the line shows the source address the packet carries on that segment.',
  ),
  intro: b(
    'Схема соберётся по шагам, и сейчас на ней только ноутбук и роутер. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что он делает, а под таблицей conntrack растёт число записей.\n\nПосле первого прохода добавьте устройств в квартире, включите подключение снаружи и уберите правило NAT в блоке «Сломать».',
    'The diagram builds itself step by step: now it shows only the laptop and the router. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted block says what it does; the entry count grows under the conntrack table.\n\nAfter the first pass add devices at home, switch on the connection from outside and remove the NAT rule in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: b('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: b('что этот блок делает', 'what it does') },
    { mark: 'token', text: b('пакет и адрес отправителя на этом участке', 'the packet and its source address on this segment') },
    { mark: 'icon:terminal', text: b('ноутбук', 'laptop') },
    { mark: 'icon:router', text: b('роутер с NAT', 'router with NAT') },
    { mark: 'icon:server', text: b('сервер сайта', 'the site’s server') },
    { mark: 'icon:file', text: b('таблица соединений conntrack', 'the conntrack table') },
    { mark: 'ok', text: b('ответ вернулся к ноутбуку', 'the reply reached the laptop') },
    { mark: 'err', text: b('здесь пакет остановился', 'the packet stopped here') },
  ],
  stopLabel: b('Пакет не дошёл', 'The packet did not arrive'),
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      node('laptop', b('Ноутбук', 'Laptop'), 'user', [24, 72, 176, 64], card(['У ноутбука частный адрес из диапазона 192.168.0.0/16, описанного в RFC 1918. Такие адреса одновременно используют миллионы квартир, поэтому в интернете они ничего не значат.', 'A private address from 192.168.0.0/16 (RFC 1918). Millions of flats use such addresses at once — that is why they mean nothing on the internet.'], ['Адрес выдал сервер DHCP в роутере.', 'The router’s DHCP server.'], 'ip -br a', DOC.rfc1918), { sub: '192.168.1.23', icon: 'terminal' }),
      node('router', b('Роутер с NAT', 'Router with NAT'), 'l3', [384, 64, 192, 80], card(['Когда пакет уходит в интернет, роутер заменяет в нём адрес отправителя своим публичным адресом, а порт отправителя свободным портом роутера. Такая замена называется SNAT, а в Linux её делает правило iptables -t nat -A POSTROUTING -o wan0 -j MASQUERADE.', 'On the way to the internet the router changes the source address to its public one (SNAT; in Linux, MASQUERADE) and the port to a free one of its own. The rule: iptables -t nat -A POSTROUTING -o wan0 -j MASQUERADE.'], ['Замену выполняет прошивка роутера, а в Linux подсистема netfilter.', 'The router’s firmware (on Linux, netfilter).'], 'iptables -t nat -L -n -v', DOC.iptMan), { sub: '192.168.1.1 | 203.0.113.7', icon: 'router', work: 'spin' }),
      node('server', b('Сайт', 'Site'), 'node', [760, 72, 176, 64], card(['Сервер сайта видит соединение от адреса 203.0.113.7, то есть от роутера, и ничего не знает о ноутбуке.', 'The server sees a connection from 203.0.113.7 — the router’s address. It knows nothing about the laptop.'], ['Сервер принадлежит владельцу сайта.', 'The site owner.']), { sub: '198.51.100.20', icon: 'server' }),
      node('ct', b('Таблица conntrack', 'conntrack table'), 'obj', [312, 232, 336, 120], card(['Таблица соединений в ядре роутера. В каждой её строке записано, кто к кому подключился и через какой внешний порт была сделана замена, и по этой строке ответ находит дорогу обратно. Записи устаревают сами: запись об установленном соединении TCP ядро хранит до пяти суток, а запись UDP от 30 до 180 секунд.', 'The connection table in the router’s kernel. Each line is “who, to whom, rewritten through which port”. The reply finds its way back through it. Entries age: TCP for days, UDP for 30–180 seconds.'], ['Строки добавляет само ядро, модуль nf_conntrack, для каждого нового соединения.', 'The kernel (the nf_conntrack module) — by itself, for every new connection.'], 'conntrack -L'), { shape: 'doc', sub: rows(0), icon: 'file' }),
    ],
    edges: [
      edge('lan', 'laptop', 'router', '192.168.1.0/24', card(['Этот участок проходит по домашней сети, и на нём у пакета ещё частный адрес отправителя.', 'The home network. Here the packet still has the private source address.'], ['Сеть создал роутер.', 'The router.'], 'tcpdump -n -i eth0')),
      edge('wan', 'router', 'server', b('интернет', 'internet'), card(['Этот участок проходит по интернету, и здесь у пакета уже адрес роутера, 203.0.113.7:40001.', 'Outside. Here the packet already carries the router’s address: 203.0.113.7:40001.'], ['Участок принадлежит провайдеру и другим сетям.', 'The provider and other networks.'], 'tcpdump -n -i wan0')),
      edge('rec', 'router', 'ct', b('запись', 'record'), card(['При первом пакете соединения ядро записывает соответствие между внутренним адресом с портом и внешним портом.', 'On the first packet of a connection the kernel records the mapping “inside address and port ↔ outside port”.'], ['Запись делает ядро роутера.', 'The kernel.'])),
    ],
  },
  params: [
    {
      id: 'devices',
      group: b('Что происходит в квартире', 'What happens at home'),
      label: b('Сколько устройств в квартире одновременно открывают сайты', 'Devices at home'),
      kind: 'range',
      min: 1,
      max: 50,
      step: 1,
      default: 1,
      near: 'ct',
      predict: {
        prompt: b('Дома 20 устройств, и у роутера один публичный адрес. По какому признаку роутер разберёт, какому устройству отдать ответ?', 'There are 20 devices at home and the router has one public address. How are their answers told apart?'),
        options: [
          { id: 'port', text: b('По внешнему порту, потому что у каждого соединения он свой', 'By the outside port: every connection gets its own') },
          { id: 'mac', text: b('По MAC-адресам устройств', 'By the devices’ MAC addresses') },
        ],
        resolve: () => 'port',
      },
    },
    {
      id: 'inbound',
      group: b('Что происходит снаружи', 'What happens outside'),
      label: b('Кто-то из интернета подключается к ноутбуку', 'Someone outside connects to the laptop'),
      kind: 'toggle',
      default: false,
      near: 'wan',
      predict: {
        prompt: b('Друг пытается подключиться к игровому серверу на ноутбуке по адресу роутера 203.0.113.7, а пробросов портов на роутере нет. Что произойдёт с его пакетом?', 'A friend tries to connect to a game server on the laptop at 203.0.113.7. What happens?'),
        options: [
          { id: 'stop', text: b('Пакет остановится на роутере, потому что в conntrack нет подходящей записи', 'The packet stops at the router: there is no conntrack entry for it') },
          { id: 'pass', text: b('Роутер передаст пакет ноутбуку', 'The router passes it to the laptop') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'router' ? 'stop' : 'pass'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-nat',
      label: b('С роутера удалено правило MASQUERADE', 'The MASQUERADE rule is removed'),
      remove: ['rec', 'ct'],
      layer: 'L3',
      predict: {
        prompt: b('С роутера удалили правило NAT, а пересылка пакетов осталась включённой. Дойдёт ли до ноутбука ответ сайта?', 'The NAT rule is deleted. Will the site’s answer reach the laptop?'),
        options: [
          { id: 'lost', text: b('Нет, потому что сайт ответит на адрес 192.168.1.23, а такой адрес в интернете никуда не ведёт', 'No: the site answers 192.168.1.23, and that address leads nowhere on the internet') },
          { id: 'ok', text: b('Да, ответ дойдёт, только медленнее', 'Yes, just slower') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'wan' ? 'lost' : 'ok'),
      },
    },
  ],
  metrics: [{ id: 'entries', label: b('записей в conntrack', 'conntrack entries') }],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const n = p.devices;
    if (p.inbound) {
      steps.push({
        id: 'in',
        label: b('снаружи', 'from outside'),
        caption: b('Пакет из интернета приходит на адрес и порт 203.0.113.7:27015. Роутер ищет подходящую запись в conntrack, но такого соединения никто изнутри не открывал.', 'A packet from the internet arrives at 203.0.113.7:27015. The router looks it up in conntrack — nobody inside opened such a connection.'),
        focus: ['wan', 'router', 'ct'],
        tokens: [{ edge: 'wan', reverse: true, label: '→ :27015' }],
        say: { router: b('Роутер ищет в conntrack запись для порта 27015 и не находит её.', 'The router looks for an entry for port 27015 and finds none.') },
        states: { ...HIDDEN, router: 'on', server: 'on', wan: 'on', ct: 'on' },
        metrics: { entries: 0 },
      });
      steps.push({
        id: 'stop',
        label: b('нет записи', 'nowhere'),
        caption: b('Записи нет, поэтому роутер не знает, какому из домашних устройств отдать пакет. Пакет адресован самому роутеру, а на этом порту роутера никто не ждёт соединений. Чтобы пустить такой пакет внутрь, нужен проброс порта, то есть правило DNAT.', 'There is no entry — the router does not know which home device should get the packet. It is addressed to the router itself, and nothing waits for it there. To let it in you need port forwarding (DNAT).'),
        focus: ['router'],
        say: { router: b('Роутер не знает, кому отдать пакет, и отвечает отказом.', 'The router does not know whom to give the packet to and refuses.') },
        states: { router: 'err', laptop: 'off' },
        metrics: { entries: 0 },
        broken: { at: 'router', message: "$ nc -zv -w 3 203.0.113.7 27015\nnc: connect to 203.0.113.7 port 27015 (tcp) failed: Connection refused", caption: b('NAT пропускает соединения изнутри наружу и ответы на них. Новое соединение снаружи без правила DNAT не пройдёт, а если провайдер сам держит вас за общим адресом (CGNAT), не пройдёт и с ним.', 'NAT lets through “inside to outside” and the replies to it. A new connection from outside will not pass without DNAT — and behind the provider’s CGNAT not even with it.') },
      });
      return steps;
    }
    steps.push({
      id: 'out',
      label: b('наружу', 'outbound'),
      caption: b('Ноутбук отправляет пакет SYN от 192.168.1.23:51234 к 198.51.100.20:443. Кадр идёт к роутеру, потому что роутер служит шлюзом по умолчанию.', 'The laptop sends a SYN: 192.168.1.23:51234 → 198.51.100.20:443. The frame goes to the router — the default gateway.'),
      focus: ['laptop', 'lan'],
      tokens: [{ edge: 'lan', label: 'SYN 192.168.1.23:51234' }],
      say: { laptop: b('Ноутбук открывает соединение с сайтом и отправляет пакет SYN через роутер.', 'The laptop opens a connection to the site and sends a SYN through the router.') },
      states: { ...HIDDEN, laptop: 'on', router: 'on' },
      metrics: { entries: 0 },
    });
    if (broken.has('no-nat')) {
      steps.push({
        id: 'fwd',
        label: b('без подмены', 'unchanged'),
        caption: b('Правила NAT нет, и роутер пересылает пакет как есть, с частным адресом отправителя. Сайт этот пакет всё же получит, потому что маршрут к нему есть.', 'There is no NAT rule: the router forwards the packet as it is, with the private source address. The site receives it.'),
        focus: ['router', 'wan', 'server'],
        tokens: [{ edge: 'wan', label: 'SYN 192.168.1.23:51234' }],
        say: { router: b('Роутер пересылает пакет, не меняя частный адрес отправителя.', 'The router forwards the packet without changing the private source.') },
        states: { server: 'on', wan: 'on' },
        metrics: { entries: 0 },
      });
      steps.push({
        id: 'lost',
        label: b('ответ', 'reply'),
        caption: b('Сайт отвечает на адрес 192.168.1.23, а это частный адрес. Ни один маршрутизатор интернета не знает, куда такой пакет доставить, и ответ пропадает уже у провайдера сайта.', 'The site answers 192.168.1.23 — a private address. No internet router knows where to carry it: the answer is lost at the provider.'),
        focus: ['server', 'wan'],
        tokens: [{ edge: 'wan', reverse: true, label: '→ 192.168.1.23' }],
        say: { server: b('Сайт отправляет ответ на частный адрес, который в интернете никуда не ведёт.', 'The site sends the reply to a private address that leads nowhere.') },
        states: { wan: 'err', laptop: 'err' },
        metrics: { entries: 0 },
        broken: { at: 'wan', message: "$ curl --connect-timeout 10 https://shop.example/\ncurl: (28) Failed to connect to shop.example port 443 after 10002 ms: Timeout was reached", caption: b('Частные адреса из RFC 1918 в интернете не маршрутизируются, поэтому без NAT из домашней сети наружу не выйти.', 'private RFC 1918 addresses are not routed on the internet — without NAT the home network cannot get out.') },
      });
      return steps;
    }
    steps.push({
      id: 'snat',
      label: 'SNAT',
      caption: b('На выходе из роутера срабатывает правило MASQUERADE. Роутер заменяет отправителя на 203.0.113.7:40001 и записывает в conntrack, что соединение 192.168.1.23:51234 с сайтом 198.51.100.20:443 теперь идёт через внешний порт 40001.', 'POSTROUTING: the MASQUERADE rule. The router replaces the source with 203.0.113.7:40001 and writes to conntrack: “192.168.1.23:51234 ↔ :40001 ↔ 198.51.100.20:443”.'),
      focus: ['router', 'rec', 'ct'],
      tokens: [{ edge: 'rec', label: ':51234 ↔ :40001' }],
      say: { router: b('Роутер ставит на пакет свой адрес 203.0.113.7:40001 и записывает замену в conntrack.', 'The router puts 203.0.113.7:40001 on the packet and records the swap.') },
      states: { router: 'on', ct: 'on', rec: 'on' },
      values: { ct: rows(n) },
      metrics: { entries: n },
    });
    steps.push({
      id: 'wire',
      label: b('в интернете', 'on the internet'),
      caption: b('По интернету пакет идёт с публичным адресом роутера. Сайт видит соединение от 203.0.113.7 так же, как от любой другой квартиры с NAT.', 'On the internet the packet travels with the router’s public address. The site sees a connection from 203.0.113.7 — like from any other flat with NAT.'),
      focus: ['wan', 'server'],
      tokens: [{ edge: 'wan', label: 'SYN 203.0.113.7:40001' }],
      say: { server: b('Сайт принимает соединение от адреса 203.0.113.7 и отвечает на него.', 'The site accepts the connection from 203.0.113.7 and answers.') },
      states: { server: 'on', wan: 'on' },
      metrics: { entries: n },
    });
    steps.push({
      id: 'reply',
      label: b('обратно', 'back'),
      caption: b('Ответ приходит на 203.0.113.7:40001. Роутер находит строку в conntrack и меняет получателя обратно на 192.168.1.23:51234, так что ноутбук ничего не замечает.', 'The answer arrives at 203.0.113.7:40001. The router finds the line in conntrack and rewrites the destination back: 192.168.1.23:51234. The laptop noticed nothing.'),
      focus: ['router', 'ct', 'lan'],
      tokens: [{ edge: 'wan', reverse: true, label: '→ :40001' }, { edge: 'lan', reverse: true, label: '→ .23:51234' }],
      say: { router: b('Роутер находит в conntrack, что порт 40001 принадлежит ноутбуку, и передаёт ему ответ.', 'The router finds that port 40001 belongs to the laptop and passes the reply on.') },
      states: { laptop: 'ok' },
      metrics: { entries: n },
    });
    if (n > 1)
      steps.push({
        id: 'many',
        label: b('много устройств', 'many'),
        caption: fmt(b('В квартире {n} устройств, и у всех один внешний адрес. Различает их только внешний порт, который у каждого соединения свой. На один адрес приходится 65 535 портов, и облачный шлюз NAT, через который идут тысячи соединений к одному сайту, может их исчерпать.', 'There are {n} devices at home — all with one outside address. Only the outside port tells them apart: every connection has its own. There are 65,535 ports per address — a cloud NAT gateway runs out of them with thousands of connections to one site.'), { n }),
        focus: ['ct'],
        say: { ct: fmt(b('В таблице {n} записей, и у каждой свой внешний порт.', '{n} entries, each with its own outside port.'), { n }) },
        values: { ct: rows(n) },
        metrics: { entries: n },
      });
    return steps;
  },
  explainDelta(prev, next, change, _a, bb) {
    if (change.kind === 'break')
      return change.on
        ? b('Без правила MASQUERADE пакет уходит с частным адресом, и ответ на него не находит дороги назад.', 'Without MASQUERADE the packet leaves with a private address — and the answer cannot find its way.')
        : b('Правило NAT вернулось, и ответы снова приходят домой.', 'NAT is back: answers come home again.');
    if (change.id === 'inbound')
      return bb.inbound
        ? b('Без записи в conntrack снаружи внутрь не пройти, поэтому NAT сам по себе работает как фильтр входящих соединений.', 'Without a conntrack entry nothing gets in from outside: NAT works as a filter of incoming connections by itself.')
        : b('Соединение снова исходящее, и NAT его пропускает.', 'An outgoing connection again: NAT lets it through.');
    return fmt(b('Число устройств изменилось с {a} до {b}, и в conntrack теперь {b} записей, у каждой свой внешний порт.', 'Devices {a} → {b}: {b} conntrack lines, each with its own outside port.'), { a: lastMetric(prev, 'entries') ?? 0, b: lastMetric(next, 'entries') ?? (bb.devices as number) });
  },
});
