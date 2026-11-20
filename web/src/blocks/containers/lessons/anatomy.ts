// m03. Anatomy of a container: the OCI bundle, the runtime chain, states (04 §4.3).

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem, TerminalSetup } from '../../../core/types';
import { RU, SRC } from '../shared';

const stub = '#!/usr/bin/sim\n# busybox: BusyBox v1.37.0 multi-call binary\n';

/** A bundle directory with a small busybox root file system, as `tar -x` of a minirootfs would leave. */
export const bundleSetup: TerminalSetup = {
  hostname: 'trainer',
  user: 'root',
  cwd: '/root/box',
  files: [
    { path: '/root/box/rootfs/bin/busybox', content: stub, mode: '0755', owner: 'root' },
    ...['sh', 'ls', 'cat', 'echo', 'hostname', 'ps', 'id', 'pwd'].map((n) => ({ path: `/root/box/rootfs/bin/${n}`, type: 'l' as const, target: 'busybox' })),
    { path: '/root/box/rootfs/etc/os-release', content: 'NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.22.2\n', owner: 'root' },
    { path: '/root/box/rootfs/etc/passwd', content: 'root:x:0:0:root:/root:/bin/sh\n', owner: 'root' },
    { path: '/root/box/rootfs/tmp', type: 'd', owner: 'root' },
    { path: '/root/box/rootfs/proc', type: 'd', owner: 'root' },
  ],
};

