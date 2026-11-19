// "Kubernetes from blocks" (05 §6.2): the learner drags components onto the
// canvas — control plane on top, node components below — and wires them;
// a wire is typed: only real connections are accepted, and a forbidden one
// says why. "Run" starts kube-lite with exactly what is on the canvas: a
// missing or unwired component is switched off, and the scenario shows the
// real kubectl output of such a cluster (no scheduler → Pending, no etcd →
// nothing persists, no kube-proxy → ClusterIP times out, no CoreDNS → the
// name is not resolved).

import './kube.css';
import { clear, h, s } from '../../../core/dom';
import { bi, t, type Bi } from '../../../core/i18n';
import type { ColorFamily, Mounted, WidgetCtx, WidgetReg } from '../../../core/types';
import { createSimMachine } from '../../terminal/shell';
import { stripAnsi } from '../../terminal/shell';
import type { Components } from '../cluster';
import { k8sState } from '../state';
import { placeLabel, type Box } from '../../explainer/tidy';

type Zone = 'client' | 'cp' | 'node';

interface Comp {
  id: string;
  label: string;
  sub: Bi;
  zone: Zone;
  family: ColorFamily;
  x: number;
  y: number;
  what: Bi;
  who: Bi;
  see: string;
  doc: string;
  /** What breaks without it (05 §6.2 table). */
  without: Bi;
}

const W = 170;
const H = 52;

