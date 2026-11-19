// The Kubernetes networking section (05 §4.3 KN1–KN8, R9): the network
// model and CNI, pod to pod on one node and across nodes, Services and
// kube-proxy, cluster DNS, the way in from outside, NetworkPolicy and the
// ladder "a pod cannot reach a service".

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import type { K8sFacts } from '../../../engine/kube-lite/facts';
import { DNS_LAB, INGRESS_LAB, SERVICE_BROKEN, SERVICE_LAB, TROUBLE_LAB } from '../setups';
import { R, S, src } from '../sources';

const k8s = (f: Facts) => f.k8s as K8sFacts;

// ── KN1–KN3 ─────────────────────────────────────────────────────────────────

export const networkQuiz: QuizItem[] = [
  {
    id: 'k8s.q.net.rules',
    kind: 'multi',
    concepts: ['k8s.network-model'],
    prompt: bi('Что обещает сетевая модель Kubernetes? Отметьте всё верное.', 'What does the Kubernetes network model promise? Mark everything that is true.'),
    options: [
      { id: 'ip', text: bi('У каждого пода свой IP во всём кластере', 'Every pod has its own cluster-wide IP'), correct: true },
      { id: 'nonat', text: bi('Поды говорят друг с другом без NAT', 'Pods talk to each other without NAT'), correct: true },
      { id: 'ports', text: bi('Порты подов надо пробрасывать на узел, как в Docker', 'Pod ports must be published on the node, as in Docker'), why: bi('Именно этого модель и избегает: при сотнях подов порты узлов конфликтовали бы, а приложению пришлось бы знать адрес узла.', 'That is exactly what the model avoids: with hundreds of pods the node ports would clash and the application would have to know the node address.') },
      { id: 'ns', text: bi('Поды разных namespace Kubernetes не видят друг друга', 'Pods in different Kubernetes namespaces cannot see each other'), why: bi('По умолчанию видят: namespace — граница имён и прав, а не сети. Сеть ограничивают отдельные сетевые политики — о них в конце раздела.', 'By default they can: a namespace is a boundary of names and permissions, not of the network. Separate network policies restrict the network — they come at the end of this section.') },
    ],
  },
  {
    id: 'k8s.q.net.masq',
    kind: 'mcq',
    concepts: ['k8s.cni'],
    prompt: bi('Почему внешний сервис видит в запросах от пода адрес узла, а не 10.42.x.x?', 'Why does an external service see the node address in requests from a pod, not 10.42.x.x?'),
    options: [
      { id: 'masq', text: bi('Исходящий трафик за пределы сети подов проходит MASQUERADE на узле', 'Traffic leaving the pod network is MASQUERADEd on the node'), correct: true },
      { id: 'proxy', text: bi('Все запросы наружу идут через kube-proxy', 'All outgoing requests go through kube-proxy'), why: bi('kube-proxy занимается только адресами Service. Подмену источника делает правило NAT, которое пишет CNI.', 'kube-proxy handles only Service addresses. The source rewrite is a NAT rule the CNI writes.') },
      { id: 'dns', text: bi('Так настроен DNS кластера', 'The cluster DNS is configured that way'), why: bi('DNS превращает имена в адреса и к адресу источника пакета отношения не имеет.', 'DNS turns names into addresses and has nothing to do with the source address of a packet.') },
    ],
    explain: bi('Адреса 10.42.0.0/16 существуют только внутри кластера; ответ на них снаружи не вернулся бы. Поэтому узел подменяет источник на свой IP.', 'The 10.42.0.0/16 addresses exist only inside the cluster; a reply to them from outside would never come back. So the node rewrites the source to its own IP.'),
  },
  {
    id: 'k8s.q.net.vxlan',
    kind: 'mcq',
    concepts: ['k8s.cni', 'k8s.podcidr'],
    prompt: bi('Узлы в разных подсетях облака, CNI в режиме host-gw. Пинг между подами одного узла есть, между узлами — нет. Почему?', 'The nodes are in different cloud subnets, the CNI is in host-gw mode. Ping between pods on one node works, between nodes it does not. Why?'),
    options: [
      { id: 'hop', text: bi('host-gw делает следующим хопом другой узел, а он не сосед по L2', 'host-gw makes the other node the next hop, and it is not an L2 neighbour'), correct: true },
      { id: 'mtu', text: bi('Слишком маленький MTU', 'The MTU is too small'), why: bi('MTU мешал бы только большим пакетам; маленький ping прошёл бы.', 'The MTU would only hurt big packets; a small ping would pass.') },
      { id: 'dns', text: bi('Не работает CoreDNS', 'CoreDNS does not work'), why: bi('Пинг по IP DNS не использует.', 'A ping by IP does not use DNS.') },
    ],
    explain: bi('Для узлов в разных подсетях нужен «конверт в конверте» — VXLAN: пакет пода едет внутри обычного UDP между узлами.', 'Nodes in different subnets need an "envelope in an envelope" — VXLAN: the pod packet rides inside ordinary UDP between the nodes.'),
    refs: { explainer: 'k8s.pod-network' },
  },
];

