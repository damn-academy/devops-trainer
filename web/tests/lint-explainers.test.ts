import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { arpModel } from '../src/blocks/networks/explainers/arp';
import { switchModel } from '../src/blocks/networks/explainers/switch';
import { buildRegistry } from '../src/core/registry';
import { collectExplainerTexts, explainerReadingMs, explainerTermText, lintExplainers } from '../src/core/lint-explainers';
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


it('exempts code and tool output without hiding prose on the same surfaces', () => {
  const text = (path: string, value: string) => explainerTermText({ path, text: value, language: 'shared' });
  expect(text('caption', 'Before `process` after.\n```sh\nprocess\n```\nStill prose.')).not.toContain('process');
  expect(text('caption', 'Before ``process `code` process`` after.')).toBe('Before   after.');
  expect(text('caption', 'Before\n~~~sh\nprocess\n~~~\nAfter')).not.toContain('process');
  expect(text('steps.s.broken.message', 'process failed')).toBe('');
  expect(text('steps.s.broken.output', 'process failed')).toBe('');
  expect(text('steps.s.broken.caption', 'process failed')).toBe('process failed');
  for (const path of ['diagram.0.sub', 'steps.s.values.n', 'steps.s.tokens.0']) {
    for (const output of ['$ ping -c 2 process', 'ping -c 2 process', 'From 192.168.1.10 icmp_seq=1 Destination Host Unreachable', 'icmp_seq=1', 'HTTP/2 200']) {
      expect(text(path, output)).toBe('');
      expect(text(path, output + '\nThe process stopped.')).toBe('The process stopped.');
    }
    expect(text(path, 'process')).toBe('process');
    expect(text(path, 'ping uses the process')).toBe('ping uses the process');
  }
  expect(text('caption', 'ping uses the process')).toBe('ping uses the process');
});

it('checks explanatory captions and token prose while ignoring terminal surfaces', () => {
  const { reg, model } = fixture();
  model.diagram.nodes[0].sub = 'process=1';
  model.run = () => [{ ...step('`process`'), values: { n: 'process=1' },
    tokens: [{ edge: 'e', label: 'ping -c 2 process' }, { edge: 'e', label: bi('процесса', 'process') }],
    broken: { at: 'n', message: 'process failed', caption: bi('процесса', 'process') },
  }];
  const paths = lintExplainers(reg).blocks.folder.findings.filter(f => f.kind === 'concept').map(f => f.path);
  for (const path of ['diagram.0.sub', 'steps.s.caption', 'steps.s.values.n', 'steps.s.tokens.0', 'steps.s.broken.message']) expect(paths).not.toContain(path);
  for (const path of ['steps.s.tokens.1', 'steps.s.broken.caption', 'diagram.0.card.what']) expect(paths).toContain(path);
});


it('keeps realistic ping failures and their sender explanation in both network models', () => {
  const cases: [ProcessModel, string][] = [[arpModel, 'off'], [switchModel, 'unplug']];
  for (const [model, failure] of cases) {
    const params = Object.fromEntries(model.params.map(p => [p.id, p.default]));
    const broken = model.run(params, new Set([failure])).find(s => s.broken)?.broken;
    expect(broken).toBeDefined();
    expect(broken!.message).toContain('$ ping -c 2 192.168.1.20');
    for (const n of [1, 2]) expect(broken!.message).toContain(`From 192.168.1.10 icmp_seq=${n} Destination Host Unreachable`);
    for (const lang of ['ru', 'en'] as const) expect(broken!.caption[lang]).toContain('192.168.1.10');
  }
});
