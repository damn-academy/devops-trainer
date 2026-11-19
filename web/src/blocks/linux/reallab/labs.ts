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
    role: bi('бастион, единственный вход', 'the bastion, the only way in'),
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
];

export const SSH_TASKS: LabGoal[] = [
  {
    id: 'keygen',
    on: 'laptop',
    prompt: bi('На `laptop` создайте пару ключей ed25519 в стандартном месте.', 'On `laptop`, create an ed25519 key pair in the standard place.'),
    check: { when: "files['/root/.ssh/id_ed25519'].mode='0600' && files['/root/.ssh/id_ed25519.pub'].type=f" },
    chips: 'ssh-keygen -t ed25519',
    docRef: obsd('ssh-keygen', 1),
    hints: { H1: bi('Вопрос о пароле на ключ здесь можно пропустить клавишей Enter: на учебной машине это допустимо, на рабочем ноутбуке — нет.', 'The passphrase question may be skipped with Enter here: fine on a lab machine, not on a work laptop.') },
  },
  {
    id: 'bastion',
    on: 'laptop',
    prompt: bi(
      'Отнесите открытый ключ на `bastion` пользователю `deploy` (пароль у него пока есть: `deploy-2026`) и убедитесь, что `ssh deploy@bastion` пускает без пароля.',
      'Take the public key to `bastion` for the user `deploy` (he still has a password: `deploy-2026`) and make sure `ssh deploy@bastion` lets you in without one.',
    ),
    check: {
      when: "reach['bastion'].exit=0 && reach['bastion'].out~'bastion'",
      fail: [
        { if: "reach['bastion'].out~'Host key verification failed'", say: bi('Клиент ещё не знает ключ хоста `bastion`. Подключитесь один раз руками и сверьте отпечаток: после «yes» он ляжет в `~/.ssh/known_hosts`.', 'The client does not know `bastion`’s host key yet. Connect once by hand and compare the fingerprint: after “yes” it goes into `~/.ssh/known_hosts`.') },
        { if: "reach['bastion'].out~'Permission denied'", say: bi('Сервер не принял ключ: открытого ключа нет в `~deploy/.ssh/authorized_keys` на `bastion`, или у файла слишком открытые права.', 'The server did not accept the key: the public key is not in `~deploy/.ssh/authorized_keys` on `bastion`, or the file is too open.') },
      ],
    },
    chips: 'ssh-copy-id deploy@bastion',
    docRef: obsd('ssh-copy-id', 1),
    hints: {
      H1: bi('`ssh-copy-id` спросит пароль один раз и допишет ключ в `authorized_keys` с правильными правами.', '`ssh-copy-id` asks for the password once and appends the key to `authorized_keys` with the right permissions.'),
      H2: bi('Проверка: `ssh deploy@bastion hostname` должна напечатать `bastion` и ничего не спросить.', 'The check: `ssh deploy@bastion hostname` must print `bastion` and ask nothing.'),
    },
  },
  {
    id: 'jump',
    on: 'laptop',
    prompt: bi(
      'Напрямую `app` вас не пустит: его sshd принимает подключения только с `bastion`. Положите свой ключ и на `app` (тот же пользователь и пароль), заходя через бастион.',
      '`app` will not let you in directly: its sshd takes connections only from `bastion`. Put your key on `app` too (the same user and password), going through the bastion.',
    ),
    check: {
      when: "reach['jump'].exit=0 && reach['jump'].out~'app'",
      fail: [{ if: "reach['jump'].out~'Permission denied'", say: bi('Бастион пропустил, а `app` не принял ключ: на `app` его ещё нет в `~deploy/.ssh/authorized_keys`.', 'The bastion let you through, but `app` did not accept the key: it is not in `~deploy/.ssh/authorized_keys` on `app` yet.') }, { if: "reach['jump'].out~'timed out'", say: bi('Подключение к `app` повисло: напрямую туда не пройти. Нужен прыжок через бастион — ключ `-J`.', 'The connection to `app` hung: there is no direct way. You need a jump through the bastion — the `-J` option.') }],
    },
    chips: 'ssh-copy-id -o ProxyJump=deploy@bastion deploy@app',
    docRef: { ...obsd('ssh', 1), label: 'ssh(1) · -J' },
    hints: {
      H1: bi('`-J deploy@bastion` у `ssh` и `-o ProxyJump=deploy@bastion` у `ssh-copy-id` значат одно: сначала войти на бастион, а оттуда открыть путь дальше.', '`-J deploy@bastion` for `ssh` and `-o ProxyJump=deploy@bastion` for `ssh-copy-id` mean the same: log in to the bastion first and open the way on from there.'),
      H2: bi('Проверка — `ssh -J deploy@bastion deploy@app hostname`: она должна напечатать `app` и ничего не спросить. Ключ хоста `app` клиент тоже запомнит при первом прыжке.', 'The check is `ssh -J deploy@bastion deploy@app hostname`: it must print `app` and ask nothing. The client remembers `app`’s host key on the first jump too.'),
    },
  },
  {
    id: 'config',
    on: 'laptop',
    prompt: bi(
      'Опишите обе машины в `~/.ssh/config` так, чтобы короткая команда `ssh app` сама входила пользователем `deploy` через бастион.',
      'Describe both machines in `~/.ssh/config` so that the short command `ssh app` logs in as `deploy` through the bastion by itself.',
    ),
    check: {
      when: "reach['cfg'].out~'proxyjump' && reach['cfg'].out~'user deploy' && reach['app'].exit=0",
      fail: [
        { if: "reach['cfg'].out~'proxyjump' && reach['app'].exit!=0", say: bi('Прыжок описан, но вход на `app` не проходит. Посмотрите `ssh -v app`: на каком шаге отказ — у бастиона или у `app`?', 'The jump is described, but the login to `app` fails. Look at `ssh -v app`: at which step is the refusal — at the bastion or at `app`?') },
        { if: "reach['cfg'].out~'user root'", say: bi('Без `User` клиент входит под вашим местным именем, здесь это root. Укажите `User deploy`.', 'Without `User`, the client logs in under your local name, which is root here. Set `User deploy`.') },
      ],
    },
    docRef: obsd('ssh_config', 5),
    hints: {
      H1: bi('Блок `Host bastion` с `User deploy`, блок `Host app` с `User deploy` и `ProxyJump bastion`. Адреса не нужны: имена машин уже есть в `/etc/hosts`.', 'A `Host bastion` block with `User deploy`, a `Host app` block with `User deploy` and `ProxyJump bastion`. No addresses are needed: the machine names are already in `/etc/hosts`.'),
      H2: bi('Что клиент понял из файла, показывает `ssh -G app`: там видны итоговые `user` и `proxyjump`.', '`ssh -G app` shows what the client made of the file: the final `user` and `proxyjump` are there.'),
    },
  },
  {
    id: 'scp',
    on: 'app',
    prompt: bi('Скопируйте `~/release-notes.txt` с `laptop` в домашний каталог `deploy` на `app`.', 'Copy `~/release-notes.txt` from `laptop` to `deploy`’s home directory on `app`.'),
    check: { when: "files['/home/deploy/release-notes.txt'].text~'Release 1.4.2'" },
    chips: 'scp ~/release-notes.txt app:',
    docRef: obsd('scp', 1),
    hints: { H1: bi('`scp` понимает имена из `~/.ssh/config`: путь на удалённой машине пишется после двоеточия, пустой путь — домашний каталог.', '`scp` understands the names from `~/.ssh/config`: the remote path goes after a colon, an empty path is the home directory.') },
  },
  {
    id: 'tunnel',
    on: 'laptop',
    prompt: bi(
      'На `app` есть панель заказов, но она слушает только `127.0.0.1:8080` — снаружи её не видно. Поднимите в фоне туннель SSH так, чтобы на `laptop` она открывалась по `http://127.0.0.1:8080/`.',
      '`app` has an orders panel, but it listens only on `127.0.0.1:8080` — nothing outside sees it. Bring up an SSH tunnel in the background so that on `laptop` it opens at `http://127.0.0.1:8080/`.',
    ),
    check: {
      when: "listen[port=8080].proc=ssh && reach['tunnel'].out~'orders admin'",
      fail: [{ if: "listen[port=8080].proc=ssh", say: bi('Туннель слушает, но панель не отвечает. Справа от `-L` стоит адрес с точки зрения `app`: там панель живёт на `localhost:8080`.', 'The tunnel listens, but the panel does not answer. The right side of `-L` is an address as `app` sees it: there the panel lives at `localhost:8080`.') }],
    },
    chips: 'ssh -f -N -L 8080:localhost:8080 app',
    docRef: { ...obsd('ssh', 1), label: 'ssh(1) · -L' },
    hints: {
      H1: bi('`-L местный:куда:порт` — «слушай у меня, отправляй туда от имени сервера»; `-N` — без оболочки, `-f` — уйти в фон.', '`-L local:where:port` — “listen here, send it there on the server’s behalf”; `-N` means no shell, `-f` go to the background.'),
      H2: bi('Проверка — `curl -s http://127.0.0.1:8080/` на `laptop`.', 'The check is `curl -s http://127.0.0.1:8080/` on `laptop`.'),
    },
  },
  {
    id: 'mux',
    on: 'laptop',
    beyond: true,
    docStep: 4,
    prompt: bi(
      'Каждый `ssh app` проходит бастион заново и тратит на это секунды. Сделайте так, чтобы все сеансы к `app` шли через одно открытое подключение и оно жило ещё несколько минут после выхода. В уроке этого не было: ищите в `man ssh_config`.',
      'Every `ssh app` goes through the bastion again and spends seconds on it. Make every session to `app` share one open connection, and keep it alive for a few minutes after you log out. The lesson did not show this: look in `man ssh_config`.',
    ),
    check: { when: (f) => /^controlmaster (auto|yes)/m.test(out(f, 'cfg')) && /^controlpath \S+/m.test(out(f, 'cfg')) && !/^controlpersist (no|0)$/m.test(out(f, 'cfg')) && /^controlpersist /m.test(out(f, 'cfg')) },
    docRef: obsd('ssh_config', 5),
    hints: { H1: bi('Три настройки с одним общим началом имени.', 'Three settings whose names start the same way.') },
    solutionTokens: ['ControlMaster', 'ControlPath', 'ControlPersist'],
  },
];

