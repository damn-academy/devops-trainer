// The route map of the Networks block for learners who know part of it: one
// row per lesson with a link, what the lesson gives for work and what
// interviews ask about it, so that a learner can skip what the placement
// check credited and still see where every lesson sits in the whole model.

import { h } from '../../../core/dom';
import { bi, onLangChange, t, type Bi } from '../../../core/i18n';
import type { Lesson, Mounted, WidgetCtx, WidgetReg } from '../../../core/types';
import { arp, frames, routing, subnets } from '../lessons-a';
import { dns, envelopes, transport } from '../lessons-b';
import { nat, proxy, tls, troubleshooting } from '../lessons-c';
import { vpn } from '../lessons-e';

interface Row {
  lesson: Lesson;
  work: Bi;
  asked: Bi;
}

export const ROUTE_ROWS: Row[] = [
  {
    lesson: frames,
    work: bi('Как увидеть кадры командой `tcpdump -e` и почему коммутатор молчит об ошибках.', 'How to see frames with `tcpdump -e` and why a switch is silent about errors.'),
    asked: bi('Чем коммутатор отличается от маршрутизатора?', 'How does a switch differ from a router?'),
  },
  {
    lesson: subnets,
    work: bi('Как разделить выданный блок на подсети и почему маску не угадывают по адресу.', 'How to split a given block into subnets and why the mask is not guessed from the address.'),
    asked: bi('Сколько машин помещается в /26 и как разрезать /22 на шесть сетей?', 'How many machines fit into a /26, and how do you cut a /22 into six networks?'),
  },
  {
    lesson: arp,
    work: bi('Почему ping пишет Destination Host Unreachable с вашего же адреса.', 'Why ping prints Destination Host Unreachable from your own address.'),
    asked: bi('Что происходит до первого эхо-запроса к соседу?', 'What happens before the first echo request to a neighbour?'),
  },
  {
    lesson: routing,
    work: bi('Как командой `ip route get` узнать, какую строку таблицы выберет ядро, зачем пакету TTL и как распознать пинг в одну сторону.', '`ip route get`, picking a line by the longest prefix, TTL and the one-way ping.'),
    asked: bi('Как работает traceroute и что значит строка со звёздочками?', 'How does traceroute work, and what does a line of asterisks mean?'),
  },
  {
    lesson: transport,
    work: bi('Как отличить отказ от тишины и что значат коды curl 7 и 28.', 'How to tell a refusal from silence and what curl codes 7 and 28 mean.'),
    asked: bi('Чем TCP отличается от UDP и как устроено рукопожатие?', 'How does TCP differ from UDP, and how does the handshake work?'),
  },
  {
    lesson: envelopes,
    work: bi('MTU и MSS, а также почему маленькие пакеты проходят, а большие пропадают.', 'MTU and MSS, and why small packets pass while big ones vanish.'),
    asked: bi('Какие уровни у модели OSI и где в ней работает ваш сервис?', 'What are the layers of the OSI model, and where does your service sit in it?'),
  },
  {
    lesson: dns,
    work: bi('Чем резолвер отличается от авторитативного сервера, что означает TTL записи и как пройти путь имени командой `dig +trace`.', 'The resolver against the authoritative server, TTL and `dig +trace`.'),
    asked: bi('Почему после смены адреса сайт сутки открывается по-старому?', 'Why does a site keep opening at the old address for a day after a move?'),
  },
  {
    lesson: nat,
    work: bi('Цепочки netfilter, conntrack и проброс порта, на которых построены сети Docker и Kubernetes.', 'netfilter chains, conntrack and port forwarding, on which Docker and Kubernetes networking are built.'),
    asked: bi('Почему к ноутбуку за домашним роутером нельзя подключиться снаружи?', 'Why can nobody connect from outside to a laptop behind a home router?'),
  },
  {
    lesson: tls,
    work: bi('Цепочка сертификатов, три ошибки curl с кодом 60 и что проверить в nginx.', 'The certificate chain, the three curl errors with code 60 and what to check in nginx.'),
    asked: bi('Что видит посторонний в соединении HTTPS?', 'What does an outsider see of an HTTPS connection?'),
  },
  {
    lesson: proxy,
    work: bi('Кто пишет 502 и 504, когда nginx повторяет запрос и как то же устроено с PHP-FPM.', 'Who writes 502 and 504, when nginx retries a request and how the same works with PHP-FPM.'),
    asked: bi('Пользователь получил 504: где искать причину?', 'A user got a 504: where do you look for the cause?'),
  },
  {
    lesson: vpn,
    work: bi('Маршруты туннеля, его цена в MTU и поиск неисправности командой `wg show`.', 'The tunnel’s routes, its cost in MTU and troubleshooting with `wg show`.'),
    asked: bi('Чем VPN отличается от прокси?', 'How does a VPN differ from a proxy?'),
  },
  {
    lesson: troubleshooting,
    work: bi('Схема всего пути страницы и порядок поиска неисправности по сообщению об ошибке.', 'The diagram of a page’s whole path and the order of troubleshooting from an error message.'),
    asked: bi('Что происходит, когда вы вводите адрес сайта и нажимаете Enter?', 'What happens when you type a site’s address and press Enter?'),
  },
];

function mount(el: HTMLElement, ctx: WidgetCtx): Mounted {
  const root = h('section.net-route-map');
  el.append(root);
  const render = () => {
    root.replaceChildren(
      h(
        'table.net-route-table',
        {},
        h('thead', {}, h('tr', {}, h('th', {}, t(bi('Урок', 'Lesson'))), h('th', {}, t(bi('Что он даёт для работы', 'What it gives for work'))), h('th', {}, t(bi('О чём спрашивают на собеседовании', 'What interviews ask'))))),
        h('tbody', {}, ...ROUTE_ROWS.map((r) => h('tr', {}, h('td', {}, h('a', { href: `#/lesson/${encodeURIComponent(r.lesson.id)}` }, t(r.lesson.title))), h('td', { 'data-label': t(bi('Для работы', 'For work')) }, t(r.work).replace(/`/g, '')), h('td', { 'data-label': t(bi('На собеседовании', 'At an interview')) }, t(r.asked))))),
      ),
    );
  };
  const off = onLangChange(render);
  render();
  ctx.complete();
  return { dispose: () => { off(); root.remove(); }, describe: () => 'route map of the Networks block' };
}

export const routeMapWidget: WidgetReg = { id: 'net.route-map', mount: (el, _props, ctx) => mount(el, ctx) };
