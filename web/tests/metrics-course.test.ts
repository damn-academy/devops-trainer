// @vitest-environment jsdom
import { beforeAll, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { parseMarkdownLessons } from '../src/core/md-lessons';
import { METRICS_MODULES, METRICS_SUMMARIES } from '../src/blocks/metrics/structure';
import { setLang } from '../src/core/i18n';
import { MemoryBackend, store } from '../src/core/store';
import { coursePage } from '../src/app/course-page';
import { lessonPage } from '../src/app/lesson';

beforeAll(async () => { await store.init(new MemoryBackend()); });

it('registers all fifteen metrics lessons in six modules with summaries and quizzes', () => {
  const ids = METRICS_MODULES.flatMap(m => m.lessons);
  expect(METRICS_MODULES).toHaveLength(6);
  expect(ids).toHaveLength(15);
  expect(new Set(ids).size).toBe(15);
  expect(registry.blocks.get('metrics')!.lessons).toEqual(ids);
  expect(registry.orderedLessons().filter(l => l.block === 'metrics').map(l => l.id)).toEqual(ids);
  for (const id of ids) {
    const lesson = registry.lessons.get(id)!;
    expect(lesson.summary).toEqual(METRICS_SUMMARIES[id]);
    expect([...registry.quiz.keys()].filter(q => q.startsWith(`${id}.q`))).toHaveLength(3);
  }
  expect(registry.errors).toEqual([]);
});

it('preserves lesson markers, section order, quiz answers, URLs, tables and YAML across translations', () => {
  const files = import.meta.glob<string>('../src/blocks/metrics/*.md', { query: '?raw', import: 'default', eager: true });
  expect(Object.keys(files)).toHaveLength(12);
  const shape = (raw: string) => parseMarkdownLessons(raw).map(l => ({
    id: l.id, minutes: l.minutes,
    sections: l.sections.map(s => ({ kind: s.kind,
      quiz: s.kind === 'quiz' ? s.body.split('\n').map(line => line[0]) : undefined,
      urls: s.body.match(/https?:\/\/[^\s)]+/g) ?? [],
      table: s.body.split('\n').filter(line => line.startsWith('|')).map(line => line.split('|').length),
      yaml: s.body.match(/```yaml\n[\s\S]*?```/g) ?? [],
    })),
  }));
  for (const [path, ru] of Object.entries(files).filter(([path]) => path.endsWith('.ru.md'))) {
    const en = files[path.replace('.ru.md', '.en.md')]!;
    expect(shape(en), path).toEqual(shape(ru));
    expect(en).not.toMatch(/[А-Яа-яЁё]/);
  }
});

for (const lang of ['ru', 'en'] as const) it(`renders modules and an editable task document in every metrics lesson in ${lang}`, () => {
  setLang(lang);
  const course = coursePage('metrics');
  expect([...course.el.querySelectorAll('.course-module > h2')].map(el => el.textContent)).toEqual(METRICS_MODULES.map(m => m.title[lang]));
  for (const id of METRICS_MODULES.flatMap(m => m.lessons)) {
    const view = lessonPage(id);
    expect(view.el.querySelectorAll('.task-document textarea'), id).toHaveLength(1);
    expect(view.el.querySelector<HTMLTextAreaElement>('.task-document textarea')!.value).toContain(lang === 'ru' ? 'Выполните задание в документе' : 'Complete the task in the document');
    view.dispose?.();
  }
  course.dispose?.();
});
