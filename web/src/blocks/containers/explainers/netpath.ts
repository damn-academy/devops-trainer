// containers.net-path: where a packet from a container or to a container goes.
// Five requests that newcomers mix up: a published port from the host, a
// neighbour by name, "localhost" from inside, the host by host.docker.internal
// and the way out to the internet. Each request is drawn as the path its
// packet takes through the container's veth, the bridge and netfilter.
//
// Reading order: at the start only the participant that sends the request is
// on the picture; the others appear when the packet reaches them.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { fmtb, startWith } from './util';

type P = { request: string; userNet: boolean; netHost: boolean; addHost: boolean; hostLocalOnly: boolean };

const ALL = ['curl', 'hostdb', 'nat', 'internet', 'bridge', 'api', 'web', 'db', 'dns', 'e-curl', 'e-nat', 'e-web', 'e-api', 'e-db', 'e-dns', 'e-out', 'e-gw', 'e-hostlo'];
const BRIDGE0 = 'docker0 · 172.17.0.1';
const BRIDGE_APP = 'br-app · 172.18.0.1';

const reached = (steps: Step[]) => (steps.some((s) => s.broken) ? 'fail' : 'reach');
const REACH = [
  { id: 'reach', text: bi('Да, запрос дойдёт до цели и получит ответ', 'Yes, the request reaches its target and gets an answer') },
  { id: 'fail', text: bi('Нет, запрос остановится по дороге с ошибкой', 'No, the request stops on the way with an error') },
];

