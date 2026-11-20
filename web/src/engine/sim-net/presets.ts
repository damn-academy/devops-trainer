// Lab topologies of the Networks block (03 §8.4.1). A lesson names a preset
// and its options in TerminalSetup.ext.net; the setup hook builds the world
// and writes the local host's files (/etc/hosts, /etc/resolv.conf, nginx) into
// the machine's file system. Addresses come from the documentation ranges
// (RFC 5737: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24; RFC 2544
// 198.18.0.0/15 for backbone links), private ranges (RFC 1918), the CGNAT range
// (RFC 6598) and the reserved TLD .example (RFC 2606), so nothing collides with
// real networks — except a.root-servers.net, whose real address is used on purpose.

import { COURSE_DATE, emptyNf, type Cert, type DnsRR, type DnsZone, type Host, type NfRule, type Route, type Segment, type Service, type World } from './world';

export interface Built {
  world: World;
  /** Files of the local host, written into its VFS by the setup hook. */
  files: Record<string, string>;
}

class Builder {
  w: World;
  private mac = 0x10;
  constructor(local: string) {
    this.w = { hosts: {}, segs: {}, clock: COURSE_DATE, capture: [], local, counter: 40 };
  }
  seg(id: string, latency: number, kind: Segment['kind'] = 'lan'): this {
    this.w.segs[id] = { id, latency, kind };
    return this;
  }
  host(id: string, o: { name?: string; role?: string; forward?: boolean } = {}): Host {
    const h: Host = {
      id,
      name: o.name ?? id,
      role: o.role,
      ifaces: [{ name: 'lo', mac: '00:00:00:00:00:00', addrs: ['127.0.0.1/8'], up: true, mtu: 65536 }],
      routes: [],
      neigh: [],
      ipForward: !!o.forward,
      nf: emptyNf(),
      conntrack: [],
      services: [],
      files: {},
    };
    this.w.hosts[id] = h;
    return h;
  }
  nic(h: Host, name: string, seg: string, addrs: string[] = [], mac?: string): this {
    const m = mac ?? `02:00:00:00:${(this.mac >> 8).toString(16).padStart(2, '0')}:${(this.mac & 255).toString(16).padStart(2, '0')}`;
    this.mac++;
    h.ifaces.push({ name, mac: m, addrs, up: true, mtu: 1500, seg });
    return this;
  }
  route(h: Host, dst: string, via: string | undefined, dev: string, proto: Route['proto'] = 'static'): this {
    h.routes.push({ dst, via, dev, proto });
    return this;
  }
  svc(h: Host, s: Omit<Service, 'pid'> & { pid?: number }): Service {
    const full = { pid: 300 + (h.services.length + 1) * 37 + Object.keys(this.w.hosts).length * 3, ...s } as Service;
    h.services.push(full);
    return full;
  }
}

export function rule(target: string, o: Partial<NfRule> = {}): NfRule {
  return { target, pkts: 0, bytes: 0, ...o };
}

const rr = (name: string, type: string, data: string, ttl = 300): DnsRR => ({ name, type, ttl, data });
const soa = (zone: string, ns: string, min = 300): DnsRR => rr(zone, 'SOA', `${ns} hostmaster.${zone === '.' ? '' : zone} 2026111801 7200 3600 1209600 ${min}`, 3600);

const cert = (cn: string, san: string[], o: Partial<Cert> = {}): Cert => ({
  cn,
  san,
  issuer: 'C=XX, O=Trainer Lab CA, CN=Trainer Lab Intermediate R1',
  notBefore: '2026-09-01T00:00:00Z',
  notAfter: '2026-12-30T23:59:59Z',
  chain: 'ok',
  ...o,
});

export const ROOT_IP = '198.41.0.4';

// ── home: laptop → home router → ISP → backbone → data centre, and DNS ──────

export interface HomeOpts {
  /** Which host the terminal is on (default laptop). */
  local?: 'laptop' | 'router';
  /** The laptop has no address (DHCP lessons). */
  noAddr?: boolean;
  /** The laptop has an address but no default route. */
  noDefaultRoute?: boolean;
  /** Text of the laptop's /etc/resolv.conf. */
  resolv?: string;
  /** Extra lines of the laptop's /etc/hosts. */
  hosts?: string;
  /** The ISP puts the home router behind carrier-grade NAT (100.64.0.0/10). */
  cgnat?: boolean;
  /** DHCP on the home network: the router's server, plus a rogue one, or none. */
  dhcp?: 'ok' | 'rogue' | 'off';
  /** The authoritative server of the hosting provider is down. */
  authDown?: boolean;
  /** The data-centre firewall drops TCP 443. */
  drop443?: boolean;
  /** The shop's TTL in seconds (default 300). */
  ttl?: number;
}

