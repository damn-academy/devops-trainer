// Э5 (05 §6.7): a node lost power. Steps go by virtual time: the Lease stops
// being renewed → after node-monitor-grace-period the node is Unknown and
// tainted unreachable → after tolerationSeconds its pods are marked for
// deletion → the ReplicaSet creates replacements → the scheduler places them
// on live nodes. Until the pods leave the EndpointSlice, part of the
// requests still goes to the dead node: the counter shows how many.
//
// Reading order: at first only the three nodes and the Lease are on screen;
// the controllers appear when they act, one per step, by virtual time.

import { defineModel } from '../../../core/define';
import { bi, fmt, t as tr, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, idsOf, LEGEND_BASE, mark, metric, only } from './kit';

type P = { grace: number; toleration: number; back: string };

const RPS = 10;
/** How long ago the kubelet last renewed the Lease, as shown under the Lease node. */
const renewed = (ru: string, en: string) => tr(bi(ru === '0 с' ? 'продлён только что' : `продлён ${ru} назад`, `renewed ${en} ago`));
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

const CM = bi('Работает внутри процесса kube-controller-manager.', 'Runs inside kube-controller-manager.');
const NODE = bi('Машину подключил к кластеру администратор, на ней работает kubelet.', 'An administrator joined it; a kubelet runs on it.');

const diagram = {
  width: 960,
  height: 470,
  nodes: [
    box('nlc', bi('Контроллер узлов', 'Node lifecycle controller'), 'cp', 'hex', [40, 30, 230, 56], 'process', bi('Контроллер, который каждые пять секунд проверяет отметку о жизни (Lease) каждого узла. Если отметку давно не продлевали, он помечает узел как недоступный.', 'Checks every node’s Lease every 5 s and marks silent nodes unreachable.'), CM, { see: 'kubectl get nodes -w', doc: D.nodes }),
    box('api', 'kube-apiserver', 'cp', 'hex', [370, 30, 220, 56], 'server', bi('API-сервер хранит объекты Lease, Node и поды, но сам ничего не решает. Решения принимают контроллеры, а API-сервер их только записывает.', 'Stores Leases, Nodes and pods; it decides nothing.'), bi('Работает на управляющем узле.', 'Runs on the control-plane node.'), { doc: D.apiserver }),
    box('rs', bi('Контроллер ReplicaSet', 'ReplicaSet controller'), 'cp', 'hex', [700, 30, 230, 56], 'process', bi('Видит, что готовых подов меньше, чем нужно (поды, помеченные к удалению, он не считает), и создаёт новые.', 'Sees fewer pods than desired (pods marked for deletion do not count) and creates new ones.'), CM, { see: 'kubectl get rs web', doc: D.rs }),
    box('lease', bi('Lease узла worker-2', 'Lease of worker-2'), 'obj', 'doc', [370, 140, 220, 74], 'file', bi('Объект Lease служит отметкой о том, что узел жив. Он лежит в namespace kube-node-lease, и kubelet каждые 10 секунд обновляет в нём время renewTime. Это и есть сердцебиение узла.', 'An object in kube-node-lease whose renewTime the kubelet updates every 10 s: the node’s heartbeat.'), bi('Продлевает kubelet узла worker-2.', 'Renewed by the worker-2 kubelet.'), { see: 'kubectl get lease -n kube-node-lease', doc: D.nodes, sub: 'renewed 0s ago' }),
    box('w1', 'cp-1', 'node', 'rack', [40, 290, 260, 110], 'server', bi('Исправный узел, на котором работает под web-a.', 'A healthy node running web-a.'), NODE, { see: 'kubectl get pods -o wide', doc: D.nodes, sub: 'web-a Running' }),
    box('w2', 'worker-2', 'node', 'rack', [350, 290, 260, 110], 'server', bi('Узел, у которого выключилось питание. Его процессы остановились сразу, но кластер узнаёт об этом не сразу, а только по молчанию kubelet.', 'The node that lost power: its processes stopped at once, but the cluster learns of it only from the kubelet’s silence.'), NODE, { see: 'kubectl describe node worker-2', doc: D.nodes, sub: 'web-b Running' }),
    box('w3', 'worker-1', 'node', 'rack', [660, 290, 260, 110], 'server', bi('Исправный узел, на котором работает под web-c. На этот узел планировщик поставит замену.', 'A healthy node; the replacement lands here.'), NODE, { doc: D.nodes, sub: 'web-c Running' }),
  ],
  edges: [
    edge('e-renew', 'w2', 'lease', bi('продление каждые 10 с', 'renewal every 10 s'), bi('Пока kubelet продлевает Lease, кластер считает узел живым.', 'While the kubelet renews the Lease, the node is alive.'), bi('Продлевает kubelet.', 'The kubelet.')),
    edge('e-check', 'nlc', 'lease', bi('давно не продлевали?', 'renewed long ago?'), bi('Контроллер сравнивает время последнего продления со сроком node-monitor-grace-period.', 'The controller compares renewTime with node-monitor-grace-period.'), CM, { via: [[155, 177]] }),
    edge('e-taint', 'nlc', 'api', bi('узел недоступен', 'node unreachable'), bi('Контроллер ставит узлу Ready=Unknown и запрет node.kubernetes.io/unreachable:NoExecute.', 'Ready=Unknown and the taint unreachable:NoExecute.'), CM),
    edge('e-evict', 'api', 'w2', bi('выселить поды', 'evict pods'), bi('Когда истекает tolerationSeconds пода (по умолчанию 300 секунд), под на недоступном узле помечается к удалению.', 'After tolerationSeconds (300 s by default) the pods are marked for deletion.'), bi('Выселяет контроллер taint-eviction.', 'The taint-eviction controller.'), { via: [[620, 100], [620, 345]], labelAt: 0.55 }),
    edge('e-create', 'rs', 'w3', bi('замена', 'replacement'), bi('Контроллер ReplicaSet создаёт новый под, а планировщик ставит его на исправный узел.', 'The replacement is created and scheduled on a live node.'), bi('Контроллер ReplicaSet и kube-scheduler.', 'The ReplicaSet controller and kube-scheduler.')),
  ],
};

