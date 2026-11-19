// Block 9 "A cluster from code" (route id k8s-3): placement, the block exam
// and the block itself.

import { bi } from '../../../core/i18n';
import { ROUTE } from '../../../core/route';
import type { Block, Exam, Facts, PlacementTask, QuizItem } from '../../../core/types';
import { app, cluster, deployment, idempotentRun, image, inventoryOk, readyNodes, synced, healthy, tf, threeNodesLabelled, vms } from './checks';
import { L_KUBEADM, L_NODES, L_PLAN, L_PREPARE, R, S } from './lessons-a';
import { L_ASCODE, L_GITOPS, L_OPERATE, L_REAL } from './lessons-b';
import { QUIZ } from './quiz';
import { ANSIBLE_CFG, APP, clusterStand, DEPLOY_FILES, gitopsStand, noCreates, OPS, opsWith, preparedStand, ROLE_CILIUM, ROLE_JOIN, ROLE_PREREQ, stand, TF_CP, TF_HEAD } from './setups';

export const LESSONS = [L_PLAN, L_NODES, L_PREPARE, L_KUBEADM, L_ASCODE, L_GITOPS, L_OPERATE, L_REAL];

const route = ROUTE.find((r) => r.id === 'k8s-3')!;
const q = (id: string, as: string): QuizItem => ({ ...QUIZ.find((x) => x.id === id)!, id: as });
const opsCfg = [{ path: `${OPS}/ansible.cfg`, content: ANSIBLE_CFG }];
const inv = `${OPS}/inventory.ini`;

// ── placement (01 §4.1): 8 tasks, 4 practical keys ──

const placement: PlacementTask[] = [
  { id: 'k8s-3.place.why', level: 'beginner', key: true, concepts: ['k8s.rebuildable'], kind: 'quiz', item: q('k8s-3.q.why-code', 'k8s-3.place.q.why') },
  { id: 'k8s-3.place.label', level: 'beginner', key: false, concepts: ['iac.resource-label'], kind: 'quiz', item: q('k8s-3.q.label', 'k8s-3.place.q.label') },
  {
    id: 'k8s-3.place.count',
    level: 'intermediate',
    key: true,
    concepts: ['iac.count', 'iac.resource-label'],
    kind: 'task',
    setup: stand({ main: TF_HEAD + TF_CP }),
    task: {
      id: 'p-count',
      prompt: bi('В `~/infra/main.tf` описан только control plane. Добавьте два рабочих узла `worker-1` и `worker-2` одним ресурсом и создайте все три ВМ, каждую с меткой `trainer = "devops"`.', '`~/infra/main.tf` describes only the control plane. Add two workers `worker-1` and `worker-2` as one resource and create all three VMs, each with the label `trainer = "devops"`.'),
      check: { when: (f: Facts) => threeNodesLabelled(f) && (tf(f)?.state.some((s) => s.address === 'edu_vm.worker[1]') ?? false) },
    },
  },
  {
    id: 'k8s-3.place.preflight',
    level: 'intermediate',
    key: true,
    concepts: ['k8s.kubeadm', 'k8s.cgroup-driver'],
    kind: 'task',
    setup: preparedStand({ faults: [{ host: 'cp-1', kind: 'swap' }, { host: 'cp-1', kind: 'ipforward' }] }, opsCfg),
    task: {
      id: 'p-preflight',
      prompt: bi('`ansible cp-1 -b -a "kubeadm init"` падает на проверках. Приведите узел в порядок средствами Ansible, не отключая проверки, и поднимите control plane.', '`ansible cp-1 -b -a "kubeadm init"` fails its checks. Put the node in order with Ansible, without switching the checks off, and bring up the control plane.'),
      check: { when: (f: Facts) => !!cluster(f)?.initialized && !!vms(f).length && (cluster(f)?.nodes.length ?? 0) >= 1 && !!(f.kcode as { hosts: { name: string; swapOff: boolean; ipForward: boolean }[] }).hosts.find((h) => h.name === 'cp-1' && h.swapOff && h.ipForward) },
    },
  },
  { id: 'k8s-3.place.creates', level: 'intermediate', key: false, concepts: ['iac.creates'], kind: 'quiz', item: q('k8s-3.q.creates', 'k8s-3.place.q.creates') },
  {
    id: 'k8s-3.place.token',
    level: 'experienced',
    key: true,
    concepts: ['k8s.bootstrap-token'],
    kind: 'task',
    setup: preparedStand({ cluster: { cp: 'cp-1', workers: [], cni: true, expiredToken: true } }, opsCfg),
    task: {
      id: 'p-token',
      prompt: bi('Кластер подняли вчера, токен из вывода init истёк, рабочие узлы не присоединены. Присоедините оба.', 'The cluster was brought up yesterday, the token from the init output has expired, the workers are not joined. Join both.'),
      check: { when: (f: Facts) => readyNodes(f) === 3 },
      docRef: { page: 'help/kubeadm-token', anchor: 'OPTIONS' },
      docStep: 3,
    },
  },
  {
    id: 'k8s-3.place.drift',
    level: 'experienced',
    key: true,
    concepts: ['cicd.gitops-pull', 'k8s.sync-policy'],
    kind: 'task',
    setup: { ...gitopsStand({ apps: [APP({ selfHeal: false })] }), script: ['kubectl scale deployment shop -n shop --replicas=6'] },
    task: {
      id: 'p-drift',
      prompt: bi('Application `shop` в namespace `argocd` показывает OutOfSync: кто-то поменял число реплик руками. Верните кластер к Git и сделайте так, чтобы следующая ручная правка не пережила и минуты.', 'The Application `shop` in the `argocd` namespace shows OutOfSync: someone changed the replica count by hand. Bring the cluster back to Git and make sure the next manual edit does not survive a minute.'),
      check: { when: (f: Facts) => synced(f) && deployment(f)?.spec?.replicas === 2 && (app(f)?.spec as { syncPolicy?: { automated?: { selfHeal?: boolean } } } | undefined)?.syncPolicy?.automated?.selfHeal === true },
    },
  },
  { id: 'k8s-3.place.skew', level: 'experienced', key: false, concepts: ['k8s.version-skew'], kind: 'quiz', item: q('k8s-3.q.skew', 'k8s-3.place.q.skew') },
];

