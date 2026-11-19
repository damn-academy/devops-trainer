// Block 11 (route id final): the on-call shift as an exam on the simulators
// and the simulator variant of the final exam (10 §6.4–6.5). The final exam
// is one structured scenario in stages — build (A), fix (B), defend (C) and
// the cleanup — on the stands of the earlier blocks: the cluster from code
// (Edu Cloud + Terraform + Ansible + kubeadm), GitOps on kube-lite, the
// alert rule of monitoring. The real-VM variant is the checklist of the
// capstone lesson; its parts and the rubric are the same.

import { bi } from '../../core/i18n';
import type { Exam, Facts, QuizItem } from '../../core/types';
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
  prompt: bi('Правило алерта на долю ошибок будит дежурного на каждом коротком всплеске. Найдите строку, которой не хватает правилу, — точнее, строку, после которой её нужно добавить.', 'The error-ratio alert rule wakes the on-call engineer on every short spike. Find the line the rule is missing — more exactly, the line after which it has to be added.'),
  code: 'groups:\n  - name: shop\n    rules:\n      - alert: HighErrorRate\n        expr: sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05\n        labels:\n          severity: page\n        annotations:\n          summary: More than 5% of requests fail',
  lang: 'yaml',
  bug: [5],
  why: {
    5: bi('После expr нужен `for: 10m`: условие должно держаться десять минут, прежде чем алерт перейдёт из pending в firing. Без for он срабатывает на первом же вычислении.', 'After expr you need `for: 10m`: the condition must hold for ten minutes before the alert moves from pending to firing. Without for it fires on the very first evaluation.'),
    7: bi('severity: page — обычная метка маршрутизации в Alertmanager; с всплесками она не связана.', 'severity: page is an ordinary routing label for Alertmanager; it has nothing to do with the spikes.'),
    4: bi('Имя алерта правильное; дело не в нём.', 'The alert name is fine; it is not the problem.'),
  },
};

const STATUS: QuizItem = {
  id: 'final.exam.q.status',
  kind: 'mcq',
  concepts: ['career.oncall'],
  prompt: bi('Какой статус в чат команды написан правильно?', 'Which status update to the team chat is written right?'),
  options: [
    { id: 'good', text: bi('«С 14:05 у всех пользователей не проходит оплата (~30% запросов 503). Откатываю выкладку 1.2 через Git. Следующий статус в 14:25 или раньше, если поможет»', '“Since 14:05 checkout fails for all users (~30% of requests 503). Rolling back release 1.2 through Git. Next update at 14:25 or earlier if it helps”'), correct: true },
    { id: 'vague', text: bi('«Сайт тормозит, смотрю»', '“The site is slow, looking”'), why: bi('Нет влияния (кто и насколько страдает), нет действия с целью и времени следующего статуса.', 'No impact (who suffers and how much), no action with a goal and no time of the next update.') },
    { id: 'blame', text: bi('«Кто выкатил 1.2 без проверки? Сломали оплату»', '“Who released 1.2 without checking? Checkout is broken”'), why: bi('Поиск виноватого в разгар инцидента: команда начинает защищаться, а не помогать. Вопрос «как так вышло» — для разбора, и о системе, а не о человеке.', 'Looking for someone to blame in the middle of an incident: the team starts defending instead of helping. “How did it happen” is for the review, and about the system, not a person.') },
  ],
};

const PRIORITY: QuizItem = {
  id: 'final.exam.q.priority',
  kind: 'order',
  concepts: ['career.priority'],
  prompt: bi('Три алерта пришли за пять минут. Расставьте по порядку, за что браться.', 'Three alerts arrived within five minutes. Put in order what to take on.'),
  steps: [
    { id: 'pay', text: bi('Оплата отвечает 503 после выкладки', 'Checkout answers 503 after a release') },
    { id: 'node', text: bi('worker-2 NotReady; приложение пока работает на соседях', 'worker-2 is NotReady; the application still runs on the neighbours'), why: bi('Узел важен, но пользователи пока не страдают: реплики на соседях. Это второе, а не первое.', 'The node matters, but users do not suffer yet: the replicas are on the neighbours. It is second, not first.') },
    { id: 'ci', text: bi('Пайплайн main красный второй час', 'The main pipeline has been red for two hours'), why: bi('Мешает выкладкам, а не пользователям. Его откладывают и объявляют об этом в чате.', 'It blocks releases, not users. It is deferred, and the chat is told so.') },
  ],
};