export function home(o: HomeOpts = {}): Built {
  const b = new Builder(o.local ?? 'laptop');
  b.seg('home', 1, 'wifi').seg('wan', 4, 'wan').seg('core1', 8, 'core').seg('core2', 6, 'core').seg('rootnet', 3, 'core').seg('tldnet', 4, 'core').seg('dc', 0.2, 'lan').seg('pub', 2, 'core');
  const wanAddr = o.cgnat ? '100.64.12.7/10' : '203.0.113.7/24';
  const wanGw = o.cgnat ? '100.64.0.1' : '203.0.113.1';

  const laptop = b.host('laptop', { name: 'laptop', role: 'client' });
  b.nic(laptop, 'eth0', 'home', o.noAddr ? [] : ['192.168.1.23/24'], '3c:22:fb:12:34:56');
  if (!o.noAddr && !o.noDefaultRoute) b.route(laptop, 'default', '192.168.1.1', 'eth0', 'dhcp');

  const router = b.host('router', { name: 'home-router', role: 'router', forward: true });
  b.nic(router, 'eth0', 'home', ['192.168.1.1/24'], 'a0:63:91:00:00:01').nic(router, 'wan0', 'wan', [wanAddr], 'a0:63:91:00:00:02');
  b.route(router, 'default', wanGw, 'wan0', 'dhcp');
  router.nf.nat.POSTROUTING.rules.push(rule('MASQUERADE', { outIf: 'wan0' }));
  b.svc(router, { proto: 'udp', port: 53, bind: '0.0.0.0', proc: 'dnsmasq', kind: 'dns', dns: { mode: 'forward', upstream: ['203.0.113.53'], zones: [{ origin: 'lan.', records: [soa('lan.', 'home-router.lan.'), rr('home-router.lan.', 'A', '192.168.1.1', 0), rr('laptop.lan.', 'A', '192.168.1.23', 0)] }] } });
  b.svc(router, { proto: 'tcp', port: 53, bind: '0.0.0.0', proc: 'dnsmasq', kind: 'dns', dns: { mode: 'forward', upstream: ['203.0.113.53'] } });
  b.svc(router, { proto: 'tcp', port: 80, bind: '192.168.1.1', proc: 'lighttpd', kind: 'http', http: { server: 'lighttpd/1.4.79', routes: { '/': { status: 200, body: '<!doctype html><title>Home router</title>\n' } } } });
  if (o.dhcp !== 'off') b.svc(router, { proto: 'udp', port: 67, bind: '0.0.0.0', proc: 'dnsmasq', kind: 'dhcp', dhcp: { pool: ['192.168.1.100', '192.168.1.199'], mask: 24, router: '192.168.1.1', dns: ['192.168.1.1'], lease: 86400, delay: 4 } });
  if (o.dhcp === 'rogue') {
    const rogue = b.host('rogue', { name: 'old-router', role: 'router' });
    b.nic(rogue, 'eth0', 'home', ['192.168.1.250/24'], 'b8:27:eb:00:00:fa');
    b.svc(rogue, { proto: 'udp', port: 67, bind: '0.0.0.0', proc: 'udhcpd', kind: 'dhcp', dhcp: { pool: ['192.168.1.20', '192.168.1.40'], mask: 24, router: '192.168.1.250', dns: ['192.168.1.250'], lease: 3600, delay: 1 } });
  }

  const isp = b.host('isp', { name: 'bras1.isp.example', role: 'isp', forward: true });
  b.nic(isp, 'eth0', 'wan', ['203.0.113.1/24', '100.64.0.1/10']).nic(isp, 'eth1', 'core1', ['198.18.0.1/30']);
  b.route(isp, 'default', '198.18.0.2', 'eth1');
  if (o.cgnat) isp.nf.nat.POSTROUTING.rules.push(rule('SNAT', { src: '100.64.0.0/10', outIf: 'eth1', toSrc: '203.0.113.200' }));

  const resolver = b.host('resolver', { name: 'resolver1.isp.example', role: 'resolver' });
  b.nic(resolver, 'eth0', 'wan', ['203.0.113.53/24']);
  b.route(resolver, 'default', '203.0.113.1', 'eth0');
  b.svc(resolver, { proto: 'udp', port: 53, bind: '0.0.0.0', proc: 'unbound', kind: 'dns', dns: { mode: 'recursive', upstream: [ROOT_IP], qnameMin: true } });

  const ix = b.host('ix', { name: 'core1.backbone.example', role: 'backbone', forward: true });
  b.nic(ix, 'eth0', 'core1', ['198.18.0.2/30']).nic(ix, 'eth1', 'rootnet', ['198.41.0.1/24']).nic(ix, 'eth2', 'tldnet', ['192.0.2.1/24']).nic(ix, 'eth3', 'core2', ['198.18.1.1/30']).nic(ix, 'eth4', 'pub', ['1.1.1.254/24']);
  b.route(ix, '203.0.113.0/24', '198.18.0.1', 'eth0').route(ix, '100.64.0.0/10', '198.18.0.1', 'eth0').route(ix, '198.51.100.0/24', '198.18.1.2', 'eth3');

  const root = b.host('root', { name: 'a.root-servers.net', role: 'dns-root' });
  b.nic(root, 'eth0', 'rootnet', [`${ROOT_IP}/24`]);
  b.route(root, 'default', '198.41.0.1', 'eth0');
  const rootZone: DnsZone = {
    origin: '.',
    negTtl: 86400,
    records: [soa('.', 'a.root-servers.net.', 86400), rr('.', 'NS', 'a.root-servers.net.', 518400), rr('a.root-servers.net.', 'A', ROOT_IP, 518400), rr('example.', 'NS', 'a.nic.example.', 172800), rr('a.nic.example.', 'A', '192.0.2.53', 172800)],
  };
  b.svc(root, { proto: 'udp', port: 53, bind: '0.0.0.0', proc: 'nsd', kind: 'dns', dns: { mode: 'auth', zones: [rootZone] } });

  const tld = b.host('tld', { name: 'a.nic.example', role: 'dns-tld' });
  b.nic(tld, 'eth0', 'tldnet', ['192.0.2.53/24']);
  b.route(tld, 'default', '192.0.2.1', 'eth0');
  const hosted = ['shop.example.', 'expired.example.', 'wrong.example.', 'chain.example.', 'selfsigned.example.', 'hosting.example.', 'cdn.example.'];
  const tldZone: DnsZone = {
    origin: 'example.',
    negTtl: 900,
    records: [soa('example.', 'a.nic.example.', 900), rr('example.', 'NS', 'a.nic.example.', 172800), rr('a.nic.example.', 'A', '192.0.2.53', 172800), ...hosted.map((z) => rr(z, 'NS', 'ns1.hosting.example.', 86400)), rr('ns1.hosting.example.', 'A', '198.51.100.53', 86400)],
  };
  b.svc(tld, { proto: 'udp', port: 53, bind: '0.0.0.0', proc: 'nsd', kind: 'dns', dns: { mode: 'auth', zones: [tldZone] } });

  const edge = b.host('dcedge', { name: 'edge1.dc.example', role: 'dc-edge', forward: true });
  b.nic(edge, 'eth0', 'core2', ['198.18.1.2/30']).nic(edge, 'eth1', 'dc', ['198.51.100.1/24']);
  b.route(edge, 'default', '198.18.1.1', 'eth0');
  if (o.drop443) edge.nf.filter.FORWARD.rules.push(rule('DROP', { proto: 'tcp', dst: '198.51.100.20', dport: 443 }));

  const ttl = o.ttl ?? 300;
  const ns1 = b.host('ns1', { name: 'ns1.hosting.example', role: 'dns-auth' });
  b.nic(ns1, 'eth0', 'dc', ['198.51.100.53/24']);
  b.route(ns1, 'default', '198.51.100.1', 'eth0');
  const z = (origin: string, recs: DnsRR[]): DnsZone => ({ origin, negTtl: 300, records: [soa(origin, 'ns1.hosting.example.'), rr(origin, 'NS', 'ns1.hosting.example.', 86400), ...recs] });
  const zones = [
    z('shop.example.', [rr('shop.example.', 'A', '198.51.100.20', ttl), rr('www.shop.example.', 'CNAME', 'shop.example.', ttl), rr('shop.example.', 'MX', '10 mail.shop.example.', 3600), rr('mail.shop.example.', 'A', '198.51.100.25', 3600), rr('shop.example.', 'TXT', '"v=spf1 mx -all"', 3600), rr('static.shop.example.', 'CNAME', 'edge.cdn.example.', 3600)]),
    z('expired.example.', [rr('expired.example.', 'A', '198.51.100.21')]),
    z('wrong.example.', [rr('wrong.example.', 'A', '198.51.100.22'), rr('www.wrong.example.', 'A', '198.51.100.22')]),
    z('selfsigned.example.', [rr('selfsigned.example.', 'A', '198.51.100.24')]),
    z('chain.example.', [rr('chain.example.', 'A', '198.51.100.23')]),
    z('hosting.example.', [rr('ns1.hosting.example.', 'A', '198.51.100.53', 86400)]),
    z('cdn.example.', [rr('edge.cdn.example.', 'A', '198.51.100.30', 60)]),
  ];
  const auth = b.svc(ns1, { proto: 'udp', port: 53, bind: '0.0.0.0', proc: 'nsd', kind: 'dns', dns: { mode: 'auth', zones } });
  if (o.authDown) auth.down = true;

  const web = b.host('web', { name: 'web1.hosting.example', role: 'web' });
  b.nic(web, 'eth0', 'dc', ['198.51.100.20/24', '198.51.100.21/24', '198.51.100.22/24', '198.51.100.23/24', '198.51.100.24/24', '198.51.100.30/24']);
  b.route(web, 'default', '198.51.100.1', 'eth0');
  const page = '<!doctype html>\n<html lang="en"><title>Shop</title><link rel="stylesheet" href="/static/app.css"><h1>Catalog</h1></html>\n';
  const shopRoutes = { '/': { status: 200, body: page }, '/catalog': { status: 200, body: page, headers: { 'Cache-Control': 'max-age=60' } }, '/static/app.css': { status: 200, body: 'body{font:16px/1.5 serif}\n', headers: { 'Cache-Control': 'max-age=86400' } } };
  b.svc(web, { proto: 'tcp', port: 80, bind: '198.51.100.20', proc: 'nginx', kind: 'http', http: { server: 'nginx/1.26.3', routes: { '/*': { status: 301, location: 'https://shop.example{path}', body: '' } } } });
  b.svc(web, { proto: 'tcp', port: 443, bind: '198.51.100.20', proc: 'nginx', kind: 'http', tls: cert('shop.example', ['shop.example', 'www.shop.example']), http: { server: 'nginx/1.26.3', routes: shopRoutes } });
  b.svc(web, { proto: 'tcp', port: 443, bind: '198.51.100.21', proc: 'nginx', kind: 'http', tls: cert('expired.example', ['expired.example'], { notBefore: '2025-08-01T00:00:00Z', notAfter: '2025-10-30T23:59:59Z' }), http: { server: 'nginx/1.26.3', routes: { '/': { status: 200, body: 'old site\n' } } } });
  b.svc(web, { proto: 'tcp', port: 443, bind: '198.51.100.22', proc: 'nginx', kind: 'http', tls: cert('www.wrong.example', ['www.wrong.example']), http: { server: 'nginx/1.26.3', routes: { '/': { status: 200, body: 'www only\n' } } } });
  b.svc(web, { proto: 'tcp', port: 443, bind: '198.51.100.23', proc: 'nginx', kind: 'http', tls: cert('chain.example', ['chain.example'], { chain: 'incomplete' }), http: { server: 'nginx/1.26.3', routes: { '/': { status: 200, body: 'chain\n' } } } });
  b.svc(web, { proto: 'tcp', port: 443, bind: '198.51.100.24', proc: 'nginx', kind: 'http', tls: cert('selfsigned.example', ['selfsigned.example'], { chain: 'self-signed' }), http: { routes: { '/': { status: 200, body: 'self-signed site\n' } } } });
  b.svc(web, { proto: 'tcp', port: 443, bind: '198.51.100.30', proc: 'nginx', kind: 'http', tls: cert('edge.cdn.example', ['*.cdn.example', 'static.shop.example']), http: { server: 'nginx/1.26.3', routes: shopRoutes } });
  b.svc(web, { proto: 'tcp', port: 22, bind: '0.0.0.0', proc: 'sshd', kind: 'ssh', banner: 'SSH-2.0-OpenSSH_10.0p2 Debian-7' });

  const pub = b.host('pubdns', { name: 'one.one.one.one', role: 'resolver' });
  b.nic(pub, 'eth0', 'pub', ['1.1.1.1/24']);
  b.route(pub, 'default', '1.1.1.254', 'eth0');
  b.svc(pub, { proto: 'udp', port: 53, bind: '0.0.0.0', proc: 'resolver', kind: 'dns', dns: { mode: 'recursive', upstream: [ROOT_IP], qnameMin: true } });

  const files: Record<string, string> = {};
  if (b.w.local === 'laptop') {
    files['/etc/hosts'] = `127.0.0.1\tlocalhost\n127.0.1.1\tlaptop\n::1\t\tlocalhost ip6-localhost ip6-loopback\n${o.hosts ?? ''}`;
    files['/etc/resolv.conf'] = o.resolv ?? (o.noAddr ? '' : '# Generated by dhcpcd from eth0.dhcp\nnameserver 192.168.1.1\n');
  } else {
    files['/etc/hosts'] = '127.0.0.1\tlocalhost\n127.0.1.1\thome-router\n';
    files['/etc/resolv.conf'] = 'nameserver 127.0.0.1\n';
  }
  return { world: b.w, files };
}