export const netPathModel = defineModel<P>({
  id: 'containers.net-path',
  frame: 'visible',
  block: 'containers',
  title: bi('Куда уходит запрос из контейнера и в контейнер', 'Where a request from a container and into a container goes'),
  summary: bi(
    'Схема показывает путь пакета для пяти запросов, которые чаще всего путают: с хоста на опубликованный порт, из контейнера к соседу по имени, из контейнера на localhost, из контейнера к службе хоста и из контейнера в интернет. Подсвечен участник, который работает сейчас, облачко говорит, что он делает, а карточка на линии показывает, куда адресован пакет. Зелёная рамка означает, что запрос дошёл до цели, а красная показывает, где он остановился.',
    'The diagram shows the packet path for the five requests most often mixed up: from the host to a published port, from a container to a neighbour by name, from a container to localhost, from a container to a host service, and from a container to the internet. The participant working now is highlighted, the callout says what it does, and the card on the line shows where the packet is addressed. A green outline means the request reached its target, a red one shows where it stopped.',
  ),
  intro: bi(
    'Сейчас на схеме только тот, кто отправляет первый запрос: curl на хосте. Нажмите «Начать с первого шага» и переходите дальше кнопкой «Шаг вперёд». Участники появляются, когда до них доходит пакет.\n\nПосле первого прохода выберите в «Параметрах» другой запрос и пройдите его так же. У некоторых запросов появятся свои переключатели: сеть, в которой работают контейнеры, флаг `--network host`, флаг `--add-host` и адрес, на котором слушает база хоста.',
    'Now the diagram shows only the sender of the first request: curl on the host. Press “Start from the first step” and go on with “Step forward”. Participants appear when the packet reaches them.\n\nAfter the first pass choose another request in “Parameters” and walk it the same way. Some requests bring their own switches: the network the containers run in, the `--network host` flag, the `--add-host` flag and the address the host database listens on.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: bi('что делает этот участник', 'what this participant does') },
    { mark: 'token', text: bi('куда адресован пакет или что вернулось в ответ', 'where the packet is addressed or what came back') },
    { mark: 'icon:terminal', text: bi('команда на хосте', 'a command on the host') },
    { mark: 'icon:container', text: bi('контейнер со своим пространством имён net', 'a container with its own net namespace') },
    { mark: 'icon:database', text: bi('база данных', 'a database') },
    { mark: 'ok', text: bi('запрос дошёл до цели', 'the request reached its target') },
    { mark: 'err', text: bi('здесь запрос остановился', 'the request stopped here') },
    { mark: 'pale', text: bi('цель, до которой запрос так и не дошёл', 'the target the request never reached') },
  ],
  stopLabel: bi('Запрос остановился', 'The request stopped'),
  concepts: ['docker.network', 'docker.publish'],
  diagram: {
    width: 960,
    height: 560,
    nodes: [
      { id: 'curl', label: 'curl localhost:8080', icon: 'terminal', family: 'user', x: 24, y: 40, w: 216, h: 56, card: { what: bi('Команда на самом хосте, вне всех контейнеров. Для неё localhost означает интерфейс lo хоста.', 'A command on the host itself, outside every container. For it localhost means the host’s lo interface.'), who: bi('Её запускаете вы в терминале сервера.', 'You run it in the server’s terminal.') } },
      { id: 'hostdb', label: bi('База на хосте', 'Database on the host'), icon: 'database', sub: ':5432', family: 'store', x: 24, y: 152, w: 216, h: 56, card: { what: bi('Postgres, установленный в саму систему хоста, без контейнера. Какие адреса он слушает, задаёт параметр listen_addresses, и по умолчанию это только 127.0.0.1.', 'Postgres installed straight on the host, without a container. The listen_addresses setting decides which addresses it listens on, and by default that is only 127.0.0.1.'), who: bi('Его поставил и настроил администратор хоста.', 'The host administrator installed and configured it.'), see: 'ss -tlnp' } },
      { id: 'nat', label: bi('netfilter ядра хоста', 'The host kernel’s netfilter'), sub: 'DNAT · MASQUERADE', family: 'kernel', shape: 'bar', x: 288, y: 40, w: 392, h: 56, card: { what: bi('Правила ядра, которые переписывают адреса пакетов. DNAT меняет адрес назначения для опубликованного порта, а MASQUERADE подменяет адрес отправителя у пакетов, которые контейнеры отправляют наружу.', 'Kernel rules that rewrite packet addresses. DNAT changes the destination address for a published port, and MASQUERADE replaces the source address of packets that containers send out.'), who: bi('Правила записывает dockerd, когда создаёт сеть и публикует порт.', 'dockerd writes the rules when it creates a network and publishes a port.'), see: 'sudo iptables -t nat -L -n' } },
      { id: 'internet', label: bi('Интернет', 'The internet'), icon: 'cloud', sub: 'example.com', family: 'neutral', x: 728, y: 40, w: 208, h: 56, card: { what: bi('Сеть за пределами хоста. Адресов 172.17.0.0/16 она не знает и видит только адрес самого хоста.', 'The network beyond the host. It does not know the 172.17.0.0/16 addresses and sees only the host’s own address.'), who: bi('Ею управляют провайдеры.', 'Providers run it.') } },
      { id: 'bridge', label: bi('Мост сети Docker', 'The Docker network bridge'), icon: 'switch', sub: BRIDGE0, family: 'l2', x: 288, y: 248, w: 392, h: 56, card: { what: bi('Виртуальный коммутатор на хосте. К нему подключены пары veth всех контейнеров сети, а его собственный адрес служит шлюзом этой сети и принадлежит хосту.', 'A virtual switch on the host. The veth pairs of every container of the network are plugged into it, and its own address is the network’s gateway and belongs to the host.'), who: bi('Мост создаёт dockerd: docker0 для сети по умолчанию и отдельный мост для каждой сети из `docker network create`.', 'dockerd creates the bridge: docker0 for the default network and a separate bridge for each network from `docker network create`.'), see: 'ip link show type bridge' } },
      { id: 'api', label: bi('Контейнер api', 'Container api'), icon: 'container', sub: '172.17.0.2', family: 'ns', x: 24, y: 376, w: 240, h: 64, card: { what: bi('Процесс в своём пространстве имён net. У него свои интерфейсы lo и eth0, и localhost внутри означает его собственный lo, а не хост.', 'A process in its own net namespace. It has its own lo and eth0 interfaces, and localhost inside means its own lo, not the host.'), who: bi('Его запустили командой `docker run` или Compose.', 'It was started by `docker run` or Compose.'), see: 'docker exec api ip addr' } },
      { id: 'web', label: bi('Контейнер web', 'Container web'), icon: 'container', sub: '172.17.0.3:80', family: 'ns', x: 360, y: 376, w: 240, h: 64, card: { what: bi('Контейнер с nginx, запущенный с `-p 8080:80`. Внутри nginx слушает порт 80.', 'A container with nginx, started with `-p 8080:80`. Inside, nginx listens on port 80.'), who: bi('Его запустили командой `docker run -d -p 8080:80 nginx:1.30-alpine`.', 'It was started with `docker run -d -p 8080:80 nginx:1.30-alpine`.'), see: 'docker port web' } },
      { id: 'db', label: bi('Контейнер db', 'Container db'), icon: 'database', sub: '172.18.0.3:5432', family: 'ns', x: 696, y: 376, w: 240, h: 64, card: { what: bi('Контейнер с postgres. Порт 5432 у него не опубликован, поэтому снаружи хоста до него не добраться, а соседи по сети подключаются к нему напрямую.', 'A container with postgres. Its port 5432 is not published, so it cannot be reached from outside the host, while its network neighbours connect to it directly.'), who: bi('Его запустили в той же сети, что и api.', 'It was started in the same network as api.') } },
      { id: 'dns', label: bi('DNS Docker', 'Docker DNS'), icon: 'dns', sub: '127.0.0.11', family: 'l7', x: 24, y: 488, w: 240, h: 56, card: { what: bi('Встроенный DNS-сервер, который отвечает на вопросы об именах контейнеров. Он слушает адрес 127.0.0.11 внутри каждого контейнера пользовательской сети, а в сети по умолчанию его нет.', 'The embedded DNS server that answers questions about container names. It listens at 127.0.0.11 inside every container of a user-defined network, and the default network does not have it.'), who: bi('Отвечает на вопросы сам dockerd.', 'dockerd itself answers the questions.'), see: 'docker exec api cat /etc/resolv.conf' } },
    ],
    edges: [
      { id: 'e-curl', from: 'curl', to: 'nat', label: bi('на порт 8080 хоста', 'to host port 8080'), card: { what: bi('Пакет curl адресован хосту, и первым его обрабатывает netfilter.', 'The curl packet is addressed to the host, and netfilter handles it first.'), who: bi('Пакет отправляет curl.', 'curl sends the packet.') } },
      { id: 'e-nat', from: 'nat', to: 'bridge', label: bi('через NAT', 'through NAT'), card: { what: bi('Здесь пакеты меняют адреса: входящие после DNAT идут к контейнеру, исходящие перед MASQUERADE идут от контейнера наружу.', 'Packets change addresses here: incoming ones go to a container after DNAT, outgoing ones go from a container outwards before MASQUERADE.'), who: bi('Правила записал dockerd.', 'dockerd wrote the rules.') } },
      { id: 'e-web', from: 'bridge', to: 'web', label: 'veth web', card: { what: bi('Пара veth соединяет мост с интерфейсом eth0 контейнера web.', 'A veth pair connects the bridge to the eth0 interface of the web container.'), who: bi('Пару создаёт dockerd при запуске контейнера.', 'dockerd creates the pair when the container starts.') } },
      { id: 'e-api', from: 'api', to: 'bridge', label: 'veth api', card: { what: bi('Пара veth соединяет интерфейс eth0 контейнера api с мостом. Через неё уходят все пакеты api, адресованные за пределы его пространства имён.', 'A veth pair connects the eth0 interface of the api container to the bridge. Every api packet addressed outside its namespace leaves through it.'), who: bi('Пару создаёт dockerd при запуске контейнера.', 'dockerd creates the pair when the container starts.') } },
      { id: 'e-db', from: 'bridge', to: 'db', label: 'veth db', card: { what: bi('Пара veth соединяет мост с контейнером db.', 'A veth pair connects the bridge to the db container.'), who: bi('Пару создаёт dockerd при запуске контейнера.', 'dockerd creates the pair when the container starts.') } },
      { id: 'e-dns', from: 'api', to: 'dns', label: bi('вопрос об имени', 'name question'), card: { what: bi('Программа спрашивает адрес имени у сервера из /etc/resolv.conf своего контейнера.', 'The program asks for the address of a name from the server in its container’s /etc/resolv.conf.'), who: bi('Вопрос задаёт библиотека разрешения имён внутри программы.', 'The name-resolution library inside the program asks the question.') } },
      { id: 'e-out', from: 'nat', to: 'internet', label: bi('наружу от адреса хоста', 'out from the host address'), card: { what: bi('После MASQUERADE пакет уходит в сеть с адресом хоста в поле отправителя.', 'After MASQUERADE the packet leaves for the network with the host’s address as the source.'), who: bi('Пакет отправляет ядро хоста.', 'The host kernel sends the packet.') } },
      { id: 'e-gw', from: 'bridge', to: 'hostdb', label: bi('на шлюз 172.17.0.1', 'to gateway 172.17.0.1'), via: [[256, 276], [256, 180]], card: { what: bi('Пакет на адрес шлюза моста попадает не в другой контейнер, а в сетевой стек самого хоста, к его службам.', 'A packet to the bridge gateway address goes not to another container but into the host’s own network stack, to its services.'), who: bi('Доставляет пакет ядро хоста.', 'The host kernel delivers the packet.') } },
      { id: 'e-hostlo', from: 'api', to: 'hostdb', label: bi('lo хоста', 'host lo'), card: { what: bi('С флагом `--network host` у контейнера нет своего пространства имён net, и его localhost совпадает с localhost хоста.', 'With `--network host` the container has no net namespace of its own, and its localhost is the host’s localhost.'), who: bi('Так получается, когда контейнер запускают с `--network host`.', 'This is what happens when a container is started with `--network host`.') } },
    ],
  },
  params: [
    {
      id: 'request',
      label: bi('Какой запрос отправляют', 'Which request is sent'),
      kind: 'choice',
      default: 'published',
      options: [
        { id: 'published', label: bi('с хоста: curl localhost:8080 к контейнеру web, запущенному с -p 8080:80', 'from the host: curl localhost:8080 to the web container started with -p 8080:80') },
        { id: 'name', label: bi('из контейнера api: подключиться к базе по имени db', 'from the api container: connect to the database by the name db') },
        { id: 'localhost', label: bi('из контейнера api: подключиться к базе хоста по адресу localhost:5432', 'from the api container: connect to the host database at localhost:5432') },
        { id: 'hostgw', label: bi('из контейнера api: подключиться к базе хоста по имени host.docker.internal', 'from the api container: connect to the host database by the name host.docker.internal') },
        { id: 'egress', label: bi('из контейнера api: открыть https://example.com в интернете', 'from the api container: open https://example.com on the internet') },
      ],
      predict: {
        prompt: bi('Вы выбираете другой запрос, а остальные переключатели остаются в положении по умолчанию. Дойдёт ли выбранный запрос до цели?', 'You choose another request, and the other switches stay at their defaults. Will the chosen request reach its target?'),
        options: REACH,
        resolve: (_prev, next) => reached(next),
      },
    },
    {
      id: 'userNet',
      label: bi('Контейнеры api и db подключены к пользовательской сети app, а не к сети по умолчанию', 'The api and db containers are on the user-defined network app, not on the default network'),
      kind: 'toggle',
      default: true,
      group: bi('Сеть контейнеров', 'The containers’ network'),
      shownWhen: (p) => p.request === 'name',
      near: 'dns',
      predict: {
        prompt: bi('Вы меняете сеть контейнеров. Найдёт ли api базу по имени db?', 'You change the containers’ network. Will api find the database by the name db?'),
        options: REACH,
        resolve: (_prev, next) => reached(next),
      },
    },
    {
      id: 'netHost',
      label: bi('Контейнер api запущен с флагом --network host', 'The api container is started with --network host'),
      kind: 'toggle',
      default: false,
      group: bi('Сеть контейнеров', 'The containers’ network'),
      shownWhen: (p) => p.request === 'localhost',
      near: 'api',
      predict: {
        prompt: bi('Вы меняете то, как запущен контейнер api. Дойдёт ли запрос на localhost:5432 до базы хоста?', 'You change how the api container is started. Will the request to localhost:5432 reach the host database?'),
        options: REACH,
        resolve: (_prev, next) => reached(next),
      },
    },
    {
      id: 'addHost',
      label: bi('Контейнер api запущен с флагом --add-host=host.docker.internal:host-gateway', 'The api container is started with --add-host=host.docker.internal:host-gateway'),
      kind: 'toggle',
      default: true,
      group: bi('Как контейнер находит хост', 'How the container finds the host'),
      shownWhen: (p) => p.request === 'hostgw',
      near: 'api',
      predict: {
        prompt: bi('Хост работает на Linux, и вы меняете флаг --add-host. Найдёт ли api имя host.docker.internal?', 'The host runs Linux, and you change the --add-host flag. Will api find the name host.docker.internal?'),
        options: REACH,
        resolve: (_prev, next) => reached(next),
      },
    },
    {
      id: 'hostLocalOnly',
      label: bi('База на хосте слушает только адрес 127.0.0.1', 'The host database listens only on 127.0.0.1'),
      kind: 'toggle',
      default: false,
      group: bi('Как контейнер находит хост', 'How the container finds the host'),
      shownWhen: (p) => p.request === 'hostgw' && p.addHost === true,
      near: 'hostdb',
      predict: {
        prompt: bi('Вы меняете адрес, на котором слушает база хоста, а имя host.docker.internal по-прежнему ведёт на шлюз 172.17.0.1. Дойдёт ли запрос до базы?', 'You change the address the host database listens on, while the name host.docker.internal still leads to the gateway 172.17.0.1. Will the request reach the database?'),
        options: REACH,
        resolve: (_prev, next) => reached(next),
      },
    },
  ],
  breaks: [
    {
      id: 'web-local',
      label: bi('Приложение в контейнере web слушает только 127.0.0.1', 'The application in the web container listens only on 127.0.0.1'),
      remove: [],
      boundary: 'network',
      predict: {
        prompt: bi('Порт опубликован флагом -p 8080:80, но приложение внутри контейнера web слушает только адрес 127.0.0.1. Что получит `curl localhost:8080` на хосте?', 'The port is published with -p 8080:80, but the application inside the web container listens only on 127.0.0.1. What does `curl localhost:8080` on the host get?'),
        options: [
          { id: 'reset', text: bi('Соединение сбросится, потому что пакет придёт на eth0 контейнера, где никто не слушает', 'The connection is reset, because the packet arrives at the container’s eth0, where nobody listens') },
          { id: 'ok', text: bi('Страницу nginx, потому что порт опубликован и localhost хоста ведёт в контейнер', 'The nginx page, because the port is published and the host’s localhost leads into the container') },
        ],
        resolve: (_prev, next) => (next.some((s) => s.broken) ? 'reset' : 'ok'),
      },
    },
  ],
  run(p, broken): Step[] {
    const steps: Step[] = [];
    const first = (shown: string[]) => ({ ...startWith(ALL, ...shown) });
    if (p.request === 'published') {
      const local = broken.has('web-local');
      steps.push({
        id: 'curl',
        label: 'curl',
        caption: bi('На хосте вы набираете `curl localhost:8080`. Пакет адресован самому хосту, порту 8080, и первым его видит netfilter ядра хоста.', 'On the host you type `curl localhost:8080`. The packet is addressed to the host itself, port 8080, and the host kernel’s netfilter sees it first.'),
        focus: ['curl', 'e-curl'],
        states: first(['curl', 'nat', 'e-curl']),
        tokens: [{ edge: 'e-curl', label: '127.0.0.1:8080' }],
        say: { curl: bi('curl отправляет запрос на порт 8080 хоста.', 'curl sends the request to host port 8080.') },
      });
      steps.push({
        id: 'dnat',
        label: 'DNAT',
        caption: bi('Когда контейнер web запускали с `-p 8080:80`, dockerd записал для порта 8080 правило DNAT. Ядро меняет адрес назначения на адрес контейнера web, 172.17.0.3, и порт 80, и передаёт пакет на мост docker0.', 'When the web container was started with `-p 8080:80`, dockerd wrote a DNAT rule for port 8080. The kernel changes the destination to the web container’s address, 172.17.0.3, and port 80, and passes the packet to the docker0 bridge.'),
        focus: ['nat', 'e-nat'],
        reveal: ['bridge', 'e-nat'],
        tokens: [{ edge: 'e-nat', label: '→ 172.17.0.3:80' }],
        values: { nat: 'DNAT :8080 → 172.17.0.3:80' },
        say: { nat: bi('Ядро переписывает адрес назначения по правилу DNAT.', 'The kernel rewrites the destination address by the DNAT rule.') },
      });
      steps.push({
        id: 'proxy',
        label: 'docker-proxy',
        caption: bi('Запрос на localhost с самого хоста Docker по умолчанию передаёт небольшому процессу docker-proxy. Тот слушает порт 8080 хоста и открывает своё соединение на тот же адрес 172.17.0.3:80, поэтому путь до контейнера остаётся тем же.', 'By default Docker hands a request to localhost from the host itself to a small process, docker-proxy. It listens on host port 8080 and opens its own connection to the same 172.17.0.3:80, so the path to the container stays the same.'),
        focus: ['nat'],
        say: { nat: bi('docker-proxy сам открывает соединение с 172.17.0.3:80.', 'docker-proxy connects to 172.17.0.3:80 itself.') },
      });
      steps.push({
        id: 'veth',
        label: 'veth',
        caption: bi('Мост отдаёт пакет в пару veth контейнера web, и пакет оказывается в пространстве имён net этого контейнера, на его интерфейсе eth0 с адресом 172.17.0.3.', 'The bridge hands the packet to the web container’s veth pair, and the packet ends up in that container’s net namespace, on its eth0 interface with the address 172.17.0.3.'),
        focus: ['bridge', 'e-web'],
        reveal: ['web', 'e-web'],
        tokens: [{ edge: 'e-web', label: '172.17.0.3:80' }],
        say: { bridge: bi('Мост передаёт пакет контейнеру web.', 'The bridge passes the packet to the web container.') },
      });
      if (local) {
        steps.push({
          id: 'reset',
          label: bi('отказ', 'refused'),
          caption: bi('Приложение в контейнере web слушает адрес 127.0.0.1, то есть только интерфейс lo своего контейнера. Пакет пришёл на eth0, слушателя на этом адресе нет, и ядро контейнера отвечает отказом.', 'The application in the web container listens on 127.0.0.1, only its own container’s lo interface. The packet arrived on eth0, nobody listens on that address, and the container’s kernel refuses it.'),
          focus: ['web'],
          states: { web: 'err' },
          say: { web: bi('На адресе 172.17.0.3 порт 80 никто не слушает.', 'Nobody listens on port 80 at 172.17.0.3.') },
        });
        steps.push({
          id: 'rst',
          label: 'RST',
          caption: bi('curl видит не отказ, а сброс соединения. Его соединение уже принял docker-proxy на хосте, и, получив отказ от контейнера, docker-proxy обрывает это соединение.', 'curl sees a reset rather than a refusal. docker-proxy on the host had already accepted curl’s connection, and once the container refuses, docker-proxy drops that connection.'),
          focus: ['curl'],
          states: { curl: 'err' },
          say: { curl: bi('curl получает сброс соединения от docker-proxy.', 'curl gets a connection reset from docker-proxy.') },
          broken: { at: 'web', message: 'curl: (56) Recv failure: Connection reset by peer', caption: bi('Запрос остановился внутри контейнера. Публикация порта работает, а чинить нужно настройку приложения: оно должно слушать 0.0.0.0, то есть все интерфейсы контейнера.', 'The request stopped inside the container. The port publishing works, and what needs fixing is the application setting: it must listen on 0.0.0.0, that is, every interface of the container.') },
        });
      } else
        steps.push({
          id: 'answer',
          label: bi('ответ', 'answer'),
          caption: bi('nginx слушает 0.0.0.0:80, то есть все интерфейсы контейнера, принимает запрос и отвечает. Ответ идёт тем же путём обратно, и ядро по таблице соединений возвращает ему адрес localhost:8080, так что curl получает страницу.', 'nginx listens on 0.0.0.0:80, every interface of the container, accepts the request and answers. The answer goes back the same way, and the kernel uses its connection table to give it the address localhost:8080 again, so curl gets the page.'),
          focus: ['web', 'e-web'],
          states: { web: 'ok', curl: 'ok' },
          tokens: [{ edge: 'e-web', label: '200 OK', reverse: true }],
          say: { web: bi('nginx принимает соединение и отдаёт страницу.', 'nginx accepts the connection and serves the page.') },
        });
      return steps;
    }
    if (p.request === 'name') {
      if (!p.userNet) {
        steps.push({
          id: 'lookup-default',
          label: bi('имя', 'name'),
          caption: bi('Программа в контейнере api хочет подключиться к db:5432 и сначала спрашивает адрес имени db. В сети по умолчанию DNS-сервера Docker нет, и вопрос уходит резолверу, который Docker взял из /etc/resolv.conf хоста. О контейнерах этот резолвер ничего не знает.', 'The program in the api container wants to connect to db:5432 and first asks for the address of the name db. The default network has no Docker DNS server, and the question goes to the resolver Docker took from the host’s /etc/resolv.conf. That resolver knows nothing about containers.'),
          focus: ['api'],
          states: { ...first(['api', 'db']), api: 'err', db: 'off' },
          values: { api: '172.17.0.2', db: '172.17.0.4:5432' },
          say: { api: bi('api спрашивает адрес имени db, но ответа о нём нет.', 'api asks for the address of the name db, but there is no answer about it.') },
          broken: { at: 'api', message: 'psql: error: could not translate host name "db" to address: Name does not resolve', caption: bi('Запрос остановился на поиске имени. В сети по умолчанию контейнеры видят друг друга только по адресам, а имена работают в пользовательской сети: `docker network create app` и `docker network connect app db`.', 'The request stopped at the name lookup. On the default network containers see each other only by address, and names work on a user-defined network: `docker network create app` and `docker network connect app db`.') },
        });
        return steps;
      }
      steps.push({
        id: 'lookup',
        label: bi('имя', 'name'),
        caption: bi('Программа в контейнере api хочет подключиться к db:5432 и сначала спрашивает адрес имени db. Контейнеры работают в пользовательской сети app, поэтому вопрос уходит DNS-серверу Docker по адресу 127.0.0.11 внутри самого контейнера.', 'The program in the api container wants to connect to db:5432 and first asks for the address of the name db. The containers run on the user-defined network app, so the question goes to the Docker DNS server at 127.0.0.11 inside the container itself.'),
        focus: ['api', 'e-dns'],
        states: first(['api', 'dns', 'e-dns']),
        values: { api: '172.18.0.2', bridge: BRIDGE_APP },
        tokens: [{ edge: 'e-dns', label: 'A? db' }],
        say: { api: bi('api спрашивает, какой адрес у имени db.', 'api asks which address the name db has.') },
      });
      steps.push({
        id: 'dns-answer',
        label: 'DNS',
        caption: bi('DNS Docker знает все контейнеры сети app и отвечает адресом db, 172.18.0.3. Адрес он берёт в момент вопроса, поэтому и после пересоздания контейнера db имя ведёт к новому контейнеру.', 'Docker DNS knows every container of the network app and answers with the address of db, 172.18.0.3. It takes the address at the moment of the question, so after db is re-created the name leads to the new container.'),
        focus: ['dns', 'e-dns'],
        tokens: [{ edge: 'e-dns', label: 'db = 172.18.0.3', reverse: true }],
        states: { dns: 'ok' },
        say: { dns: bi('DNS Docker отвечает текущим адресом контейнера db.', 'Docker DNS answers with the current address of the db container.') },
      });
      steps.push({
        id: 'to-bridge',
        label: 'veth',
        caption: bi('Пакет на адрес 172.18.0.3 выходит из api по паре veth на мост сети app. NAT здесь не участвует, потому что оба контейнера подключены к одному мосту и видят друг друга по адресам.', 'The packet to 172.18.0.3 leaves api through its veth pair onto the bridge of the network app. NAT takes no part here, because both containers are plugged into one bridge and see each other by address.'),
        focus: ['bridge', 'e-api'],
        reveal: ['bridge', 'e-api'],
        values: { bridge: BRIDGE_APP },
        tokens: [{ edge: 'e-api', label: '172.18.0.3:5432' }],
        say: { bridge: bi('Мост сети app ищет, за какой парой veth стоит адрес 172.18.0.3.', 'The bridge of the network app looks for the veth pair behind 172.18.0.3.') },
      });
      steps.push({
        id: 'db',
        label: 'db',
        caption: bi('Мост передаёт пакет в пару veth контейнера db, и postgres принимает соединение. Публиковать порт 5432 для этого не нужно: флаг `-p` нужен только тогда, когда в контейнер приходят снаружи хоста.', 'The bridge passes the packet into the db container’s veth pair, and postgres accepts the connection. Port 5432 does not need publishing for this: the `-p` flag is needed only when someone comes into the container from outside the host.'),
        focus: ['db', 'e-db'],
        reveal: ['db', 'e-db'],
        states: { db: 'ok', api: 'ok' },
        tokens: [{ edge: 'e-db', label: '172.18.0.3:5432' }],
        say: { db: bi('postgres принимает соединение от api.', 'postgres accepts the connection from api.') },
      });
      return steps;
    }
    if (p.request === 'localhost') {
      if (p.netHost) {
        steps.push({
          id: 'lo-host',
          label: 'lo',
          caption: bi('С флагом `--network host` у контейнера api нет своего пространства имён net. Его localhost совпадает с localhost хоста, и пакет на 127.0.0.1:5432 сразу попадает к базе хоста, без моста и без NAT.', 'With `--network host` the api container has no net namespace of its own. Its localhost is the host’s localhost, and the packet to 127.0.0.1:5432 goes straight to the host database, with no bridge and no NAT.'),
          focus: ['api', 'e-hostlo'],
          states: first(['api', 'hostdb', 'e-hostlo']),
          values: { api: '--network host' },
          tokens: [{ edge: 'e-hostlo', label: '127.0.0.1:5432' }],
          say: { api: bi('api работает в сети хоста и подключается к его localhost.', 'api works in the host network and connects to its localhost.') },
        });
        steps.push({
          id: 'host-db',
          label: bi('база', 'database'),
          caption: bi('База хоста принимает соединение. Платить за эту простоту приходится изоляцией, потому что порты контейнера api стали портами хоста, и два таких контейнера не смогут слушать один и тот же порт.', 'The host database accepts the connection. The price of this simplicity is isolation, because the api container’s ports have become the host’s ports, and two such containers cannot listen on the same port.'),
          focus: ['hostdb'],
          states: { hostdb: 'ok', api: 'ok' },
          say: { hostdb: bi('База хоста принимает соединение на 127.0.0.1:5432.', 'The host database accepts the connection on 127.0.0.1:5432.') },
        });
        return steps;
      }
      steps.push({
        id: 'lo-self',
        label: 'lo',
        caption: bi('Программа в api подключается к localhost:5432 и рассчитывает попасть на базу хоста. Но у контейнера своё пространство имён net, и localhost в нём означает интерфейс lo самого контейнера api. Пакет даже не выходит из контейнера.', 'The program in api connects to localhost:5432, expecting to reach the host database. But the container has its own net namespace, where localhost means the api container’s own lo interface. The packet never leaves the container.'),
        focus: ['api'],
        states: { ...first(['api', 'hostdb']), api: 'err', hostdb: 'off' },
        values: { api: 'lo 127.0.0.1' },
        say: { api: bi('Пакет на localhost:5432 остаётся на интерфейсе lo контейнера api.', 'The packet to localhost:5432 stays on api’s lo interface.') },
        broken: { at: 'api', message: 'psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed: Connection refused', caption: bi('Запрос остановился внутри контейнера api, потому что на его собственном lo порт 5432 никто не слушает. До службы хоста ведут адрес шлюза моста или имя host.docker.internal, а localhost ведёт в сам контейнер.', 'The request stopped inside the api container, because nobody listens on port 5432 on its own lo. The bridge gateway address or the name host.docker.internal lead to a host service, while localhost leads into the container itself.') },
      });
      return steps;
    }
    if (p.request === 'hostgw') {
      if (!p.addHost) {
        steps.push({
          id: 'no-name',
          label: bi('имя', 'name'),
          caption: bi('Программа в api ищет адрес имени host.docker.internal. На Linux Docker сам это имя не создаёт, его добавляет только Docker Desktop на macOS и Windows. Без флага `--add-host` в /etc/hosts контейнера такой строки нет, и имя не находится.', 'The program in api looks for the address of host.docker.internal. On Linux Docker does not create this name by itself; only Docker Desktop on macOS and Windows adds it. Without the `--add-host` flag the container’s /etc/hosts has no such line, and the name is not found.'),
          focus: ['api'],
          states: { ...first(['api', 'hostdb']), api: 'err', hostdb: 'off' },
          say: { api: bi('api не находит имя host.docker.internal.', 'api cannot find the name host.docker.internal.') },
          broken: { at: 'api', message: 'psql: error: could not translate host name "host.docker.internal" to address: Name does not resolve', caption: bi('Запрос остановился на поиске имени. Запустите контейнер с `--add-host=host.docker.internal:host-gateway`, а в Compose добавьте сервису строку `extra_hosts: ["host.docker.internal:host-gateway"]`.', 'The request stopped at the name lookup. Start the container with `--add-host=host.docker.internal:host-gateway`, and in Compose give the service the line `extra_hosts: ["host.docker.internal:host-gateway"]`.') },
        });
        return steps;
      }
      steps.push({
        id: 'hosts',
        label: '/etc/hosts',
        caption: bi('Программа в api подключается к host.docker.internal:5432. Флаг `--add-host=host.docker.internal:host-gateway` записал это имя в /etc/hosts контейнера с адресом шлюза 172.17.0.1, то есть интерфейса docker0 самого хоста.', 'The program in api connects to host.docker.internal:5432. The flag `--add-host=host.docker.internal:host-gateway` wrote this name into the container’s /etc/hosts with the gateway address 172.17.0.1, the host’s own docker0 interface.'),
        focus: ['api'],
        states: first(['api']),
        values: { api: '172.17.0.1 host.docker.internal' },
        say: { api: bi('api находит это имя в /etc/hosts с адресом 172.17.0.1.', 'api finds 172.17.0.1 for this name in /etc/hosts.') },
      });
      steps.push({
        id: 'gw',
        label: 'veth',
        caption: bi('Пакет на 172.17.0.1 выходит из api по паре veth на мост docker0. Адрес назначения принадлежит хосту, поэтому мост отдаёт пакет не другому контейнеру, а сетевому стеку самого хоста.', 'The packet to 172.17.0.1 leaves api through its veth pair onto docker0. The address belongs to the host, so the bridge hands the packet to the host’s own network stack, not to another container.'),
        focus: ['bridge', 'e-api'],
        reveal: ['bridge', 'e-api'],
        tokens: [{ edge: 'e-api', label: '172.17.0.1:5432' }],
        say: { bridge: bi('Мост передаёт пакет хосту, потому что адрес 172.17.0.1 принадлежит ему.', 'The bridge passes the packet to the host, which owns 172.17.0.1.') },
      });
      if (p.hostLocalOnly)
        steps.push({
          id: 'refused',
          label: bi('отказ', 'refused'),
          caption: bi('Пакет пришёл на адрес 172.17.0.1, а база хоста слушает только 127.0.0.1. Для адреса 172.17.0.1 слушателя нет, и ядро хоста отвечает отказом.', 'The packet arrived at 172.17.0.1, while the host database listens only on 127.0.0.1. There is no listener for 172.17.0.1, and the host kernel answers with a refusal.'),
          focus: ['hostdb', 'e-gw'],
          reveal: ['hostdb', 'e-gw'],
          states: { hostdb: 'err' },
          tokens: [{ edge: 'e-gw', label: '172.17.0.1:5432' }],
          say: { hostdb: bi('База хоста не слушает адрес 172.17.0.1.', 'The host database does not listen on 172.17.0.1.') },
          broken: { at: 'hostdb', message: 'psql: error: connection to server at "host.docker.internal" (172.17.0.1), port 5432 failed: Connection refused', caption: bi('Запрос дошёл до хоста, но служба его не ждала. Базе нужно слушать ещё и 172.17.0.1 или 0.0.0.0, в postgres это параметр listen_addresses, а кого пускать, ограничивают файлом pg_hba.conf и межсетевым экраном.', 'The request reached the host, but the service was not expecting it. The database must also listen on 172.17.0.1 or 0.0.0.0, which in postgres is the listen_addresses setting, and who may connect is limited with pg_hba.conf and the firewall.') },
        });
      else
        steps.push({
          id: 'host-db',
          label: bi('база', 'database'),
          caption: bi('База хоста слушает 0.0.0.0:5432, то есть и адрес 172.17.0.1, и принимает соединение. Межсетевой экран хоста при этом должен пропускать пакеты с интерфейса docker0.', 'The host database listens on 0.0.0.0:5432, which includes 172.17.0.1, and accepts the connection. The host firewall must let packets from the docker0 interface through.'),
          focus: ['hostdb', 'e-gw'],
          reveal: ['hostdb', 'e-gw'],
          states: { hostdb: 'ok', api: 'ok' },
          tokens: [{ edge: 'e-gw', label: '172.17.0.1:5432' }],
          say: { hostdb: bi('База хоста принимает соединение от контейнера api.', 'The host database accepts the connection from the api container.') },
        });
      return steps;
    }
    steps.push({
      id: 'out',
      label: 'veth',
      caption: bi('Программа в api открывает https://example.com. Адрес назначения лежит за пределами сети контейнеров, поэтому пакет уходит по паре veth на мост, к шлюзу сети 172.17.0.1.', 'The program in api opens https://example.com. The destination lies outside the containers’ network, so the packet leaves through the veth pair onto the bridge, towards the network gateway 172.17.0.1.'),
      focus: ['api', 'e-api'],
      states: first(['api', 'bridge', 'e-api']),
      tokens: [{ edge: 'e-api', label: '172.17.0.2 → example.com' }],
      say: { api: bi('api отправляет запрос в интернет через шлюз сети.', 'api sends the request to the internet through the network gateway.') },
    });
    steps.push({
      id: 'masq',
      label: 'MASQUERADE',
      caption: bi('Адреса 172.17.0.0/16 видны только внутри машины, поэтому ядро хоста по правилу MASQUERADE заменяет адрес отправителя 172.17.0.2 адресом хоста. Так же работает NAT в домашнем роутере.', 'The 172.17.0.0/16 addresses are visible only inside the machine, so the host kernel replaces the source address 172.17.0.2 with the host’s address by the MASQUERADE rule. NAT in a home router works the same way.'),
      focus: ['nat', 'e-nat'],
      reveal: ['nat', 'e-nat'],
      values: { nat: 'MASQUERADE 172.17.0.0/16' },
      tokens: [{ edge: 'e-nat', label: bi('адрес хоста → example.com', 'host address → example.com'), reverse: true }],
      say: { nat: bi('Ядро подменяет адрес отправителя адресом хоста.', 'The kernel replaces the source address with the host’s address.') },
    });
    steps.push({
      id: 'internet',
      label: bi('ответ', 'answer'),
      caption: bi('Сервер в интернете видит запрос от адреса хоста и отвечает ему, а ядро по таблице соединений возвращает ответ контейнеру api. Публиковать порт для исходящих запросов не нужно.', 'The server on the internet sees a request from the host’s address and answers it, and the kernel uses its connection table to return the answer to the api container. Outgoing requests need no published port.'),
      focus: ['internet', 'e-out'],
      reveal: ['internet', 'e-out'],
      states: { internet: 'ok', api: 'ok' },
      tokens: [{ edge: 'e-out', label: 'GET /' }],
      say: { internet: bi('example.com отвечает на запрос, пришедший от адреса хоста.', 'example.com answers the request that came from the host’s address.') },
    });
    return steps;
  },
  explainDelta(prev, next): Bi {
    const end = (steps: Step[]) => steps.find((s) => s.broken)?.broken?.caption ?? steps[steps.length - 1]?.caption ?? bi('', '');
    const a = reached(prev);
    const b = reached(next);
    if (a === b)
      return fmtb(b === 'reach' ? bi('Запрос по-прежнему доходит до цели, но идёт другим путём. {c}', 'The request still reaches its target, but takes another path. {c}') : bi('Запрос по-прежнему останавливается по дороге. {c}', 'The request still stops on the way. {c}'), { c: end(next) });
    return fmtb(b === 'reach' ? bi('Раньше запрос останавливался по дороге, а теперь доходит до цели. {c}', 'The request used to stop on the way, and now it reaches its target. {c}') : bi('Раньше запрос доходил до цели, а теперь останавливается. {c}', 'The request used to reach its target, and now it stops. {c}'), { c: end(next) });
  },
});
