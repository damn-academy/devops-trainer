// The Kubernetes networking section (05 §4.3 KN1–KN8, R9): the network
// model and CNI, pod to pod on one node and across nodes, Services and
// kube-proxy, cluster DNS, the way in from outside, NetworkPolicy and the
// ladder "a pod cannot reach a service".

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import type { K8sFacts } from '../../../engine/kube-lite/facts';
import { DNS_BROKEN, DNS_LAB, INGRESS_LAB, SERVICE_BROKEN, SERVICE_LAB, TROUBLE_LAB } from '../setups';
import { R, S, src } from '../sources';

const k8s = (f: Facts) => f.k8s as K8sFacts;

// ── KN1–KN3 ─────────────────────────────────────────────────────────────────

export const networkQuiz: QuizItem[] = [
  {
    id: 'k8s.q.net.rules',
    kind: 'multi',
    concepts: ['k8s.network-model'],
    prompt: bi('Что обещает сетевая модель Kubernetes? Отметьте все верные ответы.', 'What does the Kubernetes network model promise? Mark everything that is true.'),
    options: [
      { id: 'ip', text: bi('У каждого пода свой IP-адрес, единый для всего кластера', 'Every pod has its own cluster-wide IP'), correct: true },
      { id: 'nonat', text: bi('Поды обмениваются пакетами напрямую, без трансляции адресов (NAT)', 'Pods talk to each other without NAT'), correct: true },
      { id: 'ports', text: bi('Порты подов нужно пробрасывать на узел, как в Docker', 'Pod ports must be published on the node, as in Docker'), why: bi('Модель как раз избавляет от этого, потому что при сотнях подов порты узлов конфликтовали бы, а приложению пришлось бы знать, на каком узле работает сосед.', 'That is exactly what the model avoids: with hundreds of pods the node ports would clash and the application would have to know the node address.') },
      { id: 'ns', text: bi('Поды из разных namespace Kubernetes не видят друг друга', 'Pods in different Kubernetes namespaces cannot see each other'), why: bi('По умолчанию видят, потому что namespace разграничивает имена и права, а не сеть. Сеть ограничивают отдельные сетевые политики, о которых рассказано в конце раздела.', 'By default they can: a namespace is a boundary of names and permissions, not of the network. Separate network policies restrict the network — they come at the end of this section.') },
    ],
  },
  {
    id: 'k8s.q.net.masq',
    kind: 'mcq',
    concepts: ['k8s.cni'],
    prompt: bi('Почему внешний сервис видит в запросах от пода адрес узла, а не адрес вида 10.42.x.x?', 'Why does an external service see the node address in requests from a pod, not 10.42.x.x?'),
    options: [
      { id: 'masq', text: bi('Пакеты, которые уходят за пределы сети подов, проходят на узле подмену адреса отправителя (MASQUERADE)', 'Traffic leaving the pod network is MASQUERADEd on the node'), correct: true },
      { id: 'proxy', text: bi('Все запросы наружу идут через kube-proxy', 'All outgoing requests go through kube-proxy'), why: bi('kube-proxy занимается только адресами Service. Адрес отправителя подменяет правило NAT, которое пишет плагин сети.', 'kube-proxy handles only Service addresses. The source rewrite is a NAT rule the CNI writes.') },
      { id: 'dns', text: bi('Так настроен DNS кластера', 'The cluster DNS is configured that way'), why: bi('DNS превращает имена в адреса и к адресу отправителя пакета отношения не имеет.', 'DNS turns names into addresses and has nothing to do with the source address of a packet.') },
    ],
    explain: bi('Адреса 10.42.0.0/16 существуют только внутри кластера, и ответ на такой адрес снаружи не нашёл бы дороги назад. Поэтому узел подменяет адрес отправителя своим.', 'The 10.42.0.0/16 addresses exist only inside the cluster; a reply to them from outside would never come back. So the node rewrites the source to its own IP.'),
  },
  {
    id: 'k8s.q.net.vxlan',
    kind: 'mcq',
    concepts: ['k8s.cni', 'k8s.podcidr'],
    prompt: bi('Узлы стоят в разных подсетях облака, а плагин сети работает в режиме host-gw. Пинг между подами одного узла проходит, а между подами разных узлов нет. Почему?', 'The nodes are in different cloud subnets, the CNI is in host-gw mode. Ping between pods on one node works, between nodes it does not. Why?'),
    options: [
      { id: 'hop', text: bi('При host-gw следующим шагом пакета назначен другой узел, а он не сосед в той же сети', 'host-gw makes the other node the next hop, and it is not an L2 neighbour'), correct: true },
      { id: 'mtu', text: bi('Слишком маленький MTU', 'The MTU is too small'), why: bi('MTU мешал бы только большим пакетам, а маленький пакет ping прошёл бы.', 'The MTU would only hurt big packets; a small ping would pass.') },
      { id: 'dns', text: bi('Не работает CoreDNS', 'CoreDNS does not work'), why: bi('Пинг по IP-адресу DNS не использует.', 'A ping by IP does not use DNS.') },
    ],
    explain: bi('Узлам в разных подсетях нужен «конверт в конверте», то есть VXLAN: пакет пода идёт между узлами внутри обычного UDP-пакета.', 'Nodes in different subnets need an "envelope in an envelope" — VXLAN: the pod packet rides inside ordinary UDP between the nodes.'),
    refs: { explainer: 'k8s.pod-network' },
  },
];

