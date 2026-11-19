// The monitoring labs and workbench goals are solvable with real queries.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import type { DocsSection, Lesson, TerminalSection, WidgetSection } from '../src/core/types';
import { createSimMachine } from '../src/engine/terminal/shell';
import { dataset } from '../src/blocks/monitoring/prom/data';
import { equivalent, query } from '../src/blocks/monitoring/prom/promql';
import type { WorkbenchProps } from '../src/blocks/monitoring/workbench';

const section = (l: string, s: string) => (registry.lessons.get(l) as Lesson).sections.find((x) => x.id === s)!;

const SOLUTIONS: Record<string, string> = {
  up: 'up{job="api"}',
  one: 'http_requests_total{instance="api-1:8080"}',
  gauge: 'db_connections_in_use{job="api"}',
  rate: 'rate(http_requests_total{job="api",instance="api-2:8080",route="/cart",code="200"}[5m])',
  'by-route': 'sum by (route) (rate(http_requests_total{job="api"}[5m]))',
  errors: 'sum(rate(http_requests_total{job="api",code=~"5.."}[5m])) / sum(rate(http_requests_total{job="api"}[5m]))',
  cpu: '1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))',
  'p99-route': 'histogram_quantile(0.99, sum by (route, le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))',
  p50: 'histogram_quantile(0.5, sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))',
  route: 'histogram_quantile(0.99, sum by (route, le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))',
  instance: 'histogram_quantile(0.99, sum by (instance, le) (rate(http_request_duration_seconds_bucket{job="api",route="/checkout"}[5m])))',
  traffic: 'sum(rate(http_requests_total{job="api"}[5m])) / sum(rate(http_requests_total{job="api"}[5m] offset 1h))',
  pool: 'db_connections_in_use / db_connections_max',
  version: 'app_build_info',
};

describe('workbench goals', () => {
  for (const [lesson, sec] of [['monitoring.series', 'bench'], ['monitoring.promql', 'bench'], ['monitoring.histogram', 'bench'], ['monitoring.incident', 'drill']]) {
    it(`${lesson} goals pass with a reference solution`, () => {
      const p = (section(lesson, sec) as WidgetSection).props as WorkbenchProps;
      const db = dataset(p.incident ?? 'none');
      for (const g of p.goals ?? []) {
        const q = SOLUTIONS[g.id];
        expect(q, g.id).toBeDefined();
        const ok = g.reference ? equivalent(db, q, g.reference).ok : g.test!(query(db, q), q);
        expect(ok, `${lesson}/${g.id}`).toBe(true);
      }
      if (p.query) expect(() => query(db, p.query!)).not.toThrow();
    });
  }
  it('a wrong aggregation does not pass', () => {
    const db = dataset('none');
    expect(equivalent(db, 'sum(rate(http_requests_total{job="api"}[5m]))', 'sum by (route) (rate(http_requests_total{job="api"}[5m]))').ok).toBe(false);
  });
});

describe('monitoring terminal labs', () => {
  it('alerts lab', async () => {
    const s = section('monitoring.alerts', 'lab') as TerminalSection;
    const m = await createSimMachine(s.setup);
    m.rootFs.writeFile('/home/learner/mon/rules.yml', 'groups:\n  - name: api\n    rules:\n      - alert: ApiHighErrorRate\n        expr: sum(rate(http_requests_total{job="api",code=~"5.."}[5m])) / sum(rate(http_requests_total{job="api"}[5m])) > 0.02\n        for: 10m\n        labels:\n          severity: page\n');
    const r = await m.exec('promtool check rules rules.yml');
    expect(r.out).toContain('SUCCESS: 1 rules found');
    expect(evaluateCheck(s.tasks[0].check, await m.facts()).pass).toBe(true);
    m.rootFs.writeFile('/home/learner/mon/alertmanager.yml', (await m.exec('cat alertmanager.yml')).out.replace('      receiver: pager\n', '      receiver: pager\n    - matchers: [team="cafe", severity="warning"]\n      receiver: team-chat\n'));
    expect((await m.exec('amtool config routes test --config.file=alertmanager.yml team=cafe severity=warning')).out).toBe('team-chat\n');
    expect(evaluateCheck(s.tasks[1].check, await m.facts()).pass).toBe(true);
  });
  it('find and forcing tasks', async () => {
    for (const [l, sec, q] of [
      ['monitoring.promql', 'findfn', `promtool query instant http://localhost:9090 'absent(up{job="cache"})'`],
      ['monitoring.alerts', 'forcing', `promtool query instant http://localhost:9090 'label_replace(up{job="api"}, "host", "$1", "instance", "(.*)")'`],
    ]) {
      const d = section(l, sec) as DocsSection;
      const m = await createSimMachine(d.terminal!.setup);
      await m.exec(q);
      expect(evaluateCheck(d.terminal!.task.check, await m.facts()).pass, `${l}/${sec}`).toBe(true);
    }
  });
});
