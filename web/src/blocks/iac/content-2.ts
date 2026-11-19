// The second half of the IaC block (06 §4.3 B1-10/11, §5.3 B2-7/8/9/11):
// Ansible roles and variable precedence; Terraform input variables, local
// modules and moved; taking hand-made objects under management (import),
// refresh-only and drift detection in CI; the block exam with DL5.

import { bi } from '../../core/i18n';
import type { Concept, Exam, Facts, Lesson, PlacementTask, QuizItem, TerminalSetup } from '../../core/types';
import { lastRun, runs } from './ans/command';
import { ansSetup, APPLIED, host, INFRA, INV, OPS, src, S, TF_HEAD, TF_NET, TF_VM, tf, tfSetup } from './content';
import type { TfFacts } from './tf/edu';

const W = {
  roles: { title: 'Ansible — Roles', url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html' },
  precedence: { title: 'Ansible — Understanding variable precedence', url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_variables.html#understanding-variable-precedence' },
  galaxy: { title: 'Ansible — Galaxy User Guide: creating roles', url: 'https://docs.ansible.com/ansible/latest/galaxy/dev_guide.html' },
  modules: { title: 'OpenTofu — Modules', url: 'https://opentofu.org/docs/language/modules/' },
  variables: { title: 'OpenTofu — Input variables', url: 'https://opentofu.org/docs/language/values/variables/' },
  refactoring: { title: 'OpenTofu — Refactoring (moved blocks)', url: 'https://opentofu.org/docs/language/modules/develop/refactoring/' },
  importBlock: { title: 'OpenTofu — Import', url: 'https://opentofu.org/docs/language/import/' },
  planCmd: { title: 'OpenTofu — Command: plan', url: 'https://opentofu.org/docs/cli/commands/plan/' },
  ruHabrRoles: { title: 'Хабр — Ansible: роли и особенности check mode', url: 'https://habr.com/ru/articles/746864/' },
  ruYcModules: { title: 'Yandex Cloud — Модули Terraform', url: 'https://yandex.cloud/ru/docs/terraform/tutorials/terraform-modules' },
  ruYcQuick: { title: 'Yandex Cloud — Начало работы с Terraform', url: 'https://yandex.cloud/ru/docs/terraform/quickstart' },
  ruYcImport: { title: 'Yandex Cloud — Импорт ресурсов в Terraform', url: 'https://yandex.cloud/ru/docs/tutorials/infrastructure-management/terraform-import' },
};

export const concepts2: Concept[] = [
  { id: 'iac.role', term: bi('роль Ansible', 'Ansible role'), forms: { ru: ['роли Ansible', 'ролью Ansible', 'ролей Ansible'], en: ['Ansible roles'] }, short: bi('Плейбук, разложенный по каталогам roles/<имя>/ (tasks, handlers, templates, defaults, vars, meta), чтобы его можно было подключать в разные плеи.', 'A playbook laid out in the directories roles/<name>/ (tasks, handlers, templates, defaults, vars, meta) so that it can be plugged into different plays.'), introducedIn: 'iac.roles', docRef: { page: 'web/docs.ansible.com/roles', anchor: 'structure' } },
  { id: 'iac.var-precedence', term: bi('приоритет переменных', 'variable precedence'), forms: { ru: ['приоритета переменных', 'приоритету переменных', 'приоритетом переменных'] }, short: bi('Лестница мест, где задают переменную Ansible: значение с более высокой ступени побеждает, от умолчаний роли до -e.', 'The ladder of places where an Ansible variable is set: a value from a higher step wins, from role defaults up to -e.'), introducedIn: 'iac.roles', docRef: { page: 'web/docs.ansible.com/variable-precedence', anchor: 'ladder' } },
  { id: 'iac.tf-variable', term: bi('входная переменная', 'input variable'), forms: { ru: ['входной переменной', 'входные переменные', 'входных переменных', 'входную переменную'], en: ['input variables'] }, short: bi('Параметр конфигурации или модуля Terraform: блок variable с типом и умолчанием, значение — var.<имя>.', 'A parameter of a Terraform configuration or module: a variable block with a type and a default; the value is var.<name>.'), introducedIn: 'iac.modules' },
  { id: 'iac.tf-module', term: bi('модуль Terraform', 'Terraform module'), forms: { ru: ['модуля Terraform', 'модулем Terraform', 'модули Terraform', 'модулей Terraform', 'модуле Terraform'], en: ['Terraform modules'] }, short: bi('Каталог .tf-файлов со своими входными переменными и выводами; вызывается блоком module, его ресурсы получают адреса module.<имя>.…', 'A directory of .tf files with its own input variables and outputs; it is called with a module block, and its resources get the addresses module.<name>.…'), introducedIn: 'iac.modules', docRef: { page: 'web/opentofu.org/language/modules', anchor: 'calling' } },
  { id: 'iac.moved', term: bi('блок moved', 'moved block'), forms: { ru: ['блока moved', 'блоком moved', 'блоки moved'], en: ['moved blocks'] }, short: bi('Запись «объект с адреса from теперь живёт по адресу to»: Terraform переименовывает запись state, а не пересоздаёт ресурс.', 'A record "the object at address from now lives at address to": Terraform renames the state entry instead of recreating the resource.'), introducedIn: 'iac.modules', docRef: { page: 'web/opentofu.org/language/moved', anchor: 'moved' } },
  { id: 'iac.import', term: bi('импорт ресурса', 'resource import'), forms: { ru: ['импорта ресурса', 'импортом ресурса', 'импорт ресурсов'] }, short: bi('Привязка существующего объекта облака к блоку resource: Terraform записывает его ID в state и дальше управляет им, ничего не создавая.', 'Attaching an existing cloud object to a resource block: Terraform writes its ID into the state and manages it from then on, creating nothing.'), introducedIn: 'iac.import', docRef: { page: 'web/opentofu.org/language/import', anchor: 'block' } },
  { id: 'iac.refresh-only', term: bi('режим refresh-only', 'refresh-only mode'), forms: { ru: ['режима refresh-only', 'режиме refresh-only'] }, short: bi('План, который только записывает в state изменения, сделанные мимо Terraform, и не предлагает их откатывать.', 'A plan that only records in the state the changes made behind Terraform’s back and does not propose to undo them.'), introducedIn: 'iac.import', docRef: { page: 'web/opentofu.org/cli/plan-modes', anchor: 'refresh-only' } },
];

// ── helpers ──

const fileText = (f: Facts, p: string) => f.files[p]?.text ?? '';
const tfOf = (f: Facts) => f.tf as TfFacts | undefined;
const vmByName = (f: Facts | undefined, name: string) => (f ? (tfOf(f)?.cloud ?? []).find((r) => r.type === 'edu_vm' && r.attrs.name === name) : undefined);
const stateAddr = (f: Facts, addr: string) => tf(f)?.state.find((s) => s.address === addr);
type PlanFact = NonNullable<ReturnType<typeof tf>>['lastPlan'] & { imported?: string[]; moved?: { from: string; to: string }[] };
const lastPlan = (f: Facts) => (tf(f)?.lastPlan ?? null) as PlanFact | null;
const emptyPlan = (f: Facts) => {
  const p = lastPlan(f);
  return !!p && p.add + p.change + p.destroy === 0 && !(p.imported ?? []).length && !(p.moved ?? []).length;
};
const listens = (f: Facts, h: string, port: number) => (host(f, h)?.files['/etc/nginx/sites-enabled/cafe.conf'] ?? '').includes(`listen ${port};`);

/** IDs Edu Cloud gives the n-th object it creates (the training cloud is deterministic). */
export const eduId = (prefix: 'vm' | 'net' | 'dns', n: number) => `${prefix}-${(0x4f10 + n * 0x2b).toString(16)}`;

const FLAT_PLAY = `- name: Web servers serve the cafe site
  hosts: web
  become: true
  tasks:
    - name: nginx is installed
      ansible.builtin.apt:
        name: nginx
        state: present

    - name: The site config is in place
      ansible.builtin.template:
        src: cafe.conf.j2
        dest: /etc/nginx/sites-enabled/cafe.conf
      notify: Reload nginx

    - name: nginx is running
      ansible.builtin.service:
        name: nginx
        state: started

  handlers:
    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
`;
const ROLE_TEMPLATE = 'server {\n    listen {{ http_port }};\n    server_name {{ inventory_hostname }}.site.edu;\n    root /var/www/cafe;\n}\n';

const TF_DNS = '\nresource "edu_dns_record" "www" {\n  zone  = "site.edu"\n  name  = "www"\n  value = edu_vm.web.public_ip\n}\n';
const MOD_VM = 'variable "name" {\n  type = string\n}\n\nvariable "network_id" {\n  type = string\n}\n\nvariable "cores" {\n  type    = number\n  default = 2\n}\n\nresource "edu_vm" "this" {\n  name       = var.name\n  image      = "ubuntu-24.04"\n  cores      = var.cores\n  network_id = var.network_id\n}\n\noutput "ip" {\n  value = edu_vm.this.public_ip\n}\n';
const LEGACY_SCRIPT = `edu vm create --name legacy --image debian-13 --cores 1 --network-id ${eduId('net', 1)}`;

// ── quiz ──

export const quiz2: QuizItem[] = [
  {
    id: 'iac.q.role-dirs',
    kind: 'match',
    concepts: ['iac.role'],
    prompt: bi('Что лежит в каком каталоге роли?', 'What goes into which directory of a role?'),
    pairs: [
      { id: 'tasks', left: 'tasks/main.yml', right: bi('задачи, которые роль выполняет', 'the tasks the role runs') },
      { id: 'handlers', left: 'handlers/main.yml', right: bi('handlers роли', 'the role’s handlers') },
      { id: 'defaults', left: 'defaults/main.yml', right: bi('значения, которые пользователь роли переопределяет', 'values the user of the role overrides'), why: bi('Самая низкая ступень лестницы: её перебивает даже group_vars/all.', 'The lowest step of the ladder: even group_vars/all beats it.') },
      { id: 'vars', left: 'vars/main.yml', right: bi('значения, на которые роль полагается и которые менять не надо', 'values the role relies on and that should not be changed') },
      { id: 'meta', left: 'meta/main.yml', right: bi('зависимости от других ролей', 'dependencies on other roles') },
    ],
  },
  {
    id: 'iac.q.precedence',
    kind: 'mcq',
    concepts: ['iac.var-precedence'],
    prompt: bi('`http_port` задан в defaults роли (80), в group_vars/web.yml (8080) и в host_vars/web1.yml (8081). Плейбук запущен без `-e`. Что получат web1 и web2?', '`http_port` is set in the role defaults (80), in group_vars/web.yml (8080) and in host_vars/web1.yml (8081). The playbook runs without `-e`. What do web1 and web2 get?'),
    options: [
      { id: 'ok', text: bi('web1 — 8081, web2 — 8080', 'web1 gets 8081, web2 gets 8080'), correct: true },
      { id: 'all80', text: bi('Оба — 80: роль главнее инвентаря', 'Both 80: the role matters more than the inventory'), why: bi('defaults — нижняя ступень: они нужны именно для того, чтобы их переопределяли.', 'defaults are the bottom step: they exist precisely to be overridden.') },
      { id: 'all8080', text: bi('Оба — 8080: группа прочитана последней', 'Both 8080: the group is read last'), why: bi('Порядок чтения не решает. Переменная хоста стоит выше переменной группы.', 'The reading order does not decide. A host variable stands above a group variable.') },
    ],
    explain: bi('Чем точнее место, тем выше ступень: роль → все хосты → группа → хост → плей → `-e`.', 'The more specific the place, the higher the step: role → all hosts → group → host → play → `-e`.'),
  },
  {
    id: 'iac.q.vars-vs-defaults',
    kind: 'mcq',
    concepts: ['iac.role', 'iac.var-precedence'],
    prompt: bi('Автор роли записал `http_port: 80` в `vars/main.yml`. Команда задаёт 8080 в group_vars/web.yml, а на хостах по-прежнему 80. Как исправить правильно?', 'The role author wrote `http_port: 80` into `vars/main.yml`. The team sets 8080 in group_vars/web.yml, and the hosts still get 80. What is the right fix?'),
    options: [
      { id: 'defaults', text: bi('Перенести значение в defaults/main.yml роли', 'Move the value into the role’s defaults/main.yml'), correct: true },
      { id: 'extra', text: bi('Запускать плейбук всегда с -e http_port=8080', 'Always run the playbook with -e http_port=8080'), why: bi('Сработает, но настройка уедет из репозитория в память людей и в скрипты запуска.', 'It works, but the setting moves out of the repository into people’s memory and launch scripts.') },
      { id: 'host', text: bi('Задать порт в host_vars каждого хоста', 'Set the port in host_vars of every host'), why: bi('vars роли стоят выше и host_vars: ничего не изменится.', 'Role vars stand above host_vars too: nothing changes.') },
    ],
  },
  {
    id: 'iac.q.play-order',
    kind: 'order',
    concepts: ['iac.role'],
    prompt: bi('В каком порядке Ansible выполняет части плея с ролями?', 'In which order does Ansible run the parts of a play with roles?'),
    steps: [
      { id: 'pre', text: 'pre_tasks' },
      { id: 'deps', text: bi('роли из dependencies в meta/main.yml', 'roles from dependencies in meta/main.yml') },
      { id: 'roles', text: bi('роли из списка roles:', 'the roles of the roles: list') },
      { id: 'tasks', text: 'tasks' },
      { id: 'handlers', text: bi('уведомлённые handlers', 'the notified handlers'), why: bi('Handlers — в конце плея, один раз, и для задач ролей тоже.', 'Handlers come at the end of the play, once, for the tasks of roles too.') },
    ],
  },
  {
    id: 'iac.q.module-addr',
    kind: 'mcq',
    concepts: ['iac.tf-module'],
    prompt: bi('Модуль `./modules/vm` описывает `resource "edu_vm" "this"`. Его вызвали блоком `module "api"`. Какой адрес у ВМ в state?', 'The module `./modules/vm` declares `resource "edu_vm" "this"`. It is called with `module "api"`. What is the VM’s address in the state?'),
    options: [
      { id: 'ok', text: 'module.api.edu_vm.this', correct: true },
      { id: 'flat', text: 'edu_vm.this', why: bi('Ресурсы модуля получают префикс вызова: иначе два вызова одного модуля столкнулись бы адресами.', 'Module resources get the call prefix: otherwise two calls of one module would clash on addresses.') },
      { id: 'dir', text: 'modules.vm.edu_vm.this', why: bi('В адрес входит имя вызова (label блока module), а не каталог.', 'The address contains the call name (the module block label), not the directory.') },
    ],
  },
  {
    id: 'iac.q.rename',
    kind: 'mcq',
    concepts: ['iac.moved', 'iac.state'],
    prompt: bi('ВМ `edu_vm.web` перенесли в код модуля: теперь это `module.web.edu_vm.this`. Блока moved нет. Что покажет plan?', 'The VM `edu_vm.web` was moved into a module’s code: it is now `module.web.edu_vm.this`. There is no moved block. What does plan show?'),
    options: [
      { id: 'recreate', text: bi('Удалить edu_vm.web и создать module.web.edu_vm.this', 'Destroy edu_vm.web and create module.web.edu_vm.this'), correct: true },
      { id: 'nothing', text: 'No changes', why: bi('Terraform сопоставляет код и state по адресу. Новый адрес для него — новый ресурс, старый — лишний.', 'Terraform matches the code and the state by address. A new address is a new resource to it, and the old one is surplus.') },
      { id: 'guess', text: bi('Сам поймёт, что это та же ВМ, по имени web', 'It figures out it is the same VM by the name web'), why: bi('Атрибуты не служат ключом: две разные ВМ могут называться одинаково.', 'Attributes are not a key: two different VMs may have the same name.') },
    ],
    explain: bi('`moved { from = edu_vm.web  to = module.web.edu_vm.this }` переименовывает запись state, и план становится пустым.', '`moved { from = edu_vm.web  to = module.web.edu_vm.this }` renames the state entry, and the plan becomes empty.'),
  },
  {
    id: 'iac.q.module-output',
    kind: 'bugfind',
    concepts: ['iac.tf-module'],
    prompt: bi('`terraform validate` ругается на этот код. Какая строка неверна?', '`terraform validate` complains about this code. Which line is wrong?'),
    lang: 'hcl',
    code: 'module "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n\nresource "edu_dns_record" "www" {\n  zone  = "site.edu"\n  name  = "www"\n  value = module.web.edu_vm.this.public_ip\n}',
    bug: [10],
    why: {
      2: bi('Локальный путь начинается с ./ — так и нужно.', 'A local path starts with ./, as it should.'),
      4: bi('Аргумент модуля может ссылаться на ресурс корня: так передают сеть внутрь.', 'A module argument may refer to a root resource: that is how the network is passed in.'),
      10: bi('Ресурсы модуля закрыты от вызывающего кода. Наружу видны только outputs: `module.web.ip`.', 'Module resources are hidden from the calling code. Only outputs are visible: `module.web.ip`.'),
    },
  },
  {
    id: 'iac.q.required-var',
    kind: 'mcq',
    concepts: ['iac.tf-variable'],
    prompt: bi('В модуле `variable "network_id" { type = string }` без default. Вызов модуля его не передаёт. Что будет?', 'The module has `variable "network_id" { type = string }` without a default. The module call does not pass it. What happens?'),
    options: [
      { id: 'error', text: bi('Ошибка Missing required argument ещё до плана', 'A Missing required argument error before any plan'), correct: true },
      { id: 'null', text: bi('Подставится null, и облако откажет при создании', 'null is used and the cloud refuses at creation'), why: bi('Переменная без default обязательна: Terraform проверяет это при разборе, до вызовов API.', 'A variable without a default is required: Terraform checks it while parsing, before any API call.') },
      { id: 'ask', text: bi('Terraform спросит значение в терминале', 'Terraform asks for the value in the terminal'), why: bi('Спрашивают только переменные корня, и то не в CI. Аргумент модуля обязан быть в вызове.', 'Only root variables are asked for, and not in CI. A module argument must be in the call.') },
    ],
  },
  {
    id: 'iac.q.import-config',
    kind: 'mcq',
    concepts: ['iac.import'],
    prompt: bi('Вы добавили `import { to = edu_vm.legacy  id = "vm-4f91" }`, но блока `resource "edu_vm" "legacy"` ещё нет. Что скажет plan?', 'You added `import { to = edu_vm.legacy  id = "vm-4f91" }`, but there is no `resource "edu_vm" "legacy"` block yet. What does plan say?'),
    options: [
      { id: 'err', text: bi('Configuration for import target does not exist', 'Configuration for import target does not exist'), correct: true },
      { id: 'gen', text: bi('Сам допишет блок resource по облаку', 'It writes the resource block itself from the cloud'), why: bi('Код пишет человек: import только привязывает объект к уже описанному адресу.', 'A person writes the code: import only attaches the object to an address that is already described.') },
      { id: 'create', text: bi('Создаст новую ВМ', 'It creates a new VM'), why: bi('import ничего не создаёт — он берёт под управление то, что уже есть.', 'import creates nothing: it takes over what already exists.') },
    ],
  },
  {
    id: 'iac.q.adopt-order',
    kind: 'order',
    concepts: ['iac.import'],
    prompt: bi('Как взять под управление ВМ, созданную руками? Расставьте шаги.', 'How do you take over a VM created by hand? Put the steps in order.'),
    steps: [
      { id: 'id', text: bi('узнать её ID в облаке', 'find its ID in the cloud') },
      { id: 'code', text: bi('описать её блоком resource с её настоящими атрибутами', 'describe it with a resource block with its real attributes') },
      { id: 'block', text: bi('добавить блок import с этим ID', 'add an import block with that ID') },
      { id: 'plan', text: bi('plan: «will be imported» и никаких других действий', 'plan: "will be imported" and no other actions'), why: bi('Если план хочет ещё и изменить ресурс, код не совпадает с облаком — правьте код, а не облако.', 'If the plan also wants to change the resource, the code does not match the cloud: fix the code, not the cloud.') },
      { id: 'apply', text: 'apply' },
      { id: 'check', text: bi('plan ещё раз: No changes', 'plan again: No changes') },
    ],
  },
  {
    id: 'iac.q.refresh-only',
    kind: 'mcq',
    concepts: ['iac.refresh-only', 'iac.drift'],
    prompt: bi('В облаке у ВМ 4 ядра, в коде — 2. Вы выполнили `terraform apply -refresh-only`. Что покажет следующий обычный `terraform plan`?', 'The VM has 4 cores in the cloud and 2 in the code. You ran `terraform apply -refresh-only`. What does the next ordinary `terraform plan` show?'),
    options: [
      { id: 'revert', text: bi('~ cores = 4 -> 2: код по-прежнему желаемое состояние', '~ cores = 4 -> 2: the code is still the desired state'), correct: true },
      { id: 'none', text: 'No changes', why: bi('refresh-only обновил state, а не код. Код по-прежнему говорит «2».', 'refresh-only updated the state, not the code. The code still says "2".') },
      { id: 'drift', text: bi('Снова «Objects have changed outside of Terraform»', '"Objects have changed outside of Terraform" again'), why: bi('Расхождение облака со state уже записано: refresh его больше не находит.', 'The difference between the cloud and the state is already recorded: refresh no longer finds it.') },
    ],
  },
  {
    id: 'iac.q.exitcodes',
    kind: 'match',
    concepts: ['iac.drift'],
    prompt: bi('`terraform plan -detailed-exitcode` в ночной джобе CI. Что значит код возврата?', '`terraform plan -detailed-exitcode` in a nightly CI job. What does the exit code mean?'),
    pairs: [
      { id: 'z', left: '0', right: bi('облако совпадает с кодом', 'the cloud matches the code') },
      { id: 'o', left: '1', right: bi('ошибка: код не разобрался или API не ответил', 'an error: the code did not parse or the API did not answer') },
      { id: 't', left: '2', right: bi('есть разница — повод для алерта о дрейфе', 'there is a diff, a reason for a drift alert') },
    ],
  },
];

// ── lessons ──

export const rolesLesson: Lesson = {
  id: 'iac.roles',
  block: 'iac',
  title: bi('Роли и приоритет переменных', 'Roles and variable precedence'),
  summary: bi('Роль раскладывает плейбук по каталогам так, что его можно подключить в любой плей, а лестница приоритетов решает, какое значение переменной получит хост.', 'A role lays a playbook out in directories so it can be plugged into any play, and the precedence ladder decides which value of a variable a host gets.'),
  introduces: ['iac.role', 'iac.var-precedence'],
  uses: ['iac.playbook', 'iac.handler', 'iac.idempotence', 'iac.inventory'],
  tier: 'core',
  minutes: 40,
  sources: src([W.roles, W.precedence, W.galaxy], [W.ruHabrRoles, S.ruAnsible]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Плейбук кафе прижился. Через месяц команда платёжного сервиса попросила «такой же nginx», и коллега скопировал файл к себе, поменяв порт. Ещё через месяц в копиях было уже три разных способа перезагружать nginx, а исправление в одной не доходило до остальных. Копия кода — та же ручная настройка, только сдвинутая на уровень выше.',
        'The café playbook took root. A month later the payments team asked for "the same nginx", and a colleague copied the file over and changed the port. Another month later the copies had three different ways of reloading nginx, and a fix in one of them never reached the others. A copy of code is the same manual setup, just moved one level up.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        '[[iac.role|Роль Ansible]] — это плейбук, разложенный по договорённым каталогам, чтобы его можно было подключить в любой плей, не копируя. Роль `webserver` живёт в `roles/webserver/` рядом с плейбуком, и у каждого каталога своя работа:\n\n```text\nroles/webserver/\n  tasks/main.yml      задачи роли\n  handlers/main.yml   handlers роли\n  templates/          шаблоны Jinja2 для ansible.builtin.template\n  files/              файлы для ansible.builtin.copy\n  defaults/main.yml   значения по умолчанию\n  vars/main.yml       значения, на которые роль полагается\n  meta/main.yml       зависимости от других ролей\n```\n\nПустой каркас создаёт `ansible-galaxy role init webserver`; лишние каталоги можно удалить, Ansible читает только те, что есть. Задачи и handlers в этих файлах пишутся так же, как в плейбуке, но без обёртки `- hosts:` — просто список. Шаблон, на который ссылается задача роли, Ansible ищет сначала в `templates/` этой роли, поэтому роль переносится целиком, со своими файлами.\n\nПлей подключает роль одной строкой:\n\n```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  roles:\n    - webserver\n```\n\nПорядок выполнения такой: сначала `pre_tasks`, затем роли из списка (а перед каждой — роли, перечисленные в её `meta/main.yml`), затем `tasks` плея, а уведомлённые handlers — как и прежде, один раз в конце плея. В выводе задачи роли видны с её именем: `TASK [webserver : nginx is installed]`.\n\n### Откуда берётся значение\n\nОдна и та же переменная может быть задана в нескольких местах, и тогда вопрос «какое значение получит хост» решает [[iac.var-precedence|приоритет переменных]]. Это лестница: значение с более высокой ступени перебивает значение с более низкой, независимо от того, какой файл прочитан последним. Для работы хватает семи ступеней, снизу вверх:\n\n1. `defaults/main.yml` роли;\n2. `group_vars/all`;\n3. `group_vars/<группа>`;\n4. `host_vars/<хост>`;\n5. `vars:` плея;\n6. `vars/main.yml` роли;\n7. `-e` в командной строке.\n\nОтсюда правило для автора роли. Всё, что пользователь роли может захотеть настроить, — порт, корень сайта, число воркеров — кладётся в `defaults`: это самая слабая ступень, её перебивает даже `group_vars/all`. В `vars` роли кладут только то, на что роль опирается сама и что менять не нужно, потому что эта ступень стоит выше инвентаря и переопределить её из `group_vars` уже нельзя. А `-e` оставляют для разовых запусков и CI: значение из командной строки побеждает всегда и в репозитории не остаётся.',
        'An [[iac.role|Ansible role]] is a playbook laid out in agreed directories so that it can be plugged into any play without copying. The `webserver` role lives in `roles/webserver/` next to the playbook, and each directory has its own job:\n\n```text\nroles/webserver/\n  tasks/main.yml      the role’s tasks\n  handlers/main.yml   the role’s handlers\n  templates/          Jinja2 templates for ansible.builtin.template\n  files/              files for ansible.builtin.copy\n  defaults/main.yml   default values\n  vars/main.yml       values the role relies on\n  meta/main.yml       dependencies on other roles\n```\n\n`ansible-galaxy role init webserver` creates an empty skeleton; directories you do not need can be removed, Ansible reads only those that exist. Tasks and handlers in these files are written as in a playbook but without the `- hosts:` wrapper, just a list. A template a role task refers to is looked up first in that role’s `templates/`, so a role travels as a whole, with its own files.\n\nA play plugs a role in with one line:\n\n```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  roles:\n    - webserver\n```\n\nThe order of execution is: first `pre_tasks`, then the listed roles (each preceded by the roles named in its `meta/main.yml`), then the play’s `tasks`, and the notified handlers, as before, once at the end of the play. In the output a role’s tasks carry its name: `TASK [webserver : nginx is installed]`.\n\n### Where a value comes from\n\nOne variable may be set in several places, and then the question "which value does the host get" is decided by [[iac.var-precedence|variable precedence]]. It is a ladder: a value from a higher step overrides a value from a lower one, regardless of which file was read last. Seven steps are enough for everyday work, from the bottom up:\n\n1. the role’s `defaults/main.yml`;\n2. `group_vars/all`;\n3. `group_vars/<group>`;\n4. `host_vars/<host>`;\n5. the play’s `vars:`;\n6. the role’s `vars/main.yml`;\n7. `-e` on the command line.\n\nHence a rule for the role author. Everything the user of the role may want to tune (the port, the site root, the number of workers) goes into `defaults`: it is the weakest step, and even `group_vars/all` overrides it. The role’s `vars` hold only what the role itself relies on and what need not change, because this step stands above the inventory and can no longer be overridden from `group_vars`. And `-e` is kept for one-off runs and CI: a value from the command line always wins and leaves nothing in the repository.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'iac.var-precedence', caption: bi('Включайте ступени по одной и следите за итогом на web1. Затем включите vars роли — и попробуйте снова перебить порт из инвентаря.', 'Switch the steps on one by one and watch the result on web1. Then switch on the role vars and try again to override the port from the inventory.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ansSetup({ 'inventory.ini': INV, 'site.yml': FLAT_PLAY, 'templates/cafe.conf.j2': ROLE_TEMPLATE }),
      intro: bi('В `~/ops` плоский плейбук `site.yml` для группы web и шаблон `templates/cafe.conf.j2`, в котором порт — переменная `http_port`. Нигде она пока не задана.', '`~/ops` holds a flat playbook `site.yml` for the web group and a template `templates/cafe.conf.j2` where the port is the variable `http_port`. It is not set anywhere yet.'),
      tasks: [
        {
          id: 'skeleton',
          prompt: bi('Создайте каркас роли `webserver` в каталоге `~/ops/roles`.', 'Create the skeleton of the `webserver` role in `~/ops/roles`.'),
          check: { when: `files['${OPS}/roles/webserver/tasks/main.yml'].type=f && files['${OPS}/roles/webserver/defaults/main.yml'].type=f && files['${OPS}/roles/webserver/handlers/main.yml'].type=f` },
          chips: 'cd roles && ansible-galaxy role init webserver',
          concepts: ['iac.role'],
          docRef: { page: 'help/ansible-galaxy' },
          hints: { H1: bi('ansible-galaxy создаёт каркас в текущем каталоге; каталога roles ещё нет.', 'ansible-galaxy creates the skeleton in the current directory; the roles directory does not exist yet.'), H2: bi('mkdir roles && cd roles && ansible-galaxy role init webserver', 'mkdir roles && cd roles && ansible-galaxy role init webserver') },
        },
        {
          id: 'move',
          prompt: bi('Перенесите в роль задачи, handler и шаблон, а `http_port: 80` — в её defaults. В `site.yml` оставьте плей для группы web, который только подключает роль, и прогоните его.', 'Move the tasks, the handler and the template into the role, and put `http_port: 80` into its defaults. Leave in `site.yml` a play for the web group that only plugs the role in, and run it.'),
          check: {
            when: (f) => {
              const play = fileText(f, `${OPS}/site.yml`);
              const r = lastRun(f);
              return /roles:\s*\n\s*-\s*(role:\s*)?webserver/.test(play) && !/^\s*tasks:/m.test(play) && /http_port:\s*80\b/.test(fileText(f, `${OPS}/roles/webserver/defaults/main.yml`)) && !!r && r.tasks.some((t) => t.role === 'webserver' && t.task === 'The site config is in place') && Object.values(r.recap).every((x) => x.failed === 0) && listens(f, 'web1', 80) && listens(f, 'web2', 80);
            },
            fail: [
              { if: (f) => /could not find or access/i.test((f.term.main ?? []).at(-1)?.out ?? ''), say: bi('Задача роли ищет шаблон в roles/webserver/templates/. Перенесите туда cafe.conf.j2.', 'A role task looks for the template in roles/webserver/templates/. Move cafe.conf.j2 there.') },
              { if: (f) => /http_port' is undefined/.test((f.term.main ?? []).at(-1)?.out ?? ''), say: bi('Шаблону нужна http_port, а её нигде нет. Умолчание роли — defaults/main.yml.', 'The template needs http_port and it is nowhere. The role default goes into defaults/main.yml.') },
            ],
          },
          chips: 'ansible-playbook site.yml',
          concepts: ['iac.role'],
          docRef: { page: 'web/docs.ansible.com/roles', anchor: 'structure' },
          hints: {
            H1: bi('tasks/main.yml и handlers/main.yml — просто списки задач, без hosts: и tasks:.', 'tasks/main.yml and handlers/main.yml are plain lists of tasks, without hosts: and tasks:.'),
            H2: bi('```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  roles:\n    - webserver\n```', '```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  roles:\n    - webserver\n```'),
          },
        },
        {
          id: 'override',
          prompt: bi('Группе web нужен порт 8080, а роль трогать нельзя: она общая. Задайте порт в инвентаре, прогоните плейбук и убедитесь, что повторный прогон ничего не меняет.', 'The web group needs port 8080, and the role must not be touched: it is shared. Set the port in the inventory, run the playbook and check that a repeated run changes nothing.'),
          check: {
            when: (f) => {
              const r = lastRun(f);
              const prev = runs(f).at(-2);
              return listens(f, 'web1', 8080) && listens(f, 'web2', 8080) && /http_port:\s*80\b/.test(fileText(f, `${OPS}/roles/webserver/defaults/main.yml`)) && !!r && !!prev && r.tasks.some((t) => t.role === 'webserver') && Object.values(r.recap).every((x) => x.changed === 0 && x.failed === 0);
            },
            fail: [{ if: (f) => !/http_port:\s*80\b/.test(fileText(f, `${OPS}/roles/webserver/defaults/main.yml`)), say: bi('Умолчание роли поменялось, а роль общая: другим командам тоже достанется 8080. Переопределите порт для группы web в инвентаре.', 'The role default changed, and the role is shared: other teams get 8080 too. Override the port for the web group in the inventory.') }],
          },
          chips: 'mkdir group_vars',
          concepts: ['iac.var-precedence', 'iac.idempotence'],
          hints: { H1: bi('group_vars/web.yml рядом с инвентарём, в нём одна строка.', 'group_vars/web.yml next to the inventory, with one line in it.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('На странице Roles найдите раздел, где сказано, в каком порядке выполняются pre_tasks, роли и tasks плея.', 'On the Roles page find the section that says in which order pre_tasks, roles and the play’s tasks run.'),
      ref: { page: 'web/docs.ansible.com/roles' },
      answer: 'using',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Создайте каркас роли `monitoring` сразу в `~/ops/roles`, не выходя из `~/ops`. В уроке такого способа не было — найдите в `ansible-galaxy --help` ключ, который задаёт каталог для каркаса.', 'Create the skeleton of the `monitoring` role right in `~/ops/roles` without leaving `~/ops`. The lesson did not show how: find in `ansible-galaxy --help` the key that sets the directory for the skeleton.'),
      ref: { page: 'help/ansible-galaxy' },
      terminal: {
        setup: ansSetup({ 'inventory.ini': INV, 'roles/.keep': '' }),
        task: {
          id: 'init-path',
          prompt: bi('В ~/ops/roles/monitoring есть каркас роли.', '~/ops/roles/monitoring holds a role skeleton.'),
          check: { when: `files['${OPS}/roles/monitoring/meta/main.yml'].type=f && files['${OPS}/roles/monitoring/tasks/main.yml'].type=f && cwd='${OPS}'` },
          docStep: 4,
          beyond: true,
          solutionTokens: ['--init-path'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.role-dirs', 'iac.q.precedence', 'iac.q.vars-vs-defaults', 'iac.q.play-order'] },
  ],
};

export const modulesLesson: Lesson = {
  id: 'iac.modules',
  block: 'iac',
  title: bi('Переменные, модули и переезд без пересоздания', 'Variables, modules and moving without recreation'),
  summary: bi('Модуль Terraform описывает типовой кусок инфраструктуры один раз; блок moved переносит уже созданный ресурс в модуль, не трогая облако.', 'A Terraform module describes a typical piece of infrastructure once; a moved block carries an already created resource into a module without touching the cloud.'),
  introduces: ['iac.tf-variable', 'iac.tf-module', 'iac.moved'],
  uses: ['iac.resource', 'iac.plan', 'iac.state'],
  tier: 'core',
  minutes: 40,
  sources: src([W.modules, W.variables, W.refactoring], [W.ruYcModules, W.ruYcQuick]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В `main.tf` кафе уже три почти одинаковые ВМ: web, api и worker. Отличаются они именем и числом ядер, а всё остальное — образ, сеть, зона — повторено трижды. Когда понадобится сменить образ, поправить его придётся в трёх местах, и в одном обязательно забудут.',
        'The café’s `main.tf` already has three nearly identical VMs: web, api and worker. They differ in name and number of cores, and everything else (image, network, zone) is repeated three times. When the image has to change, it will have to be fixed in three places, and one of them will surely be forgotten.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Повторяющийся кусок описывают один раз и передают ему различия. Различия — это [[iac.tf-variable|входные переменные]]: блок `variable` объявляет имя, тип и, если нужно, значение по умолчанию, а внутри кода значение читается как `var.cores`.\n\n```hcl\nvariable "cores" {\n  type    = number\n  default = 2\n}\n```\n\nПеременная без `default` обязательна. Для корня конфигурации её задают ключом `-var`, файлом `terraform.tfvars` или переменной окружения `TF_VAR_cores`; Terraform проверит тип и правила `validation` ещё до плана.\n\n### Модуль\n\n[[iac.tf-module|Модуль Terraform]] — это просто каталог с `.tf`-файлами: своими переменными, ресурсами и выводами. Тот код, который вы писали до сих пор, тоже модуль — корневой. Другой каталог подключается блоком `module`:\n\n```hcl\nmodule "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n```\n\n`source` с `./` — путь к локальному модулю; остальные аргументы становятся его переменными. После добавления вызова нужен `terraform init`: он «устанавливает» модуль в `.terraform/modules`. Ресурсы модуля получают адрес с именем вызова: `resource "edu_vm" "this"` внутри модуля, вызванного как `web`, называется `module.web.edu_vm.this`. Поэтому один модуль можно вызвать несколько раз, и адреса не столкнутся.\n\nРесурсы модуля закрыты от вызывающего кода. Что модуль готов показать наружу, он объявляет выводом — `output "ip" { value = edu_vm.this.public_ip }`, — а корень читает его как `module.web.ip`. Модуль похож на функцию: переменные — её параметры, outputs — результат, а внутренности не видны.\n\n### Переезд без пересоздания\n\nВМ web уже работает под адресом `edu_vm.web`. Если просто перенести её описание в модуль, Terraform увидит в коде новый адрес `module.web.edu_vm.this`, а в state — старый, которого в коде больше нет. План получится честный и неприятный: удалить работающую ВМ и создать такую же. Terraform сопоставляет код и state только по адресу; одинаковые атрибуты для него ничего не значат.\n\nЧтобы сказать «это тот же объект, у него просто новый адрес», в код добавляют [[iac.moved|блок moved]]:\n\n```hcl\nmoved {\n  from = edu_vm.web\n  to   = module.web.edu_vm.this\n}\n```\n\nПеред планом Terraform переименует запись state, и план покажет `# edu_vm.web has moved to module.web.edu_vm.this` без единого создания и удаления. Блок moved проходит ревью вместе с рефакторингом и срабатывает в каждом окружении, где применяют этот код; удалять его стоит не раньше, чем его применят везде.',
        'A repeated piece is described once and given the differences. The differences are [[iac.tf-variable|input variables]]: a `variable` block declares a name, a type and, if needed, a default, and inside the code the value is read as `var.cores`.\n\n```hcl\nvariable "cores" {\n  type    = number\n  default = 2\n}\n```\n\nA variable without `default` is required. For the root of a configuration it is set with the `-var` key, a `terraform.tfvars` file or the `TF_VAR_cores` environment variable; Terraform checks the type and the `validation` rules before any plan.\n\n### A module\n\nA [[iac.tf-module|Terraform module]] is just a directory of `.tf` files with its own variables, resources and outputs. The code you have written so far is a module too, the root one. Another directory is plugged in with a `module` block:\n\n```hcl\nmodule "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n```\n\nA `source` starting with `./` is a path to a local module; the other arguments become its variables. After adding a call you need `terraform init`: it "installs" the module into `.terraform/modules`. Module resources get an address with the call name: `resource "edu_vm" "this"` inside a module called as `web` is named `module.web.edu_vm.this`. So one module can be called several times without the addresses clashing.\n\nModule resources are hidden from the calling code. What a module is willing to show, it declares as an output, `output "ip" { value = edu_vm.this.public_ip }`, and the root reads it as `module.web.ip`. A module is like a function: the variables are its parameters, the outputs its result, and the insides are not visible.\n\n### Moving without recreation\n\nThe web VM is already running at the address `edu_vm.web`. If you simply move its description into a module, Terraform sees a new address `module.web.edu_vm.this` in the code and the old one in the state, which is no longer in the code. The plan is honest and unpleasant: destroy the running VM and create an identical one. Terraform matches the code and the state only by address; identical attributes mean nothing to it.\n\nTo say "this is the same object, it just has a new address", you add a [[iac.moved|moved block]] to the code:\n\n```hcl\nmoved {\n  from = edu_vm.web\n  to   = module.web.edu_vm.this\n}\n```\n\nBefore the plan Terraform renames the state entry, and the plan shows `# edu_vm.web has moved to module.web.edu_vm.this` without a single creation or destruction. The moved block goes through review together with the refactoring and takes effect in every environment where this code is applied; remove it no earlier than it has been applied everywhere.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'iac.address', params: { scenario: 'refactor' }, caption: bi('Сначала без блока moved: посмотрите на простой сайта. Потом включите блок и потеряйте state.', 'First without the moved block: look at the site downtime. Then switch the block on and lose the state.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: tfSetup(TF_HEAD + TF_NET + TF_VM + TF_DNS, APPLIED),
      intro: bi('Сеть, ВМ web и DNS-запись www уже созданы этим кодом. Модулей пока нет.', 'The network, the web VM and the www DNS record were already created by this code. There are no modules yet.'),
      tasks: [
        {
          id: 'module',
          prompt: bi('Напишите модуль `./modules/vm` (переменные `name`, `network_id` и `cores` со значением по умолчанию 2, ресурс `edu_vm` `this` с образом ubuntu-24.04, вывод `ip`) и вызовите его как `module "api"` для ВМ с именем api. Примените.', 'Write a module `./modules/vm` (variables `name`, `network_id` and `cores` with a default of 2, an `edu_vm` resource `this` with the ubuntu-24.04 image, an output `ip`) and call it as `module "api"` for a VM named api. Apply.'),
          check: {
            when: (f, start) => !!vmByName(f, 'api') && !!stateAddr(f, 'module.api.edu_vm.this') && vmByName(f, 'web')?.id === vmByName(start, 'web')?.id && Object.keys(f.files).some((p) => p.startsWith(`${INFRA}/modules/vm/`) && p.endsWith('.tf')),
            fail: [{ if: (f) => /Module not installed/.test((f.term.main ?? []).at(-1)?.out ?? ''), say: bi('Новый вызов модуля нужно установить: terraform init.', 'A new module call must be installed: terraform init.') }],
          },
          chips: 'mkdir -p modules/vm',
          concepts: ['iac.tf-module', 'iac.tf-variable'],
          docRef: { page: 'web/opentofu.org/language/modules', anchor: 'calling' },
          hints: {
            H1: bi('Модуль — каталог с main.tf. В корне: module "api" { source = "./modules/vm" … }, потом init и apply.', 'A module is a directory with main.tf. In the root: module "api" { source = "./modules/vm" … }, then init and apply.'),
            H2: bi('```hcl\nmodule "api" {\n  source     = "./modules/vm"\n  name       = "api"\n  network_id = edu_network.main.id\n}\n```', '```hcl\nmodule "api" {\n  source     = "./modules/vm"\n  name       = "api"\n  network_id = edu_network.main.id\n}\n```'),
          },
        },
        {
          id: 'move',
          prompt: bi('Переведите и web на этот модуль: вместо `edu_vm.web` — `module "web"`, DNS-запись указывает на его вывод. Работающая ВМ web пересоздаваться не должна.', 'Move web onto this module too: `module "web"` instead of `edu_vm.web`, with the DNS record pointing at its output. The running web VM must not be recreated.'),
          check: {
            when: (f, start) => {
              const was = vmByName(start, 'web');
              const now = stateAddr(f, 'module.web.edu_vm.this');
              const rec = (tfOf(f)?.cloud ?? []).find((r) => r.type === 'edu_dns_record' && r.attrs.name === 'www');
              return !!was && now?.id === was.id && !stateAddr(f, 'edu_vm.web') && !!rec && rec.attrs.value === now.attrs.public_ip && /module\.web\.ip/.test(fileText(f, `${INFRA}/main.tf`));
            },
            fail: [{ if: (f) => !!lastPlan(f)?.applied && (tfOf(f)?.cloud ?? []).some((r) => r.type === 'edu_vm' && r.attrs.name === 'web') && !(tfOf(f)?.cloud ?? []).some((r) => r.id === eduId('vm', 2)), say: bi('ВМ web пересоздана: у неё новый ID. Terraform узнаёт объект только по адресу — нужен блок moved.', 'The web VM was recreated: it has a new ID. Terraform recognises an object only by address, so you need a moved block.') }],
          },
          chips: 'terraform plan',
          concepts: ['iac.moved'],
          docRef: { page: 'web/opentofu.org/language/moved', anchor: 'moved' },
          hints: { H1: bi('Сначала посмотрите plan без moved — он предложит удалить и создать. Затем добавьте moved { from, to }.', 'First look at the plan without moved: it proposes to destroy and create. Then add moved { from, to }.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('На странице Modules найдите раздел, где сказано, как корень читает значение из модуля.', 'On the Modules page find the section that says how the root reads a value from a module.'),
      ref: { page: 'web/opentofu.org/language/modules' },
      answer: 'outputs',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Переименуйте `edu_dns_record.www` в `edu_dns_record.site` — и в коде, и в state — без блока moved и без пересоздания записи. Нужная подкоманда есть в `terraform state -help`.', 'Rename `edu_dns_record.www` to `edu_dns_record.site`, both in the code and in the state, without a moved block and without recreating the record. The subcommand you need is in `terraform state -help`.'),
      ref: { page: 'help/terraform' },
      terminal: {
        setup: tfSetup(TF_HEAD + TF_NET + TF_VM + TF_DNS, APPLIED),
        task: {
          id: 'state-mv',
          prompt: bi('В state есть edu_dns_record.site с прежним ID, plan пуст.', 'The state has edu_dns_record.site with the old ID, the plan is empty.'),
          check: {
            when: (f, start) => {
              const was = (tfOf(start ?? f)?.cloud ?? []).find((r) => r.type === 'edu_dns_record');
              const code = fileText(f, `${INFRA}/main.tf`);
              return !!was && stateAddr(f, 'edu_dns_record.site')?.id === was.id && /resource\s+"edu_dns_record"\s+"site"/.test(code) && !/moved\s*\{/.test(code) && emptyPlan(f);
            },
          },
          docStep: 4,
          beyond: true,
          solutionTokens: ['state mv'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.module-addr', 'iac.q.module-output', 'iac.q.required-var', 'iac.q.rename'] },
  ],
};

const IMPORT_SETUP = tfSetup(TF_HEAD + TF_NET + TF_VM, [...APPLIED, LEGACY_SCRIPT]);
const DRIFT_SETUP = tfSetup(TF_HEAD + TF_NET + TF_VM, [...APPLIED, `edu vm update ${eduId('vm', 2)} --cores 4`]);

export const importLesson: Lesson = {
  id: 'iac.import',
  block: 'iac',
  title: bi('Чужое и изменённое: import, refresh-only и контроль дрейфа', 'Foreign and changed: import, refresh-only and drift control'),
  summary: bi('Объект, созданный руками, берут под управление, а не пересоздают; изменение мимо кода записывают в state или откатывают — и узнают о нём из CI, а не от клиента.', 'An object made by hand is taken over, not recreated; a change behind the code is recorded in the state or undone, and you learn about it from CI, not from a customer.'),
  introduces: ['iac.import', 'iac.refresh-only'],
  uses: ['iac.state', 'iac.drift', 'iac.plan', 'iac.moved'],
  tier: 'core',
  minutes: 35,
  sources: src([W.importBlock, W.planCmd, S.tfDrift], [W.ruYcImport, S.ruTerraform]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Ночью сайт не справлялся с нагрузкой, и дежурный сделал то, что было быстрее всего: создал в консоли облака ещё одну ВМ и поднял старой число ядер. Сайт выжил. Утром в облаке живёт машина, о которой Terraform ничего не знает, и машина, которая уже не совпадает с кодом. Удалять их нельзя — на них трафик.',
        'At night the site could not cope with the load, and the on-call engineer did what was fastest: created one more VM in the cloud console and raised the cores of the old one. The site survived. In the morning the cloud runs a machine Terraform knows nothing about and a machine that no longer matches the code. Neither can be deleted: traffic runs on them.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Для Terraform существует только то, что записано в state. ВМ, созданная в консоли, для него невидима: если описать её в коде и запустить apply, он честно создаст вторую такую же. Правильный путь — [[iac.import|импорт ресурса]]: привязать существующий объект к адресу в коде, ничего не создавая.\n\nСначала вы описываете объект блоком `resource` — так, как он выглядит в облаке на самом деле. Затем рядом пишете, какой объект облака к этому адресу привязать:\n\n```hcl\nimport {\n  to = edu_vm.legacy\n  id = "vm-4f91"\n}\n```\n\nПлан покажет `# edu_vm.legacy will be imported` и итог `Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.` Если вместе с импортом план хочет ещё и изменить ресурс, значит, код описывает его не таким, какой он есть: правьте код, пока импорт не останется единственным действием, и только потом применяйте. После apply объект в state, следующий plan пуст, а блок import можно убрать. Есть и старая форма той же операции — команда `terraform import ADDR ID`, — но она меняет state сразу, без плана и без ревью.\n\n### Изменение мимо кода\n\nС машиной, которой подняли ядра, вы уже встречались: это дрейф, и обычный plan предложит вернуть её к коду. Иногда это и нужно. Но бывает, что изменение правильное и вы хотите сначала зафиксировать реальность, а код поправить отдельным ревью. Для этого есть [[iac.refresh-only|режим refresh-only]]: `terraform plan -refresh-only` показывает, что изменилось мимо Terraform, и не предлагает ничего откатывать, а `terraform apply -refresh-only` записывает эти значения в state, не трогая облако. Учтите, что код он не меняет: пока в коде два ядра, следующий обычный plan снова захочет вернуть два.\n\n### Узнавать о дрейфе первым\n\nДрейф не исчезает сам: он ждёт следующего plan. Если plan запускают раз в месяц, о ручной правке узнают через месяц — обычно в самый неудобный момент. Поэтому в CI ставят расписание: plan каждую ночь или каждый час, и джоба падает, если разница есть. Остаётся только научить plan сообщать о разнице кодом возврата, а не текстом для человека.',
        'For Terraform only what is written in the state exists. A VM created in the console is invisible to it: if you describe it in the code and run apply, it honestly creates a second identical one. The right way is a [[iac.import|resource import]]: attach the existing object to an address in the code, creating nothing.\n\nFirst you describe the object with a `resource` block, as it really looks in the cloud. Then, next to it, you write which cloud object to attach to that address:\n\n```hcl\nimport {\n  to = edu_vm.legacy\n  id = "vm-4f91"\n}\n```\n\nThe plan shows `# edu_vm.legacy will be imported` and the total `Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.` If together with the import the plan also wants to change the resource, the code describes it differently from how it is: fix the code until the import is the only action, and only then apply. After apply the object is in the state, the next plan is empty, and the import block may be removed. There is also an older form of the same operation, the command `terraform import ADDR ID`, but it changes the state at once, with no plan and no review.\n\n### A change behind the code\n\nYou have already met the machine whose cores were raised: that is drift, and an ordinary plan proposes to bring it back to the code. Sometimes that is exactly what you want. But sometimes the change is right, and you want to record reality first and fix the code in a separate review. That is what [[iac.refresh-only|refresh-only mode]] is for: `terraform plan -refresh-only` shows what changed behind Terraform’s back and proposes to undo nothing, and `terraform apply -refresh-only` writes those values into the state without touching the cloud. Note that it does not change the code: while the code says two cores, the next ordinary plan again wants to bring back two.\n\n### Learning about drift first\n\nDrift does not go away by itself: it waits for the next plan. If plan runs once a month, a manual edit is discovered a month later, usually at the worst moment. So CI gets a schedule: plan every night or every hour, and the job fails if there is a difference. All that remains is to make plan report the difference with an exit code rather than with text for a human.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'iac.address', params: { scenario: 'adopt' }, caption: bi('Ситуация «ВМ создали руками»: сравните план без блока import и с ним, затем ошибитесь в ID.', 'The "VM made by hand" situation: compare the plan without the import block and with it, then get the ID wrong.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: IMPORT_SETUP,
      intro: bi('Код описывает сеть и ВМ web. В облаке есть ещё одна ВМ — её ночью создали руками; посмотрите `edu vm list`.', 'The code describes the network and the web VM. The cloud has one more VM, made by hand at night; look at `edu vm list`.'),
      tasks: [
        {
          id: 'adopt',
          prompt: bi('Возьмите ручную ВМ под управление Terraform как `edu_vm.legacy`, не создавая новых машин. В конце `terraform plan` должен показать `No changes`.', 'Take the hand-made VM under Terraform’s management as `edu_vm.legacy` without creating new machines. At the end `terraform plan` must show `No changes`.'),
          check: {
            when: (f, start) => {
              const legacy = vmByName(start, 'legacy');
              return !!legacy && stateAddr(f, 'edu_vm.legacy')?.id === legacy.id && (tfOf(f)?.cloud ?? []).filter((r) => r.type === 'edu_vm').length === 2 && emptyPlan(f) && !lastPlan(f)?.applied;
            },
            fail: [{ if: (f) => (tfOf(f)?.cloud ?? []).filter((r) => r.type === 'edu_vm').length > 2, say: bi('В облаке стало три ВМ: apply создал новую вместо того, чтобы взять существующую. Удалите лишнюю через код и используйте import.', 'The cloud now has three VMs: apply created a new one instead of taking the existing one. Remove the extra one through the code and use import.') }],
          },
          chips: 'edu vm list',
          concepts: ['iac.import'],
          docRef: { page: 'web/opentofu.org/language/import', anchor: 'block' },
          hints: {
            H1: bi('Атрибуты ВМ покажет edu vm get <ID>; блок resource должен им соответствовать.', 'edu vm get <ID> shows the VM attributes; the resource block must match them.'),
            H2: bi('```hcl\nimport {\n  to = edu_vm.legacy\n  id = "<ID из edu vm list>"\n}\n```', '```hcl\nimport {\n  to = edu_vm.legacy\n  id = "<ID from edu vm list>"\n}\n```'),
          },
        },
      ],
    },
    {
      id: 'lab2',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: DRIFT_SETUP,
      intro: bi('Ночью дежурный поднял ВМ web до 4 ядер. Команда согласна с правкой, но код поправит отдельным ревью.', 'At night the on-call engineer raised the web VM to 4 cores. The team agrees with the change but will fix the code in a separate review.'),
      tasks: [
        {
          id: 'record',
          prompt: bi('Запишите в state, что у web теперь 4 ядра, не меняя ни облако, ни код.', 'Record in the state that web now has 4 cores, without changing the cloud or the code.'),
          check: {
            when: (f) => stateAddr(f, 'edu_vm.web')?.attrs.cores === 4 && vmByName(f, 'web')?.attrs.cores === 4 && /cores\s*=\s*2/.test(fileText(f, `${INFRA}/main.tf`)) && lastPlan(f)?.kind === 'refresh-only' && !!lastPlan(f)?.applied,
            fail: [{ if: (f) => vmByName(f, 'web')?.attrs.cores === 2, say: bi('Обычный apply вернул облако к коду. Нужен режим, который только обновляет state.', 'An ordinary apply brought the cloud back to the code. You need the mode that only updates the state.') }],
          },
          chips: 'terraform plan -refresh-only',
          concepts: ['iac.refresh-only'],
          docRef: { page: 'web/opentofu.org/cli/plan-modes', anchor: 'refresh-only' },
          hints: { H1: bi('Сначала посмотрите plan -refresh-only, затем apply с тем же ключом.', 'First look at plan -refresh-only, then apply with the same key.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Ночная джоба CI должна падать, если облако разошлось с кодом. Обычный `terraform plan` завершается кодом 0 и при разнице. Найдите в `terraform plan -help` ключ, который меняет смысл кода возврата, и выполните plan так, чтобы он сообщил о дрейфе кодом.', 'A nightly CI job must fail if the cloud has diverged from the code. An ordinary `terraform plan` exits with 0 even when there is a difference. Find in `terraform plan -help` the key that changes the meaning of the exit code, and run plan so that it reports the drift with its code.'),
      ref: { page: 'help/terraform' },
      terminal: {
        setup: DRIFT_SETUP,
        task: {
          id: 'exitcode',
          prompt: bi('Последний plan завершился кодом 2.', 'The last plan exited with code 2.'),
          check: { when: (f) => (f.term.main ?? []).at(-1)?.exit === 2 && lastPlan(f)?.kind === 'plan' && (lastPlan(f)?.change ?? 0) > 0 },
          docStep: 4,
          beyond: true,
          solutionTokens: ['-detailed-exitcode'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.import-config', 'iac.q.adopt-order', 'iac.q.refresh-only', 'iac.q.exitcodes'] },
  ],
};

export const lessons2 = { rolesLesson, modulesLesson, importLesson };

// ── placement additions ──

export const placement2: PlacementTask[] = [
  { id: 'iac.place.precedence', level: 'experienced', key: false, concepts: ['iac.var-precedence'], kind: 'quiz', item: { ...(quiz2.find((q) => q.id === 'iac.q.precedence') as QuizItem), id: 'iac.place.q.precedence' } },
  { id: 'iac.place.rename', level: 'experienced', key: true, concepts: ['iac.moved'], kind: 'quiz', item: { ...(quiz2.find((q) => q.id === 'iac.q.rename') as QuizItem), id: 'iac.place.q.rename' } },
];

// ── the block exam ──

const EXAM_ROLE_TASKS = '- name: nginx is installed\n  ansible.builtin.apt:\n    name: nginx\n    state: present\n\n- name: The site config is in place\n  ansible.builtin.template:\n    src: cafe.conf.j2\n    dest: /etc/nginx/sites-enabled/cafe.conf\n  notify: Reload nginx\n\n- name: The motd says who manages the host\n  ansible.builtin.shell: echo "Managed by Ansible" >> /etc/motd\n\n- name: nginx is running\n  ansible.builtin.service:\n    name: nginx\n    state: started\n';
const examAnsSetup: TerminalSetup = ansSetup({
  'inventory.ini': INV,
  'group_vars/web.yml': 'http_port: 8081\n',
  'site.yml': '- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  roles:\n    - webserver\n',
  'roles/webserver/tasks/main.yml': EXAM_ROLE_TASKS,
  'roles/webserver/handlers/main.yml': '- name: Reload nginx\n  ansible.builtin.service:\n    name: nginx\n    state: reloaded\n',
  'roles/webserver/vars/main.yml': 'http_port: 80\n',
  'roles/webserver/templates/cafe.conf.j2': ROLE_TEMPLATE,
});

const EXAM_TF_ROOT = TF_HEAD + TF_NET + '\nmodule "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n';
const examTfSetup = (extra: string[] = []): TerminalSetup => ({
  cwd: '~/infra',
  files: [
    { path: `${INFRA}/main.tf`, content: EXAM_TF_ROOT },
    { path: `${INFRA}/modules/vm/main.tf`, content: MOD_VM },
  ],
  ext: { tf: {} },
  script: [...APPLIED, ...extra],
});

export const iacExam: Exam = {
  id: 'iac.exam',
  block: 'iac',
  title: bi('Окружение для нового сервиса', 'An environment for a new service'),
  story: bi('Вы вторую неделю в команде кафе. Тимлид оставил четыре карточки: сайт на портах из инвентаря, ВМ для API, ручная DNS-запись после ночного инцидента и старая ВМ, которую передают другой команде.', 'You are in your second week with the café team. The team lead left four cards: the site on ports from the inventory, a VM for the API, a hand-made DNS record after a night incident and an old VM handed over to another team.'),
  intro: bi('Четыре задачи на двух машинах и вопрос о переменных. Открыта только встроенная документация: `--help`, `ansible-doc` и страницы Ansible и OpenTofu в справочнике; подсказок и наставника нет.', 'Four tasks on two machines and a question about variables. Only the built-in documentation is open: `--help`, `ansible-doc` and the Ansible and OpenTofu pages of the reference; no hints and no mentor.'),
  minutes: 60,
  pass: 0.7,
  allowedDocs: ['help', 'ansible-doc', 'terraform'],
  tasks: [
    {
      id: 'role-port',
      weight: 3,
      critical: true,
      kind: 'task',
      setup: examAnsSetup,
      task: {
        id: 'x-role',
        prompt: bi('«Сайт на web1 и web2 должен слушать порт из group_vars/web.yml (8081), а повторный прогон — ничего не менять». Роль webserver общая: порт в ней должен остаться настраиваемым, а задачи — честными.', '“The site on web1 and web2 must listen on the port from group_vars/web.yml (8081), and a repeated run must change nothing.” The webserver role is shared: its port must stay configurable and its tasks honest.'),
        check: {
          when: (f) => {
            const r = lastRun(f);
            return listens(f, 'web1', 8081) && listens(f, 'web2', 8081) && runs(f).length >= 2 && !!r && r.tasks.some((t) => t.role === 'webserver') && Object.values(r.recap).every((x) => x.changed === 0 && x.failed === 0) && !/^\s*http_port:/m.test(fileText(f, `${OPS}/roles/webserver/vars/main.yml`)) && !/ansible\.builtin\.(shell|command)/.test(fileText(f, `${OPS}/roles/webserver/tasks/main.yml`));
          },
        },
      },
    },
    {
      id: 'api-vm',
      weight: 3,
      critical: true,
      kind: 'task',
      setup: examTfSetup(),
      task: {
        id: 'x-api',
        prompt: bi('«Нужна ВМ api на 4 ядра из того же модуля и DNS-запись api.site.edu на её адрес». ВМ web трогать нельзя.', '“We need an api VM with 4 cores from the same module and a DNS record api.site.edu pointing at its address.” The web VM must not be touched.'),
        check: {
          when: (f, start) => {
            const api = vmByName(f, 'api');
            const rec = (tfOf(f)?.cloud ?? []).find((r) => r.type === 'edu_dns_record' && r.attrs.name === 'api' && r.attrs.zone === 'site.edu');
            return !!api && api.attrs.cores === 4 && stateAddr(f, 'module.api.edu_vm.this')?.id === api.id && !!rec && rec.attrs.value === api.attrs.public_ip && vmByName(f, 'web')?.id === vmByName(start, 'web')?.id && /module\.api\.ip/.test(fileText(f, `${INFRA}/main.tf`));
          },
        },
      },
    },
    {
      id: 'adopt-dns',
      weight: 2,
      kind: 'task',
      setup: examTfSetup([`edu dns create --zone site.edu --name shop --value 203.0.113.99`]),
      task: {
        id: 'x-adopt',
        prompt: bi('«Ночью дежурный создал в консоли запись shop.site.edu. Пусть ею управляет Terraform, а сама запись не пересоздаётся». Итоговый plan пуст.', '“At night the on-call engineer created the record shop.site.edu in the console. Let Terraform manage it, without recreating the record.” The final plan is empty.'),
        check: {
          when: (f, start) => {
            const was = (tfOf(start ?? f)?.cloud ?? []).find((r) => r.type === 'edu_dns_record' && r.attrs.name === 'shop');
            return !!was && (tf(f)?.state ?? []).some((s) => s.type === 'edu_dns_record' && s.id === was.id) && (tfOf(f)?.cloud ?? []).filter((r) => r.type === 'edu_dns_record').length === 1 && emptyPlan(f) && !lastPlan(f)?.applied;
          },
        },
      },
    },
    {
      id: 'hand-over',
      weight: 2,
      beyond: true,
      kind: 'task',
      setup: examTfSetup(),
      task: {
        id: 'x-handover',
        prompt: bi('«ВМ web передают другой команде со своим Terraform. Уберите её из нашего управления так, чтобы она продолжила работать в облаке». Итоговый plan пуст. В уроках этого не было — ищите в документации.', '“The web VM is handed over to another team with its own Terraform. Remove it from our management so that it keeps running in the cloud.” The final plan is empty. The lessons did not cover this: look it up in the documentation.'),
        check: {
          when: (f, start) => {
            const web = vmByName(start, 'web');
            return !!web && (tfOf(f)?.cloud ?? []).some((r) => r.id === web.id) && !(tf(f)?.state ?? []).some((s) => s.id === web.id) && !/module\s+"web"/.test(fileText(f, `${INFRA}/main.tf`)) && emptyPlan(f);
          },
        },
        docStep: 5,
        solutionTokens: ['state rm', 'removed'],
      },
    },
    { id: 'precedence', weight: 1, kind: 'quiz', item: { ...(quiz2.find((q) => q.id === 'iac.q.vars-vs-defaults') as QuizItem), id: 'iac.exam.q.precedence' } },
  ],
  explain: [
    { id: 'idem', prompt: bi('Тимлид спрашивает: «Почему второй прогон плейбука ничего не меняет и зачем нам это?»', 'The team lead asks: “Why does the second playbook run change nothing, and why do we need that?”'), keyPoints: [bi('описано желаемое состояние, а не шаги', 'the desired state is described, not steps'), bi('модуль сначала смотрит, как есть, и меняет только разницу', 'a module first looks at how things are and changes only the difference'), bi('changed=0 на втором прогоне — тест плейбука', 'changed=0 on the second run is the test of a playbook')] },
    { id: 'address', prompt: bi('«Мы переложили код ВМ в модуль. Почему Terraform хотел её пересоздать и как вы это предотвратили?»', '“We moved the VM code into a module. Why did Terraform want to recreate it, and how did you prevent that?”'), keyPoints: [bi('Terraform сопоставляет код и state по адресу', 'Terraform matches the code and the state by address'), bi('новый адрес — новый ресурс, старый — на удаление', 'a new address is a new resource, the old one goes to destruction'), bi('блок moved переименовывает запись state без изменений в облаке', 'a moved block renames the state entry with no changes in the cloud')] },
  ],
};
