// The review before the final exam (route id `final`): the whole Kubernetes
// cluster on one map. The learner assembles the full constructor with every
// layer, then repairs a broken cluster layer by layer on kube-lite.

import { bi } from '../../core/i18n';
import type { Lesson, QuizItem } from '../../core/types';

const SRC = {
  components: { title: 'Kubernetes — Cluster Components', url: 'https://kubernetes.io/docs/concepts/overview/components/' },
  componentsRu: { title: 'Компоненты Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/concepts/overview/components/' },
  debugCluster: { title: 'Kubernetes — Troubleshooting Clusters', url: 'https://kubernetes.io/docs/tasks/debug/debug-cluster/' },
  debugApp: { title: 'Kubernetes — Troubleshooting Applications', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/' },
  dns: { title: 'Kubernetes — Debugging DNS Resolution', url: 'https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/' },
};

export const MAP_QUIZ: QuizItem[] = [
  {
    id: 'final.q.map-pending',
    kind: 'mcq',
    concepts: ['k8s.kubelet', 'k8s.scheduler'],
    prompt: bi('Все поды нового Deployment стоят в Pending, а `kubectl get nodes` показывает, что все узлы NotReady. Что проверить первым?', 'Every pod of a new Deployment is Pending, and `kubectl get nodes` shows every node NotReady. What do you check first?'),
    options: [
      { id: 'kubelet', text: bi('Службу kubelet на одном из узлов командой `systemctl status kubelet` и её журнал', 'The kubelet service on one of the nodes: `systemctl status kubelet` and its log'), correct: true },
      { id: 'scheduler', text: bi('Журнал kube-scheduler, ведь поды в Pending', 'The kube-scheduler log, since the pods are Pending'), why: bi('Здесь под стоит в Pending, потому что ему ещё не назначили узел, а назначать некуда: все узлы NotReady, и планировщик ждёт готового узла, как и должен. Самый заметный симптом указывает не на ту часть системы, которая сломана.', 'Here the pod is Pending because it has no node yet, and there is nowhere to put it: every node is NotReady, and the scheduler waits for a ready node, as it should. The most visible symptom points at the wrong part of the system.') },
      { id: 'redeploy', text: bi('Удалить Deployment и создать его заново', 'Delete the Deployment and create it again'), why: bi('Новые поды встанут в Pending по той же причине, потому что узлы по-прежнему не готовы. Пересоздание объекта не чинит узлы.', 'New pods go Pending for the same reason, because the nodes are still not ready. Recreating an object does not fix the nodes.') },
    ],
  },
  {
    id: 'final.q.map-name',
    kind: 'mcq',
    concepts: ['k8s.cluster-dns', 'k8s.kube-proxy'],
    prompt: bi('Из пода запрос `curl http://web` отвечает «Could not resolve host», а запрос на адрес ClusterIP того же сервиса получает ответ. Какой слой исправен, а какой нет?', 'From a pod, `curl http://web` says “Could not resolve host”, while a request to the same Service’s ClusterIP gets an answer. Which layer works and which does not?'),
    options: [
      { id: 'dns', text: bi('Сеть подов и правила сервиса работают, а имя не превращается в адрес, поэтому смотреть нужно на CoreDNS', 'The pod network and the Service rules work, but the name does not turn into an address, so look at CoreDNS'), correct: true },
      { id: 'proxy', text: bi('Сломаны правила kube-proxy', 'The kube-proxy rules are broken'), why: bi('Запрос по адресу ClusterIP получил ответ, а этот адрес на под переводят правила kube-proxy. Значит, они работают.', 'The request to the ClusterIP got an answer, and it is the kube-proxy rules that translate that address to a pod. So they work.') },
      { id: 'cni', text: bi('Сломан сетевой плагин, и поды не видят друг друга', 'The network plugin is broken, and pods cannot see each other'), why: bi('Ответ пришёл от пода сервиса, значит, пакеты между подами ходят. Сравнение запроса по имени с запросом по адресу одним шагом отделяет DNS от сети.', 'The answer came from a pod of the Service, so packets travel between pods. Comparing a request by name with a request by address separates DNS from the network in one step.') },
    ],
  },
  {
    id: 'final.q.map-layers',
    kind: 'match',
    concepts: ['k8s.addon'],
    prompt: bi('Сопоставьте симптом с компонентом, без которого он появляется.', 'Match each symptom with the component whose absence causes it.'),
    pairs: [
      { id: 'cm', left: bi('Deployment создан, READY 0/3, а ReplicaSet и подов нет', 'The Deployment is created, READY 0/3, and there is no ReplicaSet and no pods'), right: 'kube-controller-manager' },
      { id: 'lb', left: bi('У сервиса типа LoadBalancer в EXTERNAL-IP стоит «<pending>»', 'A LoadBalancer Service shows “<pending>” in EXTERNAL-IP'), right: bi('MetalLB или балансировщик облака', 'MetalLB or the cloud load balancer') },
      { id: 'pvc', left: bi('Заявка PVC в Pending с событием «no storage class is set»', 'A PVC is Pending with the event “no storage class is set”'), right: bi('CSI-драйвер и StorageClass', 'The CSI driver and a StorageClass') },
      { id: 'hpa', left: bi('В TARGETS у HPA стоит <unknown>, а `kubectl top` пишет «Metrics API not available»', 'The HPA shows <unknown> in TARGETS, and `kubectl top` says “Metrics API not available”'), right: 'metrics-server' },
    ],
    explain: bi('Каждый слой кластера, когда отказывает, оставляет свой узнаваемый след в выводе kubectl. Найдя этот след, вы называете слой, а не гадаете.', 'Every layer of the cluster leaves its own recognisable trace in kubectl output when it fails. Once you find the trace, you name the layer instead of guessing.'),
  },
];

export const L_CLUSTER_MAP: Lesson = {
  id: 'final.cluster-map',
  block: 'final',
  title: bi('Вся карта кластера и ремонт по слоям', 'The whole cluster map and repair layer by layer'),
  summary: bi('Повторение перед итоговым экзаменом. Вы собираете кластер из всех девяти слоёв в конструкторе, а потом чините сломанный кластер слой за слоем, читая настоящий вывод kubectl и curl.', 'A review before the final exam. You assemble a cluster from all nine layers in the constructor, then repair a broken cluster layer by layer, reading real kubectl and curl output.'),
  introduces: [],
  uses: ['k8s.apiserver', 'k8s.etcd', 'k8s.controller', 'k8s.scheduler', 'k8s.kubelet', 'k8s.cni', 'k8s.kube-proxy', 'k8s.cluster-dns', 'k8s.addon', 'k8s.desired-state'],
  tier: 'core',
  minutes: 45,
  sources: { en: [SRC.components, SRC.debugCluster, SRC.debugApp, SRC.dns], ru: [SRC.componentsRu] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'На итоговом экзамене, а потом и в первую неделю на работе вам достанется не отдельный слой кластера, а весь кластер сразу. Жалоба придёт словами пользователя, например «сайт не открывается», «база не запускается» или «алерт не пришёл». От того, сумеете ли вы по такой жалобе быстро найти слой, в котором остановилась цепочка, зависит, будете ли вы чинить сервис или гадать.\n\nВ блоках о Kubernetes вы собирали кластер по частям, и конструктор рос вместе с ними. В этом уроке вы соберёте его целиком, со всеми девятью слоями, а затем почините девять сломанных кластеров, в каждом из которых не работает один компонент.',
        'At the final exam, and then in your first week at work, you will get not one layer of a cluster but the whole cluster at once. The complaint will come in a user’s words: “the site does not open”, “the database does not start”, “the alert never came”. Whether you can quickly find from such a complaint the layer where the chain stopped decides whether you fix the service or guess.\n\nIn the Kubernetes blocks you built the cluster in parts, and the constructor grew with them. In this lesson you assemble it whole, with all nine layers, and then repair nine broken clusters, in each of which one component does not work.',
      ),
    },
    {
      id: 'model',
      kind: 'text',
      step: 'explain',
      title: bi('Как устроен кластер целиком', 'How the whole cluster is built'),
      body: bi(
        'Весь кластер держится на одном правиле: компоненты не разговаривают друг с другом напрямую, а только через [[k8s.apiserver|API-сервер]]. Вы записываете туда [[k8s.desired-state|желаемое состояние]], API-сервер хранит его в [[k8s.etcd|etcd]], а остальные компоненты следят за своими объектами через API-сервер и делают шаг к желаемому. Каждый из них устроен как [[k8s.controller|контроллер]]: смотрит, чего хотят, смотрит, что есть, и устраняет разницу.\n\nПоэтому любое изменение проходит по одной и той же цепочке. Объект Deployment попадает в API-сервер, контроллеры в kube-controller-manager создают по нему ReplicaSet и поды, [[k8s.scheduler|планировщик]] назначает каждому поду узел, [[k8s.kubelet|kubelet]] на этом узле поручает рантайму контейнеров запустить контейнер, а [[k8s.cni|сетевой плагин]] даёт поду адрес. Запрос пользователя идёт по второй цепочке. DNS офиса или облака превращает имя сайта в адрес, который выдал MetalLB или балансировщик облака, [[k8s.kube-proxy|правила kube-proxy]] ведут запрос к контроллеру входа Traefik, а Traefik по имени сайта находит нужный сервис и отправляет запрос в один из подов этого сервиса. Внутри кластера имена сервисов превращает в адреса [[k8s.cluster-dns|CoreDNS]].\n\nОстальные слои составляют [[k8s.addon|дополнения]]. Они работают подами в том же кластере, и большинство из них устроено так же, как компоненты самого Kubernetes, то есть следит за своими объектами через API-сервер. Из них cert-manager выпускает сертификаты, CSI-драйвер создаёт диски по заявкам, metrics-server отдаёт цифры потребления для автомасштабирования, Flux применяет манифесты из Git, а Prometheus с поставщиками метрик считает алерты. Когда что-то не работает, вопрос всегда один: на каком звене одной из двух цепочек всё остановилось и какой компонент отвечает за это звено.',
        'The whole cluster rests on one rule: components do not talk to each other directly, only through the [[k8s.apiserver|API server]]. You write the [[k8s.desired-state|desired state]] there, the API server stores it in [[k8s.etcd|etcd]], and every other component watches its objects through the API server and takes a step towards the desired state. Each of them is built as a [[k8s.controller|controller]]: it looks at what is wanted, looks at what exists and removes the difference.\n\nSo any change goes along the same chain. A Deployment object reaches the API server, the controllers in kube-controller-manager create a ReplicaSet and pods for it, the [[k8s.scheduler|scheduler]] assigns each pod a node, the [[k8s.kubelet|kubelet]] on that node has the container runtime start the container, and the [[k8s.cni|network plugin]] gives the pod an address. A user’s request goes along the second chain. The office or cloud DNS turns the site name into the address MetalLB or the cloud load balancer gave out, the [[k8s.kube-proxy|kube-proxy rules]] lead the request to the Traefik ingress controller, and Traefik finds the right Service by the site name and sends the request to one of that Service’s pods. Inside the cluster, [[k8s.cluster-dns|CoreDNS]] turns Service names into addresses.\n\nThe other layers are [[k8s.addon|add-ons]]. They run as pods in the same cluster, and most of them are built like Kubernetes’s own components, watching their objects through the API server. Of these, cert-manager issues certificates, the CSI driver creates disks for claims, metrics-server serves usage numbers for autoscaling, Flux applies manifests from Git, and Prometheus with its metric sources evaluates alerts. When something does not work, the question is always the same: at which link of one of the two chains did everything stop, and which component is responsible for that link.',
      ),
    },
    {
      id: 'lvl-b',
      kind: 'callout',
      tone: 'note',
      levels: ['beginner'],
      title: bi('Если названия компонентов забылись', 'If the component names have slipped away'),
      body: bi(
        'Забыть их нормально, потому что компонентов много, а блоки о Kubernetes были давно. Нажмите на любой блок в конструкторе ниже, и откроется карточка, в которой сказано, что этот компонент делает, кто его ставит, с кем он говорит и что будет, если его убрать. Ссылки в тексте выше открывают определения понятий. Перечитывать уроки целиком не нужно. Соберите кластер, читая карточки, и названия вернутся.',
        'That is normal: there are many components, and the Kubernetes blocks were a while ago. Press any block in the constructor below, and its card opens, saying what the component does, who installs it, whom it talks to and what happens without it. The links in the text above open the definitions. There is no need to reread whole lessons: assemble the cluster while reading the cards, and the names will come back.',
      ),
    },
    {
      id: 'lvl-e',
      kind: 'callout',
      tone: 'note',
      levels: ['experienced'],
      title: bi('Если вы уверенно знаете устройство кластера', 'If you know the cluster well'),
      body: bi(
        'Сборку можно пропустить: нажмите в конструкторе «Собрать всё правильно» и сразу переходите к ремонту ниже. В ремонте сначала прочитайте вывод и назовите причину про себя, а уже потом смотрите на варианты, потому что варианты нарочно составлены из заблуждений, в которые попадают на настоящих поломках. После каждой поломки прочитайте рецепт для настоящего кластера: в нём команды для kubeadm и k3s, которые пригодятся на экзамене и на собеседовании.',
        'You may skip the assembly: press “Assemble everything correctly” in the constructor and go straight to the repair below. In the repair, read the output and name the cause to yourself first, and only then look at the options, because the options are made on purpose from the misconceptions people fall into on real failures. After each fault read the recipe for a real cluster: it has the kubeadm and k3s commands that will be useful at the exam and at an interview.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как выглядит конструктор со всеми слоями', 'What the constructor with every layer looks like'),
      body: bi(
        'Это тот же конструктор, что в блоке о Kubernetes, только холст теперь пустой, и кластер собираете вы. Над холстом стоит палитра: у каждого из девяти слоёв свой цвет, название и список блоков. Холст разделён на три зоны. Вверху управляющий слой, посередине узлы с агентом и сетью кластера, внизу дополнения, которые работают подами на тех же узлах. Сплошная линия между блоками обозначает провод к API-серверу, и на ней подписано, что по нему идёт. Дополнения тренажёр подключает к API-серверу сам, общей серой шиной справа. Пунктирные стрелки показывают, кто кому передаёт данные помимо API, а бледный блок с пунктирной рамкой принадлежит выключенному слою.',
        'This is the same constructor as in the Kubernetes block, only the canvas is empty now, and you assemble the cluster. Above the canvas is the palette: each of the nine layers has its colour, name and list of blocks. The canvas has three zones: the control plane on top, the nodes with the node agent and the cluster network in the middle, and the add-ons that run as pods on those nodes at the bottom. A solid line between blocks is a wire to the API server, labelled with what goes over it. The trainer wires add-ons to the API server itself, with the grey bus on the right. Dashed arrows show who hands data to whom besides the API, and a dimmed block with a dashed outline belongs to a layer that is off.',
      ),
    },
    {
      id: 'howto-build',
      kind: 'text',
      role: 'howto',
      step: 'try',
      body: bi(
        'Ставьте блоки слой за слоем в том порядке, в котором идёт цепочка изменения: сначала kube-apiserver и etcd, потом планировщик и kube-controller-manager, затем kubelet, рантайм и сетевой плагин, и только потом дополнения. Блок ставится нажатием в палитре или перетаскиванием на холст. Чтобы провести провод, нажмите на один блок на холсте, затем на другой, и если такого соединения в настоящем кластере нет, конструктор объяснит почему.\n\nПосле каждого слоя запускайте сценарий этого слоя кнопкой под холстом, например «Deployment на 3 реплики» после управляющего слоя или «Запрос к Service по имени» после сети. Вывод покажет, чего кластеру ещё не хватает, и строка под ним назовёт недостающий компонент. Когда все сценарии пройдут, кластер собран.',
        'Place the blocks layer by layer in the order of the change chain: first kube-apiserver and etcd, then the scheduler and kube-controller-manager, then the kubelet, the runtime and the network plugin, and only then the add-ons. Place a block by pressing it in the palette or dragging it onto the canvas. To draw a wire, press one block on the canvas, then another; if there is no such connection in a real cluster, the constructor explains why.\n\nAfter each layer run that layer’s scenario with its button under the canvas, such as “Deployment with 3 replicas” after the control plane or “A request to a Service by name” after the network. The output shows what the cluster still lacks, and the line under it names the missing component. When every scenario passes, the cluster is assembled.',
      ),
    },
    { id: 'constructor', kind: 'widget', step: 'try', widget: 'k8s.constructor', props: { preset: 'empty', layers: 'all' } },
    {
      id: 'method',
      kind: 'text',
      step: 'explain',
      title: bi('Как искать поломку по слоям', 'How to look for a fault layer by layer'),
      body: bi(
        'Ремонт идёт по тем же цепочкам, что и сборка, только от симптома к причине. Сначала выясните, какая из двух цепочек оборвалась: не создаются или не запускаются поды, значит, цепочка изменения, а поды работают, но запрос до них не доходит, значит, цепочка запроса. Затем идите по звеньям этой цепочки и у каждого звена ищите улику в выводе kubectl. Проверьте по очереди, есть ли объект, есть ли у него ReplicaSet и поды, назначен ли подам узел, готовы ли узлы, есть ли у сервиса адрес и отвечает ли он по адресу и по имени. Первое звено, у которого улика плохая, и есть место поломки.\n\nДве ошибки встречаются чаще всего. Первая ошибка состоит в том, чтобы принять самый заметный симптом за причину. Поды в Pending выглядят как беда планировщика, но если все узлы NotReady, планировщик работает правильно, а сломан агент узла. Вторая ошибка состоит в перезапуске наугад. Перезапуск не возвращает компонент, которого нет, и не исправляет его настройки, зато останавливает то, что ещё работало, и стирает улики. Перезапуск уместен только тогда, когда вы уже знаете, что и почему перезапускаете.',
        'Repair follows the same chains as assembly, only from symptom to cause. First find out which of the two chains broke: if pods are not created or do not start, it is the change chain, and if pods run but the request does not reach them, it is the request chain. Then walk the links of that chain and look for evidence at each link in kubectl output: does the object exist, are there a ReplicaSet and pods, do the pods have a node, are the nodes ready, does the Service have an address, does it answer by address and by name. The first link with bad evidence is where the fault is.\n\nTwo mistakes are the most common. The first is taking the most visible symptom for the cause. Pending pods look like the scheduler’s trouble, but if every node is NotReady, the scheduler works correctly and the node agent is broken. The second mistake is restarting at random. A restart does not bring back a component that is missing and does not fix its settings, but it stops what still worked and wipes the evidence. A restart is appropriate only when you already know what you are restarting and why.',
      ),
    },
    {
      id: 'howto-repair',
      kind: 'text',
      role: 'howto',
      step: 'practice',
      body: bi(
        'Поломки разложены по вкладкам, по одной на каждый слой, и идут в том же порядке, в котором вы собирали кластер. Прочитайте жалобу и нажмите «Выполнить команды на сломанном кластере»: тренажёр выполнит команды на учебном кластере, в котором не работает один компонент, и покажет их настоящий вывод. Ошибки в этом выводе ожидаемы, потому что кластер сломан нарочно, и сломать что-нибудь ещё вы не можете: каждая вкладка работает на своей учебной копии. Найдите в выводе звено, на котором остановилась цепочка, и выберите компонент. Если выбор неверный, под вариантами появится объяснение, почему этот компонент исправен, и можно выбрать снова. После верного ответа прочитайте, как проверить и починить такую поломку на настоящем кластере, нажмите «Починить и выполнить те же команды» и сравните вывод с тем, что был до ремонта. Пройденные вкладки отмечаются галочкой, и отметки сохраняются в этом браузере.',
        'The faults are on tabs, one per layer, in the same order in which you assembled the cluster. Read the complaint and press “Run the commands on the broken cluster”: the trainer runs the commands on a training cluster in which one component does not work and shows their real output. Errors in that output are expected, because the cluster is broken on purpose, and you cannot break anything else: every tab works on its own training copy. Find in the output the link where the chain stopped and choose the component. If the choice is wrong, an explanation of why that component works appears under the options, and you can choose again. After the right answer read how to check and repair such a fault on a real cluster, press “Repair and run the same commands” and compare the output with the one before the repair. Finished tabs get a tick, and the ticks are saved in this browser.',
      ),
    },
    { id: 'repair', kind: 'widget', step: 'practice', widget: 'career.cluster-repair' },
    {
      id: 'interview',
      kind: 'text',
      step: 'review',
      title: bi('Как эта карта пригодится на экзамене и на собеседовании', 'How this map helps at the exam and at an interview'),
      body: bi(
        'На этапе Б итогового экзамена вам достанется одна поломка, и искать её нужно тем же путём: по жалобе выбрать цепочку, пройти её звенья по уликам и только потом чинить. На собеседовании карта нужна для двух самых частых вопросов о Kubernetes. На вопрос «что происходит, когда вы выполняете `kubectl apply`» отвечайте цепочкой изменения, называя, кто что делает и что передаёт дальше. На вопрос «под не запускается, что вы будете делать» отвечайте той же цепочкой в обратную сторону: какую команду вы выполните на каждом звене и что в её выводе будет уликой. Ниже собраны следы, которые оставила каждая поломка этого урока. Список удобно держать под рукой на первых дежурствах:\n\n- **Deployment есть, а ReplicaSet и подов нет.** Не работают контроллеры, и проверять нужно поды управляющего слоя командой `kubectl -n kube-system get pods`.\n- **Поды в Pending, а узлы NotReady.** Не работает агент узла, и на узле нужно выполнить `systemctl status kubelet`.\n- **По адресу ClusterIP сервис отвечает, а по имени нет.** Не работает DNS кластера, и смотреть нужно на поды CoreDNS командой `kubectl -n kube-system get pods -l k8s-app=kube-dns`.\n- **У сервиса LoadBalancer в EXTERNAL-IP стоит «<pending>».** Адрес никто не выдал, и проверять нужно MetalLB командой `kubectl -n metallb-system get pods` или балансировщик облака.\n- **Сайт отдаёт самоподписанный сертификат.** Сертификат не выпущен, и его состояние покажет `kubectl get certificate -A`.\n- **Заявка PVC остаётся в Pending.** Диск не создан, и причину назовут события в выводе `kubectl describe pvc`.\n- **HPA показывает <unknown>.** Не отвечает Metrics API, и первым это покажет `kubectl top pods`.\n- **Коммит в Git ничего не изменил в кластере.** Манифесты никто не применяет, и состояние выкладки покажет `kubectl get kustomization -A`.\n- **Алерт молчит, хотя поломка есть.** Для правила нет метрики, и искать её поставщика нужно на странице Status → Targets в Prometheus.',
        'At stage B of the final exam you get one fault, and you look for it the same way: choose the chain from the complaint, walk its links by evidence, and only then repair. At an interview the map serves the two most frequent Kubernetes questions. To “what happens when you run `kubectl apply`” answer with the change chain, naming who does what and what is handed on. To “a pod does not start, what do you do” answer with the same chain backwards: which command you run at each link and what in its output is the evidence. Below are the traces each fault of this lesson left. The list is handy to keep at hand on your first shifts:\n\n- **A Deployment exists, but no ReplicaSet and no pods.** The controllers do not work; check the control-plane pods with `kubectl -n kube-system get pods`.\n- **Pods are Pending, and the nodes are NotReady.** The node agent does not work; run `systemctl status kubelet` on a node.\n- **The Service answers at its ClusterIP but not by name.** Cluster DNS does not work; look at the CoreDNS pods with `kubectl -n kube-system get pods -l k8s-app=kube-dns`.\n- **A LoadBalancer Service shows “<pending>” in EXTERNAL-IP.** Nobody gave out an address; check MetalLB with `kubectl -n metallb-system get pods`, or the cloud load balancer.\n- **The site presents a self-signed certificate.** The certificate was not issued; `kubectl get certificate -A` shows its state.\n- **A PVC stays Pending.** The disk was not created; the events in `kubectl describe pvc` name the cause.\n- **The HPA shows <unknown>.** The Metrics API does not answer; `kubectl top pods` shows it first.\n- **A Git commit changed nothing in the cluster.** Nobody applies the manifests; `kubectl get kustomization -A` shows the state of the deploy.\n- **An alert stays silent although something is broken.** The rule has no metric; look for its source on the Status → Targets page in Prometheus.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: MAP_QUIZ.map((q) => q.id) },
  ],
};
