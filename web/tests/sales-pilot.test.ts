// The public sales course: the funnel projection is monotonic and bounded, and
// the buying-center explainer builds the three waterfall steps with cards on
// every role.
import { describe, expect, it } from 'vitest';
import { buyingModel } from '../src/blocks/sales/buying';
import { SALES_CONCEPTS, SALES_LESSONS, SALES_QUIZ } from '../src/blocks/sales/content';
import { funnelProject } from '../src/blocks/sales/funnel';
import { SALES_SCHOOL } from '../src/blocks/sales/school';

describe('sales course (public)', () => {
  it('carries the full school: 46 principles in six modules', () => {
    expect(SALES_SCHOOL).toHaveLength(6);
    expect(SALES_SCHOOL.flatMap((m) => m.items)).toHaveLength(46);
    for (const m of SALES_SCHOOL) for (const it of m.items) {
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.body.length).toBeGreaterThan(0);
      expect(it.today.length).toBeGreaterThan(0);
    }
  });

  it('builds one lesson per module with the honest note in each', () => {
    expect(SALES_LESSONS).toHaveLength(6);
    for (const l of SALES_LESSONS) {
      expect(l.sections.some((s) => s.kind === 'callout')).toBe(true);
      expect(l.sources.en.length).toBeGreaterThan(0);
      expect(l.sources.ru.length).toBeGreaterThan(0);
    }
  });

  it('introduces every sales concept and keeps quiz distractors explained', () => {
    const introduced = new Set(SALES_LESSONS.flatMap((l) => l.introduces));
    for (const c of SALES_CONCEPTS) expect(introduced.has(c.id)).toBe(true);
    for (const q of SALES_QUIZ) if (q.kind === 'mcq') for (const o of q.options) expect(o.why).toBeTruthy();
  });

  it('projects a monotonic funnel that responds to parameters', () => {
    const base = funnelProject({ accounts: 30, touches: 2, respond: 0.15, meeting: 0.3, poc: 0.4, close: 0.35, weeks: 12 });
    for (let i = 1; i < base.rows.length; i++) {
      expect(base.rows[i]!.meetings).toBeGreaterThanOrEqual(base.rows[i - 1]!.meetings);
    }
    expect(base.totals.meetings).toBeGreaterThan(0);
    const double = funnelProject({ accounts: 30, touches: 4, respond: 0.15, meeting: 0.3, poc: 0.4, close: 0.35, weeks: 12 });
    expect(double.totals.meetings).toBeGreaterThan(base.totals.meetings);
    expect(funnelProject({ accounts: 30, touches: 2, respond: 0.15, meeting: 0.3, poc: 0.4, close: 0.35, weeks: 12 }).totals.touches).toBe(30 * 2 * 12);
  });

  it('walks the buying center in three waterfall steps', () => {
    const steps = buyingModel.run({}, new Set());
    expect(steps).toHaveLength(3);
    expect(steps[0]!.focus).toContain('champion');
    expect(steps[1]!.focus).toContain('econ');
    expect(steps[2]!.focus).toContain('proc');
    const roles = buyingModel.diagram.nodes.map((n) => n.id);
    for (const role of ['champion', 'validator', 'architect', 'econ', 'sponsor', 'ciso', 'proc']) expect(roles).toContain(role);
    for (const n of buyingModel.diagram.nodes) {
      expect(n.card.what.ru.length).toBeGreaterThan(0);
      expect(n.card.who.ru.length).toBeGreaterThan(0);
    }
  });
});
