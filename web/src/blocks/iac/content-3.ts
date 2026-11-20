// The third part of the IaC block (design 00 §6.13): the same skills on real
// machines in the tab. The cloud at api.cloud.lab is a REST API with access
// keys, asynchronous operations and honest errors; creating a VM boots a real
// v86 machine. Lessons: the API with curl; OpenTofu with the provider `lab`;
// state in object storage, drift and import; a module for several machines;
// push to git.lab → CI → tofu apply. Then the in-tab exam. Ansible is not in
// the lab image (no Python in it yet), so the configuration of the machines
// here is user data and SSH.
//
// Checks read the cloud's own state (cloud.*, s3.*, git.*, ci.*), the
// workstation's files and, where a lesson needs it, the facts of the VMs
// (vms['web-1'].listen) — never the typed text.

import { bi } from '../../core/i18n';
import type { Concept, Exam, Facts, Lesson, QuizItem, Task } from '../../core/types';
import { src, S } from './content';
import type { CloudLabProps } from './cloudlab/widget';
import type { CloudLabFacts, TfStateFacts } from './cloudlab/facts';

const W = {
  restApi: { title: 'MDN — An overview of HTTP', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview' },
  httpStatus: { title: 'MDN — HTTP response status codes', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status' },
  googleLro: { title: 'Google AIP-151 — Long-running operations', url: 'https://google.aip.dev/151' },
  curl: { title: 'curl — The man page', url: 'https://curl.se/docs/manpage.html' },
  tofuInit: { title: 'OpenTofu — Command: init', url: 'https://opentofu.org/docs/cli/commands/init/' },
  tofuLock: { title: 'OpenTofu — Dependency lock file', url: 'https://opentofu.org/docs/language/files/dependency-lock/' },
  tofuMirror: { title: 'OpenTofu — Provider installation (CLI configuration)', url: 'https://opentofu.org/docs/cli/config/config-file/#provider-installation' },
  tofuOutput: { title: 'OpenTofu — Output values', url: 'https://opentofu.org/docs/language/values/outputs/' },
  tofuS3: { title: 'OpenTofu — Backend type: s3', url: 'https://opentofu.org/docs/language/settings/backends/s3/' },
  tofuBackend: { title: 'OpenTofu — Backend configuration', url: 'https://opentofu.org/docs/language/settings/backends/configuration/' },
  tofuImport: { title: 'OpenTofu — Import', url: 'https://opentofu.org/docs/language/import/' },
  tofuForEach: { title: 'OpenTofu — The for_each meta-argument', url: 'https://opentofu.org/docs/language/meta-arguments/for_each/' },
  tofuModules: { title: 'OpenTofu — Modules', url: 'https://opentofu.org/docs/language/modules/' },
  tofuAutomation: { title: 'HashiCorp — Running Terraform in automation', url: 'https://developer.hashicorp.com/terraform/tutorials/automation/automate-terraform' },
  gitlabTf: { title: 'GitLab — Infrastructure as Code with OpenTofu and GitLab', url: 'https://docs.gitlab.com/user/infrastructure/iac/' },
  gitlabShell: { title: 'GitLab Runner — The Shell executor', url: 'https://docs.gitlab.com/runner/executors/shell/' },
  gitlabArtifacts: { title: 'GitLab — Job artifacts', url: 'https://docs.gitlab.com/ci/jobs/job_artifacts/' },
  ruYcApi: { title: 'Yandex Cloud — Концепции API: операции', url: 'https://yandex.cloud/ru/docs/api-design-guide/concepts/operation' },
  ruYcAuth: { title: 'Yandex Cloud — Аутентификация в API', url: 'https://yandex.cloud/ru/docs/api-design-guide/concepts/authentication' },
  ruMdnStatus: { title: 'MDN — Коды ответа HTTP', url: 'https://developer.mozilla.org/ru/docs/Web/HTTP/Status' },
  ruYcState: { title: 'Yandex Cloud — Загрузка состояний Terraform в Object Storage', url: 'https://yandex.cloud/ru/docs/tutorials/infrastructure-management/terraform-state-storage' },
  ruYcQuick: { title: 'Yandex Cloud — Начало работы с Terraform', url: 'https://yandex.cloud/ru/docs/terraform/quickstart' },
  ruYcModules: { title: 'Yandex Cloud — Модули Terraform', url: 'https://yandex.cloud/ru/docs/terraform/tutorials/terraform-modules' },
  ruYcImport: { title: 'Yandex Cloud — Импорт ресурсов в Terraform', url: 'https://yandex.cloud/ru/docs/tutorials/infrastructure-management/terraform-import' },
  ruGitlabCi: { title: 'Хабр — GitLab CI для Terraform: plan в merge request, apply по кнопке', url: 'https://habr.com/ru/companies/otus/articles/767264/' },
};

export const concepts3: Concept[] = [
  {
    id: 'iac.cloud-api',
    term: bi('API облака', 'cloud API'),
    scan: false,
    short: bi('HTTP-интерфейс, через который облако создаёт, меняет и удаляет ресурсы. Веб-консоль, утилита командной строки и Terraform обращаются к одним и тем же адресам этого интерфейса.', 'The HTTP interface through which a cloud creates, changes and deletes resources: the console, the CLI and Terraform all call the same endpoints.'),
    introducedIn: 'iac.cloud-api',
  },
  {
    id: 'iac.access-key',
    term: bi('ключ доступа', 'access key'),
    forms: { ru: ['ключа доступа', 'ключом доступа', 'ключи доступа', 'ключей доступа'], en: ['access keys'] },
    short: bi('Пара «идентификатор и секрет», по которой облако узнаёт программу и проверяет её права в проекте. Секрет показывают один раз.', 'A pair of an identifier and a secret by which a cloud recognises a program and checks its rights in a project. The secret is shown once.'),
    introducedIn: 'iac.cloud-api',
  },
  {
    id: 'iac.operation',
    term: bi('асинхронная операция', 'long-running operation'),
    forms: { ru: ['асинхронной операции', 'асинхронную операцию', 'асинхронные операции', 'асинхронных операций'], en: ['long-running operations'] },
    short: bi('Так облако отвечает на медленный запрос: оно сразу возвращает код 202 Accepted и объект операции, у которого клиент потом спрашивает статус, пока тот не станет DONE или ERROR.', 'A cloud’s answer to a slow request: 202 Accepted and an operation object whose status you then ask for until it becomes DONE or ERROR.'),
    introducedIn: 'iac.cloud-api',
  },
  {
    id: 'iac.lock-file',
    term: bi('файл блокировки провайдеров', 'dependency lock file'),
    forms: { ru: ['файла блокировки провайдеров', 'файлом блокировки провайдеров'] },
    short: bi('Файл .terraform.lock.hcl, в котором init записывает выбранные версии провайдеров и их контрольные суммы. Его сохраняют в репозитории вместе с кодом, чтобы у всех коллег и в CI стояли одни и те же провайдеры.', '.terraform.lock.hcl: which provider versions init chose and their checksums. It is committed so that everyone and CI get the same providers.'),
    introducedIn: 'iac.tofu-lab',
  },
  {
    id: 'iac.replace',
    term: bi('пересоздание ресурса', 'resource replacement'),
    forms: { ru: ['пересоздания ресурса', 'пересоздание', 'пересоздания'], en: ['replacement'] },
    scan: false,
    short: bi('Так называют действие, которое план отмечает знаком -/+. Некоторые аргументы нельзя поменять у работающего ресурса, и если меняется такой аргумент, старый ресурс удаляется, а вместо него создаётся новый с новым ID. Для ВМ это означает новую машину.', '-/+ in a plan: the argument cannot be changed on a live resource, so the old one is destroyed and a new one with a new ID is created. For a VM that is a new machine.'),
    introducedIn: 'iac.tofu-lab',
  },
  {
    id: 'iac.remote-state',
    term: bi('удалённый state', 'remote state'),
    forms: { ru: ['удалённого state', 'удалённом state', 'удалённым state'] },
    short: bi('State, который хранится не в каталоге одного человека, а в общем месте, например в бакете объектного хранилища. Такое хранение настраивают блоком backend.', 'State kept not in one person’s directory but in a shared place, such as a bucket in object storage. It is configured with a backend block.'),
    introducedIn: 'iac.remote-state',
  },
  {
    id: 'iac.state-lock',
    term: bi('блокировка state', 'state locking'),
    forms: { ru: ['блокировки state', 'блокировку state'], en: ['state lock'] },
    short: bi('Пока работает plan или apply, state заблокирован. Второй запуск в это время ждёт или останавливается с ошибкой и поэтому не может испортить то, что записывает первый.', 'While a plan or apply runs, the state is locked: a second run waits or fails with an error and cannot corrupt the first one’s write.'),
    introducedIn: 'iac.remote-state',
  },
  {
    id: 'iac.for-each',
    term: bi('for_each', 'for_each'),
    scan: false,
    short: bi('Мета-аргумент, с которым один блок resource или module создаёт по экземпляру на каждый ключ множества или словаря. Экземпляры получают адреса вида module.web["a"].', 'A meta-argument: one resource or module block creates an instance per key of a set or map, with addresses like module.web["a"].'),
    introducedIn: 'iac.modules-lab',
  },
  {
    id: 'iac.saved-plan',
    term: bi('сохранённый план', 'saved plan'),
    forms: { ru: ['сохранённого плана', 'сохранённым планом', 'сохранённый план'], en: ['saved plans'] },
    short: bi('Файл, который записывает команда tofu plan -out. Если применить этот файл, apply выполнит те изменения, которые были показаны, и никакие другие, а если state за это время изменился, apply откажется работать.', 'The file from tofu plan -out: applying it carries out exactly the changes shown, or apply refuses if the state changed meanwhile.'),
    introducedIn: 'iac.ci-apply',
  },
];

// ── facts helpers ──

type LabF = Facts & Partial<CloudLabFacts> & { vms?: Record<string, Facts> };
const lf = (f: Facts | undefined) => (f ?? {}) as LabF;
const vm = (f: Facts | undefined, name: string) => lf(f).cloud?.vms.find((v) => v.name === name);
const stateAt = (f: Facts | undefined, key: string): TfStateFacts | undefined => lf(f).s3?.states.find((s) => s.bucket === 'tfstate' && s.key === key);
const addrs = (s: TfStateFacts | undefined) => (s?.resources ?? []).filter((r) => r.mode === 'managed').map((r) => r.address);
const lastOut = (f: Facts) => f.term?.main?.at(-1)?.out ?? '';
const lastExit = (f: Facts) => f.term?.main?.at(-1)?.exit;
const listens = (f: Facts, name: string, port: number) => ((lf(f).vms?.[name] as { listen?: { port: number }[] } | undefined)?.listen ?? []).some((l) => l.port === port);
const wsReq = (f: Facts, pred: (r: { method: string; path: string; status: number }) => boolean) => (lf(f).cloud?.requests ?? []).some((r) => r.from === WS && pred(r));

const WS = '10.0.0.10';
const INFRA = '/root/infra';
const ENV_NOTE = bi(
  'Пока под терминалом написано «Лаборатория готовит облако и рабочую станцию», терминал не принимает команды. За это время лаборатория записывает в файл `/etc/dt/cloud.env` переменные `LAB_TOKEN` с секретом ключа доступа проекта default, `AWS_ACCESS_KEY_ID` и `AWS_SECRET_ACCESS_KEY`, а потом сама загружает этот файл в оболочку терминала, поэтому после сообщений о загрузке в терминале появится команда `. /etc/dt/cloud.env`. После этого все переменные показывает команда `env | grep -E "LAB|AWS"`. Если `echo $LAB_TOKEN` печатает пустую строку, например в новой оболочке, выполните `. /etc/dt/cloud.env` сами. Испортить здесь ничего нельзя, потому что после перезагрузки страницы облако и машины запускаются заново.',
  'While the line under the terminal says “The lab is preparing the cloud and the workstation”, the terminal takes no commands. In that time the lab writes the variables `LAB_TOKEN` with the secret of project default’s access key, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` into `/etc/dt/cloud.env`, then loads the file into the terminal’s shell itself, so after the boot messages the terminal shows the command `. /etc/dt/cloud.env`. After that `env | grep -E "LAB|AWS"` shows all the variables. If `echo $LAB_TOKEN` prints an empty line, for example in a new shell, run `. /etc/dt/cloud.env` yourself. You cannot spoil anything here: after a page reload the cloud and the machines start over.',
);

const TF_PROVIDER = `terraform {
  required_providers {
    lab = { source = "lab/lab", version = "~> 0.1" }
  }
}

provider "lab" {}
`;

const USER_DATA = `<<-EOT
    #!/bin/sh
    cat > /etc/nginx/http.d/default.conf <<'EOF'
    server {
      listen 80 default_server;
      root /var/www/site;
    }
    EOF
    mkdir -p /var/www/site
    echo "hello from $(hostname)" > /var/www/site/index.html
    rc-service nginx start
  EOT`;

const TF_WEB = `${TF_PROVIDER}
variable "ssh_public_key" {
  type        = string
  description = "The public key that may log in as root"
}

resource "lab_vm" "web" {
  name                = "web-1"
  flavor              = "lab.small"
  image               = "lab-node"
  ssh_authorized_keys = [var.ssh_public_key]
  labels              = { team = "cafe" }
}
`;

const write = (path: string, text: string) => `mkdir -p ${path.replace(/\/[^/]+$/, '')} && cat > ${path} <<'DT_EOF'\n${text}DT_EOF`;
const KEYGEN = '[ -f /root/.ssh/id_ed25519 ] || ssh-keygen -q -t ed25519 -N "" -f /root/.ssh/id_ed25519';
const TFVARS = `printf 'ssh_public_key = "%s"\\n' "$(cat /root/.ssh/id_ed25519.pub)" > ${INFRA}/terraform.tfvars`;

const cloudLab = (props: CloudLabProps) => ({ kind: 'widget' as const, id: 'lab', step: 'practice' as const, widget: 'iac.cloudlab', props });

// ── lesson 1: the cloud is an API ──

const apiTasks: Task[] = [
  {
    id: 'public',
    prompt: bi('Отправьте запрос `GET http://api.cloud.lab/v1`, и облако расскажет о себе. Затем получите каталог размеров ВМ по адресу `/v1/flavors`. Оба адреса открыты без ключа доступа.', 'Ask the cloud who it is: `GET http://api.cloud.lab/v1`. Then get the catalogue of VM sizes, `/v1/flavors`. Both endpoints are open without a key.'),
    check: { when: (f) => wsReq(f, (r) => r.method === 'GET' && /^\/v1\/flavors/.test(r.path) && r.status === 200) },
    chips: 'curl -s http://api.cloud.lab/v1/flavors | jq',
    concepts: ['iac.cloud-api'],
    hints: { H1: bi('Команда curl без дополнительных ключей отправляет запрос GET, а `jq` печатает JSON в удобном для чтения виде.', 'curl without options does a GET; `jq` pretty-prints JSON.') },
  },
  {
    id: 'auth',
    prompt: bi('Запросите `/v1/whoami` сначала без заголовка авторизации и посмотрите, что и с каким кодом ответит облако. Потом повторите запрос с заголовком `Authorization: Bearer $LAB_TOKEN`.', 'Request `/v1/whoami` first without the authorization header, and see what the cloud answers and with which code; then with the header `Authorization: Bearer $LAB_TOKEN`.'),
    check: {
      when: (f) => wsReq(f, (r) => /whoami/.test(r.path) && r.status === 401) && wsReq(f, (r) => /whoami/.test(r.path) && r.status === 200),
      fail: [{ if: (f) => wsReq(f, (r) => /whoami/.test(r.path) && r.status === 401) && /missing header/.test(lastOut(f)) && /Bearer/.test(f.term?.main?.at(-1)?.line ?? ''), say: bi('Облако не увидело секрета в заголовке, хотя заголовок в команде есть. Скорее всего, переменная `LAB_TOKEN` в этой оболочке пуста: проверьте это командой `echo $LAB_TOKEN` и, если строка пустая, выполните `. /etc/dt/cloud.env`.', 'The cloud saw no secret in the header, although the command has the header. Most likely `LAB_TOKEN` is empty in this shell: check with `echo $LAB_TOKEN` and, if the line is empty, run `. /etc/dt/cloud.env`.') }, { if: (f) => wsReq(f, (r) => /whoami/.test(r.path) && r.status === 200) && !wsReq(f, (r) => r.status === 401), say: bi('С ключом запрос прошёл. Теперь отправьте тот же запрос без заголовка, чтобы увидеть, как облако отказывает.', 'With the key it worked. Send the same request without the header: the point is to see how the cloud refuses.') }],
    },
    chips: 'curl -si http://api.cloud.lab/v1/whoami',
    concepts: ['iac.access-key'],
    hints: { H1: bi('`-i` печатает строку статуса и заголовки ответа. Заголовок запроса задают ключом `-H`.', '`-i` prints the status line and the response headers. A request header is set with `-H`.'), H2: bi('```bash\ncurl -si http://api.cloud.lab/v1/whoami\ncurl -s -H "Authorization: Bearer $LAB_TOKEN" http://api.cloud.lab/v1/whoami | jq\n```', '```bash\ncurl -si http://api.cloud.lab/v1/whoami\ncurl -s -H "Authorization: Bearer $LAB_TOKEN" http://api.cloud.lab/v1/whoami | jq\n```') },
  },
  {
    id: 'key',
    prompt: bi('Создайте на рабочей станции ключ SSH `~/.ssh/id_ed25519` без пароля. Открытую часть этого ключа вы передадите новой ВМ.', 'Create an SSH key `~/.ssh/id_ed25519` without a passphrase on the workstation: you will hand its public part to the new VM.'),
    check: { when: "files['/root/.ssh/id_ed25519.pub'].type=f" },
    chips: 'ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519',
    hints: { H1: bi('Ключ создаёт команда `ssh-keygen -t ed25519`, а пустой пароль задаёт ключ `-N ""`.', '`ssh-keygen -t ed25519`, an empty passphrase is `-N ""`.') },
  },
  {
    id: 'create',
    prompt: bi(
      'Создайте ВМ `api-1` запросом `POST /v1/projects/default/vms`. В теле запроса в формате JSON передайте поля `name`, `flavor` со значением `lab.small`, `image` со значением `lab-node` и `ssh_authorized_keys` со списком из вашего открытого ключа. Облако ответит кодом `202` и объектом операции. Дождитесь конца операции запросом `GET /v1/operations/<id>?wait=30`. ВМ здесь настоящая машина, которая загружается в этой вкладке, поэтому операция занимает время.',
      'Create a VM `api-1`: `POST /v1/projects/default/vms` with a JSON body of `name`, `flavor` `lab.small`, `image` `lab-node` and `ssh_authorized_keys` with a list of your public key. The cloud answers `202` and an operation object. Wait for it to finish with `GET /v1/operations/<id>?wait=30`: the VM is a real machine booting in this tab.',
    ),
    check: {
      when: (f) => vm(f, 'api-1')?.status === 'RUNNING' && (vm(f, 'api-1')?.keys ?? 0) > 0 && wsReq(f, (r) => r.method === 'GET' && /^\/v1\/operations\/op-/.test(r.path) && r.status === 200),
      fail: [
        { if: (f) => wsReq(f, (r) => r.method === 'POST' && /\/vms/.test(r.path) && r.status === 400), say: bi('Облако ответило кодом 400. Поле `error.details.field` в теле ответа называет аргумент, который не подошёл.', 'The cloud answered 400: the field `error.details.field` in the response body names the argument that did not fit.') },
        { if: (f) => wsReq(f, (r) => r.method === 'POST' && /\/vms/.test(r.path) && r.status === 415), say: bi('В запросе не хватает заголовка `Content-Type: application/json`.', 'The `Content-Type: application/json` header is missing.') },
        { if: (f) => vm(f, 'api-1')?.status === 'RUNNING' && !vm(f, 'api-1')?.keys, say: bi('ВМ создана без ключа SSH, и зайти на неё не получится. Удалите её и создайте заново с полем `ssh_authorized_keys`.', 'The VM was created without an SSH key, so you will not be able to log in. Delete it and create it again with `ssh_authorized_keys`.') },
        { if: (f) => vm(f, 'api-1')?.status === 'RUNNING', say: bi('ВМ уже работает, но клиенту остаётся ещё один шаг. Спросите облако о статусе операции по её id.', 'The VM is already running, but the client has one more step to take. Ask the cloud for the operation’s status by its id.') },
      ],
    },
    concepts: ['iac.operation', 'iac.cloud-api'],
    hints: {
      H1: bi('Соберите запрос по шагам. Сначала напечатайте открытый ключ командой `cat ~/.ssh/id_ed25519.pub` и скопируйте строку, которая начинается с `ssh-ed25519`. Потом откройте файл тела запроса командой `edit body.json` и запишите в него `{"name": "api-1", "flavor": "lab.small", "image": "lab-node", "ssh_authorized_keys": ["ssh-ed25519 …"]}`, подставив свой ключ. Отправьте файл командой `curl -s -X POST -H "Authorization: Bearer $LAB_TOKEN" -H "Content-Type: application/json" -d @body.json http://api.cloud.lab/v1/projects/default/vms`. В ответе поле `id` содержит номер операции, и его нужно подставить в запрос `GET /v1/operations/<id>?wait=30`.', 'Build the request step by step. First print the public key with `cat ~/.ssh/id_ed25519.pub` and copy the line that starts with `ssh-ed25519`. Then open the request body file with `edit body.json` and write `{"name": "api-1", "flavor": "lab.small", "image": "lab-node", "ssh_authorized_keys": ["ssh-ed25519 …"]}` into it with your key. Send the file with `curl -s -X POST -H "Authorization: Bearer $LAB_TOKEN" -H "Content-Type: application/json" -d @body.json http://api.cloud.lab/v1/projects/default/vms`. The `id` field of the answer holds the operation id, which goes into the request `GET /v1/operations/<id>?wait=30`.'),
      H2: bi(
        'То же самое можно записать короче. Здесь команда `jq --arg` подставляет ключ в тело запроса, а конструкция `$( … )` подставляет вывод одной команды в другую:\n\n```bash\nBODY=$(jq -n --arg k "$(cat ~/.ssh/id_ed25519.pub)" \'{name:"api-1", flavor:"lab.small", image:"lab-node", ssh_authorized_keys:[$k]}\')\nOP=$(curl -s -X POST -H "Authorization: Bearer $LAB_TOKEN" -H "Content-Type: application/json" -d "$BODY" http://api.cloud.lab/v1/projects/default/vms | jq -r .id)\ncurl -s -H "Authorization: Bearer $LAB_TOKEN" "http://api.cloud.lab/v1/operations/$OP?wait=30" | jq .status\n```',
        'The same done shorter: `jq --arg` puts the key into the body, and `$( … )` puts the output of one command into another.\n\n```bash\nBODY=$(jq -n --arg k "$(cat ~/.ssh/id_ed25519.pub)" \'{name:"api-1", flavor:"lab.small", image:"lab-node", ssh_authorized_keys:[$k]}\')\nOP=$(curl -s -X POST -H "Authorization: Bearer $LAB_TOKEN" -H "Content-Type: application/json" -d "$BODY" http://api.cloud.lab/v1/projects/default/vms | jq -r .id)\ncurl -s -H "Authorization: Bearer $LAB_TOKEN" "http://api.cloud.lab/v1/operations/$OP?wait=30" | jq .status\n```',
      ),
    },
  },
  {
    id: 'ssh',
    prompt: bi('Зайдите на `api-1` по SSH и создайте там файл `/root/hello`. В DNS лаборатории у этой машины имя `api-1.vm.lab`. Так вы убедитесь, что `api-1` настоящая отдельная машина.', 'Log in to `api-1` over SSH and create a file `/root/hello` there. In the lab DNS this machine is called `api-1.vm.lab`. This way you make sure that `api-1` is a real separate machine.'),
    check: { when: "vms['api-1'].files['/root/hello'].type=f" },
    chips: 'ssh root@api-1.vm.lab',
    hints: { H1: bi('Команду можно выполнить на машине сразу при входе: `ssh root@api-1.vm.lab "touch /root/hello"`. При первом входе SSH спросит, доверять ли ключу хоста, и нужно ответить yes. Если вы вошли на машину, вернитесь на рабочую станцию командой `exit`.', 'You can run a command right away: `ssh root@api-1.vm.lab "touch /root/hello"`. On the first login SSH asks about the host key; answer yes. If you logged in to the machine, return to the workstation with `exit`.') },
  },
  {
    id: 'delete',
    prompt: bi('Удалите ВМ запросом `DELETE /v1/projects/default/vms/api-1`. Удаление тоже выполняется асинхронной операцией, поэтому дождитесь её конца.', 'Delete the VM: `DELETE /v1/projects/default/vms/api-1`. It is an operation too; wait for it.'),
    check: { when: (f) => !vm(f, 'api-1') && (lf(f).cloud?.ops ?? []).some((o) => o.kind === 'vm.delete' && o.target === 'api-1' && o.status === 'DONE') },
    chips: 'curl -s -X DELETE -H "Authorization: Bearer $LAB_TOKEN" http://api.cloud.lab/v1/projects/default/vms/api-1',
  },
];

const apiLesson: Lesson = {
  id: 'iac.cloud-api',
  block: 'iac',
  title: bi('Как устроен API облака', 'How a cloud API works'),
  summary: bi('Кнопки консоли, утилита командной строки и Terraform делают одно и то же: отправляют запросы HTTP в API облака. В этом уроке вы отправите такие запросы сами, с ключом доступа, ошибками и асинхронными операциями, и создадите настоящую машину.', 'Console buttons, the CLI and Terraform all do the same thing: send HTTP requests to the cloud API. Here you do it by hand, with an access key, errors and long-running operations, and create a real machine.'),
  introduces: ['iac.cloud-api', 'iac.access-key', 'iac.operation'],
  uses: ['iac.resource', 'iac.provider'],
  tier: 'core',
  minutes: 40,
  sources: src([W.restApi, W.httpStatus, W.googleLro, W.curl], [W.ruYcApi, W.ruYcAuth, W.ruMdnStatus]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы запустили `terraform apply`, а он через минуту остановился с сообщением `Error: creating VM: 409 AlreadyExists`. Чтобы понять, что произошло, нужно знать, к кому Terraform обращался и что ему ответили. В этом уроке вы обратитесь к облаку сами, без Terraform: отправите запросы к его API командой curl, получите отказы с разными кодами и создадите настоящую машину.',
        'You ran `terraform apply`, and a minute later it stopped with `Error: creating VM: 409 AlreadyExists`. To understand what happened, you need to know whom Terraform was talking to and what it was told. In this lesson you talk to the cloud yourself, without Terraform: you send requests to its API with curl, get refusals with different codes and create a real machine.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Провайдер Terraform не делает ничего таинственного. Он переводит блоки `resource` в запросы HTTP к [[iac.cloud-api|API облака]], и те же самые запросы отправляют кнопки веб-консоли и утилиты командной строки. Если понимать, как устроен этот обмен запросами и ответами, ошибки провайдера перестают быть загадкой, потому что за каждой из них стоит ответ API с кодом и сообщением.\n\nВ этом уроке облако работает в самой вкладке браузера, по адресу `api.cloud.lab`, и его API устроен так же, как у больших облаков. Ресурсы находятся по путям вида `/v1/projects/<проект>/vms`, а метод запроса говорит, что с ними сделать: `GET` читает ресурс, `POST` создаёт, `PATCH` меняет, а `DELETE` удаляет. Тела запросов и ответов записаны в формате JSON, то есть как пары «название поля и значение» в фигурных скобках: `{"name": "api-1"}`.\n\n### Как облако узнаёт, кто к нему обращается\n\nКаталог размеров и образов открыт всем, а всё, что принадлежит проекту, доступно только по [[iac.access-key|ключу доступа]]. Ключ состоит из двух частей, идентификатора и секрета. Секрет передают в заголовке `Authorization: Bearer <секрет>`. Облако показывает секрет один раз, при создании ключа, а потом хранит только его хеш, то есть отпечаток, по которому предъявленный секрет можно проверить, но восстановить сам секрет нельзя. Если заголовка нет, облако ответит `401 Unauthenticated`, а если ключ принадлежит чужому проекту, ответит `403 PermissionDenied`. Ошибки приходят в теле ответа в формате JSON, где есть код для программы и текст для человека:\n\n```json\n{"error": {"code": "InvalidArgument", "message": "unknown flavor lab.huge", "status": 400, "details": {"field": "flavor"}}}\n```\n\nПо коду программа решает, что делать дальше, и в этом уроке вам встретятся такие коды:\n\n- `200` и `202`: запрос принят, и в случае 202 работа ещё идёт, поэтому за результатом нужно следить по операции;\n- `400`: в запросе ошибка, и поле `details.field` называет аргумент, который нужно исправить;\n- `401`: облако не нашло ключа, поэтому проверьте заголовок `Authorization` и переменную `LAB_TOKEN`;\n- `403`: ключ принадлежит другому проекту, и нужен ключ этого проекта;\n- `409`: объект с таким именем уже существует, поэтому выберите другое имя или возьмите существующий объект;\n- `429` и `503`: облако занято или квота исчерпана, поэтому подождите и повторите запрос.\n\n### Как облако отвечает на медленные запросы\n\nВиртуальная машина не появляется за миллисекунды, а держать соединение открытым целую минуту неудобно и ненадёжно. Поэтому на запрос о создании ВМ облако сразу отвечает `202 Accepted` и присылает объект [[iac.operation|асинхронной операции]]. У операции есть `id` и `status`, который сначала равен `PENDING`, потом `RUNNING`, а в конце `DONE` или `ERROR` с указанием причины. Клиент отправляет запрос `GET /v1/operations/<id>`, пока работа не закончится. Параметр `?wait=30` просит облако подождать с ответом до 30 секунд, чтобы клиенту не приходилось спрашивать каждую секунду. Так же ждёт и провайдер Terraform, когда apply печатает строку `Still creating...`.\n\nВ этой лаборатории запрос на создание ВМ запускает в той же вкладке настоящую машину Linux. Первая машина загружается одну-две минуты, а следующие запускаются из снимка за несколько секунд.',
        'A Terraform provider does nothing magical. It turns `resource` blocks into HTTP requests to the [[iac.cloud-api|cloud API]], and the buttons of the web console and the command-line tools send the very same requests. Once you understand that conversation, provider errors stop being a mystery: behind each one is an API answer with a code and a message.\n\nIn this lesson the cloud lives right in the tab, at `api.cloud.lab`. Its API is built like those of the big clouds. Resources sit at paths like `/v1/projects/<project>/vms`; the method says what to do: `GET` reads, `POST` creates, `PATCH` changes, `DELETE` deletes. Request and response bodies are JSON, that is pairs of “field name and value” in curly braces: `{"name": "api-1"}`.\n\n### Who is asking\n\nThe catalogue of sizes and images is open to everyone, while everything that belongs to a project needs an [[iac.access-key|access key]]. A key is a pair of an identifier and a secret. The secret travels in the header `Authorization: Bearer <secret>`; the cloud shows it once, when the key is created, and keeps only its hash afterwards, a fingerprint by which a presented secret can be checked but from which the secret itself cannot be recovered. Without the header the answer is `401 Unauthenticated`, with another project’s key it is `403 PermissionDenied`. Errors come as a JSON body with a machine code and human text:\n\n```json\n{"error": {"code": "InvalidArgument", "message": "unknown flavor lab.huge", "status": 400, "details": {"field": "flavor"}}}\n```\n\nThe code tells a program what to do next, and in this lesson you meet these codes:\n\n- `200` and `202`: the request is accepted, and with 202 the work is still going on, so follow the result through the operation;\n- `400`: the request has a mistake, and the `details.field` field names the argument to fix;\n- `401`: the cloud found no key, so check the `Authorization` header and the `LAB_TOKEN` variable;\n- `403`: the key belongs to another project, and you need a key of this project;\n- `409`: an object with that name already exists, so choose another name or take the existing object;\n- `429` and `503`: the cloud is busy or the quota is used up, so wait and repeat the request.\n\n### Slow requests\n\nA virtual machine does not appear in milliseconds, and holding a connection open for a minute is a bad idea. So the cloud answers a VM creation with `202 Accepted` and a [[iac.operation|long-running operation]] object: it has an `id` and a `status`, `PENDING`, `RUNNING`, then `DONE`, or `ERROR` with a reason. The client asks `GET /v1/operations/<id>` until the work is over; the parameter `?wait=30` asks the cloud to hold its answer for up to 30 seconds, so that you need not poll every second. The Terraform provider waits the same way when apply prints `Still creating...`.\n\nIn this lab creating a VM boots a real Linux machine in the same tab. The first boot takes one to two minutes; later VMs start from a snapshot in seconds.',
      ),
    },
    {
      id: 'letters',
      kind: 'text',
      step: 'explain',
      levels: ['beginner'],
      title: bi('Запрос к API похож на письмо', 'A request to an API is like a letter'),
      body: bi(
        'Если HTTP, JSON и заголовки для вас пока только незнакомые слова, представьте себе обмен письмами. Запрос HTTP похож на письмо облаку. В первой строке письма написаны действие и адрес, например `GET /v1/flavors`, что означает «пришлите список размеров машин». Заголовки похожи на надписи на конверте: в них сказано, в каком формате вложение и чей пропуск приложен. Ключ доступа и есть такой пропуск, и его вкладывают в заголовок `Authorization` после слова `Bearer`, которое по-английски значит «предъявитель». Само вложение, то есть тело запроса, записано в формате JSON.\n\nОблако отвечает таким же письмом, и в первой строке ответа стоит трёхзначный код. Коды, которые начинаются с цифры 2, означают, что всё в порядке, а коды, которые начинаются с цифры 4, означают, что ошибся отправитель: забыл пропуск, перепутал адрес или неправильно заполнил вложение. Команда `curl`, с которой вы работаете в этом уроке, и пишет такие письма, а ключ `-i` показывает первую строку и заголовки ответа.',
        'If HTTP, JSON and headers are still unfamiliar words to you, think of an exchange of letters. An HTTP request is like a letter to the cloud. Its first line states the action and the address, for example `GET /v1/flavors`, which means “send me the list of machine sizes”. Headers are like the writing on the envelope: they say what format the enclosure is in and whose pass is attached. The access key is such a pass, and it goes into the `Authorization` header after the word `Bearer`, which means the one who presents it. The enclosure itself, the request body, is written in JSON.\n\nThe cloud answers with a letter of the same kind, and the first line of the answer holds a three-digit code. Codes starting with 2 mean that all is well, and codes starting with 4 mean the sender made a mistake: forgot the pass, mixed up the address or filled in the enclosure wrongly. The `curl` command you use in this lesson writes such letters, and its `-i` key shows the first line and the headers of the answer.',
      ),
    },
    { id: 'env', kind: 'callout', tone: 'note', body: ENV_NOTE },
    cloudLab({
      intro: bi('Слева перечислены цели, справа открыт терминал рабочей станции `ws`, а под ним находится панель облака с ключом доступа, списком машин и журналом запросов. Полное описание API показывает команда `curl -s http://api.cloud.lab/openapi.yaml | less`.', 'Goals on the left, the terminal of the workstation `ws` on the right, and below it the cloud panel: the key, the machines and the request log. The API description is `curl -s http://api.cloud.lab/openapi.yaml | less`.'),
      tasks: apiTasks,
      vmWatch: ['/root/hello'],
    }),
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.http-codes', 'iac.q.async'] },
  ],
};

