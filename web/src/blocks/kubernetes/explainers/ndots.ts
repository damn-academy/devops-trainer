// Э9 (05 §6.11): the cost of ndots. The pod resolver appends the search
// domains to a name with fewer than ndots dots before trying it as is — so
// api.github.com with ndots:5 costs 4 rounds of A+AAAA, three of them
// NXDOMAIN, before the real answer. A trailing dot makes the name absolute.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

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

export const ndotsModel = defineModel<P>({
  id: 'k8s.ndots',
  block: 'k8s-1',
  title: bi('Короткое имя, search и цена ndots', 'A short name, search and the cost of ndots'),
  summary: bi('Резолвер пода дописывает к короткому имени домены из search. Для своих сервисов это удобно, для внешних имён — лишние запросы, пока в имени меньше ndots точек.', 'The pod resolver appends the search domains to a short name. For your own services this is handy; for external names it means extra queries while the name has fewer than ndots dots.'),
  concepts: ['k8s.cluster-dns'],
  diagram: {
    width: 960,
    height: 360,
    nodes: [
      node('app', bi('под в namespace shop', 'a pod in namespace shop'), 'process', 'box', 24, 40, 220, 56, bi('Приложение вызывает getaddrinfo(имя). Дальше работает резолвер libc/musl.', 'The application calls getaddrinfo(name). From there the libc/musl resolver works.'), bi('вы', 'you'), 'kubectl exec client -n shop -- nslookup web', D.dns),
      node('conf', '/etc/resolv.conf', 'obj', 'doc', 24, 150, 220, 120, bi('search shop.svc.cluster.local svc.cluster.local cluster.local · nameserver 10.43.0.10 · options ndots:5. Файл пишет kubelet.', 'search shop.svc.cluster.local svc.cluster.local cluster.local · nameserver 10.43.0.10 · options ndots:5. The kubelet writes this file.'), bi('kubelet (dnsPolicy: ClusterFirst)', 'the kubelet (dnsPolicy: ClusterFirst)'), 'kubectl exec client -- cat /etc/resolv.conf', D.dns, 'ndots:5'),
      node('dns', 'CoreDNS 10.43.0.10', 'l7', 'box', 380, 100, 220, 60, bi('Плагин kubernetes отвечает за зону cluster.local; остальное уходит дальше по forward.', 'The kubernetes plugin answers for the cluster.local zone; everything else goes on via forward.'), bi('kube-system', 'kube-system'), 'kubectl -n kube-system get cm coredns -o yaml', D.dns),
      node('zone', bi('зона cluster.local', 'zone cluster.local'), 'obj', 'doc', 700, 30, 230, 90, bi('Имена Service: <svc>.<ns>.svc.cluster.local → ClusterIP.', 'Service names: <svc>.<ns>.svc.cluster.local → ClusterIP.'), bi('CoreDNS из объектов API', 'CoreDNS from API objects'), undefined, D.dns),
      node('up', bi('внешний DNS', 'upstream DNS'), 'l7', 'box', 700, 200, 230, 56, bi('DNS узла (forward . /etc/resolv.conf): отвечает на api.github.com.', 'The node DNS (forward . /etc/resolv.conf): answers api.github.com.'), bi('провайдер / облако', 'the provider / cloud'), undefined, D.dns),
    ],
    edges: [
      edge('e-read', 'app', 'conf', 'search, ndots', bi('Резолвер читает список search и правило ndots.', 'The resolver reads the search list and the ndots rule.'), bi('libc', 'libc')),
      edge('e-q', 'app', 'dns', 'A + AAAA', bi('Для каждого варианта имени — два запроса: A и AAAA.', 'For every candidate name — two queries: A and AAAA.'), bi('резолвер', 'the resolver')),
      edge('e-zone', 'dns', 'zone', '*.cluster.local', bi('Имя в зоне кластера — ответ из API или NXDOMAIN.', 'A name in the cluster zone — an answer from the API or NXDOMAIN.'), bi('плагин kubernetes', 'the kubernetes plugin')),
      edge('e-fwd', 'dns', 'up', 'forward', bi('Всё остальное — вышестоящему серверу.', 'Everything else — to the upstream server.'), bi('плагин forward', 'the forward plugin')),
    ],
  },
  params: [
    {
      id: 'name',
      label: bi('Имя', 'Name'),
      kind: 'choice',
      default: 'api.github.com',
      options: [
        { id: 'web', label: bi('web', 'web') },
        { id: 'web.prod', label: bi('web.prod', 'web.prod') },
        { id: 'api.github.com', label: bi('api.github.com', 'api.github.com') },
        { id: 'api.github.com.', label: bi('api.github.com. (с точкой)', 'api.github.com. (with a dot)') },
      ],
      near: 'app',
      predict: {
        prompt: bi('Сколько DNS-запросов уйдёт для этого имени?', 'How many DNS queries will this name cost?'),
        options: [
          { id: 'two', text: bi('2 (A и AAAA)', '2 (A and AAAA)') },
          { id: 'more', text: bi('Больше двух', 'More than two') },
        ],
        resolve: (_p, n) => (metric(n, 'queries') <= 2 ? 'two' : 'more'),
      },
    },
    { id: 'ndots', label: bi('ndots', 'ndots'), kind: 'range', min: 1, max: 5, step: 1, default: 5, near: 'conf', levels: ['intermediate', 'experienced'] },
    { id: 'cache', label: bi('Повторный запрос (кэш CoreDNS)', 'A repeated query (CoreDNS cache)'), kind: 'toggle', default: false, near: 'dns', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    { id: 'no-dns', label: bi('Остановить CoreDNS', 'Stop CoreDNS'), remove: ['dns', 'e-q', 'e-zone', 'e-fwd'], layer: 'L7', boundary: 'network', predict: { prompt: bi('CoreDNS нет. curl http://10.43.12.7 сработает?', 'There is no CoreDNS. Will curl http://10.43.12.7 work?'), options: [{ id: 'yes', text: bi('Да: по адресу DNS не нужен', 'Yes: an address needs no DNS') }, { id: 'no', text: bi('Нет', 'No') }], resolve: () => 'yes' } },
    { id: 'no-forward', label: bi('Удалить forward из Corefile', 'Remove forward from the Corefile'), remove: ['e-fwd'], layer: 'L7', boundary: 'network', predict: { prompt: bi('forward удалён. Что сломается?', 'forward is gone. What breaks?'), options: [{ id: 'external', text: bi('Только внешние имена', 'Only external names') }, { id: 'all', text: bi('Все имена', 'All names') }], resolve: () => 'external' } },
  ],
  metrics: [
    { id: 'queries', label: bi('запросов к CoreDNS', 'queries to CoreDNS') },
    { id: 'nx', label: bi('из них NXDOMAIN', 'of them NXDOMAIN') },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    const r = lookupOrder(p.name, p.ndots);
    const dots = (p.name.replace(/\.$/, '').match(/\./g) ?? []).length;
    s.push({ id: 'read', label: 'resolv.conf', caption: p.name.endsWith('.') ? bi('Имя оканчивается точкой — оно абсолютное: search не применяется.', 'The name ends with a dot — it is absolute: search does not apply.') : dots >= p.ndots
          ? fmt(bi('В имени {d} точ(ки), ndots:{n}: сначала имя как есть, потом с доменами search.', 'The name has {d} dot(s), ndots:{n}: first the name as is, then with the search domains.'), { d: dots, n: p.ndots })
          : fmt(bi('В имени {d} точ(ки) — меньше ndots:{n}: сначала с каждым доменом search, и только потом как есть.', 'The name has {d} dot(s) — fewer than ndots:{n}: first with every search domain, and only then as is.'), { d: dots, n: p.ndots }),
      focus: ['app', 'e-read', 'conf'], values: { conf: `ndots:${p.ndots}` }, metrics: { queries: 0, nx: 0 } });
    if (broken.has('no-dns')) {
      s.push({ id: 'timeout', label: 'timeout', caption: bi('На 10.43.0.10 никто не отвечает.', 'Nobody answers at 10.43.0.10.'), focus: ['e-q'], states: { dns: 'off' }, metrics: { queries: 2, nx: 0 }, broken: { at: 'dns', message: ';; connection timed out; no servers could be reached\ncurl: (6) Could not resolve host: web', caption: bi('имена не работают, адреса работают: curl http://10.43.12.7 отвечает — значит, сломан DNS, а не Service.', 'names fail, addresses work: curl http://10.43.12.7 answers — so DNS is broken, not the Service.') } });
      return s;
    }
    if (p.cache) {
      s.push({ id: 'cache', label: 'cache', caption: bi('Тот же запрос недавно уже был: CoreDNS отвечает из кэша (cache 30), до зоны и до forward дело не доходит. Но резолвер пода всё равно перебирает те же варианты.', 'The same query was asked recently: CoreDNS answers from its cache (cache 30), neither the zone nor forward is asked. But the pod resolver still walks the same candidates.'), focus: ['dns'], metrics: { queries: r.tries.length * 2, nx: (r.tries.length - (r.answer ? 1 : 0)) * 2 } });
      return s;
    }
    let q = 0;
    let nx = 0;
    for (const t of r.tries) {
      q += 2;
      const inZone = t.endsWith('cluster.local');
      const ok = t === r.answer;
      if (!ok) nx += 2;
      if (!inZone && broken.has('no-forward')) {
        s.push({ id: `q-${q}`, label: t.length > 20 ? t.slice(0, 18) + '…' : t, caption: fmt(bi('{t}: имя вне зоны кластера, а forward удалён — CoreDNS отвечает SERVFAIL.', '{t}: the name is outside the cluster zone, and forward is gone — CoreDNS answers SERVFAIL.'), { t }), focus: ['e-q', 'dns'], states: { 'e-fwd': 'err' }, metrics: { queries: q, nx }, broken: { at: 'e-fwd', message: `** server can't find ${t}: SERVFAIL`, caption: bi('внутренние имена работают, внешние — нет: смотрите Corefile (kubectl -n kube-system get cm coredns -o yaml).', 'internal names work, external ones do not: look at the Corefile (kubectl -n kube-system get cm coredns -o yaml).') } });
        return s;
      }
      s.push({
        id: `q-${q}`,
        label: t.length > 20 ? t.slice(0, 18) + '…' : t,
        caption: ok ? fmt(bi('{t} → {ip}: ответ. Всего {q} запросов.', '{t} → {ip}: an answer. {q} queries in total.'), { t, ip: KNOWN[t], q }) : fmt(bi('{t} → NXDOMAIN (A и AAAA).', '{t} → NXDOMAIN (A and AAAA).'), { t }),
        focus: ['e-q', 'dns', inZone ? 'e-zone' : 'e-fwd'],
        tokens: [{ edge: 'e-q', label: 'A, AAAA' }, { edge: inZone ? 'e-zone' : 'e-fwd' }],
        states: { [inZone ? 'zone' : 'up']: ok ? 'ok' : 'warn' },
        metrics: { queries: q, nx },
      });
    }
    if (!r.answer) s.push({ id: 'fail', label: 'NXDOMAIN', caption: bi('Ни один вариант не нашёлся: getaddrinfo возвращает ошибку.', 'No candidate was found: getaddrinfo returns an error.'), focus: ['app'], states: { app: 'err' }, metrics: { queries: q, nx } });
    return s;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Поломка DNS: путь остановился на CoreDNS.', 'A DNS break: the path stopped at CoreDNS.') : bi('DNS снова работает.', 'DNS works again.');
    switch (change.id) {
      case 'name':
      case 'ndots':
        return fmt(bi('{n} с ndots:{d}: {q} запросов, {x} из них NXDOMAIN (было {q0}).', '{n} with ndots:{d}: {q} queries, {x} of them NXDOMAIN (was {q0}).'), { n: b.name as string, d: b.ndots as number, q: metric(next, 'queries'), x: metric(next, 'nx'), q0: metric(prev, 'queries') });
      case 'cache':
        return b.cache ? bi('Кэш экономит работу CoreDNS, но не запросы пода: перебор search всё равно идёт.', 'The cache saves CoreDNS work, but not the pod’s queries: the search walk still happens.') : bi('Без кэша каждый вариант доходит до зоны или до forward.', 'Without the cache every candidate reaches the zone or forward.');
    }
    return bi('Пересчитано.', 'Recomputed.');
  },
});