// ── the block exam: "the lab is gone, the code is left" ──

const prereqNoFwd = ROLE_PREREQ.replace(/\n- name: The node forwards IPv4 packets[\s\S]*$/, '\n');

export const EXAM: Exam = {
  id: 'k8s-3.exam.rebuild',
  block: 'k8s-3',
  kind: 'block',
  title: bi('Экзамен блока: стенд пропал, код остался', 'Block exam: the lab is gone, the code is left'),
  intro: bi(
    'Шесть карточек из трекера, каждая на своём стенде. Проверяется состояние — машины, узлы, файлы ролей, объекты кластера, — а не набранные команды. Подсказок нет; открыта встроенная документация: `--help`, `ansible-doc`, Terraform, kubernetes.io и Argo CD.',
    'Six cards from the tracker, each on its own stand. The state is checked — the machines, the nodes, the role files, the cluster objects — not the commands typed. There are no hints; the built-in documentation is open: `--help`, `ansible-doc`, Terraform, kubernetes.io and Argo CD.',
  ),
  story: bi(
    'Ночью у провайдера «Ларька» случилась авария: все три машины кластера удалены, в репозитории остался код. Тимлид утром в отпуске и оставил карточки: поднять кластер, найти, почему код не поднимает его с первого раза, вернуть магазин и выдать подрядчику доступ на присоединение узла. А вечером всё убрать.',
    'Overnight the provider of the shop had an outage: all three cluster machines are deleted, the code is left in the repository. The team lead is on holiday from this morning and left cards: bring the cluster up, find why the code does not bring it up on the first try, bring the shop back and give a contractor access to join a node. And clean everything up in the evening.',
  ),
  minutes: 120,
  pass: 0.7,
  allowedDocs: ['help', 'ansible-doc', 'terraform', 'kubernetes.io', 'argo-cd'],
  tasks: [
    {
      id: 'machines',
      weight: 15,
      critical: true,
      kind: 'task',
      setup: stand({ ops: opsCfg }),
      task: {
        id: 'e-machines',
        prompt: bi('«Машин нет». Закажите три узла кодом из `~/infra` и отдайте Ansible инвентарь в `~/ops/inventory.ini`.', '“There are no machines”. Order the three nodes with the code in `~/infra` and hand Ansible the inventory in `~/ops/inventory.ini`.'),
        check: { when: (f: Facts) => threeNodesLabelled(f) && inventoryOk(f, inv) },
        concepts: ['iac.output', 'iac.count'],
      },
    },
    {
      id: 'cluster',
      weight: 25,
      critical: true,
      kind: 'task',
      setup: stand({ applied: true, ops: opsWith('k8s_prereq', prereqNoFwd) }),
      task: {
        id: 'e-cluster',
        prompt: bi('«Кластера нет». Поднимите его `ansible-playbook site.yml`. Если код не доводит дело до конца, почините код, а не узел: завтра его прогонят снова.', '“There is no cluster”. Bring it up with `ansible-playbook site.yml`. If the code does not get there, fix the code, not the node: it will be run again tomorrow.'),
        check: { when: (f: Facts) => readyNodes(f) === 3 && /ip_forward\s*=\s*1/.test(f.files[`${OPS}/roles/k8s_prereq/tasks/main.yml`]?.text ?? '') },
        concepts: ['k8s.kubeadm', 'iac.role'],
      },
    },
    {
      id: 'idem-join',
      pool: 'idem',
      weight: 15,
      kind: 'task',
      setup: clusterStand({}, opsWith('kubeadm_join', noCreates(ROLE_JOIN))),
      task: {
        id: 'e-idem',
        prompt: bi('«Ночной прогон site.yml красный». Кластер работает, но повторный прогон кода на нём падает. Добейтесь `changed=0` на всех узлах.', '“The nightly site.yml run is red”. The cluster works, but a repeated run of the code on it fails. Get `changed=0` on every node.'),
        check: { when: (f: Facts) => idempotentRun(f) && readyNodes(f) === 3 },
        concepts: ['iac.creates'],
      },
    },
    {
      id: 'idem-cilium',
      pool: 'idem',
      weight: 15,
      kind: 'task',
      setup: clusterStand({}, opsWith('cilium', noCreates(ROLE_CILIUM))),
      task: {
        id: 'e-idem',
        prompt: bi('«Ночной прогон site.yml красный». Кластер работает, но повторный прогон кода на нём падает. Добейтесь `changed=0` на всех узлах.', '“The nightly site.yml run is red”. The cluster works, but a repeated run of the code on it fails. Get `changed=0` on every node.'),
        check: { when: (f: Facts) => idempotentRun(f) && readyNodes(f) === 3 },
        concepts: ['iac.creates'],
      },
    },
    {
      id: 'shop',
      weight: 20,
      kind: 'task',
      setup: gitopsStand({ files: DEPLOY_FILES('trainer/web:1.1', 2) }),
      task: {
        id: 'e-shop',
        prompt: bi('«Магазина нет». Он должен приехать в namespace `shop` из каталога `k8s` репозитория `team/shop-deploy` и дальше обновляться сам с каждым коммитом.', '“There is no shop”. It must arrive in the `shop` namespace from the `k8s` directory of the `team/shop-deploy` repository and keep updating itself with every commit.'),
        check: { when: (f: Facts) => synced(f) && healthy(f) && image(f) === 'trainer/web:1.1' && !!(app(f)?.spec as { syncPolicy?: { automated?: unknown } } | undefined)?.syncPolicy?.automated },
        concepts: ['k8s.argocd-app', 'k8s.sync-policy'],
      },
    },
    {
      id: 'contractor',
      weight: 15,
      beyond: true,
      kind: 'task',
      setup: clusterStand(),
      task: {
        id: 'e-contractor',
        prompt: bi('«Подрядчик сегодня подключит свой узел». Выдайте токен присоединения, который проживёт не больше двух часов и в описании которого сказано, для кого он.', '“A contractor connects their node today”. Issue a bootstrap token that lives no longer than two hours and whose description says who it is for.'),
        check: { when: (f: Facts) => (cluster(f)?.tokens ?? []).some((t) => t.valid && t.hoursLeft <= 2 && !!t.description && !/default bootstrap token/.test(t.description)) },
        docStep: 5,
        solutionTokens: ['--ttl', '--description'],
        concepts: ['k8s.bootstrap-token'],
      },
    },
    {
      id: 'cleanup',
      weight: 10,
      critical: true,
      kind: 'task',
      setup: clusterStand(),
      task: {
        id: 'e-cleanup',
        prompt: bi('«Вечером стенд не нужен». Удалите всё, что создал код в `~/infra`, и убедитесь, что в облаке не осталось машин курса.', '“The lab is not needed in the evening”. Delete everything the code in `~/infra` created and make sure no course machines are left in the cloud.'),
        check: { when: (f: Facts) => vms(f).length === 0 && (tf(f)?.state.length ?? 1) === 0 && (tf(f)?.serial ?? 0) > 1 },
        concepts: ['iac.resource-label'],
      },
    },
  ],
  explain: [
    { id: 'x1', prompt: bi('Тимлид вернулся и спрашивает: «Что изменится в нашей жизни теперь, когда кластер поднимается кодом?» Ответьте ему.', 'The team lead is back and asks: “What changes in our life now that the cluster comes up from code?” Answer them.'), keyPoints: [bi('Потеря машины или всего стенда чинится прогоном кода, а не днём ручной работы', 'Losing a machine or the whole lab is fixed by a run of the code, not by a day of manual work'), bi('Второе окружение — тот же код с другими переменными', 'A second environment is the same code with other variables'), bi('Узлы одинаковы по построению, а изменения проходят ревью', 'The nodes are identical by construction, and changes go through review'), bi('Стенд можно не держать между занятиями — это деньги', 'The lab need not be kept between sessions — that is money')] },
    { id: 'x2', prompt: bi('Почему в ролях kubeadm стоит creates и чем опасен признак, выбранный неудачно?', 'Why do the kubeadm roles have creates, and what is the danger of a badly chosen sign?'), keyPoints: [bi('Модуль command запускает команду всегда; kubeadm init на готовом узле падает на preflight', 'The command module always runs the command; kubeadm init on a ready node fails at preflight'), bi('creates пропускает задачу, если файл-признак есть', 'creates skips the task if the sign file exists'), bi('Признак должен появляться только при успехе: иначе после неудачи роль сочтёт работу сделанной', 'The sign must appear only on success: otherwise after a failure the role considers the job done')] },
  ],
};

