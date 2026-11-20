// Process explainers of the IaC block: E-TF (what terraform plan and apply do
// with the code, the state and the cloud) and E-ANS (an idempotent Ansible
// run), 06 §4.4 and §5.4.
//
// Reading order: each picture is built from zero. E-TF starts with the code and
// the terraform program only; the state, the cloud API, the machine and the
// person in the console appear when the run reaches them. E-ANS starts with the
// inventory and ansible-playbook; the hosts appear when Ansible first logs in
// to them, the handler queue when the first task notifies it. The participant
// at work says in a callout what it does, and what it hands on travels along
// the line as a card.

import { defineModel } from '../../core/define';
import { bi, pluralRu, t, type Bi } from '../../core/i18n';
import type { ElementState, Step } from '../../core/types';
import { card } from '../git-cicd/explainers';

const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};

/** Fills {k} with a string, a number or a bilingual value. */
export function fb(b: Bi, vars: Record<string, string | number | Bi>): Bi {
  const fill = (s: string, lang: 'ru' | 'en') =>
    s.replace(/\{(\w+)\}/g, (m, k) => {
      const v = vars[k];
      if (v === undefined) return m;
      return typeof v === 'object' ? v[lang] : String(v);
    });
  return { ru: fill(b.ru, 'ru'), en: fill(b.en, 'en') };
}

