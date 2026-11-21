// Э1 (05 §6.4): the path of `kubectl apply` through every component, from
// the HTTP request to a Ready pod behind a Service. Knobs: replicas, image
// already on the node, RBAC forbids, quota exhausted, stop at etcd (the
// first lesson stops there). Breaks: any component of the constructor —
// the path stops on its step with the real message.
//
// Reading order: at first only kubectl and the API server are on screen,
// inside the empty frames of the control plane and of the node worker-1.
// Every component appears when the path reaches it and says what it does;
// what it hands on is a card on its line.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, anyBroken, box, edge, fmtb, idsOf, LEGEND_BASE, mark, metric, num, only, PODS } from './kit';

type P = { replicas: number; cached: boolean; rbac: boolean; quota: boolean; upto: string };

const STATIC = bi('Этот процесс работает на управляющем узле, и kubelet этого узла запускает его прямо из файла на диске.', 'This process runs on the control-plane node, and the kubelet there starts it straight from a file on disk.');
const ON_NODE = bi('Работает службой systemd на каждом узле.', 'A systemd service on every node.');

const diagram = {
  width: 960,
  height: 560,
  nodes: [
    box('kubectl', bi('Вы, kubectl', 'You, kubectl'), 'user', 'box', [24, 52, 150, 56], 'terminal', bi('Клиент кластера. Он читает файл web.yaml, по полям apiVersion и kind понимает, какой это объект, и отправляет его API-серверу.', 'Reads web.yaml, finds the resource by apiVersion and kind and sends it to the API server.'), bi('Команду набираете вы; адрес сервера и ключ kubectl берёт из kubeconfig.', 'You type it; address and keys come from kubeconfig.'), { see: 'kubectl apply -f web.yaml -v=6', doc: D.components }),
    box('api', 'kube-apiserver', 'cp', 'hex', [360, 52, 220, 56], 'server', bi('Единственный вход в кластер. API-сервер узнаёт, кто вы, проверяет, разрешено ли вам действие, дописывает значения по умолчанию, проверяет объект, записывает его в etcd и рассылает события всем подписчикам.', 'The only door: authentication, authorization, defaults, validation, the etcd write and watch events.'), STATIC, { see: 'kubectl get --raw /readyz?verbose', doc: D.apiserver }),
    box('etcd', 'etcd', 'store', 'box', [770, 52, 166, 56], 'database', bi('Хранилище «ключ — значение», в котором кластер держит все объекты. Ваш Deployment будет лежать там по ключу /registry/deployments/default/web.', 'The key store; your Deployment lives at /registry/deployments/default/web.'), STATIC, { see: 'cluster etcd /registry/deployments', doc: D.components }),
    box('cm', 'controller-manager', 'cp', 'hex', [250, 178, 210, 56], 'process', bi('В процессе kube-controller-manager работают контроллеры, в том числе Deployment и ReplicaSet. Они видят новый объект и создают следующий, то есть сначала ReplicaSet, а потом поды.', 'Runs the controllers, including Deployment and ReplicaSet: they see a new object and create the next one.'), STATIC, { see: 'kubectl get rs', doc: D.controller }),
    box('sched', 'kube-scheduler', 'cp', 'hex', [500, 178, 210, 56], 'process', bi('Планировщик выбирает узел для каждого пода, у которого ещё нет узла, и записывает выбор в поле nodeName.', 'Picks a node for every pod without one and writes nodeName.'), STATIC, { see: 'kubectl get pods -o wide', doc: D.scheduler }),
    box('kubelet', 'kubelet', 'node', 'box', [60, 336, 180, 56], 'process', bi('Агент узла worker-1. Он видит поды, назначенные своему узлу, запускает их через containerd и сообщает API-серверу, в каком они состоянии.', 'The worker-1 agent: sees pods assigned to its node, starts them via containerd and reports their status.'), ON_NODE, { see: 'kubectl describe pod <name>', doc: D.components }),
    box('crt', 'containerd', 'process', 'box', [290, 336, 180, 56], 'container', bi('Среда запуска контейнеров. Она создаёт песочницу пода, то есть процесс pause, который держит сетевое пространство имён, скачивает образ и запускает контейнер.', 'The runtime: the pod sandbox (pause), the image, the container.'), ON_NODE, { see: 'crictl pods   # on the node', doc: D.cri }),
    box('cni', bi('Сеть подов (CNI)', 'Pod network (CNI)'), 'l3', 'box', [520, 336, 180, 56], 'router', bi('Плагин сети, здесь flannel. Он даёт песочнице пода сетевой интерфейс и IP-адрес из диапазона адресов узла.', 'The network plugin (flannel): gives the sandbox an interface and an IP from the node’s range.'), bi('Плагин лежит в /opt/cni/bin, его вызывает containerd.', 'A binary in /opt/cni/bin, called by containerd.'), { see: 'cluster ip addr worker-1', doc: D.cni }),
    box('proxy', 'kube-proxy', 'l4', 'box', [60, 448, 180, 56], 'switch', bi('На каждом узле пишет правила, по которым пакеты к адресу Service уходят на один из готовых подов.', 'On every node writes the rules that send Service traffic to a ready pod.'), bi('Работает на каждом узле, а в k3s встроен в сам k3s.', 'Runs on every node (inside k3s).'), { see: 'cluster iptables worker-1', doc: D.vip }),
    box('dns', 'CoreDNS', 'l7', 'box', [290, 448, 180, 56], 'dns', bi('Сервер имён кластера. Он отвечает на имя web.default.svc.cluster.local адресом Service.', 'The cluster DNS: answers web.default.svc.cluster.local with the Service address.'), bi('Работает подами в namespace kube-system.', 'Pods in kube-system.'), { see: 'kubectl -n kube-system get pods -l k8s-app=kube-dns', doc: D.dns }),
  ],
  edges: [
    edge('e-kubectl', 'kubectl', 'api', bi('запрос', 'request'), bi('HTTPS-запрос к API-серверу, в теле которого ваш YAML, переведённый в JSON. Обратно приходит ответ.', 'An HTTPS request with your YAML as JSON; the reply comes back.'), bi('Запрос отправляет kubectl.', 'kubectl.'), { see: 'kubectl apply -f web.yaml -v=6', labelAt: 0.2 }),
    edge('e-etcd', 'api', 'etcd', bi('запись объекта', 'object write'), bi('API-сервер записывает объект, а etcd отвечает номером новой ревизии, который становится resourceVersion объекта.', 'The write; etcd replies with a revision that becomes resourceVersion.'), bi('Пишет kube-apiserver.', 'kube-apiserver.'), { see: 'cluster etcd' }),
    edge('e-cm', 'cm', 'api', bi('создать ReplicaSet и поды', 'create rs and pods'), bi('Контроллеры узнают о новых объектах из событий и создают следующие объекты через тот же API.', 'Controllers learn of objects from events and create the next ones through the same API.'), bi('kube-controller-manager', 'kube-controller-manager')),
    edge('e-sched', 'sched', 'api', bi('узел для пода', 'node for a pod'), bi('Планировщик видит поды без узла и записывает выбранный узел.', 'Sees pods without a node and writes the chosen one.'), bi('kube-scheduler', 'kube-scheduler')),
    edge('e-kubelet', 'kubelet', 'api', bi('мои поды и их статус', 'my pods and their status'), bi('kubelet следит за подами своего узла и записывает их состояние.', 'Watches its node’s pods and writes their status.'), bi('kubelet', 'kubelet'), { via: [[150, 286], [470, 286]], labelAt: 0.5 }),
    edge('e-cri', 'kubelet', 'crt', bi('создать под', 'create pod'), bi('kubelet по интерфейсу CRI просит containerd создать песочницу пода, а потом контейнер.', 'Over CRI: create the sandbox, then the container.'), bi('kubelet', 'kubelet'), { doc: D.cri }),
    edge('e-cni', 'crt', 'cni', bi('дать сеть', 'network'), bi('containerd вызывает плагин сети с командой ADD и параметрами песочницы.', 'containerd runs the plugin with ADD.'), bi('containerd', 'containerd'), { doc: D.cni }),
    edge('e-proxy', 'proxy', 'api', bi('адреса готовых подов', 'ready pod addresses'), bi('kube-proxy получает от API-сервера список адресов готовых подов каждого Service и по нему переписывает правила.', 'kube-proxy gets from the API server the list of ready pod addresses of every Service and rewrites the rules from it.'), bi('kube-proxy', 'kube-proxy'), { via: [[150, 530], [940, 530], [940, 80]], labelAt: 0.38 }),
    edge('e-dns', 'dns', 'api', bi('имена Service', 'Service names'), bi('CoreDNS знает имена и адреса всех Service.', 'CoreDNS knows every Service name.'), bi('CoreDNS', 'CoreDNS'), { via: [[380, 518], [730, 518], [730, 108]], labelAt: 0.65 }),
  ],
  groups: [
    { id: 'g-cp', label: bi('управляющий слой (control plane)', 'control plane'), around: ['api', 'etcd', 'cm', 'sched'], family: 'cp' as const, dash: 'dash' as const, pad: 14, card: { what: bi('Компоненты, которые управляют кластером. Ни один из них не запускает ваши контейнеры.', 'The components that manage the cluster; none runs your containers.'), who: bi('Их ставит установщик кластера: k3s или kubeadm.', 'Installed by k3s or kubeadm.') } },
    { id: 'g-node', label: bi('узел worker-1', 'node worker-1'), around: ['kubelet', 'crt', 'cni', 'proxy', 'dns'], family: 'node' as const, dash: 'solid' as const, pad: 14, card: { what: bi('Узлом называют машину, на которой работают поды. Узлов в кластере обычно много, и на каждом работают kubelet, containerd и kube-proxy.', 'A machine where pods run; each has a kubelet, containerd and kube-proxy.'), who: bi('Машину даёте вы или облако, а в кластер её добавляет kubelet.', 'You or the cloud; the kubelet joins it.') } },
  ],
};

