// Linux lessons 14–19: how the kernel isolates and limits (02 §5.4, М15 —
// threads and /proc, namespaces and PID 1, cgroups and the OOM killer,
// capabilities and seccomp, chroot and overlayfs) and the network as the
// machine sees it with SSH keys (М16). The word for the thing all of this
// adds up to is introduced in the next block; it is not used here.

import { bi } from '../../core/i18n';
import type { Facts, Lesson, TerminalSetup } from '../../core/types';
import { man7, opennet, ref, sources, wiki, arch } from './shared';

const text = (f: Facts, p: string) => (f.files[p]?.text ?? '') as string;
type P = { pid: number; cmd: string; threads: number; uid: number; listen?: number[]; seccomp?: number; capEff?: string };
const procs = (f: Facts) => f.procs as unknown as P[];
type CG = { path: string; memory: { max: number | 'max'; events: Record<string, number> }; pids: { max: number | 'max'; events: Record<string, number> } };
const cgroups = (f: Facts) => (f.cgroups ?? []) as CG[];
type NS = { id: number; type: string; hostname?: string; uidMap?: number[]; state?: string };
const nss = (f: Facts) => (f.ns ?? []) as NS[];

// ── 14. Process, thread and /proc ──

const threads: Lesson = {
  id: 'linux.threads',
  block: 'linux',
  title: bi('Процесс, поток и окно в ядро /proc', 'A process, a thread and the /proc window into the kernel'),
  summary: bi('Как один процесс занимает четыре ядра, почему у потоков общая память и где ядро хранит паспорт каждого процесса.', 'How one process can keep four cores busy, why threads share memory, and where the kernel keeps every process’s passport.'),
  introduces: ['linux.thread', 'linux.procfs'],
  uses: ['linux.process', 'linux.kernel', 'linux.fork-exec'],
  tier: 'core',
  minutes: 30,
  sources: sources([man7('proc', 5), man7('pthreads', 7), man7('clone', 2), man7('ps', 1)], [wiki('Поток выполнения', '%D0%9F%D0%BE%D1%82%D0%BE%D0%BA_%D0%B2%D1%8B%D0%BF%D0%BE%D0%BB%D0%BD%D0%B5%D0%BD%D0%B8%D1%8F'), opennet('proc', 5)]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('`top` показывает один процесс `java` с нагрузкой 380%. Как один процесс занимает почти четыре процессора, если процесс — это одна работающая программа?', '`top` shows one `java` process at 380%. How can one process keep almost four CPUs busy if a process is one running program?'),
    },
    {
      id: 'threads',
      kind: 'text',
      step: 'explain',
      title: bi('Потоки', 'Threads'),
      body: bi(
        'Внутри процесса может работать несколько [[linux.thread|потоков выполнения]]. Поток — это то, что ядро ставит на процессор: у каждого свой счётчик команд и свой номер TID. Но память, открытые файлы и пользователь у потоков одного процесса общие. Поэтому потоки дешёвые и быстро обмениваются данными — и поэтому ошибка в одном потоке может испортить память всем.\n\nПроцесс и поток рождаются одним и тем же системным вызовом `clone`; разница в флагах: с `CLONE_THREAD` новая сущность делит память с родителем, без него получает свою копию. Четыре потока на четырёх процессорах — и `top` честно складывает их нагрузку в 400%.\n\n`ps -eLf` показывает каждый поток отдельной строкой: `LWP` — номер потока, `NLWP` — сколько потоков в процессе. Номер главного потока совпадает с PID.',
        'Several [[linux.thread|threads]] can run inside a process. A thread is what the kernel puts on a CPU: each has its own instruction counter and its own number, the TID. But memory, open files and the user are shared by the threads of one process. That is why threads are cheap and exchange data fast — and why a bug in one thread can spoil everyone’s memory.\n\nA process and a thread are born from the same system call, `clone`; the difference is the flags: with `CLONE_THREAD` the new entity shares memory with its parent, without it it gets its own copy. Four threads on four CPUs — and `top` honestly adds their load up to 400%.\n\n`ps -eLf` shows every thread as a separate line: `LWP` is the thread number, `NLWP` how many threads the process has. The main thread’s number is the PID.',
      ),
    },
    {
      id: 'proc',
      kind: 'text',
      step: 'explain',
      title: bi('/proc', '/proc'),
      body: bi(
        'Откуда `ps` берёт всё это? Из каталога `/proc` — [[linux.procfs|файловой системы /proc]]. Это не файлы на диске: ядро сочиняет их содержимое в момент чтения. На каждый процесс там каталог с его номером:\n\n- `/proc/PID/status` — паспорт: имя, состояние, PPid, Uid, `VmRSS` (память), `Threads`;\n- `/proc/PID/cmdline` — с какими аргументами запущен;\n- `/proc/PID/task/` — по каталогу на каждый поток;\n- `/proc/PID/fd/` — открытые файлы, ссылками.\n\nИ общие сведения о машине: `/proc/meminfo`, `/proc/loadavg`, `/proc/cpuinfo`. `/proc/self` — ссылка на каталог того процесса, который её читает. Рядом живёт `/sys` — устройства и настройки ядра; в нём скоро найдутся лимиты процессов.',
        'Where does `ps` get all this? From the `/proc` directory — [[linux.procfs|the /proc file system]]. These are not files on a disk: the kernel makes up their contents at the moment they are read. There is a directory per process, named after its number:\n\n- `/proc/PID/status` — the passport: name, state, PPid, Uid, `VmRSS` (memory), `Threads`;\n- `/proc/PID/cmdline` — the arguments it was started with;\n- `/proc/PID/task/` — a directory per thread;\n- `/proc/PID/fd/` — the open files, as links.\n\nAnd facts about the machine: `/proc/meminfo`, `/proc/loadavg`, `/proc/cpuinfo`. `/proc/self` is a link to the directory of whichever process reads it. Next to it lives `/sys` — devices and kernel settings; the limits of processes will be found there soon.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: { ext: { linux: { procs: [{ argv: ['threads-demo', '6'], user: 'learner' }] } } },
      tasks: [
        {
          id: 'count',
          prompt: bi('Программа `threads-demo` уже работает. Узнайте, сколько в её процессе потоков, и запишите одно это число в `~/threads.txt`.', 'The `threads-demo` program is already running. Find out how many threads its process has and write just that number into `~/threads.txt`.'),
          check: {
            when: (f) => {
              const p = procs(f).find((x) => x.cmd === 'threads-demo');
              return !!p && Number(text(f, '/home/learner/threads.txt').trim()) === p.threads;
            },
            fail: [{ if: (f) => Number(text(f, '/home/learner/threads.txt').trim()) === 6, say: bi('Шесть рабочих потоков — но главный поток тоже поток. Посмотрите поле Threads в `/proc/PID/status`.', 'Six worker threads — but the main thread is a thread too. Look at the Threads field in `/proc/PID/status`.') }],
          },
          chips: 'grep Threads /proc/$(pgrep threads-demo)/status',
          docRef: { url: 'https://man7.org/linux/man-pages/man5/proc_pid_status.5.html', label: 'proc_pid_status(5)' },
          hints: { H1: bi('Номер процесса даст `pgrep threads-demo`.', '`pgrep threads-demo` gives the process number.'), H2: bi('Паспорт процесса — `/proc/PID/status`, строка Threads; или `ls /proc/PID/task`.', 'The passport of a process is `/proc/PID/status`, the Threads line; or `ls /proc/PID/task`.') },
        },
        {
          id: 'lwp',
          prompt: bi('Покажите потоки `threads-demo` отдельными строками с колонками LWP и NLWP.', 'Show the threads of `threads-demo` as separate lines with the LWP and NLWP columns.'),
          check: { stdout: /LWP.*NLWP[\s\S]*threads-demo/ },
          chips: 'ps -eLf',
          docRef: ref('man/ps.1', 'OPTIONS', '-L'),
          hints: { H1: bi('У `ps` есть флаг, показывающий потоки.', '`ps` has a flag that shows threads.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.thread-task', 'linux.q.ps-proc'] },
  ],
};

// ── 15. Namespaces and PID 1 ──

const namespaces: Lesson = {
  id: 'linux.namespaces',
  block: 'linux',
  title: bi('Что видит процесс: пространства имён и PID 1', 'What a process sees: namespaces and PID 1'),
  summary: bi('Одно ядро может показывать разным процессам разный мир: другое имя машины, другую нумерацию процессов, другую сеть, других пользователей.', 'One kernel can show different processes a different world: another host name, another numbering of processes, another network, other users.'),
  introduces: ['linux.namespace', 'linux.pid1'],
  uses: ['linux.process', 'linux.kernel', 'linux.procfs', 'linux.signal', 'linux.root'],
  tier: 'core',
  minutes: 45,
  sources: sources([man7('namespaces', 7), man7('pid_namespaces', 7), man7('user_namespaces', 7), man7('unshare', 1)], [opennet('namespaces', 7), opennet('unshare', 1), arch('Linux Containers (Русский)', 'Linux_Containers_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)')]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Можно ли на одной машине запустить программу так, чтобы она считала себя единственной: своё имя машины, сама себе первый процесс, своя сеть? Не на отдельном компьютере, а просто как ещё один процесс того же ядра?', 'Can you run a program on one machine so that it believes it is alone: its own host name, its own first process, its own network? Not on a separate computer, but as just another process of the same kernel?'),
    },
    {
      id: 'ns',
      kind: 'text',
      step: 'explain',
      title: bi('Стены вокруг процесса', 'Walls around a process'),
      body: bi(
        'Можно. Ядро умеет держать для процессов отдельные наборы того, что они видят, — [[linux.namespace|пространства имён]]. Каждый вид отвечает за своё:\n\n- **uts** — имя машины: `hostname` внутри и снаружи разные;\n- **pid** — нумерация процессов: внутри своя, с единицы;\n- **mnt** — список смонтированных файловых систем;\n- **net** — сетевой стек: свои интерфейсы, адреса, маршруты;\n- **user** — свои пользователи: внутри можно быть root, оставаясь снаружи обычным пользователем;\n- ещё `ipc`, `cgroup` и `time`.\n\nПо умолчанию все процессы машины живут в одних и тех же пространствах. Номера пространств — в `/proc/PID/ns/`: `readlink /proc/$$/ns/uts` даёт что-то вроде `uts:[4026531838]`, и у процессов в одном пространстве этот номер одинаковый. `lsns` показывает все пространства машины.\n\nНовое пространство создаёт `unshare`: `sudo unshare --uts bash` запускает оболочку, у которой своё имя машины. Смените его — `hostname box` — и снаружи имя останется прежним. `exit` возвращает в обычную оболочку. `nsenter --target PID --uts` входит в пространство уже работающего процесса.\n\nСетевое пространство одной командой: `sudo unshare --net ip a` показывает только `lo` — и тот выключен. Как связать такое пространство с остальной сетью, разберём в блоке про сети.',
        'You can. The kernel can keep separate sets of what processes see — [[linux.namespace|namespaces]]. Each kind is in charge of its own thing:\n\n- **uts** — the host name: `hostname` differs inside and outside;\n- **pid** — the numbering of processes: its own inside, starting from one;\n- **mnt** — the list of mounted file systems;\n- **net** — the network stack: its own interfaces, addresses, routes;\n- **user** — its own users: inside you can be root while staying an ordinary user outside;\n- plus `ipc`, `cgroup` and `time`.\n\nBy default all processes of a machine live in the same namespaces. The numbers of the namespaces are in `/proc/PID/ns/`: `readlink /proc/$$/ns/uts` gives something like `uts:[4026531838]`, and processes in the same namespace have the same number. `lsns` shows all namespaces of the machine.\n\n`unshare` creates a new one: `sudo unshare --uts bash` starts a shell with its own host name. Change it — `hostname box` — and outside the name stays the same. `exit` takes you back to the ordinary shell. `nsenter --target PID --uts` enters the namespace of a process that is already running.\n\nA network namespace in one command: `sudo unshare --net ip a` shows only `lo` — and it is down. How to connect such a namespace to the rest of the network is a topic of the networks block.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'linux.isolation', caption: bi('Включайте и выключайте стены; лимиты разберём в следующем уроке.', 'Turn the walls on and off; the limits come in the next lesson.') },
    {
      id: 'pid1',
      kind: 'text',
      step: 'explain',
      title: bi('Особый процесс номер 1', 'The special process number 1'),
      body: bi(
        '`sudo unshare --pid --fork --mount-proc bash` даёт оболочку, для которой она сама — [[linux.pid1|PID 1]]: `echo $$` печатает 1, а `ps` видит только её. `--fork` нужен потому, что новая нумерация действует для потомков `unshare`, а не для него самого. `--mount-proc` монтирует свежий `/proc`: `ps` читает процессы оттуда, и без нового `/proc` он показал бы все процессы машины. Снаружи эта оболочка — обычный процесс со своим обычным номером.\n\nУ первого процесса — всей системы или пространства имён — три особых обязанности. К нему переходят сироты: если родитель завершился, его дети становятся детьми PID 1. Он обязан забирать коды завершения у сирот, иначе они остаются зомби. И сигналы до него доходят по особым правилам: процессы внутри пространства могут послать ему только те сигналы, для которых у него есть обработчик, а процессы снаружи — ещё KILL и STOP. Поэтому `kill -9 1` внутри такой оболочки не делает ничего, а TERM с хоста не остановит программу, которая стала первым процессом и не умеет его обрабатывать.\n\nПространство user позволяет обычному пользователю создавать остальные: `unshare --user --map-root-user bash` даёт внутри `uid=0` — но только внутри. Файл, созданный там, снаружи принадлежит вам, а чужие файлы по-прежнему чужие.',
        '`sudo unshare --pid --fork --mount-proc bash` gives you a shell that is [[linux.pid1|PID 1]] to itself: `echo $$` prints 1 and `ps` sees only it. `--fork` is needed because the new numbering applies to the children of `unshare`, not to `unshare` itself. `--mount-proc` mounts a fresh `/proc`: `ps` reads processes from there, and without a new `/proc` it would show every process of the machine. From outside this shell is an ordinary process with an ordinary number.\n\nThe first process — of the whole system or of a namespace — has three special duties. Orphans go to it: if a parent ends, its children become children of PID 1. It must collect the exit codes of orphans, or they stay zombies. And signals reach it by special rules: processes inside the namespace can send it only the signals it has a handler for, and processes outside can also send KILL and STOP. That is why `kill -9 1` inside such a shell does nothing, and TERM from the host will not stop a program that became the first process and does not handle it.\n\nThe user namespace lets an ordinary user create the others: `unshare --user --map-root-user bash` gives you `uid=0` inside — but only inside. A file created there belongs to you outside, and other people’s files are still other people’s.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: {},
      tasks: [
        {
          id: 'uts',
          prompt: bi('Запустите оболочку со своим именем машины, назовите машину в ней `box` и вернитесь: снаружи имя должно остаться `trainer`.', 'Start a shell with its own host name, name the machine `box` inside it and come back: outside the name must stay `trainer`.'),
          check: { when: (f) => nss(f).some((n) => n.type === 'uts' && n.hostname === 'box') && f.hostname === 'trainer', fail: [{ if: (f) => f.hostname === 'box', say: bi('Вы переименовали саму машину: новое имя нужно было задать в новом пространстве uts.', 'You renamed the machine itself: the new name had to be set in a new uts namespace.') }] },
          chips: 'sudo unshare --uts bash',
          docRef: ref('man/unshare.1', 'OPTIONS', '-u, --uts'),
          hints: { H1: bi('Внутри `hostname box`, потом `exit` и снова `hostname`.', 'Inside, `hostname box`; then `exit` and `hostname` again.') },
        },
        {
          id: 'pidns',
          prompt: bi('Запустите оболочку, которая сама себе PID 1 и видит в `ps` только свои процессы.', 'Start a shell that is PID 1 to itself and sees only its own processes in `ps`.'),
          check: { when: (f) => nss(f).some((n) => n.type === 'pid' && n.id !== 4026531836) && nss(f).some((n) => n.type === 'mnt' && n.id !== 4026531841) },
          chips: 'sudo unshare --pid --fork --mount-proc bash',
          docRef: ref('man/unshare.1', 'OPTIONS', '--mount-proc'),
          hints: { H1: bi('Три флага: своя нумерация, fork, свой /proc.', 'Three flags: own numbering, fork, own /proc.'), H2: bi('Внутри проверьте `echo $$` и `ps`.', 'Inside, check `echo $$` and `ps`.') },
        },
        {
          id: 'userns',
          prompt: bi('Не используя sudo, станьте root внутри своего пространства user и создайте там файл `/tmp/inside`. Посмотрите снаружи, кому он принадлежит.', 'Without sudo, become root inside your own user namespace and create the file `/tmp/inside` there. Look outside at whom it belongs to.'),
          check: { when: "files['/tmp/inside'].owner=learner && ns[type=user]#>=2", fail: [{ if: "files['/tmp/inside'].owner=root", say: bi('Файл создал настоящий root: вы воспользовались sudo. Нужно пространство user.', 'The real root created the file: you used sudo. You need a user namespace.') }] },
          chips: 'unshare --user --map-root-user bash',
          docRef: { url: 'https://man7.org/linux/man-pages/man7/user_namespaces.7.html', label: 'user_namespaces(7)' },
          hints: { H1: bi('Внутри `id` покажет uid=0. Создайте файл, выйдите и сделайте `ls -l /tmp/inside`.', 'Inside, `id` shows uid=0. Create the file, leave and run `ls -l /tmp/inside`.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.ns-number', 'linux.q.mount-proc', 'linux.q.pid1-term'] },
  ],
};

// ── 16. cgroups and the OOM killer ──

const cgroupsLesson: Lesson = {
  id: 'linux.cgroups',
  block: 'linux',
  title: bi('Сколько процесс может взять: cgroups и OOM killer', 'How much a process may take: cgroups and the OOM killer'),
  summary: bi('Лимиты памяти, процессора и числа процессов — это файлы в `/sys/fs/cgroup`. Учебная тревога: процесс упирается в память и получает KILL.', 'Limits on memory, CPU and the number of processes are files in `/sys/fs/cgroup`. A drill: a process hits its memory limit and gets KILL.'),
  introduces: ['linux.cgroup', 'linux.oom'],
  uses: ['linux.process', 'linux.kernel', 'linux.systemd', 'linux.signal', 'linux.sudo'],
  tier: 'core',
  minutes: 45,
  sources: sources([{ title: 'Control Group v2 — The Linux Kernel documentation', url: 'https://docs.kernel.org/admin-guide/cgroup-v2.html' }, man7('cgroups', 7), { title: 'systemd.resource-control(5)', url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html' }], [wiki('cgroups', 'Cgroups'), opennet('cgroups', 7), arch('cgroups (Русский)', 'Cgroups_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)')]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Ночной отчёт съел всю память сервера, и ядро, спасая машину, убило базу данных — самый большой процесс. Отчёт виноват, а пострадал сосед. Можно ли заранее сказать: «этой программе — не больше 64 мегабайт»?', 'The nightly report ate all of the server’s memory, and the kernel, saving the machine, killed the database — the biggest process. The report was at fault, the neighbour paid. Can you say in advance: “this program gets no more than 64 megabytes”?'),
    },
    {
      id: 'cg',
      kind: 'text',
      step: 'explain',
      title: bi('Группы с лимитами', 'Groups with limits'),
      body: bi(
        'Можно. Ядро объединяет процессы в [[linux.cgroup|cgroup]] — группы с общими счётчиками и лимитами. Это дерево каталогов в `/sys/fs/cgroup`, и управляют им обычными командами: каталог — группа, файлы в нём — счётчики и лимиты.\n\n- `memory.current` — сколько памяти у группы сейчас, `memory.max` — сколько можно;\n- `cpu.max` — доля процессора: `50000 100000` значит 50 мс из каждых 100, полпроцессора;\n- `pids.current` и `pids.max` — сколько процессов и потоков, и сколько можно;\n- `cgroup.procs` — номера процессов группы; запишите туда номер — процесс переедет в группу;\n- `memory.events`, `pids.events` — сколько раз группа упиралась в лимит.\n\nsystemd уже разложил по этому дереву все службы: `systemd-cgls` покажет `system.slice` со службами и `user.slice` с вашей оболочкой. Строки `MemoryMax=`, `CPUQuota=`, `TasksMax=` в unit-файле пишут как раз в эти файлы.\n\nСоздать группу руками — значит создать каталог: ядро само положит в него все файлы.\n\n```\nsudo mkdir /sys/fs/cgroup/lab\necho 32M | sudo tee /sys/fs/cgroup/lab/memory.max\necho $$  | sudo tee /sys/fs/cgroup/lab/cgroup.procs\n```\n\nПоследняя строка переносит в группу вашу оболочку — и все команды, которые она запустит, тоже окажутся в группе.',
        'You can. The kernel joins processes into a [[linux.cgroup|cgroup]] — groups with shared counters and limits. It is a tree of directories in `/sys/fs/cgroup`, managed with ordinary commands: a directory is a group, the files inside are counters and limits.\n\n- `memory.current` — how much memory the group has now, `memory.max` — how much it may have;\n- `cpu.max` — a share of the CPU: `50000 100000` means 50 ms out of every 100, half a CPU;\n- `pids.current` and `pids.max` — how many processes and threads, and how many are allowed;\n- `cgroup.procs` — the process numbers of the group; write a number there and the process moves into the group;\n- `memory.events`, `pids.events` — how many times the group hit a limit.\n\nsystemd has already laid out all services on this tree: `systemd-cgls` shows `system.slice` with the services and `user.slice` with your shell. The lines `MemoryMax=`, `CPUQuota=`, `TasksMax=` in a unit file write exactly into these files.\n\nCreating a group by hand means creating a directory: the kernel puts all the files into it itself.\n\n```\nsudo mkdir /sys/fs/cgroup/lab\necho 32M | sudo tee /sys/fs/cgroup/lab/memory.max\necho $$  | sudo tee /sys/fs/cgroup/lab/cgroup.procs\n```\n\nThe last line moves your shell into the group — and every command it starts will end up in the group too.',
      ),
    },
    {
      id: 'oom',
      kind: 'text',
      step: 'explain',
      title: bi('Когда память кончилась', 'When memory runs out'),
      body: bi(
        'Что делает ядро, когда группе нужна память сверх `memory.max`? Сначала пытается отобрать у неё кэш. Не вышло — запускает [[linux.oom|OOM killer]] (out of memory) внутри группы: выбирает самый большой процесс группы и убивает его сигналом KILL. Код завершения — 137 (128 + 9), оболочка пишет `Killed`, в `memory.events` растёт `oom_kill`, а в `dmesg` появляется строка `Memory cgroup out of memory: Killed process …`. Остальная машина ничего не замечает.\n\nБез лимита то же самое случается со всей машиной: глобальный OOM killer выбирает самый тяжёлый процесс машины — и это может оказаться совсем не виновник. Отсюда правило: у всего, что может расти, должен быть лимит памяти.\n\nЛимит процессора работает иначе: процесс не убивают, а притормаживают — в каждом периоде он ждёт, пока не кончится его доля. Лимит числа процессов останавливает `fork`: «Resource temporarily unavailable».',
        'What does the kernel do when a group needs memory beyond `memory.max`? First it tries to take the group’s cache away. If that fails, it runs the [[linux.oom|OOM killer]] (out of memory) inside the group: it picks the biggest process of the group and kills it with KILL. The exit code is 137 (128 + 9), the shell prints `Killed`, `oom_kill` grows in `memory.events`, and `dmesg` gets a line `Memory cgroup out of memory: Killed process …`. The rest of the machine notices nothing.\n\nWithout a limit the same happens to the whole machine: the global OOM killer picks the heaviest process of the machine — and that may be someone other than the culprit. Hence the rule: everything that can grow must have a memory limit.\n\nThe CPU limit works differently: the process is not killed but slowed down — in every period it waits until its share is used up. The limit on the number of processes stops `fork`: “Resource temporarily unavailable”.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'linux.isolation', params: { pid: false, uts: false, net: false }, caption: bi('Теперь — счётчики. Уберите лимит памяти (0) и посмотрите, кого убьёт ядро.', 'Now the meters. Remove the memory limit (0) and see whom the kernel kills.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: {},
      intro: bi('`memhog N` занимает N мебибайт памяти и выходит. Учебная тревога: запустите его в группе с лимитом поменьше.', '`memhog N` takes N mebibytes of memory and exits. A drill: run it in a group with a smaller limit.'),
      tasks: [
        {
          id: 'oom',
          prompt: bi('Создайте группу `/sys/fs/cgroup/lab` с лимитом памяти 32 мебибайта, перенесите в неё свою оболочку и запустите `memhog 64`. Ядро должно его остановить.', 'Create the group `/sys/fs/cgroup/lab` with a 32 MiB memory limit, move your shell into it and run `memhog 64`. The kernel must stop it.'),
          check: {
            when: (f) => {
              const g = cgroups(f).find((x) => x.path === '/lab');
              return !!g && g.memory.max !== 'max' && g.memory.max <= 32 * 1024 * 1024 && (g.memory.events.oom_kill ?? 0) >= 1;
            },
            fail: [
              { if: (f) => { const g = cgroups(f).find((x) => x.path === '/lab'); return !!g && g.memory.max === 'max'; }, say: bi('Группа есть, но лимита нет: `memory.max` всё ещё max.', 'The group exists but has no limit: `memory.max` is still max.') },
              { if: (f) => { const g = cgroups(f).find((x) => x.path === '/lab'); return !!g && g.memory.max !== 'max' && (g.memory.events.oom_kill ?? 0) === 0 && term(f).includes('memhog'); }, say: bi('memhog доработал: значит, он был не в группе. Перенесите оболочку: `echo $$ | sudo tee /sys/fs/cgroup/lab/cgroup.procs`.', 'memhog finished: so it was not in the group. Move the shell: `echo $$ | sudo tee /sys/fs/cgroup/lab/cgroup.procs`.') },
            ],
          },
          chips: 'sudo mkdir /sys/fs/cgroup/lab',
          docRef: { url: 'https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files', label: 'cgroup-v2 · memory.max' },
          hints: { H1: bi('Три шага из текста урока, потом `memhog 64`.', 'The three steps from the lesson text, then `memhog 64`.'), H2: bi('Посмотрите `cat /sys/fs/cgroup/lab/memory.events` и `sudo dmesg | tail`.', 'Look at `cat /sys/fs/cgroup/lab/memory.events` and `sudo dmesg | tail`.') },
        },
        {
          id: 'pids',
          prompt: bi('Ограничьте группу `lab` пятью процессами и запустите `spawner 10` — он попробует запустить десять. Ядро должно отказать.', 'Limit the `lab` group to five processes and run `spawner 10` — it will try to start ten. The kernel must refuse.'),
          check: { when: (f) => { const g = cgroups(f).find((x) => x.path === '/lab'); return !!g && g.pids.max !== 'max' && g.pids.max <= 5 && (g.pids.events.max ?? 0) >= 1; } },
          chips: 'echo 5 | sudo tee /sys/fs/cgroup/lab/pids.max',
          docRef: { url: 'https://docs.kernel.org/admin-guide/cgroup-v2.html#pid-interface-files', label: 'cgroup-v2 · pids.max' },
          hints: { H1: bi('Файл лимита числа процессов — `pids.max`.', 'The limit on the number of processes is the file `pids.max`.') },
        },
      ],
    },
    {
      id: 'systemd-run',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Запустите `spawner 30` так, чтобы у него было не больше 20 процессов, — не трогая `/sys` руками. Пусть группу создаст systemd. Как — в уроке не было.', 'Run `spawner 30` so that it can have at most 20 processes — without touching `/sys` by hand. Let systemd create the group. How — the lesson did not say.'),
      ref: { url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html', label: 'systemd-run(1)' },
      terminal: {
        setup: {},
        task: {
          id: 'systemd-run',
          prompt: bi('spawner в группе systemd с лимитом 20 процессов.', 'spawner in a systemd group with a limit of 20 processes.'),
          check: { when: (f) => cgroups(f).some((g) => g.path.startsWith('/system.slice/') && g.pids.max === 20) },
          docStep: 4,
          beyond: true,
          solutionTokens: ['systemd-run', 'TasksMax', '--scope', '-p TasksMax=20'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.oom-events', 'linux.q.oom-137', 'linux.q.cpu-max', 'linux.q.global-oom'] },
  ],
};

function term(f: Facts): string {
  return ((f.term?.main ?? []) as { out: string }[]).map((x) => x.out).join('\n');
}

// ── 17. Capabilities and seccomp ──

const caps: Lesson = {
  id: 'linux.caps',
  block: 'linux',
  title: bi('Что процессу разрешено: привилегии ядра и seccomp', 'What a process may do: capabilities and seccomp'),
  summary: bi('root — не одно право, а около сорока. Их можно отнять у root и дать одно обычной программе; а seccomp запрещает процессу целые системные вызовы.', 'root is not one power but about forty. They can be taken away from root, and one can be given to an ordinary program; seccomp forbids whole system calls to a process.'),
  introduces: ['linux.capability', 'linux.seccomp'],
  uses: ['linux.root', 'linux.mode', 'linux.syscall', 'linux.procfs', 'linux.systemd'],
  tier: 'core',
  minutes: 35,
  sources: sources([man7('capabilities', 7), man7('capsh', 1), man7('setcap', 8), man7('seccomp', 2), { title: 'systemd.exec(5)', url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html' }], [opennet('capabilities', 7), opennet('setcap', 8), arch('Capabilities (Русский)', 'Capabilities_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)')]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Веб-сервер должен ждать подключений на номере `:80`, а номера ниже `1024` исторически отданы только root. Запускать весь веб-сервер от root ради одной этой мелочи — значит отдать каждой его ошибке всю машину. Нельзя ли дать программе ровно одно право?', 'A web server must wait for connections on `:80`, and the numbers below `1024` historically belong to root only. Running the whole web server as root for that one small thing means handing every bug in it the whole machine. Can a program be given exactly one right?'),
    },
    {
      id: 'caps',
      kind: 'text',
      step: 'explain',
      title: bi('root — это набор прав', 'root is a set of powers'),
      body: bi(
        'Можно. То, что мы называли «root может всё», ядро давно разбило на отдельные [[linux.capability|привилегии ядра]] (capabilities), их около сорока:\n\n- `CAP_DAC_OVERRIDE` — обходить биты прав, а `CAP_DAC_READ_SEARCH` — права на чтение: вот почему root читает чужой файл с режимом `600`;\n- `CAP_NET_BIND_SERVICE` — ждать подключений на номерах ниже `1024`;\n- `CAP_KILL` — посылать сигналы чужим процессам;\n- `CAP_SYS_ADMIN` — монтировать, создавать пространства имён и ещё многое;\n- `CAP_SYSLOG` — читать сообщения ядра, поэтому `dmesg` требует sudo.\n\nУ каждого процесса есть набор действующих привилегий — строка `CapEff` в `/proc/PID/status`; `capsh --decode=…` переводит её в имена, `capsh --print` показывает свои. Набор можно урезать: `sudo capsh --drop=cap_dac_override,cap_dac_read_search -- -c \'cat /home/anna/notes.txt\'` — это root без двух привилегий, и чужой файл с режимом `600` он уже не прочитает: `Permission denied`.\n\nА можно наоборот — дать одну привилегию обычной программе, записав её прямо на файл: `sudo setcap cap_net_bind_service=+ep /usr/local/bin/web-demo`. Теперь любой, кто запустит эту программу, получит ровно право ждать подключений на низких номерах, и ничего сверх. `getcap` показывает такие файлы. Это гораздо безопаснее старого setuid-бита, который давал программе всего root.',
        'You can. What we called “root can do anything”, the kernel long ago split into separate [[linux.capability|capabilities]], about forty of them:\n\n- `CAP_DAC_OVERRIDE` — bypass the permission bits, and `CAP_DAC_READ_SEARCH` the read permission: that is why root reads someone else’s file with mode `600`;\n- `CAP_NET_BIND_SERVICE` — wait for connections on numbers below `1024`;\n- `CAP_KILL` — send signals to other users’ processes;\n- `CAP_SYS_ADMIN` — mount, create namespaces and much more;\n- `CAP_SYSLOG` — read the kernel’s messages, which is why `dmesg` needs sudo.\n\nEvery process has a set of effective capabilities — the `CapEff` line in `/proc/PID/status`; `capsh --decode=…` turns it into names, `capsh --print` shows your own. The set can be cut down: `sudo capsh --drop=cap_dac_override,cap_dac_read_search -- -c \'cat /home/anna/notes.txt\'` is root without two capabilities, and it can no longer read someone else’s file with mode `600`: `Permission denied`.\n\nOr the other way round — give one capability to an ordinary program by writing it onto the file: `sudo setcap cap_net_bind_service=+ep /usr/local/bin/web-demo`. Now whoever runs this program gets exactly the right to wait for connections on low numbers and nothing more. `getcap` shows such files. That is far safer than the old setuid bit, which gave a program all of root.',
      ),
    },
    {
      id: 'seccomp',
      kind: 'text',
      step: 'explain',
      title: bi('Фильтр системных вызовов', 'A filter of system calls'),
      body: bi(
        'Привилегии решают, что можно root. [[linux.seccomp|seccomp]] идёт дальше: процесс может заранее попросить ядро запретить ему целые системные вызовы — например, всё, что связано с монтированием или перезагрузкой. Запрещённый вызов не выполняется: возвращается ошибка или процесс убивают. Строка `Seccomp: 2` в `/proc/PID/status` значит, что фильтр включён.\n\nСвои фильтры здесь писать не будем; у systemd это одна строка в unit-файле — `SystemCallFilter=@system-service`, а группы вызовов показывает `systemd-analyze syscall-filter`. Важна мысль: чем меньше процесс может попросить у ядра, тем меньше вреда от его ошибки.',
        'Capabilities decide what root may do. [[linux.seccomp|seccomp]] goes further: a process can ask the kernel in advance to forbid it whole system calls — for example, everything about mounting or rebooting. A forbidden call is not carried out: it returns an error or the process is killed. The line `Seccomp: 2` in `/proc/PID/status` means the filter is on.\n\nWe will not write our own filters here; in systemd it is one line in a unit file — `SystemCallFilter=@system-service`, and `systemd-analyze syscall-filter` shows the groups of calls. The idea is what matters: the less a process can ask of the kernel, the less harm its bugs can do.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: { users: [{ name: 'anna', uid: 1001 }], files: [{ path: '/usr/local/bin/web-demo', content: '#!/usr/bin/sim\n# web-demo: the lab web server\n', owner: 'root', mode: '0755' }, { path: '/home/anna/notes.txt', content: 'anna’s private notes\n', owner: 'anna', mode: '0600' }] },
      tasks: [
        {
          id: 'drop',
          prompt: bi('Покажите, что root без привилегий `CAP_DAC_OVERRIDE` и `CAP_DAC_READ_SEARCH` не может прочитать `/home/anna/notes.txt` (режим `600`, владелец anna).', 'Show that root without the capabilities `CAP_DAC_OVERRIDE` and `CAP_DAC_READ_SEARCH` cannot read `/home/anna/notes.txt` (mode `600`, owner anna).'),
          check: { when: "term['main'][last].exit!=0", stdout: /cat: \/home\/anna\/notes\.txt: Permission denied/ },
          chips: "sudo capsh --drop=cap_dac_override,cap_dac_read_search -- -c 'cat /home/anna/notes.txt'",
          docRef: { url: 'https://man7.org/linux/man-pages/man1/capsh.1.html', label: 'capsh(1) · --drop' },
          hints: { H1: bi('`capsh --drop=… -- -c \'команда\'` запускает команду с урезанным набором.', '`capsh --drop=… -- -c \'command\'` runs a command with a reduced set.') },
        },
        {
          id: 'bind',
          prompt: bi('Сделайте так, чтобы вы — не root и без sudo при запуске — могли запустить `/usr/local/bin/web-demo --port 80 &`, и запустите.', 'Make it possible for you — not root and without sudo at run time — to start `/usr/local/bin/web-demo --port 80 &`, and start it.'),
          check: {
            when: (f) => procs(f).some((p) => p.cmd === 'web-demo' && p.uid === 1000 && (p.listen ?? []).includes(80)),
            fail: [{ if: (f) => procs(f).some((p) => p.cmd === 'web-demo' && p.uid === 0), say: bi('Сервер работает от root: это то, чего мы избегаем. Дайте файлу одну привилегию и запустите без sudo.', 'The server runs as root: exactly what we are avoiding. Give the file one capability and start it without sudo.') }],
          },
          chips: 'sudo setcap cap_net_bind_service=+ep /usr/local/bin/web-demo',
          docRef: { url: 'https://man7.org/linux/man-pages/man8/setcap.8.html', label: 'setcap(8)' },
          hints: { H1: bi('Без привилегии: `bind: permission denied`. Какая привилегия про низкие номера?', 'Without the capability: `bind: permission denied`. Which capability is about the low numbers?') },
        },
        {
          id: 'seccomp',
          prompt: bi('Выясните, включён ли фильтр системных вызовов у службы журнала `systemd-journald`, и запишите значение поля Seccomp её процесса в `~/seccomp.txt`.', 'Find out whether the journal service `systemd-journald` has a system call filter and write the value of its process’s Seccomp field into `~/seccomp.txt`.'),
          check: { when: (f) => /^\s*(Seccomp:\s*)?2\s*$/m.test(text(f, '/home/learner/seccomp.txt')) && !/^\s*(Seccomp:\s*)?0\s*$/m.test(text(f, '/home/learner/seccomp.txt')) },
          chips: 'grep Seccomp /proc/$(pgrep systemd-journal)/status',
          hints: { H1: bi('Номер процесса — `pgrep systemd-journal` (имя обрезано до 15 букв).', 'The process number is `pgrep systemd-journal` (the name is cut to 15 letters).') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.dac', 'linux.q.seccomp', 'linux.q.setcap-copy'] },
  ],
};

// ── 18. A process's root: chroot and overlayfs ──

const BUSYBOX = ['sh', 'ls', 'cat', 'echo', 'ps', 'hostname', 'id', 'mkdir', 'touch', 'pwd'];
const rootfsSetup: TerminalSetup = {
  files: [
    { path: '/lab/rootfs/bin/busybox', content: '#!/usr/bin/sim\n# busybox: BusyBox multi-call binary\n', owner: 'root', mode: '0755' },
    ...BUSYBOX.map((n) => ({ path: `/lab/rootfs/bin/${n}`, type: 'l' as const, target: 'busybox', owner: 'root' })),
    { path: '/lab/rootfs/etc/hostname', content: 'tiny\n', owner: 'root' },
    { path: '/lab/rootfs/tmp', type: 'd', owner: 'root', mode: '1777' },
    { path: '/lab/rootfs/proc', type: 'd', owner: 'root' },
    { path: '/lab/lower/etc/motd', content: 'Welcome to the base layer.\n', owner: 'root' },
    { path: '/lab/lower/old.txt', content: 'an old file\n', owner: 'root' },
    { path: '/lab/lower/app/config', content: 'mode=prod\n', owner: 'root' },
    { path: '/lab/upper', type: 'd', owner: 'root' },
    { path: '/lab/work', type: 'd', owner: 'root' },
    { path: '/lab/merged', type: 'd', owner: 'root' },
  ],
};

const rootfs: Lesson = {
  id: 'linux.rootfs',
  block: 'linux',
  title: bi('Корень процесса: chroot и файловая система из слоёв', 'A process’s root: chroot and a file system of layers'),
  summary: bi('Процессу можно подменить корень файлов. А сам корень можно собрать из слоёв, где нижние только для чтения, а изменения ложатся сверху.', 'A process can be given a different root of files. And the root itself can be built of layers, the lower ones read-only, the changes landing on top.'),
  introduces: ['linux.chroot', 'linux.overlay'],
  uses: ['linux.mount', 'linux.namespace', 'linux.root-dir', 'linux.inode'],
  tier: 'core',
  minutes: 40,
  sources: sources([man7('chroot', 2), man7('pivot_root', 2), { title: 'Overlay Filesystem — The Linux Kernel documentation', url: 'https://docs.kernel.org/filesystems/overlayfs.html' }], [wiki('chroot', 'Chroot'), opennet('chroot', 2), arch('Chroot (Русский)', 'Chroot_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)')]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Десять программ на одной машине хотят каждая свою систему: одной нужна старая библиотека, другой — новая. Можно ли показать каждой свой `/` — и не держать при этом десять полных копий системы?', 'Ten programs on one machine each want their own system: one needs an old library, another a new one. Can each be shown its own `/` — without keeping ten full copies of the system?'),
    },
    {
      id: 'chroot',
      kind: 'text',
      step: 'explain',
      title: bi('chroot', 'chroot'),
      body: bi(
        'Самый старый способ — [[linux.chroot|chroot]]: процесс получает другой корень, и всё, что лежит выше выбранного каталога, для него исчезает. `sudo chroot /lab/rootfs /bin/sh` запускает оболочку, для которой `/` — это `/lab/rootfs`. Внутри должно быть всё, что программа будет искать: сама оболочка, команды, их библиотеки. Проще всего положить туда busybox — одну программу, которая притворяется `sh`, `ls`, `cat` и десятками других, смотря под каким именем её запустили.\n\nНо chroot меняет только видимый корень. Процессы, сеть, имя машины остаются общими: внутри `ps` видит все процессы машины (стоит смонтировать туда `/proc`), а root внутри может выбраться обратно. Поэтому chroot — не изоляция, а лишь её кусок. Настоящую стену из файлов строят пространством mnt и вызовом `pivot_root`, который меняет корень для всего пространства и отцепляет старый.',
        'The oldest way is [[linux.chroot|chroot]]: a process gets another root, and everything above the chosen directory disappears for it. `sudo chroot /lab/rootfs /bin/sh` starts a shell for which `/` is `/lab/rootfs`. Everything the program will look for must be inside: the shell itself, the commands, their libraries. The simplest is to put busybox there — one program that pretends to be `sh`, `ls`, `cat` and dozens of others, depending on the name it was started under.\n\nBut chroot changes only the visible root. Processes, the network and the host name stay shared: inside, `ps` sees every process of the machine (once `/proc` is mounted there), and root inside can climb back out. So chroot is not isolation, only a piece of it. A real wall of files is built with a mnt namespace and the `pivot_root` call, which changes the root for the whole namespace and detaches the old one.',
      ),
    },
    {
      id: 'overlay',
      kind: 'text',
      step: 'explain',
      title: bi('Слои', 'Layers'),
      body: bi(
        'Чтобы не держать десять копий, корень собирают из слоёв — это [[linux.overlay|overlayfs]]. Нижние слои (lower) только читаются и могут быть общими у всех. Верхний слой (upper) принимает изменения. Сверху видна их сумма — merged:\n\n```\nsudo mount -t overlay overlay \\\n  -o lowerdir=/lab/lower,upperdir=/lab/upper,workdir=/lab/work /lab/merged\n```\n\nЧтение файла идёт сквозь слои до первого, где он есть. При первой записи файл целиком копируется наверх (copy-up) и меняется уже там: нижний слой не трогается никогда. Удаление файла из нижнего слоя оставляет в верхнем метку — whiteout, особый файл-устройство с номерами 0, 0: «этого файла не показывать». `ls -l /lab/upper` покажет её как `c---------`.\n\nТак десять программ делят одни и те же нижние слои, а у каждой свой тонкий верхний.',
        'So as not to keep ten copies, the root is built of layers — that is [[linux.overlay|overlayfs]]. The lower layers are only read and can be shared by everyone. The upper layer takes the changes. On top you see their sum — merged:\n\n```\nsudo mount -t overlay overlay \\\n  -o lowerdir=/lab/lower,upperdir=/lab/upper,workdir=/lab/work /lab/merged\n```\n\nReading a file goes through the layers down to the first one that has it. On the first write the file is copied up whole (copy-up) and changed there: the lower layer is never touched. Deleting a file of a lower layer leaves a mark in the upper one — a whiteout, a special device file numbered 0, 0: “do not show this file”. `ls -l /lab/upper` shows it as `c---------`.\n\nThat way ten programs share the same lower layers, and each has its own thin upper one.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: rootfsSetup,
      tasks: [
        {
          id: 'chroot',
          prompt: bi('Войдите в `/lab/rootfs` через chroot и создайте внутри файл `/tmp/from-inside`. Потом выйдите и найдите его снаружи.', 'Enter `/lab/rootfs` with chroot and create the file `/tmp/from-inside` inside. Then leave and find it from outside.'),
          check: { when: "files['/lab/rootfs/tmp/from-inside'].type=f", fail: [{ if: "files['/tmp/from-inside'].type=f", say: bi('Файл появился в настоящем `/tmp`: вы создали его не внутри chroot.', 'The file appeared in the real `/tmp`: you created it outside the chroot.') }] },
          chips: 'sudo chroot /lab/rootfs /bin/sh',
          docRef: ref('man/chroot.8', 'DESCRIPTION'),
          hints: { H1: bi('Внутри `touch /tmp/from-inside`, `exit`, затем `ls /lab/rootfs/tmp`.', 'Inside, `touch /tmp/from-inside`, `exit`, then `ls /lab/rootfs/tmp`.') },
        },
        {
          id: 'overlay',
          prompt: bi('Соберите в `/lab/merged` наложение: нижний слой `/lab/lower`, верхний `/lab/upper`. Допишите строку в `/lab/merged/etc/motd` и удалите `/lab/merged/old.txt`. Нижний слой должен остаться нетронутым.', 'Assemble an overlay at `/lab/merged`: lower layer `/lab/lower`, upper `/lab/upper`. Append a line to `/lab/merged/etc/motd` and delete `/lab/merged/old.txt`. The lower layer must stay untouched.'),
          check: {
            when: "files['/lab/upper/etc/motd'].type=f && files['/lab/upper/old.txt'].type=c && files['/lab/lower/old.txt'].type=f && files['/lab/lower/etc/motd'].text='Welcome to the base layer.\n'",
            fail: [{ if: "!mounts[target='/lab/merged']", say: bi('Наложение не смонтировано: `mount -t overlay` с тремя каталогами в `-o`.', 'The overlay is not mounted: `mount -t overlay` with three directories in `-o`.') }],
          },
          chips: 'sudo mount -t overlay overlay -o lowerdir=/lab/lower,upperdir=/lab/upper,workdir=/lab/work /lab/merged',
          docRef: { url: 'https://docs.kernel.org/filesystems/overlayfs.html', label: 'Overlay Filesystem' },
          hints: { H1: bi('После правки посмотрите `ls -lR /lab/upper`: что там появилось?', 'After the edit look at `ls -lR /lab/upper`: what appeared there?'), H2: bi("Дописать от root: `echo line | sudo tee -a /lab/merged/etc/motd`.", "Appending as root: `echo line | sudo tee -a /lab/merged/etc/motd`.") },
        },
      ],
    },
    {
      id: 'forward',
      kind: 'callout',
      tone: 'note',
      step: 'review',
      title: bi('Что дальше', 'What comes next'),
      body: bi('Соберите вместе последние уроки: свои пространства имён, группа с лимитами, урезанные привилегии и фильтр вызовов, корень из слоёв. В следующем большом блоке курса вы увидите, что именно это и запускают инструменты, которыми собирают и развёртывают приложения.', 'Put the last lessons together: own namespaces, a group with limits, reduced capabilities and a call filter, a root made of layers. In the next big block of the course you will see that this is exactly what the tools that build and deploy applications run.'),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.chroot', 'linux.q.whiteout', 'linux.q.copyup'] },
  ],
};

// ── 19. The network as the machine sees it, and SSH keys ──

const sshSetup: TerminalSetup = { users: [{ name: 'deploy', uid: 1100 }] };

const sshOk = (f: Facts) => {
  const ak = f.files['/home/deploy/.ssh/authorized_keys'] as { mode?: string; owner?: string; text?: string } | undefined;
  const dir = f.files['/home/deploy/.ssh'] as { mode?: string; owner?: string } | undefined;
  const pub = text(f, '/home/learner/.ssh/id_ed25519.pub').split(' ')[1] ?? '';
  return !!ak && !!dir && !!pub && (ak.text ?? '').includes(pub) && ak.owner === 'deploy' && dir.owner === 'deploy' && !(parseInt(ak.mode ?? '777', 8) & 0o022) && !(parseInt(dir.mode ?? '777', 8) & 0o022);
};

const ssh: Lesson = {
  id: 'linux.ssh',
  block: 'linux',
  title: bi('Сеть глазами машины и вход по ключу', 'The network through the machine’s eyes, and logging in with a key'),
  summary: bi('Какие у машины интерфейсы и кто на ней ждёт подключений. Как устроен вход по SSH без пароля и почему sshd придирается к правам.', 'Which interfaces the machine has and who waits for connections on it. How an SSH login without a password works and why sshd is picky about permissions.'),
  introduces: ['linux.net-commands', 'linux.ssh-key'],
  uses: ['linux.mode', 'linux.home', 'linux.daemon', 'linux.journal'],
  tier: 'core',
  minutes: 40,
  sources: sources([{ title: 'ssh(1) — OpenBSD manual', url: 'https://man.openbsd.org/ssh' }, { title: 'ssh-keygen(1) — OpenBSD manual', url: 'https://man.openbsd.org/ssh-keygen' }, { title: 'sshd_config(5) — OpenBSD manual', url: 'https://man.openbsd.org/sshd_config' }, man7('ip', 8)], [wiki('SSH', 'SSH'), arch('OpenSSH (Русский)', 'OpenSSH_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)'), arch('SSH keys (Русский)', 'SSH_keys_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)')]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Вам выдали сервер: «адрес, логин deploy, заходи по ключу». Какой ключ, куда его класть и почему с правильным ключом всё равно пишет `Permission denied (publickey)`?', 'You were given a server: “the address, the login deploy, log in with your key”. Which key, where does it go, and why does it still say `Permission denied (publickey)` with the right key?'),
    },
    {
      id: 'net',
      kind: 'text',
      step: 'explain',
      title: bi('Что машина знает о сети', 'What the machine knows about the network'),
      body: bi(
        'Машина подключена к сети через [[linux.net-commands|сетевые интерфейсы]]: `lo` — интерфейс «сама к себе», `eth0` (или `ens3`, `enp0s3`) — к остальным. У интерфейса есть адрес — номер машины в сети. `ip a` показывает интерфейсы и их адреса, `ip r` — куда машина отправляет всё, что не знает куда деть. `ss -ltnp` показывает программы, которые ждут подключений: у каждой свой номер после двоеточия — `:22` у `sshd`, `:80` у веб-сервера. Что эти числа значат и как по ним путешествуют данные, подробно разберём в блоке про сети; пока достаточно уметь спросить машину.',
        'A machine is connected to a network through [[linux.net-commands|network interfaces]]: `lo` is “itself to itself”, `eth0` (or `ens3`, `enp0s3`) connects it to the others. An interface has an address — the machine’s number in the network. `ip a` shows the interfaces and their addresses, `ip r` where the machine sends whatever it does not know where to put. `ss -ltnp` shows the programs waiting for connections: each has its own number after a colon — `:22` for `sshd`, `:80` for a web server. What these numbers mean and how data travels by them is the subject of the networks block; for now it is enough to be able to ask the machine.',
      ),
    },
    {
      id: 'keys',
      kind: 'text',
      step: 'explain',
      title: bi('Вход по ключу', 'Logging in with a key'),
      body: bi(
        '`ssh deploy@server` открывает зашифрованный канал к службе `sshd` на сервере и запускает там вашу оболочку. Входить по паролю неудобно и опасно: пароль можно подобрать. Вместо него используют [[linux.ssh-key|пару ключей]]:\n\n```\nssh-keygen -t ed25519\n```\n\nсоздаёт два файла: `~/.ssh/id_ed25519` — закрытый ключ, он никогда не покидает вашу машину и должен быть читаем только вами (режим `600`), и `~/.ssh/id_ed25519.pub` — открытый, его можно показывать кому угодно. Открытый ключ кладут на сервер, в `~/.ssh/authorized_keys` того пользователя, под которым будете входить. При входе сервер проверяет, что у вас есть закрытая пара к одному из этих открытых, — пароль по сети не передаётся.\n\nsshd проверяет и права: если `~/.ssh` или `authorized_keys` может изменить кто-то, кроме владельца, ключам он не доверяет (настройка StrictModes) и пишет в журнал `Authentication refused: bad ownership or modes`. Поэтому `~/.ssh` — `700`, `authorized_keys` — `600`, и оба принадлежат самому пользователю. Слишком открытый закрытый ключ отвергает уже клиент: `UNPROTECTED PRIVATE KEY FILE`.\n\nПри первом подключении клиент запоминает отпечаток ключа сервера в `~/.ssh/known_hosts`. Если однажды отпечаток не совпадёт, ssh откажется подключаться — это повод остановиться и выяснить, с тем ли сервером вы говорите.',
        '`ssh deploy@server` opens an encrypted channel to the `sshd` service on the server and starts your shell there. Logging in with a password is inconvenient and dangerous: a password can be guessed. A [[linux.ssh-key|key pair]] is used instead:\n\n```\nssh-keygen -t ed25519\n```\n\ncreates two files: `~/.ssh/id_ed25519` — the private key; it never leaves your machine and must be readable only by you (mode `600`); and `~/.ssh/id_ed25519.pub` — the public one, which you may show anyone. The public key goes onto the server, into `~/.ssh/authorized_keys` of the user you will log in as. At login the server checks that you hold the private half of one of those public keys — no password travels over the network.\n\nsshd checks permissions too: if `~/.ssh` or `authorized_keys` can be changed by anyone but the owner, it does not trust the keys (the StrictModes setting) and logs `Authentication refused: bad ownership or modes`. So `~/.ssh` is `700`, `authorized_keys` is `600`, and both belong to the user. A private key that is too open is rejected by the client itself: `UNPROTECTED PRIVATE KEY FILE`.\n\nOn the first connection the client remembers the fingerprint of the server’s key in `~/.ssh/known_hosts`. If one day the fingerprint does not match, ssh refuses to connect — a reason to stop and find out whether you are talking to the right server.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: sshSetup,
      intro: bi('Второй машины здесь нет: вы будете входить по SSH на эту же машину, под пользователем deploy — `ssh deploy@localhost`. Устроено это так же, как вход на чужой сервер.', 'There is no second machine here: you will log in over SSH to this same machine as the user deploy — `ssh deploy@localhost`. It works the same way as logging in to someone else’s server.'),
      tasks: [
        {
          id: 'listen',
          prompt: bi('Выясните, какая программа на машине ждёт подключений по номеру 22.', 'Find out which program on the machine waits for connections on number 22.'),
          check: { stdout: /:22\b/ },
          chips: 'sudo ss -ltnp',
          docRef: ref('man/ss.8', 'DESCRIPTION'),
          hints: { H1: bi('`ss -ltnp`, а чтобы видеть программы — через sudo.', '`ss -ltnp`, and with sudo to see the programs.') },
        },
        {
          id: 'keygen',
          prompt: bi('Создайте свою пару ключей ed25519 в стандартном месте, без пароля на ключ.', 'Create your ed25519 key pair in the standard place, without a passphrase.'),
          check: { when: "files['/home/learner/.ssh/id_ed25519'].mode='0600' && files['/home/learner/.ssh/id_ed25519.pub'].type=f" },
          chips: "ssh-keygen -t ed25519 -N ''",
          docRef: { url: 'https://man.openbsd.org/ssh-keygen', label: 'ssh-keygen(1)' },
          hints: { H1: bi('`-t` — тип ключа, `-N \'\'` — пустой пароль.', '`-t` is the key type, `-N \'\'` an empty passphrase.') },
        },
        {
          id: 'authorize',
          prompt: bi('Разрешите своему ключу вход под пользователем `deploy`: положите открытый ключ в его `~/.ssh/authorized_keys` с правильными владельцем и правами.', 'Allow your key to log in as `deploy`: put the public key into his `~/.ssh/authorized_keys` with the right owner and permissions.'),
          check: {
            when: sshOk,
            fail: [{ if: (f) => !!f.files['/home/deploy/.ssh/authorized_keys'] && (f.files['/home/deploy/.ssh/authorized_keys'] as { owner?: string }).owner !== 'deploy', say: bi('Ключ лежит, но файл принадлежит root: deploy не сможет сам менять свои ключи, а с правами на запись для других sshd отказал бы вовсе. Отдайте каталог владельцу: `sudo chown -R deploy:deploy /home/deploy/.ssh`.', 'The key is there, but the file belongs to root: deploy cannot manage his own keys, and with write access for others sshd would refuse outright. Give the directory to its owner: `sudo chown -R deploy:deploy /home/deploy/.ssh`.') }],
          },
          chips: 'sudo mkdir -p /home/deploy/.ssh',
          hints: {
            H1: bi('Каталог `.ssh` (700), файл `authorized_keys` (600), владелец deploy.', 'The `.ssh` directory (700), the `authorized_keys` file (600), owner deploy.'),
            H2: bi('`cat ~/.ssh/id_ed25519.pub | sudo tee /home/deploy/.ssh/authorized_keys`, потом `chown` и `chmod`.', '`cat ~/.ssh/id_ed25519.pub | sudo tee /home/deploy/.ssh/authorized_keys`, then `chown` and `chmod`.'),
          },
        },
        {
          id: 'login',
          prompt: bi('Выполните по SSH на `deploy@localhost` команду `whoami`.', 'Run `whoami` over SSH as `deploy@localhost`.'),
          check: { stdout: /^(?:[\s\S]*\n)?deploy\n$/ },
          chips: 'ssh deploy@localhost whoami',
          hints: { H1: bi('Команду можно передать ssh последним аргументом.', 'You can pass ssh the command as its last argument.'), H2: bi('Если отказ — посмотрите `sudo journalctl -u ssh -n 5`.', 'If refused — look at `sudo journalctl -u ssh -n 5`.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.pubkey', 'linux.q.strictmodes'] },
  ],
};

export const LESSONS_3: Lesson[] = [threads, namespaces, cgroupsLesson, caps, rootfs, ssh];
