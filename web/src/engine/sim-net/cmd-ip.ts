// ip (iproute2), arp (net-tools), ss and sysctl: how a Linux host sees its own
// network — interfaces, addresses, routes, neighbours, sockets, forwarding.

import { bi } from '../../core/i18n';
import type { CmdContext, ShellCommand } from '../../core/types';
import { broadcastOf, fmtIp, isCidr, isIp, parseCidr } from './ip';
import { addrOf, effectiveRoutes, ifaceOf, lookupRoute, srcFor, type Host, type Iface, type Route } from './world';
import { isRoot, net, notSimulated, pad, page } from './cmd-util';

const RTNL_PERM = 'RTNETLINK answers: Operation not permitted\n';

/** fe80::/64 address from the MAC (modified EUI-64), as the kernel assigns it. */
export function linkLocal6(mac: string): string {
  const b = mac.split(':').map((x) => parseInt(x, 16));
  b[0] ^= 0x02;
  const g = [(b[0] << 8) | b[1], (b[2] << 8) | 0xff, (0xfe << 8) | b[3], (b[4] << 8) | b[5]];
  return `fe80::${g.map((x) => x.toString(16)).join(':')}`;
}

function flags(i: Iface): string {
  if (i.name === 'lo') return i.up ? '<LOOPBACK,UP,LOWER_UP>' : '<LOOPBACK>';
  return i.up ? '<BROADCAST,MULTICAST,UP,LOWER_UP>' : '<BROADCAST,MULTICAST>';
}

function state(i: Iface): string {
  if (i.name === 'lo') return 'UNKNOWN';
  return i.up ? 'UP' : 'DOWN';
}

function linkLine(i: Iface, n: number, mode: boolean): string {
  const q = i.name === 'lo' ? 'noqueue' : 'fq_codel';
  const head = `${n}: ${i.name}: ${flags(i)} mtu ${i.mtu} qdisc ${q} state ${state(i)}${mode ? ' mode DEFAULT' : ''} group default qlen 1000`;
  const l2 = i.name === 'lo' ? `    link/loopback ${i.mac} brd 00:00:00:00:00:00` : `    link/ether ${i.mac} brd ff:ff:ff:ff:ff:ff`;
  return `${head}\n${l2}`;
}

function addrBlock(i: Iface, n: number, leaseSeconds?: number): string {
  const out = [linkLine(i, n, false)];
  for (const a of i.addrs) {
    const c = parseCidr(a);
    if (i.name === 'lo') out.push(`    inet ${a} scope host lo`);
    else out.push(`    inet ${a} brd ${fmtIp(broadcastOf(c))} scope global ${a.startsWith('169.254.') ? '' : ''}${i.name}`);
    const lifetime = leaseSeconds === undefined ? 'forever' : `${leaseSeconds}sec`;
    out.push(`       valid_lft ${lifetime} preferred_lft ${lifetime}`);
  }
  if (i.name === 'lo') out.push('    inet6 ::1/128 scope host noprefixroute', '       valid_lft forever preferred_lft forever');
  else if (i.up) out.push(`    inet6 ${linkLocal6(i.mac)}/64 scope link proto kernel_ll`, '       valid_lft forever preferred_lft forever');
  return out.join('\n');
}

function routeLine(r: Route): string {
  const parts = [r.dst];
  if (r.via) parts.push('via', r.via);
  parts.push('dev', r.dev);
  if (r.proto && r.proto !== 'boot') parts.push('proto', r.proto);
  if (r.scope) parts.push('scope', r.scope);
  if (r.src && r.proto === 'kernel') parts.push('src', r.src);
  if (r.metric !== undefined) parts.push('metric', String(r.metric));
  return parts.join(' ');
}

function sortRoutes(rs: Route[]): Route[] {
  const key = (r: Route) => (r.dst === 'default' ? -1 : parseCidr(r.dst).addr);
  return [...rs].sort((a, b) => key(a) - key(b) || (a.dst === 'default' ? 0 : parseCidr(b.dst).prefix - parseCidr(a.dst).prefix));
}

function findDev(h: Host, name: string | undefined): Iface | undefined {
  return name ? ifaceOf(h, name) : undefined;
}

