// The Networks exam, part B, in the browser (03 §17, design 00 §6.13): the
// same story and the same tickets as `networks.exam.machines`, on three real
// Linux machines in the tab instead of three cloud VMs. Nothing to order and
// nothing to clean up. One difference, said in the intro: the private link
// between vm1 and vm2 is VLAN 99 on the lab switch instead of a WireGuard
// tunnel (the lab image has the kernel module but not the `wg` tool), and
// building it is the first ticket.
//
// The widget `net.reallab` (Exam.inTab) starts the machines and, on "Check",
// reports every machine's facts to the goals below: lab scopes (net, listen, fw, svc),
// nginx's configuration, two files and the probes between the machines.

import { bi } from '../../../core/i18n';
import type { Exam, Facts, RealGoal } from '../../../core/types';
import { examB } from '../exam-b';
import type { NetLabSpec } from './spec';
import { fileText, hasMasquerade, inputDrop, listen, net, on, reach, rules } from './spec';

const APP_HANDLER = `#!/bin/sh
# The orders application of the lab (dt-track=net-b): GET / at once, GET /report after /etc/dt-stub/delay seconds.
read -r method path proto
while read -r line; do line=$(printf '%s' "$line" | tr -d '\\r'); [ -z "$line" ] && break; done
case "$path" in
  /report*) sleep "$(cat /etc/dt-stub/delay 2>/dev/null || echo 3)"; body='{"report":"ready","host":"'"$(hostname)"'"}' ;;
  /health*) body='{"status":"ok"}' ;;
  *) body='{"service":"orders","status":"ok","host":"'"$(hostname)"'"}' ;;
esac
printf 'HTTP/1.0 200 OK\\r\\nContent-Type: application/json\\r\\nContent-Length: %s\\r\\nConnection: close\\r\\n\\r\\n%s\\n' "$(( \${#body} + 1 ))" "$body"
`;

const EXPORTER_HANDLER = `#!/bin/sh
while read -r line; do line=$(printf '%s' "$line" | tr -d '\\r'); [ -z "$line" ] && break; done
printf 'HTTP/1.0 200 OK\\r\\nContent-Type: text/plain\\r\\nConnection: close\\r\\n\\r\\ndt_stub_up 1\\n'
`;

const service = (name: string, desc: string, args: string) => `cat > /etc/init.d/${name} <<'DT_EOF'
#!/sbin/openrc-run
description="${desc}"
command=/usr/bin/socat
command_args="${args}"
supervisor=supervise-daemon
respawn_delay=3
respawn_max=0
DT_EOF
chmod 0755 /etc/init.d/${name} && rc-update add ${name} default >/dev/null 2>&1 && rc-service ${name} start >/dev/null 2>&1; true`;

const VM2_SETUP = [
  `mkdir -p /etc/dt-stub && echo 3 > /etc/dt-stub/delay && cat > /usr/local/bin/dt-app-handler <<'DT_EOF'\n${APP_HANDLER}DT_EOF\ncat > /usr/local/bin/dt-exporter-handler <<'DT_EOF'\n${EXPORTER_HANDLER}DT_EOF\nchmod 0755 /usr/local/bin/dt-app-handler /usr/local/bin/dt-exporter-handler`,
  `mkdir -p /usr/local/sbin && cat > /usr/local/sbin/dt-stub-delay <<'DT_EOF'\n#!/bin/sh\n# dt-stub-delay SECONDS — how long GET /report of the lab application takes.\n[ -n "\${1:-}" ] || { echo "usage: dt-stub-delay SECONDS (now: $(cat /etc/dt-stub/delay))" >&2; exit 2; }\necho "$1" > /etc/dt-stub/delay && echo "GET /report now takes $1 s"\nDT_EOF\nchmod 0755 /usr/local/sbin/dt-stub-delay`,
  // socat cannot bind 10.99.0.2 before the learner builds the link: the supervisor retries every 3 s.
  service('dt-stub', 'DevOps Trainer lab application (orders)', 'TCP-LISTEN:8080,bind=10.99.0.2,fork,reuseaddr SYSTEM:/usr/local/bin/dt-app-handler'),
  service('dt-exporter', 'DevOps Trainer lab metrics endpoint', 'TCP-LISTEN:9100,fork,reuseaddr SYSTEM:/usr/local/bin/dt-exporter-handler'),
];

