// Unit tests of netlab (src/engine/sim-net) and of the pure parts of the
// Networks block's explainers and widgets.

import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, stripAnsi, type SimMachine } from '../src/engine/terminal/shell';
import netMod from '../src/engine/sim-net/module';
import { addressKind, fmtIp, longestMatch, parseIp, prefixOfMask, subnetInfo } from '../src/engine/sim-net/ip';
import { buildPreset, rule } from '../src/engine/sim-net/presets';
import { cloneWorld, icmpEcho, tcpConnect, type World } from '../src/engine/sim-net/world';
import { authAnswer, parseResolvConf, recurse, stubResolve } from '../src/engine/sim-net/dns';
import { checkCert, nameMatches, parseNginx, serveHttp } from '../src/engine/sim-net/http';
import { compileFilter } from '../src/engine/sim-net/cmd-tools';
import { netOf } from '../src/engine/sim-net/state';
import { runProbe } from '../src/engine/sim-net/probe';
import { mapLatency } from '../src/blocks/networks/explainers/map';
import { proxyOutcome } from '../src/blocks/networks/explainers/proxy';
import { ttfbRtts } from '../src/blocks/networks/explainers/tcp';
import { buildPacket, inetChecksum, mtuOutcome, specFor } from '../src/blocks/networks/explainers/envelopes';
import { checkDrill, drillQuestion } from '../src/blocks/networks/widgets/subnet';
import { PROTOCOLS } from '../src/blocks/networks/widgets/protocols';
import { sequenceSvg } from '../src/blocks/networks/widgets/catalogue';
import type { TerminalSetup } from '../src/core/types';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS, ...(netMod.commands ?? [])]) reg.commands.add(c);
reg.setup.push(...(netMod.setup ?? []));
reg.facts.push(...(netMod.facts ?? []));

const lab = (hostname: string, preset: string, opts: Record<string, unknown> = {}, probes: unknown[] = []): TerminalSetup => ({ user: 'root', hostname, ext: { net: { preset, opts, probes } } });
const mk = (s: TerminalSetup) => createSimMachine(s, { registry: reg });
const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};
const world = (preset: string, opts: Record<string, unknown> = {}): World => buildPreset(preset, opts).world;

describe('IPv4 arithmetic', () => {
  it('parses, formats and classifies', () => {
    expect(fmtIp(parseIp('192.168.1.10'))).toBe('192.168.1.10');
    expect(() => parseIp('192.168.1.300')).toThrow();
    expect(addressKind('172.20.0.1')).toBe('private');
    expect(addressKind('172.32.1.1')).toBe('public');
    expect(addressKind('100.64.3.3')).toBe('cgnat');
    expect(addressKind('169.254.1.1')).toBe('link-local');
  });
  it('computes subnets, including /31 and /32', () => {
    const s = subnetInfo('192.168.10.37/26');
    expect([s.network, s.broadcast, s.firstHost, s.lastHost, s.hosts, s.mask]).toEqual(['192.168.10.0', '192.168.10.63', '192.168.10.1', '192.168.10.62', 62, '255.255.255.192']);
    expect(subnetInfo('10.0.0.0/31').hosts).toBe(2);
    expect(subnetInfo('10.0.0.7/32').hosts).toBe(1);
    expect(prefixOfMask('255.255.240.0')).toBe(20);
    expect(() => prefixOfMask('255.0.255.0')).toThrow();
  });
  it('picks the longest prefix, whatever the order', () => {
    const routes = [{ dst: 'default' }, { dst: '10.0.0.0/8' }, { dst: '10.20.0.0/16' }];
    expect(longestMatch(routes, '10.20.5.5')?.dst).toBe('10.20.0.0/16');
    expect(longestMatch(routes, '10.1.1.1')?.dst).toBe('10.0.0.0/8');
    expect(longestMatch(routes, '8.8.8.8')?.dst).toBe('default');
  });
});

