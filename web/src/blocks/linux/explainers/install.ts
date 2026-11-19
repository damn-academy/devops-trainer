// «From a blank disk to login:» (design 00 §6.13): what the install writes
// and in which order the machine reads it back on the first boot. BIOS and
// GRUB on GPT follow the GRUB manual (boot.img in sector 0, core.img in the
// BIOS boot partition), the initramfs part follows Alpine's mkinitfs (the
// `lvm` feature activates volume groups before the root is mounted), the end
// follows OpenRC's localmount reading /etc/fstab.
//
// Reading order: at the start there are only the firmware and sector 0; each
// stage of the boot appears when the previous one hands control to it, and
// every acting stage says in a callout what it reads.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { DiagramNode, ElementState, NodeIcon, NodeWork, Step } from '../../../core/types';
import { fmtb } from './util';

type P = { table: string; lvm: boolean; fstab: string };

const man = (name: string, sec: number) => ({ url: `https://man7.org/linux/man-pages/man${sec}/${name}.${sec}.html`, label: `${name}(${sec})` });
const GRUB = { url: 'https://www.gnu.org/software/grub/manual/grub/grub.html#BIOS-installation', label: 'GRUB manual · BIOS installation' };
const MKINITFS = { url: 'https://wiki.alpinelinux.org/wiki/Initramfs_init', label: 'Alpine Wiki · initramfs' };

const box = (id: string, label: Bi | string, sub: string, x: number, y: number, w: number, family: DiagramNode['family'], icon: NodeIcon, what: Bi, who: Bi, see?: string, doc?: { url: string; label: string }, work?: NodeWork): DiagramNode => ({
  id,
  label,
  sub,
  x,
  y,
  w,
  h: 60,
  family,
  icon,
  work,
  card: { what, who, see, doc },
});

