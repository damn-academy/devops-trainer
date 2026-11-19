// Э2, screen 4 (05 §6.3): the chain of loops. One command — scale 3 → 5 or a
// new image — and the loops light up one after another: the Deployment
// controller writes a ReplicaSet, the ReplicaSet controller writes pods, the
// scheduler writes bindings, the kubelet starts processes and writes status
// back. Every loop reads one object and writes another; stop any of them
// and the wave stops exactly at its step.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

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

export const loopChainModel = defineModel<P>({
  id: 'k8s.loop-chain',
  block: 'k8s-1',
  title: bi('Цепочка петель: от kubectl scale до процесса на узле', 'The chain of loops: from kubectl scale to a process on a node'),
  summary: bi('В Kubernetes нет одной программы, которая «выполняет команду». Есть четыре петли, и каждая читает один объект, а пишет другой. Одно изменение проходит по ним волной.', 'Kubernetes has no single program that "carries out the command". There are four loops, and each reads one object and writes another. One change passes through them as a wave.'),
  concepts: ['k8s.controller', 'k8s.scheduler', 'k8s.kubelet'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      node('you', 'kubectl', 'user', 'pill', 24, 24, 150, 44, bi('Вы: команда превращается в один PATCH к API-серверу. На этом ваша работа кончается.', 'You: the command turns into one PATCH to the API server. Your part ends there.'), bi('вы', 'you'), 'kubectl scale deployment web --replicas=5 -v=6'),
      node('api', 'kube-apiserver', 'cp', 'hex', 380, 20, 200, 56, bi('Принимает записи, хранит их в etcd и раздаёт изменения всем петлям через watch. Сам ничего не создаёт.', 'Accepts writes, stores them in etcd and hands the changes to every loop through watch. It creates nothing by itself.'), bi('control plane', 'the control plane'), 'kubectl get --raw /readyz', D.apiserver),
      node('dep', 'Deployment web', 'obj', 'doc', 24, 120, 190, 70, bi('Желаемое верхнего уровня: сколько подов и по какому шаблону.', 'The top-level desired state: how many pods and from which template.'), bi('вы', 'you'), 'kubectl get deploy web -o yaml', D.deployment, 'replicas: 3'),
      node('rs', 'ReplicaSet', 'obj', 'doc', 24, 230, 190, 70, bi('Желаемое для одной версии шаблона. Его пишет контроллер Deployment, а не вы.', 'The desired state for one version of the template. The Deployment controller writes it, not you.'), bi('контроллер Deployment', 'the Deployment controller'), 'kubectl get rs -l app=web', D.rs, 'web-5d78 · 3'),
      node('pods', bi('поды', 'pods'), 'obj', 'buffer', 24, 340, 190, 70, bi('Объекты Pod. Сначала без nodeName, потом с ним, потом со статусом Running и Ready.', 'Pod objects. First without a nodeName, then with one, then with status Running and Ready.'), bi('контроллер ReplicaSet', 'the ReplicaSet controller'), 'kubectl get pods -o wide -w', D.lifecycle, '3'),
      node('cdep', bi('петля Deployment', 'Deployment loop'), 'cp', 'hex', 380, 120, 200, 56, bi('Читает Deployment, пишет ReplicaSet: при новом шаблоне создаёт новый ReplicaSet, при новом числе — правит replicas текущего.', 'Reads the Deployment, writes ReplicaSets: a new template gets a new ReplicaSet, a new number changes replicas of the current one.'), bi('kube-controller-manager', 'kube-controller-manager'), undefined, D.deployment),
      node('crs', bi('петля ReplicaSet', 'ReplicaSet loop'), 'cp', 'hex', 380, 220, 200, 56, bi('Читает ReplicaSet и поды по селектору, пишет новые объекты Pod (или удаляет лишние).', 'Reads the ReplicaSet and the pods by selector, writes new Pod objects (or deletes extra ones).'), bi('kube-controller-manager', 'kube-controller-manager'), undefined, D.rs),
      node('sched', bi('планировщик', 'scheduler'), 'cp', 'hex', 380, 320, 200, 56, bi('Читает поды без nodeName, пишет Binding — выбранный узел.', 'Reads pods without a nodeName, writes a Binding — the chosen node.'), bi('kube-scheduler', 'kube-scheduler'), 'kubectl get events --field-selector reason=Scheduled', D.scheduler),
      node('klet', 'kubelet', 'node', 'rack', 720, 320, 220, 70, bi('Читает поды своего узла, запускает контейнеры через рантайм и пишет status: Running, Ready, IP.', 'Reads the pods of its node, starts containers through the runtime and writes status: Running, Ready, the IP.'), bi('агент каждого узла', 'the agent of every node'), 'journalctl -u kubelet', D.nodes, 'worker-1, worker-2'),
    ],
    edges: [
      edge('e-patch', 'you', 'api', 'PATCH', bi('Одна запись: spec.replicas или шаблон.', 'One write: spec.replicas or the template.'), bi('kubectl', 'kubectl')),
      edge('e-dep', 'cdep', 'dep', bi('читает', 'reads'), bi('Петля Deployment следит за Deployment.', 'The Deployment loop watches Deployments.'), bi('client-go watch', 'client-go watch')),
      edge('e-rsw', 'cdep', 'rs', bi('пишет', 'writes'), bi('…и пишет ReplicaSet.', '…and writes ReplicaSets.'), bi('kube-controller-manager', 'kube-controller-manager'), { via: [[300, 160], [300, 265]], labelAt: 0.6 }),
      edge('e-rsr', 'crs', 'rs', bi('читает', 'reads'), bi('Петля ReplicaSet следит за ReplicaSet.', 'The ReplicaSet loop watches ReplicaSets.'), bi('client-go watch', 'client-go watch')),
      edge('e-podw', 'crs', 'pods', bi('пишет', 'writes'), bi('…и создаёт объекты Pod по шаблону.', '…and creates Pod objects from the template.'), bi('kube-controller-manager', 'kube-controller-manager'), { via: [[300, 260], [300, 375]], labelAt: 0.6 }),
      edge('e-bind', 'sched', 'pods', 'Binding', bi('Планировщик дописывает поду узел (spec.nodeName).', 'The scheduler adds a node to the pod (spec.nodeName).'), bi('kube-scheduler', 'kube-scheduler')),
      edge('e-run', 'klet', 'sched', bi('свои поды', 'my pods'), bi('kubelet видит поды, у которых nodeName — его узел.', 'The kubelet sees the pods whose nodeName is its own node.'), bi('kubelet', 'kubelet'), { dashed: true }),
      edge('e-status', 'klet', 'api', 'status', bi('kubelet пишет статус пода; по нему петли выше обновляют readyReplicas.', 'The kubelet writes the pod status; the loops above update readyReplicas from it.'), bi('kubelet', 'kubelet'), { via: [[830, 48]], labelAt: 0.6 }),
    ],
  },
  params: [
    {
      id: 'action',
      label: bi('Что меняем', 'What we change'),
      kind: 'choice',
      default: 'scale',
      options: [
        { id: 'scale', label: bi('число реплик', 'the number of replicas') },
        { id: 'image', label: bi('образ в шаблоне', 'the image in the template') },
      ],
      near: 'dep',
      predict: {
        prompt: bi('Сменили образ, а не число. Какая петля сработает иначе?', 'The image changed, not the number. Which loop behaves differently?'),
        options: [
          { id: 'dep', text: bi('Петля Deployment: создаст новый ReplicaSet', 'The Deployment loop: it creates a new ReplicaSet') },
          { id: 'kubelet', text: bi('kubelet: перезапустит контейнеры на месте', 'The kubelet: it restarts the containers in place') },
        ],
        resolve: () => 'dep',
      },
    },
    { id: 'replicas', label: bi('replicas (было 3)', 'replicas (was 3)'), kind: 'range', min: 1, max: 8, step: 1, default: 5, near: 'dep' },
    { id: 'workers', label: bi('рабочих узлов', 'worker nodes'), kind: 'range', min: 1, max: 3, step: 1, default: 2, near: 'klet', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'cm',
      label: bi('Остановить kube-controller-manager', 'Stop kube-controller-manager'),
      remove: ['cdep', 'crs'],
      boundary: 'process',
      predict: { prompt: bi('Контроллеров нет. Что покажет kubectl get deploy после scale?', 'No controllers. What does kubectl get deploy show after scale?'), options: [{ id: 'stuck', text: bi('Желаемое 5, остальное как было', 'Desired 5, the rest as before') }, { id: 'error', text: bi('Ошибку: команду некому выполнить', 'An error: nobody to run the command') }], resolve: () => 'stuck' },
    },
    {
      id: 'sched',
      label: bi('Остановить kube-scheduler', 'Stop kube-scheduler'),
      remove: ['sched', 'e-bind'],
      boundary: 'process',
      predict: { prompt: bi('Планировщика нет. Где остановится волна?', 'No scheduler. Where does the wave stop?'), options: [{ id: 'pending', text: bi('Поды созданы, но висят в Pending', 'The pods are created but hang in Pending') }, { id: 'none', text: bi('Поды даже не создадутся', 'The pods are not even created') }], resolve: () => 'pending' },
    },
    {
      id: 'kubelet',
      label: bi('Остановить kubelet на узлах', 'Stop the kubelet on the nodes'),
      remove: ['klet', 'e-status'],
      boundary: 'process',
      predict: { prompt: bi('kubelet не работает. Что увидит kubectl get pods?', 'The kubelet is down. What does kubectl get pods show?'), options: [{ id: 'pending', text: bi('Поды с узлом, но не запущены', 'Pods with a node, but not started') }, { id: 'running', text: bi('Running: узел ведь назначен', 'Running: a node is assigned, after all') }], resolve: () => 'pending' },
    },
  ],
  metrics: [
    { id: 'writes', label: bi('запросов к API', 'API requests') },
    { id: 'ready', label: bi('новых подов Ready', 'new pods Ready') },
  ],
  run(p, broken): Step[] {
    const w = loopWave(p, broken);
    const image = p.action === 'image';
    const target = image ? 3 : p.replicas;
    const s: Step[] = [];
    let writes = 1;
    s.push({ id: 'patch', label: 'PATCH', caption: image ? bi('Вы поменяли образ в шаблоне Deployment. API-сервер записал новый шаблон — и только.', 'You changed the image in the Deployment template. The API server stored the new template — and that is all.') : fmt(bi('Вы попросили {n} реплик. API-сервер записал spec.replicas={n} — и только.', 'You asked for {n} replicas. The API server stored spec.replicas={n} — and that is all.'), { n: target }), focus: ['you', 'e-patch', 'api', 'dep'], tokens: [{ edge: 'e-patch', label: image ? 'image: 1.1' : `replicas: ${target}` }], values: { dep: image ? 'image: 1.1' : `replicas: ${target}` }, metrics: { writes, ready: 0 } });
    if (w.stop === 'cm') {
      s.push({ id: 'stuck', label: bi('тишина', 'silence'), caption: bi('Запись лежит в etcd, но петель Deployment и ReplicaSet нет: ReplicaSet и поды не меняются.', 'The record sits in etcd, but there are no Deployment and ReplicaSet loops: the ReplicaSet and the pods do not change.'), focus: ['cdep', 'crs'], states: { cdep: 'off', crs: 'off' }, metrics: { writes, ready: 0 }, broken: { at: 'cdep', message: `$ kubectl get deploy web\nNAME   READY   UP-TO-DATE   AVAILABLE   AGE\nweb    3/${target}     3            3           4d`, caption: bi('без kube-controller-manager желаемое не превращается ни во что.', 'without kube-controller-manager the desired state turns into nothing.') } });
      return s;
    }
    writes += 1;
    s.push({ id: 'deploy', label: bi('петля 1', 'loop 1'), caption: image ? bi('Петля Deployment увидела новый шаблон и создала второй ReplicaSet — с новым хешем шаблона в имени.', 'The Deployment loop saw a new template and created a second ReplicaSet — with the new template hash in its name.') : fmt(bi('Петля Deployment увидела разницу и поправила replicas у текущего ReplicaSet: {n}.', 'The Deployment loop saw the difference and changed replicas of the current ReplicaSet: {n}.'), { n: target }), focus: ['cdep', 'e-dep', 'e-rsw', 'rs'], tokens: [{ edge: 'e-dep' }, { edge: 'e-rsw', label: image ? 'create rs' : `replicas: ${target}` }], states: { cdep: 'ok' }, values: { rs: image ? 'web-7c4f · 1 (+ web-5d78 · 3)' : `web-5d78 · ${target}` }, metrics: { writes, ready: 0 } });
    writes += w.created + (image ? 0 : Math.max(0, 3 - target));
    s.push({ id: 'rs', label: bi('петля 2', 'loop 2'), caption: w.created ? fmt(bi('Петля ReplicaSet насчитала разницу +{n} и создала {n} объектов Pod. Узла у них пока нет.', 'The ReplicaSet loop counted a difference of +{n} and created {n} Pod objects. They have no node yet.'), { n: w.created }) : bi('Подов стало больше, чем нужно: петля ReplicaSet удалила лишние. Дальше по цепочке делать нечего.', 'There are more pods than needed: the ReplicaSet loop deleted the extra ones. Nothing to do further down the chain.'), focus: ['crs', 'e-rsr', 'e-podw', 'pods'], tokens: [{ edge: 'e-podw', label: w.created ? `${w.created} × create` : 'delete' }], states: { crs: 'ok' }, values: { pods: `${image ? 4 : target}` }, fill: { pods: 0.5 }, metrics: { writes, ready: 0 } });
    if (!w.created) {
      s.push({ id: 'status', label: 'status', caption: bi('Статусы ReplicaSet и Deployment обновились: желаемое и фактическое совпали.', 'The ReplicaSet and Deployment statuses were updated: desired and actual match.'), focus: ['dep', 'rs'], metrics: { writes: w.writes, ready: 0 } });
      return s;
    }
    if (w.stop === 'sched') {
      s.push({ id: 'pending', label: 'Pending', caption: bi('Поды есть, но без nodeName: выбрать им узел некому, и kubelet их никогда не увидит.', 'The pods exist, but without a nodeName: nobody picks a node for them, and no kubelet ever sees them.'), focus: ['sched', 'pods'], states: { sched: 'off', pods: 'warn' }, metrics: { writes, ready: 0 }, broken: { at: 'sched', message: '$ kubectl get pods\nNAME              READY   STATUS    RESTARTS   AGE\nweb-5d78c-q4x2m   0/1     Pending   0          2m', caption: bi('без планировщика под навсегда остаётся Pending, и в его событиях даже нет FailedScheduling.', 'without a scheduler a pod stays Pending forever, and its events do not even show FailedScheduling.') } });
      return s;
    }
    writes += w.bound;
    const spread = Array.from({ length: w.created }, (_, i) => `worker-${(i % p.workers) + 1}`);
    s.push({ id: 'sched', label: bi('петля 3', 'loop 3'), caption: fmt(bi('Планировщик выбрал узлы и записал Binding: {list}.', 'The scheduler chose nodes and wrote Bindings: {list}.'), { list: spread.join(', ') }), focus: ['sched', 'e-bind', 'pods'], tokens: [{ edge: 'e-bind', label: `${w.bound} × bind` }], states: { sched: 'ok' }, metrics: { writes, ready: 0 } });
    if (w.stop === 'kubelet') {
      s.push({ id: 'nostart', label: bi('не запущены', 'not started'), caption: bi('Узел назначен, но kubelet не работает: процесс никто не запустил, статус никто не пишет.', 'A node is assigned, but the kubelet is down: nobody started a process, nobody writes the status.'), focus: ['klet', 'pods'], states: { klet: 'off', pods: 'warn' }, metrics: { writes, ready: 0 }, broken: { at: 'klet', message: '$ kubectl get pods -o wide\nNAME              READY   STATUS    NODE\nweb-5d78c-q4x2m   0/1     Pending   worker-1', caption: bi('объект говорит «worker-1», а на worker-1 ничего не запущено: Pending с узлом — признак мёртвого kubelet.', 'the object says "worker-1", but nothing runs on worker-1: Pending with a node is the sign of a dead kubelet.') } });
      return s;
    }
    writes += w.running;
    s.push({ id: 'kubelet', label: bi('петля 4', 'loop 4'), caption: bi('kubelet каждого узла увидел свои новые поды, создал песочницу и контейнеры через рантайм и записал status: IP, Running, Ready.', 'The kubelet of each node saw its new pods, created the sandbox and containers through the runtime and wrote the status: IP, Running, Ready.'), focus: ['klet', 'e-run', 'e-status'], tokens: [{ edge: 'e-run' }, { edge: 'e-status', label: 'Ready' }], states: { klet: 'ok', pods: 'ok' }, fill: { pods: 1 }, metrics: { writes, ready: w.ready } });
    s.push({ id: 'status', label: 'status', caption: image ? bi('Новый под готов — и волна пошла обратно вверх: петля Deployment уменьшит старый ReplicaSet на один и увеличит новый. Так и выглядит rolling update — много маленьких волн.', 'The new pod is ready — and the wave goes back up: the Deployment loop shrinks the old ReplicaSet by one and grows the new one. A rolling update is exactly that — many small waves.') : bi('Петли выше прочитали статусы подов и обновили readyReplicas. Никто не отправлял «готово» — каждая петля просто снова посмотрела на состояние.', 'The loops above read the pod statuses and updated readyReplicas. Nobody sent "done" — each loop simply looked at the state again.'), focus: ['dep', 'rs', 'cdep', 'crs'], values: { dep: image ? 'image: 1.1 · 1 of 3 updated' : `replicas: ${target} · ready ${target}` }, metrics: { writes: w.writes, ready: w.ready } });
    return s;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Одна петля выключена — волна обрывается ровно на её шаге, всё выше записано, всё ниже не случилось.', 'One loop is off — the wave stops exactly at its step: everything above is written, nothing below happened.') : bi('Петля снова работает и сразу догоняет состояние.', 'The loop runs again and catches up with the state at once.');
    if (change.id === 'replicas') return fmt(bi('replicas {x} → {y}: запросов к API — {w}. Каждая петля сделала свою часть.', 'replicas {x} → {y}: API requests — {w}. Each loop did its own part.'), { x: Number(a.replicas), y: Number(b.replicas), w: metric(next, 'writes') });
    if (change.id === 'action') return b.action === 'image' ? bi('Новый шаблон — новый ReplicaSet: так у Deployment появляются ревизии.', 'A new template — a new ReplicaSet: this is how a Deployment gets revisions.') : bi('Новое число — тот же ReplicaSet, другое replicas.', 'A new number — the same ReplicaSet, a different replicas.');
    return bi('Планировщик раскладывает новые поды по доступным узлам.', 'The scheduler spreads the new pods over the available nodes.');
  },
});
