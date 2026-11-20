// The last lesson of stage 1: what a platform team installs on top of
// Kubernetes (traffic in, certificates, storage, metrics, GitOps,
// observability), layer by layer, with the constructor that switches each
// layer and component off and shows what stops working.

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem, SourceLink } from '../../../core/types';
import { R, S, src } from '../sources';

const L = (title: string, url: string): SourceLink => ({ title, url });
const SRC = {
  pv: L('Persistent Volumes', 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/'),
  sc: L('Storage Classes', 'https://kubernetes.io/docs/concepts/storage/storage-classes/'),
  hpa: L('Horizontal Pod Autoscaling', 'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/'),
  metrics: L('Resource metrics pipeline', 'https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/'),
  addons: L('Installing Addons', 'https://kubernetes.io/docs/concepts/cluster-administration/addons/'),
  metallb: L('MetalLB — Concepts', 'https://metallb.io/concepts/'),
  certManager: L('cert-manager — Securing gateway resources', 'https://cert-manager.io/docs/usage/gateway/'),
  flux: L('Flux — Core concepts', 'https://fluxcd.io/flux/concepts/'),
  prometheus: L('Prometheus — Overview', 'https://prometheus.io/docs/introduction/overview/'),
};

export const addonsQuiz: QuizItem[] = [
  {
    id: 'k8s.q.addons.pvc',
    kind: 'mcq',
    concepts: ['k8s.pvc', 'k8s.storageclass'],
    prompt: bi(
      'Заявка PVC `data` висит в Pending, а в её событиях написано «Waiting for a volume to be created either by the external provisioner \'hostpath.csi.k8s.io\' or manually by the system administrator». Что сломано?',
      'PVC `data` stays Pending, and its events say "Waiting for a volume to be created either by the external provisioner \'hostpath.csi.k8s.io\' or manually by the system administrator". What is broken?',
    ),
    options: [
      { id: 'driver', text: bi('StorageClass есть, но не работает CSI-драйвер, который создаёт тома', 'The StorageClass exists, but the CSI driver that creates volumes is not running'), correct: true },
      { id: 'nosc', text: bi('В кластере нет ни одной StorageClass', 'There is no StorageClass in the cluster'), why: bi('Тогда событие было бы другим: «no persistent volumes available for this claim and no storage class is set». Здесь класс есть, и в событии даже назван его провизионер.', 'Then the event would read "no persistent volumes available for this claim and no storage class is set". Here the class exists, and the event even names its provisioner.') },
      { id: 'sched', text: bi('Планировщик не нашёл узла для пода базы данных', 'The scheduler found no node for the database pod'), why: bi('Планировщик в выпуске тома не участвует. Наоборот, он ждёт, пока заявка станет Bound, и только после этого ставит под на узел.', 'The scheduler takes no part in creating the volume; it waits for the claim to become Bound and only then places the pod.') },
    ],
  },
  {
    id: 'k8s.q.addons.hpa',
    kind: 'mcq',
    concepts: ['k8s.hpa', 'k8s.addon'],
    prompt: bi(
      'У HPA в столбце TARGETS стоит «cpu: <unknown>/50%», а `kubectl top pods` отвечает «error: Metrics API not available». Какого дополнения не хватает кластеру?',
      'The HPA TARGETS column shows "cpu: <unknown>/50%", and `kubectl top pods` says "error: Metrics API not available". Which add-on is missing?',
    ),
    options: [
      { id: 'ms', text: bi('metrics-server', 'metrics-server'), correct: true },
      { id: 'prom', text: bi('Prometheus', 'Prometheus'), why: bi('Prometheus собирает метрики для графиков и алертов, но HPA по умолчанию берёт цифры из Metrics API, а этот API отдаёт metrics-server.', 'Prometheus collects metrics for graphs and alerts, but the HPA reads the Metrics API by default, and metrics-server serves it.') },
      { id: 'node', text: bi('Ещё одного узла, потому что подам не хватает процессора', 'One more node, because the pods lack CPU'), why: bi('Нехватка процессора выглядела бы иначе: новые поды стояли бы в Pending с «Insufficient cpu». Здесь же не отвечает сам API метрик, и HPA не знает, сколько процессора тратят поды.', 'A CPU shortage looks different: new pods would be Pending with "Insufficient cpu". Here the Metrics API itself does not answer, so the HPA does not know how much CPU the pods use.') },
    ],
  },
  {
    id: 'k8s.q.addons.netpol',
    kind: 'mcq',
    concepts: ['k8s.networkpolicy', 'k8s.cni'],
    prompt: bi(
      'В namespace есть NetworkPolicy, которая пускает к подам `api` только поды с меткой `app=web`, а под `client` без этой метки всё равно получает ответ от `api`. Политика написана правильно. В чём вероятнее всего дело?',
      'A NetworkPolicy lets only pods labelled `app=web` reach the `api` pods, yet pod `client` without that label still gets an answer. The policy is written correctly. What is most likely?',
    ),
    options: [
      { id: 'cni', text: bi('Сетевой плагин кластера не применяет NetworkPolicy, например это flannel без отдельного контроллера политик', 'The network plugin does not enforce NetworkPolicy, for example plain flannel'), correct: true },
      { id: 'restart', text: bi('Политика начнёт действовать только после перезапуска подов', 'The policy takes effect only after the pods restart'), why: bi('Плагин, который поддерживает политики, применяет их к уже работающим подам сразу, без перезапуска.', 'A plugin that supports policies applies them to running pods at once, without a restart.') },
      { id: 'api', text: bi('Политику должен применить API-сервер, а он ещё не успел', 'The API server has to apply the policy and has not done it yet'), why: bi('API-сервер только хранит политику. Пакеты фильтрует сетевой плагин на узлах, и если он политик не умеет, их не применяет никто.', 'The API server only stores the policy. The network plugin on the nodes filters packets, and if it cannot, nobody does.') },
    ],
  },
];

export const addonsLesson: Lesson = {
  id: 'k8s-1.addons',
  block: 'k8s-1',
  title: bi('Что ставят в кластер поверх Kubernetes', 'What goes on top of Kubernetes'),
  summary: bi(
    'Какие дополнения нужны почти любому кластеру (вход снаружи, сертификаты, диски, метрики, выкладка из Git и мониторинг), за что отвечает каждое, что и кому оно передаёт и что перестаёт работать без него.',
    'The add-ons almost every cluster needs (traffic in, certificates, disks, metrics, deploying from Git, monitoring), what each is responsible for, what it hands to whom and what stops working without it.',
  ),
  introduces: ['k8s.addon', 'k8s.pvc', 'k8s.storageclass', 'k8s.hpa'],
  uses: ['k8s.controller', 'k8s.crd', 'k8s.helm', 'k8s.gateway-api', 'k8s.secret', 'k8s.cni', 'k8s.networkpolicy', 'k8s.kube-proxy', 'k8s.resources'],
  tier: 'core',
  minutes: 35,
  sources: src([SRC.addons, S.components, S.gateway, SRC.pv, SRC.sc, SRC.hpa, SRC.metrics, SRC.metallb, SRC.certManager, SRC.flux, SRC.prometheus], [R.components, SRC.addons, SRC.pv, SRC.hpa]),
  sections: [
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Чего кластеру не хватает сверх самого Kubernetes', 'What a cluster lacks beyond Kubernetes itself'),
      body: bi(
        'Кластер, который вы собирали из блоков в уроке об устройстве Kubernetes, умеет главное: хранить желаемое состояние, назначать поды на узлы, запускать контейнеры, давать подам адреса и имена. Но стоит запустить на нём настоящий интернет-магазин, и выяснится, что многого в нём нет. Сайт не открывается из офиса по имени, у него нет сертификата для HTTPS, база данных теряет файлы вместе с подом, под нагрузкой подов не становится больше, выкладку делает человек руками, а о том, что под раз за разом падает, никто не узнаёт.\n\nВсё это делают [[k8s.addon|дополнения кластера]]. Каждое дополнение устроено так же, как сам Kubernetes: это [[k8s.controller|контроллер]], который работает подами, смотрит через API-сервер свои объекты и делает шаг навстречу желаемому. Почти у каждого есть свои виды объектов, добавленные через [[k8s.crd|CustomResourceDefinition]], и ставят их обычно [[k8s.helm|Helm]]-чартом. Поэтому дополнение легко представить ещё одним блоком, который подключается к API-серверу так же, как планировщик или kube-proxy.\n\nДополнения удобно делить на слои по тому, за что они отвечают. Слой входа снаружи состоит из двух частей. MetalLB выдаёт сервису типа LoadBalancer адрес в сети офиса и отвечает на ARP-запросы о нём, потому что облачного балансировщика в собственном дата-центре нет. Контроллер входа Traefik исполняет правила [[k8s.gateway-api|Gateway API]] и по имени сайта отправляет запрос нужному сервису. Слой сертификатов составляет cert-manager: он выпускает сертификат и кладёт его в [[k8s.secret|Secret]], откуда его берёт Traefik. В слое хранилища работает CSI-драйвер со своей [[k8s.storageclass|StorageClass]]: по заявке на диск, объекту [[k8s.pvc|PersistentVolumeClaim]], он создаёт том, а контроллер томов в kube-controller-manager связывает заявку с томом. Слой метрик держит metrics-server, у которого текущее потребление подов берут команда `kubectl top` и [[k8s.hpa|HorizontalPodAutoscaler]], контроллер, меняющий число реплик под нагрузкой. В слое выкладки работает Flux: он сам забирает манифесты из репозитория Git и держит кластер таким, как там записано, так что выкладка сводится к коммиту, а ручное изменение в кластере продержится только до следующей сверки. Наконец, слой наблюдаемости составляет Prometheus, система мониторинга, которая собирает метрики и считает алерты, и два поставщика метрик для него: один рассказывает о самих машинах, другой — о состоянии объектов кластера. Подробно мониторинг разбирает отдельный блок курса, а здесь важно, кто кому что передаёт.\n\nСетевой плагин тоже бывает разным, и от выбора зависит, что умеет кластер. flannel даёт подам адреса, но [[k8s.networkpolicy|NetworkPolicy]] не применяет: политика лежит в API, а пакеты проходят. Calico политики применяет. Cilium применяет их и вдобавок сам ведёт запросы к сервисам, так что [[k8s.kube-proxy|kube-proxy]] в кластере с ним можно не ставить.',
        'The cluster you built from blocks in the lesson on how Kubernetes works does the essentials: it keeps the desired state, assigns pods to nodes, starts containers, gives pods addresses and names. But run a real online shop on it and much turns out to be missing. The site does not open from the office by name, it has no HTTPS certificate, the database loses its files with the pod, the pod count does not grow under load, a person deploys by hand, and nobody learns that a pod keeps crashing.\n\nAll of this is done by [[k8s.addon|cluster add-ons]]. Each add-on is built like Kubernetes itself: a [[k8s.controller|controller]] that runs as pods, watches its objects through the API server and takes a step towards the desired state. Almost every one brings its own kinds through a [[k8s.crd|CustomResourceDefinition]] and is usually installed with a [[k8s.helm|Helm]] chart. So an add-on is one more block wired to the API server like the scheduler or kube-proxy.\n\nAdd-ons fall into layers by responsibility. Traffic in has two parts: MetalLB gives a LoadBalancer Service an address on the office network and answers ARP for it, because there is no cloud load balancer in your own data centre; the Traefik ingress controller executes [[k8s.gateway-api|Gateway API]] rules and sends a request to the right Service by host name. Certificates are cert-manager’s: it issues a certificate into a [[k8s.secret|Secret]] that Traefik serves. Storage is a CSI driver with its [[k8s.storageclass|StorageClass]]: for a disk claim, a [[k8s.pvc|PersistentVolumeClaim]], it creates a volume, and the volume controller binds them. Metrics are metrics-server’s: `kubectl top` and the [[k8s.hpa|HorizontalPodAutoscaler]] read the current usage from it. Deploying from Git is Flux’s: it fetches manifests from a Git repository itself and keeps the cluster as written there, so a deploy is a commit and a manual change lasts only until the next reconciliation. Observability is Prometheus, a monitoring system that collects metrics and evaluates alerts, with two metric sources: one about the machines, one about the state of the cluster objects. A later block covers monitoring in depth; here what matters is who hands what to whom.\n\nThe network plugin differs too. flannel gives pods addresses but does not enforce [[k8s.networkpolicy|NetworkPolicy]]: the policy sits in the API and packets pass. Calico enforces policies. Cilium enforces them and routes Services itself, so a cluster with it can do without [[k8s.kube-proxy|kube-proxy]].',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как устроен конструктор со всеми слоями', 'How the constructor with every layer is laid out'),
      body: bi(
        'Ниже тот же конструктор, что в уроке об устройстве кластера, но теперь в нём девять слоёв. Над холстом стоит легенда: у каждого слоя свой цвет, название и список блоков, и блок на холсте окрашен в цвет своего слоя. Холст разделён на три зоны. Вверху управляющий слой, посередине узлы с агентом и сетью кластера, внизу дополнения, которые работают подами на тех же узлах.\n\nСплошные линии на холсте — это провода к API-серверу, и на каждом подписано, что по нему идёт. Дополнения подключены к API-серверу общей серой шиной справа, потому что все они разговаривают с кластером одинаково: смотрят свои объекты и записывают результат. Только поставщик метрик о машинах к шине не подключён, потому что с API-сервером он не разговаривает вовсе. Пунктирные стрелки показывают, кто кому передаёт данные помимо API: MetalLB выдаёт адрес сервису Traefik, cert-manager отдаёт Traefik сертификат, а оба поставщика метрик отдают их Prometheus. Бледный блок с пунктирной рамкой принадлежит выключенному слою и в прогоне считается убранным.\n\nСценарии под холстом запускают учебный кластер ровно из того, что включено, и показывают настоящий вывод kubectl и curl. Над выводом тренажёр полным предложением называет компонент, из-за отсутствия которого сценарий сломался, или объясняет, кто и что сделал, если всё сработало.',
        'Below is the constructor from the lesson on how a cluster works, now with nine layers. Above the canvas is the legend: every layer has a colour, a name and its blocks, and a block on the canvas has the colour of its layer. The canvas has three zones: the control plane on top, the nodes with the node agent and the cluster network in the middle, the add-ons that run as pods on those nodes at the bottom.\n\nSolid lines are wires to the API server, each labelled with what goes over it. Add-ons are wired to the API server by the grey bus on the right, because they all talk to the cluster the same way: they watch their objects and write the result. Only the source of machine metrics is not on the bus: it does not talk to the API server at all. Dashed arrows show who hands data to whom besides the API: MetalLB gives the Traefik Service its address, cert-manager hands Traefik the certificate, both metric sources hand metrics to Prometheus. A dimmed block with a dashed outline belongs to a layer that is off and counts as removed in a run.\n\nThe scenarios under the canvas start the training cluster from exactly what is switched on and show the real kubectl and curl output. Above the output the trainer names, in a full sentence, the component whose absence broke the scenario, or explains who did what when everything worked.',
      ),
    },
    {
      id: 'howto',
      kind: 'text',
      role: 'howto',
      step: 'try',
      body: bi(
        'Сначала нажмите кнопку сценария «Сайт снаружи по имени», пока на холсте собрано всё: запрос из офиса дойдёт до пода магазина. Затем выключите слой «Вход снаружи», нажав на его название в легенде, и запустите тот же сценарий ещё раз. Потом включите слой обратно, откройте карточку MetalLB, нажмите «Убрать с холста» и сравните вывод: Gateway останется без адреса, а сервис Traefik будет с EXTERNAL-IP «<pending>».\n\nТак же пройдите остальные слои: у каждого есть свой сценарий, и цвет метки на кнопке совпадает с цветом слоя. В карточке сетевого плагина выберите flannel и запустите «Закрыть сервис политикой», а затем выберите Cilium, уберите kube-proxy и проверьте, что «Запрос к Service по имени» всё равно проходит. Нажатие на любой блок открывает карточку: что он делает, кто его ставит, с кем говорит, что и кому передаёт, что будет, если его убрать, и ссылку на документацию.',
        'First press the scenario “The site from outside by name” while everything is on the canvas: the request from the office reaches a shop pod. Then switch off the layer “Traffic in” by pressing its name in the legend and run the scenario again. Switch the layer back on, open the MetalLB card, press “Remove from the canvas” and compare: the Gateway has no address, and the Traefik Service shows EXTERNAL-IP “<pending>”.\n\nGo through the other layers the same way: each has its scenario, the swatch on the button has the layer’s colour. In the network plugin card choose flannel and run “Close a Service with a policy”, then choose Cilium, remove kube-proxy and check that “A request to a Service by name” still works. Pressing any block opens its card: what it does, who installs it, whom it talks to, what it hands to whom, what happens without it, and a documentation link.',
      ),
    },
    { id: 'constructor', kind: 'widget', step: 'try', widget: 'k8s.constructor', props: { preset: 'full', layers: 'all' } },
    {
      id: 'after',
      kind: 'text',
      step: 'review',
      title: bi('Как по слоям искать неисправность', 'Looking for a fault layer by layer'),
      body: bi(
        'Когда в настоящем кластере что-то не работает, идите по тем же слоям, что в конструкторе, и смотрите на те же признаки. Если у Gateway нет адреса, а у сервиса типа LoadBalancer висит «<pending>», значит, в кластере нет поставщика адресов или он не работает. Если заявка PVC остаётся в Pending, выполните `kubectl get sc` и посмотрите события заявки: «no storage class is set» означает, что хранилища в кластере нет вовсе, а «Waiting for a volume to be created by the external provisioner» говорит о том, что StorageClass есть, но драйвер не работает. Если HPA показывает <unknown>, проверьте командой `kubectl top pods`, отвечает ли Metrics API. Если коммит в Git ничего не изменил, посмотрите состояние Flux командой `kubectl get kustomization -A`. А если алерт не пришёл, откройте список целей Prometheus: правило, для которого нет метрики, не выдаёт ошибки, а просто молчит.',
        'When something does not work in a real cluster, go through the same layers as in the constructor and look for the same signs. A Gateway without an address and a LoadBalancer Service stuck at "<pending>" mean there is no address provider or it does not run. A PVC that stays Pending: run `kubectl get sc` and read the claim events — "no storage class is set" means there is no storage at all, "Waiting for a volume to be created by the external provisioner" means the StorageClass exists but the driver does not run. An HPA showing <unknown>: check with `kubectl top pods` whether the Metrics API answers. A Git commit that changed nothing: look at Flux with `kubectl get kustomization -A`. And when an alert did not come, open the Prometheus target list: a rule without its metric raises no error, it just stays silent.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: addonsQuiz.map((q) => q.id) },
  ],
};
