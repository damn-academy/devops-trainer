import { describe, expect, it } from 'vitest';
import { dataset, exposition, generate, NOW, type Tsdb } from '../src/blocks/monitoring/prom/data';
import { bucketQuantile, equivalent, parse, query } from '../src/blocks/monitoring/prom/promql';
import { evalRule, parseAm, parseRules, routeAlert, inhibited } from '../src/blocks/monitoring/prom/alerts';

const tiny: Tsdb = {
  start: 0,
  end: 600_000,
  step: 15_000,
  meta: {},
  series: [
    // A counter at 1/s, scraped every 15s, with a reset at t=300s.
    { labels: { __name__: 'c_total', job: 'a', instance: 'x' }, samples: Array.from({ length: 41 }, (_, i) => [i * 15_000, i * 15 < 300 ? i * 15 : (i * 15 - 300)] as [number, number]) },
    { labels: { __name__: 'c_total', job: 'a', instance: 'y' }, samples: Array.from({ length: 41 }, (_, i) => [i * 15_000, i * 30] as [number, number]) },
    { labels: { __name__: 'g', job: 'a', instance: 'x' }, samples: [[0, 5], [600_000, 7]] },
  ],
};

describe('promql', () => {
  it('parses and reports errors like Prometheus', () => {
    expect(() => parse('rate(c_total[5m]')).toThrow(/parse error/);
    expect(() => parse('rate(c_total)')).not.toThrow();
    expect(() => query(tiny, 'rate(c_total)')).toThrow('expected type range vector in call to function "rate", got instant vector');
    expect(() => parse('{}')).toThrow('vector selector must contain at least one non-empty matcher');
  });
  it('selects with matchers and looks back', () => {
    const r = query(tiny, 'c_total{instance=~"x|y", job!="b"}');
    expect(r.type === 'vector' && r.data.length).toBe(2);
    const g = query(tiny, 'g', 200_000);
    expect(g.type === 'vector' && g.data[0].value).toBe(5);
    // Nothing within the 5m lookback: the series is absent at this moment.
    const none = query(tiny, 'g', 590_000);
    expect(none.type === 'vector' && none.data.length).toBe(0);
  });
  it('rate handles counter resets and extrapolation', () => {
    const r = query(tiny, 'rate(c_total[5m])');
    if (r.type !== 'vector') throw new Error('vector');
    const x = r.data.find((s) => s.labels.instance === 'x')!.value;
    const y = r.data.find((s) => s.labels.instance === 'y')!.value;
    expect(x).toBeCloseTo(1, 5);
    expect(y).toBeCloseTo(2, 5);
    expect(r.data[0].labels.__name__).toBeUndefined();
    const inc = query(tiny, 'increase(c_total{instance="y"}[1m])');
    expect(inc.type === 'vector' && inc.data[0].value).toBeCloseTo(120, 5);
    // A window with one sample has no rate.
    const one = query(tiny, 'rate(c_total[10s])');
    expect(one.type === 'vector' && one.data.length).toBe(0);
  });
  it('aggregates and matches vectors', () => {
    const s = query(tiny, 'sum(rate(c_total[5m]))');
    expect(s.type === 'vector' && s.data[0].value).toBeCloseTo(3, 5);
    const by = query(tiny, 'sum by (instance) (rate(c_total[5m]))');
    expect(by.type === 'vector' && by.data.map((d) => Object.keys(d.labels))).toEqual([['instance'], ['instance']]);
    const ratio = query(tiny, 'rate(c_total[5m]) / on(instance) group_left g');
    expect(ratio.type === 'vector' && ratio.data.length).toBe(1);
    const cmp = query(tiny, 'rate(c_total[5m]) > 1.5');
    expect(cmp.type === 'vector' && cmp.data.map((d) => d.labels.instance)).toEqual(['y']);
  });
  it('computes quantiles from buckets', () => {
    expect(bucketQuantile(0.5, [{ le: 0.1, count: 50 }, { le: 0.5, count: 90 }, { le: Infinity, count: 100 }])).toBeCloseTo(0.1, 6);
    expect(bucketQuantile(0.9, [{ le: 0.1, count: 50 }, { le: 0.5, count: 90 }, { le: Infinity, count: 100 }])).toBeCloseTo(0.5, 6);
    expect(bucketQuantile(0.7, [{ le: 0.1, count: 50 }, { le: 0.5, count: 90 }, { le: Infinity, count: 100 }])).toBeCloseTo(0.3, 6);
  });
});

