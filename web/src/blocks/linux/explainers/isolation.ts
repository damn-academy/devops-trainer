// X7 + X8 «What a process sees and how much it may take» (02 §6.6 X7, X8): one
// process (report-gen) on a machine with a neighbour. Namespaces are walls
// around it — its own host name, its own process numbering, its own network
// — and the cgroup is a set of meters with limits: memory.max, pids.max,
// cpu.max. The knobs add walls and set limits; the process grows its memory
// and the OOM killer acts inside the group, not on the neighbour.

import { defineModel } from '../../../core/define';
import { bi, t, type Bi } from '../../../core/i18n';
import type { DiagramGroup, ElementState, Step } from '../../../core/types';
import { fmtb } from './util';

type P = { uts: boolean; pid: boolean; net: boolean; limit?: boolean; memMax: number; grow: number; cpu: number };

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

const wall = (id: string, label: Bi | string, pad: number, what: Bi, see: string): DiagramGroup => ({
  id,
  label,
  around: ['proc'],
  family: 'ns',
  dash: 'dash',
  pad,
  card: { what, who: bi('Стену создаёт ядро по системному вызову unshare или clone с одним из флагов CLONE_NEW…, а из командной строки её создаёт команда `unshare`.', 'The kernel creates the wall on the unshare or clone system call with one of the CLONE_NEW… flags; from the command line, `unshare` creates it.'), see, doc: man('namespaces', 7) },
});

