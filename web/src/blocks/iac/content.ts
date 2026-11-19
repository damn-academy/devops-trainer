// Block "IaC: Ansible and Terraform" (route id iac, 06 §4–5).
// Order of ideas: infrastructure as code → idempotence → inventory → module →
// playbook → handler → check mode → cloud resource and provider → plan/apply →
// state → drift.

import { bi } from '../../core/i18n';
import type { Block, Concept, Facts, Lesson, PlacementTask, QuizItem, Sources, TerminalSetup } from '../../core/types';
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
  { id: 'iac.idempotence', term: bi('идемпотентность', 'idempotence'), forms: { ru: ['идемпотентности', 'идемпотентный', 'идемпотентным', 'идемпотентна', 'идемпотентен'], en: ['idempotent'] }, short: bi('Свойство операции: повторный запуск даёт тот же результат и ничего не меняет, если цель уже достигнута.', 'A property of an operation: running it again gives the same result and changes nothing if the goal is already reached.'), introducedIn: 'iac.ansible-intro' },
  { id: 'iac.inventory', term: bi('инвентарь', 'inventory'), forms: { ru: ['инвентаря', 'инвентарём', 'инвентаре'] }, scan: false, short: bi('Файл со списком управляемых хостов и их групп; из него Ansible знает, кого настраивать.', 'A file listing managed hosts and their groups; it tells Ansible whom to configure.'), introducedIn: 'iac.ansible-intro' },
  { id: 'iac.module', term: bi('модуль Ansible', 'Ansible module'), forms: { ru: ['модуля Ansible', 'модули Ansible', 'модулем Ansible'], en: ['Ansible modules'] }, short: bi('Небольшая программа, которую Ansible запускает на хосте: она сравнивает желаемое состояние с текущим и отвечает ok или changed.', 'A small program Ansible runs on a host: it compares the desired state with the current one and answers ok or changed.'), introducedIn: 'iac.ansible-intro', docRef: { page: 'ansible-doc/ansible.builtin.apt', anchor: 'OPTIONS' } },
  { id: 'iac.playbook', term: bi('плейбук', 'playbook'), forms: { ru: ['плейбука', 'плейбуке', 'плейбуком', 'плейбуки', 'плейбуков'], en: ['playbooks'] }, short: bi('YAML-файл с плеями: какие хосты и какие задачи в каком порядке.', 'A YAML file of plays: which hosts and which tasks in which order.'), introducedIn: 'iac.playbook' },
  { id: 'iac.handler', term: bi('handler', 'handler'), forms: { en: ['handlers'] }, scan: false, short: bi('Задача, которая выполняется один раз в конце плея, только если её уведомила (notify) изменившаяся задача.', 'A task that runs once at the end of a play, only if a task that changed something notified it.'), introducedIn: 'iac.playbook' },
  { id: 'iac.check-mode', term: bi('check mode', 'check mode'), short: bi('Прогон с --check: модули сообщают, что изменили бы, ничего не меняя.', 'A run with --check: modules report what they would change without changing anything.'), introducedIn: 'iac.playbook' },
  { id: 'iac.resource', term: bi('облачный ресурс', 'cloud resource'), forms: { ru: ['облачного ресурса', 'облачные ресурсы', 'облачных ресурсов'], en: ['cloud resources'] }, short: bi('Объект в облаке, созданный вызовом его API: виртуальная машина, сеть, DNS-запись.', 'An object in a cloud created by a call to its API: a virtual machine, a network, a DNS record.'), introducedIn: 'iac.terraform' },
  { id: 'iac.provider', term: bi('провайдер Terraform', 'Terraform provider'), forms: { ru: ['провайдера Terraform'] }, short: bi('Плагин, который переводит блоки resource в вызовы API конкретного облака.', 'A plugin that turns resource blocks into API calls of a particular cloud.'), introducedIn: 'iac.terraform' },
  { id: 'iac.plan', term: bi('terraform plan', 'terraform plan'), scan: false, short: bi('Расчёт разницы между кодом и известным состоянием мира: + создать, ~ изменить, - удалить, -/+ пересоздать.', 'The computed difference between the code and the known state of the world: + create, ~ update, - destroy, -/+ replace.'), introducedIn: 'iac.terraform', docRef: { page: 'help/terraform', anchor: 'USAGE' } },
  { id: 'iac.state', term: bi('state', 'state'), scan: false, short: bi('Файл terraform.tfstate: связь «адрес в коде ↔ ID в облаке» и последние известные атрибуты ресурсов.', 'The terraform.tfstate file: the link "address in code ↔ ID in the cloud" and the last known attributes of resources.'), introducedIn: 'iac.state' },
  { id: 'iac.drift', term: bi('дрейф', 'drift'), forms: { ru: ['дрейфа', 'дрейфом', 'дрейфе'] }, short: bi('Расхождение реальной инфраструктуры с кодом из-за изменений мимо него — например, руками в консоли.', 'A mismatch between real infrastructure and the code caused by changes behind its back, such as by hand in a console.'), introducedIn: 'iac.state' },
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

// ── quiz ──

