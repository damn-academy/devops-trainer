// X4, screen 6 (04 §6.5): today VMs and containers are nested inside each
// other: containers in cloud VMs, Kubernetes on bare metal, VMs inside
// Kubernetes through KubeVirt (how Cozystack gives VMs to tenants). The
// knob says what kind of workload it is and the model says where it goes.
//
// Reading order: the three towers are built one after another from the
// hardware up, so the learner sees what lies on what. Every acting block
// says in a callout what it does; the last step lights up the tower the
// chosen workload goes to and says why.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { startWith } from './util';

type P = { workload: string };

const PLACE: Record<string, { tower: 'cloud' | 'metal' | 'kubevirt'; node: string; why: Bi; say: Bi }> = {
  service: {
    tower: 'metal',
    node: 'm-pods',
    why: bi('Десяток собственных веб-сервисов одной команды плотнее всего укладывается контейнерами прямо на железе, потому что ядро здесь одно, а гостевых систем, которые занимали бы память, нет. Код свой, поэтому границы внутри одного ядра здесь достаточно.', 'Uniform services of one team pack most densely as containers straight on the hardware: one kernel, no guest OSes.'),
    say: bi('Свои сервисы лучше всего ставить сюда, потому что ядро здесь одно на все поды и память не уходит на гостевые системы.', 'Our own services go here: one kernel for all pods, no memory spent on guest systems.'),
  },
  untrusted: {
    tower: 'cloud',
    node: 'c-vm',
    why: bi('Код чужих клиентов лучше отделить гипервизором. Каждый клиент получает свою виртуальную машину со своим ядром, а его контейнеры работают уже внутри неё, поэтому уязвимость в ядре одного клиента не задевает соседей.', 'Somebody else’s code is better kept behind a hypervisor: every cloud customer gets a VM with its own kernel, and containers run inside it.'),
    say: bi('Чужой код лучше всего запускать здесь, потому что у каждого клиента своя ВМ со своим ядром, а между ВМ стоит гипервизор.', 'Outside code goes here: each customer has a VM with its own kernel, and the hypervisor stands between VMs.'),
  },
  windows: {
    tower: 'kubevirt',
    node: 'v-guest',
    why: bi('Программе для Windows нужно своё ядро, а значит, и виртуальная машина. KubeVirt запускает её как обычный под. Гипервизор QEMU работает процессом в контейнере virt-launcher, а размещает этот под Kubernetes.', 'The program needs its own kernel — so a VM. KubeVirt runs it as a pod: QEMU runs in the virt-launcher container and Kubernetes schedules it.'),
    say: bi('Программу для Windows лучше всего ставить сюда, потому что в ВМ можно поставить Windows с её собственным ядром.', 'The Windows program goes here: a VM can run Windows with its own kernel.'),
  },
};

const ALL = ['c-ct', 'c-vm', 'c-hyp', 'c-hw', 'm-pods', 'm-node', 'm-hw', 'v-guest', 'v-qemu', 'v-launcher', 'v-node', 'v-hw', 'e-c1', 'e-c2', 'e-c3', 'e-m1', 'e-m2', 'e-v1', 'e-v2', 'e-v3', 'e-v4'];
const COL = { c: 24, m: 340, v: 656 };
const ROW = [104, 200, 296, 392, 488];
const W = 280;
const H = 56;

