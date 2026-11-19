// E-MAP (03 §7.1): how the internet is built — from the laptop to the data
// centre, in levels of zoom. Each step is one level and one idea: home,
// city (provider, autonomous system), country (exchange point or paid
// transit), world (a cable and the speed of light), the building, the copy
// nearby (CDN) and the root of DNS.
//
// Reading order: at the first step only the laptop and the home router are on
// the map; every other network appears when the request reaches it. The
// participant that works says in a callout what it does, and what it hands on
// travels along the line as a card.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { ElementState, Step } from '../../../core/types';
import { b, brokenAt, card, DOC, edge, lastMetric, node } from './kit';

type P = { cgnat: boolean; ixp: boolean; cdn: boolean; distance: number };

/** One-way latency of each part of the path in milliseconds (equipment included, rounded). */
export function mapLatency(p: P): { wifi: number; access: number; middle: number; cable: number; dc: number; oneWay: number; rtt: number; cdnRtt: number } {
  const wifi = 1;
  const access = 4;
  const middle = p.ixp ? 1 : 18;
  const cable = p.distance * 0.005; // light in fibre: about 200 000 km/s, 5 µs per kilometre
  const dc = 0.5;
  const oneWay = wifi + access + middle + cable + dc;
  return { wifi, access, middle, cable, dc, oneWay, rtt: Math.round(oneWay * 2 * 10) / 10, cdnRtt: (wifi + access + 1) * 2 };
}

const HIDDEN: Record<string, ElementState> = Object.fromEntries(
  ['isp', 'ixp', 'transit', 'cable', 'dc', 'cdn', 'root', 'e-fiber', 'e-peer', 'e-transit', 'e-ixp-cable', 'e-tr-cable', 'e-cable', 'e-cdn', 'e-root'].map((id) => [id, 'hidden' as ElementState]),
);

