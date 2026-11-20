// netlab, tier A (03 §8.2): a small deterministic network model. Hosts with
// interfaces, routing tables, ARP caches, netfilter (filter + nat) and
// conntrack, joined by L2 segments (a switch or a cable). Every packet is
// walked hop by hop the way the Linux kernel would: PREROUTING (DNAT or the
// reverse of a translation) → routing decision → INPUT or FORWARD → OUTPUT →
// POSTROUTING (SNAT/MASQUERADE) → ARP for the next hop → the wire. Time is
// simulated (milliseconds since the course date), so a 127 s SYN timeout
// "passes" at once and every run is reproducible.
//
// Pure TypeScript, no DOM: the commands, the facts provider and the tests all
// use it.

import { fmtIp, inSubnet, isIp, longestMatch, parseCidr, parseIp } from './ip';

export type Proto = 'tcp' | 'udp' | 'icmp';

export interface Iface {
  name: string;
  mac: string;
  /** CIDR, e.g. 10.0.1.10/24. Empty when the interface has no address. */
  addrs: string[];
  up: boolean;
  mtu: number;
  /** The L2 segment (switch or cable) this interface is plugged into. Loopback has none. */
  seg?: string;
}

export interface Route {
  dst: string; // 'default' or CIDR
  via?: string;
  dev: string;
  proto?: 'kernel' | 'static' | 'dhcp' | 'boot';
  scope?: 'link';
  src?: string;
  metric?: number;
}

export interface NfRule {
  proto?: Proto | 'all';
  src?: string;
  dst?: string;
  sport?: number;
  dport?: number;
  inIf?: string;
  outIf?: string;
  /** conntrack states, e.g. ['ESTABLISHED','RELATED']. */
  state?: string[];
  /** Negations for -s / -d / -o / -i. */
  not?: { src?: boolean; dst?: boolean; inIf?: boolean; outIf?: boolean };
  target: string; // ACCEPT DROP REJECT MASQUERADE SNAT DNAT RETURN LOG or a user chain
  toDest?: string; // DNAT ip[:port]
  toSrc?: string; // SNAT ip
  rejectWith?: string;
  pkts: number;
  bytes: number;
}

export interface NfChain {
  pkts?: number;
  bytes?: number;
  policy?: 'ACCEPT' | 'DROP';
  rules: NfRule[];
}

export type NfTable = Record<string, NfChain>;

export interface Netfilter {
  filter: NfTable;
  nat: NfTable;
}

export interface Tuple {
  src: string;
  sport: number;
  dst: string;
  dport: number;
}

export interface Conn {
  proto: Proto;
  orig: Tuple;
  reply: Tuple;
  state: 'NEW' | 'ESTABLISHED';
  /** Simulated time when the entry expires. */
  expires: number;
  nat?: 'snat' | 'dnat';
  assured?: boolean;
}

export interface Cert {
  cn: string;
  san: string[];
  issuer: string;
  notBefore: string; // ISO date
  notAfter: string;
  chain: 'ok' | 'incomplete' | 'self-signed';
}

export interface HttpRoute {
  status: number;
  /** Seconds the application takes to answer. */
  delay?: number;
  body?: string;
  headers?: Record<string, string>;
  /** For 3xx: the Location header. */
  location?: string;
}

export interface HttpApp {
  routes: Record<string, HttpRoute>;
  /** Server header. */
  server?: string;
  /** Lines the application writes to its log per request (with {path} and {delay}). */
  log?: string;
  /** The database is unreachable: every route answers 500 after `dbTimeout` seconds. */
  dbDown?: boolean;
  dbTimeout?: number;
}

export interface DnsRR {
  name: string; // absolute, with the trailing dot
  type: string; // A AAAA NS CNAME MX TXT SOA PTR
  ttl: number;
  data: string;
}

export interface DnsZone {
  origin: string; // 'example.' or '.'
  records: DnsRR[];
  /** Negative-caching TTL (SOA minimum). */
  negTtl?: number;
}

export interface CacheEntry {
  rrs: DnsRR[];
  rcode: 'NOERROR' | 'NXDOMAIN' | 'SERVFAIL';
  expires: number;
}

export interface DnsServer {
  /** auth: answers only from its zones; recursive: resolves on behalf of clients and caches. */
  mode: 'auth' | 'recursive' | 'forward';
  zones?: DnsZone[];
  /** Root hints (recursive) or upstream servers (forward). */
  upstream?: string[];
  qnameMin?: boolean;
  cache?: Record<string, CacheEntry>;
}

export interface DhcpServer {
  pool: [string, string];
  mask: number;
  router?: string;
  dns?: string[];
  lease: number;
  /** Milliseconds before this server answers a Discover (the fastest offer wins). */
  delay?: number;
  next?: number;
  leases?: Record<string, string>;
}

export interface NginxModel {
  /** Path of the config file (on the local host it is read from the VFS). */
  conf: string;
  /** The text the running nginx loaded (reload replaces it). */
  loaded?: string;
  pid: number;
  /** Upstream peers marked down until a simulated time (passive health check). */
  failedUntil?: Record<string, number>;
  rr?: number;
}

export interface Service {
  proto: 'tcp' | 'udp';
  port: number;
  /** 0.0.0.0, 127.0.0.1 or an address of the host. */
  bind: string;
  /** Process name as ss -p prints it. */
  proc: string;
  pid: number;
  kind: 'http' | 'dns' | 'ssh' | 'dhcp' | 'smtp' | 'nginx' | 'raw';
  /** The process is stopped: nothing listens. */
  down?: boolean;
  tls?: Cert;
  http?: HttpApp;
  dns?: DnsServer;
  dhcp?: DhcpServer;
  nginx?: NginxModel;
  /** Banner for raw TCP services (ssh, smtp). */
  banner?: string;
}