// ── lesson 2: OpenTofu against the real cloud ──

const tofuTasks: Task[] = [
  {
    id: 'init',
    prompt: bi('В каталоге `~/infra` лежит конфигурация с одной ВМ `web-1`, а в файле `terraform.tfvars` записан ваш открытый ключ. Подготовьте каталог к работе, то есть сделайте так, чтобы OpenTofu установил провайдер `lab` и записал файл блокировки.', '`~/infra` holds a configuration with one VM `web-1`, and `terraform.tfvars` holds your public key. Prepare the directory: OpenTofu must install the `lab` provider and write the lock file.'),
    check: { when: `files['${INFRA}/.terraform.lock.hcl'].type=f` },
    chips: 'cd ~/infra && tofu init',
    concepts: ['iac.lock-file'],
    docRef: { page: 'web/opentofu.org/cli/init', anchor: 'mirror' },
    hints: { H1: bi('Выполните `tofu init` в каталоге конфигурации. Интернета у машины нет, поэтому провайдер берётся из локального зеркала, путь к которому записан в `~/.tofurc`.', '`tofu init` in the configuration directory. The machine has no internet: the provider comes from a local mirror, whose path is in `~/.tofurc`.') },
  },
  {
    id: 'apply',
    prompt: bi('Посмотрите план и создайте ВМ. Пока идёт apply, загляните в панель облака: там видно, как операция `vm.create` проходит свои статусы.', 'Look at the plan and create the VM. While apply runs, look at the cloud panel: you can see the `vm.create` operation go through its statuses.'),
    check: { when: (f) => vm(f, 'web-1')?.status === 'RUNNING' && /"lab_vm"/.test(f.files[`${INFRA}/terraform.tfstate`]?.text ?? '') },
    chips: 'tofu plan && tofu apply',
    concepts: ['iac.plan'],
    hints: { H1: bi('Команда `tofu apply` покажет тот же план и попросит подтвердить его словом `yes`. Дождитесь строки `Apply complete!`.', '`tofu apply` shows the same plan and asks for `yes`. Wait for `Apply complete!`.') },
  },
  {
    id: 'output',
    prompt: bi('Добавьте `output "ip"` с адресом ВМ, примените и зайдите на машину по этому адресу: `ssh root@$(tofu output -raw ip) hostname`.', 'Add an `output "ip"` with the VM address, apply, and log in to the machine at that address: `ssh root@$(tofu output -raw ip) hostname`.'),
    check: { when: (f) => /output\s+"ip"/.test(f.files[`${INFRA}/main.tf`]?.text ?? '') && /"outputs":\s*\{\s*"ip"/.test(f.files[`${INFRA}/terraform.tfstate`]?.text ?? '') && lastExit(f) === 0 && /\bweb-1\b/.test(lastOut(f)) },
    hints: { H1: bi('```hcl\noutput "ip" {\n  value = lab_vm.web.ip\n}\n```', '```hcl\noutput "ip" {\n  value = lab_vm.web.ip\n}\n```') },
  },
  {
    id: 'replace',
    prompt: bi(
      'Сайт на ВМ должен запускаться сам. Добавьте ВМ аргумент `user_data` со скриптом, который настраивает и запускает nginx, а готовый скрипт есть в подсказке. Прочитайте план и ответьте себе, что OpenTofu сделает с машиной и почему. Затем примените изменения и проверьте сайт командой `curl http://web-1.vm.lab/`.',
      'The site on the VM must come up by itself. Give the VM a `user_data` argument with a script that configures and starts nginx (a ready script is in the hint). Read the plan: what will OpenTofu do to the machine, and why? Apply and check with `curl http://web-1.vm.lab/`.',
    ),
    check: {
      when: (f) => vm(f, 'web-1')?.status === 'RUNNING' && !!vm(f, 'web-1')?.user_data && listens(f, 'web-1', 80),
      fail: [{ if: (f) => !!vm(f, 'web-1')?.user_data && !listens(f, 'web-1', 80), say: bi('Машина пересоздана, но на порту 80 никто не отвечает. Журнал скрипта лежит на ВМ в файле `/var/log/user-data.log`.', 'The machine was recreated, but nothing listens on port 80. The script’s log is `/var/log/user-data.log` on the VM.') }],
    },
    concepts: ['iac.replace'],
    hints: {
      H1: bi('Скрипт user data выполняется один раз, при первой загрузке, поэтому провайдер помечает этот аргумент словами `forces replacement`, и в плане будет знак `-/+`.', 'The user data script runs once, at the first boot, so the provider marks the argument `forces replacement`: the plan shows `-/+`.'),
      H2: bi(`\`\`\`hcl\n  user_data = ${USER_DATA}\n\`\`\``, `\`\`\`hcl\n  user_data = ${USER_DATA}\n\`\`\``),
    },
  },
  {
    id: 'destroy',
    prompt: bi('Наведите порядок после себя и одной командой удалите всё, что создала эта конфигурация.', 'Clean up: delete everything this configuration created with one command.'),
    check: { when: (f) => !vm(f, 'web-1') && (lf(f).cloud?.ops ?? []).some((o) => o.kind === 'vm.delete' && o.target === 'web-1' && o.status === 'DONE') && !/"lab_vm"/.test(f.files[`${INFRA}/terraform.tfstate`]?.text ?? '') },
    chips: 'tofu destroy',
  },
];

const tofuLesson: Lesson = {
  id: 'iac.tofu-lab',
  block: 'iac',
  title: bi('OpenTofu и настоящее облако', 'OpenTofu and a real cloud'),
  summary: bi('Цикл init, plan, apply и destroy остаётся прежним, но провайдер обращается к настоящему API, а каждая ВМ оказывается настоящей машиной, на которую можно зайти по SSH. Здесь видно, почему одни правки меняют ресурс на месте, а другие пересоздают его.', 'The same init → plan → apply → destroy cycle, but the provider talks to a real API and every VM is a real machine you can SSH into. Here you see why some edits change a resource in place and others recreate it.'),
  introduces: ['iac.lock-file', 'iac.replace'],
  uses: ['iac.provider', 'iac.plan', 'iac.state', 'iac.tf-variable', 'iac.cloud-api', 'iac.operation'],
  tier: 'core',
  minutes: 45,
  sources: src([W.tofuInit, W.tofuLock, W.tofuMirror, W.tofuOutput], [W.ruYcQuick]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В учебном облаке Edu Cloud ошибка в коде стоила только нескольких строк в выводе. Здесь `apply` загружает настоящую машину, на которую можно зайти по SSH, а неосторожная правка может удалить её вместе со всем, что было на её диске. В этом уроке вы пройдёте с OpenTofu весь путь от пустого каталога до работающего сайта и научитесь по плану заранее видеть, какие правки пересоздадут машину.',
        'In the Edu Cloud training cloud a mistake in the code cost only a few lines of output. Here `apply` boots a real machine you can SSH into, and a careless edit can destroy it together with everything on its disk. In this lesson you go with OpenTofu all the way from an empty directory to a working site and learn to see in the plan in advance which edits will recreate the machine.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'В учебном облаке Edu Cloud вы уже писали ресурсы и читали планы. Теперь то же самое делает OpenTofu, открытая версия Terraform, на рабочей станции, а провайдер `lab` отправляет запросы в API из прошлого урока. Код почти не изменится, зато изменится цена ошибки: `apply` запускает настоящую машину, а `destroy` её выключает и удаляет.\n\n### Откуда берётся провайдер\n\nКоманда `tofu init` читает блок `required_providers` и устанавливает плагины. Обычно она скачивает их из реестра, но у машин лаборатории нет интернета, поэтому в файле `~/.tofurc` настроено локальное зеркало, каталог `/usr/share/terraform/plugins`. Так же устроены закрытые сети в банках, где провайдеры заранее кладут во внутреннее зеркало. Выбранную версию и её контрольные суммы init записывает в [[iac.lock-file|файл блокировки провайдеров]] `.terraform.lock.hcl`. Этот файл сохраняют в репозитории вместе с кодом, и тогда у коллег и в CI будет установлен тот же провайдер, а не последний подходящий по версии.\n\nМашины лаборатории 32-разрядные, поэтому `tofu init` напечатает в рамке длинное английское предупреждение со словами `32-bit CPU architecture`. Это не ошибка: OpenTofu лишь советует со временем перейти на 64-разрядные машины, и на работу в лаборатории предупреждение не влияет.\n\n### Изменение на месте или пересоздание\n\nВ Edu Cloud вы уже видели, что одни правки облако делает на месте, а другие требуют новой машины. Провайдер `lab` тоже знает для каждого аргумента, может ли облако поменять его у работающего ресурса. Метки (`labels`) меняются запросом `PATCH`, и в плане это выглядит как `~ update in-place`. Размер, образ и `user_data`, то есть скрипт, который машина выполняет при первой загрузке, у работающей ВМ поменять нельзя. Для таких аргументов план показывает [[iac.replace|пересоздание ресурса]], то есть знак `-/+` и пометку `# forces replacement` у того аргумента, из-за которого машину придётся пересоздать. Для ВМ это означает новую машину с новым ID, и всё, что было на диске старой машины, пропадёт. Поэтому план читают до apply, а не после.',
        'In the Edu Cloud training cloud you have already written resources and read plans. Now the same is done by OpenTofu, the open version of Terraform, on the workstation, and the `lab` provider sends requests to the API from the last lesson. The code hardly changes, but the price of a mistake does: `apply` boots a real machine, and `destroy` shuts it down and deletes it.\n\n### Where the provider comes from\n\n`tofu init` reads the `required_providers` block and installs the plugins. Usually it downloads them from the registry, but the lab machines have no internet, so `~/.tofurc` sets up a local mirror, the directory `/usr/share/terraform/plugins`. Closed networks in banks work the same way: providers are put into an internal mirror in advance. init records the chosen version and its checksums in the [[iac.lock-file|dependency lock file]] `.terraform.lock.hcl`. This file is kept in the repository together with the code, and then colleagues and CI install the same provider rather than the latest matching version.\n\nThe lab machines are 32-bit, so `tofu init` prints a long English warning in a frame with the words `32-bit CPU architecture`. It is not an error: OpenTofu only advises moving to 64-bit machines in time, and the warning does not affect work in the lab.\n\n### In place or replacement\n\nFor every argument the provider knows whether the cloud can change it on a running resource. Labels (`labels`) are changed with a `PATCH` request, and in the plan this looks like `~ update in-place`. The size, the image and `user_data`, the script the machine runs at its first boot, cannot be changed on a running VM. For such arguments the plan shows a [[iac.replace|resource replacement]], the sign `-/+` and the mark `# forces replacement` next to the argument that makes the machine be recreated. For a VM this means a new machine with a new ID, and everything on the old machine’s disk is lost. That is why the plan is read before apply, not after.',
      ),
    },
    { id: 'env', kind: 'callout', tone: 'note', body: ENV_NOTE },
    cloudLab({
      intro: bi('Конфигурация уже лежит в `~/infra/main.tf`. Каждая ВМ здесь настоящая машина, поэтому apply длится столько, сколько она загружается: первая машина загружается одну-две минуты, а следующие несколько секунд.', 'The configuration is already in `~/infra/main.tf`. Every VM is a real machine, so apply takes as long as it boots: one to two minutes for the first one, seconds for later ones.'),
      tasks: tofuTasks,
      setup: [KEYGEN, write(`${INFRA}/main.tf`, TF_WEB), TFVARS],
      watch: [`${INFRA}/main.tf`, `${INFRA}/terraform.tfstate`, `${INFRA}/.terraform.lock.hcl`],
      vmScopes: ['listen'],
    }),
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.replace', 'iac.q.lock'] },
  ],
};