export const nestingModel = defineModel<P>({
  id: 'containers.nesting',
  block: 'containers',
  title: bi('Как сегодня вкладывают ВМ и контейнеры друг в друга', 'Today: VMs and containers are nested in each other'),
  summary: bi(
    'Схема показывает три устройства, которые встречаются в работе каждый день: контейнеры внутри облачной виртуальной машины, Kubernetes прямо на своих серверах и виртуальная машина внутри Kubernetes. В «Параметрах» выберите, что нужно запустить, и на последнем шаге схема покажет, куда это лучше поставить и почему.',
    'Three setups you meet at work every day: containers inside a cloud VM, Kubernetes straight on your own servers, and a VM inside Kubernetes. Choose in “Parameters” what has to run, and at the last step the diagram shows where it goes and why.',
  ),
  intro: bi(
    'Сейчас на схеме только железо облачного провайдера и его гипервизор. Нажмите «Начать с первого шага», а дальше переходите от шага к шагу кнопкой «Шаг вперёд». Три башни вырастут по очереди, каждая снизу вверх, от железа к приложению. Облачко у подсвеченного блока говорит, что этот блок делает.\n\nПосле первого прохода выберите в «Параметрах» другую задачу и посмотрите, в какую башню она попадёт на последнем шаге.',
    'Now the diagram shows only the cloud provider’s hardware and its hypervisor. Press “Start from the first step”, then go on with “Step forward”: three towers grow one after another, each from the hardware up to the application. The callout at the highlighted block says what it does.\n\nAfter the first pass choose another task in “Parameters” and see which tower it goes to at the last step.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('что блок передаёт вниз, например системный вызов или устройство', 'what the block hands down, such as a system call or a device') },
    { mark: 'icon:container', text: bi('контейнер или под', 'a container or a pod') },
    { mark: 'icon:terminal', text: bi('ядро системы', 'an operating-system kernel') },
    { mark: 'icon:cloud', text: bi('гипервизор', 'a hypervisor') },
    { mark: 'icon:server', text: bi('физический сервер', 'a physical server') },
    { mark: 'ok', text: bi('сюда лучше всего поставить выбранную задачу', 'the best place for the chosen task') },
    { mark: 'err', text: bi('здесь случился сбой', 'a failure happened here') },
  ],
  stopLabel: bi('Сбой', 'Failure'),
  concepts: ['docker.container', 'docker.vm', 'docker.vm-vs-container'],
  diagram: {
    width: 960,
    height: 560,
    nodes: [
      { id: 'c-ct', label: bi('Контейнеры клиента', 'Customer’s containers'), icon: 'container', family: 'ns', x: COL.c, y: ROW[1], w: W, h: H, card: { what: bi('Контейнеры работают внутри виртуальной машины, которую клиент арендовал у облака. Так устроен почти любой управляемый Kubernetes.', 'Containers run inside a VM the customer rents from the cloud. Almost every managed Kubernetes works this way.'), who: bi('Их запускает сам клиент облака: Docker или Kubernetes внутри своей ВМ.', 'The cloud customer — Docker or Kubernetes inside their VM.') } },
      { id: 'c-vm', label: bi('ВМ клиента со своим ядром', 'Customer VM, own kernel'), icon: 'terminal', sub: 'Linux 6.12', family: 'kernel', x: COL.c, y: ROW[2], w: W, h: H, card: { what: bi('Виртуальная машина со своим ядром отделяет одного клиента облака от другого.', 'A virtual machine with its own kernel — the boundary between cloud customers.'), who: bi('Облако создаёт её, когда клиент её заказывает.', 'The cloud creates it when the customer orders it.') } },
      { id: 'c-hyp', label: bi('Гипервизор облака', 'Cloud hypervisor'), icon: 'cloud', family: 'cp', x: COL.c, y: ROW[3], w: W, h: H, card: { what: bi('Гипервизор провайдера делит его серверы между виртуальными машинами разных клиентов.', 'The provider’s hypervisor divides its servers between VMs of different customers.'), who: bi('Его обслуживает облачный провайдер.', 'The cloud provider.') } },
      { id: 'c-hw', label: bi('Железо облака', 'Provider’s hardware'), icon: 'server', family: 'node', shape: 'rack', x: COL.c, y: ROW[4], w: W, h: H, card: { what: bi('Эти серверы стоят в дата-центре облачного провайдера.', 'The cloud’s data-centre servers.'), who: bi('Их обслуживает облачный провайдер.', 'The cloud provider.') } },
      { id: 'm-pods', label: bi('Контейнеры подов', 'Pod containers'), icon: 'container', family: 'ns', x: COL.m, y: ROW[2], w: W, h: H, card: { what: bi('Здесь Kubernetes работает на собственном железе компании, и контейнеры подов остаются процессами того же ядра, которое управляет сервером. Так получается плотно и быстро, но граница между подами проходит внутри одного ядра.', 'Kubernetes on bare metal: pod containers are processes of this very kernel. Dense and fast; the boundary is inside the kernel.'), who: bi('kubelet просит рантайм их запустить.', 'kubelet asks the runtime to start them.') } },
      { id: 'm-node', label: bi('Ядро и kubelet', 'Kernel and kubelet'), icon: 'terminal', sub: 'Linux 6.12', family: 'kernel', x: COL.m, y: ROW[3], w: W, h: H, card: { what: bi('На сервере работают одно ядро и агент Kubernetes под названием kubelet. Агент получает от кластера описания подов и запускает их через рантайм контейнеров.', 'One server kernel and the Kubernetes agent (kubelet), which receives pods from the cluster and starts them through the runtime.'), who: bi('Узел настраивает администратор кластера.', 'The cluster administrator sets the node up.') } },
      { id: 'm-hw', label: bi('Свой сервер компании', 'Own hardware'), icon: 'server', family: 'node', shape: 'rack', x: COL.m, y: ROW[4], w: W, h: H, card: { what: bi('Собственный сервер компании, на котором гипервизора нет.', 'Your own server, no hypervisor.'), who: bi('Его обслуживает компания или арендованный дата-центр.', 'The company or a data centre.') } },
      { id: 'v-guest', label: bi('ВМ со своим ядром и приложением', 'VM with its own kernel and app'), icon: 'terminal', sub: 'Windows · Linux', family: 'user', x: COL.v, y: ROW[0], w: W, h: H, card: { what: bi('В полноценной виртуальной машине со своим ядром может работать любая система. Пользователь видит обычный компьютер.', 'A complete VM: its own kernel, any OS. The user sees an ordinary machine.'), who: bi('Её создаёт KubeVirt по объекту VirtualMachine в Kubernetes.', 'Created from a VirtualMachine object in Kubernetes.') } },
      { id: 'v-qemu', label: 'QEMU / KVM', icon: 'cloud', family: 'cp', x: COL.v, y: ROW[1], w: W, h: H, card: { what: bi('Здесь гипервизором служит обычный процесс QEMU, который пользуется модулем ядра KVM. Работает этот процесс внутри контейнера.', 'The hypervisor is an ordinary QEMU process using the KVM kernel module. Here it runs inside a container.'), who: bi('KubeVirt запускает его в поде.', 'KubeVirt starts it in a pod.'), doc: { url: 'https://kubevirt.io/user-guide/', label: 'KubeVirt user guide' } } },
      { id: 'v-launcher', label: bi('Под virt-launcher', 'virt-launcher pod'), icon: 'container', family: 'ns', x: COL.v, y: ROW[2], w: W, h: H, card: { what: bi('Внутри контейнера этого пода работает процесс QEMU. Kubernetes размещает этот под так же, как любой другой, то есть выбирает для него узел и назначает лимиты. Так платформа Cozystack выдаёт виртуальные машины своим пользователям.', 'The VM is an ordinary QEMU process inside a pod container. Kubernetes schedules it like any pod: which node, which limits. This is how Cozystack gives VMs to its tenants.'), who: bi('Под virt-launcher создаёт KubeVirt.', 'KubeVirt.'), doc: { url: 'https://cozystack.io/docs/', label: 'Cozystack docs' } } },
      { id: 'v-node', label: bi('Ядро и kubelet', 'Kernel and kubelet'), icon: 'terminal', sub: 'Linux 6.12 · /dev/kvm', family: 'kernel', x: COL.v, y: ROW[3], w: W, h: H, card: { what: bi('У этого узла Kubernetes в процессоре включена виртуализация. Ядро отдаёт подам устройство `/dev/kvm`.', 'A Kubernetes node on hardware with CPU virtualisation enabled: the kernel gives pods the /dev/kvm device.'), who: bi('Узел настраивает администратор кластера.', 'The cluster administrator.') } },
      { id: 'v-hw', label: bi('Сервер с VT-x', 'Server with VT-x'), icon: 'server', family: 'node', shape: 'rack', x: COL.v, y: ROW[4], w: W, h: H, card: { what: bi('Процессор этого физического сервера умеет аппаратную виртуализацию (VT-x у Intel, AMD-V у AMD).', 'A physical server whose CPU supports hardware virtualisation (VT-x, AMD-V).'), who: bi('Его обслуживает компания или дата-центр.', 'The company or a data centre.') } },
    ],
    edges: [
      { id: 'e-c1', from: 'c-ct', to: 'c-vm', label: bi('системные вызовы', 'system calls'), card: { what: bi('Контейнеры клиента делят ядро его виртуальной машины.', 'The customer’s containers share the kernel of their VM.'), who: bi('Вызовы делают процессы контейнеров.', 'Container processes.') } },
      { id: 'e-c2', from: 'c-vm', to: 'c-hyp', label: bi('виртуальное железо', 'virtual hardware'), card: { what: bi('Ядро ВМ управляет виртуальными устройствами, которые показывает гипервизор.', 'The VM kernel drives the hypervisor’s virtual devices.'), who: bi('Устройства показывает гипервизор.', 'The hypervisor.') } },
      { id: 'e-c3', from: 'c-hyp', to: 'c-hw', label: 'VT-x', card: { what: bi('Гипервизор пользуется аппаратной виртуализацией процессора.', 'Hardware virtualisation.'), who: bi('Аппаратную виртуализацию даёт процессор сервера.', 'The CPU.') } },
      { id: 'e-m1', from: 'm-pods', to: 'm-node', label: bi('системные вызовы', 'system calls'), card: { what: bi('Контейнеры подов обращаются к ядру узла напрямую.', 'Pod containers talk to the node kernel directly.'), who: bi('Вызовы делают процессы контейнеров.', 'Container processes.') } },
      { id: 'e-m2', from: 'm-node', to: 'm-hw', label: bi('драйверы', 'drivers'), card: { what: bi('Ядро работает прямо на железе, без гипервизора.', 'A kernel on the hardware, no hypervisor.'), who: bi('Драйверы входят в ядро.', 'The kernel.') } },
      { id: 'e-v1', from: 'v-guest', to: 'v-qemu', label: bi('виртуальное железо', 'virtual hardware'), card: { what: bi('Гостевое ядро работает на устройствах, которые изображает QEMU.', 'The guest kernel runs on the devices QEMU emulates.'), who: bi('Устройства изображает QEMU.', 'QEMU.') } },
      { id: 'e-v2', from: 'v-qemu', to: 'v-launcher', label: bi('работает в контейнере', 'runs in a container'), card: { what: bi('QEMU работает процессом внутри контейнера virt-launcher, поэтому пространства имён и cgroup этого контейнера ограничивают и виртуальную машину.', 'QEMU is a process inside the virt-launcher container: its namespaces and cgroup limit the VM too.'), who: bi('Запускать QEMU внутри контейнера придумали авторы KubeVirt.', 'KubeVirt.') } },
      { id: 'e-v3', from: 'v-launcher', to: 'v-node', label: '/dev/kvm', card: { what: bi('Контейнер получает от ядра узла устройство KVM.', 'The container gets the KVM device from the node kernel.'), who: bi('Устройство выдают kubelet и плагин устройств KubeVirt.', 'kubelet and the KubeVirt device plugin.') } },
      { id: 'e-v4', from: 'v-node', to: 'v-hw', label: 'VT-x', card: { what: bi('Ядро узла пользуется аппаратной виртуализацией процессора.', 'The node kernel uses the CPU’s hardware virtualisation.'), who: bi('Аппаратную виртуализацию даёт процессор сервера.', 'The CPU.') } },
    ],
  },
  params: [
    {
      id: 'workload',
      label: bi('Что нужно запустить', 'What has to run'),
      kind: 'choice',
      default: 'service',
      group: bi('Задача', 'The task'),
      options: [
        { id: 'service', label: bi('десяток собственных веб-сервисов', 'a dozen of our own web services') },
        { id: 'untrusted', label: bi('код чужих клиентов', 'code of outside customers') },
        { id: 'windows', label: bi('программу для Windows рядом с контейнерами', 'a Windows program') },
      ],
      predict: {
        prompt: bi('Вы меняете задачу. Если выбрать программу для Windows, которая должна работать рядом с контейнерами компании, в какую башню она попадёт?', 'You change the task. If you pick a Windows program that must run next to the company’s containers, which tower will it go to?'),
        options: [
          { id: 'kubevirt', text: bi('В виртуальную машину внутри Kubernetes', 'VMs inside Kubernetes') },
          { id: 'metal', text: bi('В контейнеры на своём железе', 'Containers on bare metal') },
        ],
        resolve: () => 'kubevirt',
      },
    },
  ],
  breaks: [
    {
      id: 'vm-kernel',
      label: bi('Ядро в ВМ одного клиента облака завершилось аварийно', 'The customer VM’s kernel crashed'),
      remove: ['c-vm', 'e-c1'],
      boundary: 'kernel',
      predict: {
        prompt: bi('Ядро в виртуальной машине одного клиента облака завершилось аварийно, а гипервизор работает. Чьи контейнеры остановятся?', 'The kernel of one customer VM crashed while the hypervisor keeps running. Whose containers stop?'),
        options: [
          { id: 'one', text: bi('Только контейнеры этого клиента', 'Only this customer’s') },
          { id: 'all', text: bi('Контейнеры всех клиентов облака', 'Every customer’s in the cloud') },
        ],
        resolve: () => 'one',
      },
    },
  ],
  metrics: [
    { id: 'kernels', label: bi('сколько ядер работает в выбранной башне', 'how many kernels run in the chosen tower') },
    { id: 'hops', label: bi('сколько слоёв лежит между приложением и железом', 'how many layers lie between the application and the hardware') },
  ],
  run(p, broken): Step[] {
    const place = PLACE[p.workload] ?? PLACE.service;
    const metrics = { kernels: { cloud: 2, metal: 1, kubevirt: 2 }[place.tower], hops: { cloud: 4, metal: 3, kubevirt: 5 }[place.tower] };
    const steps: Step[] = [
      {
        id: 'c-hyp',
        label: bi('облако', 'cloud'),
        caption: bi('Первая башня показывает облако. Провайдер ставит на свои серверы гипервизор и делит их между виртуальными машинами разных клиентов.', 'The first tower is the cloud. The provider installs a hypervisor on its servers and divides them between the VMs of different customers.'),
        focus: ['c-hyp'],
        say: { 'c-hyp': bi('Гипервизор облака делит серверы между виртуальными машинами разных клиентов.', 'The cloud hypervisor divides the servers between VMs of different customers.') },
        states: startWith(ALL, 'c-hyp', 'c-hw', 'e-c3'),
      },
      {
        id: 'c-vm',
        label: bi('ВМ клиента', 'customer VM'),
        caption: bi('Клиент получает виртуальную машину со своим ядром. Это ядро и гипервизор под ним отделяют клиента от соседей по тому же серверу.', 'The customer gets a VM with its own kernel. That kernel and the hypervisor under it separate the customer from the neighbours on the same server.'),
        focus: ['c-vm'],
        reveal: ['c-vm', 'e-c2'],
        say: { 'c-vm': bi('ВМ клиента загружает своё ядро, отдельное от ядер соседей.', 'The customer VM boots its own kernel, separate from the neighbours’.') },
      },
      {
        id: 'c-ct',
        label: bi('контейнеры', 'containers'),
        caption: bi('Внутри своей ВМ клиент запускает контейнеры, и они делят ядро этой ВМ. Так в облачной башне работают два ядра, ядро ВМ и ядро под гипервизором.', 'Inside the VM the customer runs containers, and they share the VM’s kernel. The cloud tower has two kernels: the VM’s and the one under the hypervisor.'),
        focus: ['c-ct', 'e-c1'],
        reveal: ['c-ct', 'e-c1'],
        tokens: [{ edge: 'e-c1', label: 'syscall' }],
        say: { 'c-ct': bi('Контейнеры клиента отправляют системные вызовы в ядро его ВМ.', 'The customer’s containers send system calls to the VM kernel.') },
        metrics: { kernels: 2, hops: 4 },
      },
      {
        id: 'm-node',
        label: bi('свой сервер', 'own server'),
        caption: bi('Вторая башня показывает компанию со своими серверами. Kubernetes ставят прямо на сервер без гипервизора, и на нём работает одно ядро вместе с агентом kubelet.', 'The second tower is a company with its own servers. Kubernetes goes straight onto the server without a hypervisor, and one kernel runs there together with the kubelet agent.'),
        focus: ['m-node'],
        reveal: ['m-hw', 'm-node', 'e-m2'],
        say: { 'm-node': bi('kubelet получает от кластера описания подов и запускает их на ядре сервера.', 'kubelet receives pods from the cluster and starts them on the server kernel.') },
      },
      {
        id: 'm-pods',
        label: bi('поды', 'pods'),
        caption: bi('Контейнеры подов остаются процессами этого же ядра. Гостевых систем нет, поэтому память не тратится впустую и контейнеров помещается больше всего.', 'Pod containers are processes of this very kernel. There are no guest systems, so no memory is wasted and the most containers fit.'),
        focus: ['m-pods', 'e-m1'],
        reveal: ['m-pods', 'e-m1'],
        tokens: [{ edge: 'e-m1', label: 'syscall' }],
        say: { 'm-pods': bi('Контейнеры подов обращаются прямо к ядру сервера.', 'Pod containers talk straight to the server kernel.') },
        metrics: { kernels: 1, hops: 3 },
      },
      {
        id: 'v-launcher',
        label: 'virt-launcher',
        caption: bi('Третья башня показывает виртуальную машину внутри Kubernetes. Kubernetes запускает на узле под virt-launcher, как любой другой под, а ядро узла отдаёт этому поду устройство `/dev/kvm`.', 'The third tower is a VM inside Kubernetes. Kubernetes starts a virt-launcher pod on the node like any other pod, and the node kernel gives this pod the `/dev/kvm` device.'),
        focus: ['v-launcher', 'e-v3'],
        reveal: ['v-hw', 'v-node', 'e-v4', 'v-launcher', 'e-v3'],
        tokens: [{ edge: 'e-v3', label: '/dev/kvm' }],
        say: { 'v-launcher': bi('Под virt-launcher получает от ядра узла устройство /dev/kvm.', 'The virt-launcher pod gets /dev/kvm from the node kernel.') },
      },
      {
        id: 'v-qemu',
        label: 'QEMU',
        caption: bi('Внутри контейнера этого пода работает QEMU, то есть гипервизор в виде обычного процесса. Лимиты и пространства имён контейнера ограничивают и его.', 'Inside the pod’s container runs QEMU, a hypervisor in the form of an ordinary process. The container’s limits and namespaces restrict it too.'),
        focus: ['v-qemu', 'e-v2'],
        reveal: ['v-qemu', 'e-v2'],
        say: { 'v-qemu': bi('QEMU работает процессом в контейнере и через /dev/kvm запускает виртуальную машину.', 'QEMU runs as a process in the container and starts a VM through /dev/kvm.') },
      },
      {
        id: 'v-guest',
        label: bi('гость', 'guest'),
        caption: bi('В виртуальной машине загружается своё ядро, и в ней может работать любая система, даже Windows. В этой башне тоже работают два ядра, ядро узла и ядро гостя. Так платформа Cozystack выдаёт виртуальные машины своим пользователям.', 'The VM boots its own kernel and can run any system, even Windows. This tower too has two kernels: the node’s and the guest’s. This is how Cozystack gives VMs to its users.'),
        focus: ['v-guest', 'e-v1'],
        reveal: ['v-guest', 'e-v1'],
        say: { 'v-guest': bi('В ВМ загружается своё ядро, и в нём может работать даже Windows.', 'The VM boots its own kernel, which can even be Windows.') },
        metrics: { kernels: 2, hops: 5 },
      },
      {
        id: 'choice',
        label: bi('куда', 'where'),
        caption: { ru: `${place.why.ru} Контейнер и виртуальная машина не соперничают друг с другом, а служат слоями, которые вкладывают друг в друга, когда задаче нужна более сильная изоляция.`, en: `${place.why.en} The conclusion: containers and VMs are not rivals but layers nested in each other as isolation requires.` },
        focus: [place.node],
        say: { [place.node]: place.say },
        states: { [place.node]: 'ok' },
        metrics,
      },
    ];
    if (broken.has('vm-kernel')) {
      steps.push({
        id: 'crash',
        label: bi('сбой', 'crash'),
        caption: bi('Ядро в ВМ одного клиента завершилось аварийно, и его контейнеры остановились. У соседних клиентов свои ядра в своих ВМ, и сбой не вышел за пределы гипервизора, поэтому соседи продолжают работать.', 'One VM’s kernel crashed: its containers stopped; the neighbours have their own kernels and keep running.'),
        focus: ['c-vm'],
        say: { 'c-vm': bi('Ядро этой ВМ остановилось, и вместе с ним остановились контейнеры клиента.', 'This VM’s kernel stopped, and the customer’s containers with it.') },
        states: { 'c-vm': 'err', 'c-ct': 'err' },
        metrics,
        broken: { at: 'c-vm', message: 'Kernel panic - not syncing: VFS: Unable to mount root fs', caption: bi('Сбой случился в ВМ одного клиента. Гипервизор удержал его внутри этой машины, и соседи ничего не заметили.', 'The failure happened in one customer’s VM. The hypervisor kept it inside that machine, and the neighbours noticed nothing.') },
      });
    }
    return steps;
  },
  explainDelta(_prev, _next, change, _a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Сбой ядра в ВМ задевает только контейнеры этой ВМ, потому что между клиентами стоит гипервизор.', 'A VM kernel failure only hits its own containers: the boundary is the hypervisor.')
        : bi('Ядро ВМ снова работает, и контейнеры клиента запущены.', 'The VM runs again.');
    return (PLACE[b.workload] ?? PLACE.service).why;
  },
});
