// Second persona round of the career and final blocks: order items shown as
// a match until the engine enables "Check" for order, the review lesson "the
// whole cluster map" with one fault per constructor layer, and the lessons on
// the first job and on how on-call works at a real employer.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { gradeMatch } from '../src/engine/quiz/grade';
import { lintPlacement } from '../src/engine/quiz/placement';
import type { MatchItem, OrderItem } from '../src/core/types';
import { orderAsMatch } from '../src/blocks/career/order-fallback';
import { CLUSTER_FAULTS } from '../src/blocks/career/data/cluster-faults';
import { brokenState, fullState } from '../src/blocks/career/widgets/cluster-repair';
import { ALL_LAYERS, COMPONENTS, runScenario } from '../src/engine/kube-lite/ui/constructor-model';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import kubeModule from '../src/engine/kube-lite/module';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS]) reg.commands.add(c);
for (const c of kubeModule.commands ?? []) reg.commands.add(c);
reg.setup.push(...(kubeModule.setup ?? []));

describe('order items until the engine fix', () => {
  it('an order item becomes a match of each step to its place, graded right only in the original order', () => {
    const order: OrderItem = { id: 'x', kind: 'order', prompt: { ru: 'Расставьте.', en: 'Order.' }, steps: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }] };
    const m = orderAsMatch(order) as MatchItem;
    expect(m.kind).toBe('match');
    expect(m.prompt.ru).toMatch(/выберите её место/);
    expect(m.pairs.map((p) => (p.right as { ru: string }).ru)).toEqual(['На 1-м месте', 'На 2-м месте', 'На 3-м месте']);
    expect(gradeMatch(m, { a: 'a', b: 'b', c: 'c' }).correct).toBe(true);
    expect(gradeMatch(m, { a: 'b', b: 'a', c: 'c' }).correct).toBe(false);
  });

  it('no career placement, exam or quiz item is left as an order item', () => {
    const block = registry.blocks.get('career')!;
    for (const t of block.placement) if (t.kind === 'quiz') expect(t.item.kind, t.id).not.toBe('order');
    expect(lintPlacement(block.placement, { career: true })).toEqual([]);
    for (const id of ['career.q.order-parts', 'career.q.method-order', 'career.q.priority']) expect(registry.quiz.get(id)?.kind, id).toBe('match');
    const oncall = registry.exams.get('final.exam.oncall')!;
    for (const task of oncall.tasks) if (task.kind === 'quiz') expect(task.item.kind).not.toBe('order');
  });
});

