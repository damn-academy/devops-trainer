// X4, screen 6 (04 §6.5): today VMs and containers are nested inside each
// other: containers in cloud VMs, Kubernetes on bare metal, VMs inside
// Kubernetes through KubeVirt (how Cozystack gives VMs to tenants). The
// knob says what kind of workload it is and the model says where it goes.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';

type P = { workload: string };

const PLACE: Record<string, { tower: 'cloud' | 'metal' | 'kubevirt'; why: Bi }> = {
  service: { tower: 'metal', why: bi('Однородные сервисы одной команды плотнее всего упаковываются контейнерами прямо на железе: одно ядро, никаких гостевых ОС.', 'Uniform services of one team pack most densely as containers straight on the hardware: one kernel, no guest OSes.') },
  untrusted: { tower: 'cloud', why: bi('Чужой код лучше отделить гипервизором: у каждого клиента облака своя ВМ со своим ядром, а контейнеры — уже внутри неё.', 'Somebody else’s code is better kept behind a hypervisor: every cloud customer gets a VM with its own kernel, and containers run inside it.') },
  windows: { tower: 'kubevirt', why: bi('Программе нужно своё ядро — значит, ВМ. KubeVirt запускает её как под: QEMU живёт в контейнере virt-launcher, а планирует его Kubernetes.', 'The program needs its own kernel — so a VM. KubeVirt runs it as a pod: QEMU lives in the virt-launcher container and Kubernetes schedules it.') },
};

