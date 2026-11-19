// «From a blank disk to login:» (design 00 §6.13): what the install writes
// and in which order the machine reads it back on the first boot. BIOS and
// GRUB on GPT follow the GRUB manual (boot.img in sector 0, core.img in the
// BIOS boot partition), the initramfs part follows Alpine's mkinitfs (the
// `lvm` feature activates volume groups before the root is mounted), the end
// follows OpenRC's localmount reading /etc/fstab.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { fmtb } from './util';

type P = { table: string; lvm: boolean; fstab: string };

const man = (name: string, sec: number) => ({ url: `https://man7.org/linux/man-pages/man${sec}/${name}.${sec}.html`, label: `${name}(${sec})` });
const GRUB = { url: 'https://www.gnu.org/software/grub/manual/grub/grub.html#BIOS-installation', label: 'GRUB manual · BIOS installation' };
const MKINITFS = { url: 'https://wiki.alpinelinux.org/wiki/Initramfs_init', label: 'Alpine Wiki · initramfs' };

const box = (id: string, label: Bi | string, sub: string, x: number, y: number, w: number, family: 'kernel' | 'store' | 'process' | 'node' | 'neutral', icon: 'disk' | 'file' | 'process' | 'server' | 'folder' | 'lock', what: Bi, who: Bi, see?: string, doc?: { url: string; label: string }) => ({
  id,
  label,
  sub,
  x,
  y,
  w,
  h: 60,
  family,
  icon,
  card: { what, who, see, doc },
});

