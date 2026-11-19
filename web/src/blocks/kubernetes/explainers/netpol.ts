// Э10 (05 §6.12): NetworkPolicy as a matrix "from × to". Three pods knock on
// the payment service; one of them also goes to the internet. Switching the
// policy recolours every connection at once and says which policy let it in
// or dropped it. Knobs: the policy itself (none, default-deny, AND, OR),
// a default-deny egress in shop with or without the DNS rule, and the CNI
// that is supposed to enforce all of it (plain flannel enforces nothing).
//
// Reading order: at first only the policy, its enforcer and the payment pod
// are on screen (inside the empty namespace frames); then each client pod
// appears and tries to connect, one connection per step.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, idsOf, LEGEND_BASE, mark, metric, only } from './kit';

type P = { policy: string; egress: boolean; dns: boolean; cni: string };

export interface Flow {
  id: 'fe' | 'cl' | 'dbg' | 'net';
  edge: string;
  allowed: boolean;
  /** Which stage decided: dns (egress to CoreDNS), egress (leaving the source), ingress (entering pay), none. */
  at: 'dns' | 'egress' | 'ingress' | 'open';
  why: Bi;
}

const POLICY_TEXT: Record<string, Bi | string> = {
  none: '—',
  deny: 'podSelector: {}',
  and: bi('shop и role=frontend', 'ns AND pod'),
  or: bi('shop или role=frontend', 'ns OR pod'),
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
    if (!enforced) return { ok: true, why: bi('Политика лежит в API, но flannel её не исполняет, поэтому пакет проходит.', 'The policy is in the API, but flannel does not enforce it: the packet passes.') };
    const s = src[k];
    if (p.policy === 'none') return { ok: true, why: bi('Ни одна политика не выбирает под pay, и он открыт для всех.', 'No policy selects the pay pod — it is open to everyone.') };
    if (p.policy === 'deny') return { ok: false, why: bi('Политика default-deny выбрала все поды namespace pay и не разрешила ничего, поэтому пакет отброшен.', 'default-deny selected every pod of pay and allowed nothing.') };
    if (badPort) return { ok: false, why: bi('Правило разрешает порт 8080, а pay слушает порт 80, поэтому ни один пакет под это правило не подходит и пакет отброшен.', 'The rule allows port 8080, but the pod listens on 80: no packet matches the rule.') };
    const nsOk = !typo && s.ns === 'shop';
    const roleOk = s.role === 'frontend';
    if (p.policy === 'and') {
      if (nsOk && roleOk) return { ok: true, why: bi('В правиле один элемент from, и в нём два условия: namespace shop **и** метка role=frontend. Оба условия выполнены, поэтому соединение проходит.', 'One from item: namespace shop **and** role=frontend — both conditions hold.') };
      if (typo && s.ns === 'shop') return { ok: false, why: bi('В namespaceSelector опечатка (shopp), а такого namespace нет, поэтому условие не выполняется ни для кого, и пакет отброшен.', 'The namespaceSelector has a typo (shopp): there is no such namespace, the condition holds for nobody.') };
      return { ok: false, why: s.ns !== 'shop' ? bi('Метка role=frontend у пода есть, но namespace у него не shop, а в одном элементе from должны выполняться оба условия. Пакет отброшен.', 'role=frontend is there, but the namespace is not shop: one item needs both conditions.') : bi('Namespace у пода shop, но метки role=frontend у него нет. Пакет отброшен.', 'Namespace shop, but no role=frontend label.') };
    }
    // or: two items; a podSelector without namespaceSelector means "pods of the policy's own namespace" (pay)
    if (nsOk) return { ok: true, why: bi('Первый элемент from пускает любой под из namespace shop, поэтому соединение проходит.', 'The first from item: any pod of namespace shop.') };
    return {
      ok: false,
      why: typo
        ? bi('Опечатка в namespaceSelector отрезала namespace shop, а второй элемент from, podSelector без namespaceSelector, выбирает поды только в самом namespace pay. Пакет отброшен.', 'The typo in namespaceSelector cut shop off, and the second item — a podSelector without a namespaceSelector — selects pods of pay itself only.')
        : bi('Второй элемент from, podSelector без namespaceSelector, выбирает поды с role=frontend только в namespace самой политики, то есть в pay, а debug работает в namespace dev. Пакет отброшен.', 'The second item — a podSelector without a namespaceSelector — selects role=frontend pods only in the policy’s own namespace, pay. debug lives in dev.'),
    };
  };
  const egressBlocked = (k: 'fe' | 'cl' | 'dbg') => enforced && p.egress && src[k].ns === 'shop';
  const flows: Flow[] = [];
  for (const k of ['fe', 'cl', 'dbg'] as const) {
    const e = `e-${k}`;
    if (egressBlocked(k) && !p.dns) {
      flows.push({ id: k, edge: e, allowed: false, at: 'dns', why: bi('Политика исходящего трафика в shop не разрешает обращаться к CoreDNS по UDP 53, поэтому имя pay.pay не превращается в адрес, и до соединения TCP дело не доходит.', 'The egress policy of shop does not allow UDP 53 to CoreDNS: the name pay.pay does not resolve, TCP never starts.') });
      continue;
    }
    const ing = ingress(k);
    flows.push({ id: k, edge: e, allowed: ing.ok, at: p.policy === 'none' || !enforced ? 'open' : 'ingress', why: egressBlocked(k) ? { ru: `Политика исходящего трафика выпустила пакет, потому что запросы DNS и TCP 80 к pay разрешены. ${ing.why.ru}`, en: `Egress let it out (DNS and TCP 80 to pay are allowed). ${ing.why.en}` } : ing.why });
  }
  if (egressBlocked('fe')) flows.push({ id: 'net', edge: 'e-net', allowed: false, at: 'egress', why: bi('Политика исходящего трафика в shop разрешает обращаться только к pay и к DNS, а интернета в этом списке нет. Пакет отброшен.', 'The egress policy of shop allows only pay and DNS; the internet is not on the list.') });
  else flows.push({ id: 'net', edge: 'e-net', allowed: true, at: 'open', why: bi('Исходящий трафик ничем не ограничен, поэтому узел подменяет адрес отправителя своим (MASQUERADE) и выпускает пакет.', 'Outgoing traffic is not restricted: the node MASQUERADEs and lets the packet out.') });
  return flows;
}

