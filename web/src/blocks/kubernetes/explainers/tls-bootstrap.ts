// Stage 2 (05 §11.4): how a new node earns its identity. `kubeadm join`
// finds the cluster CA in the public cluster-info ConfigMap and trusts it
// only if its hash matches the one you passed; the kubelet then introduces
// itself with the short-lived bootstrap token, asks for a certificate with a
// CertificateSigningRequest, gets it signed by the cluster CA and from then
// on talks to the API as system:node:<name>.
//
// Reading order: at first only the join command and the public cluster-info
// are on screen; the token, the kubelet, the request and the controllers that
// sign it appear as the chain of trust is built, one link per step.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, idsOf, LEGEND_BASE, mark, only } from './kit';

type P = { hours: number; ttl: number; pin: string };

/** Is the bootstrap token still valid after `hours` with a TTL of `ttl` hours (0 = never expires)? */
export function tokenValid(hours: number, ttl: number): boolean {
  return ttl === 0 || hours < ttl;
}

const diagram = {
  width: 960,
  height: 470,
  nodes: [
    box('join', 'kubeadm join', 'user', 'pill', [24, 24, 170, 48], 'terminal', bi('Команда, которую напечатал kubeadm init. В ней адрес API-сервера, токен и хеш открытого ключа центра сертификации кластера.', 'The command init printed: the API address, a token and the CA key hash.'), bi('Команду запускаете вы на worker-1.', 'You, on worker-1.'), { see: 'kubeadm join --help', doc: D.kubeadmJoin }),
    box('ci', 'cluster-info', 'obj', 'doc', [440, 24, 200, 70], 'file', bi('ConfigMap в namespace kube-public, который можно прочитать без входа в кластер. В нём kubeconfig с адресом API и сертификатом центра, подписанный токенами присоединения (подписью JWS).', 'A public ConfigMap with the API address and the CA, signed by the bootstrap tokens (JWS).'), bi('Создаёт kubeadm init, фаза bootstrap-token.', 'kubeadm init.'), { see: 'kubectl -n kube-public get cm cluster-info -o yaml' }),
    box('api', 'kube-apiserver', 'cp', 'hex', [380, 170, 210, 56], 'server', bi('API-сервер проверяет токен присоединения (такой пользователь входит в группу system:bootstrappers) и принимает заявку на сертификат.', 'Checks the bootstrap token and accepts the CSR.'), bi('Работает на управляющем узле.', 'Runs on the control-plane node.'), { doc: D.apiserver }),
    box('tok', bi('Токен присоединения', 'Bootstrap token'), 'obj', 'doc', [716, 24, 220, 70], 'lock', bi('Secret bootstrap-token-<id> в kube-system с токеном вида abcdef.0123456789abcdef. По умолчанию токен действует 24 часа.', 'A Secret with a token like abcdef.0123…; 24 hours by default.'), bi('Создаёт kubeadm init или kubeadm token create.', 'kubeadm init or kubeadm token create.'), { see: 'kubeadm token list' }),
    box('csr', bi('Заявка на сертификат (CSR)', 'Certificate request (CSR)'), 'obj', 'doc', [380, 290, 250, 70], 'file', bi('Объект CertificateSigningRequest: kubelet просит клиентский сертификат на имя system:node:worker-1 в группе system:nodes.', 'The kubelet asks for CN=system:node:worker-1, O=system:nodes.'), bi('Заявку создаёт kubelet.', 'The kubelet.'), { see: 'kubectl get csr' }),
    box('kcm', bi('controller-manager: одобрить и подписать', 'controller-manager: approve and sign'), 'cp', 'hex', [380, 400, 250, 60], 'process', bi('Контроллер csrapproving одобряет заявки узлов от группы system:bootstrappers, а контроллер csrsigning подписывает их ключом центра сертификации кластера.', 'csrapproving approves node requests, csrsigning signs them with the CA key.'), bi('Оба контроллера работают в kube-controller-manager.', 'Both live in kube-controller-manager.'), { doc: D.tlsBootstrap }),
    box('klet', 'kubelet worker-1', 'node', 'rack', [24, 290, 230, 70], 'server', bi('kubelet нового узла. Он запускается с файлом bootstrap-kubelet.conf, в котором лежит токен, получает свой сертификат и переходит на kubelet.conf. Сертификат лежит в /var/lib/kubelet/pki и обновляется сам, пока не истёк.', 'Starts with the token, gets its certificate and switches to kubelet.conf; the certificate renews itself.'), bi('Ставится пакетом kubelet, запускается systemd.', 'The kubelet package, systemd.'), { see: 'sudo ls -l /var/lib/kubelet/pki' }),
    box('nodeobj', 'Node worker-1', 'obj', 'doc', [24, 400, 230, 56], 'file', bi('Объект Node, который kubelet регистрирует уже со своим собственным сертификатом.', 'The Node object, registered with the new certificate.'), bi('Регистрирует kubelet.', 'The kubelet.'), { see: 'kubectl get nodes -o wide' }),
  ],
  edges: [
    edge('e-get', 'join', 'ci', bi('читает без входа', 'reads anonymously'), bi('Первым запросом узел без всякой проверки читает cluster-info.', 'The first request: read cluster-info with no authentication.'), bi('Запрос отправляет kubeadm join.', 'kubeadm join.'), { via: [[214, 36], [420, 36]] }),
    edge('e-pin', 'ci', 'join', bi('центр и подпись', 'CA and signature'), bi('Узел сверяет хеш открытого ключа центра со значением --discovery-token-ca-cert-hash, а подпись JWS — с токеном.', 'The node checks the CA hash and the JWS signature.'), bi('Проверяет kubeadm join.', 'kubeadm join.'), { via: [[420, 64], [214, 64]], labelAt: 0.25 }),
    edge('e-tok', 'tok', 'ci', bi('подпись JWS', 'JWS signature'), bi('Токен подписывает cluster-info, и тот, кто знает токен, может убедиться, что ConfigMap не подменили.', 'The token signs cluster-info, proving it was not swapped.'), bi('Подписывает контроллер bootstrapsigner.', 'The bootstrapsigner controller.')),
    edge('e-auth', 'klet', 'api', bi('вход по токену', 'log in with the token'), bi('kubelet представляется пользователем system:bootstrap:<id> из группы system:bootstrappers.', 'The kubelet logs in as system:bootstrap:<id>.'), bi('Входит kubelet.', 'The kubelet.'), { via: [[310, 325], [310, 198]], labelAt: 0.5 }),
    edge('e-csr', 'api', 'csr', bi('новая заявка', 'new request'), bi('Единственное, что разрешает токен присоединения, — создать заявку на сертификат.', 'A bootstrap token only allows creating a CSR.'), bi('Заявку отправляет kubelet через API.', 'The kubelet, through the API.')),
    edge('e-sign', 'kcm', 'csr', bi('одобрена и подписана', 'approved and issued'), bi('Одобряют и подписывают заявку два разных контроллера, и оба работают в controller-manager.', 'Two controllers approve and sign.'), bi('kube-controller-manager', 'kube-controller-manager')),
    edge('e-cert', 'csr', 'klet', bi('сертификат', 'certificate'), bi('kubelet забирает подписанный сертификат из поля status.certificate заявки.', 'The kubelet takes it from status.certificate.'), bi('Забирает kubelet.', 'The kubelet.')),
    edge('e-reg', 'klet', 'nodeobj', bi('регистрирует узел', 'registers'), bi('С новым сертификатом kubelet создаёт объект Node и дальше только продлевает Lease.', 'With the new certificate the kubelet creates the Node.'), bi('Регистрирует kubelet.', 'The kubelet.')),
  ],
};

