// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it } from 'vitest';
import { SALES_LESSONS } from '../src/blocks/sales/content';
import { DREAM100_LESSONS } from '../src/blocks/sales/dream100';
import { SALES_MODULES, DREAM100_SUMMARIES } from '../src/blocks/sales/structure';
import { registry } from '../src/core/registry';
import { PRODUCTS, visibleProducts } from '../src/core/products';
import { MemoryBackend, store } from '../src/core/store';
import { setLang } from '../src/core/i18n';
import { coursePage } from '../src/app/course-page';
import { lessonPage } from '../src/app/lesson';

beforeAll(async () => { await store.init(new MemoryBackend()); });
afterEach(() => { setLang('ru'); document.body.replaceChildren(); });

it('appends Dream 100 as module seven with every sales lesson exactly once', () => {
  const ids = SALES_MODULES.flatMap(m => m.lessons);
  expect(SALES_MODULES).toHaveLength(7);
  expect(SALES_MODULES.slice(0, 6).flatMap(m => m.lessons)).toEqual(SALES_LESSONS.map(l => l.id));
  expect(SALES_MODULES[6]!.lessons).toEqual(DREAM100_LESSONS.map(l => l.id));
  expect(DREAM100_LESSONS).toHaveLength(6);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual(registry.blocks.get('sales')!.lessons);
  expect([...ids].sort()).toEqual([...registry.lessons.values()].filter(l => l.block === 'sales').map(l => l.id).sort());
  expect(registry.blocks.get('sales')!.hidden).toBe(true);
  expect(visibleProducts('course')).toContain(PRODUCTS.find(p => p.id === 'sales'));
  expect(PRODUCTS.find(p => p.id === 'sales')).toMatchObject({ shelf: 'business', title: { ru: 'Продажи', en: 'Sales' } });
  for (const l of SALES_LESSONS) {
    const registered = registry.lessons.get(l.id)!;
    expect(registered.summary).toEqual(l.summary);
    for (const s of l.sections) expect(registered.sections).toContainEqual(s);
  }
  expect(registry.lessons.get('sales.asymmetry')!.sections.some(s => s.kind === 'quiz')).toBe(true);
});

it('loads matching bilingual markers and props with resolving concepts', () => {
  expect(DREAM100_LESSONS.flatMap(l => l.sections.flatMap(s => s.kind === 'widget' ? [[s.widget, s.props]] : []))).toEqual([
    ['template', { file: 'dream100' }], ['signal-feed', { data: 'sales.signal-feed' }],
    ['rubric', { trainer: 'sales.forwardable' }], ['deptsim', { scenario: 'sales.dream100' }],
  ]);
  for (const l of DREAM100_LESSONS) {
    expect(registry.lessons.get(l.id)!.summary).toEqual(DREAM100_SUMMARIES[l.id]);
    for (const id of l.uses) expect(registry.concepts.has(id), `${l.id}: ${id}`).toBe(true);
    for (const s of l.sections) if (s.kind === 'widget') expect(registry.widgets.has(s.widget)).toBe(true);
  }
  expect(registry.errors).toEqual([]);
});

for (const lang of ['ru', 'en'] as const) {
  it(`renders the seven modules in ${lang}`, () => {
    setLang(lang);
    const el = coursePage('sales').el;
    expect([...el.querySelectorAll('.course-module > h2')].map(e => e.textContent)).toEqual(SALES_MODULES.map(m => m.title[lang]));
    expect([...el.querySelectorAll('.course-card')].map(e => e.getAttribute('href'))).toEqual(SALES_MODULES.flatMap(m => m.lessons).map(id => `#/lesson/${id}`));
    expect(el.querySelector('.lede')?.textContent).toBe(PRODUCTS.find(p => p.id === 'sales')!.subtitle![lang]);
  });
  for (const l of DREAM100_LESSONS) {
    it(`renders ${l.id} and mounts widgets in ${lang}`, () => {
      setLang(lang);
      const page = lessonPage(l.id);
      document.body.append(page.el);
      try {
        expect(page.el.querySelector('h1')?.textContent).toBe(l.title[lang]);
        expect(page.el.querySelector('.lede')?.textContent?.replace(/\s/g, ' ')).toBe(DREAM100_SUMMARIES[l.id]![lang]);
        for (const s of l.sections) {
          const el = page.el.querySelector(`#s-${s.id}`)!;
          expect(el).not.toBeNull();
          if (s.kind === 'widget') {
            expect(el.querySelector('.widget-host')?.children.length).toBeGreaterThan(0);
            expect(el.querySelector('.err')).toBeNull();
          }
        }
        expect(page.el.textContent).not.toContain('<!--');
        expect(page.el.textContent).not.toContain('[[');
      } finally { page.dispose?.(); }
    });
  }
}
