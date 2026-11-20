// Who works with the cluster and with which rights: authentication (a
// certificate, a ServiceAccount token, an OIDC token), RBAC (Role and
// RoleBinding, ClusterRole and ClusterRoleBinding), `kubectl auth can-i`,
// least privilege for a deploy pipeline, a pod that calls the API with its
// token, and logging in with the company account through Dex or Keycloak.
// The training cluster checks rights like a real API server: the kubeconfig
// has the contexts developer and deployer besides the administrator.

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import { bindingsFor, decisions, deploymentOf, deploymentsInCoreGroup, may, objOf, podOf, sa } from '../rbac-facts';
import { ACCESS_LAB, CI_LAB, RBAC_BROKEN } from '../setups';
import { S, src } from '../sources';

// Every spelling of the namespace and impersonation flags, in either order.
const CAN_I = ['pods', 'pod'].flatMap((r) =>
  ['-n shop', '-n=shop', '--namespace shop', '--namespace=shop'].flatMap((n) =>
    ['--as anna@example.com', '--as=anna@example.com'].flatMap((a) => [`kubectl auth can-i delete ${r} ${n} ${a}`, `kubectl auth can-i delete ${r} ${a} ${n}`]),
  ),
);

const DEV = 'developer';
const CI = sa('prod', 'ci-deployer');
const STATUS = sa('prod', 'status-reader');
const WATCHER = sa('monitoring', 'pod-watcher');
const lastLine = (f: Facts) => ((f.term as { main?: { line: string }[] } | undefined)?.main ?? []).at(-1)?.line ?? '';
const decided = (f: Facts | undefined, user: string, verb: string, resource: string, allowed: boolean, ns?: string) =>
  decisions(f, user).some((d) => d.verb === verb && d.resource === resource && d.allowed === allowed && (ns === undefined || d.namespace === ns));

/** The developer reads pods and their logs in prod, and nothing else anywhere. */
const devReadsProd = (f: Facts) =>
  may(f, DEV, 'get', 'pods', 'prod') && may(f, DEV, 'list', 'pods', 'prod') && may(f, DEV, 'get', 'pods/log', 'prod') && !may(f, DEV, 'delete', 'pods', 'prod') && !may(f, DEV, 'create', 'pods', 'prod') && !may(f, DEV, 'get', 'secrets', 'prod') && !may(f, DEV, 'list', 'pods', 'dev');

