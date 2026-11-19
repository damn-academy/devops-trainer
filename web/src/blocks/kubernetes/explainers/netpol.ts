// Э10 (05 §6.12): NetworkPolicy as a matrix "from × to". Three pods knock on
// the payment service; one of them also goes to the internet. Switching the
// policy recolours every connection at once and says which policy let it in
// or dropped it. Knobs: the policy itself (none, default-deny, AND, OR),
// a default-deny egress in shop with or without the DNS rule, and the CNI
// that is supposed to enforce all of it (plain flannel enforces nothing).

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

type P = { policy: string; egress: boolean; dns: boolean; cni: string };

export interface Flow {
  id: 'fe' | 'cl' | 'dbg' | 'net';
  edge: string;
  allowed: boolean;
  /** Which stage decided: dns (egress to CoreDNS), egress (leaving the source), ingress (entering pay), none. */
  at: 'dns' | 'egress' | 'ingress' | 'open';
  why: Bi;
}

const POLICY_TEXT: Record<string, string> = {
  none: '—',
  deny: 'podSelector: {}',
  and: 'ns AND pod',
  or: 'ns OR pod',
};

/** Who reaches what under the given knobs and breaks. Shared by the steps and the tests. */
export function netpolFlows(p: P, broken: ReadonlySet<string> = new Set()): Flow[] {
  const enforced = p.cni !== 'flannel';
  const typo = broken.has('typo');
  const badPort = broken.has('port');
  const src = {
    fe: { ns: 'shop', role: 'frontend' },
    cl: { ns: 'shop', role: '' },
    dbg: { ns: 'dev', role: 'frontend' },
  } as const;
  const ingress = (k: keyof typeof src): { ok: boolean; why: Bi } => {
    if (!enforced) return { ok: true, why: bi('Политика есть в API, но flannel её не исполняет: пакет проходит.', 'The policy is in the API, but flannel does not enforce it: the packet passes.') };
    const s = src[k];
    if (p.policy === 'none') return { ok: true, why: bi('Ни одна политика не выбирает под pay — он открыт для всех.', 'No policy selects the pay pod — it is open to everyone.') };
    if (p.policy === 'deny') return { ok: false, why: bi('default-deny выбрал все поды pay и не разрешил ничего.', 'default-deny selected every pod of pay and allowed nothing.') };
    if (badPort) return { ok: false, why: bi('Правило разрешает порт 8080, а под слушает 80: под это правило не подходит ни один пакет.', 'The rule allows port 8080, but the pod listens on 80: no packet matches the rule.') };
    const nsOk = !typo && s.ns === 'shop';
    const roleOk = s.role === 'frontend';
    if (p.policy === 'and') {
      if (nsOk && roleOk) return { ok: true, why: bi('Один элемент from: namespace shop **и** role=frontend — оба условия выполнены.', 'One from item: namespace shop **and** role=frontend — both conditions hold.') };
      if (typo && s.ns === 'shop') return { ok: false, why: bi('В namespaceSelector опечатка (shopp): такого namespace нет, условие не выполняется ни для кого.', 'The namespaceSelector has a typo (shopp): there is no such namespace, the condition holds for nobody.') };
      return { ok: false, why: s.ns !== 'shop' ? bi('role=frontend есть, но namespace не shop: в одном элементе нужны оба условия.', 'role=frontend is there, but the namespace is not shop: one item needs both conditions.') : bi('Namespace shop, но метки role=frontend нет.', 'Namespace shop, but no role=frontend label.') };
    }
    // or: two items; a podSelector without namespaceSelector means "pods of the policy's own namespace" (pay)
    if (nsOk) return { ok: true, why: bi('Первый элемент from: любой под из namespace shop.', 'The first from item: any pod of namespace shop.') };
    return {
      ok: false,
      why: typo
        ? bi('Опечатка в namespaceSelector отрезала shop, а второй элемент — podSelector без namespaceSelector — выбирает поды только в самом pay.', 'The typo in namespaceSelector cut shop off, and the second item — a podSelector without a namespaceSelector — selects pods of pay itself only.')
        : bi('Второй элемент — podSelector без namespaceSelector — выбирает поды с role=frontend только в namespace самой политики, pay. debug живёт в dev.', 'The second item — a podSelector without a namespaceSelector — selects role=frontend pods only in the policy’s own namespace, pay. debug lives in dev.'),
    };
  };
  const egressBlocked = (k: 'fe' | 'cl' | 'dbg') => enforced && p.egress && src[k].ns === 'shop';
  const flows: Flow[] = [];
  for (const k of ['fe', 'cl', 'dbg'] as const) {
    const e = `e-${k}`;
    if (egressBlocked(k) && !p.dns) {
      flows.push({ id: k, edge: e, allowed: false, at: 'dns', why: bi('Egress-политика shop не разрешает UDP 53 к CoreDNS: имя pay.pay не резолвится, до TCP дело не доходит.', 'The egress policy of shop does not allow UDP 53 to CoreDNS: the name pay.pay does not resolve, TCP never starts.') });
      continue;
    }
    const ing = ingress(k);
    flows.push({ id: k, edge: e, allowed: ing.ok, at: p.policy === 'none' || !enforced ? 'open' : 'ingress', why: egressBlocked(k) ? { ru: `Egress пропустил (DNS и TCP 80 в pay разрешены). ${ing.why.ru}`, en: `Egress let it out (DNS and TCP 80 to pay are allowed). ${ing.why.en}` } : ing.why });
  }
  if (egressBlocked('fe')) flows.push({ id: 'net', edge: 'e-net', allowed: false, at: 'egress', why: bi('Egress-политика shop разрешает только pay и DNS; интернета в списке нет.', 'The egress policy of shop allows only pay and DNS; the internet is not on the list.') });
  else flows.push({ id: 'net', edge: 'e-net', allowed: true, at: 'open', why: bi('Исходящий трафик не ограничен: узел делает MASQUERADE и выпускает пакет.', 'Outgoing traffic is not restricted: the node MASQUERADEs and lets the packet out.') });
  return flows;
}