export interface Neigh {
  ip: string;
  mac: string;
  dev: string;
  state: 'REACHABLE' | 'STALE' | 'PERMANENT' | 'FAILED';
}

export interface Host {
  id: string;
  /** The hostname. */
  name: string;
  ifaces: Iface[];
  routes: Route[];
  neigh: Neigh[];
  ipForward: boolean;
  nf: Netfilter;
  conntrack: Conn[];
  services: Service[];
  /** Files of a remote host (/etc/hosts, /etc/resolv.conf, logs). The local host uses the machine's VFS. */
  files: Record<string, string>;
  /** Powered off: nothing answers, not even ARP. */
  off?: boolean;
  /** Short role for diagrams and cards. */
  role?: string;
  /** DHCP client state on the local host. */
  dhcpLease?: { iface: string; addr: string; server: string; lease: number; acquiredAt?: number; dns?: string[]; router?: string; mask?: number };
}

export interface Segment {
  id: string;
  /** One-way latency of the segment in milliseconds. */
  latency: number;
  /** Link rate used for packet serialization; defaults to 100 Mbit/s. */
  bandwidthMbps?: number;
  kind: 'lan' | 'wifi' | 'wan' | 'core' | 'loop';
  /** Drop every packet that matches (a fault of the scenario). */
  dropProto?: Proto;
}

export interface CapturedPacket {
  t: number;
  host: string;
  iface: string;
  dir: 'in' | 'out';
  srcMac: string;
  dstMac: string;
  /** 'ip' or 'arp'. */
  l3: 'ip' | 'arp';
  proto?: Proto;
  src: string;
  dst: string;
  sport?: number;
  dport?: number;
  ttl?: number;
  /** The tcpdump text after the addresses: "Flags [S], seq 1000, win 64240, …, length 0". */
  info: string;
  len: number;
  /** For ARP: 'request' | 'reply'. */
  arp?: 'request' | 'reply';
}

export interface World {
  hosts: Record<string, Host>;
  segs: Record<string, Segment>;
  /** Simulated time, ms since the epoch (starts at the course date). */
  clock: number;
  capture: CapturedPacket[];
  /** The host the learner's terminal is on. */
  local: string;
  /** Counter for ephemeral ports, ICMP ids, TCP sequence numbers and PIDs. */
  counter: number;
  /** A probe copy: never writes files of the local host. */
  dry?: boolean;
  /** Recorded hop-by-hop for explainers and probes. */
  lastStage?: string;
}

/** File access of the local host (the machine's VFS); remote hosts keep files in Host.files. */
export interface FileIo {
  read(path: string): string | undefined;
  append(path: string, text: string): void;
}

export const COURSE_DATE = Date.UTC(2026, 10, 18, 9, 0, 0);
const CAPTURE_MAX = 600;

export function emptyNf(): Netfilter {
  return {
    filter: { INPUT: { policy: 'ACCEPT', rules: [] }, FORWARD: { policy: 'ACCEPT', rules: [] }, OUTPUT: { policy: 'ACCEPT', rules: [] } },
    nat: { PREROUTING: { policy: 'ACCEPT', rules: [] }, INPUT: { policy: 'ACCEPT', rules: [] }, OUTPUT: { policy: 'ACCEPT', rules: [] }, POSTROUTING: { policy: 'ACCEPT', rules: [] } },
  };
}

// ── addresses and routes ───────────────────────────────────────────────────

export function addrOf(cidr: string): string {
  return cidr.split('/')[0];
}

export function hostAddrs(h: Host): string[] {
  return h.ifaces.flatMap((i) => i.addrs.map(addrOf));
}

/** Is `ip` one of the host's own addresses (loopback included)? */
export function isLocalAddr(h: Host, ip: string): boolean {
  if (inSubnet(ip, '127.0.0.0/8')) return true;
  return h.ifaces.some((i) => i.up && i.addrs.some((a) => addrOf(a) === ip));
}

/** The routes the kernel adds by itself for every address (proto kernel scope link) plus the configured ones. */
export function effectiveRoutes(h: Host): Route[] {
  const connected: Route[] = [];
  for (const i of h.ifaces) {
    if (!i.up || i.name === 'lo') continue;
    for (const a of i.addrs) {
      const c = parseCidr(a);
      if (c.prefix >= 32) continue;
      const net = `${fmtIp((c.addr & ((0xffffffff << (32 - c.prefix)) >>> 0)) >>> 0)}/${c.prefix}`;
      connected.push({ dst: net, dev: i.name, proto: 'kernel', scope: 'link', src: addrOf(a) });
    }
  }
  const configured = h.routes.filter((r) => h.ifaces.some((i) => i.name === r.dev && i.up));
  return [...connected, ...configured];
}

export function lookupRoute(h: Host, dst: string): Route | undefined {
  return longestMatch(effectiveRoutes(h), dst);
}

export function ifaceOf(h: Host, name: string): Iface | undefined {
  return h.ifaces.find((i) => i.name === name);
}

/** Source address the kernel picks for a route: the `src` hint or the first address of the egress interface. */
export function srcFor(h: Host, r: Route): string | undefined {
  if (r.src) return r.src;
  const i = ifaceOf(h, r.dev);
  const gw = r.via;
  const match = i?.addrs.find((a) => gw && inSubnet(gw, a));
  return addrOf(match ?? i?.addrs[0] ?? '') || undefined;
}

