// The lab host: a network host written in TypeScript and plugged into
// dt-switch like any machine (design 00 §6.13). It owns 10.0.0.1 on the
// default network and the gateway address of every cloud subnet (one
// interface per VLAN on a trunk port), answers ARP and ping, routes between
// subnets of one network, serves UDP (DHCP, DNS) and TCP (HTTP services), and
// can open TCP connections to machines itself (load balancer, webhooks).
//
// The class knows nothing about v86: frames come in through `input(frame)`
// and leave through the `output` callback (attach() wires both to a switch).

import type { L2Switch } from '../v86/switch';
import { realClock, TcpConn, type Clock, type Endpoint } from './tcp';
import {
  ACK,
  BROADCAST_MAC,
  buildArp,
  buildEth,
  buildIcmp,
  buildIp4,
  buildTcp,
  buildUdp,
  ETH_ARP,
  ETH_IP4,
  inCidr,
  maskOf,
  numToIp,
  parseArp,
  parseEth,
  parseIp4,
  parseTcp,
  parseUdp,
  PROTO_ICMP,
  PROTO_TCP,
  PROTO_UDP,
  RST,
  SYN,
  type Cidr,
  type Mac,
  type Tcp,
} from './wire';

export const LABHOST_MAC: Mac = '02:64:74:ff:00:01';

export interface Iface {
  vlan: number;
  mac: Mac;
  /** Addresses on this VLAN; the first one is primary. prefix 32 = an extra address (VIP). */
  addrs: { ip: number; prefix: number }[];
  /** Interfaces of one group route to each other (a cloud network); '' routes nowhere. */
  group: string;
}

export interface Datagram {
  vlan: number;
  srcMac: Mac;
  src: number;
  sport: number;
  dst: number;
  dport: number;
  data: Uint8Array;
}

export type UdpHandler = (d: Datagram, reply: (data: Uint8Array, o?: { dst?: number; dstMac?: Mac; src?: number }) => void) => void;

export interface Listener {
  port: number;
  /** Only connections to these local addresses (undefined: any of ours). */
  accept?: (local: number, vlan: number) => boolean;
  onConn: (c: TcpConn) => void;
}

export type HostEvent =
  | { t: 'icmp'; vlan: number; from: string; to: string; type: number }
  | { t: 'udp'; vlan: number; from: string; port: number; bytes: number }
  | { t: 'tcp.open'; vlan: number; from: string; to: string; port: number; active: boolean }
  | { t: 'tcp.close'; vlan: number; from: string; to: string; port: number; rx: number; tx: number; ms: number; err?: string }
  | { t: 'route'; from: string; to: string; ok: boolean; reason?: string }
  | { t: 'drop'; reason: string };

/** Decides whether the host forwards a routed packet (security groups between subnets). */
export type ForwardFilter = (p: { src: number; dst: number; proto: number; dport?: number; inVlan: number; outVlan: number }) => string | null;

interface ArpWait {
  frames: { build: (mac: Mac) => Uint8Array }[];
  tries: number;
  timer: unknown;
}

export interface LabHostOptions {
  clock?: Clock;
  mac?: Mac;
}

export class LabHost {
  readonly clock: Clock;
  readonly mac: Mac;
  private ifaces = new Map<number, Iface>();
  private arp = new Map<string, { mac: Mac; at: number }>();
  private arpWait = new Map<string, ArpWait>();
  private udp = new Map<number, UdpHandler>();
  private listeners = new Map<number, Listener[]>();
  private conns = new Map<string, TcpConn>();
  private listenersBus = new Set<(e: HostEvent) => void>();
  private nextPort = 40000;
  private ipId = 1;
  private queue: Uint8Array[] = [];
  private flushing = false;
  forwardFilter: ForwardFilter | null = null;
  /** Where frames leave the host (set by attach()). */
  output: ((frame: Uint8Array) => void) | null = null;
  stats = { rxFrames: 0, txFrames: 0, rxBytes: 0, txBytes: 0 };

  constructor(o: LabHostOptions = {}) {
    this.clock = o.clock ?? realClock;
    this.mac = o.mac ?? LABHOST_MAC;
  }

  on(fn: (e: HostEvent) => void): () => void {
    this.listenersBus.add(fn);
    return () => this.listenersBus.delete(fn);
  }

  private emit(e: HostEvent) {
    for (const fn of this.listenersBus) fn(e);
  }

  // ── interfaces and addresses ──

