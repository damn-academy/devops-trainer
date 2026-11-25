import { expect, it } from 'vitest';
import { funnelModel, funnelNumbers, type FunnelParams } from '../src/blocks/events/funnel';
import { lintModel } from '../src/core/lint';
import { fromModel } from '../src/engine/explainer/render';
import type { LintIssue } from '../src/core/lint';

const defaults = Object.fromEntries(funnelModel.params.map(p => [p.id, p.default])) as FunnelParams;
it('passes explainer lint without course registration', () => {
  const issues: LintIssue[] = [];
  lintModel(fromModel(funnelModel).model!, 'events.funnel', issues);
  expect(issues).toEqual([]);
});
it('multiplies the entire funnel without rounding intermediate counts', () => {
  const n = funnelNumbers(defaults);
  expect(n).toMatchObject({ scans: 300, target: 45, next: 27, followup: 21.6 });
  expect(n.meetings).toBeCloseTo(6.48);
  expect(n.opps).toBeCloseTo(1.944);
  expect(n.wins).toBeCloseTo(0.486);
  expect(n.break_even).toBeCloseTo(2.4);
  for (const p of funnelModel.params) {
    for (const v of [p.min!, p.max!]) {
      const changed = { ...defaults, [p.id]: v };
      const result = funnelNumbers(changed);
      expect(result.wins).toBeCloseTo(changed.scans * changed.target_share * changed.next_share * changed.followup_share * changed.meeting_share * changed.opp_share * changed.win_rate / 100 ** 6);
      expect(result.break_even).toBeCloseTo(changed.cost / (changed.profit_per_win * changed.win_rate / 100));
      const steps = funnelModel.run(changed, new Set());
      for (const s of steps) {
        for (const node of funnelModel.diagram.nodes) expect(Number(s.values![node.id])).toBeCloseTo(result[node.id as keyof typeof result], 4);
        expect(s.metrics!.opps).toBe(result.opps);
        expect(s.metrics!.break_even).toBe(result.break_even);
      }
    }
  }
});
it('late follow-up reduces meetings and downstream results threefold, preserving upstream counts and break-even', () => {
  const normal = funnelNumbers(defaults);
  const late = funnelNumbers(defaults, true);
  for (const k of ['scans', 'target', 'next', 'followup', 'break_even'] as const) expect(late[k]).toBe(normal[k]);
  for (const k of ['meetings', 'opps', 'wins'] as const) expect(late[k]).toBeCloseTo(normal[k] / 3);
  const a = funnelModel.run(defaults, new Set());
  const b = funnelModel.run(defaults, new Set(['late_followup']));
  expect(b).toHaveLength(7);
  expect(b.find(s => s.broken)?.id).toBe('followup');
  expect(funnelModel.breaks[0].predict.resolve(a, b)).toBe('lower');
  expect(funnelModel.breaks[0].predict.resolve(a, a)).toBe('same');
  expect(funnelModel.run(defaults, new Set())).toEqual(a);
});
