// Who works with the cluster and with which rights: authentication (a
// certificate, a ServiceAccount token, an OIDC token), RBAC (Role and
// RoleBinding), `kubectl auth can-i`, and logging in with the company
// account through Dex or Keycloak. Theory and checks only: the training
// cluster in the browser lets everyone do everything.

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import { S, src } from '../sources';

// Every spelling of the namespace and impersonation flags, in either order.
const CAN_I = ['pods', 'pod'].flatMap((r) =>
  ['-n shop', '-n=shop', '--namespace shop', '--namespace=shop'].flatMap((n) =>
    ['--as anna@example.com', '--as=anna@example.com'].flatMap((a) => [`kubectl auth can-i delete ${r} ${n} ${a}`, `kubectl auth can-i delete ${r} ${a} ${n}`]),
  ),
);

export const accessQuiz: QuizItem[] = [
  {
    id: 'k8s.q.acc.forbidden',
    kind: 'mcq',
    concepts: ['k8s.rbac'],
    prompt: bi(
      'Разработчица выполняет `kubectl -n shop delete pod web-7c9d` и получает «Error from server (Forbidden): pods "web-7c9d" is forbidden: User "anna@example.com" cannot delete resource "pods" in API group "" in the namespace "shop"». Что это означает?',
      'A developer runs `kubectl -n shop delete pod web-7c9d` and gets "Error from server (Forbidden): pods "web-7c9d" is forbidden: User "anna@example.com" cannot delete resource "pods" in API group "" in the namespace "shop"". What does it mean?',
    ),
    options: [
      { id: 'authz', text: bi('Кластер узнал её, но ни одна роль не разрешает ей удалять поды в namespace shop', 'The cluster recognised her, but no role allows her to delete pods in namespace shop'), correct: true },
      { id: 'authn', text: bi('Кластер не узнал её, потому что токен истёк', 'The cluster did not recognise her because the token expired'), why: bi('Если бы кластер её не узнал, ответ был бы 401 Unauthorized, и имени в нём не было бы. Здесь имя названо, значит, проверка «кто вы» пройдена, а отказала проверка «что вам можно».', 'Had the cluster not recognised her, the answer would be 401 Unauthorized without a name. Here the name is given, so “who are you” passed, and “what may you do” refused.') },
      { id: 'pod', text: bi('Пода с таким именем нет', 'There is no pod with this name'), why: bi('Тогда сервер ответил бы NotFound. До поиска пода дело не дошло, потому что права проверяются раньше.', 'Then the server would answer NotFound. The search for the pod never started: rights are checked first.') },
    ],
  },
  {
    id: 'k8s.q.acc.binding',
    kind: 'mcq',
    concepts: ['k8s.rbac'],
    prompt: bi(
      'Нужно, чтобы группа `shop-devs` из каталога сотрудников могла смотреть и перезапускать поды только в namespace `shop`, а в остальных namespace не могла ничего. Что создать?',
      'The group `shop-devs` from the staff directory must be able to view and restart pods only in namespace `shop`, and do nothing in other namespaces. What do you create?',
    ),
    options: [
      { id: 'rb', text: bi('Role в namespace shop с нужными действиями над подами и RoleBinding в том же namespace, которая выдаёт эту роль группе shop-devs', 'A Role in namespace shop with the needed verbs on pods and a RoleBinding in the same namespace that grants it to group shop-devs'), correct: true },
      { id: 'crb', text: bi('ClusterRole и ClusterRoleBinding для группы shop-devs', 'A ClusterRole and a ClusterRoleBinding for group shop-devs'), why: bi('ClusterRoleBinding выдаёт роль во всех namespace сразу, и группа получит доступ к подам всего кластера. Готовую ClusterRole можно выдать и в одном namespace, но только через RoleBinding.', 'A ClusterRoleBinding grants the role in every namespace at once, and the group would get the pods of the whole cluster. A ready ClusterRole can be granted in one namespace too, but only through a RoleBinding.') },
      { id: 'user', text: bi('Объект User для каждого разработчика и RoleBinding на каждого', 'A User object for every developer and a RoleBinding for each'), why: bi('Объектов User в Kubernetes нет: люди приходят снаружи, с сертификатом или токеном, и кластер узнаёт их только по имени и группам из этого токена. Поэтому права выдают группе, а состав группы ведут в каталоге сотрудников.', 'Kubernetes has no User objects: people come from outside with a certificate or a token, and the cluster knows them only by the name and groups in it. That is why rights go to a group, and its members are kept in the staff directory.') },
    ],
  },
  {
    id: 'k8s.q.acc.canI',
    kind: 'fill-command',
    concepts: ['k8s.rbac'],
    prompt: bi('Проверьте, не выполняя действия, сможет ли пользователь `anna@example.com` удалять поды в namespace `shop`.', 'Check, without doing it, whether user `anna@example.com` may delete pods in namespace `shop`.'),
    template: 'kubectl auth can-i ___',
    answers: CAN_I,
    misconceptions: [{ match: '--user', why: bi('Флаг --user выбирает пользователя из вашего kubeconfig, а проверить права другого человека позволяет флаг --as, если вам самим разрешено действовать от чужого имени.', '--user picks a user from your kubeconfig; to check someone else’s rights use --as, if you yourself are allowed to impersonate.') }],
  },
  {
    id: 'k8s.q.acc.fired',
    kind: 'mcq',
    concepts: ['k8s.oidc'],
    prompt: bi(
      'Инженер уволился, и его учётную запись отключили в каталоге сотрудников. В кластере вход сделан через OIDC и Keycloak, а права выданы группе `platform`. Что ещё нужно сделать в кластере, чтобы он потерял доступ?',
      'An engineer left, and his account was disabled in the staff directory. The cluster login goes through OIDC and Keycloak, and rights are granted to group `platform`. What else has to be done in the cluster for him to lose access?',
    ),
    options: [
      { id: 'nothing', text: bi('Ничего: новый токен он уже не получит, а выданный перестанет действовать, когда истечёт его короткий срок', 'Nothing: he cannot get a new token, and the issued one stops working when its short lifetime runs out'), correct: true },
      { id: 'rb', text: bi('Удалить его RoleBinding', 'Delete his RoleBinding'), why: bi('Личной RoleBinding у него нет, потому что права выданы группе. Как только его нет в группе и учётная запись отключена, Keycloak не выпустит ему токен.', 'He has no RoleBinding of his own, because the rights go to the group. Once he is out of the group and the account is disabled, Keycloak will not issue him a token.') },
      { id: 'certs', text: bi('Перевыпустить все сертификаты кластера', 'Reissue all the cluster certificates'), why: bi('Так пришлось бы делать, если бы он входил по личному сертификату или с admin.conf: отозвать сертификат в Kubernetes нельзя. Вход через OIDC как раз избавляет от этого.', 'That would be needed had he logged in with a personal certificate or admin.conf: a certificate cannot be revoked in Kubernetes. Logging in through OIDC is exactly what spares you this.') },
    ],
  },
];

