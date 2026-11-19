// X4 (04 §6.5, R7c): bare metal → virtual machines → containers. Three
// towers of layers on servers of the same size; a slider of applications
// recomputes memory, start time and overhead at once; toggles show the
// library conflict, a kernel vulnerability and a program that needs another
// kernel; breaks take out the shared hypervisor or the shared kernel.
//
// Reading order: the picture is built from zero. At the start only the first
// server is on the diagram, with its two applications and their library
// conflict. The tower of virtual machines grows next to it from the hardware
// up, then the tower of containers; every acting block says in a callout what
// it does, and what it hands on travels along the line as a card. The
// counters under the diagram appear together with the tower they count.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { fmtb, man, startWith } from './util';

type P = { apps: number; conflict: boolean; vuln: boolean; otherKernel: boolean };

/** The model of the counters, open to the learner on the cards (and tested). */
export const STACK = {
  serverMiB: 16 * 1024,
  hostOsMiB: 1024,
  appMiB: 256,
  guestOsMiB: 1024,
  containerOverheadMiB: 10,
  vmBootMs: 25_000,
  containerStartMs: 300,
};

export function stackNumbers(apps: number) {
  const s = STACK;
  const free = s.serverMiB - s.hostOsMiB;
  const vmEach = s.guestOsMiB + s.appMiB;
  const ctEach = s.appMiB + s.containerOverheadMiB;
  const vmFit = Math.floor(free / vmEach);
  const ctFit = Math.floor(free / ctEach);
  const vmRun = Math.min(apps, vmFit);
  const ctRun = Math.min(apps, ctFit);
  return {
    vmFit,
    ctFit,
    vmMem: s.hostOsMiB + vmRun * vmEach,
    ctMem: s.hostOsMiB + ctRun * ctEach,
    vmOverhead: Math.round(3 + vmRun * 0.8),
    ctOverhead: Math.round(1 + ctRun * 0.05),
    vmStart: s.vmBootMs,
    ctStart: s.containerStartMs,
    vmOut: apps > vmFit ? vmFit + 1 : 0,
    ctOut: apps > ctFit ? ctFit + 1 : 0,
  };
}

const ALL = ['headroom', 'bm-apps', 'bm-os', 'bm-hw', 'e-bm-sys', 'e-bm-hw', 'vm-apps', 'vm-guest', 'vm-hyp', 'vm-hw', 'e-vm-sys', 'e-vm-virt', 'e-vm-hw', 'ct-apps', 'ct-rt', 'ct-kernel', 'ct-hw', 'e-ct-sys', 'e-ct-rt', 'e-ct-hw'];

const HW = (what: Bi) => ({ what, who: bi('Сервер стоит в стойке дата-центра, а обслуживают его администраторы дата-центра.', 'It sits in a data-centre rack and the data-centre staff look after it.'), see: 'lscpu; free -h' });
const COL = { bm: 24, vm: 340, ct: 656 };
const ROW = { apps: 208, mid: 296, base: 384, hw: 472 };
const W = 280;
const H = 56;

