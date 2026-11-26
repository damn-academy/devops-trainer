// @vitest-environment jsdom
import { beforeAll, expect, it, vi } from 'vitest';
import { registry } from '../src/core/registry';
import { MemoryBackend, store } from '../src/core/store';
import { setLang } from '../src/core/i18n';
import { renderSection } from '../src/app/sections';
import type { WidgetCtx } from '../src/core/types';

beforeAll(async () => { await store.init(new MemoryBackend()); setLang('ru'); });

it('shows widget completion only when the widget reports it', () => {
  let context: WidgetCtx;
  registry.widgets.set('test.clarity', { id: 'test.clarity', mount: (_el, _props, ctx) => { context = ctx; return { dispose() {} }; } });
  const done = vi.fn();
  const lesson = registry.orderedLessons()[0];
  const view = renderSection({ id: 'task', kind: 'widget', widget: 'test.clarity' }, { lesson, level: 'beginner', index: 0, count: 1, done });
  const status = view.el.querySelector<HTMLElement>('.task-completion')!;
  expect(status.hidden).toBe(true);
  context!.reportFacts?.({});
  expect(status.hidden).toBe(true);
  context!.complete();
  expect(status.hidden).toBe(false);
  expect(status.textContent).toContain('Раздел пройден');
  expect(done).toHaveBeenCalledWith('task');
  view.mounted?.dispose();
  registry.widgets.delete('test.clarity');
});


it('requires explicit confirmation for a calculator without automatic grading', () => {
  const done = vi.fn();
  const lesson = registry.lessons.get('finance.safe')!;
  const section = lesson.sections.find(s => s.kind === 'widget' && s.widget === 'finance.round')!;
  const view = renderSection(section, { lesson, level: 'beginner', index: 0, count: 1, done });
  expect(done).not.toHaveBeenCalled();
  expect(view.el.textContent).toContain('Выводы вы проверяете самостоятельно');
  [...view.el.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Завершить сравнение')!.click();
  expect(done).toHaveBeenCalledWith(section.id);
  expect(view.el.querySelector<HTMLElement>('.task-completion')!.hidden).toBe(false);
  view.mounted?.dispose();
});

it('keeps a written task pending until the learner confirms self-review', async () => {
  const { mountTaskDocument } = await import('../src/engine/trainers/document');
  const done = vi.fn();
  const host = document.createElement('div');
  const view = mountTaskDocument(host, 'clarity.written', 'Task', 'Write a plan', done);
  expect(done).not.toHaveBeenCalled();
  const input = host.querySelector('textarea')!;
  input.value = 'My reviewed plan'; input.dispatchEvent(new Event('input'));
  expect(done).not.toHaveBeenCalled();
  [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Завершить самопроверку')!.click();
  expect(done).toHaveBeenCalledOnce();
  expect(host.querySelector('[role="status"]')!.textContent).toContain('Самопроверка завершена');
  expect(input.value).toBe('My reviewed plan');
  view.dispose();
});
