// Э9 (05 §6.11): the cost of ndots. The pod resolver appends the search
// domains to a name with fewer than ndots dots before trying it as is — so
// api.github.com with ndots:5 costs 4 rounds of A+AAAA, three of them
// NXDOMAIN, before the real answer. A trailing dot makes the name absolute.
//
// Reading order: at first only the pod and its resolv.conf are on screen;
// CoreDNS, the cluster zone and the upstream DNS appear when a query reaches
// them, and every query is a card with the name being tried.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, fmtb, idsOf, LEGEND_BASE, mark, metric, num, only } from './kit';

type P = { name: string; ndots: number; cache: boolean };

const SEARCH = ['shop.svc.cluster.local', 'svc.cluster.local', 'cluster.local'];
const KNOWN: Record<string, string> = { 'web.shop.svc.cluster.local': '10.43.12.7', 'web.prod.svc.cluster.local': '10.43.40.2', 'api.github.com': '140.82.121.6' };

/** The names the resolver tries, in order, and the first that answers. */
export function lookupOrder(name: string, ndots: number): { tries: string[]; answer: string | null } {
  if (name.endsWith('.')) {
    const n = name.slice(0, -1);
    return { tries: [n], answer: KNOWN[n] ? n : null };
  }
  const dots = (name.match(/\./g) ?? []).length;
  const expanded = SEARCH.map((s) => `${name}.${s}`);
  const tries = dots >= ndots ? [name, ...expanded] : [...expanded, name];
  const out: string[] = [];
  for (const t of tries) {
    out.push(t);
    if (KNOWN[t]) return { tries: out, answer: t };
  }
  return { tries: out, answer: null };
}

const diagram = {
  width: 960,
  height: 360,
  nodes: [
    box('app', bi('Под в namespace shop', 'A pod in namespace shop'), 'process', 'box', [24, 40, 230, 56], 'container', bi('Приложение в поде просит адрес имени у резолвера своей системной библиотеки (вызов getaddrinfo). Дальше всё делает резолвер.', 'The application calls getaddrinfo; the resolver does the rest.'), bi('Под запустили вы.', 'You started it.'), { see: 'kubectl exec client -n shop -- nslookup web', doc: D.dns }),
    box('conf', '/etc/resolv.conf', 'obj', 'doc', [24, 160, 230, 110], 'file', bi('Настройки резолвера пода: список доменов search (shop.svc.cluster.local, svc.cluster.local, cluster.local), адрес сервера имён 10.43.0.10 и правило ndots:5. Если в имени меньше точек, чем ndots, резолвер сначала пробует дописать к нему домены из search.', 'search domains, nameserver 10.43.0.10 and ndots:5: names with fewer dots get the search domains first.'), bi('Файл пишет kubelet при создании пода (dnsPolicy: ClusterFirst).', 'The kubelet writes it (dnsPolicy: ClusterFirst).'), { see: 'kubectl exec client -- cat /etc/resolv.conf', doc: D.dns, sub: 'ndots:5' }),
    box('dns', 'CoreDNS 10.43.0.10', 'l7', 'box', [380, 190, 230, 60], 'dns', bi('Сервер имён кластера. На имена в зоне cluster.local он отвечает сам, а остальные вопросы пересылает внешнему серверу.', 'Answers cluster.local itself, forwards everything else.'), bi('Работает подами в namespace kube-system.', 'Pods in kube-system.'), { see: 'kubectl -n kube-system get cm coredns -o yaml', doc: D.dns }),
    box('zone', bi('Зона cluster.local', 'Zone cluster.local'), 'obj', 'doc', [700, 30, 236, 90], 'database', bi('Имена всех Service кластера вида <имя>.<namespace>.svc.cluster.local и их адреса ClusterIP.', 'Every Service name <svc>.<ns>.svc.cluster.local and its ClusterIP.'), bi('Зону CoreDNS строит из объектов API.', 'CoreDNS builds it from the API.'), { doc: D.dns }),
    box('up', bi('Внешний сервер DNS', 'Upstream DNS'), 'l7', 'box', [700, 280, 236, 60], 'cloud', bi('Сервер имён, который указан у самого узла. Он отвечает на внешние имена вроде api.github.com.', 'The node’s DNS; answers external names like api.github.com.'), bi('Сервер даёт провайдер или облако.', 'The provider or cloud.'), { doc: D.dns }),
  ],
  edges: [
    edge('e-read', 'app', 'conf', bi('правила поиска', 'search rules'), bi('Резолвер читает список search и правило ndots.', 'The resolver reads search and ndots.'), bi('Читает резолвер библиотеки libc.', 'The libc resolver.')),
    edge('e-q', 'app', 'dns', bi('вопрос A и AAAA', 'A and AAAA query'), bi('Для каждого варианта имени уходит два вопроса: адрес IPv4 (A) и адрес IPv6 (AAAA).', 'Two queries per candidate: A and AAAA.'), bi('Спрашивает резолвер пода.', 'The pod’s resolver.'), { via: [[317, 68], [317, 220]] }),
    edge('e-zone', 'dns', 'zone', bi('имя кластера', 'cluster name'), bi('Для имени в зоне кластера CoreDNS отвечает адресом из API или ответом NXDOMAIN, то есть «такого имени нет».', 'A cluster name: an answer or NXDOMAIN.'), bi('Отвечает плагин kubernetes в CoreDNS.', 'The kubernetes plugin.')),
    edge('e-fwd', 'dns', 'up', bi('внешнее имя', 'external name'), bi('Остальные имена CoreDNS пересылает внешнему серверу.', 'Everything else goes upstream.'), bi('Пересылает плагин forward в CoreDNS.', 'The forward plugin.')),
  ],
};

