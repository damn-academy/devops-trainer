// ping, traceroute, nc and curl: the commands that send something and report
// what came back. Their output follows iputils-ping 20240905, traceroute 2.1,
// netcat-openbsd and curl 8.14 (Debian 13), including the error messages,
// because reading those messages is the skill (03 §5.3 net.m16).

import { bi } from '../../core/i18n';
import type { CmdContext, ShellCommand } from '../../core/types';
import { stubResolve, type StubResult } from './dns';
import { certDate, checkCert, CURL_TLS_MESSAGE, CURL_VERSION, REASONS, serveHttp, type HttpResponse } from './http';
import { isIp } from './ip';
import { icmpEcho, lookupRoute, sendIcmpError, srcFor, tcpConnect, tcpData, transmit, type ConnectResult, type Packet } from './world';
import { jitter, ms3, net, notSimulated, page, PORT_NAMES } from './cmd-util';
import { parseArgs } from '../terminal/commands/util';

function resolveOrFail(ctx: CmdContext, name: string, tool: string): StubResult | null {
  const st = net(ctx);
  const r = stubResolve(st.world, st.io, st.world.local, name);
  if (r.addr) return r;
  if (r.error === 'timeout') ctx.err(`${tool}: ${name}: Temporary failure in name resolution\n`);
  else ctx.err(`${tool}: ${name}: Name or service not known\n`);
  return null;
}

// ── ping ───────────────────────────────────────────────────────────────────

export const pingCommand: ShellCommand = {
  name: 'ping',
  summary: bi('проверить, отвечает ли адрес (эхо-запрос)', 'check whether an address answers (echo request)'),
  help: `
Usage
  ping [options] <destination>

Options:
  <destination>      DNS name or IP address
  -c <count>         stop after <count> replies
  -i <interval>      seconds between sending each packet
  -n                 no reverse DNS name resolution
  -q                 quiet output
  -s <size>          use <size> as number of data bytes to be sent
  -t <ttl>           define time to live
  -W <timeout>       time to wait for response
  -M <pmtud opt>     define path MTU discovery, can be one of <do|dont|want|probe>

IPv4 options:
  -4                 use IPv4

For more details see ping(8).`,
  man: page('ping', 8, [
    { id: 'NAME', body: 'ping - send ICMP ECHO_REQUEST to network hosts' },
    { id: 'SYNOPSIS', body: 'ping [-aAbBdCDfhHLnOqrRUvV46] [-c count] [-i interval] [-I interface] [-s packetsize] [-t ttl] [-W timeout] [-M pmtudisc_option] {destination}' },
    { id: 'DESCRIPTION', body: 'ping uses the ICMP protocol\'s mandatory ECHO_REQUEST datagram to elicit an ICMP ECHO_RESPONSE from a host or gateway. ECHO_REQUEST datagrams ("pings") have an IP and ICMP header, followed by a "struct timeval" and then an arbitrary number of "pad" bytes used to fill out the packet.\n\nIn the trainer, ping without -c stops after 4 packets, as if you had pressed Ctrl+C.' },
    {
      id: 'OPTIONS',
      body: '-c count\n       Stop after sending count ECHO_REQUEST packets. With deadline option, ping waits for count ECHO_REPLY packets, until the timeout expires.\n-i interval\n       Wait interval seconds between sending each packet. Real number allowed with dot as a decimal separator (regardless locale setup). The default is to wait for one second between each packet normally.\n-n     Numeric output only. No attempt will be made to lookup symbolic names for host addresses.\n-q     Quiet output. Nothing is displayed except the summary lines at startup time and when finished.\n-s packetsize\n       Specifies the number of data bytes to be sent. The default is 56, which translates into 64 ICMP data bytes when combined with the 8 bytes of ICMP header data.\n-t ttl\n       ping only. Set the IP Time to Live.\n-W timeout\n       Time to wait for a response, in seconds.\n-M pmtudisc_opt\n       Select Path MTU Discovery strategy. pmtudisc_option may be either do (set DF flag but subject to PMTU checks by kernel, packets too large will be rejected), want (do PMTU discovery, fragment locally when packet size is large), probe (set DF flag and bypass PMTU checks, useful for probing), or dont (do not set DF flag).',
    },
    { id: 'EXIT STATUS', body: 'If ping does not receive any reply packets at all it will exit with code 1. If a packet count and deadline are both specified, and fewer than count packets are received by the time the deadline has arrived, it will also exit with code 1. On other error it exits with code 2. Otherwise it exits with code 0. This makes it possible to use the exit code to see if a host is alive or not.' },
    { id: 'EXAMPLES', body: 'ping -c 3 10.0.2.10\n    Send three echo requests and print the statistics.\nping -t 1 8.8.8.8\n    The first router answers "Time to live exceeded": this is how traceroute works.' },
    { id: 'SEE ALSO', body: 'ip(8), ss(8), traceroute(8), tracepath(8)' },
  ], 'https://man7.org/linux/man-pages/man8/ping.8.html', 'condensed from iputils ping(8)'),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'nq4', withValue: 'csitWMI' });
    if (a.error) {
      ctx.err(`ping: ${a.error}\n\nUsage\n  ping [options] <destination>\n`);
      return 2;
    }
    if (a.values.M) {
      if (!['do', 'dont', 'want', 'probe'].includes(a.values.M)) {
        ctx.err(`ping: invalid -M argument: ${a.values.M}\n`);
        return 2;
      }
    }
    if (a.values.I) return notSimulated(ctx, 'ping -I');
    const dest = a.operands[0];
    if (!dest) {
      ctx.err('ping: usage error: Destination address required\n');
      return 1;
    }
    const st = net(ctx);
    const w = st.world;
    const r = resolveOrFail(ctx, dest, 'ping');
    if (!r) return 2;
    const ip = r.addr!;
    const count = a.values.c ? Number(a.values.c) : 4;
    if (!Number.isInteger(count) || count < 1) {
      ctx.err(`ping: invalid argument: '${a.values.c}': out of range: 1 <= value <= 9223372036854775807\n`);
      return 1;
    }
    const size = a.values.s ? Number(a.values.s) : 56;
    if (!Number.isInteger(size) || size < 0 || size > 65507) { ctx.err('ping: invalid packet size: must be between 0 and 65507\n'); return 2; }
    const ttl = a.values.t ? Number(a.values.t) : 64;
    const local = w.hosts[w.local];
    const route = ip.startsWith('127.') ? undefined : lookupRoute(local, ip);
    if (!route && !ip.startsWith('127.') && !local.ifaces.some((i) => i.addrs.some((x) => x.startsWith(`${ip}/`)))) {
      ctx.err('ping: connect: Network is unreachable\n');
      return 2;
    }
    // A DF packet larger than the MTU of the egress interface is refused locally (-M do).
    const egressMtu = route ? (local.ifaces.find((i) => i.name === route.dev)?.mtu ?? 1500) : 65536;
    ctx.out(`PING ${dest} (${ip}) ${size}(${size + 28}) bytes of data.\n`);
    const rtts: number[] = [];
    let errors = 0;
    const id = 40 + (w.counter % 900);
    const t0 = w.clock;
    for (let seq = 1; seq <= count; seq++) {
      if (a.values.M === 'do' && size + 28 > egressMtu) {
        ctx.out(`ping: local error: message too long, mtu=${egressMtu}\n`);
        errors++;
        continue;
      }
      const res = icmpEcho(w, w.local, ip, { ttl, size, seq, id });
      if (res.ok) {
        const t = jitter(res.rtt, seq);
        rtts.push(t);
        if (!a.flags.has('q')) ctx.out(`${size + 8} bytes from ${ip}: icmp_seq=${seq} ttl=${res.ttl} time=${t < 1 ? ms3(t) : t.toFixed(t < 10 ? 2 : 1)} ms\n`);
      } else if (res.error) {
        errors++;
        if (!a.flags.has('q')) ctx.out(`From ${res.error.from} icmp_seq=${seq} ${res.error.text}\n`);
      }
      w.clock = t0 + seq * 1000;
    }
    const recv = rtts.length;
    const loss = Math.round(((count - recv) / count) * 100);
    const time = (count - 1) * 1000 + (count > 1 ? 3 + count : 0);
    ctx.out(`\n--- ${dest} ping statistics ---\n`);
    ctx.out(`${count} packets transmitted, ${recv} received, ${errors ? `+${errors} errors, ` : ''}${loss}% packet loss, time ${time}ms\n`);
    if (recv) {
      const min = Math.min(...rtts);
      const max = Math.max(...rtts);
      const avg = rtts.reduce((s, x) => s + x, 0) / recv;
      const mdev = Math.sqrt(rtts.reduce((s, x) => s + (x - avg) ** 2, 0) / recv);
      ctx.out(`rtt min/avg/max/mdev = ${ms3(min)}/${ms3(avg)}/${ms3(max)}/${ms3(mdev)} ms\n`);
    }
    return recv ? 0 : 1;
  },
};

