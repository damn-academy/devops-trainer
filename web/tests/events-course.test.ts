// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { parseMarkdownLessons } from '../src/core/md-lessons';
import { EVENTS_MODULES, EVENTS_SUMMARIES } from '../src/blocks/events/structure';
import { productById } from '../src/core/products';
import { setLang } from '../src/core/i18n';
import { coursePage } from '../src/app/course-page';

it('includes all seven events lessons exactly once with summaries and resolved references', () => {
  const ids = EVENTS_MODULES.flatMap(m => m.lessons);
  const lessons = [...registry.lessons.values()].filter(l => l.block === 'events');
  expect(ids).toHaveLength(7);
  expect(new Set(ids).size).toBe(ids.length);
  expect([...ids].sort()).toEqual(lessons.map(l => l.id).sort());
  expect(registry.blocks.get('events')!.lessons).toEqual(ids);
  expect(registry.orderedLessons().filter(l => l.block === 'events').map(l => l.id)).toEqual(ids);
  for (const lesson of lessons) {
    expect(lesson.summary).toEqual(EVENTS_SUMMARIES[lesson.id]);
    for (const concept of lesson.uses) expect(registry.concepts.has(concept), concept).toBe(true);
    for (const section of lesson.sections) if (section.kind === 'widget') expect(registry.widgets.has(section.widget), section.widget).toBe(true);
  }
  expect(registry.errors).toEqual([]);
  expect(productById('events')).toMatchObject({ hidden: true, shelf: 'business' });
  expect(registry.blocks.get('events')!.hidden).toBe(true);
});

it('mirrors every widget and its position and props between translations', () => {
  const files = import.meta.glob<string>('../src/blocks/events/*.md', { query: '?raw', import: 'default', eager: true });
  let widgets = 0;
  for (const [file, raw] of Object.entries(files).filter(([f]) => f.endsWith('.ru.md'))) {
    const ru = parseMarkdownLessons(raw);
    const en = parseMarkdownLessons(files[file.replace('.ru.md', '.en.md')]!);
    const shape = (lessons: typeof ru) => lessons.map(l => ({ id: l.id, sections: l.sections.map(s => ({ kind: s.kind, widget: s.widget, props: s.props })) }));
    expect(shape(en)).toEqual(shape(ru));
    widgets += ru.flatMap(l => l.sections).filter(s => s.kind === 'widget').length;
  }
  expect(widgets).toBe(5);
});

for (const lang of ['ru', 'en'] as const) it(`renders the events modules and catalog subtitle in ${lang}`, () => {
  setLang(lang);
  const page = coursePage('events').el;
  expect([...page.querySelectorAll('.course-module > h2')].map(e => e.textContent)).toEqual(EVENTS_MODULES.map(m => m.title[lang]));
  expect([...page.querySelectorAll('.course-card')].map(e => e.getAttribute('href'))).toEqual(EVENTS_MODULES.flatMap(m => m.lessons).map(id => `#/lesson/${id}`));
  expect(page.querySelector('.lede')?.textContent).toBe(productById('events')!.subtitle![lang]);
});
