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
  prompt: { ru: `${symptom.ru} На какой границе поломка?`, en: `${symptom.en} On which boundary is the failure?` },
  options: (Object.keys(SIDE_NAMES) as (keyof typeof SIDE_NAMES)[]).map((s) => ({
    id: s,
    text: SIDE_NAMES[s],
    ...(s === right ? { correct: true } : { why: why[s] ?? bi('Симптом не про эту сторону: сначала найдите, что именно не дошло и куда.', 'The symptom is not about this side: first find what exactly did not arrive, and where.') }),
  })),
  explain,
});

export const boundaryQuiz: QuizItem[] = [
  whichSide('containers.q.side-arch', bi('`docker run trainer/tool:1.0` сразу завершается: `exec /usr/local/bin/tool: exec format error`.', '`docker run trainer/tool:1.0` exits at once: `exec /usr/local/bin/tool: exec format error`.'), 'kernel', { storage: bi('Файл на месте — иначе было бы «no such file or directory». Он просто для другого процессора.', 'The file is there — otherwise it would be “no such file or directory”. It is just for another CPU.') }, bi('Образ собран под arm64, а ядро и процессор хоста — x86_64. Своего ядра у контейнера нет.', 'The image is built for arm64 while the host kernel and CPU are x86_64. A container has no kernel of its own.')),
  whichSide('containers.q.side-reset', bi('Порт опубликован (`-p 8080:8000`), а `curl localhost:8080` — `Connection reset by peer`.', 'The port is published (`-p 8080:8000`), but `curl localhost:8080` says `Connection reset by peer`.'), 'network', { storage: bi('`Connection reset` — это не хранилище: файл тут ни при чём, отказ пришёл от сокета. Смотрите сеть, уровень L4.', '`Connection reset` is not storage: no file is involved, the refusal came from a socket. Look at the network, layer L4.') }, bi('Уровень L4: приложение слушает 127.0.0.1 внутри своего namespace, а DNAT ведёт на адрес контейнера.', 'Layer L4: the application listens on 127.0.0.1 inside its namespace, while DNAT leads to the container’s address.')),
  whichSide('containers.q.side-logs', bi('Приложение работает, а `docker logs app` пуст.', 'The application works, but `docker logs app` is empty.'), 'io', { process: bi('Процесс жив и делает своё дело — проблема в том, куда уходит его вывод.', 'The process is alive and doing its job — the problem is where its output goes.') }, bi('`docker logs` читает только stdout и stderr главного процесса; журнал в файле внутри контейнера туда не попадает.', '`docker logs` reads only the stdout and stderr of the main process; a log in a file inside the container never gets there.')),
  whichSide('containers.q.side-perm', bi('Приложение под UID 1001 пишет в `/data` (bind mount каталога хоста) и получает `Permission denied`.', 'An app running as UID 1001 writes to `/data` (a bind mount of a host directory) and gets `Permission denied`.'), 'identity', { storage: bi('Том смонтирован и виден — отказ из-за прав конкретного пользователя.', 'The mount is there and visible — the refusal is about one user’s permissions.') }, bi('UID — число, одинаковое внутри и снаружи: каталог хоста принадлежит root, у UID 1001 права на запись нет.', 'A UID is a number, the same inside and outside: the host directory belongs to root, and UID 1001 has no write permission.')),
  {
    id: 'containers.q.symptom-match',
    kind: 'match',
    concepts: ['docker.boundary'],
    prompt: bi('Сопоставьте симптом и границу.', 'Match the symptom and the boundary.'),
    pairs: [
      { id: 'k', left: 'exec format error', right: SIDE_NAMES.kernel },
      { id: 'n', left: 'Connection refused', right: SIDE_NAMES.network },
      { id: 's', left: bi('данные пропали после docker rm', 'data gone after docker rm'), right: SIDE_NAMES.storage },
      { id: 'p', left: bi('docker stop ждёт 10 секунд', 'docker stop waits 10 seconds'), right: SIDE_NAMES.process },
      { id: 'i', left: bi('docker logs пуст', 'docker logs is empty'), right: SIDE_NAMES.io },
      { id: 'c', left: 'Permission denied (bind mount)', right: SIDE_NAMES.identity },
    ],
  },
  {
    id: 'containers.q.dns-ask',
    kind: 'mcq',
    concepts: ['docker.network'],
    prompt: bi('Куда обращается `nslookup db` внутри контейнера пользовательской сети?', 'Where does `nslookup db` inside a container on a user-defined network go?'),
    options: [
      { id: '11', text: bi('К встроенному DNS Docker на 127.0.0.11', 'To Docker’s embedded DNS at 127.0.0.11'), correct: true },
      { id: 'host', text: bi('К DNS-серверу из /etc/resolv.conf хоста', 'To the DNS server from the host’s /etc/resolv.conf'), why: bi('Внешние имена встроенный DNS передаст дальше, но имена контейнеров знает только он.', 'The embedded DNS forwards outside names, but only it knows container names.') },
      { id: 'hosts', text: bi('В /etc/hosts контейнера', 'To the container’s /etc/hosts'), why: bi('В /etc/hosts только сам контейнер и localhost; соседей там нет.', '/etc/hosts holds only the container itself and localhost; the neighbours are not there.') },
    ],
  },
];

