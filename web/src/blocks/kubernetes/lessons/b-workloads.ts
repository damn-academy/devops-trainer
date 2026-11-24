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
    prompt: bi('Расставьте по порядку, что происходит в кластере после того, как вы выполнили `kubectl apply` для нового Deployment.', 'Put in order what happens after `kubectl apply` of a new Deployment.'),
    steps: [
      { id: 'etcd', text: bi('API-сервер сохраняет Deployment в etcd', 'The API server stores the Deployment in etcd') },
      { id: 'rs', text: bi('Контроллер Deployment создаёт ReplicaSet', 'The Deployment controller creates a ReplicaSet'), why: bi('Deployment сам подов не создаёт, а управляет объектами ReplicaSet, и поды создают уже они.', 'A Deployment does not create pods itself: it manages ReplicaSets.') },
      { id: 'pods', text: bi('Контроллер ReplicaSet создаёт поды, у которых ещё нет узла', 'The ReplicaSet controller creates pods without a node') },
      { id: 'bind', text: bi('Планировщик выбирает узел для каждого пода', 'The scheduler picks a node for every pod'), why: bi('Планировщиком называют компонент, который выбирает для пода узел. Подробно о нём рассказывает следующий урок.', 'The scheduler is the component that picks a node for a pod. The next lesson covers it in detail.') },
      { id: 'run', text: bi('kubelet на выбранном узле запускает контейнер', 'The kubelet of the node starts the container'), why: bi('kubelet — это агент на каждом узле, который запускает контейнеры назначенных на узел подов, и о нём тоже рассказывает следующий урок. Процесс появляется последним, а всё, что было до него, — только записи в API.', 'The kubelet is the agent on every node that starts the containers of the pods assigned to it; the next lesson covers it too. The process appears last: everything before is records in the API.') },
    ],
  },
  {
    id: 'k8s.q.dep.surge',
    kind: 'mcq',
    concepts: ['k8s.rolling-update'],
    prompt: bi('В Deployment записано replicas: 4, maxSurge: 1 и maxUnavailable: 0. Сколько подов будет готово отвечать в самый неудачный момент выкладки?', 'replicas: 4, maxSurge: 1, maxUnavailable: 0. How many pods are available at the worst moment of the rollout?'),
    options: [
      { id: '4', text: bi('4, то есть ни одного меньше желаемого', '4 — not one fewer than desired'), correct: true },
      { id: '3', text: bi('3', '3'), why: bi('Так было бы при maxUnavailable: 1. При нуле старый под уходит только после того, как новый стал готов.', 'That would be maxUnavailable: 1. With zero an old pod goes only after a new one is ready.') },
      { id: '5', text: bi('5', '5'), why: bi('Пять подов будут существовать одновременно (четыре плюс один по maxSurge), но пятый — новый и ещё не готов.', 'Five pods will exist (4 + maxSurge 1), but the fifth is new and not ready yet.') },
    ],
    refs: { explainer: 'k8s.rolling' },
  },
  {
    id: 'k8s.q.dep.deadline',
    kind: 'mcq',
    concepts: ['k8s.deployment'],
    prompt: bi('Контейнеры новых подов аварийно завершаются после запуска, и выкладка стоит на месте уже десять минут. Что сделает Kubernetes, когда истечёт progressDeadlineSeconds?', 'The new pods crash and the rollout hangs for 10 minutes. What does Kubernetes do when progressDeadlineSeconds runs out?'),
    options: [
      { id: 'signal', text: bi('Поставит у Deployment условие Progressing=False с причиной ProgressDeadlineExceeded, и больше ничего', 'Set the condition Progressing=False with reason ProgressDeadlineExceeded — and that is all'), correct: true },
      { id: 'undo', text: bi('Сам откатит Deployment на прошлую ревизию', 'Roll the Deployment back to the previous revision by itself'), why: bi('Сам Kubernetes выкладку не откатывает, а условие служит только сигналом для вас или для системы сборки. Откатывают выкладку командой `kubectl rollout undo`.', 'There is no automatic rollback: the condition is a signal for you or for CI. `kubectl rollout undo` rolls back.') },
      { id: 'delete', text: bi('Удалит новый ReplicaSet', 'Delete the new ReplicaSet'), why: bi('Новый ReplicaSet остаётся на месте, и контроллер продолжает попытки.', 'The new ReplicaSet stays; the controller keeps trying.') },
    ],
  },
  {
    id: 'k8s.q.dep.undo',
    kind: 'fill-command',
    concepts: ['k8s.revision'],
    prompt: bi('Верните Deployment `web` к ревизии 1.', 'Return Deployment `web` to revision 1.'),
    template: 'kubectl rollout undo deployment/web ___',
    answers: ['kubectl rollout undo deployment/web --to-revision=1', 'kubectl rollout undo deploy/web --to-revision=1', 'kubectl rollout undo deployment web --to-revision=1', 'kubectl rollout undo deployment/web --to-revision 1', 'kubectl rollout undo deploy/web --to-revision 1', 'kubectl rollout undo deployment web --to-revision 1', 'kubectl rollout undo --to-revision=1 deployment/web', 'kubectl rollout undo --to-revision 1 deployment/web'],
    misconceptions: [{ match: '--revision=1', why: bi('У команды history флаг --revision показывает ревизию, а у команды undo номер ревизии, к которой нужно вернуться, задаёт флаг --to-revision.', '--revision of history shows a revision; for undo the target is set by --to-revision.') }],
  },
  {
    id: 'k8s.q.dep.restart',
    kind: 'mcq',
    concepts: ['k8s.deployment', 'k8s.rolling-update', 'k8s.revision'],
    prompt: bi(
      'Чем команда `kubectl rollout restart deployment/web` отличается от `kubectl delete pod web-5d78b9c7f4-x2k9p`, если и после той, и после другой в списке появляются новые поды?',
      'How does `kubectl rollout restart deployment/web` differ from `kubectl delete pod web-5d78b9c7f4-x2k9p`, if after either one new pods appear in the list?',
    ),
    options: [
      { id: 'right', text: bi('Команда restart меняет шаблон пода, появляется новая ревизия, и все поды заменяются постепенно с учётом maxSurge и maxUnavailable, а команда delete убирает один под, и ReplicaSet создаёт ему замену по тому же шаблону', 'restart changes the pod template, a new revision appears, and all pods are replaced gradually by maxSurge and maxUnavailable, whereas delete removes one pod and the ReplicaSet creates a replacement from the same template'), correct: true },
      { id: 'same', text: bi('Ничем не отличается, потому что обе команды удаляют поды, а ReplicaSet создаёт новые', 'Nothing: both delete pods, and the ReplicaSet creates new ones'), why: bi('Результат похож, но путь разный. restart записывает в шаблон аннотацию `kubectl.kubernetes.io/restartedAt`, поэтому контроллер Deployment заводит новый ReplicaSet и выкладывает его постепенно, а `kubectl rollout history` покажет новую ревизию. После delete ревизия та же, и работает только контроллер ReplicaSet.', 'The result looks alike, the path differs. restart writes the annotation `kubectl.kubernetes.io/restartedAt` into the template, so the Deployment controller creates a new ReplicaSet and rolls it out gradually, and `kubectl rollout history` shows a new revision. After delete the revision is the same, and only the ReplicaSet controller works.') },
      { id: 'node', text: bi('restart перезапускает контейнеры на тех же узлах, а delete переносит под на другой узел', 'restart restarts the containers on the same nodes, whereas delete moves the pod to another node'), why: bi('В обоих случаях появляются новые поды, и узел для каждого заново выбирает планировщик. Контейнеры на месте перезапускает только kubelet, когда процесс в контейнере завершился.', 'Both create new pods, and the scheduler picks a node for each anew. Only the kubelet restarts containers in place, when the process in a container has exited.') },
    ],
  },
];

