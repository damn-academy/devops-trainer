// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { coursePage } from '../src/app/course-page';
import { SCITHINK_LESSONS } from '../src/blocks/scithink/content';
import { SCITHINK_MODULES } from '../src/blocks/scithink/structure';
import { registry } from '../src/core/registry';
import { catalogGroups, PRODUCTS, visibleProducts } from '../src/core/products';
import { setLang } from '../src/core/i18n';

afterEach(() => setLang('ru'));

it('assigns all twelve pilot lessons exactly once in source order', () => {
  const ids = SCITHINK_MODULES.flatMap(m => m.lessons);
  expect(SCITHINK_MODULES).toHaveLength(5);
  expect(ids).toEqual(SCITHINK_LESSONS.map(l => l.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(registry.blocks.get('scithink')?.modules).toEqual(SCITHINK_MODULES);
});

it('places the public course last on the business shelf', () => {
  const product = PRODUCTS.find(p => p.id === 'scithink');
  expect(product).toMatchObject({ kind: 'course', shelf: 'business' });
  expect(product?.subtitle?.ru).toContain('Для всех');
  expect(catalogGroups(PRODUCTS).at(-1)?.products.at(-1)?.id).toBe('scithink');
  expect(visibleProducts('course')).toContain(product);
});

it.each(['ru', 'en'] as const)('renders modules and original summaries in %s', lang => {
  setLang(lang);
  const page = coursePage('scithink');
  expect([...page.el.querySelectorAll('.course-module h2')].map(el => el.textContent))
    .toEqual(SCITHINK_MODULES.map(m => m.title[lang]));
  expect(page.el.querySelectorAll('.course-card')).toHaveLength(12);
  for (const lesson of SCITHINK_LESSONS) {
    const card = page.el.querySelector('a[href="#/lesson/' + lesson.id + '"]');
    expect(card?.textContent).toContain(lesson.summary![lang]);
  }
});

it('resolves concept links and interactive sections in every lesson', () => {
  for (const lesson of SCITHINK_LESSONS) {
    for (const match of JSON.stringify(lesson).matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      expect(registry.concepts.has(match[1]!), lesson.id + ': ' + match[1]).toBe(true);
    }
    for (const section of lesson.sections) {
      if (section.kind === 'widget') expect(registry.widgets.has(section.widget)).toBe(true);
      if (section.kind === 'explainer') expect(registry.explainers.has(section.explainer)).toBe(true);
    }
  }
});