// ── two subnets and a router (m02, m04) ────────────────────────────────────

export interface TwoSubnetOpts {
  /** h1 starts without an address on eth0 (m02). */
  noAddr?: boolean;
  /** h1 has a default route via r1. */
  gw?: boolean;
  /** h2 has no route back (asymmetric routing). */
  noReturnRoute?: boolean;
  /** r1 forwards packets (default true). */
  forward?: boolean;
}

export function twoSubnets(o: TwoSubnetOpts = {}): Built {
  const b = new Builder('h1');
  b.seg('lan1', 0.2).seg('lan2', 0.2);
  const h1 = b.host('h1', { role: 'host' });
  b.nic(h1, 'eth0', 'lan1', o.noAddr ? [] : ['10.0.1.10/24'], '02:00:00:00:01:10');
  if (o.gw) b.route(h1, 'default', '10.0.1.1', 'eth0');
  const h3 = b.host('h3', { role: 'host' });
  b.nic(h3, 'eth0', 'lan1', ['10.0.1.20/24'], '02:00:00:00:01:20');
  b.route(h3, 'default', '10.0.1.1', 'eth0');
  const r1 = b.host('r1', { role: 'router', forward: o.forward !== false });
  b.nic(r1, 'eth0', 'lan1', ['10.0.1.1/24'], '02:00:00:00:01:01').nic(r1, 'eth1', 'lan2', ['10.0.2.1/24'], '02:00:00:00:02:01');
  const h2 = b.host('h2', { role: 'host' });
  b.nic(h2, 'eth0', 'lan2', ['10.0.2.10/24'], '02:00:00:00:02:10');
  if (!o.noReturnRoute) b.route(h2, 'default', '10.0.2.1', 'eth0');
  b.svc(h2, { proto: 'tcp', port: 80, bind: '0.0.0.0', proc: 'nginx', kind: 'http', http: { server: 'nginx/1.26.3', routes: { '/': { status: 200, body: 'h2 says hello\n' } } } });
  return { world: b.w, files: { '/etc/hosts': '127.0.0.1\tlocalhost\n127.0.1.1\th1\n10.0.2.10\th2\n10.0.1.20\th3\n', '/etc/resolv.conf': '' } };
}

