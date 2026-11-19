// Э2, screen 4 (05 §6.3): the chain of loops. One command — scale 3 → 5 or a
// new image — and the loops light up one after another: the Deployment
// controller writes a ReplicaSet, the ReplicaSet controller writes pods, the
// scheduler writes bindings, the kubelet starts processes and writes status
// back. Every loop reads one object and writes another; stop any of them
// and the wave stops exactly at its step.
//
// Reading order: at first only you, the API server and the Deployment are on
// screen; each loop appears with the object it writes when the wave reaches it.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, fmtb, idsOf, LEGEND_BASE, mark, metric, num, only, PODS } from './kit';

type P = { replicas: number; action: string; workers: number };

export interface Wave {
  /** The loops that acted, in order. */
  fired: ('deploy' | 'rs' | 'sched' | 'kubelet' | 'status')[];
  newRs: boolean;
  created: number;
  bound: number;
  running: number;
  ready: number;
  /** Requests to the API server along the way. */
  writes: number;
  stop?: 'cm' | 'sched' | 'kubelet';
}

/** What the wave does for a change; shared by the steps and the tests. */
export function loopWave(p: P, broken: ReadonlySet<string> = new Set()): Wave {
  const image = p.action === 'image';
  const target = image ? 3 : p.replicas;
  const created = image ? 1 : Math.max(0, target - 3);
  const deleted = image ? 0 : Math.max(0, 3 - target);
  const w: Wave = { fired: [], newRs: image, created, bound: 0, running: 0, ready: 0, writes: 1 };
  if (broken.has('cm')) return { ...w, stop: 'cm' };
  w.fired.push('deploy');
  w.writes += 1;
  w.fired.push('rs');
  w.writes += created + deleted;
  if (!created) return { ...w, fired: [...w.fired, 'status'], writes: w.writes + 1 };
  if (broken.has('sched')) return { ...w, stop: 'sched' };
  w.fired.push('sched');
  w.bound = created;
  w.writes += created;
  if (broken.has('kubelet')) return { ...w, stop: 'kubelet' };
  w.fired.push('kubelet');
  w.running = created;
  w.ready = created;
  w.writes += created;
  w.fired.push('status');
  w.writes += 2;
  return w;
}

const CM = bi('Петля работает внутри процесса kube-controller-manager.', 'Runs inside kube-controller-manager.');

