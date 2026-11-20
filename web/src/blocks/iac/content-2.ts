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
  { id: 'iac.role', term: bi('роль Ansible', 'Ansible role'), forms: { ru: ['роли Ansible', 'ролью Ansible', 'ролей Ansible'], en: ['Ansible roles'] }, short: bi('Плейбук, разложенный по каталогам roles/<имя>/ (tasks, handlers, templates, defaults, vars, meta) так, чтобы его можно было подключать в разные сценарии, не копируя.', 'A playbook laid out in the directories roles/<name>/ (tasks, handlers, templates, defaults, vars, meta) so that it can be plugged into different plays.'), introducedIn: 'iac.roles', docRef: { page: 'web/docs.ansible.com/roles', anchor: 'structure' } },
  { id: 'iac.var-precedence', term: bi('приоритет переменных', 'variable precedence'), forms: { ru: ['приоритета переменных', 'приоритету переменных', 'приоритетом переменных'] }, short: bi('Порядок мест, где задают переменную Ansible, от умолчаний роли внизу до ключа -e наверху. Значение с более высокой ступени этой лестницы перекрывает значение с более низкой.', 'The ladder of places where an Ansible variable is set: a value from a higher step wins, from role defaults up to -e.'), introducedIn: 'iac.roles', docRef: { page: 'web/docs.ansible.com/variable-precedence', anchor: 'ladder' } },
  { id: 'iac.tf-variable', term: bi('входная переменная', 'input variable'), forms: { ru: ['входной переменной', 'входные переменные', 'входных переменных', 'входную переменную'], en: ['input variables'] }, short: bi('Так называют параметр конфигурации или модуля Terraform. Его объявляют блоком variable с типом и значением по умолчанию, а в коде читают как var.<имя>.', 'A parameter of a Terraform configuration or module: a variable block with a type and a default; the value is var.<name>.'), introducedIn: 'iac.modules' },
  { id: 'iac.tf-module', term: bi('модуль Terraform', 'Terraform module'), forms: { ru: ['модуля Terraform', 'модулем Terraform', 'модули Terraform', 'модулей Terraform', 'модуле Terraform'], en: ['Terraform modules'] }, short: bi('Каталог с файлами .tf, у которого есть свои входные переменные и выводы. Его вызывают блоком module, и ресурсы модуля получают адреса вида module.<имя>.…', 'A directory of .tf files with its own input variables and outputs; it is called with a module block, and its resources get the addresses module.<name>.…'), introducedIn: 'iac.modules', docRef: { page: 'web/opentofu.org/language/modules', anchor: 'calling' } },
  { id: 'iac.moved', term: bi('блок moved', 'moved block'), forms: { ru: ['блока moved', 'блоком moved', 'блоки moved'], en: ['moved blocks'] }, short: bi('Блок, который сообщает, что объект с адреса from теперь находится по адресу to. Terraform переименовывает запись в state, а не пересоздаёт ресурс.', 'A block saying that the object at address from is now at address to. Terraform renames the state entry instead of recreating the resource.'), introducedIn: 'iac.modules', docRef: { page: 'web/opentofu.org/language/moved', anchor: 'moved' } },
  { id: 'iac.import', term: bi('импорт ресурса', 'resource import'), forms: { ru: ['импорта ресурса', 'импортом ресурса', 'импорт ресурсов'] }, short: bi('Привязка существующего объекта облака к блоку resource. Terraform записывает ID объекта в state и дальше управляет им, ничего не создавая.', 'Attaching an existing cloud object to a resource block: Terraform writes its ID into the state and manages it from then on, creating nothing.'), introducedIn: 'iac.import', docRef: { page: 'web/opentofu.org/language/import', anchor: 'block' } },
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
      { id: 'handlers', left: 'handlers/main.yml', right: bi('обработчики роли', 'the role’s handlers') },
      { id: 'defaults', left: 'defaults/main.yml', right: bi('значения, которые пользователь роли переопределяет', 'values the user of the role overrides'), why: bi('Это самая низкая ступень лестницы, и её перекрывает даже group_vars/all.', 'The lowest step of the ladder: even group_vars/all beats it.') },
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
      { id: 'ok', text: bi('web1 получит 8081, а web2 получит 8080', 'web1 gets 8081, web2 gets 8080'), correct: true },
      { id: 'all80', text: bi('Оба получат 80, потому что роль главнее инвентаря', 'Both 80: the role matters more than the inventory'), why: bi('Умолчания роли стоят на нижней ступени, и они для того и нужны, чтобы их перекрывали.', 'defaults are the bottom step: they exist precisely to be overridden.') },
      { id: 'all8080', text: bi('Оба получат 8080, потому что файл группы прочитан последним', 'Both 8080: the group is read last'), why: bi('Порядок чтения файлов ничего не решает, а переменная хоста стоит на лестнице выше переменной группы.', 'The reading order does not decide. A host variable stands above a group variable.') },
    ],
    explain: bi('Лестница из урока состоит из семи ступеней: умолчания роли, переменные всех хостов, переменные группы, переменные самого хоста, vars сценария, vars роли и, наконец, ключ `-e`. В инвентаре действует правило «чем точнее место описывает хост, тем выше его ступень», поэтому host_vars/web1.yml перекрывает group_vars/web.yml. Остальные ступени стоят выше инвентаря, потому что их задают сознательно, для своего сценария, своей роли или одного запуска.', 'The ladder from the lesson has seven steps: the role defaults, the variables of all hosts, the group variables, the host’s own variables, the play vars, the role vars and, finally, the `-e` key. Inside the inventory the rule is “the more precisely a place describes the host, the higher its step”, so host_vars/web1.yml overrides group_vars/web.yml. The other steps stand above the inventory because they are set deliberately, for their play, their role or one run.'),
  },
  {
    id: 'iac.q.vars-vs-defaults',
    kind: 'mcq',
    concepts: ['iac.role', 'iac.var-precedence'],
    prompt: bi('Автор роли записал `http_port: 80` в `vars/main.yml`. Команда задаёт 8080 в group_vars/web.yml, а на хостах по-прежнему 80. Как исправить правильно?', 'The role author wrote `http_port: 80` into `vars/main.yml`. The team sets 8080 in group_vars/web.yml, and the hosts still get 80. What is the right fix?'),
    options: [
      { id: 'defaults', text: bi('Перенести значение в defaults/main.yml роли', 'Move the value into the role’s defaults/main.yml'), correct: true },
      { id: 'extra', text: bi('Запускать плейбук всегда с -e http_port=8080', 'Always run the playbook with -e http_port=8080'), why: bi('Это сработает, но настройка перестанет храниться в репозитории и окажется в памяти людей и в скриптах запуска.', 'It works, but the setting moves out of the repository into people’s memory and launch scripts.') },
      { id: 'host', text: bi('Задать порт в host_vars каждого хоста', 'Set the port in host_vars of every host'), why: bi('Переменные из vars роли стоят на лестнице выше, чем host_vars, поэтому порт на хостах не изменится.', 'Role vars stand higher on the ladder than host_vars, so the port on the hosts does not change.') },
    ],
  },
  {
    id: 'iac.q.play-order',
    kind: 'order',
    concepts: ['iac.role'],
    prompt: bi('В каком порядке Ansible выполняет части сценария с ролями?', 'In which order does Ansible run the parts of a play with roles?'),
    steps: [
      { id: 'pre', text: 'pre_tasks' },
      { id: 'deps', text: bi('роли из dependencies в meta/main.yml', 'roles from dependencies in meta/main.yml') },
      { id: 'roles', text: bi('роли из списка roles:', 'the roles of the roles: list') },
      { id: 'tasks', text: 'tasks' },
      { id: 'handlers', text: bi('уведомлённые обработчики', 'the notified handlers'), why: bi('Обработчики выполняются один раз в конце сценария, в том числе для задач из ролей.', 'Handlers come at the end of the play, once, for the tasks of roles too.') },
    ],
  },
  {
    id: 'iac.q.module-addr',
    kind: 'mcq',
    concepts: ['iac.tf-module'],
    prompt: bi('Модуль `./modules/vm` описывает `resource "edu_vm" "this"`. Его вызвали блоком `module "api"`. Какой адрес у ВМ в state?', 'The module `./modules/vm` declares `resource "edu_vm" "this"`. It is called with `module "api"`. What is the VM’s address in the state?'),
    options: [
      { id: 'ok', text: 'module.api.edu_vm.this', correct: true },
      { id: 'flat', text: 'edu_vm.this', why: bi('Ресурсы модуля получают в начало адреса имя вызова, иначе у двух вызовов одного модуля совпали бы адреса.', 'Module resources get the call prefix: otherwise two calls of one module would clash on addresses.') },
      { id: 'dir', text: 'modules.vm.edu_vm.this', why: bi('В адрес входит имя вызова, то есть метка блока module, а не имя каталога.', 'The address contains the call name (the module block label), not the directory.') },
    ],
  },
  {
    id: 'iac.q.rename',
    kind: 'mcq',
    concepts: ['iac.moved', 'iac.state'],
    prompt: bi('Описание ВМ `edu_vm.web` перенесли в код модуля, и теперь её адрес `module.web.edu_vm.this`. Блока moved в коде нет. Что покажет plan?', 'The VM `edu_vm.web` was moved into a module’s code: it is now `module.web.edu_vm.this`. There is no moved block. What does plan show?'),
    options: [
      { id: 'recreate', text: bi('Удалить edu_vm.web и создать module.web.edu_vm.this', 'Destroy edu_vm.web and create module.web.edu_vm.this'), correct: true },
      { id: 'nothing', text: 'No changes', why: bi('Terraform сопоставляет код и state по адресу, поэтому новый адрес для него означает новый ресурс, а старый адрес означает лишний ресурс, который нужно удалить.', 'Terraform matches the code and the state by address. A new address is a new resource to it, and the old one is surplus.') },
      { id: 'guess', text: bi('Terraform сам поймёт по имени web, что это та же ВМ', 'It figures out it is the same VM by the name web'), why: bi('Атрибуты не служат ключом для сопоставления, ведь две разные ВМ могут называться одинаково.', 'Attributes are not a key: two different VMs may have the same name.') },
    ],
    explain: bi('Блок `moved { from = edu_vm.web  to = module.web.edu_vm.this }` переименовывает запись в state, и план перестаёт предлагать изменения.', 'The block `moved { from = edu_vm.web  to = module.web.edu_vm.this }` renames the state entry, and the plan stops proposing changes.'),
  },
  {
    id: 'iac.q.module-output',
    kind: 'bugfind',
    concepts: ['iac.tf-module'],
    prompt: bi('`terraform validate` сообщает об ошибке в этом коде. Какая строка неверна?', '`terraform validate` complains about this code. Which line is wrong?'),
    lang: 'hcl',
    code: 'module "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n\nresource "edu_dns_record" "www" {\n  zone  = "site.edu"\n  name  = "www"\n  value = module.web.edu_vm.this.public_ip\n}',
    bug: [10],
    why: {
      2: bi('Путь к локальному модулю начинается с ./, поэтому эта строка написана верно.', 'The path to a local module starts with ./, so this line is correct.'),
      4: bi('Аргумент модуля может ссылаться на ресурс корневого модуля, и так сеть передают внутрь модуля.', 'A module argument may refer to a root resource: that is how the network is passed in.'),
      10: bi('Эта строка обращается к ресурсу внутри модуля, а ресурсы модуля закрыты от вызывающего кода. Наружу видны только выводы модуля, например `module.web.ip`.', 'This line refers to a resource inside the module, and module resources are hidden from the calling code. Only the module’s outputs are visible outside, for example `module.web.ip`.'),
    },
  },
  {
    id: 'iac.q.required-var',
    kind: 'mcq',
    concepts: ['iac.tf-variable'],
    prompt: bi('В модуле `variable "network_id" { type = string }` без default. Вызов модуля его не передаёт. Что будет?', 'The module has `variable "network_id" { type = string }` without a default. The module call does not pass it. What happens?'),
    options: [
      { id: 'error', text: bi('Terraform остановится с ошибкой Missing required argument ещё до плана', 'A Missing required argument error before any plan'), correct: true },
      { id: 'null', text: bi('Terraform подставит null, и облако откажет при создании', 'null is used and the cloud refuses at creation'), why: bi('Переменная без default обязательна, и Terraform проверяет это при разборе кода, ещё до запросов к API.', 'A variable without a default is required: Terraform checks it while parsing, before any API call.') },
      { id: 'ask', text: bi('Terraform спросит значение в терминале', 'Terraform asks for the value in the terminal'), why: bi('Terraform спрашивает только значения переменных корневого модуля, да и то не в CI. Аргумент модуля обязан быть указан в вызове.', 'Only root variables are asked for, and not in CI. A module argument must be in the call.') },
    ],
  },
  {
    id: 'iac.q.import-config',
    kind: 'mcq',
    concepts: ['iac.import'],
    prompt: bi('Вы добавили `import { to = edu_vm.legacy  id = "vm-4f91" }`, но блока `resource "edu_vm" "legacy"` ещё нет. Что скажет plan?', 'You added `import { to = edu_vm.legacy  id = "vm-4f91" }`, but there is no `resource "edu_vm" "legacy"` block yet. What does plan say?'),
    options: [
      { id: 'err', text: bi('Configuration for import target does not exist', 'Configuration for import target does not exist'), correct: true },
      { id: 'gen', text: bi('Terraform сам допишет блок resource по данным облака', 'It writes the resource block itself from the cloud'), why: bi('Код пишет человек, а блок import только привязывает объект к адресу, который уже описан.', 'A person writes the code: import only attaches the object to an address that is already described.') },
      { id: 'create', text: bi('Terraform создаст новую ВМ', 'It creates a new VM'), why: bi('Блок import ничего не создаёт, он берёт под управление то, что уже есть.', 'import creates nothing: it takes over what already exists.') },
    ],
  },
  {
    id: 'iac.q.adopt-order',
    kind: 'order',
    concepts: ['iac.import'],
    prompt: bi('Как взять под управление ВМ, которую создали вручную? Расставьте шаги по порядку.', 'How do you take over a VM that was created by hand? Put the steps in order.'),
    steps: [
      { id: 'id', text: bi('узнать её ID в облаке', 'find its ID in the cloud') },
      { id: 'code', text: bi('описать её блоком resource с её настоящими атрибутами', 'describe it with a resource block with its real attributes') },
      { id: 'block', text: bi('добавить блок import с этим ID', 'add an import block with that ID') },
      { id: 'plan', text: bi('запустить plan и увидеть «will be imported» без других действий', 'run plan and see "will be imported" with no other actions'), why: bi('Если план хочет ещё и изменить ресурс, значит, код не совпадает с облаком, и править нужно код, а не облако.', 'If the plan also wants to change the resource, the code does not match the cloud: fix the code, not the cloud.') },
      { id: 'apply', text: bi('выполнить apply', 'run apply') },
      { id: 'check', text: bi('запустить plan ещё раз и увидеть No changes', 'run plan again and see No changes') },
    ],
  },
  {
    id: 'iac.q.refresh-only',
    kind: 'mcq',
    concepts: ['iac.refresh-only', 'iac.drift'],
    prompt: bi('В облаке у ВМ 4 ядра, а в коде записано 2. Вы выполнили `terraform apply -refresh-only`. Что покажет следующий обычный `terraform plan`?', 'The VM has 4 cores in the cloud and 2 in the code. You ran `terraform apply -refresh-only`. What does the next ordinary `terraform plan` show?'),
    options: [
      { id: 'revert', text: bi('~ cores = 4 -> 2, потому что код по-прежнему описывает желаемое состояние', '~ cores = 4 -> 2: the code is still the desired state'), correct: true },
      { id: 'none', text: 'No changes', why: bi('Режим refresh-only обновил state, а не код, и в коде по-прежнему записано 2 ядра.', 'refresh-only updated the state, not the code. The code still says "2".') },
      { id: 'drift', text: bi('Снова «Objects have changed outside of Terraform»', '"Objects have changed outside of Terraform" again'), why: bi('Расхождение облака со state уже записано в state, поэтому refresh его больше не находит.', 'The difference between the cloud and the state is already recorded: refresh no longer finds it.') },
    ],
  },
  {
    id: 'iac.q.exitcodes',
    kind: 'match',
    concepts: ['iac.drift'],
    prompt: bi('Ночная джоба CI запускает `terraform plan -detailed-exitcode`. Что означает каждый код возврата?', 'A nightly CI job runs `terraform plan -detailed-exitcode`. What does each exit code mean?'),
    pairs: [
      { id: 'z', left: '0', right: bi('облако совпадает с кодом', 'the cloud matches the code') },
      { id: 'o', left: '1', right: bi('произошла ошибка, например код не удалось разобрать или API не ответил', 'an error: the code did not parse or the API did not answer') },
      { id: 't', left: '2', right: bi('есть разница, и это повод отправить оповещение о дрейфе', 'there is a diff, a reason for a drift alert') },
    ],
  },
];