export const anatomyQuiz: QuizItem[] = [
  {
    id: 'containers.q.chain-order',
    kind: 'order',
    key: true,
    concepts: ['docker.runtime'],
    prompt: bi('Расставьте участников `docker run` в том порядке, в каком они вызывают друг друга, от вашей команды до процесса.', 'Put the participants of `docker run` in calling order — from your command to the process.'),
    steps: [
      { id: 'cli', text: 'docker CLI' },
      { id: 'dockerd', text: 'dockerd' },
      { id: 'containerd', text: 'containerd' },
      { id: 'shim', text: 'containerd-shim-runc-v2', why: bi('shim запускается раньше runc и продолжает работать после него, потому что он остаётся родителем процесса контейнера.', 'The shim starts before runc and lives on after it: it is the parent of the container process.') },
      { id: 'runc', text: 'runc' },
      { id: 'proc', text: bi('процесс контейнера', 'the container process') },
    ],
    explain: bi('После запуска runc завершается, а процесс остаётся дочерним процессом shim. Клиент docker тоже завершается, и работать остаются dockerd, containerd, shim и сам процесс контейнера.', 'After the start runc exits and the process stays a child of the shim. The CLI exits too — dockerd, containerd, the shim and the process itself keep running.'),
    refs: { explainer: 'containers.chain' },
  },
  {
    id: 'containers.q.oci-created',
    kind: 'mcq',
    concepts: ['docker.states'],
    prompt: bi('В каком состоянии по спецификации OCI процесс контейнера уже существует, а программа в нём ещё не запущена?', 'In which OCI state does the container process already exist, while the program has not started yet?'),
    options: [
      { id: 'created', text: 'created', correct: true },
      { id: 'creating', text: 'creating', why: bi('В состоянии creating рантайм ещё готовит окружение, и процесса программы пока нет.', 'creating — the runtime is still preparing the environment; there is no program process yet.') },
      { id: 'running', text: 'running', why: bi('В состоянии running программа уже выполняется, а наступает оно только после команды `start`.', 'running — the program is already executing (after `start`).') },
      { id: 'stopped', text: 'stopped', why: bi('В состоянии stopped процесс уже завершился.', 'stopped — the process has already exited.') },
    ],
    explain: bi('Команда `crun create` создаёт процесс в новых пространствах имён и останавливает его прямо перед вызовом execve, а `crun start` разрешает ему продолжить. Пауза между ними нужна, чтобы успеть настроить, например, сеть контейнера.', '`crun create` creates the process in new namespaces and stops it right before execve; `crun start` lets it continue. That gives time to set up, for example, the network.'),
  },
  {
    id: 'containers.q.not-a-state',
    kind: 'mcq',
    concepts: ['docker.states'],
    prompt: bi('Какое из перечисленных слов НЕ называет состояние контейнера Docker?', 'Which of these is NOT a Docker container state?'),
    options: [
      { id: 'removed', text: 'removed', correct: true },
      { id: 'paused', text: 'paused', why: bi('Состояние paused означает, что процессы контейнера заморожены через cgroup freezer командой `docker pause`.', 'paused — the processes are frozen through the cgroup freezer (`docker pause`).') },
      { id: 'restarting', text: 'restarting', why: bi('Состояние restarting означает, что политика перезапуска заново запускает контейнер, который завершился с ошибкой.', 'restarting — the restart policy is bringing a fallen container back.') },
      { id: 'dead', text: 'dead', why: bi('Состояние dead получает контейнер, который демону не удалось удалить до конца.', 'dead — a container the daemon failed to remove completely.') },
    ],
    explain: bi('После `docker rm` контейнера больше нет, поэтому слово «удалён» не называет никакого состояния.', 'After `docker rm` the container simply does not exist: removed is not a state.'),
  },
  {
    id: 'containers.q.bundle-parts',
    kind: 'match',
    concepts: ['docker.bundle'],
    prompt: bi('Сопоставьте поле файла config.json с тем, что вы делали руками в блоке Linux.', 'Match a config.json field with what you did by hand in the Linux block.'),
    pairs: [
      { id: 'ns', left: 'linux.namespaces', right: bi('unshare --pid --mount --uts …', 'unshare --pid --mount --uts …'), why: bi('В этом поле перечислены пространства имён, которые рантайм создаст для процесса.', 'The list of namespaces the runtime creates for the process.') },
      { id: 'res', left: 'linux.resources', right: bi('echo 16M > memory.max', 'echo 16M > memory.max'), why: bi('В этом поле заданы лимиты памяти и процессора, которые рантайм запишет в cgroup.', 'This field sets the memory and CPU limits the runtime writes into the cgroup.') },
      { id: 'root', left: 'root.path', right: bi('chroot или pivot_root в каталог rootfs', 'chroot / pivot_root into rootfs'), why: bi('В этом поле указан каталог, который станет корнем процесса.', 'This field names the directory that becomes the process’s root.') },
      { id: 'caps', left: 'process.capabilities', right: bi('capsh --drop=…', 'capsh --drop=…'), why: bi('Это поле перечисляет, какие из привилегий root останутся у процесса.', 'This field lists which root privileges the process keeps.') },
    ],
  },
  {
    id: 'containers.q.shim-why',
    kind: 'mcq',
    concepts: ['docker.runtime'],
    prompt: bi('Зачем в цепочке нужен shim, если процесс запускает runc?', 'Why is there a shim in the chain if runc starts the process?'),
    options: [
      { id: 'parent', text: bi('runc завершается сразу после запуска, а shim остаётся родителем процесса, держит его стандартные потоки и узнаёт код выхода. Поэтому dockerd и containerd можно перезапустить, не останавливая контейнер', 'runc exits right after the start; the shim stays the parent, holds stdio and learns the exit code — so dockerd and containerd can restart without killing the container'), correct: true },
      { id: 'speed', text: bi('shim ускоряет запуск контейнера', 'The shim makes the start faster'), why: bi('shim ничего не ускоряет. Он нужен для того, чтобы контейнер не зависел от того, работают ли демоны Docker.', 'It speeds nothing up — it is there so the container does not depend on the daemons staying alive.') },
      { id: 'image', text: bi('shim скачивает образ', 'The shim downloads the image'), why: bi('Образы скачивают dockerd и containerd, а shim появляется, когда образ уже лежит на машине.', 'dockerd/containerd pull images; the shim appears when the image is already there.') },
    ],
  },
];

