// Process explainers of the IaC block: E-TF (plan and apply: code, state,
// cloud) and E-ANS (an idempotent Ansible run), 06 §4.4 and §5.4.

import { defineModel } from '../../core/define';
import { bi, fmt, type Bi } from '../../core/i18n';
import type { Step } from '../../core/types';
import { card } from '../git-cicd/explainers';

const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};

// ── E-TF ──

type TfP = { change: string; drift: boolean; refresh: boolean; cbd: boolean };

export function tfNumbers(p: TfP, stateLost: boolean): { add: number; change: number; destroy: number; downtime: number } {
  if (stateLost) return { add: 3, change: 0, destroy: 0, downtime: 0 };
  const replace = p.change === 'image';
  const update = p.change === 'cores' || (p.drift && p.refresh && p.change !== 'image');
  return { add: replace ? 1 : 0, change: update && !replace ? 1 : 0, destroy: replace ? 1 : 0, downtime: replace ? (p.cbd ? 0 : 40) : update && (p.change === 'cores' || p.drift) ? 15 : 0 };
}

export const tfModel = defineModel<TfP>({
  id: 'iac.tf-plan-apply',
  block: 'iac',
  title: bi('terraform plan и apply: код, state, облако', 'terraform plan and apply: code, state, the cloud'),
  summary: bi('Terraform сравнивает три версии мира: код, свою память (state) и облако. План — разница; apply выполняет её вызовами API и записывает новый state.', 'Terraform compares three versions of the world: the code, its own memory (state) and the cloud. The plan is the difference; apply carries it out with API calls and writes the new state.'),
  concepts: ['iac.plan', 'iac.state', 'iac.drift'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      { id: 'code', label: 'main.tf', sub: 'edu_vm.web: 2 cores', family: 'ci-source', shape: 'doc', x: 24, y: 40, w: 176, h: 72, card: card(bi('Код: какими ресурсы должны быть. Он не знает, какие они есть.', 'The code: what resources should be like. It does not know what they are.'), bi('Вы пишете, коммитите в Git.', 'You write it and commit it to Git.'), 'cat main.tf') },
      { id: 'core', label: 'terraform', sub: 'plan', family: 'process', shape: 'box', x: 312, y: 40, w: 176, h: 72, card: card(bi('Ядро: разбирает код, строит граф ресурсов по ссылкам, обновляет state из облака, считает разницу и выполняет её.', 'The core: parses the code, builds the resource graph from references, refreshes state from the cloud, computes the difference and carries it out.'), bi('Вы или CI запускаете terraform plan / apply.', 'You or CI run terraform plan / apply.'), 'terraform plan', { page: 'help/terraform', anchor: 'USAGE' }) },
      { id: 'state', label: 'terraform.tfstate', sub: 'serial 4', family: 'obj', shape: 'buffer', x: 312, y: 300, w: 176, h: 72, card: card(bi('Память Terraform: связь «адрес в коде ↔ ID в облаке» и последние известные атрибуты. Без неё Terraform не знает, что ресурсы его.', 'Terraform’s memory: the link "address in code ↔ ID in the cloud" and the last known attributes. Without it Terraform does not know the resources are its own.'), bi('Пишет terraform apply после каждого ресурса.', 'terraform apply writes it after every resource.'), 'terraform state list') },
      { id: 'api', label: 'Edu Cloud API', sub: 'api.edu.cloud', family: 'cp', shape: 'hex', x: 600, y: 40, w: 176, h: 72, card: card(bi('API облака: GET читает ресурс, POST создаёт, PATCH меняет, DELETE удаляет. Провайдер edu переводит план в эти вызовы.', 'The cloud API: GET reads a resource, POST creates, PATCH changes, DELETE removes. The edu provider turns the plan into these calls.'), bi('Облачный провайдер.', 'The cloud provider.'), 'edu vm list') },
      { id: 'vm', label: 'vm-4f66', sub: 'cores 2 · ubuntu-24.04', family: 'node', shape: 'rack', x: 600, y: 200, w: 176, h: 80, card: card(bi('Настоящая виртуальная машина в облаке. Её можно изменить и мимо Terraform — через консоль.', 'The real virtual machine in the cloud. It can be changed behind Terraform’s back, through the console.'), bi('Создана terraform apply.', 'Created by terraform apply.'), 'edu vm get vm-4f66') },
      { id: 'console', label: bi('консоль облака', 'cloud console'), sub: 'ops-2', family: 'user', shape: 'box', x: 784, y: 330, w: 160, h: 64, card: card(bi('Веб-консоль или CLI облака. Правка здесь — дрейф: облако уже не такое, как в коде и state.', 'The cloud’s web console or CLI. A change here is drift: the cloud no longer matches the code and the state.'), bi('Любой человек с доступом к облаку.', 'Anyone with access to the cloud.'), 'edu log') },
    ],
    edges: [
      { id: 'e-read', from: 'code', to: 'core', label: bi('разбор и граф', 'parse and graph'), card: card(bi('Terraform читает все .tf каталога и строит граф: порядок задают ссылки между ресурсами, а не строки файла.', 'Terraform reads every .tf in the directory and builds a graph: the order comes from references between resources, not from lines in the file.'), bi('terraform.', 'terraform.')) },
      { id: 'e-state', from: 'state', to: 'core', label: bi('что я создал', 'what I created'), card: card(bi('State даёт ID ресурсов, чтобы спросить облако именно про них.', 'The state gives resource IDs so Terraform can ask the cloud about exactly them.'), bi('terraform.', 'terraform.'), 'terraform show') },
      { id: 'e-refresh', from: 'core', to: 'api', label: 'GET /v1/vms/vm-4f66', card: card(bi('Refresh: перед планом Terraform перечитывает каждый ресурс из облака и замечает дрейф.', 'Refresh: before the plan Terraform rereads every resource from the cloud and notices drift.'), bi('terraform plan (без -refresh=false).', 'terraform plan (without -refresh=false).')) },
      { id: 'e-apply', from: 'api', to: 'vm', label: 'POST / PATCH / DELETE', card: card(bi('Apply выполняет план вызовами API в порядке графа.', 'Apply carries out the plan with API calls in graph order.'), bi('terraform apply после подтверждения.', 'terraform apply after approval.')) },
      { id: 'e-write', from: 'core', to: 'state', via: [[440, 220]], label: bi('serial +1', 'serial +1'), labelAt: 0.4, card: card(bi('После каждого ресурса новый state записывается на диск, serial растёт.', 'After every resource the new state is written to disk and serial grows.'), bi('terraform apply.', 'terraform apply.'), 'cat terraform.tfstate') },
      { id: 'e-drift', from: 'console', to: 'vm', label: bi('правка руками', 'a manual edit'), dashed: true, card: card(bi('Изменение мимо кода: следующий plan увидит его и предложит вернуть как в коде.', 'A change behind the code: the next plan sees it and proposes to bring it back to the code.'), bi('Человек в консоли.', 'A person in the console.'), 'edu vm update vm-4f66 --cores 4') },
    ],
  },
  params: [
    {
      id: 'change',
      label: bi('Что меняем в коде', 'What we change in the code'),
      kind: 'choice',
      default: 'cores',
      options: [
        { id: 'none', label: bi('ничего', 'nothing') },
        { id: 'cores', label: bi('cores 2 → 4', 'cores 2 → 4') },
        { id: 'image', label: bi('image → debian-13', 'image → debian-13') },
      ],
      near: 'code',
      predict: {
        prompt: bi('Меняем образ ВМ. Что сделает Terraform?', 'We change the VM image. What will Terraform do?'),
        options: [
          { id: 'replace', text: bi('Удалит ВМ и создаст новую', 'Delete the VM and create a new one') },
          { id: 'update', text: bi('Поменяет образ на месте', 'Change the image in place') },
        ],
        resolve: (_p, n) => ((last(n).destroy ?? 0) > 0 ? 'replace' : 'update'),
      },
    },
    { id: 'drift', label: bi('Кто-то поменял cores в консоли', 'Someone changed cores in the console'), kind: 'toggle', default: false, near: 'console', predict: { prompt: bi('В консоли cores сменили на 4, код не трогали. Что покажет plan?', 'In the console cores was set to 4, the code is untouched. What does plan show?'), options: [{ id: 'revert', text: bi('Вернуть cores 4 → 2', 'Bring cores back 4 → 2') }, { id: 'nothing', text: bi('Ничего: код не менялся', 'Nothing: the code did not change') }], resolve: (_p, n) => ((last(n).change ?? 0) > 0 ? 'revert' : 'nothing') } },
    { id: 'refresh', label: bi('Обновлять state из облака (refresh)', 'Refresh state from the cloud'), kind: 'toggle', default: true, near: 'api' },
    { id: 'cbd', label: bi('create_before_destroy', 'create_before_destroy'), kind: 'toggle', default: false, near: 'vm' },
  ],
  breaks: [
    { id: 'state-lost', label: bi('terraform.tfstate удалён', 'terraform.tfstate deleted'), remove: ['state', 'e-state'], predict: { prompt: bi('State пропал, а ВМ в облаке работает. Что предложит plan?', 'The state is gone while the VM runs in the cloud. What does plan propose?'), options: [{ id: 'create', text: bi('Создать всё заново, как будто ничего нет', 'Create everything again, as if nothing existed') }, { id: 'none', text: bi('Ничего: облако-то на месте', 'Nothing: the cloud is still there') }], resolve: () => 'create' } },
    { id: 'rate-limit', label: bi('API отвечает 429 на втором ресурсе', 'The API answers 429 on the second resource'), remove: ['e-apply'], predict: { prompt: bi('apply создаёт три ресурса, на втором API вернул 429. Что будет в state?', 'apply creates three resources and the API returns 429 on the second. What will the state hold?'), options: [{ id: 'one', text: bi('Только первый ресурс', 'Only the first resource') }, { id: 'none', text: bi('Ничего: apply откатится целиком', 'Nothing: apply rolls back as a whole') }], resolve: () => 'one' } },
  ],
  metrics: [
    { id: 'add', label: bi('создать', 'to add') },
    { id: 'change', label: bi('изменить', 'to change') },
    { id: 'destroy', label: bi('удалить', 'to destroy') },
    { id: 'down', label: bi('простой ВМ', 'VM downtime'), unit: 's' },
  ],
  run(p, broken) {
    const lost = broken.has('state-lost');
    const n = tfNumbers(p, lost);
    const m = { add: n.add, change: n.change, destroy: n.destroy, down: n.downtime };
    const steps: Step[] = [
      { id: 'parse', label: 'parse', caption: bi('Terraform читает main.tf и строит граф: ВМ ссылается на сеть, DNS-запись — на ВМ. Создавать придётся в этом порядке.', 'Terraform reads main.tf and builds the graph: the VM references the network, the DNS record references the VM. That is the creation order.'), focus: ['code', 'e-read', 'core'], tokens: [{ edge: 'e-read' }], states: { core: 'on' }, values: { code: p.change === 'cores' ? 'edu_vm.web: 4 cores' : p.change === 'image' ? 'image = debian-13' : 'edu_vm.web: 2 cores' } },
    ];
    if (lost) {
      steps.push({ id: 'nostate', label: 'state?', caption: bi('State нет: Terraform не знает ни одного ID и считает, что в облаке пусто.', 'There is no state: Terraform knows no IDs and assumes the cloud is empty.'), focus: ['core'], states: { state: 'off' } });
      steps.push({ id: 'plan', label: 'plan', caption: bi('План: создать все три ресурса. Облако не тронуто, но связь с ним потеряна: apply создаст дубли или упрётся в занятые имена.', 'The plan: create all three resources. The cloud is untouched, but the link to it is lost: apply would create duplicates or hit names already taken.'), focus: ['core', 'vm'], states: { core: 'err' }, metrics: m, broken: { at: 'state', message: 'Plan: 3 to add, 0 to change, 0 to destroy.', caption: bi('state хранят удалённо, с блокировкой и резервной копией: его потеря отнимает у Terraform память.', 'state is kept remotely, locked and backed up: losing it takes Terraform’s memory away.') } });
      return steps;
    }
    steps.push({ id: 'state', label: 'state', caption: bi('Из state Terraform берёт адреса и ID: edu_vm.web — это vm-4f66.', 'From the state Terraform takes the addresses and IDs: edu_vm.web is vm-4f66.'), focus: ['state', 'e-state'], tokens: [{ edge: 'e-state', label: 'vm-4f66' }] });
    if (p.drift) steps.push({ id: 'drift', label: bi('дрейф', 'drift'), caption: bi('Тем временем в консоли кто-то поменял cores на 4. Ни код, ни state об этом не знают.', 'Meanwhile someone changed cores to 4 in the console. Neither the code nor the state knows.'), focus: ['console', 'e-drift', 'vm'], tokens: [{ edge: 'e-drift', label: 'cores=4' }], states: { vm: 'warn' }, values: { vm: 'cores 4 · ubuntu-24.04' } });
    steps.push(
      p.refresh
        ? { id: 'refresh', label: 'refresh', caption: p.drift ? bi('Refresh: GET в облако показывает cores = 4. Terraform пишет «Objects have changed outside of Terraform».', 'Refresh: a GET to the cloud shows cores = 4. Terraform reports "Objects have changed outside of Terraform".') : bi('Refresh: GET в облако — всё как в state.', 'Refresh: a GET to the cloud — everything matches the state.'), focus: ['e-refresh', 'api'], tokens: [{ edge: 'e-refresh' }, { edge: 'e-refresh', reverse: true, label: p.drift ? 'cores=4' : '200 OK' }], states: { api: 'on' } }
        : { id: 'norefresh', label: '-refresh=false', caption: p.drift ? bi('Refresh выключен: Terraform верит state и дрейфа не видит. План врёт.', 'Refresh is off: Terraform trusts the state and does not see the drift. The plan lies.') : bi('Refresh выключен: Terraform верит state, в облако не ходит.', 'Refresh is off: Terraform trusts the state and does not ask the cloud.'), focus: ['core'], states: { api: 'off' } },
    );
    const what =
      p.change === 'image'
        ? bi('image нельзя поменять на месте: «-/+ must be replaced, # forces replacement».', 'image cannot change in place: "-/+ must be replaced, # forces replacement".')
        : n.change
          ? bi('cores меняется на месте: «~ update in-place».', 'cores changes in place: "~ update in-place".')
          : bi('Разницы нет: «No changes. Your infrastructure matches the configuration».', 'No difference: "No changes. Your infrastructure matches the configuration".');
    steps.push({ id: 'diff', label: 'plan', caption: bi(`Сравнение кода с обновлённым state. ${what.ru}`, `The code is compared with the refreshed state. ${what.en}`), focus: ['core', 'code', 'state'], states: { core: n.add + n.change + n.destroy ? 'warn' : 'ok' }, metrics: m });
    if (!(n.add + n.change + n.destroy)) return steps;
    if (broken.has('rate-limit')) {
      steps.push({ id: 'apply', label: 'apply', caption: bi('apply начинает вызовы API, но облако отвечает 429 — слишком много запросов. Apply останавливается.', 'apply starts the API calls, but the cloud answers 429, too many requests. Apply stops.'), focus: ['api', 'e-apply'], states: { api: 'err' }, metrics: m, broken: { at: 'e-apply', message: '│ Error: creating VM: 429 Too Many Requests: rate limit of the training API exceeded, retry later', caption: bi('state уже записан для готовых ресурсов: следующий plan продолжит с места остановки.', 'the state is already written for the finished resources: the next plan continues from where it stopped.') } });
      return steps;
    }
    if (p.change === 'image')
      steps.push({ id: 'apply', label: 'apply', caption: p.cbd ? bi('create_before_destroy: сначала новая ВМ, потом удаление старой (+/-). Простоя нет, но на время две ВМ.', 'create_before_destroy: the new VM first, then the old one is deleted (+/-). No downtime, but two VMs for a while.') : bi('Сначала DELETE старой ВМ, потом POST новой (-/+). Около 40 секунд сайт без сервера.', 'First a DELETE of the old VM, then a POST of the new one (-/+). About 40 seconds the site has no server.'), focus: ['e-apply', 'vm'], tokens: [{ edge: 'e-apply', label: p.cbd ? 'POST, DELETE' : 'DELETE, POST' }], states: { vm: 'ok' }, values: { vm: 'vm-4f9a · debian-13' }, metrics: m });
    else steps.push({ id: 'apply', label: 'apply', caption: p.drift && p.change !== 'cores' ? bi('PATCH cores = 2: Terraform возвращает облако к коду и затирает ручную правку.', 'PATCH cores = 2: Terraform brings the cloud back to the code and overwrites the manual edit.') : bi('PATCH cores = 4: ВМ останавливается на время изменения и запускается снова.', 'PATCH cores = 4: the VM stops while it is changed and starts again.'), focus: ['e-apply', 'vm'], tokens: [{ edge: 'e-apply', label: 'PATCH' }], states: { vm: 'ok' }, values: { vm: p.change === 'cores' ? 'cores 4 · ubuntu-24.04' : 'cores 2 · ubuntu-24.04' }, metrics: m });
    steps.push({ id: 'write', label: 'state', caption: bi('Новый state записан: serial 4 → 5. Следующий plan начнётся с этой памяти.', 'The new state is written: serial 4 → 5. The next plan starts from this memory.'), focus: ['e-write', 'state'], tokens: [{ edge: 'e-write', label: 'serial 5' }], values: { state: 'serial 5' }, states: { state: 'ok' }, metrics: m });
    return steps;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? (change.id === 'state-lost' ? bi('Без state Terraform не знает, что ресурсы его: план — создать всё заново.', 'Without state Terraform does not know the resources are its own: the plan is to create everything again.') : bi('Apply не атомарен: state пишется после каждого ресурса, сбой оставляет часть работы сделанной.', 'Apply is not atomic: state is written after every resource, and a failure leaves part of the work done.')) : bi('Поломка убрана.', 'The break is removed.');
    const a0 = last(prev);
    const a1 = last(next);
    const line = fmt(bi('План: {a} создать, {c} изменить, {d} удалить; простой {t} с.', 'Plan: {a} to add, {c} to change, {d} to destroy; downtime {t} s.'), { a: a1.add ?? 0, c: a1.change ?? 0, d: a1.destroy ?? 0, t: a1.down ?? 0 });
    void a0;
    if (change.id === 'cbd') return b.cbd ? bi('create_before_destroy: новая ВМ раньше удаления старой — простой исчезает, если меняется образ.', 'create_before_destroy: the new VM before deleting the old one, so downtime disappears when the image changes.') : line;
    if (change.id === 'refresh' && !b.refresh) return bi('Без refresh Terraform не спрашивает облако: дрейф не виден, и план может не совпасть с реальностью.', 'Without refresh Terraform does not ask the cloud: drift is invisible, and the plan may not match reality.');
    return line;
  },
});

