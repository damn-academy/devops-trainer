// The labs on real machines that the Linux lessons and the training pages
// mount with the `linux.lab` widget. Each lab is plain data: the machines and
// what is prepared on them, the probes, the goals judged by state. The
// reference solutions run on the real emulator in tests/linux-reallab-v86.test.ts.
//
// Setup commands run as root on the service channel; anything left running
// is started detached, `(setsid … &)`, so that it is the machine's process
// and not the trainer's (hidden service processes never show in `procs`).

import { bi } from '../../../core/i18n';
import type { Facts } from '../../../core/types';
import type { LabGoal, LabMachine, LabProbe, RealLabProps } from './spec';

const MiB = 1024;
const num = (f: Facts, id: string) => Number(String(((f.reach ?? {}) as Record<string, { out?: string }>)[id]?.out ?? '').trim()) || 0;
const out = (f: Facts, id: string) => String(((f.reach ?? {}) as Record<string, { out?: string }>)[id]?.out ?? '');
const ok = (f: Facts, id: string) => ((f.reach ?? {}) as Record<string, { exit?: number }>)[id]?.exit === 0;
const text = (f: Facts, p: string) => String((f.files[p] as { text?: string } | undefined)?.text ?? '');
const man = (name: string, sec: number | string) => ({ url: `https://man7.org/linux/man-pages/man${String(sec)[0]}/${name}.${sec}.html`, label: `${name}(${sec})` });
const obsd = (name: string, sec: number) => ({ url: `https://man.openbsd.org/${name}.${sec}`, label: `${name}(${sec})` });
const alpine = (path: string, label: string) => ({ url: `https://wiki.alpinelinux.org/wiki/${path}`, label });

/** A user that may log in with a key but has no usable password (`!` would lock it for sshd). */
const keyOnlyUser = (name: string, shell = '/bin/bash') => `adduser -D -s ${shell} ${name} && sed -i 's/^${name}:!:/${name}:*:/' /etc/shadow`;
const passwordUser = (name: string, pw: string) => `adduser -D -s /bin/bash ${name} && echo '${name}:${pw}' | chpasswd`;

// ── SSH between machines ────────────────────────────────────────────────────

/** Only the bastion may reach app's sshd: the first rule a learner meets on the way in. */
const APP_GUARD = "nft add table inet guard && nft add chain inet guard input '{ type filter hook input priority 0; policy accept; }' && nft add rule inet guard input tcp dport 22 ip saddr != 10.0.0.12 drop";

export const SSH_MACHINES: LabMachine[] = [
  { name: 'laptop', role: bi('ваш ноутбук', 'your laptop'), setup: ["printf 'Release 1.4.2: run the migrations first, then restart the app.\\n' > /root/release-notes.txt"] },
  {
    name: 'bastion',
    role: bi('бастион, единственный вход в сеть', 'the bastion, the only way into the network'),
    setup: [passwordUser('deploy', 'deploy-2026'), "printf 'AllowTcpForwarding yes\\n' > /etc/ssh/sshd_config.d/10-bastion.conf && rc-service sshd restart >/dev/null"],
  },
  {
    name: 'app',
    role: bi('сервер приложения', 'the application server'),
    setup: [
      passwordUser('deploy', 'deploy-2026'),
      "printf 'AllowTcpForwarding local\\n' > /etc/ssh/sshd_config.d/10-app.conf && rc-service sshd restart >/dev/null",
      "mkdir -p /srv/admin && echo '<h1>orders admin</h1>' > /srv/admin/index.html && printf 'server {\\n\\tlisten 127.0.0.1:8080;\\n\\troot /srv/admin;\\n}\\n' > /etc/nginx/http.d/admin.conf && rc-service nginx start >/dev/null",
      APP_GUARD,
    ],
  },
];

const SSH_PROBES: LabProbe[] = [
  { id: 'bastion', on: 'laptop', cmd: 'ssh -o BatchMode=yes -o ConnectTimeout=5 deploy@bastion hostname 2>&1' },
  { id: 'cfg', on: 'laptop', cmd: 'ssh -G app 2>&1' },
  { id: 'jump', on: 'laptop', cmd: 'ssh -o BatchMode=yes -o ConnectTimeout=8 -J deploy@bastion deploy@app hostname 2>&1' },
  { id: 'app', on: 'laptop', cmd: 'ssh -o BatchMode=yes -o ConnectTimeout=8 app hostname 2>&1' },
  { id: 'tunnel', on: 'laptop', cmd: 'curl -s -m 5 http://127.0.0.1:8080/ 2>&1' },
  // The copied file as `app` holds it, read from the laptop through the jump, so the goal stays on the machine where it is typed.
  { id: 'notes', on: 'laptop', cmd: 'ssh -o BatchMode=yes -o ConnectTimeout=8 app cat release-notes.txt 2>&1' },
];

