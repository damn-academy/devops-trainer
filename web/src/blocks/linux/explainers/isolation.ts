// X7 + X8 «What a process sees and how much it may take» (02 §6.6 X7, X8): one
// process (report-gen) on a machine with a neighbour. Namespaces are walls
// around it — its own host name, its own process numbering, its own network
// — and the cgroup is a set of meters with limits: memory.max, pids.max,
// cpu.max. The knobs add walls and set limits; the process grows its memory
// and the OOM killer acts inside the group, not on the neighbour.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { fmtb } from './util';

type P = { uts: boolean; pid: boolean; net: boolean; memMax: number; grow: number; cpu: number };

const man = (name: string, sec: number) => ({ url: `https://man7.org/linux/man-pages/man${sec}/${name}.${sec}.html`, label: `${name}(${sec})` });

/** Memory of report-gen over time (MiB), and when the OOM killer acts. memMax 0 = no limit. */
export function memoryRun(p: P, machineFree = 460): { killedAt: number | null; peak: number; global: boolean } {
  const start = 24;
  if (p.grow <= 0) return { killedAt: null, peak: start, global: false };
  const limit = p.memMax > 0 ? p.memMax : machineFree;
  const t = Math.ceil((limit - start) / p.grow);
  if (t > 60) return { killedAt: null, peak: start + p.grow * 60, global: false };
  return { killedAt: Math.max(1, t), peak: limit, global: p.memMax <= 0 };
}

const wall = (id: string, label: Bi | string, pad: number, family: 'ns', what: Bi, see: string) => ({
  id,
  label,
  around: ['proc'],
  family,
  dash: 'dash' as const,
  pad,
  card: { what, who: bi('Ядро, по вызову unshare() или clone() с флагом CLONE_NEW…; из командной строки — `unshare`.', 'The kernel, on unshare() or clone() with a CLONE_NEW… flag; from the command line — `unshare`.'), see, doc: man('namespaces', 7) },
});

