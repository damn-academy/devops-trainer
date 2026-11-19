// Lessons of the Linux block on real machines (design 00 §6.13): what an
// admin does by hand before containers, on real Alpine Linux machines in the
// tab — SSH between machines, a web server for the neighbour and services on
// OpenRC, installing a system onto a blank disk, a full partition with a
// deleted open file. The simulator lessons stay; these come after them, where
// a real kernel, a second machine or a real disk adds what a model cannot.

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { DISK_LAB, INSTALL_LAB, SSH_LAB, WEB_LAB } from './reallab/labs';
import { arch, man7, sources, wiki } from './shared';

const obsd = (name: string, sec: number) => ({ title: `${name}(${sec}) — OpenBSD manual`, url: `https://man.openbsd.org/${name}.${sec}` });
const ALPINE = (title: string, path: string) => ({ title: `${title} — Alpine Linux Wiki`, url: `https://wiki.alpinelinux.org/wiki/${path}` });

const sshHops: Lesson = {
  id: 'linux.ssh-hops',
  block: 'linux',
  title: bi('SSH между машинами: бастион, config, scp и туннели', 'SSH between machines: a bastion, config, scp and tunnels'),
  summary: bi(
    'Три настоящие машины: ваш ноутбук, бастион и сервер приложения за ним. Ключи, проверка сервера по ключу хоста, `~/.ssh/config` с прыжком через бастион, копирование файлов и туннель к службе, которую снаружи не видно.',
    'Three real machines: your laptop, a bastion and the application server behind it. Keys, checking the server by its host key, `~/.ssh/config` with a jump through the bastion, copying files and a tunnel to a service nobody outside can see.',
  ),
  introduces: ['linux.host-key', 'linux.bastion', 'linux.ssh-tunnel'],
  uses: ['linux.ssh-key', 'linux.net-commands', 'linux.mode', 'linux.daemon', 'linux.home'],
  tier: 'core',
  minutes: 45,
  sources: sources([obsd('ssh', 1), obsd('ssh_config', 5), obsd('sshd', 8), obsd('scp', 1), { title: 'RFC 4252 — The Secure Shell (SSH) Authentication Protocol', url: 'https://www.rfc-editor.org/rfc/rfc4252' }], [wiki('SSH', 'SSH'), arch('OpenSSH (Русский)', 'OpenSSH_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)'), { title: 'ssh_config(5) — русский перевод (OpenNet)', url: 'https://www.opennet.ru/man.shtml?topic=ssh_config&category=5&russian=0' }]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вам дали доступ: «Сервер приложения — `app`, но снаружи туда не попасть, заходи через `bastion`. Панель заказов на самом `app`, порт наружу не открыт». Чтобы это стало одной командой `ssh app`, а панель открывалась у вас в браузере, нужны три вещи, которых в первом уроке про SSH не было.',
        'You were given access: “The application server is `app`, but you cannot reach it from outside, go through `bastion`. The orders panel is on `app` itself, and it is not open to the outside.” To turn this into one command, `ssh app`, and have the panel open in your browser, you need three things the first SSH lesson did not have.',
      ),
    },
    {
      id: 'session',
      kind: 'text',
      step: 'explain',
      title: bi('Две проверки при каждом входе', 'Two checks at every login'),
      body: bi(
        'Вход по SSH проверяет обе стороны. Сначала сервер доказывает, что он — тот самый сервер: у него есть собственная пара ключей, [[linux.host-key|ключ хоста]], и закрытой половиной он подписывает данные сеанса. Клиент сверяет открытую половину с записью в `~/.ssh/known_hosts`. Записи нет — клиент показывает отпечаток и спрашивает, доверять ли; запись другая — отказывается подключаться совсем. Ответ «yes», не глядя на отпечаток, отменяет смысл первой проверки: отпечаток сверяют с тем, что дал администратор.\n\nПотом вы доказываете, кто вы. С ключом клиент предлагает серверу открытую половину, сервер ищет её в `authorized_keys`, и клиент подписывает данные этого сеанса закрытой. По сети уходит подпись, сам ключ — никогда. С паролем иначе: он уходит на сервер целиком. Поэтому на настоящих серверах вход по паролю выключают, а первый ключ относят туда один раз — `ssh-copy-id` спрашивает пароль и дописывает ключ в `authorized_keys` с правильными правами.',
        'An SSH login checks both sides. First the server proves it is the same server: it has its own key pair, the [[linux.host-key|host key]], and signs the session’s data with the private half. The client compares the public half with the entry in `~/.ssh/known_hosts`. No entry — the client shows the fingerprint and asks whether to trust it; a different entry — it refuses to connect at all. Answering “yes” without looking at the fingerprint cancels the point of the first check: compare it with the one the admin gave you.\n\nThen you prove who you are. With a key, the client offers the server the public half, the server looks it up in `authorized_keys`, and the client signs this session’s data with the private one. A signature goes over the network, the key itself never does. A password is different: it goes to the server whole. That is why real servers switch password logins off, and the first key is taken there once — `ssh-copy-id` asks for the password and appends the key to `authorized_keys` with the right permissions.',
      ),
    },
    { id: 'explain', kind: 'explainer', step: 'look', explainer: 'linux.ssh-session', caption: bi('Поменяйте «Что клиент знает о сервере» и включите поломку прав: где именно останавливается вход?', 'Change “What the client knows about the server” and switch on the permissions break: where exactly does the login stop?') },
    {
      id: 'config',
      kind: 'text',
      step: 'explain',
      title: bi('Бастион и ~/.ssh/config', 'The bastion and ~/.ssh/config'),
      body: bi(
        'Серверы внутри сети обычно не принимают SSH-подключений извне. Снаружи видна одна машина — [[linux.bastion|бастион]], и на остальные ходят через неё. `ssh -J deploy@bastion deploy@app` сначала входит на бастион, а потом просит sshd бастиона открыть канал до `app`. Шифрование при этом сквозное: ключи сеанса с `app` знают только ваш клиент и `app`, бастион передаёт байты, но прочитать их не может. Бастиону для этого нужно разрешение `AllowTcpForwarding` — в Alpine оно по умолчанию выключено, и в этой лаборатории администратор его уже включил.\n\nПечатать каждый раз адреса, имена пользователей и прыжки утомительно. Всё это записывают в `~/.ssh/config`:\n\n```\nHost bastion\n    User deploy\n\nHost app\n    User deploy\n    ProxyJump bastion\n```\n\nИмена `bastion` и `app` машина уже знает из `/etc/hosts`. Если имя в `Host` — только псевдоним, настоящий адрес задают строкой `HostName 10.0.0.12`; учтите, что ключ хоста клиент тогда ищет в known_hosts по этому адресу и при первом входе спросит отпечаток снова. Теперь `ssh app`, `scp файл app:` и `ssh-copy-id app` сами берут нужного пользователя и путь. Что клиент понял из файла, показывает `ssh -G app`: там итоговые значения всех настроек, в том числе `user` и `proxyjump`.',
        'Servers inside a network usually accept no SSH connections from outside. One machine is visible from outside — the [[linux.bastion|bastion]] — and the others are reached through it. `ssh -J deploy@bastion deploy@app` first logs in to the bastion, then asks the bastion’s sshd to open a channel to `app`. The encryption is end to end: only your client and `app` know the session keys with `app`; the bastion passes the bytes but cannot read them. The bastion needs the `AllowTcpForwarding` permission for this — Alpine switches it off by default, and in this lab the admin has already switched it on.\n\nTyping addresses, user names and jumps every time is tiresome. All of it goes into `~/.ssh/config`:\n\n```\nHost bastion\n    User deploy\n\nHost app\n    User deploy\n    ProxyJump bastion\n```\n\nThe machine already knows the names `bastion` and `app` from `/etc/hosts`. If the name in `Host` is only an alias, the real address goes into a `HostName 10.0.0.12` line; note that the client then looks the host key up in known_hosts by that address and asks about the fingerprint again on the first login. Now `ssh app`, `scp file app:` and `ssh-copy-id app` take the right user and path by themselves. `ssh -G app` shows what the client made of the file: the final values of all settings, `user` and `proxyjump` among them.',
      ),
    },
    {
      id: 'tunnel',
      kind: 'text',
      step: 'explain',
      title: bi('Файлы и туннели', 'Files and tunnels'),
      body: bi(
        '`scp` копирует файлы по тому же каналу и понимает те же имена: `scp ~/release-notes.txt app:` кладёт файл в домашний каталог на `app`, `scp app:/var/log/app.log .` забирает обратно, `-r` копирует каталог.\n\nИногда нужна не оболочка, а служба на сервере, которая слушает только его собственный `127.0.0.1`: база данных, панель администратора. Снаружи до неё не дотянуться — и правильно. [[linux.ssh-tunnel|Туннель SSH]] даёт к ней дорогу на время сеанса: `ssh -L 8080:localhost:8080 app` начинает слушать 8080 у вас, а всё, что туда пришло, sshd на `app` передаёт на адрес из правой части — «localhost» здесь читается с точки зрения `app`. `-N` говорит не запускать оболочку, `-f` — уйти в фон после входа. Закончился сеанс — дороги больше нет, ни одного правила межсетевого экрана никто не менял.',
        '`scp` copies files over the same channel and understands the same names: `scp ~/release-notes.txt app:` puts the file into the home directory on `app`, `scp app:/var/log/app.log .` brings one back, `-r` copies a directory.\n\nSometimes you need not a shell but a service on the server that listens only on its own `127.0.0.1`: a database, an admin panel. Nobody outside can reach it — and rightly so. An [[linux.ssh-tunnel|SSH tunnel]] gives you a way to it for the length of a session: `ssh -L 8080:localhost:8080 app` starts listening on 8080 on your side, and sshd on `app` passes whatever arrives there to the address on the right — “localhost” is read from `app`’s point of view here. `-N` says not to start a shell, `-f` to go to the background after logging in. When the session ends, the way is gone, and nobody changed a single firewall rule.',
      ),
    },
    { id: 'lab', kind: 'widget', step: 'practice', widget: 'linux.lab', props: SSH_LAB },
    {
      id: 'exam-link',
      kind: 'callout',
      tone: 'note',
      step: 'exit',
      title: bi('Учебный экзамен в браузере', 'A learning exam in the browser'),
      body: bi(
        'Экзамен «Доступ для новой разработчицы» можно сдать и без своих машин: [его вариант на двух машинах во вкладке](#/lab/linux-access) — тот же сюжет на Alpine Linux, без подсказок.',
        'The exam “Access for a new developer” can be taken without machines of your own too: [its variant on two machines in the tab](#/lab/linux-access) — the same story on Alpine Linux, without hints.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.hostkey-changed', 'linux.q.key-not-sent', 'linux.q.proxyjump', 'linux.q.tunnel-sides'] },
  ],
};