export function hostByAddr(w: World, ip: string): Host | undefined {
  return Object.values(w.hosts).find((h) => hostAddrs(h).includes(ip));
}

export function nextId(w: World): number {
  w.counter = (w.counter + 1) % 100000;
  return w.counter;
}

/** An ephemeral port as Linux picks them (ip_local_port_range 32768–60999). */
export function ephemeralPort(w: World): number {
  return 32768 + ((nextId(w) * 7919) % (60999 - 32768));
}

// ── netfilter ──────────────────────────────────────────────────────────────

interface PktView {
  proto: Proto;
  src: string;
  dst: string;
  sport?: number;
  dport?: number;
  inIf?: string;
  outIf?: string;
  ctState: 'NEW' | 'ESTABLISHED' | 'RELATED';
  len: number;
}

function addrMatch(ip: string, spec: string): boolean {
  if (!isIp(ip)) return false;
  return spec.includes('/') ? inSubnet(ip, spec) : ip === spec;
}

export function ruleMatches(r: NfRule, p: PktView): boolean {
  const neg = r.not ?? {};
  if (r.proto && r.proto !== 'all' && r.proto !== p.proto) return false;
  if (r.src && addrMatch(p.src, r.src) === !!neg.src) return false;
  if (r.dst && addrMatch(p.dst, r.dst) === !!neg.dst) return false;
  if (r.sport !== undefined && r.sport !== p.sport) return false;
  if (r.dport !== undefined && r.dport !== p.dport) return false;
  if (r.inIf && (r.inIf === p.inIf) === !!neg.inIf) return false;
  if (r.outIf && (r.outIf === p.outIf) === !!neg.outIf) return false;
  if (r.state && !r.state.includes(p.ctState)) return false;
  return true;
}

export interface Verdict {
  verdict: 'ACCEPT' | 'DROP' | 'REJECT';
  rule?: NfRule;
  chain: string;
  rejectWith?: string;
}

/** Walk one chain (and the user chains it jumps to) the way iptables does: first matching rule with a verdict wins. */
export function walkChain(table: NfTable, chain: string, p: PktView, depth = 0): Verdict | 'RETURN' | null {
  const c = table[chain];
  if (!c || depth > 8) return null;
  for (const r of c.rules) {
    if (!ruleMatches(r, p)) continue;
    r.pkts++;
    r.bytes += p.len;
    if (r.target === 'ACCEPT' || r.target === 'DROP') return { verdict: r.target, rule: r, chain };
    if (r.target === 'REJECT') return { verdict: 'REJECT', rule: r, chain, rejectWith: r.rejectWith };
    if (r.target === 'RETURN') return 'RETURN';
    if (r.target === 'LOG') continue;
    if (table[r.target]) {
      const sub = walkChain(table, r.target, p, depth + 1);
      if (sub && sub !== 'RETURN') return sub;
    }
  }
  return null;
}

export function filterVerdict(h: Host, chain: 'INPUT' | 'FORWARD' | 'OUTPUT', p: PktView): Verdict {
  const v = walkChain(h.nf.filter, chain, p);
  if (v && v !== 'RETURN') return v;
  const policy = h.nf.filter[chain];
  if (policy) { policy.pkts = (policy.pkts ?? 0) + 1; policy.bytes = (policy.bytes ?? 0) + p.len; }
  return { verdict: policy?.policy === 'DROP' ? 'DROP' : 'ACCEPT', chain };
}

function natRule(table: NfTable, chain: string, p: PktView, depth = 0): NfRule | null {
  const c = table[chain];
  if (!c || depth > 8) return null;
  for (const r of c.rules) {
    if (!ruleMatches(r, p)) continue;
    r.pkts++;
    r.bytes += p.len;
    if (r.target === 'DNAT' || r.target === 'SNAT' || r.target === 'MASQUERADE' || r.target === 'ACCEPT') return r;
    if (r.target === 'RETURN') return null;
    if (table[r.target]) {
      const sub = natRule(table, r.target, p, depth + 1);
      if (sub) return sub;
    }
  }
  return null;
}

// ── conntrack ──────────────────────────────────────────────────────────────

const CT_TIMEOUT: Record<Proto, number> = { tcp: 432000_000, udp: 30_000, icmp: 30_000 };

function sameTuple(a: Tuple, b: Tuple): boolean {
  return a.src === b.src && a.dst === b.dst && a.sport === b.sport && a.dport === b.dport;
}

export interface Packet {
  proto: Proto;
  src: string;
  dst: string;
  sport: number;
  dport: number;
  ttl: number;
  len: number;
  /** tcpdump tail text. */
  info: string;
  /** TCP flags as tcpdump prints them ("S", "S.", "R.", "P.", "F."). */
  flags?: string;
  icmp?: { type: number; code: number };
  df?: boolean;
  /** ICMP errors carry the header of the packet that caused them (NAT translates it back). */
  embedded?: Tuple;
}

function tupleOf(p: Packet): Tuple {
  return { src: p.src, sport: p.sport, dst: p.dst, dport: p.dport };
}

function ctFind(h: Host, w: World, p: Packet): { conn: Conn; dir: 'orig' | 'reply' } | undefined {
  const t = tupleOf(p);
  h.conntrack = h.conntrack.filter((c) => c.expires > w.clock);
  for (const c of h.conntrack) {
    if (c.proto !== p.proto) continue;
    if (sameTuple(c.orig, t)) return { conn: c, dir: 'orig' };
    if (sameTuple(c.reply, t)) return { conn: c, dir: 'reply' };
  }
  return undefined;
}

// ── capture ────────────────────────────────────────────────────────────────