export const networkLesson: Lesson = {
  id: 'k8s-1.network',
  block: 'k8s-1',
  title: bi('Сетевая модель Kubernetes и пакет из пода в под', 'The Kubernetes network model and a packet from pod to pod'),
  summary: bi('Почему в кластере нет -p; четыре правила модели; CNI, который их выполняет; мост на одном узле, маршрут или VXLAN между узлами.', 'Why a cluster has no -p; the four rules of the model; the CNI that fulfils them; a bridge on one node, a route or VXLAN between nodes.'),
  introduces: ['k8s.network-model', 'k8s.cni', 'k8s.podcidr'],
  uses: ['k8s.pod', 'k8s.node', 'k8s.sandbox', 'k8s.kubelet'],
  tier: 'core',
  minutes: 40,
  sources: src([S.networking, S.flannel, S.cri], [R.components, R.wikiVxlan]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В Docker вы открывали контейнер миру флагом `-p 8080:80`: ядро узла подменяло адрес назначения (DNAT) и отправляло пакет в контейнер. Представьте сотню подов на трёх узлах: каждому нужен свой порт узла, порты конфликтуют, а приложению, чтобы позвать соседа, надо знать, на каком узле и каком порту он сегодня. Kubernetes устроен иначе: у пода нет «проброшенного порта», у него есть свой адрес.',
        'In Docker you opened a container to the world with `-p 8080:80`: the node kernel rewrote the destination address (DNAT) and sent the packet into the container. Picture a hundred pods on three nodes: each needs its own node port, the ports clash, and an application has to know which node and port its neighbour uses today. Kubernetes works differently: a pod has no "published port", it has its own address.',
      ),
    },
    {
      id: 'model',
      kind: 'text',
      step: 'explain',
      title: bi('Четыре правила', 'Four rules'),
      body: bi(
        '[[k8s.network-model|Сетевая модель Kubernetes]] — это не программа, а обещание из четырёх пунктов (страница *Cluster Networking*):\n\n- у каждого пода свой IP-адрес во всём кластере;\n- поды разговаривают друг с другом напрямую, без NAT и прокси, на одном узле и на разных;\n- агенты узла (например, kubelet) достают до подов своего узла;\n- под видит себя под тем же адресом, под которым его видят другие.\n\nВсе контейнеры пода живут в одном сетевом пространстве имён — том, что держит песочница (pause). Поэтому IP принадлежит поду, а не контейнеру, и контейнеры пода говорят друг с другом через `localhost`.\n\nКто выполняет обещание? Не Kubernetes. Его выполняет сетевой плагин — [[k8s.cni|CNI]] (Container Network Interface). Когда рантайм создаёт песочницу, он запускает плагин с командой `ADD`: плагин создаёт пару veth, один конец кладёт в namespace пода, другой — в мост `cni0` узла, выдаёт адрес и прописывает маршрут. Адреса берутся из [[k8s.podcidr|podCIDR]] — подсети, которую control plane выдал узлу: в k3s у первого узла `10.42.0.0/24`, у второго `10.42.1.0/24`. Межузловую часть плагин строит по-разному: flannel, Calico, Cilium — разные исполнители одной модели.',
        'The [[k8s.network-model|Kubernetes network model]] is not a program but a promise of four points (the *Cluster Networking* page):\n\n- every pod has its own IP address across the whole cluster;\n- pods talk to each other directly, without NAT or proxies, on one node and across nodes;\n- agents on a node (the kubelet, for example) can reach the pods of their node;\n- a pod sees itself at the same address others see it at.\n\nAll the containers of a pod live in one network namespace — the one the sandbox (pause) holds. So the IP belongs to the pod, not the container, and the containers of a pod talk to each other through `localhost`.\n\nWho keeps the promise? Not Kubernetes. A network plugin does — the [[k8s.cni|CNI]] (Container Network Interface). When the runtime creates the sandbox, it runs the plugin with the `ADD` command: the plugin creates a veth pair, puts one end into the pod namespace and the other into the node’s `cni0` bridge, assigns an address and adds a route. Addresses come from the [[k8s.podcidr|podCIDR]] — the subnet the control plane gave the node: in k3s the first node has `10.42.0.0/24`, the second `10.42.1.0/24`. The cross-node part is built differently by each plugin: flannel, Calico, Cilium are different executors of one model.',
      ),
    },
    { id: 'look-same', kind: 'explainer', step: 'look', explainer: 'k8s.pod-network', params: { target: 'same', mode: 'host-gw' }, caption: bi('Сначала соседи по узлу: мост, и всё. Потом переключите «куда» на другой узел.', 'First the neighbours on one node: a bridge, and that is all. Then switch "where to" to another node.') },
    {
      id: 'across',
      kind: 'text',
      step: 'explain',
      title: bi('Между узлами: маршрут или конверт', 'Between nodes: a route or an envelope'),
      body: bi(
        'Пакет для чужого podCIDR мост отдаёт ядру узла, а дальше есть два пути.\n\n**Маршрут (host-gw).** Узел — маршрутизатор подсети своих подов. На worker-1 есть маршрут `10.42.1.0/24 via 192.168.56.12`: пакеты для подов второго узла отправляются прямо на второй узел. Просто и быстро, но работает, только если узлы — соседи в одной сети: следующий хоп должен быть достижим напрямую.\n\n**Конверт в конверте (VXLAN).** Пакет пода целиком кладётся внутрь нового пакета: снаружи — адреса узлов и UDP-порт 8472, внутри — по-прежнему `10.42.0.15 → 10.42.1.20`. Сети между узлами незачем знать адреса подов — она видит обычный UDP. Это туннель из блока о сетях. Цена — 50 байт на обёртку, поэтому MTU подов делают 1450, и межсетевой экран облака должен пропускать UDP 8472 между узлами.\n\nКогда трафик пода уходит за пределы `10.42.0.0/16` — в интернет, — узел подменяет источник на свой адрес (MASQUERADE): ответ на адрес пода снаружи не нашёл бы дороги назад.',
        'A packet for another podCIDR is handed by the bridge to the node kernel, and from there there are two ways.\n\n**A route (host-gw).** A node is the router of its own pods’ subnet. worker-1 has the route `10.42.1.0/24 via 192.168.56.12`: packets for the second node’s pods go straight to the second node. Simple and fast, but it works only if the nodes are neighbours on one network: the next hop must be directly reachable.\n\n**An envelope in an envelope (VXLAN).** The pod packet is put whole inside a new packet: outside — the node addresses and UDP port 8472, inside — still `10.42.0.15 → 10.42.1.20`. The network between the nodes need not know pod addresses — it sees ordinary UDP. This is the tunnel from the networks block. The price is 50 bytes of wrapping, so pod MTU is set to 1450, and the cloud firewall must allow UDP 8472 between nodes.\n\nWhen pod traffic leaves `10.42.0.0/16` — for the internet — the node replaces the source with its own address (MASQUERADE): a reply to a pod address from outside would never find its way back.',
      ),
    },
    { id: 'look-across', kind: 'explainer', step: 'look', explainer: 'k8s.pod-network', params: { target: 'other', mode: 'host-gw' }, caption: bi('Переключите способ доставки и «узлы в разных подсетях». Сломайте маршрут, закройте UDP 8472.', 'Switch the delivery mode and "nodes in different subnets". Break the route, close UDP 8472.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: SERVICE_LAB,
      intro: bi('Deployment `web` на три пода и под `client` с curl. `cluster ip route worker-1` и `cluster ip addr worker-1` показывают маршруты и адреса узла.', 'Deployment `web` with three pods and a pod `client` with curl. `cluster ip route worker-1` and `cluster ip addr worker-1` show the node’s routes and addresses.'),
      tasks: [
        {
          id: 'ips',
          prompt: bi('Посмотрите, какие IP получили поды и на каких они узлах.', 'Look at which IPs the pods got and which nodes they are on.'),
          check: { stdout: /IP\s+NODE[\s\S]*10\.42\.\d+\.\d+/ },
          chips: 'kubectl get pods -o wide',
          hints: { H1: bi('Вы уже делали это в первом уроке.', 'You did this in the first lesson.') },
        },
        {
          id: 'direct',
          prompt: bi('Из пода `client` обратитесь напрямую по IP к любому поду `web` — без всякого посредника — и получите ответ.', 'From pod `client`, reach any `web` pod directly by its IP — with no middleman — and get an answer.'),
          check: { stdout: /Hello from web-\w+-\w+ \(10\.42\.\d+\.\d+\)/ },
          chips: 'kubectl exec client -- curl -s http://<pod-ip>',
          concepts: ['k8s.network-model'],
          hints: { H1: bi('Команду внутри пода запускает kubectl exec; после `--` идёт сама команда.', 'kubectl exec runs a command inside a pod; the command goes after `--`.'), H2: bi('`kubectl exec client -- curl -s http://10.42.x.y`', '`kubectl exec client -- curl -s http://10.42.x.y`') },
        },
        {
          id: 'cidr',
          prompt: bi('Узнайте podCIDR узла `worker-1` и сохраните его в `~/cidr.txt`.', 'Find the podCIDR of node `worker-1` and save it to `~/cidr.txt`.'),
          check: { when: "files['/home/learner/cidr.txt'].text~'10.42.1.0/24'" },
          chips: "kubectl get node worker-1 -o jsonpath='{.spec.podCIDR}' > cidr.txt",
          concepts: ['k8s.podcidr'],
          docRef: { page: 'explain/node.spec', anchor: 'FIELDS', line: 'podCIDR' },
          hints: { H1: bi('podCIDR — поле spec объекта Node. Одно поле достаёт `-o jsonpath`.', 'podCIDR is a spec field of the Node object. `-o jsonpath` gets one field.') },
        },
        {
          id: 'route',
          prompt: bi('Посмотрите маршруты `worker-1`: как он отправляет пакеты в podCIDR других узлов?', 'Look at the routes of `worker-1`: how does it send packets to the other nodes’ podCIDRs?'),
          check: { stdout: /10\.42\.0\.0\/24 via 10\.42\.0\.0 dev flannel\.1/ },
          chips: 'cluster ip route worker-1',
          hints: { H1: bi('Это инструмент тренажёра: на настоящем узле то же покажет `ip route`.', 'This is a trainer tool: on a real node `ip route` shows the same.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: networkQuiz.map((q) => q.id) },
  ],
};

// ── KN4 Service ─────────────────────────────────────────────────────────────

export const serviceQuiz: QuizItem[] = [
  {
    id: 'k8s.q.svc.ip',
    kind: 'mcq',
    key: true,
    concepts: ['k8s.clusterip', 'k8s.kube-proxy'],
    prompt: bi('На каком интерфейсе узла висит ClusterIP 10.43.12.7?', 'Which node interface holds the ClusterIP 10.43.12.7?'),
    options: [
      { id: 'none', text: bi('Ни на каком: это адрес из правил kube-proxy в ядре узла', 'None: it is an address in kube-proxy’s rules in the node kernel'), correct: true },
      { id: 'cni0', text: bi('На мосте cni0', 'On the cni0 bridge'), why: bi('На cni0 висит шлюз подов узла (10.42.N.1). ClusterIP нет ни на одном интерфейсе — `ip a` его не покажет.', 'cni0 holds the node’s pod gateway (10.42.N.1). The ClusterIP is on no interface — `ip a` does not show it.') },
      { id: 'pod', text: bi('На интерфейсе одного из подов Service', 'On the interface of one of the Service pods'), why: bi('У подов свои адреса 10.42.x.x; адрес Service подменяется на один из них уже в ядре узла клиента.', 'Pods have their own 10.42.x.x addresses; the Service address is replaced with one of them in the client node’s kernel.') },
    ],
    explain: bi('Пакет на ClusterIP перехватывает цепочка KUBE-SERVICES ещё до маршрутизации и делает DNAT на IP пода. Исключение — устаревший режим IPVS, где адрес висит на фиктивном kube-ipvs0.', 'A packet to the ClusterIP is caught by the KUBE-SERVICES chain before routing and DNATed to a pod IP. The exception is the deprecated IPVS mode, where the address sits on the dummy kube-ipvs0.'),
    refs: { explainer: 'k8s.service-path' },
  },
  {
    id: 'k8s.q.svc.targetport',
    kind: 'bugfind',
    concepts: ['k8s.service'],
    prompt: bi('Приложение в подах слушает порт 80. Service не отвечает. Где ошибка?', 'The application in the pods listens on port 80. The Service does not answer. Where is the bug?'),
    code: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: web\nspec:\n  selector:\n    app: web\n  ports:\n  - port: 80\n    targetPort: 8080',
    lang: 'yaml',
    bug: [10],
    why: {
      7: bi('Селектор верный: поды помечены app=web.', 'The selector is right: the pods are labelled app=web.'),
      9: bi('port — порт самого Service; клиенты ходят на 80, это нормально.', 'port is the port of the Service itself; clients use 80, that is fine.'),
      10: bi('Service шлёт на targetPort, а процесс слушает 80: под ответит RST. containerPort в описании пода — только справка, на маршрут она не влияет.', 'The Service sends to targetPort, but the process listens on 80: the pod answers RST. containerPort in the pod description is only information, it does not affect the route.'),
    },
  },
  {
    id: 'k8s.q.svc.prob',
    kind: 'mcq',
    concepts: ['k8s.kube-proxy', 'k8s.endpointslice'],
    prompt: bi('У Service три готовых пода. Какие вероятности у правил KUBE-SEP в iptables?', 'A Service has three ready pods. What probabilities do the KUBE-SEP rules have in iptables?'),
    options: [
      { id: 'right', text: '0.33333, 0.50000, (no condition)', correct: true },
      { id: 'equal', text: '0.33333, 0.33333, 0.33333', why: bi('Правила проверяются по очереди: второе видит только две трети пакетов, поэтому ему нужна половина от остатка; третье берёт всё, что осталось.', 'The rules are tried in turn: the second sees only two thirds of the packets, so it needs half of what is left; the third takes everything that remains.') },
    ],
    explain: bi('1/3, затем 1/2 от оставшихся 2/3 = 1/3, затем остаток 1/3 — доли равны.', '1/3, then 1/2 of the remaining 2/3 = 1/3, then the rest 1/3 — the shares are equal.'),
  },
  {
    id: 'k8s.q.svc.unequal',
    kind: 'mcq',
    concepts: ['k8s.service'],
    prompt: bi('У Service пять подов, а почти весь трафик клиента приходит на один. Самая частая причина?', 'A Service has five pods, yet almost all of a client’s traffic lands on one. The most common reason?'),
    options: [
      { id: 'keepalive', text: bi('Клиент держит соединение (keep-alive): под выбирается при установке соединения', 'The client keeps its connection (keep-alive): the pod is chosen when the connection is set up'), correct: true },
      { id: 'broken', text: bi('kube-proxy сломан', 'kube-proxy is broken'), why: bi('Сломанный kube-proxy не давал бы отвечать вовсе, а не перекашивал доли.', 'A broken kube-proxy would stop answers altogether, not skew the shares.') },
    ],
  },
];

export const servicesLesson: Lesson = {
  id: 'k8s-1.services',
  block: 'k8s-1',
  title: bi('Service: постоянный адрес для смертных подов', 'A Service: a permanent address for mortal pods'),
  summary: bi('Service и ClusterIP, EndpointSlice, kube-proxy и правила ядра; почему балансировка бывает неравной и как ломается Service.', 'The Service and its ClusterIP, the EndpointSlice, kube-proxy and the kernel rules; why balancing can look unequal and how a Service breaks.'),
  introduces: ['k8s.service', 'k8s.endpointslice', 'k8s.kube-proxy', 'k8s.clusterip'],
  uses: ['k8s.label', 'k8s.pod', 'k8s.network-model', 'k8s.controller'],
  tier: 'core',
  minutes: 45,
  sources: src([S.service, S.slices, S.vip], [R.service, R.wikiIptables]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Удалите под — замена придёт с другим IP. Выкатите новую версию — все IP сменятся. Ходить к подам по адресам нельзя. Нужен адрес, который живёт дольше подов, и имя, которое знают все.',
        'Delete a pod — the replacement comes with another IP. Roll out a new version — every IP changes. You cannot reach pods by their addresses. You need an address that outlives the pods, and a name everyone knows.',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Service, EndpointSlice, kube-proxy', 'Service, EndpointSlice, kube-proxy'),
      body: bi(
        '[[k8s.service|Service]] — объект с селектором и портами: «поды app=web, порт 80 → targetPort 80». При создании он получает [[k8s.clusterip|ClusterIP]] из диапазона `10.43.0.0/16`, и этот адрес не меняется, сколько бы поды ни приходили и уходили.\n\nКто знает, какие поды сейчас стоят за Service? Контроллер EndpointSlice: он ищет поды по селектору и пишет их адреса в объект [[k8s.endpointslice|EndpointSlice]] — с пометкой, готов ли каждый (`ready`). (Старый объект Endpoints делал то же, но объявлен устаревшим; kubectl предупредит, если спросить его.)\n\nА кто превращает адрес Service в адрес пода? Не сам Service — он лишь запись. На каждом узле работает [[k8s.kube-proxy|kube-proxy]]: он смотрит Service и EndpointSlice и пишет в ядро узла правила netfilter. Пакет на `10.43.12.7:80` попадает в цепочку `KUBE-SERVICES`, оттуда в `KUBE-SVC-…` этого Service, где правила с вероятностями выбирают одну из цепочек `KUBE-SEP-…`, а та делает DNAT на `10.42.1.15:80`. Ответ conntrack переводит обратно. ClusterIP нет ни на одном интерфейсе — это адрес, который существует только в правилах.\n\nОтсюда три типичные поломки. Селектор не совпадает с метками — EndpointSlice пуст, kube-proxy пишет правило `REJECT`, curl сразу получает «connection refused». Неверный `targetPort` — пакет приходит в под на порт, где никто не слушает, под отвечает RST. kube-proxy остановлен — старые правила живут, а для новых Service правил нет, и запрос висит до тайм-аута.',
        'A [[k8s.service|Service]] is an object with a selector and ports: "pods app=web, port 80 → targetPort 80". On creation it gets a [[k8s.clusterip|ClusterIP]] from the `10.43.0.0/16` range, and that address does not change however pods come and go.\n\nWho knows which pods stand behind the Service right now? The EndpointSlice controller: it finds pods by the selector and writes their addresses into an [[k8s.endpointslice|EndpointSlice]] object — with a flag saying whether each is ready (`ready`). (The old Endpoints object did the same but is deprecated; kubectl warns you if you ask for it.)\n\nAnd who turns the Service address into a pod address? Not the Service itself — it is just a record. Every node runs [[k8s.kube-proxy|kube-proxy]]: it watches Services and EndpointSlices and writes netfilter rules into the node kernel. A packet to `10.43.12.7:80` enters the `KUBE-SERVICES` chain, from there the `KUBE-SVC-…` chain of this Service, where rules with probabilities pick one of the `KUBE-SEP-…` chains, and that one DNATs to `10.42.1.15:80`. conntrack translates the reply back. The ClusterIP is on no interface — it is an address that exists only in rules.\n\nHence three typical breaks. The selector does not match the labels — the EndpointSlice is empty, kube-proxy writes a `REJECT` rule, and curl gets "connection refused" at once. A wrong `targetPort` — the packet arrives at a pod port where nobody listens, and the pod answers RST. kube-proxy is stopped — old rules live on, but new Services get no rules, and a request hangs until it times out.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.service-path', caption: bi('Двигайте replicas и смотрите, как пересчитываются вероятности. Включите keep-alive. Сломайте селектор и targetPort.', 'Move replicas and watch the probabilities recompute. Turn keep-alive on. Break the selector and the targetPort.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: SERVICE_LAB,
      intro: bi('Deployment `web` (3 пода) и под `client`. `cluster iptables worker-1` печатает NAT-таблицу узла, как `iptables-save -t nat`.', 'Deployment `web` (3 pods) and pod `client`. `cluster iptables worker-1` prints the node’s NAT table, like `iptables-save -t nat`.'),
      tasks: [
        {
          id: 'expose',
          prompt: bi('Дайте Deployment `web` постоянный адрес: Service `web` на порту 80.', 'Give Deployment `web` a permanent address: a Service `web` on port 80.'),
          check: { when: 'k8s.services[ns=default][name=web].endpoints=3' },
          chips: 'kubectl expose deployment web --port=80',
          concepts: ['k8s.service'],
          docRef: { page: 'help/kubectl-expose', anchor: 'EXAMPLES', line: 'kubectl expose deployment nginx --port=80 --target-port=8000' },
          hints: { H1: bi('Service для существующего Deployment создаёт kubectl expose.', 'kubectl expose creates a Service for an existing Deployment.') },
        },
        {
          id: 'curl',
          prompt: bi('Из пода `client` обратитесь к Service по имени `web` и получите ответ.', 'From pod `client`, reach the Service by the name `web` and get an answer.'),
          check: { when: "k8s.reach[from='default/client'][to='web.default'].status=200", stdout: /Hello from web-/ },
          chips: 'kubectl exec client -- curl -s http://web',
          hints: { H1: bi('Имя Service работает как имя хоста.', 'The Service name works as a host name.') },
        },
        {
          id: 'slices',
          prompt: bi('Увеличьте Deployment до 5 подов и убедитесь, что в EndpointSlice Service стало 5 адресов.', 'Scale the Deployment to 5 pods and make sure the Service’s EndpointSlice now has 5 addresses.'),
          check: { when: 'k8s.services[ns=default][name=web].endpoints=5', stdout: /web-\w+\s+IPv4\s+80\s+.*\+ 2 more/ },
          chips: 'kubectl scale deployment web --replicas=5 && kubectl get endpointslices -l kubernetes.io/service-name=web',
          concepts: ['k8s.endpointslice'],
          hints: { H1: bi('EndpointSlice Service находят по метке kubernetes.io/service-name.', 'A Service’s EndpointSlices are found by the label kubernetes.io/service-name.') },
        },
        {
          id: 'rule',
          prompt: bi('Найдите в NAT-таблице узла правило, которое перехватывает ClusterIP Service `web`, и сохраните его строку в `~/rule.txt`.', 'Find the rule in the node’s NAT table that catches the ClusterIP of Service `web`, and save its line to `~/rule.txt`.'),
          check: { when: "files['/home/learner/rule.txt'].text~'-A KUBE-SERVICES' && files['/home/learner/rule.txt'].text~'default/web cluster IP'" },
          chips: 'cluster iptables worker-1 | grep "default/web cluster IP" | grep KUBE-SERVICES > rule.txt',
          concepts: ['k8s.kube-proxy', 'k8s.clusterip'],
          hints: { H1: bi('ClusterIP покажет `kubectl get svc web`; правило — цепочка KUBE-SERVICES.', '`kubectl get svc web` shows the ClusterIP; the rule is in the KUBE-SERVICES chain.'), H2: bi('Отфильтруйте вывод `cluster iptables worker-1` через grep и перенаправьте в файл.', 'Filter the output of `cluster iptables worker-1` through grep and redirect it into the file.') },
        },
        {
          id: 'affinity',
          prompt: bi('Найдите в `kubectl explain service.spec` поле, которое закрепляет клиента за одним подом, и включите его для `web` (по IP клиента).', 'Find in `kubectl explain service.spec` the field that pins a client to one pod, and turn it on for `web` (by client IP).'),
          check: { when: 'k8s.objects[kind=Service][metadata.name=web].spec.sessionAffinity=ClientIP' },
          chips: 'kubectl patch service web -p \'{"spec":{"sessionAffinity":"ClientIP"}}\'',
          docRef: { page: 'explain/service.spec', anchor: 'FIELDS', line: 'sessionAffinity' },
          docStep: 3,
          hints: { H1: bi('Поле ищите в разделе FIELDS; поменять одно поле можно kubectl patch.', 'Look for the field in the FIELDS section; kubectl patch changes one field.') },
        },
      ],
    },
    {
      id: 'broken',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: SERVICE_BROKEN,
      intro: bi('Namespace `prod`: Deployment `api` (2 пода) и Service `api`, который не отвечает.', 'Namespace `prod`: Deployment `api` (2 pods) and a Service `api` that does not answer.'),
      tasks: [
        {
          id: 'fix',
          prompt: bi('Service `api` в namespace `prod` не отвечает. Почините его, не пересоздавая поды.', 'Service `api` in namespace `prod` does not answer. Fix it without recreating the pods.'),
          check: {
            when: (f, start) => {
              const s = k8s(f).services.find((x) => x.ns === 'prod' && x.name === 'api');
              const uids = (x?: Facts) => (x ? k8s(x).pods.filter((p) => p.ns === 'prod' && p.labels.app === 'api-v2').map((p) => p.uid).sort().join() : '');
              return !!s && s.endpoints >= 2 && (!start || uids(f) === uids(start));
            },
            fail: [{ if: (f) => k8s(f).pods.filter((p) => p.ns === 'prod' && p.labels.app === 'api-v2').length < 2, say: bi('Поды пересоздавать не нужно: чинить надо Service, а не Deployment.', 'There is no need to recreate the pods: fix the Service, not the Deployment.') }],
          },
          chips: 'kubectl -n prod get endpointslices,svc,pods --show-labels',
          concepts: ['k8s.service', 'k8s.endpointslice'],
          hints: {
            H1: bi('Сравните, кого ищет Service, и какие метки у подов.', 'Compare whom the Service looks for with the labels the pods have.'),
            H2: bi('Пустой EndpointSlice означает, что селектор не нашёл ни одного пода.', 'An empty EndpointSlice means the selector found no pod.'),
            H3: bi('`kubectl -n prod get svc api -o wide` и `kubectl -n prod get pods --show-labels`; селектор правится `kubectl -n prod patch svc api -p …`.', '`kubectl -n prod get svc api -o wide` and `kubectl -n prod get pods --show-labels`; the selector is fixed with `kubectl -n prod patch svc api -p …`.'),
          },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: serviceQuiz.map((q) => q.id) },
  ],
};

// ── KN5 DNS ─────────────────────────────────────────────────────────────────

export const dnsQuiz: QuizItem[] = [
  {
    id: 'k8s.q.dns.name',
    kind: 'fill-command',
    concepts: ['k8s.cluster-dns'],
    prompt: bi('Под в namespace `shop`. Допишите имя, чтобы достучаться до Service `api` из namespace `prod`.', 'A pod in namespace `shop`. Complete the name to reach Service `api` in namespace `prod`.'),
    template: 'curl http://___',
    answers: ['curl http://api.prod', 'curl http://api.prod.svc', 'curl http://api.prod.svc.cluster.local', 'curl http://api.prod.svc.cluster.local.'],
    misconceptions: [{ match: 'http://api$', why: bi('Короткое имя дополняется namespace пода: api станет api.shop.svc.cluster.local, а такого Service нет.', 'A short name is completed with the pod’s namespace: api becomes api.shop.svc.cluster.local, and there is no such Service.') }],
  },
  {
    id: 'k8s.q.dns.ndots',
    kind: 'mcq',
    concepts: ['k8s.cluster-dns'],
    prompt: bi('С ndots:5 под резолвит api.github.com. Почему запросов к CoreDNS так много?', 'With ndots:5 a pod resolves api.github.com. Why are there so many queries to CoreDNS?'),
    options: [
      { id: 'search', text: bi('В имени меньше пяти точек, и резолвер сначала пробует его с каждым доменом search', 'The name has fewer than five dots, so the resolver first tries it with every search domain'), correct: true },
      { id: 'cache', text: bi('У CoreDNS выключен кэш', 'The CoreDNS cache is off'), why: bi('Кэш экономит работу CoreDNS, но перебор вариантов делает резолвер пода, а не сервер.', 'The cache saves CoreDNS work, but the walk over candidates is done by the pod resolver, not the server.') },
    ],
    explain: bi('Имя с точкой на конце (api.github.com.) абсолютное: search не применяется, уходит два запроса — A и AAAA.', 'A name with a trailing dot (api.github.com.) is absolute: search does not apply, two queries go out — A and AAAA.'),
    refs: { explainer: 'k8s.ndots' },
  },
];

export const dnsLesson: Lesson = {
  id: 'k8s-1.dns',
  block: 'k8s-1',
  title: bi('DNS кластера', 'Cluster DNS'),
  summary: bi('Имя Service, CoreDNS, список search и цена ndots.', 'A Service name, CoreDNS, the search list and the cost of ndots.'),
  introduces: ['k8s.cluster-dns'],
  uses: ['k8s.service', 'k8s.namespace', 'k8s.clusterip'],
  tier: 'core',
  minutes: 30,
  sources: src([S.dns], [R.dns, R.wikiDns]),
  sections: [
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Имя Service', 'A Service name'),
      body: bi(
        'В прошлом уроке curl ходил на `web` — и это работало. Работу сделал [[k8s.cluster-dns|DNS кластера]]: CoreDNS, запущенный подами в kube-system за Service `kube-dns` с адресом `10.43.0.10`. Он отвечает на имена вида `<service>.<namespace>.svc.cluster.local` адресом ClusterIP.\n\nКороткое имя дополняет сам под. kubelet пишет ему `/etc/resolv.conf`:\n\n```\nsearch shop.svc.cluster.local svc.cluster.local cluster.local\nnameserver 10.43.0.10\noptions ndots:5\n```\n\nИз пода в namespace `shop` имя `web` превращается в `web.shop.svc.cluster.local` — Service своего namespace. Чтобы позвать Service из другого namespace, нужно хотя бы `api.prod`.\n\nУ удобства есть цена. `ndots:5` значит: если в имени меньше пяти точек, сначала попробуй его со всеми доменами search. Для `api.github.com` это три лишних раунда A и AAAA с ответом NXDOMAIN, прежде чем дойдёт до настоящего имени. Точка на конце (`api.github.com.`) делает имя абсолютным и отключает перебор.',
        'In the previous lesson curl went to `web` — and it worked. The [[k8s.cluster-dns|cluster DNS]] did the job: CoreDNS, running as pods in kube-system behind the `kube-dns` Service at `10.43.0.10`. It answers names like `<service>.<namespace>.svc.cluster.local` with the ClusterIP.\n\nThe pod itself completes a short name. The kubelet writes its `/etc/resolv.conf`:\n\n```\nsearch shop.svc.cluster.local svc.cluster.local cluster.local\nnameserver 10.43.0.10\noptions ndots:5\n```\n\nFrom a pod in namespace `shop` the name `web` turns into `web.shop.svc.cluster.local` — the Service of its own namespace. To call a Service in another namespace you need at least `api.prod`.\n\nThe convenience has a price. `ndots:5` means: if the name has fewer than five dots, first try it with every search domain. For `api.github.com` that is three extra rounds of A and AAAA answered NXDOMAIN before the real name is tried. A trailing dot (`api.github.com.`) makes the name absolute and switches the walk off.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.ndots', caption: bi('Выбирайте имя и двигайте ndots — счётчик запросов пересчитывается.', 'Pick a name and move ndots — the query counter is recomputed.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: DNS_LAB,
      intro: bi('Под `client` живёт в namespace `shop`. Рядом Service `web` в `shop` и Service `api` в `prod`.', 'Pod `client` lives in namespace `shop`. Next to it: Service `web` in `shop` and Service `api` in `prod`.'),
      tasks: [
        {
          id: 'resolv',
          prompt: bi('Посмотрите, какой resolv.conf у пода `client`.', 'Look at the resolv.conf of pod `client`.'),
          check: { stdout: /search shop\.svc\.cluster\.local svc\.cluster\.local cluster\.local[\s\S]*ndots:5/ },
          chips: 'kubectl -n shop exec client -- cat /etc/resolv.conf',
          hints: { H1: bi('Под в namespace shop: не забудьте -n.', 'The pod is in namespace shop: do not forget -n.') },
        },
        {
          id: 'other-ns',
          prompt: bi('Из пода `client` получите ответ от Service `api` из namespace `prod`.', 'From pod `client`, get an answer from Service `api` in namespace `prod`.'),
          check: { stdout: /Hello from api-/, fail: [{ if: "term['main'][last].out~'Could not resolve host: api'", say: bi('Короткое имя `api` дополнилось до api.shop.svc.cluster.local — Service в shop с таким именем нет. Добавьте namespace к имени.', 'The short name `api` was completed to api.shop.svc.cluster.local — there is no such Service in shop. Add the namespace to the name.') }] },
          chips: 'kubectl -n shop exec client -- curl -s http://api.prod',
          concepts: ['k8s.cluster-dns'],
          hints: { H1: bi('Короткое имя ищется только в своём namespace.', 'A short name is looked up only in its own namespace.') },
        },
        {
          id: 'nslookup',
          prompt: bi('Узнайте через DNS адрес Service `kubernetes` из namespace `default`.', 'Find the address of Service `kubernetes` in namespace `default` through DNS.'),
          check: { stdout: /Name:\s+kubernetes\.default\.svc\.cluster\.local\s+Address: 10\.43\.0\.1/ },
          chips: 'kubectl -n shop exec client -- nslookup kubernetes.default',
          hints: { H1: bi('В поде client есть nslookup.', 'Pod client has nslookup.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: dnsQuiz.map((q) => q.id) },
  ],
};

// ── KN6 the way in ──────────────────────────────────────────────────────────

export const ingressQuiz: QuizItem[] = [
  {
    id: 'k8s.q.in.504',
    kind: 'mcq',
    concepts: ['k8s.ingress', 'k8s.gateway-api'],
    prompt: bi('Браузер получил 504 Gateway Timeout от сайта за Gateway. Кто сформировал этот ответ?', 'The browser got 504 Gateway Timeout from a site behind a Gateway. Who produced that reply?'),
    options: [
      { id: 'proxy', text: bi('Обратный прокси контроллера входа: под не ответил за его таймаут', 'The reverse proxy of the ingress controller: the pod did not answer within its timeout'), correct: true },
      { id: 'app', text: bi('Приложение в поде', 'The application in the pod'), why: bi('Приложение, возможно, ещё работает над ответом. 504 значит «тот, кто за мной, не ответил вовремя» — так говорит прокси.', 'The application may still be working on the answer. 504 means "whoever is behind me did not answer in time" — that is the proxy speaking.') },
      { id: 'proxyk', text: 'kube-proxy', why: bi('kube-proxy не видит HTTP и ответов не пишет: он только переписывает адреса пакетов.', 'kube-proxy does not see HTTP and writes no replies: it only rewrites packet addresses.') },
    ],
    refs: { explainer: 'k8s.ingress-path' },
  },
  {
    id: 'k8s.q.in.nginx',
    kind: 'mcq',
    concepts: ['k8s.ingress'],
    prompt: bi('Почему новые кластеры в 2026 году не ставят ingress-nginx?', 'Why do new clusters in 2026 not install ingress-nginx?'),
    options: [
      { id: 'retired', text: bi('Проект снят с поддержки в марте 2026: обновлений безопасности больше нет', 'The project was retired in March 2026: no more security updates'), correct: true },
      { id: 'removed', text: bi('Объект Ingress удалён из Kubernetes', 'The Ingress object was removed from Kubernetes'), why: bi('API Ingress остался и заморожен; закрылся один из контроллеров, а новые возможности идут в Gateway API.', 'The Ingress API stays, frozen; one of the controllers closed, and new features go into the Gateway API.') },
    ],
  },
  {
    id: 'k8s.q.in.nodeport',
    kind: 'mcq',
    concepts: ['k8s.nodeport'],
    prompt: bi('Service типа NodePort получил порт 30080. Где он открыт?', 'A NodePort Service got port 30080. Where is it open?'),
    options: [
      { id: 'all', text: bi('На каждом узле кластера', 'On every node of the cluster'), correct: true },
      { id: 'pod', text: bi('Только на узле, где работает под', 'Only on the node where the pod runs'), why: bi('kube-proxy пишет правило KUBE-NODEPORTS на всех узлах; без пода на узле пакет уйдёт к поду на соседнем (при externalTrafficPolicy: Cluster).', 'kube-proxy writes the KUBE-NODEPORTS rule on every node; with no pod on the node the packet goes to a pod on another one (with externalTrafficPolicy: Cluster).') },
    ],
  },
];

export const ingressLesson: Lesson = {
  id: 'k8s-1.ingress',
  block: 'k8s-1',
  title: bi('Вход снаружи: NodePort, LoadBalancer, Ingress и Gateway API', 'The way in: NodePort, LoadBalancer, Ingress and Gateway API'),
  summary: bi('Как запрос из интернета доходит до пода и откуда берутся 502 и 504.', 'How a request from the internet reaches a pod, and where 502 and 504 come from.'),
  introduces: ['k8s.nodeport', 'k8s.ingress', 'k8s.gateway-api'],
  uses: ['k8s.service', 'k8s.clusterip', 'k8s.kube-proxy'],
  tier: 'core',
  minutes: 35,
  sources: src([S.service, S.ingress, S.gateway, S.gatewayApi, S.ingressNginx], [R.service, R.wikiProxy]),
  sections: [
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Три ступени входа', 'Three steps of the way in'),
      body: bi(
        'ClusterIP достижим только изнутри кластера. Чтобы впустить внешний трафик, у Service есть ещё два типа.\n\n[[k8s.nodeport|NodePort]] открывает на **каждом** узле порт из диапазона 30000–32767 и ведёт его на Service (правило `KUBE-NODEPORTS`). Клиенту достаточно знать IP любого узла. LoadBalancer — следующий шаг: кто-то снаружи выдаёт Service внешний IP и ставит перед узлами балансировщик. В облаке это делает облачный контроллер, в k3s — встроенный ServiceLB, в своём ЦОДе — MetalLB.\n\nДля сайтов этого мало: нужны правила по имени хоста и пути, TLS, перенаправления. Это работа обратного прокси из блока о сетях, запущенного в кластере подами, — контроллера входа. Правила для него пишут объектом [[k8s.ingress|Ingress]] (исторический путь: host + path → service) или средствами [[k8s.gateway-api|Gateway API]]: GatewayClass описывает реализацию (инфраструктура), Gateway — точку входа (администратор кластера), HTTPRoute — маршруты приложения (его команда). API Ingress заморожен, а самый популярный контроллер, ingress-nginx, снят с поддержки в марте 2026 года; новые кластеры строят вход на Gateway API.\n\nВажно, откуда берутся ошибки. Прокси открывает к Service **новое** соединение. Если готовых подов нет, ответ 503 пишет прокси. Если под оборвал соединение — 502. Если под отвечает дольше, чем прокси готов ждать, — 504, и это тоже прокси: приложение в этот момент ещё трудится над ответом.',
        'A ClusterIP is reachable only from inside the cluster. To let external traffic in, a Service has two more types.\n\n[[k8s.nodeport|NodePort]] opens a port from the 30000–32767 range on **every** node and leads it to the Service (the `KUBE-NODEPORTS` rule). A client only needs the IP of any node. LoadBalancer is the next step: something outside gives the Service an external IP and puts a load balancer in front of the nodes. In a cloud the cloud controller does it, in k3s the built-in ServiceLB, in your own data centre MetalLB.\n\nFor websites that is not enough: you need rules by host name and path, TLS, redirects. That is the job of the reverse proxy from the networks block, run in the cluster as pods — an ingress controller. Its rules are written as an [[k8s.ingress|Ingress]] object (the historical way: host + path → service) or with the [[k8s.gateway-api|Gateway API]]: a GatewayClass describes the implementation (infrastructure), a Gateway the entry point (the cluster admin), an HTTPRoute the routes of an application (its team). The Ingress API is frozen, and the most popular controller, ingress-nginx, was retired in March 2026; new clusters build the way in on the Gateway API.\n\nIt matters where errors come from. The proxy opens a **new** connection to the Service. If there are no ready pods, the 503 is written by the proxy. If the pod dropped the connection — 502. If the pod takes longer than the proxy is willing to wait — 504, and that is the proxy too: the application is still working on its answer at that moment.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.ingress-path', caption: bi('Поднимите время ответа пода выше таймаута прокси. Переключите externalTrafficPolicy.', 'Raise the pod response time above the proxy timeout. Switch externalTrafficPolicy.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: INGRESS_LAB,
      intro: bi('Deployment `web` (2 пода) и Service `web` типа ClusterIP.', 'Deployment `web` (2 pods) and a ClusterIP Service `web`.'),
      tasks: [
        {
          id: 'nodeport',
          prompt: bi('Создайте второй Service `web-np` для того же Deployment — типа NodePort, порт 80.', 'Create a second Service `web-np` for the same Deployment — of type NodePort, port 80.'),
          check: { when: "k8s.services[name=web-np][type=NodePort].endpoints=2" },
          chips: 'kubectl expose deployment web --name=web-np --type=NodePort --port=80',
          concepts: ['k8s.nodeport'],
          docRef: { page: 'help/kubectl-expose', anchor: 'OPTIONS', line: '--type' },
          hints: { H1: bi('У expose есть флаги имени и типа.', 'expose has flags for the name and the type.') },
        },
        {
          id: 'pf',
          prompt: bi('Откройте Service `web` на своём компьютере через `kubectl port-forward` (локальный порт 8080) и загрузите страницу командой `cluster open http://localhost:8080/`.', 'Open Service `web` on your machine with `kubectl port-forward` (local port 8080) and load the page with `cluster open http://localhost:8080/`.'),
          check: { stdout: /HTTP 200[\s\S]*Hello from web-/ },
          chips: 'kubectl port-forward svc/web 8080:80 && cluster open http://localhost:8080/',
          docRef: { page: 'help/kubectl-port-forward', anchor: 'EXAMPLES', line: 'kubectl port-forward pod/mypod 8888:5000' },
          hints: { H1: bi('port-forward принимает TYPE/NAME и пару портов «локальный:удалённый».', 'port-forward takes TYPE/NAME and a "local:remote" port pair.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ingressQuiz.map((q) => q.id) },
    { id: 'note', kind: 'callout', tone: 'note', step: 'review', body: bi('Gateway и HTTPRoute в учебном кластере браузера пока не исполняются; на этапе 2, в настоящем k3s, вы включите провайдер Gateway API у встроенного Traefik и опубликуете через него свой сервис.', 'Gateways and HTTPRoutes are not executed in the browser training cluster yet; at stage 2, on a real k3s, you will enable the Gateway API provider of the built-in Traefik and publish your service through it.') },
  ],
};

// ── KN7 + KN8 ───────────────────────────────────────────────────────────────

export const troubleQuiz: QuizItem[] = [
  {
    id: 'k8s.q.tr.ladder',
    kind: 'order',
    concepts: ['k8s.networkpolicy', 'k8s.service'],
    prompt: bi('Под не достучался до сервиса. Расставьте ступени проверки по порядку.', 'A pod cannot reach a service. Put the steps of the check in order.'),
    steps: [
      { id: 'dns', text: bi('DNS: резолвится ли имя (nslookup из пода)', 'DNS: does the name resolve (nslookup from the pod)') },
      { id: 'svc', text: bi('Service: верны ли ClusterIP и порт', 'Service: are the ClusterIP and port right') },
      { id: 'eps', text: bi('EndpointSlice: есть ли готовые адреса', 'EndpointSlice: are there ready addresses') },
      { id: 'pod', text: bi('Под: отвечает ли он сам по IP и targetPort', 'Pod: does it answer by its IP and targetPort') },
      { id: 'np', text: bi('NetworkPolicy: не отсекает ли политика', 'NetworkPolicy: does a policy drop it'), why: bi('Политику проверяют, когда сам под по IP отвечает тем, кто ему разрешён, — иначе её не отличить от сломанного пода.', 'The policy is checked once the pod answers by IP for allowed clients — otherwise you cannot tell it from a broken pod.') },
    ],
  },
  {
    id: 'k8s.q.tr.cni',
    kind: 'mcq',
    concepts: ['k8s.networkpolicy', 'k8s.cni'],
    prompt: bi('NetworkPolicy создана, API её принял, а трафик не блокируется. Самая вероятная причина?', 'A NetworkPolicy is created, the API accepted it, yet traffic is not blocked. The most likely reason?'),
    options: [
      { id: 'cni', text: bi('CNI кластера не применяет NetworkPolicy (например, чистый flannel)', 'The cluster CNI does not enforce NetworkPolicy (plain flannel, for example)'), correct: true },
      { id: 'kp', text: bi('Политику должен применить kube-proxy, а он отстал', 'kube-proxy has to apply the policy and it lags behind'), why: bi('kube-proxy политиками не занимается: их исполняет сетевой плагин.', 'kube-proxy has nothing to do with policies: the network plugin enforces them.') },
    ],
    explain: bi('API хранит любые объекты, но исполняет их тот, кто их смотрит. Calico, Cilium и встроенный в k3s kube-router политики применяют, чистый flannel — нет.', 'The API stores any object, but it is executed by whoever watches it. Calico, Cilium and the kube-router built into k3s enforce policies, plain flannel does not.'),
  },
];

export const troubleshootLesson: Lesson = {
  id: 'k8s-1.troubleshoot',
  block: 'k8s-1',
  title: bi('NetworkPolicy и методика «под не достучался»', 'NetworkPolicy and the "pod cannot reach it" method'),
  summary: bi('По умолчанию всё открыто; политика выбирает поды и только разрешает. Лестница слоёв: DNS → Service → EndpointSlice → под → NetworkPolicy.', 'By default everything is open; a policy selects pods and only allows. The ladder of layers: DNS → Service → EndpointSlice → pod → NetworkPolicy.'),
  introduces: ['k8s.networkpolicy'],
  uses: ['k8s.service', 'k8s.endpointslice', 'k8s.cluster-dns', 'k8s.cni', 'k8s.label', 'k8s.namespace'],
  tier: 'core',
  minutes: 40,
  sources: src([S.netpol, S.debugService], [R.service, R.dns]),
  sections: [
    {
      id: 'policy',
      kind: 'text',
      step: 'explain',
      title: bi('По умолчанию всё открыто', 'By default everything is open'),
      body: bi(
        'Сетевая модель обещает, что любой под достаёт до любого. Для учебного кластера это удобно, для рабочего — опасно: взломанный фронтенд сразу видит базу данных. Ограничивают это объектом [[k8s.networkpolicy|NetworkPolicy]].\n\nПолитика выбирает поды (`podSelector`) и для них **только разрешает**: «в поды app=pay можно приходить из namespace shop от подов role=frontend». Как только под выбран хотя бы одной политикой с типом Ingress, к нему пускают только то, что разрешено; всё прочее отбрасывается. Политики складываются: разрешено то, что разрешает хотя бы одна.\n\nВ правиле `from` есть ловушка. `namespaceSelector` и `podSelector` в **одном** элементе списка означают «И» (под с такой меткой в таком namespace). В **двух** элементах — «ИЛИ» (любой под из этого namespace или под с этой меткой откуда угодно). Одна чёрточка в YAML меняет смысл.\n\nИ главное: политику исполняет сетевой плагин. API-сервер примет NetworkPolicy в любом кластере, но если CNI её не поддерживает — чистый flannel, например, — трафик пойдёт как прежде. В k3s политики применяет встроенный kube-router.',
        'The network model promises that any pod reaches any other. For a training cluster that is handy, for production it is dangerous: a compromised frontend sees the database at once. A [[k8s.networkpolicy|NetworkPolicy]] object restricts it.\n\nA policy selects pods (`podSelector`) and for them **only allows**: "into app=pay pods you may come from namespace shop, from pods role=frontend". As soon as a pod is selected by at least one policy of type Ingress, only what is allowed gets in; everything else is dropped. Policies add up: allowed is whatever at least one allows.\n\nThere is a trap in the `from` rule. `namespaceSelector` and `podSelector` in **one** list item mean "AND" (a pod with this label in this namespace). In **two** items they mean "OR" (any pod from this namespace, or a pod with this label from anywhere). One dash in the YAML changes the meaning.\n\nAnd the main thing: the network plugin enforces the policy. The API server accepts a NetworkPolicy in any cluster, but if the CNI does not support it — plain flannel, for example — traffic flows as before. In k3s the built-in kube-router enforces policies.',
      ),
    },
    {
      id: 'ladder',
      kind: 'text',
      step: 'explain',
      title: bi('Лестница слоёв', 'The ladder of layers'),
      body: bi(
        '«Под не достучался до сервиса» — самая частая жалоба в кластере. Как в блоке о сетях, сначала спросите, какой слой сломался, и идите по ступеням сверху вниз; на каждой поломка выглядит по-своему.\n\n1. **DNS.** `kubectl exec client -- nslookup web.shop`. «can\'t find … NXDOMAIN» — имени нет: опечатка или чужой namespace. Тайм-аут — не работает CoreDNS.\n2. **Service.** `kubectl get svc web -o wide`: тот ли ClusterIP, тот ли порт, какой селектор.\n3. **EndpointSlice.** `kubectl get endpointslices -l kubernetes.io/service-name=web`: пусто — селектор не нашёл подов или они не готовы; `curl` получит «connection refused».\n4. **Под.** `kubectl get pods -o wide` и `curl <IP пода>:<targetPort>` из клиента: если по IP не отвечает — смотрите targetPort, процесс, логи.\n5. **NetworkPolicy.** `kubectl get netpol -A` и `kubectl describe netpol`: выбирает ли политика под назначения и разрешает ли этого клиента. Признак — тайм-аут при живом поде.\n\nЗаписывайте, что проверили: на собеседовании и в разборе инцидента ценится не угаданный ответ, а пройденная лестница.',
        '"A pod cannot reach a service" is the most common complaint in a cluster. As in the networks block, first ask which layer broke, and walk the steps from the top down; on each step a break looks different.\n\n1. **DNS.** `kubectl exec client -- nslookup web.shop`. "can\'t find … NXDOMAIN" — there is no such name: a typo or another namespace. A timeout — CoreDNS is not working.\n2. **Service.** `kubectl get svc web -o wide`: the right ClusterIP, the right port, which selector.\n3. **EndpointSlice.** `kubectl get endpointslices -l kubernetes.io/service-name=web`: empty — the selector found no pods or they are not ready; `curl` gets "connection refused".\n4. **Pod.** `kubectl get pods -o wide` and `curl <pod IP>:<targetPort>` from the client: if it does not answer by IP, look at the targetPort, the process, the logs.\n5. **NetworkPolicy.** `kubectl get netpol -A` and `kubectl describe netpol`: does a policy select the destination pod, and does it allow this client. The sign is a timeout while the pod is alive.\n\nWrite down what you checked: in an incident review what counts is not a guessed answer but the ladder walked.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: TROUBLE_LAB,
      intro: bi('Под `client` в namespace `shop` не может достучаться ни до `web` (в shop), ни до `pay` (в namespace pay). Поломок несколько, на разных ступенях.', 'Pod `client` in namespace `shop` cannot reach either `web` (in shop) or `pay` (in namespace pay). There are several breaks on different steps.'),
      tasks: [
        {
          id: 'web',
          prompt: bi('Добейтесь, чтобы `client` получал ответ от `web` в namespace `shop`. Поды не пересоздавайте.', 'Make `client` get an answer from `web` in namespace `shop`. Do not recreate the pods.'),
          check: { when: "k8s.reach[from='shop/client'][to='web.shop'].status=200" },
          chips: 'kubectl -n shop get svc web -o wide',
          concepts: ['k8s.service', 'k8s.endpointslice'],
          hints: {
            H1: bi('Имя резолвится, адреса в EndpointSlice есть, а curl получает «connection refused» почти мгновенно. Какая ступень дальше?', 'The name resolves, the EndpointSlice has addresses, yet curl gets "connection refused" almost instantly. Which step is next?'),
            H2: bi('Сравните targetPort Service с портом, который слушает процесс: `kubectl -n shop exec client -- curl -s http://<IP пода>:80`.', 'Compare the Service targetPort with the port the process listens on: `kubectl -n shop exec client -- curl -s http://<pod IP>:80`.'),
          },
        },
        {
          id: 'pay',
          prompt: bi('Добейтесь, чтобы `client` получал ответ от `pay` из namespace `pay`. Политику не удаляйте: она защищает платёжный сервис.', 'Make `client` get an answer from `pay` in namespace `pay`. Do not delete the policy: it protects the payment service.'),
          check: {
            when: "k8s.reach[from='shop/client'][to='pay.pay'].status=200 && k8s.objects[kind=NetworkPolicy][metadata.name=only-shop-frontend]#=1",
            fail: [{ if: 'k8s.objects[kind=NetworkPolicy]#=0', say: bi('Политику удалили — так дыра появляется в защите. Верните её и пропустите клиента так, как она требует.', 'The policy was deleted — that opens a hole in the protection. Bring it back and let the client in the way it requires.') }],
          },
          chips: 'kubectl -n pay describe netpol only-shop-frontend',
          concepts: ['k8s.networkpolicy'],
          hints: {
            H1: bi('Сначала полное имя: из shop короткое `pay` не найдётся. Если по полному имени тайм-аут при живых подах — это ступень NetworkPolicy.', 'First the full name: from shop the short `pay` is not found. If the full name times out while the pods are alive, that is the NetworkPolicy step.'),
            H2: bi('Прочитайте, какие поды и из какого namespace политика пускает, и посмотрите метки клиента.', 'Read which pods from which namespace the policy lets in, and look at the client’s labels.'),
          },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: troubleQuiz.map((q) => q.id) },
  ],
};
