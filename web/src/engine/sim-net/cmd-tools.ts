// tcpdump, iptables, iptables-save, dhcpcd and nginx.

import { bi } from '../../core/i18n';
import type { ShellCommand } from '../../core/types';
import { parseCidr, inSubnet, fmtIp, parseIp } from './ip';
import { errLogDate, NGINX_VERSION, parseNginx } from './http';
import { addrOf, ifaceOf, readHostFile, record, type CapturedPacket, type Host, type NfChain, type NfRule, type NfTable, type World } from './world';
import { isRoot, net, notSimulated, pad, page, PORT_NAMES } from './cmd-util';

// ── tcpdump ────────────────────────────────────────────────────────────────

type Filter = (p: CapturedPacket) => boolean;

/** A pcap-filter subset: host, src, dst, net, port, tcp, udp, icmp, arp, ip, and/or/not, parentheses. */
export function compileFilter(expr: string[]): Filter {
  const toks = expr.join(' ').replace(/([()])/g, ' $1 ').split(/\s+/).filter(Boolean);
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  const fail = (m: string): never => {
    throw new Error(m);
  };
  const portOf = (p: CapturedPacket, dir?: 'src' | 'dst') => (dir === 'src' ? [p.sport] : dir === 'dst' ? [p.dport] : [p.sport, p.dport]);
  const addrOfP = (p: CapturedPacket, dir?: 'src' | 'dst') => (dir === 'src' ? [p.src] : dir === 'dst' ? [p.dst] : [p.src, p.dst]);
  const portNum = (s: string) => {
    const n = Number(s);
    if (Number.isInteger(n)) return n;
    const e = Object.entries(PORT_NAMES).find(([, v]) => v === s);
    if (!e) fail(`syntax error in filter expression: unknown port ${s}`);
    return Number(e![0]);
  };
  const primary = (): Filter => {
    const t = next();
    if (t === undefined) fail('syntax error in filter expression');
    if (t === '(') {
      const f = or();
      if (next() !== ')') fail('syntax error in filter expression: missing )');
      return f;
    }
    if (t === 'not' || t === '!') {
      const f = primary();
      return (p) => !f(p);
    }
    if (t === 'tcp' || t === 'udp' || t === 'icmp') {
      if (peek() === 'port') {
        next();
        const n = portNum(next());
        return (p) => p.proto === t && portOf(p).includes(n);
      }
      return (p) => p.proto === t;
    }
    if (t === 'arp') return (p) => p.l3 === 'arp';
    if (t === 'ip') return (p) => p.l3 === 'ip';
    let dir: 'src' | 'dst' | undefined;
    let kw = t;
    if (t === 'src' || t === 'dst') {
      dir = t;
      kw = peek() === 'host' || peek() === 'port' || peek() === 'net' ? next() : 'host';
    }
    if (kw === 'host') {
      const a = next();
      return (p) => addrOfP(p, dir).includes(a);
    }
    if (kw === 'net') {
      const n = next();
      return (p) => addrOfP(p, dir).some((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x) && inSubnet(x, n));
    }
    if (kw === 'port') {
      const n = portNum(next());
      return (p) => p.l3 === 'ip' && p.proto !== 'icmp' && portOf(p, dir).includes(n);
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(kw)) return (p) => addrOfP(p, dir).includes(kw);
    return fail(`syntax error in filter expression: unknown "${kw}"`);
  };
  const and = (): Filter => {
    let f = primary();
    while (peek() === 'and' || peek() === '&&') {
      next();
      const g = primary();
      const prev = f;
      f = (p) => prev(p) && g(p);
    }
    return f;
  };
  const or = (): Filter => {
    let f = and();
    while (peek() === 'or' || peek() === '||') {
      next();
      const g = and();
      const prev = f;
      f = (p) => prev(p) || g(p);
    }
    return f;
  };
  if (!toks.length) return () => true;
  const f = or();
  if (i < toks.length) fail(`syntax error in filter expression near "${toks[i]}"`);
  return f;
}

function tsOf(ms: number): string {
  const d = new Date(Math.floor(ms));
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  const us = Math.round((ms - Math.floor(ms / 1000) * 1000) * 1000);
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(us, 6)}`;
}

function endpoint(addr: string, port: number | undefined, numeric: boolean): string {
  if (port === undefined) return addr;
  return `${addr}.${!numeric && PORT_NAMES[port] ? PORT_NAMES[port] : port}`;
}

export function tcpdumpLine(p: CapturedPacket, o: { numeric: boolean; link: boolean }): string {
  const head = tsOf(p.t);
  const eth = o.link ? ` ${p.srcMac} > ${p.dstMac}, ethertype ${p.l3 === 'arp' ? 'ARP (0x0806)' : 'IPv4 (0x0800)'}, length ${p.len + 14}:` : '';
  if (p.l3 === 'arp') return `${head}${o.link ? eth : ''} ARP, ${p.info}`;
  const proto = p.proto === 'icmp' ? '' : '';
  const src = p.proto === 'icmp' ? p.src : endpoint(p.src, p.sport, o.numeric);
  const dst = p.proto === 'icmp' ? p.dst : endpoint(p.dst, p.dport, o.numeric);
  return `${head}${eth} IP ${src} > ${dst}: ${proto}${p.proto === 'udp' && !/^\d+[+*-]? |^\d+ |BOOTP|UDP/.test(p.info) ? `UDP, length ${p.len - 28}` : p.info}`;
}

export const tcpdumpCommand: ShellCommand = {
  name: 'tcpdump',
  summary: bi('показать пакеты, прошедшие через интерфейс', 'show the packets that crossed an interface'),
  help: `tcpdump version 4.99.5
