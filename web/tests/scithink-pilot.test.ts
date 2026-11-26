// The public scientific-thinking course: twelve lessons, the honest note and
// the self-check note stated once in the first lesson, a quiz bank with explained distractors,
// the correlation explainer whose spurious link collapses under the
// within-groups break, and the calibration trainer over ten balanced claims.
import { describe, expect, it } from 'vitest';
import { CLAIMS, calibrationStats } from '../src/blocks/scithink/calibration';
import { correlationModel } from '../src/blocks/scithink/correlation';
import { HONEST_NOTE, SCITHINK_CONCEPTS, SCITHINK_LESSONS, SCITHINK_QUIZ, SELFCHECK_NOTE } from '../src/blocks/scithink/content';
import scithinkModule from '../src/blocks/scithink/index';
import { PRODUCTS, visibleProducts } from '../src/core/products';

describe('scientific thinking course (public)', () => {
  it('carries twelve lessons with sources and minutes, and the two honest notes once in the first lesson', () => {
    expect(SCITHINK_LESSONS).toHaveLength(12);
    for (const [i, l] of SCITHINK_LESSONS.entries()) {
      const callouts = l.sections.filter((s) => s.kind === 'callout');
      expect(callouts.some((s) => s.kind === 'callout' && s.body === HONEST_NOTE), l.id).toBe(i === 0);
      expect(callouts.some((s) => s.kind === 'callout' && s.body === SELFCHECK_NOTE), l.id).toBe(i === 0);
      expect(l.sources.en.length, l.id).toBeGreaterThan(0);
      expect(l.sources.ru.length, l.id).toBeGreaterThan(0);
      for (const s of [...l.sources.en, ...l.sources.ru]) expect(s.url, l.id).toMatch(/^https:\/\//);
      expect(l.minutes ?? 0, l.id).toBeGreaterThan(0);
    }
  });

  it('attaches the explainer, the trainer and quizzes to the right lessons', () => {
    const byId = new Map(SCITHINK_LESSONS.map((l) => [l.id, l]));
    expect(byId.get('scithink.correlation')!.sections.some((s) => s.kind === 'explainer' && s.explainer === 'scithink.correlation')).toBe(true);
    expect(byId.get('scithink.calibration')!.sections.some((s) => s.kind === 'widget' && s.widget === 'scithink.calibration')).toBe(true);
    for (const id of ['scithink.base-rate', 'scithink.anecdote', 'scithink.studies', 'scithink.fakes', 'scithink.numbers', 'scithink.final']) {
      expect(byId.get(id)!.sections.some((s) => s.kind === 'quiz'), id).toBe(true);
    }
  });

  it('publishes the course while keeping its block off the profession map with all lessons', () => {
    const product = PRODUCTS.find((p) => p.id === 'scithink');
    expect(product?.kind).toBe('course');
    expect(visibleProducts('course')).toContain(product);
    expect(product?.hidden).not.toBe(true);
    const block = scithinkModule.blocks![0]!;
    expect(block.id).toBe('scithink');
    expect(block.hidden).toBe(true);
    expect(block.lessons).toEqual(SCITHINK_LESSONS.map((l) => l.id));
  });

  it('introduces every concept and keeps quiz distractors explained', () => {
    const introduced = new Set(SCITHINK_LESSONS.flatMap((l) => l.introduces));
    for (const c of SCITHINK_CONCEPTS) {
      expect(introduced.has(c.id)).toBe(true);
      expect(SCITHINK_LESSONS.find((l) => l.id === c.introducedIn)?.introduces, c.id).toContain(c.id);
    }
    for (const q of SCITHINK_QUIZ) {
      if (q.kind === 'mcq') {
        expect(q.options.filter((o) => o.correct)).toHaveLength(1);
        for (const o of q.options) if (!o.correct) expect(o.why, `${q.id}.${o.id}`).toBeTruthy();
      }
    }
  });

  it('collapses the spurious link under the within-groups break and keeps a real one', () => {
    const base = correlationModel.run({ strength: 60, confounder: 70 }, new Set());
    expect(base.map((s) => s.id)).toEqual(['data', 'data-voice', 'factor', 'factor-voice', 'verdict']);
    expect(base.at(-1)!.metrics?.r).toBe(60);
    expect(base.at(-1)!.metrics?.left).toBe(18);
    expect(base.some((s) => s.broken)).toBe(false);

    const broken = correlationModel.run({ strength: 60, confounder: 70 }, new Set(['within']));
    expect(broken.at(-1)!.metrics?.r).toBe(18);
    expect(broken.some((s) => s.broken)).toBe(false);

    const real = correlationModel.run({ strength: 80, confounder: 0 }, new Set(['within']));
    expect(real.at(-1)!.metrics?.r).toBe(80);
    expect(real.some((s) => s.broken)).toBe(false);
  });

  it('predictions resolve to valid options and explainDelta stays bilingual', () => {
    const m = correlationModel;
    const defaults = { strength: 60, confounder: 70 };
    const base = m.run(defaults, new Set());
    for (const [params, change] of [
      [{ ...defaults, strength: 90 }, { kind: 'param', id: 'strength', from: 60, to: 90 }],
      [{ ...defaults, confounder: 0 }, { kind: 'param', id: 'confounder', from: 70, to: 0 }],
    ] as const) {
      const next = m.run(params as never, new Set());
      const spec = m.params.find((p) => p.id === change.id)!;
      const resolved = spec.predict!.resolve(base, next);
      expect(spec.predict!.options.map((o) => o.id)).toContain(resolved);
      const delta = m.explainDelta(base, next, change as never, defaults, params as never);
      expect(delta.ru.length).toBeGreaterThan(0);
      expect(delta.en.length).toBeGreaterThan(0);
    }
    const on = m.run(defaults, new Set(['within']));
    const resolvedBreak = m.breaks[0]!.predict.resolve(base, on);
    expect(resolvedBreak).toBe('partial');
    const delta = m.explainDelta(base, on, { kind: 'break', id: 'within', on: true }, defaults, defaults);
    expect(delta.ru).toContain('18');
    expect(delta.en.length).toBeGreaterThan(0);
  });

  it('trains calibration over ten balanced claims', () => {
    expect(CLAIMS).toHaveLength(10);
    expect(CLAIMS.filter((c) => c.truth)).toHaveLength(5);
    for (const c of CLAIMS) {
      expect(c.claim.ru.length).toBeGreaterThan(0);
      expect(c.claim.en.length).toBeGreaterThan(0);
      expect(c.evidence.ru.length).toBeGreaterThan(0);
      expect(c.evidence.en.length).toBeGreaterThan(0);
    }
    const allIn = Object.fromEntries(CLAIMS.map((c) => [c.id, 100]));
    const stats = calibrationStats(CLAIMS, allIn);
    expect(stats.answered).toBe(10);
    expect(stats.mean).toBe(100);
    expect(stats.shareTrue).toBe(50);
    expect(stats.bins[4]!.n).toBe(10);
    expect(stats.bins[4]!.actual).toBe(50);
    const none = calibrationStats(CLAIMS, {});
    expect(none.answered).toBe(0);
    expect(none.bins.every((b) => b.n === 0)).toBe(true);
  });
});
