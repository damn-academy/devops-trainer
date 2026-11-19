import { describe, expect, it } from 'vitest';
import { dueConcepts, reminderDue, replay } from '../src/core/progress';
import { EXPORT_FORMAT, MemoryBackend, Store } from '../src/core/store';
import type { StoreEvent } from '../src/core/types';

const ev = (t: string, e: Record<string, unknown>, id = t): StoreEvent => ({ id, t, ...e }) as StoreEvent;

describe('progress reducer', () => {
  it('derives lessons, levels, concepts and the doc ladder from events', () => {
    const p = replay([
      ev('2026-11-18T10:00:00Z', { kind: 'level.set', block: 'linux', level: 'beginner', via: 'choice' }),
      ev('2026-11-18T10:01:00Z', { kind: 'lesson.open', lesson: 'linux.a' }),
      ev('2026-11-18T10:02:00Z', { kind: 'section.done', lesson: 'linux.a', section: 's1' }),
      ev('2026-11-18T10:03:00Z', { kind: 'lesson.done', lesson: 'linux.a', concepts: ['linux.process'] }),
      ev('2026-11-18T10:04:00Z', { kind: 'doc.step', source: 'man', step: 2, block: 'linux' }),
      ev('2026-11-18T10:05:00Z', { kind: 'doc.step', source: 'man', step: 1, block: 'linux' }),
      ev('2026-11-18T10:06:00Z', { kind: 'task.pass', task: 't', hintLevel: 1, docStep: 2, docOpened: false, concepts: ['linux.process'], source: 'man' }),
    ]);
    expect(p.levels.linux).toBe('beginner');
    expect(p.lessons['linux.a']).toMatchObject({ status: 'done', sections: ['s1'] });
    expect(p.concepts['linux.process'].state).toBe('practicing');
    expect(p.docLadder.man.step).toBe(2); // never goes down
    expect(p.docLadder.man.streak).toBe(1);
  });

  it('schedules review: confident mistakes come back today, mastery after three right answers', () => {
    const base = [ev('2026-11-01T10:00:00Z', { kind: 'task.pass', task: 't', hintLevel: 0, docStep: 1, docOpened: false, concepts: ['c'] })];
    const ans = (t: string, correct: boolean, confidence = 2) => ev(t, { kind: 'quiz.answer', item: 'q', correct, score: correct ? 1 : 0, confidence, first: false, concepts: ['c'], context: 'review' });
    let p = replay([...base, ans('2026-11-02T10:00:00Z', false, 3)]);
    expect(p.concepts.c.due).toBe('2026-11-02T10:00:00Z');
    p = replay([...base, ans('2026-11-02T10:00:00Z', true), ans('2026-11-04T10:00:00Z', true), ans('2026-11-08T10:00:00Z', true)]);
    expect(p.concepts.c.state).toBe('mastered');
    expect(dueConcepts(p, '2026-11-09T00:00:00Z')).toEqual([]);
    expect(dueConcepts(p, '2026-12-31T00:00:00Z')).toEqual(['c']);
    p = replay([...base, ans('2026-11-02T10:00:00Z', true), ans('2026-11-04T10:00:00Z', true), ans('2026-11-08T10:00:00Z', true), ans('2026-11-20T10:00:00Z', false), ans('2026-11-21T10:00:00Z', false)]);
    expect(p.concepts.c.state).toBe('lapsed');
  });

  it('shows the weekly reminder only without an account and after a quiet week', () => {
    const evs = Array.from({ length: 6 }, (_, i) => ev(`2026-11-01T10:0${i}:00Z`, { kind: 'lesson.open', lesson: 'x' }));
    const p = replay(evs);
    expect(reminderDue(p, new Date('2026-11-03T00:00:00Z'), false)).toBe(false);
    expect(reminderDue(p, new Date('2026-11-09T00:00:00Z'), false)).toBe(true);
    expect(reminderDue(p, new Date('2026-11-09T00:00:00Z'), true)).toBe(false);
    const after = replay([...evs, ev('2026-11-08T00:00:00Z', { kind: 'progress.export' })]);
    expect(reminderDue(after, new Date('2026-11-09T00:00:00Z'), false)).toBe(false);
  });
});

describe('store', () => {
  it('auto-saves every event to the backend', async () => {
    const be = new MemoryBackend();
    const s = new Store();
    await s.init(be);
    s.record({ kind: 'lesson.open', lesson: 'a' });
    s.record({ kind: 'section.done', lesson: 'a', section: 'x' });
    await s.flush();
    expect(be.events.map((e) => e.kind)).toEqual(['lesson.open', 'section.done']);
    const again = new Store();
    await again.init(be);
    expect(again.state.lessons.a.sections).toEqual(['x']);
  });

  it('exports and imports by merging logs', async () => {
    const a = new Store();
    await a.init(new MemoryBackend());
    a.record({ kind: 'lesson.done', lesson: 'l1', concepts: ['c1'] });
    const file = a.exportJSON();
    expect(JSON.parse(file).format).toBe(EXPORT_FORMAT);
    const b = new Store();
    await b.init(new MemoryBackend());
    b.record({ kind: 'lesson.done', lesson: 'l2', concepts: ['c2'] });
    const r = await b.importJSON(file);
    expect(r.added).toBe(2);
    expect(Object.keys(b.state.lessons).sort()).toEqual(['l1', 'l2']);
    const r2 = await b.importJSON(file);
    expect(r2.added).toBe(0);
    await expect(b.importJSON('{"format":"other"}')).rejects.toThrow();
  });

  it('keeps snapshots in the key-value store', async () => {
    const be = new MemoryBackend();
    const s = new Store();
    await s.init(be);
    s.saveSnapshot('lab1', { a: 1 }, 0);
    await new Promise((r) => setTimeout(r, 5));
    expect(await s.loadSnapshot('lab1')).toEqual({ a: 1 });
  });
});