export const COMPONENTS: Comp[] = [
  {
    id: 'kubectl',
    label: 'kubectl',
    sub: bi('ваш терминал', 'your terminal'),
    zone: 'client',
    family: 'user',
    x: 20,
    y: 40,
    what: bi('Клиент API: превращает команду или файл в HTTP-запрос к kube-apiserver.', 'An API client: turns a command or a file into an HTTP request to kube-apiserver.'),
    who: bi('Вы ставите его на свой компьютер; адрес сервера и ключи берёт из kubeconfig.', 'You install it on your machine; it takes the server address and keys from kubeconfig.'),
    see: 'kubectl config view --minify',
    doc: 'https://kubernetes.io/docs/reference/kubectl/',
    without: bi('Без него вы не можете ничего попросить у кластера — но сам кластер работает.', 'Without it you cannot ask the cluster for anything — but the cluster itself keeps running.'),
  },
  {
    id: 'apiserver',
    label: 'kube-apiserver',
    sub: bi('единственная дверь', 'the only door'),
    zone: 'cp',
    family: 'cp',
    x: 330,
    y: 44,
    what: bi('HTTP API кластера. Проверяет, кто вы и можно ли, проставляет значения по умолчанию, проверяет объект и сохраняет его в etcd. Все остальные компоненты разговаривают только с ним.', 'The HTTP API of the cluster. It checks who you are and whether you may, fills in defaults, validates the object and stores it in etcd. Every other component talks only to it.'),
    who: bi('Статический под на узле control plane (в k3s — часть процесса k3s server).', 'A static pod on the control-plane node (in k3s, part of the k3s server process).'),
    see: 'kubectl get --raw /readyz?verbose',
    doc: 'https://kubernetes.io/docs/concepts/overview/components/#kube-apiserver',
    without: bi('Любая команда kubectl падает: «The connection to the server 127.0.0.1:6443 was refused». Уже запущенные поды продолжают работать.', 'Every kubectl command fails: "The connection to the server 127.0.0.1:6443 was refused". Pods that already run keep running.'),
  },
  {
    id: 'etcd',
    label: 'etcd',
    sub: bi('хранит желаемое', 'stores the desired state'),
    zone: 'cp',
    family: 'store',
    x: 600,
    y: 44,
    what: bi('Хранилище «ключ — значение»: здесь лежат все объекты кластера под ключами /registry/…, у каждого изменения — новый номер resourceVersion.', 'A key-value store: every object of the cluster lives here under /registry/… keys, every change gets a new resourceVersion.'),
    who: bi('Статический под на узле control plane (k3s по умолчанию хранит то же самое в SQLite через kine).', 'A static pod on the control-plane node (k3s keeps the same in SQLite via kine by default).'),
    see: 'cluster etcd /registry/pods',
    doc: 'https://kubernetes.io/docs/concepts/overview/components/#etcd',
    without: bi('API-серверу негде хранить объекты: «etcdserver: request timed out», ничего не сохраняется.', 'The API server has nowhere to keep objects: "etcdserver: request timed out", nothing persists.'),
  },
  {
    id: 'scheduler',
    label: 'kube-scheduler',
    sub: bi('выбирает узел', 'picks a node'),
    zone: 'cp',
    family: 'cp',
    x: 200,
    y: 128,
    what: bi('Смотрит поды без узла, фильтрует узлы (хватит ли ресурсов, подходят ли метки и taints), оценивает оставшиеся и записывает выбор — объект Binding.', 'Watches pods without a node, filters nodes (enough resources? matching labels and taints?), scores the rest and records its choice as a Binding.'),
    who: bi('Статический под на узле control plane.', 'A static pod on the control-plane node.'),
    see: 'kubectl get events --field-selector reason=FailedScheduling',
    doc: 'https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/',
    without: bi('Поды навсегда в Pending, в describe «Node: <none>» и ни одного события FailedScheduling — их некому писать.', 'Pods stay Pending forever, describe shows "Node: <none>" and not a single FailedScheduling event — nobody writes them.'),
  },
  {
    id: 'controller-manager',
    label: 'kube-controller-manager',
    sub: bi('петли сверки', 'reconcile loops'),
    zone: 'cp',
    family: 'cp',
    x: 460,
    y: 128,
    what: bi('Один процесс с десятками контроллеров: Deployment, ReplicaSet, EndpointSlice, Job, Namespace, node-lifecycle, сборщик мусора. Каждый сравнивает желаемое с фактическим и делает шаг навстречу.', 'One process with dozens of controllers: Deployment, ReplicaSet, EndpointSlice, Job, Namespace, node lifecycle, the garbage collector. Each compares desired with actual and takes a step towards it.'),
    who: bi('Статический под на узле control plane.', 'A static pod on the control-plane node.'),
    see: 'kubectl get rs,endpointslices',
    doc: 'https://kubernetes.io/docs/concepts/architecture/controller/',
    without: bi('Deployment создан, но ReplicaSet нет, READY 0/3; удалённый под не возвращается; EndpointSlice пуст.', 'The Deployment is created, but there is no ReplicaSet, READY 0/3; a deleted pod does not come back; the EndpointSlice is empty.'),
  },
  {
    id: 'kubelet',
    label: 'kubelet',
    sub: bi('агент узла', 'the node agent'),
    zone: 'node',
    family: 'node',
    x: 40,
    y: 270,
    what: bi('Агент на каждом узле: видит поды, назначенные его узлу, просит рантайм их запустить, гоняет пробы, пишет статус и раз в 10 секунд продлевает Lease узла.', 'The agent on every node: sees the pods assigned to its node, asks the runtime to start them, runs probes, writes their status and renews the node Lease every 10 seconds.'),
    who: bi('Служба systemd на каждом узле (в k3s — часть процесса k3s agent).', 'A systemd service on every node (in k3s, part of the k3s agent process).'),
    see: 'kubectl get lease -n kube-node-lease',
    doc: 'https://kubernetes.io/docs/concepts/overview/components/#kubelet',
    without: bi('Узлы через 50 секунд Unknown/NotReady, поды на них никто не запускает; через 300 секунд их выселяют.', 'After 50 seconds the nodes are Unknown/NotReady and nobody starts pods on them; after 300 seconds they are evicted.'),
  },
  {
    id: 'runtime',
    label: 'containerd',
    sub: bi('рантайм контейнеров', 'container runtime'),
    zone: 'node',
    family: 'process',
    x: 300,
    y: 270,
    what: bi('Рантайм контейнеров: тянет образы, создаёт песочницу пода и контейнеры (через runc/crun). kubelet говорит с ним по CRI — gRPC.', 'The container runtime: pulls images, creates the pod sandbox and the containers (through runc/crun). The kubelet talks to it over CRI — gRPC.'),
    who: bi('Служба systemd на каждом узле; тот же containerd, что стоит под Docker.', 'A systemd service on every node; the same containerd that sits under Docker.'),
    see: 'crictl ps   # on a node',
    doc: 'https://kubernetes.io/docs/setup/production-environment/container-runtimes/',
    without: bi('Узел NotReady: «container runtime is down», поды висят в ContainerCreating.', 'The node is NotReady: "container runtime is down", pods hang in ContainerCreating.'),
  },
  {
    id: 'cni',
    label: 'CNI (flannel)',
    sub: bi('сеть подов', 'pod network'),
    zone: 'node',
    family: 'l3',
    x: 560,
    y: 270,
    what: bi('Сетевой плагин: по команде ADD создаёт поду интерфейс, выдаёт IP из podCIDR узла и прописывает маршрут; между узлами строит маршруты или туннель.', 'The network plugin: on ADD it creates the pod interface, gives it an IP from the node podCIDR and adds the route; between nodes it builds routes or a tunnel.'),
    who: bi('Бинарник в /opt/cni/bin и конфиг в /etc/cni/net.d на каждом узле; демон плагина — DaemonSet.', 'A binary in /opt/cni/bin and a config in /etc/cni/net.d on every node; the plugin daemon is a DaemonSet.'),
    see: "kubectl get node worker-1 -o jsonpath='{.spec.podCIDR}'",
    doc: 'https://kubernetes.io/docs/concepts/cluster-administration/networking/',
    without: bi('Узел NotReady: «cni plugin not initialized», поды в ContainerCreating с FailedCreatePodSandBox.', 'The node is NotReady: "cni plugin not initialized", pods in ContainerCreating with FailedCreatePodSandBox.'),
  },
  {
    id: 'kube-proxy',
    label: 'kube-proxy',
    sub: bi('правила Service', 'Service rules'),
    zone: 'node',
    family: 'l4',
    x: 40,
    y: 370,
    what: bi('Смотрит Service и EndpointSlice и пишет в ядро узла правила iptables/nftables: пакет на ClusterIP подменяется на IP одного из подов (DNAT).', 'Watches Services and EndpointSlices and writes iptables/nftables rules into the node kernel: a packet to a ClusterIP is rewritten to the IP of one of the pods (DNAT).'),
    who: bi('DaemonSet (в k3s — встроен в процесс k3s).', 'A DaemonSet (in k3s, built into the k3s process).'),
    see: 'cluster iptables worker-1',
    doc: 'https://kubernetes.io/docs/reference/networking/virtual-ips/',
    without: bi('Запрос по IP пода проходит, по ClusterIP — тайм-аут: правил DNAT никто не написал.', 'A request to a pod IP works, to a ClusterIP it times out: nobody wrote the DNAT rules.'),
  },
  {
    id: 'coredns',
    label: 'CoreDNS',
    sub: bi('имена сервисов', 'service names'),
    zone: 'node',
    family: 'l7',
    x: 300,
    y: 370,
    what: bi('DNS-сервер кластера: отвечает на имя web.default.svc.cluster.local адресом ClusterIP. Сам работает подами за Service kube-dns (10.43.0.10).', 'The cluster DNS server: answers web.default.svc.cluster.local with the ClusterIP. It runs as pods behind the kube-dns Service (10.43.0.10).'),
    who: bi('Deployment в kube-system, его ставит установщик кластера.', 'A Deployment in kube-system, installed by the cluster installer.'),
    see: 'kubectl -n kube-system get deploy coredns',
    doc: 'https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/',
    without: bi('curl http://10.43.x.y работает, curl http://web — «Could not resolve host».', 'curl http://10.43.x.y works, curl http://web says "Could not resolve host".'),
  },
];