  addInterface(vlan: number, ip: number, prefix: number, group = 'default'): Iface {
    let f = this.ifaces.get(vlan);
    if (!f) {
      f = { vlan, mac: this.mac, addrs: [], group };
      this.ifaces.set(vlan, f);
    }
    if (!f.addrs.some((a) => a.ip === ip)) f.addrs.push({ ip, prefix });
    f.group = group;
    return f;
  }

  removeAddress(vlan: number, ip: number): void {
    const f = this.ifaces.get(vlan);
    if (!f) return;
    f.addrs = f.addrs.filter((a) => a.ip !== ip);
    if (!f.addrs.length) this.ifaces.delete(vlan);
  }

  /** An extra address (a load balancer VIP, the metadata address). */
  addAddress(vlan: number, ip: number): void {
    const f = this.ifaces.get(vlan);
    if (!f) throw new Error(`no interface on VLAN ${vlan}`);
    if (!f.addrs.some((a) => a.ip === ip)) f.addrs.push({ ip, prefix: 32 });
  }

  interfaces(): Iface[] {
    return [...this.ifaces.values()];
  }

  vlans(): number[] {
    return [...this.ifaces.keys()].sort((a, b) => a - b);
  }

  owns(vlan: number, ip: number): boolean {
    return !!this.ifaces.get(vlan)?.addrs.some((a) => a.ip === ip);
  }

  /** Our address on the subnet of `peer` on this VLAN (the source for replies). */
  private srcFor(vlan: number, peer: number): number | null {
    const f = this.ifaces.get(vlan);
    if (!f) return null;
    for (const a of f.addrs) if (a.prefix < 32 && inCidr(peer, { net: (a.ip & maskOf(a.prefix)) >>> 0, prefix: a.prefix, mask: maskOf(a.prefix) })) return a.ip;
    return f.addrs[0]?.ip ?? null;
  }

  private onLink(vlan: number, ip: number): boolean {
    const f = this.ifaces.get(vlan);
    return !!f?.addrs.some((a) => a.prefix < 32 && ((ip & maskOf(a.prefix)) >>> 0) === ((a.ip & maskOf(a.prefix)) >>> 0));
  }

  /** The interface whose subnet holds `ip`. */
  routeTo(ip: number): Iface | null {
    let best: Iface | null = null;
    let bestPrefix = -1;
    for (const f of this.ifaces.values())
      for (const a of f.addrs) {
        if (a.prefix >= 32) continue;
        const c: Cidr = { net: (a.ip & maskOf(a.prefix)) >>> 0, prefix: a.prefix, mask: maskOf(a.prefix) };
        if (inCidr(ip, c) && a.prefix > bestPrefix) {
          best = f;
          bestPrefix = a.prefix;
        }
      }
    return best;
  }

  // ── switch ──

  /** Plug into a switch as a trunk port: VLAN 1 untagged, the others tagged. */
  attach(sw: L2Switch, portId = 'labhost'): () => void {
    sw.addPort(portId, { mode: 'trunk', vlan: 1, vlans: this.vlans().filter((v) => v !== 1) }, (f) => this.input(f));
    this.output = (f) => sw.receive(portId, f);
    this.syncPort = () => sw.setPort(portId, { mode: 'trunk', vlan: 1, vlans: this.vlans().filter((v) => v !== 1) });
    return () => {
      this.output = null;
      this.syncPort = null;
      sw.removePort(portId);
    };
  }

  /** Call after adding or removing interfaces so the trunk carries the right VLANs. */
  syncPort: (() => void) | null = null;

  private send(frame: Uint8Array) {
    this.stats.txFrames++;
    this.stats.txBytes += frame.length;
    this.queue.push(frame);
    if (this.flushing) return;
    this.flushing = true;
    // Never call back into the switch from inside its own receive().
    queueMicrotask(() => {
      this.flushing = false;
      const q = this.queue;
      this.queue = [];
      for (const f of q) this.output?.(f);
    });
  }

  private ethOut(vlan: number, dst: Mac, type: number, payload: Uint8Array) {
    this.send(buildEth(dst, this.mac, type, payload, vlan === 1 ? undefined : vlan));
  }

  // ── input ──

  input(frame: Uint8Array): void {
    this.stats.rxFrames++;
    this.stats.rxBytes += frame.length;
    const e = parseEth(frame);
    if (!e) return;
    const vlan = e.vlan ?? 1;
    const f = this.ifaces.get(vlan);
    if (!f) return;
    if (e.dst !== this.mac && e.dst !== BROADCAST_MAC) return;
    if (e.type === ETH_ARP) this.onArp(vlan, e.payload);
    else if (e.type === ETH_IP4) this.onIp(vlan, e.src, e.dst, e.payload);
  }

