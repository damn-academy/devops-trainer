// E-MAP (03 §7.1): how the internet is built — from the laptop to the data
// centre, in levels of zoom. Each step is one level and one idea: home,
// city (provider, autonomous system), country (exchange point or paid
// transit), world (a cable and the speed of light), the building, the copy
// nearby (CDN) and the root of DNS.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { Step } from '../../../core/types';
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

export const mapModel = defineModel<P>({
  id: 'net.map',
  block: 'networks',
  title: b('Как устроен интернет: от ноутбука до ЦОДа', 'How the internet is built: from a laptop to a data centre'),
  summary: b(
    'Карта в уровнях приближения. Каждый шаг — один уровень и одна идея. Переключайте IXP, CDN и CGNAT, двигайте расстояние, режьте кабель.',
    'A map in levels of zoom. Each step is one level and one idea. Toggle the IXP, the CDN and CGNAT, move the distance, cut the cable.',
  ),
  diagram: {
    width: 960,
    height: 456,
    nodes: [
      node('laptop', b('Ноутбук', 'Laptop'), 'user', [24, 196, 120, 56], card(['Ваш компьютер. У него адрес в домашней сети — его выдал роутер.', 'Your computer. It has an address in the home network, given to it by the router.'], ['Вы.', 'You.'], 'ip a'), { sub: '192.168.1.23' }),
      node('router', b('Домашний роутер', 'Home router'), 'l3', [184, 196, 136, 56], card(['В одной коробке три устройства: коммутатор, роутер и точка доступа Wi-Fi. Внутрь смотрит адрес 192.168.1.1, наружу — адрес, выданный провайдером. Почему адресов два — разберём в уроке про NAT.', 'Three devices in one box: a switch, a router and a Wi-Fi access point. Inside it is 192.168.1.1; outside it has the address the provider gave it. Why there are two addresses is the NAT lesson.'], ['Провайдер или вы сами, купив его в магазине.', 'The provider, or you, having bought it in a shop.'], 'ip r'), { sub: '203.0.113.7' }),
      node('isp', b('Провайдер', 'Provider (ISP)'), 'l3', [360, 196, 136, 56], card(['Сеть провайдера — автономная система: сеть под одним управлением, со своим номером (ASN) и своими блоками адресов.', 'The provider’s network is an autonomous system: a network under one administration with its own number (ASN) and its own address blocks.'], ['Компания-провайдер; номер AS выдаёт региональный регистратор (RIPE NCC в Европе).', 'The provider company; the AS number comes from a regional registry (RIPE NCC in Europe).'], 'traceroute -n shop.example', DOC.cfBgp), { sub: 'AS 64500' }),
      node('ixp', b('Точка обмена (IXP)', 'Exchange point (IXP)'), 'l2', [536, 88, 136, 56], card(['Большой коммутатор, к которому подключены десятки сетей. Соседи обмениваются трафиком напрямую (пиринг), не платя посреднику. Примеры: MSK-IX, DE-CIX.', 'A large switch that dozens of networks connect to. Neighbours exchange traffic directly (peering) without paying a middleman. Examples: MSK-IX, DE-CIX.'], ['Независимая организация; участники платят за порт.', 'An independent organisation; members pay for a port.'], undefined, DOC.cfIxp), { sub: 'peering' }),
      node('transit', b('Транзитный оператор', 'Transit carrier'), 'l3', [536, 308, 136, 56], card(['Крупная сеть, которая за деньги везёт трафик туда, куда у вашего провайдера нет прямого пути.', 'A large network that carries traffic for money to places your provider has no direct path to.'], ['Магистральный оператор.', 'A backbone carrier.']), { sub: 'AS 64502' }),
      node('cable', b('Подводный кабель', 'Submarine cable'), 'l1', [704, 196, 112, 56], card(['Оптоволокно по дну моря. Свет в стекле идёт около 200 000 км/с — примерно 5 мкс на километр. Быстрее не бывает.', 'Optical fibre on the sea floor. Light in glass travels about 200,000 km/s — roughly 5 µs per kilometre. Nothing is faster.'], ['Консорциум операторов и облачных компаний.', 'A consortium of carriers and cloud companies.'], undefined, DOC.cableMap), { sub: '2 000 km' }),
      node('dc', b('ЦОД', 'Data centre'), 'node', [848, 188, 96, 72], card(['Здание со стойками серверов. Здесь живёт сайт: граничный роутер, коммутаторы, балансировщик, серверы. Эту часть мы будем строить дальше в курсе.', 'A building with racks of servers. The site lives here: an edge router, switches, a load balancer, servers. We build this part later in the course.'], ['Хостинг-провайдер или облако.', 'A hosting provider or a cloud.']), { shape: 'rack', sub: 'AS 64501' }),
      node('cdn', b('Копия сайта (CDN)', 'Site copy (CDN)'), 'l7', [184, 40, 136, 48], card(['Сервер сети доставки контента в вашем городе. Хранит копии картинок и страниц, чтобы они не ехали через океан.', 'A content delivery network server in your city. It keeps copies of images and pages so they do not cross the ocean.'], ['Компания CDN по договору с владельцем сайта.', 'A CDN company under contract with the site owner.'], undefined, DOC.cfCdn), { sub: 'edge' }),
      node('root', b('Корневой DNS', 'Root DNS'), 'l7', [184, 380, 136, 48], card(['Вершина системы имён. 13 имён a…m.root-servers.net, за ними — более полутора тысяч серверов по всему миру с одинаковыми адресами (anycast): BGP приводит вас к ближайшему.', 'The top of the naming system. 13 names a…m.root-servers.net and behind them more than fifteen hundred servers worldwide sharing the same addresses (anycast): BGP brings you to the nearest one.'], ['12 организаций-операторов под координацией IANA.', '12 operator organisations, coordinated by IANA.'], 'dig . NS', DOC.rootServers), { sub: 'a.root-servers.net' }),
    ],
    edges: [
      edge('e-wifi', 'laptop', 'router', 'Wi-Fi', card(['Радиоканал между ноутбуком и точкой доступа в роутере. Вся квартира — одна локальная сеть 192.168.1.0/24.', 'A radio link between the laptop and the access point in the router. The whole flat is one local network, 192.168.1.0/24.'], ['Точка доступа в роутере.', 'The access point in the router.'])),
      edge('e-fiber', 'router', 'isp', b('оптика 1 Гбит/с', 'fibre 1 Gbit/s'), card(['Кабель от дома до узла провайдера. Здесь кончается ваша сеть и начинается чужая.', 'The cable from the building to the provider’s node. Your network ends here and someone else’s begins.'], ['Провайдер.', 'The provider.'])),
      edge('e-peer', 'isp', 'ixp', b('пиринг', 'peering'), card(['Прямой обмен трафиком между соседними сетями через IXP. По BGP каждая сеть сообщает соседям, какие адреса живут у неё.', 'Direct traffic exchange between neighbouring networks through an IXP. Over BGP each network tells its neighbours which addresses live in it.'], ['Инженеры двух сетей по взаимному соглашению.', 'Engineers of two networks, by mutual agreement.'], undefined, DOC.rfc4271), { via: [[428, 116]], labelAt: 0.42 }),
      edge('e-transit', 'isp', 'transit', b('транзит, платно', 'transit, paid'), card(['Если прямого соседства нет, провайдер платит транзитному оператору, и трафик идёт длинным путём.', 'Without a direct neighbour the provider pays a transit carrier, and traffic takes the long way.'], ['Договор провайдера с оператором.', 'A contract between the provider and the carrier.']), { via: [[428, 336]], labelAt: 0.42 }),
      edge('e-ixp-cable', 'ixp', 'cable', 'AS 64500 → AS 64501', card(['Анонс BGP: «сеть 198.51.100.0/24 — через меня». Соседи поверили и повезли пакеты сюда.', 'A BGP announcement: “network 198.51.100.0/24 is reachable through me”. Neighbours believed it and send packets this way.'], ['Маршрутизаторы на границе сетей (BGP).', 'Routers at the edges of networks (BGP).'], undefined, DOC.rfc4271), { via: [[760, 116]], labelAt: 0.4 }),
      edge('e-tr-cable', 'transit', 'cable', b('через AS 64502', 'via AS 64502'), card(['Путь через транзитного оператора: на одну автономную систему и несколько тысяч километров длиннее.', 'The path through the transit carrier: one more autonomous system and a few thousand kilometres longer.'], ['BGP выбирает этот путь, когда короткого нет.', 'BGP chooses this path when there is no shorter one.']), { via: [[760, 336]], labelAt: 0.4 }),
      edge('e-cable', 'cable', 'dc', b('≈ 5 мкс/км', '≈ 5 µs/km'), card(['Задержка распространения: расстояние × 5 мкс. Москва — Франкфурт около 2 000 км, это 10 мс в одну сторону; Москва — Нью-Йорк около 7 500 км, 37 мс.', 'Propagation delay: distance × 5 µs. Moscow to Frankfurt is about 2,000 km, 10 ms one way; Moscow to New York about 7,500 km, 37 ms.'], ['Физика.', 'Physics.'])),
      edge('e-cdn', 'isp', 'cdn', b('копия рядом', 'copy nearby'), card(['Узел CDN стоит в сети провайдера или на ближайшей точке обмена: до него пара миллисекунд.', 'The CDN node sits in the provider’s network or at the nearest exchange point: a couple of milliseconds away.'], ['CDN.', 'The CDN.']), { via: [[380, 64]], labelAt: 0.35 }),
      edge('e-root', 'isp', 'root', 'anycast', card(['Один адрес объявлен из многих мест сразу; BGP ведёт к ближайшему экземпляру. Так корень DNS отвечает быстро в любой стране.', 'One address is announced from many places at once; BGP leads to the nearest instance. That is how the DNS root answers fast in any country.'], ['Операторы корневых серверов.', 'The root server operators.'], 'dig @198.41.0.4 . NS', DOC.rootServers), { via: [[380, 404]], labelAt: 0.35 }),
    ],
  },
  params: [
    {
      id: 'ixp',
      label: b('Пиринг через IXP', 'Peering at an IXP'),
      kind: 'toggle',
      default: true,
      near: 'ixp',
      predict: {
        prompt: b('Точку обмена выключили. Задержка до сайта вырастет или упадёт?', 'The exchange point is switched off. Will the latency to the site grow or fall?'),
        options: [
          { id: 'up', text: b('Вырастет: трафик пойдёт в обход через транзит', 'Grow: traffic goes around through transit') },
          { id: 'down', text: b('Упадёт: меньше устройств на пути', 'Fall: fewer devices on the way') },
          { id: 'same', text: b('Не изменится', 'Stay the same') },
        ],
        resolve: (prev, next) => {
          const a = lastMetric(prev, 'rtt') ?? 0;
          const c = lastMetric(next, 'rtt') ?? 0;
          return c > a ? 'up' : c < a ? 'down' : 'same';
        },
      },
    },
    {
      id: 'cdn',
      label: b('Копия сайта в CDN', 'A site copy in a CDN'),
      kind: 'toggle',
      default: false,
      near: 'cdn',
      predict: {
        prompt: b('Владелец сайта включил CDN. Что станет со временем загрузки картинок?', 'The site owner turned on a CDN. What happens to the time it takes to load the images?'),
        options: [
          { id: 'faster', text: b('Быстрее: картинки едут из своего города', 'Faster: images come from your own city') },
          { id: 'same', text: b('Так же: сайт ведь тот же', 'The same: it is the same site') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'cdn') ?? 0) > 0 ? 'faster' : 'same'),
      },
    },
    { id: 'distance', label: b('Расстояние до ЦОДа', 'Distance to the data centre'), kind: 'range', min: 200, max: 15000, step: 100, unit: 'km', default: 2000, near: 'cable' },
    { id: 'cgnat', label: b('Провайдер с CGNAT', 'Provider uses CGNAT'), kind: 'toggle', default: false, near: 'router', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'cable',
      label: b('Перерезать кабель', 'Cut the cable'),
      remove: ['cable', 'e-cable'],
      layer: 'L1',
      predict: {
        prompt: b('Якорь судна перебил кабель. Что увидят пользователи в первые секунды?', 'A ship’s anchor cut the cable. What do users see in the first seconds?'),
        options: [
          { id: 'lost', text: b('Пакеты теряются, пока соседние сети не пересчитают маршруты', 'Packets are lost until neighbouring networks recompute routes') },
          { id: 'nothing', text: b('Ничего: трафик мгновенно пойдёт по другому кабелю', 'Nothing: traffic instantly takes another cable') },
          { id: 'forever', text: b('Сайт пропадёт навсегда', 'The site is gone for good') },
        ],
        resolve: (_p, next) => (brokenAt(next) ? 'lost' : 'nothing'),
      },
    },
    {
      id: 'leak',
      label: b('AS 64502 анонсирует чужой префикс', 'AS 64502 announces someone else’s prefix'),
      remove: ['e-tr-cable'],
      layer: 'L3',
      predict: {
        prompt: b('Транзитный оператор по ошибке объявил всем «198.51.100.0/24 — у меня». Что будет с пакетами к сайту?', 'The transit carrier mistakenly told everyone “198.51.100.0/24 is mine”. What happens to packets for the site?'),
        options: [
          { id: 'wrong', text: b('Уйдут к нему и пропадут там', 'They go to it and vanish there') },
          { id: 'ok', text: b('Ничего: сайт же в другом ЦОДе', 'Nothing: the site is in a different data centre') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'transit' ? 'wrong' : 'ok'),
      },
    },
  ],
  metrics: [
    { id: 'rtt', label: b('RTT до сайта', 'RTT to the site'), unit: 'ms' },
    { id: 'cdn', label: b('RTT до копии', 'RTT to the copy'), unit: 'ms' },
    { id: 'ases', label: b('автономных систем', 'autonomous systems') },
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
      caption: b('Ноутбук и роутер в одной комнате. Всё, что ноутбук отправляет в интернет, сначала по Wi-Fi уходит роутеру.', 'The laptop and the router are in one room. Everything the laptop sends to the internet first goes over Wi-Fi to the router.'),
      focus: ['laptop', 'router', 'e-wifi'],
      tokens: [{ edge: 'e-wifi', label: 'GET /' }],
      states: { laptop: 'on', router: 'on', isp: 'off', ixp: 'off', transit: 'off', cable: 'off', dc: 'off', cdn: 'off', root: 'off' },
      values: { router: routerAddr },
    });
    steps.push({
      id: 'city',
      label: b('город', 'city'),
      caption: p.cgnat
        ? b('Роутер передаёт пакет провайдеру. Но его внешний адрес 100.64.12.7 — общий адрес провайдера (CGNAT): ваш роутер сам стоит за чужим NAT, и снаружи к вам не подключиться даже с пробросом порта.', 'The router hands the packet to the provider. But its outside address 100.64.12.7 is the provider’s shared range (CGNAT): your router itself is behind someone else’s NAT, and nobody outside can connect to you, even with port forwarding.')
        : b('Роутер передаёт пакет провайдеру. Сеть провайдера — автономная система AS 64500: под одним управлением, со своим номером и своими адресами.', 'The router hands the packet to the provider. The provider’s network is autonomous system AS 64500: one administration, its own number, its own addresses.'),
      focus: ['router', 'isp', 'e-fiber'],
      tokens: [{ edge: 'e-fiber' }],
      states: { isp: 'on' },
      metrics: { rtt: (L.wifi + L.access) * 2, ases: 1 },
    });
    if (p.ixp && !leak) {
      steps.push({
        id: 'country',
        label: b('страна', 'country'),
        caption: b('Сайт живёт в чужой сети AS 64501. Обе сети подключены к точке обмена трафиком и обмениваются пакетами напрямую. О том, какие адреса у кого, они договорились по BGP.', 'The site lives in another network, AS 64501. Both networks are connected to an exchange point and swap packets directly. They agreed over BGP which addresses belong to whom.'),
        focus: ['isp', 'ixp', 'e-peer', 'e-ixp-cable'],
        tokens: [{ edge: 'e-peer' }, { edge: 'e-ixp-cable', label: '198.51.100.0/24' }],
        states: { ixp: 'on', 'e-transit': 'off', 'e-tr-cable': 'off' },
        metrics: { rtt: Math.round((L.wifi + L.access + L.middle) * 20) / 10, ases },
      });
    } else {
      steps.push({
        id: 'country',
        label: b('страна', 'country'),
        caption: leak
          ? b('Транзитный оператор объявил по BGP, что сеть сайта у него. Соседи поверили анонсу: пакеты к сайту уходят к нему.', 'The transit carrier announced over BGP that the site’s network is his. The neighbours believed it: packets for the site go to him.')
          : b('Без точки обмена прямого пути нет: провайдер отдаёт пакет транзитному оператору AS 64502, и тот везёт его дальше — за деньги и длинной дорогой.', 'Without an exchange point there is no direct path: the provider hands the packet to transit carrier AS 64502, who carries it on — for money and the long way round.'),
        focus: ['isp', 'transit', 'e-transit'],
        tokens: [{ edge: 'e-transit' }],
        states: { transit: leak ? 'err' : 'on', ixp: 'off', 'e-peer': 'off', 'e-ixp-cable': 'off' },
        metrics: { rtt: Math.round((L.wifi + L.access + L.middle) * 20) / 10, ases },
        ...(leak
          ? {
              broken: {
                at: 'transit',
                message: '$ traceroute -n shop.example\n 1  192.168.1.1  1.9 ms\n 2  203.0.113.1  9.8 ms\n 3  198.18.7.1  37.4 ms\n 4  * * *\n 5  * * *',
                caption: b('утечка маршрута: соседи поверили чужому анонсу, и пакеты ушли туда, где сайта нет. Так в 2008 году одна сеть на пару часов «забрала» YouTube у половины мира.', 'a route leak: the neighbours believed a wrong announcement and packets went where the site is not. This is how in 2008 one network “took” YouTube away from half the world for a couple of hours.'),
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
        caption: b('Кабель перебит. Пока маршрутизаторы соседних сетей по BGP не узнают об этом и не выберут другой кабель, пакеты в эту сторону теряются.', 'The cable is cut. Until the routers of neighbouring networks learn about it over BGP and choose another cable, packets in this direction are lost.'),
        focus: ['cable', 'e-cable'],
        states: { cable: 'err' },
        metrics: { rtt: 0, ases },
        broken: {
          at: 'cable',
          message: '$ ping -c 3 shop.example\nPING shop.example (198.51.100.20) 56(84) bytes of data.\nFrom 198.18.0.2 icmp_seq=1 Destination Net Unreachable\n\n--- shop.example ping statistics ---\n3 packets transmitted, 0 received, +1 errors, 100% packet loss',
          caption: b('через несколько секунд — минут BGP перестроит путь через другой кабель: связь вернётся, но с большей задержкой.', 'within seconds to minutes BGP reroutes through another cable: the connection comes back, with more delay.'),
        },
      });
      return steps;
    }
    steps.push({
      id: 'world',
      label: b('мир', 'world'),
      caption: fmt(b('Дальше — подводный кабель: {d} км. Свет в стекле проходит 5 мкс на километр, значит {ms} мс в одну сторону, и быстрее не будет никогда.', 'Next comes a submarine cable: {d} km. Light in glass covers a kilometre in 5 µs, so {ms} ms one way, and it will never be faster.'), {
        d: p.distance.toLocaleString('ru-RU'),
        ms: Math.round(L.cable * 10) / 10,
      }),
      focus: ['cable', 'e-cable'],
      tokens: [{ edge: 'e-cable' }],
      states: { cable: 'on' },
      values: { cable: `${p.distance.toLocaleString('en-US')} km` },
      metrics: { rtt: L.rtt - L.dc * 2, ases },
    });
    steps.push({
      id: 'dc',
      label: b('здание', 'building'),
      caption: b('Пакет в ЦОДе: граничный роутер, коммутатор, балансировщик, сервер сайта. Ответ поедет обратно тем же путём — поэтому задержку считают «туда и обратно» (RTT).', 'The packet is in the data centre: an edge router, a switch, a load balancer, the site’s server. The answer travels back the same way — that is why delay is counted as a round trip (RTT).'),
      focus: ['dc'],
      states: { dc: 'on' },
      metrics: { rtt: L.rtt, ases },
    });
    steps.push({
      id: 'cdn',
      label: 'CDN',
      caption: p.cdn
        ? fmt(b('Картинки и стили сайта лежат копией на узле CDN в вашем городе: {c} мс туда и обратно вместо {o} мс до ЦОДа. Физику не обманешь — но можно не ездить далеко.', 'The site’s images and styles have a copy on a CDN node in your city: {c} ms round trip instead of {o} ms to the data centre. Physics cannot be cheated — but you can avoid travelling far.'), { c: L.cdnRtt, o: L.rtt })
        : b('Копий поблизости нет: каждая картинка едет из ЦОДа через кабель. Включите CDN и посмотрите на счётчики.', 'There are no copies nearby: every image travels from the data centre through the cable. Turn the CDN on and watch the counters.'),
      focus: p.cdn ? ['cdn', 'e-cdn'] : ['dc', 'e-cable'],
      tokens: p.cdn ? [{ edge: 'e-cdn', label: 'app.css' }] : [{ edge: 'e-cable', label: 'app.css', reverse: true }],
      states: { cdn: p.cdn ? 'on' : 'off' },
      metrics: { rtt: L.rtt, cdn: p.cdn ? L.cdnRtt : 0, ases },
    });
    steps.push({
      id: 'root',
      label: b('корень DNS', 'DNS root'),
      caption: b('Где-то рядом с провайдером отвечает экземпляр корневого DNS-сервера. Таких экземпляров сотни, адрес у них один (anycast), и BGP приводит вас к ближайшему. Зачем нужен корень — в уроке про DNS.', 'Somewhere near the provider an instance of a root DNS server answers. There are hundreds of such instances with one address (anycast), and BGP brings you to the nearest one. Why the root is needed is the DNS lesson.'),
      focus: ['root', 'e-root'],
      tokens: [{ edge: 'e-root', label: '. NS?' }],
      states: { root: 'on' },
      metrics: { rtt: L.rtt, cdn: p.cdn ? L.cdnRtt : 0, ases },
    });
    steps.push({
      id: 'whole',
      label: b('весь путь', 'the path'),
      caption: fmt(b('Весь путь: ваша сеть → сеть провайдера → {mid} → кабель → ЦОД. У каждого участка свой хозяин. Дальше спускаемся внутрь: что именно едет по этой линии.', 'The whole path: your network → the provider’s network → {mid} → the cable → the data centre. Each part has its own owner. Next we go inside: what exactly travels along this line.'), {
        mid: p.ixp ? 'IXP' : 'transit',
      }),
      focus: ['e-wifi', 'e-fiber', p.ixp ? 'e-peer' : 'e-transit', p.ixp ? 'e-ixp-cable' : 'e-tr-cable', 'e-cable'],
      states: { laptop: 'ok', dc: 'ok' },
      metrics: { rtt: L.rtt, cdn: p.cdn ? L.cdnRtt : 0, ases },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, bb) {
    if (change.kind === 'break') {
      if (!change.on) return b('Поломка убрана: путь снова проходит до ЦОДа.', 'The break is removed: the path reaches the data centre again.');
      return change.id === 'cable'
        ? b('Кабель перебит: пакеты теряются, пока BGP не найдёт другой путь.', 'The cable is cut: packets are lost until BGP finds another path.')
        : b('Чужой анонс увёл трафик к транзитному оператору, у которого сайта нет: пакеты пропадают на третьем шаге traceroute.', 'A wrong announcement pulled traffic to the transit carrier, which does not have the site: packets vanish at the third traceroute hop.');
    }
    const r0 = lastMetric(prev, 'rtt') ?? 0;
    const r1 = lastMetric(next, 'rtt') ?? 0;
    switch (change.id) {
      case 'ixp':
        return bb.ixp
          ? fmt(b('Пиринг вернулся: RTT {a} → {b} мс. Соседние сети снова обмениваются трафиком напрямую.', 'Peering is back: RTT {a} → {b} ms. The neighbouring networks exchange traffic directly again.'), { a: r0, b: r1 })
          : fmt(b('Без IXP трафик пошёл через транзитного оператора: RTT {a} → {b} мс и одна лишняя автономная система.', 'Without the IXP traffic goes through a transit carrier: RTT {a} → {b} ms and one extra autonomous system.'), { a: r0, b: r1 });
      case 'cdn':
        return bb.cdn
          ? fmt(b('CDN включён: статика приходит за {c} мс из своего города, до ЦОДа по-прежнему {o} мс.', 'CDN on: static files arrive in {c} ms from your city; the data centre is still {o} ms away.'), { c: mapLatency(bb).cdnRtt, o: r1 })
          : b('CDN выключен: каждый файл снова едет из ЦОДа.', 'CDN off: every file travels from the data centre again.');
      case 'distance':
        return fmt(b('{a} → {b} км: только кабель добавляет {ms} мс в одну сторону. RTT {r0} → {r1} мс.', '{a} → {b} km: the cable alone adds {ms} ms one way. RTT {r0} → {r1} ms.'), {
          a: a.distance as number,
          b: bb.distance as number,
          ms: Math.round((bb.distance as number) * 0.05) / 10,
          r0,
          r1,
        });
      case 'cgnat':
        return bb.cgnat
          ? b('Провайдер выдал роутеру адрес из 100.64.0.0/10: снаружи до вас больше не достучаться.', 'The provider gave the router an address from 100.64.0.0/10: nobody outside can reach you any more.')
          : b('У роутера снова свой публичный адрес.', 'The router has its own public address again.');
    }
    return b('Параметр изменился, путь пересчитан.', 'The parameter changed; the path was recomputed.');
  },
});