// ── lesson 3: state in object storage, drift, import ──

const TF_SG = `${TF_PROVIDER}
resource "lab_security_group" "web" {
  name = "web"
  rules = [
    { direction = "ingress", protocol = "tcp", port_min = 22, port_max = 22 },
    { direction = "ingress", protocol = "tcp", port_min = 80, port_max = 80 },
    { direction = "ingress", protocol = "icmp" },
  ]
}
`;

const BACKEND = `terraform {
  backend "s3" {
    bucket                      = "tfstate"
    key                         = "lab/terraform.tfstate"
    region                      = "lab-1"
    endpoints                   = { s3 = "http://s3.cloud.lab" }
    use_path_style              = true
    use_lockfile                = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}
`;

const DRIFT_RULE = 'ingress tcp 3306 0.0.0.0/0';
const STATE_KEY = 'lab/terraform.tfstate';

const stateTasks: Task[] = [
  {
    id: 'bucket',
    prompt: bi('State будет храниться в объектном хранилище облака. Создайте бакет `tfstate` запросом к API `POST /v1/projects/default/buckets` с телом `{"name": "tfstate"}`.', 'The state will live in the cloud’s object storage. Create a bucket `tfstate` with an API request: `POST /v1/projects/default/buckets` with the body `{"name": "tfstate"}`.'),
    check: { when: 'cloud.buckets[name=tfstate]' },
    chips: 'curl -s -X POST -H "Authorization: Bearer $LAB_TOKEN" -H "Content-Type: application/json" -d \'{"name":"tfstate"}\' http://api.cloud.lab/v1/projects/default/buckets',
    concepts: ['iac.remote-state'],
  },
  {
    id: 'migrate',
    prompt: bi(
      'В каталоге `~/infra` описана группа безопасности `web`, то есть набор правил, которые решают, какие соединения пропускать к машинам. Создайте её как обычно, с локальным state. Потом добавьте в блок `terraform {}` блок `backend "s3"`, образец которого лежит в `~/infra/backend.tf.example`, и перенесите state в бакет под ключом `lab/terraform.tfstate`.',
      '`~/infra` describes a security group `web`, a set of rules that decide which connections may reach the machines. Create it as usual, with a local state. Then add a `backend "s3"` block to `terraform {}` (an example is `~/infra/backend.tf.example`) and move the state into the bucket under the key `lab/terraform.tfstate`.',
    ),
    check: {
      when: (f) => addrs(stateAt(f, STATE_KEY)).includes('lab_security_group.web'),
      fail: [{ if: (f) => !!lf(f).cloud?.sgs.some((g) => g.name === 'web') && !stateAt(f, STATE_KEY), say: bi('Группа создана, но state всё ещё хранится локально. После правки блока backend нужно выполнить `tofu init -migrate-state`.', 'The group exists, but the state is still local. After editing the backend you need `tofu init -migrate-state`.') }],
    },
    concepts: ['iac.remote-state', 'iac.state-lock'],
    docRef: { page: 'web/opentofu.org/backend/s3', anchor: 'example' },
    hints: {
      H1: bi('Выполните `cp backend.tf.example backend.tf`, а затем `tofu init -migrate-state`, и OpenTofu спросит, копировать ли state в новое хранилище.', '`cp backend.tf.example backend.tf`, then `tofu init -migrate-state`; OpenTofu asks whether to copy the state to the new backend.'),
      H2: bi('Ключи для хранилища backend s3 берёт из переменных `AWS_ACCESS_KEY_ID` и `AWS_SECRET_ACCESS_KEY`, которые уже заданы в окружении. Проверьте результат командой `curl -s --aws-sigv4 "aws:amz:lab-1:s3" -u "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" http://s3.cloud.lab/tfstate/`, которая перечислит объекты в бакете. Без ключа хранилище отвечает `AccessDenied`, поэтому ключ `--aws-sigv4` подписывает запрос тем же ключом доступа, как этого требует протокол S3.', 'The S3 backend takes storage keys from `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, which are already in the environment. Check the result with `curl -s --aws-sigv4 "aws:amz:lab-1:s3" -u "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" http://s3.cloud.lab/tfstate/`, which lists the objects in the bucket. Without a key the storage answers `AccessDenied`, so `--aws-sigv4` signs the request with the same access key, as the S3 protocol requires.'),
    },
  },
  {
    id: 'drift',
    prompt: bi(
      'Нажмите в панели облака кнопку «Коллега открыл MySQL всему интернету». Найдите это изменение планом, не заходя в панель, и верните группу к тому, что написано в коде.',
      'Press the button “A colleague opened MySQL to the whole internet” in the cloud panel. Find the change with a plan, without looking at the panel, and bring the group back to what the code says.',
    ),
    check: {
      when: (f) => (lf(f).cloud?.requests ?? []).some((r) => r.from === '10.0.0.1' && r.method === 'PATCH' && /security-groups/.test(r.path)) && !!lf(f).cloud?.sgs.find((g) => g.name === 'web') && !lf(f).cloud!.sgs.find((g) => g.name === 'web')!.rules.includes(DRIFT_RULE),
      fail: [{ if: (f) => !!lf(f).cloud?.sgs.find((g) => g.name === 'web')?.rules.includes(DRIFT_RULE), say: bi('Правило, которое открывает порт MySQL 3306, всё ещё на месте. План его видит, а apply вернёт группу к тому, что записано в коде.', 'The 3306 rule is still there. The plan sees it; apply brings the group back to the code.') }],
    },
    concepts: ['iac.drift'],
    hints: { H1: bi('Команда `tofu plan` сначала обновляет state по ответам API, а потом показывает разницу с кодом, и лишнее правило будет помечено знаком `-`.', '`tofu plan` first refreshes the state from the API and shows the difference with the code: the extra rule is marked `-`.') },
  },
  {
    id: 'import',
    prompt: bi(
      'Зону DNS `shop.lab` и запись `www` в ней когда-то создали вручную через API. Возьмите обе под управление кода: опишите их в коде и импортируйте, ничего не пересоздавая. В конце `tofu plan` должен сообщить `No changes`.',
      'The zone `shop.lab` and the record `www` in it were once created by hand through the API. Take both under management: describe them in code and import them without recreating anything. The final `tofu plan` must say `No changes`.',
    ),
    check: {
      when: (f, start) => {
        const was = lf(start).cloud?.records.find((r) => r.fqdn === 'www.shop.lab');
        const st = stateAt(f, STATE_KEY);
        const rec = st?.resources.find((r) => r.type === 'lab_dns_record');
        const zone = st?.resources.find((r) => r.type === 'lab_dns_zone');
        return !!was && rec?.id === was.id && !!zone && (lf(f).cloud?.records ?? []).filter((r) => r.fqdn === 'www.shop.lab').length === 1 && lastExit(f) === 0 && /No changes/.test(lastOut(f));
      },
      fail: [{ if: (f) => wsReq(f, (r) => r.method === 'POST' && /\/records/.test(r.path) && r.status < 300), say: bi('Запись пересоздана, и у неё теперь новый id. Импорт берёт существующий объект, а не создаёт новый, поэтому уберите запись из state и импортируйте ту, что есть.', 'The record was recreated: it has a new id. Import takes the existing object instead of creating one: remove the record from the state and import the one that exists.') }],
    },
    concepts: ['iac.import'],
    docRef: { page: 'web/opentofu.org/language/import', anchor: 'block' },
    hints: {
      H1: bi('Вам нужны блоки `import { to = …, id = … }`. Зону импортируют по имени `shop.lab`, а запись по идентификатору `shop.lab/www`.', '`import { to = …, id = … }` blocks. The zone is imported by its name `shop.lab`, the record by `shop.lab/www`.'),
      H2: bi('```hcl\nimport {\n  to = lab_dns_zone.shop\n  id = "shop.lab"\n}\nimport {\n  to = lab_dns_record.www\n  id = "shop.lab/www"\n}\nresource "lab_dns_zone" "shop" { name = "shop.lab" }\nresource "lab_dns_record" "www" {\n  zone_id = lab_dns_zone.shop.id\n  name    = "www"\n  type    = "A"\n  values  = ["10.0.0.50"]\n}\n```', '```hcl\nimport {\n  to = lab_dns_zone.shop\n  id = "shop.lab"\n}\nimport {\n  to = lab_dns_record.www\n  id = "shop.lab/www"\n}\nresource "lab_dns_zone" "shop" { name = "shop.lab" }\nresource "lab_dns_record" "www" {\n  zone_id = lab_dns_zone.shop.id\n  name    = "www"\n  type    = "A"\n  values  = ["10.0.0.50"]\n}\n```'),
    },
  },
];