const diagram = {
  width: 960,
  height: 490,
  nodes: [
    box('you', bi('Вы, kubectl', 'You, kubectl'), 'user', 'pill', [24, 22, 190, 50], 'terminal', bi('Ваша команда превращается в один запрос PATCH к API-серверу, и на этом ваша часть работы заканчивается.', 'Your command becomes one PATCH; your part ends there.'), bi('Команду набираете вы.', 'You type it.'), { see: 'kubectl scale deployment web --replicas=5 -v=6' }),
    box('api', 'kube-apiserver', 'cp', 'hex', [380, 18, 200, 56], 'server', bi('API-сервер принимает записи, хранит их в etcd и сообщает об изменениях всем петлям. Сам он ничего не создаёт.', 'Accepts writes, stores them and tells every loop about changes; it creates nothing.'), bi('Работает на управляющем узле.', 'Runs on the control-plane node.'), { see: 'kubectl get --raw /readyz', doc: D.apiserver }),
    box('dep', 'Deployment web', 'obj', 'doc', [24, 116, 190, 74], 'file', bi('Deployment хранит желаемое состояние верхнего уровня, то есть число подов, которые должны работать, и шаблон, по которому их делать.', 'The top-level desired state: how many pods and from which template.'), bi('Объект пишете вы.', 'You write it.'), { see: 'kubectl get deploy web -o yaml', doc: D.deployment, sub: 'replicas: 3' }),
    box('rs', 'ReplicaSet', 'obj', 'doc', [24, 228, 190, 74], 'file', bi('Желаемое для одной версии шаблона. Этот объект пишете не вы, а петля Deployment.', 'The desired state for one template version, written by the Deployment loop.'), bi('Объект пишет петля Deployment.', 'Written by the Deployment loop.'), { see: 'kubectl get rs -l app=web', doc: D.rs, sub: 'web-5d78 · 3' }),
    box('pods', bi('Поды', 'Pods'), 'obj', 'buffer', [24, 340, 190, 74], 'container', bi('Объекты Pod. Сначала у них нет узла, потом планировщик записывает узел, а kubelet — состояние Running и Ready.', 'Pod objects: first without a node, then with one, then Running and Ready.'), bi('Объекты пишет петля ReplicaSet.', 'Written by the ReplicaSet loop.'), { see: 'kubectl get pods -o wide -w', doc: D.lifecycle, sub: '3' }),
    box('cdep', bi('Петля Deployment', 'Deployment loop'), 'cp', 'hex', [380, 124, 200, 56], 'process', bi('Читает Deployment и пишет ReplicaSet. Если изменился шаблон, петля создаёт новый ReplicaSet, а если изменилось только число подов, правит replicas у текущего.', 'Reads Deployments, writes ReplicaSets: a new template gets a new ReplicaSet, a new number changes the current one.'), CM, { doc: D.deployment }),
    box('crs', bi('Петля ReplicaSet', 'ReplicaSet loop'), 'cp', 'hex', [380, 236, 200, 56], 'process', bi('Читает ReplicaSet и его поды и пишет новые объекты Pod или удаляет лишние.', 'Reads the ReplicaSet and its pods and writes new Pods or deletes extra ones.'), CM, { doc: D.rs }),
    box('sched', bi('Планировщик', 'Scheduler'), 'cp', 'hex', [380, 348, 200, 56], 'process', bi('Читает поды без узла и записывает каждому выбранный узел.', 'Reads pods without a node and writes the chosen node.'), bi('Это процесс kube-scheduler.', 'kube-scheduler.'), { see: 'kubectl get events --field-selector reason=Scheduled', doc: D.scheduler }),
    box('klet', bi('kubelet на узлах', 'kubelets on the nodes'), 'node', 'rack', [716, 340, 220, 74], 'server', bi('Агент каждого узла. Он читает поды, назначенные на свой узел, запускает контейнеры и записывает их состояние: IP-адрес, Running, Ready.', 'Reads its node’s pods, starts containers and writes their status.'), bi('kubelet работает на каждом узле.', 'Runs on every node.'), { see: 'journalctl -u kubelet', doc: D.nodes, sub: 'worker-1, worker-2' }),
  ],
  edges: [
    edge('e-patch', 'you', 'api', bi('ваша запись', 'your write'), bi('Ваша команда делает одну запись, в которой меняется число подов или шаблон.', 'One write: spec.replicas or the template.'), bi('Запрос отправляет kubectl.', 'kubectl.')),
    edge('e-dep', 'cdep', 'dep', bi('читает', 'reads'), bi('Петля Deployment следит за объектами Deployment.', 'The Deployment loop watches Deployments.'), CM),
    edge('e-rsw', 'cdep', 'rs', bi('пишет', 'writes'), bi('Петля Deployment пишет ReplicaSet.', '…and writes ReplicaSets.'), CM, { via: [[300, 160], [300, 265]], labelAt: 0.6 }),
    edge('e-rsr', 'crs', 'rs', bi('читает', 'reads'), bi('Петля ReplicaSet следит за объектами ReplicaSet.', 'The ReplicaSet loop watches ReplicaSets.'), CM),
    edge('e-podw', 'crs', 'pods', bi('пишет', 'writes'), bi('Петля ReplicaSet создаёт объекты Pod по шаблону.', 'Creates Pod objects from the template.'), CM, { via: [[300, 272], [300, 377]], labelAt: 0.6 }),
    edge('e-bind', 'sched', 'pods', bi('узел пода', 'pod’s node'), bi('Планировщик дописывает поду выбранный узел (spec.nodeName).', 'The scheduler adds spec.nodeName.'), bi('kube-scheduler', 'kube-scheduler')),
    edge('e-run', 'klet', 'pods', bi('свои поды', 'my pods'), bi('kubelet видит поды, у которых в nodeName записан его узел.', 'The kubelet sees pods whose nodeName is its node.'), bi('kubelet', 'kubelet'), { via: [[826, 456], [119, 456]], labelAt: 0.5, dashed: true }),
    edge('e-status', 'klet', 'api', bi('состояние подов', 'pod status'), bi('kubelet записывает состояние подов, и по нему петли выше обновляют число готовых подов.', 'The kubelet writes pod status; the loops above update readyReplicas from it.'), bi('kubelet', 'kubelet'), { via: [[826, 46]], labelAt: 0.6 }),
  ],
};

const ALL = idsOf(diagram);