const PROBE_SETUP = [
  `mkdir -p /root/ca && cd /root/ca && openssl req -x509 -new -nodes -newkey ec -pkeyopt ec_paramgen_curve:P-256 -keyout ca.key -out ca.crt -days 30 -subj "/CN=DevOps Trainer training CA" >/dev/null 2>&1 && chmod 600 ca.key`,
  `cat > /usr/local/bin/dt-ca-sign <<'DT_EOF'\n#!/bin/sh\n# dt-ca-sign FILE.csr — sign a certificate request with the training CA; writes FILE.crt next to it.\n[ -f "\${1:-}" ] || { echo "usage: dt-ca-sign FILE.csr" >&2; exit 2; }\nopenssl x509 -req -in "$1" -CA /root/ca/ca.crt -CAkey /root/ca/ca.key -CAcreateserial -days 30 -copy_extensions copyall -out "\${1%.csr}.crt" && echo "signed: \${1%.csr}.crt"\nDT_EOF\nchmod 0755 /usr/local/bin/dt-ca-sign`,
  `cat > /etc/nginx/http.d/partner.conf <<'DT_EOF'\n# The payment partner's API: only vm1's address is let in; the answer is the address the request came from.\nserver {\n    listen 8081;\n    location / { allow 10.0.0.11; deny all; default_type text/plain; return 200 "$remote_addr\\n"; }\n}\nDT_EOF\necho '10.0.0.11 www.corp.lab' >> /etc/hosts && rc-service nginx start >/dev/null 2>&1; true`,
];

const TLS = ['--resolve', 'www.corp.lab:443:10.0.0.11', '--cacert', '/root/ca/ca.crt'];

export const examLab: NetLabSpec = {
  id: 'exam-net-b',
  title: bi('Сети на настоящих машинах в браузере', 'Networks on real machines: in the browser'),
  intro: bi(
    'В этой вкладке работают три настоящие машины с Linux. Машины `vm1` и `vm2` подключены к коммутатору транком: VLAN 1 идёт по нему без метки, и в нём у машин адреса 10.0.0.11 и 10.0.0.12, а VLAN 99 идёт с меткой и пока пуст. Машина `probe` с адресом 10.0.0.13 подключена только к VLAN 1. На `probe` уже работают API партнёра на порту 8081 и учебный удостоверяющий центр в `/root/ca` с командой `dt-ca-sign`, а на `vm2` установлено приложение заказов, которое ждёт появления адреса 10.99.0.2, и метрики на порту 9100. После каждого шага нажимайте «Проверить состояние машин».',
    'Three real Linux machines in this tab. `vm1` and `vm2` are on trunk ports of the switch: VLAN 1 untagged (their addresses 10.0.0.11 and 10.0.0.12 are there) and VLAN 99 tagged — empty so far. `probe` (10.0.0.13) is in VLAN 1 only. On `probe` the partner’s API already runs on port 8081, with the training certificate authority in `/root/ca` and the command `dt-ca-sign`; on `vm2` the orders application is installed and waits for the address 10.99.0.2, and the metrics run on port 9100. After each step press “Check the machines”.',
  ),
  machines: [
    { name: 'vm1', ip: '10.0.0.11/24', port: { mode: 'trunk', vlan: 1, vlans: [99] }, role: bi('краевая машина с nginx и выходом к партнёру', 'the edge: nginx, the way out to the partner') },
    { name: 'vm2', ip: '10.0.0.12/24', port: { mode: 'trunk', vlan: 1, vlans: [99] }, role: bi('машина приложения', 'the application machine'), setup: VM2_SETUP },
    { name: 'probe', ip: '10.0.0.13/24', role: bi('внешний мир, партнёр и учебный удостоверяющий центр', 'the outside world, the partner and the training CA'), setup: PROBE_SETUP },
  ],
  nginx: ['vm1'],
  files: { vm1: ['/root/504.txt'], vm2: ['/etc/dt-stub/delay'] },
  capture: true,
  probes: [
    { id: 'tun', kind: 'ping', from: 'vm1', to: '10.99.0.2' },
    { id: 'app', kind: 'http', from: 'vm1', to: 'http://10.99.0.2:8080/' },
    { id: 'exporter', kind: 'tcp', from: 'vm1', to: '10.99.0.2', port: 9100 },
    { id: 'partner', kind: 'http', from: 'vm2', to: 'http://10.0.0.13:8081/' },
    { id: 'portal', kind: 'http', from: 'probe', to: 'https://www.corp.lab/', curl: TLS, timeout: 10 },
    { id: 'report', kind: 'http', from: 'probe', to: 'https://www.corp.lab/report', curl: TLS, timeout: 100 },
    { id: 'plain', kind: 'http', from: 'probe', to: 'http://10.0.0.11/' },
    { id: 'ssh1', kind: 'tcp', from: 'probe', to: '10.0.0.11', port: 22 },
    { id: 'closed1', kind: 'tcp', from: 'probe', to: '10.0.0.11', port: 9100 },
    { id: 'ssh2', kind: 'tcp', from: 'probe', to: '10.0.0.12', port: 22 },
    { id: 'exporter2', kind: 'tcp', from: 'probe', to: '10.0.0.12', port: 9100 },
  ],
  tasks: [],
};