export function macOf(h: Host, ifname: string): string {
  return ifaceOf(h, ifname)?.mac ?? '00:00:00:00:00:00';
}

export function record(w: World, c: Omit<CapturedPacket, 't'>): void {
  w.capture.push({ t: w.clock, ...c });
  if (w.capture.length > CAPTURE_MAX) w.capture.splice(0, w.capture.length - CAPTURE_MAX);
}

function neighLookup(h: Host, ip: string, dev: string): Neigh | undefined {
  return h.neigh.find((n) => n.ip === ip && n.dev === dev && n.state !== 'FAILED');
}

function learn(h: Host, ip: string, mac: string, dev: string): void {
  const n = h.neigh.find((x) => x.ip === ip && x.dev === dev);
  if (n) {
    if (n.state !== 'PERMANENT') {
      n.mac = mac;
      n.state = 'REACHABLE';
    }
  } else h.neigh.push({ ip, mac, dev, state: 'REACHABLE' });
}

/** Who answers ARP for `ip` on the segment of `ifname` (an interface that is up and carries the address). */
function arpPeer(w: World, h: Host, ifname: string, ip: string): { host: Host; iface: Iface } | undefined {
  const seg = ifaceOf(h, ifname)?.seg;
  if (!seg) return undefined;
  for (const other of Object.values(w.hosts)) {
    if (other.off || other === h) continue;
    for (const i of other.ifaces) if (i.seg === seg && i.up && i.addrs.some((a) => addrOf(a) === ip)) return { host: other, iface: i };
  }
  return undefined;
}

/** Resolve the MAC of the next hop, recording the ARP exchange when the cache is empty. */
function arpResolve(w: World, h: Host, ifname: string, ip: string, src: string): { host: Host; iface: Iface } | undefined {
  const peer = arpPeer(w, h, ifname, ip);
  const cached = neighLookup(h, ip, ifname);
  if (cached && peer && cached.mac === peer.iface.mac) return peer;
  const myMac = macOf(h, ifname);
  const req = (n: number) =>
    record(w, { host: h.id, iface: ifname, dir: 'out', srcMac: myMac, dstMac: 'ff:ff:ff:ff:ff:ff', l3: 'arp', src, dst: ip, info: `Request who-has ${ip} tell ${src}, length 28`, len: 28 + 0 * n, arp: 'request' });
  req(1);
  if (!peer) {
    req(2);
    req(3);
    const n = h.neigh.find((x) => x.ip === ip && x.dev === ifname);
    if (n) n.state = 'FAILED';
    else h.neigh.push({ ip, mac: '', dev: ifname, state: 'FAILED' });
    w.clock += 3000;
    return undefined;
  }
  record(w, { host: peer.host.id, iface: peer.iface.name, dir: 'in', srcMac: myMac, dstMac: 'ff:ff:ff:ff:ff:ff', l3: 'arp', src, dst: ip, info: `Request who-has ${ip} tell ${src}, length 28`, len: 28, arp: 'request' });
  learn(peer.host, src, myMac, peer.iface.name);
  record(w, { host: peer.host.id, iface: peer.iface.name, dir: 'out', srcMac: peer.iface.mac, dstMac: myMac, l3: 'arp', src: ip, dst: src, info: `Reply ${ip} is-at ${peer.iface.mac}, length 28`, len: 28, arp: 'reply' });
  record(w, { host: h.id, iface: ifname, dir: 'in', srcMac: peer.iface.mac, dstMac: myMac, l3: 'arp', src: ip, dst: src, info: `Reply ${ip} is-at ${peer.iface.mac}, length 28`, len: 28, arp: 'reply' });
  learn(h, ip, peer.iface.mac, ifname);
  return peer;
}

// ── delivery ───────────────────────────────────────────────────────────────

export interface Delivery {
  ok: boolean;
  /** The host the packet reached (on success) or where it stopped. */
  at: string;
  /** The packet as the receiver saw it (after NAT). */
  pkt: Packet;
  /** Hosts along the way. */
  path: string[];
  /** One-way latency in ms. */
  ms: number;
  /**
   * Where it stopped: 'no-route' (no route on the sender: the packet is not born),
   * 'arp-no-reply', 'no-route:<host>', 'dropped-at:<host>:<CHAIN>', 'rejected-at:<host>:<CHAIN>',
   * 'ttl-exceeded:<host>', 'forward-disabled:<host>', 'seg-drop:<seg>', 'host-down'.
   */
  stage?: string;
  /** The address of the host that stopped the packet (for ICMP errors). */
  stopAddr?: string;
}

/**
 * Send one packet from host `from`, hop by hop, with full netfilter and NAT.
 * Returns where it arrived. Side effects: captures, ARP caches, conntrack, counters, clock.
 */
