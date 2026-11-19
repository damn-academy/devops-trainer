// The logs, traces and Kubernetes lessons and the monitoring exam: every goal
// is reachable with a real query or click path, and the lint is clean.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import { lintRegistry } from '../src/core/lint';
import type { DocsSection, Exam, Lesson, TerminalSection, WidgetSection } from '../src/core/types';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';
import { dataset } from '../src/blocks/monitoring/prom/data';
import { query } from '../src/blocks/monitoring/prom/promql';
import { logDataset } from '../src/blocks/monitoring/logs/data';
import { flatEntries, runLogQL } from '../src/blocks/monitoring/logs/logql';
import type { LogsProps, TraceState, TracesProps } from '../src/blocks/monitoring/logs/widgets';
import type { WorkbenchProps } from '../src/blocks/monitoring/workbench';

const section = (l: string, s: string) => (registry.lessons.get(l) as Lesson).sections.find((x) => x.id === s)!;
const MON = '/home/learner/mon';
async function run(m: SimMachine, line: string) {
  return m.exec(line);
}
const passes = async (m: SimMachine, check: Parameters<typeof evaluateCheck>[0], start?: Awaited<ReturnType<SimMachine['facts']>>) => evaluateCheck(check, await m.facts(), start).pass;

describe('log explorer goals', () => {
  const SOL: Record<string, string> = {
    errors: '{app="api"} | json | level="error"',
    route: '{app="api"} | json | route="/checkout" | status = 500',
    count: 'sum by (route) (count_over_time({app="api"} | json | status >= 500 [15m]))',
    version: 'sum by (version) (count_over_time({app="api"} | json | level="error" [15m]))',
  };
  it('every goal passes with a reference query and a wrong one does not', () => {
    const p = (section('monitoring.logs', 'explore') as WidgetSection).props as LogsProps;
    const db = logDataset(p.incident);
    for (const g of p.goals ?? []) {
      const q = SOL[g.id];
      expect(q, g.id).toBeDefined();
      expect(g.test(runLogQL(db, q, { limit: 200 }), q), g.id).toBe(true);
    }
    const count = p.goals!.find((g) => g.id === 'count')!;
    const wrong = 'count_over_time({app="api"} | json | status >= 500 [15m])';
    expect(count.test(runLogQL(db, wrong), wrong)).toBe(false);
  });
});

describe('trace viewer goals', () => {
  it('a learner path through search, waterfall and a log trace_id meets every goal', () => {
    const p = (section('monitoring.traces', 'viewer') as WidgetSection).props as TracesProps;
    const db = logDataset(p.incident);
    const goals = p.goals!;
    const by = (id: string) => goals.find((g) => g.id === id)!;
    const slow = db.traces.filter((t) => t.route === '/checkout' && t.spans[0].duration > 1500).sort((a, b) => b.spans[0].duration - a.spans[0].duration);
    const s: TraceState = { search: { service: 'frontend', route: '/checkout', minMs: 1500, traceId: '' }, trace: slow[0] };
    expect(by('slow').test(s)).toBe(true);
    s.span = slow[0].spans.find((x) => x.name === 'db.pool.acquire');
    expect(by('span').test(s)).toBe(true);
    const nplus = slow.find((t) => t.spans.filter((x) => x.name === 'SELECT products').length >= 3)!;
    expect(by('nplus1').test({ ...s, trace: nplus, span: nplus.spans.find((x) => x.name === 'SELECT products') })).toBe(true);
    const line = flatEntries(runLogQL(db, '{app="api", stream="stdout"} | json | level="error"', { limit: 1 }))[0];
    const id = /"trace_id":"(\w+)"/.exec(line.line)![1];
    const tr = db.traces.find((t) => t.traceId === id)!;
    expect(tr).toBeDefined();
    expect(by('from-log').test({ search: { service: 'frontend', route: '', minMs: 0, traceId: id }, trace: tr })).toBe(true);
    expect(by('span').test({ ...s, span: slow[0].spans[0] })).toBe(false);
  });
});

describe('Kubernetes workbench goals', () => {
  const SOL: Record<string, string> = {
    restarts: 'increase(kube_pod_container_status_restarts_total[1h]) > 0',
    reason: 'kube_pod_container_status_last_terminated_reason',
    memory: 'max by (pod) (max_over_time(container_memory_working_set_bytes{namespace="shop"}[1h]) / container_spec_memory_limit_bytes{namespace="shop"})',
    throttle: 'sum by (pod) (rate(container_cpu_cfs_throttled_periods_total[5m])) / sum by (pod) (rate(container_cpu_cfs_periods_total[5m]))',
    replicas: 'kube_deployment_spec_replicas != kube_deployment_status_replicas_available',
  };
  it('every goal passes with a reference query', () => {
    const p = (section('monitoring.k8s', 'bench') as WidgetSection).props as WorkbenchProps;
    const db = dataset(p.incident);
    for (const g of p.goals ?? []) expect(g.test!(query(db, SOL[g.id]), SOL[g.id]), g.id).toBe(true);
    expect(() => query(db, p.query!)).not.toThrow();
    expect(p.goals!.find((g) => g.id === 'memory')!.test!(query(db, 'max by (pod) (container_memory_working_set_bytes{namespace="shop"} / container_spec_memory_limit_bytes{namespace="shop"})'), '')).toBe(false);
  });
});

