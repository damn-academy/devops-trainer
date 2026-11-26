// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { lessonPage } from '../src/app/lesson';
import '../src/blocks/marketing/v2';
import { setLang } from '../src/core/i18n';
import { registry } from '../src/core/registry';
import { store } from '../src/core/store';
import { closeTutor, isTutorOpen, openTutor } from '../src/engine/ai/panel';

vi.mock('../src/engine/terminal/widget', () => ({
  mountTerminal: async () => ({ dispose() {}, type() {}, run: async () => {}, reset() {}, focus() {} }),
}));

beforeEach(async () => { await store.reset(); localStorage.clear(); setLang('ru'); });
afterEach(() => { closeTutor(); document.body.replaceChildren(); });

it('gives a spreadsheet lesson one result field and finishes the template with it', async () => {
  const lesson = registry.lessons.get('marketing.search-llm')!;
  const template = lesson.sections.find(s => s.kind === 'widget' && s.widget === 'template')!;
  const page = lessonPage(lesson.id);
  document.body.append(page.el);
  try {
    await vi.waitFor(() => expect(page.el.querySelector(`#s-${template.id} a[download]`)).not.toBeNull());
    expect(page.el.querySelectorAll('textarea[data-template-id]')).toHaveLength(0);
    expect(page.el.querySelectorAll('textarea[data-document-id]')).toHaveLength(1);
    const field = page.el.querySelector<HTMLTextAreaElement>('textarea[data-document-id]')!;
    field.value = 'Две нейросети из четырёх называют неверную лицензию.';
    field.dispatchEvent(new Event('input'));
    [...page.el.querySelectorAll<HTMLButtonElement>('.task-document button')].find(b => b.textContent === 'Завершить самопроверку')!.click();
    expect(store.state.lessons[lesson.id]?.sections).toContain(template.id);
  } finally { page.dispose?.(); }
  // The completion note of the template section is visible again after a reload.
  const again = lessonPage(lesson.id);
  document.body.replaceChildren(again.el);
  try {
    expect(again.el.querySelector<HTMLElement>(`#s-${template.id} .task-completion`)!.hidden).toBe(false);
    expect(again.el.querySelector('.task-document [role="status"]')?.textContent).toMatch(/Самопроверка завершена/);
  } finally { again.dispose?.(); }
});

it('closes the mentor panel on Escape and when the learner moves to another lesson', () => {
  location.hash = '#/lesson/marketing.search-llm';
  openTutor();
  expect(isTutorOpen()).toBe(true);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(isTutorOpen()).toBe(false);
  openTutor();
  location.hash = '#/lesson/marketing.paid';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect(isTutorOpen()).toBe(false);
});
