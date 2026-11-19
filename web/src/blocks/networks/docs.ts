// Offline pages of the nginx documentation the block reads at the ladder's
// steps 2–3 (03 §14.3): the directive format "Syntax / Default / Context" is
// the first thing m13 teaches. Text condensed from nginx.org (BSD-2-Clause).

import type { DocPage } from '../../core/types';

const directive = (name: string, syntax: string, def: string, context: string, body: string, module = 'ngx_http_proxy_module'): DocPage => ({
  id: `web/nginx.org/${name}`,
  source: 'nginx.org',
  title: `nginx · ${name}`,
  url: `https://nginx.org/en/docs/http/${module}.html#${name}`,
  license: 'condensed from the nginx documentation (BSD-2-Clause)',
  version: 'nginx 1.26',
  sections: [
    { id: 'SYNOPSIS', title: 'Syntax', body: syntax },
    { id: 'DEFAULT', title: 'Default', body: def },
    { id: 'CONTEXT', title: 'Context', body: context },
    { id: 'DESCRIPTION', body },
  ],
});

export const docs: DocPage[] = [
  directive(
    'proxy_read_timeout',
    'proxy_read_timeout time;',
    'proxy_read_timeout 60s;',
    'http, server, location',
    'Defines a timeout for reading a response from the proxied server. The timeout is set only between two successive read operations, not for the transmission of the whole response. If the proxied server does not transmit anything within this time, the connection is closed.',
  ),
  directive(
    'proxy_connect_timeout',
    'proxy_connect_timeout time;',
    'proxy_connect_timeout 60s;',
    'http, server, location',
    'Defines a timeout for establishing a connection with a proxied server. It should be noted that this timeout cannot usually exceed 75 seconds.',
  ),
  directive(
    'proxy_next_upstream',
    'proxy_next_upstream error | timeout | invalid_header | http_500 | http_502 | http_503 | http_504 | http_403 | http_404 | http_429 | non_idempotent | off ...;',
    'proxy_next_upstream error timeout;',
    'http, server, location',
    'Specifies in which cases a request should be passed to the next server:\n\nerror       an error occurred while establishing a connection with the server, passing a request to it, or reading the response header;\ntimeout     a timeout has occurred while establishing a connection with the server, passing a request to it, or reading the response header;\nhttp_500    a server returned a response with the code 500;\nnon_idempotent  normally, requests with a non-idempotent method (POST, LOCK, PATCH) are not passed to the next server if a request has been sent to an upstream server; enabling this option explicitly allows retrying such requests;\noff         disables passing a request to the next server.\n\nOne should bear in mind that passing a request to the next server is only possible if nothing has been sent to a client yet.',
  ),
  directive(
    'server',
    'server address [parameters];',
    '—',
    'upstream',
    'Defines the address and other parameters of a server.\n\nmax_fails=number\n    sets the number of unsuccessful attempts to communicate with the server that should happen in the duration set by the fail_timeout parameter to consider the server unavailable for a duration also set by the fail_timeout parameter. By default, the number of unsuccessful attempts is set to 1.\nfail_timeout=time\n    sets the time during which the specified number of unsuccessful attempts to communicate with the server should happen to consider the server unavailable; and the period of time the server will be considered unavailable. By default, the parameter is set to 10 seconds.\nbackup\n    marks the server as a backup server.\ndown\n    marks the server as permanently unavailable.\n\nIf there is only a single server in a group, max_fails, fail_timeout and slow_start parameters are ignored, and such a server will never be considered unavailable.',
    'ngx_http_upstream_module',
  ),
];

// Pages of iproute2 that ip(8) points to in SEE ALSO. The course itself never
// teaches `nud permanent` or `mtu`: these pages are what the exam's fifth
// ladder step sends the learner to. Text condensed from the Linux man-pages
// project (iproute2, GPL-2.0).

const iproute2 = (name: string, sections: DocPage['sections']): DocPage => ({
  id: `man/${name}.8`,
  source: 'man',
  title: `${name}(8)`,
  url: `https://man7.org/linux/man-pages/man8/${name}.8.html`,
  license: 'condensed from the Linux man-pages project (iproute2, GPL-2.0)',
  version: 'iproute2 6.15',
  sections,
});

