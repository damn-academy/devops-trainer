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
    ...['sh', 'ls', 'cat', 'echo', 'hostname', 'ps', 'id', 'pwd'].map((n) => ({ path: `/root/box/rootfs/bin/${n}`, type: 'l' as const, target: '/bin/busybox' })),
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
    prompt: bi('Расставьте участников `docker run` в порядке вызова — от вашей команды до процесса.', 'Put the participants of `docker run` in calling order — from your command to the process.'),
    steps: [
      { id: 'cli', text: 'docker CLI' },
      { id: 'dockerd', text: 'dockerd' },
      { id: 'containerd', text: 'containerd' },
      { id: 'shim', text: 'containerd-shim-runc-v2', why: bi('shim запускается до runc и остаётся жить после него: он родитель процесса контейнера.', 'The shim starts before runc and lives on after it: it is the parent of the container process.') },
      { id: 'runc', text: 'runc' },
      { id: 'proc', text: bi('процесс контейнера', 'the container process') },
    ],
    explain: bi('После старта runc завершается, а процесс остаётся ребёнком shim. CLI тоже выходит — работают dockerd, containerd, shim и сам процесс.', 'After the start runc exits and the process stays a child of the shim. The CLI exits too — dockerd, containerd, the shim and the process itself keep running.'),
    refs: { explainer: 'containers.chain' },
  },
  {
    id: 'containers.q.oci-created',
    kind: 'mcq',
    concepts: ['docker.states'],
    prompt: bi('В каком состоянии OCI процесс контейнера уже существует, но программа ещё не запущена?', 'In which OCI state does the container process already exist, while the program has not started yet?'),
    options: [
      { id: 'created', text: 'created', correct: true },
      { id: 'creating', text: 'creating', why: bi('creating — рантайм ещё готовит окружение; процесса программы ещё нет.', 'creating — the runtime is still preparing the environment; there is no program process yet.') },
      { id: 'running', text: 'running', why: bi('running — программа уже выполняется (после `start`).', 'running — the program is already executing (after `start`).') },
      { id: 'stopped', text: 'stopped', why: bi('stopped — процесс уже завершился.', 'stopped — the process has already exited.') },
    ],
    explain: bi('`crun create` создаёт процесс в новых пространствах имён и останавливает его прямо перед execve; `crun start` разрешает ему продолжить. Так рантайм даёт время настроить, например, сеть.', '`crun create` creates the process in new namespaces and stops it right before execve; `crun start` lets it continue. That gives time to set up, for example, the network.'),
  },
  {
    id: 'containers.q.not-a-state',
    kind: 'mcq',
    concepts: ['docker.states'],
    prompt: bi('Что из этого НЕ состояние контейнера Docker?', 'Which of these is NOT a Docker container state?'),
    options: [
      { id: 'removed', text: 'removed', correct: true },
      { id: 'paused', text: 'paused', why: bi('paused — процессы заморожены через cgroup freezer (`docker pause`).', 'paused — the processes are frozen through the cgroup freezer (`docker pause`).') },
      { id: 'restarting', text: 'restarting', why: bi('restarting — политика перезапуска поднимает упавший контейнер.', 'restarting — the restart policy is bringing a fallen container back.') },
      { id: 'dead', text: 'dead', why: bi('dead — контейнер, который демон не смог удалить до конца.', 'dead — a container the daemon failed to remove completely.') },
    ],
    explain: bi('После `docker rm` контейнера просто нет: удалённое — не состояние.', 'After `docker rm` the container simply does not exist: removed is not a state.'),
  },
  {
    id: 'containers.q.bundle-parts',
    kind: 'match',
    concepts: ['docker.bundle'],
    prompt: bi('Сопоставьте поле config.json и то, что вы делали руками в блоке Linux.', 'Match a config.json field with what you did by hand in the Linux block.'),
    pairs: [
      { id: 'ns', left: 'linux.namespaces', right: bi('unshare --pid --mount --uts …', 'unshare --pid --mount --uts …'), why: bi('Список пространств имён, которые рантайм создаст для процесса.', 'The list of namespaces the runtime creates for the process.') },
      { id: 'res', left: 'linux.resources', right: bi('echo 16M > memory.max', 'echo 16M > memory.max'), why: bi('Лимиты cgroup.', 'The cgroup limits.') },
      { id: 'root', left: 'root.path', right: bi('chroot / pivot_root в rootfs', 'chroot / pivot_root into rootfs'), why: bi('Каталог, который станет корнем процесса.', 'The directory that becomes the process’s root.') },
      { id: 'caps', left: 'process.capabilities', right: bi('capsh --drop=…', 'capsh --drop=…'), why: bi('Какие права root останутся у процесса.', 'Which root privileges the process keeps.') },
    ],
  },
  {
    id: 'containers.q.shim-why',
    kind: 'mcq',
    concepts: ['docker.runtime'],
    prompt: bi('Зачем в цепочке shim, если процесс запускает runc?', 'Why is there a shim in the chain if runc starts the process?'),
    options: [
      { id: 'parent', text: bi('runc выходит сразу после старта; shim остаётся родителем процесса, держит его stdio и узнаёт код выхода — поэтому dockerd и containerd можно перезапустить, не убив контейнер', 'runc exits right after the start; the shim stays the parent, holds stdio and learns the exit code — so dockerd and containerd can restart without killing the container'), correct: true },
      { id: 'speed', text: bi('shim ускоряет запуск', 'The shim makes the start faster'), why: bi('Он ничего не ускоряет — он нужен, чтобы контейнер не зависел от жизни демонов.', 'It speeds nothing up — it is there so the container does not depend on the daemons staying alive.') },
      { id: 'image', text: bi('shim скачивает образ', 'The shim downloads the image'), why: bi('Образы тянет dockerd/containerd; shim появляется, когда образ уже есть.', 'dockerd/containerd pull images; the shim appears when the image is already there.') },
    ],
  },
];

