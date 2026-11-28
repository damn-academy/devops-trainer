// Block 11 (route id final): the on-call shift as an exam on the simulators
// and the simulator variant of the final exam (10 §6.4–6.5). The final exam
// is one structured scenario in stages — build (A), fix (B), defend (C) and
// the cleanup — on the stands of the earlier blocks: the cluster from code
// (Edu Cloud + Terraform + Ansible + kubeadm), GitOps on kube-lite, the
// alert rule of monitoring. The real-VM variant is the checklist of the
// capstone lesson; its parts and the rubric are the same.

import { bi } from '../../core/i18n';
import type { Exam, Facts, QuizItem } from '../../core/types';
import { orderAsMatch } from './order-fallback';
import { app, deployment, forgeHead, healthy, hostFile, idempotentRun, image, readyNodes, synced, tf, vms } from '../k8s-code/content/checks';
import { APP, clusterStand, DEPLOY_FILES, DEPLOYMENT, gitopsStand, opsFiles, stand } from '../k8s-code/content/setups';

const NODES = ['cp-1', 'worker-1', 'worker-2'];
const keysOnly = (f: Facts) => NODES.every((h) => /^PasswordAuthentication no\s*$/m.test(hostFile(f, h, '/etc/ssh/sshd_config')) && !/^PasswordAuthentication yes/m.test(hostFile(f, h, '/etc/ssh/sshd_config')));
const appRevision = (f: Facts) => (app(f)?.status?.sync as { revision?: string } | undefined)?.revision;
const targetRevision = (f: Facts) => (app(f)?.spec as { source?: { targetRevision?: string } } | undefined)?.source?.targetRevision;

/** A shop whose last commit points at an image that does not exist: the release is Degraded. */
const brokenRelease = () =>
  gitopsStand({
    files: DEPLOY_FILES('trainer/web:1.0', 2),
    later: [{ message: 'shop: 1.2', files: { 'k8s/deployment.yaml': DEPLOYMENT('trainer/web:1.2', 2) } }],
    apps: [APP({ selfHeal: true, prune: true })],
  });

const ALERT_BUG: QuizItem = {
  id: 'final.exam.q.alert',
  kind: 'bugfind',
  concepts: ['obs.alert-rule'],
  prompt: bi('Правило алерта на долю ошибок будит дежурного при каждом коротком всплеске, потому что в правиле не хватает одной строки.', 'The error-ratio alert rule wakes the on-call engineer on every short spike because the rule is missing one line.'),
  code: 'groups:\n  - name: shop\n    rules:\n      - alert: HighErrorRate\n        expr: sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05\n        labels:\n          severity: page\n        annotations:\n          summary: More than 5% of requests fail',
  lang: 'yaml',
  action: bi('Нажмите на строку, после которой нужно добавить недостающую.', 'Click the line after which the missing one goes.'),
  bug: [5],
  why: {
    5: bi('После expr нужна строка `for: 10m`: условие должно выполняться десять минут подряд, прежде чем алерт перейдёт из состояния pending в firing. Без for алерт срабатывает при первом же вычислении.', 'After expr you need `for: 10m`: the condition must hold for ten minutes before the alert moves from pending to firing. Without for it fires on the very first evaluation.'),
    7: bi('Строка severity: page — обычная метка, по которой Alertmanager решает, куда отправить алерт, и с всплесками она не связана.', 'severity: page is an ordinary routing label for Alertmanager; it has nothing to do with the spikes.'),
    4: bi('Имя алерта правильное, и дело не в нём.', 'The alert name is fine; it is not the problem.'),
  },
};