interface WireDef {
  a: string;
  b: string;
  label: string;
  what: Bi;
}

export const WIRES: WireDef[] = [
  { a: 'kubectl', b: 'apiserver', label: 'HTTPS REST', what: bi('kubectl шлёт GET/POST/PATCH/DELETE на https://…:6443 с сертификатом из kubeconfig.', 'kubectl sends GET/POST/PATCH/DELETE to https://…:6443 with the certificate from kubeconfig.') },
  { a: 'apiserver', b: 'etcd', label: 'gRPC /registry/…', what: bi('Только API-сервер читает и пишет etcd: ключи /registry/<ресурс>/<namespace>/<имя>.', 'Only the API server reads and writes etcd: keys /registry/<resource>/<namespace>/<name>.') },
  { a: 'scheduler', b: 'apiserver', label: 'watch pods · POST binding', what: bi('Планировщик смотрит поды без узла и записывает выбор через подресурс binding.', 'The scheduler watches pods without a node and records its choice through the binding subresource.') },
  { a: 'controller-manager', b: 'apiserver', label: 'watch · create/update', what: bi('Контроллеры смотрят свои объекты и создают или меняют другие — всё через API.', 'Controllers watch their objects and create or change others — all through the API.') },
  { a: 'kubelet', b: 'apiserver', label: 'watch my pods · PATCH status · Lease', what: bi('kubelet смотрит поды своего узла, пишет их статус и продлевает Lease.', 'The kubelet watches the pods of its node, writes their status and renews the Lease.') },
  { a: 'kubelet', b: 'runtime', label: 'gRPC CRI', what: bi('Container Runtime Interface: RunPodSandbox, CreateContainer, StartContainer…', 'Container Runtime Interface: RunPodSandbox, CreateContainer, StartContainer…') },
  { a: 'runtime', b: 'cni', label: 'CNI ADD/DEL', what: bi('Создав сетевое пространство песочницы, рантайм вызывает плагин CNI: ADD — дать поду сеть.', 'Having created the sandbox network namespace, the runtime calls the CNI plugin: ADD — give the pod a network.') },
  { a: 'kube-proxy', b: 'apiserver', label: 'watch Services, EndpointSlices', what: bi('kube-proxy смотрит Service и EndpointSlice и переписывает правила ядра своего узла.', 'kube-proxy watches Services and EndpointSlices and rewrites its node’s kernel rules.') },
  { a: 'coredns', b: 'apiserver', label: 'watch Services', what: bi('CoreDNS смотрит Service и отвечает на их имена.', 'CoreDNS watches Services and answers their names.') },
];

