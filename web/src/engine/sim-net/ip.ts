// IPv4 arithmetic for netlab: parsing, prefixes, subnets, longest prefix match.
// Pure functions, no DOM; used by the simulator, the subnet calculator widget
// and the tests.

export type U32 = number;

/** "192.168.1.10" → 3232235786; throws on anything that is not a dotted quad. */
export function parseIp(s: string): U32 {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
  if (!m) throw new Error(`not an IPv4 address: ${s}`);
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) throw new Error(`not an IPv4 address: ${s}`);
  return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
}

export function isIp(s: string): boolean {
  try {
    parseIp(s);
    return true;
  } catch {
    return false;
  }
}

export function fmtIp(n: U32): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

/** Mask of a prefix length: 24 → 255.255.255.0 as a number. */
export function maskOf(prefix: number): U32 {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/** "255.255.255.0" → 24; throws if the ones are not contiguous. */
export function prefixOfMask(mask: string): number {
  const n = parseIp(mask);
  let p = 0;
  while (p < 32 && (n & (0x80000000 >>> p)) !== 0) p++;
  if (maskOf(p) !== n) throw new Error(`not a contiguous mask: ${mask}`);
  return p;
}

export interface Cidr {
  addr: U32;
  prefix: number;
}

/** "10.0.1.10/24" (or a bare address = /32). */
export function parseCidr(s: string): Cidr {
  const [a, p] = s.trim().split('/');
  const prefix = p === undefined ? 32 : Number(p);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error(`bad prefix length in ${s}`);
  return { addr: parseIp(a), prefix };
}

export function isCidr(s: string): boolean {
  try {
    parseCidr(s);
    return s.includes('/');
  } catch {
    return false;
  }
}

export function networkOf(c: Cidr): U32 {
  return (c.addr & maskOf(c.prefix)) >>> 0;
}

export function broadcastOf(c: Cidr): U32 {
  return (networkOf(c) | (~maskOf(c.prefix) >>> 0)) >>> 0;
}

/** "10.0.1.10/24" → "10.0.1.0/24". */
export function netCidr(s: string): string {
  const c = parseCidr(s);
  return `${fmtIp(networkOf(c))}/${c.prefix}`;
}

export function inSubnet(ip: string | U32, net: string | Cidr): boolean {
  const n = typeof net === 'string' ? parseCidr(net) : net;
  const a = typeof ip === 'string' ? parseIp(ip) : ip;
  return ((a & maskOf(n.prefix)) >>> 0) === networkOf(n);
}

export interface SubnetInfo {
  address: string;
  prefix: number;
  mask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  /** Usable host addresses (/31 and /32 are special cases: RFC 3021 point-to-point and a single host). */
  hosts: number;
  total: number;
  binary: { address: string; mask: string };
  kind: AddressKind;
}

export type AddressKind = 'private' | 'loopback' | 'link-local' | 'cgnat' | 'documentation' | 'multicast' | 'public' | 'unspecified' | 'broadcast';

const RANGES: [string, AddressKind][] = [
  ['0.0.0.0/32', 'unspecified'],
  ['255.255.255.255/32', 'broadcast'],
  ['10.0.0.0/8', 'private'],
  ['172.16.0.0/12', 'private'],
  ['192.168.0.0/16', 'private'],
  ['127.0.0.0/8', 'loopback'],
  ['169.254.0.0/16', 'link-local'],
  ['100.64.0.0/10', 'cgnat'],
  ['192.0.2.0/24', 'documentation'],
  ['198.51.100.0/24', 'documentation'],
  ['203.0.113.0/24', 'documentation'],
  ['224.0.0.0/4', 'multicast'],
];

/** What kind of address this is (RFC 1918 private, RFC 6598 CGNAT, RFC 5737 documentation…). */
export function addressKind(ip: string | U32): AddressKind {
  const a = typeof ip === 'string' ? parseIp(ip) : ip;
  for (const [r, k] of RANGES) if (inSubnet(a, r)) return k;
  return 'public';
}

/** The 32 bits in four groups: "11000000.10101000.00000001.00001010". */
export function bits(n: U32): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].map((o) => o.toString(2).padStart(8, '0')).join('.');
}

export function subnetInfo(cidr: string): SubnetInfo {
  const c = parseCidr(cidr.includes('/') ? cidr : `${cidr}/32`);
  const net = networkOf(c);
  const bc = broadcastOf(c);
  const total = 2 ** (32 - c.prefix);
  let hosts: number;
  let first: U32;
  let last: U32;
  if (c.prefix === 32) {
    hosts = 1;
    first = last = c.addr;
  } else if (c.prefix === 31) {
    hosts = 2;
    first = net;
    last = bc;
  } else {
    hosts = total - 2;
    first = net + 1;
    last = bc - 1;
  }
  return {
    address: fmtIp(c.addr),
    prefix: c.prefix,
    mask: fmtIp(maskOf(c.prefix)),
    wildcard: fmtIp(~maskOf(c.prefix) >>> 0),
    network: fmtIp(net),
    broadcast: fmtIp(bc),
    firstHost: fmtIp(first),
    lastHost: fmtIp(last),
    hosts,
    total,
    binary: { address: bits(c.addr), mask: bits(maskOf(c.prefix)) },
    kind: addressKind(c.addr),
  };
}

export interface RouteLike {
  dst: string; // 'default' or CIDR
}

/** Longest prefix match: the route whose destination contains `ip` with the longest prefix; default is /0. */
export function longestMatch<R extends RouteLike>(routes: R[], ip: string): R | undefined {
  let best: R | undefined;
  let bestLen = -1;
  const a = parseIp(ip);
  for (const r of routes) {
    const c = r.dst === 'default' ? { addr: 0, prefix: 0 } : parseCidr(r.dst);
    if (((a & maskOf(c.prefix)) >>> 0) === networkOf(c) && c.prefix > bestLen) {
      best = r;
      bestLen = c.prefix;
    }
  }
  return best;
}

/** Deterministic pseudo-random generator (mulberry32) for reproducible labs. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