  private learn(vlan: number, ip: number, mac: Mac) {
    if (ip === 0 || mac === BROADCAST_MAC) return;
    const key = `${vlan}/${ip}`;
    this.arp.set(key, { mac, at: this.clock.now() });
    const w = this.arpWait.get(key);
    if (w) {
      this.arpWait.delete(key);
      this.clock.clearTimeout(w.timer);
      for (const x of w.frames) this.send(x.build(mac));
    }
  }

  private onArp(vlan: number, p: Uint8Array) {
    const a = parseArp(p);
    if (!a) return;
    if (this.onLink(vlan, a.spa)) this.learn(vlan, a.spa, a.sha);
    if (a.op === 1 && this.owns(vlan, a.tpa)) {
      this.ethOut(vlan, a.sha, ETH_ARP, buildArp({ op: 2, sha: this.mac, spa: a.tpa, tha: a.sha, tpa: a.spa }));
    }
  }

  /** The MAC address of `ip` on this VLAN, if known. */
  arpLookup(vlan: number, ip: number): Mac | undefined {
    return this.arp.get(`${vlan}/${ip}`)?.mac;
  }

  arpTable(): { vlan: number; ip: string; mac: Mac }[] {
    return [...this.arp.entries()].map(([k, v]) => {
      const [vlan, ip] = k.split('/');
      return { vlan: Number(vlan), ip: numToIp(Number(ip)), mac: v.mac };
    });
  }

  /** Send an IP packet; resolves the next hop's MAC with ARP when needed. */
  sendIp(vlan: number, src: number, dst: number, proto: number, payload: Uint8Array, dstMac?: Mac, ttl = 64): void {
    const pkt = buildIp4({ src, dst, proto, payload, ttl, id: this.ipId++ & 0xffff });
    if (dstMac) return this.ethOut(vlan, dstMac, ETH_IP4, pkt);
    if (dst === 0xffffffff) return this.ethOut(vlan, BROADCAST_MAC, ETH_IP4, pkt);
    const known = this.arpLookup(vlan, dst);
    if (known) return this.ethOut(vlan, known, ETH_IP4, pkt);
    this.resolve(vlan, dst, src, (mac) => buildEth(mac, this.mac, ETH_IP4, pkt, vlan === 1 ? undefined : vlan));
  }

  private resolve(vlan: number, ip: number, src: number, build: (mac: Mac) => Uint8Array) {
    const key = `${vlan}/${ip}`;
    let w = this.arpWait.get(key);
    if (w) {
      if (w.frames.length < 64) w.frames.push({ build });
      return;
    }
    w = { frames: [{ build }], tries: 0, timer: null };
    this.arpWait.set(key, w);
    const ask = () => {
      const cur = this.arpWait.get(key);
      if (!cur) return;
      if (cur.tries++ >= 3) {
        this.arpWait.delete(key);
        this.emit({ t: 'drop', reason: `no ARP reply from ${numToIp(ip)}` });
        return;
      }
      this.ethOut(vlan, BROADCAST_MAC, ETH_ARP, buildArp({ op: 1, sha: this.mac, spa: src, tha: '00:00:00:00:00:00', tpa: ip }));
      cur.timer = this.clock.setTimeout(ask, 1000);
    };
    ask();
  }

  private onIp(vlan: number, srcMac: Mac, dstMac: Mac, p: Uint8Array) {
    const ip = parseIp4(p);
    if (!ip) return;
    if (this.onLink(vlan, ip.src)) this.learn(vlan, ip.src, srcMac);
    const forUs = this.owns(vlan, ip.dst) || ip.dst === 0xffffffff || (dstMac === BROADCAST_MAC && ip.proto === PROTO_UDP);
    if (!forUs) {
      if (dstMac === this.mac) this.forward(vlan, ip, p);
      return;
    }
    if (ip.fragment) {
      this.emit({ t: 'drop', reason: `IP fragment from ${numToIp(ip.src)}` });
      return;
    }
    if (ip.proto === PROTO_ICMP) this.onIcmp(vlan, ip.src, ip.dst, ip.payload);
    else if (ip.proto === PROTO_UDP) this.onUdp(vlan, srcMac, ip.src, ip.dst, ip.payload, p);
    else if (ip.proto === PROTO_TCP) this.onTcp(vlan, ip.src, ip.dst, ip.payload);
  }