const stateLesson: Lesson = {
  id: 'iac.remote-state',
  block: 'iac',
  title: bi('State в хранилище, дрейф и импорт на настоящем облаке', 'State in storage, drift and import on a real cloud'),
  summary: bi('State переносят из каталога на ноутбуке в бакет, где его видят коллеги и CI. Изменения, сделанные в обход кода, находит план, а объекты, созданные вручную, берут под управление импортом.', 'The state moves from a laptop directory into a bucket where colleagues and CI can see it. Changes behind the code’s back are found by the plan, and hand-made objects are taken under management by import.'),
  introduces: ['iac.remote-state', 'iac.state-lock'],
  uses: ['iac.state', 'iac.drift', 'iac.import', 'iac.cloud-api', 'iac.lock-file'],
  tier: 'core',
  minutes: 45,
  sources: src([W.tofuS3, W.tofuBackend, W.tofuImport, S.tfDrift], [W.ruYcState, W.ruYcImport]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Коллега скачал себе копию репозитория с вашим кодом командой `git clone`, запустил `tofu plan` и увидел, что OpenTofu собирается создать заново всё, что давно работает. Файл state остался на вашем ноутбуке, и без него OpenTofu ничего не знает о созданных ресурсах. В этом уроке вы перенесёте state в общее хранилище облака, найдёте планом правку, которую коллега сделал в обход кода, и возьмёте под управление объекты, созданные вручную.',
        'A colleague cloned the repository with your code, ran `tofu plan` and saw that OpenTofu is about to create again everything that has long been running. The state file stayed on your laptop, and without it OpenTofu knows nothing about the created resources. In this lesson you move the state into the cloud’s shared storage, find with a plan the edit a colleague made bypassing the code, and take hand-made objects under management.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Пока state лежит файлом `terraform.tfstate` в вашем каталоге, инфраструктурой может управлять только ваш ноутбук. Коллега с тем же кодом, но без этого файла увидит в плане предложение создать всё заново, и то же самое увидит CI, который каждый раз начинает с чистой копии репозитория. Поэтому в командах state хранят в общем месте. Такой [[iac.remote-state|удалённый state]] настраивают блоком `backend` внутри блока `terraform {}`.\n\nЧаще всего используют backend `s3`, с которым state становится объектом в бакете. Объектное хранилище лаборатории (`s3.cloud.lab`) работает по протоколу S3, как хранилища Yandex Cloud, VK Cloud и MinIO, поэтому блок выглядит так же, как на рабочих серверах, и отличается только адресом. Перенос выполняют командой `tofu init -migrate-state`: OpenTofu копирует локальный state в бакет и дальше читает и пишет его только там.\n\nДва человека могут запустить apply одновременно. Чтобы они не затёрли записи друг друга, backend ставит [[iac.state-lock|блокировку state]]. Если в блоке backend задана настройка `use_lockfile = true`, на время работы рядом со state появляется объект `.tflock`, и второй запуск сообщает `Error acquiring the state lock` вместо того, чтобы молча испортить файл.\n\nБывает, что apply прерывается посередине, например когда закрыли ноутбук или джоба CI завершилась по таймауту. Откатывать уже сделанное OpenTofu не станет, потому что apply не транзакция «всё или ничего». State он записывает по ходу работы, поэтому ресурсы, которые облако успело создать, как правило, уже есть в state, и следующий plan предложит доделать только остаток. Блокировка после такого обрыва может остаться, и тогда её снимают командой `tofu force-unlock` с идентификатором из сообщения об ошибке, но только убедившись, что прерванный запуск больше не работает. Хуже, если запуск оборвался между ответом облака и записью в state: тогда в облаке остаётся объект, которого нет в state, и его берут под управление блоком import, как показано ниже.\n\n### Отдельный state для каждого окружения\n\nТестовый стенд и рабочие серверы описывают одним и тем же кодом, но state у них должен быть разный, иначе неудачный apply на тестовом стенде заденет рабочие серверы. Поэтому каждому окружению дают свой ключ в бакете, например `stage/terraform.tfstate` и `prod/terraform.tfstate`, а код раскладывают по каталогам окружений, которые вызывают одни и те же модули и отличаются только значениями переменных. Есть и второй способ, рабочие области (workspaces): команда `tofu workspace new stage` заводит рядом с основным state ещё один, и тот же каталог применяется то к одному, то к другому. Если окружению нужно значение из чужого state, например адрес общей сети, его не копируют руками, а читают блоком `data "terraform_remote_state"`, который достаёт выводы другого state из хранилища.\n\n### Дрейф и импорт в настоящем облаке\n\nПровайдер `lab` при каждом plan перечитывает ресурсы из API. Если кто-то поменял группу безопасности в консоли, план покажет разницу, а apply вернёт группу к коду. Бывает и обратная задача, когда объект создан вручную, а управлять им должен код. Такой объект описывают блоком `resource` и привязывают блоком `import` с id из облака, и после этого план показывает `will be imported` и ничего не пересоздаёт.',
        'While the state is a `terraform.tfstate` file in your directory, only your laptop can manage the infrastructure. A colleague with the same code but without the file sees “create everything” in the plan, and so does CI, which starts from a clean clone every time. That is why teams keep the state in a shared place: [[iac.remote-state|remote state]] is configured with a `backend` block in `terraform {}`.\n\nThe most common backend is `s3`: the state becomes an object in a bucket. The lab’s object storage (`s3.cloud.lab`) speaks the S3 protocol, like the storage of Yandex Cloud, VK Cloud and MinIO, so the block looks the same as in production, with a different address. The move is made with `tofu init -migrate-state`: OpenTofu copies the local state into the bucket and from then on reads and writes only there.\n\nTwo people may run apply at the same time. To keep them from overwriting each other, the backend takes a [[iac.state-lock|state lock]]: while it works, a `.tflock` object appears next to the state (`use_lockfile = true` turns this on), and the second run reports `Error acquiring the state lock` instead of quietly corrupting the file.\n\nSometimes apply is interrupted halfway, for example when the laptop is closed or a CI job hits its timeout. OpenTofu will not roll back what is already done, because apply is not an all-or-nothing transaction. It writes the state as it goes, so the resources the cloud managed to create are as a rule already in the state, and the next plan proposes to finish only the rest. After such a break the lock may stay behind; then it is removed with `tofu force-unlock` and the ID from the error message, but only after making sure the interrupted run is no longer working. It is worse if the run broke off between the cloud’s answer and the state write: then the cloud keeps an object the state does not know about, and it is taken over with an import block, described below.\n\n### A separate state for every environment\n\nThe test environment and the production servers are described by the same code, but their states must differ, or a failed apply on the test environment hits the production servers. So every environment gets its own key in the bucket, such as `stage/terraform.tfstate` and `prod/terraform.tfstate`, and the code is laid out in per-environment directories that call the same modules and differ only in variable values. There is a second way, workspaces: `tofu workspace new stage` creates one more state next to the main one, and the same directory is applied now to one, now to the other. If an environment needs a value from another state, such as the address of a shared network, it is not copied by hand but read with a `data "terraform_remote_state"` block, which fetches the outputs of the other state from the storage.\n\n### Drift and import for real\n\nThe `lab` provider rereads resources from the API on every plan. If someone changed a security group in the console, the plan shows the difference and apply brings it back to the code. The opposite task: an object was made by hand, and the code should manage it. You describe it with a `resource` block and bind it with an `import` block carrying the id from the cloud; the plan then says `will be imported` and recreates nothing.',
      ),
    },
    { id: 'env', kind: 'callout', tone: 'note', body: ENV_NOTE },
    cloudLab({
      intro: bi('В этом уроке ВМ не нужны: группа безопасности, зона DNS и бакет создаются мгновенно, а содержимое бакета со state покажет команда `curl -s --aws-sigv4 "aws:amz:lab-1:s3" -u "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" http://s3.cloud.lab/tfstate/`. Хранилище пускает только подписанные запросы, и ключ `--aws-sigv4` подписывает запрос ключом доступа из переменных `AWS_ACCESS_KEY_ID` и `AWS_SECRET_ACCESS_KEY`.', 'No VMs are needed here: the security group, the DNS zone and the bucket appear at once, and the command `curl -s --aws-sigv4 "aws:amz:lab-1:s3" -u "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" http://s3.cloud.lab/tfstate/` shows what is in the state bucket. The storage lets in only signed requests, and `--aws-sigv4` signs the request with the access key from `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.'),
      tasks: stateTasks,
      setup: [write(`${INFRA}/main.tf`, TF_SG), write(`${INFRA}/backend.tf.example`, BACKEND)],
      seed: [
        { method: 'POST', path: '/v1/projects/{project}/dns/zones', body: { name: 'shop.lab', description: 'made by hand during the launch' } },
        { method: 'POST', path: '/v1/projects/{project}/dns/zones/shop.lab/records', body: { name: 'www', type: 'A', values: ['10.0.0.50'] } },
      ],
      actions: [
        {
          id: 'open-mysql',
          label: bi('Коллега открыл MySQL всему интернету', 'A colleague opened MySQL to the whole internet'),
          calls: [
            {
              method: 'PATCH',
              path: '/v1/projects/{project}/security-groups/web',
              body: {
                rules: [
                  { direction: 'ingress', protocol: 'tcp', port_min: 22, port_max: 22, cidr: '0.0.0.0/0' },
                  { direction: 'ingress', protocol: 'tcp', port_min: 80, port_max: 80, cidr: '0.0.0.0/0' },
                  { direction: 'ingress', protocol: 'icmp', cidr: '0.0.0.0/0' },
                  { direction: 'ingress', protocol: 'tcp', port_min: 3306, port_max: 3306, cidr: '0.0.0.0/0', description: 'temporary, for the migration' },
                ],
              },
            },
          ],
        },
      ],
      watch: [`${INFRA}/main.tf`, `${INFRA}/backend.tf`],
    }),
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.remote-why', 'iac.q.lock-error'] },
  ],
};