docs.push(
  iproute2('ip-link', [
    { id: 'NAME', body: 'ip-link - network device configuration' },
    { id: 'SYNOPSIS', body: 'ip link show [ DEVICE ]\n\nip link set { DEVICE | group GROUP }\n        [ { up | down } ]\n        [ arp { on | off } ]\n        [ mtu MTU ]\n        [ address LLADDR ]\n        [ name NEWNAME ]\n        [ txqueuelen PACKETS ]\n\nip link add [ link DEVICE ] name NAME type TYPE [ ARGS ]\n\nip link delete { DEVICE | group GROUP } type TYPE [ ARGS ]' },
    { id: 'DESCRIPTION', body: 'A link is a network device: a physical card, a loopback, a bridge, a VLAN or a tunnel interface. ip link shows devices and changes their attributes. Changes take effect at once and are lost at reboot unless the system’s network configuration applies them again.' },
    {
      id: 'ip link set',
      title: 'ip link set - change device attributes',
      body: 'dev DEVICE\n       DEVICE specifies network device to operate on.\n\nup and down\n       change the state of the device to UP or DOWN.\n\narp on or arp off\n       change the NOARP flag on the device.\n\nmtu NUMBER\n       change the MTU of the device. The MTU is the largest packet, counted from the start of the IP header, that the device sends without fragmentation.\n\naddress LLADDRESS\n       change the station address of the interface.\n\nname NAME\n       change the name of the device. This operation is not recommended if the device is running or has some addresses already configured.\n\nWarning: If multiple parameter changes are requested, ip aborts immediately after any of the changes have failed.',
    },
    {
      id: 'VLAN',
      title: 'VLAN type support',
      body: 'ip link add link DEVICE name NAME type vlan id VLANID [ protocol { 802.1q | 802.1ad } ]\n\nlink DEVICE\n       the physical device the VLAN interface sits on; tagged frames for VLANID arrive and leave through it.\n\nid VLANID\n       the VLAN identifier, 1 to 4094. Frames received with this tag are passed to the new interface without the tag; frames it sends get the tag.',
    },
    {
      id: 'BRIDGE',
      title: 'Bridge type support and bridge ports',
      body: 'ip link add NAME type bridge [ stp_state { 0 | 1 } ] [ ageing_time AGEING_TIME ] ...\n\n       creates a software bridge: the kernel forwards frames between its ports and learns MAC addresses like a switch.\n\nip link set DEVICE master DEVICE\n       master DEVICE: makes DEVICE a port of the bridge (its master).\n\nip link set DEVICE nomaster\n       nomaster: removes DEVICE from its bridge.',
    },
    {
      id: 'VETH',
      title: 'VETH, VXCAN type support',
      body: 'ip link add DEVICE type veth [ peer name PEER [ netns NETNS ] ]\n\n       creates a pair of virtual Ethernet devices connected to each other: a packet sent on one end is received on the other.\n\npeer name PEER\n       the name of the other end.\n\nnetns NETNS\n       moves the other end into the network namespace NETNS at once; ip link set DEVICE netns NETNS moves an existing device.\n\nip link add veth-host type veth peer name veth-blue netns blue\n       one end stays here as veth-host, the other appears in blue as veth-blue.',
    },
    { id: 'EXAMPLES', body: 'ip link show\n    Shows the state of all network interfaces on the system.\nip link set dev ppp0 mtu 1400\n    Change the MTU the ppp0 device.\nip link add link eth0 name eth0.10 type vlan id 10\n    Creates a new vlan device eth0.10 on device eth0.\nip link add br0 type bridge && ip link set eth0.10 master br0\n    Creates the bridge br0 and makes eth0.10 its port.\nip link add veth-host type veth peer name veth-blue netns blue\n    Creates a veth pair with one end in the namespace blue.' },
    { id: 'SEE ALSO', body: 'ip(8), ip-address(8), ip-neighbour(8)' },
  ]),
  iproute2('ip-neighbour', [
    { id: 'NAME', body: 'ip-neighbour - neighbour/arp tables management' },
    { id: 'SYNOPSIS', body: 'ip neigh { add | del | change | replace } { ADDR [ lladdr LLADDR ] [ nud STATE ] | proxy ADDR } [ dev DEV ]\n\nip neigh { show | flush } [ to PREFIX ] [ dev DEV ] [ nud STATE ]\n\nSTATE := { delay | failed | incomplete | noarp | none | permanent | probe | reachable | stale }' },
    { id: 'DESCRIPTION', body: 'The ip neigh command manipulates neighbour objects that establish bindings between protocol addresses and link layer addresses for hosts sharing the same link. Neighbour entries are organized into tables. The IPv4 neighbour table is also known by another name - the ARP table.\n\nThe corresponding commands display neighbour bindings and their properties, add new neighbour entries and delete old ones.' },
    {
      id: 'ip neighbour add',
      title: 'ip neighbour add, change, replace',
      body: 'ip neighbour add - add a new neighbour entry\nip neighbour change - change an existing entry\nip neighbour replace - add a new entry or change an existing one\n\nto ADDRESS (default)\n       the protocol address of the neighbour. It is either an IPv4 or IPv6 address.\n\ndev NAME\n       the interface to which this neighbour is attached.\n\nlladdr LLADDRESS\n       the link layer address of the neighbour. LLADDRESS can also be null.\n\nnud STATE\n       the state of the neighbour entry. nud is an abbreviation for ’Neighbour Unreachability Detection’. The state can take one of the following values:\n\n       permanent  the neighbour entry is valid forever and can be only be removed administratively.\n       noarp      the neighbour entry is valid. No attempts to validate this entry will be made but it can be removed when its lifetime expires.\n       reachable  the neighbour entry is valid until the reachability timeout expires.\n       stale      the neighbour entry is valid but suspicious.',
    },
    { id: 'ip neighbour show', title: 'ip neighbour show - list neighbour entries', body: 'to ADDRESS (default)\n       the prefix selecting the neighbours to list.\n\ndev NAME\n       only list the neighbours attached to this device.\n\nnud STATE\n       only list neighbour entries in this state.' },
    { id: 'EXAMPLES', body: 'ip neighbour\n    Shows the current neighbour table in kernel.\nip neigh flush dev eth0\n    Removes entries in the neighbour table on device eth0.' },
    { id: 'SEE ALSO', body: 'ip(8), arp(8)' },
  ]),
);

