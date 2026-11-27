// The last lesson of stage 1, a wrap-up. The constructor grew along the
// stage — the core in the architecture lesson, traffic in in the ingress
// lesson, storage and metrics in their lessons — and here it gets the last
// three layers (certificates, deploying from Git, observability) and the
// whole picture, with a fault search layer by layer.

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem, SourceLink } from '../../../core/types';
import { R, S, src } from '../sources';

const L = (title: string, url: string): SourceLink => ({ title, url });
const SRC = {
  addons: L('Installing Addons', 'https://kubernetes.io/docs/concepts/cluster-administration/addons/'),
  certManager: L('cert-manager — Securing gateway resources', 'https://cert-manager.io/docs/usage/gateway/'),
  flux: L('Flux — Core concepts', 'https://fluxcd.io/flux/concepts/'),
  prometheus: L('Prometheus — Overview', 'https://prometheus.io/docs/introduction/overview/'),
};

export const addonsQuiz: QuizItem[] = [
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
      { id: 'api', text: bi('Политику должен применить API-сервер, а он ещё не успел разослать её на все узлы кластера вместе с другими изменениями', 'The API server has to apply the policy and has not yet sent it out to all the nodes'), why: bi('API-сервер только хранит политику. Пакеты фильтрует сетевой плагин на узлах, и если он политик не умеет, их не применяет никто.', 'The API server only stores the policy. The network plugin on the nodes filters packets, and if it cannot, nobody does.') },
    ],
  },
  {
    id: 'k8s.q.addons.gitops',
    kind: 'mcq',
    concepts: ['k8s.addon'],
    prompt: bi(
      'В кластере работает Flux, который держит Deployment `web` таким, как записано в репозитории Git. Дежурный ночью увеличил число реплик командой `kubectl scale deploy web --replicas=6`, а утром реплик снова три. Что произошло?',
      'Flux runs in the cluster and keeps Deployment `web` as the Git repository says. At night the on-call engineer raised the replicas with `kubectl scale deploy web --replicas=6`, and in the morning there are three again. What happened?',
    ),
    options: [
      { id: 'drift', text: bi('При следующей сверке Flux вернул число реплик, записанное в Git, потому что источник правды — репозиторий, а не кластер', 'At the next reconciliation Flux restored the replica count from Git, because the source of truth is the repository, not the cluster'), correct: true },
      { id: 'hpa', text: bi('Реплики убрал HorizontalPodAutoscaler, потому что ночью нагрузка спала и средняя загрузка процессора опустилась намного ниже цели', 'The HorizontalPodAutoscaler removed the replicas, because the load fell at night and the average CPU use dropped far below its target value'), why: bi('HPA мог бы так сделать, но в условии его нет. Здесь число вернул агент выкладки из Git, и чтобы реплик осталось шесть, менять число нужно коммитом в репозиторий.', 'An HPA could do that, but there is none here. The Git deploy agent brought the number back, and to keep six replicas the change has to be a commit to the repository.') },
      { id: 'rs', text: bi('Контроллер ReplicaSet удалил лишние поды', 'The ReplicaSet controller deleted the extra pods'), why: bi('Контроллер ReplicaSet держит то число, которое ему записали. Число изменил кто-то выше по цепочке, и в этом кластере это Flux.', 'The ReplicaSet controller keeps whatever number it was given. Someone higher up the chain changed the number, and in this cluster it is Flux.') },
    ],
  },
];