export const installModel = defineModel<P>({
  id: 'linux.install',
  block: 'linux',
  title: bi('От пустого диска до login:', 'From a blank disk to login:'),
  summary: bi(
    'Что установка записывает на диск и в каком порядке машина читает это обратно при первой загрузке: запись в начале диска, раздел BIOS boot, `/boot` с ядром и initramfs, тома LVM, корень и fstab. У каждого звена своя поломка и своё сообщение.',
    'What the install writes to the disk and in which order the machine reads it back on the first boot: the record at the start of the disk, the BIOS boot partition, `/boot` with the kernel and the initramfs, the LVM volumes, the root and fstab. Each link has its own break and its own message.',
  ),
  intro: bi('Нажимайте «Дальше»: каждая ступень загрузки читает то, что положила установка. Потом ломайте звенья по одному.', 'Press “Next”: each stage of the boot reads what the install put there. Then break the links one at a time.'),
  concepts: ['linux.gpt', 'linux.lvm', 'linux.initramfs'],
  diagram: {
    width: 960,
    height: 480,
    nodes: [
      box('bios', 'SeaBIOS', 'firmware', 24, 30, 170, 'kernel', 'server', bi('Прошивка машины. Она не знает ни файловых систем, ни Linux: читает первый сектор диска и передаёт ему управление.', 'The machine’s firmware. It knows neither file systems nor Linux: it reads the first sector of the disk and hands control to it.'), bi('Встроена в машину (здесь — в эмулятор).', 'Built into the machine (here, into the emulator).')),
      box('mbr', bi('сектор 0', 'sector 0'), 'boot.img · 440 B', 260, 30, 190, 'store', 'disk', bi('Первые 440 байт диска. На GPT здесь тоже живёт крошечная программа GRUB: её единственная задача — найти и загрузить следующую часть.', 'The first 440 bytes of the disk. On GPT a tiny GRUB program lives here too: its only job is to find and load the next part.'), bi('`grub-install` пишет её на диск (это делает `setup-disk`).', '`grub-install` writes it to the disk (`setup-disk` does this).'), 'dd if=/dev/sda bs=440 count=1 | xxd | tail -2', GRUB),
      box('biosboot', 'BIOS boot', '/dev/sda1 · core.img', 520, 30, 200, 'store', 'disk', bi('Раздел в 2 МиБ без файловой системы. На диске GPT сюда ложится основная часть GRUB с драйверами ext4 и LVM.', 'A 2 MiB partition without a file system. On a GPT disk the main part of GRUB with its ext4 and LVM drivers goes here.'), bi('Вы создали его типом BIOS boot, `grub-install` заполнил.', 'You created it with the type BIOS boot; `grub-install` filled it.'), 'sfdisk -l /dev/sda', GRUB),
      box('boot', '/boot', '/dev/sda2 · ext4', 780, 30, 160, 'store', 'folder', bi('Обычная ext4 с `vmlinuz-virt` (ядро), `initramfs-virt` и `grub/grub.cfg` — меню, где записано, какое ядро грузить и где корень.', 'An ordinary ext4 with `vmlinuz-virt` (the kernel), `initramfs-virt` and `grub/grub.cfg` — the menu that says which kernel to load and where the root is.'), bi('`setup-disk` ставит пакет ядра и пишет `grub.cfg` (`grub-mkconfig`).', '`setup-disk` installs the kernel package and writes `grub.cfg` (`grub-mkconfig`).'), 'grep -m1 "linux\\s" /boot/grub/grub.cfg'),
      box('kernel', bi('ядро', 'kernel'), 'vmlinuz-virt', 780, 160, 160, 'kernel', 'process', bi('GRUB загружает ядро и initramfs в память и передаёт ядру строку параметров: `root=/dev/vg0/root modules=…`.', 'GRUB loads the kernel and the initramfs into memory and passes the kernel a parameter line: `root=/dev/vg0/root modules=…`.'), bi('Пакет `linux-virt`.', 'The `linux-virt` package.'), 'cat /proc/cmdline', man('bootparam', 7)),
      box('initramfs', 'initramfs', 'mkinitfs · features', 520, 160, 200, 'process', 'file', bi('Маленькая система в памяти, которую ядро запускает первой. Её работа — найти и смонтировать настоящий корень: загрузить модули диска и ext4, включить группы томов LVM.', 'A small system in memory that the kernel runs first. Its job is to find and mount the real root: load the disk and ext4 modules, switch on the LVM volume groups.'), bi('`mkinitfs` собирает её по `features` из `/etc/mkinitfs/mkinitfs.conf`.', '`mkinitfs` builds it from the `features` in `/etc/mkinitfs/mkinitfs.conf`.'), 'cat /etc/mkinitfs/mkinitfs.conf', MKINITFS),
      box('lvm', 'LVM', 'sda3 → vg0 → root', 260, 160, 190, 'store', 'disk', bi('Физический том на `/dev/sda3`, группа `vg0`, логический том `root`. Ядро видит том как `/dev/mapper/vg0-root`, только когда группа включена.', 'The physical volume on `/dev/sda3`, the group `vg0`, the logical volume `root`. The kernel sees the volume as `/dev/mapper/vg0-root` only once the group is switched on.'), bi('Вы: `pvcreate`, `vgcreate`, `lvcreate`.', 'You: `pvcreate`, `vgcreate`, `lvcreate`.'), 'lvs', man('lvm', 8)),
      box('root', '/', '/dev/vg0/root · ext4', 24, 160, 170, 'store', 'folder', bi('Корень установленной системы: `/etc`, `/usr`, `/var`. initramfs монтирует его и передаёт ему управление (`switch_root`).', 'The root of the installed system: `/etc`, `/usr`, `/var`. The initramfs mounts it and hands control over to it (`switch_root`).'), bi('Вы: `mkfs.ext4`; `setup-disk` наполнил его пакетами.', 'You: `mkfs.ext4`; `setup-disk` filled it with packages.'), 'findmnt /'),
      box('init', 'OpenRC', 'PID 1 → localmount', 24, 300, 170, 'process', 'process', bi('Первый процесс установленной системы. Он поднимает службы уровня `boot`, и служба `localmount` монтирует всё из `/etc/fstab`.', 'The first process of the installed system. It brings up the `boot` runlevel services, and the `localmount` service mounts everything from `/etc/fstab`.'), bi('busybox init запускает `openrc sysinit`, `boot`, `default`.', 'busybox init runs `openrc sysinit`, `boot`, `default`.'), 'rc-status boot'),
      box('fstab', '/etc/fstab', 'UUID=… /boot', 260, 300, 190, 'store', 'file', bi('Что куда монтировать после корня. `/boot` записан по UUID файловой системы, корень — по имени тома LVM, которое не сдвигается.', 'What to mount where after the root. `/boot` is written by the file system’s UUID, the root by the LVM volume name, which does not shift.'), bi('`setup-disk` пишет его по смонтированному в `/mnt`.', '`setup-disk` writes it from what is mounted under `/mnt`.'), 'cat /etc/fstab', man('fstab', 5)),
      box('login', 'login:', 'getty ttyS0', 520, 300, 200, 'node', 'lock', bi('Приглашение войти на консоли: система загрузилась сама, без носителя.', 'The login prompt on the console: the system has booted by itself, without the media.'), bi('getty из `/etc/inittab`.', 'getty from `/etc/inittab`.')),
    ],
    edges: [
      { id: 'e1', from: 'bios', to: 'mbr', label: bi('читает сектор 0', 'reads sector 0'), card: { what: bi('Прошивка читает первый сектор и проверяет подпись 55 AA в его конце; без неё диск для неё не загрузочный.', 'The firmware reads the first sector and checks the 55 AA signature at its end; without it the disk is not bootable to it.'), who: bi('SeaBIOS', 'SeaBIOS') } },
      { id: 'e2', from: 'mbr', to: 'biosboot', label: bi('грузит core.img', 'loads core.img'), card: { what: bi('440 байт хватает только на адрес следующей части. На GPT она лежит в разделе BIOS boot.', '440 bytes are enough only for the address of the next part. On GPT it lives in the BIOS boot partition.'), who: bi('GRUB boot.img', 'GRUB boot.img'), doc: GRUB } },
      { id: 'e3', from: 'biosboot', to: 'boot', label: bi('читает grub.cfg', 'reads grub.cfg'), card: { what: bi('Основная часть GRUB понимает ext4 и находит меню в `/boot/grub/grub.cfg`.', 'The main part of GRUB understands ext4 and finds the menu in `/boot/grub/grub.cfg`.'), who: bi('GRUB core.img', 'GRUB core.img') } },
      { id: 'e4', from: 'boot', to: 'kernel', label: bi('ядро + initramfs', 'kernel + initramfs'), card: { what: bi('GRUB кладёт в память ядро и initramfs и передаёт строку `root=…`.', 'GRUB puts the kernel and the initramfs into memory and passes the line `root=…`.'), who: bi('GRUB', 'GRUB') } },
      { id: 'e5', from: 'kernel', to: 'initramfs', label: bi('запускает /init', 'runs /init'), card: { what: bi('Ядро распаковывает initramfs в память и запускает её `/init`.', 'The kernel unpacks the initramfs into memory and runs its `/init`.'), who: bi('ядро', 'the kernel') } },
      { id: 'e6', from: 'initramfs', to: 'lvm', label: 'vgchange -ay', card: { what: bi('Если в initramfs есть часть `lvm`, она включает группы томов, и появляется `/dev/vg0/root`.', 'If the initramfs has the `lvm` feature, it switches on the volume groups, and `/dev/vg0/root` appears.'), who: bi('initramfs', 'the initramfs'), doc: MKINITFS } },
      { id: 'e7', from: 'lvm', to: 'root', label: bi('монтирует корень', 'mounts the root'), card: { what: bi('initramfs монтирует том как корень и выполняет `switch_root`: дальше работает система с диска.', 'The initramfs mounts the volume as the root and runs `switch_root`: from here the system on the disk runs.'), who: bi('initramfs', 'the initramfs') } },
      { id: 'e8', from: 'root', to: 'init', label: bi('PID 1', 'PID 1'), card: { what: bi('Первым процессом становится init установленной системы.', 'The installed system’s init becomes the first process.'), who: bi('ядро', 'the kernel') } },
      { id: 'e9', from: 'init', to: 'fstab', label: 'localmount', card: { what: bi('Служба `localmount` монтирует всё из `/etc/fstab`, в том числе `/boot`.', 'The `localmount` service mounts everything from `/etc/fstab`, `/boot` included.'), who: bi('OpenRC', 'OpenRC'), doc: man('fstab', 5) } },
      { id: 'e10', from: 'fstab', to: 'login', label: 'getty', card: { what: bi('Когда уровни `boot` и `default` поднялись, на консоли появляется приглашение.', 'Once the `boot` and `default` runlevels are up, the prompt appears on the console.'), who: bi('init', 'init') } },
    ],
  },
  params: [
    {
      id: 'table',
      label: bi('Таблица разделов', 'Partition table'),
      kind: 'choice',
      default: 'gpt',
      options: [
        { id: 'gpt', label: bi('GPT', 'GPT') },
        { id: 'dos', label: bi('MBR (dos)', 'MBR (dos)') },
      ],
      near: 'biosboot',
      predict: {
        prompt: bi('На диске MBR раздела BIOS boot нет. Где тогда живёт основная часть GRUB?', 'An MBR disk has no BIOS boot partition. Where does the main part of GRUB live then?'),
        options: [
          { id: 'gap', text: bi('В промежутке перед первым разделом', 'In the gap before the first partition') },
          { id: 'boot', text: bi('В файле на /boot', 'In a file on /boot') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'gap') ? 'gap' : 'boot'),
      },
    },
    { id: 'lvm', label: bi('Корень на LVM', 'The root on LVM'), kind: 'toggle', default: true, near: 'lvm' },
    {
      id: 'fstab',
      label: bi('/boot в fstab записан', '/boot in fstab is written'),
      kind: 'choice',
      default: 'uuid',
      options: [
        { id: 'uuid', label: bi('по UUID', 'by UUID') },
        { id: 'dev', label: bi('как /dev/sda2', 'as /dev/sda2') },
      ],
      near: 'fstab',
      levels: ['intermediate', 'experienced'],
    },
  ],
  breaks: [
    {
      id: 'no-loader',
      label: bi('Загрузчик не записан на диск', 'The boot loader was not written to the disk'),
      remove: ['e1'],
      boundary: 'storage',
      predict: {
        prompt: bi('Файлы системы на месте, но `grub-install` не выполнялся. Что будет после перезагрузки?', 'The system’s files are in place, but `grub-install` never ran. What happens after the reboot?'),
        options: [
          { id: 'nodisk', text: bi('Прошивка не найдёт загрузочного диска', 'The firmware finds no bootable disk') },
          { id: 'boots', text: bi('Система загрузится: ядро же на /boot', 'The system boots: the kernel is on /boot') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'mbr') ? 'nodisk' : 'boots'),
      },
    },
    {
      id: 'no-lvm',
      label: bi('В initramfs нет части lvm', 'The initramfs has no lvm feature'),
      remove: ['e6'],
      boundary: 'storage',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('Ядро и GRUB в порядке, но initramfs собран без `lvm`. На каком шаге остановится загрузка?', 'The kernel and GRUB are fine, but the initramfs was built without `lvm`. At which step does the boot stop?'),
        options: [
          { id: 'root', text: bi('Корень не найдётся, будет аварийная оболочка initramfs', 'The root is not found; the initramfs emergency shell appears') },
          { id: 'grub', text: bi('GRUB не покажет меню', 'GRUB shows no menu') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'initramfs') ? 'root' : 'grub'),
      },
    },
    {
      id: 'shifted',
      label: bi('/boot записан как /dev/sda2, и добавили второй диск', '/boot is written as /dev/sda2, and a second disk was added'),
      remove: ['e9'],
      boundary: 'storage',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('Новый диск стал `/dev/sda`, прежний — `/dev/sdb`, а в fstab записано `/dev/sda2 /boot`. Что будет с `/boot`?', 'The new disk became `/dev/sda`, the old one `/dev/sdb`, and fstab says `/dev/sda2 /boot`. What happens to `/boot`?'),
        options: [
          { id: 'lost', text: bi('Не смонтируется или смонтируется чужой раздел', 'It does not mount, or a stranger’s partition mounts') },
          { id: 'always', text: bi('Смонтируется как раньше', 'It mounts as before') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'fstab') ? 'lost' : 'always'),
      },
    },
  ],
  metrics: [
    { id: 'stage', label: bi('ступень загрузки', 'boot stage') },
    { id: 'reads', label: bi('чтений с диска до login:', 'disk reads before login:') },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    let n = 0;
    const m = () => ({ stage: steps.length + 1, reads: n });
    n++;
    steps.push({
      id: 'firmware',
      label: 'BIOS',
      caption: bi('Носителя больше нет. Прошивка читает первый сектор диска.', 'The media is gone. The firmware reads the first sector of the disk.'),
      focus: ['bios', 'e1', 'mbr'],
      tokens: [{ edge: 'e1', label: '512 B' }],
      states: { bios: 'on', mbr: broken.has('no-loader') ? 'err' : 'on' },
      metrics: m(),
      broken: broken.has('no-loader') ? { at: 'mbr', message: 'No bootable device.', caption: bi('в секторе 0 нет загрузчика: дальше прошивке идти некуда. Здесь лаборатория просто загрузит носитель снова.', 'sector 0 holds no boot loader: the firmware has nowhere to go. In the lab the media simply boots again.') } : undefined,
    });
    if (broken.has('no-loader')) return steps;
    n++;
    steps.push(
      p.table === 'gpt'
        ? { id: 'core', label: 'core.img', caption: bi('Крошечный boot.img загружает core.img из раздела BIOS boot: на GPT для него отведено своё место.', 'The tiny boot.img loads core.img from the BIOS boot partition: GPT gives it a place of its own.'), focus: ['mbr', 'e2', 'biosboot'], tokens: [{ edge: 'e2' }], states: { biosboot: 'on' }, metrics: m() }
        : { id: 'gap', label: 'core.img', caption: bi('На MBR core.img лежит в промежутке между сектором 0 и первым разделом — раздел BIOS boot не нужен, но промежуток должен быть (обычно 1 МиБ).', 'On MBR, core.img lives in the gap between sector 0 and the first partition — no BIOS boot partition is needed, but the gap must be there (usually 1 MiB).'), focus: ['mbr', 'e2', 'biosboot'], tokens: [{ edge: 'e2' }], states: { biosboot: 'on' }, values: { biosboot: 'MBR gap' }, metrics: m() },
    );
    n++;
    steps.push({ id: 'menu', label: 'grub.cfg', caption: bi('GRUB читает меню с `/boot` и находит строку `linux /vmlinuz-virt root=…`.', 'GRUB reads the menu from `/boot` and finds the line `linux /vmlinuz-virt root=…`.'), focus: ['biosboot', 'e3', 'boot'], tokens: [{ edge: 'e3', label: 'grub.cfg' }], states: { boot: 'on' }, metrics: m() });
    n += 2;
    steps.push({
      id: 'kernel',
      label: bi('ядро', 'kernel'),
      caption: fmtb(bi('Ядро и initramfs в памяти, строка параметров: `root={r}`.', 'The kernel and the initramfs are in memory, with the parameter line `root={r}`.'), { r: p.lvm ? '/dev/mapper/vg0-root' : '/dev/sda3' }),
      focus: ['boot', 'e4', 'kernel', 'e5', 'initramfs'],
      tokens: [{ edge: 'e4', label: 'vmlinuz + initramfs' }, { edge: 'e5' }],
      states: { kernel: 'on', initramfs: 'on' },
      metrics: m(),
    });
    if (p.lvm) {
      steps.push({
        id: 'vg',
        label: 'LVM',
        caption: broken.has('no-lvm') ? bi('В этой initramfs нечем включить группы томов: `/dev/vg0/root` не появляется.', 'This initramfs has nothing to switch on the volume groups with: `/dev/vg0/root` never appears.') : bi('initramfs включает группу `vg0`: появляется `/dev/vg0/root`.', 'The initramfs switches on the group `vg0`: `/dev/vg0/root` appears.'),
        focus: ['initramfs', 'e6', 'lvm'],
        tokens: [{ edge: 'e6', label: 'vgchange -ay' }],
        states: { lvm: broken.has('no-lvm') ? 'err' : 'on', initramfs: broken.has('no-lvm') ? 'err' : 'on' },
        metrics: m(),
        broken: broken.has('no-lvm') ? { at: 'initramfs', message: 'mounting /dev/mapper/vg0-root on /sysroot failed: No such file or directory\nmounting root: failed.\ninitramfs emergency recovery shell launched', caption: bi('лечится с носителя: смонтировать систему, добавить `lvm` в `features` и пересобрать `mkinitfs` в chroot.', 'fixed from the media: mount the system, add `lvm` to `features` and rebuild with `mkinitfs` in a chroot.') } : undefined,
      });
      if (broken.has('no-lvm')) return steps;
    }
    n++;
    steps.push({ id: 'root', label: '/', caption: bi('Корень смонтирован, `switch_root` передаёт управление системе на диске: память initramfs освобождается.', 'The root is mounted, and `switch_root` hands control to the system on the disk: the initramfs memory is freed.'), focus: [p.lvm ? 'e7' : 'e5', 'root', 'e8', 'init'], tokens: [{ edge: 'e7' }, { edge: 'e8' }], states: { root: 'on', init: 'on' }, metrics: m() });
    const lost = broken.has('shifted');
    n++;
    steps.push({
      id: 'fstab',
      label: 'fstab',
      caption: lost
        ? bi('В fstab записан `/dev/sda2`, а это теперь раздел другого диска: `/boot` не смонтирован или смонтирован не тот. Система поднимется, но следующее обновление ядра ляжет не туда.', 'fstab says `/dev/sda2`, and that is now a partition of the other disk: `/boot` is not mounted, or the wrong one is. The system comes up, but the next kernel update lands in the wrong place.')
        : p.fstab === 'dev'
          ? bi('`localmount` монтирует `/dev/sda2` в `/boot`. Пока диск один, это работает; с UUID работало бы и после замены дисков.', '`localmount` mounts `/dev/sda2` at `/boot`. While there is one disk this works; with a UUID it would keep working after the disks change.')
          : bi('`localmount` монтирует `/boot` по UUID из fstab.', '`localmount` mounts `/boot` by the UUID from fstab.'),
      focus: ['init', 'e9', 'fstab'],
      tokens: [{ edge: 'e9', label: p.fstab === 'uuid' && !lost ? 'UUID=…' : '/dev/sda2' }],
      states: { fstab: lost ? 'err' : 'ok' },
      metrics: m(),
      broken: lost ? { at: 'fstab', message: 'localmount: mount: mounting /dev/sda2 on /boot failed: Invalid argument', caption: bi('имя устройства зависит от порядка дисков; UUID — нет.', 'a device name depends on the order of the disks; a UUID does not.') } : undefined,
    });
    steps.push({ id: 'login', label: 'login:', caption: bi('Уровни `boot` и `default` поднялись, getty печатает `shop-01 login:`. Установка удалась.', 'The `boot` and `default` runlevels are up, and getty prints `shop-01 login:`. The install worked.'), focus: ['e10', 'login'], tokens: [{ edge: 'e10' }], states: { login: 'ok' }, metrics: m() });
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    const stop = next.find((s) => s.broken);
    const end: Bi = stop ? bi('загрузка останавливается на шаге «' + (typeof stop.label === 'string' ? stop.label : stop.label.ru) + '»', 'the boot stops at the step “' + (typeof stop.label === 'string' ? stop.label : stop.label.en) + '”') : bi('машина доходит до login:', 'the machine gets to login:');
    if (change.kind === 'break') return change.on ? fmtb(bi('Поломка включена: {e}.', 'The break is on: {e}.'), { e: end }) : bi('Поломка убрана.', 'The break is removed.');
    if (change.id === 'table') return b.table === 'gpt' ? bi('GPT: GRUB нужен раздел BIOS boot.', 'GPT: GRUB needs a BIOS boot partition.') : bi('MBR: GRUB живёт в промежутке перед первым разделом.', 'MBR: GRUB lives in the gap before the first partition.');
    if (change.id === 'lvm') return b.lvm ? bi('Корень на LVM: initramfs должна включить группу томов.', 'The root on LVM: the initramfs must switch on the volume group.') : bi('Корень на обычном разделе: шаг LVM не нужен.', 'The root on a plain partition: no LVM step.');
    return fmtb(bi('Теперь {e}.', 'Now {e}.'), { e: end });
  },
});
