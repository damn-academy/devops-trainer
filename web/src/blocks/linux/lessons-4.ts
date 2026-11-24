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
  title: bi('Как ходить по SSH между машинами через бастион, настраивать ~/.ssh/config, копировать файлы и строить туннели', 'How to go between machines over SSH through a bastion, set up ~/.ssh/config, copy files and build tunnels'),
  summary: bi(
    'В этом уроке вы работаете с тремя настоящими машинами: вашим ноутбуком, бастионом и сервером приложения, который стоит за бастионом. Вы разложите ключи, проверите сервер по его ключу хоста, запишете в `~/.ssh/config` переход через бастион, скопируете файлы и построите туннель к службе, которую снаружи не видно.',
    'In this lesson you work with three real machines: your laptop, a bastion and the application server behind the bastion. You lay out the keys, check the server by its host key, write a jump through the bastion into `~/.ssh/config`, copy files and build a tunnel to a service nobody outside can see.',
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
        'Вам выдали доступ с такой запиской: «Сервер приложения называется `app`, но снаружи туда не попасть, поэтому заходи через `bastion`. Панель заказов работает на самом `app`, и её порт наружу не открыт». Чтобы попадать на сервер одной командой `ssh app`, а панель открывать у себя в браузере, нужны три вещи, о которых первый урок про SSH не рассказывал, и этот урок их разбирает.',
        'You were given access with this note: “The application server is called `app`, but you cannot reach it from outside, so go through `bastion`. The orders panel runs on `app` itself, and its port is not open to the outside.” To reach the server with one command, `ssh app`, and open the panel in your browser, you need three things the first SSH lesson did not cover, and this lesson goes through them.',
      ),
    },
    {
      id: 'session',
      kind: 'text',
      step: 'explain',
      title: bi('Какие две проверки проходят при каждом входе', 'Which two checks every login goes through'),
      body: bi(
        'При входе по SSH проверяют обе стороны. Сначала сервер доказывает, что он тот самый сервер. У него есть собственная пара ключей, которая называется [[linux.host-key|ключом хоста]], и закрытой половиной этой пары он подписывает данные сеанса. Клиент сверяет открытую половину с записью в файле `~/.ssh/known_hosts`. Если записи нет, клиент показывает отпечаток ключа и спрашивает, доверять ли ему, а если запись другая, клиент отказывается подключаться совсем. Ответить «yes», не посмотрев на отпечаток, значит лишить первую проверку смысла, поэтому отпечаток сверяют с тем, который дал администратор.\n\nПотом вы доказываете, кто вы. При входе по ключу клиент предлагает серверу открытую половину вашего ключа, сервер ищет её в файле `authorized_keys`, и клиент подписывает данные этого сеанса закрытой половиной. По сети уходит подпись, а сам ключ не уходит никогда. С паролем всё иначе, потому что пароль уходит на сервер целиком, пусть и внутри шифрования. Поэтому на настоящих серверах вход по паролю выключают, а первый ключ относят на сервер один раз командой `ssh-copy-id`, которая спрашивает пароль и дописывает ключ в `authorized_keys` с правильными правами.',
        'An SSH login checks both sides. First the server proves it is the same server. It has its own key pair, called the [[linux.host-key|host key]], and signs the session’s data with the private half. The client compares the public half with the entry in `~/.ssh/known_hosts`. If there is no entry, the client shows the key’s fingerprint and asks whether to trust it, and if the entry differs, the client refuses to connect at all. Answering “yes” without looking at the fingerprint takes the point out of the first check, so the fingerprint is compared with the one the admin gave you.\n\nThen you prove who you are. With a key, the client offers the server the public half of your key, the server looks it up in `authorized_keys`, and the client signs this session’s data with the private half. A signature goes over the network, and the key itself never does. A password is different: it goes to the server whole, even if inside the encryption. That is why real servers switch password logins off, and the first key is taken to the server once with `ssh-copy-id`, which asks for the password and appends the key to `authorized_keys` with the right permissions.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как выглядит вход по SSH шаг за шагом', 'What an SSH login looks like step by step'),
      body: bi('Схема ниже показывает, что происходит между командой `ssh app` и приглашением оболочки на сервере. Слева находятся ваш ноутбук с клиентом ssh, файл known_hosts и ваш закрытый ключ, в середине бастион, через который можно пройти к серверу, а справа служба sshd на сервере `app`, её ключ хоста, файл authorized_keys пользователя `deploy` и оболочка, которую sshd запустит в конце. Под схемой счётчики показывают, сколько раз стороны обменялись сообщениями и уходил ли по сети ваш секрет.', 'The diagram below shows what happens between the command `ssh app` and the shell prompt on the server. On the left are your laptop with the ssh client, the known_hosts file and your private key, in the middle the bastion you can pass through to the server, and on the right sshd on the server `app`, its host key, the authorized_keys file of `deploy` and the shell sshd starts at the end. Under the diagram the counters show how many exchanges the sides made and whether your secret crossed the network.'),
    },
    { id: 'explain', kind: 'explainer', step: 'look', explainer: 'linux.ssh-session', howto: bi('А дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко рядом с подсвеченным блоком говорит, что он делает, а карточка на линии показывает, что уходит по сети: строку версии, ключ, подпись или пароль. Жёлтая рамка у known_hosts означает, что клиент спрашивает вас, доверять ли серверу, а красная рамка отмечает место, где вход остановился.\n\nКогда дойдёте до оболочки, выберите в группе «Как проверяют сервер» вариант со сменившимся ключом сервера, а потом в группе «Как проверяют вас» вход по паролю и сравните счётчик секрета. Напоследок включите в блоке «Сломать» поломку, при которой файл authorized_keys доступен на запись группе, и посмотрите, на каком шаге остановится вход.', 'Then go on with “Step forward” above the diagram. The callout next to the highlighted block says what it does, and the card on the line shows what goes over the network: a version line, a key, a signature or a password. A yellow outline on known_hosts means the client asks you whether to trust the server, and a red outline marks where the login stopped.\n\nOnce you reach the shell, choose a changed server key in “How the server is checked”, then a password login in “How you are checked”, and compare the secret counter. Finally, switch on the break in “Break it” where authorized_keys is writable by the group, and see at which step the login stops.'), caption: bi('Схема объясняет три сообщения, которые встречаются чаще всего. «REMOTE HOST IDENTIFICATION HAS CHANGED» означает, что ключ сервера не совпал с записью в known_hosts. «Permission denied (publickey)» означает, что sshd не принял ваш ключ, и настоящую причину отказа нужно искать в журнале сервера. «Connection timed out» означает, что до проверки ключей дело так и не дошло. Следующий раздел урока показывает, как записать переход через бастион в `~/.ssh/config`.', 'The diagram explains the three messages you meet most often. “REMOTE HOST IDENTIFICATION HAS CHANGED” means the server’s key did not match known_hosts, “Permission denied (publickey)” means sshd did not accept your key, and the real reason is in the server’s log, and “Connection timed out” means the keys were never checked. The next section of the lesson shows how to write the jump through the bastion into `~/.ssh/config`.') },
    {
      id: 'config',
      kind: 'text',
      step: 'explain',
      title: bi('Как ходить через бастион и что записывать в ~/.ssh/config', 'How to go through a bastion and what to write in ~/.ssh/config'),
      body: bi(
        'Серверы внутри сети обычно не принимают SSH-подключений извне. Снаружи видна одна машина, которую называют [[linux.bastion|бастионом]], и на остальные машины ходят через неё. Команда `ssh -J deploy@bastion deploy@app` сначала входит на бастион, а потом просит службу sshd бастиона открыть канал до `app`. Шифрование при этом сквозное: ключи сеанса с `app` знают только ваш клиент и сам `app`, а бастион передаёт байты, но прочитать их не может. Для этого бастиону нужно разрешение `AllowTcpForwarding`. В Alpine оно по умолчанию выключено, а в этой лаборатории администратор его уже включил.\n\nПечатать каждый раз адреса, имена пользователей и бастионы утомительно, поэтому всё это записывают в файл `~/.ssh/config`:\n\n```\nHost bastion\n    User deploy\n\nHost app\n    User deploy\n    ProxyJump bastion\n```\n\nИмена `bastion` и `app` машина уже знает из файла `/etc/hosts`. Если имя в строке `Host` служит только псевдонимом, настоящий адрес задают строкой `HostName 10.0.0.12`. Учтите, что тогда клиент ищет ключ хоста в known_hosts по этому адресу и при первом входе снова спросит про отпечаток. Теперь команды `ssh app`, `scp файл app:` и `ssh-copy-id app` сами подставляют нужного пользователя и путь. Что клиент понял из файла, показывает команда `ssh -G app`: она печатает итоговые значения всех настроек, в том числе `user` и `proxyjump`.',
        'Servers inside a network usually accept no SSH connections from outside. One machine is visible from outside, called the [[linux.bastion|bastion]], and the other machines are reached through it. `ssh -J deploy@bastion deploy@app` first logs in to the bastion, then asks the bastion’s sshd to open a channel to `app`. The encryption is end to end: only your client and `app` itself know the session keys with `app`, and the bastion passes the bytes but cannot read them. The bastion needs the `AllowTcpForwarding` permission for this. Alpine switches it off by default, and in this lab the admin has already switched it on.\n\nTyping addresses, user names and jumps every time is tiresome, so all of it goes into `~/.ssh/config`:\n\n```\nHost bastion\n    User deploy\n\nHost app\n    User deploy\n    ProxyJump bastion\n```\n\nThe machine already knows the names `bastion` and `app` from `/etc/hosts`. If the name in `Host` is only an alias, the real address goes into a `HostName 10.0.0.12` line. Note that the client then looks the host key up in known_hosts by that address and asks about the fingerprint again on the first login. Now `ssh app`, `scp file app:` and `ssh-copy-id app` fill in the right user and path by themselves. `ssh -G app` shows what the client made of the file: it prints the final values of all settings, `user` and `proxyjump` among them.',
      ),
    },
    {
      id: 'tunnel',
      kind: 'text',
      step: 'explain',
      title: bi('Как копировать файлы и строить туннели', 'How to copy files and build tunnels'),
      body: bi(
        'Команда `scp` копирует файлы по тому же каналу и понимает те же имена. Команда `scp ~/release-notes.txt app:` кладёт файл в домашний каталог на `app`, `scp app:/var/log/app.log .` забирает файл обратно, а флаг `-r` копирует каталог целиком.\n\nИногда вам нужна не оболочка, а служба на сервере, которая слушает только его собственный адрес `127.0.0.1`, например база данных или панель администратора. Снаружи до неё не добраться, и так и должно быть. [[linux.ssh-tunnel|Туннель SSH]] открывает к ней дорогу на время сеанса. Команда `ssh -L 8080:localhost:8080 app` начинает слушать порт 8080 на вашей машине, а всё, что туда пришло, sshd на `app` передаёт на адрес из правой части. Слово «localhost» здесь читается с точки зрения `app`. Флаг `-N` говорит не запускать оболочку, а `-f` — уйти в фон после входа. Когда сеанс закончится, дорога исчезнет, и ни одного правила межсетевого экрана никто при этом не менял.',
        '`scp` copies files over the same channel and understands the same names. `scp ~/release-notes.txt app:` puts the file into the home directory on `app`, `scp app:/var/log/app.log .` brings a file back, and `-r` copies a whole directory.\n\nSometimes you need not a shell but a service on the server that listens only on its own `127.0.0.1`, such as a database or an admin panel. Nobody outside can reach it, and that is how it should be. An [[linux.ssh-tunnel|SSH tunnel]] opens a way to it for the length of a session. `ssh -L 8080:localhost:8080 app` starts listening on 8080 on your machine, and sshd on `app` passes whatever arrives there to the address on the right. The word “localhost” is read from `app`’s point of view here. `-N` says not to start a shell, and `-f` to go to the background after logging in. When the session ends, the way disappears, and nobody changed a single firewall rule.',
      ),
    },
    { id: 'lab', kind: 'widget', step: 'practice', widget: 'linux.lab', props: SSH_LAB },
    {
      id: 'exam-link',
      kind: 'callout',
      tone: 'note',
      step: 'exit',
      title: bi('Как сдать учебный экзамен в браузере', 'How to take the learning exam in the browser'),
      body: bi(
        'Экзамен «Доступ для новой разработчицы» можно сдать и без своих машин. Для этого есть [его вариант на двух машинах во вкладке](#/lab/linux-access): сюжет в нём тот же, машины работают на Alpine Linux, а подсказок нет.',
        'The exam “Access for a new developer” can be taken without machines of your own too. There is [its variant on two machines in the tab](#/lab/linux-access): the story is the same, the machines run Alpine Linux, and there are no hints.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.hostkey-changed', 'linux.q.key-not-sent', 'linux.q.proxyjump', 'linux.q.tunnel-sides'] },
  ],
};