libpcap version 1.10.5 (with TPACKET_V3)
Usage: tcpdump [-AbdDefhHIJKlLnNOpqStuUvxX#] [ -B size ] [ -c count ] [--count]
                [ -C file_size ] [ -E algo:secret ] [ -F file ] [ -G seconds ]
                [ -i interface ] [ --immediate-mode ] [ -j tstamptype ]
                [ -M secret ] [ --number ] [ --print ] [ -Q in|out|inout ]
                [ -r file ] [ -s snaplen ] [ -T type ] [ --version ]
                [ -V file ] [ -w file ] [ -W filecount ] [ -y datalinktype ]
                [ --time-stamp-precision precision ] [ --micro ] [ --nano ]
                [ -z postrotate-command ] [ -Z user ] [ expression ]`,
  man: page('tcpdump', 8, [
    { id: 'NAME', body: 'tcpdump - dump traffic on a network' },
    { id: 'SYNOPSIS', body: 'tcpdump [ -AbdDefhHIJKlLnNOpqStuUvxX# ] [ -c count ] [ -i interface ] [ -r file ] [ -s snaplen ] [ -w file ] [ expression ]' },
    {
      id: 'DESCRIPTION',
      body: 'tcpdump prints out a description of the contents of packets on a network interface that match the Boolean expression; the description is preceded by a time stamp, printed, by default, as hours, minutes, seconds, and fractions of a second since midnight.\n\nIn the trainer, tcpdump prints the packets that crossed the interface since the previous tcpdump (or since the lab started) and exits. Run the command you want to watch first, then tcpdump.',
    },
    {
      id: 'OPTIONS',
      body: '-c count\n       Exit after receiving count packets.\n-e     Print the link-level header on each dump line. This can be used, for example, to print MAC layer addresses for protocols such as Ethernet and IEEE 802.11.\n-i interface\n       Listen, report the list of link-layer types, report the list of time stamp types, or report the results of compiling a filter expression on interface. If unspecified, tcpdump searches the system interface list for the lowest numbered, configured up interface (excluding loopback). On Linux systems, an interface argument of "any" can be used to capture packets from all interfaces.\n-n     Don\'t convert addresses (i.e., host addresses, port numbers, etc.) to names.\n-q     Quick output. Print less protocol information so output lines are shorter.\n-v     When parsing and printing, produce (slightly more) verbose output.\n-w file\n       Write the raw packets to file rather than parsing and printing them out.',
    },
    {
      id: 'EXPRESSION',
      title: 'EXPRESSION',
      body: 'selects which packets will be dumped. If no expression is given, all packets on the net will be dumped. The filter expression consists of one or more primitives (see pcap-filter(7)):\n\nhost 192.168.1.1     packets from or to this address\nsrc host A / dst host A\nnet 10.0.0.0/8       packets from or to this network\nport 53              TCP or UDP port 53\ntcp, udp, icmp, arp  only this protocol\n\nPrimitives may be combined using: a parenthesized group, negation (! or not), concatenation (&& or and), alternation (|| or or).',
    },
    { id: 'EXAMPLES', body: 'tcpdump -n -i eth0 port 53\n    DNS traffic on eth0, numbers instead of names.\ntcpdump -n -e arp\n    ARP requests and replies with MAC addresses.\ntcpdump -n host 10.0.2.21 and tcp port 8080\n    One upstream of the proxy.' },
    { id: 'SEE ALSO', body: 'pcap-filter(7), pcap(3PCAP)' },
  ], 'https://www.tcpdump.org/manpages/tcpdump.1.html', 'condensed from the tcpdump manual (BSD licence)'),
  run(ctx) {
    const st = net(ctx);
    const w = st.world;
    const h = w.hosts[w.local];
    const args = ctx.argv.slice(1);
    let iface: string | undefined;
    let count: number | undefined;
    let numeric = false;
    let link = false;
    const expr: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-i') iface = args[++i];
      else if (a === '-c') count = Number(args[++i]);
      else if (/^-[nveqlSt]+$/.test(a)) {
        if (a.includes('n')) numeric = true;
        if (a.includes('e')) link = true;
      } else if (a === '-w' || a === '-r' || a === '-X' || a === '-A' || a === '-x') return notSimulated(ctx, `tcpdump ${a}`);
      else if (a.startsWith('-')) {
        ctx.err(`tcpdump: invalid option -- '${a.replace(/^-+/, '')[0]}'\n`);
        return 1;
      } else expr.push(a);
    }
    if (!isRoot(ctx)) {
      ctx.err(`tcpdump: ${iface ?? 'eth0'}: You don't have permission to perform this capture on that device\n(socket: Operation not permitted)\n`);
      return 1;
    }
    const dev = iface ?? h.ifaces.find((i) => i.name !== 'lo' && i.up)?.name ?? 'lo';
    if (dev !== 'any' && !ifaceOf(h, dev)) {
      ctx.err(`tcpdump: ${dev}: No such device exists\n(No such device exists)\n`);
      return 1;
    }
    let filter: Filter;
    try {
      filter = compileFilter(expr);
    } catch (e) {
      ctx.err(`tcpdump: ${(e as Error).message}\n`);
      return 1;
    }
    // On a terminal both streams end up on the screen; keep them in the order tcpdump prints them.
    const note = ctx.isatty ? ctx.out : ctx.err;
    note(`tcpdump: verbose output suppressed, use -v[v]... for full protocol decode\nlistening on ${dev}, link-type ${dev === 'any' ? 'LINUX_SLL2 (Linux cooked v2)' : 'EN10MB (Ethernet)'}, snapshot length 262144 bytes\n`);
    const seen = w.capture.slice(Math.min(st.readPos, w.capture.length));
    st.readPos = w.capture.length;
    const mine = seen.filter((p) => p.host === w.local && (dev === 'any' || p.iface === dev) && filter(p));
    // A packet to and from the same host on lo is seen once, as tcpdump shows it.
    const shown = count !== undefined ? mine.slice(0, count) : mine;
    for (const p of shown) ctx.out(tcpdumpLine(p, { numeric, link }) + '\n');
    note(`\n${shown.length} packet${shown.length === 1 ? '' : 's'} captured\n${mine.length} packet${mine.length === 1 ? '' : 's'} received by filter\n0 packets dropped by kernel\n`);
    return 0;
  },
};

// ── iptables ───────────────────────────────────────────────────────────────

const IPT = 'iptables v1.8.11 (nf_tables)';
const BUILTIN: Record<string, string[]> = { filter: ['INPUT', 'FORWARD', 'OUTPUT'], nat: ['PREROUTING', 'INPUT', 'OUTPUT', 'POSTROUTING'] };

