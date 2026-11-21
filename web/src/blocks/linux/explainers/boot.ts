import { t as explainerText } from '../../../core/i18n';
// X1 «From power-on to the prompt» (02 §6.6 X1): firmware → boot loader →
// kernel → PID 1 → targets → services → login → bash. The knobs choose the
// target and the start time of a slow service with After= dependents; the
// breaks are the classic ways a boot stops: a wrong UUID in /etc/fstab, a
// missing init, and a unit that lost its [Install] WantedBy=.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { ElementState, Step } from '../../../core/types';
import { fmtb } from './util';

/** A decimal number as a Russian (comma) and an English (dot) string. */
const dec = (n: number, d: number) => ({ ru: n.toFixed(d).replace('.', ','), en: n.toFixed(d) });

type P = { target: string; slow: number; after: boolean };

const sd = (name: string, sec: number) => ({ url: `https://man7.org/linux/man-pages/man${sec}/${name}.${sec}.html`, label: `${name}(${sec})` });

/** Timeline of the userspace part of the boot, in seconds, for tests. */
export function bootTimes(p: P): { slow: number; web: number; cron: number; ready: number } {
  const slow = 0.4 + p.slow;
  const web = (p.after ? slow : 0.5) + 0.3;
  const cron = 0.35;
  return { slow, web, cron, ready: Math.max(slow, web, cron) + 0.2 };
}

const ALL = ['fw', 'grub', 'kernel', 'pid1', 'fs', 'mu', 'slow', 'web', 'cron', 'getty', 'bash', 'e-fw', 'e-grub', 'e-init', 'e-fs', 'e-mu', 'e-slow', 'e-web', 'e-cron', 'e-getty', 'e-bash'];
const startWith = (...shown: string[]): Record<string, ElementState> => Object.fromEntries(ALL.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));
const sysd = bi('Эту работу выполняет systemd.', 'systemd does this.');