const webOpenrc: Lesson = {
  id: 'linux.web-openrc',
  block: 'linux',
  title: bi('Веб-сервер для соседа и службы OpenRC', 'A web server for the neighbour, and services on OpenRC'),
  summary: bi(
    'nginx отдаёт страницу магазина соседней машине. Службами здесь управляет не systemd, а OpenRC: запустить, включить при загрузке, написать свою службу и сделать так, чтобы её поднимали после падения.',
    'nginx serves the shop’s page to the neighbouring machine. Here services are managed not by systemd but by OpenRC: start one, enable it at boot, write your own service and make it come back after a crash.',
  ),
  introduces: ['linux.openrc', 'linux.runlevel', 'linux.server-block'],
  uses: ['linux.daemon', 'linux.systemd', 'linux.unit', 'linux.journal', 'linux.signal', 'linux.script', 'linux.shebang'],
  tier: 'core',
  minutes: 45,
  sources: sources([ALPINE('OpenRC', 'OpenRC'), { title: 'OpenRC Service Script Writing Guide', url: 'https://github.com/OpenRC/openrc/blob/master/service-script-guide.md' }, { title: 'nginx: Beginner’s Guide', url: 'https://nginx.org/en/docs/beginners_guide.html' }, { title: 'nginx: ngx_http_core_module', url: 'https://nginx.org/en/docs/http/ngx_http_core_module.html' }], [wiki('OpenRC', 'OpenRC'), wiki('Nginx', 'Nginx'), { title: 'nginx: руководство для начинающих', url: 'https://nginx.org/ru/docs/beginners_guide.html' }]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Страница магазина лежит на сервере, но соседняя машина её не видит, а после перезагрузки сервера сайт не поднимется. В уроке про службы это делал systemd. На этом сервере systemd нет вовсе — и всё равно всё делается теми же тремя шагами.',
        'The shop’s page is on the server, but the neighbouring machine does not see it, and after a server reboot the site will not come up. In the lesson on services systemd did this. This server has no systemd at all — and it is still done in the same three steps.',
      ),
    },
    {
      id: 'openrc',
      kind: 'text',
      step: 'explain',
      title: bi('Не systemd, а OpenRC', 'Not systemd but OpenRC'),
      body: bi(
        'Машины этой лаборатории — Alpine Linux, маленький дистрибутив, на котором часто собирают образы и маленькие серверы. Службы в нём запускает [[linux.openrc|OpenRC]]. Задачи у него те же, что у systemd: запустить службу, включить её при загрузке, показать состояние. Слова другие:\n\n- `rc-service nginx start` — запустить сейчас (`stop`, `restart`, `reload`, `status` — как у `systemctl`);\n- `rc-update add nginx default` — поднимать при загрузке; `rc-update del` — больше не поднимать;\n- `rc-status` — что запущено, а что упало.\n\nВместо целей systemd у OpenRC [[linux.runlevel|уровни запуска]]: `sysinit` и `boot` поднимают саму систему, `default` — обычные службы. `rc-update add … default` — это `systemctl enable`: файл службы попадает в `/etc/runlevels/default/`, а запуском сейчас это не является. Журнала в духе journald здесь нет: службы пишут в свои файлы в `/var/log/`, сообщения системы собирает syslog в `/var/log/messages`.\n\nНа Debian, Ubuntu и большинстве серверов, с которыми вы будете работать, — systemd. Поэтому уроки про systemd остаются как есть, а этот урок показывает, что меняются команды, а смысл тот же.',
        'The machines of this lab are Alpine Linux, a small distribution often used for images and small servers. Its services are started by [[linux.openrc|OpenRC]]. Its jobs are the same as systemd’s: start a service, enable it at boot, show the state. The words differ:\n\n- `rc-service nginx start` — start it now (`stop`, `restart`, `reload`, `status` — as with `systemctl`);\n- `rc-update add nginx default` — bring it up at boot; `rc-update del` — no longer;\n- `rc-status` — what is running and what has crashed.\n\nInstead of systemd targets, OpenRC has [[linux.runlevel|runlevels]]: `sysinit` and `boot` bring up the system itself, `default` the ordinary services. `rc-update add … default` is `systemctl enable`: the service file goes into `/etc/runlevels/default/`, and it does not start anything now. There is no journal in the spirit of journald here: services write to their own files in `/var/log/`, and syslog collects the system’s messages in `/var/log/messages`.\n\nDebian, Ubuntu and most of the servers you will work with run systemd. That is why the lessons on systemd stay as they are, and this lesson shows that the commands change while the meaning stays.',
      ),
    },
    {
      id: 'nginx',
      kind: 'text',
      step: 'explain',
      title: bi('Сайт в nginx', 'A site in nginx'),
      body: bi(
        'nginx читает `/etc/nginx/nginx.conf`, а он подключает файлы сайтов из `/etc/nginx/http.d/*.conf` (в Debian — `/etc/nginx/sites-enabled/`). Один сайт — один [[linux.server-block|блок server]]:\n\n```\nserver {\n    listen 80;\n    server_name web;\n    root /srv/shop;\n    index index.html;\n}\n```\n\n`listen` — какой номер слушать, `server_name` — имя сайта, `root` — каталог, из которого отдаются файлы: запрос `/about.html` превращается в файл `/srv/shop/about.html`. Блоков на одном номере может быть много: nginx выбирает тот, чьё имя совпало с именем сайта в запросе, а если не совпало ни одно — блок с пометкой `default_server`. В Alpine пакет кладёт такой блок в `/etc/nginx/http.d/default.conf`, и на всё он отвечает 404 — первая встреча с ним обычно выглядит как «сайт не работает». Каждую правку проверяют `nginx -t`: он читает все настройки целиком и называет строку с ошибкой. Применяют правку через `reload` — nginx перечитывает настройки, не обрывая открытых подключений, а с ошибкой в настройках просто остаётся со старыми.\n\nПроверять сайт надо не только с самого сервера: `curl http://localhost/` на сервере ничего не говорит о том, видит ли сайт кто-то ещё. Поэтому в лаборатории вторая машина.',
        'nginx reads `/etc/nginx/nginx.conf`, which includes the site files from `/etc/nginx/http.d/*.conf` (on Debian, `/etc/nginx/sites-enabled/`). One site is one [[linux.server-block|server block]]:\n\n```\nserver {\n    listen 80;\n    server_name web;\n    root /srv/shop;\n    index index.html;\n}\n```\n\n`listen` is the number to listen on, `server_name` the site’s name, `root` the directory the files come from: a request for `/about.html` becomes the file `/srv/shop/about.html`. One number can have many blocks: nginx picks the one whose name matches the site name in the request, and if none matches, the block marked `default_server`. In Alpine the package puts such a block into `/etc/nginx/http.d/default.conf`, and it answers 404 to everything — the first meeting with it usually looks like “the site is down”. Every change is checked with `nginx -t`: it reads the whole configuration and names the line with the mistake. A change is applied with `reload` — nginx rereads the settings without dropping open connections, and with a mistake in them it simply keeps the old ones.\n\nCheck the site not only from the server itself: `curl http://localhost/` on the server says nothing about whether anybody else can see the site. That is why the lab has a second machine.',
      ),
    },
    {
      id: 'script',
      kind: 'text',
      step: 'explain',
      title: bi('Своя служба', 'A service of your own'),
      body: bi(
        'Unit-файлу systemd в OpenRC соответствует скрипт в `/etc/init.d/` с первой строкой `#!/sbin/openrc-run`. Обычно хватает нескольких переменных:\n\n```\n#!/sbin/openrc-run\ndescription="Nightly sales report"\ncommand=/usr/local/bin/report\ncommand_background=true\npidfile=/run/report.pid\n```\n\n`command_background=true` нужен программам, которые сами в фон не уходят: OpenRC запустит её в фоне и запишет номер в `pidfile`. Скрипт должен быть исполняемым.\n\nТак OpenRC только запускает и останавливает. Если программа упадёт, `rc-status` покажет `crashed`, и всё. Перезапуск — отдельный надзиратель: строка `supervisor=supervise-daemon` вместо `command_background` и `pidfile`. Тогда программа — дочерний процесс `supervise-daemon`, и он поднимает её снова, как `Restart=` в systemd; `respawn_delay` и `respawn_max` задают паузу и предел попыток.',
        'In OpenRC, the counterpart of a systemd unit file is a script in `/etc/init.d/` whose first line is `#!/sbin/openrc-run`. A few variables are usually enough:\n\n```\n#!/sbin/openrc-run\ndescription="Nightly sales report"\ncommand=/usr/local/bin/report\ncommand_background=true\npidfile=/run/report.pid\n```\n\n`command_background=true` is for programs that do not go to the background by themselves: OpenRC starts it in the background and writes its number into `pidfile`. The script must be executable.\n\nThat way OpenRC only starts and stops. If the program dies, `rc-status` shows `crashed`, and that is all. Restarting is a separate supervisor: the line `supervisor=supervise-daemon` instead of `command_background` and `pidfile`. Then the program is a child of `supervise-daemon`, which brings it back, like `Restart=` in systemd; `respawn_delay` and `respawn_max` set the pause and the limit of attempts.',
      ),
    },
    { id: 'lab', kind: 'widget', step: 'practice', widget: 'linux.lab', props: WEB_LAB },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.openrc-systemd', 'linux.q.respawn', 'linux.q.nginx-t'] },
  ],
};

