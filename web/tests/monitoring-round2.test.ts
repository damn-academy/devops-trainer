// Round-two fixes of the monitoring block: the experienced placement covers
// practice, routing and silent sources; the scrape lesson explains a target
// that answers with HTML; the Kubernetes lesson carries the observability
// layer of the cluster constructor with the "why no alert came" scenario.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import type { Lesson, PlacementTask, QuizItem, TextSection, WidgetSection } from '../src/core/types';
import { createSimMachine } from '../src/engine/terminal/shell';
import { ALL_LAYERS, SCENARIOS, componentsFrom, scenarioLayers, type CanvasState } from '../src/engine/kube-lite/ui/constructor-model';
import { COMPONENTS, WIRES } from '../src/engine/kube-lite/ui/constructor';

const lesson = (id: string) => registry.lessons.get(id) as Lesson;
const section = (l: string, s: string) => lesson(l).sections.find((x) => x.id === s)!;

describe('monitoring placement for the experienced track', () => {
  const tasks = () => registry.blocks.get('monitoring')!.placement.filter((t) => t.level === 'experienced');
  it('has enough tasks that one miss is allowed and covers routing and silent sources', () => {
    const ts = tasks();
    expect(ts.length).toBeGreaterThanOrEqual(6);
    const covered = new Set(ts.flatMap((t) => t.concepts));
    for (const c of ['obs.rate', 'obs.aggregation', 'obs.quantile', 'obs.alert-rule', 'obs.alertmanager', 'obs.kube-state-metrics']) expect(covered.has(c), c).toBe(true);
  });
  it('the error-share task passes for a per-route ratio and not for a plain rate', async () => {
    const t = tasks().find((x) => x.id === 'monitoring.place.errshare') as Extract<PlacementTask, { kind: 'task' }>;
    const m = await createSimMachine(t.setup);
    await m.exec(`promtool query instant http://localhost:9090 'sum by (route) (rate(http_requests_total{job="api"}[5m]))'`);
    expect(evaluateCheck(t.task.check, await m.facts()).pass).toBe(false);
    await m.exec(`promtool query instant http://localhost:9090 'sum by (route) (rate(http_requests_total{job="api",code=~"5.."}[5m])) / sum by (route) (rate(http_requests_total{job="api"}[5m]))'`);
    expect(evaluateCheck(t.task.check, await m.facts()).pass).toBe(true);
    await m.exec(`promtool query instant http://localhost:9090 'sum by (job, route) (rate(http_requests_total{job="api",code=~"5.."}[5m])) / sum by (job, route) (rate(http_requests_total{job="api"}[5m]))'`);
    expect(evaluateCheck(t.task.check, await m.facts()).pass).toBe(true);
    m.dispose?.();
  });
});

describe('a target that answers with HTML', () => {
  it('the scrape lesson names the parse error and the quiz explains why it is not a stopped service', () => {
    const body = (section('monitoring.series', 'theory') as TextSection).body;
    expect(body.ru).toContain('expected a valid start token, got "<"');
    expect(body.en).toContain('expected a valid start token, got "<"');
    const q = registry.quiz.get('obs.q.bad-format') as Extract<QuizItem, { kind: 'mcq' }>;
    expect(q.options.find((o) => o.correct)?.id).toBe('html');
    expect(q.options.find((o) => o.id === 'down')?.why?.ru).toMatch(/connection refused/);
  });
});

describe('the observability layer of the cluster constructor', () => {
  it('sits in the Kubernetes lesson with the alert scenario available', () => {
    const w = section('monitoring.k8s', 'silent') as WidgetSection;
    expect(w.widget).toBe('k8s.constructor');
    const layers = (w.props as { layers: typeof ALL_LAYERS }).layers;
    expect(layers).toContain('obs');
    const alert = SCENARIOS.find((s) => s.id === 'alert')!;
    expect(scenarioLayers(alert).every((l) => layers.includes(l))).toBe(true);
    const full: CanvasState = { placed: COMPONENTS.filter((c) => c.layer === 'client' || layers.includes(c.layer as never)).map((c) => c.id), wires: WIRES.map((x) => [x.a, x.b].sort().join('|')), off: [], cni: 'calico' };
    expect(componentsFrom(full, layers).missing).not.toContain('prometheus');
    const howto = (section('monitoring.k8s', 'silent-howto') as TextSection).body.ru;
    for (const label of ['Почему не пришёл алерт', 'Убрать с холста', 'Собрать всё правильно']) expect(howto).toContain(label);
  });
  it('the Watchdog question disarms "no alert means all is well"', () => {
    const q = registry.quiz.get('obs.q.watchdog') as Extract<QuizItem, { kind: 'mcq' }>;
    expect(q.options.find((o) => o.correct)?.id).toBe('source');
    expect(q.options.find((o) => o.id === 'fine')?.why).toBeTruthy();
    expect(lesson('monitoring.k8s').sections.some((s) => s.kind === 'quiz' && s.items.includes('obs.q.watchdog'))).toBe(true);
  });
});