export function transmit(w: World, from: string, pkt0: Packet): Delivery {
  let h = w.hosts[from];
  let p: Packet = { ...pkt0 };
  let local = true;
  let inIf: string | undefined;
  const path = [from];
  let ms = 0;
  const stop = (stage: string, at: Host, stopAddr?: string): Delivery => {
    w.lastStage = stage;
    return { ok: false, at: at.id, pkt: p, path, ms, stage, stopAddr };
  };
  for (let hop = 0; hop < 64; hop++) {
    h.conntrack = h.conntrack.filter((c) => c.expires > w.clock);
    const isErr = p.proto === 'icmp' && !!p.icmp && p.icmp.type !== 8 && p.icmp.type !== 0;
    let found = isErr ? undefined : ctFind(h, w, p);
    let conn = found?.conn;
    const dir = found?.dir;
    let state: PktView['ctState'] = isErr ? 'RELATED' : found ? (dir === 'reply' || found.conn.state === 'ESTABLISHED' ? 'ESTABLISHED' : 'NEW') : 'NEW';
    let natDone = false;

    // PREROUTING (or nat OUTPUT for a packet born here): DNAT, or the reverse of an earlier translation.
    if (isErr && p.embedded) {
      const e = p.embedded;
      const c = h.conntrack.find((x) => x.nat === 'snat' && x.reply.dst === e.src && x.reply.dport === e.sport && x.reply.src === e.dst);
      if (c) {
        p = { ...p, dst: c.orig.src, embedded: { ...e, src: c.orig.src, sport: c.orig.sport } };
        natDone = true;
      }
    } else if (conn?.nat) {
      if (dir === 'reply') {
        p = { ...p, dst: conn.orig.src, dport: conn.orig.sport, src: conn.orig.dst, sport: conn.orig.dport };
        natDone = true;
      } else if (conn.nat === 'dnat') {
        p = { ...p, dst: conn.reply.src, dport: conn.reply.sport };
        natDone = true;
      }
    } else if (!conn && !isErr) {
      const view: PktView = { proto: p.proto, src: p.src, dst: p.dst, sport: p.sport, dport: p.dport, inIf, ctState: 'NEW', len: p.len };
      const r = natRule(h.nf.nat, local ? 'OUTPUT' : 'PREROUTING', view);
      if (r && r.target === 'DNAT' && r.toDest) {
        const [ip, port] = r.toDest.split(':');
        const orig = tupleOf(p);
        p = { ...p, dst: ip, dport: port ? Number(port) : p.dport };
        conn = { proto: p.proto, orig, reply: { src: p.dst, sport: p.dport, dst: orig.src, dport: orig.sport }, state: 'NEW', expires: w.clock + CT_TIMEOUT[p.proto], nat: 'dnat' };
        h.conntrack.push(conn);
        natDone = true;
      }
    }
    const track = () => {
      if (isErr) return;
      if (!conn) {
        const o = tupleOf(p);
        conn = { proto: p.proto, orig: o, reply: { src: o.dst, sport: o.dport, dst: o.src, dport: o.sport }, state: 'NEW', expires: w.clock + CT_TIMEOUT[p.proto] };
        h.conntrack.push(conn);
      } else {
        if (dir === 'reply') conn.state = 'ESTABLISHED';
        conn.expires = w.clock + CT_TIMEOUT[p.proto];
      }
    };
    const v4 = (_chain: string, extra: Partial<PktView>): PktView => ({ proto: p.proto, src: p.src, dst: p.dst, sport: p.sport, dport: p.dport, ctState: state, len: p.len, ...extra });

    if (isLocalAddr(h, p.dst)) {
      if (local) {
        if (!p.src) p = { ...p, src: inSubnet(p.dst, '127.0.0.0/8') ? '127.0.0.1' : p.dst };
        // A packet to ourselves goes through lo: OUTPUT, then INPUT.
        const vo = filterVerdict(h, 'OUTPUT', v4('o', { outIf: 'lo' }));
        if (vo.verdict !== 'ACCEPT') return stop(`${vo.verdict === 'DROP' ? 'dropped' : 'rejected'}-at:${h.id}:OUTPUT`, h, p.dst);
        const vi = filterVerdict(h, 'INPUT', v4('i', { inIf: 'lo' }));
        if (vi.verdict !== 'ACCEPT') return stop(`${vi.verdict === 'DROP' ? 'dropped' : 'rejected'}-at:${h.id}:INPUT`, h, p.dst);
        track();
        record(w, { host: h.id, iface: 'lo', dir: 'out', srcMac: '00:00:00:00:00:00', dstMac: '00:00:00:00:00:00', l3: 'ip', proto: p.proto, src: p.src, dst: p.dst, sport: p.sport, dport: p.dport, ttl: p.ttl, info: p.info, len: p.len });
        w.clock += 0.01;
        ms += 0.01;
      } else {
        const v = filterVerdict(h, 'INPUT', v4('i', { inIf }));
        if (v.verdict !== 'ACCEPT') return stop(`${v.verdict === 'DROP' ? 'dropped' : 'rejected'}-at:${h.id}:INPUT`, h, p.dst);
        track();
      }
      w.lastStage = 'delivered';
      return { ok: true, at: h.id, pkt: p, path, ms };
    }

    if (!local) {
      if (!h.ipForward) return stop(`forward-disabled:${h.id}`, h);
      if (p.ttl <= 1) {
        const back = inIf ? ifaceOf(h, inIf)?.addrs[0] : undefined;
        return stop(`ttl-exceeded:${h.id}`, h, back ? addrOf(back) : hostAddrs(h)[0]);
      }
      p = { ...p, ttl: p.ttl - 1 };
    }

    const route = lookupRoute(h, p.dst);
    if (!route) {
      if (local) return stop('no-route', h);
      const back = inIf ? ifaceOf(h, inIf)?.addrs[0] : undefined;
      return stop(`no-route:${h.id}`, h, back ? addrOf(back) : undefined);
    }
    if (local && !p.src) p = { ...p, src: srcFor(h, route) ?? '0.0.0.0' };

    const view = v4('f', { inIf, outIf: route.dev });
    const v = filterVerdict(h, local ? 'OUTPUT' : 'FORWARD', view);
    if (v.verdict !== 'ACCEPT') return stop(`${v.verdict === 'DROP' ? 'dropped' : 'rejected'}-at:${h.id}:${local ? 'OUTPUT' : 'FORWARD'}`, h, srcFor(h, route) ?? hostAddrs(h)[0]);
    track();

    // POSTROUTING: SNAT / MASQUERADE for new flows; later packets of a translated flow reuse the mapping.
    if (conn?.nat === 'snat' && dir === 'orig') {
      p = { ...p, src: conn.reply.dst, sport: conn.reply.dport };
    } else if (!natDone && conn && !conn.nat) {
      const r = natRule(h.nf.nat, 'POSTROUTING', { ...view, ctState: 'NEW' });
      if (r && (r.target === 'MASQUERADE' || r.target === 'SNAT')) {
        const out = r.target === 'SNAT' && r.toSrc ? r.toSrc : addrOf(ifaceOf(h, route.dev)?.addrs[0] ?? '0.0.0.0');
        const port = p.proto === 'icmp' ? p.sport : 40000 + (nextId(w) % 20000);
        conn.nat = 'snat';
        conn.reply = { src: conn.orig.dst, sport: conn.orig.dport, dst: out, dport: port };
        p = { ...p, src: out, sport: port };
      }
    }
    state = 'ESTABLISHED';

    const nh = route.via ?? p.dst;
    const egress = ifaceOf(h, route.dev)!;
    const seg = egress.seg ? w.segs[egress.seg] : undefined;
    const peer = arpResolve(w, h, route.dev, nh, srcFor(h, route) ?? p.src);
    if (!peer) return stop(local ? 'arp-no-reply' : `arp-no-reply:${h.id}`, h, srcFor(h, route));
    const lat = (seg?.latency ?? 0.1) + (p.len + 14) * 8 / ((seg?.bandwidthMbps ?? 100) * 1000);
    record(w, { host: h.id, iface: egress.name, dir: 'out', srcMac: egress.mac, dstMac: peer.iface.mac, l3: 'ip', proto: p.proto, src: p.src, dst: p.dst, sport: p.sport, dport: p.dport, ttl: p.ttl, info: p.info, len: p.len });
    w.clock += lat;
    ms += lat;
    if (seg?.dropProto && seg.dropProto === p.proto) return stop(`seg-drop:${seg.id}`, h);
    record(w, { host: peer.host.id, iface: peer.iface.name, dir: 'in', srcMac: egress.mac, dstMac: peer.iface.mac, l3: 'ip', proto: p.proto, src: p.src, dst: p.dst, sport: p.sport, dport: p.dport, ttl: p.ttl, info: p.info, len: p.len });
    h = peer.host;
    inIf = peer.iface.name;
    local = false;
    path.push(h.id);
    found = undefined;
  }
  return stop('loop', h);
}

