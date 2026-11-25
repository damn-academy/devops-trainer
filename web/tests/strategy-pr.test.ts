// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { parseMarkdownLessons } from '../src/core/md-lessons';
import { productById, visibleProducts } from '../src/core/products';
import { setLang } from '../src/core/i18n';
import { MemoryBackend, store } from '../src/core/store';
import { coursePage } from '../src/app/course-page';
import { lessonPage } from '../src/app/lesson';

const files = import.meta.glob<string>('../src/blocks/{strategy,pr}/*.md', { query: '?raw', import: 'default', eager: true });
beforeAll(async () => { await store.init(new MemoryBackend()); });
afterEach(() => { setLang('ru'); });
for (const course of ['strategy', 'pr']) {
  it(`${course}: includes every source lesson exactly once, resolves concepts and widgets`, () => {
    const block = registry.blocks.get(course)!;
    const source = Object.entries(files).filter(([path]) => path.includes(`/${course}/`) && path.endsWith('.ru.md')).flatMap(([, raw]) => parseMarkdownLessons(raw));
    const ids = block.modules!.flatMap(module => module.lessons);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(source.map(lesson => lesson.id).sort());
    expect(block.lessons).toEqual(ids);
    expect(registry.orderedLessons().filter(l => l.block === course).map(l => l.id)).toEqual(ids);
    for (const id of ids) {
      const lesson = registry.lessons.get(id)!;
      for (const concept of lesson.uses) expect(registry.concepts.has(concept), concept).toBe(true);
      for (const section of lesson.sections) if (section.kind === 'widget') expect(registry.widgets.has(section.widget), section.widget).toBe(true);
    }
    expect(block.hidden).toBe(true);
    expect(productById(course)).toMatchObject({ shelf: 'business' });
    expect(visibleProducts('course').some(product => product.id === course)).toBe(true);
  });
  for (const lang of ['ru', 'en'] as const) it(`${course}: renders modules, summaries and lesson navigation in ${lang}`, () => {
    setLang(lang);
    const block = registry.blocks.get(course)!;
    const page = coursePage(course).el;
    expect(page.querySelector('h1')?.textContent).toBe(productById(course)!.title[lang]);
    expect(page.querySelector('.lede')?.textContent).toBe(productById(course)!.subtitle![lang]);
    expect([...page.querySelectorAll('.course-module > h2')].map(el => el.textContent)).toEqual(block.modules!.map(module => module.title[lang]));
    expect([...page.querySelectorAll('.course-card')].map(el => el.getAttribute('href'))).toEqual(block.lessons.map(id => `#/lesson/${id}`));
    if (lang === 'en') expect(page.textContent).not.toMatch(/[а-яё]/i);
    for (const [index, id] of block.lessons.entries()) {
      const lesson = registry.lessons.get(id)!;
      const view = lessonPage(id);
      expect(view.el.querySelector('.lede')?.textContent?.replace(/\s/g, ' ')).toBe(lesson.summary![lang]);
      expect([...view.el.querySelectorAll('.lesson-nav a')].map(el => el.getAttribute('href'))).toEqual([...(index > 0 ? [`#/lesson/${block.lessons[index - 1]}`] : []), block.lessons[index + 1] ? `#/lesson/${block.lessons[index + 1]}` : '#/courses']);
      view.dispose?.();
    }
  });
}
it('mirrors widget markers and their section positions across languages', () => {
  for (const [path, raw] of Object.entries(files).filter(([path]) => path.endsWith('.ru.md'))) {
    const embeds = (raw: string) => parseMarkdownLessons(raw).map(lesson => ({ id: lesson.id, sections: lesson.sections.filter(s => s.kind !== 'sources').map(s => ({ kind: s.kind, widget: s.widget, props: s.props })) }));
    expect(embeds(files[path.replace('.ru.md', '.en.md')]!)).toEqual(embeds(raw));
  }
});