const webOpenrc: Lesson = {
  id: 'linux.web-openrc',
  block: 'linux',
  title: bi('Как отдать сайт соседней машине через nginx и управлять службами в OpenRC', 'How to serve a site to the neighbouring machine with nginx and manage services in OpenRC'),
  summary: bi(
    'Веб-сервер nginx отдаёт страницу магазина соседней машине. Службами на этом сервере управляет не systemd, а OpenRC, и в этом уроке вы научитесь запускать службу, включать её запуск при загрузке, писать свою службу и настраивать её перезапуск после сбоя.',
    'The nginx web server serves the shop’s page to the neighbouring machine. Services on this server are managed not by systemd but by OpenRC, and in this lesson you learn to start a service, enable it at boot, write your own service and set it up to restart after a failure.',
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
        'Страница магазина лежит на сервере, но соседняя машина её не видит, а после перезагрузки сервера сайт не запустится. В уроке о службах эту работу выполнял systemd, а на этом сервере systemd нет вовсе. Тем не менее всё делается теми же тремя шагами, и в этом уроке вы их пройдёте.',
        'The shop’s page is on the server, but the neighbouring machine does not see it, and after a server reboot the site will not start. In the lesson on services systemd did this work, and this server has no systemd at all. Still, it is done in the same three steps, and in this lesson you walk them.',
      ),
    },
    {
      id: 'openrc',
      kind: 'text',
      step: 'explain',
      title: bi('Чем OpenRC отличается от systemd', 'How OpenRC differs from systemd'),
      body: bi(
        'Машины этой лаборатории работают на Alpine Linux, маленьком дистрибутиве, на котором часто собирают образы и небольшие серверы. Службы в нём запускает [[linux.openrc|OpenRC]]. Задачи у OpenRC те же, что у systemd: запустить службу, включить её запуск при загрузке и показать её состояние. Отличаются только команды:\n\n- `rc-service nginx start` запускает службу сейчас, а `stop`, `restart`, `reload` и `status` работают так же, как у `systemctl`;\n- `rc-update add nginx default` включает запуск службы при загрузке, а `rc-update del` выключает его;\n- `rc-status` показывает, какие службы запущены, а какие завершились аварийно.\n\nВместо целей systemd у OpenRC есть [[linux.runlevel|уровни запуска]]. Уровни `sysinit` и `boot` запускают саму систему, а уровень `default` запускает обычные службы. Команда `rc-update add … default` соответствует `systemctl enable`: файл службы попадает в каталог `/etc/runlevels/default/`, но сейчас служба от этого не запускается. Журнала вроде journald здесь нет. Службы пишут в собственные файлы в `/var/log/`, а сообщения системы собирает служба syslog в файле `/var/log/messages`.\n\nНа Debian, Ubuntu и большинстве серверов, с которыми вы будете работать, стоит systemd. Поэтому уроки о systemd остаются в силе, а этот урок показывает, что при переходе на другую систему меняются команды, а смысл остаётся прежним.',
        'The machines of this lab run Alpine Linux, a small distribution often used to build images and small servers. Its services are started by [[linux.openrc|OpenRC]]. OpenRC has the same jobs as systemd: start a service, enable it at boot and show its state. Only the commands differ:\n\n- `rc-service nginx start` starts a service now, and `stop`, `restart`, `reload` and `status` work as with `systemctl`;\n- `rc-update add nginx default` enables the service at boot, and `rc-update del` disables it;\n- `rc-status` shows which services are running and which have crashed.\n\nInstead of systemd targets, OpenRC has [[linux.runlevel|runlevels]]. The `sysinit` and `boot` runlevels start the system itself, and `default` starts the ordinary services. `rc-update add … default` corresponds to `systemctl enable`: the service file goes into `/etc/runlevels/default/`, but the service does not start now because of it. There is no journal like journald here. Services write to their own files in `/var/log/`, and the syslog service collects the system’s messages in `/var/log/messages`.\n\nDebian, Ubuntu and most of the servers you will work with run systemd. So the lessons on systemd still hold, and this lesson shows that when you move to another system the commands change while the meaning stays the same.',
      ),
    },
    {
      id: 'nginx',
      kind: 'text',
      step: 'explain',
      title: bi('Как описать сайт в настройках nginx', 'How to describe a site in nginx settings'),
      body: bi(
        'Веб-сервер nginx читает файл `/etc/nginx/nginx.conf`, а тот подключает файлы сайтов из `/etc/nginx/http.d/*.conf`; в Debian они лежат в `/etc/nginx/sites-enabled/`. Каждый сайт описывается одним [[linux.server-block|блоком server]]:\n\n```\nserver {\n    listen 80;\n    server_name web;\n    root /srv/shop;\n    index index.html;\n}\n```\n\nСтрока `listen` задаёт порт, который слушает сайт, `server_name` задаёт имя сайта, а `root` задаёт каталог, из которого nginx отдаёт файлы: запрос `/about.html` превращается в файл `/srv/shop/about.html`. На одном порту может быть много блоков. nginx выбирает тот, чьё имя совпало с именем сайта в запросе, а если не совпало ни одно, выбирает блок с пометкой `default_server`. В Alpine пакет кладёт такой блок в файл `/etc/nginx/http.d/default.conf`, и этот блок на любой запрос отвечает ошибкой 404, поэтому первая встреча с ним обычно выглядит как «сайт не работает». Каждую правку проверяют командой `nginx -t`, которая читает все настройки целиком и называет строку с ошибкой. Применяют правку командой `reload`: nginx перечитывает настройки, не обрывая открытых подключений, а если в новых настройках ошибка, продолжает работать со старыми.\n\nПроверять сайт нужно не только с самого сервера, потому что `curl http://localhost/` на сервере ничего не говорит о том, видит ли сайт кто-то ещё. Поэтому в лаборатории есть вторая машина.',
        'nginx reads `/etc/nginx/nginx.conf`, which includes the site files from `/etc/nginx/http.d/*.conf`; on Debian they are in `/etc/nginx/sites-enabled/`. Each site is described by one [[linux.server-block|server block]]:\n\n```\nserver {\n    listen 80;\n    server_name web;\n    root /srv/shop;\n    index index.html;\n}\n```\n\n`listen` sets the port the site listens on, `server_name` the site’s name, and `root` the directory nginx serves files from: a request for `/about.html` becomes the file `/srv/shop/about.html`. One port can have many blocks. nginx picks the one whose name matches the site name in the request, and if none matches, it picks the block marked `default_server`. In Alpine the package puts such a block into `/etc/nginx/http.d/default.conf`, and that block answers every request with a 404, so the first meeting with it usually looks like “the site is down”. Every change is checked with `nginx -t`, which reads the whole configuration and names the line with the mistake. A change is applied with `reload`: nginx rereads the settings without dropping open connections, and if the new settings have a mistake, it keeps working with the old ones.\n\nCheck the site not only from the server itself, because `curl http://localhost/` on the server says nothing about whether anybody else can see the site. That is why the lab has a second machine.',
      ),
    },
    {
      id: 'script',
      kind: 'text',
      step: 'explain',
      title: bi('Как написать свою службу для OpenRC', 'How to write your own service for OpenRC'),
      body: bi(
        'Unit-файлу systemd в OpenRC соответствует скрипт в каталоге `/etc/init.d/`, первая строка которого выглядит как `#!/sbin/openrc-run`. Обычно в таком скрипте хватает нескольких переменных:\n\n```\n#!/sbin/openrc-run\ndescription="Nightly sales report"\ncommand=/usr/local/bin/report\ncommand_background=true\npidfile=/run/report.pid\n```\n\nСтрока `command_background=true` нужна программам, которые сами в фон не уходят: OpenRC запустит такую программу в фоне и запишет её номер в файл из строки `pidfile`. Сам скрипт должен быть исполняемым.\n\nВ таком виде OpenRC только запускает и останавливает программу. Если программа завершится аварийно, `rc-status` покажет `crashed`, и больше ничего не произойдёт. Перезапуском занимается отдельный надзирающий процесс, и включает его строка `supervisor=supervise-daemon`, которую пишут вместо `command_background` и `pidfile`. Тогда программа становится дочерним процессом `supervise-daemon`, и тот запускает её снова, как это делает `Restart=` в systemd. Переменные `respawn_delay` и `respawn_max` задают паузу перед перезапуском и предельное число попыток.',
        'In OpenRC, the counterpart of a systemd unit file is a script in `/etc/init.d/` whose first line reads `#!/sbin/openrc-run`. A few variables are usually enough in such a script:\n\n```\n#!/sbin/openrc-run\ndescription="Nightly sales report"\ncommand=/usr/local/bin/report\ncommand_background=true\npidfile=/run/report.pid\n```\n\n`command_background=true` is for programs that do not go to the background by themselves: OpenRC starts such a program in the background and writes its number into the file named in `pidfile`. The script itself must be executable.\n\nIn this form OpenRC only starts and stops the program. If the program crashes, `rc-status` shows `crashed`, and nothing more happens. A separate supervising process takes care of restarts, and the line `supervisor=supervise-daemon`, written instead of `command_background` and `pidfile`, switches it on. Then the program becomes a child of `supervise-daemon`, which starts it again, as `Restart=` does in systemd. `respawn_delay` and `respawn_max` set the pause before a restart and the limit of attempts.',
      ),
    },
    { id: 'lab', kind: 'widget', step: 'practice', widget: 'linux.lab', props: WEB_LAB },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.openrc-systemd', 'linux.q.respawn', 'linux.q.nginx-t'] },
  ],
};