describe('packets through routers', () => {
  it('a router decrements TTL; the answer shows how many routers were passed', () => {
    const w = world('two-subnets', { gw: true });
    const r = icmpEcho(w, 'h1', '10.0.2.10');
    expect(r.ok).toBe(true);
    expect(r.ttl).toBe(63);
  });
  it('no route on the sender: the packet is never born', () => {
    expect(icmpEcho(world('two-subnets'), 'h1', '10.0.2.10').noRoute).toBe(true);
  });
  it('no route back: the request arrives, the reply does not', () => {
    const w = world('two-subnets', { gw: true, noReturnRoute: true });
    const r = icmpEcho(w, 'h1', '10.0.2.10');
    expect(r.ok).toBe(false);
    expect(r.stage).toMatch(/^reply-/);
    expect(w.capture.some((p) => p.host === 'h2' && p.dir === 'in' && p.info.includes('echo request'))).toBe(true);
  });
  it('ip_forward off: the router swallows the packet silently', () => {
    const r = icmpEcho(world('two-subnets', { gw: true, forward: false }), 'h1', '10.0.2.10');
    expect(r.ok).toBe(false);
    expect(r.error).toBeUndefined();
  });
  it('TTL 1: the router answers Time to live exceeded', () => {
    const r = icmpEcho(world('two-subnets', { gw: true }), 'h1', '10.0.2.10', { ttl: 1 });
    expect(r.error).toEqual({ from: '10.0.1.1', text: 'Time to live exceeded' });
  });
  it('a neighbour that is off: ARP fails, the sender reports Destination Host Unreachable itself', () => {
    const w = world('lan', { cOff: true });
    const r = icmpEcho(w, 'a', '192.168.1.30');
    expect(r.error).toEqual({ from: '192.168.1.10', text: 'Destination Host Unreachable' });
    expect(w.hosts.a.neigh.find((n) => n.ip === '192.168.1.30')?.state).toBe('FAILED');
  });
});

describe('TCP', () => {
  it('closed port: RST, refused in one RTT', () => {
    const c = tcpConnect(world('tcp'), 'client', '10.0.0.2', 9000);
    expect(c).toMatchObject({ ok: false, error: 'refused' });
    expect(c.ms).toBeLessThan(5);
  });
  it('a DROP filter: SYN retried 1, 2, 4, 8, 16, 32 s, the kernel gives up after ~127 s', () => {
    const w = world('tcp');
    const c = tcpConnect(w, 'client', '10.0.0.2', 9100);
    expect(c).toMatchObject({ ok: false, error: 'timeout', ms: 127000, syns: 7 });
    expect(w.capture.filter((p) => p.host === 'client' && p.info.startsWith('Flags [S]')).length).toBe(7);
  });
  it('a caller timeout limits the wait', () => {
    expect(tcpConnect(world('tcp'), 'client', '10.0.0.2', 9100, { timeoutMs: 3000 }).ms).toBe(3000);
  });
  it('a service bound to 127.0.0.1 refuses from outside', () => {
    expect(tcpConnect(world('tcp'), 'client', '10.0.0.2', 6379).error).toBe('refused');
    expect(tcpConnect(world('tcp'), 'srv', '127.0.0.1', 6379).ok).toBe(true);
  });
});

describe('NAT and conntrack', () => {
  it('MASQUERADE rewrites the source and the reply comes back through conntrack', () => {
    const w = world('nat', { configured: true });
    const c = tcpConnect(w, 'app', '203.0.113.50', 80);
    expect(c.ok).toBe(true);
    expect(c.seenSrc).toBe('203.0.113.10');
    const entry = w.hosts.gw.conntrack.find((e) => e.nat === 'snat');
    expect(entry?.orig.src).toBe('10.0.2.20');
  });
  it('without NAT the private source gets no answer', () => {
    const w = world('nat');
    w.hosts.gw.ipForward = true;
    expect(tcpConnect(w, 'app', '203.0.113.50', 80, { timeoutMs: 2000 }).ok).toBe(false);
  });
  it('DNAT forwards a port inside and rewrites the reply’s source back', () => {
    const w = world('nat', { configured: true });
    w.hosts.gw.nf.nat.PREROUTING.rules.push(rule('DNAT', { inIf: 'eth1', proto: 'tcp', dport: 80, toDest: '10.0.2.20:8080' }));
    const c = tcpConnect(w, 'ext', '203.0.113.10', 80);
    expect(c.ok).toBe(true);
    expect(c.host).toBe('app');
    expect(w.capture.some((p) => p.host === 'ext' && p.dir === 'in' && p.src === '203.0.113.10' && p.sport === 80)).toBe(true);
  });
  it('a stateful filter passes replies to our own connections', () => {
    const w = world('two-subnets', { gw: true });
    const h1 = w.hosts.h1;
    h1.nf.filter.INPUT.policy = 'DROP';
    expect(icmpEcho(w, 'h1', '10.0.2.10').ok).toBe(false);
    h1.nf.filter.INPUT.rules.push(rule('ACCEPT', { state: ['ESTABLISHED', 'RELATED'] }));
    expect(icmpEcho(w, 'h1', '10.0.2.10').ok).toBe(true);
  });
});

