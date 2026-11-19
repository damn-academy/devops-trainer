// Quiz items of the Linux lessons on real machines (design 00 §6.13): SSH
// between machines, services on OpenRC, installing a system, disks that are
// full of deleted files. Every distractor is a recorded misconception.

import { bi } from '../../core/i18n';
import type { QuizItem } from '../../core/types';

const W = (ru: string, en: string) => bi(ru, en);

export const QUIZ_REAL: QuizItem[] = [
  // ── ssh between machines ──
  {
    id: 'linux.q.hostkey-changed',
    kind: 'mcq',
    concepts: ['linux.host-key'],
    prompt: W('Команда `ssh app` вдруг выводит `REMOTE HOST IDENTIFICATION HAS CHANGED!` и не подключается. Что нужно сделать в первую очередь?', '`ssh app` suddenly prints `REMOTE HOST IDENTIFICATION HAS CHANGED!` and does not connect. What do you do first?'),
    options: [
      { id: 'ask', text: W('Выяснить, переустанавливали ли сервер или меняли его ключ, и только потом убрать старую запись', 'Find out whether the server or its key was changed, and only then remove the old entry'), correct: true },
      { id: 'rm', text: W('Сразу удалить файл `~/.ssh/known_hosts` целиком', 'Delete `~/.ssh/known_hosts` entirely at once'), why: W('Нет, так пропадут ключи всех серверов, а причина, то есть переустановка или подмена, так и останется невыясненной.', 'No, that loses the keys of every server, and the cause, a reinstall or an impostor, stays unknown.') },
      { id: 'off', text: W('Поставить в настройках `StrictHostKeyChecking no`', 'Set `StrictHostKeyChecking no`'), why: W('Нет, эта настройка выключает ту самую защиту, которая сейчас сработала.', 'No, this setting switches off the very protection that has just worked.') },
    ],
    explain: W('Клиент не может отличить переустановленный сервер от подменённого. Когда причина выяснена, старую запись убирают командой `ssh-keygen -R app`, и при следующем входе отпечаток сверяют заново.', 'The client cannot tell a reinstalled server from an impostor. Once the cause is known, the old entry is removed with `ssh-keygen -R app`, and at the next login the fingerprint is checked again.'),
  },
  {
    id: 'linux.q.key-not-sent',
    kind: 'mcq',
    concepts: ['linux.ssh-key', 'linux.host-key'],
    prompt: W('Что уходит с вашего ноутбука на сервер, когда вы входите по ключу?', 'What goes from your laptop to the server when you log in with a key?'),
    options: [
      { id: 'sig', text: W('Открытый ключ и подпись данных этого сеанса', 'The public key and a signature over this session’s data'), correct: true },
      { id: 'priv', text: W('Закрытый ключ в зашифрованном виде', 'The private key, encrypted'), why: W('Нет, закрытый ключ никогда не покидает ноутбук, даже в зашифрованном виде.', 'No, the private key never leaves the laptop, not even encrypted.') },
      { id: 'pw', text: W('Пароль от ключа', 'The key’s passphrase'), why: W('Нет, пароль от ключа нужен только вашему клиенту, чтобы прочитать ключ с диска.', 'No, the key’s passphrase is needed only by your client to read the key from the disk.') },
    ],
    explain: W('Подпись годится только для этого сеанса, поэтому, даже перехватив её, войти в другой раз нельзя. С паролем всё иначе, потому что он уходит на сервер целиком, и поэтому сверка ключа хоста перед ним так важна.', 'The signature is good only for this session, so even if it is intercepted, it cannot be used to log in another time. A password is different, because it goes to the server whole, which is why the host key check before it matters so much.'),
  },
  {
    id: 'linux.q.proxyjump',
    kind: 'fill-command',
    concepts: ['linux.bastion'],
    prompt: W('Войдите на `app` пользователем `deploy` через бастион `deploy@bastion` одной командой и без файла `~/.ssh/config`.', 'Log in to `app` as `deploy` through the bastion `deploy@bastion` with one command and without `~/.ssh/config`.'),
    answers: ['ssh -J deploy@bastion deploy@app', 'ssh -o ProxyJump=deploy@bastion deploy@app', 'ssh deploy@app -J deploy@bastion'],
    explain: W('Флаг `-J` делает то же, что строка `ProxyJump` в `~/.ssh/config`: клиент входит на бастион и просит у него канал до `app`. Шифрование до `app` остаётся сквозным, и бастион видит только байты.', '`-J` does what `ProxyJump` in `~/.ssh/config` does: the client logs in to the bastion and asks it for a channel to `app`. The encryption to `app` stays end to end, and the bastion sees only bytes.'),
  },
  {
    id: 'linux.q.tunnel-sides',
    kind: 'mcq',
    concepts: ['linux.ssh-tunnel'],
    prompt: W('Вы выполнили `ssh -L 8080:localhost:5432 app`. На какой машине окажется «localhost», к которому пойдёт подключение на номер 5432?', 'You ran `ssh -L 8080:localhost:5432 app`. On which machine is the “localhost” that the connection to 5432 goes to?'),
    options: [
      { id: 'server', text: W('На `app`, потому что правая часть читается с точки зрения сервера', 'On `app`, because the right part is read from the server’s point of view'), correct: true },
      { id: 'laptop', text: W('На вашем ноутбуке', 'On your laptop'), why: W('Нет, на ноутбуке открывается только левая часть, номер 8080, а куда передавать подключение дальше, решает `app`.', 'No, only the left part, 8080, opens on the laptop, and `app` decides where the connection goes next.') },
      { id: 'bastion', text: W('На бастионе', 'On the bastion'), why: W('Нет, бастиона в этой команде нет вовсе, а с `ProxyJump` дальний конец туннеля всё равно оказался бы на `app`.', 'No, there is no bastion in this command at all, and with `ProxyJump` the far end of the tunnel would still be on `app`.') },
    ],
    explain: W('Так добираются до служб, которые слушают только адрес `127.0.0.1` сервера, например до баз данных и панелей. Наружу при этом ничего не открывается, и путь существует, пока работает сеанс SSH.', 'That is how you reach services that listen only on the server’s `127.0.0.1`, such as databases and panels. Nothing is opened to the outside, and the way exists while the SSH session runs.'),
  },
  // ── OpenRC and nginx ──
  {
    id: 'linux.q.openrc-systemd',
    kind: 'match',
    concepts: ['linux.openrc', 'linux.runlevel'],
    prompt: W('Сопоставьте каждую команду systemd с её парой в OpenRC.', 'Match each systemd command with its OpenRC counterpart.'),
    pairs: [
      { id: 'start', left: 'systemctl start nginx', right: 'rc-service nginx start' },
      { id: 'enable', left: 'systemctl enable nginx', right: 'rc-update add nginx default' },
      { id: 'status', left: 'systemctl list-units --type=service', right: 'rc-status' },
      { id: 'unit', left: '/etc/systemd/system/report.service', right: '/etc/init.d/report' },
    ],
    explain: W('Задачи у обеих систем одни и те же: запустить службу, включить её при загрузке и следить за ней. Различаются файлы и команды: unit-файлу соответствует скрипт `openrc-run`, а цели `multi-user.target` соответствует уровень запуска `default`.', 'Both systems have the same jobs: start a service, enable it at boot and watch it. The files and commands differ: a unit file corresponds to an `openrc-run` script, and the `multi-user.target` target to the `default` runlevel.'),
  },
  {
    id: 'linux.q.respawn',
    kind: 'mcq',
    concepts: ['linux.openrc'],
    prompt: W('Служба OpenRC описана строками `command=…` и `command_background=true`, и её программу завершили командой `kill -9`. Что произойдёт?', 'An OpenRC service is described with `command=…` and `command_background=true`, and its program was ended with `kill -9`. What happens?'),
    options: [
      { id: 'dead', text: W('Ничего не произойдёт, потому что OpenRC запустил программу и больше за ней не следит', 'Nothing happens, because OpenRC started the program and no longer watches it'), correct: true },
      { id: 'restart', text: W('OpenRC перезапустит программу, как systemd с настройкой Restart=', 'OpenRC restarts the program, as systemd does with Restart='), why: W('Нет, перезапуском в OpenRC занимается отдельный надзирающий процесс, и включает его строка `supervisor=supervise-daemon`.', 'No, in OpenRC a separate supervising process handles restarts, switched on by `supervisor=supervise-daemon`.') },
      { id: 'reboot', text: W('Служба запустится сама после перезагрузки, а до неё не запустится', 'The service starts by itself after a reboot, and not before'), why: W('Это верно, если служба включена в уровень `default`, но вопрос был о том, что произойдёт сейчас.', 'That is true if the service is in the `default` runlevel, but the question was about what happens now.') },
    ],
    explain: W('По умолчанию OpenRC только запускает и останавливает программы, и после такого завершения `rc-status` покажет `crashed`. С `supervise-daemon` программа становится дочерним процессом надзирающего процесса, и тот её перезапускает.', 'By default OpenRC only starts and stops programs, and after such an end `rc-status` shows `crashed`. With `supervise-daemon` the program becomes a child of the supervising process, which restarts it.'),
  },
  {
    id: 'linux.q.nginx-t',
    kind: 'order',
    concepts: ['linux.server-block'],
    prompt: W('Расставьте по порядку шаги безопасной правки сайта на работающем nginx.', 'Put in order the steps of a safe change of a site on a running nginx.'),
    steps: [
      { id: 's1', text: W('поправить файл сайта в `/etc/nginx/http.d/`', 'edit the site file in `/etc/nginx/http.d/`') },
      { id: 's2', text: W('проверить все настройки целиком командой `nginx -t`', 'check the whole configuration with `nginx -t`') },
      { id: 's3', text: W('перечитать настройки без обрыва подключений командой `rc-service nginx reload`', 'reread the settings without dropping connections with `rc-service nginx reload`') },
      { id: 's4', text: W('проверить результат командой `curl` с соседней машины', 'check the result with `curl` from the neighbouring machine') },
    ],
    explain: W('Если в настройках ошибка, по команде `reload` nginx их не применит и продолжит работать со старыми, но саму ошибку вы увидите только в журнале. Команда `nginx -t` показывает её сразу.', 'If the settings have a mistake, nginx does not apply them on `reload` and keeps working with the old ones, but you see the mistake itself only in the log. `nginx -t` shows it at once.'),
  },
  // ── install ──
  {
    id: 'linux.q.install-order',
    kind: 'order',
    concepts: ['linux.gpt', 'linux.lvm', 'linux.installer'],
    prompt: W('Расставьте по порядку шаги установки системы на чистый диск.', 'Put in order the steps of installing a system onto a blank disk.'),
    steps: [
      { id: 's1', text: W('записать таблицу разделов GPT с разделами BIOS boot, `/boot` и LVM', 'write a GPT partition table with BIOS boot, `/boot` and LVM partitions') },
      { id: 's2', text: W('`pvcreate`, `vgcreate`, `lvcreate`', '`pvcreate`, `vgcreate`, `lvcreate`') },
      { id: 's3', text: W('создать файловые системы `mkfs.ext4` на `/boot` и на томе корня', 'create `mkfs.ext4` file systems on `/boot` and on the root volume') },
      { id: 's4', text: W('смонтировать корень в `/mnt`, а затем `/mnt/boot`', 'mount the root at `/mnt`, then `/mnt/boot`') },
      { id: 's5', text: W('поставить пакеты, fstab и загрузчик командой `setup-disk`', 'install the packages, fstab and the boot loader with `setup-disk`') },
      { id: 's6', text: W('перезагрузиться без установочного носителя', 'reboot without the installer media') },
    ],
    explain: W('Каждый шаг опирается на предыдущий: файловую систему создают на томе, том нарезают из группы, а группу собирают на разделе. Загрузчик ставят последним, потому что ему нужно знать, где лежит готовый `/boot`.', 'Each step rests on the one before: the file system is created on a volume, the volume is cut from a group, and the group is built on a partition. The boot loader goes last, because it needs to know where the finished `/boot` is.'),
  },
  {
    id: 'linux.q.initramfs-lvm',
    kind: 'mcq',
    concepts: ['linux.initramfs', 'linux.lvm'],
    prompt: W('После установки загрузка доходит до сообщения `mounting /dev/mapper/vg0-root on /sysroot failed` и открывает аварийную оболочку, а GRUB перед этим отработал нормально. Что вероятнее всего?', 'After the install the boot reaches `mounting /dev/mapper/vg0-root on /sysroot failed` and opens an emergency shell, while GRUB worked fine before that. What is most likely?'),
    options: [
      { id: 'initramfs', text: W('initramfs собрана без поддержки LVM, и группа томов не включилась', 'The initramfs was built without LVM support, and the volume group was not switched on'), correct: true },
      { id: 'fstab', text: W('В файле `/etc/fstab` ошибка', 'There is a mistake in `/etc/fstab`'), why: W('Нет, fstab читается уже с корня, а до корня дело не дошло.', 'No, fstab is read from the root, and the boot never got to the root.') },
      { id: 'grub', text: W('Загрузчик не установлен', 'The boot loader is not installed'), why: W('Нет, без загрузчика не загрузилось бы ядро, и этого сообщения не было бы.', 'No, without a boot loader the kernel would not load, and this message would not appear.') },
    ],
    explain: W('Корень на томе LVM ядро видит только после команды `vgchange -ay`, а выполняет её initramfs. В Alpine за это отвечает слово `lvm` в списке `features` файла `/etc/mkinitfs/mkinitfs.conf`, и после правки initramfs пересобирают командой `mkinitfs` в chroot с установочного носителя.', 'The kernel sees a root on an LVM volume only after `vgchange -ay`, and the initramfs runs it. In Alpine the word `lvm` in the `features` of `/etc/mkinitfs/mkinitfs.conf` is in charge of this, and after the edit the initramfs is rebuilt with `mkinitfs` in a chroot from the installer media.'),
  },
  {
    id: 'linux.q.bios-boot',
    kind: 'mcq',
    concepts: ['linux.gpt'],
    prompt: W('Команда `grub-install` на диске GPT отвечает `this GPT partition label contains no BIOS Boot Partition`. Что не так?', '`grub-install` on a GPT disk answers `this GPT partition label contains no BIOS Boot Partition`. What is wrong?'),
    options: [
      { id: 'part', text: W('Нет маленького раздела типа BIOS boot для основной части GRUB', 'There is no small partition of type BIOS boot for GRUB’s main part'), correct: true },
      { id: 'mbr', text: W('GRUB вообще не работает с GPT', 'GRUB does not work with GPT at all'), why: W('Нет, GRUB работает с GPT, но ему нужно место, которое на MBR давал промежуток перед первым разделом.', 'No, GRUB works with GPT, but it needs the space that on MBR the gap before the first partition gave it.') },
      { id: 'fs', text: W('На разделе `/boot` не та файловая система', '`/boot` has the wrong file system'), why: W('Нет, сообщение говорит о разделе, на котором файловой системы нет вовсе, а не о `/boot`.', 'No, the message is about a partition with no file system at all, not about `/boot`.') },
    ],
  },
  // ── disks ──
  {
    id: 'linux.q.truncate-fd',
    kind: 'mcq',
    concepts: ['linux.fd'],
    prompt: W('Команда `lsof +L1` показывает `legacy-a 812 root 3w … 62914560 0 … /srv/shop/log/debug.log (deleted)`, а процесс агента нужно оставить работающим. Как вернуть 60 МБ?', '`lsof +L1` shows `legacy-a 812 root 3w … 62914560 0 … /srv/shop/log/debug.log (deleted)`, and the agent process must keep running. How do you get the 60 MB back?'),
    options: [
      { id: 'fd', text: W('Обрезать файл через дескриптор командой `: > /proc/812/fd/3`', 'Truncate the file through the descriptor with `: > /proc/812/fd/3`'), correct: true },
      { id: 'rm', text: W('Ещё раз выполнить `rm /srv/shop/log/debug.log`', 'Run `rm /srv/shop/log/debug.log` again'), why: W('Нет, имени у файла уже нет, поэтому удалять нечего, а данные держит открытый дескриптор.', 'No, the file has no name any more, so there is nothing to delete, and the open descriptor holds the data.') },
      { id: 'kill', text: W('`kill -9 812`', '`kill -9 812`'), why: W('Место вернётся, но агент остановится, а его просили не трогать.', 'The space comes back, but the agent stops, and you were asked to keep it.') },
    ],
    explain: W('Путь `/proc/<pid>/fd/<n>` ведёт к открытому файлу даже тогда, когда у файла нет имени. Перенаправление `: >` обрезает файл до нулевой длины, а процесс продолжает писать в него с начала.', '`/proc/<pid>/fd/<n>` leads to an open file even when the file has no name. Writing nothing truncates the file to zero, and the process goes on writing to it from the start.'),
  },
  {
    id: 'linux.q.lvextend-r',
    kind: 'mcq',
    concepts: ['linux.lv-extend', 'linux.lvm'],
    prompt: W('После команды `lvextend -L 220M data/shop` команда `df -h /srv/shop` показывает прежние 110 МБ. Почему?', 'After `lvextend -L 220M data/shop`, `df -h /srv/shop` shows the same 110 MB. Why?'),
    options: [
      { id: 'fs', text: W('Вырос том, а файловая система на нём осталась прежнего размера', 'The volume grew, but the file system on it kept its old size'), correct: true },
      { id: 'umount', text: W('Изменения станут видны только после отмонтирования', 'The changes become visible only after unmounting'), why: W('Нет, ext4 можно растянуть и смонтированной командой `resize2fs` или сразу `lvextend -r`.', 'No, ext4 can be stretched while mounted with `resize2fs`, or at once with `lvextend -r`.') },
      { id: 'reboot', text: W('Нужна перезагрузка', 'A reboot is needed'), why: W('Нет, ни ядру, ни LVM перезагрузка для этого не нужна.', 'No, neither the kernel nor LVM needs a reboot for this.') },
    ],
  },
];