export const anatomyLesson: Lesson = {
  id: 'containers.anatomy',
  block: 'containers',
  title: bi('Анатомия контейнера: bundle, рантайм, состояния', 'Anatomy of a container: the bundle, the runtime, the states'),
  summary: bi('Что лежит на диске и кто запускает процесс, когда говорят «запустить контейнер».', 'What lies on disk and who starts the process when people say “run a container”.'),
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
      body: bi('Вы набираете `docker run nginx`, и через полсекунды на машине работает веб-сервер. Между командой и процессом — пять программ и одна папка на диске. Глава отвечает на вопрос: **что лежит на диске и кто запускает процесс, когда говорят «запустить контейнер»?**', 'You type `docker run nginx` and half a second later a web server runs on the machine. Between the command and the process there are five programs and one folder on disk. This chapter answers: **what lies on disk and who starts the process when people say “run a container”?**'),
    },
    {
      id: 'bundle',
      kind: 'text',
      step: 'explain',
      title: bi('Контейнер на диске: rootfs и config.json', 'A container on disk: rootfs and config.json'),
      body: bi(
        'Чтобы запустить контейнер, программе-рантайму нужны две вещи: файлы, которые станут корнем процесса, и описание того, какой процесс запускать и как его изолировать. Открытый стандарт Open Container Initiative называет такую пару [[docker.bundle|OCI bundle]]: каталог, в котором лежат подкаталог `rootfs/` и файл `config.json`.\n\nВ `config.json` вы узнаете всё, что делали руками в блоке Linux:\n\n- `process.args` — какую программу запустить, `process.env` и `process.cwd` — с каким окружением и в каком каталоге;\n- `root.path` — какой каталог станет корнем;\n- `linux.namespaces` — какие пространства имён создать: pid, network, ipc, uts, mount, cgroup;\n- `linux.resources` — лимиты cgroup;\n- `process.capabilities` — какие права root останутся;\n- `mounts` — что смонтировать внутрь: `/proc`, `/dev`, `/sys`.\n\nЗаметьте, чего в списке нет по умолчанию: пространств имён user и time. Процесс получит своё имя, свой PID 1 и свою сеть, но root внутри — это тот же UID 0, что и на хосте. К этому вернёмся в главе о безопасности.',
        'To start a container a runtime program needs two things: the files that will become the process’s root, and a description of which process to start and how to isolate it. The open Open Container Initiative standard calls this pair an [[docker.bundle|OCI bundle]]: a directory holding a `rootfs/` subdirectory and a `config.json` file.\n\nIn `config.json` you will recognise everything you did by hand in the Linux block:\n\n- `process.args` — which program to start; `process.env` and `process.cwd` — with which environment and in which directory;\n- `root.path` — which directory becomes the root;\n- `linux.namespaces` — which namespaces to create: pid, network, ipc, uts, mount, cgroup;\n- `linux.resources` — the cgroup limits;\n- `process.capabilities` — which root privileges remain;\n- `mounts` — what to mount inside: `/proc`, `/dev`, `/sys`.\n\nNotice what is not in the list by default: the user and time namespaces. The process gets its own name, its own PID 1 and its own network, but root inside is the same UID 0 as on the host. We come back to that in the security chapter.',
      ),
    },
    {
      id: 'chain',
      kind: 'text',
      step: 'explain',
      title: bi('Кто запускает: цепочка рантайма', 'Who starts it: the runtime chain'),
      body: bi(
        'Команда `docker` — только клиент. Она превращает ваши флаги в HTTP-запрос и отправляет его демону **dockerd** через сокет `/var/run/docker.sock`. Демон знает образы, сети и тома; файловую систему контейнера и запуск процесса он поручает второму демону, **containerd**. Тот готовит корень из слоёв образа и для каждого контейнера запускает маленький процесс-посредник **shim**. Shim вызывает **runc** — программу, которая читает `config.json`, просит ядро создать пространства имён и cgroup, меняет корень и делает `execve` в вашу программу. После этого runc завершается.\n\nЭту цепочку называют [[docker.runtime|рантаймом контейнеров]]. Главное в ней — кто остаётся жить: shim. Он родитель процесса контейнера, держит его stdout и stderr (отсюда потом берётся `docker logs`) и узнаёт код выхода. Благодаря ему dockerd и containerd можно обновить и перезапустить, не останавливая контейнеры.',
        'The `docker` command is only a client. It turns your flags into an HTTP request and sends it to the **dockerd** daemon through the `/var/run/docker.sock` socket. The daemon knows images, networks and volumes; the container’s file system and the start of the process it delegates to a second daemon, **containerd**. That one prepares the root from the image layers and starts a small go-between process, the **shim**, for each container. The shim calls **runc** — a program that reads `config.json`, asks the kernel to create namespaces and a cgroup, changes the root and does `execve` into your program. Then runc exits.\n\nThis chain is called the [[docker.runtime|container runtime]]. What matters most in it is who stays alive: the shim. It is the parent of the container process, holds its stdout and stderr (that is where `docker logs` later reads) and learns the exit code. Thanks to it, dockerd and containerd can be upgraded and restarted without stopping containers.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'containers.chain', caption: bi('Пройдите цепочку по шагам; выключите containerd или займите порт и посмотрите, где всё встанет.', 'Walk the chain step by step; switch containerd off or take the port and see where everything stops.') },
    {
      id: 'states',
      kind: 'text',
      step: 'explain',
      title: bi('Состояния', 'States'),
      body: bi(
        'Спецификация OCI описывает четыре [[docker.states|состояния]] контейнера: `creating` (рантайм готовит окружение), `created` (процесс уже создан в новых пространствах имён, но остановлен перед запуском программы), `running` (программа выполняется) и `stopped` (процесс завершился). Переходы между ними — команды `create`, `start`, выход процесса и `delete`.\n\nУ Docker своя, более подробная картина: `created`, `running`, `paused` (процессы заморожены), `restarting` (политика перезапуска поднимает упавший контейнер), `exited` и `dead` (не удалось удалить до конца). Обратите внимание: «удалён» — не состояние. После `docker rm` контейнера просто нет.\n\nВ практике ниже вы проведёте контейнер по состояниям OCI руками, рантаймом `crun` — тем же, что runc, только написанным на C.',
        'The OCI specification describes four container [[docker.states|states]]: `creating` (the runtime is preparing the environment), `created` (the process already exists in new namespaces but is stopped before the program starts), `running` (the program executes) and `stopped` (the process has exited). The transitions are the commands `create`, `start`, the process exit and `delete`.\n\nDocker has its own, more detailed picture: `created`, `running`, `paused` (processes frozen), `restarting` (the restart policy is bringing a fallen container back), `exited` and `dead` (removal did not complete). Note: “removed” is not a state. After `docker rm` the container simply does not exist.\n\nIn the practice below you will walk a container through the OCI states by hand with the `crun` runtime — the same as runc, only written in C.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: bundleSetup,
      intro: bi('В `/root/box/rootfs` уже распакован маленький корень на busybox. Вы — root. Превратим каталог в bundle и проведём контейнер по состояниям.', 'A small busybox root is already unpacked into `/root/box/rootfs`. You are root. Let us turn the directory into a bundle and walk a container through its states.'),
      tasks: [
        {
          id: 'spec',
          prompt: bi('В каталоге `/root/box` создайте config.json по умолчанию командой `crun spec`.', 'In `/root/box` create the default config.json with `crun spec`.'),
          check: { when: "files['/root/box/config.json'].type=f", fail: [{ if: "!files['/root/box/rootfs']", say: bi('Каталог rootfs пропал: верните машину кнопкой «Сбросить экран».', 'The rootfs directory is gone: reset the machine with “Reset this screen”.') }] },
          chips: 'crun spec',
          concepts: ['docker.bundle'],
          docRef: { page: 'help/crun', anchor: 'USAGE', line: 'spec' },
          hints: { H1: bi('Подкоманда рантайма, которая «генерирует файл конфигурации».', 'The runtime subcommand that “generates a configuration file”.') },
        },
        {
          id: 'namespaces',
          prompt: bi('Выведите config.json и найдите список пространств имён. Есть ли в нём `user`?', 'Print config.json and find the list of namespaces. Is `user` in it?'),
          check: { stdout: '"type": "network"' },
          chips: 'cat config.json',
          concepts: ['docker.bundle'],
          hints: { H1: bi('Ищите поле `linux.namespaces`: pid, network, ipc, uts, cgroup, mount — без user и time.', 'Look for the `linux.namespaces` field: pid, network, ipc, uts, cgroup, mount — no user and no time.') },
        },
        {
          id: 'create',
          prompt: bi('Создайте контейнер с именем `box`, не запуская программу, и посмотрите его состояние.', 'Create a container named `box` without starting the program, and look at its state.'),
          check: { stdout: '"status": "created"' },
          chips: 'crun create box && crun state box',
          concepts: ['docker.states'],
          hints: { H1: bi('Две подкоманды: одна создаёт, другая показывает состояние.', 'Two subcommands: one creates, the other shows the state.'), H2: bi('`crun create box`, затем `crun state box`.', '`crun create box`, then `crun state box`.') },
        },
        {
          id: 'start',
          prompt: bi('Запустите программу контейнера (`crun start box`). Вы окажетесь в `sh` внутри: проверьте `hostname` и `ps`, затем `exit` — и снова посмотрите состояние.', 'Start the container’s program (`crun start box`). You end up in `sh` inside: check `hostname` and `ps`, then `exit` — and look at the state again.'),
          check: { stdout: '"status": "stopped"' },
          chips: 'crun start box',
          concepts: ['docker.states'],
          hints: { H1: bi('После `exit` процесс контейнера завершился — значит, состояние уже не running.', 'After `exit` the container process ended — so the state is no longer running.'), H2: bi('`crun state box` после выхода покажет `"status": "stopped"`.', '`crun state box` after the exit shows `"status": "stopped"`.') },
        },
        {
          id: 'delete',
          prompt: bi('Удалите остановленный контейнер и убедитесь, что `crun list` пуст.', 'Delete the stopped container and make sure `crun list` is empty.'),
          check: { stdout: /^NAME PID[^\n]*\n?$/ },
          chips: 'crun delete box && crun list',
          concepts: ['docker.states'],
          hints: { H1: bi('Удалённый контейнер — не состояние: его просто нет в списке.', 'A deleted container is not a state: it is simply not in the list.') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('Найдите в `crun --help` подкоманду, которая показывает процессы внутри контейнера, и посмотрите на её описание.', 'Find in `crun --help` the subcommand that shows the processes inside a container and read its description.'),
      ref: { page: 'help/crun' },
      terminal: {
        setup: bundleSetup,
        task: { id: 'ps-sub', prompt: bi('Выведите справку crun так, чтобы на экране была строка про процессы контейнера.', 'Print crun’s help so that the line about the container’s processes is on screen.'), check: { stdout: 'show the processes in the container' }, docStep: 3, chips: 'crun --help' },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: anatomyQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi('Контейнер на диске — bundle: rootfs и config.json, где записаны пространства имён, лимиты и программа. Запускает его цепочка docker → dockerd → containerd → shim → runc; runc выходит, shim остаётся родителем. Состояния OCI: creating, created, running, stopped.', 'A container on disk is a bundle: rootfs and config.json holding the namespaces, limits and program. The chain docker → dockerd → containerd → shim → runc starts it; runc exits, the shim stays the parent. The OCI states: creating, created, running, stopped.'),
    },
  ],
};