// ── listeners ──────────────────────────────────────────────────────────────

/** The service that accepts a connection to dst:port on host h, if any (bind address rules as in Linux). */
export function listener(h: Host, proto: 'tcp' | 'udp', dst: string, port: number): Service | undefined {
  return h.services.find((s) => {
    if (s.down || s.proto !== proto || s.port !== port) return false;
    if (s.bind === '0.0.0.0' || s.bind === '*') return true;
    if (s.bind === '127.0.0.1') return inSubnet(dst, '127.0.0.0/8');
    return s.bind === dst;
  });
}

// ── ICMP ───────────────────────────────────────────────────────────────────

export interface EchoResult {
  ok: boolean;
  rtt: number;
  /** TTL of the reply as the sender sees it. */
  ttl?: number;
  /** An ICMP error instead of a reply: who sent it and what it says. */
  error?: { from: string; text: string };
  /** No route on the sender: the packet was never born. */
  noRoute?: boolean;
  stage?: string;
  /** For traceroute: the address that answered (reply or time exceeded). */
  from?: string;
}

const ICMP_TEXT: Record<string, string> = {
  host: 'Destination Host Unreachable',
  net: 'Destination Net Unreachable',
  port: 'Destination Port Unreachable',
  admin: 'Destination Host Prohibited',
  ttl: 'Time to live exceeded',
};

export function sendIcmpError(w: World, fromHost: string, fromAddr: string | undefined, cause: Packet, kind: keyof typeof ICMP_TEXT): boolean {
  const to = cause.src;
  if (!fromAddr) return false;
  const code = ({ host: 1, net: 0, port: 3, admin: 10, ttl: 0 } as Record<string, number>)[kind] ?? 0;
  const type = kind === 'ttl' ? 11 : 3;
  const err: Packet = { proto: 'icmp', src: fromAddr, dst: to, sport: 0, dport: 0, ttl: 64, len: 56, icmp: { type, code }, info: `ICMP ${kind === 'ttl' ? 'time exceeded in-transit' : `${cause.dst} ${kind === 'port' ? `${cause.proto} port ${cause.dport}` : kind} unreachable`}, length 36`, embedded: tupleOf(cause) };
  return transmit(w, fromHost, err).ok;
}

