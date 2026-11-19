// Lessons 1–5 of the Networks block: the map of the internet, frames and MAC,
// IP and subnets, ARP, routing and ICMP (03 §5.3, net.m00–m04).

import { bi } from '../../core/i18n';
import type { Lesson, TerminalSetup } from '../../core/types';
import { EN, RU, src } from './sources';

export const lab = (hostname: string, preset: string, opts?: Record<string, unknown>, probes?: unknown[], prime?: unknown[]): TerminalSetup => ({
  user: 'root',
  hostname,
  ext: { net: { preset, opts, probes, prime } },
});

// ── 1. How the internet is built ───────────────────────────────────────────

export const internet: Lesson = {
  id: 'networks.internet',
  block: 'networks',
  title: bi('Как устроен интернет', 'How the internet is built'),
  summary: bi('Большая картина до всех слоёв: чьи сети, как они договариваются, почему расстояние нельзя обмануть.', 'The big picture before any layer: whose networks they are, how they agree, why distance cannot be cheated.'),
  introduces: ['net.as', 'net.bgp', 'net.ixp', 'net.latency', 'net.rtt'],
  uses: [],
  tier: 'core',
  minutes: 30,
  sources: src([EN.howInternet, EN.as, EN.bgp, EN.ixp, EN.cables, EN.rootServers], [RU.internet, RU.as, RU.bgp, RU.ixp]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы набираете адрес магазина и жмёте Enter. Через сорок миллисекунд появляется страница. За это время запрос побывал в квартире, у провайдера, у пары чужих компаний, проехал по кабелю на дне моря и вернулся. Ни одна из этих компаний не подчиняется другой — и всё же они договорились так, что работает с первого раза. Начнём с карты: кто кому принадлежит и как они договариваются.',
        'You type a shop’s address and press Enter. Forty milliseconds later the page appears. In that time the request visited your flat, your provider, a couple of other companies, travelled along a cable on the sea floor and came back. None of these companies answers to any other — and yet they have agreed well enough that it works the first time. Let us start with a map: who owns what and how they agree.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.map', caption: bi('Иди по уровням приближения стрелками; нажимай на блоки и линии — каждый объяснит себя.', 'Step through the levels of zoom with the arrow keys; click blocks and lines — each explains itself.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Сеть сетей', 'A network of networks'),
      body: bi(
        'Интернет — не одна сеть, а десятки тысяч независимых сетей, соединённых друг с другом. Каждая такая сеть называется [[net.as|автономной системой]]: у неё одно управление, свой номер (AS 64500 на карте) и свои блоки адресов. Ваш провайдер — автономная система. Хостинг, где живёт магазин, — другая. Крупный оператор, который возит трафик между странами, — третья.\n\nЧтобы пакет нашёл дорогу через чужие сети, они сообщают друг другу, какие адреса живут у них. Язык этих сообщений — [[net.bgp|BGP]]: «блок 198.51.100.0/24 доступен через меня». Соседи верят анонсам и строят по ним маршруты. Если какая-то сеть по ошибке объявит чужой блок, соседи поверят и ей — так случаются утечки маршрутов, когда трафик к популярному сайту на пару часов уходит не туда.\n\nСоседние сети обмениваются трафиком двумя способами. Можно договориться напрямую и включиться в общую [[net.ixp|точку обмена трафиком]] (IXP) — по сути большой коммутатор, к которому подключены десятки сетей города. А можно заплатить транзитному оператору, и тот довезёт трафик сам, часто через другую страну. Поэтому точки обмена делают интернет и дешевле, и быстрее.\n\nПочему «быстрее» — вопрос физики. Свет в оптоволокне проходит около 200 000 км в секунду, то есть примерно 5 микросекунд на километр. Это [[net.latency|задержка распространения]], и её нельзя уменьшить — можно только укоротить путь. От Москвы до Франкфурта около 2 000 км: 10 мс в одну сторону. Ответ возвращается тем же путём, поэтому задержку меряют «туда и обратно» — это [[net.rtt|RTT]]. Ping до другого континента не покажет 5 мс никогда, сколько бы ни стоил тариф.\n\nОтсюда и копии сайтов поблизости: большие сайты держат копии картинок и страниц в каждом крупном городе, чтобы они не ехали через океан. Как это устроено — в уроке про прокси. И ещё одна деталь карты: где-то рядом с провайдером отвечает сервер, с которого начинается поиск любого имени в интернете. О нём — в уроке про систему имён.',
        'The internet is not one network but tens of thousands of independent networks joined together. Each such network is called an [[net.as|autonomous system]]: it has one administration, its own number (AS 64500 on the map) and its own address blocks. Your provider is an autonomous system. The hosting company where the shop lives is another. A large carrier that moves traffic between countries is a third.\n\nFor a packet to find its way through other people’s networks, they tell each other which addresses live in them. The language of these messages is [[net.bgp|BGP]]: “block 198.51.100.0/24 is reachable through me.” Neighbours believe the announcements and build routes from them. If a network announces someone else’s block by mistake, the neighbours believe that too — this is how route leaks happen, when traffic to a popular site goes the wrong way for a couple of hours.\n\nNeighbouring networks exchange traffic in two ways. They can agree directly and join a shared [[net.ixp|internet exchange point]] (IXP) — in essence a large switch that dozens of the city’s networks are plugged into. Or they can pay a transit carrier, who will carry the traffic itself, often through another country. That is why exchange points make the internet both cheaper and faster.\n\nWhy faster is a matter of physics. Light in optical fibre travels about 200,000 km per second, which is roughly 5 microseconds per kilometre. This is [[net.latency|propagation delay]], and it cannot be reduced — only the path can be shortened. Moscow to Frankfurt is about 2,000 km: 10 ms one way. The answer comes back the same way, so delay is measured “there and back” — this is [[net.rtt|RTT]]. A ping to another continent will never show 5 ms, however expensive the plan.\n\nHence copies of sites nearby: big sites keep copies of images and pages in every large city so that they do not cross the ocean. How that works is the proxy lesson. And one more detail of the map: somewhere near your provider a server answers with which the search for any name on the internet begins. That is the lesson about the naming system.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home'),
      intro: bi('Ноутбук в домашней сети. Отсюда виден весь путь до магазина shop.example.', 'A laptop on a home network. The whole path to the shop shop.example is visible from here.'),
      tasks: [
        {
          id: 'trace',
          prompt: bi('Проследите путь до shop.example: каждая строка traceroute — устройство на пути, последняя — сам сервер.', 'Trace the path to shop.example: every traceroute line is a device on the way; the last one is the server itself.'),
          check: { stdout: /^ ?\d+ +198\.51\.100\.20 /m, fail: [{ if: "term['main'][last].exit!=0", say: bi('Команда завершилась с ошибкой — проверьте, как написано имя.', 'The command ended with an error — check how the name is spelled.') }] },
          chips: 'traceroute -n shop.example',
          docRef: { page: 'man/traceroute.8', anchor: 'DESCRIPTION', line: 'time to live' },
          hints: {
            H1: bi('Нужна команда, которая показывает маршрутизаторы на пути.', 'You need the command that shows the routers on the way.'),
            H2: bi('Это traceroute; флаг -n показывает адреса без поиска имён.', 'It is traceroute; the -n flag shows addresses without looking up names.'),
            H3: bi('traceroute -n shop.example', 'traceroute -n shop.example'),
          },
        },
        {
          id: 'isp',
          prompt: bi('Какой адрес у первого устройства за пределами вашей квартиры (второй строки traceroute)? Запишите его в файл ~/isp.txt.', 'What is the address of the first device outside your flat (the second traceroute line)? Write it into ~/isp.txt.'),
          check: {
            when: "files['/root/isp.txt'].text~'203.0.113.1'",
            fail: [{ if: "files['/root/isp.txt'].text~'192.168.1.1'", say: bi('192.168.1.1 — это ваш домашний роутер, он ещё в квартире. Нужна следующая строка.', '192.168.1.1 is your home router; it is still in the flat. You need the next line.') }],
          },
          chips: 'echo 203.0.113.1 > ~/isp.txt',
          hints: { H1: bi('Первая строка — роутер в квартире. Вторая — узел провайдера.', 'The first line is the router in the flat. The second is the provider’s node.'), H2: bi('Запишите адрес командой echo с перенаправлением > в файл.', 'Write the address with echo and redirect it with > into the file.') },
        },
        {
          id: 'rtt',
          prompt: bi('Измерьте RTT до shop.example тремя эхо-запросами и посмотрите на строку rtt в конце.', 'Measure the RTT to shop.example with three echo requests and look at the rtt line at the end.'),
          check: { stdout: /3 packets transmitted, 3 received/ },
          chips: 'ping -c 3 shop.example',
          docRef: { page: 'man/ping.8', anchor: 'OPTIONS', line: '-c count' },
          hints: { H1: bi('ping без -c в настоящей системе не остановится сам. Сколько запросов отправить, задаёт флаг.', 'On a real system ping without -c does not stop by itself. A flag sets how many requests to send.'), H2: bi('ping -c 3 и имя сайта.', 'ping -c 3 and the site name.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('У каждой команды есть страница руководства. Откройте ping(8): в каком разделе написано, с каким кодом завершится ping, если ответов не будет? Нажмите на раздел.', 'Every command has a manual page. Open ping(8): which section says what exit code ping ends with if no answers come? Click the section.'),
      ref: { page: 'man/ping.8' },
      answer: 'EXIT STATUS',
    },
    {
      id: 'outside',
      kind: 'callout',
      tone: 'note',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      title: bi('На своей машине', 'On your own machine'),
      body: bi(
        'Запустите traceroute до трёх сайтов в разных странах и для каждого хопа узнайте его автономную систему: `whois -h whois.radb.net <адрес>`. Найдите своего провайдера на bgp.tools — увидите, с кем он соседствует и через какие точки обмена.',
        'Run traceroute to three sites in different countries and find each hop’s autonomous system: `whois -h whois.radb.net <address>`. Look up your provider on bgp.tools — you will see whom it peers with and at which exchange points.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверь себя', 'Check yourself'), items: ['net.q.internet.order', 'net.q.internet.latency', 'net.q.internet.match', 'net.q.internet.ixp'] },
  ],
};

// ── 2. Frames and MAC addresses ────────────────────────────────────────────

export const frames: Lesson = {
  id: 'networks.frames',
  block: 'networks',
  title: bi('Кадр и MAC-адрес', 'Frames and MAC addresses'),
  summary: bi('Самый нижний слой, который можно потрогать: кабель, сетевая карта, кадр и коммутатор, который учится сам.', 'The lowest layer you can touch: a cable, a network card, a frame and a switch that learns by itself.'),
  introduces: ['net.nic', 'net.mac', 'net.frame', 'net.switch', 'net.broadcast'],
  uses: [],
  tier: 'core',
  minutes: 30,
  sources: src([EN.ethernet, EN.mac, EN.ipLink, EN.tcpdump], [RU.ethernet, RU.mac, RU.switch]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В комнате три компьютера, все воткнуты в одну коробку с лампочками. Кабели одинаковые, провода в них одинаковые. Как сообщение от первого компьютера попадает именно ко второму, а не ко всем сразу? Для этого у каждой сетевой карты есть свой номер, а у коробки — память.',
        'Three computers in a room, all plugged into one box with blinking lights. The cables are identical, the wires inside them are identical. How does a message from the first computer reach the second and not all of them at once? For that every network card has a number of its own, and the box has a memory.',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Сетевая карта, MAC, кадр', 'Network card, MAC, frame'),
      body: bi(
        'Машина говорит с сетью через [[net.nic|сетевую карту]] — физическую или виртуальную. В Linux она видна как интерфейс: `eth0`, `wlan0`, `enp3s0`. У каждой карты есть [[net.mac|MAC-адрес]] — 48 бит, записанных шестью парами шестнадцатеричных цифр: `02:42:ac:11:00:0a`. Его ставит производитель карты (у виртуальной машины — гипервизор), и посмотреть его можно командой `ip link`: строка `link/ether`.\n\nДанные по кабелю идут порциями — [[net.frame|кадрами]]. Кадр Ethernet устроен просто: в начале MAC получателя, затем MAC отправителя, затем двухбайтовое поле EtherType — «что лежит внутри», затем сами данные, а в конце контрольная сумма, по которой получатель видит, не испортился ли кадр в пути. Адрес получателя стоит первым не случайно: устройство решает, куда отдать кадр, ещё не дочитав его.\n\nMAC-адрес говорит, *какая это карта*, но не говорит, *где она*. Поэтому он работает только внутри одной локальной сети — среди машин, соединённых кабелями и коробками без посредников. Как пакет выходит за её пределы, разберём через три урока.',
        'A machine talks to the network through a [[net.nic|network card]], physical or virtual. In Linux it shows up as an interface: `eth0`, `wlan0`, `enp3s0`. Every card has a [[net.mac|MAC address]] — 48 bits written as six pairs of hexadecimal digits: `02:42:ac:11:00:0a`. The card’s manufacturer sets it (for a virtual machine, the hypervisor), and `ip link` shows it: the `link/ether` line.\n\nData goes along the cable in pieces — [[net.frame|frames]]. An Ethernet frame is simple: the receiver’s MAC first, then the sender’s MAC, then a two-byte EtherType field — “what is inside” — then the data itself, and at the end a checksum by which the receiver sees whether the frame was damaged on the way. The receiver’s address comes first for a reason: a device decides where to send the frame before it has finished reading it.\n\nA MAC address says *which card* it is, but not *where* it is. That is why it works only inside one local network — among machines joined by cables and boxes with no middlemen. How a packet leaves that network is three lessons from now.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.switch', caption: bi('Сначала с пустой таблицей, потом с заполненной. Попробуй кадр «всем» и выдерни кабель.', 'First with an empty table, then with a full one. Try a frame “to everyone” and pull a cable.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Коммутатор учится сам', 'A switch learns by itself'),
      body: bi(
        'Коробка с лампочками — это [[net.switch|коммутатор]] (switch). Он читает в каждом кадре только MAC-адреса. По адресу отправителя он запоминает: «этот MAC — за портом 1». По адресу получателя решает, в какой порт отдать кадр. Если получателя в таблице ещё нет, коммутатор рассылает копии кадра во все порты, кроме того, откуда кадр пришёл: нужный получатель возьмёт свой, остальные увидят чужой адрес и выбросят. Как только получатель что-нибудь ответит, коммутатор запомнит и его — и дальше кадры пойдут точно по адресу. Записи живут около пяти минут с последнего кадра.\n\nОсобый адрес `ff:ff:ff:ff:ff:ff` значит «всем». Такой [[net.broadcast|широковещательный кадр]] коммутатор всегда рассылает во все порты, сколько бы он ни знал. Широковещательно рассылаются вопросы «кто тут?», когда машина ещё не знает, к кому обратиться: так, например, ноутбук ищет сервер, который выдаст ему адрес.\n\nЗаметьте, чего коммутатор *не* делает: он не сообщает об ошибках. Если кабель выдернут, кадр просто никуда не придёт, и отправитель не дождётся ответа. На этом уровне нет отказа — есть только тишина. Это первое правило траблшутинга, к которому мы ещё вернёмся: тишина и отказ — разные симптомы.',
        'The box with lights is a [[net.switch|switch]]. It reads only the MAC addresses in each frame. From the sender’s address it remembers: “this MAC is behind port 1”. From the receiver’s address it decides which port gets the frame. If the receiver is not in its table yet, the switch sends copies of the frame out of every port except the one it came in on: the right receiver takes its frame, the others see someone else’s address and drop it. As soon as the receiver answers anything, the switch remembers it too — and from then on frames go exactly where they should. Entries live about five minutes after the last frame.\n\nThe special address `ff:ff:ff:ff:ff:ff` means “everyone”. The switch always sends such a [[net.broadcast|broadcast frame]] out of every port, however much it knows. “Who is here?” questions go out as broadcasts when a machine does not yet know whom to talk to — this is how, for example, a laptop looks for the server that will give it an address.\n\nNotice what a switch does *not* do: it does not report errors. If a cable is pulled, the frame simply arrives nowhere, and the sender never gets an answer. At this level there is no refusal — only silence. This is the first rule of troubleshooting, and we will come back to it: silence and refusal are different symptoms.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('a', 'lan'),
      intro: bi('Машина a в локальной сети с машинами b (192.168.1.20) и c (192.168.1.30) за одним коммутатором.', 'Machine a on a local network with machines b (192.168.1.20) and c (192.168.1.30) behind one switch.'),
      tasks: [
        {
          id: 'mac',
          prompt: bi('Найдите MAC-адрес интерфейса eth0 и запишите его в файл ~/mac.txt.', 'Find the MAC address of the eth0 interface and write it into ~/mac.txt.'),
          check: { when: "files['/root/mac.txt'].text~'02:42:ac:11:00:0a'", fail: [{ if: "files['/root/mac.txt'].text~'ff:ff:ff:ff:ff:ff'", say: bi('ff:ff:ff:ff:ff:ff в строке link/ether — это brd, широковещательный адрес. MAC карты — первый.', 'ff:ff:ff:ff:ff:ff on the link/ether line is brd, the broadcast address. The card’s MAC is the first one.') }] },
          chips: 'ip link show eth0',
          docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip addr' },
          hints: {
            H1: bi('MAC — свойство интерфейса, его показывает команда ip.', 'The MAC is a property of the interface; the ip command shows it.'),
            H2: bi('ip link show eth0 — смотрите строку link/ether. Затем echo … > ~/mac.txt.', 'ip link show eth0 — look at the link/ether line. Then echo … > ~/mac.txt.'),
            H3: bi('ip link show eth0 > ~/mac.txt тоже подойдёт: проверка ищет MAC в файле.', 'ip link show eth0 > ~/mac.txt works too: the check looks for the MAC in the file.'),
          },
        },
        {
          id: 'neighbour',
          prompt: bi('Отправьте соседу b один эхо-запрос (ping -c 1 192.168.1.20), затем посмотрите кадры командой tcpdump -n -e. Запишите MAC-адрес b в файл ~/b.txt.', 'Send neighbour b one echo request (ping -c 1 192.168.1.20), then look at the frames with tcpdump -n -e. Write b’s MAC address into ~/b.txt.'),
          check: { when: "files['/root/b.txt'].text~'02:42:ac:11:00:14'", fail: [{ if: "files['/root/b.txt'].text~'02:42:ac:11:00:0a'", say: bi('Это ваш собственный MAC. В строке tcpdump -e слева от > — отправитель, справа — получатель.', 'That is your own MAC. In a tcpdump -e line the sender is left of > and the receiver right of it.') }] },
          chips: 'ping -c 1 192.168.1.20; tcpdump -n -e',
          hints: {
            H1: bi('В выводе tcpdump -e после времени идут MAC отправителя > MAC получателя.', 'In tcpdump -e output, after the time come the sender MAC > the receiver MAC.'),
            H2: bi('Перед эхо-запросом вы увидите два служебных кадра — вопрос «у кого 192.168.1.20?» и ответ. Мы назовём их через урок. MAC b есть в ответе.', 'Before the echo request you will see two service frames — the question “who has 192.168.1.20?” and the answer. We name them in two lessons. b’s MAC is in the answer.'),
          },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите в tcpdump(8) флаг, который добавляет к каждой строке MAC-адреса кадра, и покажите кадры, которые уже прошли через eth0.', 'Find the tcpdump(8) flag that adds the frame’s MAC addresses to every line, and show the frames that have already crossed eth0.'),
      ref: { page: 'man/tcpdump.8', anchor: 'OPTIONS', line: '-e' },
      terminal: {
        setup: lab('a', 'lan', undefined, undefined, [{ icmp: '192.168.1.20', count: 2 }]),
        task: {
          id: 'e',
          prompt: bi('Покажите кадры с MAC-адресами.', 'Show the frames with their MAC addresses.'),
          check: { stdout: /[0-9a-f]{2}(:[0-9a-f]{2}){5} > [0-9a-f]{2}(:[0-9a-f]{2}){5}, ethertype/ },
          docStep: 3,
          chips: 'tcpdump -n -e',
          hints: { H1: bi('Это флаг из одной буквы; описание начинается словами «Print the link-level header».', 'It is a one-letter flag; its description starts with “Print the link-level header”.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверь себя', 'Check yourself'), items: ['net.q.frames.flood', 'net.q.frames.scope', 'net.q.frames.label'] },
  ],
};

// ── 3. IP addresses and subnets ────────────────────────────────────────────

export const subnets: Lesson = {
  id: 'networks.subnets',
  block: 'networks',
  title: bi('IP-адрес и подсеть', 'IP addresses and subnets'),
  summary: bi('Адрес по месту, а не по карте: сеть и хост, маска и префикс, частные диапазоны. С калькулятором и дриллом.', 'An address by place, not by card: network and host, mask and prefix, private ranges. With a calculator and a drill.'),
  introduces: ['net.ip', 'net.cidr', 'net.subnet', 'net.private'],
  uses: ['net.mac', 'net.nic'],
  tier: 'core',
  minutes: 40,
  sources: src([EN.subnet, EN.rfc4632, EN.rfc1918, EN.ipAddress, EN.rfc791], [RU.ipv4, RU.cidr, RU.private]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В блоке Linux команда `ip a` показывала строку вроде `inet 10.0.2.15/24`. Адрес вы узнали. А что значит `/24`? И почему машина 10.0.2.15 говорит с 10.0.2.20 напрямую, а до 10.0.3.20 — уже нет, хотя адреса отличаются одной цифрой?',
        'In the Linux block `ip a` showed a line like `inet 10.0.2.15/24`. You recognised the address. But what does `/24` mean? And why does machine 10.0.2.15 talk to 10.0.2.20 directly but not to 10.0.3.20, though the addresses differ by one digit?',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Сеть и хост', 'Network and host'),
      body: bi(
        'MAC-адрес — номер карты, он не говорит, где она стоит. Чтобы пакет нашёл машину в другом конце света, нужен адрес по месту — [[net.ip|IP-адрес]]. Это 32 бита, которые записывают четырьмя числами от 0 до 255: `192.168.1.10`. Каждое число — один байт, восемь бит; его называют октетом.\n\nIP-адрес состоит из двух частей. Старшие биты — номер сети: «улица». Младшие — номер машины в этой сети: «дом». Где проходит граница, говорит [[net.cidr|префикс CIDR]] — число после косой черты. `/24` значит «первые 24 бита — сеть», то есть первые три числа; на хосты остаётся 8 бит. То же самое записывают маской: 24 единицы и 8 нулей — `255.255.255.0`. Префикс и маска — две записи одной границы.\n\nВсе адреса с одинаковой сетевой частью образуют [[net.subnet|подсеть]]. `192.168.1.0/24` — это адреса от `192.168.1.0` до `192.168.1.255`. Первый из них — адрес самой сети, последний — broadcast, «всем в подсети»; машинам их не выдают. Остаётся 2⁸ − 2 = 254 адреса для хостов. С `/26` на хосты остаётся 6 бит: 2⁶ − 2 = 62. Чем длиннее префикс, тем меньше подсеть.\n\nИ главное правило: машины одной подсети говорят друг с другом напрямую, кадрами по MAC. Ядро проверяет это само: накладывает маску на адрес получателя и сравнивает с сетевой частью своего адреса. Совпало — отправляет прямо соседу. Не совпало — сосед не в этой подсети, и прямо до него не дотянуться. Что делать тогда, вы узнаете в уроке про маршрутизацию; пока ядро просто откажет: `Network is unreachable`.\n\nНекоторые диапазоны отведены под внутренние сети и в интернете не используются: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918). Адрес из них — [[net.private|частный адрес]]: такой одновременно есть в миллионах квартир и офисов, поэтому снаружи он ничего не значит. Ещё два особых: `127.0.0.1` — сама машина (loopback), `169.254.x.x` — адрес, который машина назначает себе, когда не дождалась настоящего.',
        'A MAC address is a card’s number; it does not say where the card is. For a packet to find a machine at the other end of the world, you need an address by place — an [[net.ip|IP address]]. It is 32 bits written as four numbers from 0 to 255: `192.168.1.10`. Each number is one byte, eight bits; it is called an octet.\n\nAn IP address has two parts. The high bits are the network number: “the street”. The low bits are the machine’s number in that network: “the house”. Where the border runs is told by the [[net.cidr|CIDR prefix]] — the number after the slash. `/24` means “the first 24 bits are the network”, i.e. the first three numbers; 8 bits are left for hosts. The same is written as a mask: 24 ones and 8 zeros — `255.255.255.0`. Prefix and mask are two spellings of one border.\n\nAll addresses with the same network part make up a [[net.subnet|subnet]]. `192.168.1.0/24` is the addresses from `192.168.1.0` to `192.168.1.255`. The first of them is the address of the network itself, the last is the broadcast, “everyone in the subnet”; machines do not get them. That leaves 2⁸ − 2 = 254 host addresses. With `/26` hosts get 6 bits: 2⁶ − 2 = 62. The longer the prefix, the smaller the subnet.\n\nAnd the main rule: machines of one subnet talk to each other directly, with frames by MAC. The kernel checks this itself: it applies the mask to the destination address and compares the result with the network part of its own address. A match — it sends straight to the neighbour. No match — the neighbour is not in this subnet and cannot be reached directly. What to do then you will learn in the routing lesson; for now the kernel simply refuses: `Network is unreachable`.\n\nSome ranges are set aside for internal networks and are not used on the internet: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918). An address from them is a [[net.private|private address]]: the same one exists in millions of flats and offices at once, so outside it means nothing. Two more are special: `127.0.0.1` is the machine itself (loopback), and `169.254.x.x` is an address a machine gives itself when it did not get a real one.',
      ),
    },
    { id: 'calc', kind: 'widget', step: 'look', widget: 'net.subnet-calc', props: { cidr: '192.168.10.37/26' } },
    {
      id: 'ipv6',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      title: bi('А IPv6?', 'What about IPv6?'),
      body: bi(
        'IPv6 — тот же принцип, только адрес длиной 128 бит, записанный восемью группами шестнадцатеричных цифр: `2001:db8::1`, где `::` — пропущенные нули. `::1` — это loopback, `fe80::/10` — адреса, которые интерфейс получает сам (их видно в `ip a` как `inet6 fe80::…`). В облаках и кластерах IPv6 встречается всё чаще, но собеседования для входа почти всегда проверяют IPv4 — с него и начнём.',
        'IPv6 is the same idea with a 128-bit address written as eight groups of hexadecimal digits: `2001:db8::1`, where `::` stands for skipped zeros. `::1` is loopback, `fe80::/10` are addresses an interface gets by itself (you see them in `ip a` as `inet6 fe80::…`). IPv6 is more and more common in clouds and clusters, but entry-level interviews almost always test IPv4 — so we start there.',
      ),
    },
    { id: 'drill', kind: 'widget', step: 'practice', widget: 'net.subnet-drill', props: { need: 5 } },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('h1', 'two-subnets', { noAddr: true }),
      intro: bi('Хост h1 только что подключили к подсети 10.0.1.0/24, адреса у него ещё нет. Сосед h3 — 10.0.1.20; в соседней подсети 10.0.2.0/24 живёт h2 — 10.0.2.10.', 'Host h1 has just been connected to subnet 10.0.1.0/24 and has no address yet. Neighbour h3 is 10.0.1.20; host h2 lives in the next subnet 10.0.2.0/24 at 10.0.2.10.'),
      tasks: [
        {
          id: 'addr',
          prompt: bi('Назначьте интерфейсу eth0 адрес 10.0.1.10 в подсети /24.', 'Give the eth0 interface the address 10.0.1.10 in a /24 subnet.'),
          check: {
            when: "net.ifaces[name=eth0].addrs has '10.0.1.10/24'",
            fail: [{ if: "net.ifaces[name=eth0].addrs has '10.0.1.10/32'", say: bi('Адрес назначен без префикса — ядро считает его /32, подсетью из одного адреса. Укажите /24.', 'The address was set without a prefix — the kernel treats it as /32, a subnet of one address. Give /24.') }],
          },
          chips: 'ip addr add 10.0.1.10/24 dev eth0',
          docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip addr' },
          hints: {
            H1: bi('Адрес назначают командой ip, объект address.', 'An address is set with the ip command, object address.'),
            H2: bi('ip addr add АДРЕС/ПРЕФИКС dev ИНТЕРФЕЙС', 'ip addr add ADDRESS/PREFIX dev INTERFACE'),
            H3: bi('ip addr add 10.0.1.10/24 dev eth0', 'ip addr add 10.0.1.10/24 dev eth0'),
          },
        },
        {
          id: 'neighbour',
          prompt: bi('Убедитесь, что сосед по подсети 10.0.1.20 отвечает на ping.', 'Make sure the neighbour 10.0.1.20 in your subnet answers a ping.'),
          check: { stdout: /bytes from 10\.0\.1\.20/ },
          chips: 'ping -c 2 10.0.1.20',
          hints: { H1: bi('ping -c 2 и адрес соседа.', 'ping -c 2 and the neighbour’s address.') },
        },
        {
          id: 'other',
          prompt: bi('Теперь попробуйте ping до h2 — 10.0.2.10 — и прочитайте, что ответит ядро.', 'Now try to ping h2 — 10.0.2.10 — and read what the kernel says.'),
          check: { stdout: /Network is unreachable/ },
          chips: 'ping -c 2 10.0.2.10',
          hints: { H1: bi('Наложите маску /24 на 10.0.2.10: совпадает ли сеть с вашей 10.0.1.0?', 'Apply the /24 mask to 10.0.2.10: does the network match your 10.0.1.0?') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверь себя', 'Check yourself'), items: ['net.q.sub.hosts', 'net.q.sub.private', 'net.q.sub.same', 'net.q.sub.mask'] },
  ],
};

// ── 4. ARP ─────────────────────────────────────────────────────────────────

export const arp: Lesson = {
  id: 'networks.arp',
  block: 'networks',
  title: bi('ARP: по адресу найти карту', 'ARP: from an address to a card'),
  summary: bi('Ядро знает IP-адрес соседа, а кадру нужен MAC. Как один превращается в другой и почему ошибку иногда пишет сам отправитель.', 'The kernel knows the neighbour’s IP address, but a frame needs a MAC. How one becomes the other and why the sender itself sometimes reports the error.'),
  introduces: ['net.arp', 'net.arp-cache'],
  uses: ['net.mac', 'net.ip', 'net.subnet', 'net.broadcast', 'net.frame', 'net.switch'],
  tier: 'core',
  minutes: 25,
  sources: src([EN.rfc826, EN.ipNeigh, EN.tcpdump], [RU.arp, RU.mac]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В прошлом уроке ping до соседа сработал, и перед эхо-запросом в захвате мелькнули два непонятных кадра. Вот откуда они. Ядро знает IP-адрес соседа — 10.0.1.20 — и знает, что он в той же подсети. Но кадр нельзя отправить на IP-адрес: в заголовке кадра есть место только для MAC. Где его взять?',
        'In the last lesson the ping to the neighbour worked, and before the echo request two puzzling frames flashed by in the capture. Here is where they come from. The kernel knows the neighbour’s IP address — 10.0.1.20 — and knows it is in the same subnet. But a frame cannot be sent to an IP address: the frame header has room only for a MAC. Where does it get one?',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.arp', caption: bi('С пустым кэшем, с заполненным и с выключенным соседом.', 'With an empty cache, a full one, and the neighbour switched off.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Вопрос всем, ответ одного', 'A question to all, an answer from one'),
      body: bi(
        'Ядро спрашивает. Протокол вопроса называется [[net.arp|ARP]] (Address Resolution Protocol). Вопрос уходит широковещательным кадром на `ff:ff:ff:ff:ff:ff`: «У кого 192.168.1.20? Ответьте 192.168.1.10». Его слышат все машины подсети. Те, чей адрес другой, молчат. Машина с адресом 192.168.1.20 отвечает спросившему обычным кадром: «192.168.1.20 is-at 02:42:ac:11:00:14».\n\nОтвет ядро записывает в [[net.arp-cache|ARP-кэш]] — таблицу «IP → MAC», которую показывает `ip neigh` (старая команда — `arp -n`). Пока запись свежая, вопросы не нужны: следующие пакеты уходят сразу. Запись живёт, пока ею пользуются; без трафика она устаревает (STALE) и при следующем пакете перепроверяется. Заодно и отвечающий запомнил MAC спросившего — ведь в вопросе он был указан.\n\nЕсли никто не ответил, ядро повторяет вопрос ещё два раза и сдаётся. Пакет так и не уходит: не нашлось, кому отдать кадр. Тогда ping пишет `From 192.168.1.10 icmp_seq=1 Destination Host Unreachable` — обратите внимание на адрес: это вы сами. Ошибку сообщает ваше собственное ядро, а в `ip neigh` у соседа стоит `FAILED`. Такой симптом говорит: соседа с этим адресом в вашей сети нет — выключен, не тот кабель, опечатка в адресе.\n\nИ загадка напоследок. ARP работает только внутри подсети: широковещательный кадр дальше неё не уходит. А что, если адресат — в другой подсети? MAC какого устройства тогда должен искать хост? Ответ — в следующем уроке.',
        'The kernel asks. The protocol of the question is called [[net.arp|ARP]] (Address Resolution Protocol). The question goes out as a broadcast frame to `ff:ff:ff:ff:ff:ff`: “Who has 192.168.1.20? Tell 192.168.1.10.” Every machine in the subnet hears it. Those with other addresses stay silent. The machine with 192.168.1.20 answers the asker with an ordinary frame: “192.168.1.20 is-at 02:42:ac:11:00:14.”\n\nThe kernel writes the answer into the [[net.arp-cache|ARP cache]] — an “IP → MAC” table shown by `ip neigh` (the old command is `arp -n`). While the entry is fresh, no questions are needed: the next packets go straight away. An entry lives while it is used; without traffic it goes stale (STALE) and is re-checked on the next packet. The answering machine has also remembered the asker’s MAC — it was in the question, after all.\n\nIf nobody answers, the kernel asks twice more and gives up. The packet never leaves: there was nobody to hand the frame to. ping then prints `From 192.168.1.10 icmp_seq=1 Destination Host Unreachable` — note the address: it is you. Your own kernel reports the error, and `ip neigh` shows the neighbour as `FAILED`. This symptom says: there is no neighbour with that address on your network — it is off, the wrong cable, a typo in the address.\n\nAnd a riddle to finish. ARP works only inside a subnet: a broadcast frame goes no further. What if the destination is in another subnet? Whose MAC must the host look for then? The answer is in the next lesson.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('a', 'lan', { cOff: true }),
      intro: bi('Машина a (192.168.1.10). Сосед b — 192.168.1.20. Машина c (192.168.1.30) сегодня выключена.', 'Machine a (192.168.1.10). Neighbour b is 192.168.1.20. Machine c (192.168.1.30) is switched off today.'),
      tasks: [
        {
          id: 'learn',
          prompt: bi('ARP-кэш пуст. Отправьте один эхо-запрос соседу b и убедитесь, что в кэше появилась запись о нём.', 'The ARP cache is empty. Send one echo request to neighbour b and make sure an entry for it has appeared in the cache.'),
          check: { when: "net.neigh[ip='192.168.1.20'].state=REACHABLE" },
          chips: 'ping -c 1 192.168.1.20; ip neigh',
          docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip neigh' },
          hints: { H1: bi('Кэш заполняется сам, когда ядру нужно отправить пакет.', 'The cache fills by itself when the kernel needs to send a packet.'), H2: bi('ping -c 1 192.168.1.20, затем ip neigh.', 'ping -c 1 192.168.1.20, then ip neigh.') },
        },
        {
          id: 'see',
          prompt: bi('Покажите в захвате только кадры ARP — вопрос who-has и ответ is-at.', 'Show only the ARP frames in the capture — the who-has question and the is-at answer.'),
          check: { stdout: /is-at 02:42:ac:11:00:14/ },
          chips: 'tcpdump -n arp',
          docRef: { page: 'man/tcpdump.8', anchor: 'EXPRESSION', line: 'arp' },
          hints: { H1: bi('У tcpdump в конце строки можно написать фильтр: имя протокола.', 'At the end of a tcpdump line you can write a filter: the protocol name.'), H2: bi('tcpdump -n arp', 'tcpdump -n arp') },
        },
        {
          id: 'failed',
          prompt: bi('Отправьте эхо-запрос выключенной машине c (192.168.1.30). Прочитайте, кто пишет ошибку, и посмотрите, что стало в ARP-кэше.', 'Send an echo request to the switched-off machine c (192.168.1.30). Read who writes the error and see what is now in the ARP cache.'),
          check: { when: "net.neigh[ip='192.168.1.30'].state=FAILED" },
          chips: 'ping -c 2 192.168.1.30; ip neigh',
          hints: { H1: bi('Ошибка придёт с вашего же адреса — ядро не нашло, кому отдать кадр.', 'The error comes from your own address — the kernel found nobody to hand the frame to.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Страница ip(8) описывает сразу много объектов: адреса, интерфейсы, маршруты, соседей. В каком разделе перечислены эти объекты? Нажмите на него.', 'The ip(8) page describes many objects at once: addresses, interfaces, routes, neighbours. In which section are these objects listed? Click it.'),
      ref: { page: 'man/ip.8' },
      answer: 'OBJECTS',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверь себя', 'Check yourself'), items: ['net.q.arp.who', 'net.q.arp.unreach', 'net.q.arp.order'] },
  ],
};

// ── 5. Routing and ICMP ────────────────────────────────────────────────────

export const routing: Lesson = {
  id: 'networks.routing',
  block: 'networks',
  title: bi('Маршрутизация и ICMP', 'Routing and ICMP'),
  summary: bi('Пакет выходит за пределы подсети: таблица маршрутов, шлюз, самый длинный префикс, TTL и служебные сообщения сети.', 'A packet leaves its subnet: the routing table, the gateway, the longest prefix, TTL and the network’s service messages.'),
  introduces: ['net.router', 'net.route-table', 'net.gateway', 'net.lpm', 'net.ttl', 'net.icmp'],
  uses: ['net.ip', 'net.subnet', 'net.cidr', 'net.arp', 'net.mac', 'net.frame'],
  tier: 'core',
  minutes: 40,
  sources: src([EN.routing, EN.ipRoute, EN.rfc792, EN.ping, EN.rfc791], [RU.routing, RU.icmp, RU.traceroute]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Два урока назад h1 не смог достучаться до 10.0.2.10: `Network is unreachable`. Адрес в чужой подсети, напрямую не дотянуться. Значит, пакету нужно выйти «за дверь» своей подсети — а для этого нужен кто-то, кто стоит в обеих.',
        'Two lessons ago h1 could not reach 10.0.2.10: `Network is unreachable`. The address is in another subnet and cannot be reached directly. So the packet has to go “out of the door” of its subnet — and that needs someone who stands in both.',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Маршрутизатор и таблица маршрутов', 'The router and the routing table'),
      body: bi(
        '[[net.router|Маршрутизатор]] (router) — машина, подключённая к нескольким подсетям сразу и согласная пересылать чужие пакеты. В мире DevOps это почти всегда обычный Linux с двумя сетевыми картами, у которого включён параметр `net.ipv4.ip_forward=1`. Без него машина с двумя картами — просто машина с двумя картами: пакеты, адресованные не ей, она молча выбрасывает.\n\nКуда отправить пакет, ядро решает по [[net.route-table|таблице маршрутов]] — её показывает `ip route`. Каждая строка говорит «куда — через кого — через какой интерфейс». Строки вида `10.0.1.0/24 dev eth0 proto kernel scope link` ядро добавило само, когда интерфейсу назначили адрес: своя подсеть доступна напрямую. Строку `default via 10.0.1.1 dev eth0` добавил администратор или выдал сервер адресов: всё остальное — через [[net.gateway|шлюз по умолчанию]] 10.0.1.1.\n\nЕсли подходят несколько строк, побеждает [[net.lpm|самый длинный префикс]] (longest prefix match): `/24` точнее `/16`, а `default` — это `0.0.0.0/0`, префикс нулевой длины, он подходит всем и проигрывает всем. Порядок строк значения не имеет. Посмотреть, какую строку ядро выберет для адреса, можно командой `ip route get 10.0.2.10`.\n\nТеперь разгадка загадки из урока про ARP. Если адресат в чужой подсети, пакет пойдёт к шлюзу — значит, кадру нужен MAC *шлюза*. Хост спрашивает по ARP «у кого 10.0.1.1?», а в кадре с пакетом для 10.0.2.10 получателем стоит MAC маршрутизатора.',
        'A [[net.router|router]] is a machine connected to several subnets at once and willing to forward other machines’ packets. In DevOps it is almost always ordinary Linux with two network cards and the `net.ipv4.ip_forward=1` setting turned on. Without it, a machine with two cards is just a machine with two cards: packets not addressed to it are silently dropped.\n\nThe kernel decides where to send a packet by the [[net.route-table|routing table]] — `ip route` shows it. Each line says “where to — via whom — through which interface”. Lines like `10.0.1.0/24 dev eth0 proto kernel scope link` were added by the kernel itself when the interface got an address: its own subnet is reachable directly. The line `default via 10.0.1.1 dev eth0` was added by the administrator or given by an address server: everything else goes through the [[net.gateway|default gateway]] 10.0.1.1.\n\nIf several lines match, the [[net.lpm|longest prefix match]] wins: `/24` is more specific than `/16`, and `default` is `0.0.0.0/0`, a prefix of length zero that matches everything and loses to everything. The order of lines does not matter. To see which line the kernel picks for an address, use `ip route get 10.0.2.10`.\n\nNow the answer to the riddle of the ARP lesson. If the destination is in another subnet, the packet goes to the gateway — so the frame needs the *gateway’s* MAC. The host asks over ARP “who has 10.0.1.1?”, and in the frame carrying the packet for 10.0.2.10 the receiver is the router’s MAC.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.route', caption: bi('Подвигай TTL до единицы, убери маршрут обратно, выключи маршрутизатор.', 'Move TTL down to one, remove the route back, switch the router off.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Что меняется в пути. TTL и ICMP', 'What changes on the way. TTL and ICMP'),
      body: bi(
        'Маршрутизатор снимает кадр, читает IP-адрес получателя, выбирает строку своей таблицы и кладёт пакет в *новый* кадр — с MAC своего второго интерфейса и MAC следующего получателя. IP-адреса от начала до конца пути не меняются, MAC-адреса меняются на каждом участке. Это стоит запомнить: «по IP — куда в итоге, по MAC — кому сейчас».\n\nЕщё одно поле маршрутизатор меняет всегда — [[net.ttl|TTL]], time to live. Отправитель ставит его, например, 64; каждый маршрутизатор уменьшает на единицу, и пакет с нулевым TTL выбрасывается. Так сеть защищена от петель: пакет, заблудившийся между двумя маршрутизаторами, не будет кружить вечно. По TTL ответа видно, сколько маршрутизаторов прошёл пакет: пришло 61 — значит, три.\n\nВыбросив пакет, маршрутизатор сообщает об этом отправителю. Служебные сообщения сети передаёт [[net.icmp|ICMP]]: «время жизни истекло» (Time to live exceeded), «сеть недостижима», «порт недостижим». Тот же ICMP несёт эхо-запрос и эхо-ответ, которыми пользуется `ping`, — теперь у него есть имя.\n\nНа этом построен `traceroute`. Он отправляет пакеты с TTL 1, 2, 3… Первый маршрутизатор на пути обнуляет TTL первого пакета и отвечает «время истекло» со своего адреса — так он назвал себя. Второй называет себя на втором пакете, и так до цели. Строка `* * *` значит: ответа не пришло. Узел на предыдущей строке ответил, значит, он жив; смотреть надо дальше — на следующий узел и на маршрут обратно.\n\nИ последнее: маршрут нужен в обе стороны. Если у получателя нет пути к вашей подсети, запрос дойдёт, а ответ — нет. Это частый и коварный случай «пинг в одну сторону».',
        'A router strips the frame, reads the destination IP address, picks a line of its table and puts the packet into a *new* frame — with the MAC of its second interface and the MAC of the next receiver. IP addresses stay the same from the start of the path to the end; MAC addresses change on every segment. Worth remembering: “IP says where in the end, MAC says to whom right now”.\n\nOne more field a router always changes — [[net.ttl|TTL]], time to live. The sender sets it to, say, 64; every router decrements it by one, and a packet with zero TTL is dropped. This protects the network from loops: a packet lost between two routers will not circle forever. The TTL of an answer tells how many routers the packet passed: 61 arrived — so three.\n\nHaving dropped a packet, the router tells the sender. The network’s service messages are carried by [[net.icmp|ICMP]]: “Time to live exceeded”, “network unreachable”, “port unreachable”. The same ICMP carries the echo request and echo reply that `ping` uses — now it has a name.\n\n`traceroute` is built on this. It sends packets with TTL 1, 2, 3… The first router on the way zeroes the TTL of the first packet and answers “time exceeded” from its own address — that is how it names itself. The second names itself on the second packet, and so on to the target. A `* * *` line means no answer came. The node on the line before answered, so it is alive; look further — at the next node and at the route back.\n\nAnd last: a route is needed in both directions. If the receiver has no path to your subnet, the request arrives and the reply does not. This is the common and treacherous “one-way ping”.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('h1', 'two-subnets', {}, [{ id: 'p', kind: 'icmp', to: '10.0.2.10', count: 3 }]),
      intro: bi('h1 (10.0.1.10/24) и маршрутизатор r1 (10.0.1.1 и 10.0.2.1). Маршрута по умолчанию у h1 нет.', 'h1 (10.0.1.10/24) and router r1 (10.0.1.1 and 10.0.2.1). h1 has no default route.'),
      tasks: [
        {
          id: 'route',
          prompt: bi('Сделайте так, чтобы h1 пинговал h2 (10.0.2.10) через маршрутизатор r1.', 'Make h1 able to ping h2 (10.0.2.10) through router r1.'),
          check: {
            when: "(net.routes[dst=default].gateway='10.0.1.1' || net.routes[dst='10.0.2.0/24'].gateway='10.0.1.1') && reach.p.received>=2",
            fail: [{ if: "!net.routes[dst=default] && !net.routes[dst='10.0.2.0/24']", say: bi('У h1 нет маршрута, который подходит к 10.0.2.10. Посмотрите ip route get 10.0.2.10.', 'h1 has no route that matches 10.0.2.10. Look at ip route get 10.0.2.10.') }],
          },
          chips: 'ip route add default via 10.0.1.1',
          docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip route' },
          concepts: ['net.gateway', 'net.route-table'],
          hints: {
            H1: bi('h1 не знает, через кого идти в чужие подсети. Нужен шлюз.', 'h1 does not know whom to go through to other subnets. It needs a gateway.'),
            H2: bi('Маршрут добавляют командой ip route add; шлюз — адрес r1 в вашей подсети.', 'A route is added with ip route add; the gateway is r1’s address in your subnet.'),
            H3: bi('ip route add default via 10.0.1.1', 'ip route add default via 10.0.1.1'),
          },
        },
        {
          id: 'get',
          prompt: bi('Спросите ядро, какую строку таблицы оно выберет для пакета к 10.0.2.10.', 'Ask the kernel which table line it would pick for a packet to 10.0.2.10.'),
          check: { stdout: /10\.0\.2\.10 via 10\.0\.1\.1 dev eth0/ },
          chips: 'ip route get 10.0.2.10',
          hints: { H1: bi('У ip route есть подкоманда get.', 'ip route has a get subcommand.') },
        },
      ],
    },
    {
      id: 'lab-trace',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('h1', 'chain', { broken: true }),
      intro: bi('Цепочка из трёх маршрутизаторов до сервера 10.20.0.5. Где-то по дороге сломан маршрут.', 'A chain of three routers to server 10.20.0.5. Somewhere on the way a route is broken.'),
      tasks: [
        {
          id: 'where',
          prompt: bi('Прочитайте traceroute -n 10.20.0.5. Запишите в файл ~/last.txt адрес последнего узла, который ответил.', 'Read traceroute -n 10.20.0.5. Write the address of the last node that answered into ~/last.txt.'),
          check: {
            when: "files['/root/last.txt'].text~'10.0.12.2'",
            fail: [
              { if: "files['/root/last.txt'].text~'10.0.1.1'", say: bi('10.0.1.1 — первый хоп. Он ответил, но после него ответил ещё один.', '10.0.1.1 is the first hop. It answered, but one more answered after it.') },
              { if: "files['/root/last.txt'].text~'10.20.0.5'", say: bi('Сервер не ответил — строки со звёздочками. Нужен последний адрес перед ними.', 'The server did not answer — those are the lines with asterisks. You need the last address before them.') },
            ],
          },
          chips: 'traceroute -n -m 6 10.20.0.5',
          hints: { H1: bi('Строки * * * — без ответа. Нужна последняя строка с адресом.', 'The * * * lines have no answer. You need the last line with an address.'), H2: bi('Следующий после него узел не отправил «время истекло» назад — у него нет маршрута обратно к 10.0.1.0/24.', 'The node after it sent no “time exceeded” back — it has no route back to 10.0.1.0/24.') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите в ping(8) флаг, который задаёт TTL отправляемого пакета, и отправьте один эхо-запрос до 10.0.2.10 с TTL 1 — ответить должен маршрутизатор.', 'Find the ping(8) flag that sets the TTL of the sent packet, and send one echo request to 10.0.2.10 with TTL 1 — the router should answer.'),
      ref: { page: 'man/ping.8', anchor: 'OPTIONS', line: '-t ttl' },
      terminal: {
        setup: lab('h1', 'two-subnets', { gw: true }),
        task: {
          id: 'ttl1',
          prompt: bi('Один эхо-запрос с TTL 1 до 10.0.2.10.', 'One echo request with TTL 1 to 10.0.2.10.'),
          check: { stdout: /From 10\.0\.1\.1 icmp_seq=1 Time to live exceeded/ },
          docStep: 3,
          chips: 'ping -c 1 -t 1 10.0.2.10',
          concepts: ['net.ttl', 'net.icmp'],
          hints: { H1: bi('В разделе OPTIONS ищите слово «Time to Live».', 'In the OPTIONS section look for the words “Time to Live”.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверь себя', 'Check yourself'), items: ['net.q.route.lpm', 'net.q.route.changes', 'net.q.route.trace', 'net.q.route.oneway'] },
  ],
};