// ── lessons ──

export const rolesLesson: Lesson = {
  id: 'iac.roles',
  block: 'iac',
  title: bi('Роли и приоритет переменных', 'Roles and variable precedence'),
  summary: bi('Роль раскладывает плейбук по каталогам так, что его можно подключить в любой сценарий, а лестница приоритетов решает, какое значение переменной получит хост.', 'A role lays a playbook out in directories so it can be plugged into any play, and the precedence ladder decides which value of a variable a host gets.'),
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
        'Плейбук кафе прижился. Через месяц команда платёжного сервиса попросила «такой же nginx», и коллега скопировал файл к себе, поменяв порт. Ещё через месяц в копиях было уже три разных способа перезагружать nginx, а исправление в одной копии не доходило до остальных. Копирование кода оказалось той же ручной настройкой, только на уровень выше. В этом уроке вы разложите плейбук по каталогам роли, которую можно подключать в любой сценарий без копирования, и разберётесь, какое значение получит хост, если переменную задали в нескольких местах.',
        'The café playbook took root. A month later the payments team asked for "the same nginx", and a colleague copied the file over and changed the port. Another month later the copies had three different ways of reloading nginx, and a fix in one copy never reached the others. Copying code turned out to be the same manual setup, just one level up. In this lesson you lay the playbook out in the directories of a role that can be plugged into any play without copying, and work out which value a host gets when a variable is set in several places.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        '[[iac.role|Ролью Ansible]] называют плейбук, разложенный по условленным каталогам так, чтобы его можно было подключить в любой сценарий, не копируя. Роль `webserver` хранится в каталоге `roles/webserver/` рядом с плейбуком, и у каждого её каталога своё назначение:\n\n```text\nroles/webserver/\n  tasks/main.yml      задачи роли\n  handlers/main.yml   обработчики роли\n  templates/          шаблоны Jinja2 для ansible.builtin.template\n  files/              файлы для ansible.builtin.copy\n  defaults/main.yml   значения по умолчанию\n  vars/main.yml       значения, на которые роль полагается\n  meta/main.yml       зависимости от других ролей\n```\n\nПустой каркас роли создаёт команда `ansible-galaxy role init webserver`. Ненужные каталоги можно удалить, потому что Ansible читает только те, что есть. Задачи и обработчики в этих файлах пишутся так же, как в плейбуке, но без обёртки `- hosts:`, то есть обычным списком. Шаблон, на который ссылается задача роли, Ansible ищет сначала в каталоге `templates/` этой роли, поэтому роль можно перенести целиком, вместе со всеми её файлами.\n\nСценарий подключает роль одной строкой:\n\n```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  roles:\n    - webserver\n```\n\nAnsible выполняет сценарий в таком порядке: сначала задачи из `pre_tasks`, затем роли из списка, причём перед каждой ролью выполняются роли, перечисленные в её `meta/main.yml`, а затем задачи `tasks` самого сценария и в конце задачи `post_tasks`. Уведомлённые обработчики, как и прежде, выполняются по одному разу, когда закончится секция, в которой их уведомили: после `pre_tasks`, после ролей и задач и после `post_tasks`. В выводе перед именем задачи из роли стоит имя роли: `TASK [webserver : nginx is installed]`.\n\n### Откуда берётся значение переменной\n\nОдна и та же переменная может быть задана в нескольких местах, и тогда какое значение получит хост, решает [[iac.var-precedence|приоритет переменных]]. Его удобно представлять лестницей: значение с более высокой ступени перекрывает значение с более низкой, и неважно, какой файл Ansible прочитал последним. Для повседневной работы хватает семи ступеней, если считать снизу вверх:\n\n1. `defaults/main.yml` роли;\n2. `group_vars/all`;\n3. `group_vars/<группа>`;\n4. `host_vars/<хост>`;\n5. `vars:` сценария;\n6. `vars/main.yml` роли;\n7. `-e` в командной строке.\n\nИз этой лестницы следует правило для автора роли. Всё, что пользователь роли может захотеть настроить, например порт, корневой каталог сайта или число рабочих процессов nginx, кладут в `defaults`. Это самая слабая ступень, и её перекрывает даже `group_vars/all`. В `vars` роли кладут только то, на что роль опирается сама и что менять не нужно, потому что эта ступень стоит выше инвентаря, и перекрыть её из `group_vars` уже нельзя. Ключ `-e` оставляют для разовых запусков и для CI: значение из командной строки перекрывает всё остальное, но в репозитории не сохраняется.',
        'An [[iac.role|Ansible role]] is a playbook laid out in agreed directories so that it can be plugged into any play without copying. The `webserver` role lives in `roles/webserver/` next to the playbook, and each directory has its own job:\n\n```text\nroles/webserver/\n  tasks/main.yml      the role’s tasks\n  handlers/main.yml   the role’s handlers\n  templates/          Jinja2 templates for ansible.builtin.template\n  files/              files for ansible.builtin.copy\n  defaults/main.yml   default values\n  vars/main.yml       values the role relies on\n  meta/main.yml       dependencies on other roles\n```\n\n`ansible-galaxy role init webserver` creates an empty skeleton; directories you do not need can be removed, Ansible reads only those that exist. Tasks and handlers in these files are written as in a playbook but without the `- hosts:` wrapper, just a list. A template a role task refers to is looked up first in that role’s `templates/`, so a role travels as a whole, with its own files.\n\nA play plugs a role in with one line:\n\n```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  roles:\n    - webserver\n```\n\nThe order of execution is: first `pre_tasks`, then the listed roles (each preceded by the roles named in its `meta/main.yml`), then the play’s `tasks` and finally the `post_tasks`. The notified handlers, as before, run once each when the section that notified them is over: after `pre_tasks`, after the roles and tasks and after `post_tasks`. In the output a role’s tasks carry its name: `TASK [webserver : nginx is installed]`.\n\n### Where a value comes from\n\nOne variable may be set in several places, and then the question "which value does the host get" is decided by [[iac.var-precedence|variable precedence]]. It is a ladder: a value from a higher step overrides a value from a lower one, regardless of which file was read last. Seven steps are enough for everyday work, from the bottom up:\n\n1. the role’s `defaults/main.yml`;\n2. `group_vars/all`;\n3. `group_vars/<group>`;\n4. `host_vars/<host>`;\n5. the play’s `vars:`;\n6. the role’s `vars/main.yml`;\n7. `-e` on the command line.\n\nHence a rule for the role author. Everything the user of the role may want to tune (the port, the site root, the number of workers) goes into `defaults`: it is the weakest step, and even `group_vars/all` overrides it. The role’s `vars` hold only what the role itself relies on and what need not change, because this step stands above the inventory and can no longer be overridden from `group_vars`. And `-e` is kept for one-off runs and CI: a value from the command line always wins and leaves nothing in the repository.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как Ansible выбирает значение переменной', 'How Ansible picks the value of a variable'),
      body: bi(
        'Схема ниже показывает, как Ansible выбирает значение переменной `http_port` для хоста web1, прежде чем роль webserver запишет его в конфигурацию nginx. Слева столбиком стоят семь мест, где можно задать эту переменную: внизу умолчания роли, выше group_vars/all, group_vars/web, host_vars/web1, секция vars: сценария, vars роли и на самом верху ключ -e. В центре стоит программа ansible-playbook, которая проходит эти места снизу вверх и запоминает последнее найденное значение. Когда лестница пройдена, появляются шаблон конфигурации cafe.conf.j2 и сам хост web1, и под именем хоста видно, какой порт он получил.',
        'The diagram below shows how Ansible picks the value of the variable `http_port` for host web1 before the webserver role writes it into the nginx config. On the left, in a column, are the seven places where the variable can be set: the role defaults at the bottom, then group_vars/all, group_vars/web, host_vars/web1, the play’s vars: section, the role vars and, at the very top, the -e key. In the middle is the ansible-playbook program, which walks these places from the bottom up and keeps the last value it found. When the ladder is climbed, the config template cafe.conf.j2 and host web1 itself appear, and under the host’s name you see which port it got.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'iac.var-precedence', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге Ansible поднимается на одну ступень. Если на ней задано значение, ступень загорается зелёным, по линии к ansible-playbook движется карточка с этим значением, и оно заменяет прежнее. Если значения на ступени нет, она остаётся бледной, и значение не меняется.\n\nСначала пройдите лестницу с настройками по умолчанию, где порт задают умолчания роли и group_vars/web. Потом включайте в «Параметрах» другие места по одному, начиная с host_vars/web1, и следите, какой порт получит web1. Затем включите vars роли и попробуйте снова перекрыть порт из инвентаря. Напоследок включите в блоке «Сломать» опечатку в шаблоне.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step Ansible climbs one rung. If the rung sets a value, it lights up green, a card with the value moves along the line to ansible-playbook, and it replaces the previous one. If the rung sets no value, it stays pale and the value does not change.\n\nFirst climb the ladder with the default settings, where the port is set by the role defaults and group_vars/web. Then switch other places on in “Parameters” one at a time, starting with host_vars/web1, and watch which port web1 gets. Then switch on the role vars and try again to override the port from the inventory. Finally, switch on the typo in the template in “Break it”.'), caption: bi('В задании ниже вы окажетесь на месте автора роли: перенесёте задачи в роль webserver, положите порт по умолчанию в её defaults, а порт, который нужен группе web, зададите в инвентаре. Вспомните, на каких ступенях схемы стоят оба этих места, и проверьте результат вторым прогоном.', 'In the task below you are the role author: you move the tasks into the webserver role, put the default port into its defaults, and set the port the web group needs in the inventory. Recall on which rungs of the diagram these two places stand, and check the result with a second run.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ansSetup({ 'inventory.ini': INV, 'site.yml': FLAT_PLAY, 'templates/cafe.conf.j2': ROLE_TEMPLATE }),
      intro: bi('В каталоге `~/ops` лежат плейбук `site.yml` без ролей для группы web и шаблон `templates/cafe.conf.j2`, в котором порт записан переменной `http_port`. Значение этой переменной пока нигде не задано.', '`~/ops` holds a flat playbook `site.yml` for the web group and a template `templates/cafe.conf.j2` where the port is the variable `http_port`. It is not set anywhere yet.'),
      tasks: [
        {
          id: 'skeleton',
          prompt: bi('Создайте каркас роли `webserver` в каталоге `~/ops/roles`.', 'Create the skeleton of the `webserver` role in `~/ops/roles`.'),
          check: { when: `files['${OPS}/roles/webserver/tasks/main.yml'].type=f && files['${OPS}/roles/webserver/defaults/main.yml'].type=f && files['${OPS}/roles/webserver/handlers/main.yml'].type=f` },
          chips: 'cd roles && ansible-galaxy role init webserver',
          concepts: ['iac.role'],
          docRef: { page: 'help/ansible-galaxy' },
          hints: { H1: bi('Команда ansible-galaxy создаёт каркас в текущем каталоге, а каталога roles ещё нет.', 'ansible-galaxy creates the skeleton in the current directory; the roles directory does not exist yet.'), H2: bi('mkdir roles && cd roles && ansible-galaxy role init webserver', 'mkdir roles && cd roles && ansible-galaxy role init webserver') },
        },
        {
          id: 'move',
          prompt: bi('Перенесите в роль задачи, обработчик и шаблон, а строку `http_port: 80` положите в её defaults. В `site.yml` оставьте сценарий для группы web, который только подключает роль, и прогоните его.', 'Move the tasks, the handler and the template into the role, and put `http_port: 80` into its defaults. Leave in `site.yml` a play for the web group that only plugs the role in, and run it.'),
          check: {
            when: (f) => {
              const play = fileText(f, `${OPS}/site.yml`);
              const r = lastRun(f);
              return /roles:\s*\n\s*-\s*(role:\s*)?webserver/.test(play) && !/^\s*tasks:/m.test(play) && /http_port:\s*80\b/.test(fileText(f, `${OPS}/roles/webserver/defaults/main.yml`)) && !!r && r.tasks.some((t) => t.role === 'webserver' && t.task === 'The site config is in place') && Object.values(r.recap).every((x) => x.failed === 0) && listens(f, 'web1', 80) && listens(f, 'web2', 80);
            },
            fail: [
              { if: (f) => /could not find or access/i.test((f.term.main ?? []).at(-1)?.out ?? ''), say: bi('Задача роли ищет шаблон в roles/webserver/templates/. Перенесите туда cafe.conf.j2.', 'A role task looks for the template in roles/webserver/templates/. Move cafe.conf.j2 there.') },
              { if: (f) => /http_port' is undefined/.test((f.term.main ?? []).at(-1)?.out ?? ''), say: bi('Шаблону нужна переменная http_port, а она нигде не задана. Значение по умолчанию для роли кладут в defaults/main.yml.', 'The template needs http_port and it is nowhere. The role default goes into defaults/main.yml.') },
            ],
          },
          chips: 'ansible-playbook site.yml',
          concepts: ['iac.role'],
          docRef: { page: 'web/docs.ansible.com/roles', anchor: 'structure' },
          hints: {
            H1: bi('Файлы tasks/main.yml и handlers/main.yml содержат обычные списки задач, без hosts: и tasks:.', 'tasks/main.yml and handlers/main.yml are plain lists of tasks, without hosts: and tasks:.'),
            H2: bi('```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  roles:\n    - webserver\n```', '```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  roles:\n    - webserver\n```'),
          },
        },
        {
          id: 'override',
          prompt: bi('Группе web нужен порт 8080, а роль трогать нельзя, потому что ею пользуются и другие команды. Задайте порт в переменных группы web, то есть в файле `group_vars/web.yml` рядом с `inventory.ini`: Ansible считает каталог `group_vars` частью инвентаря. Затем прогоните плейбук и убедитесь, что повторный прогон ничего не меняет.', 'The web group needs port 8080, and the role must not be touched: other teams use it too. Set the port in the variables of the web group, in the file `group_vars/web.yml` next to `inventory.ini`: Ansible treats the `group_vars` directory as part of the inventory. Then run the playbook and check that a repeated run changes nothing.'),
          check: {
            when: (f) => {
              const r = lastRun(f);
              const prev = runs(f).at(-2);
              return listens(f, 'web1', 8080) && listens(f, 'web2', 8080) && /http_port:\s*80\b/.test(fileText(f, `${OPS}/roles/webserver/defaults/main.yml`)) && !!r && !!prev && r.tasks.some((t) => t.role === 'webserver') && Object.values(r.recap).every((x) => x.changed === 0 && x.failed === 0);
            },
            fail: [{ if: (f) => !/http_port:\s*80\b/.test(fileText(f, `${OPS}/roles/webserver/defaults/main.yml`)), say: bi('Вы поменяли умолчание роли, а роль общая, поэтому порт 8080 достанется и другим командам. Задайте порт для группы web в инвентаре.', 'The role default changed, and the role is shared: other teams get 8080 too. Override the port for the web group in the inventory.') }],
          },
          chips: 'mkdir group_vars',
          concepts: ['iac.var-precedence', 'iac.idempotence'],
          hints: { H1: bi('Создайте каталог командой `mkdir group_vars`, откройте файл командой `edit group_vars/web.yml` и запишите в него одну строку `http_port: 8080`.', 'Create the directory with `mkdir group_vars`, open the file with `edit group_vars/web.yml` and write one line into it, `http_port: 8080`.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('На странице Roles найдите раздел, где сказано, в каком порядке выполняются pre_tasks, роли и tasks сценария.', 'On the Roles page find the section that says in which order pre_tasks, roles and the play’s tasks run.'),
      ref: { page: 'web/docs.ansible.com/roles' },
      answer: 'using',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Создайте каркас роли `monitoring` сразу в `~/ops/roles`, не выходя из каталога `~/ops`. В уроке такого способа не было, поэтому найдите в `ansible-galaxy --help` ключ, который задаёт каталог для каркаса.', 'Create the skeleton of the `monitoring` role right in `~/ops/roles` without leaving `~/ops`. The lesson did not show how: find in `ansible-galaxy --help` the key that sets the directory for the skeleton.'),
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
  title: bi('Переменные, модули и перенос ресурса без пересоздания', 'Variables, modules and moving a resource without recreating it'),
  summary: bi('Модуль Terraform описывает типовую часть инфраструктуры один раз, а блок moved переносит уже созданный ресурс в модуль, не трогая облако.', 'A Terraform module describes a typical piece of infrastructure once; a moved block carries an already created resource into a module without touching the cloud.'),
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
        'В файле `main.tf` кафе уже три почти одинаковые ВМ: web, api и worker. Они отличаются только именем и числом ядер, а образ, сеть и зона повторены трижды. Когда понадобится сменить образ, его придётся поправить в трёх местах, и в одном из них обязательно забудут. В этом уроке вы опишете такую машину один раз, в модуле, и переведёте на него работающую ВМ так, чтобы её не пришлось пересоздавать.',
        'The café’s `main.tf` already has three nearly identical VMs: web, api and worker. They differ only in name and number of cores, while the image, network and zone are repeated three times. When the image has to change, it will have to be fixed in three places, and one of them will surely be forgotten. In this lesson you describe such a machine once, in a module, and move the running VM onto it without recreating it.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Повторяющуюся часть кода описывают один раз, а различия передают ей снаружи. Для различий служат [[iac.tf-variable|входные переменные]]: блок `variable` объявляет имя, тип и, если нужно, значение по умолчанию, а в коде значение переменной читают как `var.cores`.\n\n```hcl\nvariable "cores" {\n  type    = number\n  default = 2\n}\n```\n\nПеременная без `default` обязательна. Для корневого модуля, то есть того каталога, где вы запускаете Terraform, её задают ключом `-var`, файлом `terraform.tfvars` или переменной окружения `TF_VAR_cores`. Terraform проверяет тип значения и правила `validation` ещё до плана.\n\n### Модуль\n\n[[iac.tf-module|Модулем Terraform]] называют каталог с файлами `.tf`, в которых описаны его переменные, ресурсы и выводы. Код, который вы писали до сих пор, тоже модуль, и называется он корневым. Другой каталог подключают блоком `module`:\n\n```hcl\nmodule "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n```\n\nАргумент `source`, который начинается с `./`, указывает путь к локальному модулю, а остальные аргументы становятся значениями его переменных. После того как вы добавили вызов модуля, нужно снова выполнить `terraform init`, который подключает модуль в каталоге `.terraform/modules`. Ресурсы модуля получают адрес, в котором есть имя вызова: блок `resource "edu_vm" "this"` внутри модуля, вызванного как `web`, получает адрес `module.web.edu_vm.this`. Поэтому один модуль можно вызвать несколько раз, и адреса его ресурсов не совпадут.\n\nРесурсы модуля закрыты от вызывающего кода. То, что модуль готов показать наружу, он объявляет выводом, например `output "ip" { value = edu_vm.this.public_ip }`, а корневой модуль читает это значение как `module.web.ip`. Модуль похож на бланк заявления: переменные служат полями, которые заполняет вызывающий код, вывод служит готовой справкой, а как её оформляют внутри, снаружи не видно. Программисты описывают то же самое иначе и сравнивают модуль с функцией, у которой переменные служат параметрами, а выводы служат результатом.\n\n### Как перенести ресурс в модуль без пересоздания\n\nВМ web уже работает под адресом `edu_vm.web`. Если перенести её описание в модуль и больше ничего не делать, Terraform увидит в коде новый адрес `module.web.edu_vm.this`, а в state старый, которого в коде больше нет. План получится логичным, но неприятным, потому что Terraform предложит удалить работающую ВМ и создать такую же. Terraform сопоставляет код и state только по адресу, и одинаковые атрибуты для него ничего не значат.\n\nЧтобы сообщить Terraform, что это тот же объект, у которого сменился только адрес, в код добавляют [[iac.moved|блок moved]]:\n\n```hcl\nmoved {\n  from = edu_vm.web\n  to   = module.web.edu_vm.this\n}\n```\n\nПеред планом Terraform переименует запись в state, и план покажет `# edu_vm.web has moved to module.web.edu_vm.this`, ничего не создавая и не удаляя. Коллеги проверяют блок moved вместе с остальными изменениями кода. Он срабатывает в каждом окружении, где применяют этот код, поэтому удалять его стоит не раньше, чем код применят во всех окружениях.',
        'A repeated piece is described once and given the differences. The differences are [[iac.tf-variable|input variables]]: a `variable` block declares a name, a type and, if needed, a default, and inside the code the value is read as `var.cores`.\n\n```hcl\nvariable "cores" {\n  type    = number\n  default = 2\n}\n```\n\nA variable without `default` is required. For the root of a configuration it is set with the `-var` key, a `terraform.tfvars` file or the `TF_VAR_cores` environment variable; Terraform checks the type and the `validation` rules before any plan.\n\n### A module\n\nA [[iac.tf-module|Terraform module]] is just a directory of `.tf` files with its own variables, resources and outputs. The code you have written so far is a module too, the root one. Another directory is plugged in with a `module` block:\n\n```hcl\nmodule "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n```\n\nA `source` starting with `./` is a path to a local module; the other arguments become its variables. After adding a call you need `terraform init`: it "installs" the module into `.terraform/modules`. Module resources get an address with the call name: `resource "edu_vm" "this"` inside a module called as `web` is named `module.web.edu_vm.this`. So one module can be called several times without the addresses clashing.\n\nModule resources are hidden from the calling code. What a module is willing to show, it declares as an output, `output "ip" { value = edu_vm.this.public_ip }`, and the root reads it as `module.web.ip`. A module is like an application form: the variables are the fields the calling code fills in, the output is the finished certificate, and how it is prepared inside is not visible from outside. Programmers describe the same thing differently and compare a module to a function whose variables are parameters and whose outputs are the result.\n\n### Moving without recreation\n\nThe web VM is already running at the address `edu_vm.web`. If you simply move its description into a module, Terraform sees a new address `module.web.edu_vm.this` in the code and the old one in the state, which is no longer in the code. The plan is honest and unpleasant: destroy the running VM and create an identical one. Terraform matches the code and the state only by address; identical attributes mean nothing to it.\n\nTo say "this is the same object, it just has a new address", you add a [[iac.moved|moved block]] to the code:\n\n```hcl\nmoved {\n  from = edu_vm.web\n  to   = module.web.edu_vm.this\n}\n```\n\nBefore the plan Terraform renames the state entry, and the plan shows `# edu_vm.web has moved to module.web.edu_vm.this` without a single creation or destruction. The moved block goes through review together with the refactoring and takes effect in every environment where this code is applied; remove it no earlier than it has been applied everywhere.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Что видит план после переноса ресурса в модуль', 'What the plan sees after a resource moves into a module'),
      body: bi(
        'Схема ниже показывает, что делает terraform plan после того, как описание машины сайта перенесли в модуль web. Сначала на ней только код и terraform plan. Слева под кодом появится блок moved, если он есть в коде, в центре файл state, справа работающая машина vm-4f66, а внизу справа новая машина, которую план создаст, если не узнает старую. На каждом шаге видно, какой адрес plan ищет в state и что находит, а под схемой видно, сколько машин он создаст и удалит и сколько секунд сайт останется без сервера.',
        'The diagram below shows what terraform plan does after the description of the site’s machine was moved into the web module. At first it shows only the code and terraform plan. Under the code on the left the moved block appears if the code has one, in the middle the state file, on the right the running machine vm-4f66, and at the bottom right the new machine the plan creates if it does not recognise the old one. At every step you see which address plan looks up in the state and what it finds, and under the diagram how many machines it creates and destroys and how many seconds the site stays without a server.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'iac.address', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен участник, который работает сейчас, облачко рядом с ним говорит, что он делает, а по линии движется карточка с адресом или записью из state. Зелёная рамка означает, что машина остаётся прежней, жёлтая означает лишнюю машину, которую создаст план, а красная означает машину, которую план удалит, или ошибку, на которой план остановился.\n\nСначала пройдите план без блока moved и посмотрите, сколько секунд сайт останется без сервера. Потом включите в «Параметрах» блок moved и сравните планы. Напоследок включите в блоке «Сломать» поломки по одной: удаление файла state и старый блок resource, который забыли убрать из кода.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The participant working now is highlighted, the callout next to it says what it does, and a card with an address or a state entry moves along the line. A green outline means the machine stays the same, a yellow one marks an extra machine the plan will create, and a red one marks a machine the plan will destroy or an error at which the plan stopped.\n\nFirst walk the plan without the moved block and see how many seconds the site stays without a server. Then switch the moved block on in “Parameters” and compare the plans. Finally, switch on the breaks in “Break it” one at a time: the deleted state file and the old resource block left in the code.'), caption: bi('В задании ниже вы сделаете то же самое с настоящим кодом: сначала напишете модуль и создадите через него новую ВМ api, а потом переведёте на него работающую ВМ web. Прежде чем применять изменения, посмотрите на план без блока moved и убедитесь, что он предлагает то же пересоздание, что и схема.', 'In the task below you do the same with real code: first you write the module and create a new VM api with it, then you move the running VM web onto it. Before applying, look at the plan without the moved block and make sure it proposes the same recreation as the diagram.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: tfSetup(TF_HEAD + TF_NET + TF_VM + TF_DNS, APPLIED),
      intro: bi('Сеть, ВМ web и DNS-запись www уже созданы этим кодом, а модулей в нём пока нет.', 'The network, the web VM and the www DNS record were already created by this code. There are no modules yet.'),
      tasks: [
        {
          id: 'module',
          prompt: bi('Напишите модуль `./modules/vm` с переменными `name`, `network_id` и `cores` (у переменной `cores` значение по умолчанию 2), с ресурсом `edu_vm` `this` на образе ubuntu-24.04 и с выводом `ip`. Затем вызовите его как `module "api"` для ВМ с именем api и примените изменения.', 'Write a module `./modules/vm` with the variables `name`, `network_id` and `cores`, the last with a default of 2, an `edu_vm` resource `this` with the ubuntu-24.04 image and an output `ip`. Then call it as `module "api"` for a VM named api and apply the changes.'),
          check: {
            when: (f, start) => !!vmByName(f, 'api') && !!stateAddr(f, 'module.api.edu_vm.this') && vmByName(f, 'web')?.id === vmByName(start, 'web')?.id && Object.keys(f.files).some((p) => p.startsWith(`${INFRA}/modules/vm/`) && p.endsWith('.tf')),
            fail: [{ if: (f) => /Module not installed/.test((f.term.main ?? []).at(-1)?.out ?? ''), say: bi('Новый вызов модуля нужно подключить командой terraform init.', 'A new module call must be installed: terraform init.') }],
          },
          chips: 'mkdir -p modules/vm',
          concepts: ['iac.tf-module', 'iac.tf-variable'],
          docRef: { page: 'web/opentofu.org/language/modules', anchor: 'calling' },
          hints: {
            H1: bi('Модуль Terraform хранится в отдельном каталоге с файлом `main.tf`: создайте каталог командой `mkdir -p modules/vm` и откройте файл командой `edit modules/vm/main.tf`. В корневом модуле добавьте блок `module "api" { source = "./modules/vm" … }`, а потом выполните init и apply.', 'A module is a directory with `main.tf`: create it with `mkdir -p modules/vm` and open the file with `edit modules/vm/main.tf`. In the root module add a block `module "api" { source = "./modules/vm" … }`, then run init and apply.'),
            H2: bi('```hcl\nmodule "api" {\n  source     = "./modules/vm"\n  name       = "api"\n  network_id = edu_network.main.id\n}\n```', '```hcl\nmodule "api" {\n  source     = "./modules/vm"\n  name       = "api"\n  network_id = edu_network.main.id\n}\n```'),
          },
        },
        {
          id: 'move',
          prompt: bi('Переведите на этот модуль и ВМ web: опишите её блоком `module "web"` вместо `edu_vm.web`, а DNS-запись направьте на вывод этого модуля. Работающая ВМ web при этом пересоздаваться не должна.', 'Move web onto this module too: `module "web"` instead of `edu_vm.web`, with the DNS record pointing at its output. The running web VM must not be recreated.'),
          check: {
            when: (f, start) => {
              const was = vmByName(start, 'web');
              const now = stateAddr(f, 'module.web.edu_vm.this');
              const rec = (tfOf(f)?.cloud ?? []).find((r) => r.type === 'edu_dns_record' && r.attrs.name === 'www');
              return !!was && now?.id === was.id && !stateAddr(f, 'edu_vm.web') && !!rec && rec.attrs.value === now.attrs.public_ip && /module\.web\.ip/.test(fileText(f, `${INFRA}/main.tf`));
            },
            fail: [{ if: (f) => !!lastPlan(f)?.applied && (tfOf(f)?.cloud ?? []).some((r) => r.type === 'edu_vm' && r.attrs.name === 'web') && !(tfOf(f)?.cloud ?? []).some((r) => r.id === eduId('vm', 2)), say: bi('ВМ web пересоздана, и у неё теперь новый ID. Terraform узнаёт объект только по адресу, поэтому здесь нужен блок moved.', 'The web VM was recreated: it has a new ID. Terraform recognises an object only by address, so you need a moved block.') }],
          },
          chips: 'terraform plan',
          concepts: ['iac.moved'],
          docRef: { page: 'web/opentofu.org/language/moved', anchor: 'moved' },
          hints: { H1: bi('Сначала посмотрите plan без блока moved, и он предложит удалить машину и создать её заново. Затем добавьте блок moved { from, to }.', 'First look at the plan without moved: it proposes to destroy and create. Then add moved { from, to }.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('На странице Modules найдите раздел, где сказано, как корневой модуль читает значение, которое вызванный модуль объявил выводом.', 'On the Modules page find the section that says how the root module reads a value the called module declared as an output.'),
      ref: { page: 'web/opentofu.org/language/modules' },
      answer: 'outputs',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Переименуйте `edu_dns_record.www` в `edu_dns_record.site` и в коде, и в state, но без блока moved и без пересоздания записи. Нужная подкоманда описана в `terraform state -help`.', 'Rename `edu_dns_record.www` to `edu_dns_record.site`, both in the code and in the state, without a moved block and without recreating the record. The subcommand you need is in `terraform state -help`.'),
      ref: { page: 'help/terraform' },
      terminal: {
        setup: tfSetup(TF_HEAD + TF_NET + TF_VM + TF_DNS, APPLIED),
        task: {
          id: 'state-mv',
          prompt: bi('В state есть запись edu_dns_record.site с прежним ID, и plan не предлагает изменений.', 'The state has edu_dns_record.site with the old ID, the plan is empty.'),
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
  title: bi('Что делать с объектами и правками, которые сделали в обход кода', 'What to do with objects and edits made bypassing the code'),
  summary: bi('Объект, созданный вручную, берут под управление, а не пересоздают. Изменение, сделанное в обход кода, записывают в state или отменяют, и узнают о нём из CI раньше, чем от клиента.', 'An object made by hand is taken over, not recreated; a change behind the code is recorded in the state or undone, and you learn about it from CI, not from a customer.'),
  introduces: ['iac.import', 'iac.refresh-only'],
  uses: ['iac.state', 'iac.drift', 'iac.plan', 'iac.moved', 'cicd.job'],
  tier: 'core',
  minutes: 35,
  sources: src([W.importBlock, W.planCmd, S.tfDrift], [W.ruYcImport, S.ruTerraform]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Ночью сайт не справлялся с нагрузкой, и дежурный сделал то, что было быстрее всего: создал в консоли облака ещё одну ВМ, а старой увеличил число ядер. Сайт выдержал нагрузку. Утром в облаке работают машина, о которой Terraform ничего не знает, и машина, которая уже не совпадает с кодом. Удалять их нельзя, потому что на них идут запросы пользователей. В этом уроке вы возьмёте обе машины под управление кода, ничего не пересоздавая, и настроите проверку, которая сама сообщит о следующей такой правке.',
        'At night the site could not cope with the load, and the on-call engineer did what was fastest: created one more VM in the cloud console and raised the cores of the old one. The site held up. In the morning the cloud runs a machine Terraform knows nothing about and a machine that no longer matches the code. Neither can be deleted, because users’ requests go to them. In this lesson you take both machines under the code’s management without recreating anything, and set up a check that reports the next such edit by itself.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Для Terraform существует только то, что записано в state. ВМ, созданную в консоли, он не видит, и если описать её в коде и запустить apply, он создаст вторую такую же. Правильнее выполнить [[iac.import|импорт ресурса]], то есть привязать существующий объект к адресу в коде, ничего не создавая.\n\nСначала вы описываете объект блоком `resource` таким, каким он выглядит в облаке на самом деле. Затем рядом пишете, какой объект облака привязать к этому адресу:\n\n```hcl\nimport {\n  to = edu_vm.legacy\n  id = "vm-4f91"\n}\n```\n\nПлан покажет `# edu_vm.legacy will be imported` и итог `Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.` Если вместе с импортом план хочет ещё и изменить ресурс, значит, код описывает его не таким, какой он есть. Правьте код, пока импорт не останется единственным действием, и только потом применяйте. После apply объект записан в state, следующий plan не предлагает изменений, а блок import можно убрать. У той же операции есть и старая форма, команда `terraform import ADDR ID`, но она меняет state сразу, без плана и без проверки коллегами.\n\n### Изменение в обход кода\n\nС машиной, которой увеличили число ядер, вы уже встречались в уроке о state: это [[iac.drift|дрейф]], и обычный plan предложит вернуть машину к коду. Иногда так и нужно. Но бывает, что изменение правильное, и вы хотите сначала записать в state то, что есть на самом деле, а код поправить отдельным изменением, которое коллеги проверят. Для этого служит [[iac.refresh-only|режим refresh-only]]. Команда `terraform plan -refresh-only` показывает, что изменилось в обход Terraform, и не предлагает ничего отменять, а команда `terraform apply -refresh-only` записывает эти значения в state, не трогая облако. Учтите, что код при этом не меняется: пока в коде записано два ядра, следующий обычный plan снова захочет вернуть машине два ядра.\n\n### Как узнать о дрейфе раньше всех\n\nДрейф не исчезает сам и обнаруживается только при следующем plan. Если plan запускают раз в месяц, о ручной правке узнают через месяц, и обычно в самый неудобный момент. Поэтому в CI настраивают расписание, по которому plan запускается каждую ночь или каждый час, а [[cicd.job|джоба]], то есть задание пайплайна, с которым вы встречались в блоке CI/CD, завершается с ошибкой, если разница есть. Для этого plan должен сообщать о разнице кодом возврата, а не только текстом для человека.',
        'For Terraform only what is written in the state exists. A VM created in the console is invisible to it: if you describe it in the code and run apply, it honestly creates a second identical one. The right way is a [[iac.import|resource import]]: attach the existing object to an address in the code, creating nothing.\n\nFirst you describe the object with a `resource` block, as it really looks in the cloud. Then, next to it, you write which cloud object to attach to that address:\n\n```hcl\nimport {\n  to = edu_vm.legacy\n  id = "vm-4f91"\n}\n```\n\nThe plan shows `# edu_vm.legacy will be imported` and the total `Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.` If together with the import the plan also wants to change the resource, the code describes it differently from how it is: fix the code until the import is the only action, and only then apply. After apply the object is in the state, the next plan is empty, and the import block may be removed. There is also an older form of the same operation, the command `terraform import ADDR ID`, but it changes the state at once, with no plan and no review.\n\n### A change behind the code\n\nYou have already met the machine whose cores were raised: that is drift, and an ordinary plan proposes to bring it back to the code. Sometimes that is exactly what you want. But sometimes the change is right, and you want to record reality first and fix the code in a separate review. That is what [[iac.refresh-only|refresh-only mode]] is for: `terraform plan -refresh-only` shows what changed behind Terraform’s back and proposes to undo nothing, and `terraform apply -refresh-only` writes those values into the state without touching the cloud. Note that it does not change the code: while the code says two cores, the next ordinary plan again wants to bring back two.\n\n### Learning about drift first\n\nDrift does not go away by itself: it waits for the next plan. If plan runs once a month, a manual edit is discovered a month later, usually at the worst moment. So CI gets a schedule: plan every night or every hour, and the job fails if there is a difference. All that remains is to make plan report the difference with an exit code rather than with text for a human.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Что видит план, когда в облаке есть ручная машина', 'What the plan sees when the cloud has a hand-made machine'),
      body: bi(
        'Схема ниже показывает, что делает terraform plan, когда в коде описана машина vm-4f91, созданная ночью в консоли облака. Сначала на ней только код и terraform plan. Слева под кодом появится блок import, если он есть в коде, в центре файл state, справа вверху сама ручная машина, а внизу справа вторая машина, которую план создаст, если не узнает первую. Под схемой видно, сколько машин план создаст и сколько возьмёт под управление.',
        'The diagram below shows what terraform plan does when the code describes the machine vm-4f91, created in the cloud console at night. At first it shows only the code and terraform plan. Under the code on the left the import block appears if the code has one, in the middle the state file, at the top right the hand-made machine itself, and at the bottom right a second machine the plan creates if it does not recognise the first. Under the diagram you see how many machines the plan creates and how many it takes over.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'iac.import-plan', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен участник, который работает сейчас, облачко рядом с ним говорит, что он делает, а по линии движется карточка с адресом или записью из state. Пунктирная линия от state к ручной машине означает, что записи о ней в state пока нет. Зелёная рамка означает, что машину Terraform узнал, жёлтая означает лишнюю машину, которую создаст план, а красная означает ошибку, на которой план остановился.\n\nСначала пройдите план без блока import, потом включите блок в «Параметрах» и сравните итог. Напоследок включите в блоке «Сломать» ошибку в ID машины и посмотрите, с каким сообщением Terraform останавливается.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The participant working now is highlighted, the callout next to it says what it does, and a card with an address or a state entry moves along the line. The dashed line from the state to the hand-made machine means the state has no entry for it yet. A green outline means Terraform recognised the machine, a yellow one marks an extra machine the plan will create, and a red one marks an error at which the plan stopped.\n\nFirst walk the plan without the import block, then switch the block on in “Parameters” and compare the totals. Finally, switch on the wrong machine ID in “Break it” and see which message Terraform stops with.'), caption: bi('В первом задании ниже вы возьмёте под управление настоящую ручную машину. Её ID и атрибуты покажет консоль облака, а план перед apply должен выглядеть так же, как на схеме с включённым блоком import: одна машина берётся под управление, и ни одной не создаётся.', 'In the first task below you take over a real hand-made machine. The cloud console shows its ID and attributes, and the plan before apply must look like the diagram with the import block on: one machine is taken over and none is created.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: IMPORT_SETUP,
      intro: bi('Код описывает сеть и ВМ web. В облаке есть ещё одна ВМ, которую ночью создали вручную, и её можно увидеть командой `edu vm list`.', 'The code describes the network and the web VM. The cloud has one more VM, made by hand at night; look at `edu vm list`.'),
      tasks: [
        {
          id: 'adopt',
          prompt: bi('Возьмите ручную ВМ под управление Terraform как `edu_vm.legacy`, не создавая новых машин. В конце `terraform plan` должен показать `No changes`.', 'Take the hand-made VM under Terraform’s management as `edu_vm.legacy` without creating new machines. At the end `terraform plan` must show `No changes`.'),
          check: {
            when: (f, start) => {
              const legacy = vmByName(start, 'legacy');
              return !!legacy && stateAddr(f, 'edu_vm.legacy')?.id === legacy.id && (tfOf(f)?.cloud ?? []).filter((r) => r.type === 'edu_vm').length === 2 && emptyPlan(f) && !lastPlan(f)?.applied;
            },
            fail: [{ if: (f) => (tfOf(f)?.cloud ?? []).filter((r) => r.type === 'edu_vm').length > 2, say: bi('В облаке стало три ВМ, потому что apply создал новую машину вместо того, чтобы взять существующую. Удалите лишнюю машину через код и используйте import.', 'The cloud now has three VMs: apply created a new one instead of taking the existing one. Remove the extra one through the code and use import.') }],
          },
          chips: 'edu vm list',
          concepts: ['iac.import'],
          docRef: { page: 'web/opentofu.org/language/import', anchor: 'block' },
          hints: {
            H1: bi('Атрибуты ВМ покажет команда edu vm get <ID>, и блок resource должен им соответствовать.', 'edu vm get <ID> shows the VM attributes; the resource block must match them.'),
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
      intro: bi('Ночью дежурный увеличил число ядер ВМ web до 4. Команда согласна с этой правкой, но код поправит отдельным изменением, которое пройдёт проверку коллег.', 'At night the on-call engineer raised the web VM to 4 cores. The team agrees with the change but will fix the code in a separate review.'),
      tasks: [
        {
          id: 'record',
          prompt: bi('Запишите в state, что у web теперь 4 ядра, не меняя ни облако, ни код.', 'Record in the state that web now has 4 cores, without changing the cloud or the code.'),
          check: {
            when: (f) => stateAddr(f, 'edu_vm.web')?.attrs.cores === 4 && vmByName(f, 'web')?.attrs.cores === 4 && /cores\s*=\s*2/.test(fileText(f, `${INFRA}/main.tf`)) && lastPlan(f)?.kind === 'refresh-only' && !!lastPlan(f)?.applied,
            fail: [{ if: (f) => vmByName(f, 'web')?.attrs.cores === 2, say: bi('Обычный apply вернул облако к коду, а вам нужен режим, который только обновляет state.', 'An ordinary apply brought the cloud back to the code. You need the mode that only updates the state.') }],
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
      prompt: bi('Ночная джоба CI должна завершаться с ошибкой, если облако разошлось с кодом. Обычный `terraform plan` завершается кодом 0 даже тогда, когда разница есть. Найдите в `terraform plan -help` ключ, который меняет смысл кода возврата, и выполните plan так, чтобы он сообщил о дрейфе кодом возврата.', 'A nightly CI job must fail if the cloud has diverged from the code. An ordinary `terraform plan` exits with 0 even when there is a difference. Find in `terraform plan -help` the key that changes the meaning of the exit code, and run plan so that it reports the drift with its code.'),
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
  story: bi('Вы вторую неделю работаете в команде кафе. Руководитель команды оставил четыре карточки с задачами: сайт должен слушать порт из инвентаря, для API нужна новая ВМ, ручную DNS-запись после ночного инцидента нужно взять под управление, а старую ВМ передают другой команде.', 'You are in your second week with the café team. The team lead left four task cards: the site must listen on the port from the inventory, the API needs a new VM, the hand-made DNS record from a night incident must be taken under management, and an old VM is handed over to another team.'),
  intro: bi('Экзамен состоит из четырёх задач на двух машинах и вопроса о переменных. Открыта только встроенная документация: `--help`, `ansible-doc` и страницы Ansible и OpenTofu в справочнике. Подсказок и наставника на экзамене нет.', 'Four tasks on two machines and a question about variables. Only the built-in documentation is open: `--help`, `ansible-doc` and the Ansible and OpenTofu pages of the reference; no hints and no mentor.'),
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
        prompt: bi('«Сайт на web1 и web2 должен слушать порт из group_vars/web.yml, то есть 8081, а повторный прогон не должен ничего менять». Роль webserver общая, поэтому порт в ней должен остаться настраиваемым, и задачи роли должны описывать состояние, а не действия.', '“The site on web1 and web2 must listen on the port from group_vars/web.yml (8081), and a repeated run must change nothing.” The webserver role is shared, so its port must stay configurable, and its tasks must describe a state rather than actions.'),
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
        prompt: bi('«Нужна ВМ api с 4 ядрами из того же модуля и DNS-запись api.site.edu, которая указывает на её адрес». ВМ web трогать нельзя.', '“We need an api VM with 4 cores from the same module and a DNS record api.site.edu pointing at its address.” The web VM must not be touched.'),
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
        prompt: bi('«Ночью дежурный создал в консоли запись shop.site.edu. Пусть ею управляет Terraform, но саму запись пересоздавать нельзя». В конце plan не должен предлагать изменений.', '“At night the on-call engineer created the record shop.site.edu in the console. Let Terraform manage it, without recreating the record.” The final plan is empty.'),
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
        prompt: bi('«ВМ web передают другой команде, у которой свой код Terraform. Уберите её из нашего управления так, чтобы она продолжила работать в облаке». В конце plan не должен предлагать изменений. В уроках этого не было, поэтому ищите ответ в документации.', '“The web VM is handed over to another team with its own Terraform. Remove it from our management so that it keeps running in the cloud.” The final plan is empty. The lessons did not cover this: look it up in the documentation.'),
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
    { id: 'idem', prompt: bi('Руководитель команды спрашивает: «Почему второй прогон плейбука ничего не меняет и зачем нам это нужно?»', 'The team lead asks: “Why does the second playbook run change nothing, and why do we need that?”'), keyPoints: [bi('в плейбуке описано желаемое состояние, а не шаги', 'the playbook describes the desired state, not steps'), bi('модуль сначала смотрит, как есть, и меняет только разницу', 'a module first looks at how things are and changes only the difference'), bi('changed=0 на втором прогоне служит проверкой плейбука', 'changed=0 on the second run is the test of a playbook')] },
    { id: 'address', prompt: bi('«Мы переложили код ВМ в модуль. Почему Terraform хотел её пересоздать и как вы это предотвратили?»', '“We moved the VM code into a module. Why did Terraform want to recreate it, and how did you prevent that?”'), keyPoints: [bi('Terraform сопоставляет код и state по адресу', 'Terraform matches the code and the state by address'), bi('новый адрес означает новый ресурс, а старый адрес Terraform собирается удалить', 'a new address is a new resource, the old one goes to destruction'), bi('блок moved переименовывает запись state без изменений в облаке', 'a moved block renames the state entry with no changes in the cloud')] },
  ],
};
