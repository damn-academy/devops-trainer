// @vitest-environment jsdom
import { beforeAll, expect, it, vi } from 'vitest';
import { MemoryBackend, store } from '../src/core/store';
import type { WidgetCtx } from '../src/core/types';
vi.mock('../src/engine/v86/assets', () => ({ loadLabManifest: async () => null }));
vi.mock('../src/engine/v86/lab', () => ({ labMachineMB: () => 256, labCapacity: () => 4 }));
beforeAll(async () => { await store.init(new MemoryBackend()); });

it('keeps network lesson goals when feedback snapshots collect facts', async () => {
  const { mountNetLab } = await import('../src/blocks/networks/reallab/widget');
  const { LABS } = await import('../src/blocks/networks/reallab/labs');
  const spec = Object.values(LABS).find(l => l.tasks.some(t => !t.levels || t.levels.includes('beginner')))!;
  const ctx: WidgetCtx = { level: 'beginner', lessonId: 'network-clarity', sectionId: 'lab', complete() {}, record() {}, openDoc() {}, reportFacts() {} };
  const lessonRoot = document.createElement('div');
  const lesson = mountNetLab(lessonRoot, { lab: spec.id }, ctx);
  expect(lessonRoot.querySelectorAll('.goal').length).toBeGreaterThan(0);
  lesson.dispose();
  const examRoot = document.createElement('div');
  const exam = mountNetLab(examRoot, { lab: spec.id }, { ...ctx, exam: true });
  expect(examRoot.querySelectorAll('.goal')).toHaveLength(0);
  exam.dispose();
});