const install: Lesson = {
  id: 'linux.install',
  block: 'linux',
  title: bi('Как установить систему на чистый диск', 'How to install a system onto a blank disk'),
  summary: bi(
    'У машины пустой диск и установочный носитель Alpine Linux. Вы разметите диск в формате GPT, настроите LVM, создадите файловые системы, установите пакеты, запишете fstab и загрузчик, а потом перезагрузите машину и проверите, загрузится ли она сама.',
    'The machine has a blank disk and Alpine Linux installer media. You partition the disk as GPT, set up LVM, create file systems, install the packages, write fstab and the boot loader, then reboot the machine and check whether it boots by itself.',
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
        'Облако выдаёт машину с уже установленной системой, и кажется, что так было всегда. Но кто-то разметил этот диск, выбрал, где будет корень, записал загрузчик и файл fstab. Когда сервер не загружается после замены диска или ошибки в fstab, чинить его приходится как раз на этом уровне, загрузившись с установочного носителя, и в этом уроке вы пройдёте этот путь сами.',
        'A cloud hands you a machine with a system already installed, and it seems it was always so. But somebody partitioned that disk, chose where the root goes, wrote the boot loader and fstab. When a server does not boot after a disk swap or a mistake in fstab, it has to be fixed exactly at this level, booted from installer media, and in this lesson you walk that way yourself.',
      ),
    },
    {
      id: 'layout',
      kind: 'text',
      step: 'explain',
      title: bi('Как разметить диск: GPT и LVM', 'How to lay out a disk: GPT and LVM'),
      body: bi(
        'Машина загрузилась с [[linux.installer|установочного носителя]], то есть с системы, которая работает в памяти и содержит репозиторий пакетов. Диск `/dev/sda` пуст, и сначала на нём нужна таблица разделов. Таблица [[linux.gpt|GPT]] считается современной: в ней может быть до 128 разделов, тип каждого раздела записан в виде GUID, а в конце диска хранится копия таблицы на случай порчи. Старая таблица MBR, у которой метка `dos`, знает только четыре раздела и диски до 2 ТиБ.\n\nПотом нужен раздел для загрузчика. Прошивка BIOS читает только первые 440 байт диска, и туда помещается лишь крошечная часть GRUB. На MBR остальная часть загрузчика лежит в промежутке перед первым разделом, а на GPT для неё делают отдельный раздел типа BIOS boot размером 1–2 МиБ без файловой системы. На машинах с UEFI вместо него нужен раздел EFI с файловой системой FAT, но у этой машины прошивка BIOS.\n\nКорневую файловую систему кладут не прямо на раздел, а в [[linux.lvm|LVM]]. Раздел становится физическим томом (команда `pvcreate`), физические тома собираются в группу (`vgcreate`), а из группы нарезаются логические тома (`lvcreate`). Логические тома можно увеличивать на ходу и переносить на другие диски, не трогая файловую систему, которая на них лежит. Каталог `/boot` оставляют обычным разделом, потому что так GRUB проще всего его найти.\n\n```\n/dev/sda1   2 MiB   BIOS boot\n/dev/sda2 200 MiB   ext4 → /boot\n/dev/sda3  остаток  LVM → vg0 → root (ext4 → /)\n```',
        'The machine has booted from [[linux.installer|installer media]], a system that runs in memory and carries a package repository with it. The disk `/dev/sda` is blank, and first it needs a partition table. A [[linux.gpt|GPT]] table is the modern one: it can hold up to 128 partitions, each partition’s type is written as a GUID, and a copy of the table is kept at the end of the disk in case of damage. The old MBR table, labelled `dos`, knows only four partitions and disks up to 2 TiB.\n\nNext comes a partition for the boot loader. A BIOS firmware reads only the first 440 bytes of the disk, and only a tiny part of GRUB fits there. On MBR the rest of the loader lives in the gap before the first partition, and on GPT it gets a partition of its own of type BIOS boot, 1–2 MiB, without a file system. Machines with UEFI need an EFI partition with a FAT file system instead, but this machine has a BIOS firmware.\n\nThe root file system goes not straight onto a partition but into [[linux.lvm|LVM]]. The partition becomes a physical volume (`pvcreate`), physical volumes join a group (`vgcreate`), and logical volumes are cut from the group (`lvcreate`). Logical volumes can be grown live and moved to other disks without touching the file system on them. `/boot` stays a plain partition, because that way GRUB finds it most easily.\n\n```\n/dev/sda1   2 MiB   BIOS boot\n/dev/sda2 200 MiB   ext4 → /boot\n/dev/sda3  the rest  LVM → vg0 → root (ext4 → /)\n```',
      ),
    },
    {
      id: 'boot',
      kind: 'text',
      step: 'explain',
      title: bi('Что машина прочитает при первой загрузке', 'What the machine will read at the first boot'),
      body: bi(
        'Установка записывает на диск то, что машина потом прочитает в обратном порядке. Прошивка читает сектор 0 и запускает записанное там начало GRUB, а оно достаёт основную часть загрузчика из раздела BIOS boot. Загрузчик читает меню `/boot/grub/grub.cfg` и загружает ядро вместе с [[linux.initramfs|initramfs]], маленькой системой, которая работает в памяти. Ядро само не умеет включать группы томов LVM, поэтому корневую файловую систему находит initramfs: она включает группу `vg0`, монтирует `/dev/vg0/root` и передаёт управление системе на этом томе. Дальше работает уже система с диска: OpenRC по очереди запускает службы каждого уровня запуска, а служба `localmount` монтирует всё, что записано в `/etc/fstab`.\n\nВ Alpine всю работу, от пакетов до загрузчика, выполняет команда `setup-disk`. Она ставит систему из репозитория носителя в смонтированный каталог `/mnt`, записывает fstab по тому, что смонтировано, собирает initramfs с поддержкой LVM и ставит загрузчик, причём переменная `BOOTLOADER=grub` выбирает GRUB. Всё это можно сделать и вручную командами `apk add --root /mnt` и `grub-install` с правкой fstab, но смысл шагов останется тем же.\n\nНа схеме первой загрузки встретятся ещё три обозначения. Один и тот же логический том система показывает под двумя именами, `/dev/vg0/root` и `/dev/mapper/vg0-root`, и ядру в строке параметров обычно передают второе. Initramfs передаёт управление системе на диске командой `switch_root`, которая делает корнем смонтированный том и освобождает память, занятую самой initramfs. А приглашение `login:` печатает маленькая программа getty, которую OpenRC запускает на каждой консоли машины.',
        'An install writes onto the disk what the machine will later read in reverse order. The firmware reads sector 0 and runs the start of GRUB written there, which fetches the loader’s main part from the BIOS boot partition. The loader reads the menu `/boot/grub/grub.cfg` and loads the kernel together with the [[linux.initramfs|initramfs]], a small system that runs in memory. The kernel cannot switch on LVM volume groups by itself, so the initramfs finds the root file system: it switches on `vg0`, mounts `/dev/vg0/root` and hands control to it. From there the system on the disk runs: OpenRC starts the services of each runlevel in turn, and the `localmount` service mounts everything listed in `/etc/fstab`.\n\nIn Alpine all the work, from the packages to the boot loader, is done by `setup-disk`. It installs the system from the media’s repository into the mounted `/mnt`, writes fstab from what is mounted, builds an initramfs with LVM support and installs the boot loader, with `BOOTLOADER=grub` picking GRUB. All of this can be done by hand with `apk add --root /mnt` and `grub-install` plus editing fstab, but the meaning of the steps stays the same.\n\nThe diagram of the first boot has three more names. The system shows one and the same logical volume under two names, `/dev/vg0/root` and `/dev/mapper/vg0-root`, and the kernel’s parameter line usually gets the second. The initramfs hands control to the system on the disk with `switch_root`, which makes the mounted volume the root and frees the memory taken by the initramfs itself. And the `login:` prompt is printed by a small program, getty, which OpenRC starts on every console of the machine.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как первая загрузка читает то, что записала установка', 'How the first boot reads what the install wrote'),
      body: bi('Схема ниже показывает первую загрузку машины после установки, уже без установочного носителя. В верхнем ряду слева направо стоят прошивка SeaBIOS, сектор 0 с крошечной частью GRUB, раздел BIOS boot с основной частью GRUB и раздел `/boot` с ядром и меню. Во втором ряду справа налево идут ядро, initramfs, тома LVM и корневая файловая система, а в третьем ряду OpenRC, файл fstab и приглашение войти. Каждая ступень читает то, что записала установка, и передаёт управление следующей. Под схемой счётчики показывают номер ступени и число чтений с диска.', 'The diagram below shows the machine’s first boot after the install, already without the installer media. In the top row, left to right, are the SeaBIOS firmware, sector 0 with a tiny part of GRUB, the BIOS boot partition with the main part of GRUB and the `/boot` partition with the kernel and the menu. The second row runs right to left through the kernel, the initramfs, the LVM volumes and the root file system, and the third row holds OpenRC, fstab and the login prompt. Each stage reads what the install wrote and hands control to the next. Under the diagram the counters show the stage number and the number of disk reads.'),
    },
    { id: 'explain', kind: 'explainer', step: 'look', explainer: 'linux.install', howto: bi('А дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко рядом с подсвеченной ступенью говорит, что она читает, а карточка на линии показывает, что она передаёт следующей. Новые ступени появляются тогда, когда до них доходит управление, зелёная рамка означает пройденную ступень, а красная отмечает место, где загрузка остановилась.\n\nКогда дойдёте до приглашения login:, выберите в группе «Как размечен диск» таблицу MBR и посмотрите, где окажется основная часть GRUB. Потом включите в блоке «Сломать» поломку, при которой загрузчик не записан на диск, и сравните, на какой ступени остановится машина и что она напишет.', 'Then go on with “Step forward” above the diagram. The callout next to the highlighted stage says what it reads, and the card on the line shows what it hands to the next one. New stages appear when control reaches them, a green outline means a stage is passed, and a red one marks where the boot stopped.\n\nOnce you reach the login: prompt, choose the MBR table in “How the disk is laid out” and see where the main part of GRUB ends up. Then switch on the break in “Break it” where the boot loader is not written to the disk, and compare at which stage the machine stops and what it prints.'), caption: bi('Сообщения, которые вы видели при поломках, понадобятся, если ваша установка не загрузится. «No bootable device» означает, что в секторе 0 нет загрузчика, аварийная оболочка initramfs означает, что не нашёлся корень, а ошибка службы localmount указывает на fstab. В лаборатории этого урока вы пройдёте установку сами, и если после перезагрузки машина остановится, вспомните, на какой ступени схемы это происходило.', 'The messages you saw in the breaks will help if your install does not boot. “No bootable device” means sector 0 holds no boot loader, the initramfs emergency shell means the root was not found, and a localmount error points at fstab. In this lesson’s lab you do the install yourself, and if the machine stops after the reboot, remember at which stage of the diagram that happened.') },
    {
      id: 'warn',
      kind: 'callout',
      tone: 'warn',
      step: 'try',
      title: bi('Эта установка настоящая', 'This install is real'),
      body: bi(
        'Здесь всё настоящее, только диск виртуальный и хранится во вкладке браузера. Команды `sfdisk` и `mkfs` стирают данные без вопросов, поэтому на своём компьютере перед ними трижды проверяют, какой диск выбран. Размеры и модели дисков показывает команда `lsblk`.',
        'Everything here is real, only the disk is virtual and is kept in the browser tab. `sfdisk` and `mkfs` wipe data without asking, so on your own computer you check three times which disk is chosen before running them. `lsblk` shows the sizes and models of the disks.',
      ),
    },
    { id: 'lab', kind: 'widget', step: 'practice', widget: 'linux.lab', props: INSTALL_LAB },
    {
      id: 'exam-link',
      kind: 'callout',
      tone: 'note',
      step: 'exit',
      title: bi('Как пройти эту установку экзаменом', 'How to take this install as an exam'),
      body: bi(
        'На экзамене вас ждёт та же машина, но без подсказок и с другим заданием: нужно поставить сервер базы данных с отдельным томом под журналы. Экзамен открывается по ссылке [учебный экзамен «Установка»](#/lab/linux-install).',
        'The exam gives you the same machine, but without hints and with another task: install a database server with a separate volume for logs. The exam opens from the link [the learning exam “Install”](#/lab/linux-install).',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.install-order', 'linux.q.bios-boot', 'linux.q.initramfs-lvm'] },
  ],
};