export const mapModel = defineModel<P>({
  id: 'net.map',
  block: 'networks',
  title: b('Как устроен интернет и какой путь проходит запрос от ноутбука до дата-центра', 'How the internet is built: from a laptop to a data centre'),
  summary: b(
    'Путь запроса от ноутбука в квартире до сервера магазина в дата-центре в другой стране. Схема показывает, через чьи сети проходит запрос, как эти сети договариваются друг с другом и почему расстояние добавляет задержку, которую нельзя убрать. Счётчики под схемой показывают время пути туда и обратно (RTT) и число сетей на пути.',
    'The path of a request from a laptop at home to the shop’s server in a data centre in another country. The diagram shows whose networks the request crosses, how those networks agree with each other and why distance adds a delay nothing can remove. The counters under the diagram show the round-trip time (RTT) and the number of networks on the way.',
  ),
  intro: b(
    'Схема соберётся по шагам, и сейчас на ней только ноутбук и домашний роутер. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждая следующая сеть появляется, когда до неё доходит запрос, а облачко у подсвеченного участника говорит, что он делает.\n\nПосле первого прохода выключите точку обмена трафиком, включите копию сайта в CDN, подвиньте расстояние до дата-центра и попробуйте обе поломки в блоке «Сломать».',
    'The diagram builds itself step by step: now it shows only the laptop and the home router. Press “Start from the first step”, then go on with “Step forward” above the diagram. Each next network appears when the request reaches it, and the callout at the highlighted participant says what it does.\n\nAfter the first pass switch the exchange point off, turn on the site copy in a CDN, move the distance to the data centre and try both breaks in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: b('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: b('что он делает', 'what it does') },
    { mark: 'token', text: b('что передаётся дальше: запрос, адреса сети, файл', 'what is handed on: a request, a block of addresses, a file') },
    { mark: 'icon:terminal', text: b('ноутбук', 'laptop') },
    { mark: 'icon:router', text: b('роутер или сеть оператора', 'a router or an operator’s network') },
    { mark: 'icon:switch', text: b('точка обмена трафиком', 'exchange point') },
    { mark: 'icon:server', text: b('дата-центр с сервером сайта', 'the data centre with the site’s server') },
    { mark: 'icon:cloud', text: b('копия сайта в CDN', 'site copy in a CDN') },
    { mark: 'icon:dns', text: b('корневой сервер DNS', 'root DNS server') },
    { mark: 'ok', text: b('путь пройден', 'the path is done') },
    { mark: 'err', text: b('здесь пакеты пропадают', 'packets vanish here') },
  ],
  stopLabel: b('Пакеты не дошли до сайта', 'The packets did not reach the site'),
  diagram: {
    width: 960,
    height: 456,
    nodes: [
      node('laptop', b('Ноутбук', 'Laptop'), 'user', [24, 196, 128, 56], card(['Ваш компьютер. Адрес 192.168.1.23 в домашней сети ему выдал роутер.', 'Your computer. The router gave it the address 192.168.1.23 in the home network.'], ['Ноутбуком пользуетесь вы сами.', 'You.'], 'ip a'), { sub: '192.168.1.23', icon: 'terminal' }),
      node('router', b('Домашний роутер', 'Home router'), 'l3', [184, 196, 144, 56], card(['В одной коробке собраны три устройства: коммутатор, роутер и точка доступа Wi-Fi. Внутри квартиры у роутера адрес 192.168.1.1, а снаружи адрес, который выдал провайдер. Зачем роутеру два адреса, вы узнаете в уроке про NAT.', 'Three devices in one box: a switch, a router and a Wi-Fi access point. Inside it is 192.168.1.1; outside it has the address the provider gave it. Why there are two addresses is the NAT lesson.'], ['Роутер ставит провайдер, или вы покупаете его сами.', 'The provider, or you, having bought it in a shop.'], 'ip r'), { sub: '203.0.113.7', icon: 'router' }),
      node('isp', b('Провайдер', 'Provider (ISP)'), 'l3', [360, 196, 144, 56], card(['Сеть провайдера называется автономной системой. Ею управляет одна компания, у неё свой номер (ASN, здесь 64500) и свои блоки адресов.', 'The provider’s network is an autonomous system: a network under one administration with its own number (ASN) and its own address blocks.'], ['Сетью управляет компания-провайдер, а номер автономной системы выдаёт региональный регистратор, в Европе это RIPE NCC.', 'The provider company; the AS number comes from a regional registry (RIPE NCC in Europe).'], 'traceroute -n shop.example', DOC.cfBgp), { sub: 'AS 64500', icon: 'router' }),
      node('ixp', b('Точка обмена трафиком', 'Exchange point (IXP)'), 'l2', [536, 88, 152, 56], card(['Точка обмена трафиком (IXP) устроена как большой коммутатор, к которому подключены десятки сетей. Подключённые сети передают друг другу трафик напрямую и не платят посреднику; такой обмен называют пирингом. Примеры точек обмена: MSK-IX в Москве, DE-CIX во Франкфурте.', 'A large switch that dozens of networks connect to. Neighbours exchange traffic directly (peering) without paying a middleman. Examples: MSK-IX, DE-CIX.'], ['Точку обмена держит независимая организация, а участники платят ей за подключение.', 'An independent organisation; members pay for a port.'], undefined, DOC.cfIxp), { icon: 'switch' }),
      node('transit', b('Транзитный оператор', 'Transit carrier'), 'l3', [536, 308, 152, 56], card(['Крупная сеть, которая за деньги передаёт трафик туда, куда у вашего провайдера нет собственного пути.', 'A large network that carries traffic for money to places your provider has no direct path to.'], ['Сетью управляет магистральный оператор связи.', 'A backbone carrier.']), { sub: 'AS 64502', icon: 'router' }),
      node('cable', b('Подводный кабель', 'Submarine cable'), 'l1', [720, 196, 112, 56], card(['Оптоволоконный кабель, проложенный по дну моря. Свет в стекле проходит около 200 000 километров в секунду, то есть тратит примерно 5 микросекунд на каждый километр, и быстрее сигнал передать нельзя.', 'Optical fibre on the sea floor. Light in glass travels about 200,000 km/s — roughly 5 µs per kilometre. Nothing is faster.'], ['Кабели прокладывают консорциумы операторов связи и облачных компаний.', 'A consortium of carriers and cloud companies.'], undefined, DOC.cableMap), { sub: '2 000 km' }),
      node('dc', b('Дата-центр', 'Data centre'), 'node', [856, 188, 96, 72], card(['Здание со стойками серверов, в котором работает сайт магазина. Внутри стоят свой роутер на границе сети, коммутаторы и серверы. Эту часть пути вы разберёте подробно в следующих уроках.', 'A building with racks of servers. The site lives here: an edge router, switches, servers. We build this part later in the course.'], ['Дата-центр принадлежит хостинг-провайдеру или облаку.', 'A hosting provider or a cloud.']), { shape: 'rack', sub: 'AS 64501', icon: 'server' }),
      node('cdn', b('Копия сайта (CDN)', 'Site copy (CDN)'), 'l7', [184, 40, 144, 48], card(['Сервер сети доставки контента (CDN) в вашем городе. Он хранит копии картинок и страниц сайта, чтобы их не приходилось каждый раз передавать через океан.', 'A content delivery network server in your city. It keeps copies of images and pages so they do not cross the ocean.'], ['Сервер держит компания CDN по договору с владельцем сайта.', 'A CDN company under contract with the site owner.'], undefined, DOC.cfCdn), { icon: 'cloud' }),
      node('root', b('Корневой сервер DNS', 'Root DNS'), 'l7', [184, 380, 160, 48], card(['Вершина системы имён интернета. У корневых серверов 13 имён, от a.root-servers.net до m.root-servers.net, но за ними стоят более полутора тысяч серверов по всему миру. Серверы одного имени объявляют один и тот же адрес (это называется anycast), и BGP приводит вас к ближайшему из них.', 'The top of the naming system. 13 names a…m.root-servers.net and behind them more than fifteen hundred servers worldwide sharing the same addresses (anycast): BGP brings you to the nearest one.'], ['Корневые серверы держат 12 организаций-операторов, а работу координирует IANA.', '12 operator organisations, coordinated by IANA.'], 'dig . NS', DOC.rootServers), { sub: 'a.root-servers.net', icon: 'dns' }),
    ],
    edges: [
      edge('e-wifi', 'laptop', 'router', 'Wi-Fi', card(['Радиоканал между ноутбуком и точкой доступа в роутере. Вся квартира образует одну локальную сеть 192.168.1.0/24.', 'A radio link between the laptop and the access point in the router. The whole flat is one local network, 192.168.1.0/24.'], ['Радиоканал создаёт точка доступа в роутере.', 'The access point in the router.'])),
      edge('e-fiber', 'router', 'isp', b('оптика 1 Гбит/с', 'fibre 1 Gbit/s'), card(['Кабель от дома до узла провайдера. На этом кабеле кончается ваша сеть и начинается сеть провайдера.', 'The cable from the building to the provider’s node. Your network ends here and someone else’s begins.'], ['Кабель прокладывает провайдер.', 'The provider.'])),
      edge('e-peer', 'isp', 'ixp', b('пиринг', 'peering'), card(['Прямой обмен трафиком между соседними сетями через точку обмена. По протоколу BGP каждая сеть сообщает соседям, какие адреса находятся у неё.', 'Direct traffic exchange between neighbouring networks through an IXP. Over BGP each network tells its neighbours which addresses are in it.'], ['О пиринге договариваются инженеры двух сетей.', 'Engineers of two networks, by mutual agreement.'], undefined, DOC.rfc4271), { via: [[432, 116]], labelAt: 0.42 }),
      edge('e-transit', 'isp', 'transit', b('транзит за плату', 'paid transit'), card(['Если прямого соседства нет, провайдер платит транзитному оператору, и трафик идёт длинным путём.', 'Without a direct neighbour the provider pays a transit carrier, and traffic takes the long way.'], ['Транзит покупают по договору провайдера с оператором.', 'A contract between the provider and the carrier.']), { via: [[432, 336]], labelAt: 0.42 }),
      edge('e-ixp-cable', 'ixp', 'cable', b('анонс BGP', 'BGP announcement'), card(['Объявление BGP от сети сайта: «адреса 198.51.100.0/24 доступны через меня». Соседние сети поверили этому объявлению и отправляют пакеты к сайту этой дорогой.', 'A BGP announcement: “network 198.51.100.0/24 is reachable through me”. Neighbours believed it and send packets this way.'], ['Объявления рассылают роутеры на границах сетей.', 'Routers at the edges of networks (BGP).'], undefined, DOC.rfc4271), { via: [[776, 116]], labelAt: 0.4 }),
      edge('e-tr-cable', 'transit', 'cable', b('через AS 64502', 'via AS 64502'), card(['Путь через транзитного оператора. На нём на одну автономную систему больше, а сам путь длиннее на несколько тысяч километров.', 'The path through the transit carrier: one more autonomous system and a few thousand kilometres longer.'], ['Этот путь выбирает BGP, когда короткого пути нет.', 'BGP chooses this path when there is no shorter one.']), { via: [[776, 336]], labelAt: 0.4 }),
      edge('e-cable', 'cable', 'dc', b('5 мкс на км', '5 µs per km'), card(['Задержка в кабеле равна его длине в километрах, умноженной на 5 микросекунд. От Москвы до Франкфурта около 2 000 километров, это 10 миллисекунд в одну сторону, а от Москвы до Нью-Йорка около 7 500 километров, это 37 миллисекунд.', 'Propagation delay: distance × 5 µs. Moscow to Frankfurt is about 2,000 km, 10 ms one way; Moscow to New York about 7,500 km, 37 ms.'], ['Эту задержку задаёт физика, и никто не может её уменьшить.', 'Physics.'])),
      edge('e-cdn', 'isp', 'cdn', b('копия рядом', 'copy nearby'), card(['Узел CDN стоит в сети провайдера или на ближайшей точке обмена, поэтому путь до него занимает пару миллисекунд.', 'The CDN node sits in the provider’s network or at the nearest exchange point: a couple of milliseconds away.'], ['Узел ставит компания CDN.', 'The CDN.']), { via: [[384, 64]], labelAt: 0.35 }),
      edge('e-root', 'isp', 'root', 'anycast', card(['Один и тот же адрес объявлен из многих мест сразу, и BGP ведёт пакеты к ближайшему экземпляру сервера. Поэтому корень DNS быстро отвечает в любой стране.', 'One address is announced from many places at once; BGP leads to the nearest instance. That is how the DNS root answers fast in any country.'], ['Адреса объявляют операторы корневых серверов.', 'The root server operators.'], 'dig @198.41.0.4 . NS', DOC.rootServers), { via: [[384, 404]], labelAt: 0.35 }),
    ],
  },
  params: [
    {
      id: 'ixp',
      group: b('Как сети связаны между собой', 'How the networks are connected'),
      label: b('Провайдер и сеть сайта подключены к одной точке обмена трафиком', 'The provider and the site’s network share an exchange point'),
      kind: 'toggle',
      default: true,
      near: 'ixp',
      predict: {
        prompt: b('Провайдер отключился от точки обмена трафиком, а всё остальное на пути осталось прежним. Как изменится время пути до сайта и обратно?', 'The provider left the exchange point; everything else stayed the same. How does the round trip to the site change?'),
        options: [
          { id: 'up', text: b('Время вырастет, потому что трафик пойдёт в обход через транзитного оператора', 'It grows: traffic goes around through a transit carrier') },
          { id: 'down', text: b('Время уменьшится, потому что на пути станет на одно устройство меньше', 'It falls: one device fewer on the way') },
          { id: 'same', text: b('Время не изменится, потому что сайт остался в том же дата-центре', 'It stays the same: the site is in the same data centre') },
        ],
        resolve: (prev, next) => {
          const a = lastMetric(prev, 'rtt') ?? 0;
          const c = lastMetric(next, 'rtt') ?? 0;
          return c > a ? 'up' : c < a ? 'down' : 'same';
        },
      },
    },
    { id: 'distance', group: b('Как сети связаны между собой', 'How the networks are connected'), label: b('Расстояние от провайдера до дата-центра', 'Distance to the data centre'), kind: 'range', min: 200, max: 15000, step: 100, unit: 'km', default: 2000, near: 'cable' },
    {
      id: 'cdn',
      group: b('Что сделал владелец сайта', 'What the site owner did'),
      label: b('Копии картинок и стилей сайта лежат в CDN в вашем городе', 'Copies of the site’s images and styles are in a CDN in your city'),
      kind: 'toggle',
      default: false,
      near: 'cdn',
      predict: {
        prompt: b('Владелец сайта положил копии картинок в CDN, у которого есть узел в вашем городе. Как изменится время загрузки картинок?', 'The site owner put copies of the images into a CDN with a node in your city. How does the image load time change?'),
        options: [
          { id: 'faster', text: b('Картинки будут загружаться быстрее, потому что придут из вашего города', 'Faster: images come from your own city') },
          { id: 'same', text: b('Время не изменится, потому что сайт остался тем же', 'The same: it is the same site') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'cdn') ?? 0) > 0 ? 'faster' : 'same'),
      },
    },
    { id: 'cgnat', group: b('Как сети связаны между собой', 'How the networks are connected'), label: b('Провайдер выдал роутеру общий адрес (CGNAT)', 'The provider gave the router a shared address (CGNAT)'), kind: 'toggle', default: false, near: 'router', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'cable',
      label: b('Якорь судна перебил подводный кабель', 'A ship’s anchor cut the submarine cable'),
      remove: ['cable', 'e-cable'],
      layer: 'L1',
      predict: {
        prompt: b('Якорь судна перебил подводный кабель, по которому шёл трафик к сайту. Что увидят пользователи в первые секунды?', 'A ship’s anchor cut the cable. What do users see in the first seconds?'),
        options: [
          { id: 'lost', text: b('Пакеты будут пропадать, пока соседние сети не найдут другой путь', 'Packets are lost until neighbouring networks recompute routes') },
          { id: 'nothing', text: b('Пользователи ничего не заметят, потому что трафик мгновенно пойдёт по другому кабелю', 'Nothing: traffic instantly takes another cable') },
          { id: 'forever', text: b('Сайт будет недоступен до тех пор, пока кабель не починят', 'The site is gone until the cable is repaired') },
        ],
        resolve: (_p, next) => (brokenAt(next) ? 'lost' : 'nothing'),
      },
    },
    {
      id: 'leak',
      label: b('Транзитный оператор по ошибке объявил адреса сайта своими', 'The transit carrier wrongly announces the site’s addresses as its own'),
      remove: ['e-tr-cable'],
      layer: 'L3',
      predict: {
        prompt: b('Транзитный оператор по ошибке объявил всем соседям, что адреса 198.51.100.0/24 находятся у него, хотя сайт стоит в другом дата-центре. Что будет с пакетами к сайту?', 'The transit carrier mistakenly told everyone “198.51.100.0/24 is mine”. What happens to packets for the site?'),
        options: [
          { id: 'wrong', text: b('Пакеты уйдут к этому оператору и пропадут у него', 'They go to it and vanish there') },
          { id: 'ok', text: b('Ничего не случится, потому что сайт стоит в другом дата-центре', 'Nothing: the site is in a different data centre') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'transit' ? 'wrong' : 'ok'),
      },
    },
  ],
  metrics: [
    { id: 'rtt', label: b('время до сайта и обратно', 'round trip to the site'), unit: 'ms' },
    { id: 'cdn', label: b('время до копии в CDN и обратно', 'round trip to the CDN copy'), unit: 'ms' },
    { id: 'ases', label: b('автономных систем на пути', 'autonomous systems on the way') },
  ],
  run(p, broken): Step[] {
    const L = mapLatency(p);
    const leak = broken.has('leak');
    const cut = broken.has('cable');
    const ases = p.ixp && !leak ? 2 : 3;
    const steps: Step[] = [];
    const routerAddr = p.cgnat ? '100.64.12.7' : '203.0.113.7';
    steps.push({
      id: 'home',
      label: b('квартира', 'home'),
      caption: b('Ноутбук и роутер стоят в одной квартире. Всё, что ноутбук отправляет в интернет, сначала уходит по Wi-Fi к роутеру.', 'The laptop and the router are in one room. Everything the laptop sends to the internet first goes over Wi-Fi to the router.'),
      focus: ['laptop', 'e-wifi'],
      tokens: [{ edge: 'e-wifi', label: b('запрос', 'request') }],
      say: { laptop: b('Ноутбук отправляет роутеру запрос к сайту магазина.', 'The laptop sends the router a request for the shop’s site.') },
      states: { ...HIDDEN, laptop: 'on', router: 'on' },
      values: { router: routerAddr },
    });
    steps.push({
      id: 'city',
      label: b('город', 'city'),
      caption: p.cgnat
        ? b('Роутер передаёт пакет провайдеру. Но внешний адрес роутера 100.64.12.7 принадлежит диапазону, который провайдер делит между многими клиентами (CGNAT). Значит, ваш роутер сам стоит за чужим роутером, который подменяет адреса многих клиентов (такая подмена называется NAT, и ей посвящён отдельный урок), и подключиться к вам снаружи нельзя, как бы вы ни настроили свой роутер.', 'The router hands the packet to the provider. But its outside address 100.64.12.7 is the provider’s shared range (CGNAT): your router itself sits behind someone else’s router that rewrites the addresses of many customers (this rewriting is called NAT and has a lesson of its own), and nobody outside can connect to you, however you set up your own router.')
        : b('Роутер передаёт пакет провайдеру. Сеть провайдера называется автономной системой AS 64500: ею управляет одна компания, у неё свой номер и свои адреса.', 'The router hands the packet to the provider. The provider’s network is autonomous system AS 64500: one administration, its own number, its own addresses.'),
      focus: ['router', 'e-fiber'],
      tokens: [{ edge: 'e-fiber', label: b('запрос', 'request') }],
      say: { router: b('Роутер отправляет пакет по оптическому кабелю в сеть провайдера.', 'The router sends the packet along the fibre into the provider’s network.') },
      states: { isp: 'on', 'e-fiber': 'on' },
      metrics: { rtt: (L.wifi + L.access) * 2, ases: 1 },
    });
    if (p.ixp && !leak) {
      steps.push({
        id: 'country',
        label: b('страна', 'country'),
        caption: b('Сайт находится в другой сети, AS 64501. Обе сети подключены к точке обмена трафиком и передают пакеты друг другу напрямую. Какие адреса находятся в какой сети, они заранее сообщили друг другу по протоколу BGP.', 'The site is in another network, AS 64501. Both networks are connected to an exchange point and swap packets directly. They agreed over BGP which addresses belong to whom.'),
        focus: ['isp', 'e-peer', 'ixp'],
        tokens: [{ edge: 'e-peer', label: b('запрос', 'request') }, { edge: 'e-ixp-cable', label: '198.51.100.0/24' }],
        say: { isp: b('Провайдер знает из анонса BGP, что адреса сайта доступны через точку обмена, и отправляет пакет туда.', 'The provider knows from a BGP announcement that the site is reachable via the exchange point and sends the packet there.') },
        states: { ixp: 'on', 'e-peer': 'on', 'e-ixp-cable': 'on' },
        metrics: { rtt: Math.round((L.wifi + L.access + L.middle) * 20) / 10, ases },
      });
    } else {
      steps.push({
        id: 'country',
        label: b('страна', 'country'),
        caption: leak
          ? b('Транзитный оператор объявил по BGP, что сеть сайта находится у него. Соседние сети поверили этому объявлению, и пакеты к сайту уходят к оператору, у которого сайта нет.', 'The transit carrier announced over BGP that the site’s network is his. The neighbours believed it: packets for the site go to him.')
          : b('Без точки обмена прямого пути к сети сайта нет. Провайдер отдаёт пакет транзитному оператору AS 64502, и тот за деньги передаёт пакет дальше длинной дорогой.', 'Without an exchange point there is no direct path: the provider hands the packet to transit carrier AS 64502, who carries it on — for money and the long way round.'),
        focus: ['isp', 'e-transit', 'transit'],
        tokens: [{ edge: 'e-transit', label: b('запрос', 'request') }],
        say: leak
          ? { transit: b('Транзитный оператор принимает пакеты к адресам сайта, но передать их ему некуда.', 'The transit carrier takes the packets for the site but has nowhere to send them.') }
          : { isp: b('Провайдер не видит прямого пути к сети сайта и отдаёт пакет транзитному оператору.', 'The provider sees no direct path to the site’s network and hands the packet to the transit carrier.') },
        states: { transit: leak ? 'err' : 'on', 'e-transit': 'on', 'e-tr-cable': leak ? 'hidden' : 'on' },
        metrics: { rtt: Math.round((L.wifi + L.access + L.middle) * 20) / 10, ases },
        ...(leak
          ? {
              broken: {
                at: 'transit',
                message: '$ traceroute -n shop.example\n 1  192.168.1.1  1.9 ms\n 2  203.0.113.1  9.8 ms\n 3  198.18.7.1  37.4 ms\n 4  * * *\n 5  * * *',
                caption: b('Такую ошибку называют перехватом маршрута: соседние сети поверили ошибочному объявлению, и пакеты ушли туда, где сайта нет. Команда traceroute, которая печатает устройства на пути пакета, в таком случае доходит до третьего узла, а дальше выводит одни звёздочки. Так в 2008 году ошибка одного оператора на два часа сделала YouTube недоступным для большей части интернета.', 'This mistake is called a route hijack: the neighbours believed a wrong announcement and packets went where the site is not. The traceroute command, which prints the devices on a packet’s path, then reaches the third hop and prints only asterisks after it. This is how in 2008 one operator’s mistake made YouTube unreachable for most of the internet for two hours.'),
              },
            }
          : {}),
      });
      if (leak) return steps;
    }
    if (cut) {
      steps.push({
        id: 'world',
        label: b('мир', 'world'),
        caption: b('Подводный кабель перебит. Пока роутеры соседних сетей не узнают об этом по BGP и не выберут другой кабель, пакеты в эту сторону пропадают.', 'The cable is cut. Until the routers of neighbouring networks learn about it over BGP and choose another cable, packets in this direction are lost.'),
        focus: ['cable', 'e-cable'],
        say: { cable: b('Кабель перебит, и пакеты, отправленные в него, никуда не доходят.', 'The cable is cut, and packets sent into it go nowhere.') },
        states: { cable: 'err' },
        metrics: { rtt: 0, ases },
        broken: {
          at: 'cable',
          message: '$ ping -c 3 shop.example\nPING shop.example (198.51.100.20) 56(84) bytes of data.\nFrom 198.18.0.2 icmp_seq=1 Destination Net Unreachable\n\n--- shop.example ping statistics ---\n3 packets transmitted, 0 received, +1 errors, 100% packet loss',
          caption: b('Через несколько секунд или минут BGP проложит путь через другой кабель. Связь вернётся, но задержка станет больше, потому что новый путь длиннее.', 'within seconds to minutes BGP reroutes through another cable: the connection comes back, with more delay.'),
        },
      });
      return steps;
    }
    steps.push({
      id: 'world',
      label: b('мир', 'world'),
      caption: fmt(b('Дальше пакет идёт по подводному кабелю длиной {d} км. Свет в стекле тратит 5 микросекунд на каждый километр, значит, этот участок занимает {ms} мс в одну сторону, и быстрее пройти его нельзя.', 'Next comes a submarine cable: {d} km. Light in glass covers a kilometre in 5 µs, so {ms} ms one way, and it will never be faster.'), {
        d: p.distance.toLocaleString('ru-RU'),
        ms: Math.round(L.cable * 10) / 10,
      }),
      focus: ['e-cable', 'cable'],
      tokens: [{ edge: 'e-cable', label: b('запрос', 'request') }],
      say: { cable: fmt(b('Свет проходит по кабелю {d} км, и на это уходит {ms} мс.', 'Light crosses {d} km of cable in {ms} ms.'), { d: p.distance.toLocaleString('ru-RU'), ms: Math.round(L.cable * 10) / 10 }) },
      states: { cable: 'on', 'e-cable': 'on' },
      values: { cable: `${p.distance.toLocaleString('en-US')} km` },
      metrics: { rtt: L.rtt - L.dc * 2, ases },
    });
    steps.push({
      id: 'dc',
      label: b('здание', 'building'),
      caption: b('Пакет пришёл в дата-центр, где роутеры и коммутаторы доставляют его серверу сайта. Ответ пойдёт обратно тем же путём, поэтому задержку считают туда и обратно и называют RTT.', 'The packet is in the data centre: routers and switches deliver it to the site’s server. The answer travels back the same way — that is why delay is counted as a round trip (RTT).'),
      focus: ['dc'],
      say: { dc: b('Сервер сайта получает запрос и отправляет ответ обратно тем же путём.', 'The site’s server gets the request and sends the answer back the same way.') },
      states: { dc: 'on' },
      metrics: { rtt: L.rtt, ases },
    });
    steps.push({
      id: 'cdn',
      label: 'CDN',
      caption: p.cdn
        ? fmt(b('Копии картинок и стилей сайта лежат на узле CDN в вашем городе, поэтому путь до них и обратно занимает {c} мс вместо {o} мс до дата-центра. Свет быстрее не пойдёт, поэтому выигрыш получают за счёт расстояния: копия лежит ближе к вам.', 'The site’s images and styles have a copy on a CDN node in your city: {c} ms round trip instead of {o} ms to the data centre. Light will not go faster, so the gain comes from distance: the copy is closer to you.'), { c: L.cdnRtt, o: L.rtt })
        : b('Копий сайта поблизости нет, поэтому каждая картинка приходит из дата-центра через подводный кабель. Включите копию сайта в CDN и посмотрите, как изменятся счётчики.', 'There are no copies nearby: every image travels from the data centre through the cable. Turn the CDN on and watch the counters.'),
      focus: p.cdn ? ['cdn', 'e-cdn'] : ['dc', 'e-cable'],
      tokens: p.cdn ? [{ edge: 'e-cdn', label: 'app.css' }] : [{ edge: 'e-cable', label: 'app.css', reverse: true }],
      say: p.cdn ? { cdn: b('Узел CDN в вашем городе отдаёт копию файла стилей app.css.', 'The CDN node in your city serves its copy of app.css.') } : { dc: b('Сервер в дата-центре отправляет файл стилей app.css через океан.', 'The server in the data centre sends app.css across the ocean.') },
      states: p.cdn ? { cdn: 'on', 'e-cdn': 'on' } : {},
      metrics: { rtt: L.rtt, cdn: p.cdn ? L.cdnRtt : 0, ases },
    });
    steps.push({
      id: 'root',
      label: b('корень DNS', 'DNS root'),
      caption: b('Недалеко от провайдера работает экземпляр корневого сервера DNS. Таких экземпляров больше полутора тысяч, у всех один адрес (anycast), и BGP приводит вас к ближайшему. Зачем нужен корневой сервер, вы узнаете в уроке про систему имён.', 'Somewhere near the provider an instance of a root DNS server answers. There are more than fifteen hundred such instances with one address (anycast), and BGP brings you to the nearest one. Why the root is needed is the DNS lesson.'),
      focus: ['root', 'e-root'],
      tokens: [{ edge: 'e-root', label: '. NS?' }],
      say: { root: b('Ближайший экземпляр корневого сервера DNS отвечает на вопрос провайдера.', 'The nearest root DNS instance answers the provider’s question.') },
      states: { root: 'on', 'e-root': 'on' },
      metrics: { rtt: L.rtt, cdn: p.cdn ? L.cdnRtt : 0, ases },
    });
    steps.push({
      id: 'whole',
      label: b('весь путь', 'the path'),
      caption: p.ixp
        ? b('Весь путь пройден: ваша сеть, сеть провайдера, точка обмена трафиком, подводный кабель и дата-центр. У каждого участка свой хозяин. В следующих уроках вы разберёте, что передаётся по этим линиям.', 'The whole path: your network → the provider’s network → the IXP → the cable → the data centre. Each part has its own owner. Next we go inside: what exactly travels along this line.')
        : b('Весь путь пройден: ваша сеть, сеть провайдера, транзитный оператор, подводный кабель и дата-центр. У каждого участка свой хозяин. В следующих уроках вы разберёте, что передаётся по этим линиям.', 'The whole path: your network → the provider’s network → transit → the cable → the data centre. Each part has its own owner. Next we go inside: what exactly travels along this line.'),
      focus: ['e-wifi', 'e-fiber', p.ixp ? 'e-peer' : 'e-transit', p.ixp ? 'e-ixp-cable' : 'e-tr-cable', 'e-cable'],
      states: { laptop: 'ok', dc: 'ok' },
      metrics: { rtt: L.rtt, cdn: p.cdn ? L.cdnRtt : 0, ases },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, bb) {
    if (change.kind === 'break') {
      if (!change.on) return b('Поломку убрали, и путь снова доходит до дата-центра.', 'The break is removed: the path reaches the data centre again.');
      return change.id === 'cable'
        ? b('Кабель перебит, и пакеты пропадают, пока BGP не найдёт другой путь.', 'The cable is cut: packets are lost until BGP finds another path.')
        : b('Ошибочное объявление увело трафик к транзитному оператору, у которого сайта нет, и пакеты пропадают после третьего узла в выводе traceroute.', 'A wrong announcement pulled traffic to the transit carrier, which does not have the site: packets vanish at the third traceroute hop.');
    }
    const r0 = lastMetric(prev, 'rtt') ?? 0;
    const r1 = lastMetric(next, 'rtt') ?? 0;
    switch (change.id) {
      case 'ixp':
        return bb.ixp
          ? fmt(b('Соседние сети снова обмениваются трафиком напрямую, и время пути туда и обратно изменилось с {a} до {b} мс.', 'Peering is back: RTT {a} → {b} ms. The neighbouring networks exchange traffic directly again.'), { a: r0, b: r1 })
          : fmt(b('Без точки обмена трафик пошёл через транзитного оператора. Время пути туда и обратно изменилось с {a} до {b} мс, а на пути появилась ещё одна автономная система.', 'Without the IXP traffic goes through a transit carrier: RTT {a} → {b} ms and one extra autonomous system.'), { a: r0, b: r1 });
      case 'cdn':
        return bb.cdn
          ? fmt(b('Картинки и стили теперь приходят из вашего города за {c} мс, а путь до дата-центра по-прежнему занимает {o} мс.', 'CDN on: static files arrive in {c} ms from your city; the data centre is still {o} ms away.'), { c: mapLatency(bb).cdnRtt, o: r1 })
          : b('Копий в CDN больше нет, и каждый файл снова приходит из дата-центра.', 'CDN off: every file travels from the data centre again.');
      case 'distance':
        return fmt(b('Расстояние изменилось с {a} до {b} км. Один только кабель теперь добавляет {ms} мс в одну сторону, а время пути туда и обратно изменилось с {r0} до {r1} мс.', '{a} → {b} km: the cable alone adds {ms} ms one way. RTT {r0} → {r1} ms.'), {
          a: a.distance as number,
          b: bb.distance as number,
          ms: Math.round((bb.distance as number) * 0.05) / 10,
          r0,
          r1,
        });
      case 'cgnat':
        return bb.cgnat
          ? b('Провайдер выдал роутеру адрес из общего диапазона 100.64.0.0/10, и подключиться к вам снаружи больше нельзя.', 'The provider gave the router an address from 100.64.0.0/10: nobody outside can reach you any more.')
          : b('У роутера снова собственный публичный адрес.', 'The router has its own public address again.');
    }
    return b('Параметр изменился, и путь пересчитан заново.', 'The parameter changed; the path was recomputed.');
  },
});
