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
  summary: bi('Одна машина — много программ. Как порт выбирает программу, чем UDP проще TCP и почему «отказ» и «тишина» — разные диагнозы.', 'One machine, many programs. How a port picks the program, why UDP is simpler than TCP and why “refused” and “silence” are different diagnoses.'),
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
        'В блоке Linux `ss -ltnp` показывал, какая программа слушает какой номер: nginx на 80, sshd на 22. Пакет пришёл на машину по IP-адресу — но как ядро понимает, отдать его nginx или sshd?',
        'In the Linux block `ss -ltnp` showed which program listens on which number: nginx on 80, sshd on 22. A packet has reached the machine by its IP address — but how does the kernel know whether to give it to nginx or to sshd?',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Порт выбирает программу', 'The port picks the program'),
      body: bi(
        'Внутри IP-пакета лежит ещё один конверт — транспортный. В его заголовке два числа: [[net.port|порт]] отправителя и порт получателя, от 0 до 65535. Программа, которая хочет принимать соединения, просит ядро «слушать» порт: nginx — 80 и 443, sshd — 22. Ядро смотрит на порт получателя и отдаёт данные той программе, которая его слушает. Общеизвестные порты закреплены договорённостью: 22 — SSH, 53 — DNS, 80 — HTTP, 443 — HTTPS.\n\nПорт отправителя у клиента выбирает само ядро при подключении — свободный из диапазона 32768–60999. Это [[net.ephemeral|эфемерный порт]]: он живёт, пока живёт соединение, и по нему ответ находит именно эту программу, даже если на машине открыто сто вкладок браузера.\n\nТранспортов два. [[net.udp|UDP]] — «отправил и забыл»: датаграмма уходит, никто не подтверждает получение, потерянное не повторяется. Зато быстро и просто — так ходят вопросы DNS, раздача адресов, видео. [[net.tcp|TCP]] — соединение: каждый байт пронумерован, получатель подтверждает принятое, отправитель повторяет то, что не подтвердили, и отдаёт приложению поток строго по порядку. На TCP работают HTTP, SSH, базы данных.',
        'Inside the IP packet lies one more envelope — the transport one. Its header carries two numbers: the sender’s [[net.port|port]] and the receiver’s port, from 0 to 65535. A program that wants to accept connections asks the kernel to “listen” on a port: nginx on 80 and 443, sshd on 22. The kernel looks at the destination port and hands the data to whichever program listens on it. Well-known ports are fixed by convention: 22 is SSH, 53 is DNS, 80 is HTTP, 443 is HTTPS.\n\nThe client’s source port is chosen by the kernel itself when connecting — a free one from the range 32768–60999. This is an [[net.ephemeral|ephemeral port]]: it lives as long as the connection, and the answer finds exactly this program by it, even with a hundred browser tabs open on the machine.\n\nThere are two transports. [[net.udp|UDP]] is “send and forget”: a datagram leaves, nobody confirms receipt, nothing lost is resent. But it is fast and simple — DNS questions, address hand-outs and video go this way. [[net.tcp|TCP]] is a connection: every byte is numbered, the receiver confirms what it got, the sender resends whatever was not confirmed and delivers the stream to the application strictly in order. HTTP, SSH and databases run on TCP.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.tcp', caption: bi('Время идёт вниз. Закройте порт, включите фильтр, растяните RTT.', 'Time runs downwards. Close the port, turn on the filter, stretch the RTT.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Рукопожатие, отказ и тишина', 'Handshake, refusal and silence'),
      body: bi(
        'Соединение TCP начинается с [[net.handshake|тройного рукопожатия]]. Клиент шлёт SYN: «хочу соединиться, мой начальный номер такой-то». Сервер отвечает SYN-ACK: «согласен, твой номер принят, вот мой». Клиент подтверждает ACK — и соединение установлено. На это уходит ровно один круг туда-обратно, один RTT: на канале в 150 мс — 150 мс до первого байта данных. `ss` показывает состояния так: `LISTEN` — порт слушают, `SYN-SENT` — клиент ждёт ответа на SYN, `ESTAB` — соединение установлено, `TIME-WAIT` — соединение закрыто, но сокет ещё минуту помнит его.\n\nТеперь самое полезное для дежурства. Если порт никто не слушает, ядро сервера сразу отвечает RST: «здесь никого нет». Клиент узнаёт об этом через один RTT, и `curl` пишет `Connection refused` (код 7). Мгновенный отказ — хорошая новость: машина жива, сеть до неё работает, просто на этом порту пусто.\n\nА бывает тишина. Пакеты молча выбрасывает фильтр на сервере или по дороге (как он устроен — в уроке про NAT), или машина выключена. Ответа нет никакого, и клиент повторяет SYN через 1, 2, 4, 8, 16, 32 секунды — каждый раз вдвое дольше. Через шесть повторов, примерно через 127 секунд, ядро сдаётся. Всё это время соединение висит в `SYN-SENT`. Поэтому в скриптах и проверках таймаут подключения задают явно, а `curl` с таким таймаутом пишет код 28 — «время вышло».\n\nОтказ и тишина — разные диагнозы. Отказ — «порт закрыт». Тишина — «что-то по дороге выбрасывает пакеты, или до хоста не дойти». Отличать их по симптому — первый навык траблшутинга на транспортном уровне.',
        'A TCP connection begins with a [[net.handshake|three-way handshake]]. The client sends SYN: “I want to connect, my initial number is such-and-such.” The server answers SYN-ACK: “agreed, your number is accepted, here is mine.” The client confirms with ACK — and the connection is established. This takes exactly one round trip, one RTT: on a 150 ms link, 150 ms before the first byte of data. `ss` shows the states like this: `LISTEN` — the port is listened on, `SYN-SENT` — the client waits for an answer to its SYN, `ESTAB` — the connection is established, `TIME-WAIT` — the connection is closed but the socket remembers it for another minute.\n\nNow the most useful thing for on-call. If nobody listens on the port, the server’s kernel answers RST at once: “nobody here”. The client learns this after one RTT, and `curl` says `Connection refused` (code 7). An instant refusal is good news: the machine is alive, the network to it works, the port is just empty.\n\nAnd then there is silence. A filter on the server or on the way silently drops the packets (how it works is the NAT lesson), or the machine is off. There is no answer at all, and the client resends the SYN after 1, 2, 4, 8, 16, 32 seconds — twice as long each time. After six retries, about 127 seconds, the kernel gives up. All that time the connection hangs in `SYN-SENT`. That is why scripts and checks set a connect timeout explicitly, and `curl` with such a timeout reports code 28 — “time is up”.\n\nRefusal and silence are different diagnoses. Refusal means “the port is closed”. Silence means “something on the way drops the packets, or the host cannot be reached”. Telling them apart by the symptom is the first troubleshooting skill at the transport layer.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('client', 'tcp'),
      intro: bi('Клиент 10.0.0.1 и сервер srv (10.0.0.2). На сервере что-то слушает 22 и 8080; что с 9000 и 9100 — предстоит выяснить.', 'Client 10.0.0.1 and server srv (10.0.0.2). Something listens on 22 and 8080 on the server; what is up with 9000 and 9100 is for you to find out.'),
      tasks: [
        {
          id: 'open',
          prompt: bi('Проверьте командой nc, что на srv открыт порт 8080 (без отправки данных, с подробным выводом).', 'Check with nc that port 8080 is open on srv (without sending data, with verbose output).'),
          check: { stdout: /Connection to 10\.0\.0\.2 8080 port \[tcp\/http-alt\] succeeded!/ },
          chips: 'nc -zv 10.0.0.2 8080',
          docRef: { page: 'man/nc.1', anchor: 'OPTIONS', line: '-z' },
          hints: { H1: bi('У nc есть режим «только проверить порт» и режим «подробно».', 'nc has a “just check the port” mode and a “verbose” mode.'), H2: bi('nc -zv АДРЕС ПОРТ', 'nc -zv ADDRESS PORT') },
        },
        {
          id: 'diagnose',
          prompt: bi('Один из портов 9000 и 9100 закрыт, на другом пакеты молча выбрасывает фильтр. Выясните, какой есть какой, и запишите в ~/ports.txt две строки: «9000 closed» или «9000 filtered» и то же для 9100.', 'One of ports 9000 and 9100 is closed; on the other a filter silently drops the packets. Find out which is which and write two lines into ~/ports.txt: “9000 closed” or “9000 filtered”, and the same for 9100.'),
          check: {
            when: "files['/root/ports.txt'].text~'9000 closed' && files['/root/ports.txt'].text~'9100 filtered'",
            fail: [{ if: "files['/root/ports.txt'].text~'9000 filtered'", say: bi('На 9000 ответ пришёл сразу — Connection refused. Мгновенный отказ значит «закрыт», а не «фильтр».', 'Port 9000 answered at once — Connection refused. An instant refusal means “closed”, not “filtered”.') }],
          },
          chips: 'nc -zv -w 3 10.0.0.2 9000',
          hints: {
            H1: bi('Сравните, как быстро и чем закончится проверка каждого порта.', 'Compare how fast and how the check of each port ends.'),
            H2: bi('С -w 3 nc ждёт не больше трёх секунд. «refused» — закрыт; «timed out» — тишина.', 'With -w 3 nc waits at most three seconds. “refused” means closed; “timed out” means silence.'),
          },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Мониторинг дёргает http://10.0.0.2:9100/metrics и висит по две минуты. Сделайте так, чтобы curl сдавался на подключении через 3 секунды.', 'Monitoring polls http://10.0.0.2:9100/metrics and hangs for two minutes at a time. Make curl give up on connecting after 3 seconds.'),
      ref: { page: 'man/curl.1' },
      terminal: {
        setup: lab('client', 'tcp'),
        task: {
          id: 'timeout',
          prompt: bi('curl к http://10.0.0.2:9100/metrics, который сдаётся через 3 секунды.', 'A curl to http://10.0.0.2:9100/metrics that gives up after 3 seconds.'),
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
  title: bi('Конверты: модели OSI и TCP/IP', 'Envelopes: the OSI and TCP/IP models'),
  summary: bi('Всё, что вы трогали по отдельности, — в одном пакете. Заголовки, их размеры, MTU, и словарь уровней для разговора с коллегами.', 'Everything you touched separately — in one packet. The headers, their sizes, the MTU, and the vocabulary of layers for talking with colleagues.'),
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
        'Кадры, адреса, маршруты, порты — вы трогали их по одному. Но в провод уходит не четыре разных вещи, а одна последовательность байтов. Как в ней уживаются MAC, IP-адрес, порт и текст запроса — и кто из устройств на пути что в ней читает?',
        'Frames, addresses, routes, ports — you touched them one at a time. But what goes onto the wire is not four different things but one sequence of bytes. How do the MAC, the IP address, the port and the request text live in it together — and which device on the way reads what?',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.envelopes', caption: bi('Идите по шагам и нажимайте на поля и ступени слоёв; сравните HTTP, DNS и ping; на последнем шаге выберите устройство, увеличьте пакет и сломайте ICMP.', 'Go step by step and click the fields and the rungs of layers; compare HTTP, DNS and ping; on the last step choose a device, grow the packet and break ICMP.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Конверт в конверте', 'An envelope in an envelope'),
      body: bi(
        'Программа отдаёт ядру данные — например, строку HTTP-запроса. Ядро кладёт их в конверт TCP с портами и номерами байтов, этот конверт — в конверт IP с адресами и TTL, а тот — в кадр Ethernet с MAC-адресами. Это [[net.encapsulation|инкапсуляция]]: каждый слой добавляет свой заголовок спереди и не заглядывает внутрь чужого. Получатель снимает конверты в обратном порядке.\n\nРазмеры стоит знать наизусть: заголовок Ethernet — 14 байт (плюс 4 байта контрольной суммы в хвосте), IPv4 — 20 байт без опций, TCP — 20 байт без опций, UDP — 8 байт. Запрос из 45 байт данных превращается в кадр из 99 байт; эхо-запрос ping с 56 байтами данных — в кадр из 98 (14 + 20 + 8 байт ICMP + 56).\n\nКанал пропускает пакеты не больше определённого размера — [[net.mtu|MTU]]. В Ethernet это 1500 байт, считая от начала IP-заголовка. Отсюда MSS — сколько данных TCP помещается в сегмент: 1500 − 20 − 20 = 1460. Что, если пакет больше MTU следующего канала? Если в IP-заголовке снят флаг DF (Don’t Fragment), маршрутизатор порежет пакет на фрагменты, а получатель склеит. Если DF стоит (Linux ставит его для TCP), маршрутизатор пакет выбросит и пришлёт отправителю ICMP «Fragmentation Needed» с допустимым размером — отправитель уменьшит пакеты. Если же этот ICMP кто-то по дороге отфильтрует, большие пакеты будут исчезать без следа, а маленькие проходить: страница «висит» после рукопожатия. Это классическая «чёрная дыра MTU».\n\nУстройства на пути вскрывают разное число конвертов. Коммутатор смотрит только кадр. Маршрутизатор снимает кадр, читает IP, меняет TTL и контрольную сумму и надевает новый кадр; TCP он не открывает. Балансировщик, который видит HTTP, вскрывает все.',
        'A program hands the kernel data — say, an HTTP request line. The kernel puts it into a TCP envelope with ports and byte numbers, that envelope into an IP envelope with addresses and TTL, and that into an Ethernet frame with MAC addresses. This is [[net.encapsulation|encapsulation]]: each layer adds its own header in front and does not look inside the others. The receiver removes the envelopes in reverse order.\n\nThe sizes are worth knowing by heart: the Ethernet header is 14 bytes (plus a 4-byte checksum at the tail), IPv4 is 20 bytes without options, TCP is 20 bytes without options, UDP is 8 bytes. A request of 45 data bytes becomes a frame of 99 bytes; a ping echo request with 56 data bytes becomes a frame of 98 (14 + 20 + 8 bytes of ICMP + 56).\n\nA link carries packets only up to a certain size — the [[net.mtu|MTU]]. On Ethernet that is 1500 bytes, counted from the start of the IP header. Hence the MSS — how much TCP data fits in a segment: 1500 − 20 − 20 = 1460. What if a packet is larger than the MTU of the next link? If the DF (Don’t Fragment) flag is clear in the IP header, the router cuts the packet into fragments and the receiver glues them together. If DF is set (Linux sets it for TCP), the router drops the packet and sends the sender ICMP “Fragmentation Needed” with the allowed size — the sender shrinks its packets. But if someone on the way filters that ICMP, large packets vanish without a trace while small ones pass: the page “hangs” after the handshake. This is the classic “MTU black hole”.\n\nDevices on the way open different numbers of envelopes. A switch looks only at the frame. A router strips the frame, reads IP, changes TTL and the checksum and puts on a new frame; it does not open TCP. A load balancer that sees HTTP opens them all.',
      ),
    },
    {
      id: 'models',
      kind: 'text',
      step: 'explain',
      title: bi('Модели как словарь', 'Models as a vocabulary'),
      body: bi(
        'Слои принято нумеровать. [[net.osi|Модель OSI]] насчитывает семь уровней: L1 — физический (сигналы в кабеле), L2 — канальный (кадры и MAC), L3 — сетевой (IP-адреса и маршруты), L4 — транспортный (порты, TCP, UDP), L5 — сеансовый, L6 — представления, L7 — прикладной (HTTP, DNS, SSH). Модель TCP/IP описывает тот же стек четырьмя слоями: канальный, межсетевой, транспортный, прикладной. В интернете у уровней 5 и 6 нет отдельных конвертов — их работу делают само приложение и TLS.\n\nУчить модель ради модели не нужно: это словарь. Когда коллега говорит «проблема на L3», он имеет в виду адреса и маршруты. «L4-балансировщик» видит только адреса и порты, «L7-балансировщик» — HTTP целиком, с путями и заголовками. А главный вопрос при любом сбое звучит так: *какой уровень сломался?* `Network is unreachable` — L3. `Connection refused` — L4. Ответ 404 — L7. С этого вопроса начинается каждый разбор в этом курсе.',
        'Layers are usually numbered. The [[net.osi|OSI model]] counts seven: L1 physical (signals in the cable), L2 data link (frames and MAC), L3 network (IP addresses and routes), L4 transport (ports, TCP, UDP), L5 session, L6 presentation, L7 application (HTTP, DNS, SSH). The TCP/IP model describes the same stack in four layers: link, internet, transport, application. On the internet layers 5 and 6 have no envelopes of their own — the application and TLS do their work.\n\nThere is no need to learn the model for its own sake: it is a vocabulary. When a colleague says “an L3 problem”, they mean addresses and routes. An “L4 load balancer” sees only addresses and ports; an “L7 load balancer” sees all of HTTP, with paths and headers. And the main question in any failure is: *which layer broke?* `Network is unreachable` is L3. `Connection refused` is L4. A 404 answer is L7. Every investigation in this course starts with that question.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home'),
      intro: bi('Ноутбук в домашней сети, путь до shop.example открыт.', 'A laptop on a home network; the path to shop.example is open.'),
      tasks: [
        {
          id: 'len',
          prompt: bi('Отправьте один эхо-запрос до shop.example и посмотрите его кадр в tcpdump -n -e: там указана длина кадра. Запишите это число в ~/len.txt.', 'Send one echo request to shop.example and look at its frame in tcpdump -n -e: the frame length is shown there. Write that number into ~/len.txt.'),
          check: { when: "files['/root/len.txt'].text~'98'", fail: [{ if: "files['/root/len.txt'].text~'64'", say: bi('64 — длина ICMP-сообщения (8 байт заголовка + 56 данных). Кадр ещё несёт 20 байт IP и 14 байт Ethernet.', '64 is the ICMP message length (8 header bytes + 56 data). The frame also carries 20 bytes of IP and 14 bytes of Ethernet.') }] },
          chips: 'ping -c 1 shop.example; tcpdump -n -e icmp',
          hints: { H1: bi('В строке tcpdump -e после ethertype идёт «length N:» — это длина кадра.', 'In a tcpdump -e line after the ethertype comes “length N:” — the frame length.'), H2: bi('Проверьте себя счётом: 14 + 20 + 8 + 56.', 'Check yourself by counting: 14 + 20 + 8 + 56.') },
        },
        {
          id: 'df',
          prompt: bi('Найдите наибольший размер данных ping с запретом фрагментации (-M do), который ещё проходит через eth0 с MTU 1500. Запишите число в ~/max.txt.', 'Find the largest ping data size with fragmentation forbidden (-M do) that still passes through eth0 with an MTU of 1500. Write the number into ~/max.txt.'),
          check: { when: "files['/root/max.txt'].text~'1472'", fail: [{ if: "files['/root/max.txt'].text~'1500'", say: bi('1500 — весь IP-пакет. Данные ping — это 1500 минус 20 байт IP и 8 байт ICMP.', '1500 is the whole IP packet. The ping data is 1500 minus 20 bytes of IP and 8 bytes of ICMP.') }] },
          chips: 'ping -c 1 -M do -s 1472 shop.example',
          docRef: { page: 'man/ping.8', anchor: 'OPTIONS', line: '-M pmtudisc_opt' },
          hints: { H1: bi('Слишком большой пакет с -M do ядро не отправит: «message too long, mtu=1500».', 'The kernel refuses to send a too-large packet with -M do: “message too long, mtu=1500”.'), H2: bi('Посчитайте: MTU − заголовок IP − заголовок ICMP.', 'Count: MTU − the IP header − the ICMP header.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('В tcpdump(8) в конце команды пишут фильтр: «только arp», «только порт 53». В каком разделе описано, как его составлять? Нажмите на раздел.', 'At the end of a tcpdump(8) command you write a filter: “only arp”, “only port 53”. Which section describes how to write it? Click the section.'),
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
  summary: bi('Иерархия зон, кто ищет ответ и кто его знает, кэши и TTL, коды ответа — и почему dig и браузер иногда видят разное.', 'The hierarchy of zones, who searches for the answer and who knows it, caches and TTL, answer codes — and why dig and the browser sometimes see different things.'),
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
        'В блоке Linux `dig` отвечал адресом за миллисекунды, а `/etc/resolv.conf` содержал одну строку `nameserver`. Кто стоит за этой строкой? Откуда он знает адрес shop.example, если магазин открылся вчера? И почему после переезда сайта у половины пользователей он ещё сутки открывается по старому адресу?',
        'In the Linux block `dig` answered with an address in milliseconds, and `/etc/resolv.conf` held a single `nameserver` line. Who stands behind that line? How does it know the address of shop.example if the shop opened yesterday? And why, after a site moves, does it keep opening at the old address for half the users for another day?',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Иерархия и два вида серверов', 'A hierarchy and two kinds of servers'),
      body: bi(
        'Людям удобны имена, машинам — адреса. [[net.dns|DNS]] превращает одно в другое. Имя читается справа налево: в `shop.example.` последняя точка — корень, `example.` — зона первого уровня (TLD), `shop.example.` — зона магазина. Каждая зона отвечает за себя и знает, кому делегированы зоны ниже.\n\nВ DNS два вида серверов. [[net.authoritative|Авторитативный сервер]] хранит саму зону: у сервера ns1.hosting.example лежит запись «shop.example — 198.51.100.20». Его ответу верят — в ответе стоит флаг `aa`. [[net.resolver|Рекурсивный резолвер]] ничего своего не хранит, зато ищет ответ за клиента: резолвер провайдера, домашний роутер, публичные 1.1.1.1 и 8.8.8.8. Именно его адрес записан в `/etc/resolv.conf`.\n\nРезолвер с пустым кэшем начинает с корня. Корневых серверов тринадцать имён — от a.root-servers.net до m.root-servers.net, — а за ними больше полутора тысяч машин по всему миру. Они делят одни и те же адреса: это [[net.anycast|anycast]], один адрес объявлен по BGP из многих мест, и маршруты приводят вас к ближайшему экземпляру. Корень не знает адреса магазина. Он отвечает направлением: «за зону example. отвечает a.nic.example, вот его адрес». Сервер зоны example. так же направляет дальше: «за shop.example отвечает ns1.hosting.example». Эти направления — записи NS, а адреса серверов при них называют glue. И только авторитативный сервер магазина отвечает самим адресом. Современный резолвер ещё и не выдаёт лишнего: корню он сообщает только «example.», а не полное имя (минимизация QNAME, RFC 9156).\n\nОтвет хранится в зоне как [[net.rr|ресурсная запись]]: имя, TTL, тип, значение. Типы, которые встречаются каждый день: A (адрес IPv4), AAAA (IPv6), CNAME (имя-псевдоним: «www.shop.example — это shop.example»), MX (почтовый сервер), NS (кто отвечает за зону), TXT (произвольный текст — проверки домена, SPF).',
        'People like names, machines like addresses. [[net.dns|DNS]] turns one into the other. A name is read right to left: in `shop.example.` the final dot is the root, `example.` is a top-level zone (TLD), `shop.example.` is the shop’s zone. Every zone answers for itself and knows whom the zones below it are delegated to.\n\nThere are two kinds of DNS servers. An [[net.authoritative|authoritative server]] holds the zone itself: ns1.hosting.example has the record “shop.example — 198.51.100.20”. Its answer is trusted — the answer carries the `aa` flag. A [[net.resolver|recursive resolver]] holds nothing of its own but finds the answer for the client: the provider’s resolver, the home router, the public 1.1.1.1 and 8.8.8.8. Its address is what `/etc/resolv.conf` holds.\n\nA resolver with an empty cache starts at the root. The root servers have thirteen names — from a.root-servers.net to m.root-servers.net — and behind them more than fifteen hundred machines worldwide. They share the same addresses: this is [[net.anycast|anycast]], one address announced over BGP from many places, and routes bring you to the nearest instance. The root does not know the shop’s address. It answers with a referral: “a.nic.example answers for the example. zone; here is its address.” The example. zone server refers further in the same way: “ns1.hosting.example answers for shop.example.” These referrals are NS records, and the server addresses that come with them are called glue. Only the shop’s authoritative server answers with the address itself. A modern resolver also gives away no more than needed: it tells the root only “example.”, not the full name (QNAME minimisation, RFC 9156).\n\nAn answer is stored in the zone as a [[net.rr|resource record]]: name, TTL, type, value. The types you meet every day: A (an IPv4 address), AAAA (IPv6), CNAME (an alias: “www.shop.example is shop.example”), MX (the mail server), NS (who answers for the zone), TXT (arbitrary text — domain checks, SPF).',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.dns', caption: bi('Двигайте время второго запроса и TTL; положите имя в /etc/hosts; сломайте авторитативный сервер и сделайте опечатку.', 'Move the time of the second request and the TTL; put the name in /etc/hosts; break the authoritative server and make a typo.') },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Кэши, TTL и коды ответа', 'Caches, TTL and answer codes'),
      body: bi(
        'Резолвер запоминает каждый ответ на столько секунд, сколько указано в его TTL. Пока TTL не истёк, следующий вопрос о том же имени он отвечает из кэша, и авторитативный сервер о нём даже не узнаёт. Отсюда «сайт переехал, а у части пользователей открывается старый адрес»: их резолверы держат старую запись до конца TTL. Никакого «распространения DNS» нет — есть кэши с часами. Перед переездом TTL снижают заранее, до минут, и ждут истечения прежнего.\n\nКоды ответа надо различать с первого взгляда. `NOERROR` — всё в порядке (хотя записей нужного типа может и не быть). `NXDOMAIN` — окончательное «такого имени нет»; его тоже кэшируют. `SERVFAIL` — «не смог выяснить»: обычно авторитативный сервер недоступен. `REFUSED` — сервер отказался отвечать вам. Если же ответа нет совсем, `dig` пишет `connection timed out; no servers could be reached` — это уже вопрос транспорта: до резолвера не доходит UDP на порт 53.\n\nИ ещё одна ловушка. Программы — curl, браузер, ping — спрашивают имя не напрямую у DNS, а через библиотеку ОС, stub-резолвер. Она сначала читает `/etc/hosts` (порядок задаёт `/etc/nsswitch.conf`) и только потом спрашивает сервер из `/etc/resolv.conf`. `dig` устроен иначе: он всегда спрашивает DNS-сервер напрямую и `/etc/hosts` не видит. Поэтому «у меня curl открывает, а dig показывает другой адрес» — почти всегда запись в `/etc/hosts`. Проверить, что видят программы, можно командой `getent hosts имя`.',
        'A resolver remembers each answer for as many seconds as its TTL says. Until the TTL expires it answers the next question about the same name from its cache, and the authoritative server never even hears about it. Hence “the site moved, but some users still get the old address”: their resolvers hold the old record until its TTL ends. There is no “DNS propagation” — there are caches with clocks. Before a move the TTL is lowered in advance, to minutes, and the old one is waited out.\n\nAnswer codes must be told apart at a glance. `NOERROR` — all is well (though there may be no records of the wanted type). `NXDOMAIN` — a final “no such name”; it is cached too. `SERVFAIL` — “could not find out”: usually the authoritative server is unreachable. `REFUSED` — the server declined to answer you. And if there is no answer at all, `dig` says `connection timed out; no servers could be reached` — that is a transport question: UDP to port 53 does not reach the resolver.\n\nOne more trap. Programs — curl, the browser, ping — do not ask DNS directly but go through an OS library, the stub resolver. It reads `/etc/hosts` first (`/etc/nsswitch.conf` sets the order) and only then asks the server from `/etc/resolv.conf`. `dig` works differently: it always asks a DNS server directly and does not see `/etc/hosts`. So “curl opens it for me but dig shows a different address” is almost always an `/etc/hosts` entry. To see what programs see, use `getent hosts name`.',
      ),
    },
    {
      id: 'ndots',
      kind: 'callout',
      tone: 'note',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Короткие имена: search и ndots', 'Short names: search and ndots'),
      body: bi(
        'В `/etc/resolv.conf` бывают строки `search a.lab lab` и `options ndots:5`. Если в имени меньше точек, чем ndots, stub-резолвер сначала пробует дописать к нему каждый search-домен: для `api.example.com` (две точки) — `api.example.com.a.lab`, `api.example.com.lab` и лишь потом само имя. Это лишние вопросы и лишние NXDOMAIN. Точка в конце (`api.example.com.`) отключает перебор. На этом через два блока будет стоять DNS внутри кластера.',
        '`/etc/resolv.conf` may have lines like `search a.lab lab` and `options ndots:5`. If a name has fewer dots than ndots, the stub resolver first tries appending each search domain: for `api.example.com` (two dots) — `api.example.com.a.lab`, `api.example.com.lab`, and only then the name itself. Those are extra questions and extra NXDOMAINs. A trailing dot (`api.example.com.`) turns the search off. DNS inside a cluster, two blocks from now, stands on this.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home', { resolv: 'nameserver 192.168.1.54\n' }, [{ id: 'd', kind: 'dns', to: 'shop.example' }]),
      intro: bi('После «настройки» знакомого ноутбук перестал открывать сайты по именам, хотя по адресам всё работает. Домашний роутер 192.168.1.1 умеет отвечать на вопросы DNS.', 'After a friend’s “tune-up” the laptop no longer opens sites by name, though everything works by address. The home router 192.168.1.1 can answer DNS questions.'),
      tasks: [
        {
          id: 'fix',
          prompt: bi('Найдите, почему имена не находятся, и исправьте через DNS, а не через /etc/hosts.', 'Find out why names are not found and fix it through DNS, not through /etc/hosts.'),
          check: {
            when: "reach.d.answer has '198.51.100.20'",
            fail: [{ if: "files['/etc/hosts'].text~'shop.example'", say: bi('Запись в /etc/hosts — это обход, а не починка: остальные имена всё так же не найдутся.', 'An /etc/hosts entry is a workaround, not a fix: every other name is still not found.') }],
          },
          chips: 'cat /etc/resolv.conf',
          concepts: ['net.resolver'],
          hints: {
            H1: bi('Какому серверу ноутбук задаёт вопросы? Это написано в одном файле.', 'Which server does the laptop ask? One file says.'),
            H2: bi('dig shop.example @192.168.1.1 отвечает? Значит, в /etc/resolv.conf не тот сервер.', 'Does dig shop.example @192.168.1.1 answer? Then /etc/resolv.conf names the wrong server.'),
            H3: bi('echo "nameserver 192.168.1.1" > /etc/resolv.conf', 'echo "nameserver 192.168.1.1" > /etc/resolv.conf'),
          },
        },
        {
          id: 'trace',
          prompt: bi('Пройдите иерархию сами: dig +trace shop.example. Запишите в ~/tld.txt имя сервера, который отвечает за зону example.', 'Walk the hierarchy yourself: dig +trace shop.example. Write the name of the server that answers for the example. zone into ~/tld.txt.'),
          check: { when: "files['/root/tld.txt'].text~'a.nic.example'", fail: [{ if: "files['/root/tld.txt'].text~'ns1.hosting'", say: bi('ns1.hosting.example отвечает за зону shop.example — это уровнем ниже.', 'ns1.hosting.example answers for the shop.example zone — that is one level lower.') }] },
          chips: 'dig +trace shop.example',
          docRef: { page: 'man/dig.1', anchor: 'QUERY OPTIONS', line: '+[no]trace' },
          hints: { H1: bi('Во втором блоке вывода корень отвечает, кто держит зону example.', 'In the second block of output the root says who holds the example. zone.') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите в dig(1), как оставить в выводе только секцию ANSWER — без шапки, флагов и статистики, — и покажите так запись shop.example.', 'Find in dig(1) how to keep only the ANSWER section in the output — without the header, the flags and the statistics — and show the shop.example record that way.'),
      ref: { page: 'man/dig.1', anchor: 'QUERY OPTIONS', line: '+[no]all' },
      terminal: {
        setup: lab('laptop', 'home'),
        task: {
          id: 'answer',
          prompt: bi('Только строка ответа для shop.example.', 'Only the answer line for shop.example.'),
          check: { stdout: /^shop\.example\.\s+\d+\s+IN\s+A\s+198\.51\.100\.20\n?$/ },
          docStep: 3,
          chips: 'dig +noall +answer shop.example',
          hints: { H1: bi('Опции dig начинаются с +. Одна выключает всё, другая включает нужную секцию.', 'dig options start with +. One turns everything off, another turns the needed section back on.') },
        },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Коллега спрашивает, на какой сервер уходит почта для домена shop.example. Узнайте и запишите имя сервера в ~/mx.txt.', 'A colleague asks which server receives mail for the domain shop.example. Find out and write the server’s name into ~/mx.txt.'),
      ref: { page: 'man/dig.1' },
      terminal: {
        setup: lab('laptop', 'home'),
        task: {
          id: 'mx',
          prompt: bi('Имя почтового сервера shop.example — в ~/mx.txt.', 'The name of shop.example’s mail server — in ~/mx.txt.'),
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
  summary: bi('Четыре сообщения, которые дают ноутбуку адрес, шлюз и DNS; что значит 169.254 и чем опасен второй сервер.', 'Four messages that give a laptop an address, a gateway and DNS; what 169.254 means and why a second server is dangerous.'),
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
        'Вы приносите ноутбук в кафе, подключаетесь к Wi-Fi — и через секунду у него адрес, шлюз и DNS-сервер. Вы ничего не вводили. Но ведь ноутбук не знал ни своего адреса, ни адреса того, кого спросить. Как можно задать вопрос, не зная, кому?',
        'You bring a laptop to a café, join the Wi-Fi — and a second later it has an address, a gateway and a DNS server. You typed nothing. Yet the laptop knew neither its own address nor the address of whom to ask. How do you ask a question without knowing whom?',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'net.dhcp', caption: bi('Двигайте срок аренды; выключите сервер; добавьте в сеть второй.', 'Move the lease time; switch the server off; add a second one to the network.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Discover, Offer, Request, Ack', 'Discover, Offer, Request, Ack'),
      body: bi(
        'Спросить всех. Ноутбук без адреса отправляет широковещательную датаграмму UDP с адреса `0.0.0.0` и порта 68 на `255.255.255.255`, порт 67: «Есть тут сервер [[net.dhcp|DHCP]]?» Это Discover. Сервер — обычно в домашнем роутере — отвечает Offer: «Бери 192.168.1.103». Вместе с адресом он передаёт опции: 1 — маска подсети, 3 — шлюз, 6 — DNS-сервер (вот откуда берётся строка в `/etc/resolv.conf`), 51 — срок аренды. Клиент снова широковещательно отвечает Request: «Беру этот адрес у этого сервера» — так и другие серверы узнают, что их предложение отклонено. Сервер подтверждает Ack. Первые буквы дают удобное слово: DORA.\n\nАдрес выдают не навсегда, а в [[net.lease|аренду адреса]] на срок из опции 51. На половине срока (T1) клиент просит своего сервера продлить аренду; если тот молчит, на 87,5 % (T2) спрашивает любого. Не продлил — адрес придётся отдать.\n\nЕсли не ответил никто, клиент не остаётся совсем без адреса: он назначает себе [[net.link-local|link-local]] из `169.254.0.0/16`. С ним можно говорить с соседями по кабелю, но шлюза и интернета нет. Адрес 169.254.x.x на интерфейсе — верный признак: сервер DHCP не ответил.\n\nКлиенты бывают разные. В лабораториях курса и в Debian 13 по умолчанию — `dhcpcd`. На старых системах встретится `dhclient`, на серверах Ubuntu — `systemd-networkd` (`networkctl status`), на ноутбуках — NetworkManager. Протокол у всех один.\n\nИ опасный случай: два сервера в одной сети. Кто-то принёс старый роутер и включил его в коммутатор. Оба ответят на Discover, клиент возьмёт первое предложение — и может получить чужой шлюз, за которым нет интернета. Причина на уровне DHCP, а симптом — на уровне маршрутов: «адрес есть, а интернета нет». Захват покажет два Offer от разных серверов.',
        'Ask everyone. A laptop without an address sends a broadcast UDP datagram from address `0.0.0.0` and port 68 to `255.255.255.255`, port 67: “Is there a [[net.dhcp|DHCP]] server here?” This is Discover. The server — usually in the home router — answers Offer: “Take 192.168.1.103.” Along with the address it sends options: 1 — the subnet mask, 3 — the gateway, 6 — the DNS server (that is where the line in `/etc/resolv.conf` comes from), 51 — the lease time. The client answers with another broadcast, Request: “I take this address from this server” — this also tells other servers their offers were declined. The server confirms with Ack. The first letters make a handy word: DORA.\n\nAn address is given not forever but on an [[net.lease|address lease]] for the time in option 51. At half that time (T1) the client asks its server to renew the lease; if it is silent, at 87.5 % (T2) it asks anyone. No renewal — the address has to be given up.\n\nIf nobody answered, the client is not left with no address at all: it assigns itself a [[net.link-local|link-local]] address from `169.254.0.0/16`. With it you can talk to neighbours on the cable, but there is no gateway and no internet. A 169.254.x.x address on an interface is a sure sign: the DHCP server did not answer.\n\nClients differ. In the course labs and in Debian 13 the default is `dhcpcd`. On older systems you meet `dhclient`, on Ubuntu servers `systemd-networkd` (`networkctl status`), on laptops NetworkManager. The protocol is the same for all.\n\nAnd a dangerous case: two servers on one network. Someone brought an old router and plugged it into the switch. Both answer the Discover, the client takes the first offer — and may get the wrong gateway, with no internet behind it. The cause is at the DHCP level; the symptom is at the level of routes: “there is an address but no internet”. A capture shows two Offers from different servers.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lab('laptop', 'home', { noAddr: true }),
      intro: bi('Ноутбук только что подключили к домашней сети. У eth0 нет адреса.', 'The laptop has just joined the home network. eth0 has no address.'),
      tasks: [
        {
          id: 'lease',
          prompt: bi('Получите адрес, маршрут и DNS-сервер по DHCP для eth0.', 'Get an address, a route and a DNS server over DHCP for eth0.'),
          check: {
            when: "net.ifaces[name=eth0].addr~'192.168.1.' && net.routes[dst=default].gateway='192.168.1.1'",
            fail: [{ if: "net.ifaces[name=eth0].addr~'169.254.'", say: bi('169.254.x.x — сервер не ответил. Проверьте, что запрос шёл в eth0.', '169.254.x.x — the server did not answer. Check that the request went out of eth0.') }],
          },
          chips: 'dhcpcd eth0',
          docRef: { page: 'man/dhcpcd.8', anchor: 'DESCRIPTION' },
          hints: { H1: bi('Клиент DHCP в этой системе — dhcpcd.', 'The DHCP client on this system is dhcpcd.'), H2: bi('dhcpcd и имя интерфейса.', 'dhcpcd and the interface name.') },
        },
        {
          id: 'dns',
          prompt: bi('Какой DNS-сервер выдал DHCP (опция 6)? Запишите его адрес в ~/dns.txt.', 'Which DNS server did DHCP hand out (option 6)? Write its address into ~/dns.txt.'),
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
      intro: bi('Новый ноутбук в офисе: адрес получает, а интернета нет. Говорят, вчера кто-то подключил к коммутатору свой старый роутер.', 'A new laptop in the office gets an address but no internet. Someone reportedly plugged their old router into the switch yesterday.'),
      tasks: [
        {
          id: 'rogue',
          prompt: bi('Выясните, какой сервер выдал ноутбуку настройки, и запишите адрес этого сервера в ~/rogue.txt.', 'Find out which server gave the laptop its settings and write that server’s address into ~/rogue.txt.'),
          check: { when: "files['/root/rogue.txt'].text~'192.168.1.250'", fail: [{ if: "files['/root/rogue.txt'].text~'192.168.1.1'", say: bi('192.168.1.1 — настоящий роутер. Посмотрите строку «offered … from …» или захват: Offer было два.', '192.168.1.1 is the real router. Look at the “offered … from …” line or the capture: there were two Offers.') }] },
          chips: 'dhcpcd eth0; tcpdump -n port 67 or port 68',
          hints: { H1: bi('dhcpcd пишет, от кого пришло предложение.', 'dhcpcd prints whom the offer came from.'), H2: bi('В захвате видно два ответа Reply от разных адресов.', 'The capture shows two Reply answers from different addresses.') },
        },
      ],
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите в dhcpcd(8) флаг, который получает предложение сервера, но не меняет настройки машины, и покажите, какой DNS-сервер выдал бы DHCP.', 'Find the dhcpcd(8) flag that gets the server’s offer but does not change the machine’s settings, and show which DNS server DHCP would hand out.'),
      ref: { page: 'man/dhcpcd.8', anchor: 'OPTIONS', line: '-T, --test' },
      terminal: {
        setup: lab('laptop', 'home', { noAddr: true }),
        task: {
          id: 'test',
          prompt: bi('Тестовый запрос DHCP для eth0, без изменения настроек.', 'A test DHCP request for eth0, without changing the settings.'),
          check: { stdout: /new_domain_name_servers=192\.168\.1\.1/ },
          docStep: 3,
          chips: 'dhcpcd -T eth0',
          hints: { H1: bi('Ищите в OPTIONS слово «test».', 'Look for the word “test” in OPTIONS.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.dhcp.order', 'net.q.dhcp.ll', 'net.q.dhcp.opts'] },
  ],
};
