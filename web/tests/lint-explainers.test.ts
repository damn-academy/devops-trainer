import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildRegistry } from '../src/core/registry';
import { collectExplainerTexts, explainerReadingMs, lintExplainers } from '../src/core/lint-explainers';
import { lintRuStyle } from '../scripts/lint-ru-style.mjs';
import type { Block, Lesson, ProcessModel, Step } from '../src/core/types';
const bi = (ru: string, en = ru) => ({ ru, en });
const step = (text: string): Step => ({ id: 's', label: 'label', focus: [], caption: bi(text) });
function fixture() {
  const calls: string[] = [];
  const model: ProcessModel = {
    id: 'e', block: 't', title: bi('Title'), intro: bi('процесса'), legend: [{ mark: 'ok', text: bi('процесса') }],
    diagram: { width: 10, height: 10, nodes: [{ id: 'n', label: 'process', sub: 'process', x: 0, y: 0, w: 10, h: 10, family: 'process', card: { what: bi('процесса'), who: bi('process'), see: 'process' } }], edges: [] },
    params: [{ id: 'mode', kind: 'choice', label: bi('mode'), default: 'a', options: ['a', 'b'].map(id => ({ id, label: bi(id) })) },
      { id: 'expert', kind: 'toggle', label: bi('expert'), default: false, levels: ['experienced'] }],
    breaks: [{ id: 'bad', label: bi('bad'), remove: [], predict: { prompt: bi('процесса'), options: [{ id: 'a', text: bi('process') }], resolve: () => 'a' } }],
    run: (p, broken) => {
      calls.push(`${p.mode}:${p.expert}:${broken.has('bad')}`);
      return [{ ...step(p.mode === 'b' ? 'process' : 'ignored `process`'), say: { n: bi('процесса') }, values: { n: 'process' },
        broken: broken.has('bad') ? { at: 'n', message: 'process', caption: bi('process') } : undefined }];
    },
    explainDelta: (_a, _b, change) => bi(change.kind === 'break' && !change.on ? 'process restored' : 'process changed'),
  };
  const lessons: Lesson[] = ['l1', 'l2'].map(id => ({ id, block: 't', title: bi(id), introduces: id === 'l2' ? ['proc'] : [], uses: [], tier: 'core', sources: { ru: [], en: [] }, sections: [] }));
  lessons[0].sections = [{ id: 'ex', kind: 'explainer', explainer: 'e', howto: bi('process'), params: { mode: 'b' }, levels: ['beginner', 'experienced'] }];
  lessons[1].sections = [{ id: 'ex', kind: 'explainer', explainer: 'e', levels: ['beginner'] }];
  const reg = buildRegistry({ 'blocks/folder/index.ts': { blocks: [{ id: 't', order: 1, lessons: ['l1', 'l2'] } as Block], lessons,
    concepts: [{ id: 'proc', term: bi('процесс', 'process'), forms: { ru: ['процесса'] }, short: bi('x'), introducedIn: 'l2' },
      { id: 'ignore', term: bi('ignored'), short: bi('x'), introducedIn: 'l2', scan: false }],
    explainers: [{ id: 'e', block: 't', title: bi('Title'), model, mount: () => ({ dispose() {} }) }],
  } });
  return { reg, model, lessons, calls };
}
it('scans both languages, plain strings, static surfaces, variants and reverse deltas for every placement', () => {
  const { reg, calls } = fixture();
  const block = lintExplainers(reg).blocks.folder;
  const hits = block.findings.filter(f => f.kind === 'concept');
  for (const path of ['intro', 'legend.0', 'howto', 'steps.s.say.n', 'steps.s.values.n', 'steps.s.broken.caption', 'diagram.0.sub', 'diagram.0.card.what', 'explainDelta']) expect(hits.some(f => f.path === path)).toBe(true);
  expect(hits.some(f => f.text === 'process restored')).toBe(true);
  expect(hits.some(f => f.language === 'en')).toBe(true);
  expect(hits.some(f => f.language === 'shared')).toBe(true);
  expect(hits.some(f => f.concept === 'ignore' || f.text === 'ignored `process`')).toBe(false);
  expect(hits.filter(f => f.path === 'intro' && f.lesson === 'l1')).toHaveLength(1);
  expect(hits.find(f => f.path === 'intro' && f.lesson === 'l1')?.levels).toEqual(['beginner', 'experienced']);
  expect(calls).toContain('b:false:false');
  expect(calls).toContain('a:false:true');
  expect(calls).toContain('a:true:false');
});
it('requires same-lesson introduction in a preceding section visible at the current level', () => {
  const { reg, lessons } = fixture();
  lessons[1].sections.unshift({ id: 'intro', kind: 'text', body: bi('[[proc]]'), levels: ['beginner'] });
  lessons[1].sections[1].levels = ['beginner', 'experienced'];
  const hits = lintExplainers(reg).blocks.folder.findings.filter(f => f.kind === 'concept' && f.lesson === 'l2');
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.every(f => f.levels.join() === 'experienced')).toBe(true);
  lessons[1].sections.reverse();
  expect(lintExplainers(reg).blocks.folder.findings.some(f => f.kind === 'concept' && f.lesson === 'l2' && f.levels.includes('beginner'))).toBe(true);
});
it('uses shared style rules and uncapped playback timing in each language', () => {
  expect(lintRuStyle('Нет: процесс остановится.')[0].rules).toContain('answer-colon');
  expect(lintRuStyle('Он — процесс.')[0].rules).toContain('dash');
  const s = step('x'.repeat(292));
  expect(explainerReadingMs(s, 'ru')).toBe(21980);
  s.say = { n: bi('xx', 'x'.repeat(100)) };
  expect(explainerReadingMs(s, 'ru')).toBe(22110);
  const { reg, model } = fixture();
  model.run = () => [s];
  const hits = lintExplainers(reg).blocks.folder.findings.filter(f => f.kind === 'reading-time');
  expect(hits.some(f => f.language === 'ru' && f.seconds === 22.11)).toBe(true);
  expect(hits.some(f => f.language === 'en' && f.seconds === 28.48)).toBe(true);
  const renderer = readFileSync(new URL('../src/engine/explainer/render.ts', import.meta.url), 'utf8');
  expect(renderer).toContain('3000 + chars * 65');
  expect(renderer).toContain('Math.min(22000, Math.max(4500, ms)) / speed');
});
it('keeps coverage gaps and runtime errors visible without aborting other models', () => {
  const { reg, model } = fixture();
  model.run = () => { throw new Error('bad run'); };
  expect(lintExplainers(reg).blocks.folder.counts.runtime).toBeGreaterThan(0);
  reg.lessons.clear();
  expect(lintExplainers(reg).blocks.folder.counts.coverage).toBe(1);
  delete reg.explainers.get('e')!.model;
  expect(lintExplainers(reg).blocks.folder.counts.coverage).toBe(2);
});
it('collects plain strings and both translations', () => {
  expect(collectExplainerTexts({ a: 'plain', b: bi('русский', 'English') }).map(t => t.language)).toEqual(['shared', 'ru', 'en']);
});

it('accepts concepts from earlier route lessons and reports delta exceptions', () => {
  const { reg, model } = fixture();
  reg.concepts.get('proc')!.introducedIn = 'l1';
  const report = lintExplainers(reg);
  expect(report.blocks.folder.findings.filter(f => f.kind === 'concept' && f.lesson === 'l2')).toEqual([]);
  model.explainDelta = () => { throw new Error('bad delta'); };
  expect(lintExplainers(reg).blocks.folder.findings.some(f => f.kind === 'runtime' && f.path === 'explainDelta')).toBe(true);
});