const key = (a: string, b: string) => [a, b].sort().join('|');
const wireOf = (a: string, b: string) => WIRES.find((w) => key(w.a, w.b) === key(a, b));

/** Why a connection does not exist (shown above the rejected wire). */
export function whyNot(a: string, b: string): Bi {
  const pair = new Set([a, b]);
  if (pair.has('etcd')) return bi('В etcd ходит только kube-apiserver. Остальные читают и пишут состояние кластера через API-сервер.', 'Only kube-apiserver talks to etcd. Everyone else reads and writes the cluster state through the API server.');
  if (pair.has('scheduler') && pair.has('kubelet'))
    return bi('Планировщик не говорит kubelet’у «запусти». Он записывает nodeName в под через API-сервер, а kubelet, который смотрит API, видит: этот под теперь мой.', 'The scheduler does not tell the kubelet "start it". It writes nodeName into the pod through the API server, and the kubelet, watching the API, sees: this pod is mine now.');
  if (pair.has('kubelet') && pair.has('cni')) return bi('kubelet сам CNI не вызывает: он просит рантайм по CRI создать песочницу, а уже рантайм зовёт плагин CNI.', 'The kubelet does not call CNI itself: it asks the runtime over CRI to create the sandbox, and the runtime calls the CNI plugin.');
  if (pair.has('kubectl')) return bi('kubectl знает один адрес — API-сервера из kubeconfig. С остальными компонентами он не разговаривает.', 'kubectl knows one address — the API server from kubeconfig. It does not talk to any other component.');
  if (pair.has('runtime') && pair.has('apiserver')) return bi('Рантайм ничего не знает о Kubernetes и его API: им управляет kubelet по CRI.', 'The runtime knows nothing about Kubernetes and its API: the kubelet drives it over CRI.');
  if (pair.has('cni') && pair.has('apiserver')) return bi('Плагин CNI — исполняемый файл, который вызывает рантайм; с API-сервером он не разговаривает (его демон может, но для сети подов это не нужно).', 'The CNI plugin is an executable the runtime calls; it does not talk to the API server (its daemon may, but pod networking does not need it).');
  return bi('Компоненты не разговаривают друг с другом напрямую: каждый смотрит API-сервер и записывает туда результат своей работы.', 'Components do not talk to each other directly: each one watches the API server and writes the result of its work there.');
}

export interface CanvasState {
  placed: string[];
  wires: string[];
}

/** Which kube-lite components are on, from what is placed and wired. */
export function componentsFrom(st: CanvasState): { components: Partial<Components>; kubelet: boolean; runtime: boolean; missing: string[]; kubectl: boolean } {
  const has = (id: string) => st.placed.includes(id);
  const wired = (a: string, b: string) => st.wires.includes(key(a, b));
  const on = (id: string, to: string) => has(id) && has(to) && wired(id, to);
  const apiserver = has('apiserver');
  const etcd = on('etcd', 'apiserver');
  const kubelet = on('kubelet', 'apiserver');
  const runtime = kubelet && on('runtime', 'kubelet');
  const cni = runtime && on('cni', 'runtime');
  const comps: Partial<Components> = {
    apiserver,
    etcd,
    scheduler: on('scheduler', 'apiserver'),
    'controller-manager': on('controller-manager', 'apiserver'),
    'kube-proxy': on('kube-proxy', 'apiserver'),
    coredns: on('coredns', 'apiserver'),
    cni,
  };
  const missing: string[] = [];
  const add = (id: string, ok: boolean) => !ok && missing.push(id);
  add('apiserver', apiserver);
  add('etcd', etcd);
  add('scheduler', !!comps.scheduler);
  add('controller-manager', !!comps['controller-manager']);
  add('kubelet', kubelet);
  add('runtime', runtime);
  add('cni', cni);
  add('kube-proxy', !!comps['kube-proxy']);
  add('coredns', !!comps.coredns);
  return { components: comps, kubelet, runtime, missing, kubectl: on('kubectl', 'apiserver') };
}