function ruleSpec(r: NfRule): string {
  const p: string[] = [];
  const neg = r.not ?? {};
  if (r.src) p.push(`${neg.src ? '! ' : ''}-s ${r.src.includes('/') ? r.src : `${r.src}/32`}`);
  if (r.dst) p.push(`${neg.dst ? '! ' : ''}-d ${r.dst.includes('/') ? r.dst : `${r.dst}/32`}`);
  if (r.inIf) p.push(`${neg.inIf ? '! ' : ''}-i ${r.inIf}`);
  if (r.outIf) p.push(`${neg.outIf ? '! ' : ''}-o ${r.outIf}`);
  if (r.proto && r.proto !== 'all') p.push(`-p ${r.proto}`);
  if (r.state) p.push(`-m conntrack --ctstate ${r.state.join(',')}`);
  if ((r.sport !== undefined || r.dport !== undefined) && r.proto) p.push(`-m ${r.proto}`);
  if (r.sport !== undefined) p.push(`--sport ${r.sport}`);
  if (r.dport !== undefined) p.push(`--dport ${r.dport}`);
  p.push(`-j ${r.target}`);
  if (r.toDest) p.push(`--to-destination ${r.toDest}`);
  if (r.toSrc) p.push(`--to-source ${r.toSrc}`);
  if (r.rejectWith) p.push(`--reject-with ${r.rejectWith}`);
  return p.join(' ');
}

/** iptables -S of one table: what the facts provider and iptables-save print. */
export function iptablesS(t: NfTable, table: string, only?: string): string {
  const lines: string[] = [];
  const chains = Object.keys(t);
  for (const c of chains) if (!only || c === only) lines.push(BUILTIN[table]?.includes(c) ? `-P ${c} ${t[c].policy ?? 'ACCEPT'}` : `-N ${c}`);
  for (const c of chains) if (!only || c === only) for (const r of t[c].rules) lines.push(`-A ${c} ${ruleSpec(r)}`);
  return lines.join('\n') + '\n';
}

function listChain(name: string, c: NfChain, table: string, o: { numeric: boolean; verbose: boolean; lines: boolean }): string {
  const builtin = BUILTIN[table]?.includes(name);
  const refs = 0;
  const head = builtin ? `Chain ${name} (policy ${c.policy ?? 'ACCEPT'}${o.verbose ? ` ${c.pkts ?? 0} packets, ${c.bytes ?? 0} bytes` : ''})` : `Chain ${name} (${refs} references)`;
  const cols = `${o.lines ? 'num  ' : ''}${o.verbose ? ' pkts bytes ' : ''}target     prot opt ${o.verbose ? 'in     out    ' : ''} source               destination         `;
  const rows = c.rules.map((r, i) => {
    const any = o.numeric ? '0.0.0.0/0' : 'anywhere';
    const addr = (a: string | undefined, n?: boolean) => (a ? `${n ? '!' : ''}${a.includes('/') || !o.numeric ? a : a}` : any);
    let extra = '';
    if (r.state) extra += ` ctstate ${r.state.join(',')}`;
    if (r.proto && r.proto !== 'all' && (r.dport !== undefined || r.sport !== undefined)) extra += ` ${r.proto}`;
    if (r.sport !== undefined) extra += ` spt:${!o.numeric && PORT_NAMES[r.sport] ? PORT_NAMES[r.sport] : r.sport}`;
    if (r.dport !== undefined) extra += ` dpt:${!o.numeric && PORT_NAMES[r.dport] ? PORT_NAMES[r.dport] : r.dport}`;
    if (r.toDest) extra += ` to:${r.toDest}`;
    if (r.toSrc) extra += ` to:${r.toSrc}`;
    if (r.rejectWith) extra += ` reject-with ${r.rejectWith}`;
    const v = o.verbose ? `${String(r.pkts).padStart(5)} ${String(r.bytes).padStart(5)} ` : '';
    const io = o.verbose ? `${pad(r.inIf ? `${r.not?.inIf ? '!' : ''}${r.inIf}` : '*', 6)} ${pad(r.outIf ? `${r.not?.outIf ? '!' : ''}${r.outIf}` : '*', 6)} ` : '';
    return `${o.lines ? pad(String(i + 1), 4) + ' ' : ''}${v}${pad(r.target, 10)} ${pad(r.proto && r.proto !== 'all' ? r.proto : 'all', 4)} --  ${io}${pad(addr(r.src, r.not?.src), 20)} ${pad(addr(r.dst, r.not?.dst), 20)}${extra}`.trimEnd();
  });
  return [head, cols.trimEnd(), ...rows].join('\n');
}

function parseRule(args: string[]): { rule?: NfRule; error?: string } {
  const r: NfRule = { target: '', pkts: 0, bytes: 0 };
  let neg = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const v = () => args[++i];
    if (a === '!') {
      neg = true;
      continue;
    }
    switch (a) {
      case '-p':
      case '--protocol': {
        const p = v();
        if (!['tcp', 'udp', 'icmp', 'all'].includes(p)) return { error: `unknown protocol "${p}" specified` };
        r.proto = p as NfRule['proto'];
        break;
      }
      case '-s':
      case '--source':
        r.src = v().replace(/\/32$/, '');
        if (neg) r.not = { ...r.not, src: true };
        break;
      case '-d':
      case '--destination':
        r.dst = v().replace(/\/32$/, '');
        if (neg) r.not = { ...r.not, dst: true };
        break;
      case '-i':
      case '--in-interface':
        r.inIf = v();
        if (neg) r.not = { ...r.not, inIf: true };
        break;
      case '-o':
      case '--out-interface':
        r.outIf = v();
        if (neg) r.not = { ...r.not, outIf: true };
        break;
      case '--dport':
      case '--destination-port':
        r.dport = Number(v());
        break;
      case '--sport':
      case '--source-port':
        r.sport = Number(v());
        break;
      case '-m':
      case '--match': {
        const m = v();
        if (!['conntrack', 'state', 'tcp', 'udp', 'icmp', 'comment'].includes(m)) return { error: `Couldn't load match \`${m}':No such file or directory` };
        break;
      }
      case '--ctstate':
      case '--state':
        r.state = v().split(',').map((s) => s.toUpperCase());
        break;
      case '--comment':
        v();
        break;
      case '-j':
      case '--jump':
        r.target = v();
        break;
      case '--to-destination':
        r.toDest = v();
        break;
      case '--to-source':
        r.toSrc = v();
        break;
      case '--reject-with':
        r.rejectWith = v();
        break;
      default:
        return { error: `unknown option "${a}"` };
    }
    neg = false;
    if (args[i] === undefined) return { error: `option "${a}" requires an argument` };
  }
  if ((r.dport !== undefined || r.sport !== undefined) && (!r.proto || r.proto === 'all')) return { error: 'unknown option "--dport"' };
  return { rule: r };
}