function ipAddr(ctx: CmdContext, h: Host, args: string[], brief: boolean): number {
  const sub = args[0] ?? 'show';
  if (sub === 'show' || sub === 'list' || sub === 'ls' || (!['add', 'del', 'delete', 'flush', 'help'].includes(sub) && sub === 'dev')) {
    const devIdx = args.indexOf('dev');
    const dev = devIdx >= 0 ? args[devIdx + 1] : args[1] && args[1] !== 'dev' ? args[1] : undefined;
    const list = h.ifaces.map((i, n) => ({ i, n: n + 1 })).filter(({ i }) => !dev || i.name === dev);
    if (dev && !list.length) {
      ctx.err(`Device "${dev}" does not exist.\n`);
      return 1;
    }
    if (brief) {
      for (const { i } of list) {
        const addrs = [...i.addrs, i.name === 'lo' ? '::1/128' : i.up ? `${linkLocal6(i.mac)}/64` : ''].filter(Boolean);
        ctx.out(`${pad(i.name, 16)} ${pad(state(i), 14)} ${addrs.join(' ')}\n`);
      }
      return 0;
    }
    ctx.out(list.map(({ i, n }) => addrBlock(i, n, h.dhcpLease?.iface === i.name ? Math.max(0, h.dhcpLease.lease - Math.floor((net(ctx).world.clock - (h.dhcpLease.acquiredAt ?? net(ctx).world.clock)) / 1000)) : undefined)).join('\n') + '\n');
    return 0;
  }
  if (sub === 'help') {
    ctx.out('Usage: ip address {add|change|replace} IFADDR dev IFNAME\n       ip address del IFADDR dev IFNAME\n       ip address flush dev IFNAME\n       ip address [ show [ dev IFNAME ] ]\n');
    return 0;
  }
  if (!isRoot(ctx)) {
    ctx.err(RTNL_PERM);
    return 2;
  }
  const devIdx = args.indexOf('dev');
  const dev = findDev(h, devIdx >= 0 ? args[devIdx + 1] : undefined);
  if (sub === 'flush') {
    if (!dev) {
      ctx.err('Not enough information: "dev" argument is required.\n');
      return 1;
    }
    dev.addrs = [];
    return 0;
  }
  const cidr = args[1];
  if (!cidr || (!isCidr(cidr) && !isIp(cidr))) {
    ctx.err(`Error: any valid prefix is expected rather than "${cidr ?? ''}".\n`);
    return 1;
  }
  if (devIdx < 0) {
    ctx.err('Not enough information: "dev" argument is required.\n');
    return 1;
  }
  if (!dev) {
    ctx.err(`Cannot find device "${args[devIdx + 1]}"\n`);
    return 1;
  }
  const full = cidr.includes('/') ? cidr : `${cidr}/32`;
  if (sub === 'add') {
    if (dev.addrs.some((a) => addrOf(a) === addrOf(full))) {
      ctx.err('Error: ipv4: Address already assigned.\n');
      return 2;
    }
    dev.addrs.push(full);
    return 0;
  }
  if (sub === 'del' || sub === 'delete') {
    const before = dev.addrs.length;
    dev.addrs = dev.addrs.filter((a) => a !== full && !(addrOf(a) === addrOf(full) && !cidr.includes('/')));
    if (dev.addrs.length === before) {
      ctx.err('Error: ipv4: Address not found.\n');
      return 2;
    }
    return 0;
  }
  ctx.err(`Command "${sub}" is unknown, try "ip address help".\n`);
  return 1;
}

