// @vitest-environment jsdom
import { beforeAll, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { MemoryBackend, store } from '../src/core/store';
import { setLang } from '../src/core/i18n';
import { OSS_MODULES, OSS_SUMMARIES } from '../src/blocks/oss/structure';
import { STRATEGY_MODULES, STRATEGY_SUMMARIES } from '../src/blocks/strategy/structure';
import { lessonPage } from '../src/app/lesson';

beforeAll(async () => { await store.init(new MemoryBackend()); });
for (const [block, modules, summaries, count] of [
  ['oss', OSS_MODULES, OSS_SUMMARIES, 10],
  ['strategy', STRATEGY_MODULES, STRATEGY_SUMMARIES, 8],
] as const) it(`includes every ${block} lesson once in module order with summaries`, () => {
  const ids = modules.flatMap(m => m.lessons);
  const lessons = [...registry.lessons.values()].filter(l => l.block === block);
  expect(ids).toHaveLength(count);
  expect(new Set(ids).size).toBe(count);
  expect([...ids].sort()).toEqual(lessons.map(l => l.id).sort());
  expect(registry.blocks.get(block)!.lessons).toEqual(ids);
  expect(registry.orderedLessons().filter(l => l.block === block).map(l => l.id)).toEqual(ids);
  for (const lesson of lessons) expect(lesson.summary).toEqual(summaries[lesson.id]);
});

it('preserves lesson markers, section order, quiz structure and source URLs in English mirrors', () => {
  const files = import.meta.glob<string>('../src/blocks/{events,oss,strategy}/*.md', { query: '?raw', import: 'default', eager: true });
  const shape = (raw: string) => raw.split('\n').flatMap(line => {
    if (line.startsWith('<!--')) return [line.replace(/\|.*?(?=-->)/, '|')];
    if (line.startsWith('? ')) return ['?'];
    if (/^[+-] .* \|\| /.test(line)) return [line[0] + ' ||'];
    return [];
  });
  for (const [file, ru] of Object.entries(files).filter(([f]) => f.endsWith('.ru.md'))) {
    const en = files[file.replace('.ru.md', '.en.md')]!;
    expect(shape(en), file).toEqual(shape(ru));
    expect(en.match(/https?:\/\/[^\s;]+/g), file).toEqual(ru.match(/https?:\/\/[^\s;]+/g));
  }
});

for (const lang of ['ru', 'en'] as const) it(`provides editable task documents for the new lessons in ${lang}`, () => {
  setLang(lang);
  for (const id of ['strategy.market-events', 'strategy.market-shifts', 'strategy.sovereignty', 'strategy.event-offer', 'oss.foundations', 'oss.donation', 'events.portfolio']) {
    const page = lessonPage(id);
    try {
      const inputs = page.el.querySelectorAll<HTMLTextAreaElement>('.task-document textarea');
      expect(inputs, id).toHaveLength(1);
      // A blank form with the task's fields; the task text itself stays above the field.
      expect(inputs[0].value, id).toMatch(/^## /);
      expect(inputs[0].value, id).not.toContain(lang === 'ru' ? 'Выполните задание в документе на этой странице.' : 'Complete the exercise in the document on this page.');
    } finally { page.dispose?.(); }
  }
});
