// Explainers of the second half of the IaC block: where a host gets the value
// of a variable (the precedence ladder of roles and inventory, 06 §4.3 B1-11)
// and what an address means to Terraform — moving a resource into a module
// and adopting a hand-made object (06 §5.3 B2-9, B2-11).

import { defineModel } from '../../core/define';
import { bi, fmt, type Bi } from '../../core/i18n';
import type { Step } from '../../core/types';
import { card } from '../git-cicd/explainers';

const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};

// ── Variable precedence ──

type VarP = { groupAll: boolean; groupWeb: boolean; hostVars: boolean; playVars: boolean; roleVars: boolean; extra: boolean };

/** The sources from the lowest step to the highest, with the value each one sets in this explainer. */
export const VAR_SOURCES = [
  { id: 'defaults', param: null, value: 80, file: 'roles/webserver/defaults/main.yml' },
  { id: 'gall', param: 'groupAll', value: 8000, file: 'group_vars/all.yml' },
  { id: 'gweb', param: 'groupWeb', value: 8080, file: 'group_vars/web.yml' },
  { id: 'hvars', param: 'hostVars', value: 8081, file: 'host_vars/web1.yml' },
  { id: 'play', param: 'playVars', value: 8888, file: 'site.yml · vars:' },
  { id: 'rvars', param: 'roleVars', value: 9090, file: 'roles/webserver/vars/main.yml' },
  { id: 'extra', param: 'extra', value: 9000, file: '-e http_port=9000' },
] as const;

export function winningPort(p: VarP): { value: number; from: string; set: number } {
  let value = 0;
  let from = '';
  let set = 0;
  for (const s of VAR_SOURCES) {
    if (s.param && !p[s.param]) continue;
    value = s.value;
    from = s.id;
    set++;
  }
  return { value, from, set };
}

const src = (id: string, label: Bi | string, sub: string, x: number, y: number, what: Bi, who: Bi, see?: string) => ({ id, label, sub, family: 'obj' as const, shape: 'doc' as const, x, y, w: 200, h: 56, card: card(what, who, see) });