// ── E-ANS ──

type AnsP = { hosts: number; task: string; run: number; check: boolean };

export function ansNumbers(p: AnsP, broken: ReadonlySet<string>): { changed: number; ok: number; failed: number; handlers: number } {
  const live = p.hosts - (broken.has('no-python') && p.hosts >= 3 ? 1 : 0);
  const failedTask = broken.has('task-fails') ? 1 : 0;
  // Task 1 installs the package (changed on run 1), task 2 is the file task under study.
  const pkgChanged = p.run === 1 ? live : 0;
  const fileChanged = p.task === 'lineinfile' ? (p.run === 1 ? live : 0) : live;
  const changed = pkgChanged + fileChanged - (failedTask ? 1 : 0);
  const notified = p.check ? 0 : fileChanged - failedTask;
  return { changed: p.check ? 0 : changed, ok: live * 3 - changed + Math.max(0, notified), failed: failedTask + (live < p.hosts ? 1 : 0), handlers: Math.max(0, notified) };
}

const hostIds = ['h1', 'h2', 'h3'] as const;

export const ansModel = defineModel<AnsP>({
  id: 'iac.ansible-run',
  block: 'iac',
  title: bi('Идемпотентный прогон Ansible', 'An idempotent Ansible run'),
  summary: bi('Модуль сравнивает «как надо» с «как есть» и меняет только разницу. Правильный плейбук на втором прогоне ничего не меняет.', 'A module compares "how it should be" with "how it is" and changes only the difference. A correct playbook changes nothing on the second run.'),
  concepts: ['iac.idempotence', 'iac.module', 'iac.handler'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      { id: 'ctl', label: 'ansible-playbook', sub: 'site.yml', family: 'process', shape: 'box', x: 24, y: 168, w: 192, h: 72, card: card(bi('Управляющая машина: читает инвентарь и плейбук, по SSH отправляет на хосты модули и собирает ответы.', 'The control machine: reads the inventory and the playbook, sends modules to the hosts over SSH and collects the answers.'), bi('Вы или CI.', 'You or CI.'), 'ansible-playbook site.yml') },
      { id: 'inv', label: 'inventory.ini', sub: '[web] web1 web2 web3', family: 'obj', shape: 'doc', x: 24, y: 40, w: 192, h: 64, card: card(bi('Инвентарь: какие хосты есть и в каких они группах.', 'The inventory: which hosts exist and which groups they are in.'), bi('Вы.', 'You.'), 'ansible-inventory --graph') },
      { id: 'h1', label: 'web1', sub: '', family: 'node', shape: 'rack', x: 640, y: 24, w: 176, h: 80, card: card(bi('Управляемый хост. Агента нет: нужен только SSH и python3.', 'A managed host. No agent: only SSH and python3 are needed.'), bi('Облако или администратор.', 'The cloud or an administrator.'), 'ansible web1 -m ansible.builtin.setup') },
      { id: 'h2', label: 'web2', sub: '', family: 'node', shape: 'rack', x: 640, y: 168, w: 176, h: 80, card: card(bi('Второй хост группы web: те же задачи, своё состояние.', 'The second host of the web group: the same tasks, its own state.'), bi('Облако или администратор.', 'The cloud or an administrator.'), 'ansible web2 -a "cat /etc/motd"') },
      { id: 'h3', label: 'web3', sub: '', family: 'node', shape: 'rack', x: 640, y: 312, w: 176, h: 80, card: card(bi('Третий хост. Если на нём нет python3, модули не запустятся.', 'The third host. Without python3 modules cannot run on it.'), bi('Облако или администратор.', 'The cloud or an administrator.'), 'ansible web3 -m ansible.builtin.ping') },
      { id: 'hq', label: bi('очередь handlers', 'handler queue'), sub: 'Restart nginx', family: 'flow', shape: 'buffer', x: 320, y: 320, w: 200, h: 64, card: card(bi('notify кладёт сюда handler, если задача что-то изменила. Handler выполняется один раз в конце плея.', 'notify puts a handler here if the task changed something. The handler runs once at the end of the play.'), bi('Задачи с notify.', 'Tasks with notify.'), 'grep -n notify site.yml', { page: 'ansible-doc/ansible.builtin.service', anchor: 'OPTIONS' }) },
    ],
    edges: [
      { id: 'e-inv', from: 'inv', to: 'ctl', label: bi('кого настраивать', 'whom to configure'), card: card(bi('hosts: web в плее выбирает хосты группы.', 'hosts: web in the play selects the group’s hosts.'), bi('ansible-playbook.', 'ansible-playbook.')) },
      { id: 'e1', from: 'ctl', to: 'h1', label: 'ssh · python3 AnsiballZ_lineinfile.py', labelAt: 0.55, card: card(bi('По SSH уходит модуль с параметрами задачи; он выполняется на хосте и отвечает JSON: {"changed": …}.', 'The module goes over SSH with the task arguments; it runs on the host and answers in JSON: {"changed": …}.'), bi('ansible-playbook.', 'ansible-playbook.')) },
      { id: 'e2', from: 'ctl', to: 'h2', label: 'ssh', card: card(bi('Та же задача на втором хосте: задача проходит все хосты, прежде чем начнётся следующая.', 'The same task on the second host: a task goes through all hosts before the next one starts.'), bi('ansible-playbook.', 'ansible-playbook.')) },
      { id: 'e3', from: 'ctl', to: 'h3', label: 'ssh', card: card(bi('И на третьем.', 'And on the third.'), bi('ansible-playbook.', 'ansible-playbook.')) },
      { id: 'e-notify', from: 'ctl', to: 'hq', label: 'notify', card: card(bi('changed + notify → handler в очередь. ok → ничего.', 'changed + notify → the handler is queued. ok → nothing.'), bi('ansible-playbook.', 'ansible-playbook.')) },
    ],
  },
  params: [
    { id: 'hosts', label: bi('Хостов в группе', 'Hosts in the group'), kind: 'range', min: 1, max: 3, step: 1, default: 3, near: 'inv' },
    {
      id: 'task',
      label: bi('Как добавить строку в /etc/motd', 'How to add a line to /etc/motd'),
      kind: 'choice',
      default: 'lineinfile',
      options: [
        { id: 'lineinfile', label: bi('ansible.builtin.lineinfile', 'ansible.builtin.lineinfile') },
        { id: 'shell', label: bi('shell: echo … >> /etc/motd', 'shell: echo … >> /etc/motd') },
      ],
      near: 'e1',
      predict: { prompt: bi('Строку добавляет shell: echo >>. Что будет на втором прогоне?', 'The line is added with shell: echo >>. What happens on the second run?'), options: [{ id: 'changed', text: bi('Снова changed: строка добавится ещё раз', 'changed again: the line is added once more') }, { id: 'ok', text: bi('ok: строка уже есть', 'ok: the line is already there') }], resolve: (_p, n) => (n.some((s) => s.id === 'run' && JSON.stringify(s.states ?? {}).includes('warn')) ? 'changed' : 'ok') },
    },
    { id: 'run', label: bi('Номер прогона', 'Run number'), kind: 'range', min: 1, max: 3, step: 1, default: 1, near: 'ctl', predict: { prompt: bi('Запускаем тот же плейбук второй раз. Сколько задач будет changed?', 'We run the same playbook a second time. How many tasks are changed?'), options: [{ id: 'zero', text: bi('Ни одной', 'None') }, { id: 'same', text: bi('Столько же, сколько в первый раз', 'As many as the first time') }], resolve: (_p, n) => ((last(n).changed ?? 0) === 0 ? 'zero' : 'same') } },
    { id: 'check', label: bi('--check', '--check'), kind: 'toggle', default: false, near: 'ctl' },
  ],
  breaks: [
    { id: 'no-python', label: bi('На web3 нет python3', 'web3 has no python3'), remove: ['e3'], predict: { prompt: bi('На web3 нет python3. Что будет с прогоном?', 'web3 has no python3. What happens to the run?'), options: [{ id: 'one', text: bi('web3 упадёт, web1 и web2 настроятся', 'web3 fails, web1 and web2 get configured') }, { id: 'all', text: bi('Упадёт весь прогон', 'The whole run fails') }], resolve: () => 'one' } },
    { id: 'task-fails', label: bi('Задача на web2 упала после notify', 'A task failed on web2 after notify'), remove: ['e2'], predict: { prompt: bi('На web2 задача после notify упала. Выполнится ли handler на web2?', 'On web2 a task after notify failed. Will the handler run on web2?'), options: [{ id: 'no', text: bi('Нет: упавший хост выбывает до handlers', 'No: a failed host drops out before handlers') }, { id: 'yes', text: bi('Да, handler в очереди', 'Yes, the handler is queued') }], resolve: () => 'no' } },
  ],
  metrics: [
    { id: 'changed', label: bi('changed', 'changed') },
    { id: 'ok', label: bi('ok', 'ok') },
    { id: 'failed', label: bi('failed', 'failed') },
    { id: 'handlers', label: bi('запусков handler', 'handler runs') },
  ],
  run(p, broken) {
    const n = ansNumbers(p, broken);
    const hosts = hostIds.slice(0, p.hosts);
    const off = Object.fromEntries(hostIds.slice(p.hosts).map((h) => [h, 'off' as const]));
    const noPy = broken.has('no-python') && p.hosts >= 3;
    const live = hosts.filter((h) => !(noPy && h === 'h3'));
    const steps: Step[] = [
      { id: 'inv', label: 'inventory', caption: fmt(bi('Ansible читает инвентарь: в группе web {n} хост(а). Агентов нет — только SSH.', 'Ansible reads the inventory: the web group has {n} host(s). No agents, only SSH.'), { n: p.hosts }), focus: ['inv', 'e-inv', 'ctl'], tokens: [{ edge: 'e-inv' }], states: { ctl: 'on', ...off } },
      { id: 'facts', label: bi('факты', 'facts'), caption: bi('Gathering Facts: на каждый хост уходит модуль setup и возвращает семейство ОС, адреса, память.', 'Gathering Facts: the setup module goes to every host and returns the OS family, addresses, memory.'), focus: [...hosts.map((h) => `e${h.slice(1)}`)], tokens: hosts.map((h) => ({ edge: `e${h.slice(1)}`, label: 'setup' })), states: Object.fromEntries(live.map((h) => [h, 'on' as const])) },
    ];
    if (noPy) steps.push({ id: 'nopy', label: 'web3', caption: bi('На web3 модуль не запускается: python3 нет. Хост выбывает из плея, остальные продолжают.', 'On web3 the module does not start: there is no python3. The host drops out of the play; the others go on.'), focus: ['h3', 'e3'], states: { h3: 'err', e3: 'err' }, broken: { at: 'h3', message: 'fatal: [web3]: FAILED! => {"changed": false, "module_stderr": "/bin/sh: 1: /usr/bin/python3: not found\\n", "msg": "The module failed to execute correctly, you probably need to set the interpreter."}', caption: bi('Ansible без агента, но не без python — кроме модуля raw.', 'Ansible has no agent, but needs python, except for the raw module.') } });
    steps.push({
      id: 'pkg',
      label: 'apt',
      caption: p.run === 1 ? bi('Задача «nginx установлен»: пакета нет — apt ставит, ответ changed.', 'The task "nginx is installed": the package is missing, apt installs it, the answer is changed.') : bi('Задача «nginx установлен»: пакет уже есть — ответ ok, ничего не делается.', 'The task "nginx is installed": the package is already there, the answer is ok, nothing is done.'),
      focus: live.map((h) => `e${h.slice(1)}`),
      tokens: live.map((h) => ({ edge: `e${h.slice(1)}`, label: p.check ? 'check' : p.run === 1 ? 'changed' : 'ok' })),
      states: Object.fromEntries(live.map((h) => [h, p.run === 1 ? ('warn' as const) : ('ok' as const)])),
      values: Object.fromEntries(live.map((h) => [h, p.check ? 'nginx: would install' : 'nginx 1.26'])),
    });
    const fileChanges = p.task === 'shell' || p.run === 1;
    steps.push({
      id: 'run',
      label: p.task === 'shell' ? 'shell' : 'lineinfile',
      caption:
        p.task === 'shell'
          ? fmt(bi('shell: echo >> не знает, каким должен быть файл: он просто дописывает строку. Прогон {r} — строк уже {r}, ответ снова changed.', 'shell: echo >> does not know what the file should be like: it just appends a line. Run {r}: there are {r} lines now, and the answer is changed again.'), { r: p.run })
          : p.run === 1
            ? bi('lineinfile сравнивает: строки нет — добавляет, changed.', 'lineinfile compares: the line is missing, so it adds it, changed.')
            : bi('lineinfile сравнивает: строка уже есть — ok. Второй прогон ничего не меняет: это и есть идемпотентность.', 'lineinfile compares: the line is already there, ok. The second run changes nothing: that is idempotence.'),
      focus: live.map((h) => `e${h.slice(1)}`),
      tokens: live.map((h) => ({ edge: `e${h.slice(1)}`, label: fileChanges && !p.check ? 'changed' : 'ok' })),
      states: Object.fromEntries(live.map((h) => [h, broken.has('task-fails') && h === 'h2' ? ('err' as const) : fileChanges ? ('warn' as const) : ('ok' as const)])),
      values: Object.fromEntries(live.map((h) => [h, `/etc/motd: ${p.task === 'shell' ? p.run : 1} line(s)`])),
    });
    if (broken.has('task-fails') && hosts.includes('h2')) steps.push({ id: 'fail2', label: 'web2 ✗', caption: bi('На web2 следующая задача упала. Хост выбывает из плея — до своих handlers он не дойдёт.', 'On web2 the next task failed. The host drops out of the play and will not reach its handlers.'), focus: ['h2'], states: { h2: 'err', e2: 'err' }, broken: { at: 'h2', message: 'fatal: [web2]: FAILED! => {"changed": false, "msg": "Could not find the requested service nginxx: host"}', caption: bi('с --force-handlers handler выполнился бы и на упавшем хосте.', 'with --force-handlers the handler would run on the failed host too.') } });
    steps.push(
      n.handlers > 0
        ? { id: 'handler', label: 'handler', caption: fmt(bi('В конце плея handler «Restart nginx» выполняется один раз на каждом хосте, где задача была changed: {n} раз(а).', 'At the end of the play the "Restart nginx" handler runs once on every host where the task was changed: {n} time(s).'), { n: n.handlers }), focus: ['e-notify', 'hq'], tokens: [{ edge: 'e-notify', label: 'notify' }], fill: { hq: Math.min(1, n.handlers / 3) }, values: { hq: `${n.handlers} × Restart nginx` } }
        : { id: 'handler', label: bi('нет handler', 'no handler'), caption: p.check ? bi('В --check модули только сообщают, что изменили бы. Хосты не тронуты, handler не запускается.', 'In --check modules only report what they would change. The hosts are untouched; no handler runs.') : bi('Ничего не изменилось — некому уведомлять handler: nginx не перезапускается зря.', 'Nothing changed, so nothing notifies the handler: nginx is not restarted for nothing.'), focus: ['hq'], fill: { hq: 0 } },
    );
    steps.push({ id: 'recap', label: 'RECAP', caption: fmt(bi('PLAY RECAP: changed={c}, failed={f}. Плейбук описывает состояние, а не действия, если на повторном прогоне changed=0.', 'PLAY RECAP: changed={c}, failed={f}. A playbook describes state, not actions, if a repeated run shows changed=0.'), { c: n.changed, f: n.failed }), focus: ['ctl'], states: { ctl: n.failed ? 'warn' : 'ok' }, metrics: { changed: n.changed, ok: n.ok, failed: n.failed, handlers: n.handlers } });
    return steps;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? (change.id === 'no-python' ? bi('Без python модули не запускаются: хост выбывает, остальные продолжают.', 'Without python modules cannot run: the host drops out, the others go on.') : bi('Упавший хост выбывает из плея до handlers.', 'A failed host leaves the play before the handlers.')) : bi('Поломка убрана.', 'The break is removed.');
    const c0 = last(prev).changed ?? 0;
    const c1 = last(next).changed ?? 0;
    if (change.id === 'check') return b.check ? bi('--check: модули предсказывают изменения, ничего не меняя; command и shell пропускаются.', '--check: modules predict changes without making them; command and shell are skipped.') : bi('Обычный прогон: изменения применяются.', 'A normal run: changes are applied.');
    if (change.id === 'task') return b.task === 'shell' ? bi('shell всегда changed: он выполняет действие, а не описывает состояние.', 'shell is always changed: it performs an action instead of describing a state.') : bi('lineinfile сначала смотрит, есть ли строка: changed только когда её нет.', 'lineinfile first checks whether the line exists: changed only when it is missing.');
    return fmt(bi('changed: {a} → {b}.', 'changed: {a} → {b}.'), { a: c0, b: c1 });
  },
});
