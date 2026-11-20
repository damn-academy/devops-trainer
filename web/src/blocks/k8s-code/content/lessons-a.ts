// Block 9, lessons 1–4: why a cluster from code, the nodes as Terraform code,
// the node preparation as Ansible roles, kubeadm once by hand.

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, Sources } from '../../../core/types';
import { cluster, hostFile, hosts, idempotentRun, inventoryOk, kc, lastOut, lastRun, pingedAll, planNoChanges, readyNodes, tf, threeNodesLabelled } from './checks';
import { ANSIBLE_CFG, CONTAINERD_TEMPLATE, INFRA, OPS, preparedStand, ROLE_CONTAINERD, ROLE_CONTAINERD_HANDLERS, ROLE_PREREQ, stand, TF_CP, TF_HEAD } from './setups';

export const S = {
  kubeadmCreate: { title: 'Kubernetes — Creating a cluster with kubeadm', url: 'https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/' },
  kubeadmInstall: { title: 'Kubernetes — Installing kubeadm', url: 'https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/' },
  runtimes: { title: 'Kubernetes — Container Runtimes', url: 'https://kubernetes.io/docs/setup/production-environment/container-runtimes/' },
  cgroupDriver: { title: 'Kubernetes — Configuring a cgroup driver', url: 'https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/configure-cgroup-driver/' },
  kubeadmConfig: { title: 'Kubernetes — kubeadm Configuration (v1beta4)', url: 'https://kubernetes.io/docs/reference/config-api/kubeadm-config.v1beta4/' },
  kubeadmToken: { title: 'Kubernetes — kubeadm token', url: 'https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-token/' },
  kubeadmJoin: { title: 'Kubernetes — kubeadm join', url: 'https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-join/' },
  tfCount: { title: 'Terraform — The count meta-argument', url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/count' },
  tfOutputs: { title: 'Terraform — Output values', url: 'https://developer.hashicorp.com/terraform/language/values/outputs' },
  tfOutputCmd: { title: 'Terraform — Command: output', url: 'https://developer.hashicorp.com/terraform/cli/commands/output' },
  ansRoles: { title: 'Ansible — Roles', url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html' },
  ansCommand: { title: 'Ansible — ansible.builtin.command module', url: 'https://docs.ansible.com/ansible/latest/collections/ansible/builtin/command_module.html' },
  cilium: { title: 'Cilium — Cilium Quick Installation', url: 'https://docs.cilium.io/en/stable/gettingstarted/k8s-install-default/' },
  petsCattle: { title: 'Randy Bias — The History of Pets vs Cattle', url: 'https://cloudscaling.com/blog/cloud-computing/the-history-of-pets-vs-cattle/' },
  fowlerPhoenix: { title: 'Martin Fowler — PhoenixServer', url: 'https://martinfowler.com/bliki/PhoenixServer.html' },
  argoDocs: { title: 'Argo CD — Declarative Setup', url: 'https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/' },
  argoSync: { title: 'Argo CD — Automated Sync Policy', url: 'https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/' },
  argoDiff: { title: 'Argo CD — Diffing Customization', url: 'https://argo-cd.readthedocs.io/en/stable/user-guide/diffing/' },
  openGitops: { title: 'OpenGitOps — Principles', url: 'https://opengitops.dev/' },
  skew: { title: 'Kubernetes — Version Skew Policy', url: 'https://kubernetes.io/releases/version-skew-policy/' },
  upgrade: { title: 'Kubernetes — Upgrading kubeadm clusters', url: 'https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/' },
  certs: { title: 'Kubernetes — Certificate Management with kubeadm', url: 'https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/' },
  serial: { title: 'Ansible — Controlling playbook execution: strategies and more', url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_strategies.html' },
  hcloud: { title: 'Terraform Registry — hetznercloud/hcloud', url: 'https://registry.terraform.io/providers/hetznercloud/hcloud/latest/docs' },
  argoInstall: { title: 'Argo CD — Getting Started', url: 'https://argo-cd.readthedocs.io/en/stable/getting_started/' },
};

export const R = {
  kubeadmRu: { title: 'Создание кластера с kubeadm — kubernetes.io', url: 'https://kubernetes.io/ru/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/' },
  installRu: { title: 'Установка kubeadm — kubernetes.io', url: 'https://kubernetes.io/ru/docs/setup/production-environment/tools/kubeadm/install-kubeadm/' },
  componentsRu: { title: 'Компоненты Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/concepts/overview/components/' },
  iacRu: { title: 'Инфраструктура как код — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%98%D0%BD%D1%84%D1%80%D0%B0%D1%81%D1%82%D1%80%D1%83%D0%BA%D1%82%D1%83%D1%80%D0%B0_%D0%BA%D0%B0%D0%BA_%D0%BA%D0%BE%D0%B4' },
  terraformRu: { title: 'Terraform — Википедия', url: 'https://ru.wikipedia.org/wiki/Terraform' },
  ansibleRu: { title: 'Ansible — Википедия', url: 'https://ru.wikipedia.org/wiki/Ansible' },
  kubernetesRu: { title: 'Kubernetes — Википедия', url: 'https://ru.wikipedia.org/wiki/Kubernetes' },
  gitRu: { title: 'Git — Википедия', url: 'https://ru.wikipedia.org/wiki/Git' },
  conceptsRu: { title: 'Концепции Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/concepts/' },
  setupRu: { title: 'Установка Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/setup/' },
};

const src = (en: { title: string; url: string }[], ru: { title: string; url: string }[]): Sources => ({ en, ru });
const inv = `${OPS}/inventory.ini`;
/** The inventory output as Terraform recorded it in the state, after apply. */
function inventoryOutput(f: Facts): string {
  try {
    const st = JSON.parse(f.files[`${INFRA}/terraform.tfstate`]?.text ?? '{}') as { outputs?: { inventory?: { value?: unknown } } };
    return String(st.outputs?.inventory?.value ?? '');
  } catch {
    return '';
  }
}
/** A failing explanation only after the learner has run a playbook, not when the lab has just opened. */
const afterRun = (cond: (f: Facts) => boolean) => (f: Facts) => !!lastRun(f) && cond(f);

// ── 1. plan ──

export const L_PLAN: Lesson = {
  id: 'k8s-3.plan',
  block: 'k8s-3',
  title: bi('Кластер, который не жалко удалить', 'A cluster you can afford to delete'),
  summary: bi('Зачем собирать кластер кодом, из каких звеньев состоит эта цепочка и что каждое звено передаёт следующему.', 'Why build a cluster with code, which links the chain consists of and what each one hands to the next.'),
  introduces: ['k8s.rebuildable', 'iac.resource-label'],
  uses: ['k8s.kubeadm', 'iac.iac', 'iac.idempotence', 'iac.state', 'iac.playbook'],
  tier: 'core',
  minutes: 25,
  sources: src([S.petsCattle, S.fowlerPhoenix, S.kubeadmCreate], [R.iacRu, R.setupRu]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'На втором этапе Kubernetes вы собрали кластер руками: заказали три машины, подготовили каждую, запустили kubeadm init, поставили сеть подов и присоединили рабочие узлы. На это ушёл целый день, и кластер работает. Теперь представьте утро понедельника. Провайдер сообщает, что машина `worker-2` пропала вместе с диском. Руководитель команды просит к пятнице второй такой же кластер для нагрузочного теста. А аудитор спрашивает, как настроены узлы и одинаково ли они настроены.\n\nУ кластера, собранного руками, на все три вопроса один ответ: снова целый день работы, и результат снова получится немного другим. В этом блоке вы соберёте тот же кластер так, чтобы на все три вопроса отвечала одна последовательность команд.',
        'In stage 2 you put a kubeadm cluster together by hand: three machines, preparing each, init, the network, join. It took a whole day, and the cluster works. Now picture a Monday morning. The provider writes that the machine `worker-2` is lost together with its disk. The team lead asks for a second identical cluster by Friday for a load test. And an auditor asks how exactly the nodes are configured and whether they are identical.\n\nA hand-made cluster has one answer to all three questions: another whole day, and the result will again be a little different. In this block you build the same cluster so that one sequence of commands answers all three.',
      ),
    },
    {
      id: 'idea',
      kind: 'text',
      step: 'explain',
      title: bi('Почему одни серверы берегут, как питомцев, а другие заменяют, как животных в стаде', 'Why some servers are nursed like pets and others replaced like cattle'),
      body: bi(
        'Инженеры давно делят серверы на два рода и для этого пользуются сравнением из сельского хозяйства. Питомцу дают имя, его лечат, когда он заболел, и боятся потерять, потому что второго такого нет. Животные в стаде пронумерованы, и заболевшее животное заменяют новым, так что стадо этого не замечает. Кластер, собранный руками, остаётся питомцем, как бы аккуратно его ни собирали. По-английски это сравнение называют pets vs cattle, и на собеседованиях о нём спрашивают часто. Хороший ответ звучит так: рабочие серверы должны быть стадом, то есть сломанный сервер не чинят руками, а заменяют новым, собранным из того же кода.\n\n[[k8s.rebuildable|Пересоздаваемым кластером]] называют кластер, который можно в любой момент удалить и собрать снова из репозитория, не сделав ни одного шага руками. Это не значит, что его часто удаляют. Это значит, что удаление перестаёт быть катастрофой. Потерянный узел заменяется новым прогоном кода, второе окружение собирается тем же кодом с другими переменными, а на вопрос аудитора отвечает ссылка на репозиторий.\n\nВсё, что для этого нужно, вы уже знаете по отдельности. Блок «Инфраструктура как код» научил вас описывать машины и их настройку файлами, и такой подход называют [[iac.iac|инфраструктурой как код]]. Там же вы узнали, что Ansible и Terraform [[iac.idempotence|идемпотентны]]: описание можно прогонять сколько угодно раз, и повторный прогон меняет только то, что расходится с описанием. А на втором этапе Kubernetes вы ставили control plane программой [[k8s.kubeadm|kubeadm]]. Этот блок соединяет всё это в одну цепочку.',
        'Engineers have long divided servers into two kinds. A pet gets a name, is nursed when ill and you fear losing it, because there is no second one like it. Cattle are numbered: a sick animal is replaced by a new one, and the herd does not notice. A hand-made cluster is a pet, however carefully it was assembled. The comparison is known as pets vs cattle, and interviewers ask about it often. A good answer goes like this: working servers should be cattle, that is, a broken server is not repaired by hand but replaced with a new one built from the same code.\n\nA [[k8s.rebuildable|rebuildable cluster]] is one that can be deleted at any moment and built again from a repository, without a single manual step. That does not mean it is often deleted. It means deletion stops being a disaster: a lost node is replaced by a run of the code, a second environment by the same code with other variables, and the answer to the auditor is a link to the repository.\n\nYou already know everything this needs, piece by piece. The infrastructure-as-code block taught you to describe machines and their setup in files: that is [[iac.iac|infrastructure as code]]. There you also learned that Ansible and Terraform are [[iac.idempotence|idempotent]]: the description can be run any number of times, and a repeated run changes only what differs from it. And in stage 2 you installed the control plane with [[k8s.kubeadm|kubeadm]]. This block joins them into one chain.',
      ),
    },
    {
      id: 'chain',
      kind: 'text',
      step: 'explain',
      title: bi('Из каких звеньев состоит цепочка', 'A chain of four links'),
      body: bi(
        'Каждое звено цепочки делает одно дело и передаёт следующему звену то, что тому нужно для работы.\n\n1. **Terraform** заказывает в облаке сеть и три виртуальные машины. Адреса машин становятся известны только после того, как облако их создало, и Terraform выдаёт эти адреса наружу. Из них собирается инвентарь, то есть список машин для Ansible.\n2. **Ansible** приводит машины к тому состоянию, которого ждёт kubeadm: выключает swap, разрешает ядру пересылать пакеты, настраивает containerd и ставит пакеты Kubernetes нужной версии. Всё это описано ролями, одинаковыми для всех узлов.\n3. **Роль с kubeadm** запускает control plane на первом узле и присоединяет к нему остальные узлы. Роль вызывает kubeadm только там, где кластера ещё нет, поэтому её тоже можно прогонять повторно.\n4. **Приложение** попадает в кластер из Git, и этому звену посвящён отдельный урок.\n\nМежду звеньями ничего не копируют руками. Если переписать адрес машины из консоли облака на бумажку или в файл, кластер перестанет быть пересоздаваемым: после следующего пересоздания у машины будет другой адрес, а на бумажке останется прежний.\n\n### Метки и деньги\n\nВсё, что создаёт курс, получает [[iac.resource-label|метку ресурса]] `trainer=devops`. По этой метке машины находят, считают и удаляют, и по ней же после уборки проверяют, что в облаке ничего не осталось. Облако берёт плату за каждый час каждой машины, нужна она вам в этот час или нет, поэтому три машины, забытые на месяц, набирают 3 × 730 = 2190 ВМ-часов. Пересоздаваемый кластер решает и эту задачу: держать его между занятиями незачем, потому что он собирается заново за несколько минут.',
        'Each link does one job and hands the next exactly what it needs.\n\n1. **Terraform** orders the machines: a network and three VMs. It hands out what it learns only after creation — the addresses. The Ansible inventory is assembled from them.\n2. **Ansible** brings the machines to the state kubeadm expects: swap off, the kernel forwarding packets, containerd configured, Kubernetes packages of the right version. This is described by roles, the same for all nodes.\n3. **kubeadm in a role** brings up the control plane on the first node and joins the others. The role runs kubeadm only where there is no cluster yet, so it too can be run again.\n4. **The application** comes into the cluster from Git — a separate lesson is about this link.\n\nThere is no manual copying between the links. If a machine address is copied by hand from the cloud console, the cluster stops being rebuildable: after the next rebuild the address is different and the note is the same.\n\n### Labels and money\n\nEverything the course creates gets the [[iac.resource-label|resource label]] `trainer=devops`. Machines are found, counted and deleted by it, and it is how you check that nothing is left after the cleanup. Three VMs run every hour whether you need them that hour or not; a lab forgotten for a month is 3 × 730 = 2190 VM-hours. A rebuildable cluster solves this too: you do not need to keep it between sessions, because it comes back in minutes.',
      ),
    },
    {
      id: 'beginner',
      kind: 'callout',
      tone: 'note',
      levels: ['beginner'],
      title: bi('Если цепочка пока кажется длинной', 'If all of this still looks long'),
      body: bi('Думайте о цепочке как о рецепте, а не о готовом блюде. Повар, у которого есть только блюдо, после неудачи начинает с нуля и готовит по памяти, а повар с рецептом готовит второе такое же блюдо. В этом блоке вы пишете рецепт, а стенд в браузере готовит по нему.', 'Think of the chain as a recipe, not a dish. A cook who has only the dish starts from scratch and from memory after a failure; a cook with the recipe makes a second one just like it. In this block you write the recipe, and the stand in the browser cooks by it.'),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как цепочка собирает кластер', 'How the chain builds the cluster'),
      body: bi(
        'Схема ниже в замедленном виде показывает, что происходит, когда вы прогоняете код кластера в пустом облаке. В верхнем ряду стоят репозиторий с кодом, команда `terraform apply`, API облака и файл инвентаря, который выдаёт Terraform. Под ними работает Ansible, ещё ниже три машины будущего кластера, а в самом низу компоненты control plane и сеть подов Cilium. Каждое звено появляется на схеме тогда, когда до него доходит цепочка.\n\nНа схеме встречаются два слова, которые подробно разберут следующие уроки. Выходное значение Terraform (output) отдаёт наружу то, что Terraform узнал после создания машин, например их адреса. Параметр `creates` у задачи Ansible называет файл, по которому видно, что команда уже выполнена, и тогда повторный прогон эту команду пропускает.',
        'The diagram below shows in slow motion what happens when you run the cluster code in an empty cloud. The top row holds the code repository, `terraform apply`, the cloud API and the inventory file Terraform produces. Below them Ansible works, lower still the three machines of the future cluster, and at the bottom the control-plane components and the Cilium pod network. Each link appears when the chain reaches it.\n\nTwo words on the diagram are explained in detail by the next lessons. A Terraform output hands out what Terraform learned after creating the machines, such as their addresses. The `creates` parameter of an Ansible task names a file that shows the command has already run, and then a repeated run skips that command.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'k8s-3.from-code',
      howto: bi(
        'Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен тот участник, который работает сейчас, а облачко рядом с ним полным предложением говорит, что он делает. По линиям движется карточка с тем, что передаётся дальше: файлы кода, число новых машин, адрес control plane, роли подготовки, токен присоединения. Под схемой копятся счётчики: сколько машин в облаке, через сколько минут кластер готов, сколько задач что-то изменили и сколько ВМ-часов наберёт забытый стенд. Значки и цвета объясняет легенда «Как читать схему».\n\nКогда пройдёте первый прогон до трёх узлов Ready, откройте «Параметры» и выберите в поле «Какой прогон кода показать» повторный прогон. Убедитесь, что ни одна задача ничего не меняет, а потом включите в блоке «Сломать» поломку, при которой у задачи kubeadm init нет параметра creates. Затем выберите удаление машин и сборку кластера заново и включите поломку с неверным cp_endpoint в инвентаре: вы увидите, на каком шаге рабочие узлы не находят control plane.',
        'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the participant working now is highlighted, and the callout next to it says in a full sentence what it does. A card travels along the lines with what is handed on: the code files, the number of new machines, the control-plane address, the preparation roles, the bootstrap token. The counters under the diagram add up: machines in the cloud, minutes to a ready cluster, tasks that changed something and the VM-hours of a forgotten lab. The “How to read the diagram” legend explains the marks and colours.\n\nOnce the first run reaches three Ready nodes, open “Parameters” and choose the repeated run in “Which run of the code to show”. Make sure no task changes anything, then switch on the break in “Break it” where the kubeadm init task has no creates. Then choose deleting the machines and building the cluster again and switch on the break with a wrong cp_endpoint: you will see at which step the workers fail to find the control plane.',
      ),
      caption: bi(
        'Каждое звено, которое вы видели на схеме, следующие уроки разбирают по отдельности, и каждое вы напишете сами. В следующем уроке вы опишете машины кодом Terraform и получите инвентарь из output, в уроке после него напишете роли подготовки, а потом превратите kubeadm в роль с параметром creates. Сообщения инструментов, которые схема показывала при поломках, встретятся вам на стенде в тех же местах.',
        'Each link you saw on the diagram gets its own lesson, and you write each one yourself. In the next lesson you describe the machines in Terraform code and get the inventory from an output; after that you write the preparation roles, and then you turn kubeadm into a role with creates. The tool messages the diagram showed for the breaks will meet you on the stand in the same places.',
      ),
    },
    { id: 'cost', kind: 'callout', tone: 'cost', title: bi('Сколько стоит стенд', 'What the lab costs'), body: bi('Весь блок проходит на стенде в браузере и ничего не стоит. Настоящий трек в конце блока, то есть работа в настоящем облаке, требует трёх машин по 2 vCPU и 4 ГБ памяти на один рабочий день. Посчитайте его заранее по сегодняшней цене своего провайдера и посмотрите на последнюю колонку таблицы: так выглядит счёт за стенд, который забыли убрать.', 'The whole block runs on the stand in the browser and costs nothing. The real track at the end of the block is three VMs with 2 vCPU and 4 GB for one working day. Work it out in advance at your provider’s price today and look at the last column: this is the bill for a lab nobody cleaned up.') },
    { id: 'cost-table', kind: 'widget', widget: 'k8s.cost', props: { vms: 3, hours: 8 } },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s-3.q.why-code', 'k8s-3.q.chain', 'k8s-3.q.label'] },
  ],
};

// ── 2. nodes ──

const MAIN_ONE = TF_HEAD + TF_CP;

export const L_NODES: Lesson = {
  id: 'k8s-3.nodes',
  block: 'k8s-3',
  title: bi('Как описать узлы кодом Terraform и получить из него инвентарь', 'How to describe the nodes in Terraform code and get an inventory from it'),
  summary: bi('Как описать три машины одним ресурсом с count, поставить на каждую метку trainer=devops и получить инвентарь Ansible, который Terraform выдаёт сам.', 'Three VMs as one resource with count, the trainer=devops label on each and an Ansible inventory that Terraform produces itself.'),
  introduces: ['iac.count', 'iac.output'],
  uses: ['iac.resource', 'iac.plan', 'iac.state', 'iac.inventory', 'iac.resource-label', 'k8s.rebuildable'],
  tier: 'core',
  minutes: 35,
  sources: src([S.tfCount, S.tfOutputs, S.tfOutputCmd], [R.terraformRu, R.iacRu]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Узлы кластера почти одинаковы: у них тот же образ, тот же размер и та же сеть. Если описывать каждый узел отдельным блоком, одно и то же придётся написать трижды, и ошибиться тоже можно трижды. Мета-аргумент [[iac.count|count]] говорит Terraform, сколько одинаковых экземпляров нужно создать из одного блока [[iac.resource|ресурса]]:\n\n```hcl\nresource "edu_vm" "worker" {\n  count      = 2\n  name       = "worker-${count.index + 1}"\n  image      = "ubuntu-24.04"\n  memory_gb  = 4\n  network_id = edu_network.k8s.id\n  labels     = { trainer = "devops", role = "worker" }\n}\n```\n\nВыражение `count.index` даёт номер экземпляра, и нумерация начинается с нуля, поэтому имена получаются `worker-1` и `worker-2`. В [[iac.state|state]] эти машины записаны как два объекта, `edu_vm.worker[0]` и `edu_vm.worker[1]`. Если завтра поставить `count = 3`, план предложит создать один новый экземпляр, `[2]`, и не тронет первые два. Control plane описан отдельным ресурсом, потому что у этой машины другая роль: у неё своя метка `role`, и её размер можно потом поменять, не трогая блок рабочих узлов.\n\nМетки задаются картой `labels`. Метка `trainer=devops` нужна курсу для уборки, а метка `role` нужна людям: по ней в консоли облака сразу видно, какой узел для чего.\n\n### Что Terraform отдаёт наружу\n\nАдреса машин выдаёт облако, и до `apply` их не знает никто. Выходное значение конфигурации, [[iac.output|output]], сообщает то, что Terraform узнал после применения. Полезнее всего, когда конфигурация узлов выдаёт готовый [[iac.inventory|инвентарь]] Ansible:\n\n```hcl\noutput "inventory" {\n  value = "[control_plane]\\ncp-1 ansible_host=${edu_vm.cp.public_ip}\\n\\n[workers]\\n…\\n\\n[all:vars]\\ncp_endpoint=${edu_vm.cp.private_ip}:6443\\n"\n}\n```\n\nГруппы `control_plane` и `workers` скажут Ansible, на какой машине ставить control plane, а переменная `cp_endpoint` скажет рабочим узлам, к какому адресу обращаться, когда они будут присоединяться к кластеру. Команда `terraform output inventory` печатает значение в кавычках, так, как его видит Terraform. Ключ `-raw` печатает саму строку без кавычек, и её можно сразу записать в файл:\n\n```bash\nterraform output -raw inventory > ../ops/inventory.ini\n```\n\nПосле этого между облаком и Ansible не остаётся ни одного адреса, переписанного руками.',
        'Cluster nodes are almost identical: the same image, the same size, the same network. Describing each with its own block means repeating the same thing three times and making three mistakes. The [[iac.count|count]] meta-argument tells Terraform how many identical instances to create from one [[iac.resource|resource]] block:\n\n```hcl\nresource "edu_vm" "worker" {\n  count      = 2\n  name       = "worker-${count.index + 1}"\n  image      = "ubuntu-24.04"\n  memory_gb  = 4\n  network_id = edu_network.k8s.id\n  labels     = { trainer = "devops", role = "worker" }\n}\n```\n\n`count.index` is the instance number, starting from zero, so the names come out as `worker-1` and `worker-2`. In the [[iac.state|state]] these are two objects: `edu_vm.worker[0]` and `edu_vm.worker[1]`. Set `count = 3` tomorrow and the plan proposes to create one new instance, `[2]`, and leaves the first two alone. The control plane is a separate resource, because that machine has another role: it has its own `role` label, and its size can later be changed without touching the workers block.\n\nLabels are set with the `labels` map. The `trainer=devops` label is there for the course cleanup, `role` for people: in the cloud console you see at once which node is which.\n\n### What Terraform hands out\n\nThe cloud hands out the machine addresses, and before `apply` nobody knows them. An [[iac.output|output]] is an output value of the configuration: what it reports after it is applied. The most useful thing a node configuration can produce is a ready Ansible [[iac.inventory|inventory]]:\n\n```hcl\noutput "inventory" {\n  value = "[control_plane]\\ncp-1 ansible_host=${edu_vm.cp.public_ip}\\n\\n[workers]\\n…\\n\\n[all:vars]\\ncp_endpoint=${edu_vm.cp.private_ip}:6443\\n"\n}\n```\n\nThe `control_plane` and `workers` groups tell Ansible where to put the control plane, and the `cp_endpoint` variable tells the workers where to go for join. `terraform output inventory` prints the value in quotes, as Terraform sees it; the `-raw` key prints the string itself, and it can go straight into a file:\n\n```bash\nterraform output -raw inventory > ../ops/inventory.ini\n```\n\nAfter that not a single address copied by hand stays between the cloud and Ansible.',
      ),
    },
    {
      id: 'experienced',
      kind: 'callout',
      tone: 'why',
      levels: ['experienced'],
      title: bi('Когда вместо count берут for_each', 'count or for_each'),
      body: bi('При count адресом экземпляра служит его номер. Если убрать узел из середины списка, все узлы после него сдвинутся, и план предложит пересоздать их. Поэтому для узлов, которые различаются ролью, в настоящих проектах пишут `for_each` по карте `{ cp-1 = "control-plane", worker-1 = "worker" }`. Тогда адресом экземпляра становится ключ карты, и удаление одного узла не задевает остальные. Сам узел удобно вынести в модуль `k8s-node`, который получает роль на входе и отдаёт адреса на выходе.', 'With count an instance address is a number. Remove a node from the middle of the list and everyone behind it shifts: the plan proposes to recreate them. For nodes that differ by role, real projects use `for_each` over a map `{ cp-1 = "control-plane", worker-1 = "worker" }`: the address becomes a key, and deleting one node leaves the others alone. The node itself is handy as a `k8s-node` module with a role as input and addresses as output.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: stand({ main: MAIN_ONE }),
      intro: bi('В файле `~/infra/main.tf` уже описаны сеть и control plane `cp-1`. Облако пока пустое, и команда `edu vm list` это покажет. В каталоге `~/ops` лежит только `ansible.cfg`, а инвентарь должен прийти из Terraform.', '`~/infra/main.tf` already describes the network and the control plane `cp-1`. The cloud is empty (`edu vm list`). `~/ops` holds only `ansible.cfg`: the inventory must come from Terraform.'),
      tasks: [
        {
          id: 'workers',
          prompt: bi('Добавьте два рабочих узла одним ресурсом `edu_vm.worker` с `count`. Узлы должны называться `worker-1` и `worker-2`, получить 4 ГБ памяти и ту же сеть, а также метки `trainer = "devops"` и `role = "worker"`. В тот же файл добавьте output `inventory` с группами `[control_plane]`, где стоит cp-1, и `[workers]`, где стоят worker-1 и worker-2, а в раздел `[all:vars]` поместите строку `cp_endpoint=<частный адрес cp-1>:6443`. Примените код, и в облаке должно оказаться три ВМ, у каждой из которых есть метка курса.', 'Add two workers as one `edu_vm.worker` resource with `count`: the names `worker-1` and `worker-2`, 4 GB of memory, the same network, the labels `trainer = "devops"` and `role = "worker"`. In the same file add an output `inventory` with the groups `[control_plane]` (cp-1) and `[workers]` (worker-1, worker-2) and the line `cp_endpoint=<cp-1 private address>:6443` under `[all:vars]`. Apply — the cloud must hold three VMs, all with the course label.'),
          check: {
            when: (f: Facts) => threeNodesLabelled(f) && (tf(f)?.state.some((s) => s.address === 'edu_vm.worker[1]') ?? false) && /cp_endpoint=\d/.test(inventoryOutput(f)),
            fail: [
              { if: (f: Facts) => threeNodesLabelled(f) && !inventoryOutput(f), say: bi('Машины созданы, но в state нет output inventory. Добавьте блок output "inventory" в main.tf и снова выполните terraform apply.', 'The machines exist, but the state has no inventory output. Add an output "inventory" block to main.tf and run terraform apply again.') },
              { if: (f: Facts) => (tf(f)?.state ?? []).some((s) => /^edu_vm\.worker_?\d|^edu_vm\.worker2/.test(s.address)), say: bi('Рабочие узлы описаны отдельными блоками. Нужен один блок с count, и тогда в state у машин будут адреса edu_vm.worker[0] и edu_vm.worker[1].', 'The workers are described by separate blocks. You need one block with count — then their addresses are edu_vm.worker[0] and [1].') },
              { if: (f: Facts) => (kc(f)?.vms ?? []).some((v) => v.labels.trainer !== 'devops'), say: bi('Не у всех ВМ есть метка trainer = "devops", а уборка по метке такую машину не найдёт.', 'Not every VM has the trainer = "devops" label: a cleanup by label will not find such a machine.') },
            ],
          },
          chips: 'terraform init && terraform apply',
          concepts: ['iac.count', 'iac.resource-label'],
          hints: {
            H1: bi('Нужен один блок resource "edu_vm" "worker" с аргументом count = 2, а имя каждой машины строится из count.index.', 'One resource "edu_vm" "worker" block and the argument count = 2; the name is built from count.index.'),
            H2: bi('Имя задаётся так: `name = "worker-${count.index + 1}"`, потому что индекс начинается с нуля. Значение output записывается одной строкой, в которой строки инвентаря разделены символами \\n, а адреса подставлены ссылками ${edu_vm.cp.private_ip}, ${edu_vm.worker[0].name} и так далее.', '`name = "worker-${count.index + 1}"`: the index starts from zero. The output value is a string with \\n between the inventory lines and references ${edu_vm.cp.private_ip}, ${edu_vm.worker[0].name}…'),
          },
        },
        {
          id: 'inventory',
          prompt: bi('Запишите инвентарь из output в файл `~/ops/inventory.ini` и проверьте модулем ping, что Ansible может подключиться ко всем трём узлам.', 'Write the inventory from the output to `~/ops/inventory.ini` and check the connection to all three nodes with the ping module.'),
          check: {
            when: (f: Facts) => inventoryOk(f, inv) && pingedAll(f),
            fail: [{ if: (f: Facts) => /cp_endpoint=203\.0\.113/.test(f.files[inv]?.text ?? ''), say: bi('В cp_endpoint записан публичный адрес. Узлы обмениваются данными друг с другом по частной сети, поэтому здесь нужен private_ip.', 'cp_endpoint holds the public address. Nodes talk to each other over the private network: you need private_ip.') }],
          },
          chips: 'terraform output -raw inventory > ../ops/inventory.ini',
          concepts: ['iac.output', 'iac.inventory'],
          docRef: { url: 'https://developer.hashicorp.com/terraform/cli/commands/output', label: 'terraform output · -raw' },
          hints: {
            H1: bi('Ключ -raw печатает строку без кавычек, и её остаётся перенаправить в файл. После этого перейдите в каталог ~/ops командой cd и выполните ansible all -m ansible.builtin.ping.', 'The -raw key prints the string without quotes; redirect it into the file. Then: cd ~/ops and ansible all -m ansible.builtin.ping.'),
          },
        },
        {
          id: 'nochanges',
          prompt: bi('Убедитесь, что код и облако совпадают, то есть что план не предлагает ни одного изменения.', 'Make sure the code and the cloud match: a plan with not a single change.'),
          check: { when: planNoChanges },
          chips: 'terraform plan',
          concepts: ['iac.plan'],
          hints: { H1: bi('Запустите план в каталоге ~/infra и найдите в выводе строку No changes.', 'The command in ~/infra; the expected line is No changes.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s-3.q.count-addr', 'k8s-3.q.output', 'k8s-3.q.no-changes'] },
  ],
};

// ── 3. prepare ──

const prepareOps = [
  { path: `${OPS}/ansible.cfg`, content: ANSIBLE_CFG },
  { path: `${OPS}/prepare.yml`, content: '- name: Every node is ready for kubeadm\n  hosts: all\n  become: true\n  roles:\n    - k8s_prereq\n    - containerd\n    - kube_packages\n' },
  { path: `${OPS}/roles/k8s_prereq/tasks/main.yml`, content: '# swap, kernel modules, IPv4 forwarding\n' },
  { path: `${OPS}/roles/containerd/tasks/main.yml`, content: ROLE_CONTAINERD },
  { path: `${OPS}/roles/containerd/handlers/main.yml`, content: ROLE_CONTAINERD_HANDLERS },
  { path: `${OPS}/roles/containerd/templates/config.toml.j2`, content: CONTAINERD_TEMPLATE },
  { path: `${OPS}/roles/containerd/defaults/main.yml`, content: 'containerd_systemd_cgroup: false\n' },
  { path: `${OPS}/roles/kube_packages/tasks/main.yml`, content: '# the pkgs.k8s.io v1.36 repository, kubelet kubeadm kubectl of one version\n' },
];

export const L_PREPARE: Lesson = {
  id: 'k8s-3.prepare',
  block: 'k8s-3',
  title: bi('Как подготовить узлы тремя ролями Ansible', 'How to prepare the nodes with three Ansible roles'),
  summary: bi('Как выключить swap, включить пересылку пакетов и модули ядра, настроить containerd на драйвер cgroup systemd и поставить пакеты Kubernetes закреплённой версии ролями, которые при повторном прогоне ничего не меняют.', 'Swap, packet forwarding, kernel modules, containerd with the systemd cgroup driver and Kubernetes packages of a pinned version — as roles that change nothing on the second run.'),
  introduces: ['k8s.version-pin'],
  uses: ['iac.role', 'iac.playbook', 'iac.handler', 'iac.idempotence', 'iac.module', 'k8s.kubelet', 'k8s.kubeadm', 'k8s.cgroup-driver'],
  tier: 'core',
  minutes: 40,
  sources: src([S.kubeadmInstall, S.runtimes, S.cgroupDriver, S.ansRoles], [R.installRu, R.ansibleRu]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Перед работой kubeadm проверяет узел, но ничего на нём не исправляет. Поэтому всё, чего он ждёт, должно быть сделано заранее и одинаково на всех машинах. На втором этапе Kubernetes вы готовили каждую машину командами по инструкции, а теперь те же шаги нужно записать ролями.\n\n**Swap должен быть выключен.** [[k8s.kubelet|kubelet]], агент Kubernetes на каждом узле, по умолчанию отказывается работать со swap. Он распределяет память между подами по их запросам и ограничениям (requests и limits) и должен видеть настоящую память машины. Выключить swap один раз командой `swapoff -a` недостаточно: после перезагрузки его снова включит строка в файле `/etc/fstab`. Поэтому роль удаляет эту строку. Удаление строки подействует только после перезагрузки, так что на настоящих машинах рядом с этой задачей ставят ещё одну, которая выполняет `swapoff -a` и выключает swap сразу. Эту задачу вы добавите в последнем уроке блока, когда перенесёте роли на настоящие машины.\n\n**Узел должен пересылать пакеты.** Пакеты подов приходят на один сетевой интерфейс узла и уходят через другой. Ядро пересылает их так, только если параметр `net.ipv4.ip_forward` равен 1, и kubeadm проверяет этот параметр одним из первых. Значение записывают в каталог `/etc/sysctl.d/`, чтобы оно сохранялось после перезагрузки.\n\n**Нужны модули ядра Linux.** Модулем ядра называют часть ядра, которую загружают отдельно, когда она понадобилась. Не путайте его с модулем Ansible, о котором речь пойдёт ниже: это два разных значения одного слова. Модуль ядра `overlay` нужен containerd, чтобы собирать файловую систему контейнера из слоёв образа. Модуль ядра `br_netfilter` нужен подам, которые работают на одном узле. Они подключены к сетевому мосту, то есть к виртуальному коммутатору внутри машины, и без этого модуля пакеты, которые идут через мост, минуют netfilter. Так называется подсистема ядра, которая применяет правила межсетевого экрана и подмены адресов, а на этих правилах Kubernetes строит доставку пакетов к сервисам. Список модулей ядра, которые загружаются при старте машины, хранится в каталоге `/etc/modules-load.d/`.\n\n**containerd должен работать с драйвером cgroup systemd.** Ограничения памяти и процессора для каждого пода ядро задаёт через cgroup. [[k8s.cgroup-driver|Драйвер cgroup]] определяет, кто создаёт эти cgroup: сам systemd или программа напрямую. На машине с systemd всё дерево cgroup уже принадлежит systemd, поэтому kubelet и среда запуска контейнеров тоже должны обращаться к нему. Если у одного дерева два хозяина, которые не знают друг о друге, под нагрузкой они начинают по-разному распределять ресурсы. Драйвер systemd для kubelet kubeadm настраивает сам, а containerd об этом нужно сказать в файле `config.toml` строкой `SystemdCgroup = true`. После правки конфигурации containerd перезапускают, и это работа для [[iac.handler|обработчика]] (handler).\n\n**Пакеты Kubernetes должны быть закреплённой версии.** Программы kubelet, kubeadm и kubectl ставятся из репозитория `pkgs.k8s.io`, разделённого по минорным версиям, поэтому ветка `v1.36` никогда не принесёт версию 1.37. Но внутри ветки выходят новые патч-версии, и узел, созданный через полгода, получит более новую патч-версию, чем его соседи. Поэтому версию пакета записывают в коде явно, и такую версию называют [[k8s.version-pin|закреплённой]]. На настоящих машинах пакет, кроме того, удерживают от обновления командой `apt upgrade` модулем `ansible.builtin.dpkg_selections`.\n\n### Как раскладывают подготовку по ролям\n\nВсю подготовку раскладывают на три [[iac.role|роли Ansible]]: `k8s_prereq` отвечает за swap, модули ядра и sysctl, `containerd` отвечает за среду запуска контейнеров, а `kube_packages` отвечает за пакеты Kubernetes. Каждая роль состоит из задач, и каждая задача вызывает [[iac.module|модуль Ansible]], который описывает состояние. Модуль Ansible `lineinfile` с `state: absent` удаляет строку swap, модуль `copy` создаёт два файла (список модулей ядра и настройку sysctl), модуль `template` пишет конфигурацию containerd, а модуль `apt` ставит пакеты. При повторном прогоне каждая задача должна ответить ok. В настоящем проекте параметры sysctl и модули ядра удобнее задавать модулями Ansible `ansible.posix.sysctl` и `community.general.modprobe`, потому что они ещё и применяют значение сразу. На стенде есть только модули `ansible.builtin`, и файлов там достаточно.',
        'kubeadm checks a node before working, but it does not fix it. Everything it expects must be done in advance and the same way on every machine. In stage 2 you prepared every machine with commands from a guide; now the same steps have to be written down as roles.\n\n**Swap is off.** By default the [[k8s.kubelet|kubelet]], the Kubernetes agent on every node, refuses to run with swap: it shares memory between pods by their requests and limits and must see the real memory of the machine. Turning swap off once with `swapoff -a` is not enough: after a reboot the line in `/etc/fstab` brings it back. So the role removes this line. Removing it takes effect only after a reboot, so on real machines another task goes next to this one: it runs `swapoff -a` and turns swap off at once. You add that task in the last lesson of the block, when you move the roles to real machines.\n\n**The node forwards packets.** Pod packets arrive on one interface of the node and leave through another. The kernel does that only if `net.ipv4.ip_forward = 1`; kubeadm checks this parameter first of all. The value goes into `/etc/sysctl.d/` so that it survives a reboot.\n\n**Linux kernel modules.** A kernel module is a part of the kernel that is loaded separately, when it is needed. Do not confuse it with an Ansible module, which comes up below: these are two different meanings of one word. The `overlay` kernel module is needed by containerd to assemble a container file system from the image layers. The `br_netfilter` kernel module is needed by the pods running on one node. They are plugged into a network bridge, that is, a virtual switch inside the machine, and without this module packets going through the bridge bypass netfilter. That is the kernel subsystem that applies the firewall and address translation rules, and Kubernetes builds packet delivery to services on these rules. The list of kernel modules loaded at boot is kept in `/etc/modules-load.d/`.\n\n**containerd and the cgroup driver.** The memory and CPU limits of every pod are cgroups. The [[k8s.cgroup-driver|cgroup driver]] is the way they are created: through systemd or directly. On a machine with systemd the cgroup tree already belongs to systemd, and the kubelet and the runtime must go through it too; two owners of one tree that know nothing of each other start arguing about resources under load. kubeadm sets the kubelet to systemd itself, and containerd has to be told in `config.toml`: `SystemdCgroup = true`. After the configuration changes containerd is restarted — a job for a [[iac.handler|handler]].\n\n**Packages of a pinned version.** kubelet, kubeadm and kubectl come from the `pkgs.k8s.io` repository, which is split by minor version: the `v1.36` branch does not bring 1.37. But patch versions keep coming out in the branch, and a node created half a year later gets a newer one than its neighbours. So the version is written in the code explicitly — a [[k8s.version-pin|pinned version]] — and on real machines the package is also held against `apt upgrade` with the `ansible.builtin.dpkg_selections` module.\n\n### Roles\n\nAll this is laid out as three [[iac.role|Ansible roles]]: `k8s_prereq` (swap, modules, sysctl), `containerd` and `kube_packages`. Each role consists of tasks, and each task calls an [[iac.module|Ansible module]] that describes a state. The Ansible module `lineinfile` with `state: absent` removes the swap line, `copy` creates two files, the kernel module list and the sysctl setting, `template` writes the containerd configuration, and `apt` installs the packages. On the second run every task must answer ok. In a real project sysctl values and kernel modules are handier with the Ansible modules `ansible.posix.sysctl` and `community.general.modprobe` — they also apply the value at once; the stand has only `ansible.builtin`, and files are enough.',
      ),
    },
    {
      id: 'read-role',
      kind: 'text',
      step: 'look',
      levels: ['beginner'],
      title: bi('Прочитайте готовую роль k8s_prereq до лабораторной', 'A ready k8s_prereq role — read it before the lab'),
      body: bi('Каждая задача роли названа тем состоянием, которое она обеспечивает, а не действием, которое она выполняет. Этот текст вы перенесёте в файл `roles/k8s_prereq/tasks/main.yml`.\n\n```yaml\n' + ROLE_PREREQ + '```', 'Each task is named after the state it ensures, not after an action. You will put this text into `roles/k8s_prereq/tasks/main.yml`.\n\n```yaml\n' + ROLE_PREREQ + '```'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: stand({ applied: true, ops: prepareOps }),
      intro: bi('Три ВМ уже созданы, и файл `~/ops/inventory.ini` выдал Terraform. Плейбук `prepare.yml` подключает три роли. Роль `containerd` уже готова, а роли `k8s_prereq` и `kube_packages` пока пустые. Посмотрите, в каком состоянии сейчас узлы, командой `ansible all -a "cat /etc/fstab"`.', 'Three VMs exist and Terraform produced `~/ops/inventory.ini`. The `prepare.yml` playbook includes three roles; the `containerd` role is ready, while `k8s_prereq` and `kube_packages` are still empty. Look at the state of the nodes: `ansible all -a "cat /etc/fstab"`.'),
      tasks: [
        {
          id: 'prereq',
          prompt: bi('Напишите роль `k8s_prereq`. После неё в `/etc/fstab` не должно быть строки swap, модули `overlay` и `br_netfilter` должны загружаться при старте машины, а в каталоге `/etc/sysctl.d/` должна лежать настройка `net.ipv4.ip_forward = 1`. Прогоните плейбук `prepare.yml`.', 'Write the `k8s_prereq` role: the swap line is removed from `/etc/fstab`, the `overlay` and `br_netfilter` modules load at boot, `net.ipv4.ip_forward = 1` sits in `/etc/sysctl.d/`. Run `prepare.yml`.'),
          check: {
            when: (f: Facts) => hosts(f).length === 3 && hosts(f).every((h) => h.swapOff && h.ipForward && h.modules.includes('overlay') && h.modules.includes('br_netfilter')),
            fail: [
              { if: afterRun((f: Facts) => hosts(f).some((h) => !h.swapOff)), say: bi('Строка swap всё ещё есть в /etc/fstab. Её удалит модуль lineinfile с выражением regexp, которое находит слово swap, и с параметром state: absent.', 'swap is still in /etc/fstab. lineinfile with a regexp on the word swap and state: absent removes the line.') },
              { if: afterRun((f: Facts) => hosts(f).some((h) => !h.ipForward)), say: bi('В файлах /etc/sysctl.d/*.conf нет строки net.ipv4.ip_forward = 1, а kubeadm проверит этот параметр одним из первых.', 'There is no net.ipv4.ip_forward = 1 in /etc/sysctl.d/*.conf: kubeadm checks this first.') },
            ],
          },
          chips: 'ansible-playbook prepare.yml',
          concepts: ['iac.role'],
          docRef: { page: 'ansible-doc/ansible.builtin.lineinfile', anchor: 'OPTIONS', line: 'state' },
          hints: {
            H1: bi('В роли понадобятся три задачи: lineinfile с state: absent для fstab и две задачи copy с параметром content, одна для файла /etc/modules-load.d/k8s.conf, а другая для файла /etc/sysctl.d/99-kubernetes.conf.', 'Three tasks: lineinfile (state: absent) for fstab, copy with content for /etc/modules-load.d/k8s.conf and for /etc/sysctl.d/99-kubernetes.conf.'),
            H2: bi("Строку swap находит выражение `regexp: '\\sswap\\s'`, а удаляет её параметр `state: absent`.", "For swap: `regexp: '\\sswap\\s'` and `state: absent`."),
          },
        },
        {
          id: 'packages',
          prompt: bi('Напишите роль `kube_packages`. Она должна создать файл `/etc/apt/sources.list.d/kubernetes.list` с репозиторием ветки v1.36 и поставить пакеты `kubelet`, `kubeadm` и `kubectl` версии `1.36.4-1.1`. Кроме того, роль `containerd` должна включать драйвер cgroup systemd, а её переменная по умолчанию сейчас его выключает. Прогоните плейбук `prepare.yml`.', 'Write the `kube_packages` role: the file `/etc/apt/sources.list.d/kubernetes.list` with the v1.36 branch repository and the packages `kubelet`, `kubeadm`, `kubectl` of version `1.36.4-1.1`. The `containerd` role must turn on the systemd cgroup driver — its default variable now says the opposite. Run `prepare.yml`.'),
          check: {
            when: (f: Facts) => hosts(f).length === 3 && hosts(f).every((h) => h.repo && ['containerd', 'kubelet', 'kubeadm', 'kubectl'].every((p) => h.packages.includes(p)) && h.systemdCgroup && h.services.containerd === 'started'),
            fail: [
              { if: afterRun((f: Facts) => hosts(f).some((h) => !h.systemdCgroup)), say: bi('В файле /etc/containerd/config.toml по-прежнему стоит SystemdCgroup = false. Поменяйте значение по умолчанию в файле роли defaults/main.yml или задайте переменную containerd_systemd_cgroup: true.', 'In /etc/containerd/config.toml it is still SystemdCgroup = false. Change the role default (defaults/main.yml) or set the variable containerd_systemd_cgroup: true.') },
              { if: afterRun((f: Facts) => hosts(f).some((h) => !h.repo)), say: bi('На узлах нет файла репозитория, в котором записан адрес pkgs.k8s.io/core:/stable:/v1.36/deb.', 'There is no repository file with pkgs.k8s.io/core:/stable:/v1.36/deb.') },
            ],
          },
          chips: 'ansible-playbook prepare.yml',
          concepts: ['k8s.version-pin', 'k8s.cgroup-driver'],
          hints: {
            H1: bi('Файл репозитория создаёт модуль copy с параметром content, а пакеты ставит модуль apt, которому в параметре name передают список строк вида «пакет=версия».', 'copy with content for the repository file; apt with name as a list of “package=version”.'),
            H2: bi('Запишите в файл строку `deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /` целиком, вместе с пробелом и косой чертой в конце и без точки после них.', 'Write the line `deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /` into the file whole, with the space and the slash at the end and no full stop after them.'),
          },
        },
        {
          id: 'idem',
          prompt: bi('Прогоните плейбук `prepare.yml` ещё раз. На всех трёх узлах в итоговой сводке должно стоять `changed=0`.', 'Run `prepare.yml` once more: every one of the three nodes must show `changed=0`.'),
          check: { when: (f: Facts) => idempotentRun(f) && hosts(f).every((h) => h.swapOff && h.systemdCgroup) },
          chips: 'ansible-playbook prepare.yml',
          concepts: ['iac.idempotence'],
          hints: { H1: bi('Если какая-то задача снова отвечает changed, значит, она описывает действие, а не состояние.', 'If some task is changed again, it describes an action, not a state.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'review',
      mode: 'anatomy',
      prompt: bi('Откройте справку `ansible-doc ansible.builtin.lineinfile`. В каком разделе справки перечислены значения, которые может принимать параметр `state`, и сказано, какое из них действует по умолчанию?', 'Open the help of `ansible-doc ansible.builtin.lineinfile`. In which section can you see the values `state` may take and which one is the default?'),
      ref: { page: 'ansible-doc/ansible.builtin.lineinfile' },
      answer: 'OPTIONS',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s-3.q.prereq-why', 'k8s-3.q.cgroup', 'k8s-3.q.pin'] },
  ],
};

// ── 4. kubeadm by hand ──

export const L_KUBEADM: Lesson = {
  id: 'k8s-3.kubeadm',
  block: 'k8s-3',
  title: bi('Как один раз собрать кластер kubeadm руками', 'How to build a kubeadm cluster by hand once'),
  summary: bi('Тот же kubeadm, что на втором этапе Kubernetes, но через Ansible: какие файлы он оставляет на узле, как устроен токен присоединения и зачем команда join проверяет удостоверяющий центр кластера.', 'The same kubeadm as in stage 2, but through Ansible: which files it leaves, how a bootstrap token works and why join checks the CA.'),
  introduces: ['k8s.bootstrap-token', 'k8s.kubeadm-config'],
  uses: ['k8s.kubeadm', 'k8s.static-pod', 'k8s.cni', 'k8s.control-plane', 'iac.module', 'k8s.cgroup-driver'],
  tier: 'core',
  minutes: 40,
  sources: src([S.kubeadmCreate, S.kubeadmConfig, S.kubeadmToken, S.kubeadmJoin, S.cilium], [R.kubeadmRu, R.componentsRu]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Прежде чем превращать kubeadm в роль, его стоит один раз выполнить вручную. Иначе роль превратится в заклинание, которое никто не сможет починить, когда оно перестанет работать. «Вручную» здесь означает разовыми командами Ansible: команда `ansible cp-1 -b -a "kubeadm init …"` запускает kubeadm на машине `cp-1` от имени root и показывает весь его вывод.\n\n### Что пишет на узел kubeadm init\n\nПосле успешного init на управляющем узле появляются файлы трёх видов. Сертификаты лежат в каталоге `/etc/kubernetes/pki`. Файлы kubeconfig, то есть `admin.conf`, `kubelet.conf`, `controller-manager.conf` и `scheduler.conf`, лежат в `/etc/kubernetes`. А в каталоге `/etc/kubernetes/manifests` лежат манифесты [[k8s.static-pod|статических подов]]: так называют поды, которые kubelet запускает прямо из файлов на диске, без участия API-сервера. Запомните файл `admin.conf`. Его появление надёжно показывает, что init на этом узле уже прошёл, и роль будет опираться на этот признак.\n\n### Как передать kubeadm свои решения: флагами или файлом\n\nКаждое решение init можно передать флагом: `--apiserver-advertise-address`, `--pod-network-cidr`, `--kubernetes-version`. Флаги удобны, когда команду запускают один раз, но хранить и сравнивать их в репозитории неудобно. [[k8s.kubeadm-config|Конфигурационный файл kubeadm]] записывает те же решения в YAML. В нём объект `InitConfiguration` описывает этот узел и токены, объект `ClusterConfiguration` описывает кластер в целом, а объект `JoinConfiguration` описывает присоединение новых узлов. Образец со всеми полями печатает команда `kubeadm config print init-defaults`.\n\n### Как узел и control plane начинают доверять друг другу\n\nНовый узел и control plane должны убедиться друг в друге. Control plane доверяет узлу, который предъявил [[k8s.bootstrap-token|токен присоединения]] вида `abcdef.0123456789abcdef`. Первая часть токена служит открытым идентификатором, а вторая часть секретна. Токен действует 24 часа. Один такой токен `kubeadm init` создаёт сам, а новые создаёт команда `kubeadm token create`.\n\nУзел, в свою очередь, должен убедиться, что обращается к настоящему control plane своего кластера, а не к тому, кто первым ответил по этому адресу. Для этого в команду join передают хэш открытого ключа удостоверяющего центра кластера (CA): `--discovery-token-ca-cert-hash sha256:…`. Узел скачивает с control plane открытые сведения о кластере, вычисляет хэш ключа его CA и сравнивает с переданным. Полную команду join с токеном и хэшем init печатает в конце своего вывода.\n\n### Сеть подов\n\nkubeadm намеренно не ставит сеть подов. Пока [[k8s.cni|сетевого плагина]] нет, узлы остаются в состоянии NotReady, а CoreDNS ждёт в Pending. На стенде, как и на втором этапе, сеть подов даёт Cilium, и его ставят командой `cilium install` с закреплённой версией. Программа cilium находит кластер по переменной `KUBECONFIG`, поэтому на `cp-1` её запускают с `KUBECONFIG=/etc/kubernetes/admin.conf`.',
        'Before turning kubeadm into a role it is worth walking it through by hand once — otherwise the role becomes a spell nobody can fix. Here “by hand” means Ansible ad-hoc commands: `ansible cp-1 -b -a "kubeadm init …"` runs the command on `cp-1` as root and shows all its output.\n\n### What kubeadm init writes\n\nAfter a successful init the control-plane node holds three kinds of files: certificates in `/etc/kubernetes/pki`, kubeconfig files (`admin.conf`, `kubelet.conf`, `controller-manager.conf`, `scheduler.conf`) and the manifests of the [[k8s.static-pod|static pods]] in `/etc/kubernetes/manifests`, the pods the kubelet starts straight from files on disk, without the API server. Remember `admin.conf`: its appearance is a reliable sign that init has already happened on this node, and the role will rely on it.\n\n### Flags or a file\n\nEvery init decision can be passed as a flag: `--apiserver-advertise-address`, `--pod-network-cidr`, `--kubernetes-version`. Flags are handy once, but awkward to keep and compare in a repository. A [[k8s.kubeadm-config|kubeadm configuration file]] holds the same decisions in YAML: an `InitConfiguration` object about this node and the tokens, a `ClusterConfiguration` about the cluster as a whole, a `JoinConfiguration` for joining. `kubeadm config print init-defaults` prints a sample with every field.\n\n### The bootstrap token and the CA check\n\nA new node and the control plane must come to trust each other. The control plane trusts a node that presents a [[k8s.bootstrap-token|bootstrap token]] of the form `abcdef.0123456789abcdef`: the first part is a public ID, the second a secret. A token is valid for 24 hours, and `kubeadm init` creates one itself; `kubeadm token create` makes new ones.\n\nThe node in turn must make sure it is talking to the right control plane and not to whoever answered first at that address. For that the join command gets a hash of the cluster CA public key: `--discovery-token-ca-cert-hash sha256:…`. The node downloads the public cluster information from the control plane, computes the hash of its CA and compares. init prints the full join command with the token and the hash at the end of its output.\n\n### The pod network\n\nkubeadm deliberately installs no pod network: until there is a [[k8s.cni|network plugin]], the nodes are NotReady and CoreDNS waits in Pending. On the stand, as in stage 2, it is Cilium: `cilium install` with a pinned version. The CLI finds the cluster through `KUBECONFIG`, so on `cp-1` it runs with `KUBECONFIG=/etc/kubernetes/admin.conf`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: preparedStand({}, [{ path: `${OPS}/ansible.cfg`, content: ANSIBLE_CFG }]),
      intro: bi('Три узла подготовлены ролями из прошлого урока. Все команды вы отправляете на узлы через Ansible командой `ansible <хост или группа> -b -a "<команда>"`, а команды, которым нужны переменные окружения, запускаете модулем shell (`-m ansible.builtin.shell`).', 'The three nodes are prepared by the roles of the previous lesson. All commands go to the nodes through Ansible: `ansible <host or group> -b -a "<command>"`, and for commands with environment variables, the shell module (`-m ansible.builtin.shell`).'),
      tasks: [
        {
          id: 'init',
          prompt: bi('Запустите control plane на `cp-1` командой kubeadm init с сетью подов `10.244.0.0/16`. Прочитайте вывод до конца, потому что в нём напечатана команда для рабочих узлов.', 'Bring up the control plane on `cp-1` with kubeadm init and the pod network `10.244.0.0/16`. Read the output to the end: it holds the command for the workers.'),
          check: { when: (f: Facts) => !!cluster(f)?.initialized && cluster(f)?.cp === 'cp-1' },
          chips: 'ansible cp-1 -b -a "kubeadm init --pod-network-cidr=10.244.0.0/16"',
          concepts: ['k8s.kubeadm'],
          docRef: { page: 'help/kubeadm-init', anchor: 'OPTIONS', line: '--pod-network-cidr' },
          hints: { H1: bi('Флаг, который задаёт сеть подов, описан в справке kubeadm init --help, в разделе Options.', 'The pod network flag is in kubeadm init --help, the Options section.') },
        },
        {
          id: 'cni',
          prompt: bi('Поставьте на `cp-1` Cilium версии 1.18.4 и посмотрите, что показывает `cilium status`.', 'Install Cilium version 1.18.4 on `cp-1` and look at `cilium status`.'),
          check: { when: (f: Facts) => cluster(f)?.cni === 'cilium' },
          chips: 'ansible cp-1 -b -m ansible.builtin.shell -a "KUBECONFIG=/etc/kubernetes/admin.conf cilium install --version 1.18.4"',
          concepts: ['k8s.cni'],
          hints: { H1: bi('Запустите команду модулем shell и поставьте переменную KUBECONFIG перед самой командой.', 'The shell module: the KUBECONFIG variable before the command.') },
        },
        {
          id: 'join',
          prompt: bi('Присоедините `worker-1` и `worker-2` командой, которую напечатал init, причём одной командой на всю группу `workers`. После этого `cilium status` должен показать Ready: 3/3.', 'Join `worker-1` and `worker-2` with the command init printed — one command for the `workers` group. `cilium status` must show Ready: 3/3.'),
          check: {
            when: (f: Facts) => readyNodes(f) === 3,
            fail: [
              { if: (f: Facts) => /none of the public keys/.test(lastOut(f)), say: bi('Хэш CA не совпал, потому что его скопировали не целиком или взяли от другого кластера. Возьмите строку join из вывода init или напечатайте новую на cp-1.', 'The CA hash did not match: it was copied incompletely or from another cluster. Take the join line from the init output or print a new one on cp-1.') },
              { if: (f: Facts) => /JWS signature/.test(lastOut(f)), say: bi('Такого токена нет, или срок его действия истёк. Новый токен создаёт команда kubeadm token create на cp-1.', 'There is no such token or it has expired. kubeadm token create on cp-1 makes a new one.') },
            ],
          },
          chips: 'ansible workers -b -a "kubeadm join …"',
          concepts: ['k8s.bootstrap-token'],
          hints: {
            H1: bi('Если вывод init потерялся, новую команду join напечатает kubeadm token create с одним дополнительным флагом. Найдите этот флаг в справке kubeadm token.', 'If the init output is lost, kubeadm token create prints a new command with one flag — find it in the kubeadm token help.'),
            H2: bi('Команду join из вывода init легко испортить при копировании: она разбита на две строки обратной косой чертой, а длинный хэш в узком терминале переносится. Надёжнее напечатать её заново одной строкой командой `ansible cp-1 -b -a "kubeadm token create --print-join-command"`, скопировать эту строку целиком и вставить в кавычки после `-a` в команде `ansible workers -b -a "…"`.', 'The join command from the init output is easy to spoil when copying: it is split into two lines with a backslash, and the long hash wraps in a narrow terminal. It is safer to print it again as one line with `ansible cp-1 -b -a "kubeadm token create --print-join-command"`, copy that line whole and paste it into the quotes after `-a` in `ansible workers -b -a "…"`.'),
          },
        },
      ],
    },
    {
      id: 'token',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Кластер запустили вчера, рабочие узлы так и не присоединили, а срок действия токена из вывода init истёк. Найдите в справке `kubeadm token --help`, как получить новую полную команду join с токеном и хэшем CA, и присоедините оба рабочих узла.', 'The cluster was brought up yesterday, the workers were never joined, and the token from the init output has expired. Find in the `kubeadm token --help` page how to get a new full join command (with a token and the CA hash), and join both workers.'),
      ref: { page: 'help/kubeadm-token', anchor: 'OPTIONS', line: '--print-join-command' },
      terminal: {
        setup: preparedStand({ cluster: { cp: 'cp-1', workers: [], cni: true, expiredToken: true } }, [{ path: `${OPS}/ansible.cfg`, content: ANSIBLE_CFG }]),
        task: {
          id: 'rejoin',
          prompt: bi('Узлы worker-1 и worker-2 присоединены к кластеру и находятся в состоянии Ready.', 'worker-1 and worker-2 are in the cluster and Ready.'),
          check: { when: (f: Facts) => readyNodes(f) === 3 && (cluster(f)?.tokens.some((t) => t.valid) ?? false) },
          docStep: 3,
          chips: 'ansible cp-1 -b -a "kubeadm token create …"',
          concepts: ['k8s.bootstrap-token'],
          hints: { H1: bi('Вам нужна подкоманда create и флаг, который печатает всю команду join, а не один токен.', 'The create subcommand; a flag that prints the whole command, not just the token.') },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Прежде чем писать роль, нужен образец конфигурационного файла со всеми полями, а урок описал такой файл только в общих чертах. Найдите в справке `kubeadm config --help`, как напечатать конфигурацию init по умолчанию, и сохраните её на `cp-1` в файл `/root/init-defaults.yaml`.', 'Before writing the role you need a sample configuration file with every field. The lesson gave only the idea of it. Find in the `kubeadm config --help` page how to print the default init configuration, and save it on `cp-1` to `/root/init-defaults.yaml`.'),
      ref: { page: 'help/kubeadm-config' },
      terminal: {
        setup: preparedStand({}, [{ path: `${OPS}/ansible.cfg`, content: ANSIBLE_CFG }]),
        task: {
          id: 'defaults',
          prompt: bi('На cp-1 лежит файл /root/init-defaults.yaml с объектами InitConfiguration и ClusterConfiguration.', 'cp-1 has /root/init-defaults.yaml with the InitConfiguration and ClusterConfiguration objects.'),
          check: { when: (f: Facts) => /kind: InitConfiguration/.test(hostFile(f, 'cp-1', '/root/init-defaults.yaml')) && /kind: ClusterConfiguration/.test(hostFile(f, 'cp-1', '/root/init-defaults.yaml')) },
          docStep: 4,
          beyond: true,
          solutionTokens: ['config print', 'init-defaults'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s-3.q.token', 'k8s-3.q.init-files', 'k8s-3.q.ca-hash'] },
  ],
};
