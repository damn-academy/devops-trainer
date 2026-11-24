// X5 (04 §6.6, §12.1, R7b): the six boundaries of a container. A container
// is a process with six borders to the world around it: the host kernel, the
// network, storage, process and signals, input/output and logs, config and
// identity. Almost every failure sits on one of them, so the first question
// of diagnosis is "on which boundary?". Each side opens with its own knob;
// each break is a real symptom and asks you to name the side first.
//
// Reading order: at the start only the container process is on the diagram.
// The six sides appear one per step around it, each with the piece of the host
// it leads to, and say in a callout what crosses them. A break adds a last
// step that lights the side where the symptom sits and prints the real error.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { startWith } from './util';

type Boundary = 'all' | 'kernel' | 'network' | 'storage' | 'process' | 'io' | 'identity';
type P = { boundary: Boundary; net: string; data: string; logs: string; uid: number; platform: string };

const SIDES: Exclude<Boundary, 'all'>[] = ['kernel', 'network', 'storage', 'process', 'io', 'identity'];
const NODE: Record<Exclude<Boundary, 'all'>, string> = { kernel: 'b-kernel', network: 'b-net', storage: 'b-store', process: 'b-proc', io: 'b-io', identity: 'b-id' };
const EDGE: Record<Exclude<Boundary, 'all'>, string> = { kernel: 'e-kernel', network: 'e-net', storage: 'e-store', process: 'e-proc', io: 'e-io', identity: 'e-id' };
const HOST: Record<Exclude<Boundary, 'all'>, string[]> = { kernel: [], network: ['x-net', 'e-x-net'], storage: ['x-disk', 'e-x-disk'], process: ['x-shim', 'e-x-shim'], io: ['x-log', 'e-x-log'], identity: [] };
const TOKEN: Record<Exclude<Boundary, 'all'>, string> = { kernel: 'syscall', network: 'TCP :80', storage: 'write /data', process: 'SIGTERM', io: 'stdout', identity: 'uid · env' };
const ALL = ['proc', 'b-kernel', 'b-net', 'b-store', 'b-proc', 'b-io', 'b-id', 'x-net', 'x-disk', 'x-log', 'x-shim', 'e-kernel', 'e-net', 'e-store', 'e-proc', 'e-io', 'e-id', 'e-x-net', 'e-x-disk', 'e-x-log', 'e-x-shim'];

export const SIDE_NAMES: Record<Exclude<Boundary, 'all'>, Bi> = {
  kernel: bi('Ядро хоста', 'host kernel'),
  network: bi('Сеть', 'network'),
  storage: bi('Хранилище', 'storage'),
  process: bi('Процесс и сигналы', 'process and signals'),
  io: bi('Ввод-вывод и журналы', 'I/O and logs'),
  identity: bi('Настройки и пользователь', 'config and identity'),
};

const sideOptions = SIDES.map((s) => ({ id: s, text: SIDE_NAMES[s] }));
const ask = (prompt: Bi, right: Exclude<Boundary, 'all'>) => ({ prompt, options: sideOptions, resolve: () => right });
const dd = (page: string, anchor?: string) => ({ page: `web/docs.docker.com/${page}`, anchor });

/** What one side looks like under the current knobs: the caption, the callout and the value on the side. */
type SideView = { caption: Bi; say: Bi; value: string; ok: boolean; more?: { caption: Bi; say: Bi } };