export const bootModel = defineModel<P>({
  id: 'linux.boot',
  frame: 'visible',
  block: 'linux',
  title: bi('Что происходит от включения машины до приглашения оболочки', 'What happens from power-on to the shell prompt'),
  summary: bi(
    'Машина включается, и управление по очереди переходит от прошивки к загрузчику, от загрузчика к ядру, а от ядра к первому процессу systemd. Потом systemd подключает файловые системы, запускает службы выбранной цели загрузки и, наконец, программу входа, после которой запускается ваша оболочка.',
    'The machine powers on, and control passes in turn from the firmware to the boot loader, from the boot loader to the kernel, and from the kernel to the first process, systemd. Then systemd attaches the file systems, starts the services of the chosen boot target and, finally, the login program, after which your shell starts.',
  ),
  intro: bi(
    'Сейчас на схеме только прошивка, а остальные участники загрузки появятся по очереди, когда до них дойдёт управление. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко рядом с подсвеченным блоком говорит, что он делает, а карточка на линии показывает, что он передаёт следующему.\n\nКогда дойдёте до оболочки, выберите в «Параметрах» другую цель загрузки или замедлите службу slow.service и пройдите загрузку ещё раз.',
    'Now the diagram shows only the firmware; the other participants of the boot appear in turn when control reaches them. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout next to the highlighted block says what it does, and the card on the line shows what it hands on.\n\nOnce you reach the shell, choose another boot target in “Parameters” or slow slow.service down and walk the boot again.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('что передаётся следующему участнику', 'what is handed to the next participant') },
    { mark: 'icon:process', text: bi('процесс: systemd или служба', 'a process: systemd or a service') },
    { mark: 'wait', text: bi('служба или цель ещё запускается', 'a service or a target is still starting') },
    { mark: 'ok', text: bi('этап загрузки пройден', 'boot stage passed') },
    { mark: 'err', text: bi('здесь загрузка остановилась', 'the boot stopped here') },
  ],
  stopLabel: bi('Загрузка остановилась', 'The boot stopped'),
  concepts: ['linux.systemd', 'linux.unit'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      { id: 'fw', label: bi('Прошивка', 'Firmware'), icon: 'server', work: 'spin', sub: 'UEFI', family: 'neutral', x: 16, y: 32, w: 140, h: 56, card: { what: bi('Прошивка записана в микросхему на плате компьютера. Она проверяет оборудование и находит диск, с которого нужно загружаться.', 'The firmware is written into a chip on the machine’s board. It checks the hardware and finds the disk to boot from.'), who: bi('Прошивку ставит производитель платы, а в облаке её роль играет программа, которая запускает виртуальные машины.', 'The board maker installs it; in a cloud, the program that runs virtual machines plays its part.'), see: 'ls /sys/firmware/efi' } },
      { id: 'grub', label: bi('Загрузчик', 'Boot loader'), icon: 'disk', sub: 'GRUB', family: 'neutral', x: 196, y: 32, w: 140, h: 56, card: { what: bi('Загрузчик хранится на диске. Он кладёт ядро в память и передаёт ему строку параметров, в которой сказано, где лежит корневая файловая система и какую программу запустить первой.', 'The boot loader is stored on the disk. It puts the kernel into memory and hands it a line of parameters that says where the root file system is and which program to start first.'), who: bi('Загрузчик ставится вместе с системой из пакета grub.', 'The boot loader is installed with the system from the grub package.'), see: 'cat /proc/cmdline' } },
      { id: 'kernel', label: bi('Ядро Linux', 'The Linux kernel'), family: 'kernel', shape: 'bar', x: 16, y: 400, w: 928, h: 56, card: { what: bi('Ядро запускает оборудование, подключает корневую файловую систему и запускает первую программу `/sbin/init`. Его сообщения можно прочитать командами `dmesg` и `journalctl -k`.', 'The kernel brings up the hardware, attaches the root file system and starts the first program, `/sbin/init`. You read its messages with `dmesg` and `journalctl -k`.'), who: bi('Ядро помещается в память загрузчиком GRUB.', 'The GRUB boot loader puts the kernel into memory.'), see: 'sudo dmesg | less', doc: sd('bootup', 7) } },
      { id: 'pid1', label: 'systemd', icon: 'process', work: 'dots', sub: 'PID 1', family: 'process', x: 376, y: 32, w: 160, h: 56, card: { what: bi('Программа systemd работает первым процессом системы и служит родителем всех служб. Она читает unit-файлы и одновременно запускает всё, что нужно выбранной цели загрузки, соблюдая порядок, который задают строки After=.', 'systemd runs as the first process of the system and is the parent of all services. It reads unit files and starts, in parallel, everything the chosen boot target needs, keeping the order that the After= lines set.'), who: bi('Ядро запускает systemd сразу после того, как подключит корневую файловую систему.', 'The kernel starts systemd right after attaching the root file system.'), see: 'ps -p 1', doc: sd('systemd', 1) } },
      { id: 'fs', label: 'local-fs.target', icon: 'disk', sub: '/etc/fstab', family: 'obj', x: 576, y: 32, w: 180, h: 56, card: { what: bi('Цель local-fs.target считается достигнутой, когда подключены все локальные файловые системы. Список дисков для подключения хранится в файле /etc/fstab, и подробно он разобран в уроке о дисках. Пока эта цель не достигнута, загрузка дальше не идёт.', 'local-fs.target counts as reached once all local file systems are attached. The list of disks to attach is in /etc/fstab, covered in detail in the lesson on disks. Until this target is reached, the boot goes no further.'), who: bi('По строкам /etc/fstab systemd сам создаёт unit-файлы для подключения дисков.', 'systemd itself makes unit files for attaching disks from the lines of /etc/fstab.'), see: 'cat /etc/fstab; findmnt --verify', doc: sd('fstab', 5) } },
      { id: 'mu', label: 'multi-user.target', sub: 'Wants=…', family: 'obj', shape: 'doc', x: 796, y: 32, w: 148, h: 56, card: { what: bi('До цели multi-user.target загружается обычный сервер. Чтобы её достичь, должны запуститься все службы, которые включены командой `systemctl enable`, то есть все, для которых есть ссылки в каталоге multi-user.target.wants/.', 'An ordinary server boots to multi-user.target. To reach it, every service enabled with `systemctl enable`, that is, every one linked in multi-user.target.wants/, must start.'), who: bi('Эта цель стоит по умолчанию, и проверить это можно командой `systemctl get-default`.', 'This is the default target; check it with `systemctl get-default`.'), see: 'systemctl list-dependencies multi-user.target', doc: sd('systemd.special', 7) } },
      { id: 'slow', label: 'slow.service', icon: 'process', work: 'spin', sub: { ru: '0,4 с', en: '0.4 s' }, family: 'process', x: 376, y: 170, w: 140, h: 56, card: { what: bi('Служба slow.service долго запускается, потому что ждёт сеть, диск или базу данных. Сколько времени ушло на её запуск, показывает команда `systemd-analyze blame`.', 'slow.service takes long to start because it waits for the network, a disk or a database. `systemd-analyze blame` shows how long its start took.'), who: bi('Службу запускает systemd, потому что её подтягивает цель multi-user.target.', 'systemd starts it because multi-user.target wants it.'), see: 'systemd-analyze blame' } },
      { id: 'web', label: 'web.service', icon: 'process', work: 'pulse', sub: { ru: '0.3 с', en: '0.3 s' }, family: 'process', x: 616, y: 170, w: 140, h: 56, card: { what: bi('Службу web.service написали вы сами. Если в её unit-файле стоит строка `After=slow.service`, служба web ждёт, пока запустится slow, а без этой строки запускается одновременно с ней.', 'You wrote web.service yourself. If its unit file has `After=slow.service`, it waits until slow has started; without that line it starts at the same time.'), who: bi('Службу запускает systemd, если она включена командой enable.', 'systemd starts it if it was enabled with enable.'), see: 'systemctl cat web', doc: sd('systemd.unit', 5) } },
      { id: 'cron', label: 'cron.service', icon: 'process', work: 'pulse', sub: { ru: '0.35 с', en: '0.35 s' }, family: 'process', x: 796, y: 240, w: 148, h: 56, card: { what: bi('Для службы cron порядок относительно slow не задан, поэтому она запускается сразу и никого не ждёт.', 'cron has no ordering relative to slow, so it starts at once and waits for nobody.'), who: bi('Службу запускает systemd.', 'systemd starts it.'), see: 'systemctl status cron' } },
      { id: 'getty', label: bi('Программа входа', 'The login program'), icon: 'lock', sub: 'getty → login', family: 'user', x: 526, y: 320, w: 160, h: 56, card: { what: bi('На консоли вход обслуживают программы getty и login, а по сети вход обслуживает sshd. Они проверяют, кто вы, и запускают вашу оболочку.', 'On the console getty and login handle the login, and over the network sshd does. They check who you are and start your shell.'), who: bi('Эти программы запускает systemd как службы getty@tty1.service и ssh.service.', 'systemd starts them as the services getty@tty1.service and ssh.service.'), see: 'who' } },
      { id: 'bash', label: bi('Ваша оболочка', 'Your shell'), icon: 'terminal', sub: 'bash', family: 'user', x: 796, y: 320, w: 148, h: 56, card: { what: bi('Ваша оболочка завершает цепочку загрузки, и на экране появляется приглашение.', 'Your shell ends the boot chain: the prompt appears on the screen.'), who: bi('Оболочку запускает программа login или sshd.', 'login or sshd starts the shell.'), see: 'echo $$; ps -o ppid= -p $$' } },
    ],
    edges: [
      { id: 'e-fw', from: 'fw', to: 'grub', label: bi('запуск загрузчика', 'starting the loader'), card: { what: bi('Прошивка читает загрузчик с диска и передаёт ему управление.', 'The firmware reads the boot loader from the disk and hands control to it.'), who: bi('Управление загрузчику передаёт прошивка.', 'The firmware hands control to the boot loader.') } },
      { id: 'e-grub', from: 'grub', to: 'kernel', via: [[266, 360]], label: bi('ядро и параметры', 'kernel and parameters'), labelAt: 0.55, card: { what: bi('Загрузчик кладёт ядро в память и передаёт ему параметры вроде `root=… init=…`.', 'The boot loader puts the kernel into memory and passes it parameters such as `root=… init=…`.'), who: bi('Ядро и параметры передаёт загрузчик GRUB.', 'The GRUB boot loader passes the kernel and the parameters.'), see: 'cat /proc/cmdline' } },
      { id: 'e-init', from: 'kernel', to: 'pid1', via: [[366, 360], [366, 60]], label: bi('запуск процесса PID 1', 'starting PID 1'), labelAt: 0.33, card: { what: bi('Последняя строка ядра в журнале загрузки перед запуском systemd выглядит так: «Run /sbin/init as init process», то есть «запускаю /sbin/init первым процессом».', 'The kernel’s last line in the boot log before systemd reads “Run /sbin/init as init process”.'), who: bi('Первый процесс запускает ядро.', 'The kernel starts the first process.'), doc: sd('bootup', 7) } },
      { id: 'e-fs', from: 'pid1', to: 'fs', label: bi('подключение дисков', 'attaching disks'), card: { what: bi('Сначала systemd подключает файловые системы из /etc/fstab.', 'First systemd attaches the file systems from /etc/fstab.'), who: sysd } },
      { id: 'e-mu', from: 'fs', to: 'mu', label: bi('после дисков', 'after the disks'), card: { what: bi('Цель multi-user.target наступает только после цели local-fs.target.', 'multi-user.target comes only after local-fs.target.'), who: sysd } },
      { id: 'e-slow', from: 'mu', to: 'slow', via: [[870, 130], [456, 130]], label: bi('цель подтягивает службу (Wants=)', 'the target wants the service (Wants=)'), labelAt: 0.6, card: { what: bi('Цель подтягивает все включённые службы и запускает их одновременно. В unit-файлах это записано строкой Wants=.', 'The target wants all enabled services and starts them at the same time. Unit files write this as Wants=.'), who: sysd } },
      { id: 'e-web', from: 'slow', to: 'web', label: bi('web ждёт slow', 'web waits for slow'), card: { what: bi('Строка `After=slow` задаёт порядок, и служба web запускается только после slow. Без этой строки обе службы запускаются одновременно.', '`After=slow` sets the order: web starts only after slow. Without that line both start at the same time.'), who: bi('Порядок задаёт строка After= в unit-файле службы web.', 'The After= line in web’s unit file sets the order.'), doc: sd('systemd.unit', 5) } },
      { id: 'e-cron', from: 'mu', to: 'cron', label: bi('цель подтягивает службу', 'the target wants the service'), card: { what: bi('Служба cron никого не ждёт и запускается сразу.', 'cron waits for nobody and starts at once.'), who: sysd } },
      { id: 'e-getty', from: 'web', to: 'getty', label: bi('цель достигнута', 'target reached'), card: { what: bi('Когда цель достигнута, на консоли появляется приглашение входа. Служба sshd принимает подключения ещё раньше, как только сама запустится.', 'Once the target is reached, the console shows the login prompt. sshd accepts connections even earlier, as soon as it has started.'), who: sysd } },
      { id: 'e-bash', from: 'getty', to: 'bash', label: bi('запуск оболочки', 'starting the shell'), card: { what: bi('Проверив пароль или ключ, программа входа запускает оболочку, которая записана для вас в /etc/passwd.', 'Having checked the password or key, the login program starts the shell listed for you in /etc/passwd.'), who: bi('Оболочку запускает программа login или sshd.', 'login or sshd starts the shell.') } },
    ],
  },
  params: [
    {
      id: 'target',
      label: bi('До какой цели загружается машина', 'Which target the machine boots into'),
      kind: 'choice',
      default: 'multi-user',
      options: [
        { id: 'multi-user', label: bi('обычная работа сервера (multi-user.target)', 'the ordinary work of a server (multi-user.target)') },
        { id: 'rescue', label: bi('режим восстановления (rescue.target)', 'rescue mode (rescue.target)') },
        { id: 'emergency', label: bi('аварийный режим (emergency.target)', 'emergency mode (emergency.target)') },
      ],
      near: 'mu',
      group: bi('Как загружается машина', 'How the machine boots'),
      predict: {
        prompt: bi('Машину загружают в режим восстановления rescue.target, а служба web включена командой enable. Будет ли служба web работать после загрузки?', 'The machine boots into rescue.target, and web is enabled with enable. Will web run after the boot?'),
        options: [
          { id: 'no', text: bi('Нет, в этом режиме запускается только минимум служб и оболочка root', 'No, this mode starts only a minimum of services and a root shell') },
          { id: 'yes', text: bi('Да, потому что все включённые службы запускаются в любом режиме', 'Yes, because all enabled services start in any mode') },
        ],
        resolve: (_p, next) => (next.some((s) => s.focus.includes('web') && s.states?.web === 'on') ? 'yes' : 'no'),
      },
    },
    {
      id: 'slow',
      label: bi('На сколько секунд дольше обычных 0,4 с запускается служба slow.service', 'How many seconds longer than the usual 0.4 s slow.service takes to start'),
      kind: 'range',
      min: 0,
      max: 30,
      step: 1,
      default: 0,
      unit: { ru: 'с', en: 's' },
      near: 'slow',
      group: bi('Как запускаются службы', 'How the services start'),
      predict: {
        prompt: bi('Служба slow.service теперь запускается 20 секунд. У службы web есть строка After=slow.service, а у cron такой строки нет. Чей запуск это задержит?', 'slow.service now takes 20 seconds to start. web has After=slow.service, and cron has no such line. Whose start does this delay?'),
        options: [
          { id: 'web', text: bi('Только запуск web, потому что она ждёт slow', 'Only web’s start, because it waits for slow') },
          { id: 'all', text: bi('Запуск всех служб, потому что службы запускаются по очереди', 'Every service’s start, because services start one by one') },
        ],
        resolve: () => 'web',
      },
    },
    { id: 'after', label: bi('В unit-файле web стоит строка After=slow.service', 'web’s unit file has After=slow.service'), kind: 'toggle', default: true, near: 'web', group: bi('Как запускаются службы', 'How the services start'), levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'bad-uuid',
      label: bi('В /etc/fstab записан диск с неверным UUID', '/etc/fstab lists a disk with a wrong UUID'),
      remove: ['e-mu'],
      boundary: 'storage',
      predict: {
        prompt: bi('В файле /etc/fstab записан диск с номером UUID, которого на машине нет. На каком этапе остановится загрузка?', '/etc/fstab lists a disk with a UUID the machine does not have. At which stage does the boot stop?'),
        options: [
          { id: 'fs', text: bi('На подключении дисков, после чего машина перейдёт в аварийный режим', 'At attaching the disks, after which the machine goes into emergency mode') },
          { id: 'kernel', text: bi('Ещё раньше, потому что ядро не сможет загрузиться', 'Even earlier, because the kernel cannot boot') },
          { id: 'none', text: bi('Нигде, загрузка продолжится, а этот диск не подключится', 'Nowhere, the boot goes on and that disk is not attached') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'fs') ? 'fs' : 'none'),
      },
    },
    {
      id: 'no-init',
      label: bi('В параметрах ядра указан init=/bin/nosuch, то есть несуществующая программа', 'The kernel parameters say init=/bin/nosuch, a program that does not exist'),
      remove: ['e-init'],
      boundary: 'kernel',
      predict: {
        prompt: bi('Загрузчик велел ядру запустить первым процессом программу /bin/nosuch, которой на диске нет. Что произойдёт?', 'The boot loader told the kernel to start /bin/nosuch as the first process, and it is not on the disk. What happens?'),
        options: [
          { id: 'panic', text: bi('Ядро остановится с сообщением Kernel panic, потому что без первого процесса системе нечего запускать', 'The kernel stops with a kernel panic, because without a first process the system has nothing to run') },
          { id: 'fallback', text: bi('Ядро само найдёт systemd и запустит его', 'The kernel finds systemd by itself and starts it') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'e-init') ? 'panic' : 'fallback'),
      },
    },
    {
      id: 'no-wantedby',
      label: bi('Служба web.service не включена командой enable', 'web.service was not enabled with enable'),
      remove: ['e-web'],
      boundary: 'process',
      predict: {
        prompt: bi('Вчера службу web запустили вручную командой `systemctl start`, и она работала, но команду enable для неё никто не выполнял. Запустится ли web после перезагрузки?', 'Yesterday web was started by hand with `systemctl start` and worked, but nobody ran enable for it. Will web start after a reboot?'),
        options: [
          { id: 'down', text: bi('Нет, потому что ни одна цель её не подтягивает', 'No, because no target wants it') },
          { id: 'up', text: bi('Да, потому что systemd помнит, что она работала', 'Yes, because systemd remembers it was running') },
        ],
        resolve: () => 'down',
      },
    },
  ],
  metrics: [
    { id: 'services', label: bi('служб запущено', 'services started') },
    { id: 't', label: bi('секунд прошло после запуска systemd', 'seconds since systemd started'), unit: { ru: 'с', en: 's' } },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const t = bootTimes(p);
    steps.push({
      id: 'fw',
      label: bi('прошивка', 'firmware'),
      caption: bi('Машину включили. Прошивка проверяет оборудование, находит диск с загрузчиком и передаёт загрузчику управление.', 'The machine is powered on. The firmware checks the hardware, finds the disk with the boot loader and hands control to it.'),
      focus: ['fw', 'e-fw'],
      tokens: [{ edge: 'e-fw', label: bi('загрузчик с диска', 'loader from disk') }],
      say: { fw: bi('Прошивка проверяет оборудование и ищет диск, с которого можно загрузиться.', 'The firmware checks the hardware and looks for a disk to boot from.') },
      states: { ...startWith('fw', 'grub', 'e-fw'), fw: 'on' },
      metrics: { services: 0, t: 0 },
    });
    steps.push({
      id: 'grub',
      label: 'GRUB',
      caption: bi('Загрузчик кладёт ядро в память и передаёт ему параметры: где лежит корневая файловая система и какую программу запустить первой.', 'The boot loader puts the kernel into memory and passes it the parameters: where the root file system is and which program to start first.'),
      focus: ['grub', 'e-grub'],
      reveal: ['kernel', 'e-grub'],
      tokens: [{ edge: 'e-grub', label: broken.has('no-init') ? 'init=/bin/nosuch' : 'root=/dev/sda1' }],
      say: { grub: bi('Загрузчик кладёт ядро в память и передаёт ему строку параметров.', 'The boot loader puts the kernel into memory and passes it the parameter line.') },
      states: { fw: 'ok', grub: 'on' },
      metrics: { services: 0, t: 0 },
    });
    if (broken.has('no-init')) {
      steps.push({
        id: 'panic',
        label: 'panic',
        caption: bi('Ядро запустило оборудование и подключило корневую файловую систему, но первую программу не запустило, потому что файла /bin/nosuch нет. Без первого процесса системе нечего запускать, и ядро останавливается.', 'The kernel brought up the hardware and attached the root file system, but could not start the first program, because there is no /bin/nosuch. Without a first process the system has nothing to run, and the kernel stops.'),
        focus: ['kernel', 'e-init'],
        reveal: ['e-init'],
        say: { kernel: bi('Ядро ищет программу /bin/nosuch, не находит её и останавливает систему.', 'The kernel looks for /bin/nosuch, does not find it and halts the system.') },
        states: { kernel: 'err', 'e-init': 'err', grub: 'ok' },
        metrics: { services: 0, t: 0 },
        broken: { at: 'e-init', message: 'Kernel panic - not syncing: Requested init /bin/nosuch failed (error -2).', caption: bi('Код ошибки -2 называется ENOENT и означает, что такого файла нет, а искало ядро первую программу там, куда указал параметр init= в строке параметров. Узнают эту поломку по словам Kernel panic на экране консоли.', 'Error -2 is ENOENT, “no such file”: the kernel looks for the first program where the init= parameter points. You recognise this break by the words Kernel panic on the console.') },
      });
      return steps;
    }
    steps.push({
      id: 'kernel',
      label: bi('ядро', 'kernel'),
      caption: bi('Ядро запускает оборудование, подключает корневую файловую систему и запускает программу `/sbin/init`. На этой машине ею служит systemd, процесс с номером 1.', 'The kernel brings up the hardware, attaches the root file system and starts `/sbin/init`. On this machine that is systemd, process number 1.'),
      focus: ['kernel', 'e-init', 'pid1'],
      reveal: ['e-init', 'pid1'],
      tokens: [{ edge: 'e-init', label: 'PID 1' }],
      say: { kernel: bi('Ядро подключило корневую файловую систему и запускает первую программу, systemd.', 'The kernel attached the root file system and starts the first program, systemd.') },
      states: { grub: 'ok', kernel: 'ok', pid1: 'on' },
      metrics: { services: 0, t: 0 },
    });
    if (p.target === 'emergency') {
      steps.push({
        id: 'emerg',
        label: 'emergency',
        caption: bi('В аварийном режиме emergency.target systemd почти ничего не запускает. Корневая файловая система подключена только для чтения, и на консоли сразу появляется оболочка root. Этот режим нужен для ремонта системы.', 'In emergency.target systemd starts almost nothing. The root file system is attached read-only, and a root shell appears on the console at once. This mode is for repairing the system.'),
        focus: ['pid1', 'bash'],
        reveal: ['bash'],
        say: { pid1: bi('systemd сразу запускает оболочку root на консоли и больше ничего не делает.', 'systemd at once starts a root shell on the console and does nothing else.') },
        states: { bash: 'on' },
        values: { bash: 'root (emergency)' },
        metrics: { services: 0, t: 0.3 },
      });
      return steps;
    }
    if (broken.has('bad-uuid')) {
      steps.push({
        id: 'wait-dev',
        label: bi('ожидание диска', 'waiting for disk'),
        caption: bi('systemd ждёт появления диска с тем номером UUID, который записан в /etc/fstab. По умолчанию ожидание длится 90 секунд.', 'systemd waits for the disk with the UUID written in /etc/fstab. By default the wait lasts 90 seconds.'),
        focus: ['e-fs', 'fs'],
        reveal: ['fs', 'e-fs'],
        tokens: [{ edge: 'e-fs', label: 'UUID=0a1b…' }],
        say: { fs: bi('systemd ждёт диск с номером UUID из /etc/fstab, но такой диск не появляется.', 'systemd waits for the disk with the UUID from /etc/fstab, but it does not appear.') },
        states: { fs: 'wait' },
        metrics: { services: 0, t: 90 },
      });
      steps.push({
        id: 'emergency',
        label: 'emergency',
        caption: bi('Диск так и не появился, поэтому цель local-fs.target не достигнута, и всё, что от неё зависит, отменено. systemd переводит машину в аварийный режим и просит пароль root.', 'The disk never appeared, so local-fs.target is not reached, and everything that depends on it is cancelled. systemd puts the machine into emergency mode and asks for the root password.'),
        focus: ['fs'],
        say: { fs: bi('Диска нет, поэтому systemd отменяет запуск служб и включает аварийный режим.', 'The disk is missing, so systemd cancels the services and switches to emergency mode.') },
        states: { fs: 'err' },
        metrics: { services: 0, t: 90.2 },
        broken: { at: 'fs', message: 'Timed out waiting for device /dev/disk/by-uuid/0a1b…\nDependency failed for Local File Systems.\nYou are in emergency mode. After logging in, type "journalctl -xb" to view system logs.', caption: bi('Ошибка в /etc/fstab останавливает всю загрузку. Если добавить в строку этого диска параметр `nofail`, диск станет необязательным, и загрузка продолжится без него. Узнают эту поломку по полуторной минуте ожидания и строке «You are in emergency mode».', 'A mistake in /etc/fstab stops the whole boot. Adding `nofail` to that disk’s line would make the disk optional, and the boot would go on without it. You recognise this break by the minute and a half of waiting and the line “You are in emergency mode”.') },
      });
      return steps;
    }
    steps.push({
      id: 'fs',
      label: 'local-fs',
      caption: bi('systemd подключил все файловые системы из /etc/fstab, и цель local-fs.target достигнута.', 'systemd attached all the file systems from /etc/fstab, and local-fs.target is reached.'),
      focus: ['e-fs', 'fs'],
      reveal: ['fs', 'e-fs'],
      tokens: [{ edge: 'e-fs', label: '/etc/fstab' }],
      say: { fs: bi('Все диски из /etc/fstab подключены, и загрузка идёт дальше.', 'All disks from /etc/fstab are attached, and the boot goes on.') },
      states: { pid1: 'ok', fs: 'ok' },
      metrics: { services: 0, t: 0.2 },
    });
    if (p.target === 'rescue') {
      steps.push({
        id: 'rescue',
        label: 'rescue',
        caption: bi('В режиме восстановления rescue.target файловые системы подключены, но сеть, вход по сети и ваши службы не запускаются. На консоли появляется оболочка root, в которой можно чинить систему.', 'In rescue.target the file systems are attached, but the network, network logins and your services do not start. A root shell appears on the console, where you can repair the system.'),
        focus: ['fs', 'bash'],
        reveal: ['bash'],
        say: { bash: bi('На консоли работает оболочка root, а службы сервера не запущены.', 'A root shell runs on the console, and the server’s services are not started.') },
        states: { bash: 'on' },
        values: { bash: 'root (rescue)' },
        metrics: { services: 0, t: 0.3 },
      });
      return steps;
    }
    steps.push({
      id: 'parallel',
      label: bi('службы', 'services'),
      caption: bi('Цель multi-user.target подтягивает все включённые службы, и systemd запускает их одновременно, поэтому slow и cron начинают запускаться вместе.', 'multi-user.target wants all enabled services, and systemd starts them at the same time, so slow and cron begin starting together.'),
      focus: ['mu', 'slow', 'cron'],
      reveal: ['e-mu', 'mu', 'e-slow', 'slow', 'e-cron', 'cron'],
      tokens: [{ edge: 'e-slow', label: 'start' }, { edge: 'e-cron', label: 'start' }],
      say: { mu: bi('Цель multi-user.target запускает включённые службы все разом.', 'multi-user.target starts the enabled services all at once.') },
      states: { mu: 'wait', slow: 'wait', cron: 'on' },
      values: { slow: explainerText({ ru: `${t.slow.toFixed(1).replace('.', ',')} с`, en: `${t.slow.toFixed(1)} s` }), cron: explainerText({ ru: `${t.cron.toFixed(2).replace('.', ',')} с`, en: `${t.cron.toFixed(2)} s` }) },
      metrics: { services: 1, t: t.cron },
    });
    if (broken.has('no-wantedby')) {
      steps.push({
        id: 'no-web',
        label: bi('нет web', 'no web'),
        caption: bi('Службу web.service ни одна цель не подтягивает, потому что ссылки на неё в каталоге multi-user.target.wants/ нет. Вчерашняя команда `systemctl start` действовала только до перезагрузки.', 'No target wants web.service, because there is no link to it in multi-user.target.wants/. Yesterday’s `systemctl start` lasted only until the reboot.'),
        focus: ['web'],
        reveal: ['web', 'getty', 'bash'],
        say: { web: bi('systemd не запускает службу web, потому что её не включили командой enable.', 'systemd does not start web, because it was not enabled.') },
        states: { web: 'off', slow: 'ok', mu: 'ok', getty: 'on', bash: 'on' },
        metrics: { services: 2, t: t.slow },
        broken: { at: 'web', message: '○ web.service - Web demo\n     Loaded: loaded (/etc/systemd/system/web.service; disabled; preset: enabled)\n     Active: inactive (dead)', caption: bi('Команда start запускает службу сейчас, а enable включает её запуск при загрузке, и для работы после перезагрузки нужны обе: `systemctl enable --now web`. Узнают эту поломку по слову disabled в выводе `systemctl status`.', 'start runs the service now, and enable turns on its start at boot; to keep working after a reboot you need both: `systemctl enable --now web`. You recognise this break by the word disabled in `systemctl status`.') },
      });
      return steps;
    }
    steps.push({
      id: 'web',
      label: 'web',
      caption: p.after
        ? fmtb(bi('Служба slow запускалась {s} с, и только после неё запустилась web, потому что в unit-файле web стоит строка `After=slow.service`. Служба web готова через {w} с, а cron ждать не стала.', 'slow took {s} s, and only then did web start, because web’s unit file has `After=slow.service`. web is ready after {w} s, and cron did not wait.'), { s: dec(t.slow, 1), w: dec(t.web, 1) })
        : fmtb(bi('Без строки `After=` служба web запускается одновременно со slow и готова через {w} с, не дожидаясь её.', 'Without `After=` web starts at the same time as slow and is ready after {w} s without waiting for it.'), { w: dec(t.web, 1) }),
      focus: ['e-web', 'web'],
      reveal: ['e-web', 'web'],
      tokens: [{ edge: 'e-web', label: p.after ? 'After=slow' : 'start' }],
      say: { web: p.after ? bi('Служба web дождалась slow и теперь запускается сама.', 'web waited for slow and now starts itself.') : bi('Служба web запускается, не дожидаясь slow.', 'web starts without waiting for slow.') },
      states: { slow: 'ok', web: 'on', cron: 'ok' },
      values: { web: explainerText({ ru: `${t.web.toFixed(1).replace('.', ',')} с`, en: `${t.web.toFixed(1)} s` }) },
      metrics: { services: 3, t: t.web },
    });
    steps.push({
      id: 'login',
      label: bi('вход', 'login'),
      caption: fmtb(bi('Цель multi-user.target достигнута через {r} с. На консоли появляется приглашение входа, а служба sshd принимает подключения по сети.', 'multi-user.target is reached after {r} s. The console shows the login prompt, and sshd accepts network connections.'), { r: dec(t.ready, 1) }),
      focus: ['e-getty', 'getty'],
      reveal: ['e-getty', 'getty'],
      tokens: [{ edge: 'e-getty', label: 'login:' }],
      say: { getty: bi('Программа входа спрашивает имя пользователя и пароль.', 'The login program asks for the user name and password.') },
      states: { mu: 'ok', web: 'ok', getty: 'on' },
      metrics: { services: 3, t: t.ready },
    });
    steps.push({
      id: 'bash',
      label: 'bash',
      caption: bi('Вы вошли, и запустилась ваша оболочка. Всю цепочку загрузки, от строк ядра до «Started web.service», можно прочитать командой `journalctl -b`.', 'You are logged in, and your shell has started. The whole boot chain, from the kernel lines to “Started web.service”, can be read with `journalctl -b`.'),
      focus: ['e-bash', 'bash'],
      reveal: ['e-bash', 'bash'],
      tokens: [{ edge: 'e-bash', label: '/bin/bash' }],
      say: { bash: bi('Оболочка напечатала приглашение и ждёт вашу первую команду.', 'The shell printed the prompt and waits for your first command.') },
      states: { getty: 'ok', bash: 'on' },
      metrics: { services: 3, t: t.ready + 0.4 },
    });
    return steps;
  },
  explainDelta(prev, _next, change, a, b): Bi {
    void prev;
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и загрузка снова доходит до приглашения оболочки.', 'The break is removed, and the boot again reaches the shell prompt.');
      if (change.id === 'bad-uuid') return bi('Из-за неверного UUID в /etc/fstab цель local-fs.target не достигнута, и после 90 секунд ожидания машина перешла в аварийный режим.', 'Because of the wrong UUID in /etc/fstab, local-fs.target is not reached, and after a 90-second wait the machine went into emergency mode.');
      if (change.id === 'no-init') return bi('Без первой программы система не может работать, поэтому сразу после подключения корневой файловой системы ядро останавливается с сообщением Kernel panic.', 'Without a first program the system cannot run, so right after attaching the root file system the kernel stops with a kernel panic.');
      return bi('Служба, которую не включили командой enable, при загрузке не запускается, потому что ни одна цель её не подтягивает.', 'A service that was not enabled does not start at boot, because no target wants it.');
    }
    const t0 = bootTimes(a as P);
    const t1 = bootTimes(b as P);
    if (change.id === 'slow')
      return (b as P).after
        ? fmtb(bi('Служба slow теперь запускается не {a} с, а {b} с. Служба web ждёт её из-за строки After= и готова через {w} с, а cron не ждёт, потому что порядок между ними не задан.', 'slow now takes {b} s instead of {a} s. web waits for it because of After= and is ready after {w} s, while cron does not wait, because no order is set between them.'), { a: dec(t0.slow, 1), b: dec(t1.slow, 1), w: dec(t1.web, 1) })
        : fmtb(bi('Служба slow запускается {b} с, но web без строки After= её не ждёт и готова через {w} с.', 'slow takes {b} s, but web without After= does not wait and is ready after {w} s.'), { b: dec(t1.slow, 1), w: dec(t1.web, 1) });
    if (change.id === 'after') return (b as P).after ? bi('Строка After=slow.service заставляет web запускаться только после slow. Она задаёт порядок запуска, а потребность в службе задаёт другая строка, Wants=.', 'After=slow.service makes web start only after slow. It sets the order of starting, while the need for a service is set by another line, Wants=.') : bi('Без строки After= службы web и slow запускаются одновременно.', 'Without After= web and slow start at the same time.');
    if ((b as P).target === 'rescue') return bi('В режиме восстановления rescue.target не запускаются сеть, вход по сети и ваши службы, и вы получаете оболочку root на консоли.', 'In rescue.target the network, network logins and your services do not start, and you get a root shell on the console.');
    if ((b as P).target === 'emergency') return bi('В аварийном режиме emergency.target диски из /etc/fstab не подключаются, а корневая файловая система доступна только для чтения.', 'In emergency.target the disks from /etc/fstab are not attached, and the root file system is read-only.');
    return bi('Цель multi-user.target означает обычную загрузку сервера.', 'multi-user.target is the ordinary boot of a server.');
  },
});