// ── traceroute ─────────────────────────────────────────────────────────────

export const tracerouteCommand: ShellCommand = {
  name: 'traceroute',
  summary: bi('показать маршрутизаторы на пути к адресу', 'show the routers on the way to an address'),
  help: `Usage:
  traceroute [ -46dFITnreAUDV ] [ -f first_ttl ] [ -m max_ttl ] [ -p port ] [ -q nqueries ] [ -w waittime ] host [ packetlen ]
Options:
  -I  --icmp                  Use ICMP ECHO for tracerouting
  -T  --tcp                   Use TCP SYN for tracerouting (default port is 80)
  -m max_ttl  --max-hops=max_ttl
                              Set the max number of hops (max TTL to be
                              reached). Default is 30
  -n                          Do not resolve IP addresses to their domain names
  -q nqueries  --queries=nqueries
                              Set the number of probes per each hop. Default is
                              3`,
  man: page('traceroute', 8, [
    { id: 'NAME', body: 'traceroute - print the route packets trace to network host' },
    { id: 'SYNOPSIS', body: 'traceroute [-46dFITnreAUDV] [-f first_ttl] [-m max_ttl] [-p port] [-q nqueries] [-w waittime] host [packetlen]' },
    {
      id: 'DESCRIPTION',
      body: 'traceroute tracks the route packets taken from an IP network on their way to a given host. It utilizes the IP protocol\'s time to live (TTL) field and attempts to elicit an ICMP TIME_EXCEEDED response from each gateway along the path to the host.\n\nThe only required parameter is the name or IP address of the destination host.\n\nThis program attempts to trace the route an IP packet would follow to some internet host by launching probe packets with a small ttl (time to live) then listening for an ICMP "time exceeded" reply from a gateway. We start our probes with a ttl of one and increase by one until we get an ICMP "port unreachable" (or TCP reset), which means we got to the "host", or hit a max (which defaults to 30 hops). Three probes (by default) are sent at each ttl setting and a line is printed showing the ttl, address of the gateway and round trip time of each probe. If the probe answers come from different gateways, the address of each responding system will be printed. If there is no response within a certain timeout, an "*" (asterisk) is printed for that probe.',
    },
    { id: 'OPTIONS', body: '-I, --icmp\n       Use ICMP ECHO for probes\n-T, --tcp\n       Use TCP SYN for probes\n-n     Do not try to map IP addresses to host names when displaying them.\n-m max_ttl, --max-hops=max_ttl\n       Specifies the maximum number of hops (max time-to-live value) traceroute will probe. The default is 30.\n-q nqueries, --queries=nqueries\n       Sets the number of probe packets per hop. The default is 3.\n-p port, --port=port\n       For UDP tracing, specifies the destination port base traceroute will use (the destination port number will be incremented by each probe).' },
    { id: 'EXAMPLES', body: 'traceroute -n 10.20.0.5\n    Show each hop by number, without name lookups.\ntraceroute -I -m 5 shop.example\n    ICMP probes, at most five hops.' },
    { id: 'SEE ALSO', body: 'ping(8), tracepath(8), mtr(8)' },
  ], 'https://man7.org/linux/man-pages/man8/traceroute.8.html', 'condensed from traceroute 2.1 (Dmitry Butskoy)'),
  run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'nIT46', withValue: 'mqpwf', long: { icmp: 'I', tcp: 'T', 'max-hops': 'm', queries: 'q', port: 'p' } });
    if (a.error) {
      ctx.err(`traceroute: ${a.error}\n`);
      return 2;
    }
    const dest = a.operands[0];
    if (!dest) {
      ctx.err('Specify "host" missing argument.\n');
      return 2;
    }
    const st = net(ctx);
    const w = st.world;
    const r = stubResolve(w, st.io, w.local, dest);
    if (!r.addr) {
      ctx.err(`${dest}: ${r.error === 'timeout' ? 'Temporary failure in name resolution' : 'Name or service not known'}\nCannot handle "host" cmdline arg \`${dest}' on position 1 (argc 1)\n`);
      return 2;
    }
    const ip = r.addr;
    const max = Number(a.values.m ?? 30);
    const q = Number(a.values.q ?? 3);
    const numeric = a.flags.has('n');
    const proto: 'icmp' | 'udp' | 'tcp' = a.flags.has('I') ? 'icmp' : a.flags.has('T') ? 'tcp' : 'udp';
    const local = w.hosts[w.local];
    const route = lookupRoute(local, ip);
    if (!route) {
      ctx.err('connect: Network is unreachable\n');
      return 1;
    }
    const src = srcFor(local, route) ?? '';
    ctx.out(`traceroute to ${dest} (${ip}), ${max} hops max, 60 byte packets\n`);
    let base = Number(a.values.p ?? (proto === 'tcp' ? 80 : 33434));
    for (let ttl = 1; ttl <= max; ttl++) {
      const cells: string[] = [];
      let last = '';
      let reached = false;
      for (let i = 0; i < q; i++) {
        const t0 = w.clock;
        const port = proto === 'udp' ? base++ : proto === 'tcp' ? base : 0;
        const pkt: Packet = proto === 'icmp'
          ? { proto: 'icmp', src, dst: ip, sport: 7, dport: 7, ttl, len: 60, icmp: { type: 8, code: 0 }, info: `ICMP echo request, id 7, seq ${ttl * 10 + i}, length 40` }
          : proto === 'udp'
            ? { proto: 'udp', src, dst: ip, sport: 40000 + ttl, dport: port, ttl, len: 60, info: `UDP, length 32` }
            : { proto: 'tcp', src, dst: ip, sport: 40000 + ttl, dport: port, ttl, len: 60, flags: 'S', info: `Flags [S], seq ${ttl}, win 5840, length 0` };
        const d = transmit(w, w.local, pkt);
        let from: string | undefined;
        if (!d.ok && d.stage?.startsWith('ttl-exceeded:')) {
          if (sendIcmpError(w, d.at, d.stopAddr, d.pkt, 'ttl')) from = d.stopAddr;
        } else if (d.ok) {
          const target = w.hosts[d.at];
          const answer: Packet = proto === 'icmp'
            ? { proto: 'icmp', src: d.pkt.dst, dst: d.pkt.src, sport: 7, dport: 7, ttl: 64, len: 60, icmp: { type: 0, code: 0 }, info: `ICMP echo reply, id 7, seq ${ttl * 10 + i}, length 40` }
            : proto === 'tcp'
              ? { proto: 'tcp', src: d.pkt.dst, dst: d.pkt.src, sport: d.pkt.dport, dport: d.pkt.sport, ttl: 64, len: 40, flags: 'R.', info: 'Flags [R.], seq 0, ack 1, win 0, length 0' }
              : { proto: 'icmp', src: d.pkt.dst, dst: d.pkt.src, sport: 0, dport: 0, ttl: 64, len: 88, icmp: { type: 3, code: 3 }, info: `ICMP ${d.pkt.dst} udp port ${port} unreachable, length 68`, embedded: { src: d.pkt.src, sport: d.pkt.sport, dst: d.pkt.dst, dport: d.pkt.dport } };
          if (transmit(w, target.id, answer).ok) {
            from = d.pkt.dst;
            reached = true;
          }
        } else if (!d.ok && (d.stage?.startsWith('no-route:') || d.stage?.startsWith('arp-no-reply:'))) {
          const kind = d.stage.startsWith('no-route:') ? 'net' : 'host';
          if (sendIcmpError(w, d.at, d.stopAddr, d.pkt, kind)) {
            from = `${d.stopAddr} !${kind === 'net' ? 'N' : 'H'}`;
            reached = true;
          }
        }
        if (!from) {
          w.clock = t0 + 5000;
          cells.push('*');
          continue;
        }
        const rtt = jitter(Math.max(0.05, w.clock - t0), ttl * 3 + i);
        const addr = from.split(' ')[0];
        const flag = from.includes('!') ? ` ${from.split(' ')[1]}` : '';
        if (addr !== last) cells.push(numeric ? `${addr}` : `${addr} (${addr})`);
        last = addr;
        cells.push(`${ms3(rtt)} ms${flag}`);
      }
      ctx.out(`${String(ttl).padStart(2, ' ')}  ${cells.join('  ').replace(/\* {2}\*/g, '* *').replace(/\* {2}\*/g, '* *')}\n`);
      if (reached) break;
    }
    return 0;
  },
};