export function sideView(boundary: Exclude<Boundary, 'all'>, p: P): SideView {
  switch (boundary) {
    case 'kernel':
      return p.platform === 'arm64'
        ? { caption: bi('Образ собран под процессор arm64, а ядро хоста работает на x86_64. Своего ядра у контейнера нет, и чужие машинные команды процессор выполнить не может, поэтому запуск заканчивается ошибкой `exec format error`.', 'The image is built for arm64 and the host kernel is x86_64. A container has no kernel of its own and the CPU cannot run foreign instructions: `exec format error`.'), say: bi('Ядро x86_64 не может выполнить программу, собранную под arm64.', 'An x86_64 kernel cannot run a program built for arm64.'), value: 'exec format error', ok: false }
        : {
            caption: bi('Через эту границу проходят системные вызовы процесса. Ядро одно на всех, поэтому `uname -r` внутри контейнера и снаружи показывает одно и то же, а платформа образа должна совпадать с процессором хоста.', 'System calls of the process go through this boundary. There is one kernel for all, so `uname -r` shows the same inside the container and outside, and the image platform must match the host CPU.'),
            say: bi('Каждый системный вызов процесса уходит в общее ядро хоста.', 'Every system call of the process goes to the shared host kernel.'),
            value: 'linux/amd64 · 6.12',
            ok: true,
            more: {
              caption: bi('Параметры ядра, которые меняют командой sysctl, тоже делятся на две группы. Одни принадлежат пространству имён контейнера, как параметры net.*, а другие общие для всего хоста, и изнутри контейнера их не меняют.', 'Kernel parameters set with sysctl fall into two groups too. Some belong to the container’s namespace, like net.*, and the rest are shared by the whole host and are not changed from inside a container.'),
              say: bi('Параметры net.* у контейнера свои, а остальные общие с хостом.', 'The net.* parameters are the container’s own.'),
            },
          };
    case 'network': {
      const map: Record<string, SideView> = {
        bridge: {
          caption: bi('В сети bridge, которую Docker даёт по умолчанию, контейнер подключён парой veth к мосту docker0 и получает адрес вида 172.17.0.x. Наружу его пакеты выходят через NAT.', 'In the bridge network, which Docker gives by default, the container is attached to the docker0 bridge by a veth pair and gets an address like 172.17.0.x. Its packets go out through NAT.'),
          say: bi('Пакеты идут через veth в мост docker0, а наружу уходят через NAT.', 'Packets go through a veth into docker0 and leave through NAT.'),
          value: 'docker0 · 172.17.0.2',
          ok: true,
          more: {
            caption: bi('Внутрь к контейнеру можно попасть только через флаг `-p`, то есть через правило DNAT. Встроенного DNS, который находил бы контейнеры по именам, в этой сети нет.', 'From outside the container can be reached only through the `-p` flag, that is through a DNAT rule. This network has no embedded DNS that would find containers by name.'),
            say: bi('Снаружи пакеты попадают внутрь только по правилу DNAT, которое создаёт флаг -p.', 'From outside packets get in only by the DNAT rule that the -p flag creates.'),
          },
        },
        user: { caption: bi('В пользовательской сети, созданной командой `docker network create app`, у контейнеров свой мост и своя подсеть, а встроенный DNS на адресе 127.0.0.11 позволяет им находить друг друга по имени.', 'A user-defined network (`docker network create app`): its own bridge and subnet, and the embedded DNS at 127.0.0.11 — containers find each other by name.'), say: bi('Контейнеры этой сети находят друг друга по имени через DNS 127.0.0.11.', 'Containers of this network find each other by name through DNS 127.0.0.11.'), value: 'app · 172.18.0.2 · DNS 127.0.0.11', ok: true },
        host: { caption: bi('С флагом `--network host` своего пространства имён net у контейнера нет, и процесс слушает порты хоста напрямую. Флаг `-p` здесь не нужен и ничего не делает.', '`--network host`: no net namespace of its own, the process listens on the host’s ports directly; `-p` is not needed and does nothing.'), say: bi('Процесс слушает порты хоста напрямую, потому что своей сети у него нет.', 'The process listens on the host’s ports; it has no network of its own.'), value: 'host network', ok: true },
        none: { caption: bi('С флагом `--network none` в пространстве имён есть только интерфейс lo, и пакеты не ходят ни наружу, ни внутрь.', '`--network none`: only lo in the namespace. Nothing in, nothing out.'), say: bi('В сети none есть только lo, и наружу пакеты не уходят.', 'Network none has only lo; no packet leaves.'), value: 'lo only', ok: false },
      };
      return map[p.net] ?? map.bridge;
    }
    case 'storage': {
      const map: Record<string, SideView> = {
        upper: { caption: bi('Каталог `/data` лежит в записываемом слое контейнера, а этот слой существует, пока существует контейнер. После `docker rm` данных больше нет, и новый `docker run` начнёт с чистого образа.', '`/data` lives in the writable layer: it lives exactly as long as the container. `docker rm` and the data is gone; a new `docker run` starts from the image.'), say: bi('Данные пишутся в записываемый слой и пропадут вместе с контейнером.', 'The data goes into the writable layer and will vanish with the container.'), value: 'upper: gone on rm', ok: false },
        volume: { caption: bi('Том (`-v data:/data`) хранится в каталоге, которым управляет Docker, и существует отдельно от контейнера. Удалите контейнер, запустите новый с тем же томом, и данные будут на месте.', 'A volume (`-v data:/data`): a directory Docker manages, outside the container’s life. Remove the container, start a new one with the same volume — the data is there.'), say: bi('Данные пишутся в том, который переживёт удаление контейнера.', 'The data goes into a volume that outlives the container.'), value: 'volume data: survives rm', ok: true },
        bind: { caption: bi('Bind mount (`-v /srv/data:/data`) подключает каталог хоста как есть. Правки видны с обеих сторон сразу, а файлы образа, которые лежали по этому пути, становятся не видны.', 'A bind mount (`-v /srv/data:/data`): a host directory as it is. Edits show on both sides, and the image’s files at that path are hidden.'), say: bi('Каталог /data совпадает с каталогом хоста /srv/data и виден с обеих сторон.', '/data is the host directory /srv/data, seen from both sides.'), value: '/srv/data ↔ /data', ok: true },
        tmpfs: { caption: bi('tmpfs (`--tmpfs /data`) хранит файлы в оперативной памяти. Такое хранилище работает быстро, и на диск ничего не попадает, но всё пропадает, как только контейнер остановится.', 'tmpfs (`--tmpfs /data`): in memory. Fast and never on disk — and gone when the container stops.'), say: bi('Файлы лежат в памяти и пропадут при остановке контейнера.', 'The files are in memory and vanish when the container stops.'), value: 'tmpfs: gone on stop', ok: false },
      };
      return map[p.data] ?? map.volume;
    }
    case 'process':
      return {
        caption: bi('Через эту границу от shim приходят сигналы, а обратно уходят код выхода и сведения о дочерних процессах. Если у PID 1 нет обработчика сигнала, ядро этот сигнал ему не доставляет.', 'Signals from the shim come in through this boundary, and the exit code and news of child processes go back. If PID 1 has no handler for a signal, the kernel does not deliver that signal to it.'),
        say: bi('shim посылает процессу сигналы и ждёт его код выхода.', 'The shim sends signals to the process and waits for its exit code.'),
        value: 'PID 1 · SIGTERM → 10 s → SIGKILL',
        ok: true,
        more: {
          caption: bi('Поэтому `docker stop` ждёт 10 секунд и заканчивается кодом 137. А если PID 1 не забирает коды выхода дочерних процессов, копятся зомби. В обоих случаях помогает флаг `--init`.', 'That is why `docker stop` waits 10 seconds and ends with code 137. And if PID 1 does not collect its children’s exit codes, zombies pile up. In both cases the `--init` flag helps.'),
          say: bi('Без обработчика SIGTERM Docker ждёт 10 секунд и посылает SIGKILL.', 'Without a SIGTERM handler Docker waits 10 seconds and sends SIGKILL.'),
        },
      };
    case 'io':
      return p.logs === 'file'
        ? { caption: bi('Приложение пишет журнал в файл внутри контейнера, а shim забирает только потоки stdout и stderr, поэтому `docker logs` ничего не показывает. Образ nginx обходит это ограничение, делая свой файл `access.log` ссылкой на `/dev/stdout`.', 'The application writes its log into a file inside the container. The shim holds only stdout and stderr — `docker logs` is empty. The nginx image solves it with a link access.log → /dev/stdout.'), say: bi('Журнал уходит в файл, и docker logs его не видит.', 'The log goes into a file, and docker logs does not see it.'), value: 'docker logs: (empty)', ok: false }
        : { caption: bi('Потоки stdout и stderr процесса забирает shim и передаёт драйверу журналов (по умолчанию json-file), а тот пишет их в файл на хосте, откуда их читает `docker logs`. Ротации по умолчанию нет, её включают параметры max-size и max-file.', 'The shim takes the process’s stdout and stderr and passes them to the log driver (json-file by default), which writes them to a host file that `docker logs` reads. Rotation is off by default; max-size and max-file turn it on.'), say: bi('Строки stdout уходят через shim в файл журнала на хосте.', 'stdout lines go through the shim into a log file on the host.'), value: 'stdout → json-file', ok: true };
    case 'identity':
      return p.uid !== 0
        ? { caption: { ru: `Процесс работает под UID ${p.uid}, а каталог хоста из bind mount принадлежит root с правами 755. Без пространства имён пользователей UID внутри и снаружи контейнера одно и то же число, поэтому запись заканчивается ошибкой Permission denied.`, en: `The process runs as UID ${p.uid}, and the bind-mounted host directory belongs to root with mode 755. A UID is a number, the same inside and outside (without a user namespace): writing gives Permission denied.` }, say: { ru: `UID ${p.uid} получает отказ при записи в каталог root.`, en: `UID ${p.uid} writes to root’s 755 directory and is refused.` }, value: `uid ${p.uid} → root 755: EACCES`, ok: false }
        : {
            caption: bi('Через эту границу процесс получает переменные окружения, секреты и пользователя, от имени которого работает.', 'Through this boundary the process gets its environment variables, secrets and the user it runs as.'),
            say: bi('Процесс стартует с переменными окружения и от имени UID 0.', 'The process starts with its environment variables as UID 0.'),
            value: 'uid 0 · env · secrets',
            ok: true,
            more: {
              caption: bi('Без пространства имён пользователей root в контейнере остаётся тем же UID 0 в ядре, только с урезанным набором привилегий ядра (capabilities). Поэтому файлы, которые он создаёт в bind mount, на хосте принадлежат root.', 'Without a user namespace, root in a container is the same UID 0 in the kernel, only with a cut-down set of kernel privileges (capabilities). So the files it creates in a bind mount belong to root on the host.'),
              say: bi('Файлы, которые root создал в контейнере, на хосте тоже принадлежат root.', 'Files root created in the container belong to root on the host too.'),
            },
          };
  }
}

