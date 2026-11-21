// One request from a browser to a shop's server and back: the client asks,
// the server program answers, and a crowd of other clients makes everyone
// wait (F06, F07). A waterfall shows where the time goes.
//
// Reading order: at the start only the browser is on the diagram. The network
// appears when the request leaves, the other shoppers when their requests join
// it, and the server with its queue, program and catalogue when the request
// arrives there. The answer travels back as a card with its status number.

import { defineModel } from '../../../core/define';
import { bi, pluralRu, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { card, compare, fmtb, lastMetric, ruNum, startWith, tr } from './kit';

type P = { clients: number; distance: string; servers: number };

const SERVICE_MS = 5;
const PER_SERVER = 1000 / SERVICE_MS; // requests a second one server program can answer
const ONE_WAY: Record<string, number> = { city: 5, country: 25, ocean: 40 };
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

const ALL = ['browser', 'others', 'net', 'queue', 'app', 'data', 'server', 'e-req', 'e-others', 'e-net', 'e-take', 'e-read', 'e-resp'];
const WHERE: Record<string, Bi> = { city: bi('в вашем городе', 'in your city'), country: bi('в другом конце страны', 'across the country'), ocean: bi('за океаном', 'across the ocean') };
const shoppers = (n: number) => `${n} ${pluralRu(n, ['покупатель', 'покупателя', 'покупателей'])}`;
const r1 = (x: number) => Math.round(x * 10) / 10;
/** The longest bar of the waterfall, for the last step's caption: the road there and back, the queue or the program's own work. */
function biggest(n: ReqNumbers): Bi {
  const road = n.net * 2;
  if (n.wait >= road && n.wait >= SERVICE_MS) return bi('на ожидание в очереди', 'on waiting in the queue');
  if (road >= SERVICE_MS) return bi('на дорогу туда и обратно', 'on the road there and back');
  return bi('на работу самой программы магазина', 'on the work of the shop program itself');
}
const msb = (x: number) => bi(ruNum(r1(x)), String(r1(x)));

export const requestModel = defineModel<P>({
  id: 'orient.request',
  frame: 'visible',
  block: 'orient',
  title: bi('Запрос к серверу и ответ', 'A request to a server and the answer'),
  summary: bi(
    'Вы открываете каталог чайного магазина. Браузер отправляет запрос, сеть доставляет его на сервер магазина, запрос ждёт своей очереди, программа магазина составляет страницу из каталога и присылает ответ. Под схемой растёт водопад, похожий на расписание дня: каждому шагу, который занял время, в нём соответствует своя полоска, и чем дольше шаг, тем она длиннее.',
    'You open the tea shop’s catalogue. The browser sends a request, the network delivers it to the shop’s server, the request waits its turn, the shop program puts the page together from the catalogue and sends the answer. Under the diagram a waterfall grows that looks like a day’s timetable: every step that took time has its own bar in it, and the longer the step, the longer the bar.',
  ),
  intro: bi(
    'Сейчас на схеме только ваш браузер. Нажмите «Начать с первого шага», и браузер отправит запрос серверу магазина.',
    'Now the diagram shows only your browser. Press “Start from the first step”, and the browser sends a request to the shop’s server.',
  ),
  legend: [
    { mark: 'active', text: bi('тот, кто работает сейчас', 'the one working now') },
    { mark: 'say', text: bi('что он делает', 'what it does') },
    { mark: 'token', text: bi('запрос, данные или ответ, которые передаются дальше', 'the request, data or answer passed on') },
    { mark: 'icon:browser', text: bi('ваш браузер, то есть клиент', 'your browser, that is, the client') },
    { mark: 'icon:user', text: bi('другие покупатели', 'other shoppers') },
    { mark: 'icon:router', text: bi('сеть провайдеров', 'the providers’ network') },
    { mark: 'icon:server', text: bi('очередь запросов на сервере', 'the queue on the server') },
    { mark: 'icon:process', text: bi('программа магазина', 'the shop program') },
    { mark: 'icon:database', text: bi('каталог с ценами', 'the catalogue') },
    { mark: 'warn', text: bi('сервер загружен, и запросы ждут', 'the server is busy, and requests wait') },
    { mark: 'err', text: bi('здесь запрос не прошёл', 'the request failed here') },
  ],
  stopLabel: bi('Запрос не прошёл', 'The request failed'),
  concepts: ['orient.server', 'orient.client-request'],
  waterfall: 'ms',
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      { id: 'browser', label: bi('Ваш браузер', 'Your browser'), icon: 'browser', work: 'dots', sub: { ru: 'клиент', en: 'client' }, family: 'user', x: 24, y: 56, w: 184, h: 64, card: card(bi('Браузер служит клиентом, то есть программой, которая просит. Разговор всегда начинает браузер, а сервер сам никому не пишет.', 'The client: the program that asks. It always starts the conversation.'), bi('Браузер запустили вы и набрали в нём адрес магазина.', 'You started it and typed the shop’s address.'), { see: 'curl https://shop.example/', doc: MDN }) },
      { id: 'net', label: bi('Сеть', 'Network'), icon: 'router', sub: { ru: '25 мс', en: '25 ms' }, family: 'l3', shape: 'pill', x: 272, y: 56, w: 192, h: 64, card: card(bi('Сообщение идёт от вас до сервера через сети нескольких провайдеров почти со скоростью света в стекле, то есть около двухсот километров за миллисекунду. И всё равно через страну оно идёт десятки миллисекунд, а через океан около сорока в одну сторону.', 'The message travels from you to the server through several providers’ networks at almost the speed of light in glass, that is, about two hundred kilometres a millisecond. Even so it takes tens of milliseconds to cross a country and about forty one way to cross an ocean.'), bi('Сеть держат провайдеры и их кабели.', 'Providers and their cables.'), { see: 'ping -c 3 shop.example' }) },
      { id: 'others', label: bi('Другие покупатели', 'Other shoppers'), icon: 'user', sub: '50 / s', family: 'user', x: 272, y: 224, w: 192, h: 64, card: card(bi('Браузеры других покупателей служат такими же клиентами, как ваш браузер. Сервер у магазина один на всех, и их запросы встают в ту же очередь, что и ваш.', 'Clients like you; their requests join the same queue.'), bi('Эти запросы отправляют люди со всей страны, которые зашли в магазин одновременно с вами.', 'People who visited the shop at the same time.')) },
      { id: 'queue', label: bi('Очередь', 'Queue'), icon: 'server', sub: '0', family: 'gauge', shape: 'buffer', x: 552, y: 56, w: 184, h: 64, card: card(bi('В очереди ждут запросы, которые пришли, пока программа магазина была занята предыдущими. Чем ближе загрузка сервера к ста процентам, тем длиннее очередь. Полоска внизу показывает, насколько она заполнена.', 'Requests that arrived while the program was busy; the closer the load to 100%, the longer the queue.'), bi('Очередь держит операционная система сервера, пока программа не возьмёт следующий запрос.', 'The server’s operating system holds it.')) },
      { id: 'app', label: bi('Программа магазина', 'Shop program'), icon: 'process', sub: { ru: '5 мс / request', en: '5 ms / request' }, family: 'process', x: 552, y: 224, w: 184, h: 64, card: card(bi('Программа магазина круглые сутки ждёт запросов и отвечает на них. На один запрос у неё уходит около 5 мс, так что за секунду она успевает ответить на 200 запросов.', 'Waits for requests and answers them: about 5 ms each, 200 a second.'), bi('Программу запустили на сервере и не выключают.', 'Started on the server and never switched off.')) },
      { id: 'data', label: bi('Каталог', 'Catalogue'), icon: 'database', sub: 'teas.db', family: 'store', x: 776, y: 224, w: 160, h: 64, card: card(bi('В каталоге хранятся данные, из которых программа составляет страницу: названия чаёв, цены и остатки на складе.', 'The catalogue keeps the data the program makes the page from: the names of the teas, the prices and the stock.'), bi('Каталог хранится на диске сервера.', 'Kept on the server’s disk.')) },
    ],
    groups: [{ id: 'server', label: bi('Сервер магазина', 'The shop’s server'), around: ['queue', 'app', 'data'], family: 'node', pad: 16, card: card(bi('Сервер магазина представляет собой компьютер в дата-центре, который работает без перерыва и обслуживает всех, кто к нему обратится. Экрана и клавиатуры у него обычно нет, и с ним говорят командами по сети.', 'A computer in a data centre that runs without a break and serves everyone.'), bi('Магазин арендует сервер или ставит свой.', 'The shop rents it or puts in its own.')) }],
    edges: [
      { id: 'e-req', from: 'browser', to: 'net', label: bi('запрос', 'request'), card: card(bi('Запрос состоит из нескольких строк текста, смысл которых сводится к просьбе «дайте, пожалуйста, страницу /catalog».', 'A few lines of text: “please give me /catalog”.'), bi('Запрос отправляет браузер.', 'The browser.'), { doc: MDN }) },
      { id: 'e-others', from: 'others', to: 'net', label: bi('запросы других покупателей', 'their requests'), card: card(bi('Запросы других покупателей идут к серверу той же дорогой.', 'Other shoppers’ requests travel the same road.'), bi('Их отправляют браузеры других покупателей.', 'Their browsers.')) },
      { id: 'e-net', from: 'net', to: 'queue', label: bi('доставка', 'delivery'), card: card(bi('Сеть доставила запрос до сервера магазина.', 'The network has delivered the request.'), bi('Запрос доставляют провайдеры.', 'The providers.')) },
      { id: 'e-take', from: 'queue', to: 'app', label: bi('следующий запрос', 'next request'), card: card(bi('Закончив с предыдущим запросом, программа берёт из очереди следующий.', 'Once free, the program takes the next request.'), bi('Запрос берёт программа магазина.', 'The shop program.')) },
      { id: 'e-read', from: 'app', to: 'data', label: bi('цены', 'prices'), card: card(bi('Программа читает из каталога названия и цены и составляет из них страницу.', 'The program reads names and prices from the catalogue and makes the page from them.'), bi('Каталог читает программа магазина.', 'The shop program.')) },
      {
        id: 'e-resp',
        from: 'app',
        to: 'browser',
        via: [
          [644, 360],
          [116, 360],
        ],
        labelAt: 0.4,
        label: bi('ответ сервера', 'the server’s answer'),
        card: card(bi('Ответ начинается с числа: 200 означает «всё в порядке», 404 — «такой страницы нет», 503 — «сервер перегружен». За числом идёт сама страница.', '200 means all is well, 404 no such page, 503 overloaded. The page follows.'), bi('Ответ отправляет программа магазина.', 'The shop program.'), { see: 'curl -I https://shop.example/', doc: MDN }),
      },
    ],
  },
  params: [
    {
      id: 'clients',
      label: bi('Сколько покупателей заходит в магазин за секунду', 'Shoppers per second'),
      group: bi('Покупатели', 'Shoppers'),
      kind: 'range',
      min: 1,
      max: 1000,
      step: 1,
      default: 50,
      near: 'others',
      predict: {
        prompt: bi('Вы изменили число покупателей в секунду. Один сервер успевает ответить на 200 запросов в секунду. Что станет со временем от вашего запроса до страницы?', 'You changed the shoppers per second. One server answers 200 requests a second. What happens to the time from request to page?'),
        options: [
          { id: 'up', text: bi('Время вырастет', 'The time grows') },
          { id: 'down', text: bi('Время сократится', 'The time shrinks') },
          { id: 'same', text: bi('Время почти не изменится', 'The time hardly changes') },
          { id: 'err', text: bi('Вместо страницы придёт ошибка 503', 'An error 503 comes instead') },
        ],
        resolve: (prev, next) => (next.some((s) => s.id === 'overload') ? 'err' : compare(lastMetric(prev, 'ms'), lastMetric(next, 'ms'), 0.05)),
      },
    },
    {
      id: 'distance',
      label: bi('Где стоит сервер магазина', 'Where the server stands'),
      group: bi('Сервер магазина', 'The shop’s server'),
      kind: 'choice',
      default: 'country',
      near: 'net',
      options: [
        { id: 'city', label: bi('в вашем городе, 5 мс в одну сторону', 'in your city, 5 ms one way') },
        { id: 'country', label: bi('в другом конце страны, 25 мс', 'across the country, 25 ms') },
        { id: 'ocean', label: bi('за океаном, 40 мс', 'across the ocean, 40 ms') },
      ],
      predict: {
        prompt: bi('Вы перенесли сервер в другое место, а покупателей столько же. Как изменится время от запроса до страницы?', 'You moved the server; the shoppers are the same. How does the time change?'),
        options: [
          { id: 'up', text: bi('Время вырастет', 'The time grows') },
          { id: 'down', text: bi('Время сократится', 'The time shrinks') },
          { id: 'same', text: bi('Время не изменится, потому что сеть передаёт сообщения мгновенно', 'The time stays the same, because the network delivers messages instantly') },
        ],
        resolve: (prev, next) => compare(lastMetric(prev, 'ms'), lastMetric(next, 'ms')),
      },
    },
    {
      id: 'servers',
      label: bi('Сколько серверов отвечает на запросы', 'Servers running the program'),
      group: bi('Сервер магазина', 'The shop’s server'),
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
      label: bi('Программу магазина остановили, а сервер оставили включённым', 'The shop program was stopped, and the server was left on'),
      remove: ['app', 'e-take'],
      boundary: 'process',
      predict: {
        prompt: bi('Сервер включён и доступен по сети, но программа магазина на нём остановлена. Что увидит браузер?', 'The server is on and reachable, but the program is stopped. What does the browser see?'),
        options: [
          { id: 'fast', text: bi('Сразу получит отказ в соединении', 'An immediate connection refusal') },
          { id: 'wait', text: bi('Будет долго ждать, а потом сообщит, что время вышло', 'A long wait, then “timed out”') },
          { id: 'old', text: bi('Покажет страницу, которую сервер отдавал раньше', 'The page the server gave before') },
        ],
        resolve: (_p, next) => (next.find((s) => s.broken)?.broken?.message.includes('refused') ? 'fast' : 'wait'),
      },
    },
    {
      id: 'net-down',
      label: bi('Кабель между вами и сервером перерублен', 'The cable between you and the server is cut'),
      remove: ['net', 'e-net'],
      boundary: 'network',
      predict: {
        prompt: bi('Кабель между городами перерублен, а сервер и программа магазина работают. Что увидит браузер?', 'The cable between cities is cut; the server and program work. What does the browser see?'),
        options: [
          { id: 'wait', text: bi('Будет долго ждать, а потом сообщит, что время вышло', 'A long wait, then “timed out”') },
          { id: 'fast', text: bi('Сразу получит отказ в соединении', 'An immediate connection refusal') },
        ],
        resolve: (_p, next) => (next.find((s) => s.broken)?.broken?.message.includes('timed out') ? 'wait' : 'fast'),
      },
    },
  ],
  metrics: [
    { id: 'ms', label: bi('сколько миллисекунд прошло от запроса до ответа', 'milliseconds from request to answer') },
    { id: 'load', label: bi('загрузка серверов', 'server load'), unit: '%' },
  ],
  run(p, broken): Step[] {
    const n = reqNumbers(p);
    const m = (ms: number) => ({ ms: r1(ms), load: n.load });
    const where = WHERE[p.distance] ?? WHERE.country;
    const steps: Step[] = [
      {
        id: 'ask',
        label: bi('запрос', 'request'),
        caption: bi('Вы открыли каталог магазина. Браузер, то есть клиент, составляет короткий запрос, в котором просит сервер прислать страницу /catalog. Сам по себе сервер страницу не пришлёт, потому что он даже не знает о вас, пока запрос не придёт.', 'You opened the shop’s catalogue. The browser, that is, the client, writes a short request asking the server for the page /catalog. The server will not send the page by itself, because it does not even know about you until the request arrives.'),
        focus: ['browser'],
        say: { browser: bi('Браузер просит у сервера страницу /catalog.', 'The browser asks the server for the page /catalog.') },
        states: { ...startWith(ALL, 'browser'), browser: 'on' },
        values: { browser: tr('клиент', 'client'), others: tr(`${p.clients} в секунду`, `${p.clients} / s`), net: tr(`${n.net} мс`, `${n.net} ms`), app: tr(`${p.servers > 1 ? `×${p.servers} · ` : ''}5 мс на запрос`, `${p.servers > 1 ? `×${p.servers} · ` : ''}5 ms / request`), queue: '0' },
        metrics: m(0),
      },
      {
        id: 'send',
        label: bi('дорога туда', 'the way there'),
        caption: fmtb(bi('Сеть доставляет запрос к серверу магазина, который стоит {w}. В одну сторону на это уходит {d} мс, и быстрее не бывает, потому что время в пути зависит от расстояния.', 'The network carries the request to the server {w}: {d} ms one way.'), { w: where, d: n.net }),
        focus: ['e-req', 'net'],
        reveal: ['net', 'e-req'],
        tokens: [{ edge: 'e-req', label: 'GET /catalog' }],
        say: { net: fmtb(bi('Сеть доставляет запрос к серверу, и в одну сторону на это уходит {d} мс.', 'The network carries the request to the server, and one way takes {d} ms.'), { d: n.net }) },
        states: { net: 'on' },
        metrics: m(n.net),
      },
    ];
    if (broken.has('net-down')) {
      steps.push({
        id: 'lost',
        label: bi('тишина', 'silence'),
        caption: bi('Кабель перерублен, и запрос пропадает по дороге. Браузер не получает ни ответа, ни отказа, поэтому не знает, что случилось, и ждёт. Через 30 секунд он сдаётся и сообщает, что время ожидания вышло.', 'The request is lost on the way. The browser gets neither an answer nor a refusal; after 30 seconds it gives up with “timed out”.'),
        focus: ['net'],
        say: { net: bi('Кабель перерублен, и запрос пропал по дороге.', 'The cable is cut; the request is lost.') },
        states: { net: 'err', browser: 'wait' },
        metrics: m(30000),
        broken: { at: 'net', message: 'curl: (28) Connection timed out after 30001 milliseconds', caption: bi('Запрос пропал в сети. Ответ так и не пришёл, поэтому браузер ждал до конца отведённого времени. Долгое ожидание и сообщение «время вышло» в жизни означают, что запрос не доходит до сервера. Так об этой поломке сообщает программа curl, которая отправляет запросы из терминала: «соединение не установлено за 30001 миллисекунду, время вышло».', 'The request was lost in the network. No answer ever came, so the browser waited to the end of the allotted time. A long wait and a “timed out” message mean in real life that the message does not arrive. This is how curl prints this break: “the connection was not made within 30001 milliseconds, the time ran out”.') },
      });
      return steps;
    }
    if (p.clients > 1)
      steps.push({
        id: 'crowd',
        label: bi('другие покупатели', 'others'),
        caption: fmtb(bi('Вы в магазине не одни, и каждую секунду туда заходят ещё {c}. Их запросы идут к тому же серверу той же дорогой.', 'You are not alone: {c} more come every second, to the same server.'), { c: bi(shoppers(p.clients), String(p.clients)) }),
        focus: ['others', 'e-others'],
        reveal: ['others', 'e-others'],
        tokens: [{ edge: 'e-others', label: bi(`${p.clients} в секунду`, `${p.clients} a second`) }],
        say: { others: fmtb(bi('Ещё {c} в секунду отправляют такие же запросы.', '{c} more a second send the same requests.'), { c: bi(shoppers(p.clients), String(p.clients)) }) },
        states: { others: n.load > 80 ? 'warn' : 'on' },
        metrics: m(n.net),
      });
    if (broken.has('app-down')) {
      steps.push({
        id: 'refused',
        label: bi('отказ', 'refused'),
        caption: bi('Запрос дошёл до сервера, но программу магазина, которая принимает запросы, остановили. Принять запрос некому, поэтому операционная система сервера сразу отвечает браузеру отказом, и браузер узнаёт об этом за время дороги туда и обратно.', 'The request reached the server, but the shop program that takes requests was stopped. Nobody can take the request, so the server’s operating system answers the browser with a refusal at once, and the browser learns of it in the time of the road there and back.'),
        focus: ['server', 'app'],
        reveal: ['server', 'app', 'queue', 'e-net'],
        tokens: [{ edge: 'e-net', label: 'GET /catalog' }],
        say: { app: bi('Программа магазина остановлена.', 'The shop program is stopped.') },
        states: { app: 'err', queue: 'off' },
        metrics: m(n.net * 2),
        broken: { at: 'app', message: 'curl: (7) Failed to connect to shop.example port 443: Connection refused', caption: bi('Запрос остановился на сервере. Сервером называют машину вместе с работающей программой, а без программы машина может только отказать. Мгновенный отказ в жизни означает, что машина на связи, но нужная программа не запущена. Так об этой поломке сообщает программа curl, которая отправляет запросы из терминала: «не удалось подключиться к shop.example, в соединении отказано». Число 443 в сообщении служит номером, по которому браузер обращается к программе магазина.', 'The request stopped at the server. A server is the machine together with a running program, and without the program the machine can only refuse. An instant refusal means in real life that the machine is reachable but the needed program is not running. This is how curl prints this break: “failed to connect to shop.example, connection refused”. The number 443 in the message is the number by which the browser reaches the shop program.') },
      });
      return steps;
    }
    const queued = r1(n.wait / SERVICE_MS);
    if (n.overload) {
      steps.push(
        {
          id: 'queue',
          label: bi('очередь', 'queue'),
          caption: fmtb(bi('Каждую секунду приходит {c} запросов, а {s} ответить только на {k}. Очередь растёт быстрее, чем программа её разбирает, и скоро в ней не остаётся места.', '{c} requests a second, the servers manage {k}: the queue fills up.'), { c: p.clients, s: p.servers > 1 ? bi(`${p.servers} сервера успевают`, `${p.servers} servers`) : bi('сервер успевает', 'the server'), k: PER_SERVER * p.servers }),
          focus: ['e-net', 'queue'],
          reveal: ['server', 'queue', 'e-net'],
          tokens: [{ edge: 'e-net', label: 'GET /catalog' }],
          say: { queue: bi('Очередь переполнена, и новые запросы ставить некуда.', 'The queue is full.') },
          states: { queue: 'err' },
          values: { queue: tr('переполнена', 'full') },
          fill: { queue: 1 },
          metrics: m(n.net),
        },
        {
          id: 'overload',
          label: '503',
          caption: bi('Ваш запрос не поместился в очередь, и сервер сразу отвечает числом 503, которое означает «сервер перегружен». Страницы вы не получите. Помочь могут второй сервер или более лёгкие страницы, на которые уходит меньше времени.', 'Your request did not fit, and the server answers 503: “overloaded”. A second server or lighter pages would help.'),
          focus: ['e-resp', 'browser'],
          reveal: ['e-resp'],
          tokens: [{ edge: 'e-resp', label: '503 Service Unavailable' }],
          say: { browser: bi('Браузер получил ответ 503, то есть сервер перегружен.', 'The browser got 503, meaning the server is overloaded.') },
          states: { browser: 'warn' },
          metrics: m(n.net * 2 + 1),
        },
      );
      return steps;
    }
    steps.push(
      {
        id: 'queue',
        label: bi('очередь', 'queue'),
        caption:
          n.wait < 1
            ? bi('Запрос дошёл до сервера магазина. Программа почти свободна, поэтому в очереди ваш запрос почти не ждёт.', 'The request reached the server; the program is almost free, so it hardly waits.')
            : fmtb(bi('Запрос дошёл до сервера магазина. Сервер загружен на {l}%, и перед вами в очереди в среднем {q} запроса, поэтому ваш запрос ждёт {w} мс.', 'The servers are {l}% busy: {q} requests ahead on average, a wait of {w} ms.'), { l: n.load, q: ruNum(queued), w: ruNum(n.wait) }),
        focus: ['e-net', 'queue'],
        reveal: ['server', 'queue', 'e-net'],
        tokens: [{ edge: 'e-net', label: 'GET /catalog' }],
        say: {
          queue:
            n.wait < 1
              ? bi('Запрос встаёт в очередь, и перед ним почти никого нет.', 'The request queues with almost nobody ahead.')
              : fmtb(bi('Запрос встаёт в очередь и ждёт {w} мс, потому что сервер загружен на {l}%.', 'The request queues and waits {w} ms, because the server is {l}% busy.'), { w: ruNum(n.wait), l: n.load }),
        },
        states: { queue: n.load > 80 ? 'warn' : 'on' },
        values: { queue: String(queued) },
        fill: { queue: Math.min(1, queued / 20) },
        metrics: m(n.net + n.wait),
      },
      {
        id: 'take',
        label: bi('программа', 'program'),
        caption: bi('Очередь дошла до вашего запроса, и программа магазина берёт его в работу. Ей нужно узнать, какие чаи сейчас продаются и почём.', 'The program takes your request; it needs the teas and prices.'),
        focus: ['e-take', 'app'],
        reveal: ['app', 'e-take'],
        tokens: [{ edge: 'e-take', label: 'GET /catalog' }],
        say: { app: bi('Программа магазина взяла ваш запрос из очереди.', 'The shop program takes your request.') },
        states: { app: 'on' },
        metrics: m(n.net + n.wait + 1),
      },
      {
        id: 'read',
        label: bi('каталог', 'catalogue'),
        caption: bi('Программа читает из каталога названия и цены и составляет из них страницу. На всю работу с одним запросом у неё уходит около 5 мс.', 'The program reads names and prices from the catalogue and makes the page from them. All the work on one request takes it about 5 ms.'),
        focus: ['e-read', 'data'],
        reveal: ['data', 'e-read'],
        tokens: [{ edge: 'e-read', label: bi('цены чаёв', 'tea prices'), reverse: true }],
        say: { data: bi('Каталог отдаёт программе названия и цены чаёв.', 'The catalogue gives names and prices.') },
        states: { data: 'on' },
        metrics: m(n.net + n.wait + SERVICE_MS),
      },
      {
        id: 'back',
        label: bi('ответ', 'answer'),
        caption: fmtb(
          bi('Ответ «200 OK» со страницей возвращается к вам ещё {d} мс, и браузер рисует каталог. Весь путь занял {t} мс, и больше всего времени ушло {most}.', 'The answer “200 OK” with the page comes back to you in another {d} ms, and the browser draws the catalogue. The whole path took {t} ms, and most of the time went {most}.'),
          { d: n.net, t: bi(ruNum(r1(n.net * 2 + n.wait + SERVICE_MS)), String(r1(n.net * 2 + n.wait + SERVICE_MS))), most: biggest(n) },
        ),
        focus: ['e-resp', 'browser'],
        reveal: ['e-resp'],
        tokens: [{ edge: 'e-resp', label: bi('200 OK и страница', '200 OK + page') }],
        say: { browser: bi('Браузер получил ответ 200 OK и рисует каталог.', 'The browser got 200 OK and draws the page.') },
        states: { browser: 'ok' },
        metrics: m(n.net * 2 + n.wait + SERVICE_MS),
      },
    );
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const ms = (s: Step[]) => lastMetric(s, 'ms');
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку выключили, поэтому запрос снова доходит до программы магазина и получает ответ.', 'The break is off, so the request reaches the shop program again and gets an answer.');
      return change.id === 'app-down'
        ? bi('Сервер на месте, но программа не принимает запросы. Отказ приходит сразу, за время дороги туда и обратно.', 'The machine is there, but the program does not take requests: the refusal comes at once.')
        : bi('Сеть оборвана, и запросу некуда идти. Браузер узнаёт об этом, только когда истекает время ожидания.', 'The network is cut: the browser finds out only when its waiting time runs out.');
    }
    switch (change.id) {
      case 'clients': {
        const over = next.some((s) => s.id === 'overload');
        const cap = PER_SERVER * (b.servers as number);
        if (over)
          return (b.clients as number) === cap
            ? fmtb(bi('В секунду приходит {c} запросов, ровно столько, сколько успевают серверы. Запас кончился, очередь растёт без конца, и покупатели получают ответ 503 без страницы.', '{c} requests a second, exactly as many as the servers manage. There is no slack left, the queue grows without end, and the shoppers get the answer 503 without a page.'), { c: b.clients as number })
            : fmtb(bi('В секунду приходит {c} запросов, больше, чем успевают серверы. Очередь переполнилась, и покупатели получают ответ 503 без страницы.', '{c} requests a second is more than the servers manage. The queue has overflowed, and the shoppers get the answer 503 without a page.'), { c: b.clients as number });
        if (prev.some((s) => s.id === 'overload'))
          return fmtb(bi('Покупателей в секунду стало {b}, и серверы снова успевают ответить всем. Очередь больше не переполняется, и страница приходит за {t1} мс.', 'There are now {b} shoppers a second, and the servers again manage to answer everyone. The queue no longer overflows, and the page arrives in {t1} ms.'), { b: b.clients as number, t1: msb(ms(next)) });
        return fmtb(bi('Покупателей в секунду стало не {a}, а {b}, и путь запроса занимает {t1} мс вместо {t0}. Чем ближе загрузка к ста процентам, тем быстрее растёт ожидание в очереди.', 'There are now {b} shoppers a second instead of {a}, and the request’s path takes {t1} ms instead of {t0}. The closer the load is to one hundred per cent, the faster the wait in the queue grows.'), { a: a.clients as number, b: b.clients as number, t0: msb(ms(prev)), t1: msb(ms(next)) });
      }
      case 'distance':
        return fmtb(bi('Сервер теперь стоит {w}. Дорога в одну сторону занимает {d} мс, а весь путь запроса — {t} мс. Расстояние нельзя сократить ничем, кроме переезда сервера ближе к покупателям.', 'The server now stands {w}. The road one way takes {d} ms, and the whole path of the request {t} ms. Distance can be shortened by nothing except moving the server closer to the shoppers.'), { w: WHERE[b.distance as string] ?? WHERE.country, d: ONE_WAY[b.distance as string], t: msb(ms(next)) });
      case 'servers': {
        const was = prev.some((s) => s.id === 'overload');
        const now = next.some((s) => s.id === 'overload');
        const more = (b.servers as number) > (a.servers as number);
        const one = (b.servers as number) === 1;
        const nS = one ? bi('обслуживает один сервер', 'one server serves') : bi(`обслуживают ${b.servers} ${pluralRu(b.servers as number, ['сервер', 'сервера', 'серверов'])}`, `${b.servers} servers serve`);
        if ((b.servers as number) === (a.servers as number)) return bi('Число серверов не изменилось, поэтому и время ответа осталось прежним.', 'The number of servers has not changed, so the answer time has stayed the same.');
        if (now) return fmtb(bi('Теперь запросы {n}, и {who} ответить всем покупателям. Очередь переполняется, и вместо страницы приходит ответ 503.', 'Now {n} the requests, and {whoEn} cannot answer all the shoppers. The queue overflows, and the answer 503 comes instead of the page.'), { n: nS, who: one ? 'он не успевает' : 'даже вместе они не успевают', whoEn: one ? 'it' : 'even together they' });
        if (was) return fmtb(bi('Теперь запросы {n}, и сил хватает, чтобы ответить всем. Очередь больше не переполняется, и вместо ответа 503 приходит страница, за {t1} мс.', 'Now {n} the requests, and there is enough capacity to answer everyone. The queue no longer overflows, and instead of 503 the page arrives, in {t1} ms.'), { n: nS, t1: msb(ms(next)) });
        return fmtb(bi('Теперь запросы {n}. Загрузка на каждый сервер {dir}, и путь запроса занимает {t1} мс вместо {t0}.', 'Now {n} the requests. The load on each server {dirEn}, and the request’s path takes {t1} ms instead of {t0}.'), { n: nS, dir: more ? 'падает' : 'растёт', dirEn: more ? 'falls' : 'rises', t0: msb(ms(prev)), t1: msb(ms(next)) });
      }
    }
    return bi('Схема пересчитана для новых параметров.', 'The diagram is recomputed.');
  },
});
