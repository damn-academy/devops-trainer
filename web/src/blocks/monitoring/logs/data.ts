// Logs and traces of the training system "Shop" (06 §7.1, C14): the same
// services, instances and incidents as the metrics. A deterministic generator
// writes two hours of log lines: api logs JSON, frontend logs logfmt, the
// worker writes plain text. Every api request carries a trace_id, and the
// traces of the last hour are built from the same requests, so a log line, a
// trace and a metric tell one story.

import { NOW, type Incident, type Labels } from '../prom/data';
import { OOM_AT_MIN } from '../prom/k8s';

export interface LogEntry {
  ts: number;
  line: string;
}

export interface LogStream {
  labels: Labels;
  /** Sorted by time, oldest first. */
  entries: LogEntry[];
}

export interface Span {
  spanId: string;
  parentId?: string;
  service: string;
  name: string;
  /** Milliseconds from the start of the trace. */
  start: number;
  duration: number;
  status: 'ok' | 'error';
  attrs: Record<string, string | number>;
}

export interface Trace {
  traceId: string;
  /** Epoch ms of the root span start. */
  at: number;
  route: string;
  spans: Span[];
}

export interface LogDb {
  streams: LogStream[];
  traces: Trace[];
  start: number;
  end: number;
}

export const LOG_HOURS = 2;
const STEP = 3_000;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROUTES = [
  { route: '/', method: 'GET', w: 0.35, ms: 40 },
  { route: '/cart', method: 'GET', w: 0.25, ms: 60 },
  { route: '/checkout', method: 'POST', w: 0.1, ms: 120 },
  { route: '/api/products', method: 'GET', w: 0.3, ms: 30 },
];

export const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');

export function generateLogs(incident: Incident = 'none', seed = 11): LogDb {
  const rand = rng(seed);
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  const start = NOW - LOG_HOURS * 3_600_000;
  const incStart = NOW - 45 * 60_000;
  const deployAt = incStart - 3 * 60_000;
  const streams: LogStream[] = [];
  const traces: Trace[] = [];
  const stream = (labels: Labels): LogStream => {
    const s = { labels, entries: [] as LogEntry[] };
    streams.push(s);
    return s;
  };
  const pick = () => {
    let x = rand();
    for (const r of ROUTES) {
      if ((x -= r.w) <= 0) return r;
    }
    return ROUTES[0];
  };
  for (let i = 1; i <= 3; i++) {
    const instance = `api-${i}:8080`;
    const out = stream({ namespace: 'shop', app: 'api', instance, stream: 'stdout' });
    const err = stream({ namespace: 'shop', app: 'api', instance, stream: 'stderr' });
    const version = (t: number) => (incident === 'checkout' && t >= deployAt ? '2.3.1' : '2.3.0');
    out.entries.push({ ts: start + i * 700, line: JSON.stringify({ ts: iso(start + i * 700), level: 'info', msg: 'server started', version: version(start), port: 8080 }) });
    if (incident === 'checkout') out.entries.push({ ts: deployAt + i * 4000, line: JSON.stringify({ ts: iso(deployAt + i * 4000), level: 'info', msg: 'server started', version: '2.3.1', port: 8080 }) });
    if (incident === 'k8s' && i === 3)
      for (const m of OOM_AT_MIN) {
        const t = NOW - m * 60_000 + 9000;
        out.entries.push({ ts: t, line: JSON.stringify({ ts: iso(t), level: 'info', msg: 'server started', version: '2.3.0', port: 8080 }) });
      }
    for (let t = start + i * 1300; t <= NOW; t += STEP + Math.floor(rand() * 2000) - 1000) {
      const r = pick();
      const on = incident === 'checkout' && r.route === '/checkout' && t >= incStart;
      const items = 2 + Math.floor(rand() * 10);
      let ms = Math.round(r.ms * (0.6 + rand() * 0.9));
      let status = rand() < (r.route === '/checkout' ? 0.004 : 0.002) ? 500 : 200;
      let msg = 'request completed';
      if (on) {
        ms = Math.round(1400 + rand() * 650);
        if (rand() < 0.25) {
          status = 500;
          ms = 2000 + Math.floor(rand() * 15);
          msg = 'acquire connection: pool exhausted (timeout 2s)';
        }
      } else if (status === 500) msg = 'upstream error: payment gateway returned 502';
      const traceId = hex(32);
      const rec = { ts: iso(t), level: status >= 500 ? 'error' : 'info', msg, method: r.method, route: r.route, status, duration_ms: ms, trace_id: traceId, user_id: `u${10000 + Math.floor(rand() * 89999)}`, version: version(t) };
      out.entries.push({ ts: t, line: JSON.stringify(rec) });
      if (on && status !== 500 && ms > 1800) {
        const tw = t - 1;
        out.entries.push({ ts: tw, line: JSON.stringify({ ts: iso(tw), level: 'warn', msg: 'slow request', route: r.route, duration_ms: ms, db_queries: items + 1, trace_id: traceId }) });
      }
      if (status === 500 && on) err.entries.push({ ts: t, line: `goroutine 4711 [running]:\nerror: acquire connection: context deadline exceeded after 2s (pool size 20, in use 20)` });
      // Traces of the last hour: every /checkout and every error, a fifth of the rest (sampling).
      if (t >= NOW - 3_600_000 && (r.route === '/checkout' || status >= 500 || rand() < 0.2)) traces.push(buildTrace(traceId, t - ms - 6, r.route, r.method, instance, ms, status, on, items, version(t), hex));
    }
  }
  for (let i = 1; i <= 2; i++) {
    const instance = `frontend-${i}:3000`;
    const s = stream({ namespace: 'shop', app: 'frontend', instance, stream: 'stdout' });
    for (let t = start + i * 900; t <= NOW; t += 2 * STEP + Math.floor(rand() * 2000) - 1000) {
      const r = pick();
      const on = incident === 'checkout' && r.route === '/checkout' && t >= incStart;
      const ms = on ? Math.round(1450 + rand() * 700) : Math.round(r.ms * 1.3 * (0.6 + rand() * 0.9));
      const status = on && rand() < 0.25 ? 502 : 200;
      s.entries.push({ ts: t, line: `ts=${iso(t)} level=${status >= 500 ? 'error' : 'info'} msg="${r.method} ${r.route}" status=${status} duration=${ms}ms upstream=api` });
    }
  }
  const w = stream({ namespace: 'shop', app: 'worker', instance: 'worker-1:9000', stream: 'stdout' });
  for (let t = start + 5000, n = 48100; t <= NOW; t += 30_000, n++) {
    const d = new Date(t).toISOString().replace('T', ' ').replace(/\.(\d{3})Z$/, ',$1');
    w.entries.push({ ts: t, line: `${d} INFO worker: processed order ${n} in ${200 + Math.floor(rand() * 250)}ms` });
  }
  for (const s of streams) s.entries.sort((a, b) => a.ts - b.ts);
  return { streams: streams.filter((s) => s.entries.length), traces, start, end: NOW };
}