/** One ICMP echo request and its reply, the way `ping` sees it. */
export function icmpEcho(w: World, from: string, dst: string, o: { ttl?: number; size?: number; seq?: number; id?: number } = {}): EchoResult {
  const id = o.id ?? nextId(w);
  const seq = o.seq ?? 1;
  const size = o.size ?? 56;
  const req: Packet = { proto: 'icmp', src: '', dst, sport: id, dport: id, ttl: o.ttl ?? 64, len: size + 28, icmp: { type: 8, code: 0 }, info: `ICMP echo request, id ${id}, seq ${seq}, length ${size + 8}` };
  const t0 = w.clock;
  const d = transmit(w, from, req);
  if (!d.ok) {
    const stage = d.stage ?? '';
    if (stage === 'no-route') return { ok: false, rtt: 0, noRoute: true, stage };
    if (stage === 'arp-no-reply') return { ok: false, rtt: 0, stage, error: { from: d.stopAddr ?? d.pkt.src, text: ICMP_TEXT.host } };
    const at = w.hosts[d.at];
    if (stage.startsWith('ttl-exceeded:')) {
      const back = sendIcmpError(w, d.at, d.stopAddr, d.pkt, 'ttl');
      return back ? { ok: false, rtt: w.clock - t0, stage, error: { from: d.stopAddr!, text: ICMP_TEXT.ttl }, from: d.stopAddr } : { ok: false, rtt: 0, stage };
    }
    if (stage.startsWith('no-route:') || stage.startsWith('arp-no-reply:')) {
      const back = sendIcmpError(w, d.at, d.stopAddr ?? hostAddrs(at)[0], d.pkt, stage.startsWith('no-route:') ? 'net' : 'host');
      return back ? { ok: false, rtt: w.clock - t0, stage, error: { from: d.stopAddr ?? hostAddrs(at)[0], text: stage.startsWith('no-route:') ? ICMP_TEXT.net : ICMP_TEXT.host } } : { ok: false, rtt: 0, stage };
    }
    if (stage.startsWith('rejected-at:')) {
      sendIcmpError(w, d.at, d.stopAddr ?? hostAddrs(at)[0], d.pkt, 'port');
      return { ok: false, rtt: w.clock - t0, stage, error: { from: d.stopAddr ?? hostAddrs(at)[0], text: ICMP_TEXT.port } };
    }
    w.clock += 1000;
    return { ok: false, rtt: 0, stage };
  }
  const target = w.hosts[d.at];
  const rep: Packet = { proto: 'icmp', src: d.pkt.dst, dst: d.pkt.src, sport: d.pkt.dport, dport: d.pkt.sport, ttl: 64, len: req.len, icmp: { type: 0, code: 0 }, info: `ICMP echo reply, id ${id}, seq ${seq}, length ${size + 8}` };
  const back = transmit(w, target.id, rep);
  if (!back.ok) {
    w.clock += 1000;
    return { ok: false, rtt: 0, stage: `reply-${back.stage === 'no-route' ? 'no-route' : back.stage}` };
  }
  const hops = d.path.length - 1;
  return { ok: true, rtt: Math.max(0.03, w.clock - t0), ttl: 64 - Math.max(0, hops - 1), from: rep.src };
}

// ── TCP ────────────────────────────────────────────────────────────────────

export type ConnectError = 'refused' | 'timeout' | 'unreachable' | 'no-route' | 'reset';

export interface ConnectResult {
  ok: boolean;
  error?: ConnectError;
  /** Who answered the connection (after DNAT). */
  host?: string;
  service?: Service;
  /** Handshake time: one RTT. */
  rtt: number;
  /** Time until the error was known. */
  ms: number;
  stage?: string;
  sport: number;
  /** The address the server saw as the client (after SNAT). */
  seenSrc?: string;
  /** The server address after DNAT. */
  realDst?: string;
  realPort?: number;
  syns?: number;
}

const SYN_OPTS = 'options [mss 1460,sackOK,TS val 1 ecr 0,nop,wscale 7]';

/**
 * A TCP handshake from `from` to dst:port. `timeoutMs` is the caller's connect
 * timeout (curl --connect-timeout, nginx proxy_connect_timeout); without one the
 * kernel gives up after 6 SYN retries (net.ipv4.tcp_syn_retries), about 127 s.
 */
export function tcpConnect(w: World, from: string, dst: string, port: number, o: { timeoutMs?: number; sport?: number } = {}): ConnectResult {
  const sport = o.sport ?? ephemeralPort(w);
  const isn = 1000 + nextId(w);
  const syn: Packet = { proto: 'tcp', src: '', dst, sport, dport: port, ttl: 64, len: 60, flags: 'S', info: `Flags [S], seq ${isn}, win 64240, ${SYN_OPTS}, length 0` };
  const t0 = w.clock;
  const d = transmit(w, from, syn);
  const fail = (error: ConnectError, ms: number, stage?: string, syns = 1): ConnectResult => ({ ok: false, error, rtt: 0, ms, stage, sport, syns });
  if (!d.ok) {
    const st = d.stage ?? '';
    if (st === 'no-route') return fail('no-route', 0, st);
    if (st === 'arp-no-reply') return fail('unreachable', 3000, st);
    if (st.startsWith('rejected-at:')) {
      sendIcmpError(w, d.at, d.stopAddr, d.pkt, 'port');
      return fail('refused', w.clock - t0, st);
    }
    if (st.startsWith('no-route:') || st.startsWith('arp-no-reply:')) {
      const back = sendIcmpError(w, d.at, d.stopAddr ?? hostAddrs(w.hosts[d.at])[0], d.pkt, 'host');
      if (back) return fail('unreachable', w.clock - t0, st);
    }
    // Silence: SYN is retransmitted after 1, 2, 4, 8, 16, 32 s; the kernel gives up 64 s after the last one.
    return synRetries(w, from, syn, t0, o.timeoutMs, st, sport);
  }
  const srv = w.hosts[d.at];
  const svc = listener(srv, 'tcp', d.pkt.dst, d.pkt.dport);
  const reply = (flags: string, info: string): Delivery =>
    transmit(w, srv.id, { proto: 'tcp', src: d.pkt.dst, dst: d.pkt.src, sport: d.pkt.dport, dport: d.pkt.sport, ttl: 64, len: flags === 'R.' ? 40 : 60, flags, info });
  if (!svc) {
    const back = reply('R.', `Flags [R.], seq 0, ack ${isn + 1}, win 0, length 0`);
    if (!back.ok) return synRetries(w, from, syn, t0, o.timeoutMs, `reply-${back.stage}`, sport);
    return { ...fail('refused', w.clock - t0, 'port-closed'), host: srv.id };
  }
  const sisn = 5000 + nextId(w);
  const back = reply('S.', `Flags [S.], seq ${sisn}, ack ${isn + 1}, win 65160, ${SYN_OPTS}, length 0`);
  if (!back.ok) return synRetries(w, from, syn, t0, o.timeoutMs, `reply-${back.stage}`, sport);
  transmit(w, from, { proto: 'tcp', src: syn.src || back.pkt.dst, dst, sport, dport: port, ttl: 64, len: 52, flags: '.', info: `Flags [.], ack 1, win 502, length 0` });
  const rtt = w.clock - t0;
  return { ok: true, host: srv.id, service: svc, rtt, ms: rtt, sport, seenSrc: d.pkt.src, realDst: d.pkt.dst, realPort: d.pkt.dport };
}

