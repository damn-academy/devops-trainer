// X5 (04 §6.6, §12.1, R7b): the six boundaries of a container. A container
// is a process with six borders to the world around it: the host kernel, the
// network, storage, process and signals, input/output and logs, config and
// identity. Almost every failure sits on one of them, so the first question
// of diagnosis is "on which boundary?". Each side opens with its own knob;
// each break is a real symptom and asks you to name the side first.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';

type Side = 'all' | 'kernel' | 'network' | 'storage' | 'process' | 'io' | 'identity';
type P = { side: Side; net: string; data: string; logs: string; uid: number; platform: string };

const SIDES: Exclude<Side, 'all'>[] = ['kernel', 'network', 'storage', 'process', 'io', 'identity'];
const NODE: Record<Exclude<Side, 'all'>, string> = { kernel: 'b-kernel', network: 'b-net', storage: 'b-store', process: 'b-proc', io: 'b-io', identity: 'b-id' };
const EDGE: Record<Exclude<Side, 'all'>, string> = { kernel: 'e-kernel', network: 'e-net', storage: 'e-store', process: 'e-proc', io: 'e-io', identity: 'e-id' };

export const SIDE_NAMES: Record<Exclude<Side, 'all'>, Bi> = {
  kernel: bi('ядро хоста', 'host kernel'),
  network: bi('сеть', 'network'),
  storage: bi('хранилище', 'storage'),
  process: bi('процесс и сигналы', 'process and signals'),
  io: bi('ввод-вывод и журналы', 'I/O and logs'),
  identity: bi('конфигурация и идентичность', 'config and identity'),
};

const sideOptions = SIDES.map((s) => ({ id: s, text: SIDE_NAMES[s] }));
const ask = (prompt: Bi, right: Exclude<Side, 'all'>) => ({ prompt, options: sideOptions, resolve: () => right });
const dd = (page: string, anchor?: string) => ({ page: `web/docs.docker.com/${page}`, anchor });

