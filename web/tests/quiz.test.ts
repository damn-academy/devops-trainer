import { describe, expect, it } from 'vitest';
import { gradeBugfind, gradeLabel, gradeMatch, gradeMcq, gradeMulti, gradeOrder, normalizeCommand, normalizeOutput } from '../src/engine/quiz/grade';
import { registry } from '../src/core/registry';
import type { BugfindItem, LabelItem, MatchItem, McqItem, MultiItem, OrderItem } from '../src/core/types';

const b = (s: string) => ({ ru: s, en: s });

describe('quiz grading', () => {
  it('mcq explains the chosen distractor', () => {
    const q: McqItem = { id: 'q', kind: 'mcq', prompt: b('?'), options: [{ id: 'a', text: 'a', correct: true }, { id: 'b', text: 'b', why: b('because b') }] };
    expect(gradeMcq(q, 'a').correct).toBe(true);
    const g = gradeMcq(q, 'b');
    expect(g.correct).toBe(false);
    expect(g.feedback[0].en).toBe('because b');
  });
  it('multi needs the exact set', () => {
    const q: MultiItem = { id: 'm', kind: 'multi', prompt: b('?'), options: [{ id: 'a', text: 'a', correct: true }, { id: 'b', text: 'b', correct: true }, { id: 'c', text: 'c', why: b('no c') }] };
    expect(gradeMulti(q, ['a', 'b']).correct).toBe(true);
    const g = gradeMulti(q, ['a', 'c']);
    expect(g.correct).toBe(false);
    expect(g.feedback.map((f) => f.en)).toContain('no c');
  });
  it('order gives partial credit by the longest right subsequence', () => {
    const q: OrderItem = { id: 'o', kind: 'order', prompt: b('?'), steps: ['1', '2', '3', '4'].map((id) => ({ id, text: id })) };
    expect(gradeOrder(q, ['1', '2', '3', '4']).correct).toBe(true);
    const g = gradeOrder(q, ['2', '1', '3', '4']);
    expect(g.correct).toBe(false);
    expect(g.score).toBe(0.75);
  });
  it('match, bugfind, label', () => {
    const m: MatchItem = { id: 'x', kind: 'match', prompt: b('?'), pairs: [{ id: 'p1', left: 'a', right: 'A' }, { id: 'p2', left: 'b', right: 'B', why: b('b is B') }] };
    expect(gradeMatch(m, { p1: 'p1', p2: 'p2' }).correct).toBe(true);
    expect(gradeMatch(m, { p1: 'p1', p2: 'p1' }).feedback[0].en).toBe('b is B');
    const f: BugfindItem = { id: 'f', kind: 'bugfind', prompt: b('?'), code: 'a\nb', bug: [2], why: { 1: b('fine'), 2: b('bug') } };
    expect(gradeBugfind(f, 2).correct).toBe(true);
    expect(gradeBugfind(f, 1).feedback[0].en).toBe('fine');
    const l: LabelItem = { id: 'l', kind: 'label', prompt: b('?'), diagram: { width: 10, height: 10, slots: [{ id: 's', x: 0, y: 0, w: 1, h: 1, answer: 'k' }] }, labels: [{ id: 'k', text: 'k' }, { id: 'z', text: 'z', why: b('not z') }] };
    expect(gradeLabel(l, { s: 'k' }).correct).toBe(true);
    expect(gradeLabel(l, { s: 'z' }).feedback[0].en).toBe('not z');
  });
  it('normalises commands and outputs', () => {
    expect(normalizeCommand("  ls   -l  'file' ")).toBe('ls -l file');
    expect(normalizeOutput('a  b \n\n')).toBe('a b');
  });
});

describe('quiz items of the demo block grade against the simulator', () => {
  it('fill-command runs on a fresh machine', async () => {
    const { gradeFill } = await import('../src/engine/quiz/grade');
    const item = registry.quiz.get('demo.q.fill');
    if (item?.kind !== 'fill-command') throw new Error('missing demo.q.fill');
    expect((await gradeFill(item, '|')).correct).toBe(true);
    const wrong = await gradeFill(item, '>');
    expect(wrong.correct).toBe(false);
    expect(wrong.feedback.length).toBeGreaterThan(0);
  });
  it('predict-output takes its reference from the simulator', async () => {
    const { gradePredict } = await import('../src/engine/quiz/grade');
    const item = registry.quiz.get('demo.q.predict');
    if (item?.kind !== 'predict-output') throw new Error('missing demo.q.predict');
    const g = await gradePredict(item, '1');
    expect(g.actual.trim()).toBe('1');
    expect(g.correct).toBe(true);
  });
});