/** The pipeline account changes the Deployment in prod and can do nothing it does not need. */
const ciLeast = (f: Facts) =>
  may(f, CI, 'get', 'deployments', 'prod') && may(f, CI, 'patch', 'deployments', 'prod') && !may(f, CI, 'delete', 'deployments', 'prod') && !may(f, CI, 'create', 'deployments', 'prod') && !may(f, CI, 'get', 'secrets', 'prod') && !may(f, CI, 'delete', 'pods', 'prod') && !may(f, CI, 'patch', 'deployments', 'dev');

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
    id: 'k8s.q.acc.parts',
    kind: 'match',
    concepts: ['k8s.rbac'],
    prompt: bi(
      'Сопоставьте часть сообщения «Error from server (Forbidden): pods is forbidden: User "developer" cannot list resource "pods" in API group "" in the namespace "prod"» с тем, что она сообщает.',
      'Match each part of the message "Error from server (Forbidden): pods is forbidden: User "developer" cannot list resource "pods" in API group "" in the namespace "prod"" with what it tells you.',
    ),
    pairs: [
      { id: 'who', left: 'User "developer"', right: bi('Имя пользователя, которого API-сервер узнал, а значит, первая проверка пройдена', 'who came: the API server recognised the user, so the first check passed') },
      { id: 'verb', left: 'cannot list', right: bi('Запрещённое действие, глагол list, в который превращается `kubectl get pods` без имени пода', 'which action is refused: `kubectl get pods` without a pod name becomes the verb list'), why: bi('С именем пода, как в `kubectl get pod web-0`, глагол был бы get, а с флагом `-w` ещё и watch. В правиле Role это поле verbs.', 'With a pod name, as in `kubectl get pod web-0`, the verb would be get, and with `-w` also watch. In a Role rule this is the verbs field.') },
      { id: 'res', left: 'resource "pods"', right: bi('Вид объектов во множественном числе, как его пишут в поле resources роли', 'on which objects: the kind in the plural, as written in the resources field of a role') },
      { id: 'group', left: 'in API group ""', right: bi('Группа API, где пустая строка означает основную группу подов, сервисов и Secret', 'in which API group: the empty string is the core group, home of pods, Services and Secrets'), why: bi('Deployment и StatefulSet лежат в группе apps, и для них в правиле пишут `apiGroups: ["apps"]`.', 'Deployments and StatefulSets are in the group apps, and a rule for them says `apiGroups: ["apps"]`.') },
      { id: 'ns', left: 'in the namespace "prod"', right: bi('Namespace, в котором проверялось право и где роль должна быть выдана привязкой RoleBinding', 'where the right was checked: the role must be granted by a RoleBinding in this namespace') },
    ],
    explain: bi(
      'Каждая часть сообщения соответствует полю правила RBAC. Поэтому по одному сообщению об отказе можно написать роль, которая это действие разрешит: глагол пойдёт в verbs, вид объектов в resources, группа в apiGroups, а namespace подскажет, где создать RoleBinding.',
      'Every part of the message matches a field of an RBAC rule. So from one refusal you can write the role that allows the action: the verb goes into verbs, the kind into resources, the group into apiGroups, and the namespace tells you where to create the RoleBinding.',
    ),
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
    id: 'k8s.q.acc.crb',
    kind: 'mcq',
    concepts: ['k8s.rbac'],
    prompt: bi(
      'В кластере есть ClusterRole `view`, которая разрешает читать почти всё. Администратор создал в namespace `dev` объект RoleBinding, который выдаёт роль `view` пользователю `anna`. Что сможет прочитать anna?',
      'The cluster has ClusterRole `view`, which allows reading almost everything. An administrator created in namespace `dev` a RoleBinding that grants role `view` to user `anna`. What can anna read?',
    ),
    options: [
      { id: 'dev', text: bi('Объекты только в namespace dev, хотя роль описана для всего кластера', 'Objects only in namespace dev, although the role is defined for the whole cluster'), correct: true },
      { id: 'all', text: bi('Объекты во всех namespace, потому что роль кластерная', 'Objects in every namespace, because the role is a cluster role'), why: bi('Где действует право, решает привязка, а не роль. RoleBinding всегда ограничена своим namespace, а ClusterRole в ней служит только готовым списком правил, который удобно выдавать в разных namespace.', 'The binding, not the role, decides where a right applies. A RoleBinding is always limited to its namespace, and a ClusterRole inside it is only a ready list of rules that is handy to grant in different namespaces.') },
      { id: 'none', text: bi('Ничего, потому что ClusterRole нельзя выдать через RoleBinding', 'Nothing, because a ClusterRole cannot be granted through a RoleBinding'), why: bi('Можно, и так делают часто: роли view, edit и admin, которые есть в каждом кластере, выдают разработчикам через RoleBinding в их namespace.', 'It can, and it is done often: the roles view, edit and admin that every cluster has are granted to developers through a RoleBinding in their namespace.') },
    ],
  },
  {
    id: 'k8s.q.acc.least',
    kind: 'mcq',
    concepts: ['k8s.least-privilege', 'k8s.serviceaccount'],
    prompt: bi(
      'Конвейер выкладки выполняет в namespace `shop` две команды: `kubectl set image deployment/web web=…` и `kubectl rollout status deployment/web`. Какую роль выдать его сервисному аккаунту?',
      'A deploy pipeline runs two commands in namespace `shop`: `kubectl set image deployment/web web=…` and `kubectl rollout status deployment/web`. Which role do you grant its service account?',
    ),
    options: [
      { id: 'least', text: bi('Role в shop с глаголами get, list, watch и patch на deployments в группе apps', 'A Role in shop with the verbs get, list, watch and patch on deployments in the group apps'), correct: true },
      { id: 'edit', text: bi('Встроенную ClusterRole edit через RoleBinding в shop, чтобы конвейер наверняка справился', 'The built-in ClusterRole edit through a RoleBinding in shop, so the pipeline surely manages'), why: bi('Роль edit разрешает ещё и читать Secret, удалять что угодно и запускать команды в подах. Если токен конвейера утечёт, всё это получит посторонний, поэтому выдают только то, что конвейер делает на самом деле.', 'Role edit also allows reading Secrets, deleting anything and running commands in pods. If the pipeline token leaks, an outsider gets all of that, so only what the pipeline really does is granted.') },
      { id: 'core', text: bi('Role в shop с глаголами get и patch на deployments в группе ""', 'A Role in shop with the verbs get and patch on deployments in the group ""'), why: bi('Deployment лежит в группе API apps, а пустая группа означает основную группу подов и сервисов. Такое правило не разрешит ничего, и конвейер получит Forbidden с текстом in API group "apps".', 'Deployments are in the API group apps; the empty group is the core group of pods and Services. Such a rule allows nothing, and the pipeline gets Forbidden saying in API group "apps".') },
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
    'Как API-сервер узнаёт, кто к нему пришёл, как прочитать отказ Forbidden, как ролью и привязкой RBAC выдать разработчику право только читать поды в одном namespace, как дать конвейеру выкладки сервисный аккаунт с наименьшими правами, как под обращается к API со своим токеном и как сделать вход по учётной записи компании, чтобы уволенный сотрудник терял доступ без единой правки в самом кластере.',
    'How the API server learns who came to it, how to read a Forbidden refusal, how an RBAC role and binding give a developer read-only access to pods in one namespace, how to give a deploy pipeline a service account with the least privilege, how a pod calls the API with its own token, and how to log in with the company account so that a person who leaves loses access without a single change in the cluster itself.',
  ),
  introduces: ['k8s.rbac', 'k8s.serviceaccount', 'k8s.least-privilege', 'k8s.oidc'],
  uses: ['k8s.apiserver', 'k8s.kubeconfig', 'k8s.namespace', 'k8s.secret', 'k8s.pod', 'k8s.api-object', 'k8s.deployment'],
  tier: 'core',
  minutes: 55,
  sources: src([S.rbac, S.authn, S.serviceAccounts, S.dex, S.kubelogin], [S.rbac, S.authn]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'До сих пор в учебном кластере вам было можно всё, и в маленькой команде так часто работают и с рабочим кластером: у каждого файл admin.conf с правами администратора. Потом стажёр по ошибке удаляет namespace соседней команды, а уволившийся подрядчик ещё полгода может зайти в кластер с копией этого файла. На собеседовании обычно спрашивают, как дать разработчику доступ только к его namespace и что сделать, чтобы бывший сотрудник не мог зайти в кластер. Урок отвечает на оба вопроса, а права вы выдадите и проверите сами: в учебном кластере этого урока, кроме вас, работают разработчик и конвейер выкладки, и API-сервер проверяет права каждого из них так же, как настоящий.',
        'Until now you could do everything in the training cluster, and small teams often work that way in production too: everyone has an admin.conf with administrator rights. Then an intern deletes a neighbouring team’s namespace by mistake, and a contractor who left can still log in for half a year with a copy of that file. Interviews usually ask how to give a developer access to their namespace only, and what to do so that a former employee cannot get into the cluster. The lesson answers both, and you will grant and check the rights yourself: in this lesson’s training cluster a developer and a deploy pipeline work besides you, and the API server checks the rights of each of them as a real one does.',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Две проверки на каждый запрос', 'Two checks for every request'),
      body: bi(
        'Вы уже знаете, что API-сервер — единственный вход в кластер. Каждый запрос он проверяет дважды, прежде чем выполнить. Сначала он выясняет, кто пришёл. Человек представляется сертификатом из kubeconfig, как вы с admin.conf, или токеном от сервера входа компании. Программа внутри кластера представляется токеном [[k8s.serviceaccount|сервисного аккаунта]], объекта ServiceAccount в своём namespace: kubelet кладёт поду такой короткий токен, и под с ним обращается к API. Людей в API нет: объекта User не существует, и кластер знает человека только по имени и списку групп, которые записаны в его сертификате или токене. Если представиться не удалось, сервер отвечает 401 Unauthorized.\n\nПотом API-сервер выясняет, что этому человеку или программе можно. Отвечает на это [[k8s.rbac|RBAC]], права по ролям. Объект Role в namespace перечисляет разрешённые действия: какие глаголы (`get`, `list`, `watch`, `create`, `update`, `patch`, `delete`) с какими видами объектов. Объект RoleBinding в том же namespace выдаёт эту роль пользователю, группе или сервисному аккаунту. ClusterRole и ClusterRoleBinding делают то же для всего кластера сразу. Права только добавляются: запрета в RBAC нет, и всё, что не разрешено ни одной ролью, запрещено. Если ни одна роль не разрешает действие, сервер отвечает 403 Forbidden и называет в ответе, кто и что пытался сделать.\n\n```yaml\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: pod-operator\n  namespace: shop\nrules:\n- apiGroups: [\"\"]\n  resources: [pods, pods/log]\n  verbs: [get, list, watch, delete]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: shop-devs-pods\n  namespace: shop\nsubjects:\n- kind: Group\n  name: shop-devs\n  apiGroup: rbac.authorization.k8s.io\nroleRef:\n  kind: Role\n  name: pod-operator\n  apiGroup: rbac.authorization.k8s.io\n```\n\nПроверить права, не рискуя, можно командой `kubectl auth can-i`. Команда `kubectl auth can-i delete pods -n shop` отвечает yes или no за вас, а команда `kubectl auth can-i --list -n shop` перечисляет всё, что вам можно в этом namespace. Чтобы задать тот же вопрос за другого человека, администратор добавляет флаг `--as` с его именем: API-сервер выполнит запрос так, будто пришёл этот человек. Такая подмена тоже право, и есть оно только у администраторов.\n\nВ kubeconfig учебного кластера этого урока три контекста. Контекст default принадлежит вам, администратору кластера. Контекст developer принадлежит разработчику, а контекст deployer — учётной записи, от имени которой работает конвейер выкладки. Флаг `--context developer` выполняет одну команду так, как её выполнил бы разработчик на своём ноутбуке, а флаг `--as=developer` даёт тот же ответ через подмену. Ни разработчику, ни конвейеру пока не выдано ни одного права.',
        'You already know that the API server is the only door of the cluster. It checks every request twice before doing it. First it finds out who came. A person presents a certificate from a kubeconfig, as you do with admin.conf, or a token from the company login server. A program inside the cluster presents the token of a [[k8s.serviceaccount|service account]], a ServiceAccount object in its namespace: the kubelet gives the pod such a short-lived token, and the pod calls the API with it. There are no people in the API at all: no User object exists, and the cluster knows a person only by the name and list of groups written in their certificate or token. If presenting fails, the answer is 401 Unauthorized.\n\nThen the API server finds out what this person or program may do. [[k8s.rbac|RBAC]], role-based access, answers that. A Role object in a namespace lists allowed actions: which verbs (`get`, `list`, `watch`, `create`, `update`, `patch`, `delete`) on which kinds of object. A RoleBinding object in the same namespace grants that role to a user, a group or a service account. A ClusterRole and a ClusterRoleBinding do the same for the whole cluster at once. Rights only add up: RBAC has no deny, and whatever no role allows is forbidden. If no role allows the action, the answer is 403 Forbidden, naming who tried to do what.\n\n```yaml\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: pod-operator\n  namespace: shop\nrules:\n- apiGroups: [\"\"]\n  resources: [pods, pods/log]\n  verbs: [get, list, watch, delete]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: shop-devs-pods\n  namespace: shop\nsubjects:\n- kind: Group\n  name: shop-devs\n  apiGroup: rbac.authorization.k8s.io\nroleRef:\n  kind: Role\n  name: pod-operator\n  apiGroup: rbac.authorization.k8s.io\n```\n\nYou can check rights without risk with `kubectl auth can-i`. `kubectl auth can-i delete pods -n shop` answers yes or no for you, and `kubectl auth can-i --list -n shop` lists everything you may do in that namespace. To ask the same question for another person, an administrator adds `--as` with their name: the API server handles the request as if that person came. This impersonation is a right too, and only administrators have it.\n\nThe kubeconfig of this lesson’s training cluster has three contexts. Context default is you, the cluster administrator. Context developer belongs to a developer, and context deployer to the account the deploy pipeline works under. `--context developer` runs one command the way the developer would run it on their laptop, and `--as=developer` gives the same answer through impersonation. Neither the developer nor the pipeline has been granted a single right yet.',
      ),
    },
    {
      id: 'lab-who',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ACCESS_LAB,
      intro: bi(
        'В namespace prod работает магазин, Deployment `web`, а в namespace dev разработчики пробуют новые версии. Вы администратор, а разработчику пока не выдано никаких прав. Сломать здесь ничего нельзя: если запутаетесь, перезагрузите страницу, и кластер вернётся в исходное состояние.',
        'The shop runs in namespace prod as Deployment `web`, and in namespace dev the developers try new versions. You are the administrator, and the developer has no rights yet. You cannot break anything here: if you get lost, reload the page, and the cluster returns to where it started.',
      ),
      tasks: [
        {
          id: 'mine',
          prompt: bi('Выясните, что в этом кластере можно вам самим.', 'Find out what you yourself may do in this cluster.'),
          check: {
            stdout: /^\*\s+\[\]\s+\[\]\s+\[\*\]\s*$/m,
            fail: [{ if: (f) => /--as/.test(lastLine(f)), say: bi('С флагом `--as` команда отвечает за другого человека. Здесь нужны ваши собственные права, поэтому выполните её без этого флага.', 'With `--as` the command answers for another person. Here your own rights are wanted, so run it without that flag.') }],
          },
          chips: 'kubectl auth can-i --list',
          concepts: ['k8s.rbac'],
          hints: {
            H1: bi('Список всего разрешённого печатает команда `kubectl auth can-i` с флагом `--list`.', '`kubectl auth can-i` with `--list` prints everything that is allowed.'),
            H2: bi('Выполните `kubectl auth can-i --list`. В ответе будет одна строка со звёздочками: звёздочка в столбце Resources означает любые объекты, а в столбце Verbs любые действия. Так выглядят права администратора, который входит в группу system:masters.', 'Run `kubectl auth can-i --list`. The answer has one line of asterisks: an asterisk in the Resources column means any objects, and in the Verbs column any actions. That is what the rights of an administrator in group system:masters look like.'),
            H3: bi('Если в ответе пусто, вы, скорее всего, переключились на чужой контекст. Вернитесь командой `kubectl config use-context default`.', 'If the answer is empty, you have probably switched to someone else’s context. Go back with `kubectl config use-context default`.'),
          },
        },
        {
          id: 'dev-list',
          prompt: bi('Теперь выясните, что можно разработчику `developer` в namespace prod.', 'Now find out what the developer `developer` may do in namespace prod.'),
          check: {
            stdout: /^(?![\s\S]*^\*\.\*)Resources\s+Non-Resource URLs\s+Resource Names\s+Verbs[\s\S]*selfsubject/m,
            fail: [{ if: (f) => /can-i/.test(lastLine(f)) && !/(--as[ =]developer|--context[ =]developer)/.test(lastLine(f)), say: bi('Команда ответила за того, кто её выполнил. Чтобы спросить за разработчика, добавьте `--as=developer` или выполните её в его контексте флагом `--context developer`, а namespace задайте флагом `-n prod`.', 'The command answered for whoever ran it. To ask for the developer, add `--as=developer` or run it in their context with `--context developer`, and set the namespace with `-n prod`.') }],
          },
          chips: 'kubectl auth can-i --list --as=developer -n prod',
          concepts: ['k8s.rbac'],
          hints: {
            H1: bi('Нужна та же команда, что в прошлом задании, но от имени разработчика и в namespace prod.', 'You need the same command as in the previous task, but on behalf of the developer and in namespace prod.'),
            H2: bi('Выполните `kubectl auth can-i --list --as=developer -n prod`. В ответе будут только строки `selfsubjectaccessreviews` и `selfsubjectrulesreviews`. Эти права есть у любого пользователя: они разрешают спросить у кластера о своих правах. Больше разработчику не выдано ничего.', 'Run `kubectl auth can-i --list --as=developer -n prod`. The answer has only the `selfsubjectaccessreviews` and `selfsubjectrulesreviews` rows. Every user has them: they allow asking the cluster about one’s own rights. The developer has been granted nothing else.'),
            H3: bi('Если в ответе появилась строка со звёздочками, команда ответила за вас, а не за разработчика: проверьте, что флаг `--as=developer` попал в команду.', 'If a line of asterisks appears, the command answered for you, not for the developer: check that `--as=developer` got into the command.'),
          },
        },
        {
          id: 'forbidden',
          prompt: bi('Попробуйте от имени разработчика посмотреть поды в namespace prod и прочитайте ответ API-сервера целиком.', 'As the developer, try to list the pods in namespace prod and read the API server’s answer in full.'),
          check: {
            stdout: /Error from server \(Forbidden\): pods is forbidden: User "developer" cannot list resource "pods" in API group "" in the namespace "prod"/,
            fail: [
              { if: (f) => /get pods?\b/.test(lastLine(f)) && !/(--as[ =]developer|--context[ =]developer)/.test(lastLine(f)), say: bi('Вы посмотрели поды как администратор, поэтому отказа не было. Повторите команду от имени разработчика, например `kubectl --context developer -n prod get pods`.', 'You listed the pods as the administrator, so nothing was refused. Repeat the command as the developer, for example `kubectl --context developer -n prod get pods`.') },
              { if: (f) => /developer/.test(lastLine(f)) && !/(-n[ =]prod|--namespace[ =]prod)/.test(lastLine(f)), say: bi('Отказ получен, но не в том namespace: у контекста developer namespace по умолчанию default. Добавьте `-n prod`.', 'A refusal came, but in another namespace: the developer context defaults to namespace default. Add `-n prod`.') },
            ],
          },
          chips: 'kubectl --context developer -n prod get pods',
          concepts: ['k8s.rbac', 'k8s.kubeconfig'],
          hints: {
            H1: bi('Подойдёт обычная команда `kubectl get pods` с namespace prod, но выполненная в контексте разработчика.', 'The ordinary `kubectl get pods` in namespace prod will do, run in the developer’s context.'),
            H2: bi('Выполните `kubectl --context developer -n prod get pods` или `kubectl --as=developer -n prod get pods`. Обе команды дадут один и тот же отказ.', 'Run `kubectl --context developer -n prod get pods` or `kubectl --as=developer -n prod get pods`. Both give the same refusal.'),
            H3: bi('Отказ начинается словами `Error from server (Forbidden)`. Если вместо него напечатался список подов, команда выполнилась от имени администратора, и нужно добавить `--context developer`.', 'The refusal starts with `Error from server (Forbidden)`. If a list of pods appeared instead, the command ran as the administrator, and `--context developer` has to be added.'),
          },
        },
      ],
    },
    {
      id: 'forbidden-parts',
      kind: 'text',
      step: 'explain',
      title: bi('Как читать отказ Forbidden', 'How to read a Forbidden refusal'),
      body: bi(
        'Сообщение, которое вы получили, выглядит длинным, но каждая его часть отвечает на свой вопрос, и вместе они подсказывают, какое право выдать.\n\n```text\nError from server (Forbidden): pods is forbidden: User "developer" cannot list resource "pods" in API group "" in the namespace "prod"\n```\n\nСлова `Error from server (Forbidden)` говорят, что отказал API-сервер с кодом 403. Запрос дошёл до сервера, сеть и kubeconfig в порядке. Слова `User "developer"` говорят, что сервер узнал пользователя, то есть первая проверка, «кто вы», пройдена: при неудаче был бы ответ 401 Unauthorized без имени. Слова `cannot list` называют глагол. Команда `kubectl get pods` без имени пода превращается в глагол list, с именем пода в get, а флаг `-w` добавляет watch. Слова `resource "pods"` называют вид объектов во множественном числе, как его пишут в правиле роли, а логи пода были бы отдельным подресурсом `pods/log`. Слова `in API group ""` называют группу API. Пустая строка означает основную группу, где лежат поды, сервисы, ConfigMap и Secret, а Deployment и StatefulSet лежат в группе apps. Наконец, `in the namespace "prod"` говорит, где проверялось право: роль, выданная в другом namespace, здесь не действует.\n\nВыходит, что из одного отказа складывается правило роли: глагол идёт в поле verbs, вид объектов в resources, группа в apiGroups, а namespace подсказывает, где создать RoleBinding.',
        'The message you got looks long, but every part answers its own question, and together they tell you which right to grant.\n\n```text\nError from server (Forbidden): pods is forbidden: User "developer" cannot list resource "pods" in API group "" in the namespace "prod"\n```\n\n`Error from server (Forbidden)` says the API server refused with code 403. The request reached the server, so the network and the kubeconfig are fine. `User "developer"` says the server recognised the user, so the first check, “who are you”, passed: had it failed, the answer would be 401 Unauthorized without a name. `cannot list` names the verb. `kubectl get pods` without a pod name becomes the verb list, with a pod name get, and `-w` adds watch. `resource "pods"` names the kind in the plural, as a role rule writes it, and pod logs would be a separate subresource `pods/log`. `in API group ""` names the API group. The empty string is the core group, home of pods, Services, ConfigMaps and Secrets, while Deployments and StatefulSets are in the group apps. Finally, `in the namespace "prod"` says where the right was checked: a role granted in another namespace does not apply here.\n\nSo one refusal adds up to a role rule: the verb goes into verbs, the kind into resources, the group into apiGroups, and the namespace tells you where to create the RoleBinding.',
      ),
    },
    { id: 'parts-quiz', kind: 'quiz', step: 'explain', items: ['k8s.q.acc.parts'] },
    {
      id: 'lab-grant',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ACCESS_LAB,
      intro: bi(
        'Разработчику нужно смотреть поды магазина и их логи в prod, когда он разбирает жалобы покупателей. Удалять поды, читать Secret и что-либо делать в других namespace ему не нужно. Кластер здесь тот же, что в прошлой работе, и прав у разработчика снова нет.',
        'The developer needs to look at the shop’s pods and their logs in prod when handling customer complaints. Deleting pods, reading Secrets or doing anything in other namespaces is not needed. The cluster is the same as in the previous lab, and the developer again has no rights.',
      ),
      tasks: [
        {
          id: 'role',
          prompt: bi(
            'Создайте в namespace prod роль `pod-reader`, которая разрешает читать поды и их логи, и выдайте её пользователю `developer` привязкой `developer-pod-reader` в том же namespace.',
            'Create in namespace prod a role `pod-reader` that allows reading pods and their logs, and grant it to user `developer` with a binding `developer-pod-reader` in the same namespace.',
          ),
          check: {
            when: devReadsProd,
            fail: [
              { if: (f) => !objOf(f, 'Role', 'prod', 'pod-reader') && !bindingsFor(f, 'RoleBinding', { kind: 'User', name: DEV }).length && !bindingsFor(f, 'ClusterRoleBinding', { kind: 'User', name: DEV }).length, say: bi('В prod пока нет ни роли, ни привязки. Начните с роли: `kubectl create role pod-reader -n prod` с флагами `--verb` и `--resource`.', 'There is neither a role nor a binding in prod yet. Start with the role: `kubectl create role pod-reader -n prod` with `--verb` and `--resource`.') },
              { if: (f) => !!objOf(f, 'Role', 'prod', 'pod-reader') && !bindingsFor(f, 'RoleBinding', { kind: 'User', name: DEV }).length && !bindingsFor(f, 'ClusterRoleBinding', { kind: 'User', name: DEV }).length, say: bi('Роль есть, но сама по себе она никому ничего не даёт: это только список правил. Выдайте её разработчику объектом RoleBinding в prod.', 'The role exists, but by itself it gives nobody anything: it is only a list of rules. Grant it to the developer with a RoleBinding in prod.') },
              { if: (f) => may(f, DEV, 'list', 'pods', 'dev'), say: bi('Разработчик теперь видит поды и в dev, то есть право действует во всём кластере. Так бывает, когда роль выдана ClusterRoleBinding. Удалите её и выдайте роль привязкой RoleBinding в namespace prod.', 'The developer now sees pods in dev too, so the right applies to the whole cluster. That happens when the role is granted with a ClusterRoleBinding. Delete it and grant the role with a RoleBinding in namespace prod.') },
              { if: (f) => may(f, DEV, 'delete', 'pods', 'prod') || may(f, DEV, 'create', 'pods', 'prod') || may(f, DEV, 'get', 'secrets', 'prod'), say: bi('Разработчик получил больше, чем нужно, например право удалять поды или читать Secret. Оставьте в роли только глаголы get, list и watch и объекты pods и pods/log.', 'The developer got more than needed, such as deleting pods or reading Secrets. Keep in the role only the verbs get, list and watch and the objects pods and pods/log.') },
              { if: (f) => may(f, DEV, 'list', 'pods', 'prod') && !may(f, DEV, 'get', 'pods/log', 'prod'), say: bi('Поды разработчик уже видит, а логи нет. Логи пода — отдельный подресурс `pods/log`, и его нужно перечислить в роли рядом с pods.', 'The developer sees the pods now, but not the logs. Pod logs are a separate subresource `pods/log`, and the role must list it next to pods.') },
              { if: (f) => bindingsFor(f, 'RoleBinding', { kind: 'User', name: DEV }).some((b) => b.metadata?.namespace !== 'prod'), say: bi('Привязка создана не в namespace prod. RoleBinding действует только в своём namespace, поэтому создайте её с флагом `-n prod`.', 'The binding was created outside namespace prod. A RoleBinding works only in its own namespace, so create it with `-n prod`.') },
            ],
          },
          chips: 'kubectl create role pod-reader -n prod --verb=get,list,watch --resource=pods,pods/log',
          concepts: ['k8s.rbac'],
          hints: {
            H1: bi('Нужны два объекта: роль со списком разрешённых действий и привязка, которая выдаёт роль пользователю. Оба создаются командой `kubectl create`, и оба в namespace prod.', 'Two objects are needed: a role listing the allowed actions and a binding that grants it to a user. Both are made with `kubectl create`, both in namespace prod.'),
            H2: bi('Роль создаётся командой `kubectl create role pod-reader -n prod --verb=get,list,watch --resource=pods,pods/log`. Затем роль выдают командой `kubectl create rolebinding` с флагами `--role` и `--user`.', 'The role is made with `kubectl create role pod-reader -n prod --verb=get,list,watch --resource=pods,pods/log`. Then the role is granted with `kubectl create rolebinding` with `--role` and `--user`.'),
            H3: bi('Вторая команда целиком выглядит так: `kubectl create rolebinding developer-pod-reader -n prod --role=pod-reader --user=developer`. Проверьте результат командой `kubectl auth can-i --list --as=developer -n prod`.', 'The second command in full: `kubectl create rolebinding developer-pod-reader -n prod --role=pod-reader --user=developer`. Check the result with `kubectl auth can-i --list --as=developer -n prod`.'),
          },
        },
        {
          id: 'verify',
          prompt: bi('Убедитесь от имени разработчика, что поды в prod он теперь видит, а удалить под по-прежнему не может.', 'Make sure, as the developer, that they now see the pods in prod and still cannot delete a pod.'),
          check: {
            when: (f) => devReadsProd(f) && decided(f, DEV, 'list', 'pods', true, 'prod') && decided(f, DEV, 'delete', 'pods', false, 'prod'),
            fail: [{ if: (f) => decided(f, DEV, 'list', 'pods', true, 'prod') && !decided(f, DEV, 'delete', 'pods', false), say: bi('Поды разработчик видит. Осталась вторая половина: попробуйте от его имени удалить под или спросите `kubectl auth can-i delete pods --as=developer -n prod`.', 'The developer sees the pods. The second half is left: try to delete a pod as the developer or ask `kubectl auth can-i delete pods --as=developer -n prod`.') }],
          },
          chips: 'kubectl --context developer -n prod get pods',
          concepts: ['k8s.rbac'],
          hints: {
            H1: bi('Выполните две команды в контексте разработчика: одну, которая показывает поды, и другую, которая удаляет один из них.', 'Run two commands in the developer’s context: one that lists the pods and another that deletes one of them.'),
            H2: bi('Подойдут `kubectl --context developer -n prod get pods` и `kubectl --context developer -n prod delete pod <имя пода>`. Вторая команда должна получить отказ с глаголом delete. Вместо настоящего удаления можно спросить `kubectl auth can-i delete pods --as=developer -n prod`.', '`kubectl --context developer -n prod get pods` and `kubectl --context developer -n prod delete pod <pod name>` will do. The second must be refused with the verb delete. Instead of a real deletion you can ask `kubectl auth can-i delete pods --as=developer -n prod`.'),
            H3: bi('Если удаление вдруг прошло, роль разрешает лишнее: посмотрите её командой `kubectl describe role pod-reader -n prod` и уберите глагол delete.', 'If the deletion went through, the role allows too much: look at it with `kubectl describe role pod-reader -n prod` and remove the verb delete.'),
          },
        },
      ],
    },
    {
      id: 'least',
      kind: 'text',
      step: 'explain',
      title: bi('Права для конвейера выкладки', 'Rights for a deploy pipeline'),
      body: bi(
        'Программам права выдают так же, как людям, только получатель — сервисный аккаунт. Конвейер выкладки из блока CI/CD запускает `kubectl` на сервере сборки, и чтобы API-сервер его пустил, конвейеру дают токен сервисного аккаунта. Токен хранится в переменных конвейера, и любой, кто прочитает журнал сборки или переменные проекта, получит все права этого аккаунта. Поэтому аккаунту выдают [[k8s.least-privilege|наименьшие права]], то есть только те действия, которые конвейер выполняет, и ни одного сверх них.\n\nПрава конвейера выводят из его команд. Команда `kubectl set image deployment/web …` читает Deployment и меняет его, то есть ей нужны глаголы get и patch. Команда `kubectl rollout status deployment/web` читает Deployment и следит за ним, то есть ей нужны get и watch. Deployment лежит в группе API apps, поэтому в роли нужно правило с `apiGroups: [apps]` и `resources: [deployments]`. Удалять Deployment, создавать новые, читать Secret и что-либо делать в других namespace конвейеру не нужно, и роль этого не разрешает.',
        'Programs get rights the same way as people, only the subject is a service account. The deploy pipeline from the CI/CD block runs `kubectl` on a build server, and for the API server to let it in, the pipeline gets a service account token. The token is kept in the pipeline variables, and anyone who manages to read the build log or the project variables gets all the rights of that account. That is why the account gets the [[k8s.least-privilege|least privilege]], exactly the actions the pipeline performs and not one more.\n\nThe pipeline’s rights follow from its commands. `kubectl set image deployment/web …` reads the Deployment and changes it, so it needs the verbs get and patch. `kubectl rollout status deployment/web` reads the Deployment and watches it, so it needs get and watch. Deployments are in the API group apps, so the role needs a rule with `apiGroups: [apps]` and `resources: [deployments]`. Deleting Deployments, creating new ones, reading Secrets or doing anything in other namespaces is not needed by the pipeline, and the role does not allow it.',
      ),
    },
    {
      id: 'lab-ci',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: CI_LAB,
      intro: bi(
        'Конвейер выкладки магазина будет обновлять образ Deployment `web` в prod и ждать окончания выкладки. Рядом платформенная команда хочет запустить страницу состояния, под `status-page` из файла `status.yaml`, которая читает список подов prod через API от имени сервисного аккаунта `status-reader`. Ни одного из этих аккаунтов в кластере пока нет.',
        'The shop’s deploy pipeline will update the image of Deployment `web` in prod and wait for the rollout to finish. Next to it the platform team wants to run a status page, pod `status-page` from `status.yaml`, which reads the list of prod pods through the API as service account `status-reader`. Neither account exists in the cluster yet.',
      ),
      tasks: [
        {
          id: 'sa',
          prompt: bi(
            'Создайте в prod сервисный аккаунт `ci-deployer` для конвейера и выдайте ему наименьшие права: читать Deployment в prod, следить за ним и менять его. Удалять и создавать Deployment, читать Secret и работать в других namespace аккаунт не должен.',
            'Create in prod a service account `ci-deployer` for the pipeline and give it the least privilege: read, watch and change Deployments in prod. The account must not delete or create Deployments, read Secrets or work in other namespaces.',
          ),
          check: {
            when: (f) => !!objOf(f, 'ServiceAccount', 'prod', 'ci-deployer') && ciLeast(f),
            fail: [
              { if: (f) => !objOf(f, 'ServiceAccount', 'prod', 'ci-deployer'), say: bi('Сервисного аккаунта `ci-deployer` в prod ещё нет. Создайте его командой `kubectl create serviceaccount ci-deployer -n prod`.', 'There is no service account `ci-deployer` in prod yet. Create it with `kubectl create serviceaccount ci-deployer -n prod`.') },
              { if: (f) => deploymentsInCoreGroup(f, 'prod') && !may(f, CI, 'patch', 'deployments', 'prod'), say: bi('В роли Deployment записан в пустой группе API, а это группа подов и сервисов. Deployment лежит в группе apps: в команде напишите `--resource=deployments.apps`, а в YAML `apiGroups: ["apps"]`.', 'The role puts deployments into the empty API group, the group of pods and Services. Deployments are in the group apps: write `--resource=deployments.apps` in the command, or `apiGroups: ["apps"]` in YAML.') },
              { if: (f) => bindingsFor(f, 'RoleBinding', { kind: 'User', name: 'ci-deployer' }).length > 0 && !may(f, CI, 'patch', 'deployments', 'prod'), say: bi('Привязка выдаёт роль пользователю с именем ci-deployer, а не сервисному аккаунту. Для аккаунта нужен флаг `--serviceaccount=prod:ci-deployer`: сервер узнаёт аккаунт по имени `system:serviceaccount:prod:ci-deployer`.', 'The binding grants the role to a user called ci-deployer, not to the service account. An account needs `--serviceaccount=prod:ci-deployer`: the server knows it by the name `system:serviceaccount:prod:ci-deployer`.') },
              { if: (f) => may(f, CI, 'delete', 'deployments', 'prod') || may(f, CI, 'create', 'deployments', 'prod') || may(f, CI, 'get', 'secrets', 'prod') || may(f, CI, 'delete', 'pods', 'prod'), say: bi('Аккаунт получил лишние права, например удалять или создавать объекты и читать Secret. Так бывает, когда выдают готовую роль edit или admin. Оставьте роль, в которой есть только get, list, watch и patch на deployments.', 'The account got too much: deleting or creating objects, reading Secrets. That happens when the ready role edit or admin is granted. Keep a role with only get, list, watch and patch on deployments.') },
              { if: (f) => may(f, CI, 'patch', 'deployments', 'dev'), say: bi('Аккаунт может менять Deployment и в dev, то есть права выданы на весь кластер. Выдайте роль привязкой RoleBinding в prod, а не ClusterRoleBinding.', 'The account can change Deployments in dev too, so the rights cover the whole cluster. Grant the role with a RoleBinding in prod, not a ClusterRoleBinding.') },
              { if: (f) => may(f, CI, 'get', 'deployments', 'prod') && !may(f, CI, 'patch', 'deployments', 'prod'), say: bi('Читать Deployment аккаунт может, а менять нет. Команда `kubectl set image` отправляет изменение глаголом patch, добавьте его в роль.', 'The account can read Deployments but not change them. `kubectl set image` sends the change with the verb patch, so add it to the role.') },
            ],
          },
          chips: 'kubectl create serviceaccount ci-deployer -n prod',
          concepts: ['k8s.serviceaccount', 'k8s.least-privilege'],
          hints: {
            H1: bi('Здесь три объекта, и все в prod: сервисный аккаунт, роль с правилом на deployments в группе apps и привязка роли к аккаунту.', 'Three objects, all in prod: the service account, a role with a rule on deployments in the group apps, and a binding of the role to the account.'),
            H2: bi('Аккаунт создаёт `kubectl create serviceaccount ci-deployer -n prod`, а роль создаёт `kubectl create role deployer -n prod --verb=get,list,watch,patch --resource=deployments.apps`. Окончание `.apps` называет группу API.', '`kubectl create serviceaccount ci-deployer -n prod` creates the account, and `kubectl create role deployer -n prod --verb=get,list,watch,patch --resource=deployments.apps` creates the role. The suffix `.apps` names the API group.'),
            H3: bi('Привязку создаёт команда `kubectl create rolebinding ci-deployer -n prod --role=deployer --serviceaccount=prod:ci-deployer`. Проверьте результат командой `kubectl auth can-i --list --as=system:serviceaccount:prod:ci-deployer -n prod`.', 'The binding: `kubectl create rolebinding ci-deployer -n prod --role=deployer --serviceaccount=prod:ci-deployer`. Check the result with `kubectl auth can-i --list --as=system:serviceaccount:prod:ci-deployer -n prod`.'),
          },
        },
        {
          id: 'sa-run',
          prompt: bi(
            'Выполните выкладку так, как её выполнит конвейер: от имени `ci-deployer` обновите образ `web` в prod до `trainer/web:1.1` и дождитесь окончания выкладки. Затем убедитесь, что удалить Deployment этот аккаунт не может.',
            'Run the rollout the way the pipeline will: as `ci-deployer`, update the image of `web` in prod to `trainer/web:1.1` and wait for the rollout to finish. Then make sure this account cannot delete the Deployment.',
          ),
          check: {
            when: (f) => deploymentOf(f, 'prod', 'web')?.image === 'trainer/web:1.1' && (deploymentOf(f, 'prod', 'web')?.ready ?? 0) >= 2 && decided(f, CI, 'patch', 'deployments', true, 'prod') && decided(f, CI, 'delete', 'deployments', false, 'prod'),
            fail: [
              { if: (f) => deploymentOf(f, 'prod', 'web')?.image === 'trainer/web:1.1' && !decided(f, CI, 'patch', 'deployments', true), say: bi('Образ обновлён, но от вашего имени, а не от имени конвейера, и права аккаунта так и остались непроверенными. Повторите команду с флагом `--as=system:serviceaccount:prod:ci-deployer`, например вернув сначала образ 1.0.', 'The image is updated, but as you, not as the pipeline, so the account’s rights stay unchecked. Repeat the command with `--as=system:serviceaccount:prod:ci-deployer`, for example after setting the image back to 1.0.') },
              { if: (f) => decided(f, CI, 'patch', 'deployments', true, 'prod') && !decided(f, CI, 'delete', 'deployments', false), say: bi('Выкладка прошла от имени аккаунта. Осталось убедиться, что удалить Deployment он не может: спросите `kubectl auth can-i delete deployments --as=system:serviceaccount:prod:ci-deployer -n prod`.', 'The rollout went through as the account. It remains to make sure it cannot delete the Deployment: ask `kubectl auth can-i delete deployments --as=system:serviceaccount:prod:ci-deployer -n prod`.') },
            ],
          },
          chips: 'kubectl --as=system:serviceaccount:prod:ci-deployer -n prod set image deployment/web web=trainer/web:1.1',
          concepts: ['k8s.serviceaccount'],
          hints: {
            H1: bi('Сервисный аккаунт API-сервер узнаёт по имени вида `system:serviceaccount:<namespace>:<имя>`, и это имя передают флагу `--as`.', 'The API server knows a service account by a name of the form `system:serviceaccount:<namespace>:<name>`, and that name goes to `--as`.'),
            H2: bi('Выполните `kubectl --as=system:serviceaccount:prod:ci-deployer -n prod set image deployment/web web=trainer/web:1.1`, а затем ту же команду с `rollout status deployment/web`.', 'Run `kubectl --as=system:serviceaccount:prod:ci-deployer -n prod set image deployment/web web=trainer/web:1.1`, then the same with `rollout status deployment/web`.'),
            H3: bi('Последним шагом спросите `kubectl auth can-i delete deployments --as=system:serviceaccount:prod:ci-deployer -n prod`, и команда должна ответить no.', 'The last step: `kubectl auth can-i delete deployments --as=system:serviceaccount:prod:ci-deployer -n prod` must answer no.'),
          },
        },
        {
          id: 'pod-token',
          prompt: bi(
            'Запустите страницу состояния из файла `status.yaml` так, чтобы она работала от имени сервисного аккаунта `status-reader` и могла только читать список подов в prod. Затем изнутри пода `status-page` получите этот список через API.',
            'Start the status page from `status.yaml` so that it runs as service account `status-reader` and can only read the list of pods in prod. Then, from inside pod `status-page`, get that list through the API.',
          ),
          check: {
            when: (f) => objOf(f, 'Pod', 'prod', 'status-page')?.spec?.serviceAccountName === 'status-reader' && !!podOf(f, 'prod', 'status-page')?.ready && decided(f, STATUS, 'list', 'pods', true, 'prod') && !may(f, STATUS, 'delete', 'pods', 'prod') && !may(f, STATUS, 'get', 'secrets', 'prod'),
            fail: [
              { if: (f) => !objOf(f, 'ServiceAccount', 'prod', 'status-reader') && !objOf(f, 'Pod', 'prod', 'status-page'), say: bi('API-сервер не создаёт под, пока нет сервисного аккаунта, названного в его поле serviceAccountName. Сначала создайте аккаунт `status-reader` в prod, а потом примените файл.', 'The API server does not create a pod while the service account named in its serviceAccountName field is missing. First create account `status-reader` in prod, then apply the file.') },
              { if: (f) => !!objOf(f, 'Pod', 'prod', 'status-page') && objOf(f, 'Pod', 'prod', 'status-page')?.spec?.serviceAccountName !== 'status-reader', say: bi('Под работает от имени другого аккаунта, скорее всего default, потому что поле serviceAccountName убрали из файла. Удалите под и примените файл без изменений.', 'The pod runs as another account, most likely default, because serviceAccountName was removed from the file. Delete the pod and apply the file unchanged.') },
              { if: (f) => decided(f, STATUS, 'list', 'pods', false, 'prod') && !decided(f, STATUS, 'list', 'pods', true, 'prod'), say: bi('Токен пода дошёл до API-сервера, и сервер узнал аккаунт status-reader, но роли у аккаунта нет. Выдайте ему роль с глаголами get и list на pods в prod.', 'The pod’s token reached the API server, and the server recognised account status-reader, but the account has no role. Grant it a role with get and list on pods in prod.') },
              { if: (f) => may(f, STATUS, 'delete', 'pods', 'prod') || may(f, STATUS, 'get', 'secrets', 'prod'), say: bi('Странице состояния выданы лишние права. Ей нужно только читать список подов, поэтому оставьте роль с глаголами get, list и watch на pods.', 'The status page got extra rights. It only needs to read the pod list, so keep a role with get, list and watch on pods.') },
            ],
          },
          chips: 'kubectl -n prod exec status-page -- kubectl get pods',
          concepts: ['k8s.serviceaccount', 'k8s.pod'],
          hints: {
            H1: bi('Порядок такой: аккаунт, роль на чтение подов, привязка роли к аккаунту, затем сам под. Внутри пода kubectl сам найдёт токен, который kubelet положил в каталог `/var/run/secrets/kubernetes.io/serviceaccount`.', 'The order: the account, a role for reading pods, a binding of the role to the account, then the pod itself. Inside the pod kubectl finds by itself the token the kubelet put into `/var/run/secrets/kubernetes.io/serviceaccount`.'),
            H2: bi('Выполните `kubectl create serviceaccount status-reader -n prod`, `kubectl create role pod-list -n prod --verb=get,list,watch --resource=pods` и `kubectl create rolebinding status-reader -n prod --role=pod-list --serviceaccount=prod:status-reader`, а затем `kubectl apply -f status.yaml`.', 'Run `kubectl create serviceaccount status-reader -n prod`, `kubectl create role pod-list -n prod --verb=get,list,watch --resource=pods` and `kubectl create rolebinding status-reader -n prod --role=pod-list --serviceaccount=prod:status-reader`, then `kubectl apply -f status.yaml`.'),
            H3: bi('Когда под запустится, выполните `kubectl -n prod exec status-page -- kubectl get pods`. Тот же запрос без kubectl выглядит так: `kubectl -n prod exec status-page -- sh -c \'curl -k -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" https://kubernetes.default.svc/api/v1/namespaces/prod/pods\'`.', 'Once the pod runs, execute `kubectl -n prod exec status-page -- kubectl get pods`. The same request without kubectl: `kubectl -n prod exec status-page -- sh -c \'curl -k -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" https://kubernetes.default.svc/api/v1/namespaces/prod/pods\'`.'),
          },
        },
      ],
    },
    {
      id: 'token-file',
      kind: 'text',
      step: 'review',
      title: bi('Откуда у пода токен и когда его не давать', 'Where a pod gets its token, and when not to give it one'),
      body: bi(
        'В последнем задании kubectl внутри пода не спрашивал ни пароля, ни ключа. Когда под создаётся, API-сервер подставляет в него том с тремя файлами в каталоге `/var/run/secrets/kubernetes.io/serviceaccount`: `token` с токеном аккаунта, `ca.crt` с сертификатом центра сертификации кластера и `namespace` с именем namespace. kubelet время от времени заменяет токен свежим, потому что срок у такого токена около часа. Программы внутри кластера, и kubectl, и библиотеки для Python или Go, читают этот каталог сами.\n\nВсякий под, у которого поле serviceAccountName не задано, получает аккаунт default своего namespace, а вместе с ним и токен. Прав у default по умолчанию нет, но если кто-то однажды выдаст их аккаунту default, их получат все поды namespace. Поэтому каждому приложению, которому нужен API, заводят свой аккаунт, как вы сделали для страницы состояния, а поду, которому API не нужен вовсе, токен не дают: в его спецификации ставят `automountServiceAccountToken: false`. Перед выдачей роли полезно спросить `kubectl auth can-i --list --as=system:serviceaccount:<namespace>:<имя>`, как вы делали в этом уроке.',
        'In the last task kubectl inside the pod asked for neither a password nor a key. When a pod is created, the API server adds a volume to it with three files in `/var/run/secrets/kubernetes.io/serviceaccount`: `token` with the account token, `ca.crt` with the certificate of the cluster’s certificate authority and `namespace` with the namespace name. The kubelet replaces the token with a fresh one from time to time, because such a token lives about an hour. Programs inside the cluster, kubectl as well as the libraries for Python or Go, read this directory by themselves.\n\nAny pod whose serviceAccountName is not set gets the default account of its namespace, and a token with it. By default the default account has no rights, but if someone once grants it some, every pod of the namespace gets them. That is why every application that needs the API gets its own account, as you did for the status page, and a pod that does not need the API at all gets no token: its spec says `automountServiceAccountToken: false`. Before granting a role it is useful to ask `kubectl auth can-i --list --as=system:serviceaccount:<namespace>:<name>`, as you did in this lesson.',
      ),
    },
    {
      id: 'company-login',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Вход по учётной записи компании', 'Logging in with the company account'),
      body: bi(
        'В учебном кластере контексты developer и deployer уже записаны в kubeconfig, и API-сервер верит, что имя пользователя в них проверено. В компании так делать нельзя. Личный сертификат в kubeconfig нельзя отозвать: Kubernetes не ведёт списка отозванных сертификатов, и файл действует, пока не истечёт его срок, обычно год. Поэтому в компаниях людей пускают в кластер [[k8s.oidc|через OIDC]], тот же способ входа, что кнопка «Войти через Google» на сайтах. Сервер входа, обычно Dex или Keycloak, проверяет человека по каталогу сотрудников компании, например Active Directory или LDAP, и знает, в каких группах он состоит. В kubeconfig разработчика нет ни ключа, ни пароля. Когда он выполняет kubectl, тот открывает браузер, человек входит под своей рабочей учётной записью, и kubectl получает короткий токен, где записаны его имя и группы. Срок такого токена задаёт сервер входа, и в компаниях его ставят в минутах. Дальше токен проходит те же две проверки, что вы видели в этом уроке, а в сообщении Forbidden будет стоять имя из токена, например `User "oidc:anna@example.com"`.\n\nПрава в кластере выдают группам из каталога, а не отдельным людям: RoleBinding, которую вы создали для пользователя developer, в компании выдавала бы роль группе, например `shop-devs`, с полем `kind: Group` в subjects или флагом `--group` в команде. Из такого устройства входа следует главное. Когда сотрудник увольняется, его отключают в каталоге, и в течение нескольких минут он лишается доступа к кластеру: войти заново и получить новый токен он не сможет, а уже выданный перестанет действовать, когда истечёт его короткий срок. Ни одного файла в кластере при этом менять не нужно. Новичок в команде получает доступ так же, когда его добавляют в группу в каталоге.',
        'In the training cluster the contexts developer and deployer are already in the kubeconfig, and the API server trusts that the user names in them have been checked. A company must not work this way. A personal certificate in a kubeconfig cannot be revoked: Kubernetes keeps no list of revoked certificates, and the file works until it expires, usually after a year. That is why companies let people into the cluster [[k8s.oidc|through OIDC]], the same way of logging in as the “Sign in with Google” button on websites. A login server, usually Dex or Keycloak, checks the person against the company staff directory, such as Active Directory or LDAP, and knows which groups they belong to. The developer’s kubeconfig holds neither a key nor a password. When they run kubectl, it opens a browser, the person logs in with their work account, and kubectl gets a short token with their name and groups. The login server sets the token’s lifetime, and companies set it in minutes. From there the token goes through the same two checks you saw in this lesson, and a Forbidden message carries the name from the token, for example `User "oidc:anna@example.com"`.\n\nRights in the cluster go to groups from the directory, not to individual people: the RoleBinding you created for user developer would, in a company, grant the role to a group such as `shop-devs`, with `kind: Group` in subjects or `--group` in the command. The main consequence follows. When an employee leaves, they are disabled in the directory and lose access to the cluster within minutes: they cannot log in again and get a new token, and the one already issued stops working within minutes. Not a single file in the cluster has to change. A newcomer gets access the same way: they are added to a group in the directory.',
      ),
    },
    {
      id: 'token-path',
      kind: 'text',
      step: 'explain',
      levels: ['experienced'],
      title: bi('Как токен проходит от сервера входа до RBAC', 'How the token travels from the login server to RBAC'),
      body: bi(
        'В kubeconfig вместо ключа записан плагин учётных данных, чаще всего kubelogin: в поле `users[].user.exec` стоит команда `kubectl oidc-login get-token` с адресом сервера входа и идентификатором клиента. Плагин открывает браузер и проходит обычный поток OAuth 2.0 с кодом авторизации и PKCE. Dex или Keycloak проверяет человека по LDAP или Active Directory и возвращает ID-токен, то есть JWT, подписанный ключом сервера входа, с полями `iss` (кто выпустил), `aud` (для какого клиента), `exp` (до какого момента действует), `email` и `groups`, и вместе с ним refresh-токен. Плагин кэширует токены и обновляет ID-токен, пока refresh-токен действует.\n\nkubectl отправляет ID-токен в заголовке `Authorization: Bearer`, точно так же, как в этом уроке curl из пода отправлял токен сервисного аккаунта. API-сервер на каждый запрос к серверу входа не ходит: он берёт открытые ключи сервера входа по адресу из `<issuer>/.well-known/openid-configuration`, время от времени обновляет их и сам проверяет подпись, `iss`, `aud` и `exp`. Как превращать поля токена в имя и группы, задают флаги `--oidc-issuer-url`, `--oidc-client-id`, `--oidc-username-claim` и `--oidc-groups-claim` или файл AuthenticationConfiguration, где можно описать несколько серверов входа и правила на выражениях CEL. Имя получает префикс, например `oidc:anna@example.com`, чтобы его нельзя было спутать с сервисными аккаунтами, и дальше запрос идёт в RBAC как любой другой.\n\nИз этого пути следуют два вывода для работы. Отозвать уже выданный ID-токен API-сервер не может, поэтому срок ID-токена держат коротким, от 5 до 15 минут, хотя у Dex по умолчанию он равен суткам, а отключение в каталоге закрывает получение новых токенов. И должен остаться аварийный вход на случай, когда сервер входа сам лежит: один admin.conf в сейфе, которым не пользуются каждый день.',
        'Instead of a key, the kubeconfig holds a credential plugin, most often kubelogin: `users[].user.exec` runs `kubectl oidc-login get-token` with the login server address and the client id. The plugin opens a browser and goes through the ordinary OAuth 2.0 authorization code flow with PKCE. Dex or Keycloak checks the person against LDAP or Active Directory and returns an ID token, that is, a JWT signed by the login server’s key, with the fields `iss` (who issued it), `aud` (for which client), `exp` (until when it is valid), `email` and `groups`, together with a refresh token. The plugin caches the tokens and refreshes the ID token while the refresh token is valid.\n\nkubectl sends the ID token in the `Authorization: Bearer` header, the same way curl inside the pod sent the service account token in this lesson. The API server does not call the login server for every request: it takes the login server’s public keys from the address in `<issuer>/.well-known/openid-configuration`, refreshes them from time to time and checks the signature, `iss`, `aud` and `exp` itself. How token fields become a name and groups is set by the flags `--oidc-issuer-url`, `--oidc-client-id`, `--oidc-username-claim` and `--oidc-groups-claim`, or by an AuthenticationConfiguration file, which can describe several login servers and rules written as CEL expressions. The name gets a prefix, for example `oidc:anna@example.com`, so it cannot be confused with service accounts, and from there the request goes to RBAC like any other.\n\nTwo conclusions for work follow from this path. The API server cannot revoke an ID token already issued, so its lifetime is kept short, within 5–15 minutes, although Dex defaults to a day, while disabling the account in the directory stops new tokens. And an emergency way in must remain for when the login server itself is down: one admin.conf in a safe that nobody uses day to day.',
      ),
    },
    {
      id: 'why-intro',
      kind: 'text',
      step: 'explain',
      title: bi('Где действует привязка', 'Where a binding applies'),
      body: bi(
        'Две ошибки с правами встречаются чаще всего, и обе связаны с тем, где действует привязка. Роль описывает, что можно, а привязка решает, кому и где. RoleBinding действует только в своём namespace, даже если ссылается на ClusterRole: кластерная роль в ней служит лишь готовым списком правил, который удобно выдавать в разных namespace, как встроенные роли view, edit и admin. Право во всех namespace сразу даёт только ClusterRoleBinding. Поэтому привязка, созданная не в том namespace, не даёт ничего там, где она нужна, а ClusterRole, выданная через RoleBinding, работает в одном namespace, хотя её автор рассчитывал на весь кластер. В следующей работе обе ошибки уже сделаны коллегами, и их нужно найти по ответам API-сервера.',
        'Two mistakes with rights are the most common, and both are about where a binding applies. A role describes what is allowed, and a binding decides to whom and where. A RoleBinding works only in its own namespace, even when it refers to a ClusterRole: the cluster role in it is only a ready list of rules that is handy to grant in different namespaces, like the built-in roles view, edit and admin. Only a ClusterRoleBinding gives a right in every namespace at once. So a binding created in the wrong namespace gives nothing where it is needed, and a ClusterRole granted through a RoleBinding works in one namespace although its author counted on the whole cluster. In the next lab colleagues have already made both mistakes, and you find them by the API server’s answers.',
      ),
    },
    {
      id: 'lab-why',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: RBAC_BROKEN,
      intro: bi(
        'Коллега выдал разработчику роль `log-reader` из namespace prod, чтобы тот читал логи магазина, но разработчик по-прежнему получает Forbidden. Другой коллега завёл для системы мониторинга сервисный аккаунт `pod-watcher` в namespace monitoring и ClusterRole `pod-lister`, но мониторинг видит поды только в своём namespace. Ничего не удаляя без нужды, найдите обе ошибки и исправьте их.',
        'A colleague granted the developer role `log-reader` from namespace prod so that they could read the shop’s logs, but the developer still gets Forbidden. Another colleague set up service account `pod-watcher` in namespace monitoring and ClusterRole `pod-lister` for the monitoring system, but monitoring sees pods only in its own namespace. Without deleting anything needlessly, find both mistakes and fix them.',
      ),
      tasks: [
        {
          id: 'wrong-ns',
          prompt: bi('Добейтесь, чтобы разработчик `developer` читал поды и логи в prod, а в остальных namespace по-прежнему не мог ничего.', 'Make the developer `developer` able to read pods and logs in prod, while still unable to do anything in other namespaces.'),
          check: {
            when: (f) => may(f, DEV, 'get', 'pods/log', 'prod') && may(f, DEV, 'list', 'pods', 'prod') && !may(f, DEV, 'list', 'pods', 'dev') && !may(f, DEV, 'delete', 'pods', 'prod'),
            fail: [
              { if: (f) => may(f, DEV, 'list', 'pods', 'dev'), say: bi('Теперь разработчик видит поды во всех namespace, а нужно только в prod. Так получается с ClusterRoleBinding. Удалите её и создайте RoleBinding в prod.', 'Now the developer sees pods in every namespace, and only prod is wanted. That is what a ClusterRoleBinding does. Delete it and create a RoleBinding in prod.') },
              { if: (f) => !may(f, DEV, 'list', 'pods', 'prod'), say: bi('Привязка `developer-logs` лежит в namespace default, а роль `log-reader` в prod. RoleBinding действует только в своём namespace, поэтому в prod у разработчика прав нет. Создайте такую же привязку в prod.', 'Binding `developer-logs` sits in namespace default, while role `log-reader` is in prod. A RoleBinding works only in its own namespace, so the developer has no rights in prod. Create the same binding in prod.') },
            ],
          },
          chips: 'kubectl get rolebindings -A',
          concepts: ['k8s.rbac'],
          hints: {
            H1: bi('Посмотрите, где лежат роль и привязка: `kubectl get roles,rolebindings -A`. Затем выполните `kubectl describe rolebinding developer-logs -n default` и сравните namespace привязки с namespace роли.', 'Look where the role and the binding are: `kubectl get roles,rolebindings -A`. Then run `kubectl describe rolebinding developer-logs -n default` and compare the binding’s namespace with the role’s.'),
            H2: bi('Привязка ссылается на роль по имени в своём же namespace, а в default роли `log-reader` нет. Создайте привязку в prod: `kubectl create rolebinding developer-logs -n prod --role=log-reader --user=developer`.', 'A binding refers to a role by name in its own namespace, and default has no role `log-reader`. Create the binding in prod: `kubectl create rolebinding developer-logs -n prod --role=log-reader --user=developer`.'),
            H3: bi('Ненужную привязку из default после этого можно удалить командой `kubectl delete rolebinding developer-logs -n default`. На права в prod она не влияет, но вводит в заблуждение того, кто будет читать список.', 'Afterwards the useless binding in default can be removed with `kubectl delete rolebinding developer-logs -n default`. It does not affect the rights in prod, but it misleads whoever reads the list.'),
          },
        },
        {
          id: 'cluster-wide',
          prompt: bi('Добейтесь, чтобы аккаунт мониторинга `pod-watcher` видел поды во всех namespace кластера и не получил ничего, кроме этого.', 'Make the monitoring account `pod-watcher` see pods in every namespace of the cluster and get nothing besides.'),
          check: {
            when: (f) => ['prod', 'dev', 'default', 'kube-system', 'monitoring'].every((n) => may(f, WATCHER, 'list', 'pods', n)) && !may(f, WATCHER, 'delete', 'pods', 'prod') && !may(f, WATCHER, 'get', 'secrets', 'prod') && !may(f, WATCHER, 'list', 'configmaps', 'prod'),
            fail: [
              { if: (f) => may(f, WATCHER, 'delete', 'pods', 'prod') || may(f, WATCHER, 'get', 'secrets', 'prod') || may(f, WATCHER, 'list', 'configmaps', 'prod'), say: bi('Аккаунт получил больше, чем видеть поды: так бывает, когда выдают готовую роль view, edit или cluster-admin. Выдайте кластерную роль `pod-lister`, которую коллега уже написал.', 'The account got more than seeing pods: that happens when the ready role view, edit or cluster-admin is granted. Grant the cluster role `pod-lister` the colleague has already written.') },
              { if: (f) => may(f, WATCHER, 'list', 'pods', 'monitoring') && !may(f, WATCHER, 'list', 'pods', 'prod'), say: bi('Аккаунт видит поды только в monitoring. ClusterRole `pod-lister` выдана привязкой RoleBinding, а она ограничивает любую роль своим namespace. Для всего кластера нужна ClusterRoleBinding.', 'The account sees pods only in monitoring. ClusterRole `pod-lister` is granted by a RoleBinding, which limits any role to its namespace. The whole cluster needs a ClusterRoleBinding.') },
            ],
          },
          chips: 'kubectl describe rolebinding pod-watcher -n monitoring',
          concepts: ['k8s.rbac', 'k8s.serviceaccount'],
          hints: {
            H1: bi('Проверьте права аккаунта в двух namespace: `kubectl auth can-i list pods --as=system:serviceaccount:monitoring:pod-watcher -n monitoring` и то же с `-n prod`. Ответы будут разными, и причина в виде привязки.', 'Check the account’s rights in two namespaces: `kubectl auth can-i list pods --as=system:serviceaccount:monitoring:pod-watcher -n monitoring` and the same with `-n prod`. The answers differ, and the cause is the kind of binding.'),
            H2: bi('У привязки нельзя поменять роль или превратить её в кластерную: поле roleRef неизменяемо. Создайте новую привязку другого вида командой `kubectl create clusterrolebinding` с флагами `--clusterrole` и `--serviceaccount`.', 'A binding’s role cannot be changed, nor can it be turned into a cluster one: the roleRef field is immutable. Create a new binding of the other kind with `kubectl create clusterrolebinding` with `--clusterrole` and `--serviceaccount`.'),
            H3: bi('Целиком команда выглядит так: `kubectl create clusterrolebinding pod-watcher --clusterrole=pod-lister --serviceaccount=monitoring:pod-watcher`.', 'The command in full: `kubectl create clusterrolebinding pod-watcher --clusterrole=pod-lister --serviceaccount=monitoring:pod-watcher`.'),
          },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: accessQuiz.filter((q) => q.id !== 'k8s.q.acc.parts').map((q) => q.id) },
  ],
};

