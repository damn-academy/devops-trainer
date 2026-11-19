// One request from a browser to a shop's server and back: the client asks,
// the server program answers, and a crowd of other clients makes everyone
// wait (F06, F07). A waterfall shows where the time goes.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';

type P = { clients: number; distance: string; servers: number };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
const SERVICE_MS = 5;
const PER_SERVER = 1000 / SERVICE_MS; // requests a second one server program can answer
const ONE_WAY: Record<string, number> = { city: 5, country: 25, ocean: 80 };
const MDN = { url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview', label: 'MDN › Overview of HTTP' };

export interface ReqNumbers {
  /** Share of the servers’ capacity in use, %. */
  load: number;
  /** Waiting in the queue, ms. */
  wait: number;
  /** One way through the network, ms. */
  net: number;
  overload: boolean;
}

/** A single-queue model: the wait grows as load/(1 − load) and explodes near 100%. */
export function reqNumbers(p: P): ReqNumbers {
  const cap = PER_SERVER * p.servers;
  const rho = p.clients / cap;
  const overload = rho >= 1;
  const wait = overload ? 0 : Math.round(((SERVICE_MS * rho) / (1 - rho)) * 10) / 10;
  return { load: Math.min(100, Math.round(rho * 100)), wait, net: ONE_WAY[p.distance] ?? ONE_WAY.country, overload };
}

export const requestModel = defineModel<P>({
  id: 'orient.request',
  block: 'orient',
  title: bi('Запрос к серверу и ответ', 'A request to a server and the answer'),
  summary: bi(
    'Браузер просит страницу каталога, программа на сервере отвечает. Приведите на сайт толпу покупателей, унесите сервер за океан, добавьте второй сервер, остановите программу или порвите сеть.',
    'The browser asks for the catalogue page, the program on the server answers. Bring a crowd of shoppers to the site, move the server across the ocean, add a second server, stop the program or cut the network.',
  ),
  concepts: ['orient.server', 'orient.client-request'],
  waterfall: 'ms',
  diagram: {
    width: 960,
    height: 368,
    nodes: [
      { id: 'browser', label: bi('Ваш браузер', 'Your browser'), sub: 'client', family: 'user', x: 24, y: 48, w: 176, h: 56, card: card(bi('Клиент: программа, которая просит. Разговор всегда начинает она — сервер сам никому не пишет.', 'The client: the program that asks. It always starts the conversation; the server never writes to anyone by itself.'), bi('Вы запустили его и набрали адрес магазина.', 'You started it and typed the shop’s address.'), { see: 'curl https://shop.example/', doc: MDN }) },
      { id: 'others', label: bi('Другие покупатели', 'Other shoppers'), sub: '50 / s', family: 'user', x: 264, y: 176, w: 176, h: 56, card: card(bi('Такие же клиенты, как вы. Сервер один на всех, и их запросы встают в ту же очередь.', 'Clients just like you. There is one server for all of them, and their requests join the same queue.'), bi('Люди со всего города, которые зашли в магазин одновременно с вами.', 'People across the city who visited the shop at the same time as you.')) },
      { id: 'net', label: bi('Сеть', 'Network'), sub: '25 ms', family: 'l3', shape: 'pill', x: 304, y: 48, w: 176, h: 56, card: card(bi('Путь от вас до сервера через провайдеров. Сообщение идёт по нему со скоростью, близкой к скорости света в стекле, — и всё равно десятки миллисекунд через страну.', 'The path from you to the server through providers. A message travels it near the speed of light in glass, and still takes tens of milliseconds across a country.'), bi('Провайдеры и их кабели.', 'Providers and their cables.'), { see: 'ping -c 3 shop.example' }) },
      { id: 'queue', label: bi('Очередь', 'Queue'), sub: '0', family: 'gauge', shape: 'buffer', x: 584, y: 48, w: 176, h: 56, card: card(bi('Запросы, которые пришли, пока программа занята. Чем ближе загрузка к 100%, тем длиннее очередь.', 'Requests that arrived while the program was busy. The closer the load is to 100%, the longer the queue.'), bi('Операционная система сервера держит их, пока программа не возьмёт следующий.', 'The server’s operating system holds them until the program takes the next one.')) },
      { id: 'app', label: bi('Программа магазина', 'Shop program'), sub: '5 ms / request', family: 'process', x: 584, y: 176, w: 176, h: 56, card: card(bi('Программа, которая круглые сутки ждёт запросов и отвечает на них. На один запрос у неё уходит около 5 мс, то есть 200 запросов в секунду.', 'The program that waits for requests day and night and answers them. One request takes it about 5 ms, that is 200 requests a second.'), bi('Её запустили на сервере и не выключают.', 'It was started on the server and is never switched off.')) },
      { id: 'data', label: bi('Каталог', 'Catalogue'), sub: 'teas.db', family: 'store', x: 800, y: 176, w: 136, h: 56, card: card(bi('Данные, из которых собирается страница: названия, цены, остатки.', 'The data the page is put together from: names, prices, stock.'), bi('Хранится на диске сервера.', 'Kept on the server’s disk.')) },
    ],
    groups: [{ id: 'server', label: bi('Сервер', 'Server'), around: ['queue', 'app', 'data'], family: 'node', pad: 16, card: card(bi('Компьютер в здании провайдера, который работает без перерыва и обслуживает всех, кто к нему обратится. Экрана и клавиатуры у него обычно нет.', 'A computer in a provider’s building that runs without a break and serves everyone who turns to it. It usually has no screen or keyboard.'), bi('Магазин арендует его или ставит свой.', 'The shop rents it or puts in its own.')) }],
    edges: [
      { id: 'e-req', from: 'browser', to: 'net', label: bi('запрос', 'request'), card: card(bi('Запрос: «дайте, пожалуйста, страницу /catalog». Это несколько строк текста.', 'The request: “please give me the page /catalog”. It is a few lines of text.'), bi('Браузер.', 'The browser.'), { doc: MDN }) },
      { id: 'e-others', from: 'others', to: 'net', label: bi('их запросы', 'their requests'), card: card(bi('Запросы других покупателей идут той же дорогой.', 'Other shoppers’ requests travel the same road.'), bi('Их браузеры.', 'Their browsers.')) },
      { id: 'e-net', from: 'net', to: 'queue', label: bi('доставка', 'delivery'), card: card(bi('Сеть доставила запрос до сервера.', 'The network has delivered the request to the server.'), bi('Провайдеры.', 'The providers.')) },
      { id: 'e-take', from: 'queue', to: 'app', label: bi('следующий', 'next'), card: card(bi('Освободившись, программа берёт из очереди следующий запрос.', 'Once free, the program takes the next request from the queue.'), bi('Программа магазина.', 'The shop program.')) },
      { id: 'e-read', from: 'app', to: 'data', label: bi('цены', 'prices'), card: card(bi('Программа читает каталог и собирает из него страницу.', 'The program reads the catalogue and builds the page from it.'), bi('Программа магазина.', 'The shop program.')) },
      {
        id: 'e-resp',
        from: 'app',
        to: 'browser',
        via: [
          [672, 320],
          [112, 320],
        ],
        labelAt: 0.35,
        label: bi('ответ: 200 OK + страница', 'answer: 200 OK + page'),
        card: card(bi('Ответ начинается с числа: 200 — «всё в порядке», 404 — «такой страницы нет», 503 — «сервер перегружен». За ним идёт сама страница.', 'The answer starts with a number: 200 means “all is well”, 404 “no such page”, 503 “the server is overloaded”. The page itself follows.'), bi('Программа магазина.', 'The shop program.'), { see: 'curl -I https://shop.example/', doc: MDN }),
      },
    ],
  },
  params: [
    {
      id: 'clients',
      label: bi('Покупателей в секунду', 'Shoppers per second'),
      kind: 'range',
      min: 1,
      max: 1000,
      step: 1,
      default: 50,
      near: 'queue',
      predict: {
        prompt: bi('Покупателей стало почти столько, сколько сервер успевает обслужить. Что будет с вашим ожиданием?', 'Now there are almost as many shoppers as the server can serve. What happens to your wait?'),
        options: [
          { id: 'grows', text: bi('Резко вырастет: очередь растёт быстрее загрузки', 'It shoots up: the queue grows faster than the load') },
          { id: 'same', text: bi('Почти не изменится, пока загрузка ниже 100%', 'It hardly changes while the load is under 100%') },
        ],
        resolve: (prev, next) => ((next[next.length - 1]?.metrics?.ms ?? 0) > (prev[prev.length - 1]?.metrics?.ms ?? 0) * 1.5 ? 'grows' : 'same'),
      },
    },
    {
      id: 'distance',
      label: bi('Где стоит сервер', 'Where the server stands'),
      kind: 'choice',
      default: 'country',
      near: 'net',
      options: [
        { id: 'city', label: bi('в вашем городе', 'in your city') },
        { id: 'country', label: bi('в другом конце страны', 'across the country') },
        { id: 'ocean', label: bi('за океаном', 'across the ocean') },
      ],
    },
    {
      id: 'servers',
      label: bi('Серверов с программой', 'Servers running the program'),
      kind: 'range',
      min: 1,
      max: 4,
      step: 1,
      default: 1,
      near: 'app',
    },
  ],
  breaks: [
    {
      id: 'app-down',
      label: bi('Программа магазина остановлена', 'The shop program is stopped'),
      remove: ['app', 'e-take'],
      boundary: 'process',
      predict: {
        prompt: bi('Сервер включён, но программа на нём остановлена. Что увидит браузер?', 'The server is on, but the program on it is stopped. What does the browser see?'),
        options: [
          { id: 'fast', text: bi('Сразу ошибку: машина отвечает, что никто не слушает', 'An error at once: the machine answers that nobody is listening') },
          { id: 'wait', text: bi('Будет ждать ответа бесконечно', 'It waits for an answer forever') },
          { id: 'old', text: bi('Старую страницу', 'The old page') },
        ],
        resolve: () => 'fast',
      },
    },
    {
      id: 'net-down',
      label: bi('Порвать сеть между вами и сервером', 'Cut the network between you and the server'),
      remove: ['net', 'e-net'],
      boundary: 'network',
      predict: {
        prompt: bi('Кабель между городами перерублен. Что увидит браузер?', 'The cable between the cities is cut. What does the browser see?'),
        options: [
          { id: 'wait', text: bi('Будет ждать, а потом сдастся с ошибкой «время вышло»', 'It waits and then gives up with a “timed out” error') },
          { id: 'fast', text: bi('Сразу ошибку «отказано»', 'A “refused” error at once') },
        ],
        resolve: () => 'wait',
      },
    },
  ],
  metrics: [
    { id: 'ms', label: bi('от запроса до страницы', 'from request to page'), unit: 'ms' },
    { id: 'load', label: bi('загрузка серверов', 'server load'), unit: '%' },
  ],
  run(p, broken): Step[] {
    const n = reqNumbers(p);
    const m = (ms: number) => ({ ms: Math.round(ms * 10) / 10, load: n.load });
    const steps: Step[] = [
      {
        id: 'ask',
        label: bi('запрос', 'request'),
        caption: bi('Вы открыли каталог магазина. Браузер — клиент — пишет короткий запрос: «GET /catalog».', 'You opened the shop’s catalogue. The browser, the client, writes a short request: “GET /catalog”.'),
        focus: ['browser', 'e-req'],
        tokens: [{ edge: 'e-req', label: 'GET /catalog' }],
        states: { browser: 'on' },
        values: { others: `${p.clients} / s`, net: `${n.net} ms`, app: p.servers > 1 ? `×${p.servers} · 5 ms / request` : '5 ms / request' },
        metrics: m(0),
      },
    ];
    if (broken.has('net-down')) {
      steps.push({
        id: 'lost',
        label: bi('тишина', 'silence'),
        caption: bi('Запрос ушёл в оборванную сеть и пропал. Браузер не знает, что случилось, и ждёт ответа, которого не будет.', 'The request went into the cut network and was lost. The browser does not know what happened and waits for an answer that will never come.'),
        focus: ['net', 'e-net'],
        states: { net: 'err', 'e-net': 'err', browser: 'wait' },
        metrics: m(30000),
        broken: { at: 'net', message: 'curl: (28) Connection timed out after 30001 milliseconds', caption: bi('ответ не пришёл: через 30 секунд браузер сдаётся с ошибкой «время вышло».', 'no answer came: after 30 seconds the browser gives up with “timed out”.') },
      });
      return steps;
    }
    steps.push({
      id: 'travel',
      label: bi('дорога туда', 'the way there'),
      caption: fmt(bi('Сеть везёт запрос до сервера: {d} мс в одну сторону.', 'The network carries the request to the server: {d} ms one way.'), { d: n.net }),
      focus: ['net', 'e-net'],
      tokens: [{ edge: 'e-net', label: 'GET /catalog' }, ...(p.clients > 1 ? [{ edge: 'e-others', label: `×${p.clients}` }] : [])],
      states: { net: 'on' },
      metrics: m(n.net),
    });
    if (broken.has('app-down')) {
      steps.push({
        id: 'refused',
        label: bi('отказ', 'refused'),
        caption: bi('Сервер включён, но программы, которая принимает запросы, нет. Операционная система сервера сразу отвечает: «здесь никто не слушает».', 'The server is on, but the program that takes requests is not running. The server’s operating system answers at once: “nobody is listening here”.'),
        focus: ['queue', 'app'],
        states: { app: 'err', queue: 'off' },
        metrics: m(n.net * 2),
        broken: { at: 'app', message: 'curl: (7) Failed to connect to shop.example port 443: Connection refused', caption: bi('сервер — это машина плюс работающая программа; без программы машина умеет только отказать.', 'a server is a machine plus a running program; without the program the machine can only refuse.') },
      });
      return steps;
    }
    if (n.overload) {
      steps.push({
        id: 'overload',
        label: '503',
        caption: fmt(bi('В секунду приходит {c} запросов, а серверы успевают {k}. Очередь переполнена, и вам отвечают «503: сервер перегружен».', '{c} requests arrive a second and the servers manage {k}. The queue overflows, and you get “503: the server is overloaded”.'), { c: p.clients, k: PER_SERVER * p.servers }),
        focus: ['queue', 'e-resp', 'browser'],
        tokens: [{ edge: 'e-resp', label: '503' }],
        states: { queue: 'err', app: 'warn', browser: 'warn' },
        values: { queue: 'full' },
        fill: { queue: 1 },
        metrics: m(n.net * 2 + 1),
      });
      return steps;
    }
    const queued = Math.round((n.wait / SERVICE_MS) * 10) / 10;
    steps.push(
      {
        id: 'wait',
        label: bi('очередь', 'queue'),
        caption:
          n.wait < 1
            ? bi('Программа свободна: запрос почти не ждёт в очереди.', 'The program is free: the request hardly waits in the queue.')
            : fmt(bi('Серверы загружены на {l}%: перед вами в очереди в среднем {q} запросов, ожидание {w} мс.', 'The servers are {l}% busy: on average {q} requests are ahead of you, a wait of {w} ms.'), { l: n.load, q: queued, w: n.wait }),
        focus: ['queue'],
        states: { queue: n.load > 80 ? 'warn' : 'on' },
        values: { queue: String(queued) },
        fill: { queue: Math.min(1, queued / 20) },
        metrics: m(n.net + n.wait),
      },
      {
        id: 'work',
        label: bi('работа', 'work'),
        caption: bi('Программа берёт запрос, читает из каталога цены и собирает страницу. На это уходит около 5 мс.', 'The program takes the request, reads prices from the catalogue and builds the page. That takes about 5 ms.'),
        focus: ['e-take', 'app', 'e-read', 'data'],
        tokens: [{ edge: 'e-take' }, { edge: 'e-read' }],
        states: { app: 'on', data: 'on' },
        metrics: m(n.net + n.wait + SERVICE_MS),
      },
      {
        id: 'back',
        label: bi('дорога назад', 'the way back'),
        caption: fmt(bi('Ответ «200 OK» со страницей идёт обратно ещё {d} мс.', 'The answer “200 OK” with the page travels back for another {d} ms.'), { d: n.net }),
        focus: ['e-resp'],
        tokens: [{ edge: 'e-resp', label: '200 OK' }],
        metrics: m(n.net * 2 + n.wait + SERVICE_MS),
      },
      {
        id: 'draw',
        label: bi('страница', 'page'),
        caption: fmt(bi('Браузер рисует каталог. Весь путь занял {t} мс, и больше всего времени ушло на дорогу.', 'The browser draws the catalogue. The whole path took {t} ms, most of it spent on the road.'), { t: Math.round(n.net * 2 + n.wait + SERVICE_MS + 10) }),
        focus: ['browser'],
        states: { browser: 'ok' },
        metrics: m(n.net * 2 + n.wait + SERVICE_MS + 10),
      },
    );
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const ms = (s: Step[]) => s[s.length - 1]?.metrics?.ms ?? 0;
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: запрос снова доходит и получает ответ.', 'The break is removed: the request gets through and is answered again.');
      return change.id === 'app-down'
        ? bi('Машина на месте, но программа не принимает запросы: отказ приходит сразу, за время дороги туда и обратно.', 'The machine is there, but the program does not take requests: the refusal arrives at once, within the round trip.')
        : bi('Сеть оборвана: запросу некуда идти, и браузер узнаёт об этом только по истечении времени ожидания.', 'The network is cut: the request has nowhere to go, and the browser finds out only when its waiting time runs out.');
    }
    switch (change.id) {
      case 'clients': {
        const over = next.some((s) => s.id === 'overload');
        return over
          ? fmt(bi('{c} запросов в секунду — больше, чем успевают серверы: очередь переполнилась, ответ 503.', '{c} requests a second is more than the servers manage: the queue overflowed, the answer is 503.'), { c: b.clients as number })
          : fmt(bi('{a} → {b} покупателей в секунду: путь {t0} → {t1} мс. Ожидание растёт тем круче, чем ближе загрузка к 100%.', '{a} → {b} shoppers a second: the path {t0} → {t1} ms. The wait rises more steeply the closer the load gets to 100%.'), { a: a.clients as number, b: b.clients as number, t0: ms(prev), t1: ms(next) });
      }
      case 'distance':
        return fmt(bi('Сервер переехал: дорога в одну сторону {d} мс, весь путь {t} мс. Расстояние не ускорить ничем, кроме переезда ближе.', 'The server moved: {d} ms one way, {t} ms in all. Distance can be shortened only by moving closer.'), { d: ONE_WAY[b.distance as string], t: ms(next) });
      case 'servers':
        return fmt(bi('Серверов {n}: каждый получает свою долю запросов, загрузка падает, путь {t0} → {t1} мс.', '{n} servers: each gets its share of requests, the load drops, the path {t0} → {t1} ms.'), { n: b.servers as number, t0: ms(prev), t1: ms(next) });
    }
    return bi('Процесс пересчитан.', 'The process is recomputed.');
  },
});