const STATUS: QuizItem = {
  id: 'final.exam.q.status',
  kind: 'mcq',
  concepts: ['career.oncall'],
  prompt: bi('Какой статус для чата команды написан правильно?', 'Which status update to the team chat is written right?'),
  options: [
    { id: 'good', text: bi('«С 14:05 у всех пользователей не проходит оплата: около 30 % запросов заканчиваются ошибкой 503. Откатываю выкладку 1.2 через Git. Следующий статус в 14:25 или раньше, если откат поможет»', '“Since 14:05 checkout fails for all users (~30% of requests 503). Rolling back release 1.2 through Git. Next update at 14:25 or earlier if it helps”'), correct: true },
    { id: 'vague', text: bi('«Сайт тормозит, смотрю»', '“The site is slow, looking”'), why: bi('В статусе не сказано, кого задел сбой и насколько, нет действия с понятной целью и времени следующего статуса.', 'No impact (who suffers and how much), no action with a goal and no time of the next update.') },
    { id: 'blame', text: bi('«Кто выложил 1.2 без проверки? Сломали оплату»', '“Who released 1.2 without checking? Checkout is broken”'), why: bi('Здесь ищут виноватого в разгар инцидента, и команда начинает защищаться, а не помогать. Вопрос «как так вышло» задают на разборе, и задают его о системе, а не о человеке.', 'Looking for someone to blame in the middle of an incident: the team starts defending instead of helping. “How did it happen” is for the review, and about the system, not a person.') },
  ],
};

const PRIORITY: QuizItem = {
  id: 'final.exam.q.priority',
  kind: 'order',
  concepts: ['career.priority'],
  prompt: bi('За пять минут пришли три алерта. Расставьте их в том порядке, в каком за них нужно браться.', 'Three alerts arrived within five minutes. Put in order what to take on.'),
  steps: [
    { id: 'pay', text: bi('Оплата отвечает 503 после выкладки', 'Checkout answers 503 after a release') },
    { id: 'node', text: bi('Узел worker-2 в состоянии NotReady, но приложение пока работает на соседних узлах', 'worker-2 is NotReady; the application still runs on the neighbours'), why: bi('Узел важен, но пользователи пока не страдают, потому что реплики работают на соседних узлах. Поэтому этот алерт второй, а не первый.', 'The node matters, but users do not suffer yet: the replicas are on the neighbours. It is second, not first.') },
    { id: 'ci', text: bi('Конвейер ветки main второй час красный', 'The main pipeline has been red for two hours'), why: bi('Красный конвейер мешает выкладкам, а не пользователям. Этот инцидент откладывают и сообщают об этом в чате.', 'It blocks releases, not users. It is deferred, and the chat is told so.') },
  ],
};

const REVIEW: QuizItem = {
  id: 'final.exam.q.review',
  kind: 'multi',
  concepts: ['career.blameless'],
  prompt: bi('Вы пишете разбор инцидента «оплата отвечает ошибкой 503». Какие строки описывают способствующие факторы, а не ищут виноватого? Отметьте все.', 'The review of the “checkout 503” incident. Which lines are contributing factors rather than blame? Mark all.'),
  options: [
    { id: 'ci', text: bi('Конвейер не проверяет, что образ с новым тегом есть в реестре образов', 'The pipeline does not check that the image with the new tag exists in the registry'), correct: true },
    { id: 'alert', text: bi('Алерт на долю ошибок пришёл через 12 минут, потому что окно rate и длительность for подобраны для ночи, а не для распродажи', 'The error-ratio alert came 12 minutes late: the rate window and for were tuned for the night, not for a sale'), correct: true },
    { id: 'review', text: bi('Изменение тега прошло ревью, и никто не проверил, что такой тег существует', 'The tag change passed review without checking that the tag exists'), correct: true },
    { id: 'person', text: bi('Разработчик Н. был невнимателен', 'Developer N. was careless'), why: bi('Эта строка говорит о человеке, а не о системе. Разбор отвечает на вопрос, какие условия позволили ошибке дойти до рабочих серверов и почему её не заметили раньше.', 'This is about a person, not the system. The review asks which conditions let the mistake reach production and why it was not caught earlier.') },
  ],
};