export const deploymentsLesson: Lesson = {
  id: 'k8s-1.deployments',
  block: 'k8s-1',
  title: bi('Deployment и постепенная выкладка', 'Deployments and rolling updates'),
  summary: bi('ReplicaSet не умеет менять версию подов, а Deployment умеет: он делает это двумя ReplicaSet по шагам. В уроке вы узнаете, как устроена выкладка, что такое ревизии и как откатить неудачную версию.', 'A ReplicaSet cannot change the version; a Deployment can — with two ReplicaSets and in steps. Revisions, history and rollback.'),
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
        'В прошлом уроке вы видели, что ReplicaSet считает только количество подов. Если сменить в нём образ, работающие поды останутся со старым образом, а новый получат только поды, созданные позже. Для выкладки новой версии этого мало: нужно заменить все поды так, чтобы сервис ни на минуту не перестал отвечать. Этим занимается [[k8s.deployment|Deployment]].',
        'In the previous lesson you saw that a ReplicaSet counts only the number. Change the image in it and live pods keep the old one; only pods created later get the new image. That is not enough for rolling out a new version: every pod has to be replaced without taking the service down. A [[k8s.deployment|Deployment]] does it.',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Два ReplicaSet и границы выкладки', 'Two ReplicaSets and the bounds'),
      body: bi(
        'Deployment владеет объектами ReplicaSet и для каждого шаблона пода заводит свой ReplicaSet, в имени которого стоит хеш шаблона, например `web-5d78b9c7f4`. Пока шаблон не меняется, работает один ReplicaSet. Когда вы меняете образ, появляется новая [[k8s.revision|ревизия]] и второй ReplicaSet, и контроллер Deployment начинает [[k8s.rolling-update|постепенную выкладку (rolling update)]]: по шагам добавляет поды новому ReplicaSet и убирает поды у старого.\n\nКаждый шаг ограничен двумя числами. `maxSurge` говорит, сколько подов можно создать сверх `replicas`, а `maxUnavailable` — сколько подов может временно не отвечать. По умолчанию оба равны 25 %, поэтому при четырёх репликах контроллер добавляет не больше одного пода, и неготовым может быть не больше одного пода. Старые поды убираются не быстрее, чем позволяет `maxUnavailable`. При `maxUnavailable: 0` старый под уходит только после того, как новый стал готов, а при `maxUnavailable: 1` контроллер сразу убирает один старый под, не дожидаясь нового. Дальше выкладка идёт со скоростью, с которой новые поды становятся готовыми. Если новые поды не становятся готовыми никогда, например потому что контейнер аварийно завершается сразу после запуска, выкладка останавливается в тот момент, когда убрать ещё один старый под уже нельзя, не нарушив `maxUnavailable`, а старые поды, которые ещё остались, продолжают отвечать пользователям. Похоже работал диспетчер из первого урока, когда утром выкладывал версию 2, только здесь замену ведёт контроллер.\n\nСтарый ReplicaSet после выкладки не удаляется, а остаётся с `replicas: 0`, и в этом и состоит история выкладок. Команда `kubectl rollout history` показывает ревизии, а команда `kubectl rollout undo` возвращает шаблон старой ревизии, и выкладка идёт в обратную сторону.',
        'A Deployment owns ReplicaSets. For every pod template it keeps a ReplicaSet with the template hash in its name (`web-5d78b9c7f4`). While the template does not change, one ReplicaSet works. You change the image — a new [[k8s.revision|revision]] and a second ReplicaSet appear, and the Deployment controller starts a [[k8s.rolling-update|rolling update]]: it scales the new ReplicaSet up and the old one down in steps.\n\nThe steps are bounded by two numbers. `maxSurge` is how many pods may be created above `replicas`. `maxUnavailable` is how many may be unavailable. Both default to 25%: with four replicas at most one pod is added and at most one may be not ready. Old pods are removed no faster than `maxUnavailable` allows. With `maxUnavailable: 0` an old pod goes only after a new one is ready, and with `maxUnavailable: 1` the controller removes one old pod at once without waiting for a new one. From there the rollout goes at the speed at which new pods become ready. If the new pods never become ready, for example because the container crashes right after it starts, the rollout stops as soon as removing one more old pod would break `maxUnavailable`, and the old pods that are still left keep answering users. The dispatcher of the first lesson worked in a similar way when he rolled out version 2 in the morning, only here a controller leads the replacement.\n\nThe old ReplicaSet is not deleted after the rollout: it stays at `replicas: 0`. That is the history — `kubectl rollout history` lists the revisions, and `kubectl rollout undo` brings back the template of an old revision, and the rollout runs the other way.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как Deployment выкладывает новую версию', 'How a Deployment rolls out a new version'),
      body: bi(
        'Схема ниже показывает, что происходит после того, как вы сменили образ в Deployment `web` с версии 1.0 на версию 1.1. Сначала на ней три блока: вверху сам Deployment, слева внизу старый ReplicaSet с четырьмя готовыми подами, а между ними внизу Service, который отправляет на эти поды запросы пользователей. Ваш терминал, контроллер Deployment и новый ReplicaSet появятся, когда до них дойдёт дело. Полоса внизу каждого ReplicaSet показывает, какая доля его подов готова отвечать.',
        'The diagram below shows what happens after you change the image of Deployment `web` from 1.0 to 1.1. At first it has three blocks: the Deployment at the top, the old ReplicaSet with four ready pods at the bottom left, and the Service between them that sends user requests to those pods. Your terminal, the Deployment controller and the new ReplicaSet appear when their turn comes. The bar at the bottom of each ReplicaSet shows the share of its pods that are ready.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.rolling', howto: bi('А дальше листайте кнопкой «Шаг вперёд». На каждом шаге работает один участник: контроллер добавляет подов новому ReplicaSet или убирает их у старого, и карточка на линии показывает, как меняется число подов, либо новые поды становятся готовыми и начинают получать запросы. Под схемой идут счётчики, и главный из них называется «готово в худший момент». Он показывает, сколько подов отвечало пользователям в самый неудачный момент выкладки.\n\nКогда пройдёте выкладку до конца, поменяйте в группе «Границы выкладки» значения maxSurge и maxUnavailable и посмотрите, как меняются число шагов и счётчик. Потом переключите способ замены на Recreate. Напоследок включите в блоке «Сломать» образ, контейнер из которого аварийно завершается сразу после запуска, и посмотрите, на каком шаге выкладка застрянет и что станет со старыми подами.', 'Then go on with “Step forward”. At every step one participant works: the controller scales a ReplicaSet up or down, and the card on the line shows how the count changes, or new pods become ready and start getting requests. Counters run under the diagram, and the main one is “ready at the worst moment”.\n\nOnce through, change maxSurge and maxUnavailable in “Rollout bounds” and watch the number of steps and the counter. Then switch the strategy to Recreate. Finally, switch on the crashing image in “Break it” and see where the rollout gets stuck and what happens to the old pods.'), caption: bi('Счётчик «готово в худший момент» показывает то же, что вы увидите в лабораторной работе командой `kubectl get rs -w`: сколько подов отвечало пользователям в самый неудачный момент. Когда будете выкладывать сломанный образ, вспомните, на каком шаге застряла схема, и проверьте, что старые поды продолжают работать.', 'The counter “ready at the worst moment” shows what you will see in the lab with `kubectl get rs -w`: how many pods answered users at the worst moment. When you roll out the broken image, recall the step where the diagram got stuck, and check that the old pods really keep working.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: DEPLOY_LAB,
      intro: bi('В файле `web.yaml` описан Deployment на четыре реплики с maxSurge 1 и maxUnavailable 1, проверкой готовности и полем `minReadySeconds: 10`. Это поле просит контроллер считать новый под доступным, только когда тот пробыл готовым десять секунд подряд. Так под, который на мгновение ответил и сразу аварийно завершился, не даст контроллеру убрать ещё один старый под, и в рабочих кластерах это поле ставят как раз поэтому. Команда `kubectl get rs -w` будет показывать, как меняются ReplicaSet во время выкладки.', '`web.yaml` is a Deployment of four replicas with maxSurge 1 and maxUnavailable 1, a readiness probe and `minReadySeconds: 10`. This field asks the controller to count a new pod as available only after it has stayed ready for ten seconds in a row. So a pod that answered for a moment and then crashed does not let the controller remove one more old pod, and production clusters set the field for exactly this reason. `kubectl get rs -w` shows how the ReplicaSets change during the rollout.'),
      tasks: [
        {
          id: 'apply',
          prompt: bi('Создайте Deployment из файла `web.yaml` и дождитесь, пока в столбце READY будет 4/4.', 'Create the Deployment from `web.yaml` and wait for READY 4/4.'),
          check: { when: 'k8s.deployments[ns=default][name=web].ready=4' },
          chips: 'kubectl apply -f web.yaml && kubectl get deploy,rs,pods',
          concepts: ['k8s.deployment'],
          hints: { H1: bi('Команда `kubectl get deploy,rs,pods` покажет все три уровня сразу.', '`kubectl get deploy,rs,pods` shows all three levels at once.') },
        },
        {
          id: 'image',
          prompt: bi('Выложите новую версию с образом `trainer/web:1.1` и дождитесь, пока выкладка закончится.', 'Roll out `trainer/web:1.1` and wait until the rollout finishes.'),
          check: { when: "k8s.deployments[name=web][image='trainer/web:1.1'].available=4 && k8s.objects[kind=ReplicaSet]#>=2" },
          chips: 'kubectl set image deployment/web web=trainer/web:1.1 && kubectl rollout status deployment/web',
          docRef: { page: 'help/kubectl-set-image', anchor: 'EXAMPLES', line: 'kubectl set image deployment/nginx busybox=busybox nginx=nginx:1.9.1' },
          concepts: ['k8s.rolling-update'],
          hints: { H1: bi('Образ контейнера меняет команда kubectl set image, а ход выкладки показывает команда kubectl rollout status.', 'kubectl set image changes the container image; kubectl rollout status shows the progress.'), H2: bi('Команда записывается так: `kubectl set image deployment/<имя> <контейнер>=<образ>`.', 'The format: `kubectl set image deployment/<name> <container>=<image>`.') },
        },
        {
          id: 'broken',
          prompt: bi('Выложите версию со сломанным образом `trainer/web:2.0` и посмотрите, что стало со старыми подами и с самой выкладкой.', 'Roll out the broken `trainer/web:2.0` and see what happened to the old pods and to the rollout.'),
          check: { when: "k8s.deployments[name=web][image='trainer/web:2.0']#=1 && k8s.deployments[name=web].available>=3" },
          chips: 'kubectl set image deployment/web web=trainer/web:2.0 && kubectl get pods',
          hints: { H1: bi('Команда та же, меняется только тег. Потом выполните `kubectl get rs,pods`: у старого ReplicaSet остаются три готовых пода, у нового два пода, контейнеры которых раз за разом аварийно завершаются, и выкладка стоит, как на схеме.', 'The same command, another tag. Then `kubectl get rs,pods`: the old ReplicaSet keeps three ready pods, the new one has two pods whose containers crash again and again, and the rollout stands still, as in the diagram.') },
        },
        {
          id: 'undo',
          prompt: bi('Найдите в справке `kubectl rollout undo`, как откатиться на конкретную ревизию, и верните Deployment к ревизии 2 с образом 1.1.', 'Find in the `kubectl rollout undo` help how to roll back to a specific revision, and bring the Deployment back to revision 2 (image 1.1).'),
          check: {
            // Revision 2 (1.1) brought back after the broken revision 3 becomes revision 4.
            when: (f) => {
              const k = f.k8s as K8sFacts;
              const d = k.deployments.find((x) => x.ns === 'default' && x.name === 'web');
              const revs = k.objects.filter((o) => o.kind === 'ReplicaSet').map((o) => Number(o.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? 0));
              return !!d && d.image === 'trainer/web:1.1' && d.available === 4 && Math.max(0, ...revs) >= 4;
            },
            fail: [{ if: "k8s.deployments[name=web][image='trainer/web:1.0']#=1", say: bi('Сейчас Deployment на ревизии 1 с образом 1.0, а нужна ревизия 2. Номер ревизии можно указать в команде явно.', 'That is revision 1 (image 1.0). Revision 2 is needed — the number can be given explicitly.') }] },
          chips: 'kubectl rollout undo deployment/web --to-revision=2',
          docRef: { page: 'help/kubectl-rollout-undo', anchor: 'EXAMPLES', line: '--to-revision=3' },
          docStep: 3,
          concepts: ['k8s.revision'],
          hints: { H1: bi('Номера ревизий покажет команда `kubectl rollout history deployment/web`.', '`kubectl rollout history deployment/web` shows the revision numbers.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Справка kubectl устроена по-своему, и примеры в ней стоят перед флагами, а шаблон вызова — в самом конце. В каком разделе `kubectl rollout undo --help` лежат готовые команды, которые можно взять почти без изменений?', 'kubectl help has its own anatomy: the examples come before the flags, and the call template is at the very end. Where in `kubectl rollout undo --help` are ready commands you can take almost as they are?'),
      ref: { page: 'help/kubectl-rollout-undo' },
      answer: 'EXAMPLES',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Настройте Deployment `web` так, чтобы зависшая выкладка объявлялась проваленной через 60 секунд, а не через 10 минут. В уроке этого поля не было, найдите его сами.', 'Configure Deployment `web` so that a stuck rollout is declared failed after 60 seconds instead of 10 minutes. The lesson did not cover it — find the field yourself.'),
      ref: { page: 'explain/deployment.spec' },
      terminal: {
        setup: DEPLOY_HISTORY,
        task: {
          id: 'deadline',
          prompt: bi('Сделайте так, чтобы зависшая выкладка Deployment `web` объявлялась проваленной через 60 секунд.', 'A stuck rollout of `web` is declared failed after 60 seconds.'),
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
    prompt: bi('Сопоставьте симптом с компонентом, которого в кластере нет.', 'Match the symptom with the component that is missing.'),
    pairs: [
      { id: 'sched', left: bi('Поды в состоянии Pending, и событий о них нет вовсе', 'Pods Pending with no events at all'), right: 'kube-scheduler' },
      { id: 'api', left: 'The connection to the server 127.0.0.1:6443 was refused', right: 'kube-apiserver' },
      { id: 'cm', left: bi('Deployment есть, ReplicaSet нет, READY 0/3', 'The Deployment exists, no ReplicaSet, READY 0/3'), right: 'kube-controller-manager' },
      { id: 'cni', left: 'cni plugin not initialized', right: 'CNI' },
    ],
  },
  {
    id: 'k8s.q.arch.label',
    kind: 'label',
    concepts: ['k8s.control-plane', 'k8s.kubelet'],
    prompt: bi('Подпишите схему, чтобы было видно, какие компоненты обмениваются запросами друг с другом. Оба крайних блока верхнего ряда разговаривают только с API-сервером, поэтому различает их цвет: блок справа окрашен иначе, чем два других блока верхнего ряда, потому что в нём стоит хранилище.', 'Label the diagram: who talks to whom. Both outer blocks of the top row talk only to the API server, so the colour tells them apart: the block on the right is coloured differently from the other two blocks of the top row, because it holds the storage.'),
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
      { id: 'proxy', text: 'kube-proxy', why: bi('kube-proxy не обращается к среде запуска контейнеров: он пишет правила сети в ядре узла.', 'kube-proxy does not talk to the runtime: it writes the node kernel’s network rules.') },
    ],
  },
  {
    id: 'k8s.q.arch.etcd',
    kind: 'mcq',
    concepts: ['k8s.scheduler'],
    prompt: bi('Планировщик выбрал узел для пода. Как он сообщает о своём выборе?', 'The scheduler picked a node for a pod. How does it report the choice?'),
    options: [
      { id: 'binding', text: bi('Записывает привязку (Binding) через API-сервер, и у пода появляется nodeName', 'It writes a Binding through the API server; the pod gets nodeName'), correct: true },
      { id: 'etcd', text: bi('Записывает узел прямо в etcd', 'It writes the node straight into etcd'), why: bi('К etcd обращается только API-сервер.', 'Only the API server talks to etcd.') },
      { id: 'kubelet', text: bi('Отправляет kubelet команду «запусти под»', 'It sends the kubelet a "start it" command'), why: bi('Планировщик ни с кем, кроме API-сервера, не обменивается запросами: kubelet сам видит, что под назначен на его узел.', 'The scheduler talks to nobody but the API: the kubelet itself sees that the pod is assigned to its node.') },
    ],
  },
  {
    id: 'k8s.q.arch.node',
    kind: 'mcq',
    concepts: ['k8s.kubelet', 'k8s.node'],
    prompt: bi('У узла выключилось питание. Через какое время, если ничего не настраивать, поды с этого узла начнут создаваться на других узлах?', 'A node lost power. By default, how soon do its pods start being created on other nodes?'),
    options: [
      { id: '350', text: bi('Примерно через 50 + 300 секунд, потому что сначала истекает срок ожидания узла, а потом tolerationSeconds пода', 'About 50 + 300 seconds: the node grace period, then the pod tolerationSeconds'), correct: true },
      { id: 'now', text: bi('Сразу', 'At once'), why: bi('Сигнала «узел выключился» никто не получает, и молчание узла замечают, только когда истечёт срок ожидания.', 'Nobody gets a "node died" signal: the silence of the Lease is noticed only after the grace period.') },
      { id: 'never', text: bi('Никогда, пока узел не вернётся', 'Never, until the node comes back'), why: bi('Так ведёт себя StatefulSet, которому нельзя запускать два одинаковых пода, но не Deployment.', 'That is true for a StatefulSet (two identical pods are not allowed), but not for a Deployment.') },
    ],
    refs: { explainer: 'k8s.node-down' },
  },
];

export const architectureLesson: Lesson = {
  id: 'k8s-1.architecture',
  block: 'k8s-1',
  title: bi('Кто выбирает узел и кто запускает процесс', 'Who picked the node and who started the process'),
  summary: bi('Как планировщик выбирает узел, как kubelet через CRI и песочницу пода запускает контейнеры, из чего состоит управляющий слой кластера и какой путь проходит команда kubectl apply через все компоненты. В конце вы увидите, что происходит, когда узел выключается.', 'The scheduler, the kubelet and CRI, the pod sandbox, the whole control plane — Kubernetes from blocks and the path of kubectl apply through every component; what happens when a node goes down.'),
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
        'Вы уже создавали поды десятками, и каждый раз под оказывался на каком-то узле и превращался в какой-то процесс. Кто выбрал узел и кто запустил процесс? API-сервер только хранит объекты, а контроллер ReplicaSet только создаёт записи о подах. Значит, в кластере работают ещё два участника, и о них этот урок. Вопрос «что происходит после `kubectl apply`» почти всегда задают на собеседовании инженеру DevOps, и к концу урока вы сможете ответить на него по шагам.',
        'You have created dozens of pods by now, and each time they ended up on some node as some process. Who chose the node? Who started the process? The API server only stores objects, the ReplicaSet controller only creates pod records. Two more are needed. The question “what happens after `kubectl apply`” is asked in almost every DevOps engineer interview, and by the end of the lesson you will be able to answer it step by step.',
      ),
    },
    {
      id: 'scheduler',
      kind: 'text',
      step: 'explain',
      title: bi('Как планировщик выбирает узел', 'The scheduler picks a node'),
      body: bi(
        '[[k8s.scheduler|Планировщик]] (kube-scheduler) следит за подами, у которых пустое поле `spec.nodeName`, и для каждого из них делает два шага. Сначала фильтры отбрасывают узлы, куда под ставить нельзя: на них не хватает ресурсов, у них не те метки или на узле висит запрет (taint). Потом оценка выбирает лучший из оставшихся узлов, например тот, на котором после этого пода останется больше свободного места. Выбор планировщик записывает объектом Binding, и у пода появляется `nodeName`.\n\nВажно, как считаются ресурсы: по тому, сколько под **попросил** в поле `resources.requests`, а не по тому, сколько он потребляет сейчас. Если не подходит ни один узел, под остаётся в состоянии Pending, а в его событиях появляется FailedScheduling, где перечислены причины от каждого фильтра: `0/3 nodes are available: 3 Insufficient memory.`',
        'The [[k8s.scheduler|scheduler]] (kube-scheduler) watches pods with an empty `spec.nodeName` and takes two steps for each. Filters drop the nodes where the pod may not go: not enough resources, labels do not match, a ban on the node (a taint). Scoring picks the best of the rest — for example, the one with the most free room left after this pod. The choice is written as a Binding object, and the pod gets a `nodeName`.\n\nWhat resources are counted by matters: by what the pod **asked for** (`resources.requests`), not by what it uses right now. If no node fits, the pod stays Pending, and its events show FailedScheduling with a reason from every filter: `0/3 nodes are available: 3 Insufficient memory.`',
      ),
    },
    {
      id: 'look-sched-intro',
      kind: 'text',
      step: 'look',
      title: bi('Что показывает схема планировщика', 'What the scheduler diagram shows'),
      body: bi(
        'Схема ниже показывает, как kube-scheduler ищет узел для нового пода web, который просит 250 миллиядер процессора и 512 МиБ памяти. Сначала на ней три блока: под, очередь планировщика и сам планировщик. Справа появятся три узла кластера, когда планировщик начнёт их проверять, а вверху API-сервер, когда планировщик запишет свой выбор. Под каждым узлом напечатано, сколько ресурсов на нём уже запросили другие поды, а после проверки — почему узел не подошёл или сколько баллов он получил.',
        'The diagram below shows how kube-scheduler finds a node for a new pod web that requests 250m CPU and 512Mi memory. At first it has three blocks: the pod, the queue and the scheduler. The three nodes appear when the scheduler checks them, the API server when it writes its choice. Under each node you see what other pods already requested, and after the check why it failed or its score.',
      ),
    },
    { id: 'look-sched', kind: 'explainer', step: 'look', explainer: 'k8s.scheduler', howto: bi('А дальше листайте кнопкой «Шаг вперёд». Подсвечен всегда планировщик, а облачко рядом с ним говорит, чем он занят: проверяет узлы фильтрами, ставит им баллы или записывает выбор. Зелёная рамка у узла означает, что узел подошёл, бледный узел отброшен фильтром.\n\nПотом увеличьте в «Параметрах» запрос памяти так, чтобы под не поместился ни на один узел, и прочитайте сообщение FailedScheduling, которое напишет планировщик. Попробуйте также поставить в очередь несколько подов подряд и посмотрите, на какие узлы они попадут.', 'The scheduler is always highlighted, and its callout says what it is doing. A green outline means the node fits, a pale node was dropped by a filter.\n\nThen raise the memory request in “Parameters” until the pod fits nowhere and read the FailedScheduling message. Also queue several pods and see where they land.'), caption: bi('Сообщение FailedScheduling, которое вы видели на схеме, понадобится в лабораторной работе ниже: под из файла `big.yaml` не запустится, и строку с причиной вы найдёте в выводе `kubectl describe pod big`.', 'The FailedScheduling message you saw in the diagram is needed in the lab below: the pod from `big.yaml` will not start, and you will find the reason line in the output of `kubectl describe pod big`.') },
    {
      id: 'kubelet',
      kind: 'text',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Как kubelet запускает процесс', 'The kubelet starts the process'),
      body: bi(
        'На каждом узле работает [[k8s.kubelet|kubelet]], агент, который следит за подами, назначенными на его узел. Увидев новый под, kubelet не создаёт контейнер сам, а просит об этом среду запуска контейнеров (container runtime) по протоколу [[k8s.cri|CRI]], основанному на gRPC. Это тот же containerd, на который в блоке о контейнерах опирался Docker. Сначала создаётся [[k8s.sandbox|песочница пода]], крошечный процесс `pause`, который держит сетевое пространство имён пода и пространство имён IPC. Среда запуска вызывает сетевой плагин, и песочница получает IP-адрес. Затем в этих пространствах имён запускаются контейнеры из образов. Поэтому у всех контейнеров пода один IP-адрес: они работают в пространствах имён, которыми владеет процесс pause.\n\nДальше kubelet выполняет проверки контейнеров, пишет в `status` пода фазу и готовность и каждые 10 секунд продлевает Lease узла, то есть отметку о том, что узел жив. Если kubelet перестанет её продлевать, через 50 секунд узел пометят как недоступный.\n\nВсе эти компоненты вместе делятся на две части. [[k8s.control-plane|Управляющий слой (control plane)]] — это kube-apiserver, etcd, kube-scheduler и kube-controller-manager, процесс, в котором работают контроллеры Deployment, ReplicaSet и десятки других. Он управляет кластером. А на узлах работают kubelet, среда запуска контейнеров, сетевой плагин и kube-proxy. Ни один компонент управляющего слоя ваши контейнеры не запускает.',
        'Every node runs a [[k8s.kubelet|kubelet]] — an agent that watches the pods assigned to its node. When it sees a new one, it does not create the container itself: it asks the container runtime — the same containerd that sat under Docker in the containers block — over the [[k8s.cri|CRI]] protocol (gRPC). First a [[k8s.sandbox|pod sandbox]] is created: a tiny `pause` process that holds the pod’s network and IPC namespaces. The runtime calls the network plugin, and the sandbox gets an IP. Then the containers from the images are started inside these namespaces. That is why all containers of a pod share one IP: they live in namespaces that pause owns.\n\nAfter that the kubelet runs probes, writes the phase and readiness into `status`, and renews the node Lease every 10 seconds — its heartbeat. If it stops renewing, the node is marked unreachable after 50 seconds.\n\nTogether the components are called this: the [[k8s.control-plane|control plane]] — kube-apiserver, etcd, kube-scheduler and kube-controller-manager (the process the Deployment, ReplicaSet and dozens of other controllers live in) — runs the cluster, while the nodes run the kubelet, the container runtime, the network plugin and kube-proxy. No control-plane component runs your containers.',
      ),
    },
    {
      id: 'kubelet-beginner',
      kind: 'text',
      step: 'explain',
      levels: ['beginner'],
      title: bi('Как kubelet запускает процесс', 'The kubelet starts the process'),
      body: bi(
        'На каждом узле работает [[k8s.kubelet|kubelet]], агент, который следит за подами, назначенными на его узел. Увидев новый под, kubelet не создаёт контейнер сам, а просит об этом среду запуска контейнеров. Это тот же containerd, на который в блоке о контейнерах опирался Docker. Разговаривает kubelet со средой запуска по заранее оговорённым правилам, которые называются [[k8s.cri|CRI]], примерно так же, как kubectl разговаривает с API-сервером по правилам API.\n\nСначала среда запуска создаёт [[k8s.sandbox|песочницу пода]], крошечный процесс `pause`. Он держит сетевое пространство имён пода, то есть сетевой интерфейс и IP-адрес, такие же, какие были у каждого контейнера в блоке о контейнерах. Затем внутри этой песочницы запускаются контейнеры из образов. Поэтому у всех контейнеров пода один IP-адрес.\n\nДальше kubelet следит за контейнерами, пишет в `status` пода, работает ли он и готов ли отвечать, и каждые 10 секунд оставляет в API отметку о том, что узел жив. Если отметки перестают появляться, через 50 секунд узел помечают как недоступный. Хранит эту отметку объект Lease, и под этим именем вы встретите её на схеме в конце урока.\n\nВсе эти компоненты вместе делятся на две части. [[k8s.control-plane|Управляющий слой (control plane)]] состоит из kube-apiserver, etcd, kube-scheduler и kube-controller-manager, процесса, в котором работают контроллеры Deployment, ReplicaSet и десятки других. Он управляет кластером. А на узлах работают kubelet, среда запуска контейнеров, сетевой плагин и kube-proxy. Ни один компонент управляющего слоя ваши контейнеры не запускает.',
        'Every node runs a [[k8s.kubelet|kubelet]], an agent that watches the pods assigned to its node. When it sees a new pod, the kubelet does not create the container itself but asks the container runtime to do it. That is the same containerd that Docker relied on in the containers block. The kubelet talks to the runtime by agreed rules called [[k8s.cri|CRI]], much as kubectl talks to the API server by the rules of the API.\n\nFirst the runtime creates a [[k8s.sandbox|pod sandbox]], a tiny `pause` process. It holds the pod’s network namespace, that is, the network interface and IP address that each container had in the containers block. Then the containers from the images are started inside this sandbox. That is why all containers of a pod share one IP address.\n\nAfter that the kubelet watches the containers, writes into the pod `status` whether it runs and is ready to answer, and every 10 seconds leaves a mark in the API that the node is alive. If the marks stop appearing, the node is marked unreachable after 50 seconds. The mark is kept by a Lease object, and you will meet it under this name on the diagram at the end of the lesson.\n\nTogether the components fall into two parts. The [[k8s.control-plane|control plane]] consists of kube-apiserver, etcd, kube-scheduler and kube-controller-manager, the process in which the Deployment, ReplicaSet and dozens of other controllers run. It runs the cluster. The nodes run the kubelet, the container runtime, the network plugin and kube-proxy. No control-plane component starts your containers.',
      ),
    },
    {
      id: 'blocks',
      kind: 'text',
      step: 'try',
      title: bi('Kubernetes из блоков', 'Kubernetes from blocks'),
      body: bi(
        'Соберите кластер сами. Перетащите компоненты на холст, управляющий слой сверху, а узлы снизу, и соедините их проводами. Провод соединится только там, где связь между компонентами существует на самом деле, а если связи нет, тренажёр объяснит почему. Потом запустите сценарий, и кластер заработает в том виде, в каком вы его собрали. Уберите планировщик, etcd, kube-proxy или CoreDNS и посмотрите, что напечатает kubectl в таком кластере.',
        'Build a cluster yourself. Drag the components onto the canvas — control plane on top, nodes below — and wire them. A wire goes through only where the link really exists; for a forbidden one the trainer tells you why there is none. Then run a scenario: the cluster starts from exactly what is on the canvas. Remove the scheduler, etcd, kube-proxy or CoreDNS and look at the real kubectl output of such a cluster.',
      ),
    },
    { id: 'constructor', kind: 'widget', step: 'try', widget: 'k8s.constructor' },
    {
      id: 'look-apply-intro',
      kind: 'text',
      step: 'look',
      title: bi('Путь команды kubectl apply через весь кластер', 'The path of kubectl apply through the cluster'),
      body: bi(
        'Вы собрали кластер из блоков, а теперь посмотрите, как по этим блокам проходит одна команда, `kubectl apply -f web.yaml` с Deployment на три пода. Пунктирная рамка вверху схемы обозначает управляющий слой кластера, а сплошная рамка внизу — узел worker-1. Сначала внутри рамок пусто, а на схеме только kubectl и API-сервер. Остальные компоненты появляются по одному, когда до них доходит путь.',
        'You built a cluster from blocks; now watch one command pass through them: `kubectl apply -f web.yaml` with a Deployment of three pods. The dashed frame at the top is the control plane, the solid frame at the bottom the node worker-1. At first only kubectl and the API server are shown; the rest appear one by one as the path reaches them.',
      ),
    },
    { id: 'look-apply', kind: 'explainer', step: 'look', explainer: 'k8s.apply-path', howto: bi('Листайте кнопкой «Шаг вперёд» или нажмите «Проиграть». На каждом шаге подсвечен один компонент, облачко рядом с ним говорит, что он делает, а по линии к API-серверу движется карточка с тем, что компонент записал: ReplicaSet, поды, узел для пода, состояние Ready. Обратите внимание, что все линии ведут к API-серверу: компоненты не обращаются друг к другу напрямую. Под схемой считаются запросы к API-серверу и записи в etcd.\n\nКогда пройдёте путь до конца, включайте в блоке «Сломать» по одной поломке: остановите etcd, контроллеры, планировщик, kubelet, сеть подов или kube-proxy. Перед каждой поломкой схема спросит, где оборвётся путь, а после покажет настоящее сообщение, по которому такую поломку узнают в жизни.', 'Go on with “Step forward” or “Play”. At every step one component is highlighted, its callout says what it does, and a card travels to the API server with what it wrote. Note that every line leads to the API server: components never talk to each other directly. Under the diagram the API requests and etcd writes are counted.\n\nThen switch on one break at a time in “Break it”. Before each, the diagram asks where the path will stop, and afterwards it shows the real message by which you recognise such a failure.'), caption: bi('Каждый компонент, который вы видели, делал свою часть работы и передавал результат следующему через API-сервер. Поэтому, когда под не запускается, ищите шаг, на котором путь оборвался: под без узла говорит о планировщике, под в ContainerCreating — о среде запуска или сети, под, до которого не доходят запросы, — о kube-proxy.', 'Every component did its part and handed the result to the next one through the API server. So when a pod does not start, look for the step where the path broke: a pod without a node points to the scheduler, a pod in ContainerCreating to the runtime or the network, a pod that requests do not reach to kube-proxy.') },
    {
      id: 'look-chain-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как команда проходит по цепочке петель', 'How a command passes through the chain of loops'),
      body: bi(
        'Предыдущая схема показала компоненты, а эта показывает, почему они срабатывают по очереди. Вы просите пять подов вместо трёх командой `kubectl scale`. Сначала на схеме вы, API-сервер и Deployment web. Дальше по одной появляются четыре петли, каждая вместе с объектом, который она пишет: петля Deployment пишет ReplicaSet, петля ReplicaSet пишет поды, планировщик записывает подам узлы, а kubelet на узлах запускает контейнеры и пишет их состояние.',
        'The previous diagram showed the components; this one shows why they fire one after another. You ask for five pods instead of three with `kubectl scale`. At first the diagram shows you, the API server and Deployment web. Then four loops appear one by one, each with the object it writes.',
      ),
    },
    { id: 'look-chain', kind: 'explainer', step: 'look', explainer: 'k8s.loop-chain', howto: bi('Листайте кнопкой «Шаг вперёд». На каждом шаге работает одна петля, облачко говорит, что она делает, а карточка на линии показывает, что она записала. Подписи «читает» и «пишет» на линиях говорят, какой объект петля читает, а какой меняет.\n\nПотом выберите в «Параметрах» смену образа вместо числа подов и посмотрите, какая петля поведёт себя иначе. Напоследок остановите в блоке «Сломать» одну из петель: волна оборвётся на её шаге, и схема покажет, что в этот момент напечатает kubectl.', 'Go on with “Step forward”. At every step one loop works, the callout says what it does, and the card on the line shows what it wrote. The labels “reads” and “writes” say which object a loop reads and which it changes.\n\nThen choose an image change instead of a new count in “Parameters”, and finally stop one of the loops in “Break it”: the wave stops at its step, and the diagram shows what kubectl prints.'), caption: bi('Сообщения, которые kubectl печатал на каждом обрыве волны, запомните: Pending без событий означает, что не работает планировщик, а Pending с уже назначенным узлом — что не работает kubelet. Следующая схема показывает, как кластер замечает, что узел выключился.', 'Remember the messages kubectl printed at each break of the wave: Pending with no events means the scheduler is down, Pending with a node already assigned means the kubelet is down. The next diagram shows how the cluster notices that a node went down.') },
    {
      id: 'look-node-intro',
      kind: 'text',
      step: 'look',
      title: bi('Что происходит, когда узел выключается', 'What happens when a node goes down'),
      body: bi(
        'Последняя схема урока показывает, как кластер замечает, что узел выключился. Никто не присылает кластеру сообщения «узел пропал»: kubelet перестаёт продлевать отметку о жизни узла, объект Lease, и контроллеры замечают это молчание по таймерам. Сначала на схеме три узла и Lease узла worker-2. Контроллер узлов, API-сервер и контроллер ReplicaSet появятся, когда начнут действовать.',
        'The last diagram of the lesson shows how the cluster notices that a node went down. Nobody sends “the node is gone”: the kubelet just stops renewing the node’s Lease, and controllers notice the silence by timers. At first the diagram shows three nodes and worker-2’s Lease; the controllers and the API server appear when they act.',
      ),
    },
    { id: 'look-node', kind: 'explainer', step: 'look', explainer: 'k8s.node-down', howto: bi('Листайте кнопкой «Шаг вперёд». Каждый шаг здесь соответствует моменту времени, и на шкале под схемой подписано, сколько секунд прошло с выключения. Красная рамка означает, что узел выключен, жёлтая — что кластер уже пометил его недоступным. Счётчик под схемой показывает, сколько запросов за это время ушло на выключенный узел и пропало.\n\nПотом выберите в «Параметрах», когда узел снова включат, и посмотрите, успеют ли поды переехать. Напоследок поменяйте таймеры кластера в группе «Таймеры кластера», то есть срок, после которого молчащий узел помечают, и время, которое под ждёт на недоступном узле.', 'Go on with “Step forward”. Each step is a moment in time, labelled on the scale under the diagram. A red outline means the node is off, a yellow one that it is marked unreachable. The counter shows how many requests went to the dead node and were lost.\n\nThen choose in “Parameters” when the node comes back and see whether the pods manage to move. Finally, change the cluster timers in the “Cluster timers” group, that is, the grace period after which a silent node is marked and the time a pod waits on an unreachable node.'), caption: bi('В лабораторной работе ниже вы выключите worker-2 сами командой `cluster power off worker-2` и промотаете время. Сравните, на какой секунде узел станет NotReady и когда поды появятся на других узлах, с тем, что показала схема.', 'In the lab below you turn worker-2 off yourself with `cluster power off worker-2` and fast-forward time. Compare the second at which the node becomes NotReady and when the pods appear elsewhere with what the diagram showed.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ARCH_LAB,
      intro: bi('В кластере работает Deployment `web` на три реплики. Команда `cluster power off worker-2` выключает узел, а команда `cluster ff 6m` проматывает время кластера на шесть минут вперёд.', 'The cluster runs Deployment `web` with three replicas. `cluster power off worker-2` cuts a node’s power, `cluster ff 6m` fast-forwards time.'),
      tasks: [
        {
          id: 'pending',
          prompt: bi('Создайте под из файла `big.yaml`, выясните, почему он не запускается, и сохраните строку события с причиной в файл `~/reason.txt`.', 'Create the pod from `big.yaml`, find out why it does not start, and save the event line with the reason to `~/reason.txt`.'),
          check: { when: "files['/home/learner/reason.txt'].text~'Insufficient memory' && k8s.pods[name=big][phase=Pending]#=1" },
          chips: 'kubectl apply -f big.yaml && kubectl describe pod big | grep FailedScheduling > reason.txt',
          concepts: ['k8s.scheduler'],
          docRef: { page: 'help/kubectl-describe', anchor: 'DESCRIPTION' },
          hints: { H1: bi('Причину планировщик пишет в события пода.', 'The scheduler writes the reason into the pod’s events.'), H2: bi('События показывает команда describe, нужную строку отберёт grep, а в файл её запишет перенаправление `>`.', 'describe shows the events; grep picks the line, `>` sends it to the file.') },
        },
        {
          id: 'nodes',
          prompt: bi('Выведите узлы вместе с их внутренними адресами и версией среды запуска контейнеров.', 'Look at the nodes with their internal addresses and the runtime version.'),
          check: { stdout: /INTERNAL-IP[\s\S]*CONTAINER-RUNTIME[\s\S]*containerd:\/\// },
          chips: 'kubectl get nodes -o wide',
          hints: { H1: bi('Формат вывода тот же, что и для подов.', 'The same output format as for pods.') },
        },
        {
          id: 'failover',
          prompt: bi('Выключите питание `worker-2` и проматывайте время, пока все три пода `web` снова не станут готовыми на других узлах.', 'Cut the power of `worker-2` and fast-forward until all three `web` pods are ready again on other nodes.'),
          check: {
            when: "k8s.pods[labels.app=web][ready=true][node!=worker-2]#=3 && k8s.nodes[name=worker-2][ready=false]#=1",
            fail: [{ if: "k8s.nodes[name=worker-2][ready=false]#=1", say: bi('Узел уже помечен недоступным, но поды ещё ждут, пока истечёт tolerationSeconds, то есть 300 секунд. Промотайте время ещё раз командой `cluster ff 5m`.', 'The node is marked already, but the pods still wait for tolerationSeconds (300 s). Fast-forward more: `cluster ff 5m`.') }],
          },
          chips: 'cluster power off worker-2 && cluster ff 6m && kubectl get pods -o wide',
          concepts: ['k8s.kubelet'],
          hints: { H1: bi('Узел заметят через 50 секунд, а поды выселят ещё через 300 секунд.', 'The node is noticed after 50 s, the pods are evicted 300 s later.') },
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
    prompt: bi('Вы создали CRD `Website` и объект `Website blog`, а оператора в кластере нет. Что произойдёт?', 'You created the `Website` CRD and a `Website blog` object, but there is no operator. What happens?'),
    options: [
      { id: 'data', text: bi('Ничего не произойдёт, потому что объект хранится в API, но исполнять его некому', 'Nothing: the object is stored in the API, but nobody executes it'), correct: true },
      { id: 'deploy', text: bi('API-сервер сам создаст Deployment по схеме CRD', 'The API server creates a Deployment from the CRD schema itself'), why: bi('Схема CRD описывает только поля и правила их проверки, а поведение объекту даёт контроллер.', 'A CRD schema describes only fields and their validation. A controller provides the behaviour.') },
    ],
    explain: bi('С Deployment без controller-manager происходит то же самое, потому что объект остаётся только записью. Оператором называют контроллер, который обслуживает ваш собственный вид объектов.', 'Like a Deployment: without the controller-manager it is just a record. An operator is a controller for your own kind of object.'),
  },
  {
    id: 'k8s.q.op.owner',
    kind: 'mcq',
    concepts: ['k8s.operator', 'k8s.owner'],
    prompt: bi('Оператор создаёт Deployment и записывает в его ownerReferences объект Website. Что произойдёт, если удалить Website?', 'The operator creates a Deployment with ownerReferences pointing to the Website. What does deleting the Website do?'),
    options: [
      { id: 'gc', text: bi('Сборщик мусора удалит Deployment, а вслед за ним ReplicaSet и поды', 'The garbage collector deletes the Deployment, and after it the ReplicaSet and the pods'), correct: true },
      { id: 'stay', text: bi('Deployment останется, пока оператор сам его не удалит', 'The Deployment stays until the operator deletes it'), why: bi('ownerReferences для того и нужны, чтобы оператору не приходилось убирать за собой: это делает сборщик мусора.', 'ownerReferences are there precisely so that the operator does not have to clean up: the garbage collector does it.') },
    ],
  },
];

export const operatorsLesson: Lesson = {
  id: 'k8s-1.operators',
  block: 'k8s-1',
  tier: 'core',
  title: bi('Оператор устроен как та же петля, только для вашего вида объектов', 'An operator is the same loop for your own kind of object'),
  summary: bi('CustomResourceDefinition добавляет в API новый вид объектов, а оператор, то есть контроллер для этого вида, превращает такие объекты в работающие приложения. В уроке вы напишете оператор сами.', 'A CustomResourceDefinition adds a new kind of object to the API; an operator is the controller that makes it true. You write one yourself.'),
  introduces: ['k8s.crd', 'k8s.operator'],
  uses: ['k8s.controller', 'k8s.deployment', 'k8s.owner', 'k8s.api-object'],
  minutes: 30,
  sources: src([S.operator, S.crd, S.controller], [R.controller, R.objects]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Базу данных PostgreSQL в кластере можно запустить обычным Deployment, но тогда всё, что отличает базу от сайта, остаётся на вас: кто из трёх серверов главный, как переключиться на реплику, когда главный сервер пропал, как снимать резервные копии и обновлять версию без потери данных. Поэтому в рабочих кластерах базы, очереди и сертификаты обслуживают операторы. Вы пишете один короткий объект «нужен кластер PostgreSQL на три узла с копией каждую ночь», а программа, которая знает, как это сделать, создаёт всё остальное и чинит его, когда что-то ломается. На собеседовании часто спрашивают, чем оператор отличается от готового набора манифестов, и к концу урока вы ответите: манифесты один раз применяют, а оператор работает постоянно и держит систему в нужном состоянии.',
        'You can run a PostgreSQL database in a cluster as an ordinary Deployment, but then everything that makes a database different from a website stays on you: which of three servers is the primary, how to fail over to a replica when the primary is gone, how to take backups and upgrade the version without losing data. That is why production clusters leave databases, queues and certificates to operators. You write one short object, “a PostgreSQL cluster on three nodes with a backup every night”, and a program that knows how to do it creates everything else and repairs it when something breaks. Interviews often ask how an operator differs from a ready set of manifests, and by the end of the lesson you will answer: manifests are applied once, while an operator keeps running and holds the system in the desired state.',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Свой вид объектов', 'Your own kind of object'),
      body: bi(
        'Deployment, ReplicaSet и Pod — виды объектов, которые API знает с самого начала. Но API можно научить и новому виду. Для этого служит [[k8s.crd|CustomResourceDefinition]] (CRD), объект, который сообщает API-серверу: «теперь есть kind Website, у него есть поля spec.image и spec.replicas, и вот их схема». После этого команда `kubectl get websites` работает, а объекты Website хранятся в etcd и проверяются по схеме.\n\nНо объект в API сам ничего не делает, и вы уже видели это на Deployment без controller-manager. Поведение объекту даёт [[k8s.operator|оператор]], то есть контроллер, который следит за вашими объектами Website и воплощает их: создаёт Deployment и Service, следит за числом реплик и пишет в status, что получилось. Это та же петля «наблюдать, сравнить, действовать», только желаемое описано вашим видом объекта. Так устроены операторы баз данных, сертификатов и очередей: в CRD описано «нужен кластер PostgreSQL на три узла», а оператор знает, как его построить.',
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
      intro: bi('Сначала обойдитесь без оператора и создайте только CRD и сам объект.', 'First — without an operator: just the CRD and an object.'),
      tasks: [
        {
          id: 'crd',
          prompt: bi('Научите API виду Website с помощью файла `website-crd.yaml` и создайте объект из файла `blog.yaml`. Убедитесь, что `kubectl get websites` его показывает и что подов при этом не появилось.', 'Teach the API the Website kind (`website-crd.yaml`) and create the object `blog.yaml`. Make sure `kubectl get websites` sees it — and that no pods appeared.'),
          check: { when: "k8s.objects[kind=Website][metadata.name=blog]#=1 && k8s.pods[ns=default]#=0" },
          chips: 'kubectl apply -f website-crd.yaml && kubectl apply -f blog.yaml && kubectl get websites',
          concepts: ['k8s.crd'],
          hints: { H1: bi('Сначала создайте CRD, а потом объект: пока CRD нет, API ничего не знает о kind Website.', 'The CRD first, then the object: before the CRD the API does not know the Website kind.') },
        },
        {
          id: 'schema',
          prompt: bi('Попробуйте создать объект из файла `bad.yaml` с пятьюдесятью репликами и прочитайте, кто отказал и почему.', 'Try to create `bad.yaml` (50 replicas) and read who refused and why.'),
          check: { stdout: /should be less than or equal to 10/ },
          chips: 'kubectl apply -f bad.yaml',
          hints: { H1: bi('В схеме CRD у поля replicas задан maximum.', 'The CRD schema has a maximum for replicas.') },
        },
      ],
    },
    {
      id: 'write',
      kind: 'text',
      step: 'practice',
      title: bi('Напишите оператор', 'Write the operator'),
      body: bi(
        'Объект Website из лабораторной работы выше лежит в API, но исполнять его некому. Напишите для него оператор, который превратит каждый Website в работающее приложение. Функция `reconcile(site, k)` вызывается для каждого объекта Website. Соберите в ней желаемый Deployment, прочитайте существующий, создайте его, если его нет, и поправьте число реплик, если оно разошлось с желаемым. Потом меняйте число реплик кнопкой, удалите Deployment руками и убедитесь, что оператор вернёт его. Цель достигнута, когда Deployment с четырьмя репликами снова на месте. В конце удалите сам Website: благодаря ownerReferences всё остальное удалится вслед за ним.',
        'The Website object from the lab above sits in the API, but nobody executes it. Write an operator for it that turns every Website into a running application. The function `reconcile(site, k)` is called for every Website: build the desired Deployment, read the existing one, create it if there is none and fix the replicas if they differ. Then change the replicas with a button, delete the Deployment by hand — the operator brings it back. The goal is reached when the Deployment with four replicas is back. Finally delete the Website itself: ownerReferences clean up the rest.',
      ),
    },
    {
      id: 'write-solution',
      kind: 'text',
      step: 'practice',
      levels: ['beginner'],
      title: bi('Недостающая часть оператора с объяснением', 'The missing part of the operator, explained'),
      body: bi(
        'Заготовка в редакторе уже собирает желаемый Deployment в переменную `want` и читает существующий в переменную `have`. Если вы ещё не программировали, допишите вместо комментария «Your part» две строки ниже, они делают то же, что петля из урока о цикле согласования. Строки после `//` служат комментариями, и программа их не выполняет.\n\n```js\n  // Если Deployment ещё нет, создать его по желаемому описанию.\n  if (!have) { k.create(want); return; }\n  // Если Deployment есть, но число реплик разошлось с Website, поправить его и записать.\n  if (have.spec.replicas !== site.spec.replicas) { have.spec.replicas = site.spec.replicas; k.update(have); }\n```\n\nПотом нажмите «Запустить петлю» и кнопки под редактором по порядку: «Создать Website blog (2 реплики)», «Website blog: replicas 2 → 4» и «Удалить Deployment blog руками». Отметка о достигнутой цели появится, когда Deployment снова будет на месте с четырьмя репликами. Кнопку «Удалить Website blog» нажимайте последней: Deployment исчезнет вместе с объектом Website, потому что Website записан его владельцем, и так оператор и должен себя вести.',
        'The starter in the editor already builds the desired Deployment into the variable `want` and reads the existing one into `have`. If you have not programmed before, write the two lines below in place of the “Your part” comment; they do the same as the loop from the reconcile lesson. The lines after `//` are comments; the program does not run them.\n\n```js\n  // No Deployment yet: create it from the desired description.\n  if (!have) { k.create(want); return; }\n  // The Deployment exists, but its replicas differ from the Website: fix and write it.\n  if (have.spec.replicas !== site.spec.replicas) { have.spec.replicas = site.spec.replicas; k.update(have); }\n```\n\nThen press “Start the loop” and the buttons under the editor in order: “Create Website blog (2 replicas)”, “Website blog: replicas 2 → 4” and “Delete the blog Deployment by hand”. The goal mark appears when the Deployment is back with four replicas. Press “Delete Website blog” last: the Deployment disappears with the Website because the Website is recorded as its owner, which is how the operator should behave.',
      ),
    },
    { id: 'operator', kind: 'widget', step: 'practice', widget: 'k8s.controller-lab', props: { exercise: 'website' } },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: operatorQuiz.map((q) => q.id) },
    { id: 'go', kind: 'callout', tone: 'note', step: 'review', body: bi('Настоящие операторы пишут на Go с библиотекой controller-runtime и инструментом kubebuilder. В них та же функция Reconcile и тот же клиент, к которым добавлены очереди, повторы и права доступа. Написать такой оператор вам предстоит в учебном проекте этого курса.', 'Real operators are written in Go with controller-runtime and kubebuilder: the same Reconcile function, the same client, plus queues, retries and permissions. That is a pet project of the course.') },
  ],
};