const ALL = idsOf(diagram);

export const nodeDownModel = defineModel<P>({
  id: 'k8s.node-down',
  frame: 'visible',
  block: 'k8s-1',
  title: bi('Как кластер замечает, что узел выключился', 'How the cluster notices that a node went down'),
  summary: bi(
    'Когда узел выключается, никто не получает сообщения «узел пропал». Контроллер замечает, что kubelet перестал продлевать отметку о жизни, ждёт, помечает узел недоступным, ждёт ещё, и только тогда поды переезжают на другие узлы. Схема идёт по времени, и счётчик под ней показывает, сколько запросов за это время ушло в никуда.',
    'Nobody is told “the node is gone”. A controller notices the missing heartbeat, waits, marks the node, waits again, and only then the pods move. The counter shows the requests lost meanwhile.',
  ),
  intro: bi(
    'Сейчас на схеме три узла и отметка о жизни узла worker-2. Нажмите «Начать с первого шага». У worker-2 выключится питание, и дальше каждый шаг будет моментом времени, подписанным на шкале. Контроллеры появятся, когда начнут действовать. Потом меняйте в «Параметрах» таймеры кластера и момент, когда узел снова включают, и следите за счётчиком потерянных запросов.',
    'For now: three nodes and worker-2’s Lease. Press “Start from the first step”: worker-2 loses power, and each step is a moment in time. Then change the timers and when the node comes back, and watch the lost-request counter.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:server', 'узел кластера или API-сервер', 'a node or the API server'),
    mark('icon:file', 'отметка о жизни узла (Lease)', 'the node’s Lease'),
    mark('icon:process', 'контроллер', 'a controller'),
    mark('err', 'узел выключен', 'the node is off'),
    mark('warn', 'узел помечен недоступным', 'the node is marked unreachable'),
    mark('ok', 'под снова работает', 'the pod runs again'),
  ],
  stopLabel: bi('Восстановление остановилось', 'Recovery stopped'),
  concepts: ['k8s.node', 'k8s.kubelet'],
  diagram,
  params: [
    {
      id: 'grace',
      label: bi('Сколько секунд молчания терпят, прежде чем пометить узел (node-monitor-grace-period)', 'Seconds of silence before the node is marked (node-monitor-grace-period)'),
      kind: 'range',
      min: 20,
      max: 120,
      step: 10,
      default: 50,
      near: 'lease',
      group: bi('Таймеры кластера', 'Cluster timers'),
      predict: {
        prompt: bi('Вы меняете срок, после которого молчащий узел помечают недоступным. Сколько запросов теперь уйдёт на выключенный узел по сравнению с прошлым разом?', 'You change the grace period. How many requests now go to the dead node compared with before?'),
        options: [
          { id: 'fewer', text: bi('Меньше', 'Fewer') },
          { id: 'more', text: bi('Больше', 'More') },
          { id: 'same', text: bi('Столько же', 'The same') },
        ],
        resolve: (prev, next) => (metric(next, 'lost') < metric(prev, 'lost') ? 'fewer' : metric(next, 'lost') > metric(prev, 'lost') ? 'more' : 'same'),
      },
    },
    { id: 'toleration', label: bi('Сколько секунд под ждёт на недоступном узле до выселения (tolerationSeconds)', 'Seconds a pod waits on an unreachable node (tolerationSeconds)'), kind: 'range', min: 0, max: 600, step: 30, default: 300, near: 'w2', group: bi('Таймеры кластера', 'Cluster timers') },
    {
      id: 'back',
      label: bi('Когда worker-2 снова включают', 'When worker-2 comes back'),
      kind: 'choice',
      default: 'never',
      group: bi('Что происходит с узлом', 'What happens to the node'),
      options: [
        { id: 'never', label: bi('не включают', 'never') },
        { id: '60', label: bi('через 60 секунд', 'after 60 s') },
        { id: '600', label: bi('через 10 минут', 'after 10 minutes') },
      ],
      near: 'w2',
      predict: {
        prompt: bi('Узел worker-2 снова включили в выбранный момент. Где после этого будет работать замена пода web-b?', 'worker-2 comes back at the chosen moment. Where will web-b’s replacement run?'),
        options: [
          { id: 'stay', text: bi('Переезда не было, и web-b снова работает на worker-2', 'There was no move: web-b runs on worker-2 again') },
          { id: 'moved', text: bi('Под уже переехал на worker-1, а старый kubelet остановит сам', 'It has moved to worker-1; the kubelet stops the old one') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'evict') ? 'moved' : 'stay'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-cm',
      label: bi('kube-controller-manager остановлен, и контроллеры узлов и ReplicaSet не работают', 'kube-controller-manager is stopped'),
      remove: ['nlc', 'rs', 'e-check', 'e-taint', 'e-create'],
      boundary: 'process',
      predict: { prompt: bi('kube-controller-manager остановлен, а worker-2 выключился. Когда узел пометят недоступным?', 'controller-manager is stopped and worker-2 went down. When is the node marked unreachable?'), options: [{ id: 'never', text: bi('Никогда, и запросы на него так и будут пропадать', 'Never; requests keep being lost') }, { id: 'grace', text: bi('Через тот же срок, что и обычно', 'After the usual period') }], resolve: () => 'never' },
    },
  ],
  metrics: [
    { id: 't', label: bi('секунд с выключения', 'seconds since power-off') },
    { id: 'lost', label: bi('запросов ушло на выключенный узел', 'requests to the dead node') },
    { id: 'ready', label: bi('готовых подов из трёх', 'ready pods of three') },
  ],
  run(p, broken): Step[] {
    const noCm = broken.has('no-cm');
    const n = nodeDownNumbers(p, noCm);
    const backAt = p.back === 'never' ? Infinity : Number(p.back);
    const s: Step[] = [];
    const lostAt = (t: number) => Math.round(Math.min(t, noCm ? t : p.grace, backAt) * RPS * SHARE);
    s.push({
      id: 'off',
      label: 't = 0',
      caption: bi('У worker-2 выключилось питание, и под web-b остановился вместе с узлом. Но в API под по-прежнему записан как работающий и готовый, поэтому kube-proxy продолжает отправлять на него треть запросов, и эти запросы пропадают.', 'worker-2 lost power and web-b stopped with it, but in the API it is still Running and Ready, so a third of the requests still go to it and are lost.'),
      focus: ['w2'],
      say: { w2: bi('Питание worker-2 выключено, и под web-b остановился вместе с узлом.', 'worker-2 is off; web-b stopped with it.') },
      states: { ...only(ALL, 'w1', 'w2', 'w3', 'lease', 'e-renew'), w2: 'err' },
      values: { w2: tr(bi('web-b Running (сведения устарели)', 'web-b Running (stale)')), lease: renewed('0 с', '0s') },
      metrics: { t: 0, lost: 0, ready: 3 },
    });
    s.push({
      id: 'silence',
      label: 't = 10',
      caption: bi('Прошло десять секунд, и очередное продление Lease не пришло. Никто пока ничего не делает, потому что одно пропущенное сердцебиение ещё не повод считать узел потерянным, ведь это мог быть короткий сбой сети.', 'The next renewal did not come. Nobody acts yet: one missed heartbeat may be a network glitch.'),
      focus: ['lease', 'e-renew'],
      say: { lease: bi('Lease узла worker-2 не продлевали уже 10 секунд.', 'The Lease has not been renewed for 10 s.') },
      states: { 'e-renew': 'off' },
      values: { lease: renewed('10 с', '10s') },
      metrics: { t: 10, lost: lostAt(10), ready: 3 },
    });
    if (backAt <= p.grace && !noCm) {
      s.push({
        id: 'back',
        label: `t = ${backAt}`,
        caption: fmt(bi('Узел включили через {b} с, раньше, чем истёк срок ожидания. kubelet заново запустил контейнеры и продлил Lease, и узел так и не был помечен недоступным.', 'The node came back after {b} s, before the grace period: the kubelet restarted the containers and the node was never marked.'), { b: backAt }),
        focus: ['w2'],
        say: { w2: bi('worker-2 снова работает, и kubelet заново запустил под web-b.', 'worker-2 runs again; the kubelet restarted web-b.') },
        states: { w2: 'ok', 'e-renew': 'on' },
        values: { lease: renewed('0 с', '0s'), w2: tr(bi('web-b Running (перезапущен)', 'web-b Running (restarted)')) },
        metrics: { t: backAt, lost: n.lost, ready: 3 },
      });
      return s;
    }
    if (noCm) {
      s.push({
        id: 'nobody',
        label: bi('никто', 'nobody'),
        caption: bi('Lease устаревает всё сильнее, но контроллер, который должен это заметить, не работает. Поэтому узел остаётся в состоянии Ready, под остаётся в списке готовых, и запросы на него продолжают пропадать.', 'The Lease gets older, but the controller that checks it is down: the node stays Ready and requests keep being lost.'),
        focus: ['lease'],
        reveal: ['nlc'],
        say: { lease: bi('Lease не продлевали уже 15 минут, и никто этого не проверяет.', 'Not renewed for 15 minutes; nobody checks.') },
        values: { lease: renewed('15 мин', '15m') },
        metrics: { t: 900, lost: n.lost, ready: 2 },
        broken: { at: 'nlc', message: '$ kubectl get nodes\nNAME       STATUS   ROLES    AGE   VERSION\nworker-2   Ready    <none>   4d    v1.37.1+k3s1', caption: bi('на контроллере узлов. Без него молчание узла никто не превращает в состояние Unknown, и `kubectl get nodes` продолжает показывать Ready у машины, которая давно выключена.', 'at the node controller: nobody turns the silence into Unknown, and `kubectl get nodes` keeps showing Ready.') },
      });
      return s;
    }
    s.push({
      id: 'unknown',
      label: `t = ${p.grace}`,
      caption: fmt(bi('Lease не продлевали дольше {g} с, поэтому контроллер узлов помечает worker-2 недоступным. Он ставит узлу состояние Ready=Unknown и запрет unreachable:NoExecute, который не даёт подам оставаться там бесконечно.', 'The Lease is older than {g} s, so the node controller marks worker-2 unreachable. It gives the node Ready=Unknown and the unreachable:NoExecute taint, which keeps pods from staying on the node forever.'), { g: p.grace }),
      focus: ['nlc', 'e-check', 'e-taint'],
      reveal: ['nlc', 'api', 'e-check', 'e-taint'],
      tokens: [{ edge: 'e-taint', label: 'Ready=Unknown' }],
      say: { nlc: fmt(bi('Контроллер видит, что Lease не продлевали {g} с, и помечает worker-2 недоступным.', 'The controller sees {g} s of silence and marks worker-2 unreachable.'), { g: p.grace }) },
      states: { w2: 'warn' },
      values: { w2: 'NotReady', lease: renewed(`${p.grace} с`, `${p.grace}s`) },
      metrics: { t: p.grace, lost: n.lost, ready: 3 },
    });
    s.push({
      id: 'unready',
      label: `t = ${p.grace}`,
      caption: bi('Раз узел недоступен, под web-b на нём тоже становится неготовым и выпадает из списка, по которому kube-proxy раздаёт запросы. Поэтому с этого момента запросы перестают пропадать, хотя замены у пода ещё нет.', 'Since the node is unreachable, web-b on it becomes not ready too and drops out of the list kube-proxy sends requests to. From now on requests stop being lost, although the pod has no replacement yet.'),
      focus: ['w2'],
      say: { w2: bi('Под web-b на недоступном узле больше не получает запросов.', 'web-b on the unreachable node gets no more requests.') },
      values: { w2: 'NotReady · web-b NotReady' },
      metrics: { t: p.grace, lost: n.lost, ready: 2 },
    });
    const evictAt = p.grace + p.toleration;
    if (backAt <= evictAt) {
      s.push({
        id: 'back',
        label: `t = ${backAt}`,
        caption: fmt(bi('Узел включили через {b} с, раньше, чем истекло время ожидания пода. Запрет снят, под web-b снова готов на прежнем месте, и выселять его не пришлось.', 'The node came back after {b} s, before tolerationSeconds ran out: the taint is gone and web-b is ready in place.'), { b: backAt }),
        focus: ['w2'],
        say: { w2: bi('worker-2 снова работает, и под web-b готов на прежнем месте.', 'worker-2 is back; web-b is ready in place.') },
        states: { w2: 'ok' },
        values: { w2: 'Ready · web-b Running', lease: renewed('0 с', '0s') },
        metrics: { t: backAt, lost: n.lost, ready: 3 },
      });
      return s;
    }
    s.push({
      id: 'evict',
      label: `t = ${evictAt}`,
      caption: fmt(bi('Прошло ещё {t} с, то есть столько, сколько под готов ждать на недоступном узле, и под web-b помечается к удалению. Удалить его до конца некому, потому что kubelet на выключенном узле не работает, и под остаётся в состоянии Terminating.', 'After {t} s more web-b is marked for deletion; with the kubelet down it hangs in Terminating.'), { t: p.toleration }),
      focus: ['api', 'e-evict'],
      reveal: ['e-evict'],
      tokens: [{ edge: 'e-evict', label: 'Terminating' }],
      say: { api: bi('Срок ожидания пода истёк, и web-b помечается к удалению.', 'tolerationSeconds is over; web-b is marked for deletion.') },
      values: { w2: 'web-b Terminating' },
      metrics: { t: evictAt, lost: n.lost, ready: 2 },
    });
    s.push({
      id: 'replace',
      label: `t = ${evictAt + 5}`,
      caption: bi('Контроллер ReplicaSet не считает поды, помеченные к удалению, видит, что готовых подов два вместо трёх, и создаёт замену web-d. Планировщик ставит её на worker-1, потому что на недоступный узел ставить нельзя, и через несколько секунд под готов.', 'The ReplicaSet controller creates web-d; the scheduler puts it on worker-1, and it is ready seconds later.'),
      focus: ['rs', 'e-create'],
      reveal: ['rs', 'e-create'],
      tokens: [{ edge: 'e-create', label: 'web-d' }],
      say: { rs: bi('Контроллер ReplicaSet создаёт под web-d.', 'The ReplicaSet controller creates the replacement, web-d.') },
      values: { w3: 'web-c, web-d Running' },
      states: { w3: 'ok' },
      metrics: { t: evictAt + 5, lost: n.lost, ready: 3 },
    });
    if (backAt === 600)
      s.push({
        id: 'return',
        label: 't = 600',
        caption: bi('Узел включили уже после выселения. kubelet видит, что под web-b в API помечен к удалению, останавливает его и даёт API-серверу удалить объект: kubelet тоже сверяет то, что работает, с тем, что записано.', 'The node is back after the eviction: the kubelet sees web-b marked for deletion, stops it and lets the API remove it.'),
        focus: ['w2'],
        say: { w2: bi('kubelet на worker-2 останавливает под web-b, помеченный к удалению.', 'The kubelet stops web-b, marked for deletion.') },
        states: { w2: 'ok' },
        values: { w2: tr(bi('Ready · подов нет', 'Ready · no pods')), lease: renewed('0 с', '0s') },
        metrics: { t: 600, lost: n.lost, ready: 3 },
      });
    return s;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Без kube-controller-manager узел никогда не станет Unknown: молчание kubelet некому истолковать.', 'Without the controller-manager the node never becomes Unknown.')
        : bi('Контроллеры снова работают, и узел пометят, когда истечёт срок ожидания.', 'The controllers are back; the node will be marked after the grace period.');
    switch (change.id) {
      case 'grace':
        return fmt(bi('Срок ожидания теперь {g} с, и на выключенный узел ушло {b} запросов вместо {a}: пока узел не помечен, на него идёт треть запросов.', 'Grace {g} s: lost {a} → {b}; until marked, a third of the requests goes to it.'), { g: b.grace as number, a: metric(prev, 'lost'), b: metric(next, 'lost') });
      case 'toleration':
        return fmt(bi('Под теперь ждёт {t} с, и замена появляется на {r}-й секунде. Чем короче ожидание, тем быстрее переезд, но тем чаще поды переезжают зря после короткого сбоя сети. Число потерянных запросов при этом не меняется: через {g} с узел помечают недоступным, под выпадает из списка, по которому kube-proxy раздаёт запросы, и запросы на него больше не идут.', 'tolerationSeconds {t}: the replacement appears at {r} s. Shorter means faster moves, and more needless ones. The lost requests do not change: after {g} s the node is marked unreachable, the pod drops out of the list kube-proxy sends requests to, and no more requests go to it.'), { t: b.toleration as number, r: metric(next, 't'), g: b.grace as number });
      case 'back':
        return b.back === 'never'
          ? bi('Узел не включают, и поды переезжают по таймерам.', 'The node never returns: the pods move on the timers.')
          : next.some((s) => s.id === 'evict')
            ? bi('Узел включили поздно, когда замена подов уже работала на других узлах, поэтому kubelet останавливает старые поды.', 'Too late: the pods have moved; the kubelet stops the old ones.')
            : bi('Узел включили рано, и переносить поды на другие узлы не пришлось.', 'Early enough: nothing moved.');
    }
    return bi('Пересчитано.', 'Recomputed.');
  },
});
