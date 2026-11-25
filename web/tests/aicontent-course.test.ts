// @vitest-environment jsdom
import { beforeAll, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { parseMarkdownLessons } from '../src/core/md-lessons';
import { AICONTENT_MODULES, AICONTENT_SUMMARIES } from '../src/blocks/aicontent/structure';
import { MemoryBackend, store } from '../src/core/store';
import { setLang } from '../src/core/i18n';
import { lessonPage } from '../src/app/lesson';
import { coursePage } from '../src/app/course-page';

const files = import.meta.glob<string>('../src/blocks/aicontent/*.md', {
  query: '?raw', import: 'default', eager: true,
});
const ids = AICONTENT_MODULES.flatMap(m => m.lessons);
beforeAll(async () => { await store.init(new MemoryBackend()); });

it('includes all 13 authored lessons in six modules with summaries and quizzes', () => {
  expect(ids).toHaveLength(13);
  expect(AICONTENT_MODULES).toHaveLength(6);
  expect(new Set(ids).size).toBe(ids.length);
  expect(registry.blocks.get('aicontent')!.lessons).toEqual(ids);
  expect([...registry.lessons.values()].filter(l => l.block === 'aicontent').map(l => l.id).sort()).toEqual([...ids].sort());
  expect(Object.keys(AICONTENT_SUMMARIES).sort()).toEqual([...ids].sort());
  for (const id of ids) {
    const lesson = registry.lessons.get(id)!;
    expect(lesson.summary).toEqual(AICONTENT_SUMMARIES[id]);
    expect(lesson.sections.some(s => s.kind === 'quiz')).toBe(true);
  }
});

it('preserves lesson and section order, durations, quiz structure and every URL in English', () => {
  for (let i = 1; i <= 6; i++) {
    const raw = (lang: string) => files[`../src/blocks/aicontent/aicontent-${i}.${lang}.md`]!;
    const shape = (text: string) => parseMarkdownLessons(text).map(l => ({
      id: l.id, minutes: l.minutes,
      sections: l.sections.map(s => ({ kind: s.kind, quiz: s.kind === 'quiz' ? s.body.split('\n').filter(Boolean).map(line => [line[0], line.includes(' || ')]) : undefined })),
    }));
    expect(shape(raw('en')), `file ${i}`).toEqual(shape(raw('ru')));
    const urls = (text: string) => text.match(/https?:\/\/[^\s)]+/g);
    expect(urls(raw('en')), `file ${i} URLs`).toEqual(urls(raw('ru')));
  }
});

for (const lang of ['ru', 'en'] as const) {
  it(`renders all module links and task documents in ${lang}`, () => {
    setLang(lang);
    const course = coursePage('aicontent');
    expect([...course.el.querySelectorAll('.course-module > h2')].map(e => e.textContent)).toEqual(AICONTENT_MODULES.map(m => m.title[lang]));
    expect([...course.el.querySelectorAll('.course-card')].map(e => e.getAttribute('href'))).toEqual(ids.map(id => `#/lesson/${id}`));
    course.dispose?.();
    for (const id of ids) {
      const view = lessonPage(id);
      expect(view.el.querySelectorAll('.task-document'), id).toHaveLength(1);
      view.dispose?.();
    }
  });
}
