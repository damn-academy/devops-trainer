// DNS in netlab (03 §7.3): authoritative servers answer from zones, a
// recursive resolver walks root → TLD → authoritative and caches by TTL,
// a forwarder (the home router) passes questions up, and the stub resolver of
// a host reads /etc/hosts and /etc/resolv.conf (search, ndots). Every question
// is a real UDP exchange through the network model, so a firewall, a missing
// route or a dead server breaks name resolution the way it would on Linux.

import { addrOf, hostAddrs, nextId, readHostFile, udpExchange, type DnsRR, type DnsServer, type FileIo, type World } from './world';

export type Rcode = 'NOERROR' | 'NXDOMAIN' | 'SERVFAIL' | 'REFUSED';

export interface DnsAnswer {
  rcode: Rcode;
  aa: boolean;
  ra: boolean;
  answer: DnsRR[];
  authority: DnsRR[];
  additional: DnsRR[];
}

export interface TraceStep {
  /** Who was asked. */
  server: string;
  serverName?: string;
  /** What exactly was asked (QNAME minimisation asks less). */
  qname: string;
  qtype: string;
  result: 'referral' | 'answer' | 'nxdomain' | 'nodata' | 'timeout' | 'refused' | 'cache';
  rrs: DnsRR[];
  ms: number;
}

export interface ResolveResult {
  answer: DnsAnswer;
  /** The iterative path the resolver took (empty when answered from cache). */
  steps: TraceStep[];
  fromCache: boolean;
  ms: number;
}

export function abs(name: string): string {
  const n = name.trim().toLowerCase();
  return n.endsWith('.') ? n : `${n}.`;
}

function within(name: string, zone: string): boolean {
  return zone === '.' || name === zone || name.endsWith(`.${zone}`);
}

function labels(name: string): number {
  return name === '.' ? 0 : name.replace(/\.$/, '').split('.').length;
}

/** The answer an authoritative server gives from its own zones (RFC 1034 §4.3.2, simplified). */
export function authAnswer(srv: DnsServer, qname0: string, qtype: string): DnsAnswer {
  const qname = abs(qname0);
  const zones = (srv.zones ?? []).filter((z) => within(qname, z.origin)).sort((a, b) => labels(b.origin) - labels(a.origin));
  const zone = zones[0];
  const empty = (rcode: Rcode, aa = true): DnsAnswer => ({ rcode, aa, ra: srv.mode !== 'auth', answer: [], authority: [], additional: [] });
  if (!zone) return empty('REFUSED', false);
  const soa = zone.records.filter((r) => r.type === 'SOA');
  // A delegation below the zone apex that contains qname: answer with a referral.
  const cuts = zone.records.filter((r) => r.type === 'NS' && r.name !== zone.origin && within(qname, r.name)).sort((a, b) => labels(b.name) - labels(a.name));
  if (cuts.length) {
    const cut = cuts[0].name;
    const ns = zone.records.filter((r) => r.type === 'NS' && r.name === cut);
    const glue = zone.records.filter((r) => (r.type === 'A' || r.type === 'AAAA') && ns.some((n) => abs(n.data) === r.name));
    return { rcode: 'NOERROR', aa: false, ra: srv.mode !== 'auth', answer: [], authority: ns, additional: glue };
  }
  const at = zone.records.filter((r) => r.name === qname);
  const answer: DnsRR[] = [];
  let name = qname;
  for (let i = 0; i < 8; i++) {
    const here = zone.records.filter((r) => r.name === name);
    const direct = here.filter((r) => r.type === qtype || qtype === 'ANY');
    if (direct.length) {
      answer.push(...direct);
      break;
    }
    const cname = here.find((r) => r.type === 'CNAME');
    if (!cname) break;
    answer.push(cname);
    name = abs(cname.data);
    if (!within(name, zone.origin)) break;
  }
  if (answer.length) {
    const additional = qtype === 'NS' || qtype === 'MX' ? zone.records.filter((r) => r.type === 'A' && answer.some((a) => abs(a.data.split(' ').pop()!) === r.name)) : [];
    return { rcode: 'NOERROR', aa: true, ra: srv.mode !== 'auth', answer, authority: [], additional };
  }
  const exists = at.length > 0 || zone.records.some((r) => r.name.endsWith(`.${qname}`));
  return { rcode: exists ? 'NOERROR' : 'NXDOMAIN', aa: true, ra: srv.mode !== 'auth', answer: [], authority: soa, additional: [] };
}

function wireLen(a: DnsAnswer, qname: string): number {
  return 12 + qname.length + 6 + [...a.answer, ...a.authority, ...a.additional].reduce((n, r) => n + 12 + r.data.length, 0) + 11;
}