export const isolationModel = defineModel<P>({
  id: 'linux.isolation',
  block: 'linux',
  title: bi('Что процесс видит и сколько может взять', 'What a process sees and how much it may take'),
  summary: bi(
    'Пространства имён — стены вокруг процесса: своё имя машины, своя нумерация процессов, своя сеть. Cgroup — счётчики с лимитами: память, число процессов, доля процессора. Добавляйте стены, двигайте лимиты и смотрите, кого остановит ядро.',
    'Namespaces are walls around a process: its own host name, its own numbering of processes, its own network. A cgroup is a set of meters with limits: memory, the number of processes, a share of the CPU. Add walls, move the limits and see whom the kernel stops.',
  ),
  concepts: ['linux.namespace', 'linux.cgroup', 'linux.oom'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      {
        id: 'proc',
        label: 'report-gen',
        sub: 'PID 3120',
        family: 'process',
        x: 170,
        y: 150,
        w: 200,
        h: 64,
        card: { what: bi('Обычный процесс. Пространства имён меняют то, что он видит; cgroup — сколько ему можно взять. Сам он ничего об этом не знает.', 'An ordinary process. Namespaces change what it sees; the cgroup, how much it may take. It knows nothing about either.'), who: bi('Запущен командой `unshare … report-gen` внутри группы `/sys/fs/cgroup/report`.', 'Started with `unshare … report-gen` inside the group `/sys/fs/cgroup/report`.'), see: 'cat /proc/3120/status | grep -E "NSpid|VmRSS"' },
      },
      {
        id: 'neigh',
        label: 'postgres',
        sub: 'PID 811 · 300 MiB',
        family: 'process',
        x: 600,
        y: 60,
        w: 200,
        h: 56,
        card: { what: bi('Сосед по машине. Без лимитов на report-gen он рискует: при нехватке памяти на всей машине OOM killer выбирает самый большой процесс — и это может оказаться он.', 'A neighbour on the machine. Without limits on report-gen it is at risk: when the whole machine runs out of memory, the OOM killer picks the biggest process — and that may be this one.'), who: bi('systemd (postgresql.service).', 'systemd (postgresql.service).'), see: 'ps -o pid,rss,comm -p 811' },
      },
      {
        id: 'host',
        label: bi('оболочка на машине', 'the shell on the machine'),
        sub: 'hostname: trainer',
        family: 'user',
        x: 600,
        y: 150,
        w: 200,
        h: 56,
        card: { what: bi('Взгляд снаружи: здесь видны все процессы машины с их настоящими номерами, настоящее имя машины и настоящая сеть.', 'The view from outside: here you see every process of the machine with its real number, the real host name and the real network.'), who: bi('Вы, в обычном терминале.', 'You, in an ordinary terminal.'), see: 'ps aux; hostname; ip a' },
      },
      {
        id: 'mem',
        label: 'memory.current',
        sub: '24 MiB / max',
        family: 'gauge',
        shape: 'buffer',
        x: 40,
        y: 300,
        w: 260,
        h: 60,
        card: { what: bi('Сколько памяти сейчас у всех процессов группы. Дойдёт до memory.max — ядро запустит OOM killer внутри группы: убит будет процесс группы, а не сосед.', 'How much memory all processes of the group hold now. When it reaches memory.max, the kernel runs the OOM killer inside the group: a process of the group dies, not the neighbour.'), who: bi('Ядро считает; лимит пишут в файл `memory.max` (руками, systemd `MemoryMax=` и другие инструменты).', 'The kernel counts; the limit is written into the file `memory.max` (by hand, by systemd `MemoryMax=` and other tools).'), see: 'cat /sys/fs/cgroup/report/memory.current /sys/fs/cgroup/report/memory.max', doc: man('cgroups', 7) },
      },
      {
        id: 'pids',
        label: 'pids.current',
        sub: '1 / max',
        family: 'gauge',
        shape: 'buffer',
        x: 340,
        y: 300,
        w: 260,
        h: 60,
        card: { what: bi('Сколько процессов и потоков в группе. Упрётся в pids.max — следующий fork получит «Resource temporarily unavailable».', 'How many processes and threads are in the group. When it reaches pids.max, the next fork gets “Resource temporarily unavailable”.'), who: bi('Ядро; лимит — файл `pids.max`.', 'The kernel; the limit is the file `pids.max`.'), see: 'cat /sys/fs/cgroup/report/pids.current' },
      },
      {
        id: 'cpu',
        label: 'cpu.max',
        sub: 'max 100000',
        family: 'gauge',
        shape: 'buffer',
        x: 640,
        y: 300,
        w: 280,
        h: 60,
        card: { what: bi('Квота процессора: «50000 100000» значит 50 мс работы из каждых 100 мс, то есть полпроцессора. Процесс не убивают — его притормаживают, а в cpu.stat растёт nr_throttled.', 'A CPU quota: “50000 100000” means 50 ms of work in every 100 ms, i.e. half a CPU. The process is not killed — it is slowed down, and nr_throttled grows in cpu.stat.'), who: bi('Ядро (планировщик); лимит — файл `cpu.max`, у systemd — `CPUQuota=`.', 'The kernel (the scheduler); the limit is the file `cpu.max`, `CPUQuota=` in systemd.'), see: 'cat /sys/fs/cgroup/report/cpu.stat' },
      },
      {
        id: 'kernel',
        label: bi('ядро Linux: одно на всех', 'the Linux kernel: one for everyone'),
        family: 'kernel',
        shape: 'bar',
        x: 16,
        y: 400,
        w: 928,
        h: 56,
        card: { what: bi('Стены и счётчики — не отдельная машина: это одно и то же ядро, которое по-разному отвечает разным процессам. Поэтому изоляция дешёвая и мгновенная.', 'The walls and meters are not a separate machine: it is one and the same kernel answering different processes differently. That is why the isolation is cheap and instant.'), who: bi('Загружается при старте машины.', 'Loaded when the machine boots.'), see: 'lsns; ls /sys/fs/cgroup', doc: man('namespaces', 7) },
      },
    ],
    edges: [
      { id: 'e-mem', from: 'proc', to: 'mem', label: bi('память', 'memory'), card: { what: bi('Каждая страница памяти процесса засчитывается его группе.', 'Every page of the process’s memory is charged to its group.'), who: bi('Ядро', 'The kernel') } },
      { id: 'e-pids', from: 'proc', to: 'pids', label: 'fork', card: { what: bi('Каждый новый процесс или поток засчитывается в pids.current.', 'Every new process or thread is counted in pids.current.'), who: bi('Ядро', 'The kernel') } },
      { id: 'e-cpu', from: 'proc', to: 'cpu', via: [[400, 260], [780, 260]], label: bi('время процессора', 'CPU time'), labelAt: 0.6, card: { what: bi('Время процессора группы делится периодами по 100 мс.', 'The group’s CPU time is cut into 100 ms periods.'), who: bi('Планировщик ядра', 'The kernel’s scheduler') } },
      { id: 'e-view', from: 'host', to: 'proc', label: bi('снаружи видно', 'seen from outside'), card: { what: bi('Снаружи процесс виден всегда — с настоящим номером. Стены работают в одну сторону: внутри не видно наружу.', 'From outside the process is always visible — with its real number. The walls work one way: from inside you cannot see out.'), who: bi('Ядро', 'The kernel'), see: 'ps -o pid,pidns,utsns,comm -C report-gen' } },
      { id: 'e-neigh', from: 'neigh', to: 'kernel', via: [[860, 88], [860, 380]], label: bi('память машины', 'machine memory'), labelAt: 0.6, card: { what: bi('Сосед берёт память из общей памяти машины — той же, что и report-gen без лимита.', 'The neighbour takes memory from the machine’s shared memory — the same memory report-gen uses without a limit.'), who: bi('Ядро', 'The kernel'), see: 'free -h' } },
    ],
    groups: [
      wall('w-pid', bi('pid: внутри он — PID 1', 'pid: inside it is PID 1'), 12, 'ns', bi('Своя нумерация процессов: внутри report-gen — 1, снаружи — 3120. ps внутри видит только своих (если смонтирован свой /proc).', 'Its own numbering of processes: inside, report-gen is 1; outside, 3120. ps inside sees only its own (if its own /proc is mounted).'), 'readlink /proc/3120/ns/pid'),
      wall('w-uts', 'uts: hostname report', 30, 'ns', bi('Своё имя машины: `hostname` внутри и снаружи отвечают по-разному.', 'Its own host name: `hostname` answers differently inside and outside.'), 'readlink /proc/3120/ns/uts'),
      wall('w-net', bi('net: только lo', 'net: only lo'), 48, 'ns', bi('Свой сетевой стек: внутри только интерфейс lo, и тот выключен. Наружу не уйти, пока не подключат.', 'Its own network stack: inside there is only the lo interface, and it is down. It cannot reach out until someone connects it.'), 'readlink /proc/3120/ns/net'),
    ],
  },
  params: [
    { id: 'uts', label: bi('своё имя машины (--uts)', 'own host name (--uts)'), kind: 'toggle', default: true, near: 'proc' },
    {
      id: 'pid',
      label: bi('своя нумерация процессов (--pid --fork --mount-proc)', 'own process numbering (--pid --fork --mount-proc)'),
      kind: 'toggle',
      default: true,
      near: 'proc',
      predict: {
        prompt: bi('Внутри своей нумерации report-gen — PID 1. Каким номером его видит оболочка на машине?', 'Inside its own numbering report-gen is PID 1. What number does the shell on the machine see?'),
        options: [
          { id: 'real', text: bi('Своим настоящим: 3120', 'Its real one: 3120') },
          { id: 'one', text: bi('Тоже 1', 'Also 1') },
        ],
        resolve: () => 'real',
      },
    },
    { id: 'net', label: bi('своя сеть (--net)', 'own network (--net)'), kind: 'toggle', default: false, near: 'proc', levels: ['intermediate', 'experienced'] },
    {
      id: 'memMax',
      label: bi('memory.max', 'memory.max'),
      kind: 'range',
      min: 0,
      max: 512,
      step: 16,
      default: 64,
      unit: 'MiB',
      near: 'mem',
      predict: {
        prompt: bi('Уберём лимит памяти (0 = max). Кого убьёт ядро, когда память машины кончится?', 'Remove the memory limit (0 = max). Whom does the kernel kill when the machine runs out of memory?'),
        options: [
          { id: 'biggest', text: bi('Самый большой процесс машины — может быть, соседа', 'The biggest process of the machine — maybe the neighbour') },
          { id: 'report', text: bi('Обязательно report-gen: он же виноват', 'report-gen, of course: it is the culprit') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'neigh' || s.id === 'global') ? 'biggest' : 'report'),
      },
    },
    { id: 'grow', label: bi('report-gen растёт на', 'report-gen grows by'), kind: 'range', min: 0, max: 40, step: 2, default: 8, unit: 'MiB/s', near: 'proc' },
    { id: 'cpu', label: bi('cpu.max, доля процессора', 'cpu.max, share of a CPU'), kind: 'range', min: 10, max: 100, step: 10, default: 100, unit: '%', near: 'cpu', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'no-fork',
      label: bi('unshare --pid без --fork', 'unshare --pid without --fork'),
      remove: ['e-pids'],
      boundary: 'process',
      predict: {
        prompt: bi('`sudo unshare --pid bash` (без --fork), затем две команды подряд. Что будет со второй?', '`sudo unshare --pid bash` (without --fork), then two commands in a row. What happens to the second?'),
        options: [
          { id: 'fail', text: bi('fork: Cannot allocate memory', 'fork: Cannot allocate memory') },
          { id: 'ok', text: bi('Выполнится как обычно', 'It runs as usual') },
        ],
        resolve: () => 'fail',
      },
    },
    {
      id: 'no-cgroup',
      label: bi('Запустить без cgroup с лимитами', 'Run without a cgroup with limits'),
      remove: ['mem', 'e-mem'],
      boundary: 'process',
      predict: {
        prompt: bi('Лимитов нет, report-gen растёт. Кто пострадает первым?', 'No limits, report-gen grows. Who suffers first?'),
        options: [
          { id: 'machine', text: bi('Вся машина: убит может быть любой большой процесс', 'The whole machine: any big process may be killed') },
          { id: 'only', text: bi('Только report-gen', 'Only report-gen') },
        ],
        resolve: () => 'machine',
      },
    },
  ],
  metrics: [
    { id: 'mem', label: bi('память группы', 'group memory'), unit: 'MiB' },
    { id: 'oom', label: bi('oom_kill', 'oom_kill') },
    { id: 'walls', label: bi('стен', 'walls') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const walls = Number(p.uts) + Number(p.pid) + Number(p.net);
    const noLimit = broken.has('no-cgroup') || p.memMax <= 0;
    const mr = memoryRun({ ...p, memMax: noLimit ? 0 : p.memMax });
    const maxLabel = noLimit ? 'max' : `${p.memMax} MiB`;
    const wallStates = { 'w-uts': p.uts ? 'on' : 'off', 'w-pid': p.pid ? 'on' : 'off', 'w-net': p.net ? 'on' : 'off' } as const;
    steps.push({
      id: 'start',
      label: 'unshare',
      caption: walls
        ? fmtb(bi('`unshare` создал стен: {n}. Процесс внутри — обычный процесс того же ядра, просто ядро отвечает ему иначе.', '`unshare` created {n} walls. The process inside is an ordinary process of the same kernel; the kernel just answers it differently.'), { n: walls })
        : bi('Без стен процесс видит всю машину: её имя, все процессы, всю сеть.', 'Without walls the process sees the whole machine: its name, every process, the whole network.'),
      focus: ['proc', 'w-uts', 'w-pid', 'w-net'],
      states: { ...wallStates, proc: 'on', mem: noLimit ? 'off' : 'on' },
      values: { proc: p.pid ? 'PID 1 · inside' : 'PID 3120', mem: `24 MiB / ${maxLabel}`, pids: '1 / 32', cpu: p.cpu >= 100 ? 'max 100000' : `${p.cpu * 1000} 100000`, host: 'hostname: trainer' },
      fill: { mem: noLimit ? 24 / 460 : 24 / p.memMax, pids: 1 / 32, cpu: 0 },
      metrics: { mem: 24, oom: 0, walls },
    });
    if (broken.has('no-fork') && p.pid) {
      steps.push({ id: 'first', label: bi('первый', 'first'), caption: bi('Без --fork сам bash остался снаружи новой нумерации; его первый потомок стал PID 1 — и завершился вместе с первой командой.', 'Without --fork bash itself stayed outside the new numbering; its first child became PID 1 — and ended with the first command.'), focus: ['proc'], states: { proc: 'off' }, metrics: { mem: 24, oom: 0, walls } });
      steps.push({
        id: 'no-fork',
        label: 'fork',
        caption: bi('Нумерация, у которой умер PID 1, закрыта навсегда: создать в ней процесс нельзя.', 'A numbering whose PID 1 has died is closed for good: no process can be created in it.'),
        focus: ['e-pids', 'pids'],
        states: { 'e-pids': 'err', pids: 'err' },
        metrics: { mem: 24, oom: 0, walls },
        broken: { at: 'e-pids', message: 'bash: fork: Cannot allocate memory', caption: bi('поэтому с --pid почти всегда пишут --fork: тогда PID 1 становится сам bash.', 'that is why --pid almost always comes with --fork: then bash itself becomes PID 1.') },
      });
      return steps;
    }
    steps.push({
      id: 'inside',
      label: bi('изнутри', 'inside'),
      caption: fmtb(bi('Изнутри: `hostname` → {h}; `ps` → {ps}; `ip a` → {ip}.', 'Inside: `hostname` → {h}; `ps` → {ps}; `ip a` → {ip}.'), {
        h: p.uts ? 'report' : 'trainer',
        ps: p.pid ? bi('один процесс, PID 1', 'one process, PID 1') : bi('все процессы машины', 'every process of the machine'),
        ip: p.net ? bi('только lo, DOWN', 'only lo, DOWN') : bi('lo и eth0 машины', 'the machine’s lo and eth0'),
      }),
      focus: ['proc', 'w-uts', 'w-pid', 'w-net'],
      states: { ...wallStates },
      metrics: { mem: 24, oom: 0, walls },
    });
    steps.push({
      id: 'outside',
      label: bi('снаружи', 'outside'),
      caption: bi('Снаружи всё по-прежнему: `hostname` → trainer, а report-gen виден в `ps aux` со своим настоящим номером 3120. Стены непрозрачны только изнутри.', 'Outside nothing changed: `hostname` → trainer, and report-gen shows up in `ps aux` with its real number, 3120. The walls are opaque only from inside.'),
      focus: ['host', 'e-view'],
      tokens: [{ edge: 'e-view', label: '3120' }],
      metrics: { mem: 24, oom: 0, walls },
    });
    if (p.cpu < 100) {
      steps.push({
        id: 'cpu',
        label: 'cpu.max',
        caption: fmtb(bi('cpu.max = {q} 100000: в каждом периоде 100 мс группе достаётся {c}% процессора. Остальное время процесс ждёт — его не убивают, а притормаживают.', 'cpu.max = {q} 100000: in every 100 ms period the group gets {c}% of a CPU. For the rest of the time the process waits — it is slowed down, not killed.'), { q: p.cpu * 1000, c: p.cpu }),
        focus: ['e-cpu', 'cpu'],
        tokens: [{ edge: 'e-cpu' }],
        fill: { cpu: p.cpu / 100 },
        values: { cpu: `${p.cpu * 1000} 100000 · throttled` },
        metrics: { mem: 24, oom: 0, walls },
      });
    }
    const grow = (t: number) => Math.min(mr.peak, 24 + p.grow * t);
    if (p.grow > 0) {
      const mid = Math.max(1, Math.floor((mr.killedAt ?? 20) / 2));
      steps.push({
        id: 'grow',
        label: bi('растёт', 'grows'),
        caption: fmtb(bi('report-gen растёт на {g} МиБ в секунду. Через {t} с у группы {m} МиБ из {x}.', 'report-gen grows by {g} MiB per second. After {t} s the group holds {m} MiB of {x}.'), { g: p.grow, t: mid, m: Math.round(grow(mid)), x: maxLabel }),
        focus: ['e-mem', 'mem'],
        tokens: [{ edge: 'e-mem', label: `${p.grow} MiB/s` }],
        values: { mem: `${Math.round(grow(mid))} MiB / ${maxLabel}` },
        fill: { mem: noLimit ? grow(mid) / 460 : Math.min(1, grow(mid) / p.memMax) },
        metrics: { mem: Math.round(grow(mid)), oom: 0, walls },
      });
    }
    if (mr.killedAt === null) {
      steps.push({ id: 'fits', label: 'ok', caption: bi('За минуту рост не дошёл до лимита: процесс работает, соседи не замечают.', 'Within a minute the growth never reached the limit: the process works and the neighbours notice nothing.'), focus: ['mem', 'proc'], states: { mem: 'ok' }, metrics: { mem: Math.round(mr.peak), oom: 0, walls } });
      return steps;
    }
    if (noLimit) {
      steps.push({
        id: 'global',
        label: 'OOM',
        caption: fmtb(bi('Лимита нет: через {t} с память кончилась у всей машины. Глобальный OOM killer выбирает самый тяжёлый процесс машины — сейчас это сосед postgres.', 'There is no limit: after {t} s the whole machine is out of memory. The global OOM killer picks the heaviest process of the machine — right now that is the neighbour, postgres.'), { t: mr.killedAt }),
        focus: ['neigh', 'e-neigh', 'kernel'],
        tokens: [{ edge: 'e-neigh' }],
        states: { neigh: 'err', proc: 'warn' },
        values: { neigh: 'killed', mem: `${Math.round(mr.peak)} MiB / max` },
        fill: { mem: 1 },
        metrics: { mem: Math.round(mr.peak), oom: 1, walls },
        broken: { at: 'neigh', message: 'Out of memory: Killed process 811 (postgres) total-vm:612000kB, anon-rss:307200kB, file-rss:0kB, shmem-rss:0kB, UID:999', caption: bi('без лимита страдает не виновник, а самый большой: лимит памяти защищает соседей.', 'without a limit it is not the culprit who suffers but the biggest one: a memory limit protects the neighbours.') },
      });
      return steps;
    }
    steps.push({
      id: 'oom',
      label: 'OOM',
      caption: fmtb(bi('Через {t} с группа дошла до memory.max = {x}. Ядро не даёт памяти сверх лимита и запускает OOM killer внутри группы: report-gen убит сигналом KILL (код 137). memory.events: oom_kill 1.', 'After {t} s the group reached memory.max = {x}. The kernel gives no memory beyond the limit and runs the OOM killer inside the group: report-gen is killed with KILL (code 137). memory.events: oom_kill 1.'), { t: mr.killedAt, x: maxLabel }),
      focus: ['proc', 'mem', 'kernel'],
      states: { proc: 'err', mem: 'err' },
      values: { proc: 'killed (137)', mem: `${p.memMax} MiB / ${maxLabel}` },
      fill: { mem: 1 },
      metrics: { mem: p.memMax, oom: 1, walls },
    });
    steps.push({
      id: 'neighbour',
      label: bi('соседи', 'neighbours'),
      caption: bi('Соседу ничего не сделалось: память машины не кончалась. В dmesg — «Memory cgroup out of memory: Killed process 3120 (report-gen)».', 'The neighbour is untouched: the machine never ran out of memory. dmesg says “Memory cgroup out of memory: Killed process 3120 (report-gen)”.'),
      focus: ['neigh'],
      states: { neigh: 'ok' },
      metrics: { mem: 0, oom: 1, walls },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    void prev;
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана.', 'The break is removed.');
      return change.id === 'no-fork' ? bi('Без --fork первый потомок стал PID 1 и умер — новая нумерация закрылась, следующий fork не проходит.', 'Without --fork the first child became PID 1 and died — the new numbering is closed, the next fork fails.') : bi('Без группы с лимитом процесс берёт память машины, и OOM killer приходит ко всей машине.', 'Without a group with a limit the process takes the machine’s memory, and the OOM killer comes for the whole machine.');
    }
    const last = next[next.length - 1];
    switch (change.id) {
      case 'uts':
        return b.uts ? bi('--uts: своё имя машины — `hostname report` внутри не меняет имя снаружи.', '--uts: its own host name — `hostname report` inside does not change the name outside.') : bi('Без --uts имя машины общее: смена имени внутри сменила бы его всем.', 'Without --uts the host name is shared: renaming inside would rename it for everyone.');
      case 'pid':
        return b.pid ? bi('--pid --fork --mount-proc: внутри report-gen — PID 1 и ps видит только его; снаружи он по-прежнему 3120.', '--pid --fork --mount-proc: inside, report-gen is PID 1 and ps sees only it; outside it is still 3120.') : bi('Без --pid внутри видны все процессы машины с настоящими номерами.', 'Without --pid every process of the machine is visible inside, with real numbers.');
      case 'net':
        return b.net ? bi('--net: свой сетевой стек, в нём только lo в состоянии DOWN.', '--net: its own network stack, with only lo, DOWN.') : bi('Без --net процесс пользуется сетью машины.', 'Without --net the process uses the machine’s network.');
      case 'memMax':
        return Number(b.memMax) <= 0 ? bi('memory.max = max: лимита нет — при нехватке памяти OOM killer придёт ко всей машине.', 'memory.max = max: no limit — when memory runs out the OOM killer comes for the whole machine.') : fmtb(bi('memory.max {a} → {b} МиБ: OOM внутри группы {r}.', 'memory.max {a} → {b} MiB: the OOM inside the group {r}.'), { a: Number(a.memMax), b: Number(b.memMax), r: last?.id === 'fits' ? bi('не наступает за минуту', 'does not come within a minute') : bi('наступает раньше или позже', 'comes sooner or later') });
      case 'grow':
        return fmtb(bi('Рост {g} МиБ/с: {r}.', 'Growth {g} MiB/s: {r}.'), { g: Number(b.grow), r: next.some((s) => s.id === 'oom' || s.id === 'global') ? bi('лимит будет достигнут', 'the limit will be reached') : bi('лимит не достигается', 'the limit is not reached') });
      case 'cpu':
        return fmtb(bi('cpu.max: {c}% процессора — процесс медленнее, но жив: квоту не превышают, её ждут.', 'cpu.max: {c}% of a CPU — the process is slower but alive: a quota is not exceeded, it is waited for.'), { c: Number(b.cpu) });
    }
    return bi('Параметр изменился — картина пересчитана.', 'The parameter changed — the picture was recomputed.');
  },
});