const ALL = idsOf(diagram);
const short = (t: string) => (t.length > 22 ? t.slice(0, 20) + '…' : t);

export const ndotsModel = defineModel<P>({
  id: 'k8s.ndots',
  block: 'k8s-1',
  title: bi('Как под ищет адрес по короткому имени', 'How a pod looks up a short name'),
  summary: bi(
    'Резолвер пода дописывает к имени домены из списка search, пока в имени меньше точек, чем задано в ndots. Для своих сервисов это удобно, потому что достаточно написать web. Для внешних имён это оборачивается лишними запросами, и прежде чем спросить api.github.com как есть, резолвер трижды получит ответ «такого имени нет».',
    'The pod resolver appends the search domains while the name has fewer dots than ndots: handy for your services, costly for external names.',
  ),
  intro: bi(
    'Сейчас на схеме под и его файл /etc/resolv.conf. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Приложение попросит адрес api.github.com, и каждый шаг будет одним вариантом имени, который резолвер отправляет в CoreDNS. Имя написано на карточке, которая движется по линии. Следите за счётчиком запросов под схемой, а потом выбирайте в «Параметрах» другие имена.',
    'For now: the pod and its /etc/resolv.conf. Press “Start from the first step” and go on with “Step forward”: the application asks for api.github.com, and each step is one candidate name sent to CoreDNS, written on the card. Watch the query counter, then pick other names in “Parameters”.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:container', 'под, который ищет адрес', 'the pod looking up a name'),
    mark('icon:file', 'настройки резолвера пода', 'the pod’s resolver settings'),
    mark('icon:dns', 'сервер имён CoreDNS', 'CoreDNS'),
    mark('ok', 'имя нашлось', 'the name was found'),
    mark('warn', 'ответ «такого имени нет» (NXDOMAIN)', 'NXDOMAIN'),
  ],
  stopLabel: bi('Поиск имени остановился', 'The lookup stopped'),
  concepts: ['k8s.cluster-dns'],
  diagram,
  params: [
    {
      id: 'name',
      label: bi('Какое имя ищет приложение', 'The name the application looks up'),
      kind: 'choice',
      default: 'api.github.com',
      group: bi('Запрос приложения', 'The application’s query'),
      options: [
        { id: 'web', label: bi('web, сервис в том же namespace', 'web, a Service in the same namespace') },
        { id: 'web.prod', label: bi('web.prod, сервис в namespace prod', 'web.prod, in namespace prod') },
        { id: 'api.github.com', label: bi('api.github.com, внешнее имя', 'api.github.com, external') },
        { id: 'api.github.com.', label: bi('api.github.com. с точкой на конце', 'api.github.com. with a final dot') },
      ],
      near: 'app',
      predict: {
        prompt: bi('Вы выбрали другое имя, а ndots по-прежнему равен 5. Сколько запросов уйдёт в CoreDNS, пока резолвер найдёт ответ или сдастся?', 'Another name, ndots still 5. How many queries go to CoreDNS?'),
        options: [
          { id: 'two', text: bi('Два, то есть A и AAAA для самого имени', 'Two: A and AAAA for the name') },
          { id: 'more', text: bi('Больше двух', 'More than two') },
        ],
        resolve: (_p, n) => (metric(n, 'queries') <= 2 ? 'two' : 'more'),
      },
    },
    { id: 'ndots', label: bi('Сколько точек нужно в имени, чтобы сначала пробовать его как есть (ndots)', 'Dots needed to try the name as is first (ndots)'), kind: 'range', min: 1, max: 5, step: 1, default: 5, near: 'conf', levels: ['intermediate', 'experienced'], group: bi('Настройки резолвера и CoreDNS', 'Resolver and CoreDNS settings') },
    { id: 'cache', label: bi('Такой же запрос недавно уже задавали, и ответ лежит в кэше CoreDNS', 'The same query was asked recently, and the answer is in the CoreDNS cache'), kind: 'toggle', default: false, near: 'dns', levels: ['intermediate', 'experienced'], group: bi('Настройки резолвера и CoreDNS', 'Resolver and CoreDNS settings') },
  ],
  breaks: [
    { id: 'no-dns', label: bi('CoreDNS не работает', 'CoreDNS is down'), remove: ['dns', 'e-q', 'e-zone', 'e-fwd'], layer: 'L7', boundary: 'network', predict: { prompt: bi('CoreDNS не работает. Ответит ли сервис, если обратиться к нему по адресу, командой `curl http://10.43.12.7`?', 'CoreDNS is down. Does `curl http://10.43.12.7` work?'), options: [{ id: 'yes', text: bi('Да, потому что для обращения по адресу DNS не нужен', 'Yes, because an address needs no DNS') }, { id: 'no', text: bi('Нет, потому что без DNS не работает ничего', 'No, because nothing works without DNS') }], resolve: () => 'yes' } },
    { id: 'no-forward', label: bi('Из настроек CoreDNS удалена пересылка внешних имён (forward)', 'forward removed from the Corefile'), remove: ['e-fwd'], layer: 'L7', boundary: 'network', predict: { prompt: bi('Из настроек CoreDNS удалили пересылку внешних имён. Какие имена перестанут находиться?', 'forward is gone. Which names stop resolving?'), options: [{ id: 'external', text: bi('Только внешние, вроде api.github.com', 'Only external ones') }, { id: 'all', text: bi('Все имена, включая сервисы кластера', 'All names') }], resolve: () => 'external' } },
  ],
  metrics: [
    { id: 'queries', label: bi('запросов к CoreDNS', 'queries to CoreDNS') },
    { id: 'nx', label: bi('из них с ответом «такого имени нет»', 'of them NXDOMAIN') },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    const r = lookupOrder(p.name, p.ndots);
    // scrub tick: the search domain the resolver appended (without the shared .cluster.local), or the name as is
    const tick = (t: string) => (t.startsWith(`${p.name}.`) ? t.slice(p.name.length + 1).replace(/\.cluster\.local$/, '') : bi('как есть', 'as is'));
    const dots = (p.name.replace(/\.$/, '').match(/\./g) ?? []).length;
    const dotsBi = num(dots, ['точка', 'точки', 'точек'], ['dot', 'dots']);
    s.push({
      id: 'ask',
      label: bi('имя', 'name'),
      caption: fmt(bi('Приложение в поде хочет обратиться к {n} и просит у резолвера адрес этого имени.', 'The application asks the resolver for {n}.'), { n: p.name }),
      focus: ['app'],
      say: { app: fmt(bi('Приложение просит адрес имени {n}.', 'The application asks for {n}.'), { n: p.name }) },
      states: only(ALL, 'app', 'conf'),
      metrics: { queries: 0, nx: 0 },
    });
    s.push({
      id: 'read',
      label: 'resolv.conf',
      caption: p.name.endsWith('.')
        ? bi('Имя заканчивается точкой, а значит, оно абсолютное, и резолвер не дописывает к нему домены из search и сразу спрашивает его как есть.', 'A final dot makes the name absolute: no search domains.')
        : dots >= p.ndots
          ? fmtb(bi('В имени {d}, а ndots равен {n}. Точек достаточно, поэтому резолвер сначала спросит имя как есть и только потом с доменами из search.', '{d}, ndots {n}: the name as is first, then with search.'), { d: dotsBi, n: p.ndots })
          : fmtb(bi('В имени {d}, а ndots равен {n}. Точек меньше, поэтому резолвер сначала по очереди допишет к имени каждый домен из search и только в конце спросит имя как есть.', '{d}, fewer than ndots {n}: every search domain first, the name as is last.'), { d: dotsBi, n: p.ndots }),
      focus: ['conf', 'e-read'],
      reveal: ['e-read'],
      tokens: [{ edge: 'e-read', label: `ndots:${p.ndots}` }],
      say: { conf: fmt(bi('В файле resolv.conf записаны три домена поиска (search) и правило ndots:{n}.', 'resolv.conf: three search domains, ndots:{n}.'), { n: p.ndots }) },
      values: { conf: `ndots:${p.ndots}` },
      metrics: { queries: 0, nx: 0 },
    });
    if (broken.has('no-dns')) {
      s.push({
        id: 'timeout',
        label: bi('тишина', 'silence'),
        caption: bi('Резолвер отправляет вопрос на 10.43.0.10, но там никто не отвечает, и через несколько секунд он сдаётся.', 'Nobody answers at 10.43.0.10; the resolver gives up.'),
        focus: ['app', 'e-q'],
        reveal: ['dns', 'e-q'],
        say: { app: bi('Резолвер ждёт ответа от 10.43.0.10 и не дожидается.', 'The resolver waits in vain.') },
        states: { dns: 'err' },
        metrics: { queries: 2, nx: 0 },
        broken: { at: 'dns', message: ';; connection timed out; no servers could be reached\ncurl: (6) Could not resolve host: web', caption: bi('на сервере имён. Такую поломку узнают по тому, что по именам ничего не работает, а по адресам всё работает. Если `curl http://10.43.12.7` отвечает, сломан DNS, а не Service.', 'at the name server: names fail, addresses work; if `curl http://10.43.12.7` answers, DNS is broken, not the Service.') },
      });
      return s;
    }
    if (p.cache) {
      s.push({
        id: 'cache',
        label: bi('кэш', 'cache'),
        caption: bi('Такой же запрос недавно уже был, и CoreDNS отвечает из своего кэша, не спрашивая ни зону кластера, ни внешний сервер. Но резолвер пода всё равно перебирает те же варианты имени, поэтому запросов от пода столько же.', 'CoreDNS answers from its cache, but the pod still walks the same candidates.'),
        focus: ['dns', 'e-q'],
        reveal: ['dns', 'e-q'],
        tokens: [{ edge: 'e-q', label: short(r.tries[0]) }],
        say: { dns: bi('CoreDNS отвечает на все варианты имени из своего кэша.', 'CoreDNS answers every candidate from its cache.') },
        metrics: { queries: r.tries.length * 2, nx: (r.tries.length - (r.answer ? 1 : 0)) * 2 },
      });
      return s;
    }
    let q = 0;
    let nx = 0;
    for (const t of r.tries) {
      q += 2;
      const inZone = t.endsWith('cluster.local');
      const ok = t === r.answer;
      if (!ok) nx += 2;
      const where = inZone ? 'e-zone' : 'e-fwd';
      if (!inZone && broken.has('no-forward')) {
        s.push({
          id: `q-${q}`,
          label: tick(t),
          caption: fmt(bi('Имя {t} лежит вне зоны кластера, а пересылать внешние имена CoreDNS больше не умеет, поэтому отвечает SERVFAIL: «не могу получить ответ».', '{t} is outside the cluster zone and forward is gone: SERVFAIL.'), { t }),
          focus: ['dns', 'e-q'],
          reveal: ['dns', 'e-q', 'up', 'e-fwd'],
          tokens: [{ edge: 'e-q', label: short(t) }],
          say: { dns: fmt(bi('CoreDNS не знает, куда переслать вопрос о {t}.', 'CoreDNS has nowhere to forward {t}.'), { t }) },
          states: { 'e-fwd': 'err' },
          metrics: { queries: q, nx },
          broken: { at: 'e-fwd', message: `** server can't find ${t}: SERVFAIL`, caption: bi('на пересылке. Имена сервисов кластера находятся, а внешние нет, поэтому смотрите настройки CoreDNS командой `kubectl -n kube-system get cm coredns -o yaml`.', 'at forwarding: internal names work, external do not; check the Corefile.') },
        });
        return s;
      }
      s.push({
        id: `q-${q}`,
        label: tick(t),
        caption: ok
          ? fmt(bi('Вариант {t} нашёлся, и CoreDNS отвечает адресом {ip}. Всего на поиск ушло {q} запросов.', '{t} → {ip}. {q} queries in all.'), { t, ip: KNOWN[t], q })
          : fmt(bi('Резолвер спрашивает {t}, и CoreDNS отвечает NXDOMAIN, то есть «такого имени нет», и на вопрос A, и на вопрос AAAA. Резолвер переходит к следующему варианту.', '{t}: NXDOMAIN for A and AAAA; the next candidate.'), { t }),
        focus: ['dns', 'e-q', where],
        reveal: ['dns', 'e-q', inZone ? 'zone' : 'up', where],
        tokens: [{ edge: 'e-q', label: short(t) }],
        say: { dns: ok ? fmt(bi('CoreDNS находит {t} и отвечает адресом {ip}.', 'CoreDNS finds {t}: {ip}.'), { t: short(t), ip: KNOWN[t] }) : fmt(bi('CoreDNS не находит {t} и отвечает NXDOMAIN.', 'CoreDNS: no {t}, NXDOMAIN.'), { t: short(t) }) },
        states: { [inZone ? 'zone' : 'up']: ok ? 'ok' : 'warn' },
        metrics: { queries: q, nx },
      });
    }
    if (!r.answer)
      s.push({
        id: 'fail',
        label: 'NXDOMAIN',
        caption: bi('Ни один вариант имени не нашёлся, и вызов getaddrinfo возвращает приложению ошибку.', 'No candidate was found: getaddrinfo fails.'),
        focus: ['app'],
        say: { app: bi('Приложение получает ошибку о том, что имя не найдено.', 'The application gets “not found”.') },
        states: { app: 'err' },
        metrics: { queries: q, nx },
      });
    return s;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Поломка DNS: поиск имени остановился на CoreDNS.', 'A DNS break: the lookup stopped at CoreDNS.') : bi('DNS снова работает.', 'DNS works again.');
    switch (change.id) {
      case 'name':
      case 'ndots':
        return fmt(bi('Имя {n} при ndots:{d} стоит {q} запросов, и на {x} из них ответ «такого имени нет». Раньше было {q0}.', '{n} with ndots:{d}: {q} queries, {x} NXDOMAIN (was {q0}).'), { n: b.name as string, d: b.ndots as number, q: metric(next, 'queries'), x: metric(next, 'nx'), q0: metric(prev, 'queries') });
      case 'cache':
        return b.cache ? bi('Кэш экономит работу CoreDNS, но не запросы пода, потому что перебор доменов search всё равно идёт.', 'The cache saves CoreDNS work, not the pod’s queries.') : bi('Без кэша каждый вариант доходит до зоны кластера или до внешнего сервера.', 'Without the cache every candidate goes to the zone or upstream.');
    }
    return bi('Пересчитано.', 'Recomputed.');
  },
});
