import { MARKETING_MODULES, MARKETING_SUMMARIES } from '../src/blocks/marketing/structure';
import { describe, expect, it } from 'vitest';
import { bilingualLessons, loadMarkdownLessons, parseMarkdownLessons } from '../src/blocks/marketing/v2/parser';
import { MARKETING_V2_LESSONS } from '../src/blocks/marketing/v2';
import { MARKETING_LESSONS } from '../src/blocks/marketing/content';
import { registry } from '../src/core/registry';

const sample = `<!-- lesson: marketing.sample | Sample | 5 -->
<!-- section: hook -->
Opening **Markdown** with [[marketing.icp|buyer]].

Second paragraph.
<!-- section: theory | Explanation -->
- First
- Second
<!-- section: theory | More -->
More detail.
<!-- section: task | Practice -->
Try it.
<!-- section: sources -->
- Example — https://example.com/path (25.11.2026)
`;
const files = import.meta.glob<string>('../src/blocks/marketing/v2/*.md', {
  query: '?raw', import: 'default', eager: true,
});

describe('marketing Markdown parser', () => {
  it('preserves paragraphs, Markdown, repeated sections, and lesson order with CRLF', () => {
    const parsed = parseMarkdownLessons((sample + sample.replace('marketing.sample', 'marketing.second')).replaceAll('\n', '\r\n'));
    expect(parsed.map((l) => l.id)).toEqual(['marketing.sample', 'marketing.second']);
    expect(parsed[0]!.sections[0]!.body).toBe('Opening **Markdown** with [[marketing.icp|buyer]].\n\nSecond paragraph.');
    expect(parsed[0]!.sections.map((s) => s.kind)).toEqual(['hook', 'theory', 'theory', 'task', 'sources']);
  });

  it('builds bilingual engine sections, concept dependencies, and dated sources', () => {
    const [l] = bilingualLessons(sample, sample.replace('Sample |', 'English title |').replace('Try it.', 'English task.'));
    expect(l!.title.en).toBe('English title');
    expect(l!.minutes).toBe(5);
    expect(l!.sections.map((s) => [s.id, s.kind, s.step])).toEqual([
      ['hook-1', 'text', 'hook'], ['theory-1', 'text', 'explain'],
      ['theory-2', 'text', 'explain'], ['task-1', 'text', 'practice'],
    ]);
    expect(l!.sections[3]).toMatchObject({ title: { en: 'Practice' }, body: { en: 'English task.' } });
    expect(l!.introduces).toEqual([]);
    expect(l!.uses).toEqual(['marketing.icp']);
    expect(l!.sources.ru).toEqual([{ title: 'Example', url: 'https://example.com/path', note: { ru: '25.11.2026', en: '25.11.2026' } }]);
  });

  it.each([', ', ' и ', ' and '])('expands source URLs separated by %s', (separator) => {
    const raw = sample.replace('https://example.com/path', `https://example.com/path${separator}https://example.org/faq`);
    const links = bilingualLessons(raw, raw)[0]!.sources.ru;
    expect(links.map((s) => s.url)).toEqual(['https://example.com/path', 'https://example.org/faq']);
    expect(links.every((s) => s.title === 'Example' && s.note?.ru === '25.11.2026')).toBe(true);
  });

  it('preserves separately dated references grouped in a source bullet', () => {
    const raw = sample.replace('(25.11.2026)', '(25.11.2026); Update — https://example.org/update (2026)');
    expect(bilingualLessons(raw, raw)[0]!.sources.ru[1]).toEqual({
      title: 'Update', url: 'https://example.org/update', note: { ru: '2026', en: '2026' },
    });
  });

  it('shares the final date across grouped references when needed', () => {
    const raw = sample.replace('https://example.com/path', 'https://example.com/wiki_(topic); Other — https://example.org/other');
    expect(bilingualLessons(raw, raw)[0]!.sources.ru).toEqual([
      { title: 'Example', url: 'https://example.com/wiki_(topic)', note: { ru: '25.11.2026', en: '25.11.2026' } },
      { title: 'Other', url: 'https://example.org/other', note: { ru: '25.11.2026', en: '25.11.2026' } },
    ]);
  });

  it('preserves distinct dates for URLs sharing a title and accepts undated links', () => {
    const raw = sample.replace('(25.11.2026)', '(2025), https://example.org/new (2026)');
    expect(bilingualLessons(raw, raw)[0]!.sources.ru.map((s) => s.note?.ru)).toEqual(['2025', '2026']);
    const undated = sample.replace(' (25.11.2026)', '');
    expect(bilingualLessons(undated, undated)[0]!.sources.ru[0]).toEqual({ title: 'Example', url: 'https://example.com/path' });
  });

  it('falls back to Russian sources unless English supplies its own', () => {
    expect(bilingualLessons(sample, sample.split('<!-- section: sources -->')[0]!)[0]!.sources.en)
      .toEqual(bilingualLessons(sample, sample)[0]!.sources.ru);
    expect(bilingualLessons(sample, sample.replace('https://example.com/path', 'https://example.org/en'))[0]!.sources.en[0]!.url)
      .toBe('https://example.org/en');
  });

  it.each([
    '', 'orphan text', '<!-- section: hook -->\ntext',
    sample.replace(' | 5 -->', ' | zero -->'),
    sample.replace('section: theory | More', 'section: unknown | More'),
    sample.replace('section: task | Practice', 'section: task'),
    sample.replace('section: theory | More', 'section: hook'),
    sample.replace('Try it.', ''), sample + sample,
  ])('rejects malformed input %#', (raw) => expect(() => parseMarkdownLessons(raw)).toThrow());

  it.each([
    sample.replace('marketing.sample', 'marketing.other'),
    sample.replace('section: task', 'section: theory'),
    sample.replace(' | 5 -->', ' | 6 -->'),
    sample + sample.replace('marketing.sample', 'marketing.other'),
    sample.replace('https://example.com/path', 'javascript:alert(1)'),
  ])('rejects translation drift or malformed sources %#', (en) => expect(() => bilingualLessons(sample, en)).toThrow());

  it('sorts files and rejects missing pairs and duplicate ids across files', () => {
    const second = sample.replace('marketing.sample', 'marketing.second');
    expect(loadMarkdownLessons({ 'b.ru.md': second, 'b.en.md': second, 'a.ru.md': sample, 'a.en.md': sample }).map((l) => l.id))
      .toEqual(['marketing.sample', 'marketing.second']);
    expect(() => loadMarkdownLessons({ 'a.ru.md': sample })).toThrow('Missing translation');
    expect(() => loadMarkdownLessons({ 'a.en.md': sample })).toThrow('Missing Russian original');
    expect(() => loadMarkdownLessons({ 'a.ru.md': sample, 'a.en.md': sample, 'b.ru.md': sample, 'b.en.md': sample })).toThrow('Duplicate lesson across files');
  });

  it('pairs every current and future Russian file with identical English ids and section structure', () => {
    expect(loadMarkdownLessons(files)).toEqual(MARKETING_V2_LESSONS);
    expect(MARKETING_V2_LESSONS.length).toBeGreaterThan(0);
    for (const path of Object.keys(files).filter((p) => p.endsWith('.ru.md'))) {
      const ru = parseMarkdownLessons(files[path]!);
      const en = parseMarkdownLessons(files[path.replace(/\.ru\.md$/, '.en.md')]!);
      const shape = (ls: typeof ru) => ls.map((l) => ({ id: l.id, sections: l.sections.map((s) => s.kind) }));
      expect(shape(en), path).toEqual(shape(ru));
    }
  });

  it('registers authored module order, with all concepts introduced earlier', () => {
    const ids = MARKETING_MODULES.flatMap(m => m.lessons);
    expect(registry.blocks.get('marketing')!.lessons).toEqual(ids);
    const introduced = new Set<string>();
    for (const lessonId of ids) {
      const l = MARKETING_LESSONS.find(l => l.id === lessonId)!;
      if (MARKETING_V2_LESSONS.includes(l)) {
        expect(registry.lessons.get(l.id)).toEqual({ ...l, summary: MARKETING_SUMMARIES[l.id] });
        for (const id of l.uses) {
          expect(registry.concepts.has(id), `${l.id}: unknown ${id}`).toBe(true);
          expect(introduced.has(id), `${l.id}: ${id} not introduced earlier`).toBe(true);
        }
      }
      for (const id of l.introduces) introduced.add(id);
    }
  });
});