const label = (f: Flow): Bi => ({ fe: bi('frontend', 'frontend → pay'), cl: bi('client', 'client → pay'), dbg: bi('debug', 'debug → pay'), net: bi('в интернет', 'frontend → internet') })[f.id];
const NAME: Record<Flow['id'], string> = { fe: 'frontend', cl: 'client', dbg: 'debug', net: 'frontend' };
const ADMIN = bi('Namespace создаёт администратор кластера.', 'The cluster admin.');

const diagram = {
  width: 960,
  height: 480,
  nodes: [
    box('fe', 'frontend', 'process', 'box', [40, 56, 190, 56], 'container', bi('Под фронтенда магазина в namespace shop с меткой role=frontend. Только ему платёжный сервис должен доверять.', 'The frontend pod in shop, role=frontend: the one pay should trust.'), bi('Под создал Deployment frontend команды магазина.', 'The shop team’s Deployment.'), { see: 'kubectl -n shop get pods --show-labels', sub: 'role=frontend' }),
    box('cl', 'client', 'process', 'box', [40, 168, 190, 56], 'container', bi('Другой под в том же namespace shop, но без метки role.', 'Another pod in shop, with no role label.'), bi('Под запустил кто-то из команды для отладки.', 'Someone from the team, for debugging.'), { see: 'kubectl -n shop get pod client --show-labels', sub: 'shop · role=—' }),
    box('dbg', 'debug', 'process', 'box', [40, 318, 190, 56], 'container', bi('Под в namespace dev с той же меткой role=frontend. Метка у него та же, а namespace другой.', 'A pod in dev with the same role=frontend label: same label, other namespace.'), bi('Под запустил разработчик в своём namespace.', 'A developer.'), { see: 'kubectl -n dev get pods --show-labels', sub: 'dev · role=frontend' }),
    box('pay', 'pay', 'process', 'box', [720, 56, 200, 60], 'container', bi('Платёжный сервис работает в поде с меткой app=pay и слушает TCP-порт 80. Этот под и защищает политика.', 'The payment pod, app=pay, TCP 80: what the policy protects.'), bi('Под создал Deployment pay.', 'The pay Deployment.'), { see: 'kubectl -n pay get pods -o wide', sub: 'app=pay :80' }),
    box('pol', 'NetworkPolicy', 'obj', 'doc', [720, 176, 200, 76], 'file', bi('Объект API, который выбирает поды (podSelector) и перечисляет, откуда к ним можно обращаться. Сам объект ничего не блокирует, потому что остаётся только записью.', 'Selects pods and lists allowed sources; it blocks nothing by itself.'), bi('Политику пишет команда платёжного сервиса.', 'The payment team.'), { see: 'kubectl -n pay describe netpol', doc: D.netpol }),
    box('cni', bi('Исполнитель политик', 'Policy enforcer'), 'node', 'hex', [380, 256, 210, 60], 'process', bi('Агент сетевого плагина на каждом узле. Он читает объекты NetworkPolicy и записывает по ним правила фильтрации в ядро узла. В k3s это встроенный kube-router, у Calico и Cilium свои агенты, а у чистого flannel такого агента нет.', 'The plugin’s agent on every node: turns NetworkPolicies into kernel filter rules. kube-router in k3s; plain flannel has none.'), bi('Агента ставит плагин сети кластера.', 'The cluster’s CNI.'), { see: 'kubectl -n kube-system get pods -o wide' }),
    box('dns', 'CoreDNS', 'cp', 'box', [720, 400, 200, 56], 'dns', bi('Сервер имён кластера в namespace kube-system. Под обращается к нему по UDP-порту 53, и политика исходящего трафика может это запретить.', 'Cluster DNS; reached over UDP 53, which an egress policy can forbid.'), bi('k3s ставит его сам.', 'k3s installs it.'), { see: 'kubectl -n kube-system get pods -l k8s-app=kube-dns', doc: D.dns, sub: 'kube-system :53/UDP' }),
    box('net', bi('Интернет', 'The internet'), 'neutral', 'pill', [400, 116, 200, 48], 'cloud', bi('Внешний адрес 93.184.215.14. Выход туда тоже можно ограничить политикой исходящего трафика.', 'An outside address; egress can be restricted too.'), bi('Интернет к кластеру не относится, и его адресами никто в кластере не управляет.', 'The internet is not part of the cluster, and nobody in the cluster manages its addresses.'), { sub: '93.184.215.14:443' }),
  ],
  edges: [
    edge('e-fe', 'fe', 'pay', 'TCP 80', bi('Соединение frontend с pay по имени pay.pay: сначала запрос DNS, потом TCP на порт 80.', 'frontend → pay by name: DNS, then TCP 80.'), bi('Соединяется приложение frontend.', 'The frontend app.'), { see: 'kubectl -n shop exec frontend -- curl -s http://pay.pay' }),
    edge('e-cl', 'cl', 'pay', 'TCP 80', bi('client обращается к тому же сервису.', 'client knocks on the same door.'), bi('Соединяется человек через kubectl exec.', 'A person via kubectl exec.'), { via: [[660, 196], [660, 100]], labelAt: 0.25, see: 'kubectl -n shop exec client -- curl -s http://pay.pay' }),
    edge('e-dbg', 'dbg', 'pay', 'TCP 80', bi('debug из namespace dev обращается к тому же сервису.', 'debug from dev knocks on the same door.'), bi('Соединяется разработчик.', 'A developer.'), { via: [[690, 346], [690, 108]], labelAt: 0.25 }),
    edge('e-dns', 'fe', 'dns', 'UDP 53', bi('Вопрос к CoreDNS об адресе имени. Без ответа под не узнает адрес Service.', 'A DNS query; without it no Service address.'), bi('Спрашивает резолвер пода.', 'The pod’s resolver.'), { via: [[250, 112], [250, 428]], labelAt: 0.7 }),
    edge('e-net', 'fe', 'net', 'TCP 443', bi('По этой линии пакеты уходят в интернет, и узел подменяет в них адрес отправителя своим.', 'Out to the internet: the node replaces the source.'), bi('Соединяется приложение frontend.', 'The frontend app.'), { via: [[320, 104], [320, 140]], labelAt: 0.8 }),
    edge('e-watch', 'cni', 'pol', bi('читает политики', 'reads policies'), bi('Исполнитель читает политики и превращает их в правила ядра.', 'The enforcer reads the policies and turns them into kernel rules.'), bi('Читает агент плагина сети.', 'The CNI agent.'), { dashed: true, via: [[620, 286], [620, 214]] }),
  ],
  groups: [
    { id: 'g-shop', label: 'namespace shop', around: ['fe', 'cl'], family: 'ns' as const, dash: 'dash' as const, pad: 14, card: { what: bi('Namespace магазина. У каждого namespace есть метка kubernetes.io/metadata.name с его именем, и по этой метке его выбирает namespaceSelector.', 'Every namespace has kubernetes.io/metadata.name; namespaceSelector uses it.'), who: ADMIN, see: 'kubectl get ns shop --show-labels' } },
    { id: 'g-dev', label: 'namespace dev', around: ['dbg'], family: 'ns' as const, dash: 'dash' as const, pad: 14, card: { what: bi('Namespace разработчиков.', 'The developers’ namespace.'), who: ADMIN } },
    { id: 'g-pay', label: 'namespace pay', around: ['pay', 'pol'], family: 'ns' as const, dash: 'dash' as const, pad: 14, card: { what: bi('Namespace платёжного сервиса. Политика лежит здесь и действует только на поды этого namespace.', 'The policy lives here and applies only to pods of this namespace.'), who: ADMIN } },
  ],
};

