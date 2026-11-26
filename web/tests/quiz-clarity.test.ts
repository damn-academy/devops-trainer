// @vitest-environment jsdom
import { beforeAll, expect, it, vi } from 'vitest';
import { registry } from '../src/core/registry';
import { MemoryBackend, store } from '../src/core/store';
import { setLang } from '../src/core/i18n';
import { mountQuiz } from '../src/engine/quiz/render';
import type { QuizItem } from '../src/core/types';
beforeAll(async () => { await store.init(new MemoryBackend()); setLang('ru'); });

it.each(['mcq', 'multi', 'order', 'match', 'fill-command', 'predict-output', 'bugfind', 'label'] as QuizItem['kind'][])('explains %s before its controls', kind => {
  const item = [...registry.quiz.values()].find(q => q.kind === kind)!;
  expect(item).toBeTruthy();
  const root = document.createElement('div');
  const mounted = mountQuiz(root, item, { context: 'lesson' });
  const guide = root.querySelector('.task-guide')!;
  expect(guide.textContent).toContain('Проверить');
  expect(guide.textContent).toContain('зелёная галочка');
  expect(guide.compareDocumentPosition(root.querySelector('.q-body')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  mounted.dispose();
});

it('does not promise immediate grading during placement', () => {
  const item = [...registry.quiz.values()].find(q => q.kind === 'mcq')!;
  const root = document.createElement('div');
  const answered = vi.fn();
  mountQuiz(root, item, { context: 'placement', onAnswered: answered });
  expect(root.querySelector('.task-guide')!.textContent).toContain('Ответ записан');
  expect(root.querySelector('.task-guide')!.textContent).not.toContain('зелёная галочка');
  const input = root.querySelector<HTMLInputElement>('input')!;
  input.checked = true; input.dispatchEvent(new Event('change'));
  root.querySelector<HTMLButtonElement>('.q-actions button')!.click();
  expect(answered).toHaveBeenCalledOnce();
  expect(root.querySelector('.q-feedback')!.textContent).toContain('Ответ записан');
});