// ── a chain of three routers (m04: read traceroute) ────────────────────────

export function chain(o: { broken?: boolean } = {}): Built {
  const b = new Builder('h1');
  b.seg('a', 0.3).seg('ab', 2).seg('bc', 5).seg('c', 0.3);
  const h1 = b.host('h1', { role: 'host' });
  b.nic(h1, 'eth0', 'a', ['10.0.1.10/24']);
  b.route(h1, 'default', '10.0.1.1', 'eth0');
  const r1 = b.host('r1', { role: 'router', forward: true });
  b.nic(r1, 'eth0', 'a', ['10.0.1.1/24']).nic(r1, 'eth1', 'ab', ['10.0.12.1/30']);
  b.route(r1, 'default', '10.0.12.2', 'eth1');
  const r2 = b.host('r2', { role: 'router', forward: true });
  b.nic(r2, 'eth0', 'ab', ['10.0.12.2/30']).nic(r2, 'eth1', 'bc', ['10.0.23.2/30']);
  b.route(r2, '10.0.1.0/24', '10.0.12.1', 'eth0').route(r2, '10.20.0.0/16', '10.0.23.3', 'eth1');
  const r3 = b.host('r3', { role: 'router', forward: true });
  b.nic(r3, 'eth0', 'bc', ['10.0.23.3/30']).nic(r3, 'eth1', 'c', ['10.20.0.1/24']);
  if (!o.broken) b.route(r3, '10.0.1.0/24', '10.0.23.2', 'eth0');
  const t = b.host('target', { role: 'host' });
  b.nic(t, 'eth0', 'c', ['10.20.0.5/24']);
  b.route(t, 'default', '10.20.0.1', 'eth0');
  return { world: b.w, files: { '/etc/hosts': '127.0.0.1\tlocalhost\n127.0.1.1\th1\n', '/etc/resolv.conf': '' } };
}

