import { describe, expect, it } from 'vitest';
import { pipeModel, pipeNumbers } from '../src/blocks/demo/pipe';
import type { Step } from '../src/core/types';
import { borderPoint, changedElements, fold, keepIndex, metricDelta, pointAt } from '../src/engine/explainer/geometry';

const defaults = Object.fromEntries(pipeModel.params.map((p) => [p.id, p.default])) as { names: number; buffer: string; reader: string; match: boolean };

describe('process model: the demo pipeline', () => {
  it('is deterministic and fast', () => {
    const t0 = performance.now();
    const a = pipeModel.run(defaults, new Set());
    const b = pipeModel.run(defaults, new Set());
    expect(performance.now() - t0).toBeLessThan(16);
    expect(a).toEqual(b);
  });
  it('a slow reader and more data than the buffer make the writer wait', () => {
    const steps = pipeModel.run(defaults, new Set());
    expect(steps.some((s) => s.id === 'full')).toBe(true);
    expect(steps.at(-1)?.metrics?.waits).toBe(pipeNumbers(defaults, false).waits);
    const fast = pipeModel.run({ ...defaults, reader: 'same' }, new Set());
    expect(fast.at(-1)?.metrics?.waits).toBe(0);
  });
  it('the reader leaving early sends SIGPIPE only when data is left to write', () => {
    const big = pipeModel.run(defaults, new Set(['reader-exits']));
    expect(big.at(-1)?.broken?.message).toContain('141');
    const small = pipeModel.run({ ...defaults, names: 100 }, new Set(['reader-exits']));
    expect(small.some((s) => s.broken)).toBe(false);
    expect(small.at(-1)?.metrics?.status).toBe(0);
  });
  it('without | the process stops at ls with the real error', () => {
    const steps = pipeModel.run(defaults, new Set(['no-pipe']));
    expect(steps.at(-1)?.broken?.at).toBe('ls');
    expect(steps.at(-1)?.broken?.message).toContain("cannot access 'grep'");
  });
  it('explains what changed and predictions resolve from the recomputed run', () => {
    const prev = pipeModel.run(defaults, new Set());
    const next = pipeModel.run({ ...defaults, match: false }, new Set());
    const d = pipeModel.explainDelta(prev, next, { kind: 'param', id: 'match', from: true, to: false }, defaults, { ...defaults, match: false });
    expect(d.en).toContain('code 1');
    const p = pipeModel.params.find((x) => x.id === 'match')!.predict!;
    expect(p.resolve(prev, next)).toBe('1');
    expect(metricDelta(prev, next)).toEqual({ status: 1 });
    expect(changedElements(prev, next)).toContain('tty');
  });
});

describe('explainer geometry', () => {
  const n = { id: 'a', label: 'a', family: 'process' as const, x: 0, y: 0, w: 100, h: 50, card: { what: { ru: '', en: '' }, who: { ru: '', en: '' } } };
  it('edges leave boxes at their border', () => {
    expect(borderPoint(n, [300, 25])).toEqual([100, 25]);
    expect(borderPoint(n, [50, -100])).toEqual([50, 0]);
  });
  it('points along a polyline', () => {
    expect(pointAt([[0, 0], [10, 0], [10, 10]], 0.5).p).toEqual([10, 0]);
    expect(pointAt([[0, 0], [10, 0]], 0.25).p).toEqual([2.5, 0]);
  });
  it('folds states over steps and keeps the step across recomputes', () => {
    const steps: Step[] = [
      { id: 'a', label: 'a', caption: { ru: '', en: '' }, focus: [], states: { x: 'on' as const } },
      { id: 'b', label: 'b', caption: { ru: '', en: '' }, focus: [], states: { y: 'err' as const }, values: { x: '1' } },
    ];
    expect(fold(steps, 1)).toEqual({ states: { x: 'on', y: 'err' }, values: { x: '1' }, fill: {} });
    expect(keepIndex(steps, [steps[1]], 1)).toBe(0);
  });
});
