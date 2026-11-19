// Process explainers of block 9 (06 §6.3): E-K8S-CODE "from terraform apply
// to three Ready nodes" and E-GITOPS "a commit, the controller, the cluster".
// Both are small deterministic models: knobs recompute the run, breaks stop it
// where the real tool would stop, and the tool's real message is shown.

import { defineModel } from '../../core/define';
import { bi, fmt, type Bi } from '../../core/i18n';
import type { ColorFamily, DiagramEdge, DiagramNode, DocRef, ElementState, QText, Step } from '../../core/types';

function node(id: string, label: QText, family: ColorFamily, shape: DiagramNode['shape'], x: number, y: number, w: number, h: number, what: Bi, who: Bi, see?: string, doc?: DocRef, sub?: string): DiagramNode {
  return { id, label, family, shape, x, y, w, h, card: { what, who, ...(see ? { see } : {}), ...(doc ? { doc } : {}) }, ...(sub ? { sub } : {}) };
}

function edge(id: string, from: string, to: string, label: QText, what: Bi, who: Bi, o: { via?: [number, number][]; dashed?: boolean; labelAt?: number; see?: string; doc?: DocRef } = {}): DiagramEdge {
  return { id, from, to, label, card: { what, who, ...(o.see ? { see: o.see } : {}), ...(o.doc ? { doc: o.doc } : {}) }, ...(o.via ? { via: o.via } : {}), ...(o.dashed ? { dashed: true } : {}), ...(o.labelAt !== undefined ? { labelAt: o.labelAt } : {}) };
}

const last = (s: Step[]) => s[s.length - 1];
const metric = (s: Step[], k: string) => last(s)?.metrics?.[k] ?? 0;
const brokenAt = (s: Step[]) => s.find((x) => x.broken)?.broken?.at;

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

// ── E-K8S-CODE ──

type CodeP = { workers: number; forks: number; run: string; serial: string };

/** The arithmetic the steps show: VMs, minutes to Ready, VM-hours. */
export function codeNumbers(p: CodeP): { vms: number; prepMin: number; totalMin: number; vmHoursDay: number; vmHoursMonth: number } {
  const vms = 1 + p.workers;
  const prepMin = Math.ceil(vms / p.forks) * 3;
  const totalMin = 2 + prepMin + 2 + 1 + 1;
  return { vms, prepMin, totalMin, vmHoursDay: vms * 24, vmHoursMonth: vms * 730 };
}