export const quiz: QuizItem[] = [
  {
    id: 'iac.q.why',
    kind: 'mcq',
    concepts: ['iac.iac'],
    prompt: bi('Пять серверов настраивали вручную по одной инструкции. Через полгода они отличаются друг от друга. Что решает инфраструктура как код?', 'Five servers were set up by hand from one guide. Half a year later they differ from each other. What does infrastructure as code solve?'),
    options: [
      { id: 'desc', text: bi('Желаемое состояние записано в файлах и применяется программой одинаково ко всем, а изменения видны в истории Git', 'The desired state is written in files and applied by a program the same way to all, and changes are visible in the Git history'), correct: true },
      { id: 'faster', text: bi('Серверы начинают работать быстрее', 'The servers start working faster'), why: bi('Скорость серверов тут ни при чём: речь о повторяемости настройки.', 'Server speed has nothing to do with it: the point is repeatable setup.') },
      { id: 'backup', text: bi('Появляется резервная копия серверов', 'You get a backup of the servers'), why: bi('Код описывает настройку, а не данные. Резервные копии — отдельная задача.', 'The code describes the setup, not the data. Backups are a separate task.') },
    ],
  },
  {
    id: 'iac.q.idem',
    kind: 'multi',
    concepts: ['iac.idempotence'],
    prompt: bi('Какие задачи идемпотентны — второй запуск ничего не меняет? Отметьте все.', 'Which tasks are idempotent, so that a second run changes nothing? Mark all.'),
    options: [
      { id: 'apt', text: 'apt: name=nginx state=present', correct: true },
      { id: 'line', text: 'lineinfile: path=/etc/motd line="Managed by Ansible"', correct: true },
      { id: 'svc', text: 'service: name=nginx state=started', correct: true },
      { id: 'echo', text: 'shell: echo "Managed by Ansible" >> /etc/motd', why: bi('>> дописывает строку при каждом запуске: файл растёт, задача всегда changed.', '>> appends the line on every run: the file grows and the task is always changed.') },
      { id: 'restart', text: 'service: name=nginx state=restarted', why: bi('restarted — действие, а не состояние: сервис перезапускается каждый раз.', 'restarted is an action, not a state: the service restarts every time.') },
    ],
  },
  {
    id: 'iac.q.inventory',
    kind: 'predict-output',
    concepts: ['iac.inventory'],
    prompt: bi('Инвентарь: `[web]` web1, web2; `[db]` db1. Что выведет `ansible-inventory --graph`?', 'The inventory: `[web]` web1, web2; `[db]` db1. What does `ansible-inventory --graph` print?'),
    command: 'ansible-inventory -i inventory.ini --graph',
    setup: ansSetup({ 'inventory.ini': INV }),
    explain: bi('Каждый хост входит в группу all; группы — способ выбрать хосты в плее (hosts: web).', 'Every host belongs to the all group; groups are a way to pick hosts in a play (hosts: web).'),
  },
  {
    id: 'iac.q.ok-changed',
    kind: 'match',
    concepts: ['iac.module'],
    prompt: bi('Что ответит модуль?', 'What will the module answer?'),
    pairs: [
      { id: 'a', left: bi('apt: nginx, пакет уже стоит', 'apt: nginx, the package is already installed'), right: 'ok' },
      { id: 'b', left: bi('apt: nginx, пакета нет', 'apt: nginx, the package is missing'), right: 'changed' },
      { id: 'c', left: bi('apt: ngnix (опечатка)', 'apt: ngnix (a typo)'), right: 'failed', why: bi('No package matching \'ngnix\' is available — модуль не может достичь состояния.', 'No package matching \'ngnix\' is available: the module cannot reach the state.') },
      { id: 'd', left: bi('хост выключен', 'the host is down'), right: 'unreachable' },
    ],
  },
  {
    id: 'iac.q.handler',
    kind: 'mcq',
    concepts: ['iac.handler'],
    prompt: bi('Три задачи меняют конфиг nginx, и каждая делает `notify: Reload nginx`. Все три — changed. Сколько раз выполнится handler на хосте?', 'Three tasks change the nginx config, and each does `notify: Reload nginx`. All three are changed. How many times does the handler run on the host?'),
    options: [
      { id: 'one', text: bi('Один раз, в конце плея', 'Once, at the end of the play'), correct: true },
      { id: 'three', text: bi('Три раза, после каждой задачи', 'Three times, after each task'), why: bi('Handler — очередь, а не вызов: уведомления складываются, выполнение одно.', 'A handler is a queue, not a call: notifications pile up, it runs once.') },
      { id: 'zero', text: bi('Ни разу: handlers запускают вручную', 'Never: handlers are run by hand'), why: bi('Handler запускает сам Ansible, если пришло уведомление от changed-задачи.', 'Ansible runs the handler itself when a changed task notified it.') },
    ],
  },
  {
    id: 'iac.q.check',
    kind: 'mcq',
    concepts: ['iac.check-mode'],
    prompt: bi('Что делает `ansible-playbook --check site.yml`?', 'What does `ansible-playbook --check site.yml` do?'),
    options: [
      { id: 'predict', text: bi('Прогоняет задачи, но модули только сообщают, что изменили бы', 'Runs the tasks, but modules only report what they would change'), correct: true },
      { id: 'syntax', text: bi('Только проверяет синтаксис YAML', 'Only checks the YAML syntax'), why: bi('Для синтаксиса есть --syntax-check. --check идёт на хосты и сравнивает состояние.', 'There is --syntax-check for syntax. --check goes to the hosts and compares state.') },
      { id: 'safe', text: bi('Применяет изменения, но с откатом при ошибке', 'Applies changes but rolls back on error'), why: bi('Отката в Ansible нет; --check вообще ничего не применяет.', 'Ansible has no rollback; --check applies nothing at all.') },
    ],
    explain: bi('Учтите: в check mode пакет не ставится по-настоящему, поэтому следующая задача, которой он нужен, может упасть.', 'Note: in check mode a package is not really installed, so a later task that needs it may fail.'),
  },
  {
    id: 'iac.q.symbols',
    kind: 'match',
    concepts: ['iac.plan'],
    prompt: bi('Какой символ покажет terraform plan?', 'Which symbol does terraform plan show?'),
    pairs: [
      { id: 'new', left: bi('новый ресурс в коде', 'a new resource in the code'), right: '+' },
      { id: 'cores', left: bi('изменили cores у ВМ', 'cores of a VM changed'), right: '~' },
      { id: 'image', left: bi('изменили image у ВМ', 'image of a VM changed'), right: '-/+', why: bi('Образ нельзя поменять на месте: «# forces replacement».', 'The image cannot change in place: "# forces replacement".') },
      { id: 'gone', left: bi('ресурс удалили из кода', 'a resource was removed from the code'), right: '-' },
    ],
  },
  {
    id: 'iac.q.known-after',
    kind: 'mcq',
    concepts: ['iac.plan'],
    prompt: bi('Почему в плане создания ВМ `public_ip = (known after apply)`?', 'Why does a VM creation plan show `public_ip = (known after apply)`?'),
    options: [
      { id: 'cloud', text: bi('Адрес выдаёт облако при создании; до вызова API его никто не знает', 'The cloud assigns the address on creation; nobody knows it before the API call'), correct: true },
      { id: 'bug', text: bi('Terraform не смог прочитать конфигурацию', 'Terraform could not read the configuration'), why: bi('Это не ошибка: так показываются вычисляемые облаком атрибуты.', 'It is not an error: that is how attributes computed by the cloud are shown.') },
      { id: 'var', text: bi('Нужно задать адрес переменной', 'You must set the address with a variable'), why: bi('public_ip — атрибут только для чтения: его нельзя задать в коде.', 'public_ip is read-only: it cannot be set in the code.') },
    ],
  },
  {
    id: 'iac.q.state-lost',
    kind: 'mcq',
    concepts: ['iac.state'],
    prompt: bi('Файл terraform.tfstate удалили, ВМ в облаке работают. Что покажет `terraform plan`?', 'terraform.tfstate was deleted, the VMs run in the cloud. What does `terraform plan` show?'),
    options: [
      { id: 'create', text: bi('Создать все ресурсы заново', 'Create every resource again'), correct: true },
      { id: 'nochange', text: bi('No changes', 'No changes'), why: bi('Terraform знает свои ресурсы только по state. Без него он не видит, что ВМ — его.', 'Terraform knows its resources only through the state. Without it, it does not see the VMs are its own.') },
      { id: 'delete', text: bi('Удалить ВМ из облака', 'Delete the VMs from the cloud'), why: bi('Удалять можно только то, что есть в state. Без state удалять нечего.', 'Only what is in the state can be destroyed. Without state there is nothing to destroy.') },
    ],
    explain: bi('Поэтому state хранят удалённо, с блокировкой и резервными копиями, а доступ к нему ограничивают: в нём лежат атрибуты, включая секреты.', 'That is why state is kept remotely, with locking and backups, and access to it is limited: it holds attributes, secrets included.'),
  },
  {
    id: 'iac.q.drift',
    kind: 'order',
    concepts: ['iac.drift'],
    prompt: bi('В консоли облака cores ВМ сменили 2 → 4, код не трогали. Расставьте по порядку, что делает `terraform plan`.', 'In the cloud console the VM cores were changed 2 → 4, the code is untouched. Put in order what `terraform plan` does.'),
    steps: [
      { id: 'read', text: bi('читает код и state', 'reads the code and the state') },
      { id: 'refresh', text: bi('спрашивает облако о каждом ресурсе из state', 'asks the cloud about every resource from the state') },
      { id: 'note', text: bi('пишет «Objects have changed outside of Terraform»', 'prints "Objects have changed outside of Terraform"') },
      { id: 'plan', text: bi('предлагает ~ cores = 4 -> 2', 'proposes ~ cores = 4 -> 2'), why: bi('Код — желаемое состояние: план возвращает облако к коду, если вы не изменили код или не добавили ignore_changes.', 'The code is the desired state: the plan brings the cloud back to the code unless you change the code or add ignore_changes.') },
    ],
  },
  {
    id: 'iac.q.ans-vs-tf',
    kind: 'match',
    concepts: ['iac.state', 'iac.module'],
    prompt: bi('Ansible или Terraform?', 'Ansible or Terraform?'),
    pairs: [
      { id: 'pkg', left: bi('поставить nginx на 30 готовых серверов', 'install nginx on 30 existing servers'), right: 'Ansible' },
      { id: 'vm', left: bi('заказать в облаке 3 ВМ, сеть и DNS-записи', 'order 3 VMs, a network and DNS records from a cloud'), right: 'Terraform' },
      { id: 'mem', left: bi('хранит state — память о созданных ресурсах', 'keeps state, a memory of created resources'), right: 'Terraform', why: bi('Ansible каждый раз смотрит на хосты заново и ничего между прогонами не хранит.', 'Ansible looks at the hosts afresh every time and keeps nothing between runs.') },
    ],
  },
];

