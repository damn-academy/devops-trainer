// Stage 2, the kubeadm part (05 §11.1, §11.4): three VMs the learner orders
// and pays for, prepared by hand, a control plane from kubeadm, the network
// from Cilium, an etcd snapshot and restore, an upgrade by one minor
// version, a break and a repair, a mandatory cleanup. The trainer does not
// execute anything here: it explains (process explainers of the bootstrap),
// checks what the API shows through trainer-check.sh, and checks what only
// the machines show through the output the learner pastes.

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import type { OutputSign } from '../../../engine/kube-lite/ui/output-check';
import { R, S, src } from '../sources';

const sign = (id: string, label: [string, string], re: string, hint?: [string, string], o: Partial<OutputSign> = {}): OutputSign => ({ id, label: bi(...label), re, ...(hint ? { hint: bi(...hint) } : {}), ...o });
const check = (id: string, label: [string, string], when: string, hint?: [string, string]) => ({ id, label: bi(...label), when, ...(hint ? { hint: bi(...hint) } : {}) });

// ── Quizzes ─────────────────────────────────────────────────────────────────

export const prepareQuiz: QuizItem[] = [
  {
    id: 'k8s.q.prep.cgroup',
    kind: 'mcq',
    concepts: ['k8s.cgroup-driver'],
    prompt: bi('После kubeadm init API-сервер то отвечает, то нет, а `crictl ps -a` показывает десятки перезапусков kube-apiserver и etcd. Что проверить первым делом?', 'After kubeadm init the API server answers every other time, and `crictl ps -a` shows dozens of kube-apiserver and etcd restarts. What do you check first?'),
    options: [
      { id: 'driver', text: bi('Совпадает ли драйвер cgroup у containerd (SystemdCgroup) и у kubelet', 'Whether containerd (SystemdCgroup) and the kubelet use the same cgroup driver'), correct: true },
      { id: 'cni', text: bi('Установлен ли сетевой плагин', 'Whether a network plugin is installed'), why: bi('Без сетевого плагина в Pending остаётся CoreDNS, а управляющий слой работает в сети узла и от плагина не зависит.', 'Without a CNI it is CoreDNS that sits in Pending; the control plane runs on the node network and does not depend on the CNI.') },
      { id: 'certs', text: bi('Не истекли ли сертификаты', 'Whether the certificates have expired'), why: bi('Сертификаты только что выпущены на год, а истёкший сертификат даёт ошибку x509, а не перезапуски.', 'The certificates were just issued for a year; an expired one gives an x509 error, not restarts.') },
    ],
    explain: bi('Проверки preflight такую ошибку не ловят, поэтому драйвер cgroup нужно выставить одинаково ещё до init. В kubeadm по умолчанию это systemd.', 'preflight does not catch it: the cgroup driver has to match before init. With kubeadm the default is systemd.'),
    refs: { explainer: 'k8s.kubeadm-init' },
  },
  {
    id: 'k8s.q.prep.swap',
    kind: 'mcq',
    concepts: ['k8s.kubelet'],
    prompt: bi('Зачем перед установкой выключают swap?', 'Why is swap turned off before the install?'),
    options: [
      { id: 'kubelet', text: bi('kubelet по умолчанию отказывается запускаться при включённом swap. Иначе лимиты памяти подов перестают значить то, что в них написано', 'By default the kubelet refuses to start with swap on: pod memory limits stop meaning what they say'), correct: true },
      { id: 'speed', text: bi('Чтобы узел работал быстрее', 'To make the node faster'), why: bi('Скорость здесь ни при чём. Дело в учёте памяти: планировщик и cgroup рассчитывают, что память пода — это настоящая оперативная память.', 'Speed has nothing to do with it. It is about memory accounting: the scheduler and cgroups count on pod memory being real memory.') },
    ],
  },
  {
    id: 'k8s.q.prep.order',
    kind: 'order',
    concepts: ['k8s.cgroup-driver', 'k8s.kubeadm'],
    prompt: bi('Расставьте шаги подготовки узла по порядку.', 'Put the node preparation in order.'),
    steps: [
      { id: 'swap', text: bi('Выключить swap и убрать его из /etc/fstab', 'Turn swap off and remove it from /etc/fstab') },
      { id: 'mods', text: bi('Загрузить модули overlay и br_netfilter и включить sysctl ip_forward и bridge-nf-call-iptables', 'The overlay and br_netfilter modules, the ip_forward and bridge-nf-call-iptables sysctls') },
      { id: 'cri', text: bi('Настроить containerd с SystemdCgroup = true', 'containerd with SystemdCgroup = true') },
      { id: 'pkgs', text: bi('Подключить репозиторий pkgs.k8s.io нужной минорной версии, поставить kubelet, kubeadm и kubectl и закрепить их командой apt-mark hold', 'The pkgs.k8s.io repository of the needed minor version, kubelet kubeadm kubectl, apt-mark hold') },
    ],
  },
];

export const kubeadmQuiz: QuizItem[] = [
  {
    id: 'k8s.q.adm.phases',
    kind: 'order',
    concepts: ['k8s.kubeadm', 'k8s.pki', 'k8s.static-pod'],
    prompt: bi('Расставьте фазы kubeadm init по порядку.', 'Put the phases of kubeadm init in order.'),
    steps: [
      { id: 'pre', text: 'preflight' },
      { id: 'certs', text: 'certs' },
      { id: 'conf', text: 'kubeconfig' },
      { id: 'cp', text: bi('etcd и control-plane (манифесты статических подов)', 'etcd and control-plane (manifests)') },
      { id: 'kubelet', text: 'kubelet-start' },
      { id: 'addon', text: bi('addon (CoreDNS, kube-proxy)', 'addon (CoreDNS, kube-proxy)'), why: bi('Дополнения ставятся последними, потому что это обычные объекты и им нужен уже работающий API-сервер.', 'Addons come last: they are ordinary objects that need a running API server.') },
    ],
    refs: { explainer: 'k8s.kubeadm-init' },
  },
  {
    id: 'k8s.q.adm.hash',
    kind: 'mcq',
    key: true,
    concepts: ['k8s.tls-bootstrap', 'k8s.pki'],
    prompt: bi('Кого защищает флаг `--discovery-token-ca-cert-hash` в kubeadm join?', 'What does the `--discovery-token-ca-cert-hash` flag of kubeadm join protect?'),
    options: [
      { id: 'node', text: bi('Узел, потому что он поверит только тому API-серверу, чей центр сертификации совпадает с хешем', 'The node: it trusts only an API server whose CA matches the hash'), correct: true },
      { id: 'cluster', text: bi('Кластер, потому что чужой узел без хеша в него не войдёт', 'The cluster: a foreign node without the hash cannot get in'), why: bi('Кластер от чужого узла защищает токен. Хеш работает в обратную сторону и не даёт узлу подключиться к подставному серверу.', 'The token protects the cluster from a foreign node. The hash works the other way: it keeps the node from joining a fake server.') },
      { id: 'etcd', text: bi('Данные etcd при передаче', 'etcd data in transit'), why: bi('Узел не обращается к etcd, потому что с etcd работает только API-сервер.', 'A node never sees etcd at all: only the API server talks to etcd.') },
    ],
    refs: { explainer: 'k8s.tls-bootstrap' },
  },
  {
    id: 'k8s.q.adm.token',
    kind: 'fill-command',
    concepts: ['k8s.tls-bootstrap'],
    prompt: bi('Токен из вывода kubeadm init истёк. Какой командой на cp-1 получить готовую новую команду join?', 'The token from the kubeadm init output has expired. Which command on cp-1 prints a ready new join command?'),
    template: 'sudo kubeadm token ___',
    answers: ['sudo kubeadm token create --print-join-command', 'kubeadm token create --print-join-command'],
    misconceptions: [{ match: 'token list', why: bi('Команда list показывает действующие токены, а истёкшего среди них уже нет, и команду join она не печатает.', 'list shows the live tokens, but the expired one is no longer among them, and it does not print a join command.') }],
    refs: { doc: { page: 'help/kubeadm-token-create', anchor: 'OPTIONS', line: '--print-join-command' } },
  },
  {
    id: 'k8s.q.adm.pki',
    kind: 'match',
    concepts: ['k8s.pki'],
    prompt: bi('Сопоставьте файл с его назначением.', 'Match the file and its role.'),
    pairs: [
      { id: 'ca', left: '/etc/kubernetes/pki/ca.key', right: bi('Ключ центра сертификации кластера, которым подписаны все остальные сертификаты', 'The cluster CA key: every other certificate is signed with it') },
      { id: 'api', left: '/etc/kubernetes/pki/apiserver.crt', right: bi('Сертификат, которым API-сервер представляется клиентам на порту 6443', 'The certificate the API server shows to clients on 6443') },
      { id: 'admin', left: '/etc/kubernetes/admin.conf', right: bi('kubeconfig администратора с клиентским сертификатом', 'The admin kubeconfig with a client certificate') },
      { id: 'kubelet', left: '/var/lib/kubelet/pki/kubelet-client-current.pem', right: bi('Клиентский сертификат kubelet, полученный по заявке CSR', 'The kubelet client certificate obtained through a CSR') },
    ],
  },
  {
    id: 'k8s.q.adm.csr',
    kind: 'mcq',
    concepts: ['k8s.tls-bootstrap'],
    prompt: bi('Злоумышленник украл токен присоединения. Что он может сделать с ним в кластере kubeadm?', 'An attacker stole a bootstrap token. What can they do with it in a kubeadm cluster?'),
    options: [
      { id: 'csr', text: bi('Создать заявку на сертификат узла, то есть подключить к кластеру свою машину', 'Create a node certificate request — that is, attach their own machine to the cluster'), correct: true },
      { id: 'admin', text: bi('Читать объекты Secret всего кластера', 'Read the Secrets of the whole cluster'), why: bi('Группе system:bootstrappers разрешено только создавать заявки на сертификат. Но и своя машина внутри кластера — серьёзная угроза, поэтому токены действуют сутки.', 'The system:bootstrappers group may only create CSRs. Still, a machine of one’s own in the cluster is serious, which is why tokens live a day.') },
    ],
  },
];

export const cniQuiz: QuizItem[] = [
  {
    id: 'k8s.q.cni.pending',
    kind: 'mcq',
    key: true,
    concepts: ['k8s.cni', 'k8s.kubeadm'],
    prompt: bi('kubeadm init закончился без ошибок, а `kubectl get nodes` показывает NotReady, и CoreDNS в Pending. Что это значит?', 'kubeadm init finished without errors. `kubectl get nodes` shows NotReady, CoreDNS is Pending. What is it?'),
    options: [
      { id: 'cni', text: bi('Это нормальное состояние до установки сетевого плагина', 'The normal state before a network plugin is installed'), correct: true },
      { id: 'broken', text: bi('init сломался, нужно выполнить kubeadm reset', 'init broke, you need kubeadm reset'), why: bi('Узел в состоянии NotReady с причиной «network plugin not ready» — это как раз то, о чём init предупреждает в конце своего вывода: «You should now deploy a pod network».', 'A node NotReady with the reason "network plugin not ready" is exactly what init promises in its output: "You should now deploy a pod network".') },
    ],
    refs: { explainer: 'k8s.kubeadm-init' },
  },
  {
    id: 'k8s.q.cni.ports',
    kind: 'multi',
    concepts: ['k8s.cni'],
    prompt: bi('Какие порты должны быть открыты между узлами в частной сети для Cilium в режиме VXLAN? Отметьте все верные ответы.', 'Which ports must be open between the nodes on the private network for Cilium in VXLAN mode? Mark everything.'),
    options: [
      { id: 'vxlan', text: '8472/udp', correct: true },
      { id: 'health', text: '4240/tcp', correct: true },
      { id: 'kubelet', text: '10250/tcp', correct: true },
      { id: 'np', text: '30000-32767/tcp', why: bi('Диапазон NodePort нужен клиентам снаружи, а не узлам для связи друг с другом.', 'The NodePort range is for outside clients, not for nodes talking to each other.') },
    ],
    explain: bi('Порт 8472/udp нужен для конвертов VXLAN, 4240/tcp — для проверки здоровья Cilium между узлами, а 10250 — для API kubelet, к которому API-сервер обращается за логами и exec.', '8472/udp is VXLAN, 4240/tcp the Cilium health check between nodes, 10250 the kubelet API the API server calls (logs, exec).'),
  },
  {
    id: 'k8s.q.cni.ipam',
    kind: 'mcq',
    concepts: ['k8s.ipam', 'k8s.podcidr'],
    prompt: bi('Cilium установлен с `ipam.mode=kubernetes`. Откуда поды узла worker-1 получают адреса?', 'Cilium is installed with `ipam.mode=kubernetes`. Where do the pods of worker-1 get their addresses from?'),
    options: [
      { id: 'node', text: bi('Из podCIDR объекта Node, который controller-manager выдал из диапазона --pod-network-cidr', 'From the podCIDR of the Node object, handed out by the controller-manager from --pod-network-cidr'), correct: true },
      { id: 'pool', text: bi('Из собственного пула Cilium 10.0.0.0/8', 'From Cilium’s own pool 10.0.0.0/8'), why: bi('Так работает режим cluster-pool. В режиме kubernetes Cilium берёт podCIDR узла.', 'That is the cluster-pool mode. In the kubernetes mode Cilium trusts the node’s podCIDR.') },
    ],
  },
];