const REVIEW: QuizItem = {
  id: 'final.exam.q.review',
  kind: 'multi',
  concepts: ['career.blameless'],
  prompt: bi('Разбор инцидента «оплата 503». Какие строки — способствующие факторы, а не поиск виноватого? Отметьте все.', 'The review of the “checkout 503” incident. Which lines are contributing factors rather than blame? Mark all.'),
  options: [
    { id: 'ci', text: bi('Конвейер не проверяет, что образ с новым тегом существует в registry', 'The pipeline does not check that the image with the new tag exists in the registry'), correct: true },
    { id: 'alert', text: bi('Алерт на долю ошибок пришёл через 12 минут: окно rate и for подобраны для ночи, а не для распродажи', 'The error-ratio alert came 12 minutes late: the rate window and for were tuned for the night, not for a sale'), correct: true },
    { id: 'review', text: bi('Изменение тега прошло ревью без проверки, что такой тег есть', 'The tag change passed review without checking that the tag exists'), correct: true },
    { id: 'person', text: bi('Разработчик Н. был невнимателен', 'Developer N. was careless'), why: bi('Это о человеке, а не о системе. Вопрос разбора — какие условия позволили ошибке дойти до прода и почему её не поймали раньше.', 'This is about a person, not the system. The review asks which conditions let the mistake reach production and why it was not caught earlier.') },
  ],
};

