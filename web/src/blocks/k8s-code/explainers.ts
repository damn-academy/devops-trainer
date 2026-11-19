// Process explainers of block 9 (06 §6.3): E-K8S-CODE "from terraform apply
// to three Ready nodes" and E-GITOPS "a commit, the controller, the cluster".
// Both are small deterministic models: knobs recompute the run, breaks stop it
// where the real tool would stop, and the tool's real message is shown.
//
// Reading order: the picture is built from zero. In the first run of the code
// only the repository and Terraform are on the diagram; the cloud, the
// machines, the inventory, Ansible, the control plane and the pod network
// appear when the chain reaches them. In the GitOps loop only the author of
// the change and the place they change are visible at first; the controller,
// the Application and the live objects appear when the loop reaches them. The
// participant at work says in a callout what it does, and what it hands on
// travels along the line as a card. The knobs are grouped by the part of the
// system they change.

import { defineModel } from '../../core/define';
import { bi, pluralRu, type Bi } from '../../core/i18n';
import type { ColorFamily, DiagramEdge, DiagramNode, DocRef, ElementState, NodeIcon, QText, Step } from '../../core/types';

function node(id: string, label: QText, icon: NodeIcon, family: ColorFamily, shape: DiagramNode['shape'], x: number, y: number, w: number, h: number, what: Bi, who: Bi, see?: string, doc?: DocRef, sub?: string): DiagramNode {
  return { id, label, icon, family, shape, x, y, w, h, card: { what, who, ...(see ? { see } : {}), ...(doc ? { doc } : {}) }, ...(sub ? { sub } : {}) };
}

function edge(id: string, from: string, to: string, label: QText, what: Bi, who: Bi, o: { via?: [number, number][]; dashed?: boolean; labelAt?: number; see?: string; doc?: DocRef } = {}): DiagramEdge {
  return { id, from, to, label, card: { what, who, ...(o.see ? { see: o.see } : {}), ...(o.doc ? { doc: o.doc } : {}) }, ...(o.via ? { via: o.via } : {}), ...(o.dashed ? { dashed: true } : {}), ...(o.labelAt !== undefined ? { labelAt: o.labelAt } : {}) };
}

/** Fills {k} with a string, a number or a Bi. */
function fb(b: Bi, vars: Record<string, string | number | Bi>): Bi {
  const fill = (s: string, l: 'ru' | 'en') => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? (typeof vars[k] === 'object' ? (vars[k] as Bi)[l] : String(vars[k])) : m));
  return { ru: fill(b.ru, 'ru'), en: fill(b.en, 'en') };
}

const last = (s: Step[]) => s[s.length - 1];
const metric = (s: Step[], k: string) => last(s)?.metrics?.[k] ?? 0;
const brokenAt = (s: Step[]) => s.find((x) => x.broken)?.broken?.at;
const hiddenAll = (ids: string[]): Record<string, ElementState> => Object.fromEntries(ids.map((id) => [id, 'hidden' as ElementState]));

