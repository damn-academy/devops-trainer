// @vitest-environment jsdom
// The v11 verification pass of the DevOps profession: the sequence diagrams
// have a phone layout readable without shrinking, the final exam's alert
// question gives one instruction, and a phone's terminal follows the cursor.

import { beforeAll, describe, expect, it } from 'vitest';
import { MemoryBackend, store } from '../src/core/store';
import { CAPSTONE_EXAM } from '../src/blocks/career/final-exam';
import { tcpModel, tlsModel } from '../src/blocks/networks/explainers/tcp';
import { mountQuiz } from '../src/engine/quiz/render';
import { followCursor } from '../src/engine/terminal/widget';
import type { QuizItem } from '../src/core/types';

beforeAll(async () => {
  await store.init(new MemoryBackend());
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

describe('DevOps v11', () => {
  it('the TCP and TLS diagrams fit a phone at the reading scale', () => {
    for (const model of [tcpModel, tlsModel]) {
      const narrow = model.diagram.narrow!;
      expect(narrow, model.id).toBeTruthy();
      // 320 px of window hold 400 units at 11/14 of the authored size.
      expect(narrow.width * 11 / 14, model.id).toBeLessThanOrEqual(320);
      for (const n of narrow.nodes) expect(n.x + n.w, `${model.id} ${n.id}`).toBeLessThanOrEqual(narrow.width);
      for (const e of model.diagram.edges) expect(narrow.edgeVia?.[e.id]?.length, `${model.id} ${e.id}`).toBe(e.via?.length);
    }
  });

  it('the final exam alert question says once which line to click', () => {
    const task = CAPSTONE_EXAM.tasks.find((x) => x.id === 'a4-alert') as { item: QuizItem };
    const root = document.createElement('div');
    mountQuiz(root, task.item, { context: 'exam' });
    const text = root.textContent ?? '';
    expect(root.querySelector('.q-hint')).toBeNull();
    expect(text.match(/Нажмите на/g)?.length).toBe(1);
  });

  it('a phone terminal gets a shaded edge and a hint, and gives them back', () => {
    const wrap = document.createElement('div');
    const box = document.createElement('div');
    wrap.append(box);
    const listeners: (() => void)[] = [];
    const term = {
      cols: 80, element: undefined, buffer: { active: { cursorX: 0 } },
      onCursorMove: (f: () => void) => { listeners.push(f); return { dispose() {} }; },
      onResize: () => ({ dispose() {} }),
    };
    const cleanup = followCursor(term as never, box, 'hint');
    expect(box.querySelector('.term-edge')).not.toBeNull();
    expect(wrap.querySelector('.term-scroll-hint')?.textContent).toBe('hint');
    expect(listeners).toHaveLength(1);
    cleanup();
    expect(wrap.querySelector('.term-edge, .term-scroll-hint')).toBeNull();
  });
});