export const anatomyLesson: Lesson = {
  id: 'containers.anatomy',
  block: 'containers',
  title: bi('Из чего состоит контейнер на диске, кто его запускает и в каких состояниях он бывает', 'What a container is made of on disk, who starts it and which states it goes through'),
  summary: bi('В этом уроке вы узнаете, что лежит на диске и какие программы запускают процесс, когда говорят «запустить контейнер».', 'In this lesson you will learn what lies on disk and which programs start the process when people say “run a container”.'),
  introduces: ['docker.bundle', 'docker.runtime', 'docker.states'],
  uses: ['docker.container'],
  tier: 'core',
  minutes: 30,
  sources: {
    en: [SRC.runtimeSpec, { title: 'OCI runtime-spec — bundle.md', url: 'https://github.com/opencontainers/runtime-spec/blob/main/bundle.md' }, { title: 'OCI runtime-spec — runtime.md (state)', url: 'https://github.com/opencontainers/runtime-spec/blob/main/runtime.md' }, { title: 'containerd documentation', url: 'https://containerd.io/docs/' }, { title: 'crun', url: 'https://github.com/containers/crun' }],
    ru: [RU.docker, SRC.k8sRuContainers, SRC.habrUnshare],
  },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Вы набираете `docker run nginx`, и через полсекунды на машине работает веб-сервер. Между командой и работающим процессом стоят пять программ и один каталог на диске. Этот урок отвечает на вопрос: **что лежит на диске и кто запускает процесс, когда говорят «запустить контейнер»?**', 'You type `docker run nginx` and half a second later a web server runs on the machine. Between the command and the process there are five programs and one folder on disk. This lesson answers: **what lies on disk and who starts the process when people say “run a container”?**'),
    },
    {
      id: 'bundle',
      kind: 'text',
      step: 'explain',
      title: bi('Как контейнер выглядит на диске', 'What a container looks like on disk'),
      body: bi(
        'Контейнер запускает особая программа, которую называют рантаймом, и ей нужны две вещи: файлы, которые станут корнем процесса, и описание того, какой процесс запустить и как его изолировать. Открытый стандарт Open Container Initiative называет такую пару [[docker.bundle|OCI bundle]], или бандлом. Бандл устроен как каталог, в котором лежат подкаталог `rootfs/` и файл `config.json`.\n\nВ файле `config.json` вы узнаете всё, что делали руками в блоке Linux:\n\n- `process.args` задаёт, какую программу запустить, а `process.env` и `process.cwd` — с какими переменными окружения и в каком каталоге;\n- `root.path` задаёт каталог, который станет корнем;\n- `linux.namespaces` перечисляет пространства имён, которые нужно создать: pid, network, ipc, uts, mount и cgroup;\n- `linux.resources` задаёт лимиты cgroup;\n- `process.capabilities` перечисляет, какие из привилегий root останутся у процесса;\n- `mounts` перечисляет, что смонтировать внутрь: `/proc`, `/dev`, `/sys`.\n\nОбратите внимание, что по умолчанию в этом списке нет пространств имён user и time. Процесс получит своё имя машины, свой PID 1 и свою сеть, но root внутри контейнера останется тем же UID 0, что и на хосте. К этому мы вернёмся в уроке о безопасности.',
        'To start a container a runtime program needs two things: the files that will become the process’s root, and a description of which process to start and how to isolate it. The open Open Container Initiative standard calls this pair an [[docker.bundle|OCI bundle]]: a directory holding a `rootfs/` subdirectory and a `config.json` file.\n\nIn `config.json` you will recognise everything you did by hand in the Linux block:\n\n- `process.args` — which program to start; `process.env` and `process.cwd` — with which environment and in which directory;\n- `root.path` — which directory becomes the root;\n- `linux.namespaces` — which namespaces to create: pid, network, ipc, uts, mount, cgroup;\n- `linux.resources` — the cgroup limits;\n- `process.capabilities` — which root privileges remain;\n- `mounts` — what to mount inside: `/proc`, `/dev`, `/sys`.\n\nNotice what is not in the list by default: the user and time namespaces. The process gets its own name, its own PID 1 and its own network, but root inside is the same UID 0 as on the host. We come back to that in the security lesson.',
      ),
    },
    {
      id: 'chain-short',
      kind: 'text',
      step: 'explain',
      levels: ['beginner'],
      body: bi('В прошлом уроке цепочка запуска выглядела коротко: клиент передаёт просьбу демону, а демон просит ядро создать контейнер. Ниже та же цепочка показана подробнее, и звеньев в ней окажется пять, но устроена она так же: каждая программа получает задание от предыдущей и поручает часть работы следующей. Запоминать все имена сразу не нужно. Важно понять одно: программа, которая создала контейнер, после этого завершается, а рядом с процессом контейнера остаётся маленький посредник, который собирает его вывод и узнаёт, чем процесс закончился.', 'In the last lesson the start-up chain looked short: the client passes the request to the daemon, and the daemon asks the kernel to create a container. Below the same chain is shown in more detail, and it turns out to have five links, but it works the same way: each program takes a job from the previous one and hands part of the work to the next. You do not need to remember every name at once. One thing matters: the program that created the container exits right after, and next to the container process stays a small go-between that collects its output and learns how the process ended.'),
    },
    {
      id: 'chain',
      kind: 'text',
      step: 'explain',
      title: bi('Какие программы по очереди запускают контейнер', 'Which programs start a container, one after another'),
      body: bi(
        'Команда `docker` работает только как клиент. Она превращает ваши флаги в HTTP-запрос и отправляет его демону **dockerd** через сокет `/var/run/docker.sock`, то есть через особый файл, по которому программы на одной машине обмениваются сообщениями. Демон знает об образах, сетях и томах, а подготовку файловой системы контейнера и запуск процесса поручает второму демону, **containerd**. Тот собирает из файлов образа корень будущего контейнера и для каждого контейнера запускает маленький процесс-посредник **shim**. Shim вызывает **runc**, программу, которая читает `config.json`, просит ядро создать пространства имён и cgroup, меняет корень и системным вызовом `execve` заменяет себя вашей программой. На этом runc заканчивает работу.\n\nЭту цепочку называют [[docker.runtime|рантаймом контейнеров]]. Важнее всего в ней то, что после запуска продолжает работать shim. Он остаётся родителем процесса контейнера, держит его stdout и stderr, откуда потом берёт строки `docker logs`, и узнаёт код выхода. Благодаря shim демоны dockerd и containerd можно обновить и перезапустить, не останавливая контейнеры.',
        'The `docker` command is only a client. It turns your flags into an HTTP request and sends it to the **dockerd** daemon through the `/var/run/docker.sock` socket, a special file through which programs on one machine exchange messages. The daemon knows images, networks and volumes; the container’s file system and the start of the process it delegates to a second daemon, **containerd**. That one prepares the root from the image layers and starts a small go-between process, the **shim**, for each container. The shim calls **runc** — a program that reads `config.json`, asks the kernel to create namespaces and a cgroup, changes the root and replaces itself with your program through the `execve` system call. Then runc exits.\n\nThis chain is called the [[docker.runtime|container runtime]]. What matters most in it is who stays alive: the shim. It is the parent of the container process, holds its stdout and stderr (that is where `docker logs` later reads) and learns the exit code. Thanks to it, dockerd and containerd can be upgraded and restarted without stopping containers.',
      ),
    },
    { id: 'look-intro', kind: 'text', step: 'look', title: bi('Что происходит после docker run', 'What happens after docker run'), body: bi('Схема ниже в замедленном виде показывает, что происходит за полсекунды после того, как вы набрали `docker run -d -p 8080:80 --memory 64m nginx`. В верхнем ряду слева направо стоят участники цепочки: клиент docker, демоны dockerd и containerd, shim и runc. Под ними нарисован образ на диске, рядом с ним по ходу запуска появится процесс nginx, а внизу во всю ширину схемы проходит ядро Linux, которое в конце концов и создаёт контейнер.', 'The diagram below replays in slow motion what happens in the half-second after you type `docker run -d -p 8080:80 --memory 64m nginx`. In the top row, from left to right, stand the links of the chain: the docker client, the dockerd and containerd daemons, the shim and runc. Below lie the image on disk and, later, the nginx process, and along the bottom lies the Linux kernel, which in the end creates the container.') },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'containers.chain', howto: bi('Сначала на схеме только терминал. Нажмите «Начать с первого шага» и переходите дальше кнопкой «Шаг вперёд». Каждая следующая программа появляется, когда её вызывает предыдущая. Подсвечен тот участник, который работает сейчас; облачко рядом с ним говорит, что он делает, а карточка на линии показывает, что он передаёт дальше: HTTP-запрос, снимок файловой системы, задачу, бандл, системный вызов. Под ядром печатается то, что оно настроило на этом шаге. На последнем шаге клиент и runc бледнеют, потому что уже завершились, а shim и nginx продолжают работать.\n\nПосле первого прохода уберите в «Параметрах» флажок «Образ nginx уже скачан на эту машину» и посмотрите, как вырастет время запуска, смените сеть контейнера и лимит памяти. Потом включите в блоке «Сломать» остановленный containerd или занятый порт и найдите шаг, на котором запуск остановится, и сообщение, которое при этом напечатает Docker.', 'At first only the terminal is shown. Press “Start from the first step” and go on with “Step forward”: each program appears when the previous one calls it. The participant working now is highlighted; the callout next to it says what it does, and the card on the line shows what it passes on: an HTTP request, a snapshot, a task, the bundle, a system call. Under the kernel you see what it set up at this step. At the last step the client and runc turn pale because they have exited, while the shim and nginx keep running.\n\nAfter the first pass untick “The nginx image is already here” in “Parameters” and see how the start time grows, change the network and the memory limit. Then switch on a stopped containerd or a taken port in “Break it” and find the step where the start stops and the message Docker prints.'), caption: bi('Когда контейнер не запускается, сообщение об ошибке почти всегда называет звено этой цепочки, на котором всё остановилось: сокет containerd, публикацию порта, рантайм. Посмотрите, какого участника называет сообщение, и начинайте поиск с этого звена. На настоящем сервере с Docker цепочку процессов работающего контейнера показывает команда `ps -ef --forest`: в её дереве процесс nginx стоит под процессом containerd-shim.', 'When a container does not start, the error message almost always names the link of this chain where things stopped: the containerd socket, port publishing, the runtime. See which participant printed it and start looking there. On a real server with Docker the command `ps -ef --forest` shows the process chain of a running container: in its tree the nginx process sits under the containerd-shim process.') },
    {
      id: 'states',
      kind: 'text',
      step: 'explain',
      title: bi('Состояния контейнера', 'States'),
      body: bi(
        'Спецификация OCI описывает четыре [[docker.states|состояния]] контейнера. В состоянии `creating` рантайм готовит окружение; в состоянии `created` процесс уже создан в новых пространствах имён, но остановлен перед запуском программы; в состоянии `running` программа выполняется; в состоянии `stopped` процесс завершился. Из одного состояния в другое контейнер переводят команды `create` и `start`, завершение процесса и команда `delete`.\n\nУ Docker своя, более подробная картина. Его состояния называются `created`, `running`, `paused` (процессы заморожены), `restarting` (политика перезапуска заново запускает контейнер, который завершился с ошибкой), `exited` и `dead` (контейнер не удалось удалить до конца). Заметьте, что слово «удалён» не называет состояния, потому что после `docker rm` контейнера больше нет.\n\nВ практике ниже вы проведёте контейнер по состояниям OCI руками с помощью рантайма `crun`. Он делает то же, что runc, только написан на языке C.',
        'The OCI specification describes four container [[docker.states|states]]: `creating` (the runtime is preparing the environment), `created` (the process already exists in new namespaces but is stopped before the program starts), `running` (the program executes) and `stopped` (the process has exited). The transitions are the commands `create`, `start`, the process exit and `delete`.\n\nDocker has its own, more detailed picture: `created`, `running`, `paused` (processes frozen), `restarting` (the restart policy is bringing a fallen container back), `exited` and `dead` (removal did not complete). Note: “removed” is not a state. After `docker rm` the container simply does not exist.\n\nIn the practice below you will walk a container through the OCI states by hand with the `crun` runtime — the same as runc, only written in C.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: bundleSetup,
      intro: bi('В каталог `/root/box/rootfs` уже распакован маленький корень на основе busybox, а вы работаете как root. Превратим этот каталог в бандл и проведём контейнер по всем состояниям.', 'A small busybox root is already unpacked into `/root/box/rootfs`. You are root. Let us turn the directory into a bundle and walk a container through its states.'),
      tasks: [
        {
          id: 'spec',
          prompt: bi('В каталоге `/root/box` создайте файл config.json с настройками по умолчанию командой `crun spec`.', 'In `/root/box` create the default config.json with `crun spec`.'),
          check: { when: "files['/root/box/config.json'].type=f", fail: [{ if: "!files['/root/box/rootfs']", say: bi('Каталог rootfs пропал. Верните машину в исходное состояние кнопкой «Сбросить экран».', 'The rootfs directory is gone: reset the machine with “Reset this screen”.') }] },
          chips: 'crun spec',
          concepts: ['docker.bundle'],
          docRef: { page: 'help/crun', anchor: 'USAGE', line: 'spec' },
          hints: { H1: bi('Нужна подкоманда рантайма, которая, как сказано в справке, генерирует файл конфигурации.', 'The runtime subcommand that “generates a configuration file”.') },
        },
        {
          id: 'namespaces',
          prompt: bi('Выведите config.json на экран и найдите в нём список пространств имён. Есть ли в этом списке `user`?', 'Print config.json and find the list of namespaces. Is `user` in it?'),
          check: { stdout: '"type": "network"' },
          chips: 'cat config.json',
          concepts: ['docker.bundle'],
          hints: { H1: bi('Ищите поле `linux.namespaces`. В нём перечислены pid, network, ipc, uts, cgroup и mount, а user и time там нет.', 'Look for the `linux.namespaces` field: pid, network, ipc, uts, cgroup, mount — no user and no time.') },
        },
        {
          id: 'create',
          prompt: bi('Создайте контейнер с именем `box`, не запуская в нём программу, и посмотрите, в каком он состоянии.', 'Create a container named `box` without starting the program, and look at its state.'),
          check: { stdout: /"status": "created"|^box\s+\d+\s+created\b/m },
          chips: 'crun create box && crun state box',
          concepts: ['docker.states'],
          hints: { H1: bi('Вам понадобятся две подкоманды. Одна из них создаёт контейнер, а другая показывает его состояние.', 'Two subcommands: one creates, the other shows the state.'), H2: bi('Сначала выполните `crun create box`, потом `crun state box`.', '`crun create box`, then `crun state box`.') },
        },
        {
          id: 'start',
          prompt: bi('Запустите программу контейнера командой `crun start box`. Вы окажетесь внутри контейнера, в оболочке `sh`. Проверьте, что показывают `hostname` и `ps`, затем выйдите командой `exit` и снова посмотрите состояние контейнера.', 'Start the container’s program (`crun start box`). You end up in `sh` inside: check `hostname` and `ps`, then `exit` — and look at the state again.'),
          check: { stdout: '"status": "stopped"' },
          chips: 'crun start box',
          concepts: ['docker.states'],
          hints: { H1: bi('После `exit` процесс контейнера завершился, а значит, состояние уже не running.', 'After `exit` the container process ended — so the state is no longer running.'), H2: bi('После выхода команда `crun state box` покажет `"status": "stopped"`.', '`crun state box` after the exit shows `"status": "stopped"`.') },
        },
        {
          id: 'delete',
          prompt: bi('Удалите остановленный контейнер и убедитесь, что `crun list` больше ничего не показывает.', 'Delete the stopped container and make sure `crun list` is empty.'),
          check: { stdout: /^NAME PID[^\n]*\n?$/ },
          chips: 'crun delete box && crun list',
          concepts: ['docker.states'],
          hints: { H1: bi('Удалённый контейнер не находится ни в каком состоянии, поэтому в списке его больше нет.', 'A deleted container is not a state: it is simply not in the list.') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('Найдите в справке `crun --help` подкоманду, которая показывает процессы внутри контейнера, и прочитайте её описание.', 'Find in `crun --help` the subcommand that shows the processes inside a container and read its description.'),
      ref: { page: 'help/crun' },
      terminal: {
        setup: bundleSetup,
        task: { id: 'ps-sub', prompt: bi('Выведите справку crun так, чтобы на экране была видна строка о процессах контейнера.', 'Print crun’s help so that the line about the container’s processes is on screen.'), check: { stdout: 'show the processes in the container' }, docStep: 3, chips: 'crun --help' },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: anatomyQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог урока', 'Summary'),
      body: bi('На диске контейнер хранится как бандл, то есть каталог rootfs и файл config.json, в котором записаны пространства имён, лимиты и программа. Запускает контейнер цепочка docker → dockerd → containerd → shim → runc, причём runc после запуска завершается, а shim остаётся родителем процесса. По спецификации OCI у контейнера четыре состояния: creating, created, running и stopped.', 'A container on disk is a bundle: rootfs and config.json holding the namespaces, limits and program. The chain docker → dockerd → containerd → shim → runc starts it; runc exits, the shim stays the parent. The OCI states: creating, created, running, stopped.'),
    },
  ],
};
