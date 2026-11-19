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
      prompt: bi('В файле `~/infra/main.tf` описан только control plane. Добавьте два рабочих узла, `worker-1` и `worker-2`, одним ресурсом и создайте все три ВМ так, чтобы на каждой стояла метка `trainer = "devops"`.', '`~/infra/main.tf` describes only the control plane. Add two workers `worker-1` and `worker-2` as one resource and create all three VMs, each with the label `trainer = "devops"`.'),
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
      prompt: bi('Команда `ansible cp-1 -b -a "kubeadm init"` останавливается на проверках с ошибкой. Приведите узел в порядок средствами Ansible, не отключая проверки, и запустите control plane.', '`ansible cp-1 -b -a "kubeadm init"` fails its checks. Put the node in order with Ansible, without switching the checks off, and start the control plane.'),
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
      prompt: bi('Кластер запустили вчера, срок действия токена из вывода init истёк, а рабочие узлы так и не присоединили. Присоедините оба рабочих узла.', 'The cluster was started yesterday, the token from the init output has expired, and the workers were never joined. Join both workers.'),
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
      prompt: bi('Application `shop` в namespace `argocd` находится в состоянии OutOfSync, потому что кто-то поменял число реплик руками. Верните кластер к Git и сделайте так, чтобы следующая ручная правка не продержалась и минуты.', 'The Application `shop` in the `argocd` namespace shows OutOfSync: someone changed the replica count by hand. Bring the cluster back to Git and make sure the next manual edit does not survive a minute.'),
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
  title: bi('Экзамен блока о том, как пересоздать пропавший стенд из кода', 'Block exam on rebuilding a lost lab from code'),
  intro: bi(
    'Экзамен состоит из шести карточек из трекера задач, и у каждой карточки свой стенд. Проверяется не то, какие команды вы набрали, а то, в каком состоянии оказались машины, узлы, файлы ролей и объекты кластера. Подсказок нет, но открыта встроенная документация: справка `--help`, `ansible-doc`, документация Terraform, kubernetes.io и Argo CD.',
    'The exam is six cards from the task tracker, each on its own stand. What is checked is not the commands you typed but the state of the machines, the nodes, the role files and the cluster objects. There are no hints, but the built-in documentation is open: `--help`, `ansible-doc`, the Terraform docs, kubernetes.io and Argo CD.',
  ),
  story: bi(
    'Ночью у провайдера, на котором работает магазин «Ларёк», случилась авария, и все три машины кластера удалены. В репозитории остался код. Руководитель команды с утра ушёл в отпуск и оставил карточки с задачами: собрать кластер заново, найти, почему код не собирает его с первого раза, вернуть магазин и выдать подрядчику доступ, чтобы он присоединил свой узел. А вечером всё это нужно убрать.',
    'Overnight the provider that runs the shop had an outage, and all three cluster machines are deleted. The code is left in the repository. The team lead went on holiday this morning and left task cards: build the cluster again, find why the code does not build it on the first try, bring the shop back and give a contractor access to join their node. And clean everything up in the evening.',
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
        prompt: bi('Карточка «Машин нет». Закажите три узла кодом из каталога `~/infra` и передайте Ansible инвентарь в файле `~/ops/inventory.ini`.', 'The card “There are no machines”. Order the three nodes with the code in `~/infra` and hand Ansible the inventory in `~/ops/inventory.ini`.'),
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
        prompt: bi('Карточка «Кластера нет». Соберите кластер командой `ansible-playbook site.yml`. Если код не доводит дело до конца, чините код, а не узел, потому что завтра этот код прогонят снова.', 'The card “There is no cluster”. Build it with `ansible-playbook site.yml`. If the code does not get there, fix the code, not the node, because the code will be run again tomorrow.'),
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
        prompt: bi('Карточка «Ночной прогон site.yml красный». Кластер работает, но повторный прогон кода на нём завершается ошибкой. Добейтесь, чтобы на всех узлах в итоговой сводке стояло `changed=0`.', 'The card “The nightly site.yml run is red”. The cluster works, but a repeated run of the code on it fails. Get `changed=0` in the recap of every node.'),
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
        prompt: bi('Карточка «Ночной прогон site.yml красный». Кластер работает, но повторный прогон кода на нём завершается ошибкой. Добейтесь, чтобы на всех узлах в итоговой сводке стояло `changed=0`.', 'The card “The nightly site.yml run is red”. The cluster works, but a repeated run of the code on it fails. Get `changed=0` in the recap of every node.'),
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
        prompt: bi('Карточка «Магазина нет». Магазин должен появиться в namespace `shop` из каталога `k8s` репозитория `team/shop-deploy` и дальше обновляться сам после каждого коммита.', 'The card “There is no shop”. The shop must appear in the `shop` namespace from the `k8s` directory of the `team/shop-deploy` repository and keep updating itself after every commit.'),
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
        prompt: bi('Карточка «Подрядчик сегодня подключит свой узел». Выдайте токен присоединения, который действует не больше двух часов и в описании которого сказано, для кого он выдан.', 'The card “A contractor connects their node today”. Issue a bootstrap token that is valid for no longer than two hours and whose description says who it is for.'),
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
        prompt: bi('Карточка «Вечером стенд не нужен». Удалите всё, что создал код из каталога `~/infra`, и убедитесь, что в облаке не осталось машин курса.', 'The card “The lab is not needed in the evening”. Delete everything the code in `~/infra` created and make sure no course machines are left in the cloud.'),
        check: { when: (f: Facts) => vms(f).length === 0 && (tf(f)?.state.length ?? 1) === 0 && (tf(f)?.serial ?? 0) > 1 },
        concepts: ['iac.resource-label'],
      },
    },
  ],
  explain: [
    { id: 'x1', prompt: bi('Руководитель команды вернулся из отпуска и спрашивает: «Что изменится в нашей работе теперь, когда кластер собирается кодом?» Ответьте ему.', 'The team lead is back from holiday and asks: “What changes in our work now that the cluster is built from code?” Answer them.'), keyPoints: [bi('Потерю машины или всего стенда исправляет новый прогон кода, а не день ручной работы', 'Losing a machine or the whole lab is fixed by a new run of the code, not by a day of manual work'), bi('Второе окружение собирается тем же кодом с другими переменными', 'A second environment is built by the same code with other variables'), bi('Узлы одинаковы по построению, а каждое изменение проверяют коллеги', 'The nodes are identical by construction, and every change goes through review'), bi('Стенд не нужно держать между занятиями, и это экономит деньги', 'The lab need not be kept between sessions, and that saves money')] },
    { id: 'x2', prompt: bi('Зачем в ролях kubeadm стоит параметр creates и чем опасен неудачно выбранный файл-признак?', 'Why do the kubeadm roles have creates, and what is the danger of a badly chosen sign file?'), keyPoints: [bi('Модуль command запускает команду при каждом прогоне, а kubeadm init на готовом узле останавливается на проверках preflight', 'The command module runs the command on every run, and kubeadm init on a ready node fails at preflight'), bi('Параметр creates пропускает задачу, если файл-признак уже есть', 'creates skips the task if the sign file already exists'), bi('Файл-признак должен появляться только при успехе, иначе после неудачного прогона роль сочтёт работу сделанной', 'The sign file must appear only on success, otherwise after a failed run the role considers the job done')] },
  ],
};