export const block: Block = {
  id: 'k8s-3',
  order: route.order,
  title: route.title,
  summary: bi(
    'Terraform заказывает три ВМ с метками, Ansible готовит узлы ролями, kubeadm проходится один раз руками и превращается в роли с creates, кластер пересоздаётся с нуля одной последовательностью команд, приложение приходит из Git через Argo CD; сертификаты, расхождение версий, обновление по узлу; настоящий трек и обязательная уборка.',
    'Terraform orders three labelled VMs, Ansible prepares the nodes with roles, kubeadm is walked through once by hand and turned into roles with creates, the cluster is rebuilt from scratch by one sequence of commands, the application comes from Git through Argo CD; certificates, version skew, upgrading node by node; the real track and a mandatory cleanup.',
  ),
  checklistStep: route.checklistStep,
  levels: {
    beginner: bi('Прошёл IaC и второй этап Kubernetes. Работает по полному чеклисту: читает готовые роли, запускает их и дописывает отмеченные места. Итог — кластер из кода и понимание каждого звена.', 'Has finished IaC and Kubernetes stage 2. Works by the full checklist: reads the ready roles, runs them and fills in the marked places. The outcome is a cluster from code and an understanding of every link.'),
    intermediate: bi('Дан каркас: структура каталогов, имена ролей и переменных, пустые файлы задач. Итог — роли kubeadm с creates и пересоздание с нуля без ручных шагов.', 'Given a skeleton: the directory layout, role and variable names, empty task files. The outcome is kubeadm roles with creates and a rebuild from scratch with no manual steps.'),
    experienced: bi('С нуля по описанию; на настоящем треке — join с проверкой CA через delegate_to и run_once, обновление с serial: 1, снимок etcd по расписанию.', 'From scratch by the description; on the real track — join with the CA check through delegate_to and run_once, an upgrade with serial: 1, a scheduled etcd snapshot.'),
  },
  hours: route.hours,
  placement,
  lessons: LESSONS.map((l) => l.id),
  sources: {
    en: [S.kubeadmCreate, S.ansRoles, S.tfCount, S.argoDocs, S.petsCattle],
    ru: [R.kubeadmRu, R.iacRu, R.ansibleRu],
  },
  requires: ['iac', 'k8s-2'],
  docSources: ['help', 'ansible-doc', 'terraform', 'kubernetes.io', 'argo-cd'],
  exam: EXAM.id,
};