const BREAK_MSG: Record<string, { boundary: Exclude<Boundary, 'all'>; msg: string; caption: Bi; say: Bi }> = {
  arch: { boundary: 'kernel', msg: 'exec /usr/local/bin/tool: exec format error', caption: bi('Ядро хоста не выполняет машинные команды другого процессора, поэтому нужен образ для linux/amd64.', 'The host kernel does not run another CPU’s instructions, so you need a linux/amd64 image.'), say: bi('Ядро не может выполнить программу, собранную под другой процессор.', 'The kernel cannot run a program built for another CPU.') },
  loopback: { boundary: 'network', msg: 'curl: (56) Recv failure: Connection reset by peer', caption: bi('Приложение слушает 127.0.0.1 внутри своего пространства имён, а правило DNAT ведёт пакеты на 172.17.0.2, где никто не слушает. Приложению нужно слушать адрес 0.0.0.0.', 'The application listens on 127.0.0.1 inside its own namespace, while the DNAT rule sends packets to 172.17.0.2, where nobody listens. The application needs to listen on 0.0.0.0.'), say: bi('Пакеты приходят на 172.17.0.2, а приложение слушает только 127.0.0.1.', 'Packets arrive at 172.17.0.2, but the app listens only on 127.0.0.1.') },
  lost: { boundary: 'storage', msg: 'psql: error: relation "items" does not exist', caption: bi('Данные лежали в записываемом слое и пропали вместе с контейнером, поэтому базе нужен том на `/var/lib/postgresql/data`.', 'The data was in the writable layer and went away with the container, so the database needs a volume at `/var/lib/postgresql/data`.'), say: bi('Данные лежали в записываемом слое и удалены вместе с контейнером.', 'The data was in the writable layer and was removed with the container.') },
  'slow-stop': { boundary: 'process', msg: '$ time docker stop app\napp\nreal\t0m10.31s', caption: bi('Первым процессом работает программа без обработчика SIGTERM или оболочка sh, поэтому ядро сигнал отбрасывает, и через 10 секунд приходит SIGKILL. Помогают exec-форма с обработчиком, флаг `--init` или другой STOPSIGNAL.', 'The first process is a program without a SIGTERM handler or the sh shell, so the kernel drops the signal and SIGKILL comes after 10 seconds. The exec form with a handler, `--init` or another STOPSIGNAL helps.'), say: bi('PID 1 не реагирует на SIGTERM, и Docker ждёт 10 секунд.', 'PID 1 ignores SIGTERM, and Docker waits 10 seconds.') },
  silent: { boundary: 'io', msg: '$ docker logs app\n$ docker exec app tail -1 /var/log/app.log\n2026-11-18 09:01:02 started', caption: bi('Журнал пишется в файл внутри контейнера, а `docker logs` читает только stdout и stderr.', 'The log goes to a file inside the container, while `docker logs` reads only stdout and stderr.'), say: bi('Журнал пишется в файл, а в stdout не попадает ни строки.', 'The log goes to a file; not a line reaches stdout.') },
  denied: { boundary: 'identity', msg: 'touch: /data/x: Permission denied', caption: bi('UID 1001 внутри контейнера остаётся UID 1001 и для ядра, а каталог хоста принадлежит root с правами 755. Нужно сделать владельцем каталога UID 1001 или запустить контейнер с `--user` и UID владельца.', 'UID 1001 inside the container is UID 1001 for the kernel too, and the host directory belongs to root with mode 755. Make UID 1001 the owner of the directory or run the container with `--user` and the owner’s UID.'), say: bi('UID 1001 не может писать в каталог, который принадлежит root.', 'UID 1001 cannot write to a directory owned by root.') },
};

