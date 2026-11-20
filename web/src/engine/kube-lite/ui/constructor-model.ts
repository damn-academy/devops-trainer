// The model of "Kubernetes from blocks" (05 §6.2) without the DOM: the
// layers, the components with their cards, the typed wires, what a canvas
// turns into in kube-lite, and the scenarios with the sentence that names
// the component whose absence caused the symptom. The widget in
// constructor.ts draws it; the tests run the scenarios headless.

import { bi, type Bi } from '../../../core/i18n';
import type { ColorFamily } from '../../../core/types';
import { createSimMachine, stripAnsi, type SimMachineOptions } from '../../terminal/shell';
import type { AddonId } from '../addons';
import type { Components } from '../cluster';
import { k8sState } from '../state';

export type LayerId = 'cp' | 'node' | 'net' | 'ingress' | 'storage' | 'certs' | 'metrics' | 'gitops' | 'obs';
export const CORE_LAYERS: LayerId[] = ['cp', 'node', 'net'];
export const ALL_LAYERS: LayerId[] = ['cp', 'node', 'net', 'ingress', 'storage', 'certs', 'metrics', 'gitops', 'obs'];

export interface Layer {
  id: LayerId;
  label: Bi;
  family: ColorFamily;
  what: Bi;
}

export const LAYERS: Layer[] = [
  { id: 'cp', label: bi('Управляющий слой', 'Control plane'), family: 'cp', what: bi('API-сервер, etcd, планировщик и контроллеры: они хранят желаемое состояние и решают, что где запустить.', 'The API server, etcd, the scheduler and the controllers: they keep the desired state and decide what runs where.') },
  { id: 'node', label: bi('Узел', 'Node'), family: 'node', what: bi('kubelet и среда запуска контейнеров на каждой машине: они запускают поды, которые назначил планировщик.', 'The kubelet and the container runtime on every machine: they start the pods the scheduler assigned.') },
  { id: 'net', label: bi('Сеть кластера', 'Cluster network'), family: 'l3', what: bi('Сетевой плагин даёт подам адреса, kube-proxy ведёт запросы к сервисам, CoreDNS отвечает на имена.', 'The network plugin gives pods addresses, kube-proxy routes requests to Services, CoreDNS answers names.') },
  { id: 'ingress', label: bi('Вход снаружи', 'Traffic in'), family: 'l7', what: bi('MetalLB даёт сервису адрес в сети офиса, а контроллер входа Traefik по правилам Gateway API ведёт запрос по имени сайта к нужному сервису.', 'MetalLB gives a Service an address on the office network, and the Traefik ingress controller routes a request by host name to the right Service by Gateway API rules.') },
  { id: 'certs', label: bi('Сертификаты', 'Certificates'), family: 'tls', what: bi('cert-manager выпускает сертификаты HTTPS и кладёт их в Secret, откуда их берёт контроллер входа.', 'cert-manager issues HTTPS certificates into Secrets the ingress controller serves.') },
  { id: 'storage', label: bi('Хранилище', 'Storage'), family: 'store', what: bi('CSI-драйвер и StorageClass создают том для каждой заявки PersistentVolumeClaim.', 'A CSI driver and a StorageClass create a volume for every PersistentVolumeClaim.') },
  { id: 'metrics', label: bi('Метрики и автомасштаб', 'Metrics and autoscaling'), family: 'gauge', what: bi('metrics-server отдаёт текущее потребление подов, по нему работают kubectl top и HPA.', 'metrics-server serves the current usage of pods; kubectl top and the HPA use it.') },
  { id: 'gitops', label: bi('Выкладка из Git', 'GitOps'), family: 'ci-deploy', what: bi('Flux забирает манифесты из репозитория команды и держит кластер таким, как записано в Git.', 'Flux takes the manifests from the team repository and keeps the cluster as Git says.') },
  { id: 'obs', label: bi('Наблюдаемость', 'Observability'), family: 'flow', what: bi('Prometheus собирает метрики узлов и объектов и считает алерты.', 'Prometheus collects metrics of nodes and objects and evaluates alerts.') },
];

export type CniVariant = 'k3s' | 'flannel' | 'calico' | 'cilium';

export const CNI_VARIANTS: { id: CniVariant; label: string; what: Bi }[] = [
  { id: 'flannel', label: 'flannel', what: bi('flannel даёт подам адреса и связывает узлы, но объекты NetworkPolicy не применяет: политика лежит в API, а пакеты проходят.', 'flannel gives pods addresses and links the nodes, but does not enforce NetworkPolicy: the policy sits in the API and packets pass.') },
  { id: 'calico', label: 'Calico', what: bi('Calico даёт подам адреса и применяет NetworkPolicy правилами в ядре каждого узла; сервисы по-прежнему ведёт kube-proxy.', 'Calico gives pods addresses and enforces NetworkPolicy with kernel rules on every node; Services are still kube-proxy’s job.') },
  { id: 'cilium', label: 'Cilium', what: bi('Cilium даёт подам адреса, применяет NetworkPolicy и в режиме kubeProxyReplacement сам ведёт запросы к сервисам программами eBPF, так что kube-proxy ему не нужен.', 'Cilium gives pods addresses, enforces NetworkPolicy and, with kubeProxyReplacement, routes Services itself with eBPF programs, so it needs no kube-proxy.') },
];

export interface Comp {
  id: string;
  label: string;
  sub: Bi;
  layer: LayerId | 'client';
  x: number;
  y: number;
  what: Bi;
  /** Who installs or runs it. */
  who: Bi;
  /** Who talks to it and whom it talks to. */
  talks: Bi;
  /** What it hands to whom. */
  hands: Bi;
  see: string;
  doc: string;
  docLabel: string;
  /** What breaks without it (05 §6.2 table), with the real messages. */
  without: Bi;
  /** The sentence a run prints when this component's absence is the cause. */
  cause: Bi;
  addon?: AddonId;
  /** Talks to the API server (an add-on gets a wire to the API bus). */
  api?: boolean;
}

export const W = 170;
export const H = 52;
export const AW = 150;
const col = (i: number) => 22 + i * 172;
export const ROW_A = 514;
export const ROW_B = 630;