describe('terminal labs', () => {
  it('logs lab: tail and one number', async () => {
    const s = section('monitoring.logs', 'lab') as TerminalSection;
    const m = await createSimMachine(s.setup);
    await run(m, `logcli query --limit=5 '{app="worker"}'`);
    expect(await passes(m, s.tasks[0].check)).toBe(true);
    await run(m, `logcli instant-query 'count_over_time({app="frontend"} | logfmt | status="502" [30m])'`);
    expect(evaluateCheck(s.tasks[1].check, await m.facts()).say).toBeDefined();
    await run(m, `logcli instant-query 'sum(count_over_time({app="frontend"} | logfmt | status="502" [30m]))'`);
    expect(await passes(m, s.tasks[1].check)).toBe(true);
  });
  it('logs forcing: --forward', async () => {
    const d = section('monitoring.logs', 'forcing') as DocsSection;
    const m = await createSimMachine(d.terminal!.setup);
    await run(m, `logcli query --limit=3 '{app="api", stream="stdout"} | json | level="error"'`);
    expect(await passes(m, d.terminal!.task.check)).toBe(false);
    await run(m, `logcli query --forward --limit=3 '{app="api", stream="stdout"} | json | level="error"'`);
    expect(await passes(m, d.terminal!.task.check)).toBe(true);
  });
  it('k8s lab: two alert rules', async () => {
    const s = section('monitoring.k8s', 'lab') as TerminalSection;
    const m = await createSimMachine(s.setup);
    m.rootFs.writeFile(`${MON}/rules.yml`, 'groups:\n  - name: shop-k8s\n    rules:\n      - alert: PodRestarting\n        expr: increase(kube_pod_container_status_restarts_total[1h]) > 2\n        labels:\n          severity: warning\n');
    expect((await run(m, 'promtool check rules rules.yml')).out).toContain('SUCCESS: 1 rules found');
    expect(await passes(m, s.tasks[0].check)).toBe(true);
    expect(await passes(m, s.tasks[1].check)).toBe(false);
    m.rootFs.writeFile(`${MON}/rules.yml`, (await run(m, 'cat rules.yml')).out + '      - alert: DeploymentReplicasMismatch\n        expr: kube_deployment_spec_replicas != kube_deployment_status_replicas_available\n        for: 10m\n');
    expect(await passes(m, s.tasks[1].check)).toBe(true);
  });
  it('k8s forcing: predict_linear', async () => {
    const d = section('monitoring.k8s', 'forcing') as DocsSection;
    const m = await createSimMachine(d.terminal!.setup);
    await run(m, `promtool query instant http://localhost:9090 'container_memory_working_set_bytes{namespace="shop"}'`);
    expect(await passes(m, d.terminal!.task.check)).toBe(false);
    await run(m, `promtool query instant http://localhost:9090 'predict_linear(container_memory_working_set_bytes{namespace="shop"}[10m], 1200)'`);
    expect(await passes(m, d.terminal!.task.check)).toBe(true);
  });
});

describe('monitoring exam', () => {
  const exam = () => registry.exams.get('monitoring.exam') as Exam;
  const task = (id: string) => {
    const t = exam().tasks.find((x) => x.id === id)!;
    if (t.kind !== 'task') throw new Error('not a task');
    return t;
  };
  it('restart alert, errors by route, memory ratio, raw lines', async () => {
    const a = task('restart-alert');
    const m1 = await createSimMachine(a.setup);
    m1.rootFs.writeFile(`${MON}/rules.yml`, 'groups:\n  - name: x\n    rules:\n      - alert: PodRestarting\n        expr: increase(kube_pod_container_status_restarts_total{pod="api-6f9c7d-q7rvn"}[1h]) > 2\n');
    expect(await passes(m1, a.task.check)).toBe(false);
    m1.rootFs.writeFile(`${MON}/rules.yml`, 'groups:\n  - name: x\n    rules:\n      - alert: PodRestarting\n        expr: increase(kube_pod_container_status_restarts_total[1h]) > 2\n');
    expect(await passes(m1, a.task.check)).toBe(true);

    const b = task('errors-by-route');
    const m2 = await createSimMachine(b.setup);
    await run(m2, `logcli instant-query 'sum by (route) (count_over_time({app="api"} | json | status >= 500 [15m]))'`);
    expect(await passes(m2, b.task.check)).toBe(true);
    await run(m2, `logcli instant-query 'sum(count_over_time({app="api"} | json | status >= 500 [15m]))'`);
    expect(await passes(m2, b.task.check)).toBe(false);

    const c = task('memory');
    const m3 = await createSimMachine(c.setup);
    await run(m3, `promtool query instant http://localhost:9090 'sum by (pod) (container_memory_working_set_bytes{namespace="shop"}) / sum by (pod) (container_spec_memory_limit_bytes{namespace="shop"})'`);
    expect(await passes(m3, c.task.check)).toBe(true);

    const d = task('raw-lines');
    const m4 = await createSimMachine(d.setup);
    await run(m4, `logcli query --limit=5 '{app="api", stream="stdout"} | json | level="error"'`);
    expect(await passes(m4, d.task.check)).toBe(false);
    await run(m4, `logcli query -o raw --limit=5 '{app="api", stream="stdout"} | json | level="error"'`);
    expect(await passes(m4, d.task.check)).toBe(true);
  });
});

describe('monitoring lint', () => {
  it('no errors or warnings for the monitoring block', () => {
    const mine = lintRegistry(registry).filter((i) => /monitoring|obs\./.test(i.where));
    expect(mine.map((i) => `${i.level} ${i.where}: ${i.msg}`).join('\n')).toBe('');
  });
});