export const loopChainModel = defineModel<P>({
  id: 'k8s.loop-chain',
  frame: 'visible',
  block: 'k8s-1',
  title: bi('Как одна команда проходит по цепочке петель', 'How one command passes through a chain of loops'),
  summary: bi(
    'В Kubernetes нет программы, которая «выполняет вашу команду». Есть четыре петли, и каждая читает один объект, а пишет другой: петля Deployment пишет ReplicaSet, петля ReplicaSet пишет поды, планировщик записывает подам узлы, а kubelet запускает контейнеры и пишет их состояние. Одно изменение проходит по этим петлям волной сверху вниз.',
    'No program “runs your command”: four loops each read one object and write another. One change passes through them as a wave.',
  ),
  intro: bi(
    'Сейчас на схеме вы, API-сервер и Deployment web, в котором записано три пода. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Вы попросите пять подов, и петли будут появляться по одной вместе с объектом, который каждая пишет. Потом смените в «Параметрах» образ вместо числа подов, а затем остановите в блоке «Сломать» одну из петель и посмотрите, где оборвётся волна.',
    'For now: you, the API server and Deployment web with three pods. Press “Start from the first step” and go on with “Step forward”: you ask for five pods, and the loops appear one by one with the object each writes. Then change the image instead, and stop a loop in “Break it”.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:file', 'объект с желаемым состоянием', 'an object with the desired state'),
    mark('icon:process', 'петля управляющего слоя', 'a control-plane loop'),
    mark('icon:server', 'kubelet на узлах', 'the kubelets'),
    mark('ok', 'петля сделала свою часть', 'the loop did its part'),
    mark('warn', 'поды застряли', 'pods stuck'),
  ],
  stopLabel: bi('Волна остановилась', 'The wave stopped'),
  concepts: ['k8s.controller', 'k8s.scheduler', 'k8s.kubelet'],
  diagram,
  params: [
    {
      id: 'action',
      label: bi('Что вы меняете в Deployment', 'What you change'),
      kind: 'choice',
      default: 'scale',
      group: bi('Ваша команда', 'Your command'),
      options: [
        { id: 'scale', label: bi('число подов (kubectl scale)', 'the number of pods') },
        { id: 'image', label: bi('образ в шаблоне (kubectl set image)', 'the template image') },
      ],
      near: 'dep',
      predict: {
        prompt: bi('Вы меняете образ в шаблоне, а не число подов. Какая петля поведёт себя иначе, чем при изменении числа?', 'You change the image, not the number. Which loop behaves differently?'),
        options: [
          { id: 'dep', text: bi('Петля Deployment, которая создаст новый ReplicaSet', 'The Deployment loop: it creates a new ReplicaSet') },
          { id: 'kubelet', text: bi('kubelet, который перезапустит контейнеры на месте с новым образом', 'The kubelet: it restarts containers in place') },
        ],
        resolve: () => 'dep',
      },
    },
    { id: 'replicas', label: bi('Сколько подов вы просите (сейчас их три)', 'Pods you ask for (now three)'), kind: 'range', min: 1, max: 8, step: 1, default: 5, near: 'dep', group: bi('Ваша команда', 'Your command') },
    { id: 'workers', label: bi('Сколько в кластере рабочих узлов', 'Worker nodes'), kind: 'range', min: 1, max: 3, step: 1, default: 2, near: 'klet', levels: ['intermediate', 'experienced'], group: bi('Кластер', 'The cluster') },
  ],
  breaks: [
    {
      id: 'cm',
      label: bi('kube-controller-manager остановлен, и петли Deployment и ReplicaSet не работают', 'kube-controller-manager is stopped'),
      remove: ['cdep', 'crs'],
      boundary: 'process',
      predict: { prompt: bi('kube-controller-manager остановлен, и вы просите пять подов вместо трёх. Что покажет `kubectl get deploy web`?', 'controller-manager is stopped and you ask for five. What does `kubectl get deploy web` show?'), options: [{ id: 'stuck', text: bi('Желаемых подов 5, а работает по-прежнему 3', 'Five wanted, still three running') }, { id: 'error', text: bi('Ошибку, потому что команду некому выполнить', 'An error: nobody runs the command') }], resolve: () => 'stuck' },
    },
    {
      id: 'sched',
      label: bi('kube-scheduler остановлен', 'kube-scheduler is stopped'),
      remove: ['sched', 'e-bind'],
      boundary: 'process',
      predict: { prompt: bi('kube-scheduler остановлен, а контроллеры работают. Где остановится волна?', 'The scheduler is stopped. Where does the wave stop?'), options: [{ id: 'pending', text: bi('Поды будут созданы, но останутся без узла в состоянии Pending', 'Pods are created but stay Pending') }, { id: 'none', text: bi('Поды даже не будут созданы', 'Pods are not even created') }], resolve: () => 'pending' },
    },
    {
      id: 'kubelet',
      label: bi('kubelet на узлах остановлен', 'The kubelets are stopped'),
      remove: ['klet', 'e-status'],
      boundary: 'process',
      predict: { prompt: bi('kubelet на узлах не работает, а всё остальное в порядке. Что покажет `kubectl get pods -o wide` для новых подов?', 'The kubelets are down. What does `kubectl get pods -o wide` show for the new pods?'), options: [{ id: 'pending', text: bi('Узел у подов записан, но они не запущены и остаются Pending', 'A node is set, but they stay Pending') }, { id: 'running', text: bi('Running, потому что узел уже назначен', 'Running: a node is assigned') }], resolve: () => 'pending' },
    },
  ],
  metrics: [
    { id: 'writes', label: bi('запросов к API-серверу', 'API requests') },
    { id: 'ready', label: bi('новых подов готово', 'new pods ready') },
  ],
  run(p, broken): Step[] {
    const w = loopWave(p, broken);
    const image = p.action === 'image';
    const target = image ? 3 : p.replicas;
    const s: Step[] = [];
    let writes = 1;
    s.push({
      id: 'patch',
      label: bi('запрос', 'request'),
      caption: image
        ? bi('Вы меняете образ в шаблоне Deployment на версию 1.1. API-сервер записывает новый шаблон в etcd, и больше ничего не происходит, потому что сам API-сервер подов не создаёт.', 'You change the image to 1.1. The API server stores the template, and that is all.')
        : fmt(bi('Вы просите {n} подов вместо трёх. API-сервер записывает в Deployment spec.replicas={n}, и больше ничего не происходит, потому что сам API-сервер подов не создаёт.', 'You ask for {n}. The API server stores spec.replicas={n}, and that is all.'), { n: target }),
      focus: ['you', 'e-patch'],
      states: only(ALL, 'you', 'api', 'dep', 'e-patch'),
      tokens: [{ edge: 'e-patch', label: image ? 'image: 1.1' : `replicas: ${target}` }],
      say: { you: image ? bi('Вы меняете образ в шаблоне Deployment web.', 'You change the template image.') : fmt(bi('Вы просите {n} подов.', 'You ask for {n} pods.'), { n: target }) },
      values: { dep: image ? 'image: 1.1' : `replicas: ${target}` },
      metrics: { writes, ready: 0 },
    });
    if (w.stop === 'cm') {
      s.push({
        id: 'stuck',
        label: bi('тишина', 'silence'),
        caption: bi('Новое желаемое записано, но петли Deployment и ReplicaSet не работают, и ни ReplicaSet, ни поды не меняются.', 'The desired state is stored, but the loops are down: nothing changes.'),
        focus: ['api'],
        reveal: ['cdep', 'crs'],
        say: { api: bi('API-сервер хранит новое желаемое, но ни одна петля его не читает.', 'The API server holds the change; no loop reads it.') },
        states: { cdep: 'err', crs: 'err' },
        metrics: { writes, ready: 0 },
        broken: { at: 'cdep', message: `$ kubectl get deploy web\nNAME   READY   UP-TO-DATE   AVAILABLE   AGE\nweb    3/${target}     3            3           4d`, caption: bi('на первой же петле. Без kube-controller-manager желаемое ни во что не превращается, и в выводе `kubectl get deploy` число после косой черты меняется, а число готовых подов нет.', 'at the first loop: without kube-controller-manager the desired state turns into nothing.') },
      });
      return s;
    }
    writes += 1;
    s.push({
      id: 'deploy',
      label: bi('петля 1', 'loop 1'),
      caption: image
        ? bi('Петля Deployment видит новый шаблон и создаёт второй ReplicaSet с новым хешем шаблона в имени. Старый ReplicaSet пока держит свои три пода.', 'The Deployment loop sees a new template and creates a second ReplicaSet; the old one still holds three pods.')
        : fmt(bi('Петля Deployment видит разницу между Deployment и его ReplicaSet и правит replicas у текущего ReplicaSet: теперь {n}.', 'The Deployment loop sets the current ReplicaSet’s replicas to {n}.'), { n: target }),
      focus: ['cdep', 'e-dep', 'e-rsw'],
      reveal: ['cdep', 'e-dep', 'e-rsw', 'rs'],
      tokens: [{ edge: 'e-rsw', label: image ? 'create ReplicaSet' : `replicas: ${target}` }],
      say: { cdep: image ? bi('Петля Deployment создаёт ReplicaSet для нового шаблона.', 'The Deployment loop creates a new ReplicaSet.') : bi('Петля Deployment меняет число подов в ReplicaSet.', 'The Deployment loop changes the ReplicaSet’s count.') },
      states: { cdep: 'ok' },
      values: { rs: image ? 'web-7c4f · 1 (+ web-5d78 · 3)' : `web-5d78 · ${target}` },
      metrics: { writes, ready: 0 },
    });
    writes += w.created + (image ? 0 : Math.max(0, 3 - target));
    s.push({
      id: 'rs',
      label: bi('петля 2', 'loop 2'),
      caption: w.created
        ? fmtb(bi('Петля ReplicaSet видит, что подов не хватает, и создаёт {n}. Новые поды пока остаются только записями. Узла у них нет, и ни один контейнер не запущен.', 'The ReplicaSet loop creates {n}: records only, no node, no container.'), { n: num(w.created, ...PODS) })
        : bi('Подов больше, чем нужно, и петля ReplicaSet удаляет лишние. Дальше по цепочке делать нечего, потому что новых подов нет.', 'There are too many pods; the ReplicaSet loop deletes the extra ones. Nothing more to do.'),
      focus: ['crs', 'e-rsr', 'e-podw'],
      reveal: ['crs', 'e-rsr', 'e-podw', 'pods'],
      tokens: [{ edge: 'e-podw', label: w.created ? `${w.created} × create pod` : 'delete pod' }],
      say: { crs: w.created ? fmtb(bi('Петля ReplicaSet создаёт {n} по шаблону.', 'The ReplicaSet loop creates {n}.'), { n: num(w.created, ...PODS) }) : bi('Петля ReplicaSet удаляет лишние поды.', 'The ReplicaSet loop deletes extra pods.') },
      states: { crs: 'ok' },
      values: { pods: `${image ? 4 : target}` },
      fill: { pods: 0.5 },
      metrics: { writes, ready: 0 },
    });
    if (!w.created) {
      s.push({
        id: 'status',
        label: bi('итог', 'result'),
        caption: bi('Петли обновляют состояние ReplicaSet и Deployment: желаемое и фактическое совпали, и волна закончилась.', 'The statuses are updated: desired and actual match, the wave is over.'),
        focus: ['crs'],
        say: { crs: bi('Петля ReplicaSet видит, что подов столько, сколько нужно.', 'The ReplicaSet loop sees the right number.') },
        metrics: { writes: w.writes, ready: 0 },
      });
      return s;
    }
    if (w.stop === 'sched') {
      s.push({
        id: 'pending',
        label: 'Pending',
        caption: bi('Новые поды созданы, но узел им выбрать некому, потому что kube-scheduler не работает. Поэтому ни один kubelet их никогда не увидит.', 'The pods exist, but nobody picks a node, so no kubelet ever sees them.'),
        focus: ['pods'],
        reveal: ['sched'],
        say: { pods: bi('Новые поды ждут узла, и выбрать его некому.', 'New pods wait for a node; nobody picks one.') },
        states: { sched: 'err', pods: 'warn' },
        metrics: { writes, ready: 0 },
        broken: { at: 'sched', message: '$ kubectl get pods\nNAME              READY   STATUS    RESTARTS   AGE\nweb-5d78c-q4x2m   0/1     Pending   0          2m', caption: bi('на выборе узла. Без планировщика под остаётся в состоянии Pending навсегда, и в его событиях нет даже FailedScheduling.', 'at scheduling: Pending forever, without even FailedScheduling.') },
      });
      return s;
    }
    writes += w.bound;
    const spread = Array.from({ length: w.created }, (_, i) => `worker-${(i % p.workers) + 1}`);
    s.push({
      id: 'sched',
      label: bi('петля 3', 'loop 3'),
      caption: fmt(bi('Планировщик видит поды без узла, выбирает каждому узел и записывает выбор: {list}.', 'The scheduler picks nodes: {list}.'), { list: spread.join(', ') }),
      focus: ['sched', 'e-bind'],
      reveal: ['sched', 'e-bind'],
      tokens: [{ edge: 'e-bind', label: `nodeName: ${spread[0]}` }],
      say: { sched: bi('Планировщик записывает новым подам узлы.', 'The scheduler writes nodes for the new pods.') },
      states: { sched: 'ok' },
      metrics: { writes, ready: 0 },
    });
    if (w.stop === 'kubelet') {
      s.push({
        id: 'nostart',
        label: bi('не запущены', 'not started'),
        caption: bi('Узел подам назначен, но kubelet на узлах не работает, поэтому контейнеры никто не запускает, и состояние подов никто не пишет.', 'A node is set, but the kubelets are down: nobody starts the containers or writes their status.'),
        focus: ['pods'],
        reveal: ['klet'],
        say: { pods: bi('У новых подов записан узел, но контейнеры на нём никто не запускает.', 'The pods have a node, but nobody starts them.') },
        states: { klet: 'err', pods: 'warn' },
        metrics: { writes, ready: 0 },
        broken: { at: 'klet', message: '$ kubectl get pods -o wide\nNAME              READY   STATUS    NODE\nweb-5d78c-q4x2m   0/1     Pending   worker-1', caption: bi('на узле. В объекте написано worker-1, а на worker-1 ничего не запущено. Под в состоянии Pending с уже назначенным узлом выдаёт неработающий kubelet.', 'on the node: Pending with a node set is the sign of a kubelet that is down.') },
      });
      return s;
    }
    writes += w.running;
    s.push({
      id: 'kubelet',
      label: bi('петля 4', 'loop 4'),
      caption: bi('kubelet на каждом узле видит свои новые поды, запускает их контейнеры и записывает состояние: IP-адрес, Running и Ready.', 'Each kubelet sees its new pods, starts them and writes IP, Running, Ready.'),
      focus: ['klet', 'e-run', 'e-status'],
      reveal: ['klet', 'e-run', 'e-status'],
      tokens: [{ edge: 'e-status', label: 'Ready' }],
      say: { klet: bi('kubelet запускает новые поды и сообщает, что они готовы.', 'The kubelet starts the pods and reports them ready.') },
      states: { klet: 'ok', pods: 'ok' },
      fill: { pods: 1 },
      metrics: { writes, ready: w.ready },
    });
    s.push({
      id: 'status',
      label: bi('итог', 'result'),
      caption: image
        ? bi('Новый под готов, и волна идёт обратно вверх, так что петля Deployment уменьшит старый ReplicaSet на один под и увеличит новый. Выкладка новой версии и есть много таких маленьких волн.', 'The new pod is ready and the wave goes back up: the old ReplicaSet shrinks by one, the new one grows. A rollout is many small waves.')
        : bi('Петли выше читают состояние подов и обновляют число готовых. Сообщения «готово» никто не отправлял, потому что каждая петля сама снова посмотрела на состояние объектов.', 'The loops above read pod status and update readyReplicas. Nobody sent “done”: each loop looked at the state again.'),
      focus: ['cdep'],
      say: { cdep: image ? bi('Петля Deployment видит готовый новый под и продолжает выкладку.', 'The Deployment loop sees the new pod ready and goes on.') : bi('Петля Deployment видит, что все поды готовы.', 'The Deployment loop sees all pods ready.') },
      values: { dep: image ? t(bi('image: 1.1 · обновлено 1 из 3', 'image: 1.1 · 1 / 3 updated')) : t(fmt(bi('replicas: {n} · готово {n}', 'replicas: {n} · ready {n}'), { n: target })) },
      metrics: { writes: w.writes, ready: w.ready },
    });
    return s;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Одна петля остановлена, и волна обрывается на её шаге. Всё, что выше, записано, а всё, что ниже, не случилось.', 'One loop is stopped: the wave stops at its step.')
        : bi('Петля снова работает и сразу догоняет состояние.', 'The loop runs again and catches up at once.');
    if (change.id === 'replicas') return fmt(bi('Вы просите {y} подов вместо {x}. Запросов к API-серверу по пути набралось {w}, и каждая петля сделала свою часть.', 'replicas {x} → {y}: {w} API requests.'), { x: Number(a.replicas), y: Number(b.replicas), w: metric(next, 'writes') });
    if (change.id === 'action') return b.action === 'image' ? bi('Новый шаблон получает новый ReplicaSet: так у Deployment появляются ревизии.', 'A new template gets a new ReplicaSet: that is how revisions appear.') : bi('Новое число подов меняет replicas у того же ReplicaSet.', 'A new number changes the same ReplicaSet.');
    return bi('Планировщик раскладывает новые поды по доступным узлам.', 'The scheduler spreads the new pods over the nodes.');
  },
});