function synRetries(w: World, from: string, syn: Packet, t0: number, timeoutMs: number | undefined, stage: string, sport: number): ConnectResult {
  const schedule = [1000, 2000, 4000, 8000, 16000, 32000];
  let t = 0;
  let syns = 1;
  for (const gap of schedule) {
    if (timeoutMs !== undefined && t + gap > timeoutMs) break;
    t += gap;
    w.clock = t0 + t;
    syns++;
    const r = lookupRoute(w.hosts[from], syn.dst);
    const src = syn.src || (r ? srcFor(w.hosts[from], r) : '') || '';
    record(w, { host: from, iface: r?.dev ?? 'eth0', dir: 'out', srcMac: r ? macOf(w.hosts[from], r.dev) : '', dstMac: '', l3: 'ip', proto: 'tcp', src, dst: syn.dst, sport, dport: syn.dport, ttl: 64, info: syn.info, len: syn.len });
  }
  const total = timeoutMs !== undefined ? Math.min(timeoutMs, 127000) : 127000;
  w.clock = t0 + total;
  return { ok: false, error: 'timeout', rtt: 0, ms: total, stage, sport, syns };
}

/** Send a data segment over an open connection (for captures); returns the one-way latency. */
export function tcpData(w: World, from: string, to: string, sport: number, dport: number, bytes: number, info: string): number {
  const t0 = w.clock;
  transmit(w, from, { proto: 'tcp', src: '', dst: to, sport, dport, ttl: 64, len: 52 + bytes, flags: 'P.', info: `Flags [P.], seq 1:${bytes + 1}, ack 1, win 502, length ${bytes}${info ? `: ${info}` : ''}` });
  return w.clock - t0;
}

// ── UDP ────────────────────────────────────────────────────────────────────

export interface UdpResult {
  ok: boolean;
  /** The receiving host and service. */
  host?: string;
  service?: Service;
  rtt: number;
  stage?: string;
  /** Source as the server saw it. */
  seenSrc?: string;
  sport: number;
}

/**
 * A UDP datagram from `from` to dst:port and, when `answer` is given, the reply
 * datagram. No reply within the time means silence for the caller (dig waits
 * for its timeout).
 */
export function udpExchange(w: World, from: string, dst: string, port: number, q: { info: string; len: number; answerInfo?: (svc: Service, host: Host) => { info: string; len: number } | null; src?: string }): UdpResult {
  const sport = ephemeralPort(w);
  const t0 = w.clock;
  const d = transmit(w, from, { proto: 'udp', src: q.src ?? '', dst, sport, dport: port, ttl: 64, len: q.len, info: q.info });
  if (!d.ok) return { ok: false, rtt: 0, stage: d.stage, sport };
  const host = w.hosts[d.at];
  const svc = listener(host, 'udp', d.pkt.dst, d.pkt.dport);
  if (!svc) {
    sendIcmpError(w, host.id, d.pkt.dst, d.pkt, 'port');
    return { ok: false, rtt: 0, stage: 'port-closed', host: host.id, sport };
  }
  const a = q.answerInfo?.(svc, host);
  if (!a) return { ok: true, host: host.id, service: svc, rtt: w.clock - t0, seenSrc: d.pkt.src, sport };
  const back = transmit(w, host.id, { proto: 'udp', src: d.pkt.dst, dst: d.pkt.src, sport: d.pkt.dport, dport: d.pkt.sport, ttl: 64, len: a.len, info: a.info });
  if (!back.ok) return { ok: false, rtt: 0, stage: `reply-${back.stage}`, host: host.id, sport };
  return { ok: true, host: host.id, service: svc, rtt: w.clock - t0, seenSrc: d.pkt.src, sport };
}

// ── files of hosts ─────────────────────────────────────────────────────────

export function readHostFile(w: World, io: FileIo | undefined, hostId: string, path: string): string | undefined {
  if (hostId === w.local && io) return io.read(path);
  return w.hosts[hostId]?.files[path];
}

export function appendHostFile(w: World, io: FileIo | undefined, hostId: string, path: string, text: string): void {
  if (hostId === w.local) {
    if (!w.dry && io) io.append(path, text);
    return;
  }
  const h = w.hosts[hostId];
  if (h) h.files[path] = (h.files[path] ?? '') + text;
}

/** Deep copy for probes (checks run on a copy and never change the learner's world). */
export function cloneWorld(w: World): World {
  return JSON.parse(JSON.stringify(w)) as World;
}

export function isAddr(s: string): boolean {
  return isIp(s);
}

export { parseIp };