/** The picture starts empty except for the given elements. */
export const hiddenExcept = (all: string[], ...shown: string[]): Record<string, ElementState> => Object.fromEntries(all.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

// ── E-TF ──

type TfP = { change: string; refresh: boolean; cbd: boolean };

/** What the plan proposes and how long the site stays without a server. */
export function tfNumbers(p: TfP, stateLost: boolean): { add: number; change: number; destroy: number; downtime: number } {
  if (stateLost) return { add: 3, change: 0, destroy: 0, downtime: 0 };
  // A new machine gets a new address, so the DNS record that points at it is updated in place too.
  if (p.change === 'image') return { add: 1, change: 1, destroy: 1, downtime: p.cbd ? 0 : 40 };
  if (p.change === 'cores' || (p.change === 'drift' && p.refresh)) return { add: 0, change: 1, destroy: 0, downtime: 15 };
  return { add: 0, change: 0, destroy: 0, downtime: 0 };
}

const TF_ALL = ['code', 'core', 'state', 'api', 'vm', 'console', 'e-read', 'e-state', 'e-refresh', 'e-apply', 'e-drift'];
const TF_SYS = bi('Эту работу выполняет программа terraform.', 'The terraform program does this work.');

export const tfModel = defineModel<TfP>({
  id: 'iac.tf-plan-apply',
  frame: 'visible',
  block: 'iac',
  title: bi('Что делают terraform plan и terraform apply', 'What terraform plan and terraform apply do'),
  summary: bi(
    'Вы запускаете `terraform apply` в каталоге с кодом. Terraform читает код, достаёт из файла state сведения о том, что он создал раньше, спрашивает облако, какими ресурсы стали сейчас, и только потом решает, что изменить. Под схемой считается, сколько ресурсов план создаст, изменит и удалит и сколько секунд сайт останется без сервера.',
    'You run `terraform apply` in a directory with code. Terraform reads the code, takes from the state file what it created before, asks the cloud what the resources are like now, and only then decides what to change. Under the diagram you see how many resources the plan creates, changes and destroys, and how many seconds the site spends without a server.',
  ),
  intro: bi(
    'Схема соберётся у вас на глазах: сейчас на ней только код и программа terraform. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен тот участник, который работает, облачко рядом с ним говорит, что он делает, а карточка на линии показывает, что передаётся дальше.\n\nКогда дойдёте до конца, выберите в «Параметрах» другое событие, например правку в консоли облака, и пройдите запуск ещё раз.',
    'The diagram builds itself as you go: now it shows only the code and the terraform program. Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the participant at work is highlighted, the callout next to it says what it does, and the card on the line shows what is handed on.\n\nOnce you reach the end, choose another event in “Parameters”, such as an edit in the cloud console, and walk the run again.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: bi('что этот участник делает', 'what that participant does') },
    { mark: 'token', text: bi('что передаётся дальше: адрес и ID, ответ облака, запрос на изменение', 'what is handed on: an address and an ID, the cloud’s answer, a change request') },
    { mark: 'icon:file', text: bi('код в файле main.tf', 'the code in main.tf') },
    { mark: 'icon:process', text: bi('программа terraform', 'the terraform program') },
    { mark: 'icon:database', text: bi('файл state, в котором Terraform хранит сведения о созданных ресурсах', 'the state file, where Terraform keeps what it knows about the resources it created') },
    { mark: 'icon:cloud', text: bi('API облака', 'the cloud API') },
    { mark: 'icon:server', text: bi('виртуальная машина в облаке', 'the virtual machine in the cloud') },
    { mark: 'icon:user', text: bi('человек, который работает в консоли облака', 'a person working in the cloud console') },
    { mark: 'dashed', text: bi('изменение в обход кода', 'a change that bypasses the code') },
    { mark: 'warn', text: bi('здесь есть разница, которую план предложит исправить', 'there is a difference the plan will propose to fix') },
    { mark: 'ok', text: bi('этап пройден', 'stage passed') },
    { mark: 'err', text: bi('здесь запуск остановился', 'the run stopped here') },
  ],
  stopLabel: bi('Запуск Terraform остановился', 'The Terraform run stopped'),
  concepts: ['iac.plan', 'iac.state', 'iac.drift'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      {
        id: 'code',
        label: 'main.tf',
        icon: 'file',
        sub: 'edu_vm.web · 4 cores',
        family: 'ci-source',
        x: 24,
        y: 40,
        w: 220,
        h: 64,
        card: card(
          bi('Код, который описывает, какими ресурсы должны быть: сеть, машину edu_vm.web и DNS-запись. О том, какие ресурсы существуют на самом деле, код ничего не знает.', 'The code that describes what the resources should be like: a network, the machine edu_vm.web and a DNS record. The code knows nothing about which resources really exist.'),
          bi('Код пишете вы и храните его в Git вместе с остальным кодом команды.', 'You write the code and keep it in Git with the rest of the team’s code.'),
          'cat main.tf',
        ),
      },
      {
        id: 'core',
        label: 'terraform',
        icon: 'process',
        work: 'spin',
        sub: 'apply',
        family: 'process',
        x: 370,
        y: 40,
        w: 220,
        h: 64,
        card: card(
          bi('Программа, которая разбирает код, строит по ссылкам между ресурсами порядок их создания, сверяет код с файлом state и с облаком, считает разницу и выполняет её. Команда `terraform plan` только показывает разницу, а `terraform apply` показывает её и после подтверждения применяет.', 'The program that parses the code, builds the creation order from the references between resources, compares the code with the state file and the cloud, computes the difference and carries it out. `terraform plan` only shows the difference; `terraform apply` shows it and applies it after confirmation.'),
          bi('Terraform запускаете вы в терминале или пайплайн CI.', 'You run Terraform in a terminal, or a CI pipeline runs it.'),
          'terraform plan',
          { page: 'help/terraform', anchor: 'USAGE' },
        ),
      },
      {
        id: 'api',
        label: bi('API облака', 'Cloud API'),
        icon: 'cloud',
        sub: 'api.edu.cloud',
        family: 'cp',
        x: 716,
        y: 40,
        w: 220,
        h: 64,
        card: card(
          bi('Облако Edu Cloud принимает запросы через свой HTTP-интерфейс, то есть API. Запрос GET читает ресурс, POST создаёт его, PATCH меняет, DELETE удаляет. Провайдер edu, которого Terraform скачал командой `terraform init`, переводит план в такие запросы.', 'The HTTP interface of Edu Cloud. GET reads a resource, POST creates it, PATCH changes it, DELETE removes it. The edu provider, which Terraform downloaded with `terraform init`, turns the plan into such requests.'),
          bi('API обслуживает компания, которой принадлежит облако.', 'The company that owns the cloud runs the API.'),
          'edu vm list',
        ),
      },
      {
        id: 'state',
        label: 'terraform.tfstate',
        icon: 'database',
        sub: 'serial 4',
        family: 'obj',
        x: 370,
        y: 250,
        w: 220,
        h: 64,
        card: card(
          bi('Файл state служит памятью Terraform. Для каждого адреса из кода, например edu_vm.web, в файле записаны ID объекта в облаке и последние известные атрибуты. Без этого файла Terraform не знает, какие объекты в облаке созданы им.', 'Terraform’s memory. For every address from the code, such as edu_vm.web, the file holds the object’s ID in the cloud and its last known attributes. Without this file Terraform does not know which cloud objects it created.'),
          bi('Файл пишет `terraform apply` после каждого ресурса, который он создал или изменил. Поле serial, то есть номер версии файла, при каждой записи увеличивается на единицу.', '`terraform apply` writes the file after every resource it creates or changes. The serial field, the version number of the file, grows by one with every write.'),
          'terraform state list',
        ),
      },
      {
        id: 'vm',
        label: 'vm-4f66',
        icon: 'server',
        sub: 'cores 2 · ubuntu-24.04',
        family: 'node',
        x: 716,
        y: 250,
        w: 220,
        h: 64,
        card: card(
          bi('Настоящая виртуальная машина в облаке, которую код называет edu_vm.web. Изменить её можно не только через Terraform, но и вручную в консоли облака.', 'The real virtual machine in the cloud that the code calls edu_vm.web. It can be changed not only through Terraform but also by hand in the cloud console.'),
          bi('Машину создал `terraform apply` при первом запуске.', '`terraform apply` created the machine on its first run.'),
          'edu vm get vm-4f66',
        ),
      },
      {
        id: 'console',
        label: bi('Дежурный в консоли', 'On-call in the console'),
        icon: 'user',
        work: 'dots',
        sub: 'ops-2',
        family: 'user',
        x: 716,
        y: 392,
        w: 220,
        h: 64,
        card: card(
          bi('Человек, который меняет ресурсы в веб-консоли или в утилите облака, а не в коде. После его правки облако перестаёт совпадать и с кодом, и с файлом state, и такое расхождение называется дрейфом.', 'A person who changes resources in the cloud’s web console or command-line tool rather than in the code. After such an edit the cloud stops matching both the code and the state file, and this mismatch is called drift.'),
          bi('Так может поступить любой, у кого есть доступ к облаку, например дежурный инженер ночью.', 'Anyone with access to the cloud can do this, for example an on-call engineer at night.'),
          'edu log',
        ),
      },
    ],
    edges: [
      { id: 'e-read', from: 'code', to: 'core', label: bi('чтение кода', 'reading the code'), card: card(bi('Terraform читает все файлы .tf в каталоге. Порядок работы задают ссылки между ресурсами, а не порядок строк в файле.', 'Terraform reads every .tf file in the directory. The order of work comes from the references between resources, not from the order of lines in the file.'), TF_SYS) },
      { id: 'e-state', from: 'state', to: 'core', labelAt: 0.22, label: bi('чтение и запись state', 'reading and writing the state'), card: card(bi('Из файла state Terraform узнаёт ID своих ресурсов, а после изменений записывает туда новые сведения.', 'From the state file Terraform learns the IDs of its resources, and after changes it writes the new facts there.'), TF_SYS, 'terraform show') },
      { id: 'e-refresh', from: 'core', to: 'api', label: bi('запрос текущего состояния', 'asking for the current state'), card: card(bi('Перед планом Terraform перечитывает из облака каждый ресурс, записанный в state. Этот шаг называется refresh, и на нём Terraform замечает дрейф.', 'Before the plan Terraform rereads from the cloud every resource recorded in the state. This step is called refresh, and that is where Terraform notices drift.'), bi('Refresh выполняет terraform plan, если его не запустили с ключом -refresh=false.', 'terraform plan does the refresh unless it runs with -refresh=false.')) },
      { id: 'e-apply', from: 'api', to: 'vm', label: bi('чтение и изменение машины', 'reading and changing the machine'), card: card(bi('Облако читает машину по запросу GET и меняет её по запросам POST, PATCH и DELETE, которые отправляет провайдер.', 'The cloud reads the machine on a GET request and changes it on the POST, PATCH and DELETE requests the provider sends.'), bi('Запросы отправляет провайдер edu по команде terraform apply.', 'The edu provider sends the requests when terraform apply tells it to.')) },
      { id: 'e-drift', from: 'console', to: 'vm', dashed: true, label: bi('правка вручную', 'a manual edit'), card: card(bi('Человек меняет машину в обход кода, и следующий plan с refresh увидит эту правку и предложит вернуть машину к тому, что записано в коде.', 'A change that bypasses the code. The next plan with refresh sees it and proposes to bring the machine back to what the code says.'), bi('Правку делает человек в консоли облака.', 'A person in the cloud console makes the edit.'), 'edu vm update vm-4f66 --cores 4') },
    ],
  },
  params: [
    {
      id: 'change',
      label: bi('Что произошло с тех пор, как машину создали', 'What happened since the machine was created'),
      kind: 'choice',
      default: 'cores',
      options: [
        { id: 'cores', label: bi('вы поменяли в коде число ядер с 2 на 4', 'you changed the cores in the code from 2 to 4') },
        { id: 'image', label: bi('вы поменяли в коде образ на debian-13', 'you changed the image in the code to debian-13') },
        { id: 'drift', label: bi('дежурный поставил машине 4 ядра в консоли, а код остался прежним', 'the on-call engineer gave the machine 4 cores in the console, and the code stayed the same') },
        { id: 'none', label: bi('ничего не менялось', 'nothing changed') },
      ],
      near: 'code',
      group: bi('Что изменилось', 'What changed'),
      predict: {
        prompt: bi('Вы выбрали, что изменилось. Что Terraform предложит сделать с машиной?', 'You chose what changed. What will Terraform propose to do with the machine?'),
        options: [
          { id: 'update', text: bi('Изменить машину на месте, не пересоздавая её', 'Change the machine in place without recreating it') },
          { id: 'replace', text: bi('Удалить машину и создать вместо неё новую', 'Destroy the machine and create a new one instead') },
          { id: 'nothing', text: bi('Ничего не делать, потому что облако и код совпадают', 'Do nothing, because the cloud and the code match') },
        ],
        resolve: (_p, n) => ((last(n).destroy ?? 0) > 0 ? 'replace' : (last(n).change ?? 0) > 0 ? 'update' : 'nothing'),
      },
    },
    {
      id: 'refresh',
      label: bi('Перед планом спросить облако о текущем состоянии (refresh)', 'Ask the cloud about the current state before the plan (refresh)'),
      kind: 'toggle',
      default: true,
      near: 'api',
      group: bi('Как Terraform строит план', 'How Terraform builds the plan'),
      predict: {
        prompt: bi('Terraform запускают с ключом -refresh=false, то есть он не спрашивает облако, какой стала машина. Если дежурный поменял машину в консоли, заметит ли это такой plan?', 'Terraform runs with -refresh=false, so it does not ask the cloud what the machine is like now. If the on-call engineer changed the machine in the console, will such a plan notice?'),
        options: [
          { id: 'no', text: bi('Нет, Terraform поверит файлу state и правки не увидит', 'No, Terraform trusts the state file and does not see the edit') },
          { id: 'yes', text: bi('Да, Terraform всё равно сверит машину с облаком', 'Yes, Terraform compares the machine with the cloud anyway') },
        ],
        resolve: () => 'no',
      },
    },
    {
      id: 'cbd',
      label: bi('Создавать новую машину до удаления старой (create_before_destroy)', 'Create the new machine before destroying the old one (create_before_destroy)'),
      kind: 'toggle',
      default: false,
      near: 'vm',
      group: bi('Как Terraform строит план', 'How Terraform builds the plan'),
      predict: {
        prompt: bi('Чтобы сменить образ, Terraform пересоздаёт машину. Что изменит в этом пересоздании настройка create_before_destroy = true?', 'To change the image Terraform recreates the machine. What does create_before_destroy = true change in that replacement?'),
        options: [
          { id: 'order', text: bi('Terraform сначала создаст новую машину, а старую удалит потом, и сайт не останется без сервера', 'Terraform creates the new machine first and destroys the old one afterwards, so the site is never left without a server') },
          { id: 'inplace', text: bi('Terraform поменяет образ на работающей машине без пересоздания', 'Terraform changes the image on the running machine without recreating it') },
        ],
        resolve: () => 'order',
      },
    },
  ],
  breaks: [
    {
      id: 'state-lost',
      label: bi('Файл terraform.tfstate удалили', 'The terraform.tfstate file was deleted'),
      remove: ['state', 'e-state'],
      boundary: 'storage',
      predict: {
        prompt: bi('Файл terraform.tfstate удалили, а сеть, машина и DNS-запись в облаке продолжают работать. Что предложит plan?', 'The terraform.tfstate file was deleted, while the network, the machine and the DNS record keep running in the cloud. What will plan propose?'),
        options: [
          { id: 'create', text: bi('Создать все три ресурса заново, как будто в облаке ничего нет', 'Create all three resources again, as if the cloud were empty') },
          { id: 'none', text: bi('Ничего не делать, потому что ресурсы в облаке на месте', 'Do nothing, because the resources are still in the cloud') },
        ],
        resolve: () => 'create',
      },
    },
    {
      id: 'rate-limit',
      label: bi('Облако отвечает на запросы ошибкой 429 Too Many Requests', 'The cloud answers requests with 429 Too Many Requests'),
      remove: ['e-refresh', 'e-apply'],
      boundary: 'network',
      predict: {
        prompt: bi('Облако отвечает на каждый запрос Terraform ошибкой 429 Too Many Requests, то есть «слишком много запросов». Что станет после этого запуска с машиной и с файлом state?', 'The cloud answers every Terraform request with 429 Too Many Requests. What becomes of the machine and the state file after this run?'),
        options: [
          { id: 'stop', text: bi('Ничего не изменится, потому что Terraform прекратит работу, как только облако откажет', 'Nothing changes, because Terraform stops as soon as the cloud refuses') },
          { id: 'half', text: bi('Машина изменится, а файл state останется прежним', 'The machine changes, while the state file stays as it was') },
        ],
        resolve: () => 'stop',
      },
    },
  ],
  metrics: [
    { id: 'add', label: bi('будет создано ресурсов', 'resources to add') },
    { id: 'change', label: bi('будет изменено ресурсов', 'resources to change') },
    { id: 'destroy', label: bi('будет удалено ресурсов', 'resources to destroy') },
    { id: 'down', label: bi('сайт простоит без сервера', 'the site stays without a server'), unit: bi('с', 's') },
  ],
  run(p, broken) {
    const lost = broken.has('state-lost');
    const limited = broken.has('rate-limit');
    const n = tfNumbers(p, lost);
    const m = { add: n.add, change: n.change, destroy: n.destroy, down: n.downtime };
    const codeCores = p.change === 'cores' ? 4 : 2;
    const cloudCores = p.change === 'drift' ? 4 : 2;
    const codeSub = p.change === 'image' ? 'edu_vm.web · debian-13' : `edu_vm.web · ${codeCores} cores`;
    const total = n.add + n.change + n.destroy;
    const steps: Step[] = [
      {
        id: 'parse',
        label: bi('код', 'code'),
        caption: bi(
          'Terraform читает файлы .tf в каталоге и находит три ресурса: сеть, машину edu_vm.web и DNS-запись. Машина ссылается на сеть, а запись на машину, поэтому создавать их можно только в таком порядке. По этим ссылкам Terraform строит граф зависимостей, то есть схему того, какой ресурс от какого зависит.',
          'Terraform reads the .tf files in the directory and finds three resources: a network, the machine edu_vm.web and a DNS record. The machine refers to the network and the record to the machine, so they can be created only in that order, and Terraform builds a graph from these references.',
        ),
        focus: ['e-read', 'core'],
        tokens: [{ edge: 'e-read', label: 'main.tf' }],
        say: { core: fb(bi('Terraform читает код и видит, что машина edu_vm.web должна работать на образе {i} с {c} ядрами.', 'Terraform reads the code and sees that the machine edu_vm.web must run the {i} image with {c} cores.'), { i: p.change === 'image' ? 'debian-13' : 'ubuntu-24.04', c: codeCores }) },
        values: { code: codeSub, vm: `cores ${cloudCores} · ubuntu-24.04` },
        states: hiddenExcept(TF_ALL, 'code', 'core', 'e-read'),
      },
    ];
    if (lost) {
      steps.push({
        id: 'nostate',
        label: 'state?',
        caption: bi('Terraform ищет файл terraform.tfstate и не находит его. Ни одного ID у Terraform теперь нет, поэтому он считает, что в облаке нет ни одного его ресурса.', 'Terraform looks for terraform.tfstate and does not find it. It now has no IDs at all, so it assumes the cloud holds none of its resources.'),
        focus: ['state'],
        reveal: ['state'],
        say: { state: bi('Файла state нет, и некому сообщить Terraform, что сеть, машина и запись уже созданы.', 'There is no state file, and nothing can tell Terraform that the network, the machine and the record already exist.') },
        states: { state: 'err' },
        values: { state: '—' },
      });
      steps.push({
        id: 'plan',
        label: 'plan',
        caption: bi('План предлагает создать все три ресурса. Облако при этом никто не трогал, но связь Terraform с ним потеряна: apply попытается создать вторую сеть и вторую машину рядом с работающими, а если имена в облаке должны быть уникальными, остановится с ошибкой о занятом имени.', 'The plan proposes to create all three resources. Nobody touched the cloud, but Terraform’s link to it is lost: apply would try to create a second network and a second machine next to the running ones, and if names in the cloud must be unique, it stops with an error about a taken name.'),
        focus: ['core'],
        say: { core: bi('Terraform сравнивает код с пустым state и решает, что все три ресурса нужно создать.', 'Terraform compares the code with an empty memory and decides that all three resources must be created.') },
        states: { core: 'err' },
        values: { core: 'Plan: 3 to add' },
        metrics: m,
        broken: { at: 'state', message: 'Plan: 3 to add, 0 to change, 0 to destroy.', caption: bi('План, в котором Terraform хочет создать заново всё, что давно работает, почти всегда означает, что он не нашёл файл state. Поэтому state хранят в общем хранилище с резервными копиями, а не на одном ноутбуке.', 'A plan in which Terraform wants to create again everything that has long been running almost always means it did not find the state file. That is why the state is kept in shared storage with backups, not on one laptop.') },
      });
      return steps;
    }
    steps.push({
      id: 'state',
      label: 'state',
      caption: bi('Из файла state Terraform узнаёт, что адресу edu_vm.web в облаке соответствует машина vm-4f66 и что в прошлый раз у неё было 2 ядра и образ ubuntu-24.04.', 'From the state file Terraform learns that the address edu_vm.web corresponds to the machine vm-4f66 in the cloud, and that last time it had 2 cores and the ubuntu-24.04 image.'),
      focus: ['e-state', 'state'],
      reveal: ['state', 'e-state'],
      tokens: [{ edge: 'e-state', label: 'edu_vm.web = vm-4f66' }],
      say: { state: bi('Файл state хранит запись о том, что edu_vm.web создана как машина vm-4f66 с 2 ядрами.', 'The state file holds the record that edu_vm.web was created as the machine vm-4f66 with 2 cores.') },
      states: { state: 'ok' },
    });
    if (p.change === 'drift')
      steps.push({
        id: 'drift',
        label: bi('дрейф', 'drift'),
        caption: bi('Тем временем дежурный ставит машине vm-4f66 в консоли облака 4 ядра. Ни код, ни файл state об этой правке не знают, и теперь все три версии мира расходятся.', 'Meanwhile the on-call engineer gives vm-4f66 4 cores in the cloud console. Neither the code nor the state file knows about this edit, and the three versions of the world now differ.'),
        focus: ['e-drift', 'console'],
        reveal: ['console', 'e-drift', 'vm'],
        tokens: [{ edge: 'e-drift', label: 'cores = 4' }],
        say: { console: bi('Дежурный меняет в консоли число ядер машины vm-4f66 с 2 на 4, потому что ночью сайту не хватало мощности.', 'The on-call engineer changes the cores of vm-4f66 from 2 to 4 in the console, because the site lacked capacity at night.') },
        states: { vm: 'warn' },
      });
    const callCloud = (id: string, what: Bi): Step => ({
      id,
      label: '429',
      caption: bi('Облако отвечает на запрос ошибкой 429 Too Many Requests, и Terraform прекращает работу. Машина и файл state остались такими, какими были до запуска, поэтому следующий запуск начнётся с того же места.', 'The cloud answers the request with 429 Too Many Requests, and Terraform stops. The machine and the state file are as they were before the run, so the next run starts from the same place.'),
      focus: ['e-refresh', 'api'],
      reveal: ['api', 'e-refresh'],
      tokens: [{ edge: 'e-refresh', label: what }],
      say: { api: bi('API облака отклоняет запрос, потому что от этого ключа доступа пришло слишком много запросов за короткое время.', 'The cloud API rejects the request, because too many requests came from this access key in a short time.') },
      states: { api: 'err', 'e-refresh': 'err' },
      metrics: { add: 0, change: 0, destroy: 0, down: 0 },
      broken: { at: 'api', message: '│ Error: reading VM vm-4f66: 429 Too Many Requests: rate limit of the training API exceeded, retry later', caption: bi('Ошибка 429 означает, что облако ограничивает число запросов. Ничего не сломалось, поэтому подождите и запустите Terraform снова, а в CI не запускайте одновременно много пайплайнов, которые обращаются к одному облаку.', 'Error 429 means the cloud limits the number of requests. Nothing is broken: wait and run Terraform again, and in CI do not run many pipelines against one cloud at once.') },
    });
    if (p.refresh) {
      if (limited) {
        steps.push(callCloud('refresh', bi('GET vm-4f66', 'GET vm-4f66')));
        return steps;
      }
      steps.push({
        id: 'refresh',
        label: 'refresh',
        caption:
          p.change === 'drift'
            ? bi('Terraform спрашивает облако о машине vm-4f66 и узнаёт, что у неё 4 ядра, хотя в state записано 2. Он сообщает об этом строкой «Objects have changed outside of Terraform» и обновляет свои сведения перед сравнением.', 'Terraform asks the cloud about vm-4f66 and learns it has 4 cores, although the state says 2. It reports this with the line “Objects have changed outside of Terraform” and updates its facts before the comparison.')
            : bi('Terraform спрашивает облако о машине vm-4f66 и получает те же сведения, что записаны в state: 2 ядра и образ ubuntu-24.04. С тех пор как машину создали, в облаке её никто не менял.', 'Terraform asks the cloud about vm-4f66 and gets the same facts as in the state: 2 cores and the ubuntu-24.04 image. Nobody changed the machine in the cloud since it was created.'),
        focus: ['e-refresh', 'api'],
        reveal: ['api', 'e-refresh', 'vm', 'e-apply'],
        tokens: [{ edge: 'e-refresh', label: 'GET vm-4f66' }, { edge: 'e-refresh', reverse: true, label: `cores = ${cloudCores}` }],
        say: { api: fb(bi('API облака читает машину vm-4f66 и отвечает, что сейчас у неё {c} ядра и образ ubuntu-24.04.', 'The cloud API reads vm-4f66 and answers that it now has {c} cores and the ubuntu-24.04 image.'), { c: cloudCores }) },
        states: { api: 'ok' },
      });
    } else {
      steps.push({
        id: 'norefresh',
        label: '-refresh=false',
        caption:
          p.change === 'drift'
            ? bi('Terraform запущен с ключом -refresh=false и в облако не обращается. Он верит файлу state, где записано 2 ядра, и правки дежурного не видит, поэтому план расходится с действительностью.', 'Terraform runs with -refresh=false and does not ask the cloud. It trusts the state file, which says 2 cores, and does not see the on-call engineer’s edit, so the plan disagrees with reality.')
            : bi('Terraform запущен с ключом -refresh=false и в облако не обращается. Он верит файлу state и считает, что машина осталась такой, какой её записали при создании.', 'Terraform runs with -refresh=false and does not ask the cloud. It trusts the state file and assumes the machine is as it was recorded at creation.'),
        focus: ['core'],
        say: { core: bi('Terraform пропускает вопрос к облаку и берёт сведения о машине только из файла state.', 'Terraform skips asking the cloud and takes the machine’s facts from the state file only.') },
      });
    }
    const diff =
      p.change === 'image'
        ? bi('Образ работающей машины облако поменять не может, поэтому план помечает строку с образом «# forces replacement» и предлагает пересоздать машину (знак -/+). У новой машины будет новый адрес, поэтому DNS-запись www, которая ссылается на адрес машины, план тоже предлагает изменить на месте (знак ~).', 'The cloud cannot change the image of a running machine, so the plan marks the image line “# forces replacement” and proposes to recreate the machine (the sign -/+). The new machine gets a new address, so the plan also proposes to update in place the DNS record www, which refers to the machine’s address (the sign ~).')
        : p.change === 'cores'
          ? bi('Число ядер облако умеет менять на месте, поэтому план предлагает изменить машину, не пересоздавая её (знак ~, «update in-place»), и вместо 2 ядер у машины станет 4.', 'The cloud can change the number of cores in place, so the plan proposes to change the machine without recreating it (the sign ~, “update in-place”), and the machine gets 4 cores instead of 2.')
          : p.change === 'drift' && p.refresh
            ? bi('В коде записано 2 ядра, а у машины теперь 4. Код описывает желаемое состояние, поэтому план предлагает вернуть машине 2 ядра и тем самым отменить правку дежурного.', 'The code says 2 cores, while the machine now has 4. The code describes the desired state, so the plan proposes to give the machine 2 cores back and thereby undo the on-call engineer’s edit.')
            : bi('Код совпадает с тем, что Terraform знает о машине, и план сообщает «No changes. Your infrastructure matches the configuration».', 'The code matches what Terraform knows about the machine, and the plan reports “No changes. Your infrastructure matches the configuration”.');
    steps.push({
      id: 'diff',
      label: 'plan',
      caption: diff,
      focus: ['core'],
      say: { core: fb(bi('Terraform сравнивает код с тем, что знает о машине, и считает, сколько ресурсов нужно создать ({a}), сколько изменить ({c}) и сколько удалить ({d}).', 'Terraform compares the code with what it knows about the machine and counts how many resources to add ({a}), to change ({c}) and to destroy ({d}).'), { a: n.add, c: n.change, d: n.destroy }) },
      states: { core: total ? 'warn' : 'ok', ...(total ? { code: 'warn' } : {}) },
      values: { core: `+${n.add} ~${n.change} -${n.destroy}` },
      metrics: m,
    });
    if (!total) return steps;
    if (limited) {
      steps.push(callCloud('apply', bi('PATCH vm-4f66', 'PATCH vm-4f66')));
      return steps;
    }
    const applyStep: Step =
      p.change === 'image'
        ? {
            id: 'apply',
            label: 'apply',
            caption: p.cbd
              ? bi('Настройка create_before_destroy меняет порядок: облако сначала создаёт новую машину vm-4f9a с образом debian-13, затем Terraform направляет DNS-запись на её адрес и только потом удаляет старую машину. Сервер у сайта есть всё время, но клиенты, которые запомнили старый адрес, увидят новый, только когда истечёт срок хранения DNS-записи, поэтому старую машину на практике удаляют не сразу. Какое-то время в облаке работают две машины, и за обе приходится платить.', 'create_before_destroy changes the order: the cloud first creates the new machine vm-4f9a with debian-13, then Terraform points the DNS record at its address and only then destroys the old machine. The site has a server all the time, but clients that remembered the old address see the new one only when the DNS record’s caching time runs out, so in practice the old machine is not removed at once. For a while two machines run in the cloud, and you pay for both.')
              : bi('Облако сначала удаляет старую машину vm-4f66 и только потом создаёт новую vm-4f9a с образом debian-13, после чего Terraform направляет DNS-запись на новый адрес. Новая машина загружается около 40 секунд, и всё это время сайту отвечать некому.', 'The cloud first destroys the old machine vm-4f66 and only then creates the new vm-4f9a with debian-13, after which Terraform points the DNS record at the new address. While the new machine boots, about 40 seconds, nobody answers for the site.'),
            focus: ['e-apply', 'vm'],
            reveal: ['api', 'e-apply', 'vm'],
            tokens: [{ edge: 'e-apply', label: p.cbd ? 'POST, PATCH dns, DELETE' : 'DELETE, POST, PATCH dns' }],
            say: { vm: p.cbd ? bi('Новая машина vm-4f9a уже работает, и только после этого облако удаляет старую vm-4f66.', 'The new machine vm-4f9a is already running, and only then the cloud destroys the old vm-4f66.') : bi('Старой машины vm-4f66 больше нет, а новая vm-4f9a ещё загружается, поэтому сайт около 40 секунд не отвечает.', 'The old machine vm-4f66 is gone, and the new vm-4f9a is still booting, so the site does not answer for about 40 seconds.') },
            states: { vm: 'ok', api: 'ok' },
            values: { vm: 'vm-4f9a · debian-13' },
            metrics: m,
          }
        : {
            id: 'apply',
            label: 'apply',
            caption:
              p.change === 'drift'
                ? bi('Провайдер отправляет запрос PATCH, и облако возвращает машине 2 ядра, как записано в коде. Правка дежурного отменена; если 4 ядра были нужны, их следовало записать в код.', 'The provider sends a PATCH request, and the cloud gives the machine 2 cores again, as the code says. The on-call engineer’s edit is undone; if 4 cores were needed, they should have been written into the code.')
                : bi('Провайдер отправляет запрос PATCH, и облако меняет машине число ядер с 2 на 4. Машина та же, с тем же ID и тем же диском, но на время изменения она останавливается примерно на 15 секунд.', 'The provider sends a PATCH request, and the cloud changes the machine’s cores from 2 to 4. It is the same machine with the same ID and disk, but it stops for about 15 seconds while it is changed.'),
            focus: ['e-apply', 'vm'],
            reveal: ['api', 'e-apply', 'vm'],
            tokens: [{ edge: 'e-apply', label: `PATCH cores = ${codeCores}` }],
            say: { vm: fb(bi('Облако останавливает машину vm-4f66, ставит ей {c} ядра и запускает её снова.', 'The cloud stops vm-4f66, gives it {c} cores and starts it again.'), { c: codeCores }) },
            states: { vm: 'ok', api: 'ok' },
            values: { vm: `cores ${codeCores} · ubuntu-24.04` },
            metrics: m,
          };
    steps.push(applyStep);
    steps.push({
      id: 'write',
      label: 'state',
      caption: bi('Terraform записывает в файл state новые сведения о машине. При каждой записи он увеличивает номер версии state, который хранится в поле serial, поэтому serial растёт с 4 до 5. Следующий plan начнётся с этих сведений и, если ничего не изменится, покажет «No changes».', 'Terraform writes the new facts about the machine into the state file. On every write it raises the state’s version number, kept in the serial field, so serial grows from 4 to 5. The next plan starts from these facts and, if nothing changes, shows “No changes”.'),
      focus: ['e-state', 'state'],
      tokens: [{ edge: 'e-state', reverse: true, label: 'serial 5' }],
      say: { state: bi('В файл state записано, какой стала машина после изменения, и его версия теперь 5.', 'The state file records what the machine is like after the change, and its version is now 5.') },
      values: { state: 'serial 5' },
      states: { state: 'ok', core: 'ok' },
      metrics: m,
    });
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (change.id === 'state-lost') return change.on ? bi('Без файла state Terraform не знает, какие ресурсы в облаке созданы им, и план предлагает создать всё заново.', 'Without the state file Terraform does not know which cloud resources it created, and the plan proposes to create everything again.') : bi('Файл state вернули, и Terraform снова узнаёт свои ресурсы по их ID.', 'The state file is back, and Terraform recognises its resources by their IDs again.');
      return change.on ? bi('Облако отклоняет запросы, и Terraform останавливается на первом же обращении к нему, ничего не изменив.', 'The cloud rejects requests, and Terraform stops at its first call without changing anything.') : bi('Облако снова принимает запросы, и запуск проходит до конца.', 'The cloud accepts requests again, and the run goes to the end.');
    }
    const a1 = last(next);
    const secs = a1.down ?? 0;
    const line = fb(bi('Теперь итог плана такой: создать {a}, изменить {c} и удалить {d}, а сайт {t}.', 'The plan now comes to {a} to add, {c} to change and {d} to destroy, and the site {t}.'), { a: a1.add ?? 0, c: a1.change ?? 0, d: a1.destroy ?? 0, t: secs ? bi(`остаётся без сервера ${secs} ${pluralRu(secs, ['секунду', 'секунды', 'секунд'])}`, `is without a server for ${secs} s`) : bi('ни секунды не остаётся без сервера', 'is never without a server') });
    if (change.id === 'cbd') return b.cbd ? fb(bi('Новая машина создаётся раньше, чем удаляется старая, поэтому сервер у сайта есть всё время смены образа. DNS-запись при этом тоже меняется, потому что у новой машины другой адрес. {l}', 'The new machine is created before the old one is destroyed, so the site has a server throughout the image change. The DNS record changes too, because the new machine has another address. {l}'), { l: line }) : line;
    if (change.id === 'refresh' && !b.refresh) return fb(bi('Без refresh Terraform не спрашивает облако, поэтому правку в консоли он не увидит, и план может разойтись с действительностью. {l}', 'Without refresh Terraform does not ask the cloud, so it will not see an edit in the console, and the plan may disagree with reality. {l}'), { l: line });
    return line;
  },
});