export const block: Block = {
  id: 'k8s-3',
  order: route.order,
  title: route.title,
  summary: bi(
    'В этом блоке Terraform заказывает три ВМ с метками, а Ansible готовит узлы ролями. Вы один раз выполняете kubeadm вручную и превращаете его в роли с параметром creates, пересоздаёте кластер с нуля одной последовательностью команд и выкладываете приложение из Git через Argo CD. Затем вы разбираете сроки сертификатов, расхождение версий и обновление по одному узлу, а в конце проходите настоящий трек и обязательно убираете за собой машины.',
    'In this block Terraform orders three labelled VMs and Ansible prepares the nodes with roles. You walk through kubeadm once by hand and turn it into roles with creates, rebuild the cluster from scratch with one sequence of commands and release the application from Git through Argo CD. Then you go through certificate lifetimes, version skew and upgrading node by node, and at the end you do the real track and clean up the machines.',
  ),
  checklistStep: route.checklistStep,
  levels: {
    beginner: bi('Вы прошли блок «Инфраструктура как код» и второй этап Kubernetes. Вы работаете по полному чеклисту: читаете готовые роли, запускаете их и дописываете отмеченные места. В итоге у вас будет кластер из кода и понимание каждого звена цепочки.', 'You have finished the infrastructure-as-code block and Kubernetes stage 2. You work by the full checklist: you read the ready roles, run them and fill in the marked places. In the end you have a cluster from code and an understanding of every link of the chain.'),
    intermediate: bi('Вам дают каркас проекта: структуру каталогов, имена ролей и переменных и пустые файлы задач. В итоге вы напишете роли kubeadm с параметром creates и пересоздадите кластер с нуля без единого ручного шага.', 'You get a project skeleton: the directory layout, role and variable names and empty task files. In the end you write kubeadm roles with creates and rebuild the cluster from scratch without a single manual step.'),
    experienced: bi('Вы пишете всё с нуля по описанию. На настоящем треке вы присоединяете узлы с проверкой CA через delegate_to и run_once, обновляете кластер с serial: 1 и снимаете снимок etcd по расписанию.', 'You write everything from scratch by the description. On the real track you join the nodes with the CA check through delegate_to and run_once, upgrade the cluster with serial: 1 and take a scheduled etcd snapshot.'),
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

