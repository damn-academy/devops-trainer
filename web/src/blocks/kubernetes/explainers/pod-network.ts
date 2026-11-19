// Э6 (05 §6.8): a packet from pod to pod. On one node it goes through the
// cni0 bridge; between nodes, either the node routes it to the other node
// (host-gw: "10.42.1.0/24 via 192.168.56.12") or wraps it in another packet
// (VXLAN: outer 192.168.56.11 → .12 UDP 8472). The "nodes in different
// subnets" switch shows why the wrapping exists; the MTU knob shows what it
// costs.
//
// Reading order: at first only the three pods are on screen, inside the
// frames of their nodes. The bridge, the routes and the node network appear
// as the packet reaches them, and every step is one hop of the packet.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, idsOf, LEGEND_BASE, mark, only } from './kit';

type P = { target: string; mode: string; subnets: boolean; mtu: string };

const CNI = bi('Интерфейс создаёт плагин сети (CNI), когда containerd создаёт под.', 'Created by the CNI plugin when the pod is created.');
const FLANNEL = bi('Маршруты и устройство flannel.1 настраивает плагин flannel.', 'Set up by flannel.');

const diagram = {
  width: 960,
  height: 590,
  nodes: [
    box('a', bi('Под A', 'Pod A'), 'process', 'box', [40, 30, 170, 60], 'container', bi('У пода своё сетевое пространство имён: интерфейс eth0 с адресом 10.42.0.15/24 и маршрут по умолчанию через 10.42.0.1, то есть через мост узла.', 'Its own network namespace: eth0 10.42.0.15/24, default route via 10.42.0.1, the bridge.'), CNI, { see: 'kubectl exec a -- ip route', doc: D.network, sub: '10.42.0.15' }),
    box('b', bi('Под B', 'Pod B'), 'process', 'box', [250, 30, 170, 60], 'container', bi('Сосед пода A по узлу worker-1, адрес 10.42.0.16.', 'A’s neighbour on worker-1: 10.42.0.16.'), CNI, { doc: D.network, sub: '10.42.0.16' }),
    box('br1', bi('Мост cni0 на worker-1', 'Bridge cni0 on worker-1'), 'l2', 'box', [40, 180, 380, 46], 'switch', bi('Мост Linux на узле. К нему подключены виртуальные интерфейсы всех подов узла, а его собственный адрес 10.42.0.1 служит подам шлюзом.', 'The node’s Linux bridge: every pod’s veth is attached; its address 10.42.0.1 is the pods’ gateway.'), bi('Мост создаёт плагин bridge, которым пользуется flannel.', 'The bridge plugin used by flannel.'), { see: 'bridge fdb show br cni0', doc: D.cni, sub: '10.42.0.1/24' }),
    box('rt1', bi('Маршруты ядра worker-1', 'worker-1 kernel routes'), 'kernel', 'box', [40, 316, 380, 50], 'router', bi('Таблица маршрутов узла решает, куда отправить пакет для диапазона адресов подов другого узла.', 'The routing table decides where a packet for another node’s pod range goes.'), FLANNEL, { see: 'ip route', doc: D.flannel, sub: '10.42.1.0/24 via …' }),
    box('eth1', bi('worker-1 в сети узлов', 'worker-1 on the node network'), 'l3', 'box', [40, 456, 380, 46], 'server', bi('Сетевая карта узла worker-1 с адресом 192.168.56.11 в сети, которая соединяет узлы.', 'worker-1’s network card, 192.168.56.11.'), bi('Адрес выдаёт облако или гипервизор.', 'Given by the cloud or hypervisor.'), { see: 'ip addr show eth0', doc: D.network, sub: '192.168.56.11' }),
    box('net', bi('Сеть между узлами', 'The node network'), 'l2', 'bar', [40, 540, 880, 36], 'switch', bi('Сеть, которая соединяет узлы. Адреса 10.42.x.x для неё ничего не значат, потому что она знает только адреса самих узлов.', 'It knows only node addresses; 10.42.x.x means nothing to it.'), bi('Сеть принадлежит облаку или дата-центру.', 'Owned by the cloud or data centre.'), { doc: D.network }),
    box('eth2', bi('worker-2 в сети узлов', 'worker-2 on the node network'), 'l3', 'box', [540, 456, 380, 46], 'server', bi('Сетевая карта узла worker-2 с адресом 192.168.56.12.', 'worker-2’s network card, 192.168.56.12.'), bi('Адрес выдаёт облако или гипервизор.', 'Given by the cloud or hypervisor.'), { doc: D.network, sub: '192.168.56.12' }),
    box('rt2', bi('Маршруты ядра worker-2', 'worker-2 kernel routes'), 'kernel', 'box', [540, 316, 380, 50], 'router', bi('Пакеты для своего диапазона 10.42.1.0/24 ядро worker-2 отправляет на мост cni0.', 'Its own range 10.42.1.0/24 goes to cni0.'), FLANNEL, { see: 'ip route', doc: D.flannel }),
    box('br2', bi('Мост cni0 на worker-2', 'Bridge cni0 on worker-2'), 'l2', 'box', [540, 180, 380, 46], 'switch', bi('Мост второго узла с адресом 10.42.1.1/24.', 'The second node’s bridge, 10.42.1.1/24.'), bi('Мост создаёт плагин bridge.', 'The bridge plugin.'), { doc: D.cni, sub: '10.42.1.1/24' }),
    box('c', bi('Под C', 'Pod C'), 'process', 'box', [640, 30, 170, 60], 'container', bi('Под на другом узле, worker-2, с адресом 10.42.1.20.', 'A pod on worker-2: 10.42.1.20.'), CNI, { doc: D.network, sub: '10.42.1.20' }),
  ],
  edges: [
    edge('e-a', 'a', 'br1', 'veth', bi('Пара виртуальных интерфейсов veth: один конец стоит в поде под именем eth0, другой подключён к мосту узла.', 'A veth pair: one end is the pod’s eth0, the other is on the bridge.'), CNI),
    edge('e-b', 'b', 'br1', 'veth', bi('Интерфейс пода B подключён к тому же мосту.', 'Pod B’s veth on the same bridge.'), CNI),
    edge('e-up1', 'br1', 'rt1', bi('чужая подсеть', 'another subnet'), bi('Адрес из чужого диапазона мост отдаёт ядру узла, чтобы оно нашло маршрут.', 'The bridge hands a packet for another range to the kernel.'), bi('Решает ядро узла.', 'The kernel.')),
    edge('e-out1', 'rt1', 'eth1', bi('к второму узлу', 'to the second node'), bi('При способе host-gw пакет следующим шагом уходит на второй узел. При способе VXLAN устройство flannel.1 сначала оборачивает пакет пода в новый пакет.', 'host-gw: the next hop is the second node. VXLAN: flannel.1 wraps the packet first.'), FLANNEL),
    edge('e-wire', 'eth1', 'eth2', bi('между узлами', 'node to node'), bi('По сети узлов идёт либо пакет пода как есть (host-gw), либо он же внутри UDP-пакета на порт 8472 (VXLAN).', 'Either the pod packet as is (host-gw) or inside UDP 8472 (VXLAN).'), bi('Пакеты передаёт сеть узлов.', 'The node network.'), { via: [[230, 558], [730, 558]], labelAt: 0.5 }),
    edge('e-in2', 'eth2', 'rt2', bi('снять обёртку', 'unwrap'), bi('Второй узел снимает обёртку VXLAN и ищет маршрут для пакета пода.', 'The second node unwraps and routes.'), bi('Решает ядро узла.', 'The kernel.')),
    edge('e-down2', 'rt2', 'br2', bi('свой диапазон', 'own range'), bi('Свой диапазон адресов подов ядро отправляет на мост.', 'Its own pod range goes to the bridge.'), bi('Решает ядро узла.', 'The kernel.')),
    edge('e-c', 'br2', 'c', 'veth', bi('Мост передаёт кадр в интерфейс пода C.', 'The bridge hands the frame to pod C.'), CNI),
  ],
  groups: [
    { id: 'g1', label: bi('узел worker-1, поды 10.42.0.0/24', 'node worker-1, pods 10.42.0.0/24'), around: ['a', 'b', 'br1', 'rt1', 'eth1'], family: 'node' as const, dash: 'solid' as const, pad: 10, card: { what: bi('Узел worker-1. Его подам достаются адреса из диапазона 10.42.0.0/24.', 'Node 1; its pods get 10.42.0.0/24.'), who: bi('Диапазон выдаёт узлу kube-controller-manager.', 'kube-controller-manager assigns the range.') } },
    { id: 'g2', label: bi('узел worker-2, поды 10.42.1.0/24', 'node worker-2, pods 10.42.1.0/24'), around: ['c', 'br2', 'rt2', 'eth2'], family: 'node' as const, dash: 'solid' as const, pad: 10, card: { what: bi('Узел worker-2. Его подам достаются адреса из диапазона 10.42.1.0/24.', 'Node 2; its pods get 10.42.1.0/24.'), who: bi('Диапазон выдаёт узлу kube-controller-manager.', 'kube-controller-manager.') } },
  ],
};