export const codeModel = defineModel<CodeP>({
  id: 'k8s-3.from-code',
  block: 'k8s-3',
  title: bi('От terraform apply до трёх узлов Ready', 'From terraform apply to three Ready nodes'),
  summary: bi(
    'Код в репозитории заказывает машины, Ansible готовит их одинаково, kubeadm поднимает control plane, Cilium даёт сеть подов, рабочие узлы присоединяются. Меняйте число узлов, параллельность и прогон, ломайте звенья и смотрите, где цепочка остановится.',
    'Code in a repository orders the machines, Ansible prepares them the same way, kubeadm brings up the control plane, Cilium gives the pod network, the workers join. Change the number of nodes, the parallelism and the run, break links and see where the chain stops.',
  ),
  concepts: ['k8s.rebuildable', 'iac.count', 'iac.output', 'k8s.bootstrap-token', 'iac.creates'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      node('code', bi('репозиторий', 'repository'), 'ci-source', 'doc', 24, 24, 176, 72, bi('Всё, из чего собирается кластер: infra/*.tf, inventory из output, site.yml и роли. Пересоздать кластер — значит прогнать этот код ещё раз.', 'Everything the cluster is built from: infra/*.tf, the inventory from an output, site.yml and the roles. Rebuilding the cluster means running this code once more.'), bi('вы; изменения проходят ревью', 'you; changes go through review'), 'git log --oneline', undefined, 'infra/ · site.yml'),
      node('tf', 'terraform apply', 'process', 'box', 264, 24, 184, 72, bi('Сравнивает код со state и облаком и создаёт то, чего нет: сеть и ВМ. count = 2 даёт worker[0] и worker[1].', 'Compares the code with the state and the cloud and creates what is missing: the network and the VMs. count = 2 gives worker[0] and worker[1].'), bi('вы или конвейер', 'you or the pipeline'), 'terraform plan', DOC.count),
      node('cloud', bi('API облака', 'cloud API'), 'neutral', 'box', 520, 24, 168, 72, bi('Создаёт ВМ, выдаёт им адреса и вешает метки trainer=devops, по которым их потом найдут, посчитают и удалят.', 'Creates the VMs, gives them addresses and puts the trainer=devops labels on them, by which they are later found, counted and deleted.'), bi('провайдер', 'the provider'), 'edu vm list'),
      node('inv', 'inventory.ini', 'store', 'doc', 760, 24, 176, 72, bi('Инвентарь, который выдал Terraform: группы control_plane и workers, адреса и cp_endpoint. Его не пишут руками — после пересоздания адреса другие.', 'The inventory Terraform produced: the control_plane and workers groups, addresses and cp_endpoint. It is not written by hand: after a rebuild the addresses are different.'), bi('terraform output -raw inventory', 'terraform output -raw inventory'), 'terraform output -raw inventory', DOC.outputs),
      node('ans', 'ansible-playbook site.yml', 'process', 'box', 640, 168, 296, 64, bi('Приводит узлы к описанию: роли k8s_prereq, containerd, kube_packages на всех, kubeadm_init и cilium на control plane, kubeadm_join на рабочих.', 'Brings the nodes to the description: the k8s_prereq, containerd, kube_packages roles on all, kubeadm_init and cilium on the control plane, kubeadm_join on the workers.'), bi('вы или конвейер', 'you or the pipeline'), 'ansible-playbook --check site.yml'),
      node('cp', 'cp-1', 'node', 'rack', 40, 304, 240, 96, bi('Управляющий узел. После kubeadm init на нём лежат /etc/kubernetes/pki, admin.conf и манифесты статических подов.', 'The control-plane node. After kubeadm init it holds /etc/kubernetes/pki, admin.conf and the static pod manifests.'), bi('Terraform создал, Ansible подготовил', 'Terraform created it, Ansible prepared it'), 'ls /etc/kubernetes', DOC.init, 'prep · kubelet'),
      node('w1', 'worker-1', 'node', 'rack', 360, 304, 240, 96, bi('Рабочий узел. kubeadm join кладёт сюда kubelet.conf — по нему роль понимает, что узел уже в кластере.', 'A worker node. kubeadm join puts kubelet.conf here — this is how the role knows the node is already in the cluster.'), bi('Terraform создал, Ansible подготовил', 'Terraform created it, Ansible prepared it'), 'ls /etc/kubernetes', DOC.join, 'prep · kubelet'),
      node('w2', 'worker-2', 'node', 'rack', 680, 304, 240, 96, bi('Второй рабочий узел. Все рабочие узлы описаны одним ресурсом с count и одной ролью — они одинаковы по построению.', 'The second worker node. All workers are described by one resource with count and one role — they are identical by construction.'), bi('Terraform создал, Ansible подготовил', 'Terraform created it, Ansible prepared it'), 'ls /etc/kubernetes', DOC.join, 'prep · kubelet'),
      node('plane', bi('control plane: статические поды', 'control plane: static pods'), 'cp', 'hex', 40, 456, 400, 56, bi('etcd, kube-apiserver, controller-manager и scheduler, которые kubelet запустил из /etc/kubernetes/manifests.', 'etcd, kube-apiserver, controller-manager and scheduler, which the kubelet started from /etc/kubernetes/manifests.'), bi('kubeadm init', 'kubeadm init'), 'kubectl -n kube-system get pods', DOC.init),
      node('cni', 'Cilium', 'l3', 'pill', 520, 456, 400, 56, bi('Сеть подов: агент на каждом узле, конфигурация CNI в /etc/cni/net.d. Пока его нет, узлы NotReady, а CoreDNS ждёт в Pending.', 'The pod network: an agent on every node, the CNI config in /etc/cni/net.d. Until it is there, nodes are NotReady and CoreDNS waits in Pending.'), bi('роль cilium (cilium install)', 'the cilium role (cilium install)'), 'cilium status', DOC.cilium),
    ],
    edges: [
      edge('e-read', 'code', 'tf', bi('читает .tf', 'reads .tf'), bi('Terraform читает весь каталог: ресурсы, переменные, outputs.', 'Terraform reads the whole directory: resources, variables, outputs.'), bi('terraform', 'terraform')),
      edge('e-api', 'tf', 'cloud', bi('create VM', 'create VM'), bi('Вызовы API облака по плану: сначала сеть, потом ВМ — Terraform узнал порядок по ссылкам.', 'Cloud API calls by the plan: first the network, then the VMs — Terraform learned the order from the references.'), bi('провайдер Terraform', 'the Terraform provider')),
      edge('e-out', 'cloud', 'inv', 'output', bi('Адреса известны только после создания: output собирает их в готовый инвентарь.', 'Addresses are known only after creation: an output gathers them into a ready inventory.'), bi('terraform output', 'terraform output'), { doc: DOC.outputs }),
      edge('e-inv', 'inv', 'ans', bi('хосты', 'hosts'), bi('Ansible узнаёт из инвентаря, на какие машины идти и кто из них control plane.', 'Ansible learns from the inventory which machines to go to and which of them is the control plane.'), bi('ansible.cfg → inventory', 'ansible.cfg → inventory')),
      edge('e-ssh-cp', 'ans', 'cp', 'ssh', bi('Роли подготовки, затем kubeadm init с creates и cilium install.', 'The preparation roles, then kubeadm init with creates and cilium install.'), bi('Ansible по SSH', 'Ansible over SSH')),
      edge('e-ssh-w1', 'ans', 'w1', 'ssh', bi('Роли подготовки, затем kubeadm join с creates.', 'The preparation roles, then kubeadm join with creates.'), bi('Ansible по SSH', 'Ansible over SSH')),
      edge('e-ssh-w2', 'ans', 'w2', 'ssh', bi('Те же роли, что на worker-1, — параллельно, сколько позволяет forks.', 'The same roles as on worker-1 — in parallel, as far as forks allows.'), bi('Ansible по SSH', 'Ansible over SSH')),
      edge('e-init', 'cp', 'plane', 'kubeadm init', bi('Сертификаты, kubeconfig, манифесты; kubelet поднимает из них control plane.', 'Certificates, kubeconfigs, manifests; the kubelet brings the control plane up from them.'), bi('роль kubeadm_init', 'the kubeadm_init role'), { doc: DOC.init }),
      edge('e-join1', 'w1', 'plane', bi('join: токен', 'join: token'), bi('Узел предъявляет токен присоединения и получает сертификат kubelet (TLS bootstrap).', 'The node presents the bootstrap token and gets a kubelet certificate (TLS bootstrap).'), bi('роль kubeadm_join', 'the kubeadm_join role'), { doc: DOC.token, labelAt: 0.4 }),
      edge('e-join2', 'w2', 'plane', bi('join: токен', 'join: token'), bi('То же для второго рабочего узла: токен общий, срок жизни — 24 часа.', 'The same for the second worker: the token is shared, its lifetime is 24 hours.'), bi('роль kubeadm_join', 'the kubeadm_join role'), { doc: DOC.token, via: [[940, 410], [940, 526], [240, 526]], labelAt: 0.45 }),
      edge('e-cni', 'plane', 'cni', 'cilium install', bi('Cilium ставится через API кластера: DaemonSet с агентом на каждом узле.', 'Cilium is installed through the cluster API: a DaemonSet with an agent on every node.'), bi('роль cilium', 'the cilium role'), { doc: DOC.cilium }),
    ],
  },
  params: [
    {
      id: 'workers',
      label: bi('Рабочих узлов (count)', 'Workers (count)'),
      kind: 'range',
      min: 1,
      max: 4,
      step: 1,
      default: 2,
      near: 'tf',
      predict: {
        prompt: bi('count = 4 вместо 2. Сколько ВМ-часов наберёт стенд, если его забыть на месяц?', 'count = 4 instead of 2. How many VM-hours does the lab run up if it is forgotten for a month?'),
        options: [
          { id: 'same', text: bi('Столько же: рабочие узлы ничего не делают', 'The same: the workers do nothing') },
          { id: 'more', text: bi('Больше: каждая ВМ считается каждый час, работает она или нет', 'More: every VM is billed every hour, busy or not') },
        ],
        resolve: (prev, next) => (metric(next, 'month') > metric(prev, 'month') ? 'more' : 'same'),
      },
    },
    {
      id: 'forks',
      label: bi('forks у Ansible', 'Ansible forks'),
      kind: 'range',
      min: 1,
      max: 3,
      step: 1,
      default: 3,
      near: 'ans',
      predict: {
        prompt: bi('forks = 1. Что станет со временем подготовки узлов?', 'forks = 1. What happens to the node preparation time?'),
        options: [
          { id: 'longer', text: bi('Вырастет: узлы готовятся по одному', 'It grows: the nodes are prepared one at a time') },
          { id: 'same', text: bi('Не изменится: задачи те же', 'It stays the same: the tasks are the same') },
        ],
        resolve: (prev, next) => (metric(next, 'minutes') > metric(prev, 'minutes') ? 'longer' : 'same'),
      },
    },
    {
      id: 'run',
      label: bi('Какой прогон', 'Which run'),
      kind: 'choice',
      default: 'first',
      options: [
        { id: 'first', label: bi('первый: пустое облако', 'first: an empty cloud') },
        { id: 'second', label: bi('второй: ничего не изменилось', 'second: nothing changed') },
        { id: 'rebuild', label: bi('destroy → apply → плейбук', 'destroy → apply → playbook') },
        { id: 'upgrade', label: bi('обновление узлов', 'upgrading the nodes') },
      ],
      near: 'code',
      predict: {
        prompt: bi('Второй прогон того же кода на том же кластере. Сколько задач окажутся changed?', 'A second run of the same code on the same cluster. How many tasks are changed?'),
        options: [
          { id: 'zero', text: bi('Ноль: всё уже так, kubeadm пропускается по creates', 'Zero: everything is already so, kubeadm is skipped by creates') },
          { id: 'some', text: bi('Несколько: kubeadm init выполнится снова', 'Several: kubeadm init runs again') },
        ],
        resolve: (_p, next) => (brokenAt(next) ? 'some' : metric(next, 'changed') === 0 ? 'zero' : 'some'),
      },
    },
    {
      id: 'serial',
      label: bi('serial (обновление)', 'serial (upgrade)'),
      kind: 'choice',
      default: '1',
      options: [
        { id: '1', label: bi('1 — по одному узлу', '1 — one node at a time') },
        { id: 'all', label: bi('все узлы сразу', 'all nodes at once') },
      ],
      near: 'ans',
      predict: {
        prompt: bi('Обновляем все рабочие узлы сразу. Сколько реплик приложения останется готовыми в худший момент?', 'We upgrade all workers at once. How many application replicas stay ready at the worst moment?'),
        options: [
          { id: 'zero', text: bi('Ноль: все узлы одновременно в drain', 'Zero: all nodes are drained at the same time') },
          { id: 'some', text: bi('Хотя бы одна: Kubernetes не даст выгнать все', 'At least one: Kubernetes will not let them all be evicted') },
        ],
        resolve: (_p, next) => (Math.min(...next.map((s) => s.metrics?.replicas ?? 99)) === 0 ? 'zero' : 'some'),
      },
    },
  ],
  breaks: [
    {
      id: 'swap',
      label: bi('Роль k8s_prereq не убрала swap из fstab', 'The k8s_prereq role did not remove swap from fstab'),
      remove: ['e-init'],
      boundary: 'kernel',
      predict: {
        prompt: bi('swap включён. Где остановится цепочка?', 'Swap is on. Where does the chain stop?'),
        options: [
          { id: 'init', text: bi('На kubeadm init: проверки preflight', 'At kubeadm init: the preflight checks') },
          { id: 'later', text: bi('Позже: поды будут падать от нехватки памяти', 'Later: pods will crash for lack of memory') },
          { id: 'none', text: bi('Нигде: swap только помогает', 'Nowhere: swap only helps') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'cp' ? 'init' : 'none'),
      },
    },
    {
      id: 'nocreates',
      label: bi('У задачи kubeadm init нет creates', 'The kubeadm init task has no creates'),
      remove: [],
      boundary: 'process',
      predict: {
        prompt: bi('creates убрали. Что будет на первом прогоне и что на втором?', 'creates is gone. What happens on the first run and what on the second?'),
        options: [
          { id: 'second', text: bi('Первый пройдёт, второй упадёт на preflight', 'The first passes, the second fails at preflight') },
          { id: 'first', text: bi('Упадёт сразу', 'It fails right away') },
          { id: 'never', text: bi('Ничего не изменится', 'Nothing changes') },
        ],
        resolve: (_p, next) => (brokenAt(next) ? (next.some((s) => s.id === 'ready') || next.some((s) => s.id === 'skip') ? 'second' : 'first') : 'never'),
      },
    },
    {
      id: 'nocni',
      label: bi('Роль cilium выключена', 'The cilium role is switched off'),
      remove: ['cni', 'e-cni'],
      boundary: 'network',
      predict: {
        prompt: bi('Сети подов нет. В каком состоянии будут узлы?', 'There is no pod network. What state are the nodes in?'),
        options: [
          { id: 'notready', text: bi('NotReady, CoreDNS в Pending', 'NotReady, CoreDNS Pending') },
          { id: 'ready', text: bi('Ready: сеть нужна только приложениям', 'Ready: the network is only for applications') },
        ],
        resolve: () => 'notready',
      },
    },
    {
      id: 'stale-inventory',
      label: bi('cp_endpoint в инвентаре не тот (переписан руками или остался от старых машин)', 'cp_endpoint in the inventory is wrong (typed by hand or left from the old machines)'),
      remove: ['e-out'],
      boundary: 'network',
      predict: {
        prompt: bi('В inventory.ini неверный cp_endpoint. Где сломается?', 'inventory.ini has a wrong cp_endpoint. Where does it break?'),
        options: [
          { id: 'join', text: bi('На join: рабочие узлы идут к старому адресу control plane', 'At join: the workers go to the old control-plane address') },
          { id: 'tf', text: bi('На terraform apply', 'At terraform apply') },
          { id: 'none', text: bi('Нигде: адреса те же', 'Nowhere: the addresses are the same') },
        ],
        resolve: (_p, next) => (brokenAt(next) === 'e-join1' ? 'join' : 'none'),
      },
    },
  ],
  metrics: [
    { id: 'vms', label: bi('ВМ', 'VMs') },
    { id: 'minutes', label: bi('минут до Ready', 'minutes to Ready'), unit: 'min' },
    { id: 'changed', label: bi('задач changed', 'tasks changed') },
    { id: 'ready', label: bi('узлов Ready', 'nodes Ready') },
    { id: 'month', label: bi('ВМ-часов, если забыть на месяц', 'VM-hours if forgotten for a month') },
    { id: 'replicas', label: bi('готовых реплик', 'ready replicas') },
  ],
  run(p, broken): Step[] {
    const n = codeNumbers(p);
    const steps: Step[] = [];
    const W = p.workers;
    const sub = (k: number) => (W > 2 && k === 2 ? `worker-2…${W}` : undefined);
    const base = { vms: n.vms, month: n.vmHoursMonth, replicas: 3 };
    const hideW2: Record<string, ElementState> = W < 2 ? { w2: 'off', 'e-ssh-w2': 'off', 'e-join2': 'off' } : {};
    const w2v = sub(2) ? { w2: `${sub(2)} · ${W - 1} VM` } : {};
    if (p.run === 'upgrade') {
      steps.push({ id: 'plan', label: 'upgrade plan', caption: bi('Control plane уже на v1.37: kubeadm upgrade apply на cp-1. Теперь узлы: сначала drain, потом пакеты, kubeadm upgrade node, перезапуск kubelet, uncordon.', 'The control plane is already on v1.37: kubeadm upgrade apply on cp-1. Now the nodes: drain first, then packages, kubeadm upgrade node, a kubelet restart, uncordon.'), focus: ['cp', 'plane'], states: { cp: 'ok', plane: 'ok', ...hideW2 }, values: { cp: 'v1.37.1', w1: 'v1.36.4', w2: 'v1.36.4', ...w2v }, metrics: { ...base, ready: n.vms, changed: 0, minutes: 0 } });
      if (p.serial === 'all') {
        steps.push({ id: 'drain-all', label: 'drain ×' + W, caption: bi('serial: all — плей идёт по всем рабочим узлам одновременно: все в drain, поды приложения выселены отовсюду сразу.', 'serial: all — the play goes over all workers at once: all are drained, the application pods are evicted from everywhere at once.'), focus: ['w1', 'w2', 'ans'], tokens: [{ edge: 'e-ssh-w1' }, { edge: 'e-ssh-w2' }], states: { w1: 'warn', w2: 'warn' }, values: { w1: 'SchedulingDisabled', w2: 'SchedulingDisabled' }, metrics: { ...base, replicas: 0, ready: 1, changed: W, minutes: 4 } });
        steps.push({ id: 'up-all', label: 'uncordon', caption: bi('Узлы вернулись на v1.37, поды снова запущены. Но несколько минут приложение не отвечало никому.', 'The nodes are back on v1.37 and the pods run again. But for a few minutes the application answered nobody.'), focus: ['w1', 'w2'], states: { w1: 'ok', w2: 'ok' }, values: { w1: 'v1.37.1', w2: 'v1.37.1', ...w2v }, metrics: { ...base, replicas: 3, ready: n.vms, changed: W * 4, minutes: 8 } });
        return steps;
      }
      for (let k = 1; k <= W; k++) {
        const id = k === 1 ? 'w1' : 'w2';
        steps.push({ id: `drain-${k}`, label: `drain ${k}`, caption: fmt(bi('serial: 1 — только worker-{k}: drain выселяет его поды, они переезжают на соседей.', 'serial: 1 — only worker-{k}: drain evicts its pods, they move to the neighbours.'), { k }), focus: [id, k === 1 ? 'e-ssh-w1' : 'e-ssh-w2'], tokens: [{ edge: k === 1 ? 'e-ssh-w1' : 'e-ssh-w2' }], states: { [id]: 'warn' }, values: { [id]: 'SchedulingDisabled' }, metrics: { ...base, replicas: W === 1 ? 0 : 2, ready: n.vms - 1, changed: (k - 1) * 4, minutes: (k - 1) * 4 + 1 } });
        steps.push({ id: `up-${k}`, label: `uncordon ${k}`, caption: fmt(bi('worker-{k} на v1.37 и снова принимает поды; плей переходит к следующему узлу.', 'worker-{k} is on v1.37 and takes pods again; the play moves to the next node.'), { k }), focus: [id], states: { [id]: 'ok' }, values: { [id]: 'v1.37.1' }, metrics: { ...base, replicas: 3, ready: n.vms, changed: k * 4, minutes: k * 4 } });
      }
      return steps;
    }
    const second = p.run === 'second';
    const rebuild = p.run === 'rebuild';
    if (rebuild) steps.push({ id: 'destroy', label: 'destroy', caption: fmt(bi('terraform destroy: {v} ВМ и сеть удалены, state пуст. Кластера больше нет — но код остался.', 'terraform destroy: {v} VMs and the network are deleted, the state is empty. The cluster is gone — but the code stays.'), { v: n.vms }), focus: ['tf', 'cloud', 'cp', 'w1', 'w2'], states: { cp: 'off', w1: 'off', w2: 'off', plane: 'off', cni: 'off' }, metrics: { ...base, vms: 0, ready: 0, changed: 0, minutes: 0 } });
    steps.push({
      id: 'apply',
      label: 'apply',
      caption: second
        ? bi('terraform plan: No changes. Ресурсы в state совпадают с кодом и с облаком — Terraform ничего не трогает.', 'terraform plan: No changes. The resources in the state match the code and the cloud — Terraform touches nothing.')
        : fmt(bi('terraform apply создаёт сеть и {v} ВМ с меткой trainer=devops; адреса выдаёт облако.', 'terraform apply creates the network and {v} VMs with the trainer=devops label; the cloud hands out the addresses.'), { v: n.vms }),
      focus: ['code', 'tf', 'cloud', 'e-read', 'e-api'],
      tokens: second ? [] : [{ edge: 'e-api', label: `+${n.vms}` }],
      states: { tf: 'ok', cloud: 'ok', cp: 'on', w1: 'on', w2: 'on', ...hideW2 },
      values: { cp: rebuild ? '10.0.0.16' : '10.0.0.12', w1: rebuild ? '10.0.0.17' : '10.0.0.13', w2: rebuild ? '10.0.0.18' : '10.0.0.14', ...w2v },
      metrics: { ...base, ready: second ? n.vms : 0, changed: 0, minutes: second ? 0 : 2 },
    });
    const stale = !second && broken.has('stale-inventory');
    const oldIp = rebuild ? '10.0.0.12' : '10.0.0.21';
    if (stale) {
      steps.push({ id: 'inv-old', label: 'inventory', caption: rebuild ? bi('inventory.ini остался от прошлых машин: в нём cp_endpoint=10.0.0.12:6443, а control plane теперь на 10.0.0.16.', 'inventory.ini is left over from the old machines: it says cp_endpoint=10.0.0.12:6443, while the control plane is now on 10.0.0.16.') : bi('inventory.ini написан руками, и в cp_endpoint опечатка: 10.0.0.21 вместо 10.0.0.12.', 'inventory.ini was written by hand, and cp_endpoint has a typo: 10.0.0.21 instead of 10.0.0.12.'), focus: ['inv'], states: { inv: 'warn', 'e-out': 'off' }, metrics: { ...base, ready: 0, changed: 0, minutes: 2 } });
    } else {
      steps.push({ id: 'inventory', label: 'output', caption: bi('terraform output -raw inventory > inventory.ini: группы, адреса и cp_endpoint попадают к Ansible без ручного копирования.', 'terraform output -raw inventory > inventory.ini: the groups, the addresses and cp_endpoint reach Ansible with no manual copying.'), focus: ['e-out', 'inv'], tokens: [{ edge: 'e-out', label: 'inventory' }], states: { inv: 'ok' }, metrics: { ...base, ready: second ? n.vms : 0, changed: 0, minutes: second ? 0 : 2 } });
    }
    const prepChanged = second ? 0 : 6 * n.vms;
    steps.push({
      id: 'prepare',
      label: 'prepare',
      caption: second
        ? bi('Роли подготовки проходят все узлы: swap уже выключен, модули и sysctl на месте, пакеты стоят — всё ok.', 'The preparation roles go over every node: swap is already off, the modules and sysctl are in place, the packages are installed — all ok.')
        : fmt(bi('Ansible готовит узлы по {f} за раз: swap, модули ядра, ip_forward, containerd с драйвером cgroup systemd, пакеты закреплённой версии. На это уходит {m} мин.', 'Ansible prepares the nodes {f} at a time: swap, kernel modules, ip_forward, containerd with the systemd cgroup driver, packages of the pinned version. It takes {m} min.'), { f: p.forks, m: n.prepMin }),
      focus: ['ans', 'e-inv', 'e-ssh-cp', 'e-ssh-w1', 'e-ssh-w2'],
      tokens: [{ edge: 'e-ssh-cp' }, { edge: 'e-ssh-w1' }, ...(W >= 2 ? [{ edge: 'e-ssh-w2' }] : [])],
      states: { ans: 'on', cp: 'ok', w1: 'ok', w2: W >= 2 ? 'ok' : 'off' },
      values: broken.has('swap') ? { cp: 'swap on!' } : {},
      metrics: { ...base, ready: second ? n.vms : 0, changed: prepChanged, minutes: second ? 1 : 2 + n.prepMin },
    });
    if (broken.has('swap')) {
      steps.push({ id: 'init', label: 'init', caption: bi('kubeadm init начинает с проверок preflight и останавливается: kubelet по умолчанию не работает со swap.', 'kubeadm init starts with the preflight checks and stops: by default the kubelet does not run with swap.'), focus: ['cp', 'e-init'], states: { cp: 'err', 'e-init': 'err' }, metrics: { ...base, ready: 0, changed: prepChanged, minutes: 2 + n.prepMin }, broken: { at: 'cp', message: 'error execution phase preflight: [preflight] Some fatal errors occurred:\n\t[ERROR Swap]: running with swap on is not supported. Please disable swap', caption: bi('роль подготовки — первая линия: kubeadm проверяет узел, а не исправляет его.', 'the preparation role is the first line: kubeadm checks the node, it does not fix it.') } });
      return steps;
    }
    if (second) {
      if (broken.has('nocreates')) {
        steps.push({ id: 'init', label: 'init', caption: bi('Без creates задача kubeadm init выполняется снова — на узле, который уже control plane. Preflight видит занятые порты и чужие манифесты.', 'Without creates the kubeadm init task runs again — on a node that is already a control plane. Preflight sees busy ports and existing manifests.'), focus: ['cp', 'e-init'], states: { cp: 'err', 'e-init': 'err' }, metrics: { ...base, ready: n.vms, changed: 0, minutes: 1 }, broken: { at: 'cp', message: 'error execution phase preflight: [preflight] Some fatal errors occurred:\n\t[ERROR Port-6443]: Port 6443 is in use\n\t[ERROR FileAvailable--etc-kubernetes-manifests-kube-apiserver.yaml]: /etc/kubernetes/manifests/kube-apiserver.yaml already exists', caption: bi('команда без модуля не знает, что её цель уже достигнута; creates говорит ей это.', 'a command without a module does not know its goal is already reached; creates tells it.') } });
        return steps;
      }
      steps.push({ id: 'skip', label: 'creates', caption: bi('kubeadm init и kubeadm join пропущены: файлы admin.conf и kubelet.conf уже есть (creates). Cilium пропущен по своему файлу в /etc/cni/net.d.', 'kubeadm init and kubeadm join are skipped: admin.conf and kubelet.conf already exist (creates). Cilium is skipped by its file in /etc/cni/net.d.'), focus: ['cp', 'w1', 'w2'], states: { plane: 'ok', cni: broken.has('nocni') ? 'off' : 'ok' }, metrics: { ...base, ready: broken.has('nocni') ? 0 : n.vms, changed: 0, minutes: 1 } });
      steps.push({ id: 'ready', label: 'changed=0', caption: bi('PLAY RECAP: changed=0 на каждом узле. Код описывает состояние, и кластер в нём уже находится.', 'PLAY RECAP: changed=0 on every node. The code describes a state, and the cluster is already in it.'), focus: ['ans'], states: { ans: 'ok' }, metrics: { ...base, ready: broken.has('nocni') ? 0 : n.vms, changed: 0, minutes: 1 } });
      return steps;
    }
    steps.push({ id: 'init', label: 'init', caption: bi('Роль kubeadm_init: kubeadm init --config пишет сертификаты, kubeconfig и манифесты; kubelet поднимает control plane. Появился /etc/kubernetes/admin.conf — условие creates на будущее.', 'The kubeadm_init role: kubeadm init --config writes certificates, kubeconfigs and manifests; the kubelet brings up the control plane. /etc/kubernetes/admin.conf appeared — the creates condition for the future.'), focus: ['cp', 'e-init', 'plane'], tokens: [{ edge: 'e-init' }], states: { plane: 'ok', cp: 'ok' }, values: { cp: 'control-plane · NotReady' }, metrics: { ...base, ready: 0, changed: prepChanged + 2, minutes: 4 + n.prepMin } });
    if (!broken.has('nocni')) steps.push({ id: 'cni', label: 'cilium', caption: bi('Роль cilium ставит сеть подов. Агент Cilium запускается на каждом узле, CoreDNS выходит из Pending.', 'The cilium role installs the pod network. The Cilium agent starts on every node, CoreDNS leaves Pending.'), focus: ['e-cni', 'cni'], tokens: [{ edge: 'e-cni' }], states: { cni: 'ok' }, values: { cp: 'control-plane · Ready' }, metrics: { ...base, ready: 1, changed: prepChanged + 3, minutes: 5 + n.prepMin } });
    if (stale) {
      steps.push({ id: 'join', label: 'join', caption: bi('Рабочие узлы идут по адресу из cp_endpoint — там никого нет.', 'The workers go to the address in cp_endpoint — nobody is there.'), focus: ['w1', 'e-join1'], states: { w1: 'err', 'e-join1': 'err', w2: 'err' }, metrics: { ...base, ready: 1, changed: prepChanged + 3, minutes: 6 + n.prepMin }, broken: { at: 'e-join1', message: `error execution phase preflight: couldn't validate the identity of the API Server: failed to request the cluster-info ConfigMap: Get "https://${oldIp}:6443/api/v1/namespaces/kube-public/configmaps/cluster-info?timeout=10s": dial tcp ${oldIp}:6443: connect: connection refused`, caption: bi('всё, что зависит от адресов, берут из terraform output, а не переписывают руками.', 'everything that depends on addresses is taken from terraform output, not copied by hand.') } });
      return steps;
    }
    const ready = broken.has('nocni') ? 0 : n.vms;
    steps.push({ id: 'join', label: 'join', caption: fmt(bi('Роль kubeadm_join: {w} рабочих узла предъявляют токен присоединения и регистрируются. Появился kubelet.conf — условие creates.', 'The kubeadm_join role: {w} workers present the bootstrap token and register. kubelet.conf appeared — the creates condition.'), { w: W }), focus: ['w1', 'w2', 'e-join1', 'e-join2'], tokens: [{ edge: 'e-join1' }, ...(W >= 2 ? [{ edge: 'e-join2' }] : [])], states: { w1: 'ok', w2: W >= 2 ? 'ok' : 'off' }, metrics: { ...base, ready: broken.has('nocni') ? 0 : n.vms, changed: prepChanged + 3 + W, minutes: n.totalMin + n.prepMin - n.prepMin } });
    if (broken.has('nocni')) {
      steps.push({ id: 'notready', label: 'NotReady', caption: bi('Все узлы в кластере, но NotReady: kubelet ждёт конфигурацию CNI, CoreDNS в Pending.', 'Every node is in the cluster but NotReady: the kubelet waits for a CNI config, CoreDNS is Pending.'), focus: ['cp', 'w1', 'w2'], states: { cp: 'warn', w1: 'warn', w2: W >= 2 ? 'warn' : 'off' }, values: { cp: 'NotReady', w1: 'NotReady', w2: 'NotReady' }, metrics: { ...base, ready: 0, changed: prepChanged + 2 + W, minutes: n.totalMin }, broken: { at: 'cni', message: 'container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized', caption: bi('kubeadm намеренно не ставит сеть подов: её выбирают и ставят отдельно.', 'kubeadm deliberately does not install a pod network: it is chosen and installed separately.') } });
      return steps;
    }
    steps.push({ id: 'ready', label: 'Ready', caption: fmt(bi('{v} узла Ready за {m} мин — из пустого облака, без единого ручного шага. Такой кластер не жалко удалить: он поднимается снова той же командой.', '{v} nodes Ready in {m} min — from an empty cloud, without a single manual step. Such a cluster is no loss to delete: the same command brings it back.'), { v: n.vms, m: n.totalMin }), focus: ['cp', 'w1', 'w2', 'cni'], states: { cp: 'ok', w1: 'ok', w2: W >= 2 ? 'ok' : 'off' }, values: { cp: 'Ready', w1: 'Ready', w2: W > 2 ? `${W - 1} × Ready` : 'Ready' }, metrics: { ...base, ready, changed: prepChanged + 3 + W, minutes: n.totalMin } });
    if (broken.has('nocreates')) {
      steps.push({ id: 'again', label: bi('ещё раз', 'again'), caption: bi('Контрольный второй прогон: без creates задача kubeadm init выполняется на узле, который уже control plane, и preflight её останавливает.', 'The check run: without creates the kubeadm init task runs on a node that is already a control plane, and preflight stops it.'), focus: ['cp', 'e-init'], states: { cp: 'err', 'e-init': 'err' }, metrics: { ...base, ready, changed: 0, minutes: n.totalMin + 1 }, broken: { at: 'cp', message: 'error execution phase preflight: [preflight] Some fatal errors occurred:\n\t[ERROR Port-6443]: Port 6443 is in use\n\t[ERROR FileAvailable--etc-kubernetes-manifests-kube-apiserver.yaml]: /etc/kubernetes/manifests/kube-apiserver.yaml already exists', caption: bi('команда без модуля не знает, что её цель уже достигнута; creates говорит ей это.', 'a command without a module does not know its goal is already reached; creates tells it.') } });
      return steps;
    }
    steps.push({ id: 'again', label: 'changed=0', caption: bi('Контрольный второй прогон: kubeadm init и join пропущены по creates, PLAY RECAP — changed=0. Код описывает состояние, а не действия.', 'The check run: kubeadm init and join are skipped by creates, PLAY RECAP says changed=0. The code describes a state, not actions.'), focus: ['ans'], states: { ans: 'ok' }, metrics: { ...base, ready, changed: 0, minutes: n.totalMin + 1 } });
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Звено вернули: цепочка снова доходит до конца.', 'The link is back: the chain runs to the end again.');
      const at = brokenAt(next);
      if (change.id === 'nocreates') return bi('Первый прогон проходит: файла ещё нет, и creates ничего бы не изменил. Ломается контрольный второй — kubeadm init второй раз на готовом control plane.', 'The first run passes: there is no file yet, and creates would change nothing. The check run breaks — kubeadm init a second time on a ready control plane.');
      if (change.id === 'stale-inventory' && !at) return bi('Во втором прогоне join пропущен по creates, поэтому неверный адрес не проявился. Он ударит при первом же новом узле.', 'In the second run join is skipped by creates, so the wrong address did not show. It hits with the very first new node.');
      return at ? bi('Цепочка остановилась на сломанном звене — посмотрите сообщение настоящего инструмента под схемой.', 'The chain stopped at the broken link — see the real tool’s message under the diagram.') : bi('Поломка не мешает этому прогону.', 'The break does not affect this run.');
    }
    if (change.id === 'workers') return fmt(bi('ВМ стало {v}: месяц забытого стенда — {h} ВМ-часов. Каждая ВМ тарифицируется каждый час, работает она или нет.', 'There are now {v} VMs: a forgotten month is {h} VM-hours. Every VM is billed every hour, busy or not.'), { v: metric(next, 'vms'), h: metric(next, 'month') });
    if (change.id === 'forks') return fmt(bi('Подготовка идёт по {f} узла за раз: до Ready {m} мин вместо {p}.', 'Preparation goes {f} nodes at a time: {m} min to Ready instead of {p}.'), { f: change.to as number, m: metric(next, 'minutes'), p: metric(prev, 'minutes') });
    if (change.id === 'serial') return Math.min(...next.map((s) => s.metrics?.replicas ?? 99)) === 0 ? bi('Все узлы в drain одновременно: в худший момент готовых реплик ноль. serial: 1 обновляет по узлу и держит приложение живым.', 'All nodes are drained at once: at the worst moment zero replicas are ready. serial: 1 upgrades one node at a time and keeps the application alive.') : bi('По одному узлу: поды переезжают к соседям, приложение отвечает всё время.', 'One node at a time: the pods move to the neighbours, the application answers all the time.');
    return metric(next, 'changed') === 0 && !brokenAt(next) ? bi('Второй прогон ничего не меняет: так проверяют, что код описывает состояние, а не действия.', 'The second run changes nothing: this is how you check that the code describes a state, not actions.') : bi('Прогон пересчитан: смотрите шаги и счётчики.', 'The run is recomputed: look at the steps and the counters.');
  },
});