// ── lesson 4: a module for several machines ──

const MODULE_TF = `terraform {
  required_providers {
    lab = { source = "lab/lab" }
  }
}

variable "name" {
  type = string
}

variable "ssh_public_key" {
  type = string
}

resource "lab_vm" "this" {
  name                = var.name
  flavor              = "lab.small"
  image               = "lab-node"
  ssh_authorized_keys = [var.ssh_public_key]
  labels              = { module = "web" }
  user_data           = ${USER_DATA}
}

output "ip" {
  value = lab_vm.this.ip
}
`;

const ROOT_TF = `${TF_PROVIDER}
variable "ssh_public_key" {
  type = string
}

# Call ./modules/web here: one machine per name.
`;

const webVms = (f: Facts) => (lf(f).cloud?.vms ?? []).filter((v) => v.labels.module === 'web');
const created = (f: Facts, name: string) => (lf(f).cloud?.ops ?? []).filter((o) => o.kind === 'vm.create' && o.target === name).length;

const moduleTasks: Task[] = [
  {
    id: 'two',
    prompt: bi(
      'Модуль `~/infra/modules/web` создаёт одну ВМ с nginx. Вызовите его в `main.tf` с `for_each` по множеству `["a", "b"]` так, чтобы появились машины `web-a` и `web-b`, и примените изменения. Обе машины должны отвечать на порту 80.',
      'The module `~/infra/modules/web` creates one VM with nginx. Call it in `main.tf` with `for_each` over the set `["a", "b"]` so that machines `web-a` and `web-b` appear, and apply. Both must answer on port 80.',
    ),
    check: {
      when: (f) => ['web-a', 'web-b'].every((n) => vm(f, n)?.status === 'RUNNING' && listens(f, n, 80)) && /for_each/.test(f.files[`${INFRA}/main.tf`]?.text ?? ''),
    },
    concepts: ['iac.for-each', 'iac.tf-module'],
    hints: {
      H1: bi('Внутри блока с `for_each` текущий ключ доступен как `each.key`, а имя машины собирают строкой `"web-${each.key}"`.', 'Inside a block with `for_each` the current key is `each.key`; build the machine name as the string `"web-${each.key}"`.'),
      H2: bi('```hcl\nmodule "web" {\n  source         = "./modules/web"\n  for_each       = toset(["a", "b"])\n  name           = "web-${each.key}"\n  ssh_public_key = var.ssh_public_key\n}\n```\nПосле того как вы добавили модуль, выполните `tofu init`.', '```hcl\nmodule "web" {\n  source         = "./modules/web"\n  for_each       = toset(["a", "b"])\n  name           = "web-${each.key}"\n  ssh_public_key = var.ssh_public_key\n}\n```\nAfter adding a module you need `tofu init`.'),
    },
  },
  {
    id: 'outputs',
    prompt: bi('Добавьте вывод `output "ips"`, который собирает из всех экземпляров модуля словарь, где имени машины соответствует её адрес, и примените изменения. Проверьте вывод командой `tofu output ips`.', 'Add an `output "ips"`, a map of “machine name → address” from all instances of the module, and apply. Check it with `tofu output ips`.'),
    check: { when: (f) => /output\s+"ips"/.test(f.files[`${INFRA}/main.tf`]?.text ?? '') && lastExit(f) === 0 && /web-a|"a"/.test(lastOut(f)) && /10\.0\.0\.\d+/.test(lastOut(f)) },
    hints: { H1: bi('```hcl\noutput "ips" {\n  value = { for k, m in module.web : "web-${k}" => m.ip }\n}\n```', '```hcl\noutput "ips" {\n  value = { for k, m in module.web : "web-${k}" => m.ip }\n}\n```') },
  },
  {
    id: 'remove-b',
    prompt: bi('Машина `web-b` больше не нужна. Уберите её из кода и примените изменения так, чтобы `web-a` осталась той же машиной и её не пересоздали.', 'The machine `web-b` is no longer needed. Remove it from the code and apply so that `web-a` stays the same machine: it must not be recreated.'),
    check: {
      when: (f) => !vm(f, 'web-b') && vm(f, 'web-a')?.status === 'RUNNING' && created(f, 'web-a') === 1 && webVms(f).length === 1,
      fail: [{ if: (f) => created(f, 'web-a') > 1, say: bi('Машина web-a создана заново. Так бывает, когда for_each заменяют на count, потому что адреса экземпляров сдвигаются. Ключи множества сохраняют за машиной адрес module.web["a"].', 'web-a was created again. This happens when for_each is swapped for count: instance addresses shift. The keys of a set keep the address module.web["a"].') }],
    },
    concepts: ['iac.for-each'],
  },
];

const moduleLesson: Lesson = {
  id: 'iac.modules-lab',
  block: 'iac',
  title: bi('Один модуль для нескольких машин', 'One module for several machines'),
  summary: bi('Один модуль, вызванный с for_each, создаёт столько машин, сколько ключей в множестве, и каждая получает свой стабильный адрес. Удаление ключа удаляет одну машину и не трогает остальные.', 'One module called with for_each creates as many machines as there are keys in the set, and each gets its own stable address. Removing a key removes one machine and leaves the rest alone.'),
  introduces: ['iac.for-each'],
  uses: ['iac.tf-module', 'iac.tf-variable', 'iac.replace', 'iac.plan'],
  tier: 'plus',
  minutes: 40,
  sources: src([W.tofuForEach, W.tofuModules], [W.ruYcModules]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Сайту кафе стало мало одной машины, и нужны две одинаковые, а скоро понадобится и третья. Если копировать блок `module` для каждой машины, правку однажды внесут в один блок и забудут в другом, и машины начнут различаться. В этом уроке один блок `module` создаст столько машин, сколько вы перечислите, и вы увидите, как убрать одну из них, не трогая остальные.',
        'One machine is no longer enough for the café site: it needs two identical ones, and soon a third. If you copy the `module` block for every machine, one day an edit lands in one block and is forgotten in another, and the machines start to differ. In this lesson one `module` block creates as many machines as you list, and you see how to remove one of them without touching the rest.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Модуль вы уже вызывали по одному разу на каждую машину. Когда одинаковых машин становится три или десять, копировать блок `module` неудобно и опасно, потому что правку легко внести в один блок и забыть в другом. Мета-аргумент [[iac.for-each|for_each]] создаёт по экземпляру модуля на каждый ключ множества или словаря:\n\n```hcl\nmodule "web" {\n  source   = "./modules/web"\n  for_each = toset(["a", "b"])\n  name     = "web-${each.key}"\n}\n```\n\nАдрес каждого экземпляра содержит ключ: `module.web["a"]`, `module.web["b"]`. В этом главное отличие от `count`, у которого экземпляры нумеруются. Если из списка для `count` убрать первый элемент, номера всех следующих сдвинутся на единицу, и план предложит пересоздать машины, которые вы не трогали. С `for_each` ключ «b» исчезает вместе со своим экземпляром, а `module.web["a"]` остаётся на месте.\n\nЕсли модуль вызван с `for_each`, обращение `module.web` возвращает словарь экземпляров, и по нему проходят выражением `for`: `{ for k, m in module.web : k => m.ip }`.',
        'You have already called a module once per machine. When there are three or ten identical machines, copying the `module` block is awkward and dangerous: an edit is easily made in one block and forgotten in another. The meta-argument [[iac.for-each|for_each]] creates one instance per key of a set or map:\n\n```hcl\nmodule "web" {\n  source   = "./modules/web"\n  for_each = toset(["a", "b"])\n  name     = "web-${each.key}"\n}\n```\n\nThe instances have addresses with the key: `module.web["a"]`, `module.web["b"]`. This is the main difference from `count`, whose instances are numbered: remove the first element of a `count` list and all the following ones shift by one, and the plan proposes to recreate machines you never touched. With `for_each`, the key “b” disappears together with its instance, and `module.web["a"]` stays where it was.\n\nThe outputs of a module with `for_each` form a map of instances, walked with a `for` expression: `{ for k, m in module.web : k => m.ip }`.',
      ),
    },
    {
      id: 'memory',
      kind: 'callout',
      tone: 'note',
      body: bi('Здесь одновременно работают рабочая станция и две ВМ. Если вкладке не хватит памяти, облако откажет с ответом `429 QuotaExceeded` и объяснит причину. Тогда закройте другие тяжёлые вкладки и повторите apply.', 'Here a workstation and two VMs run at once. If the tab runs short of memory, the cloud refuses with `429 QuotaExceeded` and explains why. Then close other heavy tabs and run apply again.'),
    },
    cloudLab({
      tasks: moduleTasks,
      setup: [KEYGEN, write(`${INFRA}/modules/web/main.tf`, MODULE_TF), write(`${INFRA}/main.tf`, ROOT_TF), TFVARS],
      watch: [`${INFRA}/main.tf`],
      vmScopes: ['listen'],
    }),
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.foreach-count'] },
  ],
};

// ── lesson 5: push → CI → tofu apply ──

const CI_TF = `${TF_PROVIDER}
${BACKEND.replace('lab/terraform.tfstate', 'ci/terraform.tfstate')}
resource "lab_vm" "app" {
  name   = "ci-app"
  flavor = "lab.small"
  image  = "lab-node"
  labels = { deployed_by = "ci" }
}
`;

const CI_YML = `stages: [plan, apply]

plan:
  stage: plan
  script:
    - tofu init -input=false
    - tofu plan -input=false -out=plan.tfplan
  artifacts:
    paths: [plan.tfplan]

# Write the apply job: it applies the saved plan, only on the default branch.
`;

const ciState = 'ci/terraform.tfstate';
const pipes = (f: Facts, repo = 'infra') => (lf(f).ci?.pipelines ?? []).filter((p) => p.repo === repo);
const job = (p: { jobs: { name: string; status: string }[] } | undefined, name: string) => p?.jobs.find((j) => j.name === name);