export const ONCALL_EXAM: Exam = {
  id: 'final.exam.oncall',
  block: 'final',
  kind: 'oncall',
  title: bi('Смена дежурного: экзамен', 'The on-call shift: the exam'),
  intro: bi(
    'Шестьдесят минут, жёсткий таймер, два настоящих инцидента на стендах и три вопроса о поведении дежурного. Проверяется не только починка: сначала — приоритет, потом — сервис, в конце — статус и разбор. Открыта встроенная документация.',
    'Sixty minutes, a hard timer, two real incidents on the stands and three questions about the on-call behaviour. Not only the fix is checked: first the priority, then the service, at the end the status and the review. The built-in documentation is open.',
  ),
  story: bi(
    'Вечер пятницы, в «Ларьке» распродажа. Вы на дежурстве один. За пять минут приходят три алерта.',
    'A Friday evening, a sale at the shop. You are on call alone. Three alerts come within five minutes.',
  ),
  minutes: 60,
  hardTimer: true,
  pass: 0.75,
  allowedDocs: ['help', 'ansible-doc', 'kubernetes.io', 'argo-cd'],
  tasks: [
    { id: 'priority', weight: 15, kind: 'quiz', item: PRIORITY },
    {
      id: 'checkout',
      weight: 30,
      critical: true,
      kind: 'task',
      setup: brokenRelease(),
      task: {
        id: 'o-checkout',
        prompt: bi('«Оплата отвечает 503». Верните сервис. Выкладка идёт через Git, и откат тоже должен пройти через Git: ручная правка в кластере будет отменена через несколько секунд.', '“Checkout answers 503”. Restore the service. Releases go through Git, and the rollback must go through Git too: a manual edit in the cluster is undone within seconds.'),
        check: {
          when: (f: Facts) => healthy(f) && synced(f) && appRevision(f) === forgeHead(f) && ['trainer/web:1.0', 'trainer/web:1.1'].includes(image(f) ?? ''),
          fail: [{ if: (f: Facts) => image(f) === 'trainer/web:1.2', say: bi('В кластере всё ещё образ 1.2: его нет в registry. Откатите коммит (git revert) и сделайте push.', 'The cluster still runs image 1.2: it does not exist in the registry. Revert the commit (git revert) and push.') }],
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
        prompt: bi('«worker-2 NotReady». Найдите по уликам, что не так с узлом, и верните его в строй, не пересоздавая и не присоединяя заново.', '“worker-2 is NotReady”. Find from evidence what is wrong with the node and bring it back without recreating or re-joining it.'),
        check: { when: (f: Facts) => readyNodes(f) === 3 },
        concepts: ['k8s.kubelet', 'career.oncall'],
      },
    },
    { id: 'status', weight: 15, kind: 'quiz', item: STATUS },
    { id: 'review', weight: 15, kind: 'quiz', item: REVIEW },
  ],
  explain: [
    { id: 'o1', prompt: bi('Почему вы взяли инциденты именно в этом порядке и что написали в чат про отложенный?', 'Why did you take the incidents in this order, and what did you write to the chat about the deferred one?'), keyPoints: [bi('Первым — то, от чего сильнее страдают пользователи', 'First — what hurts users most'), bi('Отложенный объявлен в чате, а не забыт', 'The deferred one is announced in the chat, not forgotten'), bi('В работе одновременно один инцидент', 'One incident in progress at a time')] },
  ],
};

export const CAPSTONE_EXAM: Exam = {
  id: 'final.exam.capstone',
  block: 'final',
  kind: 'capstone',
  title: bi('Итоговый экзамен на стендах: построить, починить, защитить', 'The final exam on the stands: build, fix, defend'),
  intro: bi(
    'Один сценарий в четыре этапа на стендах курса. **А. Построить** — кластер из кода, выкладка через Git, безопасность узлов, алерт и задача вне курса по документации. **Б. Починить** — одна поломка из пула, выбранная по зерну варианта. **В. Защитить** — вопросы, на которые вы отвечаете своими словами и сверяете с ключевыми пунктами. **Уборка** — без неё экзамен не сдан. Проверяется состояние, а не набранные команды; подсказок и наставника нет, открыта только встроенная документация. Тот же экзамен на трёх настоящих ВМ — в чек-листе урока «Итоговый экзамен».',
    'One scenario in four stages on the course stands. **A. Build** — a cluster from code, a release through Git, node security, an alert and a task beyond the course from the documentation. **B. Fix** — one failure from a pool, chosen by the variant seed. **C. Defend** — questions you answer in your own words and check against the key points. **Cleanup** — without it the exam is not passed. The state is checked, not the commands typed; there are no hints and no mentor, only the built-in documentation is open. The same exam on three real VMs is the checklist of the “Final exam” lesson.',
  ),
  story: bi(
    '«Ларёк» переезжает с одного сервера в кластер. Код инфраструктуры и манифесты уже в репозиториях, а у вас один день: поднять кластер из кода, выкатить магазин через Git, закрыть вход по паролю, поправить алерт, закрепить выкладку за релизом, разобраться с поломкой, которую подбросит смена, ответить на вопросы техлида и вечером убрать за собой стенд.',
    'The shop moves from one server to a cluster. The infrastructure code and the manifests are already in repositories, and you have one day: bring the cluster up from code, release the shop through Git, close password logins, fix the alert, pin the release to a tag, deal with the failure the shift throws at you, answer the tech lead’s questions and clean up the lab in the evening.',
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
        prompt: bi('**А1. Кластер из кода.** Облако пустое. Поднимите три узла и кластер кодом из `~/infra` и `~/ops` и докажите, что код описывает состояние: повторный прогон `site.yml` — `changed=0`.', '**A1. A cluster from code.** The cloud is empty. Bring up three nodes and the cluster with the code in `~/infra` and `~/ops`, and prove the code describes a state: a repeated run of `site.yml` gives `changed=0`.'),
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
        prompt: bi('**А2. Выкладка через Git.** Магазин уже синхронизируется из `~/shop-deploy`. Выкатите версию `trainer/web:1.1` на три реплики так, чтобы история выкладки была историей репозитория.', '**A2. A release through Git.** The shop already syncs from `~/shop-deploy`. Roll out version `trainer/web:1.1` on three replicas so that the release history is the repository history.'),
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
        prompt: bi('**А3. Безопасность.** На время отладки кто-то включил вход по паролю на всех узлах. Верните вход только по ключам — кодом Ansible, на всех трёх.', '**A3. Security.** During debugging someone turned on password logins on every node. Bring back key-only logins — with Ansible code, on all three.'),
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
        prompt: bi('**А5. Задача вне курса.** Прод не должен следовать за веткой `main`: каждый коммит в неё сразу уезжает к пользователям. Поставьте на текущий коммит тег `v1.1`, отправьте его на forge и сделайте так, чтобы Application `shop` выкладывал именно этот тег.', '**A5. A task beyond the course.** Production must not follow the `main` branch: every commit to it goes straight to users. Put the tag `v1.1` on the current commit, send it to the forge and make the Application `shop` release exactly this tag.'),
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
        prompt: bi('**Б. Починить.** Смена подбросила поломку: по алертам «что-то не так с кластером». Найдите её по уликам, верните кластер в рабочее состояние и не пересоздавайте ничего, что можно починить.', '**B. Fix.** The shift threw a failure at you: the alerts say “something is wrong with the cluster”. Find it from evidence, bring the cluster back to a working state and do not recreate anything that can be fixed.'),
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
        prompt: bi('**Б. Починить.** Смена подбросила поломку: по алертам «магазин отвечает ошибками». Найдите её по уликам и верните сервис так, чтобы кластер и Git снова совпадали.', '**B. Fix.** The shift threw a failure at you: the alerts say “the shop answers with errors”. Find it from evidence and restore the service so that the cluster and Git match again.'),
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
        prompt: bi('**Уборка.** Экзамен закончен. Удалите всё, что создал код в `~/infra`; в облаке не должно остаться ни одной машины курса.', '**Cleanup.** The exam is over. Delete everything the code in `~/infra` created; not a single course machine may be left in the cloud.'),
        check: { when: (f: Facts) => vms(f).length === 0 && (tf(f)?.state.length ?? 1) === 0 && (tf(f)?.serial ?? 0) > 1 },
        concepts: ['career.cleanup'],
      },
    },
  ],
  explain: [
    {
      id: 'c1',
      prompt: bi('**В. Защита.** Техлид спрашивает: «Где в этом кластере единая точка отказа и что будет, если она упадёт?»', '**C. Defence.** The tech lead asks: “Where is the single point of failure in this cluster and what happens if it fails?”'),
      keyPoints: [bi('Один control plane: при его падении работающие поды живут, но изменения, планирование и самолечение останавливаются', 'One control plane: if it fails, running pods live on, but changes, scheduling and self-healing stop'), bi('Один etcd без снимков — потеря всего состояния кластера', 'One etcd without snapshots means losing the whole cluster state'), bi('Как убрать: три control plane за балансировщиком, снимки etcd с проверенным восстановлением', 'How to remove it: three control planes behind a load balancer, etcd snapshots with a tested restore')],
    },
    {
      id: 'c2',
      prompt: bi('**В. Защита.** «Как вы откатите неудачную выкладку и сколько это займёт?»', '**C. Defence.** “How do you roll back a failed release, and how long does it take?”'),
      keyPoints: [bi('git revert коммита выкладки и push — Argo CD сам вернёт прошлую ревизию', 'git revert of the release commit and a push — Argo CD brings back the previous revision itself'), bi('Ручной kubectl не помогает: selfHeal отменит его', 'A manual kubectl does not help: selfHeal undoes it'), bi('Время — один цикл синхронизации плюс rolling update', 'The time is one sync loop plus a rolling update')],
    },
    {
      id: 'c3',
      prompt: bi('**В. Защита.** «Что kubeadm сделал за вас, а что осталось на вас? Что спрятал бы k3s?»', '**C. Defence.** “What did kubeadm do for you, and what was left to you? What would k3s hide?”'),
      keyPoints: [bi('kubeadm: сертификаты, kubeconfig, статические поды control plane, токены присоединения', 'kubeadm: certificates, kubeconfigs, the static pods of the control plane, bootstrap tokens'), bi('На вас: подготовка узлов, рантайм, сеть подов, хранилище, обновления, снимки etcd', 'Left to you: node preparation, the runtime, the pod network, storage, upgrades, etcd snapshots'), bi('k3s ставит всё одним бинарником со встроенными сетью, хранилищем и SQLite или etcd — проще, но меньше видно', 'k3s installs everything as one binary with a built-in network, storage and SQLite or etcd — simpler, but less is visible'), bi('Честно назвать, чего не делали руками', 'Honestly name what you did not do by hand')],
    },
  ],
};

export const FINAL_EXAMS: Exam[] = [CAPSTONE_EXAM, ONCALL_EXAM];