/** What one side looks like under the current knobs: the caption and the value on the side. */
export function sideView(side: Exclude<Side, 'all'>, p: P): { caption: Bi; value: string; ok: boolean } {
  switch (side) {
    case 'kernel':
      return p.platform === 'arm64'
        ? { caption: bi('Образ собран под arm64, а ядро хоста — x86_64. Своего ядра у контейнера нет, процессор чужие инструкции не выполнит: `exec format error`.', 'The image is built for arm64 and the host kernel is x86_64. A container has no kernel of its own and the CPU cannot run foreign instructions: `exec format error`.'), value: 'exec format error', ok: false }
        : { caption: bi('Через эту сторону идут системные вызовы. Ядро одно, поэтому `uname -r` внутри и снаружи совпадает, платформа образа должна совпасть с процессором хоста, а sysctl делятся на принадлежащие namespace (net.*) и общие для хоста.', 'System calls go through this side. There is one kernel, so `uname -r` is the same inside and out, the image platform must match the host CPU, and sysctls split into those owned by a namespace (net.*) and those of the whole host.'), value: 'linux/amd64 · 6.12', ok: true };
    case 'network': {
      const map: Record<string, { caption: Bi; value: string; ok: boolean }> = {
        bridge: { caption: bi('Сеть bridge по умолчанию: veth в мост docker0, адрес 172.17.0.x, наружу — NAT, внутрь — только через `-p` (правило DNAT). Встроенного DNS по именам контейнеров здесь нет.', 'The default bridge network: a veth into the docker0 bridge, an address 172.17.0.x, NAT outwards, inwards only through `-p` (a DNAT rule). No embedded DNS for container names here.'), value: 'docker0 · 172.17.0.2', ok: true },
        user: { caption: bi('Пользовательская сеть (`docker network create app`): свой мост и подсеть, и встроенный DNS на 127.0.0.11 — контейнеры находят друг друга по имени.', 'A user-defined network (`docker network create app`): its own bridge and subnet, and the embedded DNS at 127.0.0.11 — containers find each other by name.'), value: 'app · 172.18.0.2 · DNS 127.0.0.11', ok: true },
        host: { caption: bi('`--network host`: своего net namespace нет, процесс слушает порты хоста напрямую; `-p` не нужен и не работает.', '`--network host`: no net namespace of its own, the process listens on the host’s ports directly; `-p` is not needed and does nothing.'), value: 'host network', ok: true },
        none: { caption: bi('`--network none`: в namespace только lo. Ни наружу, ни внутрь.', '`--network none`: only lo in the namespace. Nothing in, nothing out.'), value: 'lo only', ok: false },
      };
      return map[p.net] ?? map.bridge;
    }
    case 'storage': {
      const map: Record<string, { caption: Bi; value: string; ok: boolean }> = {
        upper: { caption: bi('`/data` лежит в записываемом слое: он живёт столько же, сколько контейнер. `docker rm` — и данных нет; новый `docker run` начнёт с образа.', '`/data` lives in the writable layer: it lives exactly as long as the container. `docker rm` and the data is gone; a new `docker run` starts from the image.'), value: 'upper: gone on rm', ok: false },
        volume: { caption: bi('Том (`-v data:/data`): каталог, которым управляет Docker, вне жизни контейнера. Удалили контейнер, запустили новый с тем же томом — данные на месте.', 'A volume (`-v data:/data`): a directory Docker manages, outside the container’s life. Remove the container, start a new one with the same volume — the data is there.'), value: 'volume data: survives rm', ok: true },
        bind: { caption: bi('Bind mount (`-v /srv/data:/data`): каталог хоста как есть. Правки видны с обеих сторон, а файлы образа в этом пути закрыты.', 'A bind mount (`-v /srv/data:/data`): a host directory as it is. Edits show on both sides, and the image’s files at that path are hidden.'), value: '/srv/data ↔ /data', ok: true },
        tmpfs: { caption: bi('tmpfs (`--tmpfs /data`): в памяти. Быстро и не на диске — и пропадает при остановке.', 'tmpfs (`--tmpfs /data`): in memory. Fast and never on disk — and gone when the container stops.'), value: 'tmpfs: gone on stop', ok: false },
      };
      return map[p.data] ?? map.volume;
    }
    case 'process':
      return { caption: bi('Через эту сторону приходят сигналы от shim и уходят код выхода и дети. PID 1 без обработчика сигнала его не получает — отсюда `docker stop` за 10 секунд и код 137; зомби копятся, если PID 1 не забирает детей. Помогает `--init`.', 'Signals from the shim come in through this side; the exit code and children go out. PID 1 without a handler never gets the signal — hence `docker stop` taking 10 seconds and code 137; zombies pile up if PID 1 does not reap children. `--init` helps.'), value: 'PID 1 · SIGTERM → 10 s → SIGKILL', ok: true };
    case 'io':
      return p.logs === 'file'
        ? { caption: bi('Приложение пишет журнал в файл внутри контейнера. Shim держит только stdout и stderr — `docker logs` пуст. Образ nginx решает это ссылкой access.log → /dev/stdout.', 'The application writes its log into a file inside the container. The shim holds only stdout and stderr — `docker logs` is empty. The nginx image solves it with a link access.log → /dev/stdout.'), value: 'docker logs: (empty)', ok: false }
        : { caption: bi('stdout и stderr процесса держит shim и отдаёт драйверу журналов (json-file по умолчанию), тот пишет в файл на хосте. Отсюда `docker logs`. Ротации по умолчанию нет: max-size и max-file задают её.', 'The shim holds the process’s stdout and stderr and passes them to the log driver (json-file by default), which writes a file on the host. That is where `docker logs` reads. There is no rotation by default: max-size and max-file set it.'), value: 'stdout → json-file', ok: true };
    case 'identity':
      return p.uid !== 0
        ? { caption: { ru: `Процесс работает под UID ${p.uid}, а каталог bind mount на хосте принадлежит root и открыт 755. UID — это число, одинаковое внутри и снаружи (без user namespace): запись — Permission denied.`, en: `The process runs as UID ${p.uid}, and the bind-mounted host directory belongs to root with mode 755. A UID is a number, the same inside and outside (without a user namespace): writing gives Permission denied.` }, value: `uid ${p.uid} → root 755: EACCES`, ok: false }
        : { caption: bi('Переменные окружения, секреты и пользователь. Без user namespace root в контейнере — тот же UID 0 в ядре, только урезанный capabilities; файлы, созданные им в bind mount, на хосте принадлежат root.', 'Environment variables, secrets and the user. Without a user namespace, root in a container is the same UID 0 in the kernel, only cut down by capabilities; files it creates in a bind mount belong to root on the host.'), value: 'uid 0 · env · secrets', ok: true };
  }
}

