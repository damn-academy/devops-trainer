// X1 «From power-on to the prompt» (02 §6.6 X1): firmware → boot loader →
// kernel → PID 1 → targets → services → login → bash. The knobs choose the
// target and the start time of a slow service with After= dependents; the
// breaks are the classic ways a boot stops: a wrong UUID in /etc/fstab, a
// missing init, and a unit that lost its [Install] WantedBy=.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { fmtb } from './util';

type P = { target: string; slow: number; after: boolean };

const sd = (name: string, sec: number) => ({ url: `https://man7.org/linux/man-pages/man${sec}/${name}.${sec}.html`, label: `${name}(${sec})` });

/** Timeline of the userspace part of the boot, in seconds, for tests. */
export function bootTimes(p: P): { slow: number; web: number; cron: number; ready: number } {
  const slow = 0.4 + p.slow;
  const web = (p.after ? slow : 0.5) + 0.3;
  const cron = 0.35;
  return { slow, web, cron, ready: Math.max(slow, web, cron) + 0.2 };
}

export const bootModel = defineModel<P>({
  id: 'linux.boot',
  block: 'linux',
  title: bi('От включения до приглашения', 'From power-on to the prompt'),
  summary: bi(
    'Цепочка загрузки: прошивка, загрузчик, ядро, первый процесс systemd, цели и службы, вход и оболочка. Выберите цель, замедлите одну службу, сломайте fstab — и увидите, где остановится загрузка.',
    'The boot chain: firmware, boot loader, kernel, the first process systemd, targets and services, login and the shell. Pick a target, slow one service down, break fstab — and see where the boot stops.',
  ),
  concepts: ['linux.systemd', 'linux.unit'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      { id: 'fw', label: bi('прошивка', 'firmware'), sub: 'UEFI', family: 'neutral', x: 16, y: 32, w: 140, h: 56, card: { what: bi('Программа в плате компьютера: проверяет железо и находит диск, с которого грузиться.', 'The program in the machine’s board: it checks the hardware and finds the disk to boot from.'), who: bi('Производитель платы; в облаке — гипервизор.', 'The board maker; in a cloud — the hypervisor.'), see: 'ls /sys/firmware/efi' } },
      { id: 'grub', label: bi('загрузчик', 'boot loader'), sub: 'GRUB', family: 'neutral', x: 196, y: 32, w: 140, h: 56, card: { what: bi('Кладёт ядро в память и передаёт ему строку параметров: где корень, какой первый процесс.', 'Puts the kernel into memory and hands it a line of parameters: where the root is, which first process to run.'), who: bi('Ставится вместе с системой (пакет grub).', 'Installed with the system (the grub package).'), see: 'cat /proc/cmdline' } },
      { id: 'kernel', label: bi('ядро Linux', 'Linux kernel'), family: 'kernel', shape: 'bar', x: 16, y: 400, w: 928, h: 56, card: { what: bi('Разбирает железо, монтирует корневую файловую систему и запускает первую программу — `/sbin/init`. Его сообщения — в `dmesg` и `journalctl -k`.', 'Brings up the hardware, mounts the root file system and starts the first program — `/sbin/init`. Its messages are in `dmesg` and `journalctl -k`.'), who: bi('Загрузчик.', 'The boot loader.'), see: 'sudo dmesg | head', doc: sd('bootup', 7) } },
      { id: 'pid1', label: 'systemd', sub: 'PID 1', family: 'process', x: 376, y: 32, w: 160, h: 56, card: { what: bi('Первый процесс: родитель всех служб. Читает unit-файлы и запускает то, что нужно выбранной цели, параллельно, с учётом After= и Wants=.', 'The first process: the parent of all services. It reads unit files and starts what the chosen target needs, in parallel, honouring After= and Wants=.'), who: bi('Ядро, сразу после монтирования корня.', 'The kernel, right after mounting the root.'), see: 'ps -p 1', doc: sd('systemd', 1) } },
      { id: 'fs', label: 'local-fs.target', sub: '/etc/fstab', family: 'obj', shape: 'doc', x: 576, y: 32, w: 180, h: 56, card: { what: bi('Цель «локальные файловые системы смонтированы»: всё из /etc/fstab. Пока она не достигнута, дальше загрузка не идёт.', 'The target “local file systems are mounted”: everything from /etc/fstab. Until it is reached the boot goes no further.'), who: bi('systemd создаёт mount-юниты из /etc/fstab.', 'systemd makes mount units out of /etc/fstab.'), see: 'cat /etc/fstab; findmnt --verify', doc: sd('fstab', 5) } },
      { id: 'mu', label: 'multi-user.target', sub: 'Wants=…', family: 'obj', shape: 'doc', x: 796, y: 32, w: 148, h: 56, card: { what: bi('Цель обычного сервера: всё, что включено командой `systemctl enable` (символические ссылки в multi-user.target.wants/), должно стартовать.', 'The target of an ordinary server: everything enabled with `systemctl enable` (symlinks in multi-user.target.wants/) must start.'), who: bi('Цель по умолчанию (`systemctl get-default`).', 'The default target (`systemctl get-default`).'), see: 'systemctl list-dependencies multi-user.target', doc: sd('systemd.special', 7) } },
      { id: 'slow', label: 'slow.service', sub: '0.4 s', family: 'process', x: 376, y: 170, w: 160, h: 56, card: { what: bi('Служба, которая долго стартует (ждёт сеть, диск, базу). Её время старта видно в `systemd-analyze blame`.', 'A service that takes long to start (it waits for the network, a disk, a database). Its start time shows in `systemd-analyze blame`.'), who: bi('systemd, по multi-user.target.', 'systemd, for multi-user.target.'), see: 'systemd-analyze blame' } },
      { id: 'web', label: 'web.service', sub: '0.3 s', family: 'process', x: 576, y: 170, w: 180, h: 56, card: { what: bi('Ваша служба. С `After=slow.service` она ждёт, пока slow стартует; без него стартует параллельно.', 'Your service. With `After=slow.service` it waits until slow has started; without it, it starts in parallel.'), who: bi('systemd, если служба включена (enable).', 'systemd, if the service is enabled.'), see: 'systemctl cat web', doc: sd('systemd.unit', 5) } },
      { id: 'cron', label: 'cron.service', sub: '0.35 s', family: 'process', x: 796, y: 170, w: 148, h: 56, card: { what: bi('Служба, у которой нет порядка относительно slow: стартует сразу, не ждёт.', 'A service with no ordering relative to slow: it starts at once and does not wait.'), who: bi('systemd', 'systemd'), see: 'systemctl status cron' } },
      { id: 'getty', label: bi('вход', 'login'), sub: 'getty → login', family: 'user', x: 576, y: 290, w: 180, h: 56, card: { what: bi('На консоли — getty и login, по сети — sshd: проверяют, кто вы, и запускают вашу оболочку.', 'On the console — getty and login, over the network — sshd: they check who you are and start your shell.'), who: bi('systemd (getty@tty1.service, ssh.service).', 'systemd (getty@tty1.service, ssh.service).'), see: 'who' } },
      { id: 'bash', label: 'bash', sub: bi('вы здесь', 'you are here').en, family: 'user', x: 796, y: 290, w: 148, h: 56, card: { what: bi('Ваша оболочка — конец цепочки: приглашение на экране.', 'Your shell — the end of the chain: the prompt on screen.'), who: bi('login или sshd.', 'login or sshd.'), see: 'echo $$; ps -o ppid= -p $$' } },
    ],
    edges: [
      { id: 'e-fw', from: 'fw', to: 'grub', label: bi('находит диск', 'finds the disk'), card: { what: bi('Прошивка читает загрузчик с диска.', 'The firmware reads the boot loader from the disk.'), who: bi('прошивка', 'the firmware') } },
      { id: 'e-grub', from: 'grub', to: 'kernel', via: [[266, 360]], label: bi('ядро + cmdline', 'kernel + cmdline'), labelAt: 0.55, card: { what: bi('Загрузчик кладёт ядро в память и передаёт параметры: `root=… init=…`.', 'The boot loader puts the kernel into memory and passes parameters: `root=… init=…`.'), who: bi('GRUB', 'GRUB'), see: 'cat /proc/cmdline' } },
      { id: 'e-init', from: 'kernel', to: 'pid1', via: [[456, 360]], label: bi('запускает init', 'runs init'), labelAt: 0.4, card: { what: bi('«Run /sbin/init as init process» — последняя строка ядра в журнале загрузки перед systemd.', '“Run /sbin/init as init process” — the kernel’s last line in the boot log before systemd.'), who: bi('ядро', 'the kernel'), doc: sd('bootup', 7) } },
      { id: 'e-fs', from: 'pid1', to: 'fs', label: bi('монтирует', 'mounts'), card: { what: bi('Сначала — файловые системы из fstab.', 'First — the file systems from fstab.'), who: bi('systemd', 'systemd') } },
      { id: 'e-mu', from: 'fs', to: 'mu', label: 'After=', card: { what: bi('multi-user.target идёт после local-fs.target.', 'multi-user.target comes after local-fs.target.'), who: bi('systemd', 'systemd') } },
      { id: 'e-slow', from: 'mu', to: 'slow', via: [[870, 130], [456, 130]], label: 'Wants=', labelAt: 0.6, card: { what: bi('Цель «хочет» включённые службы и запускает их одновременно.', 'The target “wants” the enabled services and starts them at the same time.'), who: bi('systemd', 'systemd') } },
      { id: 'e-web', from: 'slow', to: 'web', label: 'After=slow', card: { what: bi('Порядок: web стартует только после slow. Без этой строки они стартуют параллельно.', 'Ordering: web starts only after slow. Without this line they start in parallel.'), who: bi('строка After= в unit-файле web', 'the After= line in web’s unit file'), doc: sd('systemd.unit', 5) } },
      { id: 'e-cron', from: 'mu', to: 'cron', label: 'Wants=', card: { what: bi('cron ничего не ждёт.', 'cron waits for nothing.'), who: bi('systemd', 'systemd') } },
      { id: 'e-getty', from: 'web', to: 'getty', label: bi('цель достигнута', 'target reached'), card: { what: bi('Когда цель достигнута, на консоли появляется приглашение входа (sshd принимает подключения раньше — как только стартовал).', 'Once the target is reached the console shows the login prompt (sshd accepts connections earlier — as soon as it has started).'), who: bi('systemd', 'systemd') } },
      { id: 'e-bash', from: 'getty', to: 'bash', label: bi('запускает оболочку', 'starts the shell'), card: { what: bi('После проверки пароля или ключа запускается ваша оболочка из /etc/passwd.', 'After the password or key is checked, your shell from /etc/passwd starts.'), who: bi('login / sshd', 'login / sshd') } },
    ],
  },
  params: [
    {
      id: 'target',
      label: bi('Цель загрузки', 'Boot target'),
      kind: 'choice',
      default: 'multi-user',
      options: [
        { id: 'multi-user', label: bi('multi-user.target', 'multi-user.target') },
        { id: 'rescue', label: bi('rescue.target', 'rescue.target') },
        { id: 'emergency', label: bi('emergency.target', 'emergency.target') },
      ],
      near: 'mu',
      predict: {
        prompt: bi('Загрузка в rescue.target. Будет ли работать web.service?', 'Booting into rescue.target. Will web.service run?'),
        options: [
          { id: 'no', text: bi('Нет: только минимум и оболочка root', 'No: only the minimum and a root shell') },
          { id: 'yes', text: bi('Да, все включённые службы стартуют', 'Yes, all enabled services start') },
        ],
        resolve: (_p, next) => (next.some((s) => s.focus.includes('web') && s.states?.web === 'on') ? 'yes' : 'no'),
      },
    },
    {
      id: 'slow',
      label: bi('slow.service стартует', 'slow.service takes'),
      kind: 'range',
      min: 0,
      max: 30,
      step: 1,
      default: 0,
      unit: 's',
      near: 'slow',
      predict: {
        prompt: bi('slow.service стал стартовать 20 секунд. Кого это задержит?', 'slow.service now takes 20 seconds to start. Whom does that delay?'),
        options: [
          { id: 'web', text: bi('Только web (у него After=slow)', 'Only web (it has After=slow)') },
          { id: 'all', text: bi('Все службы: загрузка идёт по очереди', 'All services: the boot goes one by one') },
        ],
        resolve: () => 'web',
      },
    },
    { id: 'after', label: bi('у web есть After=slow.service', 'web has After=slow.service'), kind: 'toggle', default: true, near: 'web', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'bad-uuid',
      label: bi('В /etc/fstab диск с неверным UUID', 'A disk with a wrong UUID in /etc/fstab'),
      remove: ['e-mu'],
      boundary: 'storage',
      predict: {
        prompt: bi('Диска с таким UUID нет. Где остановится загрузка?', 'There is no disk with that UUID. Where does the boot stop?'),
        options: [
          { id: 'fs', text: bi('На local-fs.target, потом emergency mode', 'At local-fs.target, then emergency mode') },
          { id: 'kernel', text: bi('Ядро не загрузится', 'The kernel will not boot') },
          { id: 'none', text: bi('Нигде, диск просто не подключится', 'Nowhere, the disk just will not be attached') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'fs') ? 'fs' : 'none'),
      },
    },
    {
      id: 'no-init',
      label: bi('init=/bin/nosuch в параметрах ядра', 'init=/bin/nosuch in the kernel parameters'),
      remove: ['e-init'],
      boundary: 'kernel',
      predict: {
        prompt: bi('Ядру велели запустить несуществующую программу. Что будет?', 'The kernel was told to start a program that does not exist. What happens?'),
        options: [
          { id: 'panic', text: bi('Kernel panic: без первого процесса жить нечем', 'Kernel panic: without a first process there is nothing to run') },
          { id: 'fallback', text: bi('systemd запустится сам', 'systemd starts by itself') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken?.at === 'e-init') ? 'panic' : 'fallback'),
      },
    },
    {
      id: 'no-wantedby',
      label: bi('У web.service убрали WantedBy= (или не сделали enable)', 'web.service lost WantedBy= (or was never enabled)'),
      remove: ['e-web'],
      boundary: 'process',
      predict: {
        prompt: bi('Вчера web запускали руками (`systemctl start`), и он работал. После перезагрузки?', 'Yesterday web was started by hand (`systemctl start`) and worked. After a reboot?'),
        options: [
          { id: 'down', text: bi('Не стартует: его никто не «хочет»', 'It does not start: nobody “wants” it') },
          { id: 'up', text: bi('Стартует: systemd помнит', 'It starts: systemd remembers') },
        ],
        resolve: () => 'down',
      },
    },
  ],
  metrics: [
    { id: 'services', label: bi('служб запущено', 'services started') },
    { id: 't', label: bi('время в userspace', 'userspace time'), unit: 's' },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const t = bootTimes(p);
    steps.push({ id: 'fw', label: bi('прошивка', 'firmware'), caption: bi('Машина включилась: прошивка проверила железо и нашла диск с загрузчиком.', 'The machine powered on: the firmware checked the hardware and found the disk with the boot loader.'), focus: ['fw', 'e-fw'], tokens: [{ edge: 'e-fw' }], states: { fw: 'on' }, metrics: { services: 0, t: 0 } });
    steps.push({ id: 'grub', label: 'GRUB', caption: bi('Загрузчик положил ядро в память и передал ему параметры: где корень и какую программу запустить первой.', 'The boot loader put the kernel into memory and handed it the parameters: where the root is and which program to start first.'), focus: ['grub', 'e-grub', 'kernel'], tokens: [{ edge: 'e-grub', label: broken.has('no-init') ? 'init=/bin/nosuch' : 'root=/dev/sda1' }], states: { grub: 'on' }, metrics: { services: 0, t: 0 } });
    if (broken.has('no-init')) {
      steps.push({
        id: 'panic',
        label: 'panic',
        caption: bi('Ядро разобрало железо и смонтировало корень, но запустить первую программу не смогло. Без первого процесса работать нечему — ядро останавливается.', 'The kernel brought up the hardware and mounted the root, but could not start the first program. Without a first process there is nothing to run — the kernel stops.'),
        focus: ['kernel', 'e-init'],
        states: { kernel: 'err', 'e-init': 'err', pid1: 'off' },
        metrics: { services: 0, t: 0 },
        broken: { at: 'e-init', message: 'Kernel panic - not syncing: Requested init /bin/nosuch failed (error -2).', caption: bi('error -2 — это ENOENT, «нет такого файла»: ядро ищет init там, где сказали в cmdline.', 'error -2 is ENOENT, “no such file”: the kernel looks for init where the cmdline said.') },
      });
      return steps;
    }
    steps.push({ id: 'kernel', label: bi('ядро', 'kernel'), caption: bi('Ядро разбирает железо, монтирует корень и запускает `/sbin/init` — это systemd, процесс номер 1.', 'The kernel brings up the hardware, mounts the root and starts `/sbin/init` — that is systemd, process number 1.'), focus: ['kernel', 'e-init', 'pid1'], tokens: [{ edge: 'e-init', label: 'PID 1' }], states: { kernel: 'on', pid1: 'on' }, metrics: { services: 0, t: 0 } });
    if (p.target === 'emergency') {
      steps.push({ id: 'emerg', label: 'emergency', caption: bi('emergency.target: почти ничего — корень смонтирован только для чтения, и сразу оболочка root на консоли. Режим для ремонта.', 'emergency.target: almost nothing — the root is mounted read-only and you get a root shell on the console right away. A mode for repairs.'), focus: ['pid1', 'bash'], states: { fs: 'off', mu: 'off', slow: 'off', web: 'off', cron: 'off', getty: 'off', bash: 'on' }, values: { bash: 'root (emergency)' }, metrics: { services: 0, t: 0.3 } });
      return steps;
    }
    if (broken.has('bad-uuid')) {
      steps.push({ id: 'wait-dev', label: bi('ждёт диск', 'waits for disk'), caption: bi('systemd ждёт устройство с UUID из fstab: по умолчанию 90 секунд.', 'systemd waits for the device with the UUID from fstab: 90 seconds by default.'), focus: ['e-fs', 'fs'], tokens: [{ edge: 'e-fs' }], states: { fs: 'wait' }, metrics: { services: 0, t: 90 } });
      steps.push({
        id: 'emergency',
        label: 'emergency',
        caption: bi('Устройства нет — local-fs.target не достигнута, всё, что от неё зависит, отменено. systemd открывает emergency mode и просит пароль root.', 'The device never appears — local-fs.target is not reached and everything depending on it is cancelled. systemd opens emergency mode and asks for the root password.'),
        focus: ['fs'],
        states: { fs: 'err', mu: 'off', slow: 'off', web: 'off', cron: 'off', getty: 'off' },
        metrics: { services: 0, t: 90.2 },
        broken: { at: 'fs', message: 'Timed out waiting for device /dev/disk/by-uuid/0a1b…\nDependency failed for Local File Systems.\nYou are in emergency mode. After logging in, type "journalctl -xb" to view system logs.', caption: bi('ошибка в fstab останавливает загрузку целиком; `nofail` в параметрах строки сделал бы диск необязательным.', 'a mistake in fstab stops the whole boot; `nofail` in the line’s options would make the disk optional.') },
      });
      return steps;
    }
    steps.push({ id: 'fs', label: 'local-fs', caption: bi('Файловые системы из /etc/fstab смонтированы: local-fs.target достигнута.', 'The file systems from /etc/fstab are mounted: local-fs.target is reached.'), focus: ['e-fs', 'fs'], tokens: [{ edge: 'e-fs' }], states: { fs: 'ok' }, metrics: { services: 0, t: 0.2 } });
    if (p.target === 'rescue') {
      steps.push({ id: 'rescue', label: 'rescue', caption: bi('rescue.target: файловые системы есть, но сеть, ssh и ваши службы не стартуют — оболочка root на консоли.', 'rescue.target: the file systems are there, but the network, ssh and your services do not start — a root shell on the console.'), focus: ['fs', 'bash'], states: { mu: 'off', slow: 'off', web: 'off', cron: 'off', getty: 'off', bash: 'on' }, values: { bash: 'root (rescue)' }, metrics: { services: 0, t: 0.3 } });
      return steps;
    }
    steps.push({
      id: 'parallel',
      label: 'Wants=',
      caption: bi('multi-user.target «хочет» включённые службы, и systemd запускает их одновременно: slow и cron стартуют вместе.', 'multi-user.target “wants” the enabled services, and systemd starts them at the same time: slow and cron start together.'),
      focus: ['mu', 'e-slow', 'e-cron', 'slow', 'cron'],
      tokens: [{ edge: 'e-slow' }, { edge: 'e-cron' }],
      states: { mu: 'wait', slow: 'wait', cron: 'on' },
      values: { slow: `${t.slow.toFixed(1)} s`, cron: `${t.cron.toFixed(2)} s` },
      metrics: { services: 1, t: t.cron },
    });
    if (broken.has('no-wantedby')) {
      steps.push({
        id: 'no-web',
        label: bi('нет web', 'no web'),
        caption: bi('web.service никто не «хочет»: ссылки в multi-user.target.wants/ нет. Вчерашний `systemctl start` действовал только до перезагрузки.', 'Nobody “wants” web.service: there is no link in multi-user.target.wants/. Yesterday’s `systemctl start` lasted only until the reboot.'),
        focus: ['web'],
        states: { web: 'off', slow: 'ok', mu: 'ok', getty: 'on', bash: 'on' },
        metrics: { services: 2, t: t.slow },
        broken: { at: 'web', message: '○ web.service - Web demo\n     Loaded: loaded (/etc/systemd/system/web.service; disabled; preset: enabled)\n     Active: inactive (dead)', caption: bi('start — «запусти сейчас», enable — «запускай при загрузке»; нужны оба: `systemctl enable --now web`.', 'start means “run it now”, enable means “run it at boot”; you need both: `systemctl enable --now web`.') },
      });
      return steps;
    }
    steps.push({
      id: 'web',
      label: 'web',
      caption: p.after
        ? fmtb(bi('slow стартовал за {s} с, и только потом — web (у него `After=slow.service`): web готов на {w} с. cron ждать не стал.', 'slow took {s} s, and only then did web start (it has `After=slow.service`): web is ready at {w} s. cron did not wait.'), { s: t.slow.toFixed(1), w: t.web.toFixed(1) })
        : fmtb(bi('Без `After=` web стартует параллельно со slow и готов на {w} с, не дожидаясь его.', 'Without `After=` web starts in parallel with slow and is ready at {w} s without waiting for it.'), { w: t.web.toFixed(1) }),
      focus: ['e-web', 'web', 'slow'],
      tokens: [{ edge: 'e-web' }],
      states: { slow: 'ok', web: 'on', cron: 'ok' },
      values: { web: `${t.web.toFixed(1)} s` },
      metrics: { services: 3, t: t.web },
    });
    steps.push({ id: 'login', label: bi('вход', 'login'), caption: fmtb(bi('multi-user.target достигнута на {r} с: приглашение входа на консоли, sshd принимает подключения.', 'multi-user.target is reached at {r} s: the login prompt on the console, sshd accepts connections.'), { r: t.ready.toFixed(1) }), focus: ['mu', 'e-getty', 'getty'], tokens: [{ edge: 'e-getty' }], states: { mu: 'ok', getty: 'on' }, metrics: { services: 3, t: t.ready } });
    steps.push({ id: 'bash', label: 'bash', caption: bi('Вы вошли: запущена ваша оболочка. Вся цепочка видна в `journalctl -b` — от строк ядра до «Started web.service».', 'You are in: your shell is running. The whole chain is visible in `journalctl -b` — from the kernel lines to “Started web.service”.'), focus: ['e-bash', 'bash'], tokens: [{ edge: 'e-bash' }], states: { bash: 'on' }, metrics: { services: 3, t: t.ready + 0.4 } });
    return steps;
  },
  explainDelta(prev, _next, change, a, b): Bi {
    void prev;
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: загрузка снова доходит до приглашения.', 'The break is removed: the boot reaches the prompt again.');
      if (change.id === 'bad-uuid') return bi('Неверный UUID в fstab: local-fs.target не достигнута, загрузка ушла в emergency mode через 90 секунд ожидания.', 'A wrong UUID in fstab: local-fs.target is not reached, and after a 90-second wait the boot falls into emergency mode.');
      if (change.id === 'no-init') return bi('Нет первой программы — нет и системы: kernel panic сразу после монтирования корня.', 'No first program, no system: a kernel panic right after the root is mounted.');
      return bi('Служба без enable при загрузке не стартует: её никто не «хочет».', 'A service that is not enabled does not start at boot: nobody “wants” it.');
    }
    const t0 = bootTimes(a as P);
    const t1 = bootTimes(b as P);
    if (change.id === 'slow') return (b as P).after ? fmtb(bi('slow: {a} → {b} с. web ждёт его из-за After= и готов на {w} с; cron не ждёт — между ними нет порядка.', 'slow: {a} → {b} s. web waits for it because of After= and is ready at {w} s; cron does not wait — there is no ordering between them.'), { a: t0.slow.toFixed(1), b: t1.slow.toFixed(1), w: t1.web.toFixed(1) }) : fmtb(bi('slow: {b} с, но web без After= его не ждёт и готов на {w} с.', 'slow: {b} s, but web without After= does not wait and is ready at {w} s.'), { b: t1.slow.toFixed(1), w: t1.web.toFixed(1) });
    if (change.id === 'after') return (b as P).after ? bi('After=slow.service: web стартует только после slow — это порядок, а не зависимость (Wants= — зависимость).', 'After=slow.service: web starts only after slow — that is ordering, not a dependency (Wants= is the dependency).') : bi('Без After= web и slow стартуют параллельно.', 'Without After= web and slow start in parallel.');
    if ((b as P).target === 'rescue') return bi('rescue.target: сеть, ssh и ваши службы не стартуют — вы получите оболочку root на консоли.', 'rescue.target: the network, ssh and your services do not start — you get a root shell on the console.');
    if ((b as P).target === 'emergency') return bi('emergency.target: даже fstab не монтируется, корень — только для чтения.', 'emergency.target: not even fstab is mounted; the root is read-only.');
    return bi('multi-user.target: обычная загрузка сервера.', 'multi-user.target: the ordinary boot of a server.');
  },
});