export const SSH_TASKS: LabGoal[] = [
  {
    id: 'keygen',
    on: 'laptop',
    prompt: bi('Создайте на `laptop` пару ключей ed25519 в стандартном месте.', 'Create an ed25519 key pair on `laptop` in the standard place.'),
    check: { when: "files['/root/.ssh/id_ed25519'].mode='0600' && files['/root/.ssh/id_ed25519.pub'].type=f" },
    chips: 'ssh-keygen -t ed25519',
    docRef: obsd('ssh-keygen', 1),
    hints: { H1: bi('Вопрос о пароле на ключ здесь можно пропустить клавишей Enter. На учебной машине так делать допустимо, а на рабочем ноутбуке нельзя.', 'You may skip the passphrase question here with Enter. That is acceptable on a training machine, but not on a work laptop.') },
  },
  {
    id: 'bastion',
    on: 'laptop',
    prompt: bi(
      'Отнесите открытый ключ на `bastion` пользователю `deploy`, у которого пока есть пароль `deploy-2026`, и убедитесь, что `ssh deploy@bastion` пускает без пароля.',
      'Take the public key to `bastion` for the user `deploy`, who still has the password `deploy-2026`, and make sure `ssh deploy@bastion` lets you in without a password.',
    ),
    check: {
      when: "reach['bastion'].exit=0 && reach['bastion'].out~'bastion'",
      fail: [
        { if: "reach['bastion'].out~'Host key verification failed'", say: bi('Клиент ещё не знает ключ хоста `bastion`. Подключитесь один раз вручную и сверьте отпечаток, и после ответа «yes» он попадёт в `~/.ssh/known_hosts`.', 'The client does not know `bastion`’s host key yet. Connect once by hand and check the fingerprint, and after “yes” it goes into `~/.ssh/known_hosts`.') },
        { if: "reach['bastion'].out~'Permission denied'", say: bi('Сервер не принял ключ: либо открытого ключа нет в `~deploy/.ssh/authorized_keys` на `bastion`, либо у файла слишком открытые права.', 'The server did not accept the key: either the public key is not in `~deploy/.ssh/authorized_keys` on `bastion`, or the file’s permissions are too open.') },
      ],
    },
    chips: 'ssh-copy-id deploy@bastion',
    docRef: obsd('ssh-copy-id', 1),
    hints: {
      H1: bi('Команда `ssh-copy-id` спросит пароль один раз и допишет ключ в `authorized_keys` с правильными правами.', '`ssh-copy-id` asks for the password once and appends the key to `authorized_keys` with the right permissions.'),
      H2: bi('Чтобы проверить результат, выполните `ssh deploy@bastion hostname`, и команда должна напечатать `bastion`, ничего не спросив.', 'To check the result, run `ssh deploy@bastion hostname`, which must print `bastion` without asking anything.'),
    },
  },
  {
    id: 'jump',
    on: 'laptop',
    prompt: bi(
      'Напрямую `app` вас не пустит, потому что его sshd принимает подключения только с `bastion`. Положите свой ключ и на `app` для того же пользователя с тем же паролем, заходя туда через бастион.',
      '`app` will not let you in directly, because its sshd accepts connections only from `bastion`. Put your key on `app` too, for the same user with the same password, going there through the bastion.',
    ),
    check: {
      when: "reach['jump'].exit=0 && reach['jump'].out~'app'",
      fail: [{ if: "reach['jump'].out~'Permission denied'", say: bi('Бастион вас пропустил, а `app` не принял ключ, потому что в `~deploy/.ssh/authorized_keys` на `app` его ещё нет.', 'The bastion let you through, but `app` did not accept the key, because it is not yet in `~deploy/.ssh/authorized_keys` on `app`.') }, { if: "reach['jump'].out~'timed out'", say: bi('Подключение к `app` зависло, потому что напрямую туда не пройти. Подключаться к `app` нужно через бастион, с флагом `-J`.', 'The connection to `app` hung, because you cannot get there directly. You need a jump through the bastion with `-J`.') }],
    },
    chips: 'ssh-copy-id -o ProxyJump=deploy@bastion deploy@app',
    docRef: { ...obsd('ssh', 1), label: 'ssh(1) · -J' },
    hints: {
      H1: bi('Флаг `-J deploy@bastion` у `ssh` и `-o ProxyJump=deploy@bastion` у `ssh-copy-id` означают одно и то же: сначала войти на бастион, а оттуда открыть путь дальше.', '`-J deploy@bastion` for `ssh` and `-o ProxyJump=deploy@bastion` for `ssh-copy-id` mean the same thing: first log in to the bastion, then open the way on from there.'),
      H2: bi('Для проверки выполните `ssh -J deploy@bastion deploy@app hostname`, и команда должна напечатать `app`, ничего не спросив. Ключ хоста `app` клиент тоже запомнит при первом входе через бастион.', 'To check, run `ssh -J deploy@bastion deploy@app hostname`, which must print `app` without asking anything. The client also remembers `app`’s host key on the first jump.'),
    },
  },
  {
    id: 'config',
    on: 'laptop',
    prompt: bi(
      'Опишите обе машины в `~/.ssh/config` так, чтобы короткая команда `ssh app` сама входила на `app` пользователем `deploy` через бастион.',
      'Describe both machines in `~/.ssh/config` so that the short command `ssh app` logs in to `app` as `deploy` through the bastion by itself.',
    ),
    check: {
      when: "reach['cfg'].out~'proxyjump' && reach['cfg'].out~'user deploy' && reach['app'].exit=0",
      fail: [
        { if: "reach['cfg'].out~'proxyjump' && reach['app'].exit!=0", say: bi('Переход через бастион описан, но вход на `app` не проходит. Посмотрите вывод `ssh -v app` и выясните, на каком шаге отказ, у бастиона или у `app`.', 'The way through the bastion is described, but the login to `app` fails. Look at `ssh -v app` and find at which step the refusal comes, at the bastion or at `app`.') },
        { if: "reach['cfg'].out~'user root'", say: bi('Без строки `User` клиент входит под вашим местным именем, а здесь это root. Укажите `User deploy`.', 'Without `User` the client logs in under your local name, which is root here. Add `User deploy`.') },
      ],
    },
    docRef: obsd('ssh_config', 5),
    hints: {
      H1: bi('Нужны блок `Host bastion` со строкой `User deploy` и блок `Host app` со строками `User deploy` и `ProxyJump bastion`. Адреса указывать не нужно, потому что имена машин уже записаны в `/etc/hosts`.', 'You need a `Host bastion` block with `User deploy` and a `Host app` block with `User deploy` and `ProxyJump bastion`. No addresses are needed, because the machine names are already in `/etc/hosts`.'),
      H2: bi('Что клиент понял из файла, показывает команда `ssh -G app`, в выводе которой видны итоговые значения `user` и `proxyjump`.', '`ssh -G app` shows what the client made of the file, with the final values of `user` and `proxyjump` in its output.'),
    },
  },
  {
    id: 'scp',
    on: 'laptop',
    prompt: bi('Скопируйте файл `~/release-notes.txt` с `laptop` в домашний каталог пользователя `deploy` на `app`. Команду набирают на `laptop`, а проверка заглянет в домашний каталог `deploy` на `app`.', 'Copy `~/release-notes.txt` from `laptop` into the home directory of `deploy` on `app`. The command is typed on `laptop`, and the check looks into the home directory of `deploy` on `app`.'),
    check: {
      when: "reach['notes'].out~'Release 1.4.2'",
      fail: [{ if: "reach['notes'].out~'No such file'", say: bi('На `app` в домашнем каталоге `deploy` файла `release-notes.txt` пока нет. Скопируйте его командой `scp` на `laptop`, а путь на `app` укажите после двоеточия.', 'There is no `release-notes.txt` in the home directory of `deploy` on `app` yet. Copy it with `scp` on `laptop`, and give the path on `app` after the colon.') }],
    },
    chips: 'scp ~/release-notes.txt app:',
    docRef: obsd('scp', 1),
    hints: { H1: bi('Команда `scp` понимает имена из `~/.ssh/config`. Путь на удалённой машине пишется после двоеточия, а пустой путь означает домашний каталог.', '`scp` understands the names from `~/.ssh/config`. The path on the remote machine goes after a colon, and an empty path means the home directory.') },
  },
  {
    id: 'tunnel',
    on: 'laptop',
    prompt: bi(
      'На `app` работает панель заказов, но она слушает только адрес `127.0.0.1:8080`, и снаружи её не видно. Запустите в фоне туннель SSH так, чтобы на `laptop` панель открывалась по адресу `http://127.0.0.1:8080/`.',
      '`app` runs an orders panel, but it listens only on `127.0.0.1:8080`, and it is not visible from outside. Start an SSH tunnel in the background so that the panel opens on `laptop` at `http://127.0.0.1:8080/`.',
    ),
    check: {
      when: "reach['tunnel'].out~'orders admin'",
      fail: [
        { if: "reach['tunnel'].out~'refused' || reach['tunnel'].out~'onnect to'", say: bi('Проверка открыла на `laptop` адрес `http://127.0.0.1:8080/`, но порт 8080 никто не слушает. Туннель не запущен или уже завершился: запустите его снова и посмотрите командой `ss -ltn`, появился ли порт 8080.', 'The check opened `http://127.0.0.1:8080/` on `laptop`, but nobody listens on port 8080. The tunnel is not running or has ended: start it again and see with `ss -ltn` whether port 8080 appears.') },
        { if: "!(reach['tunnel'].out~'orders admin')", say: bi('Проверка открыла на `laptop` адрес `http://127.0.0.1:8080/` и не получила страницу панели. Справа от `-L` стоит адрес с точки зрения `app`, а там панель работает на `localhost:8080`.', 'The check opened `http://127.0.0.1:8080/` on `laptop` and did not get the panel’s page. To the right of `-L` stands an address as `app` sees it, and there the panel runs on `localhost:8080`.') },
      ],
    },
    chips: 'ssh -f -N -L 8080:localhost:8080 app',
    docRef: { ...obsd('ssh', 1), label: 'ssh(1) · -L' },
    hints: {
      H1: bi('В записи `-L 8080:localhost:8080` первое число задаёт порт, который туннель слушает на вашей машине, а остальная часть говорит, куда сервер передаёт подключения от своего имени. Флаг `-N` говорит не запускать оболочку, а `-f` — уйти в фон.', 'In `-L 8080:localhost:8080` the first number is the port the tunnel listens on at your machine, and the rest says where the server passes the connections on its own behalf. `-N` says not to start a shell, and `-f` to go to the background.'),
      H2: bi('Для проверки выполните `curl -s http://127.0.0.1:8080/` на `laptop`.', 'To check, run `curl -s http://127.0.0.1:8080/` on `laptop`.'),
    },
  },
  {
    id: 'mux',
    on: 'laptop',
    beyond: true,
    docStep: 4,
    prompt: bi(
      'Каждая команда `ssh app` заново проходит через бастион и тратит на это секунды. Сделайте так, чтобы все сеансы к `app` шли через одно открытое подключение и чтобы это подключение сохранялось ещё несколько минут после выхода. В уроке об этом не рассказывалось, поэтому поищите способ на странице `ssh_config(5)`. В Alpine этой страницы на машине нет, поэтому откройте её по ссылке под заданием.',
      'Every `ssh app` goes through the bastion anew and spends seconds on it. Make all sessions to `app` go through one open connection and keep that connection for a few more minutes after you leave. The lesson did not cover this, so look for the way on the page `ssh_config(5)`. Alpine does not keep that page on the machine, so open it from the link under the task.',
    ),
    check: { when: (f) => /^controlmaster (auto|yes)/m.test(out(f, 'cfg')) && /^controlpath \S+/m.test(out(f, 'cfg')) && !/^controlpersist (no|0)$/m.test(out(f, 'cfg')) && /^controlpersist /m.test(out(f, 'cfg')) },
    docRef: obsd('ssh_config', 5),
    hints: { H1: bi('Вам нужны три настройки, имена которых начинаются одинаково.', 'You need three settings whose names start the same way.') },
    solutionTokens: ['ControlMaster', 'ControlPath', 'ControlPersist'],
  },
];

export const SSH_LAB: RealLabProps = {
  machines: SSH_MACHINES,
  probes: SSH_PROBES,
  tasks: SSH_TASKS,
  watch: { mux: ['probe:cfg'] },
  intro: bi(
    '### Три машины лаборатории\n\nМашина `laptop` (10.0.0.11) служит вашим ноутбуком, и вы на ней работаете как root. Машина `bastion` (10.0.0.12) единственная видна снаружи. Машина `app` (10.0.0.13) служит сервером приложения, и к её sshd пускают только с бастиона. На всех трёх машинах работает настоящий Alpine Linux с OpenSSH. Вкладки над терминалом переключают машины, но работаете вы с `laptop`, как и в жизни.\n\nПри первом подключении клиент покажет отпечаток ключа сервера и спросит, доверять ли ему. В жизни отпечаток присылает администратор, а здесь вы можете узнать его сами: откройте вкладку нужной машины и выполните там `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`. Администратор получает отпечаток для коллег той же командой.',
    '### The three machines of the lab\n\n`laptop` (10.0.0.11) is your laptop, and you work on it as root. `bastion` (10.0.0.12) is the only machine visible from outside. `app` (10.0.0.13) is the application server, and its sshd lets in only connections from the bastion. All three run real Alpine Linux with OpenSSH. The tabs above the terminal switch machines, but you work on `laptop`, as in real life.\n\nOn the first connection the client shows the fingerprint of the server’s key and asks whether to trust it. In real life the admin sends you the fingerprint, and here you can find it yourself: open the tab of the machine and run `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` there. The admin gets the fingerprint for colleagues with the same command.',
  ),
};