// ── a switch with three hosts (m01, m03) ───────────────────────────────────

export function lan(o: { cOff?: boolean } = {}): Built {
  const b = new Builder('a');
  b.seg('sw', 0.15);
  const a = b.host('a', { role: 'host' });
  b.nic(a, 'eth0', 'sw', ['192.168.1.10/24'], '02:42:ac:11:00:0a');
  const h2 = b.host('b', { role: 'host' });
  b.nic(h2, 'eth0', 'sw', ['192.168.1.20/24'], '02:42:ac:11:00:14');
  const c = b.host('c', { role: 'host' });
  b.nic(c, 'eth0', 'sw', ['192.168.1.30/24'], '02:42:ac:11:00:1e');
  if (o.cOff) c.off = true;
  return { world: b.w, files: { '/etc/hosts': '127.0.0.1\tlocalhost\n127.0.1.1\ta\n', '/etc/resolv.conf': '' } };
}

// ── ports, UDP and TCP (m05) ───────────────────────────────────────────────

export function tcpLab(): Built {
  const b = new Builder('client');
  b.seg('lan', 0.25);
  const c = b.host('client', { role: 'client' });
  b.nic(c, 'eth0', 'lan', ['10.0.0.1/24']);
  const s = b.host('srv', { role: 'server' });
  b.nic(s, 'eth0', 'lan', ['10.0.0.2/24']);
  b.svc(s, { proto: 'tcp', port: 22, bind: '0.0.0.0', proc: 'sshd', kind: 'ssh', banner: 'SSH-2.0-OpenSSH_10.0p2 Debian-7' });
  b.svc(s, { proto: 'tcp', port: 8080, bind: '0.0.0.0', proc: 'python3', kind: 'http', http: { server: 'SimpleHTTP/0.6 Python/3.13.5', routes: { '/': { status: 200, body: 'hello from srv\n' } } } });
  b.svc(s, { proto: 'tcp', port: 6379, bind: '127.0.0.1', proc: 'redis-server', kind: 'raw', banner: '-ERR unknown command' });
  b.svc(s, { proto: 'tcp', port: 9100, bind: '0.0.0.0', proc: 'node_exporter', kind: 'http', http: { server: 'node_exporter', routes: { '/metrics': { status: 200, body: 'up 1\n' } } } });
  b.svc(s, { proto: 'udp', port: 53, bind: '0.0.0.0', proc: 'dnsmasq', kind: 'dns', dns: { mode: 'auth', zones: [{ origin: 'lab.', records: [soa('lab.', 'srv.lab.'), rr('srv.lab.', 'A', '10.0.0.2'), rr('client.lab.', 'A', '10.0.0.1')] }] } });
  s.nf.filter.INPUT.rules.push(rule('DROP', { proto: 'tcp', dport: 9100 }));
  return { world: b.w, files: { '/etc/hosts': '127.0.0.1\tlocalhost\n127.0.1.1\tclient\n10.0.0.2\tsrv\n', '/etc/resolv.conf': 'nameserver 10.0.0.2\nsearch lab\n' } };
}