const label = (f: Flow): Bi => ({ fe: bi('frontend → pay', 'frontend → pay'), cl: bi('client → pay', 'client → pay'), dbg: bi('debug → pay', 'debug → pay'), net: bi('frontend → интернет', 'frontend → internet') })[f.id];

export const netpolModel = defineModel<P>({
  id: 'k8s.netpol',
  block: 'k8s-1',
  title: bi('NetworkPolicy: кто до кого достаёт', 'NetworkPolicy: who reaches whom'),
  summary: bi('Три пода стучатся в платёжный сервис, один ещё и в интернет. Меняйте политику и смотрите, кого она пускает, а кого отбрасывает — и почему.', 'Three pods knock on the payment service, one also goes to the internet. Change the policy and see whom it lets in and whom it drops — and why.'),
  concepts: ['k8s.networkpolicy', 'k8s.default-deny'],
  diagram: {
    width: 960,
    height: 480,
    nodes: [
      node('fe', 'frontend', 'process', 'box', 40, 56, 190, 56, bi('Под фронтенда в namespace shop с меткой role=frontend — тот, кому платёжный сервис доверяет.', 'The frontend pod in namespace shop labelled role=frontend — the one the payment service trusts.'), bi('Deployment frontend команды магазина', 'the shop team’s frontend Deployment'), 'kubectl -n shop get pods --show-labels', undefined, 'role=frontend'),
      node('cl', 'client', 'process', 'box', 40, 168, 190, 56, bi('Другой под того же namespace shop, без метки role.', 'Another pod of the same namespace shop, with no role label.'), bi('кто-то из команды для отладки', 'someone from the team, for debugging'), 'kubectl -n shop get pod client --show-labels', undefined, 'shop · no role'),
      node('dbg', 'debug', 'process', 'box', 40, 318, 190, 56, bi('Под в namespace dev, но с той же меткой role=frontend. Метка одна, namespace другой.', 'A pod in namespace dev, but with the same role=frontend label. Same label, different namespace.'), bi('разработчик в своём namespace', 'a developer in their own namespace'), 'kubectl -n dev get pods --show-labels', undefined, 'dev · role=frontend'),
      node('pay', 'pay', 'process', 'box', 720, 56, 200, 60, bi('Платёжный сервис: под с app=pay, слушает TCP 80. Его и защищает политика.', 'The payment service: a pod with app=pay, listening on TCP 80. This is what the policy protects.'), bi('Deployment pay', 'the pay Deployment'), 'kubectl -n pay get pods -o wide', undefined, 'app=pay :80'),
      node('pol', 'NetworkPolicy', 'obj', 'doc', 720, 176, 200, 76, bi('Объект API: выбирает поды (podSelector) и перечисляет, откуда к ним можно. Сам ничего не блокирует — это только запись.', 'An API object: it selects pods (podSelector) and lists where they may be reached from. It blocks nothing by itself — it is only a record.'), bi('команда платёжного сервиса (kubectl apply)', 'the payment team (kubectl apply)'), 'kubectl -n pay describe netpol', D.netpol),
      node('cni', bi('исполнитель политик', 'policy enforcer'), 'node', 'hex', 380, 256, 200, 60, bi('Агент сетевого плагина на каждом узле: смотрит NetworkPolicy через watch и пишет правила фильтрации в ядро узла. В k3s это встроенный kube-router; у Calico и Cilium — свои агенты; у чистого flannel его нет.', 'The network plugin’s agent on every node: it watches NetworkPolicies and writes filter rules into the node kernel. In k3s it is the built-in kube-router; Calico and Cilium have their own agents; plain flannel has none.'), bi('CNI, установленный в кластере', 'the CNI installed in the cluster'), 'kubectl -n kube-system get pods -o wide'),
      node('dns', 'CoreDNS', 'cp', 'box', 720, 400, 200, 56, bi('DNS кластера в kube-system. До него под идёт по UDP 53 — и egress-политика может это запретить.', 'The cluster DNS in kube-system. A pod reaches it over UDP 53 — and an egress policy can forbid that.'), bi('k3s ставит его сам', 'k3s installs it itself'), 'kubectl -n kube-system get pods -l k8s-app=kube-dns', D.dns, 'kube-system :53/UDP'),
      node('net', bi('интернет', 'the internet'), 'neutral', 'pill', 400, 116, 200, 48, bi('Внешний адрес 93.184.215.14. Выход туда тоже можно ограничить egress-политикой.', 'An outside address 93.184.215.14. Going there can be restricted by an egress policy too.'), bi('не кластер', 'not the cluster'), undefined, undefined, '93.184.215.14:443'),
    ],
    edges: [
      edge('e-fe', 'fe', 'pay', 'TCP 80', bi('Соединение frontend → pay по имени pay.pay: сначала DNS, затем TCP на порт 80.', 'The connection frontend → pay by the name pay.pay: DNS first, then TCP to port 80.'), bi('приложение frontend', 'the frontend application'), { see: 'kubectl -n shop exec frontend -- curl -s http://pay.pay' }),
      edge('e-cl', 'cl', 'pay', 'TCP 80', bi('client стучится туда же.', 'client knocks on the same door.'), bi('человек с kubectl exec', 'a person with kubectl exec'), { via: [[660, 196], [660, 100]], labelAt: 0.25, see: 'kubectl -n shop exec client -- curl -s http://pay.pay' }),
      edge('e-dbg', 'dbg', 'pay', 'TCP 80', bi('debug из namespace dev стучится туда же.', 'debug from namespace dev knocks on the same door.'), bi('разработчик', 'a developer'), { via: [[690, 346], [690, 108]], labelAt: 0.25 }),
      edge('e-dns', 'fe', 'dns', 'UDP 53', bi('Запрос имени к CoreDNS. Без него под не узнает адрес Service.', 'A name query to CoreDNS. Without it the pod does not learn the Service address.'), bi('резолвер пода', 'the pod resolver'), { via: [[250, 112], [250, 428]], labelAt: 0.7 }),
      edge('e-net', 'fe', 'net', 'TCP 443', bi('Выход в интернет: узел подменяет источник на свой адрес.', 'Going out to the internet: the node replaces the source with its own address.'), bi('приложение frontend', 'the frontend application'), { via: [[320, 104], [320, 140]], labelAt: 0.8 }),
      edge('e-watch', 'cni', 'pol', 'watch', bi('Исполнитель читает политики через watch и превращает их в правила ядра.', 'The enforcer reads the policies through watch and turns them into kernel rules.'), bi('агент CNI', 'the CNI agent'), { dashed: true, via: [[620, 286], [620, 214]] }),
    ],
    groups: [
      { id: 'g-shop', label: 'namespace shop', around: ['fe', 'cl'], family: 'ns', dash: 'dash', pad: 14, card: { what: bi('Namespace магазина. У каждого namespace есть метка kubernetes.io/metadata.name с его именем — по ней его выбирает namespaceSelector.', 'The shop namespace. Every namespace has the label kubernetes.io/metadata.name with its name — namespaceSelector picks it by that label.'), who: bi('администратор кластера', 'the cluster admin'), see: 'kubectl get ns shop --show-labels' } },
      { id: 'g-dev', label: 'namespace dev', around: ['dbg'], family: 'ns', dash: 'dash', pad: 14, card: { what: bi('Namespace разработчиков.', 'The developers’ namespace.'), who: bi('администратор кластера', 'the cluster admin') } },
      { id: 'g-pay', label: 'namespace pay', around: ['pay', 'pol'], family: 'ns', dash: 'dash', pad: 14, card: { what: bi('Namespace платёжного сервиса. Политика живёт здесь и действует только на поды этого namespace.', 'The payment service namespace. The policy lives here and applies only to the pods of this namespace.'), who: bi('администратор кластера', 'the cluster admin') } },
    ],
  },
  params: [
    {
      id: 'policy',
      label: bi('Политика в pay', 'The policy in pay'),
      kind: 'choice',
      default: 'and',
      near: 'pol',
      options: [
        { id: 'none', label: bi('нет политики', 'no policy') },
        { id: 'deny', label: bi('default-deny', 'default-deny') },
        { id: 'and', label: bi('один элемент: shop И role=frontend', 'one item: shop AND role=frontend') },
        { id: 'or', label: bi('два элемента: shop ИЛИ role=frontend', 'two items: shop OR role=frontend') },
      ],
      predict: {
        prompt: bi('Кто теперь достучится до pay?', 'Who reaches pay now?'),
        options: [
          { id: 'all', text: bi('Все трое', 'All three') },
          { id: 'shop', text: bi('Оба пода из shop', 'Both pods of shop') },
          { id: 'fe', text: bi('Только frontend', 'Only frontend') },
          { id: 'none', text: bi('Никто', 'Nobody') },
        ],
        resolve: (_p, n) => {
          const ok = (id: string) => n.find((s) => s.id === `flow-${id}`)?.states?.[`e-${id}`] === 'ok';
          const n3 = ['fe', 'cl', 'dbg'].filter(ok).length;
          return n3 === 3 ? 'all' : n3 === 0 ? 'none' : ok('cl') ? 'shop' : 'fe';
        },
      },
    },
    {
      id: 'egress',
      label: bi('В shop: egress только в pay', 'In shop: egress to pay only'),
      kind: 'toggle',
      default: false,
      near: 'fe',
      predict: {
        prompt: bi('Поды shop теперь могут ходить только в pay на TCP 80. Дойдёт ли frontend до pay по имени?', 'The pods of shop may now go only to pay on TCP 80. Will frontend reach pay by name?'),
        options: [
          { id: 'yes', text: bi('Да: pay разрешён', 'Yes: pay is allowed') },
          { id: 'no', text: bi('Нет: не пройдёт DNS', 'No: DNS will not pass') },
        ],
        resolve: (_p, n) => (n.find((s) => s.id === 'flow-fe')?.states?.['e-fe'] === 'ok' ? 'yes' : 'no'),
      },
    },
    { id: 'dns', label: bi('…и разрешить DNS (UDP 53 к CoreDNS)', '…and allow DNS (UDP 53 to CoreDNS)'), kind: 'toggle', default: false, near: 'dns', levels: ['intermediate', 'experienced'] },
    {
      id: 'cni',
      label: bi('Сетевой плагин', 'Network plugin'),
      kind: 'choice',
      default: 'kube-router',
      near: 'cni',
      options: [
        { id: 'kube-router', label: bi('k3s (kube-router)', 'k3s (kube-router)') },
        { id: 'cilium', label: bi('Cilium', 'Cilium') },
        { id: 'flannel', label: bi('чистый flannel', 'plain flannel') },
      ],
      predict: {
        prompt: bi('Политика та же, плагин другой. Что изменится?', 'The same policy, a different plugin. What changes?'),
        options: [
          { id: 'same', text: bi('Ничего', 'Nothing') },
          { id: 'open', text: bi('Всё станет открыто', 'Everything becomes open') },
        ],
        resolve: (_p, n) => (metric(n, 'dropped') === 0 ? 'open' : 'same'),
      },
    },
  ],
  breaks: [
    {
      id: 'typo',
      label: bi('Опечатка в метке namespace (shopp)', 'A typo in the namespace label (shopp)'),
      remove: ['g-shop'],
      layer: 'L3',
      predict: { prompt: bi('В namespaceSelector написали shopp. Пройдёт ли frontend?', 'The namespaceSelector says shopp. Will frontend get through?'), options: [{ id: 'no', text: bi('Нет: условие не выполнено', 'No: the condition does not hold') }, { id: 'err', text: bi('API-сервер не примет политику', 'The API server rejects the policy') }], resolve: () => 'no' },
    },
    {
      id: 'port',
      label: bi('В правиле порт 8080 вместо 80', 'The rule says port 8080 instead of 80'),
      remove: ['e-fe'],
      layer: 'L4',
      predict: { prompt: bi('Правило разрешает только порт 8080. Что будет с frontend?', 'The rule allows only port 8080. What happens to frontend?'), options: [{ id: 'drop', text: bi('Тайм-аут: пакет на 80 под правило не подходит', 'A timeout: a packet to 80 matches no rule') }, { id: 'ok', text: bi('Пройдёт: порт в политике — подсказка', 'It passes: the port in a policy is a hint') }], resolve: () => 'drop' },
    },
  ],
  metrics: [
    { id: 'allowed', label: bi('пропущено', 'allowed') },
    { id: 'dropped', label: bi('отброшено', 'dropped') },
  ],
  run(p, broken): Step[] {
    const flows = netpolFlows(p, broken);
    const enforced = p.cni !== 'flannel';
    const s: Step[] = [];
    s.push({
      id: 'policy',
      label: bi('политика', 'policy'),
      caption: enforced
        ? p.policy === 'none'
          ? bi('Политик нет: сетевая модель обещает, что любой под достаёт до любого.', 'No policies: the network model promises any pod reaches any other.')
          : bi('Политика лежит в API. Исполнитель на узлах прочитал её через watch и записал правила в ядро.', 'The policy is in the API. The enforcer on the nodes read it through watch and wrote rules into the kernel.')
        : bi('API-сервер принял политику, но исполнять её некому: чистый flannel NetworkPolicy не поддерживает.', 'The API server accepted the policy, but nobody enforces it: plain flannel does not support NetworkPolicy.'),
      focus: ['pol', 'cni', 'e-watch'],
      tokens: enforced && p.policy !== 'none' ? [{ edge: 'e-watch', label: 'NetworkPolicy' }] : [],
      states: { cni: enforced ? 'on' : 'off', 'e-watch': enforced ? 'on' : 'off', 'e-dns': p.egress && !p.dns && enforced ? 'err' : 'ok' },
      values: { pol: POLICY_TEXT[p.policy], cni: p.cni },
      metrics: { allowed: 0, dropped: 0 },
    });
    let allowed = 0;
    let dropped = 0;
    for (const f of flows) {
      if (f.allowed) allowed++;
      else dropped++;
      const st: Step = {
        id: `flow-${f.id}`,
        label: label(f),
        caption: f.why,
        focus: [f.edge, f.id === 'net' ? 'net' : 'pay', f.id === 'net' ? 'fe' : f.id],
        tokens: [{ edge: f.at === 'dns' ? 'e-dns' : f.edge, label: f.at === 'dns' ? 'DNS pay.pay' : f.id === 'net' ? 'SYN :443' : 'SYN :80' }],
        states: { [f.edge]: f.allowed ? 'ok' : 'err', ...(f.at === 'dns' ? { 'e-dns': 'err' as const } : {}) },
        metrics: { allowed, dropped },
      };
      const intended = f.id === 'fe';
      if (intended && !f.allowed && (broken.has('typo') || broken.has('port')) && p.policy !== 'none' && p.policy !== 'deny')
        st.broken = { at: 'pay', message: '$ kubectl -n shop exec frontend -- curl -s -m 5 http://pay.pay\ncurl: (28) Connection timed out after 5001 milliseconds', caption: f.why };
      s.push(st);
    }
    s.push({ id: 'sum', label: bi('итог', 'result'), caption: fmt(bi('Пропущено {a}, отброшено {d}. Политики складываются: разрешено то, что разрешает хотя бы одна; отброшенный пакет не получает ответа — клиент видит тайм-аут, а не отказ.', 'Allowed {a}, dropped {d}. Policies add up: allowed is whatever at least one allows; a dropped packet gets no answer — the client sees a timeout, not a refusal.'), { a: allowed, d: dropped }), focus: ['pay', 'pol'], metrics: { allowed, dropped } });
    return s;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Одна буква или одна цифра в политике — и разрешённый клиент получает тайм-аут.', 'One letter or one digit in the policy — and an allowed client gets a timeout.') : bi('Политика снова верная.', 'The policy is right again.');
    const d = metric(next, 'dropped');
    switch (change.id) {
      case 'policy':
        return fmt(bi('Политика {x} → {y}: отброшено соединений — {d}.', 'Policy {x} → {y}: connections dropped — {d}.'), { x: String(a.policy), y: String(b.policy), d });
      case 'egress':
        return b.egress ? (b.dns ? bi('Egress закрыт, но DNS разрешён: в pay можно, в интернет нельзя.', 'Egress is closed but DNS is allowed: pay is reachable, the internet is not.') : bi('Egress закрыт вместе с DNS: под не может даже узнать адрес pay. Самая частая ошибка с egress.', 'Egress is closed together with DNS: the pod cannot even learn the address of pay. The most common egress mistake.')) : bi('Исходящий трафик shop снова не ограничен.', 'The outgoing traffic of shop is unrestricted again.');
      case 'dns':
        return b.dns ? bi('Правило «UDP 53 к kube-dns» вернуло поду имена.', 'The rule "UDP 53 to kube-dns" gave the pod its names back.') : bi('Без правила DNS egress-политика ломает все обращения по имени.', 'Without the DNS rule the egress policy breaks every call by name.');
      case 'cni':
        return b.cni === 'flannel' ? bi('Флаг в YAML ничего не значит без исполнителя: всё открыто.', 'A flag in YAML means nothing without an enforcer: everything is open.') : bi('Исполнитель есть: политика снова работает.', 'There is an enforcer: the policy works again.');
    }
    return bi('Матрица пересчитана.', 'The matrix is recomputed.');
  },
});