export const etcdQuiz: QuizItem[] = [
  {
    id: 'k8s.q.etcd.order',
    kind: 'order',
    concepts: ['k8s.etcd-snapshot', 'k8s.static-pod'],
    prompt: bi('Расставьте шаги восстановления etcd в кластере kubeadm с одним управляющим узлом.', 'Put the steps of an etcd restore in order on a kubeadm cluster with one control plane.'),
    steps: [
      { id: 'stop', text: bi('Убрать kube-apiserver.yaml из /etc/kubernetes/manifests', 'Move kube-apiserver.yaml out of /etc/kubernetes/manifests') },
      { id: 'restore', text: 'etcdutl snapshot restore <file> --data-dir /var/lib/etcd-restore' },
      { id: 'point', text: bi('В etcd.yaml заменить hostPath тома данных на новый каталог', 'In etcd.yaml change the data volume hostPath to the new directory') },
      { id: 'back', text: bi('Дождаться нового etcd и вернуть kube-apiserver.yaml', 'Wait for etcd and put kube-apiserver.yaml back') },
    ],
    refs: { explainer: 'k8s.etcd-restore' },
  },
  {
    id: 'k8s.q.etcd.lost',
    kind: 'mcq',
    concepts: ['k8s.etcd-snapshot'],
    prompt: bi('Снимок сделали в 03:00, а восстановились из него в 15:00. Что с Deployment, который создали в 11:00?', 'The snapshot was taken at 03:00, the restore happened at 15:00. What about a Deployment created at 11:00?'),
    options: [
      { id: 'lost', text: bi('Его нет, потому что в снимке его не было', 'It is gone: it was not in the snapshot'), correct: true },
      { id: 'kept', text: bi('Он есть, потому что его поды ещё работают на узлах', 'It is there: its pods are still running on the nodes'), why: bi('Контейнеры на узлах не определяют, что должно быть в кластере. Объекта нет, поэтому kubelet остановит его поды как лишние.', 'Containers on the nodes are not the source of truth. With no object, the kubelet stops its pods as extra ones.') },
    ],
    explain: bi('Поэтому манифесты держат в Git, чтобы после восстановления применить их заново.', 'That is why manifests live in Git: after a restore they are applied again.'),
  },
  {
    id: 'k8s.q.etcd.certs',
    kind: 'match',
    concepts: ['k8s.etcd-snapshot', 'k8s.pki'],
    prompt: bi('Какой флаг команды etcdctl snapshot save на cp-1 каким файлом заполнить?', 'etcdctl snapshot save on cp-1: which flag takes which file?'),
    pairs: [
      { id: 'ca', left: '--cacert', right: '/etc/kubernetes/pki/etcd/ca.crt' },
      { id: 'cert', left: '--cert', right: '/etc/kubernetes/pki/etcd/server.crt' },
      { id: 'key', left: '--key', right: '/etc/kubernetes/pki/etcd/server.key' },
    ],
    refs: { doc: { page: 'help/etcdctl-snapshot-save', anchor: 'OPTIONS' } },
  },
];

export const upgradeQuiz: QuizItem[] = [
  {
    id: 'k8s.q.up.skew',
    kind: 'mcq',
    key: true,
    concepts: ['k8s.version-skew'],
    prompt: bi('API-сервер версии v1.36. Какие версии kubelet поддерживаются рядом с ним?', 'The API server is v1.36. Which kubelet versions are supported next to it?'),
    options: [
      { id: 'right', text: '1.33, 1.34, 1.35, 1.36', correct: true },
      { id: 'newer', text: '1.36, 1.37', why: bi('kubelet не может быть новее API-сервера, потому что он может обращаться к возможностям API, которых сервер ещё не знает. Поэтому управляющий слой обновляют первым.', 'The kubelet may not be newer than the API server: it may call API the server does not know yet. That is why the control plane is upgraded first.') },
      { id: 'one', text: '1.35, 1.36', why: bi('Начиная с версии 1.28 kubelet может отставать от API-сервера на три минорные версии, а не на одну.', 'Since 1.28 the kubelet may lag by three minor versions, not one.') },
    ],
    refs: { doc: { page: 'web/kubernetes.io/docs/setup/release/version-skew-policy', anchor: 'kubelet' } },
  },
  {
    id: 'k8s.q.up.order',
    kind: 'order',
    concepts: ['k8s.drain', 'k8s.version-skew'],
    prompt: bi('Рабочий узел worker-1 обновляют до 1.37, а управляющий слой уже обновлён. В каком порядке?', 'Upgrading worker-1 to 1.37 (the control plane is already upgraded). The order?'),
    steps: [
      { id: 'kubeadm', text: bi('Поставить на узле новый kubeadm и выполнить kubeadm upgrade node', 'On the node: the new kubeadm, kubeadm upgrade node') },
      { id: 'drain', text: 'kubectl drain worker-1 --ignore-daemonsets' },
      { id: 'kubelet', text: bi('Поставить на узле новые kubelet и kubectl и выполнить systemctl restart kubelet', 'On the node: the new kubelet and kubectl, systemctl restart kubelet') },
      { id: 'uncordon', text: 'kubectl uncordon worker-1' },
    ],
    explain: bi('Такой порядок описан в официальной инструкции. Сначала kubeadm upgrade node обновляет настройки kubelet, потом идут drain, пакеты и перезапуск, а в конце uncordon.', 'This is the official order: kubeadm upgrade node updates the kubelet configuration, then the drain, the packages and the restart, then uncordon.'),
  },
  {
    id: 'k8s.q.up.pdb',
    kind: 'mcq',
    concepts: ['k8s.drain'],
    prompt: bi('drain раз за разом повторяет «Cannot evict pod as it would violate the pod\'s disruption budget» и не заканчивается. Почему?', 'drain keeps repeating "Cannot evict pod as it would violate the pod\'s disruption budget" and never finishes. Why?'),
    options: [
      { id: 'pdb', text: bi('PodDisruptionBudget не разрешает выселить ни одного пода (например, minAvailable равен числу реплик)', 'A PodDisruptionBudget allows no pod to go (minAvailable equals the replica count, for example)'), correct: true },
      { id: 'ds', text: bi('На узле есть поды DaemonSet', 'The node has DaemonSet pods'), why: bi('Тогда drain сразу откажется работать и подскажет флаг --ignore-daemonsets, а не будет повторять выселение.', 'Then drain refuses at once with a hint about --ignore-daemonsets, instead of retrying evictions.') },
    ],
  },
];

export const repairQuiz: QuizItem[] = [
  {
    id: 'k8s.q.rep.sched',
    kind: 'mcq',
    concepts: ['k8s.static-pod', 'k8s.scheduler'],
    prompt: bi('Кто-то убрал kube-scheduler.yaml из /etc/kubernetes/manifests. Как это выглядит для новых подов?', 'Someone moved kube-scheduler.yaml out of /etc/kubernetes/manifests. How does it look for new pods?'),
    options: [
      { id: 'pending', text: bi('Pending без узла и без событий FailedScheduling', 'Pending with no node and no FailedScheduling events'), correct: true },
      { id: 'fail', text: bi('Pending с событием FailedScheduling', 'Pending with a FailedScheduling event'), why: bi('FailedScheduling пишет сам планировщик, когда не нашёл узла. Нет планировщика, нет и события.', 'FailedScheduling is written by the scheduler itself when it finds no node. No scheduler — no event.') },
    ],
  },
  {
    id: 'k8s.q.rep.kubelet',
    kind: 'mcq',
    concepts: ['k8s.kubelet', 'k8s.node'],
    prompt: bi('На worker-2 остановили kubelet. Что будет с контейнерами, которые уже работают на этом узле, в первые минуты?', 'The kubelet on worker-2 was stopped. What happens to the containers already running there in the first minutes?'),
    options: [
      { id: 'run', text: bi('Продолжат работать, потому что их держит containerd, а kubelet только управляет ими', 'They keep running: containerd holds them, the kubelet only manages them'), correct: true },
      { id: 'die', text: bi('Остановятся вместе с kubelet', 'They stop together with the kubelet'), why: bi('Родителем процессов контейнеров служит containerd-shim, а не kubelet. Через пять минут поды выселят из API, но процессы на узле продолжат работать, пока kubelet не вернётся и не остановит их.', 'The containers are children of containerd-shim, not of the kubelet. After 5 minutes they are evicted from the API, but the processes on the node remain until the kubelet returns and removes them.') },
    ],
    refs: { explainer: 'k8s.node-down' },
  },
];

export const stage2Quiz: QuizItem[] = [...prepareQuiz, ...kubeadmQuiz, ...cniQuiz, ...etcdQuiz, ...upgradeQuiz, ...repairQuiz];

// ── Lessons ─────────────────────────────────────────────────────────────────