function ipLink(ctx: CmdContext, h: Host, args: string[], brief: boolean): number {
  const sub = args[0] ?? 'show';
  if (sub === 'show' || sub === 'list' || sub === 'ls') {
    const dev = args[1] === 'dev' ? args[2] : args[1];
    const list = h.ifaces.map((i, n) => ({ i, n: n + 1 })).filter(({ i }) => !dev || i.name === dev);
    if (dev && !list.length) {
      ctx.err(`Device "${dev}" does not exist.\n`);
      return 1;
    }
    if (brief) for (const { i } of list) ctx.out(`${pad(i.name, 16)} ${pad(state(i), 14)} ${pad(i.mac, 17)} ${flags(i)}\n`);
    else ctx.out(list.map(({ i, n }) => linkLine(i, n, true)).join('\n') + '\n');
    return 0;
  }
  if (sub === 'set') {
    if (!isRoot(ctx)) {
      ctx.err(RTNL_PERM);
      return 2;
    }
    const rest = args.slice(1);
    const name = rest[0] === 'dev' ? rest[1] : rest[0];
    const dev = findDev(h, name);
    if (!dev) {
      ctx.err(`Cannot find device "${name ?? ''}"\n`);
      return 1;
    }
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === 'up') dev.up = true;
      else if (rest[i] === 'down') dev.up = false;
      else if (rest[i] === 'mtu') dev.mtu = Number(rest[++i]) || dev.mtu;
      else if (['master', 'netns', 'address', 'name'].includes(rest[i])) return notSimulated(ctx, `ip link set ${rest[i]}`);
    }
    return 0;
  }
  if (sub === 'add' || sub === 'del' || sub === 'delete') return notSimulated(ctx, `ip link ${sub}`);
  ctx.err(`Command "${sub}" is unknown, try "ip link help".\n`);
  return 1;
}

function parseRouteSpec(args: string[]): { dst: string; via?: string; dev?: string; metric?: number } {
  const dst = args[0] === 'default' || args[0] === '0.0.0.0/0' ? 'default' : args[0];
  const o: { dst: string; via?: string; dev?: string; metric?: number } = { dst };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === 'via') o.via = args[++i];
    else if (args[i] === 'dev') o.dev = args[++i];
    else if (args[i] === 'metric') o.metric = Number(args[++i]);
  }
  return o;
}

function ipRoute(ctx: CmdContext, h: Host, args: string[]): number {
  const sub = args[0] ?? 'show';
  if (sub === 'show' || sub === 'list' || sub === 'ls') {
    for (const r of sortRoutes(effectiveRoutes(h))) ctx.out(routeLine(r) + '\n');
    return 0;
  }
  if (sub === 'get') {
    const a = args[1];
    if (!a || !isIp(a)) {
      ctx.err(`Error: inet prefix is expected rather than "${a ?? ''}".\n`);
      return 1;
    }
    if (h.ifaces.some((i) => i.addrs.some((x) => addrOf(x) === a)) || a.startsWith('127.')) {
      ctx.out(`local ${a} dev lo src ${a.startsWith('127.') ? '127.0.0.1' : a} uid ${ctx.cred.uid} \n    cache <local> \n`);
      return 0;
    }
    const r = lookupRoute(h, a);
    if (!r) {
      ctx.err('RTNETLINK answers: Network is unreachable\n');
      return 2;
    }
    ctx.out(`${a} ${r.via ? `via ${r.via} ` : ''}dev ${r.dev} src ${srcFor(h, r) ?? ''} uid ${ctx.cred.uid} \n    cache \n`);
    return 0;
  }
  if (sub === 'help') {
    ctx.out('Usage: ip route { list | flush } SELECTOR\n       ip route get ADDRESS\n       ip route { add | del | change | append | replace } ROUTE\nROUTE := NODE_SPEC [ INFO_SPEC ]\nNODE_SPEC := [ TYPE ] PREFIX\nINFO_SPEC := { NH } [ metric METRIC ]\nNH := [ via ADDRESS ] [ dev STRING ]\n');
    return 0;
  }
  if (!isRoot(ctx)) {
    ctx.err(RTNL_PERM);
    return 2;
  }
  if (sub === 'flush') {
    h.routes = [];
    return 0;
  }
  const spec = parseRouteSpec(args.slice(1));
  if (!spec.dst || (spec.dst !== 'default' && !isCidr(spec.dst) && !isIp(spec.dst))) {
    ctx.err(`Error: inet prefix is expected rather than "${spec.dst ?? ''}".\n`);
    return 1;
  }
  const dst = spec.dst === 'default' ? 'default' : spec.dst.includes('/') ? spec.dst : `${spec.dst}/32`;
  if (dst !== 'default') {
    const c = parseCidr(dst);
    const masked = fmtIp((c.addr & (c.prefix ? (0xffffffff << (32 - c.prefix)) >>> 0 : 0)) >>> 0);
    if (masked !== addrOf(dst)) {
      ctx.err('Error: Invalid prefix for given prefix length.\n');
      return 1;
    }
  }
  if (sub === 'add' || sub === 'replace') {
    let dev = spec.dev;
    if (spec.via) {
      if (!isIp(spec.via)) {
        ctx.err(`Error: inet address is expected rather than "${spec.via}".\n`);
        return 1;
      }
      const onLink = effectiveRoutes(h).find((r) => r.proto === 'kernel' && !r.via && (!dev || r.dev === dev) && inNet(spec.via!, r.dst));
      if (!onLink) {
        ctx.err('Error: Nexthop has invalid gateway.\n');
        return 2;
      }
      dev = dev ?? onLink.dev;
    }
    if (!dev) {
      ctx.err('Error: Device for nexthop is not up.\n');
      return 2;
    }
    if (!ifaceOf(h, dev)) {
      ctx.err(`Cannot find device "${dev}"\n`);
      return 1;
    }
    const exists = h.routes.findIndex((r) => r.dst === dst && (r.metric ?? 0) === (spec.metric ?? 0));
    if (exists >= 0 && sub === 'add') {
      ctx.err('RTNETLINK answers: File exists\n');
      return 2;
    }
    const route: Route = { dst, via: spec.via, dev, proto: 'static', metric: spec.metric };
    if (exists >= 0) h.routes[exists] = route;
    else h.routes.push(route);
    return 0;
  }
  if (sub === 'del' || sub === 'delete') {
    const i = h.routes.findIndex((r) => r.dst === dst && (!spec.via || r.via === spec.via));
    if (i < 0) {
      ctx.err('RTNETLINK answers: No such process\n');
      return 2;
    }
    h.routes.splice(i, 1);
    return 0;
  }
  ctx.err(`Command "${sub}" is unknown, try "ip route help".\n`);
  return 1;
}