const diskReal: Lesson = {
  id: 'linux.disk-real',
  block: 'linux',
  title: bi('Как найти, кто держит удалённый файл, и увеличить том на ходу', 'How to find who holds a deleted file and grow a volume live'),
  summary: bi(
    'На настоящем ядре вы увидите, как расходятся `df` и `du`, потому что процесс держит открытым удалённый журнал. Вы найдёте этот процесс через `lsof` и `/proc`, вернёте место, не останавливая процесс, и дадите разделу запас, увеличив том LVM без отмонтирования.',
    'On a real kernel you see `df` and `du` disagree because a process holds a deleted log open. You find the process with `lsof` and `/proc`, get the space back without stopping the process, and give the partition room by growing the LVM volume without unmounting.',
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
        'В уроке о дисках была загадка: `df` говорит, что диск полон, а `du` насчитывает намного меньше. В симуляторе эта загадка оставалась рассказом. Здесь перед вами настоящий сервер магазина, на котором кто-то уже удалил разросшийся журнал командой `rm`, а место от этого не освободилось.',
        'The lesson on disks had a riddle: `df` says the disk is full, while `du` counts far less. In the simulator the riddle stayed a story. Here you have the shop’s real server, where somebody has already deleted an overgrown log with `rm`, and no space was freed by it.',
      ),
    },
    {
      id: 'fd',
      kind: 'text',
      step: 'explain',
      title: bi('Как процесс держит открытым файл, у которого нет имени', 'How a process keeps open a file that has no name'),
      body: bi(
        'Процесс работает с файлом через [[linux.fd|дескриптор файла]], то есть через номер в своей таблице открытых файлов. Номера 0, 1 и 2 заняты стандартными потоками, а дальше идёт всё, что процесс открыл сам. Ядро показывает эту таблицу в каталоге `/proc/<pid>/fd/`, где на каждый открытый файл приходится по ссылке. Команда `rm` убирает только имя файла. Если файл открыт, inode и данные сохраняются, а ссылка в `/proc/<pid>/fd/` показывает прежний путь с пометкой `(deleted)`.\n\nКоманда `lsof +L1` собирает такие файлы со всей системы, потому что у них число ссылок в колонке NLINK равно нулю. Колонка FD показывает номер дескриптора и режим, например `3w` означает дескриптор 3, открытый на запись.\n\nВернуть место можно двумя способами. Можно перезапустить процесс, и тогда он закроет файл, а ядро освободит блоки. А можно обрезать файл через дескриптор, не трогая процесс, командой `: > /proc/812/fd/3`. Второй способ годится тогда, когда процесс останавливать нельзя.',
        'A process works with a file through a [[linux.fd|file descriptor]], a number in its table of open files. Numbers 0, 1 and 2 are taken by the standard streams, and then comes whatever the process opened itself. The kernel shows this table in `/proc/<pid>/fd/`, with one link per open file. `rm` removes only the file’s name. If the file is open, the inode and the data are kept, and the link in `/proc/<pid>/fd/` shows the old path marked `(deleted)`.\n\n`lsof +L1` collects such files from the whole system, because their link count in the NLINK column is zero. The FD column shows the descriptor number and the mode; for example, `3w` means descriptor 3, open for writing.\n\nThere are two ways to get the space back. You can restart the process: it closes the file, and the kernel frees the blocks. Or you can truncate the file through the descriptor without touching the process, with `: > /proc/812/fd/3`. The second way is for when the process must not stop.',
      ),
    },
    {
      id: 'grow',
      kind: 'text',
      step: 'explain',
      title: bi('Как дать разделу запас на будущее', 'How to give a partition room for the future'),
      body: bi(
        'Раздел магазина лежит на логическом томе LVM, а в группе `data` есть свободное место. Команда [[linux.lv-extend|lvextend]] увеличивает том: `lvextend -L 220M data/shop` задаёт новый размер, а `-L +100M` добавляет 100 мебибайт. Но файловая система ext4 на томе об этом не знает, и `df` будет показывать прежний размер, пока файловую систему не растянут командой `resize2fs /dev/data/shop`. Флаг `-r` у команды `lvextend` делает оба шага сразу. Файловая система ext4 может расти и смонтированной, так что приложение ничего не замечает. Уменьшать том сложнее и опаснее: ext4 сжимается только отмонтированной, а сам том при этом уменьшают в последнюю очередь.',
        'The shop’s partition is on an LVM logical volume, and the group `data` has free space. [[linux.lv-extend|lvextend]] grows the volume: `lvextend -L 220M data/shop` sets a new size, and `-L +100M` adds 100 mebibytes. But the ext4 file system on the volume does not know about it, and `df` keeps showing the old size until the file system is stretched with `resize2fs /dev/data/shop`. The `-r` flag of `lvextend` does both steps at once. ext4 can grow while mounted, so the application notices nothing. Shrinking a volume is harder and more dangerous: ext4 shrinks only when unmounted, and the volume itself is shrunk last.',
      ),
    },
    { id: 'lab', kind: 'widget', step: 'practice', widget: 'linux.lab', props: DISK_LAB },
    {
      id: 'exam-link',
      kind: 'callout',
      tone: 'note',
      step: 'exit',
      title: bi('Как сдать учебный экзамен в браузере', 'How to take the learning exam in the browser'),
      body: bi(
        'Экзамен «Раздел заполнен» можно сдать и без своей машины. Для этого есть [его вариант во вкладке](#/lab/linux-disk): сюжет в нём тот же, машина работает на Alpine Linux, в него добавлено задание с cron, а подсказок нет.',
        'The exam “The partition is full” can be taken without a machine of your own too. There is [its variant in the tab](#/lab/linux-disk): the story is the same, the machine runs Alpine Linux, a cron task is added, and there are no hints.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', items: ['linux.q.truncate-fd', 'linux.q.lvextend-r'] },
  ],
};

export const LESSONS_4: Lesson[] = [sshHops, webOpenrc, install, diskReal];
