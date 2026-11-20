// The training system "Shop" (06 §7.1) and its metrics: a deterministic
// generator writes three hours of samples at the scrape interval into an
// in-memory TSDB. Incidents change rates and latency distributions on an
// interval, so the same queries find the same evidence every time.

import { K8S_META, kubeSeries } from './k8s';

export type Labels = Record<string, string>;

export interface Series {
  labels: Labels;
  /** [timestamp ms, value], sorted by time. */
  samples: [number, number][];
}

export interface Tsdb {
  series: Series[];
  start: number;
  end: number;
  step: number;
  meta: Record<string, { type: 'counter' | 'gauge' | 'histogram' | 'summary'; help: string }>;
}

export const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);
export const SCRAPE = 15_000;
export const BUCKETS = ['0.005', '0.01', '0.025', '0.05', '0.1', '0.25', '0.5', '1.0', '2.5', '5.0', '10.0', '+Inf'];

/** 'k8s' adds the series of kube-state-metrics and cAdvisor of the Shop running in Kubernetes. */
export type Incident = 'none' | 'checkout' | 'api-down' | 'restart' | 'k8s';

export function seriesKey(l: Labels): string {
  return Object.keys(l)
    .sort()
    .map((k) => `${k}="${l[k]}"`)
    .join(',');
}

/** A small seeded PRNG (mulberry32), so noise is the same on every page load. */
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
  { route: '/', weight: 0.35, lat: 0.04 },
  { route: '/cart', weight: 0.25, lat: 0.06 },
  { route: '/checkout', weight: 0.1, lat: 0.12 },
  { route: '/api/products', weight: 0.3, lat: 0.03 },
];