// ── E-ANS ──

type AnsP = { task: string; run: number };

const HOSTS = ['h1', 'h2', 'h3'] as const;
const HOST_NAME: Record<string, string> = { h1: 'web1', h2: 'web2', h3: 'web3' };
const edgeOf = (h: string) => `e${h.slice(1)}`;

/** Totals of one run: changed tasks (handlers included), failed hosts, handler runs. */
export function ansNumbers(p: AnsP, broken: ReadonlySet<string>): { changed: number; failed: number; handlers: number } {
  const live = 3 - (broken.has('no-python') ? 1 : 0);
  const fail2 = broken.has('task-fails') ? 1 : 0;
  const perHost = p.run === 1 ? 3 : p.task === 'shell' ? 1 : 0;
  const handlers = p.run === 1 ? live - fail2 : 0;
  return { changed: live * perHost + handlers, failed: (live < 3 ? 1 : 0) + fail2, handlers };
}

const TIMES_RU = ['ни разу', 'один раз', 'два раза', 'три раза'];
const TIMES_EN = ['never', 'once', 'twice', 'three times'];
const ANS_ALL = ['inv', 'ctl', 'h1', 'h2', 'h3', 'hq', 'e-inv', 'e1', 'e2', 'e3', 'e-notify'];
const ANS_SYS = bi('Эту работу выполняет ansible-playbook на управляющей машине.', 'ansible-playbook on the control machine does this work.');