// ── NAT at the edge of an office (m09) ─────────────────────────────────────

export function natLab(o: { configured?: boolean } = {}): Built {
  const b = new Builder('gw');
  b.seg('office', 0.2).seg('wan', 3, 'wan');
  const gw = b.host('gw', { name: 'gw', role: 'router', forward: !!o.configured });
  b.nic(gw, 'eth0', 'office', ['10.0.2.1/24']).nic(gw, 'eth1', 'wan', ['203.0.113.10/24']);
  b.route(gw, 'default', '203.0.113.1', 'eth1');
  if (o.configured) gw.nf.nat.POSTROUTING.rules.push(rule('MASQUERADE', { src: '10.0.2.0/24', outIf: 'eth1' }));
  const app = b.host('app', { role: 'server' });
  b.nic(app, 'eth0', 'office', ['10.0.2.20/24']);
  b.route(app, 'default', '10.0.2.1', 'eth0');
  b.svc(app, { proto: 'tcp', port: 8080, bind: '0.0.0.0', proc: 'python3', kind: 'http', http: { server: 'gunicorn', routes: { '/': { status: 200, body: 'office app\n' } } } });
  const isp = b.host('isp', { role: 'isp', forward: true });
  b.nic(isp, 'eth0', 'wan', ['203.0.113.1/24']);
  const ext = b.host('ext', { name: 'ext', role: 'internet' });
  b.nic(ext, 'eth0', 'wan', ['203.0.113.50/24']);
  b.route(ext, 'default', '203.0.113.1', 'eth0');
  b.svc(ext, { proto: 'tcp', port: 80, bind: '0.0.0.0', proc: 'nginx', kind: 'http', http: { server: 'nginx/1.26.3', routes: { '/': { status: 200, body: 'hello from the internet\n' } } } });
  return { world: b.w, files: { '/etc/hosts': '127.0.0.1\tlocalhost\n127.0.1.1\tgw\n10.0.2.20\tapp\n203.0.113.50\text\n', '/etc/resolv.conf': '' } };
}

// ── reverse proxy and upstreams (m13, m16; scenarios T1, T3, T4, T12) ──────

export interface ProxyOpts {
  /** Seconds /report takes on the application (T1: 75). */
  reportDelay?: number;
  /** T3: the application listens on 8081 while nginx proxies to 8080 (one backend). */
  wrongPort?: boolean;
  /** T4: the application listens on 127.0.0.1 only (one backend). */
  loopbackOnly?: boolean;
  /** T12: app2 lost its database and answers 500. */
  app2DbDown?: boolean;
  /** The process of app1 is stopped. */
  app1Down?: boolean;
  /** Text of the nginx config (defaults to a two-backend upstream). */
  conf?: string;
}

export const PROXY_CONF = `upstream backend {
    server 10.0.2.21:8080;
    server 10.0.2.22:8080;
}

server {
    listen 80;
    server_name shop.lab;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
`;

export const PROXY_CONF_SINGLE = `upstream backend {
    server 10.0.2.21:8080;
}

server {
    listen 80;
    server_name shop.lab;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }
}
`;