// ── nc ─────────────────────────────────────────────────────────────────────

function connectErrText(c: ConnectResult): string {
  switch (c.error) {
    case 'refused':
      return 'Connection refused';
    case 'unreachable':
      return 'No route to host';
    case 'no-route':
      return 'Network is unreachable';
    default:
      return 'Connection timed out';
  }
}

export const ncCommand: ShellCommand = {
  name: 'nc',
  aliases: ['netcat'],
  summary: bi('открыть TCP- или UDP-соединение руками', 'open a TCP or UDP connection by hand'),
  help: `OpenBSD netcat (Debian patchlevel 1.229-1)
usage: nc [-46CDdFhklNnrStUuvZz] [-I length] [-i interval] [-M ttl]
          [-m minttl] [-O length] [-P proxy_username] [-p source_port]
          [-q seconds] [-s sourceaddr] [-T keyword] [-V rtable] [-W recvlimit]
          [-w timeout] [-X proxy_protocol] [-x proxy_address[:port]]
          [destination] [port]
        Command Summary:
                -l              Listen mode, for inbound connects
                -n              Suppress name/port resolutions
                -u              UDP mode
                -v              Verbose
                -w timeout      Timeout for connects and final net reads
                -z              Zero-I/O mode [used for scanning]
        Port numbers can be individual or ranges: lo-hi [inclusive]`,
  handlesHelp: false,
  man: page('nc', 1, [
    { id: 'NAME', body: 'nc - arbitrary TCP and UDP connections and listens' },
    { id: 'SYNOPSIS', body: 'nc [-46CDdFhklNnrStUuvZz] [-i interval] [-p source_port] [-s sourceaddr] [-w timeout] [destination] [port]' },
    { id: 'DESCRIPTION', body: 'The nc (or netcat) utility is used for just about anything under the sun involving TCP, UDP, or UNIX-domain sockets. It can open TCP connections, send UDP packets, listen on arbitrary TCP and UDP ports, do port scanning, and deal with both IPv4 and IPv6.\n\nWhat it sends is what it reads on standard input: `printf \'GET / HTTP/1.1\\r\\nHost: x\\r\\n\\r\\n\' | nc host 80` speaks HTTP by hand.' },
    { id: 'OPTIONS', body: '-l     Listen for an incoming connection rather than initiating a connection to a remote host.\n-n     Do not do any DNS or service lookups on any specified addresses, hostnames or ports.\n-u     Use UDP instead of TCP.\n-v     Produce more verbose output.\n-w timeout\n       Connections which cannot be established or are idle timeout after timeout seconds.\n-z     Only scan for listening daemons, without sending any data to them.' },
    { id: 'EXAMPLES', body: 'nc -zv 10.0.0.2 8080\n    Is anything listening on TCP 8080?\nnc -zv -w 3 10.0.0.2 9100\n    The same, but give up after three seconds.' },
    { id: 'SEE ALSO', body: 'socat(1)' },
  ], 'https://manpages.debian.org/trixie/netcat-openbsd/nc.1.en.html', 'condensed from netcat-openbsd nc(1)'),
  async run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { short: 'vznu46CdklNSt', withValue: 'wpsiq' });
    if (a.error) {
      ctx.err(`nc: ${a.error}\n`);
      return 1;
    }
    if (a.flags.has('l')) return notSimulated(ctx, 'nc -l (listening needs a second terminal)');
    if (a.flags.has('u')) return notSimulated(ctx, 'nc -u');
    const [host, portS] = a.operands;
    if (!host || !portS) {
      ctx.err('nc: missing port number\n');
      return 1;
    }
    const portSpecs = a.operands.slice(1).flatMap(p => p.split(','));
    const ports: number[] = [];
    for (const spec of portSpecs) {
      const match = /^(\d+)(?:-(\d+))?$/.exec(spec);
      const first = Number(match?.[1]), last = Number(match?.[2] ?? match?.[1]);
      if (!match || first < 1 || last > 65535 || first > last) {
        ctx.err(`nc: invalid port: ${spec}\n`);
        return 1;
      }
      for (let p = first; p <= last; p++) ports.push(p);
    }
    if (ports.length > 1 || String(ports[0]) !== portS) {
      let success = false;
      // Reuse the single-port path so every probe follows routing and firewall rules.
      const options = ctx.argv.slice(1, ctx.argv.indexOf(host));
      for (const port of ports) if (await ncCommand.run({ ...ctx, argv: ['nc', ...options, host, String(port)] }) === 0) success = true;
      return success ? 0 : 1;
    }
    const st = net(ctx);
    const w = st.world;
    const r = a.flags.has('n') ? { addr: isIp(host) ? host : undefined } : stubResolve(w, st.io, w.local, host);
    if (!r.addr) {
      ctx.err(`nc: getaddrinfo for host "${host}" port ${portS}: ${a.flags.has('n') ? 'Name or service not known' : 'Temporary failure in name resolution'}\n`);
      return 1;
    }
    const port = Number(portS);
    const timeout = a.values.w ? Number(a.values.w) * 1000 : undefined;
    const c = tcpConnect(w, w.local, r.addr, port, { timeoutMs: timeout });
    const pname = PORT_NAMES[port] ?? '*';
    if (!c.ok) {
      if (a.flags.has('v') || c.error !== 'timeout' || timeout !== undefined) {
        if (c.error === 'timeout' && timeout !== undefined) ctx.err(`nc: connect to ${r.addr} port ${port} (tcp) timed out: Operation now in progress\n`);
        else ctx.err(`nc: connect to ${r.addr} port ${port} (tcp) failed: ${connectErrText(c)}\n`);
      }
      return 1;
    }
    if (a.flags.has('v')) ctx.err(`Connection to ${host} ${port} port [tcp/${pname}] succeeded!\n`);
    if (a.flags.has('z')) return 0;
    const svc = c.service!;
    if (svc.banner) ctx.out(svc.banner + '\n');
    if ((svc.kind === 'http' || svc.kind === 'nginx') && ctx.stdin) {
      const req = parseRawHttp(ctx.stdin);
      if (!req) {
        ctx.out('HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain; charset=utf-8\r\nConnection: close\r\n\r\n400 Bad Request');
        return 0;
      }
      tcpData(w, w.local, r.addr, c.sport, port, ctx.stdin.length, `HTTP: ${req.method} ${req.path} HTTP/1.1`);
      if (!req.host) {
        ctx.out('HTTP/1.1 400 Bad Request\r\nServer: nginx/1.26.3\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>400 Bad Request</title></head></html>\r\n');
        return 0;
      }
      const res = serveHttp(w, st.io, c.host!, svc, { method: req.method, path: req.path, host: req.host, headers: [], client: c.seenSrc ?? '' });
      ctx.out(`HTTP/1.1 ${res.status} ${REASONS[res.status] ?? ''}\r\n${res.headers.map(([k, v]) => `${k}: ${v}\r\n`).join('')}\r\n${req.method === 'HEAD' ? '' : res.body}`);
    }
    return 0;
  },
};

