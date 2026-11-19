// The stage-2 exam (05 §10, §11.5; 00 §6.6): the kubeadm cluster the learner
// built on three VMs of their own. The trainer runs nothing there. On the
// control-plane node the read-only public/check/trainer-check.sh with
// --machine prints one block with the cluster's objects (kubectl get) and the
// node's probes — static Pod manifests, the CNI configuration, the etcd
// snapshot and its status, the etcd data directories, the versions, the
// timers; the exam page decodes it into dt.facts/v1 and the goals below judge
// those facts, by state, not by the commands typed. The faults are planted
// by the learner with the command the card shows, after a marker ConfigMap,
// so the repair is proven by timestamps of the cluster itself.

import YAML from 'yaml';
import { bi } from '../../core/i18n';
import type { Exam, Facts, RealGoal } from '../../core/types';
import { blobFacts, type CheckBlob } from '../../engine/kube-lite/checkblob';
import type { K8sFacts } from '../../engine/kube-lite/facts';
import type { Obj } from '../../engine/kube-lite/util';
import collectorText from '../../../public/check/trainer-check.sh?raw';

export const TRACK = 'k8s-2';
export const TARGET = 'v1.37.';
const CP = 'cp-1';

// ── reading the block ──

const text = (f: Facts, key: string) => ((f.files?.[key] as { text?: string } | undefined)?.text ?? '') as string;

const clusters = new WeakMap<Facts, K8sFacts | null>();
/** The cluster's facts carried in the node block (`dt:k8s`), in the shape the simulator's checks read. */
export function cluster(f: Facts): K8sFacts | undefined {
  if (!clusters.has(f)) {
    let k: K8sFacts | null = null;
    try {
      const blob = JSON.parse(text(f, 'dt:k8s')) as CheckBlob;
      if (blob.schema === 'dt.k8s-check/v1') k = blobFacts(blob).k8s as K8sFacts;
    } catch {
      k = null;
    }
    clusters.set(f, k);
  }
  return clusters.get(f) ?? undefined;
}

export interface SnapshotFact {
  path: string;
  exists: boolean;
  size?: number;
  mtime?: number;
  status?: { hash?: number; revision?: number; totalKey?: number; totalSize?: number; version?: string } | null;
}
export function snapshot(f: Facts): SnapshotFact | undefined {
  try {
    return JSON.parse(text(f, 'dt:snapshot')) as SnapshotFact;
  } catch {
    return undefined;
  }
}

/** '/var/lib/etcd-restore member' lines → the directories that hold an etcd member. */
const etcdDirs = (f: Facts) => text(f, 'dt:etcd-dirs').split('\n').map((l) => l.trim().split(/\s+/)).filter((x) => x[0]);
const version = (f: Facts, tool: string) => new RegExp(`^${tool} (\\S+)`, 'm').exec(text(f, 'dt:versions'))?.[1] ?? '';
const manifestPath = (name: string) => `/etc/kubernetes/manifests/${name}.yaml`;
const manifest = (f: Facts, name: string): Obj | undefined => {
  try {
    return YAML.parse(text(f, manifestPath(name))) as Obj;
  } catch {
    return undefined;
  }
};
/** The hostPath of the etcd-data volume in etcd.yaml: the directory etcd really runs on. */
export const etcdDataDir = (f: Facts) => (manifest(f, 'etcd')?.spec?.volumes ?? []).find((v: Obj) => v.name === 'etcd-data')?.hostPath?.path as string | undefined;
const clusterConfig = (f: Facts): Obj | undefined => {
  const cm = obj(f, 'ConfigMap', 'kube-system', 'kubeadm-config');
  try {
    return cm?.data?.ClusterConfiguration ? (YAML.parse(cm.data.ClusterConfiguration) as Obj) : undefined;
  } catch {
    return undefined;
  }
};
const unit = (f: Facts, name: string) => ((f.units ?? {}) as Record<string, { active: string; enabled: string }>)[name];