/** Normal CDF approximation for the latency distribution (lognormal by route). */
function cdf(x: number, median: number, sigma = 0.55): number {
  if (x <= 0) return 0;
  const z = (Math.log(x) - Math.log(median)) / sigma;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export interface GenOptions {
  incident?: Incident;
  seed?: number;
  hours?: number;
  /** When the incident starts, ms before NOW. */
  incidentAgo?: number;
}

export function generate(o: GenOptions = {}): Tsdb {
  const incident = o.incident ?? 'none';
  const hours = o.hours ?? 3;
  const start = NOW - hours * 3_600_000;
  const steps = Math.round((NOW - start) / SCRAPE);
  const rand = rng(o.seed ?? 7);
  const incStart = NOW - (o.incidentAgo ?? 45 * 60_000);
  const deployAt = incStart - 3 * 60_000;
  const out: Series[] = [];
  const meta: Tsdb['meta'] = {
    http_requests_total: { type: 'counter', help: 'Total HTTP requests by method, route and status code.' },
    http_request_duration_seconds: { type: 'histogram', help: 'HTTP request latency.' },
    db_connections_in_use: { type: 'gauge', help: 'Connections of the pool in use.' },
    db_connections_max: { type: 'gauge', help: 'Size of the connection pool.' },
    node_cpu_seconds_total: { type: 'counter', help: 'Seconds the CPUs spent in each mode.' },
    node_memory_MemAvailable_bytes: { type: 'gauge', help: 'Memory information field MemAvailable_bytes.' },
    node_memory_MemTotal_bytes: { type: 'gauge', help: 'Memory information field MemTotal_bytes.' },
    up: { type: 'gauge', help: 'Whether the target was scraped successfully (synthetic).' },
    process_start_time_seconds: { type: 'gauge', help: 'Start time of the process since unix epoch in seconds.' },
    app_build_info: { type: 'gauge', help: 'A metric with a constant 1 value labeled by version.' },
  };
  const instances = [
    { job: 'api', instance: 'api-1:8080', node: 'node-1' },
    { job: 'api', instance: 'api-2:8080', node: 'node-2' },
    { job: 'api', instance: 'api-3:8080', node: 'node-3' },
    { job: 'frontend', instance: 'frontend-1:3000', node: 'node-1' },
    { job: 'frontend', instance: 'frontend-2:3000', node: 'node-2' },
  ];
  const ts = (i: number) => start + i * SCRAPE;
  const down = (inst: string, t: number) => incident === 'api-down' && inst === 'api-3:8080' && t >= incStart;
  const restartAt = incident === 'restart' ? incStart : Infinity;
  for (const ins of instances) {
    const isApi = ins.job === 'api';
    const base = isApi ? 14 : 9; // requests per second per instance
    const counters = new Map<string, Series>();
    const hist = new Map<string, Series>();
    const upS: Series = { labels: { __name__: 'up', job: ins.job, instance: ins.instance }, samples: [] };
    const startS: Series = { labels: { __name__: 'process_start_time_seconds', job: ins.job, instance: ins.instance }, samples: [] };
    const acc = new Map<string, number>();
    // Counts of requests are whole numbers: the expected count accumulates as a
    // fraction and the counter shows its floor, which keeps it monotonic and the
    // buckets cumulative. Only _sum (seconds) stays fractional.
    const add = (m: Map<string, Series>, l: Labels, t: number, inc: number) => {
      const k = seriesKey(l);
      if (!m.has(k)) m.set(k, { labels: l, samples: [] });
      const v = (acc.get(k) ?? 0) + inc;
      acc.set(k, v);
      m.get(k)!.samples.push([t, l.__name__.endsWith('_sum') ? Math.round(v * 1000) / 1000 : Math.floor(v + 1e-9)]);
    };
    let restarted = false;
    for (let i = 0; i <= steps; i++) {
      const t = ts(i);
      if (down(ins.instance, t)) {
        upS.samples.push([t, 0]);
        continue;
      }
      if (ins.instance === 'api-2:8080' && t >= restartAt && !restarted) {
        // The process restarts: every counter starts from zero again.
        restarted = true;
        for (const k of acc.keys()) acc.set(k, 0);
      }
      upS.samples.push([t, 1]);
      startS.samples.push([t, Math.floor((restarted ? restartAt : start - 86_400_000) / 1000)]);
      const daily = 1 + 0.25 * Math.sin(((t - start) / 3_600_000) * 1.3);
      for (const r of ROUTES) {
        const rps = base * r.weight * daily * (0.9 + 0.2 * rand());
        const n = rps * (SCRAPE / 1000);
        const incidentOn = incident === 'checkout' && isApi && r.route === '/checkout' && t >= incStart;
        const errShare = incidentOn ? 0.25 : r.route === '/checkout' ? 0.004 : 0.002;
        const err = n * errShare;
        add(counters, { __name__: 'http_requests_total', job: ins.job, instance: ins.instance, method: r.route === '/checkout' ? 'POST' : 'GET', route: r.route, code: '200' }, t, n - err);
        add(counters, { __name__: 'http_requests_total', job: ins.job, instance: ins.instance, method: r.route === '/checkout' ? 'POST' : 'GET', route: r.route, code: '500' }, t, err);
        const median = incidentOn ? 1.6 : r.lat * (isApi ? 1 : 0.7);
        let prev = 0;
        for (const le of BUCKETS) {
          const share = le === '+Inf' ? 1 : cdf(Number(le), median);
          void prev;
          prev = share;
          add(hist, { __name__: 'http_request_duration_seconds_bucket', job: ins.job, instance: ins.instance, route: r.route, le }, t, n * share);
        }
        add(hist, { __name__: 'http_request_duration_seconds_count', job: ins.job, instance: ins.instance, route: r.route }, t, n);
        add(hist, { __name__: 'http_request_duration_seconds_sum', job: ins.job, instance: ins.instance, route: r.route }, t, n * median * 1.16);
      }
    }
    out.push(upS, startS, ...counters.values(), ...hist.values());
    if (isApi) {
      const inUse: Series = { labels: { __name__: 'db_connections_in_use', job: 'api', instance: ins.instance, pool: 'main' }, samples: [] };
      const max: Series = { labels: { __name__: 'db_connections_max', job: 'api', instance: ins.instance, pool: 'main' }, samples: [] };
      for (let i = 0; i <= steps; i++) {
        const t = ts(i);
        if (down(ins.instance, t)) continue;
        const busy = incident === 'checkout' && t >= incStart ? 20 : Math.round(5 + 3 * rand());
        inUse.samples.push([t, busy]);
        max.samples.push([t, 20]);
      }
      out.push(inUse, max);
      const v1: Series = { labels: { __name__: 'app_build_info', job: 'api', instance: ins.instance, version: '2.3.0' }, samples: [] };
      const v2: Series = { labels: { __name__: 'app_build_info', job: 'api', instance: ins.instance, version: '2.3.1' }, samples: [] };
      for (let i = 0; i <= steps; i++) {
        const t = ts(i);
        if (down(ins.instance, t)) continue;
        (incident === 'checkout' && t >= deployAt ? v2 : v1).samples.push([t, 1]);
      }
      out.push(...[v1, v2].filter((s) => s.samples.length));
    }
  }
  for (const node of ['node-1', 'node-2', 'node-3']) {
    const inst = `${node}:9100`;
    const memTotal = 8 * 1024 ** 3;
    const mt: Series = { labels: { __name__: 'node_memory_MemTotal_bytes', job: 'node', instance: inst }, samples: [] };
    const ma: Series = { labels: { __name__: 'node_memory_MemAvailable_bytes', job: 'node', instance: inst }, samples: [] };
    const up: Series = { labels: { __name__: 'up', job: 'node', instance: inst }, samples: [] };
    const cpu = new Map<string, Series>();
    const accCpu = new Map<string, number>();
    for (let i = 0; i <= steps; i++) {
      const t = ts(i);
      up.samples.push([t, 1]);
      mt.samples.push([t, memTotal]);
      ma.samples.push([t, Math.round(memTotal * (0.55 - 0.1 * rand()))]);
      for (const c of ['0', '1']) {
        const busy = 0.2 + 0.1 * rand() + (node === 'node-1' ? 0.15 : 0);
        for (const [mode, share] of [['idle', 1 - busy], ['user', busy * 0.7], ['system', busy * 0.3]] as const) {
          const l = { __name__: 'node_cpu_seconds_total', job: 'node', instance: inst, cpu: c, mode };
          const k = seriesKey(l);
          const v = (accCpu.get(k) ?? 0) + share * (SCRAPE / 1000);
          accCpu.set(k, v);
          if (!cpu.has(k)) cpu.set(k, { labels: l, samples: [] });
          cpu.get(k)!.samples.push([t, Math.round(v * 100) / 100]);
        }
      }
    }
    out.push(up, mt, ma, ...cpu.values());
  }
  if (incident === 'k8s') {
    out.push(...kubeSeries(ts, steps, NOW, rand));
    Object.assign(meta, K8S_META);
  }
  return { series: out, start, end: NOW, step: SCRAPE, meta };
}

const cache = new Map<string, Tsdb>();
export function dataset(incident: Incident = 'none'): Tsdb {
  if (!cache.has(incident)) cache.set(incident, generate({ incident }));
  return cache.get(incident)!;
}

/** The text a target returns on GET /metrics at time t (exposition format 0.0.4). */
export function exposition(db: Tsdb, instance: string, t = db.end): string {
  const byName = new Map<string, Series[]>();
  for (const s of db.series) {
    if (s.labels.instance !== instance || s.labels.__name__ === 'up') continue;
    const name = s.labels.__name__;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(s);
  }
  let out = '';
  const family = (n: string) => n.replace(/_(bucket|sum|count)$/, '');
  const done = new Set<string>();
  for (const [name, ss] of byName) {
    const fam = family(name);
    const m = db.meta[fam] ?? db.meta[name];
    if (m && !done.has(fam)) {
      out += `# HELP ${fam} ${m.help}\n# TYPE ${fam} ${m.type}\n`;
      done.add(fam);
    }
    for (const s of ss) {
      const v = [...s.samples].reverse().find(([ts]) => ts <= t);
      if (!v) continue;
      const labels = Object.entries(s.labels)
        .filter(([k]) => k !== '__name__' && k !== 'job' && k !== 'instance')
        .map(([k, x]) => `${k}="${x}"`)
        .join(',');
      out += `${name}${labels ? `{${labels}}` : ''} ${v[1]}\n`;
    }
  }
  return out;
}