export const COMPONENTS: Comp[] = [
  {
    id: 'kubectl',
    label: 'kubectl',
    sub: bi('ваш терминал', 'your terminal'),
    layer: 'client',
    x: 20,
    y: 40,
    what: bi('Клиент API: превращает команду или файл в HTTP-запрос к kube-apiserver.', 'An API client: turns a command or a file into an HTTP request to kube-apiserver.'),
    who: bi('Вы ставите его на свой компьютер; адрес сервера и ключи он берёт из kubeconfig.', 'You install it on your machine; it takes the server address and keys from kubeconfig.'),
    talks: bi('kubectl разговаривает только с kube-apiserver, по HTTPS на порт 6443.', 'kubectl talks only to kube-apiserver, over HTTPS on port 6443.'),
    hands: bi('Объекты и запросы kubectl передаёт API-серверу, а его ответы печатает в терминал.', 'kubectl hands objects and requests to the API server and prints its answers.'),
    see: 'kubectl config view --minify',
    doc: 'https://kubernetes.io/docs/reference/kubectl/',
    docLabel: 'kubernetes.io',
    without: bi('Без него вы не можете ничего попросить у кластера, но сам кластер продолжает работать.', 'Without it you cannot ask the cluster for anything, but the cluster itself keeps running.'),
    cause: bi('kubectl не подключён к API-серверу, но прогон всё равно отправляет команды так, будто провод есть: иначе нечего было бы показать.', 'kubectl is not wired to the API server; the run still sends the commands as if it were, otherwise there would be nothing to show.'),
  },
  {
    id: 'apiserver',
    label: 'kube-apiserver',
    sub: bi('единственная дверь', 'the only door'),
    layer: 'cp',
    x: 330,
    y: 44,
    what: bi('HTTP API кластера. Он проверяет, кто вы и можно ли вам это, проставляет значения по умолчанию, проверяет объект и сохраняет его в etcd. Все остальные компоненты разговаривают только с ним.', 'The HTTP API of the cluster. It checks who you are and whether you may, fills in defaults, validates the object and stores it in etcd. Every other component talks only to it.'),
    who: bi('Статический под на узле управляющего слоя (в k3s он часть процесса k3s server).', 'A static pod on the control-plane node (in k3s, part of the k3s server process).'),
    talks: bi('С API-сервером разговаривают все: kubectl, планировщик, контроллеры, kubelet, kube-proxy, CoreDNS и дополнения. Сам он обращается к etcd, а за логами и exec — к kubelet.', 'Everyone talks to the API server: kubectl, the scheduler, the controllers, the kubelets, kube-proxy, CoreDNS and the add-ons. It calls etcd itself, and the kubelet for logs and exec.'),
    hands: bi('Объекты API-сервер сохраняет в etcd, а их изменения рассылает всем, кто подписан на них через watch.', 'It stores objects in etcd and sends their changes to everyone who watches them.'),
    see: 'kubectl get --raw /readyz?verbose',
    doc: 'https://kubernetes.io/docs/concepts/overview/components/#kube-apiserver',
    docLabel: 'kubernetes.io',
    without: bi('Любая команда kubectl падает с «The connection to the server 127.0.0.1:6443 was refused». Уже запущенные поды продолжают работать.', 'Every kubectl command fails: "The connection to the server 127.0.0.1:6443 was refused". Pods that already run keep running.'),
    cause: bi('На холсте нет kube-apiserver, поэтому ни одна команда kubectl не дошла до кластера: каждая получила «The connection to the server 127.0.0.1:6443 was refused».', 'There is no kube-apiserver on the canvas, so no kubectl command reached the cluster: each got "The connection to the server 127.0.0.1:6443 was refused".'),
  },
  {
    id: 'etcd',
    label: 'etcd',
    sub: bi('хранит желаемое', 'stores the desired state'),
    layer: 'cp',
    x: 600,
    y: 44,
    what: bi('Хранилище «ключ — значение»: здесь лежат все объекты кластера под ключами /registry/…, и у каждого изменения новый номер resourceVersion.', 'A key-value store: every object of the cluster lives here under /registry/… keys, every change gets a new resourceVersion.'),
    who: bi('Статический под на узле управляющего слоя (k3s по умолчанию хранит то же самое в SQLite через kine).', 'A static pod on the control-plane node (k3s keeps the same in SQLite via kine by default).'),
    talks: bi('С etcd по gRPC разговаривает только kube-apiserver.', 'Only kube-apiserver talks to etcd, over gRPC.'),
    hands: bi('Сохранённые объекты и поток их изменений etcd отдаёт API-серверу.', 'etcd hands the stored objects and the stream of their changes to the API server.'),
    see: 'cluster etcd /registry/pods',
    doc: 'https://kubernetes.io/docs/concepts/overview/components/#etcd',
    docLabel: 'kubernetes.io',
    without: bi('API-серверу негде хранить объекты: на каждую команду приходит «etcdserver: request timed out», и ничего не сохраняется.', 'The API server has nowhere to keep objects: "etcdserver: request timed out", nothing persists.'),
    cause: bi('etcd не подключён к API-серверу, поэтому API-серверу негде сохранить объекты, и каждая команда получила «etcdserver: request timed out».', 'etcd is not wired to the API server, so the API server has nowhere to store objects and every command got "etcdserver: request timed out".'),
  },
  {
    id: 'scheduler',
    label: 'kube-scheduler',
    sub: bi('выбирает узел', 'picks a node'),
    layer: 'cp',
    x: 200,
    y: 128,
    what: bi('Планировщик смотрит поды без узла, отсеивает узлы (хватит ли ресурсов, подходят ли метки и taints), оценивает оставшиеся и записывает выбор объектом Binding.', 'Watches pods without a node, filters nodes (enough resources? matching labels and taints?), scores the rest and records its choice as a Binding.'),
    who: bi('Статический под на узле управляющего слоя.', 'A static pod on the control-plane node.'),
    talks: bi('Планировщик разговаривает только с API-сервером: смотрит поды без узла и сами узлы.', 'The scheduler talks only to the API server: it watches pods without a node and the nodes.'),
    hands: bi('Имя выбранного узла планировщик записывает в под, и этот под видит kubelet того узла.', 'It writes the chosen node into the pod, and the kubelet of that node sees the pod.'),
    see: 'kubectl get events --field-selector reason=FailedScheduling',
    doc: 'https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/',
    docLabel: 'kubernetes.io',
    without: bi('Поды навсегда остаются в Pending, в describe стоит «Node: <none>», и нет ни одного события FailedScheduling, потому что писать их некому.', 'Pods stay Pending forever, describe shows "Node: <none>" and not a single FailedScheduling event — nobody writes them.'),
    cause: bi('На холсте нет планировщика kube-scheduler, поэтому новым подам некому назначить узел: они остаются в Pending, и даже событий FailedScheduling никто не пишет.', 'There is no kube-scheduler on the canvas, so nobody assigns new pods a node: they stay Pending, and nobody even writes FailedScheduling events.'),
  },
  {
    id: 'controller-manager',
    label: 'kube-controller-manager',
    sub: bi('цикл согласования', 'reconcile loops'),
    layer: 'cp',
    x: 460,
    y: 128,
    what: bi('Один процесс с десятками контроллеров: Deployment, ReplicaSet, EndpointSlice, Job, Namespace, жизненный цикл узлов, привязка томов, HPA и сборщик мусора. Каждый сравнивает желаемое с фактическим и делает шаг навстречу.', 'One process with dozens of controllers: Deployment, ReplicaSet, EndpointSlice, Job, Namespace, node lifecycle, volume binding, the HPA and the garbage collector. Each compares desired with actual and takes a step towards it.'),
    who: bi('Статический под на узле управляющего слоя.', 'A static pod on the control-plane node.'),
    talks: bi('Контроллеры разговаривают только с API-сервером: смотрят свои объекты и создают или меняют другие.', 'The controllers talk only to the API server: they watch their objects and create or change others.'),
    hands: bi('ReplicaSet и поды они передают планировщику, EndpointSlice — kube-proxy и CoreDNS, привязанный том — планировщику и kubelet, новое число реплик от HPA — контроллеру Deployment.', 'ReplicaSets and pods go to the scheduler, EndpointSlices to kube-proxy and CoreDNS, a bound volume to the scheduler and the kubelet, the HPA’s replica count to the Deployment controller.'),
    see: 'kubectl get rs,endpointslices',
    doc: 'https://kubernetes.io/docs/concepts/architecture/controller/',
    docLabel: 'kubernetes.io',
    without: bi('Deployment создан, но ReplicaSet нет, и READY показывает 0/3; удалённый под не возвращается; EndpointSlice пуст; PVC не связывается с томом; HPA не меняет число реплик.', 'The Deployment is created, but there is no ReplicaSet, READY 0/3; a deleted pod does not come back; the EndpointSlice is empty; a PVC is not bound; the HPA changes nothing.'),
    cause: bi('На холсте нет kube-controller-manager, поэтому Deployment так и остался записью в API: ReplicaSet и поды по нему никто не создал, и READY показывает 0.', 'There is no kube-controller-manager on the canvas, so the Deployment stayed a record in the API: nobody created its ReplicaSet and pods, and READY shows 0.'),
  },
  {
    id: 'kubelet',
    label: 'kubelet',
    sub: bi('агент узла', 'the node agent'),
    layer: 'node',
    x: 40,
    y: 270,
    what: bi('Агент на каждом узле: видит поды, назначенные его узлу, просит рантайм их запустить, выполняет проверки, пишет состояние подов и раз в 10 секунд продлевает Lease узла.', 'The agent on every node: sees the pods assigned to its node, asks the runtime to start them, runs probes, writes their status and renews the node Lease every 10 seconds.'),
    who: bi('Служба systemd на каждом узле (в k3s она часть процесса k3s agent).', 'A systemd service on every node (in k3s, part of the k3s agent process).'),
    talks: bi('kubelet разговаривает с API-сервером (поды своего узла, их состояние, Lease) и с рантаймом контейнеров по CRI; к нему самому обращаются metrics-server и API-сервер за логами.', 'The kubelet talks to the API server (its pods, their status, the Lease) and to the runtime over CRI; metrics-server and the API server (for logs) call it.'),
    hands: bi('Команду запустить контейнер kubelet передаёт рантайму, а состояние подов и узла — API-серверу.', 'It hands "start this container" to the runtime and the state of pods and the node to the API server.'),
    see: 'kubectl get lease -n kube-node-lease',
    doc: 'https://kubernetes.io/docs/concepts/overview/components/#kubelet',
    docLabel: 'kubernetes.io',
    without: bi('Через 50 секунд узлы становятся Unknown и NotReady, поды на них никто не запускает, а через 300 секунд их выселяют.', 'After 50 seconds the nodes are Unknown/NotReady and nobody starts pods on them; after 300 seconds they are evicted.'),
    cause: bi('kubelet не подключён к API-серверу, поэтому ни один узел не узнал о назначенных ему подах: они так и не запустились, а узлы стали NotReady.', 'The kubelet is not wired to the API server, so no node learned about its pods: they never started, and the nodes went NotReady.'),
  },
  {
    id: 'runtime',
    label: 'containerd',
    sub: bi('среда запуска контейнеров', 'container runtime'),
    layer: 'node',
    x: 300,
    y: 270,
    what: bi('Рантайм контейнеров: скачивает образы, создаёт песочницу пода и контейнеры (через runc или crun). kubelet обращается к нему по CRI, это gRPC.', 'The container runtime: pulls images, creates the pod sandbox and the containers (through runc/crun). The kubelet talks to it over CRI — gRPC.'),
    who: bi('Служба systemd на каждом узле; это тот же containerd, что работает под Docker.', 'A systemd service on every node; the same containerd that sits under Docker.'),
    talks: bi('С рантаймом разговаривает kubelet по CRI, а сам рантайм вызывает плагин CNI.', 'The kubelet talks to the runtime over CRI; the runtime calls the CNI plugin.'),
    hands: bi('Запущенные контейнеры и их состояние рантайм отдаёт kubelet, а сеть для пода просит у CNI.', 'It hands running containers and their state to the kubelet and asks CNI for the pod’s network.'),
    see: 'crictl ps   # on a node',
    doc: 'https://kubernetes.io/docs/setup/production-environment/container-runtimes/',
    docLabel: 'kubernetes.io',
    without: bi('Узел становится NotReady с причиной «container runtime is down», и поды висят в ContainerCreating.', 'The node is NotReady: "container runtime is down", pods hang in ContainerCreating.'),
    cause: bi('Рантайм контейнеров не подключён к kubelet, поэтому kubelet некому поручить запуск: узлы сообщают «container runtime is down», и контейнеры не стартуют.', 'The container runtime is not wired to the kubelet, so the kubelet has nobody to start containers: the nodes report "container runtime is down".'),
  },
  {
    id: 'cni',
    label: 'CNI',
    sub: bi('сеть подов', 'pod network'),
    layer: 'net',
    x: 560,
    y: 270,
    what: bi('Сетевой плагин: по команде ADD создаёт поду интерфейс, выдаёт IP-адрес из podCIDR узла и прописывает маршрут, а между узлами строит маршруты или туннель. Некоторые плагины ещё и применяют NetworkPolicy.', 'The network plugin: on ADD it creates the pod interface, gives it an IP from the node podCIDR and adds the route; between nodes it builds routes or a tunnel. Some plugins also enforce NetworkPolicy.'),
    who: bi('Исполняемый файл в /opt/cni/bin и конфиг в /etc/cni/net.d на каждом узле; демон плагина работает DaemonSet’ом.', 'A binary in /opt/cni/bin and a config in /etc/cni/net.d on every node; the plugin daemon is a DaemonSet.'),
    talks: bi('Плагин вызывает среда запуска контейнеров; демон плагина смотрит API-сервер, если плагин применяет NetworkPolicy.', 'The runtime calls the plugin; the plugin daemon watches the API server if it enforces NetworkPolicy.'),
    hands: bi('Поду плагин даёт интерфейс и IP-адрес, а если поддерживает политики, ещё и правила, кого к поду пускать.', 'It hands the pod an interface and an IP and, if it supports policies, the rules of who may reach it.'),
    see: "kubectl get node worker-1 -o jsonpath='{.spec.podCIDR}'",
    doc: 'https://kubernetes.io/docs/concepts/cluster-administration/networking/',
    docLabel: 'kubernetes.io',
    without: bi('Узел становится NotReady с причиной «cni plugin not initialized», и поды стоят в ContainerCreating с событием FailedCreatePodSandBox.', 'The node is NotReady: "cni plugin not initialized", pods in ContainerCreating with FailedCreatePodSandBox.'),
    cause: bi('Сетевой плагин CNI не подключён к рантайму, поэтому новым подам некому дать сеть: они стоят в ContainerCreating с событием FailedCreatePodSandBox, а узлы стали NotReady.', 'The CNI plugin is not wired to the runtime, so nobody gives new pods a network: they hang in ContainerCreating with FailedCreatePodSandBox, and the nodes went NotReady.'),
  },
  {
    id: 'kube-proxy',
    label: 'kube-proxy',
    sub: bi('правила Service', 'Service rules'),
    layer: 'net',
    x: 40,
    y: 370,
    what: bi('Смотрит Service и EndpointSlice и пишет в ядро узла правила iptables или nftables: пакет на ClusterIP, NodePort или адрес LoadBalancer подменяется на IP одного из подов (DNAT).', 'Watches Services and EndpointSlices and writes iptables/nftables rules into the node kernel: a packet to a ClusterIP, NodePort or LoadBalancer address is rewritten to the IP of one of the pods (DNAT).'),
    who: bi('DaemonSet (в k3s он встроен в процесс k3s). Cilium в режиме kubeProxyReplacement делает его работу сам.', 'A DaemonSet (built into k3s). Cilium with kubeProxyReplacement does its job itself.'),
    talks: bi('kube-proxy разговаривает только с API-сервером: смотрит Service и EndpointSlice.', 'kube-proxy talks only to the API server: it watches Services and EndpointSlices.'),
    hands: bi('Правила kube-proxy записывает в ядро своего узла, и по ним ядро ведёт пакеты к подам.', 'It writes the rules into its node’s kernel, and the kernel routes packets to pods by them.'),
    see: 'cluster iptables worker-1',
    doc: 'https://kubernetes.io/docs/reference/networking/virtual-ips/',
    docLabel: 'kubernetes.io',
    without: bi('Запрос по IP пода проходит, а по ClusterIP, NodePort и адресу LoadBalancer — нет: правил DNAT никто не написал.', 'A request to a pod IP works, to a ClusterIP, a NodePort or a LoadBalancer address it does not: nobody wrote the DNAT rules.'),
    cause: bi('На холсте нет kube-proxy, а выбранный сетевой плагин его работу не делает, поэтому правил для адресов сервисов в ядре узлов нет: запрос к сервису не доходит ни до одного пода.', 'There is no kube-proxy on the canvas and the chosen network plugin does not do its job, so the node kernels have no rules for Service addresses: a request to a Service reaches no pod.'),
  },
  {
    id: 'coredns',
    label: 'CoreDNS',
    sub: bi('имена сервисов', 'service names'),
    layer: 'net',
    x: 300,
    y: 370,
    what: bi('DNS-сервер кластера: на имя web.default.svc.cluster.local отвечает адресом ClusterIP. Сам он работает подами за Service kube-dns (10.43.0.10).', 'The cluster DNS server: answers web.default.svc.cluster.local with the ClusterIP. It runs as pods behind the kube-dns Service (10.43.0.10).'),
    who: bi('Deployment в kube-system, его ставит установщик кластера.', 'A Deployment in kube-system, installed by the cluster installer.'),
    talks: bi('CoreDNS смотрит Service и EndpointSlice через API-сервер, а к нему по адресу 10.43.0.10 обращаются все поды кластера.', 'CoreDNS watches Services and EndpointSlices through the API server; every pod of the cluster asks it at 10.43.0.10.'),
    hands: bi('По имени сервиса CoreDNS отдаёт поду адрес ClusterIP.', 'It hands a pod the ClusterIP for a Service name.'),
    see: 'kubectl -n kube-system get deploy coredns',
    doc: 'https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/',
    docLabel: 'kubernetes.io',
    without: bi('curl http://10.43.x.y работает, а curl http://web отвечает «Could not resolve host».', 'curl http://10.43.x.y works, curl http://web says "Could not resolve host".'),
    cause: bi('На холсте нет CoreDNS, поэтому имя сервиса внутри кластера никто не превращает в адрес, и curl по имени отвечает «Could not resolve host».', 'There is no CoreDNS on the canvas, so nobody turns a Service name into an address, and curl by name says "Could not resolve host".'),
  },
  // ── add-ons ──
  {
    id: 'metallb',
    label: 'MetalLB',
    sub: bi('адреса LoadBalancer', 'LoadBalancer IPs'),
    layer: 'ingress',
    addon: 'metallb',
    api: true,
    x: col(0),
    y: ROW_A,
    what: bi('MetalLB даёт адреса сервисам типа LoadBalancer в кластере без облака. Его контроллер берёт свободный адрес из пула 192.168.56.240–250 и записывает в status сервиса, а программа speaker на узлах отвечает в сети офиса на ARP-запросы об этом адресе, и пакеты начинают приходить на узел.', 'MetalLB gives addresses to LoadBalancer Services in a cluster without a cloud. Its controller takes a free address from the pool 192.168.56.240–250 and writes it into the Service status; the speaker on the nodes answers ARP for that address on the office network, so packets start arriving at a node.'),
    who: bi('MetalLB ставят отдельно, Helm-чартом или манифестом проекта: Deployment controller и DaemonSet speaker в namespace metallb-system. Пул адресов администратор задаёт объектом IPAddressPool. В облаке ту же работу делает облачный балансировщик, а в k3s по умолчанию ServiceLB.', 'Installed separately with a Helm chart or the project manifest: Deployment controller and DaemonSet speaker in metallb-system. The admin sets the pool with an IPAddressPool. In a cloud the cloud load balancer does this, in k3s ServiceLB by default.'),
    talks: bi('Через API-сервер MetalLB смотрит сервисы типа LoadBalancer и свои объекты IPAddressPool; на ARP-запросы из сети офиса отвечает speaker.', 'It watches LoadBalancer Services and its IPAddressPools through the API server; the speaker answers ARP on the office network.'),
    hands: bi('Адрес сервиса (EXTERNAL-IP) MetalLB записывает в API, откуда его берёт контроллер входа и публикует в status своего Gateway, а пакеты на этот адрес приводит на узел, где их разбирают правила kube-proxy.', 'It writes the Service address (EXTERNAL-IP) into the API, where the ingress controller publishes it in its Gateway status, and brings packets to a node, where kube-proxy’s rules take over.'),
    see: 'kubectl get svc -A',
    doc: 'https://metallb.io/concepts/',
    docLabel: 'metallb.io',
    without: bi('Сервис типа LoadBalancer навсегда остаётся с EXTERNAL-IP «<pending>», у Gateway пустой столбец ADDRESS, а curl из офиса отвечает «curl: (7) Failed to connect to shop.example port 80 after 3074 ms: Couldn\'t connect to server», потому что на адрес 192.168.56.240 никто не откликается. Достучаться можно только через NodePort узла.', 'A LoadBalancer Service keeps EXTERNAL-IP "<pending>" forever, the Gateway ADDRESS is empty, and curl from the office says "curl: (7) Failed to connect to shop.example port 80 after 3074 ms: Couldn\'t connect to server": nobody answers for 192.168.56.240. Only a node’s NodePort works.'),
    cause: bi('На холсте нет MetalLB, поэтому сервис контроллера входа так и не получил адрес в сети офиса: EXTERNAL-IP остался «<pending>», и на 192.168.56.240, куда DNS офиса отправляет shop.example, никто не отвечает.', 'There is no MetalLB on the canvas, so the ingress controller’s Service never got an office address: EXTERNAL-IP stays "<pending>", and nobody answers at 192.168.56.240, where the office DNS points shop.example.'),
  },
  {
    id: 'traefik',
    label: 'Traefik',
    sub: bi('вход по Gateway API', 'Gateway API ingress'),
    layer: 'ingress',
    addon: 'traefik',
    api: true,
    x: col(1),
    y: ROW_A,
    what: bi('Контроллер входа: обратный прокси Traefik, который исполняет правила Gateway API. Объект Gateway описывает точку входа (порт, протокол, сертификат), HTTPRoute — маршрут приложения по имени сайта и пути, и Traefik отправляет запрос в нужный сервис, прямо на адреса подов из EndpointSlice. Старые объекты Ingress он тоже понимает. HTTPS Traefik завершает сам, а сертификат берёт из Secret, на который ссылается Gateway.', 'The ingress controller: the Traefik reverse proxy executing Gateway API rules. A Gateway describes the entry point (port, protocol, certificate), an HTTPRoute the route of an application by host name and path, and Traefik sends the request to the right Service, straight to the pod addresses from its EndpointSlice. It understands old Ingress objects too. Traefik terminates HTTPS itself with the certificate from the Secret the Gateway refers to.'),
    who: bi('Traefik ставят Helm-чартом traefik (в k3s он стоит по умолчанию): Deployment и Service типа LoadBalancer в namespace traefik, GatewayClass traefik и Gateway traefik-gateway; CRD Gateway API ставят вместе с ним или заранее. Раньше самым распространённым контроллером был ingress-nginx, но в марте 2026 года его сняли с поддержки, и новые кластеры строят вход на Gateway API.', 'Installed with the traefik Helm chart (k3s ships it): a Deployment and a LoadBalancer Service in namespace traefik, GatewayClass traefik and Gateway traefik-gateway; the Gateway API CRDs come with it or beforehand. The once most common controller, ingress-nginx, was retired in March 2026, and new clusters build the way in on the Gateway API.'),
    talks: bi('Через API-сервер Traefik смотрит Gateway, HTTPRoute, Ingress, Service, EndpointSlice и Secret, а запросы снаружи получает через свой сервис типа LoadBalancer.', 'It watches Gateways, HTTPRoutes, Ingresses, Services, EndpointSlices and Secrets through the API server and receives outside requests through its LoadBalancer Service.'),
    hands: bi('Адрес своего сервиса Traefik пишет в status Gateway (столбец ADDRESS), отметку о принятом маршруте — в status HTTPRoute, а сам запрос передаёт поду приложения.', 'It writes its Service address into the Gateway status (the ADDRESS column), the route acceptance into the HTTPRoute status, and hands the request itself to an application pod.'),
    see: 'kubectl get gateway -A,httproute',
    doc: 'https://kubernetes.io/docs/concepts/services-networking/gateway/',
    docLabel: 'kubernetes.io',
    without: bi('CRD Gateway API в кластере нет, поэтому kubectl apply отвечает на HTTPRoute «no matches for kind "HTTPRoute" in version "gateway.networking.k8s.io/v1"», а запрос к shop.example отвечает «curl: (7) Failed to connect to shop.example port 80 … Couldn\'t connect to server».', 'There are no Gateway API CRDs, so kubectl apply answers the HTTPRoute with "no matches for kind "HTTPRoute" in version "gateway.networking.k8s.io/v1"", and a request to shop.example says "curl: (7) Failed to connect to shop.example port 80 … Couldn\'t connect to server".'),
    cause: bi('На холсте нет контроллера входа Traefik, а вместе с ним и CRD Gateway API, поэтому маршрут HTTPRoute для shop.example API-сервер даже не принял, и запросу из офиса в кластере некому ответить.', 'There is no Traefik on the canvas, and with it no Gateway API CRDs, so the API server did not even accept the HTTPRoute for shop.example, and nobody in the cluster answers the request from the office.'),
  },
  {
    id: 'cert-manager',
    label: 'cert-manager',
    sub: bi('сертификаты TLS', 'TLS certificates'),
    layer: 'certs',
    addon: 'cert-manager',
    api: true,
    x: col(2),
    y: ROW_A,
    what: bi('cert-manager выпускает и продлевает сертификаты. Увидев Gateway с аннотацией cert-manager.io/cluster-issuer и слушателем HTTPS, он создаёт объект Certificate, просит издателя (здесь это центр сертификации офиса office-ca) подписать запрос и кладёт готовый сертификат с ключом в Secret типа kubernetes.io/tls, на который ссылается слушатель. Так же он поступает с Ingress, у которого есть раздел tls.', 'cert-manager issues and renews certificates. Seeing a Gateway with the cert-manager.io/cluster-issuer annotation and an HTTPS listener, it creates a Certificate, asks the issuer (here the office CA office-ca) to sign the request and puts the certificate and key into the Secret of type kubernetes.io/tls the listener refers to. It does the same for an Ingress with a tls section.'),
    who: bi('cert-manager ставят Helm-чартом в namespace cert-manager: контроллер, webhook и CRD Certificate, CertificateRequest и ClusterIssuer. Издателя администратор описывает объектом ClusterIssuer: свой центр сертификации или Let’s Encrypt по протоколу ACME.', 'Installed with a Helm chart into cert-manager: the controller, the webhook and the CRDs Certificate, CertificateRequest, ClusterIssuer. The admin describes the issuer as a ClusterIssuer: an own CA or Let’s Encrypt over ACME.'),
    talks: bi('Через API-сервер cert-manager смотрит Gateway, Ingress, Certificate и ClusterIssuer, а за подписью обращается к издателю.', 'It watches Gateways, Ingresses, Certificates and ClusterIssuers through the API server and asks the issuer for the signature.'),
    hands: bi('Secret с сертификатом cert-manager передаёт через API контроллеру входа, который отдаёт этот сертификат браузерам и curl.', 'It hands the Secret with the certificate through the API to the ingress controller, which presents it to browsers and curl.'),
    see: 'kubectl get certificate,secret',
    doc: 'https://cert-manager.io/docs/',
    docLabel: 'cert-manager.io',
    without: bi('Gateway с аннотацией создаётся, но сертификата никто не выпускает: kubectl get certificate отвечает «error: the server doesn\'t have a resource type "certificate"», Secret shop-tls не существует, а Traefik отдаёт свой «TRAEFIK DEFAULT CERT», на который curl отвечает «curl: (60) SSL certificate problem: self-signed certificate».', 'The annotated Gateway is created but nobody issues a certificate: kubectl get certificate says "error: the server doesn\'t have a resource type "certificate"", there is no Secret shop-tls, and Traefik presents its "TRAEFIK DEFAULT CERT": curl says "curl: (60) SSL certificate problem: self-signed certificate".'),
    cause: bi('На холсте нет cert-manager, поэтому по аннотации на Gateway сертификат никто не выпустил: Secret shop-tls не появился, и Traefik показал свой самоподписанный сертификат, которому curl не доверяет.', 'There is no cert-manager on the canvas, so nobody issued a certificate for the annotated Gateway: Secret shop-tls never appeared, and Traefik showed its self-signed certificate, which curl does not trust.'),
  },
  {
    id: 'csi-hostpath',
    label: 'CSI: hostpath',
    sub: bi('диски для PVC', 'volumes for PVCs'),
    layer: 'storage',
    addon: 'csi-hostpath',
    api: true,
    x: col(3),
    y: ROW_A,
    what: bi('Драйвер хранилища по стандарту CSI вместе со StorageClass csi-hostpath-sc. Когда появляется PersistentVolumeClaim, то есть заявка «мне нужен диск на 1 ГиБ», провизионер драйвера создаёт том и объект PersistentVolume, а контроллер томов в kube-controller-manager связывает заявку с томом. Учебный драйвер hostpath.csi.k8s.io берёт каталог на узле; в облаке на его месте драйвер облачного диска, а в своём ЦОДе Longhorn или Ceph.', 'A storage driver by the CSI standard with the StorageClass csi-hostpath-sc. When a PersistentVolumeClaim appears ("I need a 1 GiB disk"), the driver’s provisioner creates a volume and a PersistentVolume, and the volume controller in kube-controller-manager binds the claim to it. The training driver hostpath.csi.k8s.io uses a directory on the node; in a cloud a cloud-disk driver takes its place, in your own data centre Longhorn or Ceph.'),
    who: bi('Драйвер ставят отдельно: его поды (здесь Deployment csi-hostpathplugin в kube-system) и StorageClass с пометкой «класс по умолчанию». В k3s похожую работу делает local-path-provisioner, но он не CSI-драйвер.', 'Installed separately: its pods (here Deployment csi-hostpathplugin in kube-system) and a StorageClass marked default. In k3s local-path-provisioner does a similar job, but it is not a CSI driver.'),
    talks: bi('Провизионер смотрит через API-сервер заявки своей StorageClass, а kubelet на узле обращается к драйверу по gRPC CSI, чтобы подключить том в под.', 'The provisioner watches the claims of its StorageClass through the API server; the kubelet on a node calls the driver over gRPC CSI to mount the volume into a pod.'),
    hands: bi('Для каждой заявки драйвер создаёт PersistentVolume; контроллер томов связывает их, заявка переходит в Bound, и только после этого планировщик ставит под на узел.', 'It creates a PersistentVolume for every claim; the volume controller binds them, the claim becomes Bound, and only then the scheduler places the pod.'),
    see: 'kubectl get sc,pvc,pv',
    doc: 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/',
    docLabel: 'kubernetes.io',
    without: bi('StorageClass нет, поэтому заявка висит в Pending с событием «no persistent volumes available for this claim and no storage class is set», а под базы данных стоит в Pending с «0/3 nodes are available: pod has unbound immediate PersistentVolumeClaims».', 'There is no StorageClass, so the claim stays Pending with "no persistent volumes available for this claim and no storage class is set", and the database pod is Pending with "0/3 nodes are available: pod has unbound immediate PersistentVolumeClaims".'),
    cause: bi('На холсте нет CSI-драйвера, а вместе с ним нет и StorageClass, поэтому заявку на диск никто не выполнил: PVC data остался в Pending, и планировщик не ставит под базы данных ни на один узел, пока диска нет.', 'There is no CSI driver on the canvas, and with it no StorageClass, so nobody fulfilled the disk claim: PVC data stays Pending, and the scheduler places the database pod nowhere while there is no disk.'),
  },
  {
    id: 'metrics-server',
    label: 'metrics-server',
    sub: bi('Metrics API', 'Metrics API'),
    layer: 'metrics',
    addon: 'metrics-server',
    api: true,
    x: col(0),
    y: ROW_B,
    what: bi('Раз в 15 секунд metrics-server спрашивает у kubelet каждого узла, сколько процессора и памяти сейчас тратят поды, и отдаёт эти цифры через API-сервер как Metrics API (metrics.k8s.io). Он хранит только последние значения, истории у него нет.', 'Every 15 seconds it asks the kubelet of every node how much CPU and memory the pods use now and serves the numbers through the API server as the Metrics API (metrics.k8s.io). It keeps only the latest values, no history.'),
    who: bi('Его ставят манифестом проекта или Helm-чартом в kube-system (в k3s он входит в установку), и он регистрируется в API-сервере объектом APIService v1beta1.metrics.k8s.io.', 'Installed with the project manifest or a Helm chart into kube-system (k3s ships it) and registered in the API server as APIService v1beta1.metrics.k8s.io.'),
    talks: bi('metrics-server обращается к kubelet каждого узла (/metrics/resource), а к нему самому через API-сервер обращаются kubectl top и контроллер HPA.', 'It calls the kubelet of every node (/metrics/resource); kubectl top and the HPA controller reach it through the API server.'),
    hands: bi('Цифры потребления он передаёт команде kubectl top и контроллеру HorizontalPodAutoscaler, который по ним меняет число реплик.', 'It hands the usage numbers to kubectl top and to the HorizontalPodAutoscaler controller, which changes the replica count by them.'),
    see: 'kubectl top pods',
    doc: 'https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/',
    docLabel: 'kubernetes.io',
    without: bi('kubectl top отвечает «error: Metrics API not available», у HPA в столбце TARGETS стоит «cpu: <unknown>/50%», в событиях FailedGetResourceMetric с «the server could not find the requested resource (get pods.metrics.k8s.io)», и под нагрузкой подов не становится больше.', 'kubectl top says "error: Metrics API not available", the HPA TARGETS column shows "cpu: <unknown>/50%", the events say FailedGetResourceMetric "the server could not find the requested resource (get pods.metrics.k8s.io)", and the pod count does not grow under load.'),
    cause: bi('На холсте нет metrics-server, поэтому контроллеру HPA неоткуда узнать, сколько процессора тратят поды: в TARGETS стоит <unknown>, и под нагрузкой реплик не прибавилось.', 'There is no metrics-server on the canvas, so the HPA controller cannot learn how much CPU the pods use: TARGETS shows <unknown>, and no replicas were added under load.'),
  },
  {
    id: 'flux',
    label: 'Flux',
    sub: bi('кластер следует за Git', 'the cluster follows Git'),
    layer: 'gitops',
    addon: 'flux',
    api: true,
    x: col(1),
    y: ROW_B,
    what: bi('Контроллер GitOps. source-controller раз в минуту забирает ветку main из репозитория команды, а kustomize-controller применяет манифесты из каталога apps/ и раз в пять минут сверяет кластер с Git: ручное изменение он возвращает, а удалённое из Git удаляет из кластера. Argo CD делает то же самое своими объектами Application и показывает разницу в веб-интерфейсе.', 'A GitOps controller. source-controller fetches main from the team repository every minute, kustomize-controller applies the manifests of apps/ and compares the cluster with Git every five minutes: it reverts a manual change and deletes what was removed from Git. Argo CD does the same with its Application objects and shows the diff in a web UI.'),
    who: bi('Flux ставят командой flux bootstrap или Helm-чартом в namespace flux-system: Deployment source-controller и kustomize-controller, CRD GitRepository и Kustomization. Объекты GitRepository и Kustomization говорят, какой репозиторий и какой каталог смотреть.', 'Installed with flux bootstrap or a Helm chart into flux-system: Deployments source-controller and kustomize-controller, the CRDs GitRepository and Kustomization, whose objects say which repository and directory to watch.'),
    talks: bi('Flux ходит в Git-репозиторий за новыми коммитами, а изменения применяет через API-сервер, так же как kubectl apply.', 'Flux goes to the Git repository for new commits and applies the changes through the API server, as kubectl apply does.'),
    hands: bi('Манифесты из Git он передаёт API-серверу, а дальше их подхватывают контроллеры кластера: Deployment, ReplicaSet и планировщик.', 'It hands the manifests from Git to the API server; from there the cluster’s controllers take over.'),
    see: 'kubectl get gitrepository,kustomization -n flux-system',
    doc: 'https://fluxcd.io/flux/concepts/',
    docLabel: 'fluxcd.io',
    without: bi('Коммит в Git ничего не меняет в кластере: kubectl get deploy web отвечает «Error from server (NotFound): deployments.apps "web" not found», а ручной kubectl scale так и остаётся, потому что сверять кластер с Git некому.', 'A commit to Git changes nothing in the cluster: kubectl get deploy web says "Error from server (NotFound): deployments.apps "web" not found", and a manual kubectl scale stays, because nobody compares the cluster with Git.'),
    cause: bi('На холсте нет Flux, поэтому коммит в репозиторий команды остался только в Git: в кластер его никто не применил, и Deployment web не появился.', 'There is no Flux on the canvas, so the commit stayed in Git: nobody applied it to the cluster, and Deployment web never appeared.'),
  },
  {
    id: 'node-exporter',
    label: 'node-exporter',
    sub: bi('метрики узлов', 'node metrics'),
    layer: 'obs',
    addon: 'node-exporter',
    x: col(2),
    y: ROW_B,
    what: bi('Программа на каждом узле (DaemonSet), которая по HTTP на порту 9100 отдаёт метрики самой машины: загрузку процессора, свободную память, место на дисках, сетевой трафик.', 'A program on every node (a DaemonSet) that serves the machine’s own metrics over HTTP on port 9100: CPU load, free memory, disk space, network traffic.'),
    who: bi('node-exporter ставят вместе с Prometheus (тем же Helm-чартом kube-prometheus-stack) DaemonSet’ом в namespace monitoring.', 'Installed together with Prometheus (the same kube-prometheus-stack chart) as a DaemonSet in monitoring.'),
    talks: bi('К node-exporter по HTTP обращается Prometheus, а с API-сервером node-exporter не разговаривает вовсе.', 'Prometheus calls it over HTTP; node-exporter does not talk to the API server at all.'),
    hands: bi('Метрики узлов он передаёт Prometheus, и по ним работают алерты вроде «на диске узла кончается место».', 'It hands node metrics to Prometheus; alerts like "the node disk is filling up" work on them.'),
    see: 'kubectl -n monitoring get ds node-exporter',
    doc: 'https://prometheus.io/docs/guides/node-exporter/',
    docLabel: 'prometheus.io',
    without: bi('В списке целей Prometheus нет задания node-exporter, графики узлов пусты, и алерт о заканчивающемся месте на диске узла не сработает никогда.', 'Prometheus has no node-exporter job among its targets, node graphs are empty, and the "disk is filling up" alert never fires.'),
    cause: bi('На холсте нет node-exporter, поэтому Prometheus ничего не знает о самих узлах: среди его целей нет задания node-exporter.', 'There is no node-exporter on the canvas, so Prometheus knows nothing about the nodes themselves: there is no node-exporter job among its targets.'),
  },
  {
    id: 'prometheus',
    label: 'Prometheus',
    sub: bi('метрики и алерты', 'metrics and alerts'),
    layer: 'obs',
    addon: 'prometheus',
    api: true,
    x: col(3),
    y: ROW_B,
    what: bi('Система мониторинга: раз в 30 секунд забирает метрики со всех целей по HTTP (/metrics), хранит их историю и проверяет правила алертов. Правило срабатывает, когда условие держится заданное время, например 15 минут для KubePodCrashLooping.', 'A monitoring system: every 30 seconds it scrapes every target over HTTP (/metrics), keeps the history and evaluates alert rules. A rule fires when its condition holds for a set time, 15 minutes for KubePodCrashLooping.'),
    who: bi('Prometheus ставят отдельно, обычно Helm-чартом kube-prometheus-stack, в namespace monitoring. Подробно его устройство разбирает блок мониторинга.', 'Installed separately, usually with the kube-prometheus-stack chart, into monitoring. The monitoring block covers it in depth.'),
    talks: bi('Через API-сервер Prometheus узнаёт, какие поды и узлы опрашивать, а сам по HTTP опрашивает node-exporter и kube-state-metrics.', 'It learns from the API server which pods and nodes to scrape, and scrapes node-exporter and kube-state-metrics over HTTP.'),
    hands: bi('Сработавшие алерты Prometheus передаёт в Alertmanager, а тот рассылает их в почту или чат дежурного; графики по его данным строит Grafana.', 'It hands firing alerts to Alertmanager, which sends them to the on-call mail or chat; Grafana draws graphs from its data.'),
    see: 'curl http://prometheus.monitoring:9090/api/v1/alerts',
    doc: 'https://prometheus.io/docs/introduction/overview/',
    docLabel: 'prometheus.io',
    without: bi('Метрики никто не собирает и алерты никто не считает: запрос к prometheus.monitoring отвечает «curl: (6) Could not resolve host: prometheus.monitoring», а под в CrashLoopBackOff может перезапускаться часами, и никто об этом не узнает.', 'Nobody collects metrics or evaluates alerts: a request to prometheus.monitoring says "curl: (6) Could not resolve host: prometheus.monitoring", and a pod in CrashLoopBackOff can restart for hours without anyone knowing.'),
    cause: bi('На холсте нет Prometheus, поэтому метрики никто не собирает и правила алертов никто не проверяет: имени prometheus.monitoring в кластере нет вовсе.', 'There is no Prometheus on the canvas, so nobody collects metrics or evaluates alert rules: the name prometheus.monitoring does not exist in the cluster.'),
  },
  {
    id: 'kube-state-metrics',
    label: 'kube-state-metrics',
    sub: bi('метрики объектов', 'object metrics'),
    layer: 'obs',
    addon: 'kube-state-metrics',
    api: true,
    x: col(4),
    y: ROW_B,
    what: bi('kube-state-metrics смотрит объекты кластера через API-сервер и превращает их состояние в метрики: сколько реплик Deployment готово, в каком состоянии контейнер (например, kube_pod_container_status_waiting_reason с причиной CrashLoopBackOff).', 'It watches the cluster objects through the API server and turns their state into metrics: how many replicas of a Deployment are ready, which state a container is in (kube_pod_container_status_waiting_reason with reason CrashLoopBackOff).'),
    who: bi('kube-state-metrics ставят вместе с Prometheus, Deployment’ом в namespace monitoring.', 'Installed together with Prometheus as a Deployment in monitoring.'),
    talks: bi('kube-state-metrics читает объекты через API-сервер, а к нему по HTTP обращается Prometheus.', 'It reads objects through the API server; Prometheus calls it over HTTP.'),
    hands: bi('Метрики объектов он передаёт Prometheus, и по ним работают алерты о подах и Deployment: KubePodCrashLooping, KubeDeploymentReplicasMismatch.', 'It hands object metrics to Prometheus; the pod and Deployment alerts work on them: KubePodCrashLooping, KubeDeploymentReplicasMismatch.'),
    see: 'kubectl -n monitoring get deploy kube-state-metrics',
    doc: 'https://github.com/kubernetes/kube-state-metrics',
    docLabel: 'github.com/kubernetes',
    without: bi('Prometheus работает и даже присылает служебный алерт Watchdog, но ничего не знает о подах: под в CrashLoopBackOff не порождает алерта KubePodCrashLooping, потому что метрики, на которой стоит правило, просто нет.', 'Prometheus works and even sends the Watchdog alert, but knows nothing about pods: a pod in CrashLoopBackOff raises no KubePodCrashLooping, because the metric the rule is built on does not exist.'),
    cause: bi('На холсте нет kube-state-metrics, поэтому Prometheus работает, но о состоянии подов не знает ничего: метрики kube_pod_container_status_waiting_reason нет, и правило KubePodCrashLooping молчит, хотя под перезапускается раз за разом.', 'There is no kube-state-metrics on the canvas, so Prometheus works but knows nothing about pod state: there is no kube_pod_container_status_waiting_reason, and KubePodCrashLooping stays silent while the pod restarts again and again.'),
  },
];

