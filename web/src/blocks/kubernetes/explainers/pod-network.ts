// Э6 (05 §6.8): a packet from pod to pod. On one node it goes through the
// cni0 bridge; between nodes, either the node routes it to the other node
// (host-gw: "10.42.1.0/24 via 192.168.56.12") or wraps it in another packet
// (VXLAN: outer 192.168.56.11 → .12 UDP 8472). The "nodes in different
// subnets" switch shows why the wrapping exists; the MTU knob shows what it
// costs.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, node } from './kit';

type P = { target: string; mode: string; subnets: boolean; mtu: string };

export const podNetworkModel = defineModel<P>({
  id: 'k8s.pod-network',
  block: 'k8s-1',
  title: bi('Пакет из пода в под', 'A packet from pod to pod'),
  summary: bi('У каждого пода свой IP, и поды говорят друг с другом без NAT. Как именно пакет доходит — дело плагина CNI: мост на одном узле, маршрут или «конверт в конверте» между узлами.', 'Every pod has its own IP, and pods talk to each other without NAT. How exactly the packet gets there is the CNI plugin’s business: a bridge on one node, a route or an "envelope in an envelope" between nodes.'),
  concepts: ['k8s.network-model', 'k8s.cni'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      node('a', bi('под A', 'pod A'), 'process', 'box', 40, 50, 170, 60, bi('Свой сетевой namespace: eth0 10.42.0.15/24, маршрут по умолчанию через 10.42.0.1 (мост).', 'Its own network namespace: eth0 10.42.0.15/24, default route via 10.42.0.1 (the bridge).'), bi('containerd + CNI при создании пода', 'containerd + CNI when the pod is created'), 'kubectl exec a -- ip route', D.network, '10.42.0.15'),
      node('b', bi('под B', 'pod B'), 'process', 'box', 250, 50, 170, 60, bi('Сосед A по узлу: 10.42.0.16.', 'A’s neighbour on the same node: 10.42.0.16.'), bi('containerd + CNI', 'containerd + CNI'), undefined, D.network, '10.42.0.16'),
      node('br1', 'cni0 · worker-1', 'l2', 'box', 40, 170, 380, 44, bi('Linux-мост узла: к нему подключены veth всех подов узла; адрес моста 10.42.0.1 — шлюз подов.', 'The node’s Linux bridge: the veths of every pod of the node are attached; the bridge address 10.42.0.1 is the pods’ gateway.'), bi('плагин bridge (flannel)', 'the bridge plugin (flannel)'), 'bridge fdb show br cni0', D.cni, '10.42.0.1/24'),
      node('rt1', bi('ядро worker-1: маршруты', 'worker-1 kernel: routes'), 'kernel', 'box', 40, 260, 380, 50, bi('Таблица маршрутов узла решает, куда отправить пакет для чужого podCIDR.', 'The node routing table decides where a packet for another podCIDR goes.'), bi('flannel', 'flannel'), 'ip route', D.flannel, '10.42.1.0/24 via …'),
      node('eth1', 'eth0 · 192.168.56.11', 'l3', 'box', 40, 350, 380, 44, bi('Сетевая карта узла в сети узлов.', 'The node’s network card in the node network.'), bi('облако / гипервизор', 'the cloud / hypervisor'), 'ip addr show eth0', D.network),
      node('net', bi('сеть узлов', 'node network'), 'l2', 'bar', 40, 420, 880, 36, bi('Сеть между узлами. Для неё адреса 10.42.x.x ничего не значат — она знает только адреса узлов.', 'The network between the nodes. To it 10.42.x.x addresses mean nothing — it only knows node addresses.'), bi('облако / ЦОД', 'the cloud / data centre'), undefined, D.network),
      node('eth2', 'eth0 · 192.168.56.12', 'l3', 'box', 540, 350, 380, 44, bi('Сетевая карта второго узла.', 'The second node’s network card.'), bi('облако / гипервизор', 'the cloud / hypervisor'), undefined, D.network),
      node('rt2', bi('ядро worker-2: маршруты', 'worker-2 kernel: routes'), 'kernel', 'box', 540, 260, 380, 50, bi('Свой podCIDR 10.42.1.0/24 — на мост cni0.', 'Its own podCIDR 10.42.1.0/24 — to the cni0 bridge.'), bi('flannel', 'flannel'), 'ip route', D.flannel),
      node('br2', 'cni0 · worker-2', 'l2', 'box', 540, 170, 380, 44, bi('Мост второго узла, 10.42.1.1/24.', 'The second node’s bridge, 10.42.1.1/24.'), bi('плагин bridge', 'the bridge plugin'), undefined, D.cni, '10.42.1.1/24'),
      node('c', bi('под C', 'pod C'), 'process', 'box', 640, 50, 170, 60, bi('Под на другом узле: 10.42.1.20.', 'A pod on the other node: 10.42.1.20.'), bi('containerd + CNI', 'containerd + CNI'), undefined, D.network, '10.42.1.20'),
    ],
    edges: [
      edge('e-a', 'a', 'br1', 'veth', bi('Пара veth: один конец в namespace пода (eth0), другой — в мосте узла.', 'A veth pair: one end in the pod namespace (eth0), the other in the node bridge.'), bi('CNI', 'CNI')),
      edge('e-b', 'b', 'br1', 'veth', bi('veth пода B в том же мосте.', 'Pod B’s veth on the same bridge.'), bi('CNI', 'CNI')),
      edge('e-up1', 'br1', 'rt1', bi('не моя подсеть → маршрут', 'not my subnet → route'), bi('Чужой podCIDR: мост отдаёт пакет ядру узла на маршрутизацию.', 'Another podCIDR: the bridge hands the packet to the node kernel for routing.'), bi('ядро', 'the kernel')),
      edge('e-out1', 'rt1', 'eth1', 'via 192.168.56.12 / flannel.1', bi('host-gw: следующий хоп — второй узел. VXLAN: устройство flannel.1 оборачивает пакет.', 'host-gw: the next hop is the second node. VXLAN: the flannel.1 device wraps the packet.'), bi('flannel', 'flannel')),
      edge('e-wire', 'eth1', 'eth2', bi('узел → узел', 'node → node'), bi('Через сеть узлов идёт либо пакет пода как есть (host-gw), либо он внутри UDP 8472 (VXLAN).', 'Across the node network goes either the pod packet as is (host-gw) or inside UDP 8472 (VXLAN).'), bi('сеть', 'the network'), { via: [[230, 438], [730, 438]], labelAt: 0.5 }),
      edge('e-in2', 'eth2', 'rt2', bi('снять обёртку / маршрут', 'decapsulate / route'), bi('Второй узел снимает обёртку (VXLAN) и маршрутизирует в свой podCIDR.', 'The second node removes the wrapper (VXLAN) and routes into its podCIDR.'), bi('ядро', 'the kernel')),
      edge('e-down2', 'rt2', 'br2', '10.42.1.0/24 dev cni0', bi('Свой podCIDR — на мост.', 'Its own podCIDR — onto the bridge.'), bi('ядро', 'the kernel')),
      edge('e-c', 'br2', 'c', 'veth', bi('Мост отдаёт кадр в veth пода C.', 'The bridge hands the frame to pod C’s veth.'), bi('CNI', 'CNI')),
    ],
    groups: [
      { id: 'g1', label: 'worker-1', around: ['a', 'b', 'br1', 'rt1', 'eth1'], family: 'node', dash: 'solid', pad: 10, card: { what: bi('Узел 1, podCIDR 10.42.0.0/24.', 'Node 1, podCIDR 10.42.0.0/24.'), who: bi('kube-controller-manager выдаёт podCIDR узлу', 'kube-controller-manager assigns the node its podCIDR') } },
      { id: 'g2', label: 'worker-2', around: ['c', 'br2', 'rt2', 'eth2'], family: 'node', dash: 'solid', pad: 10, card: { what: bi('Узел 2, podCIDR 10.42.1.0/24.', 'Node 2, podCIDR 10.42.1.0/24.'), who: bi('kube-controller-manager', 'kube-controller-manager') } },
    ],
  },
  params: [
    {
      id: 'target',
      label: bi('Куда', 'Where to'),
      kind: 'choice',
      default: 'other',
      options: [
        { id: 'same', label: bi('под B, тот же узел', 'pod B, the same node') },
        { id: 'other', label: bi('под C, другой узел', 'pod C, another node') },
      ],
      near: 'a',
    },
    {
      id: 'mode',
      label: bi('Способ доставки между узлами', 'Delivery between nodes'),
      kind: 'choice',
      default: 'vxlan',
      options: [
        { id: 'host-gw', label: bi('маршрут (host-gw)', 'a route (host-gw)') },
        { id: 'vxlan', label: bi('конверт в конверте (VXLAN)', 'an envelope in an envelope (VXLAN)') },
      ],
      near: 'rt1',
      predict: {
        prompt: bi('Теперь пакет пода оборачивается. Что увидит сеть узлов в заголовке?', 'Now the pod packet is wrapped. What does the node network see in the header?'),
        options: [
          { id: 'nodes', text: bi('Адреса узлов 192.168.56.11 → .12, UDP', 'The node addresses 192.168.56.11 → .12, UDP') },
          { id: 'pods', text: bi('Адреса подов 10.42.0.15 → 10.42.1.20', 'The pod addresses 10.42.0.15 → 10.42.1.20') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'wrap') ? 'nodes' : 'pods'),
      },
    },
    {
      id: 'subnets',
      label: bi('Узлы в разных подсетях', 'The nodes are in different subnets'),
      kind: 'toggle',
      default: false,
      near: 'net',
      predict: {
        prompt: bi('Между узлами теперь маршрутизатор. Будет ли работать host-gw?', 'There is a router between the nodes now. Will host-gw work?'),
        options: [
          { id: 'no', text: bi('Нет: следующий хоп недоступен напрямую', 'No: the next hop is not directly reachable') },
          { id: 'yes', text: bi('Да', 'Yes') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken) ? 'no' : 'yes'),
      },
    },
    { id: 'mtu', label: bi('MTU пода', 'Pod MTU'), kind: 'choice', default: '1450', options: [{ id: '1450', label: bi('1450 (правильно для VXLAN)', '1450 (right for VXLAN)') }, { id: '1500', label: bi('1500 (как у узла)', '1500 (as on the node)') }], near: 'a', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    { id: 'no-route', label: bi('Удалить маршрут на worker-1', 'Delete the route on worker-1'), remove: ['e-out1'], layer: 'L3', boundary: 'network', predict: { prompt: bi('Маршрута к 10.42.1.0/24 нет. Что с пакетом A → C?', 'There is no route to 10.42.1.0/24. What happens to the packet A → C?'), options: [{ id: 'default', text: bi('Уйдёт по маршруту по умолчанию и пропадёт', 'It goes out the default route and gets lost') }, { id: 'fine', text: bi('Дойдёт, мост разберётся', 'It arrives, the bridge sorts it out') }], resolve: (_p, n) => (n.some((s) => s.broken) ? 'default' : 'fine') } },
    { id: 'udp', label: bi('Межсетевой экран облака закрыл UDP 8472', 'The cloud firewall closed UDP 8472'), remove: ['e-wire'], layer: 'L4', boundary: 'network', predict: { prompt: bi('UDP 8472 закрыт. A → B на одном узле работает?', 'UDP 8472 is closed. Does A → B on one node work?'), options: [{ id: 'yes', text: bi('Да: через узлы ходит только трафик между узлами', 'Yes: only traffic between the nodes crosses the firewall') }, { id: 'no', text: bi('Нет, всё встанет', 'No, everything stops') }], resolve: () => 'yes' } },
    { id: 'no-cni', label: bi('Остановить CNI', 'Stop the CNI'), remove: ['e-a', 'e-b', 'e-c'], layer: 'L3', boundary: 'network', predict: { prompt: bi('CNI остановлен. Что с новыми подами?', 'The CNI is stopped. What happens to new pods?'), options: [{ id: 'creating', text: bi('ContainerCreating: нет сети — нет песочницы', 'ContainerCreating: no network, no sandbox') }, { id: 'nonet', text: bi('Запустятся без сети', 'They start without a network') }], resolve: () => 'creating' } },
  ],
  metrics: [
    { id: 'hops', label: bi('хопов', 'hops') },
    { id: 'overhead', label: bi('байт на обёртку', 'bytes of wrapping'), unit: 'B' },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    const vx = p.mode === 'vxlan';
    if (broken.has('no-cni')) {
      s.push({ id: 'nocni', label: 'CNI', caption: bi('Плагин CNI не работает: kubelet не может создать песочницу ни одному новому поду.', 'The CNI plugin does not work: the kubelet cannot create a sandbox for any new pod.'), focus: ['br1'], states: { br1: 'err' }, metrics: { hops: 0, overhead: 0 }, broken: { at: 'br1', message: 'container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized', caption: bi('узел NotReady, новые поды — ContainerCreating с FailedCreatePodSandBox.', 'the node is NotReady, new pods are ContainerCreating with FailedCreatePodSandBox.') } });
      return s;
    }
    s.push({ id: 'route', label: bi('маршрут пода', 'pod route'), caption: p.target === 'same' ? bi('Под A шлёт пакет 10.42.0.15 → 10.42.0.16. Адрес в той же подсети /24: ARP через eth0 пода, ответ даёт сам B через мост.', 'Pod A sends a packet 10.42.0.15 → 10.42.0.16. The address is in the same /24: ARP through the pod eth0, B itself answers through the bridge.') : bi('Под A шлёт пакет 10.42.0.15 → 10.42.1.20. Подсеть чужая: пакет уходит на шлюз пода 10.42.0.1 — мост узла.', 'Pod A sends a packet 10.42.0.15 → 10.42.1.20. Another subnet: the packet goes to the pod gateway 10.42.0.1 — the node bridge.'), focus: ['a', 'e-a'], tokens: [{ edge: 'e-a', label: p.target === 'same' ? '→ 10.42.0.16' : '→ 10.42.1.20' }], states: { a: 'on' }, metrics: { hops: 1, overhead: 0 } });
    if (p.target === 'same') {
      s.push({ id: 'bridge', label: bi('мост', 'bridge'), caption: bi('Мост cni0 по MAC-адресу назначения переправляет кадр в veth пода B — как обычный коммутатор. Маршрутизации и NAT нет: B видит источник 10.42.0.15.', 'The cni0 bridge forwards the frame by destination MAC into pod B’s veth — like an ordinary switch. No routing, no NAT: B sees the source 10.42.0.15.'), focus: ['br1', 'e-b', 'b'], tokens: [{ edge: 'e-b', label: 'frame' }], states: { b: 'ok' }, metrics: { hops: 2, overhead: 0 } });
      return s;
    }
    s.push({ id: 'up', label: bi('ядро узла', 'node kernel'), caption: vx ? bi('Ядро worker-1 ищет маршрут: 10.42.1.0/24 dev flannel.1 — устройство VXLAN.', 'The worker-1 kernel looks up the route: 10.42.1.0/24 dev flannel.1 — the VXLAN device.') : bi('Ядро worker-1 ищет маршрут: 10.42.1.0/24 via 192.168.56.12 — второй узел и есть маршрутизатор подсети подов C.', 'The worker-1 kernel looks up the route: 10.42.1.0/24 via 192.168.56.12 — the second node itself is the router for pod C’s subnet.'), focus: ['e-up1', 'rt1'], tokens: [{ edge: 'e-up1' }], values: { rt1: vx ? '10.42.1.0/24 dev flannel.1' : '10.42.1.0/24 via 192.168.56.12' }, metrics: { hops: 2, overhead: 0 } });
    if (broken.has('no-route')) {
      s.push({ id: 'lost', label: bi('нет маршрута', 'no route'), caption: bi('Маршрута к 10.42.1.0/24 нет: пакет уходит по маршруту по умолчанию к шлюзу облака, а тот про адреса подов ничего не знает.', 'There is no route to 10.42.1.0/24: the packet leaves via the default route to the cloud gateway, which knows nothing about pod addresses.'), focus: ['rt1', 'e-out1'], states: { rt1: 'err' }, metrics: { hops: 2, overhead: 0 }, broken: { at: 'e-out1', message: '$ kubectl exec a -- ping -c1 -W2 10.42.1.20\n1 packets transmitted, 0 received, 100% packet loss', caption: bi('на одном узле всё работает, между узлами — тишина: признак сломанной межузловой маршрутизации.', 'on one node everything works, between nodes there is silence: the sign of broken routing between nodes.') } });
      return s;
    }
    if (!vx && p.subnets) {
      s.push({ id: 'unreach', label: bi('недоступен', 'unreachable'), caption: bi('host-gw требует, чтобы второй узел был следующим хопом в той же сети. Узлы в разных подсетях: 192.168.56.12 не сосед по L2.', 'host-gw needs the second node to be the next hop on the same network. The nodes are in different subnets: 192.168.56.12 is not an L2 neighbour.'), focus: ['rt1', 'net'], states: { rt1: 'err' }, metrics: { hops: 2, overhead: 0 }, broken: { at: 'rt1', message: 'Error: Nexthop has invalid gateway.', caption: bi('для узлов в разных подсетях нужен «конверт» (VXLAN) или маршрутизатор, который знает podCIDR (BGP).', 'nodes in different subnets need an "envelope" (VXLAN) or a router that knows the podCIDRs (BGP).') } });
      return s;
    }
    if (vx) {
      s.push({ id: 'wrap', label: bi('конверт', 'envelope'), caption: bi('flannel.1 кладёт весь пакет пода внутрь нового: снаружи 192.168.56.11 → 192.168.56.12 UDP 8472, VNI 1; внутри по-прежнему 10.42.0.15 → 10.42.1.20. Обёртка — 50 байт.', 'flannel.1 puts the whole pod packet inside a new one: outside 192.168.56.11 → 192.168.56.12 UDP 8472, VNI 1; inside still 10.42.0.15 → 10.42.1.20. The wrapping is 50 bytes.'), focus: ['e-out1', 'eth1'], tokens: [{ edge: 'e-out1', label: 'UDP 8472' }], values: { eth1: 'outer .11 → .12 UDP 8472' }, metrics: { hops: 3, overhead: 50 } });
      if (Number(p.mtu) === 1500) {
        s.push({ id: 'mtu', label: 'MTU', caption: bi('Пакет пода был 1500 байт, с обёрткой — 1550: больше MTU сети узлов. Маленькие пакеты проходят, большие (ответы TLS, загрузки) пропадают.', 'The pod packet was 1500 bytes, with the wrapping 1550: more than the node network MTU. Small packets pass, big ones (TLS replies, downloads) get lost.'), focus: ['eth1', 'a'], states: { eth1: 'err' }, metrics: { hops: 3, overhead: 50 }, broken: { at: 'eth1', message: 'ICMP 10.42.0.15 unreachable - need to frag (mtu 1450)', caption: bi('обёртка съела 50 байт: MTU пода должен быть 1450, CNI так и выставляет по умолчанию.', 'the wrapping ate 50 bytes: the pod MTU must be 1450, which is what the CNI sets by default.') } });
        return s;
      }
    }
    if (vx && broken.has('udp')) {
      s.push({ id: 'fw', label: 'UDP 8472', caption: bi('Межсетевой экран облака пропускает только 22 и 443: UDP 8472 между узлами отброшен.', 'The cloud firewall lets only 22 and 443 through: UDP 8472 between the nodes is dropped.'), focus: ['e-wire', 'net'], states: { net: 'err' }, metrics: { hops: 3, overhead: 50 }, broken: { at: 'e-wire', message: '$ kubectl exec a -- curl -m 5 http://10.42.1.20\ncurl: (28) Connection timed out after 5001 milliseconds', caption: bi('тайм-аут только между узлами, на одном узле всё работает: проверьте правила межсетевого экрана для UDP 8472.', 'a timeout only between nodes, on one node everything works: check the firewall rules for UDP 8472.') } });
      return s;
    }
    s.push({ id: 'wire', label: bi('сеть узлов', 'node network'), caption: vx ? bi('По сети узлов идёт обычный UDP между двумя узлами — сеть не обязана знать адреса подов.', 'Across the node network goes ordinary UDP between two nodes — the network does not need to know pod addresses.') : bi('По сети узлов идёт пакет пода как есть: 10.42.0.15 → 10.42.1.20, но кадр адресован MAC второго узла.', 'The pod packet crosses the node network as is: 10.42.0.15 → 10.42.1.20, but the frame is addressed to the second node’s MAC.'), focus: ['e-wire', 'net'], tokens: [{ edge: 'e-wire', label: vx ? 'outer .11→.12' : '10.42.0.15→10.42.1.20' }], metrics: { hops: 4, overhead: vx ? 50 : 0 } });
    s.push({ id: 'in', label: bi('второй узел', 'second node'), caption: vx ? bi('worker-2 принимает UDP 8472, flannel.1 снимает обёртку, внутри — пакет для 10.42.1.20: свой podCIDR, на мост cni0.', 'worker-2 receives UDP 8472, flannel.1 removes the wrapping, inside is a packet for 10.42.1.20: its own podCIDR, onto cni0.') : bi('worker-2 видит пакет для 10.42.1.20: это его podCIDR — маршрут на мост cni0.', 'worker-2 sees a packet for 10.42.1.20: its own podCIDR — the route goes to the cni0 bridge.'), focus: ['e-in2', 'rt2', 'e-down2', 'br2'], tokens: [{ edge: 'e-in2' }, { edge: 'e-down2' }], metrics: { hops: 5, overhead: vx ? 50 : 0 } });
    s.push({ id: 'deliver', label: bi('доставлено', 'delivered'), caption: bi('Мост отдаёт кадр в veth пода C. C видит источник 10.42.0.15 — без NAT, как и обещает модель сети.', 'The bridge hands the frame to pod C’s veth. C sees the source 10.42.0.15 — no NAT, as the network model promises.'), focus: ['e-c', 'c'], tokens: [{ edge: 'e-c' }], states: { c: 'ok' }, metrics: { hops: 6, overhead: vx ? 50 : 0 } });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? (next.some((x) => x.broken) ? bi('Поломка на пути: пакет остановился там, где её видно.', 'A break on the path: the packet stopped where you can see it.') : bi('Этот путь поломка не задевает — попробуйте другой узел или способ доставки.', 'This path does not cross the break — try another node or delivery mode.')) : bi('Поломка убрана.', 'The break is removed.');
    switch (change.id) {
      case 'target':
        return b.target === 'same' ? bi('На одном узле пакет не покидает узел: мост, и всё.', 'On one node the packet never leaves the node: the bridge, and that is all.') : bi('На другой узел: ядро узла маршрутизирует, дальше — способ доставки CNI.', 'To another node: the node kernel routes, then the CNI delivery mode takes over.');
      case 'mode':
        return b.mode === 'vxlan' ? bi('VXLAN: пакет пода едет внутри UDP между узлами — сеть узлов видит только адреса узлов, +50 байт.', 'VXLAN: the pod packet travels inside UDP between nodes — the node network sees only node addresses, +50 bytes.') : bi('host-gw: обёртки нет, но узлы должны быть соседями в одной сети.', 'host-gw: no wrapping, but the nodes must be neighbours on one network.');
      case 'subnets':
        return b.subnets ? (b.mode === 'vxlan' ? bi('Разные подсети VXLAN не мешают: снаружи обычный UDP между узлами, его маршрутизирует любая сеть.', 'Different subnets do not bother VXLAN: outside it is ordinary UDP between nodes, any network routes it.') : bi('Разные подсети ломают host-gw: следующий хоп не сосед.', 'Different subnets break host-gw: the next hop is not a neighbour.')) : bi('Узлы снова в одной подсети.', 'The nodes are in one subnet again.');
      case 'mtu':
        return Number(b.mtu) === 1500 ? bi('MTU пода 1500 поверх VXLAN: большие пакеты не помещаются в 1500 узла после обёртки.', 'Pod MTU 1500 on top of VXLAN: big packets do not fit into the node’s 1500 after wrapping.') : fmt(bi('MTU пода {m}: с обёрткой ровно 1500.', 'Pod MTU {m}: exactly 1500 with the wrapping.'), { m: Number(b.mtu) });
    }
    return bi('Путь пересчитан.', 'The path is recomputed.');
  },
});