function sameRule(a: NfRule, b: NfRule): boolean {
  return ruleSpec(a) === ruleSpec(b);
}

export const iptablesCommand: ShellCommand = {
  name: 'iptables',
  summary: bi('показать и изменить правила netfilter (фильтр и NAT)', 'show and change netfilter rules (filter and NAT)'),
  help: `${IPT}

Usage: iptables -[ACD] chain rule-specification [options]
       iptables -I chain [rulenum] rule-specification [options]
       iptables -D chain rulenum [options]
       iptables -[LS] [chain [rulenum]] [options]
       iptables -[FZ] [chain] [options]
       iptables -[NX] chain
       iptables -P chain target [options]

Commands:
  --append  -A chain		Append to chain
  --delete  -D chain		Delete matching rule from chain
  --insert  -I chain [rulenum]	Insert in chain as rulenum (default 1=first)
  --list    -L [chain [rulenum]]	List the rules in a chain or all chains
  --list-rules -S [chain]	Print the rules in a chain or all chains
  --flush   -F [chain]		Delete all rules in  chain or all chains
  --zero    -Z [chain]		Zero counters in chain or all chains
  --new     -N chain		Create a new user-defined chain
  --policy  -P chain target	Change policy on chain to target

Options:
  --proto	-p proto	protocol: by number or name, eg. \`tcp'
  --source	-s address[/mask]	source specification
  --destination -d address[/mask]	destination specification
  --in-interface -i input name	network interface name
  --jump	-j target	target for rule (may load target extension)
  --out-interface -o output name	network interface name
  --numeric	-n		numeric output of addresses and ports
  --table	-t table	table to manipulate (default: \`filter')
  --verbose	-v		verbose mode
  --line-numbers		print line numbers when listing`,
  man: page('iptables', 8, [
    { id: 'NAME', body: 'iptables - administration tool for IPv4 packet filtering and NAT' },
    { id: 'SYNOPSIS', body: 'iptables [-t table] {-A|-C|-D} chain rule-specification\niptables [-t table] -I chain [rulenum] rule-specification\niptables [-t table] -D chain rulenum\niptables [-t table] -S [chain [rulenum]]\niptables [-t table] {-F|-L|-Z} [chain [rulenum]] [options...]\niptables [-t table] -N chain\niptables [-t table] -P chain target\n\nrule-specification = [matches...] [target]\nmatch = -m matchname [per-match-options]\ntarget = -j targetname [per-target-options]' },
    { id: 'DESCRIPTION', body: 'Iptables is used to set up, maintain, and inspect the tables of IPv4 packet filter rules in the Linux kernel. Several different tables may be defined. Each table contains a number of built-in chains and may also contain user-defined chains.\n\nEach chain is a list of rules which can match a set of packets. Each rule specifies what to do with a packet that matches. This is called a \'target\', which may be a jump to a user-defined chain in the same table.' },
    { id: 'TARGETS', body: 'A firewall rule specifies criteria for a packet and a target. If the packet does not match, the next rule in the chain is examined; if it does match, then the next rule is specified by the value of the target, which can be the name of a user-defined chain or one of the special values ACCEPT, DROP or RETURN.\n\nACCEPT means to let the packet through. DROP means to drop the packet on the floor. RETURN means stop traversing this chain and resume at the next rule in the previous (calling) chain. If the end of a built-in chain is reached or a rule in a built-in chain with target RETURN is matched, the target specified by the chain policy determines the fate of the packet.\n\nREJECT (iptables-extensions) sends back an error packet in response to the matched packet: otherwise it is equivalent to DROP. --reject-with type: icmp-port-unreachable (default), tcp-reset, ...' },
    { id: 'TABLES', body: 'filter:\n    This is the default table (if no -t option is passed). It contains the built-in chains INPUT (for packets destined to local sockets), FORWARD (for packets being routed through the box), and OUTPUT (for locally-generated packets).\nnat:\n    This table is consulted when a packet that creates a new connection is encountered. It consists of four built-ins: PREROUTING (for altering packets as soon as they come in), INPUT (for altering packets destined for local sockets), OUTPUT (for altering locally-generated packets before routing), and POSTROUTING (for altering packets as they are about to go out).' },
    {
      id: 'OPTIONS',
      body: '-A, --append chain rule-specification\n       Append one or more rules to the end of the selected chain.\n-D, --delete chain rule-specification\n-D, --delete chain rulenum\n       Delete one or more rules from the selected chain.\n-I, --insert chain [rulenum] rule-specification\n       Insert one or more rules in the selected chain as the given rule number. If the rule number is 1, the rule or rules are inserted at the head of the chain. This is also the default if no rule number is specified.\n-L, --list [chain]\n       List all rules in the selected chain. If no chain is selected, all chains are listed.\n-S, --list-rules [chain]\n       Print all rules in the selected chain.\n-F, --flush [chain]\n       Flush the selected chain (all the chains in the table if none is given).\n-P, --policy chain target\n       Set the policy for the built-in (non-user-defined) chain to the given target.\n-N, --new-chain chain\n       Create a new user-defined chain by the given name.\n-t, --table table\n       This option specifies the packet matching table which the command should operate on.\n-p, --protocol protocol\n       The protocol of the rule or of the packet to check: tcp, udp, icmp, all.\n-s, --source address[/mask]\n       Source specification.\n-d, --destination address[/mask]\n       Destination specification.\n-j, --jump target\n       This specifies the target of the rule; i.e., what to do if the packet matches it.\n-i, --in-interface name\n       Name of an interface via which a packet was received.\n-o, --out-interface name\n       Name of an interface via which a packet is going to be sent.\n-v, --verbose\n       Verbose output: the packet and byte counters of every rule.\n-n, --numeric\n       Numeric output. IP addresses and port numbers will be printed in numeric format.\n--line-numbers\n       When listing rules, add line numbers to the beginning of each rule.',
    },
    { id: 'EXAMPLES', body: 'iptables -L -n -v\n    The filter table with counters.\niptables -A INPUT -p tcp --dport 22 -j ACCEPT\n    Allow SSH.\niptables -t nat -A POSTROUTING -s 10.0.2.0/24 -o eth1 -j MASQUERADE\n    Hide an inside network behind the address of eth1.\niptables -t nat -A PREROUTING -i eth1 -p tcp --dport 80 -j DNAT --to-destination 10.0.2.20:8080\n    Forward a port inside.' },
    { id: 'EXIT STATUS', body: 'Various error messages are printed to standard error. The exit code is 0 for correct functioning. Errors which appear to be caused by invalid or abused command line parameters cause an exit code of 2, and other errors cause an exit code of 1.' },
    { id: 'SEE ALSO', body: 'iptables-save(8), iptables-restore(8), iptables-extensions(8), nft(8)' },
  ], 'https://man7.org/linux/man-pages/man8/iptables.8.html', 'condensed from the iptables manual (GPL)'),
  run(ctx) {
    const st = net(ctx);
    const h = st.local;
    const args = ctx.argv.slice(1);
    if (!isRoot(ctx)) {
      ctx.err(`${IPT}: Could not fetch rule set generation id: Permission denied (you must be root)\n`);
      return 4;
    }
    let table = 'filter';
    let cmd = '';
    let chain: string | undefined;
    let num: number | undefined;
    let target: string | undefined;
    const o = { numeric: false, verbose: false, lines: false };
    const rest: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-t' || a === '--table') table = args[++i];
      else if (/^-[ADILSFPNXZ]$/.test(a) || ['--append', '--delete', '--insert', '--list', '--list-rules', '--flush', '--policy', '--new', '--new-chain', '--zero'].includes(a)) {
        cmd = a.length === 2 ? a[1] : ({ '--append': 'A', '--delete': 'D', '--insert': 'I', '--list': 'L', '--list-rules': 'S', '--flush': 'F', '--policy': 'P', '--new': 'N', '--new-chain': 'N', '--zero': 'Z' } as Record<string, string>)[a];
        if (args[i + 1] && !args[i + 1].startsWith('-')) chain = args[++i];
        if ((cmd === 'I' || cmd === 'D' || cmd === 'L') && /^\d+$/.test(args[i + 1] ?? '')) num = Number(args[++i]);
        if (cmd === 'P') target = args[++i];
      } else if (/^-[nvL]+$/.test(a) && a !== '-L' && !a.includes('L')) {
        if (a.includes('n')) o.numeric = true;
        if (a.includes('v')) o.verbose = true;
      } else if (/^-[nvL]+$/.test(a)) {
        cmd = 'L';
        if (a.includes('n')) o.numeric = true;
        if (a.includes('v')) o.verbose = true;
        if (args[i + 1] && !args[i + 1].startsWith('-')) chain = args[++i];
      } else if (a === '--numeric') o.numeric = true;
      else if (a === '--verbose') o.verbose = true;
      else if (a === '--line-numbers') o.lines = true;
      else rest.push(a);
    }
    if (table !== 'filter' && table !== 'nat') {
      if (table === 'raw' || table === 'mangle') return notSimulated(ctx, `iptables -t ${table}`);
      ctx.err(`${IPT}: can't initialize iptables table \`${table}': Table does not exist (do you need to insmod?)\nPerhaps iptables or your kernel needs to be upgraded.\n`);
      return 3;
    }
    const t = h.nf[table as 'filter' | 'nat'];
    const needChain = (): NfChain | null => {
      if (!chain || !t[chain]) {
        ctx.err(`${IPT}: ${chain ? `Chain '${chain}' does not exist` : 'option requires a chain'}\nTry \`iptables -h' or 'iptables --help' for more information.\n`);
        return null;
      }
      return t[chain];
    };
    switch (cmd) {
      case 'L': {
        const names = chain ? [chain] : Object.keys(t);
        if (chain && !t[chain]) return needChain() ? 0 : 1;
        ctx.out(names.map((n) => listChain(n, t[n], table, o)).join('\n\n') + '\n');
        return 0;
      }
      case 'S':
        if (chain && !t[chain]) return needChain() ? 0 : 1;
        ctx.out(iptablesS(t, table, chain));
        return 0;
      case 'F':
        for (const n of chain ? [chain] : Object.keys(t)) if (t[n]) t[n].rules = [];
        return 0;
      case 'Z':
        for (const n of chain ? [chain] : Object.keys(t)) {
          if (!t[n]) continue;
          t[n].pkts = t[n].bytes = 0;
          for (const r of t[n].rules) r.pkts = r.bytes = 0;
        }
        return 0;
      case 'P': {
        const c = needChain();
        if (!c) return 1;
        if (!BUILTIN[table].includes(chain!)) {
          ctx.err(`${IPT}: Bad built-in chain name\n`);
          return 1;
        }
        if (target !== 'ACCEPT' && target !== 'DROP') {
          ctx.err(`${IPT}: Bad policy name. Run \`dmesg' for more information.\n`);
          return 1;
        }
        c.policy = target;
        return 0;
      }
      case 'N':
        if (!chain) return needChain() ? 0 : 2;
        if (t[chain]) {
          ctx.err(`${IPT}: Chain already exists.\n`);
          return 1;
        }
        t[chain] = { rules: [] };
        return 0;
      case 'X':
        if (chain) delete t[chain];
        return 0;
      case 'A':
      case 'I':
      case 'D': {
        const c = needChain();
        if (!c) return 1;
        if (cmd === 'D' && num !== undefined && !rest.length) {
          if (num < 1 || num > c.rules.length) {
            ctx.err(`${IPT}: Index of deletion too big.\n`);
            return 1;
          }
          c.rules.splice(num - 1, 1);
          return 0;
        }
        const p = parseRule(rest);
        if (p.error || !p.rule) {
          ctx.err(`${IPT}: ${p.error}\nTry \`iptables -h' or 'iptables --help' for more information.\n`);
          return 2;
        }
        const r = p.rule;
        if (!r.target) {
          ctx.err(`${IPT}: a rule needs a target (-j ACCEPT, DROP, REJECT …) to do anything\n`);
          return 2;
        }
        const targets = ['ACCEPT', 'DROP', 'REJECT', 'RETURN', 'LOG', ...(table === 'nat' ? ['MASQUERADE', 'SNAT', 'DNAT'] : []), ...Object.keys(t)];
        if (!targets.includes(r.target)) {
          ctx.err(['MASQUERADE', 'SNAT', 'DNAT'].includes(r.target) ? `${IPT}: The "nat" table is not intended for filtering, the use of ${r.target} is therefore inhibited.\nhint: did you mean -t nat?\n` : `${IPT}: Couldn't load target \`${r.target}':No such file or directory\n`);
          return 2;
        }
        if (r.target === 'DNAT' && !r.toDest) {
          ctx.err(`${IPT}: DNAT: option "--to-destination" must be specified\n`);
          return 2;
        }
        if (r.target === 'DNAT' && !['PREROUTING', 'OUTPUT'].includes(chain!)) {
          ctx.err(`${IPT}: DNAT is only valid in the PREROUTING and OUTPUT chains\n`);
          return 2;
        }
        if ((r.target === 'MASQUERADE' || r.target === 'SNAT') && chain !== 'POSTROUTING') {
          ctx.err(`${IPT}: ${r.target} is only valid in the POSTROUTING chain\n`);
          return 2;
        }
        if (cmd === 'A') c.rules.push(r);
        else if (cmd === 'I') c.rules.splice(Math.max(0, (num ?? 1) - 1), 0, r);
        else {
          const i = c.rules.findIndex((x) => sameRule(x, r));
          if (i < 0) {
            ctx.err(`${IPT}: Bad rule (does a matching rule exist in that chain?).\n`);
            return 1;
          }
          c.rules.splice(i, 1);
        }
        return 0;
      }
      default:
        ctx.err(`${IPT}: no command specified\nTry \`iptables -h' or 'iptables --help' for more information.\n`);
        return 2;
    }
  },
};

