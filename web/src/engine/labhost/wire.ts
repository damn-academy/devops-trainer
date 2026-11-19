// Wire formats of the lab host: Ethernet II (with 802.1Q), ARP, IPv4, ICMP,
// UDP and TCP. Pure functions over Uint8Array; addresses are numbers (IPv4)
// and 'aa:bb:cc:dd:ee:ff' strings (MAC), like the switch.

export type Mac = string;

export const ETH_ARP = 0x0806;
export const ETH_IP4 = 0x0800;
export const ETH_VLAN = 0x8100;
export const PROTO_ICMP = 1;
export const PROTO_TCP = 6;
export const PROTO_UDP = 17;
export const BROADCAST_MAC: Mac = 'ff:ff:ff:ff:ff:ff';

// ── addresses ──

export function ipToNum(s: string): number {
  const p = s.split('.');
  if (p.length !== 4) throw new Error(`bad IPv4 address: ${s}`);
  let n = 0;
  for (const x of p) {
    if (!/^\d{1,3}$/.test(x) || Number(x) > 255) throw new Error(`bad IPv4 address: ${s}`);
    n = n * 256 + Number(x);
  }
  return n >>> 0;
}

export function numToIp(n: number): string {
  return `${n >>> 24}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

export function isIp(s: string): boolean {
  try {
    ipToNum(s);
    return true;
  } catch {
    return false;
  }
}

export interface Cidr {
  /** Network address. */
  net: number;
  prefix: number;
  mask: number;
}

export function maskOf(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function parseCidr(s: string): Cidr {
  const m = /^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/.exec(s.trim());
  if (!m || Number(m[2]) > 32) throw new Error(`bad CIDR: ${s}`);
  const prefix = Number(m[2]);
  const mask = maskOf(prefix);
  return { net: (ipToNum(m[1]) & mask) >>> 0, prefix, mask };
}

export function cidrToString(c: Cidr): string {
  return `${numToIp(c.net)}/${c.prefix}`;
}

export function inCidr(ip: number, c: Cidr): boolean {
  return ((ip & c.mask) >>> 0) === c.net;
}

export function cidrOverlap(a: Cidr, b: Cidr): boolean {
  const m = a.prefix < b.prefix ? a.mask : b.mask;
  return ((a.net & m) >>> 0) === ((b.net & m) >>> 0);
}

export function macBytes(s: Mac): Uint8Array {
  const p = s.split(':').map((x) => parseInt(x, 16));
  if (p.length !== 6 || p.some((x) => !(x >= 0 && x <= 255))) throw new Error(`bad MAC address: ${s}`);
  return Uint8Array.from(p);
}

export function macString(b: Uint8Array, off = 0): Mac {
  let s = '';
  for (let i = 0; i < 6; i++) s += (i ? ':' : '') + b[off + i].toString(16).padStart(2, '0');
  return s;
}

// ── bytes ──

export const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
export const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
export function put16(b: Uint8Array, o: number, v: number) {
  b[o] = (v >>> 8) & 255;
  b[o + 1] = v & 255;
}
export function put32(b: Uint8Array, o: number, v: number) {
  b[o] = (v >>> 24) & 255;
  b[o + 1] = (v >>> 16) & 255;
  b[o + 2] = (v >>> 8) & 255;
  b[o + 3] = v & 255;
}

export function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** The Internet checksum (RFC 1071) of `len` bytes from `off`, folded from `initial`. */
export function checksum(b: Uint8Array, off: number, len: number, initial = 0): number {
  let sum = initial;
  let i = off;
  const end = off + len;
  for (; i + 1 < end; i += 2) sum += (b[i] << 8) | b[i + 1];
  if (i < end) sum += b[i] << 8;
  while (sum > 0xffff) sum = (sum & 0xffff) + (sum >>> 16);
  return ~sum & 0xffff;
}

function pseudoSum(src: number, dst: number, proto: number, len: number): number {
  return (src >>> 16) + (src & 0xffff) + (dst >>> 16) + (dst & 0xffff) + proto + len;
}

// ── Ethernet ──

export interface EthFrame {
  dst: Mac;
  src: Mac;
  /** VLAN id of an 802.1Q tag; undefined for untagged frames. */
  vlan?: number;
  type: number;
  payload: Uint8Array;
}

export function parseEth(f: Uint8Array): EthFrame | null {
  if (f.length < 14) return null;
  let type = u16(f, 12);
  let off = 14;
  let vlan: number | undefined;
  if (type === ETH_VLAN) {
    if (f.length < 18) return null;
    vlan = u16(f, 14) & 0x0fff;
    type = u16(f, 16);
    off = 18;
  }
  return { dst: macString(f, 0), src: macString(f, 6), vlan, type, payload: f.subarray(off) };
}

export function buildEth(dst: Mac, src: Mac, type: number, payload: Uint8Array, vlan?: number): Uint8Array {
  const hl = vlan === undefined ? 14 : 18;
  // Pad to the 60-byte minimum, as a network card does.
  const out = new Uint8Array(Math.max(60, hl + payload.length));
  out.set(macBytes(dst), 0);
  out.set(macBytes(src), 6);
  if (vlan === undefined) put16(out, 12, type);
  else {
    put16(out, 12, ETH_VLAN);
    put16(out, 14, vlan & 0x0fff);
    put16(out, 16, type);
  }
  out.set(payload, hl);
  return out;
}

// ── ARP ──

export interface Arp {
  op: number;
  sha: Mac;
  spa: number;
  tha: Mac;
  tpa: number;
}

export function parseArp(p: Uint8Array): Arp | null {
  if (p.length < 28 || u16(p, 0) !== 1 || u16(p, 2) !== ETH_IP4 || p[4] !== 6 || p[5] !== 4) return null;
  return { op: u16(p, 6), sha: macString(p, 8), spa: u32(p, 14), tha: macString(p, 18), tpa: u32(p, 24) };
}

export function buildArp(a: Arp): Uint8Array {
  const p = new Uint8Array(28);
  put16(p, 0, 1);
  put16(p, 2, ETH_IP4);
  p[4] = 6;
  p[5] = 4;
  put16(p, 6, a.op);
  p.set(macBytes(a.sha), 8);
  put32(p, 14, a.spa);
  p.set(macBytes(a.tha), 18);
  put32(p, 24, a.tpa);
  return p;
}

// ── IPv4 ──

export interface Ip4 {
  src: number;
  dst: number;
  proto: number;
  ttl: number;
  id: number;
  /** More fragments flag or a non-zero offset: a fragment. */
  fragment: boolean;
  df: boolean;
  payload: Uint8Array;
}

export function parseIp4(p: Uint8Array): Ip4 | null {
  if (p.length < 20 || p[0] >> 4 !== 4) return null;
  const ihl = (p[0] & 15) * 4;
  const total = u16(p, 2);
  if (ihl < 20 || total < ihl || total > p.length) return null;
  const flags = u16(p, 6);
  return {
    src: u32(p, 12),
    dst: u32(p, 16),
    proto: p[9],
    ttl: p[8],
    id: u16(p, 4),
    df: (flags & 0x4000) !== 0,
    fragment: (flags & 0x2000) !== 0 || (flags & 0x1fff) !== 0,
    payload: p.subarray(ihl, total),
  };
}

export function buildIp4(o: { src: number; dst: number; proto: number; payload: Uint8Array; ttl?: number; id?: number }): Uint8Array {
  const p = new Uint8Array(20 + o.payload.length);
  p[0] = 0x45;
  put16(p, 2, p.length);
  put16(p, 4, o.id ?? 0);
  put16(p, 6, 0x4000); // DF
  p[8] = o.ttl ?? 64;
  p[9] = o.proto;
  put32(p, 12, o.src);
  put32(p, 16, o.dst);
  put16(p, 10, checksum(p, 0, 20));
  p.set(o.payload, 20);
  return p;
}

// ── ICMP ──

export function buildIcmp(type: number, code: number, rest: Uint8Array): Uint8Array {
  const p = new Uint8Array(4 + rest.length);
  p[0] = type;
  p[1] = code;
  p.set(rest, 4);
  put16(p, 2, checksum(p, 0, p.length));
  return p;
}

// ── UDP ──

export interface Udp {
  sport: number;
  dport: number;
  data: Uint8Array;
}

export function parseUdp(p: Uint8Array): Udp | null {
  if (p.length < 8) return null;
  const len = u16(p, 4);
  if (len < 8 || len > p.length) return null;
  return { sport: u16(p, 0), dport: u16(p, 2), data: p.subarray(8, len) };
}

export function buildUdp(src: number, dst: number, sport: number, dport: number, data: Uint8Array): Uint8Array {
  const p = new Uint8Array(8 + data.length);
  put16(p, 0, sport);
  put16(p, 2, dport);
  put16(p, 4, p.length);
  p.set(data, 8);
  const c = checksum(p, 0, p.length, pseudoSum(src, dst, PROTO_UDP, p.length));
  put16(p, 6, c === 0 ? 0xffff : c);
  return p;
}

// ── TCP ──

export const FIN = 0x01;
export const SYN = 0x02;
export const RST = 0x04;
export const PSH = 0x08;
export const ACK = 0x10;

export interface Tcp {
  sport: number;
  dport: number;
  seq: number;
  ack: number;
  flags: number;
  window: number;
  /** MSS option of a SYN. */
  mss?: number;
  data: Uint8Array;
}

export function parseTcp(p: Uint8Array): Tcp | null {
  if (p.length < 20) return null;
  const doff = (p[12] >> 4) * 4;
  if (doff < 20 || doff > p.length) return null;
  const t: Tcp = { sport: u16(p, 0), dport: u16(p, 2), seq: u32(p, 4), ack: u32(p, 8), flags: p[13], window: u16(p, 14), data: p.subarray(doff) };
  for (let i = 20; i < doff; ) {
    const kind = p[i];
    if (kind === 0) break;
    if (kind === 1) {
      i++;
      continue;
    }
    const len = p[i + 1];
    if (len < 2) break;
    if (kind === 2 && len === 4) t.mss = u16(p, i + 2);
    i += len;
  }
  return t;
}

export function buildTcp(src: number, dst: number, t: Omit<Tcp, 'data'> & { data?: Uint8Array }): Uint8Array {
  const opt = t.mss !== undefined ? 4 : 0;
  const data = t.data ?? new Uint8Array(0);
  const p = new Uint8Array(20 + opt + data.length);
  put16(p, 0, t.sport);
  put16(p, 2, t.dport);
  put32(p, 4, t.seq);
  put32(p, 8, t.ack);
  p[12] = ((20 + opt) / 4) << 4;
  p[13] = t.flags;
  put16(p, 14, t.window);
  if (t.mss !== undefined) {
    p[20] = 2;
    p[21] = 4;
    put16(p, 22, t.mss);
  }
  p.set(data, 20 + opt);
  put16(p, 16, checksum(p, 0, p.length, pseudoSum(src, dst, PROTO_TCP, p.length)));
  return p;
}

/** a - b in 32-bit sequence space (signed). */
export function seqDiff(a: number, b: number): number {
  return (a - b) | 0;
}

export const enc = new TextEncoder();
export const dec = new TextDecoder();
export const utf8 = (s: string) => enc.encode(s);
