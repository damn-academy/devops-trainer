import { describe, expect, it } from 'vitest';
import { clipLength, overlap, placeLabel, splitLabel } from '../src/engine/explainer/tidy';

describe('explainer label placement', () => {
  it('measures overlap and clipped segments', () => {
    expect(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(25);
    expect(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 5, h: 5 })).toBe(0);
    expect(clipLength([0, 5], [20, 5], { x: 5, y: 0, w: 10, h: 10 })).toBeCloseTo(10);
    expect(clipLength([0, 50], [20, 50], { x: 5, y: 0, w: 10, h: 10 })).toBe(0);
  });
  it('puts a label above a horizontal line when that is free', () => {
    const b = placeLabel([[0, 100], [200, 100]], 0.5, 40, 14, []);
    expect(b.y + b.h).toBeLessThanOrEqual(100);
    expect(b.x + b.w / 2).toBeCloseTo(100);
  });
  it('moves a label off a box that covers the preferred spot', () => {
    const box = { x: 60, y: 60, w: 80, h: 38 };
    const b = placeLabel([[0, 100], [200, 100]], 0.5, 40, 14, [box]);
    expect(overlap(b, box)).toBe(0);
  });
  it('splits a long label near the middle', () => {
    expect(splitLabel('Транзитный оператор')).toEqual(['Транзитный', 'оператор']);
    expect(splitLabel('kubelet')).toBeNull();
  });
});