  private forward(inVlan: number, ip: NonNullable<ReturnType<typeof parseIp4>>, raw: Uint8Array) {
    const from = numToIp(ip.src);
    const to = numToIp(ip.dst);
    const out = this.routeTo(ip.dst);
    const inIf = this.ifaces.get(inVlan);
    const fail = (reason: string, icmp?: [number, number]) => {
      this.emit({ t: 'route', from, to, ok: false, reason });
      const src = this.srcFor(inVlan, ip.src);
      if (icmp && src !== null && (ip.proto !== PROTO_ICMP || ip.payload[0] === 8)) {
        const quote = raw.subarray(0, Math.min(raw.length, (raw[0] & 15) * 4 + 8));
        const rest = new Uint8Array(4 + quote.length);
        rest.set(quote, 4);
        this.sendIp(inVlan, src, ip.src, PROTO_ICMP, buildIcmp(icmp[0], icmp[1], rest));
      }
    };
    if (!out || !inIf || !out.group || out.group !== inIf.group) return fail('no route', [3, 0]);
    if (ip.ttl <= 1) return fail('TTL exceeded', [11, 0]);
    if (this.forwardFilter) {
      const dport = ip.proto === PROTO_TCP || ip.proto === PROTO_UDP ? (ip.payload[2] << 8) | ip.payload[3] : undefined;
      const why = this.forwardFilter({ src: ip.src, dst: ip.dst, proto: ip.proto, dport, inVlan, outVlan: out.vlan });
      if (why) return fail(why, [3, 13]);
    }
    const copy = raw.slice(0, (raw[0] & 15) * 4 + ip.payload.length);
    copy[8] = ip.ttl - 1;
    copy[10] = 0;
    copy[11] = 0;
    let sum = 0;
    const ihl = (copy[0] & 15) * 4;
    for (let i = 0; i < ihl; i += 2) sum += (copy[i] << 8) | copy[i + 1];
    while (sum > 0xffff) sum = (sum & 0xffff) + (sum >>> 16);
    const c = ~sum & 0xffff;
    copy[10] = c >> 8;
    copy[11] = c & 255;
    this.emit({ t: 'route', from, to, ok: true });
    const mac = this.arpLookup(out.vlan, ip.dst);
    const build = (m: Mac) => buildEth(m, this.mac, ETH_IP4, copy, out.vlan === 1 ? undefined : out.vlan);
    if (mac) this.send(build(mac));
    else this.resolve(out.vlan, ip.dst, out.addrs[0].ip, build);
  }

  private onIcmp(vlan: number, src: number, dst: number, p: Uint8Array) {
    if (p.length < 8) return;
    this.emit({ t: 'icmp', vlan, from: numToIp(src), to: numToIp(dst), type: p[0] });
    if (p[0] === 8 && dst !== 0xffffffff) this.sendIp(vlan, dst, src, PROTO_ICMP, buildIcmp(0, 0, p.subarray(4)));
  }

  // ── UDP ──

  bindUdp(port: number, h: UdpHandler): () => void {
    this.udp.set(port, h);
    return () => this.udp.delete(port);
  }

  private onUdp(vlan: number, srcMac: Mac, src: number, dst: number, p: Uint8Array, raw: Uint8Array) {
    const u = parseUdp(p);
    if (!u) return;
    const h = this.udp.get(u.dport);
    this.emit({ t: 'udp', vlan, from: numToIp(src), port: u.dport, bytes: u.data.length });
    if (!h) {
      if (dst !== 0xffffffff && this.owns(vlan, dst)) {
        // Port unreachable, as a real host answers.
        const quote = raw.subarray(0, Math.min(raw.length, (raw[0] & 15) * 4 + 8));
        const rest = new Uint8Array(4 + quote.length);
        rest.set(quote, 4);
        this.sendIp(vlan, dst, src, PROTO_ICMP, buildIcmp(3, 3, rest));
      }
      return;
    }
    const local = dst === 0xffffffff ? (this.ifaces.get(vlan)?.addrs[0]?.ip ?? 0) : dst;
    h({ vlan, srcMac, src, sport: u.sport, dst: local, dport: u.dport, data: u.data }, (data, o = {}) => {
      const to = o.dst ?? src;
      const from = o.src ?? local;
      this.sendIp(vlan, from, to, PROTO_UDP, buildUdp(from, to, u.dport, u.sport, data), o.dstMac ?? (to === 0xffffffff ? BROADCAST_MAC : undefined));
    });
  }

  // ── TCP ──

