// The hidden marketing pilot: the school carries 46 principles in ten modules
// with a full English translation, the ten platform lessons each carry the
// honest note and bilingual sources, the regions projection is monotonic and
// rewards localisation, and the growth-loop explainer walks the machine.
import { describe, expect, it } from 'vitest';
import { loopModel } from '../src/blocks/marketing/loop';
import { MARKETING_CONCEPTS, MARKETING_LESSONS, MARKETING_QUIZ, MARKETING_SCHOOL_EN } from '../src/blocks/marketing/content';
import { regionsProject } from '../src/blocks/marketing/regions';
import { MARKETING_SCHOOL } from '../src/blocks/marketing/school';

const BASE = { budget: 20, content: 0.6, localized: 0.3, months: 12, us: 0.5, dach: 0.3, asia: 0.2 };

describe('marketing pilot (hidden)', () => {
  it('carries the full school: 46 principles in nine source modules', () => {
    expect(MARKETING_SCHOOL).toHaveLength(9);
    expect(MARKETING_SCHOOL.flatMap((m) => m.items)).toHaveLength(46);
    for (const m of MARKETING_SCHOOL) for (const it of m.items) {
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.body.length).toBeGreaterThan(0);
      expect(it.today.length).toBeGreaterThan(0);
    }
  });

  it('translates every item into English, module by module', () => {
    expect(MARKETING_SCHOOL_EN.map((m) => m.letter)).toEqual(MARKETING_SCHOOL.map((m) => m.letter));
    for (let i = 0; i < MARKETING_SCHOOL.length; i++) {
      const ru = MARKETING_SCHOOL[i]!.items;
      const en = MARKETING_SCHOOL_EN[i]!.items;
      expect(en).toHaveLength(ru.length);
      for (let j = 0; j < ru.length; j++) {
        expect(en[j]!.n).toBe(ru[j]!.n);
        expect(en[j]!.title.length).toBeGreaterThan(0);
        expect(en[j]!.body.length).toBeGreaterThan(0);
        expect(en[j]!.today.length).toBeGreaterThan(0);
      }
    }
  });

  it('builds one platform lesson per module with the honest note in each', () => {
    expect(MARKETING_LESSONS).toHaveLength(10);
    for (const l of MARKETING_LESSONS) {
      expect(l.sections.some((s) => s.kind === 'callout')).toBe(true);
      expect(l.sources.en.length).toBeGreaterThan(0);
      expect(l.sources.ru.length).toBeGreaterThan(0);
      expect(l.minutes ?? 0).toBeGreaterThan(0);
    }
  });

  it('introduces every marketing concept and keeps quiz distractors explained', () => {
    const introduced = new Set(MARKETING_LESSONS.flatMap((l) => l.introduces));
    for (const c of MARKETING_CONCEPTS) expect(introduced.has(c.id)).toBe(true);
    for (const q of MARKETING_QUIZ) {
      if (q.kind === 'mcq' || q.kind === 'multi') for (const o of q.options) expect(o.why).toBeTruthy();
    }
  });

  it('projects monotonic regional funnels that respond to parameters', () => {
    const base = regionsProject(BASE);
    expect(base.regions).toHaveLength(3);
    for (const r of base.regions) {
      for (let i = 1; i < r.rows.length; i++) {
        expect(r.rows[i]!.deals).toBeGreaterThanOrEqual(r.rows[i - 1]!.deals);
        expect(r.rows[i]!.leads).toBeGreaterThan(r.rows[i - 1]!.leads);
      }
    }
    const bigger = regionsProject({ ...BASE, budget: 60 });
    expect(bigger.totalDeals).toBeGreaterThan(base.totalDeals);
    // localisation is worth much more in Asia than in the US
    const us = regionsProject({ ...BASE, us: 1, dach: 0, asia: 0, localized: 0 });
    const usLoc = regionsProject({ ...BASE, us: 1, dach: 0, asia: 0, localized: 1 });
    const asia = regionsProject({ ...BASE, us: 0, dach: 0, asia: 1, localized: 0 });
    const asiaLoc = regionsProject({ ...BASE, us: 0, dach: 0, asia: 1, localized: 1 });
    const usGain = usLoc.regions[0]!.totals.deals / (us.regions[0]!.totals.deals || 1);
    const asiaGain = asiaLoc.regions[2]!.totals.deals / (asia.regions[2]!.totals.deals || 1);
    expect(asiaGain).toBeGreaterThan(usGain * 3);
    expect(asia.regions[2]!.totals.deals).toBeLessThan(1); // without adaptation Asia stays quiet
  });

  it('walks the growth loop in seven steps and closes the circle', () => {
    const steps = loopModel.run({}, new Set());
    expect(steps).toHaveLength(7);
    expect(steps[0]!.focus).toContain('insight');
    expect(steps[6]!.focus).toContain('i6');
    expect(steps[6]!.focus).toContain('insight');
    const ids = new Set(loopModel.diagram.nodes.map((n) => n.id));
    for (const want of ['insight', 'deep', 'pieces', 'channels', 'audience', 'questions']) expect(ids.has(want)).toBe(true);
    for (const n of loopModel.diagram.nodes) {
      expect(n.card.what.ru.length).toBeGreaterThan(0);
      expect(n.card.who.ru.length).toBeGreaterThan(0);
      expect(n.card.what.en.length).toBeGreaterThan(0);
      expect(n.card.who.en.length).toBeGreaterThan(0);
    }
    for (const e of loopModel.diagram.edges) {
      expect(typeof e.label === 'string' ? e.label.length : e.label.ru.length).toBeGreaterThan(0);
      expect(e.card.what.ru.length).toBeGreaterThan(0);
    }
  });
});
