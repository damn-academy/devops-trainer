// Lessons 6–9 of the Networks block: ports, UDP and TCP; envelopes (OSI and
// TCP/IP); DNS; DHCP (03 §5.3, net.m05–m08).

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { lab } from './lessons-a';
import { EN, RU, src } from './sources';

// ── 6. Ports, UDP, TCP ─────────────────────────────────────────────────────

export const transport: Lesson = {
  id: 'networks.transport',
  block: 'networks',
  title: bi('Порты, UDP и TCP', 'Ports, UDP and TCP'),
  summary: bi('На одной машине работает много программ. В уроке разберём, как порт выбирает программу, чем UDP проще TCP и почему отказ и тишина указывают на разные неисправности.', 'One machine, many programs. How a port picks the program, why UDP is simpler than TCP and why “refused” and “silence” are different diagnoses.'),
  introduces: ['net.port', 'net.udp', 'net.tcp', 'net.handshake', 'net.ephemeral'],
  uses: ['net.ip', 'net.icmp', 'net.rtt', 'net.router'],
  tier: 'core',
  minutes: 40,
  sources: src([EN.rfc9293, EN.rfc768, EN.ss, EN.curl], [RU.tcp, RU.udp, RU.port]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В блоке Linux команда `ss -ltnp` показывала, какая программа слушает какой номер: nginx слушал порт 80, а sshd порт 22. Пакет пришёл на машину по IP-адресу, но как ядро понимает, кому его отдать, nginx или sshd?',
        'In the Linux block `ss -ltnp` showed which program listens on which number: nginx on 80, sshd on 22. A packet has reached the machine by its IP address — but how does the kernel know whether to give it to nginx or to sshd?',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Как порт выбирает программу', 'The port picks the program'),
      body: bi(
        'Внутри IP-пакета лежит ещё один конверт, который называют транспортным. В его заголовке записаны два числа от 0 до 65535: [[net.port|порт]] отправителя и порт получателя. Программа, которая хочет принимать соединения, просит ядро слушать определённый порт: nginx слушает порты 80 и 443, а sshd порт 22. Ядро смотрит на порт получателя в пришедшем пакете и отдаёт данные той программе, которая этот порт слушает. Общеизвестные порты закреплены договорённостью: 22 занимает SSH, 53 занимает DNS, 80 занимает HTTP, а 443 занимает HTTPS.\n\nПорт отправителя на стороне клиента ядро выбирает само при подключении, беря свободный номер из диапазона 32768–60999. Такой порт называется [[net.ephemeral|эфемерным]], то есть временным: он существует, пока существует соединение, и по нему ответ находит нужную программу, даже если на машине открыто сто вкладок браузера.\n\nТранспортных протоколов два. [[net.udp|UDP]] работает по принципу «отправил и забыл»: датаграмма уходит, никто не подтверждает её получение, и потерянное не отправляется заново. Зато UDP быстрый и простой, и поэтому по нему передают вопросы DNS, раздачу адресов и видео. [[net.tcp|TCP]] устанавливает соединение: каждый байт в нём пронумерован, получатель подтверждает принятое, отправитель повторяет то, что не подтвердили, а программе данные отдаются строго по порядку. На TCP работают HTTP, SSH и базы данных.',
        'Inside the IP packet lies one more envelope — the transport one. Its header carries two numbers: the sender’s [[net.port|port]] and the receiver’s port, from 0 to 65535. A program that wants to accept connections asks the kernel to “listen” on a port: nginx on 80 and 443, sshd on 22. The kernel looks at the destination port and hands the data to whichever program listens on it. Well-known ports are fixed by convention: 22 is SSH, 53 is DNS, 80 is HTTP, 443 is HTTPS.\n\nThe client’s source port is chosen by the kernel itself when connecting — a free one from the range 32768–60999. This is an [[net.ephemeral|ephemeral port]]: it lives as long as the connection, and the answer finds exactly this program by it, even with a hundred browser tabs open on the machine.\n\nThere are two transports. [[net.udp|UDP]] is “send and forget”: a datagram leaves, nobody confirms receipt, nothing lost is resent. But it is fast and simple — DNS questions, address hand-outs and video go this way. [[net.tcp|TCP]] is a connection: every byte is numbered, the receiver confirms what it got, the sender resends whatever was not confirmed and delivers the stream to the application strictly in order. HTTP, SSH and databases run on TCP.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как устанавливается соединение TCP', 'How a TCP connection is set up'),
      body: bi(
        'Схема ниже показывает обмен сообщениями между клиентом с адресом 10.0.0.1 и сервером с адресом 10.0.0.2, когда клиент подключается к порту 8080. Это диаграмма последовательности: клиент нарисован слева, сервер справа, а время на ней идёт сверху вниз. Каждое сообщение изображено стрелкой, и чем ниже стрелка, тем позже сообщение отправлено. Наклон стрелки показывает, что сообщению нужно время, чтобы дойти до другой стороны. Под названием каждой стороны показано состояние её сокета, то есть то же слово, которое вы увидите в выводе `ss`.',
        'The diagram below shows the messages exchanged when client 10.0.0.1 connects to port 8080 on server 10.0.0.2. It is a sequence diagram: the client is on the left, the server on the right, and time runs downwards. Each message is an arrow, and the lower the arrow, the later the message was sent. The slope of an arrow shows that a message takes time to arrive. Under each side’s name you see its socket state, the same word that `ss` prints.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.tcp', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждое сообщение появляется на схеме в тот момент, когда его отправляют, и по стрелке движется карточка с его названием: `SYN`, `SYN-ACK`, `ACK`. Облачко у подсвеченной стороны говорит, что она делает, а под схемой растут счётчики времени и числа путей туда и обратно. Значки и рамки объяснены в легенде под схемой.\n\nПосле первого прохода выберите над схемой вариант, при котором порт никто не слушает, и посмотрите, когда придёт отказ. Потом растяните время пути между машинами и проследите, как растёт время рукопожатия. Напоследок включите в блоке «Сломать» фильтр, который молча отбрасывает пакеты, и сравните, сколько времени клиент ждёт в этом случае.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. Each message appears when it is sent, and a card with its name travels along the arrow: `SYN`, `SYN-ACK`, `ACK`. The callout at the highlighted side says what it does, and under the diagram the counters of elapsed time and round trips grow. The legend under the diagram explains the marks.\n\nAfter the first pass choose the option where nobody listens on the port and see when the refusal comes. Then stretch the round-trip time and watch the handshake take longer. Finally switch on the filter that silently drops packets in “Break it” and compare how long the client waits.'), caption: bi('На схеме закрытый порт ответил мгновенным отказом, а фильтр ответил тишиной. В следующем разделе разберём, почему эти два симптома так различаются и как отличать их при поиске неисправности.', 'In the diagram the closed port answered with an instant refusal and the filter with silence. The next section explains why these two symptoms differ so much and how to tell them apart when troubleshooting.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Рукопожатие, отказ и тишина', 'Handshake, refusal and silence'),
      body: bi(
        'Соединение TCP начинается с [[net.handshake|тройного рукопожатия]]. Клиент отправляет пакет SYN, в котором говорит, что хочет соединиться, и называет свой начальный номер. Сервер отвечает пакетом SYN-ACK: он соглашается, подтверждает номер клиента и называет свой. Клиент подтверждает номер сервера пакетом ACK, и соединение установлено. На это уходит один путь туда и обратно, то есть один RTT, поэтому на канале с RTT в 150 мс до первого байта данных пройдёт 150 мс. Команда `ss` показывает состояния соединений так: `LISTEN` означает, что порт слушают, `SYN-SENT` означает, что клиент ждёт ответа на SYN, `ESTAB` означает, что соединение установлено, а `TIME-WAIT` означает, что соединение закрыто, но сокет ещё минуту его помнит.\n\nТеперь о том, что пригодится на дежурстве. Если порт никто не слушает, ядро сервера сразу отвечает пакетом RST, то есть сообщает, что здесь никого нет. Клиент узнаёт об этом через один RTT, и `curl` пишет `Connection refused` с кодом 7. Мгновенный отказ на самом деле хорошая новость: машина работает и сеть до неё в порядке, но на этом порту никто не принимает соединения.\n\nБывает и так, что ответа нет вовсе. Это случается, когда пакеты молча выбрасывает фильтр на сервере или по дороге (как устроены такие фильтры, вы узнаете в уроке про NAT) или когда машина выключена. Тогда клиент повторяет SYN через 1, 2, 4, 8, 16 и 32 секунды, каждый раз выжидая вдвое дольше. После шести повторов, примерно через 127 секунд, ядро прекращает попытки, и всё это время соединение остаётся в состоянии `SYN-SENT`. Поэтому в скриптах и проверках срок ожидания подключения задают явно, и если он истекает, `curl` пишет код 28, то есть «время вышло».\n\nОтказ и тишина указывают на разные неисправности. Отказ означает, что порт закрыт. Тишина означает, что что-то по дороге выбрасывает пакеты или до машины нельзя добраться. С умения различать эти два симптома начинается поиск неисправностей на транспортном уровне.',
        'A TCP connection begins with a [[net.handshake|three-way handshake]]. The client sends SYN: “I want to connect, my initial number is such-and-such.” The server answers SYN-ACK: “agreed, your number is accepted, here is mine.” The client confirms with ACK — and the connection is established. This takes exactly one round trip, one RTT: on a 150 ms link, 150 ms before the first byte of data. `ss` shows the states like this: `LISTEN` — the port is listened on, `SYN-SENT` — the client waits for an answer to its SYN, `ESTAB` — the connection is established, `TIME-WAIT` — the connection is closed but the socket remembers it for another minute.\n\nNow the most useful thing for on-call. If nobody listens on the port, the server’s kernel answers RST at once: “nobody here”. The client learns this after one RTT, and `curl` says `Connection refused` (code 7). An instant refusal is good news: the machine is alive, the network to it works, the port is just empty.\n\nAnd then there is silence. A filter on the server or on the way silently drops the packets (how it works is the NAT lesson), or the machine is off. There is no answer at all, and the client resends the SYN after 1, 2, 4, 8, 16, 32 seconds — twice as long each time. After six retries, about 127 seconds, the kernel gives up. All that time the connection hangs in `SYN-SENT`. That is why scripts and checks set a connect timeout explicitly, and `curl` with such a timeout reports code 28 — “time is up”.\n\nRefusal and silence are different diagnoses. Refusal means “the port is closed”. Silence means “something on the way drops the packets, or the host cannot be reached”. Telling them apart by the symptom is the first troubleshooting skill at the transport layer.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('client', 'tcp'),
      intro: bi('Вы работаете на клиенте с адресом 10.0.0.1, а рядом стоит сервер srv с адресом 10.0.0.2. На сервере какие-то программы слушают порты 22 и 8080, а что происходит с портами 9000 и 9100, вам предстоит выяснить.', 'Client 10.0.0.1 and server srv (10.0.0.2). Something listens on 22 and 8080 on the server; what is up with 9000 and 9100 is for you to find out.'),
      tasks: [
        {
          id: 'open',
          prompt: bi('Проверьте командой nc, что на srv открыт порт 8080. Данные отправлять не нужно, а вывод должен быть подробным.', 'Check with nc that port 8080 is open on srv (without sending data, with verbose output).'),
          check: { stdout: /Connection to 10\.0\.0\.2 8080 port \[tcp\/http-alt\] succeeded!/ },
          chips: 'nc -zv 10.0.0.2 8080',
          docRef: { page: 'man/nc.1', anchor: 'OPTIONS', line: '-z' },
          hints: { H1: bi('У команды nc есть режим, в котором она только проверяет порт, и режим подробного вывода.', 'nc has a “just check the port” mode and a “verbose” mode.'), H2: bi('Команда выглядит так: nc -zv АДРЕС ПОРТ.', 'nc -zv ADDRESS PORT') },
        },
        {
          id: 'diagnose',
          prompt: bi('Один из портов 9000 и 9100 закрыт, а пакеты на другой молча выбрасывает фильтр. Выясните, какой порт какой, и запишите в файл ~/ports.txt две строки: «9000 closed» или «9000 filtered» и такую же строку для порта 9100.', 'One of ports 9000 and 9100 is closed; on the other a filter silently drops the packets. Find out which is which and write two lines into ~/ports.txt: “9000 closed” or “9000 filtered”, and the same for 9100.'),
          check: {
            when: "files['/root/ports.txt'].text~'9000 closed' && files['/root/ports.txt'].text~'9100 filtered'",
            fail: [{ if: "files['/root/ports.txt'].text~'9000 filtered'", say: bi('На порту 9000 ответ пришёл сразу, и это был отказ Connection refused. Мгновенный отказ означает, что порт закрыт, а не что его закрывает фильтр.', 'Port 9000 answered at once — Connection refused. An instant refusal means “closed”, not “filtered”.') }],
          },
          chips: 'nc -zv -w 3 10.0.0.2 9000',
          hints: {
            H1: bi('Сравните, как быстро и чем заканчивается проверка каждого порта.', 'Compare how fast and how the check of each port ends.'),
            H2: bi('С флагом -w 3 команда nc ждёт не больше трёх секунд. Слово «refused» в выводе означает, что порт закрыт, а «timed out» означает тишину.', 'With -w 3 nc waits at most three seconds. “refused” means closed; “timed out” means silence.'),
          },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Система мониторинга обращается к http://10.0.0.2:9100/metrics, и каждое обращение зависает на две минуты. Сделайте так, чтобы curl прекращал попытку подключиться через 3 секунды.', 'Monitoring polls http://10.0.0.2:9100/metrics and hangs for two minutes at a time. Make curl give up on connecting after 3 seconds.'),
      ref: { page: 'man/curl.1' },
      terminal: {
        setup: lab('client', 'tcp'),
        task: {
          id: 'timeout',
          prompt: bi('Запустите curl к http://10.0.0.2:9100/metrics так, чтобы он прекращал подключение через 3 секунды.', 'A curl to http://10.0.0.2:9100/metrics that gives up after 3 seconds.'),
          check: { stdout: /curl: \(28\) (Failed to connect to 10\.0\.0\.2 port 9100 after 3\d{3} ms|Connection timed out after 3\d{3} milliseconds)/ },
          docStep: 4,
          beyond: true,
          solutionTokens: ['--connect-timeout', '-m', '--max-time'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.tcp.order', 'net.q.tcp.refused', 'net.q.tcp.ports', 'net.q.tcp.ephemeral'] },
  ],
};

// ── 7. Envelopes: OSI and TCP/IP ───────────────────────────────────────────

export const envelopes: Lesson = {
  id: 'networks.envelopes',
  block: 'networks',
  title: bi('Конверты протоколов и модели OSI и TCP/IP', 'Envelopes: the OSI and TCP/IP models'),
  summary: bi('Всё, что вы до сих пор изучали по отдельности, собрано в одном пакете. В уроке разберём заголовки и их размеры, MTU и словарь уровней, на котором инженеры говорят друг с другом.', 'Everything you touched separately — in one packet. The headers, their sizes, the MTU, and the vocabulary of layers for talking with colleagues.'),
  introduces: ['net.encapsulation', 'net.mtu', 'net.osi'],
  uses: ['net.frame', 'net.mac', 'net.ip', 'net.tcp', 'net.udp', 'net.port', 'net.router', 'net.ttl', 'net.icmp'],
  tier: 'core',
  minutes: 35,
  sources: src([EN.osi, EN.tcpip, EN.rfc791, EN.rfc1191, EN.tcpdump], [RU.osi, RU.tcpip, RU.mtu]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Кадры, адреса, маршруты и порты вы изучали по одному. Но в провод уходят не четыре разные вещи, а одна последовательность байтов. Как в ней уживаются MAC-адрес, IP-адрес, порт и текст запроса, и какое устройство на пути что из этого читает?',
        'Frames, addresses, routes, ports — you touched them one at a time. But what goes onto the wire is not four different things but one sequence of bytes. How do the MAC, the IP address, the port and the request text live in it together — and which device on the way reads what?',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Что на самом деле уходит в провод', 'What really goes onto the wire'),
      body: bi(
        'Схема ниже показывает, как программа и ядро собирают из данных пакет, готовый к отправке. В центре схемы стопка конвертов: сначала в ней только данные программы, а на каждом шаге вокруг них появляется ещё один заголовок. Под конвертами лежит дамп, то есть те же байты в шестнадцатеричной записи, а над ними лесенка уровней, на ступенях которой подписаны названия слоёв моделей OSI и TCP/IP. Сравнить можно три сообщения: запрос HTTP без шифрования, вопрос DNS и эхо-запрос ping, и у каждого из них свой набор конвертов.',
        'The diagram below shows how a program and the kernel build a packet ready to send. In the middle is a stack of envelopes: at first only the program’s data, and at every step another header appears around it. Under the envelopes is the dump, the same bytes in hexadecimal, and above them the ladder of layers with the names of the OSI and TCP/IP layers. You can compare three messages, an unencrypted HTTP request, a DNS question and a ping, and each has its own set of envelopes.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.envelopes', howto: bi('Листайте шаги кнопками «Назад» и «Дальше». Нажмите на любое поле конверта, и рядом появится объяснение, откуда взялось его значение, а в дампе подсветятся байты этого поля. Ступени лесенки над конвертами открывают словарь: что означает «проблема на этом уровне», каким инструментом её смотреть и какое устройство на этом уровне работает.\n\nПройдите шаги для запроса HTTP, а потом переключите сообщение на вопрос DNS и на ping и сравните, какие конверты появились, а какие нет. На последнем шаге выберите устройство на пути и посмотрите, какие поля оно меняет. Напоследок увеличьте размер данных сверх MTU, переключите флаг DF и включите поломку, при которой маршрутизатор на пути выбрасывает сообщения ICMP. Перед поломкой схема спросит, что, по-вашему, случится с большим пакетом.', 'Move through the steps with “Back” and “Next”. Click any field of an envelope to see where its value came from; its bytes light up in the dump. The rungs of the ladder above the envelopes open the vocabulary: what “a problem on this layer” means, which tool shows it and which device works there.\n\nGo through the steps for the HTTP request, then switch the message to the DNS question and to ping and compare which envelopes appeared and which did not. On the last step choose a device on the path and see which fields it changes. Finally grow the data past the MTU, toggle the DF flag and switch on the break where a router on the path drops ICMP. Before the break the diagram asks what you think will happen to the large packet.'), caption: bi('Конверты на схеме вкладывались один в другой, и устройства на пути открывали разное их число. В следующем разделе эти наблюдения собраны в правила, с размерами заголовков и ограничением на размер пакета.', 'The envelopes in the diagram nested inside each other, and the devices on the path opened different numbers of them. The next section turns these observations into rules, with the header sizes and the limit on packet size.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Как конверты вкладываются друг в друга', 'An envelope in an envelope'),
      body: bi(
        'Программа отдаёт ядру данные, например строку HTTP-запроса. Ядро кладёт их в конверт TCP с портами и номерами байтов, этот конверт кладёт в конверт IP с адресами и TTL, а конверт IP кладёт в кадр Ethernet с MAC-адресами. Это называется [[net.encapsulation|инкапсуляцией]]: каждый слой добавляет свой заголовок спереди и не заглядывает внутрь чужого конверта. Получатель снимает конверты в обратном порядке.\n\nРазмеры заголовков стоит знать наизусть. Заголовок Ethernet занимает 14 байт, и ещё 4 байта контрольной суммы добавляются в конце кадра, заголовок IPv4 без опций занимает 20 байт, заголовок TCP без опций тоже 20 байт, а заголовок UDP 8 байт. Поэтому запрос из 45 байт данных превращается в кадр из 99 байт, а эхо-запрос ping с 56 байтами данных превращается в кадр из 98 байт: 14 байт Ethernet, 20 байт IP, 8 байт ICMP и 56 байт данных.\n\nКанал пропускает пакеты не больше определённого размера, который называется [[net.mtu|MTU]]. В Ethernet MTU равен 1500 байт, считая от начала IP-заголовка. Из MTU выводится MSS (maximum segment size), то есть наибольший объём данных TCP в одном сегменте: 1500 − 20 − 20 = 1460 байт. Что будет, если пакет больше MTU следующего канала? Если в IP-заголовке снят флаг DF (Don’t Fragment), маршрутизатор разрежет пакет на фрагменты, а получатель склеит их обратно. Если флаг DF стоит, а Linux ставит его для TCP, маршрутизатор пакет выбросит и пришлёт отправителю сообщение ICMP «Fragmentation Needed» с допустимым размером, и отправитель уменьшит пакеты. Если же это сообщение кто-то по дороге отфильтрует, большие пакеты будут исчезать без следа, а маленькие проходить, и страница будет зависать уже после рукопожатия. Такую поломку называют чёрной дырой MTU.\n\nУстройства на пути открывают разное число конвертов. Коммутатор смотрит только на кадр. Маршрутизатор снимает кадр, читает IP-заголовок, меняет TTL и контрольную сумму и надевает новый кадр, а конверт TCP не открывает. Балансировщик, который читает HTTP, открывает все конверты.',
        'A program hands the kernel data — say, an HTTP request line. The kernel puts it into a TCP envelope with ports and byte numbers, that envelope into an IP envelope with addresses and TTL, and that into an Ethernet frame with MAC addresses. This is [[net.encapsulation|encapsulation]]: each layer adds its own header in front and does not look inside the others. The receiver removes the envelopes in reverse order.\n\nThe sizes are worth knowing by heart: the Ethernet header is 14 bytes (plus a 4-byte checksum at the tail), IPv4 is 20 bytes without options, TCP is 20 bytes without options, UDP is 8 bytes. A request of 45 data bytes becomes a frame of 99 bytes; a ping echo request with 56 data bytes becomes a frame of 98 (14 + 20 + 8 bytes of ICMP + 56).\n\nA link carries packets only up to a certain size — the [[net.mtu|MTU]]. On Ethernet that is 1500 bytes, counted from the start of the IP header. Hence the MSS — how much TCP data fits in a segment: 1500 − 20 − 20 = 1460. What if a packet is larger than the MTU of the next link? If the DF (Don’t Fragment) flag is clear in the IP header, the router cuts the packet into fragments and the receiver glues them together. If DF is set (Linux sets it for TCP), the router drops the packet and sends the sender ICMP “Fragmentation Needed” with the allowed size — the sender shrinks its packets. But if someone on the way filters that ICMP, large packets vanish without a trace while small ones pass: the page “hangs” after the handshake. This is the classic “MTU black hole”.\n\nDevices on the way open different numbers of envelopes. A switch looks only at the frame. A router strips the frame, reads IP, changes TTL and the checksum and puts on a new frame; it does not open TCP. A load balancer that sees HTTP opens them all.',
      ),
    },
    {
      id: 'models',
      kind: 'text',
      step: 'explain',
      title: bi('Модели уровней как общий словарь', 'Models as a vocabulary'),
      body: bi(
        'Слои сети принято нумеровать. [[net.osi|Модель OSI]] насчитывает семь уровней: L1 физический (сигналы в кабеле), L2 канальный (кадры и MAC-адреса), L3 сетевой (IP-адреса и маршруты), L4 транспортный (порты, TCP и UDP), L5 сеансовый, L6 представления и L7 прикладной (HTTP, DNS, SSH). Модель TCP/IP описывает тот же набор протоколов четырьмя слоями: канальным, межсетевым, транспортным и прикладным. В интернете у уровней 5 и 6 нет отдельных конвертов, и их работу выполняют само приложение и TLS.\n\nУчить модель ради самой модели не нужно, потому что она служит словарём. Когда коллега говорит «проблема на L3», он имеет в виду адреса и маршруты. Балансировщик L4 видит только адреса и порты, а балансировщик L7 видит HTTP целиком, с путями и заголовками. При любом сбое главный вопрос звучит так: *на каком уровне сломалось?* Сообщение `Network is unreachable` относится к L3, `Connection refused` к L4, а ответ 404 к L7. С этого вопроса начинается каждый разбор неисправности в этом курсе.',
        'Layers are usually numbered. The [[net.osi|OSI model]] counts seven: L1 physical (signals in the cable), L2 data link (frames and MAC), L3 network (IP addresses and routes), L4 transport (ports, TCP, UDP), L5 session, L6 presentation, L7 application (HTTP, DNS, SSH). The TCP/IP model describes the same stack in four layers: link, internet, transport, application. On the internet layers 5 and 6 have no envelopes of their own — the application and TLS do their work.\n\nThere is no need to learn the model for its own sake: it is a vocabulary. When a colleague says “an L3 problem”, they mean addresses and routes. An “L4 load balancer” sees only addresses and ports; an “L7 load balancer” sees all of HTTP, with paths and headers. And the main question in any failure is: *which layer broke?* `Network is unreachable` is L3. `Connection refused` is L4. A 404 answer is L7. Every investigation in this course starts with that question.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home'),
      intro: bi('Вы работаете на ноутбуке в домашней сети, и путь до shop.example открыт.', 'A laptop on a home network; the path to shop.example is open.'),
      tasks: [
        {
          id: 'len',
          prompt: bi('Отправьте один эхо-запрос до shop.example и посмотрите на его кадр в выводе tcpdump -n -e, где указана длина кадра. Запишите это число в файл ~/len.txt.', 'Send one echo request to shop.example and look at its frame in tcpdump -n -e: the frame length is shown there. Write that number into ~/len.txt.'),
          check: { when: "files['/root/len.txt'].text~'98'", fail: [{ if: "files['/root/len.txt'].text~'64'", say: bi('Число 64 означает длину сообщения ICMP: 8 байт заголовка и 56 байт данных. Кадр несёт ещё 20 байт IP и 14 байт Ethernet.', '64 is the ICMP message length (8 header bytes + 56 data). The frame also carries 20 bytes of IP and 14 bytes of Ethernet.') }] },
          chips: 'ping -c 1 shop.example; tcpdump -n -e icmp',
          hints: { H1: bi('В строке tcpdump -e после ethertype стоит «length N:», и это длина кадра.', 'In a tcpdump -e line after the ethertype comes “length N:” — the frame length.'), H2: bi('Проверьте себя подсчётом: 14 + 20 + 8 + 56.', 'Check yourself by counting: 14 + 20 + 8 + 56.') },
        },
        {
          id: 'df',
          prompt: bi('Найдите наибольший размер данных ping с запретом фрагментации (флаг -M do), при котором пакет ещё проходит через eth0 с MTU 1500. Запишите это число в файл ~/max.txt.', 'Find the largest ping data size with fragmentation forbidden (-M do) that still passes through eth0 with an MTU of 1500. Write the number into ~/max.txt.'),
          check: { when: "files['/root/max.txt'].text~'1472'", fail: [{ if: "files['/root/max.txt'].text~'1500'", say: bi('Число 1500 относится ко всему IP-пакету, а данные ping равны 1500 минус 20 байт IP и минус 8 байт ICMP.', '1500 is the whole IP packet. The ping data is 1500 minus 20 bytes of IP and 8 bytes of ICMP.') }] },
          chips: 'ping -c 1 -M do -s 1472 shop.example',
          docRef: { page: 'man/ping.8', anchor: 'OPTIONS', line: '-M pmtudisc_opt' },
          hints: { H1: bi('Слишком большой пакет с флагом -M do ядро не отправит и напишет «message too long, mtu=1500».', 'The kernel refuses to send a too-large packet with -M do: “message too long, mtu=1500”.'), H2: bi('Посчитайте MTU за вычетом заголовка IP и заголовка ICMP.', 'Count: MTU − the IP header − the ICMP header.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('В конце команды tcpdump(8) пишут фильтр, например «только arp» или «только порт 53». Найдите раздел, в котором описано, как составлять такие фильтры, и нажмите на него.', 'At the end of a tcpdump(8) command you write a filter: “only arp”, “only port 53”. Which section describes how to write it? Click the section.'),
      ref: { page: 'man/tcpdump.8' },
      answer: 'EXPRESSION',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.env.order', 'net.q.env.layer', 'net.q.env.mss', 'net.q.env.dstmac'] },
  ],
};

// ── 8. DNS ─────────────────────────────────────────────────────────────────

export const dns: Lesson = {
  id: 'networks.dns',
  block: 'networks',
  title: bi('DNS: как имя превращается в адрес', 'DNS: how a name becomes an address'),
  summary: bi('Как устроена иерархия зон, чем сервер, который ищет ответ, отличается от сервера, который его знает, как работают кэши и TTL, что означают коды ответа и почему dig и браузер иногда видят разные адреса.', 'The hierarchy of zones, who searches for the answer and who knows it, caches and TTL, answer codes — and why dig and the browser sometimes see different things.'),
  introduces: ['net.dns', 'net.resolver', 'net.authoritative', 'net.rr', 'net.anycast'],
  uses: ['net.udp', 'net.port', 'net.ttl', 'net.bgp', 'net.ip', 'net.as'],
  tier: 'core',
  minutes: 45,
  sources: src([EN.dns, EN.recursive, EN.rfc1034, EN.rfc9156, EN.dig, EN.messwithdns, EN.rootServers], [RU.dns]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В блоке Linux команда `dig` отвечала адресом за миллисекунды, а файл `/etc/resolv.conf` содержал одну строку `nameserver`. Кто стоит за этой строкой? Откуда он знает адрес shop.example, если магазин открылся только вчера? И почему после переезда сайта у половины пользователей он ещё сутки открывается по старому адресу?',
        'In the Linux block `dig` answered with an address in milliseconds, and `/etc/resolv.conf` held a single `nameserver` line. Who stands behind that line? How does it know the address of shop.example if the shop opened yesterday? And why, after a site moves, does it keep opening at the old address for half the users for another day?',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Иерархия имён и два вида серверов', 'A hierarchy and two kinds of servers'),
      body: bi(
        'Людям удобны имена, а машинам адреса, и [[net.dns|DNS]] превращает одно в другое. Имя читается справа налево: в `shop.example.` последняя точка обозначает корень, `example.` обозначает зону первого уровня (TLD), а `shop.example.` зону магазина. Каждая зона отвечает за себя и знает, кому делегированы зоны ниже неё.\n\nВ DNS есть два вида серверов. [[net.authoritative|Авторитативный сервер]] хранит саму зону: на сервере ns1.hosting.example лежит запись о том, что у shop.example адрес 198.51.100.20. Его ответу верят, и в ответе стоит флаг `aa`. [[net.resolver|Рекурсивный резолвер]] своих записей не хранит, зато ищет ответ за клиента. Такими резолверами работают сервер провайдера, домашний роутер и публичные серверы 1.1.1.1 и 8.8.8.8, и адрес такого резолвера записан в `/etc/resolv.conf`.\n\nРезолвер с пустым кэшем начинает поиск с корня. У корневых серверов тринадцать имён, от a.root-servers.net до m.root-servers.net, а за этими именами стоят более полутора тысяч машин по всему миру. Машины с одним именем делят один адрес: это называется [[net.anycast|anycast]], то есть один адрес объявлен по BGP из многих мест, и маршруты приводят вас к ближайшему экземпляру. Корневой сервер не знает адреса магазина и отвечает подсказкой: «за зону example. отвечает a.nic.example, вот его адрес». Сервер зоны example. так же направляет дальше: «за shop.example отвечает ns1.hosting.example». Такие подсказки хранятся в записях NS, а адреса серверов, которые к ним прилагаются, называют glue. И только авторитативный сервер магазина отвечает самим адресом. Современный резолвер ещё и не сообщает лишнего: корневому серверу он называет только «example.», а не полное имя; это называется минимизацией QNAME и описано в RFC 9156.\n\nОтвет хранится в зоне как [[net.rr|ресурсная запись]], в которой есть имя, TTL, тип и значение. Типы, которые встречаются каждый день, такие: A хранит адрес IPv4, AAAA адрес IPv6, CNAME делает имя псевдонимом другого (например, «www.shop.example означает то же, что shop.example»), MX называет почтовый сервер, NS называет серверы, отвечающие за зону, а TXT хранит произвольный текст, например для подтверждения владения доменом или для SPF.',
        'People like names, machines like addresses. [[net.dns|DNS]] turns one into the other. A name is read right to left: in `shop.example.` the final dot is the root, `example.` is a top-level zone (TLD), `shop.example.` is the shop’s zone. Every zone answers for itself and knows whom the zones below it are delegated to.\n\nThere are two kinds of DNS servers. An [[net.authoritative|authoritative server]] holds the zone itself: ns1.hosting.example has the record “shop.example — 198.51.100.20”. Its answer is trusted — the answer carries the `aa` flag. A [[net.resolver|recursive resolver]] holds nothing of its own but finds the answer for the client: the provider’s resolver, the home router, the public 1.1.1.1 and 8.8.8.8. Its address is what `/etc/resolv.conf` holds.\n\nA resolver with an empty cache starts at the root. The root servers have thirteen names — from a.root-servers.net to m.root-servers.net — and behind them more than fifteen hundred machines worldwide. They share the same addresses: this is [[net.anycast|anycast]], one address announced over BGP from many places, and routes bring you to the nearest instance. The root does not know the shop’s address. It answers with a referral: “a.nic.example answers for the example. zone; here is its address.” The example. zone server refers further in the same way: “ns1.hosting.example answers for shop.example.” These referrals are NS records, and the server addresses that come with them are called glue. Only the shop’s authoritative server answers with the address itself. A modern resolver also gives away no more than needed: it tells the root only “example.”, not the full name (QNAME minimisation, RFC 9156).\n\nAn answer is stored in the zone as a [[net.rr|resource record]]: name, TTL, type, value. The types you meet every day: A (an IPv4 address), AAAA (IPv6), CNAME (an alias: “www.shop.example is shop.example”), MX (the mail server), NS (who answers for the zone), TXT (arbitrary text — domain checks, SPF).',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как резолвер ищет адрес', 'How the resolver finds an address'),
      body: bi(
        'Схема ниже показывает, что происходит, когда программе curl нужен адрес shop.example. Слева сама программа, системная библиотека, через которую программы спрашивают имена, и файл `/etc/hosts`. В центре появится рекурсивный резолвер, а справа три сервера, которых он по очереди спрашивает: корневой сервер, сервер зоны example. и авторитативный сервер магазина. Под названием резолвера показано, сколько секунд он ещё будет хранить найденный ответ. Схема показывает два запроса: первый с пустыми кэшами и второй, который приходит через заданное время.',
        'The diagram below shows what happens when curl needs the address of shop.example. On the left are the program itself, the system library through which programs ask for names, and `/etc/hosts`. The recursive resolver appears in the middle, and on the right the three servers it asks in turn: the root, the example. zone server and the shop’s authoritative server. Under the resolver’s name you see how many more seconds it keeps the answer. The diagram shows two requests: the first with empty caches and a second one after a set time.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.dns', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен блок, который работает сейчас, и облачко рядом с ним говорит, что он делает: «Корневой сервер адреса не знает и отвечает, что спрашивать нужно сервер зоны example». По линиям движутся карточки с вопросами и ответами, например `NS? example.` и `A 198.51.100.20`. Значки и рамки объяснены в легенде под схемой.\n\nПосле первого прохода подвиньте над схемой время второго запроса так, чтобы оно стало больше TTL записи, и посмотрите, сколько вопросов резолвер задаст снова. Потом запишите имя в `/etc/hosts` и проверьте, что ответит `dig`. Напоследок включите по одной обе поломки в блоке «Сломать»: молчащий авторитативный сервер и опечатку в имени. Сравните коды ответа, которые вы получите, SERVFAIL и NXDOMAIN.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the block working now is highlighted, and the callout next to it says what it does. Cards with questions and answers travel along the lines, such as `NS? example.` and `A 198.51.100.20`. The legend under the diagram explains the marks.\n\nAfter the first pass move the time of the second request above the diagram past the record’s TTL and see how many questions the resolver asks again. Then put the name into `/etc/hosts` and check what `dig` answers. Finally switch on both breaks in “Break it” one at a time: the silent authoritative server and the typo in the name. Compare the answer codes you get, SERVFAIL and NXDOMAIN.'), caption: bi('На схеме второй запрос то брал ответ из кэша, то снова проходил весь путь, а поломки давали два разных кода ответа. В следующем разделе разберём кэши, сроки хранения и коды ответа подробнее.', 'In the diagram the second request sometimes took the answer from the cache and sometimes walked the whole path again, and the breaks gave two different answer codes. The next section looks at caches, lifetimes and answer codes in detail.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Кэши, TTL и коды ответа', 'Caches, TTL and answer codes'),
      body: bi(
        'Резолвер запоминает каждый ответ на столько секунд, сколько указано в его TTL. Пока TTL не истёк, на следующий вопрос о том же имени резолвер отвечает из кэша, и авторитативный сервер о нём даже не узнаёт. Отсюда берётся жалоба «сайт переехал, а у части пользователей открывается старый адрес»: их резолверы держат старую запись до конца её TTL. Поэтому выражение «DNS ещё не распространился» неточно: новая запись никуда не распространяется, а старые копии хранятся в кэшах резолверов, пока не истечёт их TTL. Чтобы переезд прошёл быстро, TTL заранее снижают до нескольких минут и ждут, пока истечёт прежний.\n\nКоды ответа нужно различать с первого взгляда. `NOERROR` означает, что всё в порядке, хотя записей нужного типа может и не быть. `NXDOMAIN` означает окончательное «такого имени нет», и этот ответ тоже кэшируют. `SERVFAIL` означает «не удалось выяснить», и обычно причина в том, что авторитативный сервер недоступен. `REFUSED` означает, что сервер отказался отвечать на ваши вопросы. Если же ответа нет совсем, `dig` пишет `connection timed out; no servers could be reached`, и это уже вопрос транспорта: датаграммы UDP на порт 53 не доходят до резолвера.\n\nЕсть ещё одна ловушка. Программы вроде curl, браузера и ping спрашивают имя не у DNS напрямую, а через системную библиотеку, которую называют stub-резолвером. Она сначала читает `/etc/hosts` (порядок задаёт `/etc/nsswitch.conf`) и только потом спрашивает сервер из `/etc/resolv.conf`. `dig` устроен иначе и всегда спрашивает сервер DNS напрямую, поэтому `/etc/hosts` он не видит. Так что ситуация «у меня curl открывает сайт, а dig показывает другой адрес» почти всегда объясняется записью в `/etc/hosts`. Увидеть то, что видят программы, можно командой `getent hosts имя`.',
        'A resolver remembers each answer for as many seconds as its TTL says. Until the TTL expires it answers the next question about the same name from its cache, and the authoritative server never even hears about it. Hence “the site moved, but some users still get the old address”: their resolvers hold the old record until its TTL ends. There is no “DNS propagation” — there are caches with clocks. Before a move the TTL is lowered in advance, to minutes, and the old one is waited out.\n\nAnswer codes must be told apart at a glance. `NOERROR` — all is well (though there may be no records of the wanted type). `NXDOMAIN` — a final “no such name”; it is cached too. `SERVFAIL` — “could not find out”: usually the authoritative server is unreachable. `REFUSED` — the server declined to answer you. And if there is no answer at all, `dig` says `connection timed out; no servers could be reached` — that is a transport question: UDP to port 53 does not reach the resolver.\n\nOne more trap. Programs — curl, the browser, ping — do not ask DNS directly but go through an OS library, the stub resolver. It reads `/etc/hosts` first (`/etc/nsswitch.conf` sets the order) and only then asks the server from `/etc/resolv.conf`. `dig` works differently: it always asks a DNS server directly and does not see `/etc/hosts`. So “curl opens it for me but dig shows a different address” is almost always an `/etc/hosts` entry. To see what programs see, use `getent hosts name`.',
      ),
    },
    {
      id: 'ndots',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Как короткие имена дополняются по строкам search и ndots', 'Short names: search and ndots'),
      body: bi(
        'В `/etc/resolv.conf` бывают строки `search a.lab lab` и `options ndots:5`. Если в имени меньше точек, чем указано в ndots, stub-резолвер сначала пробует дописать к нему каждый домен из строки search: для `api.example.com`, где точек две, он спросит `api.example.com.a.lab`, потом `api.example.com.lab` и только потом само имя. Каждая такая попытка означает лишний вопрос к серверу и лишний ответ NXDOMAIN. Точка в конце имени (`api.example.com.`) отключает такой перебор. На этом же механизме построена система имён внутри Kubernetes, до которой вы дойдёте через несколько блоков.',
        '`/etc/resolv.conf` may have lines like `search a.lab lab` and `options ndots:5`. If a name has fewer dots than ndots, the stub resolver first tries appending each search domain: for `api.example.com` (two dots) — `api.example.com.a.lab`, `api.example.com.lab`, and only then the name itself. Those are extra questions and extra NXDOMAINs. A trailing dot (`api.example.com.`) turns the search off. Name lookup inside Kubernetes, which you will reach a few blocks from now, is built on the same mechanism.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home', { resolv: 'nameserver 192.168.1.54\n' }, [{ id: 'd', kind: 'dns', to: 'shop.example' }]),
      intro: bi('После того как знакомый «настроил» ноутбук, тот перестал открывать сайты по именам, хотя по адресам всё работает. Домашний роутер 192.168.1.1 умеет отвечать на вопросы DNS.', 'After a friend’s “tune-up” the laptop no longer opens sites by name, though everything works by address. The home router 192.168.1.1 can answer DNS questions.'),
      tasks: [
        {
          id: 'fix',
          prompt: bi('Найдите, почему имена не находятся, и исправьте это через настройки DNS, а не через /etc/hosts.', 'Find out why names are not found and fix it through DNS, not through /etc/hosts.'),
          check: {
            when: "reach.d.answer has '198.51.100.20'",
            fail: [{ if: "files['/etc/hosts'].text~'shop.example'", say: bi('Запись в /etc/hosts обходит поломку, а не чинит её, потому что остальные имена по-прежнему не будут находиться.', 'An /etc/hosts entry is a workaround, not a fix: every other name is still not found.') }],
          },
          chips: 'cat /etc/resolv.conf',
          concepts: ['net.resolver'],
          hints: {
            H1: bi('Какому серверу ноутбук задаёт вопросы? Это записано в одном файле.', 'Which server does the laptop ask? One file says.'),
            H2: bi('Команда dig shop.example @192.168.1.1 получает ответ? Значит, в /etc/resolv.conf записан не тот сервер.', 'Does dig shop.example @192.168.1.1 answer? Then /etc/resolv.conf names the wrong server.'),
            H3: bi('echo "nameserver 192.168.1.1" > /etc/resolv.conf', 'echo "nameserver 192.168.1.1" > /etc/resolv.conf'),
          },
        },
        {
          id: 'trace',
          prompt: bi('Пройдите иерархию сами командой dig +trace shop.example и запишите в файл ~/tld.txt имя сервера, который отвечает за зону example.', 'Walk the hierarchy yourself: dig +trace shop.example. Write the name of the server that answers for the example. zone into ~/tld.txt.'),
          check: { when: "files['/root/tld.txt'].text~'a.nic.example'", fail: [{ if: "files['/root/tld.txt'].text~'ns1.hosting'", say: bi('Сервер ns1.hosting.example отвечает за зону shop.example, то есть за зону уровнем ниже.', 'ns1.hosting.example answers for the shop.example zone — that is one level lower.') }] },
          chips: 'dig +trace shop.example',
          docRef: { page: 'man/dig.1', anchor: 'QUERY OPTIONS', line: '+[no]trace' },
          hints: { H1: bi('Во втором блоке вывода корневой сервер называет, кто держит зону example.', 'In the second block of output the root says who holds the example. zone.') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите на странице dig(1), как оставить в выводе только секцию ANSWER, без шапки, флагов и статистики, и покажите так запись shop.example.', 'Find in dig(1) how to keep only the ANSWER section in the output — without the header, the flags and the statistics — and show the shop.example record that way.'),
      ref: { page: 'man/dig.1', anchor: 'QUERY OPTIONS', line: '+[no]all' },
      terminal: {
        setup: lab('laptop', 'home'),
        task: {
          id: 'answer',
          prompt: bi('Покажите только строку ответа для shop.example.', 'Only the answer line for shop.example.'),
          check: { stdout: /^shop\.example\.\s+\d+\s+IN\s+A\s+198\.51\.100\.20\n?$/ },
          docStep: 3,
          chips: 'dig +noall +answer shop.example',
          hints: { H1: bi('Опции dig начинаются со знака +. Одна опция выключает весь вывод, а другая включает нужную секцию.', 'dig options start with +. One turns everything off, another turns the needed section back on.') },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Коллега спрашивает, на какой сервер уходит почта для домена shop.example. Узнайте это и запишите имя сервера в файл ~/mx.txt.', 'A colleague asks which server receives mail for the domain shop.example. Find out and write the server’s name into ~/mx.txt.'),
      ref: { page: 'man/dig.1' },
      terminal: {
        setup: lab('laptop', 'home'),
        task: {
          id: 'mx',
          prompt: bi('Запишите имя почтового сервера shop.example в файл ~/mx.txt.', 'The name of shop.example’s mail server — in ~/mx.txt.'),
          check: { when: "files['/root/mx.txt'].text~'mail.shop.example'" },
          docStep: 4,
          beyond: true,
          solutionTokens: ['MX', 'mx', 'mail exchanger'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.dns.order', 'net.q.dns.nx', 'net.q.dns.servfail', 'net.q.dns.hosts', 'net.q.dns.ttl'] },
  ],
};

// ── 9. DHCP ────────────────────────────────────────────────────────────────

export const dhcp: Lesson = {
  id: 'networks.dhcp',
  block: 'networks',
  title: bi('DHCP: как машина получает адрес', 'DHCP: how a machine gets an address'),
  summary: bi('Ноутбук получает адрес, шлюз и сервер DNS за четыре сообщения. В уроке разберём эти сообщения, а ещё то, что означает адрес 169.254.x.x и чем опасен второй сервер DHCP в сети.', 'Four messages that give a laptop an address, a gateway and DNS; what 169.254 means and why a second server is dangerous.'),
  introduces: ['net.dhcp', 'net.lease', 'net.link-local'],
  uses: ['net.broadcast', 'net.udp', 'net.port', 'net.gateway', 'net.dns', 'net.ip', 'net.cidr'],
  tier: 'core',
  minutes: 30,
  sources: src([EN.rfc2131, EN.rfc2132, EN.rfc3927], [RU.dhcp]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы приносите ноутбук в кафе, подключаетесь к Wi-Fi, и через секунду у ноутбука уже есть адрес, шлюз и сервер DNS. Вы ничего не вводили. Но ведь ноутбук не знал ни своего адреса, ни адреса того, кого можно спросить. Как задать вопрос, не зная, кому его адресовать?',
        'You bring a laptop to a café, join the Wi-Fi — and a second later it has an address, a gateway and a DNS server. You typed nothing. Yet the laptop knew neither its own address nor the address of whom to ask. How do you ask a question without knowing whom?',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как ноутбук получает адрес по DHCP', 'How a laptop gets an address over DHCP'),
      body: bi(
        'Схема ниже показывает, как ноутбук получает настройки сети. Слева ноутбук, у которого пока адрес 0.0.0.0, справа домашний роутер, в котором работает сервер DHCP. Пунктирная рамка вокруг них обозначает локальную сеть, внутри которой слышны широковещательные сообщения. Под названием ноутбука показан его текущий адрес, и он меняется, когда ноутбук получает настройки.',
        'The diagram below shows how a laptop gets its network settings. On the left is the laptop, whose address is still 0.0.0.0; on the right is the home router with a DHCP server. The dashed frame around them marks the local network where broadcasts are heard. Under the laptop’s name you see its current address, which changes when it gets its settings.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.dhcp', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен блок, который работает сейчас, и облачко рядом с ним говорит, что он делает, а по линии движется карточка с названием сообщения: `Discover`, `Offer`, `Request`, `Ack`. Значки и рамки объяснены в легенде под схемой.\n\nПосле первого прохода подвиньте над схемой срок аренды и посмотрите, когда клиент попросит её продлить. Потом включите в блоке «Сломать» выключенный сервер и посмотрите, какой адрес ноутбук назначит себе сам. Напоследок включите второй сервер в сети, на схеме появится старый роутер, и проследите, чьё предложение примет ноутбук.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the block working now is highlighted, the callout next to it says what it does, and a card with the message name travels along the line: `Discover`, `Offer`, `Request`, `Ack`. The legend under the diagram explains the marks.\n\nAfter the first pass move the lease time above the diagram and see when the client asks to renew. Then switch on the server that is off in “Break it” and see which address the laptop gives itself. Finally switch on the second server on the network: an old router appears in the diagram; watch whose offer the laptop takes.'), caption: bi('На схеме ноутбук получил настройки за четыре сообщения, а без сервера назначил себе адрес сам. В следующем разделе разберём эти сообщения, аренду адреса и опасный случай с двумя серверами.', 'In the diagram the laptop got its settings in four messages, and without a server gave itself an address. The next section looks at these messages, the address lease and the dangerous case of two servers.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Discover, Offer, Request, Ack', 'Discover, Offer, Request, Ack'),
      body: bi(
        'Ноутбук задаёт свой вопрос сразу всем машинам в сети. Не имея адреса, он отправляет широковещательную датаграмму UDP с адреса `0.0.0.0` и порта 68 на адрес `255.255.255.255` и порт 67, и смысл её такой: «Есть здесь сервер [[net.dhcp|DHCP]]?» Это сообщение называется Discover. Сервер, обычно работающий в домашнем роутере, отвечает сообщением Offer: «Возьми адрес 192.168.1.103». Вместе с адресом он передаёт опции: опция 1 задаёт маску подсети, опция 3 шлюз, опция 6 сервер DNS (отсюда и берётся строка в `/etc/resolv.conf`), а опция 51 срок аренды. Клиент снова широковещательно отвечает сообщением Request: «Беру этот адрес у этого сервера», и так другие серверы узнают, что их предложения отклонены. Сервер подтверждает выдачу сообщением Ack. Из первых букв четырёх сообщений получается удобное слово DORA.\n\nАдрес выдаётся не навсегда, а в [[net.lease|аренду]] на срок из опции 51. Когда проходит половина срока (момент T1), клиент просит свой сервер продлить аренду, а если тот молчит, то по прошествии 87,5 % срока (момент T2) спрашивает любой сервер в сети. Если продлить аренду не удалось, адрес придётся вернуть.\n\nЕсли не ответил никто, клиент всё равно не остаётся без адреса: он назначает себе адрес [[net.link-local|link-local]] из диапазона `169.254.0.0/16`. С таким адресом можно обмениваться пакетами с соседями по кабелю, но шлюза и выхода в интернет нет. Поэтому адрес вида 169.254.x.x на интерфейсе служит верным признаком того, что сервер DHCP не ответил.\n\nПрограммы-клиенты DHCP бывают разными. В лабораториях курса и в Debian 13 по умолчанию работает `dhcpcd`. На старых системах встречается `dhclient`, на серверах с Ubuntu `systemd-networkd` (его состояние показывает `networkctl status`), а на ноутбуках NetworkManager. Протокол у всех один и тот же.\n\nОпасный случай возникает, когда в одной сети оказываются два сервера. Например, кто-то принёс старый роутер и подключил его к коммутатору. Оба сервера ответят на Discover, клиент возьмёт первое предложение и может получить чужой шлюз, за которым нет интернета. Причина такой поломки лежит в DHCP, а проявляется она в маршрутах: адрес есть, а интернета нет. Запись трафика командой tcpdump покажет два сообщения Offer от разных серверов.',
        'Ask everyone. A laptop without an address sends a broadcast UDP datagram from address `0.0.0.0` and port 68 to `255.255.255.255`, port 67: “Is there a [[net.dhcp|DHCP]] server here?” This is Discover. The server — usually in the home router — answers Offer: “Take 192.168.1.103.” Along with the address it sends options: 1 — the subnet mask, 3 — the gateway, 6 — the DNS server (that is where the line in `/etc/resolv.conf` comes from), 51 — the lease time. The client answers with another broadcast, Request: “I take this address from this server” — this also tells other servers their offers were declined. The server confirms with Ack. The first letters make a handy word: DORA.\n\nAn address is given not forever but on an [[net.lease|address lease]] for the time in option 51. At half that time (T1) the client asks its server to renew the lease; if it is silent, at 87.5 % (T2) it asks anyone. No renewal — the address has to be given up.\n\nIf nobody answered, the client is not left with no address at all: it assigns itself a [[net.link-local|link-local]] address from `169.254.0.0/16`. With it you can talk to neighbours on the cable, but there is no gateway and no internet. A 169.254.x.x address on an interface is a sure sign: the DHCP server did not answer.\n\nClients differ. In the course labs and in Debian 13 the default is `dhcpcd`. On older systems you meet `dhclient`, on Ubuntu servers `systemd-networkd` (`networkctl status`), on laptops NetworkManager. The protocol is the same for all.\n\nAnd a dangerous case: two servers on one network. Someone brought an old router and plugged it into the switch. Both answer the Discover, the client takes the first offer — and may get the wrong gateway, with no internet behind it. The cause is at the DHCP level; the symptom is at the level of routes: “there is an address but no internet”. A tcpdump capture shows two Offers from different servers.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home', { noAddr: true }),
      intro: bi('Ноутбук только что подключили к домашней сети, и у интерфейса eth0 ещё нет адреса.', 'The laptop has just joined the home network. eth0 has no address.'),
      tasks: [
        {
          id: 'lease',
          prompt: bi('Получите для eth0 адрес, маршрут и сервер DNS по DHCP.', 'Get an address, a route and a DNS server over DHCP for eth0.'),
          check: {
            when: "net.ifaces[name=eth0].addr~'192.168.1.' && net.routes[dst=default].gateway='192.168.1.1'",
            fail: [{ if: "net.ifaces[name=eth0].addr~'169.254.'", say: bi('Адрес вида 169.254.x.x означает, что сервер не ответил. Проверьте, что запрос ушёл через eth0.', '169.254.x.x — the server did not answer. Check that the request went out of eth0.') }],
          },
          chips: 'dhcpcd eth0',
          docRef: { page: 'man/dhcpcd.8', anchor: 'DESCRIPTION' },
          hints: { H1: bi('Клиентом DHCP в этой системе работает dhcpcd.', 'The DHCP client on this system is dhcpcd.'), H2: bi('Наберите dhcpcd и имя интерфейса.', 'dhcpcd and the interface name.') },
        },
        {
          id: 'dns',
          prompt: bi('Какой сервер DNS выдал DHCP в опции 6? Запишите его адрес в файл ~/dns.txt.', 'Which DNS server did DHCP hand out (option 6)? Write its address into ~/dns.txt.'),
          check: { when: "files['/root/dns.txt'].text~'192.168.1.1'" },
          chips: 'cat /etc/resolv.conf',
          hints: { H1: bi('Клиент DHCP записал сервер в файл, который читает stub-резолвер.', 'The DHCP client wrote the server into the file the stub resolver reads.') },
        },
      ],
    },
    {
      id: 'lab-rogue',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home', { noAddr: true, dhcp: 'rogue' }),
      intro: bi('В офис привезли новый ноутбук, который получает адрес, но выйти в интернет не может. Говорят, вчера кто-то подключил к коммутатору свой старый роутер.', 'A new laptop in the office gets an address but no internet. Someone reportedly plugged their old router into the switch yesterday.'),
      tasks: [
        {
          id: 'rogue',
          prompt: bi('Выясните, какой сервер выдал ноутбуку настройки, и запишите адрес этого сервера в файл ~/rogue.txt.', 'Find out which server gave the laptop its settings and write that server’s address into ~/rogue.txt.'),
          check: { when: "files['/root/rogue.txt'].text~'192.168.1.250'", fail: [{ if: "files['/root/rogue.txt'].text~'192.168.1.1'", say: bi('Адрес 192.168.1.1 принадлежит настоящему роутеру. Посмотрите строку «offered … from …» в выводе dhcpcd или вывод tcpdump, где сообщений Offer было два.', '192.168.1.1 is the real router. Look at the “offered … from …” line in the dhcpcd output or at the tcpdump output, where there were two Offers.') }] },
          chips: 'dhcpcd eth0; tcpdump -n port 67 or port 68',
          hints: { H1: bi('Программа dhcpcd пишет, от кого пришло предложение.', 'dhcpcd prints whom the offer came from.'), H2: bi('В выводе tcpdump видны два ответа сервера с разных адресов, и tcpdump подписывает их словом Reply.', 'The tcpdump output shows two server answers from different addresses; tcpdump labels them Reply.') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите на странице dhcpcd(8) флаг, с которым программа получает предложение сервера, но не меняет настройки машины, и покажите с его помощью, какой сервер DNS выдал бы DHCP.', 'Find the dhcpcd(8) flag that gets the server’s offer but does not change the machine’s settings, and show which DNS server DHCP would hand out.'),
      ref: { page: 'man/dhcpcd.8', anchor: 'OPTIONS', line: '-T, --test' },
      terminal: {
        setup: lab('laptop', 'home', { noAddr: true }),
        task: {
          id: 'test',
          prompt: bi('Отправьте тестовый запрос DHCP для eth0 так, чтобы настройки машины не изменились.', 'A test DHCP request for eth0, without changing the settings.'),
          check: { stdout: /new_domain_name_servers=192\.168\.1\.1/ },
          docStep: 3,
          chips: 'dhcpcd -T eth0',
          hints: { H1: bi('Ищите в разделе OPTIONS слово «test».', 'Look for the word “test” in OPTIONS.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.dhcp.order', 'net.q.dhcp.ll', 'net.q.dhcp.opts'] },
  ],
};