export const ONCALL_EXAM: Exam = {
  id: 'final.exam.oncall',
  block: 'final',
  kind: 'oncall',
  title: bi('Экзамен по смене дежурного', 'The on-call shift exam'),
  intro: bi(
    'У вас шестьдесят минут по жёсткому таймеру, два настоящих инцидента на стендах и три вопроса о том, как ведёт себя дежурный. Проверяется не только починка: сначала выбор приоритета, потом возвращение сервиса, а в конце статус и разбор. Встроенная документация открыта.',
    'Sixty minutes, a hard timer, two real incidents on the stands and three questions about the on-call behaviour. Not only the fix is checked: first the priority, then the service, at the end the status and the review. The built-in documentation is open.',
  ),
  story: bi(
    'Вечер пятницы, в интернет-магазине «Ларёк» распродажа, и вы дежурите один. За пять минут приходят три алерта.',
    'A Friday evening, a sale at the shop. You are on call alone. Three alerts come within five minutes.',
  ),
  minutes: 60,
  hardTimer: true,
  pass: 0.75,
  allowedDocs: ['help', 'ansible-doc', 'kubernetes.io', 'argo-cd'],
  tasks: [
    { id: 'priority', weight: 15, kind: 'quiz', item: orderAsMatch(PRIORITY) },
    {
      id: 'checkout',
      weight: 30,
      critical: true,
      kind: 'task',
      setup: brokenRelease(),
      task: {
        id: 'o-checkout',
        prompt: bi('Пришёл алерт «Оплата отвечает ошибкой 503», и вам нужно вернуть сервис. Выкладка идёт через Git, поэтому и откат должен пройти через Git, ведь ручную правку в кластере система отменит через несколько секунд.', 'An alert has fired, “Checkout answers 503”, and you need to restore the service. Releases go through Git, so the rollback must go through Git too, because the system undoes a manual edit in the cluster within seconds.'),
        check: {
          when: (f: Facts) => healthy(f) && synced(f) && appRevision(f) === forgeHead(f) && ['trainer/web:1.0', 'trainer/web:1.1'].includes(image(f) ?? ''),
          fail: [{ if: (f: Facts) => image(f) === 'trainer/web:1.2', say: bi('В кластере всё ещё работает образ 1.2, а такого образа нет в реестре. Отмените коммит командой git revert и отправьте изменения командой git push.', 'The cluster still runs image 1.2, and that image does not exist in the registry. Revert the commit with git revert and send the change with git push.') }],
        },
        concepts: ['cicd.gitops-pull', 'career.oncall'],
      },
    },
    {
      id: 'node',
      weight: 25,
      kind: 'task',
      setup: clusterStand({ faults: [{ host: 'worker-2', kind: 'kubelet-stopped' }] }),
      task: {
        id: 'o-node',
        prompt: bi('Пришёл алерт «worker-2 NotReady». Найдите по уликам, что случилось с узлом, и верните его в строй, не пересоздавая его и не присоединяя к кластеру заново.', 'An alert has fired, “worker-2 is NotReady”. Find from evidence what is wrong with the node and bring it back without recreating or re-joining it.'),
        check: { when: (f: Facts) => readyNodes(f) === 3 },
        concepts: ['k8s.kubelet', 'career.oncall'],
      },
    },
    { id: 'status', weight: 15, kind: 'quiz', item: STATUS },
    { id: 'review', weight: 15, kind: 'quiz', item: REVIEW },
  ],
  explain: [
    { id: 'o1', prompt: bi('Почему вы взяли инциденты в таком порядке и что вы написали в чат об отложенном инциденте?', 'Why did you take the incidents in this order, and what did you write to the chat about the deferred one?'), keyPoints: [bi('Первым берут инцидент, от которого сильнее всего страдают пользователи', 'First — what hurts users most'), bi('Об отложенном инциденте сообщили в чате, а не забыли о нём', 'The deferred one is announced in the chat, not forgotten'), bi('В работе одновременно находится один инцидент', 'One incident in progress at a time')] },
  ],
};