export const nestingModel = defineModel<P>({
  id: 'containers.nesting',
  block: 'containers',
  title: bi('Сегодня: ВМ и контейнеры вкладывают друг в друга', 'Today: VMs and containers are nested in each other'),
  summary: bi('Три башни, которые встречаются в работе каждый день. Выберите, что нужно запустить, — модель скажет, в какую башню и почему.', 'Three towers you meet at work every day. Choose what has to run and the model says which tower and why.'),
  concepts: ['docker.container', 'docker.vm', 'docker.vm-vs-container'],
  diagram: {
    width: 960,
    height: 500,
    nodes: [
      { id: 'c-ct', label: bi('контейнеры клиента', 'customer’s containers'), family: 'ns', x: 24, y: 40, w: 280, h: 64, card: { what: bi('Контейнеры работают внутри ВМ, которую клиент арендовал у облака. Так устроен почти любой управляемый Kubernetes.', 'Containers run inside a VM the customer rents from the cloud. Almost every managed Kubernetes works this way.'), who: bi('Клиент облака — Docker или Kubernetes внутри своей ВМ.', 'The cloud customer — Docker or Kubernetes inside their VM.') } },
      { id: 'c-vm', label: bi('ВМ клиента: своё ядро', 'customer VM: its own kernel'), sub: 'Linux 6.12', family: 'kernel', x: 24, y: 152, w: 280, h: 64, card: { what: bi('Виртуальная машина со своим ядром — граница между клиентами облака.', 'A virtual machine with its own kernel — the boundary between cloud customers.'), who: bi('Облако создаёт её по заказу клиента.', 'The cloud creates it when the customer orders it.') } },
      { id: 'c-hyp', label: bi('гипервизор облака', 'cloud hypervisor'), family: 'cp', shape: 'hex', x: 24, y: 264, w: 280, h: 64, card: { what: bi('Гипервизор провайдера делит его серверы между ВМ разных клиентов.', 'The provider’s hypervisor divides its servers between VMs of different customers.'), who: bi('Провайдер облака.', 'The cloud provider.') } },
      { id: 'c-hw', label: bi('железо провайдера', 'provider’s hardware'), family: 'node', shape: 'rack', x: 24, y: 400, w: 280, h: 64, card: { what: bi('Серверы дата-центра облака.', 'The cloud’s data-centre servers.'), who: bi('Провайдер облака.', 'The cloud provider.') } },
      { id: 'm-pods', label: bi('контейнеры подов', 'pod containers'), family: 'ns', x: 340, y: 152, w: 280, h: 64, card: { what: bi('Kubernetes на голом железе: контейнеры подов — процессы этого же ядра. Плотно и быстро, граница — внутри ядра.', 'Kubernetes on bare metal: pod containers are processes of this very kernel. Dense and fast; the boundary is inside the kernel.'), who: bi('kubelet просит рантайм запустить их.', 'kubelet asks the runtime to start them.') } },
      { id: 'm-node', label: bi('ядро + kubelet', 'kernel + kubelet'), sub: 'Linux 6.12', family: 'kernel', x: 340, y: 264, w: 280, h: 64, card: { what: bi('Одно ядро сервера и агент Kubernetes (kubelet), который получает поды от кластера и запускает их через рантайм.', 'One server kernel and the Kubernetes agent (kubelet), which receives pods from the cluster and starts them through the runtime.'), who: bi('Администратор кластера ставит узел.', 'The cluster administrator sets the node up.') } },
      { id: 'm-hw', label: bi('железо', 'hardware'), family: 'node', shape: 'rack', x: 340, y: 400, w: 280, h: 64, card: { what: bi('Свой сервер, без гипервизора.', 'Your own server, no hypervisor.'), who: bi('Компания или дата-центр.', 'The company or a data centre.') } },
      { id: 'v-guest', label: bi('ядро гостя → приложение', 'guest kernel → app'), sub: 'Windows · Linux', family: 'user', x: 656, y: 40, w: 280, h: 64, card: { what: bi('Полноценная ВМ: своё ядро, любая ОС. Пользователь видит обычную машину.', 'A complete VM: its own kernel, any OS. The user sees an ordinary machine.'), who: bi('Создаётся по объекту VirtualMachine в Kubernetes.', 'Created from a VirtualMachine object in Kubernetes.') } },
      { id: 'v-qemu', label: 'QEMU / KVM', family: 'cp', shape: 'hex', x: 656, y: 152, w: 280, h: 64, card: { what: bi('Гипервизор — это обычный процесс QEMU с модулем ядра KVM. Здесь он работает внутри контейнера.', 'The hypervisor is an ordinary QEMU process using the KVM kernel module. Here it runs inside a container.'), who: bi('KubeVirt запускает его в поде.', 'KubeVirt starts it in a pod.'), doc: { url: 'https://kubevirt.io/user-guide/', label: 'KubeVirt user guide' } } },
      { id: 'v-launcher', label: bi('под virt-launcher', 'virt-launcher pod'), family: 'ns', x: 656, y: 264, w: 280, h: 64, card: { what: bi('ВМ — обычный процесс QEMU внутри контейнера пода. Kubernetes планирует её как под: на какой узел, с какими лимитами. Так Cozystack даёт ВМ своим арендаторам.', 'The VM is an ordinary QEMU process inside a pod container. Kubernetes schedules it like any pod: which node, which limits. This is how Cozystack gives VMs to its tenants.'), who: bi('KubeVirt.', 'KubeVirt.'), doc: { url: 'https://cozystack.io/docs/', label: 'Cozystack docs' } } },
      { id: 'v-node', label: bi('ядро + kubelet', 'kernel + kubelet'), sub: 'Linux 6.12 · /dev/kvm', family: 'kernel', x: 656, y: 400, w: 280, h: 64, card: { what: bi('Узел Kubernetes на железе с включённой виртуализацией процессора: ядро даёт подам устройство /dev/kvm.', 'A Kubernetes node on hardware with CPU virtualisation enabled: the kernel gives pods the /dev/kvm device.'), who: bi('Администратор кластера.', 'The cluster administrator.') } },
    ],
    edges: [
      { id: 'e-c1', from: 'c-ct', to: 'c-vm', label: bi('системные вызовы', 'system calls'), card: { what: bi('Контейнеры клиента делят ядро его ВМ.', 'The customer’s containers share the kernel of their VM.'), who: bi('Процессы контейнеров.', 'Container processes.') } },
      { id: 'e-c2', from: 'c-vm', to: 'c-hyp', label: bi('виртуальное железо', 'virtual hardware'), card: { what: bi('Ядро ВМ управляет виртуальными устройствами гипервизора.', 'The VM kernel drives the hypervisor’s virtual devices.'), who: bi('Гипервизор.', 'The hypervisor.') } },
      { id: 'e-c3', from: 'c-hyp', to: 'c-hw', label: 'VT-x', card: { what: bi('Аппаратная виртуализация.', 'Hardware virtualisation.'), who: bi('Процессор.', 'The CPU.') } },
      { id: 'e-m1', from: 'm-pods', to: 'm-node', label: bi('системные вызовы', 'system calls'), card: { what: bi('Контейнеры подов говорят с ядром узла напрямую.', 'Pod containers talk to the node kernel directly.'), who: bi('Процессы контейнеров.', 'Container processes.') } },
      { id: 'e-m2', from: 'm-node', to: 'm-hw', label: bi('драйверы', 'drivers'), card: { what: bi('Ядро на железе, без гипервизора.', 'A kernel on the hardware, no hypervisor.'), who: bi('Ядро.', 'The kernel.') } },
      { id: 'e-v1', from: 'v-guest', to: 'v-qemu', label: bi('виртуальное железо', 'virtual hardware'), card: { what: bi('Гостевое ядро работает на устройствах, которые эмулирует QEMU.', 'The guest kernel runs on the devices QEMU emulates.'), who: bi('QEMU.', 'QEMU.') } },
      { id: 'e-v2', from: 'v-qemu', to: 'v-launcher', label: bi('живёт в контейнере', 'lives in a container'), card: { what: bi('QEMU — процесс внутри контейнера virt-launcher: его namespaces и cgroup ограничивают и ВМ.', 'QEMU is a process inside the virt-launcher container: its namespaces and cgroup limit the VM too.'), who: bi('KubeVirt.', 'KubeVirt.') } },
      { id: 'e-v3', from: 'v-launcher', to: 'v-node', label: '/dev/kvm', card: { what: bi('Контейнер получает устройство KVM от ядра узла.', 'The container gets the KVM device from the node kernel.'), who: bi('kubelet и плагин устройств KubeVirt.', 'kubelet and the KubeVirt device plugin.') } },
    ],
    groups: [
      { id: 'g-cloud', label: bi('облако: контейнеры в ВМ', 'cloud: containers in VMs'), around: ['c-ct', 'c-vm', 'c-hyp', 'c-hw'], family: 'neutral', dash: 'dot', card: { what: bi('Башня облака: граница между клиентами — гипервизор, внутри ВМ — контейнеры.', 'The cloud tower: the boundary between customers is the hypervisor; inside the VM, containers.'), who: bi('Облачный провайдер и клиент.', 'The cloud provider and the customer.') } },
      { id: 'g-metal', label: bi('Kubernetes на железе', 'Kubernetes on bare metal'), around: ['m-pods', 'm-node', 'm-hw'], family: 'neutral', dash: 'dot', card: { what: bi('Башня без гипервизора: одно ядро на все поды узла.', 'A tower without a hypervisor: one kernel for all the pods of the node.'), who: bi('Компания со своими серверами.', 'A company with its own servers.') } },
      { id: 'g-kv', label: bi('ВМ внутри Kubernetes', 'VMs inside Kubernetes'), around: ['v-guest', 'v-qemu', 'v-launcher', 'v-node'], family: 'neutral', dash: 'dot', card: { what: bi('KubeVirt: ВМ — это под, гипервизор — процесс в контейнере. Два ядра в одной башне.', 'KubeVirt: a VM is a pod, the hypervisor is a process in a container. Two kernels in one tower.'), who: bi('KubeVirt, Cozystack.', 'KubeVirt, Cozystack.') } },
    ],
  },
  params: [
    {
      id: 'workload',
      label: bi('Что нужно запустить', 'What has to run'),
      kind: 'choice',
      default: 'service',
      options: [
        { id: 'service', label: bi('десяток своих веб-сервисов', 'a dozen of our own web services') },
        { id: 'untrusted', label: bi('код чужих клиентов', 'code of outside customers') },
        { id: 'windows', label: bi('программу для Windows', 'a Windows program') },
      ],
      predict: {
        prompt: bi('Нужно запустить программу для Windows рядом с контейнерами. Какая башня подходит?', 'A Windows program has to run next to the containers. Which tower fits?'),
        options: [
          { id: 'kubevirt', text: bi('ВМ внутри Kubernetes', 'VMs inside Kubernetes') },
          { id: 'metal', text: bi('Контейнеры на железе', 'Containers on bare metal') },
        ],
        resolve: (_p, next) => (next[next.length - 1]?.focus.includes('v-guest') ? 'kubevirt' : 'metal'),
      },
    },
  ],
  breaks: [
    {
      id: 'vm-kernel',
      label: bi('Ядро ВМ клиента упало', 'The customer VM’s kernel crashed'),
      remove: ['c-vm', 'e-c1'],
      boundary: 'kernel',
      predict: {
        prompt: bi('Упало ядро одной клиентской ВМ. Чьи контейнеры остановятся?', 'The kernel of one customer VM crashed. Whose containers stop?'),
        options: [
          { id: 'one', text: bi('Только этого клиента', 'Only this customer’s') },
          { id: 'all', text: bi('Всех клиентов облака', 'Every customer’s in the cloud') },
        ],
        resolve: () => 'one',
      },
    },
  ],
  metrics: [
    { id: 'kernels', label: bi('ядер в выбранной башне', 'kernels in the chosen tower') },
    { id: 'hops', label: bi('слоёв до железа', 'layers down to the hardware') },
  ],
  run(p, broken): Step[] {
    const place = PLACE[p.workload] ?? PLACE.service;
    const towerKernels = { cloud: 2, metal: 1, kubevirt: 2 }[place.tower];
    const towerHops = { cloud: 4, metal: 3, kubevirt: 5 }[place.tower];
    const metrics = { kernels: towerKernels, hops: towerHops };
    const steps: Step[] = [
      { id: 'cloud', label: bi('облако', 'cloud'), caption: bi('Контейнеры в облачной ВМ: провайдер делит железо гипервизором, у клиента — своя ВМ со своим ядром, а в ней его контейнеры. Два ядра в одной башне.', 'Containers in a cloud VM: the provider divides the hardware with a hypervisor, the customer has a VM with its own kernel and containers inside it. Two kernels in one tower.'), focus: ['g-cloud', 'c-ct', 'c-vm', 'c-hyp'], tokens: [{ edge: 'e-c1' }], metrics: { kernels: 2, hops: 4 } },
      { id: 'metal', label: bi('железо', 'metal'), caption: bi('Kubernetes на своём железе: узел — это ядро и kubelet, поды — контейнеры этого ядра. Одно ядро, нет гостевых ОС, плотнее всего.', 'Kubernetes on its own hardware: a node is a kernel and kubelet, pods are containers of that kernel. One kernel, no guest OSes, the densest option.'), focus: ['g-metal', 'm-pods', 'm-node'], tokens: [{ edge: 'e-m1' }], metrics: { kernels: 1, hops: 3 } },
      { id: 'kubevirt', label: 'KubeVirt', caption: bi('ВМ внутри Kubernetes: QEMU работает в контейнере пода virt-launcher, а в ВМ — своё ядро и любая ОС. Kubernetes планирует ВМ как под — так Cozystack даёт ВМ арендаторам.', 'VMs inside Kubernetes: QEMU runs in the container of the virt-launcher pod, and the VM has its own kernel and any OS. Kubernetes schedules the VM like a pod — this is how Cozystack gives VMs to tenants.'), focus: ['g-kv', 'v-launcher', 'v-qemu', 'v-guest'], tokens: [{ edge: 'e-v2' }], metrics: { kernels: 2, hops: 5 } },
      {
        id: 'choice',
        label: bi('куда', 'where'),
        caption: { ru: `${place.why.ru} Вывод: контейнер и ВМ — не соперники, а слои, которые вкладывают друг в друга по нужде изоляции.`, en: `${place.why.en} The conclusion: containers and VMs are not rivals but layers nested in each other as isolation requires.` },
        focus: place.tower === 'cloud' ? ['g-cloud', 'c-vm'] : place.tower === 'metal' ? ['g-metal', 'm-pods'] : ['g-kv', 'v-guest'],
        states: place.tower === 'cloud' ? { 'c-vm': 'ok' } : place.tower === 'metal' ? { 'm-pods': 'ok' } : { 'v-guest': 'ok' },
        metrics,
      },
    ];
    if (broken.has('vm-kernel')) {
      steps.push({ id: 'crash', label: bi('сбой', 'crash'), caption: bi('Упало ядро одной ВМ: её контейнеры остановились, у соседних клиентов — свои ядра, они работают.', 'One VM’s kernel crashed: its containers stopped; the neighbours have their own kernels and keep running.'), focus: ['c-vm', 'c-ct'], states: { 'c-ct': 'err' }, metrics, broken: { at: 'c-vm', message: 'Kernel panic - not syncing: VFS: Unable to mount root fs', caption: bi('граница гипервизора удержала сбой внутри одной ВМ.', 'the hypervisor boundary kept the failure inside one VM.') } });
    }
    return steps;
  },
  explainDelta(_prev, _next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Сбой ядра ВМ задевает только её контейнеры: граница — гипервизор.', 'A VM kernel failure only hits its own containers: the boundary is the hypervisor.') : bi('ВМ снова работает.', 'The VM runs again.');
    return (PLACE[b.workload] ?? PLACE.service).why;
  },
});