const install: Lesson = {
  id: 'linux.install',
  block: 'linux',
  title: bi('Установка системы на чистый диск', 'Installing a system onto a blank disk'),
  summary: bi(
    'Машина с пустым диском и установочным носителем Alpine Linux. Разметка GPT, LVM, файловые системы, установка пакетов, fstab и загрузчик — и перезагрузка, после которой машина либо загружается сама, либо нет.',
    'A machine with a blank disk and Alpine Linux installer media. GPT partitioning, LVM, file systems, installing the packages, fstab and the boot loader — and a reboot after which the machine either boots by itself or does not.',
  ),
  introduces: ['linux.gpt', 'linux.lvm', 'linux.initramfs', 'linux.installer'],
  uses: ['linux.block-device', 'linux.filesystem', 'linux.mount', 'linux.kernel', 'linux.openrc', 'linux.runlevel', 'linux.package', 'linux.repo'],
  tier: 'plus',
  minutes: 50,
  sources: sources(
    [ALPINE('Installation', 'Installation'), ALPINE('Setting up disks manually', 'Setting_up_disks_manually'), man7('sfdisk', 8), man7('lvm', 8), { title: 'GNU GRUB Manual — BIOS installation', url: 'https://www.gnu.org/software/grub/manual/grub/grub.html#BIOS-installation' }],
    [wiki('GUID Partition Table', 'GUID_Partition_Table'), wiki('LVM', 'LVM'), wiki('initrd', 'Initrd'), arch('LVM (Русский)', 'LVM_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)')],
  ),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Облако выдаёт машину с уже установленной системой, и кажется, что так было всегда. Но кто-то разметил этот диск, выбрал, где будет корень, записал загрузчик и fstab. Когда сервер не загружается после замены диска или ошибки в fstab, чинить его приходится именно на этом уровне — с установочного носителя.',
        'A cloud hands you a machine with a system already installed, and it seems it was always so. But somebody partitioned that disk, chose where the root goes, wrote the boot loader and fstab. When a server does not boot after a disk swap or a mistake in fstab, it is fixed exactly at this level — from installer media.',
      ),
    },
    {
      id: 'layout',
      kind: 'text',
      step: 'explain',
      title: bi('Разметка: GPT и LVM', 'The layout: GPT and LVM'),
      body: bi(
        'Машина загрузилась с [[linux.installer|установочного носителя]]: это живая система в памяти и репозиторий пакетов. Диск `/dev/sda` пуст. Сначала на нём нужна таблица разделов. [[linux.gpt|GPT]] — современная: до 128 разделов, у каждого тип в виде GUID, копия таблицы в конце диска на случай порчи. Старая MBR (метка `dos`) знает четыре раздела и диски до 2 ТиБ.\n\nДальше — раздел под загрузчик. Прошивка BIOS читает только первые 440 байт диска; туда помещается лишь крошечная часть GRUB. На MBR остальное лежит в промежутке перед первым разделом, на GPT для него делают отдельный раздел типа BIOS boot размером 1–2 МиБ, без файловой системы. На машинах с UEFI вместо него нужен раздел EFI с FAT, но здесь BIOS.\n\nКорень кладут не прямо на раздел, а в [[linux.lvm|LVM]]: раздел становится физическим томом (`pvcreate`), физические тома собираются в группу (`vgcreate`), а из группы нарезаются логические тома (`lvcreate`) — их можно растить на ходу и переносить на другие диски, не трогая файловую систему сверху. `/boot` оставляют обычным разделом: так GRUB проще всего его найти.\n\n```\n/dev/sda1   2 MiB   BIOS boot\n/dev/sda2 200 MiB   ext4 → /boot\n/dev/sda3  остаток  LVM → vg0 → root (ext4 → /)\n```',
        'The machine has booted from [[linux.installer|installer media]]: a live system in memory and a package repository. The disk `/dev/sda` is blank. First it needs a partition table. [[linux.gpt|GPT]] is the modern one: up to 128 partitions, each with a type as a GUID, a copy of the table at the end of the disk in case of damage. The old MBR (the `dos` label) knows four partitions and disks up to 2 TiB.\n\nNext comes a partition for the boot loader. A BIOS firmware reads only the first 440 bytes of the disk; only a tiny part of GRUB fits there. On MBR the rest lives in the gap before the first partition; on GPT it gets a partition of its own of type BIOS boot, 1–2 MiB, without a file system. Machines with UEFI need an EFI partition with FAT instead, but this one has a BIOS.\n\nThe root goes not straight onto a partition but into [[linux.lvm|LVM]]: the partition becomes a physical volume (`pvcreate`), physical volumes join a group (`vgcreate`), and logical volumes are cut from the group (`lvcreate`) — they can be grown live and moved to other disks without touching the file system on top. `/boot` stays a plain partition: that way GRUB finds it most easily.\n\n```\n/dev/sda1   2 MiB   BIOS boot\n/dev/sda2 200 MiB   ext4 → /boot\n/dev/sda3  the rest  LVM → vg0 → root (ext4 → /)\n```',
      ),
    },
    {
      id: 'boot',
      kind: 'text',
      step: 'explain',
      title: bi('Что прочитает первая загрузка', 'What the first boot will read'),
      body: bi(
        'Установка — это запись того, что машина потом прочитает в обратном порядке. Прошивка читает сектор 0, оттуда GRUB достаёт свою основную часть из раздела BIOS boot, читает меню `/boot/grub/grub.cfg` и загружает ядро вместе с [[linux.initramfs|initramfs]] — маленькой системой в памяти. Ядро само не умеет включать группы томов LVM, поэтому корень находит initramfs: включает `vg0`, монтирует `/dev/vg0/root` и передаёт ему управление. Дальше работает уже система с диска: OpenRC поднимает уровни запуска, а служба `localmount` монтирует всё из `/etc/fstab`.\n\nВ Alpine всё от пакетов до загрузчика делает `setup-disk`: ставит систему в смонтированный `/mnt` из репозитория носителя, пишет fstab по тому, что смонтировано, собирает initramfs с поддержкой LVM и ставит загрузчик (`BOOTLOADER=grub` выбирает GRUB). Можно и руками — `apk add --root /mnt`, `grub-install` и правка fstab, — но смысл шагов тот же.',
        'An install is the writing of what the machine will later read in reverse order. The firmware reads sector 0; from there GRUB fetches its main part from the BIOS boot partition, reads the menu `/boot/grub/grub.cfg` and loads the kernel together with the [[linux.initramfs|initramfs]] — a small system in memory. The kernel cannot switch on LVM volume groups by itself, so the initramfs finds the root: it switches on `vg0`, mounts `/dev/vg0/root` and hands control to it. From there the system on the disk runs: OpenRC brings up the runlevels, and the `localmount` service mounts everything from `/etc/fstab`.\n\nIn Alpine, everything from the packages to the boot loader is done by `setup-disk`: it installs the system into the mounted `/mnt` from the media’s repository, writes fstab from what is mounted, builds an initramfs with LVM support and installs the boot loader (`BOOTLOADER=grub` picks GRUB). It can be done by hand too — `apk add --root /mnt`, `grub-install` and editing fstab — but the meaning of the steps is the same.',
      ),
    },
    { id: 'explain', kind: 'explainer', step: 'look', explainer: 'linux.install', caption: bi('Пройдите загрузку по шагам, потом уберите загрузчик и поддержку LVM: где остановится машина и что напишет?', 'Walk through the boot step by step, then remove the boot loader and the LVM support: where does the machine stop, and what does it print?') },
    {
      id: 'warn',
      kind: 'callout',
      tone: 'warn',
      step: 'try',
      title: bi('Настоящая установка', 'A real install'),
      body: bi(
        'Здесь всё настоящее, только диск виртуальный и живёт во вкладке. `sfdisk` и `mkfs` стирают данные без вопросов; на своём компьютере сначала трижды проверяют, какой диск выбран, — `lsblk` показывает размеры и модели.',
        'Everything here is real, only the disk is virtual and lives in the tab. `sfdisk` and `mkfs` wipe data without asking; on your own computer you first check three times which disk is chosen — `lsblk` shows the sizes and models.',
      ),
    },
    { id: 'lab', kind: 'widget', step: 'practice', widget: 'linux.lab', props: INSTALL_LAB },
    {
      id: 'exam-link',
      kind: 'callout',
      tone: 'note',
      step: 'exit',
      title: bi('Вариант экзаменом', 'As an exam'),
      body: bi(
        'Та же машина, но без подсказок и с другим заданием — сервер базы данных с отдельным томом под журналы: [учебный экзамен «Установка»](#/lab/linux-install).',
        'The same machine, but without hints and with another task — a database server with a separate volume for logs: [the learning exam “Install”](#/lab/linux-install).',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.install-order', 'linux.q.bios-boot', 'linux.q.initramfs-lvm'] },
  ],
};

