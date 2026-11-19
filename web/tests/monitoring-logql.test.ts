// The LogQL subset, the Shop logs and traces, and logcli.

import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine } from '../src/engine/terminal/shell';
import { logDataset } from '../src/blocks/monitoring/logs/data';
import { flatEntries, LogQLError, parseLogQL, runLogQL } from '../src/blocks/monitoring/logs/logql';
import { logcliCommand } from '../src/blocks/monitoring/logs/command';
import { promSetupHook } from '../src/blocks/monitoring/prom/commands';

const db = logDataset('checkout');
const calm = logDataset('none');
const vec = (q: string, d = db) => {
  const r = runLogQL(d, q);
  if (r.type !== 'vector') throw new Error(`not a vector: ${r.type}`);
  return r.data;
};

describe('LogQL parsing', () => {
  it('parses selectors, pipelines and metric queries', () => {
    expect(parseLogQL('{app="api"} |= "error" | json | status >= 500').k).toBe('log');
    expect(parseLogQL('sum by (route) (count_over_time({app="api"} | json | status >= 500 [5m]))').k).toBe('agg');
    expect(parseLogQL('quantile_over_time(0.99, {app="api"} | json | unwrap duration_ms [5m]) by (route)').k).toBe('range');
  });
  it('reports Loki-style errors', () => {
    expect(() => parseLogQL('app="api"')).toThrow(LogQLError);
    expect(() => parseLogQL('{app=~".*"}')).toThrow(/at least one/);
    expect(() => parseLogQL('avg_over_time({app="api"} | json [5m])')).toThrow(/without unwrap/);
    expect(() => parseLogQL('{app="api"} / 2')).toThrow(/log query cannot be used/);
  });
});

describe('log queries', () => {
  it('select streams by labels and filter lines', () => {
    const r = runLogQL(db, '{app="api", instance="api-2:8080"} |= "pool exhausted"', { limit: 1000 });
    const rows = flatEntries(r);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.every((x) => x.labels.instance === 'api-2:8080' && x.line.includes('pool exhausted'))).toBe(true);
    expect(rows[0].ts).toBeGreaterThan(rows.at(-1)!.ts);
  });
  it('json extracts fields into labels; label filters compare numbers and durations', () => {
    const rows = flatEntries(runLogQL(db, '{app="api"} | json | status >= 500 | route="/checkout"', { limit: 1e6 }));
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.every((x) => x.labels.route === '/checkout' && Number(x.labels.status) >= 500)).toBe(true);
    const slow = flatEntries(runLogQL(db, '{app="frontend"} | logfmt | duration > 1.5s', { limit: 1e6 }));
    expect(slow.length).toBeGreaterThan(0);
    expect(slow.every((x) => x.labels.msg === 'POST /checkout')).toBe(true);
  });
  it('a json parser on a plain-text stream marks __error__', () => {
    const rows = flatEntries(runLogQL(db, '{app="worker"} | json'));
    expect(rows[0].labels.__error__).toBe('JSONParserErr');
    expect(flatEntries(runLogQL(db, '{app="worker"} | json | __error__=""'))).toHaveLength(0);
  });
  it('line_format rewrites the line', () => {
    const rows = flatEntries(runLogQL(db, '{app="api"} | json | level="error" | line_format "{{.route}} {{.msg}}"', { limit: 3 }));
    expect(rows[0].line).toMatch(/^\/\S* /);
  });
});

describe('metric queries', () => {
  it('errors per route in the last 15 minutes: only /checkout during the incident', () => {
    const v = vec('sum by (route) (count_over_time({app="api"} | json | status >= 500 [15m]))');
    const checkout = v.find((s) => s.labels.route === '/checkout')!;
    expect(checkout.value).toBeGreaterThan(10);
    expect(v.filter((s) => s.labels.route !== '/checkout').every((s) => s.value < checkout.value / 5)).toBe(true);
  });
  it('rate and the error share', () => {
    const share = vec('sum(rate({app="api"} | json | status >= 500 [10m])) / sum(rate({app="api"} | json [10m]))');
    expect(share[0].value).toBeGreaterThan(0.005);
    const quiet = vec('sum(rate({app="api"} | json | status >= 500 [10m])) / sum(rate({app="api"} | json [10m]))', calm);
    expect(quiet.length === 0 || quiet[0].value < share[0].value).toBe(true);
  });
  it('unwrap: p99 latency from logs by route', () => {
    const v = vec('quantile_over_time(0.99, {app="api"} | json | __error__="" | unwrap duration_ms [10m]) by (route)');
    expect(v.find((s) => s.labels.route === '/checkout')!.value).toBeGreaterThan(1500);
    expect(v.find((s) => s.labels.route === '/')!.value).toBeLessThan(200);
  });
  it('topk and the version that changed', () => {
    const v = vec('topk(1, sum by (version) (count_over_time({app="api"} | json | status >= 500 [15m])))');
    expect(v).toHaveLength(1);
    expect(v[0].labels.version).toBe('2.3.1');
  });
  it('a label with too many values explodes the result', () => {
    expect(vec('count_over_time({app="api"} | json [5m])').length).toBeGreaterThan(30);
  });
});

describe('traces', () => {
  it('the slow checkout traces show the pool wait and one query per cart item', () => {
    const slow = db.traces.filter((t) => t.route === '/checkout' && t.spans[0].duration > 1400);
    expect(slow.length).toBeGreaterThan(5);
    const t = slow.find((x) => x.spans.some((s) => s.name === 'SELECT products'))!;
    const longest = [...t.spans].filter((s) => s.parentId && s.parentId !== t.spans[0].spanId).sort((a, b) => b.duration - a.duration)[0];
    expect(longest.name).toBe('db.pool.acquire');
    expect(t.spans.filter((s) => s.name === 'SELECT products').length).toBeGreaterThan(1);
    const log = flatEntries(runLogQL(db, `{app="api"} |= "${t.traceId}"`));
    expect(log.length).toBeGreaterThan(0);
  });
});

describe('logcli', () => {
  const reg = createTerminalRegistry();
  for (const c of [...BUILTINS, ...BASIC_COMMANDS, logcliCommand]) reg.commands.add(c);
  reg.setup.push(promSetupHook);
  it('query, raw output, instant-query, labels, series', async () => {
    const m = await createSimMachine({ ext: { prom: { incident: 'checkout' } } }, { registry: reg });
    const q = await m.exec(`logcli query --limit=5 '{app="api"} |= "pool exhausted"'`);
    expect(q.exit).toBe(0);
    expect(q.out).toContain('Common labels:');
    expect(q.out.split('\n').filter((l) => l.includes('pool exhausted'))).toHaveLength(5);
    const raw = await m.exec(`logcli query -q -o raw --limit=3 '{app="api"} | json | level="error"'`);
    expect(raw.out.trim().split('\n').every((l) => l.startsWith('{"ts"'))).toBe(true);
    const iq = await m.exec(`logcli instant-query 'sum by (route) (count_over_time({app="api"} | json | status >= 500 [15m]))'`);
    expect(iq.out).toMatch(/"route": "\/checkout"/);
    expect((await m.exec('logcli labels app')).out).toContain('worker');
    expect((await m.exec(`logcli series '{app="api"}'`)).out).toContain('instance="api-1:8080"');
    const bad = await m.exec(`logcli query 'app="api"'`);
    expect(bad.exit).toBe(1);
    expect(bad.out).toContain('parse error');
  });
});