const ALL = ['proc', 'neigh', 'host', 'mem', 'pids', 'cpu', 'kernel', 'e-mem', 'e-pids', 'e-cpu', 'e-view', 'e-neigh'];
const startWith = (...shown: string[]): Record<string, ElementState> => Object.fromEntries(ALL.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

export const isolationModel = defineModel<P>({
  id: 'linux.isolation',
  frame: 'visible',
  block: 'linux',
  title: bi('Что процесс видит и сколько ресурсов он может взять', 'What a process sees and how many resources it may take'),
  summary: bi(
    'Процесс report-gen запущен командой `unshare` на машине, где работает и соседний процесс postgres. Пространства имён ставят вокруг report-gen стены: у него своё имя машины, своя нумерация процессов и своя сеть. Группа cgroup считает, сколько памяти, процессов и времени процессора он берёт, и не даёт ему выйти за лимиты.',
    'The report-gen process is started with `unshare` on a machine where the neighbouring process postgres also runs. Namespaces put walls around report-gen: it has its own host name, its own process numbering and its own network. A cgroup counts how much memory, how many processes and how much CPU time it takes, and keeps it within the limits.',
  ),
  intro: bi(
    'Сейчас на схеме только процесс report-gen, оболочка на машине и ядро, а стены, счётчики и соседний процесс появятся по ходу шагов. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко рядом с подсвеченным блоком говорит, что он видит или делает, а пунктирные рамки вокруг report-gen обозначают стены пространств имён.\n\nКогда дойдёте до конца, выключите в «Параметрах» одну из стен или снимите лимит памяти переключателем «У группы есть лимит памяти» и пройдите шаги ещё раз.',
    'Now the diagram shows only the report-gen process, the shell on the machine and the kernel; the walls, the meters and the neighbouring process appear as you step. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout next to the highlighted block says what it sees or does, and the dashed frames around report-gen are the namespace walls.\n\nOnce you reach the end, switch off one of the walls in “Parameters” or remove the memory limit with “The group has a memory limit” and walk the steps again.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок видит или делает', 'what that block sees or does') },
    { mark: 'dashed', text: bi('стена пространства имён вокруг процесса', 'a namespace wall around the process') },
    { mark: 'icon:process', text: bi('процесс', 'a process') },
    { mark: 'token', text: bi('что передаётся: номер процесса, рост памяти', 'what is handed on: a process number, memory growth') },
    { mark: 'err', text: bi('процесс завершён ядром из-за нехватки памяти', 'the process was ended by the kernel for lack of memory') },
  ],
  stopLabel: bi('Процесс остановлен', 'The process was stopped'),
  concepts: ['linux.namespace', 'linux.cgroup', 'linux.oom'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      {
        id: 'proc',
        label: 'report-gen',
        icon: 'process',
        work: 'pulse',
        sub: 'PID 3120',
        family: 'process',
        x: 170,
        y: 150,
        w: 200,
        h: 64,
        card: { what: bi('Обычный процесс, который строит ночной отчёт. Пространства имён меняют то, что он видит, а группа cgroup решает, сколько ресурсов ему можно взять. Сам процесс ни о том, ни о другом не знает.', 'An ordinary process that builds the nightly report. Namespaces change what it sees, and the cgroup decides how many resources it may take. The process itself knows about neither.'), who: bi('Процесс запущен командой `unshare … report-gen` внутри группы `/sys/fs/cgroup/report`.', 'It was started with `unshare … report-gen` inside the group `/sys/fs/cgroup/report`.'), see: 'cat /proc/3120/status | grep -E "NSpid|VmRSS"' },
      },
      {
        id: 'neigh',
        label: 'postgres',
        icon: 'database',
        sub: { ru: 'PID 811 · 600 МиБ', en: 'PID 811 · 600 MiB' },
        family: 'process',
        x: 600,
        y: 88,
        w: 200,
        h: 56,
        card: { what: bi('Процесс postgres обслуживает базу данных, работает на той же машине, что и report-gen, и держит в памяти 600 МиБ данных. Если у report-gen нет лимита памяти, соседний процесс рискует: когда память кончается у всей машины, OOM killer выбирает процесс с самой высокой оценкой oom_score, а она растёт вместе с занятой памятью. Пока report-gen занимает меньше 600 МиБ, самым большим процессом остаётся база.', 'The postgres process serves a database, runs on the same machine as report-gen and holds 600 MiB of data in memory. If report-gen has no memory limit, the neighbouring process is at risk: when the whole machine runs out of memory, the OOM killer picks the process with the highest oom_score, and the score grows with the memory taken. While report-gen takes less than 600 MiB, the database stays the biggest process.'), who: bi('Базу запускает systemd как службу postgresql.service.', 'systemd starts the database as postgresql.service.'), see: 'ps -o pid,rss,comm -p 811; cat /proc/811/oom_score' },
      },
      {
        id: 'host',
        label: bi('Оболочка на машине', 'The shell on the machine'),
        icon: 'terminal',
        sub: 'hostname: trainer',
        family: 'user',
        x: 600,
        y: 160,
        w: 200,
        h: 56,
        card: { what: bi('Так машину видно снаружи стен: здесь видны все процессы машины с их настоящими номерами, настоящее имя машины и настоящая сеть.', 'This is how the machine looks from outside the walls: you see every process of the machine with its real number, the real host name and the real network.'), who: bi('Эту оболочку вы открыли в обычном терминале, вне всяких стен.', 'You opened this shell in an ordinary terminal, outside any walls.'), see: 'ps aux; hostname; ip a' },
      },
      {
        id: 'mem',
        label: bi('Память группы (memory.current)', 'Group memory (memory.current)'),
        sub: { ru: '24 МиБ / max', en: '24 MiB / max' },
        family: 'gauge',
        shape: 'buffer',
        x: 40,
        y: 300,
        w: 260,
        h: 60,
        card: { what: bi('Счётчик показывает, сколько памяти сейчас занимают все процессы группы. Когда он дойдёт до memory.max, ядро запустит OOM killer внутри группы, и завершён будет процесс этой группы, а не соседний.', 'The meter shows how much memory all processes of the group take now. When it reaches memory.max, the kernel runs the OOM killer inside the group, and a process of this group is ended, not the neighbour.'), who: bi('Память считает ядро, а лимит записывают в файл `memory.max` вручную или строкой `MemoryMax=` в unit-файле systemd.', 'The kernel counts the memory, and the limit is written into `memory.max` by hand or with `MemoryMax=` in a systemd unit file.'), see: 'cat /sys/fs/cgroup/report/memory.current /sys/fs/cgroup/report/memory.max', doc: man('cgroups', 7) },
      },
      {
        id: 'pids',
        label: bi('Процессы группы (pids.current)', 'Group processes (pids.current)'),
        sub: '1 / max',
        family: 'gauge',
        shape: 'buffer',
        x: 340,
        y: 300,
        w: 260,
        h: 60,
        card: { what: bi('Счётчик показывает, сколько процессов и потоков работает в группе. Когда он дойдёт до pids.max, следующая попытка создать процесс получит ошибку «Resource temporarily unavailable».', 'The meter shows how many processes and threads run in the group. When it reaches pids.max, the next attempt to create a process gets “Resource temporarily unavailable”.'), who: bi('Процессы считает ядро, а лимит хранится в файле `pids.max`.', 'The kernel counts the processes, and the limit is kept in `pids.max`.'), see: 'cat /sys/fs/cgroup/report/pids.current' },
      },
      {
        id: 'cpu',
        label: bi('Доля процессора (cpu.max)', 'CPU share (cpu.max)'),
        sub: 'max 100000',
        family: 'gauge',
        shape: 'buffer',
        x: 640,
        y: 300,
        w: 280,
        h: 60,
        card: { what: bi('Файл cpu.max задаёт квоту процессора. Значение «50000 100000» означает 50 мс работы из каждых 100 мс, то есть половину процессора. Процесс, исчерпавший квоту, не завершают, а притормаживают, и в файле cpu.stat растёт счётчик nr_throttled.', 'The cpu.max file sets a CPU quota. “50000 100000” means 50 ms of work out of every 100 ms, half a CPU. A process that used up its quota is not ended but slowed down, and nr_throttled grows in cpu.stat.'), who: bi('Квоту соблюдает планировщик ядра, а записывают её в файл `cpu.max` или строкой `CPUQuota=` в unit-файле.', 'The kernel’s scheduler enforces the quota, and it is written into `cpu.max` or with `CPUQuota=` in a unit file.'), see: 'cat /sys/fs/cgroup/report/cpu.stat' },
      },
      {
        id: 'kernel',
        label: bi('Ядро Linux, одно на все процессы', 'The Linux kernel, one for all processes'),
        family: 'kernel',
        shape: 'bar',
        x: 16,
        y: 400,
        w: 928,
        h: 56,
        card: { what: bi('Стены и счётчики не создают отдельную машину: всё это делает одно и то же ядро, которое по-разному отвечает разным процессам. Поэтому такая изоляция обходится дёшево и включается мгновенно.', 'The walls and meters do not make a separate machine: one and the same kernel does all of it, answering different processes differently. That is why such isolation is cheap and switches on instantly.'), who: bi('Ядро загружается при включении машины.', 'The kernel is loaded when the machine powers on.'), see: 'lsns; ls /sys/fs/cgroup', doc: man('namespaces', 7) },
      },
    ],
    edges: [
      { id: 'e-mem', from: 'proc', to: 'mem', label: bi('учёт памяти', 'memory accounting'), card: { what: bi('Каждая страница памяти, которую берёт процесс, засчитывается его группе.', 'Every page of memory the process takes is charged to its group.'), who: bi('Учёт ведёт ядро.', 'The kernel keeps the account.') } },
      { id: 'e-pids', from: 'proc', to: 'pids', label: bi('новые процессы', 'new processes'), card: { what: bi('Каждый новый процесс или поток засчитывается в pids.current.', 'Every new process or thread is counted in pids.current.'), who: bi('Учёт ведёт ядро.', 'The kernel keeps the account.') } },
      { id: 'e-cpu', from: 'proc', to: 'cpu', via: [[400, 260], [780, 260]], label: bi('время процессора', 'CPU time'), labelAt: 0.6, card: { what: bi('Время процессора, которое достаётся группе, делится на периоды по 100 мс.', 'The CPU time the group gets is cut into 100 ms periods.'), who: bi('Время делит планировщик ядра.', 'The kernel’s scheduler divides the time.') } },
      { id: 'e-view', from: 'host', to: 'proc', label: bi('взгляд снаружи', 'the view from outside'), card: { what: bi('Снаружи процесс виден всегда, причём с настоящим номером. Стены действуют в одну сторону, и изнутри не видно, что делается снаружи.', 'From outside the process is always visible, with its real number. The walls work one way: from inside you cannot see what happens outside.'), who: bi('Сведения о процессах выдаёт ядро.', 'The kernel provides the facts about processes.'), see: 'ps -o pid,pidns,utsns,comm -C report-gen' } },
      { id: 'e-neigh', from: 'neigh', to: 'kernel', via: [[860, 116], [860, 380]], label: bi('общая память машины', 'the machine’s shared memory'), labelAt: 0.6, card: { what: bi('Сосед берёт память из общей памяти машины, из той же, которую берёт и report-gen, если у него нет лимита.', 'The neighbour takes memory from the machine’s shared memory, the same memory report-gen takes when it has no limit.'), who: bi('Память раздаёт ядро.', 'The kernel hands out the memory.'), see: 'free -h' } },
    ],
    groups: [
      wall('w-pid', bi('своя нумерация процессов (pid)', 'its own process numbering (pid)'), 12, bi('У процесса своя нумерация процессов, поэтому внутри report-gen имеет номер 1, а снаружи номер 3120. Команда ps внутри видит только процессы своего пространства, если для него смонтирован свой /proc.', 'The process has its own numbering of processes, so inside, report-gen is number 1, and outside it is 3120. ps inside sees only the processes of its namespace, if its own /proc is mounted.'), 'readlink /proc/3120/ns/pid'),
      wall('w-uts', bi('своё имя машины report (uts)', 'its own host name report (uts)'), 30, bi('У процесса своё имя машины, поэтому команда `hostname` внутри стен и снаружи отвечает по-разному.', 'The process has its own host name, so `hostname` answers differently inside the walls and outside.'), 'readlink /proc/3120/ns/uts'),
      wall('w-net', bi('своя сеть, где есть только lo (net)', 'its own network with only lo (net)'), 48, bi('У процесса свой сетевой стек, в котором есть только выключенный интерфейс lo. Пока это пространство не соединят с сетью машины, процесс не может ничего отправить наружу.', 'The process has its own network stack with only the lo interface, which is down. Until this namespace is connected to the machine’s network, the process cannot send anything out.'), 'readlink /proc/3120/ns/net'),
    ],
  },
  params: [
    { id: 'uts', label: bi('У процесса своё имя машины (--uts)', 'The process has its own host name (--uts)'), kind: 'toggle', default: true, near: 'proc', group: bi('Какие стены стоят вокруг процесса', 'Which walls surround the process') },
    {
      id: 'pid',
      label: bi('У процесса своя нумерация процессов (--pid --fork --mount-proc)', 'The process has its own process numbering (--pid --fork --mount-proc)'),
      kind: 'toggle',
      default: true,
      near: 'proc',
      group: bi('Какие стены стоят вокруг процесса', 'Which walls surround the process'),
      predict: {
        prompt: bi('Внутри своей нумерации report-gen имеет номер 1. Под каким номером его видит оболочка на машине, которая находится снаружи стен?', 'Inside its own numbering report-gen is number 1. Under which number does the shell on the machine, outside the walls, see it?'),
        options: [
          { id: 'real', text: bi('Под своим настоящим номером 3120', 'Under its real number, 3120') },
          { id: 'one', text: bi('Тоже под номером 1', 'Also under number 1') },
        ],
        resolve: () => 'real',
      },
    },
    { id: 'net', label: bi('У процесса своя сеть (--net)', 'The process has its own network (--net)'), kind: 'toggle', default: false, near: 'proc', group: bi('Какие стены стоят вокруг процесса', 'Which walls surround the process'), levels: ['intermediate', 'experienced'] },
    { id: 'grow', label: bi('На сколько мебибайт в секунду растёт память report-gen', 'How many MiB per second report-gen’s memory grows'), kind: 'range', min: 0, max: 40, step: 2, default: 8, unit: { ru: 'МиБ/с', en: 'MiB/s' }, near: 'proc', group: bi('Сколько ресурсов разрешено группе', 'How many resources the group may take') },
    {
      id: 'limit',
      label: bi('У группы есть лимит памяти (если выключить, в memory.max будет записано слово max)', 'The group has a memory limit (switched off, memory.max holds the word max)'),
      kind: 'toggle',
      default: true,
      near: 'mem',
      group: bi('Сколько ресурсов разрешено группе', 'How many resources the group may take'),
      predict: {
        prompt: bi('Вы снимаете лимит памяти, а report-gen продолжает расти, пока память не кончится у всей машины. На машине работает и база postgres, которая держит в памяти 600 МиБ, а report-gen к этому моменту займёт 460 МиБ. Какой процесс завершит ядро?', 'You remove the memory limit, and report-gen keeps growing until the whole machine runs out of memory. The machine also runs postgres, which holds 600 MiB, while report-gen will have taken 460 MiB by then. Which process does the kernel end?'),
        options: [
          { id: 'biggest', text: bi('Базу postgres, потому что она занимает больше всех и её оценка oom_score выше', 'postgres, because it takes the most and its oom_score is higher') },
          { id: 'report', text: bi('Обязательно report-gen, потому что память занял он', 'report-gen for sure, because it took the memory') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'neigh' || s.id === 'global') ? 'biggest' : 'report'),
      },
    },
    {
      id: 'memMax',
      label: bi('Лимит памяти группы (memory.max)', 'The group’s memory limit (memory.max)'),
      kind: 'range',
      min: 16,
      max: 512,
      step: 16,
      default: 64,
      unit: { ru: 'МиБ', en: 'MiB' },
      near: 'mem',
      group: bi('Сколько ресурсов разрешено группе', 'How many resources the group may take'),
      predict: {
        prompt: bi('Вы меняете лимит memory.max, а скорость роста памяти report-gen остаётся прежней. Дойдёт ли группа до нового лимита за минуту?', 'You change the memory.max limit while report-gen’s memory keeps growing at the same speed. Will the group reach the new limit within a minute?'),
        options: [
          { id: 'reach', text: bi('Дойдёт, и ядро завершит report-gen внутри группы', 'It will, and the kernel ends report-gen inside the group') },
          { id: 'fits', text: bi('Не дойдёт, и report-gen продолжит работать', 'It will not, and report-gen keeps working') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'oom') ? 'reach' : 'fits'),
      },
    },
    { id: 'cpu', label: bi('Доля процессора, разрешённая группе (cpu.max)', 'The CPU share allowed to the group (cpu.max)'), kind: 'range', min: 10, max: 100, step: 10, default: 100, unit: '%', near: 'cpu', group: bi('Сколько ресурсов разрешено группе', 'How many resources the group may take'), levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'no-fork',
      label: bi('Своя нумерация создана командой unshare --pid без флага --fork', 'The own numbering was created with unshare --pid without --fork'),
      remove: ['e-pids'],
      boundary: 'process',
      predict: {
        prompt: bi('Вы запустили `sudo unshare --pid bash` без флага --fork и выполнили в новой оболочке две команды подряд. Что произойдёт со второй командой?', 'You ran `sudo unshare --pid bash` without --fork and ran two commands in a row in the new shell. What happens to the second command?'),
        options: [
          { id: 'fail', text: bi('Оболочка не создаст для неё процесс и напишет «fork: Cannot allocate memory»', 'The shell will not create a process for it and prints “fork: Cannot allocate memory”') },
          { id: 'ok', text: bi('Вторая команда выполнится как обычно', 'The second command runs as usual') },
        ],
        resolve: () => 'fail',
      },
    },
    {
      id: 'no-cgroup',
      label: bi('Процесс запущен вне группы с лимитами', 'The process is started outside a group with limits'),
      remove: ['mem', 'e-mem'],
      boundary: 'process',
      predict: {
        prompt: bi('Процесс запущен вне группы, поэтому лимитов у него нет, а память report-gen растёт. Кто пострадает первым, когда память кончится?', 'The process is started outside a group, so it has no limits, and report-gen’s memory grows. Who suffers first when memory runs out?'),
        options: [
          { id: 'machine', text: bi('Вся машина, потому что ядро может завершить любой большой процесс', 'The whole machine, because the kernel may end any big process') },
          { id: 'only', text: bi('Только сам report-gen', 'Only report-gen itself') },
        ],
        resolve: () => 'machine',
      },
    },
  ],
  metrics: [
    { id: 'mem', label: bi('память группы', 'group memory'), unit: { ru: 'МиБ', en: 'MiB' } },
    { id: 'oom', label: bi('процессов завершено из-за памяти (oom_kill)', 'processes ended for memory (oom_kill)') },
    { id: 'walls', label: bi('стен вокруг процесса', 'walls around the process') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const walls = Number(p.uts) + Number(p.pid) + Number(p.net);
    const noLimit = broken.has('no-cgroup') || p.limit === false || p.memMax <= 0;
    const mr = memoryRun({ ...p, memMax: noLimit ? 0 : p.memMax });
    const maxLabel = noLimit ? 'max' : `${p.memMax} MiB`;
    // a wall that is switched off is not drawn at all: a pale frame would still read as a wall
    const wallStates = { 'w-uts': p.uts ? 'on' : 'hidden', 'w-pid': p.pid ? 'on' : 'hidden', 'w-net': p.net ? 'on' : 'hidden' } as const;
    steps.push({
      id: 'start',
      label: 'unshare',
      caption: walls
        ? fmtb(bi('Команда `unshare` запустила report-gen и поставила вокруг него стены, всего их {n}. Внутри стен работает обычный процесс того же ядра, но ядро отвечает ему иначе, чем остальным.', '`unshare` started report-gen and put {n} walls around it. Inside the walls runs an ordinary process of the same kernel; the kernel just answers it differently from the others.'), { n: walls })
        : bi('Стен вокруг процесса нет, поэтому report-gen видит всю машину: её имя, все её процессы и всю её сеть.', 'There are no walls around the process, so report-gen sees the whole machine: its name, all its processes and all its network.'),
      focus: ['proc'],
      say: { proc: walls ? fmtb(bi('Процесс report-gen запущен, и число стен вокруг него равно {n}.', 'report-gen is running, and the number of walls around it is {n}.'), { n: walls }) : bi('Процесс report-gen запущен без стен и видит всю машину.', 'report-gen runs without walls and sees the whole machine.') },
      states: { ...startWith('proc', 'host', 'kernel'), ...wallStates, proc: 'on' },
      values: { proc: p.pid ? t(bi('PID 1 внутри стен', 'PID 1 · inside')) : 'PID 3120', mem: `24 MiB / ${maxLabel}`, pids: '1 / 32', cpu: p.cpu >= 100 ? 'max 100000' : `${p.cpu * 1000} 100000`, host: 'hostname: trainer' },
      fill: { mem: noLimit ? 24 / 460 : 24 / p.memMax, pids: 1 / 32, cpu: 0 },
      metrics: { mem: 24, oom: 0, walls },
    });
    if (broken.has('no-fork') && p.pid) {
      steps.push({
        id: 'first',
        label: bi('первая команда', 'first command'),
        caption: bi('Без флага --fork сама оболочка осталась снаружи новой нумерации. Первым процессом нового пространства стал её первый дочерний процесс, то есть первая команда, и этот процесс завершился вместе с командой.', 'Without --fork the shell itself stayed outside the new numbering. The first process of the new namespace became its first child, the first command, and that process ended together with the command.'),
        focus: ['proc'],
        say: { proc: bi('Первая команда стала процессом номер 1 и сразу завершилась.', 'The first command became process 1 and ended at once.') },
        states: { proc: 'off' },
        metrics: { mem: 24, oom: 0, walls },
      });
      steps.push({
        id: 'no-fork',
        label: 'fork',
        caption: bi('Когда первый процесс пространства имён PID завершается, ядро закрывает это пространство, и создать в нём новый процесс уже нельзя. Поэтому вторая команда не запускается.', 'When the first process of a PID namespace ends, the kernel closes the namespace, and no new process can be created in it. So the second command does not start.'),
        focus: ['e-pids', 'pids'],
        reveal: ['pids', 'e-pids'],
        say: { pids: bi('Ядро отказывается создавать процесс в закрытом пространстве имён.', 'The kernel refuses to create a process in a closed namespace.') },
        states: { 'e-pids': 'err', pids: 'err' },
        metrics: { mem: 24, oom: 0, walls },
        broken: { at: 'e-pids', message: 'bash: fork: Cannot allocate memory', caption: bi('Поэтому флаг --pid почти всегда пишут вместе с --fork, и тогда первым процессом становится сама оболочка. Узнают эту поломку по тому, что первая команда сработала, а все следующие получают ошибку fork, хотя память на машине есть.', 'That is why --pid almost always comes with --fork, and then the shell itself becomes the first process. You recognise this break because the first command worked and every following one gets a fork error although the machine has memory.') },
      });
      return steps;
    }
    steps.push({
      id: 'inside',
      label: bi('изнутри', 'inside'),
      caption: fmtb(bi('Теперь посмотрите на машину изнутри стен. Команда `hostname` отвечает {h}, команда `ps` показывает {ps}, а `ip a` показывает {ip}.', 'Now look at the machine from inside the walls. `hostname` answers {h}, `ps` shows {ps}, and `ip a` shows {ip}.'), {
        h: p.uts ? 'report' : 'trainer',
        ps: p.pid ? bi('один процесс с номером 1', 'one process, number 1') : bi('все процессы машины', 'every process of the machine'),
        ip: p.net ? bi('только выключенный интерфейс lo', 'only the lo interface, down') : bi('интерфейсы машины lo и eth0', 'the machine’s lo and eth0'),
      }),
      focus: ['proc'],
      say: { proc: fmtb(bi('Изнутри report-gen видит имя машины {h} и {ps}.', 'From inside, report-gen sees the host name {h} and {ps}.'), { h: p.uts ? 'report' : 'trainer', ps: p.pid ? bi('только себя под номером 1', 'only itself as number 1') : bi('все процессы машины', 'every process of the machine') }) },
      states: { ...wallStates },
      metrics: { mem: 24, oom: 0, walls },
    });
    steps.push({
      id: 'outside',
      label: bi('снаружи', 'outside'),
      caption: bi('Снаружи всё осталось прежним: `hostname` отвечает trainer, а report-gen виден в `ps aux` под своим настоящим номером 3120. Стены непрозрачны только изнутри, и рядом на той же машине работает база данных postgres.', 'Outside nothing changed: `hostname` answers trainer, and report-gen shows up in `ps aux` under its real number, 3120. The walls are opaque only from inside, and the database postgres runs next to it on the same machine.'),
      focus: ['host', 'e-view'],
      reveal: ['e-view', 'neigh'],
      tokens: [{ edge: 'e-view', label: 'PID 3120' }],
      say: { host: bi('Оболочка на машине видит report-gen под номером 3120 и настоящее имя машины trainer.', 'The shell on the machine sees report-gen as 3120 and the real host name trainer.') },
      metrics: { mem: 24, oom: 0, walls },
    });
    if (p.cpu < 100) {
      steps.push({
        id: 'cpu',
        label: 'cpu.max',
        caption: fmtb(bi('В файле cpu.max записано {q} 100000, поэтому в каждом периоде длиной 100 мс группе достаётся {c}% процессора. Остальное время процесс ждёт своей очереди, и ядро его не завершает, а только притормаживает.', 'cpu.max holds {q} 100000, so in every 100 ms period the group gets {c}% of a CPU. For the rest of the time the process waits its turn, and the kernel does not end it but only slows it down.'), { q: p.cpu * 1000, c: p.cpu }),
        focus: ['e-cpu', 'cpu'],
        reveal: ['cpu', 'e-cpu'],
        tokens: [{ edge: 'e-cpu', label: fmtb(bi('{c}% процессора', '{c}% of a CPU'), { c: p.cpu }) }],
        say: { cpu: fmtb(bi('Ядро даёт группе {c} мс работы из каждых 100 мс.', 'The kernel gives the group {c} ms of work out of every 100 ms.'), { c: p.cpu }) },
        fill: { cpu: p.cpu / 100 },
        values: { cpu: `${p.cpu * 1000} 100000 · ${t(bi('притормаживается', 'throttled'))}` },
        metrics: { mem: 24, oom: 0, walls },
      });
    }
    const grow = (t: number) => Math.min(mr.peak, 24 + p.grow * t);
    const memReveal = noLimit ? [] : ['mem', 'e-mem'];
    if (p.grow > 0) {
      const mid = Math.max(1, Math.floor((mr.killedAt ?? 20) / 2));
      steps.push({
        id: 'grow',
        label: bi('рост памяти', 'memory grows'),
        caption: fmtb(bi('Память report-gen растёт на {g} МиБ в секунду. Через {t} с группа занимает {m} МиБ, а разрешено ей {x}.', 'report-gen’s memory grows by {g} MiB per second. After {t} s the group takes {m} MiB, and it is allowed {x}.'), { g: p.grow, t: mid, m: Math.round(grow(mid)), x: noLimit ? bi('сколько угодно', 'any amount') : maxLabel }),
        focus: noLimit ? ['proc'] : ['e-mem', 'mem'],
        reveal: memReveal,
        tokens: noLimit ? [] : [{ edge: 'e-mem', label: `+${p.grow} MiB/s` }],
        say: noLimit ? { proc: bi('Процесс report-gen берёт всё больше памяти, и никакой лимит его не сдерживает.', 'report-gen takes more and more memory, and no limit holds it back.') } : { mem: fmtb(bi('Группа занимает уже {m} МиБ из разрешённых {x}.', 'The group already takes {m} MiB of the {x} allowed.'), { m: Math.round(grow(mid)), x: maxLabel }) },
        values: { mem: `${Math.round(grow(mid))} MiB / ${maxLabel}` },
        fill: { mem: noLimit ? grow(mid) / 460 : Math.min(1, grow(mid) / p.memMax) },
        metrics: { mem: Math.round(grow(mid)), oom: 0, walls },
      });
    }
    if (mr.killedAt === null) {
      steps.push({
        id: 'fits',
        label: p.grow > 0 ? bi('в пределах лимита', 'within the limit') : bi('работа за стенами', 'work behind the walls'),
        caption: p.grow > 0 ? bi('За минуту память так и не дошла до лимита. Процесс продолжает работать, и соседи ничего не замечают.', 'Within a minute the memory never reached the limit. The process keeps working, and the neighbours notice nothing.') : bi('Процесс работает внутри своих стен и новой памяти не берёт, поэтому соседи ничего не замечают.', 'The process works inside its walls and takes no new memory, so the neighbours notice nothing.'),
        focus: ['proc'],
        reveal: p.grow > 0 ? memReveal : [],
        say: { proc: p.grow > 0 ? bi('Процессу хватает разрешённой памяти, и он спокойно работает дальше.', 'The allowed memory is enough for the process, and it keeps working.') : bi('Процесс report-gen работает за своими стенами и не мешает соседям.', 'report-gen works behind its walls and does not disturb the neighbours.') },
        states: noLimit || p.grow <= 0 ? {} : { mem: 'ok' },
        metrics: { mem: Math.round(mr.peak), oom: 0, walls },
      });
      return steps;
    }
    if (noLimit) {
      steps.push({
        id: 'global',
        label: 'OOM',
        caption: fmtb(bi('Лимита нет, и через {t} с память кончилась у всей машины: report-gen занял {m} МиБ. Общий OOM killer выбирает процесс с самой высокой оценкой oom_score, а она растёт вместе с занятой памятью. База данных postgres держит 600 МиБ, больше, чем report-gen, поэтому ядро завершает её, хотя она ни в чём не виновата.', 'There is no limit, and after {t} s the whole machine runs out of memory: report-gen has taken {m} MiB. The machine-wide OOM killer picks the process with the highest oom_score, and the score grows with the memory taken. The postgres database holds 600 MiB, more than report-gen, so the kernel ends it, although it is not to blame.'), { t: mr.killedAt, m: Math.round(mr.peak) }),
        focus: ['neigh', 'e-neigh'],
        reveal: ['e-neigh'],
        tokens: [{ edge: 'e-neigh', label: 'KILL' }],
        say: { neigh: bi('Ядро завершило базу данных сигналом KILL, потому что с её 600 МиБ она оказалась самым большим процессом машины.', 'The kernel ended the database with KILL, because with its 600 MiB it was the biggest process of the machine.') },
        states: { neigh: 'err', proc: 'warn' },
        values: { neigh: t(bi('завершён ядром', 'killed')), mem: `${Math.round(mr.peak)} MiB / max` },
        fill: { mem: 1 },
        metrics: { mem: Math.round(mr.peak), oom: 1, walls },
        broken: { at: 'neigh', message: 'Out of memory: Killed process 811 (postgres) total-vm:1228800kB, anon-rss:614400kB, file-rss:0kB, shmem-rss:0kB, UID:999', caption: bi('Без лимита страдает не тот процесс, который занял память, а самый большой процесс машины, поэтому лимит памяти защищает соседей. Узнают такую поломку по строке «Out of memory: Killed process» в `dmesg`, где назван не тот процесс, который рос.', 'Without a limit it is not the process that took the memory that suffers but the biggest one on the machine, so a memory limit protects the neighbours. You recognise this break by the line “Out of memory: Killed process” in `dmesg` naming a process other than the one that grew.') },
      });
      return steps;
    }
    steps.push({
      id: 'oom',
      label: 'OOM',
      caption: fmtb(bi('Через {t} с группа дошла до лимита memory.max, равного {x}. Ядро не даёт памяти сверх лимита и запускает OOM killer внутри группы, и тот завершает report-gen сигналом KILL с кодом 137. В файле memory.events счётчик oom_kill становится равен 1.', 'After {t} s the group reached memory.max, {x}. The kernel gives no memory beyond the limit and runs the OOM killer inside the group, which ends report-gen with KILL, code 137. In memory.events the oom_kill counter becomes 1.'), { t: mr.killedAt, x: maxLabel }),
      focus: ['proc', 'mem'],
      say: { mem: bi('Ядро видит, что группа дошла до лимита, и завершает её самый большой процесс.', 'The kernel sees the group reached its limit and ends its biggest process.') },
      states: { proc: 'err', mem: 'err' },
      values: { proc: t(bi('завершён, код 137', 'killed (137)')), mem: `${p.memMax} MiB / ${maxLabel}` },
      fill: { mem: 1 },
      metrics: { mem: p.memMax, oom: 1, walls },
    });
    steps.push({
      id: 'neighbour',
      label: bi('соседи', 'neighbours'),
      caption: bi('С соседней базой данных ничего не случилось, потому что память у машины так и не кончилась. В выводе `dmesg` осталась строка «Memory cgroup out of memory: Killed process 3120 (report-gen)».', 'Nothing happened to the neighbouring database, because the machine never ran out of memory. `dmesg` keeps the line “Memory cgroup out of memory: Killed process 3120 (report-gen)”.'),
      focus: ['neigh'],
      say: { neigh: bi('База данных продолжает работать и не заметила, что report-gen завершён.', 'The database keeps working and did not notice that report-gen was ended.') },
      states: { neigh: 'ok' },
      metrics: { mem: 0, oom: 1, walls },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    void prev;
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и процесс снова работает так, как задают параметры.', 'The break is removed, and the process again works as the parameters say.');
      return change.id === 'no-fork' ? bi('Без флага --fork первым процессом нового пространства стала первая команда и сразу завершилась. Пространство закрылось, и следующая попытка создать в нём процесс не удаётся.', 'Without --fork the first command became the first process of the new namespace and ended at once. The namespace closed, and the next attempt to create a process in it fails.') : bi('Без группы с лимитом процесс берёт общую память машины, и когда она кончится, OOM killer будет выбирать жертву среди всех процессов машины.', 'Without a group with a limit the process takes the machine’s shared memory, and when it runs out, the OOM killer picks its victim among all processes of the machine.');
    }
    const last = next[next.length - 1];
    switch (change.id) {
      case 'uts':
        return b.uts ? bi('С флагом --uts у процесса своё имя машины, и команда `hostname report` внутри не меняет имя снаружи.', 'With --uts the process has its own host name, and `hostname report` inside does not change the name outside.') : bi('Без флага --uts имя машины общее, и если сменить его внутри, оно сменится для всех.', 'Without --uts the host name is shared, and renaming inside would rename it for everyone.');
      case 'pid':
        return b.pid ? bi('С флагами --pid --fork --mount-proc внутри report-gen получает номер 1, и ps видит только его, а снаружи он по-прежнему имеет номер 3120.', 'With --pid --fork --mount-proc report-gen gets number 1 inside and ps sees only it, while outside it is still 3120.') : bi('Без флага --pid внутри видны все процессы машины с их настоящими номерами.', 'Without --pid every process of the machine is visible inside, with its real number.');
      case 'net':
        return b.net ? bi('С флагом --net у процесса свой сетевой стек, в котором есть только выключенный интерфейс lo.', 'With --net the process has its own network stack with only the lo interface, down.') : bi('Без флага --net процесс пользуется сетью машины.', 'Without --net the process uses the machine’s network.');
      case 'limit':
        return b.limit === false
          ? bi('Лимит памяти снят, и в memory.max теперь записано слово max. Когда память кончится, OOM killer будет выбирать среди всех процессов машины.', 'The memory limit is removed, and memory.max now holds the word max. When memory runs out, the OOM killer picks among all processes of the machine.')
          : fmtb(bi('Лимит памяти снова действует, и в memory.max записано {x} МиБ.', 'The memory limit applies again, and memory.max holds {x} MiB.'), { x: Number(b.memMax) });
      case 'memMax':
        return b.limit === false
          ? fmtb(bi('На ручке теперь стоит {b} МиБ, но лимит выключен, и в memory.max по-прежнему записано слово max.', 'The number on the knob changed to {b} MiB, but the limit is switched off, and memory.max still holds the word max.'), { b: Number(b.memMax) })
          : fmtb(bi('Лимит памяти изменился с {a} на {b} МиБ, и теперь {r}.', 'The memory limit changed from {a} to {b} MiB, and now {r}.'), { a: Number(a.memMax), b: Number(b.memMax), r: last?.id === 'fits' ? bi('за минуту группа до лимита не доходит', 'the group does not reach the limit within a minute') : bi('группа рано или поздно дойдёт до лимита', 'the group will reach the limit sooner or later') });
      case 'grow':
        return fmtb(bi('Память теперь растёт на {g} МиБ в секунду, и {r}.', 'Memory now grows by {g} MiB per second, and {r}.'), { g: Number(b.grow), r: next.some((s) => s.id === 'oom' || s.id === 'global') ? bi('лимит будет достигнут', 'the limit will be reached') : bi('лимит не достигается', 'the limit is not reached') });
      case 'cpu':
        return fmtb(bi('Группе разрешено {c}% процессора. Процесс работает медленнее, но продолжает работать, потому что сверх квоты ядро процессор не даёт, и процессу приходится ждать следующего периода.', 'The group is allowed {c}% of a CPU. The process works more slowly but keeps working, because the kernel gives no CPU beyond the quota, and the process has to wait for the next period.'), { c: Number(b.cpu) });
    }
    return bi('Параметр изменился, и картина пересчитана заново.', 'The parameter changed, and the picture was recomputed.');
  },
});