/** The tcpdump text of a DNS query and of its response. */
export function dnsQueryInfo(id: number, qname: string, qtype: string, rd = true): string {
  return `${id}${rd ? '+' : ''} ${qtype}? ${abs(qname)} (${12 + abs(qname).length + 5})`;
}

export function dnsReplyInfo(id: number, a: DnsAnswer, qname: string): string {
  const head = `${id}${a.aa ? '*' : ''}${a.rcode === 'NOERROR' ? '' : ` ${a.rcode === 'NXDOMAIN' ? 'NXDomain' : a.rcode === 'SERVFAIL' ? 'ServFail' : 'Refused'}`}${a.ra ? '' : '-'}`;
  const body = a.answer.map((r) => `${r.type} ${r.data}`).join(', ');
  return `${head} ${a.answer.length}/${a.authority.length}/${a.additional.length}${body ? ` ${body}` : ''} (${wireLen(a, abs(qname))})`;
}

interface Ask {
  answer?: DnsAnswer;
  ms: number;
  stage?: string;
}

/** One question to one server over UDP 53 through the network. */
export function ask(w: World, io: FileIo | undefined, fromHost: string, server: string, qname: string, qtype: string, rd: boolean, src?: string): Ask {
  const id = 1000 + nextId(w);
  let result: DnsAnswer | undefined;
  const t0 = w.clock;
  const r = udpExchange(w, fromHost, server, 53, {
    info: dnsQueryInfo(id, qname, qtype, rd),
    len: 40 + qname.length,
    src,
    answerInfo: (svc, host) => {
      if (svc.kind !== 'dns' || !svc.dns) return null;
      result = serve(w, io, host.id, svc.dns, qname, qtype, rd);
      return { info: dnsReplyInfo(id, result, qname), len: 28 + wireLen(result, abs(qname)) };
    },
  });
  if (!r.ok || !result) {
    // dig waits 5 s per try; resolvers give up on a silent server much sooner (about 1–2 s).
    w.clock = t0 + 2000;
    return { ms: 2000, stage: r.stage ?? 'no-answer' };
  }
  return { answer: result, ms: w.clock - t0 };
}

/** What a server does with a question: authoritative answer, or recursion/forwarding when asked (RD) and allowed. */
export function serve(w: World, io: FileIo | undefined, hostId: string, srv: DnsServer, qname: string, qtype: string, rd: boolean): DnsAnswer {
  const own = (srv.zones ?? []).some((z) => within(abs(qname), z.origin) && z.origin !== '.');
  if (srv.mode === 'auth' || own || !rd) {
    if (srv.mode !== 'auth' && !own && !rd) {
      const c = cacheGet(w, srv, abs(qname), qtype);
      if (c) return c;
    }
    if (srv.mode === 'auth' || own) return authAnswer(srv, qname, qtype);
    return { rcode: 'REFUSED', aa: false, ra: true, answer: [], authority: [], additional: [] };
  }
  return srv.mode === 'forward' ? forward(w, io, hostId, srv, qname, qtype).answer : recurse(w, io, hostId, srv, qname, qtype).answer;
}

function cacheGet(w: World, srv: DnsServer, qname: string, qtype: string): DnsAnswer | undefined {
  const c = srv.cache?.[`${qname}|${qtype}`];
  if (!c || c.expires <= w.clock) return undefined;
  const left = Math.max(0, Math.floor((c.expires - w.clock) / 1000));
  return { rcode: c.rcode, aa: false, ra: true, answer: c.rrs.map((r) => ({ ...r, ttl: Math.min(r.ttl, left) })), authority: [], additional: [] };
}

function cachePut(w: World, srv: DnsServer, qname: string, qtype: string, a: DnsAnswer): void {
  if (a.rcode === 'SERVFAIL' || a.rcode === 'REFUSED') return;
  srv.cache ??= {};
  const ttl = a.answer.length ? Math.min(...a.answer.map((r) => r.ttl)) : Math.min(...(a.authority.filter((r) => r.type === 'SOA').map((r) => Number(r.data.split(' ').pop()) || 300) || [300]), 3600);
  srv.cache[`${qname}|${qtype}`] = { rrs: a.answer, rcode: a.rcode as 'NOERROR' | 'NXDOMAIN', expires: w.clock + ttl * 1000 };
}

