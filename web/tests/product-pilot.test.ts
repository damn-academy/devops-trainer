// The hidden "Продукт" pilot: 30 principles in eight modules become 11
// lessons, every lesson carries the honest note and real sources in both
// languages, every thinking task is adapted into the quiz bank, and the two
// widget models respond to their parameters the way the lessons describe.
import { describe, expect, it } from 'vitest';
import { PRODUCT_CONCEPTS, PRODUCT_LESSONS, PRODUCT_QUIZ } from '../src/blocks/product/content';
import { OPENCORE_DEFAULTS, opencoreProject, opencoreVerdict } from '../src/blocks/product/opencore';
import { PRODUCT_PROGRAM } from '../src/blocks/product/principles';
import { VALUEMETRIC_DEFAULTS, VALUE_METRICS, valuemetricProject } from '../src/blocks/product/valuemetric';

describe('product pilot (hidden)', () => {
  it('carries the full program: 30 principles across the module data, bilingual', () => {
    expect(PRODUCT_PROGRAM.length).toBeGreaterThanOrEqual(8);
    const principles = PRODUCT_PROGRAM.flatMap((m) => m.principles);
    expect(principles).toHaveLength(30);
    const numbers = principles.map((p) => p.n).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    for (const p of principles) {
      for (const field of [p.title, p.task] as const) {
        expect(field[0].length).toBeGreaterThan(0);
        expect(field[1].length).toBeGreaterThan(0);
        expect(field[1]).toMatch(/[a-z]/i);
      }
      // Company names keep their original spelling in Russian titles.
      expect(p.task[0]).toMatch(/[а-яё]/i);
      expect(p.body.length).toBeGreaterThan(0);
      expect(p.bodyEn).toHaveLength(p.body.length);
      for (const para of p.body) expect(para).toMatch(/[а-яё]/i);
      for (const para of p.bodyEn) expect(para).toMatch(/[a-z]/i);
    }
  });

  it('builds 11 lessons with the honest note, sources and quizzes in each', () => {
    expect(PRODUCT_LESSONS).toHaveLength(11);
    const bank = new Set(PRODUCT_QUIZ.map((q) => q.id));
    for (const l of PRODUCT_LESSONS) {
      expect(l.sections.some((s) => s.kind === 'callout')).toBe(true);
      expect(l.sources.en.length).toBeGreaterThan(0);
      expect(l.sources.ru.length).toBeGreaterThan(0);
      for (const s of [...l.sources.en, ...l.sources.ru]) expect(s.url).toMatch(/^https:\/\//);
      const quiz = l.sections.find((s) => s.kind === 'quiz');
      expect(quiz).toBeTruthy();
      if (quiz && quiz.kind === 'quiz') for (const it of quiz.items) expect(bank.has(it as string)).toBe(true);
    }
  });

  it('introduces every product concept and keeps quiz distractors explained', () => {
    const introduced = new Set(PRODUCT_LESSONS.flatMap((l) => l.introduces));
    for (const c of PRODUCT_CONCEPTS) {
      expect(introduced.has(c.id)).toBe(true);
      expect(c.term.ru.length).toBeGreaterThan(0);
      expect(c.term.en.length).toBeGreaterThan(0);
    }
    for (const q of PRODUCT_QUIZ) {
      if (q.kind === 'mcq' || q.kind === 'multi') for (const o of q.options) if (!o.correct) expect(o.why).toBeTruthy();
    }
  });

  it('references only real lessons from quiz items', () => {
    const lessons = new Set(PRODUCT_LESSONS.map((l) => l.id));
    for (const q of PRODUCT_QUIZ) if (q.refs?.lesson) expect(lessons.has(q.refs.lesson)).toBe(true);
  });

  it('projects an open-core boundary that responds the way the lesson describes', () => {
    const base = opencoreProject(OPENCORE_DEFAULTS);
    expect(base.rows).toHaveLength(12);
    for (let i = 1; i < base.rows.length; i++) {
      expect(base.rows[i]!.companies).toBeGreaterThan(base.rows[i - 1]!.companies);
    }
    expect(base.totals.trust).toBeGreaterThanOrEqual(80); // the default boundary is not greedy
    const greedy = opencoreProject({ ...OPENCORE_DEFAULTS, boundary: 0.8 });
    expect(greedy.totals.trust).toBeLessThan(base.totals.trust); // a greedy boundary burns trust
    const pricey = opencoreProject({ ...OPENCORE_DEFAULTS, price: 12 });
    expect(pricey.totals.revenue).toBeGreaterThan(base.totals.revenue); // revenue follows the price
    const verdict = opencoreVerdict(greedy);
    expect(verdict.ru.length).toBeGreaterThan(0);
    expect(verdict.en.length).toBeGreaterThan(0);
  });

  it('compares four value metrics and scales revenue with the customer', () => {
    const r = valuemetricProject(VALUEMETRIC_DEFAULTS);
    expect(VALUE_METRICS).toHaveLength(4);
    expect(r.rows).toHaveLength(4);
    const node = r.rows.find((x) => x.id === 'node')!;
    expect(node.mrrYear).toBe(node.mrrNow * VALUEMETRIC_DEFAULTS.growth); // nodes scale linearly with growth
    const gb = r.rows.find((x) => x.id === 'gb')!;
    expect(gb.predictability).toBeLessThan(node.predictability); // usage bills are less predictable
    const bigger = valuemetricProject({ ...VALUEMETRIC_DEFAULTS, customers: 80 });
    expect(bigger.chosen.mrrNow).toBe(r.chosen.mrrNow * 2); // revenue follows the customer count
    expect(r.chosen.spec.id).toBe(VALUEMETRIC_DEFAULTS.metric);
  });
});
