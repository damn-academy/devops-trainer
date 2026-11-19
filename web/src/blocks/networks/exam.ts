// The block exam of Networks (03 §17, part A): "the network of a small
// company" in the simulator. One router `gw` between the office
// (10.20.0.0/24), the server room (10.20.1.0/27) and the provider. The learner
// builds the network up task by task, then gets two planted faults (one from
// each pool) and three tasks at the ladder's fifth step: flags and commands the
// course never showed, with only the official documentation open and the AI off.
// Every task is checked by facts: probes run on a copy of the network, the
// state of gw, files the learner writes.

import { bi } from '../../core/i18n';
import type { Exam, Facts, TerminalSetup } from '../../core/types';
import type { OfficeOpts } from '../../engine/sim-net/presets';
import type { Probe, ProbeResult } from '../../engine/sim-net/state';

const office = (opts: OfficeOpts, probes: Probe[], prime?: { icmp: string }[]): TerminalSetup => ({
  user: 'root',
  hostname: 'gw',
  ext: { net: { preset: 'office', opts, probes, prime } },
});

type NetFacts = {
  sysctl: Record<string, number>;
  iptables: { filter: string; nat: string };
  ifaces: { name: string; mtu: number }[];
  neigh: { ip: string; mac: string; state: string }[];
  routes: { dst: string; gateway: string }[];
};

const reach = (f: Facts) => (f.reach ?? {}) as Record<string, ProbeResult>;
const net = (f: Facts) => f.net as NetFacts;
const text = (f: Facts, path: string) => ((f.files as Record<string, { text?: string }>)[path]?.text ?? '') as string;
const ok = (r: ProbeResult | undefined) => r?.status === 200;
const layer = (f: Facts) => text(f, '/root/layer.txt').toUpperCase();
const policyDrop = (f: Facts) => /-P FORWARD DROP/.test(net(f).iptables.filter);

/** Probes the firewall task (and the faults planted on the finished network) are judged by. */
const OUT: Probe = { id: 'out', kind: 'http', from: 'laptop', to: 'http://198.51.100.80/' };
const PUB: Probe = { id: 'pub', kind: 'http', from: 'ext', to: 'https://www.corp.lab/' };
const PORTAL: Probe = { id: 'portal', kind: 'http', from: 'laptop', to: 'https://www.corp.lab/' };
const BYPASS: Probe = { id: 'bypass', kind: 'tcp', from: 'laptop', to: '10.20.1.10', port: 8080 };

const LAYERS = bi('Определите уровень поломки, запишите его в `~/layer.txt` (одно из значений L2, L3, L4, DNS, TLS или L7) и устраните поломку.', 'Write the layer into `~/layer.txt` (one of L2, L3, L4, DNS, TLS, L7) and fix it.');