function inNet(ip: string, cidr: string): boolean {
  const c = parseCidr(cidr);
  const a = parseCidr(ip);
  const m = c.prefix ? (0xffffffff << (32 - c.prefix)) >>> 0 : 0;
  return ((a.addr & m) >>> 0) === ((c.addr & m) >>> 0);
}

function ipNeigh(ctx: CmdContext, h: Host, args: string[]): number {
  const sub = args[0] ?? 'show';
  if (sub === 'show' || sub === 'list' || sub === 'ls') {
    for (const n of h.neigh) ctx.out(n.state === 'FAILED' ? `${n.ip} dev ${n.dev} FAILED\n` : `${n.ip} dev ${n.dev} lladdr ${n.mac} ${n.state}\n`);
    return 0;
  }
  if (!isRoot(ctx)) {
    ctx.err(RTNL_PERM);
    return 2;
  }
  if (sub === 'flush') {
    const dev = args.indexOf('dev') >= 0 ? args[args.indexOf('dev') + 1] : undefined;
    if (!dev && args[1] !== 'all') {
      ctx.err('Flush requires arguments.\n');
      return 1;
    }
    h.neigh = h.neigh.filter((n) => n.state === 'PERMANENT' || (dev !== undefined && n.dev !== dev));
    return 0;
  }
  if (sub === 'add' || sub === 'replace') {
    const ip = args[1];
    const mac = args[args.indexOf('lladdr') + 1];
    const dev = args[args.indexOf('dev') + 1];
    if (!ip || args.indexOf('lladdr') < 0 || args.indexOf('dev') < 0) {
      ctx.err('Device and destination are required arguments.\n');
      return 1;
    }
    h.neigh = h.neigh.filter((n) => !(n.ip === ip && n.dev === dev));
    h.neigh.push({ ip, mac, dev, state: args.includes('permanent') ? 'PERMANENT' : 'REACHABLE' });
    return 0;
  }
  if (sub === 'del' || sub === 'delete') {
    h.neigh = h.neigh.filter((n) => n.ip !== args[1]);
    return 0;
  }
  ctx.err(`Command "${sub}" is unknown, try "ip neigh help".\n`);
  return 1;
}

const OBJECTS: Record<string, string> = { a: 'addr', addr: 'addr', address: 'addr', l: 'link', link: 'link', r: 'route', ro: 'route', route: 'route', n: 'neigh', neigh: 'neigh', neighbor: 'neigh', neighbour: 'neigh' };

