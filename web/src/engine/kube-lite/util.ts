// Small pure helpers of kube-lite: quantities, ages, hashes in the same
// format as Kubernetes (pod-template-hash, kube-proxy chain names), deep
// copies and merges. Everything here is deterministic so tests and golden
// outputs are stable.

/** A Kubernetes object as kube-lite keeps it: plain JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Obj = Record<string, any>;

export const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

export function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** JSON merge patch (RFC 7386): null deletes a key, objects merge, everything else replaces. */
export function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isObj(patch)) return clone(patch);
  const out: Obj = isObj(target) ? clone(target) : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = mergePatch(out[k], v);
  }
  return out;
}

/** Merge keys of strategic merge patch for the lists the course patches. */
const MERGE_KEYS: Record<string, string> = { containers: 'name', initContainers: 'name', env: 'name', volumes: 'name', volumeMounts: 'mountPath', ports: 'containerPort', tolerations: 'key' };

/** Strategic merge patch (kubectl's default): like a merge patch, but lists with a merge key merge item by item. */
export function strategicMerge(target: unknown, patch: unknown, key?: string): unknown {
  if (Array.isArray(patch) && Array.isArray(target) && key && MERGE_KEYS[key]) {
    const out = clone(target) as Obj[];
    for (const item of patch as Obj[]) {
      // Service ports merge by `port`, container ports by `containerPort`.
      const mk = key === 'ports' && isObj(item) && item.containerPort === undefined ? 'port' : MERGE_KEYS[key];
      const i = out.findIndex((x) => isObj(x) && isObj(item) && x[mk] !== undefined && x[mk] === item[mk]);
      if (i >= 0) out[i] = strategicMerge(out[i], item) as Obj;
      else out.push(clone(item));
    }
    return out;
  }
  if (!isObj(patch)) return clone(patch);
  const out: Obj = isObj(target) ? clone(target) : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = strategicMerge(out[k], v, k);
  }
  return out;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

/** Read a dotted path: get(o, 'spec.template.metadata.labels'). */
export function getPath(o: unknown, path: string): unknown {
  let cur: unknown = o;
  for (const part of path.split('.').filter(Boolean)) {
    if (!isObj(cur) && !Array.isArray(cur)) return undefined;
    cur = (cur as Obj)[part];
  }
  return cur;
}

// ── quantities ──

const BIN: Record<string, number> = { Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40 };
const DEC: Record<string, number> = { k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12, m: 1e-3 };

/** CPU in millicores: '500m' → 500, '2' → 2000, '0.25' → 250. */
export function cpuMilli(q: unknown): number {
  if (q === undefined || q === null || q === '') return 0;
  const s = String(q).trim();
  if (s.endsWith('m')) return Math.round(Number(s.slice(0, -1)));
  return Math.round(Number(s) * 1000);
}

/** Memory in bytes: '128Mi' → 134217728, '1G' → 1e9, '4015948Ki'. */
export function bytes(q: unknown): number {
  if (q === undefined || q === null || q === '') return 0;
  const s = String(q).trim();
  const m = /^([0-9.]+)\s*([A-Za-z]*)$/.exec(s);
  if (!m) return NaN;
  const n = Number(m[1]);
  const unit = m[2];
  if (!unit) return n;
  if (unit in BIN) return Math.round(n * BIN[unit]);
  if (unit in DEC) return Math.round(n * DEC[unit]);
  return NaN;
}

export function validQuantity(q: unknown, kind: 'cpu' | 'memory'): boolean {
  if (q === undefined) return true;
  const s = String(q);
  if (kind === 'cpu') return /^([0-9]+m|[0-9]+(\.[0-9]+)?)$/.test(s);
  return /^[0-9]+(\.[0-9]+)?(Ki|Mi|Gi|Ti|k|K|M|G|T)?$/.test(s);
}

export function fmtMilli(m: number): string {
  return m % 1000 === 0 ? String(m / 1000) : `${m}m`;
}

export function fmtMem(b: number): string {
  for (const u of ['Gi', 'Mi', 'Ki'] as const) if (b >= BIN[u] && b % BIN[u] === 0) return `${b / BIN[u]}${u}`;
  if (b >= BIN.Mi) return `${Math.round(b / BIN.Mi)}Mi`;
  return String(b);
}

/** int-or-percent against a total: '25%' of 4 → 1 (rounded up or down). */
export function intOrPercent(v: unknown, total: number, roundUp: boolean): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v);
  if (s.endsWith('%')) {
    const x = (Number(s.slice(0, -1)) * total) / 100;
    return roundUp ? Math.ceil(x) : Math.floor(x);
  }
  return Number(s);
}