export function proxy(o: ProxyOpts = {}): Built {
  const b = new Builder('lb');
  b.seg('front', 0.3).seg('dc', 0.2);
  const single = o.wrongPort || o.loopbackOnly;
  const lb = b.host('lb', { name: 'lb', role: 'proxy' });
  b.nic(lb, 'eth0', 'dc', ['10.0.2.10/24']).nic(lb, 'eth1', 'front', ['10.0.0.1/24']);
  b.svc(lb, { proto: 'tcp', port: 80, bind: '0.0.0.0', proc: 'nginx', kind: 'nginx', pid: 812, nginx: { conf: '/etc/nginx/conf.d/shop.conf', pid: 812 } });
  b.svc(lb, { proto: 'tcp', port: 22, bind: '0.0.0.0', proc: 'sshd', kind: 'ssh', banner: 'SSH-2.0-OpenSSH_10.0p2 Debian-7' });
  const mkApp = (id: string, addr: string, extra: { db?: boolean; down?: boolean }) => {
    const h = b.host(id, { role: 'app' });
    b.nic(h, 'eth0', 'dc', [`${addr}/24`]);
    b.route(h, 'default', '10.0.2.10', 'eth0');
    const port = o.wrongPort ? 8081 : 8080;
    const bind = o.loopbackOnly ? '127.0.0.1' : '0.0.0.0';
    const s = b.svc(h, {
      proto: 'tcp',
      port,
      bind,
      proc: 'gunicorn',
      kind: 'http',
      http: { server: 'gunicorn', log: '{date} INFO {path} built in {delay}s', dbDown: extra.db, dbTimeout: 3, routes: { '/': { status: 200, body: `catalog from ${id}\n` }, '/report': { status: 200, delay: o.reportDelay ?? 75, body: `report from ${id}\n` }, '/health': { status: 200, body: 'ok\n' } } },
    });
    if (extra.down) s.down = true;
    h.files['/var/log/app.log'] = '';
    return h;
  };
  mkApp('app1', '10.0.2.21', { down: o.app1Down });
  if (!single) mkApp('app2', '10.0.2.22', { db: o.app2DbDown });
  const client = b.host('client', { role: 'client' });
  b.nic(client, 'eth0', 'front', ['10.0.0.5/24']);
  b.route(client, 'default', '10.0.0.1', 'eth0');
  const conf = o.conf ?? (single ? PROXY_CONF_SINGLE : PROXY_CONF);
  return {
    world: b.w,
    files: {
      '/etc/hosts': '127.0.0.1\tlocalhost\n127.0.1.1\tlb\n127.0.0.1\tshop.lab\n10.0.2.21\tapp1\n10.0.2.22\tapp2\n',
      '/etc/resolv.conf': '',
      '/etc/nginx/conf.d/shop.conf': conf,
      '/var/log/nginx/error.log': '',
      '/var/log/nginx/access.log': '',
    },
  };
}

// ── a small company: office, server room, internet (the block exam, 03 §17) ─

export interface OfficeOpts {
  /** gw forwards packets between its interfaces. */
  forward?: boolean;
  /** gw masquerades both subnets out of eth2. */
  masq?: boolean;
  /** gw forwards 203.0.113.10:443 to app; a number sets the (wrong) target port. */
  dnat?: boolean | number;
  /** gw runs the reference firewall: DROP policies, only the needed traffic allowed. */
  firewall?: boolean;
  /** Every part of the above at once. */
  configured?: boolean;
  /** One planted fault on a configured network. */
  fault?: 'no-est' | 'dnat-port' | 'no-route' | 'resolv';
}

export const OFFICE_FIREWALL = {
  INPUT: [
    rule('ACCEPT', { inIf: 'lo' }),
    rule('ACCEPT', { state: ['ESTABLISHED', 'RELATED'] }),
    rule('ACCEPT', { proto: 'tcp', src: '10.20.0.0/24', dport: 22 }),
  ],
  FORWARD: [
    rule('ACCEPT', { state: ['ESTABLISHED', 'RELATED'] }),
    rule('ACCEPT', { inIf: 'eth0', outIf: 'eth2' }),
    rule('ACCEPT', { inIf: 'eth1', outIf: 'eth2' }),
    rule('ACCEPT', { proto: 'tcp', inIf: 'eth0', outIf: 'eth1', dport: 443 }),
    rule('ACCEPT', { proto: 'udp', inIf: 'eth0', outIf: 'eth1', dst: '10.20.1.2', dport: 53 }),
    rule('ACCEPT', { proto: 'tcp', inIf: 'eth2', outIf: 'eth1', dst: '10.20.1.10', dport: 443 }),
  ],
};