export const boundariesModel = defineModel<P>({
  id: 'containers.boundaries',
  block: 'containers',
  title: bi('Шесть границ контейнера', 'The six boundaries of a container'),
  summary: bi('Контейнер — процесс, у которого с окружением шесть границ. Откройте любую сторону, покрутите её ручку; включите поломку — и сначала назовите сторону, где она сидит.', 'A container is a process with six boundaries to its surroundings. Open any side and turn its knob; switch on a failure — and first name the side it sits on.'),
  concepts: ['docker.boundary', 'docker.volume', 'docker.network', 'docker.logs'],
  diagram: {
    width: 960,
    height: 540,
    nodes: [
      { id: 'proc', label: bi('процесс контейнера', 'container process'), sub: 'nginx · PID 1 · 4123', family: 'process', x: 392, y: 232, w: 176, h: 72, card: { what: bi('В центре — обычный процесс хоста в своих namespaces и cgroup. Двойной PID: 1 внутри, 4123 на хосте.', 'In the centre is an ordinary host process in its own namespaces and cgroup. Two PIDs: 1 inside, 4123 on the host.'), who: bi('runc запустил его по просьбе Docker.', 'runc started it on Docker’s request.'), see: 'docker top web' } },
      { id: 'b-kernel', label: SIDE_NAMES.kernel, sub: 'syscalls · arch · sysctl', family: 'kernel', x: 24, y: 40, w: 264, h: 64, card: { what: bi('Системные вызовы, архитектура процессора, параметры ядра. Типичные поломки: `exec format error` (образ arm64 на amd64), `sysctl -w` внутри — Read-only file system.', 'System calls, the CPU architecture, kernel parameters. Typical failures: `exec format error` (an arm64 image on amd64), `sysctl -w` inside — Read-only file system.'), who: bi('Ядро хоста — одно на все контейнеры.', 'The host kernel — one for all containers.'), see: "docker image inspect -f '{{.Architecture}}' IMAGE" } },
      { id: 'b-net', label: SIDE_NAMES.network, sub: 'veth · docker0 · NAT · DNS', family: 'l3', x: 672, y: 40, w: 264, h: 64, card: { what: bi('Пакеты. Типичные поломки: приложение слушает 127.0.0.1; в сети по умолчанию нет DNS по именам; порт хоста занят; на хосте выключен ip_forward.', 'Packets. Typical failures: the application listens on 127.0.0.1; the default network has no DNS for names; the host port is taken; ip_forward is off on the host.'), who: bi('Docker настраивает сеть ядра: veth, мост, правила netfilter.', 'Docker configures the kernel’s network: veth, a bridge, netfilter rules.'), see: 'docker network inspect bridge', doc: dd('engine/network/drivers/bridge', 'differences') } },
      { id: 'b-store', label: SIDE_NAMES.storage, sub: 'upper · volume · bind · tmpfs', family: 'store', x: 24, y: 232, w: 264, h: 64, card: { what: bi('Файлы. Типичные поломки: данные пропали после `docker rm`; bind mount закрыл файлы образа.', 'Files. Typical failures: data gone after `docker rm`; a bind mount hid the image’s files.'), who: bi('Docker и ядро (overlay, монтирования).', 'Docker and the kernel (overlay, mounts).'), see: "docker inspect -f '{{json .Mounts}}' web", doc: dd('engine/storage/volumes') } },
      { id: 'b-proc', label: SIDE_NAMES.process, sub: 'PID 1 · SIGTERM · zombies', family: 'process', x: 672, y: 232, w: 264, h: 64, card: { what: bi('Сигналы, коды выхода, дети. Типичные поломки: `docker stop` ждёт 10 с; копятся зомби; демон ушёл в фон и контейнер завершился.', 'Signals, exit codes, children. Typical failures: `docker stop` waits 10 s; zombies pile up; a daemon went to the background and the container exited.'), who: bi('shim и ядро.', 'The shim and the kernel.'), see: 'docker inspect -f {{.State.ExitCode}} web' } },
      { id: 'b-io', label: SIDE_NAMES.io, sub: 'stdout · stderr → log driver', family: 'flow', x: 24, y: 424, w: 264, h: 64, card: { what: bi('Потоки вывода. Типичные поломки: `docker logs` пуст — журнал пишется в файл; журнал без ротации съел диск; Python буферизует stdout.', 'Output streams. Typical failures: `docker logs` is empty — the log goes to a file; a log without rotation filled the disk; Python buffers stdout.'), who: bi('shim и драйвер журналов.', 'The shim and the log driver.'), see: 'docker logs web', doc: dd('engine/logging/configure') } },
      { id: 'b-id', label: SIDE_NAMES.identity, sub: 'env · secrets · UID', family: 'user', x: 672, y: 424, w: 264, h: 64, card: { what: bi('Переменные, секреты, пользователь. Типичные поломки: Permission denied в bind mount; секрет остался в слое образа; опечатка в имени переменной.', 'Variables, secrets, the user. Typical failures: Permission denied in a bind mount; a secret left in an image layer; a typo in a variable name.'), who: bi('Тот, кто запускает: `-e`, `--env-file`, `-u`.', 'Whoever runs it: `-e`, `--env-file`, `-u`.'), see: 'docker exec web id; docker exec web env' } },
      { id: 'x-net', label: bi('мост и NAT хоста', 'host bridge and NAT'), sub: 'docker0 · DNAT 8080→80', family: 'l3', shape: 'pill', x: 672, y: 144, w: 264, h: 48, card: { what: bi('Сторона хоста: мост docker0 и правила netfilter (MASQUERADE наружу, DNAT для -p).', 'The host side: the docker0 bridge and netfilter rules (MASQUERADE outwards, DNAT for -p).'), who: bi('dockerd.', 'dockerd.'), see: 'iptables -t nat -S DOCKER' } },
      { id: 'x-disk', label: bi('диск хоста', 'host disk'), sub: '/var/lib/docker/volumes', family: 'store', shape: 'pill', x: 24, y: 336, w: 200, h: 48, card: { what: bi('Где на хосте лежат тома и записываемые слои.', 'Where volumes and writable layers live on the host.'), who: bi('dockerd / containerd.', 'dockerd / containerd.'), see: 'docker volume inspect data' } },
      { id: 'x-log', label: bi('файл журнала', 'log file'), sub: '<id>-json.log', family: 'flow', shape: 'pill', x: 392, y: 440, w: 224, h: 48, card: { what: bi('Сюда драйвер json-file пишет строки stdout/stderr. Растёт без ограничений, пока не заданы max-size и max-file.', 'Where the json-file driver writes stdout/stderr lines. It grows without bound until max-size and max-file are set.'), who: bi('Драйвер журналов.', 'The log driver.'), see: "docker inspect -f '{{.LogPath}}' web" } },
      { id: 'x-shim', label: 'shim', sub: 'containerd-shim-runc-v2', family: 'cp', shape: 'pill', x: 672, y: 328, w: 264, h: 48, card: { what: bi('Родитель процесса контейнера: посылает ему сигналы и держит его stdio.', 'The parent of the container process: sends it signals and holds its stdio.'), who: bi('containerd.', 'containerd.') } },
    ],
    edges: [
      { id: 'e-kernel', from: 'b-kernel', to: 'proc', label: bi('системные вызовы', 'system calls'), card: { what: bi('Каждый вызов процесса идёт в ядро хоста, отфильтрованный seccomp и capabilities.', 'Every call of the process goes to the host kernel, filtered by seccomp and capabilities.'), who: bi('Ядро.', 'The kernel.') } },
      { id: 'e-net', from: 'b-net', to: 'proc', label: bi('пакеты', 'packets'), card: { what: bi('Пакеты проходят veth между namespace контейнера и мостом хоста.', 'Packets pass the veth between the container namespace and the host bridge.'), who: bi('Ядро, сеть.', 'The kernel network.') } },
      { id: 'e-store', from: 'b-store', to: 'proc', label: bi('файлы', 'files'), card: { what: bi('Открыть, прочитать, записать — в overlay, том, bind или tmpfs, смотря по пути.', 'Open, read, write — into the overlay, a volume, a bind or a tmpfs, depending on the path.'), who: bi('Ядро, VFS.', 'The kernel VFS.') } },
      { id: 'e-proc', from: 'b-proc', to: 'proc', label: 'SIGTERM', card: { what: bi('SIGTERM внутрь, код выхода наружу.', 'SIGTERM in, the exit code out.'), who: bi('shim.', 'The shim.') } },
      { id: 'e-io', from: 'proc', to: 'b-io', label: 'stdout · stderr', card: { what: bi('Дескрипторы 1 и 2 процесса — трубы к shim.', 'Descriptors 1 and 2 of the process are pipes to the shim.'), who: bi('shim.', 'The shim.') } },
      { id: 'e-id', from: 'b-id', to: 'proc', label: 'env · uid', card: { what: bi('Окружение и учётная запись, с которыми процесс стартует.', 'The environment and the account the process starts with.'), who: bi('runc по config.json.', 'runc from config.json.') } },
      { id: 'e-x-net', from: 'b-net', to: 'x-net', label: 'veth', card: { what: bi('Второй конец veth — в мосту хоста.', 'The other end of the veth is in the host bridge.'), who: bi('Docker.', 'Docker.') } },
      { id: 'e-x-disk', from: 'b-store', to: 'x-disk', label: bi('том на диске', 'volume on disk'), card: { what: bi('Тома и слои — каталоги на диске хоста.', 'Volumes and layers are directories on the host disk.'), who: bi('Docker.', 'Docker.') } },
      { id: 'e-x-log', from: 'b-io', to: 'x-log', label: 'json-file', card: { what: bi('Драйвер журналов пишет строки в файл.', 'The log driver writes lines into a file.'), who: bi('dockerd.', 'dockerd.') } },
      { id: 'e-x-shim', from: 'x-shim', to: 'b-proc', label: 'kill()', card: { what: bi('Сигнал остановки посылает shim.', 'The shim sends the stop signal.'), who: bi('shim.', 'The shim.') } },
    ],
  },
  params: [
    { id: 'side', label: bi('Какую сторону открыть', 'Which side to open'), kind: 'choice', default: 'all', options: [{ id: 'all', label: bi('все шесть по очереди', 'all six in turn') }, ...SIDES.map((s) => ({ id: s, label: SIDE_NAMES[s] }))] },
    { id: 'net', label: bi('Сеть: режим', 'Network: mode'), kind: 'choice', default: 'bridge', options: [{ id: 'bridge', label: bi('bridge', 'bridge') }, { id: 'user', label: bi('своя сеть', 'user-defined') }, { id: 'host', label: bi('host', 'host') }, { id: 'none', label: bi('none', 'none') }], near: 'b-net' },
    { id: 'data', label: bi('Хранилище: где лежит /data', 'Storage: where /data lives'), kind: 'choice', default: 'volume', options: [{ id: 'upper', label: bi('в записываемом слое', 'in the writable layer') }, { id: 'volume', label: bi('в томе', 'in a volume') }, { id: 'bind', label: bi('bind mount', 'bind mount') }, { id: 'tmpfs', label: bi('tmpfs', 'tmpfs') }], near: 'b-store', predict: { prompt: bi('/data — в записываемом слое. Что станет с данными после `docker rm` и нового `docker run`?', '/data is in the writable layer. What happens to the data after `docker rm` and a new `docker run`?'), options: [{ id: 'gone', text: bi('Пропадут: слой удаляется с контейнером', 'Gone: the layer goes with the container') }, { id: 'kept', text: bi('Останутся: они в образе', 'Kept: they are in the image') }], resolve: (_p, n) => (n.some((s) => s.values?.['b-store']?.includes('gone')) ? 'gone' : 'kept') } },
    { id: 'logs', label: bi('Ввод-вывод: куда пишет приложение', 'I/O: where the app writes'), kind: 'choice', default: 'stdout', options: [{ id: 'stdout', label: bi('stdout', 'stdout') }, { id: 'file', label: bi('в файл /var/log/app.log', 'to the file /var/log/app.log') }], near: 'b-io' },
    { id: 'uid', label: bi('Идентичность: UID процесса', 'Identity: process UID'), kind: 'range', min: 0, max: 2000, step: 1, default: 0, near: 'b-id' },
    { id: 'platform', label: bi('Ядро: платформа образа', 'Kernel: image platform'), kind: 'choice', default: 'amd64', options: [{ id: 'amd64', label: bi('linux/amd64', 'linux/amd64') }, { id: 'arm64', label: bi('linux/arm64', 'linux/arm64') }], near: 'b-kernel' },
  ],
  breaks: [
    { id: 'arch', label: bi('docker run trainer/tool сразу падает', 'docker run trainer/tool exits at once'), remove: ['e-kernel'], boundary: 'kernel', predict: ask(bi('Контейнер сразу упал: `exec /usr/local/bin/tool: exec format error`. На какой стороне?', 'The container failed at once: `exec /usr/local/bin/tool: exec format error`. On which side?'), 'kernel') },
    { id: 'loopback', label: bi('Порт опубликован, а curl — Connection reset', 'The port is published but curl says Connection reset'), remove: ['e-net'], boundary: 'network', predict: ask(bi('`-p 8080:8000` есть, а `curl localhost:8080` — `Connection reset by peer`. На какой стороне?', '`-p 8080:8000` is there, but `curl localhost:8080` says `Connection reset by peer`. On which side?'), 'network') },
    { id: 'lost', label: bi('Данные пропали после пересоздания', 'Data gone after re-creating'), remove: ['e-store'], boundary: 'storage', predict: ask(bi('После `docker rm -f db && docker run … postgres` таблицы исчезли. На какой стороне?', 'After `docker rm -f db && docker run … postgres` the tables are gone. On which side?'), 'storage') },
    { id: 'slow-stop', label: bi('docker stop идёт 10 секунд', 'docker stop takes 10 seconds'), remove: ['e-proc'], boundary: 'process', predict: ask(bi('`docker stop app` каждый раз ждёт 10 секунд, код 137. На какой стороне?', '`docker stop app` waits 10 seconds every time, code 137. On which side?'), 'process') },
    { id: 'silent', label: bi('docker logs пуст', 'docker logs is empty'), remove: ['e-io'], boundary: 'io', predict: ask(bi('Приложение работает, а `docker logs app` ничего не показывает. На какой стороне?', 'The application works, but `docker logs app` shows nothing. On which side?'), 'io') },
    { id: 'denied', label: bi('Permission denied в bind mount', 'Permission denied in a bind mount'), remove: ['e-id'], boundary: 'identity', predict: ask(bi('Приложение под UID 1001 не может писать в `./data`, смонтированный в /data. На какой стороне?', 'An app running as UID 1001 cannot write to `./data` mounted at /data. On which side?'), 'identity') },
  ],
  metrics: [{ id: 'sidesOk', label: bi('стороны без поломок', 'sides without failures') }],
  run(p, broken): Step[] {
    const BREAK_MSG: Record<string, { side: Exclude<Side, 'all'>; msg: string; caption: Bi }> = {
      arch: { side: 'kernel', msg: 'exec /usr/local/bin/tool: exec format error', caption: bi('ядро хоста не выполнит инструкции другой архитектуры: нужен образ linux/amd64.', 'the host kernel will not run another architecture’s instructions: you need a linux/amd64 image.') },
      loopback: { side: 'network', msg: 'curl: (56) Recv failure: Connection reset by peer', caption: bi('L4: приложение слушает 127.0.0.1 внутри своего namespace — DNAT ведёт на 172.17.0.2, а там никто не слушает. Нужен 0.0.0.0.', 'L4: the application listens on 127.0.0.1 inside its own namespace — DNAT leads to 172.17.0.2 and nobody listens there. It needs 0.0.0.0.') },
      lost: { side: 'storage', msg: 'psql: error: relation "items" does not exist', caption: bi('данные жили в записываемом слое и ушли вместе с контейнером: нужен том на /var/lib/postgresql/data.', 'the data lived in the writable layer and went with the container: you need a volume at /var/lib/postgresql/data.') },
      'slow-stop': { side: 'process', msg: '$ time docker stop app\napp\nreal\t0m10.31s', caption: bi('PID 1 не обрабатывает SIGTERM (или это sh): ядро сигнал игнорирует, через 10 с — SIGKILL. Exec-форма плюс обработчик, `--init` или STOPSIGNAL.', 'PID 1 does not handle SIGTERM (or it is sh): the kernel ignores the signal, after 10 s comes SIGKILL. Exec form plus a handler, `--init` or STOPSIGNAL.') },
      silent: { side: 'io', msg: '$ docker logs app\n$ docker exec app tail -1 /var/log/app.log\n2026-11-18 09:01:02 started', caption: bi('журнал идёт в файл внутри контейнера, а `docker logs` читает только stdout и stderr.', 'the log goes to a file inside the container, while `docker logs` reads only stdout and stderr.') },
      denied: { side: 'identity', msg: "touch: /data/x: Permission denied", caption: bi('UID 1001 внутри — это UID 1001 и для ядра: каталог хоста принадлежит root с правами 755. Нужен владелец 1001 или `--user` с UID владельца.', 'UID 1001 inside is UID 1001 for the kernel too: the host directory belongs to root with mode 755. It needs owner 1001, or `--user` with the owner’s UID.') },
    };
    const shown = p.side === 'all' ? SIDES : [p.side];
    const brokenSides = new Set([...broken].map((b) => BREAK_MSG[b]?.side).filter(Boolean));
    const okCount = SIDES.filter((s) => sideView(s, p).ok && !brokenSides.has(s)).length;
    const steps: Step[] = [
      {
        id: 'six',
        label: bi('шесть сторон', 'six sides'),
        caption: bi('Контейнер — процесс, у которого с окружением шесть границ: ядро, сеть, хранилище, процесс и сигналы, ввод-вывод, конфигурация и идентичность. Почти любая поломка сидит на одной из них — поэтому первый вопрос: «на какой границе?»', 'A container is a process with six boundaries to its surroundings: kernel, network, storage, process and signals, I/O, config and identity. Almost any failure sits on one of them — so the first question is “on which boundary?”'),
        focus: ['proc', ...SIDES.map((s) => NODE[s])],
        tokens: SIDES.map((s) => ({ edge: EDGE[s] })),
        metrics: { sidesOk: okCount },
      },
    ];
    for (const s of shown) {
      const v = sideView(s, p);
      steps.push({ id: `side-${s}`, label: SIDE_NAMES[s], caption: v.caption, focus: [NODE[s], EDGE[s], 'proc', ...(s === 'network' ? ['x-net', 'e-x-net'] : s === 'storage' ? ['x-disk', 'e-x-disk'] : s === 'io' ? ['x-log', 'e-x-log'] : s === 'process' ? ['x-shim', 'e-x-shim'] : [])], tokens: [{ edge: EDGE[s] }], states: { [NODE[s]]: v.ok ? 'ok' : 'warn' }, values: { [NODE[s]]: v.value }, metrics: { sidesOk: okCount } });
    }
    for (const b of broken) {
      const info = BREAK_MSG[b];
      if (!info) continue;
      steps.push({ id: `break-${b}`, label: bi('где?', 'where?'), caption: { ru: `Поломка на стороне «${SIDE_NAMES[info.side].ru}».`, en: `The failure is on the “${SIDE_NAMES[info.side].en}” side.` }, focus: [NODE[info.side], EDGE[info.side]], states: { [NODE[info.side]]: 'err' }, metrics: { sidesOk: okCount }, broken: { at: NODE[info.side], message: info.msg, caption: info.caption } });
      break;
    }
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Сначала граница, потом причина: симптом подсказывает сторону, сторона — где искать.', 'Boundary first, cause second: the symptom points to a side, the side tells you where to look.') : bi('Поломка убрана.', 'The failure is removed.');
    const map: Record<string, Exclude<Side, 'all'>> = { net: 'network', data: 'storage', logs: 'io', uid: 'identity', platform: 'kernel' };
    const s = map[change.id];
    if (s) return sideView(s, b).caption;
    void next;
    return b.side === 'all' ? bi('Все шесть сторон по очереди.', 'All six sides in turn.') : { ru: `Открыта сторона «${SIDE_NAMES[b.side as Exclude<Side, 'all'>].ru}».`, en: `The “${SIDE_NAMES[b.side as Exclude<Side, 'all'>].en}” side is open.` };
  },
});