describe('DNS', () => {
  it('walks root → TLD → authoritative with QNAME minimisation and caches by TTL', () => {
    const w = world('home');
    const srv = w.hosts.resolver.services.find((s) => s.kind === 'dns')!.dns!;
    const r = recurse(w, undefined, 'resolver', srv, 'shop.example', 'A');
    expect(r.answer.answer[0].data).toBe('198.51.100.20');
    expect(r.steps.map((s) => [s.qname, s.result])).toEqual([
      ['example.', 'referral'],
      ['shop.example.', 'referral'],
      ['shop.example.', 'answer'],
    ]);
    const again = recurse(w, undefined, 'resolver', srv, 'shop.example', 'A');
    expect(again.fromCache).toBe(true);
    w.clock += 301_000;
    expect(recurse(w, undefined, 'resolver', srv, 'shop.example', 'A').fromCache).toBe(false);
  });
  it('a typo in the TLD gets NXDOMAIN from the root; a dead authoritative server gives SERVFAIL', () => {
    const w = world('home');
    const srv = w.hosts.resolver.services.find((s) => s.kind === 'dns')!.dns!;
    const nx = recurse(w, undefined, 'resolver', srv, 'shop.exmaple', 'A');
    expect(nx.answer.rcode).toBe('NXDOMAIN');
    expect(nx.steps).toHaveLength(1);
    const down = world('home', { authDown: true });
    const srv2 = down.hosts.resolver.services.find((s) => s.kind === 'dns')!.dns!;
    expect(recurse(down, undefined, 'resolver', srv2, 'shop.example', 'A').answer.rcode).toBe('SERVFAIL');
  });
  it('an authoritative server answers CNAME chains and referrals', () => {
    const w = world('home');
    const tld = w.hosts.tld.services.find((s) => s.kind === 'dns')!.dns!;
    const ref = authAnswer(tld, 'shop.example', 'A');
    expect(ref.authority[0]).toMatchObject({ type: 'NS', data: 'ns1.hosting.example.' });
    expect(ref.additional[0].data).toBe('198.51.100.53');
    const auth = w.hosts.ns1.services.find((s) => s.kind === 'dns')!.dns!;
    expect(authAnswer(auth, 'www.shop.example', 'A').answer.map((r) => r.type)).toEqual(['CNAME', 'A']);
  });
  it('the stub reads /etc/hosts first and applies search and ndots', () => {
    const w = world('tcp');
    const files: Record<string, string> = { '/etc/hosts': '10.0.0.9 cache.lab\n', '/etc/resolv.conf': 'nameserver 10.0.0.2\nsearch lab\noptions ndots:2\n' };
    const io = { read: (p: string) => files[p], append: () => {} };
    expect(stubResolve(w, io, 'client', 'cache.lab').via).toBe('hosts');
    const r = stubResolve(w, io, 'client', 'srv');
    expect(r.addr).toBe('10.0.0.2');
    expect(r.tried).toEqual(['srv.lab']);
    expect(parseResolvConf('search a.lab lab\noptions ndots:5\nnameserver 1.1.1.1').ndots).toBe(5);
  });
});

