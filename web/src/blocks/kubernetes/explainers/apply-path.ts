// Э1 (05 §6.4): the path of `kubectl apply` through every component, from
// the HTTP request to a Ready pod behind a Service. Knobs: replicas, image
// already on the node, RBAC forbids, quota exhausted, stop at etcd (the
// first lesson stops there). Breaks: any component of the constructor —
// the path stops on its step with the real message.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, anyBroken, edge, metric, node } from './kit';

type P = { replicas: number; cached: boolean; rbac: boolean; quota: boolean; upto: string };

export const applyPathModel = defineModel<P>({
  id: 'k8s.apply-path',
  block: 'k8s-1',
  title: bi('Путь kubectl apply через все компоненты', 'The path of kubectl apply through every component'),
  summary: bi('Один Deployment, четырнадцать шагов: от HTTP-запроса до готового пода за Service. Каждый компонент делает одно дело и пишет результат в API-сервер.', 'One Deployment, fourteen steps: from an HTTP request to a Ready pod behind a Service. Every component does one job and writes its result to the API server.'),
  concepts: ['k8s.control-plane'],
  diagram: {
    width: 960,
    height: 540,
    nodes: [
      node('kubectl', 'kubectl', 'user', 'box', 24, 40, 150, 56, bi('Клиент: читает web.yaml, определяет ресурс по apiVersion и kind, отправляет запрос.', 'The client: reads web.yaml, finds the resource by apiVersion and kind, sends the request.'), bi('Вы, со своего компьютера; адрес и ключи — из kubeconfig.', 'You, from your machine; address and keys come from kubeconfig.'), 'kubectl apply -f web.yaml -v=6', D.components),
      node('api', 'kube-apiserver', 'cp', 'hex', 360, 40, 220, 56, bi('Единственная дверь кластера: аутентификация, авторизация, значения по умолчанию, проверка, запись в etcd, раздача событий watch.', 'The only door of the cluster: authentication, authorization, defaults, validation, the write to etcd, watch events for everyone.'), bi('Статический под на узле control plane.', 'A static pod on the control-plane node.'), 'kubectl get --raw /readyz?verbose', D.apiserver),
      node('etcd', 'etcd', 'store', 'box', 770, 40, 160, 56, bi('Хранилище ключей: здесь объект живёт под /registry/deployments/default/web.', 'The key store: the object lives here under /registry/deployments/default/web.'), bi('Статический под на узле control plane.', 'A static pod on the control-plane node.'), 'cluster etcd /registry/deployments', D.components),
      node('cm', 'controller-manager', 'cp', 'hex', 250, 170, 200, 56, bi('Контроллеры Deployment и ReplicaSet: видят новый объект и создают следующий — ReplicaSet, затем поды.', 'The Deployment and ReplicaSet controllers: they see the new object and create the next one — a ReplicaSet, then pods.'), bi('Статический под на узле control plane.', 'A static pod on the control-plane node.'), 'kubectl get rs', D.controller),
      node('sched', 'kube-scheduler', 'cp', 'hex', 500, 170, 200, 56, bi('Выбирает узел для каждого пода без nodeName и записывает выбор — Binding.', 'Picks a node for every pod without nodeName and records the choice — a Binding.'), bi('Статический под на узле control plane.', 'A static pod on the control-plane node.'), 'kubectl get pods -o wide', D.scheduler),
      node('kubelet', 'kubelet', 'node', 'box', 60, 330, 170, 52, bi('Агент worker-1: видит под, назначенный своему узлу, и доводит его до запущенного процесса.', 'The worker-1 agent: sees the pod assigned to its node and turns it into a running process.'), bi('Служба systemd на узле.', 'A systemd service on the node.'), 'kubectl describe pod <name>', D.components),
      node('crt', 'containerd', 'process', 'box', 280, 330, 170, 52, bi('Рантайм: песочница пода (pause), образ, контейнер.', 'The runtime: the pod sandbox (pause), the image, the container.'), bi('Служба systemd на узле.', 'A systemd service on the node.'), 'crictl pods   # on the node', D.cri),
      node('cni', 'CNI (flannel)', 'l3', 'box', 500, 330, 170, 52, bi('Даёт песочнице сетевой интерфейс и IP из podCIDR узла.', 'Gives the sandbox a network interface and an IP from the node podCIDR.'), bi('Бинарник в /opt/cni/bin, его вызывает рантайм.', 'A binary in /opt/cni/bin, called by the runtime.'), 'cluster ip addr worker-1', D.cni),
      node('proxy', 'kube-proxy', 'l4', 'box', 60, 440, 170, 52, bi('Пишет правила DNAT для Service на каждом узле.', 'Writes the DNAT rules for Services on every node.'), bi('DaemonSet или часть k3s.', 'A DaemonSet or part of k3s.'), 'cluster iptables worker-1', D.vip),
      node('dns', 'CoreDNS', 'l7', 'box', 280, 440, 170, 52, bi('Отвечает на имя web.default.svc.cluster.local адресом Service.', 'Answers web.default.svc.cluster.local with the Service address.'), bi('Deployment в kube-system.', 'A Deployment in kube-system.'), 'kubectl -n kube-system get pods -l k8s-app=kube-dns', D.dns),
    ],
    edges: [
      edge('e-kubectl', 'kubectl', 'api', 'POST …/deployments', bi('HTTPS-запрос к API: тело — ваш YAML, превращённый в JSON.', 'An HTTPS request to the API: the body is your YAML turned into JSON.'), bi('kubectl', 'kubectl'), { see: 'kubectl apply -f web.yaml -v=6' }),
      edge('e-etcd', 'api', 'etcd', 'put /registry/…', bi('Запись объекта; ответ etcd — новая ревизия, она станет resourceVersion.', 'The write of the object; the etcd reply is a new revision that becomes the resourceVersion.'), bi('kube-apiserver', 'kube-apiserver'), { see: 'cluster etcd' }),
      edge('e-cm', 'cm', 'api', bi('watch · создают rs и поды', 'watch · create rs, pods'), bi('Контроллеры получают события watch и создают объекты тем же API.', 'The controllers get watch events and create objects through the same API.'), bi('kube-controller-manager', 'kube-controller-manager')),
      edge('e-sched', 'sched', 'api', 'watch pods · POST binding', bi('Планировщик смотрит поды без узла и пишет подресурс binding.', 'The scheduler watches pods without a node and writes the binding subresource.'), bi('kube-scheduler', 'kube-scheduler')),
      edge('e-kubelet', 'kubelet', 'api', 'watch my pods · PATCH status', bi('kubelet смотрит поды своего узла и пишет их статус.', 'The kubelet watches the pods of its node and writes their status.'), bi('kubelet', 'kubelet'), { via: [[145, 270], [470, 270]], labelAt: 0.5 }),
      edge('e-cri', 'kubelet', 'crt', 'CRI RunPodSandbox', bi('gRPC-вызов: создать песочницу пода, затем контейнер.', 'A gRPC call: create the pod sandbox, then the container.'), bi('kubelet', 'kubelet'), { doc: D.cri }),
      edge('e-cni', 'crt', 'cni', 'CNI ADD', bi('Рантайм запускает плагин с командой ADD и параметрами песочницы.', 'The runtime runs the plugin with the ADD command and the sandbox parameters.'), bi('containerd', 'containerd'), { doc: D.cni }),
      edge('e-proxy', 'proxy', 'api', 'watch Services, EndpointSlices', bi('kube-proxy получает адреса готовых подов и переписывает правила.', 'kube-proxy gets the addresses of ready pods and rewrites its rules.'), bi('kube-proxy', 'kube-proxy'), { via: [[145, 515], [940, 515], [940, 68]], labelAt: 0.38 }),
      edge('e-dns', 'dns', 'api', 'watch Services', bi('CoreDNS знает имена всех Service.', 'CoreDNS knows the names of all Services.'), bi('CoreDNS', 'CoreDNS'), { via: [[365, 505], [720, 505], [720, 96]], labelAt: 0.45 }),
    ],
    groups: [
      { id: 'g-cp', label: 'control plane', around: ['api', 'etcd', 'cm', 'sched'], family: 'cp', dash: 'dash', pad: 14, card: { what: bi('Компоненты, которые управляют кластером. Ни один из них не запускает ваши контейнеры.', 'The components that manage the cluster. None of them runs your containers.'), who: bi('Установщик кластера (k3s, kubeadm).', 'The cluster installer (k3s, kubeadm).') } },
      { id: 'g-node', label: 'worker-1', around: ['kubelet', 'crt', 'cni', 'proxy', 'dns'], family: 'node', dash: 'solid', pad: 14, card: { what: bi('Узел: машина, где работают поды. Таких узлов в кластере много.', 'A node: a machine where pods run. A cluster has many of them.'), who: bi('Вы или облако; в кластер её добавляет kubelet.', 'You or the cloud; the kubelet adds it to the cluster.') } },
    ],
  },
  params: [
    {
      id: 'replicas',
      label: bi('replicas', 'replicas'),
      kind: 'range',
      min: 1,
      max: 5,
      step: 1,
      default: 3,
      near: 'cm',
      predict: {
        prompt: bi('Реплик стало больше. Сколько раз планировщик запишет Binding?', 'There are more replicas now. How many times will the scheduler write a Binding?'),
        options: [
          { id: 'one', text: bi('Один раз на весь Deployment', 'Once for the whole Deployment') },
          { id: 'each', text: bi('По одному разу на каждый под', 'Once for every pod') },
        ],
        resolve: (_p, n) => (metric(n, 'bindings') > 1 ? 'each' : 'one'),
      },
    },
    { id: 'cached', label: bi('Образ уже на узле', 'The image is already on the node'), kind: 'toggle', default: false, near: 'crt' },
    {
      id: 'rbac',
      label: bi('RBAC запрещает создавать Deployment', 'RBAC forbids creating Deployments'),
      kind: 'toggle',
      default: false,
      near: 'api',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('Права нет. Где остановится запрос?', 'There is no permission. Where does the request stop?'),
        options: [
          { id: 'api', text: bi('На API-сервере, до записи в etcd', 'At the API server, before anything is written to etcd') },
          { id: 'kubelet', text: bi('На узле: kubelet откажется запускать', 'On the node: the kubelet refuses to start it') },
        ],
        resolve: (_p, n) => (n.find((s) => s.broken)?.broken?.at === 'api' ? 'api' : 'kubelet'),
      },
    },
    { id: 'quota', label: bi('Квота namespace исчерпана', 'The namespace quota is exhausted'), kind: 'toggle', default: false, near: 'api', levels: ['intermediate', 'experienced'] },
    {
      id: 'upto',
      label: bi('Показать путь', 'Show the path'),
      kind: 'choice',
      default: 'all',
      options: [
        { id: 'etcd', label: bi('до записи в etcd', 'up to the etcd write') },
        { id: 'all', label: bi('целиком, до готового пода', 'all the way to a Ready pod') },
      ],
    },
  ],
  breaks: [
    { id: 'no-etcd', label: bi('Убрать etcd', 'Remove etcd'), remove: ['etcd', 'e-etcd'], boundary: 'storage', predict: { prompt: bi('etcd нет. Что ответит kubectl?', 'There is no etcd. What does kubectl get back?'), options: [{ id: 'err', text: bi('Ошибку: сохранить объект негде', 'An error: there is nowhere to store the object') }, { id: 'ok', text: bi('«created», а сохранится потом', '"created", it is stored later') }], resolve: (_p, n) => (n.some((s) => s.broken?.at === 'e-etcd') ? 'err' : 'ok') } },
    { id: 'no-cm', label: bi('Убрать controller-manager', 'Remove controller-manager'), remove: ['cm', 'e-cm'], boundary: 'process', predict: { prompt: bi('Контроллеров нет. Что будет после «deployment.apps/web created»?', 'There are no controllers. What happens after "deployment.apps/web created"?'), options: [{ id: 'nothing', text: bi('Ничего: ни ReplicaSet, ни подов', 'Nothing: no ReplicaSet, no pods') }, { id: 'pods', text: bi('Поды создаст API-сервер сам', 'The API server creates the pods itself') }], resolve: (_p, n) => (n.some((s) => s.broken?.at === 'cm') ? 'nothing' : 'pods') } },
    { id: 'no-sched', label: bi('Убрать kube-scheduler', 'Remove kube-scheduler'), remove: ['sched', 'e-sched'], boundary: 'process', predict: { prompt: bi('Планировщика нет. Что с подами?', 'There is no scheduler. What happens to the pods?'), options: [{ id: 'pending', text: bi('Навсегда Pending, событий нет', 'Pending forever, no events') }, { id: 'self', text: bi('kubelet сам заберёт под на свой узел', 'A kubelet takes the pod onto its node by itself') }], resolve: (_p, n) => (n.some((s) => s.broken?.at === 'sched') ? 'pending' : 'self') } },
    { id: 'no-kubelet', label: bi('Остановить kubelet', 'Stop the kubelet'), remove: ['kubelet', 'e-kubelet', 'e-cri'], boundary: 'process', predict: { prompt: bi('kubelet остановлен. Назначит ли планировщик под на этот узел?', 'The kubelet is stopped. Will the scheduler still assign a pod to this node?'), options: [{ id: 'yes', text: bi('Да, пока узел не помечен как недоступный — и под не запустится', 'Yes, until the node is marked unreachable — and the pod will not start') }, { id: 'no', text: bi('Нет, планировщик сразу знает', 'No, the scheduler knows at once') }], resolve: () => 'yes' } },
    { id: 'no-cni', label: bi('Убрать CNI', 'Remove CNI'), remove: ['cni', 'e-cni'], boundary: 'network', layer: 'L3', predict: { prompt: bi('CNI нет. На каком шаге всё встанет?', 'There is no CNI. At which step does everything stop?'), options: [{ id: 'sandbox', text: bi('При создании песочницы пода', 'When the pod sandbox is created') }, { id: 'pull', text: bi('При загрузке образа', 'When the image is pulled') }], resolve: (_p, n) => (n.some((s) => s.broken?.at === 'e-cni') ? 'sandbox' : 'pull') } },
    { id: 'no-proxy', label: bi('Убрать kube-proxy', 'Remove kube-proxy'), remove: ['proxy', 'e-proxy'], boundary: 'network', layer: 'L4', predict: { prompt: bi('kube-proxy нет. Под будет Ready?', 'There is no kube-proxy. Will the pod be Ready?'), options: [{ id: 'ready', text: bi('Да, но запрос на адрес Service не дойдёт', 'Yes, but a request to the Service address will not arrive') }, { id: 'not', text: bi('Нет, под не запустится', 'No, the pod will not start') }], resolve: (_p, n) => (n.some((s) => s.broken?.at === 'proxy') ? 'ready' : 'not') } },
  ],
  metrics: [
    { id: 'requests', label: bi('запросов к API-серверу', 'requests to the API server') },
    { id: 'writes', label: bi('записей в etcd', 'writes to etcd') },
    { id: 'bindings', label: bi('Binding', 'Bindings') },
    { id: 'seconds', label: bi('секунд', 'seconds'), unit: 's' },
  ],
  run(p, broken): Step[] {
    const n = p.replicas;
    const s: Step[] = [];
    let requests = 0;
    let writes = 0;
    let bindings = 0;
    let seconds = 0;
    const m = () => ({ requests, writes, bindings, seconds: Math.round(seconds * 10) / 10 });
    requests++;
    s.push({ id: 'post', label: 'POST', caption: bi('kubectl читает web.yaml, по apiVersion apps/v1 и kind Deployment находит ресурс и отправляет POST /apis/apps/v1/namespaces/default/deployments.', 'kubectl reads web.yaml, finds the resource from apiVersion apps/v1 and kind Deployment and sends POST /apis/apps/v1/namespaces/default/deployments.'), focus: ['kubectl', 'e-kubectl'], tokens: [{ edge: 'e-kubectl', label: 'web.yaml' }], states: { kubectl: 'on' }, metrics: m() });
    if (p.rbac) {
      s.push({ id: 'authz', label: 'authz', caption: bi('API-сервер узнал вас по сертификату, но RBAC не даёт права create на deployments: запрос отклонён до любой записи.', 'The API server knows you by your certificate, but RBAC gives no create right on deployments: the request is rejected before anything is written.'), focus: ['api'], states: { api: 'err' }, metrics: m(), broken: { at: 'api', message: 'Error from server (Forbidden): error when creating "web.yaml": deployments.apps is forbidden: User "jane" cannot create resource "deployments" in API group "apps" in the namespace "default"', caption: bi('отказ авторизации: объекта нет нигде, контроллеры его не увидят.', 'an authorization refusal: the object exists nowhere, controllers never see it.') } });
      return s;
    }
    s.push({ id: 'authn', label: 'authn/authz', caption: bi('Аутентификация (кто вы: сертификат из kubeconfig) и авторизация (можно ли: правило RBAC) пройдены.', 'Authentication (who you are: the certificate from kubeconfig) and authorization (may you: an RBAC rule) passed.'), focus: ['api'], states: { api: 'on' }, metrics: m() });
    s.push({ id: 'defaults', label: 'defaults', caption: bi('Mutating admission дописывает значения по умолчанию: strategy RollingUpdate 25%/25%, revisionHistoryLimit 10, progressDeadlineSeconds 600.', 'Mutating admission fills in defaults: strategy RollingUpdate 25%/25%, revisionHistoryLimit 10, progressDeadlineSeconds 600.'), focus: ['api'], values: { api: '+ defaults' }, metrics: m() });
    if (p.quota) {
      s.push({ id: 'quota', label: 'quota', caption: bi('Проверка схемы прошла, но ResourceQuota namespace уже исчерпана — validating admission отказывает.', 'The schema check passed, but the namespace ResourceQuota is used up — validating admission refuses.'), focus: ['api'], states: { api: 'err' }, metrics: m(), broken: { at: 'api', message: 'Error from server (Forbidden): error when creating "web.yaml": deployments.apps "web" is forbidden: exceeded quota: objects, requested: count/deployments.apps=1, used: count/deployments.apps=5, limited: count/deployments.apps=5', caption: bi('квота — последняя проверка перед записью; в etcd ничего не попало.', 'the quota is the last check before the write; nothing reached etcd.') } });
      return s;
    }
    s.push({ id: 'validate', label: 'validate', caption: bi('Проверка по схеме: selector совпадает с метками шаблона, у контейнера есть image. Квоты в порядке.', 'Schema validation: the selector matches the template labels, the container has an image. Quotas are fine.'), focus: ['api'], metrics: m() });
    if (broken.has('no-etcd')) {
      s.push({ id: 'etcd', label: 'etcd', caption: bi('API-серверу некуда записать объект.', 'The API server has nowhere to write the object.'), focus: ['e-etcd', 'api'], states: { api: 'err', 'e-etcd': 'err' }, metrics: m(), broken: { at: 'e-etcd', message: 'Error from server: etcdserver: request timed out', caption: bi('без etcd нет состояния кластера: ничего не сохраняется, kubectl получает ошибку.', 'without etcd there is no cluster state: nothing is stored, kubectl gets an error.') } });
      return s;
    }
    writes++;
    s.push({ id: 'etcd', label: 'etcd', caption: bi('Запись в etcd: объект получил uid и resourceVersion. kubectl печатает «deployment.apps/web created». Больше API-сервер ничего не делает.', 'The write to etcd: the object got a uid and a resourceVersion. kubectl prints "deployment.apps/web created". The API server does nothing more.'), focus: ['e-etcd', 'etcd'], tokens: [{ edge: 'e-etcd', label: '/registry/deployments/default/web' }], values: { etcd: 'rv 1042' }, states: { etcd: 'ok' }, metrics: m() });
    if (p.upto === 'etcd') {
      s.push({ id: 'who', label: '?', caption: bi('Объект лежит в etcd, но ни одного процесса ещё нет. Кто его заметит? Это следующий урок.', 'The object is in etcd, but there is not a single process yet. Who will notice it? That is the next lesson.'), focus: ['etcd'], metrics: m() });
      return s;
    }
    if (broken.has('no-cm')) {
      s.push({ id: 'rs', label: 'ReplicaSet', caption: bi('Событие watch о новом Deployment некому получить.', 'Nobody receives the watch event about the new Deployment.'), focus: ['cm'], states: { cm: 'off' }, metrics: m(), broken: { at: 'cm', message: '$ kubectl get deploy web\nNAME   READY   UP-TO-DATE   AVAILABLE   AGE\nweb    0/3     0            0           2m', caption: bi('Deployment есть, ReplicaSet нет: объекты сами себя не исполняют.', 'The Deployment exists, the ReplicaSet does not: objects do not execute themselves.') } });
      return s;
    }
    requests++;
    writes++;
    seconds += 0.1;
    s.push({ id: 'rs', label: 'ReplicaSet', caption: bi('Контроллер Deployment получил событие watch и создал ReplicaSet web-5d78b9c7f4 (хеш шаблона пода в имени).', 'The Deployment controller got the watch event and created ReplicaSet web-5d78b9c7f4 (the pod template hash in the name).'), focus: ['cm', 'e-cm'], tokens: [{ edge: 'e-cm', label: 'create rs' }], values: { cm: 'rs web-5d78b9c7f4' }, states: { cm: 'on' }, metrics: m() });
    requests += n;
    writes += n;
    seconds += 0.1;
    s.push({ id: 'pods', label: 'pods', caption: fmt(bi('Контроллер ReplicaSet создал {n} Pod без nodeName — это просто записи в etcd, процессов ещё нет.', 'The ReplicaSet controller created {n} Pods without nodeName — just records in etcd, no processes yet.'), { n }), focus: ['cm', 'e-cm', 'etcd'], tokens: [{ edge: 'e-cm', label: `${n} × create pod` }], values: { etcd: `rv ${1043 + n}` }, metrics: m() });
    if (broken.has('no-sched')) {
      s.push({ id: 'bind', label: 'bind', caption: bi('Поды ждут планировщика.', 'The pods wait for a scheduler.'), focus: ['sched'], states: { sched: 'off' }, metrics: m(), broken: { at: 'sched', message: `$ kubectl get pods\nNAME                   READY   STATUS    RESTARTS   AGE\nweb-5d78b9c7f4-4mz8q   0/1     Pending   0          5m\n$ kubectl describe pod web-5d78b9c7f4-4mz8q | tail -2\nNode:             <none>\nEvents:           <none>`, caption: bi('Pending без единого события — признак, что планировщика нет вовсе (FailedScheduling писать некому).', 'Pending without a single event is the sign that there is no scheduler at all (nobody writes FailedScheduling).') } });
      return s;
    }
    bindings += n;
    requests += n;
    writes += n;
    seconds += 0.1;
    s.push({ id: 'bind', label: 'bind', caption: fmt(bi('Планировщик отфильтровал и оценил узлы и записал {n} Binding: у каждого пода теперь есть nodeName.', 'The scheduler filtered and scored the nodes and wrote {n} Bindings: every pod now has a nodeName.'), { n }), focus: ['sched', 'e-sched'], tokens: [{ edge: 'e-sched', label: 'binding' }], values: { sched: `${n} × bind` }, states: { sched: 'on' }, metrics: m() });
    if (broken.has('no-kubelet')) {
      s.push({ id: 'kubelet', label: 'kubelet', caption: bi('Под назначен на worker-1, но kubelet там не работает — некому его увидеть.', 'The pod is assigned to worker-1, but no kubelet runs there — nobody sees it.'), focus: ['kubelet'], states: { kubelet: 'off' }, metrics: m(), broken: { at: 'kubelet', message: '$ kubectl get nodes\nNAME       STATUS     ROLES    AGE   VERSION\nworker-1   NotReady   <none>   4d    v1.37.1+k3s1', caption: bi('через 50 с без продления Lease узел станет Unknown, а ещё через 300 с поды с него выселят.', 'after 50 s without a Lease renewal the node becomes Unknown, and 300 s later its pods are evicted.') } });
      return s;
    }
    s.push({ id: 'kubelet', label: 'kubelet', caption: bi('kubelet worker-1 смотрит поды своего узла и видит новый: теперь отвечает за него он.', 'The worker-1 kubelet watches the pods of its node and sees the new one: it is responsible for it now.'), focus: ['kubelet', 'e-kubelet'], tokens: [{ edge: 'e-kubelet', label: 'watch', reverse: true }], states: { kubelet: 'on' }, metrics: m() });
    s.push({ id: 'sandbox', label: 'sandbox', caption: bi('kubelet по CRI просит containerd создать песочницу пода: процесс pause держит сетевое пространство имён.', 'Over CRI the kubelet asks containerd to create the pod sandbox: the pause process holds the network namespace.'), focus: ['e-cri', 'crt'], tokens: [{ edge: 'e-cri', label: 'RunPodSandbox' }], states: { crt: 'on' }, metrics: m() });
    if (broken.has('no-cni')) {
      s.push({ id: 'cni', label: 'CNI', caption: bi('Рантайм вызывает плагин CNI, а его нет.', 'The runtime calls the CNI plugin, and there is none.'), focus: ['e-cni', 'cni'], states: { cni: 'off', 'e-cni': 'err' }, metrics: m(), broken: { at: 'e-cni', message: 'Warning  FailedCreatePodSandBox  kubelet  Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "…": cni plugin not initialized', caption: bi('без сети нет песочницы, без песочницы — контейнера: под в ContainerCreating, узел NotReady.', 'no network means no sandbox, and no sandbox means no container: the pod stays ContainerCreating, the node is NotReady.') } });
      return s;
    }
    seconds += 0.3;
    s.push({ id: 'cni', label: 'CNI ADD', caption: bi('containerd вызывает CNI ADD: veth в мост cni0, адрес 10.42.1.15 из podCIDR worker-1, маршрут по умолчанию через 10.42.1.1.', 'containerd calls CNI ADD: a veth into the cni0 bridge, the address 10.42.1.15 from the worker-1 podCIDR, a default route via 10.42.1.1.'), focus: ['e-cni', 'cni'], tokens: [{ edge: 'e-cni', label: 'ADD' }], values: { cni: 'IP 10.42.1.15' }, states: { cni: 'on' }, metrics: m() });
    seconds += p.cached ? 0.2 : 1.5;
    s.push({ id: 'start', label: p.cached ? bi('запуск', 'start') : bi('загрузка, запуск', 'pull, start'), caption: p.cached ? bi('Образ уже на узле («already present on machine»): контейнер создан и запущен сразу.', 'The image is already on the node ("already present on machine"): the container is created and started at once.') : bi('Образа на узле нет: containerd тянет trainer/web:1.0 из реестра (1,5 с), затем создаёт и запускает контейнер.', 'The image is not on the node: containerd pulls trainer/web:1.0 from the registry (1.5 s), then creates and starts the container.'), focus: ['crt'], values: { crt: p.cached ? t(bi('из кеша', 'cached')) : t(bi('скачано 4.7 MB', 'pulled 4.7 MB')) }, metrics: m() });
    requests += n;
    writes += n;
    seconds += 1;
    s.push({ id: 'ready', label: 'Ready', caption: bi('Проба готовности прошла: kubelet пишет в status условие Ready=True — через API-сервер, как и все.', 'The readiness probe passed: the kubelet writes the Ready=True condition into status — through the API server, like everyone else.'), focus: ['e-kubelet', 'kubelet'], tokens: [{ edge: 'e-kubelet', label: 'PATCH status' }], states: { kubelet: 'ok' }, metrics: m() });
    if (broken.has('no-proxy')) {
      s.push({ id: 'svc', label: 'Service', caption: bi('Под Ready и есть в EndpointSlice, но правил на узлах никто не пишет.', 'The pod is Ready and in the EndpointSlice, but nobody writes rules on the nodes.'), focus: ['proxy'], states: { proxy: 'off' }, metrics: m(), broken: { at: 'proxy', message: '$ kubectl exec client -- curl http://web\ncurl: (28) Failed to connect to web port 80 after 130412 ms: Couldn\'t connect to server', caption: bi('по IP пода запрос проходит, по ClusterIP — нет: этот адрес существует только в правилах kube-proxy.', 'a request to the pod IP works, to the ClusterIP it does not: that address exists only in kube-proxy rules.') } });
      return s;
    }
    requests++;
    writes++;
    s.push({ id: 'svc', label: 'Service', caption: bi('Контроллер EndpointSlice добавил адрес пода; kube-proxy на каждом узле дописал правило DNAT; CoreDNS уже отвечает на имя web.', 'The EndpointSlice controller added the pod address; kube-proxy on every node added a DNAT rule; CoreDNS already answers the name web.'), focus: ['proxy', 'e-proxy', 'dns'], tokens: [{ edge: 'e-proxy', label: 'EndpointSlice', reverse: true }], states: { proxy: 'ok', dns: 'ok' }, metrics: m() });
    return s;
  },
  explainDelta(prev, next, change, a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Компонент вернули: путь снова доходит до готового пода.', 'The component is back: the path reaches a Ready pod again.');
      const at = next.find((x) => x.broken)?.broken?.at ?? '';
      return fmt(bi('Путь оборвался на «{at}»: каждый следующий шаг ждёт результата предыдущего, обходного пути нет.', 'The path stops at "{at}": every next step waits for the result of the previous one, there is no way around.'), { at });
    }
    switch (change.id) {
      case 'replicas':
        return fmt(bi('{a} → {b} реплик: создание пода, Binding и запись статуса повторяются для каждого — {r} запросов к API вместо {r0}.', '{a} → {b} replicas: creating a pod, the Binding and the status write repeat for each — {r} API requests instead of {r0}.'), { a: a.replicas as number, b: b.replicas as number, r: metric(next, 'requests'), r0: metric(prev, 'requests') });
      case 'cached':
        return b.cached ? bi('Образ в кеше узла: шаг загрузки пропущен, под готов на 1,3 с раньше.', 'The image is in the node cache: the pull step is skipped, the pod is ready 1.3 s sooner.') : bi('Образа нет на узле: containerd сначала его скачивает.', 'The image is not on the node: containerd downloads it first.');
      case 'rbac':
        return b.rbac ? bi('Запрос отклонён на авторизации: дальше API-сервера он не ушёл, etcd не тронут.', 'The request is refused at authorization: it never got past the API server, etcd is untouched.') : bi('Право есть: запрос проходит авторизацию.', 'The permission is there: the request passes authorization.');
      case 'quota':
        return b.quota ? bi('Квота исчерпана: validating admission отказывает — последняя проверка перед записью.', 'The quota is used up: validating admission refuses — the last check before the write.') : bi('Квота свободна: запись проходит.', 'The quota has room: the write goes through.');
      case 'upto':
        return b.upto === 'etcd' ? bi('Путь показан до записи в etcd: на этом работа API-сервера заканчивается.', 'The path is shown up to the etcd write: this is where the API server’s work ends.') : bi('Путь показан целиком: от etcd дальше работают контроллеры, планировщик и kubelet.', 'The whole path is shown: after etcd the controllers, the scheduler and the kubelet take over.');
    }
    return anyBroken(next) ? bi('Путь пересчитан и обрывается на поломке.', 'The path is recomputed and stops at the break.') : bi('Путь пересчитан.', 'The path is recomputed.');
  },
});
