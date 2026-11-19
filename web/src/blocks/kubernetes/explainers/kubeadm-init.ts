// Stage 2 (05 §11.4): what `kubeadm init` does, phase by phase. It writes
// three kinds of files — certificates, kubeconfigs, static pod manifests —
// and starts nothing itself: the kubelet reads the manifests directory and
// starts etcd and the control plane. Breaks are the classic forgotten
// prerequisites; the "months later" knob shows what a year-long certificate
// means for a cluster nobody upgrades.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

type P = { cni: boolean; months: number; renewed: boolean };

/** Certificate arithmetic: kubeadm issues leaf certificates for one year and the CAs for ten. */
export function certState(months: number, renewed: boolean): { leafLeftDays: number; expired: boolean } {
  const left = 365 - Math.round(months * 30.4);
  const leafLeftDays = renewed ? 365 : left;
  return { leafLeftDays, expired: leafLeftDays <= 0 };
}

export const kubeadmInitModel = defineModel<P>({
  id: 'k8s.kubeadm-init',
  block: 'k8s-2',
  title: bi('kubeadm init: сертификаты, kubeconfig, статические поды', 'kubeadm init: certificates, kubeconfigs, static pods'),
  summary: bi('kubeadm ничего не запускает сам. Он пишет файлы — сертификаты, kubeconfig и манифесты, — а control plane из этих манифестов поднимает kubelet.', 'kubeadm starts nothing itself. It writes files — certificates, kubeconfigs and manifests — and the kubelet brings the control plane up from those manifests.'),
  concepts: ['k8s.kubeadm', 'k8s.static-pod', 'k8s.pki'],
  diagram: {
    width: 960,
    height: 480,
    nodes: [
      node('kadm', 'kubeadm init', 'user', 'pill', 24, 24, 180, 44, bi('Установщик. Проходит фазы по порядку: preflight, certs, kubeconfig, etcd, control-plane, kubelet-start, wait, addons. Любую фазу можно запустить отдельно: kubeadm init phase <имя>.', 'The installer. It walks the phases in order: preflight, certs, kubeconfig, etcd, control-plane, kubelet-start, wait, addons. Any phase can be run alone: kubeadm init phase <name>.'), bi('вы, на cp-1', 'you, on cp-1'), 'kubeadm init --help', D.kubeadmInit),
      node('pki', '/etc/kubernetes/pki', 'store', 'doc', 24, 120, 200, 76, bi('Центр сертификации кластера (ca.crt, ca.key) и сертификаты, которые он подписал: apiserver, apiserver-kubelet-client, front-proxy, отдельный CA для etcd, ключ ServiceAccount (sa.key).', 'The cluster certificate authority (ca.crt, ca.key) and the certificates it signed: apiserver, apiserver-kubelet-client, front-proxy, a separate CA for etcd, the ServiceAccount key (sa.key).'), bi('фаза certs', 'the certs phase'), 'sudo kubeadm certs check-expiration', D.pki, 'ca: 10y · leaf: 1y'),
      node('confs', '/etc/kubernetes/*.conf', 'store', 'doc', 24, 236, 200, 76, bi('kubeconfig для admin, super-admin, controller-manager, scheduler и kubelet: адрес API-сервера, CA и клиентский сертификат каждого.', 'kubeconfigs for admin, super-admin, controller-manager, scheduler and the kubelet: the API server address, the CA and each one’s client certificate.'), bi('фаза kubeconfig', 'the kubeconfig phase'), 'sudo ls /etc/kubernetes/*.conf'),
      node('mf', '/etc/kubernetes/manifests', 'store', 'doc', 24, 352, 200, 76, bi('Четыре файла: etcd.yaml, kube-apiserver.yaml, kube-controller-manager.yaml, kube-scheduler.yaml. Это и есть статические поды.', 'Four files: etcd.yaml, kube-apiserver.yaml, kube-controller-manager.yaml, kube-scheduler.yaml. These are the static pods.'), bi('фазы etcd и control-plane', 'the etcd and control-plane phases'), 'ls /etc/kubernetes/manifests', D.staticPods),
      node('klet', 'kubelet', 'node', 'rack', 330, 360, 200, 70, bi('Единственная служба systemd на узле. Читает каталог manifests и запускает поды из файлов, даже когда API-сервера нет.', 'The only systemd service on the node. It reads the manifests directory and starts pods from the files, even when there is no API server.'), bi('пакет kubelet, systemd', 'the kubelet package, systemd'), 'systemctl status kubelet; journalctl -u kubelet -n 50'),
      node('etcd', 'etcd', 'store', 'box', 640, 380, 140, 50, bi('Хранилище кластера, статический под. Слушает 2379 только по TLS со своим CA.', 'The cluster store, a static pod. Listens on 2379 over TLS only, with its own CA.'), bi('kubelet из etcd.yaml', 'the kubelet from etcd.yaml'), 'sudo crictl ps --name etcd'),
      node('api', 'kube-apiserver', 'cp', 'hex', 640, 250, 200, 56, bi('Статический под. Ходит в etcd с клиентским сертификатом, отдаёт API на 6443 с сертификатом apiserver.crt.', 'A static pod. It talks to etcd with a client certificate and serves the API on 6443 with apiserver.crt.'), bi('kubelet из kube-apiserver.yaml', 'the kubelet from kube-apiserver.yaml'), 'kubectl -n kube-system get pod -l component=kube-apiserver'),
      node('cms', bi('controller-manager, scheduler', 'controller-manager, scheduler'), 'cp', 'hex', 640, 130, 290, 56, bi('Ещё два статических пода. Каждый ходит в API со своим kubeconfig из /etc/kubernetes.', 'Two more static pods. Each talks to the API with its own kubeconfig from /etc/kubernetes.'), bi('kubelet из манифестов', 'the kubelet from the manifests')),
      node('dns', 'CoreDNS', 'cp', 'box', 640, 24, 140, 50, bi('Дополнение, которое kubeadm ставит последним, вместе с kube-proxy. Обычный Deployment: без сети подов он в Pending.', 'An addon kubeadm installs last, together with kube-proxy. An ordinary Deployment: without a pod network it is Pending.'), bi('фаза addon', 'the addon phase'), 'kubectl -n kube-system get pods -l k8s-app=kube-dns'),
      node('cni', 'CNI', 'node', 'box', 820, 24, 120, 50, bi('Сетевой плагин (Cilium, Calico, flannel). kubeadm его не ставит: это следующий урок.', 'The network plugin (Cilium, Calico, flannel). kubeadm does not install one: that is the next lesson.'), bi('вы, после init', 'you, after init'), 'cilium status'),
    ],
    edges: [
      edge('e-certs', 'kadm', 'pki', 'certs', bi('Фаза certs создаёт CA и подписывает им сертификаты компонентов.', 'The certs phase creates the CA and signs the component certificates with it.'), bi('kubeadm', 'kubeadm')),
      edge('e-confs', 'pki', 'confs', bi('клиентские серты', 'client certs'), bi('Каждый kubeconfig несёт CA и клиентский сертификат, подписанный тем же CA.', 'Each kubeconfig carries the CA and a client certificate signed by the same CA.'), bi('kubeadm, фаза kubeconfig', 'kubeadm, the kubeconfig phase')),
      edge('e-mf', 'confs', 'mf', bi('манифесты', 'manifests'), bi('Манифесты ссылаются на файлы pki и *.conf через hostPath.', 'The manifests refer to the pki and *.conf files through hostPath.'), bi('kubeadm, фазы etcd и control-plane', 'kubeadm, the etcd and control-plane phases')),
      edge('e-read', 'mf', 'klet', bi('читает каталог', 'reads the directory'), bi('kubelet раз в 20 секунд перечитывает staticPodPath и запускает, перезапускает или останавливает поды по файлам.', 'Every 20 seconds the kubelet rereads staticPodPath and starts, restarts or stops pods by the files.'), bi('kubelet', 'kubelet')),
      edge('e-etcd', 'klet', 'etcd', bi('запускает', 'starts'), bi('Сначала etcd.', 'etcd first.'), bi('kubelet через containerd', 'the kubelet through containerd')),
      edge('e-api', 'klet', 'api', bi('запускает', 'starts'), bi('Затем API-сервер…', 'Then the API server…'), bi('kubelet через containerd', 'the kubelet through containerd'), { via: [[560, 395], [560, 278]], labelAt: 0.6 }),
      edge('e-cms', 'klet', 'cms', bi('запускает', 'starts'), bi('…и два контроллера.', '…and the two controllers.'), bi('kubelet через containerd', 'the kubelet through containerd'), { via: [[460, 158]], labelAt: 0.4 }),
      edge('e-store', 'api', 'etcd', 'TLS :2379', bi('API-сервер — единственный клиент etcd. Сертификат apiserver-etcd-client подписан CA etcd.', 'The API server is etcd’s only client. The apiserver-etcd-client certificate is signed by the etcd CA.'), bi('kube-apiserver', 'kube-apiserver')),
      edge('e-watch', 'cms', 'api', 'TLS :6443', bi('Контроллеры и планировщик говорят с API по своим kubeconfig.', 'The controllers and the scheduler talk to the API with their kubeconfigs.'), bi('kube-controller-manager, kube-scheduler', 'kube-controller-manager, kube-scheduler')),
      edge('e-net', 'cni', 'dns', bi('сеть подов', 'pod network'), bi('Без CNI у подов нет адресов, и CoreDNS не может стартовать.', 'Without a CNI pods have no addresses, and CoreDNS cannot start.'), bi('сетевой плагин', 'the network plugin')),
    ],
  },
  params: [
    {
      id: 'cni',
      label: bi('Сетевой плагин установлен', 'A network plugin is installed'),
      kind: 'toggle',
      default: false,
      near: 'cni',
      predict: { prompt: bi('init закончился, CNI нет. В каком состоянии CoreDNS?', 'init has finished, there is no CNI. What state is CoreDNS in?'), options: [{ id: 'pending', text: bi('Pending', 'Pending') }, { id: 'running', text: bi('Running', 'Running') }], resolve: (_p, n) => (n.some((s) => s.values?.dns === 'Running') ? 'running' : 'pending') },
    },
    {
      id: 'months',
      label: bi('Прошло месяцев после init', 'Months since init'),
      kind: 'range',
      min: 0,
      max: 24,
      step: 3,
      default: 0,
      near: 'pki',
      levels: ['intermediate', 'experienced'],
      predict: { prompt: bi('Кластер не обновляли 13 месяцев. Что ответит kubectl?', 'The cluster has not been upgraded for 13 months. What does kubectl answer?'), options: [{ id: 'x509', text: bi('Ошибку x509: срок сертификата истёк', 'An x509 error: the certificate has expired') }, { id: 'ok', text: bi('Как обычно', 'As usual') }], resolve: (_p, n) => (n.some((s) => s.id === 'expired') ? 'x509' : 'ok') },
    },
    { id: 'renewed', label: bi('Сертификаты продлевали (kubeadm certs renew или upgrade)', 'Certificates were renewed (kubeadm certs renew or an upgrade)'), kind: 'toggle', default: false, near: 'pki', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'ipfwd',
      label: bi('Забыть net.ipv4.ip_forward=1', 'Forget net.ipv4.ip_forward=1'),
      remove: ['e-certs'],
      boundary: 'kernel',
      predict: { prompt: bi('Пересылка пакетов в ядре выключена. Где остановится init?', 'Packet forwarding is off in the kernel. Where does init stop?'), options: [{ id: 'pre', text: bi('Сразу, на проверках preflight', 'At once, in the preflight checks') }, { id: 'late', text: bi('Поды запустятся, сеть не будет работать', 'The pods start, the network will not work') }], resolve: () => 'pre' },
    },
    {
      id: 'swap',
      label: bi('Не выключить swap', 'Leave swap on'),
      remove: ['klet'],
      boundary: 'process',
      predict: { prompt: bi('swap включён. Что случится?', 'Swap is on. What happens?'), options: [{ id: 'kubelet', text: bi('kubelet не стартует, init ждёт его 4 минуты и сдаётся', 'The kubelet does not start, init waits 4 minutes and gives up') }, { id: 'slow', text: bi('Всё заработает, только медленнее', 'Everything works, only slower') }], resolve: () => 'kubelet' },
    },
    {
      id: 'cgroup',
      label: bi('containerd с SystemdCgroup = false', 'containerd with SystemdCgroup = false'),
      remove: ['e-api'],
      boundary: 'process',
      predict: { prompt: bi('kubelet ждёт драйвер systemd, containerd работает с cgroupfs. Что вы увидите?', 'The kubelet expects the systemd driver, containerd runs with cgroupfs. What will you see?'), options: [{ id: 'flap', text: bi('Control plane то поднимается, то падает', 'The control plane keeps coming up and falling down') }, { id: 'error', text: bi('Понятную ошибку в preflight', 'A clear error in preflight') }], resolve: () => 'flap' },
    },
  ],
  metrics: [
    { id: 'files', label: bi('файлов записал kubeadm', 'files written by kubeadm') },
    { id: 'days', label: bi('дней до конца сертификатов', 'days until the certificates expire') },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    const cert = certState(p.months, p.renewed);
    s.push({ id: 'preflight', label: 'preflight', caption: bi('Проверки: модули br_netfilter и overlay, ip_forward=1, свободные порты 6443, 2379–2380, 10250, рантайм отвечает по CRI, swap.', 'Checks: the br_netfilter and overlay modules, ip_forward=1, free ports 6443, 2379–2380, 10250, the runtime answers over CRI, swap.'), focus: ['kadm'], metrics: { files: 0, days: 365 } });
    if (broken.has('ipfwd')) {
      s.push({ id: 'fail', label: bi('стоп', 'stop'), caption: bi('init останавливается до того, как записал хоть один файл. Это лучший вид ошибки: понятный и дешёвый.', 'init stops before writing a single file. This is the best kind of error: clear and cheap.'), focus: ['kadm'], states: { kadm: 'err' }, metrics: { files: 0, days: 365 }, broken: { at: 'kadm', message: '[preflight] Running pre-flight checks\nerror execution phase preflight: [preflight] Some fatal errors occurred:\n\t[ERROR FileContent--proc-sys-net-ipv4-ip_forward]: /proc/sys/net/ipv4/ip_forward contents are not set to 1', caption: bi('без пересылки пакетов узел не сможет быть маршрутизатором для подов — kubeadm проверяет это первым.', 'without packet forwarding the node cannot route for its pods — kubeadm checks it first.') } });
      return s;
    }
    s.push({ id: 'certs', label: 'certs', caption: bi('Фаза certs: CA кластера на 10 лет и сертификаты компонентов на год. В apiserver.crt вписаны все имена и адреса, по которым к API будут обращаться (SAN).', 'The certs phase: the cluster CA for 10 years and the component certificates for one year. apiserver.crt lists every name and address the API will be reached by (SANs).'), focus: ['e-certs', 'pki'], tokens: [{ edge: 'e-certs', label: 'ca.crt + 21 files' }], states: { pki: 'ok' }, metrics: { files: 22, days: 365 } });
    s.push({ id: 'kubeconfig', label: 'kubeconfig', caption: bi('Фаза kubeconfig: admin.conf для вас, свои файлы для controller-manager, scheduler и kubelet. Каждый — это адрес API, CA и клиентский сертификат.', 'The kubeconfig phase: admin.conf for you, separate files for the controller-manager, the scheduler and the kubelet. Each is the API address, the CA and a client certificate.'), focus: ['e-confs', 'confs'], tokens: [{ edge: 'e-confs', label: '5 × .conf' }], states: { confs: 'ok' }, metrics: { files: 27, days: 365 } });
    s.push({ id: 'manifests', label: 'manifests', caption: bi('Фазы etcd и control-plane не запускают ничего: они только кладут четыре YAML-файла в /etc/kubernetes/manifests.', 'The etcd and control-plane phases start nothing: they only put four YAML files into /etc/kubernetes/manifests.'), focus: ['e-mf', 'mf'], tokens: [{ edge: 'e-mf', label: '4 × .yaml' }], states: { mf: 'ok' }, metrics: { files: 31, days: 365 } });
    if (broken.has('swap')) {
      s.push({ id: 'nokubelet', label: 'kubelet', caption: bi('kubelet падает при старте, файлы в manifests никто не читает, и init ждёт здоровый kubelet четыре минуты.', 'The kubelet dies at start, nobody reads the manifests, and init waits four minutes for a healthy kubelet.'), focus: ['klet', 'e-read'], states: { klet: 'err' }, metrics: { files: 31, days: 365 }, broken: { at: 'klet', message: '$ journalctl -u kubelet -n 1\nkubelet[2211]: E1118 "command failed" err="failed to run Kubelet: running with swap on is not supported, please disable swap or set --fail-swap-on flag to false"\n\n[kubelet-check] The kubelet is not healthy after 4m0s', caption: bi('сообщение kubeadm говорит только «kubelet нездоров»; причину называет журнал kubelet.', 'the kubeadm message only says "the kubelet is unhealthy"; the kubelet journal names the reason.') } });
      return s;
    }
    s.push({ id: 'kubelet', label: 'kubelet-start', caption: bi('kubelet перечитал каталог и запустил статические поды: etcd, API-сервер, контроллеры. В API они появятся «зеркальными» подами с именем узла в конце: kube-apiserver-cp-1.', 'The kubelet reread the directory and started the static pods: etcd, the API server, the controllers. In the API they show up as "mirror" pods with the node name at the end: kube-apiserver-cp-1.'), focus: ['e-read', 'klet', 'e-etcd', 'e-api', 'e-cms'], tokens: [{ edge: 'e-read' }, { edge: 'e-etcd' }, { edge: 'e-api' }, { edge: 'e-cms' }], states: { klet: 'ok', etcd: 'ok', api: 'ok', cms: 'ok' }, metrics: { files: 31, days: 365 } });
    if (broken.has('cgroup')) {
      s.push({ id: 'flap', label: bi('мигает', 'flapping'), caption: bi('kubelet и containerd по-разному понимают, где лежат cgroup контейнеров. Поды control plane то и дело убиваются и перезапускаются, API-сервер отвечает через раз.', 'The kubelet and containerd disagree on where the container cgroups live. The control-plane pods keep getting killed and restarted, the API server answers every other time.'), focus: ['api', 'etcd'], states: { api: 'warn', etcd: 'warn' }, metrics: { files: 31, days: 365 }, broken: { at: 'api', message: '$ kubectl get nodes\nThe connection to the server 10.10.1.11:6443 was refused - did you specify the right host or port?\n$ sudo crictl ps -a | grep kube-apiserver\n3f2a1c   Exited   kube-apiserver   7', caption: bi('preflight этого не ловит: драйвер cgroup надо выставить в containerd одинаково с kubelet (systemd) до init.', 'preflight does not catch it: the cgroup driver in containerd must match the kubelet’s (systemd) before init.') } });
      return s;
    }
    s.push({ id: 'wait', label: 'wait', caption: bi('API-сервер ответил на /readyz. kubeadm загружает свою конфигурацию в ConfigMap kubeadm-config, помечает узел control-plane и создаёт bootstrap-токен для будущих узлов.', 'The API server answered /readyz. kubeadm uploads its configuration to the kubeadm-config ConfigMap, marks the node control-plane and creates a bootstrap token for future nodes.'), focus: ['api', 'e-store', 'e-watch'], tokens: [{ edge: 'e-store' }, { edge: 'e-watch' }], metrics: { files: 31, days: cert.leafLeftDays } });
    s.push({ id: 'addons', label: 'addons', caption: p.cni ? bi('Дополнения: kube-proxy и CoreDNS. Сеть подов есть — CoreDNS получает адреса и становится Ready, узел Ready.', 'Addons: kube-proxy and CoreDNS. There is a pod network — CoreDNS gets addresses and becomes Ready, the node is Ready.') : bi('Дополнения: kube-proxy и CoreDNS. Сети подов нет: CoreDNS в Pending, узел NotReady. init напомнит: «You should now deploy a pod network to the cluster».', 'Addons: kube-proxy and CoreDNS. No pod network: CoreDNS is Pending, the node is NotReady. init reminds you: "You should now deploy a pod network to the cluster".'), focus: ['dns', 'e-net', 'cni'], tokens: p.cni ? [{ edge: 'e-net' }] : [], states: { dns: p.cni ? 'ok' : 'wait', cni: p.cni ? 'ok' : 'off' }, values: { dns: p.cni ? 'Running' : 'Pending' }, metrics: { files: 31, days: cert.leafLeftDays } });
    if (cert.expired)
      s.push({ id: 'expired', label: 'x509', caption: bi('Прошёл год: сертификаты компонентов и admin.conf истекли. kubectl больше не может представиться API-серверу; kubelet тоже теряет связь.', 'A year has passed: the component certificates and admin.conf have expired. kubectl can no longer introduce itself to the API server; the kubelet loses its connection too.'), focus: ['pki', 'confs'], states: { pki: 'err', confs: 'err' }, values: { pki: 'leaf: expired' }, metrics: { files: 31, days: cert.leafLeftDays } });
    else if (p.months > 0) s.push({ id: 'aging', label: bi('время', 'time'), caption: fmt(bi('До конца сертификатов {d} дней. Каждое обновление кластера через kubeadm upgrade продлевает их — регулярные обновления и есть лучшая защита.', '{d} days until the certificates expire. Every cluster upgrade with kubeadm upgrade renews them — regular upgrades are the best protection.'), { d: cert.leafLeftDays }), focus: ['pki'], states: { pki: cert.leafLeftDays < 60 ? 'warn' : 'ok' }, metrics: { files: 31, days: cert.leafLeftDays } });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Пропущенная подготовка узла: смотрите, на какой фазе это всплывает и какое сообщение вы увидите.', 'A skipped node preparation step: see at which phase it surfaces and which message you get.') : bi('Узел подготовлен правильно.', 'The node is prepared correctly.');
    if (change.id === 'cni') return b.cni ? bi('С сетью подов CoreDNS стартует, и узел становится Ready.', 'With a pod network CoreDNS starts and the node becomes Ready.') : bi('Без CNI init завершается успешно, но кластер ещё не работает.', 'Without a CNI init finishes successfully, but the cluster does not work yet.');
    const d = metric(next, 'days');
    return d <= 0 ? bi('Сертификаты истекли: нужен kubeadm certs renew all и перезапуск статических подов.', 'The certificates have expired: you need kubeadm certs renew all and a restart of the static pods.') : fmt(bi('Сертификатам осталось {d} дней.', 'The certificates have {d} days left.'), { d });
  },
});
