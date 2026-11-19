// Stage 2 (05 §11.4): how a new node earns its identity. `kubeadm join`
// finds the cluster CA in the public cluster-info ConfigMap and trusts it
// only if its hash matches the one you passed; the kubelet then introduces
// itself with the short-lived bootstrap token, asks for a certificate with a
// CertificateSigningRequest, gets it signed by the cluster CA and from then
// on talks to the API as system:node:<name>.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, node } from './kit';

type P = { hours: number; ttl: number; pin: string };

/** Is the bootstrap token still valid after `hours` with a TTL of `ttl` hours (0 = never expires)? */
export function tokenValid(hours: number, ttl: number): boolean {
  return ttl === 0 || hours < ttl;
}

export const tlsBootstrapModel = defineModel<P>({
  id: 'k8s.tls-bootstrap',
  block: 'k8s-2',
  title: bi('kubeadm join: как узел получает свой сертификат', 'kubeadm join: how a node gets its certificate'),
  summary: bi('Новый узел не знает кластер, а кластер не знает узел. Хеш CA защищает узел от чужого API-сервера, bootstrap-токен — кластер от чужого узла, а CSR даёт kubelet собственный сертификат.', 'A new node does not know the cluster, and the cluster does not know the node. The CA hash protects the node from a foreign API server, the bootstrap token protects the cluster from a foreign node, and a CSR gives the kubelet its own certificate.'),
  concepts: ['k8s.tls-bootstrap', 'k8s.pki'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      node('join', 'kubeadm join', 'user', 'pill', 24, 24, 150, 44, bi('Команда, которую напечатал kubeadm init: адрес API, токен и хеш открытого ключа CA.', 'The command kubeadm init printed: the API address, a token and the hash of the CA public key.'), bi('вы, на worker-1', 'you, on worker-1'), 'kubeadm join --help', D.kubeadmJoin),
      node('ci', 'cluster-info', 'obj', 'doc', 440, 24, 190, 70, bi('ConfigMap в kube-public, доступный без входа: kubeconfig с адресом API и сертификатом CA, подписанный bootstrap-токенами (JWS).', 'A ConfigMap in kube-public readable without logging in: a kubeconfig with the API address and the CA certificate, signed with the bootstrap tokens (JWS).'), bi('kubeadm init, фаза bootstrap-token', 'kubeadm init, the bootstrap-token phase'), 'kubectl -n kube-public get cm cluster-info -o yaml'),
      node('api', 'kube-apiserver', 'cp', 'hex', 380, 170, 200, 56, bi('Проверяет токен (группа system:bootstrappers) и принимает CSR.', 'Checks the token (the system:bootstrappers group) and accepts the CSR.'), bi('control plane', 'the control plane'), undefined, D.apiserver),
      node('tok', 'bootstrap token', 'obj', 'doc', 720, 24, 216, 70, bi('Secret bootstrap-token-<id> в kube-system: токен вида abcdef.0123456789abcdef, срок жизни по умолчанию 24 часа.', 'A Secret bootstrap-token-<id> in kube-system: a token like abcdef.0123456789abcdef, with a default lifetime of 24 hours.'), bi('kubeadm init или kubeadm token create', 'kubeadm init or kubeadm token create'), 'kubeadm token list'),
      node('csr', 'CertificateSigningRequest', 'obj', 'doc', 380, 290, 240, 70, bi('Заявка kubelet на клиентский сертификат: CN=system:node:worker-1, O=system:nodes, signerName kubernetes.io/kube-apiserver-client-kubelet.', 'The kubelet’s request for a client certificate: CN=system:node:worker-1, O=system:nodes, signerName kubernetes.io/kube-apiserver-client-kubelet.'), bi('kubelet', 'kubelet'), 'kubectl get csr'),
      node('kcm', bi('controller-manager: approve + sign', 'controller-manager: approve + sign'), 'cp', 'hex', 700, 290, 240, 60, bi('Контроллер csrapproving одобряет заявки узлов от system:bootstrappers, csrsigning подписывает их ключом CA кластера.', 'The csrapproving controller approves node requests from system:bootstrappers, csrsigning signs them with the cluster CA key.'), bi('kube-controller-manager', 'kube-controller-manager'), undefined, D.tlsBootstrap),
      node('klet', 'kubelet worker-1', 'node', 'rack', 24, 290, 220, 70, bi('Стартует с bootstrap-kubelet.conf (токен), получает сертификат и переходит на kubelet.conf. Сертификат лежит в /var/lib/kubelet/pki и обновляется сам до истечения.', 'Starts with bootstrap-kubelet.conf (the token), gets a certificate and switches to kubelet.conf. The certificate lives in /var/lib/kubelet/pki and renews itself before it expires.'), bi('пакет kubelet, systemd', 'the kubelet package, systemd'), 'sudo ls -l /var/lib/kubelet/pki'),
      node('nodeobj', 'Node worker-1', 'obj', 'doc', 24, 400, 220, 56, bi('Объект Node, который kubelet регистрирует уже со своим сертификатом.', 'The Node object the kubelet registers, already with its own certificate.'), bi('kubelet', 'kubelet'), 'kubectl get nodes -o wide'),
    ],
    edges: [
      edge('e-get', 'join', 'ci', bi('читает без входа', 'reads anonymously'), bi('Первый запрос узла: без всякой проверки получить cluster-info.', 'The node’s first request: get cluster-info with no authentication at all.'), bi('kubeadm join', 'kubeadm join')),
      edge('e-pin', 'ci', 'join', bi('CA + подпись', 'CA + signature'), bi('Узел сверяет хеш открытого ключа CA с --discovery-token-ca-cert-hash и подпись JWS — с токеном.', 'The node compares the CA public key hash with --discovery-token-ca-cert-hash and the JWS signature with the token.'), bi('kubeadm join', 'kubeadm join'), { via: [[400, 84], [100, 84]], labelAt: 0.5 }),
      edge('e-tok', 'tok', 'ci', 'JWS', bi('Токен подписывает cluster-info: знание токена доказывает, что ConfigMap не подменён.', 'The token signs cluster-info: knowing the token proves the ConfigMap was not swapped.'), bi('контроллер bootstrapsigner', 'the bootstrapsigner controller')),
      edge('e-auth', 'klet', 'api', bi('вход по токену', 'log in with the token'), bi('kubelet представляется как system:bootstrap:<id> из группы system:bootstrappers.', 'The kubelet introduces itself as system:bootstrap:<id> in the system:bootstrappers group.'), bi('kubelet', 'kubelet'), { via: [[300, 310], [300, 198]], labelAt: 0.5 }),
      edge('e-csr', 'api', 'csr', 'create CSR', bi('Единственное, что можно сделать с bootstrap-токеном, — создать заявку на сертификат.', 'The only thing a bootstrap token allows is creating a certificate request.'), bi('kubelet через API', 'the kubelet through the API')),
      edge('e-sign', 'kcm', 'csr', bi('Approved, Issued', 'Approved, Issued'), bi('Одобрение и подпись — два разных контроллера; оба внутри controller-manager.', 'Approval and signing are two different controllers; both live in the controller-manager.'), bi('kube-controller-manager', 'kube-controller-manager')),
      edge('e-cert', 'csr', 'klet', bi('сертификат', 'certificate'), bi('kubelet забирает подписанный сертификат из status.certificate заявки.', 'The kubelet takes the signed certificate from the request’s status.certificate.'), bi('kubelet', 'kubelet')),
      edge('e-reg', 'klet', 'nodeobj', bi('регистрирует', 'registers'), bi('С новым сертификатом kubelet создаёт объект Node и дальше только продлевает Lease.', 'With the new certificate the kubelet creates the Node object and from then on just renews its Lease.'), bi('kubelet', 'kubelet')),
    ],
  },
  params: [
    {
      id: 'hours',
      label: bi('Часов прошло после init', 'Hours since init'),
      kind: 'range',
      min: 0,
      max: 48,
      step: 6,
      default: 1,
      near: 'tok',
      predict: { prompt: bi('Вы присоединяете узел через двое суток той же командой. Что будет?', 'You join a node two days later with the same command. What happens?'), options: [{ id: 'expired', text: bi('Токен истёк: join откажет', 'The token has expired: join fails') }, { id: 'ok', text: bi('Узел присоединится', 'The node joins') }], resolve: (_p, n) => (n.some((s) => s.broken) ? 'expired' : 'ok') },
    },
    { id: 'ttl', label: bi('Срок токена, часов (0 — вечный)', 'Token TTL, hours (0 — forever)'), kind: 'range', min: 0, max: 48, step: 12, default: 24, near: 'tok', levels: ['intermediate', 'experienced'] },
    {
      id: 'pin',
      label: bi('Проверка CA', 'CA verification'),
      kind: 'choice',
      default: 'hash',
      near: 'ci',
      levels: ['intermediate', 'experienced'],
      options: [
        { id: 'hash', label: bi('--discovery-token-ca-cert-hash', '--discovery-token-ca-cert-hash') },
        { id: 'skip', label: bi('--discovery-token-unsafe-skip-ca-verification', '--discovery-token-unsafe-skip-ca-verification') },
      ],
      predict: { prompt: bi('Без проверки хеша join тоже работает. Чем это опасно?', 'Without the hash check join works too. What is the danger?'), options: [{ id: 'mitm', text: bi('Узел поверит любому серверу, который подсунет свой CA', 'The node trusts any server that slips in its own CA') }, { id: 'none', text: bi('Ничем: токен всё равно секретный', 'None: the token is secret anyway') }], resolve: () => 'mitm' },
    },
  ],
  breaks: [
    {
      id: 'hash',
      label: bi('Опечатка в хеше CA', 'A typo in the CA hash'),
      remove: ['e-pin'],
      boundary: 'identity',
      predict: { prompt: bi('Хеш не совпал. Что скажет join?', 'The hash does not match. What does join say?'), options: [{ id: 'pinned', text: bi('Что ключ CA не закреплён', 'That the CA key is not pinned') }, { id: 'token', text: bi('Что неверный токен', 'That the token is wrong') }], resolve: () => 'pinned' },
    },
    {
      id: 'approver',
      label: bi('Отключить автоодобрение CSR', 'Turn off CSR auto-approval'),
      remove: ['e-sign'],
      boundary: 'identity',
      predict: { prompt: bi('Заявку никто не одобряет. Где застрянет узел?', 'Nobody approves the request. Where does the node get stuck?'), options: [{ id: 'pending', text: bi('CSR в Pending, узла в списке нет', 'The CSR is Pending, the node is not listed') }, { id: 'notready', text: bi('Узел есть, но NotReady', 'The node is listed but NotReady') }], resolve: () => 'pending' },
    },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    s.push({ id: 'discover', label: 'discovery', caption: bi('join идёт на 10.10.1.11:6443 без всякой проверки и читает публичный cluster-info: там адрес API и сертификат CA.', 'join goes to 10.10.1.11:6443 with no checks at all and reads the public cluster-info: the API address and the CA certificate.'), focus: ['join', 'e-get', 'ci'], tokens: [{ edge: 'e-get', label: 'GET cluster-info' }] });
    if (broken.has('hash')) {
      s.push({ id: 'pinfail', label: 'pin', caption: bi('Хеш ключа CA не совпал с тем, что вы передали: узел отказывается верить этому серверу. Так и задумано — иначе узел можно подключить к чужому кластеру.', 'The CA key hash does not match what you passed: the node refuses to trust this server. That is the design — otherwise a node could be attached to a foreign cluster.'), focus: ['e-pin', 'join'], states: { join: 'err' }, broken: { at: 'join', message: 'error execution phase preflight: couldn\'t validate the identity of the API Server: cluster CA found in cluster-info ConfigMap is invalid: none of the public keys "sha256:9f1c…" are pinned', caption: bi('скопируйте хеш заново: `openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | openssl rsa -pubin -outform der | sha256sum` на cp-1.', 'copy the hash again: `openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | openssl rsa -pubin -outform der | sha256sum` on cp-1.') } });
      return s;
    }
    if (!tokenValid(p.hours, p.ttl)) {
      s.push({ id: 'expired', label: bi('токен', 'token'), caption: fmt(bi('Прошло {h} ч, а токен жил {t} ч: его Secret удалён, подписи JWS для него в cluster-info больше нет.', '{h} h have passed, and the token lived {t} h: its Secret is gone, cluster-info no longer carries a JWS signature for it.'), { h: p.hours, t: p.ttl }), focus: ['tok', 'e-tok'], states: { tok: 'err' }, broken: { at: 'tok', message: 'error execution phase preflight: couldn\'t validate the identity of the API Server: could not find a JWS signature in the cluster-info ConfigMap for token ID "abcdef"', caption: bi('новую команду join печатает `kubeadm token create --print-join-command` на cp-1.', 'a new join command is printed by `kubeadm token create --print-join-command` on cp-1.') } });
      return s;
    }
    s.push({
      id: 'pin',
      label: 'pin',
      caption: p.pin === 'hash' ? bi('Узел сверил хеш открытого ключа CA с переданным и проверил подпись JWS токеном. Теперь он знает, что это его кластер.', 'The node compared the CA public key hash with the one passed and checked the JWS signature with the token. Now it knows this is its cluster.') : bi('Проверка CA пропущена: узел верит первому ответившему серверу. В учебной сети сойдёт, в настоящей — нет.', 'The CA check is skipped: the node trusts whichever server answers first. Acceptable on a lab network, not on a real one.'),
      focus: ['e-pin', 'e-tok', 'tok'],
      tokens: [{ edge: 'e-tok', label: 'JWS' }, { edge: 'e-pin', label: p.pin === 'hash' ? 'sha256 ✓' : 'skip' }],
      states: { join: p.pin === 'hash' ? 'ok' : 'warn' },
    });
    s.push({ id: 'bootstrap', label: bi('вход', 'login'), caption: bi('join пишет bootstrap-kubelet.conf с токеном и запускает kubelet. Тот входит как system:bootstrap:abcdef — права у этой учётной записи только на создание заявки.', 'join writes bootstrap-kubelet.conf with the token and starts the kubelet. It logs in as system:bootstrap:abcdef — that account may only create a certificate request.'), focus: ['klet', 'e-auth', 'api'], tokens: [{ edge: 'e-auth', label: 'Bearer abcdef.…' }], states: { klet: 'on' } });
    s.push({ id: 'csr', label: 'CSR', caption: bi('kubelet сам создаёт ключ и отправляет заявку: «подпишите мне CN=system:node:worker-1, O=system:nodes». Закрытый ключ узел не покидает.', 'The kubelet creates its own key and sends a request: "sign CN=system:node:worker-1, O=system:nodes for me". The private key never leaves the node.'), focus: ['e-csr', 'csr'], tokens: [{ edge: 'e-csr', label: 'CSR' }], states: { csr: 'wait' }, values: { csr: 'Pending' } });
    if (broken.has('approver')) {
      s.push({ id: 'pending', label: 'Pending', caption: bi('Заявка лежит в Pending: одобрить её некому. kubelet ждёт, объекта Node нет.', 'The request sits in Pending: nobody approves it. The kubelet waits, there is no Node object.'), focus: ['csr', 'kcm'], states: { csr: 'warn', kcm: 'off' }, broken: { at: 'csr', message: '$ kubectl get csr\nNAME        AGE   SIGNERNAME                                    REQUESTOR                 CONDITION\ncsr-8xk2p   3m    kubernetes.io/kube-apiserver-client-kubelet   system:bootstrap:abcdef   Pending', caption: bi('вручную такую заявку одобряет `kubectl certificate approve csr-8xk2p` — но сначала убедитесь, что узел ваш.', 'such a request is approved by hand with `kubectl certificate approve csr-8xk2p` — but first make sure the node is yours.') } });
      return s;
    }
    s.push({ id: 'sign', label: bi('подпись', 'sign'), caption: bi('csrapproving одобрил заявку (её прислал участник system:bootstrappers), csrsigning подписал её ключом CA. Состояние: Approved,Issued.', 'csrapproving approved the request (it came from a member of system:bootstrappers), csrsigning signed it with the CA key. The condition: Approved,Issued.'), focus: ['kcm', 'e-sign', 'csr'], tokens: [{ edge: 'e-sign', label: 'Approved,Issued' }], states: { csr: 'ok', kcm: 'ok' }, values: { csr: 'Approved,Issued' } });
    s.push({ id: 'cert', label: bi('сертификат', 'certificate'), caption: bi('kubelet забрал сертификат в /var/lib/kubelet/pki/kubelet-client-current.pem и перешёл на kubelet.conf. Bootstrap-токен ему больше не нужен.', 'The kubelet took the certificate into /var/lib/kubelet/pki/kubelet-client-current.pem and switched to kubelet.conf. It no longer needs the bootstrap token.'), focus: ['e-cert', 'klet'], tokens: [{ edge: 'e-cert', label: 'kubelet-client.pem' }], states: { klet: 'ok' } });
    s.push({ id: 'register', label: 'Node', caption: bi('kubelet регистрирует Node worker-1 уже как system:node:worker-1. Ready узел станет, когда на нём заработает сетевой плагин.', 'The kubelet registers Node worker-1, already as system:node:worker-1. The node becomes Ready once the network plugin runs on it.'), focus: ['e-reg', 'nodeobj'], tokens: [{ edge: 'e-reg' }], states: { nodeobj: 'ok' } });
    return s;
  },
  explainDelta(_prev, _next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Одно звено цепочки доверия выпало — смотрите, кто и каким сообщением это замечает.', 'One link of the chain of trust is gone — see who notices it and with what message.') : bi('Цепочка доверия снова цела.', 'The chain of trust is whole again.');
    if (change.id === 'pin') return b.pin === 'skip' ? bi('Без хеша узел не может отличить свой кластер от подставного.', 'Without the hash the node cannot tell its cluster from a fake one.') : bi('Хеш закрепляет CA: подменить сервер незаметно нельзя.', 'The hash pins the CA: the server cannot be swapped unnoticed.');
    return tokenValid(Number(b.hours), Number(b.ttl)) ? bi('Токен ещё жив: join пройдёт.', 'The token is still alive: join will pass.') : bi('Токен истёк: нужен новый, kubeadm token create.', 'The token has expired: you need a new one, kubeadm token create.');
  },
});
