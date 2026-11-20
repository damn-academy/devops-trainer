// Stage 2 (05 §11.4): what `kubeadm init` does, phase by phase. It writes
// three kinds of files — certificates, kubeconfigs, static pod manifests —
// and starts nothing itself: the kubelet reads the manifests directory and
// starts etcd and the control plane. Breaks are the classic forgotten
// prerequisites; the "months later" knob shows what a year-long certificate
// means for a cluster nobody upgrades.
//
// Reading order: at first only kubeadm is on screen; the files appear as its
// phases write them, then the kubelet and the static pods it starts, then the
// addons. Every step is one phase.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, idsOf, LEGEND_BASE, mark, metric, only } from './kit';

type P = { cni: boolean; months: number; renewed: boolean };

/** Certificate arithmetic: kubeadm issues leaf certificates for one year and the CAs for ten. */
export function certState(months: number, renewed: boolean): { leafLeftDays: number; expired: boolean } {
  const left = 365 - Math.round(months * 30.4);
  const leafLeftDays = renewed ? 365 : left;
  return { leafLeftDays, expired: leafLeftDays <= 0 };
}

const BY_KUBELET = (f: string) => fmt(bi('Под запускает kubelet по файлу {f}.', 'The kubelet starts it from {f}.'), { f });
const START = bi('Запускает kubelet через containerd.', 'The kubelet, through containerd.');