// ── nginx for the neighbour and services on OpenRC ─────────────────────────

const REPORT = "printf '#!/bin/sh\\n# the nightly sales report (a lab program)\\nwhile true; do echo \"$(date) report: tick\" >> /var/log/report.log; sleep 10; done\\n' > /usr/local/bin/report && chmod 755 /usr/local/bin/report";
const REPORT_PROC = "pgrep -f '^/bin/sh /usr/local/bin/report'";

export const WEB_MACHINES: LabMachine[] = [
  { name: 'web', role: bi('сервер магазина', 'the shop’s server'), setup: ["mkdir -p /srv/shop && printf '<h1>The shop is open</h1>\\n' > /srv/shop/index.html", REPORT] },
  { name: 'client', role: bi('соседняя машина', 'the neighbouring machine') },
];

const WEB_PROBES: LabProbe[] = [
  // The pid file path is given so that the test also works before the first start (the init script creates /run/nginx).
  { id: 'nginx-t', on: 'web', cmd: "nginx -t -g 'pid /tmp/.dt-nginx-test.pid;' 2>&1" },
  { id: 'page', on: 'client', cmd: 'curl -s -m 5 http://web/ 2>&1' },
  { id: 'health', on: 'client', cmd: 'curl -s -m 5 -w " %{http_code}" http://web/health 2>&1' },
  { id: 'report', on: 'web', cmd: REPORT_PROC },
  // Only once the script asks for a supervisor: kill the program and see whether it comes back.
  { id: 'respawn', on: 'web', cmd: `grep -q supervise-daemon /etc/init.d/report 2>/dev/null && p=$(${REPORT_PROC} | head -1) && [ -n "$p" ] && kill -9 $p && sleep 4 && n=$(${REPORT_PROC} | head -1) && [ -n "$n" ] && [ "$n" != "$p" ]` },
];

export const WEB_TASKS: LabGoal[] = [
  {
    id: 'server',
    on: 'web',
    prompt: bi(
      'Опишите на машине `web` сайт магазина. Для этого создайте файл `/etc/nginx/http.d/shop.conf` с блоком `server`, который слушает порт 80 и отдаёт файлы из `/srv/shop`. Команда `nginx -t` должна сообщить, что настройки в порядке. Пока nginx ни разу не запускался, она дописывает в конце жалобу на файл `/run/nginx/nginx.pid` и слова `test failed`, потому что каталог `/run/nginx` создаёт скрипт службы при первом запуске. Ваши настройки при этом в порядке, если выше стоит строка `syntax is ok`, и проверка задания смотрит на неё.',
      'Describe the shop’s site on `web`. To do so, create `/etc/nginx/http.d/shop.conf` with a `server` block that listens on 80 and serves files from `/srv/shop`. `nginx -t` must report that the settings are fine. Until nginx has started once, it adds a complaint about `/run/nginx/nginx.pid` and the words `test failed` at the end, because the service script creates `/run/nginx` on the first start. Your settings are still fine if the line `syntax is ok` stands above, and the task’s check looks at exactly that.',
    ),
    check: {
      when: "files['/etc/nginx/http.d/shop.conf'].text~'/srv/shop' && reach['nginx-t'].exit=0",
      fail: [{ if: "files['/etc/nginx/http.d/shop.conf'].exists=true && reach['nginx-t'].exit!=0", say: bi('Команда `nginx -t` нашла ошибку и назвала строку, а чаще всего это пропущенный знак `;` или `}`.', '`nginx -t` found a mistake and named the line, and most often it is a missing `;` or `}`.') }],
    },
    docRef: { url: 'https://nginx.org/en/docs/http/ngx_http_core_module.html#server', label: 'nginx · server' },
    hints: {
      H1: bi('Внутри `server { … }` должны стоять строки `listen 80;`, `server_name web;`, `root /srv/shop;` и `index index.html;`.', 'Inside `server { … }` there must be the lines `listen 80;`, `server_name web;`, `root /srv/shop;` and `index index.html;`.'),
      H2: bi("Можно поступить так: `printf 'server {\\n listen 80;\\n server_name web;\\n root /srv/shop;\\n index index.html;\\n}\\n' > /etc/nginx/http.d/shop.conf`, а затем `nginx -t`. Если до первого запуска nginx жалуется на `/run/nginx/nginx.pid`, это не ваша ошибка: этот каталог создаёт скрипт службы при запуске, а синтаксис уже подтверждён строкой `syntax is ok`.", "You can do it like this: `printf 'server {\\n listen 80;\\n server_name web;\\n root /srv/shop;\\n index index.html;\\n}\\n' > /etc/nginx/http.d/shop.conf`, then `nginx -t`. If before the first start nginx complains about `/run/nginx/nginx.pid`, that is not your mistake: the service script creates that directory at start, and the syntax is already confirmed by `syntax is ok`."),
    },
  },
  {
    id: 'start',
    on: 'web',
    prompt: bi('Запустите nginx сейчас и включите его в уровень запуска `default`, чтобы он запускался после перезагрузки.', 'Start nginx now and add it to the `default` runlevel so that it starts after a reboot.'),
    check: {
      when: "svc[name=nginx].state=started && svc[name=nginx].runlevels has default && listen[port=80].proc=nginx",
      fail: [
        { if: 'svc[name=nginx].state=started', say: bi('Сейчас nginx работает, но после перезагрузки он не запустится, потому что в уровне `default` его нет. Добавляет службу в уровень команда `rc-update`.', 'nginx runs now, but it will not start after a reboot, because it is not in the `default` runlevel. `rc-update` adds a service to a runlevel.') },
        { if: 'svc[name=nginx].runlevels has default', say: bi('Служба включена на будущее, но сейчас не запущена, потому что `rc-update` не запускает службу, а запускает её `rc-service`.', 'The service is enabled for the future but not running now, because `rc-update` does not start a service; `rc-service` does.') },
      ],
    },
    chips: 'rc-service nginx start && rc-update add nginx default',
    docRef: alpine('OpenRC', 'Alpine Wiki · OpenRC'),
    hints: { H1: bi('Как `systemctl start` и `systemctl enable`, это две отдельные команды: `rc-service … start` и `rc-update add … default`.', 'Like `systemctl start` and `systemctl enable`, these are two separate commands: `rc-service … start` and `rc-update add … default`.') },
  },
  {
    id: 'neighbour',
    on: 'client',
    prompt: bi('Убедитесь с машины `client`, что сайт открывается по имени, то есть что `curl http://web/` возвращает страницу магазина.', 'Make sure from `client` that the site opens by name, that is, that `curl http://web/` returns the shop’s page.'),
    check: {
      when: "reach['page'].out~'The shop is open'",
      fail: [{ if: "reach['page'].out~'404'", say: bi('Отвечает не ваш сайт, а блок из файла `default.conf`, который поставил пакет. Этот блок помечен `default_server` и на любой запрос отвечает 404. nginx выбирает блок по имени сайта из запроса, поэтому задайте своему блоку `server_name web;` или уберите `default.conf`.', 'It is not your site answering but the block from `default.conf` the package installed. That block is marked `default_server` and answers every request with 404. nginx picks a block by the site name in the request, so give your block `server_name web;` or remove `default.conf`.') }],
    },
    chips: 'curl -s http://web/',
    hints: {
      H1: bi('Переключитесь на вкладку `client`, потому что проверять нужно с соседней машины, как это делает настоящий посетитель.', 'Switch to the `client` tab, because the check must come from the neighbouring machine, as a real visitor’s would.'),
      H2: bi('Если пришёл ответ 404, посмотрите `ls /etc/nginx/http.d/`. Блоков `server` там два, и на порту 80 первым отвечает тот, что помечен `default_server`.', 'If the answer is 404, look at `ls /etc/nginx/http.d/`. There are two `server` blocks, and on 80 the one marked `default_server` answers first.'),
    },
  },
  {
    id: 'service',
    on: 'web',
    prompt: bi(
      'Программа `/usr/local/bin/report` должна работать как служба OpenRC `report`. Напишите скрипт `/etc/init.d/report`, запустите службу и включите её в уровень `default`.',
      'The program `/usr/local/bin/report` must run as the OpenRC service `report`. Write `/etc/init.d/report`, start the service and add it to the `default` runlevel.',
    ),
    check: {
      when: "svc[name=report].state=started && svc[name=report].runlevels has default && reach['report'].exit=0",
      fail: [
        { if: (f) => { const m = (f.files['/etc/init.d/report'] as { exists?: boolean; mode?: string } | undefined); return !!m?.exists && !!m.mode && !(Number(m.mode.slice(-3, -2)) & 1); }, say: bi('Скрипт службы должен быть исполняемым, поэтому выполните `chmod +x /etc/init.d/report`.', 'The service script must be executable, so run `chmod +x /etc/init.d/report`.') },
        { if: "svc[name=report].state=started && reach['report'].exit!=0", say: bi('OpenRC считает службу запущенной, а программы нет. Без строки `command_background=true` OpenRC ждёт, что программа уйдёт в фон сама, а эта программа так не умеет.', 'OpenRC thinks the service is running, but the program is not. Without `command_background=true` OpenRC expects the program to go to the background by itself, and this one cannot.') },
      ],
    },
    docRef: { url: 'https://github.com/OpenRC/openrc/blob/master/service-script-guide.md', label: 'OpenRC service script guide' },
    hints: {
      H1: bi('Первая строка скрипта выглядит как `#!/sbin/openrc-run`, а за ней идут `command=/usr/local/bin/report`, `command_background=true` и `pidfile=/run/report.pid`.', 'The script’s first line reads `#!/sbin/openrc-run`, followed by `command=/usr/local/bin/report`, `command_background=true` and `pidfile=/run/report.pid`.'),
      H2: bi('Не забудьте выполнить `chmod +x`, а затем `rc-service report start` и `rc-update add report default`.', 'Do not forget `chmod +x`, then `rc-service report start` and `rc-update add report default`.'),
    },
  },
  {
    id: 'respawn',
    on: 'web',
    prompt: bi(
      'Отчёт иногда завершается с ошибкой ночью. Сделайте так, чтобы OpenRC сам запускал его снова. Проверка завершит программу командой `kill -9` и подождёт несколько секунд.',
      'The report sometimes fails at night. Make OpenRC start it again by itself. The check ends the program with `kill -9` and waits a few seconds.',
    ),
    check: {
      when: "reach['respawn'].exit=0",
      fail: [{ if: "files['/etc/init.d/report'].text~'supervise-daemon' && reach['respawn'].exit!=0", say: bi('Надзирающий процесс указан, но после `kill -9` программа не вернулась. Проверьте, перезапустили ли вы службу после правки скрипта командой `rc-service report restart`.', 'The supervising process is set, but the program did not come back after `kill -9`. Check whether you restarted the service after editing the script with `rc-service report restart`.') }],
    },
    docRef: { url: 'https://github.com/OpenRC/openrc/blob/master/supervise-daemon-guide.md', label: 'supervise-daemon guide' },
    hints: {
      H1: bi('Строка `supervisor=supervise-daemon` в скрипте службы соответствует `Restart=` в systemd, и строки `command_background` и `pidfile` с ней не нужны.', '`supervisor=supervise-daemon` in the service script corresponds to `Restart=` in systemd, and `command_background` and `pidfile` are not needed with it.'),
      H2: bi('После правки выполните `rc-service report restart`, иначе служба продолжит работать по-старому.', 'After the edit run `rc-service report restart`, otherwise the service keeps running the old way.'),
    },
  },
  {
    id: 'health',
    on: 'client',
    beyond: true,
    docStep: 4,
    prompt: bi(
      'Мониторингу нужен адрес `http://web/health`, который отвечает кодом 200 и словом `ok`, причём без файла на диске. В уроке об этом не рассказывалось, поэтому поищите способ в документации модуля rewrite в nginx.',
      'Monitoring needs the address `http://web/health`, which answers with code 200 and the word `ok`, without a file on disk. The lesson did not cover this, so look in the documentation of nginx’s rewrite module.',
    ),
    check: { when: "reach['health'].out=~'^ok 200$'" },
    docRef: { url: 'https://nginx.org/en/docs/http/ngx_http_rewrite_module.html#return', label: 'nginx · rewrite' },
    hints: { H1: bi('Вам нужен отдельный блок `location` для одного точного пути.', 'You need a separate `location` block for one exact path.') },
    solutionTokens: ['return 200', 'location = /health'],
  },
];