export const comp = (id: string) => COMPONENTS.find((c) => c.id === id)!;
export const layerOf = (id: string) => LAYERS.find((l) => l.id === id)!;
export const widthOf = (c: Comp) => (c.addon ? AW : W);

export interface WireDef {
  a: string;
  b: string;
  label: string;
  what: Bi;
}

export const WIRES: WireDef[] = [
  { a: 'kubectl', b: 'apiserver', label: 'HTTPS REST', what: bi('kubectl шлёт GET, POST, PATCH и DELETE на https://…:6443 с сертификатом из kubeconfig.', 'kubectl sends GET/POST/PATCH/DELETE to https://…:6443 with the certificate from kubeconfig.') },
  { a: 'apiserver', b: 'etcd', label: 'gRPC /registry/…', what: bi('Только API-сервер читает и пишет etcd, ключи у объектов вида /registry/<ресурс>/<namespace>/<имя>.', 'Only the API server reads and writes etcd: keys /registry/<resource>/<namespace>/<name>.') },
  { a: 'scheduler', b: 'apiserver', label: 'watch pods · POST binding', what: bi('Планировщик смотрит поды без узла и записывает выбор через подресурс binding.', 'The scheduler watches pods without a node and records its choice through the binding subresource.') },
  { a: 'controller-manager', b: 'apiserver', label: 'watch · create/update', what: bi('Контроллеры смотрят свои объекты и создают или меняют другие, и всё это через API.', 'Controllers watch their objects and create or change others — all through the API.') },
  { a: 'kubelet', b: 'apiserver', label: 'watch my pods · PATCH status · Lease', what: bi('kubelet смотрит поды своего узла, пишет их состояние и продлевает Lease.', 'The kubelet watches the pods of its node, writes their status and renews the Lease.') },
  { a: 'kubelet', b: 'runtime', label: 'gRPC CRI', what: bi('Container Runtime Interface: вызовы RunPodSandbox, CreateContainer, StartContainer и другие.', 'Container Runtime Interface: RunPodSandbox, CreateContainer, StartContainer…') },
  { a: 'runtime', b: 'cni', label: 'CNI ADD/DEL', what: bi('Создав сетевое пространство песочницы, рантайм вызывает плагин CNI командой ADD, чтобы тот дал поду сеть.', 'Having created the sandbox network namespace, the runtime calls the CNI plugin: ADD — give the pod a network.') },
  { a: 'kube-proxy', b: 'apiserver', label: 'watch Services, EndpointSlices', what: bi('kube-proxy смотрит Service и EndpointSlice и переписывает правила ядра своего узла.', 'kube-proxy watches Services and EndpointSlices and rewrites its node’s kernel rules.') },
  { a: 'coredns', b: 'apiserver', label: 'watch Services', what: bi('CoreDNS смотрит Service и отвечает на их имена.', 'CoreDNS watches Services and answers their names.') },
];