export const exam: Exam = {
  id: 'networks.exam.office',
  block: 'networks',
  title: bi('Сеть маленькой компании', 'The network of a small company'),
  intro: bi(
    'Вы единственный инженер небольшой компании, и в вашем распоряжении один маршрутизатор `gw`. К его интерфейсу `eth0` подключён офис `10.20.0.0/24`, к `eth1` серверная `10.20.1.0/27` с сервером DNS `ns` (`10.20.1.2`) и порталом `app` (`10.20.1.10`, HTTPS на порту 443 и внутренний сервер приложения на порту 8080), а к `eth2` провайдер (`203.0.113.10/24`, шлюз `203.0.113.1`). Каждое задание начинается на своей копии сети. Проверяются состояние сети и ответы на проверочные запросы с других машин, а не набранные вами команды. Открыта только документация, то есть `man`, `--help`, nginx.org и RFC, а наставник выключен.',
    'You are the only engineer of a small company. You have one router, `gw`: `eth0` faces the office `10.20.0.0/24`, `eth1` the server room `10.20.1.0/27` with the DNS server `ns` (`10.20.1.2`) and the portal `app` (`10.20.1.10`, HTTPS on 443, an internal backend on 8080), `eth2` the provider (`203.0.113.10/24`, gateway `203.0.113.1`). Each task starts on its own copy of the network. What is checked is the state of the network and probes from other machines, not the commands you type. Only documentation is open: `man`, `--help`, nginx.org and the RFCs; the mentor is off.',
  ),
  story: bi(
    'Компания переезжает в новый офис. Монтажники проложили кабели и подключили `gw`, но ничего не настроили. К понедельнику офис должен видеть серверную и интернет, портал должен открываться снаружи, а всё лишнее должно быть закрыто. После этого начнут приходить первые заявки.',
    'The company is moving into a new office. The installers have run the cables and connected `gw`, but configured nothing. By Monday the office must see the server room and the internet, the portal must open from outside, and everything else must be closed. Then the first tickets will come.',
  ),
  minutes: 90,
  pass: 0.75,
  allowedDocs: ['man', 'help', 'nginx.org', 'rfc'],
  tasks: [
    {
      id: 'plan',
      weight: 1,
      kind: 'quiz',
      item: {
        id: 'networks.exam.q.plan',
        kind: 'mcq',
        concepts: ['net.cidr', 'net.subnet'],
        prompt: bi(
          'Провайдер выделил компании внутренний блок `10.20.0.0/22`. В офисе будет до 200 устройств, а в серверной до 20. Какой план адресации подойдёт?',
          'The company uses the internal block `10.20.0.0/22`. The office will have up to 200 devices, the server room up to 20. Which addressing plan works?',
        ),
        options: [
          { id: 'ok', text: bi('офис `10.20.0.0/24`, серверная `10.20.1.0/27`', 'office `10.20.0.0/24`, server room `10.20.1.0/27`'), correct: true },
          { id: 'small', text: bi('офис `10.20.0.0/25`, серверная `10.20.0.128/27`', 'office `10.20.0.0/25`, server room `10.20.0.128/27`'), why: bi('В подсети /25 только 126 адресов для машин, и двести устройств в ней не поместятся.', 'A /25 has only 126 host addresses — two hundred devices will not fit.') },
          { id: 'overlap', text: bi('офис `10.20.0.0/24`, серверная `10.20.0.192/27`', 'office `10.20.0.0/24`, server room `10.20.0.192/27`'), why: bi('Подсеть `10.20.0.192/27` лежит внутри `10.20.0.0/24`. Подсети пересекаются, и маршрутизатор не поймёт, в какую сторону отправлять пакет.', '`10.20.0.192/27` lies inside `10.20.0.0/24`: the subnets overlap, and the router cannot tell which way to send a packet.') },
          { id: 'outside', text: bi('офис `10.20.0.0/24`, серверная `10.20.4.0/27`', 'office `10.20.0.0/24`, server room `10.20.4.0/27`'), why: bi('Блок `/22`, начинающийся с `10.20.0.0`, заканчивается на `10.20.3.255`, а `10.20.4.0` уже относится к чужому блоку.', 'The `/22` from `10.20.0.0` ends at `10.20.3.255`; `10.20.4.0` belongs to someone else.') },
        ],
        explain: bi('Двумстам машинам нужна подсеть не меньше /24, в которой 254 адреса, а двадцати машинам хватит /27, где 30 адресов. Обе подсети должны лежать внутри /22 и не пересекаться, и так устроена сеть, на которой проходит экзамен.', 'Two hundred hosts need at least a /24 (254 addresses), twenty need a /27 (30 addresses). Both subnets must lie inside the /22 and must not overlap — this is the network the exam runs on.'),
      },
    },
    {
      id: 'forward',
      weight: 1,
      critical: true,
      kind: 'task',
      setup: office({}, [{ id: 'srv', kind: 'icmp', from: 'laptop', to: '10.20.1.10', count: 3 }]),
      task: {
        id: 'forward',
        prompt: bi('Заявка 1: «С ноутбука `ping 10.20.1.10` не получает ответа». Адреса и маршруты на машинах настроены верно. Сделайте так, чтобы офис и серверная видели друг друга через `gw`.', 'Ticket 1. “`ping 10.20.1.10` from a laptop gets no answer.” Addresses and routes on the machines are correct. Make the office and the server room see each other through `gw`.'),
        check: { when: (f) => (reach(f).srv?.received ?? 0) >= 2 },
      },
    },
    {
      id: 'internet',
      weight: 1,
      kind: 'task',
      setup: office({ forward: true }, [OUT, { id: 'srvout', kind: 'http', from: 'app', to: 'http://198.51.100.80/' }]),
      task: {
        id: 'internet',
        prompt: bi('Заявка 2. Обеим внутренним сетям нужен выход в интернет: и с ноутбука, и с `app` должен открываться `http://198.51.100.80/`. Внутренние адреса провайдер не маршрутизирует.', 'Ticket 2. Both internal networks need the internet: `http://198.51.100.80/` must open from a laptop and from `app`. The provider does not route internal addresses.'),
        check: {
          when: (f) => ok(reach(f).out) && ok(reach(f).srvout),
          fail: [{ if: (f) => ok(reach(f).out) && !ok(reach(f).srvout), say: bi('Ноутбуки выходят в интернет, а серверная нет. Подмена адреса должна действовать для обеих внутренних сетей.', 'The laptops get out but the server room does not: the address rewrite must cover both internal networks.') }],
        },
      },
    },
    {
      id: 'publish',
      weight: 1,
      kind: 'task',
      setup: office({ forward: true, masq: true }, [PUB]),
      task: {
        id: 'publish',
        prompt: bi('Заявка 3. Портал должен открываться из интернета. Имя `https://www.corp.lab/` указывает на внешний адрес `gw` `203.0.113.10`, а сам портал работает на `app:443`.', 'Ticket 3. The portal must open from the internet: `https://www.corp.lab/` points to the external address of `gw`, `203.0.113.10`, and the portal itself lives on `app:443`.'),
        check: {
          when: (f) => ok(reach(f).pub),
          fail: [{ if: (f) => reach(f).pub?.error === 'refused', say: bi('Соединение отвергнуто, значит, пакет дошёл, но порт назначения указан не тот. Портал слушает порт 443.', 'The connection is refused: the packet arrived, but at the wrong port. The portal listens on 443.') }],
        },
      },
    },
    {
      id: 'firewall',
      weight: 2,
      critical: true,
      kind: 'task',
      setup: office({ forward: true, masq: true, dnat: true }, [
        OUT,
        PUB,
        PORTAL,
        BYPASS,
        { id: 'sshin', kind: 'tcp', from: 'laptop', to: '10.20.0.1', port: 22 },
        { id: 'sshout', kind: 'tcp', from: 'ext', to: '203.0.113.10', port: 22 },
      ]),
      task: {
        id: 'firewall',
        prompt: bi(
          'Заявка 4. Закройте `gw`: поставьте политику DROP в цепочках INPUT и FORWARD и разрешите только нужное. Офис и серверная должны выходить в интернет. Из офиса в серверную разрешены только портал на порту 443 и DNS на `ns`, а из интернета только портал. SSH на сам `gw` должен быть доступен только из офиса, а обход портала через `app:8080` из офиса должен быть закрыт.',
          'Ticket 4. Lock `gw` down: a DROP policy in INPUT and FORWARD, with only what is needed allowed. The office and the server room reach the internet; from the office to the server room only the portal (443) and DNS on `ns`; from the internet only the portal; SSH to `gw` itself only from the office. Going around the portal to `app:8080` from the office must be closed.',
        ),
        check: {
          when: (f) => {
            const r = reach(f);
            const filter = net(f).iptables.filter;
            return /-P INPUT DROP/.test(filter) && policyDrop(f) && ok(r.out) && ok(r.pub) && ok(r.portal) && !!r.sshin?.connected && !r.sshout?.connected && !r.bypass?.connected;
          },
          fail: [
            { if: (f) => policyDrop(f) && !ok(reach(f).out) && !ok(reach(f).portal), say: bi('Запросы уходят, а ответы не возвращаются. Ответному трафику нужно своё разрешение по состоянию соединения в conntrack.', 'Requests leave but answers do not come back: reply traffic needs its own permission — by the connection state in conntrack.') },
            { if: (f) => !!reach(f).sshout?.connected, say: bi('SSH на `gw` открыт из интернета. Разрешите его только из офисной сети.', 'SSH to `gw` is open from the internet. Allow it from the office network only.') },
            { if: (f) => !!reach(f).bypass?.connected, say: bi('Из офиса по-прежнему можно попасть на `app:8080` в обход портала.', 'The office can still reach `app:8080` around the portal.') },
          ],
        },
      },
    },
    {
      id: 'fault-est',
      pool: 'fault-a',
      weight: 2,
      critical: true,
      kind: 'task',
      setup: office({ fault: 'no-est' }, [OUT, PORTAL]),
      task: {
        id: 'fault-est',
        prompt: bi(`Заявка 5. «После ночной правки межсетевого экрана в офисе пропал интернет и не открывается портал. Снаружи портал работает». ${LAYERS.ru}`, `Ticket 5. “Since last night’s firewall change the office has no internet and the portal will not open. From outside the portal works.” ${LAYERS.en}`),
        check: {
          when: (f) => layer(f).includes('L4') && ok(reach(f).out) && ok(reach(f).portal) && policyDrop(f),
          fail: [
            { if: (f) => !policyDrop(f), say: bi('Межсетевой экран не выключают ради одной заявки, поэтому политика цепочки FORWARD должна остаться DROP.', 'A firewall is not switched off for one ticket: the FORWARD policy must stay DROP.') },
            { if: (f) => ok(reach(f).out) && !layer(f).includes('L4'), say: bi('Связь восстановлена, но уровень назван неверно. Маршруты и адреса были в порядке, а ответы отбрасывали правила фильтра, то есть поломка была на уровне L4.', 'Connectivity is back, but the layer is wrong: routes and addresses are fine, the filter rules dropped the replies — that is L4.') },
          ],
        },
      },
    },
    {
      id: 'fault-dnat',
      pool: 'fault-a',
      weight: 2,
      critical: true,
      kind: 'task',
      setup: office({ fault: 'dnat-port' }, [PUB, OUT]),
      task: {
        id: 'fault-dnat',
        prompt: bi(`Заявка 5. «Клиенты пишут: портал не открывается, браузер сразу говорит “соединение отклонено”. Из офиса всё работает». ${LAYERS.ru}`, `Ticket 5. “Customers write that the portal will not open; the browser says ‘connection refused’ at once. Inside the office everything works.” ${LAYERS.en}`),
        check: {
          when: (f) => layer(f).includes('L4') && ok(reach(f).pub) && ok(reach(f).out),
          fail: [{ if: (f) => ok(reach(f).pub) && !layer(f).includes('L4'), say: bi('Портал работает, но уровень назван неверно. Мгновенный отказ означает, что на порту никто не принимает соединения, то есть поломка была на уровне L4.', 'The portal is fixed, but the layer is wrong: an instant refusal means a port nobody listens on — L4.') }],
        },
      },
    },
    {
      id: 'fault-route',
      pool: 'fault-b',
      weight: 2,
      critical: true,
      kind: 'task',
      setup: office({ fault: 'no-route' }, [OUT, { id: 'srvout', kind: 'http', from: 'app', to: 'http://198.51.100.80/' }, PORTAL]),
      task: {
        id: 'fault-route',
        prompt: bi(`Заявка 6. «После перезагрузки \`gw\` интернета нет ни у кого. Портал из офиса открывается». ${LAYERS.ru}`, `Ticket 6. “After \`gw\` was rebooted nobody has internet. The portal opens from the office.” ${LAYERS.en}`),
        check: {
          when: (f) => layer(f).includes('L3') && ok(reach(f).out) && ok(reach(f).srvout),
          fail: [{ if: (f) => ok(reach(f).out) && !layer(f).includes('L3'), say: bi('Интернет вернулся, но уровень назван неверно. У `gw` не было маршрута наружу, то есть поломка была на уровне L3.', 'The internet is back, but the layer is wrong: `gw` had no route out — that is L3.') }],
        },
      },
    },
    {
      id: 'fault-dns',
      pool: 'fault-b',
      weight: 2,
      critical: true,
      kind: 'task',
      setup: office({ fault: 'resolv' }, [{ id: 'name', kind: 'dns', to: 'app' }, OUT]),
      task: {
        id: 'fault-dns',
        prompt: bi(`Заявка 6. «Скрипт проверки на \`gw\` завершается с ошибкой: \`curl http://app:8080/health\` пишет, что не может найти \`app\`. По адресу всё работает». Исправьте поиск имён через DNS, а не через \`/etc/hosts\`. ${LAYERS.ru}`, `Ticket 6. “The health check script on \`gw\` fails: \`curl http://app:8080/health\` says it cannot find \`app\`. By address everything works.” Fix name resolution, not \`/etc/hosts\`. ${LAYERS.en}`),
        check: {
          when: (f) => layer(f).includes('DNS') && (reach(f).name?.answer ?? []).includes('10.20.1.10'),
          fail: [{ if: (f) => (reach(f).name?.answer ?? []).includes('10.20.1.10') && !layer(f).includes('DNS'), say: bi('Имя снова находится, но уровень назван неверно. По адресу всё работало, а не находилось только имя, то есть поломка была в DNS.', 'The name resolves, but the layer is wrong: everything worked by address, the name was not found — that is DNS.') }],
        },
      },
    },
    {
      id: 'dl5-neigh',
      weight: 1,
      beyond: true,
      kind: 'task',
      setup: office({ configured: true }, [], [{ icmp: '203.0.113.1' }]),
      task: {
        id: 'dl5-neigh',
        prompt: bi('Заявка 7. Служба безопасности опасается подмены ARP на внешнем участке сети. Сделайте запись о соседе для шлюза провайдера `203.0.113.1` на `gw` постоянной, с тем MAC-адресом, который сейчас лежит в кэше, и без устаревания.', 'Ticket 7. Security worries about ARP spoofing on the external segment. Make the neighbour entry for the provider’s gateway `203.0.113.1` on `gw` permanent: with the MAC address now in the cache and never going stale.'),
        check: {
          when: (f, start) => {
            const was = start ? net(start).neigh.find((n) => n.ip === '203.0.113.1')?.mac : undefined;
            const now = net(f).neigh.find((n) => n.ip === '203.0.113.1');
            return now?.state === 'PERMANENT' && (!was || now.mac === was);
          },
        },
        docStep: 5,
        solutionTokens: ['nud', 'permanent', 'ip neigh replace', 'ip neigh add'],
      },
    },
    {
      id: 'dl5-mtu',
      weight: 1,
      beyond: true,
      kind: 'task',
      setup: office({ configured: true }, []),
      task: {
        id: 'dl5-mtu',
        prompt: bi('Заявка 8. Провайдер перевёл канал на PPPoE и сообщает, что через него проходят пакеты размером не больше 1492 байт. Настройте это на внешнем интерфейсе `gw`, чтобы большие пакеты не пропадали по дороге.', 'Ticket 8. The provider moved the link to PPPoE and writes: “packets larger than 1492 bytes do not pass through us”. Set this on the external interface of `gw` so that large packets do not vanish on the way.'),
        check: { when: (f) => net(f).ifaces.find((i) => i.name === 'eth2')?.mtu === 1492 },
        docStep: 5,
        solutionTokens: ['mtu', 'ip link set'],
      },
    },
    {
      id: 'dl5-reject',
      weight: 1,
      beyond: true,
      kind: 'task',
      setup: office({ configured: true }, [BYPASS, PORTAL]),
      task: {
        id: 'dl5-reject',
        prompt: bi('Заявка 9. Сотрудники по старой памяти идут на `app:8080` в обход портала и по две минуты ждут, пока браузер не сдастся. Сделайте так, чтобы `gw` отказывал им сразу, сбрасывая соединение TCP, как будто порт закрыт, а не молча отбрасывая пакеты. Портал должен продолжать работать.', 'Ticket 9. Out of habit, staff go to `app:8080` around the portal and wait two minutes for the browser to give up. Make `gw` refuse them at once — with a TCP reset, as if the port were closed, rather than silence. The portal must keep working.'),
        check: {
          when: (f) => /tcp-reset/.test(net(f).iptables.filter) && reach(f).bypass?.error === 'refused' && ok(reach(f).portal),
          fail: [{ if: (f) => reach(f).bypass?.error === 'refused' && !/tcp-reset/.test(net(f).iptables.filter), say: bi('Отказ теперь приходит мгновенно, но это сообщение ICMP «порт недоступен», а просили сбрасывать само соединение TCP.', 'The refusal is instant now, but it is ICMP “port unreachable”. A reset of the TCP connection itself was asked for.') }],
        },
        docStep: 5,
        solutionTokens: ['--reject-with', 'tcp-reset', 'REJECT'],
      },
    },
    {
      id: 'who',
      weight: 1,
      kind: 'quiz',
      item: {
        id: 'networks.exam.q.symptoms',
        kind: 'match',
        concepts: ['net.layers-method'],
        prompt: bi('Сопоставьте каждое сообщение с уровнем, с которого нужно начинать поиск.', 'Match the message with the layer where the search starts.'),
        pairs: [
          { id: 'unreach', left: '`ping: connect: Network is unreachable`', right: bi('L3, потому что у ядра нет маршрута', 'L3: the kernel has no route') },
          { id: 'resolve', left: '`curl: (6) Could not resolve host`', right: bi('DNS', 'DNS') },
          { id: 'refused', left: '`curl: (7) … Connection refused`', right: bi('L4, потому что порт закрыт', 'L4: the port is closed') },
          { id: 'cert', left: '`curl: (60) SSL certificate problem`', right: 'TLS' },
          { id: 'gw', left: '`504 Gateway Time-out`', right: bi('L7, потому что прокси не дождался ответа от upstream', 'L7: the proxy did not get the upstream’s answer in time') },
        ],
      },
    },
  ],
  explain: [
    {
      id: 'url',
      prompt: bi('Расскажите вслух, что происходит, когда вы вводите в браузере `https://shop.example/catalog`.', 'Tell out loud what happens when you type `https://shop.example/catalog` into a browser.'),
      keyPoints: [
        bi('браузер разбирает адрес и проверяет свой кэш', 'Parsing the address and the browser cache'),
        bi('имя превращается в адрес через кэши и резолвер, который обходит иерархию DNS, а TTL задаёт срок хранения ответа', 'DNS: caches, the resolver, the walk through the hierarchy, TTL'),
        bi('ноутбук узнаёт по ARP MAC-адрес шлюза, а роутер подменяет адрес отправителя через NAT', 'ARP for the gateway’s MAC and NAT on the router'),
        bi('проходят рукопожатия TCP и TLS, браузер называет имя сайта в SNI и проверяет сертификат', 'The TCP handshake and TLS with SNI and the certificate check'),
        bi('браузер отправляет запрос HTTP, узел CDN или прокси возвращает ответ, и соединение остаётся открытым для следующих запросов', 'The HTTP request, a CDN or a proxy, the answer and connection reuse'),
      ],
    },
    {
      id: 'arp',
      prompt: bi('Почему кадр с пакетом для сервера в другой стране адресован MAC-адресу вашего роутера, а не сервера?', 'Why is the frame carrying a packet for a server in another country addressed to your router’s MAC, not the server’s?'),
      keyPoints: [
        bi('MAC-адрес действует только внутри одной локальной сети', 'A MAC address means something only inside one local network'),
        bi('Адрес лежит вне своей подсети, поэтому ядро отправляет пакет шлюзу по маршруту по умолчанию', 'The address is outside the subnet — the kernel sends the packet to the gateway by the default route'),
        bi('Каждый маршрутизатор надевает на пакет новый кадр, а IP-адреса остаются прежними', 'Every router puts on a new frame; the IP addresses stay'),
      ],
    },
    {
      id: 'drop',
      prompt: bi('Чем для клиента отличаются правила DROP и REJECT в межсетевом экране и что вы выберете для внутренней сети?', 'How do DROP and REJECT in a firewall differ for the client, and which would you choose inside your own network?'),
      keyPoints: [
        bi('При DROP клиент получает тишину, повторяет SYN и ждёт до конца срока ожидания', 'DROP is silence: the client resends the SYN and waits for a timeout'),
        bi('При REJECT клиент сразу получает ответ: сообщение ICMP или сброс TCP RST', 'REJECT is an instant answer: ICMP or a TCP RST'),
        bi('Снаружи DROP не выдаёт, что машина существует, а внутри сети REJECT экономит время людей', 'Outside, DROP does not reveal the machine; inside, REJECT saves people’s time'),
      ],
    },
  ],
};