export function office(o: OfficeOpts = {}): Built {
  const all = o.configured || !!o.fault;
  const forward = all || !!o.forward;
  const masq = all || !!o.masq;
  const dnat = all || o.dnat !== undefined ? (o.fault === 'dnat-port' ? 8443 : typeof o.dnat === 'number' ? o.dnat : 443) : undefined;
  const firewall = all || !!o.firewall;
  const b = new Builder('gw');
  b.seg('office', 0.2).seg('srv', 0.2).seg('wan', 3, 'wan').seg('net', 12, 'core');

  const gw = b.host('gw', { name: 'gw', role: 'router', forward });
  b.nic(gw, 'eth0', 'office', ['10.20.0.1/24'], '02:00:0a:14:00:01').nic(gw, 'eth1', 'srv', ['10.20.1.1/27'], '02:00:0a:14:01:01').nic(gw, 'eth2', 'wan', ['203.0.113.10/24'], '02:00:cb:00:71:0a');
  if (o.fault !== 'no-route') b.route(gw, 'default', '203.0.113.1', 'eth2');
  b.svc(gw, { proto: 'tcp', port: 22, bind: '0.0.0.0', proc: 'sshd', kind: 'ssh', banner: 'SSH-2.0-OpenSSH_10.0p2 Debian-7' });
  if (masq) gw.nf.nat.POSTROUTING.rules.push(rule('MASQUERADE', { src: '10.20.0.0/23', outIf: 'eth2' }));
  if (dnat !== undefined) gw.nf.nat.PREROUTING.rules.push(rule('DNAT', { proto: 'tcp', inIf: 'eth2', dport: 443, toDest: `10.20.1.10:${dnat}` }));
  if (firewall) {
    gw.nf.filter.INPUT.policy = 'DROP';
    gw.nf.filter.FORWARD.policy = 'DROP';
    gw.nf.filter.INPUT.rules.push(...OFFICE_FIREWALL.INPUT.map((r) => ({ ...r })));
    gw.nf.filter.FORWARD.rules.push(...OFFICE_FIREWALL.FORWARD.filter((r) => !(o.fault === 'no-est' && r.state)).map((r) => ({ ...r })));
  }

  const laptop = b.host('laptop', { name: 'laptop-07', role: 'client' });
  b.nic(laptop, 'eth0', 'office', ['10.20.0.50/24'], '3c:22:fb:20:00:50');
  b.route(laptop, 'default', '10.20.0.1', 'eth0', 'dhcp');
  laptop.files['/etc/resolv.conf'] = 'nameserver 10.20.1.2\nsearch corp.lab\n';
  laptop.files['/etc/hosts'] = '127.0.0.1\tlocalhost\n';

  const ns = b.host('ns', { name: 'ns', role: 'dns-auth' });
  b.nic(ns, 'eth0', 'srv', ['10.20.1.2/27']);
  b.route(ns, 'default', '10.20.1.1', 'eth0');
  const zone: DnsZone = {
    origin: 'corp.lab.',
    negTtl: 300,
    records: [soa('corp.lab.', 'ns.corp.lab.'), rr('corp.lab.', 'NS', 'ns.corp.lab.', 86400), rr('ns.corp.lab.', 'A', '10.20.1.2'), rr('gw.corp.lab.', 'A', '10.20.1.1'), rr('app.corp.lab.', 'A', '10.20.1.10'), rr('www.corp.lab.', 'CNAME', 'app.corp.lab.')],
  };
  b.svc(ns, { proto: 'udp', port: 53, bind: '0.0.0.0', proc: 'nsd', kind: 'dns', dns: { mode: 'auth', zones: [zone] } });

  const app = b.host('app', { name: 'app', role: 'web' });
  b.nic(app, 'eth0', 'srv', ['10.20.1.10/27']);
  b.route(app, 'default', '10.20.1.1', 'eth0');
  b.svc(app, { proto: 'tcp', port: 443, bind: '0.0.0.0', proc: 'nginx', kind: 'http', tls: cert('www.corp.lab', ['www.corp.lab', 'app.corp.lab']), http: { server: 'nginx/1.26.3', routes: { '/': { status: 200, body: '<!doctype html><title>Corp portal</title>\n' } } } });
  b.svc(app, { proto: 'tcp', port: 8080, bind: '0.0.0.0', proc: 'gunicorn', kind: 'http', http: { server: 'gunicorn', routes: { '/': { status: 200, body: 'portal backend\n' }, '/health': { status: 200, body: 'ok\n' } } } });
  app.files['/etc/resolv.conf'] = 'nameserver 10.20.1.2\nsearch corp.lab\n';

  const isp = b.host('isp', { name: 'bras2.isp.example', role: 'isp', forward: true });
  b.nic(isp, 'eth0', 'wan', ['203.0.113.1/24']).nic(isp, 'eth1', 'net', ['198.51.100.1/24']);
  const ext = b.host('ext', { name: 'outside', role: 'internet' });
  b.nic(ext, 'eth0', 'net', ['198.51.100.80/24']);
  b.route(ext, 'default', '198.51.100.1', 'eth0');
  b.svc(ext, { proto: 'tcp', port: 80, bind: '0.0.0.0', proc: 'nginx', kind: 'http', http: { server: 'nginx/1.26.3', routes: { '/': { status: 200, body: 'hello from the internet\n' } } } });
  ext.files['/etc/hosts'] = '127.0.0.1\tlocalhost\n203.0.113.10\twww.corp.lab\n';

  const resolv = o.fault === 'resolv' ? 'nameserver 10.20.1.2\n' : 'nameserver 10.20.1.2\nsearch corp.lab\n';
  return {
    world: b.w,
    files: { '/etc/hosts': '127.0.0.1\tlocalhost\n127.0.1.1\tgw\n', '/etc/resolv.conf': resolv },
  };
}

export const PRESETS: Record<string, (o: never) => Built> = {
  home: home as (o: never) => Built,
  'two-subnets': twoSubnets as (o: never) => Built,
  chain: chain as (o: never) => Built,
  lan: lan as (o: never) => Built,
  tcp: tcpLab as (o: never) => Built,
  nat: natLab as (o: never) => Built,
  proxy: proxy as (o: never) => Built,
  office: office as (o: never) => Built,
};

export function buildPreset(name: string, opts: Record<string, unknown> = {}): Built {
  const f = PRESETS[name];
  if (!f) throw new Error(`netlab: unknown preset "${name}"`);
  return f(opts as never);
}
