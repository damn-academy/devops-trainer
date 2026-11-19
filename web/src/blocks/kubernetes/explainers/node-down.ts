// Э5 (05 §6.7): a node lost power. Steps go by virtual time: the Lease stops
// being renewed → after node-monitor-grace-period the node is Unknown and
// tainted unreachable → after tolerationSeconds its pods are marked for
// deletion → the ReplicaSet creates replacements → the scheduler places them
// on live nodes. Until the pods leave the EndpointSlice, part of the
// requests still goes to the dead node: the counter shows how many.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

type P = { grace: number; toleration: number; back: string };

const RPS = 10;
/** Share of requests that go to the dead node's pods (1 of 3 replicas). */
const SHARE = 1 / 3;

export function nodeDownNumbers(p: P, noCm: boolean): { lost: number; recovered: number | null; evicted: boolean } {
  const backAt = p.back === 'never' ? Infinity : p.back === '60' ? 60 : 600;
  if (noCm) return { lost: Math.round(Math.min(backAt, 900) * RPS * SHARE), recovered: backAt === Infinity ? null : backAt, evicted: false };
  const notReadyAt = p.grace;
  const evictAt = p.grace + p.toleration;
  const lost = Math.round(Math.min(backAt, notReadyAt) * RPS * SHARE);
  if (backAt <= evictAt) return { lost, recovered: backAt, evicted: false };
  return { lost, recovered: evictAt + 5, evicted: true };
}

