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
    prompt: W('`ssh app` вдруг пишет `REMOTE HOST IDENTIFICATION HAS CHANGED!` и не подключается. Что делать первым?', '`ssh app` suddenly prints `REMOTE HOST IDENTIFICATION HAS CHANGED!` and does not connect. What do you do first?'),
    options: [
      { id: 'ask', text: W('Выяснить, меняли ли сервер или его ключ, и только потом убрать старую запись', 'Find out whether the server or its key was changed, and only then remove the old entry'), correct: true },
      { id: 'rm', text: W('Сразу удалить `~/.ssh/known_hosts` целиком', 'Delete the whole `~/.ssh/known_hosts` at once'), why: W('Так пропадут ключи всех серверов, а причина — переустановка или подмена — останется невыясненной.', 'That loses the keys of every server, and the reason — a reinstall or an impostor — stays unknown.') },
      { id: 'off', text: W('Поставить `StrictHostKeyChecking no`', 'Set `StrictHostKeyChecking no`'), why: W('Это выключает ту самую защиту, которая сейчас сработала.', 'That switches off the very protection that has just fired.') },
    ],
    explain: W('Клиент не может отличить переустановленный сервер от подменённого. Когда причина ясна, старую запись убирает `ssh-keygen -R app`, и при следующем входе отпечаток сверяют заново.', 'The client cannot tell a reinstalled server from an impostor. Once the reason is clear, `ssh-keygen -R app` removes the old entry, and the fingerprint is checked again on the next login.'),
  },
  {
    id: 'linux.q.key-not-sent',
    kind: 'mcq',
    concepts: ['linux.ssh-key', 'linux.host-key'],
    prompt: W('Что при входе по ключу уходит с вашего ноутбука на сервер?', 'What leaves your laptop for the server during a key login?'),
    options: [
      { id: 'sig', text: W('Открытый ключ и подпись данных этого сеанса', 'The public key and a signature over this session’s data'), correct: true },
      { id: 'priv', text: W('Закрытый ключ, зашифрованный', 'The private key, encrypted'), why: W('Закрытый ключ не покидает ноутбук никогда, даже в зашифрованном виде.', 'The private key never leaves the laptop, not even encrypted.') },
      { id: 'pw', text: W('Пароль от ключа', 'The key’s passphrase'), why: W('Пароль от ключа нужен только вашему клиенту, чтобы прочитать ключ с диска.', 'The passphrase is needed only by your client, to read the key from disk.') },
    ],
    explain: W('Подпись годится только для этого сеанса: перехватив её, войти в другой раз нельзя. С паролем иначе — он уходит на сервер целиком, поэтому сверка ключа хоста перед ним так важна.', 'The signature is good for this session only: intercepting it gives no way in next time. A password is different — it goes to the server whole, which is why the host key check before it matters so much.'),
  },
  {
    id: 'linux.q.proxyjump',
    kind: 'fill-command',
    concepts: ['linux.bastion'],
    prompt: W('Войдите на `app` пользователем `deploy` через бастион `deploy@bastion` одной командой, без `~/.ssh/config`.', 'Log in to `app` as `deploy` through the bastion `deploy@bastion` with one command, without `~/.ssh/config`.'),
    answers: ['ssh -J deploy@bastion deploy@app', 'ssh -o ProxyJump=deploy@bastion deploy@app', 'ssh deploy@app -J deploy@bastion'],
    explain: W('`-J` — то же, что строка `ProxyJump` в `~/.ssh/config`: клиент входит на бастион и просит у него канал до `app`. Шифрование до `app` сквозное, бастион видит только байты.', '`-J` is the same as a `ProxyJump` line in `~/.ssh/config`: the client logs in to the bastion and asks it for a channel to `app`. The encryption to `app` is end to end; the bastion sees only bytes.'),
  },
  {
    id: 'linux.q.tunnel-sides',
    kind: 'mcq',
    concepts: ['linux.ssh-tunnel'],
    prompt: W('`ssh -L 8080:localhost:5432 app`. Где будет «localhost» для подключения к 5432?', '`ssh -L 8080:localhost:5432 app`. Where is “localhost” for the connection to 5432?'),
    options: [
      { id: 'server', text: W('На `app`: правая часть читается с точки зрения сервера', 'On `app`: the right side is read from the server’s point of view'), correct: true },
      { id: 'laptop', text: W('На вашем ноутбуке', 'On your laptop'), why: W('На ноутбуке открывается только левая часть, 8080. Куда идти дальше, решает `app`.', 'Only the left side, 8080, opens on the laptop. Where to go from there is up to `app`.') },
      { id: 'bastion', text: W('На бастионе', 'On the bastion'), why: W('Здесь бастиона нет вовсе; а с `ProxyJump` дальний конец всё равно на `app`.', 'There is no bastion here at all; and with `ProxyJump` the far end is still on `app`.') },
    ],
    explain: W('Так достают службы, которые слушают только `127.0.0.1` сервера: базы, панели. Наружу ничего не открывается — путь существует, пока жив сеанс SSH.', 'That is how you reach services that listen only on the server’s `127.0.0.1`: databases, admin panels. Nothing opens to the outside — the way exists while the SSH session lives.'),
  },
  // ── OpenRC and nginx ──
  {
    id: 'linux.q.openrc-systemd',
    kind: 'match',
    concepts: ['linux.openrc', 'linux.runlevel'],
    prompt: W('Сопоставьте команду systemd и её пару в OpenRC.', 'Match each systemd command with its OpenRC counterpart.'),
    pairs: [
      { id: 'start', left: 'systemctl start nginx', right: 'rc-service nginx start' },
      { id: 'enable', left: 'systemctl enable nginx', right: 'rc-update add nginx default' },
      { id: 'status', left: 'systemctl list-units --type=service', right: 'rc-status' },
      { id: 'unit', left: '/etc/systemd/system/report.service', right: '/etc/init.d/report' },
    ],
    explain: W('Задачи у обеих систем одни: запустить, включить при загрузке, следить. Различаются файлы и слова: unit-файл против скрипта `openrc-run`, цель `multi-user.target` против уровня запуска `default`.', 'Both systems do the same jobs: start, enable at boot, watch. The files and words differ: a unit file versus an `openrc-run` script, the `multi-user.target` versus the `default` runlevel.'),
  },
  {
    id: 'linux.q.respawn',
    kind: 'mcq',
    concepts: ['linux.openrc'],
    prompt: W('Служба OpenRC описана строками `command=…` и `command_background=true`. Программу убили `kill -9`. Что будет?', 'An OpenRC service is described with `command=…` and `command_background=true`. The program was killed with `kill -9`. What happens?'),
    options: [
      { id: 'dead', text: W('Ничего: OpenRC запустил её и больше за ней не следит', 'Nothing: OpenRC started it and no longer watches it'), correct: true },
      { id: 'restart', text: W('OpenRC перезапустит её, как systemd с Restart=', 'OpenRC restarts it, like systemd with Restart='), why: W('Перезапуск в OpenRC — отдельный надзиратель: строка `supervisor=supervise-daemon`.', 'Restarting in OpenRC is a separate supervisor: the line `supervisor=supervise-daemon`.') },
      { id: 'reboot', text: W('Служба поднимется после перезагрузки сама, раньше — нет', 'The service comes back by itself only after a reboot'), why: W('Поднимется, если она в уровне `default`; но вопрос был о том, что будет сейчас.', 'It does if it is in the `default` runlevel; but the question was about now.') },
    ],
    explain: W('По умолчанию OpenRC только запускает и останавливает. `rc-status` после такого убийства покажет `crashed`. С `supervise-daemon` программа — дочерний процесс надзирателя, и он перезапускает её.', 'By default OpenRC only starts and stops. After such a kill, `rc-status` shows `crashed`. With `supervise-daemon` the program is a child of the supervisor, which restarts it.'),
  },
  {
    id: 'linux.q.nginx-t',
    kind: 'order',
    concepts: ['linux.server-block'],
    prompt: W('Расставьте по порядку безопасную правку сайта на работающем nginx.', 'Put a safe change of a site on a running nginx in order.'),
    steps: [
      { id: 's1', text: W('поправить файл в `/etc/nginx/http.d/`', 'edit the file in `/etc/nginx/http.d/`') },
      { id: 's2', text: W('`nginx -t` — проверить настройки целиком', '`nginx -t` — check the whole configuration') },
      { id: 's3', text: W('`rc-service nginx reload` — перечитать без обрыва подключений', '`rc-service nginx reload` — reread without dropping connections') },
      { id: 's4', text: W('`curl` с соседней машины — проверить результат', '`curl` from a neighbouring machine — check the result') },
    ],
    explain: W('`reload` с ошибкой в настройках nginx не выполнит и продолжит работать со старыми, но ошибку вы увидите только в журнале. `nginx -t` показывает её сразу.', 'With a mistake in the configuration, nginx refuses a `reload` and keeps the old settings, but you would see the error only in the log. `nginx -t` shows it at once.'),
  },
  // ── install ──
  {
    id: 'linux.q.install-order',
    kind: 'order',
    concepts: ['linux.gpt', 'linux.lvm', 'linux.installer'],
    prompt: W('Расставьте шаги установки на чистый диск.', 'Put the steps of an install onto a blank disk in order.'),
    steps: [
      { id: 's1', text: W('таблица разделов GPT: BIOS boot, `/boot`, LVM', 'a GPT partition table: BIOS boot, `/boot`, LVM') },
      { id: 's2', text: W('`pvcreate`, `vgcreate`, `lvcreate`', '`pvcreate`, `vgcreate`, `lvcreate`') },
      { id: 's3', text: W('`mkfs.ext4` на `/boot` и на томе корня', '`mkfs.ext4` on `/boot` and on the root volume') },
      { id: 's4', text: W('смонтировать корень в `/mnt`, затем `/mnt/boot`', 'mount the root at `/mnt`, then `/mnt/boot`') },
      { id: 's5', text: W('поставить пакеты, fstab и загрузчик (`setup-disk`)', 'install the packages, fstab and the boot loader (`setup-disk`)') },
      { id: 's6', text: W('перезагрузиться без носителя', 'reboot without the media') },
    ],
    explain: W('Каждый шаг опирается на предыдущий: файловую систему создают на томе, том — в группе, группу — на разделе. Загрузчик ставят последним, потому что ему нужно знать, где лежит готовый `/boot`.', 'Each step stands on the previous one: the file system is created on a volume, the volume in a group, the group on a partition. The boot loader goes last because it needs to know where the finished `/boot` is.'),
  },
  {
    id: 'linux.q.initramfs-lvm',
    kind: 'mcq',
    concepts: ['linux.initramfs', 'linux.lvm'],
    prompt: W('После установки загрузка доходит до `mounting /dev/mapper/vg0-root on /sysroot failed` и открывает аварийную оболочку. GRUB отработал. Что вероятнее всего?', 'After the install the boot reaches `mounting /dev/mapper/vg0-root on /sysroot failed` and opens an emergency shell. GRUB worked. What is most likely?'),
    options: [
      { id: 'initramfs', text: W('initramfs собрана без поддержки LVM: группа томов не включилась', 'The initramfs was built without LVM support: the volume group was not switched on'), correct: true },
      { id: 'fstab', text: W('Ошибка в `/etc/fstab`', 'A mistake in `/etc/fstab`'), why: W('fstab читается уже с корня, а до корня дело не дошло.', 'fstab is read from the root, and the boot never got that far.') },
      { id: 'grub', text: W('Не установлен загрузчик', 'The boot loader is not installed'), why: W('Без загрузчика не было бы ни ядра, ни этого сообщения.', 'Without a boot loader there would be neither a kernel nor this message.') },
    ],
    explain: W('Корень на LVM виден ядру только после `vgchange -ay`, и делает это initramfs. В Alpine за это отвечает `lvm` в `features` из `/etc/mkinitfs/mkinitfs.conf`; после правки initramfs пересобирают `mkinitfs` в chroot с носителя.', 'A root on LVM is visible to the kernel only after `vgchange -ay`, and the initramfs does that. In Alpine it is `lvm` in the `features` of `/etc/mkinitfs/mkinitfs.conf`; after the edit the initramfs is rebuilt with `mkinitfs` in a chroot from the media.'),
  },
  {
    id: 'linux.q.bios-boot',
    kind: 'mcq',
    concepts: ['linux.gpt'],
    prompt: W('`grub-install` на диск GPT отвечает `this GPT partition label contains no BIOS Boot Partition`. Что не так?', '`grub-install` on a GPT disk answers `this GPT partition label contains no BIOS Boot Partition`. What is wrong?'),
    options: [
      { id: 'part', text: W('Нет маленького раздела типа BIOS boot для основной части GRUB', 'There is no small partition of type BIOS boot for GRUB’s main part'), correct: true },
      { id: 'mbr', text: W('GRUB вообще не умеет GPT', 'GRUB cannot do GPT at all'), why: W('Умеет — ему лишь нужно место, которое на MBR давал промежуток перед первым разделом.', 'It can — it just needs the room that the gap before the first partition gave it on MBR.') },
      { id: 'fs', text: W('На `/boot` не та файловая система', '`/boot` has the wrong file system'), why: W('Речь о разделе без файловой системы вовсе, не о `/boot`.', 'This is about a partition with no file system at all, not `/boot`.') },
    ],
  },
  // ── disks ──
  {
    id: 'linux.q.truncate-fd',
    kind: 'mcq',
    concepts: ['linux.fd'],
    prompt: W('`lsof +L1` показывает `legacy-a 812 root 3w … 62914560 0 … /srv/shop/log/debug.log (deleted)`. Агент нужен работающим. Как вернуть 60 МБ?', '`lsof +L1` shows `legacy-a 812 root 3w … 62914560 0 … /srv/shop/log/debug.log (deleted)`. The agent must keep running. How do you get the 60 MB back?'),
    options: [
      { id: 'fd', text: W('`: > /proc/812/fd/3` — обрезать файл через дескриптор', '`: > /proc/812/fd/3` — truncate the file through the descriptor'), correct: true },
      { id: 'rm', text: W('`rm /srv/shop/log/debug.log` ещё раз', '`rm /srv/shop/log/debug.log` once more'), why: W('Имени уже нет: удалять нечего, а данные держит открытый дескриптор.', 'The name is already gone: there is nothing to delete, and the open descriptor holds the data.') },
      { id: 'kill', text: W('`kill -9 812`', '`kill -9 812`'), why: W('Место вернётся, но агент остановится, а его просили не трогать.', 'The space comes back, but the agent stops, and you were asked to keep it.') },
    ],
    explain: W('`/proc/<pid>/fd/<n>` — путь к открытому файлу даже без имени. Запись пустоты обрезает его до нуля, процесс продолжает писать с начала.', '`/proc/<pid>/fd/<n>` is a path to the open file even without a name. Writing nothing truncates it to zero, and the process keeps writing from the start.'),
  },
  {
    id: 'linux.q.lvextend-r',
    kind: 'mcq',
    concepts: ['linux.lv-extend', 'linux.lvm'],
    prompt: W('После `lvextend -L 220M data/shop` команда `df -h /srv/shop` показывает прежние 110 МБ. Почему?', 'After `lvextend -L 220M data/shop`, `df -h /srv/shop` shows the same 110 MB. Why?'),
    options: [
      { id: 'fs', text: W('Вырос том, а файловая система на нём осталась прежней', 'The volume grew, but the file system on it stayed the same'), correct: true },
      { id: 'umount', text: W('Изменения видны только после отмонтирования', 'The change shows only after unmounting'), why: W('ext4 растягивается и смонтированной: `resize2fs` или `lvextend -r`.', 'ext4 grows while mounted: `resize2fs` or `lvextend -r`.') },
      { id: 'reboot', text: W('Нужна перезагрузка', 'A reboot is needed'), why: W('Ни ядру, ни LVM перезагрузка для этого не нужна.', 'Neither the kernel nor LVM needs a reboot for this.') },
    ],
  },
];
