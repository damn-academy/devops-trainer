// KM03 and the operator screen of KM13: Deployment and rolling update; who
// picks the node and who starts the process; the constructor; a node
// failure; an operator as the same loop for your own kind.

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import type { K8sFacts } from '../../../engine/kube-lite/facts';
import { WEBSITE_CRD } from '../../../engine/kube-lite/ui/controller-lab';
import { ARCH_LAB, DEPLOY_HISTORY, DEPLOY_LAB } from '../setups';
import { R, S, src } from '../sources';
import YAML from 'yaml';

// ── KM03: Deployment ─────────────────────────────────────────────────────────

export const deployQuiz: QuizItem[] = [
  {
    id: 'k8s.q.dep.order',
    kind: 'order',
    concepts: ['k8s.deployment', 'k8s.replicaset'],
    prompt: bi('Расставьте по порядку, что происходит после `kubectl apply` нового Deployment.', 'Put in order what happens after `kubectl apply` of a new Deployment.'),
    steps: [
      { id: 'etcd', text: bi('API-сервер сохраняет Deployment в etcd', 'The API server stores the Deployment in etcd') },
      { id: 'rs', text: bi('Контроллер Deployment создаёт ReplicaSet', 'The Deployment controller creates a ReplicaSet'), why: bi('Deployment сам подов не создаёт: он управляет ReplicaSet’ами.', 'A Deployment does not create pods itself: it manages ReplicaSets.') },
      { id: 'pods', text: bi('Контроллер ReplicaSet создаёт поды без узла', 'The ReplicaSet controller creates pods without a node') },
      { id: 'bind', text: bi('Планировщик выбирает узел для каждого пода', 'The scheduler picks a node for every pod') },
      { id: 'run', text: bi('kubelet узла запускает контейнер', 'The kubelet of the node starts the container'), why: bi('Процесс появляется последним: всё до этого — записи в API.', 'The process appears last: everything before is records in the API.') },
    ],
  },
  {
    id: 'k8s.q.dep.surge',
    kind: 'mcq',
    concepts: ['k8s.rolling-update'],
    prompt: bi('replicas: 4, maxSurge: 1, maxUnavailable: 0. Сколько подов будет готово в худший момент выкатки?', 'replicas: 4, maxSurge: 1, maxUnavailable: 0. How many pods are available at the worst moment of the rollout?'),
    options: [
      { id: '4', text: bi('4 — ни одного меньше желаемого', '4 — not one fewer than desired'), correct: true },
      { id: '3', text: bi('3', '3'), why: bi('Это было бы при maxUnavailable: 1. При нуле старый под уходит только после того, как новый стал готов.', 'That would be maxUnavailable: 1. With zero an old pod goes only after a new one is ready.') },
      { id: '5', text: bi('5', '5'), why: bi('Пять подов будет существовать (4 + maxSurge 1), но пятый — новый и ещё не готов.', 'Five pods will exist (4 + maxSurge 1), but the fifth is new and not ready yet.') },
    ],
    refs: { explainer: 'k8s.rolling' },
  },
  {
    id: 'k8s.q.dep.deadline',
    kind: 'mcq',
    concepts: ['k8s.deployment'],
    prompt: bi('Новые поды падают, выкатка висит 10 минут. Что сделает Kubernetes, когда истечёт progressDeadlineSeconds?', 'The new pods crash and the rollout hangs for 10 minutes. What does Kubernetes do when progressDeadlineSeconds runs out?'),
    options: [
      { id: 'signal', text: bi('Поставит условие Progressing=False с причиной ProgressDeadlineExceeded — и всё', 'Set the condition Progressing=False with reason ProgressDeadlineExceeded — and that is all'), correct: true },
      { id: 'undo', text: bi('Сам откатит Deployment на прошлую ревизию', 'Roll the Deployment back to the previous revision by itself'), why: bi('Автоматического отката нет: условие — сигнал для вас или для CI. Откатывает `kubectl rollout undo`.', 'There is no automatic rollback: the condition is a signal for you or for CI. `kubectl rollout undo` rolls back.') },
      { id: 'delete', text: bi('Удалит новый ReplicaSet', 'Delete the new ReplicaSet'), why: bi('Новый ReplicaSet остаётся; контроллер продолжает попытки.', 'The new ReplicaSet stays; the controller keeps trying.') },
    ],
  },
  {
    id: 'k8s.q.dep.undo',
    kind: 'fill-command',
    concepts: ['k8s.revision'],
    prompt: bi('Верните Deployment `web` к ревизии 1.', 'Return Deployment `web` to revision 1.'),
    template: 'kubectl rollout undo deployment/web ___',
    answers: ['kubectl rollout undo deployment/web --to-revision=1', 'kubectl rollout undo deploy/web --to-revision=1', 'kubectl rollout undo deployment web --to-revision=1'],
    misconceptions: [{ match: '--revision=1', why: bi('--revision у history показывает ревизию, а у undo номер цели задаёт --to-revision.', '--revision of history shows a revision; for undo the target is set by --to-revision.') }],
  },
];