// ── the goals ─────────────────────────────────────────────────────────────

const G = (id: string, label: [string, string], machine: string | undefined, when: RealGoal['check']['when'], fail?: RealGoal['check']['fail']): RealGoal => ({ id, label: bi(label[0], label[1]), on: machine, check: { when, fail } });
const nginxConf = (f: Facts) => ((f as { nginx?: { config: string } }).nginx?.config ?? '');
const nginxOk = (f: Facts) => (f as { nginx?: { ok: boolean } }).nginx?.ok === true;
const vlan99 = (f: Facts, cidr: string) => net(f).addrs.some((a) => a.cidr === cidr && net(f).links.find((l) => l.name === a.dev)?.vlan === 99);
const ok200 = (f: Facts | undefined, id: string) => reach(f, id)?.status === 200;

/** proxy_read_timeout outside every location block (the whole site); nginx's default is 60 s. */
export function siteReadTimeout(conf: string): number {
  const text = conf.replace(/#[^\n]*/g, '');
  let rest = '';
  let depth = 0;
  let inLoc = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{') {
      if (inLoc < 0 && /location\s+[^{;]*$/.test(text.slice(Math.max(0, i - 200), i))) inLoc = depth;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === inLoc) {
        inLoc = -1;
        continue;
      }
    }
    if (inLoc < 0) rest += c;
  }
  const secs = [...rest.matchAll(/proxy_read_timeout\s+(\d+)(ms|s|m)?\s*;/g)].map((m) => Number(m[1]) * (m[2] === 'm' ? 60 : m[2] === 'ms' ? 0.001 : 1));
  return secs.length ? Math.max(...secs) : 60;
}