  listen(l: Listener): () => void {
    const list = this.listeners.get(l.port) ?? [];
    list.push(l);
    this.listeners.set(l.port, list);
    return () => {
      const cur = this.listeners.get(l.port) ?? [];
      this.listeners.set(
        l.port,
        cur.filter((x) => x !== l),
      );
    };
  }

  connections(): TcpConn[] {
    return [...this.conns.values()];
  }

  private key(vlan: number, local: Endpoint, remote: Endpoint) {
    return `${vlan}|${local.ip}:${local.port}|${remote.ip}:${remote.port}`;
  }

  private makeConn(vlan: number, local: Endpoint, remote: Endpoint, mode: 'active' | 'passive'): TcpConn {
    const key = this.key(vlan, local, remote);
    const c = new TcpConn(
      {
        local,
        remote,
        vlan,
        clock: this.clock,
        send: (t) => this.sendIp(vlan, local.ip, remote.ip, PROTO_TCP, buildTcp(local.ip, remote.ip, t)),
        onGone: (conn) => {
          if (this.conns.get(key) === conn) this.conns.delete(key);
        },
      },
      mode,
    );
    this.conns.set(key, c);
    c.onOpen((err) => {
      if (!err) this.emit({ t: 'tcp.open', vlan, from: numToIp(remote.ip), to: numToIp(local.ip), port: mode === 'passive' ? local.port : remote.port, active: mode === 'active' });
    });
    c.onClose((err) =>
      this.emit({ t: 'tcp.close', vlan, from: numToIp(remote.ip), to: numToIp(local.ip), port: mode === 'passive' ? local.port : remote.port, rx: c.rxBytes, tx: c.txBytes, ms: this.clock.now() - c.openedAt, err }),
    );
    return c;
  }

  private onTcp(vlan: number, src: number, dst: number, p: Uint8Array) {
    const t = parseTcp(p);
    if (!t) return;
    const local = { ip: dst, port: t.dport };
    const remote = { ip: src, port: t.sport };
    const c = this.conns.get(this.key(vlan, local, remote));
    if (c) return c.segment(t);
    if (t.flags & RST) return;
    if (t.flags & SYN && !(t.flags & ACK)) {
      const l = (this.listeners.get(t.dport) ?? []).find((x) => !x.accept || x.accept(dst, vlan));
      if (l) {
        const conn = this.makeConn(vlan, local, remote, 'passive');
        conn.onOpen((err) => {
          if (!err) l.onConn(conn);
        });
        conn.acceptSyn(t);
        return;
      }
    }
    this.reset(vlan, local, remote, t);
  }

  private reset(vlan: number, local: Endpoint, remote: Endpoint, t: Tcp) {
    const seq = t.flags & ACK ? t.ack : 0;
    const ack = (t.seq + t.data.length + (t.flags & SYN ? 1 : 0) + (t.flags & 1 ? 1 : 0)) >>> 0;
    this.sendIp(vlan, local.ip, remote.ip, PROTO_TCP, buildTcp(local.ip, remote.ip, { sport: local.port, dport: remote.port, seq, ack, flags: RST | ACK, window: 0 }));
  }

  /** Open a connection to a machine. Rejects on RST or timeout. */
  connect(ip: number, port: number, o: { vlan?: number; src?: number; timeoutMs?: number } = {}): Promise<TcpConn> {
    const iface = o.vlan !== undefined ? this.ifaces.get(o.vlan) : this.routeTo(ip);
    if (!iface) return Promise.reject(new Error(`no route to ${numToIp(ip)}`));
    const src = o.src ?? this.srcFor(iface.vlan, ip);
    if (src === null) return Promise.reject(new Error(`no address on VLAN ${iface.vlan}`));
    let lport = this.nextPort;
    for (let i = 0; i < 20000; i++) {
      lport = this.nextPort++;
      if (this.nextPort > 60999) this.nextPort = 40000;
      if (!this.conns.has(this.key(iface.vlan, { ip: src, port: lport }, { ip, port }))) break;
    }
    const c = this.makeConn(iface.vlan, { ip: src, port: lport }, { ip, port }, 'active');
    return new Promise((resolve, reject) => {
      const timer = this.clock.setTimeout(() => {
        c.destroy('connection timed out');
        reject(new Error(`connect to ${numToIp(ip)}:${port} timed out`));
      }, o.timeoutMs ?? 5000);
      c.onOpen((err) => {
        this.clock.clearTimeout(timer);
        if (err) reject(new Error(`connect to ${numToIp(ip)}:${port}: ${err}`));
        else resolve(c);
      });
      c.connect();
    });
  }
}