export const iptablesSaveCommand: ShellCommand = {
  name: 'iptables-save',
  summary: bi('напечатать все правила netfilter в формате для восстановления', 'print every netfilter rule in the restore format'),
  help: 'Usage: iptables-save [-c] [-t table]\n  -c, --counters   include the packet and byte counters\n  -t, --table      only this table',
  man: page('iptables-save', 8, [
    { id: 'NAME', body: 'iptables-save - dump iptables rules' },
    { id: 'SYNOPSIS', body: 'iptables-save [-M modprobe] [-c] [-t table] [-f filename]' },
    { id: 'DESCRIPTION', body: 'iptables-save is used to dump the contents of IP Table in easily parseable format either to STDOUT or to a specified file.' },
    { id: 'OPTIONS', body: '-c, --counters\n       include the current values of all packet and byte counters in the output\n-t, --table tablename\n       restrict output to only one table. If not specified, output includes all available tables.' },
    { id: 'SEE ALSO', body: 'iptables-restore(8), iptables(8)' },
  ]),
  run(ctx) {
    const st = net(ctx);
    const h = st.local;
    if (!isRoot(ctx)) {
      ctx.err(`${IPT}: Could not fetch rule set generation id: Permission denied (you must be root)\n`);
      return 4;
    }
    const args = ctx.argv.slice(1);
    const counters = args.includes('-c') || args.includes('--counters');
    const only = args.includes('-t') ? args[args.indexOf('-t') + 1] : undefined;
    const date = new Date(st.world.clock).toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) ([\d:]+) GMT$/, '$1 $3 $2 $5 $4');
    for (const table of ['nat', 'filter'] as const) {
      if (only && only !== table) continue;
      const t = h.nf[table];
      ctx.out(`# Generated by iptables-save v1.8.11 (nf_tables) on ${date}\n*${table}\n`);
      for (const c of Object.keys(t)) ctx.out(`:${c} ${BUILTIN[table].includes(c) ? (t[c].policy ?? 'ACCEPT') : '-'} [${counters ? `${t[c].pkts ?? 0}:${t[c].bytes ?? 0}` : '0:0'}]\n`);
      for (const c of Object.keys(t)) for (const r of t[c].rules) ctx.out(`${counters ? `[${r.pkts}:${r.bytes}] ` : ''}-A ${c} ${ruleSpec(r)}\n`);
      ctx.out(`COMMIT\n# Completed on ${date}\n`);
    }
    return 0;
  },
};