export const ipCommand: ShellCommand = {
  name: 'ip',
  summary: bi('показать и настроить интерфейсы, адреса, маршруты и соседей', 'show and change interfaces, addresses, routes and neighbours'),
  help: `Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }
where  OBJECT := { address | link | route | neigh }
       OPTIONS := { -br[ief] | -4 | -s[tatistics] | -d[etails] }

Examples:
  ip a                         show addresses of all interfaces
  ip -br a                     one line per interface
  ip addr add 10.0.1.10/24 dev eth0
  ip link set dev eth0 up
  ip r                         show the routing table
  ip route add default via 10.0.1.1
  ip route get 10.0.2.10       which route a packet to this address takes
  ip neigh                     the ARP cache`,
  man: page('ip', 8, [
    { id: 'NAME', body: 'ip - show / manipulate routing, network devices, interfaces and tunnels' },
    { id: 'SYNOPSIS', body: 'ip [ OPTIONS ] OBJECT { COMMAND | help }\n\nOBJECT := { link | address | route | neigh | rule | netns | ... }\n\nOPTIONS := { -4 | -6 | -s[tatistics] | -d[etails] | -br[ief] | -j[son] | -c[olor] }' },
    { id: 'DESCRIPTION', body: 'ip shows and changes the network configuration of the Linux kernel: interfaces (link), their addresses (address), the routing table (route) and the neighbour (ARP) cache (neigh). Every change takes effect at once and is lost at reboot unless a network manager or a config file applies it again.' },
    {
      id: 'OPTIONS',
      body: '-br, -brief\n       Print only basic information in a tabular format: name, state, addresses.\n-4     Shortcut for -family inet: only IPv4.\n-6     Shortcut for -family inet6: only IPv6.\n-s, -stats, -statistics\n       Output more information: counters of packets and errors.\n-d, -details\n       Output more detailed information (the type of a virtual device).\n-j, -json\n       Output results in JSON.',
    },
    {
      id: 'OBJECTS',
      title: 'OBJECTS',
      body: 'address  - protocol (IPv4 or IPv6) address on a device. See ip-address(8).\nlink     - network device. See ip-link(8).\nneigh    - manage ARP or NDISC cache entries. See ip-neighbour(8).\nroute    - routing table entry. See ip-route(8).\nrule     - rule in routing policy database. See ip-rule(8).\n\nThe names of all objects may be written in full or abbreviated form: address can be abbreviated as addr or just a.',
    },
    {
      id: 'EXAMPLES',
      body: 'ip addr\n    Shows addresses assigned to all network interfaces.\nip neigh\n    Shows the current neighbour table in kernel.\nip link set x up\n    Bring up interface x.\nip link set x down\n    Bring down interface x.\nip route\n    Show table routes.\nip route get 10.0.2.10\n    Show the route the kernel would use for this destination.',
    },
    { id: 'EXIT STATUS', body: 'Exit status is 0 if command was successful, and 1 if there is a syntax error. If an error was reported by the kernel exit status is 2.' },
    { id: 'SEE ALSO', body: 'ip-address(8), ip-link(8), ip-neighbour(8), ip-route(8), ss(8)' },
  ]),
  run(ctx) {
    const st = net(ctx);
    const h = st.local;
    let args = ctx.argv.slice(1);
    let brief = false;
    while (args[0]?.startsWith('-')) {
      const f = args[0];
      if (f === '-br' || f === '-brief') brief = true;
      else if (f === '-6') return notSimulated(ctx, 'ip -6');
      else if (f === '-j' || f === '-json') return notSimulated(ctx, 'ip -json');
      else if (!['-4', '-s', '-d', '-stats', '-details', '-c', '-color'].includes(f)) {
        ctx.err(`Option "${f}" is unknown, try "ip -help".\n`);
        return 255;
      }
      args = args.slice(1);
    }
    const obj = args[0] ? OBJECTS[args[0]] : undefined;
    if (!args[0] || args[0] === 'help') {
      ctx.out(ipCommand.help + '\n');
      return args[0] ? 0 : 255;
    }
    if (!obj) {
      if (['rule', 'netns', 'tunnel', 'xfrm', 'maddr', 'monitor'].includes(args[0])) return notSimulated(ctx, `ip ${args[0]}`);
      ctx.err(`Object "${args[0]}" is unknown, try "ip help".\n`);
      return 1;
    }
    const rest = args.slice(1);
    const code = obj === 'addr' ? ipAddr(ctx, h, rest, brief) : obj === 'link' ? ipLink(ctx, h, rest, brief) : obj === 'route' ? ipRoute(ctx, h, rest) : ipNeigh(ctx, h, rest);
    return code;
  },
  complete: () => ['address', 'link', 'route', 'neigh', 'show', 'add', 'del', 'get', 'dev', 'via', 'default', 'flush'],
};

