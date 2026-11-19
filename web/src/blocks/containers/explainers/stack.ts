// X4 (04 §6.5, R7c): bare metal → virtual machines → containers. Three
// towers of layers on servers of the same size; a slider of applications
// recomputes memory, start time and overhead at once; toggles show the
// library conflict, a kernel vulnerability and a program that needs another
// kernel; breaks take out the shared hypervisor or the shared kernel.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';

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

const man = (n: string, s: number) => ({ url: `https://man7.org/linux/man-pages/man${s}/${n}.${s}.html`, label: `${n}(${s})` });

export const stackModel = defineModel<P>({
  id: 'containers.stack',
  block: 'containers',
  title: bi('Железо, виртуальные машины, контейнеры', 'Bare metal, virtual machines, containers'),
  summary: bi(
    'Три сервера одинакового размера. Двигайте число приложений — счётчики пересчитаются; включайте поломки и смотрите, где проходит граница изоляции.',
    'Three servers of the same size. Move the number of applications and the counters recompute; switch on the failures and see where the isolation boundary runs.',
  ),
  concepts: ['docker.env-problem', 'docker.vm', 'docker.container', 'docker.vm-vs-container'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      // bare metal
      { id: 'bm-apps', label: bi('приложения A и B', 'apps A and B'), sub: 'libssl 1.1 · 3.0', family: 'process', x: 24, y: 120, w: 264, h: 64, card: { what: bi('Две программы на одной системе. Обе берут библиотеки из одного `/usr/lib`: если A нужна одна версия libssl, а B — другая, обновление для одной ломает другую.', 'Two programs on one system. Both take libraries from the same `/usr/lib`: if A needs one version of libssl and B another, an upgrade for one breaks the other.'), who: bi('Администратор ставит их пакетами прямо в систему сервера.', 'An administrator installs them as packages straight into the server’s system.'), see: 'ldd /usr/bin/app-a' } },
      { id: 'bm-os', label: bi('ядро и ОС сервера', 'kernel and OS of the server'), sub: 'Linux 6.12', family: 'kernel', x: 24, y: 296, w: 264, h: 64, card: { what: bi('Одна операционная система: одно ядро, один набор библиотек, одно пространство процессов на всё железо.', 'One operating system: one kernel, one set of libraries, one space of processes for all the hardware.'), who: bi('Устанавливается на сервер один раз.', 'Installed on the server once.'), see: 'uname -r; cat /etc/os-release' } },
      { id: 'bm-hw', label: bi('сервер', 'server'), sub: '16 GiB · 8 CPU', family: 'node', shape: 'rack', x: 24, y: 424, w: 264, h: 64, card: { what: bi('Физическая машина: процессоры, память, диски, сетевые карты. Без виртуализации её ресурсами владеет одна система.', 'The physical machine: CPUs, memory, disks, network cards. Without virtualisation one system owns all of it.'), who: bi('Стоит в стойке дата-центра.', 'Sits in a data-centre rack.'), see: 'lscpu; free -h' } },
      // VMs
      { id: 'vm-apps', label: bi('приложение в каждой ВМ', 'an app in each VM'), sub: '× 4', family: 'process', x: 336, y: 40, w: 288, h: 56, card: { what: bi('В каждой виртуальной машине — своё приложение со своими библиотеками. Конфликта версий нет: системы разные.', 'Each virtual machine has its own application with its own libraries. No version conflict: the systems are separate.'), who: bi('Ставится в гостевую ОС, как на отдельный сервер.', 'Installed in the guest OS, as on a separate server.') } },
      { id: 'vm-os', label: bi('гостевая ОС', 'guest OS'), sub: '≈ 1 GiB', family: 'user', x: 336, y: 120, w: 288, h: 56, card: { what: bi('Полная операционная система внутри ВМ: init, службы, библиотеки. Она занимает память, даже когда приложение спит.', 'A whole operating system inside the VM: init, services, libraries. It holds memory even when the application sleeps.'), who: bi('Устанавливается в ВМ с образа диска.', 'Installed into the VM from a disk image.') } },
      { id: 'vm-kernel', label: bi('ядро гостя', 'guest kernel'), sub: '× 4', family: 'kernel', x: 336, y: 200, w: 288, h: 56, card: { what: bi('У каждой ВМ своё ядро. Оно загружается при старте ВМ — отсюда десятки секунд до готовности.', 'Every VM has its own kernel. It boots when the VM starts — hence tens of seconds until it is ready.'), who: bi('Загружается внутри ВМ, как на настоящем компьютере.', 'Boots inside the VM as on a real computer.'), see: 'uname -r   # inside the VM' } },
      { id: 'vm-hyp', label: bi('гипервизор', 'hypervisor'), sub: 'KVM · QEMU', family: 'cp', shape: 'hex', x: 336, y: 296, w: 288, h: 64, card: { what: bi('Программа, которая делит железо между ВМ и показывает каждой виртуальные процессоры, память и устройства. Тип 1 работает прямо на железе, тип 2 — как программа внутри обычной ОС; KVM — модуль ядра Linux, превращающий его в гипервизор.', 'A program that divides the hardware between VMs and shows each one virtual CPUs, memory and devices. Type 1 runs on the hardware itself, type 2 as a program inside an ordinary OS; KVM is a module that turns the Linux kernel into a hypervisor.'), who: bi('Ставится на сервер вместо обычной ОС или поверх неё.', 'Installed on the server instead of an ordinary OS or on top of it.'), see: 'lsmod | grep kvm', doc: { url: 'https://www.linux-kvm.org/page/Main_Page', label: 'linux-kvm.org' } } },
      { id: 'vm-hw', label: bi('сервер', 'server'), sub: '16 GiB · 8 CPU', family: 'node', shape: 'rack', x: 336, y: 424, w: 288, h: 64, card: { what: bi('Такой же сервер. Его память делится на ВМ целыми кусками: каждой — ОС плюс приложение.', 'The same server. Its memory is cut into whole pieces for the VMs: each gets an OS plus an application.'), who: bi('Стоит в стойке дата-центра.', 'Sits in a data-centre rack.') } },
      // containers
      { id: 'ct-apps', label: bi('контейнеры: файлы + приложение', 'containers: files + app'), sub: '× 4', family: 'ns', x: 672, y: 120, w: 264, h: 64, card: { what: bi('Каждый контейнер — обычный процесс хоста со своим набором файлов (свои библиотеки — свой libssl), в своих пространствах имён и в своей cgroup. Ядро видит его как процесс, а процесс видит только «своё».', 'Each container is an ordinary host process with its own set of files (its own libraries — its own libssl), in its own namespaces and its own cgroup. The kernel sees a process; the process sees only “its own”.'), who: bi('Рантайм контейнеров запускает его по просьбе Docker.', 'The container runtime starts it when Docker asks.'), see: 'docker ps; ps -ef --forest', doc: man('namespaces', 7) } },
      { id: 'ct-rt', label: bi('рантайм контейнеров', 'container runtime'), sub: 'dockerd · containerd · runc', family: 'cp', x: 672, y: 208, w: 264, h: 56, card: { what: bi('Обычные программы на хосте. Они готовят файлы и просят ядро создать процесс в новых пространствах имён с лимитами. Сами в работу контейнера не вмешиваются.', 'Ordinary programs on the host. They prepare the files and ask the kernel to create a process in new namespaces with limits. They do not take part in the container’s work.'), who: bi('Устанавливается как пакет Docker Engine.', 'Installed as the Docker Engine package.'), see: 'systemctl status docker' } },
      { id: 'ct-kernel', label: bi('одно ядро хоста', 'one host kernel'), sub: 'Linux 6.12', family: 'kernel', x: 672, y: 296, w: 264, h: 64, card: { what: bi('Одно ядро на все контейнеры. Пространства имён (namespaces) определяют, что процесс видит, cgroup — сколько он может потребить. Граница изоляции проходит внутри этого ядра.', 'One kernel for all containers. Namespaces decide what a process sees, cgroups how much it may consume. The isolation boundary runs inside this one kernel.'), who: bi('Загружается при старте сервера.', 'Boots with the server.'), see: 'uname -r; docker run --rm alpine uname -r', doc: man('cgroups', 7) } },
      { id: 'ct-hw', label: bi('сервер', 'server'), sub: '16 GiB · 8 CPU', family: 'node', shape: 'rack', x: 672, y: 424, w: 264, h: 64, card: { what: bi('Такой же сервер. Контейнеры берут память по потребности; лимит cgroup — это потолок, а не выделенный кусок.', 'The same server. Containers take memory as they use it; a cgroup limit is a ceiling, not a reserved piece.'), who: bi('Стоит в стойке дата-центра.', 'Sits in a data-centre rack.') } },
    ],
    edges: [
      { id: 'e-bm-sys', from: 'bm-apps', to: 'bm-os', label: bi('системные вызовы', 'system calls'), card: { what: bi('Программы обращаются к ядру напрямую: открыть файл, создать процесс, отправить пакет.', 'Programs talk to the kernel directly: open a file, create a process, send a packet.'), who: bi('Каждая программа.', 'Every program.'), doc: man('syscalls', 2) } },
      { id: 'e-bm-hw', from: 'bm-os', to: 'bm-hw', label: bi('драйверы', 'drivers'), card: { what: bi('Ядро управляет железом через драйверы.', 'The kernel drives the hardware through drivers.'), who: bi('Ядро.', 'The kernel.') } },
      { id: 'e-vm-sys', from: 'vm-apps', to: 'vm-kernel', via: [[320, 68], [320, 228]], label: 'syscalls', labelAt: 0.5, card: { what: bi('Приложение в ВМ говорит со своим, гостевым ядром.', 'An application in a VM talks to its own guest kernel.'), who: bi('Приложение.', 'The application.') } },
      { id: 'e-vm-virt', from: 'vm-kernel', to: 'vm-hyp', label: bi('виртуальное железо', 'virtual hardware'), card: { what: bi('Гостевое ядро думает, что управляет настоящим железом; на деле его команды перехватывает гипервизор.', 'The guest kernel believes it drives real hardware; its commands are actually caught by the hypervisor.'), who: bi('Гипервизор и аппаратная виртуализация CPU (VT-x, AMD-V).', 'The hypervisor and the CPU’s hardware virtualisation (VT-x, AMD-V).') } },
      { id: 'e-vm-hw', from: 'vm-hyp', to: 'vm-hw', label: 'VT-x · AMD-V', card: { what: bi('Гипервизор использует аппаратную поддержку виртуализации процессора.', 'The hypervisor uses the CPU’s hardware support for virtualisation.'), who: bi('Гипервизор.', 'The hypervisor.') } },
      { id: 'e-ct-sys', from: 'ct-apps', to: 'ct-kernel', via: [[948, 152], [948, 328]], label: 'syscalls', labelAt: 0.5, card: { what: bi('Процесс контейнера говорит прямо с ядром хоста — без гостевого ядра и без гипервизора. Поэтому он стартует за доли секунды.', 'A container process talks straight to the host kernel — no guest kernel, no hypervisor. That is why it starts in a fraction of a second.'), who: bi('Приложение в контейнере.', 'The application in the container.') } },
      { id: 'e-ct-rt', from: 'ct-rt', to: 'ct-kernel', label: 'clone · cgroups', card: { what: bi('Рантайм просит ядро создать процесс в новых пространствах имён (clone с флагами CLONE_NEW*) и ставит его в cgroup с лимитами.', 'The runtime asks the kernel to create a process in new namespaces (clone with CLONE_NEW* flags) and puts it into a cgroup with limits.'), who: bi('runc, по просьбе containerd.', 'runc, asked by containerd.'), doc: man('clone', 2) } },
      { id: 'e-ct-hw', from: 'ct-kernel', to: 'ct-hw', label: bi('драйверы', 'drivers'), card: { what: bi('Как и на голом железе: одно ядро, одни драйверы.', 'As on bare metal: one kernel, one set of drivers.'), who: bi('Ядро.', 'The kernel.') } },
    ],
  },
  params: [
    {
      id: 'apps',
      label: bi('Число приложений', 'Number of applications'),
      kind: 'range',
      min: 1,
      max: 50,
      step: 1,
      default: 4,
      near: 'vm-apps',
      predict: {
        prompt: bi('Приложений станет 30. Что случится в башне виртуальных машин?', 'There will be 30 applications. What happens in the tower of virtual machines?'),
        options: [
          { id: 'mem', text: bi('Кончится память: каждой ВМ нужна своя ОС', 'Memory runs out: each VM needs its own OS') },
          { id: 'ok', text: bi('Все 30 поместятся, как и контейнеры', 'All 30 fit, just like the containers') },
        ],
        resolve: (_p, next) => ((next[next.length - 1]?.metrics?.vmOut ?? 0) > 0 ? 'mem' : 'ok'),
      },
    },
    {
      id: 'conflict',
      label: bi('A и B требуют разные версии libssl', 'A and B need different versions of libssl'),
      kind: 'toggle',
      default: true,
      near: 'bm-apps',
    },
    {
      id: 'vuln',
      label: bi('Уязвимость в ядре', 'A kernel vulnerability'),
      kind: 'toggle',
      default: false,
      near: 'ct-kernel',
      predict: {
        prompt: bi('В ядре нашли уязвимость, через которую процесс может выйти за свои границы. Чьи приложения под угрозой?', 'A kernel vulnerability lets a process escape its boundaries. Whose applications are at risk?'),
        options: [
          { id: 'ct-all', text: bi('Все контейнеры хоста — ядро у них общее; в башне ВМ — только одна ВМ', 'All containers on the host — they share the kernel; in the VM tower only one VM') },
          { id: 'same', text: bi('Одинаково: по одному приложению в каждой башне', 'The same: one application in each tower') },
        ],
        resolve: () => 'ct-all',
      },
    },
    {
      id: 'otherKernel',
      label: bi('Приложению нужно другое ядро (программа для Windows)', 'An application needs another kernel (a Windows program)'),
      kind: 'toggle',
      default: false,
      near: 'ct-apps',
      predict: {
        prompt: bi('Программе нужен Windows. Где её можно запустить?', 'The program needs Windows. Where can it run?'),
        options: [
          { id: 'vm', text: bi('Только в ВМ: там можно поставить своё ядро', 'Only in a VM: a VM can have its own kernel') },
          { id: 'both', text: bi('В контейнере тоже: в образ можно положить Windows', 'In a container too: you can put Windows into an image') },
        ],
        resolve: (_p, next) => (next.some((s) => s.states?.['ct-apps'] === 'err') ? 'vm' : 'both'),
      },
    },
  ],
  breaks: [
    {
      id: 'hyp-down',
      label: bi('Остановить гипервизор', 'Stop the hypervisor'),
      remove: ['vm-hyp', 'e-vm-virt', 'e-vm-hw'],
      boundary: 'kernel',
      predict: {
        prompt: bi('Гипервизор остановился. Что будет с виртуальными машинами?', 'The hypervisor stopped. What happens to the virtual machines?'),
        options: [
          { id: 'all', text: bi('Остановятся все: они работают на нём', 'All of them stop: they run on it') },
          { id: 'none', text: bi('Ничего: у каждой своё ядро', 'Nothing: each one has its own kernel') },
        ],
        resolve: () => 'all',
      },
    },
    {
      id: 'kernel-panic',
      label: bi('Паника ядра хоста контейнеров', 'Kernel panic on the container host'),
      remove: ['ct-kernel', 'e-ct-sys', 'e-ct-rt'],
      boundary: 'kernel',
      predict: {
        prompt: bi('Ядро хоста с контейнерами упало. Сколько контейнеров продолжат работать?', 'The kernel of the container host crashed. How many containers keep running?'),
        options: [
          { id: 'zero', text: bi('Ни одного: у них нет своего ядра', 'None: they have no kernel of their own') },
          { id: 'most', text: bi('Все, кроме одного', 'All but one') },
        ],
        resolve: () => 'zero',
      },
    },
  ],
  metrics: [
    { id: 'vmMem', label: bi('память ВМ', 'VM memory'), unit: 'MiB' },
    { id: 'ctMem', label: bi('память контейнеров', 'container memory'), unit: 'MiB' },
    { id: 'vmStart', label: bi('старт ещё одной ВМ', 'start one more VM'), unit: 'ms' },
    { id: 'ctStart', label: bi('старт ещё одного контейнера', 'start one more container'), unit: 'ms' },
    { id: 'vmOverhead', label: bi('служебная работа CPU в ВМ', 'CPU overhead, VMs'), unit: '%' },
    { id: 'ctOverhead', label: bi('служебная работа CPU в контейнерах', 'CPU overhead, containers'), unit: '%' },
  ],
  run(p, broken): Step[] {
    const n = stackNumbers(p.apps);
    const m = { vmMem: n.vmMem, ctMem: n.ctMem, vmStart: n.vmStart, ctStart: n.ctStart, vmOverhead: n.vmOverhead, ctOverhead: n.ctOverhead, vmOut: n.vmOut };
    const count = (x: number, fit: number) => (x > fit ? `× ${fit} of ${x}` : `× ${x}`);
    const steps: Step[] = [
      {
        id: 'bare',
        label: bi('один сервер', 'one server'),
        caption: p.conflict
          ? bi('Два приложения на одной системе делят библиотеки. A нужен libssl 1.1, B — 3.0: обновите для B — сломается A. Это и есть проблема окружений: «у меня работает».', 'Two applications on one system share libraries. A needs libssl 1.1, B needs 3.0: upgrade for B and A breaks. That is the environment problem: “it works on my machine”.')
          : bi('Два приложения на одной системе. Пока им подходят одни и те же версии библиотек, всё работает, и сервер загружен процентов на десять.', 'Two applications on one system. As long as the same library versions suit both, everything works, and the server is about ten per cent busy.'),
        focus: ['bm-apps', 'bm-os', 'e-bm-sys'],
        states: { 'bm-apps': p.conflict ? 'err' : 'ok', 'bm-os': 'on', 'vm-apps': 'off', 'vm-os': 'off', 'vm-kernel': 'off', 'vm-hyp': 'off', 'ct-apps': 'off', 'ct-rt': 'off', 'ct-kernel': 'off' },
        values: { 'bm-apps': p.conflict ? 'B: libssl.so.3 not found' : 'libssl 3.0 · 3.0' },
        metrics: { ...m, vmMem: 0, ctMem: 0 },
      },
      {
        id: 'vm',
        label: bi('ВМ', 'VMs'),
        caption: fmt(bi('Первое решение — по виртуальной машине на приложение. Гипервизор делит железо, в каждой ВМ своё ядро и своя ОС: конфликта нет, но каждая ВМ занимает {each} МиБ ещё до приложения.', 'The first solution is one virtual machine per application. The hypervisor divides the hardware; every VM has its own kernel and OS: no conflict, but each VM takes {each} MiB before the application even starts.'), { each: STACK.guestOsMiB }),
        focus: ['vm-hyp', 'vm-kernel', 'vm-os', 'vm-apps', 'e-vm-virt'],
        states: { 'vm-apps': 'on', 'vm-os': 'on', 'vm-kernel': 'on', 'vm-hyp': 'on' },
        values: { 'vm-apps': count(p.apps, n.vmFit), 'vm-kernel': count(p.apps, n.vmFit), 'vm-os': `${STACK.guestOsMiB} MiB × ${Math.min(p.apps, n.vmFit)}` },
        tokens: [{ edge: 'e-vm-virt' }],
        metrics: { ...m, ctMem: 0 },
      },
      {
        id: 'ct',
        label: bi('контейнеры', 'containers'),
        caption: bi('Второе решение — контейнер: ядро одно, а каждому процессу ядро показывает свой набор файлов, процессов и сети и ограничивает его ресурсы. Детали — пространства имён и cgroups — вы знаете из блока Linux; контейнер — их сочетание.', 'The second solution is a container: one kernel, but the kernel shows each process its own set of files, processes and network and limits its resources. You know the parts — namespaces and cgroups — from the Linux block; a container is their combination.'),
        focus: ['ct-apps', 'ct-rt', 'ct-kernel', 'e-ct-rt', 'e-ct-sys'],
        states: { 'ct-apps': 'on', 'ct-rt': 'on', 'ct-kernel': 'on' },
        values: { 'ct-apps': count(p.apps, n.ctFit) },
        tokens: [{ edge: 'e-ct-rt', label: 'clone()' }],
        metrics: m,
      },
      {
        id: 'start',
        label: bi('ещё одно', 'one more'),
        caption: fmt(bi('Запустить ещё одно приложение: ВМ грузит ядро и ОС — около {vm} с; контейнер — это создание процесса, около {ct} мс. Память: {vmm} МиБ против {ctm} МиБ.', 'Start one more application: a VM boots a kernel and an OS — about {vm} s; a container is creating a process — about {ct} ms. Memory: {vmm} MiB against {ctm} MiB.'), { vm: STACK.vmBootMs / 1000, ct: STACK.containerStartMs, vmm: n.vmMem, ctm: n.ctMem }),
        focus: ['vm-kernel', 'ct-apps'],
        tokens: [{ edge: 'e-ct-sys', label: 'execve' }],
        metrics: m,
      },
    ];
    if (n.vmOut) {
      steps.push({
        id: 'oom',
        label: bi('память', 'memory'),
        caption: fmt(bi('Память сервера кончилась на {k}-й ВМ: {fit} помещаются, остальным не хватает. Контейнеры всё ещё помещаются: каждый стоит {each} МиБ, а не {vm}.', 'The server ran out of memory at VM number {k}: {fit} fit, the rest do not. The containers still fit: each costs {each} MiB, not {vm}.'), { k: n.vmOut, fit: n.vmFit, each: STACK.appMiB + STACK.containerOverheadMiB, vm: STACK.appMiB + STACK.guestOsMiB }),
        focus: ['vm-os', 'vm-hw'],
        states: { 'vm-os': 'err' },
        metrics: m,
      });
    }
    steps.push({
      id: 'boundary',
      label: bi('граница', 'boundary'),
      caption: p.vuln
        ? bi('Уязвимость в ядре. В башне ВМ под угрозой одна ВМ: её ядро — её граница, дальше гипервизор. В башне контейнеров ядро общее — под угрозой все контейнеры хоста. Поэтому чужой, недоверенный код запускают в ВМ или в песочницах (gVisor, Kata Containers).', 'A kernel vulnerability. In the VM tower one VM is at risk: its kernel is its boundary, the hypervisor is beyond. In the container tower the kernel is shared — every container on the host is at risk. That is why untrusted code runs in VMs or in sandboxes (gVisor, Kata Containers).')
        : bi('Где граница изоляции? У ВМ — гипервизор: у каждой своё ядро. У контейнеров — внутри одного ядра: пространства имён и cgroups, плюс фильтры seccomp и capabilities. Контейнер изолирует слабее, зато легче.', 'Where is the isolation boundary? For VMs it is the hypervisor: each has its own kernel. For containers it is inside one kernel: namespaces and cgroups, plus seccomp filters and capabilities. A container isolates less strongly but is lighter.'),
      focus: p.vuln ? ['ct-kernel', 'vm-kernel'] : ['vm-hyp', 'ct-kernel'],
      states: p.vuln ? { 'ct-kernel': 'err', 'ct-apps': 'warn', 'vm-kernel': 'warn' } : {},
      values: p.vuln ? { 'vm-kernel': `1 of ${Math.min(p.apps, n.vmFit)} at risk`, 'ct-apps': `${Math.min(p.apps, n.ctFit)} of ${Math.min(p.apps, n.ctFit)} at risk` } : {},
      metrics: m,
    });
    if (p.otherKernel) {
      steps.push({
        id: 'kernel',
        label: bi('другое ядро', 'another kernel'),
        caption: bi('Программе нужен Windows. В ВМ можно поставить любую ОС со своим ядром. Контейнер использует ядро хоста: программа для Windows на ядре Linux не запустится, сколько файлов ни положи в образ.', 'The program needs Windows. A VM can hold any OS with its own kernel. A container uses the host kernel: a Windows program will not run on a Linux kernel, whatever files you put into the image.'),
        focus: ['ct-apps', 'vm-os'],
        states: { 'ct-apps': 'err', 'vm-os': 'ok' },
        values: { 'ct-apps': 'exec format error' },
        metrics: m,
      });
    }
    if (broken.has('hyp-down')) {
      steps.push({ id: 'hyp', label: bi('гипервизор', 'hypervisor'), caption: bi('Гипервизор — общая деталь всех ВМ: без него ни одна не работает.', 'The hypervisor is shared by all VMs: without it none of them runs.'), focus: ['vm-hyp'], states: { 'vm-apps': 'err', 'vm-os': 'off', 'vm-kernel': 'off' }, metrics: m, broken: { at: 'vm-hyp', message: 'qemu-system-x86_64: terminating on signal 15 from pid 1 (systemd)', caption: bi('все ВМ этого сервера остановились вместе с гипервизором.', 'every VM on this server stopped with the hypervisor.') } });
    }
    if (broken.has('kernel-panic')) {
      steps.push({ id: 'panic', label: bi('паника', 'panic'), caption: bi('Ядро — общая деталь всех контейнеров: когда оно падает, падают все.', 'The kernel is shared by all containers: when it falls, all of them fall.'), focus: ['ct-kernel'], states: { 'ct-apps': 'err', 'ct-rt': 'off' }, metrics: m, broken: { at: 'ct-kernel', message: 'Kernel panic - not syncing: Fatal exception in interrupt', caption: bi('ни одного контейнера: своего ядра у них нет.', 'no containers left: they have no kernel of their own.') } });
    }
    return steps;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана, башни снова работают.', 'The failure is removed; the towers work again.');
      return change.id === 'hyp-down' ? bi('Гипервизор держит все ВМ сервера: остановился он — остановились все.', 'The hypervisor carries every VM of the server: when it stops, they all stop.') : bi('Ядро хоста общее для всех контейнеров: паника ядра останавливает их все сразу.', 'The host kernel is shared by every container: a kernel panic stops them all at once.');
    }
    switch (change.id) {
      case 'apps': {
        const n = stackNumbers(b.apps);
        return n.vmOut
          ? fmt(bi('{a} → {b} приложений: ВМ кончаются на {k}-й (каждая несёт ОС на {os} МиБ), контейнеры занимают {ct} МиБ из 16384.', '{a} → {b} applications: VMs run out at number {k} (each carries a {os} MiB OS), the containers take {ct} MiB of 16384.'), { a: a.apps, b: b.apps, k: n.vmOut, os: STACK.guestOsMiB, ct: n.ctMem })
          : fmt(bi('{a} → {b} приложений: память ВМ {vm} МиБ против {ct} МиБ у контейнеров — разница в гостевых ОС.', '{a} → {b} applications: VM memory {vm} MiB against {ct} MiB for containers — the difference is the guest OSes.'), { a: a.apps, b: b.apps, vm: last(next).vmMem ?? 0, ct: last(next).ctMem ?? 0 });
      }
      case 'conflict':
        return b.conflict ? bi('Версии разошлись: на одном сервере без изоляции одно из приложений не запускается.', 'The versions diverged: on one server without isolation one of the applications does not start.') : bi('Версии совпали: на голом сервере оба приложения уживаются.', 'The versions match: both applications get along on the bare server.');
      case 'vuln':
        return b.vuln ? bi('Уязвимость в ядре задевает всех, кто его делит: в ВМ — одну, у контейнеров — все.', 'A kernel vulnerability hits everyone who shares that kernel: one VM, but all the containers.') : bi('Уязвимость закрыта.', 'The vulnerability is patched.');
      case 'otherKernel':
        return b.otherKernel ? bi('Контейнер не может принести своё ядро — он использует ядро хоста; ВМ может.', 'A container cannot bring its own kernel — it uses the host’s; a VM can.') : bi('Всем приложениям подходит ядро Linux.', 'A Linux kernel suits every application.');
    }
    return bi('Модель пересчитана.', 'The model is recomputed.');
  },
});