export const ansModel = defineModel<AnsP>({
  id: 'iac.ansible-run',
  frame: 'visible',
  block: 'iac',
  title: bi('Как Ansible выполняет плейбук на нескольких хостах', 'How Ansible walks a playbook across hosts'),
  summary: bi(
    'Вы запускаете `ansible-playbook site.yml` для группы web из трёх хостов. Плейбук ставит nginx, раскладывает его конфигурацию, пишет строку в `/etc/motd` и проверяет, что nginx запущен. Каждая задача сначала смотрит, как устроен хост сейчас, и меняет только разницу, поэтому правильный плейбук на втором прогоне ничего не меняет. Под схемой считается, сколько задач ответили changed, сколько хостов Ansible исключил из дальнейшего выполнения и сколько раз перезагрузился nginx.',
    'You run `ansible-playbook site.yml` for the web group of three hosts. The playbook installs nginx, lays out its config, writes a line into `/etc/motd` and checks that nginx is running. Every task first looks at how the host is now and changes only the difference, so a correct playbook changes nothing on the second run. Under the diagram you see how many tasks answered changed, how many hosts dropped out and how many times nginx was reloaded.',
  ),
  intro: bi(
    'Схема соберётся у вас на глазах: сейчас на ней только инвентарь и программа ansible-playbook. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждый шаг соответствует одной задаче плейбука, а карточки на линиях показывают, что ответил модуль на каждом хосте.\n\nКогда пройдёте первый прогон, увеличьте в «Параметрах» номер прогона и посмотрите, что изменится.',
    'The diagram builds itself as you go: now it shows only the inventory and the ansible-playbook program. Press “Start from the first step”, then go on with “Step forward” above the diagram. Every step is one task of the playbook, and the cards on the lines show what the module answered on each host.\n\nOnce you finish the first run, increase the run number in “Parameters” and see what changes.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: bi('что этот участник делает', 'what that participant does') },
    { mark: 'token', text: bi('что ответил модуль: ok, changed или ошибку', 'what the module answered: ok, changed or an error') },
    { mark: 'icon:file', text: bi('инвентарь со списком хостов', 'the inventory with the list of hosts') },
    { mark: 'icon:terminal', text: bi('ansible-playbook на управляющей машине', 'ansible-playbook on the control machine') },
    { mark: 'icon:server', text: bi('управляемый хост', 'a managed host') },
    { mark: 'icon:process', text: bi('очередь обработчиков (handlers)', 'the handler queue') },
    { mark: 'warn', text: bi('задача на этом хосте что-то изменила (changed)', 'the task changed something on this host (changed)') },
    { mark: 'ok', text: bi('хост уже был в нужном состоянии (ok)', 'the host was already in the desired state (ok)') },
    { mark: 'err', text: bi('на этом хосте задача завершилась с ошибкой, и Ansible исключил хост из дальнейшего выполнения плейбука', 'the task failed on this host, and it left the play') },
  ],
  stopLabel: bi('Ansible исключил хост из выполнения', 'A host left the play'),
  concepts: ['iac.idempotence', 'iac.module', 'iac.handler'],
  diagram: {
    width: 960,
    height: 420,
    nodes: [
      {
        id: 'inv',
        label: 'inventory.ini',
        icon: 'file',
        sub: '[web] web1 web2 web3',
        family: 'obj',
        x: 24,
        y: 40,
        w: 220,
        h: 64,
        card: card(bi('Инвентарь, то есть файл со списком хостов и групп. Строка `hosts: web` в плейбуке выбирает из него хосты группы web.', 'The inventory, a file listing hosts and groups. The line `hosts: web` in the playbook picks the hosts of the web group from it.'), bi('Инвентарь пишете вы и храните его в репозитории рядом с плейбуком.', 'You write the inventory and keep it in the repository next to the playbook.'), 'ansible-inventory --graph'),
      },
      {
        id: 'ctl',
        label: 'ansible-playbook',
        icon: 'terminal',
        sub: 'site.yml',
        family: 'process',
        x: 24,
        y: 190,
        w: 220,
        h: 64,
        card: card(bi('Программа ansible-playbook работает на управляющей машине. Она читает инвентарь и плейбук, заходит на хосты по SSH, отправляет туда модули с параметрами задачи и собирает их ответы. На самих хостах никакой постоянной программы Ansible нет, нужны только SSH и python3.', 'The program on the control machine. It reads the inventory and the playbook, logs in to the hosts over SSH, sends them modules with the task arguments and collects their answers. No permanent Ansible program runs on the hosts; only SSH and python3 are needed.'), bi('Её запускаете вы в терминале или пайплайн CI.', 'You run it in a terminal, or a CI pipeline does.'), 'ansible-playbook site.yml'),
      },
      { id: 'h1', label: 'web1', icon: 'server', sub: '', family: 'node', x: 716, y: 24, w: 220, h: 64, card: card(bi('Хост web1 входит в группу web. Модуль, который сюда прислал Ansible, выполняется на этом хосте, сравнивает состояние хоста с описанием задачи и отвечает в формате JSON, изменил ли он что-нибудь.', 'The first host of the web group. The module Ansible sent here runs on this host, compares it with the task’s description and answers in JSON whether it changed anything.'), bi('Хост создало облако или администратор.', 'The cloud or an administrator created the host.'), 'ansible web1 -m ansible.builtin.setup') },
      { id: 'h2', label: 'web2', icon: 'server', sub: '', family: 'node', x: 716, y: 168, w: 220, h: 64, card: card(bi('Хост web2 тоже входит в группу web. Задачи у него те же, что у web1, а состояние своё, поэтому и ответы модулей могут отличаться.', 'The second host of the web group. Its tasks are the same as web1’s, but its state is its own, so the modules’ answers may differ.'), bi('Хост создало облако или администратор.', 'The cloud or an administrator created the host.'), 'ansible web2 -a "cat /etc/motd"') },
      { id: 'h3', label: 'web3', icon: 'server', sub: '', family: 'node', x: 716, y: 312, w: 220, h: 64, card: card(bi('Хост web3 тоже входит в группу web. Если на нём нет python3, модули Ansible запуститься на нём не могут.', 'The third host of the web group. If it has no python3, Ansible modules cannot run on it.'), bi('Хост создало облако или администратор.', 'The cloud or an administrator created the host.'), 'ansible web3 -m ansible.builtin.ping') },
      {
        id: 'hq',
        label: bi('Очередь обработчиков', 'Handler queue'),
        icon: 'process',
        sub: 'Reload nginx',
        family: 'flow',
        shape: 'buffer',
        x: 24,
        y: 330,
        w: 220,
        h: 64,
        card: card(bi('Обработчиком (по-английски handler) называют задачу, которая выполняется не сразу, а только по уведомлению другой задачи. Сюда обработчик попадает, когда его уведомляет задача, которая что-то изменила. Ansible выполняет обработчик один раз в конце сценария на каждом хосте, куда пришло уведомление, сколько бы задач его ни уведомили.', 'A handler lands here when a task that changed something notifies it. Ansible runs the handler once at the end of the play on every host that got a notification, however many tasks notified it.'), bi('Уведомление отправляет задача со строкой `notify:`.', 'A task with a `notify:` line sends the notification.'), 'grep -n notify site.yml', { page: 'ansible-doc/ansible.builtin.service', anchor: 'OPTIONS' }),
      },
    ],
    edges: [
      { id: 'e-inv', from: 'inv', to: 'ctl', label: bi('список хостов', 'the host list'), card: card(bi('Строка `hosts: web` выбирает из инвентаря хосты группы web.', 'The line `hosts: web` picks the hosts of the web group from the inventory.'), ANS_SYS) },
      { id: 'e1', from: 'ctl', to: 'h1', label: bi('SSH и модуль', 'SSH and a module'), labelAt: 0.45, card: card(bi('По SSH на хост уходит модуль с параметрами задачи. Модуль выполняется на хосте и отвечает в формате JSON, например `{"changed": true}`.', 'A module with the task arguments goes to the host over SSH. It runs on the host and answers in JSON, for example `{"changed": true}`.'), ANS_SYS) },
      { id: 'e2', from: 'ctl', to: 'h2', label: bi('SSH и модуль', 'SSH and a module'), card: card(bi('Та же задача уходит на второй хост. Каждая задача проходит все хосты, прежде чем Ansible начнёт следующую.', 'The same task goes to the second host. Every task goes through all hosts before Ansible starts the next one.'), ANS_SYS) },
      { id: 'e3', from: 'ctl', to: 'h3', label: bi('SSH и модуль', 'SSH and a module'), labelAt: 0.45, card: card(bi('Та же задача уходит на третий хост.', 'The same task goes to the third host.'), ANS_SYS) },
      { id: 'e-notify', from: 'ctl', to: 'hq', label: bi('уведомление обработчику', 'notifying the handler'), card: card(bi('Задача со строкой notify ставит обработчик в очередь, только если она ответила changed. Если задача ответила ok, уведомления нет.', 'A task with a notify line queues the handler only if it answered changed. If the task answered ok, there is no notification.'), ANS_SYS) },
    ],
  },
  params: [
    {
      id: 'task',
      label: bi('Как задача пишет строку «Managed by Ansible» в /etc/motd', 'How the task writes the line “Managed by Ansible” into /etc/motd'),
      kind: 'choice',
      default: 'lineinfile',
      options: [
        { id: 'lineinfile', label: bi('модуль lineinfile, который следит, чтобы строка была в файле', 'the lineinfile module, which makes sure the line is in the file') },
        { id: 'shell', label: bi('модуль shell с командой echo … >> /etc/motd', 'the shell module with the command echo … >> /etc/motd') },
      ],
      near: 'e2',
      group: bi('Что написано в плейбуке', 'What the playbook says'),
      predict: {
        prompt: bi('Строку в /etc/motd теперь дописывает задача shell с командой echo >>. Что ответит эта задача на втором и третьем прогоне?', 'The line in /etc/motd is now appended by a shell task with echo >>. What will this task answer on the second and third run?'),
        options: [
          { id: 'changed', text: bi('changed на каждом прогоне, и строк в файле с каждым разом становится больше', 'changed on every run, and the file gets one more line each time') },
          { id: 'ok', text: bi('ok, потому что строка уже есть в файле', 'ok, because the line is already in the file') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'motd' && JSON.stringify(s.tokens ?? []).includes('changed')) ? 'changed' : 'ok'),
      },
    },
    {
      id: 'run',
      label: bi('Который раз запускается плейбук', 'Which run of the playbook this is'),
      kind: 'range',
      min: 1,
      max: 3,
      step: 1,
      default: 1,
      near: 'ctl',
      group: bi('Как запускают плейбук', 'How the playbook is run'),
      predict: {
        prompt: bi('Вы запускаете тот же плейбук ещё раз, ничего в нём и на хостах не меняя. Сколько задач ответят changed?', 'You run the same playbook again, changing nothing in it or on the hosts. How many tasks will answer changed?'),
        options: [
          { id: 'zero', text: bi('Ни одной, потому что хосты уже настроены и модулям нечего менять', 'None, because the hosts are already configured and the modules have nothing to change') },
          { id: 'some', text: bi('Меньше, чем в первый раз, но не ноль, потому что одна задача снова что-то меняет', 'Fewer than the first time, but not zero, because one task changes something again') },
          { id: 'same', text: bi('Столько же, сколько в первый раз', 'As many as the first time') },
        ],
        resolve: (_p, n) => {
          const c = last(n).changed ?? 0;
          return c === 0 ? 'zero' : n.some((s) => s.id === 'apt' && JSON.stringify(s.tokens ?? []).includes('changed')) ? 'same' : 'some';
        },
      },
    },
  ],
  breaks: [
    {
      id: 'no-python',
      label: bi('На хосте web3 нет python3', 'Host web3 has no python3'),
      remove: ['e3'],
      boundary: 'process',
      predict: {
        prompt: bi('На хосте web3 нет python3, без которого модули Ansible не запускаются. Что будет с прогоном?', 'Host web3 has no python3, without which Ansible modules do not run. What happens to the run?'),
        options: [
          { id: 'one', text: bi('Ansible исключит web3 из дальнейшего выполнения плейбука, а web1 и web2 настроит до конца', 'Host web3 leaves the play, and Ansible configures web1 and web2 to the end') },
          { id: 'all', text: bi('Ansible остановит весь прогон на всех хостах', 'Ansible stops the whole run on every host') },
        ],
        resolve: () => 'one',
      },
    },
    {
      id: 'task-fails',
      label: bi('На хосте web2 nginx не запускается, потому что порт 80 занят', 'On web2 nginx does not start: port 80 is taken'),
      remove: ['e2'],
      boundary: 'process',
      predict: {
        prompt: bi('Задача «nginx is running» на хосте web2 завершается с ошибкой, потому что порт 80 там занят другой программой. Перезагрузит ли Ansible nginx на web2 в конце сценария?', 'The task “nginx is running” fails on web2, because another program holds port 80 there. Will Ansible reload nginx on web2 at the end of the play?'),
        options: [
          { id: 'no', text: bi('Нет, хост, на котором задача завершилась с ошибкой, Ansible исключает из дальнейшего выполнения, и до обработчиков дело не доходит', 'No, a host with a failed task leaves the play and does not reach the handlers') },
          { id: 'yes', text: bi('Да, обработчик уже стоит в очереди и выполнится на всех хостах', 'Yes, the handler is already queued and runs on every host') },
        ],
        resolve: () => 'no',
      },
    },
  ],
  metrics: [
    { id: 'changed', label: bi('задач ответили changed', 'tasks answered changed') },
    { id: 'failed', label: bi('хостов исключено из выполнения', 'hosts dropped out') },
    { id: 'handlers', label: bi('перезагрузок nginx', 'nginx reloads') },
  ],
  run(p, broken) {
    const n = ansNumbers(p, broken);
    const noPy = broken.has('no-python');
    const fail2 = broken.has('task-fails');
    const first = p.run === 1;
    const live = HOSTS.filter((h) => !(noPy && h === 'h3'));
    const alive = live.filter((h) => !(fail2 && h === 'h2'));
    const each = (hs: readonly string[], label: string) => hs.map((h) => ({ edge: edgeOf(h), label }));
    const st = (hs: readonly string[], s: ElementState) => Object.fromEntries(hs.map((h) => [h, s]));
    const motdLines = p.task === 'shell' ? p.run : 1;
    const steps: Step[] = [
      {
        id: 'inv',
        label: bi('инвентарь', 'inventory'),
        caption: bi('ansible-playbook читает инвентарь. Сценарий плейбука начинается строкой `hosts: web`, поэтому настраивать предстоит три хоста группы web: web1, web2 и web3.', 'ansible-playbook reads the inventory. The play starts with `hosts: web`, so three hosts of the web group are to be configured: web1, web2 and web3.'),
        focus: ['e-inv', 'ctl'],
        tokens: [{ edge: 'e-inv', label: 'web1, web2, web3' }],
        say: { ctl: bi('ansible-playbook находит в инвентаре группу web и в ней три хоста.', 'ansible-playbook finds the web group in the inventory, with three hosts in it.') },
        states: hiddenExcept(ANS_ALL, 'inv', 'ctl', 'e-inv'),
      },
      {
        id: 'facts',
        label: bi('факты', 'facts'),
        caption: bi('Перед первой задачей Ansible заходит на каждый хост по SSH и запускает там модуль setup. Модуль собирает факты о хосте: семейство системы, адреса, объём памяти, и эти факты потом можно использовать в условиях и шаблонах.', 'Before the first task Ansible logs in to every host over SSH and runs the setup module there. The module gathers facts about the host: the system family, the addresses, the amount of memory, and these facts can later be used in conditions and templates.'),
        focus: ['ctl', 'e1', 'e2', 'e3'],
        reveal: ['h1', 'h2', 'h3', 'e1', 'e2', 'e3'],
        tokens: each(HOSTS, 'setup'),
        say: { ctl: bi('Ansible отправляет на каждый хост модуль setup, чтобы узнать, что это за машина.', 'Ansible sends the setup module to every host to learn what kind of machine it is.') },
        states: st(HOSTS, 'on'),
      },
    ];
    if (noPy)
      steps.push({
        id: 'nopy',
        label: 'web3',
        caption: bi('На хосте web3 модуль setup не запускается, потому что там нет python3. Ansible отмечает хост как сбойный и исключает его из дальнейшего выполнения плейбука, а на web1 и web2 продолжает работу.', 'On web3 the setup module does not start, because there is no python3. Ansible marks the host as failed and drops it from the play, while it goes on with web1 and web2.'),
        focus: ['e3', 'h3'],
        tokens: [{ edge: 'e3', reverse: true, label: 'FAILED' }],
        say: { h3: bi('На web3 нет программы python3, поэтому модуль, который прислал Ansible, здесь запустить нечем.', 'web3 has no python3 program, so there is nothing to run the module Ansible sent.') },
        states: { h3: 'err', e3: 'err' },
        broken: { at: 'h3', message: 'fatal: [web3]: FAILED! => {"changed": false, "module_stderr": "/bin/sh: 1: /usr/bin/python3: not found\\n", "msg": "The module failed to execute correctly, you probably need to set the interpreter."}', caption: bi('Ansible не ставит на хосты постоянную программу, но модули пишет на Python, поэтому без python3 на хосте работает только модуль raw. Такую ошибку узнают по строке «/usr/bin/python3: not found».', 'Ansible installs no permanent program on the hosts, but its modules are written in Python, so without python3 only the raw module works. You recognise this error by the line “/usr/bin/python3: not found”.') },
      });
    steps.push({
      id: 'apt',
      label: 'apt',
      caption: first
        ? bi('Задача «nginx is installed» отправляет на хосты модуль apt. Модуль видит, что пакета nginx нет, ставит его и отвечает changed.', 'The task “nginx is installed” sends the apt module to the hosts. The module sees that the nginx package is missing, installs it and answers changed.')
        : bi('Задача «nginx is installed» отправляет на хосты модуль apt. Модуль видит, что пакет nginx уже стоит, ничего не делает и отвечает ok.', 'The task “nginx is installed” sends the apt module to the hosts. The module sees that nginx is already installed, does nothing and answers ok.'),
      focus: ['ctl', ...live.map(edgeOf)],
      tokens: each(live, first ? 'changed' : 'ok'),
      say: { ctl: first ? bi('Модуль apt на каждом хосте не находит пакета nginx и устанавливает его.', 'On every host the apt module finds no nginx package and installs it.') : bi('Модуль apt на каждом хосте находит пакет nginx и ничего не трогает.', 'On every host the apt module finds the nginx package and touches nothing.') },
      states: st(live, first ? 'warn' : 'ok'),
      values: Object.fromEntries(live.map((h) => [h, 'nginx 1.26'])),
    });
    steps.push({
      id: 'template',
      label: 'template',
      caption: first
        ? bi('Задача «The site config is in place» собирает файл конфигурации nginx из шаблона и сравнивает его с файлом на хосте. Файла ещё нет, поэтому модуль template записывает его и отвечает changed.', 'The task “The site config is in place” renders the nginx config from a template and compares it with the file on the host. There is no file yet, so the template module writes it and answers changed.')
        : bi('Задача «The site config is in place» собирает файл конфигурации из шаблона и видит, что на хосте лежит точно такой же. Модуль template ничего не записывает и отвечает ok.', 'The task “The site config is in place” renders the config from the template and sees that the host already has the very same file. The template module writes nothing and answers ok.'),
      focus: ['ctl', ...live.map(edgeOf)],
      tokens: each(live, first ? 'changed' : 'ok'),
      say: { ctl: first ? bi('Модуль template записывает на каждый хост файл cafe.conf, потому что его там ещё нет.', 'The template module writes cafe.conf to every host, because it is not there yet.') : bi('Модуль template сравнивает готовый файл с тем, что лежит на хосте, и не находит разницы.', 'The template module compares the rendered file with the one on the host and finds no difference.') },
      states: st(live, first ? 'warn' : 'ok'),
      values: Object.fromEntries(live.map((h) => [h, 'cafe.conf'])),
    });
    if (first)
      steps.push({
        id: 'notify',
        label: 'notify',
        caption: bi('Задача с шаблоном ответила changed и в строке notify называет обработчик «Reload nginx». Ansible ставит обработчик в очередь, но пока не выполняет, потому что обработчики срабатывают один раз в конце сценария.', 'The template task answered changed, and its notify line names the handler “Reload nginx”. Ansible queues it but does not run it yet, because the handler fires once at the end of the play.'),
        focus: ['e-notify', 'hq'],
        reveal: ['hq', 'e-notify'],
        tokens: [{ edge: 'e-notify', label: 'Reload nginx' }],
        say: { hq: fb(bi('В очередь встаёт обработчик «Reload nginx» для хостов {h}, где конфигурация изменилась.', 'The handler “Reload nginx” is queued for {h}, where the config changed.'), { h: live.map((h) => HOST_NAME[h]).join(', ') }) },
        fill: { hq: live.length / 3 },
        values: { hq: `Reload nginx × ${live.length}` },
      });
    const motdChanged = first || p.task === 'shell';
    steps.push({
      id: 'motd',
      label: p.task === 'shell' ? 'shell' : 'lineinfile',
      caption:
        p.task === 'shell'
          ? fb(bi('Задача shell выполняет команду `echo "Managed by Ansible" >> /etc/motd`. Команда не знает, каким должен быть файл, она лишь дописывает строку в конец, поэтому задача на каждом прогоне отвечает changed. После прогона номер {r} строка «Managed by Ansible» записана в файле {n}.', 'The shell task runs `echo "Managed by Ansible" >> /etc/motd`. The command does not know what the file should be like, it only appends a line, so the task answers changed on every run. After run {r} the line “Managed by Ansible” is in the file {e}.'), { r: p.run, n: p.run === 1 ? 'один раз' : `${p.run} ${pluralRu(p.run, ['раз', 'раза', 'раз'])}`, e: p.run === 1 ? 'once' : `${p.run} times` })
          : first
            ? bi('Задача lineinfile проверяет, есть ли в /etc/motd строка «Managed by Ansible». Строки нет, поэтому модуль добавляет её и отвечает changed.', 'The lineinfile task checks whether /etc/motd has the line “Managed by Ansible”. It does not, so the module adds it and answers changed.')
            : bi('Задача lineinfile находит строку «Managed by Ansible» в /etc/motd и ничего не меняет. Повторный прогон не изменил этот файл, и это свойство задачи называется идемпотентностью.', 'The lineinfile task finds the line “Managed by Ansible” in /etc/motd and changes nothing. The repeated run left the file alone, and this property of a task is called idempotence.'),
      focus: ['ctl', ...live.map(edgeOf)],
      tokens: each(live, motdChanged ? 'changed' : 'ok'),
      say: { ctl: p.task === 'shell' ? bi('Модуль shell выполняет команду echo и дописывает в /etc/motd ещё одну строку, не проверяя, есть ли она уже.', 'The shell module runs echo and appends one more line to /etc/motd without checking whether it is already there.') : motdChanged ? bi('Модуль lineinfile не находит нужной строки в /etc/motd и добавляет её.', 'The lineinfile module does not find the line in /etc/motd and adds it.') : bi('Модуль lineinfile находит нужную строку в /etc/motd и оставляет файл как есть.', 'The lineinfile module finds the line in /etc/motd and leaves the file as it is.') },
      states: st(live, motdChanged ? 'warn' : 'ok'),
      values: Object.fromEntries(live.map((h) => [h, t(fb(bi('строк в /etc/motd: {n}', 'lines in /etc/motd: {n}'), { n: motdLines }))])),
    });
    steps.push({
      id: 'service',
      label: 'service',
      caption: fail2
        ? bi('Задача «nginx is running» проверяет, что служба nginx запущена. На web1 и web3 она работает, а на web2 не запускается, потому что порт 80 там занят другой программой. Ansible исключает web2 из дальнейшего выполнения плейбука.', 'The task “nginx is running” checks that the nginx service is running. On web1 and web3 it runs, but on web2 it does not start, because another program holds port 80 there. Ansible drops web2 from the play.')
        : bi('Задача «nginx is running» проверяет, что служба nginx запущена. Она уже работает, поэтому модуль service ничего не делает и отвечает ok.', 'The task “nginx is running” checks that the nginx service is running. It already is, so the service module does nothing and answers ok.'),
      focus: fail2 ? ['e2', 'h2'] : ['ctl', ...live.map(edgeOf)],
      tokens: live.map((h) => ({ edge: edgeOf(h), label: fail2 && h === 'h2' ? 'FAILED' : 'ok' })),
      say: fail2 ? { h2: bi('На web2 служба nginx не запускается, потому что порт 80 уже занят, и задача завершается с ошибкой.', 'On web2 the nginx service does not start, because port 80 is taken, and the task fails.') } : { ctl: bi('Модуль service на каждом хосте видит, что nginx работает, и ничего не трогает.', 'On every host the service module sees that nginx is running and touches nothing.') },
      states: { ...st(alive, 'ok'), ...(fail2 ? { h2: 'err' as ElementState, e2: 'err' as ElementState } : {}) },
      ...(fail2
        ? { broken: { at: 'h2', message: 'fatal: [web2]: FAILED! => {"changed": false, "msg": "Unable to start service nginx: Job for nginx.service failed because the control process exited with error code."}', caption: bi('Хост, на котором задача завершилась с ошибкой, Ansible исключает из дальнейшего выполнения плейбука, и обработчики на нём не выполняются, хотя конфигурация уже изменилась. Ключ --force-handlers заставляет Ansible выполнить уведомлённые обработчики и на таком хосте.', 'A host where a task failed leaves the play, and handlers do not run on it, although its config already changed. The --force-handlers key makes Ansible run notified handlers on such a host too.') } }
        : {}),
    });
    steps.push(
      n.handlers > 0
        ? {
            id: 'handler',
            label: 'handler',
            caption: fb(bi('В конце сценария Ansible выполняет обработчик «Reload nginx» по одному разу на каждом хосте, где конфигурация изменилась и задачи прошли: на {h}. nginx перечитывает новую конфигурацию.{x}', 'At the end of the play Ansible runs the handler “Reload nginx” once on every host whose config changed and whose tasks passed: on {h}. nginx rereads the new config.{x}'), { h: alive.map((h) => HOST_NAME[h]).join(', '), x: fail2 ? bi(' На web2 nginx новую конфигурацию не получит, потому что Ansible исключил этот хост из выполнения раньше.', ' On web2 nginx does not get the new config, because the host left the play earlier.') : '' }),
            focus: ['hq', ...alive.map(edgeOf)],
            reveal: ['hq', 'e-notify'],
            tokens: each(alive, 'reload'),
            say: { hq: fb(bi('Ansible выполняет обработчик «Reload nginx» {n}, по одному разу на каждом хосте, и очередь пустеет.', 'Ansible runs the handler “Reload nginx” {e}, once on every host, and the queue empties.'), { n: TIMES_RU[n.handlers] ?? String(n.handlers), e: TIMES_EN[n.handlers] ?? String(n.handlers) }) },
            fill: { hq: 0 },
            values: { hq: `${n.handlers} × Reload nginx` },
          }
        : {
            id: 'handler',
            label: bi('без обработчика', 'no handler'),
            caption: bi('Ни одна задача не уведомила обработчик, потому что конфигурация nginx не менялась. Поэтому nginx не перезагружается без нужды.', 'No task notified the handler, because the nginx config did not change. So nginx is not reloaded for nothing.'),
            focus: ['hq'],
            reveal: ['hq', 'e-notify'],
            say: { hq: bi('Очередь обработчиков пуста, потому что уведомлений не было, и перезагружать nginx не нужно.', 'The handler queue is empty: there were no notifications, and nginx need not be reloaded.') },
            fill: { hq: 0 },
            values: { hq: '0 × Reload nginx' },
          },
    );
    steps.push({
      id: 'recap',
      label: 'RECAP',
      caption:
        n.changed === 0
          ? fb(bi('PLAY RECAP показывает changed={c} и failed={f}. Повторный прогон ничего не изменил, значит, плейбук описывает состояние хостов, а не действия, и его можно запускать сколько угодно раз.', 'PLAY RECAP shows changed={c} and failed={f}. The repeated run changed nothing, so the playbook describes the state of the hosts rather than actions, and it can be run any number of times.'), { c: n.changed, f: n.failed })
          : first && n.failed
            ? fb(bi('PLAY RECAP показывает changed={c} и failed={f}. Изменения на первом прогоне ожидаемы, ведь хосты были пустыми, а failed={f} означает, что Ansible исключил из прогона хост с поломкой. Без поломок первый прогон дал бы failed=0.', 'PLAY RECAP shows changed={c} and failed={f}. Changes on the first run are expected, since the hosts were empty, while failed={f} means Ansible dropped the broken host from the run. Without breaks the first run would give failed=0.'), { c: n.changed, f: n.failed })
          : first
            ? fb(bi('PLAY RECAP показывает changed={c} и failed={f}. На первом прогоне так и должно быть, ведь хосты были пустыми. Настоящей проверкой плейбука служит второй прогон, на котором changed должно стать нулём.', 'PLAY RECAP shows changed={c} and failed={f}. On the first run that is as it should be: the hosts were empty. The real test of a playbook is the second run, where changed must drop to zero.'), { c: n.changed, f: n.failed })
            : fb(bi('PLAY RECAP показывает changed={c} и failed={f}. Повторный прогон снова что-то изменил, значит, одна из задач описывает действие, а не состояние, и её нужно переписать.', 'PLAY RECAP shows changed={c} and failed={f}. The repeated run changed something again, so one of the tasks describes an action rather than a state and must be rewritten.'), { c: n.changed, f: n.failed }),
      focus: ['ctl'],
      say: { ctl: fb(bi('ansible-playbook подводит итог прогона и печатает для каждого хоста, сколько задач ответили ok, changed и failed.', 'ansible-playbook sums up the run and prints for every host how many tasks answered ok, changed and failed.'), { c: n.changed, f: n.failed }) },
      states: { ctl: n.failed ? 'warn' : 'ok' },
      metrics: { changed: n.changed, failed: n.failed, handlers: n.handlers },
    });
    return steps;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (change.id === 'no-python') return change.on ? bi('Без python3 модули на web3 не запускаются, поэтому Ansible исключает этот хост из дальнейшего выполнения плейбука, а остальные хосты настраивает до конца.', 'Without python3 the modules cannot run on web3, so this host leaves the play, and Ansible configures the others to the end.') : bi('На web3 снова есть python3, и этот хост проходит весь плейбук вместе с остальными.', 'web3 has python3 again and goes through the play with the other hosts.');
      return change.on ? bi('Задача на web2 завершилась с ошибкой, и Ansible исключил хост из дальнейшего выполнения, поэтому до обработчиков дело не дошло и nginx на нём не перезагружается.', 'web2 leaves the play at the failed task and does not reach the handlers, so nginx is not reloaded there.') : bi('На web2 порт 80 освободился, и хост снова проходит весь плейбук до конца.', 'Port 80 on web2 is free again, and the host goes through the play to the end.');
    }
    const c0 = last(prev).changed ?? 0;
    const c1 = last(next).changed ?? 0;
    const count =
      c0 === c1
        ? fb(bi('Число ответов changed осталось прежним и равно {a}.', 'The number of changed answers stayed the same: {a}.'), { a: c0 })
        : fb(bi('Число ответов changed изменилось с {a} на {b}.', 'The number of changed answers went from {a} to {b}.'), { a: c0, b: c1 });
    const say = (msg: Bi) => fb(msg, { n: count });
    if (change.id === 'task') return b.task === 'shell' ? say(bi('Задача shell выполняет действие, а не описывает состояние, поэтому она отвечает changed на каждом прогоне. {n}', 'The shell task performs an action instead of describing a state, so it answers changed on every run. {n}')) : say(bi('Модуль lineinfile сначала проверяет, есть ли строка, и меняет файл, только если её нет. {n}', 'The lineinfile module first checks whether the line exists and changes the file only if it does not. {n}'));
    return count;
  },
});