/** Links between add-ons that are not API calls: who hands data to whom (drawn dashed, automatic). */
export const DATA_LINKS: { a: string; b: string; label: Bi; what: Bi }[] = [
  { a: 'metallb', b: 'traefik', label: bi('адрес сервису', 'Service IP'), what: bi('MetalLB выдаёт сервису Traefik адрес 192.168.56.240 и отвечает на ARP-запросы о нём, а Traefik публикует этот адрес в столбце ADDRESS своего Gateway.', 'MetalLB gives the Traefik Service 192.168.56.240 and answers ARP for it; Traefik publishes the address in the ADDRESS of its Gateway.') },
  { a: 'cert-manager', b: 'traefik', label: bi('Secret TLS', 'TLS Secret'), what: bi('cert-manager кладёт сертификат в Secret, на который ссылается слушатель HTTPS в Gateway, а Traefik отдаёт его клиентам при подключении по HTTPS.', 'cert-manager puts the certificate into the Secret the Gateway’s HTTPS listener refers to; Traefik presents it on HTTPS connections.') },
  { a: 'node-exporter', b: 'prometheus', label: bi('метрики узла', 'node metrics'), what: bi('Prometheus раз в 30 секунд забирает у node-exporter каждого узла страницу http://<узел>:9100/metrics.', 'Every 30 seconds Prometheus fetches http://<node>:9100/metrics from the node-exporter of every node.') },
  { a: 'kube-state-metrics', b: 'prometheus', label: bi('метрики объектов', 'object metrics'), what: bi('Prometheus раз в 30 секунд забирает у kube-state-metrics метрики объектов: готовые реплики, причины ожидания контейнеров.', 'Every 30 seconds Prometheus fetches object metrics from kube-state-metrics: ready replicas, container waiting reasons.') },
];