const ALL = ['bios', 'mbr', 'biosboot', 'boot', 'kernel', 'initramfs', 'lvm', 'root', 'init', 'fstab', 'login', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10'];
const startWith = (...shown: string[]): Record<string, ElementState> => Object.fromEntries(ALL.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

export const installModel = defineModel<P>({
  id: 'linux.install',
  block: 'linux',
  title: bi('Как машина загружается с только что установленного диска', 'How a machine boots from a freshly installed disk'),
  summary: bi(
    'Установка записала на диск несколько частей, и при первой загрузке машина читает их по очереди: сначала начало диска, потом раздел BIOS boot, затем каталог `/boot` с ядром и initramfs, тома LVM, корневую файловую систему и файл fstab. У каждого звена этой цепочки есть своя поломка и своё сообщение об ошибке.',
    'The install wrote several parts to the disk, and on the first boot the machine reads them in turn: first the start of the disk, then the BIOS boot partition, then `/boot` with the kernel and the initramfs, the LVM volumes, the root file system and fstab. Each link of this chain has its own break and its own error message.',
  ),
  intro: bi(
    'Сейчас на схеме только прошивка и первый сектор диска, а остальные ступени загрузки появятся тогда, когда до них дойдёт управление. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко рядом с подсвеченной ступенью говорит, что она читает, а карточка на линии показывает, что она передаёт следующей.\n\nКогда дойдёте до приглашения login:, выберите в «Параметрах» таблицу MBR и пройдите загрузку ещё раз.',
    'Now the diagram shows only the firmware and the first sector of the disk; the other stages of the boot appear when control reaches them. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout next to the highlighted stage says what it reads, and the card on the line shows what it hands to the next one.\n\nOnce you reach the login: prompt, choose the MBR table in “Parameters” and walk the boot again.',
  ),
  legend: [
    { mark: 'active', text: bi('ступень загрузки, которая работает сейчас', 'the boot stage working now') },
    { mark: 'say', text: bi('что эта ступень читает или делает', 'what that stage reads or does') },
    { mark: 'token', text: bi('что передаётся следующей ступени', 'what is handed to the next stage') },
    { mark: 'icon:disk', text: bi('часть диска, которую записала установка', 'a part of the disk the install wrote') },
    { mark: 'icon:process', text: bi('программа, которая работает в памяти', 'a program running in memory') },
    { mark: 'ok', text: bi('ступень пройдена', 'stage passed') },
    { mark: 'err', text: bi('здесь загрузка остановилась', 'the boot stopped here') },
  ],
  stopLabel: bi('Загрузка остановилась', 'The boot stopped'),
  concepts: ['linux.gpt', 'linux.lvm', 'linux.initramfs'],
  diagram: {
    width: 960,
    height: 480,
    nodes: [
      box('bios', 'SeaBIOS', 'firmware', 24, 30, 170, 'kernel', 'server', bi('Прошивка машины ничего не знает ни о файловых системах, ни о Linux. Она только читает первый сектор диска и передаёт управление программе, которая в нём записана.', 'The machine’s firmware knows nothing of file systems or of Linux. It only reads the first sector of the disk and hands control to the program written there.'), bi('Прошивка встроена в машину, а здесь в эмулятор, который запускает машину во вкладке.', 'The firmware is built into the machine, here into the emulator that runs the machine in the tab.'), undefined, undefined, 'spin'),
      box('mbr', bi('Сектор 0', 'Sector 0'), 'boot.img · 440 B', 260, 30, 190, 'store', 'disk', bi('Сектор 0 открывает диск, и в его первых 440 байтах даже на диске GPT лежит крошечная программа GRUB. Её единственная задача состоит в том, чтобы найти и загрузить следующую часть загрузчика.', 'Sector 0 opens the disk, and even on a GPT disk its first 440 bytes hold a tiny GRUB program. Its only job is to find and load the next part of the loader.'), bi('Эту программу пишет на диск команда `grub-install`, которую вызывает `setup-disk`.', '`grub-install` writes the program to the disk, called by `setup-disk`.'), 'dd if=/dev/sda bs=440 count=1 | xxd | tail -2', GRUB),
      box('biosboot', 'BIOS boot', '/dev/sda1 · core.img', 520, 30, 200, 'store', 'disk', bi('Раздел BIOS boot занимает 2 МиБ, и файловой системы на нём нет. На диске GPT сюда записана основная часть GRUB вместе с драйверами ext4 и LVM.', 'The BIOS boot partition takes 2 MiB and has no file system. On a GPT disk the main part of GRUB is written here together with its ext4 and LVM drivers.'), bi('Раздел с типом BIOS boot создали вы, а заполнила его команда `grub-install`.', 'You created the partition with type BIOS boot, and `grub-install` filled it.'), 'sfdisk -l /dev/sda', GRUB),
      box('boot', '/boot', '/dev/sda2 · ext4', 780, 30, 160, 'store', 'folder', bi('На разделе /boot создана обычная файловая система ext4, и в ней лежат ядро `vmlinuz-virt`, файл `initramfs-virt` и меню `grub/grub.cfg`. В меню записано, какое ядро загружать и где искать корень.', 'The /boot partition carries an ordinary ext4 file system holding the kernel `vmlinuz-virt`, the file `initramfs-virt` and the menu `grub/grub.cfg`. The menu says which kernel to load and where to find the root.'), bi('Пакет ядра ставит команда `setup-disk`, и она же пишет файл `grub.cfg`, вызывая `grub-mkconfig`.', '`setup-disk` installs the kernel package and writes `grub.cfg` by calling `grub-mkconfig`.'), 'grep -m1 "linux\\s" /boot/grub/grub.cfg'),
      box('kernel', bi('Ядро', 'The kernel'), 'vmlinuz-virt', 780, 160, 160, 'kernel', 'process', bi('GRUB загружает в память ядро и initramfs и передаёт ядру строку параметров вида `root=/dev/vg0/root modules=…`.', 'GRUB loads the kernel and the initramfs into memory and passes the kernel a parameter line like `root=/dev/vg0/root modules=…`.'), bi('Ядро ставится из пакета `linux-virt`.', 'The kernel comes from the `linux-virt` package.'), 'cat /proc/cmdline', man('bootparam', 7), 'pulse'),
      box('initramfs', 'initramfs', 'mkinitfs · features', 520, 160, 200, 'process', 'file', bi('В файле initramfs записана маленькая система, которую ядро распаковывает в память и запускает первой. Работа этой системы состоит в том, чтобы найти и смонтировать настоящий корень: загрузить модули диска и ext4 и включить группы томов LVM.', 'The initramfs file holds a small system that the kernel unpacks into memory and runs first. Its job is to find and mount the real root: load the disk and ext4 modules and switch on the LVM volume groups.'), bi('Её собирает команда `mkinitfs` по списку `features` из файла `/etc/mkinitfs/mkinitfs.conf`.', '`mkinitfs` builds it from the `features` list in `/etc/mkinitfs/mkinitfs.conf`.'), 'cat /etc/mkinitfs/mkinitfs.conf', MKINITFS, 'spin'),
      box('lvm', 'LVM', 'sda3 → vg0 → root', 260, 160, 190, 'store', 'disk', bi('Корень лежит на логическом томе `root` из группы томов `vg0`, а сама группа собрана на физическом томе в разделе `/dev/sda3`. Ядро видит этот том как `/dev/mapper/vg0-root` только после того, как группа включена.', 'The root lives on the logical volume `root` in the volume group `vg0`, and the group itself is built on the physical volume in `/dev/sda3`. The kernel sees the volume as `/dev/mapper/vg0-root` only after the group is switched on.'), bi('Всё это вы создали командами `pvcreate`, `vgcreate` и `lvcreate`.', 'You created all of it with `pvcreate`, `vgcreate` and `lvcreate`.'), 'lvs', man('lvm', 8)),
      box('root', '/', '/dev/vg0/root · ext4', 24, 160, 170, 'store', 'folder', bi('В корневой файловой системе установленной системы лежат каталоги `/etc`, `/usr` и `/var`. initramfs монтирует её и передаёт ему управление командой `switch_root`.', 'The root file system of the installed system holds `/etc`, `/usr` and `/var`. The initramfs mounts it and hands control to it with `switch_root`.'), bi('Файловую систему создали вы командой `mkfs.ext4`, а пакетами её наполнила команда `setup-disk`.', 'You created the file system with `mkfs.ext4`, and `setup-disk` filled it with packages.'), 'findmnt /'),
      box('init', 'OpenRC', 'PID 1 → localmount', 24, 300, 170, 'process', 'process', bi('Первым процессом установленной системы работает программа busybox init, а службы она запускает через систему OpenRC. Сначала запускаются службы уровня `boot`, и среди них служба `localmount` монтирует всё, что записано в `/etc/fstab`.', 'busybox init runs as the first process of the installed system, and it starts services through OpenRC. First come the `boot` runlevel services, and among them `localmount` mounts everything listed in `/etc/fstab`.'), bi('Программа busybox init запускает по очереди уровни `sysinit`, `boot` и `default`.', 'busybox init runs the `sysinit`, `boot` and `default` runlevels in turn.'), 'rc-status boot', undefined, 'dots'),
      box('fstab', '/etc/fstab', 'UUID=… /boot', 260, 300, 190, 'store', 'file', bi('В файле /etc/fstab перечислено, что и куда монтировать после корня. Каталог `/boot` записан по UUID файловой системы, а корень записан по имени тома LVM, которое не меняется при добавлении дисков.', '/etc/fstab lists what to mount where after the root. `/boot` is written by the file system’s UUID, and the root by the LVM volume name, which does not change when disks are added.'), bi('Файл пишет команда `setup-disk` по тому, что смонтировано в `/mnt`.', '`setup-disk` writes the file from what is mounted under `/mnt`.'), 'cat /etc/fstab', man('fstab', 5)),
      box('login', 'login:', 'getty ttyS0', 520, 300, 200, 'node', 'lock', bi('Приглашение войти в систему появляется на консоли и означает, что система загрузилась сама, без установочного носителя.', 'The login prompt appears on the console and means the system booted by itself, without the installer media.'), bi('Приглашение печатает программа getty, которая записана в `/etc/inittab`.', 'getty, listed in `/etc/inittab`, prints the prompt.')),
    ],
    edges: [
      { id: 'e1', from: 'bios', to: 'mbr', label: bi('чтение сектора 0', 'reading sector 0'), card: { what: bi('Прошивка читает первый сектор и проверяет подпись 55 AA в его конце, а без этой подписи считает диск незагрузочным.', 'The firmware reads the first sector and checks the 55 AA signature at its end, and without it treats the disk as not bootable.'), who: bi('Чтение выполняет SeaBIOS.', 'SeaBIOS does the reading.') } },
      { id: 'e2', from: 'mbr', to: 'biosboot', label: bi('загрузка core.img', 'loading core.img'), card: { what: bi('В 440 байт помещается только адрес следующей части загрузчика, а на диске GPT эта часть лежит в разделе BIOS boot.', '440 bytes hold only the address of the next part of the loader, and on a GPT disk that part lives in the BIOS boot partition.'), who: bi('Загрузку выполняет программа GRUB boot.img.', 'GRUB boot.img does the loading.'), doc: GRUB } },
      { id: 'e3', from: 'biosboot', to: 'boot', label: bi('чтение меню grub.cfg', 'reading the grub.cfg menu'), card: { what: bi('Основная часть GRUB понимает ext4 и находит меню в `/boot/grub/grub.cfg`.', 'The main part of GRUB understands ext4 and finds the menu in `/boot/grub/grub.cfg`.'), who: bi('Меню читает GRUB core.img.', 'GRUB core.img reads the menu.') } },
      { id: 'e4', from: 'boot', to: 'kernel', label: bi('ядро и initramfs в память', 'kernel and initramfs into memory'), card: { what: bi('GRUB кладёт в память ядро и initramfs и передаёт ядру строку `root=…`.', 'GRUB puts the kernel and the initramfs into memory and passes the kernel the line `root=…`.'), who: bi('Ядро и initramfs в память кладёт загрузчик GRUB.', 'The GRUB boot loader puts the kernel and the initramfs into memory.') } },
      { id: 'e5', from: 'kernel', to: 'initramfs', label: bi('запуск /init', 'running /init'), card: { what: bi('Ядро распаковывает initramfs в память и запускает её программу `/init`.', 'The kernel unpacks the initramfs into memory and runs its `/init` program.'), who: bi('Программу /init запускает ядро.', 'The kernel runs /init.') } },
      { id: 'e6', from: 'initramfs', to: 'lvm', label: bi('включение группы томов', 'switching on the volume group'), card: { what: bi('Если в initramfs есть часть `lvm`, она включает группы томов командой `vgchange -ay`, и появляется устройство `/dev/vg0/root`.', 'If the initramfs has the `lvm` feature, it switches on the volume groups with `vgchange -ay`, and `/dev/vg0/root` appears.'), who: bi('Группу томов включает initramfs.', 'The initramfs switches on the volume group.'), doc: MKINITFS } },
      { id: 'e7', from: 'lvm', to: 'root', label: bi('монтирование корня', 'mounting the root'), card: { what: bi('initramfs монтирует том как корень и выполняет `switch_root`, и дальше работает система с диска.', 'The initramfs mounts the volume as the root and runs `switch_root`, and from there the system on the disk runs.'), who: bi('Корень монтирует initramfs.', 'The initramfs mounts the root.') } },
      { id: 'e8', from: 'root', to: 'init', label: bi('запуск первого процесса', 'starting the first process'), card: { what: bi('Первым процессом становится программа init установленной системы.', 'The installed system’s init becomes the first process.'), who: bi('Программу init запускает ядро.', 'The kernel starts init.') } },
      { id: 'e9', from: 'init', to: 'fstab', label: bi('монтирование по fstab', 'mounting by fstab'), card: { what: bi('Служба `localmount` монтирует всё, что записано в `/etc/fstab`, в том числе `/boot`.', 'The `localmount` service mounts everything listed in `/etc/fstab`, `/boot` included.'), who: bi('Службу запускает OpenRC.', 'OpenRC starts the service.'), doc: man('fstab', 5) } },
      { id: 'e10', from: 'fstab', to: 'login', label: bi('приглашение войти', 'the login prompt'), card: { what: bi('Когда уровни `boot` и `default` запущены, на консоли появляется приглашение войти.', 'Once the `boot` and `default` runlevels are up, the login prompt appears on the console.'), who: bi('Программу getty запускает init.', 'init starts getty.') } },
    ],
  },
  params: [
    {
      id: 'table',
      label: bi('Какая таблица разделов записана на диск', 'Which partition table is on the disk'),
      kind: 'choice',
      default: 'gpt',
      options: [
        { id: 'gpt', label: bi('GPT, современная таблица', 'GPT, the modern table') },
        { id: 'dos', label: bi('MBR (dos), старая таблица', 'MBR (dos), the old table') },
      ],
      near: 'biosboot',
      group: bi('Как размечен диск', 'How the disk is laid out'),
      predict: {
        prompt: bi('На диске с таблицей MBR раздела BIOS boot нет. Где тогда лежит основная часть GRUB?', 'A disk with an MBR table has no BIOS boot partition. Where does the main part of GRUB live then?'),
        options: [
          { id: 'gap', text: bi('В промежутке между сектором 0 и первым разделом', 'In the gap between sector 0 and the first partition') },
          { id: 'boot', text: bi('В отдельном файле на разделе /boot', 'In a separate file on the /boot partition') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'gap') ? 'gap' : 'boot'),
      },
    },
    { id: 'lvm', label: bi('Корень лежит на томе LVM', 'The root is on an LVM volume'), kind: 'toggle', default: true, near: 'lvm', group: bi('Как размечен диск', 'How the disk is laid out') },
    {
      id: 'fstab',
      label: bi('Как каталог /boot записан в fstab', 'How /boot is written in fstab'),
      kind: 'choice',
      default: 'uuid',
      options: [
        { id: 'uuid', label: bi('по UUID файловой системы', 'by the file system’s UUID') },
        { id: 'dev', label: bi('по имени устройства /dev/sda2', 'by the device name /dev/sda2') },
      ],
      near: 'fstab',
      group: bi('Что записано в fstab', 'What fstab says'),
      levels: ['intermediate', 'experienced'],
    },
  ],
  breaks: [
    {
      id: 'no-loader',
      label: bi('Загрузчик не записан на диск, потому что grub-install не выполнялся', 'The boot loader is not on the disk, because grub-install never ran'),
      remove: ['e1'],
      boundary: 'storage',
      predict: {
        prompt: bi('Все файлы системы на месте, но команда `grub-install` не выполнялась, и в секторе 0 загрузчика нет. Что произойдёт после перезагрузки?', 'All the system’s files are in place, but `grub-install` never ran, and sector 0 holds no boot loader. What happens after the reboot?'),
        options: [
          { id: 'nodisk', text: bi('Прошивка не найдёт ни одного загрузочного диска', 'The firmware finds no bootable disk') },
          { id: 'boots', text: bi('Система загрузится, потому что ядро лежит на /boot', 'The system boots, because the kernel is on /boot') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'mbr') ? 'nodisk' : 'boots'),
      },
    },
    {
      id: 'no-lvm',
      label: bi('initramfs собрана без части lvm', 'The initramfs was built without the lvm feature'),
      remove: ['e6'],
      boundary: 'storage',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('Ядро и GRUB в порядке, а корень лежит на томе LVM, но initramfs собрана без части `lvm`. На каком шаге остановится загрузка?', 'The kernel and GRUB are fine, and the root is on an LVM volume, but the initramfs was built without `lvm`. At which step does the boot stop?'),
        options: [
          { id: 'root', text: bi('Корень не найдётся, и запустится аварийная оболочка initramfs', 'The root is not found, and the initramfs emergency shell starts') },
          { id: 'grub', text: bi('GRUB не сможет показать меню', 'GRUB cannot show the menu') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'initramfs') ? 'root' : 'grub'),
      },
    },
    {
      id: 'shifted',
      label: bi('Каталог /boot записан как /dev/sda2, а к машине добавили второй диск', '/boot is written as /dev/sda2, and a second disk was added to the machine'),
      remove: ['e9'],
      boundary: 'storage',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('Новый диск стал называться `/dev/sda`, прежний стал `/dev/sdb`, а в fstab записано `/dev/sda2 /boot`. Что произойдёт с каталогом `/boot`?', 'The new disk became `/dev/sda`, the old one became `/dev/sdb`, and fstab says `/dev/sda2 /boot`. What happens to `/boot`?'),
        options: [
          { id: 'lost', text: bi('Каталог /boot не смонтируется, или на его место смонтируется раздел другого диска', 'It does not mount, or a partition of the other disk mounts in its place') },
          { id: 'always', text: bi('Каталог /boot смонтируется как раньше', '/boot mounts as before') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'fstab') ? 'lost' : 'always'),
      },
    },
  ],
  metrics: [
    { id: 'stage', label: bi('ступень загрузки', 'boot stage') },
    { id: 'reads', label: bi('чтений с диска до приглашения login:', 'disk reads before the login: prompt') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    let n = 0;
    const m = () => ({ stage: steps.length + 1, reads: n });
    n++;
    steps.push({
      id: 'firmware',
      label: 'BIOS',
      caption: bi('Установочный носитель извлечён, и машину перезагрузили. Прошивка читает первый сектор диска.', 'The installer media is removed, and the machine is rebooted. The firmware reads the first sector of the disk.'),
      focus: ['e1', 'mbr'],
      tokens: [{ edge: 'e1', label: '512 B' }],
      say: { bios: broken.has('no-loader') ? bi('Прошивка читает сектор 0 и не находит в нём загрузчика.', 'The firmware reads sector 0 and finds no boot loader in it.') : bi('Прошивка читает сектор 0 и передаёт управление программе, которая в нём записана.', 'The firmware reads sector 0 and hands control to the program written there.') },
      states: { ...startWith('bios', 'mbr', 'e1'), bios: 'on', mbr: broken.has('no-loader') ? 'err' : 'on' },
      metrics: m(),
      broken: broken.has('no-loader') ? { at: 'mbr', message: 'No bootable device.', caption: bi('В секторе 0 нет загрузчика, и прошивке дальше идти некуда. Узнают эту поломку по сообщению «No bootable device» сразу после включения, ещё до меню GRUB. В лаборатории в таком случае снова загрузится установочный носитель.', 'Sector 0 holds no boot loader, and the firmware has nowhere to go. You recognise this break by “No bootable device” right after power-on, before any GRUB menu. In the lab the installer media then boots again.') } : undefined,
    });
    if (broken.has('no-loader')) return steps;
    n++;
    steps.push(
      p.table === 'gpt'
        ? {
            id: 'core',
            label: 'core.img',
            caption: bi('Крошечная программа boot.img загружает основную часть GRUB, core.img, из раздела BIOS boot, потому что на диске GPT для неё отведено отдельное место.', 'The tiny boot.img loads the main part of GRUB, core.img, from the BIOS boot partition, because a GPT disk gives it a place of its own.'),
            focus: ['e2', 'biosboot'],
            reveal: ['biosboot', 'e2'],
            tokens: [{ edge: 'e2', label: 'core.img' }],
            say: { mbr: bi('Программа в секторе 0 знает только адрес раздела BIOS boot и загружает оттуда core.img.', 'The program in sector 0 knows only the address of the BIOS boot partition and loads core.img from it.') },
            states: { mbr: 'ok', biosboot: 'on' },
            metrics: m(),
          }
        : {
            id: 'gap',
            label: 'core.img',
            caption: bi('На диске MBR программа core.img лежит в промежутке между сектором 0 и первым разделом. Раздел BIOS boot здесь не нужен, но промежуток должен быть, обычно размером 1 МиБ.', 'On an MBR disk core.img lives in the gap between sector 0 and the first partition. No BIOS boot partition is needed here, but the gap must be there, usually 1 MiB.'),
            focus: ['e2', 'biosboot'],
            reveal: ['biosboot', 'e2'],
            tokens: [{ edge: 'e2', label: 'core.img' }],
            say: { mbr: bi('Программа в секторе 0 загружает core.img из промежутка перед первым разделом.', 'The program in sector 0 loads core.img from the gap before the first partition.') },
            states: { mbr: 'ok', biosboot: 'on' },
            values: { biosboot: 'MBR gap' },
            metrics: m(),
          },
    );
    n++;
    steps.push({
      id: 'menu',
      label: 'grub.cfg',
      caption: bi('GRUB читает меню с раздела `/boot` и находит в нём строку `linux /vmlinuz-virt root=…`.', 'GRUB reads the menu from `/boot` and finds the line `linux /vmlinuz-virt root=…` in it.'),
      focus: ['e3', 'boot'],
      reveal: ['boot', 'e3'],
      tokens: [{ edge: 'e3', label: 'grub.cfg' }],
      say: { biosboot: bi('GRUB открывает файловую систему ext4 на /boot и читает меню grub.cfg.', 'GRUB opens the ext4 file system on /boot and reads the grub.cfg menu.') },
      states: { biosboot: 'ok', boot: 'on' },
      metrics: m(),
    });
    n += 2;
    steps.push({
      id: 'kernel',
      label: bi('ядро', 'kernel'),
      caption: fmtb(bi('Ядро и initramfs загружены в память, а ядру передана строка параметров `root={r}`. Ядро запускает программу `/init` из initramfs.', 'The kernel and the initramfs are in memory, and the kernel got the parameter line `root={r}`. The kernel runs `/init` from the initramfs.'), { r: p.lvm ? '/dev/mapper/vg0-root' : '/dev/sda3' }),
      focus: ['e4', 'kernel'],
      reveal: ['kernel', 'e4', 'initramfs', 'e5'],
      tokens: [{ edge: 'e4', label: 'vmlinuz + initramfs' }, { edge: 'e5', label: '/init' }],
      say: { kernel: bi('Ядро запускает оборудование и передаёт управление программе /init из initramfs.', 'The kernel brings up the hardware and hands control to /init from the initramfs.') },
      states: { boot: 'ok', kernel: 'on', initramfs: 'on' },
      metrics: m(),
    });
    if (p.lvm) {
      steps.push({
        id: 'vg',
        label: 'LVM',
        caption: broken.has('no-lvm')
          ? bi('В этой initramfs нет части `lvm`, поэтому включить группы томов нечем, и устройство `/dev/vg0/root` так и не появляется.', 'This initramfs has no `lvm` feature, so nothing can switch on the volume groups, and `/dev/vg0/root` never appears.')
          : bi('initramfs включает группу томов `vg0`, и в системе появляется устройство `/dev/vg0/root`.', 'The initramfs switches on the volume group `vg0`, and `/dev/vg0/root` appears in the system.'),
        focus: ['e6', 'lvm'],
        reveal: ['lvm', 'e6'],
        tokens: [{ edge: 'e6', label: 'vgchange -ay' }],
        say: { initramfs: broken.has('no-lvm') ? bi('initramfs ищет корень /dev/vg0/root, но включить группу томов ей нечем.', 'The initramfs looks for the root /dev/vg0/root but has nothing to switch on the volume group with.') : bi('initramfs включает группу томов vg0, чтобы появился том с корнем.', 'The initramfs switches on vg0 so that the volume with the root appears.') },
        states: { lvm: broken.has('no-lvm') ? 'err' : 'on', initramfs: broken.has('no-lvm') ? 'err' : 'on', kernel: 'ok' },
        metrics: m(),
        broken: broken.has('no-lvm') ? { at: 'initramfs', message: 'mounting /dev/mapper/vg0-root on /sysroot failed: No such file or directory\nmounting root: failed.\ninitramfs emergency recovery shell launched', caption: bi('Чинят это с установочного носителя: монтируют систему, добавляют `lvm` в список `features` и пересобирают initramfs командой `mkinitfs` внутри chroot. Узнают эту поломку по аварийной оболочке initramfs и строке «mounting root: failed».', 'This is fixed from the installer media: mount the system, add `lvm` to `features` and rebuild the initramfs with `mkinitfs` inside a chroot. You recognise this break by the initramfs emergency shell and the line “mounting root: failed”.') } : undefined,
      });
      if (broken.has('no-lvm')) return steps;
    }
    n++;
    steps.push({
      id: 'root',
      label: '/',
      caption: bi('Корень смонтирован, и `switch_root` передаёт управление системе на диске, а память, которую занимала initramfs, освобождается. Первым процессом становится программа init, которая запускает службы через OpenRC.', 'The root is mounted, and `switch_root` hands control to the system on the disk, while the memory the initramfs took is freed. init becomes the first process and starts services through OpenRC.'),
      focus: [p.lvm ? 'e7' : 'e5', 'root'],
      reveal: p.lvm ? ['root', 'e7', 'init', 'e8'] : ['root', 'init', 'e8'],
      tokens: p.lvm ? [{ edge: 'e7', label: 'switch_root' }, { edge: 'e8', label: 'PID 1' }] : [{ edge: 'e8', label: 'PID 1' }],
      say: { root: bi('Корневая файловая система смонтирована, и управление переходит к системе на диске.', 'The root file system is mounted, and control passes to the system on the disk.') },
      states: { initramfs: 'ok', lvm: 'ok', root: 'on', init: 'on' },
      metrics: m(),
    });
    const lost = broken.has('shifted');
    n++;
    steps.push({
      id: 'fstab',
      label: 'fstab',
      caption: lost
        ? bi('В fstab записано `/dev/sda2`, а это теперь раздел другого диска, поэтому `/boot` не смонтирован или смонтирован не тот раздел. Система загрузится, но следующее обновление ядра запишется не туда.', 'fstab says `/dev/sda2`, and that is now a partition of the other disk, so `/boot` is not mounted, or the wrong partition is. The system comes up, but the next kernel update is written to the wrong place.')
        : p.fstab === 'dev'
          ? bi('Служба `localmount` монтирует `/dev/sda2` в `/boot`. Пока диск один, это работает, а запись по UUID работала бы и после замены дисков.', '`localmount` mounts `/dev/sda2` at `/boot`. While there is one disk this works, and a UUID entry would keep working after the disks change.')
          : bi('Служба `localmount` монтирует `/boot` по UUID, записанному в fstab.', '`localmount` mounts `/boot` by the UUID written in fstab.'),
      focus: ['e9', 'fstab'],
      reveal: ['fstab', 'e9'],
      tokens: [{ edge: 'e9', label: p.fstab === 'uuid' && !lost ? 'UUID=…' : '/dev/sda2' }],
      say: { init: lost ? bi('Служба localmount пытается смонтировать /dev/sda2 в /boot и получает ошибку.', 'localmount tries to mount /dev/sda2 at /boot and gets an error.') : bi('Служба localmount читает fstab и монтирует каталог /boot.', 'localmount reads fstab and mounts /boot.') },
      states: { root: 'ok', fstab: lost ? 'err' : 'ok' },
      metrics: m(),
      broken: lost ? { at: 'fstab', message: 'localmount: mount: mounting /dev/sda2 on /boot failed: Invalid argument', caption: bi('Имя устройства зависит от порядка дисков, а UUID от него не зависит. Узнают эту поломку по ошибке службы localmount при загрузке и по пустому каталогу /boot.', 'A device name depends on the order of the disks, and a UUID does not. You recognise this break by the localmount error at boot and an empty /boot.') } : undefined,
    });
    steps.push({
      id: 'login',
      label: 'login:',
      caption: bi('Уровни `boot` и `default` запущены, и программа getty печатает `shop-01 login:`. Установка удалась, и машина загружается сама.', 'The `boot` and `default` runlevels are up, and getty prints `shop-01 login:`. The install worked, and the machine boots by itself.'),
      focus: ['e10', 'login'],
      reveal: ['login', 'e10'],
      tokens: [{ edge: 'e10', label: 'shop-01 login:' }],
      say: { login: bi('На консоли появилось приглашение войти, и система ждёт имя пользователя.', 'The login prompt appeared on the console, and the system waits for a user name.') },
      states: { init: 'ok', login: 'ok' },
      metrics: m(),
    });
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    const stop = next.find((s) => s.broken);
    const lbl = (l: Step['label'], lang: 'ru' | 'en') => (typeof l === 'string' ? l : l[lang]);
    const end: Bi = stop ? bi('загрузка останавливается на шаге «' + lbl(stop.label, 'ru') + '»', 'the boot stops at the step “' + lbl(stop.label, 'en') + '”') : bi('машина доходит до приглашения login:', 'the machine reaches the login: prompt');
    if (change.kind === 'break') return change.on ? fmtb(bi('Поломка включена, и теперь {e}.', 'The break is on, and now {e}.'), { e: end }) : bi('Поломку убрали, и машина снова загружается до приглашения login:.', 'The break is removed, and the machine again boots to the login: prompt.');
    if (change.id === 'table') return b.table === 'gpt' ? bi('На диске GPT основной части GRUB нужен отдельный раздел BIOS boot.', 'On a GPT disk the main part of GRUB needs a separate BIOS boot partition.') : bi('На диске MBR основная часть GRUB лежит в промежутке перед первым разделом.', 'On an MBR disk the main part of GRUB lives in the gap before the first partition.');
    if (change.id === 'lvm') return b.lvm ? bi('Корень лежит на томе LVM, поэтому initramfs должна сначала включить группу томов.', 'The root is on an LVM volume, so the initramfs must first switch on the volume group.') : bi('Корень лежит на обычном разделе, и шаг с LVM не нужен.', 'The root is on a plain partition, and the LVM step is not needed.');
    return fmtb(bi('Параметр изменился, и теперь {e}.', 'The parameter changed, and now {e}.'), { e: end });
  },
});