const objects = (f: Facts) => cluster(f)?.objects ?? [];
const obj = (f: Facts, kind: string, ns: string | undefined, name: string) => objects(f).find((o) => o.kind === kind && o.metadata?.name === name && (ns === undefined || (o.metadata?.namespace ?? '') === ns));
const nodes = (f: Facts) => cluster(f)?.nodes ?? [];
const at = (s: unknown) => (typeof s === 'string' ? Date.parse(s) : NaN);
const collected = (f: Facts) => at(f.env?.at);

/** The marker ConfigMap the break command creates first; its creation time starts the fault. */
const marker = (f: Facts, kase: string) => {
  const cm = obj(f, 'ConfigMap', 'default', 'exam-break');
  return cm?.data?.case === kase ? at(cm.metadata?.creationTimestamp) : NaN;
};
/** The mirror Pod of a static Pod on the control-plane node. */
const mirror = (f: Facts, component: string) => objects(f).find((o) => o.kind === 'Pod' && o.metadata?.namespace === 'kube-system' && o.metadata?.name?.startsWith(`${component}-`) && (o.metadata?.ownerReferences ?? []).some((r: Obj) => r.kind === 'Node'));
const ready = (p: Obj | undefined) => (p?.status?.conditions ?? []).some((c: Obj) => c.type === 'Ready' && c.status === 'True');
const startedAt = (p: Obj | undefined) => Math.min(...(p?.status?.containerStatuses ?? []).map((c: Obj) => at(c.state?.running?.startedAt)).map((x: number) => (Number.isNaN(x) ? Infinity : x)));
const restartedAfter = (f: Facts, component: string, kase: string) => {
  const t0 = marker(f, kase);
  const p = mirror(f, component);
  return !Number.isNaN(t0) && ready(p) && startedAt(p) > t0;
};
/** A CronJob whose pod runs `etcdctl/etcdutl snapshot save`, written as one shell line or as an argument list. */
const snapshotCron = (o: Obj) => o.kind === 'CronJob' && /snapshot["',\s]+save/.test(JSON.stringify(o.spec?.jobTemplate ?? {}));
const STATIC = ['etcd', 'kube-apiserver', 'kube-controller-manager', 'kube-scheduler'];
const CNI_DS = /^(cilium|calico-node|kube-flannel-ds|kube-router|weave-net|antrea-agent)$/;

const G = (id: string, label: [string, string], when: (f: Facts) => boolean, fail?: { if: (f: Facts) => boolean; say: [string, string] }[]): RealGoal => ({
  id,
  label: bi(label[0], label[1]),
  on: CP,
  check: { when, ...(fail ? { fail: fail.map((x) => ({ if: x.if, say: bi(x.say[0], x.say[1]) })) } : {}) },
});

const breakCard = (kase: string, ru: string, en: string, cmd: string) =>
  bi(
    `${ru}\n\nСначала поставьте метку начала поломки, а потом сломайте кластер в точности так, как написано:\n\n\`\`\`bash\nkubectl create configmap exam-break -n default --from-literal=case=${kase}\n${cmd}\n\`\`\`\n\nДальше вы дежурный: выясните, что случилось, по симптомам, а не по этой карточке, и почините.`,
    `${en}\n\nFirst put down the marker of the fault's start, then break it — exactly as written:\n\n\`\`\`bash\nkubectl create configmap exam-break -n default --from-literal=case=${kase}\n${cmd}\n\`\`\`\n\nFrom here on you are on call: find out what happened from the symptoms, not from this card, and repair it.`,
  );

export const stage2Exam: Exam = {
  id: 'k8s-2.exam',
  block: 'k8s-2',
  title: bi('Свой кластер kubeadm', 'Your own kubeadm cluster'),
  intro: bi(
    'Экзамен этапа идёт на кластере, который вы собираете сами на трёх виртуальных машинах. Тренажёр там ничего не выполняет: вы работаете по SSH, а после каждого шага запускаете на `cp-1` скрипт проверки, который только читает данные, и вставляете сюда напечатанный им блок. Засчитывается то, что видно в кластере и на узле: готовые узлы, сеть подов, статические поды, версия, снимок etcd и восстановление из него, починка после поломки и уборка. Прийти к этому состоянию можно любым путём. Открыты только страницы kubernetes.io и справка `--help`, а наставник выключен.',
    'The stage exam runs on the cluster you build yourself on three virtual machines. The trainer runs nothing there: you work over SSH, and after each step you run the read-only check script on `cp-1` and paste the printed block here. What counts is what can be seen in the cluster and on the node: ready nodes, the pod network, the static Pods, the version, an etcd snapshot and a restore from it, a repair after a fault, and the cleanup. Any path to that state is fine. Only the kubernetes.io pages and `--help` are open; the mentor is off.',
  ),
  story: bi(
    'Платформенная команда отказывается от управляемого кластера и хочет понять, справится ли она со своим. Вам поручили пробный кластер: собрать его на версии 1.36, перевести на 1.37 без простоя, доказать, что etcd восстанавливается из снимка, и пережить одну ночную поломку. По вашему протоколу команда решит, переезжать ли.',
    'The platform team is giving up its managed cluster and wants to know whether it can run its own. You have been given a trial cluster: build it on 1.36, move it to 1.37 without downtime, prove that etcd comes back from a snapshot, and live through one night-time fault. The team will decide from your protocol whether to move.',
  ),
  minutes: 480,
  pass: 0.7,
  retakeHours: 24,
  allowedDocs: ['kubernetes.io', 'help'],
  real: {
    track: TRACK,
    order: bi(
      'Нужны три виртуальные машины с Ubuntu 24.04, двумя ядрами и 4 ГБ памяти в одной частной сети: `cp-1` для управляющего слоя, `worker-1` и `worker-2` для приложений. Машины должны называться в точности так, потому что по именам тренажёр узнаёт узлы. Поставьте на машины метки `trainer=devops` и `dt-track=k8s-2`, чтобы потом удалить всё одним списком. Соберите кластер kubeadm версии 1.36 с Cilium, как в уроках этапа, а затем идите по карточкам сверху вниз: порядок важен для обновления и для учений с etcd.',
      'Three Ubuntu 24.04 VMs with 2 vCPU and 4 GB of memory each in one private network: `cp-1` is the control plane, `worker-1` and `worker-2` are the workers. The machines must have exactly these names: that is how the trainer recognises the nodes. Put the labels `trainer=devops` and `dt-track=k8s-2` on the VMs so that you can delete everything with one list later. Build a kubeadm cluster of version 1.36 with Cilium, as in the stage lessons, then go through the cards from top to bottom: the order matters for the upgrade and for the etcd drill.',
    ),
    machines: [{ id: CP, role: bi('управляющий узел, на нём запускается проверка', 'control plane: the check runs here'), collect: ['--snapshot /opt/backup/etcd.db'] }],
    collector: { name: 'trainer-check.sh', text: collectorText },
  },
  tasks: [
    {
      id: 'nodes',
      weight: 2,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Кластер из трёх узлов: `cp-1` в роли управляющего узла, `worker-1` и `worker-2` в роли рабочих. Все три узла зарегистрированы и готовы.',
          'A three-node cluster: `cp-1` as the control plane, `worker-1` and `worker-2` as workers. All three nodes are registered and ready.',
        ),
        concepts: ['k8s.kubeadm', 'k8s.node'],
        goals: [
          G('registered', ['Три узла с настоящими ядрами', 'Three nodes with real kernels'], (f) => nodes(f).length >= 3 && nodes(f).every((n) => !!n.kernel && !n.kernel.includes('dt-sim')), [{ if: (f) => !cluster(f), say: ['В блоке нет данных кластера: kubectl на cp-1 не получил ответа от API-сервера.', 'The block has no cluster data: kubectl on cp-1 could not reach the API server.'] }]),
          G('roles', ['cp-1 — управляющий узел, worker-1 и worker-2 — рабочие', 'cp-1 is the control plane, worker-1 and worker-2 are workers'], (f) => !!nodes(f).find((n) => n.name === CP)?.roles.includes('control-plane') && ['worker-1', 'worker-2'].every((w) => nodes(f).some((n) => n.name === w && !n.roles.includes('control-plane')))),
          G('ready', ['Все узлы в состоянии Ready', 'Every node is Ready'], (f) => nodes(f).length >= 3 && nodes(f).every((n) => n.ready), [{ if: (f) => nodes(f).some((n) => !n.ready), say: ['Узел в состоянии NotReady: посмотрите его условия в kubectl describe node и журнал kubelet на нём.', 'A node is NotReady: look at its conditions in kubectl describe node and at the kubelet journal on it.'] }]),
        ],
      },
    },
    {
      id: 'cni',
      weight: 2,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Сеть подов работает на всех узлах: сетевой плагин записал свою конфигурацию на узел, его агент готов на каждом узле, а CoreDNS отвечает.',
          'The pod network works on every node: the network plugin wrote its configuration onto the node, its agent is ready on every node, CoreDNS answers.',
        ),
        concepts: ['k8s.cni', 'k8s.podcidr'],
        goals: [
          G('conf', ['Конфигурация сетевого плагина на cp-1', 'A CNI configuration on cp-1'], (f) => Object.keys(f.files ?? {}).some((p) => p.startsWith('/etc/cni/net.d/') && /\.(conf|conflist)$/.test(p)), [{ if: () => true, say: ['В /etc/cni/net.d пусто, и kubelet не знает, чем подключать поды к сети. Сетевой плагин ещё не установлен или не дошёл до этого узла.', '/etc/cni/net.d is empty: the kubelet does not know how to connect pods to the network. The network plugin is not installed yet or has not reached this node.'] }]),
          G('agents', ['Агент сетевого плагина готов на каждом узле', 'The network plugin’s agent is ready on every node'], (f) => objects(f).some((o) => o.kind === 'DaemonSet' && o.metadata?.namespace === 'kube-system' && CNI_DS.test(o.metadata?.name ?? '') && (o.status?.numberReady ?? 0) >= 3 && o.status?.numberReady === o.status?.desiredNumberScheduled)),
          G('dns', ['CoreDNS готов, у узлов есть podCIDR', 'CoreDNS is ready, the nodes have a podCIDR'], (f) => (cluster(f)?.pods ?? []).some((p) => p.ns === 'kube-system' && p.labels['k8s-app'] === 'kube-dns' && p.ready) && nodes(f).length >= 3 && nodes(f).every((n) => !!n.podCIDR)),
        ],
      },
    },
    {
      id: 'static',
      weight: 2,
      kind: 'real',
      real: {
        prompt: bi(
          'Управляющий слой работает статическими подами: их манифесты лежат на `cp-1`, kubelet запускает их сам и показывает в API зеркальными подами. kubelet на `cp-1` работает и включён в автозапуск.',
          'The control plane is static Pods: their manifests live on `cp-1`, the kubelet starts them itself and shows them in the API as mirror Pods. The kubelet on `cp-1` runs and is enabled at boot.',
        ),
        concepts: ['k8s.static-pod', 'k8s.kubelet'],
        goals: [
          G('manifests', ['Четыре манифеста в /etc/kubernetes/manifests', 'Four manifests in /etc/kubernetes/manifests'], (f) => STATIC.every((c) => !!text(f, manifestPath(c)))),
          G('mirrors', ['Зеркальные поды всех четырёх компонентов готовы на cp-1', 'The mirror Pods of all four components are ready on cp-1'], (f) => STATIC.every((c) => ready(mirror(f, c)) && mirror(f, c)?.spec?.nodeName === CP)),
          G('kubelet', ['kubelet работает и включён в автозапуск', 'The kubelet is active and enabled'], (f) => unit(f, 'kubelet')?.active === 'active' && unit(f, 'kubelet')?.enabled === 'enabled'),
        ],
      },
    },
    {
      id: 'upgrade',
      weight: 2,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Переведите кластер с версии 1.36 на 1.37 по правилу расхождения версий: сначала управляющий слой, потом узлы по одному, каждый через drain и uncordon. В конце все узлы принимают поды.',
          'Move the cluster from 1.36 to 1.37 by the version skew policy: the control plane first, then the nodes one at a time, each through a drain and an uncordon. At the end every node accepts pods.',
        ),
        concepts: ['k8s.version-skew', 'k8s.drain'],
        goals: [
          G('config', ['kubeadm записал версию кластера 1.37', 'kubeadm recorded the cluster version 1.37'], (f) => String(clusterConfig(f)?.kubernetesVersion ?? '').startsWith(TARGET)),
          G('apiserver', ['kube-apiserver работает на образе 1.37', 'kube-apiserver runs the 1.37 image'], (f) => ready(mirror(f, 'kube-apiserver')) && (mirror(f, 'kube-apiserver')?.spec?.containers ?? []).some((c: Obj) => String(c.image).includes(`:${TARGET}`))),
          G('kubelets', ['kubelet 1.37 на всех трёх узлах', 'kubelet 1.37 on all three nodes'], (f) => nodes(f).length >= 3 && nodes(f).every((n) => n.version.startsWith(TARGET)) && version(f, 'kubeadm').startsWith(TARGET), [{ if: (f) => nodes(f).some((n) => !n.version.startsWith(TARGET)), say: ['Узел на старой версии: новый пакет kubelet поставлен, но kubelet не перезапущен, или до этого узла ещё не дошли.', 'A node is on the old version: the new kubelet package is installed but the kubelet was not restarted, or the node has not been reached yet.'] }]),
          G('uncordoned', ['Ни один узел не остался закрытым для новых подов', 'No node is left cordoned'], (f) => nodes(f).length >= 3 && nodes(f).every((n) => !n.unschedulable && n.ready), [{ if: (f) => nodes(f).some((n) => n.unschedulable), say: ['Узел обновлён, но так и остался закрытым для новых подов: выполните uncordon.', 'A node is upgraded but still closed to new pods: uncordon.'] }]),
        ],
      },
    },
    {
      id: 'snapshot',
      weight: 2,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Перед учениями создайте namespace `exam-before`, затем снимите снимок etcd в файл `/opt/backup/etcd.db` на `cp-1` и проверьте его. Снимок должен быть свежим, сделанным за последние трое суток.',
          'Before the drill, create namespace `exam-before`, then take an etcd snapshot into the file `/opt/backup/etcd.db` on `cp-1` and check it. The snapshot must be fresh — taken in the last three days.',
        ),
        concepts: ['k8s.etcd-snapshot', 'k8s.etcd'],
        goals: [
          G('file', ['Файл снимка на месте и читается', 'The snapshot file is there and readable'], (f) => !!snapshot(f)?.exists && (snapshot(f)?.status?.totalKey ?? 0) > 0, [
            { if: (f) => !snapshot(f)?.exists, say: ['Файла /opt/backup/etcd.db нет: снимок не записался или лежит в другом месте.', 'There is no /opt/backup/etcd.db: the snapshot was not written or lies elsewhere.'] },
            { if: (f) => !!snapshot(f)?.exists && !snapshot(f)?.status, say: ['Файл есть, но etcdutl snapshot status его не прочитал: снимок обрезан, или etcdutl не установлен на cp-1.', 'The file exists, but etcdutl snapshot status could not read it: the snapshot is cut short, or etcdutl is not installed on cp-1.'] },
          ]),
          G('fresh', ['Снимок свежий', 'The snapshot is fresh'], (f) => {
            const s = snapshot(f);
            return !!s?.mtime && collected(f) - s.mtime * 1000 < 3 * 86_400_000 && collected(f) - s.mtime * 1000 > -600_000;
          }),
          G('before', ['exam-before создан раньше снимка', 'exam-before was created before the snapshot'], (f) => {
            const ns = obj(f, 'Namespace', undefined, 'exam-before');
            const s = snapshot(f);
            return !!ns && !!s?.mtime && at(ns.metadata?.creationTimestamp) < s.mtime * 1000;
          }),
        ],
      },
    },
    {
      id: 'restore',
      weight: 2,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Это задание устроено как учения. После снимка создайте namespace `exam-after`, который сыграет роль данных, потерянных при восстановлении. Затем восстановите etcd из `/opt/backup/etcd.db` в новый каталог данных и переключите на него статический под etcd. После восстановления кластер должен работать на данных снимка, то есть namespace `exam-before` в нём есть, `exam-after` нет, а управляющий слой работает.',
          'This task is a drill. After the snapshot, create namespace `exam-after`, which plays the part of the data lost in the restore. Then restore etcd from `/opt/backup/etcd.db` into a new data directory and switch the etcd static Pod to it. After the restore the cluster must live on the snapshot’s data: `exam-before` is there, `exam-after` is not, the control plane works.',
        ),
        concepts: ['k8s.etcd-snapshot', 'k8s.static-pod'],
        goals: [
          G('kept', ['exam-before вернулся из снимка', 'exam-before came back from the snapshot'], (f) => !!obj(f, 'Namespace', undefined, 'exam-before')),
          G('lost', ['exam-after пропал вместе со всем, что было записано после снимка', 'exam-after is gone with everything after the snapshot'], (f) => !!cluster(f) && !obj(f, 'Namespace', undefined, 'exam-after') && !!obj(f, 'Namespace', undefined, 'exam-before'), [{ if: (f) => !!obj(f, 'Namespace', undefined, 'exam-after'), say: ['exam-after на месте, значит, etcd работает на прежних данных. Посмотрите, на какой каталог указывает том etcd-data в etcd.yaml.', 'exam-after is still there: etcd runs on the old data. Look at which directory the etcd-data volume in etcd.yaml points to.'] }]),
          G('datadir', ['etcd работает на восстановленном каталоге', 'etcd runs on the restored directory'], (f) => {
            const dir = etcdDataDir(f);
            return !!dir && dir !== '/var/lib/etcd' && etcdDirs(f).some(([d, m]) => d === dir && m === 'member') && ready(mirror(f, 'etcd')) && ready(mirror(f, 'kube-apiserver'));
          }, [{ if: (f) => etcdDataDir(f) === '/var/lib/etcd', say: ['etcd.yaml по-прежнему указывает на /var/lib/etcd. Восстановление пишет в новый каталог, и статический под нужно переключить на него.', 'etcd.yaml still points to /var/lib/etcd. A restore writes into a new directory, and the static Pod must be switched to it.'] }]),
        ],
      },
    },
    {
      id: 'break-scheduler',
      pool: 'break',
      weight: 2,
      kind: 'real',
      real: {
        prompt: breakCard('scheduler', 'Ночная поломка на `cp-1`. Команда запускает новое приложение, а его поды не уходят дальше Pending.', 'A night-time fault on `cp-1`. A team starts a new application — and its pods never get past Pending.', 'sudo mv /etc/kubernetes/manifests/kube-scheduler.yaml /root/\nkubectl create deployment exam-web --image=nginx:1.27 --replicas=3'),
        concepts: ['k8s.scheduler', 'k8s.static-pod'],
        goals: [
          G('marker', ['Метка поломки поставлена', 'The fault marker is in place'], (f) => !Number.isNaN(marker(f, 'scheduler'))),
          G('back', ['Планировщик снова запущен после поломки', 'The scheduler runs again after the fault'], (f) => restartedAfter(f, 'kube-scheduler', 'scheduler') && !!text(f, manifestPath('kube-scheduler'))),
          G('web', ['exam-web: три готовых пода, ни одного в Pending', 'exam-web: three ready pods, nothing Pending'], (f) => (cluster(f)?.deployments.find((d) => d.ns === 'default' && d.name === 'exam-web')?.ready ?? 0) >= 3 && !(cluster(f)?.pods ?? []).some((p) => p.phase === 'Pending')),
        ],
      },
    },
    {
      id: 'break-kubelet',
      pool: 'break',
      weight: 2,
      kind: 'real',
      real: {
        prompt: breakCard('kubelet', 'Ночная поломка на `worker-2`: мониторинг присылает KubeNodeNotReady. Команды выполните на `worker-2`, кроме первой, которую нужно выполнить на `cp-1`.', 'A night-time fault on `worker-2`: monitoring sends KubeNodeNotReady. Run the commands on `worker-2`, except the first — that one on `cp-1`.', 'sudo systemctl disable --now kubelet'),
        concepts: ['k8s.kubelet', 'k8s.node'],
        goals: [
          G('marker', ['Метка поломки поставлена', 'The fault marker is in place'], (f) => !Number.isNaN(marker(f, 'kubelet'))),
          G('back', ['worker-2 был в состоянии NotReady и вернулся', 'worker-2 went NotReady and came back'], (f) => {
            const t0 = marker(f, 'kubelet');
            const n = obj(f, 'Node', undefined, 'worker-2');
            const c = (n?.status?.conditions ?? []).find((x: Obj) => x.type === 'Ready');
            return !Number.isNaN(t0) && c?.status === 'True' && at(c.lastTransitionTime) > t0;
          }),
          G('all', ['Все узлы в состоянии Ready', 'Every node is Ready'], (f) => nodes(f).length >= 3 && nodes(f).every((n) => n.ready)),
        ],
      },
    },
    {
      id: 'break-apiserver',
      pool: 'break',
      weight: 2,
      kind: 'real',
      real: {
        prompt: breakCard('apiserver', 'Ночная поломка на `cp-1`: после «небольшой правки» kubectl отвечает, что в соединении отказано.', 'A night-time fault on `cp-1`: after “a small edit” kubectl answers that the connection is refused.', "sudo sed -i 's|--etcd-servers=https://127.0.0.1:2379|--etcd-servers=https://127.0.0.1:2378|' /etc/kubernetes/manifests/kube-apiserver.yaml"),
        concepts: ['k8s.apiserver', 'k8s.static-pod'],
        goals: [
          G('marker', ['Метка поломки поставлена', 'The fault marker is in place'], (f) => !Number.isNaN(marker(f, 'apiserver'))),
          G('flag', ['API-сервер снова обращается к настоящему etcd', 'The API server points at the real etcd again'], (f) => /--etcd-servers=https:\/\/127\.0\.0\.1:2379\b/.test(text(f, manifestPath('kube-apiserver')))),
          G('back', ['kube-apiserver перезапущен после поломки и готов', 'kube-apiserver was restarted after the fault and is ready'], (f) => restartedAfter(f, 'kube-apiserver', 'apiserver')),
        ],
      },
    },
    {
      id: 'schedule',
      weight: 2,
      beyond: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Снимок, который снимают руками раз в месяц, — ещё не страховка. Сделайте так, чтобы снимок etcd снимался сам каждую ночь, и покажите, что это уже сработало хотя бы раз. Способ выберите сами, потому что в уроках об этом не рассказывали.',
          'A snapshot by hand once a month is no insurance. Make the etcd snapshot happen by itself, every night, and show that it has already worked at least once. How exactly is up to you: the lessons did not cover it.',
        ),
        concepts: ['k8s.etcd-snapshot'],
        solutionTokens: ['CronJob', 'hostNetwork', 'tolerations', 'OnCalendar'],
        goals: [
          G('scheduled', ['Снимок по расписанию настроен', 'A scheduled snapshot is set up'], (f) => {
            const cron = objects(f).some(snapshotCron);
            return cron || /^cron: .*snapshot save/m.test(text(f, 'dt:schedules')) || /^timer: .*etcd/im.test(text(f, 'dt:schedules'));
          }),
          G('ran', ['Расписание уже сработало', 'The schedule has already worked'], (f) => {
            const crons = objects(f).filter(snapshotCron).map((o) => o.metadata?.name);
            const jobOk = objects(f).some((o) => o.kind === 'Job' && (o.metadata?.ownerReferences ?? []).some((r: Obj) => r.kind === 'CronJob' && crons.includes(r.name)) && (o.status?.succeeded ?? 0) >= 1);
            const s = snapshot(f);
            const hostOk = /^(cron: .*snapshot save|timer: .*etcd)/im.test(text(f, 'dt:schedules')) && !!s?.mtime && collected(f) - s.mtime * 1000 < 86_400_000 && (s.status?.totalKey ?? 0) > 0;
            return jobOk || hostOk;
          }),
        ],
      },
    },
    {
      id: 'datadir',
      weight: 2,
      beyond: true,
      kind: 'real',
      real: {
        prompt: bi(
          'kubeadm хранит свою конфигурацию кластера в самом кластере и при следующем `kubeadm upgrade` перепишет по ней манифест etcd. Сделайте так, чтобы следующее обновление не вернуло etcd на старый каталог данных, а значит, на данные до восстановления. В уроках этого не было, ищите на kubernetes.io.',
          'kubeadm keeps its cluster configuration in the cluster itself and on the next `kubeadm upgrade` rewrites the etcd manifest from it. Make sure the next upgrade does not take etcd back to the old data directory, and so to the data from before the restore. The lessons did not cover it — look on kubernetes.io.',
        ),
        concepts: ['k8s.kubeadm', 'k8s.etcd'],
        solutionTokens: ['dataDir', 'kubeadm-config', 'ClusterConfiguration'],
        goals: [
          G('recorded', ['Каталог данных etcd записан в конфигурацию kubeadm', 'The etcd data directory is recorded in kubeadm’s configuration'], (f) => {
            const dir = etcdDataDir(f);
            return !!dir && dir !== '/var/lib/etcd' && clusterConfig(f)?.etcd?.local?.dataDir === dir;
          }, [{ if: (f) => !!clusterConfig(f) && clusterConfig(f)?.etcd?.local?.dataDir !== etcdDataDir(f), say: ['В ClusterConfiguration записан другой dataDir, чем в etcd.yaml, и следующее обновление перепишет манифест по конфигурации.', 'ClusterConfiguration has a different dataDir than etcd.yaml: the next upgrade rewrites the manifest from the configuration.'] }]),
        ],
      },
    },
    {
      id: 'cleanup',
      weight: 1,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Последнее задание посвящено уборке. Экзамен не засчитывается, пока виртуальные машины работают и стоят денег. Удалите все машины с меткой `trainer=devops` и вставьте вывод списка по этой метке после удаления, например `hcloud server list -l trainer=devops -o json` или `yc compute instance list --format json`. Список должен быть пустым.',
          'The last task is the cleanup. The exam does not count while the VMs run and cost money. Delete every machine labelled `trainer=devops` and paste the output of the list by that label after the deletion — for example, `hcloud server list -l trainer=devops -o json` or `yc compute instance list --format json`. The list must be empty.',
        ),
        concepts: ['k8s.cluster'],
        paste: { label: bi('Вывод списка машин после удаления', 'The VM list after the deletion'), accept: [/^\s*\[\s*\]\s*$/, /No resources found/, /^\s*ID\s+NAME\s+STATUS[^\n]*\n?\s*$/] },
      },
    },
  ],
  explain: [
    {
      id: 'etcd',
      prompt: bi('Почему снимок etcd служит главной страховкой кластера, а резервная копия дисков узлов такой страховкой не служит? Что потеряется при восстановлении из снимка?', 'Why is an etcd snapshot the cluster’s main insurance, while a backup of the nodes’ disks is not? What is lost on a restore from a snapshot?'),
      keyPoints: [
        bi('в etcd лежат все объекты кластера, а узлы, поды и правила сети вторичны, и контроллеры построят их заново', 'etcd holds every object of the cluster; nodes, pods and network rules are derived, the controllers rebuild them'),
        bi('снимок согласован на одну ревизию, а копия диска работающего etcd может оказаться несогласованной', 'a snapshot is consistent at one revision, while a disk copy of a live etcd may be inconsistent'),
        bi('теряется всё, что записано после снимка: объекты пропадают, и kubelet останавливает их поды как лишние', 'everything written after the snapshot is lost: the objects disappear, and the kubelet stops their pods as surplus'),
      ],
    },
    {
      id: 'upgrade',
      prompt: bi('В каком порядке обновляют кластер kubeadm и почему этот порядок нельзя поменять?', 'In what order is a kubeadm cluster upgraded, and why can the order not be changed?'),
      keyPoints: [
        bi('сначала kubeadm и управляющий слой на первом узле, потому что kubelet не может быть новее API-сервера', 'first kubeadm and the control plane on the first node: the kubelet may not be newer than the API server'),
        bi('затем узлы по одному: drain, новые kubeadm и kubelet, перезапуск kubelet и uncordon', 'then the nodes one at a time: drain, new kubeadm and kubelet, a kubelet restart, uncordon'),
        bi('обновляют только на одну минорную версию за раз и со свежим снимком etcd перед началом', 'only one minor version at a time, and with a fresh etcd snapshot before the start'),
      ],
    },
  ],
};
