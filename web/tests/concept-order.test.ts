// The concept-order linter (01 §6.1) and the content contracts, run on every
// block and engine module of the build. A failure lists every problem.

import { describe, expect, it } from 'vitest';
import { lintRegistry } from '../src/core/lint';
import { buildRegistry, registry } from '../src/core/registry';
import { Corpus } from '../src/engine/docs/corpus';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import type { BlockModule, Lesson } from '../src/core/types';

const b = (ru: string, en = ru) => ({ ru, en });

describe('content of this build', () => {
  it('has no contract or concept-order errors', () => {
    const issues = lintRegistry(registry).filter((i) => i.level === 'error');
    const report = issues.map((i) => `${i.where}: ${i.msg}`).join('\n');
    expect(report).toBe('');
  });
});

describe('the linter itself', () => {
  const src = { en: [{ title: 'x', url: 'https://example.org' }], ru: [{ title: 'x', url: 'https://example.org' }] };
  const lesson = (id: string, introduces: string[], uses: string[], body: string): Lesson => ({
    id,
    block: 't',
    title: b(id),
    introduces,
    uses,
    tier: 'core',
    sources: src,
    sections: [{ id: 's', kind: 'text', body: b(body, body) }],
  });
  const make = (lessons: Lesson[], extra: Partial<BlockModule> = {}) =>
    buildRegistry(
      {
        'blocks/t/index.ts': {
          default: {
            blocks: [{ id: 't', order: 1, title: b('t'), summary: b('t'), checklistStep: null, levels: { beginner: b('b'), intermediate: b('i'), experienced: b('e') }, placement: [], lessons: lessons.map((l) => l.id), sources: src }],
            lessons,
            concepts: [
              { id: 't.proc', term: b('процесс', 'process'), forms: { ru: ['процесса', 'процессы'] }, short: b('s'), introducedIn: 'l2' },
              { id: 't.file', term: b('файл', 'file'), short: b('s'), introducedIn: 'l1', scan: false },
            ],
            ...extra,
          },
        },
      },
      { terminal: createTerminalRegistry(), corpus: new Corpus() },
    );
  const errors = (r: ReturnType<typeof make>) => lintRegistry(r).filter((i) => i.level === 'error').map((i) => i.msg);

  it('passes a correct order', () => {
    expect(errors(make([lesson('l1', ['t.file'], [], 'Про файл.'), lesson('l2', ['t.proc'], ['t.file'], 'Каждый [[t.proc]] читает файл.')]))).toEqual([]);
  });
  it('fails on `uses` before introduction', () => {
    expect(errors(make([lesson('l1', ['t.file'], ['t.proc'], 'x'), lesson('l2', ['t.proc'], [], 'y')]))).toContainEqual(expect.stringContaining('uses "t.proc" before it is introduced'));
  });
  it('fails on a glossary link before introduction', () => {
    expect(errors(make([lesson('l1', ['t.file'], [], 'Смотри [[t.proc]].'), lesson('l2', ['t.proc'], [], 'y')]))).toContainEqual(expect.stringContaining('links [[t.proc]] before'));
  });
  it('fails on a term in prose before introduction, also in word forms; ignores code', () => {
    expect(errors(make([lesson('l1', ['t.file'], [], 'Запуск процесса.'), lesson('l2', ['t.proc'], [], 'y')]))).toContainEqual(expect.stringContaining('term "процесса"'));
    expect(errors(make([lesson('l1', ['t.file'], [], 'Команда `ps` показывает process list.'), lesson('l2', ['t.proc'], [], 'y')]))).toContainEqual(expect.stringContaining('term "process"'));
    expect(errors(make([lesson('l1', ['t.file'], [], 'Команда `process` ничего не значит.'), lesson('l2', ['t.proc'], [], 'y')]))).toEqual([]);
  });
  it('fails on missing translations and sources, and on duplicate ids', () => {
    const l = lesson('l1', ['t.file'], [], 'x');
    l.sources = { en: [], ru: [] };
    l.title = { ru: 'т', en: '' };
    const e = errors(make([l, lesson('l2', ['t.proc'], [], 'y')]));
    expect(e).toContainEqual(expect.stringContaining('missing English'));
    expect(e).toContainEqual(expect.stringContaining('sources in English and in Russian'));
    const dup = buildRegistry({ 'a/index.ts': { default: { concepts: [{ id: 'x', term: b('x'), short: b('x'), introducedIn: 'l' }] } }, 'b/index.ts': { default: { concepts: [{ id: 'x', term: b('x'), short: b('x'), introducedIn: 'l' }] } } }, { terminal: createTerminalRegistry(), corpus: new Corpus() });
    expect(dup.errors.join()).toContain('defined twice');
  });
  it('fails on quiz distractors without why and DL4 tasks with hints', () => {
    const l = lesson('l1', ['t.file'], [], 'x');
    l.sections.push({ id: 'q', kind: 'quiz', items: [{ id: 'q1', kind: 'mcq', prompt: b('?'), options: [{ id: 'a', text: 'a', correct: true }, { id: 'b', text: 'b' }] }] });
    l.sections.push({ id: 't', kind: 'terminal', machine: 'sim', setup: {}, tasks: [{ id: 'x', prompt: b('do'), check: { when: 'files' }, docStep: 4, beyond: true, hints: { H2: b('no') } }] });
    const e = errors(make([l, lesson('l2', ['t.proc'], [], 'y')]));
    expect(e).toContainEqual(expect.stringContaining('every distractor needs a "why"'));
    expect(e).toContainEqual(expect.stringContaining('must not carry content hints'));
    expect(e).toContainEqual(expect.stringContaining('solutionTokens'));
  });
});