// ── lessons ──

const introLesson: Lesson = {
  id: 'iac.ansible-intro',
  block: 'iac',
  title: bi('Инфраструктура как код и первый Ansible', 'Infrastructure as code and the first Ansible'),
  summary: bi('Описать, каким должен быть сервер, и дать программе привести его к описанию — столько раз, сколько нужно.', 'Describe what a server should be like and let a program bring it there, as many times as needed.'),
  introduces: ['iac.iac', 'iac.idempotence', 'iac.inventory', 'iac.module'],
  uses: [],
  tier: 'core',
  minutes: 35,
  sources: src([S.fowlerIac, S.ansIntro, S.ansInv], [S.ruIac, S.ruAnsible, S.ruIdem]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'У кафе теперь три сервера, и каждый настраивали по инструкции из вики. На одном nginx 1.22, на другом 1.26, на третьем кто-то поправил конфиг руками «временно» год назад. Что именно стоит на серверах, не знает никто, а новый сервер настраивается полдня и снова чуть иначе.',
        'The café now has three servers, and each was set up from a wiki guide. One has nginx 1.22, another 1.26, and on the third someone edited the config by hand "temporarily" a year ago. Nobody knows exactly what runs on the servers, and a new server takes half a day to set up and again comes out a little different.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        '[[iac.iac|Инфраструктура как код]] — способ работы, при котором инструкция «что сделать» заменяется описанием «каким должно быть»: пакет nginx установлен, файл конфигурации такой-то, сервис запущен. Описание лежит в репозитории, как код приложения, проходит ревью и пайплайн, а применяет его программа — одинаково к одному серверу и к сотне.\n\nКлючевое свойство такой программы — [[iac.idempotence|идемпотентность]]: её можно запускать сколько угодно раз, и если сервер уже в нужном состоянии, ничего не изменится. Инструкция «добавь строку в файл» при повторе добавит вторую строку; описание «строка в файле есть» при повторе просто проверит, что она есть. Поэтому описание можно применять и для первой настройки, и для проверки «не уехал ли сервер».\n\n### Ansible\n\nAnsible — инструмент для настройки серверов, которые уже существуют. На серверы ничего не ставится заранее: Ansible заходит на них по SSH, копирует маленькую программу на Python и запускает её. Кого настраивать, он узнаёт из [[iac.inventory|инвентаря]] — файла со списком хостов и групп:\n\n```ini\n[web]\nweb1\nweb2\n\n[db]\ndb1\n```\n\nРаботу на хосте делает [[iac.module|модуль Ansible]]: `ansible.builtin.apt` ставит пакеты, `ansible.builtin.copy` раскладывает файлы, `ansible.builtin.service` управляет сервисами. Модуль сначала смотрит, как есть, потом сравнивает с тем, как надо, и меняет только разницу. Его ответ — **ok** (уже так), **changed** (изменил), **failed** (не смог). Модули называют полным именем — коллекция и имя: `ansible.builtin.apt`. Справку по любому модулю показывает `ansible-doc ansible.builtin.apt`.\n\nОдну задачу можно выполнить прямо из терминала: `ansible web -m ansible.builtin.ping` проверяет, что до хостов группы web можно достучаться и на них есть Python, а `ansible web -m ansible.builtin.apt -a "name=nginx state=present"` ставит пакет.',
        '[[iac.iac|Infrastructure as code]] is a way of working in which the instruction "what to do" is replaced by a description of "what it should be like": the nginx package is installed, the config file is this, the service is running. The description lives in a repository like application code, goes through review and a pipeline, and a program applies it, the same way to one server and to a hundred.\n\nThe key property of such a program is [[iac.idempotence|idempotence]]: you can run it as many times as you like, and if the server is already in the desired state, nothing changes. The instruction "add a line to the file" adds a second line when repeated; the description "the line is in the file" just checks that it is there. So the description works both for the first setup and for checking that a server has not drifted away.\n\n### Ansible\n\nAnsible is a tool for configuring servers that already exist. Nothing is installed on them in advance: Ansible logs in over SSH, copies a small Python program and runs it. It learns whom to configure from an [[iac.inventory|inventory]], a file listing hosts and groups:\n\n```ini\n[web]\nweb1\nweb2\n\n[db]\ndb1\n```\n\nThe work on a host is done by an [[iac.module|Ansible module]]: `ansible.builtin.apt` installs packages, `ansible.builtin.copy` lays out files, `ansible.builtin.service` manages services. A module first looks at how things are, compares that with how they should be, and changes only the difference. Its answer is **ok** (already so), **changed** (changed it), **failed** (could not). Modules are named in full, collection and name: `ansible.builtin.apt`. `ansible-doc ansible.builtin.apt` shows the help for any module.\n\nA single task can be run straight from the terminal: `ansible web -m ansible.builtin.ping` checks that the hosts of the web group are reachable and have Python, and `ansible web -m ansible.builtin.apt -a "name=nginx state=present"` installs a package.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ansSetup({}, [{ name: 'web1' }, { name: 'web2' }, { name: 'db1' }]),
      intro: bi('Управляющая машина и три хоста: web1, web2, db1. В `~/ops/ansible.cfg` указано, что инвентарь — `./inventory.ini`, но самого файла ещё нет.', 'A control machine and three hosts: web1, web2, db1. `~/ops/ansible.cfg` says the inventory is `./inventory.ini`, but the file does not exist yet.'),
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
          hints: { H1: bi('Секции [web] и [db], по хосту на строку; затем ansible all -m … ping.', 'Sections [web] and [db], one host per line; then ansible all -m … ping.') },
        },
        {
          id: 'nginx',
          prompt: bi('Установите nginx на хосты группы `web` одной ad-hoc командой. Затем выполните ту же команду ещё раз и убедитесь, что второй раз ничего не меняется.', 'Install nginx on the hosts of the `web` group with one ad-hoc command. Then run the same command again and see that nothing changes the second time.'),
          check: {
            when: (f) => !!host(f, 'web1')?.packages.includes('nginx') && !!host(f, 'web2')?.packages.includes('nginx') && !host(f, 'db1')?.packages.includes('nginx') && /web1 \| SUCCESS/.test((f.term.main ?? []).at(-1)?.out ?? ''),
            fail: [{ if: (f) => !!host(f, 'db1')?.packages.includes('nginx'), say: bi('nginx попал и на db1: шаблон хостов должен быть web, а не all.', 'nginx also landed on db1: the host pattern must be web, not all.') }],
          },
          chips: 'ansible web -m ansible.builtin.apt -a "name=nginx state=present"',
          concepts: ['iac.module', 'iac.idempotence'],
          docRef: { page: 'ansible-doc/ansible.builtin.apt', anchor: 'OPTIONS', line: 'state' },
          hints: { H1: bi('Модуль apt, параметры name и state.', 'The apt module, the name and state parameters.'), H2: bi('Первый запуск ответит CHANGED, второй — SUCCESS: пакет уже стоит.', 'The first run answers CHANGED, the second SUCCESS: the package is already there.') },
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
  title: bi('Плейбук, handlers и проверка без изменений', 'Playbooks, handlers and a run without changes'),
  summary: bi('Плейбук описывает состояние группы хостов; правильный плейбук на втором прогоне показывает changed=0.', 'A playbook describes the state of a group of hosts; a correct playbook shows changed=0 on the second run.'),
  introduces: ['iac.playbook', 'iac.handler', 'iac.check-mode'],
  uses: ['iac.module', 'iac.idempotence', 'iac.inventory'],
  tier: 'core',
  minutes: 40,
  sources: src([S.ansPlay, S.ansHandlers, S.ansCheck], [S.ruAnsible, S.ruHabrAnsible]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Ad-hoc команда — одна задача. Настройка сервера — это десятки задач в определённом порядке, и их записывают в [[iac.playbook|плейбук]]: YAML-файл со списком плеев. Плей говорит, на каких хостах (`hosts: web`) и какие задачи выполнить; задача — это имя и модуль с параметрами:\n\n```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  tasks:\n    - name: nginx is installed\n      ansible.builtin.apt:\n        name: nginx\n        state: present\n```\n\nЗапуск — `ansible-playbook site.yml`. Перед задачами Ansible собирает факты (Gathering Facts): семейство ОС, адреса, память — их можно использовать в условиях `when:` и шаблонах. Каждая задача проходит все хосты, прежде чем начнётся следующая. В конце — PLAY RECAP: по каждому хосту сколько задач ok, changed, failed.\n\nМодуль `ansible.builtin.template` раскладывает файл из шаблона Jinja2: `{{ inventory_hostname }}` подставит имя хоста, `{{ http_port | default(80) }}` — переменную или значение по умолчанию.\n\n### Handlers\n\nПосле изменения конфига nginx нужно перечитать — но только если конфиг действительно изменился. Для этого есть [[iac.handler|handler]]: задача, которую уведомляют `notify: Reload nginx`. Уведомление срабатывает, только если задача была changed, а сам handler выполняется один раз в конце плея, сколько бы задач его ни уведомили. Если хост упал на одной из задач, до handlers он не дойдёт.\n\n### Проверка без изменений\n\nДва прогона подряд — главный тест плейбука: на втором всё должно быть ok, changed=0. Если какая-то задача changed при каждом прогоне, плейбук описывает не состояние, а действие. Типичный виновник — `ansible.builtin.shell` или `command`: они не знают, каким должен быть результат, и всегда отвечают changed. Замените их модулем состояния (`lineinfile`, `copy`, `service`) или подскажите Ansible ключами `creates:` и `changed_when:`.\n\nА перед прогоном на живых серверах полезен [[iac.check-mode|check mode]]: `ansible-playbook --check --diff site.yml` проходит все задачи, но модули только сообщают, что изменили бы, и показывают разницу файлов.',
        'An ad-hoc command is one task. Setting up a server means dozens of tasks in a certain order, and they are written into a [[iac.playbook|playbook]]: a YAML file with a list of plays. A play says on which hosts (`hosts: web`) and which tasks to run; a task is a name and a module with arguments:\n\n```yaml\n- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  tasks:\n    - name: nginx is installed\n      ansible.builtin.apt:\n        name: nginx\n        state: present\n```\n\nYou run it with `ansible-playbook site.yml`. Before the tasks Ansible gathers facts (Gathering Facts): the OS family, addresses, memory; they can be used in `when:` conditions and templates. Each task goes through all hosts before the next one starts. At the end comes the PLAY RECAP: for every host, how many tasks were ok, changed, failed.\n\nThe `ansible.builtin.template` module lays out a file from a Jinja2 template: `{{ inventory_hostname }}` inserts the host name, `{{ http_port | default(80) }}` a variable or a default value.\n\n### Handlers\n\nAfter changing the nginx config, nginx must reload it, but only if the config really changed. That is what a [[iac.handler|handler]] is for: a task that is notified with `notify: Reload nginx`. The notification fires only if the task was changed, and the handler itself runs once at the end of the play, however many tasks notified it. If a host failed on one of the tasks, it does not get to the handlers.\n\n### A run without changes\n\nTwo runs in a row are the main test of a playbook: on the second everything must be ok, changed=0. If some task is changed on every run, the playbook describes an action, not a state. The usual culprit is `ansible.builtin.shell` or `command`: they do not know what the result should be and always answer changed. Replace them with a state module (`lineinfile`, `copy`, `service`) or give Ansible a hint with `creates:` and `changed_when:`.\n\nBefore a run on live servers, [[iac.check-mode|check mode]] is useful: `ansible-playbook --check --diff site.yml` goes through all tasks, but modules only report what they would change and show the file differences.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'iac.ansible-run', caption: bi('Переключите способ записи строки на shell и прогоните второй и третий раз.', 'Switch the way of writing the line to shell and do a second and a third run.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ansSetup({ 'inventory.ini': INV + '\n[web:vars]\nhttp_port=8080\n', 'site.yml': SITE_PLAY, 'templates/cafe.conf.j2': TEMPLATE }),
      intro: bi('В `~/ops` готовый плейбук `site.yml` для группы web и шаблон `templates/cafe.conf.j2`.', '`~/ops` holds a ready playbook `site.yml` for the web group and a template `templates/cafe.conf.j2`.'),
      tasks: [
        {
          id: 'run',
          prompt: bi('Прогоните плейбук. На web1 и web2 должен появиться `/etc/nginx/sites-enabled/cafe.conf` с портом из переменной группы.', 'Run the playbook. web1 and web2 must get `/etc/nginx/sites-enabled/cafe.conf` with the port from the group variable.'),
          check: { when: (f) => ['web1', 'web2'].every((h) => (host(f, h)?.files['/etc/nginx/sites-enabled/cafe.conf'] ?? '').includes('listen 8080;')) && (lastRun(f)?.tasks.some((t) => t.handler && t.status === 'changed') ?? false) },
          chips: 'ansible-playbook site.yml',
          concepts: ['iac.playbook', 'iac.handler'],
          hints: { H1: bi('ansible-playbook и имя файла.', 'ansible-playbook and the file name.') },
        },
        {
          id: 'idem',
          prompt: bi('Прогоните ещё раз: одна задача по-прежнему changed, и `/etc/motd` растёт. Перепишите её так, чтобы повторный прогон давал changed=0 на всех хостах, а строка `Managed by Ansible` в motd была.', 'Run it again: one task is still changed and `/etc/motd` keeps growing. Rewrite it so that a repeated run gives changed=0 on all hosts and the line `Managed by Ansible` is in motd.'),
          check: {
            when: (f) => {
              const last = lastRun(f);
              const prev = runs(f).at(-2);
              const once = ['web1', 'web2'].every((h) => (host(f, h)?.files['/etc/motd'] ?? '').includes('Managed by Ansible'));
              const motdTask = (f.files[`${OPS}/site.yml`]?.text ?? '').match(/- name: The motd[^\n]*\n\s+([\w.]+):/);
              return !!last && !last.check && Object.values(last.recap).every((r) => r.changed === 0 && r.failed === 0) && !!prev && once && !!motdTask && !/shell|command/.test(motdTask[1]);
            },
            fail: [
              { if: (f) => /The motd[\s\S]*?shell/.test(f.files[`${OPS}/site.yml`]?.text ?? ''), say: bi('shell не знает, каким должен быть файл, и всегда changed. Нужен модуль, который описывает строку в файле.', 'shell does not know what the file should be like and is always changed. You need a module that describes a line in a file.') },
            ],
          },
          chips: 'ansible-doc ansible.builtin.lineinfile',
          concepts: ['iac.idempotence'],
          docRef: { page: 'ansible-doc/ansible.builtin.lineinfile', anchor: 'OPTIONS', line: 'regexp' },
          hints: { H1: bi('Задача должна описывать «строка в файле есть», а не «допиши строку».', 'The task must describe "the line is in the file", not "append a line".'), H2: bi('```yaml\n      ansible.builtin.lineinfile:\n        path: /etc/motd\n        regexp: "^Managed by Ansible"\n        line: Managed by Ansible\n```', '```yaml\n      ansible.builtin.lineinfile:\n        path: /etc/motd\n        regexp: "^Managed by Ansible"\n        line: Managed by Ansible\n```') },
        },
        {
          id: 'check',
          prompt: bi('Поменяйте в шаблоне `root` на `/var/www/cafe-v2` и посмотрите, что изменится, **не меняя** хосты: прогон в check mode с показом разницы.', 'Change `root` in the template to `/var/www/cafe-v2` and see what would change **without touching** the hosts: a check-mode run that shows the difference.'),
          check: { when: (f) => !!lastRun(f)?.check && (f.files[`${OPS}/templates/cafe.conf.j2`]?.text ?? '').includes('cafe-v2') && !(host(f, 'web1')?.files['/etc/nginx/sites-enabled/cafe.conf'] ?? '').includes('cafe-v2') && /\+\s*root \/var\/www\/cafe-v2;/.test((f.term.main ?? []).at(-1)?.out ?? '') },
          chips: 'ansible-playbook --check --diff site.yml',
          concepts: ['iac.check-mode'],
          hints: { H1: bi('Два ключа: один не меняет хосты, другой показывает разницу файлов.', 'Two keys: one does not touch the hosts, the other shows file differences.') },
        },
      ],
    },
    {
      id: 'findopt',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Файла `/etc/cafe/owner` на хостах нет. Найдите в `ansible-doc ansible.builtin.lineinfile` параметр, который создаёт файл, если его нет, и одной ad-hoc командой запишите в него на группе web строку `owner=team-cafe`.', 'The file `/etc/cafe/owner` does not exist on the hosts. Find in `ansible-doc ansible.builtin.lineinfile` the parameter that creates the file if it is missing, and with one ad-hoc command write the line `owner=team-cafe` into it on the web group.'),
      ref: { page: 'ansible-doc/ansible.builtin.lineinfile', anchor: 'OPTIONS', line: 'create' },
      terminal: {
        setup: ansSetup({ 'inventory.ini': INV }),
        task: {
          id: 'create',
          prompt: bi('На web1 и web2 есть /etc/cafe/owner со строкой owner=team-cafe.', 'web1 and web2 have /etc/cafe/owner with the line owner=team-cafe.'),
          check: { when: (f) => ['web1', 'web2'].every((h) => (host(f, h)?.files['/etc/cafe/owner'] ?? '').includes('owner=team-cafe')) },
          docStep: 3,
          chips: 'ansible web -m ansible.builtin.lineinfile -a "path=/etc/cafe/owner line=owner=team-cafe create=true"',
          hints: { H1: bi('Параметр типа bool в OPTIONS; по умолчанию модуль падает на отсутствующем файле.', 'A bool parameter in OPTIONS; by default the module fails on a missing file.') },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Плейбук `site.yml` упал на web-хостах на задаче «nginx is running», потому что сервиса ещё нет. Исправлять ничего не нужно: коллега уже поставил nginx руками. Запустите плейбук **начиная с этой задачи**, не прогоняя предыдущие. В уроке такого ключа не было — найдите его в `ansible-playbook --help`.', 'The `site.yml` playbook failed on the web hosts at the task "nginx is running" because the service did not exist yet. Nothing needs fixing: a colleague already installed nginx by hand. Run the playbook **starting at that task**, without running the earlier ones. The lesson did not show this key: find it in `ansible-playbook --help`.'),
      ref: { page: 'help/ansible-playbook' },
      terminal: {
        setup: ansSetup({ 'inventory.ini': INV, 'site.yml': SITE_PLAY, 'templates/cafe.conf.j2': TEMPLATE }, [{ name: 'web1', packages: ['nginx'] }, { name: 'web2', packages: ['nginx'] }, { name: 'db1' }]),
        task: {
          id: 'start',
          prompt: bi('Прогон начался с «nginx is running», первые задачи не выполнялись.', 'The run started at "nginx is running"; the earlier tasks did not run.'),
          check: { when: (f) => { const r = lastRun(f); return !!r && r.tasks.some((t) => t.task === 'nginx is running') && !r.tasks.some((t) => t.task === 'nginx is installed' || t.task === 'The site config is in place'); } },
          docStep: 4,
          beyond: true,
          solutionTokens: ['--start-at-task'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.idem', 'iac.q.handler', 'iac.q.check'] },
  ],
};

const tfLesson: Lesson = {
  id: 'iac.terraform',
  block: 'iac',
  title: bi('Terraform: ресурсы облака из кода', 'Terraform: cloud resources from code'),
  summary: bi('Terraform создаёт то, чего ещё нет: виртуальные машины, сети, DNS-записи — по описанию и с планом до любого изменения.', 'Terraform creates what does not exist yet: virtual machines, networks, DNS records — from a description and with a plan before any change.'),
  introduces: ['iac.resource', 'iac.provider', 'iac.plan'],
  uses: ['iac.iac', 'iac.idempotence'],
  tier: 'core',
  minutes: 40,
  sources: src([S.tofuIntro, S.tofuPlan, S.fowlerIac], [S.ruTerraform, S.ruIac]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Ansible настраивает серверы, которые уже есть. Но сначала их кто-то должен создать: в облаке это [[iac.resource|облачный ресурс]] — виртуальная машина, сеть, DNS-запись, бакет, — объект, который появляется по вызову API облака. Заказывать их кнопками в консоли — та же ручная работа, что и настройка по вики.\n\nTerraform (и его открытый форк OpenTofu с той же моделью и командами) описывает ресурсы на языке HCL:\n\n```hcl\nresource "edu_vm" "web" {\n  name       = "web"\n  image      = "ubuntu-24.04"\n  cores      = 2\n  network_id = edu_network.main.id\n}\n```\n\nУ блока два ярлыка: тип ресурса (`edu_vm`) и имя в коде (`web`); вместе они — адрес `edu_vm.web`. Тип принадлежит [[iac.provider|провайдеру Terraform]] — плагину, который знает API одного облака (здесь учебного Edu Cloud: тип `edu_vm`, `edu_network`, `edu_dns_record`). Провайдеры объявляются в блоке `terraform { required_providers { … } }` и скачиваются командой `terraform init`, которую запускают один раз в каталоге.\n\nСсылка `edu_network.main.id` — не просто значение: из неё Terraform узнаёт, что ВМ зависит от сети, и создаст сеть первой. Атрибуты, которые выдаёт облако (`id`, `public_ip`), до создания неизвестны — в плане они `(known after apply)`.\n\n### План и применение\n\nГлавная команда — [[iac.plan|terraform plan]]. Она сравнивает код с тем, что уже создано, и показывает разницу символами: `+` создать, `~` изменить на месте, `-` удалить, `-/+` пересоздать, — с итогом `Plan: 3 to add, 0 to change, 0 to destroy.` План ничего не меняет. `terraform apply` строит тот же план, просит подтвердить словом `yes` и выполняет его вызовами API. Повторный `apply` без изменений кода покажет `No changes`: Terraform тоже идемпотентен. `terraform destroy` удаляет всё, что создал.',
        'Ansible configures servers that already exist. But first someone must create them: in a cloud that is a [[iac.resource|cloud resource]], a virtual machine, a network, a DNS record, a bucket, an object that appears on a call to the cloud API. Ordering them with buttons in a console is the same manual work as setting servers up from a wiki.\n\nTerraform (and its open fork OpenTofu, with the same model and commands) describes resources in the HCL language:\n\n```hcl\nresource "edu_vm" "web" {\n  name       = "web"\n  image      = "ubuntu-24.04"\n  cores      = 2\n  network_id = edu_network.main.id\n}\n```\n\nThe block has two labels: the resource type (`edu_vm`) and the name in the code (`web`); together they are the address `edu_vm.web`. The type belongs to a [[iac.provider|Terraform provider]], a plugin that knows the API of one cloud (here the training Edu Cloud: the types `edu_vm`, `edu_network`, `edu_dns_record`). Providers are declared in the `terraform { required_providers { … } }` block and downloaded by `terraform init`, which you run once in the directory.\n\nThe reference `edu_network.main.id` is more than a value: from it Terraform learns that the VM depends on the network and creates the network first. Attributes the cloud assigns (`id`, `public_ip`) are unknown before creation; the plan shows them as `(known after apply)`.\n\n### Plan and apply\n\nThe main command is [[iac.plan|terraform plan]]. It compares the code with what already exists and shows the difference with symbols: `+` create, `~` update in place, `-` destroy, `-/+` replace, with a total like `Plan: 3 to add, 0 to change, 0 to destroy.` A plan changes nothing. `terraform apply` builds the same plan, asks you to confirm with `yes` and carries it out with API calls. Another `apply` without code changes shows `No changes`: Terraform is idempotent too. `terraform destroy` removes everything it created.',
      ),
    },
    {
      id: 'callout',
      kind: 'callout',
      tone: 'note',
      body: bi('Терминал тренажёра не умеет отвечать на вопросы программ. Подтверждение apply передают так: `echo yes | terraform apply` — или ключом `-auto-approve`, как это делают в CI.', 'The trainer terminal cannot answer program prompts. Pass the apply confirmation like this: `echo yes | terraform apply`, or with the `-auto-approve` key, as CI does.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: tfSetup(TF_HEAD + TF_NET + TF_VM),
      intro: bi('В `~/infra/main.tf` описаны сеть и ВМ в Edu Cloud. Облако пока пустое: проверьте `edu vm list`.', '`~/infra/main.tf` describes a network and a VM in Edu Cloud. The cloud is empty for now: check with `edu vm list`.'),
      tasks: [
        {
          id: 'apply',
          prompt: bi('Подготовьте каталог, посмотрите план и создайте сеть и ВМ.', 'Prepare the directory, look at the plan and create the network and the VM.'),
          check: { when: (f) => cloud(f).some((r) => r.type === 'edu_vm') && cloud(f).some((r) => r.type === 'edu_network') && (tf(f)?.state.length ?? 0) === 2, fail: [{ if: (f) => !tf(f)?.initialized, say: bi('Сначала terraform init: он скачивает провайдер edu.', 'Run terraform init first: it downloads the edu provider.') }] },
          chips: 'terraform init && terraform plan',
          concepts: ['iac.provider', 'iac.plan'],
          docRef: { page: 'help/terraform', anchor: 'MAIN COMMANDS', line: 'init' },
          hints: { H1: bi('init → plan → apply (с подтверждением yes).', 'init → plan → apply (confirmed with yes).') },
        },
        {
          id: 'dns',
          prompt: bi('Добавьте в код DNS-запись: ресурс `edu_dns_record` с именем `www` в зоне `site.edu`, значение — публичный адрес ВМ (ссылкой, не числом), и output `site_ip` с тем же адресом. Примените.', 'Add a DNS record to the code: an `edu_dns_record` resource named `www` in the `site.edu` zone whose value is the VM public address (a reference, not a number), and an output `site_ip` with the same address. Apply it.'),
          check: {
            when: (f) => {
              const vm = cloud(f).find((r) => r.type === 'edu_vm');
              const rec = cloud(f).find((r) => r.type === 'edu_dns_record');
              const code = f.files[`${INFRA}/main.tf`]?.text ?? '';
              return !!vm && !!rec && rec.attrs.value === vm.attrs.public_ip && rec.attrs.name === 'www' && rec.attrs.zone === 'site.edu' && /edu_vm\.web\.public_ip/.test(code) && /output\s+"site_ip"/.test(code) && tf(f)?.state.length === 3;
            },
            fail: [{ if: (f) => /value\s*=\s*"203\.0\.113/.test(f.files[`${INFRA}/main.tf`]?.text ?? ''), say: bi('Адрес записан числом: при пересоздании ВМ он изменится, а запись — нет. Сошлитесь на edu_vm.web.public_ip.', 'The address is written as a number: if the VM is recreated it changes and the record does not. Reference edu_vm.web.public_ip.') }],
          },
          chips: 'edit main.tf',
          concepts: ['iac.resource'],
          hints: { H1: bi('Три аргумента: zone, name, value. Значение — ссылка на атрибут ВМ.', 'Three arguments: zone, name, value. The value is a reference to a VM attribute.'), H2: bi('```hcl\nresource "edu_dns_record" "www" {\n  zone  = "site.edu"\n  name  = "www"\n  value = edu_vm.web.public_ip\n}\n\noutput "site_ip" {\n  value = edu_vm.web.public_ip\n}\n```', '```hcl\nresource "edu_dns_record" "www" {\n  zone  = "site.edu"\n  name  = "www"\n  value = edu_vm.web.public_ip\n}\n\noutput "site_ip" {\n  value = edu_vm.web.public_ip\n}\n```') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.symbols', 'iac.q.known-after'] },
  ],
};

export const APPLIED = [`cd ${INFRA} && terraform init && terraform apply -auto-approve && chown -R learner:learner ${INFRA}`];
const stateLesson: Lesson = {
  id: 'iac.state',
  block: 'iac',
  title: bi('State и дрейф: три правды Terraform', 'State and drift: Terraform’s three truths'),
  summary: bi('Terraform знает об облаке только то, что записано в state, и каждый plan — сравнение кода, state и облака.', 'Terraform knows about the cloud only what is written in the state, and every plan compares the code, the state and the cloud.'),
  introduces: ['iac.state', 'iac.drift'],
  uses: ['iac.plan', 'iac.resource'],
  tier: 'core',
  minutes: 35,
  sources: src([S.tofuState, S.tfDrift, S.tofuPlan], [S.ruTerraform, S.ruIac]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Откуда Terraform знает, что ВМ `vm-4f66` в облаке — это его `edu_vm.web`? Облако хранит ресурсы, но не знает, кто их «владелец». Код описывает, какими они должны быть, но не знает, какие есть. Связь между ними — [[iac.state|state]], файл `terraform.tfstate`: в нём для каждого адреса записаны ID в облаке и последние известные атрибуты. Его пишет `apply` после каждого созданного ресурса, а смотрят `terraform state list` и `terraform state show edu_vm.web`.\n\nПоэтому `plan` — это сравнение трёх версий мира. Сначала **refresh**: Terraform перечитывает из облака каждый ресурс, записанный в state. Потом сравнивает код с обновлённым state: ресурса нет в state — `+`; есть, но иначе — `~` или `-/+`; есть в state, нет в коде — `-`.\n\nЕсли кто-то поменял ресурс руками в консоли облака, реальность разошлась с кодом — это [[iac.drift|дрейф]]. Refresh его замечает и пишет `Note: Objects have changed outside of Terraform`, а план предлагает вернуть всё как в коде: код — это желаемое состояние. Дальше решает человек: откатить ручную правку (`apply`), принять её (поменять код) или явно разрешить её (`lifecycle { ignore_changes = [cores] }`).\n\nНе всё можно поменять на месте. Сменить число ядер облако умеет, а образ ВМ — нет: такой атрибут в плане помечен `# forces replacement`, и Terraform удалит ВМ и создаст новую (`-/+`). Если простой недопустим, `lifecycle { create_before_destroy = true }` меняет порядок: сначала новая, потом удаление старой (`+/-`).\n\nState — самое ценное в каталоге Terraform. Потеряв его, Terraform не тронет облако, но и не будет знать, что ресурсы его: следующий plan предложит создать всё заново. В state лежат значения атрибутов, включая секреты. Поэтому в команде state хранят не на ноутбуке, а в удалённом хранилище с блокировкой и ограниченным доступом.',
        'How does Terraform know that the VM `vm-4f66` in the cloud is its `edu_vm.web`? The cloud stores resources but does not know who "owns" them. The code describes what they should be like but does not know what they are. The link between them is the [[iac.state|state]], the `terraform.tfstate` file: for every address it records the ID in the cloud and the last known attributes. `apply` writes it after every created resource; `terraform state list` and `terraform state show edu_vm.web` let you look at it.\n\nSo `plan` compares three versions of the world. First a **refresh**: Terraform rereads from the cloud every resource recorded in the state. Then it compares the code with the refreshed state: a resource missing from the state is `+`; present but different is `~` or `-/+`; in the state but not in the code is `-`.\n\nIf someone changed a resource by hand in the cloud console, reality has diverged from the code: that is [[iac.drift|drift]]. The refresh notices it and prints `Note: Objects have changed outside of Terraform`, and the plan proposes to bring everything back to the code: the code is the desired state. Then a person decides: undo the manual edit (`apply`), accept it (change the code), or explicitly allow it (`lifecycle { ignore_changes = [cores] }`).\n\nNot everything can change in place. The cloud can change the number of cores, but not the VM image: such an attribute is marked `# forces replacement` in the plan, and Terraform deletes the VM and creates a new one (`-/+`). If downtime is not acceptable, `lifecycle { create_before_destroy = true }` reverses the order: the new one first, then the old one is removed (`+/-`).\n\nThe state is the most valuable thing in a Terraform directory. If it is lost, Terraform does not touch the cloud, but it no longer knows the resources are its own: the next plan proposes to create everything again. The state holds attribute values, secrets included. So a team keeps state not on a laptop but in remote storage with locking and limited access.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'iac.tf-plan-apply', caption: bi('Включите дрейф, потом выключите refresh. Смените образ и попробуйте create_before_destroy.', 'Switch on drift, then switch refresh off. Change the image and try create_before_destroy.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: tfSetup(TF_HEAD + TF_NET + TF_VM, APPLIED),
      intro: bi('Сеть и ВМ уже созданы этим кодом. Консоль облака — команда `edu`: `edu vm list`, `edu vm update ID --cores 4`.', 'The network and the VM were already created by this code. The cloud console is the `edu` command: `edu vm list`, `edu vm update ID --cores 4`.'),
      tasks: [
        {
          id: 'drift',
          prompt: bi('Изобразите ночного дежурного: через консоль облака поставьте ВМ 4 ядра. Убедитесь, что `terraform plan` видит дрейф.', 'Play the night on-call engineer: set the VM to 4 cores through the cloud console. Check that `terraform plan` sees the drift.'),
          check: { when: (f) => cloud(f).some((r) => r.type === 'edu_vm' && r.attrs.cores === 4) && (tf(f)?.lastPlan?.drift ?? []).some((d) => d.addr === 'edu_vm.web') },
          chips: 'edu vm list',
          concepts: ['iac.drift'],
          hints: { H1: bi('ID ВМ покажет edu vm list или terraform state show edu_vm.web.', 'edu vm list or terraform state show edu_vm.web shows the VM ID.') },
        },
        {
          id: 'accept',
          prompt: bi('Команда решила оставить 4 ядра. Сделайте так, чтобы `terraform plan` показывал `No changes`, а в облаке ВМ осталась с 4 ядрами.', 'The team decided to keep 4 cores. Make `terraform plan` show `No changes` while the VM stays at 4 cores in the cloud.'),
          check: {
            when: (f) => cloud(f).some((r) => r.type === 'edu_vm' && r.attrs.cores === 4) && !!tf(f)?.lastPlan && tf(f)!.lastPlan!.add + tf(f)!.lastPlan!.change + tf(f)!.lastPlan!.destroy === 0,
            fail: [{ if: (f) => cloud(f).some((r) => r.type === 'edu_vm' && r.attrs.cores === 2), say: bi('apply вернул 2 ядра: Terraform привёл облако к коду. Чтобы принять ручную правку, поменяйте код.', 'apply brought back 2 cores: Terraform made the cloud match the code. To accept the manual edit, change the code.') }],
          },
          chips: 'terraform plan',
          concepts: ['iac.state'],
          hints: { H1: bi('Желаемое состояние — код. Принять изменение — значит записать его в код.', 'The desired state is the code. Accepting a change means writing it into the code.') },
        },
        {
          id: 'replace',
          prompt: bi('Переведите ВМ на образ `debian-13` так, чтобы новая ВМ создалась **до** удаления старой. Примените.', 'Move the VM to the `debian-13` image so that the new VM is created **before** the old one is deleted. Apply.'),
          check: { when: (f) => cloud(f).some((r) => r.type === 'edu_vm' && r.attrs.image === 'debian-13') && (tf(f)?.lastPlan?.actions ?? []).some((a) => a.addr === 'edu_vm.web' && a.action === 'replace' && a.createBeforeDestroy) && !!tf(f)?.lastPlan?.applied },
          chips: 'terraform plan',
          docRef: { url: 'https://opentofu.org/docs/language/meta-arguments/lifecycle/', label: 'opentofu.org › lifecycle' },
          hints: { H1: bi('Смена образа — пересоздание. Порядок меняет блок lifecycle.', 'An image change means replacement. The lifecycle block changes the order.'), H2: bi('```hcl\n  lifecycle {\n    create_before_destroy = true\n  }\n```', '```hcl\n  lifecycle {\n    create_before_destroy = true\n  }\n```') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('ВМ «залипла» и работает странно; код менять не нужно, но её надо пересоздать. Найдите в `terraform plan -help` ключ, который пересоздаёт конкретный ресурс без правки кода, и пересоздайте `edu_vm.web`.', 'The VM is stuck and behaves strangely; the code needs no change, but the VM must be recreated. Find in `terraform plan -help` the key that replaces a particular resource without editing the code, and replace `edu_vm.web`.'),
      ref: { page: 'help/terraform' },
      terminal: {
        setup: tfSetup(TF_HEAD + TF_NET + TF_VM, APPLIED),
        task: {
          id: 'replace-flag',
          prompt: bi('edu_vm.web пересоздана, код не менялся.', 'edu_vm.web is recreated, the code did not change.'),
          check: { when: (f) => (tf(f)?.lastPlan?.actions ?? []).some((a) => a.addr === 'edu_vm.web' && a.action === 'replace') && !!tf(f)?.lastPlan?.applied && (f.files[`${INFRA}/main.tf`]?.text ?? '') === TF_HEAD + TF_NET + TF_VM },
          docStep: 4,
          beyond: true,
          solutionTokens: ['-replace', '-replace=edu_vm.web'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.state-lost', 'iac.q.drift', 'iac.q.ans-vs-tf'] },
  ],
};

export const lessons: Lesson[] = [introLesson, playbookLesson, tfLesson, stateLesson];

const placement: PlacementTask[] = [
  { id: 'iac.place.idem', level: 'intermediate', key: true, concepts: ['iac.idempotence'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'iac.q.idem') as QuizItem), id: 'iac.place.q.idem' } },
  {
    id: 'iac.place.adhoc',
    level: 'intermediate',
    key: true,
    concepts: ['iac.module', 'iac.inventory'],
    kind: 'task',
    setup: ansSetup({ 'inventory.ini': INV }),
    task: { id: 'p1', prompt: bi('Поставьте пакет `chrony` на все хосты группы db и только на них.', 'Install the `chrony` package on all hosts of the db group and only on them.'), check: { when: (f) => !!host(f, 'db1')?.packages.includes('chrony') && !host(f, 'web1')?.packages.includes('chrony') } },
  },
  { id: 'iac.place.symbols', level: 'intermediate', key: false, concepts: ['iac.plan'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'iac.q.symbols') as QuizItem), id: 'iac.place.q.symbols' } },
  { id: 'iac.place.state', level: 'experienced', key: true, concepts: ['iac.state'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'iac.q.state-lost') as QuizItem), id: 'iac.place.q.state' } },
  {
    id: 'iac.place.tf',
    level: 'experienced',
    key: true,
    concepts: ['iac.plan', 'iac.resource'],
    kind: 'task',
    setup: tfSetup(TF_HEAD + TF_NET),
    task: { id: 'p2', prompt: bi('Добавьте ВМ `api` (образ ubuntu-24.04, 2 ядра) в сеть `edu_network.main` и создайте её.', 'Add a VM `api` (image ubuntu-24.04, 2 cores) in the network `edu_network.main` and create it.'), check: { when: (f) => cloud(f).some((r) => r.type === 'edu_vm' && r.attrs.name === 'api') } },
  },
];

export const block: Block = {
  id: 'iac',
  order: 80,
  title: bi('IaC: Ansible и Terraform', 'IaC: Ansible and Terraform'),
  summary: bi('Ansible: инвентарь, модули, плейбуки, идемпотентность, handlers, check mode, роли и приоритет переменных. Terraform: провайдер, ресурсы, plan и apply, state, дрейф и пересоздание, переменные и модули, moved, import и refresh-only.', 'Ansible: inventory, modules, playbooks, idempotence, handlers, check mode, roles and variable precedence. Terraform: providers, resources, plan and apply, state, drift and replacement, variables and modules, moved, import and refresh-only.'),
  checklistStep: '06',
  levels: {
    beginner: bi('Слышал название', 'Has heard the name'),
    intermediate: bi('Запускал готовый код', 'Has run ready-made code'),
    experienced: bi('Писал небольшие конфигурации, не знает state, ролей, идемпотентности', 'Has written small configs; does not know state, roles, idempotence'),
  },
  hours: { beginner: 29, intermediate: 19, experienced: 11 },
  lessons: lessons.map((l) => l.id),
  sources: src([S.fowlerIac, S.ansIntro, S.tofuState], [S.ruIac, S.ruAnsible, S.ruTerraform]),
  docSources: ['ansible-doc', 'help', 'terraform'],
  placement,
};
