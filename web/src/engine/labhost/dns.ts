// DNS server of the lab host (RFC 1035 subset over UDP): authoritative for
// `.lab` and the reverse zone of the lab networks. Records come from a
// resolver callback, so the cloud can add names at runtime. Names outside the
// lab get SERVFAIL: there is no internet in the tab, and the answer says so
// the way a real resolver without upstream does.

import type { LabHost } from './host';
import { ipToNum, isIp, numToIp, put16, put32, u16, utf8 } from './wire';

export const QTYPE = { A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, MX: 15, TXT: 16, AAAA: 28, SRV: 33, ANY: 255 } as const;
const TYPE_NAME = Object.fromEntries(Object.entries(QTYPE).map(([k, v]) => [v, k])) as Record<number, string>;

export interface DnsRecord {
  name: string;
  type: 'A' | 'CNAME' | 'TXT' | 'PTR';
  ttl: number;
  value: string;
}

export interface DnsQuestion {
  name: string;
  type: number;
  cls: number;
}

export interface DnsMessage {
  id: number;
  flags: number;
  questions: DnsQuestion[];
  answers: { name: string; type: number; ttl: number; data: string }[];
}

function readName(b: Uint8Array, off: number): { name: string; next: number } {
  const labels: string[] = [];
  let next = -1;
  let jumps = 0;
  for (let i = off; ; ) {
    if (i >= b.length) throw new Error('truncated name');
    const len = b[i];
    if (len === 0) {
      if (next < 0) next = i + 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      if (++jumps > 16) throw new Error('name loop');
      if (next < 0) next = i + 2;
      i = ((len & 0x3f) << 8) | b[i + 1];
      continue;
    }
    labels.push(new TextDecoder().decode(b.subarray(i + 1, i + 1 + len)));
    i += 1 + len;
  }
  return { name: labels.join('.').toLowerCase(), next };
}

export function parseDns(b: Uint8Array): DnsMessage | null {
  try {
    if (b.length < 12) return null;
    const qd = u16(b, 4);
    const an = u16(b, 6);
    const msg: DnsMessage = { id: u16(b, 0), flags: u16(b, 2), questions: [], answers: [] };
    let o = 12;
    for (let i = 0; i < qd; i++) {
      const n = readName(b, o);
      msg.questions.push({ name: n.name, type: u16(b, n.next), cls: u16(b, n.next + 2) });
      o = n.next + 4;
    }
    for (let i = 0; i < an; i++) {
      const n = readName(b, o);
      const type = u16(b, n.next);
      const ttl = ((b[n.next + 4] << 24) | (b[n.next + 5] << 16) | (b[n.next + 6] << 8) | b[n.next + 7]) >>> 0;
      const rdlen = u16(b, n.next + 8);
      const rd = n.next + 10;
      let data = '';
      if (type === QTYPE.A) data = numToIp(((b[rd] << 24) | (b[rd + 1] << 16) | (b[rd + 2] << 8) | b[rd + 3]) >>> 0);
      else if (type === QTYPE.CNAME || type === QTYPE.PTR) data = readName(b, rd).name;
      else if (type === QTYPE.TXT) data = new TextDecoder().decode(b.subarray(rd + 1, rd + 1 + b[rd]));
      msg.answers.push({ name: n.name, type, ttl, data });
      o = rd + rdlen;
    }
    return msg;
  } catch {
    return null;
  }
}

function encodeName(name: string): Uint8Array {
  const parts = name.replace(/\.$/, '').split('.').filter(Boolean);
  const bufs = parts.map((p) => utf8(p).subarray(0, 63));
  const out = new Uint8Array(bufs.reduce((n, x) => n + x.length + 1, 0) + 1);
  let o = 0;
  for (const x of bufs) {
    out[o++] = x.length;
    out.set(x, o);
    o += x.length;
  }
  return out;
}