export const API_BUS = bi('Дополнения работают подами на узлах и, как остальные компоненты, говорят только с API-сервером: смотрят свои объекты через watch и записывают результат.', 'Add-ons run as pods on the nodes and, like every other component, talk only to the API server: they watch their objects and write the result.');

export const key = (a: string, b: string) => [a, b].sort().join('|');
export const wireOf = (a: string, b: string) => WIRES.find((w) => key(w.a, w.b) === key(a, b));

/** Why a connection does not exist (shown above the rejected wire). */
export function whyNot(a: string, b: string): Bi {
  const pair = new Set([a, b]);
  if ([a, b].some((x) => comp(x)?.addon)) return bi('Провода к дополнениям тренажёр проводит сам: каждое дополнение говорит с API-сервером по общей шине, а кто кому передаёт данные, показывают пунктирные линии.', 'The trainer wires add-ons itself: each talks to the API server over the shared bus, and dashed lines show who hands data to whom.');
  if (pair.has('etcd')) return bi('В etcd ходит только kube-apiserver. Остальные читают и пишут состояние кластера через API-сервер.', 'Only kube-apiserver talks to etcd. Everyone else reads and writes the cluster state through the API server.');
  if (pair.has('scheduler') && pair.has('kubelet'))
    return bi('Планировщик не говорит kubelet «запусти». Он записывает nodeName в под через API-сервер, а kubelet, который смотрит API, видит, что этот под теперь его.', 'The scheduler does not tell the kubelet "start it". It writes nodeName into the pod through the API server, and the kubelet, watching the API, sees: this pod is mine now.');
  if (pair.has('kubelet') && pair.has('cni')) return bi('kubelet сам CNI не вызывает: он просит рантайм по CRI создать песочницу, а уже рантайм зовёт плагин CNI.', 'The kubelet does not call CNI itself: it asks the runtime over CRI to create the sandbox, and the runtime calls the CNI plugin.');
  if (pair.has('kubectl')) return bi('kubectl знает один адрес, адрес API-сервера из kubeconfig. С остальными компонентами он не разговаривает.', 'kubectl knows one address — the API server from kubeconfig. It does not talk to any other component.');
  if (pair.has('runtime') && pair.has('apiserver')) return bi('Рантайм ничего не знает о Kubernetes и его API: им управляет kubelet по CRI.', 'The runtime knows nothing about Kubernetes and its API: the kubelet drives it over CRI.');
  if (pair.has('cni') && pair.has('apiserver')) return bi('Плагин CNI — исполняемый файл, который вызывает рантайм; для сети подов ему не нужно разговаривать с API-сервером (его демон может это делать, например ради NetworkPolicy).', 'The CNI plugin is an executable the runtime calls; pod networking does not need the API server (its daemon may talk to it, for NetworkPolicy for example).');
  return bi('Компоненты не разговаривают друг с другом напрямую: каждый смотрит API-сервер и записывает туда результат своей работы.', 'Components do not talk to each other directly: each one watches the API server and writes the result of its work there.');
}