export const WEB_LAB: RealLabProps = {
  machines: WEB_MACHINES,
  probes: WEB_PROBES,
  tasks: WEB_TASKS,
  watch: { respawn: ['probe:report'] },
  intro: bi(
    '### Две машины лаборатории\n\nМашина `web` (10.0.0.11) станет сервером магазина, а машина `client` (10.0.0.12) будет его посетителем. На `web` уже есть страница `/srv/shop/index.html` и программа отчёта. Это Alpine Linux, поэтому службами здесь управляет OpenRC командами `rc-service`, `rc-update` и `rc-status`.',
    '### The two machines of the lab\n\n`web` (10.0.0.11) will become the shop’s server, and `client` (10.0.0.12) will be its visitor. `web` already has the page `/srv/shop/index.html` and the report program. This is Alpine Linux, so OpenRC manages the services here with `rc-service`, `rc-update` and `rc-status`.',
  ),
};

// ── Installing Alpine onto a blank disk ─────────────────────────────────────

/**
 * The live system logs in through a trainer program the installed system does
 * not have; setup-disk copies /etc/inittab, so the installed system gets the
 * ordinary getty and a `login:` prompt instead. The running session is not
 * affected: init read the file at boot.
 */
export const INSTALLER_GETTY = "sed -i 's#^ttyS0::.*#ttyS0::respawn:/sbin/getty -L 0 ttyS0 vt100#' /etc/inittab";

const INSTALL_MACHINE: LabMachine = { name: 'new', role: bi('пустая машина с установочным носителем', 'a blank machine with installer media'), profile: 'lab-installer', disks: [{ sizeMB: 2048 }], setup: [INSTALLER_GETTY] };

type Blk = { name: string; type: string; size: number; fstype?: string; uuid?: string; parttype?: string };
const blk = (f: Facts) => (f.blk ?? []) as Blk[];
const part = (f: Facts, n: string) => blk(f).find((b) => b.name === n);
const consoleText = (f: Facts) => String((f.console as { text?: string } | undefined)?.text ?? '');