export function parseRawHttp(text: string): { method: string; path: string; host?: string } | null {
  const lines = text.replace(/\\r/g, '').replace(/\r/g, '').replace(/\\n/g, '\n').split('\n');
  const m = /^([A-Z]+) (\S+) HTTP\/1\.[01]$/.exec(lines[0] ?? '');
  if (!m) return null;
  const host = lines.find((l) => /^host:/i.test(l))?.split(':').slice(1).join(':').trim();
  return { method: m[1], path: m[2], host };
}

// ── curl ───────────────────────────────────────────────────────────────────

interface CurlOpts {
  verbose: boolean;
  silent: boolean;
  showErr: boolean;
  include: boolean;
  head: boolean;
  insecure: boolean;
  follow: boolean;
  fail: boolean;
  out?: string;
  write?: string;
  method?: string;
  data?: string;
  headers: string[];
  connectTimeout?: number;
  maxTime?: number;
  resolve: Record<string, string>;
  url?: string;
}

function parseCurl(args: string[]): { o: CurlOpts; error?: string } {
  const o: CurlOpts = { verbose: false, silent: false, showErr: false, include: false, head: false, insecure: false, follow: false, fail: false, headers: [], resolve: {} };
  const need = (i: number, name: string) => {
    if (args[i + 1] === undefined) throw new Error(`option ${name}: requires parameter`);
    return args[i + 1];
  };
  try {
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.startsWith('--')) {
        const [name, inline] = a.split(/=(.*)/s, 2);
        const val = () => inline ?? need(i++, name);
        switch (name) {
          case '--verbose':
            o.verbose = true;
            break;
          case '--silent':
            o.silent = true;
            break;
          case '--show-error':
            o.showErr = true;
            break;
          case '--include':
            o.include = true;
            break;
          case '--head':
            o.head = true;
            break;
          case '--insecure':
            o.insecure = true;
            break;
          case '--location':
            o.follow = true;
            break;
          case '--fail':
            o.fail = true;
            break;
          case '--output':
            o.out = val();
            break;
          case '--write-out':
            o.write = val();
            break;
          case '--request':
            o.method = val();
            break;
          case '--data':
          case '--data-raw':
            o.data = val();
            break;
          case '--header':
            o.headers.push(val());
            break;
          case '--connect-timeout':
            o.connectTimeout = Number(val());
            break;
          case '--max-time':
            o.maxTime = Number(val());
            break;
          case '--resolve': {
            const [h, p, addr] = val().split(':');
            o.resolve[`${h}:${p}`] = addr;
            break;
          }
          default:
            return { o, error: `option ${name}: is unknown` };
        }
        continue;
      }
      if (a.startsWith('-') && a.length > 1) {
        for (let j = 1; j < a.length; j++) {
          const c = a[j];
          const rest = a.slice(j + 1);
          const takeVal = () => {
            const v = rest || need(i++, `-${c}`);
            j = a.length;
            return v;
          };
          if (c === 'v') o.verbose = true;
          else if (c === 's') o.silent = true;
          else if (c === 'S') o.showErr = true;
          else if (c === 'i') o.include = true;
          else if (c === 'I') o.head = true;
          else if (c === 'k') o.insecure = true;
          else if (c === 'L') o.follow = true;
          else if (c === 'f') o.fail = true;
          else if (c === 'o') o.out = takeVal();
          else if (c === 'w') o.write = takeVal();
          else if (c === 'X') o.method = takeVal();
          else if (c === 'd') o.data = takeVal();
          else if (c === 'H') o.headers.push(takeVal());
          else if (c === 'm') o.maxTime = Number(takeVal());
          else return { o, error: `option -${c}: is unknown` };
        }
        continue;
      }
      o.url = a;
    }
  } catch (e) {
    return { o, error: (e as Error).message };
  }
  return { o };
}