const ALL = idsOf(diagram);

export const tlsBootstrapModel = defineModel<P>({
  id: 'k8s.tls-bootstrap',
  frame: 'visible',
  block: 'k8s-2',
  title: bi('Как новый узел получает свой сертификат', 'How a new node gets its certificate'),
  summary: bi(
    'Новый узел не знает кластера, а кластер не знает узла, и доверие между ними строится в несколько шагов. Хеш центра сертификации защищает узел от чужого API-сервера, токен присоединения защищает кластер от чужого узла, а заявка на сертификат (CSR) даёт kubelet собственный сертификат, с которым он и работает дальше.',
    'Trust is built in steps: the CA hash protects the node, the token protects the cluster, and a CSR gives the kubelet its own certificate.',
  ),
  intro: bi(
    'Сейчас на схеме команда kubeadm join на новом узле и публичный ConfigMap cluster-info. А дальше листайте кнопкой «Шаг вперёд». Каждый шаг добавляет одно звено цепочки доверия, а карточка на линии показывает, что передаётся по линии: хеш, токен, заявка или сертификат. Потом сдвиньте в «Параметрах» время после init дальше срока токена, а в блоке «Сломать» ошибитесь в хеше или выключите автоматическое одобрение заявок.',
    'For now: kubeadm join on the new node and the public cluster-info. Go on with “Step forward”: each step adds one link of trust, and the card shows what is handed on. Then move the time past the token’s lifetime, and break the hash or the auto-approval.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:terminal', 'команда kubeadm join', 'kubeadm join'),
    mark('icon:lock', 'токен присоединения', 'the bootstrap token'),
    mark('icon:file', 'объект API', 'an API object'),
    mark('ok', 'звено проверено', 'the link is verified'),
    mark('wait', 'заявка ждёт одобрения', 'the request waits'),
    mark('err', 'здесь доверие не установилось', 'trust failed here'),
  ],
  stopLabel: bi('Присоединение остановилось', 'The join stopped'),
  concepts: ['k8s.tls-bootstrap', 'k8s.pki'],
  diagram,
  params: [
    {
      id: 'hours',
      label: bi('Сколько часов прошло после init', 'Hours since init'),
      kind: 'range',
      min: 0,
      max: 48,
      step: 6,
      default: 1,
      near: 'tok',
      group: bi('Токен присоединения', 'The bootstrap token'),
      predict: { prompt: bi('Вы присоединяете узел той же командой join через выбранное число часов после init. Что будет?', 'You join with the same command after the chosen hours. What happens?'), options: [{ id: 'expired', text: bi('Токен истёк, и join откажет', 'The token has expired: join fails') }, { id: 'ok', text: bi('Узел присоединится', 'The node joins') }], resolve: (_p, n) => (n.some((s) => s.broken) ? 'expired' : 'ok') },
    },
    { id: 'ttl', label: bi('Сколько часов действует токен (ноль означает, что срока нет)', 'Token lifetime, hours (0: forever)'), kind: 'range', min: 0, max: 48, step: 12, default: 24, near: 'tok', levels: ['intermediate', 'experienced'], group: bi('Токен присоединения', 'The bootstrap token') },
    {
      id: 'pin',
      label: bi('Как узел проверяет центр сертификации кластера', 'How the node checks the cluster CA'),
      kind: 'choice',
      default: 'hash',
      near: 'ci',
      levels: ['intermediate', 'experienced'],
      group: bi('Проверка кластера', 'Checking the cluster'),
      options: [
        { id: 'hash', label: bi('сверяет хеш (--discovery-token-ca-cert-hash)', 'checks the hash') },
        { id: 'skip', label: bi('не проверяет (--discovery-token-unsafe-skip-ca-verification)', 'skips the check') },
      ],
      predict: { prompt: bi('Без проверки хеша join тоже проходит. Чем это опасно?', 'Without the hash join passes too. What is the danger?'), options: [{ id: 'mitm', text: bi('Узел поверит любому серверу, который подсунет свой центр сертификации', 'The node trusts any server with its own CA') }, { id: 'none', text: bi('Ничем, потому что токен всё равно секретный', 'None: the token is secret') }], resolve: () => 'mitm' },
    },
  ],
  breaks: [
    {
      id: 'hash',
      label: bi('В хеше центра сертификации опечатка', 'A typo in the CA hash'),
      remove: ['e-pin'],
      boundary: 'identity',
      predict: { prompt: bi('Хеш в команде join не совпадает с ключом центра сертификации кластера. Что скажет join?', 'The hash does not match. What does join say?'), options: [{ id: 'pinned', text: bi('Что ключ центра не закреплён', 'That the CA key is not pinned') }, { id: 'token', text: bi('Что токен неверный', 'That the token is wrong') }], resolve: () => 'pinned' },
    },
    {
      id: 'approver',
      label: bi('Автоматическое одобрение заявок на сертификат выключено', 'CSR auto-approval is off'),
      remove: ['e-sign'],
      boundary: 'identity',
      predict: { prompt: bi('Заявку на сертификат никто не одобряет. Где застрянет узел?', 'Nobody approves the request. Where does the node get stuck?'), options: [{ id: 'pending', text: bi('Заявка останется в Pending, а узла в списке не будет', 'The CSR is Pending, no node listed') }, { id: 'notready', text: bi('Узел появится в списке, но NotReady', 'The node is listed NotReady') }], resolve: () => 'pending' },
    },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    s.push({
      id: 'discover',
      label: bi('поиск', 'discovery'),
      caption: bi('join обращается на 10.10.1.11:6443 без всякой проверки и читает публичный cluster-info. В нём адрес API-сервера и сертификат центра сертификации кластера.', 'join reads the public cluster-info: the API address and the CA.'),
      focus: ['join', 'e-get'],
      tokens: [{ edge: 'e-get', label: 'GET cluster-info' }],
      say: { join: bi('join читает публичный cluster-info, ещё ничему не доверяя.', 'join reads cluster-info, trusting nothing yet.') },
      states: only(ALL, 'join', 'ci', 'e-get'),
    });
    if (broken.has('hash')) {
      s.push({
        id: 'pinfail',
        label: bi('хеш', 'hash'),
        caption: bi('Хеш ключа центра сертификации не совпал с тем, что вы передали, и узел отказывается верить этому серверу. Так и задумано, потому что иначе узел можно было бы подключить к чужому кластеру.', 'The hash does not match: the node refuses to trust the server. That is the design.'),
        focus: ['join', 'e-pin'],
        reveal: ['e-pin'],
        say: { join: bi('join сравнивает хеш ключа центра и видит, что он другой.', 'join compares the hash and sees a different one.') },
        states: { join: 'err' },
        broken: { at: 'join', message: 'error execution phase preflight: couldn\'t validate the identity of the API Server: cluster CA found in cluster-info ConfigMap is invalid: none of the public keys "sha256:9f1c…" are pinned', caption: bi('на проверке кластера. Скопируйте хеш заново. На cp-1 его печатает команда `openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | openssl rsa -pubin -outform der | sha256sum`.', 'at the cluster check: copy the hash again with the openssl pipeline on cp-1.') },
      });
      return s;
    }
    if (!tokenValid(p.hours, p.ttl)) {
      s.push({
        id: 'expired',
        label: bi('токен', 'token'),
        caption: fmt(bi('С init прошло {h} ч, а токен жил {t} ч. Его Secret удалён, и подписи этим токеном в cluster-info больше нет, поэтому join не может проверить, что ConfigMap настоящий.', '{h} h passed, the token lived {t} h: its signature is gone.'), { h: p.hours, t: p.ttl }),
        focus: ['tok', 'e-tok'],
        reveal: ['tok', 'e-tok'],
        say: { tok: fmt(bi('Токен истёк через {t} ч, и его подписи больше нет.', 'The token expired after {t} h.'), { t: p.ttl }) },
        states: { tok: 'err' },
        broken: { at: 'tok', message: 'error execution phase preflight: couldn\'t validate the identity of the API Server: could not find a JWS signature in the cluster-info ConfigMap for token ID "abcdef"', caption: bi('на токене. Новую команду join печатает `kubeadm token create --print-join-command` на cp-1.', 'at the token: `kubeadm token create --print-join-command` prints a new command.') },
      });
      return s;
    }
    s.push({
      id: 'pin',
      label: bi('проверка', 'verify'),
      caption: p.pin === 'hash'
        ? bi('Узел сверяет хеш открытого ключа центра с тем, что вы передали, и проверяет подпись токеном. Теперь узел знает, что это его кластер.', 'The node checks the CA hash and the token signature: it is its cluster.')
        : bi('Проверка центра сертификации пропущена, и узел верит первому ответившему серверу. В учебной сети так можно, а в настоящей нельзя.', 'The CA check is skipped: the node trusts whoever answers first.'),
      focus: ['join', 'e-pin'],
      reveal: ['tok', 'e-tok', 'e-pin'],
      tokens: [{ edge: 'e-pin', label: p.pin === 'hash' ? 'sha256 ✓' : bi('без проверки', 'skip') }],
      say: { join: p.pin === 'hash' ? bi('join сверяет хеш ключа центра, и хеш совпадает.', 'join checks the hash: it matches.') : bi('join ничего не проверяет и верит серверу на слово.', 'join checks nothing.') },
      states: { join: p.pin === 'hash' ? 'ok' : 'warn' },
    });
    s.push({
      id: 'bootstrap',
      label: bi('вход', 'login'),
      caption: bi('join записывает файл bootstrap-kubelet.conf с токеном и запускает kubelet. kubelet входит в кластер пользователем system:bootstrap:abcdef, а этому пользователю разрешено только создать заявку на сертификат.', 'The kubelet logs in as system:bootstrap:abcdef, which may only create a CSR.'),
      focus: ['klet', 'e-auth'],
      reveal: ['klet', 'api', 'e-auth'],
      tokens: [{ edge: 'e-auth', label: 'Bearer abcdef.…' }],
      say: { klet: bi('kubelet входит в кластер с токеном присоединения.', 'The kubelet logs in with the bootstrap token.') },
      states: { klet: 'on' },
    });
    s.push({
      id: 'csr',
      label: 'CSR',
      caption: bi('kubelet сам создаёт закрытый ключ и отправляет заявку: «подпишите сертификат на имя system:node:worker-1 в группе system:nodes». API-сервер сохраняет заявку, а закрытый ключ так и не покидает узел.', 'The kubelet makes its own key and requests system:node:worker-1; the key never leaves the node.'),
      focus: ['api', 'e-csr'],
      reveal: ['csr', 'e-csr'],
      tokens: [{ edge: 'e-csr', label: 'CN=system:node:worker-1' }],
      say: { api: bi('API-сервер сохраняет заявку kubelet на сертификат.', 'The API server stores the request.') },
      states: { csr: 'wait' },
      values: { csr: 'Pending' },
    });
    if (broken.has('approver')) {
      s.push({
        id: 'pending',
        label: 'Pending',
        caption: bi('Заявка лежит в состоянии Pending, потому что одобрить её некому. kubelet ждёт, а объекта Node так и нет.', 'The request stays Pending; nobody approves it; no Node.'),
        focus: ['csr'],
        reveal: ['kcm'],
        say: { csr: bi('Заявка ждёт одобрения, а одобрить её некому.', 'The request waits for approval.') },
        states: { csr: 'warn', kcm: 'off' },
        broken: { at: 'csr', message: '$ kubectl get csr\nNAME        AGE   SIGNERNAME                                    REQUESTOR                 CONDITION\ncsr-8xk2p   3m    kubernetes.io/kube-apiserver-client-kubelet   system:bootstrap:abcdef   Pending', caption: bi('на одобрении заявки. Вручную её одобряет команда `kubectl certificate approve csr-8xk2p`, но сначала убедитесь, что узел ваш.', 'at approval: `kubectl certificate approve csr-8xk2p`, after making sure the node is yours.') },
      });
      return s;
    }
    s.push({
      id: 'sign',
      label: bi('подпись', 'sign'),
      caption: bi('Контроллер csrapproving одобряет заявку, потому что её прислал участник группы system:bootstrappers, а контроллер csrsigning подписывает её ключом центра сертификации. Состояние заявки теперь Approved,Issued.', 'csrapproving approves, csrsigning signs: Approved,Issued.'),
      focus: ['kcm', 'e-sign'],
      reveal: ['kcm', 'e-sign'],
      tokens: [{ edge: 'e-sign', label: 'Approved,Issued' }],
      say: { kcm: bi('controller-manager одобряет заявку и подписывает сертификат ключом центра.', 'The controller-manager approves and signs.') },
      states: { csr: 'ok', kcm: 'ok' },
      values: { csr: 'Approved,Issued' },
    });
    s.push({
      id: 'cert',
      label: bi('сертификат', 'certificate'),
      caption: bi('kubelet забирает сертификат в файл /var/lib/kubelet/pki/kubelet-client-current.pem и переходит на kubelet.conf. Токен присоединения ему больше не нужен.', 'The kubelet takes the certificate and switches to kubelet.conf; the token is no longer needed.'),
      focus: ['klet', 'e-cert'],
      reveal: ['e-cert'],
      tokens: [{ edge: 'e-cert', label: 'kubelet-client.pem' }],
      say: { klet: bi('kubelet забирает свой сертификат и переходит на kubelet.conf.', 'The kubelet takes its certificate.') },
      states: { klet: 'ok' },
    });
    s.push({
      id: 'register',
      label: 'Node',
      caption: bi('kubelet регистрирует объект Node worker-1 уже от своего имени, system:node:worker-1. Готовым (Ready) узел станет, когда на нём заработает сетевой плагин.', 'The kubelet registers Node worker-1; it becomes Ready once the CNI runs.'),
      focus: ['klet', 'e-reg'],
      reveal: ['nodeobj', 'e-reg'],
      tokens: [{ edge: 'e-reg', label: 'Node worker-1' }],
      say: { klet: bi('kubelet регистрирует узел worker-1 в кластере.', 'The kubelet registers worker-1.') },
      states: { nodeobj: 'ok' },
    });
    return s;
  },
  explainDelta(_prev, _next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Из цепочки доверия выпало одно звено. Посмотрите, кто это замечает и каким сообщением.', 'One link of trust is gone: see who notices and how.') : bi('Цепочка доверия снова цела.', 'The chain of trust is whole again.');
    if (change.id === 'pin') return b.pin === 'skip' ? bi('Без хеша узел не может отличить свой кластер от подставного.', 'Without the hash the node cannot tell a fake cluster.') : bi('Хеш закрепляет центр сертификации, и незаметно подменить сервер нельзя.', 'The hash pins the CA.');
    return tokenValid(Number(b.hours), Number(b.ttl)) ? bi('Токен ещё действует, и join пройдёт.', 'The token is still valid.') : bi('Токен истёк, и нужен новый: kubeadm token create.', 'The token has expired: kubeadm token create.');
  },
});