export const SSH_LAB: RealLabProps = {
  machines: SSH_MACHINES,
  probes: SSH_PROBES,
  tasks: SSH_TASKS,
  watch: { mux: ['probe:cfg'] },
  intro: bi(
    '### Три машины\n\n`laptop` (10.0.0.11) — ваш ноутбук, вы на нём root. `bastion` (10.0.0.12) — единственная машина, которую видно снаружи. `app` (10.0.0.13) — сервер приложения, к его sshd пускают только с бастиона. Все три — настоящие Alpine Linux с OpenSSH; вкладки над терминалом переключают машины, но работаете вы с `laptop`, как в жизни.',
    '### Three machines\n\n`laptop` (10.0.0.11) is your laptop, you are root on it. `bastion` (10.0.0.12) is the only machine visible from outside. `app` (10.0.0.13) is the application server; its sshd lets in only connections from the bastion. All three are real Alpine Linux with OpenSSH; the tabs above the terminal switch machines, but you work from `laptop`, as in real life.',
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
      'На `web` опишите сайт магазина: файл `/etc/nginx/http.d/shop.conf` с блоком `server`, который слушает 80 и отдаёт файлы из `/srv/shop`. `nginx -t` должен сказать, что настройки в порядке.',
      'On `web`, describe the shop’s site: a file `/etc/nginx/http.d/shop.conf` with a `server` block that listens on 80 and serves the files from `/srv/shop`. `nginx -t` must say the configuration is fine.',
    ),
    check: {
      when: "files['/etc/nginx/http.d/shop.conf'].text~'/srv/shop' && reach['nginx-t'].exit=0",
      fail: [{ if: "files['/etc/nginx/http.d/shop.conf'].exists=true && reach['nginx-t'].exit!=0", say: bi('`nginx -t` нашёл ошибку и назвал строку: чаще всего это пропущенная `;` или `}`.', '`nginx -t` found a mistake and named the line: most often a missing `;` or `}`.') }],
    },
    docRef: { url: 'https://nginx.org/en/docs/http/ngx_http_core_module.html#server', label: 'nginx · server' },
    hints: {
      H1: bi('Строки внутри `server { … }`: `listen 80;`, `server_name web;`, `root /srv/shop;`, `index index.html;`.', 'The lines inside `server { … }`: `listen 80;`, `server_name web;`, `root /srv/shop;`, `index index.html;`.'),
      H2: bi("Можно так: `printf 'server {\\n listen 80;\\n server_name web;\\n root /srv/shop;\\n index index.html;\\n}\\n' > /etc/nginx/http.d/shop.conf`, затем `nginx -t`. Если до первого запуска он жалуется на `/run/nginx/nginx.pid` — это не ваша ошибка: каталог создаёт скрипт службы при старте, а синтаксис уже проверен строкой `syntax is ok`.", "One way: `printf 'server {\\n listen 80;\\n server_name web;\\n root /srv/shop;\\n index index.html;\\n}\\n' > /etc/nginx/http.d/shop.conf`, then `nginx -t`. If before the first start it complains about `/run/nginx/nginx.pid`, that is not your mistake: the service script creates the directory at start, and the line `syntax is ok` has already checked the syntax."),
    },
  },
  {
    id: 'start',
    on: 'web',
    prompt: bi('Запустите nginx сейчас и включите его в уровень запуска `default`, чтобы он поднимался после перезагрузки.', 'Start nginx now and add it to the `default` runlevel so that it comes up after a reboot.'),
    check: {
      when: "svc[name=nginx].state=started && svc[name=nginx].runlevels has default && listen[port=80].proc=nginx",
      fail: [
        { if: 'svc[name=nginx].state=started', say: bi('Сейчас nginx работает, но после перезагрузки не поднимется: в уровне `default` его нет. Это делает `rc-update`.', 'nginx runs now, but it will not come up after a reboot: it is not in the `default` runlevel. `rc-update` does that.') },
        { if: 'svc[name=nginx].runlevels has default', say: bi('Включён на будущее, но сейчас не запущен: `rc-update` не запускает службу, это делает `rc-service`.', 'Enabled for the future but not running now: `rc-update` does not start a service; `rc-service` does.') },
      ],
    },
    chips: 'rc-service nginx start && rc-update add nginx default',
    docRef: alpine('OpenRC', 'Alpine Wiki · OpenRC'),
    hints: { H1: bi('Как `systemctl start` и `systemctl enable` — две отдельные команды: `rc-service … start` и `rc-update add … default`.', 'Like `systemctl start` and `systemctl enable` — two separate commands: `rc-service … start` and `rc-update add … default`.') },
  },
  {
    id: 'neighbour',
    on: 'client',
    prompt: bi('Убедитесь с машины `client`, что сайт открывается по имени: `curl http://web/` должен вернуть страницу магазина.', 'Make sure from `client` that the site opens by name: `curl http://web/` must return the shop’s page.'),
    check: {
      when: "reach['page'].out~'The shop is open'",
      fail: [{ if: "reach['page'].out~'404'", say: bi('Отвечает не ваш сайт, а `default.conf` из пакета: его блок помечен `default_server` и на всё говорит 404. nginx выбирает блок по имени сайта из запроса — дайте своему `server_name web;` или уберите `default.conf`.', 'It is not your site answering but the package’s `default.conf`: its block is marked `default_server` and says 404 to everything. nginx picks a block by the site name in the request — give yours `server_name web;` or remove `default.conf`.') }],
    },
    chips: 'curl -s http://web/',
    hints: {
      H1: bi('Переключитесь на вкладку `client`: проверка идёт с соседней машины, как у настоящего посетителя.', 'Switch to the `client` tab: the check runs from the neighbouring machine, as for a real visitor.'),
      H2: bi('Если пришло 404, посмотрите `ls /etc/nginx/http.d/`: блоков `server` там два, и на 80 первым отвечает тот, что помечен `default_server`.', 'If you got a 404, look at `ls /etc/nginx/http.d/`: there are two `server` blocks, and on 80 the one marked `default_server` answers first.'),
    },
  },
  {
    id: 'service',
    on: 'web',
    prompt: bi(
      'Программа `/usr/local/bin/report` должна работать как служба OpenRC `report`: напишите `/etc/init.d/report`, запустите её и включите в уровень `default`.',
      'The program `/usr/local/bin/report` must run as the OpenRC service `report`: write `/etc/init.d/report`, start it and add it to the `default` runlevel.',
    ),
    check: {
      when: "svc[name=report].state=started && svc[name=report].runlevels has default && reach['report'].exit=0",
      fail: [
        { if: (f) => { const m = (f.files['/etc/init.d/report'] as { exists?: boolean; mode?: string } | undefined); return !!m?.exists && !!m.mode && !(Number(m.mode.slice(-3, -2)) & 1); }, say: bi('Скрипт службы должен быть исполняемым: `chmod +x /etc/init.d/report`.', 'The service script must be executable: `chmod +x /etc/init.d/report`.') },
        { if: "svc[name=report].state=started && reach['report'].exit!=0", say: bi('OpenRC считает службу запущенной, а программы нет: без `command_background=true` OpenRC ждёт, что программа уйдёт в фон сама, а эта так не умеет.', 'OpenRC thinks the service started, but the program is not there: without `command_background=true` OpenRC expects the program to go to the background by itself, and this one cannot.') },
      ],
    },
    docRef: { url: 'https://github.com/OpenRC/openrc/blob/master/service-script-guide.md', label: 'OpenRC service script guide' },
    hints: {
      H1: bi('Первая строка `#!/sbin/openrc-run`, дальше `command=/usr/local/bin/report`, `command_background=true` и `pidfile=/run/report.pid`.', 'The first line is `#!/sbin/openrc-run`, then `command=/usr/local/bin/report`, `command_background=true` and `pidfile=/run/report.pid`.'),
      H2: bi('Не забудьте `chmod +x`, затем `rc-service report start` и `rc-update add report default`.', 'Do not forget `chmod +x`, then `rc-service report start` and `rc-update add report default`.'),
    },
  },
  {
    id: 'respawn',
    on: 'web',
    prompt: bi(
      'Отчёт иногда падает ночью. Сделайте так, чтобы OpenRC сам поднимал его снова: проверка убьёт программу `kill -9` и подождёт несколько секунд.',
      'The report sometimes dies at night. Make OpenRC bring it back by itself: the check kills the program with `kill -9` and waits a few seconds.',
    ),
    check: {
      when: "reach['respawn'].exit=0",
      fail: [{ if: "files['/etc/init.d/report'].text~'supervise-daemon' && reach['respawn'].exit!=0", say: bi('Надзиратель указан, но после `kill -9` программа не вернулась. Служба перезапущена после правки скрипта? `rc-service report restart`.', 'The supervisor is set, but the program did not come back after `kill -9`. Was the service restarted after the script changed? `rc-service report restart`.') }],
    },
    docRef: { url: 'https://github.com/OpenRC/openrc/blob/master/supervise-daemon-guide.md', label: 'supervise-daemon guide' },
    hints: {
      H1: bi('Строка `supervisor=supervise-daemon` в скрипте службы — аналог `Restart=` в systemd. `command_background` и `pidfile` с ним не нужны.', 'The line `supervisor=supervise-daemon` in the service script is the counterpart of `Restart=` in systemd. `command_background` and `pidfile` are not needed with it.'),
      H2: bi('После правки — `rc-service report restart`, иначе работает старый способ запуска.', 'After the edit, `rc-service report restart`; otherwise the old way of starting stays in effect.'),
    },
  },
  {
    id: 'health',
    on: 'client',
    beyond: true,
    docStep: 4,
    prompt: bi(
      'Мониторингу нужен адрес `http://web/health`, который отвечает кодом 200 и словом `ok` — без файла на диске. В уроке этого не было: ищите в документации модуля rewrite nginx.',
      'Monitoring needs the address `http://web/health` answering with code 200 and the word `ok` — with no file on disk. The lesson did not show this: look in the documentation of nginx’s rewrite module.',
    ),
    check: { when: "reach['health'].out=~'^ok 200$'" },
    docRef: { url: 'https://nginx.org/en/docs/http/ngx_http_rewrite_module.html#return', label: 'nginx · rewrite' },
    hints: { H1: bi('Отдельный `location` для одного точного пути.', 'A separate `location` for one exact path.') },
    solutionTokens: ['return 200', 'location = /health'],
  },
];

