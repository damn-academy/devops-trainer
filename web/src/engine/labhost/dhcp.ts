// DHCP server of the lab host (RFC 2131/2132 subset): DISCOVER → OFFER,
// REQUEST → ACK or NAK, RELEASE, INFORM. Fixed leases come from the cloud
// (a VM's MAC → its address); other machines get an address from a pool.

import type { Datagram, LabHost } from './host';
import { BROADCAST_MAC, maskOf, numToIp, put16, put32, u16, u32, utf8, type Mac, macBytes, macString } from './wire';

export interface Lease {
  ip: number;
  prefix: number;
  gateway: number;
  dns: number[];
  domain: string;
  hostname?: string;
  /** Seconds. */
  leaseTime?: number;
}

export interface DhcpPool {
  vlan: number;
  /** First and last address of the dynamic range. */
  from: number;
  to: number;
  prefix: number;
  gateway: number;
  dns: number[];
  domain: string;
}

export interface DhcpEvent {
  type: 'DISCOVER' | 'OFFER' | 'REQUEST' | 'ACK' | 'NAK' | 'RELEASE' | 'INFORM';
  mac: Mac;
  vlan: number;
  ip?: string;
  hostname?: string;
}

const MAGIC = 0x63825363;
const T = { DISCOVER: 1, OFFER: 2, REQUEST: 3, DECLINE: 4, ACK: 5, NAK: 6, RELEASE: 7, INFORM: 8 } as const;

export interface DhcpMessage {
  op: number;
  xid: number;
  flags: number;
  ciaddr: number;
  yiaddr: number;
  chaddr: Mac;
  options: Map<number, Uint8Array>;
}

export function parseDhcp(b: Uint8Array): DhcpMessage | null {
  if (b.length < 240 || u32(b, 236) !== MAGIC) return null;
  const options = new Map<number, Uint8Array>();
  for (let i = 240; i < b.length; ) {
    const code = b[i++];
    if (code === 0) continue;
    if (code === 255) break;
    const len = b[i++];
    options.set(code, b.subarray(i, i + len));
    i += len;
  }
  return { op: b[0], xid: u32(b, 4), flags: u16(b, 10), ciaddr: u32(b, 12), yiaddr: u32(b, 16), chaddr: macString(b, 28), options };
}

export function buildDhcp(m: { op: number; xid: number; flags?: number; ciaddr?: number; yiaddr?: number; siaddr?: number; chaddr: Mac; options: [number, Uint8Array][] }): Uint8Array {
  let olen = 0;
  for (const [, v] of m.options) olen += 2 + v.length;
  const b = new Uint8Array(Math.max(300, 240 + olen + 1));
  b[0] = m.op;
  b[1] = 1;
  b[2] = 6;
  put32(b, 4, m.xid);
  put16(b, 10, m.flags ?? 0);
  put32(b, 12, m.ciaddr ?? 0);
  put32(b, 16, m.yiaddr ?? 0);
  put32(b, 20, m.siaddr ?? 0);
  b.set(macBytes(m.chaddr), 28);
  put32(b, 236, MAGIC);
  let i = 240;
  for (const [k, v] of m.options) {
    b[i++] = k;
    b[i++] = v.length;
    b.set(v, i);
    i += v.length;
  }
  b[i] = 255;
  return b;
}

const ip4b = (n: number) => {
  const b = new Uint8Array(4);
  put32(b, 0, n);
  return b;
};
const u32b = ip4b;

export class DhcpServer {
  /** Fixed leases: `${vlan}/${mac}`. */
  private fixed = new Map<string, Lease>();
  private pools = new Map<number, DhcpPool>();
  /** Dynamic leases: `${vlan}/${mac}` → ip. */
  private dynamic = new Map<string, { ip: number; hostname?: string; at: number }>();
  private fns = new Set<(e: DhcpEvent) => void>();

  constructor(private host: LabHost) {
    host.bindUdp(67, (d, reply) => this.onPacket(d, reply));
  }

  on(fn: (e: DhcpEvent) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }

  private emit(e: DhcpEvent) {
    for (const f of this.fns) f(e);
  }

  setFixed(vlan: number, mac: Mac, lease: Lease): void {
    this.fixed.set(`${vlan}/${mac.toLowerCase()}`, lease);
  }

  removeFixed(vlan: number, mac: Mac): void {
    this.fixed.delete(`${vlan}/${mac.toLowerCase()}`);
  }

  setPool(p: DhcpPool): void {
    this.pools.set(p.vlan, p);
  }

  removePool(vlan: number): void {
    this.pools.delete(vlan);
  }

  leases(): { vlan: number; mac: Mac; ip: string; hostname?: string; fixed: boolean }[] {
    const out: { vlan: number; mac: Mac; ip: string; hostname?: string; fixed: boolean }[] = [];
    for (const [k, v] of this.dynamic) {
      const [vlan, mac] = k.split('/');
      out.push({ vlan: Number(vlan), mac, ip: numToIp(v.ip), hostname: v.hostname, fixed: false });
    }
    return out;
  }