const ciTasks: Task[] = [
  {
    id: 'push',
    prompt: bi(
      'В каталоге `~/infra-repo` лежат код ВМ `ci-app`, state которой хранится в бакете, и начало файла `.gitlab-ci.yml` с джобой plan. Сделайте из каталога репозиторий, сохраните всё в одном коммите вместе с `.terraform.lock.hcl` и отправьте в `http://git.lab/infra.git` веткой `main`. Пайплайн запустится сам.',
      '`~/infra-repo` holds the code of a VM `ci-app` with its state in the bucket, and the beginning of a `.gitlab-ci.yml` with a plan job. Make the directory a repository, commit everything together with `.terraform.lock.hcl` and push it to `http://git.lab/infra.git` as the `main` branch. The pipeline starts by itself.',
    ),
    check: {
      when: (f) => (lf(f).git?.repos ?? []).some((r) => r.name === 'infra' && r.branches.includes('main') && r.files.includes('.terraform.lock.hcl')) && pipes(f).some((p) => job(p, 'plan')?.status === 'success'),
      fail: [
        { if: (f) => (lf(f).git?.repos ?? []).some((r) => r.name === 'infra' && !r.files.includes('.terraform.lock.hcl')), say: bi('В репозитории нет `.terraform.lock.hcl`. Он появляется после `tofu init`, и его нужно добавить в коммит вместе с кодом.', 'The repository has no `.terraform.lock.hcl`. It appears after `tofu init` and is committed together with the code.') },
        { if: (f) => pipes(f).some((p) => job(p, 'plan')?.status === 'failed'), say: bi('Джоба plan завершилась с ошибкой. Откройте её журнал в панели или командой `curl http://ci.lab/pipelines/<номер>`.', 'The plan job failed: open its log in the panel or with `curl http://ci.lab/pipelines/<number>`.') },
      ],
    },
    concepts: ['cicd.pipeline-file', 'cicd.runner'],
    hints: {
      H1: bi('Выполните по очереди `tofu init`, чтобы появился файл блокировки, затем `git init -b main`, `git add -A`, `git commit`, `git remote add origin http://git.lab/infra.git` и `git push -u origin main`. Каталог `.terraform/` уже исключён в `.gitignore`.', '`tofu init` (so that the lock file appears), `git init -b main`, `git add -A`, `git commit`, `git remote add origin http://git.lab/infra.git`, `git push -u origin main`. `.gitignore` already excludes `.terraform/`.'),
    },
  },
  {
    id: 'apply-job',
    prompt: bi(
      'Допишите джобу `apply` на стадии `apply`. Она должна применять сохранённый план из артефакта `plan.tfplan` и запускаться только для ветки по умолчанию. Отправьте изменения командой push, и после этого пайплайн должен создать ВМ `ci-app`.',
      'Finish the `apply` job in the `apply` stage: it applies the saved plan from the artifact `plan.tfplan` and runs only for the default branch. Push: the pipeline must create the VM `ci-app`.',
    ),
    check: {
      when: (f) => pipes(f).some((p) => p.ref === 'main' && job(p, 'apply')?.status === 'success') && vm(f, 'ci-app')?.status === 'RUNNING' && addrs(stateAt(f, ciState)).includes('lab_vm.app'),
      fail: [{ if: (f) => pipes(f).some((p) => job(p, 'apply')?.status === 'failed'), say: bi('Джоба apply завершилась с ошибкой. Чаще всего причина в том, что в этой джобе не выполнили `tofu init`, а каталог .terraform у каждой джобы свой.', 'apply failed. A common cause: no `tofu init` in this job; each job has its own .terraform directory.') }],
    },
    concepts: ['iac.saved-plan', 'cicd.rules', 'cicd.artifact'],
    hints: {
      H1: bi('Правило запуска записывается как `if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH`. В скрипте выполните `tofu init -input=false`, а затем `tofu apply -input=false plan.tfplan`. Ключ `-auto-approve` не нужен, потому что сохранённый план подтверждения не спрашивает.', 'The rule: `if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH`. The script: `tofu init -input=false`, then `tofu apply -input=false plan.tfplan`, with no `-auto-approve`: a saved plan asks for no confirmation.'),
      H2: bi('```yaml\napply:\n  stage: apply\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n  script:\n    - tofu init -input=false\n    - tofu apply -input=false plan.tfplan\n```', '```yaml\napply:\n  stage: apply\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n  script:\n    - tofu init -input=false\n    - tofu apply -input=false plan.tfplan\n```'),
    },
  },
  {
    id: 'branch',
    prompt: bi('Создайте ветку `resize`, поменяйте в ней метку ВМ (`labels`) и отправьте ветку командой push. Пайплайн этой ветки должен показать план и ничего не применить. Проверьте, что в журнале джобы plan есть строка `~ update in-place`, а в облаке у машины осталась старая метка.', 'In a branch `resize`, change the VM’s label (`labels`) and push the branch. The branch pipeline must show the plan and apply nothing: check the plan log for `~ update in-place` and the old label in the cloud.'),
    check: {
      when: (f) => pipes(f).some((p) => p.ref === 'resize' && job(p, 'plan')?.status === 'success' && /update in-place/.test(p.jobs.find((j) => j.name === 'plan')?.log ?? '') && !job(p, 'apply')) && vm(f, 'ci-app')?.labels.deployed_by === 'ci',
    },
    concepts: ['cicd.rules', 'iac.plan'],
    hints: { H1: bi('Выполните `git switch -c resize`, поправьте `main.tf`, сделайте коммит и выполните `git push -u origin resize`.', '`git switch -c resize`, edit `main.tf`, commit, `git push -u origin resize`.') },
  },
];

const ciLesson: Lesson = {
  id: 'iac.ci-apply',
  block: 'iac',
  title: bi('Как пайплайн применяет изменения инфраструктуры', 'How a pipeline applies infrastructure changes'),
  summary: bi('Инфраструктуру меняет не ноутбук, а пайплайн. Push в git.lab запускает plan, сохранённый план передаётся артефактом в джобу apply, и эта джоба применяет его без изменений, причём только для ветки по умолчанию.', 'Infrastructure is changed by a pipeline, not a laptop: a push to git.lab starts plan, the saved plan goes as an artifact to the apply job, and that job applies exactly it, only from the default branch.'),
  introduces: ['iac.saved-plan'],
  uses: ['iac.remote-state', 'iac.lock-file', 'cicd.pipeline-file', 'cicd.job', 'cicd.stage', 'cicd.runner', 'cicd.rules', 'cicd.artifact', 'git.remote', 'git.branch'],
  tier: 'core',
  minutes: 45,
  sources: src([W.gitlabTf, W.tofuAutomation, W.gitlabShell, W.gitlabArtifacts], [W.ruGitlabCi]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Сейчас изменения в облаке вносит тот, у кого на ноутбуке есть ключ доступа и кто последним запустил apply. Через месяц никто не скажет, кто и зачем поменял машину, а ключ к облаку окажется у половины команды. В этом уроке вы передадите apply пайплайну: каждое изменение инфраструктуры станет коммитом в репозитории, а ключ к облаку останется только у раннера, то есть у программы, которая выполняет задания пайплайна.',
        'Right now the cloud is changed by whoever has the access key on a laptop and ran apply last. In a month nobody will be able to say who changed a machine and why, and half the team will hold the cloud key. In this lesson you hand apply over to a pipeline: every infrastructure change becomes a commit in the repository, and the cloud key stays with the runner only.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Остался последний шаг, и он состоит в том, чтобы убрать человека с ноутбуком из цепочки изменений. Код инфраструктуры хранится в репозитории, и каждый push запускает пайплайн, в котором выполняется `tofu plan`, а для ветки по умолчанию ещё и `tofu apply`. Тогда историей изменений инфраструктуры служит история коммитов, а права на облако есть только у [[cicd.runner|раннера]], то есть у программы, которая выполняет [[cicd.job|джобы]] пайплайна, а не у каждого инженера.\n\nТакой пайплайн работает только при трёх условиях. Во-первых, state должен быть удалённым: раннер каждый раз начинает с чистой копии репозитория, и локального файла `terraform.tfstate` у него нет. Во-вторых, в репозитории должен лежать файл блокировки провайдеров, иначе init в CI может выбрать не ту версию провайдера, что у вас. В-третьих, apply должен применять [[iac.saved-plan|сохранённый план]]. Джоба plan выполняет `tofu plan -out=plan.tfplan` и передаёт файл плана дальше как артефакт, а джоба apply выполняет `tofu apply plan.tfplan`. Если между этими джобами кто-то успел поменять state, apply откажется работать, поэтому применяется только то, что было показано в плане.\n\nВ лаборатории git.lab служит Git-сервером во вкладке, а раннер работает службой на рабочей станции и выполняет команды джоб в её обычной оболочке. Так же устроен gitlab-runner, если выбрать для него исполнитель shell. Пайплайны видны в панели облака и по адресу `http://ci.lab/`. Ключ облака лежит в окружении раннера, а в настоящем GitLab его положили бы в защищённую переменную CI/CD, которая доступна только защищённым веткам.',
        'One last step remains, and it is to take the person with a laptop out of the chain of changes. The infrastructure code is kept in a repository, and every push starts a pipeline that runs `tofu plan`, and for the default branch `tofu apply` as well. Then the history of infrastructure changes is the commit history, and the rights to the cloud belong only to the [[cicd.runner|runner]], the program that runs the [[cicd.job|jobs]], the tasks of the pipeline, not to every engineer.\n\nSuch a pipeline works only under three conditions. First, the state must be remote: the runner starts from a clean copy of the repository every time and has no local `terraform.tfstate`. Second, the repository must hold the dependency lock file, otherwise init in CI may pick a provider version different from yours. Third, apply must apply a [[iac.saved-plan|saved plan]]. The plan job runs `tofu plan -out=plan.tfplan` and hands the plan file on as an artifact, and the apply job runs `tofu apply plan.tfplan`. If someone changed the state between these jobs, apply refuses to work, so only what was shown in the plan is applied.\n\nIn the lab git.lab is the Git server in the tab, and the runner works as a service on the workstation and runs the jobs’ commands in its ordinary shell. gitlab-runner works the same way if you choose the shell executor for it. Pipelines are visible in the cloud panel and at `http://ci.lab/`. The cloud key is in the runner’s environment, and in a real GitLab it would be put into a protected CI/CD variable available only to protected branches.',
      ),
    },
    cloudLab({
      intro: bi('Бакет `tfstate` уже создан. Пайплайн выполняется на этой же рабочей станции, в каталоге `/builds/infra`, и каждый пайплайн идёт здесь около двух минут, потому что OpenTofu работает на учебной машине в этой вкладке. Пока пайплайн идёт, откройте его джобу в разделе «Пайплайны ci.lab» панели облака под терминалом: журнал джобы дописывается по ходу работы и остаётся открытым. Из терминала за пайплайном можно следить командой `ls /var/lib/lab-ci/`.', 'The bucket `tfstate` already exists. The pipeline runs on this same workstation, in `/builds/infra`, and every pipeline takes about two minutes here, because OpenTofu runs on a training machine in this tab. While the pipeline runs, open its job in the “Pipelines on ci.lab” section of the cloud panel under the terminal: the job log grows as the work goes on and stays open. From the terminal you can watch the pipeline with `ls /var/lib/lab-ci/`.'),
      tasks: ciTasks,
      ci: true,
      seed: [{ method: 'POST', path: '/v1/projects/{project}/buckets', body: { name: 'tfstate' } }],
      setup: [
        write('/root/infra-repo/main.tf', CI_TF),
        write('/root/infra-repo/.gitlab-ci.yml', CI_YML),
        write('/root/infra-repo/.gitignore', '.terraform/\n*.tfplan\n'),
        'git config --global user.name "Learner" && git config --global user.email learner@ws.lab && git config --global init.defaultBranch main',
      ],
    }),
    {
      id: 'system',
      kind: 'text',
      step: 'review',
      title: bi('Как части блока складываются в одну систему', 'How the parts of the block add up to one system'),
      body: bi(
        'Теперь части блока можно собрать в одну цепочку и пройти её от правки до работающего сайта. Инженер меняет код инфраструктуры и отправляет его в репозиторий командой `git push`. Git-сервер запускает пайплайн. Ключ облака есть только у раннера, и раннер выполняет в джобе plan команду `tofu plan -out=plan.tfplan`. Для этого OpenTofu читает код, берёт из бакета state и ставит на него блокировку, через провайдер спрашивает API облака, какими ресурсы стали на самом деле, и сохраняет разницу в файл плана. Коллеги читают план в журнале джобы. Если пайплайн идёт по ветке по умолчанию, следом за джобой plan запускается джоба apply и применяет этот самый файл плана, полученный артефактом. Провайдер переводит каждую строку плана в запросы HTTP к API, облако отвечает операциями, и по мере того, как операции заканчиваются, OpenTofu записывает в state новые ID и атрибуты. Машины готовы, но пусты, и дальше их настраивает Ansible: он берёт адреса из инвентаря, который часто собирают из выводов OpenTofu, входит на машины по SSH и приводит пакеты, файлы и службы к описанию из ролей.\n\n```text\ngit push\n→ пайплайн, джоба plan\n→ tofu plan: код + state из бакета + ответы API\n→ план в журнале джобы, его читают коллеги\n→ на ветке по умолчанию джоба apply: tofu apply plan.tfplan\n→ провайдер → запросы к API облака → операции\n→ новые ID и атрибуты в state\n→ Ansible по SSH: роли и переменные инвентаря\n→ пакеты, конфигурация и службы на машинах\n```\n\nУ каждого звена этой цепочки своя память. Код в Git помнит, каким всё должно быть, state в бакете помнит, какие объекты облака принадлежат коду, а само облако знает, как всё обстоит на самом деле. Ansible своей памяти между прогонами не держит и каждый раз заново смотрит на хосты, поэтому для него источником правды служат только роли и инвентарь. Почти каждая поломка в этом блоке оказывалась расхождением двух таких памятей. Дрейф означает, что облако разошлось с кодом. Потерянный state означает, что код и облако перестали узнавать друг друга. Лишняя ВМ после каждого пайплайна означает, что раннер не видел общего state. Когда что-то идёт не так, полезно сначала спросить себя, какие две памяти здесь разошлись.',
        'Now the parts of the block can be put into one chain and followed from an edit to a working site. An engineer changes the infrastructure code and sends it to the repository with `git push`. The Git server starts a pipeline. Only the runner holds the cloud key, and the runner runs `tofu plan -out=plan.tfplan` in the plan job. For that OpenTofu reads the code, takes the state from the bucket and locks it, asks the cloud API through the provider what the resources have really become, and saves the difference into the plan file. Colleagues read the plan in the job log. If the pipeline runs on the default branch, the apply job starts after the plan job and applies that very plan file, received as an artifact. The provider turns every line of the plan into HTTP requests to the API, the cloud answers with operations, and as the operations finish, OpenTofu writes the new IDs and attributes into the state. The machines are ready but empty, and Ansible configures them next: it takes the addresses from the inventory, often built from OpenTofu’s outputs, logs in to the machines over SSH and brings packages, files and services to the description in the roles.\n\n```text\ngit push\n→ pipeline, plan job\n→ tofu plan: code + state from the bucket + API answers\n→ plan in the job log, read by colleagues\n→ on the default branch, apply job: tofu apply plan.tfplan\n→ provider → requests to the cloud API → operations\n→ new IDs and attributes in the state\n→ Ansible over SSH: roles and inventory variables\n→ packages, config and services on the machines\n```\n\nEvery link of this chain has its own memory. The code in Git remembers what everything should be like, the state in the bucket remembers which cloud objects belong to the code, and the cloud itself knows how things really are. Ansible keeps no memory between runs and looks at the hosts afresh every time, so for it only the roles and the inventory are the source of truth. Almost every breakage in this block turned out to be two of these memories disagreeing. Drift means the cloud has drifted from the code. A lost state means the code and the cloud no longer recognise each other. An extra VM after every pipeline means the runner did not see the shared state. When something goes wrong, it helps to ask first which two memories have disagreed here.',
      ),
    },
    {
      id: 'limits',
      kind: 'text',
      step: 'review',
      title: bi('Что код инфраструктуры не отменяет', 'What infrastructure code does not remove'),
      body: bi(
        'Инфраструктура как код делает изменения повторяемыми и видимыми в истории, но сложности самой инфраструктуры она не убирает. Код упирается в те же ограничения, что и кнопки консоли: в квоты облака, в аргументы, которые облако не меняет у работающей машины, и в медленные операции. Провайдер обновляют так же осторожно, как библиотеку в приложении, потому что новая версия может по-другому прочитать тот же код. Поэтому в репозитории хранят файл блокировки провайдеров `.terraform.lock.hcl`, который закрепляет их версии. Наконец, у каждой компании свой набор инструментов: вместо Ansible встречаются Salt, Puppet и Chef, вместо OpenTofu встречаются Pulumi и облачные шаблоны вроде AWS CloudFormation, и в вакансии стоит посмотреть, что в ходу у работодателя. Понятия этого блока переносятся на любой из этих инструментов: желаемое состояние, идемпотентность, план перед изменением, а у тех, что создают ресурсы, ещё и память о том, что уже создано.',
        'Infrastructure as code makes changes repeatable and visible in the history, but it does not remove the complexity of the infrastructure itself. Code runs into the same limits as console buttons: cloud quotas, arguments the cloud does not change on a running machine, and slow operations. A provider is upgraded as carefully as a library in an application, because a new version may read the same code differently. That is why the repository keeps the dependency lock file `.terraform.lock.hcl`, which pins their versions. Finally, every company has its own set of tools: instead of Ansible you meet Salt, Puppet and Chef, instead of OpenTofu you meet Pulumi and cloud templates such as AWS CloudFormation, and in a job posting it is worth looking at what the employer uses. The ideas of this block carry over to any of these tools: the desired state, idempotence, a plan before a change, and for those that create resources, the memory of what has already been created.',
      ),
    },
    {
      id: 'cheatsheet',
      kind: 'text',
      step: 'review',
      title: bi('Шпаргалка по командам OpenTofu и Terraform', 'Cheat sheet of OpenTofu and Terraform commands'),
      body: bi(
        'Команды ниже встретились в уроках о Terraform и OpenTofu. У Terraform они называются так же, только вместо `tofu` пишут `terraform`.\n\n- `tofu init -input=false` готовит каталог к работе: ставит провайдеры и модули, подключает backend и пишет файл `.terraform.lock.hcl`.\n- `tofu plan -out=plan.tfplan` показывает разницу и сохраняет её в файл, а `tofu apply plan.tfplan` применяет этот файл и ничего сверх него.\n- `tofu plan -detailed-exitcode` завершается кодом 2, если разница есть, и годится для ночной проверки дрейфа в CI.\n- `tofu plan -refresh-only` и `tofu apply -refresh-only` показывают и записывают в state ручные правки, не трогая облако.\n- `tofu apply -replace=lab_vm.web` пересоздаёт один ресурс, не меняя кода.\n- `tofu state list` и `tofu state show lab_vm.web` показывают, что записано в state, а `tofu state mv` и `tofu state rm` меняют записи, не трогая облако.\n- `tofu output -raw ip` печатает вывод без кавычек, чтобы подставить его в другую команду.\n- `tofu force-unlock <ID>` снимает блокировку state, но только когда запуск, который её поставил, уже не работает.\n- Блоки `moved` и `import` делают то же, что команды `tofu state mv` и `tofu import`, но кодом, который проходит проверку коллег, а блок `lifecycle` с настройками `create_before_destroy` и `ignore_changes` меняет порядок пересоздания и разрешает ручные правки отдельных аргументов.',
        'The commands below came up in the lessons on Terraform and OpenTofu. Terraform names them the same way, with `terraform` instead of `tofu`.\n\n- `tofu init -input=false` prepares the directory: installs providers and modules, connects the backend and writes `.terraform.lock.hcl`.\n- `tofu plan -out=plan.tfplan` shows the difference and saves it to a file, and `tofu apply plan.tfplan` applies that file and nothing beyond it.\n- `tofu plan -detailed-exitcode` exits with code 2 if there is a difference and suits a nightly drift check in CI.\n- `tofu plan -refresh-only` and `tofu apply -refresh-only` show and record manual edits in the state without touching the cloud.\n- `tofu apply -replace=lab_vm.web` recreates one resource without changing the code.\n- `tofu state list` and `tofu state show lab_vm.web` show what the state records, and `tofu state mv` and `tofu state rm` change records without touching the cloud.\n- `tofu output -raw ip` prints an output without quotes, to put it into another command.\n- `tofu force-unlock <ID>` removes a state lock, but only when the run that took it is no longer working.\n- The blocks `moved` and `import` do what `tofu state mv` and `tofu import` do, but as code that goes through review, and a `lifecycle` block with `create_before_destroy` and `ignore_changes` changes the order of replacement and allows manual edits of chosen arguments.',
      ),
    },
    {
      id: 'interview',
      kind: 'text',
      step: 'review',
      title: bi('Что спрашивают о Terraform на собеседовании', 'What job interviews ask about Terraform'),
      body: bi(
        'Ниже вопросы о Terraform, которые чаще всего задают на собеседовании на должность DevOps-инженера, и то, что должно прозвучать в ответе.\n\n**Чем Terraform отличается от Ansible и как их используют вместе?** Terraform создаёт ресурсы через API облака и помнит их в state. Ansible настраивает уже существующие хосты по SSH и между прогонами ничего не хранит. Обычно сначала Terraform создаёт машины, а потом Ansible их настраивает.\n\n**Что такое state и почему его не хранят в Git?** State связывает адреса из кода с ID объектов в облаке и хранит их последние атрибуты, включая секреты. В Git нет блокировки, поэтому два человека перезапишут state друг друга, а секреты останутся в истории навсегда. State держат в бакете с блокировкой, ограниченным доступом и включёнными версиями объектов, чтобы вернуть прежнюю версию, если файл испортят.\n\n**Что будет, если state потерян?** Облако Terraform не тронет, но следующий plan предложит создать всё заново. State восстанавливают из предыдущей версии объекта в бакете, а если её нет, привязывают ресурсы заново блоками import.\n\n**Что такое дрейф и как его заметить?** Дрейфом называют расхождение облака с кодом после ручной правки. Его ловит plan с ключом `-detailed-exitcode`, который CI запускает по расписанию, а дальше правку отменяют командой apply, записывают в код или разрешают настройкой `ignore_changes`.\n\n**Чем count отличается от for_each?** Аргумент count нумерует экземпляры, и если убрать элемент из середины списка, номера сдвинутся, а план предложит изменить или пересоздать соседние ресурсы. Аргумент for_each даёт экземплярам постоянные ключи, поэтому, если убрать ключ, план удалит только его экземпляр.\n\n**Как переименовать ресурс или перенести его в модуль без пересоздания?** Для этого пишут блок moved, который проходит проверку вместе с кодом и срабатывает в каждом окружении, или выполняют команду `state mv`, которая меняет state сразу и только в одном месте.\n\n**Зачем пайплайну сохранённый план?** С сохранённым планом применяется то, что люди видели в журнале джобы plan, а если state за это время изменился, apply откажется работать.\n\n**Что делать с ошибкой Error acquiring the state lock?** Сначала по сообщению выясняют, чей запуск держит блокировку, и ждут, пока он закончится. Команду `force-unlock` выполняют, только когда этот запуск точно завершился.',
        'Below are the questions about Terraform asked most often in a DevOps job interview, and what the answer must contain.\n\n**How does Terraform differ from Ansible, and how are they used together?** Terraform creates resources through the cloud API and remembers them in the state. Ansible configures hosts that already exist over SSH and keeps nothing between runs. Usually Terraform creates the machines first, and then Ansible configures them.\n\n**What is the state and why is it not kept in Git?** The state links addresses in the code with object IDs in the cloud and keeps their last attributes, secrets included. Git has no locking, so two people overwrite each other’s state, and the secrets stay in the history for ever. The state is kept in a bucket with locking, limited access and object versioning switched on, to bring back an earlier version if the file gets damaged.\n\n**What happens if the state is lost?** Terraform does not touch the cloud, but the next plan proposes to create everything again. The state is restored from an earlier object version in the bucket, and if there is none, the resources are attached again with import blocks.\n\n**What is drift and how do you notice it?** Drift is a mismatch between the cloud and the code after a manual edit. It is caught by a plan with `-detailed-exitcode` that CI runs on a schedule, and then the edit is undone with apply, written into the code, or allowed with `ignore_changes`.\n\n**How does count differ from for_each?** count numbers the instances, and if an element is removed from the middle of the list, the numbers shift and the plan proposes to change or recreate the neighbouring resources. for_each gives instances stable keys, so removing a key destroys only its instance.\n\n**How do you rename a resource or move it into a module without replacement?** Write a moved block, which goes through review with the code and works in every environment, or run `state mv`, which changes the state at once and in one place only.\n\n**Why does a pipeline need a saved plan?** With a saved plan, what gets applied is what people saw in the plan job’s log, and if the state changed meanwhile, apply refuses to work.\n\n**What do you do with Error acquiring the state lock?** First find out from the message whose run holds the lock and wait for it to end. `force-unlock` is run only when that run has surely ended.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['iac.q.saved-plan', 'iac.q.ci-state'] },
  ],
};