const ALL = idsOf(diagram);

export const applyPathModel = defineModel<P>({
  id: 'k8s.apply-path',
  frame: 'visible',
  block: 'k8s-1',
  title: bi('Что происходит после kubectl apply', 'What happens after kubectl apply'),
  summary: bi(
    'Вы отправляете в кластер Deployment из файла web.yaml, и схема проводит его через все компоненты: от запроса к API-серверу до готового пода, на который ведёт Service. Каждый компонент делает одно дело и записывает результат через API-сервер, а следующий компонент узнаёт об этом и делает своё.',
    'You send a Deployment from web.yaml, and the diagram walks it through every component, from the API request to a ready pod behind a Service. Each component does one job and writes its result through the API server.',
  ),
  intro: bi(
    'Сейчас на схеме только kubectl и API-сервер, а рамки показывают, где появятся остальные компоненты: вверху пунктирная рамка управляющего слоя кластера, внизу сплошная рамка узла worker-1. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» или нажмите «Проиграть». Компоненты будут появляться по одному, когда до них дойдёт путь. Потом выключайте по одному компоненту в блоке «Сломать» и смотрите, на каком шаге путь оборвётся и какое сообщение вы увидите.',
    'For now the diagram shows only kubectl and the API server; the frames show where the rest will appear: the control plane at the top, the node worker-1 at the bottom. Press “Start from the first step”, then “Step forward” or “Play”. Then turn off one component at a time in “Break it” and see where the path stops and what message you get.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:server', 'API-сервер, через который идут все записи', 'the API server all writes go through'),
    mark('icon:database', 'хранилище etcd', 'etcd'),
    mark('icon:process', 'управляющий процесс, то есть контроллер, планировщик или kubelet', 'a managing process, that is a controller, the scheduler or the kubelet'),
    mark('icon:container', 'среда запуска контейнеров', 'the container runtime'),
    mark('ok', 'шаг этого компонента выполнен', 'this component’s step is done'),
    mark('err', 'здесь путь оборвался', 'the path broke here'),
  ],
  stopLabel: bi('Путь оборвался', 'The path stopped'),
  concepts: ['k8s.control-plane'],
  diagram,
  params: [
    {
      id: 'replicas',
      label: bi('Сколько подов в Deployment (replicas)', 'Pods in the Deployment (replicas)'),
      kind: 'range',
      min: 1,
      max: 5,
      step: 1,
      default: 3,
      near: 'cm',
      group: bi('Что вы отправляете', 'What you send'),
      predict: {
        prompt: bi('Вы меняете число подов в Deployment. Сколько записей о выборе узла сделает планировщик?', 'You change replicas. How many node choices will the scheduler write?'),
        options: [
          { id: 'each', text: bi('Столько же, сколько подов, то есть по одной на каждый под', 'One per pod') },
          { id: 'one', text: bi('Одну на весь Deployment', 'One for the whole Deployment') },
        ],
        resolve: () => 'each',
      },
    },
    {
      id: 'upto',
      label: bi('Насколько далеко провести запрос', 'How far to follow the request'),
      kind: 'choice',
      default: 'all',
      group: bi('Что вы отправляете', 'What you send'),
      options: [
        { id: 'etcd', label: bi('до записи в etcd', 'up to the etcd write') },
        { id: 'all', label: bi('до готового пода за Service', 'to a ready pod behind a Service') },
      ],
    },
    { id: 'cached', label: bi('Образ trainer/web:1.0 уже скачан на worker-1', 'The image is already on worker-1'), kind: 'toggle', default: false, near: 'crt', group: bi('Условия в кластере', 'Cluster conditions') },
    {
      id: 'rbac',
      label: bi('У вас нет права создавать Deployment (RBAC)', 'You may not create Deployments (RBAC)'),
      kind: 'toggle',
      default: false,
      near: 'api',
      levels: ['intermediate', 'experienced'],
      group: bi('Условия в кластере', 'Cluster conditions'),
      predict: {
        prompt: bi('У вас нет права создавать Deployment. На каком компоненте остановится запрос?', 'You have no right to create Deployments. Where does the request stop?'),
        options: [
          { id: 'api', text: bi('На API-сервере, до записи в etcd', 'At the API server, before etcd') },
          { id: 'kubelet', text: bi('На узле, где kubelet откажется запускать под', 'On the node, where the kubelet refuses') },
        ],
        resolve: (_p, n) => (n.find((s) => s.broken)?.broken?.at === 'api' ? 'api' : 'kubelet'),
      },
    },
    { id: 'quota', label: bi('Квота namespace на число Deployment исчерпана', 'The namespace Deployment quota is used up'), kind: 'toggle', default: false, near: 'api', levels: ['intermediate', 'experienced'], group: bi('Условия в кластере', 'Cluster conditions') },
  ],
  breaks: [
    { id: 'no-etcd', label: bi('etcd не отвечает', 'etcd does not answer'), remove: ['etcd', 'e-etcd'], boundary: 'storage', predict: { prompt: bi('etcd не отвечает, а остальные компоненты работают. Что вернёт kubectl после `kubectl apply -f web.yaml`?', 'etcd does not answer. What does kubectl get back?'), options: [{ id: 'err', text: bi('Ошибку, потому что объект сохранить негде', 'An error: nowhere to store the object') }, { id: 'ok', text: bi('«created», а сохранится объект потом', '“created”, stored later') }], resolve: (_p, n) => (n.some((s) => s.broken?.at === 'e-etcd') ? 'err' : 'ok') } },
    { id: 'no-cm', label: bi('kube-controller-manager остановлен', 'kube-controller-manager is stopped'), remove: ['cm', 'e-cm'], boundary: 'process', predict: { prompt: bi('kube-controller-manager остановлен, а API-сервер и etcd работают. Что будет после того, как kubectl напечатает «deployment.apps/web created»?', 'controller-manager is stopped. What happens after “deployment.apps/web created”?'), options: [{ id: 'nothing', text: bi('Ничего не произойдёт, и в кластере не появится ни ReplicaSet, ни подов', 'Nothing: no ReplicaSet, no pods') }, { id: 'pods', text: bi('Поды создаст сам API-сервер', 'The API server creates the pods') }], resolve: (_p, n) => (n.some((s) => s.broken?.at === 'cm') ? 'nothing' : 'pods') } },
    { id: 'no-sched', label: bi('kube-scheduler остановлен', 'kube-scheduler is stopped'), remove: ['sched', 'e-sched'], boundary: 'process', predict: { prompt: bi('kube-scheduler остановлен, а контроллеры работают. Что будет с подами, которые они создадут?', 'kube-scheduler is stopped. What happens to the pods?'), options: [{ id: 'pending', text: bi('Останутся в состоянии Pending, и событий о них не будет', 'They stay Pending with no events') }, { id: 'self', text: bi('kubelet сам заберёт под на свой узел', 'A kubelet takes them itself') }], resolve: (_p, n) => (n.some((s) => s.broken?.at === 'sched') ? 'pending' : 'self') } },
    { id: 'no-kubelet', label: bi('kubelet на worker-1 остановлен', 'The kubelet on worker-1 is stopped'), remove: ['kubelet', 'e-kubelet', 'e-cri'], boundary: 'process', predict: { prompt: bi('kubelet на worker-1 только что остановился, и узел ещё не помечен как недоступный. Может ли планировщик назначить под на worker-1?', 'The kubelet on worker-1 just stopped; the node is not yet marked unreachable. May the scheduler still assign a pod there?'), options: [{ id: 'yes', text: bi('Да, и под не запустится, пока узел не пометят недоступным', 'Yes, and the pod will not start') }, { id: 'no', text: bi('Нет, планировщик узнаёт об остановке сразу', 'No, the scheduler knows at once') }], resolve: () => 'yes' } },
    { id: 'no-cni', label: bi('Плагин сети подов (CNI) на worker-1 не установлен', 'No CNI plugin on worker-1'), remove: ['cni', 'e-cni'], boundary: 'network', layer: 'L3', predict: { prompt: bi('На worker-1 нет плагина сети подов. На каком шаге остановится запуск пода?', 'No CNI plugin on worker-1. At which step does the pod start fail?'), options: [{ id: 'sandbox', text: bi('Когда containerd создаёт песочницу пода', 'When the sandbox is created') }, { id: 'pull', text: bi('Когда containerd скачивает образ', 'When the image is pulled') }], resolve: (_p, n) => (n.some((s) => s.broken?.at === 'e-cni') ? 'sandbox' : 'pull') } },
    { id: 'no-proxy', label: bi('kube-proxy не работает', 'kube-proxy is down'), remove: ['proxy', 'e-proxy'], boundary: 'network', layer: 'L4', predict: { prompt: bi('kube-proxy не работает, а всё остальное в порядке. Станет ли под готовым?', 'kube-proxy is down. Will the pod become ready?'), options: [{ id: 'ready', text: bi('Да, но запрос на адрес Service не дойдёт до пода', 'Yes, but a request to the Service address will not reach it') }, { id: 'not', text: bi('Нет, под не запустится', 'No, the pod will not start') }], resolve: (_p, n) => (n.some((s) => s.broken?.at === 'proxy') ? 'ready' : 'not') } },
  ],
  metrics: [
    { id: 'requests', label: bi('запросов к API-серверу', 'API requests') },
    { id: 'writes', label: bi('записей в etcd', 'etcd writes') },
    { id: 'bindings', label: bi('подов привязано к узлу', 'pods bound') },
    { id: 'seconds', label: bi('секунд от команды', 'seconds since the command') },
  ],
  run(p, broken): Step[] {
    const n = p.replicas;
    const pods = num(n, ...PODS);
    const s: Step[] = [];
    let requests = 0;
    let writes = 0;
    let bindings = 0;
    let seconds = 0;
    const m = () => ({ requests, writes, bindings, seconds: Math.round(seconds * 10) / 10 });
    requests++;
    s.push({
      id: 'post',
      label: bi('запрос', 'request'),
      caption: bi('Вы набираете `kubectl apply -f web.yaml`. kubectl читает файл, по полям apiVersion apps/v1 и kind Deployment понимает, куда его отправить, и посылает API-серверу запрос POST /apis/apps/v1/namespaces/default/deployments.', 'kubectl reads web.yaml, finds the resource and sends POST /apis/apps/v1/namespaces/default/deployments.'),
      focus: ['kubectl', 'e-kubectl'],
      states: only(ALL, 'kubectl', 'api', 'e-kubectl'),
      tokens: [{ edge: 'e-kubectl', label: 'POST deployments' }],
      say: { kubectl: bi('kubectl отправляет Deployment из web.yaml API-серверу.', 'kubectl sends the Deployment from web.yaml.') },
      metrics: m(),
    });
    if (p.rbac) {
      s.push({
        id: 'authz',
        label: bi('права', 'authz'),
        caption: bi('API-сервер узнаёт вас по сертификату из kubeconfig, но правила RBAC не дают вам права создавать Deployment. Запрос отклонён ещё до того, как что-либо записано.', 'The API server knows you, but RBAC grants no create on deployments: rejected before any write.'),
        focus: ['api'],
        say: { api: bi('API-сервер не находит правила, которое разрешает вам создавать Deployment.', 'No rule lets you create Deployments.') },
        states: { api: 'err' },
        metrics: m(),
        broken: { at: 'api', message: 'Error from server (Forbidden): error when creating "web.yaml": deployments.apps is forbidden: User "jane" cannot create resource "deployments" in API group "apps" in the namespace "default"', caption: bi('на проверке прав. Объект нигде не записан, и контроллеры о нём не узнают. В жизни такой отказ узнают по слову Forbidden и фразе cannot create resource.', 'at authorization: the object exists nowhere; recognised by Forbidden and “cannot create resource”.') },
      });
      return s;
    }
    s.push({
      id: 'authn',
      label: bi('кто вы', 'who'),
      caption: bi('API-сервер узнаёт вас по сертификату из kubeconfig и находит правило RBAC, которое разрешает вам создавать Deployment.', 'The API server knows you by your certificate and finds an RBAC rule that allows it.'),
      focus: ['api'],
      say: { api: bi('API-сервер проверяет, кто вы и разрешено ли вам создавать Deployment.', 'Checks who you are and whether you may.') },
      states: { api: 'on' },
      metrics: m(),
    });
    s.push({
      id: 'defaults',
      label: bi('умолчания', 'defaults'),
      caption: bi('API-сервер дописывает в объект всё, чего вы не указали: способ выкладки RollingUpdate с границами по 25 %, хранить 10 старых ревизий, считать выкладку зависшей через 600 секунд.', 'Defaults are filled in: RollingUpdate 25 %/25 %, 10 old revisions, a 600-second progress deadline.'),
      focus: ['api'],
      say: { api: bi('API-сервер дописывает в Deployment значения по умолчанию.', 'The API server fills in defaults.') },
      values: { api: t(bi('+ умолчания', '+ defaults')) },
      metrics: m(),
    });
    if (p.quota) {
      s.push({
        id: 'quota',
        label: bi('квота', 'quota'),
        caption: bi('Объект составлен правильно, но в namespace уже пять Deployment, а квота больше не разрешает. Это последняя проверка перед записью, и запрос отклонён.', 'The object is valid, but the namespace quota of five Deployments is used up: the last check before the write refuses.'),
        focus: ['api'],
        say: { api: bi('API-сервер видит, что квота namespace на Deployment исчерпана.', 'The namespace quota is used up.') },
        states: { api: 'err' },
        metrics: m(),
        broken: { at: 'api', message: 'Error from server (Forbidden): error when creating "web.yaml": deployments.apps "web" is forbidden: exceeded quota: objects, requested: count/deployments.apps=1, used: count/deployments.apps=5, limited: count/deployments.apps=5', caption: bi('на последней проверке перед записью, и в etcd ничего не попало. Такой отказ узнают по фразе exceeded quota.', 'at the last check before the write; recognised by “exceeded quota”.') },
      });
      return s;
    }
    s.push({
      id: 'validate',
      label: bi('проверка', 'validate'),
      caption: bi('API-сервер проверяет объект по схеме: селектор совпадает с метками шаблона, у контейнера указан образ, квоты не превышены. Объект можно записывать.', 'Schema validation passes: the selector matches the template labels, the container has an image, quotas are fine.'),
      focus: ['api'],
      say: { api: bi('API-сервер проверяет Deployment по схеме и квотам.', 'Validates against the schema and quotas.') },
      metrics: m(),
    });
    if (broken.has('no-etcd')) {
      s.push({
        id: 'etcd',
        label: 'etcd',
        caption: bi('API-сервер пытается записать объект, но etcd не отвечает. Сохранить Deployment негде, и kubectl получает ошибку.', 'The API server tries to write, but etcd does not answer: kubectl gets an error.'),
        focus: ['api', 'e-etcd'],
        reveal: ['etcd', 'e-etcd'],
        say: { api: bi('API-сервер ждёт ответа etcd и не дожидается.', 'The API server waits for etcd in vain.') },
        states: { api: 'err', 'e-etcd': 'err' },
        metrics: m(),
        broken: { at: 'e-etcd', message: 'Error from server: etcdserver: request timed out', caption: bi('на записи в etcd. Без etcd у кластера нет состояния, поэтому ничего не сохраняется, и любая команда, которая что-то меняет, получает ошибку.', 'at the etcd write: without etcd there is no state, every change fails.') },
      });
      return s;
    }
    writes++;
    s.push({
      id: 'etcd',
      label: 'etcd',
      caption: bi('API-сервер записывает Deployment в etcd. Объект получает уникальный uid и номер ревизии resourceVersion, и с этого момента он существует в кластере.', 'The Deployment is written to etcd and gets a uid and a resourceVersion: now it exists.'),
      focus: ['etcd', 'e-etcd'],
      reveal: ['etcd', 'e-etcd'],
      tokens: [{ edge: 'e-etcd', label: 'Deployment web' }],
      say: { etcd: bi('etcd сохраняет Deployment web и отвечает номером новой ревизии.', 'etcd stores the Deployment and replies with a revision.') },
      values: { etcd: t(bi('ревизия 1042', 'rv 1042')) },
      states: { etcd: 'ok' },
      metrics: m(),
    });
    s.push({
      id: 'created',
      label: bi('ответ', 'created'),
      caption: bi('API-сервер отвечает kubectl, и тот печатает «deployment.apps/web created». На этом работа API-сервера закончена. Он сохранил объект, но ни одного процесса не запустил.', 'kubectl prints “deployment.apps/web created”. The API server’s work is over: it stored the object and started nothing.'),
      focus: ['kubectl', 'e-kubectl'],
      tokens: [{ edge: 'e-kubectl', label: 'deployment.apps/web created', reverse: true }],
      say: { kubectl: bi('kubectl печатает: deployment.apps/web created.', 'kubectl prints: deployment.apps/web created.') },
      states: { api: 'ok' },
      metrics: m(),
    });
    if (p.upto === 'etcd') {
      s.push({
        id: 'who',
        label: bi('и дальше?', 'and then?'),
        caption: bi('Объект лежит в etcd, но в кластере пока не работает ни одного нового процесса. Кто заметит новый Deployment и превратит его в поды, вы увидите, если выберете в «Параметрах» путь до готового пода.', 'The object is in etcd, but no new process runs yet. Choose the full path in “Parameters” to see who turns it into pods.'),
        focus: ['etcd'],
        say: { etcd: bi('Deployment web хранится в etcd и ждёт, что кто-нибудь его исполнит.', 'The Deployment waits in etcd for someone to act on it.') },
        metrics: m(),
      });
      return s;
    }
    if (broken.has('no-cm')) {
      s.push({
        id: 'rs',
        label: 'ReplicaSet',
        caption: bi('Deployment записан, но контроллеры не работают, и событие о новом объекте получить некому. ReplicaSet не появляется, а значит, не появляются и поды.', 'The Deployment is stored, but no controller receives the event: no ReplicaSet, no pods.'),
        focus: ['etcd'],
        reveal: ['cm'],
        say: { etcd: bi('Deployment лежит в etcd, но ни ReplicaSet, ни подов для него никто не создаёт.', 'The Deployment sits in etcd; nobody creates a ReplicaSet or pods.') },
        states: { cm: 'err' },
        metrics: m(),
        broken: { at: 'cm', message: '$ kubectl get deploy web\nNAME   READY   UP-TO-DATE   AVAILABLE   AGE\nweb    0/3     0            0           2m', caption: bi('на контроллерах. Объекты сами себя не исполняют: Deployment есть, а ReplicaSet нет, и в выводе `kubectl get deploy` столбец UP-TO-DATE остаётся нулём.', 'at the controllers: the Deployment exists, no ReplicaSet; UP-TO-DATE stays 0.') },
      });
      return s;
    }
    requests++;
    writes++;
    seconds += 0.1;
    s.push({
      id: 'rs',
      label: 'ReplicaSet',
      caption: bi('Контроллер Deployment получает событие о новом объекте и создаёт ReplicaSet web-5d78b9c7f4. Хвост имени содержит хеш шаблона пода, и по нему контроллер отличает ReplicaSet разных версий.', 'The Deployment controller creates ReplicaSet web-5d78b9c7f4; the suffix is the pod template hash.'),
      focus: ['cm', 'e-cm'],
      reveal: ['cm', 'e-cm'],
      tokens: [{ edge: 'e-cm', label: bi('создать ReplicaSet', 'create ReplicaSet') }],
      say: { cm: bi('Контроллер Deployment создаёт ReplicaSet для нового шаблона пода.', 'The Deployment controller creates a ReplicaSet.') },
      values: { cm: 'rs web-5d78b9c7f4' },
      metrics: m(),
    });
    requests += n;
    writes += n;
    seconds += 0.1;
    s.push({
      id: 'pods',
      label: bi('поды', 'pods'),
      caption: fmtb(bi('Контроллер ReplicaSet видит новый ReplicaSet и создаёт {n}. Пока это только записи в etcd без узла, и ни одного процесса ещё не запущено.', 'The ReplicaSet controller creates {n}: records without a node, no process yet.'), { n: pods }),
      focus: ['cm', 'e-cm'],
      tokens: [{ edge: 'e-cm', label: fmtb(bi('создать {n}', 'create {n}'), { n: num(n, ...PODS) }) }],
      say: { cm: fmtb(bi('Контроллер ReplicaSet создаёт {n} по шаблону.', 'The ReplicaSet controller creates {n}.'), { n: pods }) },
      values: { etcd: t(fmt(bi('ревизия {r}', 'rv {r}'), { r: 1043 + n })) },
      states: { cm: 'ok' },
      metrics: m(),
    });
    if (broken.has('no-sched')) {
      s.push({
        id: 'bind',
        label: bi('узел', 'node'),
        caption: bi('Поды созданы, но узел им выбрать некому, потому что kube-scheduler не работает. Поды остаются в состоянии Pending.', 'The pods exist, but nobody picks a node: they stay Pending.'),
        focus: ['api'],
        reveal: ['sched'],
        say: { api: bi('API-сервер хранит поды без узла, и забрать их некому.', 'The API server holds pods without a node; nobody takes them.') },
        states: { sched: 'err' },
        metrics: m(),
        broken: { at: 'sched', message: `$ kubectl get pods\nNAME                   READY   STATUS    RESTARTS   AGE\nweb-5d78b9c7f4-4mz8q   0/1     Pending   0          5m\n$ kubectl describe pod web-5d78b9c7f4-4mz8q | tail -2\nNode:             <none>\nEvents:           <none>`, caption: bi('на выборе узла. Под в состоянии Pending без единого события означает, что планировщика нет вовсе, ведь событие FailedScheduling, кроме него, писать некому.', 'at scheduling: Pending with no events means there is no scheduler at all.') },
      });
      return s;
    }
    bindings += n;
    requests += n;
    writes += n;
    seconds += 0.1;
    s.push({
      id: 'bind',
      label: bi('узел', 'node'),
      caption: fmtb(bi('Планировщик видит {n} без узла, проверяет узлы, выбирает лучший для каждого пода и записывает выбор. Теперь у каждого пода заполнено поле nodeName, здесь это worker-1.', 'The scheduler picks a node for each of {n} and writes nodeName.'), { n: pods }),
      focus: ['sched', 'e-sched'],
      reveal: ['sched', 'e-sched'],
      tokens: [{ edge: 'e-sched', label: 'nodeName: worker-1' }],
      say: { sched: fmtb(bi('Планировщик выбирает узел для каждого из подов: {n}.', 'The scheduler picks a node for {n}.'), { n: pods }) },
      values: { sched: t(fmt(bi('подов привязано: {n}', 'bound: {n}'), { n })) },
      states: { sched: 'ok' },
      metrics: m(),
    });
    if (broken.has('no-kubelet')) {
      s.push({
        id: 'kubelet',
        label: 'kubelet',
        caption: bi('Под назначен на worker-1, но kubelet там не работает, и увидеть под некому. Узел перестаёт продлевать свою отметку о жизни (Lease).', 'The pod is assigned to worker-1, but no kubelet runs there; the node stops renewing its Lease.'),
        focus: ['api'],
        reveal: ['kubelet'],
        say: { api: bi('API-сервер не получает от worker-1 продлений Lease.', 'No Lease renewals from worker-1.') },
        states: { kubelet: 'err' },
        metrics: m(),
        broken: { at: 'kubelet', message: '$ kubectl get nodes\nNAME       STATUS     ROLES    AGE   VERSION\nworker-1   NotReady   <none>   4d    v1.37.1+k3s1', caption: bi('на узле. Через 50 секунд без продления Lease узел станет NotReady, а ещё через 300 секунд поды с него начнут выселять на другие узлы.', 'on the node: after 50 s without a Lease it is NotReady, 300 s later its pods are evicted.') },
      });
      return s;
    }
    s.push({
      id: 'kubelet',
      label: 'kubelet',
      caption: bi('kubelet на worker-1 следит за подами своего узла и видит новые. С этого момента за запуск этих подов отвечает он.', 'The worker-1 kubelet sees the new pods; it is responsible for them now.'),
      focus: ['kubelet', 'e-kubelet'],
      reveal: ['kubelet', 'e-kubelet'],
      tokens: [{ edge: 'e-kubelet', label: bi('новые поды', 'new pods'), reverse: true }],
      say: { kubelet: bi('kubelet видит поды, назначенные на worker-1, и берётся их запустить.', 'The kubelet sees pods assigned to worker-1.') },
      metrics: m(),
    });
    s.push({
      id: 'sandbox',
      label: bi('песочница', 'sandbox'),
      caption: bi('kubelet по интерфейсу CRI просит containerd создать песочницу пода. Это маленький процесс pause, который держит сетевое пространство имён пода, пока работают его контейнеры.', 'Over CRI the kubelet asks containerd for the pod sandbox: the pause process holding the network namespace.'),
      focus: ['crt', 'e-cri'],
      reveal: ['crt', 'e-cri'],
      tokens: [{ edge: 'e-cri', label: 'RunPodSandbox' }],
      say: { crt: bi('containerd создаёт песочницу пода с процессом pause.', 'containerd creates the sandbox.') },
      metrics: m(),
    });
    if (broken.has('no-cni')) {
      s.push({
        id: 'cni',
        label: 'CNI',
        caption: bi('Среда запуска containerd вызывает плагин сети, чтобы дать песочнице IP-адрес, но плагина на узле нет. Песочница без сети не создаётся, а без песочницы не запустить и контейнер.', 'containerd calls the network plugin, but there is none: no sandbox, no container.'),
        focus: ['crt', 'e-cni'],
        reveal: ['cni', 'e-cni'],
        say: { crt: bi('containerd не находит плагин сети и не может создать песочницу.', 'containerd finds no network plugin.') },
        states: { cni: 'err', 'e-cni': 'err' },
        metrics: m(),
        broken: { at: 'e-cni', message: 'Warning  FailedCreatePodSandBox  kubelet  Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "…": cni plugin not initialized', caption: bi('на создании песочницы. Под надолго застревает в состоянии ContainerCreating, узел показывает NotReady, а в событиях пода стоит FailedCreatePodSandBox.', 'at the sandbox: the pod stays ContainerCreating, the node NotReady, FailedCreatePodSandBox in events.') },
      });
      return s;
    }
    seconds += 0.3;
    s.push({
      id: 'cni',
      label: bi('сеть', 'network'),
      caption: bi('containerd вызывает плагин сети командой ADD. Плагин создаёт пару виртуальных интерфейсов, подключает её к мосту cni0 и выдаёт поду адрес 10.42.1.15 из диапазона адресов worker-1.', 'containerd runs CNI ADD: a veth into cni0, the address 10.42.1.15 from worker-1’s range.'),
      focus: ['cni', 'e-cni'],
      reveal: ['cni', 'e-cni'],
      tokens: [{ edge: 'e-cni', label: 'CNI ADD' }],
      say: { cni: bi('Плагин сети выдаёт поду адрес 10.42.1.15 и подключает его к мосту узла.', 'The plugin gives the pod 10.42.1.15.') },
      values: { cni: 'IP 10.42.1.15' },
      states: { cni: 'ok' },
      metrics: m(),
    });
    seconds += p.cached ? 0.2 : 1.5;
    s.push({
      id: 'start',
      label: p.cached ? bi('запуск', 'start') : bi('образ и запуск', 'pull, start'),
      caption: p.cached
        ? bi('Образ уже лежит на узле, и в событиях пода это видно как «already present on machine». containerd сразу создаёт и запускает контейнер.', 'The image is already there: the container starts at once.')
        : bi('Образа на узле нет, поэтому containerd сначала скачивает trainer/web:1.0 из реестра, на что уходит около полутора секунд, а потом создаёт и запускает контейнер.', 'No image yet: containerd pulls it (about 1.5 s), then starts the container.'),
      focus: ['crt'],
      say: { crt: p.cached ? bi('containerd запускает контейнер из образа, который уже лежит на узле.', 'containerd starts the container from the cached image.') : bi('containerd скачивает образ trainer/web:1.0 и запускает контейнер.', 'containerd pulls the image and starts the container.') },
      values: { crt: p.cached ? t(bi('образ уже был', 'image cached')) : t(bi('скачано 4,7 МБ', 'pulled 4.7 MB')) },
      states: { crt: 'ok' },
      metrics: m(),
    });
    requests += n;
    writes += n;
    seconds += 1;
    s.push({
      id: 'ready',
      label: bi('готов', 'ready'),
      caption: bi('Приложение ответило на проверку готовности, и kubelet записывает в status пода условие Ready=True. Записывает он, как и все остальные, через API-сервер.', 'The readiness check passed; the kubelet writes Ready=True through the API server, like everyone else.'),
      focus: ['kubelet', 'e-kubelet'],
      tokens: [{ edge: 'e-kubelet', label: 'Ready=True' }],
      say: { kubelet: bi('kubelet сообщает API-серверу, что под готов отвечать.', 'The kubelet reports the pod ready.') },
      states: { kubelet: 'ok' },
      metrics: m(),
    });
    if (broken.has('no-proxy')) {
      s.push({
        id: 'svc',
        label: 'Service',
        caption: bi('Под готов, и его адрес попал в список готовых подов сервиса web, но kube-proxy не работает и правил на узлах не пишет. Поэтому запрос на адрес Service никуда не уходит.', 'The pod is ready and listed, but kube-proxy writes no rules: a request to the Service address goes nowhere.'),
        focus: ['kubectl'],
        reveal: ['proxy'],
        say: { kubectl: bi('Запрос curl к Service web не получает ответа.', 'A curl to Service web gets no answer.') },
        states: { proxy: 'err' },
        metrics: m(),
        broken: { at: 'proxy', message: "$ kubectl exec client -- curl http://web\ncurl: (28) Failed to connect to web port 80 after 130412 ms: Couldn't connect to server", caption: bi('на правилах Service. По IP-адресу пода запрос проходит, а по адресу Service нет, потому что этот адрес существует только в правилах, которые пишет kube-proxy.', 'at the Service rules: the pod IP works, the Service address does not, it exists only in kube-proxy’s rules.') },
      });
      return s;
    }
    requests++;
    writes++;
    s.push({
      id: 'svc',
      label: 'Service',
      caption: bi('Адрес готового пода попадает в список готовых подов сервиса web. kube-proxy получает этот адрес и дописывает на каждом узле правило, по которому пакеты к адресу Service отправляются на этот под.', 'The pod’s address enters the list of ready pods of Service web. kube-proxy gets the address and adds a rule on every node that sends packets for the Service address to this pod.'),
      focus: ['proxy', 'e-proxy'],
      reveal: ['proxy', 'e-proxy'],
      tokens: [{ edge: 'e-proxy', label: bi('адрес пода', 'pod address'), reverse: true }],
      say: { proxy: bi('kube-proxy дописывает правило, по которому пакеты к Service web отправляются на новый под.', 'kube-proxy adds a rule for Service web.') },
      states: { proxy: 'ok' },
      metrics: m(),
    });
    s.push({
      id: 'dns',
      label: 'DNS',
      caption: bi('CoreDNS уже знает имя web и отвечает на него адресом Service. Путь пройден, и теперь другие поды могут обращаться к приложению по имени http://web.', 'CoreDNS answers the name web with the Service address: other pods can reach http://web.'),
      focus: ['dns', 'e-dns'],
      reveal: ['dns', 'e-dns'],
      tokens: [{ edge: 'e-dns', label: 'web', reverse: true }],
      say: { dns: bi('CoreDNS отвечает на имя web адресом Service.', 'CoreDNS answers web with the Service address.') },
      states: { dns: 'ok' },
      metrics: m(),
    });
    return s;
  },
  explainDelta(prev, next, change, a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Компонент снова работает, и путь опять доходит до готового пода.', 'The component is back; the path reaches a ready pod again.');
      const at = next.find((x) => x.broken)?.broken?.at ?? '';
      return fmt(bi('Путь оборвался на элементе «{at}», потому что каждый следующий шаг ждёт результата предыдущего, и обходного пути нет.', 'The path stops at “{at}”: every step waits for the previous one.'), { at });
    }
    switch (change.id) {
      case 'replicas':
        return fmt(bi('Подов теперь {b} вместо {a}. Создание пода, выбор узла и запись статуса повторяются для каждого пода, поэтому запросов к API-серверу стало {r} вместо {r0}.', '{a} → {b} replicas: {r} API requests instead of {r0}.'), { a: a.replicas as number, b: b.replicas as number, r: metric(next, 'requests'), r0: metric(prev, 'requests') });
      case 'cached':
        return b.cached ? bi('Образ уже лежит на узле, поэтому шаг загрузки пропущен, и под готов примерно на 1,3 секунды раньше.', 'The image is cached: no pull, ready 1.3 s sooner.') : bi('Образа на узле нет, и containerd сначала его скачивает.', 'No image: containerd pulls it first.');
      case 'rbac':
        return b.rbac ? bi('Запрос отклонён на проверке прав и дальше API-сервера не ушёл, а etcd никто не трогал.', 'Refused at authorization; etcd untouched.') : bi('Право есть, и запрос проходит проверку.', 'The right is there; the request passes.');
      case 'quota':
        return b.quota ? bi('Квота исчерпана, и API-сервер отказывает на последней проверке перед записью.', 'The quota refuses at the last check.') : bi('Квота свободна, и запись проходит.', 'The quota has room.');
      case 'upto':
        return b.upto === 'etcd' ? bi('Путь показан до записи в etcd: на этом работа API-сервера заканчивается.', 'Shown up to the etcd write.') : bi('Путь показан целиком, и после etcd в нём работают контроллеры, планировщик и kubelet.', 'The whole path is shown.');
    }
    return anyBroken(next) ? bi('Путь пересчитан и обрывается на поломке.', 'The path stops at the break.') : bi('Путь пересчитан.', 'The path is recomputed.');
  },
});
