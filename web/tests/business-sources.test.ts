// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { PRODUCTS } from '../src/core/products';
import '../src/app/lesson';

const courses = new Set(PRODUCTS.filter(p => p.kind === 'course').map(p => p.id));

it('names every source of a business lesson distinctly', () => {
  let checked = 0;
  for (const lesson of registry.lessons.values()) {
    if (!courses.has(lesson.block) || !lesson.sources) continue;
    for (const lang of ['ru', 'en'] as const) {
      const titles = lesson.sources[lang].map(s => s.title);
      expect(titles.filter((v, i) => titles.indexOf(v) !== i), `${lesson.id} ${lang}`).toEqual([]);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(100);
});