/** Recursive resolution from the root hints (RFC 1034 §5.3.3, with QNAME minimisation of RFC 9156 when enabled). */
export function recurse(w: World, io: FileIo | undefined, hostId: string, srv: DnsServer, qname0: string, qtype: string): ResolveResult {
  const qname = abs(qname0);
  const t0 = w.clock;
  const cached = cacheGet(w, srv, qname, qtype);
  if (cached) return { answer: cached, steps: [{ server: 'cache', qname, qtype, result: 'cache', rrs: cached.answer, ms: 0 }], fromCache: true, ms: 0 };
  const steps: TraceStep[] = [];
  let servers = [...(srv.upstream ?? [])];
  let zone = '.';
  const chain: DnsRR[] = [];
  let target = qname;
  for (let round = 0; round < 12; round++) {
    let got: Ask | undefined;
    let used = '';
    // Ask the servers of the current zone one by one until one answers.
    for (const s of servers) {
      const asked = srv.qnameMin ? minimised(target, zone) : target;
      const t = w.clock;
      got = ask(w, io, hostId, s, asked, asked === target ? qtype : 'NS', false);
      used = s;
      if (got.answer) {
        const a = got.answer;
        const res: TraceStep['result'] = a.authority.some((r) => r.type === 'NS') && !a.answer.length ? 'referral' : a.rcode === 'NXDOMAIN' ? 'nxdomain' : a.answer.length ? 'answer' : 'nodata';
        steps.push({ server: s, qname: asked, qtype: asked === target ? qtype : 'NS', result: res, rrs: [...a.answer, ...a.authority, ...a.additional], ms: w.clock - t });
        // QNAME minimisation asked a shorter name: the NODATA/answer for it tells us nothing new, continue down.
        if (asked !== target && res !== 'referral' && res !== 'nxdomain') {
          got = { answer: { ...a, answer: [], authority: [], additional: [] }, ms: got.ms };
          zone = asked;
          break;
        }
        break;
      }
      steps.push({ server: s, qname: asked, qtype, result: 'timeout', rrs: [], ms: w.clock - t });
    }
    if (!got?.answer) {
      const fail: DnsAnswer = { rcode: 'SERVFAIL', aa: false, ra: true, answer: [], authority: [], additional: [] };
      return { answer: fail, steps, fromCache: false, ms: w.clock - t0 };
    }
    const a = got.answer;
    if (a.rcode === 'NXDOMAIN') {
      const ans = { ...a, aa: false, ra: true, answer: chain };
      cachePut(w, srv, qname, qtype, ans);
      return { answer: ans, steps, fromCache: false, ms: w.clock - t0 };
    }
    if (a.answer.length) {
      chain.push(...a.answer);
      const last = a.answer[a.answer.length - 1];
      if (last.type === 'CNAME' && qtype !== 'CNAME' && !a.answer.some((r) => r.type === qtype)) {
        target = abs(last.data);
        servers = [...(srv.upstream ?? [])];
        zone = '.';
        continue;
      }
      const ans: DnsAnswer = { rcode: 'NOERROR', aa: false, ra: true, answer: chain, authority: [], additional: [] };
      cachePut(w, srv, qname, qtype, ans);
      return { answer: ans, steps, fromCache: false, ms: w.clock - t0 };
    }
    const ns = a.authority.filter((r) => r.type === 'NS');
    if (ns.length) {
      zone = ns[0].name;
      const glue = a.additional.filter((r) => r.type === 'A').map((r) => r.data);
      servers = glue.length ? glue : servers;
      continue;
    }
    if (zone !== target && srv.qnameMin && used) continue;
    const ans: DnsAnswer = { rcode: 'NOERROR', aa: false, ra: true, answer: chain, authority: a.authority, additional: [] };
    cachePut(w, srv, qname, qtype, ans);
    return { answer: ans, steps, fromCache: false, ms: w.clock - t0 };
  }
  return { answer: { rcode: 'SERVFAIL', aa: false, ra: true, answer: [], authority: [], additional: [] }, steps, fromCache: false, ms: w.clock - t0 };
}

/** With QNAME minimisation a resolver asks each zone only for the next label: "example." of "shop.example." at the root. */
function minimised(qname: string, zone: string): string {
  const parts = qname.replace(/\.$/, '').split('.');
  const have = labels(zone);
  if (have + 1 >= parts.length) return qname;
  return `${parts.slice(parts.length - have - 1).join('.')}.`;
}

/** A forwarder (dnsmasq on a home router): its own zones first, then the cache, then the upstream server. */
export function forward(w: World, io: FileIo | undefined, hostId: string, srv: DnsServer, qname0: string, qtype: string): ResolveResult {
  const qname = abs(qname0);
  const t0 = w.clock;
  const cached = cacheGet(w, srv, qname, qtype);
  if (cached) return { answer: cached, steps: [], fromCache: true, ms: 0 };
  for (const up of srv.upstream ?? []) {
    const r = ask(w, io, hostId, up, qname, qtype, true);
    if (r.answer) {
      const ans = { ...r.answer, aa: false, ra: true };
      cachePut(w, srv, qname, qtype, ans);
      return { answer: ans, steps: [{ server: up, qname, qtype, result: ans.rcode === 'NXDOMAIN' ? 'nxdomain' : 'answer', rrs: ans.answer, ms: r.ms }], fromCache: false, ms: w.clock - t0 };
    }
  }
  return { answer: { rcode: 'SERVFAIL', aa: false, ra: true, answer: [], authority: [], additional: [] }, steps: [], fromCache: false, ms: w.clock - t0 };
}