const ALL = idsOf(diagram);

export const netpolModel = defineModel<P>({
  id: 'k8s.netpol',
  frame: 'visible',
  block: 'k8s-1',
  title: bi('Кого пропускает NetworkPolicy', 'Whom a NetworkPolicy lets through'),
  summary: bi(
    'Три пода пытаются обратиться к платёжному сервису pay, а frontend ещё и выходит в интернет. Политика в namespace pay решает, кого пропустить, а исполнитель политик на узлах претворяет её решение в правила ядра. Схема проводит каждое соединение по очереди и объясняет, почему оно прошло или было отброшено.',
    'Three pods try to reach pay, frontend also the internet. The policy decides, the enforcer turns it into kernel rules. The diagram walks each connection and says why it passed or was dropped.',
  ),
  intro: bi(
    'Сейчас на схеме платёжный сервис pay, политика рядом с ним и исполнитель политик в центре, а пунктирные рамки показывают три namespace. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Каждый шаг показывает одно соединение, и подпись объясняет, какое правило его пропустило или отбросило. Зелёная линия означает, что соединение прошло, красная — что пакет отброшен. Потом переключайте в «Параметрах» политику между вариантами «И» и «ИЛИ».',
    'For now: the pay service, its policy and the enforcer, inside three namespace frames. Press “Start from the first step” and go on with “Step forward”: each step is one connection, and the caption says which rule let it through or dropped it. Green means passed, red dropped. Then switch the policy between AND and OR in “Parameters”.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:container', 'под', 'a pod'),
    mark('icon:file', 'объект NetworkPolicy', 'the NetworkPolicy object'),
    mark('icon:process', 'исполнитель политик на узлах', 'the policy enforcer'),
    mark('ok', 'соединение прошло', 'the connection passed'),
    mark('err', 'пакет отброшен, клиент ждёт до тайм-аута', 'dropped: the client waits for a timeout'),
  ],
  stopLabel: bi('Соединение не прошло', 'The connection failed'),
  concepts: ['k8s.networkpolicy', 'k8s.default-deny'],
  diagram,
  params: [
    {
      id: 'policy',
      label: bi('Какая политика стоит в namespace pay', 'The policy in pay'),
      kind: 'choice',
      default: 'and',
      near: 'pol',
      group: bi('Политика в namespace pay', 'The policy in pay'),
      options: [
        { id: 'none', label: bi('никакой', 'none') },
        { id: 'deny', label: bi('запретить всё (default-deny)', 'deny all (default-deny)') },
        { id: 'and', label: bi('одно правило, которое требует и namespace shop, и метку role=frontend', 'one item: shop AND role=frontend') },
        { id: 'or', label: bi('два правила, из которых хватает namespace shop или метки role=frontend', 'two items: shop OR role=frontend') },
      ],
      predict: {
        prompt: bi('Вы выбрали другую политику. Кто из трёх подов, frontend, client и debug, теперь дойдёт до pay?', 'Another policy. Which of frontend, client and debug now reach pay?'),
        options: [
          { id: 'all', text: bi('Все трое', 'All three') },
          { id: 'shop', text: bi('Оба пода из shop, а debug нет', 'Both shop pods, not debug') },
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
      label: bi('Поды shop могут обращаться только к pay (политика исходящего трафика)', 'shop pods may go only to pay (egress policy)'),
      kind: 'toggle',
      default: false,
      near: 'fe',
      group: bi('Исходящий трафик из shop', 'Egress from shop'),
      predict: {
        prompt: bi('Подам shop теперь разрешено обращаться только к pay на TCP-порт 80, и больше никуда. Дойдёт ли frontend до pay по имени pay.pay?', 'shop pods may go only to pay on TCP 80. Will frontend reach pay.pay by name?'),
        options: [
          { id: 'yes', text: bi('Да, потому что обращаться к pay разрешено', 'Yes, because going to pay is allowed') },
          { id: 'no', text: bi('Нет, потому что не пройдёт запрос DNS', 'No, because the DNS query will not pass') },
        ],
        resolve: (_p, n) => (n.find((s) => s.id === 'flow-fe')?.states?.['e-fe'] === 'ok' ? 'yes' : 'no'),
      },
    },
    { id: 'dns', label: bi('…и ещё разрешено обращаться к CoreDNS по UDP 53', '…and DNS (UDP 53) is allowed'), kind: 'toggle', default: false, near: 'dns', levels: ['intermediate', 'experienced'], group: bi('Исходящий трафик из shop', 'Egress from shop') },
    {
      id: 'cni',
      label: bi('Какой плагин сети стоит в кластере', 'The cluster’s network plugin'),
      kind: 'choice',
      default: 'kube-router',
      near: 'cni',
      group: bi('Кластер', 'The cluster'),
      options: [
        { id: 'kube-router', label: bi('встроенный в k3s (kube-router)', 'k3s built-in (kube-router)') },
        { id: 'cilium', label: bi('Cilium', 'Cilium') },
        { id: 'flannel', label: bi('чистый flannel', 'plain flannel') },
      ],
      predict: {
        prompt: bi('Политика остаётся той же, а плагин сети вы меняете. Что изменится для соединений?', 'Same policy, another plugin. What changes?'),
        options: [
          { id: 'same', text: bi('Ничего не изменится, и политика будет работать так же', 'Nothing') },
          { id: 'open', text: bi('Все соединения станут открытыми', 'Everything becomes open') },
        ],
        resolve: (_p, n) => (metric(n, 'dropped') === 0 ? 'open' : 'same'),
      },
    },
  ],
  breaks: [
    {
      id: 'typo',
      label: bi('В namespaceSelector политики опечатка, и вместо shop написано shopp', 'A typo in namespaceSelector: shopp'),
      remove: ['g-shop'],
      layer: 'L3',
      predict: { prompt: bi('В namespaceSelector политики написали shopp вместо shop. Пройдёт ли frontend?', 'The namespaceSelector says shopp. Will frontend get through?'), options: [{ id: 'no', text: bi('Нет, потому что такого namespace нет и условие не выполняется', 'No, because there is no such namespace') }, { id: 'err', text: bi('API-сервер не примет такую политику', 'The API server rejects the policy') }], resolve: () => 'no' },
    },
    {
      id: 'port',
      label: bi('В правиле политики порт 8080 вместо 80', 'The rule says port 8080 instead of 80'),
      remove: ['e-fe'],
      layer: 'L4',
      predict: { prompt: bi('Правило политики разрешает только порт 8080, а pay слушает 80. Что будет с frontend?', 'The rule allows only 8080; pay listens on 80. What happens to frontend?'), options: [{ id: 'drop', text: bi('Соединение оборвётся по тайм-ауту, потому что пакет на порт 80 не подходит ни под одно правило', 'A timeout: no rule matches port 80') }, { id: 'ok', text: bi('Пакет пройдёт, потому что порт в политике служит только подсказкой', 'It passes: the port is a hint') }], resolve: () => 'drop' },
    },
  ],
  metrics: [
    { id: 'allowed', label: bi('соединений прошло', 'allowed') },
    { id: 'dropped', label: bi('соединений отброшено', 'dropped') },
  ],
  run(p, broken): Step[] {
    const flows = netpolFlows(p, broken);
    const enforced = p.cni !== 'flannel';
    const s: Step[] = [];
    const actor = enforced && p.policy !== 'none' ? 'cni' : p.policy === 'none' ? 'pay' : 'pol';
    s.push({
      id: 'policy',
      label: bi('политика', 'policy'),
      caption: enforced
        ? p.policy === 'none'
          ? bi('Политик нет, и сетевая модель обещает, что любой под может обратиться к любому другому.', 'No policies: any pod reaches any other.')
          : bi('Политика лежит в API. Исполнитель политик на узлах прочитал её и записал по ней правила фильтрации в ядро каждого узла.', 'The enforcer read the policy and wrote filter rules into every node.')
        : bi('API-сервер принял политику, но исполнять её некому, потому что чистый flannel объекты NetworkPolicy не поддерживает.', 'The API accepted it, but plain flannel enforces nothing.'),
      focus: [actor, ...(actor === 'cni' ? ['e-watch'] : [])],
      tokens: enforced && p.policy !== 'none' ? [{ edge: 'e-watch', label: 'NetworkPolicy' }] : [],
      say: {
        [actor]:
          actor === 'cni'
            ? bi('Исполнитель политик превращает политику в правила ядра на каждом узле.', 'The enforcer turns the policy into kernel rules.')
            : actor === 'pay'
              ? bi('Ни одна политика не выбирает под pay, и он открыт для всех.', 'No policy selects pay: it is open.')
              : bi('Политика записана, но никто её не исполняет.', 'The policy is stored, but nobody enforces it.'),
      },
      states: { ...only(ALL, 'pay', 'pol', 'cni', 'e-watch'), cni: enforced ? 'on' : 'off', 'e-watch': enforced ? 'on' : 'off' },
      values: { pol: t(POLICY_TEXT[p.policy]), cni: p.cni },
      metrics: { allowed: 0, dropped: 0 },
    });
    let allowed = 0;
    let dropped = 0;
    for (const f of flows) {
      if (f.allowed) allowed++;
      else dropped++;
      const src = f.id === 'net' ? 'fe' : f.id;
      const dnsStage = f.at === 'dns';
      const st: Step = {
        id: `flow-${f.id}`,
        label: label(f),
        caption: f.why,
        focus: [src, dnsStage ? 'e-dns' : f.edge],
        reveal: [src, f.edge, ...(f.id === 'net' ? ['net'] : []), ...(dnsStage || (p.egress && enforced) ? ['dns', 'e-dns'] : [])],
        tokens: [{ edge: dnsStage ? 'e-dns' : f.edge, label: dnsStage ? 'pay.pay?' : f.id === 'net' ? 'SYN :443' : 'SYN :80' }],
        say: {
          [src]: dnsStage
            ? fmt(bi('{n} спрашивает адрес pay.pay, но запрос к CoreDNS не выпускают.', '{n} asks for pay.pay, but DNS is blocked.'), { n: NAME[f.id] })
            : f.allowed
              ? fmt(bi('{n} открывает соединение и получает ответ.', '{n} connects and gets an answer.'), { n: NAME[f.id] })
              : fmt(bi('{n} отправляет пакет и ждёт ответа до тайм-аута, потому что пакет отброшен.', '{n} sends a packet and waits in vain: dropped.'), { n: NAME[f.id] }),
        },
        states: { [f.edge]: f.allowed ? 'ok' : 'err', ...(dnsStage ? { 'e-dns': 'err' as const } : {}) },
        metrics: { allowed, dropped },
      };
      const intended = f.id === 'fe';
      if (intended && !f.allowed && (broken.has('typo') || broken.has('port')) && p.policy !== 'none' && p.policy !== 'deny')
        st.broken = { at: 'pay', message: '$ kubectl -n shop exec frontend -- curl -s -m 5 http://pay.pay\ncurl: (28) Connection timed out after 5001 milliseconds', caption: f.why };
      s.push(st);
    }
    s.push({
      id: 'sum',
      label: bi('итог', 'result'),
      caption: fmt(bi('Соединений прошло {a}, а отброшено {d}. Если политик несколько, их разрешения складываются, и соединение проходит, если его разрешает хотя бы одна. На отброшенный пакет никто не отвечает, поэтому клиент видит тайм-аут, а не отказ в соединении.', 'Allowed {a}, dropped {d}. Policies add up; a dropped packet gets no answer, so the client sees a timeout, not a refusal.'), { a: allowed, d: dropped }),
      focus: ['pay'],
      say: { pay: fmt(bi('До pay дошло соединений: {a}.', 'Connections that reached pay: {a}.'), { a: flows.filter((f) => f.id !== 'net' && f.allowed).length }) },
      metrics: { allowed, dropped },
    });
    return s;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Одна лишняя буква или цифра в политике, и разрешённый клиент получает тайм-аут.', 'One letter or digit, and an allowed client times out.')
        : bi('Политика снова написана верно.', 'The policy is right again.');
    const d = metric(next, 'dropped');
    switch (change.id) {
      case 'policy':
        return fmt(bi('Политика сменилась, и теперь отброшено соединений: {d}.', 'Policy {x} → {y}: {d} dropped.'), { x: String(a.policy), y: String(b.policy), d });
      case 'egress':
        return b.egress
          ? b.dns
            ? bi('Исходящий трафик закрыт, но DNS разрешён, поэтому к pay обратиться можно, а в интернет нельзя.', 'Egress closed, DNS allowed: pay yes, internet no.')
            : bi('Исходящий трафик закрыт вместе с DNS, и под не может даже узнать адрес pay. Это самая частая ошибка с такими политиками.', 'Egress closed with DNS: the pod cannot even resolve pay. The most common egress mistake.')
          : bi('Исходящий трафик из shop снова не ограничен.', 'Egress from shop is unrestricted again.');
      case 'dns':
        return b.dns ? bi('Правило «UDP 53 к kube-dns» вернуло поду возможность искать имена.', 'The DNS rule gives the pod its names back.') : bi('Без правила для DNS политика исходящего трафика ломает все обращения по имени.', 'Without the DNS rule every call by name breaks.');
      case 'cni':
        return b.cni === 'flannel' ? bi('Политика в YAML ничего не значит, если её некому исполнять, и все соединения открыты.', 'Without an enforcer everything is open.') : bi('Исполнитель есть, и политика снова работает.', 'There is an enforcer; the policy works again.');
    }
    return bi('Соединения пересчитаны.', 'The connections are recomputed.');
  },
});
