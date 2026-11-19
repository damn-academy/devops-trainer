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
    { id: 'EXAMPLES', body: 'ip link show\n    Shows the state of all network interfaces on the system.\nip link set dev ppp0 mtu 1400\n    Change the MTU the ppp0 device.\nip link add link eth0 name eth0.10 type vlan id 10\n    Creates a new vlan device eth0.10 on device eth0.' },
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