const ALL = idsOf(diagram);

export const podNetworkModel = defineModel<P>({
  id: 'k8s.pod-network',
  frame: 'visible',
  block: 'k8s-1',
  title: bi('Как пакет идёт из пода в под', 'How a packet goes from pod to pod'),
  summary: bi(
    'У каждого пода свой IP-адрес, и поды обмениваются пакетами напрямую, без трансляции адресов. Каким путём пакет доходит до цели, решает плагин сети (CNI). На одном узле пакет проходит через мост, а между узлами либо идёт по маршруту ко второму узлу, либо идёт внутри другого пакета, как письмо в конверте.',
    'Every pod has its own IP and pods talk without NAT. How a packet gets there is up to the CNI plugin: a bridge on one node, a route or an envelope between nodes.',
  ),
  intro: bi(
    'Сейчас на схеме три пода: A и B на узле worker-1 и C на узле worker-2. Нажмите «Начать с первого шага». Под A отправит пакет, и дальше каждый шаг будет одним местом, через которое проходит пакет. Мосты, маршруты и сеть узлов появятся, когда пакет до них дойдёт, а карточка на линии покажет, какие адреса написаны на пакете. Потом поменяйте в «Параметрах» цель и способ доставки между узлами.',
    'For now three pods: A and B on worker-1, C on worker-2. Press “Start from the first step”: pod A sends a packet, and each step is one place it passes. The card on the line shows the addresses on the packet. Then change the target and the delivery mode in “Parameters”.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:container', 'под со своим IP-адресом', 'a pod with its own IP'),
    mark('icon:switch', 'мост на узле', 'a bridge on a node'),
    mark('icon:router', 'таблица маршрутов ядра узла', 'the node’s routing table'),
    mark('icon:server', 'узел в сети узлов', 'a node on the node network'),
    mark('ok', 'пакет доставлен', 'the packet arrived'),
    mark('err', 'здесь пакет пропал', 'the packet was lost here'),
  ],
  stopLabel: bi('Пакет остановился', 'The packet stopped'),
  concepts: ['k8s.network-model', 'k8s.cni'],
  diagram,
  params: [
    {
      id: 'target',
      label: bi('Кому под A отправляет пакет', 'Where pod A sends the packet'),
      kind: 'choice',
      default: 'other',
      group: bi('Куда идёт пакет', 'Where the packet goes'),
      options: [
        { id: 'same', label: bi('поду B на том же узле', 'pod B on the same node') },
        { id: 'other', label: bi('поду C на другом узле', 'pod C on another node') },
      ],
      near: 'a',
    },
    {
      id: 'mode',
      label: bi('Как flannel доставляет пакеты между узлами', 'How flannel delivers between nodes'),
      kind: 'choice',
      default: 'vxlan',
      group: bi('Как устроена сеть между узлами', 'The network between nodes'),
      options: [
        { id: 'host-gw', label: bi('маршрутом ко второму узлу (host-gw)', 'a route (host-gw)') },
        { id: 'vxlan', label: bi('в конверте другого пакета (VXLAN)', 'in an envelope (VXLAN)') },
      ],
      near: 'rt1',
      predict: {
        prompt: bi('Вы меняете способ доставки между узлами, а пакет идёт от A к C. Какие адреса увидит сеть между узлами в заголовке пакета?', 'You change the delivery mode; the packet goes A → C. Which addresses does the node network see?'),
        options: [
          { id: 'nodes', text: bi('Адреса узлов 192.168.56.11 и 192.168.56.12, протокол UDP', 'The node addresses, UDP') },
          { id: 'pods', text: bi('Адреса подов 10.42.0.15 и 10.42.1.20', 'The pod addresses') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'wrap') ? 'nodes' : 'pods'),
      },
    },
    {
      id: 'subnets',
      label: bi('Узлы стоят в разных подсетях, и между ними маршрутизатор', 'The nodes are in different subnets with a router between'),
      kind: 'toggle',
      default: false,
      near: 'net',
      group: bi('Как устроена сеть между узлами', 'The network between nodes'),
      predict: {
        prompt: bi('Между узлами теперь стоит маршрутизатор, который ничего не знает об адресах подов. Дойдёт ли пакет от A до C при выбранном способе доставки?', 'A router that knows nothing of pod addresses now sits between the nodes. Will A → C arrive with the chosen mode?'),
        options: [
          { id: 'yes', text: bi('Да, дойдёт', 'Yes') },
          { id: 'no', text: bi('Нет, потому что второй узел больше не сосед и маршрут к нему не работает', 'No, because the second node is no longer a neighbour') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken) ? 'no' : 'yes'),
      },
    },
    { id: 'mtu', label: bi('Наибольший размер пакета в поде (MTU)', 'Pod MTU'), kind: 'choice', default: '1450', group: bi('Как устроена сеть между узлами', 'The network between nodes'), options: [{ id: '1450', label: bi('1450 байт, с запасом на конверт VXLAN', '1450, room for VXLAN') }, { id: '1500', label: bi('1500 байт, как у узла', '1500, as on the node') }], near: 'a', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    { id: 'no-route', label: bi('На worker-1 пропал маршрут к подам worker-2', 'The route to worker-2’s pods is gone on worker-1'), remove: ['e-out1'], layer: 'L3', boundary: 'network', predict: { prompt: bi('На worker-1 нет маршрута к диапазону 10.42.1.0/24. Что будет с пакетом от A к C?', 'worker-1 has no route to 10.42.1.0/24. What happens to A → C?'), options: [{ id: 'default', text: bi('Уйдёт по маршруту по умолчанию к шлюзу облака и пропадёт', 'It leaves via the default route and is lost') }, { id: 'fine', text: bi('Пакет дойдёт, потому что мост сам найдёт под C', 'It arrives: the bridge finds C') }], resolve: (_p, n) => (n.some((s) => s.broken) ? 'default' : 'fine') } },
    { id: 'udp', label: bi('Межсетевой экран облака закрыл UDP-порт 8472', 'The cloud firewall closed UDP 8472'), remove: ['e-wire'], layer: 'L4', boundary: 'network', predict: { prompt: bi('Межсетевой экран закрыл UDP-порт 8472 между узлами. Будет ли работать связь между подами A и B на одном узле?', 'UDP 8472 is closed between nodes. Does A → B on one node work?'), options: [{ id: 'yes', text: bi('Да, потому что через экран идут только пакеты между узлами', 'Yes, because only node-to-node traffic crosses it') }, { id: 'no', text: bi('Нет, связь пропадёт везде', 'No, everything stops') }], resolve: () => 'yes' } },
    { id: 'no-cni', label: bi('Плагин сети (CNI) на узлах не работает', 'The CNI plugin is down'), remove: ['e-a', 'e-b', 'e-c'], layer: 'L3', boundary: 'network', predict: { prompt: bi('Плагин сети на узлах не работает. Что будет с новыми подами?', 'The CNI plugin is down. What happens to new pods?'), options: [{ id: 'creating', text: bi('Застрянут в ContainerCreating, потому что без сети не создать песочницу пода', 'Stuck in ContainerCreating') }, { id: 'nonet', text: bi('Запустятся, но без сети', 'They start without a network') }], resolve: () => 'creating' } },
  ],
  metrics: [
    { id: 'hops', label: bi('мест на пути пакета', 'places on the path') },
    { id: 'overhead', label: bi('байт ушло на конверт', 'bytes of wrapping') },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    const vx = p.mode === 'vxlan';
    const start = only(ALL, 'a', 'b', 'c');
    if (broken.has('no-cni')) {
      s.push({
        id: 'nocni',
        label: 'CNI',
        caption: bi('Плагин сети на узле не работает, поэтому kubelet не может создать песочницу ни одному новому поду, потому что у песочницы не будет интерфейса и адреса.', 'The CNI plugin is down: no new pod gets a sandbox.'),
        focus: ['br1'],
        say: { br1: bi('Плагин сети не отвечает, и подключить к мосту новый под нельзя.', 'The plugin does not answer; no pod can be attached.') },
        states: { ...start, br1: 'err' },
        metrics: { hops: 0, overhead: 0 },
        broken: { at: 'br1', message: 'container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized', caption: bi('ещё до первого пакета. Узел показывает NotReady, а новые поды застревают в ContainerCreating с событием FailedCreatePodSandBox.', 'before the first packet: the node is NotReady, new pods sit in ContainerCreating with FailedCreatePodSandBox.') },
      });
      return s;
    }
    s.push({
      id: 'route',
      label: bi('из пода', 'leave pod'),
      caption: p.target === 'same'
        ? bi('Под A отправляет пакет с 10.42.0.15 на 10.42.0.16. Адрес назначения в той же подсети, поэтому пакет выходит из пода через eth0 прямо на мост, как в обычной домашней сети.', 'A sends 10.42.0.15 → 10.42.0.16: the same subnet, so out through eth0 onto the bridge.')
        : bi('Под A отправляет пакет с 10.42.0.15 на 10.42.1.20. Адрес назначения в чужой подсети, поэтому пакет уходит на шлюз пода 10.42.0.1, то есть на мост узла.', 'A sends 10.42.0.15 → 10.42.1.20: another subnet, so to the gateway 10.42.0.1, the bridge.'),
      focus: ['a', 'e-a'],
      reveal: ['br1', 'e-a'],
      tokens: [{ edge: 'e-a', label: p.target === 'same' ? '10.42.0.15 → 10.42.0.16' : '10.42.0.15 → 10.42.1.20' }],
      say: { a: p.target === 'same' ? bi('Под A отправляет пакет соседу B на тот же узел.', 'Pod A sends a packet to its neighbour B.') : bi('Под A отправляет пакет поду C на другом узле.', 'Pod A sends a packet to pod C on another node.') },
      states: start,
      metrics: { hops: 1, overhead: 0 },
    });
    if (p.target === 'same') {
      s.push({
        id: 'bridge',
        label: bi('мост', 'bridge'),
        caption: bi('Мост cni0 по адресу получателя пересылает кадр в интерфейс пода B, так же как это делает обычный коммутатор. Ни маршрутизации, ни трансляции адресов здесь нет, и под B видит, что пакет пришёл с 10.42.0.15. Маршруты ядра, сетевые карты узлов и сеть между ними в этом случае не понадобились, поэтому на схеме они остаются бледными.', 'The bridge forwards the frame to B like a switch; no routing, no NAT: B sees 10.42.0.15. Routes, node interfaces and the node network stay pale: they were not needed.'),
        focus: ['br1', 'e-b'],
        reveal: ['e-b', 'rt1', 'eth1', 'net', 'eth2', 'rt2', 'br2', 'c', 'e-up1', 'e-out1', 'e-wire', 'e-in2', 'e-down2', 'e-c'],
        tokens: [{ edge: 'e-b', label: '10.42.0.15 → 10.42.0.16', reverse: true }],
        say: { br1: bi('Мост пересылает кадр в интерфейс пода B, как коммутатор.', 'The bridge forwards the frame to pod B.') },
        states: { b: 'ok' },
        metrics: { hops: 2, overhead: 0 },
      });
      return s;
    }
    s.push({
      id: 'up',
      label: bi('маршрут', 'route'),
      caption: vx
        ? bi('Мост отдаёт пакет ядру worker-1, и ядро находит маршрут, по которому диапазон 10.42.1.0/24 отправляется в устройство flannel.1, которое умеет заворачивать пакеты в VXLAN.', 'The kernel finds 10.42.1.0/24 dev flannel.1, the VXLAN device.')
        : bi('Мост отдаёт пакет ядру worker-1, и ядро находит маршрут, по которому диапазон 10.42.1.0/24 доступен через 192.168.56.12, то есть сам второй узел служит маршрутизатором для подов на нём.', 'The kernel finds 10.42.1.0/24 via 192.168.56.12: the second node routes for its pods.'),
      focus: ['rt1', 'e-up1'],
      reveal: ['rt1', 'e-up1'],
      tokens: [{ edge: 'e-up1', label: '→ 10.42.1.20' }],
      say: { rt1: vx ? bi('Ядро находит маршрут, по которому пакеты для 10.42.1.0/24 уходят в устройство flannel.1.', 'The kernel: 10.42.1.0/24 goes to flannel.1.') : bi('Ядро находит маршрут, по которому пакеты для 10.42.1.0/24 уходят на узел 192.168.56.12.', 'The kernel: 10.42.1.0/24 goes via 192.168.56.12.') },
      values: { rt1: vx ? '10.42.1.0/24 dev flannel.1' : '10.42.1.0/24 via 192.168.56.12' },
      metrics: { hops: 2, overhead: 0 },
    });
    if (broken.has('no-route')) {
      s.push({
        id: 'lost',
        label: bi('нет маршрута', 'no route'),
        caption: bi('Маршрута к 10.42.1.0/24 нет, поэтому ядро отправляет пакет по маршруту по умолчанию, к шлюзу облака. Шлюз про адреса подов ничего не знает, и пакет пропадает.', 'No route: the packet goes to the cloud gateway, which knows nothing about pods, and is lost.'),
        focus: ['rt1'],
        reveal: ['e-out1', 'eth1'],
        say: { rt1: bi('Ядро не находит маршрута к 10.42.1.0/24 и отправляет пакет шлюзу облака.', 'No route; the packet goes to the cloud gateway.') },
        states: { rt1: 'err' },
        metrics: { hops: 2, overhead: 0 },
        broken: { at: 'e-out1', message: '$ kubectl exec a -- ping -c1 -W2 10.42.1.20\n1 packets transmitted, 0 received, 100% packet loss', caption: bi('на маршруте между узлами. Такую поломку узнают по тому, что поды на одном узле видят друг друга, а между узлами пакеты пропадают.', 'at the route between nodes: pods on one node see each other, across nodes packets vanish.') },
      });
      return s;
    }
    if (!vx && p.subnets) {
      s.push({
        id: 'unreach',
        label: bi('не сосед', 'not a neighbour'),
        caption: bi('Способ host-gw требует, чтобы второй узел был соседом первого в одной сети. Узлы стоят в разных подсетях, 192.168.56.12 не сосед, и отправить пакет прямо ему нельзя.', 'host-gw needs the second node to be a neighbour; in different subnets it is not.'),
        focus: ['rt1'],
        say: { rt1: bi('Ядро не может отправить пакет на 192.168.56.12: этот узел не сосед.', 'The kernel cannot reach 192.168.56.12 directly.') },
        states: { rt1: 'err' },
        metrics: { hops: 2, overhead: 0 },
        broken: { at: 'rt1', message: 'Error: Nexthop has invalid gateway.', caption: bi('на маршруте. Узлам в разных подсетях нужен либо конверт VXLAN, либо маршрутизатор, которому сообщили диапазоны адресов подов, например по протоколу BGP.', 'at the route: different subnets need VXLAN or a router that knows the pod ranges (BGP).') },
      });
      return s;
    }
    if (vx) {
      s.push({
        id: 'wrap',
        label: bi('конверт', 'envelope'),
        caption: bi('Устройство flannel.1 кладёт весь пакет пода внутрь нового пакета. Снаружи написано 192.168.56.11 → 192.168.56.12, порт UDP 8472, а внутри по-прежнему 10.42.0.15 → 10.42.1.20. Конверт занимает 50 байт.', 'flannel.1 puts the pod packet inside a new one: outside 192.168.56.11 → .12 UDP 8472, inside 10.42.0.15 → 10.42.1.20; 50 bytes of wrapping.'),
        focus: ['rt1', 'e-out1'],
        reveal: ['e-out1', 'eth1'],
        tokens: [{ edge: 'e-out1', label: '.11 → .12 UDP 8472' }],
        say: { rt1: bi('flannel.1 кладёт пакет пода в UDP-пакет, адресованный второму узлу.', 'flannel.1 wraps the pod packet into UDP for the second node.') },
        values: { eth1: t(bi('192.168.56.11 · конверт .11 → .12', '192.168.56.11 · outer .11 → .12')) },
        metrics: { hops: 3, overhead: 50 },
      });
      if (Number(p.mtu) === 1500) {
        s.push({
          id: 'mtu',
          label: 'MTU',
          caption: bi('Пакет пода был размером 1500 байт, а с конвертом стал 1550, больше, чем пропускает сеть узлов. Маленькие пакеты проходят, а большие, например ответы TLS и загрузки файлов, пропадают.', 'The 1500-byte packet became 1550 with the wrapping: too big. Small packets pass, big ones vanish.'),
          focus: ['eth1'],
          say: { eth1: bi('Пакет в конверте весит 1550 байт и не помещается в сеть узлов.', 'The wrapped packet is 1550 bytes: too big.') },
          states: { eth1: 'err' },
          metrics: { hops: 3, overhead: 50 },
          broken: { at: 'eth1', message: 'ICMP 10.42.0.15 unreachable - need to frag (mtu 1450)', caption: bi('на выходе с узла. Конверт занял 50 байт, поэтому MTU в поде должен быть 1450, и плагин сети по умолчанию так его и выставляет.', 'leaving the node: the wrapping takes 50 bytes, so the pod MTU must be 1450, the CNI default.') },
        });
        return s;
      }
    }
    if (vx && broken.has('udp')) {
      s.push({
        id: 'fw',
        label: 'UDP 8472',
        caption: bi('worker-1 отправляет UDP-пакет второму узлу, но межсетевой экран облака пропускает только порты 22 и 443 и молча отбрасывает UDP 8472.', 'The cloud firewall lets only 22 and 443 through and silently drops UDP 8472.'),
        focus: ['eth1', 'e-wire'],
        reveal: ['net', 'e-wire', 'eth2'],
        say: { eth1: bi('worker-1 отправляет пакет на порт UDP 8472, но ответа нет, потому что межсетевой экран пакет отбросил.', 'worker-1 sends to UDP 8472; the firewall drops it.') },
        states: { net: 'err' },
        metrics: { hops: 3, overhead: 50 },
        broken: { at: 'e-wire', message: '$ kubectl exec a -- curl -m 5 http://10.42.1.20\ncurl: (28) Connection timed out after 5001 milliseconds', caption: bi('в сети между узлами. Тайм-аут возникает только между узлами, а на одном узле всё работает, поэтому первым делом проверьте правила межсетевого экрана для UDP 8472.', 'between nodes: a timeout only across nodes; check the firewall for UDP 8472.') },
      });
      return s;
    }
    s.push({
      id: 'wire',
      label: bi('сеть узлов', 'node network'),
      caption: vx
        ? bi('По сети узлов идёт обычный UDP-пакет от одного узла к другому, и сети не нужно ничего знать об адресах подов.', 'Ordinary UDP between nodes crosses the network; it needs to know nothing of pods.')
        : bi('По сети узлов идёт сам пакет пода с адресами 10.42.0.15 → 10.42.1.20, но кадр адресован сетевой карте второго узла.', 'The pod packet crosses as is, addressed to the second node’s card.'),
      focus: ['eth1', 'e-wire'],
      reveal: ['eth1', 'e-out1', 'net', 'e-wire', 'eth2'],
      tokens: [{ edge: 'e-wire', label: vx ? '.11 → .12 UDP 8472' : '10.42.0.15 → 10.42.1.20' }],
      say: { eth1: vx ? bi('worker-1 отправляет конверт по сети узлов на 192.168.56.12.', 'worker-1 sends the envelope to 192.168.56.12.') : bi('worker-1 отправляет пакет пода прямо на сетевую карту второго узла.', 'worker-1 sends the pod packet to the second node.') },
      metrics: { hops: 4, overhead: vx ? 50 : 0 },
    });
    s.push({
      id: 'in',
      label: bi('второй узел', 'second node'),
      caption: vx
        ? bi('worker-2 принимает UDP-пакет на порт 8472, устройство flannel.1 снимает конверт, а внутри лежит пакет для 10.42.1.20. Это адрес из диапазона самого worker-2, и ядро отправляет пакет на мост cni0.', 'worker-2 unwraps it; 10.42.1.20 is its own range, so the packet goes to cni0.')
        : bi('worker-2 видит пакет для 10.42.1.20. Это адрес из его собственного диапазона, и ядро отправляет пакет на мост cni0.', 'worker-2 sees its own range and sends the packet to cni0.'),
      focus: ['rt2', 'e-in2', 'e-down2'],
      reveal: ['rt2', 'e-in2', 'e-down2', 'br2'],
      tokens: [{ edge: 'e-down2', label: '→ 10.42.1.20' }],
      say: { rt2: vx ? bi('worker-2 снимает конверт и отправляет пакет на свой мост.', 'worker-2 unwraps and sends the packet to its bridge.') : bi('worker-2 отправляет пакет на свой мост, потому что адрес назначения принадлежит его поду.', 'worker-2 sends the packet to its bridge.') },
      metrics: { hops: 5, overhead: vx ? 50 : 0 },
    });
    s.push({
      id: 'deliver',
      label: bi('доставлено', 'delivered'),
      caption: bi('Мост передаёт кадр в интерфейс пода C. Под C видит, что пакет пришёл с 10.42.0.15, без всякой трансляции адресов, как и обещает сетевая модель Kubernetes.', 'The bridge hands the frame to C, which sees the source 10.42.0.15: no NAT, as the model promises.'),
      focus: ['c', 'e-c'],
      reveal: ['e-c'],
      tokens: [{ edge: 'e-c', label: '10.42.0.15 → 10.42.1.20' }],
      say: { c: bi('Под C получает пакет и видит отправителя 10.42.0.15.', 'Pod C receives the packet from 10.42.0.15.') },
      states: { c: 'ok' },
      metrics: { hops: 6, overhead: vx ? 50 : 0 },
    });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? next.some((x) => x.broken)
          ? bi('Поломка лежит на пути пакета, и пакет остановился там, где её видно.', 'The break is on the path; the packet stopped there.')
          : bi('Выбранный путь пакета эту поломку не задевает. Выберите другого получателя или другой способ доставки.', 'This path avoids the break; try another target or mode.')
        : bi('Поломка убрана.', 'The break is removed.');
    switch (change.id) {
      case 'target':
        return b.target === 'same' ? bi('Пакет для соседа по узлу не покидает узел, потому что мост пересылает его сразу.', 'To a neighbour the packet never leaves the node.') : bi('Пакет на другой узел ядро маршрутизирует, а дальше работает способ доставки плагина сети.', 'To another node the kernel routes, then the delivery mode works.');
      case 'mode':
        return b.mode === 'vxlan' ? bi('При VXLAN пакет пода идёт между узлами внутри UDP-пакета, поэтому сеть видит только адреса узлов, а на конверт уходит 50 байт.', 'VXLAN: the pod packet travels inside UDP; 50 bytes of wrapping.') : bi('При host-gw конверта нет, но узлы должны быть соседями в одной сети.', 'host-gw: no wrapping, but the nodes must be neighbours.');
      case 'subnets':
        return b.subnets
          ? b.mode === 'vxlan'
            ? bi('Разные подсети VXLAN не мешают, потому что снаружи это обычный UDP между узлами, и его доставит любая сеть.', 'Different subnets do not bother VXLAN.')
            : bi('Разные подсети ломают host-gw: второй узел больше не сосед.', 'Different subnets break host-gw.')
          : bi('Узлы снова в одной подсети.', 'The nodes are in one subnet again.');
      case 'mtu':
        return Number(b.mtu) === 1500 ? bi('С MTU 1500 в поде большие пакеты после конверта не помещаются в сеть узлов.', 'With 1500 big packets do not fit after wrapping.') : fmt(bi('С MTU {m} в поде пакет вместе с конвертом занимает 1500 байт и проходит.', 'With {m} the wrapped packet is 1500 bytes and passes.'), { m: Number(b.mtu) });
    }
    return bi('Путь пересчитан.', 'The path is recomputed.');
  },
});
