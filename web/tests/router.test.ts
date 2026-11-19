import { describe, expect, it } from 'vitest';
import { href, parseRoute } from '../src/core/router';

describe('router', () => {
  it('parses every route and round-trips', () => {
    const cases = ['#/', '#/block/linux', '#/block/linux/placement', '#/lesson/linux.process', '#/lesson/linux.process/lab', '#/explainer/demo.pipe', '#/exam/linux.exam', '#/settings', '#/review'];
    for (const c of cases) expect(href(parseRoute(c))).toBe(c);
    expect(parseRoute('').name).toBe('home');
    expect(parseRoute('#/nope/x').name).toBe('notfound');
  });
});