export const WEB_LAB: RealLabProps = {
  machines: WEB_MACHINES,
  probes: WEB_PROBES,
  tasks: WEB_TASKS,
  watch: { respawn: ['probe:report'] },
  intro: bi(
    '### Две машины\n\n`web` (10.0.0.11) станет сервером магазина, `client` (10.0.0.12) — его посетителем. На `web` уже есть страница `/srv/shop/index.html` и программа отчёта. Это Alpine Linux, поэтому службами здесь управляет OpenRC: `rc-service`, `rc-update`, `rc-status`.',
    '### Two machines\n\n`web` (10.0.0.11) becomes the shop’s server, `client` (10.0.0.12) its visitor. `web` already has the page `/srv/shop/index.html` and the report program. This is Alpine Linux, so OpenRC manages the services here: `rc-service`, `rc-update`, `rc-status`.',
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
      'Разметьте `/dev/sda` в GPT на три раздела: 2 МиБ для загрузчика (тип BIOS boot), 200 МиБ под `/boot` (Linux filesystem) и всё остальное под LVM (Linux LVM).',
      'Partition `/dev/sda` as GPT with three partitions: 2 MiB for the boot loader (type BIOS boot), 200 MiB for `/boot` (Linux filesystem) and the rest for LVM (Linux LVM).',
    ),
    check: {
      when: "blk[name=sda1].parttype='BIOS boot' && blk[name=sda2].parttype='Linux filesystem' && blk[name=sda3].parttype='Linux LVM'",
      fail: [{ if: "blk[name=sda1].parttype='Linux filesystem'", say: bi('Первый раздел получил тип по умолчанию. Для GRUB на диске GPT нужен маленький раздел типа BIOS boot — туда ляжет его вторая часть.', 'The first partition got the default type. GRUB on a GPT disk needs a small partition of type BIOS boot — its second stage goes there.') }],
    },
    chips: "printf 'label: gpt\\n,2M,21686148-6449-6E6F-744E-656564454649\\n,200M,L\\n,,V\\n' | sfdisk /dev/sda",
    docRef: man('sfdisk', 8),
    hints: {
      H1: bi('`sfdisk` читает разметку со стандартного входа: строка `label: gpt`, затем по строке на раздел — начало, размер, тип.', '`sfdisk` reads the layout from standard input: a line `label: gpt`, then one line per partition — start, size, type.'),
      H2: bi('Короткие имена типов: `L` — Linux filesystem, `V` — Linux LVM. У BIOS boot короткого имени нет, только GUID `21686148-6449-6E6F-744E-656564454649`.', 'Short type names: `L` is Linux filesystem, `V` is Linux LVM. BIOS boot has no short name, only the GUID `21686148-6449-6E6F-744E-656564454649`.'),
    },
  },
  {
    id: 'lvm',
    prompt: bi('Сделайте на третьем разделе группу томов `vg0` и в ней логический том `root` на 640 МиБ.', 'Make a volume group `vg0` on the third partition and a logical volume `root` of 640 MiB in it.'),
    check: { when: "lvm.vgs[name=vg0].name=vg0 && lvm.lvs[name=root].vg=vg0" },
    chips: 'pvcreate /dev/sda3 && vgcreate vg0 /dev/sda3 && lvcreate -L 640M -n root vg0',
    docRef: man('lvcreate', 8),
    hints: { H1: bi('Три шага снизу вверх: физический том (`pvcreate`), группа (`vgcreate`), логический том (`lvcreate`).', 'Three steps from the bottom up: a physical volume (`pvcreate`), a group (`vgcreate`), a logical volume (`lvcreate`).') },
  },
  {
    id: 'mkfs',
    prompt: bi('Создайте ext4 на `/dev/sda2` и на `/dev/vg0/root`.', 'Create ext4 on `/dev/sda2` and on `/dev/vg0/root`.'),
    check: { when: "blk[name=sda2].fstype=ext4 && blk[name='vg0-root'].fstype=ext4" },
    chips: 'mkfs.ext4 /dev/sda2 && mkfs.ext4 /dev/vg0/root',
    docRef: man('mke2fs', 8),
  },
  {
    id: 'mount',
    prompt: bi('Смонтируйте будущий корень в `/mnt`, а раздел загрузки — в `/mnt/boot`.', 'Mount the future root at `/mnt`, and the boot partition at `/mnt/boot`.'),
    check: {
      when: "mounts[target='/mnt'].fstype=ext4 && mounts[target='/mnt'].src~'vg0' && mounts[target='/mnt/boot'].src='/dev/sda2'",
      fail: [{ if: "mounts[target='/mnt/boot'].src='/dev/sda2' && mounts[target='/mnt'].fstype!=ext4", say: bi('`/mnt/boot` смонтирован раньше `/mnt`: корень, смонтированный потом, закрыл его собой. Порядок — сначала корень, потом `mkdir /mnt/boot` и раздел загрузки.', '`/mnt/boot` was mounted before `/mnt`: the root mounted later covered it. The order is the root first, then `mkdir /mnt/boot` and the boot partition.') }],
    },
    chips: 'mount -t ext4 /dev/vg0/root /mnt && mkdir -p /mnt/boot && mount -t ext4 /dev/sda2 /mnt/boot',
    docRef: { ...man('mount', 8), label: 'mount(8) · -t' },
    hints: { H1: bi('Модуль ext4 на установочном носителе ещё не загружен, поэтому `mount` без `-t ext4` не узнает файловую систему и ответит «No such file or directory».', 'The ext4 module is not loaded on the installer media yet, so `mount` without `-t ext4` does not recognise the file system and answers “No such file or directory”.') },
  },
  {
    id: 'install',
    prompt: bi(
      'Поставьте систему в `/mnt` с загрузчиком GRUB: `setup-disk` берёт пакеты из репозитория на носителе, пишет `fstab` и ставит загрузчик на диск, где лежит `/mnt/boot`.',
      'Install the system into `/mnt` with the GRUB boot loader: `setup-disk` takes the packages from the repository on the media, writes `fstab` and puts the boot loader on the disk that holds `/mnt/boot`.',
    ),
    check: { when: "files['/mnt/boot/grub/grub.cfg'].type=f && files['/mnt/etc/fstab'].text~'UUID=' && files['/mnt/boot/vmlinuz-virt'].type=f" },
    chips: 'BOOTLOADER=grub setup-disk -m sys /mnt',
    docRef: alpine('Alpine_setup_scripts', 'Alpine Wiki · setup-disk'),
    hints: {
      H1: bi('Режим `sys` — обычная установка на диск. Переменная `BOOTLOADER=grub` выбирает GRUB вместо syslinux. Установка идёт около минуты.', 'The `sys` mode is an ordinary install to disk. The variable `BOOTLOADER=grub` picks GRUB instead of syslinux. The install takes about a minute.'),
      H2: bi('Потом посмотрите `cat /mnt/etc/fstab`: `/boot` записан по UUID, а корень — по имени `/dev/vg0/root`. Имена LVM не сдвигаются, как `/dev/sdb`, поэтому так можно.', 'Then look at `cat /mnt/etc/fstab`: `/boot` is written by UUID and the root by the name `/dev/vg0/root`. LVM names do not shift like `/dev/sdb`, so this is fine.'),
    },
  },
  {
    id: 'identity',
    prompt: bi('Перед перезагрузкой дайте новой системе имя `shop-01` и пароль root — иначе войти в неё будет нечем.', 'Before the reboot, give the new system the name `shop-01` and a root password — otherwise there will be no way to log in.'),
    check: {
      when: (f) => /^shop-01\s*$/m.test(text(f, '/mnt/etc/hostname')) && /^root:\$/m.test(text(f, '/mnt/etc/shadow')),
      fail: [{ if: (f) => /^root::/m.test(text(f, '/mnt/etc/shadow')), say: bi('У root новой системы пустой пароль. `chpasswd -R /mnt` или `chroot /mnt passwd` меняют его внутри новой системы, а не на носителе.', 'root of the new system has an empty password. `chpasswd -R /mnt` or `chroot /mnt passwd` change it inside the new system, not on the media.') }],
    },
    hints: {
      H1: bi('Имя машины лежит в `/mnt/etc/hostname`. Пароль: `chroot /mnt passwd` — команда выполнится так, будто корень уже новая система.', 'The machine name lives in `/mnt/etc/hostname`. The password: `chroot /mnt passwd` — the command runs as if the root were already the new system.'),
    },
  },
  {
    id: 'boot',
    prompt: bi('Перезагрузите машину. Носителя больше нет: она должна загрузиться со своего диска через ваш загрузчик и встретить вас приглашением `shop-01 login:`.', 'Reboot the machine. The media is gone: it must boot from its own disk through your boot loader and greet you with `shop-01 login:`.'),
    check: {
      when: (f) => (f.env as { bootFrom?: string }).bootFrom === 'disk' && /shop-01 login:/.test(consoleText(f)),
      fail: [{ if: (f) => (f.env as { bootFrom?: string }).bootFrom === 'disk' && /login:/.test(consoleText(f)), say: bi('Система загрузилась с диска, но имя другое: `/mnt/etc/hostname` перед перезагрузкой не содержал `shop-01`.', 'The system booted from its disk, but under another name: `/mnt/etc/hostname` did not hold `shop-01` before the reboot.') }],
    },
    chips: 'umount -R /mnt; reboot',
    hints: { H1: bi('Если после `reboot` снова загрузился носитель, значит, в начале диска нет загрузочной записи: GRUB не встал. Посмотрите вывод `setup-disk`.', 'If the media boots again after `reboot`, the start of the disk has no boot record: GRUB did not get installed. Look at the output of `setup-disk`.') },
  },
];