export const INSTALL_TASKS: LabGoal[] = [
  {
    id: 'gpt',
    prompt: bi(
      'Разметьте диск `/dev/sda` в формате GPT на три раздела: 2 МиБ для загрузчика с типом BIOS boot, 200 МиБ под `/boot` с типом Linux filesystem и всё остальное под LVM с типом Linux LVM.',
      'Partition `/dev/sda` as GPT into three partitions: 2 MiB for the boot loader with type BIOS boot, 200 MiB for `/boot` with type Linux filesystem, and the rest for LVM with type Linux LVM.',
    ),
    check: {
      when: "blk[name=sda1].parttype='BIOS boot' && blk[name=sda2].parttype='Linux filesystem' && blk[name=sda3].parttype='Linux LVM'",
      fail: [{ if: "blk[name=sda1].parttype='Linux filesystem'", say: bi('Первый раздел получил тип по умолчанию, а для GRUB на диске GPT нужен маленький раздел типа BIOS boot, куда ляжет вторая часть загрузчика.', 'The first partition got the default type, while GRUB on a GPT disk needs a small BIOS boot partition for the second part of the loader.') }],
    },
    chips: "printf 'label: gpt\\n,2M,21686148-6449-6E6F-744E-656564454649\\n,200M,L\\n,,V\\n' | sfdisk /dev/sda",
    docRef: man('sfdisk', 8),
    hints: {
      H1: bi('Команда `sfdisk` читает разметку со стандартного ввода: сначала строку `label: gpt`, а затем по строке на каждый раздел с началом, размером и типом.', '`sfdisk` reads the layout from standard input: first the line `label: gpt`, then one line per partition with the start, size and type.'),
      H2: bi('У типов есть короткие имена: `L` означает Linux filesystem, а `V` означает Linux LVM. У типа BIOS boot короткого имени нет, и его задают только номером GUID `21686148-6449-6E6F-744E-656564454649`.', 'The types have short names: `L` is Linux filesystem and `V` is Linux LVM. BIOS boot has no short name and is given only by the GUID `21686148-6449-6E6F-744E-656564454649`.'),
    },
  },
  {
    id: 'lvm',
    prompt: bi('Создайте на третьем разделе группу томов `vg0`, а в ней логический том `root` размером 640 МиБ.', 'Create the volume group `vg0` on the third partition, and in it the logical volume `root` of 640 MiB.'),
    check: { when: "lvm.vgs[name=vg0].name=vg0 && lvm.lvs[name=root].vg=vg0" },
    chips: 'pvcreate /dev/sda3 && vgcreate vg0 /dev/sda3 && lvcreate -L 640M -n root vg0',
    docRef: man('lvcreate', 8),
    hints: { H1: bi('Сделать нужно три шага снизу вверх: создать физический том (`pvcreate`), группу (`vgcreate`) и логический том (`lvcreate`).', 'You need three steps from the bottom up: create the physical volume (`pvcreate`), the group (`vgcreate`) and the logical volume (`lvcreate`).') },
  },
  {
    id: 'mkfs',
    prompt: bi('Создайте файловую систему ext4 на `/dev/sda2` и на `/dev/vg0/root`.', 'Create an ext4 file system on `/dev/sda2` and on `/dev/vg0/root`.'),
    check: { when: "blk[name=sda2].fstype=ext4 && blk[name='vg0-root'].fstype=ext4" },
    chips: 'mkfs.ext4 /dev/sda2 && mkfs.ext4 /dev/vg0/root',
    docRef: man('mke2fs', 8),
  },
  {
    id: 'mount',
    prompt: bi('Смонтируйте будущий корень в `/mnt`, а раздел загрузки в `/mnt/boot`.', 'Mount the future root at `/mnt`, and the boot partition at `/mnt/boot`.'),
    check: {
      when: "mounts[target='/mnt'].fstype=ext4 && mounts[target='/mnt'].src~'vg0' && mounts[target='/mnt/boot'].src='/dev/sda2'",
      fail: [{ if: "mounts[target='/mnt/boot'].src='/dev/sda2' && mounts[target='/mnt'].fstype!=ext4", say: bi('Каталог `/mnt/boot` смонтирован раньше `/mnt`, и корень, смонтированный потом, закрыл его собой. Сначала монтируют корень, потом создают каталог командой `mkdir /mnt/boot` и монтируют в него раздел загрузки.', '`/mnt/boot` was mounted before `/mnt`, and the root mounted later covered it. First mount the root, then create the directory with `mkdir /mnt/boot` and mount the boot partition into it.') }],
    },
    chips: 'mount -t ext4 /dev/vg0/root /mnt && mkdir -p /mnt/boot && mount -t ext4 /dev/sda2 /mnt/boot',
    docRef: { ...man('mount', 8), label: 'mount(8) · -t' },
    hints: { H1: bi('Модуль ext4 на установочном носителе ещё не загружен, поэтому `mount` без `-t ext4` не узнает файловую систему и ответит «No such file or directory».', 'The ext4 module is not loaded on the installer media yet, so `mount` without `-t ext4` does not recognise the file system and answers “No such file or directory”.') },
  },
  {
    id: 'install',
    prompt: bi(
      'Установите систему в `/mnt` вместе с загрузчиком GRUB. Команда `setup-disk` берёт пакеты из репозитория на носителе, пишет `fstab` и ставит загрузчик на тот диск, где лежит `/mnt/boot`.',
      'Install the system into `/mnt` together with the GRUB boot loader. `setup-disk` takes the packages from the media’s repository, writes `fstab` and installs the loader on the disk that holds `/mnt/boot`.',
    ),
    check: { when: "files['/mnt/boot/grub/grub.cfg'].type=f && files['/mnt/etc/fstab'].text~'UUID=' && files['/mnt/boot/vmlinuz-virt'].type=f" },
    chips: 'BOOTLOADER=grub setup-disk -m sys /mnt',
    docRef: alpine('Alpine_setup_scripts', 'Alpine Wiki · setup-disk'),
    hints: {
      H1: bi('Режим `sys` означает обычную установку на диск, а переменная `BOOTLOADER=grub` выбирает GRUB вместо syslinux. Установка длится около минуты.', 'The `sys` mode is an ordinary install to disk, and `BOOTLOADER=grub` picks GRUB instead of syslinux. The install takes about a minute.'),
      H2: bi('Потом посмотрите `cat /mnt/etc/fstab`. Раздел `/boot` записан там по UUID, а корень по имени `/dev/vg0/root`. Имена томов LVM не сдвигаются так, как `/dev/sdb`, поэтому так записывать можно.', 'Then look at `cat /mnt/etc/fstab`. `/boot` is written there by UUID, and the root by the name `/dev/vg0/root`. LVM volume names do not shift the way `/dev/sdb` does, so this is fine.'),
    },
  },
  {
    id: 'identity',
    prompt: bi('Перед перезагрузкой дайте новой системе имя `shop-01` и задайте пароль root, иначе войти в неё будет не с чем.', 'Before the reboot give the new system the name `shop-01` and set a root password, otherwise there is nothing to log in with.'),
    check: {
      when: (f) => /^shop-01\s*$/m.test(text(f, '/mnt/etc/hostname')) && /^root:\$/m.test(text(f, '/mnt/etc/shadow')),
      fail: [{ if: (f) => /^root::/m.test(text(f, '/mnt/etc/shadow')), say: bi('У root новой системы пустой пароль. Команды `chpasswd -R /mnt` и `chroot /mnt passwd` меняют его внутри новой системы, а не на носителе.', 'The new system’s root has an empty password. `chpasswd -R /mnt` and `chroot /mnt passwd` change it inside the new system, not on the media.') }],
    },
    hints: {
      H1: bi('Имя машины хранится в `/mnt/etc/hostname`. Пароль задаёт команда `chroot /mnt passwd`, которая выполнится так, будто корнем уже стала новая система.', 'The host name is kept in `/mnt/etc/hostname`. `chroot /mnt passwd` sets the password, running as if the new system were already the root.'),
    },
  },
  {
    id: 'boot',
    prompt: bi('Перезагрузите машину. Носителя больше нет, поэтому машина должна загрузиться со своего диска через ваш загрузчик и встретить вас приглашением `shop-01 login:`.', 'Reboot the machine. The media is gone, so the machine must boot from its own disk through your boot loader and greet you with `shop-01 login:`.'),
    check: {
      when: (f) => (f.env as { bootFrom?: string }).bootFrom === 'disk' && /shop-01 login:/.test(consoleText(f)),
      fail: [{ if: (f) => (f.env as { bootFrom?: string }).bootFrom === 'disk' && /login:/.test(consoleText(f)), say: bi('Система загрузилась с диска, но имя у неё другое, потому что `/mnt/etc/hostname` перед перезагрузкой не содержал `shop-01`.', 'The system booted from the disk, but its name differs, because `/mnt/etc/hostname` did not hold `shop-01` before the reboot.') }],
    },
    chips: 'umount -R /mnt; reboot',
    hints: { H1: bi('Если после `reboot` снова загрузился носитель, значит, в начале диска нет загрузочной записи и GRUB не установился. Посмотрите вывод `setup-disk`.', 'If the media boots again after `reboot`, the start of the disk has no boot record and GRUB was not installed. Look at the output of `setup-disk`.') },
  },
];

export const INSTALL_LAB: RealLabProps = {
  machines: [INSTALL_MACHINE],
  tasks: INSTALL_TASKS,
  watch: { identity: ['/mnt/etc/hostname', '/mnt/etc/shadow'] },
  rows: 20,
  intro: bi(
    '### Машина без системы\n\nУ машины `new` есть пустой диск `/dev/sda` размером 2 ГиБ, а загрузилась она с установочного носителя Alpine Linux, то есть с маленькой системы в памяти и репозитория пакетов в `/media/cdrom/apks`. Сеть для работы не нужна. Всё, что вы сделаете с диском, происходит по-настоящему: после перезагрузки носителя не будет, и машина либо загрузится с диска, либо нет.',
    '### A machine without a system\n\n`new` has a blank 2 GiB disk `/dev/sda`, and it booted from Alpine Linux installer media, a small system in memory with a package repository in `/media/cdrom/apks`. No network is needed. Everything you do to the disk is real: after the reboot the media is gone, and the machine either boots from the disk or does not.',
  ),
};

