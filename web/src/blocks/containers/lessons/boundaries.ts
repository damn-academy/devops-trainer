// m08. The six boundaries of a container and the "container doesn't work" drills (04 §12, R7b).

import { bi, type Bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import { SIDE_NAMES } from '../explainers/boundaries';
import { dockerHost, SRC, web } from '../shared';

type C = { name: string; image: string; state: string; exitCode: number | null; logs: string; program: { comm: string } | null };
const cs = (f: Facts) => (f.containers as C[] | undefined) ?? [];

/** "On which boundary?" — the first goal of every drill (04 §12.2). */
const whichSide = (id: string, symptom: Bi, right: keyof typeof SIDE_NAMES, why: Partial<Record<keyof typeof SIDE_NAMES, Bi>>, explain: Bi): QuizItem => ({
  id,
  kind: 'mcq',
  concepts: ['docker.boundary'],
  prompt: { ru: `${symptom.ru} На какой границе контейнера находится эта поломка?`, en: `${symptom.en} On which boundary is the failure?` },
  options: (Object.keys(SIDE_NAMES) as (keyof typeof SIDE_NAMES)[]).map((s) => ({
    id: s,
    text: SIDE_NAMES[s],
    ...(s === right ? { correct: true } : { why: why[s] ?? bi('Симптом указывает на другую границу контейнера. Сначала выясните, что не дошло до цели и куда оно должно было попасть.', 'This symptom does not point to this boundary of the container. First find out what did not reach its target and where it was meant to go.') }),
  })),
  explain,
});

export const boundaryQuiz: QuizItem[] = [
  whichSide('containers.q.boundary-arch', bi('Команда `docker run trainer/tool:1.0` сразу завершается с сообщением `exec /usr/local/bin/tool: exec format error`.', '`docker run trainer/tool:1.0` exits at once: `exec /usr/local/bin/tool: exec format error`.'), 'kernel', { storage: bi('Файл на месте, иначе было бы сообщение «no such file or directory», но собран он для другого процессора.', 'The file is there, otherwise the message would be “no such file or directory”, but it is built for another CPU.') }, bi('Образ собран под arm64, а ядро и процессор хоста работают на x86_64. Своего ядра у контейнера нет, поэтому программу для чужого процессора ему выполнить нечем.', 'The image is built for arm64 while the host kernel and CPU are x86_64. A container has no kernel of its own, so it has nothing to run a program for another CPU with.')),
  whichSide('containers.q.boundary-reset', bi('Порт опубликован (`-p 8080:8000`), а `curl localhost:8080` отвечает `Connection reset by peer`.', 'The port is published (`-p 8080:8000`), but `curl localhost:8080` says `Connection reset by peer`.'), 'network', { storage: bi('Сообщение `Connection reset` не связано с хранилищем, потому что файлы тут ни при чём, а отказ пришёл от сетевого сокета. Поэтому смотреть нужно на сеть, на уровень L4.', '`Connection reset` is not storage: no file is involved, the refusal came from a socket. Look at the network, layer L4.') }, bi('Поломка находится на уровне L4. Приложение слушает адрес 127.0.0.1 внутри своего пространства имён, а правило DNAT направляет пакеты на адрес контейнера, где их никто не ждёт.', 'The failure sits on layer L4. The application listens on 127.0.0.1 inside its namespace, while DNAT sends packets to the container’s address, where nobody is waiting for them.')),
  whichSide('containers.q.boundary-logs', bi('Приложение работает, а `docker logs app` ничего не показывает.', 'The application works, but `docker logs app` is empty.'), 'io', { process: bi('Процесс работает и выполняет свою задачу, значит, искать нужно там, куда уходит его вывод.', 'The process is alive and doing its job — the problem is where its output goes.') }, bi('`docker logs` читает только stdout и stderr главного процесса, а журнал, который пишется в файл внутри контейнера, туда не попадает.', '`docker logs` reads only the stdout and stderr of the main process; a log in a file inside the container never gets there.')),
  whichSide('containers.q.boundary-perm', bi('Приложение работает под UID 1001, пишет в `/data` (это bind mount каталога хоста) и получает `Permission denied`.', 'An app running as UID 1001 writes to `/data` (a bind mount of a host directory) and gets `Permission denied`.'), 'identity', { storage: bi('Каталог смонтирован и виден, а отказ вызван правами конкретного пользователя.', 'The mount is there and visible — the refusal is about one user’s permissions.') }, bi('UID остаётся одним и тем же числом внутри и снаружи контейнера. Каталог хоста принадлежит root, и у UID 1001 нет права записи в него.', 'A UID is a number, the same inside and outside: the host directory belongs to root, and UID 1001 has no write permission.')),
  {
    id: 'containers.q.symptom-match',
    kind: 'match',
    concepts: ['docker.boundary'],
    prompt: bi('Сопоставьте симптом с границей контейнера.', 'Match the symptom and the boundary.'),
    pairs: [
      { id: 'k', left: 'exec format error', right: SIDE_NAMES.kernel },
      { id: 'n', left: 'Connection refused', right: SIDE_NAMES.network },
      { id: 's', left: bi('данные пропали после docker rm', 'data gone after docker rm'), right: SIDE_NAMES.storage },
      { id: 'p', left: bi('docker stop ждёт 10 секунд', 'docker stop waits 10 seconds'), right: SIDE_NAMES.process },
      { id: 'i', left: bi('docker logs ничего не показывает', 'docker logs is empty'), right: SIDE_NAMES.io },
      { id: 'c', left: 'Permission denied (bind mount)', right: SIDE_NAMES.identity },
    ],
  },
  {
    id: 'containers.q.dns-ask',
    kind: 'mcq',
    concepts: ['docker.network'],
    prompt: bi('К кому обращается `nslookup db` внутри контейнера в пользовательской сети?', 'Where does `nslookup db` inside a container on a user-defined network go?'),
    options: [
      { id: '11', text: bi('К встроенному DNS Docker на адресе 127.0.0.11', 'To Docker’s embedded DNS at 127.0.0.11'), correct: true },
      { id: 'host', text: bi('К DNS-серверу из файла /etc/resolv.conf хоста', 'To the DNS server from the host’s /etc/resolv.conf'), why: bi('Внешние имена встроенный DNS передаст дальше, но имена контейнеров знает только он сам.', 'The embedded DNS forwards outside names, but only it knows container names.') },
      { id: 'hosts', text: bi('К файлу /etc/hosts контейнера', 'To the container’s /etc/hosts'), why: bi('В /etc/hosts записаны только сам контейнер и localhost, а соседних контейнеров там нет.', '/etc/hosts holds only the container itself and localhost; the neighbours are not there.') },
    ],
  },
];

// A run with --rm leaves no container behind, so a successful run is also recognised by its output.
const tool = (f: Facts) => cs(f).some((c) => c.image.startsWith('trainer/tool') && c.state === 'exited' && c.exitCode === 0) || (f.term?.main ?? []).some((r) => r.exit === 0 && /^tool \d+\.\d+\.\d+ \(linux\//m.test(r.out));

export const boundariesLesson: Lesson = {
  id: 'containers.boundaries',
  block: 'containers',
  title: bi('Шесть границ контейнера', 'The six boundaries of a container'),
  summary: bi('Контейнер не работает, и непонятно, с чего начать. Начинать нужно с вопроса, на какой границе находится поломка: на ядре, в сети, в хранилище, в процессе, во вводе-выводе или в настройках и пользователе.', 'A container does not work, and it is unclear where to start. Start with the question of which boundary the failure sits on: the kernel, the network, storage, the process, I/O, or config and the user.'),
  introduces: ['docker.boundary', 'docker.logs'],
  uses: ['docker.container', 'docker.volume', 'docker.network', 'docker.pid1', 'docker.env', 'docker.publish'],
  tier: 'core',
  minutes: 45,
  sources: {
    en: [SRC.logging, SRC.bridge, SRC.volumes, SRC.pidNs, { title: 'Packet filtering and firewalls — Docker Docs', url: 'https://docs.docker.com/engine/network/packet-filtering-firewalls/' }],
    ru: [SRC.k8sRuContainers, SRC.habrOverlay, SRC.habrUnshare],
  },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('В чате команды пишут: «контейнер не работает». За этой фразой может стоять что угодно, от образа для другого процессора до опечатки в имени переменной. Опытный инженер не перебирает догадки подряд, а сначала отвечает на один вопрос: **на какой границе?**', 'In the team chat: “the container doesn’t work”. That can mean anything — from the wrong CPU to a typo in a variable name. An experienced engineer does not go through every guess in turn but first answers one question: **on which boundary?**'),
    },
    {
      id: 'six',
      kind: 'text',
      step: 'explain',
      title: bi('Шесть границ контейнера', 'Six boundaries'),
      body: bi(
        'Процесс контейнера соприкасается с окружающей системой в шести местах, на шести [[docker.boundary|границах]]. Через каждую из них что-то проходит, и почти любая поломка находится ровно на одной. На схеме ниже эти границы нарисованы как шесть сторон многоугольника вокруг процесса.\n\n1. **Ядро хоста.** Через эту границу проходят системные вызовы, и здесь важны архитектура процессора и параметры ядра. Ядро одно на всех, поэтому образ должен подходить процессору хоста, а часть параметров sysctl из контейнера поменять нельзя.\n2. **Сеть.** Через неё проходят пакеты: пара veth, мост, NAT наружу, `-p` в виде правила DNAT и DNS, который есть только в пользовательских сетях. Здесь помогает вопрос из блока сетей: на каком уровне поломка, L3, L4 или L7?\n3. **Хранилище.** Через эту границу проходят файлы. Записываемый слой существует, пока существует контейнер, том хранится дольше, а bind mount остаётся обычным каталогом хоста.\n4. **Процесс и сигналы.** Здесь важно, какая программа работает как PID 1, как проходит цепочка из SIGTERM, ожидания и SIGKILL и кто забирает коды выхода завершившихся процессов, чтобы не копились зомби.\n5. **Ввод-вывод.** Потоки stdout и stderr процесса держит shim и передаёт драйверу журналов (по умолчанию json-file), а `docker logs` читает их оттуда. Записи, которые проходят этот путь, и называют [[docker.logs|журналами контейнера]]. То, что программа пишет в файл, туда не попадает, а без ротации журнал растёт, пока не займёт весь диск.\n6. **Настройки и пользователь.** К этой границе относятся переменные окружения, секреты и пользователь, от имени которого работает процесс. UID остаётся одним и тем же числом внутри и снаружи контейнера, а bind mount сохраняет числовых владельцев файлов.\n\nРаботать с поломкой стоит по порядку: сначала заметить симптом, затем найти границу, потом причину и только после этого исправлять.',
        'A container is a process with six [[docker.boundary|boundaries]] to its surroundings. Something passes through each, and almost any failure sits on exactly one.\n\n1. **The host kernel** — system calls, the CPU architecture, kernel parameters. There is one kernel, so the image must suit the host CPU, and some sysctls cannot be changed from a container.\n2. **The network** — packets: veth, a bridge, NAT outwards, `-p` as DNAT, DNS only on user-defined networks. The question from the networks block helps here too: on which layer — L3, L4 or L7?\n3. **Storage** — files: the writable layer lives with the container, a volume longer, a bind mount is a host directory.\n4. **Process and signals** — PID 1, SIGTERM → wait → SIGKILL, zombies.\n5. **I/O** — the shim holds the process’s stdout and stderr and passes them to the log driver (json-file by default); `docker logs` reads from it. These are the [[docker.logs|container logs]]: what the program writes into a file never gets there, and without rotation the log grows until it eats the disk.\n6. **Config and identity** — variables, secrets, the user. A UID is a number, the same inside and outside: a bind mount keeps numeric owners.\n\nThe order of work: symptom → boundary → cause → fix.',
      ),
    },
    { id: 'look-intro', kind: 'text', step: 'look', title: bi('Как шесть границ контейнера нарисованы на схеме', 'How the six boundaries of a container are drawn in the diagram'), body: bi('Схема ниже ставит процесс контейнера в центр и окружает его шестью границами: слева сверху вниз ядро, хранилище и ввод-вывод, справа сеть, процесс с сигналами и настройки с пользователем. Рядом с некоторыми границами лежит та часть хоста, к которой они ведут: мост и NAT, диск, файл журнала, shim.', 'The diagram below puts the container process in the centre and surrounds it with six boundaries: on the left, top to bottom, the kernel, storage and I/O; on the right the network, process and signals, and config and the user. Next to some boundaries lies the part of the host they lead to: the bridge and NAT, the disk, the log file, the shim.') },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'containers.boundaries', howto: bi('Сначала на схеме только процесс. Нажмите «Начать с первого шага» и переходите дальше кнопкой «Шаг вперёд». Границы появятся по одной, облачко у каждой скажет, что через неё проходит, а карточка на линии покажет пример: системный вызов, пакет, запись в файл, сигнал. Зелёная рамка означает, что при текущих настройках граница в порядке, а жёлтая предупреждает, что на этой границе будут проблемы.\n\nПосле первого прохода меняйте в «Параметрах» настройки: режим сети, место для каталога `/data`, куда приложение пишет журнал, UID процесса и процессор, под который собран образ. Подпись под схемой каждый раз объяснит, что изменилось. Потом включайте поломки в блоке «Сломать» по одной. Перед каждой поломкой схема спросит, на какой границе она находится. Ответьте сами, а потом посмотрите, какая граница загорится красным и какое сообщение напечатает настоящий инструмент.', 'At first only the process is shown. Press “Start from the first step” and go on with “Step forward”: the boundaries appear one by one, the callout at each says what crosses it, and the card on the line shows an example: a system call, a packet, a file write, a signal. A green outline means the boundary is fine with the current settings, a yellow one that there will be trouble here.\n\nAfter the first pass change the settings in “Parameters”: the network mode, where `/data` lives, where the app writes its log, the process UID and the CPU the image is built for. The caption under the diagram explains each change. Then switch on the breaks in “Break it” one at a time. Before each the diagram asks which boundary it sits on: answer yourself, then see which boundary lights up red and what message the real tool prints.'), caption: bi('Пять из шести поломок схемы ждут вас в практике ниже, только чинить их нужно уже на настоящей машине. Для каждой сначала скажите себе, на какой она границе, как делали на схеме, а потом загляните на эту границу командами: `docker logs`, `docker inspect`, `docker exec … id`.', 'Five of these breaks wait for you in the lab below, only now you fix them on a machine. For each, first tell yourself which boundary it is on, as you did in the diagram, then look at that boundary with commands: `docker logs`, `docker inspect`, `docker exec … id`.') },
    { id: 'drill-quiz', kind: 'quiz', step: 'try', title: bi('Сначала найдите границу', 'Boundary first'), items: ['containers.q.boundary-arch', 'containers.q.boundary-reset', 'containers.q.boundary-logs', 'containers.q.boundary-perm'] },
    {
      id: 'drills',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost(
        { user: 'root', files: [{ path: '/srv/data', type: 'd', owner: 'root', mode: '0755' }] },
        {
          pull: ['alpine:3.22', 'nginx:1.30-alpine', 'trainer/web:1.0', 'trainer/logger:1.0'],
          run: ['docker run -d --name tool trainer/tool:1.0', 'docker run -d --name web -p 8080:8000 trainer/web:1.0', 'docker run -d --name logger trainer/logger:1.0', 'docker run -d --name app -u 1001 -v /srv/data:/data alpine:3.22 sleep 3600', 'docker run -d --name front nginx:1.30-alpine nginx'],
        },
      ),
      intro: bi('На этой машине вас ждут пять поломок, и каждая находится на своей границе. Прежде чем чинить, назовите эту границу. Начинать поиск удобнее всего с команд `docker ps -a`, `docker logs` и `docker inspect`.', 'Five failures, one per boundary. For each, first tell yourself which boundary it is on, then fix it. `docker ps -a`, `docker logs` and `docker inspect` are your first tools.'),
      tasks: [
        {
          id: 'b-kernel',
          prompt: bi('Контейнер `tool` сразу завершается. Узнайте почему и запустите утилиту так, чтобы она отработала с кодом 0. Команда разработчиков, которая выпускает tool, публикует ещё и вариант `1.0-multiarch`.', 'The `tool` container exits at once. Find out why and run the utility so that it finishes with code 0. (The team that ships tool also publishes a `1.0-multiarch` variant.)'),
          check: { when: tool, fail: [{ if: "containers[name=tool].exitCode=255", say: bi('Сообщение `exec format error` значит, что образ собран под другой процессор. Посмотрите вывод `docker manifest inspect trainer/tool:1.0`.', '`exec format error`: the image is built for another CPU. Look at `docker manifest inspect trainer/tool:1.0`.'), concept: 'docker.boundary' }] },
          chips: 'docker logs tool; docker run trainer/tool:1.0-multiarch',
          concepts: ['docker.boundary'],
          hints: { H1: bi('Поломка находится на границе ядра хоста, потому что процессор не выполняет машинные команды, написанные для другой архитектуры.', 'The boundary is the host kernel: the CPU does not run foreign instructions.'), H2: bi('Нужен образ, у которого есть вариант для linux/amd64.', 'You need an image with a linux/amd64 variant.') },
        },
        {
          id: 'b-network',
          prompt: bi('Запрос `curl localhost:8080` к контейнеру `web` заканчивается `Connection reset`. Почините контейнер так, чтобы он отвечал кодом 200.', '`curl localhost:8080` to the `web` container answers `Connection reset`. Fix it so it answers 200.'),
          check: { when: "http['localhost:8080'].status=200", fail: [{ if: "containers[name=web].state=running", say: bi('Посмотрите `docker logs web`: на каком адресе слушает приложение? Правило DNAT не доводит пакеты до адреса 127.0.0.1 внутри контейнера.', 'Look at `docker logs web`: which address does the app listen on? 127.0.0.1 inside the container cannot be reached through DNAT.'), concept: 'docker.publish' }] },
          chips: 'docker rm -f web && docker run -d --name web -p 8080:8000 -e BIND=0.0.0.0 trainer/web:1.0',
          concepts: ['docker.boundary', 'docker.network'],
          docRef: web('reference/cli/docker/container/run', 'env'),
          hints: { H1: bi('Поломка находится на границе сети, на уровне L4, потому что сокет приложения слушает не тот адрес.', 'The boundary is the network, layer L4: the socket listens on the wrong address.'), H2: bi('Адрес, на котором слушать, приложение читает из переменной BIND.', 'The application reads its address from the BIND variable.') },
        },
        {
          id: 'b-io',
          prompt: bi('Команда `docker logs logger` ничего не показывает, хотя приложение пишет журнал. Сделайте так, чтобы строка «started» была видна в `docker logs`.', '`docker logs logger` is empty although the application writes a log. Make the line “started” visible in `docker logs`.'),
          check: { when: (f) => cs(f).some((c) => c.image.startsWith('trainer/logger') && c.logs.includes('started')) },
          chips: 'docker exec logger cat /app/logger.py; docker rm -f logger; docker run -d --name logger -e LOG_FILE=/dev/stdout trainer/logger:1.0',
          concepts: ['docker.logs'],
          docRef: web('engine/logging/configure'),
          hints: { H1: bi('Поломка находится на границе ввода-вывода, потому что `docker logs` читает только stdout и stderr.', 'The boundary is I/O: `docker logs` reads only stdout and stderr.'), H2: bi('Загляните в код приложения и найдите, из какой переменной оно берёт путь к файлу журнала.', 'Look at the application code and find which variable it takes the log path from.') },
        },
        {
          id: 'b-identity',
          prompt: bi('Контейнер `app` работает под UID 1001 и не может писать в каталог `/data`, который на хосте называется `/srv/data`. Дайте ему такое право и докажите, что всё работает: создайте из контейнера файл `/data/ok`. Права 777 и `--user 0` решением не считаются.', 'The `app` container runs as UID 1001 and cannot write to `/data` (that is `/srv/data` on the host). Make it able to, and prove it: create `/data/ok` from the container. Mode 777 and `--user 0` are not a fix.'),
          check: {
            when: "files['/srv/data/ok'].uid=1001 && files['/srv/data'].mode!='0777'",
            fail: [{ if: "files['/srv/data'].mode='0777'", say: bi('Права 777 открывают каталог всем пользователям машины. Дайте право записи только тому UID, которому оно нужно, командой `chown 1001 /srv/data`.', '777 opens the directory to every user of the machine. Give the right exactly to the UID that needs it: `chown 1001 /srv/data`.'), concept: 'docker.boundary' }],
          },
          chips: 'chown 1001 /srv/data && docker exec app touch /data/ok',
          concepts: ['docker.boundary'],
          hints: { H1: bi('Поломка находится на границе настроек и пользователя, потому что UID 1001 внутри контейнера остаётся UID 1001 и для ядра хоста.', 'The boundary is identity: UID 1001 inside is UID 1001 for the host kernel too.'), H2: bi('Владельца каталога на хосте меняет команда `chown`.', '`chown` changes the owner of the host directory.') },
        },
        {
          id: 'b-process',
          prompt: bi('Контейнер `front` с nginx сразу перешёл в состояние `Exited (0)`, хотя nginx запустился без ошибок. Запустите nginx так, чтобы контейнер продолжал работать.', 'The `front` container (nginx) went straight to `Exited (0)` although nginx started without errors. Start nginx so that the container keeps running.'),
          check: { when: (f) => cs(f).some((c) => c.state === 'running' && c.program?.comm === 'nginx') },
          chips: "docker rm front && docker run -d --name front nginx:1.30-alpine nginx -g 'daemon off;'",
          concepts: ['docker.boundary', 'docker.pid1'],
          hints: { H1: bi('Поломка находится на границе процесса. nginx ушёл в фон, главный процесс завершился, а вместе с ним завершился и контейнер.', 'The boundary is the process: nginx went to the background, the main process exited — and the container with it.'), H2: bi('nginx нужно держать на переднем плане директивой `daemon off;` или вовсе не менять CMD образа.', 'nginx must stay in the foreground: `daemon off;` — or simply keep the image’s CMD.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('Журнал контейнера `chatty` за неделю занял несколько гигабайт. Запустите контейнер заново так, чтобы журнал занимал не больше трёх файлов по 10 МБ. Как это сделать, урок не рассказывал, поэтому ответ ищите в справке.', 'The log of the `chatty` container took several gigabytes in a week. Start it again so that the log takes at most three files of 10 MB. The lesson did not show how, so look for the answer in the help.'),
      ref: { page: 'help/docker-run' },
      terminal: {
        setup: dockerHost({}, { pull: ['nginx:1.30-alpine'] }),
        task: {
          id: 'log-rotation',
          prompt: bi('Запустите контейнер `chatty` с ротацией журнала, при которой журнал занимает не больше трёх файлов по 10 МБ.', 'Run a `chatty` container with log rotation that keeps the log within three files of 10 MB.'),
          check: { when: "containers[name=chatty].hostConfig.logConfig.config['max-size']=10m && containers[name=chatty].hostConfig.logConfig.config['max-file']=3" },
          docStep: 4,
          beyond: true,
          solutionTokens: ['--log-opt', 'max-size', 'max-file'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['containers.q.symptom-match', 'containers.q.dns-ask'] },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог урока', 'Summary'),
      body: bi('Сначала найдите границу, а уже потом причину. У контейнера шесть границ: ядро, сеть, хранилище, процесс и сигналы, ввод-вывод, настройки и пользователь. Симптом почти всегда подсказывает границу: `exec format error` указывает на ядро, `Connection reset` на сеть, пустой `docker logs` на ввод-вывод, а `Permission denied` в bind mount на пользователя.', 'Boundary first, cause second. Six boundaries: kernel, network, storage, process and signals, I/O, config and identity. The symptom almost always points to the boundary: `exec format error` — kernel, `Connection refused` — network, an empty `docker logs` — I/O, `Permission denied` in a bind mount — identity.'),
    },
  ],
};