interface Scenario {
  id: string;
  label: Bi;
  lines: string[];
}

const SCENARIOS: Scenario[] = [
  { id: 'apply', label: bi('Deployment на 3 реплики', 'Deployment with 3 replicas'), lines: ['kubectl create deployment web --image=trainer/web:1.0 --replicas=3', 'cluster ff 30s', 'kubectl get deploy,rs,pods -o wide'] },
  { id: 'delete', label: bi('Удалить под', 'Delete a pod'), lines: ['kubectl create deployment web --image=trainer/web:1.0 --replicas=3', 'cluster ff 30s', 'kubectl delete pod -l app=web --wait=false', 'cluster ff 20s', 'kubectl get pods'] },
  { id: 'node', label: bi('Узел выключился', 'A node lost power'), lines: ['kubectl create deployment web --image=trainer/web:1.0 --replicas=3', 'cluster ff 30s', 'cluster power off worker-2', 'cluster ff 6m', 'kubectl get nodes', 'kubectl get pods -o wide'] },
  {
    id: 'service',
    label: bi('Запрос к Service по имени', 'A request to a Service by name'),
    lines: ['kubectl create deployment web --image=trainer/web:1.0 --replicas=2 --port=80', 'kubectl expose deployment web --port=80', 'kubectl run client --image=trainer/client:1.0', 'cluster ff 30s', 'kubectl get svc web', 'kubectl exec client -- curl -sS http://web', "kubectl exec client -- curl -sS http://$(kubectl get svc web -o jsonpath='{.spec.clusterIP}')"],
  },
];

const L = {
  palette: bi('Компоненты', 'Components'),
  paletteHint: bi('Перетащите блок на холст или нажмите на него. Чтобы провести провод, нажмите на один блок на холсте, затем на другой.', 'Drag a block onto the canvas or press it. To draw a wire, press one block on the canvas, then another.'),
  cp: bi('control plane', 'control plane'),
  nodes: bi('узлы: cp-1, worker-1, worker-2', 'nodes: cp-1, worker-1, worker-2'),
  run: bi('Запустить кластер из того, что на холсте', 'Run a cluster made of what is on the canvas'),
  remove: bi('Убрать с холста', 'Remove from the canvas'),
  removeWire: bi('Убрать провод', 'Remove the wire'),
  full: bi('Собрать всё правильно', 'Assemble everything correctly'),
  clearAll: bi('Очистить холст', 'Clear the canvas'),
  who: bi('Кто создаёт', 'Who creates it'),
  see: bi('Как посмотреть', 'How to look at it'),
  without: bi('Если убрать', 'If you remove it'),
  wrongZone: bi('Этот компонент живёт в другой зоне: ', 'This component lives in another zone: '),
  running: bi('Кластер запускается…', 'Starting the cluster…'),
  verdictOk: bi('Все компоненты на месте и соединены: кластер ведёт себя как настоящий k3s.', 'Every component is in place and wired: the cluster behaves like a real k3s.'),
  verdictMissing: bi('Выключено, потому что нет на холсте или нет провода: ', 'Switched off because it is not on the canvas or not wired: '),
  pick: bi('Нажмите на любой блок или провод, и появится карточка с его объяснением.', 'Press any block or wire — it explains itself.'),
};

function blockShape(c: Comp): SVGElement {
  const fam = `var(--c-${c.family === 'user' ? 'user-line' : c.family})`;
  const fill = `color-mix(in oklch, ${fam} 12%, var(--surface))`;
  if (c.zone === 'cp') {
    const k = 12;
    const d = `M${k},0 H${W - k} L${W},${H / 2} L${W - k},${H} H${k} L0,${H / 2} Z`;
    return s('path', { d, fill, stroke: fam });
  }
  return s('rect', { width: W, height: H, rx: c.zone === 'node' ? 4 : 6, fill, stroke: fam });
}