export const INSTALL_EXAM: RealLabProps = {
  machines: [{ ...INSTALL_MACHINE, disks: [{ sizeMB: 2048 }] }],
  mode: 'exam',
  examId: 'linux.lab.install-exam',
  minutes: 40,
  pass: 0.75,
  watch: { layout: ['scope:blk'], volumes: ['scope:blk'], root: ['/mnt/etc/hostname', '/mnt/etc/shadow', '/mnt/etc/fstab', '/mnt/boot/grub/grub.cfg'], logs: ['/mnt/etc/fstab', 'scope:blk'] },
  rows: 20,
  intro: bi(
    '### Учебный экзамен о сервере базы данных\n\nДиск новой машины `new` нужно разметить так: таблица GPT, загрузчик GRUB, отдельный раздел `/boot`, а всё остальное отдано группе томов `sys` с томом `root` не меньше 700 МиБ и томом `logs` на 200 МиБ. Том `logs` в новой системе монтируется в `/var/log` по UUID. Машина должна называться `db-01`, и у root должен быть пароль. Засчитывается результат, а путь к нему может быть любым. Подсказок нет, а из документации открыты `man` и `--help`. Таймер мягкий и только записывает время.',
    '### A learning exam about a database server\n\nThe disk of the new machine `new` must be laid out like this: a GPT table, the GRUB boot loader, a separate `/boot`, and the rest given to the volume group `sys` with a `root` volume of at least 700 MiB and a `logs` volume of 200 MiB. In the new system `logs` is mounted at `/var/log` by UUID. The machine must be called `db-01`, and root must have a password. The result counts, and the way to it may be any. There are no hints, and the machine’s documentation is open: `man` and `--help`. The timer is soft and only records the time.',
  ),
  tasks: [
    {
      id: 'layout',
      weight: 2,
      critical: true,
      prompt: bi('На диске записана таблица GPT с разделом BIOS boot, отдельным `/boot` и разделом LVM.', 'The disk has a GPT table with a BIOS boot partition, a separate `/boot` and an LVM partition.'),
      check: { when: (f) => blk(f).some((b) => b.parttype === 'BIOS boot') && blk(f).some((b) => b.parttype === 'Linux LVM') && blk(f).some((b) => b.type === 'part' && b.parttype === 'Linux filesystem' && b.fstype === 'ext4') },
    },
    {
      id: 'volumes',
      weight: 2,
      prompt: bi('В группе `sys` есть том `root` от 700 МиБ и том `logs` на 200 МиБ, и на обоих создана файловая система.', 'The group `sys` has a `root` volume of 700 MiB or more and a `logs` volume of 200 MiB, both with a file system.'),
      check: { when: (f) => (part(f, 'sys-root')?.size ?? 0) >= 700 * 1048576 && Math.abs((part(f, 'sys-logs')?.size ?? 0) - 200 * 1048576) <= 8 * 1048576 && !!part(f, 'sys-root')?.fstype && !!part(f, 'sys-logs')?.fstype },
    },
    {
      id: 'root',
      weight: 2,
      critical: true,
      prompt: bi('Система установлена на `sys/root` с загрузчиком GRUB, машина называется `db-01`, и у root есть пароль.', 'The system is installed on `sys/root` with GRUB, the machine is called `db-01`, and root has a password.'),
      check: { when: (f) => /^db-01\s*$/m.test(text(f, '/mnt/etc/hostname')) && /^root:\$/m.test(text(f, '/mnt/etc/shadow')) && /sys(-|\/)root/.test(text(f, '/mnt/etc/fstab')) && (f.files['/mnt/boot/grub/grub.cfg'] as { type?: string } | undefined)?.type === 'f' },
    },
    {
      id: 'logs',
      weight: 2,
      prompt: bi('В `fstab` новой системы том `logs` монтируется в `/var/log` по UUID.', 'In the new system’s `fstab`, the volume `logs` mounts at `/var/log` by UUID.'),
      check: {
        when: (f) => {
          const uuid = part(f, 'sys-logs')?.uuid;
          return !!uuid && new RegExp(`^\\s*UUID=${uuid}\\s+/var/log\\s+\\S+`, 'm').test(text(f, '/mnt/etc/fstab'));
        },
      },
    },
    {
      id: 'boot',
      weight: 2,
      critical: true,
      prompt: bi('Машина загружается со своего диска и показывает приглашение `db-01 login:`.', 'The machine boots from its own disk and shows `db-01 login:`.'),
      check: { when: (f) => (f.env as { bootFrom?: string }).bootFrom === 'disk' && /db-01 login:/.test(consoleText(f)) },
    },
  ],
};

// ── The partition is full: deleted open files, a volume grown online ──────

const SHOP_DISK = [
  "printf 'label: gpt\\n,,V\\n' | sfdisk -q /dev/sda && pvcreate -q /dev/sda1 && vgcreate -q data /dev/sda1 && lvcreate -q -y -L 120M -n shop data && mkfs.ext4 -q /dev/data/shop",
  'mkdir -p /srv/shop && mount -t ext4 /dev/data/shop /srv/shop && echo "UUID=$(blkid -s UUID -o value /dev/data/shop) /srv/shop ext4 defaults 0 2" >> /etc/fstab',
  'mkdir -p /srv/shop/orders /srv/shop/log /srv/shop/cache && for i in $(seq 1 40); do echo "{\\"order\\": $i}" > /srv/shop/orders/$i.json; done && dd if=/dev/urandom of=/srv/shop/cache/build.bin bs=1M count=20 2>/dev/null',
  // legacy-agent keeps its debug log open; someone has already "cleaned it up" with rm.
  "printf '#!/bin/sh\\nexec 3>>/srv/shop/log/debug.log\\nwhile true; do echo \"$(date) debug tick\" >&3; sleep 5; done\\n' > /usr/local/bin/legacy-agent && chmod 755 /usr/local/bin/legacy-agent",
  "printf '#!/bin/sh\\nwhile true; do sleep 30; done\\n' > /usr/local/bin/orders-app && chmod 755 /usr/local/bin/orders-app && (setsid /usr/local/bin/orders-app </dev/null >/dev/null 2>&1 &)",
  'dd if=/dev/zero of=/srv/shop/log/debug.log bs=1M count=60 2>/dev/null && (setsid /usr/local/bin/legacy-agent </dev/null >/dev/null 2>&1 &) && sleep 1 && rm /srv/shop/log/debug.log',
];

const DISK_PROBES: LabProbe[] = [
  { id: 'free', on: 'app', cmd: "df -Pk /srv/shop | awk 'NR==2{print $4}'" },
  { id: 'size', on: 'app', cmd: "df -Pk /srv/shop | awk 'NR==2{print $2}'" },
  { id: 'orders', on: 'app', cmd: 'ls /srv/shop/orders | wc -l' },
  { id: 'agent', on: 'app', cmd: 'pgrep -x legacy-agent' },
  { id: 'holders', on: 'app', cmd: "lsof -nP +L1 2>/dev/null | awk '/debug.log/{print $2}'" },
  { id: 'app', on: 'app', cmd: 'pgrep -x orders-app' },
  { id: 'reserved', on: 'app', cmd: "tune2fs -l /dev/data/shop | awk -F: '/^Block count/{b=$2} /^Reserved block count/{r=$2} END{printf \"%.4f\", r/b}'" },
];

const ordersIntact = (f: Facts) => num(f, 'orders') === 40;
const agentAlive = (f: Facts) => ok(f, 'agent');

