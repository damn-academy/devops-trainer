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
  summary: bi('Прежде чем разбирать слои сети, посмотрим на интернет целиком: кому принадлежат сети, через которые идёт запрос, как эти сети договариваются друг с другом и почему задержку из-за расстояния нельзя убрать.', 'The big picture before any layer: whose networks they are, how they agree, why distance cannot be cheated.'),
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
        'Вы набираете адрес магазина и нажимаете Enter, а через сорок миллисекунд на экране появляется страница. За это время запрос успел побывать в вашей квартире, у провайдера и у пары чужих компаний, пройти по кабелю на дне моря и вернуться обратно. Ни одна из этих компаний не подчиняется другой, и всё же они договорились так, что страница открывается с первого раза. Начнём с карты, на которой видно, кому принадлежит каждый участок пути и как владельцы участков договариваются между собой.',
        'You type a shop’s address and press Enter. Forty milliseconds later the page appears. In that time the request visited your flat, your provider, a couple of other companies, travelled along a cable on the sea floor and came back. None of these companies answers to any other — and yet they have agreed well enough that it works the first time. Let us start with a map: who owns what and how they agree.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Путь запроса от ноутбука до дата-центра', 'The path of a request from a laptop to a data centre'),
      body: bi(
        'Схема ниже показывает путь, который проходит запрос, когда вы открываете сайт магазина, причём в нескольких приближениях: от квартиры к городу, от города к стране и дальше к другому континенту. Сначала на схеме только ноутбук и домашний роутер. Остальные участники появляются, когда до них доходит запрос: справа от роутера сеть провайдера, выше и ниже две дороги в сеть сайта, через точку обмена трафиком или через транзитного оператора, дальше подводный кабель и дата-центр, где работает сайт. Отдельно сверху появится копия сайта в вашем городе, а снизу корневой сервер DNS, с которого начинается поиск любого имени.\n\nПод схемой копятся три счётчика: время пути до сайта и обратно, время пути до копии сайта и число независимых сетей, через которые прошёл запрос.',
        'The diagram below shows the path of a request when you open the shop’s site, at several levels of zoom: from the flat to the city, from the city to the country and on to another continent. At first it shows only the laptop and the home router. The other participants appear when the request reaches them: to the right of the router the provider’s network, above and below two roads into the site’s network, through an exchange point or through a transit carrier, then a submarine cable and the data centre where the site runs. A copy of the site in your city appears at the top, and the root DNS server, where the search for any name begins, at the bottom.\n\nThree counters grow under the diagram: the round-trip time to the site, the round-trip time to the copy, and the number of independent networks the request crossed.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.map', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен участник, который работает сейчас, и облачко рядом с ним говорит, что он делает: «Роутер отправляет пакет по оптическому кабелю в сеть провайдера». По линии движется карточка с тем, что передаётся дальше: запрос, блок адресов из объявления BGP или файл стилей. Щёлкните по любому блоку или линии, и откроется карточка с объяснением. Значки и цвета рамок перечислены в легенде под схемой.\n\nКогда пройдёте путь до конца, поменяйте параметры над схемой. Выключите точку обмена трафиком и посмотрите, как изменятся время пути и число сетей. Включите копию сайта в вашем городе, а потом подвиньте расстояние до дата-центра. Напоследок включите по одной обе поломки в блоке «Сломать»: перебитый подводный кабель и ошибочное объявление адресов. Перед каждой поломкой схема спросит, что, по-вашему, случится.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the participant working now is highlighted, and the callout next to it says what it does. A card travels along the line with what is handed on: the request, a block of addresses from a BGP announcement or a stylesheet. Click any block or line to open a card with an explanation. The legend under the diagram lists the pictograms and outline colours.\n\nOnce you reach the end, change the knobs above the diagram. Switch the exchange point off and see how the time and the number of networks change. Turn on the site copy in your city, then move the distance to the data centre. Finally switch on both breaks in “Break it” one at a time: the cut submarine cable and the wrong address announcement. Before each break the diagram asks what you think will happen.'), caption: bi('Карта показала путь целиком, и у каждого его участка оказался свой хозяин. В следующем разделе разберём, как эти хозяева договариваются друг с другом и откуда берётся задержка, которую вы видели в счётчиках.', 'The map showed the whole path, and every part of it turned out to have its own owner. The next section explains how these owners agree with each other and where the delay you saw in the counters comes from.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Интернет как сеть из множества сетей', 'A network of networks'),
      body: bi(
        'Интернет состоит не из одной сети, а из десятков тысяч независимых сетей, соединённых друг с другом. Каждая такая сеть называется [[net.as|автономной системой]]: ею управляет одна организация, у неё есть свой номер (на карте это AS 64500) и свои блоки адресов. Сеть вашего провайдера образует одну автономную систему, сеть хостинга, где работает магазин, образует другую, а сеть крупного оператора, который передаёт трафик между странами, образует третью.\n\nЧтобы пакет нашёл дорогу через чужие сети, сети сообщают друг другу, какие адреса находятся у них. Эти сообщения передаются по протоколу [[net.bgp|BGP]] и звучат примерно так: «блок адресов 198.51.100.0/24 доступен через меня». Соседние сети верят таким объявлениям и строят по ним маршруты. Если какая-то сеть по ошибке объявит чужой блок адресов, соседи поверят и ей. Так случаются перехваты маршрутов, когда трафик к популярному сайту на пару часов уходит не туда.\n\nСоседние сети обмениваются трафиком двумя способами. Они могут договориться напрямую и подключиться к общей [[net.ixp|точке обмена трафиком]] (IXP), то есть к большому коммутатору, к которому подключены десятки сетей города. А могут заплатить транзитному оператору, и тот сам передаст трафик дальше, часто через другую страну. Поэтому точки обмена делают интернет и дешевле, и быстрее.\n\nПочему путь через точку обмена быстрее, объясняет физика. Свет в оптоволокне проходит около 200 000 километров в секунду, то есть тратит примерно 5 микросекунд на каждый километр. Это время называется [[net.latency|задержкой распространения]], и уменьшить его нельзя, можно только сократить путь. От Москвы до Франкфурта около 2 000 километров, и свет проходит их за 10 миллисекунд в одну сторону. Ответ возвращается тем же путём, поэтому задержку измеряют туда и обратно и называют это время [[net.rtt|RTT]]. Сколько бы ни стоил тариф, ping до другого континента никогда не покажет 5 миллисекунд.\n\nПоэтому большие сайты держат копии картинок и страниц в каждом крупном городе, чтобы эти файлы не приходилось передавать через океан. Как устроены такие копии, вы узнаете в уроке про прокси. На карте была ещё одна деталь: недалеко от провайдера работает сервер, с которого начинается поиск любого имени в интернете. Ему посвящён урок про систему имён DNS.',
        'The internet is not one network but tens of thousands of independent networks joined together. Each such network is called an [[net.as|autonomous system]]: it has one administration, its own number (AS 64500 on the map) and its own address blocks. Your provider is an autonomous system. The hosting company where the shop lives is another. A large carrier that moves traffic between countries is a third.\n\nFor a packet to find its way through other people’s networks, they tell each other which addresses live in them. The language of these messages is [[net.bgp|BGP]]: “block 198.51.100.0/24 is reachable through me.” Neighbours believe the announcements and build routes from them. If a network announces someone else’s block by mistake, the neighbours believe that too — this is how route hijacks happen, when traffic to a popular site goes the wrong way for a couple of hours.\n\nNeighbouring networks exchange traffic in two ways. They can agree directly and join a shared [[net.ixp|internet exchange point]] (IXP) — in essence a large switch that dozens of the city’s networks are plugged into. Or they can pay a transit carrier, who will carry the traffic itself, often through another country. That is why exchange points make the internet both cheaper and faster.\n\nWhy faster is a matter of physics. Light in optical fibre travels about 200,000 km per second, which is roughly 5 microseconds per kilometre. This is [[net.latency|propagation delay]], and it cannot be reduced — only the path can be shortened. Moscow to Frankfurt is about 2,000 km: 10 ms one way. The answer comes back the same way, so delay is measured “there and back” — this is [[net.rtt|RTT]]. A ping to another continent will never show 5 ms, however expensive the plan.\n\nHence copies of sites nearby: big sites keep copies of images and pages in every large city so that they do not cross the ocean. How that works is the proxy lesson. And one more detail of the map: somewhere near your provider a server answers with which the search for any name on the internet begins. That is the lesson about the naming system.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home'),
      intro: bi('Вы работаете на ноутбуке в домашней сети. Отсюда можно проследить весь путь до магазина shop.example.', 'A laptop on a home network. The whole path to the shop shop.example is visible from here.'),
      tasks: [
        {
          id: 'trace',
          prompt: bi('Проследите путь до shop.example командой traceroute. Каждая строка её вывода соответствует одному устройству на пути, а последняя строка соответствует самому серверу.', 'Trace the path to shop.example: every traceroute line is a device on the way; the last one is the server itself.'),
          check: { stdout: /^ ?\d+ +198\.51\.100\.20 /m, fail: [{ if: "term['main'][last].exit!=0", say: bi('Команда завершилась с ошибкой. Проверьте, правильно ли написано имя сайта.', 'The command ended with an error — check how the name is spelled.') }] },
          chips: 'traceroute -n shop.example',
          docRef: { page: 'man/traceroute.8', anchor: 'DESCRIPTION', line: 'time to live' },
          hints: {
            H1: bi('Вам нужна команда, которая показывает маршрутизаторы на пути до сервера.', 'You need the command that shows the routers on the way.'),
            H2: bi('Это команда traceroute, а флаг -n велит ей показывать адреса и не тратить время на поиск имён.', 'It is traceroute; the -n flag shows addresses without looking up names.'),
            H3: bi('traceroute -n shop.example', 'traceroute -n shop.example'),
          },
        },
        {
          id: 'isp',
          prompt: bi('Какой адрес у первого устройства за пределами вашей квартиры, то есть во второй строке вывода traceroute? Запишите этот адрес в файл ~/isp.txt.', 'What is the address of the first device outside your flat (the second traceroute line)? Write it into ~/isp.txt.'),
          check: {
            when: "files['/root/isp.txt'].text~'203.0.113.1'",
            fail: [{ if: "files['/root/isp.txt'].text~'192.168.1.1'", say: bi('Адрес 192.168.1.1 принадлежит вашему домашнему роутеру, а роутер ещё находится в квартире. Вам нужна следующая строка.', '192.168.1.1 is your home router; it is still in the flat. You need the next line.') }],
          },
          chips: 'echo 203.0.113.1 > ~/isp.txt',
          hints: { H1: bi('Первая строка соответствует роутеру в квартире, а вторая узлу провайдера.', 'The first line is the router in the flat. The second is the provider’s node.'), H2: bi('Запишите адрес в файл командой echo, перенаправив её вывод знаком >.', 'Write the address with echo and redirect it with > into the file.') },
        },
        {
          id: 'rtt',
          prompt: bi('Измерьте RTT до shop.example тремя эхо-запросами и посмотрите на строку rtt в конце вывода.', 'Measure the RTT to shop.example with three echo requests and look at the rtt line at the end.'),
          check: { stdout: /3 packets transmitted, 3 received/ },
          chips: 'ping -c 3 shop.example',
          docRef: { page: 'man/ping.8', anchor: 'OPTIONS', line: '-c count' },
          hints: { H1: bi('В настоящей системе ping без флага -c сам не остановится. Сколько запросов отправить, задаёт этот флаг.', 'On a real system ping without -c does not stop by itself. A flag sets how many requests to send.'), H2: bi('Наберите ping -c 3 и имя сайта.', 'ping -c 3 and the site name.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('У каждой команды есть страница руководства. Откройте ping(8) и найдите раздел, в котором написано, с каким кодом завершится ping, если ответы не придут. Нажмите на этот раздел.', 'Every command has a manual page. Open ping(8): which section says what exit code ping ends with if no answers come? Click the section.'),
      ref: { page: 'man/ping.8' },
      answer: 'EXIT STATUS',
    },
    {
      id: 'outside',
      kind: 'callout',
      tone: 'note',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      title: bi('Что попробовать на своей машине', 'On your own machine'),
      body: bi(
        'Запустите traceroute до трёх сайтов в разных странах и для каждого узла на пути узнайте его автономную систему командой `whois -h whois.radb.net <адрес>`. Потом найдите своего провайдера на сайте bgp.tools: там видно, с какими сетями он соседствует и через какие точки обмена трафиком подключён.',
        'Run traceroute to three sites in different countries and find each hop’s autonomous system: `whois -h whois.radb.net <address>`. Look up your provider on bgp.tools — you will see whom it peers with and at which exchange points.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.internet.order', 'net.q.internet.latency', 'net.q.internet.match', 'net.q.internet.ixp'] },
  ],
};

// ── 2. Frames and MAC addresses ────────────────────────────────────────────

export const frames: Lesson = {
  id: 'networks.frames',
  block: 'networks',
  title: bi('Кадр и MAC-адрес', 'Frames and MAC addresses'),
  summary: bi('Урок о самом нижнем слое сети, который можно потрогать руками. В нём разобраны кабель, сетевая карта, кадр и коммутатор, который сам учится, куда отдавать кадры.', 'The lowest layer you can touch: a cable, a network card, a frame and a switch that learns by itself.'),
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
        'В комнате стоят три компьютера, и все они подключены к одной коробке с мигающими лампочками. Кабели одинаковые, и провода в них тоже одинаковые. Как сообщение от первого компьютера попадает ко второму, а не ко всем сразу? Для этого у каждой сетевой карты есть собственный номер, а у коробки есть память.',
        'Three computers in a room, all plugged into one box with blinking lights. The cables are identical, the wires inside them are identical. How does a message from the first computer reach the second and not all of them at once? For that every network card has a number of its own, and the box has a memory.',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Сетевая карта, MAC-адрес и кадр', 'Network card, MAC, frame'),
      body: bi(
        'Машина обменивается данными с сетью через [[net.nic|сетевую карту]], физическую или виртуальную. В Linux сетевая карта видна как интерфейс с именем вроде `eth0`, `wlan0` или `enp3s0`. У каждой карты есть [[net.mac|MAC-адрес]] длиной 48 бит, который записывают шестью парами шестнадцатеричных цифр, например `02:42:ac:11:00:0a`. Этот адрес задаёт производитель карты, а у виртуальной машины его назначает гипервизор. Посмотреть адрес можно командой `ip link`: он стоит в строке `link/ether`.\n\nПо кабелю данные передаются порциями, которые называются [[net.frame|кадрами]]. Кадр Ethernet устроен несложно. В начале стоит MAC-адрес получателя, затем MAC-адрес отправителя, затем двухбайтовое поле EtherType, которое говорит, что лежит внутри, затем сами данные, а в конце контрольная сумма, по которой получатель проверяет, не испортился ли кадр в пути. Адрес получателя стоит первым не случайно: устройство решает, куда отдать кадр, ещё до того, как дочитает его до конца.\n\nMAC-адрес говорит, *какая это карта*, но не говорит, *где она находится*. Поэтому он работает только внутри одной локальной сети, то есть среди машин, соединённых кабелями и коммутаторами без посредников. Как пакет выходит за пределы локальной сети, вы узнаете через три урока.',
        'A machine talks to the network through a [[net.nic|network card]], physical or virtual. In Linux it shows up as an interface: `eth0`, `wlan0`, `enp3s0`. Every card has a [[net.mac|MAC address]] — 48 bits written as six pairs of hexadecimal digits: `02:42:ac:11:00:0a`. The card’s manufacturer sets it (for a virtual machine, the hypervisor), and `ip link` shows it: the `link/ether` line.\n\nData goes along the cable in pieces — [[net.frame|frames]]. An Ethernet frame is simple: the receiver’s MAC first, then the sender’s MAC, then a two-byte EtherType field — “what is inside” — then the data itself, and at the end a checksum by which the receiver sees whether the frame was damaged on the way. The receiver’s address comes first for a reason: a device decides where to send the frame before it has finished reading it.\n\nA MAC address says *which card* it is, but not *where* it is. That is why it works only inside one local network — among machines joined by cables and boxes with no middlemen. How a packet leaves that network is three lessons from now.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как коммутатор решает, куда отдать кадр', 'How a switch decides where to send a frame'),
      body: bi(
        'Вы уже знаете, что у каждой сетевой карты есть MAC-адрес и что кадр начинается с адреса получателя. Схема ниже показывает, что происходит с кадром внутри коробки с лампочками. Четыре компьютера, A, B, C и D, подключены кабелями к портам 1–4 одного коммутатора, а компьютер A отправляет кадр компьютеру B. Под названием коммутатора показана его таблица, в которой он записывает, какой MAC-адрес находится за каким портом; пока таблица пуста, там стоят пустые скобки.',
        'You already know that every network card has a MAC address and that a frame starts with the receiver’s address. The diagram below shows what happens to a frame inside the box with lights. Four computers, A, B, C and D, are plugged into ports 1–4 of one switch, and computer A sends a frame to computer B. Under the switch’s name you see its table, where it writes which MAC address is behind which port; while it is empty, it shows empty brackets.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.switch', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен блок, который работает сейчас, и облачко рядом с ним говорит, что он делает: «Коммутатор записывает в таблицу, что компьютер A подключён к порту 1». По кабелю движется карточка с кадром и его получателем, например `кадр → B`. Бледные компьютеры кадра не получили, а жёлтая рамка означает, что компьютер получил чужой кадр и выбросил его. Остальные значки объяснены в легенде под схемой.\n\nПервый раз пройдите схему с пустой таблицей. Потом выберите над схемой таблицу, в которой A и B уже записаны, и сравните, куда уходит кадр. Затем включите отправку кадра всем на адрес `ff:ff:ff:ff:ff:ff`. Напоследок включите в блоке «Сломать» выдернутый кабель компьютера B и посмотрите, что получит отправитель.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the block working now is highlighted, and the callout next to it says what it does. A card with the frame and its receiver, such as `frame → B`, travels along the cable. Pale computers did not get the frame, and a yellow outline means a computer got someone else’s frame and dropped it. The legend under the diagram explains the other marks.\n\nWalk through the diagram with an empty table first. Then choose the table where A and B are already recorded and compare where the frame goes. Then switch on sending the frame to everyone, to `ff:ff:ff:ff:ff:ff`. Finally switch on the unplugged cable of computer B in “Break it” and see what the sender gets.'), caption: bi('Коммутатор, который вы только что видели, делает свою работу молча, и в следующем разделе разберём, что из этого следует при поиске неисправностей.', 'The switch you have just seen does its work silently; the next section explains what that means when you troubleshoot.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Как коммутатор сам заполняет свою таблицу', 'A switch learns by itself'),
      body: bi(
        'Коробка с лампочками называется [[net.switch|коммутатором]] (switch). В каждом кадре коммутатор читает только MAC-адреса. По адресу отправителя он запоминает, что этот адрес находится за определённым портом, например за портом 1. По адресу получателя он решает, в какой порт отдать кадр. Если получателя в таблице ещё нет, коммутатор рассылает копии кадра во все порты, кроме того, через который кадр пришёл. Нужный получатель возьмёт свою копию, а остальные увидят в кадре чужой адрес и выбросят его. Как только получатель что-нибудь ответит, коммутатор запомнит и его порт, и дальше кадры пойдут только по нужным портам. Каждая запись хранится около пяти минут после последнего кадра с этим адресом.\n\nОсобый адрес `ff:ff:ff:ff:ff:ff` означает «всем». Такой [[net.broadcast|широковещательный кадр]] коммутатор всегда рассылает во все порты, сколько бы он ни знал о сети. Широковещательно рассылают вопросы вроде «кто здесь?», когда машина ещё не знает, к кому обратиться; так, например, ноутбук ищет сервер, который выдаст ему адрес.\n\nЗаметьте, что коммутатор *не* сообщает об ошибках. Если кабель выдернут, кадр никуда не придёт, и отправитель так и не дождётся ответа. На этом уровне сети отказов не бывает, бывает только тишина. Это первое правило поиска неисправностей, к которому мы ещё вернёмся: тишина и отказ указывают на разные причины.',
        'The box with lights is a [[net.switch|switch]]. It reads only the MAC addresses in each frame. From the sender’s address it remembers: “this MAC is behind port 1”. From the receiver’s address it decides which port gets the frame. If the receiver is not in its table yet, the switch sends copies of the frame out of every port except the one it came in on: the right receiver takes its frame, the others see someone else’s address and drop it. As soon as the receiver answers anything, the switch remembers it too — and from then on frames go exactly where they should. Entries live about five minutes after the last frame.\n\nThe special address `ff:ff:ff:ff:ff:ff` means “everyone”. The switch always sends such a [[net.broadcast|broadcast frame]] out of every port, however much it knows. “Who is here?” questions go out as broadcasts when a machine does not yet know whom to talk to — this is how, for example, a laptop looks for the server that will give it an address.\n\nNotice what a switch does *not* do: it does not report errors. If a cable is pulled, the frame simply arrives nowhere, and the sender never gets an answer. At this level there is no refusal — only silence. This is the first rule of troubleshooting, and we will come back to it: silence and refusal are different symptoms.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('a', 'lan'),
      intro: bi('Вы работаете на машине a в локальной сети. За тем же коммутатором стоят машины b с адресом 192.168.1.20 и c с адресом 192.168.1.30.', 'Machine a on a local network with machines b (192.168.1.20) and c (192.168.1.30) behind one switch.'),
      tasks: [
        {
          id: 'mac',
          prompt: bi('Найдите MAC-адрес интерфейса eth0 и запишите его в файл ~/mac.txt.', 'Find the MAC address of the eth0 interface and write it into ~/mac.txt.'),
          check: { when: "files['/root/mac.txt'].text~'02:42:ac:11:00:0a'", fail: [{ if: "files['/root/mac.txt'].text~'ff:ff:ff:ff:ff:ff'", say: bi('Адрес ff:ff:ff:ff:ff:ff в строке link/ether стоит после слова brd и означает широковещательный адрес. MAC-адрес самой карты стоит в этой строке первым.', 'ff:ff:ff:ff:ff:ff on the link/ether line is brd, the broadcast address. The card’s MAC is the first one.') }] },
          chips: 'ip link show eth0',
          docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip addr' },
          hints: {
            H1: bi('MAC-адрес принадлежит интерфейсу, и показывает его команда ip.', 'The MAC is a property of the interface; the ip command shows it.'),
            H2: bi('Выполните ip link show eth0 и найдите строку link/ether, а затем запишите адрес командой echo … > ~/mac.txt.', 'ip link show eth0 — look at the link/ether line. Then echo … > ~/mac.txt.'),
            H3: bi('Подойдёт и команда ip link show eth0 > ~/mac.txt, потому что проверка ищет MAC-адрес в содержимом файла.', 'ip link show eth0 > ~/mac.txt works too: the check looks for the MAC in the file.'),
          },
        },
        {
          id: 'neighbour',
          prompt: bi('Отправьте соседу b один эхо-запрос командой ping -c 1 192.168.1.20, а затем посмотрите кадры командой tcpdump -n -e. Запишите MAC-адрес машины b в файл ~/b.txt.', 'Send neighbour b one echo request (ping -c 1 192.168.1.20), then look at the frames with tcpdump -n -e. Write b’s MAC address into ~/b.txt.'),
          check: { when: "files['/root/b.txt'].text~'02:42:ac:11:00:14'", fail: [{ if: "files['/root/b.txt'].text~'02:42:ac:11:00:0a'", say: bi('Это ваш собственный MAC-адрес. В строке вывода tcpdump -e слева от знака > стоит отправитель, а справа получатель.', 'That is your own MAC. In a tcpdump -e line the sender is left of > and the receiver right of it.') }] },
          chips: 'ping -c 1 192.168.1.20; tcpdump -n -e',
          hints: {
            H1: bi('В выводе tcpdump -e после времени идут MAC-адрес отправителя, знак > и MAC-адрес получателя.', 'In tcpdump -e output, after the time come the sender MAC > the receiver MAC.'),
            H2: bi('Перед эхо-запросом вы увидите два служебных кадра: вопрос «у кого адрес 192.168.1.20?» и ответ на него. Как называется этот обмен, вы узнаете через урок. MAC-адрес машины b записан в ответе.', 'Before the echo request you will see two service frames — the question “who has 192.168.1.20?” and the answer. We name them in two lessons. b’s MAC is in the answer.'),
          },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите на странице tcpdump(8) флаг, который добавляет к каждой строке MAC-адреса кадра, и покажите с его помощью кадры, которые уже прошли через eth0.', 'Find the tcpdump(8) flag that adds the frame’s MAC addresses to every line, and show the frames that have already crossed eth0.'),
      ref: { page: 'man/tcpdump.8', anchor: 'OPTIONS', line: '-e' },
      terminal: {
        setup: lab('a', 'lan', undefined, undefined, [{ icmp: '192.168.1.20', count: 2 }]),
        task: {
          id: 'e',
          prompt: bi('Покажите кадры вместе с их MAC-адресами.', 'Show the frames with their MAC addresses.'),
          check: { stdout: /[0-9a-f]{2}(:[0-9a-f]{2}){5} > [0-9a-f]{2}(:[0-9a-f]{2}){5}, ethertype/ },
          docStep: 3,
          chips: 'tcpdump -n -e',
          hints: { H1: bi('Этот флаг состоит из одной буквы, а его описание начинается словами «Print the link-level header».', 'It is a one-letter flag; its description starts with “Print the link-level header”.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.frames.flood', 'net.q.frames.scope', 'net.q.frames.label'] },
  ],
};

// ── 3. IP addresses and subnets ────────────────────────────────────────────

export const subnets: Lesson = {
  id: 'networks.subnets',
  block: 'networks',
  title: bi('IP-адрес и подсеть', 'IP addresses and subnets'),
  summary: bi('Урок об адресе, который говорит, где находится машина. В нём разобраны сетевая часть адреса и номер машины, маска и префикс, частные диапазоны адресов, а ещё в уроке есть калькулятор подсетей и тренажёр для отработки расчётов.', 'An address by place, not by card: network and host, mask and prefix, private ranges. With a calculator and a drill.'),
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
        'В блоке Linux команда `ip a` показывала строку вроде `inet 10.0.2.15/24`. Первая часть этой записи, сам адрес, вам уже знакома, но что означает `/24`? И почему машина 10.0.2.15 обменивается пакетами с 10.0.2.20 напрямую, а с 10.0.3.20 уже нет, хотя адреса отличаются одной цифрой?',
        'In the Linux block `ip a` showed a line like `inet 10.0.2.15/24`. You recognised the address. But what does `/24` mean? And why does machine 10.0.2.15 talk to 10.0.2.20 directly but not to 10.0.3.20, though the addresses differ by one digit?',
      ),
    },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Как адрес делится на сеть и хост', 'Network and host'),
      body: bi(
        'MAC-адрес служит номером карты и не говорит, где эта карта стоит. Чтобы пакет нашёл машину на другом конце света, нужен адрес, который указывает на место в сети, и такой адрес называется [[net.ip|IP-адресом]]. Он занимает 32 бита, и его записывают четырьмя числами от 0 до 255, например `192.168.1.10`. Каждое число занимает один байт, то есть восемь бит, и его называют октетом.\n\nIP-адрес состоит из двух частей. Старшие биты задают номер сети, как название улицы, а младшие биты задают номер машины в этой сети, как номер дома. Где проходит граница между ними, говорит [[net.cidr|префикс CIDR]], то есть число после косой черты. Запись `/24` означает, что первые 24 бита отведены под номер сети, то есть первые три числа, а на номера машин остаётся 8 бит. Ту же границу можно записать маской из 24 единиц и 8 нулей, `255.255.255.0`. Префикс и маска описывают одну и ту же границу двумя разными способами.\n\nВсе адреса с одинаковой сетевой частью образуют [[net.subnet|подсеть]]. Подсеть `192.168.1.0/24` включает адреса от `192.168.1.0` до `192.168.1.255`. Первый из них служит адресом самой сети, а последний широковещательным адресом, то есть адресом «всем в подсети», и машинам эти два адреса не выдают. Для машин остаётся 2⁸ − 2 = 254 адреса. При префиксе `/26` на номера машин остаётся 6 бит, и адресов получается 2⁶ − 2 = 62. Чем длиннее префикс, тем меньше подсеть.\n\nГлавное правило состоит в том, что машины одной подсети обмениваются пакетами напрямую, кадрами по MAC-адресам. Ядро проверяет это само. Оно накладывает маску на адрес получателя и сравнивает результат с сетевой частью своего адреса. Если они совпали, ядро отправляет пакет прямо соседу. Если не совпали, значит, получатель находится в другой подсети, и напрямую до него не достать. Как ядро поступает в этом случае, вы узнаете в уроке про маршрутизацию, а если подходящего маршрута нет, ядро отказывается отправлять пакет и пишет `Network is unreachable`.\n\nНекоторые диапазоны отведены под внутренние сети и в интернете не используются: `10.0.0.0/8`, `172.16.0.0/12` и `192.168.0.0/16`, описанные в RFC 1918. Адрес из этих диапазонов называется [[net.private|частным адресом]]. Такой адрес одновременно используют миллионы квартир и офисов, поэтому за пределами своей сети он ничего не значит. Есть ещё два особых адреса: `127.0.0.1` обозначает саму машину (его называют loopback), а адрес вида `169.254.x.x` машина назначает себе сама, когда не дождалась настоящего адреса.',
        'A MAC address is a card’s number; it does not say where the card is. For a packet to find a machine at the other end of the world, you need an address by place — an [[net.ip|IP address]]. It is 32 bits written as four numbers from 0 to 255: `192.168.1.10`. Each number is one byte, eight bits; it is called an octet.\n\nAn IP address has two parts. The high bits are the network number: “the street”. The low bits are the machine’s number in that network: “the house”. Where the border runs is told by the [[net.cidr|CIDR prefix]] — the number after the slash. `/24` means “the first 24 bits are the network”, i.e. the first three numbers; 8 bits are left for hosts. The same is written as a mask: 24 ones and 8 zeros — `255.255.255.0`. Prefix and mask are two spellings of one border.\n\nAll addresses with the same network part make up a [[net.subnet|subnet]]. `192.168.1.0/24` is the addresses from `192.168.1.0` to `192.168.1.255`. The first of them is the address of the network itself, the last is the broadcast, “everyone in the subnet”; machines do not get them. That leaves 2⁸ − 2 = 254 host addresses. With `/26` hosts get 6 bits: 2⁶ − 2 = 62. The longer the prefix, the smaller the subnet.\n\nAnd the main rule: machines of one subnet talk to each other directly, with frames by MAC. The kernel checks this itself: it applies the mask to the destination address and compares the result with the network part of its own address. A match — it sends straight to the neighbour. No match — the neighbour is not in this subnet and cannot be reached directly. What the kernel does then you will learn in the routing lesson; if no route fits, the kernel refuses to send the packet and says `Network is unreachable`.\n\nSome ranges are set aside for internal networks and are not used on the internet: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918). An address from them is a [[net.private|private address]]: the same one exists in millions of flats and offices at once, so outside it means nothing. Two more are special: `127.0.0.1` is the machine itself (loopback), and `169.254.x.x` is an address a machine gives itself when it did not get a real one.',
      ),
    },
    { id: 'calc', kind: 'widget', step: 'look', widget: 'net.subnet-calc', props: { cidr: '192.168.10.37/26' } },
    {
      id: 'ipv6',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      title: bi('Как обстоят дела с IPv6', 'What about IPv6?'),
      body: bi(
        'IPv6 устроен по тому же принципу, только адрес занимает 128 бит и записывается восемью группами шестнадцатеричных цифр, например `2001:db8::1`, где знак `::` заменяет пропущенные нули. Адрес `::1` обозначает саму машину, а адреса из `fe80::/10` интерфейс получает сам; их видно в выводе `ip a` в строках `inet6 fe80::…`. В облаках и кластерах IPv6 встречается всё чаще, но на собеседованиях для начинающих почти всегда спрашивают про IPv4, поэтому с него мы и начинаем.',
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
      intro: bi('Машину h1 только что подключили к подсети 10.0.1.0/24, и адреса у неё ещё нет. Её сосед h3 имеет адрес 10.0.1.20, а в соседней подсети 10.0.2.0/24 работает машина h2 с адресом 10.0.2.10.', 'Host h1 has just been connected to subnet 10.0.1.0/24 and has no address yet. Neighbour h3 is 10.0.1.20; host h2 lives in the next subnet 10.0.2.0/24 at 10.0.2.10.'),
      tasks: [
        {
          id: 'addr',
          prompt: bi('Назначьте интерфейсу eth0 адрес 10.0.1.10 в подсети /24.', 'Give the eth0 interface the address 10.0.1.10 in a /24 subnet.'),
          check: {
            when: "net.ifaces[name=eth0].addrs has '10.0.1.10/24'",
            fail: [{ if: "net.ifaces[name=eth0].addrs has '10.0.1.10/32'", say: bi('Адрес назначен без префикса, поэтому ядро считает его адресом /32, то есть подсетью из одного адреса. Укажите префикс /24.', 'The address was set without a prefix — the kernel treats it as /32, a subnet of one address. Give /24.') }],
          },
          chips: 'ip addr add 10.0.1.10/24 dev eth0',
          docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip addr' },
          hints: {
            H1: bi('Адрес назначают командой ip с объектом address.', 'An address is set with the ip command, object address.'),
            H2: bi('Команда выглядит так: ip addr add АДРЕС/ПРЕФИКС dev ИНТЕРФЕЙС.', 'ip addr add ADDRESS/PREFIX dev INTERFACE'),
            H3: bi('ip addr add 10.0.1.10/24 dev eth0', 'ip addr add 10.0.1.10/24 dev eth0'),
          },
        },
        {
          id: 'neighbour',
          prompt: bi('Убедитесь, что сосед по подсети с адресом 10.0.1.20 отвечает на ping.', 'Make sure the neighbour 10.0.1.20 in your subnet answers a ping.'),
          check: { stdout: /bytes from 10\.0\.1\.20/ },
          chips: 'ping -c 2 10.0.1.20',
          hints: { H1: bi('Наберите ping -c 2 и адрес соседа.', 'ping -c 2 and the neighbour’s address.') },
        },
        {
          id: 'other',
          prompt: bi('Теперь отправьте ping машине h2 с адресом 10.0.2.10 и прочитайте, что ответит ядро.', 'Now try to ping h2 — 10.0.2.10 — and read what the kernel says.'),
          check: { stdout: /Network is unreachable/ },
          chips: 'ping -c 2 10.0.2.10',
          hints: { H1: bi('Наложите маску /24 на адрес 10.0.2.10 и проверьте, совпадает ли получившаяся сеть с вашей сетью 10.0.1.0.', 'Apply the /24 mask to 10.0.2.10: does the network match your 10.0.1.0?') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi(
        'Вывод `ip addr` подробный: на каждый интерфейс приходится по пять-шесть строк, и на машине с десятком интерфейсов адреса теряются среди служебных подробностей. Найдите на странице ip(8) параметр, который печатает по одной строке на интерфейс с его именем, состоянием и адресами, и покажите с его помощью адреса машины.',
        'The output of `ip addr` is detailed: five or six lines per interface, and on a machine with a dozen interfaces the addresses get lost among the details. Find the ip(8) option that prints one line per interface — the name, the state and the addresses — and show the machine’s addresses that way.',
      ),
      ref: { page: 'man/ip.8', anchor: 'OPTIONS', line: '-br, -brief' },
      terminal: {
        setup: lab('h1', 'two-subnets'),
        task: {
          id: 'brief',
          prompt: bi('Покажите адреса машины по одной строке на интерфейс.', 'The machine’s addresses — one line per interface.'),
          check: { stdout: /^eth0\s+UP\s+10\.0\.1\.10\/24/m },
          docStep: 3,
          chips: 'ip -br a',
          hints: { H1: bi('Параметры команды ip пишут перед объектом: `ip ПАРАМЕТР addr`. Ищите в разделе OPTIONS слово «tabular».', 'ip options go before the object: `ip OPTION addr`. Look for the word “tabular” in OPTIONS.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.sub.hosts', 'net.q.sub.private', 'net.q.sub.same', 'net.q.sub.mask'] },
  ],
};

// ── 4. ARP ─────────────────────────────────────────────────────────────────

export const arp: Lesson = {
  id: 'networks.arp',
  block: 'networks',
  title: bi('Как протокол ARP находит сетевую карту по IP-адресу', 'ARP: from an address to a card'),
  summary: bi('Ядро знает IP-адрес соседа, а для кадра нужен его MAC-адрес. В уроке разберём, как один адрес превращается в другой и почему иногда об ошибке сообщает сам отправитель.', 'The kernel knows the neighbour’s IP address, but a frame needs a MAC. How one becomes the other and why the sender itself sometimes reports the error.'),
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
        'В уроке про кадры перед эхо-запросом в выводе tcpdump промелькнули два служебных кадра, вопрос и ответ. Теперь разберёмся, откуда они взялись. Ядро знает IP-адрес соседа, 10.0.1.20, и знает, что сосед находится в той же подсети. Но отправить кадр на IP-адрес нельзя, потому что в заголовке кадра есть место только для MAC-адреса. Где же ядру взять MAC-адрес соседа?',
        'In the frames lesson, before the echo request, two service frames flashed by in the tcpdump output: a question and an answer. Here is where they come from. The kernel knows the neighbour’s IP address — 10.0.1.20 — and knows it is in the same subnet. But a frame cannot be sent to an IP address: the frame header has room only for a MAC. Where does it get one?',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как машина спрашивает MAC-адрес соседа', 'How a machine asks for a neighbour’s MAC'),
      body: bi(
        'Схема ниже показывает, как ядро получает недостающий MAC-адрес. Компьютер A с адресом 192.168.1.10 хочет отправить эхо-запрос соседу B с адресом 192.168.1.20, а в той же сети за коммутатором стоит ещё компьютер C. Под названием каждого компьютера показано, что записано в его ARP-кэше, то есть в таблице, где ядро хранит уже найденные MAC-адреса соседей.',
        'The diagram below shows how the kernel gets the missing MAC address. Computer A (192.168.1.10) wants to send an echo request to its neighbour B (192.168.1.20); computer C sits on the same network behind the switch. Under each computer’s name you see what is in its ARP cache, the table where the kernel keeps the neighbours’ MAC addresses it has already found.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.arp', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен блок, который работает сейчас, и облачко рядом с ним говорит, что он делает. По кабелям движутся карточки: вопрос `who-has .20`, ответ `is-at …:14` и сам эхо-запрос `echo`. Рамка ожидания у компьютера A означает, что пакет ждёт, пока найдётся MAC-адрес. Остальные значки объяснены в легенде под схемой.\n\nСначала пройдите схему с пустым кэшем. Потом включите над схемой параметр, при котором MAC-адрес соседа уже записан в кэше, и посчитайте кадры ARP. Напоследок выключите компьютер B в блоке «Сломать» и прочитайте, с какого адреса придёт сообщение об ошибке.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the block working now is highlighted, and the callout next to it says what it does. Cards travel along the cables: the question `who-has .20`, the answer `is-at …:14` and the echo request `echo` itself. A waiting outline on computer A means the packet waits for the MAC address. The legend under the diagram explains the other marks.\n\nWalk through with an empty cache first. Then switch on the knob that puts the neighbour’s MAC into the cache and count the ARP frames. Finally switch computer B off in “Break it” and read from which address the error comes.'), caption: bi('На схеме ответ всегда давал один сосед, а остальные молчали. В следующем разделе разберём этот обмен подробнее, вместе с ARP-кэшем и ошибкой, которую пишет сам отправитель.', 'In the diagram one neighbour always answered while the rest stayed silent. The next section looks at this exchange in detail, with the ARP cache and the error the sender writes itself.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Вопрос получают все, а отвечает один', 'A question to all, an answer from one'),
      body: bi(
        'Ядро спрашивает об этом всю сеть по протоколу [[net.arp|ARP]] (Address Resolution Protocol). Вопрос уходит широковещательным кадром на адрес `ff:ff:ff:ff:ff:ff` и звучит так: «У кого адрес 192.168.1.20? Ответьте 192.168.1.10». Этот кадр слышат все машины подсети. Машины с другими адресами молчат, а машина с адресом 192.168.1.20 отвечает спросившему обычным кадром: «192.168.1.20 is-at 02:42:ac:11:00:14».\n\nОтвет ядро записывает в [[net.arp-cache|ARP-кэш]], то есть в таблицу соответствия IP-адресов и MAC-адресов, которую показывает команда `ip neigh` (раньше для этого служила команда `arp -n`). Пока запись свежая, спрашивать заново не нужно, и следующие пакеты уходят сразу. Запись хранится, пока ею пользуются, а без трафика она устаревает, получает пометку STALE и при следующем пакете проверяется заново. Отвечающая машина заодно запоминает MAC-адрес спросившей, потому что он был указан в вопросе.\n\nЕсли никто не ответил, ядро повторяет вопрос ещё два раза и прекращает попытки. Пакет так и не уходит в сеть, потому что не нашлось, кому отдать кадр. Тогда ping пишет `From 192.168.1.10 icmp_seq=1 Destination Host Unreachable`. Обратите внимание на адрес в этой строке: это ваш собственный адрес, и ошибку сообщает ваше же ядро, а в выводе `ip neigh` у соседа появляется состояние `FAILED`. Такой симптом означает, что соседа с этим адресом в вашей сети нет: он выключен, подключён не тем кабелем или в адресе опечатка.\n\nНапоследок подумайте над загадкой. ARP работает только внутри подсети, потому что широковещательный кадр за её пределы не уходит. Что, если получатель находится в другой подсети? MAC-адрес какого устройства тогда должна искать машина? Ответ вы найдёте в следующем уроке.',
        'The kernel asks. The protocol of the question is called [[net.arp|ARP]] (Address Resolution Protocol). The question goes out as a broadcast frame to `ff:ff:ff:ff:ff:ff`: “Who has 192.168.1.20? Tell 192.168.1.10.” Every machine in the subnet hears it. Those with other addresses stay silent. The machine with 192.168.1.20 answers the asker with an ordinary frame: “192.168.1.20 is-at 02:42:ac:11:00:14.”\n\nThe kernel writes the answer into the [[net.arp-cache|ARP cache]] — an “IP → MAC” table shown by `ip neigh` (the old command is `arp -n`). While the entry is fresh, no questions are needed: the next packets go straight away. An entry lives while it is used; without traffic it goes stale (STALE) and is re-checked on the next packet. The answering machine has also remembered the asker’s MAC — it was in the question, after all.\n\nIf nobody answers, the kernel asks twice more and gives up. The packet never leaves: there was nobody to hand the frame to. ping then prints `From 192.168.1.10 icmp_seq=1 Destination Host Unreachable` — note the address: it is you. Your own kernel reports the error, and `ip neigh` shows the neighbour as `FAILED`. This symptom says: there is no neighbour with that address on your network — it is off, the wrong cable, a typo in the address.\n\nAnd a riddle to finish. ARP works only inside a subnet: a broadcast frame goes no further. What if the destination is in another subnet? Whose MAC must the host look for then? The answer is in the next lesson.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('a', 'lan', { cOff: true }),
      intro: bi('Вы работаете на машине a с адресом 192.168.1.10. Её сосед b имеет адрес 192.168.1.20, а машина c с адресом 192.168.1.30 сегодня выключена.', 'Machine a (192.168.1.10). Neighbour b is 192.168.1.20. Machine c (192.168.1.30) is switched off today.'),
      tasks: [
        {
          id: 'learn',
          prompt: bi('ARP-кэш пуст. Отправьте один эхо-запрос соседу b и убедитесь, что в кэше появилась запись о нём.', 'The ARP cache is empty. Send one echo request to neighbour b and make sure an entry for it has appeared in the cache.'),
          check: { when: "net.neigh[ip='192.168.1.20'].state=REACHABLE" },
          chips: 'ping -c 1 192.168.1.20; ip neigh',
          docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip neigh' },
          hints: { H1: bi('Кэш заполняется сам, когда ядру нужно отправить пакет.', 'The cache fills by itself when the kernel needs to send a packet.'), H2: bi('Выполните ping -c 1 192.168.1.20, а затем ip neigh.', 'ping -c 1 192.168.1.20, then ip neigh.') },
        },
        {
          id: 'see',
          prompt: bi('Покажите в захвате только кадры ARP, то есть вопрос who-has и ответ is-at.', 'Show only the ARP frames in the capture — the who-has question and the is-at answer.'),
          check: { stdout: /is-at 02:42:ac:11:00:14/ },
          chips: 'tcpdump -n arp',
          docRef: { page: 'man/tcpdump.8', anchor: 'EXPRESSION', line: 'arp' },
          hints: { H1: bi('В конце команды tcpdump можно написать фильтр, например имя протокола.', 'At the end of a tcpdump line you can write a filter: the protocol name.'), H2: bi('tcpdump -n arp', 'tcpdump -n arp') },
        },
        {
          id: 'failed',
          prompt: bi('Отправьте эхо-запрос выключенной машине c с адресом 192.168.1.30. Прочитайте, кто сообщает об ошибке, и посмотрите, что изменилось в ARP-кэше.', 'Send an echo request to the switched-off machine c (192.168.1.30). Read who writes the error and see what is now in the ARP cache.'),
          check: { when: "net.neigh[ip='192.168.1.30'].state=FAILED" },
          chips: 'ping -c 2 192.168.1.30; ip neigh',
          hints: { H1: bi('Ошибка придёт с вашего же адреса, потому что ядро не нашло, кому отдать кадр.', 'The error comes from your own address — the kernel found nobody to hand the frame to.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Страница ip(8) описывает сразу много объектов: адреса, интерфейсы, маршруты и соседей. Найдите раздел, в котором эти объекты перечислены, и нажмите на него.', 'The ip(8) page describes many objects at once: addresses, interfaces, routes, neighbours. In which section are these objects listed? Click it.'),
      ref: { page: 'man/ip.8' },
      answer: 'OBJECTS',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.arp.who', 'net.q.arp.unreach', 'net.q.arp.order'] },
  ],
};

// ── 5. Routing and ICMP ────────────────────────────────────────────────────

export const routing: Lesson = {
  id: 'networks.routing',
  block: 'networks',
  title: bi('Маршрутизация и служебные сообщения ICMP', 'Routing and ICMP'),
  summary: bi('Как пакет выходит за пределы своей подсети. В уроке разобраны таблица маршрутов, шлюз, правило самого длинного префикса, TTL и служебные сообщения сети.', 'A packet leaves its subnet: the routing table, the gateway, the longest prefix, TTL and the network’s service messages.'),
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
        'Два урока назад ядро машины h1 отказалось отправлять пакет на 10.0.2.10 и написало `Network is unreachable`. Адрес находится в чужой подсети, и напрямую до него не достать. Значит, пакету нужно выйти за пределы своей подсети, а для этого нужен посредник, который подключён к обеим подсетям.',
        'Two lessons ago h1 could not reach 10.0.2.10: `Network is unreachable`. The address is in another subnet and cannot be reached directly. So the packet has to go “out of the door” of its subnet — and that needs someone who stands in both.',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Маршрутизатор и таблица маршрутов', 'The router and the routing table'),
      body: bi(
        '[[net.router|Маршрутизатором]] (router) называют машину, которая подключена сразу к нескольким подсетям и соглашается пересылать чужие пакеты. В работе DevOps-инженера это почти всегда обычная машина с Linux и двумя сетевыми картами, у которой включён параметр `net.ipv4.ip_forward=1`. Без этого параметра машина с двумя картами маршрутизатором не становится: пакеты, адресованные не ей, она молча выбрасывает.\n\nКуда отправить пакет, ядро решает по [[net.route-table|таблице маршрутов]], которую показывает команда `ip route`. Каждая строка таблицы говорит, куда направлять пакеты, через кого и через какой интерфейс. Строки вида `10.0.1.0/24 dev eth0 proto kernel scope link` ядро добавило само, когда интерфейсу назначили адрес, и они означают, что своя подсеть доступна напрямую. Строку `default via 10.0.1.1 dev eth0` добавил администратор или выдал сервер адресов, и она означает, что все остальные адреса доступны через [[net.gateway|шлюз по умолчанию]] 10.0.1.1.\n\nЕсли адресу подходят несколько строк, выбирается строка с [[net.lpm|самым длинным префиксом]] (longest prefix match): префикс `/24` точнее префикса `/16`, а `default` означает `0.0.0.0/0`, то есть префикс нулевой длины, который подходит любому адресу и проигрывает любой другой строке. Порядок строк в таблице значения не имеет. Какую строку ядро выберет для конкретного адреса, показывает команда `ip route get 10.0.2.10`.\n\nТеперь можно разгадать загадку из урока про ARP. Если получатель находится в чужой подсети, пакет пойдёт к шлюзу, а значит, кадру нужен MAC-адрес *шлюза*. Машина спрашивает по ARP, у кого адрес 10.0.1.1, и в кадре с пакетом для 10.0.2.10 получателем указывает MAC-адрес маршрутизатора.',
        'A [[net.router|router]] is a machine connected to several subnets at once and willing to forward other machines’ packets. In DevOps it is almost always ordinary Linux with two network cards and the `net.ipv4.ip_forward=1` setting turned on. Without it, a machine with two cards is just a machine with two cards: packets not addressed to it are silently dropped.\n\nThe kernel decides where to send a packet by the [[net.route-table|routing table]] — `ip route` shows it. Each line says “where to — via whom — through which interface”. Lines like `10.0.1.0/24 dev eth0 proto kernel scope link` were added by the kernel itself when the interface got an address: its own subnet is reachable directly. The line `default via 10.0.1.1 dev eth0` was added by the administrator or given by an address server: everything else goes through the [[net.gateway|default gateway]] 10.0.1.1.\n\nIf several lines match, the [[net.lpm|longest prefix match]] wins: `/24` is more specific than `/16`, and `default` is `0.0.0.0/0`, a prefix of length zero that matches everything and loses to everything. The order of lines does not matter. To see which line the kernel picks for an address, use `ip route get 10.0.2.10`.\n\nNow the answer to the riddle of the ARP lesson. If the destination is in another subnet, the packet goes to the gateway — so the frame needs the *gateway’s* MAC. The host asks over ARP “who has 10.0.1.1?”, and in the frame carrying the packet for 10.0.2.10 the receiver is the router’s MAC.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как пакет проходит через маршрутизатор', 'How a packet crosses a router'),
      body: bi(
        'Схема ниже показывает пакет, которому нужно попасть из одной подсети в другую. Машина h1 из подсети 10.0.1.0/24 отправляет эхо-запрос машине h2 из подсети 10.0.2.0/24, а между подсетями стоит маршрутизатор r1. В верхнем ряду расположены сами машины, а под каждой из них её таблица маршрутов. Сначала на схеме только h1 и её таблица, а маршрутизатор, вторая подсеть и h2 появляются, когда до них доходит пакет.',
        'The diagram below shows a packet that has to get from one subnet to another. Machine h1 in subnet 10.0.1.0/24 sends an echo request to h2 in subnet 10.0.2.0/24, and router r1 stands between the subnets. The machines are in the top row, and under each one is its routing table. At first only h1 and its table are shown; the router, the second subnet and h2 appear when the packet reaches them.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.route', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен блок, который работает сейчас, и облачко рядом с ним говорит, что он делает: «Компьютер h1 выбирает строку default, и пакет пойдёт через шлюз 10.0.1.1». По линии подсети движется карточка с пакетом и его TTL, например `TTL 64`. Значки и цвета рамок объяснены в легенде под схемой.\n\nПосле первого прохода уменьшите TTL над схемой до единицы и посмотрите, кто сообщит о выброшенном пакете. Потом уберите у h2 маршрут обратно и найдите, на каком шаге ping превращается в «пинг в одну сторону». Напоследок включите обе поломки в блоке «Сломать» и сравните сообщения: «Network is unreachable» при удалённом маршруте и «Destination Host Unreachable» при выключенном маршрутизаторе.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the block working now is highlighted, and the callout next to it says what it does. A card with the packet and its TTL, such as `TTL 64`, travels along the subnet. The legend under the diagram explains the pictograms and outline colours.\n\nAfter the first pass lower the TTL above the diagram to one and see who reports the dropped packet. Then remove h2’s route back and find the step where ping becomes a one-way ping. Finally switch on both breaks in “Break it” and compare the messages: “Network is unreachable” with the route deleted and “Destination Host Unreachable” with the router off.'), caption: bi('На схеме IP-адреса пакета не менялись, а MAC-адреса кадра менялись на каждом участке, и TTL уменьшался на маршрутизаторе. В следующем разделе разберём, почему так устроено и что маршрутизатор сообщает, когда выбрасывает пакет.', 'In the diagram the packet’s IP addresses did not change, the frame’s MAC addresses changed on every segment, and the TTL went down at the router. The next section explains why, and what the router reports when it drops a packet.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Что меняется в пакете по дороге: TTL и сообщения ICMP', 'What changes on the way. TTL and ICMP'),
      body: bi(
        'Маршрутизатор снимает кадр, читает IP-адрес получателя, выбирает строку своей таблицы и кладёт пакет в *новый* кадр, где отправителем указан MAC-адрес его второго интерфейса, а получателем MAC-адрес следующего устройства. IP-адреса от начала до конца пути не меняются, а MAC-адреса меняются на каждом участке. Это стоит запомнить: IP-адрес говорит, куда пакет должен попасть в итоге, а MAC-адрес говорит, кому кадр передаётся сейчас.\n\nЕщё одно поле маршрутизатор меняет всегда. Это [[net.ttl|TTL]] (time to live), время жизни пакета. Отправитель ставит его, например, равным 64, каждый маршрутизатор уменьшает его на единицу, а пакет, у которого TTL дошёл до нуля, выбрасывается. Так сеть защищена от петель: пакет, который заблудился между двумя маршрутизаторами, не будет ходить по кругу вечно. По TTL ответа видно, сколько маршрутизаторов прошёл пакет: если пришло 61, значит, их было три.\n\nВыбросив пакет, маршрутизатор сообщает об этом отправителю. Такие служебные сообщения сети передаёт протокол [[net.icmp|ICMP]]: «время жизни истекло» (Time to live exceeded), «сеть недостижима», «порт недостижим». Тот же ICMP переносит эхо-запрос и эхо-ответ, которыми пользуется `ping`, так что теперь вы знаете, по какому протоколу работает ping.\n\nНа этом построен `traceroute`. Он отправляет пакеты с TTL, равным 1, 2, 3 и так далее. Первый маршрутизатор на пути обнуляет TTL первого пакета и отвечает со своего адреса, что время жизни истекло, и тем самым называет себя. Второй маршрутизатор называет себя на втором пакете, и так до самой цели. Строка `* * *` означает, что ответа не пришло. Узел в предыдущей строке ответил, значит, он работает, а проверять нужно следующий узел и маршрут в обратную сторону.\n\nНапоследок запомните, что маршрут нужен в обе стороны. Если у получателя нет пути к вашей подсети, запрос до него дойдёт, а ответ нет. Этот частый и коварный случай называют «пингом в одну сторону».',
        'A router strips the frame, reads the destination IP address, picks a line of its table and puts the packet into a *new* frame — with the MAC of its second interface and the MAC of the next receiver. IP addresses stay the same from the start of the path to the end; MAC addresses change on every segment. Worth remembering: “IP says where in the end, MAC says to whom right now”.\n\nOne more field a router always changes — [[net.ttl|TTL]], time to live. The sender sets it to, say, 64; every router decrements it by one, and a packet with zero TTL is dropped. This protects the network from loops: a packet lost between two routers will not circle forever. The TTL of an answer tells how many routers the packet passed: 61 arrived — so three.\n\nHaving dropped a packet, the router tells the sender. The network’s service messages are carried by [[net.icmp|ICMP]]: “Time to live exceeded”, “network unreachable”, “port unreachable”. The same ICMP carries the echo request and echo reply that `ping` uses — now it has a name.\n\n`traceroute` is built on this. It sends packets with TTL 1, 2, 3… The first router on the way zeroes the TTL of the first packet and answers “time exceeded” from its own address — that is how it names itself. The second names itself on the second packet, and so on to the target. A `* * *` line means no answer came. The node on the line before answered, so it is alive; look further — at the next node and at the route back.\n\nAnd last: a route is needed in both directions. If the receiver has no path to your subnet, the request arrives and the reply does not. This is the common and treacherous “one-way ping”.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('h1', 'two-subnets', {}, [{ id: 'p', kind: 'icmp', to: '10.0.2.10', count: 3 }]),
      intro: bi('Вы работаете на машине h1 с адресом 10.0.1.10/24, а рядом стоит маршрутизатор r1 с адресами 10.0.1.1 и 10.0.2.1. Маршрута по умолчанию у h1 нет.', 'h1 (10.0.1.10/24) and router r1 (10.0.1.1 and 10.0.2.1). h1 has no default route.'),
      tasks: [
        {
          id: 'route',
          prompt: bi('Сделайте так, чтобы h1 могла отправить ping машине h2 с адресом 10.0.2.10 через маршрутизатор r1.', 'Make h1 able to ping h2 (10.0.2.10) through router r1.'),
          check: {
            when: "(net.routes[dst=default].gateway='10.0.1.1' || net.routes[dst='10.0.2.0/24'].gateway='10.0.1.1') && reach.p.received>=2",
            fail: [{ if: "!net.routes[dst=default] && !net.routes[dst='10.0.2.0/24']", say: bi('У h1 нет маршрута, который подходит к адресу 10.0.2.10. Посмотрите вывод ip route get 10.0.2.10.', 'h1 has no route that matches 10.0.2.10. Look at ip route get 10.0.2.10.') }],
          },
          chips: 'ip route add default via 10.0.1.1',
          docRef: { page: 'man/ip.8', anchor: 'EXAMPLES', line: 'ip route' },
          concepts: ['net.gateway', 'net.route-table'],
          hints: {
            H1: bi('Машина h1 не знает, через кого отправлять пакеты в чужие подсети, и ей нужен шлюз.', 'h1 does not know whom to go through to other subnets. It needs a gateway.'),
            H2: bi('Маршрут добавляют командой ip route add, а шлюзом служит адрес r1 в вашей подсети.', 'A route is added with ip route add; the gateway is r1’s address in your subnet.'),
            H3: bi('ip route add default via 10.0.1.1', 'ip route add default via 10.0.1.1'),
          },
        },
        {
          id: 'get',
          prompt: bi('Спросите ядро, какую строку таблицы оно выберет для пакета к 10.0.2.10.', 'Ask the kernel which table line it would pick for a packet to 10.0.2.10.'),
          check: { stdout: /10\.0\.2\.10 via 10\.0\.1\.1 dev eth0/ },
          chips: 'ip route get 10.0.2.10',
          hints: { H1: bi('У команды ip route есть подкоманда get.', 'ip route has a get subcommand.') },
        },
      ],
    },
    {
      id: 'lab-trace',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('h1', 'chain', { broken: true }),
      intro: bi('До сервера 10.20.0.5 ведёт цепочка из трёх маршрутизаторов, и где-то на этом пути сломан маршрут.', 'A chain of three routers to server 10.20.0.5. Somewhere on the way a route is broken.'),
      tasks: [
        {
          id: 'where',
          prompt: bi('Прочитайте вывод traceroute -n 10.20.0.5 и запишите в файл ~/last.txt адрес последнего узла, который ответил.', 'Read traceroute -n 10.20.0.5. Write the address of the last node that answered into ~/last.txt.'),
          check: {
            when: "files['/root/last.txt'].text~'10.0.12.2'",
            fail: [
              { if: "files['/root/last.txt'].text~'10.0.1.1'", say: bi('Адрес 10.0.1.1 принадлежит первому узлу. Он ответил, но после него ответил ещё один узел.', '10.0.1.1 is the first hop. It answered, but one more answered after it.') },
              { if: "files['/root/last.txt'].text~'10.20.0.5'", say: bi('Сервер не ответил, и в выводе стоят строки со звёздочками. Вам нужен последний адрес перед ними.', 'The server did not answer — those are the lines with asterisks. You need the last address before them.') },
            ],
          },
          chips: 'traceroute -n -m 6 10.20.0.5',
          hints: { H1: bi('Строки * * * означают, что ответа не было. Вам нужна последняя строка с адресом.', 'The * * * lines have no answer. You need the last line with an address.'), H2: bi('Узел, следующий за последним ответившим, не отправил назад сообщение «время жизни истекло», потому что у него нет маршрута обратно в сеть 10.0.1.0/24.', 'The node after it sent no “time exceeded” back — it has no route back to 10.0.1.0/24.') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите на странице ping(8) флаг, который задаёт TTL отправляемого пакета, и отправьте один эхо-запрос на 10.0.2.10 с TTL, равным 1. Ответить должен маршрутизатор.', 'Find the ping(8) flag that sets the TTL of the sent packet, and send one echo request to 10.0.2.10 with TTL 1 — the router should answer.'),
      ref: { page: 'man/ping.8', anchor: 'OPTIONS', line: '-t ttl' },
      terminal: {
        setup: lab('h1', 'two-subnets', { gw: true }),
        task: {
          id: 'ttl1',
          prompt: bi('Отправьте один эхо-запрос с TTL, равным 1, на адрес 10.0.2.10.', 'One echo request with TTL 1 to 10.0.2.10.'),
          check: { stdout: /From 10\.0\.1\.1 icmp_seq=1 Time to live exceeded/ },
          docStep: 3,
          chips: 'ping -c 1 -t 1 10.0.2.10',
          concepts: ['net.ttl', 'net.icmp'],
          hints: { H1: bi('Ищите в разделе OPTIONS слова «Time to Live».', 'In the OPTIONS section look for the words “Time to Live”.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.route.lpm', 'net.q.route.changes', 'net.q.route.trace', 'net.q.route.oneway'] },
  ],
};
