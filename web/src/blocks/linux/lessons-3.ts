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
  title: bi('Процесс, поток и каталог /proc, через который можно заглянуть в ядро', 'A process, a thread and /proc, the directory that lets you look into the kernel'),
  summary: bi('В этом уроке вы узнаете, как один процесс может загрузить четыре ядра процессора, почему у потоков одного процесса общая память и где ядро хранит сведения о каждом процессе.', 'In this lesson you learn how one process can keep four CPU cores busy, why the threads of one process share memory, and where the kernel keeps the facts about every process.'),
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
      body: bi('Команда `top` показывает один процесс `java`, то есть работающую программу, написанную на языке Java, и этот процесс нагружает процессор на 380%. Процессом называют одну работающую программу, поэтому непонятно, как он может занимать почти четыре процессора сразу. В этом уроке вы узнаете, что работает внутри процесса и где посмотреть на это своими глазами.', '`top` shows one `java` process, a program written in Java, loading the CPU at 380%. A process is one running program, so it is unclear how it can keep almost four CPUs busy at once. In this lesson you learn what runs inside a process and where to see it with your own eyes.'),
    },
    {
      id: 'threads',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое потоки выполнения', 'What threads are'),
      body: bi(
        'Внутри одного процесса может работать несколько [[linux.thread|потоков выполнения]]. Не путайте их со стандартными потоками ввода и вывода из урока о конвейерах: там поток означал канал, по которому текст идёт в программу и из неё, а здесь поток означает ход работы самой программы. Программа может вести несколько таких ходов одновременно, например один поток принимает запросы, а другой пишет журнал. На процессор ядро ставит не процессы целиком, а потоки. Каждый поток помнит, до какой команды программы он дошёл, и у каждого есть свой номер, который называется TID. Но память, открытые файлы и пользователь у всех потоков одного процесса общие. Поэтому потоки обходятся дёшево и быстро обмениваются данными, но по той же причине ошибка в одном потоке может испортить память всем остальным.\n\nПроцесс и поток создаёт один и тот же системный вызов `clone`, а разница задаётся флагами. С флагом `CLONE_THREAD` новый поток делит память с родителем, а без него новый процесс получает собственную копию памяти. Если четыре потока работают на четырёх процессорах, `top` складывает их нагрузку, и получается 400%.\n\nКоманда `ps -eLf` показывает каждый поток отдельной строкой. В колонке `LWP` стоит номер потока, а в колонке `NLWP` стоит число потоков в процессе. Номер главного потока совпадает с номером процесса.',
        'Several [[linux.thread|threads]] can run inside one process. Do not confuse them with the standard input and output streams from the pipelines lesson: there a stream was the channel through which text goes into and out of a program, and here a thread is a line of work of the program itself. A program can keep several such lines going at once, for example one thread takes requests while another writes the log. The kernel puts not whole processes but threads on a CPU. Each thread remembers which instruction of the program it has reached, and each has its own number, called the TID. But memory, open files and the user are shared by all threads of one process. That is why threads are cheap and exchange data fast, and for the same reason a bug in one thread can spoil the memory of all the others.\n\nThe same system call, `clone`, creates both a process and a thread, and the difference is set by flags. With the `CLONE_THREAD` flag the new thread shares memory with its parent, and without it the new process gets its own copy of memory. If four threads run on four CPUs, `top` adds their load up, and the result is 400%.\n\n`ps -eLf` shows every thread as a separate line. The `LWP` column holds the thread number, and `NLWP` the number of threads in the process. The main thread’s number is the process number.',
      ),
    },
    {
      id: 'proc',
      kind: 'text',
      step: 'explain',
      title: bi('Что хранится в каталоге /proc', 'What the /proc directory holds'),
      body: bi(
        'Откуда `ps` берёт все эти сведения? Из каталога `/proc`, то есть из [[linux.procfs|файловой системы /proc]]. Файлов этой системы нет на диске: ядро составляет их содержимое в тот момент, когда их читают. Для каждого процесса там есть каталог, названный его номером:\n\n- в файле `/proc/PID/status` собраны сведения о процессе: имя, состояние, PPid, Uid, занятая память `VmRSS` и число потоков `Threads`;\n- в файле `/proc/PID/cmdline` записано, с какими аргументами процесс запущен;\n- в каталоге `/proc/PID/task/` лежит по каталогу на каждый поток;\n- в каталоге `/proc/PID/fd/` в виде ссылок перечислены открытые файлы.\n\nТам же хранятся общие сведения о машине: `/proc/meminfo`, `/proc/loadavg` и `/proc/cpuinfo`. Ссылка `/proc/self` ведёт в каталог того процесса, который её читает. Рядом находится каталог `/sys`, в котором собраны устройства и настройки ядра, и через два урока вы найдёте в нём лимиты процессов.',
        'Where does `ps` get all these facts? From the `/proc` directory, that is, from [[linux.procfs|the /proc file system]]. Its files are not on a disk: the kernel makes up their contents at the moment they are read. There is a directory per process, named after its number:\n\n- `/proc/PID/status` collects the facts about the process: name, state, PPid, Uid, the memory taken `VmRSS` and the number of threads `Threads`;\n- `/proc/PID/cmdline` holds the arguments the process was started with;\n- `/proc/PID/task/` has a directory per thread;\n- `/proc/PID/fd/` lists the open files as links.\n\nThe same place keeps facts about the machine: `/proc/meminfo`, `/proc/loadavg` and `/proc/cpuinfo`. The link `/proc/self` leads to the directory of whichever process reads it. Next to it is `/sys`, which gathers devices and kernel settings, and two lessons from now you will find the limits of processes there.',
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
            fail: [{ if: (f) => Number(text(f, '/home/learner/threads.txt').trim()) === 6, say: bi('Шесть потоков работают на программу, но главный поток процесса тоже считается потоком. Посмотрите поле Threads в файле `/proc/PID/status`.', 'Six threads do the work, but the main thread of the process counts as a thread too. Look at the Threads field in `/proc/PID/status`.') }],
          },
          chips: 'grep Threads /proc/$(pgrep threads-demo)/status',
          docRef: { url: 'https://man7.org/linux/man-pages/man5/proc_pid_status.5.html', label: 'proc_pid_status(5)' },
          hints: { H1: bi('Номер процесса можно узнать командой `pgrep threads-demo`.', '`pgrep threads-demo` gives the process number.'), H2: bi('Сведения о процессе хранятся в файле `/proc/PID/status`, в строке Threads. Можно также посчитать каталоги в `/proc/PID/task`.', 'The facts about a process are in `/proc/PID/status`, on the Threads line. You can also count the directories in `/proc/PID/task`.') },
        },
        {
          id: 'lwp',
          prompt: bi('Покажите потоки процесса `threads-demo` отдельными строками, в которых есть колонки LWP и NLWP.', 'Show the threads of the `threads-demo` process as separate lines that have the LWP and NLWP columns.'),
          check: {
            when: (f) => {
              const r = f.term.main?.at(-1);
              const p = procs(f).find((x) => x.cmd === 'threads-demo');
              if (!r || !p || !/LWP.*NLWP/.test(r.out)) return false;
              return r.out.split('\n').filter((l) => new RegExp(`^\\S+\\s+${p.pid}\\s`).test(l)).length >= 2;
            },
            fail: [{ if: (f) => /LWP.*NLWP/.test(f.term.main?.at(-1)?.out ?? ''), say: bi('Колонки LWP и NLWP на месте, но строк процесса `threads-demo` в выводе меньше двух. Покажите потоки всех процессов флагами `-eLf` или потоки одного процесса флагами `-Lf -p PID`.', 'The LWP and NLWP columns are there, but the output has fewer than two lines of the `threads-demo` process. Show the threads of all processes with `-eLf` or those of one process with `-Lf -p PID`.') }],
          },
          chips: 'ps -eLf',
          docRef: ref('man/ps.1', 'OPTIONS', '-L'),
          hints: { H1: bi('У команды `ps` есть флаг, который показывает потоки.', '`ps` has a flag that shows threads.') },
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
  title: bi('Как пространства имён меняют то, что видит процесс, и чем особенен первый процесс', 'How namespaces change what a process sees, and what is special about the first process'),
  summary: bi('Одно и то же ядро может показывать разным процессам разный мир: другое имя машины, другую нумерацию процессов, другую сеть и других пользователей. В этом уроке вы узнаете, как это устроено и чем особенен первый процесс в таком мире.', 'One and the same kernel can show different processes a different world: another host name, another numbering of processes, another network and other users. In this lesson you learn how this works and what is special about the first process in such a world.'),
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
      body: bi('Представьте, что программу нужно запустить так, чтобы она считала себя на машине единственной: со своим именем машины, со своей сетью и с собственной нумерацией процессов, в которой она сама стоит первой. При этом запускать её нужно не на отдельном компьютере, а как ещё один процесс того же ядра. В этом уроке вы узнаете, что такое возможно и как это сделать. На этом приёме построены Docker, Kubernetes и другие инструменты, которые запускают приложения изолированно друг от друга на одном сервере, и с ними вы будете работать дальше по курсу. На собеседовании DevOps-инженера почти всегда просят объяснить, как они устроены изнутри, и ответ начинается с этого урока. Когда вы до них дойдёте, окажется, что изолированное приложение на деле остаётся обычным процессом, вокруг которого ядро поставило такие стены, а не отдельной машиной.', 'Imagine you need to run a program so that it believes it is alone on the machine: with its own host name, its own first process and its own network. And you need to run it not on a separate computer but as one more process of the same kernel. In this lesson you learn that this is possible and how to do it. This trick underlies Docker, Kubernetes and the other tools that run applications isolated from each other on one server, and you will work with them later in the course. A DevOps interview almost always asks how they work inside, and the answer starts with this lesson. When you get there, it will turn out that an isolated application is still an ordinary process around which the kernel has put such walls, not a separate machine.'),
    },
    {
      id: 'ns',
      kind: 'text',
      step: 'explain',
      title: bi('Как ядро ставит стены вокруг процесса', 'How the kernel puts walls around a process'),
      body: bi(
        'Ядро умеет держать для процессов отдельные наборы того, что они видят, и такие наборы называются [[linux.namespace|пространствами имён]]. Каждый вид пространства отвечает за своё:\n\n- пространство **uts** хранит имя машины, поэтому `hostname` внутри и снаружи показывает разное;\n- пространство **pid** нумерует процессы, и внутри нумерация своя, с единицы;\n- пространство **mnt** хранит список смонтированных файловых систем;\n- пространство **net** хранит сетевые интерфейсы, адреса и маршруты;\n- пространство **user** хранит своих пользователей, и внутри можно быть root, оставаясь снаружи обычным пользователем.\n\nПо умолчанию все процессы машины находятся в одних и тех же пространствах. Номера пространств хранятся в `/proc/PID/ns/`. Команда `readlink /proc/$$/ns/uts` выдаёт что-то вроде `uts:[4026531838]`, и у процессов в одном пространстве этот номер одинаковый. Все пространства машины перечисляет команда `lsns`.\n\nНовое пространство создаёт команда `unshare`. Например, `sudo unshare --uts bash` запускает оболочку, у которой своё имя машины. Если сменить его командой `hostname box`, снаружи имя останется прежним. Команда `exit` возвращает вас в обычную оболочку, а `nsenter --target PID --uts` позволяет войти в пространство уже работающего процесса.\n\nСетевое пространство тоже создаётся одной командой. `sudo unshare --net ip a` показывает только интерфейс `lo`, причём выключенный. Как соединить такое пространство с остальной сетью, рассказывает блок о сетях.\n\nКроме пяти пространств из списка, в ядре есть ещё три, которые нужны реже: пространство `ipc` отделяет общую память и очереди сообщений, через которые процессы обмениваются данными, пространство `cgroup` меняет то, как процесс видит группы процессов с лимитами из следующего урока, а пространство `time` позволяет процессу видеть свои показания часов, прошедших с загрузки машины.',
        'The kernel can keep separate sets of what processes see, and such sets are called [[linux.namespace|namespaces]]. Each kind of namespace is in charge of its own thing:\n\n- the **uts** namespace holds the host name, so `hostname` shows different names inside and outside;\n- the **pid** namespace numbers processes, and inside the numbering is its own, starting from one;\n- the **mnt** namespace holds the list of mounted file systems;\n- the **net** namespace holds network interfaces, addresses and routes;\n- the **user** namespace holds its own users, and inside you can be root while staying an ordinary user outside.\n\nBy default all processes of a machine are in the same namespaces. The numbers of the namespaces are in `/proc/PID/ns/`. `readlink /proc/$$/ns/uts` gives something like `uts:[4026531838]`, and processes in the same namespace have the same number. `lsns` lists all namespaces of the machine.\n\n`unshare` creates a new namespace. For example, `sudo unshare --uts bash` starts a shell with its own host name. If you change it with `hostname box`, the name outside stays the same. `exit` takes you back to the ordinary shell, and `nsenter --target PID --uts` lets you enter the namespace of a process that is already running.\n\nA network namespace is created with one command as well. `sudo unshare --net ip a` shows only the `lo` interface, and it is down. How to connect such a namespace to the rest of the network is told in the networks block.\n\nBesides the five namespaces on the list, the kernel has three more that are needed less often: the `ipc` namespace separates the shared memory and message queues through which processes exchange data, the `cgroup` namespace changes how a process sees the groups of processes with limits from the next lesson, and the `time` namespace lets a process see its own readings of the clocks that count from the machine’s boot.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как выглядит процесс за стенами пространств имён', 'What a process behind namespace walls looks like'),
      body: bi('Схема ниже показывает процесс report-gen, который запущен командой `unshare` с тремя флагами: `--uts`, `--pid` и `--net`. Каждый флаг ставит вокруг процесса стену, то есть пространство имён, и на схеме стены нарисованы пунктирными рамками вокруг процесса. Справа находятся оболочка на той же машине, которая смотрит на процесс снаружи, и соседний процесс, база данных postgres. Внизу стоит ядро, одно на все процессы. Под схемой стоит счётчик, который показывает, сколько стен сейчас окружает процесс.', 'The diagram below shows the report-gen process started with `unshare` and three flags: `--uts`, `--pid` and `--net`. Each flag puts a wall, a namespace, around the process, and the diagram draws the walls as dashed frames around it. On the right are a shell on the same machine, which looks at the process from outside, and a neighbouring process, the postgres database. At the bottom is the kernel, one for all processes. Under the diagram a counter shows how many walls surround the process now.'),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'linux.walls', params: { net: true }, howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге облачко рядом с подсвеченным блоком говорит, что этот блок видит: что показывают `hostname`, `ps` и `ip a` изнутри стен и что видно снаружи. Выключенная стена исчезает со схемы.\n\nКогда пройдёте все шаги, выключайте по одной стене в группе «Какие стены стоят вокруг процесса» и сравнивайте, что изменилось в ответах изнутри. Потом включите в блоке «Сломать» поломку, при которой своя нумерация создана без флага --fork.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the callout next to the highlighted block says what that block sees: what `hostname`, `ps` and `ip a` show from inside the walls and what is visible from outside. A wall that is switched off disappears from the diagram.\n\nOnce you have walked all steps, switch off one wall at a time in “Which walls surround the process” and compare what changed in the answers from inside. Then switch on the break in “Break it” where the own numbering is created without --fork.'), caption: bi('На схеме вы видели, что стены действуют в одну сторону: изнутри процесс видит свой маленький мир, а снаружи он остаётся обычным процессом со своим настоящим номером. В заданиях этого урока вы поставите такие стены сами командой `unshare` и проверите это командами `hostname`, `ps` и `id`. Перед этим следующий раздел объяснит, чем особенен процесс номер 1, которым становится оболочка за стеной pid.', 'In the diagram you saw that the walls work one way: from inside the process sees its own small world, and from outside it stays an ordinary process with its real number. In this lesson’s tasks you put up such walls yourself with `unshare` and check this with `hostname`, `ps` and `id`. Before that, the next section explains what is special about process number 1, which the shell behind the pid wall becomes.') },
    {
      id: 'pid1',
      kind: 'text',
      step: 'explain',
      title: bi('Чем особенен процесс номер 1', 'What is special about process number 1'),
      body: bi(
        'Команда `sudo unshare --pid --fork --mount-proc bash` запускает оболочку, которая для самой себя оказывается [[linux.pid1|первым процессом]]: `echo $$` печатает 1, а `ps` видит только её. Флаг `--fork` нужен потому, что новая нумерация действует для потомков `unshare`, а не для неё самой. Флаг `--mount-proc` монтирует свежий `/proc`. Команда `ps` читает процессы оттуда, и без нового `/proc` она показала бы все процессы машины. Снаружи эта оболочка остаётся обычным процессом с обычным номером.\n\nУ первого процесса, будь то первый процесс всей системы или пространства имён, есть три особые обязанности. Во-первых, к нему переходят осиротевшие процессы: если родитель завершился, его дети становятся детьми первого процесса. Во-вторых, он обязан забирать коды завершения у этих процессов, иначе они остаются зомби. В-третьих, сигналы доходят до него по особым правилам. Процессы внутри пространства могут послать ему только те сигналы, для которых у него есть обработчик, а процессы снаружи могут послать ещё KILL и STOP. Поэтому `kill -9 1` внутри такой оболочки ничего не делает, а сигнал TERM снаружи не остановит программу, которая стала первым процессом и не умеет этот сигнал обрабатывать.\n\nПространство user позволяет обычному пользователю создавать остальные пространства. Команда `unshare --user --map-root-user bash` даёт вам внутри `uid=0`, но только внутри. Файл, созданный там, снаружи принадлежит вам, а чужие файлы так и остаются чужими.',
        '`sudo unshare --pid --fork --mount-proc bash` starts a shell that is the [[linux.pid1|first process]] to itself: `echo $$` prints 1, and `ps` sees only it. `--fork` is needed because the new numbering applies to the children of `unshare`, not to `unshare` itself. `--mount-proc` mounts a fresh `/proc`. `ps` reads processes from there, and without a new `/proc` it would show every process of the machine. From outside this shell stays an ordinary process with an ordinary number.\n\nThe first process, whether of the whole system or of a namespace, has three special duties. First, orphaned processes go to it: if a parent ends, its children become children of the first process. Second, it must collect the exit codes of these processes, or they stay zombies. Third, signals reach it by special rules. Processes inside the namespace can send it only the signals it has a handler for, and processes outside can also send KILL and STOP. That is why `kill -9 1` inside such a shell does nothing, and TERM from outside will not stop a program that became the first process and cannot handle that signal.\n\nThe user namespace lets an ordinary user create the other namespaces. `unshare --user --map-root-user bash` gives you `uid=0` inside, but only inside. A file created there belongs to you outside, and other people’s files stay other people’s.',
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
          prompt: bi('Запустите оболочку со своим именем машины, назовите в ней машину `box` и вернитесь обратно. Снаружи имя машины должно остаться `trainer`.', 'Start a shell with its own host name, name the machine `box` inside it and come back. Outside, the host name must stay `trainer`.'),
          check: { when: (f) => nss(f).some((n) => n.type === 'uts' && n.hostname === 'box') && f.hostname === 'trainer', fail: [{ if: (f) => f.hostname === 'box', say: bi('Вы переименовали саму машину, а новое имя нужно было задать в новом пространстве uts.', 'You renamed the machine itself, while the new name had to be set in a new uts namespace.') }] },
          chips: 'sudo unshare --uts bash',
          docRef: ref('man/unshare.1', 'OPTIONS', '-u, --uts'),
          hints: { H1: bi('Внутри новой оболочки выполните `hostname box`, затем `exit` и снова `hostname`.', 'Inside the new shell run `hostname box`, then `exit` and `hostname` again.') },
        },
        {
          id: 'pidns',
          prompt: bi('Запустите оболочку, которая для самой себя будет первым процессом и в выводе `ps` увидит только свои процессы.', 'Start a shell that is the first process to itself and sees only its own processes in `ps`.'),
          check: { when: (f) => nss(f).some((n) => n.type === 'pid' && n.id !== 4026531836) && nss(f).some((n) => n.type === 'mnt' && n.id !== 4026531841) },
          chips: 'sudo unshare --pid --fork --mount-proc bash',
          docRef: ref('man/unshare.1', 'OPTIONS', '--mount-proc'),
          hints: { H1: bi('Понадобятся три флага: своя нумерация процессов, отдельный процесс для неё и свой каталог /proc.', 'You need three flags: an own numbering of processes, a separate process for it and an own /proc.'), H2: bi('Внутри новой оболочки проверьте `echo $$` и `ps`.', 'Inside the new shell check `echo $$` and `ps`.') },
        },
        {
          id: 'userns',
          prompt: bi('Не пользуясь sudo, станьте root внутри своего пространства user и создайте там файл `/tmp/inside`. Потом посмотрите снаружи, кому этот файл принадлежит.', 'Without sudo, become root inside your own user namespace and create the file `/tmp/inside` there. Then look from outside at whom the file belongs to.'),
          check: { when: "files['/tmp/inside'].owner=learner && ns[type=user]#>=2", fail: [{ if: "files['/tmp/inside'].owner=root", say: bi('Файл создал настоящий root, потому что вы воспользовались sudo. Здесь нужно пространство user.', 'The real root created the file, because you used sudo. You need a user namespace here.') }] },
          chips: 'unshare --user --map-root-user bash',
          docRef: { url: 'https://man7.org/linux/man-pages/man7/user_namespaces.7.html', label: 'user_namespaces(7)' },
          hints: { H1: bi('Внутри команда `id` покажет uid=0. Создайте файл, выйдите и выполните `ls -l /tmp/inside`.', 'Inside, `id` shows uid=0. Create the file, leave and run `ls -l /tmp/inside`.') },
        },
      ],
    },
    {
      id: 'docker',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      levels: ['experienced'],
      title: bi('Как это выглядит в Docker и что об этом спрашивают', 'What this looks like in Docker and what interviews ask'),
      body: bi(
        'Команда `docker run` делает то же, что вы делаете в этом уроке руками: создаёт процессу пространства uts, pid, mnt, net и ipc, на современных системах ещё и пространство для групп с лимитами из следующего урока, а в режиме rootless вдобавок user. Пространства уже запущенного приложения видно с самой машины. Команда `docker inspect -f "{{.State.Pid}}" имя` печатает настоящий номер его первого процесса, `lsns -p PID` перечисляет его пространства, а `nsenter -t PID -n ss -ltn` выполняет команду в его сети, даже если внутри нет ни оболочки, ни `ss`. Так отлаживают минимальные образы, в которых нет никаких инструментов.\n\nПро первый процесс спрашивают почти на каждом собеседовании, и вопрос обычно звучит так: почему приложение не останавливается по `docker stop` и через десять секунд его завершают принудительно. Ответ дан в разделе о процессе номер 1: `docker stop` посылает TERM первому процессу, а сигнал без обработчика первому процессу не доставляется. Лечат это двумя способами. Можно запустить первым процессом маленького посредника, который передаёт сигналы и забирает коды завершения, например `tini` или `dumb-init`, а у Docker для этого есть флаг `docker run --init`. А можно научить саму программу обрабатывать TERM, например в Node.js строкой `process.on("SIGTERM", …)`, и следить, чтобы первым процессом была сама программа: если запустить её через `sh -c`, первым процессом может оказаться оболочка, а она сигнал дальше не передаёт.',
        '`docker run` does what you do by hand in this lesson: it creates uts, pid, mnt, net and ipc namespaces for the process, on current systems also a namespace for the groups with limits from the next lesson, and in rootless mode a user namespace too. The namespaces of a running application are visible from the machine itself. `docker inspect -f "{{.State.Pid}}" name` prints the real number of its first process, `lsns -p PID` lists its namespaces, and `nsenter -t PID -n ss -ltn` runs a command in its network even when there is neither a shell nor `ss` inside. That is how minimal images without any tools are debugged.\n\nThe first process comes up at almost every interview, usually as the question why an application does not stop on `docker stop` and is killed by force ten seconds later. The answer is in the section on process number 1: `docker stop` sends TERM to the first process, and a signal without a handler is not delivered to the first process. There are two cures. You can run a small go-between as the first process that passes signals on and collects exit codes, such as `tini` or `dumb-init`, and Docker has the `docker run --init` flag for that. Or you can make the program handle TERM itself, for example in Node.js with `process.on("SIGTERM", …)`, and make sure the program itself is the first process: started through `sh -c`, the first process may turn out to be the shell, which does not pass the signal on.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.ns-number', 'linux.q.mount-proc', 'linux.q.pid1-term'] },
  ],
};

