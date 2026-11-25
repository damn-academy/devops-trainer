// @vitest-environment jsdom
import { beforeAll, expect, it } from 'vitest';
import { registry, buildRegistry } from '../src/core/registry';
import { MemoryBackend, store } from '../src/core/store';
import { setLang } from '../src/core/i18n';
import { PRODUCTS, catalogGroups, visibleProducts } from '../src/core/products';
import { MARKETING_MODULES, MARKETING_SUMMARIES } from '../src/blocks/marketing/structure';
import { coursePage } from '../src/app/course-page';
import { coursesPage } from '../src/app/courses-page';
import { homePage } from '../src/app/home';
import { lessonPage } from '../src/app/lesson';
import { sourcesBlock } from '../src/app/common';

beforeAll(async () => { await store.init(new MemoryBackend()); });
it('includes every marketing lesson exactly once in module order throughout the registry', () => {
  const ids = MARKETING_MODULES.flatMap(m => m.lessons);
  const owned = [...registry.lessons.values()].filter(l => l.block === 'marketing');
  expect(new Set(ids).size).toBe(ids.length);
  expect([...ids].sort()).toEqual(owned.map(l => l.id).sort());
  expect(registry.blocks.get('marketing')!.lessons).toEqual(ids);
  expect(registry.orderedLessons().filter(l => l.block === 'marketing').map(l => l.id)).toEqual(ids);
  for (const l of owned) expect(l.summary).toEqual(MARKETING_SUMMARIES[l.id]);
});
it('rejects missing, duplicate and foreign lessons in modules', () => {
  const block = registry.blocks.get('marketing')!;
  const lessons = [...registry.lessons.values()].filter(l => l.block === block.id);
  for (const ids of [block.lessons.slice(1), [...block.lessons, block.lessons[0]], [...block.lessons.slice(1), 'foreign']]) {
    const r = buildRegistry({ test: { blocks: [{ ...block, modules: [{ title: block.title, lessons: ids }] }], lessons } });
    expect(r.errors.join()).toContain('every lesson exactly once');
  }
});
for (const lang of ['ru', 'en'] as const) {
  it(`renders modules, summaries, navigation and course breadcrumbs in ${lang}`, () => {
    setLang(lang);
    const page = coursePage('marketing').el;
    expect([...page.querySelectorAll('.course-module > h2')].map(e => e.textContent)).toEqual(MARKETING_MODULES.map(m => m.title[lang]));
    expect([...page.querySelectorAll('.course-card')].map(e => e.getAttribute('href'))).toEqual(registry.blocks.get('marketing')!.lessons.map(id => `#/lesson/${id}`));
    expect(page.querySelector('.crumbs a')?.getAttribute('href')).toBe('#/courses');
    expect(page.querySelector('.lede')?.textContent).toBe(PRODUCTS.find(p => p.id === 'marketing')!.subtitle![lang]);
    const lesson = registry.lessons.get('marketing.platforms-linkedin')!;
    const view = lessonPage(lesson.id);
    expect(view.el.querySelector('.lede')?.textContent?.replace(/\s/g, ' ')).toBe(lesson.summary![lang]);
    expect([...view.el.querySelectorAll('.crumbs a')].map(e => e.getAttribute('href'))).toEqual(['#/courses', '#/course/marketing']);
    expect(view.el.querySelector('.lesson-meta')?.textContent).toContain('8 / 30');
    expect([...view.el.querySelectorAll('.lesson-nav a')].map(e => e.getAttribute('href'))).toEqual(['#/lesson/marketing.platforms-map', '#/lesson/marketing.platforms-x-bluesky']);
    expect(view.el.querySelectorAll('[data-step="hook"]')).toHaveLength(1);
    view.dispose?.();
  });
  it(`deduplicates equal URL sets using ${lang} labels and preserves different lists`, () => {
    setLang(lang);
    const s = { ru: [{ url: 'https://one.test', title: 'Русский' }], en: [{ url: 'https://one.test', title: 'English' }] };
    const el = sourcesBlock(s);
    expect(el.querySelectorAll('ul')).toHaveLength(1);
    expect(el.querySelector('a')?.textContent).toBe(s[lang][0].title);
    expect(el.querySelector('.sources-cols')).toBeNull();
    expect(sourcesBlock({ ...s, en: [{ url: 'https://two.test', title: 'Other' }] }).querySelectorAll('.sources-cols ul')).toHaveLength(2);
  });
}
it('groups preview courses in shelf order, keeping them hidden on home until published', () => {
  expect(catalogGroups(PRODUCTS.filter(p => p.kind === 'course'))[0].products.map(p => p.id)).toEqual(['marketing', 'sales', 'events', 'oss', 'strategy', 'pr']);
  expect(coursesPage().el.querySelectorAll('.catalog-shelf .catalog-tile')).toHaveLength(6);
  expect(visibleProducts('course')).toEqual([]);
  expect(homePage().el.querySelector('.catalog-shelf')).toBeNull();
  const marketing = PRODUCTS.find(p => p.id === 'marketing')!;
  try {
    marketing.hidden = false;
    expect(homePage().el.querySelector('.catalog-shelf a')?.getAttribute('href')).toBe('#/course/marketing');
  } finally { marketing.hidden = true; }
});

it('does not repeat a legacy Markdown hook as the lead', () => {
  const lesson = registry.lessons.get('marketing.platforms-linkedin')!;
  const original = lesson.summary;
  const hook = lesson.sections.find(s => s.kind === 'text' && s.step === 'hook')!;
  if (hook.kind !== 'text') throw new Error('Missing hook');
  try {
    lesson.summary = hook.body;
    const page = lessonPage(lesson.id);
    expect(page.el.querySelector('.lede')).toBeNull();
    expect(page.el.querySelectorAll('[data-step="hook"]')).toHaveLength(1);
    page.dispose?.();
  } finally { lesson.summary = original; }
});