const diagram = {
  width: 960,
  height: 480,
  nodes: [
    box('kadm', 'kubeadm init', 'user', 'pill', [24, 24, 200, 48], 'terminal', bi('Установщик кластера. Он проходит свои фазы по порядку: preflight, certs, kubeconfig, etcd, control-plane, kubelet-start, ожидание и addons. Любую фазу можно запустить отдельно командой `kubeadm init phase <имя>`.', 'The installer, phase by phase; any phase alone with `kubeadm init phase <name>`.'), bi('Команду запускаете вы на cp-1.', 'You, on cp-1.'), { see: 'kubeadm init --help', doc: D.kubeadmInit }),
    box('pki', '/etc/kubernetes/pki', 'store', 'doc', [24, 116, 200, 76], 'lock', bi('Центр сертификации кластера (ca.crt и ca.key) и сертификаты, которые он подписал: для API-сервера, для обращений API-сервера к kubelet, для front-proxy, отдельный центр для etcd и ключ для учётных записей ServiceAccount (sa.key).', 'The cluster CA and the certificates it signed, a separate etcd CA and sa.key.'), bi('Файлы пишет фаза certs.', 'The certs phase.'), { see: 'sudo kubeadm certs check-expiration', doc: D.pki, sub: 'ca: 10y · leaf: 1y' }),
    box('confs', '/etc/kubernetes/*.conf', 'store', 'doc', [24, 234, 200, 76], 'file', bi('Файлы kubeconfig для администратора (admin.conf и super-admin.conf), controller-manager, scheduler и kubelet. В каждом адрес API-сервера, сертификат центра и клиентский сертификат.', 'kubeconfigs for admin, super-admin, controller-manager, scheduler and kubelet.'), bi('Файлы пишет фаза kubeconfig.', 'The kubeconfig phase.'), { see: 'sudo ls /etc/kubernetes/*.conf' }),
    box('mf', '/etc/kubernetes/manifests', 'store', 'doc', [24, 352, 200, 76], 'folder', bi('Четыре файла: etcd.yaml, kube-apiserver.yaml, kube-controller-manager.yaml и kube-scheduler.yaml. Это и есть статические поды управляющего слоя.', 'Four files: the static pods.'), bi('Файлы пишут фазы etcd и control-plane.', 'The etcd and control-plane phases.'), { see: 'ls /etc/kubernetes/manifests', doc: D.staticPods }),
    box('klet', 'kubelet', 'node', 'rack', [320, 360, 210, 70], 'process', bi('Единственная служба systemd на узле. Она читает каталог manifests и запускает поды прямо из файлов, даже когда API-сервера ещё нет.', 'The only systemd service: starts pods from the manifests, even without an API server.'), bi('Ставится пакетом kubelet и запускается systemd.', 'The kubelet package, systemd.'), { see: 'systemctl status kubelet; journalctl -u kubelet -n 50' }),
    box('etcd', 'etcd', 'store', 'box', [640, 380, 150, 50], 'database', bi('Хранилище кластера в статическом поде. Оно принимает соединения на порту 2379 только по TLS и проверяет их своим центром сертификации.', 'The store, a static pod; TLS-only on 2379 with its own CA.'), BY_KUBELET('etcd.yaml'), { see: 'sudo crictl ps --name etcd' }),
    box('api', 'kube-apiserver', 'cp', 'hex', [640, 252, 210, 56], 'server', bi('API-сервер в статическом поде. В etcd он обращается с клиентским сертификатом, а API отдаёт на порту 6443 с сертификатом apiserver.crt.', 'A static pod: client cert to etcd, serves on 6443 with apiserver.crt.'), BY_KUBELET('kube-apiserver.yaml'), { see: 'kubectl -n kube-system get pod -l component=kube-apiserver' }),
    box('cms', bi('controller-manager и scheduler', 'controller-manager, scheduler'), 'cp', 'hex', [640, 132, 296, 56], 'process', bi('Ещё два статических пода. Каждый обращается к API-серверу со своим файлом kubeconfig из /etc/kubernetes.', 'Two more static pods, each with its own kubeconfig.'), bi('Поды запускает kubelet по файлам kube-controller-manager.yaml и kube-scheduler.yaml.', 'The kubelet starts them from their manifests.')),
    box('dns', 'CoreDNS', 'cp', 'box', [640, 24, 150, 52], 'dns', bi('Дополнение, которое kubeadm ставит последним вместе с kube-proxy. Это обычный Deployment, и без сети подов он остаётся в состоянии Pending.', 'An addon; an ordinary Deployment, Pending without a pod network.'), bi('Ставит фаза addons.', 'The addons phase.'), { see: 'kubectl -n kube-system get pods -l k8s-app=kube-dns' }),
    box('cni', bi('Сеть подов', 'Pod network'), 'node', 'box', [816, 24, 130, 52], 'router', bi('Сетевой плагин подов: Cilium, Calico или flannel. kubeadm его не ставит, и этому посвящён следующий урок.', 'The CNI; kubeadm does not install one.'), bi('Ставите вы после init.', 'You, after init.'), { see: 'cilium status' }),
  ],
  edges: [
    edge('e-certs', 'kadm', 'pki', bi('сертификаты', 'certificates'), bi('Фаза certs создаёт центр сертификации и подписывает им сертификаты компонентов.', 'The certs phase creates the CA and signs the certificates.'), bi('Пишет kubeadm.', 'kubeadm.')),
    edge('e-confs', 'pki', 'confs', bi('клиентские сертификаты', 'client certificates'), bi('В каждый kubeconfig попадают сертификат центра и клиентский сертификат, подписанный тем же центром.', 'Each kubeconfig carries the CA and a client certificate.'), bi('Пишет kubeadm, фаза kubeconfig.', 'kubeadm, the kubeconfig phase.')),
    edge('e-mf', 'confs', 'mf', bi('пути к файлам', 'file paths'), bi('Манифесты ссылаются на файлы из pki и на *.conf через hostPath.', 'The manifests mount pki and *.conf through hostPath.'), bi('Пишет kubeadm, фазы etcd и control-plane.', 'kubeadm, the etcd and control-plane phases.')),
    edge('e-read', 'mf', 'klet', bi('читает каталог', 'reads the directory'), bi('kubelet каждые 20 секунд перечитывает каталог статических подов и запускает, перезапускает или останавливает поды по файлам.', 'Every 20 s the kubelet rereads the directory.'), bi('Читает kubelet.', 'The kubelet.')),
    edge('e-etcd', 'klet', 'etcd', bi('запускает', 'starts'), bi('Первым kubelet запускает etcd.', 'etcd first.'), START),
    edge('e-api', 'klet', 'api', bi('запускает', 'starts'), bi('Затем kubelet запускает API-сервер.', 'Then the API server.'), START, { via: [[575, 395], [575, 280]], labelAt: 0.85 }),
    edge('e-cms', 'klet', 'cms', bi('запускает', 'starts'), bi('И наконец два управляющих процесса.', 'And the two controllers.'), START, { via: [[460, 160]], labelAt: 0.4 }),
    edge('e-store', 'api', 'etcd', 'TLS :2379', bi('Кроме API-сервера, к etcd никто не обращается. Его сертификат apiserver-etcd-client подписан центром etcd.', 'The API server is etcd’s only client.'), bi('Соединяется kube-apiserver.', 'kube-apiserver.')),
    edge('e-watch', 'cms', 'api', 'TLS :6443', bi('controller-manager и scheduler обращаются к API со своими kubeconfig.', 'They talk to the API with their kubeconfigs.'), bi('Соединяются kube-controller-manager и kube-scheduler.', 'The controller-manager and scheduler.')),
    edge('e-net', 'cni', 'dns', bi('сеть подов', 'pod network'), bi('Без сетевого плагина у подов нет адресов, и CoreDNS не может запуститься.', 'Without a CNI CoreDNS cannot start.'), bi('Сеть даёт плагин.', 'The plugin.')),
  ],
};