export const DISK_TASKS: LabGoal[] = [
  {
    id: 'culprit',
    on: 'app',
    prompt: bi(
      'Команда `df -h /srv/shop` показывает, что раздел почти полон, а `du -sh /srv/shop` насчитывает намного меньше. Найдите процесс, который держит открытым удалённый файл, и запишите его PID в `/root/culprit.txt`.',
      '`df -h /srv/shop` shows the partition is almost full, while `du -sh /srv/shop` counts far less. Find the process that holds a deleted file open and write its PID into `/root/culprit.txt`.',
    ),
    check: {
      when: (f) => {
        const pid = text(f, '/root/culprit.txt').trim();
        return /^\d+$/.test(pid) && out(f, 'holders').split('\n').map((x) => x.trim()).includes(pid);
      },
      fail: [{ if: (f) => text(f, '/root/culprit.txt').trim() === '1', say: bi('Нет, PID 1 принадлежит init, а его `/dev/console (deleted)` места не занимает, потому что это устройство, а не файл на разделе. Ищите строку с `/srv/shop`.', 'No, PID 1 is init, and its `/dev/console (deleted)` takes no space, because it is a device, not a file on the partition. Look for the line with `/srv/shop`.') }],
    },
    chips: 'lsof +L1',
    docRef: { url: 'https://lsof.readthedocs.io/en/latest/manpage/', label: 'lsof(8) · +L' },
    hints: {
      H1: bi('Команда `lsof +L1` показывает открытые файлы, у которых не осталось ни одного имени: в колонке NLINK у них стоит 0, а в конце строки пометка `(deleted)`. Строки init с `/dev/console` не в счёт. Тот же файл может держать и дочерний процесс агента `sleep`, потому что он унаследовал дескриптор.', '`lsof +L1` shows open files that have no name left: NLINK is 0 for them, and the line ends with `(deleted)`. init’s lines with `/dev/console` do not count. The agent’s child process `sleep` may hold the same file too, because it inherited the descriptor.'),
      H2: bi('Без lsof то же самое видно в `/proc` командой `ls -l /proc/*/fd 2>/dev/null | grep deleted`.', 'Without lsof the same shows in `/proc` with `ls -l /proc/*/fd 2>/dev/null | grep deleted`.'),
    },
  },
  {
    id: 'free',
    on: 'app',
    prompt: bi(
      'Верните место, чтобы на `/srv/shop` было свободно не меньше 60 МиБ. Заказы в `orders/` трогать нельзя, а `legacy-agent` и `orders-app` должны продолжать работать. Кэш сборки удалять можно.',
      'Get the space back so that `/srv/shop` has at least 60 MiB free. The orders in `orders/` must not be touched, and `legacy-agent` and `orders-app` must keep running. The build cache may be deleted.',
    ),
    check: {
      when: (f) => num(f, 'free') >= 60 * MiB && ordersIntact(f) && agentAlive(f) && ok(f, 'app'),
      fail: [
        { if: (f) => !agentAlive(f), say: bi('Агент остановлен. Место вернулось, но отчётность осталась без агента, а файл можно было обрезать через дескриптор процесса, не останавливая его.', 'The agent was stopped. The space came back, but reporting lost its agent, while the file could have been truncated through the process’s descriptor without stopping it.') },
        { if: (f) => !ordersIntact(f), say: bi('Заказов в `orders/` стало меньше, а освобождать место таким способом нельзя.', 'There are fewer orders in `orders/`, and space must not be freed that way.') },
        { if: (f) => num(f, 'free') >= 30 * MiB && num(f, 'free') < 60 * MiB, say: bi('Кэш удалён, но этого мало, потому что основное место держит удалённый журнал агента.', 'The cache is deleted, but that is not enough, because the agent’s deleted log holds most of the space.') },
      ],
    },
    chips: ': > /proc/PID/fd/3',
    docRef: { url: 'https://man7.org/linux/man-pages/man5/proc_pid_fd.5.html', label: 'proc_pid_fd(5)' },
    hints: {
      H1: bi('Удалённый файл продолжает существовать, пока он открыт. Путь `/proc/PID/fd/N` ведёт к нему через дескриптор, и если перенаправить туда пустой вывод командой `: >`, файл обрежется до нуля.', 'A deleted file goes on existing while it is open. `/proc/PID/fd/N` leads to it through the descriptor, and redirecting empty output there with `: >` truncates the file to zero.'),
      H2: bi('Номер дескриптора стоит в колонке FD вывода `lsof +L1`, например `3w` означает дескриптор 3, открытый на запись.', 'The descriptor number is in the FD column of `lsof +L1`; for example, `3w` means descriptor 3, open for writing.'),
    },
  },
  {
    id: 'grow',
    on: 'app',
    prompt: bi(
      'Чтобы у раздела был запас на будущее, увеличьте том `data/shop` и его файловую систему до 220 МиБ или больше, не отмонтируя `/srv/shop`. В группе `data` есть свободное место.',
      'To give the partition room for the future, grow the volume `data/shop` and its file system to 220 MiB or more without unmounting `/srv/shop`. The group `data` has free space.',
    ),
    check: {
      // ext4 keeps about 5% of a small volume for its own tables: a 220 MiB volume gives a file system of about 200 MiB.
      when: (f) => (part(f, 'data-shop')?.size ?? 0) >= 220 * 1048576 && num(f, 'size') >= 190 * MiB && ordersIntact(f),
      fail: [{ if: (f) => (part(f, 'data-shop')?.size ?? 0) >= 220 * 1048576 && num(f, 'size') < 190 * MiB, say: bi('Том вырос, а файловая система нет, и `df` видит прежний размер. Файловую систему ext4 нужно растянуть на новый том, и это можно сделать на ходу.', 'The volume grew, but the file system did not, and `df` sees the old size. The ext4 file system must be stretched over the new volume, and this can be done live.') }],
    },
    chips: 'lvextend -r -L 220M data/shop',
    docRef: man('lvextend', 8),
    hints: {
      H1: bi('Команда `lvextend` увеличивает том, а флаг `-r` сразу растягивает и файловую систему на нём. Вручную файловую систему растягивает команда `resize2fs /dev/data/shop`.', '`lvextend` grows the volume, and `-r` stretches the file system on it at once. By hand, `resize2fs /dev/data/shop` stretches the file system.'),
      H2: bi('Сколько места свободно в группе, показывает команда `vgs`.', '`vgs` shows how much space is free in the group.'),
    },
  },
  {
    id: 'reserved',
    on: 'app',
    beyond: true,
    docStep: 4,
    prompt: bi(
      'По умолчанию ext4 держит 5 % блоков в запасе для root, и на разделе с данными это пропавшие мегабайты. Уменьшите этот запас на `/dev/data/shop` до 1 %, не пересоздавая файловую систему. В уроке об этом не рассказывалось, поэтому поищите способ в документации e2fsprogs.',
      'By default ext4 keeps 5 % of the blocks in reserve for root, and on a data partition those are lost megabytes. Cut this reserve on `/dev/data/shop` to 1 % without recreating the file system. The lesson did not cover this, so look in the e2fsprogs documentation.',
    ),
    check: { when: (f) => num(f, 'reserved') > 0 && num(f, 'reserved') <= 0.011 },
    docRef: man('tune2fs', 8),
    hints: { H1: bi('Вам нужна утилита, которая меняет настройки уже созданной файловой системы ext4.', 'You need the tool that changes the settings of an existing ext4 file system.') },
    solutionTokens: ['tune2fs', '-m 1'],
  },
];

const DISK_MACHINE: LabMachine = { name: 'app', role: bi('сервер магазина', 'the shop’s server'), disks: [{ sizeMB: 512 }], setup: SHOP_DISK };

export const DISK_LAB: RealLabProps = {
  machines: [DISK_MACHINE],
  probes: DISK_PROBES,
  tasks: DISK_TASKS,
  watch: { culprit: ['probe:holders', '/root/culprit.txt'], free: ['probe:free', 'probe:orders', 'probe:agent', 'probe:app'], grow: ['probe:size', 'probe:orders', 'scope:blk'], reserved: ['probe:reserved'] },
  intro: bi(
    '### Раздел магазина\n\nНа машине `app` раздел `/srv/shop` лежит на логическом томе LVM `data/shop` размером 120 МиБ и монтируется по UUID из `/etc/fstab`. На нём хранятся заказы, кэш сборки и журналы. Работают две программы, `orders-app` и старый `legacy-agent`. Кто-то уже пытался освободить место командой `rm`, но место так и не вернулось.',
    '### The shop’s partition\n\nOn `app`, `/srv/shop` is on the 120 MiB LVM logical volume `data/shop`, mounted by UUID from `/etc/fstab`. It holds the orders, the build cache and the logs. Two programs run, `orders-app` and the old `legacy-agent`. Somebody has already tried to free space with `rm`, and the space never came back.',
  ),
};

// ── In-browser variants of the learning exams on the learner's own VMs ─────

/** linux.exam.disk in the tab: the same story on Alpine (busybox crond instead of cron.d, no logrotate in the image). */
export const DISK_EXAM_LAB: RealLabProps = {
  machines: [{ ...DISK_MACHINE, setup: [...SHOP_DISK, "echo '* * * * * dd if=/dev/zero of=/srv/shop/cache/dump-$(date +\\%s).bin bs=1M count=2 2>/dev/null' >> /etc/crontabs/root && rc-service crond start >/dev/null"] }],
  probes: [...DISK_PROBES, { id: 'cron', on: 'app', cmd: "grep -v '^\\s*#' /etc/crontabs/root | grep -c 'srv/shop/cache/dump'" }],
  mode: 'exam',
  examId: 'linux.exam.disk.browser',
  minutes: 35,
  pass: 0.7,
  watch: { space: ['probe:free', 'probe:orders', 'probe:agent', 'probe:app'], cron: ['probe:cron', 'probe:app'], grow: ['probe:size', 'probe:orders', 'scope:blk'], reserved: ['probe:reserved'] },
  intro: bi(
    '### Учебный экзамен в браузере о разделе, который заполнился\n\nСюжет здесь тот же, что у экзамена на своей машине, но всё происходит на настоящем Alpine Linux в самой вкладке. Мониторинг сообщает, что раздел `/srv/shop` на машине `app` почти полон и приложение заказов скоро перестанет записывать данные. Освободите место, не потеряв заказов в `/srv/shop/orders`, найдите, кто продолжает заполнять раздел, и дайте разделу запас. Агент `legacy-agent` ещё нужен для отчётности. Подсказок нет, а из документации открыты `man` и `--help`.',
    '### A learning exam in the browser about a partition that filled up\n\nThe story is the same as in the exam on your own machine, but everything happens on real Alpine Linux in the tab. Monitoring reports that `/srv/shop` on `app` is almost full and the orders application will soon stop writing data. Free the space without losing the orders in `/srv/shop/orders`, find who keeps filling the partition, and give it room. `legacy-agent` is still needed for reporting. There are no hints, and the machine’s documentation is open: `man` and `--help`.',
  ),
  tasks: [
    {
      id: 'space',
      on: 'app',
      weight: 35,
      critical: true,
      prompt: bi('Карточка 1. На `/srv/shop` свободно не меньше 60 МиБ, заказы целы, а `orders-app` и `legacy-agent` работают.', 'Card 1. `/srv/shop` has at least 60 MiB free, the orders are intact, and `orders-app` and `legacy-agent` are running.'),
      check: { when: (f) => num(f, 'free') >= 60 * MiB && ordersIntact(f) && agentAlive(f) && ok(f, 'app') },
    },
    {
      id: 'cron',
      on: 'app',
      weight: 20,
      prompt: bi('Карточка 2. Задание cron, которое раз за разом записывает в каталог кэша новые файлы с выгрузкой данных, выключено и не вернётся после перезагрузки.', 'Card 2. The job that writes dumps into the cache is off and will not come back after a reboot.'),
      check: { when: (f) => ok(f, 'app') && num(f, 'cron') === 0 && out(f, 'cron').trim() === '0' },
    },
    {
      id: 'grow',
      on: 'app',
      weight: 30,
      prompt: bi('Карточка 3. Том `data/shop` и его файловая система имеют размер от 220 МиБ, и при этом раздел не отмонтировали, а заказы не потеряли.', 'Card 3. The volume `data/shop` and its file system are 220 MiB or more, and the partition was not unmounted and no orders were lost.'),
      check: { when: (f) => (part(f, 'data-shop')?.size ?? 0) >= 220 * 1048576 && num(f, 'size') >= 190 * MiB && ordersIntact(f) },
    },
    {
      id: 'reserved',
      on: 'app',
      weight: 15,
      beyond: true,
      prompt: bi('Карточка 4. Запас блоков для root на `/dev/data/shop` составляет не больше 1 %. Как это задать, в курсе не показано.', 'Card 4. The root block reserve on `/dev/data/shop` is at most 1 %. The course did not show how to set it.'),
      check: { when: (f) => num(f, 'reserved') > 0 && num(f, 'reserved') <= 0.011 },
      solutionTokens: ['tune2fs'],
    },
  ],
};