export const arpCommand: ShellCommand = {
  name: 'arp',
  summary: bi('показать ARP-кэш (старая утилита net-tools)', 'show the ARP cache (the old net-tools utility)'),
  help: `Usage:
  arp [-vn]  [<HW>] [-i <if>] [-a] [<hostname>]             <-Display ARP cache
  arp [-v]          [-i <if>] -d  <host> [pub]               <-Delete ARP entry

        -a                       display (all) hosts in alternative (BSD) style
        -e                       display (all) hosts in default (Linux) style
        -n, --numeric            don't resolve names
        -i, --device             specify network interface (e.g. eth0)`,
  man: page('arp', 8, [
    { id: 'NAME', body: 'arp - manipulate the system ARP cache' },
    { id: 'SYNOPSIS', body: 'arp [-vn] [-H type] [-i if] [-ae] [hostname]\narp [-v] [-i if] -d hostname [pub]' },
    { id: 'DESCRIPTION', body: 'Arp manipulates or displays the kernel\'s IPv4 network neighbour cache. It can add entries to the table, delete one or display the current content.\n\nARP stands for Address Resolution Protocol, which is used to find the media access control address of a network neighbour for a given IPv4 Address.\n\nThis program is obsolete. For replacement check ip neigh.' },
    { id: 'OPTIONS', body: '-n, --numeric\n       shows numerical addresses instead of trying to determine symbolic host, port or user names.\n-a     Use alternate BSD style output format (with no fixed columns).\n-e     Use default Linux style output format (with fixed columns).\n-i If, --device If\n       Select an interface.\n-d hostname, --delete hostname\n       Remove any entry for the specified host.' },
    { id: 'SEE ALSO', body: 'ip-neighbour(8), rarp(8), route(8), ifconfig(8), netstat(8)' },
  ]),
  run(ctx) {
    const h = net(ctx).local;
    const args = ctx.argv.slice(1);
    if (args.includes('-d') || args.includes('-s')) {
      if (!isRoot(ctx)) {
        ctx.err('SIOCDARP(dontpub): Operation not permitted\n');
        return 1;
      }
      const ip = args[args.indexOf('-d') + 1];
      h.neigh = h.neigh.filter((n) => n.ip !== ip);
      return 0;
    }
    const live = h.neigh.filter((n) => n.state !== 'FAILED');
    if (args.includes('-a')) {
      for (const n of h.neigh) ctx.out(n.state === 'FAILED' ? `? (${n.ip}) at <incomplete> on ${n.dev}\n` : `? (${n.ip}) at ${n.mac} [ether] ${n.state === 'PERMANENT' ? 'PERM ' : ''}on ${n.dev}\n`);
      return 0;
    }
    ctx.out('Address                  HWtype  HWaddress           Flags Mask            Iface\n');
    for (const n of h.neigh) {
      if (n.state === 'FAILED') ctx.out(`${pad(n.ip, 25)}        (incomplete)                              ${n.dev}\n`);
      else ctx.out(`${pad(n.ip, 25)}ether   ${n.mac}   ${n.state === 'PERMANENT' ? 'CM' : 'C '}                    ${n.dev}\n`);
    }
    void live;
    return 0;
  },
};

function sockAddr(addr: string, port: number): string {
  return `${addr === '0.0.0.0' ? '0.0.0.0' : addr}:${port}`;
}