// ── dhcpcd ─────────────────────────────────────────────────────────────────

function dhcpServers(w: World, h: Host, ifname: string): { host: Host; addr: string }[] {
  const seg = ifaceOf(h, ifname)?.seg;
  const out: { host: Host; addr: string; delay: number }[] = [];
  for (const o of Object.values(w.hosts)) {
    if (o === h || o.off) continue;
    const svc = o.services.find((s) => s.kind === 'dhcp' && !s.down);
    const nic = o.ifaces.find((i) => i.seg === seg && i.up && i.addrs.length);
    if (svc && nic) out.push({ host: o, addr: addrOf(nic.addrs[0]), delay: svc.dhcp?.delay ?? 2 });
  }
  return out.sort((a, b) => a.delay - b.delay);
}

export const dhcpcdCommand: ShellCommand = {
  name: 'dhcpcd',
  summary: bi('получить адрес, маршрут и DNS-сервер по DHCP', 'get an address, a route and a DNS server over DHCP'),
  help: 'usage: dhcpcd [-146ABbDdEGgHJKLMNPpqTV] [-C, --nohook hook] [-c, --script script]\n              [-e, --env value] [-F, --fqdn FQDN] [-f, --config file]\n              [-h, --hostname hostname] [-k, --release] [-l, --leasetime seconds]\n              [interface] [...]',
  man: page('dhcpcd', 8, [
    { id: 'NAME', body: 'dhcpcd - a DHCP client' },
    { id: 'SYNOPSIS', body: 'dhcpcd [-146ABbDdEGgHJKLMNPpqTV] [-k, --release] [interface] [...]' },
    { id: 'DESCRIPTION', body: 'dhcpcd is an implementation of the DHCP client specified in RFC 2131. dhcpcd gets the host information (IP address, routes, etc) from a DHCP server and configures the network interface of the machine on which it is running. dhcpcd then runs the configuration script which writes DNS information to resolvconf(8), if available, otherwise directly to /etc/resolv.conf.\n\nIf dhcpcd fails to obtain a lease, it probes for a valid IPv4LL address (aka ZeroConf, aka APIPA). Once obtained it restarts the process of looking for a DHCP server to get a proper address.' },
    { id: 'OPTIONS', body: '-k, --release [interface]\n       This causes an existing dhcpcd process running on the interface to release its lease and de-configure the interface regardless of the -p, --persistent option.\n-T, --test\n       On receipt of DHCP messages just call the hook script with the reason of TEST which echos the DHCP variables found in the message to the console. The interface configuration isn\'t touched and neither are any configuration files.' },
    { id: 'SEE ALSO', body: 'dhcpcd.conf(5), resolvconf(8), RFC 2131, RFC 3927.' },
  ], 'https://man.archlinux.org/man/dhcpcd.8.en', 'condensed from the dhcpcd manual (BSD licence)'),
  run(ctx) {
    const st = net(ctx);
    const w = st.world;
    const h = st.local;
    const args = ctx.argv.slice(1);
    if (!isRoot(ctx)) {
      ctx.err('dhcpcd: not running as root\n');
      return 1;
    }
    const release = args.includes('-k') || args.includes('--release');
    const test = args.includes('-T') || args.includes('--test');
    const ifname = args.find((a) => !a.startsWith('-')) ?? h.ifaces.find((i) => i.name !== 'lo')?.name ?? 'eth0';
    const nic = ifaceOf(h, ifname);
    if (!nic) {
      ctx.err(`dhcpcd: ${ifname}: interface not found\n`);
      return 1;
    }
    if (args.includes('-U') || args.includes('--dumplease')) {
      const lease = h.dhcpLease;
      if (!lease || lease.iface !== ifname) { ctx.err(`dhcpcd: ${ifname}: no lease to dump\n`); return 1; }
      ctx.out(`ip_address=${lease.addr}\nrouters=${lease.router ?? ''}\ndomain_name_servers=${(lease.dns ?? []).join(' ')}\ndhcp_lease_time=${lease.lease}\ndhcp_server_identifier=${lease.server}\n`);
      return 0;
    }
    if (release) {
      ctx.out(`${ifname}: removing interface\n${ifname}: releasing lease of ${addrOf(nic.addrs[0] ?? '0.0.0.0')}\n${ifname}: deleting route to ${nic.addrs[0] ? `${fmtIp(parseIp(addrOf(nic.addrs[0])) & 0xffffff00)}/24` : ''}\n${ifname}: deleting default route\n`);
      nic.addrs = [];
      h.routes = h.routes.filter((r) => r.proto !== 'dhcp');
      h.dhcpLease = undefined;
      return 0;
    }
    ctx.out(`dhcpcd-10.1.0 starting\n${ifname}: carrier acquired\n${ifname}: soliciting a DHCP lease\n`);
    const cap = (host: Host, dev: string, dir: 'in' | 'out', src: string, dst: string, sport: number, dport: number, info: string, dstMac = 'ff:ff:ff:ff:ff:ff') =>
      record(w, { host: host.id, iface: dev, dir, srcMac: ifaceOf(host, dev)?.mac ?? '', dstMac, l3: 'ip', proto: 'udp', src, dst, sport, dport, ttl: 64, info, len: 328 });
    cap(h, ifname, 'out', '0.0.0.0', '255.255.255.255', 68, 67, `BOOTP/DHCP, Request from ${nic.mac}, length 300`);
    const servers = dhcpServers(w, h, ifname);
    w.clock += 1000;
    if (!servers.length) {
      cap(h, ifname, 'out', '0.0.0.0', '255.255.255.255', 68, 67, `BOOTP/DHCP, Request from ${nic.mac}, length 300`);
      cap(h, ifname, 'out', '0.0.0.0', '255.255.255.255', 68, 67, `BOOTP/DHCP, Request from ${nic.mac}, length 300`);
      w.clock += 10000;
      const ll = `169.254.${(parseInt(nic.mac.split(':')[4], 16) % 254) + 1}.${(parseInt(nic.mac.split(':')[5], 16) % 254) + 1}`;
      ctx.out(`${ifname}: probing for an IPv4LL address\n${ifname}: using IPv4LL address ${ll}\n${ifname}: adding route to 169.254.0.0/16\ntimed out\n`);
      if (!test) {
        nic.addrs = [`${ll}/16`];
        h.routes = h.routes.filter((r) => r.proto !== 'dhcp');
      }
      return 1;
    }
    for (const s of servers) {
      const d = s.host.services.find((x) => x.kind === 'dhcp')!.dhcp!;
      const sdev = s.host.ifaces.find((i) => i.seg === nic.seg)!.name;
      cap(s.host, sdev, 'in', '0.0.0.0', '255.255.255.255', 68, 67, `BOOTP/DHCP, Request from ${nic.mac}, length 300`);
      const offer = d.leases?.[nic.mac] ?? d.pool[0].replace(/\d+$/, String(Number(d.pool[0].split('.')[3]) + (w.counter % 20) + 3));
      cap(s.host, sdev, 'out', s.addr, offer, 67, 68, 'BOOTP/DHCP, Reply, length 300', nic.mac);
      cap(h, ifname, 'in', s.addr, offer, 67, 68, 'BOOTP/DHCP, Reply, length 300', nic.mac);
    }
    const win = servers[0];
    const d = win.host.services.find((x) => x.kind === 'dhcp')!.dhcp!;
    const addr = d.leases?.[nic.mac] ?? d.pool[0].replace(/\d+$/, String(Number(d.pool[0].split('.')[3]) + (w.counter % 20) + 3));
    d.leases = { ...(d.leases ?? {}), [nic.mac]: addr };
    ctx.out(`${ifname}: offered ${addr} from ${win.addr}\n`);
    cap(h, ifname, 'out', '0.0.0.0', '255.255.255.255', 68, 67, `BOOTP/DHCP, Request from ${nic.mac}, length 300`);
    const wdev = win.host.ifaces.find((i) => i.seg === nic.seg)!.name;
    cap(win.host, wdev, 'out', win.addr, addr, 67, 68, 'BOOTP/DHCP, Reply, length 300', nic.mac);
    cap(h, ifname, 'in', win.addr, addr, 67, 68, 'BOOTP/DHCP, Reply, length 300', nic.mac);
    w.clock += 40;
    const net0 = `${fmtIp(parseIp(addr) & ((0xffffffff << (32 - d.mask)) >>> 0))}/${d.mask}`;
    ctx.out(`${ifname}: leased ${addr} for ${d.lease} seconds\n${ifname}: adding route to ${net0}\n`);
    if (d.router) ctx.out(`${ifname}: adding default route via ${d.router}\n`);
    if (test) {
      ctx.out(`interface=${ifname}\nnew_ip_address=${addr}\nnew_subnet_mask=${fmtIp((0xffffffff << (32 - d.mask)) >>> 0)}\nnew_routers=${d.router ?? ''}\nnew_domain_name_servers=${(d.dns ?? []).join(' ')}\nnew_dhcp_lease_time=${d.lease}\nnew_dhcp_server_identifier=${win.addr}\n`);
      return 0;
    }
    nic.addrs = [`${addr}/${d.mask}`];
    h.routes = h.routes.filter((r) => r.proto !== 'dhcp');
    if (d.router) h.routes.push({ dst: 'default', via: d.router, dev: ifname, proto: 'dhcp', metric: 1002 });
    h.dhcpLease = { iface: ifname, addr, server: win.addr, lease: d.lease, acquiredAt: w.clock, dns: d.dns, router: d.router, mask: d.mask };
    if (d.dns?.length) {
      try {
        ctx.machine.rootFs.writeFile('/etc/resolv.conf', `# Generated by dhcpcd from ${ifname}.dhcp\n${d.dns.map((x) => `nameserver ${x}`).join('\n')}\n`);
      } catch {
        /* read-only resolv.conf */
      }
    }
    ctx.out('forked to background, child pid 512\n');
    return 0;
  },
};