export const lessons3 = { apiLesson, tofuLesson, stateLesson, moduleLesson, ciLesson };

// ── quiz ──

export const quiz3: QuizItem[] = [
  {
    id: 'iac.q.http-codes',
    kind: 'match',
    concepts: ['iac.cloud-api', 'iac.access-key'],
    prompt: bi('Сопоставьте каждый ответ API облака с тем, что должна сделать программа, которая его получила.', 'Match each cloud API answer with what the program that received it should do.'),
    pairs: [
      { id: 'c401', left: '401 Unauthenticated', right: bi('передать секрет ключа в заголовке Authorization', 'send the key secret in the Authorization header') },
      { id: 'c409', left: '409 AlreadyExists', right: bi('выбрать другое имя или взять существующий объект', 'choose another name or take the existing object') },
      { id: 'c429', left: '429 QuotaExceeded', right: bi('освободить квоту или подождать и повторить', 'free some quota or wait and retry') },
      { id: 'c202', left: '202 Accepted', right: bi('спрашивать статус операции, пока он не станет DONE', 'ask for the operation status until it becomes DONE') },
    ],
    explain: bi('Код ответа входит в договорённость между API и программой: по нему программа решает, исправлять запрос, ждать или двигаться дальше. Провайдеры Terraform поступают так же.', 'The response code is part of the API contract: from it a program decides whether to fix the request, wait or move on. Terraform providers do exactly that.'),
  },
  {
    id: 'iac.q.async',
    kind: 'mcq',
    concepts: ['iac.operation'],
    prompt: bi('`POST …/vms` вернул `202` и операцию со статусом `PENDING`. Через минуту `GET /v1/operations/<id>` отвечает `{"status": "ERROR", "error": {"code": "QuotaExceeded"}}`. Что произошло с ВМ?', '`POST …/vms` returned `202` and an operation with status `PENDING`. A minute later `GET /v1/operations/<id>` answers `{"status": "ERROR", "error": {"code": "QuotaExceeded"}}`. What happened to the VM?'),
    options: [
      { id: 'failed', text: bi('Машину не создали, ведь код 202 значил «запрос принят», а итог сообщила операция', 'The machine was not created: 202 meant “request accepted”, and the operation reported the outcome'), correct: true },
      { id: 'created', text: bi('Машину создали, ведь облако уже ответило кодом 202, а это код успеха', 'The machine was created, since the cloud already answered 202, and that is a success code'), why: bi('Ответ 202 Accepted обещает заняться запросом, но не сообщает результата. Итог работы показывает статус операции.', '202 Accepted is a promise to work on the request, not a result. The outcome is the operation status.') },
      { id: 'retry', text: bi('Машина появится позже, потому что облако само повторит попытку, когда освободится квота', 'The machine appears later: the cloud retries by itself when quota frees up'), why: bi('Операция в статусе ERROR закончена. Повторить попытку должен клиент, отправив новый запрос, когда причина устранена.', 'An operation in ERROR is over. Retrying is the client’s job, with a new request once the cause is fixed.') },
    ],
    explain: bi('Асинхронный API отделяет ответ «запрос принят» от ответа «работа сделана». Клиент, который не дождался конца операции, не знает, появился ли ресурс.', 'A long-running API separates “accepted” from “done”. A client that did not wait for the operation does not know whether the resource exists.'),
  },
  {
    id: 'iac.q.replace',
    kind: 'mcq',
    concepts: ['iac.replace'],
    prompt: bi('В плане у ВМ стоит `-/+` и `# forces replacement` рядом с `user_data`. Что произойдёт при apply?', 'The plan shows `-/+` for a VM and `# forces replacement` next to `user_data`. What happens on apply?'),
    options: [
      { id: 'new', text: bi('Вместо старой ВМ создадут новую, с новым ID и пустым диском, и скрипт выполнится на ней', 'A new VM with a new ID and an empty disk replaces the old one, and the script runs on it'), correct: true },
      { id: 'rerun', text: bi('Провайдер передаст новый скрипт работающей ВМ, и она выполнит его без перезагрузки', 'The provider hands the new script to the running VM, and it runs it without a reboot'), why: bi('Скрипт user data выполняется только при первой загрузке, и поменять его у работающей машины нельзя, поэтому машину пересоздают.', 'User data runs only at the first boot; it cannot be changed on a live machine, so the machine is recreated.') },
      { id: 'nothing', text: bi('С машиной ничего не случится, потому что user_data записывается только в state', 'Nothing happens to the machine, because user_data is written only into the state'), why: bi('Аргумент user_data принадлежит ресурсу в облаке, а не хранится заметкой в state, и план ясно говорит, что ВМ будет заменена.', 'user_data is an argument of the cloud resource, not a note in the state. The plan says clearly that the VM will be replaced.') },
    ],
    explain: bi('Знак `-/+` у машины с данными должен заставить вас остановиться, потому что данные с её диска сами на новую машину не перенесутся. Иногда пересоздание и нужно, но решение принимают, прочитав план.', 'A `-/+` on a machine with data is a reason to stop: the data on its disk will not move by itself. Sometimes that is right, but the decision is made after reading the plan.'),
  },
  {
    id: 'iac.q.lock',
    kind: 'multi',
    concepts: ['iac.lock-file'],
    prompt: bi('Что верно про `.terraform.lock.hcl`? Отметьте все.', 'What is true about `.terraform.lock.hcl`? Mark all.'),
    options: [
      { id: 'commit', text: bi('Его сохраняют в репозитории вместе с кодом', 'It is kept in the repository together with the code'), correct: true },
      { id: 'hash', text: bi('В нём записаны версии провайдеров и их контрольные суммы', 'It holds the provider versions and their checksums'), correct: true },
      { id: 'state', text: bi('В нём хранится state', 'It holds the state'), why: bi('State хранится отдельным файлом или объектом в backend, а файл блокировки содержит сведения только о провайдерах.', 'The state is a separate file or a backend object. The lock file knows only about providers.') },
      { id: 'ignore', text: bi('Его добавляют в .gitignore, как и каталог .terraform', 'It goes into .gitignore, like the .terraform directory'), why: bi('Каталог `.terraform` служит кэшем, и его не коммитят. С файлом блокировки всё наоборот: без него у разных людей может оказаться разная версия провайдера.', 'The `.terraform` directory is a cache and is not committed. The lock file is the opposite: without it everyone may end up with a different provider version.') },
    ],
    explain: bi('Файл блокировки делает init воспроизводимым: на ноутбуке, у коллеги и в CI ставится одна и та же сборка провайдера.', 'The lock file makes init reproducible: the laptop, the colleague and CI install the same provider build.'),
  },
  {
    id: 'iac.q.remote-why',
    kind: 'mcq',
    concepts: ['iac.remote-state'],
    prompt: bi('Коллега скачал себе копию репозитория с кодом, который вы применили со своим локальным state, и запустил `tofu plan`. Что он увидит?', 'A colleague cloned the repository with code you applied with your local state and ran `tofu plan`. What will they see?'),
    options: [
      { id: 'create', text: bi('План создать всё заново, потому что ваш файл state остался у вас на ноутбуке', 'A plan to create everything again, because your state file stayed on your laptop'), correct: true },
      { id: 'nochanges', text: bi('No changes, потому что код у коллеги тот же самый, что и у вас', 'No changes, because the colleague has the very same code as you'), why: bi('План сравнивает код со state. Без вашего state OpenTofu не знает ID ресурсов и считает, что их нет.', 'The plan compares the code with the state. Without your state OpenTofu does not know the resource IDs and assumes they do not exist.') },
      { id: 'import', text: bi('No changes, потому что OpenTofu найдёт ваши ресурсы в облаке по именам', 'No changes, because OpenTofu finds your resources in the cloud by name'), why: bi('Сам OpenTofu ничего в облаке не ищет. Связь кода с облаком хранится в state, а находить объекты, созданные без него, помогает import.', 'It searches for nothing by itself. The link between code and cloud is in the state, and finding other objects is the job of import.') },
    ],
    explain: bi('Удалённый state делает сведения о том, что уже создано, общими для всей команды и для CI.', 'Remote state makes “what already exists” shared knowledge of the team and CI.'),
  },
  {
    id: 'iac.q.lock-error',
    kind: 'mcq',
    concepts: ['iac.state-lock'],
    prompt: bi('Вы запускаете apply и получаете `Error acquiring the state lock`, а в подробностях сообщения указаны имя коллеги и время пять минут назад. Что сделать сначала?', 'You run apply and get `Error acquiring the state lock`, with a colleague and a time five minutes ago in the details. What do you do first?'),
    options: [
      { id: 'ask', text: bi('Спросить коллегу, идёт ли у него apply, и дождаться конца', 'Ask the colleague whether their apply is running, and wait for it to end'), correct: true },
      { id: 'force', text: bi('Сразу выполнить `tofu force-unlock`', 'Run `tofu force-unlock` right away'), why: bi('Команда force-unlock снимает чужую блокировку. Если чужой apply ещё идёт, два процесса запишут state поверх друг друга, а блокировка и нужна, чтобы этого не случилось.', 'force-unlock removes someone else’s lock. If their apply is still running, two processes write the state over each other, which is exactly what the lock protects against.') },
      { id: 'local', text: bi('Переключиться на локальный state и применить', 'Switch to a local state and apply'), why: bi('Тогда в облаке появятся изменения, о которых общий state не знает, то есть вы сами создадите дрейф.', 'Then the cloud gets changes the shared state does not know about: that is drift by design.') },
    ],
    explain: bi('Блокировку снимают вручную, только когда уверены, что запуск, который её поставил, уже не работает, например джоба CI завершилась с ошибкой или ноутбук закрыли, и обычно после того, как спросили коллегу.', 'A lock is removed by hand only when you are sure the run that took it is no longer working, for example a CI job crashed or a laptop was closed, and usually after asking the colleague.'),
  },
  {
    id: 'iac.q.foreach-count',
    kind: 'mcq',
    concepts: ['iac.for-each'],
    prompt: bi('Три ВМ создаются с `count = length(var.names)` по списку `["a", "b", "c"]`. Из списка убирают элемент «a». Что покажет план?', 'Three VMs are created by `count = length(var.names)` from the list `["a", "b", "c"]`. "a" is removed from the list. What does the plan show?'),
    options: [
      { id: 'shift', text: bi('План переименует экземпляры [0] и [1] в b и c и удалит экземпляр [2]', 'The plan renames the instances [0] and [1] to b and c and destroys the instance [2]'), correct: true },
      { id: 'one', text: bi('План удалит одну ВМ «a», а машины b и c оставит как были', 'The plan destroys the one VM “a” and leaves the machines b and c as they were'), why: bi('Так было бы с for_each по множеству, а у count адресом служит номер, и номера сдвигаются.', 'That is what for_each over a set would do. With count the address is a number, and the numbers shift.') },
      { id: 'all', text: bi('План пересоздаст все три машины, потому что список целиком стал другим', 'The plan recreates all three machines, because the list as a whole has changed'), why: bi('Terraform сравнивает экземпляры по одному. Экземпляры [0] и [1] остались на своих адресах и только сменили имя, а лишним оказался один экземпляр [2].', 'Terraform compares instances one by one. The instances [0] and [1] stayed at their addresses and only changed their names, and the one extra instance is [2].') },
    ],
    explain: bi('Ключи for_each дают экземплярам постоянные адреса. Аргумент count подходит для нескольких одинаковых объектов, а не для объектов с именами.', 'for_each keys are stable addresses. count suits “N identical things”, not named objects.'),
  },
  {
    id: 'iac.q.saved-plan',
    kind: 'mcq',
    concepts: ['iac.saved-plan'],
    prompt: bi('Зачем джобе apply сохранённый план из артефакта, если она могла бы выполнить `tofu apply -auto-approve`?', 'Why does the apply job need the saved plan from the artifact if it could run `tofu apply -auto-approve`?'),
    options: [
      { id: 'exact', text: bi('Применится то, что люди видели в плане, а если state успел измениться, apply откажется', 'What people saw in the plan gets applied, and if the state changed meanwhile, apply refuses'), correct: true },
      { id: 'fast', text: bi('Так быстрее, потому что с сохранённым планом джобе apply не нужен tofu init', 'It is faster, because with a saved plan the apply job needs no tofu init'), why: bi('init нужен и для сохранённого плана, потому что провайдеры устанавливаются в каждой джобе заново.', 'init is needed for a saved plan too: providers are installed in every job.') },
      { id: 'secret', text: bi('Так безопаснее, потому что с сохранённым планом джобе apply не нужен ключ облака', 'It is safer, because with a saved plan the apply job needs no cloud key'), why: bi('Джоба apply обращается к API облака, и ключ ей нужен в любом случае.', 'apply calls the cloud API and needs the key either way.') },
    ],
    explain: bi('С ключом `-auto-approve` apply строит новый план перед самым применением, и этот план может отличаться от того, что видели люди.', '`-auto-approve` builds a new plan right before applying, and it may differ from what people saw.'),
  },
  {
    id: 'iac.q.ci-state',
    kind: 'mcq',
    concepts: ['iac.remote-state', 'cicd.runner'],
    prompt: bi('Пайплайн с `tofu apply` проходит успешно, но каждый запуск создаёт ещё одну ВМ с тем же кодом. Почему?', 'A pipeline with `tofu apply` succeeds, but every run creates one more VM from the same code. Why?'),
    options: [
      { id: 'local', text: bi('State хранится локально и пропадает вместе с рабочим каталогом раннера после каждой джобы', 'The state is local and disappears with the runner’s working directory after every job'), correct: true },
      { id: 'lock', text: bi('В репозитории нет файла блокировки провайдеров, и каждый init ставит провайдер заново', 'The repository has no dependency lock file, and every init installs the provider anew'), why: bi('Без него может поменяться версия провайдера, но связь кода с облаком хранит state, а не файл блокировки.', 'Without it the provider version may change, but the link between code and cloud is kept by the state, not by the lock file.') },
      { id: 'rules', text: bi('Джоба apply запускается на всех ветках, и каждая ветка создаёт свою копию ВМ', 'The apply job runs on every branch, and every branch creates its own copy of the VM'), why: bi('Это опасно, но дубли появляются и на одной ветке, потому что после каждого запуска state пропадает вместе с рабочим каталогом раннера.', 'That is dangerous, but duplicates appear even on one branch, because of the lost state.') },
    ],
    explain: bi('Без удалённого state управлять инфраструктурой из CI нельзя.', 'Remote state is a precondition of IaC in CI.'),
  },
];