const tool = (f: Facts) => cs(f).some((c) => c.image.startsWith('trainer/tool') && c.state === 'exited' && c.exitCode === 0);

export const boundariesLesson: Lesson = {
  id: 'containers.boundaries',
  block: 'containers',
  title: bi('Шесть границ контейнера', 'The six boundaries of a container'),
  summary: bi('Контейнер не работает — с чего начать? С вопроса «на какой границе?»: ядро, сеть, хранилище, процесс, ввод-вывод, идентичность.', 'A container does not work — where to start? With the question “on which boundary?”: kernel, network, storage, process, I/O, identity.'),
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
      body: bi('В чате команды: «контейнер не работает». Это может значить что угодно — от неверного процессора до опечатки в имени переменной. Опытный инженер не перебирает все догадки подряд, а сначала отвечает на один вопрос: **на какой границе?**', 'In the team chat: “the container doesn’t work”. That can mean anything — from the wrong CPU to a typo in a variable name. An experienced engineer does not go through every guess in turn but first answers one question: **on which boundary?**'),
    },
    {
      id: 'six',
      kind: 'text',
      step: 'explain',
      title: bi('Шесть сторон', 'Six sides'),
      body: bi(
        'Контейнер — процесс, у которого с окружением шесть [[docker.boundary|границ]]. Через каждую что-то проходит, и почти любая поломка сидит ровно на одной.\n\n1. **Ядро хоста** — системные вызовы, архитектура процессора, параметры ядра. Ядро одно, поэтому образ должен подходить процессору хоста, а часть sysctl из контейнера не поменять.\n2. **Сеть** — пакеты: veth, мост, NAT наружу, `-p` как DNAT, DNS только в пользовательских сетях. Здесь же помогает вопрос из блока сетей: на каком уровне — L3, L4 или L7?\n3. **Хранилище** — файлы: записываемый слой живёт с контейнером, том — дольше, bind mount — это каталог хоста.\n4. **Процесс и сигналы** — PID 1, SIGTERM → ожидание → SIGKILL, зомби.\n5. **Ввод-вывод** — stdout и stderr процесса держит shim и передаёт драйверу журналов (json-file по умолчанию); из него читает `docker logs`. Это и есть [[docker.logs|журналы контейнера]]: что программа пишет в файл, туда не попадает, а без ротации журнал растёт, пока не съест диск.\n6. **Конфигурация и идентичность** — переменные, секреты, пользователь. UID — число, одинаковое внутри и снаружи: bind mount сохраняет числовых владельцев.\n\nПорядок работы: симптом → граница → причина → исправление.',
        'A container is a process with six [[docker.boundary|boundaries]] to its surroundings. Something passes through each, and almost any failure sits on exactly one.\n\n1. **The host kernel** — system calls, the CPU architecture, kernel parameters. There is one kernel, so the image must suit the host CPU, and some sysctls cannot be changed from a container.\n2. **The network** — packets: veth, a bridge, NAT outwards, `-p` as DNAT, DNS only on user-defined networks. The question from the networks block helps here too: on which layer — L3, L4 or L7?\n3. **Storage** — files: the writable layer lives with the container, a volume longer, a bind mount is a host directory.\n4. **Process and signals** — PID 1, SIGTERM → wait → SIGKILL, zombies.\n5. **I/O** — the shim holds the process’s stdout and stderr and passes them to the log driver (json-file by default); `docker logs` reads from it. These are the [[docker.logs|container logs]]: what the program writes into a file never gets there, and without rotation the log grows until it eats the disk.\n6. **Config and identity** — variables, secrets, the user. A UID is a number, the same inside and outside: a bind mount keeps numeric owners.\n\nThe order of work: symptom → boundary → cause → fix.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'containers.boundaries', caption: bi('Откройте любую сторону и покрутите её ручку. Включите поломку — сначала назовите сторону, потом читайте объяснение.', 'Open any side and turn its knob. Switch on a failure — first name the side, then read the explanation.') },
    { id: 'drill-quiz', kind: 'quiz', step: 'try', title: bi('Сначала граница', 'Boundary first'), items: ['containers.q.side-arch', 'containers.q.side-reset', 'containers.q.side-logs', 'containers.q.side-perm'] },
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
      intro: bi('Пять поломок, по одной на сторону. Для каждой сначала скажите себе, на какой она границе, потом чините. `docker ps -a`, `docker logs` и `docker inspect` — ваши первые инструменты.', 'Five failures, one per side. For each, first tell yourself which boundary it is on, then fix it. `docker ps -a`, `docker logs` and `docker inspect` are your first tools.'),
      tasks: [
        {
          id: 'b-kernel',
          prompt: bi('Контейнер `tool` сразу завершается. Узнайте почему и запустите утилиту так, чтобы она отработала с кодом 0. (Команда, выпускающая tool, публикует и вариант `1.0-multiarch`.)', 'The `tool` container exits at once. Find out why and run the utility so that it finishes with code 0. (The team that ships tool also publishes a `1.0-multiarch` variant.)'),
          check: { when: tool, fail: [{ if: "containers[name=tool].exitCode=255", say: bi('`exec format error`: образ собран под другой процессор. Посмотрите `docker manifest inspect trainer/tool:1.0`.', '`exec format error`: the image is built for another CPU. Look at `docker manifest inspect trainer/tool:1.0`.'), concept: 'docker.boundary' }] },
          chips: 'docker logs tool; docker run trainer/tool:1.0-multiarch',
          concepts: ['docker.boundary'],
          hints: { H1: bi('Граница — ядро хоста: процессор не выполняет чужие инструкции.', 'The boundary is the host kernel: the CPU does not run foreign instructions.'), H2: bi('Нужен образ с вариантом linux/amd64.', 'You need an image with a linux/amd64 variant.') },
        },
        {
          id: 'b-network',
          prompt: bi('`curl localhost:8080` к контейнеру `web` отвечает `Connection reset`. Почините так, чтобы он отвечал 200.', '`curl localhost:8080` to the `web` container answers `Connection reset`. Fix it so it answers 200.'),
          check: { when: "http['localhost:8080'].status=200", fail: [{ if: "containers[name=web].state=running", say: bi('Посмотрите `docker logs web`: на каком адресе слушает приложение? 127.0.0.1 внутри контейнера недоступен через DNAT.', 'Look at `docker logs web`: which address does the app listen on? 127.0.0.1 inside the container cannot be reached through DNAT.'), concept: 'docker.publish' }] },
          chips: 'docker rm -f web && docker run -d --name web -p 8080:8000 -e BIND=0.0.0.0 trainer/web:1.0',
          concepts: ['docker.boundary', 'docker.network'],
          docRef: web('reference/cli/docker/container/run', 'env'),
          hints: { H1: bi('Граница — сеть, уровень L4: сокет слушает не тот адрес.', 'The boundary is the network, layer L4: the socket listens on the wrong address.'), H2: bi('Приложение читает адрес из переменной BIND.', 'The application reads its address from the BIND variable.') },
        },
        {
          id: 'b-io',
          prompt: bi('`docker logs logger` пуст, хотя приложение пишет журнал. Сделайте так, чтобы строка «started» была видна в `docker logs`.', '`docker logs logger` is empty although the application writes a log. Make the line “started” visible in `docker logs`.'),
          check: { when: (f) => cs(f).some((c) => c.image.startsWith('trainer/logger') && c.logs.includes('started')) },
          chips: 'docker exec logger cat /app/logger.py; docker rm -f logger; docker run -d --name logger -e LOG_FILE=/dev/stdout trainer/logger:1.0',
          concepts: ['docker.logs'],
          docRef: web('engine/logging/configure'),
          hints: { H1: bi('Граница — ввод-вывод: `docker logs` читает только stdout и stderr.', 'The boundary is I/O: `docker logs` reads only stdout and stderr.'), H2: bi('Загляните в код приложения: путь к журналу берётся из переменной.', 'Look at the application code: the log path comes from a variable.') },
        },
        {
          id: 'b-identity',
          prompt: bi('Контейнер `app` работает под UID 1001 и не может писать в `/data` (это `/srv/data` хоста). Сделайте так, чтобы он мог, и докажите: создайте из контейнера файл `/data/ok`. Права 777 и `--user 0` — не решение.', 'The `app` container runs as UID 1001 and cannot write to `/data` (that is `/srv/data` on the host). Make it able to, and prove it: create `/data/ok` from the container. Mode 777 and `--user 0` are not a fix.'),
          check: {
            when: "files['/srv/data/ok'].uid=1001 && files['/srv/data'].mode!='0777'",
            fail: [{ if: "files['/srv/data'].mode='0777'", say: bi('777 открывает каталог всем пользователям машины. Дайте право ровно тому UID, которому оно нужно: `chown 1001 /srv/data`.', '777 opens the directory to every user of the machine. Give the right exactly to the UID that needs it: `chown 1001 /srv/data`.'), concept: 'docker.boundary' }],
          },
          chips: 'chown 1001 /srv/data && docker exec app touch /data/ok',
          concepts: ['docker.boundary'],
          hints: { H1: bi('Граница — идентичность: UID 1001 внутри — это UID 1001 и для ядра хоста.', 'The boundary is identity: UID 1001 inside is UID 1001 for the host kernel too.'), H2: bi('Владельца каталога на хосте меняет `chown`.', '`chown` changes the owner of the host directory.') },
        },
        {
          id: 'b-process',
          prompt: bi('Контейнер `front` (nginx) сразу перешёл в `Exited (0)`, хотя nginx запустился без ошибок. Запустите nginx так, чтобы контейнер работал.', 'The `front` container (nginx) went straight to `Exited (0)` although nginx started without errors. Start nginx so that the container keeps running.'),
          check: { when: (f) => cs(f).some((c) => c.state === 'running' && c.program?.comm === 'nginx') },
          chips: "docker rm front && docker run -d --name front nginx:1.30-alpine nginx -g 'daemon off;'",
          concepts: ['docker.boundary', 'docker.pid1'],
          hints: { H1: bi('Граница — процесс: nginx ушёл в фон, главный процесс завершился — а с ним и контейнер.', 'The boundary is the process: nginx went to the background, the main process exited — and the container with it.'), H2: bi('nginx нужно держать на переднем плане: `daemon off;` — или просто не менять CMD образа.', 'nginx must stay in the foreground: `daemon off;` — or simply keep the image’s CMD.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('Журнал контейнера `chatty` за неделю занял несколько гигабайт. Запустите его заново так, чтобы журнал занимал не больше трёх файлов по 10 МБ. В главе этого не было.', 'The log of the `chatty` container took several gigabytes in a week. Start it again so that the log takes at most three files of 10 MB. This was not in the chapter.'),
      ref: { page: 'help/docker-run' },
      terminal: {
        setup: dockerHost({}, { pull: ['nginx:1.30-alpine'] }),
        task: {
          id: 'log-rotation',
          prompt: bi('Контейнер `chatty` с ротацией журнала: 3 файла по 10 МБ.', 'A `chatty` container with log rotation: 3 files of 10 MB.'),
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
      title: bi('Итог', 'Summary'),
      body: bi('Сначала граница, потом причина. Шесть сторон: ядро, сеть, хранилище, процесс и сигналы, ввод-вывод, конфигурация и идентичность. Симптом почти всегда подсказывает сторону: `exec format error` — ядро, `Connection refused` — сеть, пустой `docker logs` — ввод-вывод, `Permission denied` в bind mount — идентичность.', 'Boundary first, cause second. Six sides: kernel, network, storage, process and signals, I/O, config and identity. The symptom almost always points to the side: `exec format error` — kernel, `Connection refused` — network, an empty `docker logs` — I/O, `Permission denied` in a bind mount — identity.'),
    },
  ],
};