// ── the stub resolver of a host ────────────────────────────────────────────

export interface ResolvConf {
  nameservers: string[];
  search: string[];
  ndots: number;
}

export function parseResolvConf(text: string | undefined): ResolvConf {
  const rc: ResolvConf = { nameservers: [], search: [], ndots: 1 };
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.replace(/[#;].*/, '').trim();
    const [k, ...v] = line.split(/\s+/);
    if (k === 'nameserver' && v[0]) rc.nameservers.push(v[0]);
    if (k === 'search' || k === 'domain') rc.search = v;
    if (k === 'options') for (const o of v) if (o.startsWith('ndots:')) rc.ndots = Number(o.slice(6)) || 1;
  }
  return rc;
}

/** /etc/hosts lookup: the first line that lists the name. */
export function hostsLookup(text: string | undefined, name: string): string | undefined {
  const n = name.toLowerCase().replace(/\.$/, '');
  for (const raw of (text ?? '').split('\n')) {
    const parts = raw.replace(/#.*/, '').trim().split(/\s+/);
    if (parts.length > 1 && parts.slice(1).some((x) => x.toLowerCase() === n)) return parts[0];
  }
  return undefined;
}

export interface StubResult {
  addr?: string;
  /** Where the answer came from. */
  via: 'hosts' | 'dns' | 'literal' | 'none';
  rcode?: Rcode;
  /** 'timeout' when no server answered at all. */
  error?: 'timeout' | 'nxdomain' | 'servfail' | 'nodata';
  server?: string;
  ms: number;
  /** The names the stub tried (search domains). */
  tried: string[];
}

/**
 * getaddrinfo() as glibc does it: /etc/hosts, then the servers of
 * /etc/resolv.conf with search domains and ndots.
 */
export function stubResolve(w: World, io: FileIo | undefined, hostId: string, name: string, o: { hosts?: boolean } = {}): StubResult {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return { addr: name, via: 'literal', ms: 0, tried: [] };
  if (name === 'localhost') return { addr: '127.0.0.1', via: 'hosts', ms: 0, tried: [] };
  if (o.hosts !== false) {
    const hit = hostsLookup(readHostFile(w, io, hostId, '/etc/hosts'), name);
    if (hit) return { addr: hit, via: 'hosts', ms: 0, tried: [name] };
  }
  const rc = parseResolvConf(readHostFile(w, io, hostId, '/etc/resolv.conf'));
  if (!rc.nameservers.length) return { via: 'none', error: 'timeout', ms: 0, tried: [] };
  const dots = name.replace(/\.$/, '').split('.').length - 1;
  const absolute = name.endsWith('.');
  const candidates = absolute ? [name] : dots >= rc.ndots ? [name, ...rc.search.map((s) => `${name}.${s}`)] : [...rc.search.map((s) => `${name}.${s}`), name];
  const t0 = w.clock;
  let last: StubResult = { via: 'none', error: 'timeout', ms: 0, tried: [] };
  const tried: string[] = [];
  for (const cand of candidates) {
    tried.push(cand);
    let answered = false;
    for (const ns of rc.nameservers.slice(0, 3)) {
      const r = ask(w, io, hostId, ns, cand, 'A', true);
      if (!r.answer) continue;
      answered = true;
      const a = r.answer;
      const ip = a.answer.find((x) => x.type === 'A')?.data;
      if (ip) return { addr: ip, via: 'dns', rcode: a.rcode, server: ns, ms: w.clock - t0, tried };
      last = { via: 'dns', rcode: a.rcode, error: a.rcode === 'NXDOMAIN' ? 'nxdomain' : a.rcode === 'SERVFAIL' ? 'servfail' : 'nodata', server: ns, ms: w.clock - t0, tried };
      break;
    }
    if (!answered) {
      // glibc: timeout:5 attempts:2 per server. The model charges the total once.
      w.clock = t0 + 10000 * rc.nameservers.length;
      return { via: 'none', error: 'timeout', ms: w.clock - t0, tried };
    }
  }
  return { ...last, tried };
}

/** Names of DNS-serving hosts for dig output (SERVER line) and traces. */
export function serverLabel(w: World, ip: string): string {
  const h = Object.values(w.hosts).find((x) => hostAddrs(x).includes(ip));
  return h?.name ?? ip;
}

export { addrOf };
