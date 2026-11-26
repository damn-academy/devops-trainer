// @vitest-environment jsdom
// The v10 verification pass of the DevOps profession: dtlab destroy now asks
// before deleting, the exams say how to answer it and start only the VMs they
// need, the bugfind caption fits items that ask for another line, and the
// boundaries lesson does not promise a real machine above a simulator.

import { beforeAll, describe, expect, it } from 'vitest';
import { MemoryBackend, store } from '../src/core/store';
import { DTLAB_CLEANUP } from '../src/app/real/facts';
import { ACCESS_EXAM, DISK_EXAM } from '../src/blocks/linux/exam-real';
import { mountQuiz } from '../src/engine/quiz/render';
import type { QuizItem } from '../src/core/types';

beforeAll(async () => {
  await store.init(new MemoryBackend());
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

describe('DevOps v10', () => {
  it('the cleanup accepts the Russian dtlab status of a removed lab', () => {
    expect(DTLAB_CLEANUP.some((re) => re.test('лаборатории пока нет: выполните dtlab check, потом dtlab up'))).toBe(true);
  });

  it('the Linux exams start only what they use and say what else starts', () => {
    expect(DISK_EXAM.real?.dtlabUp).toBe('dtlab up --with learner');
    expect(ACCESS_EXAM.real?.dtlabNote?.ru).toContain('worker-1');
  });

  it('every own-machine cleanup says to confirm dtlab destroy', async () => {
    const { loadRegistry } = await import('../src/core/registry');
    const exams = [...(await loadRegistry()).exams.values()].filter((e) => e.real && !e.inTab);
    for (const e of exams) {
      const c = e.tasks.find((x) => x.id === 'cleanup' && x.kind === 'real') as { real: { prompt: { ru: string; en: string } } } | undefined;
      if (!c) continue;
      expect(c.real.prompt.ru, e.id).toContain('подтвердите удаление ответом `y`');
      expect(c.real.prompt.en, e.id).toContain('confirm the deletion with `y`');
    }
  });

  it('a bugfind item with its own action does not ask for the line with the bug', () => {
    const item = { id: 't', kind: 'bugfind', concepts: [], prompt: { ru: 'п', en: 'p' }, code: 'a\nb', action: { ru: 'Нажмите на строку, после которой нужно добавить недостающую.', en: 'x' }, bug: [1], why: {} } as unknown as QuizItem;
    const root = document.createElement('div');
    mountQuiz(root, item, { context: 'exam' });
    expect(root.querySelector('.q-hint')?.textContent ?? '').not.toContain('с ошибкой');
  });

  it('the boundaries lesson fixes the breaks in the simulator', async () => {
    const src = (await import('../src/blocks/containers/lessons/boundaries')) as Record<string, unknown>;
    expect(JSON.stringify(src)).not.toContain('на настоящей машине');
  });
});