interface Timing {
  namelookup: number;
  connect: number;
  appconnect: number;
  starttransfer: number;
  total: number;
}

function writeOut(fmt: string, v: { code: number; t: Timing; ip: string; port: number; url: string; size: number }): string {
  const s = (x: number) => x.toFixed(6);
  return fmt
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/%\{([a-z_]+)\}/g, (m, k: string) => {
      switch (k) {
        case 'http_code':
        case 'response_code':
          return String(v.code).padStart(3, '0');
        case 'time_namelookup':
          return s(v.t.namelookup);
        case 'time_connect':
          return s(v.t.connect);
        case 'time_appconnect':
          return s(v.t.appconnect);
        case 'time_starttransfer':
          return s(v.t.starttransfer);
        case 'time_total':
          return s(v.t.total);
        case 'remote_ip':
          return v.ip;
        case 'remote_port':
          return String(v.port);
        case 'url_effective':
          return v.url;
        case 'size_download':
          return String(v.size);
        default:
          return m;
      }
    });
}

export const curlCommand: ShellCommand = {
  name: 'curl',
  summary: bi('сделать HTTP-запрос и показать, что ответил сервер', 'make an HTTP request and show what the server answered'),
  help: `Usage: curl [options...] <url>
 -d, --data <data>           HTTP POST data
 -f, --fail                  Fail fast with no output on HTTP errors
 -H, --header <header/@file> Pass custom header(s) to server
 -i, --include               Include response headers in output
 -I, --head                  Show document info only
 -k, --insecure              Allow insecure server connections
 -L, --location              Follow redirects
 -m, --max-time <seconds>    Maximum time allowed for transfer
 -o, --output <file>         Write to file instead of stdout
 -s, --silent                Silent mode
 -S, --show-error            Show error even when -s is used
 -v, --verbose               Make the operation more talkative
 -w, --write-out <format>    Output FORMAT after completion
 -X, --request <method>      Specify request method to use
     --connect-timeout <seconds> Maximum time allowed to connect
     --resolve <[+]host:port:addr[,addr]...> Resolve host+port to address

This is not the full help; this menu is split into categories.
Use "--help category" to get an overview of all categories.
Use "--help all" to list all options
For all options use the manual or "--help all".`,
  man: page('curl', 1, [
    { id: 'NAME', body: 'curl - transfer a URL' },
    { id: 'SYNOPSIS', body: 'curl [options / URLs]' },
    { id: 'DESCRIPTION', body: 'curl is a tool for transferring data from or to a server using URLs. It supports these protocols: DICT, FILE, FTP, FTPS, GOPHER, GOPHERS, HTTP, HTTPS, IMAP, IMAPS, LDAP, LDAPS, MQTT, POP3, POP3S, RTMP, RTMPS, RTSP, SCP, SFTP, SMB, SMBS, SMTP, SMTPS, TELNET, TFTP, WS and WSS.\n\ncurl is powered by libcurl for all transfer-related features.' },
    {
      id: 'OPTIONS',
      body: '-v, --verbose\n       Makes curl verbose during the operation. Useful for debugging and seeing what\'s going on under the hood. A line starting with \'>\' means "header data" sent by curl, \'<\' means "header data" received by curl that is hidden in normal cases, and a line starting with \'*\' means additional info provided by curl.\n-I, --head\n       Fetch the headers only. HTTP-servers feature the command HEAD which this uses to get nothing but the header of a document.\n-i, --include\n       Include response headers in the output. HTTP response headers can include things like server name, cookies, date of the document, HTTP version and more.\n-s, --silent\n       Silent or quiet mode. Do not show progress meter or error messages. Makes Curl mute.\n-S, --show-error\n       When used with -s, --silent, it makes curl show an error message if it fails.\n-o, --output <file>\n       Write output to the given file instead of stdout.\n-H, --header <header/@file>\n       Extra header to include in information sent. Example: curl -H "Host: shop.lab" http://10.0.0.1/\n-k, --insecure\n       By default, every secure connection curl makes is verified to be secure before the transfer takes place. This option makes curl skip the verification step and proceed without checking.\n-L, --location\n       If the server reports that the requested page has moved to a different location (indicated with a Location: header and a 3XX response code), this option makes curl redo the request to the new place.\n-m, --max-time <fractional seconds>\n       Maximum time in seconds that you allow each transfer to take.\n--connect-timeout <fractional seconds>\n       Maximum time in seconds that you allow curl\'s connection to take. This only limits the connection phase.\n-w, --write-out <format>\n       Make curl display information on stdout after a completed transfer. The format is a string that may contain plain text mixed with any number of variables. Variables are specified as %{variable_name}.\n\n       http_code       The numerical response code that was found in the last retrieved HTTP(S) transfer.\n       remote_ip       The remote IP address of the most recently done connection.\n       time_namelookup The time, in seconds, it took from the start until the name resolving was completed.\n       time_connect    The time, in seconds, it took from the start until the TCP connect to the remote host was completed.\n       time_appconnect The time, in seconds, it took from the start until the SSL/SSH/etc connect/handshake to the remote host was completed.\n       time_starttransfer The time, in seconds, it took from the start until the first byte was just about to be transferred.\n       time_total      The total time, in seconds, that the full operation lasted.\n-X, --request <method>\n       Change the method to use when starting the transfer.\n-d, --data <data>\n       Sends the specified data in a POST request to the HTTP server.\n-f, --fail\n       Fail fast with no output at all on server errors (HTTP 400 and above); curl returns error 22.\n--resolve <[+]host:port:addr[,addr]...>\n       Provide a custom address for a specific host and port pair.',
    },
    {
      id: 'EXIT STATUS',
      body: 'There are a bunch of different error codes and their corresponding error messages that may appear under error conditions.\n6      Could not resolve host. The given remote host could not be resolved.\n7      Failed to connect to host.\n22     HTTP page not retrieved. The requested URL was not found or returned another error with the HTTP error code being 400 or above. This return code only appears if -f, --fail is used.\n28     Operation timeout. The specified time-out period was reached according to the conditions.\n35     SSL connect error. The SSL handshaking failed.\n60     Peer certificate cannot be authenticated with known CA certificates.',
    },
    { id: 'EXAMPLES', body: 'curl -v http://shop.lab/\n    Show the request and the response headers.\ncurl -s -o /dev/null -w \'%{http_code} %{time_total}\\n\' http://10.0.2.21:8080/report\n    Only the status code and how long it took.' },
    { id: 'SEE ALSO', body: 'wget(1); the online manual: https://curl.se/docs/manpage.html' },
  ], 'https://curl.se/docs/manpage.html', 'condensed from the curl manual (curl license)'),
  run(ctx) {
    const { o, error } = parseCurl(ctx.argv.slice(1));
    if (error) {
      ctx.err(`curl: ${error}\ncurl: try 'curl --help' or 'curl --manual' for more information\n`);
      return 2;
    }
    if (!o.url) {
      ctx.err("curl: no URL specified\ncurl: try 'curl --help' or 'curl --manual' for more information\n");
      return 2;
    }
    const st = net(ctx);
    const w = st.world;
    const say = (s: string) => {
      if (o.verbose) ctx.err(s + '\n');
    };
    const fail = (code: number, msg: string) => {
      if (!o.silent || o.showErr) ctx.err(`curl: (${code}) ${msg}\n`);
      return code;
    };
    let url = o.url;
    const visited = new Set<string>();
    for (let hop = 0; hop < 6; hop++) {
      const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(\/[^#]*)?$/.exec(url);
      if (!m) return fail(3, `URL rejected: Malformed input to a URL function`);
      const scheme = m[1] ?? 'http';
      const host = m[2];
      const port = Number(m[3] ?? (scheme === 'https' ? 443 : 80));
      const path = m[4] ?? '/';
      const t0 = w.clock;
      let ip = o.resolve[`${host}:${port}`];
      if (!ip) {
        const r = stubResolve(w, st.io, w.local, host);
        if (!r.addr) {
          say(`* Could not resolve host: ${host}`);
          say('* shutting down connection #0');
          return fail(6, `Could not resolve host: ${host}`);
        }
        ip = r.addr;
      } else say(`* Added ${host}:${port}:${ip} to DNS cache`);
      const tName = (w.clock - t0) / 1000;
      say(`* Host ${host}:${port} was resolved.`);
      say('* IPv6: (none)');
      say(`* IPv4: ${ip}`);
      say(`*   Trying ${ip}:${port}...`);
      const limit = o.connectTimeout !== undefined ? o.connectTimeout * 1000 : o.maxTime !== undefined ? o.maxTime * 1000 : undefined;
      const c = tcpConnect(w, w.local, ip, port, { timeoutMs: limit });
      const elapsed = () => Math.round(w.clock - t0);
      if (!c.ok) {
        if (c.error === 'timeout') {
          if (o.connectTimeout !== undefined) {
            say(`* Connection timed out after ${elapsed()} milliseconds`);
            return fail(28, `Failed to connect to ${host} port ${port} after ${elapsed()} ms: Timeout was reached`);
          }
          if (o.maxTime !== undefined) return fail(28, `Connection timed out after ${elapsed()} milliseconds`);
          say(`* connect to ${ip} port ${port} from ${srcFor(w.hosts[w.local], lookupRoute(w.hosts[w.local], ip)!) ?? ''} port ${c.sport} failed: Connection timed out`);
          return fail(28, `Failed to connect to ${host} port ${port} after ${elapsed()} ms: Couldn't connect to server`);
        }
        if (c.error === 'no-route') {
          say(`* Immediate connect fail for ${ip}: Network is unreachable`);
          return fail(7, `Failed to connect to ${host} port ${port} after ${elapsed()} ms: Couldn't connect to server`);
        }
        const route = lookupRoute(w.hosts[w.local], ip);
        say(`* connect to ${ip} port ${port} from ${route ? srcFor(w.hosts[w.local], route) : '127.0.0.1'} port ${c.sport} failed: ${connectErrText(c)}`);
        say(`* Failed to connect to ${host} port ${port} after ${elapsed()} ms: Could not connect to server`);
        return fail(7, `Failed to connect to ${host} port ${port} after ${elapsed()} ms: Couldn't connect to server`);
      }
      const tConn = (w.clock - t0) / 1000;
      let tApp = 0;
      const svc = c.service!;
      if (scheme === 'https') {
        say('* ALPN: curl offers h2,http/1.1');
        if (!svc.tls) {
          tcpData(w, w.local, ip, c.sport, port, 517, '');
          say('* TLSv1.3 (OUT), TLS handshake, Client hello (1):');
          return fail(35, 'TLS connect error: error:0A00010B:SSL routines::wrong version number');
        }
        tcpData(w, w.local, ip, c.sport, port, 517, '');
        say('* TLSv1.3 (OUT), TLS handshake, Client hello (1):');
        say(`*  CAfile: /etc/ssl/certs/ca-certificates.crt`);
        say(`*  CApath: /etc/ssl/certs`);
        tcpData(w, c.host!, c.seenSrc ?? "", port, c.sport, 2840, '');
        say('* TLSv1.3 (IN), TLS handshake, Server hello (2):');
        say('* TLSv1.3 (IN), TLS change cipher, Change cipher spec (1):');
        say('* TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):');
        say('* TLSv1.3 (IN), TLS handshake, Certificate (11):');
        const bad = o.insecure ? undefined : checkCert(svc.tls, host, w.clock);
        if (bad) {
          say(`* TLSv1.3 (OUT), TLS alert, ${bad === 'expired' ? 'certificate expired (557)' : bad === 'untrusted-chain' ? 'unknown CA (560)' : 'bad certificate (554)'}:`);
          const msg = CURL_TLS_MESSAGE[bad].replace('{host}', host);
          say(`* ${msg}`);
          say('* closing connection #0');
          const code = fail(60, msg);
          if (!o.silent || o.showErr)
            ctx.err('More details here: https://curl.se/docs/sslcerts.html\n\ncurl failed to verify the legitimacy of the server and therefore could not\nestablish a secure connection to it. To learn more about this situation and\nhow to fix it, please visit the webpage mentioned above.\n');
          return code;
        }
        say('* TLSv1.3 (IN), TLS handshake, CERT verify (15):');
        say('* TLSv1.3 (IN), TLS handshake, Finished (20):');
        say('* TLSv1.3 (OUT), TLS change cipher, Change cipher spec (1):');
        say('* TLSv1.3 (OUT), TLS handshake, Finished (20):');
        tcpData(w, w.local, ip, c.sport, port, 80, '');
        say('* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384 / X25519MLKEM768 / RSASSA-PSS');
        say('* ALPN: server accepted http/1.1');
        say('* Server certificate:');
        say(`*  subject: CN=${svc.tls.cn}`);
        say(`*  start date: ${certDate(svc.tls.notBefore)}`);
        say(`*  expire date: ${certDate(svc.tls.notAfter)}`);
        if (!o.insecure) say(`*  subjectAltName: host "${host}" matched cert's "${svc.tls.san.find((s) => s === host || s.startsWith('*.')) ?? svc.tls.san[0]}"`);
        say(`*  issuer: ${svc.tls.issuer.replace(/, /g, '; ')}`);
        say(o.insecure ? '*  SSL certificate verify result: unable to get local issuer certificate (20), continuing anyway.' : '*  SSL certificate verify ok.');
        tApp = (w.clock - t0) / 1000;
      }
      say(`* Connected to ${host} (${ip}) port ${port}`);
      say('* using HTTP/1.x');
      const method = o.method ?? (o.head ? 'HEAD' : o.data !== undefined ? 'POST' : 'GET');
      const hostHeader = o.headers.find((h) => /^host:/i.test(h))?.split(':').slice(1).join(':').trim() ?? (port === (scheme === 'https' ? 443 : 80) ? host : `${host}:${port}`);
      const reqHeaders: [string, string][] = [['Host', hostHeader], ['User-Agent', `curl/${CURL_VERSION}`], ['Accept', '*/*']];
      for (const h of o.headers) {
        const [k, ...v] = h.split(':');
        if (/^host$/i.test(k.trim())) continue;
        reqHeaders.push([k.trim(), v.join(':').trim()]);
      }
      if (o.data !== undefined) reqHeaders.push(['Content-Length', String(o.data.length)], ['Content-Type', 'application/x-www-form-urlencoded']);
      for (const line of [`${method} ${path} HTTP/1.1`, ...reqHeaders.map(([k, v]) => `${k}: ${v}`), '']) say(`> ${line}`);
      say('* Request completely sent off');
      tcpData(w, w.local, ip, c.sport, port, 80 + path.length, scheme === 'http' ? `HTTP: ${method} ${path} HTTP/1.1` : '');
      let res: HttpResponse;
      if (scheme === 'http' && svc.tls) {
        res = { status: 400, wait: 0, body: '<html>\r\n<head><title>400 The plain HTTP request was sent to HTTPS port</title></head>\r\n</html>\r\n', headers: [['Server', 'nginx/1.26.3'], ['Content-Type', 'text/html'], ['Connection', 'close']] };
      } else {
        const before = w.clock;
        res = serveHttp(w, st.io, c.host!, svc, { method, path, host: hostHeader, headers: reqHeaders, client: c.seenSrc ?? '' });
        if (o.maxTime !== undefined && w.clock - t0 > o.maxTime * 1000) {
          w.clock = t0 + o.maxTime * 1000;
          return fail(28, `Operation timed out after ${Math.round(o.maxTime * 1000 + 1)} milliseconds with 0 bytes received`);
        }
        void before;
      }
      const tStart = (w.clock - t0) / 1000;
      tcpData(w, c.host!, c.seenSrc ?? "", port, c.sport, res.body.length + 160, scheme === 'http' ? `HTTP: HTTP/1.1 ${res.status} ${REASONS[res.status] ?? ''}` : '');
      const statusLine = `HTTP/1.1 ${res.status} ${REASONS[res.status] ?? ''}`;
      for (const line of [statusLine, ...res.headers.map(([k, v]) => `${k}: ${v}`), '']) say(`< ${line}`);
      const body = method === 'HEAD' ? '' : res.body;
      if (o.verbose && body) say(`{ [${body.length} bytes data]`);
      say(`* Connection #0 to host ${host} left intact`);
      const tTotal = (w.clock - t0) / 1000 + 0.000204;
      const loc = res.headers.find(([k]) => k.toLowerCase() === 'location')?.[1];
      if (o.follow && loc && res.status >= 300 && res.status < 400 && !visited.has(loc)) {
        visited.add(url);
        say(`* Issue another request to this URL: '${loc}'`);
        url = loc;
        continue;
      }
      if (o.fail && res.status >= 400) {
        if (o.write) ctx.out(writeOut(o.write, { code: res.status, t: { namelookup: tName, connect: tConn, appconnect: tApp, starttransfer: tStart, total: tTotal }, ip, port, url, size: 0 }));
        return fail(22, `The requested URL returned error: ${res.status}`);
      }
      let printed = '';
      if (o.include || o.head) printed += `${statusLine}\r\n${res.headers.map(([k, v]) => `${k}: ${v}\r\n`).join('')}\r\n`;
      printed += body;
      if (o.out) {
        if (o.out !== '/dev/null') {
          try {
            ctx.fs.writeFile(o.out, printed);
          } catch {
            return fail(23, `client returned ERROR on write of ${printed.length} bytes`);
          }
        }
      } else ctx.out(printed);
      if (o.write) ctx.out(writeOut(o.write, { code: res.status, t: { namelookup: tName, connect: tConn, appconnect: tApp, starttransfer: tStart, total: tTotal }, ip, port, url, size: body.length }));
      return 0;
    }
    return fail(47, 'Maximum (5) redirects followed');
  },
};