// ── the in-tab exam ──

const EXAM_STATE = 'exam/terraform.tfstate';

export const cloudExam: Exam = {
  id: 'iac.exam.cloud',
  block: 'iac',
  title: bi('Новый сервис с нуля в облаке, которое работает во вкладке', 'A new service from scratch in a cloud that runs in the tab'),
  story: bi(
    'Команде кафе нужен сервер для нового API. Руководитель команды оставил три карточки с задачами: создать машину из кода и хранить её state в общем бакете, взять под управление DNS-запись, которую сделали вручную при запуске, и настроить пайплайн, чтобы дальше инфраструктуру меняли только через репозиторий.',
    'The café team needs a server for a new API. The team lead left three task cards: create a machine from code with its state in the shared bucket, take over the DNS record made by hand at the launch, and set up a pipeline so that from now on infrastructure changes only through the repository.',
  ),
  intro: bi(
    'Экзамен проходит на настоящих машинах в этой вкладке: на рабочей станции с OpenTofu, в облаке `api.cloud.lab`, на git.lab и ci.lab. Цели проверяются по состоянию облака, хранилища и самих ВМ. Открыты только документация OpenTofu и справка команд, а подсказок и наставника нет. Вкладке понадобится около 2 ГБ свободной памяти.',
    'An exam on real machines in this tab: a workstation with OpenTofu, the cloud `api.cloud.lab`, git.lab and ci.lab. Goals are judged by the state of the cloud, the storage and the VMs themselves. Only the OpenTofu documentation and the command help are open; no hints, no mentor. The tab needs about 2 GB of spare memory.',
  ),
  minutes: 75,
  pass: 0.7,
  allowedDocs: ['help', 'man', 'terraform'],
  inTab: {
    widget: 'iac.cloudlab',
    props: {
      intro: bi('Бакет `tfstate` и ключ доступа уже есть, ключ SSH лежит в `~/.ssh`.', 'The bucket `tfstate` and the access key already exist; an SSH key is in `~/.ssh`.'),
      ci: true,
      vmScopes: ['listen'],
      seed: [
        { method: 'POST', path: '/v1/projects/{project}/buckets', body: { name: 'tfstate' } },
        { method: 'POST', path: '/v1/projects/{project}/dns/zones', body: { name: 'cafe.lab' } },
        { method: 'POST', path: '/v1/projects/{project}/dns/zones/cafe.lab/records', body: { name: 'api', type: 'A', values: ['10.0.0.77'] } },
      ],
      setup: [KEYGEN, 'git config --global user.name "Learner" && git config --global user.email learner@ws.lab && git config --global init.defaultBranch main'],
    } satisfies CloudLabProps,
  },
  tasks: [
    {
      id: 'vm',
      weight: 3,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi('«Создайте из кода в каталоге `~/svc` ВМ `api-1` размера lab.small и храните её state в бакете `tfstate` под ключом `exam/terraform.tfstate`. На порту 80 у машины должен отвечать nginx, а зайти на неё по SSH должно быть можно вашим ключом».', '“A VM `api-1` of size lab.small from code in `~/svc`, with the state in the bucket `tfstate` under the key `exam/terraform.tfstate`. nginx must answer on its port 80, and your key must let you in over SSH.”'),
        concepts: ['iac.remote-state', 'iac.replace'],
        goals: [
          { id: 'running', label: bi('`api-1` работает, и на ней установлен ваш ключ SSH', '`api-1` is running, and your SSH key is installed on it'), on: 'cloud', check: { when: (f) => vm(f, 'api-1')?.status === 'RUNNING' && vm(f, 'api-1')?.flavor === 'lab.small' && (vm(f, 'api-1')?.keys ?? 0) > 0 } },
          { id: 'state', label: bi('state в `tfstate/exam/terraform.tfstate` содержит `api-1`', 'the state in `tfstate/exam/terraform.tfstate` knows `api-1`'), on: 'cloud', check: { when: (f) => (stateAt(f, EXAM_STATE)?.resources ?? []).some((r) => r.type === 'lab_vm' && r.attrs.name === 'api-1') } },
          { id: 'http', label: bi('на `api-1` порт 80 принимает соединения', 'port 80 listens on `api-1`'), on: 'api-1', check: { when: 'listen[port=80]' } },
        ],
      },
    },
    {
      id: 'adopt',
      weight: 2,
      kind: 'real',
      real: {
        prompt: bi('«Запись `api.cafe.lab` сделали вручную при запуске. Пусть ею управляет тот же код, а значением записи станет адрес `api-1`. Пересоздавать запись нельзя».', '“The record `api.cafe.lab` was made by hand at the launch. Let the same code manage it, with the address of `api-1` as its value. Do not recreate the record.”'),
        concepts: ['iac.import'],
        goals: [
          {
            id: 'imported',
            label: bi('запись есть в state и не пересоздана', 'the record is in the state and was not recreated'),
            on: 'cloud',
            check: { when: (f) => { const r = lf(f).cloud?.records.find((x) => x.fqdn === 'api.cafe.lab'); return !!r && (stateAt(f, EXAM_STATE)?.resources ?? []).some((x) => x.type === 'lab_dns_record' && x.id === r.id) && !(lf(f).cloud?.requests ?? []).some((q) => q.from === WS && q.method === 'POST' && /\/records/.test(q.path) && q.status < 300); } },
          },
          { id: 'value', label: bi('`api.cafe.lab` указывает на `api-1`', '`api.cafe.lab` points at `api-1`'), on: 'cloud', check: { when: (f) => { const ip = vm(f, 'api-1')?.ip; return !!ip && !!lf(f).cloud?.records.find((x) => x.fqdn === 'api.cafe.lab')?.values.includes(ip); } } },
        ],
      },
    },
    {
      id: 'pipeline',
      weight: 3,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi('«Отправьте код в репозиторий `http://git.lab/svc.git`, в ветку `main`. Пайплайн должен состоять из двух стадий: план строится на каждой ветке, а сохранённый план применяется только на `main`. Последний пайплайн ветки `main` должен пройти успешно».', '“The code goes to the repository `http://git.lab/svc.git`, branch `main`. A two-stage pipeline: a plan on every branch, applying the saved plan only on `main`. The last `main` pipeline is green.”'),
        concepts: ['iac.saved-plan', 'cicd.rules'],
        goals: [
          { id: 'repo', label: bi('в репозитории `svc` есть файл блокировки провайдеров', 'the repository `svc` with the dependency lock file'), on: 'cloud', check: { when: (f) => (lf(f).git?.repos ?? []).some((r) => r.name === 'svc' && r.files.includes('.terraform.lock.hcl') && r.files.includes('.gitlab-ci.yml')) } },
          { id: 'green', label: bi('последний пайплайн `main` прошёл, и в нём была джоба apply', 'the last `main` pipeline passed, with an apply in it'), on: 'cloud', check: { when: (f) => { const p = pipes(f, 'svc').filter((x) => x.ref === 'main').at(-1); return !!p && p.status === 'success' && p.jobs.some((j) => /apply/.test(j.name) && j.status === 'success') && p.jobs.some((j) => /plan/.test(j.name) && j.status === 'success'); } } },
          { id: 'saved', label: bi('apply применяет файл плана, а не строит новый', 'apply applies a plan file instead of building a new one'), on: 'cloud', check: { when: (f) => pipes(f, 'svc').some((p) => p.jobs.some((j) => /apply/.test(j.name) && j.status === 'success' && /Apply complete/.test(j.log) && /\$ (tofu|terraform) apply[^\n]*\.tfplan/.test(j.log))) } },
        ],
      },
    },
    { id: 'q-lock', weight: 1, kind: 'quiz', item: { ...(quiz3.find((q) => q.id === 'iac.q.lock-error') as QuizItem), id: 'iac.exam.cloud.q.lock' } },
  ],
  explain: [
    { id: 'ci-state', prompt: bi('«Почему в CI нельзя держать state в каталоге проекта?»', '“Why can the state not live in the project directory in CI?”'), keyPoints: [bi('раннер начинает с чистой копии репозитория', 'the runner starts from a clean clone'), bi('без state OpenTofu не знает ID и создаёт всё заново', 'without the state OpenTofu does not know the IDs and creates everything anew'), bi('удалённый state с блокировкой становится общим для людей и CI', 'remote state with locking becomes shared by people and CI')] },
    { id: 'async', prompt: bi('«Что делает провайдер, пока apply печатает Still creating...?»', '“What does the provider do while apply prints Still creating...?”'), keyPoints: [bi('облако ответило кодом 202 и прислало операцию', 'the cloud answered 202 with an operation'), bi('провайдер опрашивает статус операции', 'the provider polls the operation status'), bi('статус ERROR у операции превращается в ошибку apply, а ресурс помечается как tainted, то есть как подлежащий пересозданию', 'an ERROR of the operation becomes an apply error, and the resource is marked tainted, that is due for replacement')] },
  ],
};
