// The Networks exam, part B (03 §17): "on real machines". Three of the
// learner's own VMs in one private network: vm1 at the edge, vm2 with the
// application behind a WireGuard tunnel, probe as the outside world and the
// partner. The learner builds routing over the tunnel, NAT for the partner,
// a reverse proxy with a certificate of the training CA, a DROP firewall on
// both machines, lives through a 504 and cleans up. The trainer runs
// nothing there: the read-only trainer-check-host.sh prints the facts of each
// machine, and the goals below judge them by state, not by commands.

import { bi } from '../../core/i18n';
import type { Exam, Facts, RealGoal } from '../../core/types';
import { CLEANUP_ACCEPT, nginxLocations, nginxSeconds, type ListenFact, type WgFacts } from '../../app/real/facts';
import appScript from './real/net-b-app.sh?raw';
import partnerScript from './real/net-b-partner.sh?raw';
import tunnelScript from './real/net-b-tunnel.sh?raw';

type Probe = { kind: string; ok: boolean; status?: number; connected?: boolean; error?: string; received?: number; body?: string };
type Net = { addrs: string[]; ifaces: { name: string; addrs: string[] }[]; forward: number; listen: ListenFact[]; nft: string; iptables: string; wg: WgFacts };

const reach = (f: Facts, id: string) => ((f.reach ?? {}) as Record<string, Probe>)[id];
const net = (f: Facts) => (f.net ?? { addrs: [], ifaces: [], forward: 0, listen: [], nft: '', iptables: '', wg: { ifaces: [], peers: [] } }) as Net;
const rules = (f: Facts) => `${net(f).nft}\n${net(f).iptables}`;
const nginxConf = (f: Facts) => ((f.nginx ?? { config: '' }) as { config: string }).config;
const text = (f: Facts, p: string) => ((f.files[p] as { text?: string } | undefined)?.text ?? '') as string;
const on = (f: Facts, id: string) => (f as unknown as { machines: Record<string, Facts> }).machines[id];

/** INPUT policy DROP, written with nft or iptables (iptables-nft shows up in both). */
const inputDrop = (f: Facts) => /hook input[^;]*;\s*policy drop/.test(net(f).nft) || /^:INPUT DROP/m.test(net(f).iptables);
const httpOk = (p: Probe | undefined) => !!p && p.status === 200;

const TLS = (vm1: string) => `resolve=www.corp.lab:443:{${vm1}},cacert=/root/ca/ca.crt`;