export const accessLesson: Lesson = {
  id: 'k8s-1.access',
  block: 'k8s-1',
  title: bi('Кто и с какими правами работает с кластером', 'Who works with the cluster, and with which rights'),
  summary: bi(
    'Как API-сервер узнаёт, кто к нему пришёл, как роли RBAC ограничивают, что этому человеку или программе можно, зачем программам сервисные аккаунты и как сделать вход по учётной записи компании, чтобы уволенный сотрудник терял доступ без единой правки в самом кластере.',
    'How the API server learns who came to it, how RBAC roles limit what that person or program may do, why programs get service accounts, and how to log in with the company account so that a person who leaves loses access without a single change in the cluster itself.',
  ),
  introduces: ['k8s.rbac', 'k8s.serviceaccount', 'k8s.oidc'],
  uses: ['k8s.apiserver', 'k8s.kubeconfig', 'k8s.namespace', 'k8s.secret', 'k8s.pod', 'k8s.api-object'],
  tier: 'core',
  minutes: 25,
  sources: src([S.rbac, S.authn, S.serviceAccounts, S.dex, S.kubelogin], [S.rbac, S.authn]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В учебном кластере вам можно всё, и в маленькой команде так часто работают и с рабочим кластером: у каждого файл admin.conf с правами администратора. Потом стажёр по ошибке удаляет namespace соседней команды, а уволившийся подрядчик ещё полгода может зайти в кластер с копией этого файла. На собеседовании обычно спрашивают, как дать разработчику доступ только к его namespace и что сделать, чтобы бывший сотрудник не мог зайти в кластер. Урок отвечает на оба вопроса.',
        'In the training cluster you may do everything, and small teams often work that way in production too: everyone has an admin.conf with administrator rights. Then an intern deletes a neighbouring team’s namespace by mistake, and a contractor who left can still log in for half a year with a copy of that file. Interviews usually ask how to give a developer access to their namespace only, and what to do so that a former employee cannot get into the cluster. The lesson answers both.',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Две проверки на каждый запрос', 'Two checks for every request'),
      body: bi(
        'Вы уже знаете, что API-сервер — единственный вход в кластер. Каждый запрос он проверяет дважды, прежде чем выполнить. Сначала он выясняет, кто пришёл. Человек представляется сертификатом из kubeconfig, как вы с admin.conf, или токеном от сервера входа компании. Программа внутри кластера представляется токеном [[k8s.serviceaccount|сервисного аккаунта]], объекта ServiceAccount в своём namespace: kubelet кладёт поду такой короткий токен, и под с ним обращается к API. Людей в API нет: объекта User не существует, и кластер знает человека только по имени и списку групп, которые записаны в его сертификате или токене. Если представиться не удалось, сервер отвечает 401 Unauthorized.\n\nПотом API-сервер выясняет, что этому человеку или программе можно. Отвечает на это [[k8s.rbac|RBAC]], права по ролям. Объект Role в namespace перечисляет разрешённые действия: какие глаголы (`get`, `list`, `watch`, `create`, `update`, `patch`, `delete`) с какими видами объектов. Объект RoleBinding в том же namespace выдаёт эту роль пользователю, группе или сервисному аккаунту. ClusterRole и ClusterRoleBinding делают то же для всего кластера сразу. Права только добавляются: запрета в RBAC нет, и всё, что не разрешено ни одной ролью, запрещено. Если ни одна роль не разрешает действие, сервер отвечает 403 Forbidden и называет в ответе, кто и что пытался сделать.\n\n```yaml\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: pod-operator\n  namespace: shop\nrules:\n- apiGroups: [\"\"]\n  resources: [pods, pods/log]\n  verbs: [get, list, watch, delete]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: shop-devs-pods\n  namespace: shop\nsubjects:\n- kind: Group\n  name: shop-devs\n  apiGroup: rbac.authorization.k8s.io\nroleRef:\n  kind: Role\n  name: pod-operator\n  apiGroup: rbac.authorization.k8s.io\n```\n\nПроверить права, не рискуя, можно командой `kubectl auth can-i`: `kubectl auth can-i delete pods -n shop` отвечает yes или no за вас, а с флагом `--as anna@example.com` за другого человека, если вам разрешено действовать от его имени. Команда `kubectl auth can-i --list -n shop` перечисляет всё, что вам можно в этом namespace. Учебный кластер в браузере права не проверяет и пускает всех, поэтому эти команды вы выполните на настоящем кластере на этапе 2.',
        'You already know that the API server is the only door of the cluster. It checks every request twice before doing it. First it finds out who came. A person presents a certificate from a kubeconfig, as you do with admin.conf, or a token from the company login server. A program inside the cluster presents the token of a [[k8s.serviceaccount|service account]], a ServiceAccount object in its namespace: the kubelet gives the pod such a short-lived token, and the pod calls the API with it. There are no people in the API at all: no User object exists, and the cluster knows a person only by the name and list of groups written in their certificate or token. If presenting fails, the answer is 401 Unauthorized.\n\nThen the API server finds out what this person or program may do. [[k8s.rbac|RBAC]], role-based access, answers that. A Role object in a namespace lists allowed actions: which verbs (`get`, `list`, `watch`, `create`, `update`, `patch`, `delete`) on which kinds of object. A RoleBinding object in the same namespace grants that role to a user, a group or a service account. A ClusterRole and a ClusterRoleBinding do the same for the whole cluster at once. Rights only add up: RBAC has no deny, and whatever no role allows is forbidden. If no role allows the action, the answer is 403 Forbidden, naming who tried to do what.\n\n```yaml\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: pod-operator\n  namespace: shop\nrules:\n- apiGroups: [\"\"]\n  resources: [pods, pods/log]\n  verbs: [get, list, watch, delete]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: shop-devs-pods\n  namespace: shop\nsubjects:\n- kind: Group\n  name: shop-devs\n  apiGroup: rbac.authorization.k8s.io\nroleRef:\n  kind: Role\n  name: pod-operator\n  apiGroup: rbac.authorization.k8s.io\n```\n\nYou can check rights without risk with `kubectl auth can-i`: `kubectl auth can-i delete pods -n shop` answers yes or no for you, and with `--as anna@example.com` for another person, if you are allowed to act in their name. `kubectl auth can-i --list -n shop` lists everything you may do in that namespace. The browser training cluster does not check rights and lets everyone in, so you will run these commands on a real cluster in stage 2.',
      ),
    },
    {
      id: 'company-login',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Вход по учётной записи компании', 'Logging in with the company account'),
      body: bi(
        'Личный сертификат в kubeconfig нельзя отозвать: Kubernetes не ведёт списка отозванных сертификатов, и файл действует, пока не истечёт его срок, обычно год. Поэтому в компаниях людей пускают в кластер [[k8s.oidc|через OIDC]], тот же способ входа, что кнопка «Войти через Google» на сайтах. Сервер входа, обычно Dex или Keycloak, проверяет человека по каталогу сотрудников компании, например Active Directory или LDAP, и знает, в каких группах он состоит. В kubeconfig разработчика нет ни ключа, ни пароля. Когда он выполняет kubectl, тот открывает браузер, человек входит под своей рабочей учётной записью, и kubectl получает короткий токен, где записаны его имя и группы. Срок такого токена задаёт сервер входа, и в компаниях его ставят в минутах. Права в кластере выдают группам из каталога, например RoleBinding для группы `shop-devs`.\n\nИз такого устройства входа следует главное. Когда сотрудник увольняется, его отключают в каталоге, и в течение нескольких минут он лишается доступа к кластеру: войти заново и получить новый токен он не сможет, а уже выданный перестанет действовать, когда истечёт его короткий срок. Ни одного файла в кластере при этом менять не нужно. Новичок в команде получает доступ так же, когда его добавляют в группу в каталоге.',
        'A personal certificate in a kubeconfig cannot be revoked: Kubernetes keeps no list of revoked certificates, and the file works until it expires, usually after a year. That is why companies let people into the cluster [[k8s.oidc|through OIDC]], the same way of logging in as the “Sign in with Google” button on websites. A login server, usually Dex or Keycloak, checks the person against the company staff directory, such as Active Directory or LDAP, and knows which groups they belong to. The developer’s kubeconfig holds neither a key nor a password. When they run kubectl, it opens a browser, the person logs in with their work account, and kubectl gets a short token with their name and groups. The login server sets the token’s lifetime, and companies set it in minutes. Rights in the cluster go to groups from the directory, for example a RoleBinding for group `shop-devs`.\n\nThe main consequence follows. When an employee leaves, they are disabled in the directory and lose access to the cluster within minutes: they cannot log in again and get a new token, and the one already issued stops working within minutes. Not a single file in the cluster has to change. A newcomer gets access the same way: they are added to a group in the directory.',
      ),
    },
    {
      id: 'token-path',
      kind: 'text',
      step: 'explain',
      levels: ['experienced'],
      title: bi('Как токен проходит от сервера входа до RBAC', 'How the token travels from the login server to RBAC'),
      body: bi(
        'В kubeconfig вместо ключа записан плагин учётных данных, чаще всего kubelogin: в поле `users[].user.exec` стоит команда `kubectl oidc-login get-token` с адресом сервера входа и идентификатором клиента. Плагин открывает браузер и проходит обычный поток OAuth 2.0 с кодом авторизации и PKCE. Dex или Keycloak проверяет человека по LDAP или Active Directory и возвращает ID-токен, то есть JWT, подписанный ключом сервера входа, с полями `iss` (кто выпустил), `aud` (для какого клиента), `exp` (до какого момента действует), `email` и `groups`, и вместе с ним refresh-токен. Плагин кэширует токены и обновляет ID-токен, пока refresh-токен действует.\n\nkubectl отправляет ID-токен в заголовке `Authorization: Bearer`. API-сервер на каждый запрос к серверу входа не ходит: он берёт открытые ключи сервера входа по адресу из `<issuer>/.well-known/openid-configuration`, время от времени обновляет их и сам проверяет подпись, `iss`, `aud` и `exp`. Как превращать поля токена в имя и группы, задают флаги `--oidc-issuer-url`, `--oidc-client-id`, `--oidc-username-claim` и `--oidc-groups-claim` или файл AuthenticationConfiguration, где можно описать несколько серверов входа и правила на выражениях CEL. Имя получает префикс, например `oidc:anna@example.com`, чтобы его нельзя было спутать с сервисными аккаунтами, и дальше запрос идёт в RBAC как любой другой.\n\nИз этого пути следуют два вывода для работы. Отозвать уже выданный ID-токен API-сервер не может, поэтому срок ID-токена держат коротким, от 5 до 15 минут, хотя у Dex по умолчанию он равен суткам, а отключение в каталоге закрывает получение новых токенов. И должен остаться аварийный вход на случай, когда сервер входа сам лежит: один admin.conf в сейфе, которым не пользуются каждый день.',
        'Instead of a key, the kubeconfig holds a credential plugin, most often kubelogin: `users[].user.exec` runs `kubectl oidc-login get-token` with the login server address and the client id. The plugin opens a browser and goes through the ordinary OAuth 2.0 authorization code flow with PKCE. Dex or Keycloak checks the person against LDAP or Active Directory and returns an ID token, that is, a JWT signed by the login server’s key, with the fields `iss` (who issued it), `aud` (for which client), `exp` (until when it is valid), `email` and `groups`, together with a refresh token. The plugin caches the tokens and refreshes the ID token while the refresh token is valid.\n\nkubectl sends the ID token in the `Authorization: Bearer` header. The API server does not call the login server for every request: it takes the login server’s public keys from the address in `<issuer>/.well-known/openid-configuration`, refreshes them from time to time and checks the signature, `iss`, `aud` and `exp` itself. How token fields become a name and groups is set by the flags `--oidc-issuer-url`, `--oidc-client-id`, `--oidc-username-claim` and `--oidc-groups-claim`, or by an AuthenticationConfiguration file, which can describe several login servers and rules written as CEL expressions. The name gets a prefix, for example `oidc:anna@example.com`, so it cannot be confused with service accounts, and from there the request goes to RBAC like any other.\n\nTwo conclusions for work follow from this path. The API server cannot revoke an ID token already issued, so its lifetime is kept short, within 5–15 minutes, although Dex defaults to a day, while disabling the account in the directory stops new tokens. And an emergency way in must remain for when the login server itself is down: one admin.conf in a safe that nobody uses day to day.',
      ),
    },
    {
      id: 'sa',
      kind: 'text',
      step: 'review',
      title: bi('Права для программ', 'Rights for programs'),
      body: bi(
        'Программам права выдают так же, как людям, только получатель — сервисный аккаунт. Конвейер выкладки получает ServiceAccount `deployer` в namespace своего приложения и роль, которая разрешает менять только Deployment и Service в этом namespace, и никаких прав администратора. Оператор из урока об операторах получает ClusterRole на свои объекты Website и на Deployment, которые он создаёт. Поду, которому API не нужен, токен лучше не давать: для этого в спецификации пода ставят `automountServiceAccountToken: false`. Перед выдачей роли проверьте её той же командой: `kubectl auth can-i --list --as system:serviceaccount:shop:deployer -n shop`.',
        'Programs get rights the same way as people, only the subject is a service account. A deploy pipeline gets ServiceAccount `deployer` in its application’s namespace and a role that allows changing only Deployments and Services in that namespace, with no administrator rights. The operator from the operators lesson gets a ClusterRole on its Website objects and on the Deployments it creates. A pod that does not need the API at all is better left without a token: the pod spec sets `automountServiceAccountToken: false` for that. Before granting a role, check it with the same command: `kubectl auth can-i --list --as system:serviceaccount:shop:deployer -n shop`.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: accessQuiz.map((q) => q.id) },
  ],
};