// ── nginx ──────────────────────────────────────────────────────────────────

export const nginxCommand: ShellCommand = {
  name: 'nginx',
  summary: bi('проверить и перечитать конфигурацию nginx', 'test and reload the nginx configuration'),
  help: `nginx version: ${NGINX_VERSION}
Usage: nginx [-?hvVtTq] [-s signal] [-p prefix]
             [-e filename] [-c filename] [-g directives]

Options:
  -?,-h         : this help
  -v            : show version and exit
  -t            : test configuration and exit
  -T            : test configuration, dump it and exit
  -s signal     : send signal to a master process: stop, quit, reopen, reload`,
  handlesHelp: false,
  man: page('nginx', 8, [
    { id: 'NAME', body: 'nginx - HTTP and reverse proxy server, mail proxy server' },
    { id: 'SYNOPSIS', body: 'nginx [-?hqTtVv] [-c file] [-e file] [-g directives] [-p prefix] [-s signal]' },
    { id: 'DESCRIPTION', body: 'nginx (pronounced "engine x") is an HTTP and reverse proxy server, a mail proxy server, and a generic TCP/UDP proxy server.' },
    { id: 'OPTIONS', body: '-t     Do not run, just test the configuration file. nginx checks the configuration file syntax and then tries to open files referenced in the configuration.\n-T     Same as -t, but additionally dump configuration files to standard output.\n-s signal\n       Send a signal to the master process. The argument signal can be one of: stop, quit, reopen, reload.\n       reload  Reload configuration, start the new worker process with a new configuration, gracefully shut down old worker processes.\n-v     Print the nginx version.' },
    { id: 'SEE ALSO', body: 'Documentation at http://nginx.org/en/docs/ ; the proxy module: https://nginx.org/en/docs/http/ngx_http_proxy_module.html' },
  ], 'https://nginx.org/en/docs/switches.html', 'condensed from nginx(8) and the nginx documentation (BSD-2-Clause)'),
  run(ctx) {
    const st = net(ctx);
    const w = st.world;
    const h = st.local;
    const args = ctx.argv.slice(1);
    const svc = h.services.find((s) => s.kind === 'nginx');
    if (args.includes('-v')) {
      ctx.err(`nginx version: ${NGINX_VERSION}\n`);
      return 0;
    }
    if (!svc?.nginx) {
      // Not a network lab: the nginx of the Linux block (installed from a package, run by systemd) answers.
      const fb = (ctx.machine as unknown as { registry?: { commands?: { fallback?: (n: string) => typeof nginxCommand | undefined } } }).registry?.commands?.fallback?.('nginx');
      if (fb && fb !== nginxCommand) return fb.run(ctx);
      ctx.err('nginx: [error] open() "/run/nginx.pid" failed (2: No such file or directory)\n');
      return 1;
    }
    const file = svc.nginx.conf;
    const text = readHostFile(w, st.io, w.local, file) ?? '';
    const conf = parseNginx(text, file);
    const test = () => {
      if (conf.errors.length) {
        ctx.err(`nginx: [emerg] ${conf.errors[0]}\nnginx: configuration file /etc/nginx/nginx.conf test failed\n`);
        return false;
      }
      ctx.err('nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful\n');
      return true;
    };
    if (!isRoot(ctx) && (args.includes('-s') || args.includes('-t'))) {
      ctx.err(`nginx: [alert] could not open error log file: open() "/var/log/nginx/error.log" failed (13: Permission denied)\n${errLogDate(w.clock)} [emerg] ${svc.pid}#${svc.pid}: open() "/run/nginx.pid" failed (13: Permission denied)\n`);
      return 1;
    }
    if (args.includes('-t')) return test() ? 0 : 1;
    if (args.includes('-T')) {
      if (!test()) return 1;
      ctx.out(`# configuration file ${file}:\n${text}`);
      return 0;
    }
    const si = args.indexOf('-s');
    if (si >= 0) {
      const sig = args[si + 1];
      if (sig === 'reload') {
        if (conf.errors.length) {
          ctx.err(`nginx: [emerg] ${conf.errors[0]}\n`);
          return 1;
        }
        svc.nginx.loaded = text;
        svc.nginx.failedUntil = {};
        return 0;
      }
      if (sig === 'stop' || sig === 'quit') {
        svc.down = true;
        return 0;
      }
      return notSimulated(ctx, `nginx -s ${sig}`);
    }
    if (!svc.down) {
      ctx.err('nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)\n');
      return 1;
    }
    svc.down = false;
    svc.nginx.loaded = text;
    return 0;
  },
};

export { parseCidr };