export const ssCommand: ShellCommand = {
  name: 'ss',
  summary: bi('показать сокеты: кто слушает какой порт', 'show sockets: who listens on which port'),
  help: `Usage: ss [ OPTIONS ]
       ss [ OPTIONS ] [ FILTER ]
   -h, --help          this message
   -n, --numeric       don't resolve service names
   -a, --all           display all sockets
   -l, --listening     display listening sockets
   -p, --processes     show process using socket
   -t, --tcp           display only TCP sockets
   -u, --udp           display only UDP sockets
   -4, --ipv4          display only IP version 4 sockets
   -H, --no-header     Suppress header line`,
  man: page('ss', 8, [
    { id: 'NAME', body: 'ss - another utility to investigate sockets' },
    { id: 'SYNOPSIS', body: 'ss [options] [ FILTER ]' },
    { id: 'DESCRIPTION', body: 'ss is used to dump socket statistics. It allows showing information similar to netstat. It can display more TCP and state information than other tools.' },
    {
      id: 'OPTIONS',
      body: '-n, --numeric\n       Do not try to resolve service names. Show exact bandwidth values, instead of human-readable.\n-a, --all\n       Display both listening and non-listening (for TCP this means established connections) sockets.\n-l, --listening\n       Display only listening sockets (these are omitted by default).\n-p, --processes\n       Show process using socket.\n-t, --tcp\n       Display TCP sockets.\n-u, --udp\n       Display UDP sockets.\n-4, --ipv4\n       Display only IP version 4 sockets.\n-H, --no-header\n       Suppress header line.',
    },
    { id: 'EXAMPLES', body: 'ss -t -a\n    Display all TCP sockets.\nss -ltnp\n    Display listening TCP sockets with numeric ports and the process that owns each.\nss -u -a\n    Display all UDP sockets.' },
    { id: 'SEE ALSO', body: 'ip(8), /usr/share/doc/iproute-doc/ss.html (package iproute-doc), RFC 793 - https://tools.ietf.org/rfc/rfc793.txt (TCP states)' },
  ]),
  run(ctx) {
    const h = net(ctx).local;
    const flagsSet = new Set<string>();
    for (const a of ctx.argv.slice(1)) {
      if (a.startsWith('--')) {
        const map: Record<string, string> = { '--numeric': 'n', '--all': 'a', '--listening': 'l', '--processes': 'p', '--tcp': 't', '--udp': 'u', '--ipv4': '4', '--no-header': 'H' };
        if (!map[a]) return notSimulated(ctx, `ss ${a}`);
        flagsSet.add(map[a]);
      } else if (a.startsWith('-')) {
        for (const c of a.slice(1)) {
          if (!'naltpu4H'.includes(c)) return notSimulated(ctx, `ss -${c}`);
          flagsSet.add(c);
        }
      } else return notSimulated(ctx, 'ss filters');
    }
    const showListen = flagsSet.has('l') || flagsSet.has('a');
    let protos = ['tcp', 'udp'].filter((p) => flagsSet.has(p[0]));
    if (!protos.length) protos = ['tcp', 'udp'];
    const both = protos.length === 2;
    const rows: string[][] = [];
    if (showListen) {
      for (const s of h.services) {
        if (s.down || !protos.includes(s.proto)) continue;
        const proc = flagsSet.has('p') && isRoot(ctx) ? `users:(("${s.proc}",pid=${s.pid},fd=${s.proto === 'tcp' ? 6 : 5}))` : '';
        rows.push([...(both ? [s.proto] : []), s.proto === 'tcp' ? 'LISTEN' : 'UNCONN', '0', s.proto === 'tcp' ? '511' : '0', sockAddr(s.bind, s.port), '0.0.0.0:*', proc]);
      }
    }
    const header = [...(both ? ['Netid'] : []), 'State', 'Recv-Q', 'Send-Q', 'Local Address:Port', 'Peer Address:Port', 'Process'];
    const widths = header.map((hd, i) => Math.max(hd.length, ...rows.map((r) => r[i]?.length ?? 0)));
    const line = (r: string[]) => r.map((c, i) => (i === r.length - 1 ? c : pad(c, widths[i]))).join(' ').trimEnd();
    if (!flagsSet.has('H')) ctx.out(line(header) + '\n');
    for (const r of rows) ctx.out(line(r) + '\n');
    return 0;
  },
};

const SYSCTL_KEYS = ['net.ipv4.ip_forward', 'net.ipv4.tcp_syn_retries', 'net.ipv4.ip_local_port_range', 'net.ipv4.ip_default_ttl'];

