// Probes for checks (03 §8.5, the `reach` fact scope). A lab declares what
// to try — ping, a TCP connect, an HTTP request, a DNS question — from which
// host; the collector runs each probe on a copy of the world, so checking
// never changes the learner's network, never writes the local host's logs, and
// reports where a failed probe stopped (`stage`).

import { ask, stubResolve } from './dns';
import { checkCert, serveHttp } from './http';
import { cloneWorld, icmpEcho, tcpConnect, type World } from './world';
import type { NetState, Probe, ProbeResult } from './state';

export function runProbe(w0: World, st: Pick<NetState, 'io'>, p: Probe): ProbeResult {
  const w = cloneWorld(w0);
  w.dry = true;
  w.capture = [];
  const from = p.from ?? w.local;
  const io = st.io;
  const base: ProbeResult = { kind: p.kind, from, to: p.to };
  if (!w.hosts[from]) return { ...base, error: 'no-such-host', stage: 'no-such-host' };
  if (p.kind === 'dns') {
    const r = stubResolve(w, io, from, p.to, { hosts: false });
    if (p.qtype && p.qtype !== 'A') {
      const ns = r.server;
      const a = ns ? ask(w, io, from, ns, p.to, p.qtype, true).answer : undefined;
      return { ...base, rcode: a?.rcode, answer: a?.answer.map((x) => x.data) ?? [] };
    }
    return { ...base, rcode: r.rcode ?? (r.error === 'timeout' ? 'TIMEOUT' : undefined), answer: r.addr ? [r.addr] : [], error: r.error };
  }
  const resolveHost = (name: string) => stubResolve(w, io, from, name);
  if (p.kind === 'icmp') {
    const r = resolveHost(p.to);
    if (!r.addr) return { ...base, sent: 0, received: 0, error: 'resolve', stage: 'dns' };
    const count = p.count ?? 3;
    let received = 0;
    let stage: string | undefined;
    for (let i = 1; i <= count; i++) {
      const e = icmpEcho(w, from, r.addr, { seq: i });
      if (e.ok) received++;
      else stage = e.stage ?? (e.noRoute ? 'no-route' : undefined);
    }
    return { ...base, sent: count, received, stage: received === count ? undefined : stage };
  }
  if (p.kind === 'tcp') {
    const r = resolveHost(p.to);
    if (!r.addr) return { ...base, connected: false, error: 'resolve', stage: 'dns' };
    const c = tcpConnect(w, from, r.addr, p.port ?? 80, { timeoutMs: 5000 });
    return { ...base, connected: c.ok, error: c.error, stage: c.stage, ms: Math.round(c.ms) };
  }
  // http
  const m = /^(https?):\/\/([^/:]+)(?::(\d+))?(\/.*)?$/.exec(p.to);
  if (!m) return { ...base, error: 'bad-url' };
  const scheme = m[1];
  const host = m[2];
  const port = Number(m[3] ?? (scheme === 'https' ? 443 : 80));
  const path = m[4] ?? '/';
  const r = resolveHost(host);
  if (!r.addr) return { ...base, error: 'resolve', stage: 'dns' };
  const t0 = w.clock;
  const c = tcpConnect(w, from, r.addr, port, { timeoutMs: 10000 });
  if (!c.ok) return { ...base, connected: false, error: c.error, stage: c.stage };
  const svc = c.service!;
  if (scheme === 'https') {
    if (!svc.tls) return { ...base, connected: true, tlsError: 'handshake', stage: 'tls' };
    const bad = checkCert(svc.tls, host, w.clock);
    if (bad) return { ...base, connected: true, tlsError: bad, stage: `tls-${bad}` };
  }
  const res = serveHttp(w, io, c.host!, svc, { method: 'GET', path, host, headers: [], client: c.seenSrc ?? '' });
  return { ...base, connected: true, status: res.status, ms: Math.round(w.clock - t0) };
}

export function runProbes(st: NetState, probes: Probe[]): Record<string, ProbeResult> {
  const out: Record<string, ProbeResult> = {};
  for (const p of probes) out[p.id] = runProbe(st.world, st, p);
  return out;
}