function buildTrace(traceId: string, at: number, route: string, method: string, instance: string, apiMs: number, status: number, slowCheckout: boolean, items: number, version: string, hex: (n: number) => string): Trace {
  const spans: Span[] = [];
  const id = () => hex(16);
  const root = id();
  const api = id();
  const total = apiMs + 6;
  spans.push({ spanId: root, service: 'frontend', name: `${method} ${route}`, start: 0, duration: total, status: status >= 500 ? 'error' : 'ok', attrs: { 'http.request.method': method, 'url.path': route, 'http.response.status_code': status >= 500 ? 502 : 200, 'service.instance.id': 'frontend-1:3000' } });
  spans.push({ spanId: api, parentId: root, service: 'api', name: `${method} ${route}`, start: 3, duration: apiMs, status: status >= 500 ? 'error' : 'ok', attrs: { 'http.request.method': method, 'http.route': route, 'http.response.status_code': status, 'service.instance.id': instance, 'service.version': version } });
  let t = 5;
  if (route === '/api/products') {
    spans.push({ spanId: id(), parentId: api, service: 'api', name: 'cache GET products', start: t, duration: 2, status: 'ok', attrs: { 'db.system': 'redis', 'db.operation': 'GET' } });
    t += 3;
  }
  if (route === '/checkout' || route === '/cart') {
    if (slowCheckout) {
      // The new version makes one query per cart item, and each waits for a free connection.
      const wait = Math.max(50, apiMs - 40 - items * 8);
      spans.push({ spanId: id(), parentId: api, service: 'api', name: 'db.pool.acquire', start: t, duration: Math.min(wait, 2000), status: status >= 500 ? 'error' : 'ok', attrs: { 'db.client.connection.pool.name': 'main', 'db.client.connection.pool.max': 20, 'db.client.connection.pool.used': 20 } });
      t += Math.min(wait, 2000);
      if (status < 500)
        for (let k = 0; k < items; k++) {
          spans.push({ spanId: id(), parentId: api, service: 'postgres', name: 'SELECT products', start: t, duration: 7, status: 'ok', attrs: { 'db.system': 'postgresql', 'db.query.text': 'SELECT * FROM products WHERE id = $1', 'db.response.returned_rows': 1 } });
          t += 8;
        }
    } else {
      spans.push({ spanId: id(), parentId: api, service: 'api', name: 'db.pool.acquire', start: t, duration: 1, status: 'ok', attrs: { 'db.client.connection.pool.name': 'main', 'db.client.connection.pool.max': 20, 'db.client.connection.pool.used': 6 } });
      t += 1;
      spans.push({ spanId: id(), parentId: api, service: 'postgres', name: 'SELECT cart_items JOIN products', start: t, duration: Math.max(4, Math.round(apiMs * 0.5)), status: 'ok', attrs: { 'db.system': 'postgresql', 'db.query.text': 'SELECT … FROM cart_items JOIN products …', 'db.response.returned_rows': items } });
    }
  }
  if (route === '/') spans.push({ spanId: id(), parentId: api, service: 'api', name: 'render home', start: t, duration: Math.max(3, apiMs - 8), status: 'ok', attrs: { 'code.function.name': 'renderHome' } });
  return { traceId, at, route, spans };
}

const cache = new Map<string, LogDb>();
export function logDataset(incident: Incident = 'none'): LogDb {
  const key = incident === 'api-down' || incident === 'restart' ? 'none' : incident;
  if (!cache.has(key)) cache.set(key, generateLogs(key as Incident));
  return cache.get(key)!;
}