/** A location for /report raises proxy_read_timeout to at least 75 s. */
export function reportTimeout(conf: string): boolean {
  const re = /location\s+[^{]*report[^{]*\{([^}]*)\}/g;
  return [...conf.replace(/#[^\n]*/g, '').matchAll(re)].some((m) => [...m[1].matchAll(/proxy_read_timeout\s+(\d+)(m|s)?\s*;/g)].some((x) => Number(x[1]) * (x[2] === 'm' ? 60 : 1) >= 75));
}

export const examBrowser: Exam = {
  id: 'networks.exam.browser',
  block: 'networks',
  title: bi('Сети на настоящих машинах в браузере', 'Networks on real machines — in the browser'),
  intro: bi(
    'Это та же вторая часть экзамена, что и на ваших облачных машинах, но три машины с Linux работают прямо в этой вкладке, и ничего не нужно заказывать, оплачивать и удалять. Засчитывается состояние машин и ответы на проверочные запросы с других машин, а путь к этому состоянию может быть любым. Отличие одно: частная связь между `vm1` и `vm2` построена не туннелем WireGuard, а через VLAN 99 на коммутаторе лаборатории, и проложить её нужно в первой заявке. Открыта только документация, то есть `man`, `--help`, nginx.org и RFC, а на самих машинах есть `man`. Наставник выключен. Машинам нужно около 600 МБ памяти вкладки.',
    'The same second part of the exam as on your cloud machines, but the three Linux machines run right in this tab: nothing to order, pay for or clean up. What counts is the state of the machines and the answers of probes from the other machines; any path to it is fine. One difference: the private link between `vm1` and `vm2` is not a WireGuard tunnel but VLAN 99 on the lab switch, and laying it is the first ticket. Only documentation is open: `man`, `--help`, nginx.org and the RFCs; the machines have `man` themselves. The mentor is off. The machines need about 600 MB of tab memory.',
  ),
  story: examB.story,
  minutes: 150,
  pass: 0.75,
  allowedDocs: ['man', 'help', 'nginx.org', 'rfc'],
  real: {
    track: 'net-b-browser',
    order: bi('Машины запускаются в этой вкладке кнопкой «Запустить машины» и работают, пока открыта страница экзамена.', 'The machines start in this tab with “Start the machines” and run while the exam page is open.'),
    machines: examLab.machines.map((m) => ({ id: m.name, role: m.role, collect: [] })),
  },
  inTab: { widget: 'net.reallab', props: { lab: examLab.id } },
  explain: examB.explain,
  tasks: [
    {
      id: 'link',
      weight: 10,
      kind: 'real',
      real: {
        prompt: bi(
          'Заявка 1. Проложите частную связь: создайте на `vm1` и `vm2` интерфейсы VLAN 99 с адресами 10.99.0.1/24 и 10.99.0.2/24 и включите их. Как только адрес появится, приложение на `vm2` начнёт отвечать на `http://10.99.0.2:8080/`, причём только на этом адресе.',
          'Ticket 1. Lay the private link: on `vm1` and `vm2` bring up VLAN 99 interfaces with 10.99.0.1/24 and 10.99.0.2/24. As soon as the address appears, the application on `vm2` starts answering on `http://10.99.0.2:8080/` — on that address only.',
        ),
        concepts: ['net.vlan', 'net.route-table', 'net.port'],
        goals: [
          G('v1', ['На `vm1` есть интерфейс VLAN 99 с адресом 10.99.0.1/24', '`vm1` has a VLAN 99 interface with 10.99.0.1/24'], 'vm1', (f) => vlan99(f, '10.99.0.1/24')),
          G('v2', ['На `vm2` есть интерфейс VLAN 99 с адресом 10.99.0.2/24', '`vm2` has a VLAN 99 interface with 10.99.0.2/24'], 'vm2', (f) => vlan99(f, '10.99.0.2/24')),
          G('ping', ['`vm1` получает ответ на ping до 10.99.0.2 по VLAN 99', '`vm1` pings 10.99.0.2 over VLAN 99'], 'vm1', (f) => !!reach(f, 'tun')?.ok),
          G('app', ['Приложение отвечает машине `vm1` по VLAN 99', 'the application answers `vm1` over VLAN 99'], 'vm1', (f) => ok200(f, 'app')),
          G('bind', ['На `vm2` порт 8080 слушается только на адресе 10.99.0.2', 'on `vm2` port 8080 listens on 10.99.0.2 only'], 'vm2', (f) => {
            const l = listen(f).filter((x) => x.port === 8080);
            return l.length > 0 && l.every((x) => x.addr === '10.99.0.2');
          }),
        ],
      },
    },
    {
      id: 'proxy',
      weight: 20,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Заявка 2. Клиенты открывают `https://www.corp.lab/`, и это имя указывает на `vm1`. Настройте на `vm1` nginx как обратный прокси к `http://10.99.0.2:8080` с сертификатом на имя `www.corp.lab`, подписанным учебным удостоверяющим центром на `probe`; ключ сертификата не должен покидать `vm1`. Запрос на подпись передайте на `probe` по SSH, а для этого положите ключ SSH с `vm1` в `authorized_keys` на `probe` через терминал `probe`. Запросы по обычному HTTP пусть перенаправляются на HTTPS.',
          'Ticket 2. Customers open `https://www.corp.lab/` (the name points to `vm1`). Put nginx on `vm1` as a reverse proxy to `http://10.99.0.2:8080` with a certificate for `www.corp.lab` signed by the training authority on `probe`; the certificate’s key must not leave `vm1`. Send the signing request to `probe` over SSH: put `vm1`’s SSH key into `authorized_keys` on `probe` through its terminal. Plain HTTP should redirect to HTTPS.',
        ),
        concepts: ['net.reverse-proxy', 'net.cert', 'net.ca', 'net.tls'],
        goals: [
          G('conf', ['nginx на `vm1` передаёт запросы на 10.99.0.2:8080, и конфигурация проходит проверку `nginx -t`', 'nginx on `vm1` proxies to 10.99.0.2:8080 and its configuration passes `nginx -t`'], 'vm1', (f) => nginxOk(f) && /proxy_pass\s+http:\/\/10\.99\.0\.2:8080/.test(nginxConf(f))),
          G('portal', ['`probe` открывает `https://www.corp.lab/`, доверяя только учебному удостоверяющему центру', '`probe` opens `https://www.corp.lab/` trusting only the training CA'], 'probe', (f) => ok200(f, 'portal'), [
            { if: (f) => reach(f, 'portal')?.error === 'tls', say: bi('Соединение TLS не установилось, потому что сертификат выписан не на `www.corp.lab` или подписан не учебным центром. Посмотрите на свой сертификат командой `openssl x509 -noout -subject -ext subjectAltName -issuer -in`.', 'TLS failed: the certificate is not for `www.corp.lab` or is not signed by the training CA. Look at `openssl x509 -noout -subject -ext subjectAltName -issuer -in` on your certificate.') },
            { if: (f) => reach(f, 'portal')?.status === 502, say: bi('nginx ответил кодом 502, потому что не подключился к серверу приложения. Проверьте, отвечает ли `curl http://10.99.0.2:8080/` на самой `vm1`.', '502: nginx could not reach the backend. Does `curl http://10.99.0.2:8080/` answer on `vm1` itself?') },
          ]),
          G('redirect', ['Запрос `http://` на `vm1` перенаправляется на HTTPS', '`http://` on `vm1` redirects to HTTPS'], 'probe', (f) => [301, 302, 307, 308].includes(reach(f, 'plain')?.status ?? 0)),
        ],
      },
    },
    {
      id: 'firewall',
      weight: 20,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Заявка 3. Закройте обе машины, поставив на входе политику DROP. Снаружи, то есть из VLAN 1, на `vm1` должны быть открыты только SSH, HTTP и HTTPS, а на `vm2` только SSH. Метрики `vm2` на порту 9100 снаружи должны быть закрыты, но доступны с `vm1` по VLAN 99. Сначала разрешите SSH, а потом меняйте политику.',
          'Ticket 3. Lock both machines down: a DROP policy on input. From outside, from VLAN 1, `vm1` has only SSH, HTTP and HTTPS open, `vm2` only SSH. `vm2`’s metrics on port 9100 are closed from outside and reachable from `vm1` over VLAN 99. Allow SSH first, then change the policy.',
        ),
        concepts: ['net.netfilter', 'net.conntrack', 'net.port'],
        goals: [
          G('drop1', ['На `vm1` политика входящего трафика равна DROP', '`vm1` has an input DROP policy'], 'vm1', (f) => inputDrop(f)),
          G('drop2', ['На `vm2` политика входящего трафика равна DROP', '`vm2` has an input DROP policy'], 'vm2', (f) => inputDrop(f)),
          G('closed1', ['Закрытый порт `vm1` молчит, а не отвечает отказом', 'a closed port of `vm1` stays silent instead of refusing'], 'probe', (f) => reach(f, 'closed1')?.error === 'timeout'),
          G('open1', ['SSH и HTTPS на `vm1` открыты снаружи', 'SSH and HTTPS on `vm1` are open from outside'], 'probe', (f) => !!reach(f, 'ssh1')?.connected && ok200(f, 'portal')),
          G('ssh2', ['SSH на `vm2` открыт снаружи', 'SSH on `vm2` is open from outside'], 'probe', (f) => !!reach(f, 'ssh2')?.connected),
          G('exp-out', ['Метрики `vm2` снаружи закрыты', '`vm2`’s metrics are closed from outside'], 'probe', (f) => reach(f, 'exporter2')?.connected === false, [{ if: (f) => !!reach(f, 'exporter2')?.connected, say: bi('Порт 9100 на `vm2` отвечает машине `probe`, а правило для метрик должно проверять входной интерфейс.', 'Port 9100 on `vm2` answers `probe`: the rule for the metrics must look at the input interface.') }]),
          G('exp-in', ['Метрики `vm2` доступны с `vm1` по VLAN 99', '`vm2`’s metrics are reachable from `vm1` over VLAN 99'], 'vm1', (f) => !!reach(f, 'exporter')?.connected),
          G('link', ['Связь по VLAN 99 продолжает работать после включения межсетевого экрана', 'the VLAN 99 link survived the firewall'], 'vm1', (f) => !!reach(f, 'tun')?.ok && ok200(f, 'app')),
        ],
      },
    },
    {
      id: 'egress',
      weight: 20,
      kind: 'real',
      real: {
        prompt: bi(
          'Заявка 4. Приложению на `vm2` нужен API партнёра `http://10.0.0.13:8081/`, а партнёр пускает только адрес `vm1`. Отправьте трафик `vm2` к партнёру через VLAN 99 и `vm1` так, чтобы партнёр видел адрес `vm1`. API отвечает тем адресом, с которого пришёл запрос.',
          'Ticket 4. The application on `vm2` needs the partner’s API `http://10.0.0.13:8081/`, and the partner lets in only `vm1`’s address. Send `vm2`’s traffic to the partner over VLAN 99 and `vm1` so that the partner sees `vm1`’s address. The API answers with the address the request came from.',
        ),
        concepts: ['net.nat', 'net.route-table', 'net.gateway'],
        goals: [
          G('forward', ['`vm1` пересылает пакеты', '`vm1` forwards packets'], 'vm1', (f) => net(f).forward === 1),
          G('masq', ['На `vm1` есть правило подмены адреса отправителя', '`vm1` has a source address rewrite'], 'vm1', (f) => hasMasquerade(f)),
          G('seen', ['Партнёр видит запрос от `vm2` с адресом `vm1`', 'the partner sees `vm2`’s request from `vm1`’s address'], undefined, (f) => {
            const p = reach(on(f, 'vm2'), 'partner');
            return !!p && p.status === 200 && (p.body ?? '').trim() === '10.0.0.11';
          }, [
            { if: (f) => !net(on(f, 'vm2')).routes.some((r) => /^10\.0\.0\.13(\/32)?$/.test(r.dst) && r.via === '10.99.0.1'), say: bi('Запрос уходит с `vm2` напрямую, мимо `vm1`, поэтому партнёр видит адрес самой `vm2` и отказывает. Проверьте, куда ведёт маршрут к 10.0.0.13 на `vm2`.', 'The request leaves `vm2` directly, around `vm1`: the partner sees `vm2`’s own address and refuses. Where does `vm2`’s route to 10.0.0.13 lead?') },
            { if: (f) => reach(on(f, 'vm2'), 'partner')?.status === 403, say: bi('Партнёр ответил кодом 403. Значит, пакет дошёл через `vm1`, но адрес отправителя не подменён на выходе.', 'The partner answered 403: the packet came through `vm1`, but its source was not rewritten on the way out.') },
          ]),
        ],
      },
    },
    {
      id: 'fault504',
      weight: 15,
      kind: 'real',
      real: {
        prompt: bi(
          'Заявка 5. Включите поломку: выполните на `vm2` команду `dt-stub-delay 70`, и месячный отчёт будет считаться 70 секунд. Откройте с `probe` страницу `https://www.corp.lab/report` и дождитесь ошибки. Найдите в журнале nginx строку об этой ошибке и запишите её в `/root/504.txt` на `vm1`. Затем исправьте настройку так, чтобы отчёт открывался, а остальные пути сайта не ждали дольше прежнего. Проверка ждёт отчёт до 100 секунд.',
          'Ticket 5. Switch the fault on: run `dt-stub-delay 70` on `vm2` — the monthly report now takes 70 seconds. Open `https://www.corp.lab/report` from `probe` and wait for the error. Find nginx’s log line about it and put it into `/root/504.txt` on `vm1`. Fix it so that the report opens and the other paths of the site wait no longer than before. The check waits for the report for up to 100 seconds.',
        ),
        concepts: ['net.reverse-proxy', 'net.upstream', 'net.status'],
        goals: [
          G('fault', ['Поломка включена, и отчёт задерживается на 70 секунд', 'the fault is on: the report takes 70 seconds'], 'vm2', (f) => /70/.test(fileText(f, '/etc/dt-stub/delay'))),
          G('evidence', ['В `/root/504.txt` записана строка журнала о том, что сервер приложения не ответил вовремя', '`/root/504.txt` holds the log line about the backend timeout'], 'vm1', (f) => /upstream timed out/.test(fileText(f, '/root/504.txt'))),
          G('local', ['Срок ожидания увеличен только для отчёта', 'the timeout is raised for the report only'], 'vm1', (f) => reportTimeout(nginxConf(f)) && siteReadTimeout(nginxConf(f)) <= 60, [{ if: (f) => siteReadTimeout(nginxConf(f)) > 60, say: bi('Срок ожидания увеличен для всего сайта, и теперь любой зависший путь держит клиента дольше минуты.', 'The timeout is raised for the whole site: now any hanging path holds the customer for longer than a minute.') }]),
          G('report', ['Отчёт открывается с `probe` при задержке в 70 секунд', 'the report opens from `probe` with the 70-second delay'], undefined, (f) => /70/.test(fileText(on(f, 'vm2'), '/etc/dt-stub/delay')) && ok200(on(f, 'probe'), 'report')),
        ],
      },
    },
    {
      id: 'ssh-limit',
      weight: 10,
      beyond: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Заявка 6. В журнале `vm1` тысячи попыток подобрать пароль SSH. Ограничьте средствами межсетевого экрана число новых подключений к SSH с одного адреса, например не больше пяти в минуту. Как записать такое правило, в курсе не показано, поэтому ищите ответ в `man nft` или `man iptables-extensions` на самой машине.',
          'Ticket 6. `vm1`’s log has thousands of SSH password-guessing attempts. Limit the number of new SSH connections from one address with the firewall — say, no more than five a minute. How to write it was not shown in the course: look in `man nft` or `man iptables-extensions` on the machine itself.',
        ),
        concepts: ['net.netfilter'],
        goals: [G('limit', ['На `vm1` частота новых подключений к порту 22 ограничена', 'on `vm1` new connections to port 22 are rate-limited'], 'vm1', (f) => /dport 22\b[^\n]*\b(limit|meter|ct count|update @|add @)|--dport 22\b[^\n]*-m (hashlimit|limit|recent|connlimit)|-m (hashlimit|limit|recent|connlimit)[^\n]*--dport 22\b/.test(rules(f)))],
        solutionTokens: ['limit rate', 'meter', 'hashlimit', 'ct count', '--hitcount'],
      },
    },
  ],
};