const ACCESS_SERVER_SETUP = [
  'addgroup devs && ' + keyOnlyUser('alex') + ' && addgroup alex devs',
  "printf '#!/sbin/openrc-run\\ndescription=\"orders (a lab program)\"\\ncommand=/bin/sleep\\ncommand_args=100000\\ncommand_background=true\\npidfile=/run/orders.pid\\n' > /etc/init.d/orders && chmod 755 /etc/init.d/orders && rc-service orders start >/dev/null",
];

/** linux.exam.access in the tab: laptop and server on the lab switch; sudo rules name OpenRC's rc-service. */
export const ACCESS_EXAM_LAB: RealLabProps = {
  machines: [
    { name: 'laptop', role: bi('ноутбук Марии', 'Maria’s laptop'), setup: [keyOnlyUser('maria')] },
    { name: 'server', role: bi('сервер команды', 'the team’s server'), setup: ACCESS_SERVER_SETUP },
  ],
  probes: [
    { id: 'keyin', on: 'laptop', cmd: "su - maria -c 'ssh -o BatchMode=yes -o ConnectTimeout=5 server true' 2>&1" },
    { id: 'methods', on: 'laptop', cmd: 'ssh -o BatchMode=yes -o PreferredAuthentications=none -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 maria@server true 2>&1' },
    { id: 'sshd', on: 'server', cmd: 'sshd -T 2>/dev/null' },
    { id: 'sudo', on: 'server', cmd: 'sudo -l -U maria 2>&1' },
    { id: 'visudo', on: 'server', cmd: 'visudo -c 2>&1' },
  ],
  mode: 'exam',
  examId: 'linux.exam.access.browser',
  minutes: 40,
  pass: 0.7,
  watch: { sudo: ['probe:sudo', 'probe:visudo'], nopass: ['probe:sshd'], offer: ['probe:methods', 'probe:keyin'], allowgroups: ['probe:sshd'] },
  intro: bi(
    '### Учебный экзамен в браузере о доступе для новой разработчицы\n\nСюжет здесь тот же, что у экзамена на двух своих машинах, но всё происходит на настоящем Alpine Linux во вкладке. Машина `laptop` служит ноутбуком Марии, и учётная запись `maria` на ней есть, а ключей нет. Машина `server` служит сервером команды с группой `devs` и службой OpenRC `orders`. Марии нужен вход на `server` по ключу, общий каталог `/srv/releases`, в котором новые файлы сразу принадлежат группе `devs`, и право перезапускать `orders`, причём только эту службу. Вход по паролю пора запретить для всех, а по SSH пускать только группу `devs`. Вы работаете как root на обеих машинах, а от имени Марии на ноутбуке можно войти командой `su - maria`. Подсказок нет, а документация машин открыта.',
    '### A learning exam in the browser about access for a new developer\n\nThe story is the same as in the exam on two machines of your own, but everything happens on real Alpine Linux in the tab. `laptop` is Maria’s laptop, which has the account `maria` but no keys. `server` is the team’s server with the group `devs` and the OpenRC service `orders`. Maria needs key login to `server`, a shared directory `/srv/releases` where new files belong to `devs` at once, and the right to restart `orders`, and only that service. Password logins must be switched off for everyone, and SSH must let in only the group `devs`. You are root on both machines, and on the laptop you become Maria with `su - maria`. There are no hints, and the machines’ documentation is open.',
  ),
  tasks: [
    {
      id: 'login',
      on: 'laptop',
      weight: 20,
      critical: true,
      prompt: bi('Карточка 1. На `server` есть пользователь `maria` с `/bin/bash` в группе `devs`, и с `laptop` она входит туда по ключу без вопросов.', 'Card 1. `server` has the user `maria` with `/bin/bash` in the group `devs`, and she logs in there from `laptop` with a key without questions.'),
      check: { when: "reach['keyin'].exit=0 && files['/home/maria/.ssh/known_hosts'].exists=true" },
    },
    {
      id: 'account',
      on: 'server',
      weight: 10,
      prompt: bi('У пользователя `maria` на `server` оболочка `/bin/bash`, группа `devs`, а каталог `~/.ssh` закрыт от остальных.', 'On `server`, `maria` has the shell `/bin/bash`, the group `devs`, and her `~/.ssh` is closed to others.'),
      check: { when: "users[name=maria].shell='/bin/bash' && groups[name=devs].members has maria && files['/home/maria/.ssh'].owner=maria && files['/home/maria/.ssh'].mode=~'00$'" },
    },
    {
      id: 'releases',
      on: 'server',
      weight: 20,
      prompt: bi('Карточка 2. Группа `devs` может читать каталог `/srv/releases` и писать в него, остальные не могут, а новые файлы получают группу каталога.', 'Card 2. The group `devs` can read and write `/srv/releases`, others cannot, and new files get the directory’s group.'),
      check: { when: "files['/srv/releases'].type=d && files['/srv/releases'].group=devs && files['/srv/releases'].mode=~'^2[0-7]70$'" },
    },
    {
      id: 'sudo',
      on: 'server',
      weight: 20,
      critical: true,
      prompt: bi('Карточка 3. Пользователь `maria` может без пароля выполнить через sudo команду `rc-service orders restart`, и больше ничего от имени root.', 'Card 3. `maria` can run `rc-service orders restart` through sudo without a password, and nothing else as root.'),
      check: { when: (f) => /NOPASSWD:\s*\/sbin\/rc-service orders restart\s*$/m.test(out(f, 'sudo')) && !/\)\s*(NOPASSWD:\s*)?ALL\s*$/m.test(out(f, 'sudo')) && ok(f, 'visudo') },
    },
    {
      id: 'nopass',
      on: 'server',
      weight: 20,
      prompt: bi('Карточка 4. Итоговые настройки sshd запрещают вход по паролю и вход «с клавиатуры».', 'Card 4. sshd’s final settings forbid password and “keyboard-interactive” logins.'),
      check: { when: (f) => /^passwordauthentication no$/m.test(out(f, 'sshd')) && /^kbdinteractiveauthentication no$/m.test(out(f, 'sshd')) },
    },
    {
      id: 'offer',
      on: 'laptop',
      weight: 5,
      prompt: bi('Машина `laptop` не видит у `server` способов войти по паролю, а Мария по-прежнему входит по ключу.', '`laptop` sees no password login methods on `server`, and Maria still logs in with her key.'),
      check: { when: (f) => /Permission denied \(/.test(out(f, 'methods')) && !/password|keyboard-interactive/.test(out(f, 'methods')) && ok(f, 'keyin') },
    },
    {
      id: 'allowgroups',
      on: 'server',
      weight: 5,
      beyond: true,
      prompt: bi('Карточка 5. По SSH на `server` пускают только участников группы `devs`, а нужную директиву ищите на странице `man sshd_config`.', 'Card 5. SSH on `server` lets in only members of the group `devs`, and the directive is on the page `man sshd_config`.'),
      check: { when: (f) => /^allowgroups (.* )?devs( |$)/m.test(out(f, 'sshd')) },
      solutionTokens: ['AllowGroups'],
    },
  ],
};

/** Lab pages, #/lab/<id>: in-browser variants of the learning exams and the install exam. */
export const LAB_PAGES: Record<string, RealLabProps> = {
  'linux-disk': DISK_EXAM_LAB,
  'linux-access': ACCESS_EXAM_LAB,
  'linux-install': INSTALL_EXAM,
};