export const prepareLesson: Lesson = {
  id: 'k8s-2.prepare',
  block: 'k8s-2',
  title: bi('Три виртуальные машины и подготовка узлов', 'Three VMs and preparing the nodes'),
  summary: bi('Как заказать три виртуальные машины в частной сети, настроить межсетевой экран, выключить swap, загрузить модули ядра, включить sysctl, настроить containerd с драйвером cgroup systemd и поставить пакеты Kubernetes нужной версии.', 'Ordering three VMs on a private network, the firewall, swap, kernel modules, sysctls, containerd with the systemd cgroup driver and the Kubernetes packages of the right version.'),
  introduces: ['k8s.cgroup-driver'],
  uses: ['k8s.kubelet', 'k8s.cri', 'k8s.k3s', 'k8s.control-plane'],
  tier: 'core',
  minutes: 60,
  sources: src([S.installKubeadm, S.cri], [R.installKubeadm, R.components]),
  sections: [
    {
      id: 'why',
      kind: 'text',
      step: 'hook',
      body: bi(
        'k3s собрал кластер за вас одним исполняемым файлом. Теперь вы соберёте кластер сами, из тех же блоков, что видели в конструкторе, на трёх виртуальных машинах: `cp-1` для управляющего слоя, `worker-1` и `worker-2` для приложений. Установщик называется kubeadm. Он аккуратно запускает управляющий слой, но всё вокруг — машины, ядро, среда запуска контейнеров, сеть подов, резервные копии и обновления — остаётся вашей работой. Об этой работе и спрашивают на собеседовании и на экзамене CKA, и её же позже, в блоке «Кластер из кода», вы поручите Terraform и Ansible.',
        'k3s assembled a cluster for you from one binary. Now you will assemble one yourself — from the same blocks you saw in the constructor — on three VMs: `cp-1` for the control plane, `worker-1` and `worker-2` for applications. The installer is called kubeadm. It brings the control plane up carefully, but everything around it — the machines, the kernel, the runtime, the pod network, backups, upgrades — remains your work. That work is what interviews and the CKA exam ask about, and it is what you will later hand to Terraform and Ansible in the "Cluster from code" block.',
      ),
    },
    { id: 'cost', kind: 'callout', tone: 'cost', step: 'hook', title: bi('Сколько это стоит', 'What it costs'), body: bi('Три виртуальные машины с двумя ядрами и 4 ГБ памяти понадобятся на весь этап, то есть на несколько рабочих дней. Впишите сегодняшнюю цену часа работы машины у вашего провайдера, и таблица посчитает стоимость этапа и крупными цифрами стоимость месяца, если стенд забыть. Счёт идёт с момента создания машин и останавливается только после уборки в последнем уроке.', 'Three VMs with 2 vCPU and 4 GB for the whole stage — a few working days. Type today’s VM-hour price of your provider: the table counts the stage and — in large type — a month of a forgotten lab. The meter starts when the VMs are created and stops only after the cleanup in the last lesson.') },
    { id: 'cost-table', kind: 'widget', step: 'hook', widget: 'k8s.cost', props: { vms: 3, hours: 24 } },
    {
      id: 'order',
      kind: 'text',
      step: 'explain',
      title: bi('Машины и сеть', 'Machines and the network'),
      body: bi(
        'Закажите у своего провайдера три виртуальные машины Ubuntu 24.04 с двумя ядрами и 4 ГБ памяти, потому что на меньшем управляющий слой не поместится, и поместите их в одну частную сеть, например `10.10.1.0/24`: `cp-1` получит адрес `10.10.1.11`, а рабочие узлы `.12` и `.13`. Каждой машине поставьте метку `trainer=devops`. По этой метке в конце вы найдёте и удалите всё, что создали, потому что память в таких делах подводит.\n\nМежсетевой экран настраивают по принципу «наружу как можно меньше». Из интернета открыты только SSH (22) и порт API 6443, причём оба только для вашего адреса. Всё остальное ходит только по частной сети: 10250 (API kubelet, к нему API-сервер обращается за логами и exec), 2379–2380 (etcd), 8472/udp и 4240/tcp (конверты VXLAN и проверка здоровья Cilium). Если оставить порт 10250 открытым в интернет, любой, кто найдёт узел, сможет испытать API kubelet на прочность.',
        'Order three Ubuntu 24.04 VMs with 2 vCPU and 4 GB each from your provider — the control plane will not survive with less — and put them on one private network, for example `10.10.1.0/24`: `cp-1` gets `10.10.1.11`, the workers `.12` and `.13`. Label every VM `trainer=devops`. That label is how you will find and delete everything you created at the end — memory lets you down in such matters.\n\nThe firewall follows the rule "as little outside as possible". From the internet only SSH (22) and the API port 6443 are open, and both only from your own address. Everything else goes over the private network only: 10250 (the kubelet API, which the API server calls for logs and exec), 2379–2380 (etcd), 8472/udp and 4240/tcp (the VXLAN wrapping and the Cilium health check). Leave 10250 open to the internet, and anyone who finds the node can test the kubelet API for weaknesses.',
      ),
    },
    {
      id: 'kernel',
      kind: 'text',
      step: 'explain',
      title: bi('Ядро и среда запуска контейнеров', 'The kernel and the runtime'),
      body: bi(
        'Каждая строка подготовки отвечает на конкретное требование, и у каждой есть своя ловушка.\n\n**swap.** kubelet по умолчанию отказывается запускаться при включённом swap. Иначе лимиты памяти подов перестают значить то, что в них написано, потому что память можно незаметно выгрузить на диск. Команда `sudo swapoff -a` выключает swap до перезагрузки, а строку swap в `/etc/fstab` нужно закомментировать, иначе после перезагрузки kubelet снова не запустится.\n\n**Модули и sysctl.** Модуль `overlay` нужен containerd для слоёв образов. Модуль `br_netfilter` направляет пакеты, которые идут через мост Linux, через netfilter, и без него правила kube-proxy не увидят трафик между подами одного узла. Параметр `net.ipv4.ip_forward=1` разрешает узлу пересылать пакеты, то есть служить маршрутизатором для своих подов, и kubeadm проверяет его первым делом. Всё это записывают в `/etc/modules-load.d/k8s.conf` и `/etc/sysctl.d/k8s.conf`, чтобы настройки пережили перезагрузку.\n\n**containerd и драйвер cgroup.** Ресурсы контейнеров учитываются в cgroup, и кто-то должен эти cgroup создавать. [[k8s.cgroup-driver|Драйвер cgroup]] отвечает на вопрос, кто это делает: systemd или сама среда запуска (cgroupfs). kubeadm настраивает kubelet на systemd, а containerd из пакета Ubuntu по умолчанию работает с cgroupfs. Если их не согласовать, два хозяина начинают спорить о cgroup одних и тех же контейнеров, и поды управляющего слоя перезапускаются без понятной причины. Исправляет это одна строка `SystemdCgroup = true` в файле `/etc/containerd/config.toml`.\n\n**Пакеты.** Репозиторий `pkgs.k8s.io` разделён по минорным версиям: адрес `…/core:/stable:/v1.36/deb/` даёт только версии 1.36.x, и это защищает от случайного прыжка через версию. Сверху добавляют команду `apt-mark hold kubelet kubeadm kubectl`, и после неё обычный `apt upgrade` эти пакеты не тронет, и обновлять их вы будете осознанно, в уроке об обновлении.',
        'Every line of the preparation answers a specific requirement, and each has its own trap.\n\n**swap.** By default the kubelet refuses to start with swap on: pod memory limits stop meaning what they say — memory can be quietly paged out to disk. `sudo swapoff -a` turns swap off until the next reboot, and the swap line in `/etc/fstab` has to be commented out, or after a reboot the kubelet will fail to come up again.\n\n**Modules and sysctls.** `overlay` is what containerd needs for image layers. `br_netfilter` makes packets crossing a Linux bridge pass through netfilter — without it kube-proxy’s rules do not see traffic between pods of one node. `net.ipv4.ip_forward=1` lets the node forward packets, that is, be a router for its pods — kubeadm checks it first. All of this goes into `/etc/modules-load.d/k8s.conf` and `/etc/sysctl.d/k8s.conf` so that it survives a reboot.\n\n**containerd and the cgroup driver.** Container resources are accounted in cgroups, and someone has to create those cgroups. The [[k8s.cgroup-driver|cgroup driver]] answers who does it: systemd or the runtime itself (cgroupfs). kubeadm configures the kubelet for systemd, while containerd from the Ubuntu package defaults to cgroupfs. Leave them disagreeing, and two owners start arguing over the cgroups of the same containers, and the control-plane pods restart for no clear reason. The cure is one line: `SystemdCgroup = true` in `/etc/containerd/config.toml`.\n\n**Packages.** The `pkgs.k8s.io` repository is split by minor version: the address `…/core:/stable:/v1.36/deb/` gives only 1.36.x. That protects against an accidental jump over a version. On top of it — `apt-mark hold kubelet kubeadm kubectl`: an ordinary `apt upgrade` will not touch these packages; you will upgrade them deliberately, in the upgrade lesson.',
      ),
    },
    {
      id: 'commands',
      kind: 'text',
      step: 'practice',
      title: bi('На каждом из трёх узлов', 'On each of the three nodes'),
      body: bi(
        'Прочитайте каждую строку, прежде чем её запускать, и сверяйте её со страницей *Installing kubeadm* для своей версии.\n\n```bash\nsudo swapoff -a && sudo sed -i \'/ swap / s/^/#/\' /etc/fstab\nprintf \'overlay\\nbr_netfilter\\n\' | sudo tee /etc/modules-load.d/k8s.conf\nsudo modprobe overlay && sudo modprobe br_netfilter\nprintf \'net.ipv4.ip_forward = 1\\nnet.bridge.bridge-nf-call-iptables = 1\\n\' | sudo tee /etc/sysctl.d/k8s.conf\nsudo sysctl --system\nsudo apt-get update && sudo apt-get install -y containerd apt-transport-https ca-certificates curl gpg\nsudo mkdir -p /etc/containerd && containerd config default | sudo tee /etc/containerd/config.toml >/dev/null\nsudo sed -i \'s/SystemdCgroup = false/SystemdCgroup = true/\' /etc/containerd/config.toml\nsudo systemctl restart containerd\ncurl -fsSL https://pkgs.k8s.io/core:/stable:/v1.36/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg\necho \'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /\' | sudo tee /etc/apt/sources.list.d/kubernetes.list\nsudo apt-get update && sudo apt-get install -y kubelet kubeadm kubectl\nsudo apt-mark hold kubelet kubeadm kubectl\n```\n\nВерсия 1.36 выбрана нарочно: в уроке об обновлении вы переведёте кластер на 1.37.',
        'Read every line before running it — and compare it with the *Installing kubeadm* page of your version.\n\n```bash\nsudo swapoff -a && sudo sed -i \'/ swap / s/^/#/\' /etc/fstab\nprintf \'overlay\\nbr_netfilter\\n\' | sudo tee /etc/modules-load.d/k8s.conf\nsudo modprobe overlay && sudo modprobe br_netfilter\nprintf \'net.ipv4.ip_forward = 1\\nnet.bridge.bridge-nf-call-iptables = 1\\n\' | sudo tee /etc/sysctl.d/k8s.conf\nsudo sysctl --system\nsudo apt-get update && sudo apt-get install -y containerd apt-transport-https ca-certificates curl gpg\nsudo mkdir -p /etc/containerd && containerd config default | sudo tee /etc/containerd/config.toml >/dev/null\nsudo sed -i \'s/SystemdCgroup = false/SystemdCgroup = true/\' /etc/containerd/config.toml\nsudo systemctl restart containerd\ncurl -fsSL https://pkgs.k8s.io/core:/stable:/v1.36/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg\necho \'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /\' | sudo tee /etc/apt/sources.list.d/kubernetes.list\nsudo apt-get update && sudo apt-get install -y kubelet kubeadm kubectl\nsudo apt-mark hold kubelet kubeadm kubectl\n```\n\nVersion 1.36 is chosen on purpose: in the upgrade lesson you will move the cluster to 1.37.',
      ),
    },
    {
      id: 'selfcheck',
      kind: 'widget',
      step: 'practice',
      widget: 'k8s.output-check',
      props: {
        where: bi('на каждом узле', 'on every node'),
        command: "swapon --show; lsmod | grep -E '^(overlay|br_netfilter) '; sysctl net.ipv4.ip_forward net.bridge.bridge-nf-call-iptables; grep SystemdCgroup /etc/containerd/config.toml; kubeadm version -o short; apt-mark showhold",
        signs: [
          sign('swap', ['swap выключен', 'swap is off'], '^NAME\\s+TYPE\\s+SIZE', ['swapon --show напечатал таблицу, значит, swap ещё работает. Выполните swapoff -a и закомментируйте строку swap в /etc/fstab.', 'swapon --show printed a table — swap is still on. Run swapoff -a and comment the line in /etc/fstab out.'], { absent: true }),
          sign('overlay', ['модуль overlay загружен', 'the overlay module is loaded'], '^overlay\\s', ['sudo modprobe overlay', 'sudo modprobe overlay']),
          sign('brnf', ['модуль br_netfilter загружен', 'the br_netfilter module is loaded'], '^br_netfilter\\s', ['Выполните sudo modprobe br_netfilter и добавьте строку в /etc/modules-load.d/k8s.conf, чтобы модуль загружался и после перезагрузки.', 'sudo modprobe br_netfilter — and a line in /etc/modules-load.d/k8s.conf to survive a reboot.']),
          sign('fwd', ['net.ipv4.ip_forward = 1', 'net.ipv4.ip_forward = 1'], 'net\\.ipv4\\.ip_forward = 1', ['Без пересылки пакетов kubeadm остановится на проверках preflight.', 'Without packet forwarding kubeadm stops at preflight.']),
          sign('bridge', ['bridge-nf-call-iptables = 1', 'bridge-nf-call-iptables = 1'], 'net\\.bridge\\.bridge-nf-call-iptables = 1', ['Этот ключ появляется только после загрузки модуля br_netfilter.', 'This key appears only after br_netfilter is loaded.']),
          sign('cgroup', ['containerd: SystemdCgroup = true', 'containerd: SystemdCgroup = true'], 'SystemdCgroup = true', ['Поправьте config.toml и перезапустите containerd: драйвер cgroup должен совпадать с драйвером kubelet.', 'Fix config.toml and restart containerd: the cgroup driver must match the kubelet’s.']),
          sign('version', ['kubeadm версии 1.36', 'kubeadm of version 1.36'], '^v1\\.36\\.\\d+', ['Проверьте адрес репозитория: в нём должна стоять минорная версия v1.36.', 'Check the repository address: it must contain the minor version v1.36.']),
          sign('hold', ['kubelet, kubeadm и kubectl закреплены', 'kubelet, kubeadm, kubectl are held'], '^kubeadm$[\\s\\S]*^kubectl$[\\s\\S]*^kubelet$', ['sudo apt-mark hold kubelet kubeadm kubectl', 'sudo apt-mark hold kubelet kubeadm kubectl']),
        ],
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: prepareQuiz.map((q) => q.id) },
  ],
};

export const kubeadmLesson: Lesson = {
  id: 'k8s-2.kubeadm',
  block: 'k8s-2',
  title: bi('Как kubeadm init и join создают сертификаты, запускают статические поды и вводят узлы в кластер', 'kubeadm init and join: certificates, static pods, nodes joining'),
  summary: bi('Что записывает kubeadm init, почему управляющий слой работает статическими подами, как устроены сертификаты кластера и как новый узел получает свой сертификат.', 'What exactly kubeadm init writes, why the control plane is static pods, how the cluster PKI is built and how a new node gets its certificate.'),
  introduces: ['k8s.kubeadm', 'k8s.static-pod', 'k8s.pki', 'k8s.tls-bootstrap'],
  uses: ['k8s.control-plane', 'k8s.etcd', 'k8s.kubelet', 'k8s.kubeconfig', 'k8s.cgroup-driver', 'k8s.node'],
  tier: 'core',
  minutes: 90,
  sources: src([S.kubeadm, S.pki, S.staticPod, S.tlsBootstrap], [R.installKubeadm, R.components]),
  sections: [
    {
      id: 'init',
      kind: 'text',
      step: 'explain',
      title: bi('Что делает kubeadm init', 'What kubeadm init does'),
      body: bi(
        'Официальный установщик Kubernetes называется [[k8s.kubeadm|kubeadm]]. О нём важнее всего знать, что сам он почти ничего не запускает. Он записывает файлы, а запускает всё kubelet.\n\nСначала идут проверки preflight: загружены ли модули, включены ли sysctl, свободны ли порты, отвечает ли среда запуска контейнеров. Затем фаза certs создаёт [[k8s.pki|PKI кластера]], то есть собственный центр сертификации в `/etc/kubernetes/pki` и подписанные им сертификаты: для API-сервера на порту 6443, отдельный центр и сертификаты для etcd, клиентский сертификат, с которым API-сервер обращается к kubelet, и ключ для токенов ServiceAccount. Центр сертификации действует десять лет, а все остальные сертификаты — год. В Kubernetes никто никому не верит на слово, и каждый компонент представляется сертификатом, подписанным этим центром.\n\nФаза kubeconfig записывает в `/etc/kubernetes` файлы `admin.conf`, `controller-manager.conf`, `scheduler.conf` и `kubelet.conf`, и в каждом лежат адрес API, сертификат центра и клиентский сертификат своего владельца. Это тот же формат, что у вашего `~/.kube/config`.\n\nДальше начинается самое интересное. Фазы etcd и control-plane не запускают ни одного процесса, а только кладут четыре YAML-файла в `/etc/kubernetes/manifests`. Это [[k8s.static-pod|статические поды]]. kubelet регулярно перечитывает этот каталог и сам запускает поды из файлов, не спрашивая API-сервер. Так решается задача о курице и яйце. API-сервер сам работает в поде, а создать под через API, которого ещё нет, нельзя. Когда API-сервер запустится, kubelet заведёт в нём «зеркальные» поды с именем узла в конце, например `kube-apiserver-cp-1`. Их видно в выводе `kubectl get pods -n kube-system`, но управлять ими через API нельзя. Если поправить файл, kubelet пересоздаст под, а если убрать файл из каталога, под остановится.\n\nВ конце kubeadm сохраняет свою конфигурацию в ConfigMap `kubeadm-config`, создаёт токен присоединения для будущих узлов и ставит дополнения kube-proxy и CoreDNS.',
        '[[k8s.kubeadm|kubeadm]] is the official Kubernetes installer. The most important thing about it: it starts almost nothing by itself. It writes files, and the kubelet starts everything.\n\nFirst come the preflight checks: modules, sysctls, free ports, whether the runtime answers. Then the certs phase creates the [[k8s.pki|cluster PKI]] — a certificate authority of its own in `/etc/kubernetes/pki` and the certificates it signs: for the API server on port 6443, a separate CA and certificates for etcd, a client certificate the API server uses to call the kubelets, a key for ServiceAccount tokens. The CA lives ten years, all the others one year. Nobody in Kubernetes takes anyone’s word: every component introduces itself with a certificate signed by this CA.\n\nThe kubeconfig phase writes `admin.conf`, `controller-manager.conf`, `scheduler.conf` and `kubelet.conf` into `/etc/kubernetes` — each holds the API address, the CA certificate and its owner’s client certificate. The same format as your `~/.kube/config`.\n\nThen comes the interesting part. The etcd and control-plane phases start no process at all: they put four YAML files into `/etc/kubernetes/manifests`. These are [[k8s.static-pod|static pods]]. The kubelet regularly rereads that directory and starts the pods from the files by itself, without asking the API server. That solves the chicken-and-egg problem: the API server is a pod, but you cannot create a pod through an API that does not exist yet. Once the API server is up, the kubelet registers "mirror" pods in it with the node name at the end — `kube-apiserver-cp-1`. You see them in `kubectl get pods -n kube-system`, but you cannot manage them through the API: edit the file and the kubelet recreates the pod; move the file out of the directory and the pod stops.\n\nAt the end kubeadm uploads its configuration to the `kubeadm-config` ConfigMap, creates a bootstrap token for future nodes and installs the addons: kube-proxy and CoreDNS.',
      ),
    },
    {
      id: 'look-init-intro',
      kind: 'text',
      step: 'look',
      title: bi('Фазы kubeadm init по шагам', 'The phases of kubeadm init step by step'),
      body: bi(
        'Схема ниже замедленно проходит то, что kubeadm init делает на cp-1 за минуту-другую. Сначала на ней только сама команда. Слева по одному появятся файлы, которые записывают фазы: каталог сертификатов, файлы kubeconfig и каталог манифестов статических подов. Внизу появится kubelet, а справа поды, которые он запускает из этих манифестов: etcd, API-сервер, controller-manager и scheduler. Последними появятся CoreDNS и место для сети подов.',
        'The diagram below replays in slow motion what kubeadm init does on cp-1 in a minute or two. At first only the command is shown. On the left the files written by the phases appear one by one, at the bottom the kubelet, on the right the pods it starts from the manifests, and last CoreDNS and the pod network.',
      ),
    },
    { id: 'look-init', kind: 'explainer', step: 'look', explainer: 'k8s.kubeadm-init', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Каждый шаг показывает одну фазу init, облачко говорит, что делает kubeadm или kubelet, а карточка на линии показывает, сколько файлов записано. Счётчики под схемой показывают, сколько файлов записано и сколько дней осталось до конца срока сертификатов.\n\nКогда пройдёте init до конца, включайте по одной поломке в блоке «Сломать»: пересылка пакетов не включена, swap не выключен, драйвер cgroup не совпадает. Сравните, на какой фазе всплывает каждая поломка и какое сообщение вы увидите. Если у вас уровень выше начального, сдвиньте в «Параметрах» время, прошедшее после init, дальше года и посмотрите, что ответит kubectl, когда сертификаты истекут.', 'Press “Start from the first step”, then go on with “Step forward”: each step shows one phase of init, the callout says what kubeadm or the kubelet is doing, and the card on the line shows how many files were written. The counters under the diagram show how many files were written and how many days are left until the certificates expire.\n\nOnce you reach the end of init, switch on the breaks in “Break it” one at a time: packet forwarding is not enabled, swap is not turned off, the cgroup driver does not match. Compare at which phase each break surfaces and what message you see. Above beginner level, move the time since init in “Parameters” past a year and see what kubectl answers once the certificates have expired.'), caption: bi('Сообщения, которые вы видели при поломках, понадобятся при настоящей установке ниже: если init остановится на preflight, причина названа в самом сообщении, если kubelet нездоров, ищите причину в `journalctl -u kubelet`, а если управляющий слой то запускается, то падает, проверьте драйвер cgroup. Срок сертификатов на настоящем кластере покажет команда `sudo kubeadm certs check-expiration`.', 'The messages you saw with the breaks are needed in the real install below: if init stops in preflight, the message names the cause; if the kubelet is unhealthy, look in `journalctl -u kubelet`; if the control plane keeps coming up and falling, check the cgroup driver. On a real cluster `sudo kubeadm certs check-expiration` shows the certificates’ terms.') },
    {
      id: 'docs-init',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте справку kubeadm init. В каком разделе сказано, сколько по умолчанию действует токен присоединения?', 'Open the kubeadm init help. Which section says how long a bootstrap token lives by default?'),
      ref: { page: 'help/kubeadm-init', anchor: 'OPTIONS', line: '--token-ttl' },
      answer: 'OPTIONS',
    },
    {
      id: 'run-init',
      kind: 'text',
      step: 'practice',
      title: bi('На cp-1', 'On cp-1'),
      body: bi(
        '```bash\nsudo kubeadm init --apiserver-advertise-address=10.10.1.11 --pod-network-cidr=10.244.0.0/16\nmkdir -p $HOME/.kube && sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config && sudo chown $(id -u):$(id -g) $HOME/.kube/config\nkubectl get pods -n kube-system -o wide\n```\n\nФлаг `--pod-network-cidr` задаёт диапазон адресов подов, из которого controller-manager нарежет каждому узлу свой podCIDR. Сохраните последние строки вывода с командой `kubeadm join`: она понадобится для рабочих узлов. Если хотите обращаться к API по публичному адресу машины, добавьте этот адрес во флаг `--apiserver-cert-extra-sans`: сертификат API-сервера должен знать все имена, по которым к нему будут обращаться, иначе kubectl ответит ошибкой x509.',
        '```bash\nsudo kubeadm init --apiserver-advertise-address=10.10.1.11 --pod-network-cidr=10.244.0.0/16\nmkdir -p $HOME/.kube && sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config && sudo chown $(id -u):$(id -g) $HOME/.kube/config\nkubectl get pods -n kube-system -o wide\n```\n\n`--pod-network-cidr` is the range of pod addresses: the controller-manager cuts a podCIDR of its own for every node out of it. Keep the last lines of the output — the `kubeadm join` command: you need it for the workers. If you want to reach the API by the VM’s public address, add it to `--apiserver-cert-extra-sans`: the API server certificate must know every name it will be reached by, or kubectl answers with an x509 error.',
      ),
    },
    {
      id: 'check-init',
      kind: 'widget',
      step: 'practice',
      widget: 'k8s.output-check',
      props: {
        where: bi('на cp-1', 'on cp-1'),
        command: 'ls /etc/kubernetes/manifests\nsudo kubeadm certs check-expiration',
        signs: [
          sign('etcd', ['etcd.yaml на месте', 'etcd.yaml is in place'], '^etcd\\.yaml$'),
          sign('api', ['kube-apiserver.yaml на месте', 'kube-apiserver.yaml is in place'], '^kube-apiserver\\.yaml$'),
          sign('cm', ['kube-controller-manager.yaml на месте', 'kube-controller-manager.yaml is in place'], '^kube-controller-manager\\.yaml$'),
          sign('sched', ['kube-scheduler.yaml на месте', 'kube-scheduler.yaml is in place'], '^kube-scheduler\\.yaml$'),
          sign('apicert', ['сертификат apiserver выпущен на год', 'the apiserver certificate is issued for a year'], '^apiserver\\s.*\\b3[0-6]\\dd\\b', ['Строка apiserver в выводе check-expiration должна показывать около 364 дней оставшегося срока.', 'The apiserver line of check-expiration should show about 364d left.']),
          sign('ca', ['центр сертификации кластера выпущен на 10 лет', 'the cluster CA for 10 years'], '^ca\\s.*\\b9y\\b', ['В разделе CERTIFICATE AUTHORITY строка ca показывает 9y, то есть десять лет без нескольких дней.', 'In the CERTIFICATE AUTHORITY section the ca line shows 9y — ten years minus a few days.']),
        ],
      },
    },
    {
      id: 'join',
      kind: 'text',
      step: 'explain',
      title: bi('Как узел входит в кластер', 'How a node enters the cluster'),
      body: bi(
        'Новый узел и кластер не знают друг друга, и kubeadm join выстраивает доверие в обе стороны.\n\nСначала узел должен убедиться, что обращается к своему кластеру, а не к подставному серверу. Он без всякой проверки читает публичный ConfigMap `cluster-info` в namespace kube-public, где лежат адрес API и сертификат центра сертификации, и сверяет хеш открытого ключа этого центра с тем, что вы передали во флаге `--discovery-token-ca-cert-hash`. Если хеш совпал, центр закреплён, и дальше узел верит только сертификатам, подписанным им.\n\nЗатем кластер должен поверить узлу, и это называется [[k8s.tls-bootstrap|TLS bootstrap kubelet]]. kubelet входит в API с токеном присоединения (`abcdef.0123456789abcdef`) как участник группы `system:bootstrappers`. Прав у этой группы почти нет, и она может только создать заявку CertificateSigningRequest. kubelet сам создаёт ключ, и закрытый ключ никогда не покидает узел, а затем просит подписать сертификат на имя `CN=system:node:worker-1, O=system:nodes`. Контроллер csrapproving в controller-manager одобряет заявку, а контроллер csrsigning подписывает её ключом центра. kubelet забирает сертификат в `/var/lib/kubelet/pki`, переходит на него и регистрирует объект Node. Токен ему больше не нужен, а сертификат kubelet будет продлевать сам, пока срок не истёк.\n\nТокен действует 24 часа. Если вы присоединяете узел на следующий день, новую команду напечатает `kubeadm token create --print-join-command`.',
        'A new node and the cluster do not know each other, and kubeadm join builds trust in both directions.\n\nFirst the node must make sure it talks to its own cluster and not to a fake server. With no checks at all it reads the public `cluster-info` ConfigMap in namespace kube-public — the API address and the CA certificate are there — and compares the hash of that CA’s public key with the one you passed in `--discovery-token-ca-cert-hash`. A match pins the CA: from then on the node trusts only certificates signed by it.\n\nThen the cluster has to trust the node. This is the [[k8s.tls-bootstrap|kubelet TLS bootstrap]]. The kubelet logs into the API with the bootstrap token (`abcdef.0123456789abcdef`) as a member of the `system:bootstrappers` group. That group has almost no rights: it may only create a CertificateSigningRequest. The kubelet generates its own key — the private key never leaves the node — and asks for a certificate `CN=system:node:worker-1, O=system:nodes` to be signed. The csrapproving controller in the controller-manager approves the request, csrsigning signs it with the CA key. The kubelet takes the certificate into `/var/lib/kubelet/pki`, switches to it and registers the Node object. It no longer needs the token, and it renews the certificate itself before it expires.\n\nA token lives 24 hours. If you join a node the next day, a new command is printed by `kubeadm token create --print-join-command`.',
      ),
    },
    {
      id: 'look-join-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как узел получает свой сертификат', 'How a node gets its certificate'),
      body: bi(
        'Схема ниже показывает, как kubeadm join на worker-1 выстраивает доверие между новым узлом и кластером. Сначала на ней команда join и публичный ConfigMap cluster-info. Дальше по одному появятся токен присоединения, kubelet нового узла, API-сервер, заявка на сертификат, controller-manager, который её одобряет и подписывает, и объект Node.',
        'The diagram below shows how kubeadm join on worker-1 builds trust between the new node and the cluster. At first: the join command and the public cluster-info. Then the token, the new kubelet, the API server, the certificate request, the controller-manager that approves and signs it, and the Node object appear one by one.',
      ),
    },
    { id: 'look-join', kind: 'explainer', step: 'look', explainer: 'k8s.tls-bootstrap', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Каждый шаг добавляет одно звено цепочки доверия, облачко говорит, кто сейчас действует, а карточка на линии показывает, что передаётся: хеш центра сертификации, токен, заявку на имя system:node:worker-1 и, наконец, сертификат.\n\nПотом сдвиньте в «Параметрах» время после init дальше суток, ведь токен присоединения действует 24 часа, и попробуйте присоединить узел. Затем включите в блоке «Сломать» по очереди ошибку в хеше и выключенное автоматическое одобрение заявок и посмотрите, на каком звене застрянет узел и что он напишет.', 'Press “Start from the first step”, then go on with “Step forward”. Each step adds one link to the chain of trust, the callout says who is acting now, and the card on the line shows what is handed on: the CA hash, the token, the request for the name system:node:worker-1 and finally the certificate.\n\nThen move the time since init in “Parameters” past a day, since a join token is valid for 24 hours, and try to join the node. Next, in “Break it”, switch on a mistyped hash and disabled automatic approval one at a time and see at which link the node gets stuck and what it prints.'), caption: bi('Каждое звено, которое вы видели на схеме, можно проверить на настоящем узле: сертификат kubelet лежит в `/var/lib/kubelet/pki`, заявка видна в `kubectl get csr`, а при истёкшем токене join напечатает то же сообщение про подпись JWS. Присоединяйте рабочие узлы ниже и сверяйтесь со схемой, если что-то пойдёт не так.', 'Every link you saw in the diagram can be checked on a real node: the kubelet certificate is in `/var/lib/kubelet/pki`, the request shows in `kubectl get csr`, and with an expired token join prints the same JWS message. Join the workers below and come back to the diagram if something goes wrong.') },
    {
      id: 'run-join',
      kind: 'text',
      step: 'practice',
      title: bi('На worker-1 и worker-2', 'On worker-1 and worker-2'),
      body: bi(
        '```bash\nsudo kubeadm join 10.10.1.11:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>\nsudo ls -l /var/lib/kubelet/pki          # на рабочем узле\nkubectl get nodes -o wide                 # на cp-1: три узла, все пока NotReady\nkubectl get csr                           # на cp-1, в первый час: Approved,Issued\n```\n\nСостояние NotReady здесь нормально: сети подов ещё нет, и ей посвящён следующий урок.',
        '```bash\nsudo kubeadm join 10.10.1.11:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>\nsudo ls -l /var/lib/kubelet/pki          # on the worker\nkubectl get nodes -o wide                 # on cp-1: three nodes, all NotReady for now\nkubectl get csr                           # on cp-1, within the first hour: Approved,Issued\n```\n\nNotReady is the normal state here: there is no pod network yet, that is the next lesson.',
      ),
    },
    {
      id: 'check-join',
      kind: 'widget',
      step: 'practice',
      widget: 'k8s.output-check',
      props: {
        where: bi('на worker-1', 'on worker-1'),
        command: 'sudo ls -l /var/lib/kubelet/pki\nsudo ls /etc/kubernetes',
        signs: [
          sign('client', ['клиентский сертификат kubelet получен', 'the kubelet client certificate was obtained'], 'kubelet-client-current\\.pem -> /var/lib/kubelet/pki/kubelet-client-\\d{4}-\\d{2}-\\d{2}', ['Ссылки kubelet-client-current.pem нет, значит, TLS bootstrap не закончился. Смотрите вывод journalctl -u kubelet на узле и kubectl get csr на cp-1.', 'There is no kubelet-client-current.pem link: the TLS bootstrap did not finish. Look at journalctl -u kubelet and kubectl get csr on cp-1.']),
          sign('conf', ['kubelet.conf записан', 'kubelet.conf is written'], '^kubelet\\.conf$'),
          sign('nobootstrap', ['bootstrap-kubelet.conf удалён', 'bootstrap-kubelet.conf is removed'], '^bootstrap-kubelet\\.conf$', ['kubeadm join удаляет файл с токеном после успешного входа. Если файл остался, join не завершился.', 'kubeadm join removes the token file after a successful login. If it is still there, join did not finish.'], { absent: true }),
        ],
      },
    },
    {
      id: 'real',
      kind: 'widget',
      step: 'exit',
      widget: 'k8s.real-check',
      props: {
        track: 'r3',
        checks: [
          check('nodes', ['Три узла зарегистрированы', 'Three nodes are registered'], 'k8s.nodes#>=3'),
          check('real', ['Ядра настоящие, а не симулятор', 'Real kernels, not the simulator'], "k8s.nodes#>=3 && k8s.nodes[kernel~'dt-sim']#=0"),
          check('cp', ['Есть узел управляющего слоя', 'There is a control-plane node'], "k8s.nodes[roles has 'control-plane']#>=1"),
          check('static', ['kube-apiserver и etcd работают статическими подами', 'kube-apiserver and etcd are static pods and running'], "k8s.pods[ns=kube-system][name~'kube-apiserver-'][ready=true]#>=1 && k8s.pods[ns=kube-system][name~'etcd-'][ready=true]#>=1"),
          check('cfg', ['kubeadm сохранил свою конфигурацию', 'kubeadm uploaded its configuration'], "k8s.objects[kind=ConfigMap][metadata.name=kubeadm-config].data.ClusterConfiguration~'podSubnet: 10.244.0.0/16'", ['Передайте в init флаг --pod-network-cidr=10.244.0.0/16, иначе узлам не выдадут podCIDR.', 'Pass --pod-network-cidr=10.244.0.0/16 to init, or the nodes get no podCIDR.']),
          check('version', ['Все узлы на версии 1.36', 'Every node is on 1.36'], "k8s.nodes[version~'v1.36.']#>=3"),
        ],
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'review', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s.q.real.static', ...kubeadmQuiz.map((q) => q.id)] },
  ],
};

export const cniLesson: Lesson = {
  id: 'k8s-2.cni',
  block: 'k8s-2',
  title: bi('Сеть подов на Cilium', 'The pod network: Cilium'),
  summary: bi('Почему после init узлы в состоянии NotReady, как плагин сети получает адреса подов, как поставить Cilium с закреплённой версией и проверить связь между узлами.', 'Why the nodes are NotReady after init, how a CNI gets pod addresses, installing Cilium with a pinned version and checking connectivity between nodes.'),
  introduces: ['k8s.ipam'],
  uses: ['k8s.cni', 'k8s.podcidr', 'k8s.kubeadm', 'k8s.network-model', 'k8s.kube-proxy'],
  tier: 'core',
  minutes: 45,
  sources: src([S.cilium, S.networking], [R.components, R.wikiVxlan]),
  sections: [
    {
      id: 'why',
      kind: 'text',
      step: 'explain',
      title: bi('Узел без сети', 'A node with no network'),
      body: bi(
        'После init и join кластер выглядит недоделанным: все три узла в состоянии NotReady, а CoreDNS в Pending. Так и должно быть. Сетевая модель Kubernetes обещает каждому поду свой адрес и связь с любым другим подом без трансляции адресов, но выполнять это обещание kubeadm поручает сетевому плагину, а плагина ещё нет. kubelet сообщает об этом в условии узла: `NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized`.\n\nВ k3s вы получили flannel готовым. Здесь вы поставите Cilium, сегодня один из самых распространённых плагинов. Он доставляет пакеты между узлами в конвертах VXLAN (UDP 8472), как flannel, но правила для подов пишет не цепочками iptables, а программами eBPF прямо в ядре, и он же исполняет NetworkPolicy.\n\nПервый вопрос любого плагина сети — откуда брать адреса подов, и отвечает на него [[k8s.ipam|IPAM]]. В режиме `ipam.mode=kubernetes` Cilium берёт podCIDR из объекта Node. Этот диапазон нарезал controller-manager из флага `--pod-network-cidr`, который вы передали в init: `10.244.0.0/24`, `10.244.1.0/24` и так далее. Если забыть этот флаг при init, у узлов не будет podCIDR, и агент Cilium в этом режиме не запустится. В режиме по умолчанию, `cluster-pool`, Cilium раздаёт адреса из собственного пула и podCIDR узла не использует вовсе. Это тоже рабочий вариант, но тогда адреса подов будут не теми, что записаны в kubeadm-config.',
        'After init and join the cluster looks unfinished: all three nodes are NotReady, CoreDNS is Pending. That is how it should be. The Kubernetes network model promises every pod an address of its own and a link to any other without NAT, but kubeadm leaves keeping that promise to a network plugin, and there is no plugin yet. The kubelet reports it in the node condition: `NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized`.\n\nIn k3s you got flannel ready-made. Here you install Cilium — one of the most widespread plugins today. It delivers packets between nodes with VXLAN wrapping (UDP 8472), as flannel does, but writes the rules for pods not as iptables chains but as eBPF programs right in the kernel; it also enforces NetworkPolicy.\n\nThe first question of any CNI is where to get addresses. That is [[k8s.ipam|IPAM]]. In the `ipam.mode=kubernetes` mode Cilium takes the podCIDR from the Node object: the controller-manager cut it out of the `--pod-network-cidr` you passed to init — `10.244.0.0/24`, `10.244.1.0/24` and so on. Forget the flag at init, and the nodes have no podCIDR, and the Cilium agent does not start in this mode. In the default mode, `cluster-pool`, Cilium hands out addresses from its own pool and does not use the node podCIDR at all — that works too, but then pod addresses will not be the ones you saw in kubeadm-config.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Пакет между узлами в конверте VXLAN', 'A packet between nodes in a VXLAN envelope'),
      body: bi(
        'Эту схему вы уже видели на первом этапе, и она годится для кластера с Cilium: пакет пода между узлами тоже идёт в конверте VXLAN на UDP-порт 8472. Под A на worker-1 отправляет пакет поду C на worker-2, и на шаге «конверт» пакет пода целиком кладётся внутрь пакета, на котором написаны адреса узлов.',
        'You saw this diagram in stage 1, and it fits a Cilium cluster: a pod packet between nodes also travels in a VXLAN envelope on UDP 8472. Pod A on worker-1 sends to pod C on worker-2, and at the “envelope” step the whole pod packet is put inside a packet addressed between the nodes.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.pod-network', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» и следите за карточкой на линии: на шаге «конверт» снаружи окажутся адреса узлов, а адреса подов уйдут внутрь.\n\nПотом включите в блоке «Сломать» закрытый порт UDP 8472. Так выглядит забытое правило межсетевого экрана в частной сети ваших машин: поды на одном узле видят друг друга, а пакеты между узлами пропадают.', 'Press “Start from the first step”, then go on with “Step forward” and watch the card: at the “envelope” step the node addresses are outside and the pod addresses inside.\n\nThen switch on the closed UDP 8472 in “Break it”. That is what a forgotten firewall rule looks like on your machines’ private network: pods on one node see each other, while packets between nodes vanish.'), params: { target: 'other', mode: 'vxlan' }, caption: bi('Если после установки поды одного узла видят друг друга, а между узлами пакеты пропадают, вспомните поломку с закрытым портом UDP 8472: так выглядит забытое правило межсетевого экрана.', 'If after the install pods on one node see each other while packets between nodes vanish, recall the closed UDP 8472 break: that is what a forgotten firewall rule looks like.') },
    {
      id: 'install',
      kind: 'text',
      step: 'practice',
      title: bi('Установка', 'The install'),
      body: bi(
        'Программу `cilium` скачайте со страницы установки Cilium. Версию самого Cilium закрепите и запишите, потому что на неё вы будете ссылаться при обновлении.\n\n```bash\ncilium install --version <закреплённая> --set ipam.mode=kubernetes\ncilium status --wait\nkubectl get nodes -o wide\nkubectl -n kube-system get pods -o wide\nkubectl create deployment web --image=nginx:1.29 --replicas=3\nkubectl get pods -o wide                       # адреса 10.244.x.y, поды на разных узлах\nkubectl run probe --rm -it --image=busybox:1.37 --restart=Never -- wget -qO- http://<IP пода на другом узле>\n```\n\nЕсли поды одного узла видят друг друга, а между узлами пакеты не проходят, почти всегда виноват межсетевой экран: проверьте порты 8472/udp и 4240/tcp в частной сети.',
        'Download the `cilium` CLI from the Cilium install page; pin the version of Cilium itself and write it down — you will refer to it when upgrading.\n\n```bash\ncilium install --version <pinned> --set ipam.mode=kubernetes\ncilium status --wait\nkubectl get nodes -o wide\nkubectl -n kube-system get pods -o wide\nkubectl create deployment web --image=nginx:1.29 --replicas=3\nkubectl get pods -o wide                       # addresses 10.244.x.y, pods on different nodes\nkubectl run probe --rm -it --image=busybox:1.37 --restart=Never -- wget -qO- http://<IP of a pod on another node>\n```\n\nIf pods of one node see each other while between nodes there is silence, it is almost always the firewall: check 8472/udp and 4240/tcp on the private network.',
      ),
    },
    {
      id: 'status',
      kind: 'widget',
      step: 'practice',
      widget: 'k8s.output-check',
      props: {
        where: bi('на cp-1', 'on cp-1'),
        command: 'cilium status --wait',
        signs: [
          sign('agent', ['Агенты Cilium: OK', 'Cilium agents: OK'], 'Cilium:\\s+OK'),
          sign('operator', ['Оператор Cilium: OK', 'Cilium operator: OK'], 'Operator:\\s+OK'),
          sign('ds', ['DaemonSet cilium готов на трёх узлах', 'DaemonSet cilium is ready on three nodes'], 'DaemonSet\\s+cilium\\s+Desired: 3, Ready: 3/3', ['Агент работает не на всех узлах. Команда kubectl -n kube-system get pods -l k8s-app=cilium -o wide покажет, на каком его нет.', 'The agent does not run on every node. kubectl -n kube-system get pods -l k8s-app=cilium -o wide shows where it is missing.']),
          sign('pods', ['Поды кластера работают в сети Cilium', 'The cluster pods are managed by Cilium'], 'Cluster Pods:\\s+(\\d+)/\\1 managed by Cilium', ['Часть подов запущена ещё до Cilium и работает в старой сети: перезапустите их (kubectl -n kube-system rollout restart deploy coredns).', 'Some pods were started before Cilium and are still on the old network: restart them (kubectl -n kube-system rollout restart deploy coredns).']),
        ],
      },
    },
    {
      id: 'real',
      kind: 'widget',
      step: 'exit',
      widget: 'k8s.real-check',
      props: {
        track: 'r3',
        checks: [
          check('ready', ['Три узла в состоянии Ready', 'Three nodes are Ready'], 'k8s.nodes[ready=true]#>=3'),
          check('cilium', ['Cilium работает на каждом узле', 'Cilium runs on every node'], 'k8s.objects[kind=DaemonSet][metadata.name=cilium].status.numberReady>=3', ['Команда `cilium status --wait` на cp-1 покажет, что не так.', '`cilium status --wait` on cp-1 shows what is wrong.']),
          check('cidr', ['У узлов podCIDR из 10.244.0.0/16', 'The nodes have podCIDRs from 10.244.0.0/16'], "k8s.nodes[podCIDR~'10.244.']#>=3"),
          check('dns', ['CoreDNS работает', 'CoreDNS is running'], "k8s.pods[ns=kube-system][name~'coredns'][ready=true]#>=1"),
          check('web', ['Deployment web: три готовых пода с адресами 10.244.x', 'Deployment web: three ready pods with 10.244.x addresses'], "k8s.deployments[ns=default][name=web].ready>=3 && k8s.pods[ns=default][ip~'10.244.']#>=3"),
          check('spread', ['Поды web разошлись хотя бы по двум узлам', 'The web pods spread over at least two nodes'], "k8s.pods[ns=default][node~'worker-1']#>=1 && k8s.pods[ns=default][node~'worker-2']#>=1"),
        ],
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'review', title: bi('Проверьте себя', 'Check yourself'), items: cniQuiz.map((q) => q.id) },
  ],
};

export const etcdLesson: Lesson = {
  id: 'k8s-2.etcd',
  block: 'k8s-2',
  title: bi('Снимок etcd и восстановление из него', 'An etcd snapshot and a restore'),
  summary: bi('etcd хранит весь кластер. В уроке вы снимете снимок с сертификатами, проверите его, восстановите через etcdutl в новый каталог, переключите на него статический под и проверите результат по фактам кластера.', 'etcd holds the whole cluster. A snapshot with certificates, checking the snapshot, a restore with etcdutl into a new directory, switching the static pod and a check by the cluster’s facts.'),
  introduces: ['k8s.etcd-snapshot'],
  uses: ['k8s.etcd', 'k8s.static-pod', 'k8s.pki', 'k8s.apiserver', 'k8s.namespace'],
  tier: 'core',
  minutes: 60,
  sources: src([S.etcdRecovery, S.etcdBackup], [R.components, R.wikiEtcd]),
  sections: [
    {
      id: 'why',
      kind: 'text',
      step: 'explain',
      title: bi('Одна база на весь кластер', 'One database for the whole cluster'),
      body: bi(
        'Все объекты кластера — Deployment, Service, Secret и та же NetworkPolicy — лежат в etcd под ключами `/registry/…`. Узлы, контейнеры и правила kube-proxy вторичны, потому что петли контроллеров построили их по записям etcd и построят заново. Если потерять etcd, потеряется и кластер, даже если все машины целы. Поэтому [[k8s.etcd-snapshot|снимок etcd]] служит главной страховкой администратора.\n\nСнимок снимают с **работающего** etcd по сети. Команда `etcdctl snapshot save` обращается на `https://127.0.0.1:2379` и, как любой клиент etcd в кластере kubeadm, предъявляет сертификат, подписанный центром etcd. Эти файлы лежат в `/etc/kubernetes/pki/etcd`. Получается один файл со всеми ключами на момент снимка. Команда `etcdutl snapshot status` показывает его хеш, ревизию, число ключей и размер, и так вы убеждаетесь, что файл цел, ещё до того, как он понадобится. Копию файла увозят с узла, потому что снимок, оставшийся на диске сломанной машины, ничем не поможет.\n\nВосстановление устроено иначе, потому что работает не с сервером, а с файлом. В etcd 3.6 его выполняет `etcdutl snapshot restore`, а у `etcdctl` этой команды больше нет, хотя многие инструкции в интернете написаны для старых версий. restore записывает **новый** каталог данных, в существующий писать отказывается и даёт etcd новый идентификатор кластера. Остаётся направить etcd на новый каталог. etcd в kubeadm работает статическим подом, поэтому достаточно поменять путь `hostPath` тома `etcd-data` в `/etc/kubernetes/manifests/etcd.yaml`, и kubelet увидит изменённый файл и пересоздаст под. На время подмены API-сервер останавливают, убрав его манифест из каталога, чтобы он не писал в старую базу.\n\nВсё, что записали после снимка, пропадёт. Поэтому снимки и делают по расписанию, а манифесты приложений держат в Git, чтобы после восстановления применить их заново.',
        'Every object of the cluster — Deployments, Services, Secrets, the NetworkPolicy itself — lives in etcd under `/registry/…` keys. Nodes, containers, kube-proxy rules — all of it is derived: the controller loops built it from the etcd records and will build it again. Lose etcd and you lose the cluster, even if every machine is intact. That is why an [[k8s.etcd-snapshot|etcd snapshot]] is an administrator’s main insurance.\n\nA snapshot is taken from the **running** etcd over the network: `etcdctl snapshot save` goes to `https://127.0.0.1:2379` and, like any etcd client in a kubeadm cluster, presents a certificate signed by the etcd CA — the files are in `/etc/kubernetes/pki/etcd`. The result is one file with every key at the moment of the snapshot. `etcdutl snapshot status` shows its hash, revision, number of keys and size: that is how you know the file is whole before trouble comes. A copy is taken off the node — a snapshot on the disk of a dead VM saves nothing.\n\nA restore works differently: it works on a file, not a server. In etcd 3.6 it is done by `etcdutl snapshot restore`; `etcdctl` no longer has that command, although many instructions on the internet are written for older versions. restore writes a **new** data directory — it refuses to write into an existing one — and gives etcd a new cluster ID. What remains is pointing etcd at the new directory. In kubeadm etcd is a static pod, so changing the `hostPath` of the `etcd-data` volume in `/etc/kubernetes/manifests/etcd.yaml` is enough: the kubelet sees the changed file and recreates the pod. While the database is swapped, the API server is stopped by moving its manifest out of the directory, so that it does not write to the old database.\n\nEverything written after the snapshot is lost. That is exactly why snapshots run on a schedule and application manifests live in Git: after a restore they are applied again.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Снимок и восстановление по шагам', 'Snapshot and restore step by step'),
      body: bi(
        'Схема ниже проходит те же учения, которые вы потом выполните на cp-1. Сначала на ней работающий API-сервер и etcd. Дальше по одному появятся etcdctl, который снимает снимок, файл снимка, etcdutl, который его проверяет и восстанавливает, новый каталог данных и манифест etcd, в котором меняется путь к данным.',
        'The diagram below walks the same drill you will run on cp-1. At first: the running API server and etcd. Then etcdctl, the snapshot file, etcdutl, the new data directory and the etcd manifest appear one by one.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.etcd-restore', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». По ходу вы снимете снимок, кластер поработает ещё, кто-то удалит namespace, и вы восстановите кластер из снимка. Счётчики под схемой покажут, сколько объектов вернулось и сколько пропало.\n\nПотом поменяйте в «Параметрах» команду восстановления на etcdctl и сдвиньте число объектов, записанных после снимка. Затем включите в блоке «Сломать» по очереди восстановление в уже существующий каталог и забытый путь в манифесте и прочитайте, что ответят инструменты.', 'Press “Start from the first step”, then go on with “Step forward”: you take a snapshot, the cluster keeps working, someone deletes a namespace, and you restore the cluster from the snapshot. The counters under the diagram show how many objects came back and how many were lost.\n\nThen switch the restore command to etcdctl in “Parameters” and change the number of objects written after the snapshot. Next, in “Break it”, switch on a restore into an existing directory and a forgotten path in the manifest one at a time and read what the tools answer.'), caption: bi('В учениях ниже вы пройдёте те же шаги на настоящем cp-1, и сообщения инструментов будут такими же, как на схеме. Если после восстановления namespace after-backup останется на месте, вспомните поломку с забытым hostPath: etcd всё ещё работает на старом каталоге.', 'In the drill below you walk the same steps on the real cp-1, and the tools print the same messages as in the diagram. If namespace after-backup is still there after the restore, recall the forgotten hostPath break: etcd still runs on the old directory.') },
    {
      id: 'docs',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте справку etcdutl snapshot. В каком разделе описан флаг, который задаёт каталог, куда пишет restore?', 'Open the etcdutl snapshot help. Which section describes the flag that sets the directory restore writes to?'),
      ref: { page: 'help/etcdutl-snapshot', anchor: 'restore', line: '--data-dir' },
      answer: 'restore',
    },
    {
      id: 'drill',
      kind: 'text',
      step: 'practice',
      title: bi('Учения со снимком, бедой и восстановлением', 'A drill with a snapshot, a disaster and a restore'),
      body: bi(
        'Учения построены так, чтобы результат было видно по фактам кластера, а не на слово.\n\n```bash\nkubectl create namespace before-backup                       # 1. это должно вернуться\nsudo mkdir -p /opt/backup\nsudo ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key \\\n  snapshot save /opt/backup/etcd.db                          # 2. снимок\nsudo etcdutl snapshot status /opt/backup/etcd.db -w table    # 3. проверка\nkubectl create namespace after-backup                        # 4. это должно пропасть\nsudo mv /etc/kubernetes/manifests/kube-apiserver.yaml /root/ # 5. стоп API\nsudo etcdutl snapshot restore /opt/backup/etcd.db --data-dir /var/lib/etcd-restore\nsudo sed -i \'s#path: /var/lib/etcd$#path: /var/lib/etcd-restore#\' /etc/kubernetes/manifests/etcd.yaml\nsudo crictl ps --name etcd                                   # 6. дождитесь нового etcd\nsudo mv /root/kube-apiserver.yaml /etc/kubernetes/manifests/ # 7. API назад\nkubectl get ns before-backup after-backup\n```\n\nВ `etcd.yaml` меняется только `hostPath` тома, а не флаг `--data-dir` внутри контейнера: внутри контейнера etcd по-прежнему видит свой каталог по старому пути, только теперь на этом месте смонтирован новый каталог.',
        'The drill is built so that the result shows in the cluster’s facts, not on your word.\n\n```bash\nkubectl create namespace before-backup                       # 1. this must come back\nsudo mkdir -p /opt/backup\nsudo ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key \\\n  snapshot save /opt/backup/etcd.db                          # 2. the snapshot\nsudo etcdutl snapshot status /opt/backup/etcd.db -w table    # 3. the check\nkubectl create namespace after-backup                        # 4. this must disappear\nsudo mv /etc/kubernetes/manifests/kube-apiserver.yaml /root/ # 5. stop the API\nsudo etcdutl snapshot restore /opt/backup/etcd.db --data-dir /var/lib/etcd-restore\nsudo sed -i \'s#path: /var/lib/etcd$#path: /var/lib/etcd-restore#\' /etc/kubernetes/manifests/etcd.yaml\nsudo crictl ps --name etcd                                   # 6. wait for the new etcd\nsudo mv /root/kube-apiserver.yaml /etc/kubernetes/manifests/ # 7. the API back\nkubectl get ns before-backup after-backup\n```\n\nThe edit of `etcd.yaml` changes only the volume’s `hostPath`, not the `--data-dir` flag inside the container: inside, etcd still sees its directory at the old path, there is just a new one mounted in its place now.',
      ),
    },
    {
      id: 'status',
      kind: 'widget',
      step: 'practice',
      widget: 'k8s.output-check',
      props: {
        where: bi('на cp-1, после шага 3', 'on cp-1, after step 3'),
        command: 'sudo etcdutl snapshot status /opt/backup/etcd.db -w table',
        signs: [
          sign('table', ['Таблица status: хеш, ревизия, число ключей и размер', 'The status table: hash, revision, keys, size'], 'HASH\\s*\\|\\s*REVISION\\s*\\|\\s*TOTAL KEYS\\s*\\|\\s*TOTAL SIZE', ['Без таблицы нет и проверки. Если файл не найден, снимок не записался: проверьте путь и сертификаты.', 'No table, no check. If the file is not found, the snapshot was not written: check the path and the certificates.']),
          sign('keys', ['В снимке есть ключи', 'The snapshot has keys'], '\\|\\s*[0-9a-f]{8}\\s*\\|\\s*\\d+\\s*\\|\\s*[1-9]\\d*\\s*\\|'),
          sign('v36', ['Снимок сделан etcd версии 3.6', 'The snapshot was made by etcd 3.6'], '\\|\\s*3\\.6\\.\\d+\\s*\\|', ['В последнем столбце другая версия: сверьтесь с документацией для своей версии etcd.', 'The version in the last column differs: check the documentation of your etcd version.']),
        ],
      },
    },
    {
      id: 'real',
      kind: 'widget',
      step: 'exit',
      widget: 'k8s.real-check',
      props: {
        track: 'r3',
        checks: [
          check('before', ['Namespace before-backup вернулся из снимка', 'Namespace before-backup came back from the snapshot'], 'k8s.objects[kind=Namespace][metadata.name=before-backup]#=1', ['Создайте before-backup до снимка: так видно, что кластер работает на данных снимка.', 'Create before-backup before the snapshot: that shows the cluster runs on the snapshot data.']),
          check('after', ['Namespace after-backup пропал вместе со всем, что было записано после снимка', 'Namespace after-backup is gone with everything after the snapshot'], 'k8s.objects[kind=Namespace][metadata.name=after-backup]#=0', ['after-backup на месте, значит, etcd работает на старых данных. Проверьте hostPath тома etcd-data в etcd.yaml.', 'after-backup is still there — etcd runs on the old data. Check the hostPath of the etcd-data volume in etcd.yaml.']),
          check('api', ['API-сервер и etcd снова работают', 'The API server and etcd run again'], "k8s.pods[ns=kube-system][name~'kube-apiserver-'][ready=true]#>=1 && k8s.pods[ns=kube-system][name~'etcd-'][ready=true]#>=1"),
          check('nodes', ['Все узлы в состоянии Ready', 'Every node is Ready'], 'k8s.nodes[ready=true]#>=3'),
        ],
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'review', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s.q.real.etcdutl', ...etcdQuiz.map((q) => q.id)] },
  ],
};

export const upgradeLesson: Lesson = {
  id: 'k8s-2.upgrade',
  block: 'k8s-2',
  title: bi('Обновление с 1.36 на 1.37', 'The upgrade 1.36 → 1.37'),
  summary: bi('Что говорит правило расхождения версий, как работают kubeadm upgrade plan и apply, как вывести узел командой drain, обновить kubelet и вернуть узел в работу, по одному узлу за раз.', 'The version skew policy, kubeadm upgrade plan and apply, taking a node out with a drain, upgrading the kubelet and bringing the node back — one at a time.'),
  introduces: ['k8s.version-skew', 'k8s.drain'],
  uses: ['k8s.kubeadm', 'k8s.static-pod', 'k8s.kubelet', 'k8s.pki', 'k8s.deployment'],
  tier: 'core',
  minutes: 75,
  sources: src([S.upgrade, S.skew, S.drain], [R.installKubeadm, R.nodes]),
  sections: [
    {
      id: 'skew',
      kind: 'text',
      step: 'explain',
      title: bi('Какой компонент может быть новее какого', 'Who may be newer than whom'),
      body: bi(
        'Kubernetes выпускает новую минорную версию примерно раз в четыре месяца и поддерживает три последние. Кластер, который не обновляют, через год с небольшим остаётся без исправлений безопасности, а заодно и без действующих сертификатов, о которых вы уже знаете.\n\nКластер обновляют не целиком сразу, а по частям, и порядок задаёт [[k8s.version-skew|правило расхождения версий]]. Главная его мысль состоит в том, что API-сервер должен быть самым новым компонентом кластера. controller-manager и scheduler не могут быть новее него. kubelet тоже не может быть новее, зато может отставать на три минорные версии. kubectl допускает расхождение на одну версию в обе стороны. Поэтому сначала обновляют управляющий слой, а потом узлы. Есть и правило самого kubeadm, по которому он обновляет кластер только на одну минорную версию за раз, и путь с 1.36 на 1.38 лежит через 1.37.\n\nПеред обновлением kubelet узел выводят из работы командой [[k8s.drain|drain]]. Команда `kubectl drain` сначала делает cordon, то есть помечает узел как закрытый для новых подов, а затем выселяет текущие поды через Eviction API, и каждый под получает сигнал SIGTERM и время на завершение, а ReplicaSet тем временем создаёт замену на других узлах. Выселение соблюдает PodDisruptionBudget, бюджет того, сколько подов приложения может отсутствовать одновременно. Поды DaemonSet drain не трогает, потому что их контроллер тут же вернул бы их на место, поэтому нужен флаг `--ignore-daemonsets`. После обновления узел возвращают в работу командой `kubectl uncordon`, и только потом берутся за следующий.',
        'Kubernetes releases a minor version about every four months and supports the latest three. A cluster nobody upgrades is left without security fixes in a little over a year — and without valid certificates, which you already know about.\n\nA cluster is upgraded not all at once but piece by piece, and the order is set by the [[k8s.version-skew|version skew policy]]. Its main idea: the API server is the newest component of the cluster. The controller-manager and the scheduler may not be newer than it. The kubelet may not be newer either, but it may lag by three minor versions. kubectl tolerates a difference of one either way. Hence the order: the control plane first, then the nodes. kubeadm has a rule of its own too: it upgrades only one minor version at a time, and the way from 1.36 to 1.38 goes through 1.37.\n\nBefore the kubelet is upgraded, the node is taken out of service — a [[k8s.drain|drain]]. `kubectl drain` first cordons (the node is marked unschedulable, no new pods arrive), then evicts the current pods through the Eviction API: every pod gets SIGTERM and time to finish, while the ReplicaSet creates replacements on other nodes. Eviction honours the PodDisruptionBudget — the budget of "how many pods of an application may be missing at once". drain leaves DaemonSet pods alone (their controller would bring them right back), hence the `--ignore-daemonsets` flag. After the upgrade the node is returned with `kubectl uncordon`, and only then is the next one taken.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Обновление кластера по шагам', 'A cluster upgrade step by step'),
      body: bi(
        'Схема ниже показывает порядок обновления с v1.36 на v1.37. Сначала на ней ваша команда kubeadm upgrade, управляющий узел cp-1 и два рабочих узла, и под каждым узлом напечатана его версия. Правило расхождения версий и приложение web появятся, когда они станут важны.',
        'The diagram below shows the order of an upgrade from v1.36 to v1.37. At first: your kubeadm upgrade, cp-1 and two workers, each with its version. The skew policy and the web application appear when they matter.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.upgrade', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Каждый шаг обновляет одну машину, сначала управляющий узел, а потом рабочие узлы по одному. Счётчик под схемой показывает, сколько подов web оставалось готовыми в худший момент.\n\nПотом выберите в «Параметрах» по очереди обновление сразу до v1.38, обратный порядок, при котором рабочие узлы обновляют первыми, и обновление без drain и посмотрите, что скажут kubeadm и правило версий. Затем включите в блоке «Сломать» по очереди пакеты, которые забыли открепить командой apt-mark unhold, и бюджет доступности, который требует все три пода, и посмотрите, на каком шаге остановится обновление.', 'Press “Start from the first step”, then go on with “Step forward”: each step upgrades one machine, the control-plane node first, then the workers one by one. The counter under the diagram shows how many web pods stayed ready at the worst moment.\n\nThen choose in “Parameters”, one at a time, an upgrade straight to v1.38, the reverse order in which the workers go first, and an upgrade without drain, and see what kubeadm and the version skew policy say. Next, in “Break it”, switch on packages someone forgot to release with apt-mark unhold and a disruption budget that demands all three pods, one at a time, and see at which step the upgrade stops.'), caption: bi('Порядок, который вы видели на схеме, расписан по командам в следующем разделе. Перед каждым drain вспомните, какой бюджет доступности стоит у ваших приложений, а если команда kubeadm откажет, прочитайте сообщение: оно называет нарушенное правило так же, как на схеме.', 'The order you saw in the diagram is spelled out as commands in the next section. Before each drain, recall the disruption budget of your applications, and if kubeadm refuses, read the message: it names the broken rule just as the diagram did.') },
    {
      id: 'docs',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте страницу Version Skew Policy и найдите раздел, где сказано, на сколько версий kubelet может отставать от API-сервера.', 'Open the Version Skew Policy and find the section that says how many versions the kubelet may lag behind the API server.'),
      ref: { page: 'web/kubernetes.io/docs/setup/release/version-skew-policy', anchor: 'kubelet', line: 'three minor versions older' },
      answer: 'kubelet',
    },
    {
      id: 'steps',
      kind: 'text',
      step: 'practice',
      title: bi('Порядок работ', 'The order of work'),
      body: bi(
        'Перед началом сделайте свежий снимок etcd: это страховка на случай, если обновление пойдёт не так.\n\n**cp-1.** Переключите репозиторий на v1.37 (адрес записан в `/etc/apt/sources.list.d/kubernetes.list`), снимите закрепление только с kubeadm и поставьте новую версию:\n\n```bash\nsudo sed -i \'s/v1.36/v1.37/\' /etc/apt/sources.list.d/kubernetes.list && sudo apt-get update\nsudo apt-mark unhold kubeadm && sudo apt-get install -y kubeadm=\'1.37.*\' && sudo apt-mark hold kubeadm\nsudo kubeadm upgrade plan\nsudo kubeadm upgrade apply v1.37.<x>\nkubectl drain cp-1 --ignore-daemonsets\nsudo apt-mark unhold kubelet kubectl && sudo apt-get install -y kubelet=\'1.37.*\' kubectl=\'1.37.*\' && sudo apt-mark hold kubelet kubectl\nsudo systemctl daemon-reload && sudo systemctl restart kubelet\nkubectl uncordon cp-1\n```\n\nКоманда `upgrade apply` по очереди меняет образы в манифестах статических подов, kubelet перезапускает компоненты, а сертификаты управляющего слоя заодно продлеваются ещё на год.\n\n**worker-1, затем worker-2.** На узле подключите тот же репозиторий, поставьте новый kubeadm и выполните `sudo kubeadm upgrade node`. С cp-1 выполните `kubectl drain worker-1 --ignore-daemonsets`. Снова на узле поставьте новые kubelet и kubectl, выполните `daemon-reload` и перезапустите kubelet. С cp-1 выполните `kubectl uncordon worker-1`. Убедитесь, что поды web снова готовы, и только потом берите worker-2.',
        'Before you start, take a fresh etcd snapshot — insurance in case the upgrade goes wrong.\n\n**cp-1.** Switch the repository to v1.37 (the address in `/etc/apt/sources.list.d/kubernetes.list`), lift the hold from kubeadm only and install the new version:\n\n```bash\nsudo sed -i \'s/v1.36/v1.37/\' /etc/apt/sources.list.d/kubernetes.list && sudo apt-get update\nsudo apt-mark unhold kubeadm && sudo apt-get install -y kubeadm=\'1.37.*\' && sudo apt-mark hold kubeadm\nsudo kubeadm upgrade plan\nsudo kubeadm upgrade apply v1.37.<x>\nkubectl drain cp-1 --ignore-daemonsets\nsudo apt-mark unhold kubelet kubectl && sudo apt-get install -y kubelet=\'1.37.*\' kubectl=\'1.37.*\' && sudo apt-mark hold kubelet kubectl\nsudo systemctl daemon-reload && sudo systemctl restart kubelet\nkubectl uncordon cp-1\n```\n\n`upgrade apply` changes the images in the static pod manifests one by one — the kubelet restarts the components — and renews the control-plane certificates for another year along the way.\n\n**worker-1, then worker-2.** On the node: the same repository, the new kubeadm and `sudo kubeadm upgrade node`. From cp-1: `kubectl drain worker-1 --ignore-daemonsets`. On the node again: the new kubelet and kubectl, `daemon-reload`, a kubelet restart. From cp-1: `kubectl uncordon worker-1`. Make sure the web pods are ready again — and only then take worker-2.',
      ),
    },
    {
      id: 'real',
      kind: 'widget',
      step: 'exit',
      widget: 'k8s.real-check',
      props: {
        track: 'r3',
        checks: [
          check('cfg', ['kubeadm записал новую версию кластера', 'kubeadm recorded the new cluster version'], "k8s.objects[kind=ConfigMap][metadata.name=kubeadm-config].data.ClusterConfiguration~'kubernetesVersion: v1.37'"),
          check('api', ['kube-apiserver работает на образе версии 1.37', 'kube-apiserver runs the 1.37 image'], "k8s.pods[ns=kube-system][name~'kube-apiserver-'][image~':v1.37.'][ready=true]#>=1"),
          check('nodes', ['kubelet 1.37 на всех трёх узлах', 'kubelet 1.37 on all three nodes'], "k8s.nodes[version~'v1.37.']#>=3 && k8s.nodes[version~'v1.36.']#=0", ['Какой-то узел ещё не обновлён, или kubelet не перезапущен после установки пакета.', 'A node with the old version is not upgraded yet — or the kubelet was not restarted after the package install.']),
          check('uncordon', ['Все узлы снова принимают поды', 'Every node accepts pods again'], 'k8s.nodes[unschedulable=true]#=0', ['Узел остался закрытым для новых подов: выполните kubectl uncordon <узел>.', 'A node is still cordoned: kubectl uncordon <node>.']),
          check('ready', ['Все узлы в состоянии Ready, у web три готовых пода', 'Every node is Ready, web has three ready pods'], 'k8s.nodes[ready=true]#>=3 && k8s.deployments[ns=default][name=web].ready>=3'),
        ],
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'review', title: bi('Проверьте себя', 'Check yourself'), items: upgradeQuiz.map((q) => q.id) },
  ],
};

export const repairLesson: Lesson = {
  id: 'k8s-2.repair',
  block: 'k8s-2',
  title: bi('Поломка, починка и уборка', 'A break, a repair and the cleanup'),
  summary: bi('Остановленный kubelet и узел в состоянии NotReady, пропавший манифест планировщика, продление сертификатов и обязательная уборка по метке.', 'A stopped kubelet and a NotReady node, a vanished scheduler manifest, renewing certificates — and the mandatory cleanup by label.'),
  introduces: [],
  uses: ['k8s.kubelet', 'k8s.static-pod', 'k8s.scheduler', 'k8s.pki', 'k8s.drain'],
  tier: 'core',
  minutes: 60,
  sources: src([S.nodes, S.staticPod, S.pki], [R.nodes, R.components]),
  sections: [
    {
      id: 'kubelet',
      kind: 'text',
      step: 'explain',
      title: bi('Первая поломка, при которой узел перестаёт отвечать', 'Break one, in which a node stops answering'),
      body: bi(
        'На `worker-2` выполните `sudo systemctl stop kubelet` и наблюдайте с cp-1 командами `kubectl get nodes -w` и `kubectl get pods -o wide -w`. Через 40–50 секунд без продления Lease узел станет NotReady, а ещё через пять минут поды с него выселят и создадут заново на других узлах. Это то же самое, что вы видели на схеме «Узел выключился» на первом этапе, только теперь на настоящих машинах и по настоящим часам.\n\nОбратите внимание, что контейнеры на `worker-2` при этом продолжают работать: их держит containerd, а kubelet только управлял ими. Когда вы снова запустите kubelet (`sudo systemctl start kubelet`), он сверит, какие поды назначены его узлу, и остановит лишние.',
        'On `worker-2` run `sudo systemctl stop kubelet` and watch from cp-1: `kubectl get nodes -w` and `kubectl get pods -o wide -w`. After 40–50 seconds without a Lease renewal the node becomes NotReady, and five minutes later its pods are evicted and recreated on other nodes. This is exactly what you saw in the "a node went down" explainer in stage 1 — only now on real machines with a real clock.\n\nNotice that the containers on `worker-2` keep running meanwhile: containerd holds them, the kubelet only managed them. When you bring the kubelet back (`sudo systemctl start kubelet`), it checks which pods are assigned to its node and stops the extra ones.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как кластер замечает остановленный kubelet', 'How the cluster notices a stopped kubelet'),
      body: bi(
        'Схема ниже знакома вам по первому этапу, и на ваших машинах происходит то же самое. Остановленный kubelet перестаёт продлевать отметку о жизни узла (Lease), контроллер узлов через срок ожидания помечает узел недоступным, а когда истекает время, которое под готов ждать на недоступном узле, поды выселяют.',
        'You know the diagram below from stage 1, and the same happens on your machines. A stopped kubelet stops renewing the node’s Lease, the node controller marks the node unreachable after the grace period, and once the time a pod is willing to wait on an unreachable node runs out, the pods are evicted.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.node-down', howto: bi('Нажмите «Начать с первого шага» и листайте кнопкой «Шаг вперёд». Каждый шаг соответствует моменту времени, и на шкале под схемой подписано, сколько секунд прошло с остановки kubelet.', 'Press “Start from the first step” and go on with “Step forward”. Each step is a moment in time, and the scale under the diagram shows how many seconds have passed since the kubelet stopped.'), caption: bi('Сравните время на схеме с тем, что показала команда `kubectl get nodes -w` на ваших машинах: узел должен стать NotReady примерно через 50 секунд, а поды переехать ещё через пять минут. Если у вас вышло иначе, посмотрите в «Параметрах» схемы, какой таймер дал бы такое время.', 'Compare the times in the diagram with what `kubectl get nodes -w` showed on your machines: the node should become NotReady after about 50 seconds and the pods move five minutes later. If yours differ, find in the diagram’s “Parameters” which timer would give such times.') },
    {
      id: 'sched',
      kind: 'text',
      step: 'explain',
      title: bi('Вторая поломка, при которой пропадает планировщик', 'Break two, in which the scheduler disappears'),
      body: bi(
        'На cp-1 выполните `sudo mv /etc/kubernetes/manifests/kube-scheduler.yaml /root/`. kubelet заметит, что файл пропал, и остановит под. Теперь выполните `kubectl scale deployment web --replicas=5`: два новых пода останутся в Pending без узла и без единого события FailedScheduling, потому что писать его некому. По этому признаку отсутствующий планировщик отличают от планировщика, который не нашёл места. Верните файл, и через несколько секунд поды разойдутся по узлам.\n\nСертификаты чинят похожим образом. Команда `sudo kubeadm certs check-expiration` показывает оставшиеся сроки, а `sudo kubeadm certs renew all` продлевает их, но уже запущенные компоненты держат старые сертификаты в памяти. Поэтому перезапустите статические поды: уберите манифест из каталога и верните его через двадцать секунд. А свой `~/.kube/config` обновите из нового `admin.conf`.',
        'On cp-1: `sudo mv /etc/kubernetes/manifests/kube-scheduler.yaml /root/`. The kubelet notices the file is gone and stops the pod. Now `kubectl scale deployment web --replicas=5`: two new pods hang in Pending — with no node and not a single FailedScheduling event, because nobody is there to write it. That is the sign that tells a missing scheduler from a scheduler that found no room. Put the file back — a few seconds later the pods spread over the nodes.\n\nCertificates are repaired in a similar way. `sudo kubeadm certs check-expiration` shows the remaining terms; `sudo kubeadm certs renew all` renews them, but the running components keep the old certificates in memory. Restart the static pods — move a manifest out of the directory and back after twenty seconds — and refresh your `~/.kube/config` from the new `admin.conf`.',
      ),
    },
    {
      id: 'real',
      kind: 'widget',
      step: 'practice',
      widget: 'k8s.real-check',
      props: {
        track: 'r3',
        checks: [
          check('nodes', ['Все три узла снова в состоянии Ready', 'All three nodes are Ready again'], 'k8s.nodes[ready=true]#>=3'),
          check('sched', ['Планировщик вернулся', 'The scheduler is back'], "k8s.pods[ns=kube-system][name~'kube-scheduler-'][ready=true]#>=1"),
          check('web', ['web: пять готовых подов', 'web: five ready pods'], 'k8s.deployments[ns=default][name=web].ready>=5'),
          check('pending', ['Ни одного пода в Pending', 'Not a single pod in Pending'], 'k8s.pods[phase=Pending]#=0'),
        ],
      },
    },
    { id: 'cost', kind: 'callout', tone: 'cost', step: 'review', title: bi('Счёт всё ещё растёт', 'The meter is still running'), body: bi('Три виртуальные машины, их диски и адреса оплачиваются каждый час, даже если вы закрыли ноутбук. Этап заканчивается не на последней проверке, а на пустом списке машин.', 'Three VMs, their disks and addresses are billed every hour, even if you closed your laptop. The stage ends not at the last check but at an empty list of VMs.') },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      step: 'review',
      title: bi('Уборка обязательна', 'Cleanup — mandatory'),
      body: bi(
        'Удаляйте машины по метке, а не по памяти, и убедитесь, что список пуст:\n\n```bash\nhcloud server list -l trainer=devops -o json     # должно стать []\nhcloud server delete cp-1 worker-1 worker-2\nhcloud network delete trainer\nhcloud server list -l trainer=devops -o json\n```\n\nВ другом облаке порядок тот же: список по метке `trainer=devops`, удаление и повторный список. Снимок etcd и kubeconfig оставьте себе: они пригодятся, когда тот же кластер вы будете собирать кодом.',
        'Delete by the label, not from memory, and make sure the list is empty:\n\n```bash\nhcloud server list -l trainer=devops -o json     # must become []\nhcloud server delete cp-1 worker-1 worker-2\nhcloud network delete trainer\nhcloud server list -l trainer=devops -o json\n```\n\nIn another cloud the same: a list by the `trainer=devops` label, the deletion, the list again. Keep the etcd snapshot and the kubeconfig: they will come in handy when you assemble the same cluster from code.',
      ),
    },
    {
      id: 'empty',
      kind: 'widget',
      step: 'review',
      widget: 'k8s.output-check',
      props: {
        where: bi('на своём компьютере, после удаления', 'on your own computer, after the deletion'),
        command: 'hcloud server list -l trainer=devops -o json',
        signs: [sign('empty', ['Ни одной машины с меткой trainer=devops', 'No VM labelled trainer=devops'], '^\\s*\\[\\s*\\]\\s*$', ['Список не пуст: какая-то машина ещё работает и стоит денег.', 'The list is not empty: some VM is still running and costing money.'], { flags: '' })],
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'review', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s.q.real.cleanup', ...repairQuiz.map((q) => q.id)] },
  ],
};

export const KUBEADM_LESSONS: Lesson[] = [prepareLesson, kubeadmLesson, cniLesson, etcdLesson, upgradeLesson, repairLesson];