export const CAPSTONE_EXAM: Exam = {
  id: 'final.exam.capstone',
  block: 'final',
  kind: 'capstone',
  title: bi('Итоговый экзамен на стендах, где вы строите, чините и защищаете систему', 'The final exam on the stands, where you build, fix and defend a system'),
  intro: bi(
    'Один сценарий в четыре этапа на стендах курса. На этапе **А, «Построить»**, вы создаёте кластер через Terraform и Ansible, выкладываете магазин через Git, наводите порядок с безопасностью узлов, чините алерт и решаете по документации задачу, которой не было в курсе. На этапе **Б, «Починить»**, вам достаётся одна поломка из набора, и какую из них вы получите, решает номер варианта. На этапе **В, «Защитить»**, вы своими словами отвечаете на вопросы и сверяете ответы с ключевыми пунктами. На последнем этапе вы делаете **уборку**, и без неё экзамен не сдан. Проверяется состояние стендов, а не набранные команды. Подсказок и наставника нет, открыта только встроенная документация. Тот же экзамен на трёх настоящих виртуальных машинах описан в чек-листе урока «Итоговый экзамен».',
    'One scenario in four stages on the course stands. **A. Build** — a cluster built with Terraform and Ansible, a release through Git, node security, an alert and a task beyond the course from the documentation. **B. Fix** — one failure from a pool, chosen by the variant seed. **C. Defend** — questions you answer in your own words and check against the key points. **Cleanup** — without it the exam is not passed. The state is checked, not the commands typed; there are no hints and no mentor, only the built-in documentation is open. The same exam on three real VMs is the checklist of the “Final exam” lesson.',
  ),
  story: bi(
    'Интернет-магазин «Ларёк» переезжает с одного сервера в кластер. Код инфраструктуры и манифесты уже лежат в репозиториях, а у вас есть один день. За этот день нужно создать кластер через Terraform и Ansible, выложить магазин через Git, запретить вход по паролю, исправить алерт, закрепить выкладку за тегом выпуска, разобраться с поломкой, которая случится во время смены, ответить на вопросы ведущего инженера команды и вечером убрать за собой стенд.',
    'The shop moves from one server to a cluster. The infrastructure code and the manifests are already in repositories, and you have one day: bring the cluster up with Terraform and Ansible, release the shop through Git, close password logins, fix the alert, pin the release to a tag, deal with the failure the shift throws at you, answer the tech lead’s questions and clean up the lab in the evening.',
  ),
  minutes: 240,
  pass: 0.75,
  allowedDocs: ['help', 'man', 'ansible-doc', 'terraform', 'kubernetes.io', 'argo-cd', 'prometheus.io'],
  tasks: [
    {
      id: 'a1-cluster',
      weight: 15,
      critical: true,
      kind: 'task',
      setup: stand({ ops: opsFiles() }),
      task: {
        id: 'f-cluster',
        prompt: bi('**А1. Кластер через Terraform и Ansible.** Облако пустое. Создайте три узла и кластер кодом из каталогов `~/infra` и `~/ops` и докажите, что код описывает состояние, а не последовательность действий. Для этого повторный запуск `site.yml` должен показать `changed=0`, то есть код больше ничего не меняет.', '**A1. A cluster with Terraform and Ansible.** The cloud is empty. Create three nodes and the cluster with the code in `~/infra` and `~/ops`, and prove that the code describes a state rather than a sequence of actions. To do so, a repeated run of `site.yml` must show `changed=0`, meaning the code changes nothing more.'),
        check: { when: (f: Facts) => readyNodes(f) === 3 && idempotentRun(f) },
        concepts: ['k8s.rebuildable', 'iac.creates'],
      },
    },
    {
      id: 'a2-release',
      weight: 15,
      critical: true,
      kind: 'task',
      setup: gitopsStand({ apps: [APP({ selfHeal: true, prune: true })] }),
      task: {
        id: 'f-release',
        prompt: bi('**А2. Выкладка через Git.** Магазин уже синхронизируется из репозитория `~/shop-deploy`. Выложите версию `trainer/web:1.1` на три реплики так, чтобы история выкладок совпадала с историей репозитория.', '**A2. A release through Git.** The shop already syncs from `~/shop-deploy`. Roll out version `trainer/web:1.1` on three replicas so that the release history is the repository history.'),
        check: { when: (f: Facts) => image(f) === 'trainer/web:1.1' && deployment(f)?.spec?.replicas === 3 && synced(f) && healthy(f) && appRevision(f) === forgeHead(f) },
        concepts: ['cicd.gitops-pull', 'k8s.sync-policy'],
      },
    },
    {
      id: 'a3-ssh',
      weight: 10,
      kind: 'task',
      setup: clusterStand({ faults: NODES.map((host) => ({ host, kind: 'ssh-password' as const })) }),
      task: {
        id: 'f-ssh',
        prompt: bi('**А3. Безопасность.** На время отладки кто-то разрешил вход по паролю на всех узлах. Кодом Ansible снова разрешите на всех трёх узлах вход только по ключам.', '**A3. Security.** During debugging someone turned on password logins on every node. Bring back key-only logins — with Ansible code, on all three.'),
        check: { when: keysOnly },
        concepts: ['linux.ssh-key'],
      },
    },
    { id: 'a4-alert', weight: 10, kind: 'quiz', item: ALERT_BUG },
    {
      id: 'a5-pin',
      weight: 15,
      beyond: true,
      kind: 'task',
      setup: gitopsStand({ files: DEPLOY_FILES('trainer/web:1.1', 2), apps: [APP({ selfHeal: true, prune: true })] }),
      task: {
        id: 'f-pin',
        prompt: bi('**А5. Задача, которой не было в курсе.** Рабочие серверы не должны следовать за веткой `main`, иначе каждый коммит в неё сразу попадает к пользователям. Поставьте на текущий коммит тег `v1.1`, отправьте его на сервер forge и сделайте так, чтобы Application `shop` выкладывал этот тег.', '**A5. A task beyond the course.** Production must not follow the `main` branch: every commit to it goes straight to users. Put the tag `v1.1` on the current commit, send it to the forge and make the Application `shop` release exactly this tag.'),
        check: { when: (f: Facts) => targetRevision(f) === 'v1.1' && synced(f) && image(f) === 'trainer/web:1.1' && !!forgeHead(f, 'team/shop-deploy', 'main') && ((f.git as { forge?: { project: string; tags: Record<string, string> }[] } | undefined)?.forge?.find((p) => p.project === 'team/shop-deploy')?.tags['v1.1'] ?? '') !== '' },
        docStep: 5,
        solutionTokens: ['targetRevision', 'git tag', 'git push origin v1.1'],
        concepts: ['k8s.argocd-app'],
      },
    },
    {
      id: 'b-node',
      pool: 'fault',
      weight: 20,
      critical: true,
      kind: 'task',
      setup: clusterStand({ faults: [{ host: 'worker-1', kind: 'kubelet-stopped' }] }),
      task: {
        id: 'f-fault',
        prompt: bi('**Б. Починить.** Во время смены что-то сломалось, и алерты говорят, что с кластером не всё в порядке. Найдите поломку по уликам, верните кластер в рабочее состояние и не пересоздавайте ничего, что можно починить.', '**B. Fix.** The shift threw a failure at you: the alerts say “something is wrong with the cluster”. Find it from evidence, bring the cluster back to a working state and do not recreate anything that can be fixed.'),
        check: { when: (f: Facts) => readyNodes(f) === 3 },
        concepts: ['k8s.kubelet'],
      },
    },
    {
      id: 'b-release',
      pool: 'fault',
      weight: 20,
      critical: true,
      kind: 'task',
      setup: brokenRelease(),
      task: {
        id: 'f-fault',
        prompt: bi('**Б. Починить.** Во время смены что-то сломалось, и алерты говорят, что магазин отвечает ошибками. Найдите поломку по уликам и верните сервис так, чтобы состояние кластера снова совпадало с Git.', '**B. Fix.** The shift threw a failure at you: the alerts say “the shop answers with errors”. Find it from evidence and restore the service so that the cluster and Git match again.'),
        check: { when: (f: Facts) => healthy(f) && synced(f) && appRevision(f) === forgeHead(f) && ['trainer/web:1.0', 'trainer/web:1.1'].includes(image(f) ?? '') },
        concepts: ['cicd.gitops-pull'],
      },
    },
    { id: 'b-status', weight: 5, kind: 'quiz', item: { ...STATUS, id: 'final.exam.q.status-b' } },
    {
      id: 'd-cleanup',
      weight: 10,
      critical: true,
      kind: 'task',
      setup: clusterStand(),
      task: {
        id: 'f-cleanup',
        prompt: bi('**Уборка.** Экзамен закончен. Удалите всё, что создал код из каталога `~/infra`, так, чтобы в облаке не осталось ни одной машины курса.', '**Cleanup.** The exam is over. Delete everything the code in `~/infra` created so that not a single course machine is left in the cloud.'),
        check: { when: (f: Facts) => vms(f).length === 0 && (tf(f)?.state.length ?? 1) === 0 && (tf(f)?.serial ?? 0) > 1 },
        concepts: ['career.cleanup'],
      },
    },
  ],
  explain: [
    {
      id: 'c1',
      prompt: bi('**В. Защита.** Техлид спрашивает: «Где в этом кластере единая точка отказа и что будет, если она выйдет из строя?»', '**C. Defence.** The tech lead asks: “Where is the single point of failure in this cluster and what happens if it fails?”'),
      keyPoints: [bi('Управляющий узел (control plane) в кластере один, и если он выйдет из строя, запущенные поды продолжат работать, но изменения, планирование и автоматическое восстановление остановятся', 'The cluster has one control plane, and if it fails, running pods keep working, but changes, scheduling and self-healing stop'), bi('etcd тоже один и без снимков, и его потеря означает потерю всего состояния кластера', 'One etcd without snapshots means losing the whole cluster state'), bi('Чтобы избавиться от единой точки отказа, ставят три управляющих узла за балансировщиком и делают снимки etcd, восстановление из которых проверено', 'How to remove it: three control planes behind a load balancer, etcd snapshots with a tested restore')],
    },
    {
      id: 'c2',
      prompt: bi('**В. Защита.** «Как вы откатите неудачную выкладку и сколько это займёт?»', '**C. Defence.** “How do you roll back a failed release, and how long does it take?”'),
      keyPoints: [bi('Отменить коммит выкладки командой git revert и отправить изменение командой push, а Argo CD сам вернёт прошлую ревизию', 'git revert of the release commit and a push — Argo CD brings back the previous revision itself'), bi('Ручная правка через kubectl не поможет, потому что selfHeal её отменит', 'A manual edit with kubectl does not help, because selfHeal undoes it'), bi('Откат занимает один цикл синхронизации и время на постепенную замену подов (rolling update)', 'The time is one sync loop plus a rolling update')],
    },
    {
      id: 'c3',
      prompt: bi('**В. Защита.** «Что kubeadm сделал за вас, а что осталось на вас? Что спрятал бы k3s?»', '**C. Defence.** “What did kubeadm do for you, and what was left to you? What would k3s hide?”'),
      keyPoints: [bi('kubeadm создал сертификаты, файлы kubeconfig, статические поды управляющего узла и токены для присоединения узлов', 'kubeadm: certificates, kubeconfigs, the static pods of the control plane, bootstrap tokens'), bi('На вас остались подготовка узлов, среда запуска контейнеров, сеть подов, хранилище, обновления и снимки etcd', 'Left to you: node preparation, the runtime, the pod network, storage, upgrades, etcd snapshots'), bi('k3s ставит всё одной программой со встроенными сетью, хранилищем и SQLite или etcd, и это проще, но устройство кластера при этом видно хуже', 'k3s installs everything as one program with a built-in network, storage and SQLite or etcd, which is simpler, but the structure of the cluster is less visible'), bi('Открыто признать, какие шаги вы не делали своими руками', 'Openly admit which steps you did not do by hand')],
    },
  ],
};

export const FINAL_EXAMS: Exam[] = [CAPSTONE_EXAM, ONCALL_EXAM];
