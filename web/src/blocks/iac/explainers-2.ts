// Explainers of the second half of the IaC block: where a host gets the value
// of a variable (the precedence ladder of roles and inventory, 06 §4.3 B1-11)
// and what an address in the state means to Terraform — moving a resource into
// a module with a moved block and adopting a hand-made machine with an import
// block (06 §5.3 B2-9, B2-11).
//
// Reading order: the precedence ladder is climbed rung by rung from the bottom,
// one step per place where the variable may be set, and the template and the
// host appear only when the value is known. The address explainers start with
// the code and terraform plan; the state, the machines and the block appear
// when the plan reaches them.

import { defineModel } from '../../core/define';
import { bi, type Bi } from '../../core/i18n';
import type { ElementState, ProcessModel, Step } from '../../core/types';
import { card } from '../git-cicd/explainers';
import { fb, hiddenExcept } from './explainers';

const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};

// ── Variable precedence ──

type VarP = { groupAll: boolean; groupWeb: boolean; hostVars: boolean; playVars: boolean; roleVars: boolean; extra: boolean };

/** The sources from the lowest step to the highest, with the value each one sets in this explainer. */
export const VAR_SOURCES = [
  { id: 'defaults', param: null, value: 80, file: 'roles/webserver/defaults/main.yml', name: bi('умолчания роли', 'the role defaults'), why: bi('это самая нижняя ступень, и её перекрывает любое другое место', 'it is the lowest step, which any other place overrides') },
  { id: 'gall', param: 'groupAll', value: 8000, file: 'group_vars/all.yml', name: bi('переменные всех хостов', 'the variables of all hosts'), why: bi('группа all стоит выше умолчаний роли', 'the all group stands above the role defaults') },
  { id: 'gweb', param: 'groupWeb', value: 8080, file: 'group_vars/web.yml', name: bi('переменные группы web', 'the variables of the web group'), why: bi('отдельная группа точнее, чем группа всех хостов', 'a particular group is more specific than the group of all hosts') },
  { id: 'hvars', param: 'hostVars', value: 8081, file: 'host_vars/web1.yml', name: bi('переменные хоста web1', 'the variables of host web1'), why: bi('один хост точнее любой группы', 'one host is more specific than any group') },
  { id: 'play', param: 'playVars', value: 8888, file: 'site.yml · vars:', name: bi('секция vars: плея', 'the play’s vars: section'), why: bi('плейбук стоит выше инвентаря', 'the playbook stands above the inventory') },
  { id: 'rvars', param: 'roleVars', value: 9090, file: 'roles/webserver/vars/main.yml', name: bi('vars роли', 'the role vars'), why: bi('vars роли стоят выше инвентаря и плея', 'role vars stand above the inventory and the play') },
  { id: 'extra', param: 'extra', value: 9000, file: '-e http_port=9000', name: bi('ключ -e в командной строке', 'the -e key on the command line'), why: bi('командная строка стоит на самой верхней ступени', 'the command line is the highest step') },
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

const ANSIBLE = bi('Значения собирает ansible-playbook на управляющей машине.', 'ansible-playbook on the control machine gathers the values.');
const rung = (id: string, label: Bi | string, sub: string, y: number, what: Bi, who: Bi, see?: string) => ({ id, label, icon: 'file' as const, sub, family: 'obj' as const, x: 24, y, w: 240, h: 56, card: card(what, who, see) });
const VAR_ALL = ['defaults', 'gall', 'gweb', 'hvars', 'play', 'rvars', 'extra', 'merge', 'tpl', 'web1', ...VAR_SOURCES.map((s) => `e-${s.id}`), 'e-render', 'e-copy'];
const G_INV = bi('Инвентарь', 'The inventory');
const G_PLAY = bi('Плейбук и роль', 'The playbook and the role');
const G_CLI = bi('Командная строка', 'The command line');

export const varModel = defineModel<VarP>({
  id: 'iac.var-precedence',
  block: 'iac',
  title: bi('Откуда хост берёт значение переменной', 'Where a host gets the value of a variable'),
  summary: bi(
    'Роль webserver пишет в конфигурацию nginx строку `listen {{ http_port }};`, а значение `http_port` может быть задано в семи местах. Ansible проходит эти места снизу вверх, как ступени лестницы, и значение с более высокой ступени перекрывает значение с более низкой. Порядок, в котором файлы прочитаны, при этом ничего не решает. Под схемой видно, какой порт в итоге получил хост web1 и в скольких местах значение было задано.',
    'The webserver role writes the line `listen {{ http_port }};` into the nginx config, and `http_port` may be set in seven places. Ansible walks these places from the bottom up, like the steps of a ladder, and a value from a higher step overrides one from a lower step. The order in which files are read decides nothing. Under the diagram you see which port host web1 finally got and in how many places the value was set.',
  ),
  intro: bi(
    'Слева стоят семь мест, где можно задать переменную, от самого слабого внизу до самого сильного вверху. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. За каждый шаг Ansible поднимается по лестнице на одну ступень, и рядом с ним видно, какое значение у переменной сейчас.\n\nКогда дойдёте до хоста web1, включите в «Параметрах» другие места и пройдите лестницу ещё раз.',
    'On the left are the seven places where the variable may be set, from the weakest at the bottom to the strongest at the top. Press “Start from the first step”, then go on with “Step forward” above the diagram: Ansible climbs one step of the ladder at a time, and next to it you see the variable’s current value.\n\nOnce you reach host web1, switch on other places in “Parameters” and climb the ladder again.',
  ),
  legend: [
    { mark: 'active', text: bi('ступень, которую Ansible читает сейчас', 'the step Ansible reads now') },
    { mark: 'say', text: bi('что Ansible нашёл на этой ступени', 'what Ansible found on this step') },
    { mark: 'token', text: bi('значение, которое передаётся дальше', 'the value handed on') },
    { mark: 'icon:file', text: bi('файл или место, где задают переменную', 'a file or place where the variable is set') },
    { mark: 'icon:process', text: bi('ansible-playbook, который собирает значения', 'ansible-playbook, which gathers the values') },
    { mark: 'icon:server', text: bi('хост web1', 'host web1') },
    { mark: 'ok', text: bi('на этой ступени значение задано', 'the value is set on this step') },
    { mark: 'pale', text: bi('на этой ступени значение не задано', 'the value is not set on this step') },
    { mark: 'err', text: bi('здесь задача остановилась', 'the task stopped here') },
  ],
  stopLabel: bi('Задача template остановилась', 'The template task stopped'),
  concepts: ['iac.role', 'iac.var-precedence'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      rung('defaults', bi('Умолчания роли', 'Role defaults'), 'http_port: 80', 440, bi('Файл defaults/main.yml роли хранит значения, которые действуют, если никто не задал другого. Это самая нижняя ступень лестницы, и её перекрывает любое другое место.', 'The role’s defaults/main.yml holds values that apply if nobody set another one. It is the lowest step of the ladder; any other place overrides it.'), bi('Файл пишет автор роли.', 'The role author writes the file.'), 'cat roles/webserver/defaults/main.yml'),
      rung('gall', 'group_vars/all.yml', 'http_port: 8000', 368, bi('Файл group_vars/all.yml задаёт переменные для всех хостов инвентаря. Они стоят выше умолчаний роли, но ниже всех остальных мест.', 'Variables for every host of the inventory. They stand above the role defaults but below every other place.'), bi('Файл пишет команда эксплуатации и хранит его рядом с инвентарём.', 'The operations team writes the file and keeps it next to the inventory.'), 'ansible-inventory --host web1'),
      rung('gweb', 'group_vars/web.yml', 'http_port: 8080', 296, bi('Файл group_vars/web.yml задаёт переменные группы web. Отдельная группа описывает хосты точнее, чем группа всех хостов, поэтому её значение перекрывает group_vars/all.', 'Variables of the web group. A particular group describes its hosts more precisely than the group of all hosts, so its value overrides group_vars/all.'), bi('Файл пишет команда эксплуатации.', 'The operations team writes the file.'), 'ansible-inventory --host web1'),
      rung('hvars', 'host_vars/web1.yml', 'http_port: 8081', 224, bi('Файл host_vars/web1.yml задаёт переменные одного хоста, web1. Хост описан точнее, чем любая группа, в которую он входит.', 'Variables of one host. A host is described more precisely than any group it belongs to.'), bi('Файл пишет команда эксплуатации.', 'The operations team writes the file.'), 'ansible-inventory --host web1'),
      rung('play', bi('vars: плея', 'Play vars:'), 'http_port: 8888', 152, bi('Секция vars: в плейбуке задаёт переменные для одного плея. Она стоит выше инвентаря, потому что плейбук сознательно задаёт значение для своего плея.', 'The vars: section of a play. It stands above the inventory, because the playbook deliberately sets the value for its play.'), bi('Секцию пишет автор плейбука.', 'The playbook author writes the section.'), 'cat site.yml'),
      rung('rvars', bi('vars роли', 'Role vars'), 'http_port: 9090', 80, bi('Файл vars/main.yml роли хранит значения, на которые роль опирается сама. Эта ступень выше инвентаря, поэтому из group_vars и host_vars её уже не перекрыть. Если положить сюда то, что пользователь роли захочет настроить, он не сможет этого сделать, и такое значение должно лежать в defaults.', 'The role’s vars/main.yml holds values the role itself relies on. This step stands above the inventory, so group_vars and host_vars can no longer override it. If you put here something the role’s user will want to tune, they cannot do so, and such a value belongs in defaults.'), bi('Файл пишет автор роли.', 'The role author writes the file.'), 'cat roles/webserver/vars/main.yml'),
      rung('extra', bi('Ключ -e', 'The -e key'), 'http_port=9000', 8, bi('Ключ -e передаёт значение из командной строки. Это самая верхняя ступень, и значение отсюда перекрывает всё остальное, поэтому ключ -e берут для разовых запусков и для CI, а постоянные настройки так не задают.', 'A value from the command line. It is the highest step and overrides everything else, so the -e key is used for one-off runs and CI, and permanent settings are not set this way.'), bi('Значение передаёт тот, кто запускает ansible-playbook.', 'Whoever runs ansible-playbook passes the value.'), 'ansible-playbook site.yml -e http_port=9000'),
      {
        id: 'merge',
        label: 'ansible-playbook',
        icon: 'process',
        sub: 'http_port = ?',
        family: 'process',
        x: 440,
        y: 224,
        w: 220,
        h: 64,
        card: card(bi('Перед каждой задачей Ansible собирает переменные хоста со всех ступеней. Если одно имя задано в нескольких местах, остаётся значение с самой высокой ступени.', 'Before every task Ansible gathers the host’s variables from all steps. If one name is set in several places, the value from the highest step remains.'), ANSIBLE, 'ansible web1 -m ansible.builtin.debug -a "var=http_port"', { url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_variables.html#understanding-variable-precedence', label: 'docs.ansible.com › variable precedence' }),
      },
      { id: 'tpl', label: 'site.conf.j2', icon: 'file', sub: 'listen {{ http_port }};', family: 'ci-source', x: 440, y: 400, w: 220, h: 64, card: card(bi('Файл site.conf.j2 служит шаблоном роли. В момент прогона Jinja2 подставляет в него итоговое значение переменной, и получается готовый файл конфигурации nginx.', 'The role’s template. At run time Jinja2 inserts the final value of the variable, and the result is a ready nginx config file.'), bi('Шаблон пишет автор роли.', 'The role author writes the template.'), 'cat roles/webserver/templates/site.conf.j2') },
      { id: 'web1', label: 'web1', icon: 'server', sub: 'listen ?;', family: 'node', x: 716, y: 224, w: 220, h: 64, card: card(bi('Ansible настраивает хост web1, и в его файл /etc/nginx/sites-enabled/site.conf попадает значение, которое победило на лестнице.', 'The managed host. Its file /etc/nginx/sites-enabled/site.conf gets the value that won on the ladder.'), bi('Файл на хост кладёт задача template роли webserver.', 'The template task of the webserver role puts the file on the host.'), 'ssh web1 cat /etc/nginx/sites-enabled/site.conf') },
    ],
    edges: [
      ...VAR_SOURCES.map((s, i) => ({ id: `e-${s.id}`, from: s.id, to: 'merge', via: [[350, 484 - i * 72 - 16] as [number, number], [350, 256] as [number, number]], label: bi(`ступень ${i + 1} из 7`, `step ${i + 1} of 7`), labelAt: 0.06, card: card(fb(bi('По этой линии приходит значение со ступени {n} из семи, то есть {w}. Значение отсюда перекрывает все значения со ступеней ниже.', 'Step {n} of seven: {w}. A value from here overrides every value from the steps below.'), { n: i + 1, w: s.name }), ANSIBLE) })),
      { id: 'e-render', from: 'merge', to: 'tpl', label: bi('подстановка в шаблон', 'rendering the template'), card: card(bi('Модуль template передаёт шаблону итоговые переменные хоста.', 'The template module hands the host’s final variables to the template.'), bi('Подстановку выполняет модуль ansible.builtin.template.', 'The ansible.builtin.template module does the rendering.')) },
      { id: 'e-copy', from: 'tpl', to: 'web1', label: bi('файл на хост', 'the file to the host'), card: card(bi('Готовый файл копируется на хост. Если он отличается от прежнего, задача отвечает changed и уведомляет handler, который перезагружает nginx.', 'The rendered file is copied to the host. If it differs from the previous one, the task answers changed and notifies the handler that reloads nginx.'), bi('Файл копирует модуль ansible.builtin.template.', 'The ansible.builtin.template module copies the file.')) },
    ],
  },
  params: [
    { id: 'groupAll', label: bi('group_vars/all.yml задаёт http_port: 8000', 'group_vars/all.yml sets http_port: 8000'), kind: 'toggle', default: false, near: 'gall', group: G_INV },
    { id: 'groupWeb', label: bi('group_vars/web.yml задаёт http_port: 8080', 'group_vars/web.yml sets http_port: 8080'), kind: 'toggle', default: true, near: 'gweb', group: G_INV },
    {
      id: 'hostVars',
      label: bi('host_vars/web1.yml задаёт http_port: 8081', 'host_vars/web1.yml sets http_port: 8081'),
      kind: 'toggle',
      default: false,
      near: 'hvars',
      group: G_INV,
      predict: {
        prompt: bi('Вы добавляете файл host_vars/web1.yml, в котором записано http_port: 8081. Какой порт получит web1, если остальные места останутся такими, как включено сейчас?', 'You add the file host_vars/web1.yml, which says http_port: 8081. Which port will web1 get if the other places stay as they are switched on now?'),
        options: [
          { id: 'host', text: bi('8081, потому что значение хоста точнее значения группы', '8081, because a host value is more specific than a group value') },
          { id: 'group', text: bi('8080, потому что файл группы Ansible прочитал последним', '8080, because Ansible read the group file last') },
          { id: 'higher', text: bi('Другой порт, потому что выше на лестнице значение уже задано', 'Another port, because a higher step already sets a value') },
        ],
        resolve: (_p, n) => {
          const port = String(last(n).port);
          return port === '8081' ? 'host' : port === '8080' ? 'group' : 'higher';
        },
      },
    },
    { id: 'playVars', label: bi('секция vars: плея задаёт http_port: 8888', 'the play’s vars: section sets http_port: 8888'), kind: 'toggle', default: false, near: 'play', group: G_PLAY },
    {
      id: 'roleVars',
      label: bi('vars/main.yml роли задаёт http_port: 9090', 'the role’s vars/main.yml sets http_port: 9090'),
      kind: 'toggle',
      default: false,
      near: 'rvars',
      group: G_PLAY,
      predict: {
        prompt: bi('Автор роли записал http_port: 9090 в vars/main.yml, а не в defaults. Будет ли после этого действовать порт, который команда задала в инвентаре, в group_vars или host_vars?', 'The role author wrote http_port: 9090 into vars/main.yml instead of defaults. Will the port the team set in the inventory, in group_vars or host_vars, still apply?'),
        options: [
          { id: 'lost', text: bi('Нет, потому что vars роли стоят на лестнице выше инвентаря и перекрывают его', 'No, because role vars stand above the inventory on the ladder and override it') },
          { id: 'kept', text: bi('Да, потому что инвентарь всегда важнее роли', 'Yes, because the inventory always matters more than the role') },
        ],
        resolve: () => 'lost',
      },
    },
    { id: 'extra', label: bi('запуск с ключом -e http_port=9000', 'a run with -e http_port=9000'), kind: 'toggle', default: false, near: 'extra', group: G_CLI },
  ],
  breaks: [
    {
      id: 'typo',
      label: bi('В шаблоне опечатка: {{ http_prot }}', 'A typo in the template: {{ http_prot }}'),
      remove: ['e-render'],
      boundary: 'io',
      predict: {
        prompt: bi('В шаблоне вместо {{ http_port }} написали {{ http_prot }}. Переменной с таким именем нет ни на одной ступени. Что сделает Ansible?', 'The template says {{ http_prot }} instead of {{ http_port }}. No step has a variable with that name. What will Ansible do?'),
        options: [
          { id: 'fail', text: bi('Задача template остановится с ошибкой, потому что переменная не определена', 'The template task stops with an error, because the variable is undefined') },
          { id: 'empty', text: bi('Ansible подставит пустую строку и запишет файл', 'Ansible inserts an empty string and writes the file') },
          { id: 'default', text: bi('Ansible возьмёт значение из умолчаний роли', 'Ansible takes the value from the role defaults') },
        ],
        resolve: () => 'fail',
      },
    },
  ],
  metrics: [
    { id: 'port', label: bi('порт nginx на web1', 'the nginx port on web1') },
    { id: 'sources', label: bi('мест, где задано значение', 'places that set the value') },
  ],
  run(p, broken) {
    const steps: Step[] = [];
    let cur = 0;
    let set = 0;
    let curName: Bi = VAR_SOURCES[0].name;
    VAR_SOURCES.forEach((s, i) => {
      const on = !s.param || p[s.param];
      const edge = `e-${s.id}`;
      if (!on) {
        steps.push({
          id: `s-${s.id}`,
          label: s.id === 'extra' ? '-e' : s.id,
          caption: fb(bi('Ansible поднимается на ступень {n}, {w}. Переменная http_port здесь не задана, поэтому значение остаётся прежним, то есть {v} из места «{c}».', 'Ansible climbs to step {n}, {w}. http_port is not set here, so the value stays as it was, that is {v} from “{c}”.'), { n: i + 1, w: s.name, v: cur, c: curName }),
          focus: [s.id, 'merge'],
          reveal: [s.id, edge],
          values: { [s.id]: '—' },
          say: { merge: fb(bi('На ступени «{w}» переменная http_port не задана, и Ansible оставляет {v}.', 'On the step “{w}” http_port is not set, and Ansible keeps {v}.'), { w: s.name, v: cur }) },
          states: { [s.id]: 'off', [edge]: 'off' },
        });
        return;
      }
      set++;
      const prev = cur;
      cur = s.value;
      curName = s.name;
      steps.push({
        id: `s-${s.id}`,
        label: s.id === 'extra' ? '-e' : s.id,
        caption: prev
          ? fb(bi('Ansible поднимается на ступень {n}, {w}. Здесь задано http_port: {v}, и это значение перекрывает прежнее {a}, потому что {y}.', 'Ansible climbs to step {n}, {w}. It sets http_port: {v}, and this value overrides the previous {a}, because {y}.'), { n: i + 1, w: s.name, v: s.value, a: prev, y: s.why })
          : fb(bi('Ansible начинает с нижней ступени, с умолчаний роли в файле {f}. Там задано http_port: {v}, и это значение действует, пока выше его никто не перекроет.', 'Ansible starts at the bottom step, the role defaults in {f}. They set http_port: {v}, and this value applies until a higher step overrides it.'), { f: s.file, v: s.value }),
        focus: [s.id, edge, 'merge'],
        reveal: [s.id, edge],
        tokens: [{ edge, label: `http_port: ${s.value}` }],
        say: { merge: prev ? fb(bi('Значение {v} со ступени «{w}» заменяет {a}.', 'The value {v} from the step “{w}” replaces {a}.'), { v: s.value, w: s.name, a: prev }) : fb(bi('Ansible берёт значение {v} из умолчаний роли.', 'Ansible takes the value {v} from the role defaults.'), { v: s.value }) },
        values: { merge: `http_port = ${cur}` },
        states: { ...(i === 0 ? hiddenExcept(VAR_ALL, 'merge', s.id, edge) : {}), [s.id]: 'ok', [edge]: 'ok' } as Record<string, ElementState>,
      });
    });
    if (broken.has('typo')) {
      steps.push({
        id: 'fail',
        label: 'template',
        caption: bi('Модуль template подставляет переменные в шаблон, но шаблон обращается к имени http_prot, а такой переменной нет ни на одной ступени. Задача останавливается на всех хостах, и файл конфигурации на них не меняется.', 'The template module fills the template, but the template refers to the name http_prot, and no step has such a variable. The task stops on every host, and the config file on them does not change.'),
        focus: ['e-render', 'tpl'],
        reveal: ['tpl', 'e-render'],
        tokens: [{ edge: 'e-render', label: 'http_prot?' }],
        say: { tpl: bi('Jinja2 ищет переменную http_prot, не находит её и останавливает подстановку.', 'Jinja2 looks for the variable http_prot, does not find it and stops rendering.') },
        states: { tpl: 'err', 'e-render': 'err' },
        metrics: { port: 0, sources: set },
        broken: { at: 'tpl', message: "fatal: [web1]: FAILED! => {\"changed\": false, \"msg\": \"AnsibleUndefinedVariable: 'http_prot' is undefined\"}", caption: bi('Неизвестное имя в шаблоне Ansible считает ошибкой, а не пустой строкой. Поэтому опечатка не попадает на рабочие серверы незаметно: её узнают по сообщению AnsibleUndefinedVariable с именем переменной.', 'Ansible treats an unknown name in a template as an error, not as an empty string. So a typo does not reach the production servers unnoticed: you recognise it by the AnsibleUndefinedVariable message with the variable’s name.') },
      });
      return steps;
    }
    steps.push(
      {
        id: 'render',
        label: 'template',
        caption: fb(bi('Лестница пройдена, и итоговое значение равно {v}. Модуль template подставляет его в шаблон, и в готовом файле появляется строка «listen {v};».', 'The ladder is climbed, and the final value is {v}. The template module inserts it into the template, and the rendered file gets the line “listen {v};”.'), { v: cur }),
        focus: ['e-render', 'tpl'],
        reveal: ['tpl', 'e-render'],
        tokens: [{ edge: 'e-render', label: `http_port = ${cur}` }],
        say: { tpl: fb(bi('Jinja2 подставляет в шаблон значение {v} со ступени «{w}».', 'Jinja2 inserts the value {v} from the step “{w}” into the template.'), { v: cur, w: curName }) },
        states: { tpl: 'ok' },
        values: { tpl: `listen ${cur};` },
      },
      {
        id: 'host',
        label: 'web1',
        caption: fb(bi('Готовый файл копируется на web1, и nginx на этом хосте будет слушать порт {v}. Победило значение со ступени «{w}», самой высокой из тех, где переменная задана.', 'The rendered file is copied to web1, and nginx on this host will listen on port {v}. The value from the step “{w}” won, the highest of the steps that set the variable.'), { v: cur, w: curName }),
        focus: ['e-copy', 'web1'],
        reveal: ['web1', 'e-copy'],
        tokens: [{ edge: 'e-copy', label: 'site.conf' }],
        say: { web1: fb(bi('На web1 записан файл site.conf со строкой «listen {v};».', 'web1 now has site.conf with the line “listen {v};”.'), { v: cur }) },
        states: { web1: 'ok' },
        values: { web1: `listen ${cur};` },
        metrics: { port: cur, sources: set },
      },
    );
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break') return change.on ? bi('Неизвестная переменная в шаблоне останавливает задачу template на всех хостах.', 'An unknown variable in the template stops the template task on every host.') : bi('Опечатку в шаблоне исправили, и задача снова записывает файл.', 'The typo in the template is fixed, and the task writes the file again.');
    const a = last(prev).port ?? 0;
    const b = last(next).port ?? 0;
    if (a === b) return fb(bi('Порт на web1 не изменился и остался {v}, потому что выше на лестнице уже есть место, где значение задано.', 'The port on web1 did not change and stays {v}, because a higher step already sets a value.'), { v: b });
    return fb(bi('Порт на web1 изменился с {a} на {b}, потому что теперь побеждает другая ступень, самая высокая из тех, где значение задано.', 'The port on web1 went from {a} to {b}, because another step now wins, the highest of the steps that set the value.'), { a, b });
  },
});

// ── The address: moved and import ──

type AddrP = { block: boolean };

/** What the plan does in each situation: refactor (moved) or adopt (import). */
export function addrNumbers(scenario: 'refactor' | 'adopt', block: boolean, broken: ReadonlySet<string>): { add: number; destroy: number; imported: number; downtime: number; vms: number } {
  if (broken.has('state-lost')) return scenario === 'refactor' ? { add: 1, destroy: 0, imported: 0, downtime: 0, vms: 2 } : { add: 2, destroy: 0, imported: 0, downtime: 0, vms: 4 };
  if (scenario === 'refactor') return block ? { add: 0, destroy: 0, imported: 0, downtime: 0, vms: 1 } : { add: 1, destroy: 1, imported: 0, downtime: 40, vms: 1 };
  return block ? { add: 0, destroy: 0, imported: 1, downtime: 0, vms: 2 } : { add: 1, destroy: 0, imported: 0, downtime: 0, vms: 3 };
}

const TF = bi('Эту работу выполняет terraform plan.', 'terraform plan does this work.');
const M_ADD = { id: 'add', label: bi('будет создано машин', 'machines to add') };
const MOVED_METRICS = [M_ADD, { id: 'destroy', label: bi('будет удалено машин', 'machines to destroy') }, { id: 'downtime', label: bi('сайт простоит без сервера', 'the site stays without a server'), unit: 's' }];
const IMPORT_METRICS = [M_ADD, { id: 'imported', label: bi('машин перейдёт под управление кода', 'machines to import') }];
const ADDR_LEGEND = (machine: Bi) => [
  { mark: 'active' as const, text: bi('участник, который работает сейчас', 'the participant working now') },
  { mark: 'say' as const, text: bi('что этот участник делает', 'what that participant does') },
  { mark: 'token' as const, text: bi('что передаётся дальше: адрес, запись state, действие плана', 'what is handed on: an address, a state entry, a plan action') },
  { mark: 'icon:file' as const, text: bi('код и блок, который правит state', 'the code and the block that edits the state') },
  { mark: 'icon:database' as const, text: bi('файл state с таблицей «адрес и ID в облаке»', 'the state file with its table of addresses and cloud IDs') },
  { mark: 'icon:process' as const, text: bi('terraform plan', 'terraform plan') },
  { mark: 'icon:server' as const, text: machine },
  { mark: 'ok' as const, text: bi('этап пройден, машина остаётся прежней', 'stage passed, the machine stays the same') },
  { mark: 'warn' as const, text: bi('план создаст лишнюю машину', 'the plan will create an extra machine') },
  { mark: 'err' as const, text: bi('машину удалят, или план остановился с ошибкой', 'the machine will be destroyed, or the plan stopped with an error') },
];

const ADDR_ALL = ['code', 'block', 'state', 'plan', 'vm', 'newvm', 'e-code', 'e-block', 'e-state', 'e-own', 'e-create'];

function addrDiagram(adopt: boolean): ProcessModel<AddrP>['diagram'] {
  const vmNode = adopt
    ? { id: 'vm', label: 'vm-4f91', icon: 'server' as const, sub: 'source: console', family: 'node' as const, x: 716, y: 40, w: 220, h: 64, card: card(bi('Машина, которую дежурный создал в консоли облака во время ночного инцидента. В state её нет, поэтому для Terraform её не существует, и управлять ею он не может.', 'A machine the on-call engineer created in the cloud console during a night incident. It is not in the state, so for Terraform it does not exist, and it cannot manage it.'), bi('Машину создал дежурный в консоли облака.', 'The on-call engineer created it in the cloud console.'), 'edu vm get vm-4f91') }
    : { id: 'vm', label: 'vm-4f66', icon: 'server' as const, sub: 'status: running', family: 'node' as const, x: 716, y: 40, w: 220, h: 64, card: card(bi('Машина vm-4f66 обслуживает сайт. Terraform создал её раньше под адресом edu_vm.web, и в state записано, что этому адресу соответствует ID vm-4f66.', 'The site’s running machine. Terraform created it earlier at the address edu_vm.web, and the state records that this address corresponds to the ID vm-4f66.'), bi('Машину создал terraform apply.', 'terraform apply created it.'), 'edu vm get vm-4f66') };
  return {
    width: 960,
    height: 430,
    nodes: [
      {
        id: 'code',
        label: 'main.tf',
        icon: 'file',
        sub: adopt ? 'resource "edu_vm" "legacy"' : 'module "web" { … }',
        family: 'ci-source',
        x: 24,
        y: 40,
        w: 240,
        h: 64,
        card: adopt
          ? card(bi('Код, в котором вы описали ручную машину блоком `resource "edu_vm" "legacy"` с её настоящими атрибутами: тем же образом, тем же числом ядер и той же сетью.', 'The code where you described the hand-made machine with a `resource "edu_vm" "legacy"` block with its real attributes: the same image, the same cores and the same network.'), bi('Код пишете вы.', 'You write the code.'), 'cat main.tf')
          : card(bi('Код переписали, и теперь машина сайта описана не отдельным блоком resource, а в модуле web, поэтому её адрес в коде стал module.web.edu_vm.this.', 'The code after refactoring. The site’s machine is now described not by a separate resource block but in the web module, so its address in the code became module.web.edu_vm.this.'), bi('Код пишете вы.', 'You write the code.'), 'terraform state list'),
      },
      {
        id: 'block',
        label: adopt ? bi('Блок import', 'The import block') : bi('Блок moved', 'The moved block'),
        icon: 'file',
        sub: adopt ? 'import { to, id }' : 'moved { from, to }',
        family: 'ci-build',
        x: 24,
        y: 210,
        w: 240,
        h: 64,
        card: adopt
          ? card(bi('Блок, который говорит Terraform: «объект облака с этим ID теперь соответствует адресу edu_vm.legacy». Блок ничего не создаёт в облаке, он только добавляет запись в state.', 'A block that tells Terraform: “the cloud object with this ID now corresponds to the address edu_vm.legacy”. It creates nothing in the cloud, it only adds an entry to the state.'), bi('Блок пишете вы рядом с кодом. После применения его можно удалить.', 'You write the block next to the code. After the apply it may be removed.'), undefined, { url: 'https://opentofu.org/docs/language/import/', label: 'opentofu.org › import' })
          : card(bi('Блок, который говорит Terraform: «объект, записанный под адресом edu_vm.web, теперь находится по адресу module.web.edu_vm.this». Блок ничего не меняет в облаке, он только переименовывает запись в state.', 'A block that tells Terraform: “the object recorded at edu_vm.web is now at module.web.edu_vm.this”. It changes nothing in the cloud, it only renames the entry in the state.'), bi('Блок пишете вы рядом с кодом. Удалять его стоит не раньше, чем код применят во всех окружениях.', 'You write the block next to the code. Remove it no earlier than the code has been applied in every environment.'), undefined, { url: 'https://opentofu.org/docs/language/modules/develop/refactoring/', label: 'opentofu.org › refactoring' }),
      },
      { id: 'state', label: 'terraform.tfstate', icon: 'database', sub: 'edu_vm.web → vm-4f66', family: 'obj', x: 370, y: 140, w: 240, h: 64, card: card(bi('Таблица, в которой каждому адресу из кода соответствует ID объекта в облаке. По этой таблице Terraform решает, какой объект в облаке относится к блоку в коде.', 'A table in which every address from the code corresponds to the ID of a cloud object. Terraform uses this table to decide which cloud object belongs to a block in the code.'), bi('Таблицу пишут terraform apply, блоки import и moved и команда terraform state mv.', 'terraform apply, the import and moved blocks and terraform state mv write the table.'), 'terraform state list') },
      { id: 'plan', label: 'terraform plan', icon: 'process', work: 'spin', sub: '?', family: 'process', x: 370, y: 300, w: 240, h: 64, card: card(bi('Программа, которая сравнивает адреса из кода с адресами в state. Если адрес из кода в state не найден, план предлагает создать объект, а если в state есть адрес, которого нет в коде, план предлагает удалить объект.', 'The program that compares the addresses from the code with those in the state. If an address from the code is not found in the state, the plan proposes to create an object; if the state has an address the code lacks, the plan proposes to destroy the object.'), bi('Plan запускаете вы или пайплайн CI.', 'You or a CI pipeline run the plan.'), 'terraform plan') },
      vmNode,
      { id: 'newvm', label: bi('Новая машина', 'A new machine'), icon: 'server', sub: '(known after apply)', family: 'neutral', x: 716, y: 330, w: 220, h: 64, card: card(bi('Машина, которую Terraform создаст, если не узнает существующую. Она окажется либо дублем ручной машины, либо заменой работающей.', 'The machine Terraform creates if it does not recognise the existing one. It turns out to be either a duplicate of the hand-made machine or a replacement of the running one.'), bi('Её создаст terraform apply, если план так решит.', 'terraform apply creates it if the plan says so.')) },
    ],
    edges: [
      { id: 'e-code', from: 'code', to: 'plan', via: [[310, 72], [310, 332]], labelAt: 0.75, label: bi('адреса из кода', 'addresses from the code'), card: card(bi('Код сообщает плану, какие адреса должны существовать.', 'The code tells the plan which addresses must exist.'), TF) },
      { id: 'e-block', from: 'block', to: 'state', label: adopt ? bi('новая запись', 'a new entry') : bi('новое имя записи', 'a new name for the entry'), card: card(adopt ? bi('Блок import добавляет в state запись с ID существующей машины.', 'The import block adds an entry with the existing machine’s ID to the state.') : bi('Блок moved переименовывает запись в state, а ID в ней остаётся прежним.', 'The moved block renames the entry in the state, and the ID in it stays the same.'), TF) },
      { id: 'e-state', from: 'state', to: 'plan', label: bi('поиск адреса', 'looking up the address'), card: card(bi('План ищет каждый адрес из кода в state. Если адреса там нет, объект придётся создать.', 'The plan looks up every address from the code in the state. If an address is not there, the object has to be created.'), TF) },
      { id: 'e-own', from: 'state', to: 'vm', dashed: adopt, label: adopt ? bi('записи пока нет', 'no entry yet') : bi('адрес и ID', 'address and ID'), card: card(adopt ? bi('Пока в state нет записи с ID vm-4f91, Terraform ничего не знает об этой машине и не управляет ею.', 'Until the state has an entry with the ID vm-4f91, Terraform knows nothing about this machine and does not manage it.') : bi('Запись в state связывает адрес с ID vm-4f66.', 'The state entry links the address with the ID vm-4f66.'), TF) },
      { id: 'e-create', from: 'plan', to: 'newvm', label: bi('создание', 'creation'), card: card(bi('Если адрес из кода не найден в state, план предлагает создать новый объект.', 'If an address from the code is not found in the state, the plan proposes to create a new object.'), bi('Создание выполнит terraform apply.', 'terraform apply does the creation.')) },
    ],
  };
}

const lostBreak = (adopt: boolean) => ({
  id: 'state-lost',
  label: bi('Файл terraform.tfstate удалили', 'The terraform.tfstate file was deleted'),
  remove: ['state', 'e-state', 'e-own'],
  boundary: 'storage' as const,
  predict: {
    prompt: adopt
      ? bi('Файл state удалили, а машины vm-4f66 и vm-4f91 продолжают работать. Что предложит plan?', 'The state file was deleted, while vm-4f66 and vm-4f91 keep running. What will plan propose?')
      : bi('Файл state удалили, а машина vm-4f66 продолжает работать. Что предложит plan?', 'The state file was deleted, while vm-4f66 keeps running. What will plan propose?'),
    options: [
      { id: 'create', text: bi('Создать машины заново рядом с теми, что работают', 'Create the machines again next to the running ones') },
      { id: 'delete', text: bi('Удалить работающие машины', 'Destroy the running machines') },
    ],
    resolve: () => 'create',
  },
});

export const addrModel = defineModel<AddrP>({
  id: 'iac.address',
  block: 'iac',
  title: bi('Как блок moved переносит машину в модуль без пересоздания', 'How a moved block carries a machine into a module without recreating it'),
  summary: bi(
    'Вы перенесли описание машины сайта в модуль, и её адрес в коде сменился с edu_vm.web на module.web.edu_vm.this. Terraform узнаёт свои объекты только по адресу в state, поэтому без подсказки новый адрес для него означает новую машину. Блок moved переименовывает запись в state, не трогая облако. Под схемой считается, сколько машин план создаст и удалит и сколько секунд сайт останется без сервера.',
    'You moved the description of the site’s machine into a module, and its address in the code changed from edu_vm.web to module.web.edu_vm.this. Terraform recognises its objects only by the address in the state, so without a hint a new address means a new machine to it. A moved block renames the entry in the state without touching the cloud. Under the diagram you see how many machines the plan creates and destroys and how many seconds the site spends without a server.',
  ),
  intro: bi(
    'Схема соберётся у вас на глазах: сейчас на ней только код и terraform plan. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного участника говорит, что он делает, а карточка на линии показывает, что он передаёт дальше.\n\nСначала пройдите план без блока moved, а потом включите блок в «Параметрах» и сравните.',
    'The diagram builds itself as you go: now it shows only the code and terraform plan. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted participant says what it does, and the card on the line shows what it hands on.\n\nWalk the plan without the moved block first, then switch the block on in “Parameters” and compare.',
  ),
  legend: ADDR_LEGEND(bi('машина сайта в облаке', 'the site’s machine in the cloud')),
  stopLabel: bi('План остановился', 'The plan stopped'),
  concepts: ['iac.state', 'iac.moved'],
  diagram: addrDiagram(false),
  params: [
    {
      id: 'block',
      label: bi('В коде есть блок moved { from = edu_vm.web, to = module.web.edu_vm.this }', 'The code has moved { from = edu_vm.web, to = module.web.edu_vm.this }'),
      kind: 'toggle',
      default: false,
      near: 'block',
      group: bi('Что написано в коде', 'What the code says'),
      predict: {
        prompt: bi('Вы добавляете блок moved, который говорит, что edu_vm.web теперь называется module.web.edu_vm.this. Что покажет план?', 'You add a moved block saying that edu_vm.web is now called module.web.edu_vm.this. What will the plan show?'),
        options: [
          { id: 'zero', text: bi('Ни одной машины не создаст и не удалит, только переименует запись в state', 'It creates and destroys no machine and only renames the state entry') },
          { id: 'same', text: bi('То же, что и без блока, то есть удалит работающую машину и создаст новую', 'The same as without the block: it destroys the running machine and creates a new one') },
        ],
        resolve: (_p, n) => ((last(n).add ?? 0) === 0 && (last(n).destroy ?? 0) === 0 ? 'zero' : 'same'),
      },
    },
  ],
  breaks: [
    lostBreak(false),
    {
      id: 'old-block',
      label: bi('Старый блок resource для edu_vm.web забыли удалить из кода', 'The old resource block for edu_vm.web was left in the code'),
      remove: ['e-block'],
      boundary: 'storage',
      predict: {
        prompt: bi('Вы добавили блок moved, но забыли удалить из кода старый блок resource для edu_vm.web. Что скажет plan?', 'You added the moved block but forgot to remove the old resource block for edu_vm.web from the code. What will plan say?'),
        options: [
          { id: 'error', text: bi('План остановится с ошибкой, потому что старый адрес всё ещё описан в коде', 'The plan stops with an error, because the old address is still described in the code') },
          { id: 'two', text: bi('План создаст вторую машину для нового адреса', 'The plan creates a second machine for the new address') },
        ],
        resolve: () => 'error',
      },
    },
  ],
  metrics: MOVED_METRICS,
  run(p, broken) {
    const lost = broken.has('state-lost');
    const oldBlock = broken.has('old-block');
    const block = p.block || oldBlock;
    const n = addrNumbers('refactor', block, broken);
    const m = { add: n.add, destroy: n.destroy, imported: n.imported, downtime: n.downtime };
    const steps: Step[] = [
      {
        id: 'code',
        label: bi('код', 'code'),
        caption: bi('terraform plan читает код. Блока `resource "edu_vm" "web"` в нём больше нет, потому что та же машина теперь описана в модуле web и её адрес стал module.web.edu_vm.this.', 'terraform plan reads the code. There is no `resource "edu_vm" "web"` block in it any more, because the same machine is now described in the web module and its address became module.web.edu_vm.this.'),
        focus: ['e-code', 'plan'],
        tokens: [{ edge: 'e-code', label: 'module.web.edu_vm.this' }],
        say: { plan: bi('Terraform находит в коде адрес module.web.edu_vm.this и собирается найти его в state.', 'Terraform finds the address module.web.edu_vm.this in the code and is about to look it up in the state.') },
        states: hiddenExcept(ADDR_ALL, 'code', 'plan', 'e-code'),
      },
    ];
    if (lost) {
      steps.push({
        id: 'lost',
        label: 'state',
        caption: bi('Файла state нет, поэтому ни один адрес из кода в нём не найден. План считает машину сайта новой и предлагает создать её рядом с той, что работает.', 'There is no state file, so no address from the code is found in it. The plan treats the site’s machine as new and proposes to create it next to the running one.'),
        focus: ['e-create', 'newvm'],
        reveal: ['state', 'newvm', 'e-create'],
        tokens: [{ edge: 'e-create', label: '+ create' }],
        say: { plan: bi('Terraform не находит адреса module.web.edu_vm.this в state, потому что файла state нет, и предлагает создать машину.', 'Terraform does not find module.web.edu_vm.this in the state, because there is no state file, and proposes to create the machine.') },
        states: { state: 'err', plan: 'warn', newvm: 'warn' },
        values: { state: '—', plan: `${n.add} to add`, newvm: 'duplicate' },
        metrics: m,
        broken: { at: 'state', message: `Plan: ${n.add} to add, 0 to change, 0 to destroy.`, caption: bi('Потеря state не удаляет ничего в облаке, но лишает Terraform памяти. Он создаст дубли и упрётся в квоту или в занятые имена, а работающие машины останутся без присмотра.', 'Losing the state deletes nothing in the cloud but takes away Terraform’s memory. It creates duplicates and runs into quotas or taken names, while the running machines are left unmanaged.') },
      });
      return steps;
    }
    if (oldBlock) {
      steps.push({
        id: 'error',
        label: 'moved',
        caption: bi('Блок moved переносит объект с адреса edu_vm.web, но этот адрес всё ещё описан в коде старым блоком resource. Terraform не может решить, что делать с таким кодом, и останавливает план с ошибкой.', 'The moved block carries the object away from edu_vm.web, but that address is still described in the code by the old resource block. Terraform cannot decide what to do with such code and stops the plan with an error.'),
        focus: ['block'],
        reveal: ['block'],
        say: { block: bi('Блок moved указывает на адрес edu_vm.web, который в коде по-прежнему описан, и Terraform отказывается переносить объект.', 'The moved block points at edu_vm.web, which is still described in the code, and Terraform refuses to move the object.') },
        states: { block: 'err', plan: 'err' },
        metrics: { add: 0, destroy: 0, imported: 0, downtime: 0 },
        broken: { at: 'block', message: 'Error: Moved object still exists', caption: bi('Эта ошибка значит, что в коде описаны оба адреса, старый и новый. Удалите старый блок resource, и план покажет только переименование.', 'This error means the code describes both addresses, the old and the new one. Remove the old resource block, and the plan shows only the rename.') },
      });
      return steps;
    }
    if (block) {
      steps.push({
        id: 'moved',
        label: 'moved',
        caption: bi('Перед сравнением Terraform выполняет блок moved и переименовывает запись в state. Адрес edu_vm.web становится адресом module.web.edu_vm.this, а ID в записи остаётся прежним, vm-4f66.', 'Before the comparison Terraform runs the moved block and renames the state entry. The address edu_vm.web becomes module.web.edu_vm.this, and the ID in the entry stays the same, vm-4f66.'),
        focus: ['e-block', 'state'],
        reveal: ['block', 'e-block', 'state'],
        tokens: [{ edge: 'e-block', label: 'edu_vm.web → module.web.edu_vm.this' }],
        say: { state: bi('В state запись с ID vm-4f66 теперь называется module.web.edu_vm.this.', 'In the state the entry with ID vm-4f66 is now called module.web.edu_vm.this.') },
        states: { block: 'ok', state: 'ok' },
        values: { state: 'module.web.edu_vm.this → vm-4f66' },
      });
      steps.push({
        id: 'lookup',
        label: bi('поиск', 'lookup'),
        caption: bi('План ищет адрес module.web.edu_vm.this в state и находит его вместе с ID vm-4f66. Значит, это та же работающая машина, и пересоздавать её не нужно.', 'The plan looks up module.web.edu_vm.this in the state and finds it with the ID vm-4f66. So it is the same running machine, and it need not be recreated.'),
        focus: ['e-state', 'plan'],
        reveal: ['e-state', 'vm', 'e-own'],
        tokens: [{ edge: 'e-state', label: 'vm-4f66' }],
        say: { plan: bi('Terraform находит новый адрес в state и узнаёт по нему машину vm-4f66.', 'Terraform finds the new address in the state and recognises the machine vm-4f66 by it.') },
        states: { vm: 'ok' },
      });
    } else {
      steps.push({
        id: 'lookup',
        label: bi('поиск', 'lookup'),
        caption: bi('План ищет адрес module.web.edu_vm.this в state и не находит его. Там записан старый адрес edu_vm.web, которого в коде больше нет, и одинаковые атрибуты машин Terraform не сравнивает.', 'The plan looks up module.web.edu_vm.this in the state and does not find it. The state holds the old address edu_vm.web, which the code no longer has, and Terraform does not compare the machines’ attributes.'),
        focus: ['e-state', 'plan'],
        reveal: ['state', 'e-state'],
        tokens: [{ edge: 'e-state', label: 'module.web.edu_vm.this?' }],
        say: { plan: bi('Terraform не находит адреса module.web.edu_vm.this в state и считает, что такой машины ещё нет.', 'Terraform does not find module.web.edu_vm.this in the state and assumes no such machine exists yet.') },
        states: { state: 'warn' },
      });
    }
    steps.push({
      id: 'plan',
      label: 'plan',
      caption: block
        ? bi('План сообщает «# edu_vm.web has moved to module.web.edu_vm.this» и ничего не создаёт и не удаляет, так что сайт не заметит, что код машины перенесли в модуль.', 'The plan reports “# edu_vm.web has moved to module.web.edu_vm.this” and creates and destroys nothing, so the site does not notice that the machine’s code moved into a module.')
        : bi('План предлагает удалить edu_vm.web, то есть работающую машину vm-4f66, и создать module.web.edu_vm.this заново. Новая машина загружается около 40 секунд, и всё это время сайту отвечать некому.', 'The plan proposes to destroy edu_vm.web, that is the running machine vm-4f66, and to create module.web.edu_vm.this anew. The new machine boots for about 40 seconds, and all that time nobody answers for the site.'),
      focus: block ? ['plan'] : ['e-create', 'newvm'],
      reveal: block ? [] : ['vm', 'e-own', 'newvm', 'e-create'],
      tokens: block ? [] : [{ edge: 'e-create', label: '+ create' }],
      say: block ? { plan: bi('Terraform сравнивает код с переименованной записью и не находит ни одного отличия.', 'Terraform compares the code with the renamed entry and finds no difference.') } : { newvm: bi('По плану на месте работающей машины появится новая, а старую vm-4f66 удалят.', 'According to the plan a new machine takes the place of the running one, and the old vm-4f66 is destroyed.') },
      states: block ? { plan: 'ok' } : { plan: 'warn', newvm: 'warn', vm: 'err' },
      values: { plan: `${n.add} to add, ${n.destroy} to destroy` },
      metrics: m,
    });
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    const a = last(prev);
    const b = last(next);
    if (change.kind === 'break') return change.on ? (change.id === 'state-lost' ? bi('Без файла state Terraform не узнаёт работающую машину и предлагает создать её дубль.', 'Without the state file Terraform does not recognise the running machine and proposes to create a duplicate.') : bi('В коде описаны оба адреса, и план останавливается с ошибкой «Moved object still exists».', 'The code describes both addresses, and the plan stops with “Moved object still exists”.')) : bi('Поломку убрали, и план снова доходит до конца.', 'The break is removed, and the plan goes to the end again.');
    return fb(bi('Число машин, которые план создаст, изменилось с {a1} на {b1}, а число машин, которые он удалит, изменилось с {a2} на {b2}. Сайт теперь остаётся без сервера {b3} с вместо {a3} с.', 'The number of machines the plan creates went from {a1} to {b1}, and the number it destroys went from {a2} to {b2}. The site is now without a server for {b3} s instead of {a3} s.'), { a1: a.add ?? 0, b1: b.add ?? 0, a2: a.destroy ?? 0, b2: b.destroy ?? 0, a3: a.downtime ?? 0, b3: b.downtime ?? 0 });
  },
});

export const importModel = defineModel<AddrP>({
  id: 'iac.import-plan',
  block: 'iac',
  title: bi('Как блок import берёт под управление машину, созданную вручную', 'How an import block takes over a machine made by hand'),
  summary: bi(
    'Ночью дежурный создал в консоли облака машину vm-4f91, и вы описали её в коде как edu_vm.legacy. Для Terraform существует только то, что записано в state, поэтому без подсказки он создаст вторую такую же машину. Блок import добавляет в state запись с ID существующей машины и ничего не создаёт. Под схемой считается, сколько машин план создаст и сколько возьмёт под управление.',
    'At night the on-call engineer created the machine vm-4f91 in the cloud console, and you described it in the code as edu_vm.legacy. For Terraform only what is in the state exists, so without a hint it creates a second identical machine. An import block adds an entry with the existing machine’s ID to the state and creates nothing. Under the diagram you see how many machines the plan creates and how many it takes over.',
  ),
  intro: bi(
    'Схема соберётся у вас на глазах: сейчас на ней только код и terraform plan. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного участника говорит, что он делает, а карточка на линии показывает, что он передаёт дальше.\n\nСначала пройдите план без блока import, а потом включите блок в «Параметрах» и сравните.',
    'The diagram builds itself as you go: now it shows only the code and terraform plan. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted participant says what it does, and the card on the line shows what it hands on.\n\nWalk the plan without the import block first, then switch the block on in “Parameters” and compare.',
  ),
  legend: ADDR_LEGEND(bi('машина, созданная в консоли', 'the machine made in the console')),
  stopLabel: bi('План остановился', 'The plan stopped'),
  concepts: ['iac.state', 'iac.import'],
  diagram: addrDiagram(true),
  params: [
    {
      id: 'block',
      label: bi('В коде есть блок import { to = edu_vm.legacy, id = "vm-4f91" }', 'The code has import { to = edu_vm.legacy, id = "vm-4f91" }'),
      kind: 'toggle',
      default: false,
      near: 'block',
      group: bi('Что написано в коде', 'What the code says'),
      predict: {
        prompt: bi('Вы добавляете блок import, который связывает адрес edu_vm.legacy с машиной vm-4f91. Что покажет план?', 'You add an import block linking the address edu_vm.legacy with the machine vm-4f91. What will the plan show?'),
        options: [
          { id: 'zero', text: bi('Ни одной машины не создаст, а существующую возьмёт под управление', 'It creates no machine and takes over the existing one') },
          { id: 'same', text: bi('То же, что и без блока, то есть создаст вторую такую же машину', 'The same as without the block: it creates a second identical machine') },
        ],
        resolve: (_p, n) => ((last(n).add ?? 0) === 0 ? 'zero' : 'same'),
      },
    },
  ],
  breaks: [
    lostBreak(true),
    {
      id: 'wrong-id',
      label: bi('В блоке import указан ID, которого нет в облаке', 'The import block names an ID the cloud does not have'),
      remove: ['e-block'],
      boundary: 'storage',
      predict: {
        prompt: bi('В блоке import ошиблись в одной цифре и написали vm-4f19 вместо vm-4f91. Машины с ID vm-4f19 в облаке нет. Что будет?', 'The import block has one digit wrong: vm-4f19 instead of vm-4f91. The cloud has no machine with ID vm-4f19. What happens?'),
        options: [
          { id: 'error', text: bi('План остановится с ошибкой, потому что такого объекта в облаке нет', 'The plan stops with an error, because no such object exists in the cloud') },
          { id: 'create', text: bi('Terraform создаст новую машину с этим ID', 'Terraform creates a new machine with that ID') },
        ],
        resolve: () => 'error',
      },
    },
  ],
  metrics: IMPORT_METRICS,
  run(p, broken) {
    const lost = broken.has('state-lost');
    const wrong = broken.has('wrong-id');
    const block = p.block || wrong;
    const n = addrNumbers('adopt', block, broken);
    const m = { add: n.add, destroy: n.destroy, imported: n.imported, downtime: n.downtime };
    const steps: Step[] = [
      {
        id: 'code',
        label: bi('код', 'code'),
        caption: bi('terraform plan читает код и находит в нём блок `resource "edu_vm" "legacy"`. Вы описали в нём машину vm-4f91, которую дежурный создал ночью в консоли, со всеми её настоящими атрибутами.', 'terraform plan reads the code and finds the `resource "edu_vm" "legacy"` block in it. You described in it the machine vm-4f91, which the on-call engineer created in the console at night, with all its real attributes.'),
        focus: ['e-code', 'plan'],
        tokens: [{ edge: 'e-code', label: 'edu_vm.legacy' }],
        say: { plan: bi('Terraform находит в коде адрес edu_vm.legacy и собирается найти его в state.', 'Terraform finds the address edu_vm.legacy in the code and is about to look it up in the state.') },
        states: hiddenExcept(ADDR_ALL, 'code', 'plan', 'e-code'),
      },
    ];
    if (lost) {
      steps.push({
        id: 'lost',
        label: 'state',
        caption: bi('Файла state нет, поэтому ни один адрес из кода в нём не найден. План считает новыми обе машины, и прежнюю edu_vm.web, и edu_vm.legacy, и предлагает создать их рядом с теми, что работают.', 'There is no state file, so no address from the code is found in it. The plan treats both machines as new, the old edu_vm.web and edu_vm.legacy, and proposes to create them next to the running ones.'),
        focus: ['e-create', 'newvm'],
        reveal: ['state', 'newvm', 'e-create'],
        tokens: [{ edge: 'e-create', label: '+ create × 2' }],
        say: { plan: bi('Terraform не находит в state ни одного адреса, потому что файла state нет, и предлагает создать обе машины.', 'Terraform finds no address in the state, because there is no state file, and proposes to create both machines.') },
        states: { state: 'err', plan: 'warn', newvm: 'warn' },
        values: { state: '—', plan: `${n.add} to add`, newvm: 'duplicate × 2' },
        metrics: m,
        broken: { at: 'state', message: `Plan: ${n.add} to add, 0 to change, 0 to destroy.`, caption: bi('Потеря state не удаляет ничего в облаке, но лишает Terraform памяти. Он создаст дубли и упрётся в квоту или в занятые имена, а работающие машины останутся без присмотра.', 'Losing the state deletes nothing in the cloud but takes away Terraform’s memory. It creates duplicates and runs into quotas or taken names, while the running machines are left unmanaged.') },
      });
      return steps;
    }
    if (wrong) {
      steps.push({
        id: 'noid',
        label: 'import',
        caption: bi('Блок import называет ID vm-4f19, а такой машины в облаке нет. Terraform спрашивает облако об объекте с этим ID, не находит его и останавливает план с ошибкой.', 'The import block names the ID vm-4f19, and the cloud has no such machine. Terraform asks the cloud for the object with this ID, does not find it and stops the plan with an error.'),
        focus: ['block'],
        reveal: ['block'],
        say: { block: bi('Блок import ищет в облаке машину vm-4f19 и не находит её, потому что в ID перепутаны цифры.', 'The import block looks for the machine vm-4f19 in the cloud and does not find it, because the ID has its digits swapped.') },
        states: { block: 'err', plan: 'err' },
        values: { block: 'import { id = "vm-4f19" }' },
        metrics: { add: 0, destroy: 0, imported: 0, downtime: 0 },
        broken: { at: 'block', message: 'Error: Cannot import non-existent remote object', caption: bi('Блок import ничего не создаёт и только берёт под управление то, что уже есть. Поэтому неверный ID останавливает план, а не создаёт новую машину. ID нужной машины покажет команда edu vm list.', 'An import block creates nothing: it only takes over what already exists. So a wrong ID stops the plan instead of creating a new machine. edu vm list shows the ID of the machine you need.') },
      });
      return steps;
    }
    if (block) {
      steps.push({
        id: 'import',
        label: 'import',
        caption: bi('Блок import читает машину vm-4f91 из облака и добавляет в state запись edu_vm.legacy с этим ID. Облако при этом не меняется.', 'The import block reads the machine vm-4f91 from the cloud and adds the entry edu_vm.legacy with that ID to the state. The cloud does not change.'),
        focus: ['e-block', 'state'],
        reveal: ['block', 'e-block', 'state'],
        tokens: [{ edge: 'e-block', label: 'edu_vm.legacy = vm-4f91' }],
        say: { state: bi('В state появилась запись о том, что адресу edu_vm.legacy соответствует машина vm-4f91.', 'The state has a new entry: the address edu_vm.legacy corresponds to the machine vm-4f91.') },
        states: { block: 'ok', state: 'ok' },
        values: { state: 'edu_vm.legacy → vm-4f91' },
      });
      steps.push({
        id: 'lookup',
        label: bi('поиск', 'lookup'),
        caption: bi('План ищет адрес edu_vm.legacy в state и находит запись с ID vm-4f91. Машина существует, и создавать её не нужно.', 'The plan looks up edu_vm.legacy in the state and finds the entry with the ID vm-4f91. The machine exists, and it need not be created.'),
        focus: ['e-state', 'plan'],
        reveal: ['e-state', 'vm', 'e-own'],
        tokens: [{ edge: 'e-state', label: 'vm-4f91' }],
        say: { plan: bi('Terraform находит адрес edu_vm.legacy в state и узнаёт по нему машину vm-4f91.', 'Terraform finds edu_vm.legacy in the state and recognises the machine vm-4f91 by it.') },
        states: { vm: 'ok', 'e-own': 'ok' },
      });
    } else {
      steps.push({
        id: 'lookup',
        label: bi('поиск', 'lookup'),
        caption: bi('План ищет адрес edu_vm.legacy в state и не находит его, потому что машину создали в обход Terraform. Её ID нигде в state не записан.', 'The plan looks up edu_vm.legacy in the state and does not find it, because the machine was made bypassing Terraform. Its ID is recorded nowhere in the state.'),
        focus: ['e-state', 'plan'],
        reveal: ['state', 'e-state'],
        tokens: [{ edge: 'e-state', label: 'edu_vm.legacy?' }],
        say: { plan: bi('Terraform не находит адреса edu_vm.legacy в state и считает, что такой машины ещё нет.', 'Terraform does not find edu_vm.legacy in the state and assumes no such machine exists yet.') },
        states: { state: 'warn' },
      });
    }
    steps.push({
      id: 'plan',
      label: 'plan',
      caption: block
        ? bi('План сообщает «# edu_vm.legacy will be imported» и итог «1 to import, 0 to add». После apply машиной vm-4f91 управляет код, и менять её дальше нужно только через него.', 'The plan reports “# edu_vm.legacy will be imported” and the total “1 to import, 0 to add”. After apply the code manages vm-4f91, and from then on it should be changed only through the code.')
        : bi('План предлагает создать edu_vm.legacy. После apply в облаке станет две одинаковые машины, а ручная vm-4f91 так и останется без присмотра.', 'The plan proposes to create edu_vm.legacy. After apply the cloud holds two identical machines, and the hand-made vm-4f91 stays unmanaged.'),
      focus: block ? ['plan'] : ['e-create', 'newvm'],
      reveal: block ? [] : ['vm', 'e-own', 'newvm', 'e-create'],
      tokens: block ? [] : [{ edge: 'e-create', label: '+ create' }],
      say: block ? { plan: bi('Terraform ничего не создаёт и берёт существующую машину под управление.', 'Terraform creates nothing and takes over the existing machine.') } : { newvm: bi('По плану появится вторая машина, точно такая же, как vm-4f91, а сама vm-4f91 останется без управления.', 'According to the plan a second machine appears, identical to vm-4f91, while vm-4f91 itself stays unmanaged.') },
      states: block ? { plan: 'ok' } : { plan: 'warn', newvm: 'warn', vm: 'warn' },
      values: { plan: block ? '1 to import, 0 to add' : `${n.add} to add` },
      metrics: m,
    });
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    const a = last(prev);
    const b = last(next);
    if (change.kind === 'break') return change.on ? (change.id === 'state-lost' ? bi('Без файла state Terraform не узнаёт ни одной машины и предлагает создать дубли.', 'Without the state file Terraform recognises no machine and proposes to create duplicates.') : bi('Блок import ищет машину с неверным ID, и план останавливается с ошибкой.', 'The import block looks for a machine with a wrong ID, and the plan stops with an error.')) : bi('Поломку убрали, и план снова доходит до конца.', 'The break is removed, and the plan goes to the end again.');
    return fb(bi('Число машин, которые план создаст, изменилось с {a1} на {b1}, а число машин, которые он возьмёт под управление, изменилось с {a2} на {b2}.', 'The number of machines the plan creates went from {a1} to {b1}, and the number it takes over went from {a2} to {b2}.'), { a1: a.add ?? 0, b1: b.add ?? 0, a2: a.imported ?? 0, b2: b.imported ?? 0 });
  },
});
