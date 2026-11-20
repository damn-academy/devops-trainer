import { describe, expect, it } from 'vitest';
import { effectiveStep, hintPolicy, scheduleStep, shouldRecord, startStep } from '../src/engine/docs/ladder';

describe('documentation ladder (01 §11.3)', () => {
  it('starts by level', () => {
    expect([startStep('beginner'), startStep('intermediate'), startStep('experienced')]).toEqual([1, 2, 3]);
  });
  it('rises gradually by lesson position', () => {
    expect([0, 4, 8].map((i) => scheduleStep('beginner', i, 12))).toEqual([1, 2, 3]);
    expect(scheduleStep('beginner', 11, 12)).toBe(3);
    expect([0, 4, 8].map((i) => scheduleStep('intermediate', i, 12))).toEqual([2, 3, 4]);
    expect([0, 4, 8].map((i) => scheduleStep('experienced', i, 12))).toEqual([3, 4, 4]);
  });
  it('offers beginner support even after a more advanced source', () => {
    const stored = { step: 4 as const, block: 'linux', streak: 0 };
    expect(effectiveStep({ level: 'beginner', block: 'linux', index: 0, count: 10, stored })).toBe(1);
    expect(effectiveStep({ level: 'beginner', block: 'containers', index: 0, count: 10, stored })).toBe(1);
  });
  it('does not remove lesson support after a streak', () => {
    const stored = { step: 2 as const, block: 'linux', streak: 3 };
    expect(effectiveStep({ level: 'beginner', block: 'linux', index: 0, count: 10, stored })).toBe(1);
  });
  it('honours task overrides and exams', () => {
    expect(effectiveStep({ level: 'beginner', block: 'x', index: 0, count: 10, override: 4 })).toBe(1);
    expect(effectiveStep({ level: 'experienced', block: 'x', index: 0, count: 10, exam: true })).toBe(5);
  });
  it('shapes hints: fragment at DL2, link only at DL3, nothing at DL4–5', () => {
    expect(hintPolicy(2).h3).toBe('fragment');
    expect(hintPolicy(3)).toMatchObject({ h3: 'link', chips: 'name' });
    expect(hintPolicy(4)).toMatchObject({ allowed: [], chips: 'none', mentor: 'docs' });
    expect(hintPolicy(5).mentor).toBe('off');
  });
  it('records only rises', () => {
    expect(shouldRecord(2, { step: 3, block: 'a' }, 'a')).toBe(false);
    expect(shouldRecord(3, { step: 2, block: 'a' }, 'a')).toBe(true);
    expect(shouldRecord(2, { step: 2, block: 'a' }, 'b')).toBe(true);
  });
});