describe('nginx model', () => {
  const opts = { db: 75, read: 60, backends: '2', next: true, method: 'GET' };
  it('slow upstream: 504 after 2 × proxy_read_timeout, one error.log line per attempt', () => {
    const o = proxyOutcome(opts, new Set());
    expect(o.status).toBe(504);
    expect(o.waited).toBe(120);
    expect(o.lines).toHaveLength(2);
    expect(o.lines[0]).toContain('upstream timed out (110: Connection timed out) while reading response header from upstream');
    expect(o.lines[0]).toContain('upstream: "http://10.0.2.21:8080/report"');
    expect(o.lines[1]).toContain('10.0.2.22:8080');
  });
  it('one backend, proxy_next_upstream off or POST: a single attempt, 60 s', () => {
    expect(proxyOutcome({ ...opts, backends: '1' }, new Set())).toMatchObject({ status: 504, waited: 60 });
    expect(proxyOutcome({ ...opts, next: false }, new Set()).lines).toHaveLength(1);
    expect(proxyOutcome({ ...opts, method: 'POST' }, new Set()).lines).toHaveLength(1);
  });
  it('a longer timeout lets the answer through', () => {
    expect(proxyOutcome({ ...opts, read: 90 }, new Set()).status).toBe(200);
  });
  it('a crashed backend: refused, retried on the next, the client gets 200 (or 502 without retries)', () => {
    const o = proxyOutcome({ ...opts, db: 2 }, new Set(['app1-down']));
    expect(o.status).toBe(200);
    expect(o.lines[0]).toContain('connect() failed (111: Connection refused) while connecting to upstream');
    expect(proxyOutcome({ ...opts, db: 2, next: false }, new Set(['app1-down'])).status).toBe(502);
  });
  it('a filter that drops packets: timeout while connecting', () => {
    const o = proxyOutcome({ ...opts, db: 2 }, new Set(['drop']));
    expect(o.lines[0]).toContain('upstream timed out (110: Connection timed out) while connecting to upstream');
    expect(o.status).toBe(200);
  });
  it('a 500 from a backend is passed through without a retry', () => {
    const o = proxyOutcome({ ...opts, db: 2, backends: '2' }, new Set(['app2-500', 'app1-down']));
    expect(o.status).toBe(500);
  });
  it('directives are inherited regardless of their position in the file', () => {
    const c = parseNginx('upstream b { server 10.0.0.1:80; }\nserver { listen 80; location / { proxy_pass http://b; } }\nproxy_read_timeout 90s;\n');
    expect(c.errors).toEqual([]);
    expect(c.servers[0].locations[0].readTimeout).toBe(90);
    expect(c.servers[0].locations[0].nextUpstream).toEqual(['error', 'timeout']);
  });
  it('nginx -t style errors', () => {
    expect(parseNginx('server { listen 80; proxy_reed_timeout 5s; }', 'x.conf').errors[0]).toBe('unknown directive "proxy_reed_timeout" in x.conf:1');
    expect(parseNginx('server { listen 80;', 'x.conf').errors[0]).toMatch(/unexpected end of file, expecting "}"/);
  });
  it('a single upstream server is never marked down (max_fails is ignored)', () => {
    const b = buildPreset('proxy', { wrongPort: true });
    b.world.local = 'client';
    b.world.hosts.lb.files = b.files;
    const svc = b.world.hosts.lb.services.find((s) => s.kind === 'nginx')!;
    serveHttp(b.world, undefined, 'lb', svc, { method: 'GET', path: '/', host: 'shop.lab', headers: [], client: '10.0.0.5' });
    expect(svc.nginx!.failedUntil ?? {}).toEqual({});
  });
});

describe('TLS certificate checks', () => {
  it('names, wildcards and dates', () => {
    expect(nameMatches('*.cdn.example', 'edge.cdn.example')).toBe(true);
    expect(nameMatches('*.cdn.example', 'a.b.cdn.example')).toBe(false);
    const cert = { cn: 'x', san: ['www.x.example'], issuer: 'CA', notBefore: '2026-01-01T00:00:00Z', notAfter: '2026-12-01T00:00:00Z', chain: 'ok' as const };
    expect(checkCert(cert, 'x.example')).toBe('name-mismatch');
    expect(checkCert({ ...cert, notAfter: '2026-01-02T00:00:00Z' }, 'www.x.example')).toBe('expired');
    expect(checkCert({ ...cert, chain: 'incomplete' }, 'www.x.example')).toBe('untrusted-chain');
    expect(checkCert(cert, 'www.x.example')).toBeUndefined();
  });
});

