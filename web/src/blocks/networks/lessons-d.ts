// Lesson 10a of the Networks block: the network built by hand on real Linux
// machines in the tab (design 00 §6.13). Everything the earlier lessons
// showed in the simulator — the switch, VLAN tags, a router, NAT, the
// firewall, DHCP and DNS — now runs on real kernels: the learner records the
// lab switch's traffic, joins two VLANs with a bridge, turns a machine into a
// router, builds a container's network in a namespace, closes a server with
// nftables and serves addresses and names with dnsmasq.
//
// Each lab is a widget section `net.reallab` (reallab/widget.ts). The
// machines need a desktop browser, so the lesson is in the `plus` tier.

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { EN, RU, src } from './sources';

const lab = (id: string, labId: string, step: 'look' | 'try' | 'practice', levels?: Lesson['sections'][number]['levels']) => ({ id, kind: 'widget' as const, step, widget: 'net.reallab', props: { lab: labId }, levels });

export const linuxLab: Lesson = {
  id: 'networks.linux-lab',
  block: 'networks',
  title: bi('Сеть своими руками на настоящем Linux', 'A network by hand on real Linux'),
  summary: bi(
    'В этом уроке шесть лабораторий на настоящих машинах, которые работают во вкладке браузера: запись трафика на коммутаторе, VLAN и мост, маршрутизатор с NAT, отдельная сеть в пространстве имён, межсетевой экран на nftables, а также DHCP и DNS на dnsmasq.',
    'Six labs on real machines in the tab: recording the switch’s traffic, VLANs and a bridge, a router with NAT, a network of its own in a namespace, a firewall with nftables, DHCP and DNS with dnsmasq.',
  ),
  introduces: ['net.vlan', 'net.bridge', 'net.veth'],
  uses: ['net.switch', 'net.frame', 'net.mac', 'net.broadcast', 'net.arp', 'net.router', 'net.route-table', 'net.gateway', 'net.icmp', 'net.port', 'net.tcp', 'net.dhcp', 'net.lease', 'net.dns', 'net.resolver', 'net.nat', 'net.netfilter', 'net.conntrack', 'linux.namespace'],
  tier: 'plus',
  minutes: 120,
  sources: src([EN.ipLink, EN.ipNetns, EN.bridgeMan, EN.nftWiki, EN.dnsmasqMan, EN.ieee8021q, EN.tcpdump], [RU.vlan, RU.bridgeRu, RU.nftRu, RU.dnsmasqRu]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Во всех прошлых уроках сеть была моделью, точной, но всё же моделью. Здесь за каждой командой стоит настоящее ядро Linux. Машины работают в этой вкладке внутри эмулятора процессора, их сетевые карты подключены к обучающемуся коммутатору, и всё, что вы настроите, выполняет ядро: оно ставит на кадры метки VLAN, пересылает пакеты, подменяет адреса и выбрасывает лишнее. Те же самые команды вы будете набирать на серверах, а через блок увидите, что Docker и Kubernetes записывают те же правила за вас.',
        'In every earlier lesson the network was a model: an honest one, but a model. Here a real Linux kernel is under every command. The machines run in this tab in a processor emulator, their network cards are plugged into a learning switch, and everything you configure is done by the kernel: it tags VLAN frames, forwards packets, rewrites addresses, drops what is not allowed. You will type exactly these commands on servers, and a block from now you will see Docker and Kubernetes write the same rules for you.',
      ),
    },
    {
      id: 'how',
      kind: 'callout',
      tone: 'cost',
      title: bi('Какой компьютер нужен для лабораторий', 'What your computer needs'),
      body: bi(
        'Каждая машина работает под Alpine Linux со 128 МБ памяти, и вместе с эмулятором одна машина занимает во вкладке около 190 МБ. В лабораториях по две или три машины, поэтому нужен ноутбук или настольный компьютер, а на телефоне эти лаборатории не запускаются. Первая машина загружает ядро примерно за полминуты, а остальные копируются с её снимка. Состояние машин сохраняется в браузере, так что, закрыв страницу, вы продолжите с того же места.',
        'Each machine is Alpine Linux with 128 MB of memory, about 190 MB of the tab together with the emulator. The labs have two or three machines, so you need a laptop or a desktop; these labs do not run on a phone. The first machine boots its kernel in about half a minute, the others are copied from its snapshot. The machines’ state is saved in the browser: close the page and you continue where you stopped.',
      ),
    },
    lab('capture', 'capture', 'look'),
    {
      id: 'vlan-text',
      kind: 'text',
      step: 'explain',
      title: bi('VLAN: несколько сетей на одном коммутаторе', 'VLANs: several networks on one switch'),
      body: bi(
        'В офисе стоит один коммутатор, а сетей нужно несколько: бухгалтерия должна быть отделена от гостевого Wi-Fi, а серверы от принтеров. Для этого порты коммутатора делят на [[net.vlan|VLAN]], то есть виртуальные локальные сети. Порт доступа (access) принадлежит одному VLAN: кадры, пришедшие в такой порт, коммутатор пересылает только в порты того же VLAN, и даже широковещательный запрос ARP в чужой VLAN не попадает. Две машины, подключённые к соседним портам, но к разным VLAN, друг друга не видят, как если бы стояли в разных зданиях.\n\nМежду коммутаторами, а также к серверу, которому нужны несколько VLAN сразу, прокладывают транк (trunk). По транку кадры передаются с меткой 802.1Q: это четыре байта после MAC-адресов, в которых записан номер VLAN от 1 до 4094. Один VLAN на транке может передаваться без метки, и его называют родным (native). Linux понимает метки сам: интерфейс `eth0.10` поверх `eth0` получает кадры с меткой 10 уже без метки и ставит эту метку на всё, что отправляет.\n\nСоединить два VLAN можно двумя способами. [[net.bridge|Мост]] (bridge) работает как коммутатор внутри ядра: его порты образуют одну сеть второго уровня, и он запоминает MAC-адреса так же, как настоящий коммутатор. А маршрутизатор, подключённый к каждому VLAN, соединяет их на третьем уровне, как разные подсети. Второй вариант называют «маршрутизатором на палочке» (router on a stick): у маршрутизатора одна сетевая карта, к ней подходит транк, а для каждой подсети создан свой VLAN-интерфейс.',
        'An office has one switch and needs several networks: accounting apart from guest Wi-Fi, servers apart from printers. For that the switch’s ports are divided into [[net.vlan|VLANs]] — virtual local networks. An access port belongs to one VLAN: frames that arrive on it are forwarded only to ports of the same VLAN, and not even a broadcast ARP request reaches another VLAN. Two machines in neighbouring ports but in different VLANs cannot see each other, as if they stood in different buildings.\n\nBetween switches, and to a server that needs several VLANs at once, runs a trunk. Over it frames travel with an 802.1Q tag: four bytes after the MAC addresses holding a VLAN number from 1 to 4094. One VLAN on a trunk may go without a tag; it is called the native VLAN. Linux understands tags itself: the interface `eth0.10` on top of `eth0` receives frames tagged 10 already without the tag and tags everything it sends.\n\nTwo VLANs can be joined in two ways. A [[net.bridge|bridge]] is a switch inside the kernel: its ports form one layer-2 network, and it learns MAC addresses just like a hardware one. A router with a leg in every VLAN joins them at layer 3, as different subnets. The second way is called a router on a stick: one network card, a trunk and a VLAN interface for each subnet.',
      ),
    },
    lab('vlan', 'vlan', 'try'),
    lab('router', 'router', 'practice'),
    {
      id: 'netns-text',
      kind: 'text',
      step: 'explain',
      title: bi('Отдельная сеть в пространстве имён', 'A separate network in a namespace'),
      body: bi(
        'В блоке Linux вы видели [[linux.namespace|пространства имён]], с помощью которых ядро может дать группе процессов свой отдельный взгляд на систему. Сетевое пространство имён даёт процессам отдельный сетевой стек со своими интерфейсами, адресами, таблицей маршрутов, правилами netfilter и даже своим интерфейсом `lo`. Процесс внутри пространства видит только его.\n\nНовое пространство имён пусто, и в нём есть только выключенный `lo`. Связь с внешним миром даёт [[net.veth|пара veth]], то есть виртуальный кабель: всё, что входит в один его конец, выходит из другого. Один конец кладут внутрь пространства, а другой оставляют снаружи, подключают к мосту или маршрутизируют, а на выходе в интернет подменяют адрес. Через блок вы встретите это снова: Docker делает то же самое для каждого запущенного приложения. У Docker мостом служит `docker0`, у каждого приложения своя пара veth, а правило MASQUERADE в таблице nat выпускает приложения наружу.',
        'In the Linux block you saw [[linux.namespace|namespaces]]: the kernel can give a group of processes its own separate view of the system. A network namespace is a separate network stack: its own interfaces, addresses, routing table, netfilter rules and even its own `lo`. A process inside sees only it.\n\nA new namespace is empty, with a single `lo` that is down. A [[net.veth|veth pair]] — a virtual cable — links it to the outside world: whatever goes into one end comes out of the other. One end goes inside, the other stays outside, joins a bridge or is routed, and the address is rewritten on the way out. A block from now you will meet this again: Docker does the same for every application it runs — its `docker0` is a bridge, every application has its own veth, and MASQUERADE in the nat table lets them out.',
      ),
    },
    lab('netns', 'netns', 'practice'),
    {
      id: 'fw-text',
      kind: 'text',
      step: 'explain',
      title: bi('nftables: те же точки в ядре, другой язык правил', 'nftables: the same hooks, another language'),
      body: bi(
        'В уроке о NAT правила писались командой `iptables`. Современный способ управлять netfilter называется `nft`. Таблицы в нём вы создаёте сами и называете как угодно, цепочка сама объявляет, к какой точке пути пакета в ядре она подключена и какая у неё политика, а одно правило может проверять сразу IPv4 и IPv6 (семейство `inet`). Набор правил читается и сохраняется целиком: `nft list ruleset` печатает его в том же синтаксисе, который `nft -f` читает обратно. В Alpine, как и в Debian, `iptables` работает поверх nftables, поэтому правило, добавленное любой из двух команд, видно в выводе `nft list ruleset`.',
        'In the NAT lesson the rules were written with `iptables`. The modern interface to netfilter is `nft`: you create the tables yourself and name them as you like, a chain itself declares which kernel hook it is attached to and what its policy is, and one rule can check IPv4 and IPv6 at once (the `inet` family). A ruleset is read and saved as a whole: `nft list ruleset` prints it in the same syntax `nft -f` reads back. On Alpine, as on Debian, `iptables` works on top of nftables, so a rule added with either command shows up in `nft list ruleset`.',
      ),
    },
    lab('firewall', 'firewall', 'practice'),
    lab('dnsmasq', 'dnsmasq', 'practice'),
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['net.q.lab.vlan-trunk', 'net.q.lab.bridge', 'net.q.lab.veth', 'net.q.lab.netns-order', 'net.q.lab.nft-order', 'net.q.lab.dnsmasq'] },
  ],
};