export const deploymentsLesson: Lesson = {
  id: 'k8s-1.deployments',
  block: 'k8s-1',
  title: bi('Deployment и rolling update', 'Deployments and rolling updates'),
  summary: bi('ReplicaSet не умеет менять версию; Deployment умеет — двумя ReplicaSet’ами и по шагам. Ревизии, история и откат.', 'A ReplicaSet cannot change the version; a Deployment can — with two ReplicaSets and in steps. Revisions, history and rollback.'),
  introduces: ['k8s.deployment', 'k8s.rolling-update', 'k8s.revision'],
  uses: ['k8s.replicaset', 'k8s.controller', 'k8s.owner', 'k8s.pod'],
  tier: 'core',
  minutes: 40,
  sources: src([S.deployment, S.replicaset], [R.deployment]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В прошлом уроке вы видели: ReplicaSet считает только количество. Смените в нём образ — живые поды останутся со старым, а новый образ получат только поды, созданные потом. Для выкатки новой версии этого мало: нужно заменить все поды и не уронить сервис. Это делает [[k8s.deployment|Deployment]].',
        'In the previous lesson you saw that a ReplicaSet counts only the number. Change the image in it and live pods keep the old one; only pods created later get the new image. That is not enough for rolling out a new version: every pod has to be replaced without taking the service down. A [[k8s.deployment|Deployment]] does it.',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Два ReplicaSet и границы', 'Two ReplicaSets and the bounds'),
      body: bi(
        'Deployment — хозяин ReplicaSet’ов. На каждый шаблон пода он заводит свой ReplicaSet с хешем шаблона в имени (`web-5d78b9c7f4`). Пока шаблон не меняется, работает один ReplicaSet. Вы меняете образ — появляется новая [[k8s.revision|ревизия]] и второй ReplicaSet, и контроллер Deployment начинает [[k8s.rolling-update|rolling update]]: поднимает новый ReplicaSet и опускает старый по шагам.\n\nШаги ограничены двумя числами. `maxSurge` — сколько подов можно создать сверх `replicas`. `maxUnavailable` — сколько может не работать. По умолчанию оба 25%: при четырёх репликах добавляется не больше одного пода и не готовым может быть не больше одного. Старый под убирается, только когда новый стал готов, — поэтому выкатка идёт со скоростью готовности новых подов. Это та же стратегия, которую в блоке CI/CD вы писали скриптом; здесь её выполняет контроллер.\n\nСтарый ReplicaSet после выкатки не удаляется: он остаётся с `replicas: 0`. Это и есть история — `kubectl rollout history` показывает ревизии, а `kubectl rollout undo` возвращает шаблон старой ревизии, и выкатка идёт в обратную сторону.',
        'A Deployment owns ReplicaSets. For every pod template it keeps a ReplicaSet with the template hash in its name (`web-5d78b9c7f4`). While the template does not change, one ReplicaSet works. You change the image — a new [[k8s.revision|revision]] and a second ReplicaSet appear, and the Deployment controller starts a [[k8s.rolling-update|rolling update]]: it scales the new ReplicaSet up and the old one down in steps.\n\nThe steps are bounded by two numbers. `maxSurge` is how many pods may be created above `replicas`. `maxUnavailable` is how many may be unavailable. Both default to 25%: with four replicas at most one pod is added and at most one may be not ready. An old pod is removed only when a new one is ready — so the rollout goes at the speed at which new pods become ready. It is the same strategy you scripted in the CI/CD block; here a controller runs it.\n\nThe old ReplicaSet is not deleted after the rollout: it stays at `replicas: 0`. That is the history — `kubectl rollout history` lists the revisions, and `kubectl rollout undo` brings back the template of an old revision, and the rollout runs the other way.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.rolling', caption: bi('Двигайте maxSurge и maxUnavailable и следите за счётчиком «минимум за выкатку». Сломайте образ — выкатка встанет.', 'Move maxSurge and maxUnavailable and watch the "minimum during the rollout" counter. Break the image — the rollout gets stuck.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: DEPLOY_LAB,
      intro: bi('`web.yaml` — Deployment на четыре реплики с maxSurge 1 и maxUnavailable 1. `kubectl get rs -w` покажет, как меняются ReplicaSet’ы.', '`web.yaml` is a Deployment of four replicas with maxSurge 1 and maxUnavailable 1. `kubectl get rs -w` shows how the ReplicaSets change.'),
      tasks: [
        {
          id: 'apply',
          prompt: bi('Создайте Deployment из `web.yaml` и дождитесь READY 4/4.', 'Create the Deployment from `web.yaml` and wait for READY 4/4.'),
          check: { when: 'k8s.deployments[ns=default][name=web].ready=4' },
          chips: 'kubectl apply -f web.yaml && kubectl get deploy,rs,pods',
          concepts: ['k8s.deployment'],
          hints: { H1: bi('`kubectl get deploy,rs,pods` покажет все три уровня сразу.', '`kubectl get deploy,rs,pods` shows all three levels at once.') },
        },
        {
          id: 'image',
          prompt: bi('Выкатите `trainer/web:1.1` и дождитесь, пока выкатка закончится.', 'Roll out `trainer/web:1.1` and wait until the rollout finishes.'),
          check: { when: "k8s.deployments[name=web][image='trainer/web:1.1'].available=4 && k8s.objects[kind=ReplicaSet]#>=2" },
          chips: 'kubectl set image deployment/web web=trainer/web:1.1 && kubectl rollout status deployment/web',
          docRef: { page: 'help/kubectl-set-image', anchor: 'EXAMPLES', line: 'kubectl set image deployment/nginx busybox=busybox nginx=nginx:1.9.1' },
          concepts: ['k8s.rolling-update'],
          hints: { H1: bi('Образ контейнера меняет kubectl set image; ход выкатки показывает kubectl rollout status.', 'kubectl set image changes the container image; kubectl rollout status shows the progress.'), H2: bi('Формат: `kubectl set image deployment/<имя> <контейнер>=<образ>`.', 'The format: `kubectl set image deployment/<name> <container>=<image>`.') },
        },
        {
          id: 'broken',
          prompt: bi('Выкатите сломанный `trainer/web:2.0` и посмотрите, что стало со старыми подами и с выкаткой.', 'Roll out the broken `trainer/web:2.0` and see what happened to the old pods and to the rollout.'),
          check: { when: "k8s.deployments[name=web][image='trainer/web:2.0']#=1 && k8s.deployments[name=web].available>=3" },
          chips: 'kubectl set image deployment/web web=trainer/web:2.0 && kubectl get pods',
          hints: { H1: bi('Та же команда, другой тег. Затем `kubectl get pods`: часть подов старые и готовые, новые — падают.', 'The same command, another tag. Then `kubectl get pods`: some pods are old and ready, the new ones crash.') },
        },
        {
          id: 'undo',
          prompt: bi('Найдите в справке `kubectl rollout undo`, как откатить на конкретную ревизию, и верните Deployment к ревизии 2 (образ 1.1).', 'Find in the `kubectl rollout undo` help how to roll back to a specific revision, and bring the Deployment back to revision 2 (image 1.1).'),
          check: {
            // Revision 2 (1.1) brought back after the broken revision 3 becomes revision 4.
            when: (f) => {
              const k = f.k8s as K8sFacts;
              const d = k.deployments.find((x) => x.ns === 'default' && x.name === 'web');
              const revs = k.objects.filter((o) => o.kind === 'ReplicaSet').map((o) => Number(o.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? 0));
              return !!d && d.image === 'trainer/web:1.1' && d.available === 4 && Math.max(0, ...revs) >= 4;
            },
            fail: [{ if: "k8s.deployments[name=web][image='trainer/web:1.0']#=1", say: bi('Это ревизия 1 (образ 1.0). Нужна ревизия 2 — номер можно задать явно.', 'That is revision 1 (image 1.0). Revision 2 is needed — the number can be given explicitly.') }] },
          chips: 'kubectl rollout undo deployment/web --to-revision=2',
          docRef: { page: 'help/kubectl-rollout-undo', anchor: 'EXAMPLES', line: '--to-revision=3' },
          docStep: 3,
          concepts: ['k8s.revision'],
          hints: { H1: bi('Номера ревизий покажет `kubectl rollout history deployment/web`.', '`kubectl rollout history deployment/web` shows the revision numbers.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('У справки kubectl своя анатомия: примеры стоят до флагов, а шаблон вызова — в самом конце. Где в `kubectl rollout undo --help` готовые команды, которые можно взять почти как есть?', 'kubectl help has its own anatomy: the examples come before the flags, and the call template is at the very end. Where in `kubectl rollout undo --help` are ready commands you can take almost as they are?'),
      ref: { page: 'help/kubectl-rollout-undo' },
      answer: 'EXAMPLES',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Настройте Deployment `web` так, чтобы зависшая выкатка объявлялась проваленной уже через 60 секунд, а не через 10 минут. В уроке этого не было — найдите поле сами.', 'Configure Deployment `web` so that a stuck rollout is declared failed after 60 seconds instead of 10 minutes. The lesson did not cover it — find the field yourself.'),
      ref: { page: 'explain/deployment.spec' },
      terminal: {
        setup: DEPLOY_HISTORY,
        task: {
          id: 'deadline',
          prompt: bi('Зависшая выкатка `web` объявляется проваленной через 60 секунд.', 'A stuck rollout of `web` is declared failed after 60 seconds.'),
          check: { when: 'k8s.objects[kind=Deployment][metadata.name=web].spec.progressDeadlineSeconds=60' },
          docStep: 4,
          beyond: true,
          solutionTokens: ['progressDeadlineSeconds', 'kubectl patch'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: deployQuiz.map((q) => q.id) },
  ],
};

// ── KM03: who picks the node, who starts the process ─────────────────────────

export const archQuiz: QuizItem[] = [
  {
    id: 'k8s.q.arch.symptom',
    kind: 'match',
    concepts: ['k8s.control-plane'],
    prompt: bi('Сопоставьте симптом и компонент, которого нет.', 'Match the symptom with the component that is missing.'),
    pairs: [
      { id: 'sched', left: bi('Поды Pending, событий нет вовсе', 'Pods Pending with no events at all'), right: 'kube-scheduler' },
      { id: 'api', left: 'The connection to the server 127.0.0.1:6443 was refused', right: 'kube-apiserver' },
      { id: 'cm', left: bi('Deployment есть, ReplicaSet нет, READY 0/3', 'The Deployment exists, no ReplicaSet, READY 0/3'), right: 'kube-controller-manager' },
      { id: 'cni', left: 'cni plugin not initialized', right: 'CNI' },
    ],
  },
  {
    id: 'k8s.q.arch.label',
    kind: 'label',
    concepts: ['k8s.control-plane', 'k8s.kubelet'],
    prompt: bi('Подпишите схему: кто с кем разговаривает.', 'Label the diagram: who talks to whom.'),
    diagram: {
      width: 600,
      height: 200,
      slots: [
        { id: 's1', x: 225, y: 20, w: 150, h: 50, answer: 'api', family: 'cp' },
        { id: 's2', x: 430, y: 20, w: 150, h: 50, answer: 'etcd', family: 'store' },
        { id: 's3', x: 20, y: 20, w: 150, h: 50, answer: 'sched', family: 'cp' },
        { id: 's4', x: 225, y: 130, w: 150, h: 50, answer: 'kubelet', family: 'node' },
        { id: 's5', x: 430, y: 130, w: 150, h: 50, answer: 'runtime', family: 'process' },
      ],
      edges: [
        { from: 's3', to: 's1' },
        { from: 's1', to: 's2' },
        { from: 's4', to: 's1' },
        { from: 's4', to: 's5' },
      ],
    },
    labels: [
      { id: 'api', text: 'kube-apiserver' },
      { id: 'etcd', text: 'etcd' },
      { id: 'sched', text: 'kube-scheduler' },
      { id: 'kubelet', text: 'kubelet' },
      { id: 'runtime', text: 'containerd' },
      { id: 'proxy', text: 'kube-proxy', why: bi('kube-proxy не говорит с рантаймом: он пишет правила сети ядра узла.', 'kube-proxy does not talk to the runtime: it writes the node kernel’s network rules.') },
    ],
  },
  {
    id: 'k8s.q.arch.etcd',
    kind: 'mcq',
    concepts: ['k8s.scheduler'],
    prompt: bi('Планировщик выбрал узел для пода. Как он сообщает о выборе?', 'The scheduler picked a node for a pod. How does it report the choice?'),
    options: [
      { id: 'binding', text: bi('Пишет Binding через API-сервер; у пода появляется nodeName', 'It writes a Binding through the API server; the pod gets nodeName'), correct: true },
      { id: 'etcd', text: bi('Записывает узел прямо в etcd', 'It writes the node straight into etcd'), why: bi('В etcd ходит только API-сервер.', 'Only the API server talks to etcd.') },
      { id: 'kubelet', text: bi('Отправляет kubelet’у команду «запусти»', 'It sends the kubelet a "start it" command'), why: bi('Планировщик ни с кем, кроме API, не говорит: kubelet сам видит, что под назначен на его узел.', 'The scheduler talks to nobody but the API: the kubelet itself sees that the pod is assigned to its node.') },
    ],
  },
  {
    id: 'k8s.q.arch.node',
    kind: 'mcq',
    concepts: ['k8s.kubelet', 'k8s.node'],
    prompt: bi('У узла выключили питание. Через сколько, по умолчанию, его поды начнут создаваться на других узлах?', 'A node lost power. By default, how soon do its pods start being created on other nodes?'),
    options: [
      { id: '350', text: bi('Около 50 + 300 секунд: grace period узла, затем tolerationSeconds пода', 'About 50 + 300 seconds: the node grace period, then the pod tolerationSeconds'), correct: true },
      { id: 'now', text: bi('Сразу', 'At once'), why: bi('Никто не получает сигнал «узел умер»: молчание Lease замечают только через grace period.', 'Nobody gets a "node died" signal: the silence of the Lease is noticed only after the grace period.') },
      { id: 'never', text: bi('Никогда, пока узел не вернётся', 'Never, until the node comes back'), why: bi('Это верно для StatefulSet (два одинаковых пода нельзя), но не для Deployment.', 'That is true for a StatefulSet (two identical pods are not allowed), but not for a Deployment.') },
    ],
    refs: { explainer: 'k8s.node-down' },
  },
];

export const architectureLesson: Lesson = {
  id: 'k8s-1.architecture',
  block: 'k8s-1',
  title: bi('Кто выбрал узел и кто запустил процесс', 'Who picked the node and who started the process'),
  summary: bi('Планировщик, kubelet и CRI, песочница пода, control plane целиком — Kubernetes из блоков и путь kubectl apply через все компоненты; что происходит, когда узел падает.', 'The scheduler, the kubelet and CRI, the pod sandbox, the whole control plane — Kubernetes from blocks and the path of kubectl apply through every component; what happens when a node goes down.'),
  introduces: ['k8s.scheduler', 'k8s.kubelet', 'k8s.cri', 'k8s.sandbox', 'k8s.control-plane'],
  uses: ['k8s.deployment', 'k8s.replicaset', 'k8s.apiserver', 'k8s.etcd', 'k8s.watch', 'k8s.node'],
  tier: 'core',
  minutes: 45,
  sources: src([S.components, S.scheduler, S.nodes, S.cri], [R.components, R.nodes]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы уже создавали поды десятками, и каждый раз они оказывались на каком-то узле и в каком-то процессе. Кто выбрал узел? Кто запустил процесс? API-сервер только хранит объекты, контроллер ReplicaSet только создаёт записи о подах. Нужны ещё двое.',
        'You have created dozens of pods by now, and each time they ended up on some node as some process. Who chose the node? Who started the process? The API server only stores objects, the ReplicaSet controller only creates pod records. Two more are needed.',
      ),
    },
    {
      id: 'scheduler',
      kind: 'text',
      step: 'explain',
      title: bi('Планировщик выбирает узел', 'The scheduler picks a node'),
      body: bi(
        '[[k8s.scheduler|Планировщик]] (kube-scheduler) смотрит поды, у которых пустое `spec.nodeName`, и для каждого делает два шага. Фильтры отсеивают узлы, куда под нельзя: не хватает ресурсов, не подходят метки, на узле запрет (taint). Оценка выбирает лучший из оставшихся — например, тот, где после этого пода останется больше свободного. Выбор записывается объектом Binding, и у пода появляется `nodeName`.\n\nВажно, по чему считаются ресурсы: по тому, сколько под **попросил** (`resources.requests`), а не по тому, сколько он сейчас ест. Если ни один узел не подходит, под остаётся Pending, а в его событиях появляется FailedScheduling с причиной от каждого фильтра: `0/3 nodes are available: 3 Insufficient memory.`',
        'The [[k8s.scheduler|scheduler]] (kube-scheduler) watches pods with an empty `spec.nodeName` and takes two steps for each. Filters drop the nodes where the pod may not go: not enough resources, labels do not match, a ban on the node (a taint). Scoring picks the best of the rest — for example, the one with the most free room left after this pod. The choice is written as a Binding object, and the pod gets a `nodeName`.\n\nWhat resources are counted by matters: by what the pod **asked for** (`resources.requests`), not by what it uses right now. If no node fits, the pod stays Pending, and its events show FailedScheduling with a reason from every filter: `0/3 nodes are available: 3 Insufficient memory.`',
      ),
    },
    { id: 'look-sched', kind: 'explainer', step: 'look', explainer: 'k8s.scheduler', caption: bi('Поднимите requests.memory выше, чем есть на узлах, и посмотрите на сообщение FailedScheduling.', 'Raise requests.memory above what the nodes have and look at the FailedScheduling message.') },
    {
      id: 'kubelet',
      kind: 'text',
      step: 'explain',
      title: bi('kubelet запускает процесс', 'The kubelet starts the process'),
      body: bi(
        'На каждом узле работает [[k8s.kubelet|kubelet]] — агент, который смотрит поды, назначенные своему узлу. Увидев новый, он сам контейнер не создаёт: он просит container runtime — тот же containerd, что в блоке о контейнерах стоял под Docker, — по протоколу [[k8s.cri|CRI]] (gRPC). Сначала создаётся [[k8s.sandbox|песочница пода]]: крошечный процесс `pause`, который держит сетевое и IPC-пространства имён пода. Рантайм вызывает сетевой плагин, и песочница получает IP. Затем в эти пространства запускаются контейнеры из образов. Поэтому у всех контейнеров пода один IP: они живут в namespace, которым владеет pause.\n\nПотом kubelet гоняет пробы, пишет в `status` фазу и готовность и раз в 10 секунд продлевает Lease узла — своё сердцебиение. Перестанет продлевать — узел через 50 секунд пометят как недоступный.\n\nВместе компоненты называются так: [[k8s.control-plane|control plane]] — kube-apiserver, etcd, kube-scheduler и kube-controller-manager (процесс, в котором живут контроллеры Deployment, ReplicaSet и десятки других) — управляет кластером, а на узлах работают kubelet, container runtime, сетевой плагин и kube-proxy. Ни один компонент control plane ваши контейнеры не запускает.',
        'Every node runs a [[k8s.kubelet|kubelet]] — an agent that watches the pods assigned to its node. When it sees a new one, it does not create the container itself: it asks the container runtime — the same containerd that sat under Docker in the containers block — over the [[k8s.cri|CRI]] protocol (gRPC). First a [[k8s.sandbox|pod sandbox]] is created: a tiny `pause` process that holds the pod’s network and IPC namespaces. The runtime calls the network plugin, and the sandbox gets an IP. Then the containers from the images are started inside these namespaces. That is why all containers of a pod share one IP: they live in namespaces that pause owns.\n\nAfter that the kubelet runs probes, writes the phase and readiness into `status`, and renews the node Lease every 10 seconds — its heartbeat. If it stops renewing, the node is marked unreachable after 50 seconds.\n\nTogether the components are called this: the [[k8s.control-plane|control plane]] — kube-apiserver, etcd, kube-scheduler and kube-controller-manager (the process the Deployment, ReplicaSet and dozens of other controllers live in) — runs the cluster, while the nodes run the kubelet, the container runtime, the network plugin and kube-proxy. No control-plane component runs your containers.',
      ),
    },
    {
      id: 'blocks',
      kind: 'text',
      step: 'try',
      title: bi('Kubernetes из блоков', 'Kubernetes from blocks'),
      body: bi(
        'Соберите кластер сами. Перетащите компоненты на холст — control plane сверху, узлы снизу — и соедините проводами. Провод проходит только там, где связь существует на самом деле; на запрещённый тренажёр ответит, почему его нет. Потом запустите сценарий: кластер поднимется ровно из того, что на холсте. Уберите планировщик, etcd, kube-proxy или CoreDNS и посмотрите на настоящий вывод kubectl такого кластера.',
        'Build a cluster yourself. Drag the components onto the canvas — control plane on top, nodes below — and wire them. A wire goes through only where the link really exists; for a forbidden one the trainer tells you why there is none. Then run a scenario: the cluster starts from exactly what is on the canvas. Remove the scheduler, etcd, kube-proxy or CoreDNS and look at the real kubectl output of such a cluster.',
      ),
    },
    { id: 'constructor', kind: 'widget', step: 'try', widget: 'k8s.constructor' },
    { id: 'look-apply', kind: 'explainer', step: 'look', explainer: 'k8s.apply-path', caption: bi('Весь путь целиком: 14 шагов. Сломайте любой компонент — путь оборвётся на его шаге.', 'The whole path: 14 steps. Break any component — the path stops at its step.') },
    { id: 'look-chain', kind: 'explainer', step: 'look', explainer: 'k8s.loop-chain', caption: bi('Одна команда — четыре петли. Остановите любую из них и посмотрите, где оборвётся волна и что покажет kubectl.', 'One command — four loops. Stop any of them and see where the wave stops and what kubectl shows.') },
    { id: 'look-node', kind: 'explainer', step: 'look', explainer: 'k8s.node-down', caption: bi('Выключите узел и пройдите по виртуальному времени: когда его заметят и когда поды переедут.', 'Turn a node off and walk through virtual time: when it is noticed and when the pods move.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ARCH_LAB,
      intro: bi('В кластере работает Deployment `web` на три реплики. `cluster power off worker-2` выключает узел, `cluster ff 6m` проматывает время.', 'The cluster runs Deployment `web` with three replicas. `cluster power off worker-2` cuts a node’s power, `cluster ff 6m` fast-forwards time.'),
      tasks: [
        {
          id: 'pending',
          prompt: bi('Создайте под из `big.yaml`, выясните, почему он не запускается, и сохраните строку события с причиной в `~/reason.txt`.', 'Create the pod from `big.yaml`, find out why it does not start, and save the event line with the reason to `~/reason.txt`.'),
          check: { when: "files['/home/learner/reason.txt'].text~'Insufficient memory' && k8s.pods[name=big][phase=Pending]#=1" },
          chips: 'kubectl apply -f big.yaml && kubectl describe pod big | grep FailedScheduling > reason.txt',
          concepts: ['k8s.scheduler'],
          docRef: { page: 'help/kubectl-describe', anchor: 'DESCRIPTION' },
          hints: { H1: bi('Причину пишет планировщик в событиях пода.', 'The scheduler writes the reason into the pod’s events.'), H2: bi('describe показывает события; строку отберёт grep, в файл её отправит `>`.', 'describe shows the events; grep picks the line, `>` sends it to the file.') },
        },
        {
          id: 'nodes',
          prompt: bi('Посмотрите узлы с их внутренними адресами и версией рантайма.', 'Look at the nodes with their internal addresses and the runtime version.'),
          check: { stdout: /INTERNAL-IP[\s\S]*CONTAINER-RUNTIME[\s\S]*containerd:\/\// },
          chips: 'kubectl get nodes -o wide',
          hints: { H1: bi('Тот же формат вывода, что для подов.', 'The same output format as for pods.') },
        },
        {
          id: 'failover',
          prompt: bi('Выключите питание `worker-2` и промотайте время, пока все три пода `web` снова не будут готовы на других узлах.', 'Cut the power of `worker-2` and fast-forward until all three `web` pods are ready again on other nodes.'),
          check: {
            when: "k8s.pods[labels.app=web][ready=true][node!=worker-2]#=3 && k8s.nodes[name=worker-2][ready=false]#=1",
            fail: [{ if: "k8s.nodes[name=worker-2][ready=false]#=1", say: bi('Узел уже помечен, но поды ещё ждут tolerationSeconds (300 с). Промотайте ещё: `cluster ff 5m`.', 'The node is marked already, but the pods still wait for tolerationSeconds (300 s). Fast-forward more: `cluster ff 5m`.') }],
          },
          chips: 'cluster power off worker-2 && cluster ff 6m && kubectl get pods -o wide',
          concepts: ['k8s.kubelet'],
          hints: { H1: bi('Узел заметят через 50 с, поды выселят ещё через 300 с.', 'The node is noticed after 50 s, the pods are evicted 300 s later.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: archQuiz.map((q) => q.id) },
  ],
};

// ── KM13 (screen 5b): an operator is the same loop ────────────────────────────

export const operatorQuiz: QuizItem[] = [
  {
    id: 'k8s.q.op.crd',
    kind: 'mcq',
    concepts: ['k8s.crd', 'k8s.operator'],
    prompt: bi('Вы создали CRD `Website` и объект `Website blog`, а оператора нет. Что будет?', 'You created the `Website` CRD and a `Website blog` object, but there is no operator. What happens?'),
    options: [
      { id: 'data', text: bi('Ничего: объект хранится в API, но исполнять его некому', 'Nothing: the object is stored in the API, but nobody executes it'), correct: true },
      { id: 'deploy', text: bi('API-сервер сам создаст Deployment по схеме CRD', 'The API server creates a Deployment from the CRD schema itself'), why: bi('Схема CRD описывает только поля и их проверку. Поведение даёт контроллер.', 'A CRD schema describes only fields and their validation. A controller provides the behaviour.') },
    ],
    explain: bi('Как с Deployment: без controller-manager он — просто запись. Оператор — это контроллер для вашего вида объектов.', 'Like a Deployment: without the controller-manager it is just a record. An operator is a controller for your own kind of object.'),
  },
  {
    id: 'k8s.q.op.owner',
    kind: 'mcq',
    concepts: ['k8s.operator', 'k8s.owner'],
    prompt: bi('Оператор создаёт Deployment с ownerReferences на Website. Что даст удаление Website?', 'The operator creates a Deployment with ownerReferences pointing to the Website. What does deleting the Website do?'),
    options: [
      { id: 'gc', text: bi('Сборщик мусора удалит Deployment, а за ним ReplicaSet и поды', 'The garbage collector deletes the Deployment, and after it the ReplicaSet and the pods'), correct: true },
      { id: 'stay', text: bi('Deployment останется, пока оператор его не удалит', 'The Deployment stays until the operator deletes it'), why: bi('ownerReferences как раз и нужны, чтобы оператору не пришлось убирать за собой: это делает сборщик мусора.', 'ownerReferences are there precisely so that the operator does not have to clean up: the garbage collector does it.') },
    ],
  },
];

export const operatorsLesson: Lesson = {
  id: 'k8s-1.operators',
  block: 'k8s-1',
  tier: 'core',
  title: bi('Оператор — та же петля для своего вида объектов', 'An operator is the same loop for your own kind of object'),
  summary: bi('CustomResourceDefinition добавляет в API новый вид объектов; оператор — контроллер, который делает его правдой. Вы пишете его сами.', 'A CustomResourceDefinition adds a new kind of object to the API; an operator is the controller that makes it true. You write one yourself.'),
  introduces: ['k8s.crd', 'k8s.operator'],
  uses: ['k8s.controller', 'k8s.deployment', 'k8s.owner', 'k8s.api-object'],
  minutes: 30,
  sources: src([S.operator, S.crd, S.controller], [R.controller, R.objects]),
  sections: [
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Свой вид объектов', 'Your own kind of object'),
      body: bi(
        'Deployment, ReplicaSet, Pod — виды объектов, которые API знает изначально. Ему можно объяснить и новый: [[k8s.crd|CustomResourceDefinition]] (CRD) — объект, который говорит API-серверу «теперь есть kind Website, у него поля spec.image и spec.replicas, вот их схема». После этого `kubectl get websites` работает, объекты хранятся в etcd и проверяются по схеме.\n\nНо объект в API сам ничего не делает — это вы видели на Deployment без controller-manager. Поведение даёт [[k8s.operator|оператор]]: контроллер, который смотрит ваши Website и делает их правдой — создаёт Deployment и Service, следит за числом реплик, пишет в status, что получилось. Это та же петля «наблюдать → сравнить → действовать», только желаемое описано вашим видом объекта. Так работают операторы баз данных, сертификатов, очередей: CRD описывает «хочу кластер PostgreSQL на три узла», оператор знает, как это сделать.',
        'Deployment, ReplicaSet, Pod are kinds of objects the API knows from the start. It can be taught a new one: a [[k8s.crd|CustomResourceDefinition]] (CRD) is an object that tells the API server "there is now a kind Website, with fields spec.image and spec.replicas, here is their schema". After that `kubectl get websites` works, the objects are stored in etcd and validated against the schema.\n\nBut an object in the API does nothing by itself — you saw that with a Deployment and no controller-manager. The behaviour comes from an [[k8s.operator|operator]]: a controller that watches your Websites and makes them true — creates a Deployment and a Service, keeps the replica count, writes into status what came out. It is the same "observe → compare → act" loop, only the desired state is described by your own kind of object. Database, certificate and queue operators work like that: a CRD says "I want a PostgreSQL cluster on three nodes", the operator knows how to do it.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'try',
      machine: 'sim',
      setup: {
        hostname: 'laptop',
        files: [
          { path: '~/website-crd.yaml', content: YAML.stringify(WEBSITE_CRD) },
          { path: '~/blog.yaml', content: 'apiVersion: trainer.dev/v1\nkind: Website\nmetadata:\n  name: blog\nspec:\n  image: trainer/web:1.0\n  replicas: 2\n' },
          { path: '~/bad.yaml', content: 'apiVersion: trainer.dev/v1\nkind: Website\nmetadata:\n  name: bad\nspec:\n  image: trainer/web:1.0\n  replicas: 50\n' },
        ],
        ext: { k8s: {} },
      },
      intro: bi('Сначала — без оператора: только CRD и объект.', 'First — without an operator: just the CRD and an object.'),
      tasks: [
        {
          id: 'crd',
          prompt: bi('Научите API виду Website (`website-crd.yaml`) и создайте объект `blog.yaml`. Убедитесь, что `kubectl get websites` его видит — и что подов не появилось.', 'Teach the API the Website kind (`website-crd.yaml`) and create the object `blog.yaml`. Make sure `kubectl get websites` sees it — and that no pods appeared.'),
          check: { when: "k8s.objects[kind=Website][metadata.name=blog]#=1 && k8s.pods[ns=default]#=0" },
          chips: 'kubectl apply -f website-crd.yaml && kubectl apply -f blog.yaml && kubectl get websites',
          concepts: ['k8s.crd'],
          hints: { H1: bi('Сначала CRD, потом объект: до CRD API не знает kind Website.', 'The CRD first, then the object: before the CRD the API does not know the Website kind.') },
        },
        {
          id: 'schema',
          prompt: bi('Попробуйте создать `bad.yaml` (50 реплик) и прочитайте, кто и почему отказал.', 'Try to create `bad.yaml` (50 replicas) and read who refused and why.'),
          check: { stdout: /should be less than or equal to 10/ },
          chips: 'kubectl apply -f bad.yaml',
          hints: { H1: bi('В схеме CRD у replicas есть maximum.', 'The CRD schema has a maximum for replicas.') },
        },
      ],
    },
    {
      id: 'write',
      kind: 'text',
      step: 'practice',
      title: bi('Напишите оператор', 'Write the operator'),
      body: bi(
        'Теперь сделайте Website правдой. Функция `reconcile(site, k)` вызывается для каждого Website: соберите желаемый Deployment, прочитайте существующий, создайте его, если нет, и поправьте реплики, если они разошлись. Потом меняйте реплики кнопкой, удалите Deployment руками — оператор вернёт его — и удалите сам Website: ownerReferences уберут всё остальное.',
        'Now make Website true. The function `reconcile(site, k)` is called for every Website: build the desired Deployment, read the existing one, create it if there is none and fix the replicas if they differ. Then change the replicas with a button, delete the Deployment by hand — the operator brings it back — and delete the Website itself: ownerReferences clean up the rest.',
      ),
    },
    { id: 'operator', kind: 'widget', step: 'practice', widget: 'k8s.controller-lab', props: { exercise: 'website' } },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: operatorQuiz.map((q) => q.id) },
    { id: 'go', kind: 'callout', tone: 'note', step: 'review', body: bi('Настоящие операторы пишут на Go с controller-runtime и kubebuilder: та же функция Reconcile, тот же клиент, плюс очереди, повторы и права. Это пет-проект курса.', 'Real operators are written in Go with controller-runtime and kubebuilder: the same Reconcile function, the same client, plus queues, retries and permissions. That is a pet project of the course.') },
  ],
};
