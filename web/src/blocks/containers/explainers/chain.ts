// X1 (04 §6.2): `docker run -d -p 8080:80 --memory 64m nginx` from the
// command to the process: docker CLI → dockerd → containerd → shim → runc →
// the kernel → nginx. Who calls whom, and who stays alive.
//
// Reading order: at the start only the terminal with the typed command is on
// the diagram. Each program of the chain appears when the one before it calls
// it, says in a callout what it does and passes on a labelled card: the HTTP
// request, the snapshot, the task, the bundle, the system call. At the end
// the CLI goes pale and the programs that stay alive are lit.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { startWith } from './util';

type P = { local: boolean; publish: boolean; network: string; memory: number };

const dd = (path: string, label: string) => ({ url: `https://docs.docker.com/${path}`, label });
const ALL = ['cli', 'dockerd', 'containerd', 'shim', 'runc', 'nginx', 'image', 'kernel', 'e-api', 'e-img', 'e-snap', 'e-task', 'e-runc', 'e-clone', 'e-exec', 'e-parent'];
const RUN = bi('Что указано в команде docker run', 'What the docker run command says');

export const chainModel = defineModel<P>({
  id: 'containers.chain',
  frame: 'visible',
  block: 'containers',
  title: bi('Что происходит после docker run', 'docker run: from the command to the process'),
  summary: bi(
    'Вы набрали `docker run -d -p 8080:80 --memory 64m nginx`. Схема показывает, какие программы по очереди передают друг другу эту просьбу, пока ядро не создаст процесс nginx, и какие из них остаются работать, когда команда уже вернула вам приглашение.',
    'You typed `docker run -d -p 8080:80 --memory 64m nginx`. The diagram shows which programs pass the request on to each other until the kernel creates the nginx process, and which of them stay alive after the command has returned.',
  ),
  intro: bi(
    'Сейчас на схеме только терминал с набранной командой. Нажмите «Начать с первого шага», а дальше переходите от шага к шагу кнопкой «Шаг вперёд». Каждая следующая программа появляется, когда её вызывает предыдущая; облачко рядом с ней говорит, что она делает, а карточка на линии показывает, что она передаёт дальше. Внизу во всю ширину лежит ядро Linux, которое в итоге и делает контейнер контейнером.\n\nПосле первого прохода уберите в «Параметрах» флажок «Образ nginx уже скачан на эту машину» и посмотрите на время запуска, а потом включите поломки в блоке «Сломать».',
    'Now the diagram shows only the terminal with the typed command. Press “Start from the first step”, then go on with “Step forward”. Each program appears when the previous one calls it; the callout next to it says what it does, and the card on the line shows what it passes on. The Linux kernel lies along the bottom: in the end it does everything that makes a container a container.\n\nAfter the first pass untick “The nginx image is already here” in “Parameters” and watch the start time, then switch on the breaks in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: bi('программа, которая работает сейчас', 'the program working now') },
    { mark: 'say', text: bi('что делает эта программа', 'what this program does') },
    { mark: 'token', text: bi('что программа передаёт следующей, например запрос, задачу или системный вызов', 'what the program passes on, such as a request, a task or a system call') },
    { mark: 'icon:terminal', text: bi('ваш терминал и клиент docker', 'your terminal and the docker client') },
    { mark: 'icon:process', text: bi('программа Docker на хосте', 'a Docker program on the host') },
    { mark: 'icon:disk', text: bi('образ на диске', 'the image on disk') },
    { mark: 'icon:container', text: bi('процесс контейнера', 'the container process') },
    { mark: 'ok', text: bi('шаг выполнен', 'step done') },
    { mark: 'err', text: bi('здесь запуск остановился', 'the start stopped here') },
    { mark: 'pale', text: bi('программа уже завершилась', 'the program has already exited') },
  ],
  stopLabel: bi('Запуск остановился', 'The start stopped'),
  concepts: ['docker.runtime', 'docker.bundle'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      { id: 'cli', label: 'docker', icon: 'terminal', sub: 'CLI', family: 'user', x: 24, y: 40, w: 136, h: 56, card: { what: bi('Клиент Docker сам ничего не запускает, а превращает команду в HTTP-запрос к демону и печатает ответ.', 'The client. It starts nothing itself: it turns the command into an HTTP request to the daemon and prints the answer.'), who: bi('Его запускаете вы в терминале.', 'You, in the terminal.'), see: 'docker version', doc: { page: 'help/docker-run' } } },
      { id: 'dockerd', label: 'dockerd', icon: 'process', family: 'cp', x: 400, y: 40, w: 150, h: 56, card: { what: bi('Демон Docker принимает запросы к API, знает об образах, сетях и томах и раздаёт работу службе containerd.', 'The Docker daemon: takes API requests, knows images, networks and volumes, and hands work to containerd.'), who: bi('Его запускает systemd при старте машины (служба docker.service).', 'systemd starts it at boot (docker.service).'), see: 'systemctl status docker' } },
      { id: 'containerd', label: 'containerd', icon: 'process', family: 'cp', x: 780, y: 40, w: 150, h: 56, card: { what: bi('Этот демон хранит снимки файловых систем (snapshots) и запускает задачи, то есть процессы контейнеров, через shim.', 'The daemon that keeps file-system snapshots and runs tasks — container processes — through a shim.'), who: bi('Его запускает systemd (служба containerd.service).', 'systemd (containerd.service).'), see: 'ctr -n moby tasks ls', doc: { url: 'https://containerd.io/docs/', label: 'containerd docs' } } },
      { id: 'shim', label: 'shim', icon: 'process', sub: 'containerd-shim-runc-v2', family: 'process', x: 767, y: 168, w: 176, h: 56, card: { what: bi('Этот маленький процесс-посредник запускается по одному на каждый контейнер. Он держит стандартные ввод и вывод контейнера, ждёт его кода выхода и остаётся родителем его процесса. Благодаря shim можно перезапустить containerd, не останавливая контейнер.', 'A small go-between process for each container: holds stdin/stdout, waits for the exit code and stays the parent of the container process. Thanks to it containerd can restart without killing the container.'), who: bi('containerd запускает по одному shim на каждую задачу.', 'containerd starts one per task.'), see: 'ps -ef --forest' } },
      { id: 'runc', label: 'runc', icon: 'process', sub: 'OCI runtime', family: 'process', x: 780, y: 296, w: 150, h: 56, card: { what: bi('Рантайм по стандарту OCI читает файл `config.json` из бандла, просит ядро создать пространства имён и cgroup, меняет корень процесса, запускает в нём программу контейнера и завершается.', 'The OCI runtime: reads the bundle’s config.json, asks the kernel for namespaces and a cgroup, does pivot_root and execve — and exits.'), who: bi('shim вызывает его командами `runc create` и `runc start`.', 'The shim calls it with `runc create` and `runc start`.'), doc: { url: 'https://github.com/opencontainers/runtime-spec/blob/main/runtime.md', label: 'runtime-spec › runtime.md' } } },
      { id: 'image', label: bi('Образ на диске', 'Image on disk'), icon: 'disk', sub: 'nginx:1.30-alpine', family: 'store', x: 395, y: 168, w: 160, h: 56, card: { what: bi('Слои образа лежат в хранилище containerd. Если образа на машине нет, демон сначала скачивает его из реестра.', 'The image layers in containerd’s store. If the image is missing, the daemon downloads it from a registry first.'), who: bi('Образ приносит команда `docker pull` или сам `docker run`.', '`docker pull`, or `docker run` itself.'), see: 'docker images' } },
      { id: 'nginx', label: 'nginx', icon: 'container', sub: 'PID 1 · 4123', family: 'process', x: 360, y: 296, w: 160, h: 56, card: { what: bi('Внутри своего пространства имён PID процесс контейнера работает первым, с номером 1, а на хосте он остаётся обычным процессом с другим номером и дочерним процессом shim.', 'The container process. Inside its pid namespace it is PID 1; on the host it is an ordinary process with another number, a child of the shim.'), who: bi('Его запускает runc системным вызовом execve.', 'runc, through execve.'), see: 'docker top web' } },
      { id: 'kernel', label: bi('Ядро Linux', 'Linux kernel'), sub: 'namespaces · cgroup · mount · netfilter', family: 'kernel', shape: 'bar', x: 24, y: 424, w: 919, h: 72, card: { what: bi('Всё, что делает контейнер контейнером, выполняет ядро: создаёт пространства имён, задаёт лимиты cgroup, монтирует overlay с файлами контейнера и добавляет правила netfilter для `-p`.', 'Everything that makes a container a container is done by the kernel: new namespaces (clone), cgroup limits, the overlay mount, netfilter rules for `-p`.'), who: bi('Ядро одно на всю машину.', 'One per machine.'), see: 'uname -r' } },
    ],
    edges: [
      { id: 'e-api', from: 'cli', to: 'dockerd', label: 'HTTP API', card: { what: bi('Клиент отправляет HTTP-запрос через сокет `/var/run/docker.sock`, и в теле запроса указаны образ, проброс портов и лимит памяти в полях Image, HostConfig.PortBindings и HostConfig.Memory=67108864.', 'An HTTP request through the /var/run/docker.sock socket. In the body: Image, HostConfig.PortBindings, HostConfig.Memory=67108864.'), who: bi('Запрос отправляет клиент docker.', 'The docker CLI.'), doc: dd('reference/api/engine/', 'Docker Engine API') } },
      { id: 'e-img', from: 'dockerd', to: 'image', label: bi('поиск образа', 'image lookup'), card: { what: bi('Демон ищет образ на машине, а если не находит, скачивает его из реестра.', 'The daemon looks for the image locally; if absent, it pulls it from a registry.'), who: bi('Образ ищет и при необходимости скачивает демон dockerd.', 'dockerd.') } },
      { id: 'e-snap', from: 'dockerd', to: 'containerd', label: 'snapshot', card: { what: bi('containerd готовит снимок файловой системы, в котором слои образа лежат снизу, а пустой записываемый слой сверху. Из этого получится корень контейнера.', 'containerd prepares a snapshot: image layers below, an empty writable layer on top — the future root of the container.'), who: bi('Снимок у containerd заказывает dockerd по протоколу gRPC.', 'dockerd over gRPC.') } },
      { id: 'e-task', from: 'containerd', to: 'shim', label: 'task', card: { what: bi('Для новой задачи containerd запускает shim. Shim переживёт и runc, и даже перезапуск самого containerd.', 'For the task containerd starts a shim — it will outlive runc and even a restart of containerd itself.'), who: bi('Shim запускает containerd, по одному на каждый контейнер.', 'containerd.') } },
      { id: 'e-runc', from: 'shim', to: 'runc', label: 'runc create', card: { what: bi('shim вызывает рантайм и передаёт ему бандл, то есть каталог с файлами контейнера и `config.json`.', 'The shim calls the runtime on the bundle (rootfs + config.json).'), who: bi('Рантайм runc вызывает shim.', 'The shim.') } },
      { id: 'e-clone', from: 'runc', to: 'kernel', via: [[855, 422]], label: bi('системные вызовы', 'system calls'), labelAt: 0.3, card: { what: bi('runc просит ядро создать новые пространства имён pid, mnt, net, uts, ipc и cgroup, задать лимит memory.max и сменить корень процесса.', 'runc asks the kernel for new pid, mnt, net, uts, ipc and cgroup namespaces, a memory.max limit and a change of root.'), who: bi('Эти системные вызовы делает runc.', 'runc.'), doc: { url: 'https://man7.org/linux/man-pages/man2/clone.2.html', label: 'clone(2)' } } },
      { id: 'e-exec', from: 'runc', to: 'nginx', label: 'execve', card: { what: bi('Последним действием runc заменяет себя программой контейнера. После этого runc больше нет, а процесс остаётся дочерним процессом shim.', 'runc’s last step: replace itself with the container program. Then runc exits and the process stays a child of the shim.'), who: bi('Вызов execve делает сам runc, и на этом его работа заканчивается.', 'runc.') } },
      { id: 'e-parent', from: 'shim', to: 'nginx', via: [[640, 196], [640, 268], [440, 268]], label: bi('родитель', 'parent'), card: { what: bi('shim остаётся родителем процесса контейнера. Он держит его stdout и stderr, откуда берёт строки `docker logs`, и узнаёт код выхода.', 'The shim is the parent: it holds the process’s stdout/stderr (that is where `docker logs` comes from) and learns the exit code.'), who: bi('Процесс достаётся shim: когда runc завершается, ядро передаёт его дочерний процесс shim, потому что shim заранее попросил об этом ядро.', 'The shim.') } },
    ],
  },
  params: [
    {
      id: 'local',
      label: bi('Образ nginx уже скачан на эту машину', 'The image is already here'),
      kind: 'toggle',
      default: true,
      near: 'image',
      group: bi('Что уже есть на машине', 'What the machine already has'),
      predict: {
        prompt: bi('Образа nginx на машине нет, а реестр доступен. Что произойдёт после `docker run`?', 'The image is not here, and the registry is reachable. What happens after `docker run`?'),
        options: [
          { id: 'pull', text: bi('Демон сначала скачает слои образа, и запуск займёт заметно больше времени', 'The daemon downloads layers first: the start takes much longer') },
          { id: 'fail', text: bi('Команда docker run завершится ошибкой', 'docker run fails') },
        ],
        resolve: (_p, n) => ((n[n.length - 1]?.metrics?.total ?? 0) > 2000 ? 'pull' : 'fail'),
      },
    },
    { id: 'publish', label: bi('Опубликовать порт: -p 8080:80', 'Publish the port: -p 8080:80'), kind: 'toggle', default: true, near: 'kernel', group: RUN },
    { id: 'network', label: bi('Сеть контейнера (--network)', 'Container network'), kind: 'choice', default: 'bridge', options: [{ id: 'bridge', label: bi('bridge, сеть по умолчанию', 'bridge (default)') }, { id: 'host', label: bi('host, сеть самого хоста', 'host — the host’s network') }, { id: 'none', label: bi('none, только интерфейс lo', 'none — lo only') }], near: 'kernel', group: RUN },
    { id: 'memory', label: bi('Лимит памяти --memory, МиБ (0 значит без лимита)', '--memory, MiB (0 — no limit)'), kind: 'range', min: 0, max: 512, step: 16, default: 64, near: 'kernel', group: RUN },
  ],
  breaks: [
    {
      id: 'no-containerd',
      label: bi('Служба containerd не запущена', 'containerd is not running'),
      remove: ['containerd', 'e-snap', 'e-task'],
      boundary: 'process',
      predict: {
        prompt: bi('Служба containerd остановлена, а dockerd работает. На каком шаге запуск остановится?', 'containerd is stopped while dockerd runs. At which step does the start stop?'),
        options: [
          { id: 'snap', text: bi('Когда dockerd попросит подготовить снимок файловой системы, потому что просить будет некого', 'At preparing the snapshot: dockerd cannot reach anyone') },
          { id: 'end', text: bi('Контейнер запустится, а сломается позже', 'The container starts and breaks later') },
        ],
        resolve: () => 'snap',
      },
    },
    {
      id: 'port-busy',
      label: bi('Порт 8080 на хосте уже занят другой программой', 'Port 8080 is already taken'),
      remove: ['e-clone'],
      boundary: 'network',
      predict: {
        prompt: bi('Порт 8080 на хосте уже слушает другая программа, а в команде есть `-p 8080:80`. Что ответит docker run?', 'Another program already listens on host port 8080, and the command has `-p 8080:80`. What does docker run answer?'),
        options: [
          { id: 'err', text: bi('Сообщит об ошибке, и контейнер останется в состоянии Created', 'An error, and the container stays Created') },
          { id: 'other', text: bi('Сам выберет другой свободный порт', 'It picks another port by itself') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken) ? 'err' : 'other'),
      },
    },
  ],
  metrics: [{ id: 'total', label: bi('сколько времени прошло с начала запуска', 'time since the start began'), unit: { ru: 'мс', en: 'ms' } }],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    let t = 0;
    const mem = p.memory ? String(p.memory * 1024 * 1024) : 'max';
    steps.push({
      id: 'typed',
      label: bi('команда', 'command'),
      caption: bi('Вы набрали в терминале `docker run -d -p 8080:80 --memory 64m nginx` и нажали Enter. Первым начинает работать клиент docker.', 'You typed `docker run -d -p 8080:80 --memory 64m nginx` and pressed Enter. The docker client goes first.'),
      focus: ['cli'],
      say: { cli: bi('Клиент docker разбирает команду и её флаги.', 'The docker client parses the command and its flags.') },
      states: startWith(ALL, 'cli'),
      metrics: { total: t },
    });
    t += 30;
    steps.push({
      id: 'api',
      label: 'API',
      caption: bi('Клиент сам ничего не запускает. Он отправляет демону dockerd HTTP-запрос через сокет `/var/run/docker.sock`, и в этом запросе перечислены образ, порты и лимит памяти.', 'The CLI starts nothing itself — it sends an HTTP request to the daemon through the /var/run/docker.sock socket, listing the image, the ports and the memory limit.'),
      focus: ['dockerd', 'e-api'],
      reveal: ['dockerd', 'e-api'],
      tokens: [{ edge: 'e-api', label: 'POST /containers/create' }],
      say: { dockerd: bi('dockerd принимает запрос на создание контейнера.', 'dockerd takes the request to create a container.') },
      metrics: { total: t },
    });
    if (!p.local) t += 4200;
    steps.push({
      id: 'image',
      label: bi('образ', 'image'),
      caption: p.local
        ? bi('Демон проверяет, есть ли образ на машине. Образ уже скачан, поэтому качать ничего не нужно.', 'The daemon checks whether the image is here. It is already downloaded — nothing to fetch.')
        : bi('Демон проверяет, есть ли образ на машине. Образа нет, поэтому dockerd скачивает его слои из реестра; подробно этот путь разобран в уроке об образах. Скачивание становится самым долгим шагом всего запуска.', 'No image: the daemon downloads the layers from a registry (in detail in the lesson about images). This is the longest step.'),
      focus: ['image', 'e-img'],
      reveal: ['image', 'e-img'],
      tokens: [{ edge: 'e-img', reverse: !p.local, label: p.local ? 'nginx:1.30-alpine' : 'docker pull' }],
      say: { image: p.local ? bi('Образ nginx:1.30-alpine уже лежит на диске.', 'nginx:1.30-alpine is already on disk.') : bi('Слои образа скачиваются из реестра, это займёт несколько секунд.', 'The layers are being downloaded from the registry; this takes seconds.') },
      states: { image: 'ok' },
      metrics: { total: t },
    });
    if (broken.has('no-containerd')) {
      steps.push({
        id: 'dial',
        label: 'snapshot',
        caption: bi('dockerd пытается попросить containerd подготовить снимок файловой системы, но сокет containerd никто не слушает. Без containerd некому хранить снимки и запускать задачи, и запуск останавливается на втором звене цепочки.', 'dockerd tries to ask containerd for a snapshot, but nobody listens on containerd’s socket.'),
        focus: ['dockerd', 'e-snap'],
        reveal: ['e-snap'],
        say: { dockerd: bi('dockerd стучится в сокет containerd и получает отказ в соединении.', 'dockerd knocks on containerd’s socket and gets connection refused.') },
        states: { dockerd: 'err', 'e-snap': 'err' },
        metrics: { total: t },
        broken: { at: 'e-snap', message: 'failed to dial "/run/containerd/containerd.sock": connection error: desc = "transport: error while dialing: dial unix /run/containerd/containerd.sock: connect: connection refused"', caption: bi('Запуск остановился между dockerd и containerd, потому что служба containerd не работает. Проверьте её командой `systemctl status containerd`.', 'The start stopped between dockerd and containerd, because the containerd service is not running. Check it with `systemctl status containerd`.') },
      });
      return steps;
    }
    t += 40;
    steps.push({
      id: 'snap',
      label: 'snapshot',
      caption: bi('containerd готовит корень будущего контейнера: кладёт слои образа снизу, а сверху пустой записываемый слой. Ядро смонтирует их вместе файловой системой overlay.', 'containerd prepares the root: image layers below, an empty writable layer on top. An overlay mount will appear in the kernel.'),
      focus: ['containerd', 'e-snap'],
      reveal: ['containerd', 'e-snap', 'kernel'],
      tokens: [{ edge: 'e-snap', label: 'Snapshots.Prepare' }],
      say: { containerd: bi('containerd собирает корень контейнера из слоёв образа и пустого слоя сверху.', 'containerd assembles the container root from the image layers and an empty top layer.') },
      values: { kernel: 'mount: overlay lowerdir=L3:L2:L1,upperdir=U' },
      metrics: { total: t },
    });
    t += 60;
    const netLine =
      p.network === 'host'
        ? bi('Для сети host своё пространство имён net не создаётся, поэтому ни пары veth, ни правил DNAT не будет, и процесс слушает порты хоста напрямую.', 'Network host: no net namespace of its own, no veth and no DNAT rules — the process listens on the host’s ports directly.')
        : p.network === 'none'
          ? bi('Для сети none в новом пространстве имён net есть только интерфейс lo, поэтому снаружи до контейнера не добраться.', 'Network none: the new net namespace has only the lo interface — the container cannot be reached.')
          : p.publish
            ? bi('Для сети bridge демон создаёт пару veth между мостом docker0 и новым пространством имён, выдаёт контейнеру адрес 172.17.0.2 и добавляет правило DNAT, по которому порт 8080 хоста ведёт на 172.17.0.2:80.', 'Network bridge: a veth pair between docker0 and the new net namespace, address 172.17.0.2, and a DNAT rule: host port 8080 → 172.17.0.2:80.')
            : bi('Для сети bridge без `-p` пара veth и адрес 172.17.0.2 появляются, но правила DNAT нет. С самого хоста до 172.17.0.2:80 достучаться можно, а с других машин нельзя.', 'Network bridge without -p: there is a veth and the address 172.17.0.2, but no DNAT rule — the host can reach 172.17.0.2:80, the outside cannot.');
    const netVal = p.network === 'host' ? 'netfilter: (no rules)' : p.network === 'none' ? 'net ns: lo' : p.publish ? 'DNAT tcp dpt:8080 → 172.17.0.2:80' : 'veth ↔ docker0, 172.17.0.2';
    steps.push({ id: 'net', label: bi('сеть', 'network'), caption: netLine, focus: ['kernel'], say: { kernel: bi('Ядро настраивает сеть будущего контейнера по просьбе dockerd.', 'The kernel sets up the future container’s network at dockerd’s request.') }, values: { kernel: netVal }, metrics: { total: t } });
    t += 30;
    if (broken.has('port-busy') && p.publish && p.network === 'bridge') {
      steps.push({
        id: 'bind',
        label: 'bind',
        caption: bi('Чтобы опубликовать порт, демон пытается занять порт 8080 на хосте, но его уже держит другая программа. Контейнер создан, но так и не запущен, поэтому он остаётся в состоянии Created.', 'The daemon tries to take host port 8080 for publishing, but another process already holds it. The container is created but not started: state Created.'),
        focus: ['kernel'],
        say: { kernel: bi('Ядро отвечает, что порт 8080 уже занят.', 'The kernel answers that port 8080 is already taken.') },
        states: { kernel: 'err' },
        metrics: { total: t },
        broken: { at: 'kernel', message: 'docker: Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint web: Bind for 0.0.0.0:8080 failed: port is already allocated', caption: bi('Запуск остановился на публикации порта, ещё до запуска процесса. Найдите программу, которая держит порт, командой `ss -ltnp`.', 'The start stopped at publishing the port, before the process started. Find the program that holds the port with `ss -ltnp`.') },
      });
      return steps;
    }
    steps.push({
      id: 'task',
      label: 'task',
      caption: bi('Клиент присылает второй запрос, `POST /containers/{id}/start`. containerd создаёт задачу и запускает для неё shim, который будет работать, пока работает контейнер.', 'POST /containers/{id}/start → containerd creates a task and starts a shim. The shim stays alive until the container ends.'),
      focus: ['shim', 'e-task'],
      reveal: ['shim', 'e-task'],
      tokens: [{ edge: 'e-task', label: 'Tasks.Create' }],
      say: { shim: bi('shim запускается, чтобы стать родителем будущего процесса контейнера.', 'The shim starts to become the parent of the future container process.') },
      metrics: { total: t },
    });
    t += 80;
    steps.push({
      id: 'runc',
      label: 'runc',
      caption: bi('shim вызывает runc и передаёт ему бандл: каталог с файлами контейнера и файл `config.json`, в котором записано, что запускать и с какими ограничениями.', 'The shim calls runc and hands it the bundle: the container’s files and `config.json`, which says what to run and with which limits.'),
      focus: ['runc', 'e-runc'],
      reveal: ['runc', 'e-runc'],
      tokens: [{ edge: 'e-runc', label: 'bundle: rootfs + config.json' }],
      say: { runc: bi('runc читает config.json и готовит процесс контейнера.', 'runc reads config.json and prepares the container process.') },
      metrics: { total: t },
    });
    steps.push({
      id: 'clone',
      label: 'clone',
      caption: fmt(bi('runc просит ядро создать процесс в новых пространствах имён, поставить его в cgroup с лимитом memory.max = {m} ({mb}) и сменить ему корень на подготовленный снимок.', 'The kernel creates a process in new namespaces, puts it into a cgroup with memory.max = {m} and changes its root (pivot_root).'), { m: mem, mb: p.memory ? `это ${p.memory} МиБ` : 'то есть без лимита' }),
      focus: ['kernel', 'e-clone'],
      reveal: ['e-clone'],
      tokens: [{ edge: 'e-clone', label: 'clone(CLONE_NEW*)' }],
      say: { kernel: bi('Ядро создаёт процесс в новых пространствах имён и ставит его в cgroup.', 'The kernel creates the process in new namespaces and puts it into a cgroup.') },
      values: { kernel: `clone(NEWPID|NEWNS|${p.network === 'host' ? '' : 'NEWNET|'}NEWUTS|NEWIPC|NEWCGROUP) · memory.max=${mem}` },
      metrics: { total: t },
    });
    t += 20;
    steps.push({
      id: 'start',
      label: 'execve',
      caption: bi('Последним действием runc заменяет себя программой контейнера через execve и на этом заканчивает работу. Новый процесс остаётся дочерним процессом shim.', 'runc start: execve("/docker-entrypoint.sh") — runc replaced itself with the program and exited. The process stays a child of the shim.'),
      focus: ['nginx', 'e-exec'],
      reveal: ['nginx', 'e-exec'],
      tokens: [{ edge: 'e-exec', label: 'execve /docker-entrypoint.sh' }],
      say: { nginx: bi('nginx запустился и внутри контейнера считает себя процессом номер 1.', 'nginx has started and sees itself as process 1 inside the container.') },
      states: { runc: 'off' },
      metrics: { total: t },
    });
    steps.push({
      id: 'done',
      label: bi('итог', 'done'),
      caption: bi('Клиент получил идентификатор контейнера и завершился, поэтому он бледный, как и runc. Работать остаются dockerd, containerd, shim и nginx. В выводе `ps -ef --forest` на хосте видна цепочка containerd-shim-runc-v2 → nginx: master → worker.', 'The CLI got the container ID and exited. dockerd, containerd, the shim and nginx live on; `ps -ef --forest` on the host shows containerd-shim-runc-v2 → nginx: master → worker.'),
      focus: ['shim', 'e-parent'],
      reveal: ['e-parent'],
      say: { shim: bi('shim остаётся родителем nginx, держит его вывод и ждёт кода выхода.', 'The shim stays nginx’s parent, holds its output and waits for the exit code.') },
      states: { cli: 'off', nginx: 'ok' },
      metrics: { total: t },
    });
    return steps;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    const total = next[next.length - 1]?.metrics?.total ?? 0;
    if (change.kind === 'break')
      return change.on
        ? change.id === 'no-containerd'
          ? bi('Без containerd цепочка обрывается на втором звене, потому что dockerd не может подготовить снимок файловой системы.', 'Without containerd the chain breaks at the second link: dockerd cannot prepare a snapshot.')
          : bi('Порт хоста занят, и ошибка возникает ещё до создания процесса, поэтому контейнер остаётся в состоянии Created.', 'A taken host port is an error before any process exists: the container stays Created.')
        : bi('Поломку убрали, и запуск снова проходит до конца.', 'The failure is removed.');
    switch (change.id) {
      case 'local':
        return fmt(b.local ? bi('Образ уже на машине, и от команды до работающего процесса проходит {t} мс.', 'The image is local: {t} ms to start.') : bi('Образа на машине нет, поэтому сначала скачиваются слои, и запуск занимает {t} мс.', 'No image: first the layers are downloaded; {t} ms to start.'), { t: total });
      case 'publish':
        return b.publish
          ? bi('С флагом -p демон добавил правило DNAT, и порт хоста теперь ведёт в контейнер.', 'With -p the daemon added a DNAT rule: a host port leads into the container.')
          : bi('Без флага -p правила DNAT нет, поэтому с других машин контейнер недоступен, а с самого хоста к нему можно обратиться по адресу 172.17.0.2.', 'Without -p there is no DNAT rule: unreachable from outside, reachable from the host itself at 172.17.0.2.');
      case 'network':
        return b.network === 'host'
          ? bi('В сети host у контейнера нет своего пространства имён net, и порты процесса совпадают с портами хоста.', 'host: no net namespace of its own — the process’s ports are the host’s ports.')
          : b.network === 'none'
            ? bi('В сети none в пространстве имён есть только интерфейс lo, и сети у контейнера нет.', 'none: only lo in the namespace, no network.')
            : bi('В сети bridge контейнер подключается парой veth к мосту docker0 и получает адрес из 172.17.0.0/16.', 'bridge: a veth into docker0, an address from 172.17.0.0/16.');
      case 'memory':
        return fmt(bi('Лимит изменился с {a} на {b} МиБ. На схеме поменялось только одно число, memory.max в cgroup контейнера, а остальная цепочка запуска осталась прежней.', '--memory {a} → {b} MiB: only one number changes — memory.max in the container’s cgroup.'), { a: a.memory, b: b.memory });
    }
    return bi('Схема пересчитана для новых параметров.', 'The model is recomputed.');
  },
});