export const networkLesson: Lesson = {
  id: 'k8s-1.network',
  block: 'k8s-1',
  title: bi('Сетевая модель Kubernetes и путь пакета из пода в под', 'The Kubernetes network model and a packet from pod to pod'),
  summary: bi('Почему в кластере не нужен флаг -p, из каких четырёх правил состоит сетевая модель, какой плагин их выполняет и как пакет идёт через мост на одном узле, а между узлами — по маршруту или в конверте VXLAN.', 'Why a cluster has no -p; the four rules of the model; the CNI that fulfils them; a bridge on one node, a route or VXLAN between nodes.'),
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
        'В Docker вы открывали контейнер миру флагом `-p 8080:80`: ядро узла подменяло адрес назначения (DNAT) и отправляло пакет в контейнер. Теперь представьте сотню подов на трёх узлах. Каждому пришлось бы выделить свой порт узла, порты конфликтовали бы, а приложению, чтобы обратиться к соседу, нужно было бы знать, на каком узле и на каком порту тот работает сегодня. Kubernetes устроен иначе, и у пода нет проброшенного порта, зато есть собственный адрес.',
        'In Docker you opened a container to the world with `-p 8080:80`: the node kernel rewrote the destination address (DNAT) and sent the packet into the container. Picture a hundred pods on three nodes: each needs its own node port, the ports clash, and an application has to know which node and port its neighbour uses today. Kubernetes works differently: a pod has no "published port", it has its own address.',
      ),
    },
    {
      id: 'model',
      kind: 'text',
      step: 'explain',
      title: bi('Четыре правила сетевой модели', 'Four rules'),
      body: bi(
        '[[k8s.network-model|Сетевая модель Kubernetes]] — это не программа, а обещание из четырёх пунктов, записанное на странице документации *Cluster Networking*:\n\n- у каждого пода свой IP-адрес, единый для всего кластера;\n- поды обмениваются пакетами напрямую, без трансляции адресов и без посредников, и на одном узле, и на разных;\n- программы узла, например kubelet, могут обращаться к подам своего узла;\n- под видит себя под тем же адресом, под которым его видят другие.\n\nВсе контейнеры пода работают в одном сетевом пространстве имён, том самом, которое держит песочница пода с процессом pause. Поэтому IP-адрес принадлежит поду, а не контейнеру, и контейнеры одного пода обращаются друг к другу через `localhost`.\n\nКто выполняет это обещание? Не сам Kubernetes, а сетевой плагин, [[k8s.cni|CNI]] (Container Network Interface). Когда среда запуска контейнеров создаёт песочницу пода, она вызывает плагин с командой `ADD`. Плагин создаёт пару виртуальных интерфейсов veth, один конец помещает в пространство имён пода, а другой подключает к мосту `cni0` на узле, выдаёт поду адрес и прописывает маршрут. Адреса плагин берёт из [[k8s.podcidr|podCIDR]], диапазона, который управляющий слой выдал узлу: в k3s у первого узла это `10.42.0.0/24`, у второго `10.42.1.0/24`. Связь между узлами разные плагины строят по-разному: flannel, Calico и Cilium выполняют одну и ту же модель разными средствами.',
        'The [[k8s.network-model|Kubernetes network model]] is not a program but a promise of four points (the *Cluster Networking* page):\n\n- every pod has its own IP address across the whole cluster;\n- pods talk to each other directly, without NAT or proxies, on one node and across nodes;\n- agents on a node (the kubelet, for example) can reach the pods of their node;\n- a pod sees itself at the same address others see it at.\n\nAll the containers of a pod live in one network namespace — the one the sandbox (pause) holds. So the IP belongs to the pod, not the container, and the containers of a pod talk to each other through `localhost`.\n\nWho keeps the promise? Not Kubernetes. A network plugin does — the [[k8s.cni|CNI]] (Container Network Interface). When the runtime creates the sandbox, it runs the plugin with the `ADD` command: the plugin creates a veth pair, puts one end into the pod namespace and the other into the node’s `cni0` bridge, assigns an address and adds a route. Addresses come from the [[k8s.podcidr|podCIDR]] — the subnet the control plane gave the node: in k3s the first node has `10.42.0.0/24`, the second `10.42.1.0/24`. The cross-node part is built differently by each plugin: flannel, Calico, Cilium are different executors of one model.',
      ),
    },
    {
      id: 'look-same-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как пакет идёт к соседу по узлу', 'How a packet reaches a neighbour on the node'),
      body: bi(
        'Схема ниже показывает путь одного пакета между подами. Сплошные рамки — это два узла, worker-1 и worker-2, а в подписи каждой рамки указан диапазон адресов, который этот узел раздаёт своим подам. Сначала на схеме только три пода: A и B на worker-1 и C на worker-2. Мост узла, таблица маршрутов ядра и сеть между узлами появятся, когда до них дойдёт пакет. В первом проходе под A отправляет пакет своему соседу по узлу, поду B.',
        'The diagram below shows the path of one packet between pods. The solid frames are two nodes, worker-1 and worker-2, and each frame’s label gives the address range the node hands to its pods. At first only three pods are shown: A and B on worker-1, C on worker-2. The bridge, the routing table and the node network appear when the packet reaches them. In the first run pod A sends a packet to its neighbour on the node, pod B.',
      ),
    },
    { id: 'look-same', kind: 'explainer', step: 'look', explainer: 'k8s.pod-network', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Подсвечен тот участник, через которого сейчас проходит пакет, облачко рядом с ним говорит, что он делает, а на карточке, которая движется по линии, написаны адреса отправителя и получателя. Обратите внимание, что адреса на карточке в пути не меняются: так выполняется обещание сетевой модели передавать пакеты без трансляции адресов (NAT).', 'Press “Start from the first step”, then go on with “Step forward”. The participant the packet passes is highlighted, its callout says what it does, and the card on the line carries the source and destination addresses. Note that the addresses never change on the way: that is how the network model keeps its promise of no address translation (NAT).'), params: { target: 'same', mode: 'host-gw' }, caption: bi('Сравните два пути. На одном узле пакет прошёл только через мост и не покинул узел. Теперь выберите в поле «Кому под A отправляет пакет» под C на другом узле и посмотрите, сколько участников добавилось на пути.', 'Compare the two paths: on one node the packet passed only through the bridge and never left the node. Now choose pod C on another node in “Where pod A sends the packet” and see how many participants were added to the path.') },
    {
      id: 'across',
      kind: 'text',
      step: 'explain',
      title: bi('Как пакет переходит между узлами по маршруту или в конверте', 'How a packet crosses between nodes: by a route or in an envelope'),
      body: bi(
        'Пакет для чужого диапазона адресов мост отдаёт ядру узла, и дальше у пакета два пути.\n\n**Маршрут (host-gw).** Каждый узел служит маршрутизатором для своих подов. На worker-1 записан маршрут `10.42.1.0/24 via 192.168.56.12`, и пакеты для подов второго узла уходят прямо на второй узел. Это несложно и быстро, но работает, только если узлы стоят по соседству в одной сети и следующий шаг пакета достижим напрямую.\n\n**Конверт в конверте (VXLAN).** Пакет пода целиком кладётся внутрь нового пакета. Снаружи на нём написаны адреса узлов и UDP-порт 8472, а внутри по-прежнему `10.42.0.15 → 10.42.1.20`. Сети между узлами незачем знать адреса подов, потому что она видит обычный пакет UDP. Это тот самый туннель из блока о сетях. Конверт обходится в 50 байт на каждый пакет, поэтому MTU в подах ставят 1450, а межсетевой экран облака должен пропускать UDP 8472 между узлами.\n\nКогда пакет пода уходит за пределы `10.42.0.0/16`, например в интернет, узел подменяет адрес отправителя своим (MASQUERADE), потому что ответ на адрес пода снаружи не нашёл бы дороги назад.',
        'A packet for another podCIDR is handed by the bridge to the node kernel, and from there there are two ways.\n\n**A route (host-gw).** A node is the router of its own pods’ subnet. worker-1 has the route `10.42.1.0/24 via 192.168.56.12`: packets for the second node’s pods go straight to the second node. Simple and fast, but it works only if the nodes are neighbours on one network: the next hop must be directly reachable.\n\n**An envelope in an envelope (VXLAN).** The pod packet is put whole inside a new packet: outside — the node addresses and UDP port 8472, inside — still `10.42.0.15 → 10.42.1.20`. The network between the nodes need not know pod addresses — it sees ordinary UDP. This is the tunnel from the networks block. The price is 50 bytes of wrapping, so pod MTU is set to 1450, and the cloud firewall must allow UDP 8472 between nodes.\n\nWhen pod traffic leaves `10.42.0.0/16` — for the internet — the node replaces the source with its own address (MASQUERADE): a reply to a pod address from outside would never find its way back.',
      ),
    },
    {
      id: 'look-across-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как пакет идёт на другой узел', 'How a packet reaches another node'),
      body: bi(
        'Ниже та же схема, что в прошлом разделе, но теперь под A отправляет пакет поду C на другом узле, а узлы связаны маршрутом host-gw: каждый узел служит маршрутизатором для своих подов. Два счётчика под схемой показывают, через сколько участников прошёл пакет и сколько байтов ушло на конверт.',
        'Below is the same diagram as in the previous section, but now pod A sends to pod C on another node, and the nodes are joined by host-gw routes: each node routes for its own pods. Two counters under the diagram show how many participants the packet passed through and how many bytes went on the envelope.',
      ),
    },
    { id: 'look-across', kind: 'explainer', step: 'look', explainer: 'k8s.pod-network', howto: bi('Пройдите путь кнопкой «Шаг вперёд» и следите за карточкой на линии: адреса подов на ней не меняются на всём пути.\n\nПотом переключите в «Параметрах» способ доставки на конверт VXLAN: на шаге «конверт» на карточке появятся адреса узлов и порт UDP 8472, а адреса подов окажутся внутри. Включите переключатель «Узлы стоят в разных подсетях» при каждом из двух способов: схема спросит, дойдёт ли пакет. Напоследок включите в блоке «Сломать» пропавший маршрут и закрытый порт UDP 8472 и запомните, какие сообщения печатают ping и curl.', 'Walk the path with “Step forward” and watch the card: the pod addresses never change on the way.\n\nThen switch the delivery mode to VXLAN in “Parameters”: at the “envelope” step the card shows the node addresses and UDP 8472, with the pod addresses inside. Turn on “The nodes are in different subnets” with each of the two modes: the diagram asks whether the packet gets through. Finally, switch on the missing route and the closed UDP 8472 in “Break it” and remember what ping and curl print.'), params: { target: 'other', mode: 'host-gw' }, caption: bi('Запомните сообщения, которые вы видели при поломках: потерянные пакеты только между узлами говорят о маршруте или межсетевом экране, а большие пакеты, которые пропадают при маленьких проходящих, — о MTU. В лабораторной работе ниже вы посмотрите те же маршруты на узле командой `cluster ip route worker-1`.', 'Remember the messages from the breaks: packets lost only between nodes point to the route or the firewall, while big packets vanishing as small ones pass point to the MTU. In the lab below you look at the same routes on a node with `cluster ip route worker-1`.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: SERVICE_LAB,
      intro: bi('В кластере работает Deployment `web` на три пода и под `client` с программой curl. Команды `cluster ip route worker-1` и `cluster ip addr worker-1` показывают маршруты и адреса узла.', 'Deployment `web` with three pods and a pod `client` with curl. `cluster ip route worker-1` and `cluster ip addr worker-1` show the node’s routes and addresses.'),
      tasks: [
        {
          id: 'ips',
          prompt: bi('Посмотрите, какие IP-адреса получили поды и на каких узлах они работают.', 'Look at which IPs the pods got and which nodes they are on.'),
          check: { stdout: /IP\s+NODE[\s\S]*10\.42\.\d+\.\d+/ },
          chips: 'kubectl get pods -o wide',
          hints: { H1: bi('Вы уже делали это в первом уроке.', 'You did this in the first lesson.') },
        },
        {
          id: 'direct',
          prompt: bi('Из пода `client` обратитесь напрямую по IP-адресу к любому поду `web`, без всякого посредника, и получите ответ.', 'From pod `client`, reach any `web` pod directly by its IP — with no middleman — and get an answer.'),
          check: { stdout: /Hello from web-\w+-\w+ \(10\.42\.\d+\.\d+\)/ },
          chips: 'kubectl exec client -- curl -s http://<pod-ip>',
          concepts: ['k8s.network-model'],
          hints: { H1: bi('Команду внутри пода запускает kubectl exec, а после `--` пишется сама команда.', 'kubectl exec runs a command inside a pod; the command goes after `--`.'), H2: bi('`kubectl exec client -- curl -s http://10.42.x.y`', '`kubectl exec client -- curl -s http://10.42.x.y`') },
        },
        {
          id: 'cidr',
          prompt: bi('Узнайте podCIDR узла `worker-1` и сохраните его в файл `~/cidr.txt`.', 'Find the podCIDR of node `worker-1` and save it to `~/cidr.txt`.'),
          check: { when: "files['/home/learner/cidr.txt'].text~'10.42.1.0/24'" },
          chips: "kubectl get node worker-1 -o jsonpath='{.spec.podCIDR}' > cidr.txt",
          concepts: ['k8s.podcidr'],
          docRef: { page: 'explain/node.spec', anchor: 'FIELDS', line: 'podCIDR' },
          hints: { H1: bi('podCIDR — поле spec объекта Node, а одно поле объекта достаёт флаг `-o jsonpath`.', 'podCIDR is a spec field of the Node object. `-o jsonpath` gets one field.') },
        },
        {
          id: 'route',
          prompt: bi('Посмотрите маршруты узла `worker-1` и выясните, как он отправляет пакеты в диапазоны адресов других узлов.', 'Look at the routes of `worker-1`: how does it send packets to the other nodes’ podCIDRs?'),
          check: { stdout: /10\.42\.0\.0\/24 via 10\.42\.0\.0 dev flannel\.1/ },
          chips: 'cluster ip route worker-1',
          hints: { H1: bi('Это инструмент тренажёра, а на настоящем узле то же покажет команда `ip route`.', 'This is a trainer tool: on a real node `ip route` shows the same.') },
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
    prompt: bi('На каком интерфейсе узла находится ClusterIP 10.43.12.7?', 'Which node interface holds the ClusterIP 10.43.12.7?'),
    options: [
      { id: 'none', text: bi('Ни на каком, потому что этот адрес существует только в правилах, которые kube-proxy записал в ядро узла', 'None: it is an address in kube-proxy’s rules in the node kernel'), correct: true },
      { id: 'cni0', text: bi('На мосте cni0', 'On the cni0 bridge'), why: bi('На мосте cni0 находится шлюз подов узла (10.42.N.1). ClusterIP нет ни на одном интерфейсе, и команда `ip a` его не покажет.', 'cni0 holds the node’s pod gateway (10.42.N.1). The ClusterIP is on no interface — `ip a` does not show it.') },
      { id: 'pod', text: bi('На интерфейсе одного из подов Service', 'On the interface of one of the Service pods'), why: bi('У подов свои адреса вида 10.42.x.x, а адрес Service заменяется на один из них уже в ядре узла, где работает клиент.', 'Pods have their own 10.42.x.x addresses; the Service address is replaced with one of them in the client node’s kernel.') },
    ],
    explain: bi('Пакет на ClusterIP перехватывает цепочка KUBE-SERVICES ещё до маршрутизации и заменяет адрес назначения на IP пода. Исключение — устаревший режим IPVS, в котором адрес находится на служебном интерфейсе kube-ipvs0.', 'A packet to the ClusterIP is caught by the KUBE-SERVICES chain before routing and DNATed to a pod IP. The exception is the deprecated IPVS mode, where the address sits on the dummy kube-ipvs0.'),
    refs: { explainer: 'k8s.service-path' },
  },
  {
    id: 'k8s.q.svc.targetport',
    kind: 'bugfind',
    concepts: ['k8s.service'],
    prompt: bi('Приложение в подах слушает порт 80, а Service не отвечает. В какой строке ошибка?', 'The application in the pods listens on port 80. The Service does not answer. Where is the bug?'),
    code: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: web\nspec:\n  selector:\n    app: web\n  ports:\n  - port: 80\n    targetPort: 8080',
    lang: 'yaml',
    bug: [10],
    why: {
      7: bi('Селектор написан правильно, и поды помечены той же меткой app=web.', 'The selector is right: the pods are labelled app=web.'),
      9: bi('Поле port задаёт порт самого Service. Клиенты обращаются на порт 80, и так и должно быть.', 'port is the port of the Service itself; clients use 80, that is fine.'),
      10: bi('Service отправляет пакеты на targetPort, а процесс слушает порт 80, поэтому под ответит отказом в соединении. containerPort в описании пода — только справка, на путь пакета он не влияет.', 'The Service sends to targetPort, but the process listens on 80: the pod answers RST. containerPort in the pod description is only information, it does not affect the route.'),
    },
  },
  {
    id: 'k8s.q.svc.prob',
    kind: 'mcq',
    concepts: ['k8s.kube-proxy', 'k8s.endpointslice'],
    prompt: bi('За Service стоят три готовых пода. Какие вероятности у правил KUBE-SEP в iptables?', 'A Service has three ready pods. What probabilities do the KUBE-SEP rules have in iptables?'),
    options: [
      { id: 'right', text: '0.33333, 0.50000, (no condition)', correct: true },
      { id: 'equal', text: '0.33333, 0.33333, 0.33333', why: bi('Правила проверяются по очереди, и второе правило видит только две трети пакетов, поэтому ему нужна половина от остатка. Третье правило забирает всё, что осталось.', 'The rules are tried in turn: the second sees only two thirds of the packets, so it needs half of what is left; the third takes everything that remains.') },
    ],
    explain: bi('Первое правило берёт 1/3, второе — половину от оставшихся 2/3, то есть тоже 1/3, а третье — оставшуюся 1/3. Доли получаются равными.', '1/3, then 1/2 of the remaining 2/3 = 1/3, then the rest 1/3 — the shares are equal.'),
  },
  {
    id: 'k8s.q.svc.unequal',
    kind: 'mcq',
    concepts: ['k8s.service'],
    prompt: bi('За Service стоят пять подов, а почти весь трафик клиента приходит на один под. Какая причина встречается чаще всего?', 'A Service has five pods, yet almost all of a client’s traffic lands on one. The most common reason?'),
    options: [
      { id: 'keepalive', text: bi('Клиент держит одно соединение (keep-alive), а под выбирается при открытии соединения', 'The client keeps its connection (keep-alive): the pod is chosen when the connection is set up'), correct: true },
      { id: 'broken', text: bi('kube-proxy сломан', 'kube-proxy is broken'), why: bi('Если бы kube-proxy был сломан, Service не отвечал бы вовсе, а не перекашивал доли.', 'A broken kube-proxy would stop answers altogether, not skew the shares.') },
    ],
  },
];

export const servicesLesson: Lesson = {
  id: 'k8s-1.services',
  block: 'k8s-1',
  title: bi('Как Service даёт постоянный адрес подам, которые приходят и уходят', 'A Service: a permanent address for mortal pods'),
  summary: bi('Что такое Service и ClusterIP, как EndpointSlice и kube-proxy превращают адрес Service в адрес пода, почему балансировка бывает неравной и как Service ломается.', 'The Service and its ClusterIP, the EndpointSlice, kube-proxy and the kernel rules; why balancing can look unequal and how a Service breaks.'),
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
        'Удалите под, и замена появится с другим IP-адресом. Выкатите новую версию, и сменятся адреса всех подов. Поэтому обращаться к подам по их адресам нельзя: нужен адрес, который существует дольше любого пода, и имя, которое знают все.',
        'Delete a pod — the replacement comes with another IP. Roll out a new version — every IP changes. You cannot reach pods by their addresses. You need an address that outlives the pods, and a name everyone knows.',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Service, EndpointSlice, kube-proxy', 'Service, EndpointSlice, kube-proxy'),
      body: bi(
        '[[k8s.service|Service]] описывает селектор и порты, например так: «поды с меткой app=web, порт 80 ведёт на порт 80 подов (targetPort)». При создании Service получает [[k8s.clusterip|ClusterIP]] из диапазона `10.43.0.0/16`, и этот адрес не меняется, сколько бы подов ни приходило и ни уходило.\n\nКто знает, какие поды сейчас стоят за Service? Это знает контроллер EndpointSlice. Он ищет поды по селектору и записывает их адреса в объект [[k8s.endpointslice|EndpointSlice]], отмечая для каждого, готов ли он (`ready`). Старый объект Endpoints делал то же самое, но объявлен устаревшим, и kubectl предупредит об этом, если вы его запросите.\n\nА кто превращает адрес Service в адрес пода? Сам Service этого не делает, потому что он остаётся только записью. На каждом узле работает [[k8s.kube-proxy|kube-proxy]]: он следит за Service и EndpointSlice и записывает в ядро узла правила netfilter. Пакет на `10.43.12.7:80` попадает в цепочку `KUBE-SERVICES`, оттуда в цепочку `KUBE-SVC-…` этого Service, где правила с вероятностями выбирают одну из цепочек `KUBE-SEP-…`, а та заменяет адрес назначения на `10.42.1.15:80`. Ответ ядро с помощью модуля conntrack переводит обратно. ClusterIP не назначен ни одному интерфейсу и существует только в этих правилах.\n\nОтсюда три типичные поломки. Если селектор не совпадает с метками подов, EndpointSlice пуст, kube-proxy пишет правило `REJECT`, и curl сразу получает отказ в соединении. Если неверен `targetPort`, пакет приходит в под на порт, где никто не слушает, и под отвечает отказом. Если kube-proxy остановлен, старые правила продолжают работать, а для новых Service правил нет, и запрос висит до тайм-аута.',
        'A [[k8s.service|Service]] is an object with a selector and ports: "pods app=web, port 80 → targetPort 80". On creation it gets a [[k8s.clusterip|ClusterIP]] from the `10.43.0.0/16` range, and that address does not change however pods come and go.\n\nWho knows which pods stand behind the Service right now? The EndpointSlice controller: it finds pods by the selector and writes their addresses into an [[k8s.endpointslice|EndpointSlice]] object — with a flag saying whether each is ready (`ready`). (The old Endpoints object did the same but is deprecated; kubectl warns you if you ask for it.)\n\nAnd who turns the Service address into a pod address? Not the Service itself — it is just a record. Every node runs [[k8s.kube-proxy|kube-proxy]]: it watches Services and EndpointSlices and writes netfilter rules into the node kernel. A packet to `10.43.12.7:80` enters the `KUBE-SERVICES` chain, from there the `KUBE-SVC-…` chain of this Service, where rules with probabilities pick one of the `KUBE-SEP-…` chains, and that one DNATs to `10.42.1.15:80`. conntrack translates the reply back. The ClusterIP is on no interface — it is an address that exists only in rules.\n\nHence three typical breaks. The selector does not match the labels — the EndpointSlice is empty, kube-proxy writes a `REJECT` rule, and curl gets "connection refused" at once. A wrong `targetPort` — the packet arrives at a pod port where nobody listens, and the pod answers RST. kube-proxy is stopped — old rules live on, but new Services get no rules, and a request hangs until it times out.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как адрес Service превращается в адрес пода', 'How a Service address becomes a pod address'),
      body: bi(
        'Схема ниже показывает, что происходит, когда под client выполняет `curl http://web`. Сначала на ней под client и три пода сервиса web внизу. По ходу запроса появятся CoreDNS, который превращает имя в адрес Service, сам Service и его EndpointSlice со списком готовых подов, kube-proxy и полоса правил в ядре узла, через которую проходит каждый пакет.',
        'The diagram below shows what happens when pod client runs `curl http://web`. At first: pod client and the three pods of Service web at the bottom. As the request goes, CoreDNS, the Service with its EndpointSlice, kube-proxy and the strip of kernel rules appear.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.service-path', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Следите прежде всего за карточкой на линии, потому что на ней написан адрес назначения пакета. Сначала это 10.43.12.7, адрес Service, а после шага «новый адрес» — адрес одного из подов. На этом шаге Service и делает свою работу: ядро узла подменяет его адрес адресом пода. Под схемой показано, как сто запросов разошлись по подам.\n\nПотом меняйте в «Параметрах» число подов и посмотрите, как пересчитываются вероятности правил. Включите keep-alive, то есть повторное использование одного соединения для многих запросов, и сравните, как теперь распределятся запросы. Напоследок по очереди включите в блоке «Сломать» опечатку в селекторе, неверный targetPort и остановленный kube-proxy и запомните, чем отличаются сообщения curl.', 'Press “Start from the first step”, then go on with “Step forward”. Watch above all the card on the line: it carries the packet’s destination address. First it is 10.43.12.7, the Service address, and after the “rewrite” step it is the address of one of the pods. That step is where the Service does its work: the node kernel replaces the Service address with a pod address. Under the diagram you see how 100 requests spread over the pods.\n\nThen change the pod count in “Parameters” and see how the rule probabilities are recalculated. Turn on keep-alive, that is, reusing one connection for many requests, and compare how the requests spread now. Finally, in “Break it”, switch on the selector typo, the wrong targetPort and the stopped kube-proxy one at a time and note how curl’s messages differ.'), caption: bi('Три поломки, которые вы видели на схеме, отличаются по поведению curl: пустой EndpointSlice и неверный targetPort дают мгновенный отказ, а остановленный kube-proxy — долгое ожидание. В лабораторной работе ниже вы найдёте настоящее правило KUBE-SERVICES в таблице узла, а в последнем задании почините Service с пустым EndpointSlice.', 'The three breaks in the diagram differ in how curl behaves: an empty EndpointSlice and a wrong targetPort give an instant refusal, a stopped kube-proxy a long wait. In the lab below you find the real KUBE-SERVICES rule in the node table, and in the last task you fix a Service with an empty EndpointSlice.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: SERVICE_LAB,
      intro: bi('В кластере работает Deployment `web` на три пода и под `client`. Команда `cluster iptables worker-1` печатает таблицу NAT узла так же, как `iptables-save -t nat`.', 'Deployment `web` (3 pods) and pod `client`. `cluster iptables worker-1` prints the node’s NAT table, like `iptables-save -t nat`.'),
      tasks: [
        {
          id: 'expose',
          prompt: bi('Дайте Deployment `web` постоянный адрес, создав для него Service `web` на порту 80.', 'Give Deployment `web` a permanent address: a Service `web` on port 80.'),
          check: { when: 'k8s.services[ns=default][name=web].endpoints=3' },
          chips: 'kubectl expose deployment web --port=80',
          concepts: ['k8s.service'],
          docRef: { page: 'help/kubectl-expose', anchor: 'EXAMPLES', line: 'kubectl expose deployment nginx --port=80 --target-port=8000' },
          hints: { H1: bi('Service для существующего Deployment создаёт команда kubectl expose.', 'kubectl expose creates a Service for an existing Deployment.') },
        },
        {
          id: 'curl',
          prompt: bi('Из пода `client` обратитесь к Service по имени `web` и получите ответ.', 'From pod `client`, reach the Service by the name `web` and get an answer.'),
          check: { when: "k8s.reach[from='default/client'][to='web.default'].status=200", stdout: /Hello from web-/ },
          chips: 'kubectl exec client -- curl -s http://web',
          hints: { H1: bi('Имя Service работает так же, как имя хоста.', 'The Service name works as a host name.') },
        },
        {
          id: 'slices',
          prompt: bi('Увеличьте Deployment до пяти подов и убедитесь, что в EndpointSlice сервиса стало пять адресов.', 'Scale the Deployment to 5 pods and make sure the Service’s EndpointSlice now has 5 addresses.'),
          check: { when: 'k8s.services[ns=default][name=web].endpoints=5', stdout: /web-\w+\s+IPv4\s+80\s+.*\+ 2 more/ },
          chips: 'kubectl scale deployment web --replicas=5 && kubectl get endpointslices -l kubernetes.io/service-name=web',
          concepts: ['k8s.endpointslice'],
          hints: { H1: bi('EndpointSlice сервиса находят по метке kubernetes.io/service-name.', 'A Service’s EndpointSlices are found by the label kubernetes.io/service-name.') },
        },
        {
          id: 'rule',
          prompt: bi('Найдите в таблице NAT узла правило, которое перехватывает ClusterIP сервиса `web`, и сохраните его строку в файл `~/rule.txt`.', 'Find the rule in the node’s NAT table that catches the ClusterIP of Service `web`, and save its line to `~/rule.txt`.'),
          check: { when: "files['/home/learner/rule.txt'].text~'-A KUBE-SERVICES' && files['/home/learner/rule.txt'].text~'default/web cluster IP'" },
          chips: 'cluster iptables worker-1 | grep "default/web cluster IP" | grep KUBE-SERVICES > rule.txt',
          concepts: ['k8s.kube-proxy', 'k8s.clusterip'],
          hints: { H1: bi('ClusterIP покажет команда `kubectl get svc web`, а нужное правило стоит в цепочке KUBE-SERVICES.', '`kubectl get svc web` shows the ClusterIP; the rule is in the KUBE-SERVICES chain.'), H2: bi('Отфильтруйте вывод `cluster iptables worker-1` командой grep и перенаправьте результат в файл.', 'Filter the output of `cluster iptables worker-1` through grep and redirect it into the file.') },
        },
        {
          id: 'affinity',
          prompt: bi('Найдите в справке `kubectl explain service.spec` поле, которое закрепляет клиента за одним подом, и включите его для `web` так, чтобы клиента узнавали по IP-адресу.', 'Find in `kubectl explain service.spec` the field that pins a client to one pod, and turn it on for `web` (by client IP).'),
          check: { when: 'k8s.objects[kind=Service][metadata.name=web].spec.sessionAffinity=ClientIP' },
          chips: 'kubectl patch service web -p \'{"spec":{"sessionAffinity":"ClientIP"}}\'',
          docRef: { page: 'explain/service.spec', anchor: 'FIELDS', line: 'sessionAffinity' },
          docStep: 3,
          hints: { H1: bi('Поле ищите в разделе FIELDS, а поменять одно поле можно командой kubectl patch.', 'Look for the field in the FIELDS section; kubectl patch changes one field.') },
        },
      ],
    },
    {
      id: 'broken',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: SERVICE_BROKEN,
      intro: bi('В namespace `prod` работают Deployment `api` на два пода и Service `api`, который не отвечает.', 'Namespace `prod`: Deployment `api` (2 pods) and a Service `api` that does not answer.'),
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
            fail: [{ if: (f) => k8s(f).pods.filter((p) => p.ns === 'prod' && p.labels.app === 'api-v2').length < 2, say: bi('Поды пересоздавать не нужно, потому что чинить нужно Service, а не Deployment.', 'There is no need to recreate the pods: fix the Service, not the Deployment.') }],
          },
          chips: 'kubectl -n prod get endpointslices,svc,pods --show-labels',
          concepts: ['k8s.service', 'k8s.endpointslice'],
          hints: {
            H1: bi('Сравните, какие поды ищет Service и какие метки стоят у подов.', 'Compare whom the Service looks for with the labels the pods have.'),
            H2: bi('Пустой EndpointSlice означает, что селектор не нашёл ни одного пода.', 'An empty EndpointSlice means the selector found no pod.'),
            H3: bi('Выполните `kubectl -n prod get svc api -o wide` и `kubectl -n prod get pods --show-labels`, а селектор поправьте командой `kubectl -n prod patch svc api -p …`.', '`kubectl -n prod get svc api -o wide` and `kubectl -n prod get pods --show-labels`; the selector is fixed with `kubectl -n prod patch svc api -p …`.'),
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
    prompt: bi('Под работает в namespace `shop`. Допишите имя так, чтобы обратиться к Service `api` из namespace `prod`.', 'A pod in namespace `shop`. Complete the name to reach Service `api` in namespace `prod`.'),
    template: 'curl http://___',
    answers: ['curl http://api.prod', 'curl http://api.prod.svc', 'curl http://api.prod.svc.cluster.local', 'curl http://api.prod.svc.cluster.local.'],
    misconceptions: [{ match: 'http://api$', why: bi('Короткое имя резолвер дополняет namespace пода: api превратится в api.shop.svc.cluster.local, а такого Service нет.', 'A short name is completed with the pod’s namespace: api becomes api.shop.svc.cluster.local, and there is no such Service.') }],
  },
  {
    id: 'k8s.q.dns.ndots',
    kind: 'mcq',
    concepts: ['k8s.cluster-dns'],
    prompt: bi('Под с ndots:5 ищет адрес api.github.com. Почему запросов к CoreDNS так много?', 'With ndots:5 a pod resolves api.github.com. Why are there so many queries to CoreDNS?'),
    options: [
      { id: 'search', text: bi('В имени меньше пяти точек, и резолвер сначала пробует его с каждым доменом из search', 'The name has fewer than five dots, so the resolver first tries it with every search domain'), correct: true },
      { id: 'cache', text: bi('У CoreDNS выключен кэш', 'The CoreDNS cache is off'), why: bi('Кэш экономит работу CoreDNS, но варианты имени перебирает резолвер пода, а не сервер.', 'The cache saves CoreDNS work, but the walk over candidates is done by the pod resolver, not the server.') },
    ],
    explain: bi('Имя с точкой на конце (api.github.com.) абсолютное: домены search к нему не дописываются, и уходит всего два запроса, A и AAAA.', 'A name with a trailing dot (api.github.com.) is absolute: search does not apply, two queries go out — A and AAAA.'),
    refs: { explainer: 'k8s.ndots' },
  },
];

export const dnsLesson: Lesson = {
  id: 'k8s-1.dns',
  block: 'k8s-1',
  title: bi('DNS кластера', 'Cluster DNS'),
  summary: bi('Как имя Service превращается в адрес, что делает CoreDNS, зачем поду список search и во что обходится ndots.', 'A Service name, CoreDNS, the search list and the cost of ndots.'),
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
      title: bi('Как работает имя Service', 'A Service name'),
      body: bi(
        'В прошлом уроке curl обращался к `web`, и это работало. Работу сделал [[k8s.cluster-dns|DNS кластера]]: CoreDNS, который работает подами в kube-system за Service `kube-dns` с адресом `10.43.0.10`. На имена вида `<service>.<namespace>.svc.cluster.local` он отвечает адресом ClusterIP.\n\nКороткое имя дополняет сам под. kubelet записывает ему файл `/etc/resolv.conf`:\n\n```\nsearch shop.svc.cluster.local svc.cluster.local cluster.local\nnameserver 10.43.0.10\noptions ndots:5\n```\n\nПоэтому в поде из namespace `shop` имя `web` превращается в `web.shop.svc.cluster.local`, то есть в Service своего namespace. Чтобы обратиться к Service из другого namespace, нужно написать хотя бы `api.prod`.\n\nУ этого удобства есть цена. Правило `ndots:5` означает: если в имени меньше пяти точек, сначала попробуй дописать к нему каждый домен из search. Для `api.github.com` это три лишних пары запросов A и AAAA с ответом NXDOMAIN, прежде чем резолвер спросит само имя. Точка на конце (`api.github.com.`) делает имя абсолютным и отключает перебор.',
        'In the previous lesson curl went to `web` — and it worked. The [[k8s.cluster-dns|cluster DNS]] did the job: CoreDNS, running as pods in kube-system behind the `kube-dns` Service at `10.43.0.10`. It answers names like `<service>.<namespace>.svc.cluster.local` with the ClusterIP.\n\nThe pod itself completes a short name. The kubelet writes its `/etc/resolv.conf`:\n\n```\nsearch shop.svc.cluster.local svc.cluster.local cluster.local\nnameserver 10.43.0.10\noptions ndots:5\n```\n\nFrom a pod in namespace `shop` the name `web` turns into `web.shop.svc.cluster.local` — the Service of its own namespace. To call a Service in another namespace you need at least `api.prod`.\n\nThe convenience has a price. `ndots:5` means: if the name has fewer than five dots, first try it with every search domain. For `api.github.com` that is three extra rounds of A and AAAA answered NXDOMAIN before the real name is tried. A trailing dot (`api.github.com.`) makes the name absolute and switches the walk off.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Сколько стоит поиск короткого имени', 'What a short-name lookup costs'),
      body: bi(
        'Схема ниже показывает, как резолвер пода ищет адрес по имени. Сначала на ней под в namespace shop и его файл `/etc/resolv.conf`. Когда резолвер начнёт задавать вопросы, появятся CoreDNS, зона cluster.local с именами сервисов и внешний сервер DNS.',
        'The diagram below shows how a pod’s resolver looks up a name. At first: a pod in namespace shop and its `/etc/resolv.conf`. CoreDNS, the cluster.local zone and the upstream DNS appear as the resolver asks.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.ndots', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Приложение ищет api.github.com, и на каждом шаге резолвер отправляет в CoreDNS один вариант этого имени. Вариант написан на карточке, которая движется по линии. Жёлтая рамка у зоны или у внешнего сервера означает ответ «такого имени нет», зелёная — что имя нашлось. Счётчик под схемой показывает, сколько запросов ушло в CoreDNS.\n\nПотом выберите в «Параметрах» короткое имя web, имя web.prod и имя с точкой на конце и сравните счётчик. Если у вас уровень выше начального, поменяйте и ndots, то есть число точек, начиная с которого резолвер сначала спрашивает имя как есть.', 'Press “Start from the first step”, then go on with “Step forward”. The application looks up api.github.com, and at each step the resolver sends CoreDNS one candidate of that name. The candidate is written on the card moving along the line. A yellow outline on the zone or the upstream server means “no such name”, a green one means the name was found. The counter under the diagram shows how many queries went to CoreDNS.\n\nThen choose the short name web, the name web.prod and the name with a final dot in “Parameters” and compare the counter. Above beginner level, change ndots too, that is, the number of dots from which the resolver first asks for the name as it is.'), caption: bi('Счётчик запросов на схеме покажет то же, что вы увидите на настоящем поде: внешнее имя без точки на конце стоит восьми запросов вместо двух. В лабораторной работе ниже посмотрите файл `/etc/resolv.conf` пода `client` и обратитесь к Service из другого namespace по имени с namespace.', 'The query counter shows what you would see on a real pod: an external name without a final dot costs eight queries instead of two. In the lab below look at the `/etc/resolv.conf` of pod `client` and reach a Service in another namespace by a name with the namespace.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: DNS_LAB,
      intro: bi('Под `client` работает в namespace `shop`. Рядом есть Service `web` в namespace `shop` и Service `api` в namespace `prod`.', 'Pod `client` lives in namespace `shop`. Next to it: Service `web` in `shop` and Service `api` in `prod`.'),
      tasks: [
        {
          id: 'resolv',
          prompt: bi('Посмотрите, что записано в файле resolv.conf пода `client`.', 'Look at the resolv.conf of pod `client`.'),
          check: { stdout: /search shop\.svc\.cluster\.local svc\.cluster\.local cluster\.local[\s\S]*ndots:5/ },
          chips: 'kubectl -n shop exec client -- cat /etc/resolv.conf',
          hints: { H1: bi('Под работает в namespace shop, поэтому не забудьте флаг -n.', 'The pod is in namespace shop: do not forget -n.') },
        },
        {
          id: 'other-ns',
          prompt: bi('Из пода `client` получите ответ от Service `api` из namespace `prod`.', 'From pod `client`, get an answer from Service `api` in namespace `prod`.'),
          check: { stdout: /Hello from api-/, fail: [{ if: "term['main'][last].out~'Could not resolve host: api'", say: bi('Короткое имя `api` дополнилось до api.shop.svc.cluster.local, а Service с таким именем в shop нет. Добавьте к имени namespace.', 'The short name `api` was completed to api.shop.svc.cluster.local — there is no such Service in shop. Add the namespace to the name.') }] },
          chips: 'kubectl -n shop exec client -- curl -s http://api.prod',
          concepts: ['k8s.cluster-dns'],
          hints: { H1: bi('Короткое имя ищется только в своём namespace.', 'A short name is looked up only in its own namespace.') },
        },
        {
          id: 'nslookup',
          prompt: bi('Узнайте через DNS адрес Service `kubernetes` из namespace `default`.', 'Find the address of Service `kubernetes` in namespace `default` through DNS.'),
          check: { stdout: /Name:\s+kubernetes\.default\.svc\.cluster\.local\s+Address: 10\.43\.0\.1/ },
          chips: 'kubectl -n shop exec client -- nslookup kubernetes.default',
          hints: { H1: bi('В поде client есть программа nslookup.', 'Pod client has nslookup.') },
        },
      ],
    },
    {
      id: 'coredns',
      kind: 'text',
      step: 'explain',
      title: bi('Когда не отвечает сам CoreDNS', 'When CoreDNS itself is silent'),
      body: bi(
        'CoreDNS — обычный Deployment в namespace kube-system, и ломается он так же, как обычный Deployment: его масштабировали до нуля, его поды не помещаются на узлы или испорчен ConfigMap с его настройками (Corefile). Признак узнаётся сразу: по IP-адресам всё отвечает, а любое имя, и внутреннее, и внешнее, даёт тайм-аут, потому что на `10.43.0.10:53` никто не отвечает. Если же внутренние имена находятся, а внешние дают SERVFAIL, смотрите строку `forward` в Corefile: она пересылает внешние имена дальше, к DNS узла.',
        'CoreDNS is an ordinary Deployment in kube-system, and it breaks like an ordinary Deployment: it was scaled to zero, its pods do not fit on the nodes, its ConfigMap with the Corefile is spoilt. The sign is easy to recognise: everything answers by IP, while any name — internal or external — times out, because nobody answers on `10.43.0.10:53`. If internal names work while external ones answer SERVFAIL, look at the `forward` line in the Corefile: it sends foreign names on, to the node DNS.',
      ),
    },
    {
      id: 'broken',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: DNS_BROKEN,
      intro: bi('В namespace `shop` работают Deployment и Service `web` и под `client`. Жалоба звучит так: «в кластере ничего не открывается по имени».', 'Namespace `shop`: a Deployment and a Service `web`, a pod `client`. The complaint: "nothing in the cluster opens by name".'),
      tasks: [
        {
          id: 'fix',
          prompt: bi('Выясните, почему имена не превращаются в адреса, и почините это: `client` должен снова получать ответ от `web` по имени.', 'Find out why names do not resolve and fix it: `client` must get an answer from `web` by name again.'),
          check: { when: "k8s.reach[from='shop/client'][to='web.shop'].status=200 && k8s.pods[ns=kube-system][name~'coredns'][ready=true]#>=1" },
          chips: 'kubectl -n kube-system get deploy,pods -l k8s-app=kube-dns',
          concepts: ['k8s.cluster-dns'],
          hints: {
            H1: bi('Сравните, отвечает ли web по адресу Service и по имени. Если по адресу отвечает, а по имени тайм-аут, выясните, кто должен отвечать на 10.43.0.10.', 'Compare: does web answer by the Service IP and by name? If by IP yes and by name a timeout — ask who answers on 10.43.0.10.'),
            H2: bi('Посмотрите на Deployment coredns в kube-system: сколько у него реплик?', 'Look at the coredns Deployment in kube-system: how many replicas does it have?'),
          },
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
    prompt: bi('Браузер получил 504 Gateway Timeout от сайта, который стоит за Gateway. Кто составил этот ответ?', 'The browser got 504 Gateway Timeout from a site behind a Gateway. Who produced that reply?'),
    options: [
      { id: 'proxy', text: bi('Обратный прокси контроллера входа, которому под не ответил за отведённое время', 'The reverse proxy of the ingress controller: the pod did not answer within its timeout'), correct: true },
      { id: 'app', text: bi('Приложение в поде', 'The application in the pod'), why: bi('Приложение, возможно, ещё работает над ответом. Код 504 означает «тот, кто стоит за мной, не ответил вовремя», и так говорит прокси.', 'The application may still be working on the answer. 504 means "whoever is behind me did not answer in time" — that is the proxy speaking.') },
      { id: 'proxyk', text: 'kube-proxy', why: bi('kube-proxy не видит HTTP и ответов не пишет, потому что он только переписывает адреса пакетов.', 'kube-proxy does not see HTTP and writes no replies: it only rewrites packet addresses.') },
    ],
    refs: { explainer: 'k8s.ingress-path' },
  },
  {
    id: 'k8s.q.in.nginx',
    kind: 'mcq',
    concepts: ['k8s.ingress'],
    prompt: bi('Почему в новых кластерах в 2026 году не ставят ingress-nginx?', 'Why do new clusters in 2026 not install ingress-nginx?'),
    options: [
      { id: 'retired', text: bi('Проект снят с поддержки в марте 2026 года, и обновлений безопасности больше не будет', 'The project was retired in March 2026: no more security updates'), correct: true },
      { id: 'removed', text: bi('Объект Ingress удалён из Kubernetes', 'The Ingress object was removed from Kubernetes'), why: bi('API Ingress остался, но заморожен. Закрылся один из контроллеров, а новые возможности появляются в Gateway API.', 'The Ingress API stays, frozen; one of the controllers closed, and new features go into the Gateway API.') },
    ],
  },
  {
    id: 'k8s.q.in.nodeport',
    kind: 'mcq',
    concepts: ['k8s.nodeport'],
    prompt: bi('Service типа NodePort получил порт 30080. Где этот порт открыт?', 'A NodePort Service got port 30080. Where is it open?'),
    options: [
      { id: 'all', text: bi('На каждом узле кластера', 'On every node of the cluster'), correct: true },
      { id: 'pod', text: bi('Только на узле, где работает под', 'Only on the node where the pod runs'), why: bi('kube-proxy записывает правило KUBE-NODEPORTS на всех узлах. Если на узле нет пода, пакет уйдёт к поду на соседнем узле (при externalTrafficPolicy: Cluster).', 'kube-proxy writes the KUBE-NODEPORTS rule on every node; with no pod on the node the packet goes to a pod on another one (with externalTrafficPolicy: Cluster).') },
    ],
  },
];

export const ingressLesson: Lesson = {
  id: 'k8s-1.ingress',
  block: 'k8s-1',
  title: bi('Как запросы попадают в кластер снаружи через NodePort, LoadBalancer, Ingress и Gateway API', 'The way in: NodePort, LoadBalancer, Ingress and Gateway API'),
  summary: bi('Как запрос из интернета доходит до пода и откуда берутся ошибки 502 и 504.', 'How a request from the internet reaches a pod, and where 502 and 504 come from.'),
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
      title: bi('Три ступени входа в кластер', 'Three steps of the way in'),
      body: bi(
        'ClusterIP доступен только изнутри кластера. Чтобы впустить трафик снаружи, у Service есть ещё два типа.\n\n[[k8s.nodeport|NodePort]] открывает на **каждом** узле порт из диапазона 30000–32767 и ведёт его на Service правилом `KUBE-NODEPORTS`. Клиенту достаточно знать IP-адрес любого узла. LoadBalancer — следующая ступень: кто-то снаружи выдаёт Service внешний IP-адрес и ставит перед узлами балансировщик. В облаке это делает облачный контроллер, в k3s — встроенный ServiceLB, а в собственном дата-центре — MetalLB.\n\nДля сайтов этого мало: нужны правила по имени сайта и пути, TLS и перенаправления. Это работа обратного прокси из блока о сетях, который в кластере работает подами и называется контроллером входа. Правила для него записывают объектом [[k8s.ingress|Ingress]], старым способом «сайт и путь ведут на Service», или средствами [[k8s.gateway-api|Gateway API]]. В Gateway API обязанности разделены: GatewayClass описывает реализацию и относится к инфраструктуре, Gateway описывает точку входа и принадлежит администратору кластера, а HTTPRoute описывает маршруты приложения и принадлежит его команде. API Ingress заморожен, а самый популярный контроллер, ingress-nginx, снят с поддержки в марте 2026 года, поэтому новые кластеры строят вход на Gateway API.\n\nВажно понимать, откуда берутся ошибки. Прокси открывает к Service **новое** соединение. Если готовых подов нет, ответ 503 пишет прокси. Если под оборвал соединение, прокси отвечает 502. Если под отвечает дольше, чем прокси готов ждать, прокси отвечает 504, хотя приложение в этот момент ещё трудится над ответом.',
        'A ClusterIP is reachable only from inside the cluster. To let external traffic in, a Service has two more types.\n\n[[k8s.nodeport|NodePort]] opens a port from the 30000–32767 range on **every** node and leads it to the Service (the `KUBE-NODEPORTS` rule). A client only needs the IP of any node. LoadBalancer is the next step: something outside gives the Service an external IP and puts a load balancer in front of the nodes. In a cloud the cloud controller does it, in k3s the built-in ServiceLB, in your own data centre MetalLB.\n\nFor websites that is not enough: you need rules by host name and path, TLS, redirects. That is the job of the reverse proxy from the networks block, run in the cluster as pods — an ingress controller. Its rules are written as an [[k8s.ingress|Ingress]] object (the historical way: host + path → service) or with the [[k8s.gateway-api|Gateway API]]: a GatewayClass describes the implementation (infrastructure), a Gateway the entry point (the cluster admin), an HTTPRoute the routes of an application (its team). The Ingress API is frozen, and the most popular controller, ingress-nginx, was retired in March 2026; new clusters build the way in on the Gateway API.\n\nIt matters where errors come from. The proxy opens a **new** connection to the Service. If there are no ready pods, the 503 is written by the proxy. If the pod dropped the connection — 502. If the pod takes longer than the proxy is willing to wait — 504, and that is the proxy too: the application is still working on its answer at that moment.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Путь запроса из интернета до пода', 'The path of a request from the internet to a pod'),
      body: bi(
        'Схема ниже показывает, как запрос браузера к shop.example.test доходит до пода приложения и откуда берутся ошибки. Сначала на ней только браузер и под. Между ними по ходу запроса появятся балансировщик, узел с портом NodePort, контроллер входа (обратный прокси Traefik) с правилом маршрута и обычный Service.',
        'The diagram below shows how a browser request to shop.example.test reaches the pod and where errors come from. At first only the browser and the pod. The load balancer, the node with its NodePort, the ingress controller (Traefik) with its route rule and an ordinary Service appear as the request goes.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.ingress-path', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». На карточке на линии написано, что передаётся дальше: запрос, адрес узла, адрес отправителя после узла и заголовок X-Forwarded-For после прокси. Обратите внимание на шаг «новое соединение»: соединение браузера заканчивается на прокси, а к поду идёт уже другое. Под схемой показан код ответа и сколько секунд ждал браузер.\n\nПотом увеличьте в «Параметрах» время, за которое под готовит ответ, сверх таймаута прокси и посмотрите, кто ответит 504. Затем включите в блоке «Сломать» по очереди две поломки: у Service не осталось готовых подов, и приложение обрывает соединение посреди ответа. Если у вас уровень выше начального, переключите и externalTrafficPolicy.', 'Press “Start from the first step”, then go on with “Step forward”. The card on the line shows what is handed on: the request, the node address, the source address after the node and the X-Forwarded-For header after the proxy. Note the “new connection” step: the browser’s connection ends at the proxy, and a different one goes to the pod. Under the diagram you see the response code and how many seconds the browser waited.\n\nThen raise the pod’s response time in “Parameters” above the proxy timeout and see who answers 504. Next, in “Break it”, switch on two breaks one at a time: the Service has no ready pods left, and the application drops the connection in the middle of the response. Above beginner level, switch externalTrafficPolicy too.'), caption: bi('Коды 502, 503 и 504, которые вы видели на схеме, пишет прокси, а не приложение, поэтому, встретив их, начинайте с логов контроллера входа и с EndpointSlice сервиса. В лабораторной работе ниже вы откроете Service снаружи двумя способами: через NodePort и через `kubectl port-forward`.', 'The 502, 503 and 504 you saw in the diagram are written by the proxy, not the application, so when you meet them start with the ingress controller logs and the Service’s EndpointSlice. In the lab below you open a Service from outside in two ways: through a NodePort and through `kubectl port-forward`.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: INGRESS_LAB,
      intro: bi('В кластере работают Deployment `web` на два пода и Service `web` типа ClusterIP.', 'Deployment `web` (2 pods) and a ClusterIP Service `web`.'),
      tasks: [
        {
          id: 'nodeport',
          prompt: bi('Создайте для того же Deployment второй Service `web-np` типа NodePort на порту 80.', 'Create a second Service `web-np` for the same Deployment — of type NodePort, port 80.'),
          check: { when: "k8s.services[name=web-np][type=NodePort].endpoints=2" },
          chips: 'kubectl expose deployment web --name=web-np --type=NodePort --port=80',
          concepts: ['k8s.nodeport'],
          docRef: { page: 'help/kubectl-expose', anchor: 'OPTIONS', line: '--type' },
          hints: { H1: bi('У команды expose есть флаги для имени и для типа Service.', 'expose has flags for the name and the type.') },
        },
        {
          id: 'pf',
          prompt: bi('Откройте Service `web` на своём компьютере командой `kubectl port-forward` на локальном порту 8080 и загрузите страницу командой `cluster open http://localhost:8080/`.', 'Open Service `web` on your machine with `kubectl port-forward` (local port 8080) and load the page with `cluster open http://localhost:8080/`.'),
          check: { stdout: /HTTP 200[\s\S]*Hello from web-/ },
          chips: 'kubectl port-forward svc/web 8080:80 && cluster open http://localhost:8080/',
          docRef: { page: 'help/kubectl-port-forward', anchor: 'EXAMPLES', line: 'kubectl port-forward pod/mypod 8888:5000' },
          hints: { H1: bi('port-forward принимает объект в виде ТИП/ИМЯ и пару портов «локальный:удалённый».', 'port-forward takes TYPE/NAME and a "local:remote" port pair.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ingressQuiz.map((q) => q.id) },
    { id: 'note', kind: 'callout', tone: 'note', step: 'review', body: bi('Учебный кластер в браузере объекты Gateway и HTTPRoute не исполняет. На этапе 2, в настоящем k3s, вы включите поддержку Gateway API во встроенном Traefik и опубликуете через него свой сервис.', 'Gateways and HTTPRoutes are not executed in the browser training cluster yet; at stage 2, on a real k3s, you will enable the Gateway API provider of the built-in Traefik and publish your service through it.') },
  ],
};

// ── KN7 + KN8 ───────────────────────────────────────────────────────────────

export const troubleQuiz: QuizItem[] = [
  {
    id: 'k8s.q.tr.ladder',
    kind: 'order',
    concepts: ['k8s.networkpolicy', 'k8s.service'],
    prompt: bi('Под не может обратиться к сервису. Расставьте шаги проверки по порядку.', 'A pod cannot reach a service. Put the steps of the check in order.'),
    steps: [
      { id: 'dns', text: bi('Проверить DNS, то есть превращается ли имя в адрес при запросе nslookup из пода', 'DNS: does the name resolve (nslookup from the pod)') },
      { id: 'svc', text: bi('Проверить, верны ли у Service адрес ClusterIP и порт', 'Service: are the ClusterIP and port right') },
      { id: 'eps', text: bi('Проверить, есть ли в EndpointSlice готовые адреса', 'EndpointSlice: are there ready addresses') },
      { id: 'pod', text: bi('Проверить, отвечает ли сам под по своему IP и порту targetPort', 'Pod: does it answer by its IP and targetPort') },
      { id: 'np', text: bi('Проверить, не отсекает ли трафик политика NetworkPolicy', 'NetworkPolicy: does a policy drop it'), why: bi('Политику проверяют, когда уже ясно, что сам под по своему IP отвечает тем клиентам, которым это разрешено. Иначе её не отличить от сломанного пода.', 'The policy is checked once the pod answers by IP for allowed clients — otherwise you cannot tell it from a broken pod.') },
    ],
  },
  {
    id: 'k8s.q.tr.cni',
    kind: 'mcq',
    concepts: ['k8s.networkpolicy', 'k8s.cni'],
    prompt: bi('NetworkPolicy создана, API её принял, а трафик не блокируется. Какая причина вероятнее всего?', 'A NetworkPolicy is created, the API accepted it, yet traffic is not blocked. The most likely reason?'),
    options: [
      { id: 'cni', text: bi('Плагин сети кластера не применяет NetworkPolicy (например, чистый flannel)', 'The cluster CNI does not enforce NetworkPolicy (plain flannel, for example)'), correct: true },
      { id: 'kp', text: bi('Политику должен применить kube-proxy, а он не успел', 'kube-proxy has to apply the policy and it lags behind'), why: bi('Политиками занимается не kube-proxy, а сетевой плагин.', 'kube-proxy has nothing to do with policies: the network plugin enforces them.') },
    ],
    explain: bi('API хранит любые объекты, но исполняет их тот, кто за ними следит. Calico, Cilium и встроенный в k3s kube-router политики применяют, а чистый flannel нет.', 'The API stores any object, but it is executed by whoever watches it. Calico, Cilium and the kube-router built into k3s enforce policies, plain flannel does not.'),
  },
];

export const troubleshootLesson: Lesson = {
  id: 'k8s-1.troubleshoot',
  block: 'k8s-1',
  title: bi('Как искать причину, когда под не может обратиться к сервису', 'The "a pod cannot reach the service" method'),
  summary: bi('Лестница проверок проходит по ступеням DNS, Service, EndpointSlice, под и NetworkPolicy, и у каждой ступени своя поломка и свой признак.', 'The ladder of layers: DNS → Service → EndpointSlice → pod → NetworkPolicy. Each step has its own break and its own sign.'),
  introduces: [],
  uses: ['k8s.service', 'k8s.endpointslice', 'k8s.cluster-dns', 'k8s.cni', 'k8s.label', 'k8s.namespace', 'k8s.networkpolicy'],
  tier: 'core',
  minutes: 40,
  sources: src([S.netpol, S.debugService], [R.service, R.dns]),
  sections: [
    {
      id: 'ladder',
      kind: 'text',
      step: 'explain',
      title: bi('Лестница проверок', 'The ladder of layers'),
      body: bi(
        'Чаще всего в кластере жалуются, что под не может обратиться к сервису. Как и в блоке о сетях, сначала выясните, на каком уровне сломалось, и идите по ступеням сверху вниз, потому что на каждой ступени поломка выглядит по-своему.\n\n1. **DNS.** Выполните `kubectl exec client -- nslookup web.shop`. Ответ «can\'t find … NXDOMAIN» означает, что такого имени нет, потому что в нём опечатка или Service находится в другом namespace. Тайм-аут означает, что не работает CoreDNS.\n2. **Service.** Выполните `kubectl get svc web -o wide` и проверьте ClusterIP, порт и селектор.\n3. **EndpointSlice.** Выполните `kubectl get endpointslices -l kubernetes.io/service-name=web`. Пустой список означает, что селектор не нашёл подов или они не готовы, и `curl` получит отказ в соединении.\n4. **Под.** Выполните `kubectl get pods -o wide` и `curl <IP пода>:<targetPort>` из клиента. Если под не отвечает по своему адресу, проверьте targetPort, процесс и логи.\n5. **NetworkPolicy.** Выполните `kubectl get netpol -A` и `kubectl describe netpol` и проверьте, выбирает ли политика под назначения и пускает ли она этого клиента. Такую поломку выдаёт тайм-аут при работающем поде.\n\nЗаписывайте, что вы уже проверили, потому что на собеседовании и при разборе инцидента ценят не угаданный ответ, а пройденную лестницу.',
        '"A pod cannot reach a service" is the most common complaint in a cluster. As in the networks block, first ask which layer broke, and walk the steps from the top down; on each step a break looks different.\n\n1. **DNS.** `kubectl exec client -- nslookup web.shop`. "can\'t find … NXDOMAIN" — there is no such name: a typo or another namespace. A timeout — CoreDNS is not working.\n2. **Service.** `kubectl get svc web -o wide`: the right ClusterIP, the right port, which selector.\n3. **EndpointSlice.** `kubectl get endpointslices -l kubernetes.io/service-name=web`: empty — the selector found no pods or they are not ready; `curl` gets "connection refused".\n4. **Pod.** `kubectl get pods -o wide` and `curl <pod IP>:<targetPort>` from the client: if it does not answer by IP, look at the targetPort, the process, the logs.\n5. **NetworkPolicy.** `kubectl get netpol -A` and `kubectl describe netpol`: does a policy select the destination pod, and does it allow this client. The sign is a timeout while the pod is alive.\n\nWrite down what you checked: in an incident review what counts is not a guessed answer but the ladder walked.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: TROUBLE_LAB,
      intro: bi('Под `client` в namespace `shop` не может обратиться ни к `web` в namespace shop, ни к `pay` в namespace pay. Поломок несколько, и они на разных ступенях.', 'Pod `client` in namespace `shop` cannot reach either `web` (in shop) or `pay` (in namespace pay). There are several breaks on different steps.'),
      tasks: [
        {
          id: 'web',
          prompt: bi('Добейтесь, чтобы `client` получал ответ от `web` в namespace `shop`. Поды не пересоздавайте.', 'Make `client` get an answer from `web` in namespace `shop`. Do not recreate the pods.'),
          check: { when: "k8s.reach[from='shop/client'][to='web.shop'].status=200" },
          chips: 'kubectl -n shop get svc web -o wide',
          concepts: ['k8s.service', 'k8s.endpointslice'],
          hints: {
            H1: bi('Имя находится, адреса в EndpointSlice есть, а curl почти мгновенно получает отказ в соединении. Какая ступень следующая?', 'The name resolves, the EndpointSlice has addresses, yet curl gets "connection refused" almost instantly. Which step is next?'),
            H2: bi('Сравните targetPort Service с портом, который слушает процесс: `kubectl -n shop exec client -- curl -s http://<IP пода>:80`.', 'Compare the Service targetPort with the port the process listens on: `kubectl -n shop exec client -- curl -s http://<pod IP>:80`.'),
          },
        },
        {
          id: 'pay',
          prompt: bi('Добейтесь, чтобы `client` получал ответ от `pay` из namespace `pay`. Политику не удаляйте, потому что она защищает платёжный сервис.', 'Make `client` get an answer from `pay` in namespace `pay`. Do not delete the policy: it protects the payment service.'),
          check: {
            when: "k8s.reach[from='shop/client'][to='pay.pay'].status=200 && k8s.objects[kind=NetworkPolicy][metadata.name=only-shop-frontend]#=1",
            fail: [{ if: 'k8s.objects[kind=NetworkPolicy]#=0', say: bi('Политику удалили, и в защите появилась дыра. Верните политику и пропустите клиента так, как она требует.', 'The policy was deleted — that opens a hole in the protection. Bring it back and let the client in the way it requires.') }],
          },
          chips: 'kubectl -n pay describe netpol only-shop-frontend',
          concepts: ['k8s.networkpolicy'],
          hints: {
            H1: bi('Сначала напишите полное имя, потому что из namespace shop короткое имя `pay` не найдётся. Если по полному имени тайм-аут при работающих подах, значит, вы на ступени NetworkPolicy.', 'First the full name: from shop the short `pay` is not found. If the full name times out while the pods are alive, that is the NetworkPolicy step.'),
            H2: bi('Прочитайте, какие поды и из какого namespace политика пропускает, и посмотрите метки клиента.', 'Read which pods from which namespace the policy lets in, and look at the client’s labels.'),
          },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: troubleQuiz.map((q) => q.id) },
  ],
};
