// Block 9, lessons 1–4: why a cluster from code, the nodes as Terraform code,
// the node preparation as Ansible roles, kubeadm once by hand.

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, Sources } from '../../../core/types';
import { cluster, hostFile, hosts, idempotentRun, inventoryOk, kc, lastOut, pingedAll, planNoChanges, readyNodes, tf, threeNodesLabelled } from './checks';
import { ANSIBLE_CFG, CONTAINERD_TEMPLATE, OPS, preparedStand, ROLE_CONTAINERD, ROLE_CONTAINERD_HANDLERS, ROLE_PREREQ, stand, TF_CP, TF_HEAD } from './setups';

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

// ── 1. plan ──

export const L_PLAN: Lesson = {
  id: 'k8s-3.plan',
  block: 'k8s-3',
  title: bi('Кластер, который не жалко удалить', 'A cluster you can afford to delete'),
  summary: bi('Зачем поднимать кластер кодом, из каких звеньев состоит цепочка и что передаёт каждое следующему.', 'Why bring a cluster up with code, which links the chain consists of and what each one hands to the next.'),
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
        'На втором этапе вы собрали кластер kubeadm руками: три машины, подготовка каждой, init, сеть, join. Ушёл на это целый день, и кластер работает. Теперь представьте утро понедельника. Провайдер пишет, что машина `worker-2` потеряна вместе с диском. Тимлид просит к пятнице второй такой же кластер для нагрузочного теста. А аудитор спрашивает, чем именно настроены узлы и совпадают ли они друг с другом.\n\nНа все три вопроса у ручного кластера один ответ: снова целый день, и результат снова будет немного другим. В этом блоке вы соберёте тот же кластер так, чтобы на все три вопроса отвечала одна команда.',
        'In stage 2 you put a kubeadm cluster together by hand: three machines, preparing each, init, the network, join. It took a whole day, and the cluster works. Now picture a Monday morning. The provider writes that the machine `worker-2` is lost together with its disk. The team lead asks for a second identical cluster by Friday for a load test. And an auditor asks what exactly the nodes are configured with and whether they are identical.\n\nA hand-made cluster has one answer to all three questions: another whole day, and the result will again be a little different. In this block you build the same cluster so that one command answers all three.',
      ),
    },
    {
      id: 'idea',
      kind: 'text',
      step: 'explain',
      title: bi('Питомцы и стадо', 'Pets and cattle'),
      body: bi(
        'Инженеры давно делят серверы на два рода. Питомцу дают имя, его лечат, когда он болен, и боятся потерять, потому что второго такого нет. Скот пронумерован: заболевшее животное заменяют новым, и стадо этого не замечает. Ручной кластер — питомец, как бы аккуратно его ни собрали.\n\n[[k8s.rebuildable|Пересоздаваемый кластер]] — такой, который можно в любой момент удалить и поднять снова из репозитория, без единого ручного шага. Это не значит, что его часто удаляют. Это значит, что удаление перестаёт быть катастрофой: потерянный узел заменяется прогоном кода, второе окружение — тем же кодом с другими переменными, а ответ аудитору — ссылкой на репозиторий.\n\nВсё, что для этого нужно, вы уже знаете по отдельности. [[iac.iac|Инфраструктура как код]] описывает машины и их настройку файлами; [[iac.idempotence|идемпотентность]] позволяет прогонять описание сколько угодно раз; [[k8s.kubeadm|kubeadm]] ставит control plane. Этот блок соединяет их в одну цепочку.',
        'Engineers have long divided servers into two kinds. A pet gets a name, is nursed when ill and you fear losing it, because there is no second one like it. Cattle are numbered: a sick animal is replaced by a new one, and the herd does not notice. A hand-made cluster is a pet, however carefully it was assembled.\n\nA [[k8s.rebuildable|rebuildable cluster]] is one that can be deleted at any moment and brought up again from a repository, without a single manual step. That does not mean it is often deleted. It means deletion stops being a disaster: a lost node is replaced by a run of the code, a second environment by the same code with other variables, and the answer to the auditor is a link to the repository.\n\nYou already know everything this needs, piece by piece. [[iac.iac|Infrastructure as code]] describes machines and their setup in files; [[iac.idempotence|idempotence]] lets you run the description as many times as you like; [[k8s.kubeadm|kubeadm]] installs the control plane. This block joins them into one chain.',
      ),
    },
    {
      id: 'chain',
      kind: 'text',
      step: 'explain',
      title: bi('Цепочка из четырёх звеньев', 'A chain of four links'),
      body: bi(
        'Каждое звено делает одно дело и передаёт следующему ровно то, что тому нужно.\n\n1. **Terraform** заказывает машины: сеть и три ВМ. Наружу он отдаёт то, что знает только после создания, — адреса. Из них собирается инвентарь для Ansible.\n2. **Ansible** приводит машины к состоянию, которого ждёт kubeadm: swap выключен, ядро пересылает пакеты, containerd настроен, пакеты Kubernetes нужной версии. Это описано ролями, одинаковыми для всех узлов.\n3. **kubeadm в роли** поднимает control plane на первом узле и присоединяет остальные. Роль запускает kubeadm только там, где кластера ещё нет, поэтому её тоже можно прогонять снова.\n4. **Приложение** приходит в кластер из Git — об этом звене отдельный урок.\n\nМежду звеньями нет ручного копирования. Если адрес машины переписан руками из консоли облака, кластер перестаёт быть пересоздаваемым: после следующего пересоздания адрес будет другим, а бумажка — прежней.\n\n### Метки и деньги\n\nВсё, что создаёт курс, получает [[iac.resource-label|метку ресурса]] `trainer=devops`. По ней машины находят, считают и удаляют, и по ней же проверяют, что после уборки ничего не осталось. Три ВМ работают каждый час, нужны они вам в этот час или нет; забытый на месяц стенд — это 3 × 730 = 2190 ВМ-часов. Пересоздаваемый кластер решает и эту задачу: его не нужно держать между занятиями, потому что поднимается он заново за минуты.',
        'Each link does one job and hands the next exactly what it needs.\n\n1. **Terraform** orders the machines: a network and three VMs. It hands out what it learns only after creation — the addresses. The Ansible inventory is assembled from them.\n2. **Ansible** brings the machines to the state kubeadm expects: swap off, the kernel forwarding packets, containerd configured, Kubernetes packages of the right version. This is described by roles, the same for all nodes.\n3. **kubeadm in a role** brings up the control plane on the first node and joins the others. The role runs kubeadm only where there is no cluster yet, so it too can be run again.\n4. **The application** comes into the cluster from Git — a separate lesson is about this link.\n\nThere is no manual copying between the links. If a machine address is copied by hand from the cloud console, the cluster stops being rebuildable: after the next rebuild the address is different and the note is the same.\n\n### Labels and money\n\nEverything the course creates gets the [[iac.resource-label|resource label]] `trainer=devops`. Machines are found, counted and deleted by it, and it is how you check that nothing is left after the cleanup. Three VMs run every hour whether you need them that hour or not; a lab forgotten for a month is 3 × 730 = 2190 VM-hours. A rebuildable cluster solves this too: you do not need to keep it between sessions, because it comes back in minutes.',
      ),
    },
    {
      id: 'beginner',
      kind: 'callout',
      tone: 'note',
      levels: ['beginner'],
      title: bi('Если всё это пока кажется длинным', 'If all of this still looks long'),
      body: bi('Думайте о цепочке как о рецепте, а не о блюде. Повар, у которого есть только блюдо, после неудачи начинает с нуля и по памяти; повар с рецептом готовит второе такое же. В этом блоке вы будете писать рецепт, а стенд в браузере будет по нему готовить.', 'Think of the chain as a recipe, not a dish. A cook who has only the dish starts from scratch and from memory after a failure; a cook with the recipe makes a second one just like it. In this block you write the recipe, and the stand in the browser cooks by it.'),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s-3.from-code', caption: bi('Пройдите первый прогон до конца. Затем выберите «второй прогон» и включите поломку «нет creates»; потом «destroy → apply → плейбук» с неверным cp_endpoint.', 'Step through the first run to the end. Then choose “second run” and switch on the “no creates” break; then “destroy → apply → playbook” with a wrong cp_endpoint.') },
    { id: 'cost', kind: 'callout', tone: 'cost', title: bi('Сколько стоит стенд', 'What the lab costs'), body: bi('Весь блок проходит на стенде в браузере и ничего не стоит. Настоящий трек в конце блока — три ВМ по 2 vCPU и 4 ГБ на один рабочий день. Посчитайте его заранее по сегодняшней цене своего провайдера и посмотрите на последнюю колонку: так выглядит счёт за неубранный стенд.', 'The whole block runs on the stand in the browser and costs nothing. The real track at the end of the block is three VMs with 2 vCPU and 4 GB for one working day. Work it out in advance at your provider’s price today and look at the last column: this is the bill for a lab nobody cleaned up.') },
    { id: 'cost-table', kind: 'widget', widget: 'k8s.cost', props: { vms: 3, hours: 8 } },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s-3.q.why-code', 'k8s-3.q.chain', 'k8s-3.q.label'] },
  ],
};