export const INSTALL_LAB: RealLabProps = {
  machines: [INSTALL_MACHINE],
  tasks: INSTALL_TASKS,
  watch: { identity: ['/mnt/etc/hostname', '/mnt/etc/shadow'] },
  rows: 20,
  intro: bi(
    '### Машина без системы\n\nУ машины `new` пустой диск `/dev/sda` на 2 ГиБ, а загрузилась она с установочного носителя Alpine Linux: это маленькая система в памяти и репозиторий пакетов в `/media/cdrom/apks`. Сеть не нужна. Всё, что вы сделаете с диском, — настоящее: после перезагрузки носителя не будет, и машина либо загрузится с диска, либо нет.',
    '### A machine without a system\n\nThe machine `new` has a blank 2 GiB disk `/dev/sda`, and it has booted from Alpine Linux installer media: a small system in memory and a package repository in `/media/cdrom/apks`. No network is needed. Everything you do to the disk is real: after the reboot the media is gone, and the machine either boots from its disk or does not.',
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
    '### Учебный экзамен: сервер базы данных\n\nДиску новой машины `new` нужна такая разметка: GPT; загрузчик GRUB; отдельный `/boot`; всё остальное — группа томов `sys` с томом `root` не меньше 700 МиБ и томом `logs` на 200 МиБ, который в новой системе монтируется в `/var/log` по UUID. Имя машины — `db-01`, у root есть пароль. Засчитывается результат, путь любой; подсказок нет, открыта документация машины: `man`, `--help`. Таймер мягкий: время только записывается.',
    '### Learning exam: a database server\n\nThe new machine `new` needs this disk layout: GPT; the GRUB boot loader; a separate `/boot`; all the rest is the volume group `sys` with a volume `root` of at least 700 MiB and a volume `logs` of 200 MiB, which the new system mounts at `/var/log` by UUID. The machine’s name is `db-01`, and root has a password. The result counts, any path is fine; there are no hints, the machine’s documentation is open: `man`, `--help`. The timer is soft: the time is only recorded.',
  ),
  tasks: [
    {
      id: 'layout',
      weight: 2,
      critical: true,
      prompt: bi('GPT с разделом BIOS boot, отдельным `/boot` и разделом LVM.', 'GPT with a BIOS boot partition, a separate `/boot` and an LVM partition.'),
      check: { when: (f) => blk(f).some((b) => b.parttype === 'BIOS boot') && blk(f).some((b) => b.parttype === 'Linux LVM') && blk(f).some((b) => b.type === 'part' && b.parttype === 'Linux filesystem' && b.fstype === 'ext4') },
    },
    {
      id: 'volumes',
      weight: 2,
      prompt: bi('Группа `sys`: том `root` от 700 МиБ и том `logs` на 200 МиБ, оба с файловой системой.', 'The group `sys`: a volume `root` from 700 MiB and a volume `logs` of 200 MiB, both with a file system.'),
      check: { when: (f) => (part(f, 'sys-root')?.size ?? 0) >= 700 * 1048576 && Math.abs((part(f, 'sys-logs')?.size ?? 0) - 200 * 1048576) <= 8 * 1048576 && !!part(f, 'sys-root')?.fstype && !!part(f, 'sys-logs')?.fstype },
    },
    {
      id: 'root',
      weight: 2,
      critical: true,
      prompt: bi('Система установлена на `sys/root` с GRUB, имя `db-01`, у root есть пароль.', 'The system is installed on `sys/root` with GRUB, the name is `db-01`, root has a password.'),
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
      prompt: bi('Машина загружается со своего диска: `db-01 login:`.', 'The machine boots from its own disk: `db-01 login:`.'),
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
      '`df -h /srv/shop` показывает, что раздел почти полон, а `du -sh /srv/shop` насчитывает куда меньше. Найдите процесс, который держит открытым удалённый файл, и запишите его PID в `/root/culprit.txt`.',
      '`df -h /srv/shop` shows the partition almost full, while `du -sh /srv/shop` counts far less. Find the process that holds a deleted file open and write its PID into `/root/culprit.txt`.',
    ),
    check: {
      when: (f) => {
        const pid = text(f, '/root/culprit.txt').trim();
        return /^\d+$/.test(pid) && out(f, 'holders').split('\n').map((x) => x.trim()).includes(pid);
      },
      fail: [{ if: (f) => text(f, '/root/culprit.txt').trim() === '1', say: bi('PID 1 — это init, а его `/dev/console (deleted)` места не занимает: это устройство, а не файл на разделе. Ищите строку с `/srv/shop`.', 'PID 1 is init, and its `/dev/console (deleted)` takes no space: it is a device, not a file on the partition. Look for the line with `/srv/shop`.') }],
    },
    chips: 'lsof +L1',
    docRef: { url: 'https://lsof.readthedocs.io/en/latest/manpage/', label: 'lsof(8) · +L' },
    hints: {
      H1: bi('`lsof +L1` показывает открытые файлы, у которых не осталось ни одного имени: колонка NLINK — 0, в конце пометка `(deleted)`. Строки init с `/dev/console` не в счёт; тот же файл может держать и дочерний процесс агента, `sleep`, — он унаследовал дескриптор.', '`lsof +L1` shows open files with no name left: the NLINK column is 0, and `(deleted)` is at the end. The init lines with `/dev/console` do not count; the agent’s child, `sleep`, may hold the same file too — it inherited the descriptor.'),
      H2: bi('Без lsof то же видно в `/proc`: `ls -l /proc/*/fd 2>/dev/null | grep deleted`.', 'Without lsof the same shows in `/proc`: `ls -l /proc/*/fd 2>/dev/null | grep deleted`.'),
    },
  },
  {
    id: 'free',
    on: 'app',
    prompt: bi(
      'Верните место: на `/srv/shop` должно быть свободно не меньше 60 МиБ. Заказы в `orders/` трогать нельзя, `legacy-agent` и `orders-app` должны продолжать работать. Кэш сборки удалять можно.',
      'Get the space back: `/srv/shop` must have at least 60 MiB free. The orders in `orders/` must not be touched, and `legacy-agent` and `orders-app` must keep running. The build cache may be deleted.',
    ),
    check: {
      when: (f) => num(f, 'free') >= 60 * MiB && ordersIntact(f) && agentAlive(f) && ok(f, 'app'),
      fail: [
        { if: (f) => !agentAlive(f), say: bi('Агент остановлен. Его место вернулось, но отчётность осталась без агента: файл можно обрезать через дескриптор процесса, не останавливая его.', 'The agent is stopped. Its space came back, but reporting lost the agent: the file can be truncated through the process’s descriptor without stopping it.') },
        { if: (f) => !ordersIntact(f), say: bi('Заказов в `orders/` стало меньше: так место освобождать нельзя.', 'There are fewer orders in `orders/`: that is not a way to free space.') },
        { if: (f) => num(f, 'free') >= 30 * MiB && num(f, 'free') < 60 * MiB, say: bi('Кэш удалён, но этого мало: основное место держит удалённый журнал агента.', 'The cache is gone, but that is not enough: the agent’s deleted log holds most of the space.') },
      ],
    },
    chips: ': > /proc/PID/fd/3',
    docRef: { url: 'https://man7.org/linux/man-pages/man5/proc_pid_fd.5.html', label: 'proc_pid_fd(5)' },
    hints: {
      H1: bi('Удалённый файл живёт, пока открыт. `/proc/PID/fd/N` — путь к нему через дескриптор: записать туда пустоту — значит обрезать файл до нуля.', 'A deleted file lives while it is open. `/proc/PID/fd/N` is a path to it through the descriptor: writing nothing there truncates the file to zero.'),
      H2: bi('Номер дескриптора — колонка FD у `lsof +L1` (`3w` значит дескриптор 3, открыт на запись).', 'The descriptor number is the FD column of `lsof +L1` (`3w` means descriptor 3, open for writing).'),
    },
  },
  {
    id: 'grow',
    on: 'app',
    prompt: bi(
      'Чтобы запас был на будущее, увеличьте том `data/shop` и его файловую систему до 220 МиБ или больше — не отмонтируя `/srv/shop`. В группе `data` есть свободное место.',
      'For room in the future, grow the volume `data/shop` and its file system to 220 MiB or more — without unmounting `/srv/shop`. The group `data` has free space.',
    ),
    check: {
      // ext4 keeps about 5% of a small volume for its own tables: a 220 MiB volume gives a file system of about 200 MiB.
      when: (f) => (part(f, 'data-shop')?.size ?? 0) >= 220 * 1048576 && num(f, 'size') >= 190 * MiB && ordersIntact(f),
      fail: [{ if: (f) => (part(f, 'data-shop')?.size ?? 0) >= 220 * 1048576 && num(f, 'size') < 190 * MiB, say: bi('Том вырос, а файловая система — нет: `df` видит прежний размер. ext4 нужно растянуть на новый том, и это можно сделать на ходу.', 'The volume grew, but the file system did not: `df` sees the old size. ext4 must be stretched over the new volume, and that can be done live.') }],
    },
    chips: 'lvextend -r -L 220M data/shop',
    docRef: man('lvextend', 8),
    hints: {
      H1: bi('`lvextend` растит том; ключ `-r` сразу растягивает и файловую систему на нём. Вручную это `resize2fs /dev/data/shop`.', '`lvextend` grows the volume; the `-r` option stretches the file system on it too. By hand it is `resize2fs /dev/data/shop`.'),
      H2: bi('Сколько свободно в группе, показывает `vgs`.', '`vgs` shows how much the group has free.'),
    },
  },
  {
    id: 'reserved',
    on: 'app',
    beyond: true,
    docStep: 4,
    prompt: bi(
      'ext4 по умолчанию держит 5 % блоков в запасе для root — на разделе с данными это пропавшие мегабайты. Уменьшите запас на `/dev/data/shop` до 1 %, не пересоздавая файловую систему. В уроке этого не было: ищите в документации e2fsprogs.',
      'By default ext4 keeps 5% of its blocks in reserve for root — on a data partition those are lost megabytes. Cut the reserve on `/dev/data/shop` to 1% without recreating the file system. The lesson did not show this: look in the e2fsprogs documentation.',
    ),
    check: { when: (f) => num(f, 'reserved') > 0 && num(f, 'reserved') <= 0.011 },
    docRef: man('tune2fs', 8),
    hints: { H1: bi('Утилита, которая меняет настройки уже созданной ext4.', 'The tool that changes the settings of an ext4 that already exists.') },
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
    '### Раздел магазина\n\nНа машине `app` раздел `/srv/shop` — логический том LVM `data/shop` на 120 МиБ, смонтированный по UUID из `/etc/fstab`. На нём заказы, кэш сборки и журналы. Работают две программы: `orders-app` и старый `legacy-agent`. Кто-то уже пытался освободить место командой `rm` — и место не вернулось.',
    '### The shop’s partition\n\nOn the machine `app` the partition `/srv/shop` is the 120 MiB LVM logical volume `data/shop`, mounted by UUID from `/etc/fstab`. It holds the orders, the build cache and the logs. Two programs run: `orders-app` and the old `legacy-agent`. Someone has already tried to free space with `rm` — and the space did not come back.',
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
    '### Учебный экзамен в браузере: раздел заполнен\n\nТот же сюжет, что у экзамена на своей машине, но на настоящем Alpine Linux прямо во вкладке. Мониторинг сообщает: раздел `/srv/shop` на машине `app` почти полон, приложение заказов скоро перестанет писать. Освободите место, не потеряв заказов в `/srv/shop/orders`, найдите, кто продолжает заполнять раздел, и дайте разделу запас. `legacy-agent` ещё нужен отчётности. Подсказок нет, документация машины открыта: `man`, `--help`.',
    '### Learning exam in the browser: the partition is full\n\nThe same story as the exam on your own machine, but on real Alpine Linux right in the tab. Monitoring reports: the partition `/srv/shop` on the machine `app` is almost full, and the orders application will soon stop writing. Free space without losing the orders in `/srv/shop/orders`, find who keeps filling the partition, and give the partition room. The `legacy-agent` is still needed by reporting. There are no hints; the machine’s documentation is open: `man`, `--help`.',
  ),
  tasks: [
    {
      id: 'space',
      on: 'app',
      weight: 35,
      critical: true,
      prompt: bi('Карточка 1. На `/srv/shop` свободно не меньше 60 МиБ, заказы целы, `orders-app` и `legacy-agent` работают.', 'Card 1. `/srv/shop` has at least 60 MiB free, the orders are intact, `orders-app` and `legacy-agent` run.'),
      check: { when: (f) => num(f, 'free') >= 60 * MiB && ordersIntact(f) && agentAlive(f) && ok(f, 'app') },
    },
    {
      id: 'cron',
      on: 'app',
      weight: 20,
      prompt: bi('Карточка 2. Задание, которое пишет дампы в кэш, выключено и не вернётся после перезагрузки.', 'Card 2. The job that writes dumps into the cache is off and will not come back after a reboot.'),
      check: { when: (f) => ok(f, 'app') && num(f, 'cron') === 0 && out(f, 'cron').trim() === '0' },
    },
    {
      id: 'grow',
      on: 'app',
      weight: 30,
      prompt: bi('Карточка 3. Том `data/shop` и его файловая система — от 220 МиБ, без отмонтирования и без потери заказов.', 'Card 3. The volume `data/shop` and its file system are 220 MiB or more, without unmounting and without losing orders.'),
      check: { when: (f) => (part(f, 'data-shop')?.size ?? 0) >= 220 * 1048576 && num(f, 'size') >= 190 * MiB && ordersIntact(f) },
    },
    {
      id: 'reserved',
      on: 'app',
      weight: 15,
      beyond: true,
      prompt: bi('Карточка 4. Запас блоков для root на `/dev/data/shop` — не больше 1 %. Как это задать, в курсе не показано.', 'Card 4. The block reserve for root on `/dev/data/shop` is at most 1%. The course did not show how to set it.'),
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
    '### Учебный экзамен в браузере: доступ для новой разработчицы\n\nТот же сюжет, что у экзамена на двух своих машинах, но на настоящем Alpine Linux во вкладке: `laptop` — ноутбук Марии (учётная запись `maria` там есть, ключей нет), `server` — сервер команды с группой `devs` и службой OpenRC `orders`. Марии нужен вход на `server` по ключу, общий каталог `/srv/releases`, где новые файлы сразу принадлежат группе `devs`, и право перезапускать `orders` — и только её. Вход по паролю пора запретить для всех, по SSH пускать только группу `devs`. Вы root на обеих машинах; от имени Марии на ноутбуке — `su - maria`. Подсказок нет, документация машин открыта.',
    '### Learning exam in the browser: access for a new developer\n\nThe same story as the exam on two of your own machines, but on real Alpine Linux in the tab: `laptop` is Maria’s laptop (the account `maria` exists there, with no keys), `server` is the team’s server with the group `devs` and the OpenRC service `orders`. Maria needs a key login to `server`, a shared directory `/srv/releases` where new files belong to the group `devs` right away, and the right to restart `orders` — that one only. Password logins must be switched off for everyone, and SSH must let in only the group `devs`. You are root on both machines; as Maria on the laptop — `su - maria`. There are no hints; the machines’ documentation is open.',
  ),
  tasks: [
    {
      id: 'login',
      on: 'laptop',
      weight: 20,
      critical: true,
      prompt: bi('Карточка 1. На `server` есть `maria` с `/bin/bash` в группе `devs`, и с `laptop` она входит туда по ключу без вопросов.', 'Card 1. `server` has `maria` with `/bin/bash` in the group `devs`, and she logs in there from `laptop` with a key, with no questions.'),
      check: { when: "reach['keyin'].exit=0 && files['/home/maria/.ssh/known_hosts'].exists=true" },
    },
    {
      id: 'account',
      on: 'server',
      weight: 10,
      prompt: bi('`maria` на `server`: оболочка `/bin/bash`, группа `devs`, `~/.ssh` закрыт от остальных.', '`maria` on `server`: the shell `/bin/bash`, the group `devs`, `~/.ssh` closed to others.'),
      check: { when: "users[name=maria].shell='/bin/bash' && groups[name=devs].members has maria && files['/home/maria/.ssh'].owner=maria && files['/home/maria/.ssh'].mode=~'00$'" },
    },
    {
      id: 'releases',
      on: 'server',
      weight: 20,
      prompt: bi('Карточка 2. `/srv/releases`: группа `devs` читает и пишет, остальные — нет, новые файлы наследуют группу.', 'Card 2. `/srv/releases`: the group `devs` reads and writes, others do not, new files inherit the group.'),
      check: { when: "files['/srv/releases'].type=d && files['/srv/releases'].group=devs && files['/srv/releases'].mode=~'^2[0-7]70$'" },
    },
    {
      id: 'sudo',
      on: 'server',
      weight: 20,
      critical: true,
      prompt: bi('Карточка 3. `maria` может без пароля выполнить `rc-service orders restart` через sudo — и больше ничего от имени root.', 'Card 3. `maria` may run `rc-service orders restart` through sudo without a password — and nothing else as root.'),
      check: { when: (f) => /NOPASSWD:\s*\/sbin\/rc-service orders restart\s*$/m.test(out(f, 'sudo')) && !/\)\s*(NOPASSWD:\s*)?ALL\s*$/m.test(out(f, 'sudo')) && ok(f, 'visudo') },
    },
    {
      id: 'nopass',
      on: 'server',
      weight: 20,
      prompt: bi('Карточка 4. Итоговые настройки sshd запрещают пароль и вход «с клавиатуры».', 'Card 4. sshd’s effective settings forbid passwords and keyboard-interactive logins.'),
      check: { when: (f) => /^passwordauthentication no$/m.test(out(f, 'sshd')) && /^kbdinteractiveauthentication no$/m.test(out(f, 'sshd')) },
    },
    {
      id: 'offer',
      on: 'laptop',
      weight: 5,
      prompt: bi('`laptop` не видит у `server` способов входа по паролю, а Мария по-прежнему входит.', '`laptop` sees no password methods on `server`, and Maria still gets in.'),
      check: { when: (f) => /Permission denied \(/.test(out(f, 'methods')) && !/password|keyboard-interactive/.test(out(f, 'methods')) && ok(f, 'keyin') },
    },
    {
      id: 'allowgroups',
      on: 'server',
      weight: 5,
      beyond: true,
      prompt: bi('Карточка 5. По SSH на `server` пускаются только члены группы `devs`. Директива — в `man sshd_config`.', 'Card 5. SSH on `server` lets in only members of the group `devs`. The directive is in `man sshd_config`.'),
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