export const nodeDownModel = defineModel<P>({
  id: 'k8s.node-down',
  block: 'k8s-1',
  title: bi('Узел упал: кто и когда это замечает', 'A node went down: who notices and when'),
  summary: bi('Никто не получает сообщения «узел умер». Контроллер замечает, что kubelet перестал продлевать Lease, ждёт, помечает узел, ждёт ещё — и только тогда поды переезжают.', 'Nobody receives a "the node died" message. A controller notices that the kubelet stopped renewing its Lease, waits, marks the node, waits again — and only then do the pods move.'),
  concepts: ['k8s.node', 'k8s.kubelet'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      node('nlc', bi('node-lifecycle', 'node lifecycle'), 'cp', 'hex', 40, 30, 220, 56, bi('Контроллер в kube-controller-manager: раз в 5 с проверяет Lease каждого узла.', 'A controller in kube-controller-manager: checks the Lease of every node every 5 s.'), bi('kube-controller-manager', 'kube-controller-manager'), 'kubectl get nodes -w', D.nodes),
      node('api', 'kube-apiserver', 'cp', 'hex', 370, 30, 220, 56, bi('Хранит Lease, Node и поды. Само ничего не решает.', 'Stores Leases, Nodes and pods. Decides nothing itself.'), bi('control plane', 'the control plane'), undefined, D.apiserver),
      node('rs', bi('контроллер ReplicaSet', 'ReplicaSet controller'), 'cp', 'hex', 700, 30, 220, 56, bi('Видит, что подов меньше желаемого (помеченные к удалению не считаются), и создаёт новые.', 'Sees fewer pods than desired (pods marked for deletion do not count) and creates new ones.'), bi('kube-controller-manager', 'kube-controller-manager'), 'kubectl get rs web', D.rs),
      node('lease', bi('Lease worker-2', 'Lease worker-2'), 'obj', 'doc', 370, 140, 220, 70, bi('Объект в kube-node-lease: kubelet обновляет renewTime раз в 10 с. Это и есть сердцебиение узла.', 'An object in kube-node-lease: the kubelet updates renewTime every 10 s. This is the node’s heartbeat.'), bi('kubelet worker-2', 'the worker-2 kubelet'), 'kubectl get lease -n kube-node-lease', D.nodes, 'renewed 0s ago'),
      node('w1', 'worker-1', 'node', 'rack', 40, 290, 260, 110, bi('Живой узел: сюда приедут замены.', 'A live node: the replacements will land here.'), bi('узел кластера', 'a cluster node'), 'kubectl get pods -o wide', D.nodes, 'web-a Running'),
      node('w2', 'worker-2', 'node', 'rack', 350, 290, 260, 110, bi('Питание выключено. Процессы на нём умерли сразу, но кластер узнаёт об этом не сразу.', 'The power is off. Its processes died at once, but the cluster learns about it later.'), bi('узел кластера', 'a cluster node'), 'kubectl describe node worker-2', D.nodes, 'web-b Running'),
      node('w3', 'worker-3', 'node', 'rack', 660, 290, 260, 110, bi('Живой узел.', 'A live node.'), bi('узел кластера', 'a cluster node'), undefined, D.nodes, 'web-c Running'),
    ],
    edges: [
      edge('e-renew', 'w2', 'lease', 'PUT Lease /10 s', bi('Продление Lease: пока оно идёт, узел жив.', 'Renewing the Lease: while it goes on, the node is alive.'), bi('kubelet', 'kubelet')),
      edge('e-check', 'nlc', 'lease', 'renewTime older than grace?', bi('Контроллер сравнивает renewTime с node-monitor-grace-period.', 'The controller compares renewTime with node-monitor-grace-period.'), bi('node-lifecycle', 'node lifecycle'), { via: [[150, 175]] }),
      edge('e-taint', 'nlc', 'api', 'PATCH node: Unknown + taint', bi('Ready=Unknown и taint node.kubernetes.io/unreachable:NoExecute.', 'Ready=Unknown and the taint node.kubernetes.io/unreachable:NoExecute.'), bi('node-lifecycle', 'node lifecycle')),
      edge('e-evict', 'api', 'w2', bi('вытеснить через tolerationSeconds', 'evict after tolerationSeconds'), bi('Через tolerationSeconds (300 с по умолчанию) поды узла помечаются к удалению.', 'After tolerationSeconds (300 s by default) the pods of the node are marked for deletion.'), bi('taint-eviction-controller', 'taint-eviction-controller'), { via: [[480, 250]], labelAt: 0.7 }),
      edge('e-create', 'rs', 'w3', bi('создать замену', 'create replacement'), bi('Замена создаётся, планировщик ставит её на живой узел.', 'The replacement is created, the scheduler puts it on a live node.'), bi('контроллер ReplicaSet + kube-scheduler', 'the ReplicaSet controller + kube-scheduler')),
    ],
  },
  params: [
    {
      id: 'grace',
      label: bi('node-monitor-grace-period, с', 'node-monitor-grace-period, s'),
      kind: 'range',
      min: 20,
      max: 120,
      step: 10,
      default: 50,
      near: 'lease',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('Срок ожидания меньше. Запросов на мёртвый узел пропадёт…', 'The grace period is shorter. Requests lost to the dead node will be…'),
        options: [
          { id: 'fewer', text: bi('меньше', 'fewer') },
          { id: 'same', text: bi('столько же', 'the same') },
        ],
        resolve: (prev, next) => (metric(next, 'lost') < metric(prev, 'lost') ? 'fewer' : 'same'),
      },
    },
    { id: 'toleration', label: bi('tolerationSeconds пода, с', 'pod tolerationSeconds, s'), kind: 'range', min: 0, max: 600, step: 30, default: 300, near: 'w2' },
    {
      id: 'back',
      label: bi('Узел вернулся', 'The node came back'),
      kind: 'choice',
      default: 'never',
      options: [
        { id: 'never', label: bi('не вернулся', 'never') },
        { id: '60', label: bi('через 60 с', 'after 60 s') },
        { id: '600', label: bi('через 10 минут', 'after 10 minutes') },
      ],
      near: 'w2',
      predict: {
        prompt: bi('Узел вернулся. Переедут ли его поды?', 'The node came back. Will its pods move?'),
        options: [
          { id: 'stay', text: bi('Нет, останутся на месте', 'No, they stay where they are') },
          { id: 'moved', text: bi('Уже переехали; старые kubelet остановит сам', 'They have already moved; the kubelet stops the old ones itself') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'evict') ? 'moved' : 'stay'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-cm',
      label: bi('kube-controller-manager остановлен', 'kube-controller-manager is stopped'),
      remove: ['nlc', 'rs', 'e-check', 'e-taint', 'e-create'],
      boundary: 'process',
      predict: { prompt: bi('Контроллеров нет. Когда узел пометят недоступным?', 'There are no controllers. When will the node be marked unreachable?'), options: [{ id: 'never', text: bi('Никогда; запросы на него пропадают и дальше', 'Never; requests to it keep getting lost') }, { id: 'grace', text: bi('Через тот же grace period', 'After the same grace period') }], resolve: () => 'never' },
    },
  ],
  metrics: [
    { id: 't', label: bi('время', 'time'), unit: 's' },
    { id: 'lost', label: bi('запросов на мёртвый узел', 'requests to the dead node') },
    { id: 'ready', label: bi('готовых реплик', 'ready replicas') },
  ],
  run(p, broken): Step[] {
    const noCm = broken.has('no-cm');
    const n = nodeDownNumbers(p, noCm);
    const backAt = p.back === 'never' ? Infinity : Number(p.back);
    const s: Step[] = [];
    const lostAt = (t: number) => Math.round(Math.min(t, noCm ? t : p.grace, backAt) * RPS * SHARE);
    s.push({ id: 'off', label: 't = 0', caption: bi('Питание worker-2 выключено. Под web-b умер вместе с узлом, но в API он всё ещё Running и Ready — и kube-proxy шлёт на него треть запросов.', 'worker-2 lost power. Pod web-b died with the node, but in the API it is still Running and Ready — and kube-proxy sends a third of the requests to it.'), focus: ['w2'], states: { w2: 'err' }, values: { w2: 'web-b Running (stale)', lease: 'renewed 0s ago' }, metrics: { t: 0, lost: 0, ready: 3 } });
    s.push({ id: 'silence', label: 't = 10', caption: bi('Очередное продление Lease не пришло. Никто ещё ничего не делает: пропуск одного сердцебиения — не повод.', 'The next Lease renewal did not arrive. Nobody does anything yet: one missed heartbeat is not a reason.'), focus: ['e-renew', 'lease'], states: { 'e-renew': 'off' }, values: { lease: 'renewed 10s ago' }, metrics: { t: 10, lost: lostAt(10), ready: 3 } });
    if (backAt <= p.grace && !noCm) {
      s.push({ id: 'back', label: `t = ${backAt}`, caption: fmt(bi('Узел вернулся через {b} с — раньше grace period. kubelet перезапустил контейнеры, Lease снова свежий; узел так и не был помечен.', 'The node came back after {b} s — before the grace period. The kubelet restarted the containers, the Lease is fresh again; the node was never marked.'), { b: backAt }), focus: ['w2', 'lease'], states: { w2: 'ok', 'e-renew': 'on' }, values: { lease: 'renewed 0s ago', w2: 'web-b Running (restarted)' }, metrics: { t: backAt, lost: n.lost, ready: 3 } });
      return s;
    }
    if (noCm) {
      s.push({ id: 'nobody', label: bi('никто', 'nobody'), caption: bi('Lease устаревает, но контроллера, который это проверяет, нет: узел остаётся Ready, под — в EndpointSlice.', 'The Lease gets old, but the controller that checks it is not there: the node stays Ready, the pod stays in the EndpointSlice.'), focus: ['lease'], values: { lease: 'renewed 15m ago' }, metrics: { t: 900, lost: n.lost, ready: 2 }, broken: { at: 'nlc', message: '$ kubectl get nodes\nNAME       STATUS   ROLES    AGE   VERSION\nworker-2   Ready    <none>   4d    v1.37.1+k3s1', caption: bi('без node-lifecycle никто не превратит молчание узла в Unknown — запросы на него пропадают и дальше.', 'without node lifecycle nobody turns the silence of the node into Unknown — requests to it keep getting lost.') } });
      return s;
    }
    s.push({ id: 'unknown', label: `t = ${p.grace}`, caption: fmt(bi('Lease старше {g} с: node-lifecycle ставит Ready=Unknown и taint unreachable:NoExecute. Поды узла становятся NotReady и уходят из EndpointSlice — запросы на мёртвый узел прекращаются.', 'The Lease is older than {g} s: node lifecycle sets Ready=Unknown and the taint unreachable:NoExecute. The pods of the node become NotReady and leave the EndpointSlice — requests to the dead node stop.'), { g: p.grace }), focus: ['nlc', 'e-check', 'e-taint'], tokens: [{ edge: 'e-taint', label: 'Unknown' }], states: { nlc: 'on', w2: 'warn' }, values: { w2: 'NotReady · web-b NotReady', lease: `renewed ${p.grace}s ago` }, metrics: { t: p.grace, lost: n.lost, ready: 2 } });
    const evictAt = p.grace + p.toleration;
    if (backAt <= evictAt) {
      s.push({ id: 'back', label: `t = ${backAt}`, caption: fmt(bi('Узел вернулся через {b} с — до истечения tolerationSeconds. Taint снят, под web-b снова Ready на прежнем месте: выселять не пришлось.', 'The node came back after {b} s — before tolerationSeconds ran out. The taint is removed, web-b is Ready again in the same place: no eviction was needed.'), { b: backAt }), focus: ['w2', 'lease'], states: { w2: 'ok' }, values: { w2: 'Ready · web-b Running', lease: 'renewed 0s ago' }, metrics: { t: backAt, lost: n.lost, ready: 3 } });
      return s;
    }
    s.push({ id: 'evict', label: `t = ${evictAt}`, caption: fmt(bi('Прошло tolerationSeconds = {t} с: под web-b помечен к удалению. Удалить его по-настоящему некому — kubelet мёртв, — поэтому он висит Terminating.', 'tolerationSeconds = {t} s passed: pod web-b is marked for deletion. Nobody can really remove it — the kubelet is dead — so it hangs in Terminating.'), { t: p.toleration }), focus: ['e-evict', 'w2'], tokens: [{ edge: 'e-evict', label: 'evict' }], values: { w2: 'web-b Terminating' }, metrics: { t: evictAt, lost: n.lost, ready: 2 } });
    s.push({ id: 'replace', label: `t = ${evictAt + 5}`, caption: bi('ReplicaSet не считает помеченные к удалению поды и создаёт замену; планировщик ставит её на worker-3 (на мёртвый узел нельзя — taint). Через несколько секунд она Ready.', 'The ReplicaSet does not count pods marked for deletion and creates a replacement; the scheduler puts it on worker-3 (the dead node is tainted). A few seconds later it is Ready.'), focus: ['rs', 'e-create', 'w3'], tokens: [{ edge: 'e-create', label: 'web-d' }], values: { w3: 'web-c, web-d Running' }, states: { w3: 'ok' }, metrics: { t: evictAt + 5, lost: n.lost, ready: 3 } });
    if (backAt === 600) s.push({ id: 'return', label: 't = 600', caption: bi('Узел вернулся после выселения. kubelet видит, что web-b в API помечен к удалению, останавливает его и даёт API удалить объект: kubelet тоже сверяет.', 'The node came back after the eviction. The kubelet sees that web-b is marked for deletion in the API, stops it and lets the API delete the object: the kubelet reconciles too.'), focus: ['w2'], states: { w2: 'ok' }, values: { w2: 'Ready · no pods', lease: 'renewed 0s ago' }, metrics: { t: 600, lost: n.lost, ready: 3 } });
    return s;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Без controller-manager узел никогда не станет Unknown: молчание kubelet никто не истолкует.', 'Without the controller-manager the node never becomes Unknown: nobody interprets the kubelet’s silence.') : bi('Контроллеры вернулись: узел пометят через grace period.', 'The controllers are back: the node will be marked after the grace period.');
    switch (change.id) {
      case 'grace':
        return fmt(bi('grace period {g} с: потерь {a} → {b} — пока узел не помечен, на него идёт треть запросов.', 'grace period {g} s: losses {a} → {b} — until the node is marked, a third of the requests goes to it.'), { g: b.grace as number, a: metric(prev, 'lost'), b: metric(next, 'lost') });
      case 'toleration':
        return fmt(bi('tolerationSeconds {t} с: замена появится на {r}-й секунде. Короче ожидание — быстрее переезд, но чаще лишние переезды при коротком сбое сети.', 'tolerationSeconds {t} s: the replacement appears at second {r}. A shorter wait means a faster move, but more needless moves after a short network glitch.'), { t: b.toleration as number, r: metric(next, 't') });
      case 'back':
        return b.back === 'never' ? bi('Узел не вернулся: поды переедут по таймерам.', 'The node did not come back: the pods move on the timers.') : next.some((s) => s.id === 'evict') ? bi('Узел вернулся поздно: поды уже переехали, kubelet убирает старые.', 'The node came back late: the pods have moved already, the kubelet removes the old ones.') : bi('Узел вернулся рано: переезда не было.', 'The node came back early: there was no move.');
    }
    return bi('Пересчитано.', 'Recomputed.');
  },
});