export const addonsLesson: Lesson = {
  id: 'k8s-1.addons',
  block: 'k8s-1',
  title: bi('Кластер целиком, со слоями сертификатов, выкладки из Git и наблюдаемости поверх всего пройденного', 'The whole cluster, with the layers of certificates, deploying from Git and observability on top of everything so far'),
  summary: bi(
    'Сводка этапа: какие три слоя дополнений ещё ставят почти в любой кластер, как все слои вместе передают друг другу работу и как по ним искать неисправность.',
    'A summary of the stage: which three more layers of add-ons go into almost every cluster, how all the layers together hand work to each other, and how to look for a fault layer by layer.',
  ),
  introduces: [],
  uses: ['k8s.addon', 'k8s.controller', 'k8s.crd', 'k8s.helm', 'k8s.gateway-api', 'k8s.secret', 'k8s.cni', 'k8s.networkpolicy', 'k8s.kube-proxy', 'k8s.pvc', 'k8s.storageclass', 'k8s.hpa', 'k8s.metrics-server'],
  tier: 'core',
  minutes: 20,
  sources: src([SRC.addons, S.components, SRC.certManager, SRC.flux, SRC.prometheus], [R.components, SRC.addons]),
  sections: [
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Три слоя, которых ещё не было', 'Three layers you have not met yet'),
      body: bi(
        'Конструктор кластера рос вместе с этапом. В уроке об устройстве Kubernetes в нём были управляющий слой, узлы и сеть кластера, в уроке о входе снаружи появились MetalLB и Traefik, в уроке о данных CSI-драйвер, а в уроке о масштабировании metrics-server. Каждое из этих [[k8s.addon|дополнений]] устроено так же, как сам Kubernetes: это контроллер, который работает подами, смотрит через API-сервер свои объекты и делает шаг навстречу желаемому. Ставят их обычно [[k8s.helm|Helm]]-чартом.\n\nОсталось три слоя, без которых рабочий кластер почти не встречается. Слой сертификатов составляет cert-manager: по аннотации на Gateway он выпускает сертификат HTTPS у центра сертификации и кладёт его в [[k8s.secret|Secret]], откуда сертификат берёт Traefik, а за месяц до конца срока сам выпускает новый. В слое выкладки работает Flux: он сам забирает манифесты из репозитория Git и держит кластер таким, как там записано, так что выкладка сводится к коммиту, а ручное изменение в кластере продержится только до следующей сверки. Подробно эту модель разбирает блок о выкладке из CI. Наконец, слой наблюдаемости составляет Prometheus, система мониторинга, которая собирает метрики и считает алерты, и два поставщика метрик для него: один рассказывает о самих машинах, а другой о состоянии объектов кластера, например о поде, который раз за разом перезапускается. Мониторингу посвящён отдельный блок курса, а здесь важно, кто кому что передаёт.',
        'The cluster constructor grew along with the stage. In the lesson on how Kubernetes works it had the control plane, the nodes and the cluster network, the lesson on traffic from outside added MetalLB and Traefik, the lesson on data a CSI driver, and the lesson on scaling metrics-server. Each of these [[k8s.addon|add-ons]] is built like Kubernetes itself: a controller that runs as pods, watches its objects through the API server and takes a step towards the desired state. They are usually installed with a [[k8s.helm|Helm]] chart.\n\nThree layers remain that a production cluster is hardly ever without. The certificates layer is cert-manager: from an annotation on the Gateway it issues an HTTPS certificate from a certificate authority into a [[k8s.secret|Secret]], where Traefik takes it, and a month before expiry it issues a new one itself. The deploy layer runs Flux: it fetches manifests from a Git repository itself and keeps the cluster as written there, so a deploy is a commit, and a manual change in the cluster lasts only until the next reconciliation. The block on deploying from CI covers this model in detail. Finally, the observability layer is Prometheus, a monitoring system that collects metrics and evaluates alerts, with two metric sources: one tells about the machines, the other about the state of cluster objects, such as a pod that restarts again and again. A separate block of the course is about monitoring; here what matters is who hands what to whom.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как устроен конструктор со всеми слоями', 'How the constructor with every layer is laid out'),
      body: bi(
        'Ниже тот же конструктор, теперь со всеми девятью слоями. Над холстом стоит легенда: у каждого слоя свой цвет, название и список блоков, и блок на холсте окрашен в цвет своего слоя. Холст разделён на три зоны. Вверху управляющий слой, посередине узлы с агентом и сетью кластера, внизу дополнения, которые работают подами на тех же узлах.\n\nСплошные линии на холсте обозначают провода к API-серверу, и на каждом подписано, что по нему идёт. Дополнения подключены к API-серверу общей серой шиной справа, потому что все они разговаривают с кластером одинаково: смотрят свои объекты и записывают результат. Только поставщик метрик о машинах к шине не подключён, потому что с API-сервером он не разговаривает вовсе. Пунктирные стрелки показывают, кто кому передаёт данные помимо API: MetalLB выдаёт адрес сервису Traefik, cert-manager отдаёт Traefik сертификат, а оба поставщика метрик отдают их Prometheus. Бледный блок с пунктирной рамкой принадлежит выключенному слою и в прогоне считается убранным.',
        'Below is the same constructor, now with all nine layers. Above the canvas is the legend: every layer has a colour, a name and its blocks, and a block on the canvas has the colour of its layer. The canvas has three zones: the control plane on top, the nodes with the node agent and the cluster network in the middle, the add-ons that run as pods on those nodes at the bottom.\n\nSolid lines are wires to the API server, each labelled with what goes over it. Add-ons are wired to the API server by the grey bus on the right, because they all talk to the cluster the same way: they watch their objects and write the result. Only the source of machine metrics is not on the bus: it does not talk to the API server at all. Dashed arrows show who hands data to whom besides the API: MetalLB gives the Traefik Service its address, cert-manager hands Traefik the certificate, both metric sources hand metrics to Prometheus. A dimmed block with a dashed outline belongs to a layer that is off and counts as removed in a run.',
      ),
    },
    {
      id: 'howto',
      kind: 'text',
      role: 'howto',
      step: 'try',
      body: bi(
        'Начните с трёх новых слоёв. Запустите сценарий «HTTPS-сертификат», затем выключите слой «Сертификаты», нажав на его название в легенде, и запустите сценарий ещё раз: curl откажется доверять самоподписанному сертификату Traefik. Так же пройдите сценарии «Выкладка через Git» и «Почему не пришёл алерт», выключая слои «Выкладка из Git» и «Наблюдаемость».\n\nПотом проверьте себя на всём кластере. Уберите с холста по одному блоку из разных слоёв, например MetalLB, CSI-драйвер или kube-controller-manager, и прежде чем запускать сценарий, скажите себе, какие сценарии сломаются и что напечатает kubectl. Нажатие на любой блок открывает карточку: что он делает, кто его ставит, с кем говорит, что и кому передаёт, что будет, если его убрать, и ссылку на документацию.',
        'Start with the three new layers. Run the scenario “An HTTPS certificate”, then switch off the layer “Certificates” by pressing its name in the legend and run it again: curl refuses to trust Traefik’s self-signed certificate. Go through “Deploying through Git” and “Why no alert came” the same way, switching off the matching layers in the legend.\n\nThen test yourself on the whole cluster. Remove one block at a time from different layers, such as MetalLB, the CSI driver or kube-controller-manager, and before running a scenario tell yourself which scenarios will break and what kubectl will print. Pressing any block opens its card: what it does, who installs it, whom it talks to, what it hands to whom, what happens without it, and a documentation link.',
      ),
    },
    { id: 'constructor', kind: 'widget', step: 'try', widget: 'k8s.constructor', props: { preset: 'full', layers: 'all' } },
    {
      id: 'after',
      kind: 'text',
      step: 'review',
      title: bi('Как по слоям искать неисправность', 'Looking for a fault layer by layer'),
      body: bi(
        'Когда в настоящем кластере что-то не работает, идите по тем же слоям, что в конструкторе, и смотрите на те же признаки. Если у Gateway нет адреса, а у сервиса типа LoadBalancer висит «<pending>», значит, в кластере нет поставщика адресов или он не работает. Если заявка PVC остаётся в Pending, прочитайте её события командой `kubectl describe pvc`, как в уроке о данных. Если HPA показывает <unknown>, проверьте командой `kubectl top pods`, отвечает ли Metrics API, и есть ли у подов requests. Если коммит в Git ничего не изменил, посмотрите состояние Flux командой `kubectl get kustomization -A`. А если алерт не пришёл, откройте список целей Prometheus: правило, для которого нет метрики, ошибки не выдаёт и молчит.',
        'When something does not work in a real cluster, go through the same layers as in the constructor and look for the same signs. A Gateway without an address and a LoadBalancer Service stuck at "<pending>" mean there is no address provider or it does not run. A PVC that stays Pending: read its events with `kubectl describe pvc`, as in the lesson on data. An HPA showing <unknown>: check with `kubectl top pods` whether the Metrics API answers, and whether the pods have requests. A Git commit that changed nothing: look at Flux with `kubectl get kustomization -A`. And when an alert did not come, open the Prometheus target list: a rule without its metric raises no error and stays silent.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: addonsQuiz.map((q) => q.id) },
  ],
};