const ALL = idsOf(diagram);

export const kubeadmInitModel = defineModel<P>({
  id: 'k8s.kubeadm-init',
  frame: 'visible',
  block: 'k8s-2',
  title: bi('Что делает kubeadm init', 'What kubeadm init does'),
  summary: bi(
    'kubeadm сам ничего не запускает. Он только записывает файлы: сертификаты, файлы kubeconfig и манифесты статических подов. Управляющий слой кластера из этих манифестов запускает kubelet. Схема проходит фазы init по порядку и показывает, на какой из них всплывает каждая забытая подготовка узла.',
    'kubeadm writes files; the kubelet starts the control plane from them. The diagram walks the phases and shows where each forgotten preparation surfaces.',
  ),
  intro: bi(
    'Сейчас на схеме только команда kubeadm init. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд», и каждый шаг покажет одну фазу init. Слева появятся файлы, которые kubeadm записывает, внизу kubelet, а справа поды, которые kubelet запускает из этих файлов. Счётчик под схемой показывает, сколько файлов уже записано. Потом включайте по одной поломки в блоке «Сломать» и смотрите, на какой фазе остановится init.',
    'For now only kubeadm init. Press “Start from the first step” and go on with “Step forward”: each step is a phase. The files appear on the left, the kubelet at the bottom, the pods it starts on the right. Then switch on the breaks one at a time and see where init stops.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:lock', 'сертификаты кластера', 'the cluster certificates'),
    mark('icon:folder', 'каталог манифестов статических подов', 'the static pod manifests'),
    mark('icon:process', 'kubelet и управляющие процессы', 'the kubelet and controllers'),
    mark('ok', 'фаза выполнена', 'the phase is done'),
    mark('wait', 'ждёт сети подов', 'waits for a pod network'),
    mark('err', 'здесь init остановился', 'init stopped here'),
  ],
  stopLabel: bi('kubeadm init остановился', 'kubeadm init stopped'),
  concepts: ['k8s.kubeadm', 'k8s.static-pod', 'k8s.pki'],
  diagram,
  params: [
    {
      id: 'cni',
      label: bi('Сетевой плагин подов уже установлен', 'A pod network plugin is installed'),
      kind: 'toggle',
      default: false,
      near: 'cni',
      group: bi('После init', 'After init'),
      predict: { prompt: bi('Вы меняете, установлен ли сетевой плагин подов. В каком состоянии будет CoreDNS после init?', 'You change whether a CNI is installed. What state is CoreDNS in after init?'), options: [{ id: 'pending', text: bi('Pending, потому что под ждёт сети подов', 'Pending') }, { id: 'running', text: bi('Running', 'Running') }], resolve: (_p, n) => (n.some((s) => s.values?.dns === 'Running') ? 'running' : 'pending') },
    },
    {
      id: 'months',
      label: bi('Сколько месяцев прошло после init', 'Months since init'),
      kind: 'range',
      min: 0,
      max: 24,
      step: 3,
      default: 0,
      near: 'pki',
      levels: ['intermediate', 'experienced'],
      group: bi('Время', 'Time'),
      predict: { prompt: bi('Кластер не обновляли столько месяцев, сколько вы выбрали. Что ответит kubectl?', 'Not upgraded for the chosen months. What does kubectl answer?'), options: [{ id: 'x509', text: bi('Ошибку x509 о том, что срок сертификата истёк', 'An x509 error: expired') }, { id: 'ok', text: bi('Как обычно', 'As usual') }], resolve: (_p, n) => (n.some((s) => s.id === 'expired') ? 'x509' : 'ok') },
    },
    { id: 'renewed', label: bi('Сертификаты продлевали (kubeadm certs renew или обновление кластера)', 'Certificates were renewed'), kind: 'toggle', default: false, near: 'pki', levels: ['intermediate', 'experienced'], group: bi('Время', 'Time') },
  ],
  breaks: [
    {
      id: 'ipfwd',
      label: bi('На узле не включена пересылка пакетов (net.ipv4.ip_forward=1)', 'Packet forwarding is off on the node'),
      remove: ['e-certs'],
      boundary: 'kernel',
      predict: { prompt: bi('Пересылка пакетов в ядре узла выключена. На какой фазе остановится init?', 'Packet forwarding is off. Where does init stop?'), options: [{ id: 'pre', text: bi('Сразу, на проверках preflight', 'At once, in preflight') }, { id: 'late', text: bi('Поды запустятся, но сеть работать не будет', 'The pods start, the network fails') }], resolve: () => 'pre' },
    },
    {
      id: 'swap',
      label: bi('На узле не выключен swap', 'Swap is left on'),
      remove: ['klet'],
      boundary: 'process',
      predict: { prompt: bi('На узле включён swap. Что случится при init?', 'Swap is on. What happens?'), options: [{ id: 'kubelet', text: bi('kubelet не запустится, init прождёт его четыре минуты и сдастся', 'The kubelet will not start; init waits 4 minutes and gives up') }, { id: 'slow', text: bi('Всё заработает, только медленнее', 'Everything works, slower') }], resolve: () => 'kubelet' },
    },
    {
      id: 'cgroup',
      label: bi('containerd работает с cgroupfs, а kubelet ждёт systemd (SystemdCgroup = false)', 'containerd uses cgroupfs, the kubelet expects systemd'),
      remove: ['e-api'],
      boundary: 'process',
      predict: { prompt: bi('kubelet ждёт драйвер cgroup systemd, а containerd работает с cgroupfs. Что вы увидите?', 'The kubelet expects systemd, containerd uses cgroupfs. What will you see?'), options: [{ id: 'flap', text: bi('Управляющий слой то запускается, то снова аварийно завершается', 'The control plane keeps coming up and falling') }, { id: 'error', text: bi('Понятную ошибку на проверках preflight', 'A clear preflight error') }], resolve: () => 'flap' },
    },
  ],
  metrics: [
    { id: 'files', label: bi('файлов записал kubeadm', 'files written') },
    { id: 'days', label: bi('дней до конца срока сертификатов', 'days until the certificates expire') },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    const cert = certState(p.months, p.renewed);
    s.push({
      id: 'preflight',
      label: 'preflight',
      caption: bi('В первой фазе kubeadm проверяет узел: загружены ли модули ядра br_netfilter и overlay, включена ли пересылка пакетов, свободны ли порты 6443, 2379–2380 и 10250, отвечает ли среда запуска контейнеров и выключен ли swap.', 'Preflight checks: kernel modules, ip_forward, free ports, the runtime, swap.'),
      focus: ['kadm'],
      say: { kadm: bi('kubeadm проверяет, готов ли узел стать управляющим.', 'kubeadm checks the node is ready.') },
      states: only(ALL, 'kadm'),
      metrics: { files: 0, days: 365 },
    });
    if (broken.has('ipfwd')) {
      s.push({
        id: 'fail',
        label: bi('стоп', 'stop'),
        caption: bi('Команда kubeadm init останавливается, не успев записать ни одного файла. Такая ошибка лучше всех остальных, потому что её причина понятна, а исправить её дёшево.', 'init stops before writing a file: the best kind of error, clear and cheap.'),
        focus: ['kadm'],
        say: { kadm: bi('kubeadm видит, что пересылка пакетов выключена, и прекращает работу.', 'kubeadm sees forwarding off and stops.') },
        states: { kadm: 'err' },
        metrics: { files: 0, days: 365 },
        broken: { at: 'kadm', message: '[preflight] Running pre-flight checks\nerror execution phase preflight: [preflight] Some fatal errors occurred:\n\t[ERROR FileContent--proc-sys-net-ipv4-ip_forward]: /proc/sys/net/ipv4/ip_forward contents are not set to 1', caption: bi('на проверках preflight. Без пересылки пакетов узел не сможет служить маршрутизатором для своих подов, поэтому kubeadm проверяет это первым делом.', 'in preflight: without forwarding the node cannot route for its pods.') },
      });
      return s;
    }
    s.push({
      id: 'certs',
      label: 'certs',
      caption: bi('Фаза certs создаёт центр сертификации кластера сроком на 10 лет и сертификаты компонентов сроком на год. В сертификат API-сервера вписаны все имена и адреса, по которым к нему будут обращаться.', 'certs: the CA for 10 years, components for one; apiserver.crt lists every name and address (SANs).'),
      focus: ['kadm', 'e-certs'],
      reveal: ['pki', 'e-certs'],
      tokens: [{ edge: 'e-certs', label: bi('ca.crt и ещё 21 файл', 'ca.crt + 21 files') }],
      say: { kadm: bi('kubeadm создаёт центр сертификации и подписывает им сертификаты компонентов.', 'kubeadm creates the CA and signs the certificates.') },
      states: { pki: 'ok' },
      values: { pki: t(bi('центр на 10 лет · прочие на 1 год', 'ca: 10y · leaf: 1y')) },
      metrics: { files: 22, days: 365 },
    });
    s.push({
      id: 'kubeconfig',
      label: 'kubeconfig',
      caption: bi('Фаза kubeconfig записывает admin.conf для администратора и отдельные файлы для controller-manager, scheduler и kubelet. В каждом файле адрес API-сервера, сертификат центра и клиентский сертификат.', 'kubeconfig: admin.conf and files for the controller-manager, scheduler and kubelet.'),
      focus: ['kadm', 'e-confs'],
      reveal: ['confs', 'e-confs'],
      tokens: [{ edge: 'e-confs', label: bi('5 файлов .conf', '5 × .conf') }],
      say: { kadm: bi('kubeadm записывает файлы kubeconfig для администратора и компонентов.', 'kubeadm writes the kubeconfigs.') },
      states: { confs: 'ok' },
      metrics: { files: 27, days: 365 },
    });
    s.push({
      id: 'manifests',
      label: 'manifests',
      caption: bi('Фазы etcd и control-plane ничего не запускают, а только кладут четыре YAML-файла в каталог /etc/kubernetes/manifests.', 'etcd and control-plane start nothing: four YAML files in /etc/kubernetes/manifests.'),
      focus: ['kadm', 'e-mf'],
      reveal: ['mf', 'e-mf'],
      tokens: [{ edge: 'e-mf', label: bi('4 файла .yaml', '4 × .yaml') }],
      say: { kadm: bi('kubeadm кладёт в каталог manifests четыре файла статических подов.', 'kubeadm writes four static pod files.') },
      states: { mf: 'ok' },
      metrics: { files: 31, days: 365 },
    });
    if (broken.has('swap')) {
      s.push({
        id: 'nokubelet',
        label: 'kubelet',
        caption: bi('Агент kubelet завершается при запуске, и файлы в manifests никто не читает. kubeadm четыре минуты ждёт, что kubelet станет здоровым, и сдаётся.', 'The kubelet exits at start; nobody reads the manifests; init waits four minutes.'),
        focus: ['kadm'],
        reveal: ['klet', 'e-read'],
        say: { kadm: bi('kubeadm ждёт здоровый kubelet и не дожидается.', 'kubeadm waits for a healthy kubelet in vain.') },
        states: { klet: 'err' },
        metrics: { files: 31, days: 365 },
        broken: { at: 'klet', message: '$ journalctl -u kubelet -n 1\nkubelet[2211]: E1118 "command failed" err="failed to run Kubelet: running with swap on is not supported, please disable swap or set --fail-swap-on flag to false"\n\n[kubelet-check] The kubelet is not healthy after 4m0s', caption: bi('на запуске kubelet. Сообщение kubeadm говорит только, что kubelet нездоров, а причину называет журнал самого kubelet.', 'at the kubelet: kubeadm only says “unhealthy”; the kubelet journal names the cause.') },
      });
      return s;
    }
    s.push({
      id: 'kubelet',
      label: 'kubelet-start',
      caption: bi('kubelet перечитывает каталог и запускает статические поды: etcd, API-сервер, controller-manager и scheduler. В API эти поды появятся «зеркальными» копиями с именем узла в конце, например kube-apiserver-cp-1.', 'The kubelet starts the static pods; in the API they appear as mirror pods like kube-apiserver-cp-1.'),
      focus: ['klet', 'e-read'],
      reveal: ['klet', 'e-read', 'etcd', 'api', 'cms', 'e-etcd', 'e-api', 'e-cms'],
      tokens: [{ edge: 'e-read', label: bi('4 файла .yaml', '4 × .yaml') }],
      say: { klet: bi('kubelet читает манифесты и запускает etcd, API-сервер и два управляющих процесса.', 'The kubelet starts etcd, the API server and the controllers.') },
      states: { klet: 'ok', etcd: 'ok', api: 'ok', cms: 'ok' },
      metrics: { files: 31, days: 365 },
    });
    if (broken.has('cgroup')) {
      s.push({
        id: 'flap',
        label: bi('перезапуски', 'flapping'),
        caption: bi('Агент kubelet и среда запуска containerd по-разному понимают, где лежат контрольные группы (cgroup) контейнеров. Поды управляющего слоя раз за разом завершаются и запускаются снова, и API-сервер отвечает через раз.', 'The kubelet and containerd disagree on cgroups: the control plane keeps restarting.'),
        focus: ['klet'],
        say: { klet: bi('kubelet снова и снова перезапускает API-сервер и etcd.', 'The kubelet restarts the API server and etcd again and again.') },
        states: { api: 'warn', etcd: 'warn' },
        metrics: { files: 31, days: 365 },
        broken: { at: 'api', message: '$ kubectl get nodes\nThe connection to the server 10.10.1.11:6443 was refused - did you specify the right host or port?\n$ sudo crictl ps -a | grep kube-apiserver\n3f2a1c   Exited   kube-apiserver   7', caption: bi('на подах управляющего слоя. Проверки preflight такую ошибку не ловят, поэтому драйвер cgroup в containerd нужно выставить так же, как у kubelet (systemd), ещё до init.', 'at the control plane: preflight does not catch it; set the same cgroup driver before init.') },
      });
      return s;
    }
    s.push({
      id: 'wait',
      label: bi('ожидание', 'wait'),
      caption: bi('API-сервер ответил на /readyz. kubeadm сохраняет свою конфигурацию в ConfigMap kubeadm-config, помечает узел как управляющий и создаёт токен для узлов, которые будут присоединяться потом.', 'The API server answers; kubeadm uploads its config, marks the node and creates a bootstrap token.'),
      focus: ['kadm'],
      say: { kadm: bi('kubeadm дожидается ответа API-сервера и создаёт токен для новых узлов.', 'kubeadm waits for the API and creates a join token.') },
      metrics: { files: 31, days: cert.leafLeftDays },
    });
    s.push({
      id: 'addons',
      label: 'addons',
      caption: p.cni
        ? bi('kubeadm ставит дополнения kube-proxy и CoreDNS. Сеть подов уже есть, поэтому CoreDNS получает адреса и становится готовым, а узел переходит в состояние Ready.', 'Addons: with a pod network CoreDNS becomes ready and the node Ready.')
        : bi('kubeadm ставит дополнения kube-proxy и CoreDNS. Сети подов нет, поэтому CoreDNS остаётся в Pending, а узел в NotReady. init напомнит об этом в конце: «You should now deploy a pod network to the cluster».', 'Addons: no pod network, CoreDNS Pending, the node NotReady; init reminds you to deploy one.'),
      focus: ['dns'],
      reveal: ['dns', 'cni', 'e-net'],
      tokens: p.cni ? [{ edge: 'e-net', label: '10.0.1.0/24' }] : [],
      say: { dns: p.cni ? bi('CoreDNS получает адреса и начинает отвечать.', 'CoreDNS gets addresses and answers.') : bi('CoreDNS ждёт сети подов и остаётся в Pending.', 'CoreDNS waits for a pod network.') },
      states: { dns: p.cni ? 'ok' : 'wait', cni: p.cni ? 'ok' : 'off' },
      values: { dns: p.cni ? 'Running' : 'Pending' },
      metrics: { files: 31, days: cert.leafLeftDays },
    });
    if (cert.expired)
      s.push({
        id: 'expired',
        label: 'x509',
        caption: bi('Прошёл год, и сертификаты управляющего слоя, которые выпустил kubeadm, истекли вместе с admin.conf. Истёк и сертификат, которым API-сервер представляется клиентам, поэтому и kubectl, и kubelet получают ошибку x509 и не могут с ним работать. Клиентский сертификат самого kubelet при этом продлевается автоматически, пока срок не вышел, так что после починки узлы возвращаются в кластер без повторного join. Чинят это командой kubeadm certs renew all и перезапуском статических подов, а проверяют заранее командой kubeadm certs check-expiration.', 'A year later the control plane certificates kubeadm issued have expired together with admin.conf. The certificate the API server presents to its clients has expired too, so kubectl and the kubelet both get an x509 error and cannot work with it. The kubelet’s own client certificate is rotated automatically while it is still valid, so after the fix the nodes come back without another join. The fix is kubeadm certs renew all and a restart of the static pods; check in advance with kubeadm certs check-expiration.'),
        focus: ['pki'],
        say: { pki: bi('Срок сертификатов управляющего слоя истёк.', 'The control plane certificates have expired.') },
        states: { pki: 'err', confs: 'err' },
        values: { pki: t(bi('сертификаты истекли', 'leaf: expired')) },
        metrics: { files: 31, days: cert.leafLeftDays },
      });
    else if (p.months > 0)
      s.push({
        id: 'aging',
        label: bi('время', 'time'),
        caption: fmt(bi('До конца срока сертификатов осталось {d} дней. Каждое обновление кластера командой kubeadm upgrade продлевает их, поэтому регулярные обновления и есть лучшая защита.', '{d} days left; every kubeadm upgrade renews them.'), { d: cert.leafLeftDays }),
        focus: ['pki'],
        say: { pki: fmt(bi('Сертификатам осталось {d} дней.', '{d} days left.'), { d: cert.leafLeftDays }) },
        states: { pki: cert.leafLeftDays < 60 ? 'warn' : 'ok' },
        metrics: { files: 31, days: cert.leafLeftDays },
      });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Подготовка узла пропущена. Посмотрите, на какой фазе это всплывает и какое сообщение вы увидите.', 'A preparation step was skipped: see where it surfaces.') : bi('Узел снова подготовлен правильно.', 'The node is prepared correctly.');
    if (change.id === 'cni') return b.cni ? bi('С сетью подов CoreDNS запускается, и узел становится Ready.', 'With a pod network the node becomes Ready.') : bi('Без сети подов init завершается успешно, но кластер ещё не работает.', 'Without one init succeeds, but the cluster does not work yet.');
    const d = metric(next, 'days');
    return d <= 0 ? bi('Сертификаты истекли, и теперь нужно выполнить kubeadm certs renew all и перезапустить статические поды.', 'Expired: kubeadm certs renew all and restart the static pods.') : fmt(bi('Сертификатам осталось {d} дней.', '{d} days left.'), { d });
  },
});