export const varModel = defineModel<VarP>({
  id: 'iac.var-precedence',
  block: 'iac',
  title: bi('Откуда хост берёт значение переменной', 'Where a host gets the value of a variable'),
  summary: bi('Ansible собирает значение переменной со всех мест, где её задали, и побеждает не последнее прочитанное, а самое высокое по лестнице: умолчания роли внизу, `-e` наверху.', 'Ansible gathers a variable from every place it is set, and the winner is not the last one read but the highest on the ladder: role defaults at the bottom, `-e` at the top.'),
  concepts: ['iac.role', 'iac.var-precedence'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      src('defaults', bi('умолчания роли', 'role defaults'), 'http_port: 80', 24, 440, bi('defaults/main.yml роли: значения «если никто не сказал иначе». Самая нижняя ступень: её переопределяет всё.', 'The role’s defaults/main.yml: values "unless someone says otherwise". The lowest step: everything overrides it.'), bi('Автор роли.', 'The role author.'), 'cat roles/webserver/defaults/main.yml'),
      src('gall', 'group_vars/all', 'http_port: 8000', 24, 368, bi('Переменные для всех хостов инвентаря. Выше умолчаний роли, ниже всего остального.', 'Variables for every host of the inventory. Above role defaults, below everything else.'), bi('Команда эксплуатации, рядом с инвентарём.', 'The operations team, next to the inventory.'), 'ansible-inventory --host web1'),
      src('gweb', 'group_vars/web', 'http_port: 8080', 24, 296, bi('Переменные группы web. Группа точнее, чем all, поэтому выигрывает у неё.', 'Variables of the web group. A group is more specific than all, so it wins over it.'), bi('Команда эксплуатации.', 'The operations team.'), 'ansible-inventory --host web1'),
      src('hvars', 'host_vars/web1', 'http_port: 8081', 24, 224, bi('Переменные одного хоста — точнее любой группы.', 'Variables of one host, more specific than any group.'), bi('Команда эксплуатации.', 'The operations team.'), 'ansible-inventory --host web1'),
      src('play', bi('vars: плея', 'play vars:'), 'http_port: 8888', 24, 152, bi('Секция vars: в плейбуке. Выше инвентаря: плейбук сознательно говорит «здесь так».', 'The vars: section of a play. Above the inventory: the playbook deliberately says "here it is so".'), bi('Автор плейбука.', 'The playbook author.'), 'cat site.yml'),
      src('rvars', bi('vars роли', 'role vars'), 'http_port: 9090', 24, 80, bi('vars/main.yml роли: значения, которые роль не даёт менять из инвентаря. Класть сюда то, что пользователь роли должен уметь настроить, — ошибка: это место для defaults.', 'The role’s vars/main.yml: values the role does not let the inventory change. Putting here what the user of the role should be able to tune is a mistake: that belongs in defaults.'), bi('Автор роли.', 'The role author.'), 'cat roles/webserver/vars/main.yml'),
      src('extra', '-e (extra vars)', 'http_port=9000', 24, 8, bi('Значение из командной строки. Высшая ступень: побеждает всегда, поэтому её берут для разовых прогонов и CI, а не для постоянной настройки.', 'A value from the command line. The highest step: it always wins, so it is used for one-off runs and CI, not for permanent settings.'), bi('Тот, кто запускает ansible-playbook.', 'Whoever runs ansible-playbook.'), 'ansible-playbook site.yml -e http_port=9000'),
      { id: 'merge', label: 'ansible-playbook', sub: 'http_port = 8080', family: 'process', shape: 'box', x: 400, y: 224, w: 200, h: 72, card: card(bi('Перед каждой задачей Ansible собирает переменные хоста со всех ступеней. Совпавшее имя перезаписывается значением с более высокой ступени.', 'Before every task Ansible gathers the host’s variables from all steps. A name that occurs twice is overwritten by the value from the higher step.'), bi('Ansible на управляющей машине.', 'Ansible on the control machine.'), 'ansible web1 -m ansible.builtin.debug -a "var=http_port"', { url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_variables.html#understanding-variable-precedence', label: 'docs.ansible.com › variable precedence' }) },
      { id: 'tpl', label: 'templates/site.conf.j2', sub: 'listen {{ http_port }}', family: 'ci-source', shape: 'doc', x: 400, y: 400, w: 200, h: 64, card: card(bi('Шаблон роли: Jinja2 подставляет значение переменной в момент прогона.', 'The role’s template: Jinja2 inserts the variable value at run time.'), bi('Автор роли.', 'The role author.'), 'cat roles/webserver/templates/site.conf.j2') },
      { id: 'web1', label: 'web1', sub: 'listen 8080;', family: 'node', shape: 'rack', x: 720, y: 216, w: 216, h: 88, card: card(bi('Управляемый хост. В /etc/nginx/sites-enabled/site.conf оказывается значение, победившее на лестнице.', 'The managed host. /etc/nginx/sites-enabled/site.conf gets the value that won on the ladder.'), bi('Роль webserver.', 'The webserver role.'), 'ssh web1 cat /etc/nginx/sites-enabled/site.conf') },
    ],
    edges: [
      { id: 'e-defaults', from: 'defaults', to: 'merge', label: bi('ступень 1', 'step 1'), labelAt: 0.3, card: card(bi('Самая слабая ступень.', 'The weakest step.'), bi('Ansible.', 'Ansible.')) },
      { id: 'e-gall', from: 'gall', to: 'merge', label: bi('ступень 2', 'step 2'), labelAt: 0.3, card: card(bi('Переменные группы all.', 'Variables of the all group.'), bi('Ansible.', 'Ansible.')) },
      { id: 'e-gweb', from: 'gweb', to: 'merge', label: bi('ступень 3', 'step 3'), labelAt: 0.3, card: card(bi('Переменные конкретной группы.', 'Variables of a particular group.'), bi('Ansible.', 'Ansible.')) },
      { id: 'e-hvars', from: 'hvars', to: 'merge', label: bi('ступень 4', 'step 4'), labelAt: 0.3, card: card(bi('Переменные хоста.', 'Host variables.'), bi('Ansible.', 'Ansible.')) },
      { id: 'e-play', from: 'play', to: 'merge', label: bi('ступень 5', 'step 5'), labelAt: 0.3, card: card(bi('vars: плея.', 'Play vars:.'), bi('Ansible.', 'Ansible.')) },
      { id: 'e-rvars', from: 'rvars', to: 'merge', label: bi('ступень 6', 'step 6'), labelAt: 0.3, card: card(bi('vars роли.', 'Role vars.'), bi('Ansible.', 'Ansible.')) },
      { id: 'e-extra', from: 'extra', to: 'merge', label: bi('ступень 7', 'step 7'), labelAt: 0.3, card: card(bi('Командная строка побеждает всё.', 'The command line beats everything.'), bi('Ansible.', 'Ansible.')) },
      { id: 'e-render', from: 'merge', to: 'tpl', label: bi('подстановка', 'rendering'), card: card(bi('Модуль template отдаёт шаблону итоговые переменные хоста.', 'The template module gives the template the host’s final variables.'), bi('ansible.builtin.template.', 'ansible.builtin.template.')) },
      { id: 'e-copy', from: 'tpl', to: 'web1', label: bi('файл на хост', 'file to the host'), card: card(bi('Готовый файл копируется на хост; если он изменился, задача changed и уведомляет handler.', 'The rendered file is copied to the host; if it changed, the task is changed and notifies the handler.'), bi('ansible.builtin.template.', 'ansible.builtin.template.')) },
    ],
  },
  params: [
    { id: 'groupAll', label: bi('group_vars/all задаёт 8000', 'group_vars/all sets 8000'), kind: 'toggle', default: false, near: 'gall' },
    { id: 'groupWeb', label: bi('group_vars/web задаёт 8080', 'group_vars/web sets 8080'), kind: 'toggle', default: true, near: 'gweb' },
    {
      id: 'hostVars',
      label: bi('host_vars/web1 задаёт 8081', 'host_vars/web1 sets 8081'),
      kind: 'toggle',
      default: false,
      near: 'hvars',
      predict: {
        prompt: bi('Добавляем host_vars/web1 с http_port: 8081. Какой порт получит web1?', 'We add host_vars/web1 with http_port: 8081. Which port does web1 get?'),
        options: [
          { id: 'host', text: bi('8081: хост точнее группы', '8081: a host is more specific than a group') },
          { id: 'group', text: bi('8080: группа прочитана последней', '8080: the group is read last') },
        ],
        resolve: (_p, n) => (String(n.at(-1)?.metrics?.port) === '8081' ? 'host' : 'group'),
      },
    },
    { id: 'playVars', label: bi('vars: плея задают 8888', 'play vars: set 8888'), kind: 'toggle', default: false, near: 'play' },
    {
      id: 'roleVars',
      label: bi('vars/main.yml роли задаёт 9090', 'role vars/main.yml sets 9090'),
      kind: 'toggle',
      default: false,
      near: 'rvars',
      predict: {
        prompt: bi('Автор роли положил http_port: 9090 в vars/main.yml, а не в defaults. Что станет с переопределением из group_vars/web?', 'The role author put http_port: 9090 into vars/main.yml instead of defaults. What happens to the override from group_vars/web?'),
        options: [
          { id: 'lost', text: bi('Перестанет действовать: vars роли выше инвентаря', 'It stops working: role vars are above the inventory') },
          { id: 'kept', text: bi('Останется: инвентарь важнее роли', 'It stays: the inventory matters more than the role') },
        ],
        resolve: (_p, n) => (String(n.at(-1)?.metrics?.port) === '9090' ? 'lost' : 'kept'),
      },
    },
    { id: 'extra', label: bi('запуск с -e http_port=9000', 'run with -e http_port=9000'), kind: 'toggle', default: false, near: 'extra' },
  ],
  breaks: [
    {
      id: 'typo',
      label: bi('Опечатка в шаблоне: {{ http_prot }}', 'A typo in the template: {{ http_prot }}'),
      remove: ['e-render'],
      predict: {
        prompt: bi('В шаблоне написали {{ http_prot }}. Что сделает Ansible?', 'The template says {{ http_prot }}. What does Ansible do?'),
        options: [
          { id: 'fail', text: bi('Задача упадёт: переменная не определена', 'The task fails: the variable is undefined') },
          { id: 'empty', text: bi('Подставит пустую строку', 'It inserts an empty string') },
          { id: 'default', text: bi('Возьмёт умолчание роли', 'It takes the role default') },
        ],
        resolve: () => 'fail',
      },
    },
  ],
  metrics: [
    { id: 'port', label: bi('итоговый http_port на web1', 'final http_port on web1') },
    { id: 'sources', label: bi('мест, где задано значение', 'places that set the value') },
  ],
  run(p, broken) {
    const steps: Step[] = [];
    let cur = 0;
    let set = 0;
    for (const s of VAR_SOURCES) {
      const on = !s.param || p[s.param];
      if (!on) continue;
      set++;
      const prevV = cur;
      cur = s.value;
      steps.push({
        id: `s-${s.id}`,
        label: s.id === 'defaults' ? 'defaults' : s.id === 'extra' ? '-e' : s.file.split('/')[0].replace(' · vars:', ''),
        caption: prevV ? fmt(bi('{f}: http_port = {v} и перезаписывает {a}.', '{f}: http_port = {v}, overwriting {a}.'), { f: s.file, v: s.value, a: prevV }) : fmt(bi('{f}: http_port = {v}.', '{f}: http_port = {v}.'), { f: s.file, v: s.value }),
        focus: [s.id, `e-${s.id}`, 'merge'],
        tokens: [{ edge: `e-${s.id}`, label: String(s.value) }],
        states: { [s.id]: 'on' },
        values: { merge: `http_port = ${cur}` },
      });
    }
    if (broken.has('typo')) {
      steps.push({ id: 'fail', label: 'template ✗', caption: bi('Шаблон обращается к http_prot, а такого имени нет ни на одной ступени.', 'The template refers to http_prot, and that name is on no step.'), focus: ['tpl', 'merge'], states: { tpl: 'err', web1: 'off' }, metrics: { port: 0, sources: set }, broken: { at: 'tpl', message: "fatal: [web1]: FAILED! => {\"changed\": false, \"msg\": \"AnsibleUndefinedVariable: 'http_prot' is undefined\"}", caption: bi('неизвестное имя — ошибка, а не пустая строка; так опечатка не уезжает в продакшен молча.', 'an unknown name is an error, not an empty string, so a typo does not slip into production silently.') } });
      return steps;
    }
    steps.push(
      { id: 'render', label: 'template', caption: fmt(bi('Шаблон получает итог: listen {v};', 'The template gets the result: listen {v};'), { v: cur }), focus: ['e-render', 'tpl'], tokens: [{ edge: 'e-render', label: `http_port=${cur}` }], states: { tpl: 'on' }, values: { tpl: `listen ${cur};` } },
      { id: 'host', label: 'web1', caption: fmt(bi('На web1 в site.conf оказывается listen {v}; — значение с самой высокой ступени из заданных.', 'web1 gets listen {v}; in site.conf: the value from the highest step that was set.'), { v: cur }), focus: ['e-copy', 'web1'], tokens: [{ edge: 'e-copy', label: 'site.conf' }], states: { web1: 'ok' }, values: { web1: `listen ${cur};` }, metrics: { port: cur, sources: set } },
    );
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break') return change.on ? bi('Неизвестная переменная останавливает задачу на всех хостах.', 'An unknown variable stops the task on every host.') : bi('Опечатка исправлена.', 'The typo is fixed.');
    const a = last(prev).port ?? 0;
    const b = last(next).port ?? 0;
    if (a === b) return fmt(bi('Итог не изменился ({v}): выше по лестнице уже есть значение, которое побеждает.', 'The result did not change ({v}): a higher step already sets a value that wins.'), { v: b });
    return fmt(bi('http_port на web1: {a} → {b}. Побеждает самая высокая заданная ступень.', 'http_port on web1: {a} → {b}. The highest step that is set wins.'), { a, b });
  },
});

// ── The address: moved and import ──

type AddrP = { scenario: string; block: boolean };

export function addrNumbers(p: AddrP, broken: ReadonlySet<string>): { add: number; destroy: number; imported: number; downtime: number; vms: number } {
  if (broken.has('state-lost')) return p.scenario === 'refactor' ? { add: 1, destroy: 0, imported: 0, downtime: 0, vms: 2 } : { add: 2, destroy: 0, imported: 0, downtime: 0, vms: 3 };
  if (p.scenario === 'refactor') return p.block ? { add: 0, destroy: 0, imported: 0, downtime: 0, vms: 1 } : { add: 1, destroy: 1, imported: 0, downtime: 40, vms: 1 };
  return p.block ? { add: 0, destroy: 0, imported: 1, downtime: 0, vms: 2 } : { add: 1, destroy: 0, imported: 0, downtime: 0, vms: 3 };
}

export const addrModel = defineModel<AddrP>({
  id: 'iac.address',
  block: 'iac',
  title: bi('Адрес в коде и объект в облаке', 'An address in the code and an object in the cloud'),
  summary: bi('Terraform узнаёт «свой» ресурс только по адресу в state. Сменили адрес — для него это другой ресурс; объект, которого нет в state, для него не существует. Блоки moved и import меняют state, не трогая облако.', 'Terraform recognises "its" resource only by the address in the state. Change the address and to it this is another resource; an object missing from the state does not exist for it. moved and import blocks change the state without touching the cloud.'),
  concepts: ['iac.state', 'iac.moved', 'iac.import'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      { id: 'code', label: 'main.tf', sub: 'module "web" { … }', family: 'ci-source', shape: 'doc', x: 24, y: 40, w: 216, h: 72, card: card(bi('Код после рефакторинга: ВМ теперь описана в модуле, её адрес module.web.edu_vm.this.', 'The code after refactoring: the VM is now described in a module; its address is module.web.edu_vm.this.'), bi('Вы.', 'You.'), 'terraform state list') },
      { id: 'block', label: bi('moved / import', 'moved / import'), sub: 'moved { from, to }', family: 'ci-build', shape: 'doc', x: 24, y: 200, w: 216, h: 72, card: card(bi('Блоки, которые говорят Terraform о state, а не об облаке: moved — «этот объект теперь живёт по новому адресу», import — «этот объект в облаке теперь мой».', 'Blocks that tell Terraform about the state, not the cloud: moved says "this object now lives at a new address", import says "this object in the cloud is now mine".'), bi('Вы, рядом с кодом; после применения их можно удалить или оставить для истории.', 'You, next to the code; after the apply they may be removed or kept for history.'), undefined, { url: 'https://opentofu.org/docs/language/modules/develop/refactoring/', label: 'opentofu.org › refactoring' }) },
      { id: 'state', label: 'terraform.tfstate', sub: 'edu_vm.web → vm-4f66', family: 'obj', shape: 'buffer', x: 360, y: 120, w: 232, h: 80, card: card(bi('Таблица «адрес → ID в облаке». По ней Terraform решает, какой объект в облаке соответствует блоку в коде.', 'A table "address → ID in the cloud". Terraform uses it to decide which cloud object belongs to a block in the code.'), bi('terraform apply, import, state mv.', 'terraform apply, import, state mv.'), 'terraform state show module.web.edu_vm.this') },
      { id: 'plan', label: 'terraform plan', sub: '0 to add, 0 to destroy', family: 'process', shape: 'box', x: 360, y: 300, w: 232, h: 72, card: card(bi('Сравнение кода со state и облаком. Результат зависит от того, нашёл ли Terraform объект по адресу.', 'The comparison of the code with the state and the cloud. The result depends on whether Terraform found the object by its address.'), bi('Вы или CI.', 'You or CI.'), 'terraform plan') },
      { id: 'vm', label: 'vm-4f66', sub: 'status: running', family: 'node', shape: 'rack', x: 720, y: 40, w: 216, h: 80, card: card(bi('ВМ, которую Terraform создал раньше под адресом edu_vm.web.', 'The VM Terraform created earlier under the address edu_vm.web.'), bi('terraform apply.', 'terraform apply.'), 'edu vm get vm-4f66') },
      { id: 'legacy', label: 'vm-4f91', sub: 'source: console', family: 'node', shape: 'rack', x: 720, y: 200, w: 216, h: 80, card: card(bi('ВМ, которую создали в консоли во время инцидента. В state её нет, и для Terraform её не существует.', 'A VM created in the console during an incident. It is not in the state, and for Terraform it does not exist.'), bi('Дежурный, через консоль облака.', 'The on-call engineer, through the cloud console.'), 'edu vm list') },
      { id: 'newvm', label: bi('новая ВМ', 'a new VM'), sub: '(known after apply)', family: 'neutral', shape: 'rack', x: 720, y: 330, w: 216, h: 80, card: card(bi('То, что Terraform создаст, если не узнает существующий объект: дубль или замену.', 'What Terraform creates if it does not recognise the existing object: a duplicate or a replacement.'), bi('terraform apply.', 'terraform apply.')) },
    ],
    edges: [
      { id: 'e-code', from: 'code', to: 'plan', via: [[300, 76], [300, 336]], label: bi('желаемое', 'desired'), labelAt: 0.75, card: card(bi('Код говорит, какие адреса должны существовать.', 'The code says which addresses must exist.'), bi('terraform.', 'terraform.')) },
      { id: 'e-block', from: 'block', to: 'state', label: bi('правит адреса', 'edits addresses'), card: card(bi('moved переименовывает запись в state, import добавляет запись с ID существующего объекта. Облако при этом не меняется.', 'moved renames an entry of the state, import adds an entry with the ID of an existing object. The cloud does not change.'), bi('terraform plan / apply.', 'terraform plan / apply.')) },
      { id: 'e-state', from: 'state', to: 'plan', label: bi('что моё', 'what is mine'), card: card(bi('Plan ищет каждый адрес кода в state. Не нашёл — значит, создать.', 'Plan looks up every address of the code in the state. Not found means create.'), bi('terraform.', 'terraform.')) },
      { id: 'e-own', from: 'state', to: 'vm', label: bi('адрес → ID', 'address → ID'), card: card(bi('Запись state связывает адрес с ID vm-4f66.', 'The state entry links the address with the ID vm-4f66.'), bi('terraform.', 'terraform.')) },
      { id: 'e-adopt', from: 'state', to: 'legacy', dashed: true, label: bi('нет записи', 'no entry'), card: card(bi('Пока нет записи, Terraform про эту ВМ не знает и не управляет ею.', 'Until there is an entry, Terraform knows nothing of this VM and does not manage it.'), bi('—', '—')) },
      { id: 'e-create', from: 'plan', to: 'newvm', label: '+ create', card: card(bi('Если адрес кода не найден в state, план создаёт новый объект.', 'If an address of the code is not found in the state, the plan creates a new object.'), bi('terraform apply.', 'terraform apply.')) },
    ],
  },
  params: [
    { id: 'scenario', label: bi('Ситуация', 'Situation'), kind: 'choice', default: 'refactor', options: [{ id: 'refactor', label: bi('ВМ перенесли в модуль', 'the VM moved into a module') }, { id: 'adopt', label: bi('ВМ создали руками', 'a VM made by hand') }], near: 'code' },
    {
      id: 'block',
      label: bi('Есть блок moved / import', 'A moved / import block exists'),
      kind: 'toggle',
      default: false,
      near: 'block',
      predict: {
        prompt: bi('Добавляем блок (moved для переноса, import для ручной ВМ). Что покажет план?', 'We add the block (moved for the move, import for the hand-made VM). What does the plan show?'),
        options: [
          { id: 'zero', text: bi('Ничего не создаст и не удалит', 'It creates and destroys nothing') },
          { id: 'same', text: bi('То же, что и без блока', 'The same as without the block') },
        ],
        resolve: (_p, n) => ((n.at(-1)?.metrics?.add ?? 0) === 0 && (n.at(-1)?.metrics?.destroy ?? 0) === 0 ? 'zero' : 'same'),
      },
    },
  ],
  breaks: [
    {
      id: 'state-lost',
      label: bi('State потерян', 'The state is lost'),
      remove: ['state', 'e-state', 'e-own'],
      predict: {
        prompt: bi('Файл state удалили. Что сделает plan с работающими ВМ?', 'The state file was deleted. What does plan do with the running VMs?'),
        options: [
          { id: 'create', text: bi('Предложит создать всё заново — рядом с работающими', 'Propose to create everything again, next to the running ones') },
          { id: 'delete', text: bi('Удалит их', 'Delete them') },
        ],
        resolve: () => 'create',
      },
    },
    {
      id: 'wrong-id',
      label: bi('В import указан чужой ID', 'The import names a wrong ID'),
      remove: ['e-adopt'],
      predict: {
        prompt: bi('В блоке import опечатка в ID. Что будет?', 'The import block has a typo in the ID. What happens?'),
        options: [
          { id: 'error', text: bi('План остановится с ошибкой: объекта нет', 'The plan stops with an error: no such object') },
          { id: 'create', text: bi('Terraform создаст объект с этим ID', 'Terraform creates an object with that ID') },
        ],
        resolve: () => 'error',
      },
    },
  ],
  metrics: [
    { id: 'add', label: bi('создать', 'to add') },
    { id: 'destroy', label: bi('удалить', 'to destroy') },
    { id: 'imported', label: bi('импортировать', 'to import') },
    { id: 'downtime', label: bi('простой сайта', 'site downtime'), unit: 's' },
  ],
  run(p, broken) {
    const n = addrNumbers(p, broken);
    const m = { add: n.add, destroy: n.destroy, imported: n.imported, downtime: n.downtime };
    const refactor = p.scenario === 'refactor';
    const steps: Step[] = [
      {
        id: 'code',
        label: bi('код', 'code'),
        caption: refactor ? bi('В коде больше нет edu_vm.web: та же ВМ описана в модуле и называется module.web.edu_vm.this.', 'The code no longer has edu_vm.web: the same VM is described in a module and is called module.web.edu_vm.this.') : bi('Во время инцидента дежурный создал в консоли vm-4f91. Вы описали её в коде как edu_vm.legacy.', 'During an incident the on-call engineer created vm-4f91 in the console. You described it in the code as edu_vm.legacy.'),
        focus: ['code', refactor ? 'vm' : 'legacy'],
        states: { code: 'on' },
        values: { code: refactor ? 'module "web" { … }' : 'resource "edu_vm" "legacy"' },
      },
    ];
    if (broken.has('state-lost')) {
      steps.push({ id: 'lost', label: 'state ✗', caption: bi('State нет: ни один адрес кода не найден, всё в коде выглядит новым.', 'There is no state: no address of the code is found, and everything in the code looks new.'), focus: ['plan', 'e-create', 'newvm'], tokens: [{ edge: 'e-create', label: '+' }], states: { plan: 'warn', newvm: 'warn' }, values: { plan: `${n.add} to add`, newvm: 'duplicate' }, metrics: m, broken: { at: 'state', message: 'Plan: ' + n.add + ' to add, 0 to change, 0 to destroy.', caption: bi('потерянный state не удаляет облако, но лишает Terraform памяти: он создаст дубли и упрётся в квоту или в занятые имена.', 'a lost state does not delete the cloud but takes away Terraform’s memory: it creates duplicates and runs into quotas or taken names.') } });
      return steps;
    }
    if (broken.has('wrong-id')) {
      steps.push({ id: 'noid', label: 'import ✗', caption: bi('Блок import называет ID, которого в облаке нет. Terraform спрашивает облако об этом объекте и не находит его.', 'The import block names an ID the cloud does not have. Terraform asks the cloud for this object and does not find it.'), focus: ['block', 'e-block', 'legacy'], states: { block: 'err' }, values: { block: 'import { id = "vm-4f19" }' }, metrics: { add: 0, destroy: 0, imported: 0, downtime: 0 }, broken: { at: 'block', message: 'Error: Cannot import non-existent remote object', caption: bi('import ничего не создаёт: он только берёт под управление то, что уже есть.', 'import creates nothing: it only takes over what already exists.') } });
      return steps;
    }
    if (p.block) {
      steps.push({
        id: 'block',
        label: refactor ? 'moved' : 'import',
        caption: refactor ? bi('Блок moved переименовывает запись state: edu_vm.web → module.web.edu_vm.this. ID тот же, vm-4f66.', 'The moved block renames the state entry: edu_vm.web → module.web.edu_vm.this. The ID is the same, vm-4f66.') : bi('Блок import читает vm-4f91 из облака и добавляет в state запись edu_vm.legacy → vm-4f91.', 'The import block reads vm-4f91 from the cloud and adds the state entry edu_vm.legacy → vm-4f91.'),
        focus: ['block', 'e-block', 'state'],
        tokens: [{ edge: 'e-block', label: refactor ? 'moved' : 'import' }],
        states: { block: 'on', state: 'ok' },
        values: { state: refactor ? 'module.web.edu_vm.this → vm-4f66' : 'edu_vm.legacy → vm-4f91' },
      });
    } else {
      steps.push({
        id: 'lookup',
        label: bi('поиск', 'lookup'),
        caption: refactor ? bi('Plan ищет module.web.edu_vm.this в state и не находит: там записан edu_vm.web, которого больше нет в коде.', 'Plan looks for module.web.edu_vm.this in the state and does not find it: the state has edu_vm.web, which is no longer in the code.') : bi('Plan ищет edu_vm.legacy в state и не находит: ВМ создана мимо Terraform.', 'Plan looks for edu_vm.legacy in the state and does not find it: the VM was made behind Terraform’s back.'),
        focus: ['state', 'e-state', 'plan'],
        tokens: [{ edge: 'e-state', label: '?' }],
        states: { state: 'warn' },
      });
    }
    steps.push({
      id: 'plan',
      label: 'plan',
      caption: refactor
        ? p.block
          ? bi('План: «edu_vm.web has moved to module.web.edu_vm.this», 0 to add, 0 to destroy. Сайт не заметит рефакторинга.', 'The plan: "edu_vm.web has moved to module.web.edu_vm.this", 0 to add, 0 to destroy. The site does not notice the refactoring.')
          : bi('План: удалить edu_vm.web и создать module.web.edu_vm.this — та же ВМ будет пересоздана, сайт ляжет на время создания.', 'The plan: destroy edu_vm.web and create module.web.edu_vm.this: the same VM is recreated and the site is down while it is created.')
        : p.block
          ? bi('План: «edu_vm.legacy will be imported», 1 to import, 0 to add. Дальше эта ВМ меняется только кодом.', 'The plan: "edu_vm.legacy will be imported", 1 to import, 0 to add. From now on the VM is changed only through the code.')
          : bi('План: создать edu_vm.legacy. В облаке станет две одинаковые ВМ, а ручная так и останется без присмотра.', 'The plan: create edu_vm.legacy. The cloud gets two identical VMs, and the hand-made one stays unwatched.'),
      focus: p.block ? ['plan'] : ['plan', 'e-create', 'newvm'],
      tokens: p.block ? [] : [{ edge: 'e-create', label: '+' }],
      states: { plan: p.block ? 'ok' : 'warn', newvm: p.block ? 'off' : 'warn', ...(refactor && !p.block ? { vm: 'err' } : {}) },
      values: { plan: `${n.add} to add, ${n.destroy} to destroy` },
      metrics: m,
    });
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    const a = last(prev);
    const b = last(next);
    if (change.kind === 'break') return change.on ? bi('Без верной записи в state Terraform не узнаёт существующий объект.', 'Without a correct state entry Terraform does not recognise the existing object.') : bi('Поломка убрана.', 'The break is removed.');
    return fmt(bi('Создать {a1} → {b1}, удалить {a2} → {b2}, простой {a3} → {b3} с.', 'To add {a1} → {b1}, to destroy {a2} → {b2}, downtime {a3} → {b3} s.'), { a1: a.add ?? 0, b1: b.add ?? 0, a2: a.destroy ?? 0, b2: b.destroy ?? 0, a3: a.downtime ?? 0, b3: b.downtime ?? 0 });
  },
});