export const stackModel = defineModel<P>({
  id: 'containers.stack',
  block: 'containers',
  title: bi('Один сервер, виртуальные машины и контейнеры', 'Bare metal, virtual machines, containers'),
  summary: bi(
    'На схеме стоят три одинаковых сервера, по 16 ГиБ памяти у каждого. На первом два приложения работают в одной системе и мешают друг другу, на втором каждое приложение получает свою виртуальную машину, на третьем свой контейнер. Счётчики под схемой показывают, сколько памяти и времени стоит каждое решение.',
    'Three servers of the same size, 16 GiB of memory each. On the first, two applications share one system and get in each other’s way; on the second, each application gets its own virtual machine; on the third, its own container. The counters under the diagram show what each solution costs in memory and time.',
  ),
  intro: bi(
    'Сейчас на схеме только первый сервер, на котором два приложения работают в одной системе. Нажмите «Начать с первого шага», а дальше переходите от шага к шагу кнопкой «Шаг вперёд». Рядом вырастут ещё две башни, снизу вверх, от железа к приложениям. Подсвечен тот блок, который работает на этом шаге, облачко рядом с ним говорит, что он делает, а карточка на линии показывает, что он передаёт дальше.\n\nКогда дойдёте до конца, доведите в «Параметрах» число приложений до 30 и посмотрите на счётчики памяти, а потом включите уязвимость в ядре.',
    'Now the diagram shows only the first server, where two applications run in one system. Press “Start from the first step”, then go from step to step with “Step forward”. Two more towers grow next to it, from the hardware up to the applications. The block working at this step is highlighted, the callout next to it says what it does, and the card on the line shows what it hands on.\n\nWhen you reach the end, move the number of applications in “Parameters” up to 30 and watch the memory counters, then switch on the kernel vulnerability.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('что блок передаёт дальше, например запрос библиотеки или системный вызов', 'what the block hands on, such as a library request or a system call') },
    { mark: 'icon:process', text: bi('программа, то есть приложение или рантайм Docker', 'a program, that is an application or the Docker runtime') },
    { mark: 'icon:container', text: bi('контейнер', 'a container') },
    { mark: 'icon:terminal', text: bi('операционная система и её ядро', 'an operating system and its kernel') },
    { mark: 'icon:cloud', text: bi('гипервизор, который делит сервер на виртуальные машины', 'the hypervisor, which divides a server into virtual machines') },
    { mark: 'icon:server', text: bi('физический сервер', 'a physical server') },
    { mark: 'ok', text: bi('приложения работают', 'the applications run') },
    { mark: 'err', text: bi('здесь что-то сломалось', 'something broke here') },
    { mark: 'warn', text: bi('эта часть под угрозой', 'this part is at risk') },
  ],
  stopLabel: bi('Всё остановилось', 'Everything stopped'),
  concepts: ['docker.env-problem', 'docker.vm', 'docker.container', 'docker.vm-vs-container'],
  diagram: {
    width: 960,
    height: 548,
    nodes: [
      // Never shown: it keeps free room above the towers, so the callout of a top node has space above it.
      { id: 'headroom', label: '', family: 'obj', x: COL.vm, y: ROW.apps - 88, w: W, h: 8, card: { what: bi('Свободное место над башнями.', 'Free room above the towers.'), who: bi('Его оставляет схема.', 'The diagram keeps it.') } },
      { id: 'bm-apps', label: bi('Приложения A и B', 'Apps A and B'), icon: 'process', sub: 'libssl 1.1 · 3.0', family: 'process', x: COL.bm, y: ROW.apps, w: W, h: H, card: { what: bi('Две программы работают в одной системе. Обе загружают библиотеку libssl из общего каталога `/usr/lib`, поэтому, если приложению A нужна версия 1.1, а приложению B версия 3.0, обновление для одного ломает другое.', 'Two programs on one system. Both load libssl from the same `/usr/lib`: if A needs version 1.1 and B needs 3.0, an upgrade for one breaks the other.'), who: bi('Администратор ставит их пакетами прямо в систему сервера.', 'An administrator installs them as packages straight into the server’s system.'), see: 'ldd /usr/bin/app-a' } },
      { id: 'bm-os', label: bi('Система сервера', 'The server’s system'), icon: 'terminal', sub: 'Linux 6.12 · /usr/lib', family: 'kernel', x: COL.bm, y: ROW.base, w: W, h: H, card: { what: bi('На весь сервер работает одна операционная система с одним ядром, одним набором библиотек и одним списком процессов. Всё, что в ней установлено, видят все программы сразу.', 'One operating system for the whole server: one kernel, one set of libraries, one list of processes. Everything installed in it is seen by every program.'), who: bi('Систему устанавливают на сервер один раз.', 'Installed on the server once.'), see: 'uname -r; cat /etc/os-release' } },
      { id: 'bm-hw', label: bi('Сервер без изоляции', 'Server without isolation'), icon: 'server', sub: '16 GiB · 8 CPU', family: 'node', shape: 'rack', x: COL.bm, y: ROW.hw, w: W, h: H, card: HW(bi('Физическая машина состоит из процессоров, памяти, дисков и сетевых карт. Без виртуализации всеми её ресурсами распоряжается одна система.', 'The physical machine: CPUs, memory, disks, network cards. Without virtualisation one system owns all of it.')) },
      { id: 'vm-apps', label: bi('Приложение в каждой ВМ', 'An app in each VM'), icon: 'process', sub: '× 4', family: 'process', x: COL.vm, y: ROW.apps, w: W, h: H, card: { what: bi('В каждой виртуальной машине работает одно приложение со своими библиотеками. Конфликта версий нет, потому что системы у приложений разные.', 'Each virtual machine has its own application with its own libraries. No version conflict: the systems are separate.'), who: bi('Приложение ставят в гостевую систему так же, как на отдельный сервер.', 'Installed in the guest OS, as on a separate server.') } },
      { id: 'vm-guest', label: bi('Гостевая система', 'Guest system'), icon: 'terminal', sub: 'Linux 6.12 · 1 GiB', family: 'user', x: COL.vm, y: ROW.mid, w: W, h: H, card: { what: bi('Внутри каждой виртуальной машины работает полноценная операционная система со своим ядром, init, службами и библиотеками. Она занимает около гигабайта памяти, даже когда приложение ничего не делает, а при запуске ВМ загружается десятки секунд.', 'A whole operating system inside each VM: its own kernel, init, services, libraries. It holds about a gigabyte of memory even when the application sleeps, and it boots for tens of seconds when the VM starts.'), who: bi('Систему устанавливают в ВМ с образа диска.', 'Installed into the VM from a disk image.'), see: 'uname -r   # inside the VM' } },
      { id: 'vm-hyp', label: bi('Гипервизор', 'Hypervisor'), icon: 'cloud', sub: 'KVM · QEMU', family: 'cp', x: COL.vm, y: ROW.base, w: W, h: H, card: { what: bi('Гипервизором называют программу, которая делит железо между виртуальными машинами и показывает каждой её собственные процессоры, память и устройства. Гипервизор первого типа работает прямо на железе, второго типа — как программа внутри обычной системы. Модуль ядра Linux под названием KVM превращает само ядро в гипервизор.', 'A program that divides the hardware between VMs and shows each one virtual CPUs, memory and devices. Type 1 runs on the hardware itself, type 2 as a program inside an ordinary OS; KVM is a module that turns the Linux kernel into a hypervisor.'), who: bi('Гипервизор ставят на сервер вместо обычной системы или поверх неё.', 'Installed on the server instead of an ordinary OS or on top of it.'), see: 'lsmod | grep kvm', doc: { url: 'https://www.linux-kvm.org/page/Main_Page', label: 'linux-kvm.org' } } },
      { id: 'vm-hw', label: bi('Сервер с гипервизором', 'Server with a hypervisor'), icon: 'server', sub: '16 GiB · 8 CPU', family: 'node', shape: 'rack', x: COL.vm, y: ROW.hw, w: W, h: H, card: HW(bi('Такой же сервер, как первый. Его память гипервизор раздаёт виртуальным машинам целыми кусками, и каждой нужно хватить и на гостевую систему, и на приложение.', 'The same server. Its memory is cut into whole pieces for the VMs: each gets an OS plus an application.')) },
      { id: 'ct-apps', label: bi('Контейнеры A и B', 'Containers A and B'), icon: 'container', sub: '× 4', family: 'ns', x: COL.ct, y: ROW.apps, w: W, h: H, card: { what: bi('Каждый контейнер остаётся обычным процессом хоста со своим набором файлов, а значит, и со своей libssl. Процесс работает в своих пространствах имён и в своей cgroup. Ядро видит в нём обычный процесс, а сам процесс видит только свои файлы, процессы и сеть.', 'Each container is an ordinary host process with its own set of files (its own libraries — its own libssl), in its own namespaces and its own cgroup. The kernel sees a process; the process sees only “its own”.'), who: bi('Контейнер запускает рантайм, когда его об этом просит Docker.', 'The container runtime starts it when Docker asks.'), see: 'docker ps; ps -ef --forest', doc: man('namespaces', 7) } },
      { id: 'ct-rt', label: bi('Рантайм Docker', 'Container runtime'), icon: 'process', sub: 'dockerd · containerd · runc', family: 'cp', x: COL.ct, y: ROW.mid, w: W, h: H, card: { what: bi('Рантайм Docker состоит из обычных программ на хосте. Они готовят файлы контейнера и просят ядро создать процесс в новых пространствах имён и с лимитами. В работу уже запущенного контейнера они не вмешиваются.', 'Ordinary programs on the host. They prepare the files and ask the kernel to create a process in new namespaces with limits. They do not take part in the container’s work.'), who: bi('Рантайм устанавливается вместе с пакетом Docker Engine.', 'Installed as the Docker Engine package.'), see: 'systemctl status docker' } },
      { id: 'ct-kernel', label: bi('Одно ядро хоста', 'One host kernel'), icon: 'terminal', sub: 'Linux 6.12', family: 'kernel', x: COL.ct, y: ROW.base, w: W, h: H, card: { what: bi('На все контейнеры сервера работает одно ядро. Пространства имён решают, что процесс видит, а cgroup — сколько памяти и процессора он может взять. Граница между контейнерами проходит внутри этого одного ядра.', 'One kernel for all containers. Namespaces decide what a process sees, cgroups how much it may consume. The isolation boundary runs inside this one kernel.'), who: bi('Ядро загружается вместе с сервером.', 'Boots with the server.'), see: 'uname -r; docker run --rm alpine uname -r', doc: man('cgroups', 7) } },
      { id: 'ct-hw', label: bi('Сервер с контейнерами', 'Server with containers'), icon: 'server', sub: '16 GiB · 8 CPU', family: 'node', shape: 'rack', x: COL.ct, y: ROW.hw, w: W, h: H, card: HW(bi('Такой же сервер, как первые два. Контейнеры берут память по мере надобности, а лимит cgroup задаёт потолок, а не заранее отрезанный кусок.', 'The same server. Containers take memory as they use it; a cgroup limit is a ceiling, not a reserved piece.')) },
    ],
    edges: [
      { id: 'e-bm-sys', from: 'bm-apps', to: 'bm-os', label: bi('системные вызовы', 'system calls'), card: { what: bi('Программы обращаются к ядру напрямую, чтобы открыть файл, загрузить библиотеку, создать процесс или отправить пакет.', 'Programs talk to the kernel directly: open a file, create a process, send a packet.'), who: bi('К ядру обращается каждая программа на сервере.', 'Every program.'), doc: man('syscalls', 2) } },
      { id: 'e-bm-hw', from: 'bm-os', to: 'bm-hw', label: bi('драйверы', 'drivers'), card: { what: bi('Ядро управляет железом через драйверы.', 'The kernel drives the hardware through drivers.'), who: bi('Драйверы входят в ядро.', 'The kernel.') } },
      { id: 'e-vm-sys', from: 'vm-apps', to: 'vm-guest', label: bi('системные вызовы', 'system calls'), card: { what: bi('Приложение в ВМ обращается к своему, гостевому ядру, а не к ядру сервера.', 'An application in a VM talks to its own guest kernel.'), who: bi('К гостевому ядру обращается приложение внутри ВМ.', 'The application.') } },
      { id: 'e-vm-virt', from: 'vm-guest', to: 'vm-hyp', label: bi('виртуальное железо', 'virtual hardware'), card: { what: bi('Гостевое ядро считает, что управляет настоящим железом, а на деле его команды перехватывает гипервизор.', 'The guest kernel believes it drives real hardware; its commands are actually caught by the hypervisor.'), who: bi('Команды перехватывает гипервизор с помощью аппаратной виртуализации процессора (VT-x, AMD-V).', 'The hypervisor and the CPU’s hardware virtualisation (VT-x, AMD-V).') } },
      { id: 'e-vm-hw', from: 'vm-hyp', to: 'vm-hw', label: 'VT-x · AMD-V', card: { what: bi('Гипервизор пользуется аппаратной поддержкой виртуализации в процессоре.', 'The hypervisor uses the CPU’s hardware support for virtualisation.'), who: bi('Поддержку включают в настройках сервера.', 'The hypervisor.') } },
      { id: 'e-ct-rt', from: 'ct-rt', to: 'ct-kernel', label: 'clone · cgroup', card: { what: bi('Рантайм просит ядро создать процесс в новых пространствах имён (системный вызов clone с флагами CLONE_NEW*) и ставит этот процесс в cgroup с лимитами.', 'The runtime asks the kernel to create a process in new namespaces (clone with CLONE_NEW* flags) and puts it into a cgroup with limits.'), who: bi('Эти вызовы делает runc по поручению containerd.', 'runc, asked by containerd.'), doc: man('clone', 2) } },
      { id: 'e-ct-sys', from: 'ct-apps', to: 'ct-kernel', via: [[996, 236], [996, 412]], label: bi('системные вызовы', 'system calls'), labelAt: 0.5, card: { what: bi('Процесс контейнера обращается прямо к ядру хоста, без гостевого ядра и без гипервизора. Поэтому контейнер и запускается за доли секунды.', 'A container process talks straight to the host kernel — no guest kernel, no hypervisor. That is why it starts in a fraction of a second.'), who: bi('К ядру хоста обращается само приложение в контейнере.', 'The application in the container.') } },
      { id: 'e-ct-hw', from: 'ct-kernel', to: 'ct-hw', label: bi('драйверы', 'drivers'), card: { what: bi('Здесь всё так же, как на первом сервере: одно ядро управляет железом через один набор драйверов.', 'As on bare metal: one kernel, one set of drivers.'), who: bi('Драйверы входят в ядро.', 'The kernel.') } },
    ],
  },
  params: [
    {
      id: 'apps',
      label: bi('Сколько приложений нужно запустить на каждом сервере', 'Number of applications'),
      kind: 'range',
      min: 1,
      max: 50,
      step: 1,
      default: 4,
      near: 'vm-apps',
      group: bi('Что нужно запустить', 'What has to run'),
      predict: {
        prompt: bi('Вы меняете число приложений. У сервера 16 ГиБ памяти, и каждой виртуальной машине нужен 1 ГиБ на гостевую систему и ещё 256 МиБ на приложение. Поместятся ли все виртуальные машины?', 'You change the number of applications. The server has 16 GiB; each VM needs 1 GiB for its guest system plus 256 MiB for the application. Will all the VMs fit?'),
        options: [
          { id: 'mem', text: bi('Нет, памяти сервера на все ВМ не хватит', 'No: the server runs out of memory') },
          { id: 'ok', text: bi('Да, поместятся все, как и контейнеры', 'Yes, all of them fit, like the containers') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.vmOut ?? 0) > 0 ? 'mem' : 'ok'),
      },
    },
    { id: 'conflict', label: bi('Приложениям A и B нужны разные версии libssl', 'A and B need different versions of libssl'), kind: 'toggle', default: true, near: 'bm-apps', group: bi('Что нужно запустить', 'What has to run') },
    {
      id: 'otherKernel',
      label: bi('Одна из программ написана для Windows', 'An application needs another kernel (a Windows program)'),
      kind: 'toggle',
      default: false,
      near: 'ct-apps',
      group: bi('Что нужно запустить', 'What has to run'),
      predict: {
        prompt: bi('Программа написана для Windows, а все три сервера работают на ядре Linux. Где её можно запустить?', 'The program is written for Windows, and all three servers run a Linux kernel. Where can it run?'),
        options: [
          { id: 'vm', text: bi('Только в виртуальной машине, куда можно поставить Windows со своим ядром', 'Only in a VM, which can hold Windows with its own kernel') },
          { id: 'both', text: bi('И в контейнере, если положить в его образ файлы Windows', 'In a container too, if you put Windows files into its image') },
        ],
        resolve: (_p, next) => (next.some((s) => s.states?.['ct-apps'] === 'err') ? 'vm' : 'both'),
      },
    },
    {
      id: 'vuln',
      label: bi('В ядре Linux нашли уязвимость, через которую процесс выходит за свои границы', 'A kernel vulnerability'),
      kind: 'toggle',
      default: false,
      near: 'ct-kernel',
      group: bi('Что случилось с ядром', 'What happened to the kernel'),
      predict: {
        prompt: bi('Уязвимость нашли в ядре Linux, и злоумышленник запустил вредный код в одном контейнере на третьем сервере. Какие контейнеры этого сервера под угрозой?', 'A kernel vulnerability lets a process escape its boundaries, and an attacker runs code in one container of the third server. Which containers of that server are at risk?'),
        options: [
          { id: 'ct-all', text: bi('Все контейнеры сервера, потому что ядро у них одно', 'All containers of the server: they share the kernel') },
          { id: 'same', text: bi('Только тот контейнер, в котором запущен вредный код', 'Only the container running the malicious code') },
        ],
        resolve: () => 'ct-all',
      },
    },
  ],
  breaks: [
    {
      id: 'hyp-down',
      label: bi('Процесс гипервизора на втором сервере завершился', 'Stop the hypervisor'),
      remove: ['vm-hyp', 'e-vm-virt', 'e-vm-hw'],
      boundary: 'kernel',
      predict: {
        prompt: bi('Процесс гипервизора на втором сервере завершился, а гостевые системы в самих ВМ исправны. Что будет с виртуальными машинами?', 'The hypervisor stopped while the guest systems themselves are fine. What happens to the virtual machines?'),
        options: [
          { id: 'all', text: bi('Остановятся все ВМ этого сервера, потому что все они работают внутри гипервизора', 'All of them stop: they run inside it') },
          { id: 'none', text: bi('Продолжат работать, потому что у каждой ВМ своё ядро', 'They keep running: each has its own kernel') },
        ],
        resolve: () => 'all',
      },
    },
    {
      id: 'kernel-panic',
      label: bi('Ядро третьего сервера завершилось аварийно (kernel panic)', 'Kernel panic on the container host'),
      remove: ['ct-kernel', 'e-ct-sys', 'e-ct-rt'],
      boundary: 'kernel',
      predict: {
        prompt: bi('Ядро третьего сервера, на котором работают контейнеры, завершилось аварийно. Сколько контейнеров продолжат работать?', 'The kernel of the container host crashed. How many containers keep running?'),
        options: [
          { id: 'zero', text: bi('Ни одного, потому что своего ядра у контейнеров нет', 'None: they have no kernel of their own') },
          { id: 'most', text: bi('Все, кроме одного, в котором случился сбой', 'All but the one where the failure happened') },
        ],
        resolve: () => 'zero',
      },
    },
  ],
  metrics: [
    { id: 'vmMem', label: bi('занято памяти на сервере с ВМ', 'VM memory'), unit: 'MiB' },
    { id: 'ctMem', label: bi('занято памяти на сервере с контейнерами', 'container memory'), unit: 'MiB' },
    { id: 'vmStart', label: bi('время запуска ещё одной ВМ', 'time to start one more VM'), unit: 'ms' },
    { id: 'ctStart', label: bi('время запуска ещё одного контейнера', 'time to start one more container'), unit: 'ms' },
    { id: 'vmOverhead', label: bi('доля процессора на служебную работу ВМ', 'CPU share spent on VM overhead'), unit: '%' },
    { id: 'ctOverhead', label: bi('доля процессора на служебную работу контейнеров', 'CPU share spent on container overhead'), unit: '%' },
  ],
  run(p, broken): Step[] {
    const n = stackNumbers(p.apps);
    const vmRun = Math.min(p.apps, n.vmFit);
    const ctRun = Math.min(p.apps, n.ctFit);
    const vmM = { vmMem: n.vmMem, vmStart: n.vmStart, vmOverhead: n.vmOverhead, vmOut: n.vmOut };
    const all = { ...vmM, ctMem: n.ctMem, ctStart: n.ctStart, ctOverhead: n.ctOverhead };
    const count = (x: number, fit: number) => (x > fit ? `× ${fit} / ${x}` : `× ${x}`);
    const steps: Step[] = [
      {
        id: 'bare',
        label: bi('сервер', 'server'),
        caption: bi(
          'Начнём с сервера без всякой изоляции. В его единственной операционной системе работают два приложения, A и B, и обе программы загружают библиотеку libssl из общего каталога `/usr/lib`.',
          'We start with a server without any isolation. Two applications, A and B, run in its single operating system, and both load the libssl library from the shared `/usr/lib` directory.',
        ),
        focus: ['bm-apps'],
        say: { 'bm-apps': bi('Приложения A и B берут библиотеку libssl из общего каталога /usr/lib.', 'Apps A and B take libssl from the shared /usr/lib.') },
        states: startWith(ALL, 'bm-apps', 'bm-os', 'bm-hw', 'e-bm-sys', 'e-bm-hw'),
        values: { 'bm-apps': 'libssl 1.1 · 3.0', 'vm-apps': count(p.apps, n.vmFit), 'ct-apps': count(p.apps, n.ctFit) },
      },
      p.conflict
        ? {
            id: 'conflict',
            label: bi('конфликт', 'conflict'),
            caption: bi(
              'Приложению A нужна libssl версии 1.1, а приложению B версии 3.0. Каталог `/usr/lib` один на всю систему, и когда администратор поставил версию 3.0 для B, приложение A перестало запускаться. Так и выглядит проблема окружений: у разработчика на ноутбуке всё работало, потому что там своя система со своими версиями.',
              'A needs libssl 1.1 and B needs 3.0. There is one `/usr/lib` for the whole system: when the administrator installed 3.0 for B, A stopped starting. That is the environment problem: on the developer’s laptop it worked, because the laptop has its own system with its own versions.',
            ),
            focus: ['bm-os', 'e-bm-sys'],
            tokens: [{ edge: 'e-bm-sys', label: 'libssl.so.1.1?' }],
            say: { 'bm-os': bi('Система ищет для приложения A libssl 1.1, но в /usr/lib лежит только версия 3.0.', 'The system looks for libssl 1.1 for A, but /usr/lib holds only 3.0.') },
            states: { 'bm-apps': 'err' },
            values: { 'bm-apps': 'A: libssl.so.1.1 not found' },
          }
        : {
            id: 'conflict',
            label: bi('общая библиотека', 'shared library'),
            caption: bi(
              'Пока обоим приложениям подходит одна и та же версия libssl, они уживаются в одной системе. Но стоит одному из них потребовать другую версию, и обновление для одного приложения сломает другое.',
              'As long as the same libssl suits both applications, they get along in one system. But as soon as one of them needs another version, an upgrade for one breaks the other.',
            ),
            focus: ['bm-os', 'e-bm-sys'],
            tokens: [{ edge: 'e-bm-sys', label: 'libssl.so.3' }],
            say: { 'bm-os': bi('Система находит в /usr/lib libssl 3.0, и она подходит обоим приложениям.', 'The system finds libssl 3.0 in /usr/lib, and it suits both apps.') },
            states: { 'bm-apps': 'ok' },
            values: { 'bm-apps': 'libssl 3.0 · 3.0' },
          },
      {
        id: 'hyp',
        label: bi('гипервизор', 'hypervisor'),
        caption: fmt(
          bi(
            'Первое решение состоит в том, чтобы дать каждому приложению отдельный компьютер. Покупать по серверу на приложение дорого, поэтому на второй сервер ставят гипервизор, то есть программу, которая делит одно железо на несколько виртуальных машин и каждой показывает её собственные процессоры, память и диск. Число виртуальных машин на этом сервере сейчас равно {n}.',
            'The first solution is to give each application a separate computer. A server per application is expensive, so the second server gets a hypervisor: a program that divides one piece of hardware into several virtual machines and shows each its own CPUs, memory and disk. There are {n} machines now.',
          ),
          { n: vmRun },
        ),
        focus: ['vm-hyp'],
        reveal: ['vm-hw', 'vm-hyp', 'e-vm-hw'],
        say: { 'vm-hyp': fmt(bi('Гипервизор делит память и процессоры сервера между {n} виртуальными машинами.', 'The hypervisor divides the server’s memory and CPUs between {n} virtual machines.'), { n: vmRun }) },
        metrics: { vmMem: n.vmMem, vmOut: n.vmOut },
      },
      {
        id: 'guest',
        label: bi('гостевая ОС', 'guest OS'),
        caption: fmt(
          bi(
            'Внутри каждой виртуальной машины устанавливают полноценную операционную систему со своим ядром и службами. Такая гостевая система занимает около {os} МиБ памяти ещё до того, как запустилось приложение, и загружается десятки секунд.',
            'Inside each virtual machine a complete operating system is installed, with its own kernel and services. This guest system takes about {os} MiB of memory before the application has even started, and it boots for tens of seconds.',
          ),
          { os: STACK.guestOsMiB },
        ),
        focus: ['vm-guest', 'e-vm-virt'],
        reveal: ['vm-guest', 'e-vm-virt'],
        tokens: [{ edge: 'e-vm-virt', label: `${STACK.guestOsMiB} MiB × ${vmRun}` }],
        say: { 'vm-guest': bi('В каждой ВМ загружается своё ядро и своя система, и каждая занимает 1 ГиБ памяти ещё до приложения.', 'Each VM boots its own kernel and system, and each takes 1 GiB before the application.') },
        values: { 'vm-guest': `${STACK.guestOsMiB} MiB × ${vmRun}` },
        metrics: { vmMem: n.vmMem, vmStart: n.vmStart, vmOut: n.vmOut },
      },
      {
        id: 'vm-apps',
        label: bi('в ВМ', 'in VMs'),
        caption: bi(
          'Теперь приложения A и B работают в разных системах, и их библиотеки больше не встречаются, поэтому конфликт версий исчез. Платить за это приходится целой гостевой системой на каждое приложение.',
          'Now A and B run in separate systems and their libraries never meet, so the version conflict is gone. The price is a whole guest system per application.',
        ),
        focus: ['vm-apps', 'e-vm-sys'],
        reveal: ['vm-apps', 'e-vm-sys'],
        tokens: [{ edge: 'e-vm-sys', label: 'libssl.so.1.1' }],
        say: { 'vm-apps': bi('Приложение A находит libssl 1.1 в своей ВМ, а приложение B находит версию 3.0 в своей.', 'A finds libssl 1.1 in its VM, and B finds 3.0 in its own.') },
        states: { 'vm-apps': 'ok' },
        metrics: vmM,
      },
      {
        id: 'ct-kernel',
        label: bi('ядро хоста', 'host kernel'),
        caption: bi(
          'Второе решение оставляет систему общей. На третьем сервере работает одно ядро Linux, такое же, как на первом, и гипервизора здесь нет.',
          'The second solution keeps the system shared. The third server runs one Linux kernel, the same as the first, and there is no hypervisor.',
        ),
        focus: ['ct-kernel'],
        reveal: ['ct-hw', 'ct-kernel', 'e-ct-hw'],
        say: { 'ct-kernel': bi('Ядро хоста одно и работает для всех контейнеров сразу.', 'One host kernel works for all the containers at once.') },
        metrics: vmM,
      },
      {
        id: 'ct-rt',
        label: bi('рантайм', 'runtime'),
        caption: bi(
          'Docker и его рантайм остаются обычными программами на этом сервере. Чтобы запустить контейнер, рантайм просит ядро создать новый процесс, показать ему собственные файлы, процессы и сеть (это делают пространства имён) и ограничить его память и процессор (это делает cgroup). Оба механизма вы знаете по блоку Linux.',
          'Docker and its runtime are ordinary programs on this server. To start a container, the runtime asks the kernel to create a new process, show it its own files, processes and network (namespaces do that) and limit its memory and CPU (a cgroup does that). You know both from the Linux block.',
        ),
        focus: ['ct-rt', 'e-ct-rt'],
        reveal: ['ct-rt', 'e-ct-rt'],
        tokens: [{ edge: 'e-ct-rt', label: 'clone(CLONE_NEW*)' }],
        say: { 'ct-rt': bi('Рантайм просит ядро создать процесс в новых пространствах имён и поставить его в cgroup с лимитами.', 'The runtime asks the kernel for a process in new namespaces, in a cgroup with limits.') },
        metrics: vmM,
      },
      {
        id: 'ct-apps',
        label: bi('контейнеры', 'containers'),
        caption: bi(
          'Контейнер приложения A получает собственный набор файлов с libssl 1.1, контейнер B — набор с версией 3.0, и конфликт исчезает так же, как с виртуальными машинами. Но гостевой системы здесь нет, потому что каждый контейнер остаётся обычным процессом хоста и отправляет свои системные вызовы прямо в общее ядро.',
          'A’s container gets its own set of files with libssl 1.1, B’s container a set with 3.0, and the conflict disappears just as with VMs. But there is no guest system: each container is an ordinary host process that sends its system calls straight into the shared kernel.',
        ),
        focus: ['ct-apps', 'e-ct-sys'],
        reveal: ['ct-apps', 'e-ct-sys'],
        tokens: [{ edge: 'e-ct-sys', label: 'open libssl.so.1.1' }],
        say: { 'ct-apps': bi('Каждый контейнер видит свой каталог /usr/lib со своей libssl.', 'Each container sees its own /usr/lib with its own libssl.') },
        states: { 'ct-apps': 'ok' },
        metrics: all,
      },
      {
        id: 'start-vm',
        label: bi('+ ВМ', '+ VM'),
        caption: fmt(
          bi(
            'Сравним, во что обходится ещё одно приложение. Новой виртуальной машине нужно загрузить ядро и службы гостевой системы, на это уходит около {vm} секунд, а памяти она займёт {os} МиБ на систему и {app} МиБ на приложение.',
            'Compare the cost of one more application. A new VM has to boot the kernel and services of its guest system — about {vm} seconds — and it takes {os} MiB for the system plus {app} MiB for the application.',
          ),
          { vm: STACK.vmBootMs / 1000, os: STACK.guestOsMiB, app: STACK.appMiB },
        ),
        focus: ['vm-guest'],
        say: { 'vm-guest': fmt(bi('Новая ВМ загружает ядро и систему около {s} секунд.', 'A new VM boots its kernel and system for about {s} seconds.'), { s: STACK.vmBootMs / 1000 }) },
        states: { 'vm-guest': 'wait' },
        metrics: all,
      },
      {
        id: 'start-ct',
        label: bi('+ контейнер', '+ container'),
        caption: fmt(
          bi(
            'Новому контейнеру загружать нечего, потому что ядро уже работает. Запуск сводится к созданию процесса и занимает около {ct} мс, а памяти контейнер займёт {app} МиБ на приложение и примерно {ov} МиБ сверху. На {apps} приложений сервер с ВМ тратит {vmm} МиБ памяти, а сервер с контейнерами {ctm} МиБ.',
            'A new container has nothing to boot, because the kernel is already running. Starting it means creating a process, about {ct} ms, and it takes {app} MiB for the application plus about {ov} MiB. For {apps} applications the VM server spends {vmm} MiB and the container server {ctm} MiB.',
          ),
          { ct: STACK.containerStartMs, app: STACK.appMiB, ov: STACK.containerOverheadMiB, apps: p.apps, vmm: n.vmMem, ctm: n.ctMem },
        ),
        focus: ['ct-apps'],
        say: { 'ct-apps': fmt(bi('Для нового контейнера ядро создаёт новый процесс, и он готов примерно за {ms} мс.', 'A new container is a new process, ready in about {ms} ms.'), { ms: STACK.containerStartMs }) },
        states: { 'vm-guest': 'on' },
        metrics: all,
      },
    ];
    if (n.vmOut) {
      steps.push({
        id: 'oom',
        label: bi('память', 'memory'),
        caption: fmt(
          bi(
            'Память второго сервера кончилась на {k}-й виртуальной машине, и поместились только {fit} ВМ из {apps}, потому что каждая несёт гостевую систему. Контейнеры всё ещё помещаются, ведь каждый стоит {each} МиБ, а не {vm}.',
            'The second server ran out of memory at VM number {k}: only {fit} of {apps} fit, because each carries a guest system. The containers still fit: each costs {each} MiB, not {vm}.',
          ),
          { k: n.vmOut, fit: n.vmFit, apps: p.apps, each: STACK.appMiB + STACK.containerOverheadMiB, vm: STACK.appMiB + STACK.guestOsMiB },
        ),
        focus: ['vm-hw'],
        say: { 'vm-hw': fmt(bi('Память сервера кончилась, и на нём поместилось только {fit} ВМ из {apps}.', 'The server is out of memory: {fit} VMs of {apps} fit.'), { fit: n.vmFit, apps: p.apps }) },
        states: { 'vm-hw': 'err', 'vm-apps': 'warn' },
        metrics: all,
      });
    }
    if (p.vuln) {
      steps.push({
        id: 'vuln-ct',
        label: bi('уязвимость', 'vulnerability'),
        caption: fmt(
          bi(
            'В ядре нашли уязвимость, через которую процесс может выйти за границы своего контейнера. У контейнеров ядро общее, поэтому под угрозой оказываются все {n} контейнеров третьего сервера, потому что граница между ними проходит внутри того самого ядра, в котором нашли дыру.',
            'A kernel vulnerability lets a process escape its container. Containers share the kernel, so all {n} containers of the third server are at risk: the boundary between them runs inside the very kernel that has the hole.',
          ),
          { n: ctRun },
        ),
        focus: ['ct-kernel'],
        say: { 'ct-kernel': bi('Через уязвимость в общем ядре процесс одного контейнера может добраться до всех остальных.', 'Through the hole in the shared kernel one container’s process can reach all the others.') },
        states: { 'ct-kernel': 'err', 'ct-apps': 'warn' },
        values: { 'ct-apps': `${ctRun} / ${ctRun} at risk` },
        metrics: all,
      });
      steps.push({
        id: 'vuln-vm',
        label: bi('одна ВМ', 'one VM'),
        caption: bi(
          'На втором сервере та же уязвимость затрагивает только одну виртуальную машину, потому что у каждой ВМ своё ядро, а между машинами стоит гипервизор. Поэтому чужой, недоверенный код запускают в ВМ или в песочницах вроде gVisor и Kata Containers.',
          'On the second server the same vulnerability affects only one VM: each VM has its own kernel, and the hypervisor stands between the machines. That is why untrusted code runs in VMs or in sandboxes such as gVisor and Kata Containers.',
        ),
        focus: ['vm-guest'],
        say: { 'vm-guest': bi('Уязвимое ядро есть в каждой ВМ, но вырваться можно только из своей машины, а дальше стоит гипервизор.', 'Each VM has the vulnerable kernel, but escaping leads only out of its own machine; the hypervisor is beyond.') },
        states: { 'vm-guest': 'warn' },
        values: { 'vm-guest': `1 / ${vmRun} at risk` },
        metrics: all,
      });
    } else {
      steps.push({
        id: 'boundary-vm',
        label: bi('граница ВМ', 'VM boundary'),
        caption: bi(
          'Где проходит граница, которая отделяет одно приложение от другого? У виртуальных машин такой границей служит гипервизор. У каждой ВМ своё ядро, и, чтобы добраться до соседа, нужно пробить и своё ядро, и гипервизор.',
          'Where is the boundary that separates one application from another? For VMs it is the hypervisor: each VM has its own kernel, and to reach a neighbour you must break through both your own kernel and the hypervisor.',
        ),
        focus: ['vm-hyp'],
        say: { 'vm-hyp': bi('Между виртуальными машинами стоит гипервизор, и у каждой ВМ своё ядро.', 'The hypervisor stands between the VMs, and each VM has its own kernel.') },
        metrics: all,
      });
      steps.push({
        id: 'boundary-ct',
        label: bi('в ядре', 'in the kernel'),
        caption: bi(
          'У контейнеров граница проходит внутри одного ядра, и держат её пространства имён и cgroup, а ещё фильтры seccomp и урезанный набор capabilities. Поэтому контейнер изолирует слабее виртуальной машины, зато он легче и запускается быстрее.',
          'For containers the boundary runs inside one kernel: namespaces and cgroups hold it, together with seccomp filters and a reduced set of capabilities. A container therefore isolates less strongly than a VM, but it is lighter and starts faster.',
        ),
        focus: ['ct-kernel'],
        say: { 'ct-kernel': bi('Контейнеры отделяет друг от друга само ядро хоста, одно на всех.', 'The host kernel itself, one for all, separates the containers.') },
        metrics: all,
      });
    }
    if (p.otherKernel) {
      steps.push({
        id: 'kernel',
        label: 'Windows',
        caption: bi(
          'Одной из программ нужен Windows. В виртуальную машину можно поставить любую систему с её собственным ядром, а контейнер пользуется ядром хоста. Программа для Windows на ядре Linux не запустится, сколько файлов Windows ни положи в образ контейнера.',
          'One program needs Windows. A VM can hold any OS with its own kernel; a container uses the host kernel. A Windows program will not run on a Linux kernel, whatever Windows files you put into the image.',
        ),
        focus: ['ct-apps'],
        say: { 'ct-apps': bi('Ядро Linux не умеет выполнять программу для Windows и отвечает exec format error.', 'The Linux kernel cannot run a Windows program and answers exec format error.') },
        states: { 'ct-apps': 'err', 'vm-apps': 'ok' },
        values: { 'ct-apps': 'exec format error' },
        metrics: all,
      });
    }
    if (broken.has('hyp-down')) {
      steps.push({
        id: 'hyp-down',
        label: bi('гипервизор', 'hypervisor'),
        caption: bi(
          'Гипервизор общий для всех виртуальных машин сервера. Его процесс завершился, и вместе с ним остановились все ВМ, хотя их гостевые системы были в полном порядке.',
          'The hypervisor is shared by all the VMs of the server. Its process ended, and every VM stopped with it, although their guest systems were perfectly fine.',
        ),
        focus: ['vm-hyp'],
        say: { 'vm-hyp': bi('Процесс гипервизора завершён, и ни одна ВМ этого сервера больше не работает.', 'The hypervisor process has ended, and no VM of this server runs any more.') },
        states: { 'vm-hyp': 'err', 'vm-apps': 'err', 'vm-guest': 'off' },
        metrics: all,
        broken: { at: 'vm-hyp', message: 'qemu-system-x86_64: terminating on signal 15 from pid 1 (systemd)', caption: bi('Работа остановилась на гипервизоре второго сервера. Все ВМ этого сервера остановились вместе с ним, а сервер с контейнерами этого даже не заметил.', 'Work stopped at the hypervisor of the second server. Every VM on this server stopped with it, while the container server did not even notice.') },
      });
    }
    if (broken.has('kernel-panic')) {
      steps.push({
        id: 'panic',
        label: bi('паника', 'panic'),
        caption: bi(
          'Ядро общее для всех контейнеров третьего сервера. Когда оно завершается аварийно, останавливаются все контейнеры сразу, потому что своего ядра, на котором можно было бы продолжить работу, ни у одного из них нет.',
          'The kernel is shared by all the containers of the third server. When it crashes, all of them stop at once, because none of them has a kernel of its own to carry on with.',
        ),
        focus: ['ct-kernel'],
        say: { 'ct-kernel': bi('Ядро остановилось, и вместе с ним остановились все процессы сервера, включая контейнеры.', 'The kernel stopped, and every process of the server stopped with it, containers included.') },
        states: { 'ct-kernel': 'err', 'ct-apps': 'err', 'ct-rt': 'off' },
        metrics: all,
        broken: { at: 'ct-kernel', message: 'Kernel panic - not syncing: Fatal exception in interrupt', caption: bi('Работа остановилась на ядре третьего сервера. Не работает ни один контейнер, потому что своего ядра у них нет.', 'Work stopped at the kernel of the third server. No container runs, because they have no kernel of their own.') },
      });
    }
    return steps;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и все три сервера снова работают.', 'The failure is removed; the towers work again.');
      return change.id === 'hyp-down'
        ? bi('Гипервизор держит все виртуальные машины сервера, поэтому, когда он остановился, остановились и все ВМ.', 'The hypervisor carries every VM of the server: when it stops, they all stop.')
        : bi('Ядро хоста общее для всех контейнеров, поэтому его аварийное завершение останавливает их все сразу.', 'The host kernel is shared by every container: a kernel panic stops them all at once.');
    }
    switch (change.id) {
      case 'apps': {
        const n = stackNumbers(b.apps);
        return n.vmOut
          ? fmtb(bi('Приложений стало {b} вместо {a}. Виртуальные машины перестают помещаться на {k}-й, потому что каждая несёт гостевую систему на {os} МиБ, а контейнеры занимают всего {ct} МиБ из 16 384.', '{a} → {b} applications: VMs run out at number {k} (each carries a {os} MiB OS), the containers take {ct} MiB of 16384.'), { a: a.apps, b: b.apps, k: n.vmOut, os: STACK.guestOsMiB, ct: n.ctMem })
          : fmtb(bi('Приложений стало {b} вместо {a}. Виртуальные машины занимают {vm} МиБ, а контейнеры {ct} МиБ, и вся разница приходится на гостевые системы.', '{a} → {b} applications: VM memory {vm} MiB against {ct} MiB for containers — the difference is the guest OSes.'), { a: a.apps, b: b.apps, vm: last(next).vmMem ?? 0, ct: last(next).ctMem ?? 0 });
      }
      case 'conflict':
        return b.conflict
          ? bi('Версии libssl разошлись, и на первом сервере, где изоляции нет, одно из приложений перестало запускаться.', 'The versions diverged: on one server without isolation one of the applications does not start.')
          : bi('Версии libssl совпали, и оба приложения уживаются даже на сервере без изоляции.', 'The versions match: both applications get along on the bare server.');
      case 'vuln':
        return b.vuln
          ? bi('Уязвимость в ядре затрагивает всех, кто это ядро делит: из виртуальных машин только одну, а из контейнеров все.', 'A kernel vulnerability hits everyone who shares that kernel: one VM, but all the containers.')
          : bi('Уязвимость закрыли, и граница внутри ядра снова держит.', 'The vulnerability is patched.');
      case 'otherKernel':
        return b.otherKernel
          ? bi('Контейнер не может принести с собой своё ядро и работает на ядре хоста, а виртуальная машина может.', 'A container cannot bring its own kernel — it uses the host’s; a VM can.')
          : bi('Теперь всем приложениям подходит ядро Linux.', 'A Linux kernel suits every application.');
    }
    return bi('Схема пересчитана для новых параметров.', 'The model is recomputed.');
  },
});