describe('the Shop dataset', () => {
  const db = dataset('checkout');
  it('has the expected series and a deterministic generator', () => {
    expect(db.end).toBe(NOW);
    expect(generate({ incident: 'checkout' }).series.length).toBe(db.series.length);
    const up = query(db, 'up');
    expect(up.type === 'vector' && up.data.length).toBe(8);
    expect(exposition(db, 'api-1:8080')).toContain('# TYPE http_requests_total counter');
  });
  it('shows the checkout incident: latency and pool saturation on /checkout only', () => {
    const p99 = query(db, 'histogram_quantile(0.99, sum by (route, le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))');
    if (p99.type !== 'vector') throw new Error('vector');
    const checkout = p99.data.find((s) => s.labels.route === '/checkout')!.value;
    const cart = p99.data.find((s) => s.labels.route === '/cart')!.value;
    expect(checkout).toBeGreaterThan(1);
    expect(cart).toBeLessThan(0.5);
    const pool = query(db, 'max(db_connections_in_use / db_connections_max)');
    expect(pool.type === 'vector' && pool.data[0].value).toBe(1);
    const before = query(db, 'histogram_quantile(0.99, sum by (route, le) (rate(http_request_duration_seconds_bucket{job="api",route="/checkout"}[5m])))', NOW - 90 * 60_000);
    expect(before.type === 'vector' && before.data[0].value).toBeLessThan(1);
    const ver = query(db, 'count by (version) (app_build_info)');
    expect(ver.type === 'vector' && ver.data.map((d) => d.labels.version)).toEqual(['2.3.1']);
  });
  it('checks equivalence of different queries for the same value', () => {
    expect(equivalent(db, 'sum by (route) (rate(http_requests_total{job="api"}[5m]))', 'sum without (instance, code, method, job) (rate(http_requests_total{job="api"}[5m]))').ok).toBe(true);
    expect(equivalent(db, 'sum(rate(http_requests_total{job="api"}[5m]))', 'sum by (instance) (rate(http_requests_total{job="api"}[5m]))').ok).toBe(false);
  });
});

describe('alerts and routing', () => {
  const db = dataset('checkout');
  it('evaluates for: pending, then firing', () => {
    const { groups, errors } = parseRules('groups:\n  - name: api\n    rules:\n      - alert: HighLatencyP99\n        expr: histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m]))) > 1\n        for: 10m\n        labels:\n          severity: page\n', 'rules.yml');
    expect(errors).toEqual([]);
    const tl = evalRule(db, groups[0].rules[0], NOW - 60 * 60_000, NOW);
    const states = tl.points.map((p) => p.state);
    expect(states[0]).toBe('inactive');
    expect(states).toContain('pending');
    expect(states[states.length - 1]).toBe('firing');
    expect(states.indexOf('firing') - states.indexOf('pending')).toBe(10);
  });
  it('rejects bad rules', () => {
    expect(parseRules('groups:\n  - name: x\n    rules:\n      - alert: A\n        expr: rate(x[5m]\n', 'r.yml').errors[0]).toContain('could not parse expression');
  });
  it('routes and inhibits', () => {
    const { config, errors } = parseAm('route:\n  receiver: email\n  group_by: [alertname]\n  routes:\n    - matchers: [severity="critical", team="payments"]\n      receiver: pager\n    - matchers: [severity="warning"]\n      receiver: chat\nreceivers:\n  - name: email\n  - name: pager\n  - name: chat\ninhibit_rules:\n  - source_matchers: [alertname="NodeDown"]\n    target_matchers: [severity="warning"]\n    equal: [instance]\n');
    expect(errors).toEqual([]);
    expect(routeAlert(config!, { severity: 'critical', team: 'payments' }).receivers).toEqual(['pager']);
    expect(routeAlert(config!, { severity: 'critical', team: 'web' }).receivers).toEqual(['email']);
    expect(routeAlert(config!, { severity: 'warning' }).receivers).toEqual(['chat']);
    expect([...inhibited(config!, [{ alertname: 'NodeDown', instance: 'n1' }, { alertname: 'X', severity: 'warning', instance: 'n1' }, { alertname: 'Y', severity: 'warning', instance: 'n2' }])]).toEqual([1]);
  });
});