export interface CanvasState {
  placed: string[];
  wires: string[];
  /** Layers switched off as a whole (their blocks stay on the canvas, dimmed). */
  off?: LayerId[];
  cni?: CniVariant;
}

export interface Built {
  components: Partial<Components>;
  kubelet: boolean;
  runtime: boolean;
  kubectl: boolean;
  addons: AddonId[];
  proxyReplacement: boolean;
  /** Components switched off: not on the canvas, unwired, or in a layer that is off. */
  missing: string[];
}

/** Which kube-lite components and add-ons are on, from what is placed, wired and switched on. */
export function componentsFrom(st: CanvasState, layers: LayerId[] = CORE_LAYERS): Built {
  const live = (id: string) => {
    const c = comp(id);
    return st.placed.includes(id) && (c.layer === 'client' || !(st.off ?? []).includes(c.layer));
  };
  const wired = (a: string, b: string) => st.wires.includes(key(a, b));
  const on = (id: string, to: string) => live(id) && live(to) && wired(id, to);
  const apiserver = live('apiserver');
  const etcd = on('etcd', 'apiserver');
  const kubelet = on('kubelet', 'apiserver');
  const runtime = kubelet && on('runtime', 'kubelet');
  const cni = runtime && on('cni', 'runtime');
  const variant = st.cni ?? 'k3s';
  const comps: Partial<Components> = {
    apiserver,
    etcd,
    scheduler: on('scheduler', 'apiserver'),
    'controller-manager': on('controller-manager', 'apiserver'),
    'kube-proxy': on('kube-proxy', 'apiserver'),
    coredns: on('coredns', 'apiserver'),
    cni,
    netpol: variant !== 'flannel',
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
  const addons: AddonId[] = [];
  for (const c of COMPONENTS) {
    if (!c.addon || !layers.includes(c.layer as LayerId)) continue;
    if (live(c.id)) addons.push(c.addon);
    else missing.push(c.id);
  }
  return { components: comps, kubelet, runtime, missing, kubectl: on('kubectl', 'apiserver'), addons, proxyReplacement: variant === 'cilium' && cni };
}

/** Is the part a scenario needs missing in this build? "netpol" is the CNI's policy support. */
export function lacks(r: Built, id: string): boolean {
  if (id === 'kube-proxy') return !r.components['kube-proxy'] && !r.proxyReplacement;
  if (id === 'netpol') return !!r.components.cni && r.components.netpol === false;
  const c = comp(id);
  if (c?.addon) return !r.addons.includes(c.addon);
  return r.missing.includes(id);
}

// ── scenarios ──

export interface Line {
  run: string;
  /** What the output shows as the command (when the trainer runs an equivalent). */
  show?: string;
}

export interface Scenario {
  id: string;
  layer: LayerId;
  label: Bi;
  /** Files put into the learner's home directory before the run. */
  files?: Record<string, string>;
  /** Said above the output: where a command runs when it is not obvious. */
  note?: Bi;
  lines: (string | Line)[];
  /** What the scenario passes, in the order a change or a request does. */
  chain: string[];
  /** A sentence that replaces a component's general cause for this scenario. */
  causes?: Record<string, Bi>;
  ok: Bi;
}

const SHOP = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: shop
  template:
    metadata:
      labels:
        app: shop
    spec:
      containers:
      - name: web
        image: trainer/web:1.0
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: shop
spec:
  selector:
    app: shop
  ports:
  - port: 80
    targetPort: 80
`;

const SHOP_ROUTE = `---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: shop
spec:
  parentRefs:
  - name: traefik-gateway
    namespace: traefik
  hostnames:
  - shop.example
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: shop
      port: 80
`;

/** The admin's Gateway with an HTTPS listener whose certificate cert-manager issues. */
const TLS_GATEWAY = `apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: traefik-gateway
  namespace: traefik
  annotations:
    cert-manager.io/cluster-issuer: office-ca
spec:
  gatewayClassName: traefik
  listeners:
  - name: web
    port: 8000
    protocol: HTTP
    allowedRoutes:
      namespaces:
        from: All
  - name: websecure
    port: 8443
    protocol: HTTPS
    hostname: shop.example
    tls:
      certificateRefs:
      - name: shop-tls
    allowedRoutes:
      namespaces:
        from: All
`;

const DB = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: db
spec:
  replicas: 1
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
      - name: redis
        image: redis:8
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: data
`;

const HPA = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: trainer/web:1.0
        resources:
          requests:
            cpu: 100m
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
`;

const GIT_WEB = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: trainer/web:1.0
`;

const API = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: trainer/web:1.0
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
  - port: 80
`;

const NETPOL = `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-only-from-web
spec:
  podSelector:
    matchLabels:
      app: api
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: web
`;

const CORE_CHAIN = ['apiserver', 'etcd', 'controller-manager', 'scheduler', 'kubelet', 'runtime', 'cni'];

export const SCENARIOS: Scenario[] = [
  {
    id: 'apply',
    layer: 'cp',
    label: bi('Deployment на 3 реплики', 'Deployment with 3 replicas'),
    lines: ['kubectl create deployment web --image=trainer/web:1.0 --replicas=3', 'cluster ff 30s', 'kubectl get deploy,rs,pods -o wide'],
    chain: CORE_CHAIN,
    ok: bi('Все компоненты на месте: контроллеры создали ReplicaSet и три пода, планировщик назначил им узлы, а kubelet через рантайм и сетевой плагин запустил контейнеры, поэтому READY показывает 3/3.', 'Everything is in place: the controllers created a ReplicaSet and three pods, the scheduler assigned them nodes, and the kubelet started the containers through the runtime and the network plugin, so READY shows 3/3.'),
  },
  {
    id: 'delete',
    layer: 'cp',
    label: bi('Удалить под', 'Delete a pod'),
    lines: ['kubectl create deployment web --image=trainer/web:1.0 --replicas=3', 'cluster ff 30s', 'kubectl delete pod -l app=web --wait=false', 'cluster ff 20s', 'kubectl get pods'],
    chain: CORE_CHAIN,
    causes: { 'controller-manager': bi('На холсте нет kube-controller-manager, поэтому удалённые поды никто не вернул: контроллер ReplicaSet, который замечает нехватку подов, работает именно в нём.', 'There is no kube-controller-manager on the canvas, so nobody brought the deleted pods back: the ReplicaSet controller that notices missing pods lives there.') },
    ok: bi('Удалённые поды сразу вернулись под новыми именами: контроллер ReplicaSet заметил, что подов меньше трёх, и создал недостающие, а планировщик и kubelet их запустили.', 'The deleted pods came back under new names at once: the ReplicaSet controller saw fewer than three and created the missing ones, and the scheduler and the kubelet started them.'),
  },
  {
    id: 'node',
    layer: 'node',
    label: bi('Узел выключился', 'A node lost power'),
    lines: ['kubectl create deployment web --image=trainer/web:1.0 --replicas=3', 'cluster ff 30s', 'cluster power off worker-2', 'cluster ff 6m', 'kubectl get nodes', 'kubectl get pods -o wide'],
    chain: CORE_CHAIN,
    ok: bi('Через 50 секунд молчания контроллер узлов пометил worker-2 как NotReady, через пять минут выселил его поды, а контроллер ReplicaSet создал им замену на живых узлах.', 'After 50 silent seconds the node controller marked worker-2 NotReady, after five minutes it evicted its pods, and the ReplicaSet controller created replacements on the live nodes.'),
  },
  {
    id: 'service',
    layer: 'net',
    label: bi('Запрос к Service по имени', 'A request to a Service by name'),
    lines: ['kubectl create deployment web --image=trainer/web:1.0 --replicas=2 --port=80', 'kubectl expose deployment web --port=80', 'kubectl run client --image=trainer/client:1.0', 'cluster ff 30s', 'kubectl get svc web', 'kubectl exec client -- curl -sS http://web', "kubectl exec client -- curl -sS http://$(kubectl get svc web -o jsonpath='{.spec.clusterIP}')"],
    chain: [...CORE_CHAIN, 'coredns', 'kube-proxy'],
    ok: bi('CoreDNS ответил на имя web адресом ClusterIP, а правила kube-proxy (или сетевого плагина, который его заменяет) отправили запрос на один из подов, поэтому оба запроса получили ответ.', 'CoreDNS answered the name web with the ClusterIP, and the rules of kube-proxy (or of the network plugin replacing it) sent the request to one of the pods, so both requests got an answer.'),
  },
  {
    id: 'netpol',
    layer: 'net',
    label: bi('Закрыть сервис политикой', 'Close a Service with a policy'),
    files: { 'api.yaml': API, 'netpol.yaml': NETPOL },
    lines: ['kubectl apply -f api.yaml', 'kubectl run web --image=trainer/client:1.0 --labels=app=web', 'kubectl run client --image=trainer/client:1.0', 'cluster ff 30s', 'kubectl apply -f netpol.yaml', 'kubectl exec web -- curl -sS --max-time 5 http://api', 'kubectl exec client -- curl -sS --max-time 5 http://api'],
    chain: [...CORE_CHAIN, 'coredns', 'kube-proxy', 'netpol'],
    causes: {
      netpol: bi('Выбран сетевой плагин flannel, а он NetworkPolicy не применяет: политика api-only-from-web записана в API, но пакеты от пода client к поду api никто не фильтрует, поэтому запрос, который должен был оборваться, получил ответ.', 'The chosen network plugin is flannel, which does not enforce NetworkPolicy: api-only-from-web is in the API, but nobody filters the packets from client to api, so the request that should have been cut got an answer.'),
    },
    ok: bi('Сетевой плагин применил политику api-only-from-web: под web с меткой app=web получил ответ, а запрос пода client оборвался по тайм-ауту, потому что его пакеты к поду api отбрасываются.', 'The network plugin enforced api-only-from-web: the pod web (label app=web) got an answer, and the request from client timed out, because its packets to api are dropped.'),
  },
  {
    id: 'outside',
    layer: 'ingress',
    label: bi('Сайт снаружи по имени', 'The site from outside by name'),
    files: { 'shop.yaml': SHOP + SHOP_ROUTE },
    note: bi('Команда curl в конце выполняется на ноутбуке в сети офиса, 192.168.56.0/24, где стоят и узлы кластера. DNS офиса направляет имена вида shop.example на адрес 192.168.56.240.', 'The curl at the end runs on a laptop in the office network, 192.168.56.0/24, the network of the cluster nodes. The office DNS points names like shop.example at 192.168.56.240.'),
    lines: ['kubectl apply -f shop.yaml', 'cluster ff 30s', 'kubectl get gateway -n traefik', 'kubectl -n traefik get svc traefik', { run: 'cluster curl -sS http://shop.example/', show: 'curl -sS http://shop.example/' }],
    chain: [...CORE_CHAIN, 'traefik', 'metallb', 'kube-proxy'],
    causes: {
      scheduler: bi('На холсте нет планировщика kube-scheduler, поэтому поды магазина так и не получили узел и не запустились. Запрос из офиса дошёл до Traefik, маршрут для shop.example у него есть, но за сервисом shop нет ни одного готового пода, и Traefik отвечает 503 со словами «no available server».', 'There is no kube-scheduler on the canvas, so the shop pods never got a node and never started. The request from the office reached Traefik, which has the route for shop.example, but there is no ready pod behind Service shop, so it answers 503 "no available server".'),
      'controller-manager': bi('На холсте нет kube-controller-manager, поэтому по Deployment shop никто не создал подов. Запрос из офиса дошёл до Traefik, маршрут для shop.example у него есть, но за сервисом shop нет ни одного пода, и Traefik отвечает 503 со словами «no available server».', 'There is no kube-controller-manager on the canvas, so nobody created the shop pods. The request reached Traefik, which has the route, but there is no pod behind Service shop, so it answers 503 "no available server".'),
    },
    ok: bi('MetalLB выдал сервису Traefik адрес 192.168.56.240 и отвечает за него в сети офиса, kube-proxy привёл запрос к поду Traefik, а тот по имени shop.example и маршруту HTTPRoute отправил его в под магазина.', 'MetalLB gave the Traefik Service 192.168.56.240 and answers for it on the office network, kube-proxy brought the request to the Traefik pod, and it sent the request by the name shop.example and the HTTPRoute to a shop pod.'),
  },
  {
    id: 'https',
    layer: 'certs',
    label: bi('HTTPS-сертификат', 'An HTTPS certificate'),
    files: { 'gateway-tls.yaml': TLS_GATEWAY, 'shop.yaml': SHOP + SHOP_ROUTE },
    note: bi('Файл gateway-tls.yaml пишет администратор кластера: он добавляет в Gateway traefik-gateway слушателя HTTPS для shop.example и аннотацию для cert-manager. Команда curl в конце выполняется на ноутбуке в сети офиса, который доверяет центру сертификации офиса office-ca, но не самоподписанным сертификатам.', 'gateway-tls.yaml is the cluster admin’s: it adds an HTTPS listener for shop.example and the cert-manager annotation to Gateway traefik-gateway. The curl at the end runs on an office laptop that trusts the office CA office-ca but not self-signed certificates.'),
    lines: ['kubectl apply -f gateway-tls.yaml', 'kubectl apply -f shop.yaml', 'cluster ff 1m', 'kubectl -n traefik get certificate', 'kubectl -n traefik get secret shop-tls', { run: 'cluster curl -sS https://shop.example/', show: 'curl -sS https://shop.example/' }],
    chain: [...CORE_CHAIN, 'traefik', 'metallb', 'kube-proxy', 'cert-manager'],
    ok: bi('cert-manager увидел аннотацию на Gateway, выпустил Certificate shop-tls у центра сертификации office-ca и положил его в Secret shop-tls, а Traefik отдал этот сертификат, которому ноутбук в офисе доверяет.', 'cert-manager saw the Gateway annotation, issued Certificate shop-tls from office-ca into Secret shop-tls, and Traefik presented that certificate, which the office laptop trusts.'),
  },
  {
    id: 'disk',
    layer: 'storage',
    label: bi('База данных с диском', 'A database with a disk'),
    files: { 'db.yaml': DB },
    lines: ['kubectl apply -f db.yaml', 'cluster ff 30s', 'kubectl get pvc data', 'kubectl get pods -l app=db', 'kubectl get events --field-selector involvedObject.kind=PersistentVolumeClaim'],
    chain: ['apiserver', 'etcd', 'csi-hostpath', 'controller-manager', 'scheduler', 'kubelet', 'runtime', 'cni'],
    causes: { 'controller-manager': bi('На холсте нет kube-controller-manager, а в нём работает контроллер томов, который связывает заявку PVC с созданным томом, поэтому заявка не перешла в Bound, и Deployment db не создал подов.', 'There is no kube-controller-manager on the canvas, and the volume controller that binds a claim to the created volume lives there, so the claim never became Bound and Deployment db created no pods.') },
    ok: bi('StorageClass по умолчанию досталась заявке data, CSI-драйвер создал том, контроллер томов связал их, и только после этого планировщик поставил под базы данных на узел.', 'The default StorageClass went to the claim data, the CSI driver created a volume, the volume controller bound them, and only then the scheduler placed the database pod.'),
  },
  {
    id: 'hpa',
    layer: 'metrics',
    label: bi('Автомасштабирование под нагрузкой', 'Autoscaling under load'),
    files: { 'web-hpa.yaml': HPA },
    note: bi('Команда cluster load изображает пользователей: их запросы стоят подам web вместе 250m процессора, то есть четверть ядра.', 'cluster load plays the users: their requests cost the web pods 250m of CPU together, a quarter of a core.'),
    lines: ['kubectl apply -f web-hpa.yaml', 'cluster ff 1m', 'kubectl top pods -l app=web', 'cluster load web 250m', 'cluster ff 2m', 'kubectl get hpa web', 'kubectl get deploy web'],
    chain: ['apiserver', 'etcd', 'metrics-server', 'controller-manager', 'scheduler', 'kubelet', 'runtime', 'cni'],
    causes: { 'controller-manager': bi('На холсте нет kube-controller-manager, а контроллер HPA работает именно в нём, поэтому нагрузку никто не сравнил с целью в 50 процентов, и число реплик не изменилось.', 'There is no kube-controller-manager on the canvas, and the HPA controller lives there, so nobody compared the load with the 50 percent target and the replica count did not change.') },
    ok: bi('metrics-server отдал текущее потребление подов, контроллер HPA увидел, что под тратит в несколько раз больше половины своих 100m, и поднял число реплик до пяти, а на пяти подах загрузка вернулась к цели.', 'metrics-server served the current usage, the HPA controller saw a pod using several times half of its 100m and raised the replicas to five; on five pods the load came back to the target.'),
  },
  {
    id: 'gitops',
    layer: 'gitops',
    label: bi('Выкладка через Git', 'Deploying through Git'),
    files: { 'web.yaml': GIT_WEB },
    note: bi('Команда cluster git push кладёт web.yaml в каталог apps/ репозитория команды и отправляет коммит в ветку main, как git commit и git push.', 'cluster git push puts web.yaml into apps/ of the team repository and pushes a commit to main, as git commit and git push do.'),
    lines: ['cluster git push web.yaml -m "web: three replicas"', 'cluster ff 2m', 'kubectl get kustomization -n flux-system', 'kubectl get deploy web', 'kubectl scale deploy web --replicas=1', 'cluster ff 6m', 'kubectl get deploy web'],
    chain: ['apiserver', 'etcd', 'flux', 'controller-manager', 'scheduler', 'kubelet', 'runtime', 'cni'],
    ok: bi('Flux забрал коммит из Git и применил apps/web.yaml, а ручной kubectl scale до одной реплики продержался только до следующей сверки: через пять минут kustomize-controller вернул три реплики, как записано в Git.', 'Flux fetched the commit and applied apps/web.yaml, and the manual scale to one replica lasted only until the next reconciliation: five minutes later kustomize-controller restored three replicas, as Git says.'),
  },
  {
    id: 'alert',
    layer: 'obs',
    label: bi('Почему не пришёл алерт', 'Why no alert came'),
    lines: ['kubectl create deployment pay --image=trainer/web:2.0', 'kubectl run client --image=trainer/client:1.0', 'cluster ff 20m', 'kubectl get pods', 'kubectl exec client -- curl -sS http://prometheus.monitoring:9090/api/v1/alerts'],
    chain: [...CORE_CHAIN, 'coredns', 'kube-proxy', 'prometheus', 'kube-state-metrics'],
    ok: bi('Под pay двадцать минут перезапускается в CrashLoopBackOff, kube-state-metrics превратил это в метрику, а Prometheus через 15 минут перевёл алерт KubePodCrashLooping в состояние firing, и дальше его доставил бы Alertmanager.', 'Pod pay has been restarting in CrashLoopBackOff for twenty minutes; kube-state-metrics turned that into a metric, and after 15 minutes Prometheus moved KubePodCrashLooping to firing, for Alertmanager to deliver.'),
  },
];

export const scenarioLayers = (sc: Scenario): LayerId[] => [...new Set(sc.chain.map((id) => (id === 'netpol' ? 'net' : (comp(id).layer as LayerId))))];

/** The sentences under a run: which component's absence caused what the output shows. */
export function explain(sc: Scenario, r: Built): Bi[] {
  const gone = sc.chain.filter((id) => lacks(r, id));
  if (!gone.length) return [sc.ok];
  const cause = (id: string) => sc.causes?.[id] ?? (id === 'netpol' ? CNI_VARIANTS[0].what : comp(id).cause);
  const out: Bi[] = [cause(gone[0])];
  if (gone.length > 1) {
    const names = gone.slice(1).map((id) => (id === 'netpol' ? bi('поддержки NetworkPolicy в сетевом плагине', 'NetworkPolicy support in the plugin') : bi(comp(id).label, comp(id).label)));
    const join = (k: 'ru' | 'en') => names.map((n) => n[k]).join(', ');
    out.push(bi(`Кроме того, в этом кластере нет ещё ${join('ru')}, но в выводе этого уже не видно, потому что путь оборвался раньше.`, `Also missing in this cluster: ${join('en')}, but the output does not show it: the path broke earlier.`));
  }
  return out;
}

export interface RunResult {
  text: string;
  built: Built;
  explain: Bi[];
}

/** Start kube-lite from the canvas and run a scenario in it, as the widget does. */
export async function runScenario(st: CanvasState, sc: Scenario, layers: LayerId[] = CORE_LAYERS, opts?: SimMachineOptions, alive: () => boolean = () => true): Promise<RunResult | null> {
  const r = componentsFrom(st, layers);
  const m = await createSimMachine(
    {
      hostname: 'laptop',
      ext: { k8s: { components: r.components, bare: !r.components.coredns, addons: r.addons, proxyReplacement: r.proxyReplacement, after: { kubelet: r.kubelet ? {} : { 'cp-1': false, 'worker-1': false, 'worker-2': false } } } },
    },
    opts,
  );
  try {
    if (!r.runtime) {
      const c = k8sState(m).cluster!;
      for (const n of c.nodes) n.runtime = false;
      c.advance(2000);
    }
    const user = m.users.find((u) => u.name === 'learner');
    for (const [name, text] of Object.entries(sc.files ?? {})) {
      const path = `${user?.home ?? '/root'}/${name}`;
      m.rootFs.writeFile(path, text);
      if (user) m.rootFs.chown(path, user.uid, user.gid);
    }
    let text = '';
    for (const l of sc.lines) {
      const line = typeof l === 'string' ? { run: l } : l;
      const res = await m.exec(line.run);
      text += `$ ${line.show ?? line.run}\n${stripAnsi(res.out)}`;
      if (!alive()) return null;
    }
    return { text, built: r, explain: explain(sc, r) };
  } finally {
    m.dispose();
  }
}