/** proxy_read_timeout above nginx's 60 s outside every location block: raised for the whole site. */
function globalReadTimeout(conf: string): number {
  let rest = conf.replace(/#[^\n]*/g, '');
  for (const loc of nginxLocations(conf)) rest = rest.replace(loc, '');
  const all = [...rest.matchAll(/proxy_read_timeout\s+([^;]+);/g)].map((m) => nginxSeconds(m[1]));
  return all.length ? Math.max(...all) : 60;
}

const reportTimeout = (conf: string) =>
  nginxLocations(conf).some((loc) => /^location[^{]*report/.test(loc) && [...loc.matchAll(/proxy_read_timeout\s+([^;]+);/g)].some((m) => nginxSeconds(m[1]) >= 75));

const G = (id: string, label: [string, string], machine: string | undefined, when: RealGoal['check']['when'], fail?: RealGoal['check']['fail']): RealGoal => ({ id, label: bi(label[0], label[1]), on: machine, check: { when, fail } });

export const examB: Exam = {
  id: 'networks.exam.machines',
  block: 'networks',
  title: bi('Сети на настоящих машинах', 'Networks on real machines'),
  intro: bi(
    'Вторая часть экзамена блока проходит на трёх ваших виртуальных машинах. Тренажёр там ничего не выполняет. Вы работаете по SSH, после каждого шага запускаете на машине скрипт проверки, который только читает состояние, и вставляете его вывод сюда. Засчитывается состояние машин и ответы на проверочные запросы с других машин, а путь к этому состоянию может быть любым. Открыта только документация, то есть `man`, `--help`, nginx.org и RFC, а наставник выключен. Для среднего и опытного уровня эта часть обязательна, а новичку она будет полезна после блока контейнеров. Если своих машин нет, сдайте [вариант этой части во вкладке](#/exam/networks.exam.browser): три машины с Linux работают прямо в браузере, сюжет и заявки те же, и этот вариант засчитывается вместо экзамена на своих машинах.',
    'The second part of the block exam runs on three of your own virtual machines. The trainer runs nothing there: you work over SSH, and after each step you run the read-only check script on the machine and paste its output here. What counts is the state of the machines and the answers of probes from the other machines; any path to it is fine. Only documentation is open: `man`, `--help`, nginx.org and the RFCs; the mentor is off. For the intermediate and experienced levels this part is required; for a beginner it is worth doing after the containers block. Without machines of your own, take [the variant of this part in the tab](#/exam/networks.exam.browser): three Linux machines run right in the browser, with the same story and tickets, and this variant counts instead of the exam on your own machines.',
  ),
  story: bi(
    'Сервис заказов переезжает на отдельную машину `vm2`, к которой нет доступа снаружи, а с краевой машиной `vm1` её связывает туннель. Клиенты будут открывать `https://www.corp.lab/` через `vm1`. Платёжный партнёр пускает к своему API только адрес `vm1`, а служба безопасности хочет, чтобы снаружи на обеих машинах было открыто только необходимое. Внешний мир и партнёра изображает третья машина, `probe`.',
    'The orders service moves to its own machine, `vm2`, which has no way in from outside: a tunnel links it to the edge machine `vm1`. Customers will use `https://www.corp.lab/` through `vm1`. The payment partner lets only `vm1`’s address into its API, and security wants only what is needed open from outside on both machines. A third machine, `probe`, plays the outside world and the partner.',
  ),
  minutes: 180,
  pass: 0.75,
  allowedDocs: ['man', 'help', 'nginx.org', 'rfc'],
  real: {
    track: 'net-b',
    order: bi(
      'Вам понадобятся три самые маленькие машины (1 vCPU, 1 ГБ памяти) с Debian 12 или Ubuntu 24.04 в одной частной сети, и на каждой должен работать SSH. Поставьте на них метки `trainer=devops` и `dt-track=net-b`, потому что по ним последнее задание проверит уборку. Машины вы заказываете в своём облаке или запускаете на своём компьютере; цену покажет экран провайдера, и обычно это стоимость трёх самых дешёвых машин за три часа. Введите ниже адреса машин в частной сети, и они подставятся в команды.',
      'Three of the smallest machines (1 vCPU, 1 GB of memory) with Debian 12 or Ubuntu 24.04 in one private network, each reachable over SSH. Give them the labels `trainer=devops` and `dt-track=net-b`: the last task checks the cleanup by them. You order the machines in your own cloud or run them on your own computer; the provider’s screen shows the price, usually that of the three cheapest machines for three hours. Type the machines’ private addresses below: they are filled into the commands.',
    ),
    machines: [
      {
        id: 'vm1',
        role: bi('краевая машина с nginx, туннелем и выходом к партнёру', 'the edge: nginx, the tunnel, the way out to the partner'),
        dtlab: 'cp-1',
        collect: ['--scope net', '--scope nginx', '--file /root/504.txt', '--icmp tun,10.99.0.2', '--http app,http://10.99.0.2:8080/', '--tcp exporter,10.99.0.2,9100'],
      },
      {
        id: 'vm2',
        role: bi('машина приложения за туннелем', 'the application machine behind the tunnel'),
        dtlab: 'worker-1',
        collect: ['--scope net', '--file /etc/dt-stub/delay', '--http partner,http://{probe}:8081/'],
      },
      {
        id: 'probe',
        role: bi('внешний мир, партнёр и учебный удостоверяющий центр', 'the outside world, the partner and the training CA'),
        dtlab: 'learner',
        collect: [
          `--http portal,https://www.corp.lab/,${TLS('vm1')}`,
          `--http report,https://www.corp.lab/report,${TLS('vm1')},timeout=100`,
          '--http plain,http://{vm1}/',
          '--tcp ssh1,{vm1},22',
          '--tcp closed1,{vm1},9100',
          '--tcp ssh2,{vm2},22',
          '--tcp exporter2,{vm2},9100',
        ],
      },
    ],
    dtlabUp: 'dtlab up --with learner,kubeadm-nodes',
    prepare: [
      { name: 'net-b-partner.sh', on: 'probe', note: bi('Скрипт запускает API партнёра на порту 8081, учебный удостоверяющий центр в `/root/ca` и команду `dt-ca-sign`, которая подписывает запрос на сертификат.', 'The partner API on port 8081, the training certificate authority in `/root/ca` and the command `dt-ca-sign`, which signs a certificate request.'), text: partnerScript },
      { name: 'net-b-tunnel.sh', on: 'vm1, vm2', note: bi('Скрипт запускает туннель WireGuard 10.99.0.0/24 между `vm1` (10.99.0.1) и `vm2` (10.99.0.2). Туннель работает как провод между машинами, который не зависит от того, что пропускает сеть провайдера. Запустите скрипт на обеих машинах дважды: сначала без аргументов, чтобы получить открытые ключи, а потом с адресом и ключом соседа.', 'The WireGuard tunnel 10.99.0.0/24 between `vm1` (10.99.0.1) and `vm2` (10.99.0.2): a wire between the machines that does not depend on what the provider’s network lets through. Run it twice on both machines: first without arguments to get the public keys, then with the neighbour’s address and key.'), text: tunnelScript },
      { name: 'net-b-app.sh', on: 'vm2', note: bi('Скрипт запускает приложение заказов на `10.99.0.2:8080` (только на адресе туннеля), метрики на порту 9100 всех интерфейсов и команду `dt-stub-delay`, которая замедляет отчёт.', 'The orders application on `10.99.0.2:8080` (on the tunnel address only), metrics on port 9100 of every interface and the command `dt-stub-delay`, which slows the report down.'), text: appScript },
    ],
  },
  explain: [
    {
      id: 'e504',
      prompt: bi('Коллега спрашивает: «Почему клиент получил 504 ровно через минуту, хотя отчёт считается семьдесят секунд, и почему срок ожидания увеличили только для одного `location`?»', 'A colleague asks: “Why did the customer get a 504 after exactly one minute although the report takes seventy seconds, and why was the timeout raised for one `location` only?”'),
      keyPoints: [
        bi('Код 504 отдаёт сам nginx, потому что сервер приложения не ответил за время `proxy_read_timeout`', 'nginx itself returns the 504: the backend did not answer within `proxy_read_timeout`'),
        bi('По умолчанию этот срок равен 60 секундам, отсюда и ровно одна минута', 'that timeout is 60 seconds by default, hence “exactly a minute”'),
        bi('В `error.log` записана строка `upstream timed out` с адресом сервера приложения', '`error.log` has `upstream timed out` with the backend’s address'),
        bi('Длинный срок ожидания для всего сайта скрывает зависания на других путях', 'a long timeout for the whole site hides hangs on every other path'),
      ],
    },
    {
      id: 'enat',
      prompt: bi('Коллега спрашивает: «Как запрос с `vm2` к партнёру оказался с адресом `vm1` и как ответ нашёл дорогу обратно?»', '“How did the request from `vm2` to the partner end up with `vm1`’s address, and how did the answer find its way back?”'),
      keyPoints: [
        bi('На `vm2` маршрут к партнёру ведёт в туннель, к `vm1`', 'on `vm2` the route to the partner leads into the tunnel, to `vm1`'),
        bi('`vm1` пересылает пакеты, потому что на ней включён `ip_forward` и цепочка FORWARD разрешает этот трафик', '`vm1` forwards packets: `ip_forward` is on and FORWARD allows it'),
        bi('На выходе правило MASQUERADE или SNAT подменяет адрес отправителя адресом `vm1`', 'on the way out MASQUERADE or SNAT replaces the source address with `vm1`’s'),
        bi('conntrack помнит соединение и подставляет в ответ настоящий адрес назначения', 'conntrack remembers the connection and gives the answer its real destination back'),
      ],
    },
  ],
  tasks: [
    {
      id: 'tunnel',
      weight: 10,
      kind: 'real',
      real: {
        prompt: bi(
          'Подготовка и заявка 1. Запустите скрипты подготовки на `probe`, затем туннель на `vm1` и `vm2`, а затем приложение на `vm2`. С `vm1` должен открываться `http://10.99.0.2:8080/`, а приложение должно слушать только адрес туннеля.',
          'Preparation and ticket 1. Run the preparation scripts on `probe`, then the tunnel on `vm1` and `vm2`, then the application on `vm2`. `http://10.99.0.2:8080/` must open from `vm1`, and the application must listen on the tunnel address only.',
        ),
        concepts: ['net.route-table', 'net.port'],
        goals: [
          G('wg1', ['На `vm1` есть интерфейс `wg0` с адресом 10.99.0.1/24', '`vm1` has `wg0` with 10.99.0.1/24'], 'vm1', "net.ifaces[name='wg0'].addrs has '10.99.0.1/24'"),
          G('wg2', ['На `vm2` есть интерфейс `wg0` с адресом 10.99.0.2/24', '`vm2` has `wg0` with 10.99.0.2/24'], 'vm2', "net.ifaces[name='wg0'].addrs has '10.99.0.2/24'"),
          G('ping', ['`vm1` получает ответ на ping до 10.99.0.2 через туннель', '`vm1` pings 10.99.0.2 through the tunnel'], 'vm1', "reach['tun'].ok=true", [{ if: "net.wg.peers[handshake=0]", say: bi('Рукопожатия WireGuard не было. Проверьте ключи, адрес соседа и то, что сеть провайдера пропускает UDP на порт 51820.', 'There was no WireGuard handshake: check the keys, the neighbour’s address and that the provider’s network lets UDP 51820 through.') }]),
          G('app', ['Приложение отвечает машине `vm1` через туннель', 'the application answers `vm1` through the tunnel'], 'vm1', "reach['app'].status=200"),
          G('bind', ['На `vm2` порт 8080 слушается только на адресе 10.99.0.2', 'on `vm2` port 8080 listens on 10.99.0.2 only'], 'vm2', (f) => {
            const l = net(f).listen.filter((x) => x.port === 8080);
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
          'Заявка 2. Клиенты открывают `https://www.corp.lab/`, и это имя указывает на `vm1`. Настройте на `vm1` nginx как обратный прокси к `http://10.99.0.2:8080` с сертификатом на имя `www.corp.lab`, подписанным учебным удостоверяющим центром на `probe`; ключ сертификата не должен покидать `vm1`. Запросы по обычному HTTP пусть перенаправляются на HTTPS.',
          'Ticket 2. Customers open `https://www.corp.lab/` (the name points to `vm1`). Put nginx on `vm1` as a reverse proxy to `http://10.99.0.2:8080` with a certificate for `www.corp.lab` signed by the training authority on `probe`; the certificate’s key must not leave `vm1`. Plain HTTP should redirect to HTTPS.',
        ),
        concepts: ['net.reverse-proxy', 'net.cert', 'net.ca', 'net.tls'],
        goals: [
          G('conf', ['nginx на `vm1` передаёт запросы на 10.99.0.2:8080, и конфигурация проходит проверку `nginx -t`', 'nginx on `vm1` proxies to 10.99.0.2:8080 and its configuration passes `nginx -t`'], 'vm1', (f) => ((f.nginx ?? {}) as { ok?: boolean }).ok === true && /proxy_pass\s+http:\/\/10\.99\.0\.2:8080/.test(nginxConf(f))),
          G('portal', ['`probe` открывает `https://www.corp.lab/`, доверяя только учебному удостоверяющему центру', '`probe` opens `https://www.corp.lab/` trusting only the training CA'], 'probe', (f) => httpOk(reach(f, 'portal')), [
            { if: (f) => /certificate|SSL/i.test(reach(f, 'portal')?.error ?? ''), say: bi('Соединение TLS не установилось, потому что сертификат выписан не на `www.corp.lab` или подписан не учебным центром. Посмотрите на свой сертификат командой `openssl x509 -noout -subject -ext subjectAltName -issuer -in`.', 'TLS failed: the certificate is not for `www.corp.lab` or is not signed by the training CA. Look at `openssl x509 -noout -subject -ext subjectAltName -issuer -in` on your certificate.') },
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
          'Заявка 3. Закройте обе машины, поставив на входе политику DROP. Снаружи на `vm1` должны быть открыты только SSH, HTTP, HTTPS и порт туннеля, а на `vm2` только SSH и порт туннеля. Метрики `vm2` на порту 9100 снаружи должны быть закрыты, но доступны с `vm1` через туннель. Сначала разрешите SSH, а потом меняйте политику.',
          'Ticket 3. Lock both machines down: a DROP policy on input. From outside, `vm1` has only SSH, HTTP, HTTPS and the tunnel port open, `vm2` only SSH and the tunnel port. `vm2`’s metrics on port 9100 are closed from outside and reachable from `vm1` through the tunnel. Allow SSH first, then change the policy.',
        ),
        concepts: ['net.netfilter', 'net.conntrack', 'net.port'],
        goals: [
          G('drop1', ['На `vm1` политика входящего трафика равна DROP', '`vm1` has an input DROP policy'], 'vm1', inputDrop),
          G('drop2', ['На `vm2` политика входящего трафика равна DROP', '`vm2` has an input DROP policy'], 'vm2', inputDrop),
          G('closed1', ['Закрытый порт `vm1` молчит, а не отвечает отказом', 'a closed port of `vm1` stays silent instead of refusing'], 'probe', "reach['closed1'].error=timeout"),
          G('open1', ['SSH и HTTPS на `vm1` открыты снаружи', 'SSH and HTTPS on `vm1` are open from outside'], 'probe', (f) => !!reach(f, 'ssh1')?.connected && httpOk(reach(f, 'portal'))),
          G('ssh2', ['SSH на `vm2` открыт снаружи', 'SSH on `vm2` is open from outside'], 'probe', "reach['ssh2'].connected=true"),
          G('exp-out', ['Метрики `vm2` снаружи закрыты', '`vm2`’s metrics are closed from outside'], 'probe', "reach['exporter2'].connected=false", [{ if: "reach['exporter2'].connected=true", say: bi('Порт 9100 на `vm2` отвечает машине `probe`, а правило для метрик должно проверять входной интерфейс.', 'Port 9100 on `vm2` answers `probe`: the rule for the metrics must look at the input interface.') }]),
          G('exp-in', ['Метрики `vm2` доступны с `vm1` через туннель', '`vm2`’s metrics are reachable from `vm1` through the tunnel'], 'vm1', "reach['exporter'].connected=true"),
          G('tun', ['Туннель продолжает работать после включения межсетевого экрана', 'the tunnel survived the firewall'], 'vm1', "reach['tun'].ok=true", [{ if: "reach['tun'].ok=false", say: bi('Туннель перестал работать. Скорее всего, на одной из машин закрыт UDP-порт 51820 или ответам туннеля не хватает правила по состоянию соединения.', 'The tunnel is down: UDP 51820 is closed on one of the machines, or the tunnel’s replies lack a connection-state rule.') }]),
        ],
      },
    },
    {
      id: 'egress',
      weight: 20,
      kind: 'real',
      real: {
        prompt: bi(
          'Заявка 4. Приложению на `vm2` нужен API партнёра `http://probe:8081/`, а партнёр пускает только адрес `vm1`. Отправьте трафик `vm2` к партнёру через туннель и `vm1` так, чтобы партнёр видел адрес `vm1`. API отвечает тем адресом, с которого пришёл запрос.',
          'Ticket 4. The application on `vm2` needs the partner’s API `http://probe:8081/`, and the partner lets in only `vm1`’s address. Send `vm2`’s traffic to the partner through the tunnel and `vm1` so that the partner sees `vm1`’s address. The API answers with the address the request came from.',
        ),
        concepts: ['net.nat', 'net.route-table', 'net.gateway'],
        goals: [
          G('forward', ['`vm1` пересылает пакеты', '`vm1` forwards packets'], 'vm1', 'net.forward=1'),
          G('masq', ['На `vm1` есть правило подмены адреса отправителя', '`vm1` has a source address rewrite'], 'vm1', (f) => /masquerade|snat to|-j (MASQUERADE|SNAT)/i.test(rules(f))),
          G('seen', ['Партнёр видит запрос от `vm2` с адресом `vm1`', 'the partner sees `vm2`’s request from `vm1`’s address'], undefined, (f) => {
            const vm1 = on(f, 'vm1');
            const vm2 = on(f, 'vm2');
            const p = vm2 && reach(vm2, 'partner');
            return !!vm1 && !!p && p.status === 200 && net(vm1).addrs.includes((p.body ?? '').trim());
          }, [
            { if: (f) => { const vm2 = on(f, 'vm2'); return !!vm2 && /^10\.99\./.test((reach(vm2, 'partner')?.body ?? '').trim()); }, say: bi('Партнёр видит адрес туннеля. Значит, пакет дошёл, но адрес отправителя не подменён на выходе из `vm1`.', 'The partner sees the tunnel address: the packet arrived, but its source was not rewritten on the way out of `vm1`.') },
            { if: (f) => { const vm2 = on(f, 'vm2'); const p = vm2 && reach(vm2, 'partner'); return !!vm2 && !!p && p.status === 200 && net(vm2).addrs.includes((p.body ?? '').trim()); }, say: bi('Партнёр видит адрес самой `vm2`, значит, запрос ушёл напрямую, мимо туннеля. Проверьте, куда ведёт маршрут к `probe` на `vm2`.', 'The partner sees `vm2`’s own address: the request went directly, around the tunnel. Where does `vm2`’s route to `probe` lead?') },
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
          'Заявка 5. Включите поломку: выполните на `vm2` команду `sudo dt-stub-delay 70`, и месячный отчёт будет считаться 70 секунд. Откройте `https://www.corp.lab/report` и дождитесь ошибки. Найдите в журнале nginx строку об этой ошибке и запишите её в `/root/504.txt` на `vm1`. Затем исправьте настройку так, чтобы отчёт открывался, а остальные пути сайта не ждали дольше прежнего.',
          'Ticket 5. Switch the fault on: run `sudo dt-stub-delay 70` on `vm2` — the monthly report now takes 70 seconds. Open `https://www.corp.lab/report` and wait for the error. Find nginx’s log line about it and put it into `/root/504.txt` on `vm1`. Fix it so that the report opens and the other paths of the site wait no longer than before.',
        ),
        concepts: ['net.reverse-proxy', 'net.upstream', 'net.status'],
        goals: [
          G('fault', ['Поломка включена, и отчёт задерживается на 70 секунд', 'the fault is on: the report takes 70 seconds'], 'vm2', "files['/etc/dt-stub/delay'].text~'70'"),
          G('evidence', ['В `/root/504.txt` записана строка журнала о том, что сервер приложения не ответил вовремя', '`/root/504.txt` holds the log line about the backend timeout'], 'vm1', (f) => /upstream timed out/.test(text(f, '/root/504.txt'))),
          G('local', ['Срок ожидания увеличен только для отчёта', 'the timeout is raised for the report only'], 'vm1', (f) => reportTimeout(nginxConf(f)) && globalReadTimeout(nginxConf(f)) <= 60, [{ if: (f) => globalReadTimeout(nginxConf(f)) > 60, say: bi('Срок ожидания увеличен для всего сайта, и теперь любой зависший путь держит клиента дольше минуты.', 'The timeout is raised for the whole site: now any hanging path holds the customer for longer than a minute.') }]),
          G('report', ['Отчёт открывается с `probe` при задержке в 70 секунд', 'the report opens from `probe` with the 70-second delay'], undefined, (f) => {
            const vm2 = on(f, 'vm2');
            const probe = on(f, 'probe');
            // The probe's facts must be newer than the ones that show the fault switched on.
            return !!vm2 && !!probe && /70/.test(text(vm2, '/etc/dt-stub/delay')) && probe.env.at > vm2.env.at && httpOk(reach(probe, 'report'));
          }),
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
          'Заявка 6. В журнале `vm1` тысячи попыток подобрать пароль SSH. Ограничьте средствами межсетевого экрана число новых подключений к SSH с одного адреса, например не больше пяти в минуту. Как записать такое правило, в курсе не показано, поэтому ищите ответ в `man nft` или `man iptables-extensions`.',
          'Ticket 6. `vm1`’s log has thousands of SSH password-guessing attempts. Limit the number of new SSH connections from one address with the firewall — say, no more than five a minute. How to write it was not shown in the course: look in `man nft` or `man iptables-extensions`.',
        ),
        concepts: ['net.netfilter'],
        goals: [
          G('limit', ['На `vm1` частота новых подключений к порту 22 ограничена', 'on `vm1` new connections to port 22 are rate-limited'], 'vm1', (f) => /dport 22\b[^\n]*(limit rate|meter|ct count|update @|add @)/.test(net(f).nft) || /--dport 22\b[^\n]*-m (hashlimit|limit|recent|connlimit)|-m (hashlimit|limit|recent|connlimit)[^\n]*--dport 22\b/.test(net(f).iptables)),
        ],
        solutionTokens: ['limit rate', 'meter', 'hashlimit', 'ct count', '--hitcount'],
      },
    },
    {
      id: 'cleanup',
      weight: 5,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi(
          'Уборка. Машины в облаке стоят денег, пока работают, а в лаборатории занимают память и диск, поэтому без уборки экзамен не закрывается. Удалите все три машины и вставьте сюда подтверждение. Если вы работали в лаборатории dtlab, выполните на своём компьютере `dtlab destroy` и вставьте то, что она напечатала. Если машины заказывали через Terraform, вставьте вывод `terraform destroy`, а если заказывали в облаке вручную, вставьте список машин провайдера с меткой `dt-track=net-b` в формате JSON, то есть пустой список `[]`.',
          'Cleanup. Machines in a cloud cost money while they run, and in the lab they take memory and disk, so the exam does not close without cleanup. Delete all three machines and paste the confirmation here. If you worked in the dtlab lab, run `dtlab destroy` on your computer and paste what it printed. If you ordered the machines with Terraform, paste the output of `terraform destroy`; if you ordered them in your cloud by hand, paste the provider’s list of machines with the label `dt-track=net-b` as JSON, that is, an empty list `[]`.',
        ),
        paste: {
          label: bi('Подтверждение уборки', 'The cleanup confirmation'),
          accept: CLEANUP_ACCEPT,
        },
      },
    },
  ],
};
