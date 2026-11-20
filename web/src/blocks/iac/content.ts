// Block "IaC: Ansible and Terraform" (route id iac, 06 §4–5).
// Order of ideas: infrastructure as code → idempotence → inventory → module →
// playbook → handler → check mode → cloud resource and provider → plan/apply →
// state → drift.

import { bi } from '../../core/i18n';
import type { Block, Concept, Facts, Lesson, QuizItem, Sources, TerminalSetup } from '../../core/types';
import { hostFact, lastRun, runs } from './ans/command';
import { tfDir, type TfFacts } from './tf/edu';
import type { HostSpec } from './ans/hosts';

export const S = {
  ansIntro: { title: 'Ansible Community Documentation — Getting started with Ansible', url: 'https://docs.ansible.com/ansible/latest/getting_started/index.html' },
  ansInv: { title: 'Ansible — How to build your inventory', url: 'https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html' },
  ansPlay: { title: 'Ansible — Ansible playbooks', url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html' },
  ansHandlers: { title: 'Ansible — Handlers: running operations on change', url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html' },
  ansCheck: { title: 'Ansible — Validating tasks: check mode and diff mode', url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html' },
  fowlerIac: { title: 'Martin Fowler — InfrastructureAsCode', url: 'https://martinfowler.com/bliki/InfrastructureAsCode.html' },
  tofuIntro: { title: 'OpenTofu — The OpenTofu language: resources', url: 'https://opentofu.org/docs/language/resources/' },
  tofuState: { title: 'OpenTofu — State', url: 'https://opentofu.org/docs/language/state/' },
  tofuPlan: { title: 'OpenTofu — Command: plan', url: 'https://opentofu.org/docs/cli/commands/plan/' },
  tfDrift: { title: 'HashiCorp — Manage resource drift', url: 'https://developer.hashicorp.com/terraform/tutorials/state/resource-drift' },
  ruIac: { title: 'Инфраструктура как код — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%98%D0%BD%D1%84%D1%80%D0%B0%D1%81%D1%82%D1%80%D1%83%D0%BA%D1%82%D1%83%D1%80%D0%B0_%D0%BA%D0%B0%D0%BA_%D0%BA%D0%BE%D0%B4' },
  ruAnsible: { title: 'Ansible — Википедия', url: 'https://ru.wikipedia.org/wiki/Ansible' },
  ruTerraform: { title: 'Terraform — Википедия', url: 'https://ru.wikipedia.org/wiki/Terraform' },
  ruIdem: { title: 'Идемпотентность — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%98%D0%B4%D0%B5%D0%BC%D0%BF%D0%BE%D1%82%D0%B5%D0%BD%D1%82%D0%BD%D0%BE%D1%81%D1%82%D1%8C' },
  ruHabrAnsible: { title: 'Хабр — Ansible: введение для начинающих', url: 'https://habr.com/ru/articles/508762/' },
};
export const src = (en: { title: string; url: string }[], ru: { title: string; url: string }[]): Sources => ({ en, ru });

export const concepts: Concept[] = [
  { id: 'iac.iac', term: bi('инфраструктура как код', 'infrastructure as code'), forms: { ru: ['инфраструктуры как кода', 'инфраструктуру как код'] }, short: bi('Подход, при котором серверы, сети и облачные ресурсы описываются файлами в репозитории и создаются программой по этому описанию.', 'An approach where servers, networks and cloud resources are described by files in a repository and created by a program from that description.'), introducedIn: 'iac.ansible-intro' },
  { id: 'iac.idempotence', term: bi('идемпотентность', 'idempotence'), forms: { ru: ['идемпотентности', 'идемпотентный', 'идемпотентным', 'идемпотентна', 'идемпотентен'], en: ['idempotent'] }, short: bi('Свойство операции, при котором повторный запуск даёт тот же результат и ничего не меняет, если цель уже достигнута.', 'A property of an operation: running it again gives the same result and changes nothing if the goal is already reached.'), introducedIn: 'iac.ansible-intro' },
  { id: 'iac.inventory', term: bi('инвентарь', 'inventory'), forms: { ru: ['инвентаря', 'инвентарём', 'инвентаре'] }, scan: false, short: bi('Файл со списком управляемых хостов и их групп, из которого Ansible узнаёт, какие машины ему настраивать.', 'A file listing managed hosts and their groups; it tells Ansible whom to configure.'), introducedIn: 'iac.ansible-intro' },
  { id: 'iac.module', term: bi('модуль Ansible', 'Ansible module'), forms: { ru: ['модуля Ansible', 'модули Ansible', 'модулем Ansible'], en: ['Ansible modules'] }, short: bi('Небольшая программа, которую Ansible запускает на хосте. Она сравнивает желаемое состояние с текущим и отвечает ok, если менять ничего не пришлось, или changed, если что-то изменила.', 'A small program Ansible runs on a host: it compares the desired state with the current one and answers ok or changed.'), introducedIn: 'iac.ansible-intro', docRef: { page: 'ansible-doc/ansible.builtin.apt', anchor: 'OPTIONS' } },
  { id: 'iac.playbook', term: bi('плейбук', 'playbook'), forms: { ru: ['плейбука', 'плейбуке', 'плейбуком', 'плейбуки', 'плейбуков'], en: ['playbooks'] }, short: bi('Файл YAML, в котором записаны сценарии (по-английски plays), то есть какие задачи, в каком порядке и на каких хостах выполнить.', 'A YAML file of plays: which hosts and which tasks in which order.'), introducedIn: 'iac.playbook' },
  { id: 'iac.handler', term: bi('обработчик', 'handler'), forms: { ru: ['обработчика', 'обработчику', 'обработчиком', 'обработчики', 'обработчиков', 'обработчикам', 'обработчиками'], en: ['handlers'] }, scan: false, short: bi('Задача, которая выполняется один раз в конце сценария и только в том случае, если её уведомила (notify) задача, которая что-то изменила.', 'A task that runs once at the end of a play, only if a task that changed something notified it.'), introducedIn: 'iac.playbook' },
  { id: 'iac.check-mode', term: bi('check mode', 'check mode'), short: bi('Прогон с ключом --check, при котором модули сообщают, что изменили бы, но ничего не меняют.', 'A run with --check: modules report what they would change without changing anything.'), introducedIn: 'iac.playbook' },
  { id: 'iac.resource', term: bi('облачный ресурс', 'cloud resource'), forms: { ru: ['облачного ресурса', 'облачные ресурсы', 'облачных ресурсов'], en: ['cloud resources'] }, short: bi('Объект в облаке, который создаётся запросом к API облака, например виртуальная машина, сеть или DNS-запись.', 'An object in a cloud created by a call to its API: a virtual machine, a network, a DNS record.'), introducedIn: 'iac.terraform' },
  { id: 'iac.provider', term: bi('провайдер Terraform', 'Terraform provider'), forms: { ru: ['провайдера Terraform'] }, short: bi('Плагин, который переводит блоки resource в вызовы API конкретного облака.', 'A plugin that turns resource blocks into API calls of a particular cloud.'), introducedIn: 'iac.terraform' },
  { id: 'iac.plan', term: bi('terraform plan', 'terraform plan'), scan: false, short: bi('Расчёт разницы между кодом и тем, что Terraform знает о мире. Знак + означает создать, ~ изменить, - удалить, а -/+ пересоздать.', 'The computed difference between the code and the known state of the world: + create, ~ update, - destroy, -/+ replace.'), introducedIn: 'iac.terraform', docRef: { page: 'help/terraform', anchor: 'USAGE' } },
  { id: 'iac.state', term: bi('state', 'state'), scan: false, short: bi('Файл terraform.tfstate, в котором для каждого адреса из кода записаны ID объекта в облаке и его последние известные атрибуты.', 'The terraform.tfstate file: the link "address in code ↔ ID in the cloud" and the last known attributes of resources.'), introducedIn: 'iac.state' },
  { id: 'iac.drift', term: bi('дрейф', 'drift'), forms: { ru: ['дрейфа', 'дрейфом', 'дрейфе'] }, short: bi('Расхождение реальной инфраструктуры с кодом, которое возникает, когда ресурсы меняют в обход кода, например вручную в консоли облака.', 'A mismatch between real infrastructure and the code caused by changes behind its back, such as by hand in a console.'), introducedIn: 'iac.state' },
];

// ── setups and fact helpers ──

export const OPS = '/home/learner/ops';
export const INFRA = '/home/learner/infra';
export const INV = '[web]\nweb1\nweb2\n\n[db]\ndb1\n';

export const ansSetup = (files: Record<string, string> = {}, hosts: HostSpec[] = [{ name: 'web1' }, { name: 'web2' }, { name: 'db1' }]): TerminalSetup => ({
  cwd: '~/ops',
  files: [{ path: `${OPS}/ansible.cfg`, content: '[defaults]\ninventory = ./inventory.ini\n' }, ...Object.entries(files).map(([p, content]) => ({ path: `${OPS}/${p}`, content }))],
  ext: { ans: { hosts } },
});

export const TF_HEAD = 'terraform {\n  required_providers {\n    edu = {\n      source  = "edu/edu"\n      version = "~> 1.4"\n    }\n  }\n}\n\nprovider "edu" {}\n';
export const TF_NET = '\nresource "edu_network" "main" {\n  name = "cafe"\n  cidr = "10.0.0.0/16"\n}\n';
export const TF_VM = '\nresource "edu_vm" "web" {\n  name       = "web"\n  image      = "ubuntu-24.04"\n  cores      = 2\n  network_id = edu_network.main.id\n}\n';
export const tfSetup = (main: string, extra: TerminalSetup['script'] = []): TerminalSetup => ({ cwd: '~/infra', files: [{ path: `${INFRA}/main.tf`, content: main }], ext: { tf: {} }, script: extra });

export const host = hostFact;
export const tf = (f: Facts) => tfDir(f, INFRA);
export const cloud = (f: Facts) => (f.tf as TfFacts | undefined)?.cloud ?? [];

export const SITE_PLAY = `- name: Web servers serve the cafe site
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

    - name: The motd says who manages the host
      ansible.builtin.shell: echo "Managed by Ansible" >> /etc/motd

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
export const TEMPLATE = 'server {\n    listen {{ http_port | default(80) }};\n    server_name {{ inventory_hostname }}.site.edu;\n    root /var/www/cafe;\n}\n';

// Russian explanations for the two YAML mistakes a hand-edited playbook makes most often.
const lastOutOf = (f: Facts) => (f.term.main ?? []).at(-1)?.out ?? '';
export const YAML_FAILS: { if: (f: Facts) => boolean; say: ReturnType<typeof bi> }[] = [
  {
    if: (f) => /Syntax Error while loading YAML/.test(lastOutOf(f)),
    say: bi(
      'Ansible не прочитал файл YAML, и чаще всего причина в отступах. В YAML вложенность задают пробелы в начале строки, поэтому все строки одной задачи начинаются с одинакового числа пробелов, а параметры модуля сдвинуты на два пробела дальше имени модуля. Номер строки в сообщении показывает, где Ansible запутался, а ошибка обычно стоит в этой строке или в строке перед ней.',
      'Ansible could not read the YAML file, and most often the reason is the indentation. In YAML the spaces at the start of a line set the nesting, so all lines of one task start with the same number of spaces, and the module’s parameters sit two spaces further in than the module name. The line number in the message shows where Ansible got lost, and the mistake is usually on that line or the one before it.',
    ),
  },
  {
    if: (f) => /must be a list of plays/.test(lastOutOf(f)),
    say: bi(
      'Плейбук должен быть списком сценариев, поэтому его первая строка начинается с дефиса и пробела: `- name: …`. Ansible увидел в начале файла не список, а набор пар «ключ: значение», значит, первый дефис пропал или перед ним оказались лишние символы. Откройте файл командой `edit` и проверьте его начало.',
      'A playbook must be a list of plays, so its first line starts with a dash and a space: `- name: …`. Ansible saw a dictionary instead of a list, so the first dash went missing or something stands in front of it. Open the file with `edit` and check its beginning.',
    ),
  },
];

// ── quiz ──

export const quiz: QuizItem[] = [
  {
    id: 'iac.q.why',
    kind: 'mcq',
    concepts: ['iac.iac'],
    prompt: bi('Пять серверов настраивали вручную по одной инструкции. Через полгода они отличаются друг от друга. Что решает инфраструктура как код?', 'Five servers were set up by hand from one guide. Half a year later they differ from each other. What does infrastructure as code solve?'),
    options: [
      { id: 'desc', text: bi('Желаемое состояние записано в файлах и применяется программой одинаково ко всем, а изменения видны в истории Git', 'The desired state is written in files and applied by a program the same way to all, and changes are visible in the Git history'), correct: true },
      { id: 'faster', text: bi('Серверы начинают работать быстрее, потому что программа настраивает их без лишних пакетов и служб', 'The servers start working faster, because the program sets them up without extra packages and services'), why: bi('Скорость серверов от этого не меняется, а инфраструктура как код решает задачу повторяемой настройки.', 'Server speed has nothing to do with it: the point is repeatable setup.') },
      { id: 'backup', text: bi('Появляется резервная копия серверов, из которой любой из них можно восстановить в прежнем виде', 'You get a backup of the servers from which any of them can be restored as it was'), why: bi('Код описывает настройку серверов, а не данные на них, поэтому резервные копии всё равно нужно делать отдельно.', 'The code describes the setup, not the data. Backups are a separate task.') },
    ],
  },
  {
    id: 'iac.q.idem',
    kind: 'multi',
    concepts: ['iac.idempotence'],
    prompt: bi('Какие задачи идемпотентны, то есть при втором запуске ничего не меняют? Отметьте все.', 'Which tasks are idempotent, so that a second run changes nothing? Mark all.'),
    options: [
      { id: 'apt', text: 'apt: name=nginx state=present', correct: true },
      { id: 'line', text: 'lineinfile: path=/etc/motd line="Managed by Ansible"', correct: true },
      { id: 'svc', text: 'service: name=nginx state=started', correct: true },
      { id: 'echo', text: 'shell: echo "Managed by Ansible" >> /etc/motd', why: bi('Оператор >> дописывает строку при каждом запуске, поэтому файл растёт, а задача всегда отвечает changed.', '>> appends the line on every run: the file grows and the task is always changed.') },
      { id: 'restart', text: 'service: name=nginx state=restarted', why: bi('Значение restarted описывает действие, а не состояние, поэтому служба перезапускается при каждом прогоне.', 'restarted is an action, not a state: the service restarts every time.') },
    ],
  },
  {
    id: 'iac.q.inventory',
    kind: 'predict-output',
    concepts: ['iac.inventory'],
    prompt: bi('В инвентаре группа `[web]` содержит хосты web1 и web2, а группа `[db]` содержит хост db1. Что выведет команда `ansible-inventory --graph`?', 'The inventory: `[web]` web1, web2; `[db]` db1. What does `ansible-inventory --graph` print?'),
    command: 'ansible-inventory -i inventory.ini --graph',
    setup: ansSetup({ 'inventory.ini': INV }),
    explain: bi('Каждый хост входит в группу all. В группу ungrouped попадают хосты, которые не вошли ни в одну другую группу, и здесь она пустая. Остальные группы нужны, чтобы выбирать хосты: в следующем уроке вы выберете хосты группы web строкой `hosts: web`.', 'Every host belongs to the all group. The ungrouped group gets the hosts that are in no other group, and here it is empty. The other groups are there to pick hosts: in the next lesson you pick the hosts of the web group with the line `hosts: web`.'),
  },
  {
    id: 'iac.q.ok-changed',
    kind: 'match',
    concepts: ['iac.module'],
    prompt: bi('Что ответит модуль в каждом из этих случаев?', 'What will the module answer?'),
    pairs: [
      { id: 'a', left: bi('модуль apt ставит nginx, а пакет уже установлен', 'apt: nginx, the package is already installed'), right: 'ok', why: bi('Хост уже в нужном состоянии, поэтому модуль ничего не меняет и отвечает ok.', 'The host is already in the desired state, so the module changes nothing and answers ok.') },
      { id: 'b', left: bi('модуль apt ставит nginx, а пакета на хосте нет', 'apt: nginx, the package is missing'), right: 'changed', why: bi('Модулю пришлось установить пакет, то есть изменить хост, поэтому он отвечает changed.', 'The module had to install the package, that is change the host, so it answers changed.') },
      { id: 'c', left: bi('модулю apt передали имя ngnix с опечаткой', 'apt: ngnix (a typo)'), right: 'failed', why: bi('Модуль отвечает No package matching \'ngnix\' is available, потому что не может привести хост к описанному состоянию.', 'No package matching \'ngnix\' is available: the module cannot reach the state.') },
      { id: 'd', left: bi('хост выключен, и Ansible не может зайти на него по SSH', 'the host is down, and Ansible cannot log in over SSH'), right: 'unreachable', why: bi('До модуля дело не дошло: Ansible не зашёл на хост по SSH и поэтому пишет unreachable, а не failed.', 'The module never ran: Ansible did not get onto the host over SSH, so it reports unreachable, not failed.') },
    ],
  },
  {
    id: 'iac.q.handler',
    kind: 'mcq',
    concepts: ['iac.handler'],
    prompt: bi('Три задачи меняют конфигурацию nginx, и каждая из них делает `notify: Reload nginx`. Все три задачи ответили changed. Сколько раз обработчик выполнится на хосте?', 'Three tasks change the nginx config, and each does `notify: Reload nginx`. All three are changed. How many times does the handler run on the host?'),
    options: [
      { id: 'one', text: bi('Один раз, в конце сценария', 'Once, at the end of the play'), correct: true },
      { id: 'three', text: bi('Три раза, после каждой задачи', 'Three times, after each task'), why: bi('Уведомление ставит обработчик в очередь, а не вызывает его сразу, поэтому три уведомления дают одно выполнение.', 'A handler is a queue, not a call: notifications pile up, it runs once.') },
      { id: 'zero', text: bi('Ни разу, потому что обработчики запускают вручную', 'Never: handlers are run by hand'), why: bi('Обработчик запускает сам Ansible, если его уведомила задача, которая ответила changed.', 'Ansible runs the handler itself when a changed task notified it.') },
    ],
  },
  {
    id: 'iac.q.check',
    kind: 'mcq',
    concepts: ['iac.check-mode'],
    prompt: bi('Что делает `ansible-playbook --check site.yml`?', 'What does `ansible-playbook --check site.yml` do?'),
    options: [
      { id: 'predict', text: bi('Прогоняет задачи, но модули только сообщают, что изменили бы', 'Runs the tasks, but modules only report what they would change'), correct: true },
      { id: 'syntax', text: bi('Проверяет синтаксис YAML и имена модулей, не заходя на хосты', 'Checks the YAML syntax and the module names without going to the hosts'), why: bi('Синтаксис проверяет ключ --syntax-check, а --check заходит на хосты и сравнивает их состояние с описанием.', 'There is --syntax-check for syntax. --check goes to the hosts and compares state.') },
      { id: 'safe', text: bi('Применяет изменения, а при первой ошибке откатывает их на всех хостах', 'Applies the changes and rolls them back on all hosts at the first error'), why: bi('Отката изменений в Ansible нет, а --check ничего не применяет.', 'Ansible has no rollback; --check applies nothing at all.') },
    ],
    explain: bi('Учтите, что в check mode пакет не устанавливается по-настоящему, поэтому следующая задача, которой этот пакет нужен, может завершиться с ошибкой.', 'Note: in check mode a package is not really installed, so a later task that needs it may fail.'),
  },
  {
    id: 'iac.q.unreachable',
    kind: 'mcq',
    concepts: ['iac.module'],
    prompt: bi('Команда `ansible web -m ansible.builtin.ping` печатает про web1 `UNREACHABLE!` и `Permission denied (publickey)`, а web2 отвечает `SUCCESS`. Что проверить первым делом?', 'The command `ansible web -m ansible.builtin.ping` prints `UNREACHABLE!` and `Permission denied (publickey)` for web1, and web2 answers `SUCCESS`. What do you check first?'),
    options: [
      { id: 'key', text: bi('Лежит ли открытая часть вашего ключа SSH в authorized_keys пользователя на web1', 'Whether the public part of your SSH key is in the user’s authorized_keys on web1'), correct: true },
      { id: 'python', text: bi('Установлен ли на web1 Python, без которого Ansible не запустит модуль', 'Whether Python is installed on web1, without which Ansible cannot run the module'), why: bi('Без Python Ansible всё-таки входит на хост и только потом сообщает об ошибке модуля, то есть пишет FAILED. Сообщение Permission denied (publickey) присылает сервер SSH ещё до входа.', 'Without Python Ansible still logs in to the host and only then reports a module error, that is FAILED. The words Permission denied (publickey) come from the SSH server before any login.') },
      { id: 'become', text: bi('Указан ли в задаче `become: true`, ведь без прав root на хост не пустят', 'Whether the task has `become: true`, since without root rights the host lets nobody in'), why: bi('Строка become включает sudo уже после того, как Ansible вошёл на хост. Если у пользователя нет прав sudo, задача завершится с ошибкой FAILED и сообщением о пароле sudo, а не с UNREACHABLE.', 'become switches on sudo only after Ansible has logged in. If the user has no sudo rights, the task ends with FAILED and a message about the sudo password, not with UNREACHABLE.') },
      { id: 'module', text: bi('Поставлен ли на web1 модуль ping, ведь Ansible запускает модули с хоста', 'Whether the ping module is installed on web1, since Ansible runs modules from the host'), why: bi('Модули Ansible копирует на хост сам при каждом запуске, поэтому заранее ставить их на хост не нужно.', 'Ansible brings the modules along: on every run it copies the module to the host, and nothing has to be installed there in advance.') },
    ],
    explain: bi('UNREACHABLE означает, что Ansible не вошёл на хост и до модуля дело не дошло. Ту же ошибку покажет команда `ssh web1` из того же терминала, поэтому неисправность ищут так же, как в блоке Linux: проверяют ключ, пользователя и файл `~/.ssh/authorized_keys` на хосте.', 'UNREACHABLE means Ansible did not log in to the host and the module never ran. The command `ssh web1` from the same terminal shows the same error, so the fault is looked for as in the Linux block: check the key, the user and the file `~/.ssh/authorized_keys` on the host.'),
  },
  {
    id: 'iac.q.self-ref',
    kind: 'bugfind',
    concepts: ['iac.resource'],
    prompt: bi('Автор хотел, чтобы метка `role` у машины совпадала с её именем, но `terraform validate` сообщает об ошибке. Какая строка неверна?', 'The author wanted the machine’s `role` label to match its name, but `terraform validate` reports an error. Which line is wrong?'),
    code: 'resource "edu_vm" "web" {\n  name       = "web"\n  image      = "ubuntu-24.04"\n  cores      = 2\n  network_id = edu_network.main.id\n  labels     = { role = edu_vm.web.name }\n}',
    lang: 'hcl',
    bug: [6],
    why: {
      6: bi('Блок resource не выполняется сверху вниз, как функция, поэтому сослаться на строку выше в том же блоке нельзя. Ссылка `edu_vm.web.name` делает ресурс зависимым от самого себя, и Terraform остановится с ошибкой `Self-referential block`. Общее значение выносят в блок `locals { name = "web" }` и в обоих аргументах пишут `local.name`.', 'A resource block is not executed top to bottom like a function, so it cannot refer to a line above in the same block. The reference `edu_vm.web.name` makes the resource depend on itself, and Terraform stops with `Self-referential block`. A shared value goes into a `locals { name = "web" }` block, and both arguments say `local.name`.'),
      5: bi('Ссылка на другой ресурс допустима, даже если сеть описана ниже в файле. Порядок блоков в файле ничего не решает: Terraform выстраивает порядок работы по ссылкам.', 'A reference to another resource is fine even if the network is described further down the file. The order of blocks in a file decides nothing: Terraform orders the work by the references.'),
      2: bi('Имя машины задано обычной строкой, и здесь всё верно.', 'The machine’s name is a plain string, and this is correct.'),
    },
  },
  {
    id: 'iac.q.symbols',
    kind: 'match',
    concepts: ['iac.plan'],
    prompt: bi('Какой знак terraform plan поставит рядом с ресурсом в каждом из этих случаев?', 'Which symbol does terraform plan show?'),
    pairs: [
      { id: 'new', left: bi('в код добавили новый ресурс', 'a new resource in the code'), right: '+' },
      { id: 'cores', left: bi('у ВМ изменили число ядер (cores)', 'cores of a VM changed'), right: '~' },
      { id: 'image', left: bi('у ВМ изменили образ (image)', 'image of a VM changed'), right: '-/+', why: bi('Образ работающей машины поменять нельзя, поэтому план помечает его строкой «# forces replacement» и пересоздаёт машину.', 'The image cannot change in place: "# forces replacement".') },
      { id: 'gone', left: bi('ресурс удалили из кода', 'a resource was removed from the code'), right: '-' },
    ],
  },
  {
    id: 'iac.q.known-after',
    kind: 'mcq',
    concepts: ['iac.plan'],
    prompt: bi('Почему в плане создания ВМ `public_ip = (known after apply)`?', 'Why does a VM creation plan show `public_ip = (known after apply)`?'),
    options: [
      { id: 'cloud', text: bi('Адрес выдаёт облако при создании машины, и до запроса к API его никто не знает', 'The cloud assigns the address on creation; nobody knows it before the API call'), correct: true },
      { id: 'bug', text: bi('Terraform не прочитал конфигурацию и поэтому не знает, какие значения в ней записаны', 'Terraform did not read the configuration and so does not know which values it holds'), why: bi('Это не ошибка, а обычная запись для атрибутов, которые вычисляет облако.', 'It is not an error: that is how attributes computed by the cloud are shown.') },
      { id: 'var', text: bi('Адрес нужно задать переменной в коде, а пока его никто не задал', 'The address must be set with a variable in the code, and nobody has set it yet'), why: bi('Атрибут public_ip доступен только для чтения, и задать его в коде нельзя.', 'public_ip is read-only: it cannot be set in the code.') },
    ],
  },
  {
    id: 'iac.q.state-lost',
    kind: 'mcq',
    concepts: ['iac.state'],
    prompt: bi('Файл terraform.tfstate удалили, а ВМ в облаке продолжают работать. Что предложит `terraform plan`?', 'terraform.tfstate was deleted, the VMs run in the cloud. What will `terraform plan` propose?'),
    options: [
      { id: 'create', text: bi('Создать все ресурсы заново', 'Create every resource again'), correct: true },
      { id: 'nochange', text: bi('No changes', 'No changes'), why: bi('Terraform узнаёт свои ресурсы только по записям в state, и без этого файла он не знает, что эти ВМ создал он.', 'Terraform knows its resources only through the state. Without it, it does not see the VMs are its own.') },
      { id: 'delete', text: bi('Удалить ВМ из облака', 'Delete the VMs from the cloud'), why: bi('Terraform удаляет только то, что записано в state, а без state удалять ему нечего.', 'Only what is in the state can be destroyed. Without state there is nothing to destroy.') },
    ],
    explain: bi('Поэтому state хранят в общем хранилище с блокировкой и резервными копиями и ограничивают к нему доступ, ведь в нём лежат атрибуты ресурсов, включая секреты.', 'That is why state is kept remotely, with locking and backups, and access to it is limited: it holds attributes, secrets included.'),
  },
  {
    id: 'iac.q.removed-block',
    kind: 'mcq',
    concepts: ['iac.state', 'iac.plan'],
    prompt: bi('Коллега удалил из `main.tf` блок `resource "edu_dns_record" "www"`, решив, что так Terraform перестанет следить за записью. Команду destroy никто не запускал. Что сделает следующий `terraform apply`?', 'A colleague deleted the block `resource "edu_dns_record" "www"` from `main.tf`, thinking that Terraform would stop looking after the record. Nobody ran destroy. What will the next `terraform apply` do?'),
    options: [
      { id: 'destroy', text: bi('Удалит запись из облака, потому что она есть в state, но её нет в коде', 'Delete the record from the cloud, because it is in the state but not in the code'), correct: true },
      { id: 'nothing', text: bi('Ничего не сделает, потому что команды удаления в коде никто не писал', 'Do nothing, because nobody wrote a delete command in the code'), why: bi('Код описывает желаемое состояние, а не список команд. Запись, которой нет в коде, но которая есть в state, для Terraform лишняя, и план ставит у неё знак `-`.', 'The code describes the desired state, not a list of commands. A record missing from the code but present in the state is extra for Terraform, and the plan marks it `-`.') },
      { id: 'forget', text: bi('Уберёт запись из state, а саму запись оставит в облаке без присмотра', 'Remove the record from the state and leave the record itself in the cloud unattended'), why: bi('Так поступает команда `terraform state rm`: она разрывает связь адреса с объектом и не трогает облако. А удалённый из кода блок означает, что такой записи быть не должно.', 'That is what `terraform state rm` does: it breaks the link between the address and the object and leaves the cloud alone. A block removed from the code means that such a record must not exist.') },
      { id: 'error', text: bi('Остановится с ошибкой, ведь в state есть ресурс, не описанный в коде', 'Stop with an error, since the state has a resource not described in the code'), why: bi('Это обычная ситуация, а не ошибка: так Terraform и удаляет ресурсы, которые убрали из кода.', 'This is a normal situation, not an error: this is exactly how Terraform deletes resources removed from the code.') },
    ],
    explain: bi('Перед apply план покажет `- destroy` у записи и итог `1 to destroy`, поэтому такую ошибку ловят, читая план. Если запись нужно оставить, но перестать управлять ею из кода, сначала выполняют `terraform state rm edu_dns_record.www`, а уже потом удаляют блок.', 'Before apply the plan shows `- destroy` for the record and the total `1 to destroy`, so such a mistake is caught by reading the plan. If the record must stay but no longer be managed by the code, first run `terraform state rm edu_dns_record.www` and only then delete the block.'),
  },
  {
    id: 'iac.q.drift',
    kind: 'order',
    concepts: ['iac.drift'],
    prompt: bi('В консоли облака у ВМ сменили число ядер с 2 на 4, а код не трогали. Расставьте по порядку, что делает `terraform plan`.', 'In the cloud console the VM cores were changed 2 → 4, the code is untouched. Put in order what `terraform plan` does.'),
    steps: [
      { id: 'read', text: bi('читает код и state', 'reads the code and the state') },
      { id: 'refresh', text: bi('спрашивает облако о каждом ресурсе из state', 'asks the cloud about every resource from the state') },
      { id: 'note', text: bi('пишет «Objects have changed outside of Terraform»', 'prints "Objects have changed outside of Terraform"') },
      { id: 'plan', text: bi('предлагает ~ cores = 4 -> 2', 'proposes ~ cores = 4 -> 2'), why: bi('Код описывает желаемое состояние, поэтому план возвращает облако к коду, если вы не изменили сам код и не добавили ignore_changes.', 'The code is the desired state: the plan brings the cloud back to the code unless you change the code or add ignore_changes.') },
    ],
  },
  {
    id: 'iac.q.ans-vs-tf',
    kind: 'match',
    concepts: ['iac.state', 'iac.module'],
    prompt: bi('Какой инструмент подходит для каждой задачи, Ansible или Terraform?', 'Which tool fits each task, Ansible or Terraform?'),
    pairs: [
      { id: 'pkg', left: bi('поставить nginx на 30 готовых серверов', 'install nginx on 30 existing servers'), right: 'Ansible' },
      { id: 'vm', left: bi('заказать в облаке 3 ВМ, сеть и DNS-записи и запомнить, что создано', 'order 3 VMs, a network and DNS records from a cloud and remember what was created'), right: 'Terraform', why: bi('Terraform создаёт ресурсы облака и запоминает их в state. Ansible каждый раз смотрит на хосты заново и между прогонами ничего не хранит.', 'Terraform creates cloud resources and remembers them in the state. Ansible looks at the hosts afresh every time and keeps nothing between runs.') },
      { id: 'both', left: bi('при повторном запуске без правок в коде ничего не менять', 'change nothing on a repeated run without edits to the code'), right: bi('оба инструмента', 'both tools'), why: bi('Оба инструмента идемпотентны, поэтому повторный прогон плейбука даёт changed=0, а повторный apply показывает No changes.', 'Both are idempotent: a repeated playbook run gives changed=0, and a repeated apply shows No changes.') },
    ],
  },
];

// ── lessons ──

const introLesson: Lesson = {
  id: 'iac.ansible-intro',
  block: 'iac',
  title: bi('Инфраструктура как код и первые команды Ansible', 'Infrastructure as code and the first Ansible commands'),
  summary: bi('Вы описываете, каким должен быть сервер, а программа приводит его к этому описанию столько раз, сколько нужно.', 'Describe what a server should be like and let a program bring it there, as many times as needed.'),
  introduces: ['iac.iac', 'iac.idempotence', 'iac.inventory', 'iac.module'],
  uses: ['linux.ssh-key'],
  tier: 'core',
  minutes: 35,
  sources: src([S.fowlerIac, S.ansIntro, S.ansInv], [S.ruIac, S.ruAnsible, S.ruIdem]),
  sections: [
    {
      id: 'map',
      kind: 'text',
      levels: ['intermediate', 'experienced'],
      title: bi('Как пройти этот блок, если вы уже пишете код', 'How to take this block if you already write code'),
      body: bi(
        'Блок построен вокруг одной модели: код описывает желаемое состояние, программа сравнивает его с действительностью и меняет только разницу. Ansible применяет эту модель к серверам, которые уже есть, а Terraform и его открытая версия OpenTofu применяют её к машинам, сетям и другим объектам в облаке и запоминают созданное в отдельном файле.\n\nПрограммисту здесь помогут два сравнения. План Terraform похож на миграции базы данных в Laravel или Django: изменения схемы можно посмотреть до того, как их применят, а таблица миграций помнит, что уже сделано. Отличаются они тем, что миграцию пишут как последовательность шагов, а план Terraform вычисляет сам, сравнивая код с тем, что есть в облаке. Тот, кто выкладывал сайты на Vercel или Heroku, уже пользовался такой системой, только она была спрятана: платформа сама заводила для сайта всё нужное в облаке и сама помнила, что завела. В этом блоке видно, что под ней лежит.\n\n- **Что можно пролистать.** Если вы знаете, что такое идемпотентность, пролистайте начало теории этого урока и задание с ad-hoc-командами. Прочтите только абзац об ответах модуля, потому что unreachable и failed означают разные неисправности.\n- **Где объяснена модель всей системы.** Урок [о state и пересоздании ресурсов](#/lesson/iac.state) объясняет, как Terraform сверяет код, свою память и облако, а урок [«Как устроен API облака»](#/lesson/iac.cloud-api) показывает, какие запросы стоят за каждой строкой плана. Вся цепочка от `git push` до настроенной машины собрана в последнем уроке, [«Как пайплайн применяет изменения инфраструктуры»](#/lesson/iac.ci-apply).\n- **Где искать рецепты для работы.** Роли и то, как Ansible выбирает значение переменной из нескольких мест, разобраны в уроке [о ролях](#/lesson/iac.roles), перенос ресурса без пересоздания в уроке [о модулях](#/lesson/iac.modules), ручные объекты и ночная проверка расхождений с кодом в уроке [об изменениях в обход кода](#/lesson/iac.import), а общее хранилище с блокировкой в уроке [о хранилище для state](#/lesson/iac.remote-state).\n\nШпаргалки команд и вопросы, которые задают на собеседовании, собраны в конце урока о ролях для Ansible и в конце последнего урока для Terraform.',
        'The block is built around one model: code describes the desired state, a program compares it with reality and changes only the difference. Ansible applies this model to servers that already exist, while Terraform and its open version OpenTofu apply it to machines, networks and other objects in a cloud and remember what they created in a separate file.\n\nTwo comparisons help a programmer here. A Terraform plan is like database migrations in Laravel or Django: schema changes can be looked at before they are applied, and the migrations table remembers what has been done. They differ in that a migration is written as a sequence of steps, while Terraform works the plan out itself by comparing the code with what is in the cloud. Whoever deployed sites to Vercel or Heroku has already used such a system, only it was hidden: the platform set up everything the site needed in the cloud and remembered what it set up. This block shows what lies underneath.\n\n- **What you can skim.** If you know what idempotence is, skim the beginning of this lesson’s theory and the task with ad-hoc commands. Read only the paragraph about module answers, because unreachable and failed mean different faults.\n- **Where the model of the whole system is.** The lesson [on the state and resource replacement](#/lesson/iac.state) explains how Terraform checks the code, its memory and the cloud against each other, and the lesson [“How a cloud API works”](#/lesson/iac.cloud-api) shows which requests stand behind every line of a plan. The whole chain from `git push` to a configured machine is assembled in the last lesson, [“How a pipeline applies infrastructure changes”](#/lesson/iac.ci-apply).\n- **Where to find recipes for work.** Roles and how Ansible picks a variable’s value from several places are taken apart in the lesson [on roles](#/lesson/iac.roles), moving a resource without replacement in the lesson [on modules](#/lesson/iac.modules), hand-made objects and the nightly check for differences from the code in the lesson [on changes made bypassing the code](#/lesson/iac.import), and shared storage with locking in the lesson [on storage for the state](#/lesson/iac.remote-state).\n\nCheat sheets of commands and the questions asked in job interviews are collected at the end of the lesson on roles for Ansible and at the end of the last lesson for Terraform.',
      ),
    },
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'У кафе теперь три сервера, и каждый из них настраивали вручную по инструкции из вики. На одном стоит nginx 1.22, на другом 1.26, а на третьем год назад кто-то «временно» поправил конфигурацию руками. Что на самом деле установлено на серверах, не знает никто, а новый сервер настраивают полдня, и он всё равно получается немного не таким, как остальные. В этом уроке вы опишете нужное состояние серверов в файлах и поручите программе Ansible приводить к нему все машины сразу.',
        'The café now has three servers, and each was set up by hand from a wiki guide. One has nginx 1.22, another 1.26, and on the third someone edited the config by hand "temporarily" a year ago. Nobody knows what is really installed on the servers, and a new server takes half a day to set up and still comes out a little different from the others. In this lesson you describe the desired state of the servers in files and let the Ansible program bring every machine to it at once.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'При подходе, который называют [[iac.iac|инфраструктурой как код]], инструкцию «что сделать» заменяют описанием того, каким всё должно быть: пакет nginx установлен, файл конфигурации выглядит так-то, служба запущена. Описание хранится в репозитории, как код приложения, проходит проверку коллегами и пайплайн, а применяет его программа, одинаково к одному серверу и к сотне.\n\nГлавное свойство такой программы называется [[iac.idempotence|идемпотентностью]]. Программу можно запускать сколько угодно раз, и если сервер уже находится в нужном состоянии, ничего не изменится. Инструкция «добавь строку в файл» при повторе добавит вторую такую же строку, а описание «строка в файле есть» при повторе только проверит, что она на месте. Поэтому одно и то же описание годится и для первой настройки, и для проверки того, что сервер не разошёлся с описанием.\n\n### Ansible\n\nAnsible настраивает серверы, которые уже существуют. Заранее ставить на них ничего не нужно: Ansible заходит на сервер по SSH с [[linux.ssh-key|ключом SSH]], так же как вы входили на серверы в блоке Linux, копирует туда небольшую программу на Python и запускает её. Какие серверы настраивать, Ansible узнаёт из [[iac.inventory|инвентаря]], то есть файла со списком хостов и групп:\n\n```ini\n[web]\nweb1\nweb2\n\n[db]\ndb1\n```\n\nКак Ansible понял инвентарь, показывает команда `ansible-inventory --graph`. Она рисует дерево групп, где каждый уровень вложенности сдвинут вправо. Все хосты входят в общую группу all, а в группу ungrouped попадают хосты, которые не вошли ни в одну другую группу:\n\n```text\n@all:\n  |--@db:\n  |  |--db1\n  |--@ungrouped:\n  |--@web:\n  |  |--web1\n  |  |--web2\n```\n\nРаботу на хосте выполняет [[iac.module|модуль Ansible]]: `ansible.builtin.apt` ставит пакеты, `ansible.builtin.copy` раскладывает файлы, а `ansible.builtin.service` управляет службами. Модуль сначала смотрит, как устроен хост сейчас, потом сравнивает это с описанием и меняет только разницу. Ответ модуля бывает трёх видов: **ok** означает, что всё уже было так, как нужно, **changed** означает, что модуль что-то изменил, а **failed** означает, что привести хост к описанию не удалось. Кроме этих трёх ответов модуля бывает четвёртый итог, **unreachable**: Ansible пишет его, когда не зашёл на хост по SSH, и до модуля дело не дошло. Модуль называют полным именем, в котором сначала стоит коллекция, а потом имя модуля: `ansible.builtin.apt`. Справку по любому модулю показывает команда `ansible-doc ansible.builtin.apt`.\n\nОдну задачу можно выполнить из терминала одной командой, и такую команду называют ad-hoc. Команда `ansible web -m ansible.builtin.ping` проверяет, что Ansible может зайти на хосты группы web и что на них есть Python, а команда `ansible web -m ansible.builtin.apt -a "name=nginx state=present"` ставит на эти хосты пакет nginx. В выводе ad-hoc-команды ответ changed печатается словом `CHANGED`, а ответ ok печатается словом `SUCCESS` вместе со строкой `"changed": false`.',
        '[[iac.iac|Infrastructure as code]] is a way of working in which the instruction "what to do" is replaced by a description of "what it should be like": the nginx package is installed, the config file is this, the service is running. The description lives in a repository like application code, goes through review and a pipeline, and a program applies it, the same way to one server and to a hundred.\n\nThe key property of such a program is [[iac.idempotence|idempotence]]: you can run it as many times as you like, and if the server is already in the desired state, nothing changes. The instruction "add a line to the file" adds a second line when repeated; the description "the line is in the file" just checks that it is there. So the description works both for the first setup and for checking that a server has not drifted away.\n\n### Ansible\n\nAnsible is a tool for configuring servers that already exist. Nothing is installed on them in advance: Ansible logs in over SSH with an [[linux.ssh-key|SSH key]], the same way you logged in to servers in the Linux block, copies a small Python program and runs it. It learns whom to configure from an [[iac.inventory|inventory]], a file listing hosts and groups:\n\n```ini\n[web]\nweb1\nweb2\n\n[db]\ndb1\n```\n\nHow Ansible understood the inventory is shown by `ansible-inventory --graph`. It draws a tree of groups, each level of nesting shifted to the right. Every host belongs to the common group all, and the ungrouped group gets the hosts that are in no other group:\n\n```text\n@all:\n  |--@db:\n  |  |--db1\n  |--@ungrouped:\n  |--@web:\n  |  |--web1\n  |  |--web2\n```\n\nThe work on a host is done by an [[iac.module|Ansible module]]: `ansible.builtin.apt` installs packages, `ansible.builtin.copy` lays out files, `ansible.builtin.service` manages services. A module first looks at how things are, compares that with how they should be, and changes only the difference. Its answer is **ok** (already so), **changed** (changed it), **failed** (could not). There is a fourth outcome, **unreachable**: Ansible reports it when it could not log in to the host over SSH, and the module never ran. Modules are named in full, collection and name: `ansible.builtin.apt`. `ansible-doc ansible.builtin.apt` shows the help for any module.\n\nA single task can be run straight from the terminal; such a command is called ad-hoc. `ansible web -m ansible.builtin.ping` checks that Ansible can log in to the hosts of the web group and that they have Python, and `ansible web -m ansible.builtin.apt -a "name=nginx state=present"` installs the nginx package on those hosts. In the output of an ad-hoc command the answer changed is printed as the word `CHANGED`, and the answer ok is printed as the word `SUCCESS` together with the line `"changed": false`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ansSetup({}, [{ name: 'web1' }, { name: 'web2' }, { name: 'db1' }]),
      intro: bi('Перед вами управляющая машина, с которой Ansible настраивает три хоста: web1, web2 и db1. В файле `~/ops/ansible.cfg` указано, что инвентарь лежит в `./inventory.ini`, но самого файла инвентаря ещё нет. Файлы в тренажёре открывает встроенный редактор, тот же, что в блоке CI/CD: команда `edit inventory.ini` создаёт файл и открывает его, Ctrl+S сохраняет файл, а Esc закрывает редактор. Редакторов nano и vim здесь нет. Испортить здесь ничего нельзя: машины учебные, и кнопка «Сбросить экран» над терминалом возвращает их в исходное состояние, а выполненные цели при этом остаются засчитанными.', 'A control machine and three hosts: web1, web2, db1. `~/ops/ansible.cfg` says the inventory is `./inventory.ini`, but the file does not exist yet. Files are opened by the built-in editor, the same as in the CI/CD block: `edit inventory.ini` creates the file and opens it, Ctrl+S saves the file, and Esc closes the editor. There is no nano or vim here. You cannot spoil anything: the machines are for practice, and the “Reset this screen” button above the terminal returns them to their initial state, while the goals you passed stay passed.'),
      tasks: [
        {
          id: 'inv',
          prompt: bi('Создайте `inventory.ini` с группами `web` (web1, web2) и `db` (db1) и проверьте связь со всеми хостами модулем ping.', 'Create `inventory.ini` with the groups `web` (web1, web2) and `db` (db1) and check the connection to all hosts with the ping module.'),
          check: {
            when: (f) => /\[web\][\s\S]*web1[\s\S]*web2/.test(f.files[`${OPS}/inventory.ini`]?.text ?? '') && /\[db\][\s\S]*db1/.test(f.files[`${OPS}/inventory.ini`]?.text ?? '') && /web1 \| SUCCESS[\s\S]*db1 \| SUCCESS|db1 \| SUCCESS[\s\S]*web1 \| SUCCESS/.test((f.term.main ?? []).at(-1)?.out ?? ''),
          },
          chips: 'ansible all -m ansible.builtin.ping',
          concepts: ['iac.inventory'],
          docRef: { page: 'ansible-doc/ansible.builtin.ping', anchor: 'DESCRIPTION' },
          hints: { H1: bi('Откройте файл командой `edit inventory.ini`, запишите в него секции `[web]` и `[db]`, а под каждой из них по одному хосту на строку, и сохраните файл клавишами Ctrl+S. Затем проверьте связь командой ansible all с модулем ping.', 'Open the file with `edit inventory.ini`, write the sections `[web]` and `[db]` with one host per line under each, and save with Ctrl+S. Then check the connection with ansible all and the ping module.') },
        },
        {
          id: 'nginx',
          prompt: bi('Установите nginx на хосты группы `web` одной ad-hoc-командой. Затем выполните ту же команду ещё раз и убедитесь, что второй раз ничего не меняется.', 'Install nginx on the hosts of the `web` group with one ad-hoc command. Then run the same command again and see that nothing changes the second time.'),
          check: {
            when: (f) => !!host(f, 'web1')?.packages.includes('nginx') && !!host(f, 'web2')?.packages.includes('nginx') && !host(f, 'db1')?.packages.includes('nginx') && /web1 \| SUCCESS/.test((f.term.main ?? []).at(-1)?.out ?? ''),
            fail: [{ if: (f) => !!host(f, 'db1')?.packages.includes('nginx'), say: bi('nginx установился и на db1, потому что команда выбрала все хосты. Укажите вместо all группу web.', 'nginx also landed on db1: the host pattern must be web, not all.') }],
          },
          chips: 'ansible web -m ansible.builtin.apt -a "name=nginx state=present"',
          concepts: ['iac.module', 'iac.idempotence'],
          docRef: { page: 'ansible-doc/ansible.builtin.apt', anchor: 'OPTIONS', line: 'state' },
          hints: { H1: bi('Вам нужен модуль apt с параметрами name и state.', 'The apt module, the name and state parameters.'), H2: bi('Первый запуск ответит CHANGED, потому что пакет устанавливается, а второй ответит SUCCESS, потому что пакет уже стоит.', 'The first run answers CHANGED, the second SUCCESS: the package is already there.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('`ansible-doc` показывает страницу модуля. В каком разделе видно, какие параметры у модуля обязательные (они отмечены знаком `=`)?', '`ansible-doc` shows a module page. In which section can you see which parameters are required (marked with `=`)?'),
      ref: { page: 'ansible-doc/ansible.builtin.copy' },
      answer: 'OPTIONS',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.why', 'iac.q.inventory', 'iac.q.ok-changed'] },
  ],
};

const playbookLesson: Lesson = {
  id: 'iac.playbook',
  block: 'iac',
  title: bi('Плейбук, обработчики и проверка без изменений', 'Playbooks, handlers and a run without changes'),
  summary: bi('Плейбук описывает состояние группы хостов, и правильно написанный плейбук на втором прогоне показывает changed=0.', 'A playbook describes the state of a group of hosts; a correct playbook shows changed=0 on the second run.'),
  introduces: ['iac.playbook', 'iac.handler', 'iac.check-mode'],
  uses: ['iac.module', 'iac.idempotence', 'iac.inventory'],
  tier: 'core',
  minutes: 40,
  sources: src([S.ansPlay, S.ansHandlers, S.ansCheck], [S.ruAnsible, S.ruHabrAnsible]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Ad-hoc-командой вы поставили nginx на два хоста. Но чтобы сервер кафе начал показывать сайт, нужно ещё разложить конфигурацию nginx, перезагрузить его и проверить, что служба работает, а потом повторить всё это на каждом новом сервере. Набирать десяток команд в одном и том же порядке вручную значит снова вернуться к инструкции из вики. В этом уроке вы соберёте все шаги в один файл, плейбук, и научитесь проверять, что повторный запуск ничего не ломает.',
        'With an ad-hoc command you installed nginx on two hosts. But for a café server to show the site, you also have to lay out the nginx config, reload nginx and check that the service runs, and then repeat all of that on every new server. Typing a dozen commands in the same order by hand means going back to the wiki guide. In this lesson you gather all the steps into one file, a playbook, and learn to check that a repeated run breaks nothing.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Ad-hoc-команда выполняет одну задачу, а настройка сервера состоит из десятков задач в определённом порядке. Их записывают в [[iac.playbook|плейбук]], то есть файл YAML со списком сценариев. Сценарий (в документации Ansible он называется play) говорит, на каких хостах (`hosts: web`) и какие задачи выполнить, а каждая задача состоит из имени и модуля с параметрами:\n\n```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  tasks:\n    - name: nginx is installed\n      ansible.builtin.apt:\n        name: nginx\n        state: present\n```\n\nСтрока `become: true` велит Ansible выполнять задачи через sudo, то есть с правами root, потому что ставить пакеты и править файлы в `/etc` может только root. Входит на хост Ansible при этом под обычным пользователем, со своим ключом SSH, и права root получает уже на хосте.\n\nПлейбук запускают командой `ansible-playbook site.yml`. Перед первой задачей Ansible собирает факты о каждом хосте, и в выводе это видно по строке Gathering Facts. Факты сообщают семейство системы, адреса и объём памяти. По ним можно, например, выполнить задачу только на хостах с Debian, если дописать к ней условие `when:`, но в этом уроке условия не понадобятся. Каждая задача проходит все хосты, прежде чем начнётся следующая. В конце Ansible печатает итог PLAY RECAP, где для каждого хоста указано, сколько задач ответили ok, сколько changed и сколько failed.\n\nМодуль `ansible.builtin.template` собирает файл из шаблона и кладёт его на хост. Шаблон похож на бланк письма, в который для каждого адресата подставляют его имя: это обычный файл конфигурации, в котором на месте меняющихся значений стоят выражения в двойных фигурных скобках. Язык этих выражений называется Jinja2. Выражение `{{ inventory_hostname }}` в шаблоне превращается в имя хоста, а выражение `{{ http_port | default(80) }}` превращается в значение переменной http_port или, если она не задана, в число 80.\n\n### Обработчики\n\nКогда конфигурация nginx меняется, nginx должен её перечитать, но только в том случае, если она изменилась. Для этого служит [[iac.handler|обработчик]] (в документации Ansible он называется handler), то есть задача, которую другие задачи уведомляют строкой `notify: Reload nginx`. Уведомление отправляется, только если задача ответила changed, а сам обработчик выполняется один раз, когда закончатся задачи сценария, сколько бы задач его ни уведомили. Если в сценарии есть секции `pre_tasks` и `post_tasks`, Ansible выполняет уведомлённые обработчики в конце каждой из них, а задача `meta: flush_handlers` выполняет их сразу. Если на хосте одна из задач завершилась с ошибкой, Ansible исключает этот хост из дальнейшего выполнения плейбука, и до обработчиков дело на нём не доходит.\n\n### Проверка без изменений\n\nГлавная проверка плейбука состоит из двух прогонов подряд: на втором все задачи должны ответить ok, то есть итог должен показать changed=0. Если какая-то задача отвечает changed на каждом прогоне, значит, она описывает действие, а не состояние. Чаще всего так ведут себя модули `ansible.builtin.shell` и `command`: они не знают, каким должен быть результат, и всегда отвечают changed. Замените их модулем, который описывает состояние (`lineinfile`, `copy`, `service`), или подскажите Ansible, когда задача действительно что-то меняет, параметрами `creates:` и `changed_when:`. Сами эти два модуля тоже различаются. Модуль `command` запускает программу напрямую, без оболочки, поэтому конвейер `|` и перенаправление `>` в нём не работают. Модуль `shell` передаёт всю строку оболочке и нужен только тогда, когда без конвейера или перенаправления не обойтись. Третий модуль, `raw`, отправляет команду по SSH, не копируя на хост программу на Python, и им обычно ставят сам Python на новый хост.\n\nПеред прогоном на рабочих серверах полезен [[iac.check-mode|check mode]]. Команда `ansible-playbook --check --diff site.yml` проходит все задачи, но модули только сообщают, что изменили бы, и показывают разницу в файлах, а сами хосты остаются нетронутыми.',
        'An ad-hoc command is one task. Setting up a server means dozens of tasks in a certain order, and they are written into a [[iac.playbook|playbook]]: a YAML file with a list of plays. A play says on which hosts (`hosts: web`) and which tasks to run; a task is a name and a module with arguments:\n\n```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  tasks:\n    - name: nginx is installed\n      ansible.builtin.apt:\n        name: nginx\n        state: present\n```\n\nThe line `become: true` tells Ansible to run the tasks through sudo, that is with root rights, because only root may install packages and edit files in `/etc`. Ansible still logs in to the host as an ordinary user, with its own SSH key, and gets root rights only on the host.\n\nYou run it with `ansible-playbook site.yml`. Before the tasks Ansible gathers facts (Gathering Facts): the OS family, addresses, memory. With them you can, for example, run a task only on Debian hosts by adding a `when:` condition to it, but this lesson needs no conditions. Each task goes through all hosts before the next one starts. At the end comes the PLAY RECAP: for every host, how many tasks were ok, changed, failed.\n\nThe `ansible.builtin.template` module lays out a file from a template. A template is like a form letter into which each addressee’s name is inserted: an ordinary config file where the changing values are replaced with expressions in double curly braces. The language of these expressions is called Jinja2. `{{ inventory_hostname }}` in the template turns into the host name, and `{{ http_port | default(80) }}` turns into the value of the http_port variable or, if it is not set, into the number 80.\n\n### Handlers\n\nAfter changing the nginx config, nginx must reload it, but only if the config really changed. That is what a [[iac.handler|handler]] is for: a task that is notified with `notify: Reload nginx`. The notification fires only if the task was changed, and the handler itself runs once, when the play’s tasks are over, however many tasks notified it. If the play has `pre_tasks` and `post_tasks` sections, Ansible runs the notified handlers at the end of each of them, and a `meta: flush_handlers` task runs them at once. If a host failed on one of the tasks, it does not get to the handlers.\n\n### A run without changes\n\nTwo runs in a row are the main test of a playbook: on the second everything must be ok, changed=0. If some task is changed on every run, the playbook describes an action, not a state. The usual culprit is `ansible.builtin.shell` or `command`: they do not know what the result should be and always answer changed. Replace them with a state module (`lineinfile`, `copy`, `service`) or give Ansible a hint with `creates:` and `changed_when:`. The two modules differ too. `command` runs a program directly, without a shell, so a pipe `|` or a redirect `>` does not work in it. `shell` hands the whole line to a shell and is needed only when a pipe or a redirect cannot be avoided. A third module, `raw`, sends a command over SSH without copying a Python program to the host, and it is usually how Python itself is installed on a new host.\n\nBefore a run on live servers, [[iac.check-mode|check mode]] is useful: `ansible-playbook --check --diff site.yml` goes through all tasks, but modules only report what they would change and show the file differences.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как плейбук проходит по хостам', 'How a playbook walks across the hosts'),
      body: bi(
        'Схема ниже показывает один прогон плейбука `site.yml` из этого урока на группе web из трёх хостов. Сначала на ней только инвентарь и программа ansible-playbook на управляющей машине. Справа появятся хосты web1, web2 и web3, когда Ansible впервые зайдёт на них по SSH, а внизу появится очередь обработчиков, когда первая задача уведомит обработчик «Reload nginx». Каждый шаг схемы соответствует одной задаче плейбука: установке nginx, раскладке конфигурации, строке в файле `/etc/motd` и проверке службы. На линиях к хостам видно, что ответил модуль на каждом хосте: ok, changed или ошибку.',
        'The diagram below shows one run of the `site.yml` playbook from this lesson on the web group of three hosts. At first it shows only the inventory and the ansible-playbook program on the control machine. The hosts web1, web2 and web3 appear on the right when Ansible first logs in to them over SSH, and the handler queue appears at the bottom when the first task notifies the handler “Reload nginx”. Every step of the diagram is one task of the playbook: installing nginx, laying out the config, the line in `/etc/motd` and checking the service. The lines to the hosts show what the module answered on each host: ok, changed or an error.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'iac.ansible-run', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен тот участник, который работает сейчас, а облачко рядом с ним говорит, что он делает. Жёлтая рамка у хоста означает, что задача на нём что-то изменила и ответила changed, зелёная рамка означает, что хост уже был в нужном состоянии и задача ответила ok, а красная рамка означает, что задача завершилась с ошибкой и Ansible исключил хост из дальнейшего выполнения плейбука. Под схемой три счётчика: сколько задач ответили changed, сколько хостов исключено из выполнения и сколько раз перезагрузился nginx.\n\nКогда пройдёте первый прогон, поставьте в «Параметрах» номер прогона 2 и убедитесь, что счётчик changed стал нулём. Потом выберите для строки в motd модуль shell и пройдите второй и третий прогон: эта задача начнёт отвечать changed каждый раз. Напоследок включите в блоке «Сломать» поломки по одной: сначала на web3 пропадёт python3, а потом на web2 nginx не запустится из-за занятого порта.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The participant working now is highlighted, and the callout next to it says what it does. A yellow outline on a host means the task changed something there and answered changed, a green one means the host was already in the desired state and the task answered ok, and a red one means the task failed and the host left the play. Under the diagram there are three counters: how many tasks answered changed, how many hosts dropped out and how many times nginx was reloaded.\n\nOnce you finish the first run, set the run number to 2 in “Parameters” and see that the changed counter drops to zero. Then choose the shell module for the motd line and walk the second and third runs: that task starts answering changed every time. Finally, switch on the breaks in “Break it” one at a time: first web3 loses python3, then nginx on web2 does not start because its port is taken.'), caption: bi('В задании ниже вы встретите тот же плейбук, и строку в motd в нём дописывает задача shell. Прогоните его дважды и посмотрите в PLAY RECAP, какая задача снова ответила changed. Это та самая задача, которую на схеме нужно было заменить модулем lineinfile.', 'In the task below you meet the same playbook, and in it a shell task appends the motd line. Run it twice and look in PLAY RECAP for the task that answered changed again. It is the very task that had to be replaced with lineinfile in the diagram.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ansSetup({ 'inventory.ini': INV + '\n[web:vars]\nhttp_port=8080\n', 'site.yml': SITE_PLAY, 'templates/cafe.conf.j2': TEMPLATE }),
      intro: bi('В каталоге `~/ops` лежат готовый плейбук `site.yml` для группы web и шаблон конфигурации nginx `templates/cafe.conf.j2`.', '`~/ops` holds a ready playbook `site.yml` for the web group and a template `templates/cafe.conf.j2`.'),
      tasks: [
        {
          id: 'run',
          prompt: bi('Прогоните плейбук. На web1 и web2 должен появиться `/etc/nginx/sites-enabled/cafe.conf` с портом из переменной группы.', 'Run the playbook. web1 and web2 must get `/etc/nginx/sites-enabled/cafe.conf` with the port from the group variable.'),
          check: { when: (f) => ['web1', 'web2'].every((h) => (host(f, h)?.files['/etc/nginx/sites-enabled/cafe.conf'] ?? '').includes('listen 8080;')) && (lastRun(f)?.tasks.some((t) => t.handler && t.status === 'changed') ?? false) },
          chips: 'ansible-playbook site.yml',
          concepts: ['iac.playbook', 'iac.handler'],
          hints: { H1: bi('Запустите программу ansible-playbook и передайте ей имя файла плейбука.', 'ansible-playbook and the file name.') },
        },
        {
          id: 'idem',
          prompt: bi('Прогоните плейбук ещё раз. Одна задача по-прежнему отвечает changed, и файл `/etc/motd` с каждым прогоном растёт. Перепишите эту задачу так, чтобы повторный прогон давал changed=0 на всех хостах, а строка `Managed by Ansible` в motd при этом была. Плейбук открывает команда `edit site.yml`, Ctrl+S сохраняет файл. Следите за отступами: в YAML они задают вложенность, поэтому новые строки задачи должны начинаться с того же числа пробелов, что и соседние.', 'Run it again: one task is still changed and `/etc/motd` keeps growing. Rewrite it so that a repeated run gives changed=0 on all hosts and the line `Managed by Ansible` is in motd. `edit site.yml` opens the playbook, Ctrl+S saves it. Mind the indentation: in YAML it sets the nesting, so the new lines of the task must start with as many spaces as their neighbours.'),
          check: {
            when: (f) => {
              const last = lastRun(f);
              const prev = runs(f).at(-2);
              const once = ['web1', 'web2'].every((h) => (host(f, h)?.files['/etc/motd'] ?? '').includes('Managed by Ansible'));
              const motdTask = (f.files[`${OPS}/site.yml`]?.text ?? '').match(/- name: The motd[^\n]*\n\s+([\w.]+):/);
              return !!last && !last.check && Object.values(last.recap).every((r) => r.changed === 0 && r.failed === 0) && !!prev && once && !!motdTask && !/shell|command/.test(motdTask[1]);
            },
            fail: [
              ...YAML_FAILS,
              { if: (f) => /The motd[\s\S]*?shell/.test(f.files[`${OPS}/site.yml`]?.text ?? ''), say: bi('Модуль shell не знает, каким должен быть файл, и поэтому всегда отвечает changed. Вам нужен модуль, который описывает строку в файле.', 'shell does not know what the file should be like and is always changed. You need a module that describes a line in a file.') },
            ],
          },
          chips: 'ansible-doc ansible.builtin.lineinfile',
          concepts: ['iac.idempotence'],
          docRef: { page: 'ansible-doc/ansible.builtin.lineinfile', anchor: 'OPTIONS', line: 'regexp' },
          hints: { H1: bi('Задача должна описывать «строка в файле есть», а не «допиши строку».', 'The task must describe "the line is in the file", not "append a line".'), H2: bi('```yaml\n      ansible.builtin.lineinfile:\n        path: /etc/motd\n        regexp: "^Managed by Ansible"\n        line: Managed by Ansible\n```', '```yaml\n      ansible.builtin.lineinfile:\n        path: /etc/motd\n        regexp: "^Managed by Ansible"\n        line: Managed by Ansible\n```') },
        },
        {
          id: 'check',
          prompt: bi('Поменяйте в шаблоне `root` на `/var/www/cafe-v2` и посмотрите, что изменится, **не трогая** сами хосты. Для этого запустите плейбук в check mode с показом разницы.', 'Change `root` in the template to `/var/www/cafe-v2` and see what would change **without touching** the hosts: a check-mode run that shows the difference.'),
          check: { when: (f) => !!lastRun(f)?.check && (f.files[`${OPS}/templates/cafe.conf.j2`]?.text ?? '').includes('cafe-v2') && !(host(f, 'web1')?.files['/etc/nginx/sites-enabled/cafe.conf'] ?? '').includes('cafe-v2') && /\+\s*root \/var\/www\/cafe-v2;/.test((f.term.main ?? []).at(-1)?.out ?? '') },
          chips: 'ansible-playbook --check --diff site.yml',
          concepts: ['iac.check-mode'],
          hints: { H1: bi('Вам нужны два ключа: один запрещает менять хосты, а другой показывает разницу в файлах.', 'Two keys: one does not touch the hosts, the other shows file differences.') },
        },
      ],
    },
    {
      id: 'findopt',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Файла `/etc/cafe/owner` на хостах нет. Найдите в `ansible-doc ansible.builtin.lineinfile` параметр, который создаёт файл, если его нет, и одной ad-hoc-командой запишите в него на группе web строку `owner=team-cafe`.', 'The file `/etc/cafe/owner` does not exist on the hosts. Find in `ansible-doc ansible.builtin.lineinfile` the parameter that creates the file if it is missing, and with one ad-hoc command write the line `owner=team-cafe` into it on the web group.'),
      ref: { page: 'ansible-doc/ansible.builtin.lineinfile', anchor: 'OPTIONS', line: 'create' },
      terminal: {
        setup: ansSetup({ 'inventory.ini': INV }),
        task: {
          id: 'create',
          prompt: bi('На web1 и web2 есть /etc/cafe/owner со строкой owner=team-cafe.', 'web1 and web2 have /etc/cafe/owner with the line owner=team-cafe.'),
          check: { when: (f) => ['web1', 'web2'].every((h) => (host(f, h)?.files['/etc/cafe/owner'] ?? '').includes('owner=team-cafe')) },
          docStep: 3,
          chips: 'ansible web -m ansible.builtin.lineinfile -a "path=/etc/cafe/owner line=owner=team-cafe create=true"',
          hints: { H1: bi('Ищите в разделе OPTIONS параметр типа bool. Без него модуль останавливается с ошибкой, если файла нет.', 'A bool parameter in OPTIONS; by default the module fails on a missing file.') },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Плейбук `site.yml` остановился на хостах группы web на задаче «nginx is running», потому что службы ещё не было. Исправлять ничего не нужно, потому что коллега уже поставил nginx вручную. Запустите плейбук **начиная с этой задачи**, не прогоняя предыдущие. В уроке такого ключа не было, поэтому найдите его в `ansible-playbook --help`.', 'The `site.yml` playbook failed on the web hosts at the task "nginx is running" because the service did not exist yet. Nothing needs fixing: a colleague already installed nginx by hand. Run the playbook **starting at that task**, without running the earlier ones. The lesson did not show this key: find it in `ansible-playbook --help`.'),
      ref: { page: 'help/ansible-playbook' },
      terminal: {
        setup: ansSetup({ 'inventory.ini': INV, 'site.yml': SITE_PLAY, 'templates/cafe.conf.j2': TEMPLATE }, [{ name: 'web1', packages: ['nginx'] }, { name: 'web2', packages: ['nginx'] }, { name: 'db1' }]),
        task: {
          id: 'start',
          prompt: bi('Прогон начался с задачи «nginx is running», а предыдущие задачи не выполнялись.', 'The run started at the task "nginx is running", and the earlier tasks did not run.'),
          check: { when: (f) => { const r = lastRun(f); return !!r && r.tasks.some((t) => t.task === 'nginx is running') && !r.tasks.some((t) => t.task === 'nginx is installed' || t.task === 'The site config is in place'); } },
          docStep: 4,
          beyond: true,
          solutionTokens: ['--start-at-task'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.idem', 'iac.q.handler', 'iac.q.check', 'iac.q.unreachable'] },
  ],
};

const tfLesson: Lesson = {
  id: 'iac.terraform',
  block: 'iac',
  title: bi('Как Terraform создаёт ресурсы облака по коду', 'How Terraform creates cloud resources from code'),
  summary: bi('Terraform создаёт по описанию то, чего ещё нет, например виртуальные машины, сети и DNS-записи, и перед любым изменением показывает план.', 'Terraform creates what does not exist yet: virtual machines, networks, DNS records — from a description and with a plan before any change.'),
  introduces: ['iac.resource', 'iac.provider', 'iac.plan'],
  uses: ['iac.iac', 'iac.idempotence'],
  tier: 'core',
  minutes: 40,
  sources: src([S.tofuIntro, S.tofuPlan, S.fowlerIac], [S.ruTerraform, S.ruIac]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Ansible настраивает серверы, которые уже есть, но для нового сервиса кафе нужны новые машины, сеть и DNS-запись. Если заказывать их кнопками в консоли облака, через полгода никто не вспомнит, кто создал машину web, почему у неё два ядра и какая запись на неё указывает. В этом уроке вы опишете ресурсы облака кодом и создадите их программой Terraform, которая перед каждым изменением показывает, какие изменения собирается сделать.',
        'Ansible configures servers that already exist, but the café’s new service needs new machines, a network and a DNS record. If you order them with buttons in the cloud console, in half a year nobody will remember who created the web machine, why it has two cores and which record points at it. In this lesson you describe cloud resources in code and create them with Terraform, which shows before every change what exactly it is about to do.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Прежде чем настраивать сервер, его нужно создать. В облаке сервер, сеть, DNS-запись и бакет, то есть хранилище для файлов, называются [[iac.resource|облачными ресурсами]]: каждый такой объект появляется, когда программа отправляет запрос к API облака. API — это вход в облако для программ: вместо того чтобы нажимать кнопки, программа отправляет облаку письменные запросы по сети и получает такие же письменные ответы, а подробно этот вход разобран в уроке «Как устроен API облака». Заказывать ресурсы кнопками в консоли значит снова работать вручную, как при настройке серверов по вики.\n\nTerraform и открытый проект OpenTofu, который отделился от Terraform и сохранил те же понятия и команды, описывают ресурсы на собственном языке конфигурации HCL (HashiCorp Configuration Language):\n\n```hcl\nresource "edu_vm" "web" {\n  name       = "web"\n  image      = "ubuntu-24.04"\n  cores      = 2\n  network_id = edu_network.main.id\n}\n```\n\nУ блока две метки: тип ресурса (`edu_vm`) и имя в коде (`web`), и вместе они образуют адрес `edu_vm.web`. Тип принадлежит [[iac.provider|провайдеру Terraform]], то есть плагину, который знает API одного облака. Здесь это учебное облако Edu Cloud с типами `edu_vm`, `edu_network` и `edu_dns_record`. Провайдеры объявляют в блоке `terraform { required_providers { … } }`, а скачивает их команда `terraform init`, которую запускают в каталоге один раз.\n\nСсылка `edu_network.main.id` подставляет не только значение: из неё Terraform узнаёт, что ВМ зависит от сети, и поэтому создаст сеть первой. Атрибуты, которые выдаёт облако, например `id` и `public_ip`, до создания ресурса никому не известны, и в плане вместо них написано `(known after apply)`.\n\nЧтобы после apply не искать нужное значение в облаке, его объявляют выводом, то есть блоком `output`: например, `output "site_ip" { value = edu_vm.web.public_ip }`. Terraform печатает выводы в конце apply, а команда `terraform output` показывает их в любой момент.\n\n### План и применение\n\nГлавная команда Terraform называется [[iac.plan|terraform plan]]. Она сравнивает код с тем, что уже создано, и отмечает разницу знаками: `+` означает создать, `~` изменить на месте, `-` удалить, а `-/+` пересоздать. Какой знак получит правка, решает облако: число ядер оно меняет у существующей машины, а образ, с которого машина загрузилась, поменять у неё не может, поэтому смена образа пересоздаёт машину. В конце план печатает итог, например `Plan: 3 to add, 0 to change, 0 to destroy.` Сам план ничего не меняет. Команда `terraform apply` строит тот же план, просит подтвердить его словом `yes` и выполняет запросами к API облака. Если запустить `apply` ещё раз, не меняя код, он покажет `No changes`, потому что Terraform тоже идемпотентен. Команда `terraform destroy` удаляет всё, что Terraform создал.',
        'Before a server can be configured, it has to be created. In a cloud a server, a network, a DNS record and a bucket, a storage for files, are called [[iac.resource|cloud resources]]: each such object appears when a program sends a request to the cloud API. An API is the entrance to the cloud for programs: instead of pressing buttons, a program sends the cloud written requests over the network and gets written answers back, and the lesson “How a cloud API works” takes this entrance apart in detail. Ordering resources with buttons in a console means working by hand again, as with setting servers up from a wiki.\n\nTerraform and the open project OpenTofu, which split off from Terraform and kept the same ideas and commands, describe resources in their own configuration language HCL (HashiCorp Configuration Language):\n\n```hcl\nresource "edu_vm" "web" {\n  name       = "web"\n  image      = "ubuntu-24.04"\n  cores      = 2\n  network_id = edu_network.main.id\n}\n```\n\nThe block has two labels: the resource type (`edu_vm`) and the name in the code (`web`); together they form the address `edu_vm.web`. The type belongs to a [[iac.provider|Terraform provider]], a plugin that knows the API of one cloud. Here it is the training cloud Edu Cloud with the types `edu_vm`, `edu_network` and `edu_dns_record`. Providers are declared in the `terraform { required_providers { … } }` block and downloaded by `terraform init`, which you run once in the directory.\n\nThe reference `edu_network.main.id` inserts more than a value: from it Terraform learns that the VM depends on the network and so creates the network first. Attributes the cloud assigns, such as `id` and `public_ip`, are unknown to anyone before the resource is created, and the plan shows `(known after apply)` in their place.\n\nSo that you need not look up a value in the cloud after apply, you declare it as an output, an `output` block: for example, `output "site_ip" { value = edu_vm.web.public_ip }`. Terraform prints outputs at the end of apply, and `terraform output` shows them at any time.\n\n### Plan and apply\n\nThe main Terraform command is [[iac.plan|terraform plan]]. It compares the code with what already exists and marks the difference with signs: `+` means create, `~` update in place, `-` destroy, and `-/+` replace. Which sign an edit gets is up to the cloud: it changes the number of cores on an existing machine, but it cannot change the image the machine booted from, so an image change recreates the machine. At the end the plan prints a total such as `Plan: 3 to add, 0 to change, 0 to destroy.` The plan itself changes nothing. `terraform apply` builds the same plan, asks you to confirm it with `yes` and carries it out with requests to the cloud API. If you run `apply` again without changing the code, it shows `No changes`, because Terraform is idempotent too. `terraform destroy` removes everything Terraform created.',
      ),
    },
    {
      id: 'callout',
      kind: 'callout',
      tone: 'note',
      body: bi('Терминал тренажёра не умеет отвечать на вопросы, которые задают программы. Поэтому подтверждение для apply передают командой `echo yes | terraform apply` или ключом `-auto-approve`, как это делают в CI.', 'The trainer terminal cannot answer program prompts. Pass the apply confirmation like this: `echo yes | terraform apply`, or with the `-auto-approve` key, as CI does.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: tfSetup(TF_HEAD + TF_NET + TF_VM),
      intro: bi('В файле `~/infra/main.tf` описаны сеть и ВМ в облаке Edu Cloud. Само облако пока пустое, и в этом можно убедиться командой `edu vm list`.', '`~/infra/main.tf` describes a network and a VM in Edu Cloud. The cloud is empty for now: check with `edu vm list`.'),
      tasks: [
        {
          id: 'apply',
          prompt: bi('Подготовьте каталог, посмотрите план и создайте сеть и ВМ.', 'Prepare the directory, look at the plan and create the network and the VM.'),
          check: { when: (f) => cloud(f).some((r) => r.type === 'edu_vm') && cloud(f).some((r) => r.type === 'edu_network') && (tf(f)?.state.length ?? 0) === 2, fail: [{ if: (f) => !tf(f)?.initialized, say: bi('Сначала выполните terraform init, который скачивает провайдер edu.', 'Run terraform init first: it downloads the edu provider.') }] },
          chips: 'terraform init && terraform plan',
          concepts: ['iac.provider', 'iac.plan'],
          docRef: { page: 'help/terraform', anchor: 'MAIN COMMANDS', line: 'init' },
          hints: { H1: bi('Выполните по очереди init, plan и apply, а apply подтвердите словом yes.', 'init → plan → apply (confirmed with yes).') },
        },
        {
          id: 'dns',
          prompt: bi('Добавьте в код DNS-запись, то есть ресурс `edu_dns_record` с именем `www` в зоне `site.edu`, значением которого служит публичный адрес ВМ. Запишите адрес ссылкой на атрибут ВМ, а не числом. Добавьте также вывод `site_ip` с тем же адресом и примените изменения.', 'Add a DNS record to the code, an `edu_dns_record` resource named `www` in the `site.edu` zone whose value is the VM’s public address. Write the address as a reference to the VM attribute, not as a number. Also add an output `site_ip` with the same address and apply the changes.'),
          check: {
            when: (f) => {
              const vm = cloud(f).find((r) => r.type === 'edu_vm');
              const rec = cloud(f).find((r) => r.type === 'edu_dns_record');
              const code = f.files[`${INFRA}/main.tf`]?.text ?? '';
              return !!vm && !!rec && rec.attrs.value === vm.attrs.public_ip && rec.attrs.name === 'www' && rec.attrs.zone === 'site.edu' && /edu_vm\.web\.public_ip/.test(code) && /output\s+"site_ip"/.test(code) && tf(f)?.state.length === 3;
            },
            fail: [{ if: (f) => /value\s*=\s*"203\.0\.113/.test(f.files[`${INFRA}/main.tf`]?.text ?? ''), say: bi('Адрес записан числом, поэтому, когда ВМ пересоздадут и адрес изменится, запись останется прежней. Сошлитесь на атрибут edu_vm.web.public_ip.', 'The address is written as a number: if the VM is recreated it changes and the record does not. Reference edu_vm.web.public_ip.') }],
          },
          chips: 'edit main.tf',
          concepts: ['iac.resource'],
          hints: { H1: bi('У записи три аргумента: zone, name и value, а значением value служит ссылка на атрибут ВМ.', 'Three arguments: zone, name, value. The value is a reference to a VM attribute.'), H2: bi('```hcl\nresource "edu_dns_record" "www" {\n  zone  = "site.edu"\n  name  = "www"\n  value = edu_vm.web.public_ip\n}\n\noutput "site_ip" {\n  value = edu_vm.web.public_ip\n}\n```', '```hcl\nresource "edu_dns_record" "www" {\n  zone  = "site.edu"\n  name  = "www"\n  value = edu_vm.web.public_ip\n}\n\noutput "site_ip" {\n  value = edu_vm.web.public_ip\n}\n```') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.symbols', 'iac.q.known-after', 'iac.q.self-ref'] },
  ],
};

export const APPLIED = [`cd ${INFRA} && terraform init && terraform apply -auto-approve && chown -R learner:learner ${INFRA}`];
const stateLesson: Lesson = {
  id: 'iac.state',
  block: 'iac',
  title: bi('State, дрейф и пересоздание ресурсов', 'State, drift and resource replacement'),
  summary: bi('Terraform знает об облаке только то, что записано в state, и каждый plan сравнивает три версии мира: код, state и облако.', 'Terraform knows about the cloud only what is written in the state, and every plan compares the code, the state and the cloud.'),
  introduces: ['iac.state', 'iac.drift'],
  uses: ['iac.plan', 'iac.resource'],
  tier: 'core',
  minutes: 35,
  sources: src([S.tofuState, S.tfDrift, S.tofuPlan], [S.ruTerraform, S.ruIac]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Ночью дежурный вручную поставил машине web четыре ядра в консоли облака, потому что сайт не справлялся с нагрузкой. Утром коллега запускает `terraform apply` ради другой правки и видит в плане, что Terraform собирается вернуть машине два ядра. Чтобы понять, откуда Terraform знает о ночной правке и что с ней делать, нужно разобраться, где он хранит память о созданных ресурсах.',
        'At night the on-call engineer gave the web machine four cores right in the cloud console, because the site could not cope with the load. In the morning a colleague runs `terraform apply` for a quite different edit and sees in the plan that Terraform is about to give the machine two cores again. To understand how Terraform knows about the night edit and what to do with it, you need to see where it keeps its memory of the resources it created.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Откуда Terraform знает, что машина `vm-4f66` в облаке и есть его `edu_vm.web`? Облако хранит ресурсы, но не знает, какая программа ими управляет. Код описывает, какими ресурсы должны быть, но не знает, какие они на самом деле. Связь между облаком и кодом хранит [[iac.state|state]], файл `terraform.tfstate`, в котором для каждого адреса записаны ID объекта в облаке и его последние известные атрибуты. Этот файл пишет `apply` после каждого созданного ресурса и при каждой записи увеличивает на единицу номер версии `serial`, а посмотреть его можно командами `terraform state list` и `terraform state show edu_vm.web`.\n\nПоэтому `plan` сравнивает три версии мира: код, state и то, что на самом деле есть в облаке. Сначала он выполняет **refresh**, то есть перечитывает из облака каждый ресурс, записанный в state. Потом он сравнивает код с обновлённым state. Если ресурса нет в state, план ставит знак `+`. Если ресурс есть, но отличается от кода, план ставит `~` или `-/+`. А если ресурс есть в state, но исчез из кода, план ставит `-`.\n\nЕсли кто-то поменял ресурс вручную в консоли облака, действительность разошлась с кодом, и такое расхождение называется [[iac.drift|дрейфом]]. Refresh замечает дрейф и пишет `Note: Objects have changed outside of Terraform`, а план предлагает вернуть всё так, как записано в коде, потому что код описывает желаемое состояние. Дальше решает человек. Он может отменить ручную правку командой `apply`, принять её, записав новое значение в код, или явно разрешить такие правки строкой `lifecycle { ignore_changes = [cores] }`.\n\nКак вы видели в прошлом уроке, образ работающей машины облако поменять не может, поэтому такой атрибут план помечает строкой `# forces replacement`, и Terraform удаляет ВМ и создаёт новую (знак `-/+`). Число ядер облако меняет у той же машины, хотя ради этого ненадолго её останавливает. Если сайт не должен оставаться без сервера, настройка `lifecycle { create_before_destroy = true }` меняет порядок: Terraform сначала создаёт новую машину и только потом удаляет старую (знак `+/-`).\n\nState дороже всего остального в каталоге Terraform. Если файл потерять, Terraform не тронет облако, но и не будет знать, какие ресурсы создал он, поэтому следующий plan предложит создать всё заново. Кроме того, в state лежат значения атрибутов, включая секреты. Поэтому, когда с кодом работают несколько человек, state хранят не на ноутбуке, а в общем хранилище с блокировкой и ограниченным доступом.',
        'How does Terraform know that the VM `vm-4f66` in the cloud is its `edu_vm.web`? The cloud stores resources but does not know who "owns" them. The code describes what they should be like but does not know what they are. The link between them is the [[iac.state|state]], the `terraform.tfstate` file: for every address it records the ID in the cloud and the last known attributes. `apply` writes it after every created resource and raises its version number `serial` by one on every write; `terraform state list` and `terraform state show edu_vm.web` let you look at it.\n\nSo `plan` compares three versions of the world. First a **refresh**: Terraform rereads from the cloud every resource recorded in the state. Then it compares the code with the refreshed state: a resource missing from the state is `+`; present but different is `~` or `-/+`; in the state but not in the code is `-`.\n\nIf someone changed a resource by hand in the cloud console, reality has diverged from the code: that is [[iac.drift|drift]]. The refresh notices it and prints `Note: Objects have changed outside of Terraform`, and the plan proposes to bring everything back to the code: the code is the desired state. Then a person decides: undo the manual edit (`apply`), accept it (change the code), or explicitly allow it (`lifecycle { ignore_changes = [cores] }`).\n\nNot everything can change in place. The cloud can change the number of cores in place, on the same machine, though it stops it briefly to do so, but not the VM image: such an attribute is marked `# forces replacement` in the plan, and Terraform deletes the VM and creates a new one (`-/+`). If downtime is not acceptable, `lifecycle { create_before_destroy = true }` reverses the order: the new one first, then the old one is removed (`+/-`).\n\nThe state is the most valuable thing in a Terraform directory. If it is lost, Terraform does not touch the cloud, but it no longer knows the resources are its own: the next plan proposes to create everything again. The state holds attribute values, secrets included. So a team keeps state not on a laptop but in remote storage with locking and limited access.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Что Terraform сверяет перед изменением', 'What Terraform checks before a change'),
      body: bi(
        'Схема ниже показывает один запуск `terraform apply` в каталоге из прошлого урока, где описаны сеть, машина edu_vm.web и DNS-запись. Сначала на ней только код и программа terraform. Остальные участники появляются, когда до них доходит запуск: внизу файл state, справа вверху API облака Edu Cloud, под ним сама машина vm-4f66, а ещё ниже дежурный, который может поменять машину в консоли. На каждом шаге видно, у кого Terraform берёт сведения и что он с ними делает. В конце под схемой появляется итог плана: сколько ресурсов создать, изменить и удалить и сколько секунд сайт останется без сервера.',
        'The diagram below shows one `terraform apply` run in the directory from the last lesson, which describes a network, the machine edu_vm.web and a DNS record. At first it shows only the code and the terraform program. The other participants appear when the run reaches them: the state file below, the Edu Cloud API at the top right, the machine vm-4f66 under it, and further down the on-call engineer who may change the machine in the console. At every step you see where Terraform takes its facts from and what it does with them. At the end the plan’s total appears under the diagram: how many resources to add, change and destroy, and how many seconds the site stays without a server.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'iac.tf-plan-apply', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен участник, который работает сейчас, облачко рядом с ним говорит, что он делает, а по линии движется карточка с тем, что он передаёт: адрес и ID из state, ответ облака или запрос на изменение машины. Жёлтая рамка означает разницу, которую план предложит исправить, зелёная рамка означает пройденный этап, а красная означает, что на этом шаге запуск остановился. Пунктирная линия от дежурного к машине обозначает правку в обход кода.\n\nПервый запуск показывает правку в коде, при которой число ядер меняется с 2 на 4. Потом выберите в «Параметрах» событие «дежурный поставил машине 4 ядра в консоли, а код остался прежним» и посмотрите, что план предложит сделать с его правкой. Выключите refresh и проверьте, заметит ли Terraform ту же правку. Затем выберите смену образа и сравните, сколько секунд сайт остаётся без сервера с настройкой create_before_destroy и без неё. Напоследок включите в блоке «Сломать» удаление файла state.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The participant working now is highlighted, the callout next to it says what it does, and a card moves along the line with what it hands on: an address and an ID from the state, the cloud’s answer or a request to change the machine. A yellow outline marks a difference the plan will propose to fix, a green one a passed stage, and a red one shows that the run stopped at this step. The dashed line from the on-call engineer to the machine marks an edit that bypasses the code.\n\nThe first run shows an edit in the code that changes the cores from 2 to 4. Then choose the event “the on-call engineer gave the machine 4 cores in the console, and the code stayed the same” in “Parameters” and see what the plan proposes to do with that edit. Switch refresh off and check whether Terraform notices the same edit. Then choose the image change and compare how many seconds the site stays without a server with create_before_destroy and without it. Finally, switch on the deletion of the state file in “Break it”.'), caption: bi('В задании ниже вы сами сыграете ночного дежурного: поменяете число ядер в консоли облака и увидите в плане ту же строку «Objects have changed outside of Terraform», что и на схеме. Затем вы решите, что делать с этой правкой, и переведёте машину на другой образ так, чтобы сайт не остался без сервера.', 'In the task below you play the night on-call engineer yourself: you change the cores in the cloud console and see in the plan the same line “Objects have changed outside of Terraform” as in the diagram. Then you decide what to do with the edit and move the machine to another image so that the site is never left without a server.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: tfSetup(TF_HEAD + TF_NET + TF_VM, APPLIED),
      intro: bi('Сеть и ВМ уже созданы этим кодом. Консолью облака здесь служит команда `edu`: например, `edu vm list` показывает машины, а `edu vm update ID --cores 4` меняет число ядер.', 'The network and the VM were already created by this code. The cloud console is the `edu` command: `edu vm list`, `edu vm update ID --cores 4`.'),
      tasks: [
        {
          id: 'drift',
          prompt: bi('Сыграйте роль ночного дежурного и через консоль облака поставьте ВМ 4 ядра. Потом убедитесь, что `terraform plan` замечает этот дрейф.', 'Play the night on-call engineer: set the VM to 4 cores through the cloud console. Check that `terraform plan` sees the drift.'),
          check: { when: (f) => cloud(f).some((r) => r.type === 'edu_vm' && r.attrs.cores === 4) && (tf(f)?.lastPlan?.drift ?? []).some((d) => d.addr === 'edu_vm.web') },
          chips: 'edu vm list',
          concepts: ['iac.drift'],
          hints: { H1: bi('ID машины покажет команда edu vm list или terraform state show edu_vm.web.', 'edu vm list or terraform state show edu_vm.web shows the VM ID.') },
        },
        {
          id: 'accept',
          prompt: bi('Команда решила оставить 4 ядра. Сделайте так, чтобы `terraform plan` показывал `No changes`, а в облаке ВМ осталась с 4 ядрами.', 'The team decided to keep 4 cores. Make `terraform plan` show `No changes` while the VM stays at 4 cores in the cloud.'),
          check: {
            when: (f) => cloud(f).some((r) => r.type === 'edu_vm' && r.attrs.cores === 4) && !!tf(f)?.lastPlan && tf(f)!.lastPlan!.add + tf(f)!.lastPlan!.change + tf(f)!.lastPlan!.destroy === 0,
            fail: [{ if: (f) => cloud(f).some((r) => r.type === 'edu_vm' && r.attrs.cores === 2), say: bi('Команда apply вернула машине 2 ядра, потому что Terraform привёл облако к коду. Чтобы принять ручную правку, поменяйте код.', 'apply brought back 2 cores: Terraform made the cloud match the code. To accept the manual edit, change the code.') }],
          },
          chips: 'terraform plan',
          concepts: ['iac.state'],
          hints: { H1: bi('Желаемое состояние описывает код, поэтому принять изменение значит записать его в код.', 'The desired state is the code. Accepting a change means writing it into the code.') },
        },
        {
          id: 'replace',
          prompt: bi('Переведите ВМ на образ `debian-13` так, чтобы новая ВМ создалась **до** удаления старой, и примените изменения.', 'Move the VM to the `debian-13` image so that the new VM is created **before** the old one is deleted. Apply.'),
          check: { when: (f) => cloud(f).some((r) => r.type === 'edu_vm' && r.attrs.image === 'debian-13') && (tf(f)?.lastPlan?.actions ?? []).some((a) => a.addr === 'edu_vm.web' && a.action === 'replace' && a.createBeforeDestroy) && !!tf(f)?.lastPlan?.applied },
          chips: 'terraform plan',
          docRef: { page: 'web/opentofu.org/language/lifecycle', anchor: 'create_before_destroy' },
          hints: { H1: bi('Смена образа требует пересоздать машину, а порядок пересоздания меняет блок lifecycle.', 'An image change means replacement. The lifecycle block changes the order.'), H2: bi('```hcl\n  lifecycle {\n    create_before_destroy = true\n  }\n```', '```hcl\n  lifecycle {\n    create_before_destroy = true\n  }\n```') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('ВМ работает со сбоями, и её нужно пересоздать, хотя код менять не нужно. Найдите в `terraform plan -help` ключ, который пересоздаёт конкретный ресурс без правки кода, и пересоздайте `edu_vm.web`.', 'The VM is stuck and behaves strangely; the code needs no change, but the VM must be recreated. Find in `terraform plan -help` the key that replaces a particular resource without editing the code, and replace `edu_vm.web`.'),
      ref: { page: 'help/terraform' },
      terminal: {
        setup: tfSetup(TF_HEAD + TF_NET + TF_VM, APPLIED),
        task: {
          id: 'replace-flag',
          prompt: bi('Ресурс edu_vm.web пересоздан, а код не менялся.', 'edu_vm.web is recreated, the code did not change.'),
          check: { when: (f) => (tf(f)?.lastPlan?.actions ?? []).some((a) => a.addr === 'edu_vm.web' && a.action === 'replace') && !!tf(f)?.lastPlan?.applied && (f.files[`${INFRA}/main.tf`]?.text ?? '') === TF_HEAD + TF_NET + TF_VM },
          docStep: 4,
          beyond: true,
          solutionTokens: ['-replace', '-replace=edu_vm.web'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.state-lost', 'iac.q.removed-block', 'iac.q.drift', 'iac.q.ans-vs-tf'] },
  ],
};

export const lessons: Lesson[] = [introLesson, playbookLesson, tfLesson, stateLesson];

export const block: Block = {
  id: 'iac',
  order: 80,
  title: bi('Инфраструктура как код на Ansible и Terraform', 'Infrastructure as code with Ansible and Terraform'),
  summary: bi('После этого блока вы настроите три сервера одной командой и создадите машины в облаке кодом, а не кнопками, и сможете объяснить, почему повторный запуск ничего не ломает. Об этом спрашивают почти на каждом собеседовании на должность DevOps-инженера. В части про Ansible вы узнаете, что такое инвентарь, модули, плейбуки, идемпотентность, обработчики, check mode, роли и приоритет переменных. В части про Terraform вы разберёте провайдеры, ресурсы, plan и apply, state, дрейф и пересоздание, переменные и модули, а также блоки moved и import и режим refresh-only.', 'After this block you will set up three servers with one command and create machines in a cloud with code rather than buttons, and you will be able to explain why a repeated run breaks nothing. Almost every DevOps job interview asks about this. In the Ansible part you learn inventories, modules, playbooks, idempotence, handlers, check mode, roles and variable precedence. In the Terraform part you work through providers, resources, plan and apply, state, drift and replacement, variables and modules, and the moved and import blocks and refresh-only mode.'),
  checklistStep: '06',
  levels: {
    beginner: bi('Не работал ни с Ansible, ни с Terraform и, может быть, впервые слышу эти названия', 'Has not worked with Ansible or Terraform and may be hearing the names for the first time'),
    intermediate: bi('Запускал готовый код, но сам его не писал', 'Has run ready-made code but not written it'),
    experienced: bi('Писал небольшие конфигурации, но не разбирался в state, ролях и идемпотентности', 'Has written small configs but has not looked into state, roles and idempotence'),
  },
  hours: { beginner: 29, intermediate: 19, experienced: 11 },
  lessons: lessons.map((l) => l.id),
  sources: src([S.fowlerIac, S.ansIntro, S.tofuState], [S.ruIac, S.ruAnsible, S.ruTerraform]),
  docSources: ['ansible-doc', 'help', 'terraform'],
  // The placement check lives in placement.ts, its own bank of tasks.
  placement: [],
};