// ── 2. nodes ──

const MAIN_ONE = TF_HEAD + TF_CP;

export const L_NODES: Lesson = {
  id: 'k8s-3.nodes',
  block: 'k8s-3',
  title: bi('Узлы кодом: count, метки и инвентарь из output', 'Nodes as code: count, labels and an inventory from an output'),
  summary: bi('Три ВМ одним ресурсом с count, метка trainer=devops на каждой и инвентарь Ansible, который Terraform выдаёт сам.', 'Three VMs as one resource with count, the trainer=devops label on each and an Ansible inventory that Terraform produces itself.'),
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
        'Узлы кластера почти одинаковы: тот же образ, тот же размер, та же сеть. Описывать каждый отдельным блоком значит трижды повторить одно и то же и трижды ошибиться. Мета-аргумент [[iac.count|count]] говорит Terraform, сколько одинаковых экземпляров создать из одного блока:\n\n```hcl\nresource "edu_vm" "worker" {\n  count      = 2\n  name       = "worker-${count.index + 1}"\n  image      = "ubuntu-24.04"\n  memory_gb  = 4\n  network_id = edu_network.k8s.id\n  labels     = { trainer = "devops", role = "worker" }\n}\n```\n\n`count.index` — номер экземпляра, с нуля, поэтому имена получаются `worker-1` и `worker-2`. В state это два объекта: `edu_vm.worker[0]` и `edu_vm.worker[1]`. Если завтра поставить `count = 3`, план предложит создать один новый, `[2]`, и не тронет первые два. Control plane описан отдельным ресурсом: у него своя роль и больше памяти.\n\nМетки задаются картой `labels`. Метка `trainer=devops` нужна курсу для уборки, `role` — людям: в консоли облака сразу видно, где какой узел.\n\n### Что Terraform отдаёт наружу\n\nАдреса машин выдаёт облако, и до `apply` их не знает никто. [[iac.output|output]] — выходное значение конфигурации: то, что она сообщает после применения. Самое полезное, что может выдать конфигурация узлов, — готовый [[iac.inventory|инвентарь]] Ansible:\n\n```hcl\noutput "inventory" {\n  value = "[control_plane]\\ncp-1 ansible_host=${edu_vm.cp.public_ip}\\n\\n[workers]\\n…\\n\\n[all:vars]\\ncp_endpoint=${edu_vm.cp.private_ip}:6443\\n"\n}\n```\n\nГруппы `control_plane` и `workers` скажут Ansible, где ставить control plane, а переменная `cp_endpoint` — куда рабочим узлам идти на join. `terraform output inventory` печатает значение в кавычках, как его видит Terraform; ключ `-raw` печатает саму строку, и её можно сразу записать в файл:\n\n```bash\nterraform output -raw inventory > ../ops/inventory.ini\n```\n\nПосле этого между облаком и Ansible не остаётся ни одного адреса, переписанного руками.',
        'Cluster nodes are almost identical: the same image, the same size, the same network. Describing each with its own block means repeating the same thing three times and making three mistakes. The [[iac.count|count]] meta-argument tells Terraform how many identical instances to create from one block:\n\n```hcl\nresource "edu_vm" "worker" {\n  count      = 2\n  name       = "worker-${count.index + 1}"\n  image      = "ubuntu-24.04"\n  memory_gb  = 4\n  network_id = edu_network.k8s.id\n  labels     = { trainer = "devops", role = "worker" }\n}\n```\n\n`count.index` is the instance number, starting from zero, so the names come out as `worker-1` and `worker-2`. In the state these are two objects: `edu_vm.worker[0]` and `edu_vm.worker[1]`. Set `count = 3` tomorrow and the plan proposes to create one new instance, `[2]`, and leaves the first two alone. The control plane is a separate resource: it has its own role and more memory.\n\nLabels are set with the `labels` map. The `trainer=devops` label is there for the course cleanup, `role` for people: in the cloud console you see at once which node is which.\n\n### What Terraform hands out\n\nThe cloud hands out the machine addresses, and before `apply` nobody knows them. An [[iac.output|output]] is an output value of the configuration: what it reports after it is applied. The most useful thing a node configuration can produce is a ready Ansible [[iac.inventory|inventory]]:\n\n```hcl\noutput "inventory" {\n  value = "[control_plane]\\ncp-1 ansible_host=${edu_vm.cp.public_ip}\\n\\n[workers]\\n…\\n\\n[all:vars]\\ncp_endpoint=${edu_vm.cp.private_ip}:6443\\n"\n}\n```\n\nThe `control_plane` and `workers` groups tell Ansible where to put the control plane, and the `cp_endpoint` variable tells the workers where to go for join. `terraform output inventory` prints the value in quotes, as Terraform sees it; the `-raw` key prints the string itself, and it can go straight into a file:\n\n```bash\nterraform output -raw inventory > ../ops/inventory.ini\n```\n\nAfter that not a single address copied by hand stays between the cloud and Ansible.',
      ),
    },
    {
      id: 'experienced',
      kind: 'callout',
      tone: 'why',
      levels: ['experienced'],
      title: bi('count или for_each', 'count or for_each'),
      body: bi('С count адрес экземпляра — номер. Уберите из середины списка узел, и все, кто стоял за ним, сдвинутся: план предложит пересоздать их. Для узлов, которые различаются ролью, в настоящих проектах берут `for_each` по карте `{ cp-1 = "control-plane", worker-1 = "worker" }`: адрес становится ключом, и удаление одного узла не трогает остальные. Сам узел удобно вынести в модуль `k8s-node` с ролью на входе и адресами на выходе.', 'With count an instance address is a number. Remove a node from the middle of the list and everyone behind it shifts: the plan proposes to recreate them. For nodes that differ by role, real projects use `for_each` over a map `{ cp-1 = "control-plane", worker-1 = "worker" }`: the address becomes a key, and deleting one node leaves the others alone. The node itself is handy as a `k8s-node` module with a role as input and addresses as output.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: stand({ main: MAIN_ONE }),
      intro: bi('В `~/infra/main.tf` уже описаны сеть и control plane `cp-1`. Облако пустое (`edu vm list`). В `~/ops` лежит только `ansible.cfg`: инвентарь должен прийти из Terraform.', '`~/infra/main.tf` already describes the network and the control plane `cp-1`. The cloud is empty (`edu vm list`). `~/ops` holds only `ansible.cfg`: the inventory must come from Terraform.'),
      tasks: [
        {
          id: 'workers',
          prompt: bi('Добавьте два рабочих узла одним ресурсом `edu_vm.worker` с `count`: имена `worker-1` и `worker-2`, 4 ГБ памяти, та же сеть, метки `trainer = "devops"` и `role = "worker"`. В тот же файл добавьте output `inventory` с группами `[control_plane]` (cp-1) и `[workers]` (worker-1, worker-2) и строкой `cp_endpoint=<частный адрес cp-1>:6443` в `[all:vars]`. Примените — в облаке должно стать три ВМ, все с меткой курса.', 'Add two workers as one `edu_vm.worker` resource with `count`: the names `worker-1` and `worker-2`, 4 GB of memory, the same network, the labels `trainer = "devops"` and `role = "worker"`. In the same file add an output `inventory` with the groups `[control_plane]` (cp-1) and `[workers]` (worker-1, worker-2) and the line `cp_endpoint=<cp-1 private address>:6443` under `[all:vars]`. Apply — the cloud must hold three VMs, all with the course label.'),
          check: {
            when: (f: Facts) => threeNodesLabelled(f) && (tf(f)?.state.some((s) => s.address === 'edu_vm.worker[1]') ?? false),
            fail: [
              { if: (f: Facts) => (tf(f)?.state ?? []).some((s) => /^edu_vm\.worker_?\d|^edu_vm\.worker2/.test(s.address)), say: bi('Рабочие узлы описаны отдельными блоками. Нужен один блок с count — тогда их адреса edu_vm.worker[0] и [1].', 'The workers are described by separate blocks. You need one block with count — then their addresses are edu_vm.worker[0] and [1].') },
              { if: (f: Facts) => (kc(f)?.vms ?? []).some((v) => v.labels.trainer !== 'devops'), say: bi('Не у всех ВМ есть метка trainer = "devops": уборка по метке такую машину не найдёт.', 'Not every VM has the trainer = "devops" label: a cleanup by label will not find such a machine.') },
            ],
          },
          chips: 'terraform init && terraform apply',
          concepts: ['iac.count', 'iac.resource-label'],
          hints: {
            H1: bi('Один блок resource "edu_vm" "worker" и аргумент count = 2; имя строится из count.index.', 'One resource "edu_vm" "worker" block and the argument count = 2; the name is built from count.index.'),
            H2: bi('`name = "worker-${count.index + 1}"`: индекс начинается с нуля. Значение output — строка с \\n между строками инвентаря и ссылками ${edu_vm.cp.private_ip}, ${edu_vm.worker[0].name}…', '`name = "worker-${count.index + 1}"`: the index starts from zero. The output value is a string with \\n between the inventory lines and references ${edu_vm.cp.private_ip}, ${edu_vm.worker[0].name}…'),
          },
        },
        {
          id: 'inventory',
          prompt: bi('Запишите инвентарь из output в `~/ops/inventory.ini` и проверьте связь со всеми тремя узлами модулем ping.', 'Write the inventory from the output to `~/ops/inventory.ini` and check the connection to all three nodes with the ping module.'),
          check: {
            when: (f: Facts) => inventoryOk(f, inv) && pingedAll(f),
            fail: [{ if: (f: Facts) => /cp_endpoint=203\.0\.113/.test(f.files[inv]?.text ?? ''), say: bi('В cp_endpoint публичный адрес. Узлы говорят друг с другом по частной сети: нужен private_ip.', 'cp_endpoint holds the public address. Nodes talk to each other over the private network: you need private_ip.') }],
          },
          chips: 'terraform output -raw inventory > ../ops/inventory.ini',
          concepts: ['iac.output', 'iac.inventory'],
          docRef: { url: 'https://developer.hashicorp.com/terraform/cli/commands/output', label: 'terraform output · -raw' },
          hints: {
            H1: bi('Ключ -raw печатает строку без кавычек; перенаправьте её в файл. Потом: cd ~/ops и ansible all -m ansible.builtin.ping.', 'The -raw key prints the string without quotes; redirect it into the file. Then: cd ~/ops and ansible all -m ansible.builtin.ping.'),
          },
        },
        {
          id: 'nochanges',
          prompt: bi('Убедитесь, что код и облако совпадают: план без единого изменения.', 'Make sure the code and the cloud match: a plan with not a single change.'),
          check: { when: planNoChanges },
          chips: 'terraform plan',
          concepts: ['iac.plan'],
          hints: { H1: bi('Команда в каталоге ~/infra; ожидаемая строка — No changes.', 'The command in ~/infra; the expected line is No changes.') },
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
  title: bi('Подготовка узлов: три роли на три машины', 'Preparing the nodes: three roles for three machines'),
  summary: bi('Swap, пересылка пакетов, модули ядра, containerd с драйвером cgroup systemd и пакеты Kubernetes закреплённой версии — ролями, которые на втором прогоне ничего не меняют.', 'Swap, packet forwarding, kernel modules, containerd with the systemd cgroup driver and Kubernetes packages of a pinned version — as roles that change nothing on the second run.'),
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
        'kubeadm проверяет узел перед работой, но не исправляет его. Всё, чего он ждёт, должно быть сделано заранее и одинаково на всех машинах.\n\n**Swap выключен.** kubelet по умолчанию отказывается работать со swap: он распределяет память между подами по их requests и limits и должен видеть настоящую память машины. Выключить swap один раз командой `swapoff -a` мало — после перезагрузки его вернёт строка в `/etc/fstab`, поэтому строку удаляют.\n\n**Узел пересылает пакеты.** Пакеты подов приходят на один интерфейс узла и уходят через другой. Ядро делает это, только если `net.ipv4.ip_forward = 1`; kubeadm проверяет этот параметр первым делом. Значение кладут в `/etc/sysctl.d/`, чтобы оно пережило перезагрузку.\n\n**Модули ядра.** `overlay` нужен containerd для слоёв образов, `br_netfilter` — чтобы трафик через мосты Linux проходил правила netfilter. Список модулей для загрузки при старте лежит в `/etc/modules-load.d/`.\n\n**containerd и драйвер cgroup.** Ограничения памяти и процессора каждого пода — это cgroup. [[k8s.cgroup-driver|Драйвер cgroup]] — способ, которым их создают: через systemd или напрямую. На машине с systemd дерево cgroup уже принадлежит systemd, и kubelet с рантаймом должны работать через него же; два хозяина одного дерева, не знающие друг о друге, под нагрузкой начинают спорить о ресурсах. kubeadm настраивает kubelet на systemd сам, а containerd об этом надо сказать в `config.toml`: `SystemdCgroup = true`. После правки конфигурации containerd перезапускают — это работа для handler.\n\n**Пакеты закреплённой версии.** kubelet, kubeadm и kubectl ставятся из репозитория `pkgs.k8s.io`, разделённого по минорным версиям: ветка `v1.36` не принесёт 1.37. Но патч-версии в ветке выходят, и узел, созданный через полгода, получит более новую, чем соседи. Поэтому версия пишется в коде явно — это [[k8s.version-pin|закреплённая версия]], — а на настоящих машинах пакет ещё и удерживают от `apt upgrade` модулем `ansible.builtin.dpkg_selections`.\n\n### Роли\n\nВсё это раскладывается на три [[iac.role|роли Ansible]]: `k8s_prereq` (swap, модули, sysctl), `containerd` и `kube_packages`. Каждая состоит из модулей состояния: `lineinfile` с `state: absent` для строки swap, `copy` для файлов модулей и sysctl, `template` для конфигурации containerd, `apt` для пакетов. На втором прогоне каждая задача должна ответить ok. В настоящем проекте sysctl и модули удобнее задавать модулями `ansible.posix.sysctl` и `community.general.modprobe` — они ещё и применяют значение сразу; на стенде есть только `ansible.builtin`, и файлов достаточно.',
        'kubeadm checks a node before working, but it does not fix it. Everything it expects must be done in advance and the same way on every machine.\n\n**Swap is off.** By default the kubelet refuses to run with swap: it shares memory between pods by their requests and limits and must see the real memory of the machine. Turning swap off once with `swapoff -a` is not enough — after a reboot the line in `/etc/fstab` brings it back, so the line is removed.\n\n**The node forwards packets.** Pod packets arrive on one interface of the node and leave through another. The kernel does that only if `net.ipv4.ip_forward = 1`; kubeadm checks this parameter first of all. The value goes into `/etc/sysctl.d/` so that it survives a reboot.\n\n**Kernel modules.** `overlay` is needed by containerd for image layers, `br_netfilter` so that traffic through Linux bridges goes through the netfilter rules. The list of modules to load at boot lives in `/etc/modules-load.d/`.\n\n**containerd and the cgroup driver.** The memory and CPU limits of every pod are cgroups. The [[k8s.cgroup-driver|cgroup driver]] is the way they are created: through systemd or directly. On a machine with systemd the cgroup tree already belongs to systemd, and the kubelet and the runtime must go through it too; two owners of one tree that know nothing of each other start arguing about resources under load. kubeadm sets the kubelet to systemd itself, and containerd has to be told in `config.toml`: `SystemdCgroup = true`. After the configuration changes containerd is restarted — a job for a handler.\n\n**Packages of a pinned version.** kubelet, kubeadm and kubectl come from the `pkgs.k8s.io` repository, which is split by minor version: the `v1.36` branch does not bring 1.37. But patch versions keep coming out in the branch, and a node created half a year later gets a newer one than its neighbours. So the version is written in the code explicitly — a [[k8s.version-pin|pinned version]] — and on real machines the package is also held against `apt upgrade` with the `ansible.builtin.dpkg_selections` module.\n\n### Roles\n\nAll this is laid out as three [[iac.role|Ansible roles]]: `k8s_prereq` (swap, modules, sysctl), `containerd` and `kube_packages`. Each consists of state modules: `lineinfile` with `state: absent` for the swap line, `copy` for the module and sysctl files, `template` for the containerd configuration, `apt` for the packages. On the second run every task must answer ok. In a real project sysctl and modules are handier with the `ansible.posix.sysctl` and `community.general.modprobe` modules — they also apply the value at once; the stand has only `ansible.builtin`, and files are enough.',
      ),
    },
    {
      id: 'read-role',
      kind: 'text',
      step: 'look',
      levels: ['beginner'],
      title: bi('Готовая роль k8s_prereq — прочитайте её до лабораторной', 'A ready k8s_prereq role — read it before the lab'),
      body: bi('Каждая задача называется тем состоянием, которое она обеспечивает, а не действием. Этот текст вы перенесёте в `roles/k8s_prereq/tasks/main.yml`.\n\n```yaml\n' + ROLE_PREREQ + '```', 'Each task is named after the state it ensures, not after an action. You will put this text into `roles/k8s_prereq/tasks/main.yml`.\n\n```yaml\n' + ROLE_PREREQ + '```'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: stand({ applied: true, ops: prepareOps }),
      intro: bi('Три ВМ уже созданы, `~/ops/inventory.ini` выдал Terraform. Плейбук `prepare.yml` подключает три роли; роль `containerd` готова, а `k8s_prereq` и `kube_packages` пока пустые. Посмотрите, в каком виде узлы: `ansible all -a "cat /etc/fstab"`.', 'Three VMs exist and Terraform produced `~/ops/inventory.ini`. The `prepare.yml` playbook includes three roles; the `containerd` role is ready, while `k8s_prereq` and `kube_packages` are still empty. Look at the state of the nodes: `ansible all -a "cat /etc/fstab"`.'),
      tasks: [
        {
          id: 'prereq',
          prompt: bi('Напишите роль `k8s_prereq`: строка swap убрана из `/etc/fstab`, модули `overlay` и `br_netfilter` загружаются при старте, `net.ipv4.ip_forward = 1` лежит в `/etc/sysctl.d/`. Прогоните `prepare.yml`.', 'Write the `k8s_prereq` role: the swap line is removed from `/etc/fstab`, the `overlay` and `br_netfilter` modules load at boot, `net.ipv4.ip_forward = 1` sits in `/etc/sysctl.d/`. Run `prepare.yml`.'),
          check: {
            when: (f: Facts) => hosts(f).length === 3 && hosts(f).every((h) => h.swapOff && h.ipForward && h.modules.includes('overlay') && h.modules.includes('br_netfilter')),
            fail: [
              { if: (f: Facts) => hosts(f).some((h) => !h.swapOff), say: bi('swap всё ещё в /etc/fstab. lineinfile с regexp по слову swap и state: absent удалит строку.', 'swap is still in /etc/fstab. lineinfile with a regexp on the word swap and state: absent removes the line.') },
              { if: (f: Facts) => hosts(f).some((h) => !h.ipForward), say: bi('Нет net.ipv4.ip_forward = 1 в /etc/sysctl.d/*.conf: kubeadm проверит это первым.', 'There is no net.ipv4.ip_forward = 1 in /etc/sysctl.d/*.conf: kubeadm checks this first.') },
            ],
          },
          chips: 'ansible-playbook prepare.yml',
          concepts: ['iac.role'],
          docRef: { page: 'ansible-doc/ansible.builtin.lineinfile', anchor: 'OPTIONS', line: 'state' },
          hints: {
            H1: bi('Три задачи: lineinfile (state: absent) для fstab, copy с content для /etc/modules-load.d/k8s.conf и для /etc/sysctl.d/99-kubernetes.conf.', 'Three tasks: lineinfile (state: absent) for fstab, copy with content for /etc/modules-load.d/k8s.conf and for /etc/sysctl.d/99-kubernetes.conf.'),
            H2: bi("Для swap: `regexp: '\\sswap\\s'` и `state: absent`.", "For swap: `regexp: '\\sswap\\s'` and `state: absent`."),
          },
        },
        {
          id: 'packages',
          prompt: bi('Напишите роль `kube_packages`: файл `/etc/apt/sources.list.d/kubernetes.list` с репозиторием ветки v1.36 и пакеты `kubelet`, `kubeadm`, `kubectl` версии `1.36.4-1.1`. Роль `containerd` должна включать драйвер cgroup systemd — сейчас её переменная по умолчанию говорит обратное. Прогоните `prepare.yml`.', 'Write the `kube_packages` role: the file `/etc/apt/sources.list.d/kubernetes.list` with the v1.36 branch repository and the packages `kubelet`, `kubeadm`, `kubectl` of version `1.36.4-1.1`. The `containerd` role must turn on the systemd cgroup driver — its default variable now says the opposite. Run `prepare.yml`.'),
          check: {
            when: (f: Facts) => hosts(f).length === 3 && hosts(f).every((h) => h.repo && ['containerd', 'kubelet', 'kubeadm', 'kubectl'].every((p) => h.packages.includes(p)) && h.systemdCgroup && h.services.containerd === 'started'),
            fail: [
              { if: (f: Facts) => hosts(f).some((h) => !h.systemdCgroup), say: bi('В /etc/containerd/config.toml всё ещё SystemdCgroup = false. Поменяйте умолчание роли (defaults/main.yml) или задайте переменную containerd_systemd_cgroup: true.', 'In /etc/containerd/config.toml it is still SystemdCgroup = false. Change the role default (defaults/main.yml) or set the variable containerd_systemd_cgroup: true.') },
              { if: (f: Facts) => hosts(f).some((h) => !h.repo), say: bi('Нет файла репозитория с pkgs.k8s.io/core:/stable:/v1.36/deb.', 'There is no repository file with pkgs.k8s.io/core:/stable:/v1.36/deb.') },
            ],
          },
          chips: 'ansible-playbook prepare.yml',
          concepts: ['k8s.version-pin', 'k8s.cgroup-driver'],
          hints: {
            H1: bi('copy с content для файла репозитория; apt с name — списком «пакет=версия».', 'copy with content for the repository file; apt with name as a list of “package=version”.'),
            H2: bi('Строка репозитория: `deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /`.', 'The repository line: `deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /`.'),
          },
        },
        {
          id: 'idem',
          prompt: bi('Прогоните `prepare.yml` ещё раз: на всех трёх узлах должно быть `changed=0`.', 'Run `prepare.yml` once more: every one of the three nodes must show `changed=0`.'),
          check: { when: (f: Facts) => idempotentRun(f) && hosts(f).every((h) => h.swapOff && h.systemdCgroup) },
          chips: 'ansible-playbook prepare.yml',
          concepts: ['iac.idempotence'],
          hints: { H1: bi('Если какая-то задача снова changed, она описывает действие, а не состояние.', 'If some task is changed again, it describes an action, not a state.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'review',
      mode: 'anatomy',
      prompt: bi('Откройте справку `ansible-doc ansible.builtin.lineinfile`. В каком разделе видно, какие значения может принимать `state` и что по умолчанию?', 'Open the help of `ansible-doc ansible.builtin.lineinfile`. In which section can you see the values `state` may take and which one is the default?'),
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
  title: bi('kubeadm один раз руками: init, сеть, join', 'kubeadm once by hand: init, the network, join'),
  summary: bi('Тот же kubeadm, что на втором этапе, но через Ansible: какие файлы он оставляет, как устроен токен присоединения и почему join проверяет CA.', 'The same kubeadm as in stage 2, but through Ansible: which files it leaves, how a bootstrap token works and why join checks the CA.'),
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
        'Прежде чем превращать kubeadm в роль, его стоит один раз провести руками — иначе роль станет заклинанием, которое нельзя починить. Здесь «руками» значит ad-hoc командами Ansible: `ansible cp-1 -b -a "kubeadm init …"` запускает команду на `cp-1` от root и показывает её вывод целиком.\n\n### Что пишет kubeadm init\n\nПосле успешного init на управляющем узле появляются три рода файлов: сертификаты в `/etc/kubernetes/pki`, файлы kubeconfig (`admin.conf`, `kubelet.conf`, `controller-manager.conf`, `scheduler.conf`) и манифесты [[k8s.static-pod|статических подов]] в `/etc/kubernetes/manifests`. Запомните `admin.conf`: его появление — надёжный признак того, что init на этом узле уже прошёл, и роль будет на него опираться.\n\n### Флаги или файл\n\nКаждое решение init можно передать флагом: `--apiserver-advertise-address`, `--pod-network-cidr`, `--kubernetes-version`. Флаги удобны один раз, но в репозитории их неудобно хранить и сравнивать. [[k8s.kubeadm-config|Конфигурационный файл kubeadm]] — те же решения в YAML: объект `InitConfiguration` про этот узел и токены, `ClusterConfiguration` про кластер в целом, `JoinConfiguration` для присоединения. Образец со всеми полями печатает `kubeadm config print init-defaults`.\n\n### Токен присоединения и проверка CA\n\nНовый узел и control plane должны поверить друг другу. Control plane верит узлу, который предъявил [[k8s.bootstrap-token|токен присоединения]] вида `abcdef.0123456789abcdef`: первая часть — открытый идентификатор, вторая — секрет. Токен живёт 24 часа, и `kubeadm init` создаёт один такой сам; новые создаёт `kubeadm token create`.\n\nУзел, в свою очередь, должен убедиться, что разговаривает с тем самым control plane, а не с тем, кто первым ответил по этому адресу. Для этого в команду join передают хэш открытого ключа CA кластера: `--discovery-token-ca-cert-hash sha256:…`. Узел скачивает с control plane публичную информацию о кластере, считает хэш его CA и сравнивает. Полную команду join с токеном и хэшем печатает init в конце вывода.\n\n### Сеть подов\n\nkubeadm намеренно не ставит сеть подов: пока её нет, узлы NotReady, а CoreDNS ждёт в Pending. На стенде, как и на втором этапе, это Cilium: `cilium install` с закреплённой версией. CLI ищет кластер по `KUBECONFIG`, поэтому на `cp-1` его запускают с `KUBECONFIG=/etc/kubernetes/admin.conf`.',
        'Before turning kubeadm into a role it is worth walking it through by hand once — otherwise the role becomes a spell nobody can fix. Here “by hand” means Ansible ad-hoc commands: `ansible cp-1 -b -a "kubeadm init …"` runs the command on `cp-1` as root and shows all its output.\n\n### What kubeadm init writes\n\nAfter a successful init the control-plane node holds three kinds of files: certificates in `/etc/kubernetes/pki`, kubeconfig files (`admin.conf`, `kubelet.conf`, `controller-manager.conf`, `scheduler.conf`) and the manifests of the [[k8s.static-pod|static pods]] in `/etc/kubernetes/manifests`. Remember `admin.conf`: its appearance is a reliable sign that init has already happened on this node, and the role will rely on it.\n\n### Flags or a file\n\nEvery init decision can be passed as a flag: `--apiserver-advertise-address`, `--pod-network-cidr`, `--kubernetes-version`. Flags are handy once, but awkward to keep and compare in a repository. A [[k8s.kubeadm-config|kubeadm configuration file]] holds the same decisions in YAML: an `InitConfiguration` object about this node and the tokens, a `ClusterConfiguration` about the cluster as a whole, a `JoinConfiguration` for joining. `kubeadm config print init-defaults` prints a sample with every field.\n\n### The bootstrap token and the CA check\n\nA new node and the control plane must come to trust each other. The control plane trusts a node that presents a [[k8s.bootstrap-token|bootstrap token]] of the form `abcdef.0123456789abcdef`: the first part is a public ID, the second a secret. A token lives 24 hours, and `kubeadm init` creates one itself; `kubeadm token create` makes new ones.\n\nThe node in turn must make sure it is talking to the right control plane and not to whoever answered first at that address. For that the join command gets a hash of the cluster CA public key: `--discovery-token-ca-cert-hash sha256:…`. The node downloads the public cluster information from the control plane, computes the hash of its CA and compares. init prints the full join command with the token and the hash at the end of its output.\n\n### The pod network\n\nkubeadm deliberately installs no pod network: until there is one, the nodes are NotReady and CoreDNS waits in Pending. On the stand, as in stage 2, it is Cilium: `cilium install` with a pinned version. The CLI finds the cluster through `KUBECONFIG`, so on `cp-1` it runs with `KUBECONFIG=/etc/kubernetes/admin.conf`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: preparedStand({}, [{ path: `${OPS}/ansible.cfg`, content: ANSIBLE_CFG }]),
      intro: bi('Три узла подготовлены ролями из прошлого урока. Все команды идут на узлы через Ansible: `ansible <хост или группа> -b -a "<команда>"`, а для команд с переменными окружения — модулем shell (`-m ansible.builtin.shell`).', 'The three nodes are prepared by the roles of the previous lesson. All commands go to the nodes through Ansible: `ansible <host or group> -b -a "<command>"`, and for commands with environment variables, the shell module (`-m ansible.builtin.shell`).'),
      tasks: [
        {
          id: 'init',
          prompt: bi('Поднимите control plane на `cp-1` командой kubeadm init с сетью подов `10.244.0.0/16`. Прочитайте вывод до конца: в нём команда для рабочих узлов.', 'Bring up the control plane on `cp-1` with kubeadm init and the pod network `10.244.0.0/16`. Read the output to the end: it holds the command for the workers.'),
          check: { when: (f: Facts) => !!cluster(f)?.initialized && cluster(f)?.cp === 'cp-1' },
          chips: 'ansible cp-1 -b -a "kubeadm init --pod-network-cidr=10.244.0.0/16"',
          concepts: ['k8s.kubeadm'],
          docRef: { page: 'help/kubeadm-init', anchor: 'OPTIONS', line: '--pod-network-cidr' },
          hints: { H1: bi('Флаг сети подов — в kubeadm init --help, раздел Options.', 'The pod network flag is in kubeadm init --help, the Options section.') },
        },
        {
          id: 'cni',
          prompt: bi('Поставьте Cilium версии 1.18.4 на `cp-1` и посмотрите `cilium status`.', 'Install Cilium version 1.18.4 on `cp-1` and look at `cilium status`.'),
          check: { when: (f: Facts) => cluster(f)?.cni === 'cilium' },
          chips: 'ansible cp-1 -b -m ansible.builtin.shell -a "KUBECONFIG=/etc/kubernetes/admin.conf cilium install --version 1.18.4"',
          concepts: ['k8s.cni'],
          hints: { H1: bi('Модуль shell: переменная KUBECONFIG перед командой.', 'The shell module: the KUBECONFIG variable before the command.') },
        },
        {
          id: 'join',
          prompt: bi('Присоедините `worker-1` и `worker-2` командой, которую напечатал init, — одной командой на группу `workers`. В `cilium status` должно стать Ready: 3/3.', 'Join `worker-1` and `worker-2` with the command init printed — one command for the `workers` group. `cilium status` must show Ready: 3/3.'),
          check: {
            when: (f: Facts) => readyNodes(f) === 3,
            fail: [
              { if: (f: Facts) => /none of the public keys/.test(lastOut(f)), say: bi('Хэш CA не совпал: вы скопировали его не целиком или от другого кластера. Возьмите строку join из вывода init или напечатайте новую на cp-1.', 'The CA hash did not match: it was copied incompletely or from another cluster. Take the join line from the init output or print a new one on cp-1.') },
              { if: (f: Facts) => /JWS signature/.test(lastOut(f)), say: bi('Такого токена нет или он истёк. Новый создаёт kubeadm token create на cp-1.', 'There is no such token or it has expired. kubeadm token create on cp-1 makes a new one.') },
            ],
          },
          chips: 'ansible workers -b -a "kubeadm join …"',
          concepts: ['k8s.bootstrap-token'],
          hints: { H1: bi('Если вывод init потерялся, новую команду печатает kubeadm token create с одним флагом — найдите его в справке kubeadm token.', 'If the init output is lost, kubeadm token create prints a new command with one flag — find it in the kubeadm token help.') },
        },
      ],
    },
    {
      id: 'token',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Кластер подняли вчера, рабочие узлы не присоединили, и токен из вывода init истёк. Найдите в справке `kubeadm token --help`, как получить новую полную команду join (с токеном и хэшем CA), и присоедините оба рабочих узла.', 'The cluster was brought up yesterday, the workers were never joined, and the token from the init output has expired. Find in the `kubeadm token --help` page how to get a new full join command (with a token and the CA hash), and join both workers.'),
      ref: { page: 'help/kubeadm-token', anchor: 'OPTIONS', line: '--print-join-command' },
      terminal: {
        setup: preparedStand({ cluster: { cp: 'cp-1', workers: [], cni: true, expiredToken: true } }, [{ path: `${OPS}/ansible.cfg`, content: ANSIBLE_CFG }]),
        task: {
          id: 'rejoin',
          prompt: bi('worker-1 и worker-2 в кластере и Ready.', 'worker-1 and worker-2 are in the cluster and Ready.'),
          check: { when: (f: Facts) => readyNodes(f) === 3 && (cluster(f)?.tokens.some((t) => t.valid) ?? false) },
          docStep: 3,
          chips: 'ansible cp-1 -b -a "kubeadm token create …"',
          concepts: ['k8s.bootstrap-token'],
          hints: { H1: bi('Подкоманда create; флаг, который печатает команду целиком, а не только токен.', 'The create subcommand; a flag that prints the whole command, not just the token.') },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Перед тем как писать роль, нужен образец конфигурационного файла со всеми полями. В уроке была только его идея. Найдите в справке `kubeadm config --help`, как напечатать конфигурацию init по умолчанию, и сохраните её на `cp-1` в `/root/init-defaults.yaml`.', 'Before writing the role you need a sample configuration file with every field. The lesson gave only the idea of it. Find in the `kubeadm config --help` page how to print the default init configuration, and save it on `cp-1` to `/root/init-defaults.yaml`.'),
      ref: { page: 'help/kubeadm-config' },
      terminal: {
        setup: preparedStand({}, [{ path: `${OPS}/ansible.cfg`, content: ANSIBLE_CFG }]),
        task: {
          id: 'defaults',
          prompt: bi('На cp-1 есть /root/init-defaults.yaml с объектами InitConfiguration и ClusterConfiguration.', 'cp-1 has /root/init-defaults.yaml with the InitConfiguration and ClusterConfiguration objects.'),
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