// ── 16. cgroups and the OOM killer ──

const cgroupsLesson: Lesson = {
  id: 'linux.cgroups',
  block: 'linux',
  title: bi('Как cgroups ограничивают ресурсы процесса и что делает OOM killer', 'How cgroups limit a process’s resources and what the OOM killer does'),
  summary: bi('Лимиты памяти, процессора и числа процессов хранятся в виде файлов в каталоге `/sys/fs/cgroup`. В учебной тревоге этого урока процесс упрётся в лимит памяти, и ядро завершит его сигналом KILL.', 'Limits on memory, CPU and the number of processes are kept as files in `/sys/fs/cgroup`. In this lesson’s drill a process hits its memory limit, and the kernel ends it with KILL.'),
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
      body: bi('Ночной отчёт занял всю память сервера, и ядро, спасая машину, завершило базу данных, потому что она была самым большим процессом. Виноват был отчёт, а пострадал соседний процесс. В этом уроке вы узнаете, как заранее сказать системе, что этой программе нельзя занимать больше 64 мебибайт. Мебибайт, сокращённо МиБ, чуть больше мегабайта: в нём 1 048 576 байт, а не миллион. Когда вы пишете в лимите `64M`, ядро считает в мебибайтах.', 'The nightly report took all of the server’s memory, and the kernel, saving the machine, ended the database, because it was the biggest process. The report was at fault, and a neighbouring process paid. In this lesson you learn how to tell the system in advance that this program may take no more than 64 mebibytes. A mebibyte, MiB for short, is a little more than a megabyte, 1,048,576 bytes, and the kernel counts limits in mebibytes when you write `64M`.'),
    },
    {
      id: 'cg',
      kind: 'text',
      step: 'explain',
      title: bi('Как группы процессов получают лимиты', 'How groups of processes get limits'),
      body: bi(
        'Ядро объединяет процессы в [[linux.cgroup|cgroup]], то есть в группы с общими счётчиками и лимитами. Эти группы выглядят как дерево каталогов в `/sys/fs/cgroup`, и управляют им обычными командами: каждый каталог соответствует группе, а файлы в нём хранят счётчики и лимиты.\n\n- `memory.current` показывает, сколько памяти группа занимает сейчас, а `memory.max` задаёт, сколько ей можно занять. Если лимита нет, в этом файле записано слово `max`. Записать туда `0` значит запретить группе любую память, а вовсе не снять лимит, поэтому лимит снимают командой `echo max | sudo tee memory.max`;\n- `cpu.max` задаёт долю процессора, и значение `50000 100000` означает 50 мс из каждых 100, то есть половину процессора;\n- `pids.current` показывает, сколько в группе процессов и потоков, а `pids.max` задаёт, сколько их разрешено;\n- `cgroup.procs` хранит номера процессов группы, и если записать туда номер, процесс перейдёт в эту группу;\n- `memory.events` и `pids.events` показывают, сколько раз группа упиралась в лимит.\n\nsystemd уже разложил по этому дереву все службы. Команда `systemd-cgls` покажет ветку `system.slice` со службами и ветку `user.slice` с вашей оболочкой. Строки `MemoryMax=`, `CPUQuota=` и `TasksMax=` в unit-файле записывают значения как раз в эти файлы.\n\nЧтобы создать группу вручную, достаточно создать каталог, а все файлы в него ядро положит само:\n\n```\nsudo mkdir /sys/fs/cgroup/lab\necho 32M | sudo tee /sys/fs/cgroup/lab/memory.max\necho $$  | sudo tee /sys/fs/cgroup/lab/cgroup.procs\n```\n\nПоследняя строка переносит в группу вашу оболочку, и все команды, которые она запустит, тоже окажутся в этой группе.',
        'The kernel joins processes into a [[linux.cgroup|cgroup]], a group with shared counters and limits. The groups look like a tree of directories in `/sys/fs/cgroup`, managed with ordinary commands: each directory is a group, and the files in it hold counters and limits.\n\n- `memory.current` shows how much memory the group takes now, and `memory.max` sets how much it may take. When there is no limit, the file holds the word `max`. Writing `0` there forbids the group any memory at all rather than removing the limit, so the limit is removed with `echo max | sudo tee memory.max`;\n- `cpu.max` sets a share of the CPU, and `50000 100000` means 50 ms out of every 100, half a CPU;\n- `pids.current` shows how many processes and threads the group has, and `pids.max` sets how many are allowed;\n- `cgroup.procs` holds the process numbers of the group, and if you write a number there, the process moves into the group;\n- `memory.events` and `pids.events` show how many times the group hit a limit.\n\nsystemd has already laid out all services on this tree. `systemd-cgls` shows the `system.slice` branch with the services and `user.slice` with your shell. The lines `MemoryMax=`, `CPUQuota=` and `TasksMax=` in a unit file write their values into exactly these files.\n\nTo create a group by hand it is enough to create a directory, and the kernel puts all the files into it itself:\n\n```\nsudo mkdir /sys/fs/cgroup/lab\necho 32M | sudo tee /sys/fs/cgroup/lab/memory.max\necho $$  | sudo tee /sys/fs/cgroup/lab/cgroup.procs\n```\n\nThe last line moves your shell into the group, and every command it starts ends up in that group too.',
      ),
    },
    {
      id: 'oom',
      kind: 'text',
      step: 'explain',
      title: bi('Что делает ядро, когда память кончилась', 'What the kernel does when memory runs out'),
      body: bi(
        'Когда группе нужна память сверх `memory.max`, ядро сначала пытается освободить память, которую группа занимает под кэш, то есть под копии недавно прочитанных файлов. Если это не помогло, ядро запускает внутри группы [[linux.oom|OOM killer]] (от английского out of memory, «память кончилась»). Он выбирает самый большой процесс группы и завершает его сигналом KILL. Код завершения такого процесса равен 137, то есть 128 плюс 9, оболочка печатает `Killed`, в `memory.events` растёт счётчик `oom_kill`, а в `dmesg` появляется строка `Memory cgroup out of memory: Killed process …`. Остальная машина при этом ничего не замечает.\n\nЕсли лимита нет, то же самое происходит со всей машиной. Общий для машины OOM killer выбирает жертву среди всех процессов машины по оценке `oom_score`, которую видно в файле `/proc/PID/oom_score`. Оценка растёт вместе с памятью, которую занимает процесс, поэтому жертвой обычно становится самый большой процесс машины. Если рядом работает база данных, которая держит в памяти больше, чем успел занять виновник, завершена будет база. Поэтому у всего, что может расти, должен быть лимит памяти.\n\nЛимит процессора действует иначе. Процесс не завершают, а притормаживают: в каждом периоде он ждёт, пока не наступит его очередь. Лимит числа процессов останавливает создание новых процессов, и `fork` получает ошибку «Resource temporarily unavailable», то есть «ресурс временно недоступен».',
        'When a group needs memory beyond `memory.max`, the kernel first tries to free the memory the group uses for cache. If that does not help, the kernel runs the [[linux.oom|OOM killer]] (from “out of memory”) inside the group. It picks the biggest process of the group and ends it with KILL. The exit code of such a process is 137, that is, 128 plus 9, the shell prints `Killed`, the `oom_kill` counter grows in `memory.events`, and `dmesg` gets the line `Memory cgroup out of memory: Killed process …`. The rest of the machine notices nothing.\n\nWithout a limit the same happens to the whole machine. The machine-wide OOM killer picks its victim among all processes of the machine by the `oom_score` estimate, visible in `/proc/PID/oom_score`. The estimate grows with the memory a process takes, so the victim is usually the biggest process of the machine. If a database next to it holds more memory than the culprit has managed to take, the database is the one ended. Hence the rule: everything that can grow must have a memory limit.\n\nThe CPU limit works differently. The process is not ended but slowed down: in every period it waits until its turn comes. The limit on the number of processes stops new processes from being created, and `fork` gets the error “Resource temporarily unavailable”.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как ядро считает ресурсы группы', 'How the kernel counts a group’s resources'),
      body: bi('Схема ниже знакома по прошлому уроку, но теперь стены вокруг report-gen выключены и на схеме их нет, а главную роль играет счётчик в нижнем ряду. Он показывает файл memory.current группы cgroup, в которую запущен процесс, то есть сколько памяти уже занимают её процессы, а шкала внутри счётчика показывает, какая часть лимита memory.max уже занята. Число процессов группы и её доля процессора хранятся в соседних файлах pids.current и cpu.max, и как действуют их лимиты, рассказано в разделе выше. Память report-gen растёт с той скоростью, которую вы задаёте в «Параметрах» над схемой, и схема показывает, что сделает ядро, когда память дойдёт до лимита или кончится у всей машины.', 'The diagram below is familiar from the last lesson, but now the walls around report-gen are switched off and gone from the diagram, and the meter in the bottom row plays the main part. It shows the memory.current file of the cgroup the process runs in, that is how much memory its processes take, and the gauge inside shows how much of the memory.max limit is taken. The group’s process count and CPU share live in the neighbouring files pids.current and cpu.max, and the section above explains how their limits work. report-gen’s memory grows at the speed you set in “Parameters” above the diagram, and the diagram shows what the kernel does when the memory reaches the limit or the whole machine runs out.'),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'linux.isolation', params: { pid: false, uts: false, net: false }, howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко рядом с подсвеченным счётчиком говорит, сколько памяти группа уже заняла и что делает ядро, а красная рамка отмечает процесс, который ядро завершило.\n\nКогда пройдёте шаги, выключите в группе «Сколько ресурсов разрешено группе» переключатель «У группы есть лимит памяти», то есть запишите в memory.max слово max, и проследите, какой процесс ядро завершит, когда память кончится у всей машины. Потом верните лимит и ускорьте рост памяти report-gen.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout next to the highlighted meter says how much memory the group has taken and what the kernel does, and a red outline marks the process the kernel ended.\n\nOnce you have walked the steps, switch off “The group has a memory limit” in “How many resources the group may take”, that is, write the word max into memory.max, and see which process the kernel ends when the whole machine runs out of memory. Then put the limit back and make report-gen’s memory grow faster.'), caption: bi('Без лимита ядро завершило соседнюю базу данных, а с лимитом завершило только report-gen, и это главный вывод урока. В задании этого урока вы проведёте ту же учебную тревогу на машине: создадите группу с лимитом памяти, запустите в ней программу, которая берёт больше, и найдёте следы OOM killer в файле `memory.events` и в выводе `dmesg`.', 'Without a limit the kernel ended the neighbouring database, and with a limit it ended only report-gen, and that is the main point of the lesson. In this lesson’s task you run the same drill on the machine: create a group with a memory limit, run a program in it that takes more, and find the traces of the OOM killer in `memory.events` and in `dmesg`.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: {},
      intro: bi('Программа `memhog N` занимает N мебибайт памяти и завершается. В учебной тревоге её нужно запустить в группе с меньшим лимитом памяти.', 'The program `memhog N` takes N mebibytes of memory and exits. In the drill you run it in a group with a smaller memory limit.'),
      tasks: [
        {
          id: 'oom',
          prompt: bi('Создайте группу `/sys/fs/cgroup/lab` с лимитом памяти 32 мебибайта, перенесите в неё свою оболочку и запустите `memhog 64`. Ядро должно остановить эту программу.', 'Create the group `/sys/fs/cgroup/lab` with a 32 MiB memory limit, move your shell into it and run `memhog 64`. The kernel must stop the program.'),
          check: {
            when: (f) => {
              const g = cgroups(f).find((x) => x.path === '/lab');
              return !!g && g.memory.max !== 'max' && g.memory.max <= 32 * 1024 * 1024 && (g.memory.events.oom_kill ?? 0) >= 1;
            },
            fail: [
              { if: (f) => { const g = cgroups(f).find((x) => x.path === '/lab'); return !!g && g.memory.max === 'max'; }, say: bi('Группа создана, но лимита у неё нет, потому что в `memory.max` всё ещё стоит max.', 'The group exists but has no limit, because `memory.max` still says max.') },
              { if: (f) => { const g = cgroups(f).find((x) => x.path === '/lab'); return !!g && g.memory.max !== 'max' && (g.memory.events.oom_kill ?? 0) === 0 && term(f).includes('memhog'); }, say: bi('Программа memhog доработала до конца, а значит, она запускалась не в группе. Перенесите оболочку в группу командой `echo $$ | sudo tee /sys/fs/cgroup/lab/cgroup.procs`.', 'memhog ran to the end, which means it was not in the group. Move the shell into the group with `echo $$ | sudo tee /sys/fs/cgroup/lab/cgroup.procs`.') },
            ],
          },
          chips: 'sudo mkdir /sys/fs/cgroup/lab',
          docRef: { url: 'https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files', label: 'cgroup-v2 · memory.max' },
          hints: { H1: bi('Выполните три шага из текста урока, а потом запустите `memhog 64`.', 'The three steps from the lesson text, then `memhog 64`.'), H2: bi('Посмотрите, что покажут `cat /sys/fs/cgroup/lab/memory.events` и `sudo dmesg | tail`.', 'Look at what `cat /sys/fs/cgroup/lab/memory.events` and `sudo dmesg | tail` show.') },
        },
        {
          id: 'pids',
          prompt: bi('Ограничьте группу `lab` пятью процессами и запустите `spawner 10`, которая попробует запустить десять процессов. Ядро должно отказать ей в лишних.', 'Limit the `lab` group to five processes and run `spawner 10`, which will try to start ten. The kernel must refuse the extra ones.'),
          check: { when: (f) => { const g = cgroups(f).find((x) => x.path === '/lab'); return !!g && g.pids.max !== 'max' && g.pids.max <= 5 && (g.pids.events.max ?? 0) >= 1; } },
          chips: 'echo 5 | sudo tee /sys/fs/cgroup/lab/pids.max',
          docRef: { url: 'https://docs.kernel.org/admin-guide/cgroup-v2.html#pid-interface-files', label: 'cgroup-v2 · pids.max' },
          hints: { H1: bi('Лимит числа процессов хранится в файле `pids.max`.', 'The limit on the number of processes is kept in `pids.max`.') },
        },
      ],
    },
    {
      id: 'systemd-run',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Запустите `spawner 30` так, чтобы у этой программы было не больше 20 процессов, и не трогайте при этом `/sys` вручную, а поручите создать группу systemd. Как это сделать, в уроке не рассказывалось, поэтому найдите способ сами.', 'Run `spawner 30` so that the program has at most 20 processes, without touching `/sys` by hand: let systemd create the group. The lesson did not say how, so find the way yourself.'),
      ref: { url: 'https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html', label: 'systemd-run(1)' },
      terminal: {
        setup: {},
        task: {
          id: 'systemd-run',
          prompt: bi('Программа spawner работает в группе systemd с лимитом 20 процессов.', 'spawner runs in a systemd group with a limit of 20 processes.'),
          check: { when: (f) => cgroups(f).some((g) => g.path.startsWith('/system.slice/') && g.pids.max === 20) },
          docStep: 4,
          beyond: true,
          solutionTokens: ['systemd-run', 'TasksMax', '--scope', '-p TasksMax=20'],
        },
      },
    },
    {
      id: 'docker',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      levels: ['experienced'],
      title: bi('Как лимиты выглядят в Docker и Kubernetes', 'What the limits look like in Docker and Kubernetes'),
      body: bi(
        'Команда `docker run --memory 64m --cpus 0.5 --pids-limit 100` записывает в файлы группы, которую создаёт для приложения, те же три значения, что вы пишете в этом уроке руками: `memory.max`, `cpu.max` и `pids.max`. Команда `docker stats` читает из той же группы `memory.current`. В Kubernetes строка `limits.memory` превращается в `memory.max`, а состояние OOMKilled с кодом 137 означает то же, что вы видели на схеме: группа дошла до лимита, и ядро завершило её процесс сигналом KILL. Строка `limits.cpu` превращается в `cpu.max`, и процесс, который в неё упирается, не завершается, а притормаживается. Сколько раз это случилось, показывает строка `nr_throttled` в файле `cpu.stat`, и это первое, что стоит проверить, когда приложение медленно отвечает при свободном процессоре машины.\n\nНа живой машине пригодятся три приёма. Команда `systemd-cgtop` показывает группы, отсортированные по потреблению, как `top` показывает процессы. Команда `systemctl set-property web.service MemoryMax=512M` меняет лимит работающей службы без перезапуска. А строка `OOMScoreAdjust=-500` в unit-файле базы данных снижает её оценку oom_score, чтобы при нехватке памяти на всей машине ядро выбирало другую жертву.',
        '`docker run --memory 64m --cpus 0.5 --pids-limit 100` writes into the files of its application’s group the same three values you write by hand in this lesson: `memory.max`, `cpu.max` and `pids.max`. `docker stats` reads `memory.current` from the same group. In Kubernetes the `limits.memory` line becomes `memory.max`, and the OOMKilled state with code 137 means exactly what you saw in the diagram: the group reached its limit, and the kernel ended its process with KILL. The `limits.cpu` line becomes `cpu.max`, and a process that hits it is not ended but slowed down. How often that happened is shown by the `nr_throttled` line in `cpu.stat`, and it is the first thing to check when an application answers slowly while the machine’s CPU is free.\n\nOn a live machine three tricks help. `systemd-cgtop` shows the groups sorted by consumption, as `top` shows processes. `systemctl set-property web.service MemoryMax=512M` changes the limit of a running service without a restart. And the line `OOMScoreAdjust=-500` in a database’s unit file lowers its oom_score, so that when the whole machine runs out of memory the kernel picks another victim.',
      ),
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
  title: bi('Как ограничить права процесса привилегиями ядра и фильтром seccomp', 'How to limit a process’s powers with capabilities and the seccomp filter'),
  summary: bi('Права root состоят не из одного права, а примерно из сорока отдельных привилегий. Их можно отнять у root или выдать одну из них обычной программе, а фильтр seccomp запрещает процессу целые системные вызовы.', 'root’s power consists not of one right but of about forty separate capabilities. They can be taken away from root, or one of them can be given to an ordinary program, and the seccomp filter forbids whole system calls to a process.'),
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
      body: bi('Веб-сервер ждёт подключений под номером 80. Такой номер называется портом: по нему система решает, какой из программ на машине отдать подключение, пришедшее по сети. Порты ниже `1024` по давней традиции разрешено занимать только root. Если запускать весь веб-сервер от имени root ради одной этой мелочи, любая ошибка в нём получит в распоряжение всю машину. В этом уроке вы узнаете, как дать программе одно-единственное право.', 'A web server must wait for connections on port 80, that is, under the number 80 by which the system tells it apart from other programs on the same machine. Such numbers are called ports, and by long tradition only root may take ports below `1024`. If you run the whole web server as root for that one small thing, any bug in it gets the whole machine. In this lesson you learn how to give a program one single right.'),
    },
    {
      id: 'caps',
      kind: 'text',
      step: 'explain',
      title: bi('Из каких привилегий состоят права root', 'Which capabilities root’s power consists of'),
      body: bi(
        'То, что мы называли «root может всё», ядро давно разделило на отдельные [[linux.capability|привилегии ядра]] (capabilities), и всего их около сорока:\n\n- `CAP_DAC_OVERRIDE` позволяет обходить биты прав, а `CAP_DAC_READ_SEARCH` позволяет обходить право на чтение, и поэтому root читает чужой файл с режимом `600`;\n- `CAP_NET_BIND_SERVICE` позволяет ждать подключений на портах ниже `1024`;\n- `CAP_KILL` позволяет посылать сигналы чужим процессам;\n- `CAP_SYS_ADMIN` позволяет монтировать файловые системы, создавать пространства имён и многое другое;\n- `CAP_SYSLOG` позволяет читать сообщения ядра, поэтому на многих системах `dmesg` требует sudo.\n\nУ каждого процесса есть набор действующих привилегий, который записан в строке `CapEff` файла `/proc/PID/status`. Команда `capsh --decode=…` переводит эту строку в имена, а `capsh --print` показывает ваши собственные привилегии. Набор можно урезать. Например, `sudo capsh --drop=cap_dac_override,cap_dac_read_search -- -c \'cat /home/anna/notes.txt\'` запускает команду от root без двух привилегий, и такой root уже не прочитает чужой файл с режимом `600`, а получит `Permission denied`.\n\nМожно поступить и наоборот: выдать одну привилегию обычной программе, записав её прямо на файл командой `sudo setcap cap_net_bind_service=+ep /usr/local/bin/web-demo`. Теперь любой, кто запустит эту программу, получит только право ждать подключений на низких портах и ничего сверх того. Такие файлы показывает команда `getcap`. Этот способ намного безопаснее старого бита setuid, который давал программе все права root.',
        'What we called “root can do anything”, the kernel long ago split into separate [[linux.capability|capabilities]], about forty of them:\n\n- `CAP_DAC_OVERRIDE` lets a process bypass the permission bits, and `CAP_DAC_READ_SEARCH` the read permission, which is why root reads someone else’s file with mode `600`;\n- `CAP_NET_BIND_SERVICE` lets it wait for connections on ports below `1024`;\n- `CAP_KILL` lets it send signals to other users’ processes;\n- `CAP_SYS_ADMIN` lets it mount file systems, create namespaces and much more;\n- `CAP_SYSLOG` lets it read the kernel’s messages, which is why `dmesg` needs sudo.\n\nEvery process has a set of effective capabilities, written in the `CapEff` line of `/proc/PID/status`. `capsh --decode=…` turns that line into names, and `capsh --print` shows your own capabilities. The set can be cut down. For example, `sudo capsh --drop=cap_dac_override,cap_dac_read_search -- -c \'cat /home/anna/notes.txt\'` runs a command as root without two capabilities, and such a root can no longer read someone else’s file with mode `600` but gets `Permission denied`.\n\nYou can also do the opposite: give one capability to an ordinary program by writing it onto the file with `sudo setcap cap_net_bind_service=+ep /usr/local/bin/web-demo`. Now whoever runs this program gets only the right to wait for connections on low ports and nothing more. `getcap` shows such files. This is far safer than the old setuid bit, which gave a program all of root’s power.',
      ),
    },
    {
      id: 'seccomp',
      kind: 'text',
      step: 'explain',
      title: bi('Как фильтр запрещает системные вызовы', 'How a filter forbids system calls'),
      body: bi(
        'Привилегии решают, что можно делать root. Фильтр [[linux.seccomp|seccomp]] идёт дальше: процесс может заранее попросить ядро запретить ему целые системные вызовы, например всё, что связано с монтированием или перезагрузкой. Запрещённый вызов не выполняется, и процесс либо получает ошибку, либо ядро его завершает. Строка `Seccomp: 2` в файле `/proc/PID/status` означает, что фильтр включён.\n\nСобственные фильтры мы здесь писать не будем. В systemd фильтр включается одной строкой unit-файла, `SystemCallFilter=@system-service`, а группы вызовов показывает команда `systemd-analyze syscall-filter`. Важнее всего здесь сама мысль: чем меньше процесс может попросить у ядра, тем меньше вреда принесёт его ошибка.',
        'Capabilities decide what root may do. The [[linux.seccomp|seccomp]] filter goes further: a process can ask the kernel in advance to forbid it whole system calls, for example everything about mounting or rebooting. A forbidden call is not carried out: the process gets an error or the kernel ends it. The line `Seccomp: 2` in `/proc/PID/status` means the filter is on.\n\nWe will not write our own filters here. In systemd a filter is one line of a unit file, `SystemCallFilter=@system-service`, and `systemd-analyze syscall-filter` shows the groups of calls. What matters most is the idea: the less a process can ask of the kernel, the less harm its bugs can do.',
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
          prompt: bi('Покажите, что root без привилегий `CAP_DAC_OVERRIDE` и `CAP_DAC_READ_SEARCH` не может прочитать файл `/home/anna/notes.txt`, у которого режим `600` и владелец anna.', 'Show that root without the capabilities `CAP_DAC_OVERRIDE` and `CAP_DAC_READ_SEARCH` cannot read `/home/anna/notes.txt`, whose mode is `600` and owner anna.'),
          check: { when: "term['main'][last].exit!=0", stdout: /cat: \/home\/anna\/notes\.txt: Permission denied/ },
          chips: "sudo capsh --drop=cap_dac_override,cap_dac_read_search -- -c 'cat /home/anna/notes.txt'",
          docRef: { url: 'https://man7.org/linux/man-pages/man1/capsh.1.html', label: 'capsh(1) · --drop' },
          hints: { H1: bi('Команда `capsh --drop=… -- -c \'команда\'` запускает команду с урезанным набором привилегий.', '`capsh --drop=… -- -c \'command\'` runs a command with a reduced set of capabilities.') },
        },
        {
          id: 'bind',
          prompt: bi('Сделайте так, чтобы вы, не будучи root и не пользуясь sudo при запуске, могли запустить `/usr/local/bin/web-demo --port 80 &`, и запустите эту программу.', 'Make it possible for you, not being root and without sudo at run time, to start `/usr/local/bin/web-demo --port 80 &`, and start it.'),
          check: {
            when: (f) => procs(f).some((p) => p.cmd === 'web-demo' && p.uid === 1000 && (p.listen ?? []).includes(80)),
            fail: [{ if: (f) => procs(f).some((p) => p.cmd === 'web-demo' && p.uid === 0), say: bi('Сервер работает от имени root, а как раз этого мы и хотим избежать. Выдайте файлу одну привилегию и запустите его без sudo.', 'The server runs as root, which is exactly what we want to avoid. Give the file one capability and start it without sudo.') }],
          },
          chips: 'sudo setcap cap_net_bind_service=+ep /usr/local/bin/web-demo',
          docRef: { url: 'https://man7.org/linux/man-pages/man8/setcap.8.html', label: 'setcap(8)' },
          hints: { H1: bi('Без привилегии программа сообщает `bind: permission denied`. Подумайте, какая привилегия разрешает занимать низкие порты.', 'Without the capability the program reports `bind: permission denied`. Think about which capability allows the low ports.') },
        },
        {
          id: 'seccomp',
          prompt: bi('Выясните, включён ли фильтр системных вызовов у службы журнала `systemd-journald`, и запишите значение поля Seccomp её процесса в файл `~/seccomp.txt`.', 'Find out whether the journal service `systemd-journald` has a system call filter and write the value of its process’s Seccomp field into `~/seccomp.txt`.'),
          check: { when: (f) => /^\s*(Seccomp:\s*)?2\s*$/m.test(text(f, '/home/learner/seccomp.txt')) && !/^\s*(Seccomp:\s*)?0\s*$/m.test(text(f, '/home/learner/seccomp.txt')) },
          chips: 'grep Seccomp /proc/$(pgrep systemd-journal)/status',
          hints: { H1: bi('Номер процесса покажет команда `pgrep systemd-journal`, потому что имя процесса обрезано до 15 букв.', '`pgrep systemd-journal` gives the process number, because the process name is cut to 15 letters.') },
        },
      ],
    },
    {
      id: 'docker',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      levels: ['experienced'],
      title: bi('Какие привилегии оставляет Docker', 'Which capabilities Docker leaves'),
      body: bi(
        'По умолчанию Docker оставляет приложению 14 привилегий из примерно сорока: среди них есть `CAP_CHOWN`, `CAP_DAC_OVERRIDE`, `CAP_NET_BIND_SERVICE`, `CAP_KILL` и `CAP_SETUID`, а `CAP_SYS_ADMIN`, `CAP_NET_ADMIN` и `CAP_SYS_PTRACE` отняты. Поэтому root внутри приложения читает любой файл своей файловой системы, но не может монтировать, менять сеть машины и подглядывать за чужими процессами. Флаги `--cap-drop ALL --cap-add NET_BIND_SERVICE` оставляют одну нужную привилегию, а флаг `--privileged` возвращает все и снимает фильтр seccomp, поэтому на собеседовании его называют первым, когда спрашивают, как приложение может навредить машине. Профиль seccomp по умолчанию запрещает несколько десятков системных вызовов, среди них `mount`, `reboot` и загрузку модулей ядра. Проверить, что досталось процессу, можно изнутри: `grep Cap /proc/self/status` печатает наборы привилегий, а `capsh --decode=…` переводит их в имена.',
        'By default Docker leaves an application 14 capabilities out of about forty: among them `CAP_CHOWN`, `CAP_DAC_OVERRIDE`, `CAP_NET_BIND_SERVICE`, `CAP_KILL` and `CAP_SETUID`, while `CAP_SYS_ADMIN`, `CAP_NET_ADMIN` and `CAP_SYS_PTRACE` are taken away. So root inside the application reads any file of its own file system but cannot mount, change the machine’s network or peek at other processes. `--cap-drop ALL --cap-add NET_BIND_SERVICE` leaves the one capability you need, and `--privileged` gives all of them back and drops the seccomp filter, which is why it is the first thing named at an interview when asked how an application can harm the machine. The default seccomp profile forbids a few dozen system calls, among them `mount`, `reboot` and loading kernel modules. What a process got is easy to check from inside: `grep Cap /proc/self/status` prints the capability sets, and `capsh --decode=…` turns them into names.',
      ),
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
  title: bi('Как подменить процессу корень и собрать файловую систему из слоёв', 'How to give a process another root and build a file system of layers'),
  summary: bi('Процессу можно подменить корень дерева файлов. А сам этот корень можно собрать из слоёв, в которых нижние слои доступны только для чтения, а изменения записываются в верхний слой.', 'A process can be given a different root of the tree of files. And that root itself can be built of layers, where the lower layers are read-only and the changes are written into the upper layer.'),
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
      body: bi('Десяти программам на одной машине нужна каждой своя система: одной нужна старая библиотека, другой новая. Хорошо бы показать каждой программе свой каталог `/`, но при этом не держать на диске десять полных копий системы. В этом уроке вы узнаете, как это сделать.', 'Ten programs on one machine each need their own system: one needs an old library, another a new one. It would be good to show each program its own `/` without keeping ten full copies of the system on the disk. In this lesson you learn how to do it.'),
    },
    {
      id: 'chroot',
      kind: 'text',
      step: 'explain',
      title: bi('Как chroot подменяет процессу корень', 'How chroot gives a process another root'),
      body: bi(
        'Самый старый способ называется [[linux.chroot|chroot]]. Процесс получает другой корень, и всё, что лежит выше выбранного каталога, для него исчезает. Команда `sudo chroot /lab/rootfs /bin/sh` запускает оболочку, для которой `/` означает `/lab/rootfs`. Внутри этого каталога должно лежать всё, что программа будет искать: сама оболочка, команды и их библиотеки. Проще всего положить туда busybox, одну программу, которая притворяется `sh`, `ls`, `cat` и десятками других команд, смотря под каким именем её запустили.\n\nОднако chroot меняет только видимый корень. Процессы, сеть и имя машины остаются общими. Если смонтировать внутрь `/proc`, команда `ps` увидит все процессы машины, а root внутри может выбраться наружу. Поэтому chroot ещё не изолирует процесс, а даёт только часть изоляции. Настоящую стену из файлов строят пространством mnt и вызовом `pivot_root`, который меняет корень для всего пространства и отцепляет прежний корень.',
        'The oldest way is called [[linux.chroot|chroot]]. A process gets another root, and everything above the chosen directory disappears for it. `sudo chroot /lab/rootfs /bin/sh` starts a shell for which `/` means `/lab/rootfs`. Everything the program will look for must be inside that directory: the shell itself, the commands and their libraries. The simplest is to put busybox there, one program that pretends to be `sh`, `ls`, `cat` and dozens of other commands, depending on the name it was started under.\n\nBut chroot changes only the visible root. Processes, the network and the host name stay shared. If you mount `/proc` inside, `ps` sees every process of the machine, and root inside can climb out. So chroot does not isolate a process yet; it gives only part of the isolation. A real wall of files is built with a mnt namespace and the `pivot_root` call, which changes the root for the whole namespace and detaches the old root.',
      ),
    },
    {
      id: 'overlay',
      kind: 'text',
      step: 'explain',
      title: bi('Как файловая система собирается из слоёв', 'How a file system is built of layers'),
      body: bi(
        'Чтобы не держать десять копий, корень собирают из слоёв, и такая файловая система называется [[linux.overlay|overlayfs]]. Нижние слои (lower) доступны только для чтения и могут быть общими у всех программ. Верхний слой (upper) принимает изменения. Сверху видна сумма всех слоёв, которая называется merged:\n\n```\nsudo mount -t overlay overlay \\\n  -o lowerdir=/lab/lower,upperdir=/lab/upper,workdir=/lab/work /lab/merged\n```\n\nКогда программа читает файл, ядро ищет его сквозь слои сверху вниз до первого слоя, в котором он есть. При первой записи файл целиком копируется в верхний слой, и этот шаг называется copy-up, а изменения вносятся уже в копию, так что нижний слой не меняется никогда. Когда программа удаляет файл из нижнего слоя, в верхнем слое остаётся метка, которая называется whiteout. Это особый файл устройства с номерами 0, 0, и он означает «этот файл не показывать». Команда `ls -l /lab/upper` покажет её как `c---------`.\n\nТак десять программ делят одни и те же нижние слои, а у каждой есть свой тонкий верхний слой.',
        'So as not to keep ten copies, the root is built of layers, and such a file system is called [[linux.overlay|overlayfs]]. The lower layers are read-only and can be shared by all programs. The upper layer takes the changes. On top you see the sum of all layers, called merged:\n\n```\nsudo mount -t overlay overlay \\\n  -o lowerdir=/lab/lower,upperdir=/lab/upper,workdir=/lab/work /lab/merged\n```\n\nWhen a program reads a file, the kernel looks for it through the layers from the top down to the first layer that has it. On the first write the file is copied up whole, a step called copy-up, and the changes go into the copy, so the lower layer never changes. When a program deletes a file of a lower layer, a mark called a whiteout stays in the upper layer. It is a special device file numbered 0, 0, and it means “do not show this file”. `ls -l /lab/upper` shows it as `c---------`.\n\nThat way ten programs share the same lower layers, and each has its own thin upper layer.',
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
          prompt: bi('Войдите в каталог `/lab/rootfs` через chroot и создайте внутри файл `/tmp/from-inside`. Потом выйдите и найдите этот файл снаружи.', 'Enter `/lab/rootfs` with chroot and create the file `/tmp/from-inside` inside. Then leave and find the file from outside.'),
          check: { when: "files['/lab/rootfs/tmp/from-inside'].type=f", fail: [{ if: "files['/tmp/from-inside'].type=f", say: bi('Файл появился в настоящем каталоге `/tmp`, а значит, вы создали его не внутри chroot.', 'The file appeared in the real `/tmp`, which means you created it outside the chroot.') }] },
          chips: 'sudo chroot /lab/rootfs /bin/sh',
          docRef: ref('man/chroot.8', 'DESCRIPTION'),
          hints: { H1: bi('Внутри выполните `touch /tmp/from-inside`, потом `exit`, а затем `ls /lab/rootfs/tmp`.', 'Inside, run `touch /tmp/from-inside`, then `exit`, then `ls /lab/rootfs/tmp`.') },
        },
        {
          id: 'overlay',
          prompt: bi('Соберите в каталоге `/lab/merged` файловую систему из слоёв, в которой нижним слоем будет `/lab/lower`, а верхним `/lab/upper`. Допишите строку в `/lab/merged/etc/motd` и удалите `/lab/merged/old.txt`. Нижний слой при этом должен остаться нетронутым.', 'Assemble a file system of layers at `/lab/merged`, with `/lab/lower` as the lower layer and `/lab/upper` as the upper one. Append a line to `/lab/merged/etc/motd` and delete `/lab/merged/old.txt`. The lower layer must stay untouched.'),
          check: {
            when: "files['/lab/upper/etc/motd'].type=f && files['/lab/upper/old.txt'].type=c && files['/lab/lower/old.txt'].type=f && files['/lab/lower/etc/motd'].text='Welcome to the base layer.\n'",
            fail: [{ if: "!mounts[target='/lab/merged']", say: bi('Слои не смонтированы. Нужна команда `mount -t overlay`, в параметре `-o` которой указаны три каталога.', 'The layers are not mounted. You need `mount -t overlay` with three directories in its `-o` option.') }],
          },
          chips: 'sudo mount -t overlay overlay -o lowerdir=/lab/lower,upperdir=/lab/upper,workdir=/lab/work /lab/merged',
          docRef: { url: 'https://docs.kernel.org/filesystems/overlayfs.html', label: 'Overlay Filesystem' },
          hints: { H1: bi('После правки посмотрите `ls -lR /lab/upper` и найдите, что там появилось.', 'After the edit look at `ls -lR /lab/upper` and find what appeared there.'), H2: bi("Дописать строку от имени root можно командой `echo line | sudo tee -a /lab/merged/etc/motd`.", "You can append a line as root with `echo line | sudo tee -a /lab/merged/etc/motd`.") },
        },
      ],
    },
    {
      id: 'forward',
      kind: 'callout',
      tone: 'note',
      step: 'review',
      levels: ['beginner', 'intermediate'],
      title: bi('Как эти уроки связаны со следующим блоком', 'How these lessons lead to the next block'),
      body: bi('Последние уроки складываются в одну картину. Процесс получает свои пространства имён, группу с лимитами, урезанный набор привилегий, фильтр системных вызовов и корень, собранный из слоёв. На всех этих механизмах сразу построены Docker и другие инструменты, которыми собирают и запускают приложения, и в блоке о них вы увидите, что каждая их команда сводится к тому, что вы уже сделали руками.', 'The last lessons add up to one picture. A process gets its own namespaces, a group with limits, a reduced set of capabilities, a system call filter and a root made of layers. Docker and the other tools that build and run applications are built on all these mechanisms at once, and in the block about them you will see that each of their commands comes down to what you have already done by hand.'),
    },
    {
      id: 'docker',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      levels: ['experienced'],
      title: bi('Как из этих механизмов складывается Docker', 'How Docker is put together from these mechanisms'),
      body: bi(
        'Команда `docker run` проходит по цепочке программ: клиент `docker` передаёт просьбу службе `dockerd`, та передаёт её `containerd`, а настоящий запуск выполняет маленькая программа `runc`. Программа `runc` делает то, что вы прошли в последних уроках. Она вызывает `clone` с флагами новых пространств имён, кладёт процесс в группу с лимитами, отнимает у него часть привилегий и включает фильтр seccomp, а корнем через `pivot_root` делает файловую систему overlayfs, собранную из слоёв образа.\n\nСлои образа и есть нижние слои overlayfs. Каждая строка `RUN`, `COPY` и `ADD` в Dockerfile добавляет ещё один слой, а запущенное приложение получает свой верхний слой. Где лежат слои на диске, показывает `docker inspect -f "{{json .GraphDriver.Data}}" имя`, где перечислены LowerDir, UpperDir и MergedDir, а `docker diff имя` показывает содержимое верхнего слоя, а удалённые файлы команда помечает буквой D, потому что в верхнем слое на их месте лежат особые метки, которые называются whiteout. Отсюда ответ на частый вопрос собеседования: почему образ не стал меньше, если в следующей строке Dockerfile удалить большой файл. Файл остался в нижнем слое, а новый слой добавил только метку whiteout, поэтому временные файлы удаляют в той же строке `RUN`, где они появились.',
        '`docker run` goes through a chain of programs: the `docker` client hands the request to the `dockerd` service, which hands it to `containerd`, and the actual start is done by the small program `runc`. `runc` does exactly what you went through in the last lessons. It calls `clone` with the flags of new namespaces, puts the process into a group with limits, takes away part of its capabilities and switches on the seccomp filter, and with `pivot_root` makes its root an overlayfs assembled from the image’s layers.\n\nThe image’s layers are the lower layers of the overlayfs. Every `RUN`, `COPY` and `ADD` line of a Dockerfile adds one more layer, and the running application gets its own upper layer. `docker inspect -f "{{json .GraphDriver.Data}}" name` shows where the layers lie on disk, listing LowerDir, UpperDir and MergedDir, and `docker diff name` shows the contents of the upper layer, where deleted files are marked with D, because the upper layer holds special marks called whiteouts in their place. Hence the answer to a frequent interview question: why the image did not get smaller when the next Dockerfile line deleted a big file. The file stayed in the lower layer, and the new layer only added a whiteout, so temporary files are deleted in the same `RUN` line that created them.',
      ),
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
  title: bi('Сеть глазами машины и вход на сервер по ключу', 'The network through the machine’s eyes, and logging in to a server with a key'),
  summary: bi('В этом уроке вы узнаете, какие у машины сетевые интерфейсы и какие программы на ней ждут подключений, как устроен вход по SSH без пароля и почему служба sshd так строго проверяет права на файлы.', 'In this lesson you learn which network interfaces the machine has and which programs wait for connections on it, how an SSH login without a password works, and why sshd checks file permissions so strictly.'),
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
      body: bi('Вам выдали сервер и написали: «вот адрес, логин deploy, заходи по ключу». Непонятно, какой ключ имеется в виду, куда его класть и почему даже с правильным ключом сервер отвечает `Permission denied (publickey)`. В этом уроке вы ответите на все три вопроса.', 'You were given a server with a note: “here is the address, the login is deploy, log in with your key”. It is unclear which key is meant, where it goes, and why even with the right key the server answers `Permission denied (publickey)`. In this lesson you answer all three questions.'),
    },
    {
      id: 'net',
      kind: 'text',
      step: 'explain',
      title: bi('Что машина знает о сети', 'What the machine knows about the network'),
      body: bi(
        'Машина подключена к сети через [[linux.net-commands|сетевые интерфейсы]]. Интерфейс `lo` соединяет машину саму с собой, а интерфейс `eth0`, который на других машинах называется `ens3` или `enp0s3`, соединяет её с остальными. У интерфейса есть адрес, то есть номер машины в сети. Команда `ip a` показывает интерфейсы и их адреса, а `ip r` показывает, куда машина отправляет данные, для которых не знает другого пути. Команда `ss -ltnp` показывает программы, которые ждут подключений, и у каждой после двоеточия стоит её порт, то есть номер, по которому к ней подключаются: `:22` у `sshd`, `:80` у веб-сервера. Как по портам передаются данные, подробно разбирает блок о сетях, а пока достаточно уметь спросить об этом машину.',
        'A machine is connected to a network through [[linux.net-commands|network interfaces]]. The `lo` interface connects the machine to itself, and `eth0`, called `ens3` or `enp0s3` on other machines, connects it to the others. An interface has an address, the machine’s number in the network. `ip a` shows the interfaces and their addresses, and `ip r` shows where the machine sends data it knows no other way for. `ss -ltnp` shows the programs waiting for connections, and each has its port after a colon, the number by which it is reached: `:22` for `sshd`, `:80` for a web server. How data is passed by ports is covered in the networks block; for now it is enough to be able to ask the machine.',
      ),
    },
    {
      id: 'keys',
      kind: 'text',
      step: 'explain',
      title: bi('Как устроен вход по ключу', 'How logging in with a key works'),
      body: bi(
        'Команда `ssh deploy@server` открывает зашифрованный канал к службе `sshd` на сервере и запускает там вашу оболочку. Входить по паролю неудобно и опасно, потому что пароль можно подобрать. Вместо пароля используют [[linux.ssh-key|пару ключей]]:\n\n```\nssh-keygen -t ed25519\n```\n\nЭта команда создаёт два файла. Файл `~/.ssh/id_ed25519` хранит закрытый ключ, который никогда не покидает вашу машину и должен быть доступен для чтения только вам, то есть иметь режим `600`. Файл `~/.ssh/id_ed25519.pub` хранит открытый ключ, и его можно показывать кому угодно. Открытый ключ кладут на сервер в файл `~/.ssh/authorized_keys` того пользователя, под которым вы будете входить. При входе сервер проверяет, что у вас есть закрытый ключ, парный одному из этих открытых, и пароль по сети при этом не передаётся.\n\nСлужба sshd проверяет и права. Если каталог `~/.ssh` или файл `authorized_keys` может изменить кто-то, кроме владельца, sshd этим ключам не доверяет (за это отвечает настройка StrictModes) и пишет в журнал `Authentication refused: bad ownership or modes`. Поэтому у каталога `~/.ssh` должен быть режим `700`, у файла `authorized_keys` режим `600`, и оба должны принадлежать самому пользователю. Закрытый ключ, доступный слишком многим, отвергает уже сам клиент с сообщением `UNPROTECTED PRIVATE KEY FILE`.\n\nПри первом подключении клиент запоминает отпечаток ключа сервера в файле `~/.ssh/known_hosts`. Если однажды отпечаток не совпадёт, ssh откажется подключаться. Это повод остановиться и выяснить, с тем ли сервером вы разговариваете.',
        '`ssh deploy@server` opens an encrypted channel to the `sshd` service on the server and starts your shell there. Logging in with a password is inconvenient and dangerous, because a password can be guessed. A [[linux.ssh-key|key pair]] is used instead:\n\n```\nssh-keygen -t ed25519\n```\n\nThis command creates two files. `~/.ssh/id_ed25519` holds the private key, which never leaves your machine and must be readable only by you, that is, have mode `600`. `~/.ssh/id_ed25519.pub` holds the public key, which you may show anyone. The public key goes onto the server, into `~/.ssh/authorized_keys` of the user you will log in as. At login the server checks that you hold the private key matching one of those public keys, and no password is sent over the network.\n\nsshd checks permissions too. If `~/.ssh` or `authorized_keys` can be changed by anyone but the owner, sshd does not trust those keys (the StrictModes setting is in charge of this) and logs `Authentication refused: bad ownership or modes`. So `~/.ssh` must have mode `700`, `authorized_keys` mode `600`, and both must belong to the user. A private key open to too many people is rejected by the client itself with `UNPROTECTED PRIVATE KEY FILE`.\n\nOn the first connection the client remembers the fingerprint of the server’s key in `~/.ssh/known_hosts`. If one day the fingerprint does not match, ssh refuses to connect. That is a reason to stop and find out whether you are talking to the right server.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: sshSetup,
      intro: bi('Второй машины здесь нет, поэтому вы будете входить по SSH на эту же машину под пользователем deploy командой `ssh deploy@localhost`. Устроен такой вход так же, как вход на чужой сервер.', 'There is no second machine here, so you will log in over SSH to this same machine as the user deploy with `ssh deploy@localhost`. Such a login works the same way as logging in to someone else’s server.'),
      tasks: [
        {
          id: 'listen',
          prompt: bi('Выясните, какая программа на машине ждёт подключений на порту 22.', 'Find out which program on the machine waits for connections on port 22.'),
          check: { stdout: /:22\b/ },
          chips: 'sudo ss -ltnp',
          docRef: ref('man/ss.8', 'DESCRIPTION'),
          hints: { H1: bi('Воспользуйтесь командой `ss -ltnp`, а чтобы увидеть имена программ, запустите её через sudo.', 'Use `ss -ltnp`, and to see the program names run it with sudo.') },
        },
        {
          id: 'keygen',
          prompt: bi('Создайте свою пару ключей типа ed25519 в стандартном месте и без пароля на ключ.', 'Create your ed25519 key pair in the standard place, without a passphrase.'),
          check: { when: "files['/home/learner/.ssh/id_ed25519'].mode='0600' && files['/home/learner/.ssh/id_ed25519.pub'].type=f" },
          chips: "ssh-keygen -t ed25519 -N ''",
          docRef: { url: 'https://man.openbsd.org/ssh-keygen', label: 'ssh-keygen(1)' },
          hints: { H1: bi('Флаг `-t` задаёт тип ключа, а `-N \'\'` задаёт пустой пароль.', '`-t` sets the key type, and `-N \'\'` an empty passphrase.') },
        },
        {
          id: 'authorize',
          prompt: bi('Разрешите своему ключу вход под пользователем `deploy`. Для этого положите открытый ключ в его файл `~/.ssh/authorized_keys` и проследите, чтобы у файла были правильные владелец и права.', 'Allow your key to log in as `deploy`. For that, put the public key into his `~/.ssh/authorized_keys` and make sure the file has the right owner and permissions.'),
          check: {
            when: sshOk,
            fail: [{ if: (f) => !!f.files['/home/deploy/.ssh/authorized_keys'] && (f.files['/home/deploy/.ssh/authorized_keys'] as { owner?: string }).owner !== 'deploy', say: bi('Ключ на месте, но файл принадлежит root. Пользователь deploy не сможет сам менять свои ключи, а если бы у других было право записи, sshd отказал бы вовсе. Передайте каталог владельцу командой `sudo chown -R deploy:deploy /home/deploy/.ssh`.', 'The key is there, but the file belongs to root. deploy cannot manage his own keys, and if others had write access, sshd would refuse outright. Give the directory to its owner with `sudo chown -R deploy:deploy /home/deploy/.ssh`.') }],
          },
          chips: 'sudo mkdir -p /home/deploy/.ssh',
          hints: {
            H1: bi('Нужны каталог `.ssh` с режимом 700 и файл `authorized_keys` с режимом 600, и оба должны принадлежать пользователю deploy.', 'You need the `.ssh` directory with mode 700 and the `authorized_keys` file with mode 600, both owned by deploy.'),
            H2: bi('Выполните `cat ~/.ssh/id_ed25519.pub | sudo tee /home/deploy/.ssh/authorized_keys`, а потом `chown` и `chmod`.', '`cat ~/.ssh/id_ed25519.pub | sudo tee /home/deploy/.ssh/authorized_keys`, then `chown` and `chmod`.'),
          },
        },
        {
          id: 'login',
          prompt: bi('Выполните по SSH команду `whoami` от имени `deploy@localhost`.', 'Run `whoami` over SSH as `deploy@localhost`.'),
          check: { stdout: /^(?:[\s\S]*\n)?deploy\n$/ },
          chips: 'ssh deploy@localhost whoami',
          hints: { H1: bi('Команду можно передать ssh последним аргументом.', 'You can pass ssh the command as its last argument.'), H2: bi('Если сервер отказал во входе, посмотрите `sudo journalctl -u ssh -n 5`.', 'If the server refused the login, look at `sudo journalctl -u ssh -n 5`.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.pubkey', 'linux.q.strictmodes'] },
  ],
};

export const LESSONS_3: Lesson[] = [threads, namespaces, cgroupsLesson, caps, rootfs, ssh];