describe('the whole cluster map', () => {
  it('is the first lesson of the final block, and its quiz items and widgets exist', () => {
    expect(registry.blocks.get('final')!.lessons[0]).toBe('final.cluster-map');
    const lesson = registry.lessons.get('final.cluster-map')!;
    for (const s of lesson.sections) {
      if (s.kind === 'quiz') for (const id of s.items as string[]) expect(registry.quiz.get(id), id).toBeTruthy();
      if (s.kind === 'widget') expect(registry.widgets.get(s.widget), s.widget).toBeTruthy();
    }
  });

  it('has one fault per constructor layer, each with one right answer that is the removed component', () => {
    expect([...CLUSTER_FAULTS.map((f) => f.layer)].sort()).toEqual([...ALL_LAYERS].sort());
    for (const f of CLUSTER_FAULTS) {
      const right = f.options.filter((o) => !o.why);
      expect(right.map((o) => o.id), f.id).toEqual([f.broken]);
      expect(COMPONENTS.some((c) => c.id === f.broken)).toBe(true);
      for (const o of f.options) if (!o.label) expect(COMPONENTS.some((c) => c.id === o.id), `${f.id}/${o.id}`).toBe(true);
      for (const b of [f.ticket, f.cause, f.real]) expect(b.ru).toMatch(/^[А-ЯЁA-Za-z«`].{40,}[.»?]$/s);
    }
  });

  /** What each broken cluster prints, so the learner can find the cause in the output. */
  const SYMPTOM: Record<string, RegExp> = {
    cp: /deployment.apps\/web\s+0\/3(?![\s\S]*replicaset)/,
    node: /Pending[\s\S]*worker-1\s+NotReady/,
    net: /Could not resolve host: web[\s\S]*Hello from web-/,
    ingress: /<pending>[\s\S]*curl: \(7\)/,
    certs: /doesn't have a resource type "certificate"[\s\S]*self-signed certificate/,
    storage: /Pending[\s\S]*no storage class is set/,
    metrics: /Metrics API not available[\s\S]*<unknown>/,
    gitops: /doesn't have a resource type "kustomization"/,
    obs: /CrashLoopBackOff[\s\S]*Watchdog(?![\s\S]*KubePodCrashLooping)/,
  };

  it('every broken cluster shows its symptom, and the repaired one runs the scenario cleanly', async () => {
    for (const f of CLUSTER_FAULTS) {
      const broken = (await runScenario(brokenState(f.broken), f.scenario, ALL_LAYERS, { registry: reg }))!;
      expect(broken.text, f.id).toMatch(SYMPTOM[f.id]);
      expect(broken.built.missing, f.id).toContain(f.broken);
      const fixed = (await runScenario(fullState(), f.scenario, ALL_LAYERS, { registry: reg }))!;
      expect(fixed.explain, f.id).toEqual([f.scenario.ok]);
    }
  }, 90000);
});

describe('lessons on the first job and on-call at work', () => {
  it('follow the job search, and their quiz items and concepts exist', () => {
    const lessons = registry.blocks.get('career')!.lessons;
    expect(lessons.slice(lessons.indexOf('career.search'))).toEqual(['career.search', 'career.first-job', 'career.oncall-life']);
    for (const id of ['career.first-job', 'career.oncall-life']) {
      const l = registry.lessons.get(id)!;
      for (const c of l.introduces) expect(registry.concepts.get(c)?.introducedIn, c).toBe(id);
      for (const s of l.sections) if (s.kind === 'quiz') for (const q of s.items as string[]) expect(registry.quiz.get(q), q).toBeTruthy();
    }
  });

  it('every wrong option explains the misconception it stands for', () => {
    for (const id of ['career.q.ask-when', 'career.q.impostor', 'career.q.burnout', 'career.q.rotation', 'career.q.escalate', 'final.q.map-pending', 'final.q.map-name']) {
      const q = registry.quiz.get(id)!;
      if (q.kind !== 'mcq') throw new Error(id);
      expect(q.options.filter((o) => o.correct).length, id).toBe(1);
      for (const o of q.options) if (!o.correct) expect(o.why?.ru.length ?? 0, `${id}/${o.id}`).toBeGreaterThan(60);
    }
  });

  it('the interview lesson answers “is it too late at 40” for beginners, and the pitch has the awkward question', () => {
    const age = registry.lessons.get('career.interviews')!.sections.find((s) => s.id === 'age')!;
    expect(age.levels).toEqual(['beginner', 'intermediate']);
    const awkward = registry.lessons.get('career.pitch')!.sections.find((s) => s.id === 'awkward')!;
    expect(awkward.kind === 'text' && awkward.body.ru).toMatch(/в сорок лет/);
  });
});

describe('drill outputs follow the typed curl time limit', () => {
  it('replaces the connect timeout with the one curl was given', async () => {
    const { withCurlTimeout } = await import('../src/blocks/career/drill-engine');
    const out = 'curl: (28) Failed to connect to 10.0.0.12 port 8000 after 30001 ms: Timeout was reached';
    expect(withCurlTimeout(out, 'curl -m 5 -sv http://10.0.0.12:8000/healthz')).toBe('curl: (28) Connection timed out after 5001 milliseconds');
    expect(withCurlTimeout(out, 'curl --connect-timeout 3 http://10.0.0.12:8000/health')).toBe('curl: (28) Failed to connect to 10.0.0.12 port 8000 after 3001 ms: Timeout was reached');
    expect(withCurlTimeout(out, 'curl -m 60 http://10.0.0.12:8000/health')).toBe(out);
    expect(withCurlTimeout(out, 'nc -w 5 10.0.0.12 8000')).toBe(out);
  });
});