// ── time ──

/** The AGE column of kubectl (duration.HumanDuration). */
export function age(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 120) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 10) return s % 60 ? `${m}m${s % 60}s` : `${m}m`;
  if (m < 180) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 8) return m % 60 ? `${h}h${m % 60}m` : `${h}h`;
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 8) return h % 24 ? `${d}d${h % 24}h` : `${d}d`;
  if (d < 365 * 2) return `${d}d`;
  return `${Math.floor(d / 365)}y`;
}

/** '30s', '5m', '1h30m', '90' (seconds) → milliseconds. */
export function parseDuration(s: string): number {
  if (/^\d+$/.test(s)) return Number(s) * 1000;
  let total = 0;
  const re = /(\d+(?:\.\d+)?)(ms|s|m|h|d)/g;
  let m: RegExpExecArray | null;
  let matched = '';
  while ((m = re.exec(s))) {
    matched += m[0];
    const n = Number(m[1]);
    total += m[2] === 'ms' ? n : m[2] === 's' ? n * 1000 : m[2] === 'm' ? n * 60_000 : m[2] === 'h' ? n * 3_600_000 : n * 86_400_000;
  }
  return matched === s ? total : NaN;
}

export const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

// ── hashes ──

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 of a UTF-8 string (synchronous; kube-proxy chain names need it inside a pure render). */
export function sha256(text: string): Uint8Array {
  const msg = new TextEncoder().encode(text);
  const len = msg.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(msg);
  padded[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bits >>> 0);
  dv.setUint32(padded.length - 8, Math.floor(bits / 2 ** 32));
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  H.forEach((x, i) => ov.setUint32(i * 4, x));
  return out;
}

export function hex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** RFC 4648 base32 (StdEncoding, upper case), as Go's encoding/base32. */
export function base32(b: Uint8Array): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const x of b) {
    value = (value << 8) | x;
    bits += 8;
    while (bits >= 5) {
      out += A[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += A[(value << (5 - bits)) & 31];
  return out;
}

/** kube-proxy: portProtoHash = base32(sha256(servicePortName + protocol))[:16]. */
export function kubeProxyHash(...parts: string[]): string {
  return base32(sha256(parts.join(''))).slice(0, 16);
}

/** The alphabet of rand.SafeEncodeString: no vowels, no confusable characters. */
const SAFE = 'bcdfghjklmnpqrstvwxz2456789';

/** FNV-1a 32-bit. */
export function fnv32a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** pod-template-hash style: a stable 9–10 character safe string of a value. */
export function templateHash(v: unknown): string {
  let n = fnv32a(JSON.stringify(sortKeys(v)));
  let out = '';
  do {
    out += SAFE[n % SAFE.length];
    n = Math.floor(n / SAFE.length);
  } while (n > 0);
  return out.padEnd(9, 'b').slice(0, 10);
}

/** A deterministic pseudo-random generator for names and uids (mulberry32). */
export class Rand {
  constructor(public seed: number) {}
  next(): number {
    let t = (this.seed = (this.seed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Five safe characters, as the suffix of generateName. */
  suffix(n = 5): string {
    let s = '';
    for (let i = 0; i < n; i++) s += SAFE[Math.floor(this.next() * SAFE.length)];
    return s;
  }
  uid(): string {
    let h = '';
    for (let i = 0; i < 32; i++) h += Math.floor(this.next() * 16).toString(16);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[Math.floor(this.next() * 4)]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
  }
}

/** DNS-1123 subdomain (object names). */
export const DNS1123_SUBDOMAIN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
/** DNS-1123 label (namespace and service names). */
export const DNS1123_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/** Labels as kubectl prints them: app=web,tier=front. */
export function fmtLabels(l: Obj | undefined): string {
  const e = Object.entries(l ?? {});
  return e.length ? e.map(([k, v]) => `${k}=${v}`).join(',') : '<none>';
}

/** Go's %#v of map[string]string, as validation messages print it. */
export function goMap(m: Obj | undefined): string {
  const e = Object.entries(m ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return `map[string]string{${e.map(([k, v]) => `"${k}":"${v}"`).join(', ')}}`;
}

export function pad(rows: string[][], gap = 3): string {
  if (!rows.length) return '';
  const w: number[] = [];
  for (const r of rows) r.forEach((c, i) => (w[i] = Math.max(w[i] ?? 0, c.length)));
  return rows.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(w[i] + gap))).join('').trimEnd()).join('\n') + '\n';
}