export function buildDns(m: { id: number; flags: number; questions: DnsQuestion[]; answers: { name: string; type: number; ttl: number; data: string }[]; authority?: { name: string; type: number; ttl: number; data: string }[] }): Uint8Array {
  const parts: Uint8Array[] = [];
  const head = new Uint8Array(12);
  put16(head, 0, m.id);
  put16(head, 2, m.flags);
  put16(head, 4, m.questions.length);
  put16(head, 6, m.answers.length);
  put16(head, 8, m.authority?.length ?? 0);
  parts.push(head);
  for (const q of m.questions) {
    const t = new Uint8Array(4);
    put16(t, 0, q.type);
    put16(t, 2, q.cls);
    parts.push(encodeName(q.name), t);
  }
  for (const a of [...m.answers, ...(m.authority ?? [])]) {
    let rdata: Uint8Array;
    if (a.type === QTYPE.A) {
      rdata = new Uint8Array(4);
      put32(rdata, 0, ipToNum(a.data));
    } else if (a.type === QTYPE.CNAME || a.type === QTYPE.PTR || a.type === QTYPE.NS) rdata = encodeName(a.data);
    else if (a.type === QTYPE.TXT) {
      const s = utf8(a.data).subarray(0, 255);
      rdata = new Uint8Array(s.length + 1);
      rdata[0] = s.length;
      rdata.set(s, 1);
    } else if (a.type === QTYPE.SOA) {
      const [mname, rname] = a.data.split(' ');
      const nums = new Uint8Array(20);
      [1, 3600, 600, 86400, 60].forEach((v, i) => put32(nums, i * 4, v));
      const mn = encodeName(mname);
      const rn = encodeName(rname);
      rdata = new Uint8Array(mn.length + rn.length + 20);
      rdata.set(mn, 0);
      rdata.set(rn, mn.length);
      rdata.set(nums, mn.length + rn.length);
    } else rdata = new Uint8Array(0);
    const t = new Uint8Array(10);
    put16(t, 0, a.type);
    put16(t, 2, 1);
    put32(t, 4, a.ttl);
    put16(t, 8, rdata.length);
    parts.push(encodeName(a.name), t, rdata);
  }
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

export interface DnsQueryEvent {
  from: string;
  name: string;
  type: string;
  rcode: 'NOERROR' | 'NXDOMAIN' | 'SERVFAIL' | 'NOTIMP';
  answers: string[];
}

/** Where the server finds names: a function of the lowercase name without the trailing dot. */
export type DnsLookup = (name: string) => DnsRecord[];

const SOA = { name: 'lab', type: QTYPE.SOA, ttl: 60, data: 'ns.lab hostmaster.lab' };

export class DnsServer {
  private fns = new Set<(e: DnsQueryEvent) => void>();
  constructor(
    host: LabHost,
    private lookup: DnsLookup,
  ) {
    host.bindUdp(53, (d, reply) => {
      const q = parseDns(d.data);
      if (!q || q.flags & 0x8000) return;
      const out = this.answer(q, numToIp(d.src));
      if (out) reply(out);
    });
  }

  on(fn: (e: DnsQueryEvent) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }

  /** Names this server is authoritative for. */
  static ours(name: string): boolean {
    return name === 'lab' || name.endsWith('.lab') || name.endsWith('.in-addr.arpa');
  }

  /** Build the answer to a query (also used by tests directly). */
  answer(q: DnsMessage, from = ''): Uint8Array | null {
    const rd = q.flags & 0x0100;
    const opcode = (q.flags >> 11) & 15;
    const base = 0x8000 | 0x0400 | rd | 0x0080; // QR, AA, RD copied, RA
    const question = q.questions[0];
    if (!question) return null;
    const emit = (rcode: DnsQueryEvent['rcode'], answers: string[]) => {
      for (const f of this.fns) f({ from, name: question.name, type: TYPE_NAME[question.type] ?? String(question.type), rcode, answers });
    };
    if (opcode !== 0) {
      emit('NOTIMP', []);
      return buildDns({ id: q.id, flags: base | 4, questions: q.questions, answers: [] });
    }
    const name = question.name.replace(/\.$/, '');
    if (!DnsServer.ours(name)) {
      emit('SERVFAIL', []);
      return buildDns({ id: q.id, flags: (base & ~0x0400) | 2, questions: q.questions, answers: [] });
    }
    const answers: { name: string; type: number; ttl: number; data: string }[] = [];
    let cur = name;
    let any = false;
    for (let depth = 0; depth < 8; depth++) {
      const recs = this.lookup(cur);
      if (!recs.length) break;
      any = true;
      const cname = recs.find((r) => r.type === 'CNAME');
      if (cname && question.type !== QTYPE.CNAME) {
        answers.push({ name: cur, type: QTYPE.CNAME, ttl: cname.ttl, data: cname.value });
        cur = cname.value.replace(/\.$/, '').toLowerCase();
        if (!DnsServer.ours(cur)) break;
        continue;
      }
      for (const r of recs)
        if (question.type === QTYPE.ANY || QTYPE[r.type] === question.type)
          answers.push({ name: cur, type: QTYPE[r.type], ttl: r.ttl, data: r.value });
      break;
    }
    if (!any) {
      emit('NXDOMAIN', []);
      return buildDns({ id: q.id, flags: base | 3, questions: q.questions, answers: [], authority: [SOA] });
    }
    emit(
      'NOERROR',
      answers.map((a) => `${TYPE_NAME[a.type]} ${a.data}`),
    );
    return buildDns({ id: q.id, flags: base, questions: q.questions, answers, authority: answers.length ? [] : [SOA] });
  }
}

/** '10.0.0.21' → '21.0.0.10.in-addr.arpa' */
export function reverseName(ip: string): string {
  return `${ip.split('.').reverse().join('.')}.in-addr.arpa`;
}

/** '21.0.0.10.in-addr.arpa' → '10.0.0.21' or null */
export function fromReverse(name: string): string | null {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\.in-addr\.arpa$/.exec(name);
  if (!m) return null;
  const ip = `${m[4]}.${m[3]}.${m[2]}.${m[1]}`;
  return isIp(ip) ? ip : null;
}