const DOC = {
  count: { url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/count', label: 'Terraform › count' } as DocRef,
  outputs: { url: 'https://developer.hashicorp.com/terraform/language/values/outputs', label: 'Terraform › Output values' } as DocRef,
  inventory: { page: 'ansible-doc/ansible.builtin.command', anchor: 'OPTIONS', line: 'creates' } as DocRef,
  init: { page: 'help/kubeadm-init', anchor: 'DESCRIPTION' } as DocRef,
  join: { page: 'help/kubeadm-join', anchor: 'DESCRIPTION', line: 'discovery-token-ca-cert-hash' } as DocRef,
  token: { page: 'help/kubeadm-token', anchor: 'DESCRIPTION' } as DocRef,
  prereq: { url: 'https://kubernetes.io/docs/setup/production-environment/container-runtimes/', label: 'kubernetes.io › Container Runtimes' } as DocRef,
  cilium: { url: 'https://docs.cilium.io/en/stable/gettingstarted/k8s-install-default/', label: 'Cilium › Quick installation' } as DocRef,
  upgrade: { url: 'https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/', label: 'kubernetes.io › Upgrading kubeadm clusters' } as DocRef,
  serial: { url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_strategies.html#setting-the-batch-size-with-serial', label: 'Ansible › serial' } as DocRef,
  argo: { page: 'web/argo-cd.readthedocs.io/auto-sync', anchor: 'automated' } as DocRef,
  argoApp: { page: 'web/argo-cd.readthedocs.io/declarative-setup', anchor: 'applications' } as DocRef,
  argoPrune: { page: 'web/argo-cd.readthedocs.io/auto-sync', anchor: 'prune' } as DocRef,
  argoHeal: { page: 'web/argo-cd.readthedocs.io/auto-sync', anchor: 'self-heal' } as DocRef,
};

const PREFLIGHT_AGAIN =
  'error execution phase preflight: [preflight] Some fatal errors occurred:\n\t[ERROR Port-6443]: Port 6443 is in use\n\t[ERROR FileAvailable--etc-kubernetes-manifests-kube-apiserver.yaml]: /etc/kubernetes/manifests/kube-apiserver.yaml already exists';
const NO_CREATES_WHY = bi(
  'Модуль command не знает, что цель команды уже достигнута, и запускает её снова. Параметр creates сообщает ему, по какому файлу это видно, и тогда повторный прогон пропускает задачу.',
  'The command module does not know the command’s goal is already reached and runs it again. The creates parameter tells it which file shows this, and then a repeated run skips the task.',
);

// ── E-K8S-CODE ──

type CodeP = { workers: number; forks: number; run: string; serial: string };

/** The arithmetic the steps show: VMs, minutes to Ready, VM-hours. */
export function codeNumbers(p: CodeP): { vms: number; prepMin: number; totalMin: number; vmHoursDay: number; vmHoursMonth: number } {
  const vms = 1 + p.workers;
  const prepMin = Math.ceil(vms / p.forks) * 3;
  const totalMin = 2 + prepMin + 2 + 1 + 1;
  return { vms, prepMin, totalMin, vmHoursDay: vms * 24, vmHoursMonth: vms * 730 };
}

const CODE_ALL = ['code', 'tf', 'cloud', 'inv', 'ans', 'cp', 'w1', 'w2', 'plane', 'cni', 'e-read', 'e-api', 'e-out', 'e-inv', 'e-ssh-cp', 'e-ssh-w1', 'e-ssh-w2', 'e-init', 'e-join1', 'e-join2', 'e-cni'];
const G_RUN = bi('Какой прогон кода', 'Which run of the code');
const G_SIZE = bi('Сколько машин и как быстро их готовят', 'How many machines and how fast they are prepared');
const G_UPGRADE = bi('Как обновляются рабочие узлы', 'How the workers are upgraded');
const nodesRu = (n: number) => pluralRu(n, ['узел', 'узла', 'узлов']);
const workersRu = (n: number) => pluralRu(n, ['рабочий узел', 'рабочих узла', 'рабочих узлов']);
const minReplicas = (s: Step[]) => Math.min(...s.map((x) => x.metrics?.replicas ?? 99));

export const codeModel = defineModel<CodeP>({
  id: 'k8s-3.from-code',
  block: 'k8s-3',
  title: bi('Как кластер собирается из кода', 'How a cluster is built from code'),
  summary: bi(
    'Что происходит, когда вы прогоняете код кластера в пустом облаке: Terraform заказывает машины и записывает их адреса в инвентарь, Ansible одинаково готовит каждую машину, роль kubeadm запускает control plane на первом узле, роль cilium ставит сеть подов, а рабочие узлы присоединяются к кластеру. Под схемой считаются машины, минуты до готового кластера, задачи, которые что-то изменили, и ВМ-часы, которые наберёт забытый стенд.',
    'What happens when you run the cluster code in an empty cloud: Terraform orders the machines and writes their addresses into the inventory, Ansible prepares every machine the same way, the kubeadm role starts the control plane on the first node, the cilium role installs the pod network, and the workers join the cluster. Under the diagram you see the machines, the minutes to a ready cluster, the tasks that changed something and the VM-hours a forgotten lab runs up.',
  ),
  intro: bi(
    'Схема соберётся у вас на глазах: сейчас на ней только репозиторий с кодом и Terraform. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Новый участник появляется, когда до него доходит цепочка. Облачко у подсвеченного участника говорит, что он делает, а карточка на линии показывает, что он передаёт следующему.\n\nКогда дойдёте до трёх узлов Ready, выберите в «Параметрах» другой прогон кода, а потом включите одну из поломок в блоке «Сломать».',
    'The diagram builds itself as you go: now it shows only the code repository and Terraform. Press “Start from the first step”, then go on with “Step forward” above the diagram. A participant appears when the chain reaches it. The callout at the highlighted participant says what it does, and the card on the line shows what it hands on.\n\nOnce you reach three Ready nodes, choose another run of the code in “Parameters”, then switch on one of the breaks in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: bi('облачко с тем, что делает подсвеченный участник', 'the callout with what the highlighted participant does') },
    { mark: 'token', text: bi('карточка с тем, что участник передаёт следующему: код, машины, адреса, роли, токен', 'what it hands on: code, machines, addresses, roles, a token') },
    { mark: 'icon:file', text: bi('файл с кодом в репозитории или файл инвентаря', 'a code file in the repository or the inventory file') },
    { mark: 'icon:terminal', text: bi('команда, которую запускаете вы или конвейер', 'a command you or the pipeline run') },
    { mark: 'icon:cloud', text: bi('API облака, которое создаёт машины', 'the cloud API that creates the machines') },
    { mark: 'icon:server', text: bi('виртуальная машина, будущий узел кластера', 'a virtual machine, a future cluster node') },
    { mark: 'icon:container', text: bi('компоненты control plane в статических подах', 'the control-plane components in static pods') },
    { mark: 'icon:switch', text: bi('сеть подов Cilium', 'the Cilium pod network') },
    { mark: 'ok', text: bi('этап пройден', 'stage passed') },
    { mark: 'warn', text: bi('узел выведен из работы или ждёт сети', 'a node is out of service or waits for the network') },
    { mark: 'err', text: bi('здесь цепочка остановилась', 'the chain stopped here') },
    { mark: 'pale', text: bi('машины удалены или ещё не созданы', 'the machines are deleted or not created yet') },
  ],
  stopLabel: bi('Цепочка остановилась', 'The chain stopped'),
  concepts: ['k8s.rebuildable', 'iac.count', 'iac.output', 'k8s.bootstrap-token', 'iac.creates'],
  diagram: {
    width: 960,
    height: 640,
    nodes: [
      node('code', bi('Репозиторий с кодом', 'Code repository'), 'file', 'ci-source', 'doc', 24, 24, 184, 72, bi('Всё, из чего собирается кластер: файлы Terraform в каталоге infra, плейбук site.yml и роли Ansible в каталоге ops. Пересоздать кластер означает прогнать этот код ещё раз.', 'Everything the cluster is built from: the Terraform files in infra, the site.yml playbook and the Ansible roles in ops. Rebuilding the cluster means running this code once more.'), bi('Код пишете вы, и каждое изменение проходит ревью.', 'You write the code, and every change goes through review.'), 'git log --oneline', undefined, 'infra/ · ops/'),
      node('tf', 'terraform apply', 'terminal', 'process', 'box', 272, 24, 192, 72, bi('Terraform сравнивает код с тем, что записано в state и что есть в облаке, и создаёт недостающее: сеть и машины. Аргумент count = 2 превращает один блок кода в две машины, worker[0] и worker[1].', 'Terraform compares the code with what the state records and what the cloud has, and creates what is missing: the network and the machines. count = 2 turns one block of code into two machines, worker[0] and worker[1].'), bi('Команду запускаете вы или конвейер.', 'You or the pipeline run the command.'), 'terraform plan', DOC.count),
      node('cloud', bi('API облака', 'Cloud API'), 'cloud', 'neutral', 'box', 528, 24, 176, 72, bi('Облако создаёт машины, выдаёт им адреса и ставит на них метку trainer=devops. По этой метке машины потом находят, считают и удаляют.', 'The cloud creates the machines, gives them addresses and puts the trainer=devops label on them. By this label the machines are later found, counted and deleted.'), bi('Облако обслуживает провайдер.', 'The provider runs the cloud.'), 'edu vm list'),
      node('inv', 'inventory.ini', 'file', 'store', 'doc', 760, 24, 176, 72, bi('Инвентарь Ansible, который выдал Terraform: группы control_plane и workers, адреса машин и переменная cp_endpoint с адресом control plane. Вручную его не пишут, потому что после пересоздания у машин другие адреса.', 'The Ansible inventory Terraform produced: the control_plane and workers groups, the machine addresses and the cp_endpoint variable with the control-plane address. Nobody writes it by hand, because after a rebuild the machines have other addresses.'), bi('Файл записывает команда terraform output -raw inventory.', 'The terraform output -raw inventory command writes the file.'), 'terraform output -raw inventory', DOC.outputs),
      node('ans', 'ansible-playbook site.yml', 'terminal', 'process', 'box', 332, 176, 296, 64, bi('Ansible приводит узлы к описанию в ролях. Роли k8s_prereq, containerd и kube_packages выполняются на всех узлах, роли kubeadm_init и cilium выполняются на control plane, а роль kubeadm_join выполняется на рабочих узлах.', 'Ansible brings the nodes to the description in the roles. k8s_prereq, containerd and kube_packages run on every node, kubeadm_init and cilium on the control plane, kubeadm_join on the workers.'), bi('Плейбук запускаете вы или конвейер.', 'You or the pipeline run the playbook.'), 'ansible-playbook --check site.yml'),
      node('cp', 'cp-1', 'server', 'node', 'rack', 40, 312, 240, 88, bi('Управляющий узел кластера. После kubeadm init на нём лежат сертификаты в /etc/kubernetes/pki, файл admin.conf и манифесты статических подов.', 'The control-plane node. After kubeadm init it holds the certificates in /etc/kubernetes/pki, the admin.conf file and the static pod manifests.'), bi('Машину создал Terraform, а подготовил Ansible.', 'Terraform created the machine, and Ansible prepared it.'), 'ls /etc/kubernetes', DOC.init, 'control plane'),
      node('w1', 'worker-1', 'server', 'node', 'rack', 360, 312, 240, 88, bi('Рабочий узел. Команда kubeadm join кладёт сюда файл kubelet.conf, и по этому файлу роль при следующем прогоне понимает, что узел уже в кластере.', 'A worker node. kubeadm join puts kubelet.conf here, and by this file the role sees on the next run that the node is already in the cluster.'), bi('Машину создал Terraform, а подготовил Ansible.', 'Terraform created the machine, and Ansible prepared it.'), 'ls /etc/kubernetes', DOC.join, 'worker'),
      node('w2', 'worker-2', 'server', 'node', 'rack', 680, 312, 240, 88, bi('Второй рабочий узел. Все рабочие узлы описаны одним ресурсом с count и готовятся одной ролью, поэтому они одинаковы по построению.', 'The second worker. All workers are described by one resource with count and prepared by one role, so they are identical by construction.'), bi('Машину создал Terraform, а подготовил Ansible.', 'Terraform created the machine, and Ansible prepared it.'), 'ls /etc/kubernetes', DOC.join, 'worker'),
      node('plane', 'Control plane', 'container', 'cp', 'hex', 40, 472, 240, 64, bi('Компоненты etcd, kube-apiserver, kube-controller-manager и kube-scheduler. Их запустил kubelet на cp-1 из манифестов, которые kubeadm положил в /etc/kubernetes/manifests.', 'etcd, kube-apiserver, kube-controller-manager and kube-scheduler. The kubelet on cp-1 started them from the manifests kubeadm put into /etc/kubernetes/manifests.'), bi('Манифесты пишет kubeadm init.', 'kubeadm init writes the manifests.'), 'kubectl -n kube-system get pods', DOC.init, 'etcd · apiserver · …'),
      node('cni', bi('Сеть подов Cilium', 'Cilium pod network'), 'switch', 'l3', 'pill', 360, 568, 560, 56, bi('Cilium служит сетевым плагином кластера. Он состоит из агента на каждом узле и конфигурации в каталоге /etc/cni/net.d. Пока плагина нет, узлы остаются в состоянии NotReady, а CoreDNS ждёт в Pending.', 'The cluster network plugin: a Cilium agent on every node and its config in /etc/cni/net.d. Until the plugin is there, the nodes stay NotReady and CoreDNS waits in Pending.'), bi('Плагин ставит роль cilium командой cilium install.', 'The cilium role installs it with cilium install.'), 'cilium status', DOC.cilium),
    ],
    edges: [
      edge('e-read', 'code', 'tf', bi('чтение .tf', 'reading .tf'), bi('Terraform читает весь каталог infra: ресурсы, переменные и выходные значения.', 'Terraform reads the whole infra directory: resources, variables and outputs.'), bi('Файлы читает Terraform.', 'Terraform reads the files.')),
      edge('e-api', 'tf', 'cloud', bi('создание ВМ', 'creating VMs'), bi('Terraform вызывает API облака в порядке, записанном в плане, поэтому сначала создаёт сеть, а потом машины. Порядок он узнал по ссылкам между ресурсами в коде.', 'Terraform calls the cloud API by the plan: first the network, then the machines. It learned the order from the references between resources in the code.'), bi('Вызовы делает провайдер Terraform.', 'The Terraform provider makes the calls.')),
      edge('e-out', 'cloud', 'inv', bi('адреса машин', 'machine addresses'), bi('Адреса становятся известны только после того, как машины созданы. Выходное значение inventory собирает их в готовый инвентарь.', 'The addresses are known only once the machines exist. The inventory output gathers them into a ready inventory.'), bi('Значение выдаёт terraform output.', 'terraform output hands it out.'), { doc: DOC.outputs }),
      edge('e-inv', 'inv', 'ans', bi('список хостов', 'host list'), bi('Из инвентаря Ansible узнаёт, на какие машины заходить и какая из них станет control plane.', 'From the inventory Ansible learns which machines to go to and which of them becomes the control plane.'), bi('Путь к инвентарю записан в ansible.cfg.', 'ansible.cfg holds the inventory path.'), { via: [[848, 140], [480, 140]], labelAt: 0.3 }),
      edge('e-ssh-cp', 'ans', 'cp', bi('SSH на cp-1', 'SSH to cp-1'), bi('Ansible выполняет на cp-1 роли подготовки, затем kubeadm init с параметром creates и cilium install.', 'Ansible runs the preparation roles on cp-1, then kubeadm init with creates and cilium install.'), bi('Ansible заходит на узел по SSH.', 'Ansible connects over SSH.'), { via: [[160, 208]], labelAt: 0.3 }),
      edge('e-ssh-w1', 'ans', 'w1', bi('SSH на worker-1', 'SSH to worker-1'), bi('Ansible выполняет на worker-1 роли подготовки, затем kubeadm join с параметром creates.', 'Ansible runs the preparation roles on worker-1, then kubeadm join with creates.'), bi('Ansible заходит на узел по SSH.', 'Ansible connects over SSH.'), {}),
      edge('e-ssh-w2', 'ans', 'w2', bi('SSH на worker-2', 'SSH to worker-2'), bi('На worker-2 выполняются те же роли, что на worker-1. Ansible обслуживает узлы параллельно, сколько позволяет настройка forks.', 'worker-2 gets the same roles as worker-1. Ansible serves the nodes in parallel, as far as forks allows.'), bi('Ansible заходит на узел по SSH.', 'Ansible connects over SSH.'), { via: [[800, 208]], labelAt: 0.7 }),
      edge('e-init', 'cp', 'plane', 'kubeadm init', bi('kubeadm init пишет сертификаты, файлы kubeconfig и манифесты, и kubelet запускает по ним компоненты control plane.', 'kubeadm init writes certificates, kubeconfig files and manifests, and the kubelet starts the control-plane components from them.'), bi('Команду запускает роль kubeadm_init.', 'The kubeadm_init role runs the command.'), { doc: DOC.init }),
      edge('e-join1', 'w1', 'plane', bi('токен присоединения', 'bootstrap token'), bi('Узел предъявляет токен присоединения и получает свой сертификат kubelet. Этот обмен называется TLS bootstrap.', 'The node presents the bootstrap token and gets its own kubelet certificate. This exchange is called TLS bootstrap.'), bi('Команду запускает роль kubeadm_join.', 'The kubeadm_join role runs the command.'), { doc: DOC.token, via: [[480, 488]], labelAt: 0.3 }),
      edge('e-join2', 'w2', 'plane', bi('токен присоединения', 'bootstrap token'), bi('Второй рабочий узел присоединяется так же. Токен у узлов общий и действует 24 часа.', 'The second worker joins the same way. The token is shared and valid for 24 hours.'), bi('Команду запускает роль kubeadm_join.', 'The kubeadm_join role runs the command.'), { doc: DOC.token, via: [[800, 528]], labelAt: 0.12 }),
      edge('e-cni', 'plane', 'cni', 'cilium install', bi('Cilium ставится через API кластера: на каждом узле запускается под агента из одного DaemonSet.', 'Cilium is installed through the cluster API: one DaemonSet runs an agent pod on every node.'), bi('Команду запускает роль cilium.', 'The cilium role runs the command.'), { doc: DOC.cilium, via: [[160, 596]] }),
    ],
  },
  params: [
    {
      id: 'run',
      label: bi('Какой прогон кода показать', 'Which run of the code to show'),
      kind: 'choice',
      default: 'first',
      group: G_RUN,
      options: [
        { id: 'first', label: bi('первый прогон в пустом облаке', 'the first run in an empty cloud') },
        { id: 'second', label: bi('повторный прогон, когда кластер уже есть', 'a repeated run when the cluster exists') },
        { id: 'rebuild', label: bi('удаление машин и сборка кластера заново', 'deleting the machines and building the cluster again') },
        { id: 'upgrade', label: bi('обновление рабочих узлов', 'upgrading the workers') },
      ],
      near: 'code',
      predict: {
        prompt: bi('Вы выбрали другой прогон того же кода. Изменит ли этот прогон хоть что-нибудь на узлах?', 'You chose another run of the same code. Will this run change anything on the nodes?'),
        options: [
          { id: 'zero', text: bi('Нет, все задачи ответят ok, потому что кластер уже находится в описанном состоянии', 'No, every task answers ok, because the cluster is already in the described state') },
          { id: 'some', text: bi('Да, хотя бы одна задача что-то изменит на узлах или остановится с ошибкой', 'Yes, at least one task changes something on the nodes or stops with an error') },
        ],
        resolve: (_p, next) => (brokenAt(next) ? 'some' : metric(next, 'changed') === 0 ? 'zero' : 'some'),
      },
    },
    {
      id: 'workers',
      label: bi('Сколько рабочих узлов создать (count)', 'How many workers to create (count)'),
      kind: 'range',
      min: 1,
      max: 4,
      step: 1,
      default: 2,
      group: G_SIZE,
      near: 'tf',
      predict: {
        prompt: bi('Вы меняете число рабочих узлов. Изменится ли число ВМ-часов, которое наберёт стенд, если его забыть на месяц?', 'You change the number of workers. Will the VM-hours a lab forgotten for a month runs up change?'),
        options: [
          { id: 'same', text: bi('Нет, потому что рабочие узлы без нагрузки ничего не стоят', 'No, because idle workers cost nothing') },
          { id: 'more', text: bi('Да, потому что облако берёт плату за каждый час каждой машины, занята она или нет', 'Yes, because the cloud bills every hour of every machine, busy or not') },
        ],
        resolve: (prev, next) => (metric(next, 'month') !== metric(prev, 'month') ? 'more' : 'same'),
      },
    },
    {
      id: 'forks',
      label: bi('Сколько узлов Ansible готовит одновременно (forks)', 'How many nodes Ansible prepares at once (forks)'),
      kind: 'range',
      min: 1,
      max: 3,
      step: 1,
      default: 3,
      group: G_SIZE,
      levels: ['intermediate', 'experienced'],
      near: 'ans',
      predict: {
        prompt: bi('Вы меняете число узлов, которые Ansible готовит одновременно. Изменится ли время подготовки узлов?', 'You change how many nodes Ansible prepares at once. Will the node preparation time change?'),
        options: [
          { id: 'longer', text: bi('Да, потому что узлы разобьются на другое число партий, а каждая партия готовится три минуты', 'Yes, because the nodes split into a different number of batches, and each batch takes three minutes') },
          { id: 'same', text: bi('Нет, потому что на каждом узле выполняются те же задачи', 'No, because every node runs the same tasks') },
        ],
        resolve: (prev, next) => (metric(next, 'minutes') !== metric(prev, 'minutes') ? 'longer' : 'same'),
      },
    },
    {
      id: 'serial',
      label: bi('Сколько рабочих узлов обновлять одновременно (serial)', 'How many workers to upgrade at once (serial)'),
      kind: 'choice',
      default: '1',
      group: G_UPGRADE,
      options: [
        { id: '1', label: bi('по одному узлу (serial: 1)', 'one node at a time (serial: 1)') },
        { id: 'all', label: bi('все узлы сразу', 'all nodes at once') },
      ],
      near: 'ans',
      predict: {
        prompt: bi('Вы меняете, сколько рабочих узлов обновляются одновременно. Сколько реплик приложения останется готовыми в худший момент выбранного прогона?', 'You change how many workers are upgraded at once. How many application replicas stay ready at the worst moment of the chosen run?'),
        options: [
          { id: 'zero', text: bi('Ни одной, потому что все рабочие узлы окажутся выведены из работы одновременно и подам некуда переехать', 'None, because all workers are out of service at once and the pods have nowhere to go') },
          { id: 'some', text: bi('Хотя бы одна, потому что поды переедут на узлы, которые сейчас не обновляются', 'At least one, because the pods move to the nodes not being upgraded right now') },
        ],
        resolve: (_p, next) => (minReplicas(next) === 0 ? 'zero' : 'some'),
      },
    },
  ],
  breaks: [
    {
      id: 'swap',
      label: bi('Роль k8s_prereq не убрала строку swap из /etc/fstab', 'The k8s_prereq role did not remove the swap line from /etc/fstab'),
      remove: ['e-init'],
      boundary: 'kernel',
      predict: {
        prompt: bi('На cp-1 остался включённым swap, а всё остальное подготовлено правильно. Где остановится цепочка?', 'Swap stayed on on cp-1, and everything else is prepared correctly. Where does the chain stop?'),
        options: [
          { id: 'init', text: bi('На kubeadm init, потому что его проверки перед запуском не пропустят узел со swap', 'At kubeadm init, because its pre-flight checks do not pass a node with swap') },
          { id: 'later', text: bi('Позже, когда поды начнут падать от нехватки памяти', 'Later, when pods start crashing for lack of memory') },
          { id: 'none', text: bi('Нигде, потому что swap только добавляет машине памяти', 'Nowhere, because swap only adds memory to the machine') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'cp' ? 'init' : 'none'),
      },
    },
    {
      id: 'nocreates',
      label: bi('У задачи kubeadm init нет параметра creates', 'The kubeadm init task has no creates parameter'),
      remove: [],
      boundary: 'process',
      predict: {
        prompt: bi('У задачи kubeadm init убрали параметр creates. Что случится, если прогнать код сейчас, а потом ещё раз?', 'The creates parameter was removed from the kubeadm init task. What happens if you run the code now and then once more?'),
        options: [
          { id: 'second', text: bi('Этот прогон пройдёт, а повторный остановится с ошибкой на проверках kubeadm, потому что control plane на узле уже есть', 'This run passes, and the repeated one fails at the kubeadm checks, because the control plane is already on the node') },
          { id: 'first', text: bi('Упадёт уже этот прогон, потому что control plane на узле уже есть', 'This very run fails, because the control plane is already on the node') },
          { id: 'never', text: bi('Ничего не изменится, потому что kubeadm сам понимает, что кластер уже создан', 'Nothing changes, because kubeadm itself sees the cluster already exists') },
        ],
        resolve: (_p, next) => (brokenAt(next) ? (next.some((s) => s.id === 'ready') || next.some((s) => s.id === 'skip') ? 'second' : 'first') : 'never'),
      },
    },
    {
      id: 'nocni',
      label: bi('Роль cilium выключена, и сеть подов не ставится', 'The cilium role is off, and no pod network is installed'),
      remove: ['cni', 'e-cni'],
      boundary: 'network',
      predict: {
        prompt: bi('Роль cilium не выполнилась, а все остальные роли отработали. В каком состоянии окажутся узлы?', 'The cilium role did not run, and every other role did. What state are the nodes in?'),
        options: [
          { id: 'notready', text: bi('Узлы будут в кластере, но в состоянии NotReady, а CoreDNS останется в Pending', 'The nodes are in the cluster but NotReady, and CoreDNS stays Pending') },
          { id: 'ready', text: bi('Узлы будут Ready, потому что сеть подов нужна только приложениям', 'The nodes are Ready, because the pod network is only for applications') },
        ],
        resolve: () => 'notready',
      },
    },
    {
      id: 'stale-inventory',
      label: bi('В инвентаре неверный cp_endpoint, потому что его вписали вручную или он остался от старых машин', 'The inventory has a wrong cp_endpoint, because it was typed by hand or left from the old machines'),
      remove: ['e-out'],
      boundary: 'network',
      predict: {
        prompt: bi('В inventory.ini записан неверный адрес control plane (cp_endpoint), а остальной код в порядке. Где остановится выбранный прогон?', 'inventory.ini holds a wrong control-plane address (cp_endpoint), and the rest of the code is fine. Where does the chosen run stop?'),
        options: [
          { id: 'join', text: bi('На присоединении рабочих узлов, потому что они пойдут по адресу, где control plane нет', 'At joining the workers, because they go to an address where there is no control plane') },
          { id: 'tf', text: bi('На terraform apply, потому что Terraform проверяет инвентарь', 'At terraform apply, because Terraform checks the inventory') },
          { id: 'none', text: bi('В этом прогоне нигде, потому что рабочие узлы уже в кластере и join не запускается', 'Nowhere in this run, because the workers are already in the cluster and join does not run') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'e-join1' ? 'join' : 'none'),
      },
    },
  ],
  metrics: [
    { id: 'vms', label: bi('машин в облаке', 'machines in the cloud') },
    { id: 'minutes', label: bi('минут до готового кластера', 'minutes to a ready cluster') },
    { id: 'changed', label: bi('задач, которые что-то изменили (changed)', 'tasks that changed something (changed)') },
    { id: 'ready', label: bi('узлов в состоянии Ready', 'nodes in the Ready state') },
    { id: 'month', label: bi('ВМ-часов, если забыть стенд на месяц', 'VM-hours if the lab is forgotten for a month') },
    { id: 'replicas', label: bi('готовых реплик приложения', 'ready application replicas') },
  ],
  run(p, broken): Step[] {
    const n = codeNumbers(p);
    const steps: Step[] = [];
    const W = p.workers;
    const two = W >= 2;
    const base = { vms: n.vms, month: n.vmHoursMonth, replicas: 3 };
    /** worker-2 and its lines stay off the picture when there is one worker. */
    const noW2: Record<string, ElementState> = two ? {} : hiddenAll(['w2', 'e-ssh-w2', 'e-join2']);
    const w2 = (s: ElementState): Record<string, ElementState> => (two ? { w2: s } : {});
    const w2v = W > 2 ? { w2: `${W - 1} × VM` } : {};
    const sshTokens = (label: Bi) => [{ edge: 'e-ssh-cp', label }, { edge: 'e-ssh-w1', label }, ...(two ? [{ edge: 'e-ssh-w2', label }] : [])];

    // ── upgrading the workers ──
    if (p.run === 'upgrade') {
      steps.push({
        id: 'plan',
        label: bi('план', 'plan'),
        caption: bi('Control plane уже обновлён до v1.37 командой kubeadm upgrade apply на cp-1, а рабочие узлы ещё на v1.36. Теперь плейбук обновит каждый рабочий узел: выведет его из работы (drain), поставит пакеты новой версии, выполнит kubeadm upgrade node, перезапустит kubelet и вернёт узел в работу (uncordon).', 'The control plane is already on v1.37 after kubeadm upgrade apply on cp-1, while the workers are still on v1.36. Now the playbook upgrades every worker: drains it, installs the new packages, runs kubeadm upgrade node, restarts the kubelet and puts the node back (uncordon).'),
        focus: ['ans'],
        say: { ans: bi('Ansible начинает плей обновления рабочих узлов. Control plane уже работает на версии v1.37, поэтому рабочие узлы можно обновлять.', 'Ansible starts the play that upgrades the workers. The control plane already runs v1.37, so the workers may be upgraded.') },
        states: { ...hiddenAll(['code', 'tf', 'cloud', 'inv', 'e-read', 'e-api', 'e-out', 'e-inv', 'e-join1', 'e-join2', 'e-init']), ...noW2, cp: 'ok', plane: 'ok' },
        values: { cp: 'v1.37.1', w1: 'v1.36.4', ...(two ? { w2: 'v1.36.4' } : {}), ...w2v },
        metrics: { ...base, ready: n.vms, changed: 0, minutes: 0 },
      });
      if (p.serial === 'all') {
        steps.push({
          id: 'drain-all',
          label: bi('drain всех', 'drain all'),
          caption: fb(bi('Настройка serial разрешает обновлять все узлы сразу, поэтому Ansible выводит из работы все {w} одновременно. Команда drain выселяет поды приложения со всех рабочих узлов, и переехать им некуда, потому что на cp-1 поды приложения не запускаются.', 'serial lets all nodes be upgraded at once, so Ansible drains all {w} at the same time. drain evicts the application pods from every worker, and they have nowhere to go, because cp-1 runs no application pods.'), { w: fb(bi('{n} {r}', '{n} workers'), { n: W, r: workersRu(W) }) }),
          focus: ['ans', 'e-ssh-w1', 'e-ssh-w2'],
          tokens: sshTokens(bi('drain', 'drain')).slice(1),
          say: { ans: bi('Ansible выполняет kubectl drain на всех рабочих узлах сразу, и приложение остаётся без единого готового пода.', 'Ansible runs kubectl drain on every worker at once, and the application is left without a single ready pod.') },
          states: { w1: 'warn', ...w2('warn') },
          values: { w1: 'SchedulingDisabled', ...(two ? { w2: 'SchedulingDisabled' } : {}) },
          metrics: { ...base, replicas: 0, ready: 1, changed: W, minutes: 4 },
        });
        steps.push({
          id: 'up-all',
          label: 'uncordon',
          caption: bi('Узлы обновились до v1.37 и вернулись в работу, поды приложения снова запущены. Но несколько минут приложение не отвечало ни одному пользователю.', 'The nodes are on v1.37 and back in service, and the application pods run again. But for a few minutes the application answered no user.'),
          focus: ['w1', 'w2'],
          say: { w1: bi('Узел worker-1 работает на версии v1.37 и снова принимает поды, как и остальные рабочие узлы.', 'worker-1 runs v1.37 and takes pods again, like the other workers.') },
          states: { w1: 'ok', ...w2('ok') },
          values: { w1: 'v1.37.1', ...(two ? { w2: 'v1.37.1' } : {}), ...(W > 2 ? { w2: `${W - 1} × v1.37.1` } : {}) },
          metrics: { ...base, replicas: 3, ready: n.vms, changed: W * 4, minutes: 8 },
        });
        return steps;
      }
      for (let k = 1; k <= W; k++) {
        const id = k === 1 ? 'w1' : 'w2';
        const e = k === 1 ? 'e-ssh-w1' : 'e-ssh-w2';
        steps.push({
          id: `drain-${k}`,
          label: `drain ${k}`,
          caption:
            W === 1
              ? bi('Настройка serial: 1 означает, что плей проходит рабочие узлы по одному. Но рабочий узел здесь один, и когда drain выселяет с него поды, переехать им некуда, поэтому на время обновления у приложения не остаётся ни одного готового пода.', 'serial: 1 means the play goes over the workers one by one. But there is only one worker, and when drain evicts its pods they have nowhere to go, so for the upgrade the application is left without a single ready pod.')
              : fb(bi('Настройка serial: 1 означает, что плей проходит рабочие узлы по одному. Сейчас обновляется только worker-{k}: drain выселяет с него поды, и они переезжают на соседние узлы.', 'serial: 1 means the play goes over the workers one by one. Only worker-{k} is upgraded now: drain evicts its pods, and they move to the neighbours.'), { k }),
          focus: [e, id],
          tokens: [{ edge: e, label: 'drain' }],
          say: { [id]: fb(bi('Узел worker-{k} выведен из работы: новые поды на него не назначаются, а старые переезжают на другие узлы.', 'worker-{k} is out of service: no new pods are scheduled to it, and the old ones move to other nodes.'), { k: k === 2 && W > 2 ? `2…${W}` : k }) },
          states: { [id]: 'warn' },
          values: { [id]: 'SchedulingDisabled' },
          metrics: { ...base, replicas: W === 1 ? 0 : 2, ready: n.vms - 1, changed: (k - 1) * 4, minutes: (k - 1) * 4 + 1 },
        });
        steps.push({
          id: `up-${k}`,
          label: `uncordon ${k}`,
          caption: fb(bi('Узел worker-{k} обновился до v1.37 и снова принимает поды, поэтому плей переходит к следующему узлу. Приложение всё это время отвечало пользователям.', 'worker-{k} is on v1.37 and takes pods again, so the play moves to the next node. The application answered users all along.'), { k }),
          focus: [id],
          say: { [id]: fb(bi('Узел worker-{k} работает на версии v1.37, и команда uncordon вернула его в работу.', 'worker-{k} runs v1.37, and uncordon put it back into service.'), { k }) },
          states: { [id]: 'ok' },
          values: { [id]: 'v1.37.1' },
          metrics: { ...base, replicas: 3, ready: n.vms, changed: k * 4, minutes: k * 4 },
        });
      }
      return steps;
    }

    const second = p.run === 'second';
    const rebuild = p.run === 'rebuild';
    const first = !second && !rebuild;
    const ip = rebuild ? { cp: '10.0.0.16', w1: '10.0.0.17', w2: '10.0.0.18' } : { cp: '10.0.0.12', w1: '10.0.0.13', w2: '10.0.0.14' };

    // ── deleting the machines before a rebuild ──
    if (rebuild)
      steps.push({
        id: 'destroy',
        label: 'destroy',
        caption: fb(bi('Команда terraform destroy удаляет {v} ВМ и сеть, и state становится пустым. Кластера больше нет, но код, из которого он был собран, остался в репозитории.', 'terraform destroy deletes {v} VMs and the network, and the state becomes empty. The cluster is gone, but the code it was built from stays in the repository.'), { v: n.vms }),
        focus: ['tf', 'e-api', 'cloud'],
        tokens: [{ edge: 'e-api', label: `−${n.vms} VM` }],
        say: { cloud: fb(bi('Облако удаляет {v} ВМ вместе с дисками и сеть, которую создал Terraform.', 'The cloud deletes {v} VMs with their disks and the network Terraform created.'), { v: n.vms }) },
        states: { ...noW2, cp: 'off', w1: 'off', ...w2('off'), plane: 'off', cni: 'off', inv: 'off' },
        values: { cp: '—', w1: '—', ...(two ? { w2: '—' } : {}) },
        metrics: { ...base, vms: 0, ready: 0, changed: 0, minutes: 0 },
      });

    // ── Terraform ──
    if (first || rebuild)
      steps.push({
        id: 'read',
        label: bi('код', 'code'),
        caption: bi('Terraform читает файлы .tf из каталога infra и сравнивает описанное в них с тем, что записано в state и что есть в облаке. В облаке машин нет, поэтому план предлагает создать сеть и все машины.', 'Terraform reads the .tf files in infra and compares what they describe with what the state records and what the cloud has. The cloud has no machines, so the plan proposes to create the network and every machine.'),
        focus: ['code', 'e-read', 'tf'],
        reveal: ['e-read'],
        tokens: [{ edge: 'e-read', label: 'infra/*.tf' }],
        say: { tf: bi('Terraform сравнивает код с облаком и видит, что сеть и машины ещё не созданы.', 'Terraform compares the code with the cloud and sees that the network and the machines do not exist yet.') },
        states: first ? { ...hiddenAll(CODE_ALL.filter((id) => id !== 'code' && id !== 'tf')) } : {},
        metrics: { ...base, vms: 0, ready: 0, changed: 0, minutes: 0 },
      });
    steps.push({
      id: 'apply',
      label: 'apply',
      caption: second
        ? bi('Terraform сравнивает код с state и с облаком и печатает No changes: все ресурсы уже такие, как описано. Поэтому Terraform ничего в облаке не трогает.', 'Terraform compares the code with the state and the cloud and prints No changes: every resource is already as described. So Terraform touches nothing in the cloud.')
        : fb(bi('Команда terraform apply создаёт сеть и {v} ВМ с меткой trainer=devops, а адреса машинам выдаёт облако.', 'terraform apply creates the network and {v} VMs with the trainer=devops label, and the cloud gives the machines their addresses.'), { v: n.vms }),
      focus: second ? ['code', 'e-read', 'tf'] : ['e-api', 'cloud'],
      reveal: second ? [] : ['cloud', 'e-api', 'cp', 'w1', ...(two ? ['w2'] : [])],
      tokens: second ? [{ edge: 'e-read', label: 'infra/*.tf' }] : [{ edge: 'e-api', label: `+${n.vms} VM` }],
      say: second
        ? { tf: bi('Terraform сравнивает код с облаком и не находит ни одного отличия, поэтому ничего не меняет.', 'Terraform compares the code with the cloud, finds no difference and changes nothing.') }
        : { cloud: fb(bi('Облако создаёт сеть и {v} ВМ, ставит на каждую машину метку trainer=devops и выдаёт машинам адреса.', 'The cloud creates the network and {v} VMs, puts the trainer=devops label on each and gives them addresses.'), { v: n.vms }) },
      states: second ? { ...noW2 } : { tf: 'ok', cloud: 'ok', cp: 'on', w1: 'on', ...w2('on'), ...noW2 },
      values: { cp: `${ip.cp}`, w1: `${ip.w1}`, ...(two ? { w2: `${ip.w2}` } : {}), ...(W > 2 ? { w2: `${W - 1} × VM` } : {}) },
      metrics: { ...base, ready: second ? n.vms : 0, changed: 0, minutes: second ? 0 : 2 },
    });

    // ── the inventory ──
    const stale = !second && broken.has('stale-inventory');
    const oldIp = rebuild ? '10.0.0.12' : '10.0.0.21';
    if (stale) {
      steps.push({
        id: 'inv-old',
        label: 'inventory',
        caption: rebuild
          ? bi('Инвентарь не взяли заново из terraform output, и в inventory.ini остался адрес от прошлых машин: cp_endpoint=10.0.0.12:6443. А control plane теперь будет на машине с адресом 10.0.0.16.', 'The inventory was not taken from terraform output again, and inventory.ini still holds the address of the old machines: cp_endpoint=10.0.0.12:6443. The control plane is now going to be on 10.0.0.16.')
          : bi('Инвентарь написали руками и ошиблись в адресе: в cp_endpoint стоит 10.0.0.21, а машина cp-1 получила адрес 10.0.0.12.', 'The inventory was written by hand with a wrong address: cp_endpoint holds 10.0.0.21, while cp-1 got 10.0.0.12.'),
        focus: ['inv'],
        reveal: ['inv'],
        say: { inv: fb(bi('В файле inventory.ini записано cp_endpoint={ip}:6443, и по этому адресу рабочие узлы будут искать control plane.', 'inventory.ini says cp_endpoint={ip}:6443, and the workers will look for the control plane at this address.'), { ip: oldIp }) },
        states: { inv: 'warn', 'e-out': rebuild ? 'off' : 'hidden' },
        values: { inv: `cp_endpoint=${oldIp}` },
        metrics: { ...base, ready: 0, changed: 0, minutes: 2 },
      });
    } else {
      steps.push({
        id: 'inventory',
        label: 'output',
        caption: bi('Команда terraform output -raw inventory > inventory.ini записывает в файл группы машин, их адреса и cp_endpoint. Так адреса попадают к Ansible без ручного копирования.', 'terraform output -raw inventory > inventory.ini writes the machine groups, their addresses and cp_endpoint into the file. This is how the addresses reach Ansible with no manual copying.'),
        focus: ['e-out', 'inv'],
        reveal: ['inv', 'e-out'],
        tokens: [{ edge: 'e-out', label: `cp_endpoint=${ip.cp}` }],
        say: { inv: fb(bi('В инвентарь записаны адреса новых машин и cp_endpoint={ip}:6443.', 'The inventory now holds the new machine addresses and cp_endpoint={ip}:6443.'), { ip: ip.cp }) },
        states: { inv: 'ok', 'e-out': 'on' },
        values: { inv: `cp_endpoint=${ip.cp}` },
        metrics: { ...base, ready: second ? n.vms : 0, changed: 0, minutes: second ? 0 : 2 },
      });
    }

    // ── preparing the nodes ──
    const prepChanged = second ? 0 : 6 * n.vms;
    steps.push({
      id: 'prepare',
      label: bi('подготовка', 'prepare'),
      caption: second
        ? bi('Роли подготовки проходят все узлы и ничего не меняют: swap уже выключен, модули ядра и параметры sysctl на месте, пакеты установлены. Каждая задача отвечает ok.', 'The preparation roles go over every node and change nothing: swap is already off, the kernel modules and sysctl values are in place, the packages are installed. Every task answers ok.')
        : fb(bi('Ansible готовит узлы по {f} за раз: выключает swap, загружает модули ядра, включает пересылку пакетов, ставит containerd с драйвером cgroup systemd и пакеты Kubernetes закреплённой версии. На это уходит {m} мин.', 'Ansible prepares the nodes {f} at a time: turns swap off, loads the kernel modules, turns on packet forwarding, installs containerd with the systemd cgroup driver and the Kubernetes packages of the pinned version. It takes {m} min.'), { f: p.forks, m: n.prepMin }),
      focus: ['ans', 'e-inv', 'e-ssh-cp', 'e-ssh-w1', 'e-ssh-w2'],
      reveal: ['ans', 'e-inv', 'e-ssh-cp', 'e-ssh-w1', ...(two ? ['e-ssh-w2'] : [])],
      tokens: sshTokens(bi('роли', 'roles')),
      say: {
        ans: second
          ? bi('Ansible проходит роли подготовки на всех узлах и видит, что каждая настройка уже на месте.', 'Ansible runs the preparation roles on every node and sees that every setting is already in place.')
          : fb(bi('Ansible заходит на узлы по SSH, по {f} за раз, и выполняет на них роли подготовки.', 'Ansible connects to the nodes over SSH, {f} at a time, and runs the preparation roles on them.'), { f: p.forks }),
      },
      states: { ans: 'on', cp: 'ok', w1: 'ok', ...w2('ok') },
      values: broken.has('swap') ? { cp: 'swap on' } : {},
      metrics: { ...base, ready: second ? n.vms : 0, changed: prepChanged, minutes: second ? 1 : 2 + n.prepMin },
    });
    if (broken.has('swap')) {
      steps.push({
        id: 'init',
        label: 'init',
        caption: bi('Роль kubeadm_init запускает kubeadm init, и он начинает с проверок узла перед запуском (preflight). На cp-1 включён swap, а kubelet по умолчанию со swap не работает, поэтому kubeadm останавливается и ничего не меняет на узле.', 'The kubeadm_init role runs kubeadm init, which starts with the pre-flight checks of the node. Swap is on on cp-1, and by default the kubelet does not run with swap, so kubeadm stops and changes nothing on the node.'),
        focus: ['cp', 'e-init'],
        reveal: ['plane', 'e-init'],
        say: { cp: bi('Проверки kubeadm находят на cp-1 включённый swap и останавливают kubeadm init с ошибкой.', 'The kubeadm checks find swap on on cp-1 and stop kubeadm init with an error.') },
        states: { cp: 'err', 'e-init': 'err', plane: 'off' },
        metrics: { ...base, ready: 0, changed: prepChanged, minutes: 2 + n.prepMin },
        broken: { at: 'cp', message: 'error execution phase preflight: [preflight] Some fatal errors occurred:\n\t[ERROR Swap]: running with swap on is not supported. Please disable swap', caption: bi('Проверки kubeadm находят неподготовленный узел, но не исправляют его. Поэтому подготовкой занимается роль k8s_prereq, а сообщение ERROR Swap означает, что эта роль не убрала строку swap из /etc/fstab.', 'The kubeadm checks find an unprepared node but do not fix it. That is why the k8s_prereq role prepares the node, and ERROR Swap means that role did not remove the swap line from /etc/fstab.') },
      });
      return steps;
    }

    // ── a repeated run on a ready cluster ──
    if (second) {
      if (broken.has('nocreates')) {
        steps.push({
          id: 'init',
          label: 'init',
          caption: bi('Без параметра creates задача kubeadm init выполняется снова, хотя cp-1 уже стал control plane. Проверки kubeadm находят занятый порт 6443 и манифесты, которые уже лежат на месте, и останавливают команду.', 'Without creates the kubeadm init task runs again, although cp-1 is already a control plane. The kubeadm checks find port 6443 busy and the manifests already in place, and stop the command.'),
          focus: ['cp', 'e-init'],
          say: { cp: bi('kubeadm init второй раз запускается на готовом control plane, и его проверки находят занятый порт 6443.', 'kubeadm init runs a second time on a ready control plane, and its checks find port 6443 busy.') },
          states: { cp: 'err', 'e-init': 'err' },
          metrics: { ...base, ready: n.vms, changed: 0, minutes: 1 },
          broken: { at: 'cp', message: PREFLIGHT_AGAIN, caption: NO_CREATES_WHY },
        });
        return steps;
      }
      steps.push({
        id: 'skip',
        label: 'creates',
        caption: bi('Задачи kubeadm init и kubeadm join пропущены, потому что файлы admin.conf и kubelet.conf, указанные в creates, уже есть на узлах. Роль cilium тоже пропущена, потому что её файл в /etc/cni/net.d уже на месте.', 'The kubeadm init and kubeadm join tasks are skipped, because the admin.conf and kubelet.conf files named in creates already exist on the nodes. The cilium role is skipped too: its file in /etc/cni/net.d is in place.'),
        focus: ['cp', 'w1', 'w2'],
        say: { cp: bi('На cp-1 уже есть файл /etc/kubernetes/admin.conf, поэтому Ansible пропускает kubeadm init и отвечает ok.', 'cp-1 already has /etc/kubernetes/admin.conf, so Ansible skips kubeadm init and answers ok.') },
        states: { plane: 'ok', cni: broken.has('nocni') ? 'off' : 'ok' },
        metrics: { ...base, ready: broken.has('nocni') ? 0 : n.vms, changed: 0, minutes: 1 },
      });
      steps.push({
        id: 'ready',
        label: 'changed=0',
        caption: bi('В итоговой сводке PLAY RECAP у каждого узла стоит changed=0. Код описывает состояние кластера, и кластер в этом состоянии уже находится, поэтому повторный прогон ничего не меняет.', 'The PLAY RECAP shows changed=0 for every node. The code describes a state of the cluster, and the cluster is already in it, so a repeated run changes nothing.'),
        focus: ['ans'],
        say: { ans: bi('Ansible печатает итоговую сводку, и в ней ни одна задача ничего не изменила.', 'Ansible prints the recap, and in it no task changed anything.') },
        states: { ans: 'ok' },
        metrics: { ...base, ready: broken.has('nocni') ? 0 : n.vms, changed: 0, minutes: 1 },
      });
      return steps;
    }

    // ── kubeadm init and the pod network ──
    steps.push({
      id: 'init',
      label: 'init',
      caption: bi('Роль kubeadm_init запускает kubeadm init с конфигурационным файлом. kubeadm пишет сертификаты, файлы kubeconfig и манифесты, а kubelet запускает по манифестам компоненты control plane. На узле появляется файл /etc/kubernetes/admin.conf, и при следующих прогонах параметр creates будет пропускать эту задачу по этому файлу.', 'The kubeadm_init role runs kubeadm init with a configuration file. kubeadm writes certificates, kubeconfig files and manifests, and the kubelet starts the control-plane components from the manifests. /etc/kubernetes/admin.conf appears on the node, and on later runs creates will skip this task by it.'),
      focus: ['cp', 'e-init', 'plane'],
      reveal: ['plane', 'e-init'],
      tokens: [{ edge: 'e-init', label: 'manifests/*.yaml' }],
      say: { plane: bi('kubelet на cp-1 запускает etcd, kube-apiserver, kube-controller-manager и kube-scheduler из манифестов, которые написал kubeadm.', 'The kubelet on cp-1 starts etcd, kube-apiserver, kube-controller-manager and kube-scheduler from the manifests kubeadm wrote.') },
      states: { plane: 'ok', cp: 'ok' },
      values: { cp: 'NotReady' },
      metrics: { ...base, ready: 0, changed: prepChanged + 2, minutes: 4 + n.prepMin },
    });
    if (!broken.has('nocni'))
      steps.push({
        id: 'cni',
        label: 'cilium',
        caption: bi('Роль cilium ставит сеть подов через API кластера. Агент Cilium запускается на каждом узле, и CoreDNS, который ждал сети, выходит из состояния Pending.', 'The cilium role installs the pod network through the cluster API. The Cilium agent starts on every node, and CoreDNS, which was waiting for the network, leaves Pending.'),
        focus: ['e-cni', 'cni'],
        reveal: ['cni', 'e-cni'],
        tokens: [{ edge: 'e-cni', label: 'DaemonSet cilium' }],
        say: { cni: bi('Агент Cilium запускается на cp-1 и пишет конфигурацию сети в /etc/cni/net.d, после чего узел становится Ready.', 'The Cilium agent starts on cp-1 and writes the network config into /etc/cni/net.d, after which the node becomes Ready.') },
        states: { cni: 'ok' },
        values: { cp: 'Ready' },
        metrics: { ...base, ready: 1, changed: prepChanged + 3, minutes: 5 + n.prepMin },
      });

    // ── joining the workers ──
    if (stale) {
      steps.push({
        id: 'join',
        label: 'join',
        caption: fb(bi('Рабочие узлы обращаются к control plane по адресу из cp_endpoint, {ip}:6443, но по этому адресу никто не отвечает. Поэтому kubeadm join останавливается с ошибкой connection refused.', 'The workers go to the control plane at the cp_endpoint address, {ip}:6443, but nobody answers there. So kubeadm join stops with connection refused.'), { ip: oldIp }),
        focus: ['w1', 'e-join1'],
        reveal: ['e-join1', ...(two ? ['e-join2'] : [])],
        tokens: [{ edge: 'e-join1', label: `${oldIp}:6443` }],
        say: { w1: fb(bi('Узел worker-1 пытается подключиться к control plane по адресу {ip}:6443 и не получает ответа.', 'worker-1 tries to connect to the control plane at {ip}:6443 and gets no answer.'), { ip: oldIp }) },
        states: { w1: 'err', 'e-join1': 'err', ...w2('err') },
        metrics: { ...base, ready: 1, changed: prepChanged + 3, minutes: 6 + n.prepMin },
        broken: { at: 'e-join1', message: `error execution phase preflight: couldn't validate the identity of the API Server: failed to request the cluster-info ConfigMap: Get "https://${oldIp}:6443/api/v1/namespaces/kube-public/configmaps/cluster-info?timeout=10s": dial tcp ${oldIp}:6443: connect: connection refused`, caption: bi('Сообщение connection refused на шаге join означает, что рабочий узел обратился не по тому адресу. Поэтому всё, что зависит от адресов машин, после каждого создания машин берут из terraform output, а не переписывают вручную.', 'connection refused at join means the worker came to the wrong address. Everything that depends on machine addresses is taken from terraform output after every creation of the machines, not copied by hand.') },
      });
      return steps;
    }
    const ready = broken.has('nocni') ? 0 : n.vms;
    steps.push({
      id: 'join',
      label: 'join',
      caption: fb(bi('Роль kubeadm_join запускает kubeadm join: {w} предъявляют токен присоединения и регистрируются в кластере. На каждом узле появляется файл kubelet.conf, и по нему параметр creates будет пропускать join при следующих прогонах.', 'The kubeadm_join role runs kubeadm join: {w} present the bootstrap token and register in the cluster. kubelet.conf appears on every node, and creates will skip join by it on later runs.'), { w: fb(bi('{n} {r}', '{n} workers'), { n: W, r: workersRu(W) }) }),
      focus: ['w1', 'w2', 'e-join1', 'e-join2'],
      reveal: ['e-join1', ...(two ? ['e-join2'] : [])],
      tokens: [{ edge: 'e-join1', label: bi('токен', 'token') }, ...(two ? [{ edge: 'e-join2', label: bi('токен', 'token') }] : [])],
      say: { w1: bi('Узел worker-1 предъявляет control plane токен присоединения и получает в ответ свой сертификат kubelet.', 'worker-1 presents the bootstrap token to the control plane and gets its own kubelet certificate in return.') },
      states: { w1: 'ok', ...w2('ok') },
      metrics: { ...base, ready, changed: prepChanged + 3 + W, minutes: n.totalMin },
    });
    if (broken.has('nocni')) {
      steps.push({
        id: 'notready',
        label: 'NotReady',
        caption: bi('Все узлы присоединились к кластеру, но остаются в состоянии NotReady, потому что kubelet на каждом узле ждёт конфигурацию сетевого плагина. CoreDNS по той же причине остаётся в Pending.', 'Every node joined the cluster but stays NotReady, because the kubelet on every node waits for a network plugin config. For the same reason CoreDNS stays Pending.'),
        focus: ['cp', 'w1', 'w2'],
        say: { cp: bi('kubelet на cp-1 не находит конфигурацию сети подов в /etc/cni/net.d и сообщает, что узел не готов.', 'The kubelet on cp-1 finds no pod network config in /etc/cni/net.d and reports the node as not ready.') },
        states: { cp: 'warn', w1: 'warn', ...w2('warn') },
        values: { cp: 'NotReady', w1: 'NotReady', ...(two ? { w2: 'NotReady' } : {}) },
        metrics: { ...base, ready: 0, changed: prepChanged + 2 + W, minutes: n.totalMin },
        broken: { at: 'cni', message: 'container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized', caption: bi('kubeadm намеренно не ставит сеть подов, потому что её выбирают отдельно. Если узлы присоединились, но остались NotReady, а в журнале kubelet написано cni plugin not initialized, значит, сетевой плагин не установлен.', 'kubeadm deliberately installs no pod network, because it is chosen separately. If the nodes joined but stay NotReady and the kubelet log says cni plugin not initialized, the network plugin is not installed.') },
      });
      return steps;
    }
    steps.push({
      id: 'ready',
      label: 'Ready',
      caption: fb(bi('Через {m} мин после начала {v} находятся в состоянии Ready, и кластер собран из пустого облака без единого ручного шага. Такой кластер не жалко удалить, потому что та же последовательность команд соберёт его снова.', '{v} nodes Ready {m} min after the start, from an empty cloud, without a single manual step. Such a cluster is no loss to delete, because the same sequence of commands builds it again.'), { v: fb(bi('{n} {r}', '{n}'), { n: n.vms, r: nodesRu(n.vms) }), m: n.totalMin }),
      focus: ['plane'],
      say: { plane: fb(bi('API-сервер видит {v} в состоянии Ready и готов принимать приложения.', 'The API server sees {v} Ready nodes and is ready to take applications.'), { v: fb(bi('{n} {r}', '{n}'), { n: n.vms, r: nodesRu(n.vms) }) }) },
      states: { cp: 'ok', w1: 'ok', ...w2('ok') },
      values: { cp: 'Ready', w1: 'Ready', ...(two ? { w2: W > 2 ? `${W - 1} × Ready` : 'Ready' } : {}) },
      metrics: { ...base, ready, changed: prepChanged + 3 + W, minutes: n.totalMin },
    });
    if (broken.has('nocreates')) {
      steps.push({
        id: 'again',
        label: bi('ещё раз', 'again'),
        caption: bi('Теперь Ansible выполняет контрольный повторный прогон. Без параметра creates задача kubeadm init выполняется на узле, который уже стал control plane, и проверки kubeadm останавливают её с ошибкой.', 'Now Ansible makes the check run. Without creates the kubeadm init task runs on a node that is already a control plane, and the kubeadm checks stop it with an error.'),
        focus: ['cp', 'e-init'],
        say: { cp: bi('kubeadm init второй раз запускается на готовом control plane, и его проверки находят занятый порт 6443.', 'kubeadm init runs a second time on a ready control plane, and its checks find port 6443 busy.') },
        states: { cp: 'err', 'e-init': 'err' },
        metrics: { ...base, ready, changed: 0, minutes: n.totalMin + 1 },
        broken: { at: 'cp', message: PREFLIGHT_AGAIN, caption: NO_CREATES_WHY },
      });
      return steps;
    }
    steps.push({
      id: 'again',
      label: 'changed=0',
      caption: bi('Контрольный повторный прогон ничего не меняет. Задачи kubeadm init и kubeadm join пропущены по параметру creates, и в сводке PLAY RECAP стоит changed=0. Это значит, что код описывает состояние кластера, а не список действий.', 'The check run changes nothing. The kubeadm init and kubeadm join tasks are skipped by creates, and PLAY RECAP says changed=0. This means the code describes a state of the cluster, not a list of actions.'),
      focus: ['ans'],
      say: { ans: bi('Ansible прогоняет тот же код ещё раз, и ни одна задача ничего не меняет.', 'Ansible runs the same code once more, and no task changes anything.') },
      states: { ans: 'ok' },
      metrics: { ...base, ready, changed: 0, minutes: n.totalMin + 1 },
    });
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и цепочка снова доходит до конца.', 'The break is gone, and the chain runs to the end again.');
      const at = brokenAt(next);
      if (change.id === 'nocreates' && at && next.some((s) => s.id === 'ready'))
        return bi('Первый прогон проходит, потому что файла admin.conf ещё нет и creates ничего бы не изменил. Ломается контрольный повторный прогон, потому что kubeadm init второй раз запускается на готовом control plane.', 'The first run passes, because admin.conf does not exist yet and creates would change nothing. The check run breaks, because kubeadm init runs a second time on a ready control plane.');
      if (change.id === 'stale-inventory' && !at) return bi('В этом прогоне join не выполняется, поэтому неверный адрес не проявился. Он остановит первый же новый узел, который попробует присоединиться.', 'join does not run in this run, so the wrong address did not show. It will stop the very first new node that tries to join.');
      return at ? bi('Цепочка остановилась на сломанном звене. Сообщение настоящего инструмента показано на шаге, где произошла остановка.', 'The chain stopped at the broken link. The real tool’s message is shown at the step where it stopped.') : bi('Эта поломка не мешает выбранному прогону, потому что он не выполняет сломанное звено.', 'This break does not affect the chosen run, because it does not execute the broken link.');
    }
    if (change.id === 'workers') return fb(bi('Машин стало {v}. Если забыть стенд на месяц, он наберёт {h} ВМ-часов, потому что облако берёт плату за каждый час каждой машины.', 'There are now {v} machines. A lab forgotten for a month runs up {h} VM-hours, because the cloud bills every hour of every machine.'), { v: metric(next, 'vms'), h: metric(next, 'month') });
    if (change.id === 'forks') return fb(bi('Ansible готовит теперь по {f} узла за раз, и кластер готов через {m} мин вместо {p}.', 'Ansible now prepares {f} nodes at a time, and the cluster is ready in {m} min instead of {p}.'), { f: change.to as number, m: metric(next, 'minutes'), p: metric(prev, 'minutes') });
    if (change.id === 'serial')
      return minReplicas(next) === 0
        ? bi('В худший момент обновления не осталось ни одной готовой реплики, потому что все рабочие узлы выведены из работы одновременно и подам некуда переехать.', 'At the worst moment of the upgrade not a single replica is ready, because all workers are out of service at once and the pods have nowhere to go.')
        : bi('Узлы обновляются по одному, поды переезжают на соседние узлы, и приложение отвечает пользователям всё время обновления.', 'The nodes are upgraded one by one, the pods move to the neighbours, and the application answers users throughout the upgrade.');
    if (change.id === 'run' && change.to === 'upgrade') return bi('Теперь показано обновление рабочих узлов. Control plane уже работает на v1.37, и плей обновляет рабочие узлы так, как задано в поле serial.', 'Now the upgrade of the workers is shown. The control plane already runs v1.37, and the play upgrades the workers as the serial field says.');
    if (change.id === 'run' && change.to === 'rebuild') return bi('Теперь показано пересоздание кластера. Terraform сначала удаляет все машины, а потом цепочка собирает кластер заново на новых машинах с новыми адресами.', 'Now the rebuild of the cluster is shown. Terraform first deletes every machine, and then the chain builds the cluster again on new machines with new addresses.');
    if (change.id === 'run' && change.to === 'first') return bi('Теперь показан первый прогон кода в пустом облаке, когда каждое звено цепочки создаёт что-то новое.', 'Now the first run of the code in an empty cloud is shown, when every link of the chain creates something new.');
    return metric(next, 'changed') === 0 && !brokenAt(next)
      ? bi('Этот прогон ничего не меняет на узлах. Так проверяют, что код описывает состояние кластера, а не список действий.', 'This run changes nothing on the nodes. This is how you check that the code describes a state of the cluster, not a list of actions.')
      : bi('Прогон пересчитан. Пройдите его по шагам и посмотрите, как изменились счётчики под схемой.', 'The run is recomputed. Step through it and see how the counters under the diagram changed.');
  },
});

// ── E-GITOPS ──

type GitP = { automated: boolean; selfHeal: boolean; prune: boolean; event: string };

const GIT_ALL = ['dev', 'repo', 'ctrl', 'app', 'api', 'deploy', 'pods', 'human', 'e-push', 'e-poll', 'e-app', 'e-sync', 'e-live', 'e-rs', 'e-edit'];
const G_EVENT = bi('Что случилось', 'What happened');
const G_POLICY = bi('Политика синхронизации в Application shop', 'The sync policy of the Application shop');

export const gitopsModel = defineModel<GitP>({
  id: 'k8s-3.gitops-loop',
  block: 'k8s-3',
  title: bi('Как Argo CD приводит кластер к Git', 'How Argo CD brings the cluster to Git'),
  summary: bi(
    'Что происходит после того, как кто-то изменил приложение shop: отправил коммит в репозиторий манифестов, удалил из него файл или поправил объект в кластере вручную. Контроллер Argo CD внутри кластера сравнивает манифесты из Git с живыми объектами и, если политика синхронизации разрешает, сам устраняет разницу. Под схемой считаются реплики в кластере, объекты, которые расходятся с Git, и минуты до совпадения.',
    'What happens after someone changed the shop application: pushed a commit to the manifests repository, deleted a file from it or edited an object in the cluster by hand. The Argo CD controller inside the cluster compares the manifests from Git with the live objects and, if the sync policy allows, removes the difference itself. Under the diagram you see the replicas in the cluster, the objects that differ from Git and the minutes until they match.',
  ),
  intro: bi(
    'Схема соберётся у вас на глазах: сейчас на ней только автор изменения и то место, которое он меняет. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Контроллер, объект Application и живые объекты кластера появятся, когда до них дойдёт цикл. Облачко у подсвеченного участника говорит, что он делает, а карточка на линии показывает, что он передаёт.\n\nКогда дойдёте до конца, выберите в «Параметрах» другое событие и переключите поля политики синхронизации.',
    'The diagram builds itself as you go: now it shows only the author of the change and the place they change. Press “Start from the first step”, then go on with “Step forward” above the diagram. The controller, the Application and the live cluster objects appear when the loop reaches them. The callout at the highlighted participant says what it does, and the card on the line shows what it hands on.\n\nOnce you reach the end, choose another event in “Parameters” and switch the fields of the sync policy.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: bi('облачко с тем, что делает подсвеченный участник', 'the callout with what the highlighted participant does') },
    { mark: 'token', text: bi('карточка с тем, что участник передаёт: коммит, ревизию, изменение объекта', 'what it hands on: a commit, a revision, an object change') },
    { mark: 'icon:user', text: bi('человек, то есть автор коммита или коллега с доступом к кластеру', 'a person, that is the commit author or a colleague with cluster access') },
    { mark: 'icon:database', text: bi('репозиторий манифестов в Git', 'the manifests repository in Git') },
    { mark: 'icon:process', text: bi('контроллер Argo CD', 'the Argo CD controller') },
    { mark: 'icon:file', text: bi('объект в кластере: Application или Deployment', 'an object in the cluster: the Application or the Deployment') },
    { mark: 'icon:server', text: bi('API-сервер кластера', 'the cluster API server') },
    { mark: 'icon:container', text: bi('поды приложения', 'the application pods') },
    { mark: 'dashed', text: bi('правка мимо Git', 'an edit behind Git’s back') },
    { mark: 'ok', text: bi('кластер совпадает с Git (Synced)', 'the cluster matches Git (Synced)') },
    { mark: 'warn', text: bi('кластер расходится с Git (OutOfSync)', 'the cluster differs from Git (OutOfSync)') },
    { mark: 'err', text: bi('здесь цикл остановился', 'the loop stopped here') },
  ],
  stopLabel: bi('Синхронизация остановилась', 'The sync stopped'),
  concepts: ['cicd.gitops-pull', 'k8s.argocd-app', 'k8s.sync-policy'],
  diagram: {
    width: 960,
    height: 464,
    nodes: [
      node('dev', bi('Разработчик', 'Developer'), 'user', 'user', 'pill', 24, 60, 200, 56, bi('Человек, который выкладывает новую версию приложения. Выкладка в GitOps означает коммит в репозиторий манифестов, прошедший ревью, поэтому доступ к кластеру разработчику для выкладки не нужен.', 'The person who releases a new version. In GitOps a release is a reviewed commit to the manifests repository, so the developer needs no cluster access to release.'), bi('Коммит делает разработчик или конвейер CI.', 'A developer or the CI pipeline makes the commit.'), 'git log --oneline -3'),
      node('repo', bi('Репозиторий манифестов', 'Manifests repository'), 'database', 'ci-source', 'doc', 312, 48, 208, 80, bi('Манифесты в каталоге k8s на ветке main служат единственным источником желаемого состояния приложения. Всё, что в кластере расходится с этими файлами, Argo CD считает расхождением.', 'The single source of the desired state: the manifests in the k8s directory on the main branch. Anything in the cluster that differs from these files Argo CD counts as a difference.'), bi('Репозиторий shop-deploy ведёт команда приложения.', 'The application team keeps the shop-deploy repository.'), 'git show --stat HEAD', DOC.argoApp, 'main @ a1b2c3d'),
      node('ctrl', bi('Контроллер Argo CD', 'Argo CD controller'), 'process', 'cp', 'hex', 680, 56, 256, 64, bi('Контроллер, который работает внутри кластера. Он сравнивает манифесты из Git с объектами в кластере и, если политика синхронизации разрешает, сам применяет разницу, а иначе только помечает Application как OutOfSync.', 'A controller running inside the cluster. It compares the manifests from Git with the objects in the cluster and, if the sync policy allows, applies the difference itself; otherwise it only marks the Application OutOfSync.'), bi('Контроллер запущен как Deployment argocd-application-controller в namespace argocd.', 'It runs as the argocd-application-controller Deployment in the argocd namespace.'), 'kubectl -n argocd get pods', DOC.argo),
      node('app', 'Application shop', 'file', 'obj', 'doc', 680, 184, 256, 72, bi('Объект, который говорит контроллеру, откуда брать манифесты (repoURL, path, targetRevision), куда их применять (destination) и по какой политике синхронизировать (syncPolicy). В его status контроллер пишет, совпадает ли кластер с Git (Synced или OutOfSync) и здоровы ли объекты (Healthy или Degraded).', 'The object that tells the controller where to take the manifests from (repoURL, path, targetRevision), where to apply them (destination) and by which policy to sync (syncPolicy). In its status the controller writes whether the cluster matches Git (Synced or OutOfSync) and whether the objects are healthy (Healthy or Degraded).'), bi('Объект создаёте вы командой kubectl apply в namespace argocd.', 'You create it with kubectl apply in the argocd namespace.'), 'kubectl -n argocd get application shop -o yaml', DOC.argoApp, 'Synced · Healthy'),
      node('api', bi('API-сервер', 'API server'), 'server', 'cp', 'hex', 312, 208, 208, 56, bi('Через API-сервер контроллер читает живые объекты и применяет изменения, точно так же, как это делает kubectl.', 'Through the API server the controller reads the live objects and applies changes, just as kubectl does.'), bi('API-сервер входит в control plane кластера.', 'The API server is part of the cluster control plane.'), 'kubectl get --raw /readyz'),
      node('deploy', 'Deployment shop', 'file', 'obj', 'doc', 312, 328, 208, 72, bi('Живой объект в namespace shop. Его spec должен совпадать с файлом deployment.yaml из Git, иначе Application помечается как OutOfSync.', 'The live object in the shop namespace. Its spec must match deployment.yaml from Git, otherwise the Application is marked OutOfSync.'), bi('Объект создал и обновляет Argo CD.', 'Argo CD created it and updates it.'), 'kubectl -n shop get deploy shop -o yaml', undefined, '2 × trainer/web:1.0'),
      node('pods', bi('Поды приложения', 'Application pods'), 'container', 'node', 'rack', 680, 328, 256, 72, bi('Поды, которые создал контроллер Deployment. Argo CD сам их не трогает, потому что отвечает только за объекты, описанные в Git.', 'The pods the Deployment controller made. Argo CD does not touch them, because it is responsible only for the objects described in Git.'), bi('Поды создаёт ReplicaSet, которым управляет Deployment.', 'The ReplicaSet owned by the Deployment creates them.'), 'kubectl -n shop get pods'),
      node('human', bi('Коллега с kubectl', 'Colleague with kubectl'), 'user', 'user', 'pill', 24, 336, 200, 56, bi('Человек, который правит объект в кластере вручную, мимо Git, например командой kubectl scale или kubectl edit. Для GitOps такая правка означает дрейф, то есть то же расхождение с описанием, что и ручная правка машины в консоли облака.', 'A person who edits an object in the cluster by hand, behind Git’s back, for example with kubectl scale or kubectl edit. For GitOps such an edit is drift, the same difference as a manual VM edit in the cloud console.'), bi('Правку делает человек с доступом к кластеру.', 'A person with cluster access makes the edit.'), 'kubectl -n shop scale deploy shop --replicas=5'),
    ],
    edges: [
      edge('e-push', 'dev', 'repo', 'git push', bi('Коммит попадает в ветку main и становится новой ревизией.', 'The commit lands on main and becomes a new revision.'), bi('Коммит отправляет git.', 'git sends the commit.')),
      edge('e-poll', 'ctrl', 'repo', bi('опрос раз в 3 мин', 'poll every 3 min'), bi('Контроллер сам обращается к репозиторию раз в три минуты или сразу, когда репозиторий пришлёт уведомление (вебхук). Кластер забирает изменения сам, а не получает их снаружи.', 'The controller itself goes to the repository every three minutes, or at once when the repository sends a notification (a webhook). The cluster pulls the changes itself instead of receiving them from outside.'), bi('Репозиторий опрашивает компонент repo-server Argo CD.', 'The Argo CD repo-server polls the repository.'), { doc: DOC.argo, via: [[808, 20], [416, 20]], labelAt: 0.5 }),
      edge('e-app', 'app', 'ctrl', bi('источник и политика', 'source and policy'), bi('Контроллер читает из Application, откуда брать манифесты, куда их применять и что ему разрешено делать самому.', 'The controller reads from the Application where to take the manifests, where to apply them and what it may do by itself.'), bi('Объект читает Argo CD.', 'Argo CD reads the object.'), { doc: DOC.argoApp }),
      edge('e-sync', 'ctrl', 'api', bi('сверка и применение', 'compare and apply'), bi('Контроллер читает живые объекты через API, а при синхронизации применяет манифесты из Git, помечая объекты аннотацией tracking-id.', 'The controller reads the live objects through the API and, during a sync, applies the manifests from Git, marking the objects with the tracking-id annotation.'), bi('Запросы делает Argo CD.', 'Argo CD makes the requests.'), { via: [[600, 88], [600, 236]], labelAt: 0.55 }),
      edge('e-live', 'api', 'deploy', bi('живой объект', 'live object'), bi('Объект, который на самом деле лежит в кластере сейчас.', 'The object that really is in the cluster now.'), bi('Объект хранит API-сервер.', 'The API server stores it.')),
      edge('e-rs', 'deploy', 'pods', bi('замена подов', 'replacing pods'), bi('Дальше работает обычный цикл согласования Deployment: ReplicaSet создаёт поды новой версии и останавливает старые.', 'From here the ordinary Deployment reconcile loop works: a ReplicaSet creates the new pods and stops the old ones.'), bi('Поды заменяет kube-controller-manager.', 'kube-controller-manager replaces the pods.')),
      edge('e-edit', 'human', 'deploy', 'kubectl scale', bi('Правка мимо Git меняет живой объект, а Git о ней ничего не знает.', 'An edit behind Git’s back changes the live object, and Git knows nothing about it.'), bi('Правку делает коллега.', 'The colleague makes it.'), { dashed: true }),
    ],
  },
  params: [
    {
      id: 'event',
      label: bi('Какое изменение произошло', 'Which change happened'),
      kind: 'choice',
      default: 'commit',
      group: G_EVENT,
      options: [
        { id: 'commit', label: bi('коммит с новым образом 1.1', 'a commit with the new image 1.1') },
        { id: 'edit', label: bi('коллега вручную поставил 5 реплик', 'a colleague set 5 replicas by hand') },
        { id: 'delete', label: bi('из Git удалили service.yaml', 'service.yaml was deleted from Git') },
      ],
      near: 'dev',
    },
    {
      id: 'automated',
      label: bi('Синхронизировать без человека (automated)', 'Sync without a person (automated)'),
      kind: 'toggle',
      default: true,
      group: G_POLICY,
      near: 'app',
      predict: {
        prompt: bi('Вы переключаете automated. Применит ли контроллер выбранное изменение в кластере сам, без человека?', 'You switch automated. Will the controller apply the chosen change in the cluster by itself, without a person?'),
        options: [
          { id: 'wait', text: bi('Нет, он пометит Application как OutOfSync и будет ждать, пока синхронизацию запустит человек', 'No, it marks the Application OutOfSync and waits for a person to start the sync') },
          { id: 'apply', text: bi('Да, контроллер применит изменение сам в течение нескольких минут', 'Yes, the controller applies the change itself within a few minutes') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'sync' || s.id === 'heal' || s.id === 'pruned') ? 'apply' : 'wait'),
      },
    },
    {
      id: 'selfHeal',
      label: bi('Возвращать ручные правки к Git (selfHeal)', 'Undo manual edits back to Git (selfHeal)'),
      kind: 'toggle',
      default: true,
      group: G_POLICY,
      near: 'ctrl',
      predict: {
        prompt: bi('Вы переключаете selfHeal. Сколько реплик окажется в кластере в конце выбранного события?', 'You switch selfHeal. How many replicas are in the cluster at the end of the chosen event?'),
        options: [
          { id: '2', text: bi('Две, как записано в Git', 'Two, as Git says') },
          { id: '5', text: bi('Пять, как коллега поставил руками', 'Five, as the colleague set by hand') },
        ],
        resolve: (_p, next) => String(last(next)?.metrics?.replicas ?? 2),
      },
    },
    {
      id: 'prune',
      label: bi('Удалять объекты, пропавшие из Git (prune)', 'Delete objects that left Git (prune)'),
      kind: 'toggle',
      default: false,
      group: G_POLICY,
      near: 'ctrl',
      predict: {
        prompt: bi('Вы переключаете prune. Останется ли Service shop в кластере в конце выбранного события?', 'You switch prune. Does the Service shop stay in the cluster at the end of the chosen event?'),
        options: [
          { id: 'gone', text: bi('Нет, контроллер удалит Service из кластера', 'No, the controller deletes the Service from the cluster') },
          { id: 'stays', text: bi('Да, Service останется в кластере', 'Yes, the Service stays in the cluster') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'pruned') ? 'gone' : 'stays'),
      },
    },
  ],
  breaks: [
    {
      id: 'repo-down',
      label: bi('Репозиторий недоступен, потому что имя сервера Git не находится в DNS', 'The repository is unreachable: the Git server name does not resolve'),
      remove: ['e-poll'],
      boundary: 'network',
      predict: {
        prompt: bi('Контроллер не может связаться с репозиторием. Что станет с приложением, которое уже работает в кластере?', 'The controller cannot reach the repository. What happens to the application already running in the cluster?'),
        options: [
          { id: 'keeps', text: bi('Оно продолжит работать как было, а Argo CD покажет ошибку сравнения ComparisonError', 'It keeps running as it was, and Argo CD shows a ComparisonError') },
          { id: 'deleted', text: bi('Argo CD удалит его, потому что не знает желаемого состояния', 'Argo CD deletes it, because it does not know the desired state') },
        ],
        resolve: () => 'keeps',
      },
    },
    {
      id: 'bad-yaml',
      label: bi('В коммите сломанный YAML: в deployment.yaml пропало двоеточие', 'The commit has broken YAML: a colon is missing in deployment.yaml'),
      remove: ['e-sync'],
      boundary: 'io',
      predict: {
        prompt: bi('В новой ревизии один файл, deployment.yaml, не разбирается, а остальные файлы в порядке. Что попадёт в кластер?', 'In the new revision one file, deployment.yaml, does not parse, and the other files are fine. What reaches the cluster?'),
        options: [
          { id: 'nothing', text: bi('Ничего, потому что ревизия не собралась целиком и живые объекты остались прежними', 'Nothing, because the revision did not build as a whole and the live objects stay as they were') },
          { id: 'partial', text: bi('Те файлы ревизии, которые разобрались без ошибок', 'The files of the revision that parsed without errors') },
        ],
        resolve: () => 'nothing',
      },
    },
  ],
  metrics: [
    { id: 'replicas', label: bi('реплик в кластере', 'replicas in the cluster') },
    { id: 'drift', label: bi('объектов, которые расходятся с Git', 'objects that differ from Git') },
    { id: 'minutes', label: bi('минут до совпадения с Git', 'minutes until it matches Git') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];

    // ── a manual edit behind Git's back ──
    if (p.event === 'edit') {
      steps.push({
        id: 'edit',
        label: 'kubectl scale',
        caption: bi('Коллега выполняет kubectl scale --replicas=5, и Deployment в кластере теперь просит пять подов. В Git по-прежнему записано две реплики, и об этой правке Git ничего не знает.', 'A colleague runs kubectl scale --replicas=5, and the Deployment in the cluster now asks for five pods. Git still says two replicas and knows nothing of this edit.'),
        focus: ['human', 'e-edit', 'deploy'],
        reveal: ['e-edit'],
        tokens: [{ edge: 'e-edit', label: 'replicas: 5' }],
        say: { human: bi('Коллега меняет число реплик Deployment shop в самом кластере, мимо репозитория.', 'The colleague changes the replica count of the Deployment shop right in the cluster, bypassing the repository.') },
        values: { deploy: '5 × trainer/web:1.0' },
        states: { ...hiddenAll(GIT_ALL.filter((id) => id !== 'human' && id !== 'deploy')), deploy: 'warn' },
        metrics: { replicas: 5, drift: 1, minutes: 0 },
      });
      steps.push({
        id: 'compare',
        label: 'OutOfSync',
        caption: bi('Контроллер Argo CD следит за живыми объектами и сразу замечает, что spec.replicas больше не совпадает с файлом из Git. Поэтому он помечает Application shop как OutOfSync.', 'The Argo CD controller watches the live objects and notices at once that spec.replicas no longer matches the file from Git. So it marks the Application shop OutOfSync.'),
        focus: ['ctrl', 'e-sync', 'app'],
        reveal: ['ctrl', 'api', 'e-sync', 'e-live', 'app', 'e-app', 'repo', 'e-poll'],
        tokens: [{ edge: 'e-sync', reverse: true, label: 'replicas: 5' }],
        say: { ctrl: bi('Контроллер сравнивает живой Deployment с файлом из Git и видит пять реплик вместо двух.', 'The controller compares the live Deployment with the file from Git and sees five replicas instead of two.') },
        values: { app: 'OutOfSync · Healthy' },
        states: { app: 'warn' },
        metrics: { replicas: 5, drift: 1, minutes: 0 },
      });
      if (p.automated && p.selfHeal) {
        steps.push({
          id: 'heal',
          label: 'selfHeal',
          caption: bi('Политика разрешает контроллеру возвращать ручные правки (selfHeal), поэтому через несколько секунд он применяет файл из Git, и реплик снова две. Ручная правка не переживает следующего цикла сверки.', 'The policy lets the controller undo manual edits (selfHeal), so a few seconds later it applies the file from Git, and there are two replicas again. A manual edit does not survive the next comparison.'),
          focus: ['ctrl', 'e-sync', 'deploy'],
          tokens: [{ edge: 'e-sync', label: 'replicas: 2' }],
          say: { ctrl: bi('Контроллер применяет deployment.yaml из Git и возвращает Deployment к двум репликам.', 'The controller applies deployment.yaml from Git and brings the Deployment back to two replicas.') },
          values: { deploy: '2 × trainer/web:1.0', app: 'Synced · Healthy' },
          states: { deploy: 'ok', app: 'ok' },
          metrics: { replicas: 2, drift: 0, minutes: 0.1 },
        });
      } else {
        steps.push({
          id: 'stay',
          label: bi('расхождение', 'difference'),
          caption: p.automated
            ? bi('Без selfHeal контроллер только показывает расхождение. Автоматическая синхронизация срабатывает на новую ревизию в Git, а нового коммита не было, поэтому пять реплик останутся, пока кто-то не запустит синхронизацию или не изменит Git.', 'Without selfHeal the controller only shows the difference. Automated sync fires on a new Git revision, and there was no new commit, so five replicas stay until someone starts a sync or changes Git.')
            : bi('Автоматическая синхронизация выключена, поэтому контроллер только показывает расхождение. Пять реплик останутся, пока синхронизацию не запустит человек.', 'Automated sync is off, so the controller only shows the difference. Five replicas stay until a person starts a sync.'),
          focus: ['app'],
          say: { app: bi('Application shop остаётся в состоянии OutOfSync, и в кластере по-прежнему пять реплик.', 'The Application shop stays OutOfSync, and the cluster still has five replicas.') },
          states: { app: 'warn' },
          metrics: { replicas: 5, drift: 1, minutes: 0 },
        });
      }
      return steps;
    }

    // ── a commit: a new image or a deleted file ──
    const del = p.event === 'delete';
    steps.push({
      id: 'push',
      label: 'push',
      caption: del
        ? bi('Разработчик удаляет из репозитория файл k8s/service.yaml, потому что сервис больше не нужен, и отправляет коммит.', 'The developer deletes k8s/service.yaml from the repository, because the service is no longer needed, and pushes the commit.')
        : bi('Разработчик меняет в deployment.yaml образ на trainer/web:1.1, коммит проходит ревью и попадает в ветку main.', 'The developer changes the image in deployment.yaml to trainer/web:1.1, the commit passes review and lands on main.'),
      focus: ['dev', 'e-push', 'repo'],
      reveal: ['e-push'],
      tokens: [{ edge: 'e-push', label: del ? '- service.yaml' : 'image: 1.1' }],
      say: { dev: del ? bi('Разработчик удаляет service.yaml и отправляет коммит командой git push.', 'The developer deletes service.yaml and pushes the commit.') : bi('Разработчик отправляет коммит с новым образом командой git push.', 'The developer pushes the commit with the new image.') },
      values: { repo: 'main @ d4e5f6a' },
      states: hiddenAll(GIT_ALL.filter((id) => id !== 'dev' && id !== 'repo')),
      metrics: { replicas: 2, drift: 0, minutes: 0 },
    });
    if (broken.has('repo-down')) {
      steps.push({
        id: 'poll',
        label: bi('опрос', 'poll'),
        caption: bi('Контроллер пытается опросить репозиторий, но не находит сервер Git по имени. Он ничего не удаляет и не меняет, поэтому кластер остаётся в последнем известном состоянии.', 'The controller tries to poll the repository but cannot resolve the Git server name. It deletes and changes nothing, so the cluster stays in the last known state.'),
        focus: ['ctrl', 'e-poll'],
        reveal: ['ctrl', 'e-poll', 'app'],
        say: { ctrl: bi('Контроллер не может связаться с репозиторием и помечает состояние Application как неизвестное.', 'The controller cannot reach the repository and marks the Application state unknown.') },
        states: { 'e-poll': 'err', app: 'warn' },
        values: { app: 'Unknown · Healthy' },
        metrics: { replicas: 2, drift: 0, minutes: 3 },
        broken: { at: 'e-poll', message: 'ComparisonError: Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = failed to list refs: dial tcp: lookup forge.edu: no such host', caption: bi('Когда Git недоступен, приложение в кластере продолжает работать, а останавливаются только новые выкладки. В жизни эту поломку узнают по сообщению ComparisonError, в котором есть слова no such host.', 'When Git is unreachable, the application in the cluster keeps running and only new releases stop. In real life you recognise this break by ComparisonError with no such host.') },
      });
      return steps;
    }
    steps.push({
      id: 'poll',
      label: bi('опрос', 'poll'),
      caption: bi('Не позже чем через три минуты, а при настроенном вебхуке сразу, контроллер опрашивает репозиторий и находит новую ревизию d4e5f6a.', 'Within three minutes, or at once with a webhook, the controller polls the repository and finds the new revision d4e5f6a.'),
      focus: ['ctrl', 'e-poll', 'repo'],
      reveal: ['ctrl', 'e-poll'],
      tokens: [{ edge: 'e-poll', reverse: true, label: 'd4e5f6a' }],
      say: { ctrl: bi('Контроллер спрашивает репозиторий, нет ли новой ревизии, и получает коммит d4e5f6a.', 'The controller asks the repository for a new revision and gets commit d4e5f6a.') },
      metrics: { replicas: 2, drift: 1, minutes: 3 },
    });
    if (broken.has('bad-yaml')) {
      steps.push({
        id: 'compare',
        label: bi('ошибка', 'error'),
        caption: bi('Манифест deployment.yaml в новой ревизии не разбирается. Поэтому контроллер не применяет ни одного файла этой ревизии, и живые объекты остаются прежними.', 'The deployment.yaml manifest of the new revision does not parse. So the controller applies no file of this revision, and the live objects stay as they were.'),
        focus: ['ctrl', 'app'],
        reveal: ['app', 'e-app'],
        say: { ctrl: bi('Контроллер пытается собрать манифесты новой ревизии и не может разобрать строку 7 в файле deployment.yaml.', 'The controller tries to build the manifests of the new revision and cannot parse line 7 of deployment.yaml.') },
        states: { app: 'err', ctrl: 'err' },
        values: { app: 'Unknown · Healthy' },
        metrics: { replicas: 2, drift: 1, minutes: 3 },
        broken: { at: 'ctrl', message: "ComparisonError: Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = Manifest generation error (cached): error converting YAML to JSON: yaml: line 7: could not find expected ':'", caption: bi('Ревизия применяется целиком или не применяется вовсе. Поэтому манифесты проверяют в конвейере CI до слияния, а сообщение error converting YAML to JSON указывает на файл и строку, которые нужно исправить.', 'A revision is applied whole or not at all. That is why CI checks the manifests before the merge, and error converting YAML to JSON points at the file and line to fix.') },
      });
      return steps;
    }
    steps.push({
      id: 'compare',
      label: 'OutOfSync',
      caption: del
        ? bi('Контроллер сравнивает Git с кластером и находит Service shop, который принадлежит этому приложению, хотя файла этого объекта в Git больше нет. Значит, Service в кластере лишний, и по Git его нужно удалить.', 'The controller compares Git with the cluster and finds the Service shop that belongs to this application, although Git no longer has its file. So the Service in the cluster is extra, and by Git it has to be deleted.')
        : bi('Контроллер читает Application shop и сравнивает Git с кластером. В Git записан образ 1.1, а в кластере работает 1.0, поэтому контроллер помечает Application как OutOfSync.', 'The controller reads the Application shop and compares Git with the cluster. Git says image 1.1, while the cluster runs 1.0, so the controller marks the Application OutOfSync.'),
      focus: ['ctrl', 'app', 'e-app'],
      reveal: ['app', 'e-app', 'api', 'e-sync', 'e-live', 'deploy'],
      tokens: [{ edge: 'e-app', label: 'syncPolicy' }],
      say: { ctrl: del ? bi('Контроллер находит в кластере Service shop, файла которого в Git больше нет.', 'The controller finds the Service shop in the cluster, whose file Git no longer has.') : bi('Контроллер видит, что в Git записан образ 1.1, а в кластере работает 1.0.', 'The controller sees Git says image 1.1 while the cluster runs 1.0.') },
      values: { app: 'OutOfSync · Healthy' },
      states: { app: 'warn' },
      metrics: { replicas: 2, drift: 1, minutes: 3 },
    });
    if (!p.automated) {
      steps.push({
        id: 'wait',
        label: bi('ожидание', 'waiting'),
        caption: bi('Автоматическая синхронизация выключена, поэтому контроллер только показывает разницу. Синхронизацию запускает человек: кнопкой в интерфейсе Argo CD, командой argocd app sync или полем operation в Application.', 'Automated sync is off, so the controller only shows the difference. A person starts the sync: with a button in the Argo CD UI, with argocd app sync or with the operation field of the Application.'),
        focus: ['app'],
        say: { app: bi('Application shop остаётся в состоянии OutOfSync и ждёт, пока синхронизацию запустит человек.', 'The Application shop stays OutOfSync and waits for a person to start the sync.') },
        states: { app: 'warn' },
        metrics: { replicas: 2, drift: 1, minutes: 3 },
      });
      return steps;
    }
    if (del && !p.prune) {
      steps.push({
        id: 'sync',
        label: 'sync',
        caption: bi('Синхронизация применяет всё, что есть в Git, но без prune ничего не удаляет. Service остаётся в кластере с пометкой requiresPruning, а Application остаётся OutOfSync.', 'The sync applies everything Git has, but without prune it deletes nothing. The Service stays in the cluster marked requiresPruning, and the Application stays OutOfSync.'),
        focus: ['ctrl', 'e-sync', 'app'],
        tokens: [{ edge: 'e-sync', label: 'apply' }],
        say: { ctrl: bi('Контроллер синхронизирует приложение, но лишний Service не удаляет, потому что prune выключен.', 'The controller syncs the application but does not delete the extra Service, because prune is off.') },
        states: { app: 'warn' },
        metrics: { replicas: 2, drift: 1, minutes: 3 },
      });
      return steps;
    }
    if (del) {
      steps.push({
        id: 'pruned',
        label: 'prune',
        caption: bi('Поле prune разрешает контроллеру удалять объекты, файлы которых пропали из Git, поэтому он удаляет Service shop. Теперь кластер совпадает с Git, и Application становится Synced.', 'prune lets the controller delete the objects whose files left Git, so it deletes the Service shop. Now the cluster matches Git, and the Application is Synced.'),
        focus: ['ctrl', 'e-sync', 'api'],
        tokens: [{ edge: 'e-sync', label: 'delete svc/shop' }],
        say: { ctrl: bi('Контроллер удаляет Service shop через API-сервер, потому что его файла в Git больше нет.', 'The controller deletes the Service shop through the API server, because Git no longer has its file.') },
        values: { app: 'Synced · Healthy' },
        states: { app: 'ok' },
        metrics: { replicas: 2, drift: 0, minutes: 3.1 },
      });
      return steps;
    }
    steps.push({
      id: 'sync',
      label: 'sync',
      caption: bi('Политика разрешает синхронизацию без человека (automated), поэтому контроллер применяет deployment.yaml новой ревизии через API-сервер. В Deployment теперь записан образ 1.1, и начинается обычное поэтапное обновление подов.', 'The policy allows a sync without a person (automated), so the controller applies deployment.yaml of the new revision through the API server. The Deployment now says image 1.1, and an ordinary rolling update begins.'),
      focus: ['ctrl', 'e-sync', 'api', 'e-live', 'deploy'],
      tokens: [{ edge: 'e-sync', label: 'image: 1.1' }],
      say: { deploy: bi('Контроллер применил deployment.yaml из новой ревизии, и в Deployment shop теперь записан образ trainer/web:1.1.', 'The controller applied deployment.yaml from the new revision, and the Deployment shop now says trainer/web:1.1.') },
      values: { deploy: '2 × trainer/web:1.1', app: 'Synced · Progressing' },
      states: { deploy: 'on', app: 'wait' },
      metrics: { replicas: 2, drift: 0, minutes: 3.1 },
    });
    steps.push({
      id: 'healthy',
      label: 'Healthy',
      caption: bi('Контроллер Deployment заменил поды по одному, и поды новой версии готовы. Application стал Synced и Healthy, а вся выкладка заняла один коммит и ни одной команды kubectl.', 'The Deployment controller replaced the pods one by one, and the new pods are ready. The Application is Synced and Healthy, and the whole release took one commit and no kubectl command.'),
      focus: ['deploy', 'e-rs', 'pods'],
      reveal: ['pods', 'e-rs'],
      tokens: [{ edge: 'e-rs', label: 'trainer/web:1.1' }],
      say: { pods: bi('Два пода с образом trainer/web:1.1 запущены и отвечают, а старые поды остановлены.', 'Two pods with trainer/web:1.1 run and answer, and the old pods are stopped.') },
      values: { app: 'Synced · Healthy' },
      states: { deploy: 'ok', pods: 'ok', app: 'ok' },
      metrics: { replicas: 2, drift: 0, minutes: 4 },
    });
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Источник снова в порядке, и цикл доходит до совпадения с Git.', 'The source is fine again, and the loop reaches a match with Git.');
      if (!brokenAt(next)) return bi('Эта поломка не мешает выбранному событию, потому что ручная правка не проходит через репозиторий.', 'This break does not affect the chosen event, because a manual edit does not go through the repository.');
      return change.id === 'repo-down'
        ? bi('Git недоступен, но приложению это не вредит, потому что Argo CD не трогает кластер, пока не знает, каким кластер должен быть.', 'Git is unreachable, but the application does not suffer, because Argo CD does not touch the cluster while it does not know what the cluster should be.')
        : bi('Один сломанный манифест останавливает всю ревизию, потому что контроллер применяет ревизию целиком или не применяет её вовсе.', 'One broken manifest stops the whole revision, because the controller applies a revision whole or not at all.');
    }
    if (change.id === 'event') return bi('Другое событие проходит по схеме другим путём. Коммит контроллер находит, когда опрашивает репозиторий, а ручную правку в кластере он замечает сразу.', 'A different event takes a different path through the diagram. The controller finds a commit when it polls the repository and notices a manual edit in the cluster at once.');
    if (change.id === 'selfHeal') return fb(bi('В конце события в кластере {r} реплик. Поле selfHeal решает, переживёт ли ручная правка следующую сверку.', 'At the end of the event the cluster has {r} replicas. selfHeal decides whether a manual edit survives the next comparison.'), { r: metric(next, 'replicas') });
    if (change.id === 'prune')
      return next.some((s) => s.id === 'pruned')
        ? bi('С включённым prune удаление файла из Git удаляет объект и из кластера.', 'With prune on, deleting a file from Git deletes the object from the cluster too.')
        : bi('Без prune Argo CD сам ничего не удаляет, поэтому лишний объект остаётся в кластере с пометкой requiresPruning.', 'Without prune Argo CD deletes nothing by itself, so the extra object stays in the cluster marked requiresPruning.');
    return metric(prev, 'drift') !== metric(next, 'drift') || last(prev)?.id !== last(next)?.id
      ? (next.some((s) => s.id === 'wait' || s.id === 'stay')
        ? bi('Без automated контроллер видит разницу, но ждёт, пока синхронизацию запустит человек.', 'Without automated the controller sees the difference but waits for a person to start the sync.')
        : bi('С automated контроллер сам применяет разницу между Git и кластером.', 'With automated the controller applies the difference between Git and the cluster itself.'))
      : bi('Политика изменилась, но для выбранного события результат остался прежним.', 'The policy changed, but for the chosen event the result is the same.');
  },
});