  private usedIps(vlan: number): Set<number> {
    const s = new Set<number>();
    for (const [k, v] of this.fixed) if (k.startsWith(`${vlan}/`)) s.add(v.ip);
    for (const [k, v] of this.dynamic) if (k.startsWith(`${vlan}/`)) s.add(v.ip);
    return s;
  }

  /** The lease this client would get, allocating from the pool when needed. */
  private leaseFor(vlan: number, mac: Mac, hostname?: string, allocate = true): Lease | null {
    const key = `${vlan}/${mac}`;
    const f = this.fixed.get(key);
    if (f) return f;
    const pool = this.pools.get(vlan);
    if (!pool) return null;
    let d = this.dynamic.get(key);
    if (!d && allocate) {
      const used = this.usedIps(vlan);
      for (let ip = pool.from; ip <= pool.to; ip++)
        if (!used.has(ip)) {
          d = { ip, hostname, at: this.host.clock.now() };
          this.dynamic.set(key, d);
          break;
        }
    }
    if (!d) return null;
    if (hostname) d.hostname = hostname;
    return { ip: d.ip, prefix: pool.prefix, gateway: pool.gateway, dns: pool.dns, domain: pool.domain, hostname: undefined };
  }

  /** Address handed to a MAC (dynamic or fixed), for name lookups. */
  hostnames(): { name: string; ip: number }[] {
    const out: { name: string; ip: number }[] = [];
    for (const v of this.dynamic.values()) if (v.hostname) out.push({ name: v.hostname, ip: v.ip });
    return out;
  }

  private onPacket(d: Datagram, reply: (data: Uint8Array, o?: { dst?: number; dstMac?: Mac; src?: number }) => void) {
    const m = parseDhcp(d.data);
    if (!m || m.op !== 1) return;
    const type = m.options.get(53)?.[0];
    const mac = m.chaddr.toLowerCase();
    const hostOpt = m.options.get(12);
    const hostname = hostOpt ? new TextDecoder().decode(hostOpt) : undefined;
    const reqOpt = m.options.get(50);
    const requested = reqOpt && reqOpt.length === 4 ? u32(reqOpt, 0) : m.ciaddr;
    const server = d.dst || (this.host.interfaces().find((f) => f.vlan === d.vlan)?.addrs[0]?.ip ?? 0);
    const name = (t: number) => (Object.entries(T).find(([, v]) => v === t)?.[0] ?? 'DISCOVER') as DhcpEvent['type'];
    if (type !== undefined) this.emit({ type: name(type), mac, vlan: d.vlan, ip: requested ? numToIp(requested) : undefined, hostname });

    const send = (msgType: number, lease: Lease | null, yiaddr: number) => {
      const opts: [number, Uint8Array][] = [
        [53, Uint8Array.of(msgType)],
        [54, ip4b(server)],
      ];
      if (lease && msgType !== T.NAK) {
        opts.push([51, u32b(lease.leaseTime ?? 3600)], [58, u32b(Math.floor((lease.leaseTime ?? 3600) / 2))], [1, ip4b(maskOf(lease.prefix))], [3, ip4b(lease.gateway)]);
        if (lease.dns.length) {
          const b = new Uint8Array(lease.dns.length * 4);
          lease.dns.forEach((x, i) => put32(b, i * 4, x));
          opts.push([6, b]);
        }
        if (lease.domain) opts.push([15, utf8(lease.domain)]);
        if (lease.hostname) opts.push([12, utf8(lease.hostname)]);
        const bcast = ((yiaddr & maskOf(lease.prefix)) | ~maskOf(lease.prefix)) >>> 0;
        opts.push([28, ip4b(bcast)]);
      }
      const out = buildDhcp({ op: 2, xid: m.xid, flags: m.flags, ciaddr: msgType === T.ACK ? m.ciaddr : 0, yiaddr, siaddr: server, chaddr: mac, options: opts });
      // Broadcast the answer: the client has no address yet (and busybox udhcpc expects it).
      const unicast = m.ciaddr !== 0 && msgType !== T.NAK;
      reply(out, unicast ? { dst: m.ciaddr, src: server } : { dst: 0xffffffff, dstMac: BROADCAST_MAC, src: server });
      this.emit({ type: name(msgType), mac, vlan: d.vlan, ip: yiaddr ? numToIp(yiaddr) : undefined, hostname });
    };

    if (type === T.DISCOVER) {
      const lease = this.leaseFor(d.vlan, mac, hostname);
      if (lease) send(T.OFFER, lease, lease.ip);
    } else if (type === T.REQUEST) {
      const lease = this.leaseFor(d.vlan, mac, hostname);
      if (!lease) return;
      if (requested && requested !== lease.ip) send(T.NAK, null, 0);
      else send(T.ACK, lease, lease.ip);
    } else if (type === T.INFORM) {
      const lease = this.leaseFor(d.vlan, mac, hostname, false);
      if (lease) send(T.ACK, { ...lease }, 0);
    } else if (type === T.RELEASE || type === T.DECLINE) {
      this.dynamic.delete(`${d.vlan}/${mac}`);
    }
  }
}
