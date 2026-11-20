// Lesson 13a of the Networks block: VPN and tunnels. A WireGuard tunnel from
// home into the office network on the net.vpn explainer, the routes it adds,
// the second IP header and its cost in MTU, split and full tunnels, and a
// comparison of NAT, proxies, VPN and the SSH tunnel by who opens which
// connection and who sees what.

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { EN, RU, src } from './sources';

export const vpn: Lesson = {
  id: 'networks.vpn',
  block: 'networks',
  title: bi('Как VPN и туннели пускают во внутреннюю сеть издалека', 'VPN and tunnels: how to get into an internal network from afar'),
  summary: bi(
    'Как ноутбук дома становится частью сети офиса: интерфейс VPN, маршруты, которые он добавляет, второй заголовок IP у каждого пакета и то, чем VPN отличается от NAT, прокси и туннеля SSH.',
    'How a laptop at home becomes part of the office network: the VPN interface, the routes it adds, the second IP header on every packet, and how a VPN differs from NAT, a proxy and an SSH tunnel.',
  ),
  introduces: ['net.vpn'],
  uses: ['net.ip', 'net.private', 'net.subnet', 'net.route-table', 'net.lpm', 'net.gateway', 'net.nat', 'net.udp', 'net.port', 'net.mtu', 'net.encapsulation', 'net.tls', 'net.reverse-proxy', 'linux.ssh-tunnel'],
  tier: 'core',
  minutes: 30,
  sources: src([EN.wireguard, EN.wgQuick, EN.sshTunnel], [RU.vpn, RU.wireguard, RU.nat]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вечером приходит сообщение о том, что на рабочем сервере кончается место на диске, а вы дома. Сервер мониторинга, на котором видно, какой диск и с какой скоростью заполняется, стоит во внутренней сети офиса `10.20.0.0/16`, и адрес у него частный, `10.20.3.7`. Из дома до него не добраться: частные адреса в интернете не маршрутизируются, а NAT на границе офиса пропускает внутрь только проброшенные порты. Пробросить порт мониторинга на весь интернет опасно, потому что тогда его увидят все. Нужно, чтобы ваш ноутбук на время стал частью офисной сети, и это делает VPN. На собеседованиях к тому же часто просят объяснить, чем VPN отличается от прокси, и к концу урока у вас будет точный ответ.',
        'In the evening a message says that a production server is running out of disk space, and you are at home. The monitoring server, which shows which disk is filling up and how fast, sits in the office network `10.20.0.0/16`, and its address is private, `10.20.3.7`. From home it cannot be reached: private addresses are not routed on the internet, and the NAT at the office border lets in only forwarded ports. Forwarding the monitoring port to the whole internet is dangerous, because then everyone sees it. Your laptop has to become part of the office network for a while, and a VPN does exactly that. Interviews also often ask how a VPN differs from a proxy, and by the end of the lesson you will have a precise answer.',
      ),
    },
    {
      id: 'explain1',
      kind: 'text',
      step: 'explain',
      title: bi('Пакет внутри пакета', 'A packet inside a packet'),
      body: bi(
        'В уроке о конвертах вы видели, как каждый уровень вкладывает данные верхнего уровня в свой конверт. Туннель делает с этим порядком неожиданную вещь: он берёт уже готовый пакет IP, со всеми его заголовками, и кладёт его целиком внутрь другого пакета IP как обычные данные. Внутренний пакет несёт частные адреса офиса, `10.20.99.5 → 10.20.3.7`, а внешний несёт публичные адреса, по которым пакет можно доставить через интернет: адрес вашей квартиры и адрес шлюза офиса. Туннель, у которого внутренний пакет зашифрован и подписан, называют [[net.vpn|VPN]] (virtual private network, виртуальная частная сеть). Раз пакет зашифрован и подписан, по дороге его нельзя ни прочитать, ни подменить.\n\nСовременный и самый простой в настройке VPN называется WireGuard, и на его примере видно всё устройство. Когда вы подключаетесь, на ноутбуке появляется новый сетевой интерфейс `wg0` с адресом из сети офиса, например `10.20.99.5`, и новая строка в таблице маршрутов: `10.20.0.0/16 dev wg0`. Пакет к `10.20.3.7` ядро отправляет так же, как любой другой: ищет подходящую строку, и строка `/16` выигрывает у `default` по правилу самого длинного префикса из урока о маршрутизации. Пакет уходит в `wg0`, WireGuard шифрует его, вкладывает в датаграмму UDP на порт 51820 шлюза офиса и отправляет эту датаграмму через обычный интерфейс `eth0`. Шлюз проверяет ключ, расшифровывает датаграмму, достаёт исходный пакет и пересылает его во внутреннюю сеть как обычный маршрутизатор.\n\nЗа второй заголовок приходится платить местом. Внешний заголовок IPv4, заголовок UDP и служебные поля WireGuard вместе занимают 60 байт, а если снаружи идёт IPv6, то 80 байт. Поэтому у интерфейса `wg0` по умолчанию MTU 1420, то есть 1500 − 80, с запасом на оба случая: иначе пакет вместе с туннельной обёрткой не поместился бы в кадр обычной сети.',
        'In the envelopes lesson you saw how every layer puts the data of the layer above into its own envelope. A tunnel does something unexpected with this order: it takes a finished IP packet, with all its headers, and puts it whole inside another IP packet as ordinary data. The inner packet carries the office’s private addresses, `10.20.99.5 → 10.20.3.7`, and the outer one carries public addresses by which the packet can be delivered across the internet: your flat’s address and the office gateway’s address. A tunnel whose inner packet is encrypted and signed is called a [[net.vpn|VPN]] (virtual private network): on the way the packet can be neither read nor replaced.\n\nA modern VPN that is the simplest to set up is called WireGuard, and it shows the whole design. When you connect, a new network interface `wg0` appears on the laptop with an address from the office network, say `10.20.99.5`, and a new line in the routing table: `10.20.0.0/16 dev wg0`. The kernel sends a packet to `10.20.3.7` like any other: it looks for a matching line, and the `/16` line beats `default` by the longest prefix rule from the routing lesson. The packet goes into `wg0`, WireGuard encrypts it, puts it into a UDP datagram to port 51820 of the office gateway and sends that datagram through the ordinary `eth0` interface. The gateway checks the key, decrypts the datagram, takes out the original packet and forwards it into the internal network like an ordinary router.\n\nThe second header costs room. The outer IPv4 header, the UDP header and WireGuard’s own fields take 60 bytes together, and 80 bytes if IPv6 is used outside. So the `wg0` interface has an MTU of 1420 by default, that is 1500 − 80, with room for both cases: otherwise a packet with its tunnel wrapping would not fit into a frame of an ordinary network.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Путь пакета через туннель', 'The path of a packet through the tunnel'),
      body: bi(
        'Схема ниже показывает, что происходит с одним пакетом, когда браузер на ноутбуке открывает страницу сервера мониторинга. Слева ноутбук и его интерфейс `wg0`, в середине домашний роутер и интернет, справа шлюз VPN на границе офиса и под ним сам сервер мониторинга. Сначала на схеме только ноутбук и `wg0`, а остальные участники появляются, когда до них доходит пакет. Важнее всего здесь карточка на линии: до `wg0` и после шлюза по сети идёт исходный пакет с частными адресами, а между ними зашифрованная датаграмма, у которой видны только внешние адреса.',
        'The diagram below shows what happens to one packet when the browser on the laptop opens a page of the monitoring server. On the left are the laptop and its `wg0` interface, in the middle the home router and the internet, on the right the VPN gateway at the office border and under it the monitoring server itself. At first only the laptop and `wg0` are on the diagram; the others appear when the packet reaches them. The card on the line matters most: before `wg0` and after the gateway the original packet with private addresses travels, and between them an encrypted datagram on which only the outer addresses are visible.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'net.vpn',
      howto: bi(
        'Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен блок, который работает сейчас, и облачко рядом с ним говорит, что он делает. Сравните карточку на линии до `wg0`, в интернете и после шлюза: адреса на ней меняются, а фигурные скобки означают, что содержимое зашифровано. Значки объяснены в легенде под схемой.\n\nПосле первого прохода переключите над схемой режим «весь трафик ноутбука» и посмотрите, куда теперь уходит запрос к обычному сайту. Потом включите по одной поломки в блоке «Сломать»: фильтр в сети гостиницы и сервер без маршрута обратно. На среднем и опытном уровне там же есть шлюз, который не знает ключа ноутбука. Перед каждой поломкой схема спросит, что, по-вашему, случится.',
        'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the block working now is highlighted, and the callout next to it says what it does. Compare the card on the line before `wg0`, on the internet and after the gateway: the addresses on it change, and curly braces mean the contents are encrypted. The legend under the diagram explains the pictograms.\n\nAfter the first pass switch to “all of the laptop’s traffic” above the diagram and see where a request to an ordinary site goes now. Then switch on the breaks in “Break it” one at a time: a filter in a hotel network and a server without a route back. At the intermediate and experienced levels there is also a gateway that does not know the laptop’s key. Before each break the diagram asks what you think will happen.',
      ),
      caption: bi(
        'Все поломки снаружи выглядели одинаково: ping к серверу молчит. Различает их только то, до какого места дошёл пакет, и в следующем разделе собраны команды, которыми это место находят.',
        'From outside all the breaks looked the same: a ping to the server is silent. Only how far the packet got tells them apart, and the next section collects the commands that find that place.',
      ),
    },
    {
      id: 'explain2',
      kind: 'text',
      step: 'explain',
      title: bi('Разделённый туннель и поиск неисправности в VPN', 'A split tunnel and troubleshooting a VPN'),
      body: bi(
        'Какие адреса пойдут в туннель, решают маршруты, которые VPN добавляет на ноутбуке. Если добавлен только маршрут к сети офиса, туннель называют разделённым: в офис уходит трафик к `10.20.0.0/16`, а остальные сайты открываются напрямую, как без VPN. Если в туннель направлен и маршрут `default`, весь трафик ноутбука выходит в интернет через офис, и сайты видят адрес офиса, а не квартиры. Так настраивают, когда весь трафик сотрудников должен проходить через фильтры компании, и так же устроены коммерческие VPN-сервисы.\n\nКогда VPN не работает, ищут место, до которого дошёл пакет, так же, как в остальных уроках блока. Команда `ip route get 10.20.3.7` показывает, уходит ли пакет в `wg0` или мимо туннеля. Команда `wg show` показывает, когда в последний раз прошло рукопожатие с шлюзом (строка `latest handshake`) и сколько байтов принято и отправлено. Если отправлено много, а принято ноль и рукопожатия не было, датаграммы не доходят до шлюза или шлюз не принимает ключ. Если рукопожатие свежее, а ping молчит, туннель работает, и проверять нужно маршрут обратно: у сервера в офисе должен быть путь к адресам VPN через шлюз, иначе получится «пинг в одну сторону» из урока о маршрутизации. А если маленькие пакеты проходят, а большие страницы зависают, дело в MTU. Проверьте его командой `ping -M do -s 1392 10.20.3.7`: она отправляет пакет ровно на 1420 байт с запретом дробить его. Если такой пакет проходит, а пакет на 1500 байт, то есть `ping -M do -s 1472`, пропадает, значит, MTU интерфейса `wg0` кто-то увеличил, и его нужно вернуть к 1420 строкой `MTU = 1420` в файле настроек.',
        'Which addresses go into the tunnel is decided by the routes the VPN adds on the laptop. If only a route to the office network is added, the tunnel is called split: traffic to `10.20.0.0/16` goes to the office, and other sites open directly, as without a VPN. If the `default` route is pointed into the tunnel too, all of the laptop’s traffic enters the internet through the office, and sites see the office’s address rather than the flat’s. This is set up when all of the staff’s traffic must pass the company’s filters, and commercial VPN services work the same way.\n\nWhen a VPN does not work, you look for the place the packet reached, as in the other lessons of the block. `ip route get 10.20.3.7` shows whether the packet goes into `wg0` or past the tunnel. `wg show` shows when the last handshake with the gateway happened (the `latest handshake` line) and how many bytes were received and sent. If a lot was sent, nothing was received and there was no handshake, the datagrams do not reach the gateway or the gateway does not accept the key. If the handshake is fresh but ping is silent, the tunnel works, and the route back is what to check: the office server must have a path to the VPN addresses through the gateway, otherwise you get the one-way ping from the routing lesson. And if small packets pass while big pages hang, it is the MTU: check it with `ping -M do -s 1392 10.20.3.7`, which sends a packet of exactly 1420 bytes and forbids splitting it. If that packet passes while a 1500-byte one, `ping -M do -s 1472`, vanishes, someone has raised the MTU of `wg0`, and it has to be set back to 1420 with an `MTU = 1420` line in the configuration.',
      ),
    },
    {
      id: 'compare',
      kind: 'text',
      step: 'explain',
      title: bi('Чем отличаются NAT, прокси, VPN и туннель SSH', 'How NAT, a proxy, a VPN and an SSH tunnel differ'),
      body: bi(
        'Все четыре посредника стоят между клиентом и сервером, и их часто путают, хотя работают они по-разному. Чтобы их различить, достаточно спросить, сколько соединений получается и кто что видит.\n\n- [[net.nat|NAT]] ничего не принимает и ничего не открывает сам. Соединение остаётся одним, на его концах по-прежнему ноутбук и сайт, а роутер только переписывает адреса и порты в заголовках его пакетов. Сайт видит адрес роутера.\n- [[net.reverse-proxy|Прокси]] принимает соединение клиента и открывает своё, второе, к серверу. На машине с nginx на один запрос видны два сокета: от клиента и к серверу приложения. Прокси работает на уровне HTTP и читает запросы целиком, а сервер приложения видит адрес прокси и узнаёт адрес клиента только из заголовка `X-Forwarded-For`.\n- VPN вкладывает пакеты целиком и работает на уровне IP, поэтому через туннель проходит что угодно: ping, DNS, SSH и запросы к базе данных. Провайдер видит только зашифрованные датаграммы к шлюзу, а сервер в офисе видит адрес ноутбука из сети VPN, `10.20.99.5`.\n- [[linux.ssh-tunnel|Туннель SSH]] из блока Linux, например `ssh -L 3000:10.20.3.7:3000 bastion`, переносит одно соединение TCP к одному порту. Устроен он ближе к прокси: ssh принимает соединение на порту 3000 вашей машины, а сервер bastion открывает от своего имени второе соединение к `10.20.3.7:3000`. Сервер мониторинга видит адрес bastion.\n\nОбратный прокси и VPN решают противоположные задачи. Обратный прокси публикует внутренний сервис наружу, и прийти к нему может любой, кто знает адрес. VPN, наоборот, пускает внутрь сети только тех, у кого есть ключ, а сама сеть снаружи остаётся закрытой.',
        'All four middlemen stand between a client and a server, and they are often confused, though they work differently. To tell them apart, ask how many connections there are and who sees what.\n\n- [[net.nat|NAT]] accepts nothing and opens nothing itself. There is still one connection, its ends are the laptop and the site, and the router only rewrites addresses and ports in the headers of its packets. The site sees the router’s address.\n- A [[net.reverse-proxy|proxy]] accepts the client’s connection and opens its own, a second one, to the server. On the nginx machine one request shows two sockets: from the client and to the backend. A proxy works at the HTTP level and reads requests whole, and the backend sees the proxy’s address and learns the client’s only from the `X-Forwarded-For` header.\n- A VPN puts packets in whole and works at the IP level, so anything passes through the tunnel: ping, DNS, SSH and database queries. The provider sees only encrypted datagrams to the gateway, and the office server sees the laptop’s VPN address, `10.20.99.5`.\n- An [[linux.ssh-tunnel|SSH tunnel]] from the Linux block, such as `ssh -L 3000:10.20.3.7:3000 bastion`, carries one TCP connection to one port. It is closer to a proxy: ssh accepts the connection on port 3000 of your machine, and the bastion server opens a second connection to `10.20.3.7:3000` on its own behalf. The monitoring server sees the bastion’s address.\n\nA reverse proxy and a VPN solve opposite tasks. A reverse proxy publishes an internal service to the outside, and anyone who knows the address can come to it. A VPN, on the contrary, lets into the network only those who hold a key, and the network itself stays closed from outside.',
      ),
    },
    {
      id: 'config',
      kind: 'callout',
      tone: 'note',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      title: bi('Как выглядит настройка WireGuard на ноутбуке', 'What a WireGuard setup on a laptop looks like'),
      body: bi(
        'Администратор офиса выдаёт файл `/etc/wireguard/wg0.conf`, и команда `wg-quick up wg0` создаёт по нему интерфейс, адрес и маршруты:\n\n```\n[Interface]\nPrivateKey = <закрытый ключ ноутбука>\nAddress = 10.20.99.5/32\nDNS = 10.20.0.53\n\n[Peer]\nPublicKey = <открытый ключ шлюза>\nEndpoint = vpn.corp.example:51820\nAllowedIPs = 10.20.0.0/16\nPersistentKeepalive = 25\n```\n\nПоле `AllowedIPs` работает в обе стороны. Для исходящих пакетов wg-quick превращает его в маршруты, поэтому `0.0.0.0/0` в этом поле делает туннель полным. Для входящих оно служит фильтром: из туннеля ноутбук примет только пакеты с адресами отправителя из этого списка. `PersistentKeepalive` раз в 25 секунд отправляет пустой пакет, чтобы домашний роутер не удалил запись conntrack для датаграмм UDP, пока туннель молчит. Строка `DNS` подменяет резолвер на офисный, иначе внутренние имена вроде `monitor.corp` не найдутся.',
        'The office administrator hands out the file `/etc/wireguard/wg0.conf`, and `wg-quick up wg0` creates the interface, the address and the routes from it:\n\n```\n[Interface]\nPrivateKey = <the laptop’s private key>\nAddress = 10.20.99.5/32\nDNS = 10.20.0.53\n\n[Peer]\nPublicKey = <the gateway’s public key>\nEndpoint = vpn.corp.example:51820\nAllowedIPs = 10.20.0.0/16\nPersistentKeepalive = 25\n```\n\nThe `AllowedIPs` field works both ways. For outgoing packets wg-quick turns it into routes, so `0.0.0.0/0` in this field makes the tunnel full. For incoming ones it is a filter: from the tunnel the laptop accepts only packets whose source address is in this list. `PersistentKeepalive` sends an empty packet every 25 seconds so that the home router does not drop the conntrack entry for the UDP datagrams while the tunnel is quiet. The `DNS` line switches the resolver to the office one; otherwise internal names such as `monitor.corp` are not found.',
      ),
    },
    { id: 'summary', kind: 'text', step: 'exit', title: bi('Что вы теперь умеете', 'What you can do now'), body: bi('Теперь вы знаете, как пакет проходит через туннель VPN и какие маршруты для этого добавляются, умеете отличить разделённый туннель от полного и найти, на каком участке туннель сломался. Вы можете объяснить, чем VPN отличается от NAT, прокси и туннеля SSH.', 'You now know how a packet passes through a VPN tunnel and which routes are added for it, can tell a split tunnel from a full one and find on which segment a tunnel broke. You can explain how a VPN differs from NAT, a proxy and an SSH tunnel.') },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.vpn.route', 'net.q.vpn.sees', 'net.q.vpn.oneway', 'net.q.proxy.vs-nat', 'net.q.vpn.mtu'] },
  ],
};