function placeWireLabels(labels: { text: SVGTextElement; a: { x: number; y: number }; b: { x: number; y: number } }[], placed: Comp[]): void {
  if (!labels.length || typeof labels[0].text.getComputedTextLength !== 'function' || !labels[0].text.isConnected) return;
  const blocks: Box[] = placed.map((c) => ({ x: c.x - 2, y: c.y - 2, w: W + 4, h: H + 4 }));
  const lines = labels.map((l) => [[l.a.x, l.a.y], [l.b.x, l.b.y]] as [[number, number], [number, number]]);
  const taken: Box[] = [];
  const order = [...labels].sort((p, q) => Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) - Math.hypot(q.a.x - q.b.x, q.a.y - q.b.y));
  for (const l of order) {
    const w = l.text.getComputedTextLength() + 6;
    if (!w) return;
    const box = placeLabel([[l.a.x, l.a.y], [l.b.x, l.b.y]], 0.5, w, 13, [...blocks, ...taken], lines);
    taken.push(box);
    l.text.setAttribute('x', (box.x + box.w / 2).toFixed(1));
    l.text.setAttribute('y', (box.y + box.h / 2 + 3.5).toFixed(1));
  }
}

function mountConstructor(root: HTMLElement, props: unknown, ctx: WidgetCtx): Mounted {
  const p = (props ?? {}) as { preset?: 'empty' | 'full' };
  const st: CanvasState = { placed: ['kubectl'], wires: [] };
  if (p.preset === 'full') {
    st.placed = COMPONENTS.map((c) => c.id);
    st.wires = WIRES.map((w) => key(w.a, w.b));
  }
  let selected: string | null = null;
  let disposed = false;
  let fullOk = false;
  let brokenRun = false;
  const VW = 880;
  const VH = 450;

  const svg = s('svg', { viewBox: `0 0 ${VW} ${VH}`, role: 'img', 'aria-label': t(bi('Холст конструктора', 'Constructor canvas')) }) as SVGSVGElement;
  const canvas = h('div.kc-canvas', {}, svg);
  const card = h('div.kc-card', { 'aria-live': 'polite' }, h('p.kx-note', {}, t(L.pick)));
  const why = h('p.kc-why', { 'aria-live': 'polite' });
  const out = h('pre.kx-pre', { 'aria-live': 'polite' });
  const verdict = h('div.kc-verdict');
  const runBtns = h('div.kx-row');
  const palette = h('div.kc-palette', {}, h('h4.kx-h', {}, t(L.palette)), h('p.kx-note', {}, t(L.paletteHint)));

  const zoneOf = (y: number): Zone => (y < 215 ? 'cp' : 'node');

  const renderPalette = () => {
    for (const el of [...palette.querySelectorAll('.kc-item')]) el.remove();
    for (const c of COMPONENTS.filter((x) => x.zone !== 'client')) {
      const on = st.placed.includes(c.id);
      const item = h(
        'button.kc-item',
        { type: 'button', 'aria-pressed': on ? 'true' : 'false', style: `--fam: var(--c-${c.family})`, 'data-id': c.id },
        h('span.sw', { 'aria-hidden': 'true' }),
        h('span', {}, c.label),
        h('small', {}, t(c.sub)),
      );
      item.addEventListener('pointerdown', (e) => startDrag(e as PointerEvent, c));
      item.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          e.preventDefault();
          place(c);
        }
      });
      palette.append(item);
    }
  };

  const place = (c: Comp) => {
    if (st.placed.includes(c.id)) return;
    st.placed.push(c.id);
    showCard(c.id);
    render();
  };

  // Drag from the palette: a ghost follows the pointer; dropping on the right zone places the block.
  const startDrag = (e: PointerEvent, c: Comp) => {
    if (st.placed.includes(c.id)) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const ghost = h('div.kc-item.kc-ghost', { style: `position:fixed;left:${startX}px;top:${startY}px;z-index:50;--fam: var(--c-${c.family})` }, h('span.sw'), h('span', {}, c.label));
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 6 && !moved) {
        moved = true;
        document.body.append(ghost);
      }
      if (moved) {
        ghost.style.left = `${ev.clientX - 40}px`;
        ghost.style.top = `${ev.clientY - 16}px`;
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.remove();
      if (!moved) {
        place(c);
        return;
      }
      const r = svg.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
      const y = ((ev.clientY - r.top) / r.height) * VH;
      const z = zoneOf(y);
      if (z !== c.zone) {
        why.textContent = t(L.wrongZone) + (c.zone === 'cp' ? t(bi('control plane — он управляет всем кластером, а не одним узлом.', 'the control plane — it runs the whole cluster, not one node.')) : t(bi('узлы — он работает на каждом узле и отвечает за его поды и правила.', 'the nodes — it runs on every node and looks after its pods and rules.')));
        return;
      }
      why.textContent = '';
      place(c);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const showCard = (id: string) => {
    clear(card);
    const c = COMPONENTS.find((x) => x.id === id);
    if (c) {
      card.append(
        h('h5', {}, c.label),
        h('p', {}, t(c.what)),
        h('p', {}, h('strong', {}, `${t(L.who)}: `), t(c.who)),
        h('p', {}, h('strong', {}, `${t(L.see)}: `), h('code', {}, c.see)),
        h('p', {}, h('strong', {}, `${t(L.without)}: `), t(c.without)),
        h('p', {}, h('a', { href: c.doc, target: '_blank', rel: 'noopener' }, 'kubernetes.io')),
      );
      if (c.zone !== 'client' && st.placed.includes(c.id))
        card.append(
          h(
            'button.btn.ghost.small',
            {
              type: 'button',
              onclick: () => {
                st.placed = st.placed.filter((x) => x !== c.id);
                st.wires = st.wires.filter((w) => !w.split('|').includes(c.id));
                selected = null;
                clear(card);
                card.append(h('p.kx-note', {}, t(L.pick)));
                render();
              },
            },
            t(L.remove),
          ),
        );
      return;
    }
    const w = WIRES.find((x) => key(x.a, x.b) === id);
    if (w) {
      card.append(
        h('h5', {}, h('code', {}, w.label)),
        h('p', {}, t(w.what)),
        h(
          'button.btn.ghost.small',
          {
            type: 'button',
            onclick: () => {
              st.wires = st.wires.filter((x) => x !== id);
              clear(card);
              card.append(h('p.kx-note', {}, t(L.pick)));
              render();
            },
          },
          t(L.removeWire),
        ),
      );
    }
  };

  const center = (c: Comp) => ({ x: c.x + W / 2, y: c.y + H / 2 });

  const pressBlock = (id: string) => {
    showCard(id);
    if (selected && selected !== id) {
      const w = wireOf(selected, id);
      if (w) {
        if (!st.wires.includes(key(selected, id))) st.wires.push(key(selected, id));
        why.textContent = '';
        flash = key(selected, id);
      } else {
        badWire = { a: selected, b: id };
        why.textContent = t(whyNot(selected, id));
      }
      selected = null;
    } else selected = selected === id ? null : id;
    render();
  };

  let flash: string | null = null;
  let badWire: { a: string; b: string } | null = null;

  const render = () => {
    clear(svg);
    svg.append(
      s('rect.kc-zone', { x: 190, y: 16, width: 676, height: 190, rx: 10 }),
      s('text.kc-zone-label', { x: 206, y: 36 }, t(L.cp)),
      s('rect.kc-zone', { x: 14, y: 236, width: 852, height: 200, rx: 10 }),
      s('text.kc-zone-label', { x: 30, y: 256 }, t(L.nodes)),
    );
    const placed = COMPONENTS.filter((c) => st.placed.includes(c.id));
    const labels: { text: SVGTextElement; a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
    for (const k of st.wires) {
      const [a, b] = k.split('|');
      const ca = COMPONENTS.find((c) => c.id === a)!;
      const cb = COMPONENTS.find((c) => c.id === b)!;
      const pa = center(ca);
      const pb = center(cb);
      const w = WIRES.find((x) => key(x.a, x.b) === k)!;
      const g = s('g', { tabindex: 0, role: 'button', 'aria-label': w.label });
      g.append(s(`line.kc-wire${flash === k ? '.flash' : ''}`, { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y }));
      const label = s('text.kc-wlabel', { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 - 4, 'text-anchor': 'middle' }, w.label) as SVGTextElement;
      label.addEventListener('click', () => showCard(k));
      labels.push({ text: label, a: pa, b: pb });
      g.addEventListener('click', () => showCard(k));
      g.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && showCard(k));
      svg.append(g);
    }
    if (badWire) {
      const ca = COMPONENTS.find((c) => c.id === badWire!.a)!;
      const cb = COMPONENTS.find((c) => c.id === badWire!.b)!;
      const pa = center(ca);
      const pb = center(cb);
      svg.append(s('line.kc-wire.bad', { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y }), s('text.kc-wlabel.bad', { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 - 4, 'text-anchor': 'middle' }, t(bi('нет такой связи', 'no such link'))));
      badWire = null;
    }
    for (const c of placed) {
      const g = s(`g.kc-block${selected === c.id ? '.sel' : ''}`, { transform: `translate(${c.x},${c.y})`, tabindex: 0, role: 'button', 'aria-label': `${c.label}: ${t(c.sub)}`, style: `--fam: var(--c-${c.family})` });
      g.append(blockShape(c), s('text', { x: W / 2, y: 22, 'text-anchor': 'middle' }, c.label), s('text.sub', { x: W / 2, y: 39, 'text-anchor': 'middle' }, t(c.sub)));
      g.addEventListener('click', () => pressBlock(c.id));
      g.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          e.preventDefault();
          pressBlock(c.id);
        }
      });
      svg.append(g);
    }
    // Wire labels go on top of the blocks, each where it covers no block, no other label and no other wire.
    for (const l of labels) svg.append(l.text);
    placeWireLabels(labels, placed);
    flash = null;
    renderPalette();
    renderVerdict();
  };

  const renderVerdict = () => {
    clear(verdict);
    const r = componentsFrom(st);
    if (!r.missing.length) verdict.append(t(L.verdictOk));
    else {
      verdict.append(t(L.verdictMissing), r.missing.map((id) => COMPONENTS.find((c) => c.id === id)!.label).join(', '), '.');
      const first = COMPONENTS.find((c) => c.id === r.missing[0])!;
      verdict.append(h('br'), h('span.kx-note', {}, `${first.label}: ${t(first.without)}`));
    }
    if (!r.kubectl) verdict.append(h('br'), h('span.kx-note', {}, t(bi('kubectl не подключён к API-серверу: команды в прогоне всё равно пойдут, будто провод есть, — иначе нечего показывать.', 'kubectl is not wired to the API server: the run still sends the commands as if it were — otherwise there is nothing to show.'))));
  };

  const runScenario = async (sc: Scenario) => {
    for (const b of runBtns.querySelectorAll('button')) (b as HTMLButtonElement).disabled = true;
    out.textContent = t(L.running);
    const r = componentsFrom(st);
    const m = await createSimMachine({ hostname: 'laptop', ext: { k8s: { components: r.components, bare: !r.components.coredns, after: { kubelet: r.kubelet ? {} : { 'cp-1': false, 'worker-1': false, 'worker-2': false } } } } });
    if (!r.runtime) {
      const c = k8sState(m).cluster!;
      for (const n of c.nodes) n.runtime = false;
      c.advance(2000);
    }
    let text = '';
    for (const line of sc.lines) {
      const res = await m.exec(line);
      text += `$ ${line}\n${stripAnsi(res.out)}`;
      if (disposed) return;
    }
    out.textContent = text;
    m.dispose();
    for (const b of runBtns.querySelectorAll('button')) (b as HTMLButtonElement).disabled = false;
    if (!r.missing.length) fullOk = true;
    else brokenRun = true;
    ctx.record({ kind: 'x.k8s.constructor.run', scenario: sc.id, missing: r.missing });
    if (fullOk && brokenRun) ctx.complete();
  };

  for (const sc of SCENARIOS) runBtns.append(h('button.btn.small', { type: 'button', onclick: () => void runScenario(sc) }, t(sc.label)));

  const tools = h(
    'div.kx-row',
    {},
    h(
      'button.btn.ghost.small',
      {
        type: 'button',
        onclick: () => {
          st.placed = COMPONENTS.map((c) => c.id);
          st.wires = WIRES.map((w) => key(w.a, w.b));
          render();
        },
      },
      t(L.full),
    ),
    h(
      'button.btn.ghost.small',
      {
        type: 'button',
        onclick: () => {
          st.placed = ['kubectl'];
          st.wires = [];
          render();
        },
      },
      t(L.clearAll),
    ),
  );

  clear(root);
  root.append(
    h(
      'div.kx',
      {},
      h('div.kc', {}, palette, h('div.kc-side', {}, canvas, why, tools, card)),
      h('h4.kx-h', {}, t(L.run)),
      runBtns,
      verdict,
      out,
    ),
  );
  render();
  // The section may mount before it is in the document: lay the labels out again once it is.
  if (st.wires.length && typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => !disposed && render());

  return {
    dispose() {
      disposed = true;
    },
    describe: () => {
      const r = componentsFrom(st);
      return `Kubernetes constructor: placed ${st.placed.join(', ')}; wires ${st.wires.join(', ') || 'none'}; switched off: ${r.missing.join(', ') || 'nothing'}`;
    },
  };
}

export const constructorWidget: WidgetReg = { id: 'k8s.constructor', mount: mountConstructor };