describe('commands', () => {
  it('ip a, ip r, ip route add with a gateway check', async () => {
    const m = await mk(lab('h1', 'two-subnets'));
    expect((await run(m, 'ip -br a')).out).toMatch(/^eth0\s+UP\s+10\.0\.1\.10\/24 fe80::/m);
    expect((await run(m, 'ip route add default via 10.0.2.1')).out).toBe('Error: Nexthop has invalid gateway.\n');
    expect((await run(m, 'ip route add default via 10.0.1.1')).exit).toBe(0);
    expect((await run(m, 'ip r')).out).toBe('default via 10.0.1.1 dev eth0 proto static\n10.0.1.0/24 dev eth0 proto kernel scope link src 10.0.1.10\n');
    expect((await run(m, 'ip route add default via 10.0.1.1')).out).toBe('RTNETLINK answers: File exists\n');
  });
  it('a regular user cannot change routes', async () => {
    const m = await mk({ ...lab('h1', 'two-subnets'), user: 'learner' });
    expect((await run(m, 'ip route add default via 10.0.1.1')).out).toBe('RTNETLINK answers: Operation not permitted\n');
  });
  it('ping prints the iputils format and statistics', async () => {
    const m = await mk(lab('h1', 'two-subnets', { gw: true }));
    const r = await run(m, 'ping -c 2 10.0.2.10');
    expect(r.out).toMatch(/^PING 10\.0\.2\.10 \(10\.0\.2\.10\) 56\(84\) bytes of data\.\n64 bytes from 10\.0\.2\.10: icmp_seq=1 ttl=63 time=/);
    expect(r.out).toContain('2 packets transmitted, 2 received, 0% packet loss');
    expect((await run(m, 'ping -c 1 no.such.lab')).out).toBe('ping: no.such.lab: Temporary failure in name resolution\n');
  });
  it('curl error messages follow curl 8', async () => {
    const m = await mk(lab('client', 'tcp'));
    expect((await run(m, 'curl http://10.0.0.2:9000/')).out).toMatch(/^curl: \(7\) Failed to connect to 10\.0\.0\.2 port 9000 after \d+ ms: Couldn't connect to server\n$/);
    expect((await run(m, 'curl --connect-timeout 2 http://10.0.0.2:9100/')).out).toBe('curl: (28) Failed to connect to 10.0.0.2 port 9100 after 2000 ms: Timeout was reached\n');
    expect((await run(m, "curl -s -o /dev/null -w '%{http_code}' http://10.0.0.2:8080/")).out).toBe('200');
  });
  it('curl reports TLS problems with code 60 and the curl text', async () => {
    const m = await mk(lab('laptop', 'home'));
    const r = await run(m, 'curl -s https://expired.example/');
    expect(r.exit).toBe(60);
    expect((await run(m, 'curl -sS https://wrong.example/')).out).toContain("curl: (60) SSL: no alternative certificate subject name matches target host name 'wrong.example'");
    expect((await run(m, 'curl -s https://shop.example/catalog')).out).toContain('<h1>Catalog</h1>');
    expect((await run(m, 'curl -sI http://shop.example/catalog')).out).toMatch(/^HTTP\/1\.1 301 Moved Permanently\r\n[\s\S]*Location: https:\/\/shop\.example\/catalog\r\n/);
  });
  it('dig +short, +noall +answer and the NXDOMAIN status', async () => {
    const m = await mk(lab('laptop', 'home'));
    expect((await run(m, 'dig +short shop.example')).out).toBe('198.51.100.20\n');
    expect((await run(m, 'dig +noall +answer shop.example')).out).toMatch(/^shop\.example\.\t+\d+\tIN\tA\t198\.51\.100\.20\n$/);
    expect((await run(m, 'dig shop.exmaple')).out).toContain('status: NXDOMAIN');
    expect((await run(m, 'dig -x 1.1.1.1')).out).toContain('netlab: dig -x: this option is not simulated here');
  });
  it('tcpdump shows only new packets of the local host and filters them', async () => {
    const m = await mk(lab('a', 'lan'));
    await run(m, 'ping -c 1 192.168.1.20');
    const r = await run(m, 'tcpdump -n arp');
    expect(r.out).toContain('ARP, Request who-has 192.168.1.20 tell 192.168.1.10, length 28');
    expect(r.out).not.toContain('ICMP');
    expect((await run(m, 'tcpdump -n')).out).toContain('0 packets captured');
  });
  it('iptables: rule syntax, listing and target placement errors', async () => {
    const m = await mk(lab('gw', 'nat'));
    expect((await run(m, 'iptables -A INPUT -p tcp --dport 22 -j ACCEPT')).exit).toBe(0);
    expect((await run(m, 'iptables -S INPUT')).out).toBe('-P INPUT ACCEPT\n-A INPUT -p tcp -m tcp --dport 22 -j ACCEPT\n');
    expect((await run(m, 'iptables -t nat -A POSTROUTING -p tcp --dport 80 -j DNAT --to-destination 10.0.2.20')).out).toContain('DNAT is only valid in the PREROUTING and OUTPUT chains');
    expect((await run(m, 'iptables -A FORWARD -j MASQUERADE')).out).toContain('hint: did you mean -t nat?');
  });
  it('dhcpcd takes the first offer; with no server it falls back to 169.254', async () => {
    const m = await mk(lab('laptop', 'home', { noAddr: true, dhcp: 'rogue' }));
    expect((await run(m, 'dhcpcd eth0')).out).toContain('offered 192.168.1.');
    expect((await run(m, 'cat /etc/resolv.conf')).out).toContain('nameserver 192.168.1.250');
    const n = await mk(lab('laptop', 'home', { noAddr: true, dhcp: 'off' }));
    expect((await run(n, 'dhcpcd eth0')).out).toMatch(/using IPv4LL address 169\.254\.\d+\.\d+/);
  });
  it('nginx -t and -s reload switch the running configuration', async () => {
    const m = await mk(lab('lb', 'proxy', {}, [{ id: 'r', kind: 'http', from: 'client', to: 'http://10.0.0.1/report' }]));
    expect(((await m.facts()).reach as Record<string, { status: number }>).r.status).toBe(504);
    await run(m, "echo 'proxy_read_timeout 90s;' >> /etc/nginx/conf.d/shop.conf");
    expect((await run(m, 'nginx -t')).out).toContain('test is successful');
    expect(((await m.facts()).reach as Record<string, { status: number }>).r.status).toBe(504);
    await run(m, 'nginx -s reload');
    expect(((await m.facts()).reach as Record<string, { status: number }>).r.status).toBe(200);
  });
  it('sysctl reads and writes ip_forward; only root may write', async () => {
    const m = await mk(lab('gw', 'nat'));
    expect((await run(m, 'sysctl net.ipv4.ip_forward')).out).toBe('net.ipv4.ip_forward = 0\n');
    expect((await run(m, 'sysctl -w net.ipv4.ip_forward=1')).out).toBe('net.ipv4.ip_forward = 1\n');
    expect(((await m.facts()).net as { sysctl: Record<string, number> }).sysctl['net.ipv4.ip_forward']).toBe(1);
    const u = await mk({ ...lab('gw', 'nat'), user: 'learner' });
    expect((await run(u, 'sysctl -w net.ipv4.ip_forward=1')).out).toBe('sysctl: permission denied on key "net.ipv4.ip_forward"\n');
  });
  it('a machine without a network lab still has eth0 and a gateway with no way out', async () => {
    const m = await createSimMachine({ hostname: 'box' }, { registry: reg });
    expect((await run(m, 'ip -br a')).out).toContain('10.0.2.15/24');
    expect((await run(m, 'ping -c 1 1.1.1.1')).out).toContain('From 10.0.2.2 icmp_seq=1 Destination Net Unreachable');
  });
});

describe('probes and snapshots', () => {
  it('a probe runs on a copy of the world', async () => {
    const m = await mk(lab('h1', 'two-subnets', { gw: true }));
    const st = netOf(m);
    const before = JSON.stringify(st.world);
    expect(runProbe(st.world, st, { id: 'p', kind: 'icmp', to: '10.0.2.10' }).received).toBe(3);
    expect(JSON.stringify(st.world)).toBe(before);
  });
  it('the network survives a machine snapshot and restore', async () => {
    const m = await mk(lab('h1', 'two-subnets'));
    const snap = await m.snapshot();
    await run(m, 'ip route add default via 10.0.1.1');
    expect((await run(m, 'ip r')).out).toContain('default via 10.0.1.1');
    await m.restore(snap);
    expect((await run(m, 'ip r')).out).not.toContain('default');
  });
  it('cloneWorld is deep', () => {
    const w = world('lan');
    const c = cloneWorld(w);
    c.hosts.a.ifaces[1].addrs = [];
    expect(w.hosts.a.ifaces[1].addrs).toEqual(['192.168.1.10/24']);
  });
});

describe('pcap-style filters', () => {
  const p = (o: Partial<Parameters<ReturnType<typeof compileFilter>>[0]>) => ({ t: 0, host: 'h', iface: 'eth0', dir: 'out' as const, srcMac: '', dstMac: '', l3: 'ip' as const, src: '10.0.0.1', dst: '10.0.0.2', info: '', len: 60, ...o });
  it('host, port, protocol, and/or/not, parentheses', () => {
    expect(compileFilter(['tcp', 'port', '80'])(p({ proto: 'tcp', dport: 80, sport: 5000 }))).toBe(true);
    expect(compileFilter(['host', '10.0.0.9'])(p({ proto: 'udp' }))).toBe(false);
    expect(compileFilter(['not', 'arp'])(p({ l3: 'arp' }))).toBe(false);
    expect(compileFilter(['(', 'port', '67', 'or', 'port', '68', ')', 'and', 'udp'])(p({ proto: 'udp', sport: 68, dport: 67 }))).toBe(true);
    expect(() => compileFilter(['port'])).toThrow();
  });
});

describe('explainer arithmetic', () => {
  it('E-MAP: 5 µs per km, IXP versus transit', () => {
    expect(mapLatency({ cgnat: false, ixp: true, cdn: false, distance: 2000 }).cable).toBe(10);
    expect(mapLatency({ cgnat: false, ixp: false, cdn: false, distance: 2000 }).rtt).toBeGreaterThan(mapLatency({ cgnat: false, ixp: true, cdn: false, distance: 2000 }).rtt);
  });
  it('E-TLS: round trips to the first byte', () => {
    expect(ttfbRtts({ rtt: 40, version: '1.3', reuse: false })).toBe(3);
    expect(ttfbRtts({ rtt: 40, version: '1.2', reuse: false })).toBe(4);
    expect(ttfbRtts({ rtt: 40, version: '1.3', reuse: true })).toBe(1);
  });
  it('E-ENV: real headers with valid checksums; a router changes only MAC, TTL and the IP checksum', () => {
    const layers = buildPacket(specFor('none').spec);
    const ip = layers.find((l) => l.id === 'ip')!;
    expect(ip.bytes).toHaveLength(20);
    expect(inetChecksum(ip.bytes)).toBe(0);
    expect(layers.find((l) => l.id === 'tcp')!.bytes).toHaveLength(20);
    expect(layers.find((l) => l.id === 'http')!.bytes).toHaveLength(45);
    const r = specFor('router');
    expect([...r.changed].sort()).toEqual(['eth.dst', 'eth.src', 'ip.sum', 'ip.ttl']);
    expect(inetChecksum(buildPacket(specFor('nat').spec).find((l) => l.id === 'ip')!.bytes)).toBe(0);
  });
  it('E-ENV: MTU with and without DF', () => {
    expect(mtuOutcome(1460, true).fits).toBe(true);
    expect(mtuOutcome(1461, true)).toMatchObject({ fits: false, icmp: true });
    expect(mtuOutcome(2000, false)).toMatchObject({ fits: false, fragments: 2 });
  });
});

describe('subnet drill', () => {
  it('is deterministic and checks answers by meaning', () => {
    for (let seed = 1; seed < 60; seed++) {
      const q = drillQuestion(seed);
      expect(drillQuestion(seed)).toEqual(q);
      const right = q.kind === 'same' ? (q.answer === 'yes' ? 'да' : 'no') : q.answer;
      expect(checkDrill(q, right)).toBe(true);
      expect(checkDrill(q, '999')).toBe(false);
    }
  });
});

describe('protocol catalogue', () => {
  it('every card has an exchange, something to observe and at least two breaks with a layer', () => {
    expect(PROTOCOLS.length).toBeGreaterThanOrEqual(21);
    for (const c of PROTOCOLS) {
      expect(c.steps.length, c.id).toBeGreaterThan(0);
      expect(c.observe.length, c.id).toBeGreaterThan(0);
      expect(c.breaks.length, c.id).toBeGreaterThanOrEqual(2);
      for (const s of c.steps) expect(c.actors[s.from] && c.actors[s.to], c.id).toBeTruthy();
      expect(c.doc.url).toMatch(/^https:\/\//);
    }
    expect(new Set(PROTOCOLS.map((c) => c.level))).toEqual(new Set(['beginner', 'intermediate', 'experienced']));
  });
});

export { sequenceSvg };