// Pages the real-Linux labs point to (lessons-d.ts, reallab/): ip-netns(8)
// and bridge(8) of iproute2, nft(8) of nftables and dnsmasq(8). The machines
// carry the full pages themselves (`man nft`); these are short versions for
// the ladder's steps 2–3, written for the course after the upstream manuals.

const upstream = (id: string, title: string, url: string, license: string, version: string, sections: DocPage['sections']): DocPage => ({ id, source: 'man', title, url, license, version, sections });

docs.push(
  iproute2('ip-netns', [
    { id: 'NAME', body: 'ip-netns - process network namespace management' },
    { id: 'SYNOPSIS', body: 'ip netns [ list ]\nip netns add NETNSNAME\nip netns delete NETNSNAME\nip [-all] netns exec [ NETNSNAME ] command...\nip -n NETNSNAME OBJECT COMMAND' },
    { id: 'DESCRIPTION', body: 'A network namespace is a logically another copy of the network stack, with its own routes, firewall rules and network devices. ip netns add NAME creates a new named namespace, ip netns list shows them, ip netns exec NAME cmd runs cmd inside it, and ip -n NAME is a shortcut for running ip itself there. A new namespace has only the loopback device lo, and it is down.' },
    { id: 'EXAMPLES', body: 'ip netns add blue\n    Creates the namespace blue.\nip netns exec blue ip addr\n    Runs ip addr inside blue.\nip -n blue link set lo up\n    Brings up the loopback of blue.' },
    { id: 'SEE ALSO', body: 'ip(8), ip-link(8), namespaces(7)' },
  ]),
  iproute2('bridge', [
    { id: 'NAME', body: 'bridge - show / manipulate bridge addresses and devices' },
    { id: 'SYNOPSIS', body: 'bridge [ OPTIONS ] OBJECT { COMMAND | help }\nOBJECT := { link | fdb | mdb | vlan }' },
    { id: 'DESCRIPTION', body: 'bridge shows the ports of Linux bridges and their forwarding tables. Bridges and their ports themselves are created with ip link (type bridge, master).' },
    { id: 'LINK', title: 'bridge link - bridge port', body: 'bridge link show\n       lists the ports of every bridge with their state: disabled, listening, learning, forwarding or blocking.' },
    { id: 'FDB', title: 'bridge fdb - forwarding database management', body: 'bridge fdb show [ br BRIDGE ] [ brport DEVICE ]\n       lists the forwarding database: which MAC address the bridge has learned behind which port, one entry per line: LLADDR dev DEVICE master BRIDGE.\n\nbridge fdb add LLADDR dev DEV\n       adds a static entry.' },
    { id: 'SEE ALSO', body: 'ip(8), ip-link(8)' },
  ]),
  upstream('man/nft.8', 'nft(8)', 'https://www.netfilter.org/projects/nftables/manpage.html', 'condensed from the nftables manual (GPL-2.0)', 'nftables 1.1', [
    { id: 'NAME', body: 'nft - Administration tool of the nftables framework for packet filtering and classification' },
    { id: 'SYNOPSIS', body: 'nft [ -nNscaeSupyjtT ] [ -f filename | -i | cmd ...]\nnft list ruleset' },
    { id: 'DESCRIPTION', body: 'nft is the command line tool used to set up, maintain and inspect packet filtering and classification rules in the Linux kernel, in the nftables framework. Tables hold chains, chains hold rules. A base chain is attached to a netfilter hook (prerouting, input, forward, output, postrouting) and has a policy; a regular chain is reached only by a jump.' },
    { id: 'TABLES', body: 'nft add table [family] table\nfamily is one of ip, ip6, inet (IPv4 and IPv6 together), arp, bridge, netdev; ip is the default.' },
    { id: 'CHAINS', body: "nft add chain [family] table chain '{ type filter hook input priority 0; policy drop; }'\n\ntype: filter, nat or route. hook: where in the packet path the chain is attached. priority: order among chains on the same hook. policy: the verdict for packets that no rule of the chain accepted or dropped, accept (the default) or drop." },
    { id: 'RULESET', body: 'nft list ruleset\n       prints the whole ruleset in the syntax nft -f reads back.\nnft flush ruleset\n       removes every table.\nnft -f file\n       loads the rules from a file (on Alpine the service nftables loads /etc/nftables.nft).' },
    { id: 'MATCHES', body: 'ip saddr 10.0.0.42          the source address (ip daddr: the destination)\ntcp dport 22                 the destination port (udp dport, tcp sport ...)\niif lo / iifname "eth0"      the input interface; oif / oifname: the output interface\nct state established,related the connection tracking state\nip protocol icmp             the protocol (meta l4proto icmp works for inet too)' },
    { id: 'STATEMENTS', body: 'accept      let the packet through and stop evaluating this chain\ndrop        discard the packet silently\nreject      discard it and tell the sender (an ICMP error or a TCP reset)\ncounter     count packets and bytes\njump CHAIN  continue in another chain' },
    { id: 'NAT', body: "nft add table ip nat\nnft add chain ip nat postrouting '{ type nat hook postrouting priority 100; }'\nnft add rule ip nat postrouting ip saddr 192.168.10.0/24 oifname \"eth0\" masquerade\n\nmasquerade rewrites the source address to the address of the output interface; snat to ADDRESS writes a fixed one; dnat to ADDRESS:PORT in a prerouting chain rewrites the destination." },
    { id: 'SEE ALSO', body: 'iptables-nft(8), the nftables wiki: https://wiki.nftables.org/' },
  ]),
  upstream('man/dnsmasq.8', 'dnsmasq(8)', 'https://thekelleys.org.uk/dnsmasq/docs/dnsmasq-man.html', 'condensed from the dnsmasq manual (GPL-2.0)', 'dnsmasq 2.91', [
    { id: 'NAME', body: 'dnsmasq - A lightweight DHCP and caching DNS server.' },
    { id: 'SYNOPSIS', body: 'dnsmasq [OPTION]...' },
    { id: 'DESCRIPTION', body: 'dnsmasq is a lightweight DNS forwarder and DHCP server. It answers names from /etc/hosts and from its options, forwards other queries to the servers in /etc/resolv.conf, and hands out DHCP leases. Every long option can also be written in the configuration file /etc/dnsmasq.conf without the two dashes, one per line: dhcp-range=10.0.0.100,10.0.0.199,1h.' },
    { id: 'OPTIONS', body: '--dhcp-range=<start-addr>,<end-addr>[,<lease time>]\n       Enable the DHCP server. Addresses will be given out from the range <start-addr> to <end-addr>.\n\n--dhcp-host=<hwaddr>,<ipaddr>\n       Specify per host parameters: the host with this MAC address always gets this address.\n\n--dhcp-option=<option>,<value>\n       Specify different or extra options to DHCP clients. By default dnsmasq sends its own address as the default route (option:router) and the DNS server (option:dns-server).\n\n--address=/<domain>/<ipaddr>\n       Specify an IP address to return for any host in the given domains.\n\n--host-record=<name>,<address>\n       Add A records to the DNS.\n\n--interface=<interface name>\n       Listen only on the specified interface(s).\n\n--domain=<domain>\n       Specifies the DNS domain for the DHCP server.' },
    { id: 'FILES', body: '/etc/dnsmasq.conf\n/var/lib/misc/dnsmasq.leases (the current leases)\n/etc/hosts' },
    { id: 'SEE ALSO', body: 'hosts(5), resolv.conf(5)' },
  ]),
);