// ── E-GITOPS ──

type GitP = { automated: boolean; selfHeal: boolean; prune: boolean; event: string };

export const gitopsModel = defineModel<GitP>({
  id: 'k8s-3.gitops-loop',
  block: 'k8s-3',
  title: bi('Цикл GitOps: коммит, контроллер, кластер', 'The GitOps loop: a commit, the controller, the cluster'),
  summary: bi(
    'Argo CD — ещё один контроллер с циклом согласования: желаемое состояние он берёт не из API, а из Git. Выберите событие, включайте и выключайте политику синхронизации, ломайте источник и смотрите, кто и когда меняет кластер.',
    'Argo CD is one more controller with a reconcile loop: it takes the desired state not from the API but from Git. Choose an event, switch the sync policy on and off, break the source and see who changes the cluster and when.',
  ),
  concepts: ['cicd.gitops-pull', 'k8s.argocd-app', 'k8s.sync-policy'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      node('dev', bi('вы: git push', 'you: git push'), 'user', 'pill', 24, 40, 200, 48, bi('Выкладка — это коммит в репозиторий манифестов, прошедший ревью. Доступ к кластеру для выкладки людям не нужен.', 'A release is a reviewed commit to the manifests repository. People do not need cluster access to release.'), bi('разработчик или конвейер CI', 'a developer or the CI pipeline'), 'git log --oneline -3'),
      node('repo', bi('Git: k8s/*.yaml', 'Git: k8s/*.yaml'), 'ci-source', 'doc', 312, 24, 208, 80, bi('Единственный источник желаемого состояния: манифесты в каталоге path на ревизии targetRevision.', 'The single source of the desired state: the manifests in the path directory at the targetRevision.'), bi('репозиторий shop-deploy', 'the shop-deploy repository'), 'git show --stat HEAD', DOC.argoApp, 'main @ a1b2c3d'),
      node('ctrl', bi('Argo CD: контроллер', 'Argo CD: controller'), 'cp', 'hex', 608, 32, 240, 64, bi('Сравнивает манифесты из Git с объектами в кластере. По политике синхронизации применяет разницу сам или только показывает OutOfSync.', 'Compares the manifests from Git with the objects in the cluster. By the sync policy it applies the difference itself or only shows OutOfSync.'), bi('Deployment argocd-application-controller', 'the argocd-application-controller Deployment'), 'kubectl -n argocd get pods', DOC.argo),
      node('app', 'Application shop', 'obj', 'doc', 608, 160, 240, 72, bi('Объект, который говорит контроллеру: что (repoURL, path, targetRevision), куда (destination) и как (syncPolicy). В status — Synced/OutOfSync и Healthy/Degraded.', 'The object that tells the controller what (repoURL, path, targetRevision), where (destination) and how (syncPolicy). Its status holds Synced/OutOfSync and Healthy/Degraded.'), bi('вы, kubectl apply в namespace argocd', 'you, kubectl apply in the argocd namespace'), 'kubectl -n argocd get application shop -o yaml', DOC.argoApp, 'Synced · Healthy'),
      node('api', bi('API-сервер', 'API server'), 'cp', 'hex', 312, 184, 208, 56, bi('Через него контроллер читает живые объекты и применяет изменения, как любой другой клиент.', 'Through it the controller reads live objects and applies changes, like any other client.'), bi('control plane', 'the control plane'), 'kubectl get --raw /readyz'),
      node('deploy', 'Deployment shop', 'obj', 'doc', 312, 304, 208, 72, bi('Живой объект в namespace shop. Его spec должен совпадать с файлом из Git — иначе OutOfSync.', 'The live object in the shop namespace. Its spec must match the file from Git — otherwise OutOfSync.'), bi('Argo CD', 'Argo CD'), 'kubectl -n shop get deploy shop -o yaml', undefined, '2 × trainer/web:1.0'),
      node('pods', bi('поды', 'pods'), 'node', 'rack', 608, 304, 240, 72, bi('Поды, которые сделал контроллер Deployment. Argo CD их не трогает: он отвечает только за объекты из Git.', 'The pods the Deployment controller made. Argo CD does not touch them: it is responsible only for the objects from Git.'), bi('ReplicaSet', 'the ReplicaSet'), 'kubectl -n shop get pods'),
      node('human', bi('коллега: kubectl', 'a colleague: kubectl'), 'user', 'pill', 24, 312, 200, 48, bi('Ручная правка мимо Git: kubectl scale или edit. Для GitOps это дрейф, такой же, как ручная правка ВМ в консоли облака.', 'A manual edit behind Git’s back: kubectl scale or edit. For GitOps it is drift, the same as a manual VM edit in the cloud console.'), bi('человек с доступом к кластеру', 'a person with cluster access'), 'kubectl -n shop scale deploy shop --replicas=5'),
    ],
    edges: [
      edge('e-push', 'dev', 'repo', 'git push', bi('Новая ревизия ветки main.', 'A new revision of the main branch.'), bi('git', 'git')),
      edge('e-poll', 'ctrl', 'repo', bi('опрос: 3 мин', 'poll: 3 min'), bi('Контроллер сам ходит в репозиторий: раз в три минуты или сразу по вебхуку. Кластер тянет изменения, а не получает их снаружи.', 'The controller goes to the repository itself: every three minutes, or at once on a webhook. The cluster pulls changes instead of receiving them from outside.'), bi('repo-server Argo CD', 'the Argo CD repo-server'), { doc: DOC.argo }),
      edge('e-app', 'app', 'ctrl', bi('что и как', 'what and how'), bi('Контроллер читает Application: источник, назначение и политику.', 'The controller reads the Application: the source, the destination and the policy.'), bi('Argo CD', 'Argo CD'), { doc: DOC.argoApp }),
      edge('e-sync', 'ctrl', 'api', 'apply', bi('Синхронизация — это apply манифестов из Git через API, с аннотацией tracking-id.', 'A sync is an apply of the manifests from Git through the API, with the tracking-id annotation.'), bi('Argo CD', 'Argo CD'), { via: [[560, 64], [560, 212]], labelAt: 0.5 }),
      edge('e-live', 'api', 'deploy', bi('живое', 'live'), bi('Объекты, которые реально лежат в кластере.', 'The objects that really are in the cluster.'), bi('API-сервер', 'the API server')),
      edge('e-rs', 'deploy', 'pods', 'ReplicaSet', bi('Дальше работает обычный цикл согласования Deployment.', 'From here the ordinary Deployment reconcile loop works.'), bi('kube-controller-manager', 'kube-controller-manager')),
      edge('e-edit', 'human', 'deploy', 'kubectl scale', bi('Правка мимо Git меняет живой объект; Git о ней не знает.', 'An edit behind Git’s back changes the live object; Git does not know about it.'), bi('коллега', 'a colleague'), { dashed: true }),
    ],
  },
  params: [
    {
      id: 'event',
      label: bi('Что случилось', 'What happened'),
      kind: 'choice',
      default: 'commit',
      options: [
        { id: 'commit', label: bi('коммит: образ 1.1', 'a commit: image 1.1') },
        { id: 'edit', label: bi('ручной kubectl scale --replicas=5', 'a manual kubectl scale --replicas=5') },
        { id: 'delete', label: bi('из Git удалили service.yaml', 'service.yaml was deleted from Git') },
      ],
      near: 'dev',
    },
    {
      id: 'automated',
      label: bi('automated', 'automated'),
      kind: 'toggle',
      default: true,
      near: 'app',
      predict: {
        prompt: bi('automated выключили. Что станет с новым коммитом?', 'automated is off. What happens to a new commit?'),
        options: [
          { id: 'wait', text: bi('Application станет OutOfSync и будет ждать ручного sync', 'The Application becomes OutOfSync and waits for a manual sync') },
          { id: 'apply', text: bi('Всё равно выкатится через три минуты', 'It rolls out anyway in three minutes') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'sync') ? 'apply' : 'wait'),
      },
    },
    {
      id: 'selfHeal',
      label: bi('selfHeal', 'selfHeal'),
      kind: 'toggle',
      default: true,
      near: 'ctrl',
      predict: {
        prompt: bi('selfHeal выключили, коллега сделал kubectl scale --replicas=5. Сколько реплик будет через минуту?', 'selfHeal is off and a colleague ran kubectl scale --replicas=5. How many replicas are there a minute later?'),
        options: [
          { id: '5', text: bi('5: Argo CD покажет OutOfSync, но править не станет', '5: Argo CD shows OutOfSync but does not fix it') },
          { id: '2', text: bi('2: Argo CD вернёт как в Git', '2: Argo CD brings it back as in Git') },
        ],
        resolve: (_p, next) => String(last(next)?.metrics?.replicas ?? 2),
      },
    },
    {
      id: 'prune',
      label: bi('prune', 'prune'),
      kind: 'toggle',
      default: false,
      near: 'ctrl',
      predict: {
        prompt: bi('prune включили, из Git удалили service.yaml. Что будет с Service в кластере?', 'prune is on and service.yaml was deleted from Git. What happens to the Service in the cluster?'),
        options: [
          { id: 'gone', text: bi('Удалится', 'It is deleted') },
          { id: 'stays', text: bi('Останется, Application OutOfSync', 'It stays, the Application is OutOfSync') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'pruned') ? 'gone' : 'stays'),
      },
    },
  ],
  breaks: [
    {
      id: 'repo-down',
      label: bi('Репозиторий недоступен', 'The repository is unreachable'),
      remove: ['e-poll'],
      boundary: 'network',
      predict: {
        prompt: bi('Git недоступен. Что будет с приложением в кластере?', 'Git is unreachable. What happens to the application in the cluster?'),
        options: [
          { id: 'keeps', text: bi('Работает как было; Argo CD пишет ComparisonError', 'It keeps running as it was; Argo CD reports a ComparisonError') },
          { id: 'deleted', text: bi('Argo CD удалит его: желаемого состояния нет', 'Argo CD deletes it: there is no desired state') },
        ],
        resolve: () => 'keeps',
      },
    },
    {
      id: 'bad-yaml',
      label: bi('В коммите сломанный YAML', 'The commit has broken YAML'),
      remove: ['e-sync'],
      boundary: 'io',
      predict: {
        prompt: bi('В deployment.yaml пропало двоеточие. Что выкатится?', 'A colon is missing in deployment.yaml. What rolls out?'),
        options: [
          { id: 'nothing', text: bi('Ничего: манифест не собрался, живое не тронуто', 'Nothing: the manifest did not build, the live state is untouched') },
          { id: 'partial', text: bi('Часть файлов, которые прочитались', 'The part of the files that parsed') },
        ],
        resolve: () => 'nothing',
      },
    },
  ],
  metrics: [
    { id: 'replicas', label: bi('реплик в кластере', 'replicas in the cluster') },
    { id: 'drift', label: bi('объектов не как в Git', 'objects not as in Git') },
    { id: 'minutes', label: bi('минут до совпадения', 'minutes to match'), unit: 'min' },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    if (p.event === 'edit') {
      steps.push({ id: 'edit', label: 'kubectl scale', caption: bi('Коллега руками ставит 5 реплик. В Git по-прежнему 2.', 'A colleague sets 5 replicas by hand. Git still says 2.'), focus: ['human', 'e-edit', 'deploy'], tokens: [{ edge: 'e-edit', label: 'replicas: 5' }], values: { deploy: '5 × trainer/web:1.0' }, states: { deploy: 'warn' }, metrics: { replicas: 5, drift: 1, minutes: 0 } });
      steps.push({ id: 'compare', label: 'OutOfSync', caption: bi('Контроллер следит за живыми объектами: spec.replicas не как в Git — Application OutOfSync.', 'The controller watches the live objects: spec.replicas is not as in Git — the Application is OutOfSync.'), focus: ['ctrl', 'e-sync', 'app'], values: { app: 'OutOfSync · Healthy' }, states: { app: 'warn' }, metrics: { replicas: 5, drift: 1, minutes: 0 } });
      if (p.automated && p.selfHeal) {
        steps.push({ id: 'heal', label: 'selfHeal', caption: bi('selfHeal: через несколько секунд контроллер применяет файл из Git, и реплик снова 2. Ручная правка не переживает цикл.', 'selfHeal: a few seconds later the controller applies the file from Git, and there are 2 replicas again. A manual edit does not survive the loop.'), focus: ['ctrl', 'e-sync', 'deploy'], tokens: [{ edge: 'e-sync', label: 'replicas: 2' }], values: { deploy: '2 × trainer/web:1.0', app: 'Synced · Healthy' }, states: { deploy: 'ok', app: 'ok' }, metrics: { replicas: 2, drift: 0, minutes: 0.1 } });
      } else {
        steps.push({ id: 'stay', label: bi('висит', 'stays'), caption: bi('Без selfHeal контроллер только показывает расхождение. Оно останется, пока кто-то не синхронизирует или не поправит Git.', 'Without selfHeal the controller only shows the difference. It stays until someone syncs or changes Git.'), focus: ['app'], states: { app: 'warn' }, metrics: { replicas: 5, drift: 1, minutes: 0 } });
      }
      return steps;
    }
    const del = p.event === 'delete';
    steps.push({ id: 'push', label: 'push', caption: del ? bi('Коммит удаляет k8s/service.yaml: сервис больше не нужен.', 'A commit deletes k8s/service.yaml: the service is no longer needed.') : bi('Коммит меняет образ на trainer/web:1.1 и проходит ревью.', 'A commit changes the image to trainer/web:1.1 and passes review.'), focus: ['dev', 'e-push', 'repo'], tokens: [{ edge: 'e-push', label: del ? '- service.yaml' : 'image: 1.1' }], values: { repo: 'main @ d4e5f6a' }, metrics: { replicas: 2, drift: 0, minutes: 0 } });
    if (broken.has('repo-down')) {
      steps.push({ id: 'poll', label: bi('опрос', 'poll'), caption: bi('Контроллер не может достучаться до репозитория. Он ничего не удаляет и не меняет: кластер остаётся в последнем известном состоянии.', 'The controller cannot reach the repository. It deletes and changes nothing: the cluster stays in the last known state.'), focus: ['ctrl', 'e-poll'], states: { 'e-poll': 'err', app: 'warn' }, values: { app: 'Unknown · Healthy' }, metrics: { replicas: 2, drift: 0, minutes: 3 }, broken: { at: 'e-poll', message: 'ComparisonError: Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = failed to list refs: dial tcp: lookup forge.edu: no such host', caption: bi('при недоступном Git кластер не страдает — страдает только скорость выкладок.', 'with Git unreachable the cluster does not suffer — only the release speed does.') } });
      return steps;
    }
    steps.push({ id: 'poll', label: bi('опрос', 'poll'), caption: bi('Не позже чем через три минуты (или сразу по вебхуку) контроллер видит новую ревизию.', 'Within three minutes (or at once on a webhook) the controller sees the new revision.'), focus: ['ctrl', 'e-poll', 'repo'], tokens: [{ edge: 'e-poll', reverse: true, label: 'd4e5f6a' }], metrics: { replicas: 2, drift: 1, minutes: 3 } });
    if (broken.has('bad-yaml')) {
      steps.push({ id: 'compare', label: bi('ошибка', 'error'), caption: bi('Манифест не разбирается. Контроллер не применяет ни одного файла этой ревизии.', 'The manifest does not parse. The controller applies no file of this revision.'), focus: ['ctrl', 'app'], states: { app: 'err', 'e-sync': 'off' }, values: { app: 'Unknown · Healthy' }, metrics: { replicas: 2, drift: 1, minutes: 3 }, broken: { at: 'ctrl', message: 'ComparisonError: Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = Manifest generation error (cached): error converting YAML to JSON: yaml: line 7: could not find expected \':\'', caption: bi('ревизия применяется целиком или никак — поэтому манифесты проверяют в CI до слияния.', 'a revision is applied whole or not at all — which is why CI checks the manifests before the merge.') } });
      return steps;
    }
    steps.push({ id: 'compare', label: 'OutOfSync', caption: del ? bi('Сравнение: в кластере есть Service shop с меткой этого приложения, а в Git его больше нет — его нужно удалить (prune).', 'The comparison: the cluster has the Service shop tracked by this application, and Git no longer has it — it needs pruning.') : bi('Сравнение: в Git образ 1.1, в кластере 1.0 — Application OutOfSync.', 'The comparison: Git says image 1.1, the cluster runs 1.0 — the Application is OutOfSync.'), focus: ['ctrl', 'app', 'e-app'], values: { app: 'OutOfSync · Healthy' }, states: { app: 'warn' }, metrics: { replicas: 2, drift: 1, minutes: 3 } });
    if (!p.automated) {
      steps.push({ id: 'wait', label: bi('ждёт', 'waits'), caption: bi('automated выключен: контроллер только показывает разницу. Синхронизацию запускает человек — кнопкой, argocd app sync или полем operation.', 'automated is off: the controller only shows the difference. A person starts the sync — with a button, argocd app sync or the operation field.'), focus: ['app'], states: { app: 'warn' }, metrics: { replicas: 2, drift: 1, minutes: 3 } });
      return steps;
    }
    if (del && !p.prune) {
      steps.push({ id: 'sync', label: 'sync', caption: bi('Синхронизация применяет то, что есть в Git, но без prune ничего не удаляет: Service остаётся и помечен requiresPruning, Application OutOfSync.', 'The sync applies what is in Git, but without prune it deletes nothing: the Service stays, marked requiresPruning, and the Application is OutOfSync.'), focus: ['ctrl', 'e-sync', 'app'], states: { app: 'warn' }, metrics: { replicas: 2, drift: 1, minutes: 3 } });
      return steps;
    }
    if (del) {
      steps.push({ id: 'pruned', label: 'prune', caption: bi('prune: контроллер удаляет Service shop — его больше нет в Git. Application Synced.', 'prune: the controller deletes the Service shop — it is no longer in Git. The Application is Synced.'), focus: ['ctrl', 'e-sync', 'api'], tokens: [{ edge: 'e-sync', label: 'delete svc' }], values: { app: 'Synced · Healthy' }, states: { app: 'ok' }, metrics: { replicas: 2, drift: 0, minutes: 3.1 } });
      return steps;
    }
    steps.push({ id: 'sync', label: 'sync', caption: bi('automated: контроллер применяет deployment.yaml новой ревизии. Начинается обычный rolling update.', 'automated: the controller applies deployment.yaml of the new revision. An ordinary rolling update begins.'), focus: ['ctrl', 'e-sync', 'api', 'e-live', 'deploy'], tokens: [{ edge: 'e-sync', label: 'image: 1.1' }], values: { deploy: '2 × trainer/web:1.1', app: 'Synced · Progressing' }, states: { deploy: 'on', app: 'wait' }, metrics: { replicas: 2, drift: 0, minutes: 3.1 } });
    steps.push({ id: 'healthy', label: 'Healthy', caption: bi('Поды новой версии готовы: Application Synced и Healthy. Выкладка заняла один коммит и ни одной команды kubectl.', 'The new pods are ready: the Application is Synced and Healthy. The release took one commit and no kubectl command.'), focus: ['deploy', 'e-rs', 'pods', 'app'], tokens: [{ edge: 'e-rs' }], values: { app: 'Synced · Healthy' }, states: { deploy: 'ok', pods: 'ok', app: 'ok' }, metrics: { replicas: 2, drift: 0, minutes: 4 } });
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Источник снова в порядке: цикл доходит до совпадения.', 'The source is fine again: the loop reaches a match.');
      return change.id === 'repo-down' ? bi('Git недоступен — и ничего страшного: Argo CD не трогает кластер, если не знает, каким тот должен быть.', 'Git is unreachable — and nothing terrible happens: Argo CD does not touch the cluster when it does not know what it should be.') : bi('Сломанный манифест останавливает всю ревизию: применяется всё или ничего.', 'A broken manifest stops the whole revision: everything is applied or nothing.');
    }
    if (change.id === 'event') return bi('Другое событие — другой путь: коммит идёт через опрос репозитория, ручная правка видна контроллеру сразу.', 'A different event takes a different path: a commit goes through polling the repository, a manual edit is visible to the controller at once.');
    if (change.id === 'selfHeal') return fmt(bi('Реплик в конце: {r}. selfHeal решает, переживёт ли ручная правка следующий цикл.', 'Replicas at the end: {r}. selfHeal decides whether a manual edit survives the next loop.'), { r: metric(next, 'replicas') });
    if (change.id === 'prune') return next.some((s) => s.id === 'pruned') ? bi('С prune удаление файла из Git удаляет объект из кластера.', 'With prune, deleting a file from Git deletes the object from the cluster.') : bi('Без prune Argo CD ничего не удаляет сам — лишний объект остаётся и висит как requiresPruning.', 'Without prune Argo CD deletes nothing by itself — the extra object stays, marked requiresPruning.');
    return metric(prev, 'drift') !== metric(next, 'drift') || last(prev)?.id !== last(next)?.id ? bi('Без automated контроллер видит разницу, но ждёт человека.', 'Without automated the controller sees the difference but waits for a person.') : bi('Политика пересчитана.', 'The policy is recomputed.');
  },
});