const diskReal: Lesson = {
  id: 'linux.disk-real',
  block: 'linux',
  title: bi('Раздел заполнен: настоящий lsof и том, который растёт на ходу', 'The partition is full: a real lsof and a volume that grows live'),
  summary: bi(
    'На настоящем ядре: `df` и `du` расходятся, потому что удалённый журнал держит открытым процесс. Найти его через `lsof` и `/proc`, вернуть место, не останавливая процесс, и дать разделу запас, увеличив том LVM без отмонтирования.',
    'On a real kernel: `df` and `du` disagree because a process holds a deleted log open. Find it with `lsof` and `/proc`, get the space back without stopping the process, and give the partition room by growing the LVM volume without unmounting.',
  ),
  introduces: ['linux.fd', 'linux.lv-extend'],
  uses: ['linux.inode', 'linux.lvm', 'linux.process', 'linux.procfs', 'linux.mount', 'linux.filesystem'],
  tier: 'core',
  minutes: 35,
  sources: sources([{ title: 'lsof(8) manual page', url: 'https://lsof.readthedocs.io/en/latest/manpage/' }, man7('proc_pid_fd', 5), man7('lvextend', 8), man7('resize2fs', 8)], [wiki('Файловый дескриптор', '%D0%A4%D0%B0%D0%B9%D0%BB%D0%BE%D0%B2%D1%8B%D0%B9_%D0%B4%D0%B5%D1%81%D0%BA%D1%80%D0%B8%D0%BF%D1%82%D0%BE%D1%80'), arch('LVM (Русский)', 'LVM_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)')]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В уроке про диски была загадка: `df` говорит «полон», `du` насчитывает куда меньше. В симуляторе это было рассказом. Здесь — настоящий сервер магазина, на котором кто-то уже удалил разросшийся журнал командой `rm`, и место от этого не вернулось.',
        'The lesson on disks had a riddle: `df` says “full”, `du` counts far less. In the simulator it was a story. Here is the shop’s real server, where somebody has already deleted an overgrown log with `rm`, and the space did not come back.',
      ),
    },
    {
      id: 'fd',
      kind: 'text',
      step: 'explain',
      title: bi('Открытый файл без имени', 'An open file without a name'),
      body: bi(
        'Процесс работает с файлом через [[linux.fd|дескриптор файла]] — номер в его таблице открытых файлов: 0, 1, 2 — стандартные потоки, дальше — всё, что он открыл сам. Ядро показывает эту таблицу в `/proc/<pid>/fd/`: там по ссылке на каждый открытый файл. `rm` убирает только имя. Если файл открыт, inode и данные живут, а ссылка в `/proc/<pid>/fd/` показывает путь с пометкой `(deleted)`.\n\n`lsof +L1` собирает такие файлы со всей системы: у них число ссылок (колонка NLINK) равно нулю. Колонка FD говорит номер и режим: `3w` — дескриптор 3, открыт на запись.\n\nВернуть место можно двумя способами. Перезапустить процесс — он закроет файл, и ядро освободит блоки. Или обрезать файл через дескриптор, не трогая процесс: `: > /proc/812/fd/3`. Второй способ годится, когда процесс останавливать нельзя.',
        'A process works with a file through a [[linux.fd|file descriptor]] — a number in its table of open files: 0, 1, 2 are the standard streams, then whatever it opened itself. The kernel shows this table in `/proc/<pid>/fd/`: one link per open file. `rm` removes only the name. If the file is open, the inode and the data live, and the link in `/proc/<pid>/fd/` shows the path marked `(deleted)`.\n\n`lsof +L1` collects such files from the whole system: their link count (the NLINK column) is zero. The FD column gives the number and the mode: `3w` is descriptor 3, open for writing.\n\nThere are two ways to get the space back. Restart the process — it closes the file, and the kernel frees the blocks. Or truncate the file through the descriptor without touching the process: `: > /proc/812/fd/3`. The second way is for when the process must not stop.',
      ),
    },
    {
      id: 'grow',
      kind: 'text',
      step: 'explain',
      title: bi('Запас на будущее', 'Room for the future'),
      body: bi(
        'Раздел магазина — логический том LVM, а в группе `data` есть свободное место. [[linux.lv-extend|lvextend]] растит том: `lvextend -L 220M data/shop` или `-L +100M`. Но ext4 на томе об этом не знает: `df` покажет прежний размер, пока файловую систему не растянут — `resize2fs /dev/data/shop`. Ключ `-r` у `lvextend` делает оба шага сразу. ext4 растёт и смонтированной, так что приложение ничего не замечает. Уменьшать сложнее и опаснее: ext4 сжимается только отмонтированной, и том при этом сжимают последним.',
        'The shop’s partition is an LVM logical volume, and the group `data` has free space. [[linux.lv-extend|lvextend]] grows the volume: `lvextend -L 220M data/shop` or `-L +100M`. But the ext4 on the volume does not know about it: `df` shows the old size until the file system is stretched — `resize2fs /dev/data/shop`. The `-r` option of `lvextend` does both steps at once. ext4 grows while mounted, so the application notices nothing. Shrinking is harder and more dangerous: ext4 shrinks only when unmounted, and the volume is shrunk last.',
      ),
    },
    { id: 'lab', kind: 'widget', step: 'practice', widget: 'linux.lab', props: DISK_LAB },
    {
      id: 'exam-link',
      kind: 'callout',
      tone: 'note',
      step: 'exit',
      title: bi('Учебный экзамен в браузере', 'A learning exam in the browser'),
      body: bi(
        'Экзамен «Раздел заполнен» можно сдать и без своей машины: [его вариант во вкладке](#/lab/linux-disk) — тот же сюжет на Alpine Linux, с заданием cron и без подсказок.',
        'The exam “The partition is full” can be taken without a machine of your own too: [its variant in the tab](#/lab/linux-disk) — the same story on Alpine Linux, with a cron job and without hints.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.truncate-fd', 'linux.q.lvextend-r'] },
  ],
};

export const LESSONS_4: Lesson[] = [sshHops, webOpenrc, install, diskReal];