export const sysctlCommand: ShellCommand = {
  name: 'sysctl',
  summary: bi('прочитать или изменить параметры ядра (/proc/sys)', 'read or change kernel parameters (/proc/sys)'),
  help: `Usage:
 sysctl [options] [variable[=value] ...]

Options:
  -a, --all            display all variables
  -n, --values         print only values of the given variable(s)
  -w, --write          enable writing a value to variable
  -p[FILE], --load[=FILE]  read values from file`,
  man: page('sysctl', 8, [
    { id: 'NAME', body: 'sysctl - configure kernel parameters at runtime' },
    { id: 'SYNOPSIS', body: 'sysctl [options] [variable[=value]] [...]\nsysctl -p [file or regexp] [...]' },
    { id: 'DESCRIPTION', body: 'sysctl is used to modify kernel parameters at runtime. The parameters available are those listed under /proc/sys/. Procfs is required for sysctl support in Linux. You can use sysctl to both read and write sysctl data.' },
    { id: 'PARAMETERS', body: 'variable\n       The name of a key to read from. An example is kernel.ostype. The \'/\' separator is also accepted in place of a \'.\'.\nvariable=value\n       To set a key, use the form variable=value where variable is the key and value is the value to set it to.\n-n, --values\n       Use this option to disable printing of the key name when printing values.\n-w, --write\n       Use this option when all arguments prescribe a key to be set.\n-a, --all\n       Display all values currently available.' },
    { id: 'EXAMPLES', body: '/sbin/sysctl -a\n/sbin/sysctl -n kernel.hostname\n/sbin/sysctl -w kernel.domainname="example.com"\n/sbin/sysctl net.ipv4.ip_forward=1' },
    { id: 'SEE ALSO', body: 'sysctl.conf(5), proc(5); the kernel documentation of the keys: https://docs.kernel.org/networking/ip-sysctl.html' },
  ]),
  run(ctx) {
    const st = net(ctx);
    const h = st.local;
    const args = ctx.argv.slice(1);
    const valuesOnly = args.includes('-n') || args.includes('--values');
    const get = (k: string): string | undefined =>
      k === 'net.ipv4.ip_forward' ? (h.ipForward ? '1' : '0') : k === 'net.ipv4.tcp_syn_retries' ? '6' : k === 'net.ipv4.ip_local_port_range' ? '32768\t60999' : k === 'net.ipv4.ip_default_ttl' ? '64' : undefined;
    if (args.includes('-a') || args.includes('--all')) {
      for (const k of SYSCTL_KEYS) ctx.out(`${k} = ${get(k)}\n`);
      return 0;
    }
    if (args.some((a) => a.startsWith('-p'))) return notSimulated(ctx, 'sysctl -p');
    let code = 0;
    for (const a of args.filter((x) => !x.startsWith('-'))) {
      const [k0, v] = a.split('=');
      const k = k0.replace(/\//g, '.');
      if (v === undefined) {
        const val = get(k);
        if (val === undefined) {
          ctx.err(`sysctl: cannot stat /proc/sys/${k.replace(/\./g, '/')}: No such file or directory\n`);
          code = 255;
          continue;
        }
        ctx.out(valuesOnly ? `${val}\n` : `${k} = ${val}\n`);
        continue;
      }
      if (!isRoot(ctx)) {
        ctx.err(`sysctl: permission denied on key "${k}"\n`);
        code = 255;
        continue;
      }
      if (k !== 'net.ipv4.ip_forward') {
        if (get(k) === undefined) {
          ctx.err(`sysctl: cannot stat /proc/sys/${k.replace(/\./g, '/')}: No such file or directory\n`);
          code = 255;
          continue;
        }
        return notSimulated(ctx, `sysctl -w ${k}`);
      }
      if (!['0', '1'].includes(v.trim())) { ctx.err('sysctl: invalid argument\n'); return 1; }
      ctx.machine.rootFs.mkdir('/proc/sys/net/ipv4', { parents: true });
      ctx.machine.rootFs.writeFile('/proc/sys/net/ipv4/ip_forward', v.trim() + '\n');
      h.ipForward = v.trim() === '1';
      ctx.out(`${k} = ${h.ipForward ? 1 : 0}\n`);
    }
    return code;
  },
};

export { routeLine, sortRoutes };