export const boundariesModel = defineModel<P>({
  id: 'containers.boundaries',
  frame: 'visible',
  block: 'containers',
  title: bi('Шесть границ контейнера', 'The six boundaries of a container'),
  summary: bi(
    'Процесс контейнера соприкасается с окружающей системой в шести местах: через ядро хоста, сеть, хранилище, сигналы, потоки вывода и настройки с пользователем. Почти любая поломка контейнера находится на одной из этих границ, поэтому поиск неисправности начинается с вопроса «на какой границе?».',
    'A container is a process with six boundaries to its surroundings: the host kernel, network, storage, signals, output streams, config and the user. Almost any failure sits on one of them — so diagnosis starts with “on which boundary?”',
  ),
  intro: bi(
    'Сейчас на схеме только процесс контейнера. А дальше переходите от шага к шагу кнопкой «Шаг вперёд». Вокруг процесса по одной появятся шесть границ, и у каждой будет та часть хоста, к которой она ведёт. Облачко у границы говорит, что через неё проходит, а карточка на линии показывает пример: системный вызов, пакет, сигнал.\n\nПосле первого прохода меняйте в «Параметрах» настройки границ. Потом включите одну поломку в блоке «Сломать». Прежде чем смотреть ответ, назовите границу, на которой она находится.',
    'Now the diagram shows only the container process. Then go on with “Step forward”: the six boundaries appear around the process one by one, each with the part of the host it leads to. The callout at a boundary says what crosses it, and the card on the line shows an example: a system call, a packet, a signal.\n\nAfter the first pass change the boundaries’ settings in “Parameters”. Then switch on one break in “Break it”: before you look at the answer, name the boundary it sits on.',
  ),
  legend: [
    { mark: 'active', text: bi('граница, которую смотрим сейчас', 'the boundary we look at now') },
    { mark: 'say', text: bi('что проходит через эту границу', 'what crosses this boundary') },
    { mark: 'token', text: bi('пример того, что проходит через границу, например вызов, пакет или сигнал', 'an example of what crosses the boundary, such as a call, a packet or a signal') },
    { mark: 'icon:container', text: bi('процесс контейнера', 'the container process') },
    { mark: 'ok', text: bi('граница в порядке', 'the boundary is fine') },
    { mark: 'warn', text: bi('при этих настройках здесь будут проблемы', 'with these settings there will be trouble here') },
    { mark: 'err', text: bi('здесь находится поломка', 'the failure sits here') },
  ],
  stopLabel: bi('Поломка найдена', 'Failure found'),
  concepts: ['docker.boundary', 'docker.volume', 'docker.network', 'docker.logs'],
  diagram: {
    width: 960,
    height: 600,
    nodes: [
      { id: 'proc', label: bi('Процесс контейнера', 'Container process'), icon: 'container', sub: 'nginx · PID 1 · 4123', family: 'process', x: 360, y: 240, w: 240, h: 72, card: { what: bi('В центре схемы стоит обычный процесс хоста в своих пространствах имён и своей cgroup. У него два номера, 1 внутри контейнера и 4123 на хосте.', 'In the centre is an ordinary host process in its own namespaces and cgroup. Two PIDs: 1 inside, 4123 on the host.'), who: bi('Его запустил runc по просьбе Docker.', 'runc started it on Docker’s request.'), see: 'docker top web' } },
      { id: 'b-kernel', label: SIDE_NAMES.kernel, icon: 'terminal', sub: 'syscalls · arch · sysctl', family: 'kernel', x: 24, y: 56, w: 264, h: 64, card: { what: bi('Через границу с ядром проходят системные вызовы, и здесь важны архитектура процессора и параметры ядра. Чаще всего здесь встречаются две поломки: `exec format error`, когда образ собран под arm64, а хост работает на amd64, и `Read-only file system`, когда внутри контейнера пытаются выполнить `sysctl -w`.', 'System calls, the CPU architecture, kernel parameters. Typical failures: `exec format error` (an arm64 image on amd64), `sysctl -w` inside — Read-only file system.'), who: bi('Ядро хоста одно на все контейнеры.', 'The host kernel — one for all containers.'), see: "docker image inspect -f '{{.Architecture}}' IMAGE" } },
      { id: 'b-net', label: SIDE_NAMES.network, icon: 'router', sub: 'veth · docker0 · NAT · DNS', family: 'l3', x: 672, y: 56, w: 264, h: 64, card: { what: bi('Через сетевую границу проходят пакеты. Чаще всего здесь ломается одно из четырёх: приложение слушает только 127.0.0.1, в сети по умолчанию нет DNS по именам контейнеров, порт хоста занят другой программой или на хосте выключена пересылка пакетов ip_forward.', 'Packets. Typical failures: the application listens on 127.0.0.1; the default network has no DNS for names; the host port is taken; ip_forward is off on the host.'), who: bi('Docker настраивает сеть ядра, то есть пары veth, мост и правила netfilter.', 'Docker configures the kernel’s network: veth, a bridge, netfilter rules.'), see: 'docker network inspect bridge', doc: dd('engine/network/drivers/bridge', 'differences') } },
      { id: 'b-store', label: SIDE_NAMES.storage, icon: 'disk', sub: 'upper · volume · bind · tmpfs', family: 'store', x: 24, y: 244, w: 264, h: 64, card: { what: bi('Через границу хранилища проходят файлы. Чаще всего здесь жалуются, что данные пропали после `docker rm` или что bind mount закрыл собой файлы образа.', 'Files. Typical failures: data gone after `docker rm`; a bind mount hid the image’s files.'), who: bi('Этой границей управляют Docker и ядро через overlay и монтирования.', 'Docker and the kernel (overlay, mounts).'), see: "docker inspect -f '{{json .Mounts}}' web", doc: dd('engine/storage/volumes') } },
      { id: 'b-proc', label: SIDE_NAMES.process, icon: 'process', sub: 'PID 1 · SIGTERM · zombies', family: 'process', x: 672, y: 244, w: 264, h: 64, card: { what: bi('Через эту границу проходят сигналы, коды выхода и сведения о дочерних процессах. Чаще всего здесь видят, что `docker stop` каждый раз ждёт 10 секунд, что копятся зомби или что программа ушла в фон и контейнер сразу завершился.', 'Signals, exit codes, children. Typical failures: `docker stop` waits 10 s; zombies pile up; a daemon went to the background and the container exited.'), who: bi('Этой границей управляют shim и ядро.', 'The shim and the kernel.'), see: 'docker inspect -f {{.State.ExitCode}} web' } },
      { id: 'b-io', label: SIDE_NAMES.io, icon: 'file', sub: 'stdout · stderr → log driver', family: 'flow', x: 24, y: 512, w: 264, h: 64, card: { what: bi('Через эту границу проходят потоки вывода процесса. Чаще всего здесь ломается одно из трёх: `docker logs` пуст, потому что журнал пишется в файл, журнал без ротации занял весь диск или Python копит вывод в буфере, и строки появляются с задержкой.', 'Output streams. Typical failures: `docker logs` is empty — the log goes to a file; a log without rotation filled the disk; Python buffers stdout.'), who: bi('Этой границей управляют shim и драйвер журналов.', 'The shim and the log driver.'), see: 'docker logs web', doc: dd('engine/logging/configure') } },
      { id: 'b-id', label: SIDE_NAMES.identity, icon: 'user', sub: 'env · secrets · UID', family: 'user', x: 672, y: 512, w: 264, h: 64, card: { what: bi('Через эту границу процесс получает переменные окружения, секреты и пользователя. Чаще всего здесь встречаются `Permission denied` при записи в bind mount, секрет, оставшийся в слое образа, и опечатка в имени переменной.', 'Variables, secrets, the user. Typical failures: Permission denied in a bind mount; a secret left in an image layer; a typo in a variable name.'), who: bi('Их задаёт тот, кто запускает контейнер, флагами `-e`, `--env-file` и `-u`.', 'Whoever runs it: `-e`, `--env-file`, `-u`.'), see: 'docker exec web id; docker exec web env' } },
      { id: 'x-net', label: bi('Мост и NAT хоста', 'Host bridge and NAT'), icon: 'switch', sub: 'docker0 · DNAT 8080→80', family: 'l3', shape: 'pill', x: 672, y: 156, w: 264, h: 48, card: { what: bi('На хосте сеть контейнера продолжается мостом docker0 и правилами netfilter, то есть MASQUERADE для пакетов наружу и DNAT для портов, опубликованных флагом `-p`.', 'The host side: the docker0 bridge and netfilter rules (MASQUERADE outwards, DNAT for -p).'), who: bi('Их настраивает dockerd.', 'dockerd.'), see: 'iptables -t nat -S DOCKER' } },
      { id: 'x-disk', label: bi('Диск хоста', 'Host disk'), icon: 'disk', sub: '/var/lib/docker/volumes', family: 'store', shape: 'pill', x: 24, y: 348, w: 264, h: 48, card: { what: bi('Здесь на хосте лежат тома и записываемые слои контейнеров.', 'Where volumes and writable layers live on the host.'), who: bi('Ими управляют dockerd и containerd.', 'dockerd / containerd.'), see: 'docker volume inspect data' } },
      { id: 'x-log', label: bi('Файл журнала', 'Log file'), icon: 'file', sub: '<id>-json.log', family: 'flow', shape: 'pill', x: 360, y: 520, w: 240, h: 48, card: { what: bi('Сюда драйвер json-file записывает строки stdout и stderr. Файл растёт без ограничений, пока не заданы max-size и max-file.', 'Where the json-file driver writes stdout/stderr lines. It grows without bound until max-size and max-file are set.'), who: bi('Его пишет драйвер журналов.', 'The log driver.'), see: "docker inspect -f '{{.LogPath}}' web" } },
      { id: 'x-shim', label: 'shim', icon: 'process', sub: 'containerd-shim-runc-v2', family: 'cp', shape: 'pill', x: 672, y: 400, w: 264, h: 48, card: { what: bi('Shim остаётся родителем процесса контейнера. Он посылает процессу сигналы и держит его стандартные потоки.', 'The parent of the container process: sends it signals and holds its stdio.'), who: bi('Его запускает containerd.', 'containerd.') } },
    ],
    edges: [
      { id: 'e-kernel', from: 'proc', to: 'b-kernel', label: bi('системные вызовы', 'system calls'), card: { what: bi('Каждый вызов процесса уходит в ядро хоста, пройдя фильтры seccomp и проверку capabilities.', 'Every call of the process goes to the host kernel, filtered by seccomp and capabilities.'), who: bi('Их обрабатывает ядро.', 'The kernel.') } },
      { id: 'e-net', from: 'b-net', to: 'proc', label: bi('пакеты', 'packets'), card: { what: bi('Пакеты проходят пару veth между пространством имён контейнера и мостом хоста.', 'Packets pass the veth between the container namespace and the host bridge.'), who: bi('Их передаёт сетевая часть ядра.', 'The kernel network.') } },
      { id: 'e-store', from: 'b-store', to: 'proc', label: bi('файлы', 'files'), card: { what: bi('Процесс открывает, читает и записывает файлы, и в зависимости от пути запись попадает в overlay, том, bind mount или tmpfs.', 'Open, read, write — into the overlay, a volume, a bind or a tmpfs, depending on the path.'), who: bi('Их обрабатывает файловая подсистема ядра (VFS).', 'The kernel VFS.') } },
      { id: 'e-proc', from: 'b-proc', to: 'proc', label: bi('сигналы', 'signals'), card: { what: bi('Сигналы приходят внутрь, а код выхода уходит наружу.', 'SIGTERM in, the exit code out.'), who: bi('Их посылает shim.', 'The shim.') } },
      { id: 'e-io', from: 'proc', to: 'b-io', label: 'stdout · stderr', card: { what: bi('Дескрипторы 1 и 2 процесса ведут по каналам к shim.', 'Descriptors 1 and 2 of the process are pipes to the shim.'), who: bi('Каналы держит shim.', 'The shim.') } },
      { id: 'e-id', from: 'b-id', to: 'proc', label: 'env · uid', card: { what: bi('По этой линии процесс получает окружение и учётную запись, с которыми он запускается.', 'The environment and the account the process starts with.'), who: bi('Их задаёт runc по файлу config.json.', 'runc from config.json.') } },
      { id: 'e-x-net', from: 'b-net', to: 'x-net', label: 'veth', card: { what: bi('Второй конец пары veth подключён к мосту хоста.', 'The other end of the veth is in the host bridge.'), who: bi('Его подключает Docker.', 'Docker.') } },
      { id: 'e-x-disk', from: 'b-store', to: 'x-disk', label: bi('том на диске', 'volume on disk'), card: { what: bi('Тома и слои хранятся в каталогах на диске хоста.', 'Volumes and layers are directories on the host disk.'), who: bi('Ими управляет Docker.', 'Docker.') } },
      { id: 'e-x-log', from: 'b-io', to: 'x-log', label: 'json-file', card: { what: bi('Драйвер журналов записывает строки в файл.', 'The log driver writes lines into a file.'), who: bi('Драйвер работает внутри dockerd.', 'dockerd.') } },
      { id: 'e-x-shim', from: 'x-shim', to: 'b-proc', label: 'kill()', card: { what: bi('Сигнал остановки посылает shim.', 'The shim sends the stop signal.'), who: bi('Сигнал остановки посылает процессу shim, когда его об этом просит Docker.', 'The shim.') } },
    ],
  },
  params: [
    { id: 'boundary', label: bi('Какие границы показать', 'Which boundary to open'), kind: 'choice', default: 'all', options: [{ id: 'all', label: bi('все шесть по очереди', 'all six in turn') }, ...SIDES.map((s) => ({ id: s, label: SIDE_NAMES[s] }))], group: bi('Что смотреть', 'What to look at') },
    { id: 'net', label: bi('Режим сети контейнера (--network)', 'Network: mode'), kind: 'choice', default: 'bridge', options: [{ id: 'bridge', label: bi('bridge, по умолчанию', 'bridge') }, { id: 'user', label: bi('своя сеть, docker network create', 'user-defined') }, { id: 'host', label: bi('host, сеть хоста', 'host') }, { id: 'none', label: bi('none, без сети', 'none') }], near: 'b-net', group: bi('Как запущен контейнер', 'How the container is run') },
    {
      id: 'data',
      label: bi('Где лежит каталог /data', 'Storage: where /data lives'),
      kind: 'choice',
      default: 'volume',
      options: [
        { id: 'upper', label: bi('в записываемом слое', 'in the writable layer') },
        { id: 'volume', label: bi('в томе', 'in a volume') },
        { id: 'bind', label: bi('в каталоге хоста (bind mount)', 'bind mount') },
        { id: 'tmpfs', label: bi('в памяти (tmpfs)', 'tmpfs') },
      ],
      near: 'b-store',
      group: bi('Как запущен контейнер', 'How the container is run'),
      predict: {
        prompt: bi('Допустим, /data лежит в записываемом слое контейнера. Что станет с данными после `docker rm` и нового `docker run` из того же образа?', '/data is in the writable layer. What happens to the data after `docker rm` and a new `docker run`?'),
        options: [
          { id: 'gone', text: bi('Данные пропадут, потому что слой удаляется вместе с контейнером', 'The data is gone, because the layer is removed with the container') },
          { id: 'kept', text: bi('Данные сохранятся, потому что попадут в образ', 'The data is kept, because it goes into the image') },
        ],
        resolve: () => 'gone',
      },
    },
    { id: 'logs', label: bi('Куда приложение пишет журнал', 'I/O: where the app writes'), kind: 'choice', default: 'stdout', options: [{ id: 'stdout', label: bi('в stdout', 'stdout') }, { id: 'file', label: bi('в файл /var/log/app.log', 'to the file /var/log/app.log') }], near: 'b-io', group: bi('Как написано приложение', 'How the app is written') },
    { id: 'uid', label: bi('Под каким UID работает процесс', 'Identity: process UID'), kind: 'range', min: 0, max: 2000, step: 1, default: 0, near: 'b-id', group: bi('Как запущен контейнер', 'How the container is run') },
    { id: 'platform', label: bi('Под какой процессор собран образ', 'Kernel: image platform'), kind: 'choice', default: 'amd64', options: [{ id: 'amd64', label: bi('linux/amd64, как хост', 'linux/amd64') }, { id: 'arm64', label: bi('linux/arm64', 'linux/arm64') }], near: 'b-kernel', group: bi('Как написано приложение', 'How the app is written') },
  ],
  breaks: [
    { id: 'arch', label: bi('Контейнер trainer/tool завершается сразу после запуска', 'docker run trainer/tool exits at once'), remove: ['e-kernel'], boundary: 'kernel', predict: ask(bi('Контейнер завершился сразу после запуска с сообщением `exec /usr/local/bin/tool: exec format error`. На какой границе поломка?', 'The container failed at once: `exec /usr/local/bin/tool: exec format error`. On which boundary?'), 'kernel') },
    { id: 'loopback', label: bi('Порт опубликован, а curl получает Connection reset', 'The port is published but curl says Connection reset'), remove: ['e-net'], boundary: 'network', predict: ask(bi('Контейнер запущен с `-p 8080:8000`, а `curl localhost:8080` отвечает `Connection reset by peer`. На какой границе поломка?', '`-p 8080:8000` is there, but `curl localhost:8080` says `Connection reset by peer`. On which boundary?'), 'network') },
    { id: 'lost', label: bi('После пересоздания контейнера пропали данные', 'Data gone after re-creating'), remove: ['e-store'], boundary: 'storage', predict: ask(bi('После `docker rm -f db && docker run … postgres` таблицы базы исчезли. На какой границе поломка?', 'After `docker rm -f db && docker run … postgres` the tables are gone. On which boundary?'), 'storage') },
    { id: 'slow-stop', label: bi('docker stop каждый раз длится 10 секунд', 'docker stop takes 10 seconds'), remove: ['e-proc'], boundary: 'process', predict: ask(bi('`docker stop app` каждый раз ждёт 10 секунд и заканчивается кодом 137. На какой границе поломка?', '`docker stop app` waits 10 seconds every time, code 137. On which boundary?'), 'process') },
    { id: 'silent', label: bi('docker logs ничего не показывает', 'docker logs is empty'), remove: ['e-io'], boundary: 'io', predict: ask(bi('Приложение работает, а `docker logs app` ничего не показывает. На какой границе поломка?', 'The application works, but `docker logs app` shows nothing. On which boundary?'), 'io') },
    { id: 'denied', label: bi('В bind mount запись даёт Permission denied', 'Permission denied in a bind mount'), remove: ['e-id'], boundary: 'identity', predict: ask(bi('Приложение работает под UID 1001 и не может писать в каталог `./data`, подключённый в контейнер как /data. На какой границе поломка?', 'An app running as UID 1001 cannot write to `./data` mounted at /data. On which boundary?'), 'identity') },
  ],
  metrics: [{ id: 'sidesOk', label: bi('сколько границ работают без проблем', 'how many boundaries work without trouble') }],
  run(p, broken): Step[] {
    const shown = p.boundary === 'all' ? SIDES : [p.boundary];
    const brokenSides = new Set([...broken].map((b) => BREAK_MSG[b]?.boundary).filter(Boolean));
    const okCount = SIDES.filter((s) => sideView(s, p).ok && !brokenSides.has(s)).length;
    const steps: Step[] = [
      {
        id: 'proc',
        label: bi('процесс', 'process'),
        caption: bi('В центре схемы стоит процесс контейнера, то есть обычный процесс хоста в своих пространствах имён и cgroup. Всё, что с ним случается, приходит к нему через одну из шести границ, которые сейчас появятся вокруг.', 'In the centre is the container process, an ordinary host process in its own namespaces and cgroup. Everything that happens to it comes through one of the six boundaries that are about to appear around it.'),
        focus: ['proc'],
        say: { proc: bi('Процесс контейнера соприкасается с хостом в шести местах.', 'The container process touches the host in six places.') },
        states: startWith(ALL, 'proc'),
        metrics: { sidesOk: okCount },
      },
    ];
    for (const s of shown) {
      const v = sideView(s, p);
      steps.push({
        id: `boundary-${s}`,
        label: SIDE_NAMES[s],
        caption: v.caption,
        focus: [NODE[s], EDGE[s]],
        reveal: [NODE[s], EDGE[s], ...HOST[s]],
        tokens: [{ edge: EDGE[s], label: TOKEN[s], reverse: s === 'io' ? false : undefined }],
        say: { [NODE[s]]: v.say },
        states: { [NODE[s]]: v.ok ? 'ok' : 'warn' },
        values: { [NODE[s]]: v.value },
        metrics: { sidesOk: okCount },
      });
      if (v.more)
        steps.push({
          id: `boundary-${s}-more`,
          label: SIDE_NAMES[s],
          caption: v.more.caption,
          focus: [NODE[s]],
          say: { [NODE[s]]: v.more.say },
          metrics: { sidesOk: okCount },
        });
    }
    for (const b of broken) {
      const info = BREAK_MSG[b];
      if (!info) continue;
      steps.push({
        id: `break-${b}`,
        label: bi('поломка', 'failure'),
        caption: { ru: `Поломка находится на границе «${SIDE_NAMES[info.boundary].ru}». По симптому сначала находят границу, а уже на этой границе ищут причину.`, en: `The failure is on the “${SIDE_NAMES[info.boundary].en}” boundary.` },
        focus: [NODE[info.boundary], EDGE[info.boundary]],
        reveal: [NODE[info.boundary], EDGE[info.boundary], ...HOST[info.boundary]],
        say: { [NODE[info.boundary]]: info.say },
        states: { [NODE[info.boundary]]: 'err' },
        metrics: { sidesOk: okCount },
        broken: { at: NODE[info.boundary], message: info.msg, caption: info.caption },
      });
      break;
    }
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Сначала найдите границу, а потом причину: симптом подсказывает границу, а граница подсказывает, где искать.', 'Boundary first, cause second: the symptom points to a boundary, the boundary tells you where to look.')
        : bi('Поломку убрали, и симптом больше не появляется.', 'The failure is removed, and the symptom no longer appears.');
    const map: Record<string, Exclude<Boundary, 'all'>> = { net: 'network', data: 'storage', logs: 'io', uid: 'identity', platform: 'kernel' };
    const s = map[change.id];
    if (s) return sideView(s, b).caption;
    void next;
    return b.boundary === 'all' ? bi('Схема покажет все шесть границ по очереди.', 'All six boundaries in turn.') : { ru: `Схема покажет только границу «${SIDE_NAMES[b.boundary as Exclude<Boundary, 'all'>].ru}».`, en: `The “${SIDE_NAMES[b.boundary as Exclude<Boundary, 'all'>].en}” boundary is open.` };
  },
});
